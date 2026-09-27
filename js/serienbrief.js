/* =====================================================
   SERIENBRIEF — Wichtigbriefe drucken
   -----------------------------------------------------
   Nimmt die aktuelle Selektions-Trefferliste, gruppiert
   sie nach identischer Anschrift zu Haushalten, erzeugt
   pro Haushalt einen Brief und zeigt eine Druckvorschau
   fuer "Strg+P → als PDF speichern".

   Persistierung:
     - Brieftext + Signatur in localStorage
     - Getrennt-anschreiben-Overrides pro Haushalt in
       localStorage (Adress-Key)
===================================================== */

const SB_LS_TEXT         = "crmSerienbriefText";
const SB_LS_SIGNATUR     = "crmSerienbriefSignatur";
const SB_LS_ABSENDER     = "crmSerienbriefAbsender";
const SB_LS_BETREFF      = "crmSerienbriefBetreff";
const SB_LS_SCHRIFT      = "crmSerienbriefSchriftgroesse";
const SB_LS_GETRENNT     = "crmSerienbriefGetrennt"; // Set von Adress-Keys

const SB_SCHRIFTGROESSEN = [9, 10, 11, 12, 13, 14];
const SB_DEFAULT_SCHRIFT = 11;

const SB_DEFAULT_TEXT = "{anrede_formal},\n\n"
    + "in unseren Unterlagen sind Ihre Kontaktdaten leider "
    + "nicht mehr aktuell.\n\n"
    + "Bitte melden Sie sich kurz bei mir, damit ich Sie "
    + "wieder erreichen kann.\n\n"
    + "Vielen Dank.";

/* =====================================================
   ADRESS-KEY / HAUSHALTS-GRUPPIERUNG
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
    // Gibt Array von { adressKey, personen[], getrennt } zurueck.
    // Wenn getrennt=true: die Personen bekommen JEWEILS einen eigenen
    // Brief (also ein Sub-Array pro Person).
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
   ANREDE-KOMBINATOR
   -----------------------------------------------------
   Einzeln           → "Max Müller"
   Ehepaar (=Name)   → "Max und Petra Müller"
   Familie (=Name)   → "Max, Petra und Lisa Müller"
   Gemischte Namen   → "Max Müller, Petra Müller und Lisa Schmidt"
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
   PLATZHALTER EINSETZEN
===================================================== */

function sbTextFuellen(vorlage, personen){
    const first = personen[0];
    const heute = new Date().toLocaleDateString("de-DE");
    const map = {
        "{anrede_kombiniert}": sbAnredeKombiniert(personen),
        "{anrede_formal}":     sbAnredeFormal(personen),
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
   FORMELLE ANREDE
   -----------------------------------------------------
   Einzeln  Frau:  "Sehr geehrte Frau Müller"
   Einzeln  Herr:  "Sehr geehrter Herr Meier"
   Divers/leer:    "Sehr geehrte/r <Vorname Nachname>" (Notloesung)
   Haushalt Frau + Herr:
      "Sehr geehrte Frau Müller, sehr geehrter Herr Müller"
   Haushalt alle Frauen:
      "Sehr geehrte Frau Müller und Frau Schmidt"
   Haushalt alle Herren:
      "Sehr geehrter Herr Müller und Herr Schmidt"
   Wenn eine Anrede in der Gruppe fehlt:
      "Sehr geehrte Damen und Herren"
===================================================== */

function sbAnredeFormal(personen){
    if(personen.length === 0){ return "Sehr geehrte Damen und Herren"; }

    // Wenn irgendwer keine Anrede hat: Sammelanrede
    const alleHabenAnrede = personen.every(
        p => p.anrede === "Frau" || p.anrede === "Herr"
    );
    if(!alleHabenAnrede){
        return "Sehr geehrte Damen und Herren";
    }

    function personTeil(p){
        const nn = String(p.nachname||"").trim();
        if(p.anrede === "Frau"){ return "Frau " + nn; }
        return "Herr " + nn;
    }

    // Einzelperson
    if(personen.length === 1){
        const p = personen[0];
        const nn = String(p.nachname||"").trim();
        if(p.anrede === "Frau"){ return "Sehr geehrte Frau " + nn; }
        return "Sehr geehrter Herr " + nn;
    }

    // Haushalt: pruefe ob alle gleiches Geschlecht
    const nurFrauen = personen.every(p => p.anrede === "Frau");
    const nurHerren = personen.every(p => p.anrede === "Herr");

    if(nurFrauen || nurHerren){
        const nachnamenTeile = personen.map(p =>
            (nurFrauen ? "Frau " : "Herr ") + String(p.nachname||"").trim()
        );
        const einleitung = nurFrauen ? "Sehr geehrte " : "Sehr geehrter ";
        // "Frau Müller und Frau Schmidt"  oder
        // "Frau Müller, Frau Schmidt und Frau Weber"
        let liste;
        if(nachnamenTeile.length === 2){
            liste = nachnamenTeile.join(" und ");
        }else{
            liste = nachnamenTeile.slice(0, -1).join(", ") + " und " +
                    nachnamenTeile[nachnamenTeile.length - 1];
        }
        return einleitung + liste;
    }

    // Gemischtes Geschlecht: "Sehr geehrte Frau X, sehr geehrter Herr Y"
    const stuecke = personen.map(p => {
        const nn = String(p.nachname||"").trim();
        if(p.anrede === "Frau"){ return "Sehr geehrte Frau " + nn; }
        return "sehr geehrter Herr " + nn;
    });
    // Erste Stueck mit Grossbuchstabe, folgende klein
    stuecke[0] = stuecke[0].charAt(0).toUpperCase() + stuecke[0].slice(1);
    for(let i = 1; i < stuecke.length; i++){
        stuecke[i] = stuecke[i].charAt(0).toLowerCase() + stuecke[i].slice(1);
    }
    return stuecke.join(", ");
}

/* =====================================================
   ABSENDER-ORT (fuer die Datumszeile)
   -----------------------------------------------------
   DIN 5008: Datumszeile = "<Absender-Ort>, DD.MM.YYYY".
   Ableitung: erste Zeile im Absender-Feld, die mit einer
   5-stelligen PLZ beginnt → Text nach der PLZ = Ort.
===================================================== */

function sbAbsenderOrt(absenderText){
    const zeilen = String(absenderText||"")
        .split("\n")
        .map(z => z.trim())
        .filter(z => z);
    for(const z of zeilen){
        const m = z.match(/^\d{5}\s+(.+)$/);
        if(m){ return m[1].trim(); }
    }
    return "";
}

/* =====================================================
   RUECKSENDER-ZEILE AUS ABSENDER-BLOCK
   -----------------------------------------------------
   Heuristik: nimmt Zeile 1 als Name; sucht die Zeile,
   die mit einer 5-stelligen PLZ beginnt (PLZ Ort); und
   die Zeile direkt davor (Strasse). Ergebnis wird als
   "Name, Strasse, PLZ Ort" komma-getrennt zurueckgegeben.
   Diese Zeile steht klein und unterstrichen ueber dem
   Anschriftfeld (DIN-Rueckadresse fuer Sichtfenster).
===================================================== */

function sbRuecksenderZeile(absenderText){
    const zeilen = String(absenderText||"")
        .split("\n")
        .map(z => z.trim())
        .filter(z => z);
    if(zeilen.length === 0){ return ""; }
    const name = zeilen[0];
    const plzIdx = zeilen.findIndex(z => /^\d{5}\s/.test(z));
    if(plzIdx === -1 || plzIdx === 0){
        return name;
    }
    const plzOrt  = zeilen[plzIdx];
    const strasse = zeilen[plzIdx - 1];
    const teile = [name];
    if(strasse && strasse !== name){ teile.push(strasse); }
    teile.push(plzOrt);
    return teile.join(", ");
}

/* =====================================================
   KLAPP-PANEL RENDERN
===================================================== */

function serienbriefPanelRendern(){
    const container = document.getElementById("serienbriefPanel");
    if(!container){ return; }

    // Trefferliste aus der aktuellen Selektion (oder alle
    // aktiven Kunden wenn keine Filter gesetzt sind)
    const treffer = (typeof selektionAnwenden === "function")
        ? selektionAnwenden()
        : kunden.filter(k => !k.archiviert);

    const mitAdresse   = treffer.filter(sbHatAdresse);
    const ohneAdresse  = treffer.filter(k => !sbHatAdresse(k));
    const gruppen      = sbHaushalteBilden(mitAdresse);

    // Anzahl Briefe: pro Gruppe entweder 1 (zusammen) oder N (getrennt)
    let briefeGesamt = 0;
    gruppen.forEach(g => {
        briefeGesamt += g.getrennt ? g.personen.length : 1;
    });
    const haushalteZusammen = gruppen.filter(
        g => g.personen.length > 1 && !g.getrennt
    ).length;

    // Persistente Werte laden
    const gespText     = localStorage.getItem(SB_LS_TEXT);
    const gespSig      = localStorage.getItem(SB_LS_SIGNATUR);
    const gespAbsender = localStorage.getItem(SB_LS_ABSENDER);
    const gespBetreff  = localStorage.getItem(SB_LS_BETREFF);
    const gespSchrift  = parseInt(localStorage.getItem(SB_LS_SCHRIFT), 10);
    const text     = gespText !== null ? gespText : SB_DEFAULT_TEXT;
    const signatur = gespSig !== null ? gespSig : "";
    const absender = gespAbsender !== null ? gespAbsender : "";
    const betreff  = gespBetreff !== null ? gespBetreff : "";
    const schrift  = (SB_SCHRIFTGROESSEN.indexOf(gespSchrift) !== -1)
        ? gespSchrift
        : SB_DEFAULT_SCHRIFT;

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
                                    → „Hallo ${esc(sbAnredeKombiniert(g.personen))},"
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

        <div class="sb-optionen-zeile">
            <label class="sb-optionen-label">
                Schriftgröße:
                <select id="sbSchriftgroesse" class="crm-input sb-schrift-select"
                    onchange="sbFeldGespeichert('${SB_LS_SCHRIFT}', this.value)">
                    ${SB_SCHRIFTGROESSEN.map(g =>
                        `<option value="${g}" ${g === schrift ? "selected" : ""}>${g} pt</option>`
                    ).join("")}
                </select>
            </label>
        </div>

        <label class="sb-feld-label">
            Absender <span class="sb-feld-hinweis">(Kopf oben rechts — die kleine Rücksenderzeile über der Anschrift wird automatisch daraus abgeleitet)</span>
        </label>
        <textarea id="sbAbsender" class="crm-textarea sb-absender"
            oninput="sbFeldGespeichert('${SB_LS_ABSENDER}', this.value); sbRuecksenderVorschauAktualisieren()"
            placeholder="Vorname Nachname&#10;Berufsbezeichnung&#10;Firma&#10;Straße Hausnummer&#10;PLZ Ort&#10;Telefon    …&#10;E-Mail     …">${esc(absender)}</textarea>
        <div class="sb-ruecksender-vorschau">
            Rücksenderzeile: <span id="sbRuecksenderVorschau">${esc(sbRuecksenderZeile(absender) || "(noch leer — bitte Absender ausfüllen)")}</span>
        </div>

        <label class="sb-feld-label">Betreff <span class="sb-feld-hinweis">(erscheint fett über der Anrede)</span></label>
        <input type="text" id="sbBetreff" class="crm-input sb-betreff-input"
            oninput="sbFeldGespeichert('${SB_LS_BETREFF}', this.value)"
            placeholder="z. B. Wichtige Mitteilung — bitte Kontaktdaten aktualisieren"
            value="${esc(betreff)}">

        <label class="sb-feld-label">Brieftext (Platzhalter: <code>{anrede_formal}</code>, <code>{anrede_kombiniert}</code>, <code>{vorname}</code>, <code>{nachname}</code>, <code>{ort}</code>, <code>{heute}</code>)</label>
        <textarea id="sbBrieftext" class="crm-textarea sb-brieftext"
            oninput="sbFeldGespeichert('${SB_LS_TEXT}', this.value)"
            placeholder="Hallo {anrede_kombiniert},&#10;&#10;dein Brieftext …">${esc(text)}</textarea>

        <label class="sb-feld-label">Signatur</label>
        <textarea id="sbSignatur" class="crm-textarea sb-signatur"
            oninput="sbFeldGespeichert('${SB_LS_SIGNATUR}', this.value)"
            placeholder="Mit freundlichen Grüßen&#10;Dein Name&#10;Straße · PLZ Ort · Telefon · E-Mail">${esc(signatur)}</textarea>

        <div class="sb-aktionen">
            <button class="crm-button crm-button-primary"
                onclick="serienbriefErstellen()"
                ${briefeGesamt === 0 ? "disabled" : ""}>
                📄 ${briefeGesamt} Serienbrief${briefeGesamt === 1 ? "" : "e"} erstellen
            </button>
            <button class="crm-button crm-button-klein"
                onclick="sbVorlageZuruecksetzen()"
                title="Brieftext auf den Standardtext zuruecksetzen">
                Standardtext
            </button>
        </div>
    `;
}

function sbFeldGespeichert(schluessel, wert){
    try{ localStorage.setItem(schluessel, wert); }catch(_){}
}

function sbRuecksenderVorschauAktualisieren(){
    const ta   = document.getElementById("sbAbsender");
    const ziel = document.getElementById("sbRuecksenderVorschau");
    if(!ta || !ziel){ return; }
    const zeile = sbRuecksenderZeile(ta.value);
    ziel.textContent = zeile || "(noch leer — bitte Absender ausfüllen)";
}

function sbVorlageZuruecksetzen(){
    if(!confirm("Brieftext auf den Standardtext zurücksetzen? "
        + "Deine eingegebene Version wird überschrieben.")){ return; }
    localStorage.removeItem(SB_LS_TEXT);
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
    const text     = document.getElementById("sbBrieftext").value;
    const signatur = document.getElementById("sbSignatur").value;
    const absender = document.getElementById("sbAbsender").value;
    const betreff  = document.getElementById("sbBetreff").value;
    const schriftSel = document.getElementById("sbSchriftgroesse");
    const schrift  = schriftSel ? parseInt(schriftSel.value, 10) : SB_DEFAULT_SCHRIFT;
    const schriftPt = (SB_SCHRIFTGROESSEN.indexOf(schrift) !== -1)
        ? schrift : SB_DEFAULT_SCHRIFT;
    const rueckSender = sbRuecksenderZeile(absender);
    const absenderOrt = sbAbsenderOrt(absender);

    const treffer = (typeof selektionAnwenden === "function")
        ? selektionAnwenden()
        : kunden.filter(k => !k.archiviert);
    const mitAdresse = treffer.filter(sbHatAdresse);
    const gruppen    = sbHaushalteBilden(mitAdresse);

    // Zu Sendungen aufloesen — getrennte Haushalte werden zu
    // Einzel-Sendungen zerlegt.
    const sendungen = [];
    gruppen.forEach(g => {
        if(g.getrennt){
            g.personen.forEach(p => sendungen.push({
                personen: [p],
                adressKey: g.adressKey
            }));
        }else{
            sendungen.push({ personen: g.personen, adressKey: g.adressKey });
        }
    });

    if(sendungen.length === 0){
        alert("Keine Briefe zu erstellen.");
        return;
    }

    // Vorschau aufbauen
    const ansicht = document.getElementById("serienbriefDruckansicht");
    if(!ansicht){ return; }

    const heute = new Date().toLocaleDateString("de-DE");

    const briefeHtml = sendungen.map(s => {
        const p = s.personen[0];

        // Anschriftzeilen mit "Frau"/"Herr" pro Person (DIN 5008).
        // Wenn keine Anrede: nur Vorname + Nachname.
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

        const gefuellterText    = sbTextFuellen(text, s.personen);
        const gefuellterBetreff = sbTextFuellen(betreff, s.personen);

        // DIN-5008-Datumszeile: Absender-Ort statt Empfaenger-Ort
        const datumZeile = absenderOrt
            ? esc(absenderOrt) + ", " + heute
            : heute;

        return `<div class="brief-seite" style="font-size:${schriftPt}pt;">
            <div class="brief-falzmarke brief-falzmarke-oben"></div>
            <div class="brief-falzmarke brief-falzmarke-unten"></div>

            ${absender.trim()
                ? `<div class="brief-absender-block">${esc(absender)}</div>`
                : ""}

            ${rueckSender
                ? `<div class="brief-absender-klein">${esc(rueckSender)}</div>`
                : ""}

            <div class="brief-anschrift">
                ${anschriftZeilen.map(z => `<div>${z}</div>`).join("")}
            </div>

            <div class="brief-datum">${datumZeile}</div>

            ${gefuellterBetreff.trim()
                ? `<div class="brief-betreff">${esc(gefuellterBetreff)}</div>`
                : ""}

            <div class="brief-inhalt">${esc(gefuellterText)}</div>

            <div class="brief-signatur">${esc(signatur)}</div>
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

    // Sendungen fuer die spaetere Post-Aktion merken
    window.__sbSendungen = sendungen;
}

function serienbriefDrucken(){
    window.print();
    // Nach dem Druckdialog: Rueckfrage
    setTimeout(serienbriefPostAktion, 400);
}

function serienbriefPostAktion(){
    const sendungen = window.__sbSendungen;
    if(!sendungen || sendungen.length === 0){ return; }

    const alleKunden = [];
    sendungen.forEach(s => alleKunden.push(...s.personen));
    const anzahl = alleKunden.length;

    // Rueckfrage mit den beiden Optionen
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

// Hook: wenn selektionTrefferAnzeigen bereits definiert ist, erweitern
if(typeof selektionTrefferAnzeigen === "function"){
    const _origST = selektionTrefferAnzeigen;
    selektionTrefferAnzeigen = function(){
        _origST.apply(this, arguments);
        if(typeof serienbriefPanelRendern === "function"){
            serienbriefPanelRendern();
        }
    };
}
