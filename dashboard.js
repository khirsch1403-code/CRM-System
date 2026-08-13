function dashboardAktualisieren(){

    document
    .getElementById(
        "dashboardKunden"
    )
    .innerText =

    kunden.filter(

        kunde =>

        !kunde.archiviert

    ).length;

    document
    .getElementById(
        "dashboardAufgaben"
    )
    .innerText =

    aufgaben.filter(

        aufgabe =>

        aufgabe.status !==
        "Erledigt"

    ).length;

    /* Abschlüsse laufendes Jahr — gewichtet:
       Turbo-/Flexdarlehen zählt als 2 Stücke
       (Bauspar + Finanzierung), alle anderen als 1. */
    const _turboSetDb = new Set([
        "Turbo-/Flexdarlehen", "Turbodarlehen"
    ]);
    const _aktJahr = new Date().getFullYear();

    let _abschlussGewichtet = 0;
    abschluesse.forEach(a => {
        if(!a.datum){ return; }
        if(new Date(a.datum).getFullYear() !== _aktJahr){ return; }
        _abschlussGewichtet += _turboSetDb.has(a.produkt) ? 2 : 1;
    });

    document
    .getElementById(
        "dashboardAbschluesse"
    )
    .innerText = _abschlussGewichtet;

    dashboardKontaktzahlen();

}

/* =====================================================
   LETZTER TERMIN
===================================================== */

function letzterTermin(kunde){

    if(!kunde.termine || kunde.termine.length === 0){
        return null;
    }

    // "Info"-Einträge zählen NICHT für die Kontaktüberwachung
    const echteKontakte = kunde.termine.filter(
        t => t.kategorie !== "Info (kein Kontakt)"
    );

    if(echteKontakte.length === 0){ return null; }

    return echteKontakte
    .slice()
    .sort((a,b) => new Date(b.datum) - new Date(a.datum))[0];

}

/* =====================================================
   DASHBOARD KONTAKTZAHLEN
===================================================== */

function dashboardKontaktzahlen(){

    const kontakt365 =

        kunden.filter(

            kunde => {

                const termin =
                letzterTermin(
                    kunde
                );

                if(!termin){

                    return false;

                }

                return tageSeit(
                    termin.datum
                ) > 365;

            }

        ).length;

    const kontakt730 =

        kunden.filter(

            kunde => {

                const termin =
                letzterTermin(
                    kunde
                );

                if(!termin){

                    return false;

                }

                return tageSeit(
                    termin.datum
                ) > 730;

            }

        ).length;

    document
    .getElementById(
        "dashboard365"
    )
    .innerText = kontakt365;

    document
    .getElementById(
        "dashboard730"
    )
    .innerText = kontakt730;

}

/* =====================================================
   KONTAKT LISTEN
===================================================== */

function kontaktListenAktualisieren(){

    const listeNie =
    document.getElementById(
        "kontaktNieListe"
    );

    const liste365 =
    document.getElementById(
        "kontakt365Liste"
    );

    const liste730 =
    document.getElementById(
        "kontakt730Liste"
    );

    listeNie.innerHTML = "";

    liste365.innerHTML = "";

    liste730.innerHTML = "";

    kunden
    .filter(kunde => !kunde.archiviert)
    .forEach(

        kunde => {

            const termin =
            letzterTermin(
                kunde
            );

            if(!termin){

                const eintrag =
                document.createElement(
                    "div"
                );

                eintrag.className =
                "kundenkarte";

                eintrag.innerHTML = `

                    <strong>

                    ${kunde.vorname}
                    ${kunde.nachname}

                    </strong>

                    <br>

                    Noch kein Termin erfasst

                `;

                eintrag.onclick =
                function(){

                    showTab(
                        "kunden"
                    );

                    kundeOeffnen(
                        kunde.id
                    );

                };

                listeNie.appendChild(
                    eintrag
                );

                return;
            }

            const tage =

            tageSeit(
                termin.datum
            );

            const eintrag =
            document.createElement(
                "div"
            );

            eintrag.className =
            "kundenkarte";

            eintrag.innerHTML = `

                <strong>

                ${kunde.vorname}
                ${kunde.nachname}

                </strong>

                <br>

                Letzter Termin:

                ${formatDatum(
                    termin.datum
                )}

                <br>

                ${tage} Tage her

            `;

            eintrag.onclick =
            function(){

                showTab(
                    "kunden"
                );

                kundeOeffnen(
                    kunde.id
                );

            };

            if(tage > 730){

                liste730.appendChild(
                    eintrag
                );

            }
            else if(tage > 365){

                liste365.appendChild(
                    eintrag
                );

            }

        }

    );

}



/* =====================================================
   PRODUKTIONSAUSWERTUNG DETAIL
===================================================== */

function produktionsauswertungAktualisieren(){

    const heute = new Date();
    const aktJahr = heute.getFullYear();
    const aktMonat = heute.getMonth();

    const monatsnamen = ["Januar","Februar","März","April","Mai","Juni",
        "Juli","August","September","Oktober","November","Dezember"];

    const jahresAbschluesse = abschluesse.filter(a =>
        a.datum && new Date(a.datum).getFullYear() === aktJahr
    );

    const monatsAbschluesse = jahresAbschluesse.filter(a =>
        new Date(a.datum).getMonth() === aktMonat
    );

    /* Anzeige-Name normalisieren: alte Datensätze mit "Turbodarlehen"
       werden zusammen mit "Turbo-/Flexdarlehen" gruppiert und einheitlich
       als "Turbo-/Flexdarlehen" beschriftet. */
    function produktAnzeigeName(name){
        if(name === "Turbodarlehen"){ return "Turbo-/Flexdarlehen"; }
        return name || "Unbekannt";
    }

    // Gruppieren nach Produkt (mit Namensnormalisierung)
    function nachProdukt(liste){
        const map = {};
        liste.forEach(a => {
            const p = produktAnzeigeName(a.produkt);
            map[p] = (map[p] || 0) + 1;
        });
        return Object.entries(map)
            .sort((a,b) => b[1] - a[1]);
    }

    /* Kategorie-Zählung mit korrekter Turbo-Doppelwertung.
       Turbo-/Flexdarlehen fließt in BEIDE Kategorien ein. */
    const bausparKat = new Set([
        "Neuer BSV", "Erhöhung BSV",
        "Turbo-/Flexdarlehen", "Turbodarlehen"
    ]);
    const finanzKat = new Set([
        "Finanzierung",
        "Turbo-/Flexdarlehen", "Turbodarlehen"
    ]);
    const turboSet = new Set([
        "Turbo-/Flexdarlehen", "Turbodarlehen"
    ]);

    function kategorieZaehlung(liste){
        let bauspar = 0;
        let finanz  = 0;
        liste.forEach(a => {
            if(bausparKat.has(a.produkt)){ bauspar++; }
            if(finanzKat.has(a.produkt)){ finanz++; }
        });
        return { bauspar, finanz };
    }

    /* Gewichtete Gesamtzahl: Turbo/Flex zählt als 2 Stücke
       (Bauspar + Finanzierung), alle anderen als 1. */
    function gewichteteAnzahl(liste){
        let summe = 0;
        liste.forEach(a => {
            summe += turboSet.has(a.produkt) ? 2 : 1;
        });
        return summe;
    }

    function renderKategorieZeile(zaehler){
        return `
            <div class="prod-kategorie-zeile">
                <span><strong>${zaehler.bauspar}</strong> Bauspar-Stück${zaehler.bauspar === 1 ? "" : "e"}</span>
                <span class="prod-kat-trenn">·</span>
                <span><strong>${zaehler.finanz}</strong> Finanzierungs-Stück${zaehler.finanz === 1 ? "" : "e"}</span>
            </div>
        `;
    }

    /* Icons kommen aus der zentralen Funktion produktIcon()
       in abschluesse.js — so bleibt alles konsistent. */

    function renderProduktliste(gruppen){
        if(gruppen.length === 0){
            return '<span style="color:var(--c-text-schwach);font-size:12px;">Keine Abschlüsse</span>';
        }
        return gruppen.map(([produkt, anzahl]) =>
            `<div class="prod-zeile">
                <span class="prod-zeile-label">${produktIcon(produkt)} ${produkt}</span>
                <span class="prod-zahl">${anzahl}</span>
            </div>`
        ).join("");
    }

    const container = document.getElementById("produktionsauswertung");
    if(!container){ return; }

    container.innerHTML = `
        <div class="prod-block">
            <div class="prod-titel">${monatsnamen[aktMonat]} ${aktJahr}
                <span class="prod-gesamt">${gewichteteAnzahl(monatsAbschluesse)}</span>
            </div>
            ${renderProduktliste(nachProdukt(monatsAbschluesse))}
            ${renderKategorieZeile(kategorieZaehlung(monatsAbschluesse))}
        </div>
        <div class="prod-block">
            <div class="prod-titel">Jahr ${aktJahr}
                <span class="prod-gesamt">${gewichteteAnzahl(jahresAbschluesse)}</span>
            </div>
            ${renderProduktliste(nachProdukt(jahresAbschluesse))}
            ${renderKategorieZeile(kategorieZaehlung(jahresAbschluesse))}
        </div>
    `;

}

// dashboardAktualisieren um Produktion erweitern
const _dashboardAktualisierenAlt = dashboardAktualisieren;
dashboardAktualisieren = function(){
    _dashboardAktualisierenAlt();
    produktionsauswertungAktualisieren();
};

