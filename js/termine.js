function terminAnlegen(){

    if(!aktuellerKunde){

        return;

    }

    document
    .getElementById(
        "terminDatum"
    )
    .value =

    new Date()
    .toISOString()
    .split("T")[0];

    document
    .getElementById(
        "terminKategorie"
    )
    .value = "Telefon";

    document
    .getElementById(
        "terminTitel"
    )
    .value = "";

    document
    .getElementById(
        "terminZusammenfassung"
    )
    .value = "";

    window.bearbeiteTerminId = null;

    const checkbox =
    document.getElementById(
        "terminGanzerHaushalt"
    );

    checkbox.checked = false;

    const haushalt =
    findeHaushalt(aktuellerKunde);

    const label =
    document.getElementById(
        "terminHaushaltLabel"
    );

    if(haushalt.length > 0){

        label.style.display =
        "flex";

        const namen =
        haushalt
        .map(m => m.vorname + " " + m.nachname)
        .join(", ");

        label.title =
        "Betrifft auch: " + namen;

    }else{

        label.style.display =
        "none";

    }

    document
    .getElementById(
        "terminModal"
    )
    .style.display =
    "flex";

}

/* =====================================================
   TERMIN MODAL SCHLIESSEN
===================================================== */

function terminModalSchliessen(){

    document
    .getElementById(
        "terminModal"
    )
    .style.display =
    "none";

}

/* =====================================================
   TERMIN SPEICHERN
===================================================== */

function terminSpeichern(){

    if(!aktuellerKunde){

        return;

    }

    const datum =

    document
    .getElementById(
        "terminDatum"
    )
    .value;

    const kategorie =

    document
    .getElementById(
        "terminKategorie"
    )
    .value;

    const titel =

    document
    .getElementById(
        "terminTitel"
    )
    .value;

    const zusammenfassung =

    document
    .getElementById(
        "terminZusammenfassung"
    )
    .value;

    const ganzerHaushalt =

    document
    .getElementById(
        "terminGanzerHaushalt"
    )
    .checked;

    if(

        !datum ||

        !titel

    ){

        alert(
            "Datum und Titel sind Pflichtfelder."
        );

        return;

    }

    const terminEintrag = {

        id: window.bearbeiteTerminId || neueId(),

        datum: datum,

        wochentag: ermittleWochentag(datum),

        kategorie: kategorie,

        titel: titel,

        zusammenfassung: zusammenfassung

    };

    if(window.bearbeiteTerminId){

        const idx =
        aktuellerKunde.termine.findIndex(
            t => t.id === window.bearbeiteTerminId
        );

        const alterTermin =
        idx !== -1 ? aktuellerKunde.termine[idx] : null;

        const altesDatum =
        alterTermin ? alterTermin.datum : null;

        if(idx !== -1){
            aktuellerKunde.termine[idx] = terminEintrag;
        }

        // Immer auf Haushalt propagieren wenn Mitglieder
        // einen Termin am gleichen Datum haben
        if(altesDatum){

            const haushalt = findeHaushalt(aktuellerKunde);

            haushalt.forEach(mitglied => {

                if(!mitglied.termine){ return; }

                const hatPassenden =
                mitglied.termine.some(
                    t => t.datum === altesDatum
                );

                if(!hatPassenden){ return; }

                mitglied.termine =
                mitglied.termine.map(t =>
                    t.datum === altesDatum
                    ? { ...t,
                        datum: datum,
                        wochentag: ermittleWochentag(datum),
                        kategorie: kategorie,
                        titel: titel + " (Haushaltsbesuch)",
                        zusammenfassung: zusammenfassung }
                    : t
                );

            });

        }

        window.bearbeiteTerminId = null;

    }else{

        aktuellerKunde.termine.unshift(terminEintrag);

        if(ganzerHaushalt){

            const haushalt = findeHaushalt(aktuellerKunde);

            haushalt.forEach(mitglied => {

                if(!mitglied.termine){ mitglied.termine = []; }

                mitglied.termine.unshift({
                    id: neueId(),
                    datum: datum,
                    wochentag: ermittleWochentag(datum),
                    kategorie: kategorie,
                    titel: titel + " (Haushaltsbesuch)",
                    zusammenfassung: zusammenfassung
                });

            });

        }

    }

    terminModalSchliessen();

    dashboardAktualisieren();
    triggerAutoSave();
    kontaktListenAktualisieren();

    kundeOeffnen(
        aktuellerKunde.id
    );

}

/* =====================================================
   TERMIN HISTORIE
===================================================== */

function terminBearbeiten(terminId){

    if(!aktuellerKunde){ return; }

    const termin =
    aktuellerKunde.termine.find(
        t => t.id === terminId
    );

    if(!termin){ return; }

    window.bearbeiteTerminId = terminId;

    document.getElementById("terminDatum").value =
    termin.datum;

    document.getElementById("terminKategorie").value =
    termin.kategorie;

    document.getElementById("terminTitel").value =
    termin.titel;

    document.getElementById("terminZusammenfassung").value =
    termin.zusammenfassung || "";

    document.getElementById("terminGanzerHaushalt").checked =
    false;

    // Haushalt-Checkbox anzeigen, falls Haushaltsmitglieder
    // einen passenden Termin haben (erkennbar am gleichen Datum)
    const haushalt = findeHaushalt(aktuellerKunde);

    const haushaltHatPassendenTermin =
    haushalt.some(m =>
        (m.termine || []).some(
            t => t.datum === termin.datum
        )
    );

    const label =
    document.getElementById("terminHaushaltLabel");

    if(haushaltHatPassendenTermin){

        label.style.display = "flex";
        label.title = "Ändert den Termin auch bei allen Haushaltsmitgliedern mit gleichem Datum";

    }else{

        label.style.display = "none";

    }

    document.getElementById("terminModal").style.display =
    "flex";

}

function terminLoeschen(terminId){

    if(!aktuellerKunde){ return; }

    if(!confirm("Kontakt löschen?")){ return; }

    const termin =
    aktuellerKunde.termine.find(
        t => t.id === terminId
    );

    const datum = termin ? termin.datum : null;

    aktuellerKunde.termine =
    aktuellerKunde.termine.filter(
        t => t.id !== terminId
    );

    // Haushalts-Termine mit gleichem Datum ebenfalls löschen
    const haushalt = findeHaushalt(aktuellerKunde);

    haushalt.forEach(mitglied => {

        if(!mitglied.termine){ return; }

        mitglied.termine =
        mitglied.termine.filter(
            t => t.datum !== datum
        );

    });

    dashboardAktualisieren();
    triggerAutoSave();
    kontaktListenAktualisieren();

    kundeOeffnen(aktuellerKunde.id);

}

function renderTerminHistorie(){

    if(!aktuellerKunde){ return ""; }

    if(aktuellerKunde.termine.length === 0){

        return `<div class="termin-leer">Keine Kontakte vorhanden</div>`;

    }

    return aktuellerKunde.termine

    .slice()
    .sort((a,b) => new Date(b.datum) - new Date(a.datum))
    .map(termin => {

        const istInfo = termin.kategorie === "Info (kein Kontakt)";

        const kategorieAnzeige = istInfo ? "Info" : termin.kategorie;

        const notizHtml =
        termin.zusammenfassung
        ? `<details class="klapp-panel klapp-panel-mini termin-notiz">
               <summary>Notiz</summary>
               <div class="klapp-inhalt">${termin.zusammenfassung}</div>
           </details>`
        : "";

        return `<div class="termin-zeile ${istInfo ? "termin-info" : ""}">

            <div class="termin-zeile-haupt">

                <span class="termin-datum">
                    ${termin.wochentag ? termin.wochentag.slice(0,2) + "." : ""}
                    ${formatDatum(termin.datum)}
                </span>

                <span class="termin-kategorie">${kategorieAnzeige}</span>

                <span class="termin-titel">${termin.titel}</span>

                <span class="termin-aktionen">
                    <button class="crm-button crm-button-klein"
                    onclick="terminBearbeiten(${termin.id})">Bearbeiten</button>
                    <button class="crm-button crm-button-klein crm-button-gefahr"
                    onclick="terminLoeschen(${termin.id})">Löschen</button>
                </span>

            </div>

            ${notizHtml}

        </div>`;

    })
    .join("");

}

/* =====================================================
   KUNDE OEFFNEN ERWEITERUNG
===================================================== */

const kundeOeffnenOriginal =
kundeOeffnen;

kundeOeffnen =
function(id){

    kundeOeffnenOriginal(id);

    const bereich =
    document.getElementById(
        "kd-termine-bereich"
    );

    if(!bereich){ return; }

    bereich.innerHTML =
    `<div class="kd-abschnitt-kopf">
        <h3>Kontakte</h3>
        <button class="crm-button crm-button-klein" onclick="terminAnlegen()">+ Kontakt</button>
    </div>
    ${renderTerminHistorie()}`;

};


