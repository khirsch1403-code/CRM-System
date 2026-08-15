/* =====================================================
   AUTO-BACKUP
   -----------------------------------------------------
   Speichert bei jedem App-Start automatisch einen JSON-
   Snapshot in einen frei gewaehlten lokalen Ordner (z. B.
   C:\Dokumente\CRM\Backups), sofern der letzte Backup
   >= 24 h zurueckliegt.

   Haelt rollierend die letzten 14 Snapshots vor, aeltere
   werden automatisch entfernt.

   Kein Netzwerk, kein Repo — alles lokal via
   File System Access API (Chrome / Edge).
===================================================== */

const AB_DB_NAME    = "crmAutoBackup";
const AB_STORE      = "handles";
const AB_KEY_ROOT   = "wurzel";
const AB_LS_LAST    = "crmAutoBackupLetzter";  // ISO-Zeit
const AB_MIN_ABSTAND_H = 24;
const AB_ANZAHL     = 14;

let abWurzelHandle = null;
let abUnterstuetzt = false;

function abFeatureCheck(){
    abUnterstuetzt =
        typeof window !== "undefined" &&
        "showDirectoryPicker" in window;
    return abUnterstuetzt;
}

/* =====================================================
   INDEXEDDB — Handle persistieren
===================================================== */

function abDbOeffnen(){
    return new Promise((resolve, reject) => {
        const anfrage = indexedDB.open(AB_DB_NAME, 1);
        anfrage.onupgradeneeded = e => {
            const db = e.target.result;
            if(!db.objectStoreNames.contains(AB_STORE)){
                db.createObjectStore(AB_STORE);
            }
        };
        anfrage.onsuccess = e => resolve(e.target.result);
        anfrage.onerror   = e => reject(e.target.error);
    });
}

async function abHandleSpeichern(handle){
    const db = await abDbOeffnen();
    const tx = db.transaction(AB_STORE, "readwrite");
    tx.objectStore(AB_STORE).put(handle, AB_KEY_ROOT);
    return new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
    });
}

async function abHandleLaden(){
    try{
        const db = await abDbOeffnen();
        const tx = db.transaction(AB_STORE, "readonly");
        const req = tx.objectStore(AB_STORE).get(AB_KEY_ROOT);
        return await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result || null);
            req.onerror   = () => rej(req.error);
        });
    }catch(e){
        return null;
    }
}

async function abHandleLoeschen(){
    const db = await abDbOeffnen();
    const tx = db.transaction(AB_STORE, "readwrite");
    tx.objectStore(AB_STORE).delete(AB_KEY_ROOT);
    return new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
    });
}

async function abBerechtigungSicherstellen(handle){
    if(!handle){ return false; }
    const opt = { mode: "readwrite" };
    if((await handle.queryPermission(opt)) === "granted"){ return true; }
    if((await handle.requestPermission(opt)) === "granted"){ return true; }
    return false;
}

/* =====================================================
   ORDNER WAEHLEN / ZURUECKSETZEN
===================================================== */

async function abOrdnerWaehlen(){
    if(!abFeatureCheck()){
        alert("Dein Browser unterstuetzt die File System Access API nicht.\n"
            + "Bitte Chrome oder Edge verwenden.");
        return;
    }
    try{
        const handle = await window.showDirectoryPicker({
            id: "crmAutoBackup",
            mode: "readwrite",
            startIn: "documents"
        });
        abWurzelHandle = handle;
        await abHandleSpeichern(handle);
        abStatusAnzeigen();

        if(confirm("Ordner \"" + handle.name + "\" ausgewaehlt.\n\n"
            + "Jetzt einen Backup anlegen?")){
            await autoBackupJetzt(true);
        }
    }catch(e){
        if(e.name === "AbortError"){ return; }
        fehlerMelden("Auto-Backup",
            "Ordner konnte nicht ausgewaehlt werden.", e);
    }
}

async function abOrdnerZuruecksetzen(){
    if(!confirm("Verknuepfung zum Auto-Backup-Ordner entfernen?\n"
        + "Bestehende Sicherungen bleiben unberuehrt.")){
        return;
    }
    abWurzelHandle = null;
    await abHandleLoeschen();
    localStorage.removeItem(AB_LS_LAST);
    abStatusAnzeigen();
}

/* =====================================================
   STATUS-ZEILE IM DASHBOARD
===================================================== */

function abStatusAnzeigen(){
    const el = document.getElementById("autoBackupStatus");
    if(!el){ return; }
    if(!abUnterstuetzt){
        el.textContent = "Auto-Backup: Browser nicht unterstuetzt (Chrome/Edge)";
        el.style.color = "var(--c-text-schwach)";
        return;
    }
    if(!abWurzelHandle){
        el.textContent = "Auto-Backup-Ordner nicht gesetzt";
        el.style.color = "var(--c-text-schwach)";
        return;
    }
    const letzter = localStorage.getItem(AB_LS_LAST);
    if(!letzter){
        el.textContent = "Ordner: " + abWurzelHandle.name +
            " — noch kein Backup";
        el.style.color = "var(--c-text-schwach)";
        return;
    }
    const dat = new Date(letzter);
    const alterTage = Math.floor((Date.now() - dat) / 86400000);
    const zeit = dat.toLocaleString("de-DE",
        { day:"2-digit", month:"2-digit", year:"numeric",
          hour:"2-digit", minute:"2-digit" });
    el.textContent = "Ordner: " + abWurzelHandle.name +
        " — letzter Backup: " + zeit +
        (alterTage > 7 ? " (⚠ " + alterTage + " Tage her)" : "");
    el.style.color = alterTage > 7
        ? "var(--c-warn-text)"
        : "var(--c-success-text)";
}

/* =====================================================
   BACKUP-DATEI ANLEGEN + ROLLING CLEANUP
===================================================== */

function abDateiname(){
    const j = new Date();
    const pad = n => String(n).padStart(2, "0");
    return "backup_" +
        j.getFullYear() + "-" +
        pad(j.getMonth() + 1) + "-" +
        pad(j.getDate()) + "_" +
        pad(j.getHours()) + pad(j.getMinutes()) +
        ".json";
}

async function abAelteEntfernen(dir){
    // Alle Dateien mit Prefix "backup_" auflisten,
    // nach Namen absteigend sortieren (Zeit steckt im Namen)
    // und alles ab Position AB_ANZAHL loeschen.
    const namen = [];
    for await (const [name, handle] of dir.entries()){
        if(handle.kind !== "file"){ continue; }
        if(!name.startsWith("backup_")){ continue; }
        namen.push(name);
    }
    namen.sort();  // alt → neu
    const zuLoeschen = namen.slice(0, Math.max(0, namen.length - AB_ANZAHL));
    for(const n of zuLoeschen){
        try{ await dir.removeEntry(n); }
        catch(e){
            fehlerMelden("Auto-Backup",
                "Altes Backup konnte nicht geloescht werden: " + n, e);
        }
    }
}

async function autoBackupJetzt(manuell){
    if(!abWurzelHandle){
        if(manuell){ alert("Kein Auto-Backup-Ordner gesetzt."); }
        return false;
    }
    if(!(await abBerechtigungSicherstellen(abWurzelHandle))){
        fehlerMelden("Auto-Backup",
            "Keine Schreibberechtigung fuer den Auto-Backup-Ordner. " +
            "Bitte Ordner ggf. neu waehlen.", null);
        return false;
    }
    try{
        const dateiname = abDateiname();
        const daten = {
            kunden: kunden,
            aufgaben: aufgaben,
            abschluesse: abschluesse,
            exportDatum: new Date().toISOString(),
            typ: "auto-backup"
        };
        const json = JSON.stringify(daten, null, 2);
        const fh = await abWurzelHandle.getFileHandle(dateiname, { create: true });
        const w = await fh.createWritable();
        await w.write(json);
        await w.close();

        localStorage.setItem(AB_LS_LAST, new Date().toISOString());

        // Rolling Cleanup — beste-Fall, keine Blockade bei Fehler
        try{ await abAelteEntfernen(abWurzelHandle); }catch(e){
            fehlerMelden("Auto-Backup",
                "Aufraeumen der alten Backups fehlgeschlagen.", e);
        }

        abStatusAnzeigen();
        if(manuell){
            alert("Backup gespeichert: " + dateiname);
        }
        return true;
    }catch(e){
        fehlerMelden("Auto-Backup",
            "Backup konnte nicht geschrieben werden.", e);
        if(manuell){
            alert("Backup fehlgeschlagen. Details im Fehler-Log.");
        }
        return false;
    }
}

async function autoBackupPruefen(){
    // Wird beim App-Start aufgerufen. Nur speichern, wenn
    // AB_MIN_ABSTAND_H Stunden seit dem letzten Backup vergangen sind.
    if(!abUnterstuetzt || !abWurzelHandle){ return; }
    const letzter = localStorage.getItem(AB_LS_LAST);
    if(letzter){
        const alterMs = Date.now() - new Date(letzter).getTime();
        const alterH  = alterMs / 3600000;
        if(alterH < AB_MIN_ABSTAND_H){ return; }
    }
    await autoBackupJetzt(false);
}

/* =====================================================
   BANNER: einmalige Aufforderung Ordner zu waehlen
===================================================== */

function abBannerZeigen(){
    if(document.getElementById("autoBackupBanner")){ return; }
    const banner = document.createElement("div");
    banner.id = "autoBackupBanner";
    banner.className = "benachrichtigung-banner";
    banner.innerHTML = `
        <span>
            🛟 Noch kein Auto-Backup eingerichtet.
            Ohne Sicherung sind Deine Daten nur im Browser gespeichert.
        </span>
        <div>
            <button class="crm-button crm-button-klein"
                onclick="document.getElementById('autoBackupBanner').remove();
                         localStorage.setItem('crmAutoBackupBannerGesehen','1');">
                Spaeter
            </button>
            <button class="crm-button crm-button-klein crm-button-primary"
                onclick="document.getElementById('autoBackupBanner').remove();
                         localStorage.setItem('crmAutoBackupBannerGesehen','1');
                         abOrdnerWaehlen();">
                Ordner waehlen
            </button>
        </div>
    `;
    document.body.appendChild(banner);
}

/* =====================================================
   INITIALISIERUNG BEIM APP-START
===================================================== */

async function autoBackupInitialisieren(){
    if(!abFeatureCheck()){
        abStatusAnzeigen();
        return;
    }
    abWurzelHandle = await abHandleLaden();
    abStatusAnzeigen();

    if(abWurzelHandle){
        // Kurz warten, damit die App-Daten sicher geladen sind
        setTimeout(() => { autoBackupPruefen(); }, 4000);
    }else if(!localStorage.getItem("crmAutoBackupBannerGesehen")){
        // Einmalige Aufforderung nach ca. 5 s
        setTimeout(abBannerZeigen, 5000);
    }
}

window.addEventListener("load", function(){
    autoBackupInitialisieren();
});
