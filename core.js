
/* =====================================================
   DATEN CONTAINER
===================================================== */

let kunden = [];
let aufgaben = [];
let abschluesse = [];
let aktuellerKunde = null;

/* =====================================================
   INDEXEDDB (Primärer Speicher)
===================================================== */

const DB_NAME = "crmDatenbank";
const DB_VERSION = 1;
const DB_STORE = "bestand";

function dbOeffnen(){
    return new Promise((resolve, reject) => {
        const anfrage = indexedDB.open(DB_NAME, DB_VERSION);
        anfrage.onupgradeneeded = function(event){
            const db = event.target.result;
            if(!db.objectStoreNames.contains(DB_STORE)){
                db.createObjectStore(DB_STORE);
            }
        };
        anfrage.onsuccess = e => resolve(e.target.result);
        anfrage.onerror = e => reject(e.target.error);
    });
}

async function dbSpeichern(){
    try{
        const db = await dbOeffnen();
        const tx = db.transaction(DB_STORE, "readwrite");
        const store = tx.objectStore(DB_STORE);
        store.put({
            kunden: kunden,
            aufgaben: aufgaben,
            abschluesse: abschluesse,
            gespeichertAm: new Date().toISOString()
        }, "bestand");
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
        });
    }catch(fehler){
        console.log("IndexedDB Speichern fehlgeschlagen:", fehler);
        // Fallback auf localStorage
        try{
            localStorage.setItem("crmBestand", JSON.stringify({
                kunden, aufgaben, abschluesse
            }));
        }catch(e){}
    }
}

async function dbLaden(){
    try{
        const db = await dbOeffnen();
        const tx = db.transaction(DB_STORE, "readonly");
        const store = tx.objectStore(DB_STORE);
        const anfrage = store.get("bestand");
        return new Promise((resolve, reject) => {
            anfrage.onsuccess = function(){
                const daten = anfrage.result;
                if(daten){
                    kunden = daten.kunden || [];
                    aufgaben = daten.aufgaben || [];
                    abschluesse = daten.abschluesse || [];
                    migriereVertraege();
                    resolve(true);
                }else{
                    resolve(false);
                }
            };
            anfrage.onerror = () => reject(anfrage.error);
        });
    }catch(fehler){
        console.log("IndexedDB Laden fehlgeschlagen, versuche localStorage:", fehler);
        return false;
    }
}

/* =====================================================
   LOKALSTORAGE FALLBACK
===================================================== */

function lokalLaden(){
    const daten = localStorage.getItem("crmBestand");
    if(!daten){ return false; }
    try{
        const bestand = JSON.parse(daten);
        kunden = bestand.kunden || [];
        aufgaben = bestand.aufgaben || [];
        abschluesse = bestand.abschluesse || [];
        migriereVertraege();
        return true;
    }catch(e){
        return false;
    }
}

/* =====================================================
   AUTO-SAVE (nach jeder Änderung)
===================================================== */

let autoSavePending = false;

function triggerAutoSave(){
    if(autoSavePending){ return; }
    autoSavePending = true;
    setTimeout(async () => {
        await dbSpeichern();
        speicherStatusAnzeigen();
        autoSavePending = false;
    }, 800);
}

function speicherStatusAnzeigen(){
    const el = document.getElementById("speicherStatus");
    if(!el){ return; }
    const jetzt = new Date().toLocaleTimeString("de-DE",
        { hour:"2-digit", minute:"2-digit" });
    el.textContent = "Gespeichert " + jetzt;
    el.style.color = "var(--c-success-text)";
}

/* =====================================================
   LEGACY-MIGRATION: Verträge von String → Objekt
===================================================== */

function migriereVertraege(){
    kunden.forEach(kunde => {
        if(!kunde.vertraege){ return; }
        kunde.vertraege = kunde.vertraege.map(v =>
            typeof v === "string" ? { nummer: v } : v
        );
    });
}

/* =====================================================
   TAB STEUERUNG
===================================================== */

function showTab(tabId){
    document.querySelectorAll(".tab-content")
    .forEach(tab => tab.classList.remove("tab-active"));
    document.getElementById(tabId).classList.add("tab-active");
    document.querySelectorAll(".nav-button")
    .forEach(button => button.classList.toggle(
        "nav-button-aktiv",
        button.dataset.tab === tabId
    ));

    // Bei jedem Tab-Wechsel: Ansicht aktualisieren + speichern
    kontaktListenAktualisieren();
    dashboardAktualisieren();
    triggerAutoSave();
}

/* =====================================================
   ID GENERATOR
===================================================== */

function neueId(){
    return Date.now() + Math.floor(Math.random() * 10000);
}

/* =====================================================
   DATUM FORMATIEREN
===================================================== */

function formatDatum(datum){
    if(!datum){ return "-"; }
    return new Date(datum).toLocaleDateString("de-DE");
}

function ermittleWochentag(datum){
    if(!datum){ return ""; }
    return new Date(datum).toLocaleDateString("de-DE", { weekday:"long" });
}

/* =====================================================
   TAGE SEIT DATUM
===================================================== */

function tageSeit(datum){
    if(!datum){ return 999999; }
    return Math.floor(
        (new Date() - new Date(datum)) / 86400000
    );
}

/* =====================================================
   KUNDEN FINDEN
===================================================== */

function findeKunde(id){
    return kunden.find(k => k.id === id);
}

function findeKundePerPartyId(partyId){
    return kunden.find(k => k.partyIds && k.partyIds.includes(partyId));
}

function findeKundePerPerson(vorname, nachname, strasse, hausnummer, plz){
    return kunden.find(k =>
        k.vorname.trim().toLowerCase() === String(vorname).trim().toLowerCase() &&
        k.nachname.trim().toLowerCase() === String(nachname).trim().toLowerCase() &&
        k.strasse.trim().toLowerCase() === String(strasse).trim().toLowerCase() &&
        k.hausnummer.trim().toLowerCase() === String(hausnummer).trim().toLowerCase() &&
        k.plz.trim() === String(plz).trim()
    );
}
