/* =====================================================
   SELEKTIONEN — Filter-System
===================================================== */

// Aktive Filter der laufenden Session
let selektionFilter = [];

// Aktuell geladene gespeicherte Selektion (Name)
let selektionAktuellerName = null;

/* =====================================================
   FELDDEFINITIONEN
   Zentrale Wahrheit: welche Felder gibt es, welcher Typ,
   welche Operatoren, wie kommt man an den Wert.
===================================================== */

const SELEKTIONS_FELDER = {

    // --- Personen-Felder ---
    alter: {
        label: "Alter",
        typ: "zahl",
        gruppe: "Person",
        wert: kunde => {
            if(!kunde.geburtsdatum){ return null; }
            const g = kunde.geburtsdatum;
            // Format kann sein: "TT.MM.JJJJ" oder ISO
            let jahr, monat, tag;
            if(g.includes(".")){
                const t = g.split(".");
                if(t.length !== 3){ return null; }
                tag = parseInt(t[0],10);
                monat = parseInt(t[1],10) - 1;
                jahr = parseInt(t[2],10);
            }else{
                const d = new Date(g);
                if(isNaN(d)){ return null; }
                jahr = d.getFullYear();
                monat = d.getMonth();
                tag = d.getDate();
            }
            const heute = new Date();
            let a = heute.getFullYear() - jahr;
            if(heute.getMonth() < monat ||
               (heute.getMonth() === monat && heute.getDate() < tag)){
                a--;
            }
            return a;
        }
    },

    ort: {
        label: "Ort",
        typ: "text",
        gruppe: "Person",
        wert: k => k.ort || ""
    },

    plz: {
        label: "PLZ",
        typ: "text",
        gruppe: "Person",
        wert: k => k.plz || ""
    },

    // --- Kennzeichen (Boolean) ---
    keineBeratung: {
        label: "Keine Beratung",
        typ: "boolean",
        gruppe: "Kennzeichen",
        wert: k => !!(k.kennzeichen && k.kennzeichen.keineBeratung)
    },

    nurBuero: {
        label: "Nur Büro",
        typ: "boolean",
        gruppe: "Kennzeichen",
        wert: k => !!(k.kennzeichen && k.kennzeichen.nurBuero)
    },

    nurTelefon: {
        label: "Nur Telefon",
        typ: "boolean",
        gruppe: "Kennzeichen",
        wert: k => !!(k.kennzeichen && k.kennzeichen.nurTelefon)
    },

    nurMail: {
        label: "Nur E-Mail",
        typ: "boolean",
        gruppe: "Kennzeichen",
        wert: k => !!(k.kennzeichen && k.kennzeichen.nurMail)
    },

    bestandVerlassen: {
        label: "Bestand verlassen",
        typ: "boolean",
        gruppe: "Kennzeichen",
        wert: k => !!(k.kennzeichen && k.kennzeichen.bestandVerlassen)
    },

    // --- Aktivität ---
    letzterTerminTage: {
        label: "Letzter Termin (Tage her)",
        typ: "zahl",
        gruppe: "Aktivität",
        wert: k => {
            if(!k.termine || k.termine.length === 0){ return null; }
            const letzter = k.termine
                .slice()
                .sort((a,b) => new Date(b.datum) - new Date(a.datum))[0];
            return tageSeit(letzter.datum);
        }
    },

    anzahlVertraege: {
        label: "Anzahl Verträge",
        typ: "zahl",
        gruppe: "Aktivität",
        wert: k => (k.vertraege || []).length
    },

    // --- Vertragsfelder (matcht wenn EIN Vertrag matcht) ---
    produkt: {
        label: "Produkt (irgendein Vertrag)",
        typ: "text",
        gruppe: "Verträge",
        vertragsFeld: true,
        wert: v => v.produkt || ""
    },

    vertragsnummer: {
        label: "Vertragsnummer",
        typ: "text",
        gruppe: "Verträge",
        vertragsFeld: true,
        wert: v => v.nummer || ""
    },

    bausparsumme: {
        label: "Bausparsumme",
        typ: "zahl",
        gruppe: "Verträge",
        vertragsFeld: true,
        wert: v => zahlParsen(v.bausparsumme)
    },

    saldo: {
        label: "Saldo",
        typ: "zahl",
        gruppe: "Verträge",
        vertragsFeld: true,
        wert: v => zahlParsen(v.saldo)
    },

    guthabenProzent: {
        label: "Guthaben %",
        typ: "zahl",
        gruppe: "Verträge",
        vertragsFeld: true,
        wert: v => zahlParsen(v.guthabenProzent)
    },

    zuteilungsdatum: {
        label: "Zuteilungsdatum",
        typ: "datum",
        gruppe: "Verträge",
        vertragsFeld: true,
        wert: v => v.zuteilungsdatum || ""
    }

};

/* =====================================================
   OPERATOREN je nach Feldtyp
===================================================== */

const SELEKTIONS_OPERATOREN = {
    zahl: [
        { code: "gleich",   label: "gleich" },
        { code: "groesser", label: "größer als" },
        { code: "kleiner",  label: "kleiner als" },
        { code: "zwischen", label: "zwischen (a-b)" },
        { code: "leer",     label: "leer / nicht vorhanden" }
    ],
    text: [
        { code: "enthaelt", label: "enthält" },
        { code: "gleich",   label: "ist gleich" },
        { code: "nicht",    label: "enthält nicht" },
        { code: "leer",     label: "leer" }
    ],
    boolean: [
        { code: "ja",       label: "ist aktiv" },
        { code: "nein",     label: "ist nicht aktiv" }
    ],
    datum: [
        { code: "vor",      label: "vor Datum" },
        { code: "nach",     label: "nach Datum" },
        { code: "leer",     label: "leer" }
    ]
};

/* =====================================================
   HILFSFUNKTIONEN
===================================================== */

function zahlParsen(wert){
    if(wert === null || wert === undefined || wert === ""){ return null; }
    // Deutsches Format: "1.234,56" oder "50,5" oder englisch
    const str = String(wert)
        .replace(/[€\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
    const n = parseFloat(str);
    return isNaN(n) ? null : n;
}

function datumZuIso(datum){
    if(!datum){ return null; }
    if(datum.includes(".")){
        const t = datum.split(".");
        if(t.length !== 3){ return null; }
        return t[2] + "-" +
               t[1].padStart(2,"0") + "-" +
               t[0].padStart(2,"0");
    }
    return datum;
}

/* =====================================================
   FILTER-ENGINE — prüft ob ein Kunde passt
===================================================== */

function selektionKundeMatcht(kunde, filter){

    const feld = SELEKTIONS_FELDER[filter.feldCode];
    if(!feld){ return true; }

    // Vertragsfeld: matcht wenn IRGENDEIN Vertrag matcht
    if(feld.vertragsFeld){
        const vertraege = kunde.vertraege || [];
        if(vertraege.length === 0){
            return filter.operator === "leer";
        }
        return vertraege.some(v => {
            const wert = feld.wert(v);
            return operatorPasst(feld.typ, wert, filter);
        });
    }

    const wert = feld.wert(kunde);
    return operatorPasst(feld.typ, wert, filter);

}

function operatorPasst(typ, wert, filter){

    const op = filter.operator;

    if(op === "leer"){
        return wert === null ||
               wert === "" ||
               wert === undefined;
    }

    if(wert === null || wert === undefined){
        return false;
    }

    if(typ === "zahl"){
        if(wert === ""){ return false; }
        const w = typeof wert === "number" ? wert : parseFloat(wert);
        if(isNaN(w)){ return false; }
        const v1 = parseFloat(filter.wert1);
        if(op === "gleich"){ return w === v1; }
        if(op === "groesser"){ return w > v1; }
        if(op === "kleiner"){ return w < v1; }
        if(op === "zwischen"){
            const v2 = parseFloat(filter.wert2);
            return w >= v1 && w <= v2;
        }
        return false;
    }

    if(typ === "text"){
        const w = String(wert).toLowerCase();
        const v = String(filter.wert1 || "").toLowerCase();
        if(op === "enthaelt"){ return w.includes(v); }
        if(op === "gleich"){ return w === v; }
        if(op === "nicht"){ return !w.includes(v); }
        return false;
    }

    if(typ === "boolean"){
        if(op === "ja"){ return wert === true; }
        if(op === "nein"){ return wert === false; }
        return false;
    }

    if(typ === "datum"){
        const w = datumZuIso(wert);
        const v = filter.wert1;
        if(!w || !v){ return false; }
        if(op === "vor"){ return w < v; }
        if(op === "nach"){ return w > v; }
        return false;
    }

    return false;
}

function selektionAnwenden(){
    return kunden
        .filter(k => !k.archiviert)
        .filter(k =>
            selektionFilter.every(f => selektionKundeMatcht(k, f))
        );
}

/* =====================================================
   UI: FILTER-ZEILEN RENDERN
===================================================== */

function selektionFilterListeRendern(){

    const container =
    document.getElementById("selektionFilterListe");

    if(selektionFilter.length === 0){
        container.innerHTML =
        `<div class="selektion-leer">
            Noch keine Filter — klicke auf "+ Filter hinzufügen".
        </div>`;
        selektionTrefferAnzeigen();
        return;
    }

    // Felder gruppiert
    const gruppen = {};
    Object.keys(SELEKTIONS_FELDER).forEach(code => {
        const f = SELEKTIONS_FELDER[code];
        if(!gruppen[f.gruppe]){ gruppen[f.gruppe] = []; }
        gruppen[f.gruppe].push({ code, label: f.label });
    });

    container.innerHTML = selektionFilter.map((filter, idx) => {

        // Feld-Select mit Gruppen
        const feldSelect =
        `<select class="crm-input selektion-feld"
            onchange="selektionFeldGeaendert(${idx}, this.value)">
            ${Object.keys(gruppen).map(g => `
                <optgroup label="${g}">
                    ${gruppen[g].map(fo =>
                        `<option value="${fo.code}"
                            ${fo.code === filter.feldCode ? "selected" : ""}>
                            ${fo.label}
                        </option>`
                    ).join("")}
                </optgroup>
            `).join("")}
        </select>`;

        // Operator-Select
        const feld = SELEKTIONS_FELDER[filter.feldCode];
        const operatoren = SELEKTIONS_OPERATOREN[feld.typ];

        const opSelect =
        `<select class="crm-input selektion-op"
            onchange="selektionOperatorGeaendert(${idx}, this.value)">
            ${operatoren.map(o =>
                `<option value="${o.code}"
                    ${o.code === filter.operator ? "selected" : ""}>
                    ${o.label}
                </option>`
            ).join("")}
        </select>`;

        // Werte-Eingaben
        let werteHtml = "";
        if(filter.operator === "leer" ||
           filter.operator === "ja" ||
           filter.operator === "nein"){
            werteHtml = "";
        }else if(filter.operator === "zwischen"){
            werteHtml =
            `<input class="crm-input selektion-wert" type="number"
                placeholder="von" value="${filter.wert1 || ""}"
                oninput="selektionWertGeaendert(${idx}, 1, this.value)">
             <input class="crm-input selektion-wert" type="number"
                placeholder="bis" value="${filter.wert2 || ""}"
                oninput="selektionWertGeaendert(${idx}, 2, this.value)">`;
        }else if(feld.typ === "zahl"){
            werteHtml =
            `<input class="crm-input selektion-wert" type="number"
                placeholder="Wert" value="${filter.wert1 || ""}"
                oninput="selektionWertGeaendert(${idx}, 1, this.value)">`;
        }else if(feld.typ === "datum"){
            werteHtml =
            `<input class="crm-input selektion-wert" type="date"
                value="${filter.wert1 || ""}"
                oninput="selektionWertGeaendert(${idx}, 1, this.value)">`;
        }else{
            werteHtml =
            `<input class="crm-input selektion-wert" type="text"
                placeholder="Text" value="${filter.wert1 || ""}"
                oninput="selektionWertGeaendert(${idx}, 1, this.value)">`;
        }

        return `<div class="selektion-filter-zeile">
            ${feldSelect}
            ${opSelect}
            ${werteHtml}
            <button class="eintrag-entfernen"
                onclick="selektionFilterEntfernen(${idx})"
                title="Filter entfernen">×</button>
        </div>`;

    }).join("");

    selektionTrefferAnzeigen();

}

/* =====================================================
   FILTER-AKTIONEN
===================================================== */

function selektionFilterHinzufuegen(){
    selektionFilter.push({
        feldCode: "alter",
        operator: "kleiner",
        wert1: "",
        wert2: ""
    });
    selektionFilterListeRendern();
}

function selektionFilterEntfernen(idx){
    selektionFilter.splice(idx, 1);
    selektionFilterListeRendern();
}

function selektionFeldGeaendert(idx, neuerCode){
    const filter = selektionFilter[idx];
    filter.feldCode = neuerCode;
    // Operator zurücksetzen auf ersten passenden
    const feld = SELEKTIONS_FELDER[neuerCode];
    filter.operator = SELEKTIONS_OPERATOREN[feld.typ][0].code;
    filter.wert1 = "";
    filter.wert2 = "";
    selektionFilterListeRendern();
}

function selektionOperatorGeaendert(idx, neuerOp){
    selektionFilter[idx].operator = neuerOp;
    selektionFilterListeRendern();
}

function selektionWertGeaendert(idx, welche, wert){
    if(welche === 1){
        selektionFilter[idx].wert1 = wert;
    }else{
        selektionFilter[idx].wert2 = wert;
    }
    selektionTrefferAnzeigen();
}

function selektionAlleZuruecksetzen(){
    selektionFilter = [];
    selektionAktuellerName = null;
    document.getElementById("selektionGespeicherteAuswahl").value = "";
    document.getElementById("selektionLoeschenButton").style.display = "none";
    selektionFilterListeRendern();
    document.getElementById("selektionErgebnis").innerHTML = "";
    document.getElementById("selektionExportButton").disabled = true;
}

/* =====================================================
   TREFFER-LIVE-ANZEIGE
===================================================== */

function selektionTrefferAnzeigen(){

    const live = document.getElementById("selektionTrefferLive");
    const exportBtn = document.getElementById("selektionExportButton");

    if(selektionFilter.length === 0){
        live.textContent = "Keine Filter aktiv";
        exportBtn.disabled = true;
        selektionErgebnisRendern([]);
        return;
    }

    const treffer = selektionAnwenden();
    live.textContent =
        `Filter aktiv: ${selektionFilter.length} · ` +
        `Treffer: ${treffer.length}`;

    exportBtn.disabled = treffer.length === 0;
    selektionErgebnisRendern(treffer);

}

/* =====================================================
   TRAFFIC-LISTE RENDERN
===================================================== */

function selektionErgebnisRendern(treffer){

    const container = document.getElementById("selektionErgebnis");

    if(treffer.length === 0){
        container.innerHTML =
            selektionFilter.length === 0
            ? ""
            : `<div class="selektion-leer">
                Keine Treffer für diese Filterkombination.
              </div>`;
        return;
    }

    // Erste 200 zeigen um Performance zu schonen
    const anzeigen = treffer.slice(0, 200);
    const rest = treffer.length - anzeigen.length;

    container.innerHTML = `
        <div class="selektion-treffer-tabelle">
            <div class="selektion-treffer-kopf">
                <span>Name</span>
                <span>Ort</span>
                <span>Alter</span>
                <span>Verträge</span>
                <span>Letzter Termin</span>
            </div>
            ${anzeigen.map(k => {
                const alter = SELEKTIONS_FELDER.alter.wert(k);
                const letzterT = SELEKTIONS_FELDER.letzterTerminTage.wert(k);
                return `<div class="selektion-treffer-zeile"
                    onclick="showTab('kunden');kundeOeffnen(${k.id})">
                    <span><strong>${k.vorname} ${k.nachname}</strong></span>
                    <span>${k.plz || ""} ${k.ort || ""}</span>
                    <span>${alter !== null ? alter + " J" : "-"}</span>
                    <span>${(k.vertraege || []).length}</span>
                    <span>${letzterT !== null ? "vor " + letzterT + " Tagen" : "nie"}</span>
                </div>`;
            }).join("")}
        </div>
        ${rest > 0 ? `<div class="selektion-mehr">
            +${rest} weitere Treffer (nur erste 200 angezeigt).
            Für vollständige Liste bitte exportieren.
        </div>` : ""}
    `;

}

/* =====================================================
   GESPEICHERTE SELEKTIONEN
===================================================== */

function gespeicherteSelektionenLaden(){
    try{
        const roh = localStorage.getItem("crmSelektionen");
        return roh ? JSON.parse(roh) : {};
    }catch(e){
        return {};
    }
}

function gespeicherteSelektionenSpeichern(map){
    localStorage.setItem("crmSelektionen", JSON.stringify(map));
}

function selektionDropdownAktualisieren(){

    const select = document.getElementById("selektionGespeicherteAuswahl");
    if(!select){ return; }

    const gespeichert = gespeicherteSelektionenLaden();
    const namen = Object.keys(gespeichert).sort();

    select.innerHTML =
        '<option value="">Gespeicherte Selektion laden...</option>' +
        namen.map(n =>
            `<option value="${n}" ${n === selektionAktuellerName ? "selected" : ""}>${n}</option>`
        ).join("");

}

function selektionSpeichern(){

    if(selektionFilter.length === 0){
        alert("Keine Filter zum Speichern vorhanden.");
        return;
    }

    const name = prompt(
        "Name für diese Selektion:",
        selektionAktuellerName || ""
    );

    if(!name || !name.trim()){ return; }

    const gespeichert = gespeicherteSelektionenLaden();
    gespeichert[name.trim()] = JSON.parse(JSON.stringify(selektionFilter));
    gespeicherteSelektionenSpeichern(gespeichert);

    selektionAktuellerName = name.trim();
    selektionDropdownAktualisieren();
    document.getElementById("selektionLoeschenButton").style.display = "";

    alert(`Selektion "${name.trim()}" gespeichert.`);

}

function selektionLaden(name){

    if(!name){
        selektionAktuellerName = null;
        document.getElementById("selektionLoeschenButton").style.display = "none";
        return;
    }

    const gespeichert = gespeicherteSelektionenLaden();
    if(!gespeichert[name]){ return; }

    selektionFilter = JSON.parse(JSON.stringify(gespeichert[name]));
    selektionAktuellerName = name;
    document.getElementById("selektionLoeschenButton").style.display = "";
    selektionFilterListeRendern();

}

function selektionLoeschen(){

    if(!selektionAktuellerName){ return; }

    if(!confirm(`Selektion "${selektionAktuellerName}" löschen?`)){
        return;
    }

    const gespeichert = gespeicherteSelektionenLaden();
    delete gespeichert[selektionAktuellerName];
    gespeicherteSelektionenSpeichern(gespeichert);

    selektionAktuellerName = null;
    document.getElementById("selektionGespeicherteAuswahl").value = "";
    document.getElementById("selektionLoeschenButton").style.display = "none";
    selektionDropdownAktualisieren();

}

/* =====================================================
   EXCEL-EXPORT DER TREFFERLISTE
===================================================== */

function selektionExportieren(){

    const treffer = selektionAnwenden();
    if(treffer.length === 0){ return; }

    // Datenmatrix: Kopf + Zeilen (jeder Kunde × jeder Vertrag oder einmal)
    const kopf = [
        "Vorname", "Nachname", "Alter", "Geburtsdatum",
        "Straße", "Hausnummer", "PLZ", "Ort",
        "Telefon", "E-Mail",
        "Vertragsnummer", "Produkt",
        "Bausparsumme", "Saldo", "Guthaben %",
        "Zuteilungsdatum",
        "Letzter Termin",
        "Keine Beratung", "Nur Büro",
        "Nur Telefon", "Nur Mail",
        "Bestand verlassen"
    ];

    const zeilen = [kopf];

    treffer.forEach(k => {

        const alter = SELEKTIONS_FELDER.alter.wert(k);
        const letzterT = k.termine && k.termine.length > 0
            ? formatDatum(k.termine
                .slice()
                .sort((a,b) => new Date(b.datum) - new Date(a.datum))[0].datum)
            : "";

        const basisZeile = [
            k.vorname || "",
            k.nachname || "",
            alter !== null ? alter : "",
            k.geburtsdatum || "",
            k.strasse || "",
            k.hausnummer || "",
            k.plz || "",
            k.ort || "",
            (k.telefone || []).join(", "),
            (k.emails || []).join(", ")
        ];

        const kennzeichenZellen = [
            letzterT,
            k.kennzeichen && k.kennzeichen.keineBeratung ? "ja" : "",
            k.kennzeichen && k.kennzeichen.nurBuero ? "ja" : "",
            k.kennzeichen && k.kennzeichen.nurTelefon ? "ja" : "",
            k.kennzeichen && k.kennzeichen.nurMail ? "ja" : "",
            k.kennzeichen && k.kennzeichen.bestandVerlassen ? "ja" : ""
        ];

        const vertraege = k.vertraege || [];

        if(vertraege.length === 0){
            zeilen.push([
                ...basisZeile,
                "", "", "", "", "", "",
                ...kennzeichenZellen
            ]);
        }else{
            vertraege.forEach(v => {
                zeilen.push([
                    ...basisZeile,
                    v.nummer || "",
                    v.produkt || "",
                    v.bausparsumme || "",
                    v.saldo || "",
                    v.guthabenProzent || "",
                    v.zuteilungsdatum || "",
                    ...kennzeichenZellen
                ]);
            });
        }

    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(zeilen);

    // Spaltenbreiten
    ws["!cols"] = kopf.map(h => ({ wch: Math.max(12, h.length + 2) }));

    XLSX.utils.book_append_sheet(wb, ws, "Selektion");

    const jetzt = new Date().toISOString().split("T")[0];

    let basisname = selektionAktuellerName;

    if(!basisname){
        basisname = prompt(
            "Name für diese Kampagne (wird zum Dateinamen):",
            "Selektion"
        );
        if(!basisname || !basisname.trim()){
            return;
        }
        basisname = basisname.trim();
    }

    const sauber = basisname
        .replace(/[^a-zA-Z0-9äöüÄÖÜß_ -]/g, "_")
        .replace(/\s+/g, "_");

    const dateiname = sauber + "_" + jetzt + ".xlsx";

    XLSX.writeFile(wb, dateiname);

}

/* =====================================================
   INITIALISIERUNG bei Tab-Wechsel
===================================================== */

function selektionenInitialisieren(){
    selektionDropdownAktualisieren();
    selektionFilterListeRendern();
}
