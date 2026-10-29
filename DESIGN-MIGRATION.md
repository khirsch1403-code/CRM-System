# Design-Migration

Das überarbeitete „Editorial & ruhig"-Design ist jetzt das **Hauptdesign**
und liegt im Wurzelordner (`index.html`, `style.css`, `icons.css`, `js/`).

## Was neu ist
- Editorial-Look: Haarlinien & Weißraum statt Schatten/SaaS-Karten,
  serifige Titel & Kennzahlen (Newsreader) + klare UI-Schrift (Instrument Sans),
  Fallback auf System-Schriften offline.
- **Bordeaux `#7a1e35` bleibt Primärfarbe** (präziser Akzent statt flächig).
- **Dark Mode** mit Umschalter (🌙/☀ oben rechts) — folgt der System-Einstellung,
  Wahl wird pro Browser gemerkt.
- **Fließende Tab-Übergänge** (Crossfade) statt hartem Sprung, ruhiger Auftritt
  beim Laden, taktile Mikro-Interaktionen, weicher Theme-Wechsel.
- **Hochwertige SVG-Icons** (`icons.css`) statt Emojis — erben Textfarbe,
  passen sich an Theme und Bordeaux an.

## Rollback (altes Design)
Das **alte Design** liegt vollständig und lauffähig im Ordner `design-alt/`.
Falls etwas nicht passt:

- Altes Design sofort ansehen: `design-alt/index.html` öffnen.
- Komplett zurückrollen: den Inhalt von `design-alt/` zurück in den Wurzelordner
  kopieren (`index.html`, `style.css`, `js/` überschreiben, `icons.css` löschen).

Beide Stände teilen sich dieselben Daten (IndexedDB/localStorage), der Wechsel
ist also gefahrlos. Wenn das neue Design sich bewährt hat, kann `design-alt/`
später gelöscht werden (es bleibt in der Git-Historie erhalten).
