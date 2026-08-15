
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
        fehlerMelden("Datenspeicherung",
            "Speichern in IndexedDB fehlgeschlagen — Fallback auf localStorage.",
            fehler);
        try{
            localStorage.setItem("crmBestand", JSON.stringify({
                kunden, aufgaben, abschluesse
            }));
        }catch(e){
            fehlerMelden("Datenspeicherung",
                "Auch localStorage-Fallback fehlgeschlagen — Aenderungen NICHT gesichert!",
                e);
        }
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
        fehlerMelden("Datenspeicherung",
            "Laden aus IndexedDB fehlgeschlagen — versuche localStorage.",
            fehler);
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
    }, 200);
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
    bereinigeAlleKontaktdaten();
}

/* =====================================================
   KONTAKTDATEN-NORMALISIERUNG
   -----------------------------------------------------
   Behebt zwei wiederkehrende Excel-Sync-Probleme:
     1. Fuehrender Apostroph (Excel-Text-Marker) — z. B.  '0176...
     2. Uneinheitliches deutsches Rufnummern-Format
        (0176 vs. +49176 vs. 0049176)
   Emails werden getrimmt und lowercased.
   Deduplizierung erfolgt auf normalisierter Basis.
===================================================== */

function _stripApostroph(s){
    s = String(s == null ? "" : s).trim();
    // eckige oder typografische Apostrophe am Anfang mit abfangen
    while(s.length && (s[0] === "'" || s[0] === "’" || s[0] === "‘" || s[0] === "´")){
        s = s.substring(1).trim();
    }
    return s;
}

function normalisiereTelefon(input){
    let s = _stripApostroph(input);
    if(!s){ return ""; }
    // Nur Ziffern und + behalten (Leerzeichen, /, -, (), … fallen raus)
    let z = s.replace(/[^\d+]/g, "");
    if(!z){ return ""; }
    // Deutsches Vorwahl-Prefix vereinheitlichen: +49… und 0049… → 0…
    if(z.indexOf("+49") === 0){
        z = "0" + z.substring(3);
    }else if(z.indexOf("0049") === 0){
        z = "0" + z.substring(4);
    }
    // Zwei fuehrende Nullen bei nationalen Nummern zusammenziehen
    while(z.length > 2 && z.substring(0,2) === "00" && z[2] !== "0"){
        // Nicht anfassen — 00 signalisiert internationale Waehlvorwahl
        break;
    }
    return z;
}

function telefonSchluessel(input){
    // Reine Ziffern als Vergleichsschluessel fuer Duplikat-Erkennung
    return normalisiereTelefon(input).replace(/\D/g, "");
}

function normalisiereEmail(input){
    const s = _stripApostroph(input);
    if(!s){ return ""; }
    return s.toLowerCase();
}

/* =====================================================
   BEREINIGUNG EINES KUNDEN
   Gibt true zurueck, wenn sich etwas geaendert hat.
===================================================== */

function bereinigeKontaktdatenEinesKunden(kunde){
    if(!kunde){ return false; }
    let veraendert = false;

    if(Array.isArray(kunde.telefone)){
        const gesehen = new Set();
        const neu = [];
        for(const t of kunde.telefone){
            const norm = normalisiereTelefon(t);
            if(!norm){ veraendert = true; continue; }
            const key = telefonSchluessel(t);
            if(gesehen.has(key)){ veraendert = true; continue; }
            gesehen.add(key);
            neu.push(norm);
            if(norm !== t){ veraendert = true; }
        }
        if(neu.length !== kunde.telefone.length){ veraendert = true; }
        kunde.telefone = neu;
    }

    if(Array.isArray(kunde.emails)){
        const gesehen = new Set();
        const neu = [];
        for(const e of kunde.emails){
            const norm = normalisiereEmail(e);
            if(!norm){ veraendert = true; continue; }
            if(gesehen.has(norm)){ veraendert = true; continue; }
            gesehen.add(norm);
            neu.push(norm);
            if(norm !== e){ veraendert = true; }
        }
        if(neu.length !== kunde.emails.length){ veraendert = true; }
        kunde.emails = neu;
    }

    return veraendert;
}

function bereinigeAlleKontaktdaten(){
    if(!Array.isArray(kunden)){ return 0; }
    let anzahl = 0;
    kunden.forEach(k => {
        if(bereinigeKontaktdatenEinesKunden(k)){ anzahl++; }
    });
    if(anzahl > 0){
        console.log("Kontaktdaten bereinigt: " + anzahl + " Kunde(n) angepasst.");
        // Nach Migration einmal persistieren
        if(typeof triggerAutoSave === "function"){ triggerAutoSave(); }
    }
    return anzahl;
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
   HTML ESCAPE
   -----------------------------------------------------
   Wird an jeder Stelle verwendet, wo Kunden-, Vertrags-,
   Aufgaben- oder Notiz-Text via innerHTML/template-string
   interpoliert wird. Verhindert Anzeigefehler bei Namen
   wie "Anna-Lisa D'Angelo" oder "Meyer & Soehne <GbR>"
   und schuetzt gleichzeitig vor unbeabsichtigtem HTML.
===================================================== */

function escapeHtml(wert){
    if(wert == null){ return ""; }
    return String(wert)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Kurz-Alias fuer weniger visuelles Rauschen in Templates
const esc = escapeHtml;

/* =====================================================
   FEHLER-LOG + STATUS-INDIKATOR
   -----------------------------------------------------
   Sammelt Fehler aus catch-Bloecken zentral, persistiert
   sie in localStorage und schaltet das Statussymbol im
   Header um. Bei Fehler: rotes Ausrufezeichen (pulst).
   Sonst: blasser gruener Haken. Klick oeffnet Modal.
===================================================== */

const FEHLER_LS_KEY = "crmFehlerLog";
const FEHLER_MAX    = 50;

let crmFehlerLog = [];

try{
    const gespeichert = localStorage.getItem(FEHLER_LS_KEY);
    if(gespeichert){ crmFehlerLog = JSON.parse(gespeichert); }
}catch(_){ crmFehlerLog = []; }

function fehlerMelden(kategorie, text, details){
    const eintrag = {
        zeit: new Date().toISOString(),
        kategorie: String(kategorie || "Allgemein"),
        text: String(text || ""),
        details: details == null ? "" :
                 (typeof details === "string" ? details :
                  (details && details.message ? details.message :
                   (function(){ try{ return JSON.stringify(details); }
                                catch(_){ return String(details); }})()))
    };
    crmFehlerLog.push(eintrag);
    if(crmFehlerLog.length > FEHLER_MAX){
        crmFehlerLog = crmFehlerLog.slice(-FEHLER_MAX);
    }
    try{ localStorage.setItem(FEHLER_LS_KEY, JSON.stringify(crmFehlerLog)); }catch(_){}
    if(typeof console !== "undefined" && console.warn){
        console.warn("[CRM]", kategorie, text, details);
    }
    aktualisiereFehlerSymbol();
}

function fehlerLogLeeren(){
    crmFehlerLog = [];
    try{ localStorage.removeItem(FEHLER_LS_KEY); }catch(_){}
    aktualisiereFehlerSymbol();
}

function aktualisiereFehlerSymbol(){
    const sym = document.getElementById("crmStatusSymbol");
    if(!sym){ return; }
    if(crmFehlerLog.length === 0){
        sym.className = "crm-status-symbol crm-status-ok";
        sym.textContent = "✓";
        sym.title = "Alles in Ordnung — keine Fehler protokolliert";
    }else{
        sym.className = "crm-status-symbol crm-status-fehler";
        sym.textContent = "!";
        sym.title = crmFehlerLog.length +
            (crmFehlerLog.length === 1 ? " Fehler protokolliert — klicken fuer Details"
                                       : " Fehler protokolliert — klicken fuer Details");
    }
}

function fehlerModalOeffnen(){
    const modal = document.getElementById("crmFehlerModal");
    const body  = document.getElementById("crmFehlerModalInhalt");
    if(!modal || !body){ return; }

    if(crmFehlerLog.length === 0){
        body.innerHTML = `<div class="eintrag-leer">
            Aktuell sind keine Fehler protokolliert.
        </div>`;
    }else{
        body.innerHTML = `
            <p class="fehler-modal-hinweis">
                ${crmFehlerLog.length} Fehler protokolliert.
                Kopiere den Text unten und schicke ihn zum Fixen.
            </p>
            <textarea id="crmFehlerText" class="crm-textarea fehler-modal-text"
                readonly>${esc(fehlerLogAlsText())}</textarea>
            <div class="fehler-modal-liste">
                ${crmFehlerLog.slice().reverse().map(e => `
                    <div class="fehler-eintrag">
                        <div class="fehler-eintrag-kopf">
                            <strong>${esc(e.kategorie)}</strong>
                            <span class="fehler-eintrag-zeit">
                                ${esc(new Date(e.zeit).toLocaleString("de-DE"))}
                            </span>
                        </div>
                        <div class="fehler-eintrag-text">${esc(e.text)}</div>
                        ${e.details
                            ? `<div class="fehler-eintrag-details">${esc(e.details)}</div>`
                            : ""}
                    </div>
                `).join("")}
            </div>
        `;
    }
    modal.style.display = "flex";
}

function fehlerModalSchliessen(){
    const modal = document.getElementById("crmFehlerModal");
    if(modal){ modal.style.display = "none"; }
}

function fehlerLogAlsText(){
    const kopf = "CRM Fehler-Log (" + new Date().toLocaleString("de-DE") + ")\n"
               + "===========================================\n\n";
    return kopf + crmFehlerLog.slice().reverse().map(e => {
        return "[" + new Date(e.zeit).toLocaleString("de-DE") + "] "
             + e.kategorie + "\n"
             + "  " + e.text
             + (e.details ? "\n  Details: " + e.details : "")
             + "\n";
    }).join("\n");
}

function fehlerLogKopieren(){
    const ta = document.getElementById("crmFehlerText");
    if(!ta){ return; }
    ta.select();
    try{
        navigator.clipboard.writeText(ta.value)
            .then(() => alert("Fehler-Log in die Zwischenablage kopiert."))
            .catch(() => document.execCommand("copy"));
    }catch(_){
        try{ document.execCommand("copy"); }catch(_){}
    }
}

// Globale Errorhandler — faengt ungefangene Exceptions ein
window.addEventListener("error", function(e){
    fehlerMelden("Unerwarteter Fehler",
        e.message || "Unbekannt",
        (e.filename ? e.filename + ":" + e.lineno : ""));
});
window.addEventListener("unhandledrejection", function(e){
    fehlerMelden("Promise-Fehler",
        (e.reason && e.reason.message) || String(e.reason || ""),
        "");
});

// Beim Laden Symbol initialisieren
window.addEventListener("load", function(){
    aktualisiereFehlerSymbol();
});

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
    const vN = normalisierePersonNameStreng(vorname);
    const nN = normalisierePersonNameStreng(nachname);
    const sN = normalisiereStrasseKey(strasse);
    const hN = String(hausnummer||"").trim().toLowerCase().replace(/\s+/g, "");
    const pN = String(plz||"").trim();
    return kunden.find(k =>
        normalisierePersonNameStreng(k.vorname) === vN &&
        normalisierePersonNameStreng(k.nachname) === nN &&
        normalisiereStrasseKey(k.strasse) === sN &&
        String(k.hausnummer||"").trim().toLowerCase().replace(/\s+/g, "") === hN &&
        String(k.plz||"").trim() === pN
    );
}

/* =====================================================
   NAMEN- / ADRESSEN-NORMALISIERUNG
   -----------------------------------------------------
   Strenge Formen (fuer Import-Match — automatisch):
     - Umlaute falten
     - Interpunktion weg
     - "Str." / "Str" / "Strasse" / "Strasze" → einheitlich "strasse"

   Tolerante Zusatzformen (fuer den Duplikat-Pruefer,
   der immer mit Merge-Dialog laeuft):
     - Vorname: Doppelname wird in Tokens zerlegt; ein Kunde mit
       "Anna" matched einen mit "Anna-Lisa" oder "Anna Maria",
       solange der erste Vorname-Token uebereinstimmt.
     - Nachname: Bindestrich/Leerzeichen als Splitter — die
       Token-Menge muss identisch sein (Reihenfolge egal).
       "Meyer-Schmidt" ↔ "Meyer Schmidt" ↔ "Meyerschmidt" (letzteres
       matcht ueber zusaetzliche Zusammen-Vergleich-Regel).
     - Geburtsdatum: exakt (nach Normalisierung auf ISO oder deutsch)
===================================================== */

function _faltUmlaute(s){
    return String(s || "")
        .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue")
        .replace(/Ä/g,"AE").replace(/Ö/g,"OE").replace(/Ü/g,"UE")
        .replace(/ß/g,"ss");
}

function normalisierePersonNameStreng(s){
    return _faltUmlaute(String(s || ""))
        .toLowerCase()
        .replace(/[.,;:'`´‘’]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalisiereStrasseKey(s){
    let t = _faltUmlaute(String(s || "")).toLowerCase();
    t = t.replace(/[.,;:'`´‘’]/g, "");
    // "Str" / "Str." / "strasse" / "-strasse" → einheitliches Token
    t = t.replace(/\bstr\b/g, "strasse");
    t = t.replace(/-\s*strasse\b/g, " strasse");
    t = t.replace(/\s+/g, " ").trim();
    return t;
}

function normalisiereOrtKey(s){
    return _faltUmlaute(String(s || ""))
        .toLowerCase()
        .replace(/[.,;:'`´‘’]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalisiereGeburtsdatumISO(s){
    if(!s){ return ""; }
    const t = String(s).trim();
    // "TT.MM.JJJJ"
    const dM = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if(dM){
        return dM[3] + "-" +
               String(dM[2]).padStart(2,"0") + "-" +
               String(dM[1]).padStart(2,"0");
    }
    // ISO
    const iM = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(iM){
        return iM[1] + "-" +
               String(iM[2]).padStart(2,"0") + "-" +
               String(iM[3]).padStart(2,"0");
    }
    return t.toLowerCase();
}

/* --- Tolerante Vornamens- und Nachnamens-Vergleiche --- */

function _tokenizeName(s){
    return normalisierePersonNameStreng(s)
        .split(/[\s\-]+/)
        .filter(Boolean);
}

function vornamenTolerantMatch(a, b){
    const ta = _tokenizeName(a);
    const tb = _tokenizeName(b);
    if(ta.length === 0 || tb.length === 0){ return false; }
    // Erster Vorname-Token muss uebereinstimmen ODER einer ist Prefix
    // des anderen (deckt "Anna" ↔ "Anna-Lisa" und "Anna Maria" ab).
    return ta[0] === tb[0];
}

function nachnamenTolerantMatch(a, b){
    const na = normalisierePersonNameStreng(a);
    const nb = normalisierePersonNameStreng(b);
    if(!na || !nb){ return false; }
    if(na === nb){ return true; }
    // Bindestrich/Leerzeichen als Splitter — Token-Set-Vergleich
    const setA = _tokenizeName(a).sort().join("|");
    const setB = _tokenizeName(b).sort().join("|");
    if(setA && setA === setB){ return true; }
    // Konkatenierte Form: "meyerschmidt" ↔ "meyer schmidt" ↔ "meyer-schmidt"
    const flatA = na.replace(/[\s\-]/g, "");
    const flatB = nb.replace(/[\s\-]/g, "");
    return flatA === flatB;
}

function istPersonenDuplikat(a, b){
    if(!a || !b || a.id === b.id){ return false; }
    // Geburtsdatum muss existieren und exakt matchen
    const gA = normalisiereGeburtsdatumISO(a.geburtsdatum);
    const gB = normalisiereGeburtsdatumISO(b.geburtsdatum);
    if(!gA || !gB || gA !== gB){ return false; }
    if(!nachnamenTolerantMatch(a.nachname, b.nachname)){ return false; }
    if(!vornamenTolerantMatch(a.vorname, b.vorname)){ return false; }
    return true;
}
