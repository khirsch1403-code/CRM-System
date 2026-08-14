/* =====================================================
   DOPPLUNGSERKENNUNG + ZUSAMMENFÜHREN
   ===================================================== */

function normalisiereName(wert){
    return String(wert || "").trim().toLowerCase();
}

function normalisiereGeburtsdatum(wert){
    // Formate tolerant behandeln: "1990-01-15", "15.01.1990", Date-Objekt
    const s = String(wert || "").trim();
    if(!s){ return ""; }
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m1){ return m1[3] + "." + m1[2] + "." + m1[1]; }
    const m2 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if(m2){
        const tag  = m2[1].padStart(2,"0");
        const mon  = m2[2].padStart(2,"0");
        let jahr   = m2[3];
        if(jahr.length === 2){ jahr = (parseInt(jahr,10) > 30 ? "19" : "20") + jahr; }
        return tag + "." + mon + "." + jahr;
    }
    return s;
}

function findeAlleDopplungen(){
    /* Gibt Paare [k1, k2] zurück, wenn Vorname, Nachname UND Geburtsdatum
       vorhanden und identisch sind. Jeder Kunde erscheint in maximal
       einem Paar (damit der Nutzer nicht dieselbe Person mehrfach mergt). */

    const paare = [];
    const behandelt = new Set();

    const aktive = kunden.filter(k => !k.archiviert);

    // Gruppen bilden per Schlüssel nachname|vorname|geburtsdatum
    const gruppen = new Map();

    aktive.forEach(k => {
        const nn = normalisiereName(k.nachname);
        const vn = normalisiereName(k.vorname);
        const gd = normalisiereGeburtsdatum(k.geburtsdatum);
        if(!nn || !vn || !gd){ return; }
        const key = nn + "|" + vn + "|" + gd;
        if(!gruppen.has(key)){ gruppen.set(key, []); }
        gruppen.get(key).push(k);
    });

    gruppen.forEach(liste => {
        if(liste.length < 2){ return; }
        // Sortiert nach ID, damit die Reihenfolge stabil ist
        liste.sort((a,b) => a.id - b.id);
        for(let i = 0; i < liste.length - 1; i++){
            const a = liste[i];
            const b = liste[i+1];
            if(behandelt.has(a.id) || behandelt.has(b.id)){ continue; }
            paare.push([a, b]);
            behandelt.add(a.id);
            behandelt.add(b.id);
        }
    });

    return paare;
}

/* =====================================================
   MERGE: alles vom Verlierer in den Sieger übertragen
   ===================================================== */

function mergeKunden(sieger, verlierer){

    // Party-IDs vereinigen
    sieger.partyIds = sieger.partyIds || [];
    (verlierer.partyIds || []).forEach(pid => {
        if(!sieger.partyIds.includes(pid)){
            sieger.partyIds.push(pid);
        }
    });

    // Telefone
    sieger.telefone = sieger.telefone || [];
    (verlierer.telefone || []).forEach(t => {
        if(t && !sieger.telefone.includes(t)){ sieger.telefone.push(t); }
    });

    // E-Mails
    sieger.emails = sieger.emails || [];
    (verlierer.emails || []).forEach(e => {
        if(e && !sieger.emails.includes(e)){ sieger.emails.push(e); }
    });

    // Verträge (dedupe per Nummer, Felder mergen)
    sieger.vertraege = sieger.vertraege || [];
    (verlierer.vertraege || []).forEach(v => {
        const vObj = typeof v === "string" ? { nummer: v } : v;
        if(!vObj || !vObj.nummer){ return; }
        const idx = sieger.vertraege.findIndex(sv => {
            const sObj = typeof sv === "string" ? { nummer: sv } : sv;
            return sObj.nummer === vObj.nummer;
        });
        if(idx < 0){
            sieger.vertraege.push(vObj);
        }else{
            const bestand = typeof sieger.vertraege[idx] === "string"
                ? { nummer: sieger.vertraege[idx] }
                : sieger.vertraege[idx];
            Object.keys(vObj).forEach(k => {
                if(vObj[k] && !bestand[k]){ bestand[k] = vObj[k]; }
            });
            sieger.vertraege[idx] = bestand;
        }
    });

    // Termine übernehmen (einfach anhängen)
    sieger.termine = sieger.termine || [];
    (verlierer.termine || []).forEach(t => sieger.termine.push(t));
    sieger.termine.sort((a,b) => new Date(b.datum) - new Date(a.datum));

    // Notiz anhängen mit Trenner
    if(verlierer.notiz && verlierer.notiz.trim()){
        const trenner = "\n\n--- Zusammengeführt aus Duplikat "
            + new Date().toLocaleDateString("de-DE") + " ---\n";
        sieger.notiz = (sieger.notiz || "") + trenner + verlierer.notiz;
    }

    // Kennzeichen: OR-Verknüpfung (Marker gehen nicht verloren)
    sieger.kennzeichen = sieger.kennzeichen || {};
    const v_kz = verlierer.kennzeichen || {};
    ["keineBeratung","nurBuero","nurTelefon","nurMail","bestandVerlassen"]
        .forEach(name => {
            if(v_kz[name]){ sieger.kennzeichen[name] = true; }
        });
    // Wenn der Sieger noch im Bestand ist, "bestandVerlassen" nicht setzen
    if(sieger.partyIds && sieger.partyIds.length > 0){
        // Verlassen nur, wenn alle IDs verlassen sind - im Sync neu bewertet.
    }

    // letzterImport: das jüngere Datum behalten
    if(!sieger.letzterImport){ sieger.letzterImport = verlierer.letzterImport; }

    // Aufgaben und Abschlüsse vom Verlierer auf Sieger umhängen
    const neuerName = sieger.vorname + " " + sieger.nachname;
    aufgaben.forEach(a => {
        if(a.kundenId === verlierer.id){
            a.kundenId = sieger.id;
            a.kundenName = neuerName;
        }
    });
    abschluesse.forEach(a => {
        if(a.kundenId === verlierer.id){
            a.kundenId = sieger.id;
            a.kundenName = neuerName;
        }
    });

    // Ordner umbenennen/vereinen falls Kundenunterlagen aktiv sind
    if(typeof mergeKundenOrdner === "function"){
        try{ mergeKundenOrdner(sieger, verlierer); }catch(e){ console.log("Ordner-Merge:",e); }
    }

    // Verlierer aus kunden entfernen
    const idx = kunden.findIndex(k => k.id === verlierer.id);
    if(idx >= 0){ kunden.splice(idx, 1); }
}

/* =====================================================
   MERGE-DIALOG (sequentiell)
   ===================================================== */

let mergeQueue = [];
let mergeAktiv = false;

function mergeQueueStarten(paare){
    mergeQueue = paare.slice();
    mergeAktiv = false;
    naechstenMergeAnzeigen();
}

function naechstenMergeAnzeigen(){
    if(mergeQueue.length === 0){
        if(mergeAktiv){
            mergeAktiv = false;
            triggerAutoSave();
            renderKunden();
            renderAufgaben();
            renderAbschluesse();
            dashboardAktualisieren();
            kontaktListenAktualisieren();
            alert("Dopplungsprüfung abgeschlossen.");
        }
        return;
    }
    mergeAktiv = true;
    const [a, b] = mergeQueue.shift();

    // Falls einer der beiden zwischenzeitlich schon gemergt wurde:
    if(!findeKunde(a.id) || !findeKunde(b.id)){
        naechstenMergeAnzeigen();
        return;
    }

    zeigeMergeModal(a, b);
}

function kundeKurzInfo(k){
    const vertragsNrn = (k.vertraege || [])
        .map(v => typeof v === "string" ? v : v.nummer)
        .filter(Boolean)
        .slice(0, 5)
        .join(", ");
    const telefone = (k.telefone || []).join(", ");
    const emails   = (k.emails || []).join(", ");
    const partyIds = (k.partyIds || []).join(" | ");
    const termine  = (k.termine || []).length;

    const zeile = (label, wert) =>
        `<div class="merge-zeile"><span class="merge-label">${label}</span><span class="merge-wert">${wert || "-"}</span></div>`;

    return [
        zeile("Party-ID",     partyIds),
        zeile("Geburtsdatum", k.geburtsdatum),
        zeile("Adresse",      (k.strasse||"") + " " + (k.hausnummer||"") + ", " + (k.plz||"") + " " + (k.ort||"")),
        zeile("Telefon",      telefone),
        zeile("E-Mail",       emails),
        zeile("Verträge",     (k.vertraege||[]).length + (vertragsNrn ? " (" + vertragsNrn + ")" : "")),
        zeile("Termine",      termine),
        zeile("Notiz",        k.notiz ? (k.notiz.length > 60 ? k.notiz.substring(0,60)+"…" : k.notiz) : "-"),
        zeile("Letzter Sync", k.letzterImport)
    ].join("");
}

function zeigeMergeModal(a, b){
    const modal   = document.getElementById("mergeModal");
    const inhalt  = document.getElementById("mergeModalInhalt");
    const kopf    = document.getElementById("mergeModalKopf");

    kopf.textContent = "Mögliche Dopplung: "
        + a.vorname + " " + a.nachname
        + " (geb. " + a.geburtsdatum + ")";

    inhalt.innerHTML = `
        <p class="merge-hinweis">
            Adresse und Kontaktdaten (Telefon/E-Mail) werden vom
            <strong>gewählten Sieger</strong> übernommen.
            Notizen, Verträge, Termine, Party-IDs, Aufgaben und
            Abschlüsse werden vom Verlierer in den Sieger übertragen.
            Der Verlierer wird danach gelöscht.
            <br><br>
            <strong>Diese Aktion kann nicht rückgängig gemacht werden.</strong>
        </p>

        <div class="merge-grid">

            <div class="merge-spalte" id="mergeSpalteA">
                <div class="merge-spalte-kopf">
                    <strong>Kunde A</strong>
                    <span class="merge-id">ID ${a.id}</span>
                </div>
                ${kundeKurzInfo(a)}
                <button class="crm-button crm-button-primary merge-waehlen-btn"
                    onclick="mergeAusfuehren(${a.id}, ${b.id})">
                    A als Sieger &nbsp;→&nbsp; B wird eingemischt
                </button>
            </div>

            <div class="merge-spalte" id="mergeSpalteB">
                <div class="merge-spalte-kopf">
                    <strong>Kunde B</strong>
                    <span class="merge-id">ID ${b.id}</span>
                </div>
                ${kundeKurzInfo(b)}
                <button class="crm-button crm-button-primary merge-waehlen-btn"
                    onclick="mergeAusfuehren(${b.id}, ${a.id})">
                    B als Sieger &nbsp;→&nbsp; A wird eingemischt
                </button>
            </div>

        </div>

        <div class="modal-buttons">
            <button class="crm-button" onclick="mergeUeberspringen()">
                Überspringen (kein Duplikat)
            </button>
            <button class="crm-button crm-button-gefahr" onclick="mergeAbbrechen()">
                Prüfung beenden
            </button>
        </div>
    `;

    modal.style.display = "flex";
}

function mergeModalSchliessen(){
    const modal = document.getElementById("mergeModal");
    if(modal){ modal.style.display = "none"; }
}

function mergeAusfuehren(siegerId, verliererId){
    const s = findeKunde(siegerId);
    const v = findeKunde(verliererId);
    if(!s || !v){
        mergeModalSchliessen();
        naechstenMergeAnzeigen();
        return;
    }
    mergeKunden(s, v);
    mergeModalSchliessen();
    triggerAutoSave();
    naechstenMergeAnzeigen();
}

function mergeUeberspringen(){
    mergeModalSchliessen();
    naechstenMergeAnzeigen();
}

function mergeAbbrechen(){
    mergeQueue = [];
    mergeModalSchliessen();
    mergeAktiv = false;
    triggerAutoSave();
    renderKunden();
    dashboardAktualisieren();
}

/* =====================================================
   ÖFFENTLICHER EINSTIEG NACH SYNC (oder manuell)
   ===================================================== */

function dopplungenPruefenUndBehandeln(){
    const paare = findeAlleDopplungen();
    if(paare.length === 0){
        // Nur eine stille Info, wenn manuell gestartet
        if(window.__dopplungManuell){
            alert("Keine Dopplungen gefunden.");
            window.__dopplungManuell = false;
        }
        return;
    }
    mergeQueueStarten(paare);
}

function dopplungenManuellStarten(){
    window.__dopplungManuell = true;
    dopplungenPruefenUndBehandeln();
}
