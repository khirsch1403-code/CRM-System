/* =====================================================
   BENACHRICHTIGUNGEN — tägliche Aufgaben-Zusammenfassung
===================================================== */

const BENACHRICHTIGUNG_LS_KEY = "crmBenachrichtigungLetzterTag";
const BENACHRICHTIGUNG_ERLAUBT_KEY = "crmBenachrichtigungAngefragt";

/* =====================================================
   BROWSER UNTERSTÜTZUNG
===================================================== */

function benachrichtigungUnterstuetzt(){
    return "Notification" in window;
}

/* =====================================================
   AUFGABEN FÜR ZUSAMMENFASSUNG SAMMELN
===================================================== */

function sammleFaelligeAufgaben(){

    if(typeof aufgaben === "undefined"){ return null; }

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const in3Tagen = new Date(heute);
    in3Tagen.setDate(in3Tagen.getDate() + 3);

    let ueberfaellig = 0;
    let heuteFaellig = 0;
    let naechste3Tage = 0;

    aufgaben.forEach(a => {

        if(a.status === "Erledigt"){ return; }
        if(!a.faelligkeit){ return; }

        const faellig = new Date(a.faelligkeit);
        faellig.setHours(0, 0, 0, 0);

        if(faellig < heute){
            ueberfaellig++;
        }else if(faellig.getTime() === heute.getTime()){
            heuteFaellig++;
        }else if(faellig <= in3Tagen){
            naechste3Tage++;
        }

    });

    const gesamt = ueberfaellig + heuteFaellig + naechste3Tage;

    return { ueberfaellig, heuteFaellig, naechste3Tage, gesamt };
}

/* =====================================================
   TEXT ZUSAMMENSTELLEN
===================================================== */

function benachrichtigungText(zahlen){

    const teile = [];

    if(zahlen.ueberfaellig > 0){
        teile.push(
            zahlen.ueberfaellig +
            (zahlen.ueberfaellig === 1
                ? " überfällige Aufgabe"
                : " überfällige Aufgaben")
        );
    }

    if(zahlen.heuteFaellig > 0){
        teile.push(
            zahlen.heuteFaellig +
            (zahlen.heuteFaellig === 1
                ? " heute fällig"
                : " heute fällig")
        );
    }

    if(zahlen.naechste3Tage > 0){
        teile.push(
            zahlen.naechste3Tage +
            " in den nächsten 3 Tagen"
        );
    }

    return teile.join(" · ");
}

/* =====================================================
   ANFRAGE UM ERLAUBNIS
===================================================== */

function benachrichtigungErlaubnisAnfragen(){

    if(!benachrichtigungUnterstuetzt()){ return; }

    // Nur einmal fragen pro Browser
    if(localStorage.getItem(BENACHRICHTIGUNG_ERLAUBT_KEY)){ return; }

    if(Notification.permission === "default"){

        // Dezenter Banner statt sofortiger Systemdialog
        benachrichtigungBannerZeigen();

    }else{

        localStorage.setItem(BENACHRICHTIGUNG_ERLAUBT_KEY, "1");

    }
}

function benachrichtigungBannerZeigen(){

    // Nur ein Banner gleichzeitig
    if(document.getElementById("benachrichtigungBanner")){ return; }

    const banner = document.createElement("div");
    banner.id = "benachrichtigungBanner";
    banner.className = "benachrichtigung-banner";

    banner.innerHTML = `
        <span>
            📬 Möchtest du morgens eine Übersicht der fälligen Aufgaben
            als Benachrichtigung erhalten?
        </span>
        <div>
            <button class="crm-button crm-button-klein"
                onclick="benachrichtigungAblehnen()">
                Nein danke
            </button>
            <button class="crm-button crm-button-klein crm-button-primary"
                onclick="benachrichtigungAktivieren()">
                Ja, aktivieren
            </button>
        </div>
    `;

    document.body.appendChild(banner);

}

function benachrichtigungAktivieren(){

    localStorage.setItem(BENACHRICHTIGUNG_ERLAUBT_KEY, "1");

    Notification.requestPermission().then(erg => {
        benachrichtigungBannerEntfernen();
        if(erg === "granted"){
            // Direkt beim Aktivieren einmal senden falls sinnvoll
            benachrichtigungPruefen(true);
        }
    });
}

function benachrichtigungAblehnen(){
    localStorage.setItem(BENACHRICHTIGUNG_ERLAUBT_KEY, "1");
    benachrichtigungBannerEntfernen();
}

function benachrichtigungBannerEntfernen(){
    const b = document.getElementById("benachrichtigungBanner");
    if(b){ b.remove(); }
}

/* =====================================================
   TÄGLICHE PRÜFUNG (max. 1× pro Tag)
===================================================== */

function benachrichtigungPruefen(erzwingen){

    if(!benachrichtigungUnterstuetzt()){ return; }
    if(Notification.permission !== "granted"){ return; }

    const heuteKey = new Date().toISOString().split("T")[0];

    if(!erzwingen){
        const letzterTag =
        localStorage.getItem(BENACHRICHTIGUNG_LS_KEY);
        if(letzterTag === heuteKey){ return; }
    }

    const zahlen = sammleFaelligeAufgaben();
    if(!zahlen || zahlen.gesamt === 0){
        // Trotzdem als "heute geprüft" markieren
        localStorage.setItem(BENACHRICHTIGUNG_LS_KEY, heuteKey);
        return;
    }

    const text = benachrichtigungText(zahlen);

    try{
        const n = new Notification("CRM Vertrieb — Aufgaben", {
            body: text,
            icon: "app-icon/icon-192.png",
            badge: "app-icon/icon-192.png",
            tag: "crm-tagesuebersicht",
            requireInteraction: false
        });

        n.onclick = function(){
            window.focus();
            if(typeof showTab === "function"){
                showTab("aufgaben");
            }
            n.close();
        };

    }catch(e){
        fehlerMelden("Benachrichtigung",
            "Systembenachrichtigung konnte nicht angezeigt werden.", e);
    }

    localStorage.setItem(BENACHRICHTIGUNG_LS_KEY, heuteKey);
}

/* =====================================================
   INITIALISIERUNG
===================================================== */

window.addEventListener("load", function(){

    // Zeitversetzt starten damit Daten geladen sind
    setTimeout(() => {

        if(Notification.permission === "granted"){

            // Wenn schon erlaubt: still prüfen
            benachrichtigungPruefen(false);

        }else if(Notification.permission === "default"){

            // Noch nicht gefragt: Banner (nur einmal)
            benachrichtigungErlaubnisAnfragen();

        }

    }, 3000);

    // Bei Datumswechsel während App offen bleibt (falls
    // App über Mitternacht läuft) alle 30 Min prüfen
    setInterval(() => {
        benachrichtigungPruefen(false);
    }, 30 * 60 * 1000);

});
