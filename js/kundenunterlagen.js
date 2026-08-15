/* =====================================================
   KUNDENUNTERLAGEN — File System Access API
   =====================================================
   Wichtig zur Browser-Realität:
   - Ein Web-Explorer-Link (file://) funktioniert in modernen
     Browsern aus Sicherheitsgründen nicht. Stattdessen halten
     wir ein DirectoryHandle in IndexedDB und verwalten Ordner
     + Dateien direkt aus dem CRM heraus (Chrome / Edge).
   ===================================================== */

const KU_DB_NAME  = "crmKundenunterlagen";
const KU_STORE    = "handles";
const KU_KEY_ROOT = "wurzel";

let kuWurzelHandle = null;       // FileSystemDirectoryHandle
let kuUnterstuetzt = false;      // Browser-Feature vorhanden?

function kuFeatureCheck(){
    kuUnterstuetzt =
        typeof window !== "undefined" &&
        "showDirectoryPicker" in window;
    return kuUnterstuetzt;
}

function kuDbOeffnen(){
    return new Promise((resolve, reject) => {
        const anfrage = indexedDB.open(KU_DB_NAME, 1);
        anfrage.onupgradeneeded = e => {
            const db = e.target.result;
            if(!db.objectStoreNames.contains(KU_STORE)){
                db.createObjectStore(KU_STORE);
            }
        };
        anfrage.onsuccess = e => resolve(e.target.result);
        anfrage.onerror   = e => reject(e.target.error);
    });
}

async function kuHandleSpeichern(handle){
    const db = await kuDbOeffnen();
    const tx = db.transaction(KU_STORE, "readwrite");
    tx.objectStore(KU_STORE).put(handle, KU_KEY_ROOT);
    return new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
    });
}

async function kuHandleLaden(){
    try{
        const db = await kuDbOeffnen();
        const tx = db.transaction(KU_STORE, "readonly");
        const req = tx.objectStore(KU_STORE).get(KU_KEY_ROOT);
        return await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result || null);
            req.onerror   = () => rej(req.error);
        });
    }catch(e){
        return null;
    }
}

async function kuHandleLoeschen(){
    const db = await kuDbOeffnen();
    const tx = db.transaction(KU_STORE, "readwrite");
    tx.objectStore(KU_STORE).delete(KU_KEY_ROOT);
    return new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
    });
}

/* =====================================================
   PERMISSION HELPER
   ===================================================== */

async function kuBerechtigungSicherstellen(handle, modus){
    if(!handle){ return false; }
    const opt = { mode: modus || "readwrite" };
    if((await handle.queryPermission(opt)) === "granted"){ return true; }
    if((await handle.requestPermission(opt)) === "granted"){ return true; }
    return false;
}

/* =====================================================
   INITIALISIERUNG BEIM APP-START
   ===================================================== */

async function kuInitialisieren(){
    if(!kuFeatureCheck()){
        console.log("Kundenunterlagen: File System Access API nicht verfügbar.");
        return;
    }
    kuWurzelHandle = await kuHandleLaden();
    kuStatusAnzeigen();
}

function kuStatusAnzeigen(){
    const el = document.getElementById("kuStatus");
    if(!el){ return; }
    if(!kuUnterstuetzt){
        el.textContent = "Ordner: Browser nicht unterstützt (Chrome/Edge nötig)";
        el.style.color = "var(--c-text-schwach)";
        return;
    }
    if(!kuWurzelHandle){
        el.textContent = "Kundenunterlagen-Ordner nicht gesetzt";
        el.style.color = "var(--c-text-schwach)";
    }else{
        el.textContent = "Ordner: " + kuWurzelHandle.name;
        el.style.color = "var(--c-success-text)";
    }
}

/* =====================================================
   ORDNER AUSWÄHLEN
   ===================================================== */

async function kuWurzelWaehlen(){
    if(!kuFeatureCheck()){
        alert("Dein Browser unterstützt die File System Access API nicht.\n"
            + "Bitte Chrome oder Edge verwenden.");
        return;
    }
    try{
        const handle = await window.showDirectoryPicker({
            id: "crmKundenunterlagen",
            mode: "readwrite",
            startIn: "documents"
        });
        kuWurzelHandle = handle;
        await kuHandleSpeichern(handle);
        kuStatusAnzeigen();

        if(confirm(
            "Ordner \"" + handle.name + "\" ausgewählt.\n\n"
            + "Möchtest du jetzt für alle bestehenden Kunden "
            + "Unterordner anlegen (falls nicht vorhanden)?"
        )){
            const anzahl = await stelleAlleOrdnerSicher();
            alert("Fertig. " + anzahl + " Ordner geprüft/angelegt.");
        }

        // Kundenansicht neu rendern, damit der Bereich sichtbar wird
        if(aktuellerKunde){ kundeOeffnen(aktuellerKunde.id); }

    }catch(e){
        if(e.name === "AbortError"){ return; }
        console.log("Ordnerauswahl:", e);
        alert("Ordner konnte nicht ausgewählt werden.");
    }
}

async function kuWurzelZuruecksetzen(){
    if(!confirm("Verknüpfung zum Kundenunterlagen-Ordner entfernen?\n"
        + "Die Dateien auf der Festplatte bleiben unberührt.")){
        return;
    }
    kuWurzelHandle = null;
    await kuHandleLoeschen();
    kuStatusAnzeigen();
    if(aktuellerKunde){ kundeOeffnen(aktuellerKunde.id); }
}

/* =====================================================
   ORDNERNAME
   ===================================================== */

function saeuberDateiname(wert){
    return String(wert || "")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function ordnerNameFuerKunde(k){
    const nn = saeuberDateiname(k.nachname);
    const vn = saeuberDateiname(k.vorname);
    const gd = saeuberDateiname((k.geburtsdatum || "").replace(/\./g, "-"));
    let name = nn + "_" + vn;
    if(gd){ name += "_" + gd; }
    return name || ("Kunde_" + k.id);
}

/* =====================================================
   ORDNER-OPERATIONEN
   ===================================================== */

async function ordnerHandleFuerKunde(k, opts){
    if(!kuWurzelHandle){ return null; }
    if(!(await kuBerechtigungSicherstellen(kuWurzelHandle, "readwrite"))){
        return null;
    }
    const name = ordnerNameFuerKunde(k);
    try{
        return await kuWurzelHandle.getDirectoryHandle(name, {
            create: !!(opts && opts.create)
        });
    }catch(e){
        if(e.name === "NotFoundError"){ return null; }
        console.log("Ordner Handle:", e);
        return null;
    }
}

async function stelleOrdnerSicher(k){
    return await ordnerHandleFuerKunde(k, { create: true });
}

async function stelleAlleOrdnerSicher(){
    if(!kuWurzelHandle){ return 0; }
    let zaehler = 0;
    for(const k of kunden){
        if(k.archiviert){ continue; }
        try{
            await stelleOrdnerSicher(k);
            zaehler++;
        }catch(e){
            console.log("Ordner anlegen fehlgeschlagen für", k.id, e);
        }
    }
    return zaehler;
}

async function entferneKundenOrdner(k){
    if(!kuWurzelHandle){ return false; }
    if(!(await kuBerechtigungSicherstellen(kuWurzelHandle, "readwrite"))){
        return false;
    }
    const name = ordnerNameFuerKunde(k);
    try{
        await kuWurzelHandle.removeEntry(name, { recursive: true });
        return true;
    }catch(e){
        if(e.name === "NotFoundError"){ return true; }
        console.log("Ordner löschen:", e);
        return false;
    }
}

/* Bei Merge: Ordner des Verlierers in den des Siegers verschieben.
   Es gibt keine Rename-API — wir kopieren Dateien und löschen dann. */
async function mergeKundenOrdner(sieger, verlierer){
    if(!kuWurzelHandle){ return; }
    const vName = ordnerNameFuerKunde(verlierer);
    let vDir;
    try{
        vDir = await kuWurzelHandle.getDirectoryHandle(vName);
    }catch(e){
        return; // Verlierer hatte keinen Ordner
    }
    const sDir = await stelleOrdnerSicher(sieger);
    if(!sDir){ return; }

    for await (const [name, handle] of vDir.entries()){
        if(handle.kind !== "file"){ continue; }
        try{
            const datei = await handle.getFile();
            let zielName = name;
            // Bei Namenskonflikt Zeitstempel anhängen
            try{
                await sDir.getFileHandle(zielName);
                const stamp = new Date().toISOString().replace(/[:.]/g,"-");
                const punkt = zielName.lastIndexOf(".");
                zielName = punkt > 0
                    ? zielName.substring(0,punkt) + "_" + stamp + zielName.substring(punkt)
                    : zielName + "_" + stamp;
            }catch(e){ /* Datei existiert noch nicht — gut */ }
            const zielHandle = await sDir.getFileHandle(zielName, { create: true });
            const writer = await zielHandle.createWritable();
            await writer.write(await datei.arrayBuffer());
            await writer.close();
        }catch(e){
            console.log("Datei umziehen:", name, e);
        }
    }
    try{
        await kuWurzelHandle.removeEntry(vName, { recursive: true });
    }catch(e){ console.log("Verlierer-Ordner löschen:", e); }
}

/* =====================================================
   DATEIEN AUFLISTEN
   ===================================================== */

async function listeDateien(k){
    const dir = await ordnerHandleFuerKunde(k, { create: false });
    if(!dir){ return []; }
    const dateien = [];
    for await (const [name, handle] of dir.entries()){
        if(handle.kind !== "file"){ continue; }
        try{
            const f = await handle.getFile();
            dateien.push({ name, groesse: f.size, geaendert: f.lastModified, handle });
        }catch(e){}
    }
    dateien.sort((a,b) => b.geaendert - a.geaendert);
    return dateien;
}

/* =====================================================
   DATEI ÖFFNEN / HOCHLADEN / LÖSCHEN
   ===================================================== */

async function dateiOeffnen(kundenId, dateiName){
    const k = findeKunde(kundenId);
    if(!k){ return; }
    const dir = await ordnerHandleFuerKunde(k, { create: false });
    if(!dir){ return; }
    try{
        const fh = await dir.getFileHandle(dateiName);
        const datei = await fh.getFile();
        const url = URL.createObjectURL(datei);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }catch(e){
        alert("Datei konnte nicht geöffnet werden.");
    }
}

async function dateiLoeschen(kundenId, dateiName){
    if(!confirm("Datei \"" + dateiName + "\" endgültig löschen?")){ return; }
    const k = findeKunde(kundenId);
    if(!k){ return; }
    const dir = await ordnerHandleFuerKunde(k, { create: false });
    if(!dir){ return; }
    try{
        await dir.removeEntry(dateiName);
        kundenunterlagenPanelRendern(k);
    }catch(e){
        alert("Datei konnte nicht gelöscht werden.");
    }
}

async function dateienHochladen(kundenId, dateien){
    const k = findeKunde(kundenId);
    if(!k){ return; }
    const dir = await stelleOrdnerSicher(k);
    if(!dir){
        alert("Ordner konnte nicht angelegt werden.");
        return;
    }
    for(const datei of dateien){
        try{
            const fh = await dir.getFileHandle(datei.name, { create: true });
            const w = await fh.createWritable();
            await w.write(await datei.arrayBuffer());
            await w.close();
        }catch(e){
            console.log("Upload fehlgeschlagen:", datei.name, e);
        }
    }
    kundenunterlagenPanelRendern(k);
}

/* =====================================================
   VOLLBILD-DIALOG "ORDNER ÖFFNEN" (In-App Explorer)
   Browser kann keinen echten Explorer öffnen — dies ist
   die praktikable Alternative.
   ===================================================== */

async function kundenordnerModalOeffnen(kundenId){
    const k = findeKunde(kundenId);
    if(!k){ return; }
    if(!kuWurzelHandle){
        alert("Bitte zuerst einen Kundenunterlagen-Ordner wählen "
            + "(Dashboard → Datensicherung → Ordner auswählen).");
        return;
    }
    // Sicherstellen, dass Ordner existiert
    await stelleOrdnerSicher(k);

    const modal   = document.getElementById("kundenordnerModal");
    const inhalt  = document.getElementById("kundenordnerModalInhalt");
    const kopf    = document.getElementById("kundenordnerModalKopf");
    kopf.textContent = "Unterlagen: " + k.vorname + " " + k.nachname
        + "  (" + ordnerNameFuerKunde(k) + ")";
    inhalt.innerHTML = "<div class=\"eintrag-leer\">Lade …</div>";
    modal.style.display = "flex";

    const dateien = await listeDateien(k);
    if(dateien.length === 0){
        inhalt.innerHTML = "<div class=\"eintrag-leer\">Keine Dateien vorhanden</div>";
    }else{
        inhalt.innerHTML = "<div class=\"ku-datei-liste\">" + dateien.map(d =>
            `<div class="ku-datei-zeile">
                <a href="#" onclick="event.preventDefault();dateiOeffnen(${k.id},'${d.name.replace(/'/g,"\\'")}');">${esc(d.name)}</a>
                <span class="ku-datei-meta">${formatBytes(d.groesse)} · ${new Date(d.geaendert).toLocaleDateString("de-DE")}</span>
                <button class="eintrag-entfernen" onclick="dateiLoeschen(${k.id},'${d.name.replace(/'/g,"\\'")}');">×</button>
            </div>`
        ).join("") + "</div>";
    }
}

function kundenordnerModalSchliessen(){
    const modal = document.getElementById("kundenordnerModal");
    if(modal){ modal.style.display = "none"; }
}

function formatBytes(b){
    if(b < 1024){ return b + " B"; }
    if(b < 1024*1024){ return Math.round(b/1024) + " KB"; }
    return (b/1024/1024).toFixed(1) + " MB";
}

/* =====================================================
   PANEL IN DER KUNDENANSICHT
   ===================================================== */

async function kundenunterlagenPanelRendern(k){
    if(!k){ return; }
    const panel = document.getElementById("kundenunterlagenPanel");
    if(!panel){ return; }

    if(!kuUnterstuetzt){
        panel.innerHTML = `
            <div class="kd-abschnitt-kopf"><h3>Kundenunterlagen</h3></div>
            <div class="eintrag-leer">
                Dieser Browser unterstützt die File System Access API nicht.
                Bitte Chrome oder Edge verwenden.
            </div>`;
        return;
    }
    if(!kuWurzelHandle){
        panel.innerHTML = `
            <div class="kd-abschnitt-kopf"><h3>Kundenunterlagen</h3></div>
            <div class="eintrag-leer">
                Noch kein Wurzelordner ausgewählt.
                <button class="crm-button crm-button-klein" onclick="kuWurzelWaehlen()">
                    Ordner auswählen
                </button>
            </div>`;
        return;
    }

    panel.innerHTML = `
        <div class="kd-abschnitt-kopf">
            <h3>Kundenunterlagen</h3>
            <div style="display:flex;gap:6px;">
                <input type="file" multiple id="kuUploadInput_${k.id}"
                    style="display:none;"
                    onchange="dateienHochladen(${k.id}, Array.from(this.files)); this.value='';">
                <button class="crm-button crm-button-klein"
                    onclick="document.getElementById('kuUploadInput_${k.id}').click()">
                    + Datei
                </button>
                <button class="crm-button crm-button-klein"
                    onclick="kundenordnerModalOeffnen(${k.id})">
                    Ordner öffnen
                </button>
            </div>
        </div>
        <div class="ku-panel-body" id="kuPanelBody_${k.id}">
            <div class="eintrag-leer">Lade …</div>
        </div>
    `;

    const dir = await ordnerHandleFuerKunde(k, { create: false });
    const body = document.getElementById("kuPanelBody_" + k.id);
    if(!body){ return; }

    if(!dir){
        body.innerHTML = `
            <div class="eintrag-leer">
                Kein Ordner vorhanden.
                <button class="crm-button crm-button-klein" onclick="stelleOrdnerSicher(findeKunde(${k.id})).then(()=>kundenunterlagenPanelRendern(findeKunde(${k.id})))">
                    Ordner jetzt anlegen
                </button>
            </div>`;
        return;
    }

    const dateien = await listeDateien(k);
    if(dateien.length === 0){
        body.innerHTML = `<div class="eintrag-leer">Ordner "${esc(ordnerNameFuerKunde(k))}" (leer)</div>`;
        return;
    }
    const top5 = dateien.slice(0, 5);
    const rest = dateien.length - top5.length;
    body.innerHTML = `
        <div class="ku-datei-liste">
            ${top5.map(d =>
                `<div class="ku-datei-zeile">
                    <a href="#" onclick="event.preventDefault();dateiOeffnen(${k.id},'${d.name.replace(/'/g,"\\'")}');">${esc(d.name)}</a>
                    <span class="ku-datei-meta">${new Date(d.geaendert).toLocaleDateString("de-DE")}</span>
                </div>`
            ).join("")}
        </div>
        ${rest > 0
            ? `<button class="crm-button crm-button-klein"
                    style="margin-top:6px;" onclick="kundenordnerModalOeffnen(${k.id})">
                    ${rest} weitere Datei${rest === 1 ? "" : "en"} anzeigen …
                </button>`
            : ""
        }
    `;
}

/* =====================================================
   INITIALISIERUNG BEIM LADEN
   ===================================================== */

window.addEventListener("load", function(){
    kuInitialisieren();
});
