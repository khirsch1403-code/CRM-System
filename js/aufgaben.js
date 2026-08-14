function aufgabeAnlegen(){

    document.getElementById("aufgabeTitel").value = "";
    document.getElementById("aufgabeBeschreibung").value = "";
    document.getElementById("aufgabePrioritaet").value = "Mittel";
    document.getElementById("aufgabeFaelligkeit").value = "";

    window.aufgabeAusgewaehlterKunde = null;
    aufgabeKundeAnzeigeAktualisieren();

    document.getElementById("aufgabeModal").style.display = "flex";
}

/* =====================================================
   KUNDE FÜR AUFGABE SUCHEN & VERKNÜPFEN
===================================================== */

function aufgabeKundeSucheAktualisieren(){

    const suche =
    document.getElementById("aufgabeKundeSuche")
    .value.trim().toLowerCase();

    const ergebnisContainer =
    document.getElementById("aufgabeKundeErgebnisse");

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
        "<strong>" + kunde.vorname + " " + kunde.nachname + "</strong>" +
        (kunde.ort ? " · " + kunde.ort : "") +
        (kunde.vertraege && kunde.vertraege.length ?
            " · " + kunde.vertraege.map(v => typeof v === "string" ? v : v.nummer).join(", ") : "");

        eintrag.onclick = function(){
            window.aufgabeAusgewaehlterKunde = {
                id: kunde.id,
                name: kunde.vorname + " " + kunde.nachname
            };
            document.getElementById("aufgabeKundeSuche").value = "";
            ergebnisContainer.innerHTML = "";
            aufgabeKundeAnzeigeAktualisieren();
        };

        ergebnisContainer.appendChild(eintrag);
    });
}

function aufgabeKundeEntfernen(){
    window.aufgabeAusgewaehlterKunde = null;
    aufgabeKundeAnzeigeAktualisieren();
}

function aufgabeKundeAnzeigeAktualisieren(){

    const anzeige = document.getElementById("aufgabeKundeAusgewaehlt");
    const kunde = window.aufgabeAusgewaehlterKunde;

    if(!kunde){
        anzeige.style.display = "none";
        anzeige.innerHTML = "";
        return;
    }

    anzeige.style.display = "flex";
    anzeige.innerHTML =
    "<span>" + kunde.name + "</span>" +
    '<button type="button" class="crm-button crm-button-klein" ' +
    'onclick="aufgabeKundeEntfernen()">Entfernen</button>';
}

/* =====================================================
   AUFGABEN MODAL SCHLIESSEN
===================================================== */

function aufgabeModalSchliessen(){
    document.getElementById("aufgabeModal").style.display = "none";
}

/* =====================================================
   AUFGABE SPEICHERN
===================================================== */

function aufgabeSpeichern(){

    const titel = document.getElementById("aufgabeTitel").value.trim();

    if(!titel){
        alert("Bitte Titel eingeben");
        return;
    }

    const beschreibung = document.getElementById("aufgabeBeschreibung").value;
    const prioritaet   = document.getElementById("aufgabePrioritaet").value;
    const faelligkeit  = document.getElementById("aufgabeFaelligkeit").value;

    if(window.bearbeiteAufgabeId){

        const aufgabe = aufgaben.find(a => a.id === window.bearbeiteAufgabeId);

        if(aufgabe){
            aufgabe.titel = titel;
            aufgabe.beschreibung = beschreibung;
            aufgabe.prioritaet = prioritaet;
            aufgabe.faelligkeit = faelligkeit;
            aufgabe.kundenId =
            window.aufgabeAusgewaehlterKunde ?
            window.aufgabeAusgewaehlterKunde.id : null;
            aufgabe.kundenName =
            window.aufgabeAusgewaehlterKunde ?
            window.aufgabeAusgewaehlterKunde.name : "";
        }

        window.bearbeiteAufgabeId = null;
    }
    else{
        aufgaben.push({
            id: neueId(),
            titel: titel,
            beschreibung: beschreibung,
            prioritaet: prioritaet,
            faelligkeit: faelligkeit,
            kundenId:
            window.aufgabeAusgewaehlterKunde ?
            window.aufgabeAusgewaehlterKunde.id : null,
            kundenName:
            window.aufgabeAusgewaehlterKunde ?
            window.aufgabeAusgewaehlterKunde.name : "",
            status:"Offen"
        });
    }

    window.aufgabeAusgewaehlterKunde = null;
    aufgabeModalSchliessen();

    renderAufgaben();
    dashboardAktualisieren();
    triggerAutoSave();
}

/* =====================================================
   AUFGABEN RENDERN
===================================================== */

function kundeAusAufgabeOeffnen(id){
    showTab("kunden");
    kundeOeffnen(id);
}

function prioritaetRang(prioritaet){
    const rang = {
        "Sofort": 0,
        "Hoch": 1,
        "Mittel": 2,
        "Niedrig": 3
    };
    return rang[prioritaet] !== undefined ? rang[prioritaet] : 99;
}

function prioritaetFarbe(prioritaet){
    const farben = {
        "Sofort": "#dc3545",
        "Hoch": "#fd7e14",
        "Mittel": "#ffc107",
        "Niedrig": "#6c757d"
    };
    return farben[prioritaet] || "#6c757d";
}

/* Kurzform für kompaktes Prio-Badge */
function prioritaetKurz(prioritaet){
    const kurz = {
        "Sofort":  "SOFORT",
        "Hoch":    "HOCH",
        "Mittel":  "MITTEL",
        "Niedrig": "NIEDRIG"
    };
    return kurz[prioritaet] || prioritaet || "";
}

/* Sortierschlüssel für Fälligkeit
   - Überfällige zuerst (kleinstes/ältestes Datum)
   - Ohne Datum ganz nach unten
   - Bei Gleichstand: Priorität */
function faelligkeitSortKey(aufgabe){
    if(!aufgabe.faelligkeit){
        return Number.MAX_SAFE_INTEGER;
    }
    return new Date(aufgabe.faelligkeit).getTime();
}

function renderAufgaben(){

    document.getElementById("offen")
    .innerHTML = "<h3>Offen</h3><div class='kanban-spalte-inhalt' id='offen-inhalt'></div>";

    document.getElementById("inBearbeitung")
    .innerHTML = "<h3>In Bearbeitung</h3><div class='kanban-spalte-inhalt' id='inBearbeitung-inhalt'></div>";

    document.getElementById("wartetAufKunde")
    .innerHTML = "<h3>Wartet auf Kunde</h3><div class='kanban-spalte-inhalt' id='wartetAufKunde-inhalt'></div>";

    document.getElementById("erledigt")
    .innerHTML = "<h3>Erledigt</h3><div class='kanban-spalte-inhalt' id='erledigt-inhalt'></div>";

    /* Sortierung: Fälligkeit aufsteigend (früheste/überfälligste zuerst),
       ohne Datum ans Ende, Tiebreak Priorität */
    const sortierteAufgaben = [...aufgaben].sort((a, b) => {
        const sa = faelligkeitSortKey(a);
        const sb = faelligkeitSortKey(b);
        if(sa !== sb){ return sa - sb; }
        return prioritaetRang(a.prioritaet) - prioritaetRang(b.prioritaet);
    });

    sortierteAufgaben.forEach(aufgabe => {

        const karte = document.createElement("div");
        karte.className = "kanban-karte kanban-karte-kompakt";
        karte.draggable = true;
        karte.dataset.id = aufgabe.id;

        karte.style.borderLeft =
        "3px solid " + prioritaetFarbe(aufgabe.prioritaet);

        const ueberfaellig = istUeberfaellig(aufgabe);
        const prioFarbe = prioritaetFarbe(aufgabe.prioritaet);

        /* Sirene: nur bei überfälligen Aufgaben im Status "Offen".
           In "In Bearbeitung", "Wartet auf Kunde" und "Erledigt" bleibt
           die übliche rote Datumsschrift, aber der pulsierende Rahmen
           erscheint dort nicht. */
        if(ueberfaellig && aufgabe.status === "Offen"){
            karte.classList.add("aufgabe-sirene");
        }

        karte.innerHTML = `
            <div class="ak-zeile-1">
                <strong class="ak-titel ${ueberfaellig ? "aufgaben-titel-ueberfaellig" : ""}">${aufgabe.titel}</strong>
                ${aufgabe.faelligkeit ? `
                <span class="ak-faellig ${ueberfaellig ? "ak-faellig-ueberfaellig" : ""}">
                    ${formatDatum(aufgabe.faelligkeit)}
                </span>` : ""}
            </div>
            <div class="ak-zeile-2">
                <span class="ak-prio-badge" style="background:${prioFarbe};">${prioritaetKurz(aufgabe.prioritaet)}</span>
                ${aufgabe.kundenName ? `<span class="ak-kunde">👤 ${aufgabe.kundenName}</span>` : ""}
            </div>
            ${aufgabe.status === "Erledigt" && aufgabe.erledigtAm ? `
                <div class="aufgaben-loeschcountdown">
                    Löschen in ${Math.max(0, 30 - tageSeit(aufgabe.erledigtAm))} Tagen
                </div>
            ` : ""}
            ${aufgabe.beschreibung ? `
                <details class="klapp-panel klapp-panel-mini">
                    <summary>Beschreibung</summary>
                    <div class="klapp-inhalt">${aufgabe.beschreibung}</div>
                </details>
            ` : ""}
            <div class="ak-aktionen">
                ${aufgabe.kundenId ? `
                    <button class="crm-icon-button" title="Zum Kunden"
                        onclick="event.stopPropagation();kundeAusAufgabeOeffnen(${aufgabe.kundenId});">👤</button>
                ` : ""}
                <button class="crm-icon-button" title="Bearbeiten"
                    onclick="event.stopPropagation();aufgabeBearbeiten(${aufgabe.id});">✏️</button>
                <button class="crm-icon-button crm-icon-button-gefahr" title="Löschen"
                    onclick="event.stopPropagation();aufgabeLoeschen(${aufgabe.id});">🗑️</button>
            </div>
        `;

        karte.addEventListener("dragstart", function(event){
            event.dataTransfer.setData("text", aufgabe.id);
            setTimeout(() => karte.classList.add("wird-gezogen"), 0);
        });

        karte.addEventListener("dragend", function(){
            karte.classList.remove("wird-gezogen");
        });

        if(aufgabe.status === "Offen"){
            document.getElementById("offen-inhalt").appendChild(karte);
        }
        if(aufgabe.status === "In Bearbeitung"){
            document.getElementById("inBearbeitung-inhalt").appendChild(karte);
        }
        if(aufgabe.status === "Wartet auf Kunde"){
            document.getElementById("wartetAufKunde-inhalt").appendChild(karte);
        }
        if(aufgabe.status === "Erledigt"){
            document.getElementById("erledigt-inhalt").appendChild(karte);
        }
    });
}

/* =====================================================
   DRAG START AKTIVIERUNG
===================================================== */

function aktiviereDropzone(id, status){

    const bereich = document.getElementById(id);

    bereich.addEventListener("dragover", function(event){
        event.preventDefault();
        bereich.classList.add("drop-ziel-aktiv");
    });

    bereich.addEventListener("dragleave", function(){
        bereich.classList.remove("drop-ziel-aktiv");
    });

    bereich.addEventListener("drop", function(event){

        event.preventDefault();
        bereich.classList.remove("drop-ziel-aktiv");

        const aufgabenId = Number(event.dataTransfer.getData("text"));
        const aufgabe = aufgaben.find(eintrag => eintrag.id === aufgabenId);

        if(!aufgabe){ return; }

        aufgabe.status = status;

        if(status === "Erledigt"){
            aufgabe.erledigtAm = new Date().toISOString();
        }

        renderAufgaben();
        dashboardAktualisieren();
        triggerAutoSave();
    });
}

/* =====================================================
   DROPZONEN INITIALISIEREN
===================================================== */

aktiviereDropzone("offen", "Offen");
aktiviereDropzone("inBearbeitung", "In Bearbeitung");
aktiviereDropzone("wartetAufKunde", "Wartet auf Kunde");
aktiviereDropzone("erledigt", "Erledigt");

/* =====================================================
   AUFGABE ÜBERFÄLLIG
===================================================== */

function istUeberfaellig(aufgabe){
    if(!aufgabe.faelligkeit){ return false; }
    return (new Date(aufgabe.faelligkeit) < new Date())
        && aufgabe.status !== "Erledigt";
}

/* =====================================================
   AUFGABE BEARBEITEN
===================================================== */

function aufgabeBearbeiten(id){

    const aufgabe = aufgaben.find(a => a.id === id);
    if(!aufgabe){ return; }

    window.bearbeiteAufgabeId = id;

    document.getElementById("aufgabeTitel").value = aufgabe.titel;
    document.getElementById("aufgabeBeschreibung").value = aufgabe.beschreibung;
    document.getElementById("aufgabePrioritaet").value = aufgabe.prioritaet;
    document.getElementById("aufgabeFaelligkeit").value = aufgabe.faelligkeit || "";

    window.aufgabeAusgewaehlterKunde =
    aufgabe.kundenId ?
    { id: aufgabe.kundenId, name: aufgabe.kundenName } :
    null;

    aufgabeKundeAnzeigeAktualisieren();

    document.getElementById("aufgabeModal").style.display = "flex";
}

/* =====================================================
   AUFGABE LOESCHEN
===================================================== */

function aufgabeLoeschen(id){

    if(!confirm("Aufgabe löschen?")){ return; }

    aufgaben = aufgaben.filter(aufgabe => aufgabe.id !== id);

    renderAufgaben();
    dashboardAktualisieren();
    triggerAutoSave();
}

/* =====================================================
   ERLEDIGTE AUFGABEN BEREINIGEN
===================================================== */

function erledigteAufgabenBereinigen(){

    const heute = new Date();

    aufgaben = aufgaben.filter(aufgabe => {

        if(aufgabe.status !== "Erledigt"){ return true; }
        if(!aufgabe.erledigtAm){ return true; }

        const tage = Math.floor(
            (heute - new Date(aufgabe.erledigtAm)) / 86400000
        );

        return tage < 30;
    });
}

/* =====================================================
   AUFGABEN DASHBOARD
===================================================== */

function offeneAufgabenAnzahl(){
    return aufgaben.filter(aufgabe => aufgabe.status !== "Erledigt").length;
}

/* =====================================================
   AUFGABE BUTTON
===================================================== */

document.getElementById("aufgabeAnlegenButton")
.addEventListener("click", aufgabeAnlegen);

/* =====================================================
   KALENDERANSICHT
===================================================== */

let kalenderJahr = new Date().getFullYear();
let kalenderMonat = new Date().getMonth();

function aufgabeAnlegenAmTag(datum){
    aufgabeAnlegen();
    document.getElementById("aufgabeFaelligkeit").value = datum;
}

function aufgabenAnsichtWechseln(ansicht){
    const kanban = document.getElementById("aufgabenKanbanAnsicht");
    const kalender = document.getElementById("aufgabenKalenderAnsicht");
    const btnKanban = document.getElementById("toggleKanban");
    const btnKalender = document.getElementById("toggleKalender");

    if(ansicht === "kanban"){
        kanban.style.display = "";
        kalender.style.display = "none";
        btnKanban.classList.add("toggle-btn-aktiv");
        btnKalender.classList.remove("toggle-btn-aktiv");
    }else{
        kanban.style.display = "none";
        kalender.style.display = "";
        btnKanban.classList.remove("toggle-btn-aktiv");
        btnKalender.classList.add("toggle-btn-aktiv");
        renderKalender();
    }
}

function kalenderMonatWechseln(richtung){
    kalenderMonat += richtung;
    if(kalenderMonat > 11){ kalenderMonat = 0; kalenderJahr++; }
    if(kalenderMonat < 0){ kalenderMonat = 11; kalenderJahr--; }
    renderKalender();
}

function renderKalender(){
    const monatsnamen = ["Januar","Februar","März","April","Mai","Juni",
        "Juli","August","September","Oktober","November","Dezember"];
    const wochentage = ["Mo","Di","Mi","Do","Fr","Sa","So"];

    document.getElementById("kalenderTitel").textContent =
        monatsnamen[kalenderMonat] + " " + kalenderJahr;

    const ersterTag = new Date(kalenderJahr, kalenderMonat, 1);
    const letzterTag = new Date(kalenderJahr, kalenderMonat + 1, 0);

    let startOffset = ersterTag.getDay() - 1;
    if(startOffset < 0){ startOffset = 6; }

    const aufgabenImMonat = aufgaben.filter(a => {
        if(!a.faelligkeit){ return false; }
        const d = new Date(a.faelligkeit);
        return d.getFullYear() === kalenderJahr &&
               d.getMonth() === kalenderMonat;
    });

    const nachTag = {};
    aufgabenImMonat.forEach(a => {
        const tag = new Date(a.faelligkeit).getDate();
        if(!nachTag[tag]){ nachTag[tag] = []; }
        nachTag[tag].push(a);
    });

    const heute = new Date();
    const heuteTag = heute.getDate();
    const heuteMonat = heute.getMonth();
    const heuteJahr = heute.getFullYear();

    let html = '<div class="kalender-wochentage">';
    wochentage.forEach(w => { html += `<div class="kalender-wt">${w}</div>`; });
    html += '</div><div class="kalender-tage">';

    for(let i = 0; i < startOffset; i++){
        html += '<div class="kalender-tag kalender-tag-leer"></div>';
    }

    for(let tag = 1; tag <= letzterTag.getDate(); tag++){
        const istHeute = tag === heuteTag &&
            kalenderMonat === heuteMonat &&
            kalenderJahr === heuteJahr;
        const aufgabenHeute = nachTag[tag] || [];

        html += `<div class="kalender-tag${istHeute ? ' kalender-heute' : ''}"
            onclick="aufgabeAnlegenAmTag('${kalenderJahr}-${String(kalenderMonat+1).padStart(2,'0')}-${String(tag).padStart(2,'0')}')"
            title="Aufgabe am ${tag}. anlegen">
            <div class="kalender-tag-nr${istHeute ? ' kalender-heute-nr' : ''}">${tag}</div>
            <div class="kalender-aufgaben">`;

        aufgabenHeute.slice(0, 3).forEach(a => {
            const farbe = prioritaetFarbe(a.prioritaet);
            const ueberfaellig = istUeberfaellig(a);
            html += `<div class="kalender-aufgabe-pill"
                style="border-left:3px solid ${farbe};"
                onclick="event.stopPropagation();aufgabeBearbeiten(${a.id})"
                title="${a.titel}">
                <span ${ueberfaellig ? 'style="color:var(--c-danger)"' : ''}>${a.titel}</span>
            </div>`;
        });

        if(aufgabenHeute.length > 3){
            html += `<div class="kalender-mehr">+${aufgabenHeute.length - 3} weitere</div>`;
        }

        html += '</div></div>';
    }

    html += '</div>';

    document.getElementById("kalenderGrid").innerHTML = html;
}
