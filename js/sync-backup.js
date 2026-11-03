/* =====================================================
   LETZTER SYNC ANZEIGE
===================================================== */

/* Anrede-Normalisierung fuer den Excel-Import.
   Akzeptiert Varianten wie "Frau", "Herr", "f"/"m"/"w"/"d". */
function _anredeNormalisieren(wert){
    if(wert === null || wert === undefined){ return ""; }
    const s = String(wert).trim().toLowerCase();
    if(!s){ return ""; }
    if(s === "frau" || s === "f" || s === "w" || s === "weiblich"){
        return "Frau";
    }
    if(s === "herr" || s === "hr" || s === "m" || s === "maennlich"
       || s === "männlich"){
        return "Herr";
    }
    if(s === "divers" || s === "d"){ return "Divers"; }
    return "";
}

/* Partner-Objekt aus einer Excel-Zeile bauen.
   Erwartet die Spalten "Anrede Partner", "Vorname Partner",
   "Nachname Partner", "Geburtsdatum Partner".
   Gibt null zurueck wenn alle vier Felder leer sind. */
function _partnerAusZeile(zeile){
    const an = _anredeNormalisieren(zeile["Anrede Partner"] || "");
    const vn = String(zeile["Vorname Partner"]      || "").trim();
    const nn = String(zeile["Nachname Partner"]     || "").trim();
    const gb = String(zeile["Geburtsdatum Partner"] || "").trim();
    if(!an && !vn && !nn && !gb){ return null; }
    return {
        anrede:       an,
        vorname:      vn,
        nachname:     nn,
        geburtsdatum: gb
    };
}

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

        /* Berater-Daten fuer Finanzierungszertifikate.
           Liegen sonst nur in localStorage und waeren beim
           Loeschen der Browserdaten weg. */
        beraterDaten:
        (typeof zertBeraterLaden === "function")
            ? zertBeraterLaden()
            : null,

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

            // Berater-Daten aus Backup wiederherstellen (falls im
            // JSON enthalten — aeltere Backups haben das Feld nicht).
            if(daten.beraterDaten
               && typeof zertBeraterAlleSpeichern === "function"){
                zertBeraterAlleSpeichern(daten.beraterDaten);
                if(typeof zertBeraterPanelRendern === "function"){
                    zertBeraterPanelRendern();
                }
            }

            // Nach Backup-Wiederherstellung: ID-Merkliste neu bauen
            // und Kollisionen bereinigen. Kompatibilitaet zu aelteren
            // Backups (kollidierende IDs) ist damit gesichert.
            if(typeof resetIdCache === "function"){ resetIdCache(); }
            if(typeof bereinigeIdKollisionen === "function"){
                bereinigeIdKollisionen();
            }
            if(typeof bereinigeAlleKontaktdaten === "function"){
                bereinigeAlleKontaktdaten();
            }

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

        // Alle Zeilen als Arrays lesen (header:1). So umgehen wir
        // doppelte Spaltennamen in der neuen Synchro (z. B.
        // "Vertragsbeginn" kommt zweimal vor), die beim rein
        // namensbasierten Einlesen kollidieren wuerden.
        const aoa =
        XLSX.utils.sheet_to_json(
            worksheet,
            {
                header:1,
                defval:"",
                raw:false,
                dateNF:"dd.mm.yyyy"
            }
        );

        const kopf = (aoa[0] || []).map(
            h => String(h == null ? "" : h).trim()
        );

        function _spalte(name){ return kopf.indexOf(name); }
        function _spaltenAlle(name){
            const r = [];
            kopf.forEach((h, i) => { if(h === name){ r.push(i); } });
            return r;
        }

        // Benoetigte Spaltenindizes einmalig bestimmen
        const SP = {
            partyId:   _spalte("PARTY_ID"),
            anrede:    _spalte("Anrede"),
            vorname:   _spalte("Vorname"),
            nachname:  _spalte("Nachname"),
            geburt:    _spalte("Geburtsdatum"),
            plz:       _spalte("PLZ"),
            ort:       _spalte("Ort"),
            strasse:   _spalte("Straße"),
            hausnr:    _spalte("Hausnummer"),
            pAnrede:   _spalte("Anrede Partner"),
            pVorname:  _spalte("Vorname Partner"),
            pNachname: _spalte("Nachname Partner"),
            pGeburt:   _spalte("Geburtsdatum Partner"),
            produkt:   _spalte("Produktbezeichnung"),
            vertragNr: _spalte("Vertragsnummer"),
            bausparsumme: _spalte("Bausparsumme"),
            saldoBs:   _spalte("Saldo (BS)"),
            guthaben:  _spalte("Guthaben in %"),
            abschluss: _spalte("Abschlussdatum"),
            zuteilung: _spalte("Zuteilungsdatum"),
            zkSumme:   _spalte("ZK Summe"),
            zkSaldo:   _spalte("ZK Saldo"),
            darlehen:  _spalte("Darlehenssumme"),
            restschuld:_spalte("akt. Restschuld"),
            zinsBis:   _spalte("Zinsfestschreibung bis"),
            saldo2:    _spalte("Saldo"),
            depotBeginn:_spalte("Vertragsbeginn Depot"),
            lvBeginn:  _spalte("LV Vertragsbeginn"),
            telBev:    _spalte("Telefon bevorzugt"),
            telPriv:   _spalte("Telefon privat"),
            telGesch:  _spalte("Telefon geschäftlich"),
            telSonst:  _spalte("Telefon sonstige"),
            mobPriv:   _spalte("Mobil privat"),
            mobGesch:  _spalte("Mobil geschäftlich"),
            mobSonst:  _spalte("Mobil sonstige"),
            emailBev:  _spalte("E-Mail bevorzugt"),
            emailPriv: _spalte("E-Mail privat"),
            emailGesch:_spalte("E-Mail geschäftlich"),
            emailSonst:_spalte("E-Mail sonstige")
        };
        // "Vertragsbeginn" steht zweimal (verschiedene Darlehens-Bloecke)
        const SP_beginn = _spaltenAlle("Vertragsbeginn");

        function _zelle(row, idx){
            return (idx >= 0 && idx < row.length && row[idx] != null)
                ? row[idx] : "";
        }

        // Datenzeilen (ohne Kopf) in Objekte mit genau den benoetigten
        // Schluesseln uebersetzen — alles positionsbasiert.
        const zeilen = aoa.slice(1).map(row => {
            const g = (idx) => _zelle(row, idx);
            const beginn = SP_beginn
                .map(i => String(g(i) || "").trim())
                .find(w => w) || "";
            return {
                "PARTY_ID":             g(SP.partyId),
                "Anrede":               g(SP.anrede),
                "Vorname":              g(SP.vorname),
                "Nachname":             g(SP.nachname),
                "Geburtsdatum":         g(SP.geburt),
                "PLZ":                  g(SP.plz),
                "Ort":                  g(SP.ort),
                "Straße":               g(SP.strasse),
                "Hausnummer":           g(SP.hausnr),
                "Anrede Partner":       g(SP.pAnrede),
                "Vorname Partner":      g(SP.pVorname),
                "Nachname Partner":     g(SP.pNachname),
                "Geburtsdatum Partner": g(SP.pGeburt),
                "Produktbezeichnung":   g(SP.produkt),
                "Vertragsnummer":       g(SP.vertragNr),
                /* Vertragsdetails (nur grüne Spalten) */
                "__bausparsumme": g(SP.bausparsumme),
                "__saldo":        String(g(SP.saldoBs) || g(SP.saldo2) || "").trim(),
                "__guthaben":     g(SP.guthaben),
                "__abschluss":    g(SP.abschluss),
                "__zuteilung":    g(SP.zuteilung),
                "__zkSumme":      g(SP.zkSumme),
                "__zkSaldo":      g(SP.zkSaldo),
                "__darlehen":     g(SP.darlehen),
                "__restschuld":   g(SP.restschuld),
                "__zinsBis":      g(SP.zinsBis),
                "__beginn":       String(beginn || g(SP.depotBeginn) || g(SP.lvBeginn) || "").trim(),
                /* Kontaktdaten: alle Telefon-/E-Mail-Spalten */
                "__telefone":    [SP.telBev, SP.telPriv, SP.telGesch, SP.telSonst,
                                  SP.mobPriv, SP.mobGesch, SP.mobSonst].map(i => g(i)),
                "__telBevWert":  g(SP.telBev),
                "__emails":      [SP.emailBev, SP.emailPriv, SP.emailGesch, SP.emailSonst].map(i => g(i)),
                "__emailBevWert":g(SP.emailBev)
            };
        });

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

                    anrede: _anredeNormalisieren(zeile["Anrede"]),

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
                        bestandVerlassen:false,
                        wichtigbrief:false,
                        googleReview:false
                    },

                    partner: _partnerAusZeile(zeile)

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

            // Anrede: nur setzen wenn in der Zeile vorhanden — sonst
            // bestehenden Wert (evtl. manuell gepflegt) nicht ueberschreiben.
            const importAnrede = _anredeNormalisieren(zeile["Anrede"]);
            if(importAnrede){
                kunde.anrede = importAnrede;
            }else if(typeof kunde.anrede !== "string"){
                kunde.anrede = "";
            }

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

            /* Partner: nur ueberschreiben wenn das Excel welchen
               liefert. Leere Partner-Spalten lassen den im CRM
               bereits hinterlegten Partner unangetastet. */
            const importPartner = _partnerAusZeile(zeile);
            if(importPartner){
                kunde.partner = importPartner;
            }

            /* --- Telefon: alle Spalten (bevorzugt + privat/geschäftl./
               sonstige + Mobil), Dopplungen zusammenführen. Die
               bevorzugte Nummer wird gemerkt (Anzeige mit *). --- */
            const telBevKey = (function(){
                const n = normalisiereTelefon(zeile["__telBevWert"]);
                return n ? telefonSchluessel(n) : "";
            })();
            (zeile["__telefone"] || []).forEach(roh => {
                const norm = normalisiereTelefon(roh);
                if(!norm){ return; }
                const key = telefonSchluessel(norm);
                const schonDa = kunde.telefone.some(t =>
                    telefonSchluessel(t) === key
                );
                if(!schonDa){
                    kunde.telefone.push(norm);
                }
            });
            if(telBevKey){
                kunde.telefonBevorzugt = telBevKey;
            }

            /* --- E-Mail: alle Spalten, Dopplungen zusammenführen.
               "Vapnomail" = interne Markierung für "keine Mail" →
               wird uebersprungen (nichts eintragen). --- */
            const emailBevNorm = (function(){
                const roh = String(zeile["__emailBevWert"] || "").trim();
                if(!roh || roh.toLowerCase() === "vapnomail"){ return ""; }
                return normalisiereEmail(roh);
            })();
            (zeile["__emails"] || []).forEach(roh => {
                const txt = String(roh || "").trim();
                if(!txt || txt.toLowerCase() === "vapnomail"){ return; }
                const norm = normalisiereEmail(txt);
                if(!norm){ return; }
                const schonDa = kunde.emails.some(e =>
                    normalisiereEmail(e) === norm
                );
                if(!schonDa){
                    kunde.emails.push(norm);
                }
            });
            if(emailBevNorm){
                kunde.emailBevorzugt = emailBevNorm;
            }

            // Vorhandene Eintraege dieses Kunden gleich mitbereinigen
            // (streicht Excel-Apostrophe und dedupliziert Alt-Bestand)
            bereinigeKontaktdatenEinesKunden(kunde);

            // Diesen Kunden fuer den Reconciler registrieren —
            // auch wenn diese Zeile keine Vertragsnummer traegt.
            if(!importierteVertragsnummernProKunde.has(kunde.id)){
                importierteVertragsnummernProKunde.set(kunde.id, new Set());
            }

            // Vertragsnummer (fuehrenden Excel-Apostroph abfangen, damit
            // '12345 und 12345 nicht als verschiedene Vertraege gelten)
            let vertragNr =
            String(zeile["Vertragsnummer"] || "").trim();
            if(vertragNr.startsWith("'")){
                vertragNr = vertragNr.substring(1).trim();
            }
            const produktBez =
            String(zeile["Produktbezeichnung"] || "").trim();

            if(vertragNr){

                // Schluessel = Nummer + Produkt. Zwei unterschiedliche
                // Produkte duerfen dieselbe Vertragsnummer tragen
                // (z. B. Bausparen + Zwischenfinanzierung) und werden
                // getrennt gefuehrt — in der Anzeige aber zusammen in
                // einer Kachel gruppiert.
                const vKey = vertragNr + "\u0001" + produktBez;
                importierteVertragsnummernProKunde
                    .get(kunde.id).add(vKey);

                // Legacy: alte String-Verträge in Objekte migrieren
                kunde.vertraege = (kunde.vertraege || []).map(v =>
                    typeof v === "string"
                    ? { nummer: v }
                    : v
                );

                const neuerVertrag = {
                    nummer:          vertragNr,
                    produkt:         produktBez,
                    bausparsumme:    String(zeile["__bausparsumme"] || "").trim(),
                    saldo:           String(zeile["__saldo"] || "").trim(),
                    guthabenProzent: String(zeile["__guthaben"] || "").trim(),
                    zuteilungsdatum: String(zeile["__zuteilung"] || "").trim(),
                    abschluss:       String(zeile["__abschluss"] || "").trim(),
                    zkSumme:         String(zeile["__zkSumme"] || "").trim(),
                    zkSaldo:         String(zeile["__zkSaldo"] || "").trim(),
                    darlehenssumme:  String(zeile["__darlehen"] || "").trim(),
                    restschuld:      String(zeile["__restschuld"] || "").trim(),
                    zinsBis:         String(zeile["__zinsBis"] || "").trim(),
                    beginn:          String(zeile["__beginn"] || "").trim()
                };

                // Vorhandenen Vertrag mit gleicher Nummer UND gleichem
                // Produkt aktualisieren, sonst neu anlegen.
                const idx = kunde.vertraege.findIndex(v =>
                    v && v.nummer === vertragNr
                      && String(v.produkt || "") === produktBez
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
                if(!vObj || !vObj.nummer){ return false; }
                const key = vObj.nummer + "\u0001" + String(vObj.produkt || "");
                return gemeldete.has(key);
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
   DATEN KONSISTENZ
   -----------------------------------------------------
   Sichert, dass alle Pflichtfelder an jedem Kunden
   existieren und den richtigen Datentyp haben.
   Idempotent: mehrfach aufzurufen ist unschaedlich.
   Aenderung von Defaults hier wirkt beim naechsten
   Laden/Speichern auf alle Alt-Datensaetze.
===================================================== */

function datenPruefen(){

    kunden.forEach(kunde => {

        /* --- Array-Felder: nie undefined --- */
        if(!Array.isArray(kunde.telefone))  { kunde.telefone  = []; }
        if(!Array.isArray(kunde.emails))    { kunde.emails    = []; }
        if(!Array.isArray(kunde.vertraege)) { kunde.vertraege = []; }
        if(!Array.isArray(kunde.termine))   { kunde.termine   = []; }
        if(!Array.isArray(kunde.partyIds))  { kunde.partyIds  = []; }

        /* --- String-Felder --- */
        if(typeof kunde.anrede !== "string"){ kunde.anrede = ""; }
        if(typeof kunde.notiz  !== "string"){ kunde.notiz  = ""; }
        if(typeof kunde.telefonBevorzugt !== "string"){ kunde.telefonBevorzugt = ""; }
        if(typeof kunde.emailBevorzugt   !== "string"){ kunde.emailBevorzugt   = ""; }

        /* --- Kennzeichen-Objekt: muss ein Plain-Object sein ---
           Alt-Bug: manche Kunden hatten kennzeichen = [] statt {}.
           Null/Array/Primitive-Werte werden auf {} normalisiert,
           damit .wichtigbrief etc. lesbar bleibt. */
        if(!kunde.kennzeichen
           || typeof kunde.kennzeichen !== "object"
           || Array.isArray(kunde.kennzeichen)){
            kunde.kennzeichen = {};
        }

        /* --- Partner (optional) ---
           Entweder null oder Plain-Object mit anrede/vorname/
           nachname/geburtsdatum (alle als String). Alles leer
           → auf null zuruecksetzen. */
        if(kunde.partner === undefined){ kunde.partner = null; }
        if(kunde.partner !== null){
            if(typeof kunde.partner !== "object"
               || Array.isArray(kunde.partner)){
                kunde.partner = null;
            }else{
                if(typeof kunde.partner.anrede       !== "string"){ kunde.partner.anrede       = ""; }
                if(typeof kunde.partner.vorname      !== "string"){ kunde.partner.vorname      = ""; }
                if(typeof kunde.partner.nachname     !== "string"){ kunde.partner.nachname     = ""; }
                if(typeof kunde.partner.geburtsdatum !== "string"){ kunde.partner.geburtsdatum = ""; }
                if(!kunde.partner.anrede
                   && !kunde.partner.vorname
                   && !kunde.partner.nachname
                   && !kunde.partner.geburtsdatum){
                    kunde.partner = null;
                }
            }
        }

        /* Alle Kennzeichen-Felder auf Boolean default false bringen
           (zentrale Liste in core.js: KENNZEICHEN_FELDER). So wird
           ein neues Kennzeichen nur dort eingetragen und automatisch
           an allen Alt-Kunden ergaenzt. */
        KENNZEICHEN_FELDER.forEach(feld => {
            if(typeof kunde.kennzeichen[feld] !== "boolean"){
                kunde.kennzeichen[feld] = false;
            }
        });

    });

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
    // Bestehende Telefon-/E-Mail-Angaben einheitlich normieren
    // (z. B. +49/0049 → 0, Dopplungen entfernen), auch bei Alt-Daten.
    if(typeof bereinigeAlleKontaktdaten === "function"){
        bereinigeAlleKontaktdaten();
    }
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

