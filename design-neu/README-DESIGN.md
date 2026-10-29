# CRM — Design-Überarbeitung (sichere Kopie)

Dieser Ordner `design-neu/` ist eine **vollständige, eigenständige Kopie** des
CRM mit dem überarbeiteten Design. Das Original im Projekt-Wurzelordner
(`../index.html`) bleibt unverändert und voll funktionsfähig.

## Ziel
Design modernisieren, ohne das laufende CRM zu gefährden. Erst wenn das neue
Design final abgenommen ist, wird migriert (siehe unten).

## Öffnen / Testen
- Neues Design:  `design-neu/index.html`
- Altes Design:  `index.html` (unverändert)

Beide laufen auf demselben Browser-Origin und teilen sich **dieselben Daten**
(IndexedDB / localStorage). Das neue Design ändert **nur die Optik** – keine
Datenlogik. Du kannst es also gefahrlos mit echten Daten ausprobieren.

## Was neu ist
- **Editorial-Look**: ruhige Papierflächen, Haarlinien und Weißraum statt
  Schatten und bunten Karten; serifige Titel & Kennzahlen (Newsreader),
  klare UI-Schrift (Instrument Sans). Schriften laden online von Google Fonts
  und fallen offline sauber auf System-Serif/-Sans zurück.
- **Bordeaux bleibt Primärfarbe** (`#7a1e35`) – jetzt als präziser Akzent
  (Marken-Oberkante im Masthead, aktive Navigation, Kennzahlen, Primär-Buttons).
- **Dark Mode** mit Umschalter (🌙/☀ oben rechts). Standard folgt der
  System-Einstellung; die Wahl wird pro Browser gemerkt (`localStorage`-Schlüssel
  `crmTheme`).
- **Masthead** statt dunkler Navbar: helle Kopfzeile mit Text-Navigation und
  Bordeaux-Unterstrich für den aktiven Reiter.

## Technik (für spätere Pflege)
- Neutrale Farben (Hintergrund/Text/Rahmen) gehören dem Theme und stehen im
  `style.css` unter `:root` bzw. `:root[data-theme="dark"]`.
- Die Markenfarbe (Bordeaux/Akzent) setzt `js/design.js` weiterhin inline –
  aber **nur noch** `--c-primary`, `--c-primary-dunkel`, `--c-accent`. Abgeleitete
  Töne (`…-soft`, `…-text`) rechnet das Stylesheet per `color-mix` je Theme.
- Der restliche optische Umbau steht gebündelt am Ende von `style.css` im Block
  **„EDITORIAL REDESIGN LAYER"** – die ~4000 Bestandszeilen wurden nicht verändert.

## Migration (erst nach Abnahme)
Wenn das neue Design final ist, wird der Inhalt von `design-neu/` in den
Wurzelordner übernommen (Original vorher sichern/als Branch behalten). Bis dahin
bleibt alles parallel – kein Risiko für den Produktivstand.
