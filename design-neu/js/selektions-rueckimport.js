/* =====================================================
   SELEKTIONS-RUECKIMPORT
   -----------------------------------------------------
   Nimmt eine zuvor als Excel exportierte Selektion
   zurueck und legt bei allen zuordenbaren Kunden einen
   Info-Termin an. Titel = Dateiname (ohne .xlsx).
   Optional werden Haushaltsmitglieder mit markiert.

   Matching-Strategie (strikt):
     1) PARTY_ID → findeKundePerPartyId (eindeutig)
     2) Fallback: Vorname + Nachname + PLZ, nur wenn
        GENAU ein Kandidat gefunden wird.
   Mehrdeutige/nicht gefundene Zeilen → "nicht zuordenbar"
   und werden uebersprungen. Mehrfach-Import derselben
   Datei ist erlaubt (kein Dedup gegen bestehende Termine).
===================================================== */

/* Zustand des gerade analysierten Imports (nach Datei-Auswahl,
   vor dem endgueltigen Uebernehmen). Wird vom Vorschau-Rendering
   genutzt. */
window.__srImport = null;

function sr_dateiAusgewaehlt(input){
    const datei = input.files && input.files[0];
    if(!datei){ return; }

    const titel = datei.name.replace(/\.xlsx?$/i, "");

    const reader = new FileReader();
    reader.onload = function(ev){
        try{
            const data = new Uint8Array(ev.target.result);
            const wb = XLSX.read(data, { type: "array" });
            const sheetName = wb.SheetNames[0];
            const sheet = wb.Sheets[sheetName];
            const zeilen = XLSX.utils.sheet_to_json(sheet, {
                raw: false, dateNF: "dd.mm.yyyy"
            });
            sr_zeilenAnalysieren(zeilen, titel);
        }catch(e){
            fehlerMelden("Selektions-Rueckimport",
                "Excel konnte nicht gelesen werden: " + datei.name, e);
            alert("Datei konnte nicht gelesen werden. "
                + "Details im Fehler-Log.");
        }
    };
    reader.onerror = function(){
        fehlerMelden("Selektions-Rueckimport",
            "Dateileseproblem.", reader.error);
    };
    reader.readAsArrayBuffer(datei);
}

function sr_zeilenAnalysieren(zeilen, titel){
    const zugeordnet   = []; // Set von Kunden
    const nichtGefunden = []; // Namen fuer die Vorschau
    const dedupSet = new Set();

    zeilen.forEach(z => {
        const kunde = sr_zeileAufKundeMappen(z);
        if(!kunde){
            const name = (
                (z["Vorname"]  || "") + " " + (z["Nachname"] || "")
            ).trim();
            const ort = (z["PLZ"] || "") + " " + (z["Ort"] || "");
            nichtGefunden.push({
                name:  name || "(ohne Namen)",
                ort:   ort.trim(),
                partyId: (z["PARTY_ID"] || "").toString().trim()
            });
            return;
        }
        if(dedupSet.has(kunde.id)){ return; }
        dedupSet.add(kunde.id);
        zugeordnet.push(kunde);
    });

    window.__srImport = {
        titel: titel,
        zeilen: zeilen.length,
        zugeordnet: zugeordnet,
        nichtGefunden: nichtGefunden
    };

    sr_vorschauRendern();
}

/* Strikt: eindeutige Treffer werden akzeptiert, mehrdeutige
   Fallback-Matches zaehlen als "nicht zuordenbar". */
function sr_zeileAufKundeMappen(zeile){
    const partyRoh = String(zeile["PARTY_ID"] || "").trim();
    if(partyRoh){
        // Mehrere IDs koennen in der Export-Zelle mit "|" getrennt sein.
        const ids = partyRoh.split(/[|,;]/)
            .map(s => s.trim()).filter(Boolean);
        for(const id of ids){
            const k = findeKundePerPartyId(id);
            if(k){ return k; }
        }
    }
    // Fallback: Vorname + Nachname + PLZ, strikt eindeutig
    const vn = String(zeile["Vorname"] || "").trim().toLowerCase();
    const nn = String(zeile["Nachname"] || "").trim().toLowerCase();
    const pz = String(zeile["PLZ"] || "").trim();
    if(!vn || !nn || !pz){ return null; }

    const kandidaten = kunden.filter(k =>
        !k.archiviert &&
        String(k.vorname||"").trim().toLowerCase() === vn &&
        String(k.nachname||"").trim().toLowerCase() === nn &&
        String(k.plz||"").trim() === pz
    );
    return kandidaten.length === 1 ? kandidaten[0] : null;
}

/* =====================================================
   VORSCHAU IM PANEL
===================================================== */

function sr_vorschauRendern(){
    const d = window.__srImport;
    const ziel = document.getElementById("srVorschau");
    if(!ziel){ return; }
    if(!d){
        ziel.innerHTML = "";
        return;
    }

    const haushaltCheckbox = document.getElementById("srHaushalt");
    const haushaltAktiv = !!(haushaltCheckbox && haushaltCheckbox.checked);

    // Haushaltsmitglieder vorberechnen
    let haushaltZusatz = 0;
    if(haushaltAktiv){
        const schon = new Set(d.zugeordnet.map(k => k.id));
        d.zugeordnet.forEach(k => {
            if(typeof findeHaushalt !== "function"){ return; }
            findeHaushalt(k).forEach(m => {
                if(!m.archiviert && !schon.has(m.id)){
                    schon.add(m.id);
                    haushaltZusatz++;
                }
            });
        });
    }

    ziel.innerHTML = `
        <div class="sr-vorschau-zeile">
            <strong>${d.zeilen}</strong> Zeile${d.zeilen === 1 ? "" : "n"} gelesen —
            <strong>${d.zugeordnet.length}</strong> Kunde${d.zugeordnet.length === 1 ? "" : "n"} zugeordnet
            ${d.nichtGefunden.length > 0
                ? `<span class="sr-warn">${d.nichtGefunden.length} nicht zuordenbar</span>`
                : ""}
            ${haushaltAktiv && haushaltZusatz > 0
                ? `<span class="sr-haushalt-hinweis">+${haushaltZusatz} Haushaltsmitglied${haushaltZusatz === 1 ? "" : "er"}</span>`
                : ""}
        </div>

        <div class="sr-vorschau-titelzeile">
            Titel des Info-Termins: <strong>${esc(d.titel)}</strong>
        </div>

        ${d.nichtGefunden.length > 0 ? `
            <details class="sr-details">
                <summary>${d.nichtGefunden.length} nicht zuordenbare Zeile${d.nichtGefunden.length === 1 ? "" : "n"} anzeigen</summary>
                <div class="sr-nicht-liste">
                    ${d.nichtGefunden.map(z => `
                        <div class="sr-nicht-eintrag">
                            ${esc(z.name)}
                            ${z.ort ? ` · ${esc(z.ort)}` : ""}
                            ${z.partyId ? ` · PARTY_ID: ${esc(z.partyId)}` : ""}
                        </div>
                    `).join("")}
                </div>
            </details>
        ` : ""}

        <div class="sr-aktionen">
            <button class="crm-button crm-button-primary"
                onclick="sr_uebernehmen()"
                ${d.zugeordnet.length === 0 ? "disabled" : ""}>
                ✓ ${d.zugeordnet.length}${haushaltAktiv && haushaltZusatz > 0
                    ? "+" + haushaltZusatz
                    : ""} Info-Termin${(d.zugeordnet.length + (haushaltAktiv ? haushaltZusatz : 0)) === 1 ? "" : "e"} anlegen
            </button>
            <button class="crm-button crm-button-klein"
                onclick="sr_abbrechen()">
                Abbrechen
            </button>
        </div>
    `;
}

function sr_haushaltUmgeschaltet(){
    // Nur die Vorschau neu rechnen, Datei bleibt analysiert
    sr_vorschauRendern();
}

function sr_abbrechen(){
    window.__srImport = null;
    const input = document.getElementById("srDateiInput");
    if(input){ input.value = ""; }
    sr_vorschauRendern();
}

/* =====================================================
   UEBERNAHME: TERMINE ANLEGEN
===================================================== */

function sr_uebernehmen(){
    const d = window.__srImport;
    if(!d || d.zugeordnet.length === 0){ return; }

    const datumInput = document.getElementById("srDatum");
    const datum = datumInput && datumInput.value
        ? datumInput.value
        : new Date().toISOString().split("T")[0];

    const notizInput = document.getElementById("srZusammenfassung");
    const notiz = notizInput ? notizInput.value : "";

    const haushaltCheckbox = document.getElementById("srHaushalt");
    const haushaltAktiv = !!(haushaltCheckbox && haushaltCheckbox.checked);

    // Zielmenge aufbauen (dedupliziert)
    const ziele = new Map(); // id → kunde
    d.zugeordnet.forEach(k => ziele.set(k.id, k));
    if(haushaltAktiv && typeof findeHaushalt === "function"){
        d.zugeordnet.forEach(k => {
            findeHaushalt(k).forEach(m => {
                if(!m.archiviert && !ziele.has(m.id)){
                    ziele.set(m.id, m);
                }
            });
        });
    }

    let angelegt = 0;
    ziele.forEach(k => {
        if(!Array.isArray(k.termine)){ k.termine = []; }
        k.termine.push({
            id: neueId(),
            datum: datum,
            kategorie: "Info (kein Kontakt)",
            titel: d.titel,
            zusammenfassung: notiz || "",
            wochentag: (function(){
                try{ return ermittleWochentag(datum); }catch(_){ return ""; }
            })()
        });
        angelegt++;
    });

    if(typeof triggerAutoSave === "function"){ triggerAutoSave(); }
    if(typeof renderKunden === "function"){ renderKunden(); }
    if(typeof kontaktListenAktualisieren === "function"){
        kontaktListenAktualisieren();
    }

    alert("Fertig. " + angelegt + " Info-Termin" + (angelegt === 1 ? "" : "e")
        + " mit Titel \"" + d.titel + "\" angelegt."
        + (d.nichtGefunden.length > 0
            ? "\n\n" + d.nichtGefunden.length + " Zeile(n) waren nicht zuordenbar."
            : ""));

    // Zustand zuruecksetzen
    sr_abbrechen();
}

/* =====================================================
   INIT: Datum voreinstellen beim Panel-Rendern
===================================================== */

function sr_panelInitialisieren(){
    const datumInput = document.getElementById("srDatum");
    if(datumInput && !datumInput.value){
        datumInput.value = new Date().toISOString().split("T")[0];
    }
}
