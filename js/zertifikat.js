/* =====================================================
   FINANZIERUNGSZERTIFIKAT
   -----------------------------------------------------
   Fuellt die PDF-Vorlage Finanzierungszertifikat.pdf
   mit den Kundendaten + Finanzierungsbetrag + Berater-
   Block. Formular wird nach dem Fuellen "geflatten"
   (eingebrannt) → PDF ist nicht mehr editierbar.
   Download + mailto-Vorschlag an den Kunden.
===================================================== */

const ZERT_PDF_PFAD = "Finanzierungszertifikat.pdf";
const ZERT_LIB_URL  = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";

/* localStorage-Keys fuer Berater-Daten (gesondert vom
   Serienbrief, wie vom Nutzer gewuenscht) */
const ZERT_LS_BERATER_NAME     = "crmZertBeraterName";
const ZERT_LS_BERATER_FUNKTION = "crmZertBeraterFunktion";
const ZERT_LS_BERATER_FIRMA    = "crmZertBeraterFirma";
const ZERT_LS_BERATER_STRASSE  = "crmZertBeraterStrasse";
const ZERT_LS_BERATER_PLZORT   = "crmZertBeraterPlzOrt";
const ZERT_LS_BERATER_TEL      = "crmZertBeraterTel";
const ZERT_LS_BERATER_EMAIL    = "crmZertBeraterEmail";
/* Zusaetzliche Kontaktangaben — nur fuer Serienbriefe genutzt,
   aber hier zentral gepflegt (einzige Quelle). */
const ZERT_LS_BERATER_WEB            = "crmZertBeraterWeb";
const ZERT_LS_BERATER_OEFFNUNGSZEITEN= "crmZertBeraterOeffnungszeiten";
const ZERT_LS_LETZTER_BETRAG   = "crmZertLetzterBetrag";

/* Standard-Oeffnungszeiten (Vorbelegung fuer den Serienbrief-Absender) */
const ZERT_DEFAULT_OEFFNUNGSZEITEN =
    "Mo–Do  9:00–17:00 Uhr\n"
  + "Fr  9:00–13:00 Uhr\n"
  + "weitere Termine nach Vereinbarung";

/* =====================================================
   BERATER-DATEN LADEN/SPEICHERN
===================================================== */

function zertBeraterLaden(){
    return {
        name:     localStorage.getItem(ZERT_LS_BERATER_NAME)     || "",
        funktion: localStorage.getItem(ZERT_LS_BERATER_FUNKTION) || "",
        firma:    localStorage.getItem(ZERT_LS_BERATER_FIRMA)    || "",
        strasse:  localStorage.getItem(ZERT_LS_BERATER_STRASSE)  || "",
        plzOrt:   localStorage.getItem(ZERT_LS_BERATER_PLZORT)   || "",
        tel:      localStorage.getItem(ZERT_LS_BERATER_TEL)      || "",
        email:    localStorage.getItem(ZERT_LS_BERATER_EMAIL)    || "",
        web:      localStorage.getItem(ZERT_LS_BERATER_WEB)      || "",
        oeffnungszeiten:
            localStorage.getItem(ZERT_LS_BERATER_OEFFNUNGSZEITEN) !== null
                ? localStorage.getItem(ZERT_LS_BERATER_OEFFNUNGSZEITEN)
                : ZERT_DEFAULT_OEFFNUNGSZEITEN
    };
}

function zertBeraterFeldSpeichern(key, wert){
    try{ localStorage.setItem(key, wert); }catch(_){}
}

/* Alle Berater-Felder in einem Rutsch setzen (fuer
   Backup-Restore). Fehlende Keys im Input werden geloescht,
   leere Strings bleiben erhalten. */
function zertBeraterAlleSpeichern(obj){
    if(!obj || typeof obj !== "object"){ return; }
    const map = [
        [ZERT_LS_BERATER_NAME,     obj.name],
        [ZERT_LS_BERATER_FUNKTION, obj.funktion],
        [ZERT_LS_BERATER_FIRMA,    obj.firma],
        [ZERT_LS_BERATER_STRASSE,  obj.strasse],
        [ZERT_LS_BERATER_PLZORT,   obj.plzOrt],
        [ZERT_LS_BERATER_TEL,      obj.tel],
        [ZERT_LS_BERATER_EMAIL,    obj.email],
        [ZERT_LS_BERATER_WEB,      obj.web],
        [ZERT_LS_BERATER_OEFFNUNGSZEITEN, obj.oeffnungszeiten]
    ];
    map.forEach(([key, wert]) => {
        try{ localStorage.setItem(key, wert == null ? "" : String(wert)); }catch(_){}
    });
}

function zertBeraterVollstaendig(b){
    return !!(b.name && b.firma && b.tel && b.email);
}

function zertBeraterAdpBlock(b){
    const zeilen = [];
    if(b.name)     zeilen.push(b.name);
    if(b.funktion) zeilen.push(b.funktion);
    if(b.firma)    zeilen.push(b.firma);
    if(b.strasse)  zeilen.push(b.strasse);
    if(b.plzOrt)   zeilen.push(b.plzOrt);
    if(b.tel)      zeilen.push(b.tel);
    if(b.email)    zeilen.push(b.email);
    return zeilen.join("\n");
}

/* =====================================================
   PANEL IM DASHBOARD (Berater-Klappfeld)
===================================================== */

function zertBeraterPanelRendern(){
    const container = document.getElementById("zertBeraterPanel");
    if(!container){ return; }
    const b = zertBeraterLaden();
    const ok = zertBeraterVollstaendig(b);

    container.innerHTML = `
        <div class="zert-berater-hinweis">
            Diese Daten erscheinen auf jedem Finanzierungszertifikat
            als „Überreicht von Ihrem Berater" und dienen zugleich als
            Absender für Serienbriefe.
            ${ok ? '<span class="sb-ok">✓ ausgefüllt</span>'
                 : '<span class="sb-nok">bitte ausfüllen</span>'}
        </div>

        <div class="zert-ber-grid-2">
            <div>
                <label class="sb-feld-label">Name</label>
                <input type="text" class="crm-input"
                    value="${esc(b.name)}"
                    oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_NAME}', this.value); zertBeraterPanelHeaderAktualisieren()"
                    placeholder="Vorname Nachname">
            </div>
            <div>
                <label class="sb-feld-label">Funktion</label>
                <input type="text" class="crm-input"
                    value="${esc(b.funktion)}"
                    oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_FUNKTION}', this.value)"
                    placeholder="z. B. Bezirksleiter">
            </div>
        </div>

        <label class="sb-feld-label">Firma</label>
        <input type="text" class="crm-input"
            value="${esc(b.firma)}"
            oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_FIRMA}', this.value); zertBeraterPanelHeaderAktualisieren()"
            placeholder="z. B. Wüstenrot Bausparkasse AG">

        <div class="zert-ber-grid-2">
            <div>
                <label class="sb-feld-label">Straße + Nr.</label>
                <input type="text" class="crm-input"
                    value="${esc(b.strasse)}"
                    oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_STRASSE}', this.value)"
                    placeholder="Spandauer Str. 34">
            </div>
            <div>
                <label class="sb-feld-label">PLZ + Ort</label>
                <input type="text" class="crm-input"
                    value="${esc(b.plzOrt)}"
                    oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_PLZORT}', this.value)"
                    placeholder="57072 Siegen">
            </div>
        </div>

        <div class="zert-ber-grid-2">
            <div>
                <label class="sb-feld-label">Telefon</label>
                <input type="text" class="crm-input"
                    value="${esc(b.tel)}"
                    oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_TEL}', this.value); zertBeraterPanelHeaderAktualisieren()"
                    placeholder="+49 1522-5733806">
            </div>
            <div>
                <label class="sb-feld-label">E-Mail</label>
                <input type="text" class="crm-input"
                    value="${esc(b.email)}"
                    oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_EMAIL}', this.value); zertBeraterPanelHeaderAktualisieren()"
                    placeholder="name@firma.de">
            </div>
        </div>

        <label class="sb-feld-label">Website
            <span class="sb-feld-hinweis">(optional — nur für Serienbriefe)</span></label>
        <input type="text" class="crm-input"
            value="${esc(b.web)}"
            oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_WEB}', this.value)"
            placeholder="www.firma.de">

        <label class="sb-feld-label">Öffnungszeiten
            <span class="sb-feld-hinweis">(nur für Serienbriefe)</span></label>
        <textarea class="crm-textarea sb-oeffnungszeiten"
            oninput="zertBeraterFeldSpeichern('${ZERT_LS_BERATER_OEFFNUNGSZEITEN}', this.value)"
            placeholder="Mo–Do  9:00–17:00 Uhr&#10;Fr  9:00–13:00 Uhr">${esc(b.oeffnungszeiten)}</textarea>
    `;
}

function zertBeraterPanelHeaderAktualisieren(){
    const b = zertBeraterLaden();
    const ok = zertBeraterVollstaendig(b);
    const hinweis = document.querySelector("#zertBeraterPanel .zert-berater-hinweis span");
    if(!hinweis){ return; }
    hinweis.className = ok ? "sb-ok" : "sb-nok";
    hinweis.textContent = ok ? "✓ ausgefüllt" : "bitte ausfüllen";
}

/* =====================================================
   PDF-LIB BEI BEDARF LADEN (dynamisch, einmalig)
===================================================== */

let _pdfLibLadenPromise = null;
function zertLadePdfLib(){
    if(typeof PDFLib !== "undefined"){
        return Promise.resolve();
    }
    if(_pdfLibLadenPromise){ return _pdfLibLadenPromise; }
    _pdfLibLadenPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = ZERT_LIB_URL;
        script.onload  = () => resolve();
        script.onerror = () => {
            _pdfLibLadenPromise = null;
            reject(new Error("pdf-lib konnte nicht geladen werden ("
                + ZERT_LIB_URL + ")"));
        };
        document.head.appendChild(script);
    });
    return _pdfLibLadenPromise;
}

/* =====================================================
   HILFSFUNKTIONEN
===================================================== */

function zertGueltigBisDatum(d){
    // Zertifikat ist 30 Tage ab Ausstellung gueltig
    const g = new Date(d.getTime());
    g.setDate(g.getDate() + 30);
    const tt = String(g.getDate()).padStart(2, "0");
    const mm = String(g.getMonth() + 1).padStart(2, "0");
    const jj = g.getFullYear();
    return tt + "." + mm + "." + jj;
}

function zertBetragFormatieren(n){
    try{
        return new Intl.NumberFormat("de-DE").format(n);
    }catch(_){
        return String(n);
    }
}

function zertAntragsnummer(kunde){
    // Letzte 8 Ziffern der Party-ID (= das was oben am Kunden steht).
    // Fallback auf die interne CRM-ID, wenn keine Party-ID vorhanden.
    if(!kunde){ return ""; }
    const party = (kunde.partyIds && kunde.partyIds[0]) || "";
    const quelle = party ? String(party) : String(kunde.id != null ? kunde.id : "");
    // Nur Ziffern (robust gegen Leerzeichen, Bindestriche etc.)
    const nurZiffern = quelle.replace(/\D+/g, "");
    return nurZiffern.slice(-8);
}

function zertAnrede(kunde){
    const nn = String(kunde.nachname || "").trim();
    if(kunde.anrede === "Frau" && nn){ return "Frau " + nn; }
    if(kunde.anrede === "Herr" && nn){ return "Herrn " + nn; }
    return "Damen und Herren";
}

function zertAdresse(kunde){
    const z1 = (String(kunde.strasse || "").trim() + " "
             + String(kunde.hausnummer || "").trim()).trim();
    const z2 = (String(kunde.plz || "").trim() + " "
             + String(kunde.ort || "").trim()).trim();
    return [z1, z2].filter(Boolean).join("\n");
}

function zertDateiname(kunde){
    const nn = String(kunde.nachname || "Kunde").trim().replace(/[^\w\-]/g,"_");
    const vn = String(kunde.vorname  || "").trim().replace(/[^\w\-]/g,"_");
    return "Finanzierungszertifikat_" + nn + (vn ? "_" + vn : "") + ".pdf";
}

/* =====================================================
   BETRAG-MODAL (gibt Promise<number|null>)
===================================================== */

function zertBetragAbfragen(){
    return new Promise(resolve => {
        window.__zertBetragResolver = resolve;
        const letzter = localStorage.getItem(ZERT_LS_LETZTER_BETRAG) || "";
        const input = document.getElementById("zertBetragInput");
        if(input){ input.value = letzter; }
        const modal = document.getElementById("zertBetragModal");
        if(modal){ modal.style.display = "flex"; }
        setTimeout(() => { if(input){ input.focus(); input.select(); } }, 50);
    });
}

function zertBetragBestaetigen(){
    const input = document.getElementById("zertBetragInput");
    const raw = input ? String(input.value).trim() : "";
    // Deutsche Trenner tolerieren
    const bereinigt = raw.replace(/[\s.€]/g, "").replace(",", ".");
    const n = parseFloat(bereinigt);
    if(isNaN(n) || n <= 0){
        alert("Bitte einen gültigen Finanzierungsbetrag eingeben.");
        return;
    }
    const ganz = Math.round(n);
    try{ localStorage.setItem(ZERT_LS_LETZTER_BETRAG, String(ganz)); }catch(_){}
    document.getElementById("zertBetragModal").style.display = "none";
    if(window.__zertBetragResolver){
        window.__zertBetragResolver(ganz);
        window.__zertBetragResolver = null;
    }
}

function zertBetragAbbrechen(){
    const modal = document.getElementById("zertBetragModal");
    if(modal){ modal.style.display = "none"; }
    if(window.__zertBetragResolver){
        window.__zertBetragResolver(null);
        window.__zertBetragResolver = null;
    }
}

/* =====================================================
   HAUPT-FUNKTION — vom Kunden-Button aufgerufen
===================================================== */

async function zertifikatErstellen(kunde){
    try{
        await _zertifikatErstellenImpl(kunde);
    }catch(e){
        if(typeof fehlerMelden === "function"){
            fehlerMelden("Finanzierungszertifikat",
                "Erzeugung fehlgeschlagen: " + (e && e.message || e), e);
        }
        alert("Beim Erzeugen des Zertifikats ist ein Fehler aufgetreten.\n\n"
            + (e && e.message ? e.message : "")
            + "\n\nDetails im Fehler-Log (rotes Ausrufezeichen oben links).");
    }
}

async function _zertifikatErstellenImpl(kunde){
    if(!kunde || !kunde.id){
        alert("Kein Kunde ausgewählt.");
        return;
    }

    const berater = zertBeraterLaden();
    if(!zertBeraterVollstaendig(berater)){
        alert('Berater-Daten sind noch nicht vollständig ausgefüllt.\n\n'
            + 'Bitte im Dashboard unter „Datensicherung → Berater-Daten" '
            + 'mindestens Name, Firma, Telefon und E-Mail eintragen.');
        return;
    }

    const betrag = await zertBetragAbfragen();
    if(betrag === null){ return; }

    // pdf-lib laden
    await zertLadePdfLib();
    if(typeof PDFLib === "undefined"){
        throw new Error("pdf-lib ist nach dem Laden nicht verfügbar");
    }

    // PDF-Vorlage laden
    const resp = await fetch(ZERT_PDF_PFAD, { cache: "reload" });
    if(!resp.ok){
        throw new Error("PDF-Vorlage nicht gefunden ("
            + ZERT_PDF_PFAD + ", Status " + resp.status + ")");
    }
    const vorlagenBytes = await resp.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(vorlagenBytes);
    const form = pdfDoc.getForm();

    // Werte zusammenstellen
    const antragsnr    = zertAntragsnummer(kunde);
    const vollerName   = (String(kunde.vorname||"").trim() + " "
                        + String(kunde.nachname||"").trim()).trim();
    const anrede       = zertAnrede(kunde);
    const adresse      = zertAdresse(kunde);
    const geburtsdatum = String(kunde.geburtsdatum || "").trim();
    const betragStr    = zertBetragFormatieren(betrag);
    const heute        = new Date();
    const gueltigBis   = zertGueltigBisDatum(heute);
    // PDF-Feld "Datum" ist laut Vorlage "Bereitschaftserklärung bis zum Jahr"
    // und hat MaxLen 10 → nur Gueltigkeitsdatum TT.MM.JJJJ
    const datumStr     = gueltigBis;
    const adpBlock     = zertBeraterAdpBlock(berater);

    function _setField(name, wert){
        try{
            const f = form.getTextField(name);
            f.setText(wert);
        }catch(e){
            console.warn("Feld konnte nicht gesetzt werden: " + name, e);
        }
    }

    _setField("Vorname Nachname",  vollerName);
    _setField("Adresse",           adresse);
    _setField("Geburtsdatum",      geburtsdatum);
    _setField("Antragsnummer",     antragsnr);
    _setField("Anrede",            anrede);
    _setField("Angebotsnummer",    antragsnr);
    _setField("Finanzierungsbetrag", betragStr);
    _setField("Datum",             datumStr);
    _setField("ADP",               adpBlock);

    // Flatten → PDF nicht mehr editierbar
    form.flatten();

    const neuesPdf = await pdfDoc.save();

    // Download
    const blob      = new Blob([neuesPdf], { type: "application/pdf" });
    const dateiname = zertDateiname(kunde);
    const url       = URL.createObjectURL(blob);
    const a         = document.createElement("a");
    a.href = url;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);

    // mailto-Vorschlag falls E-Mail vorhanden
    const email = (kunde.emails && kunde.emails[0]) || "";
    if(email){
        const subject = "Ihr Finanzierungszertifikat";
        const anredeTxt = (kunde.anrede === "Frau") ? "Sehr geehrte Frau " + kunde.nachname
                        : (kunde.anrede === "Herr") ? "Sehr geehrter Herr " + kunde.nachname
                        : "Sehr geehrte Damen und Herren";
        const body =
            anredeTxt + ",\n\n"
          + "anbei erhalten Sie Ihr persönliches Finanzierungszertifikat "
          + "mit der Angebotsnummer " + antragsnr + ".\n\n"
          + "Das Zertifikat ist bis zum " + gueltigBis + " gültig.\n\n"
          + "Bei Rückfragen stehe ich Ihnen jederzeit zur Verfügung.\n\n"
          + "Mit freundlichen Grüßen\n"
          + berater.name
          + (berater.funktion ? "\n" + berater.funktion : "")
          + (berater.firma ? "\n" + berater.firma : "");
        const mailto = "mailto:" + encodeURIComponent(email)
                     + "?subject=" + encodeURIComponent(subject)
                     + "&body="    + encodeURIComponent(body);
        // Erst nach kurzer Pause, damit der Download-Dialog nicht
        // mit dem Mail-Programm kollidiert.
        setTimeout(() => { window.location.href = mailto; }, 500);
    }
}

/* =====================================================
   MIGRATION — fruehere Serienbrief-Absenderdaten uebernehmen
   -----------------------------------------------------
   Frueher pflegte der Serienbrief seine Firma/Kontakt-Daten
   doppelt in eigenen localStorage-Keys. Jetzt sind die
   Berater-Daten die einzige Quelle. Diese Migration kopiert
   vorhandene Serienbrief-Werte einmalig in leere Berater-
   Felder und entfernt danach die alten, ungenutzten Keys.
===================================================== */

function zertBeraterMigriereAusSerienbrief(){
    try{
        if(localStorage.getItem("crmBeraterSbMigriert") === "1"){ return; }

        const paare = [
            [ZERT_LS_BERATER_FIRMA,            "crmSerienbriefFirmaName"],
            [ZERT_LS_BERATER_STRASSE,          "crmSerienbriefFirmaStrasse"],
            [ZERT_LS_BERATER_PLZORT,           "crmSerienbriefFirmaPlzOrt"],
            [ZERT_LS_BERATER_NAME,             "crmSerienbriefKontaktName"],
            [ZERT_LS_BERATER_FUNKTION,         "crmSerienbriefKontaktFunktion"],
            [ZERT_LS_BERATER_TEL,              "crmSerienbriefKontaktTel"],
            [ZERT_LS_BERATER_EMAIL,            "crmSerienbriefKontaktEmail"],
            [ZERT_LS_BERATER_WEB,              "crmSerienbriefKontaktWeb"],
            [ZERT_LS_BERATER_OEFFNUNGSZEITEN,  "crmSerienbriefOeffnungszeiten"]
        ];

        // Nur fuellen, wo das Berater-Feld noch leer ist — vorhandene
        // Berater-Daten haben Vorrang.
        paare.forEach(([zielKey, altKey]) => {
            const alt  = localStorage.getItem(altKey);
            const ziel = localStorage.getItem(zielKey);
            if(alt != null && alt !== "" && (ziel == null || ziel === "")){
                try{ localStorage.setItem(zielKey, alt); }catch(_){}
            }
        });

        // Alte, nun ungenutzte Serienbrief-Absender-Keys entfernen
        [ "crmSerienbriefFirmaName", "crmSerienbriefFirmaStrasse",
          "crmSerienbriefFirmaPlzOrt", "crmSerienbriefKontaktName",
          "crmSerienbriefKontaktFunktion", "crmSerienbriefKontaktTel",
          "crmSerienbriefKontaktEmail", "crmSerienbriefKontaktWeb",
          "crmSerienbriefOeffnungszeiten"
        ].forEach(k => { try{ localStorage.removeItem(k); }catch(_){} });

        localStorage.setItem("crmBeraterSbMigriert", "1");
    }catch(_){}
}

/* Sofort beim Laden des Scripts — vor jedem Panel-Render */
zertBeraterMigriereAusSerienbrief();

/* Dashboard anspringen und das Berater-Klappfeld aufklappen
   (vom Serienbrief-Panel aus verlinkt). */
function beraterDatenOeffnen(){
    if(typeof showTab === "function"){ showTab("dashboard"); }
    const panel = document.getElementById("zertBeraterPanel");
    if(!panel){ return; }
    let el = panel.closest("details");
    while(el){
        el.open = true;
        el = el.parentElement ? el.parentElement.closest("details") : null;
    }
    setTimeout(() => {
        try{ panel.scrollIntoView({ behavior:"smooth", block:"center" }); }catch(_){}
    }, 80);
}

/* =====================================================
   INIT — Berater-Panel beim Laden rendern
===================================================== */

window.addEventListener("load", function(){
    // Dashboard-Panel aufbauen (sofern der Container im DOM ist)
    zertBeraterPanelRendern();
});
