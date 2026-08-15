function abschlussAnlegen(){

    window.bearbeiteAbschlussId = null;

    document.getElementById("abschlussDatum").value =
        new Date().toISOString().split("T")[0];

    document.getElementById("abschlussVertriebsweg").value = "Kunde";
    document.getElementById("abschlussProdukt").value = "Neuer BSV";
    document.getElementById("abschlussBausparsumme").value = "";
    document.getElementById("abschlussMonatsbeitrag").value = "";
    document.getElementById("abschlussNotiz").value = "";

    window.abschlussAusgewaehlterKunde = null;
    abschlussKundeAnzeigeAktualisieren();

    document.getElementById("abschlussModal").style.display = "flex";
}

/* =====================================================
   KUNDE FÜR ABSCHLUSS SUCHEN & VERKNÜPFEN
===================================================== */

function abschlussKundeSucheAktualisieren(){

    const suche =
    document.getElementById("abschlussKundeSuche")
    .value.trim().toLowerCase();

    const ergebnisContainer =
    document.getElementById("abschlussKundeErgebnisse");

    ergebnisContainer.innerHTML = "";

    if(!suche){ return; }

    const treffer =
    kunden
    .filter(kunde => !kunde.archiviert)
    .filter(kunde => {

        const nameString =
        (kunde.vorname + " " + kunde.nachname).toLowerCase();

        const vertragTreffer =
        (kunde.vertraege || []).some(
            v => (typeof v === "string" ? v : v.nummer || "").toLowerCase().includes(suche)
        );

        return nameString.includes(suche) || vertragTreffer;
    })
    .slice(0, 8);

    treffer.forEach(kunde => {

        const eintrag = document.createElement("div");
        eintrag.className = "kunde-suche-treffer";

        eintrag.innerHTML =
        "<strong>" + esc(kunde.vorname) + " " + esc(kunde.nachname) + "</strong>" +
        (kunde.ort ? " · " + esc(kunde.ort) : "") +
        (kunde.vertraege && kunde.vertraege.length ?
            " · " + esc(kunde.vertraege.map(v => typeof v === "string" ? v : v.nummer).join(", ")) : "");

        eintrag.onclick = function(){
            window.abschlussAusgewaehlterKunde = {
                id: kunde.id,
                name: kunde.vorname + " " + kunde.nachname
            };
            document.getElementById("abschlussKundeSuche").value = "";
            ergebnisContainer.innerHTML = "";
            abschlussKundeAnzeigeAktualisieren();
        };

        ergebnisContainer.appendChild(eintrag);
    });
}

function abschlussKundeEntfernen(){
    window.abschlussAusgewaehlterKunde = null;
    abschlussKundeAnzeigeAktualisieren();
}

function abschlussKundeAnzeigeAktualisieren(){

    const anzeige = document.getElementById("abschlussKundeAusgewaehlt");
    const kunde = window.abschlussAusgewaehlterKunde;

    if(!kunde){
        anzeige.style.display = "none";
        anzeige.innerHTML = "";
        return;
    }

    anzeige.style.display = "flex";
    anzeige.innerHTML =
    "<span>" + esc(kunde.name) + "</span>" +
    '<button type="button" class="crm-button crm-button-klein" ' +
    'onclick="abschlussKundeEntfernen()">Entfernen</button>';
}

/* =====================================================
   ABSCHLUSS MODAL
===================================================== */

function abschlussModalSchliessen(){
    document.getElementById("abschlussModal").style.display = "none";
}

/* =====================================================
   ABSCHLUSS SPEICHERN
===================================================== */

function abschlussSpeichern(){

    const datum = document.getElementById("abschlussDatum").value;
    const vertriebsweg = document.getElementById("abschlussVertriebsweg").value;
    const produkt = document.getElementById("abschlussProdukt").value;
    const bausparsumme = document.getElementById("abschlussBausparsumme").value;
    const monatsbeitrag = document.getElementById("abschlussMonatsbeitrag").value;
    const notiz = document.getElementById("abschlussNotiz").value;

    let kundenId = null;
    let kundenName = "";

    if(window.abschlussAusgewaehlterKunde){
        kundenId = window.abschlussAusgewaehlterKunde.id;
        kundenName = window.abschlussAusgewaehlterKunde.name;
    }

    if(window.bearbeiteAbschlussId){

        const abschluss = abschluesse.find(
            a => a.id === window.bearbeiteAbschlussId
        );

        if(abschluss){
            abschluss.datum = datum;
            abschluss.vertriebsweg = vertriebsweg;
            abschluss.produkt = produkt;
            abschluss.bausparsumme = bausparsumme;
            abschluss.monatsbeitrag = monatsbeitrag;
            abschluss.notiz = notiz;
            abschluss.kundenId = kundenId;
            abschluss.kundenName = kundenName;
        }
    }
    else{
        abschluesse.push({
            id: neueId(),
            datum: datum,
            vertriebsweg: vertriebsweg,
            produkt: produkt,
            bausparsumme: bausparsumme,
            monatsbeitrag: monatsbeitrag,
            kundenId: kundenId,
            kundenName: kundenName,
            notiz: notiz
        });
    }

    window.abschlussAusgewaehlterKunde = null;
    abschlussModalSchliessen();
    renderAbschluesse();
    dashboardAktualisieren();
    triggerAutoSave();
}

/* =====================================================
   ABSCHLUESSE RENDERN
===================================================== */

/* Persistenz für die Zeit-Filter */
const ABSCHLUSS_FILTER_MONAT_KEY = "crmAbschlussFilterMonat";
const ABSCHLUSS_FILTER_JAHR_KEY  = "crmAbschlussFilterJahr";

let abschluesseFilterInitialisiert = false;

function abschluesseFilterWiederherstellen(){
    /* Nur einmal beim ersten Render den gespeicherten Filterwert
       aus localStorage in die Selects übernehmen. */
    if(abschluesseFilterInitialisiert){ return; }
    abschluesseFilterInitialisiert = true;

    const monatSel = document.getElementById("abschlussFilterMonat");
    const jahrSel  = document.getElementById("abschlussFilterJahr");

    if(monatSel){
        const g = localStorage.getItem(ABSCHLUSS_FILTER_MONAT_KEY);
        if(g !== null &&
           Array.from(monatSel.options).some(o => o.value === g)){
            monatSel.value = g;
        }
    }
    if(jahrSel){
        const g = localStorage.getItem(ABSCHLUSS_FILTER_JAHR_KEY);
        /* Für den Jahres-Select wird die value hier "vorgemerkt" —
           die Prüfung passiert nach dem dynamischen Aufbau der Optionen
           in abschluesseJahrOptionenAktualisieren(). */
        if(g !== null){ jahrSel.dataset.gewuenschteAuswahl = g; }
    }
}

function abschluesseFilterSpeichern(){
    const m = document.getElementById("abschlussFilterMonat");
    const j = document.getElementById("abschlussFilterJahr");
    if(m){ localStorage.setItem(ABSCHLUSS_FILTER_MONAT_KEY, m.value); }
    if(j){ localStorage.setItem(ABSCHLUSS_FILTER_JAHR_KEY,  j.value); }
}

function abschluesseJahrOptionenAktualisieren(){

    const select = document.getElementById("abschlussFilterJahr");

    const vorhandeneJahre = new Set(
        abschluesse
        .filter(a => a.datum)
        .map(a => new Date(a.datum).getFullYear())
    );

    const aktuellesJahr = new Date().getFullYear();
    vorhandeneJahre.add(aktuellesJahr);

    /* Aktuellen Wunsch übernehmen: aus DOM (aktueller Wert),
       oder aus dem vorgemerkten localStorage-Wunsch. */
    const ausgewaehlt = select.dataset.gewuenschteAuswahl || select.value;
    delete select.dataset.gewuenschteAuswahl;

    select.innerHTML =
        '<option value="alle">Alle Jahre</option>' +
        '<option value="aktuell">Aktuelles Jahr</option>';

    [...vorhandeneJahre]
    .sort((a,b) => b - a)
    .forEach(jahr => {
        const option = document.createElement("option");
        option.value = jahr;
        option.textContent = jahr;
        select.appendChild(option);
    });

    /* Auswahl wiederherstellen, falls zulässig */
    const zulaessig =
        ausgewaehlt === "alle" ||
        ausgewaehlt === "aktuell" ||
        [...vorhandeneJahre].map(String).includes(ausgewaehlt);

    if(zulaessig){
        select.value = ausgewaehlt;
    }
}

/* Aktives-Filterfeld-Highlight (weinroter Rand + fett).
   Das grüne Highlight für den aktuellen Monat/Jahr entfällt,
   da es jetzt eigene Auswahlpunkte "Aktueller Monat" und
   "Aktuelles Jahr" gibt. */
function abschluesseFilterHighlights(){

    const monatSelect = document.getElementById("abschlussFilterMonat");
    if(monatSelect){
        monatSelect.classList.toggle(
            "filter-select-aktiv",
            monatSelect.value !== "alle"
        );
    }

    const jahrSelect = document.getElementById("abschlussFilterJahr");
    if(jahrSelect){
        jahrSelect.classList.toggle(
            "filter-select-aktiv",
            jahrSelect.value !== "alle"
        );
    }
}

function abschluesseKennzahlenAktualisieren(){

    const heute = new Date();

    /* --- FIX: laufendes Jahr / laufender Monat (unabhängig vom Filter) --- */
    const jahresAbschluesse =
    abschluesse.filter(a =>
        a.datum &&
        new Date(a.datum).getFullYear() === heute.getFullYear()
    );

    const monatsAbschluesse =
    jahresAbschluesse.filter(a =>
        new Date(a.datum).getMonth() === heute.getMonth()
    );

    const abschluesseJahrEl  = document.getElementById("abschluesseJahr");
    const abschluesseMonatEl = document.getElementById("abschluesseMonat");
    if(abschluesseJahrEl){  abschluesseJahrEl.innerText  = jahresAbschluesse.length; }
    if(abschluesseMonatEl){ abschluesseMonatEl.innerText = monatsAbschluesse.length; }

    /* --- BAUSPAR- & FINANZIERUNGSKENNZAHLEN: folgen dem Zeit-Filter ---
       Kategorisierungslogik:
         Bausparabschluss    → Neuer BSV, Erhöhung BSV, Turbodarlehen
                               (Summe = BSS-Feld)
         Finanzierungsabschl.→ Finanzierung, Turbodarlehen
                               (Summe = BSS-Feld, bei Finanzierung
                                dient das BSS-Feld als Finanzierungssumme)
         Turbodarlehen zählt damit in BEIDEN Kategorien (2 Stücke). */

    const filterMonatEl = document.getElementById("abschlussFilterMonat");
    const filterJahrEl  = document.getElementById("abschlussFilterJahr");
    const filterMonatRoh = filterMonatEl ? filterMonatEl.value : "alle";
    const filterJahrRoh  = filterJahrEl  ? filterJahrEl.value  : "alle";

    /* "aktuell" auflösen — der Filter arbeitet dann mit dem Ist-Wert */
    const filterMonat = filterMonatRoh === "aktuell"
        ? String(heute.getMonth())
        : filterMonatRoh;
    const filterJahr  = filterJahrRoh === "aktuell"
        ? String(heute.getFullYear())
        : filterJahrRoh;

    const gefiltert = abschluesse.filter(a => {
        if(!a.datum){ return false; }
        const d = new Date(a.datum);
        if(filterJahr  !== "alle" && d.getFullYear() !== Number(filterJahr)){
            return false;
        }
        if(filterMonat !== "alle" && d.getMonth() !== Number(filterMonat)){
            return false;
        }
        return true;
    });

    function bssZahl(a){
        const n = Number(String(a.bausparsumme || "").replace(",", "."));
        return isNaN(n) ? 0 : n;
    }

    const bausparProdukte = new Set([
        "Neuer BSV", "Erhöhung BSV",
        "Turbo-/Flexdarlehen", "Turbodarlehen"
    ]);
    const finanzierungProdukte = new Set([
        "Finanzierung",
        "Turbo-/Flexdarlehen", "Turbodarlehen"
    ]);

    /* Bausparen: nur wenn Produkt in der Bauspar-Kategorie ist
       UND ein BSS-Betrag > 0 gesetzt wurde. */
    const bausparListe = gefiltert.filter(a =>
        bausparProdukte.has(a.produkt) && bssZahl(a) > 0
    );
    const bausparSumme = bausparListe.reduce((s, a) => s + bssZahl(a), 0);

    /* Finanzierung: nur wenn Produkt in der Finanzierungs-Kategorie ist
       UND ein Betrag > 0 im BSS-Feld gesetzt wurde
       (bei "Finanzierung" ist das BSS-Feld die Finanzierungssumme). */
    const finanzierungListe = gefiltert.filter(a =>
        finanzierungProdukte.has(a.produkt) && bssZahl(a) > 0
    );
    const finanzierungSumme = finanzierungListe.reduce((s, a) => s + bssZahl(a), 0);

    const bAnzahl = document.getElementById("bausparAnzahlJahr");
    const bSumme  = document.getElementById("bausparSummeJahr");
    const fAnzahl = document.getElementById("finanzierungAnzahlJahr");
    const fSumme  = document.getElementById("finanzierungSummeJahr");

    if(bAnzahl){ bAnzahl.innerText = bausparListe.length; }
    if(bSumme) { bSumme.innerText  = bausparSumme.toLocaleString("de-DE") + " €"; }
    if(fAnzahl){ fAnzahl.innerText = finanzierungListe.length; }
    if(fSumme) { fSumme.innerText  = finanzierungSumme.toLocaleString("de-DE") + " €"; }

    /* Zeitraum-Label in allen filterbasierten Kachelüberschriften mitziehen */
    const monatsnamen = ["Januar","Februar","März","April","Mai","Juni",
        "Juli","August","September","Oktober","November","Dezember"];

    let zeitraum;
    if(filterJahr === "alle" && filterMonat === "alle"){
        zeitraum = "gesamt";
    }else if(filterJahr !== "alle" && filterMonat === "alle"){
        zeitraum = filterJahr;
    }else if(filterJahr === "alle" && filterMonat !== "alle"){
        zeitraum = monatsnamen[Number(filterMonat)] + " (alle Jahre)";
    }else{
        zeitraum = monatsnamen[Number(filterMonat)] + " " + filterJahr;
    }

    document.querySelectorAll(".filter-zeitraum")
        .forEach(el => { el.textContent = zeitraum; });
}

function produktIcon(produkt){

    /* Zuordnung Produkt → SVG-Datei im Ordner "abschluesse/"
       Alt-Name "Turbodarlehen" wird als Alias auf dieselbe SVG gemappt,
       damit Bestandsdaten weiter korrekt dargestellt werden. */
    const dateien = {
        "Erhöhung BSV":         "abschluesse/erhoehung-bsv.svg",
        "Neuer BSV":            "abschluesse/neuer-bsv.svg",
        "Genius":               "abschluesse/genius.svg",
        "Krankenversicherung":  "abschluesse/krankenversicherung.svg",
        "Kompositversicherung": "abschluesse/kompositversicherung.svg",
        "Passiv-Produkt":       "abschluesse/passiv-produkt.svg",
        "Privat Kredit":        "abschluesse/privat-kredit.svg",
        "Finanzierung":         "abschluesse/finanzierung.svg",
        "Turbo-/Flexdarlehen":  "abschluesse/turbodarlehen.svg",
        "Turbodarlehen":        "abschluesse/turbodarlehen.svg"
    };

    const pfad = dateien[produkt] || "abschluesse/neuer-bsv.svg";

    return '<img src="' + pfad + '" ' +
           'alt="' + (produkt || "Produkt") + '" ' +
           'class="produkt-icon-svg">';
}

/* Kurze Anzeige für die kompakte Zeile */
function abschlussProduktKurz(produkt){
    const kurz = {
        "Erhöhung BSV":         "Erhöhung",
        "Neuer BSV":            "Neuer BSV",
        "Genius":               "Genius",
        "Krankenversicherung":  "Kranken",
        "Kompositversicherung": "Komposit",
        "Passiv-Produkt":       "Passiv",
        "Privat Kredit":        "Kredit",
        "Finanzierung":         "Finanzierung",
        "Turbo-/Flexdarlehen":  "Turbo/Flex",
        "Turbodarlehen":        "Turbo/Flex"
    };
    return kurz[produkt] || produkt || "-";
}

function euroFormat(wert){
    if(!wert && wert !== 0){ return null; }
    const zahl = Number(String(wert).replace(",", "."));
    if(isNaN(zahl) || zahl === 0){ return null; }
    return zahl.toLocaleString("de-DE") + " €";
}

function abschlussNotizToggle(id){
    const el = document.getElementById("abschluss-notiz-" + id);
    const chevron = document.getElementById("abschluss-notiz-chevron-" + id);
    if(!el){ return; }
    const offen = el.classList.toggle("abschluss-notiz-offen");
    if(chevron){ chevron.textContent = offen ? "▾" : "▸"; }
}

function notizVorschau(text, maxLaenge){
    if(!text){ return ""; }
    const eineZeile = text.replace(/\s+/g, " ").trim();
    if(eineZeile.length <= maxLaenge){ return eineZeile; }
    return eineZeile.slice(0, maxLaenge).trimEnd() + "…";
}

function renderAbschluesse(){

    abschluesseFilterWiederherstellen();

    abschluesseJahrOptionenAktualisieren();
    abschluesseFilterHighlights();
    abschluesseKennzahlenAktualisieren();

    const liste = document.getElementById("abschluesseListe");
    liste.innerHTML = "";

    const filterMonatRoh = document.getElementById("abschlussFilterMonat").value;
    const filterJahrRoh  = document.getElementById("abschlussFilterJahr").value;

    /* "aktuell" wird beim Filtern in den echten Wert aufgelöst */
    const heute = new Date();
    const filterMonat = filterMonatRoh === "aktuell"
        ? String(heute.getMonth())
        : filterMonatRoh;
    const filterJahr  = filterJahrRoh === "aktuell"
        ? String(heute.getFullYear())
        : filterJahrRoh;

    abschluesse
    .filter(abschluss => {

        if(!abschluss.datum){ return true; }

        const datum = new Date(abschluss.datum);

        if(filterJahr !== "alle" &&
           datum.getFullYear() !== Number(filterJahr)){
            return false;
        }

        if(filterMonat !== "alle" &&
           datum.getMonth() !== Number(filterMonat)){
            return false;
        }

        return true;
    })
    /* Chronologisch: neueste zuerst */
    .sort((a,b) => new Date(b.datum) - new Date(a.datum))
    .forEach(abschluss => {

        const div = document.createElement("div");
        div.className = "abschluss-zeile-kompakt";

        const bss = euroFormat(abschluss.bausparsumme);
        const mb  = euroFormat(abschluss.monatsbeitrag);

        const hatNotiz = abschluss.notiz && abschluss.notiz.trim().length > 0;
        const vorschau = notizVorschau(abschluss.notiz, 90);

        /* Kundenzeile darüber (dezent, damit das Raster darunter sauber bleibt) */
        const kundenZeile = abschluss.kundenName
            ? `<div class="abschluss-kunde-zeile">👤 ${esc(abschluss.kundenName)}</div>`
            : `<div class="abschluss-kunde-zeile abschluss-kunde-leer">Kein Kunde verknüpft</div>`;

        /* Notiz-Vorschau-Spalte: klickbar wenn Notiz da, sonst leer */
        const notizSpalte = hatNotiz
            ? `<div class="ab-sp-notizvorschau"
                    onclick="abschlussNotizToggle(${abschluss.id})"
                    title="Notiz ein-/ausblenden">
                    <span class="ab-notiz-chevron" id="abschluss-notiz-chevron-${abschluss.id}">▸</span>
                    <span class="ab-notiz-vorschautext">${esc(vorschau)}</span>
               </div>`
            : `<div class="ab-sp-notizvorschau ab-sp-notizvorschau-leer"></div>`;

        div.innerHTML = `
            ${kundenZeile}
            <div class="abschluss-hauptzeile">

                <span class="ab-sp-icon">
                    ${produktIcon(abschluss.produkt)}
                </span>

                <span class="ab-sp-datum">
                    ${formatDatum(abschluss.datum)}
                </span>

                <span class="ab-sp-produkt">
                    ${esc(abschlussProduktKurz(abschluss.produkt))}
                </span>

                <span class="ab-sp-ort">
                    ${esc(abschluss.vertriebsweg || "—")}
                </span>

                <span class="ab-sp-bss">
                    <span class="ab-wert-label">BSS</span>
                    <span class="ab-wert-zahl">${bss || "—"}</span>
                </span>

                <span class="ab-sp-mb">
                    <span class="ab-wert-label">MB</span>
                    <span class="ab-wert-zahl">${mb || "—"}</span>
                </span>

                ${notizSpalte}

                <button class="crm-icon-button" title="Bearbeiten"
                    onclick="abschlussBearbeiten(${abschluss.id})">✏️</button>

                <button class="crm-icon-button crm-icon-button-gefahr" title="Löschen"
                    onclick="abschlussLoeschen(${abschluss.id})">🗑️</button>

            </div>
            ${hatNotiz ? `
                <div id="abschluss-notiz-${abschluss.id}" class="abschluss-notiz-inhalt">
                    ${esc(abschluss.notiz)}
                </div>
            ` : ""}
        `;

        liste.appendChild(div);
    });

    abschluesseFilterSpeichern();
}

/* =====================================================
   ABSCHLUSS BEARBEITEN
===================================================== */

function abschlussBearbeiten(id){

    const abschluss = abschluesse.find(a => a.id === id);
    if(!abschluss){ return; }

    window.bearbeiteAbschlussId = id;

    document.getElementById("abschlussDatum").value = abschluss.datum;
    document.getElementById("abschlussVertriebsweg").value = abschluss.vertriebsweg;
    document.getElementById("abschlussProdukt").value = abschluss.produkt;
    document.getElementById("abschlussBausparsumme").value = abschluss.bausparsumme || "";
    document.getElementById("abschlussMonatsbeitrag").value = abschluss.monatsbeitrag || "";
    document.getElementById("abschlussNotiz").value = abschluss.notiz || "";

    window.abschlussAusgewaehlterKunde =
    abschluss.kundenId ?
    { id: abschluss.kundenId, name: abschluss.kundenName } :
    null;

    abschlussKundeAnzeigeAktualisieren();

    document.getElementById("abschlussModal").style.display = "flex";
}

/* =====================================================
   ABSCHLUSS LOESCHEN
===================================================== */

function abschlussLoeschen(id){

    if(!confirm("Abschluss löschen?")){ return; }

    abschluesse = abschluesse.filter(a => a.id !== id);

    renderAbschluesse();
    dashboardAktualisieren();
    triggerAutoSave();
}

/* =====================================================
   ABSCHLUSS BUTTON
===================================================== */

document.getElementById("abschlussAnlegenButton")
.addEventListener("click", abschlussAnlegen);
