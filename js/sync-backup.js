/* =====================================================
   LETZTER SYNC ANZEIGE
===================================================== */

function letzterSyncAnzeigeAktualisieren(){
    const el = document.getElementById("letzterSyncAnzeige");
    if(!el){ return; }
    const gespeichert = localStorage.getItem("letzterSync");
    if(!gespeichert){
        el.textContent = "Noch kein Sync";
        return;
    }
    const datum = new Date(gespeichert);
    const heute = new Date();
    const tageAlt = Math.floor((heute - datum) / 86400000);
    const uhrzeit = datum.toLocaleTimeString("de-DE",
        { hour:"2-digit", minute:"2-digit" });
    const datumStr = datum.toLocaleDateString("de-DE");
    if(tageAlt === 0){
        el.textContent = "Sync heute " + uhrzeit;
    }else if(tageAlt === 1){
        el.textContent = "Sync gestern " + uhrzeit;
    }else{
        el.textContent = "Sync " + datumStr;
    }
}

/* =====================================================
   BESTAND SYNCHRONISIEREN
===================================================== */

function bestandSynchronisieren(){

    document
    .getElementById(
        "syncDatei"
    )
    .click();

}

/* =====================================================
   DATEN EXPORTIEREN
===================================================== */

function datenExportieren(dateiname){

    const daten = {

        kunden: kunden,

        aufgaben: aufgaben,

        abschluesse: abschluesse,

        exportDatum:
        new Date()
        .toISOString()

    };

    const json =

    JSON.stringify(
        daten,
        null,
        2
    );

    const blob =

    new Blob(

        [json],

        {
            type:
            "application/json"
        }

    );

    const url =

    URL.createObjectURL(
        blob
    );

    const link =

    document
    .createElement(
        "a"
    );

    link.href =
    url;

    link.download =
    dateiname;

    document
    .body
    .appendChild(
        link
    );

    link.click();

    document
    .body
    .removeChild(
        link
    );

    URL.revokeObjectURL(
        url
    );

}

function backupErstellen(){

    const jetzt =
    new Date();

    const datum =

        jetzt.getFullYear()

        + "-"

        +

        String(
            jetzt.getMonth()+1
        )
        .padStart(2,"0")

        + "-"

        +

        String(
            jetzt.getDate()
        )
        .padStart(2,"0");

    const zeit =

        String(
            jetzt.getHours()
        )
        .padStart(2,"0")

        +

        String(
            jetzt.getMinutes()
        )
        .padStart(2,"0");

    const dateiname =

        "backup_"

        +

        datum

        +

        "_"

        +

        zeit

        +

        ".json";

    datenExportieren(
        dateiname
    );

}

/* =====================================================
   DATEN LADEN
===================================================== */

function datenLaden(datei){

    if(!datei){

        return;

    }

    const reader =
    new FileReader();

    reader.onload =
    function(event){

        try{

            const daten =

            JSON.parse(

                event
                .target
                .result

            );

            kunden =

            daten.kunden
            || [];

            aufgaben =

            daten.aufgaben
            || [];

            abschluesse =

            daten.abschluesse
            || [];

            aktuellerKunde =
            null;

            renderKunden();

            renderAufgaben();

            renderAbschluesse();

            dashboardAktualisieren();

            kontaktListenAktualisieren();

            document
            .getElementById(
                "kundenDetails"
            )
            .innerHTML =

            "<h2>Daten erfolgreich geladen</h2>";

            alert(
                "Daten erfolgreich geladen"
            );

        }
        catch(fehler){

            alert(
                "Datei konnte nicht geladen werden"
            );

        }

    };

    reader.readAsText(
        datei
    );

}

/* =====================================================
   DATEI FELD
===================================================== */

document
.getElementById(
    "ladenDatei"
)
.addEventListener(

    "change",

    function(event){

        const datei =

        event.target
        .files[0];

        datenLaden(
            datei
        );

    }

);

/* =====================================================
   SYNC DATEI FELD
===================================================== */

document
.getElementById("syncDatei")
.addEventListener("change", function(event){

    const datei = event.target.files[0];

    if(!datei){
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e){

        const daten =
        new Uint8Array(
            e.target.result
        );

        const workbook =
        XLSX.read(
            daten,
            {
                type:"array",
                bookVBA:true,
                cellDates:true,
                cellNF:false,
                cellText:false
            }
        );

        const worksheet =
        workbook.Sheets[
            workbook.SheetNames[0]
        ];

        // FIX: Manche xlsm-Dateien deklarieren einen zu
        // kleinen Datenbereich (z.B. "A1:GS2"), wodurch
        // SheetJS nur 1-2 Zeilen liest. Wir ermitteln den
        // echten Bereich anhand aller vorhandenen Zellen
        // und überschreiben !ref.
        (function korrigiereBereich(){
            let maxZeile = 0;
            let maxSpalte = 0;

            Object.keys(worksheet).forEach(zellRef => {

                if(zellRef[0] === "!"){ return; }

                const match =
                zellRef.match(/^([A-Z]+)(\d+)$/);

                if(!match){ return; }

                const spaltenBuchstaben = match[1];
                const zeilenNr = parseInt(match[2], 10);

                // Buchstaben -> Zahl (A=1, Z=26, AA=27, ...)
                let spaltenNr = 0;
                for(let i = 0; i < spaltenBuchstaben.length; i++){
                    spaltenNr =
                        spaltenNr * 26 +
                        (spaltenBuchstaben.charCodeAt(i) - 64);
                }

                if(zeilenNr > maxZeile){ maxZeile = zeilenNr; }
                if(spaltenNr > maxSpalte){ maxSpalte = spaltenNr; }

            });

            if(maxZeile === 0){ return; }

            // Zahl -> Buchstaben zurück
            let letzterBuchstabe = "";
            let n = maxSpalte;
            while(n > 0){
                const rest = (n - 1) % 26;
                letzterBuchstabe =
                    String.fromCharCode(65 + rest) +
                    letzterBuchstabe;
                n = Math.floor((n - 1) / 26);
            }

            worksheet["!ref"] =
                "A1:" + letzterBuchstabe + maxZeile;

        })();

        const zeilen =
        XLSX.utils.sheet_to_json(
            worksheet,
            {
                defval:"",
                raw:false,
                dateNF:"dd.mm.yyyy"
            }
        );

        let neu = 0;
        let aktualisiert = 0;
        let vertraegeEntfernt = 0;

        const importiertePartyIds =
        new Set();

        // Pro Kunde die in dieser Excel gemeldeten Vertragsnummern
        // sammeln — Grundlage fuer den Reconciler weiter unten.
        // Ein Kunde ohne Vertragszeile landet mit leerem Set drin,
        // damit auch "alle Vertraege des Kunden weggefallen" erkannt wird.
        const importierteVertragsnummernProKunde = new Map();

        zeilen.forEach(zeile => {

            const partyId =
            String(
                zeile["PARTY_ID"] || ""
            ).trim();

            if(!partyId){
                return;
            }

            importiertePartyIds.add(
                partyId
            );

let kunde =
findeKundePerPartyId(
    partyId
);

if(!kunde){

    kunde =
    findeKundePerPerson(

        zeile["Vorname"],
        zeile["Nachname"],
        zeile["Straße"],
        zeile["Hausnummer"],
        zeile["PLZ"]

    );

}

            if(!kunde){

                kunde = {

                    id: neueId(),

 partyIds:[partyId],

                    letzterImport:
                    new Date()
                    .toLocaleDateString(
                        "de-DE"
                    ),

                    vorname:
                    String(
                        zeile["Vorname"] || ""
                    ).trim(),

                    nachname:
                    String(
                        zeile["Nachname"] || ""
                    ).trim(),

                    geburtsdatum:
                    String(
                        zeile["Geburtsdatum"] || ""
                    ).trim(),

                    plz:
                    String(
                        zeile["PLZ"] || ""
                    ).trim(),

                    ort:
                    String(
                        zeile["Ort"] || ""
                    ).trim(),

                    strasse:
                    String(
                        zeile["Straße"] || ""
                    ).trim(),

                    hausnummer:
                    String(
                        zeile["Hausnummer"] || ""
                    ).trim(),

                    telefone:[],

                    emails:[],

                    vertraege:[],

                    termine:[],

                    notiz:"",

                    archiviert:false,

                    kennzeichen:{
                        keineBeratung:false,
                        nurBuero:false,
                        nurTelefon:false,
                        nurMail:false,
                        bestandVerlassen:false
                    }

                };

                kunden.push(
                    kunde
                );

                neu++;

            }else{

                aktualisiert++;

            }

if(!kunde.partyIds){

    kunde.partyIds = [];

}

if(

    !kunde.partyIds.includes(
        partyId
    )

){

    if(

        kunde.partyIds.length < 2

    ){

        kunde.partyIds.push(
            partyId
        );

    }

}

            kunde.vorname =
            String(
                zeile["Vorname"] ||
                kunde.vorname
            ).trim();

            kunde.nachname =
            String(
                zeile["Nachname"] ||
                kunde.nachname
            ).trim();

            kunde.geburtsdatum =
            String(
                zeile["Geburtsdatum"] ||
                kunde.geburtsdatum || ""
            ).trim();

            kunde.plz =
            String(
                zeile["PLZ"] ||
                kunde.plz
            ).trim();

            kunde.ort =
            String(
                zeile["Ort"] ||
                kunde.ort
            ).trim();

            kunde.strasse =
            String(
                zeile["Straße"] ||
                kunde.strasse
            ).trim();

            kunde.hausnummer =
            String(
                zeile["Hausnummer"] ||
                kunde.hausnummer
            ).trim();

            const telefon = normalisiereTelefon(zeile["Telefon bevorzugt"]);
            if(telefon){
                const key = telefonSchluessel(telefon);
                const schonDa = kunde.telefone.some(t =>
                    telefonSchluessel(t) === key
                );
                if(!schonDa){
                    kunde.telefone.push(telefon);
                }
            }

            const email = normalisiereEmail(zeile["E-Mail bevorzugt"]);
            if(email){
                const schonDa = kunde.emails.some(e =>
                    normalisiereEmail(e) === email
                );
                if(!schonDa){
                    kunde.emails.push(email);
                }
            }

            // Vorhandene Eintraege dieses Kunden gleich mitbereinigen
            // (streicht Excel-Apostrophe und dedupliziert Alt-Bestand)
            bereinigeKontaktdatenEinesKunden(kunde);

            // Diesen Kunden fuer den Reconciler registrieren —
            // auch wenn diese Zeile keine Vertragsnummer traegt.
            if(!importierteVertragsnummernProKunde.has(kunde.id)){
                importierteVertragsnummernProKunde.set(kunde.id, new Set());
            }

            // Vertrag als Objekt mit allen Feldern zusammenbauen
            // (fuehrenden Excel-Apostroph mit abfangen, damit
            // '12345 und 12345 nicht als verschiedene Vertraege
            // gelten — sonst wuerde der Reconciler falsch loeschen)
            let vertragNr =
            String(zeile["Vertragsnummer"] || "").trim();
            if(vertragNr.startsWith("'")){
                vertragNr = vertragNr.substring(1).trim();
            }

            if(vertragNr){
                importierteVertragsnummernProKunde
                    .get(kunde.id).add(vertragNr);
            }

            if(vertragNr){

                // Legacy: alte String-Verträge in Objekte migrieren
                kunde.vertraege = (kunde.vertraege || []).map(v =>
                    typeof v === "string"
                    ? { nummer: v }
                    : v
                );

                const neuerVertrag = {
                    nummer: vertragNr,
                    produkt:
                    String(zeile["Produktbezeichnung"] || "").trim(),
                    bausparsumme:
                    String(zeile["Bausparsumme"] || "").trim(),
                    saldo:
                    String(zeile["Saldo (BS)"] || zeile["Saldo"] || "").trim(),
                    guthabenProzent:
                    String(zeile["Guthaben in %"] || "").trim(),
                    zuteilungsdatum:
                    String(zeile["Zuteilungsdatum"] || "").trim()
                };

                // Vorhandenen Vertrag mit gleicher Nummer aktualisieren,
                // sonst neu anlegen
                const idx = kunde.vertraege.findIndex(
                    v => v.nummer === vertragNr
                );

                if(idx >= 0){
                    // Zusammenführen — leere Felder aus Import
                    // überschreiben Bestandsfelder nicht
                    Object.keys(neuerVertrag).forEach(k => {
                        if(neuerVertrag[k]){
                            kunde.vertraege[idx][k] = neuerVertrag[k];
                        }
                    });
                }else{
                    kunde.vertraege.push(neuerVertrag);
                }

            }

            kunde.letzterImport =
            new Date()
            .toLocaleDateString(
                "de-DE"
            );

        });

        kunden.forEach(kunde => {

            if(!kunde.partyIds || kunde.partyIds.length === 0){
                return;
            }

            const nochImBestand =
            kunde.partyIds.some(
                id => importiertePartyIds.has(id)
            );

            kunde.kennzeichen.bestandVerlassen =
            !nochImBestand;

        });

        // =============================================
        // VERTRAGS-RECONCILER — Excel ist Wahrheit
        // ---------------------------------------------
        // Fuer jeden Kunden, der in dieser Excel enthalten
        // war: alle Vertraege loeschen, deren Nummer in
        // dieser Session nicht importiert wurde. Kunden,
        // die NICHT in der Excel waren (bestandVerlassen),
        // bleiben unberuehrt, damit deren Historie erhalten
        // bleibt.
        // =============================================
        kunden.forEach(kunde => {
            if(!importierteVertragsnummernProKunde.has(kunde.id)){
                return; // Kunde war nicht in dieser Excel
            }
            if(!Array.isArray(kunde.vertraege) || kunde.vertraege.length === 0){
                return;
            }
            const gemeldete = importierteVertragsnummernProKunde.get(kunde.id);
            const vorher = kunde.vertraege.length;
            kunde.vertraege = kunde.vertraege.filter(v => {
                const vObj = typeof v === "string" ? { nummer: v } : v;
                return vObj && vObj.nummer && gemeldete.has(vObj.nummer);
            });
            vertraegeEntfernt += (vorher - kunde.vertraege.length);
        });

        renderKunden();
        dashboardAktualisieren();
        kontaktListenAktualisieren();
        triggerAutoSave();

        // Sync-Zeitstempel speichern und anzeigen
        const syncZeit = new Date().toISOString();
        localStorage.setItem("letzterSync", syncZeit);
        letzterSyncAnzeigeAktualisieren();

        alert(

            "Synchronisation abgeschlossen\n\n" +

            "Neu angelegt: " +
            neu +

            "\nAktualisiert: " +
            aktualisiert +

            "\nGesamt: " +
            (neu + aktualisiert) +

            "\n\nVerträge entfernt " +
            "(nicht mehr im Bestand): " +
            vertraegeEntfernt

        );

        // Nach dem Sync: Ordner für neue Kunden anlegen
        if(typeof stelleAlleOrdnerSicher === "function"){
            stelleAlleOrdnerSicher();
        }

        // Nach dem Sync: Dopplungen prüfen und ggf. Merge-Dialoge zeigen
        if(typeof dopplungenPruefenUndBehandeln === "function"){
            setTimeout(dopplungenPruefenUndBehandeln, 300);
        }

    };

    reader.readAsArrayBuffer(
        datei
    );

});

/* =====================================================
   BACKUP BUTTON
===================================================== */

document
.getElementById(
    "backupButton"
)
.addEventListener(

    "click",

    backupErstellen

);

/* =====================================================
   SYNC BUTTON
===================================================== */

document
.getElementById(
    "syncButton"
)
.addEventListener(

    "click",

    bestandSynchronisieren

);

/* =====================================================
   AUTOMATISCHE AKTUALISIERUNG
===================================================== */

function kompletteAktualisierung(){

    renderKunden();

    renderAufgaben();

    renderAbschluesse();

    dashboardAktualisieren();

    kontaktListenAktualisieren();

}

/* =====================================================
   START INITIALISIERUNG
===================================================== */

window.addEventListener(

    "load",

    function(){

        kompletteAktualisierung();

    }

);


/* =====================================================
   HAUSHALTS AKTUALISIERUNG
===================================================== */

function haushalteAktualisieren(){

    kunden.forEach(

        kunde => {

            kunde.haushalt =

            kunden.filter(

                anderer =>

                anderer.id !== kunde.id &&

                anderer.strasse === kunde.strasse &&

                anderer.hausnummer === kunde.hausnummer &&

                anderer.plz === kunde.plz &&

                anderer.ort === kunde.ort

            )

            .map(

                person => person.id

            );

        }

    );

}

/* =====================================================
   GEBURTSTAGE DIESES MONATS
===================================================== */

function geburtstageDiesenMonat(){

    const monat =

    new Date().getMonth() + 1;

    return kunden.filter(

        kunde => {

            if(!kunde.geburtsdatum){

                return false;

            }

            return (

                new Date(
                    kunde.geburtsdatum
                )

                .getMonth() + 1

            ) === monat;

        }

    );

}

/* =====================================================
   WIEDERVORLAGEN HEUTE
===================================================== */

function wiedervorlagenHeuteAnzahl(){

    const heute =

    new Date()
    .toISOString()
    .split("T")[0];

    let anzahl = 0;

    kunden.forEach(

        kunde => {

            if(!kunde.termine){

                return;

            }

            kunde.termine.forEach(

                termin => {

                    if(

                        termin.datum ===
                        heute

                    ){

                        anzahl++;

                    }

                }

            );

        }

    );

    return anzahl;

}

/* =====================================================
   DATEN KONSISTENZ
===================================================== */

function datenPruefen(){

    kunden.forEach(

        kunde => {

            if(!kunde.telefone){

                kunde.telefone = [];

            }

            if(!kunde.emails){

                kunde.emails = [];

            }

            if(!kunde.vertraege){

                kunde.vertraege = [];

            }

            if(!kunde.termine){

                kunde.termine = [];

            }

            if(!kunde.kennzeichen){

                kunde.kennzeichen = [];

            }

            if(!kunde.notiz){

                kunde.notiz = "";

            }

        }

    );

}

/* =====================================================
   GESAMT AKTUALISIERUNG
===================================================== */

const alteKompletteAktualisierung =
kompletteAktualisierung;

kompletteAktualisierung =
function(){
    datenPruefen();
    haushalteAktualisieren();
    alteKompletteAktualisierung();
    triggerAutoSave();
};

/* =====================================================
   FINALE INITIALISIERUNG
===================================================== */

window.addEventListener("load", async function(){

    // IndexedDB zuerst, dann localStorage als Fallback
    const ausIndexedDB = await dbLaden();

    if(!ausIndexedDB){
        lokalLaden();
    }

    datenPruefen();
    erledigteAufgabenBereinigen();
    haushalteAktualisieren();
    renderKunden();
    renderAufgaben();
    renderAbschluesse();
    kontaktListenAktualisieren();
    dashboardAktualisieren();
    letzterSyncAnzeigeAktualisieren();

    // Einmal sauber in IndexedDB schreiben falls aus localStorage migriert
    if(!ausIndexedDB){
        await dbSpeichern();
    }

});

/* =====================================================
   PERIODISCHE AKTUALISIERUNG
===================================================== */

// Kontaktüberwachung und Dashboard alle 10 Minuten
// auffrischen (damit Tages-Zähler stimmen wenn die
// App länger offen bleibt)
setInterval(function(){
    kontaktListenAktualisieren();
    dashboardAktualisieren();
}, 10 * 60 * 1000);

/* =====================================================
   SCRIPT ENDE
===================================================== */

