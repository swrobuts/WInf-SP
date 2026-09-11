# WInf-SP-Lab

**Live:** [swrobuts.github.io/WInf-SP](https://swrobuts.github.io/WInf-SP/)

Interaktive Lernumgebung zur Werkzeugkette eines Datenprojekts für das Modul
**Wirtschaftsinformatik Schwerpunkt (WInf-SP)** der THWS Business School.

Dreizehn Labs folgen dem Weg der Daten von der Rohdatei zum Dashboard: Terminal, Git und GitHub,
PyCharm und WebStorm, Google Colab, JSON, SQLite, Docker, Supabase, DataGrip, ETL/ELT, Render,
Power BI und Tableau. **74 Übungen** in neun Formen, jede mit sofortiger Rückmeldung; eine
**nachgebildete Kommandozeile** mit drei Shells, `git` und `docker`; **zwei echte Datenbanken im
Browser** – PostgreSQL (PGlite) und SQLite (sql.js) – auf den Daten der Fallstudie Velo City;
ein **Deploy-Simulator** nach dem Vorbild von Render und ein **Regal-Simulator** nach dem Vorbild
von Power BI und Tableau.

Die Umgebung ist zweisprachig (Deutsch / Englisch), englische Fachbegriffe bleiben englisch. Sie
läuft als statische Seite auf GitHub Pages: ohne Build-Schritt, ohne Server, ohne Anmeldung.
Schwesterprojekte: PITM-Lab (Projekt- und IT-Management), DABA-Lab (Datenbanken), PROM-Lab
(Prozessmodellierung), BINT (Business Intelligence). Die Labs zu Kommandozeile, Colab und Docker
teilen sich WInf-SP und PITM wörtlich.

> **Hinweis zu den Werkzeugen.** Bei den in dieser Lernumgebung gezeigten Tools handelt es sich um
> eine Auswahl – diese ist weder als Empfehlung noch als Werbung zu verstehen. Zu jedem Werkzeug
> nennt das jeweilige Lab Alternativen auf derselben Ebene, den Lizenztyp und die Grenzen der
> kostenfreien Nutzung. Alle Angaben zu Preisen, Lizenzen und Kontingenten geben den Stand 09/2026
> wieder.

---

## Aufbau

```
index.html                    Übersicht mit den dreizehn Lab-Kacheln und dem Gesamtfortschritt
lab-01-terminal.html          zsh, PowerShell, cmd.exe: bewegen, anlegen, lesen, verschieben        (6 Übungen)
lab-02-github.html            Drei Bereiche, clone/add/commit/push, Zweige, .gitignore, Secrets     (6)
lab-03-ide.html               PyCharm und WebStorm: Projekt, Interpreter, Run Configuration, Lizenz (5)
lab-04-colab.html             Notebook, Runtime, Kernel, Ausführungsreihenfolge, Secrets            (5)
lab-05-json.html              Sechs Werttypen, Verschachtelung, JSON Lines, json_normalize          (6)
lab-06-sqlite.html            Eine Datei ist eine Datenbank: CLI, Python, Affinity, STRICT, JSON    (6)
lab-07-docker.html            Image, Container, Volume, Ports, Dockerfile, Compose, prune           (6)
lab-08-supabase.html          Gehostetes Postgres, RLS, publishable/secret keys, Pooler             (6)
lab-09-datagrip.html          Datenquelle (SQLite und Postgres), Schemata, Tx:Auto/Manual, Import   (5)
lab-10-etl.html               ETL vs. ELT, Staging, Sternschema, Upsert, Idempotenz, dbt            (6)
lab-11-render.html            Web Service, Build/Start Command, $PORT, Free Tier, Blueprint         (5)
lab-12-powerbi.html           Power Query, Modell, DAX-Measures, Bericht, Veröffentlichen           (6)
lab-13-tableau.html           Dimension/Measure, diskret/stetig, Regale, LOD, Dashboard             (6)

assets/
  winf.css                    Gemeinsames Stylesheet: Bordeaux #7A1F2E, Gold #E0B44C
  winf.js                     Laufzeit: Sprache, OS, LABS, Übungsboxen, Regal- und Deploy-Simulator
  terminal.js                 Nachgebildete Shell: zsh, PowerShell, cmd.exe, git, docker
  pruefung.js                 Wann ein Terminalschritt erledigt ist — Browser UND Testlauf
  jsonpruefung.js             Prüfung von JSON-Übungen (JSON Pointer, Regeln, Ursachenhinweise)
  regal.js                    Aggregation und Zielprüfung des Regal-Simulators
  deploy.js                   Protokoll und Zielprüfung des Deploy-Simulators
  pglite/                     PostgreSQL als WebAssembly (PGlite), lokal statt vom CDN
  sqljs/                      SQLite als WebAssembly (sql.js 1.14.2, SQLite 3.49.1), lokal

data/
  velocity.sql                Saatdaten der Fallstudie für PostgreSQL
  velocity.sqlite.sql         Derselbe Bestand im SQLite-Dialekt (erzeugt)
  velocity.json               Derselbe Bestand als verschachtelter JSON-Export (erzeugt)
  velocity-kostprobe.json     Kleiner Ausschnitt des Exports für Lab 05
  fahrten.jsonl               Die Fahrten als JSON Lines (erzeugt)
  regal-fahrten.json          Flache Fahrtentabelle für den Regal-Simulator (erzeugt)
  uebungen/lab-XX.json        Befehlskarten, Übungen, Repositories und Felder je Lab

vorlagen/                     Kopiervorlagen: requirements.txt, main.py, render.yaml, Dockerfile,
                              ETL-Skript, Sternschema, Measures, Calculated Fields …

tools/
  verify.mjs                  Abnahmelauf ohne Browser (siehe unten)
  sql.mjs                     SQL gegen beide Datenbanken auf der Kommandozeile ausprobieren
  gen_daten.mjs               Erzeugt SQLite-, JSON- und JSON-Lines-Fassung aus velocity.sql
  gen_regal.mjs               Erzeugt die flache Fahrtentabelle für den Regal-Simulator
  AUTORENLEITFADEN.md         Konventionen für neue Labs
```

---

## Neun Übungstypen

| Typ | Was Studierende tun | Wie geprüft wird |
|---|---|---|
| `quiz` | Fragen mit Einfach- oder Mehrfachauswahl beantworten | Vergleich mit `richtig`; Erklärung nach der Prüfung |
| `zuordnen` | Begriffe, Meldungen oder Aufgaben auf Kategorien ziehen | Paarweise gegen `ziel` |
| `checkliste` | Schritte an der echten Oberfläche abarbeiten und bestätigen | Selbstbestätigung, mit Prüffrage je Schritt |
| `terminal` | Befehle in der nachgebildeten Shell eingeben | Muster **und** Zustand der Welt (Pfad, Datei, Repo, Container, Volume) |
| `sql` | Eine Abfrage gegen echtes PostgreSQL oder SQLite schreiben | Abfrage und Referenzlösung laufen; Zeilenmengen werden verglichen; bei verändernden Anweisungen über eine Kontrollabfrage |
| `json` | JSON schreiben oder reparieren | Parser des Browsers, dann Regeln je JSON Pointer oder Vergleich mit dem erwarteten Dokument |
| `reihenfolge` | Schritte in die richtige Ordnung bringen | Positionsvergleich; erste falsche Position wird genannt |
| `regal` | Felder auf Regale legen (Columns/Rows/Color bzw. X-axis/Y-axis/Legend) | Belegung gegen das Ziel: Felder, Aggregation, Farbe, Filter |
| `deploy` | Das Formular „New Web Service“ ausfüllen und deployen | Simuliertes Protokoll; Erfolg und Sollbedingungen (Build, Start, Variablen) |

Die HTML-Seite enthält je Übung nur `<div data-uebung="W05-01"></div>`, je Befehlskarte
`<div data-befehl="B03"></div>`. Die Datenbank einer Seite wählt `<div data-datenbank="sqlite">`
bzw. `postgres`; Spielplätze sind `<div data-terminal="frei">`, `<div data-sql-konsole>`,
`<div data-json-konsole>`, `<div data-regal="frei">` und `<div data-deploy="frei">`.

---

## Die Fallstudie Velo City – einmal erzeugt, dreimal vorhanden

Ein fiktives Leihradsystem in Würzburg: 10 Stationen, 60 Räder, 200 Kunden, 1.500 Fahrten
zwischen September 2025 und August 2026, synthetisch und ohne Personenbezug. `data/velocity.sql`
legt den Bestand in PostgreSQL an; die Zufallszahlen sind über `setseed(0.42)` festgenagelt.
`tools/gen_daten.mjs` lässt dieses Skript einmal in PGlite laufen und schreibt denselben Bestand als
SQLite-Skript, als verschachtelten JSON-Export (so, wie ein Betreiberportal antworten würde) und
als JSON Lines heraus. So sind es in Lab 05 (JSON), Lab 06 (SQLite), Lab 08 (Postgres) und Lab 10
(ETL) dieselben 1.500 Fahrten – und dieselben 3.172,14 € Umsatz.

---

## Zwei Datenbanken im Browser

PGlite lädt PostgreSQL als WebAssembly (`assets/pglite/`, 19 MB), sql.js lädt SQLite
(`assets/sqljs/`, 0,7 MB). Beides liegt lokal, damit die Umgebung ohne CDN funktioniert; für
PGlite gibt es einen Rückfall auf jsDelivr. Eine `sql`-Übung wird am Ergebnis geprüft, nicht am
Text – es gibt mehrere richtige Abfragen. Die Eigenheiten bleiben sichtbar: SQLite schreibt eine
Zeichenkette in eine INTEGER-Spalte, ohne zu murren; Postgres nicht.

---

## Simulatoren für das, was man nicht einbetten kann

- **Deploy-Simulator** (`assets/deploy.js`): das Formular „New Web Service“ mit Language, Root
  Directory, Build Command, Start Command und Environment Variables, daneben das Repository. Das
  Protokoll ist dem echten nachempfunden und kennt die Fehler, an denen Deploys im Kurs scheitern:
  fehlende `requirements.txt`, Skript ohne Server, Bindung an 127.0.0.1 („No open ports detected“),
  fester Port ohne `$PORT`, fehlende Umgebungsvariable (`KeyError`), Docker ohne Dockerfile.
- **Regal-Simulator** (`assets/regal.js`): Felder in zwei Farbsprachen (Tableau: blau diskret,
  grün stetig; Power BI: Σ), Regale Columns/Rows/Color bzw. X-axis/Y-axis/Legend, Filter,
  Aggregation je Kennzahl. Das Diagramm folgt aus der Belegung wie im Werkzeug: Dimension auf
  Columns ergibt senkrechte Balken, auf Rows waagerechte, eine geordnete Dimension eine Linie, nur
  Dimensionen eine Tabelle. Die Σ-Falle („Sum of fahrt_id“) ist absichtlich eingebaut.

Beide Simulatoren sind reine Logik ohne DOM und laufen deshalb auch im Abnahmelauf.

---

## Nach jeder Änderung prüfen

```bash
node tools/verify.mjs
```

Der Lauf braucht keinen Browser und prüft: dass Platzhalter und JSON deckungsgleich sind, jeder
Text in beiden Sprachen vorliegt und die Übungszahlen in `LABS` stimmen; dass jede Terminalübung
in jedem passenden Dialekt lösbar ist; dass jede JSON-Übung mit ihrer Musterlösung besteht und mit
ihrem Starttext nicht; dass jede Reihenfolge-Übung nicht schon gelöst beginnt; dass jede
Regal-Übung mit ihrer Lösungsbelegung das Ziel erfüllt und die leere Belegung nicht; dass jede
Deploy-Übung mit ihren Lösungseingaben online geht; und dass die bekannten Stolperstellen der
Shell-Nachbildung behoben bleiben.

```bash
node tools/sql.mjs sqlite   "SELECT rad_typ, count(*) FROM fahrt_mit_typ GROUP BY rad_typ"
node tools/sql.mjs postgres "SELECT bezirk, count(*) FROM station GROUP BY bezirk"
```

lässt eine Abfrage gegen die Saatdaten laufen – für Musterlösungen, bevor sie in eine Übung
wandern.

---

## Zweisprachigkeit und Fortschritt

Jeder Text steht doppelt im HTML (`<span lang="de">` / `<span lang="en">`); `winf.css` blendet die
jeweils andere Sprache aus. Die Wahl liegt im `localStorage` unter `winf:sprache`, die
Betriebssystemwahl unter `winf:os`, gelöste Übungen unter `winf:fortschritt:<lab>`. Nichts davon
verlässt das Gerät; es gibt keine Anmeldung und keine Auswertung.

---

## Lokal ausprobieren

Ein Server ist nötig, weil die Seite Module, JSON und WebAssembly per `fetch` lädt – `file://`
genügt nicht.

```bash
cd WInf-SP
python3 -m http.server 8777
# http://localhost:8777
```

---

## Veröffentlichen

```bash
gh repo create swrobuts/WInf-SP --public --source=. --push
gh api repos/swrobuts/WInf-SP/pages -X POST -f source[branch]=main -f source[path]=/
```

`.nojekyll` liegt bei, damit GitHub Pages die Ordner unverändert ausliefert.

---

## Quellen der Inhalte

Die Fakten zu Lizenzen, Kontingenten, Oberflächen und Fehlermeldungen wurden im September 2026
gegen die Herstellerdokumentation geprüft: Render (Pricing, Docs, DPA), JetBrains (Sales-FAQ,
Hilfe, Blog), SQLite (sqlite.org), RFC 8259/6901/9535, Supabase (Docs, Pricing), GitHub (Docs,
Changelog), Google Colab (FAQ, Release Notes), Microsoft Learn (Power BI, Fabric, Power Query),
Tableau (Help, Pricing, Academic Programs), Kimball Group, Databricks, dbt-Docs, PostgreSQL-Docs.
Wo eine Angabe nicht aus einer Primärquelle belegbar war, steht sie nicht im Lab oder ist als „beim
Anbieter prüfen“ gekennzeichnet. Das ist Prüfungsstoff, nicht Kleingedrucktes.
