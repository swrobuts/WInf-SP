# WInf-SP-Lab · Leitfaden für Lab-Autoren

Dieser Leitfaden beschreibt verbindlich, wie ein Lab dieser Lernumgebung gebaut ist. Wer ein Lab schreibt,
liefert **zwei Dateien** – `lab-NN-name.html` und `data/uebungen/lab-NN.json` – und ggf. Kopiervorlagen unter
`vorlagen/`. Nichts anderes wird angefasst (kein `assets/winf.js`, kein `assets/winf.css`, keine anderen Labs,
keine `index.html`). Fehlt ein CSS-Baustein, wird er im Abschlussbericht genannt, nicht selbst eingebaut.

Projektwurzel: `/Users/robert/Library/CloudStorage/OneDrive-Persönlich/Vorlesungen/Lernumgebungen/WInf-SP`

**Referenzen zum Nachlesen (bitte zuerst vollständig lesen):**
- `lab-07-docker.html` + `data/uebungen/lab-07.json` – Muster für Aufbau, Ton, Befehlskarten, Terminalübungen.
- `lab-08-supabase.html` + `data/uebungen/lab-08.json` – Muster für Seiten mit Datenbank (`data-datenbank`), SQL-Übungen, Checklisten.
- `assets/winf.css` – alle verfügbaren Klassen (insbesondere Abschnitte „Regal-Simulator“, „Deploy-Simulator“, „Oberflaechen-Nachbildung“, „Kopiervorlagen“, „vergleich“, „kette“).
- `assets/winf.js` – die Laufzeit; die Abschnitte `baueBox`, `baueRegal`, `baueDeploy` zeigen, welche Felder eine Übung tatsächlich liest.
- `assets/jsonpruefung.js`, `assets/regal.js`, `assets/deploy.js` – die Prüflogik der neuen Übungstypen.

---

## 1. Grundsätze

1. **Zweisprachig, immer.** Jeder sichtbare Text steht doppelt: `<span lang="de">…</span><span lang="en">…</span>`.
   In JSON ist jedes Textfeld `{ "de": "…", "en": "…" }`. Kein Text nur in einer Sprache – der Abnahmelauf prüft das.
2. **Englische Fachbegriffe bleiben englisch**, in beiden Sprachen: Commit, Branch, Merge, Remote, Repository,
   Volume, Image, Container, Stack, Host, Measure, Dimension, Shelf, Pill, Marks card, Canvas, View, Field wells,
   DataFrame, Data Editor, Query Console, Data Source, Connection String, API, Pipeline, Staging, Mart, Upsert,
   Build Command, Start Command, Environment Variable, Row Level Security, Interpreter, Run Configuration,
   Code Completion, Web Service, Blueprint … Deutsche Erklärung dazu ist erwünscht („ein Volume – ein
   Speicherbereich außerhalb des Containers“), die Übersetzung des Begriffs nicht – auch keine Metaphern wie
   „Kette“ und „Glied“. Die früheren Eindeutschungen („Abbild“, „Band“, „Zweig“, „Regal“, „Datenrahmen“,
   „Verbindungszeichenkette“) wurden am 21.09.2026 zurückgenommen. Ausnahmen: Wörter der deutschen
   Betriebssysteme und Fachsprache (Eingabeaufforderung, Zeichenkette, Fensterfunktion, Sicht, Zugangsdaten).
3. **Ton:** sachlich, präzise, „Sie“, keine Ausrufezeichen, keine Werbung. Jede Aussage zu Preisen, Lizenzen,
   Kontingenten oder Versionen trägt den Stand („Stand 09/2026“) und stammt aus dem Faktenblatt zur Recherche
   (Pfad im Auftrag). Was dort als UNVERIFIED markiert ist, wird entweder weggelassen oder als „nach Herstellerangabe
   zu prüfen“ formuliert. Nichts erfinden.
4. **Didaktik:** Jedes Lab folgt derselben Dramaturgie: (a) das Problem, das das Werkzeug löst, (b) die zwei bis vier
   Begriffe, die man kennen muss, (c) Inbetriebnahme mit Lizenz/Kosten/Datenschutz, (d) die Handgriffe in der Reihenfolge,
   in der man sie draußen braucht, (e) Stolpersteine mit **wörtlichen Fehlermeldungen**, (f) Spielplatz/Simulator,
   (g) Übungen, (h) Zusammenfassung in fünf bis sieben Sätzen. Jeder Abschnitt hat einen roten Faden zum vorigen;
   jedes Lab verweist auf die Labs, auf denen es aufbaut, und auf die, die darauf aufbauen – mit Nummer.
5. **Frustrationsfreiheit:** Übungen sind aus dem Text heraus lösbar. Jede Übung sagt genau, was erwartet wird.
   SQL-/JSON-Übungen haben einen Hinweis (`hinweis`) und eine Musterlösung (`loesung`). Terminal-/Simulator-Übungen
   nennen die Befehlskarte, die den Weg zeigt.
6. **Fallstudie Velo City** durchgängig (siehe Abschnitt 6). Keine anderen Datensätze erfinden.
7. **Hinweis zur Werkzeugauswahl** steht in jedem Lab, das ein Produkt zeigt (Klasse `auswahl-hinweis`, Wortlaut wie
   in `lab-07-docker.html`, angepasst auf das Werkzeug). Alternativen auf derselben Ebene werden benannt (mit Lizenz).
8. Keine Screenshots als Bilddateien. Oberflächen werden als **Nachbildung** mit den `.shot`-Klassen gezeichnet
   (Abschnitt 4) und mit Ziffern (`.callout`) erklärt. Unter jeder Nachbildung steht `<p class="shot-hinweis">`
   „Nachbildung der Oberfläche, Stand 09/2026 – Beschriftungen wie im Original“ (zweisprachig).

---

## 2. Aufbau der HTML-Seite

Kopf, Seitennavigation, Lab-Kopf, `main`, Fußzeile und `<script type="module" src="assets/winf.js">` wie in
`lab-07-docker.html`. Zwingend:

```html
<body class="lab-page" data-lab="lab-NN">
…
<div class="lab-header">
  <div class="lab-num-big">NN</div>
  <h1 class="lab-title">…</h1>
  <p class="lab-intro"><span lang="de">…</span><span lang="en">…</span></p>
  <div class="lernziele"><span class="lernziel-chip">…</span>…</div>
  <div data-einordnung></div>          <!-- Voraussetzung, Umfang, Zeit, Ziel aus LABS in winf.js -->
</div>
<main class="main-content">
  <section class="section-block" id="…">…</section>
  …
  <section class="section-block" id="uebungen">
    … <div data-uebung="WNN-01"></div> … <div data-fortschritt></div>
  </section>
  <section class="section-block" id="zusammenfassung"> … <div data-lab-nav></div></section>
</main>
```

Jeder `<section class="section-block" id="…">` hat einen Eintrag in der Seitennavigation (`.sidebar-link`).
Übungs-IDs: `WNN-01` … `WNN-0k`, k = Zahl der Übungen laut Auftrag. Befehlskarten: `B01` …; Platzhalter
`<div data-befehl="B01"></div>`. Jede Karte, die im JSON steht, muss im HTML vorkommen und umgekehrt.

Platzhalter, die die Laufzeit füllt:

| Platzhalter | Wirkung |
|---|---|
| `<div data-befehl="B01"></div>` | Befehlskarte aus `befehle.B01` |
| `<div data-uebung="WNN-01"></div>` | Übungsbox aus `uebungen[]` |
| `<div data-terminal="frei"></div>` | freie Konsole (Begrüßung aus `konsolen.frei`) – nur, wenn die nachgebildete Shell etwas beiträgt (zsh/PowerShell/cmd, git, docker) |
| `<div data-datenbank="sqlite"></div>` bzw. `data-datenbank="postgres"` | Statusband + Start der Datenbank. Genau einmal je Seite, **oberhalb** der ersten SQL-Übung. Wählt die Maschine der Seite. |
| `<div data-sql-konsole data-start="SELECT …"></div>` | freie SQL-Konsole (Maschine der Seite; `data-engine="sqlite"` erzwingt) |
| `<div data-json-konsole data-start='{ … }'></div>` | freie JSON-Werkbank (prüfen, formatieren) |
| `<div data-regal="name" data-variante="tableau|powerbi"></div>` | freier Regal-Simulator aus `spielplaetze.name` |
| `<div data-deploy="name"></div>` | freier Deploy-Simulator aus `spielplaetze.name` |
| `<div data-einordnung>`, `<div data-fortschritt>`, `<div data-lab-nav>` | Einordnung, Fortschritt, Vor/Zurück |

Klassen für Fließtext-Bausteine: `concept-box`, `tip-box`, `info-box`, `warn-box`, `challenge-box`, `karten`/`karte`
(mit `.kopfzeile`), `table-scroll` + `table`, `code-block` (`<pre class="code-block">`), `vergleich` (zwei Spalten),
`kette` (Pipeline-Kacheln mit `.glied` und `.pfeil`), `vorlagen`/`vorlage` (Kopiervorlagen, Abschnitt 5).
Inline-Code: `<code>…</code>`. OS-abhängige Zeilen: `nur-mac`, `nur-win`, `nur-cmd`, `nur-unix`, `nur-windows`.

---

## 3. Das JSON je Lab

```jsonc
{
  "konsolen": { "frei": { "begruessung": [ { "de": "…", "en": "…" } ] } },   // optional
  "befehle": { "B01": { … } },
  "regal":  { "felder": [ … ], "daten": "data/regal-fahrten.json" },          // nur Lab 12/13
  "repo":   { … },                                                            // nur Lab 11
  "spielplaetze": { "name": { … } },                                          // optional
  "uebungen": [ { … } ]
}
```

### 3.1 Befehlskarten `befehle.Bxx`

```jsonc
{
  "titel": { "de": "…", "en": "…" },
  "prompt": "$",                       // optional; "📄" für Dateiinhalte, "⌨" für Tastenkürzel, "🖱" für Klickwege
  "befehl": "zeile 1\nzeile 2",        // ODER "varianten": { "mac": {"befehl": "…", "teile": […]}, "win": {…}, "cmd": {…} }
  "teile": [ { "was": "-p 8080:80", "bedeutet": { "de": "…", "en": "…" } } ],
  "ausgabe": "optional: was das Werkzeug antwortet"   // oder { "mac": "…", "win": "…" }
}
```
Jede Karte erklärt **jeden Bestandteil**, der nicht selbstverständlich ist. Kommentare im Befehl mit `#`.
Klickwege (Menüs) stehen als Karte mit `prompt: "🖱"` und Pfeilen `→`, Beschriftungen **wörtlich wie in der
englischen Oberfläche** (z. B. `File → New → Data Source → SQLite`).

### 3.2 Übungen `uebungen[]` – gemeinsame Felder

```jsonc
{
  "id": "WNN-01", "typ": "quiz|zuordnen|checkliste|terminal|sql|json|reihenfolge|regal|deploy",
  "titel": { "de": "…", "en": "…" },
  "aufgabe": { "de": "<p>…</p>", "en": "<p>…</p>" },          // HTML erlaubt
  "rueckmeldung": { "de": "…", "en": "…" }                      // erscheint nach Lösung; erklärt das Warum
}
```

**quiz** – `fragen: [ { frage, optionen: [ {de,en}… ], richtig: [index…], mehrfach: true|false, erklaerung } ]`.
Bei mehr als einem richtigen Index muss `mehrfach: true` stehen. Optionen 3–4, Ablenker plausibel, Erklärung
nennt, warum die falschen falsch sind.

**zuordnen** – `ziele: [ {id, text} ]`, `paare: [ {begriff, ziel} ]`. 5–8 Paare, 3–6 Ziele.

**checkliste** – `schritte: [ {text} ]` (HTML in `text` erlaubt). Für Handgriffe in der echten Oberfläche.
Jeder Schritt endet mit einer Prüffrage („…steht dort `[1]`?“), 5–9 Schritte.

**terminal** – nur für Shell-, git-, docker-Befehle (die Nachbildung kennt sonst nichts). `schritte: [ {text, muster,
zustand} ]`, `begruessung`, optional `os`. Siehe `lab-07.json`. Für neue Labs nur einsetzen, wenn wirklich
Shell-/git-/docker-Schritte geprüft werden (Lab 11 z. B. `git`-Schritte vor dem Deploy sind möglich); jede Terminalübung
braucht in `tools/verify.mjs` unter `LOESUNGEN` einen Lösungsweg – **den liefert der Autor im Abschlussbericht** als
Liste `[Befehl, erledigte Schritte danach]` je Dialekt, damit er eingetragen werden kann. Zustandsprädikate:
`pfad, datei, gitRepo, gitCommits, gitZweig, gitIndexLeer, gitIndexGefuellt, gitVeroeffentlicht, containerLaeuft,
containerWeg, volumen, abbild, portGebunden, umgebung, bandAn`.

**sql** – läuft gegen die Maschine der Seite (oder `engine: "sqlite"|"postgres"` je Übung).
```jsonc
{ "typ": "sql", "start": "SELECT …", "hinweis": {de,en}, "loesung": "SELECT …", "sortiert": false,
  "vorher": "optional: SQL, das vor Eingabe UND vor Lösung läuft (z. B. CREATE TABLE)",
  "kontrolle": "optional: SELECT, dessen Ergebnis verglichen wird – für INSERT/UPDATE/CREATE-Aufgaben" }
```
Geprüft wird das **Ergebnis** (Zeilenmenge), nicht der Text. `sortiert: true`, wenn die Reihenfolge Teil der Aufgabe
ist (dann ORDER BY in der Lösung). Bei verändernden Anweisungen (`INSERT`, `CREATE TABLE`, `UPDATE`) `kontrolle`
setzen, z. B. `"kontrolle": "SELECT count(*) FROM staging_fahrt"`. Jede Lösung wird mit `node tools/sql.mjs
sqlite|postgres "…"` geprüft, bevor sie ins JSON kommt. Spaltenzahl der Lösung = Spaltenzahl, die die Aufgabe
verlangt (die Prüfung vergleicht sie).

**json** – Studierende schreiben/korrigieren JSON.
```jsonc
{ "typ": "json", "start": "{ … }", "hinweis": {de,en}, "loesung": "{ … }",
  "erwartet": { … },                 // ODER/UND
  "regeln": [ { "pfad": "/stationen/0/name", "typ": "string", "wert": "…", "laenge": 3, "mindestens": 1,
                "muster": "^\\d{4}-\\d{2}-\\d{2}$", "schluessel": ["a","b"], "vorhanden": false,
                "jedes": [ { "pfad": "/rad_id", "typ": "string" } ],
                "text": {de,en} } ] }
```
`pfad` ist ein JSON Pointer (RFC 6901); `""` ist das ganze Dokument. `typ` ∈ `object, array, string, number, boolean,
null`. `jedes` prüft jedes Element eines Feldes mit relativen Pointern. `text` ersetzt die Standardmeldung.
Die Prüfung zeigt Syntaxfehler mit der **Browser-Parsermeldung** und einem übersetzten Hinweis (fehlendes Komma,
einfache Anführungszeichen, Kommentar …) – Aufgaben dürfen also absichtlich kaputtes JSON als `start` vorgeben.
`loesung` muss die eigene Prüfung bestehen, `start` darf sie nicht bestehen (der Abnahmelauf prüft beides).

**reihenfolge** – Schritte in die richtige Ordnung bringen (Pfeiltasten ▲▼).
```jsonc
{ "typ": "reihenfolge", "eintraege": [ { "id": "e", "text": {de,en} }, … ], "richtig": ["e","t","l"],
  "start": ["l","t","e"] }            // optional; ohne start: umgekehrte Reihenfolge der Einträge
```
4–7 Einträge; `start` darf nicht gleich `richtig` sein.

**regal** – Felder auf Regale legen (Power BI / Tableau).
```jsonc
{ "typ": "regal", "variante": "tableau"|"powerbi",
  "ziel": { "spalten": ["bezirk"], "zeilen": ["SUM:preis_eur"], "farbe": "rad_typ", "filter": { "rad_typ": ["EBIKE"] } },
  "startBelegung": { "spalten": [], "zeilen": [], "farbe": null, "filter": {} },   // optional
  "loesungBelegung": { "spalten": ["bezirk"], "zeilen": [ { "feld": "preis_eur", "agg": "SUM" } ], "farbe": "rad_typ", "filter": { "rad_typ": ["EBIKE"] } } }
```
Felder und Daten kommen aus `regal.felder` / `regal.daten` des Labs (siehe Abschnitt 6.3). Soll-Einträge: `"feld"`
für Dimensionen, `"AGG:feld"` für Kennzahlen (AGG ∈ SUM, AVG, COUNT, MIN, MAX). Reihenfolge auf einem Regal ist
gleichgültig; nicht genannte Regale müssen leer bleiben. Das Diagramm entsteht automatisch: Dimension auf
Spalten + Kennzahl auf Zeilen = senkrechte Balken; Dimension auf Zeilen + Kennzahl auf Spalten = waagerechte;
geordnete Dimension (Monat, Stunde) = Linie; nur Dimensionen oder nur Kennzahl = Tabelle; `farbe` = Stapel/Serien.

**deploy** – das Render-Formular ausfüllen und deployen.
```jsonc
{ "typ": "deploy",
  "startEingaben": { "runtime": "python", "rootDir": "", "build": "", "start": "python main.py", "env": [] },
  "soll": { "runtime": "python", "build": "pip install -r requirements\\.txt", "start": "uvicorn main:app.*--host 0\\.0\\.0\\.0.*--port \\$PORT", "env": ["DATABASE_URL"], "ohneWarnung": true, "rootDir": "api" },   // rootDir/dienst optional
  "loesungEingaben": { "runtime": "python", "rootDir": "", "build": "pip install -r requirements.txt", "start": "uvicorn main:app --host 0.0.0.0 --port $PORT", "env": [ { "name": "DATABASE_URL", "value": "postgresql://…" } ] } }
```
Das Repository kommt aus `repo` des Labs: `{ "name": "velocity-api", "url": "https://github.com/studi/velocity-api",
"dateien": { "main.py": "…", "requirements.txt": "…", ".gitignore": "…", "README.md": "…" }, "liest": ["DATABASE_URL"] }`.
`liest` nennt Umgebungsvariablen, ohne die der simulierte Start mit `KeyError` scheitert. Der Simulator erkennt:
fehlende requirements.txt, Start Command ohne Server (Skript endet), Bindung an 127.0.0.1 („No open ports
detected“), fester Port ohne `$PORT` (läuft, mit Warnung), fehlende Variable, Docker ohne Dockerfile. Eine Übung
darf auch verlangen, einen **Fehler herbeizuführen und zu lesen** – dann ist `soll` das Ziel des zweiten Teils.

### 3.3 Spielplätze `spielplaetze.name`
Gleiche Felder wie die Übung (ohne `ziel`/`soll`): `{ "variante": "…", "startBelegung": {…} }` für Regale,
`{ "startEingaben": {…} }` für Deploy.

---

## 4. Oberflächen-Nachbildung („Screenshot“)

```html
<div class="shot">
  <div class="shot-bar"><span class="ampel"><i></i><i></i><i></i></span><span class="titel">PyCharm – velocity</span><span class="spacer"></span>2026.2</div>
  <div class="shot-menu"><span>File</span><span>Edit</span><span>View</span><span>Navigate</span><span>Run</span><span>Tools</span><span>Git</span></div>
  <div class="shot-body">
    <div class="shot-side">
      <h5>Project</h5>
      <ul class="baum">
        <li>▾ velocity</li>
        <li class="ein">▸ .venv <span class="callout">1</span></li>
        <li class="ein aktiv">main.py</li>
        <li class="ein">requirements.txt</li>
      </ul>
    </div>
    <div class="shot-main">
      <div class="warnzeile">No Python interpreter configured for the project &nbsp; <b>Configure Python interpreter</b> <span class="callout">2</span></div>
      <div class="code">import pandas as pd</div>
      <div class="zeile"><span class="beschriftung">Status bar</span><span class="feld">Python 3.12 (velocity)</span> <span class="callout">3</span></div>
    </div>
  </div>
</div>
<p class="shot-hinweis"><span lang="de">Nachbildung der Oberfläche, Stand 09/2026 – Beschriftungen wie im Original.</span><span lang="en">Rendering of the interface, as of 09/2026 – labels as in the original.</span></p>
<ol class="shot-legende">
  <li><span class="callout">1</span><span><span lang="de">…</span><span lang="en">…</span></span></li>
  …
</ol>
```
Bausteine: `shot-body` (2 Spalten), `shot-body drei` (3 Spalten), `shot-body eins`; `shot-side` (links) und
`shot-side rechts`; in `shot-main`: `.zeile` mit `.beschriftung` + `.feld` (+ `.breit`), `.knopf` (+ `.primaer`),
`.tab` (+ `.aktiv`), `.pill-blau` / `.pill-gruen` / `.pill-neutral`, `.regalzeile` (`.name` + `.ablage`), `.leinwand`,
`.code`, `.warnzeile`, `.fehlerzeile`, `.okzeile`, `.zelle` (Notebook-Zelle mit `.nrz`) + `.ausgabe`, `table`.
Ziffern: `<span class="callout">n</span>` (`callout gold` für Hervorhebung). Beschriftungen in der Nachbildung sind
**englisch wie im Original** und stehen nicht doppelt; die Legende darunter ist zweisprachig. Pro Lab zwei bis vier
Nachbildungen an den Stellen, an denen die Oberfläche das Lernziel trägt.

---

## 5. Kopiervorlagen

Dateien unter `vorlagen/` (Dateiname = wie er im Projekt heißen soll, ggf. mit Präfix `lab-NN-`), verlinkt als
```html
<div class="vorlagen">
  <a class="vorlage" href="vorlagen/requirements.txt" download><span class="symbol">📄</span><span><span class="datei">requirements.txt</span><br><span class="was"><span lang="de">…</span><span lang="en">…</span></span></span></a>
</div>
```
Zusätzlich steht der Inhalt als Befehlskarte mit `prompt: "📄"` auf der Seite (Kopierknopf, Erklärung der Zeilen).
Vorlagen sind vollständig, lauffähig und kommentiert (Kommentare deutsch, Bezeichner englisch), mit Velo City als
Beispiel. Der Abnahmelauf prüft, dass jede verlinkte Vorlage existiert.

---

## 6. Fallstudie Velo City – die Daten

Leihradsystem in Würzburg, vollständig synthetisch. Derselbe Bestand liegt dreimal vor:

| Form | Datei | Verwendung |
|---|---|---|
| PostgreSQL (PGlite) | `data/velocity.sql` | `data-datenbank="postgres"`: Lab 08, 09, 10 |
| SQLite (sql.js) | `data/velocity.sqlite.sql` | `data-datenbank="sqlite"`: Lab 06, 09 |
| JSON-Export | `data/velocity.json` (435 KB, verschachtelt), `data/velocity-kostprobe.json` (3 Stationen, 5 Kunden, 8 Fahrten), `data/fahrten.jsonl` (JSON Lines) | Lab 05, 10 |
| flache Fahrtentabelle | `data/regal-fahrten.json` | Regal-Simulator Lab 12, 13 |

### 6.1 Tabellen (Postgres wie SQLite, gleiche Namen)

- `station (station_id, name, bezirk, plaetze, eroeffnet)` – 10 Zeilen; Bezirke: Altstadt (3 Stationen), Sanderau (2),
  Grombuehl, Frauenland, Zellerau, Heuchelhof, Versbach (je 1). Namen: Juliuspromenade, Hauptbahnhof, Residenz,
  Sanderring, Grombuehl Klinikum, Hubland Campus, Zellerau Baeder, Heuchelhof Zentrum, Loewenbruecke, Versbach Nord.
- `rad (rad_id, typ, baujahr, heimstation, status)` – 60 Zeilen; `rad_id` wie `R-001`; `typ` ∈ CITY (36), EBIKE (18),
  CARGO (6); `baujahr` 2023–2025; `status` aktiv/werkstatt (3 in Werkstatt: R-017, R-034, R-051).
- `kunde (kunde_id, tarif, registriert, bezirk)` – 200 Zeilen; `tarif` ∈ Basis, Plus, Jahr.
- `fahrt (fahrt_id, rad_id, kunde_id, start_station, ziel_station, start_zeit, dauer_min, preis_eur)` – 1.500 Zeilen,
  Zeitraum 2025-09-01 bis 2026-08-31, Morgen- und Nachmittagsspitze, rechtsschiefe Dauern (Median ≈ 11 min).
- Sicht `fahrt_mit_typ` = fahrt + `rad_typ`, `start_name`, `ziel_name`.
- Kennzahlen zum Gegenprüfen: Umsatz gesamt **3.172,14 €**; Fahrten je Typ: CITY 913 (1.522,50 €), EBIKE 444
  (1.153,80 €), CARGO 143 (495,84 €).
- Unterschiede SQLite vs. Postgres, sichtbar im Skript: in SQLite sind `eroeffnet`, `registriert`, `start_zeit` TEXT
  (ISO 8601, `2025-09-01 07:45:00`), `preis_eur` REAL; Fremdschlüssel nur mit `PRAGMA foreign_keys = ON`. In Postgres
  `date`, `timestamp`, `numeric(6,2)`. SQLite-Fassung in sql.js: SQLite 3.49.1 (keine `generate_series`-Tabelle
  garantiert; `RIGHT/FULL JOIN`, `RETURNING`, `UPSERT`, Fensterfunktionen, JSON-Funktionen vorhanden).

### 6.2 JSON-Export (`data/velocity.json`)

```json
{ "quelle": "Velo City Betreiberportal", "exportiert_am": "2026-09-01T06:00:00+02:00", "waehrung": "EUR",
  "stationen": [ { "station_id": 1, "name": "Juliuspromenade", "bezirk": "Altstadt", "plaetze": 18, "eroeffnet": "2024-04-02",
                   "raeder": [ { "rad_id": "R-010", "typ": "CARGO", "baujahr": 2024, "status": "aktiv" }, … ] }, … ],
  "kunden":    [ { "kunde_id": 1, "tarif": "Basis", "registriert": "2024-04-04", "bezirk": "Sanderau" }, … ],
  "fahrten":   [ { "fahrt_id": 1, "rad_id": "R-014", "kunde_id": 37, "start": { "station_id": 2, "zeit": "2025-11-18T08:12:00" },
                   "ziel": { "station_id": 5 }, "dauer_min": 9, "preis_eur": 1.4 }, … ] }
```
(Die konkreten Werte der ersten Fahrt bitte aus der Datei lesen, nicht aus diesem Beispiel übernehmen.)

### 6.3 Flache Fahrtentabelle für den Regal-Simulator (`data/regal-fahrten.json`)

Eine Zeile je Fahrt mit: `fahrt_id` (Zahl), `monat` (`2025-09` … `2026-08`), `wochentag` (Mo…So), `stunde` (0–23),
`bezirk` (Startbezirk), `station` (Startstation), `rad_typ`, `tarif`, `dauer_min`, `preis_eur`.
Empfohlene Felddefinition im Lab-JSON (`regal.felder`):

```json
[ { "id": "monat", "typ": "dimension", "geordnet": true, "titel": { "de": "Monat", "en": "Month" },
    "reihenfolge": ["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"] },
  { "id": "wochentag", "typ": "dimension", "titel": { "de": "Wochentag", "en": "Weekday" }, "reihenfolge": ["Mo","Di","Mi","Do","Fr","Sa","So"] },
  { "id": "stunde", "typ": "dimension", "geordnet": true, "titel": { "de": "Stunde", "en": "Hour" }, "reihenfolge": [0,1,2,…,23] },
  { "id": "bezirk", "typ": "dimension", "titel": { "de": "Bezirk", "en": "District" } },
  { "id": "station", "typ": "dimension", "titel": { "de": "Startstation", "en": "Start station" } },
  { "id": "rad_typ", "typ": "dimension", "titel": { "de": "Radtyp", "en": "Bike type" } },
  { "id": "tarif", "typ": "dimension", "titel": { "de": "Tarif", "en": "Plan" } },
  { "id": "fahrt_id", "typ": "kennzahl", "titel": { "de": "Fahrt-ID", "en": "Ride ID" }, "erklaerung": { "de": "Eine Kennung – Σ darüber ist die klassische Falle. COUNT zählt Fahrten.", "en": "An identifier – Σ over it is the classic trap. COUNT counts rides." } },
  { "id": "dauer_min", "typ": "kennzahl", "titel": { "de": "Dauer (min)", "en": "Duration (min)" } },
  { "id": "preis_eur", "typ": "kennzahl", "titel": { "de": "Preis (EUR)", "en": "Price (EUR)" } } ]
```
Titel `titel` erscheinen als Pillen; `geordnet: true` erzeugt Liniendiagramme; `reihenfolge` sortiert Kategorien.

---

## 7. Prüfen vor der Abgabe

```bash
cd "/Users/robert/Library/CloudStorage/OneDrive-Persönlich/Vorlesungen/Lernumgebungen/WInf-SP"
python3 -c "import json; json.load(open('data/uebungen/lab-NN.json'))"
node tools/sql.mjs sqlite "SELECT …"        # jede SQL-Lösung einmal laufen lassen (postgres|sqlite)
node tools/verify.mjs 2>/dev/null | grep -E "FEHL|Zusicherungen"
```
Der Abnahmelauf prüft alle Labs; nur Befunde zum eigenen Lab (`lab-NN`, `WNN-`) sind zu beheben. Er prüft u. a.:
Platzhalter ↔ JSON, Zweisprachigkeit, Antwortindizes, Zuordnungsziele, `data-lab`, keine PITM-Reste, verlinkte
Kopiervorlagen, JSON-Lösungen bestehen ihre Regeln, Reihenfolge-Start ≠ Lösung, Regal-Lösung erfüllt Ziel,
Deploy-Lösung führt zum Erfolg. Die Zahl der Übungen muss mit dem Auftrag übereinstimmen (sie steht in `LABS` in
`assets/winf.js`).

Am Ende: kurzer Abschlussbericht mit (1) Abschnittsliste, (2) Übungsliste mit Typen, (3) angelegten Vorlagen,
(4) Lösungswegen für Terminalübungen (falls vorhanden), (5) offenen Punkten / benötigten CSS-Bausteinen, (6) Ergebnis
des Abnahmelaufs.
