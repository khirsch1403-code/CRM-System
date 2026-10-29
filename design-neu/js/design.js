/* =====================================================
   DESIGN / FARBPALETTE
   -----------------------------------------------------
   Lokale Farbanpassung pro Browser.
   Werte in localStorage (JSON unter "crmDesign").
   Setzt CSS-Variablen auf :root → wirkt sofort ueberall.
   Berechnet abgeleitete Toene (dunkler, soft)
   automatisch aus der Primaerfarbe.
===================================================== */

const DESIGN_LS_KEY = "crmDesign";

/* Standard-Werte (muessen zu style.css :root passen) */
const DESIGN_STANDARD = {
    primary: "#7a1e35",
    accent:  "#9a7a2e",
    bg:      "#f5eeec",
    text:    "#1a1210",
    border:  "#e8d9d4"
};

/* 5 Presets — klickbar als Vorschau, einzelne Felder bleiben
   nach Preset-Auswahl weiter manuell anpassbar. */
const DESIGN_PRESETS = {
    bordeaux: {
        name: "Bordeaux",
        primary: "#7a1e35",
        accent:  "#9a7a2e",
        bg:      "#f5eeec",
        text:    "#1a1210",
        border:  "#e8d9d4"
    },
    nachtblau: {
        name: "Nachtblau",
        primary: "#1e3a5f",
        accent:  "#c99a2e",
        bg:      "#eef2f7",
        text:    "#0f1a2a",
        border:  "#d4dde8"
    },
    wald: {
        name: "Wald",
        primary: "#2d5a3d",
        accent:  "#b8862a",
        bg:      "#f0f2ec",
        text:    "#141a14",
        border:  "#d7ddd0"
    },
    sonnenaufgang: {
        name: "Sonnenaufgang",
        primary: "#b84f1a",
        accent:  "#5a7d3a",
        bg:      "#fdf4ec",
        text:    "#2a1810",
        border:  "#f0ddc8"
    },
    graphit: {
        name: "Graphit",
        primary: "#3a3a3a",
        accent:  "#6b8e9a",
        bg:      "#f2f2f0",
        text:    "#1a1a1a",
        border:  "#d8d8d6"
    }
};

/* ---- Farbkonvertierung Hex <-> HSL ---- */

function _hexToHsl(hex){
    hex = String(hex || "").replace("#","").trim();
    if(hex.length !== 6){ return [0, 0, 50]; }
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if(max !== min){
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

function _hslToHex(h, s, l){
    h = ((h % 360) + 360) % 360 / 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    let r, g, b;
    if(s === 0){ r = g = b = l; }
    else{
        const hue2rgb = (p, q, t) => {
            if(t < 0){ t += 1; }
            if(t > 1){ t -= 1; }
            if(t < 1 / 6){ return p + (q - p) * 6 * t; }
            if(t < 1 / 2){ return q; }
            if(t < 2 / 3){ return p + (q - p) * (2 / 3 - t) * 6; }
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    return "#" + toHex(r) + toHex(g) + toHex(b);
}

function _mitLightness(hex, l){
    const [h, s] = _hexToHsl(hex);
    return _hslToHex(h, s, l);
}

function _dunkler(hex, delta){
    const [h, s, l] = _hexToHsl(hex);
    return _hslToHex(h, s, l - delta);
}

function _heller(hex, delta){
    const [h, s, l] = _hexToHsl(hex);
    return _hslToHex(h, s, l + delta);
}

/* =====================================================
   LADEN / SPEICHERN
===================================================== */

function designLaden(){
    try{
        const raw = localStorage.getItem(DESIGN_LS_KEY);
        if(!raw){ return Object.assign({}, DESIGN_STANDARD); }
        const d = JSON.parse(raw);
        return Object.assign({}, DESIGN_STANDARD, d);
    }catch(_){
        return Object.assign({}, DESIGN_STANDARD);
    }
}

function designSpeichern(d){
    try{
        localStorage.setItem(DESIGN_LS_KEY, JSON.stringify(d));
    }catch(_){}
}

function designZuruecksetzen(){
    try{ localStorage.removeItem(DESIGN_LS_KEY); }catch(_){}
    designAnwenden(DESIGN_STANDARD);
    designModalFelderFuellen(DESIGN_STANDARD);
}

/* =====================================================
   ANWENDEN — setzt CSS-Variablen auf :root
===================================================== */

function designAnwenden(d){
    const root = document.documentElement;

    const primary       = d.primary || DESIGN_STANDARD.primary;
    const primaryDunkel = _dunkler(primary, 10);
    const primarySoft   = _mitLightness(primary, 94);

    const accent        = d.accent  || DESIGN_STANDARD.accent;
    const accentSoft    = _mitLightness(accent, 92);

    const bg            = d.bg      || DESIGN_STANDARD.bg;
    const surface       = _heller(bg, 4);
    const surfaceMuted  = _heller(bg, 2);

    const border        = d.border  || DESIGN_STANDARD.border;
    const borderStark   = _dunkler(border, 10);

    const text          = d.text    || DESIGN_STANDARD.text;
    const textMuted     = _heller(text, 25);
    const textSchwach   = _heller(text, 45);

    /* -------------------------------------------------
       EDITORIAL REDESIGN:
       design.js setzt NUR noch die Markenfarben (Bordeaux
       + Akzent) inline. Die neutralen Toene (Hintergrund/
       Text/Rahmen) und die abgeleiteten -soft/-text-Toene
       gehoeren dem Theme (hell/dunkel) im Stylesheet und
       rechnen sich dort per color-mix. So funktioniert der
       Dark Mode zuverlaessig und die Markenfarbe bleibt in
       beiden Themes anpassbar.
       Die lokalen Variablen bg/surface/text/border werden
       bewusst nicht mehr auf :root geschrieben.
       ------------------------------------------------- */
    void surface; void surfaceMuted; void borderStark;
    void textMuted; void textSchwach; void primarySoft; void accentSoft;

    root.style.setProperty("--c-primary", primary);
    root.style.setProperty("--c-primary-dunkel", primaryDunkel);
    root.style.setProperty("--c-accent", accent);
}

/* =====================================================
   THEME (Hell / Dunkel) — Umschalter in der Navbar
===================================================== */

const THEME_LS_KEY = "crmTheme";

function themeAktuell(){
    const gesetzt = document.documentElement.getAttribute("data-theme");
    if(gesetzt === "dark" || gesetzt === "light"){ return gesetzt; }
    const dunkelSystem = window.matchMedia
        && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return dunkelSystem ? "dark" : "light";
}

function themeAnwenden(theme){
    document.documentElement.setAttribute("data-theme", theme);
    try{ localStorage.setItem(THEME_LS_KEY, theme); }catch(_){}
    themeIconAktualisieren(theme);
}

function themeUmschalten(){
    /* Weicher Farbuebergang: Transitions nur waehrend des Wechsels
       aktivieren, danach wieder entfernen (kein Nachziehen im Betrieb). */
    const root = document.documentElement;
    const reduce = window.matchMedia
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!reduce){
        root.classList.add("theme-wechsel");
        clearTimeout(themeUmschalten._t);
        themeUmschalten._t = setTimeout(
            () => root.classList.remove("theme-wechsel"), 520);
    }
    themeAnwenden(themeAktuell() === "dark" ? "light" : "dark");
}

function themeIconAktualisieren(theme){
    const btn = document.getElementById("themeToggle");
    if(!btn){ return; }
    const dunkel = theme === "dark";
    btn.textContent = dunkel ? "☀" : "🌙";
    btn.title = dunkel ? "Zum Hellmodus wechseln" : "Zum Dunkelmodus wechseln";
}

document.addEventListener("DOMContentLoaded", function(){
    themeIconAktualisieren(themeAktuell());
});

/* Sofort beim Laden anwenden — damit nichts flackert */
designAnwenden(designLaden());

/* =====================================================
   MODAL
===================================================== */

function designModalOeffnen(){
    designPresetLeisteRendern();
    designModalFelderFuellen(designLaden());
    const modal = document.getElementById("designModal");
    if(modal){ modal.style.display = "flex"; }
}

function designModalSchliessen(){
    const modal = document.getElementById("designModal");
    if(modal){ modal.style.display = "none"; }
}

function designModalFelderFuellen(d){
    const map = {
        designInputPrimary: d.primary,
        designInputAccent:  d.accent,
        designInputBg:      d.bg,
        designInputText:    d.text,
        designInputBorder:  d.border
    };
    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if(el){ el.value = map[id]; }
    });
}

/* Live-Vorschau: sofort anwenden bei jeder Aenderung,
   endgueltig gespeichert wird erst mit "Uebernehmen" */
function designInputGeaendert(){
    const d = {
        primary: document.getElementById("designInputPrimary").value,
        accent:  document.getElementById("designInputAccent").value,
        bg:      document.getElementById("designInputBg").value,
        text:    document.getElementById("designInputText").value,
        border:  document.getElementById("designInputBorder").value
    };
    designAnwenden(d);
}

function designUebernehmen(){
    const d = {
        primary: document.getElementById("designInputPrimary").value,
        accent:  document.getElementById("designInputAccent").value,
        bg:      document.getElementById("designInputBg").value,
        text:    document.getElementById("designInputText").value,
        border:  document.getElementById("designInputBorder").value
    };
    designSpeichern(d);
    designAnwenden(d);
    designModalSchliessen();
}

function designAbbrechen(){
    // Live-Vorschau rueckgaengig → wieder den gespeicherten Stand setzen
    designAnwenden(designLaden());
    designModalSchliessen();
}

/* Preset auswaehlen: Felder fuellen + Live-Vorschau.
   Noch nicht gespeichert — "Uebernehmen" ist weiter noetig. */
function designPresetAnwenden(key){
    const p = DESIGN_PRESETS[key];
    if(!p){ return; }
    const d = {
        primary: p.primary,
        accent:  p.accent,
        bg:      p.bg,
        text:    p.text,
        border:  p.border
    };
    designModalFelderFuellen(d);
    designAnwenden(d);
}

/* HTML fuer die Preset-Leiste. Wird beim Modal-Oeffnen in den
   Container #designPresetListe geschrieben. */
function designPresetLeisteRendern(){
    const host = document.getElementById("designPresetListe");
    if(!host){ return; }
    const stuecke = [];
    Object.keys(DESIGN_PRESETS).forEach(key => {
        const p = DESIGN_PRESETS[key];
        stuecke.push(
            '<div class="design-preset" onclick="designPresetAnwenden(\''
            + key + '\')" title="' + p.name + ' anwenden">'
          +   '<div class="design-preset-vorschau">'
          +     '<span style="background:' + p.primary + '"></span>'
          +     '<span style="background:' + p.accent  + '"></span>'
          +     '<span style="background:' + p.bg      + '"></span>'
          +   '</div>'
          +   '<div class="design-preset-name">' + p.name + '</div>'
          + '</div>'
        );
    });
    host.innerHTML = stuecke.join("");
}

/* =====================================================
   FLIESSENDER TAB-WECHSEL (design-neu)
   -----------------------------------------------------
   Umhuellt die globale showTab(): zuerst sanftes
   Ausblenden der aktuellen Ansicht, dann der eigentliche
   Wechsel (inkl. aller Seiteneffekte der Original-
   Funktion), danach das elegante Einblenden per CSS.
   design.js wird als letztes Script geladen, daher
   gewinnt diese Definition. Schnelle Klicks und der
   Wunsch nach reduzierter Bewegung werden beruecksichtigt.
===================================================== */
(function(){
    if(typeof window.showTab !== "function"){ return; }

    const _origShowTab = window.showTab;
    let _tabToken = 0;

    window.showTab = function(tabId){
        const ziel    = document.getElementById(tabId);
        const aktuell = document.querySelector(".tab-content.tab-active");
        const reduce  = window.matchMedia
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        /* Haengengebliebene Ausblend-Zustaende immer zuerst loesen */
        document.querySelectorAll(".tab-raus")
            .forEach(t => t.classList.remove("tab-raus"));

        /* Navigation sofort umschalten — fuehlt sich reaktiv an */
        document.querySelectorAll(".nav-button").forEach(function(b){
            b.classList.toggle("nav-button-aktiv", b.dataset.tab === tabId);
        });

        /* Kein Uebergang noetig: direkt schalten */
        if(!ziel || !aktuell || aktuell === ziel || reduce){
            return _origShowTab(tabId);
        }

        const token = ++_tabToken;
        aktuell.classList.add("tab-raus");

        window.setTimeout(function(){
            if(token !== _tabToken){ return; }   /* neuerer Wechsel gewinnt */
            aktuell.classList.remove("tab-raus");
            _origShowTab(tabId);  /* Swap + Seiteneffekte; loest Einblenden aus */
        }, 140);
    };
})();
