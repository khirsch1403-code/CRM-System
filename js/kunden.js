function kundeAnlegen(){

    const kunde = {

        id: neueId(),

        partyIds: [],
        letzterImport: "",
        vorname:"",
        nachname:"",
        geburtsdatum:"",

        strasse:"",
        hausnummer:"",
        plz:"",
        ort:"",

        telefone:[],

        emails:[],

        vertraege:[],

kennzeichen:{
    keineBeratung:false,
    nurBuero:false,
    nurTelefon:false,
    nurMail:false,
    bestandVerlassen:false
},

        termine:[],

        notiz:"",

        archiviert:false

    };

    kunden.push(kunde);

    renderKunden();

    dashboardAktualisieren();

    triggerAutoSave();

    kundeOeffnen(kunde.id);

}

/* =====================================================
   KUNDENLISTE RENDERN
===================================================== */

function renderKunden(){

    const liste =

    document.getElementById(
        "kundenListe"
    );

    const suche =
    document.getElementById(
        "kundenSuche"
    )
    .value
    .toLowerCase()
    .trim();

    liste.innerHTML = "";

    kunden

    .filter(

        kunde =>

        !kunde.archiviert

    )

    .filter(

        kunde => {

            if(!suche){ return true; }

            const vertragsString =
            (kunde.vertraege || [])
            .map(v =>
                (typeof v === "string" ? v : v.nummer || "")
                + " " +
                (typeof v === "object" ? (v.produkt || "") : "")
            )
            .join(" ");

            const suchString = [
                kunde.vorname,
                kunde.nachname,
                kunde.strasse,
                kunde.hausnummer,
                kunde.plz,
                kunde.ort,
                (kunde.telefone || []).join(" "),
                (kunde.emails || []).join(" "),
                vertragsString,
                (kunde.partyIds || []).join(" ")
            ]
            .join(" ")
            .toLowerCase();

            // Alle Suchbegriffe (durch Leerzeichen getrennt)
            // müssen enthalten sein
            return suche
            .split(/\s+/)
            .every(begriff => suchString.includes(begriff));

        }

    )

    .forEach(

        kunde => {

            const div =

            document
            .createElement(
                "div"
            );

            div.className = "kundenkarte";
            div.dataset.kid = kunde.id;

            div.innerHTML = `
    <strong class="kk-name">
    ${kunde.vorname} ${kunde.nachname}
    ${kunde.kennzeichen.keineBeratung ? '<span class="tag" style="background:#7a1e35;color:white;">KB</span>' : ''}
    ${kunde.kennzeichen.nurBuero ? '<span class="tag" style="background:#6c757d;color:white;">B</span>' : ''}
    ${kunde.kennzeichen.nurTelefon ? '<span class="tag" style="background:#0d6efd;color:white;">T</span>' : ''}
    ${kunde.kennzeichen.nurMail ? '<span class="tag" style="background:#198754;color:white;">M</span>' : ''}
    ${kunde.kennzeichen.bestandVerlassen ? '<span class="tag" style="background:#561526;color:white;">BV</span>' : ''}
    </strong>
    <br>
    <span class="kk-ort">${kunde.plz} ${kunde.ort}</span>
    <br>
    Verträge: ${kunde.vertraege.length}
            `;

            div.onclick =
            () => {

                kundeOeffnen(
                    kunde.id
                );

            };

            liste.appendChild(
                div
            );

        }

    );

}

/* =====================================================
   HAUSHALTE SUCHEN
===================================================== */

function findeHaushalt(kunde){

    return kunden.filter(

        anderer =>

        anderer.id !== kunde.id &&

        anderer.strasse ===
        kunde.strasse &&

        anderer.hausnummer ===
        kunde.hausnummer &&

        anderer.plz ===
        kunde.plz &&

        anderer.ort ===
        kunde.ort

    );

}

/* =====================================================
   SIDEBAR KARTE AKTUALISIEREN (gezielt)
===================================================== */

function sidebarBadges(k){
    return (k.kennzeichen.keineBeratung ? '<span class="tag" style="background:#7a1e35;color:white;">KB</span>' : '') +
           (k.kennzeichen.nurBuero ? '<span class="tag" style="background:#6c757d;color:white;">B</span>' : '') +
           (k.kennzeichen.nurTelefon ? '<span class="tag" style="background:#3d2c7a;color:white;">T</span>' : '') +
           (k.kennzeichen.nurMail ? '<span class="tag" style="background:#2d6a4f;color:white;">M</span>' : '') +
           (k.kennzeichen.bestandVerlassen ? '<span class="tag" style="background:#4e1220;color:white;">BV</span>' : '');
}

function sidebarKarteAktualisieren(){
    if(!aktuellerKunde){ return; }
    const k = aktuellerKunde;
    const karte = document.querySelector(`.kundenkarte[data-kid="${k.id}"]`);
    if(!karte){ return; }
    karte.querySelector(".kk-name").innerHTML =
        k.vorname + " " + k.nachname + " " + sidebarBadges(k);
    karte.querySelector(".kk-ort").textContent =
        k.plz + " " + k.ort;
}


/* =====================================================
   KUNDE OEFFNEN
===================================================== */

function kundeOeffnen(id){

    aktuellerKunde = findeKunde(id);

    const details = document.getElementById("kundenDetails");

    const haushalt = findeHaushalt(aktuellerKunde);

    const k = aktuellerKunde;

    details.innerHTML = `

<div class="kd-kopf">

    <div>

        <div style="font-size:11px;color:var(--c-text-schwach);margin-bottom:4px;">
            PARTY-ID: ${k.partyIds ? k.partyIds.join(" | ") : "-"}
            &nbsp;·&nbsp; Bestandsabgleich: ${k.letzterImport || "-"}
        </div>

        <div class="kennzeichen-reihe" style="margin-bottom:0;">

            <button class="kennzeichen-btn ${k.kennzeichen.keineBeratung ? 'kennzeichen-aktiv-rot' : ''}"
            onclick="toggleKennzeichen('keineBeratung')">Keine Beratung</button>

            <button class="kennzeichen-btn ${k.kennzeichen.nurBuero ? 'kennzeichen-aktiv-grau' : ''}"
            onclick="toggleKennzeichen('nurBuero')">Nur Büro</button>

            <button class="kennzeichen-btn ${k.kennzeichen.nurTelefon ? 'kennzeichen-aktiv-blau' : ''}"
            onclick="toggleKennzeichen('nurTelefon')">Nur Telefon</button>

            <button class="kennzeichen-btn ${k.kennzeichen.nurMail ? 'kennzeichen-aktiv-gruen' : ''}"
            onclick="toggleKennzeichen('nurMail')">Nur Mail</button>

            <button class="kennzeichen-btn ${k.kennzeichen.bestandVerlassen ? 'kennzeichen-aktiv-dunkelrot' : ''}"
            onclick="toggleKennzeichen('bestandVerlassen')">Bestand verlassen</button>

        </div>

    </div>

</div>

<div class="kd-layout">

    <div class="kd-stamm">

        <div class="kd-grid-2">
            <input class="crm-input" id="editVorname" placeholder="Vorname" onblur="kundeSpeichern()" value="${k.vorname}">
            <input class="crm-input" id="editNachname" placeholder="Nachname" onblur="kundeSpeichern()" value="${k.nachname}">
        </div>

        <div class="kd-grid-adresse">
            <input class="crm-input kd-strasse" id="editStrasse" placeholder="Straße" onblur="kundeSpeichern()" value="${k.strasse}">
            <input class="crm-input kd-nr" id="editHausnummer" placeholder="Nr." onblur="kundeSpeichern()" value="${k.hausnummer}">
        </div>

        <div class="kd-grid-plzort">
            <input class="crm-input kd-plz" id="editPlz" placeholder="PLZ" onblur="kundeSpeichern()" value="${k.plz}">
            <input class="crm-input kd-ort" id="editOrt" placeholder="Ort" onblur="kundeSpeichern()" value="${k.ort}">
        </div>

        <div class="kd-kontakte-grid-2">

            <div class="kd-kontakt-spalte">
                <div class="kd-kontakt-kopf">
                    <span>Telefon</span>
                    <button class="eintrag-plus" onclick="telefonHinzufuegen()">+</button>
                </div>
                <div class="eintrag-liste">
                ${k.telefone.length === 0
                    ? '<div class="eintrag-leer">–</div>'
                    : k.telefone.map((t,i) =>
                        `<div class="eintrag-zeile"><span>${t}</span>
                        <button class="eintrag-entfernen" onclick="telefonLoeschen(${i})">×</button></div>`
                      ).join("")
                }
                </div>
            </div>

            <div class="kd-kontakt-spalte">
                <div class="kd-kontakt-kopf">
                    <span>E-Mail</span>
                    <button class="eintrag-plus" onclick="emailHinzufuegen()">+</button>
                </div>
                <div class="eintrag-liste">
                ${k.emails.length === 0
                    ? '<div class="eintrag-leer">–</div>'
                    : k.emails.map((e,i) =>
                        `<div class="eintrag-zeile">
                        <a class="eintrag-email" href="mailto:${e}">${e}</a>
                        <button class="eintrag-entfernen" onclick="emailLoeschen(${i})">×</button></div>`
                      ).join("")
                }
                </div>
            </div>

        </div>

    </div>

    <div class="kd-notiz">

        <div class="kd-grid-geburtstag">
            <label class="kd-geburtstag-label">Geburtsdatum</label>
            <input class="crm-input" id="editGeburtsdatum"
                type="text"
                placeholder="TT.MM.JJJJ"
                onblur="kundeSpeichern()"
                value="${k.geburtsdatum || ""}">
        </div>

        <label style="margin-top:12px;">Notiz</label>

        <textarea class="crm-textarea kd-notiz-textarea" id="editNotiz"
            onblur="kundeSpeichern()"
            onkeydown="notizAutoBullet(event, this)">${k.notiz}</textarea>

    </div>

</div>

<div class="kd-abschnitt">

    <div class="kd-abschnitt-kopf">
        <h3>Verträge</h3>
        <button class="crm-button crm-button-klein" onclick="vertragHinzufuegen()">+ Vertrag</button>
    </div>

    ${k.vertraege.length === 0
        ? '<div class="eintrag-leer">Keine Verträge vorhanden</div>'
        : `<div class="vertrag-tabelle">
            <div class="vertrag-zeile vertrag-kopf">
                <span>Vertragsnummer</span>
                <span>Produkt</span>
                <span>Bausparsumme</span>
                <span>Saldo</span>
                <span>Guthaben %</span>
                <span></span>
            </div>
            ${k.vertraege.map((v,i) => {
                const vObj = typeof v === "string" ? { nummer: v } : v;
                return `<div class="vertrag-zeile">
                    <span class="vertrag-nummer">
                        <strong>${vObj.nummer || "-"}</strong>
                        ${vObj.zuteilungsdatum
                            ? `<span class="vertrag-zuteilung">Zuteilung: ${vObj.zuteilungsdatum}</span>`
                            : ""}
                    </span>
                    <span>${vObj.produkt || "-"}</span>
                    <span>${vObj.bausparsumme || "-"}</span>
                    <span>${vObj.saldo || "-"}</span>
                    <span>${vObj.guthabenProzent || "-"}</span>
                    <button class="eintrag-entfernen" onclick="vertragLoeschen(${i})">×</button>
                </div>`;
            }).join("")}
        </div>`
    }

</div>

<div class="kd-abschnitt">

    <h3>Haushalt</h3>

    ${haushalt.length === 0

    ? "<div style=\"color:var(--c-text-schwach);font-size:13px;\">Kein weiterer Haushalt gefunden</div>"

    : haushalt.map(person => {

        const echteKontakte = (person.termine || [])
            .filter(t => t.kategorie !== "Info (kein Kontakt)");

        const letzterKontakt =
        echteKontakte.length > 0
        ? echteKontakte.slice().sort(
            (a,b) => new Date(b.datum) - new Date(a.datum)
          )[0].datum
        : null;

        const tageAlt = letzterKontakt ? tageSeit(letzterKontakt) : null;

        const kontaktAnzeige =
        letzterKontakt
        ? (tageAlt === 0 ? "Heute" : tageAlt === 1 ? "Gestern" : "vor " + tageAlt + " Tagen")
        : "Noch kein Kontakt";

        const kontaktFarbe =
        !letzterKontakt ? "var(--c-text-schwach)"
        : tageAlt > 730 ? "var(--c-danger)"
        : tageAlt > 365 ? "var(--c-warn-text)"
        : "var(--c-success-text)";

        return `<div class="haushalt-mitglied">
            <div class="haushalt-mitglied-info">
                <strong class="haushalt-mitglied-name" onclick="kundeOeffnen(${person.id})">${person.vorname} ${person.nachname}</strong>
                <span class="haushalt-mitglied-kontakt" style="color:${kontaktFarbe};">${kontaktAnzeige}</span>
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
            ${person.kennzeichen.keineBeratung ? '<span class="kennzeichen-badge kennzeichen-badge-rot">KB</span>' : ''}
            ${person.kennzeichen.nurBuero ? '<span class="kennzeichen-badge kennzeichen-badge-grau">Büro</span>' : ''}
            ${person.kennzeichen.nurTelefon ? '<span class="kennzeichen-badge kennzeichen-badge-blau">Telefon</span>' : ''}
            ${person.kennzeichen.nurMail ? '<span class="kennzeichen-badge kennzeichen-badge-gruen">Mail</span>' : ''}
            ${person.kennzeichen.bestandVerlassen ? '<span class="kennzeichen-badge kennzeichen-badge-dunkelrot">BV</span>' : ''}
            </div>
        </div>`;

    }).join("")

    }

</div>

<div class="kd-abschnitt" id="kundenunterlagenPanel">
</div>

<div class="kd-abschnitt" id="kd-termine-bereich">

    <div class="kd-abschnitt-kopf">
        <h3>Kontakte</h3>
        <button class="crm-button crm-button-klein" onclick="terminAnlegen()">+ Kontakt</button>
    </div>

</div>

<div class="kd-archivieren">

    <button class="crm-button crm-button-klein crm-button-gefahr" onclick="kundeArchivieren()">
        Kunde archivieren
    </button>

</div>

`;

    // Kundenunterlagen-Panel nachladen (asynchron)
    if(typeof kundenunterlagenPanelRendern === "function"){
        kundenunterlagenPanelRendern(k);
    }

}

/* =====================================================
   KUNDE SPEICHERN
===================================================== */

function kundeSpeichern(){

    if(!aktuellerKunde){ return; }

    // Daten leise aktualisieren — kein Panel-Rebuild
    aktuellerKunde.vorname =
        document.getElementById("editVorname").value.trim();

    aktuellerKunde.nachname =
        document.getElementById("editNachname").value.trim();

    aktuellerKunde.strasse =
        document.getElementById("editStrasse").value.trim();

    aktuellerKunde.hausnummer =
        document.getElementById("editHausnummer").value.trim();

    aktuellerKunde.plz =
        document.getElementById("editPlz").value.trim();

    aktuellerKunde.ort =
        document.getElementById("editOrt").value.trim();

    aktuellerKunde.geburtsdatum =
        document.getElementById("editGeburtsdatum").value.trim();

    aktuellerKunde.notiz =
        document.getElementById("editNotiz").value;

    // Nur den Sidebar-Eintrag dieses Kunden aktualisieren
    // (Name könnte sich geändert haben)
    const karte = document.querySelector(
        `.kundenkarte[data-kid="${aktuellerKunde.id}"]`
    );

    if(karte){
        karte.querySelector(".kk-name").innerHTML =
            aktuellerKunde.vorname + " " +
            aktuellerKunde.nachname + " " +
            sidebarBadges(aktuellerKunde);

        karte.querySelector(".kk-ort").textContent =
            aktuellerKunde.plz + " " + aktuellerKunde.ort;
    }

    // Kurzes "Gespeichert"-Feedback am Speichern-Button
    const btn = document.querySelector(
        ".kd-kopf .crm-button-primary"
    );

    if(btn){
        const original = btn.textContent;
        btn.textContent = "✓ Gespeichert";
        btn.style.background = "var(--c-success-text)";
        btn.style.borderColor = "var(--c-success-text)";
        setTimeout(() => {
            btn.textContent = original;
            btn.style.background = "";
            btn.style.borderColor = "";
        }, 1500);
    }

    // Verknüpfte Aufgaben und Abschlüsse synchronisieren
    const neuerName =
        aktuellerKunde.vorname + " " +
        aktuellerKunde.nachname;

    aufgaben.forEach(a => {
        if(a.kundenId === aktuellerKunde.id){
            a.kundenName = neuerName;
        }
    });

    abschluesse.forEach(a => {
        if(a.kundenId === aktuellerKunde.id){
            a.kundenName = neuerName;
        }
    });

    // Betroffene Ansichten aktualisieren
    // (nur die jeweiligen Tabs, kein Rebuild des Kundendatenblatts)
    renderAufgaben();
    renderAbschluesse();
    kontaktListenAktualisieren();
    dashboardAktualisieren();
    triggerAutoSave();

}

/* =====================================================
   TELEFON HINZUFUEGEN
===================================================== */

function telefonHinzufuegen(){

    const wert = prompt("Telefonnummer");
    if(!wert){ return; }

    const norm = normalisiereTelefon(wert);
    if(!norm){
        alert("Ungültige Telefonnummer.");
        return;
    }

    const key = telefonSchluessel(wert);
    const existiert = (aktuellerKunde.telefone || [])
        .some(t => telefonSchluessel(t) === key);

    if(existiert){
        alert("Diese Telefonnummer ist bereits hinterlegt.");
        return;
    }

    aktuellerKunde.telefone.push(norm);
    kundeOeffnen(aktuellerKunde.id);

}

/* =====================================================
   TELEFON LOESCHEN
===================================================== */

function telefonLoeschen(index){

    if(!aktuellerKunde){

        return;

    }

    if(
        !confirm(
            "Telefonnummer löschen?"
        )
    ){

        return;

    }

    aktuellerKunde
    .telefone
    .splice(
        index,
        1
    );

    kundeOeffnen(
        aktuellerKunde.id
    );

}

/* =====================================================
   EMAIL HINZUFUEGEN
===================================================== */

function emailHinzufuegen(){

    const wert = prompt("E-Mail");
    if(!wert){ return; }

    const norm = normalisiereEmail(wert);
    if(!norm){
        alert("Ungültige E-Mail-Adresse.");
        return;
    }

    const existiert = (aktuellerKunde.emails || [])
        .some(e => normalisiereEmail(e) === norm);

    if(existiert){
        alert("Diese E-Mail-Adresse ist bereits hinterlegt.");
        return;
    }

    aktuellerKunde.emails.push(norm);
    kundeOeffnen(aktuellerKunde.id);

}

/* =====================================================
   EMAIL LOESCHEN
===================================================== */

function emailLoeschen(index){

    if(!aktuellerKunde){

        return;

    }

    if(
        !confirm(
            "E-Mail löschen?"
        )
    ){

        return;

    }

    aktuellerKunde
    .emails
    .splice(
        index,
        1
    );

    kundeOeffnen(
        aktuellerKunde.id
    );

}

/* =====================================================
   VERTRAG HINZUFUEGEN
===================================================== */

function vertragHinzufuegen(){

    const wert = prompt("Vertragsnummer");

    if(!wert){ return; }

    aktuellerKunde.vertraege.push({ nummer: wert.trim() });

    kundeOeffnen(aktuellerKunde.id);

    triggerAutoSave();

}

/* =====================================================
   NOTIZ AUTO-BULLET (• bei Enter am Zeilenanfang)
===================================================== */

function notizAutoBullet(event, textarea){

    if(event.key !== "Enter"){ return; }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const wert = textarea.value;

    // Aktuelle Zeile ermitteln
    const zeileStart = wert.lastIndexOf("\n", start - 1) + 1;
    const aktuelleZeile = wert.substring(zeileStart, start);
    const bulletMatch = aktuelleZeile.match(/^(•\s+)/);

    // Fall 1: Aktuelle Zeile ist nur "• " → Bullet wieder entfernen,
    // normale neue Zeile einfügen (Aufzählung beenden).
    if(bulletMatch && aktuelleZeile.substring(bulletMatch[1].length).trim() === ""){
        event.preventDefault();
        const vorher = wert.substring(0, zeileStart);
        const nachher = wert.substring(end);
        textarea.value = vorher + "\n" + nachher;
        textarea.selectionStart = textarea.selectionEnd = zeileStart + 1;
        return;
    }

    // Fall 2: Immer neue Bullet-Zeile einfügen
    event.preventDefault();
    const vorher = wert.substring(0, start);
    const nachher = wert.substring(end);

    // Wenn die aktuelle Zeile noch keinen Bullet hat, den nachträglich
    // vorne einfügen (damit auch die erste Zeile eine Aufzählung ist)
    let neuerText;
    let neuePosition;

    if(!bulletMatch && aktuelleZeile.trim() !== ""){
        // Bullet vorne an aktuelle Zeile setzen
        const vorZeile = wert.substring(0, zeileStart);
        const zeileMitBullet = "• " + aktuelleZeile;
        neuerText = vorZeile + zeileMitBullet + "\n• " + nachher;
        neuePosition = vorZeile.length + zeileMitBullet.length + 3;
    }else{
        neuerText = vorher + "\n• " + nachher;
        neuePosition = start + 3;
    }

    textarea.value = neuerText;
    textarea.selectionStart = textarea.selectionEnd = neuePosition;

}

/* =====================================================
   VERTRAG LOESCHEN
===================================================== */

function vertragLoeschen(index){

    if(!aktuellerKunde){

        return;

    }

    if(
        !confirm(
            "Vertrag löschen?"
        )
    ){

        return;

    }

    aktuellerKunde
    .vertraege
    .splice(
        index,
        1
    );

    kundeOeffnen(
        aktuellerKunde.id
    );

}

/* =====================================================
   KENNZEICHEN TOGGLE
===================================================== */

function toggleKennzeichen(name){

    if(!aktuellerKunde){ return; }

    aktuellerKunde.kennzeichen[name] =
    !aktuellerKunde.kennzeichen[name];

    // Nur den Kennzeichen-Button aktualisieren (kein Panel-Rebuild)
    const btn = document.querySelector(
        `.kennzeichen-btn[onclick*="${name}"]`
    );

    if(btn){
        const klassenMap = {
            keineBeratung: "kennzeichen-aktiv-rot",
            nurBuero:      "kennzeichen-aktiv-grau",
            nurTelefon:    "kennzeichen-aktiv-blau",
            nurMail:       "kennzeichen-aktiv-gruen",
            bestandVerlassen: "kennzeichen-aktiv-dunkelrot"
        };
        const klasse = klassenMap[name];
        if(klasse){
            btn.classList.toggle(
                klasse,
                aktuellerKunde.kennzeichen[name]
            );
        }
    }

    sidebarKarteAktualisieren();
    triggerAutoSave();

}

function kennzeichenHinzufuegen(){

    return;

}

/* =====================================================
   KUNDE ARCHIVIEREN
===================================================== */

function kundeArchivieren(){

    if(!aktuellerKunde){

        return;

    }

    aktuellerKunde
    .archiviert = true;

    renderKunden();

    dashboardAktualisieren();
    triggerAutoSave();
    document
    .getElementById(
        "kundenDetails"
    )
    .innerHTML =

    "<h2>Kunde archiviert</h2>";

}

/* =====================================================
   ARCHIV
===================================================== */

function renderArchiv(){

    const liste =
    document.getElementById(
        "archivListe"
    );

    liste.innerHTML = "";

    const archivierte =
    kunden.filter(
        kunde => kunde.archiviert
    );

    if(archivierte.length === 0){

        liste.innerHTML =
        "<p style=\"color:var(--c-text-muted);\">" +
        "Keine archivierten Kunden vorhanden." +
        "</p>";

        return;

    }

    archivierte.forEach(kunde => {

        const eintrag =
        document.createElement("div");

        eintrag.className =
        "kundenkarte";

        eintrag.style.cursor =
        "default";

        eintrag.innerHTML =

        "<strong>" +
        kunde.vorname + " " + kunde.nachname +
        "</strong>" +

        "<div style=\"margin-top:8px;display:flex;gap:8px;\">" +

        "<button class=\"crm-button crm-button-klein\" " +
        "onclick=\"kundeWiederherstellen(" + kunde.id + ")\">" +
        "Wiederherstellen</button>" +

        "<button class=\"crm-button crm-button-klein crm-button-gefahr\" " +
        "onclick=\"kundeEndgueltigLoeschen(" + kunde.id + ")\">" +
        "Endgültig löschen</button>" +

        "</div>";

        liste.appendChild(eintrag);

    });

}

function kundeWiederherstellen(id){

    const kunde =
    findeKunde(id);

    if(!kunde){
        return;
    }

    kunde.archiviert = false;

    renderArchiv();

    renderKunden();

    dashboardAktualisieren();
    triggerAutoSave();
}

function kundeEndgueltigLoeschen(id){

    if(

        !confirm(
            "Diesen Kunden unwiderruflich " +
            "löschen? Das kann nicht " +
            "rückgängig gemacht werden."
        )

    ){

        return;

    }

    const zuLoeschen = findeKunde(id);

    // Zugehörigen Ordner mit entfernen (falls Kundenunterlagen aktiv)
    if(zuLoeschen && typeof entferneKundenOrdner === "function"){
        const mitOrdner = confirm(
            "Zugehörigen Unterlagen-Ordner \""
            + (typeof ordnerNameFuerKunde === "function" ? ordnerNameFuerKunde(zuLoeschen) : "")
            + "\" ebenfalls von der Festplatte löschen?"
        );
        if(mitOrdner){
            entferneKundenOrdner(zuLoeschen);
        }
    }

    kunden =
    kunden.filter(
        kunde => kunde.id !== id
    );

    renderArchiv();

    renderKunden();

    dashboardAktualisieren();
    triggerAutoSave();
}

/* =====================================================
   EVENTS
===================================================== */

document
.getElementById(
    "kundeAnlegenButton"
)
.addEventListener(

    "click",

    kundeAnlegen

);

document
.getElementById(
    "kundenSuche"
)
.addEventListener(

    "keyup",

    renderKunden

);


/* =====================================================
   TERMINVERWALTUNG
===================================================== */

/* =====================================================
   TERMIN ANLEGEN
===================================================== */

/* =====================================================
   BESTAND-VERLASSEN → ARCHIV
   Verschiebt alle nicht-archivierten Kunden mit dem
   Kennzeichen "bestandVerlassen" in einem Rutsch ins Archiv.
===================================================== */

function bestandVerlassenArchivieren(){

    const kandidaten =
    kunden.filter(k =>
        !k.archiviert &&
        k.kennzeichen &&
        k.kennzeichen.bestandVerlassen === true
    );

    if(kandidaten.length === 0){
        alert("Kein Kunde mit dem Marker \"Bestand verlassen\" gefunden.");
        return;
    }

    const bestaetigt = confirm(
        kandidaten.length +
        (kandidaten.length === 1
            ? " Kunde mit dem Marker \"Bestand verlassen\" wird ins Archiv verschoben. Fortfahren?"
            : " Kunden mit dem Marker \"Bestand verlassen\" werden ins Archiv verschoben. Fortfahren?")
    );

    if(!bestaetigt){ return; }

    kandidaten.forEach(k => {
        k.archiviert = true;
        k.archiviertAm = new Date().toISOString();
    });

    /* Falls der aktuell geöffnete Kunde betroffen war, Detailansicht zurücksetzen */
    if(aktuellerKunde && aktuellerKunde.archiviert){
        aktuellerKunde = null;
        const details = document.getElementById("kundenDetails");
        if(details){
            details.innerHTML = "<h2>Kein Kunde ausgewählt</h2>";
        }
    }

    renderKunden();
    dashboardAktualisieren();
    triggerAutoSave();

    alert(kandidaten.length +
        (kandidaten.length === 1 ? " Kunde" : " Kunden") +
        " ins Archiv verschoben.");
}
