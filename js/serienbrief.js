/* =====================================================
   SERIENBRIEF — Wichtigbriefe drucken
   -----------------------------------------------------
   DIN-5008-Geschaeftsbrief mit optionalem Rueckantwort-
   Abschnitt (zweite Seite). Felder werden strukturiert
   erfasst, sodass sie konsistent an mehreren Stellen
   im Brief auftauchen (Ruecksenderzeile, Absender-Block,
   Signatur, Rueckantwort-Adresse).

   Persistierung (localStorage):
     - Firma: Name, Straße, PLZ+Ort
     - Kontakt: Ansprechpartner, Funktion, Tel/WhatsApp,
       E-Mail, Website
     - Öffnungszeiten (mehrzeilig)
     - Rückmelde-Frist (Tage)
     - Rückantwort-Teil ein/aus
     - Betreff, Brieftext, Schriftgröße
     - Haushalts-Overrides (getrennt anschreiben)
===================================================== */

const SB_LS_FIRMA_NAME      = "crmSerienbriefFirmaName";
const SB_LS_FIRMA_STRASSE   = "crmSerienbriefFirmaStrasse";
const SB_LS_FIRMA_PLZORT    = "crmSerienbriefFirmaPlzOrt";
const SB_LS_KONTAKT_NAME    = "crmSerienbriefKontaktName";
const SB_LS_KONTAKT_FUNKTION= "crmSerienbriefKontaktFunktion";
const SB_LS_KONTAKT_TEL     = "crmSerienbriefKontaktTel";
const SB_LS_KONTAKT_EMAIL   = "crmSerienbriefKontaktEmail";
const SB_LS_KONTAKT_WEB     = "crmSerienbriefKontaktWeb";
const SB_LS_OEFFNUNGSZEITEN = "crmSerienbriefOeffnungszeiten";
const SB_LS_FRIST_TAGE      = "crmSerienbriefFristTage";
const SB_LS_RUECKANTWORT    = "crmSerienbriefRueckantwort";
const SB_LS_TEXT            = "crmSerienbriefText";
const SB_LS_BETREFF         = "crmSerienbriefBetreff";
const SB_LS_SCHRIFT         = "crmSerienbriefSchriftgroesse";
const SB_LS_GETRENNT        = "crmSerienbriefGetrennt";

const SB_SCHRIFTGROESSEN = [9, 10, 11, 12, 13, 14];
const SB_DEFAULT_SCHRIFT = 11;
const SB_DEFAULT_FRIST_TAGE = 21;

const SB_DEFAULT_OEFFNUNGSZEITEN =
    "Mo–Do  9:00–17:00 Uhr\n"
  + "Fr  9:00–13:00 Uhr\n"
  + "weitere Termine nach Vereinbarung";

const SB_DEFAULT_BETREFF =
    "Wichtige Unterlagen zu Ihrem Vertrag – bitte kurz bei uns melden";

const SB_DEFAULT_TEXT =
    "{anrede_formal},"
  + "\n\n"
  + "Sie sind uns als {kundenwort} wichtig – und genau deshalb "
  + "möchten wir Sie persönlich erreichen. In den vergangenen Wochen "
  + "haben wir mehrfach versucht, Sie telefonisch und per E-Mail zu "
  + "kontaktieren. Leider ist uns das bislang nicht gelungen; "
  + "vermutlich haben sich Ihre Kontaktdaten zwischenzeitlich geändert."
  + "\n\n"
  + "Uns liegen aktuell Unterlagen zu Ihrem Vertrag vor, die Ihre "
  + "persönliche Aufmerksamkeit erfordern. Damit Ihnen keine Fristen, "
  + "Leistungen oder wichtigen Informationen entgehen, möchten wir "
  + "diese kurz gemeinsam mit Ihnen klären – unkompliziert, in wenigen "
  + "Minuten und selbstverständlich kostenfrei."
  + "\n\n"
  + "**Bitte geben Sie uns bis zum {frist} eine kurze Rückmeldung. "
  + "Am schnellsten erreichen Sie uns telefonisch oder per WhatsApp "
  + "unter {tel} oder per E-Mail unter {email}. Alternativ nutzen Sie "
  + "einfach den vorbereiteten Antwortabschnitt unten – er ist in "
  + "weniger als einer Minute ausgefüllt.**"
  + "\n\n"
  + "Ihre Zufriedenheit und die Sicherheit Ihrer Vorsorge liegen uns "
  + "am Herzen. Wir freuen uns, bald von Ihnen zu hören.";

/* =====================================================
   FIRMEN-/KONTAKT-DATEN LADEN
===================================================== */

function sbFirmenDatenLaden(){
    return {
        firma: {
            name:    localStorage.getItem(SB_LS_FIRMA_NAME) || "",
            strasse: localStorage.getItem(SB_LS_FIRMA_STRASSE) || "",
            plzOrt:  localStorage.getItem(SB_LS_FIRMA_PLZORT) || ""
        },
        kontakt: {
            name:     localStorage.getItem(SB_LS_KONTAKT_NAME) || "",
            funktion: localStorage.getItem(SB_LS_KONTAKT_FUNKTION) || "",
            tel:      localStorage.getItem(SB_LS_KONTAKT_TEL) || "",
            email:    localStorage.getItem(SB_LS_KONTAKT_EMAIL) || "",
            web:      localStorage.getItem(SB_LS_KONTAKT_WEB) || ""
        },
        oeffnungszeiten:
            localStorage.getItem(SB_LS_OEFFNUNGSZEITEN) !== null
                ? localStorage.getItem(SB_LS_OEFFNUNGSZEITEN)
                : SB_DEFAULT_OEFFNUNGSZEITEN,
        fristTage: (function(){
            const n = parseInt(localStorage.getItem(SB_LS_FRIST_TAGE), 10);
            return (isNaN(n) || n < 1) ? SB_DEFAULT_FRIST_TAGE : n;
        })(),
        rueckantwortAktiv: localStorage.getItem(SB_LS_RUECKANTWORT) !== "0"
    };
}

/* =====================================================
   HAUSHALTS-GRUPPIERUNG
===================================================== */

function sbAdressKey(k){
    return [
        String(k.strasse||"").trim().toLowerCase(),
        String(k.hausnummer||"").trim().toLowerCase().replace(/\s+/g,""),
        String(k.plz||"").trim(),
        String(k.ort||"").trim().toLowerCase()
    ].join("|");
}

function sbHatAdresse(k){
    return !!(String(k.strasse||"").trim() &&
              String(k.plz||"").trim() &&
              String(k.ort||"").trim());
}

function sbGetrenntSetLaden(){
    try{
        const roh = localStorage.getItem(SB_LS_GETRENNT);
        return new Set(roh ? JSON.parse(roh) : []);
    }catch(_){ return new Set(); }
}

function sbGetrenntSetSpeichern(set){
    try{
        localStorage.setItem(SB_LS_GETRENNT,
            JSON.stringify(Array.from(set)));
    }catch(_){}
}

function sbHaushalteBilden(personen){
    const map = new Map();
    personen.forEach(p => {
        const k = sbAdressKey(p);
        if(!map.has(k)){ map.set(k, []); }
        map.get(k).push(p);
    });
    const getrenntSet = sbGetrenntSetLaden();
    const gruppen = [];
    map.forEach((leute, key) => {
        gruppen.push({
            adressKey: key,
            personen: leute,
            getrennt: getrenntSet.has(key)
        });
    });
    return gruppen;
}

/* =====================================================
   ANREDE-KOMBINATOR (fuer {anrede_kombiniert})
===================================================== */

function sbAnredeKombiniert(personen){
    if(personen.length === 1){
        const p = personen[0];
        return (p.vorname + " " + p.nachname).trim();
    }
    const nachnamen = personen.map(p => String(p.nachname||"").trim().toLowerCase());
    const alleGleich = nachnamen.every(n => n === nachnamen[0] && n !== "");
    if(alleGleich){
        const vornamen = personen.map(p => String(p.vorname||"").trim());
        const nachname = String(personen[0].nachname||"").trim();
        if(vornamen.length === 2){
            return vornamen.join(" und ") + " " + nachname;
        }
        const ohneLetzten = vornamen.slice(0, -1).join(", ");
        return ohneLetzten + " und " + vornamen[vornamen.length - 1]
             + " " + nachname;
    }
    const namen = personen.map(p =>
        (String(p.vorname||"").trim() + " " + String(p.nachname||"").trim()).trim()
    );
    if(namen.length === 2){ return namen.join(" und "); }
    return namen.slice(0, -1).join(", ") + " und " + namen[namen.length - 1];
}

/* =====================================================
   FORMELLE ANREDE (fuer {anrede_formal})
===================================================== */

function sbAnredeFormal(personen){
    if(personen.length === 0){ return "Sehr geehrte Damen und Herren"; }
    if(personen.length === 1){
        const p = personen[0];
        const nn = String(p.nachname||"").trim();
        if(!nn){ return "Sehr geehrte Damen und Herren"; }
        if(p.anrede === "Frau"){ return "Sehr geehrte Frau " + nn; }
        if(p.anrede === "Herr"){ return "Sehr geehrter Herr " + nn; }
        return "Sehr geehrte Damen und Herren";
    }
    const nachnamen = personen
        .map(p => String(p.nachname||"").trim())
        .filter(n => n);
    if(nachnamen.length === 0){
        return "Sehr geehrte Damen und Herren";
    }
    const seen = new Set();
    const eindeutig = [];
    nachnamen.forEach(n => {
        const k = n.toLowerCase();
        if(!seen.has(k)){ seen.add(k); eindeutig.push(n); }
    });
    if(eindeutig.length === 1){
        return "Sehr geehrte Familie " + eindeutig[0];
    }
    return "Sehr geehrte Familie " + eindeutig.join("/");
}

/* =====================================================
   KUNDENWORT  (fuer "Sie sind uns als {kundenwort} wichtig")
   -----------------------------------------------------
   1 Person Frau:   "Kundin"
   1 Person Herr:   "Kunde"
   1 Person unklar: "Kundin bzw. Kunde"
   ≥2 Personen:     "Kunden"
===================================================== */

function sbKundenwort(personen){
    if(!personen || personen.length === 0){ return "Kundin bzw. Kunde"; }
    if(personen.length >= 2){ return "Kunden"; }
    const p = personen[0];
    if(p.anrede === "Frau"){ return "Kundin"; }
    if(p.anrede === "Herr"){ return "Kunde"; }
    return "Kundin bzw. Kunde";
}

/* =====================================================
   FRIST BERECHNEN  (fuer {frist})
===================================================== */

function sbFristDatum(tage){
    const d = new Date();
    d.setDate(d.getDate() + (parseInt(tage, 10) || SB_DEFAULT_FRIST_TAGE));
    return d.toLocaleDateString("de-DE");
}

/* =====================================================
   PLATZHALTER EINSETZEN
===================================================== */

function sbTextFuellen(vorlage, personen, fd){
    const first = personen[0];
    const heute = new Date().toLocaleDateString("de-DE");
    fd = fd || sbFirmenDatenLaden();
    const map = {
        "{anrede_kombiniert}": sbAnredeKombiniert(personen),
        "{anrede_formal}":     sbAnredeFormal(personen),
        "{kundenwort}":        sbKundenwort(personen),
        "{frist}":             sbFristDatum(fd.fristTage),
        "{tel}":               fd.kontakt.tel,
        "{email}":             fd.kontakt.email,
        "{website}":           fd.kontakt.web,
        "{firma}":             fd.firma.name,
        "{ansprechpartner}":   fd.kontakt.name,
        "{vorname}":  String(first.vorname||"").trim(),
        "{nachname}": String(first.nachname||"").trim(),
        "{anrede}":   String(first.anrede||"").trim(),
        "{strasse}":  String(first.strasse||"").trim(),
        "{hausnummer}": String(first.hausnummer||"").trim(),
        "{plz}":      String(first.plz||"").trim(),
        "{ort}":      String(first.ort||"").trim(),
        "{heute}":    heute
    };
    let out = String(vorlage||"");
    Object.keys(map).forEach(k => {
        out = out.split(k).join(map[k]);
    });
    return out;
}

/* =====================================================
   ABLEITUNGEN AUS FIRMEN-DATEN
===================================================== */

function sbRuecksenderZeile(fd){
    const parts = [];
    if(fd.firma.name)    parts.push(fd.firma.name);
    if(fd.firma.strasse) parts.push(fd.firma.strasse);
    if(fd.firma.plzOrt)  parts.push(fd.firma.plzOrt);
    return parts.join(" · ");
}

function sbAbsenderOrt(fd){
    // "57072 Siegen" → "Siegen"
    const m = String(fd.firma.plzOrt||"").trim().match(/^\d{5}\s+(.+)$/);
    return m ? m[1].trim() : String(fd.firma.plzOrt||"").trim();
}

function sbAbsenderBlockText(fd){
    const zeilen = [];
    if(fd.kontakt.name)     zeilen.push(fd.kontakt.name);
    if(fd.kontakt.funktion) zeilen.push(fd.kontakt.funktion);
    if(fd.firma.name)       zeilen.push(fd.firma.name);
    if(fd.firma.strasse)    zeilen.push(fd.firma.strasse);
    if(fd.firma.plzOrt)     zeilen.push(fd.firma.plzOrt);
    zeilen.push("");  // Trennzeile
    if(fd.kontakt.tel)      zeilen.push("Tel./WhatsApp: " + fd.kontakt.tel);
    if(fd.kontakt.email)    zeilen.push("E-Mail: " + fd.kontakt.email);
    if(fd.kontakt.web)      zeilen.push(fd.kontakt.web);
    if(fd.oeffnungszeiten && fd.oeffnungszeiten.trim()){
        zeilen.push("");
        zeilen.push("Öffnungszeiten");
        fd.oeffnungszeiten.split("\n").forEach(z => zeilen.push(z));
    }
    return zeilen.join("\n");
}

function sbSignaturText(fd){
    const zeilen = ["Mit freundlichen Grüßen", ""];
    if(fd.kontakt.name)     zeilen.push(fd.kontakt.name);
    const funkFirma = [fd.kontakt.funktion, fd.firma.name]
        .filter(Boolean).join(" · ");
    if(funkFirma) zeilen.push(funkFirma);
    return zeilen.join("\n");
}

/* =====================================================
   MARKDOWN-FETT  (**text** → <strong>text</strong>)
   -----------------------------------------------------
   Reihenfolge: erst Platzhalter einsetzen, dann HTML
   escapen, dann hier **…** in <strong>…</strong> wandeln.
===================================================== */

function sbMarkdownFett(escapedText){
    return String(escapedText||"").replace(
        /\*\*([^*]+)\*\*/g, '<strong>$1</strong>'
    );
}

function sbFirmenDatenVollstaendig(fd){
    return !!(fd.firma.name && fd.firma.plzOrt
           && fd.kontakt.name && fd.kontakt.tel && fd.kontakt.email);
}

/* =====================================================
   KLAPP-PANEL RENDERN
===================================================== */

function serienbriefPanelRendern(){
    const container = document.getElementById("serienbriefPanel");
    if(!container){ return; }

    const treffer = (typeof selektionAnwenden === "function")
        ? selektionAnwenden()
        : kunden.filter(k => !k.archiviert);
    const mitAdresse  = treffer.filter(sbHatAdresse);
    const ohneAdresse = treffer.filter(k => !sbHatAdresse(k));
    const gruppen     = sbHaushalteBilden(mitAdresse);

    let briefeGesamt = 0;
    gruppen.forEach(g => {
        briefeGesamt += g.getrennt ? g.personen.length : 1;
    });
    const haushalteZusammen = gruppen.filter(
        g => g.personen.length > 1 && !g.getrennt
    ).length;

    const fd = sbFirmenDatenLaden();
    const gespText    = localStorage.getItem(SB_LS_TEXT);
    const gespBetreff = localStorage.getItem(SB_LS_BETREFF);
    const gespSchrift = parseInt(localStorage.getItem(SB_LS_SCHRIFT), 10);
    const text    = gespText !== null ? gespText : SB_DEFAULT_TEXT;
    const betreff = gespBetreff !== null ? gespBetreff : SB_DEFAULT_BETREFF;
    const schrift = (SB_SCHRIFTGROESSEN.indexOf(gespSchrift) !== -1)
        ? gespSchrift : SB_DEFAULT_SCHRIFT;

    const basisVollstaendig = sbFirmenDatenVollstaendig(fd);

    container.innerHTML = `
        <div class="sb-info-zeile">
            <strong>${treffer.length}</strong> Kunden ausgewählt
            → <strong>${briefeGesamt}</strong> Brief${briefeGesamt === 1 ? "" : "e"}
            ${haushalteZusammen > 0
                ? `<span class="sb-haushalt-hinweis">
                     (${haushalteZusammen} Haushalt${haushalteZusammen === 1 ? "" : "e"} zusammengefasst)
                   </span>`
                : ""}
            ${ohneAdresse.length > 0
                ? `<span class="sb-warn-hinweis">
                     ⚠ ${ohneAdresse.length} ohne Adresse — werden übersprungen
                   </span>`
                : ""}
        </div>

        ${gruppen.filter(g => g.personen.length > 1).length > 0 ? `
            <details class="sb-haushalts-details">
                <summary>${gruppen.filter(g => g.personen.length > 1).length} mehrpersonen-Haushalt${
                    gruppen.filter(g => g.personen.length > 1).length === 1 ? "" : "e"
                } — Details anzeigen</summary>
                <div class="sb-haushalts-liste">
                    ${gruppen.filter(g => g.personen.length > 1).map(g => `
                        <div class="sb-haushalt-eintrag">
                            <div class="sb-haushalt-adr">
                                ${esc(g.personen[0].strasse || "")} ${esc(g.personen[0].hausnummer || "")},
                                ${esc(g.personen[0].plz || "")} ${esc(g.personen[0].ort || "")}
                                <span class="sb-haushalt-name-kombiniert">
                                    → „${esc(sbAnredeFormal(g.personen))},"
                                </span>
                            </div>
                            <div class="sb-haushalt-personen">
                                ${g.personen.map(p =>
                                    `<span class="sb-haushalt-person">${esc(p.vorname)} ${esc(p.nachname)}</span>`
                                ).join(" · ")}
                            </div>
                            <label class="sb-haushalt-toggle">
                                <input type="checkbox"
                                    ${g.getrennt ? "checked" : ""}
                                    onchange="sbHaushaltGetrenntToggle('${g.adressKey.replace(/'/g,"\\'")}', this.checked)">
                                getrennt anschreiben (jede Person einen eigenen Brief)
                            </label>
                        </div>
                    `).join("")}
                </div>
            </details>
        ` : ""}

        ${ohneAdresse.length > 0 ? `
            <details class="sb-haushalts-details">
                <summary>${ohneAdresse.length} Kunde${ohneAdresse.length === 1 ? "" : "n"} ohne Adresse — anzeigen</summary>
                <div class="sb-haushalts-liste">
                    ${ohneAdresse.map(k => `
                        <div class="sb-haushalt-eintrag sb-eintrag-warn">
                            ${esc(k.vorname)} ${esc(k.nachname)}
                            ${k.plz || k.ort ? " (" + esc(k.plz||"") + " " + esc(k.ort||"") + ")" : ""}
                        </div>
                    `).join("")}
                </div>
            </details>
        ` : ""}

        <!-- BLOCK 1: Firma & Kontakt (einmalig, persistent) -->
        <details class="sb-block" ${basisVollstaendig ? "" : "open"}>
            <summary>
                🏢 Firma & Kontakt  ${basisVollstaendig
                    ? '<span class="sb-ok">✓ ausgefüllt</span>'
                    : '<span class="sb-nok">bitte ausfüllen</span>'}
            </summary>
            <div class="sb-block-inhalt">
                <label class="sb-feld-label">Firmenname</label>
                <input type="text" class="crm-input"
                    value="${esc(fd.firma.name)}"
                    oninput="sbFeldGespeichert('${SB_LS_FIRMA_NAME}', this.value); sbBlockHeaderAktualisieren()"
                    placeholder="z. B. Wüstenrot Service-Center">

                <div class="sb-zwei-spalten">
                    <div>
                        <label class="sb-feld-label">Firmen-Straße + Nr.</label>
                        <input type="text" class="crm-input"
                            value="${esc(fd.firma.strasse)}"
                            oninput="sbFeldGespeichert('${SB_LS_FIRMA_STRASSE}', this.value)"
                            placeholder="Musterstraße 1">
                    </div>
                    <div>
                        <label class="sb-feld-label">Firmen-PLZ + Ort</label>
                        <input type="text" class="crm-input"
                            value="${esc(fd.firma.plzOrt)}"
                            oninput="sbFeldGespeichert('${SB_LS_FIRMA_PLZORT}', this.value); sbBlockHeaderAktualisieren()"
                            placeholder="57072 Siegen">
                    </div>
                </div>

                <div class="sb-zwei-spalten">
                    <div>
                        <label class="sb-feld-label">Ansprechpartner (Name)</label>
                        <input type="text" class="crm-input"
                            value="${esc(fd.kontakt.name)}"
                            oninput="sbFeldGespeichert('${SB_LS_KONTAKT_NAME}', this.value); sbBlockHeaderAktualisieren()"
                            placeholder="Vorname Nachname">
                    </div>
                    <div>
                        <label class="sb-feld-label">Funktion</label>
                        <input type="text" class="crm-input"
                            value="${esc(fd.kontakt.funktion)}"
                            oninput="sbFeldGespeichert('${SB_LS_KONTAKT_FUNKTION}', this.value)"
                            placeholder="z. B. Bezirksleiter">
                    </div>
                </div>

                <div class="sb-zwei-spalten">
                    <div>
                        <label class="sb-feld-label">Telefon / WhatsApp</label>
                        <input type="text" class="crm-input"
                            value="${esc(fd.kontakt.tel)}"
                            oninput="sbFeldGespeichert('${SB_LS_KONTAKT_TEL}', this.value); sbBlockHeaderAktualisieren()"
                            placeholder="0271 / 770280">
                    </div>
                    <div>
                        <label class="sb-feld-label">E-Mail</label>
                        <input type="text" class="crm-input"
                            value="${esc(fd.kontakt.email)}"
                            oninput="sbFeldGespeichert('${SB_LS_KONTAKT_EMAIL}', this.value); sbBlockHeaderAktualisieren()"
                            placeholder="name@firma.de">
                    </div>
                </div>

                <label class="sb-feld-label">Website <span class="sb-feld-hinweis">(optional — wird nur gedruckt wenn ausgefüllt)</span></label>
                <input type="text" class="crm-input"
                    value="${esc(fd.kontakt.web)}"
                    oninput="sbFeldGespeichert('${SB_LS_KONTAKT_WEB}', this.value)"
                    placeholder="www.firma.de">

                <label class="sb-feld-label">Öffnungszeiten</label>
                <textarea class="crm-textarea sb-oeffnungszeiten"
                    oninput="sbFeldGespeichert('${SB_LS_OEFFNUNGSZEITEN}', this.value)"
                    placeholder="Mo–Do  9:00–17:00 Uhr&#10;Fr  9:00–13:00 Uhr">${esc(fd.oeffnungszeiten)}</textarea>
            </div>
        </details>

        <!-- BLOCK 2: Pro Kampagne -->
        <details class="sb-block" open>
            <summary>✉️ Dieser Serienbrief</summary>
            <div class="sb-block-inhalt">

                <div class="sb-zwei-spalten">
                    <div>
                        <label class="sb-feld-label">
                            Rückmelde-Frist (Tage ab heute)
                        </label>
                        <input type="number" class="crm-input"
                            min="1" max="365"
                            value="${fd.fristTage}"
                            oninput="sbFeldGespeichert('${SB_LS_FRIST_TAGE}', this.value); sbFristAnzeigeAktualisieren(this.value)">
                        <div class="sb-feld-hinweis-klein">
                            Ergibt im Brief: bis zum <strong id="sbFristAnzeige">${esc(sbFristDatum(fd.fristTage))}</strong>
                        </div>
                    </div>
                    <div>
                        <label class="sb-feld-label">Schriftgröße</label>
                        <select class="crm-input"
                            onchange="sbFeldGespeichert('${SB_LS_SCHRIFT}', this.value)">
                            ${SB_SCHRIFTGROESSEN.map(g =>
                                `<option value="${g}" ${g === schrift ? "selected" : ""}>${g} pt</option>`
                            ).join("")}
                        </select>
                    </div>
                </div>

                <label class="sb-ruckantwort-label">
                    <input type="checkbox"
                        ${fd.rueckantwortAktiv ? "checked" : ""}
                        onchange="sbFeldGespeichert('${SB_LS_RUECKANTWORT}', this.checked ? '1' : '0')">
                    Rückantwort-Abschnitt mitdrucken (zweite Seite)
                </label>

                <label class="sb-feld-label">Betreff <span class="sb-feld-hinweis">(fett über der Anrede)</span></label>
                <input type="text" class="crm-input sb-betreff-input"
                    oninput="sbFeldGespeichert('${SB_LS_BETREFF}', this.value)"
                    value="${esc(betreff)}">

                <label class="sb-feld-label">Brieftext
                    <span class="sb-feld-hinweis">
                        Platzhalter:
                        <code>{anrede_formal}</code>,
                        <code>{kundenwort}</code>,
                        <code>{frist}</code>,
                        <code>{tel}</code>,
                        <code>{email}</code>,
                        <code>{nachname}</code>,
                        <code>{heute}</code>
                    </span>
                </label>
                <textarea class="crm-textarea sb-brieftext"
                    oninput="sbFeldGespeichert('${SB_LS_TEXT}', this.value)">${esc(text)}</textarea>
            </div>
        </details>

        <div class="sb-aktionen">
            <button class="crm-button crm-button-primary"
                onclick="serienbriefErstellen()"
                ${briefeGesamt === 0 ? "disabled" : ""}
                title="${!basisVollstaendig ? "Bitte zuerst Firma & Kontakt vollständig ausfüllen" : ""}">
                📄 ${briefeGesamt} Serienbrief${briefeGesamt === 1 ? "" : "e"} erstellen
            </button>
            <button class="crm-button crm-button-klein"
                onclick="sbVorlageZuruecksetzen()">
                Standard-Brieftext
            </button>
        </div>
    `;
}

function sbFeldGespeichert(schluessel, wert){
    try{ localStorage.setItem(schluessel, wert); }catch(_){}
}

function sbFristAnzeigeAktualisieren(tage){
    const el = document.getElementById("sbFristAnzeige");
    if(!el){ return; }
    el.textContent = sbFristDatum(tage);
}

function sbBlockHeaderAktualisieren(){
    // Nur den OK/NOK-Status im Block-1-Header refreshen,
    // ohne das ganze Panel neu zu bauen (sonst verliert
    // die aktuell editierte Eingabe den Fokus).
    const fd = sbFirmenDatenLaden();
    const headers = document.querySelectorAll("#serienbriefPanel .sb-block > summary");
    if(headers.length === 0){ return; }
    const h = headers[0];
    const ok = sbFirmenDatenVollstaendig(fd);
    h.innerHTML = "🏢 Firma & Kontakt  " +
        (ok ? '<span class="sb-ok">✓ ausgefüllt</span>'
            : '<span class="sb-nok">bitte ausfüllen</span>');
}

function sbVorlageZuruecksetzen(){
    if(!confirm("Brieftext und Betreff auf den Standardtext zurücksetzen? "
        + "Deine eingegebene Version wird überschrieben.")){ return; }
    localStorage.removeItem(SB_LS_TEXT);
    localStorage.removeItem(SB_LS_BETREFF);
    serienbriefPanelRendern();
}

function sbHaushaltGetrenntToggle(adressKey, aktiv){
    const set = sbGetrenntSetLaden();
    if(aktiv){ set.add(adressKey); }
    else{ set.delete(adressKey); }
    sbGetrenntSetSpeichern(set);
    serienbriefPanelRendern();
}

/* =====================================================
   BRIEFE ERZEUGEN + DRUCKVORSCHAU
===================================================== */

function serienbriefErstellen(){
    try{
        _serienbriefErstellenImpl();
    }catch(e){
        if(typeof fehlerMelden === "function"){
            fehlerMelden("Serienbrief",
                "Fehler beim Erstellen der Briefe: " + (e && e.message || e),
                e);
        }
        alert("Beim Erstellen ist ein Fehler aufgetreten. "
            + "Details im Fehler-Log (rotes Ausrufezeichen oben links).");
    }
}

function _serienbriefErstellenImpl(){
    const fd = sbFirmenDatenLaden();
    if(!sbFirmenDatenVollstaendig(fd)){
        const fehlt = [];
        if(!fd.firma.name)    fehlt.push("Firmenname");
        if(!fd.firma.plzOrt)  fehlt.push("Firmen-PLZ+Ort");
        if(!fd.kontakt.name)  fehlt.push("Ansprechpartner");
        if(!fd.kontakt.tel)   fehlt.push("Telefon/WhatsApp");
        if(!fd.kontakt.email) fehlt.push("E-Mail");
        alert('Noch nicht ausgefüllt im Block „Firma & Kontakt":\n\n• '
            + fehlt.join("\n• ")
            + "\n\nBitte den oberen Block ausklappen und ergänzen.");
        return;
    }

    const gespText    = localStorage.getItem(SB_LS_TEXT);
    const gespBetreff = localStorage.getItem(SB_LS_BETREFF);
    const text    = gespText !== null ? gespText : SB_DEFAULT_TEXT;
    const betreff = gespBetreff !== null ? gespBetreff : SB_DEFAULT_BETREFF;

    const gespSchrift = parseInt(localStorage.getItem(SB_LS_SCHRIFT), 10);
    const schriftPt = (SB_SCHRIFTGROESSEN.indexOf(gespSchrift) !== -1)
        ? gespSchrift : SB_DEFAULT_SCHRIFT;

    const rueckSender    = sbRuecksenderZeile(fd);
    const absenderOrt    = sbAbsenderOrt(fd);
    const absenderBlock  = sbAbsenderBlockText(fd);
    const signaturBlock  = sbSignaturText(fd);

    const treffer = (typeof selektionAnwenden === "function")
        ? selektionAnwenden()
        : kunden.filter(k => !k.archiviert);
    const mitAdresse = treffer.filter(sbHatAdresse);
    const gruppen    = sbHaushalteBilden(mitAdresse);

    const sendungen = [];
    gruppen.forEach(g => {
        if(g.getrennt){
            g.personen.forEach(p => sendungen.push({
                personen: [p], adressKey: g.adressKey
            }));
        }else{
            sendungen.push({ personen: g.personen, adressKey: g.adressKey });
        }
    });

    if(sendungen.length === 0){
        alert("Keine Briefe zu erstellen.");
        return;
    }

    const ansicht = document.getElementById("serienbriefDruckansicht");
    if(!ansicht){ return; }

    const heute = new Date().toLocaleDateString("de-DE");

    // Rueckantwort-HTML (direkt im Textfluss, keine neue Seite,
    // genau wie in der Word-Vorlage: Schere → fetter Titel →
    // 2-Spalten (Rueckadresse links, Antwortfelder rechts) →
    // Datenschutz-Hinweis.
    function rueckantwortBlock(){
        if(!fd.rueckantwortAktiv){ return ""; }
        const adrZeilen = [];
        if(fd.firma.name)       adrZeilen.push(fd.firma.name);
        if(fd.kontakt.name)     adrZeilen.push(fd.kontakt.name);
        if(fd.firma.strasse)    adrZeilen.push(fd.firma.strasse);
        if(fd.firma.plzOrt)     adrZeilen.push(fd.firma.plzOrt);
        return `
          <div class="brief-schere">
            ✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          </div>
          <div class="brief-rueck-titel"><strong>Ihre Rückmeldung – bitte ausfüllen und zurücksenden</strong></div>
          <div class="brief-rueck-tabelle">
            <div class="brief-rueck-adresse">
                <div class="brief-rueck-adresse-label">Bitte zurücksenden an:</div>
                ${adrZeilen.map(z => `<div>${esc(z)}</div>`).join("")}
            </div>
            <div class="brief-rueck-felder">
                <div class="brief-rueck-feld">
                    <div class="brief-rueck-feld-label">Meine Telefon-/WhatsApp-Nr.:</div>
                    <div class="brief-rueck-linie"></div>
                </div>
                <div class="brief-rueck-feld">
                    <div class="brief-rueck-feld-label">Meine E-Mail:</div>
                    <div class="brief-rueck-linie"></div>
                </div>
                <div class="brief-rueck-feld">
                    <div class="brief-rueck-feld-label">Erreichbar / Terminwunsch:</div>
                    <div class="brief-rueck-linie"></div>
                </div>
                <div class="brief-rueck-feld">
                    <div class="brief-rueck-feld-label">Name, Datum, Unterschrift:</div>
                    <div class="brief-rueck-linie"></div>
                </div>
            </div>
          </div>
          <div class="brief-datenschutz">
            Hinweis: Ihre Daten werden ausschließlich zur Bearbeitung
            Ihres Anliegens verwendet und nicht an Dritte weitergegeben.
          </div>`;
    }

    const briefeHtml = sendungen.map(s => {
        const p = s.personen[0];

        // Anschriftzeilen mit "Frau"/"Herr" pro Person
        const personenZeilen = s.personen.map(pp => {
            const name = `${esc(pp.vorname||"")} ${esc(pp.nachname||"")}`.trim();
            if(pp.anrede === "Frau" || pp.anrede === "Herr"){
                return esc(pp.anrede) + " " + name;
            }
            return name;
        });
        const anschriftZeilen = [
            ...personenZeilen,
            `${esc(p.strasse||"")} ${esc(p.hausnummer||"")}`.trim(),
            `${esc(p.plz||"")} ${esc(p.ort||"")}`.trim()
        ];

        // Platzhalter einsetzen, dann escapen, dann Markdown-Fett rendern
        const gefuellterText    = sbMarkdownFett(
            esc(sbTextFuellen(text, s.personen, fd))
        );
        const gefuellterBetreff = esc(sbTextFuellen(betreff, s.personen, fd));

        const datumZeile = absenderOrt
            ? esc(absenderOrt) + ", " + heute
            : heute;

        // Signatur mit erster Zeile (Name) fett
        const sigZeilen = signaturBlock.split("\n");
        const sigHtml = sigZeilen.map((z, i) => {
            if(z === ""){ return "<div class='brief-sig-leer'></div>"; }
            // "Mit freundlichen Grüßen" nicht fett, Name fett (2. nicht-leere Zeile)
            // Index 2 ist typischerweise der Name
            if(i === 2){ return `<div><strong>${esc(z)}</strong></div>`; }
            return `<div>${esc(z)}</div>`;
        }).join("");

        return `<div class="brief-seite" style="font-size:${schriftPt}pt;">

            <!-- KOPF: 2-Spalten-Tabelle (links Anschrift, rechts Absender) -->
            <div class="brief-kopf">
                <div class="brief-kopf-links">
                    ${rueckSender
                        ? `<div class="brief-ruecksender">${esc(rueckSender)}</div>`
                        : ""}
                    <div class="brief-anschrift">
                        ${anschriftZeilen.map(z => `<div>${z}</div>`).join("")}
                    </div>
                </div>
                <div class="brief-kopf-rechts">
                    ${absenderBlock
                        ? `<div class="brief-absender-block">${esc(absenderBlock)}</div>`
                        : ""}
                </div>
            </div>

            <!-- Datum rechtsbündig -->
            <div class="brief-datum">${datumZeile}</div>

            <!-- Betreff (fett, kein Wort "Betreff:" davor) -->
            ${gefuellterBetreff.trim()
                ? `<div class="brief-betreff">${gefuellterBetreff}</div>`
                : ""}

            <!-- Anrede ist Teil des Brieftexts (steht als erste Zeile drin
                 — vom User frei formulierbar, Default ist {anrede_formal},) -->
            <div class="brief-inhalt">${gefuellterText}</div>

            <!-- Grußformel + Signatur -->
            <div class="brief-signatur">${sigHtml}</div>

            ${rueckantwortBlock()}

        </div>`;
    }).join("");

    ansicht.innerHTML = `
        <div class="brief-vorschau-header">
            <div>
                <strong>${sendungen.length} Brief${sendungen.length === 1 ? "" : "e"}</strong>
                — bereit zum Drucken oder als PDF speichern.
            </div>
            <div class="brief-vorschau-buttons">
                <button class="crm-button crm-button-primary" onclick="serienbriefDrucken()">
                    🖨 Drucken / als PDF speichern (Strg+P)
                </button>
                <button class="crm-button" onclick="serienbriefSchliessen()">
                    Zurück
                </button>
            </div>
        </div>
        <div class="brief-vorschau-hinweis">
            Tipp: Im Druckdialog „<em>Ziel: Als PDF speichern</em>" wählen,
            damit die Briefe als PDF-Datei landen. Falzmarken am linken
            Rand helfen beim sauberen Falten fürs DIN-Lang-Kuvert.
        </div>
        ${briefeHtml}
    `;
    ansicht.style.display = "block";
    document.body.classList.add("serienbrief-modus");

    window.__sbSendungen = sendungen;
}

function serienbriefDrucken(){
    window.print();
    setTimeout(serienbriefPostAktion, 400);
}

function serienbriefPostAktion(){
    const sendungen = window.__sbSendungen;
    if(!sendungen || sendungen.length === 0){ return; }
    const alleKunden = [];
    sendungen.forEach(s => alleKunden.push(...s.personen));
    const anzahl = alleKunden.length;
    const modal = document.getElementById("serienbriefPostModal");
    if(!modal){ return; }
    const inhalt = document.getElementById("serienbriefPostInhalt");
    inhalt.innerHTML = `
        <p>Serienbrief wurde zum Drucken/Speichern übergeben.
        Was soll bei den <strong>${anzahl}</strong> betroffenen Kunden passieren?</p>

        <label class="sb-post-checkbox">
            <input type="checkbox" id="sbPostTermin" checked>
            Info-Termin „Wichtigbrief versandt" bei jedem Empfänger anlegen
        </label>

        <label class="sb-post-checkbox">
            <input type="checkbox" id="sbPostMarker" checked>
            WB-Marker (Wichtigbrief) bei jedem Empfänger entfernen
        </label>
    `;
    modal.style.display = "flex";
}

function serienbriefPostBestaetigen(){
    const sendungen = window.__sbSendungen;
    if(!sendungen){ serienbriefPostModalSchliessen(); return; }
    const macheTermin = document.getElementById("sbPostTermin").checked;
    const macheMarker = document.getElementById("sbPostMarker").checked;
    const heute = new Date().toISOString().split("T")[0];
    let terminCount = 0;
    let markerCount = 0;
    sendungen.forEach(s => {
        s.personen.forEach(p => {
            const k = findeKunde(p.id);
            if(!k){ return; }
            if(macheTermin){
                if(!Array.isArray(k.termine)){ k.termine = []; }
                k.termine.push({
                    id: neueId(),
                    datum: heute,
                    kategorie: "Info (kein Kontakt)",
                    titel: "Wichtigbrief versandt",
                    zusammenfassung: "Serienbrief wegen fehlender/falscher Kontaktdaten.",
                    wochentag: (function(){
                        try{ return ermittleWochentag(heute); }catch(_){ return ""; }
                    })()
                });
                terminCount++;
            }
            if(macheMarker){
                if(!k.kennzeichen || typeof k.kennzeichen !== "object"){
                    k.kennzeichen = {};
                }
                if(k.kennzeichen.wichtigbrief){
                    k.kennzeichen.wichtigbrief = false;
                    markerCount++;
                }
            }
        });
    });
    if(typeof triggerAutoSave === "function"){ triggerAutoSave(); }
    if(typeof renderKunden === "function"){ renderKunden(); }
    if(typeof kontaktListenAktualisieren === "function"){
        kontaktListenAktualisieren();
    }
    serienbriefPostModalSchliessen();
    serienbriefSchliessen();
    serienbriefPanelRendern();
    alert("Fertig. " +
          (macheTermin ? terminCount + " Info-Termine angelegt. " : "") +
          (macheMarker ? markerCount + " WB-Marker entfernt." : ""));
}

function serienbriefPostAbbrechen(){
    serienbriefPostModalSchliessen();
    serienbriefSchliessen();
}

function serienbriefPostModalSchliessen(){
    const modal = document.getElementById("serienbriefPostModal");
    if(modal){ modal.style.display = "none"; }
}

function serienbriefSchliessen(){
    const ansicht = document.getElementById("serienbriefDruckansicht");
    if(ansicht){
        ansicht.style.display = "none";
        ansicht.innerHTML = "";
    }
    document.body.classList.remove("serienbrief-modus");
    window.__sbSendungen = null;
}

/* =====================================================
   INIT — Panel initial rendern und bei Filter-Aenderung
   automatisch aktualisieren
===================================================== */

if(typeof selektionTrefferAnzeigen === "function"){
    const _origST = selektionTrefferAnzeigen;
    selektionTrefferAnzeigen = function(){
        _origST.apply(this, arguments);
        if(typeof serienbriefPanelRendern === "function"){
            serienbriefPanelRendern();
        }
    };
}
