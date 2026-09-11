/**
 * WInf-SP-Lab · Laufzeit der Lernumgebung
 *
 * Abgeleitet von der PITM-Laufzeit (pitm.js) und erweitert. Zustaendig fuer:
 *   - Sprachumschaltung DE/EN (merkt sich die Wahl)
 *   - Betriebssystemwahl mac/win/cmd (merkt sich die Wahl, gilt seitenweit)
 *   - Befehlskarten mit Kopierknopf und Erklaerung der Bestandteile
 *   - die nachgebildete Kommandozeile (siehe terminal.js)
 *   - zwei echte Datenbanken im Browser: PostgreSQL (PGlite) und SQLite (sql.js)
 *   - Uebungsboxen aus data/uebungen/<lab>.json in neun Bauformen:
 *     quiz, zuordnen, checkliste, terminal, sql, json, reihenfolge, regal, deploy
 *   - Regal-Simulator (Power BI / Tableau) und Deploy-Simulator (Render)
 *   - Fortschrittsanzeige je Lab
 *
 * Ohne Framework, ohne Build-Schritt, ohne fremde Server: Die Seite laesst
 * sich unveraendert auf GitHub Pages legen.
 */

import { neueWelt, zuruecksetzen as weltZuruecksetzen, fuehreAus, prompt, pfadText } from './terminal.js'
import { zustandTrifft, schrittErfuellt } from './pruefung.js'
import { pruefeJson } from './jsonpruefung.js'
import { AGGREGATE, ergebnis as regalErgebnis, darstellung as regalDarstellung, abweichungen as regalAbweichungen } from './regal.js'
import { simuliereDeploy, deployErfuellt } from './deploy.js'

/* ------------------------------------------------------------------ Sprache */

const SPRACHSCHLUESSEL = 'winf:sprache'
const OSSCHLUESSEL = 'winf:os'

export function aktuelleSprache () {
  return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'de'
}

function setzeSprache (lang) {
  document.documentElement.setAttribute('data-lang', lang)
  document.documentElement.setAttribute('lang', lang)
  try { localStorage.setItem(SPRACHSCHLUESSEL, lang) } catch { /* Privater Modus */ }
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.classList.toggle('active', b.dataset.langBtn === lang)
    b.setAttribute('aria-pressed', String(b.dataset.langBtn === lang))
  })
  document.querySelectorAll('a[data-lab-link]').forEach(a => {
    const ziel = a.getAttribute('href').split('?')[0]
    a.setAttribute('href', lang === 'en' ? ziel + '?lang=en' : ziel)
  })
  document.dispatchEvent(new CustomEvent('winf:sprache', { detail: { lang } }))
}

function initSprache () {
  const ausUrl = new URLSearchParams(location.search).get('lang')
  let gespeichert = null
  try { gespeichert = localStorage.getItem(SPRACHSCHLUESSEL) } catch { /* egal */ }
  setzeSprache(ausUrl === 'en' || ausUrl === 'de' ? ausUrl : (gespeichert === 'en' ? 'en' : 'de'))
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.addEventListener('click', () => setzeSprache(b.dataset.langBtn))
  })
}

/* -------------------------------------------------------- Betriebssystem */

/**
 * Die Wahl gilt fuer die ganze Umgebung: Wer sich einmal als Windows-Nutzerin
 * zu erkennen gibt, soll nicht auf jeder Seite erneut umschalten. Beim ersten
 * Besuch raet die Umgebung anhand der Plattform - falsch geraten ist harmlos,
 * der Schalter steht sichtbar ueber jeder Befehlskarte.
 */
function geratenesOs () {
  const p = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()
  if (p.includes('win')) return 'win'
  return 'mac'
}

export function aktuellesOs () {
  return document.documentElement.getAttribute('data-os') || 'mac'
}

function setzeOs (os) {
  document.documentElement.setAttribute('data-os', os)
  try { localStorage.setItem(OSSCHLUESSEL, os) } catch { /* egal */ }
  document.querySelectorAll('[data-os-btn]').forEach(b => {
    const an = b.dataset.osBtn === os
    b.classList.toggle('active', an)
    b.setAttribute('aria-pressed', String(an))
  })
  document.dispatchEvent(new CustomEvent('winf:os', { detail: { os } }))
}

function initOs () {
  let gespeichert = null
  try { gespeichert = localStorage.getItem(OSSCHLUESSEL) } catch { /* egal */ }
  setzeOs(['mac', 'win', 'cmd'].includes(gespeichert) ? gespeichert : geratenesOs())
}

/* ------------------------------------------------------------------ Texte */

const txt = (o) => (o == null ? '' : (typeof o === 'string' ? o : (o[aktuelleSprache()] ?? o.de ?? '')))
const menge = (n, formen) => `${n} ${txt(formen)[n === 1 ? 0 : 1]}`

const M = {
  uebung:  { de: ['Übung', 'Übungen'], en: ['exercise', 'exercises'] },
  zeile:   { de: ['Zeile', 'Zeilen'], en: ['row', 'rows'] },
  schritt: { de: ['Schritt', 'Schritte'], en: ['step', 'steps'] }
}

const T = {
  pruefen:      { de: 'Prüfen', en: 'Check' },
  ausfuehren:   { de: 'Ausführen', en: 'Run' },
  loesung:      { de: 'Musterlösung anzeigen', en: 'Show model solution' },
  hinweis:      { de: 'Hinweis', en: 'Hint' },
  leeren:       { de: 'Eingabe leeren', en: 'Clear input' },
  kopieren:     { de: 'Kopieren', en: 'Copy' },
  kopiert:      { de: 'kopiert', en: 'copied' },
  kopiertNein:  { de: 'Kopieren nicht möglich – bitte von Hand markieren.', en: 'Copying failed – please select by hand.' },
  uebernehmen:  { de: 'In den Editor übernehmen', en: 'Insert into editor' },
  richtig:      { de: 'Richtig.', en: 'Correct.' },
  nochNicht:    { de: 'Noch nicht.', en: 'Not yet.' },
  ok:           { de: 'Erledigt', en: 'Done' },
  fragenOffen:  { de: 'Bitte beantworten Sie alle Fragen.', en: 'Please answer all questions.' },
  alleZuordnen: { de: 'Bitte ordnen Sie jeden Eintrag zu.', en: 'Please assign every entry.' },
  waehlen:      { de: 'bitte wählen …', en: 'please choose …' },
  leer:         { de: 'Das Feld ist leer.', en: 'The field is empty.' },
  ergebnis:     { de: 'Ergebnis', en: 'Result' },
  ausgefuehrt:  { de: 'Ausgeführt. Diese Anweisung liefert keine Tabelle zurück.', en: 'Executed. This statement returns no table.' },
  fehlerSql:    { de: 'PostgreSQL meldet einen Fehler', en: 'PostgreSQL reports an error' },
  dbLaden:      { de: 'Die Datenbank wird gestartet …', en: 'Starting the database …' },
  dbBereit:     { de: 'PostgreSQL läuft im Browser', en: 'PostgreSQL is running in your browser' },
  dbFehler:     { de: 'Die Datenbank konnte nicht gestartet werden.', en: 'The database could not be started.' },
  dbZuruck:     { de: 'Datenbank zurücksetzen', en: 'Reset database' },
  angezeigt:    { de: 'angezeigt', en: 'shown' },
  spaltenFalsch:{ de: 'Die Spalten stimmen nicht mit der Aufgabe überein.', en: 'The columns do not match the task.' },
  zeilenFalsch: { de: 'Die Zeilen stimmen nicht mit der Aufgabe überein.', en: 'The rows do not match the task.' },
  terminalZuruck:{ de: 'Zurücksetzen', en: 'Reset' },
  terminalLeeren:{ de: 'Bildschirm leeren', en: 'Clear screen' },
  auftrag:      { de: 'Auftrag', en: 'Task' },
  allesErledigt:{ de: 'Alle Schritte erledigt.', en: 'All steps completed.' },
  eingabeHier:  { de: 'Befehl eingeben und Enter drücken', en: 'Type a command and press Enter' },
  stand:        { de: 'Ihr Stand', en: 'Your progress' },
  geloest:      { de: 'gelöst', en: 'solved' },
  loeschen:     { de: 'Lernfortschritt zurücksetzen', en: 'Reset learning progress' },
  loeschenFrage:{ de: 'Den vermerkten Lernfortschritt aller Labs löschen?', en: 'Delete the recorded progress of all labs?' },
  geloescht:    { de: 'Der Lernfortschritt ist gelöscht.', en: 'Learning progress has been deleted.' },
  allesGeloest: { de: 'Alle Übungen gelöst.', en: 'All exercises solved.' },
  weiter:       { de: 'Weiter mit', en: 'Continue with' },
  zurueck:      { de: 'Zurück zu', en: 'Back to' },
  voraussetzung:{ de: 'Voraussetzung', en: 'Prerequisite' },
  umfang:       { de: 'Umfang', en: 'Scope' },
  zeitrahmen:   { de: 'Zeitrahmen', en: 'Time needed' },
  ziel:         { de: 'Kompetenzziel', en: 'Competence goal' },
  keine:        { de: 'keine', en: 'none' },
  dbBereitSqlite:{ de: 'SQLite läuft im Browser', en: 'SQLite is running in your browser' },
  fehlerSqlite: { de: 'SQLite meldet einen Fehler', en: 'SQLite reports an error' },
  formatieren:  { de: 'Formatieren', en: 'Format' },
  jsonUngueltig:{ de: 'Kein gültiges JSON', en: 'Not valid JSON' },
  jsonGueltig:  { de: 'Gültiges JSON – aber noch nicht das verlangte.', en: 'Valid JSON – but not yet what was asked for.' },
  jsonFormatiert:{ de: 'Formatiert.', en: 'Formatted.' },
  hoch:         { de: 'nach oben', en: 'move up' },
  runter:       { de: 'nach unten', en: 'move down' },
  reihenfolgeFalsch: { de: 'Ab Position {n} stimmt die Reihenfolge nicht.', en: 'The order is wrong from position {n} on.' },
  feldHinzu:    { de: 'Feld hinzufügen …', en: 'add field …' },
  entfernen:    { de: 'entfernen', en: 'remove' },
  filterWerte:  { de: 'Werte', en: 'values' },
  keineDaten:   { de: 'Legen Sie ein Feld auf ein Regal.', en: 'Put a field on a shelf.' },
  deployStart:  { de: 'Deploy Web Service', en: 'Deploy Web Service' },
  deployLaeuft: { de: 'Deploy läuft …', en: 'Deploying …' },
  deployOk:     { de: 'Der Dienst ist online.', en: 'The service is live.' },
  deployFehl:   { de: 'Der Deploy ist gescheitert.', en: 'The deploy failed.' },
  deployWarn:   { de: 'Online, aber mit einer Warnung – lesen Sie das Protokoll.', en: 'Live, but with a warning – read the log.' },
  deployNichtSoll: { de: 'Online – aber nicht so, wie der Auftrag es verlangt.', en: 'Live – but not the way the task asks for.' },
  neuerEintrag: { de: 'Variable hinzufügen', en: 'Add variable' },
  typ: {
    quiz:        { de: 'Verständnis', en: 'Understanding' },
    zuordnen:    { de: 'Zuordnen', en: 'Matching' },
    checkliste:  { de: 'Inbetriebnahme', en: 'Setting it up' },
    terminal:    { de: 'An der Konsole', en: 'At the console' },
    sql:         { de: 'SQL schreiben', en: 'Writing SQL' },
    json:        { de: 'JSON schreiben', en: 'Writing JSON' },
    reihenfolge: { de: 'In Reihenfolge bringen', en: 'Put in order' },
    regal:       { de: 'Am Regal', en: 'On the shelf' },
    deploy:      { de: 'Deployment', en: 'Deployment' }
  }
}

/** Uebersetzte Hinweise zu den haeufigsten JSON-Syntaxfehlern. Die Parsermeldung bleibt daneben stehen. */
const JSON_URSACHEN = {
  bom:            { de: 'Die Datei beginnt mit einer Byte-Order-Markierung (BOM). Windows-Editoren schreiben sie gern; JSON-Parser weisen sie ab. Speichern als „UTF-8 ohne BOM“.', en: 'The file starts with a byte order mark (BOM). Windows editors like to write it; JSON parsers reject it. Save as “UTF-8 without BOM”.' },
  einfacheAnfuehrung: { de: 'JSON kennt nur doppelte Anführungszeichen. Einfache sind in Python und JavaScript erlaubt, in JSON nicht.', en: 'JSON knows double quotes only. Single quotes are allowed in Python and JavaScript, not in JSON.' },
  nachkomma:      { de: 'Ein Komma vor der schließenden Klammer – JavaScript und Python verzeihen das, JSON nicht.', en: 'A comma before the closing bracket – JavaScript and Python forgive that, JSON does not.' },
  schluesselOhneAnfuehrung: { de: 'Schlüssel sind Zeichenketten und stehen in doppelten Anführungszeichen – auch dann, wenn sie wie Namen aussehen.', en: 'Keys are strings and go in double quotes – even when they look like names.' },
  kommentar:      { de: 'JSON hat keine Kommentare. Wo Sie welche brauchen, nehmen Sie ein Feld wie "_hinweis" – oder ein anderes Format (YAML, JSONC).', en: 'JSON has no comments. Where you need them, use a field like "_note" – or a different format (YAML, JSONC).' },
  keinJsonWert:   { de: 'undefined, NaN und Infinity sind JavaScript, nicht JSON. Erlaubt sind Zahl, Zeichenkette, true, false, null, Objekt und Feld.', en: 'undefined, NaN and Infinity are JavaScript, not JSON. Allowed are number, string, true, false, null, object and array.' },
  pythonLiteral:  { de: 'True, False und None sind Python. In JSON heißen sie true, false und null – kleingeschrieben.', en: 'True, False and None are Python. In JSON they are true, false and null – lower case.' },
  kommaFehlt:     { de: 'Zwischen zwei Werten fehlt ein Komma.', en: 'A comma is missing between two values.' },
  unvollstaendig: { de: 'Das Dokument endet, bevor alle Klammern geschlossen sind.', en: 'The document ends before all brackets are closed.' }
}

/** Uebersetzte Deutung des Deploy-Protokolls je Fehlerursache. */
const DEPLOY_HINWEISE = {
  keineDatei:     { de: 'Der Build Command verlangt eine Datei, die im Repository nicht liegt. Render baut aus dem, was auf GitHub ist – nicht aus dem, was auf Ihrem Rechner liegt.', en: 'The build command demands a file that is not in the repository. Render builds from what is on GitHub – not from what is on your machine.' },
  dockerfileFehlt:{ de: 'Für die Laufzeit Docker braucht Render ein Dockerfile im Root Directory.', en: 'For the Docker runtime Render needs a Dockerfile in the root directory.' },
  keinStart:      { de: 'Ein Web Service braucht einen Start Command – den Befehl, der den Server startet.', en: 'A web service needs a start command – the command that starts the server.' },
  lokalPort:      { de: 'Der Server hört nur auf 127.0.0.1, also nur innerhalb seines eigenen Containers. Render erreicht ihn nicht. Er muss an 0.0.0.0 binden.', en: 'The server listens on 127.0.0.1 only, i.e. only inside its own container. Render cannot reach it. It has to bind to 0.0.0.0.' },
  festerPort:     { de: 'Es lief – aber nur, weil Render den festen Port zufällig gefunden hat. Render setzt die Variable PORT; ein Dienst, der sie ausliest, läuft auch nach der nächsten Plattformänderung.', en: 'It worked – but only because Render happened to find the fixed port. Render sets the variable PORT; a service that reads it keeps working after the next platform change.' },
  keinServer:     { de: 'Der Befehl läuft durch und endet. Ein Web Service muss einen Port öffnen und laufen bleiben; ein Skript, das einmal durchläuft, ist ein Background Worker oder ein Cron Job.', en: 'The command runs through and ends. A web service must open a port and keep running; a script that runs once is a background worker or a cron job.' },
  umgebung:       { de: 'Der Code liest eine Umgebungsvariable, die nicht gesetzt ist. Auf Ihrem Rechner stand sie in .env – Render kennt diese Datei nicht. Sie gehört unter Environment Variables.', en: 'The code reads an environment variable that is not set. On your machine it sat in .env – Render does not know that file. It belongs under environment variables.' }
}

/** Hinweise der Umgebung zu Terminaleingaben. Erscheinen gedimmt unter der Ausgabe. */
const TERMINAL_HINWEISE = {
  unbekannt:      { de: 'Diese Konsole ist nachgebildet und kennt nur die Befehle, die in den Labs vorkommen. Die Schreibweise stimmt aber mit der echten überein – ein Tippfehler wird hier genauso hart zurückgewiesen.', en: 'This console is a model and only knows the commands the labs use. The spelling matches the real thing, though – a typo is rejected here just as harshly.' },
  cmdKennLs:      { de: 'In der Eingabeaufforderung heißt der Befehl "dir". "ls" versteht nur PowerShell (als Alias) und die Unix-Shells.', en: 'In Command Prompt the command is "dir". Only PowerShell (as an alias) and the Unix shells understand "ls".' },
  oeffnenMac:     { de: '"open" übergibt an den Finder – in dieser Nachbildung passiert dabei nichts Sichtbares.', en: '"open" hands over to Finder – nothing visible happens in this model.' },
  oeffnenWin:     { de: '"ii .", "explorer ." und "start ." übergeben an den Explorer – in dieser Nachbildung passiert dabei nichts Sichtbares.', en: '"ii .", "explorer ." and "start ." hand over to File Explorer – nothing visible happens in this model.' },
  python:         { de: 'Die Python-Sitzung selbst ist hier nicht nachgebildet. Versuchen Sie "python3 --version".', en: 'The Python session itself is not modelled here. Try "python3 --version".' },
  code:           { de: '"code ." öffnet den aktuellen Ordner in Visual Studio Code – der Punkt ist das Verzeichnis, nicht ein Satzzeichen.', en: '"code ." opens the current folder in Visual Studio Code – the dot is the directory, not punctuation.' },
  man:            { de: 'Hilfeseiten sind hier nicht hinterlegt. Auf dem eigenen Rechner ist "man <befehl>" bzw. "Get-Help <befehl>" der erste Griff.', en: 'Manual pages are not included here. On your own machine "man <command>" or "Get-Help <command>" is the first thing to reach for.' },
  exit:           { de: 'Die Sitzung bleibt offen – schließen lässt sich hier nichts.', en: 'The session stays open – there is nothing to close here.' },
  wsl:            { de: 'Das Windows-Subsystem für Linux ist hier nicht nachgebildet. Auf dem eigenen Rechner landen Sie damit in einer bash und arbeiten von dort an wie unter macOS – für Docker unter Windows der übliche Weg.', en: 'The Windows Subsystem for Linux is not modelled here. On your own machine it puts you into a bash and from there you work as on macOS – the usual route for Docker on Windows.' },
  psWechsel:      { de: 'Ein Wechsel der Shell ist hier nicht nachgebildet. Nutzen Sie den Schalter über den Befehlskarten – der Dateibaum bleibt dabei erhalten.', en: 'Switching shells is not modelled here. Use the switch above the command cards – the file tree is kept.' },
  cmdKennTouch:   { de: 'Die Eingabeaufforderung hat kein touch. Eine leere Datei entsteht dort mit  type nul > name.txt  – oder Sie wechseln zu PowerShell und nehmen New-Item.', en: 'Command Prompt has no touch. An empty file is created there with  type nul > name.txt  – or you switch to PowerShell and use New-Item.' },
  interaktiv:     { de: 'Interaktive Sitzungen im Container sind hier nicht nachgebildet. Auf dem eigenen Rechner landen Sie jetzt in einer Eingabeaufforderung innerhalb des Containers; "exit" bringt Sie zurück.', en: 'Interactive sessions inside the container are not modelled here. On your own machine you would now be at a prompt inside the container; "exit" brings you back.' },
  keinRepo:       { de: 'Ohne "git init" oder "git clone" gibt es kein Repository – Git verwaltet einen Ordner erst, wenn er darum gebeten wurde.', en: 'Without "git init" or "git clone" there is no repository – Git manages a folder only once it has been asked to.' },
  commitOhneAdd:  { de: 'Zwischen Arbeitsverzeichnis und Repository liegt die Stufe "Staging". Was nicht mit "git add" vorgemerkt ist, wandert auch nicht in den Commit.', en: 'Between working directory and repository sits the staging area. What is not marked with "git add" does not go into the commit.' },
  commitOhneText: { de: 'Ein Commit ohne Nachricht ist ein Commit ohne Begründung. Verwenden Sie "git commit -m \\"…\\"".', en: 'A commit without a message is a commit without a reason. Use "git commit -m \\"…\\"".' },
  zweigFehlt:     { de: 'Der Zweig existiert nicht. Neu anlegen und wechseln in einem Schritt: "git switch -c <name>".', en: 'The branch does not exist. Create and switch in one step: "git switch -c <name>".' },
  pushOhneRemote: { de: 'Ein lokales Repository kennt von sich aus keinen Server. "git remote add origin <url>" stellt die Verbindung her.', en: 'A local repository knows no server by itself. "git remote add origin <url>" establishes the link.' },
  psParameter:    { de: 'PowerShell prüft Parameter, statt sie zu übergehen. Unix-Kurzoptionen wie -la gibt es hier nicht: Get-ChildItem kennt -Force für versteckte Dateien und -Recurse für Unterordner.', en: 'PowerShell checks parameters instead of ignoring them. Unix short options such as -la do not exist here: Get-ChildItem has -Force for hidden files and -Recurse for subfolders.' },
  psMehrdeutig:   { de: 'Abkürzungen sind in PowerShell erlaubt, solange sie eindeutig bleiben. Schreiben Sie den Parameter aus – etwa -Force statt -f.', en: 'Abbreviations are allowed in PowerShell as long as they stay unambiguous. Write the parameter out – e.g. -Force instead of -f.' },
  renameNurName:  { de: 'Umbenennen ist nicht Verschieben: Der zweite Wert ist ein Name, kein Pfad. Für einen anderen Ordner nehmen Sie Move-Item bzw. move.', en: 'Renaming is not moving: the second value is a name, not a path. For a different folder use Move-Item or move.' },
  rdNichtLeer:    { de: 'rd entfernt nur leere Verzeichnisse. Mit  rd /s /q <name>  geht auch ein gefüllter Ordner – dann aber ohne Rückfrage.', en: 'rd only removes empty directories. With  rd /s /q <name>  a filled folder goes too – but then without asking.' },
  bandInBenutzung:{ de: 'Ein eingehängtes Band lässt sich nicht entfernen. Erst den Container weg (docker rm), dann das Band – genau diese Reihenfolge schützt vor Datenverlust.', en: 'A mounted volume cannot be removed. First the container (docker rm), then the volume – that order is precisely what protects you from data loss.' },
  abbildUnbekannt:{ de: 'Diese Nachbildung kennt nur wenige Abbilder: hello-world, postgres, nginx, python, adminer, ubuntu, n8nio/n8n.', en: 'This model knows only a few images: hello-world, postgres, nginx, python, adminer, ubuntu, n8nio/n8n.' },
  portBelegt:     { de: 'Ein Host-Port lässt sich nur einmal vergeben. Weichen Sie aus: "-p 15432:5432" bindet denselben Container-Port an einen anderen Port des Rechners.', en: 'A host port can only be assigned once. Move aside: "-p 15432:5432" binds the same container port to a different port on the machine.' },
  nameBelegt:     { de: 'Containernamen sind eindeutig. Entfernen Sie den alten mit "docker rm -f <name>" oder wählen Sie einen anderen Namen.', en: 'Container names are unique. Remove the old one with "docker rm -f <name>" or choose a different name.' },
  containerFehlt: { de: 'Diesen Container gibt es nicht. "docker ps -a" listet auch die gestoppten.', en: 'No such container. "docker ps -a" also lists the stopped ones.' },
  containerAus:   { de: 'In einen gestoppten Container lässt sich nicht hineingehen. Erst "docker start <name>".', en: 'You cannot step into a stopped container. Start it first with "docker start <name>".' },
  rmLaeuft:       { de: 'Ein laufender Container wird nicht einfach entfernt. Erst "docker stop", oder "docker rm -f".', en: 'A running container is not simply removed. Use "docker stop" first, or "docker rm -f".' },
  abbildInBenutzung: { de: 'Solange ein Container auf dem Abbild beruht, bleibt das Abbild. Erst den Container entfernen.', en: 'As long as a container is based on the image, the image stays. Remove the container first.' },
  keinDockerfile: { de: 'Ein Bau braucht eine Datei namens Dockerfile im aktuellen Ordner – der Punkt am Ende des Befehls ist der Bau-Kontext.', en: 'A build needs a file called Dockerfile in the current folder – the dot at the end of the command is the build context.' },
  keinCompose:    { de: 'Compose sucht im aktuellen Ordner nach compose.yaml. Ohne diese Datei gibt es nichts zu starten.', en: 'Compose looks for compose.yaml in the current folder. Without that file there is nothing to start.' },
  composeDownV:   { de: 'Achtung: "-v" hat die Bänder mitgelöscht. Die Datenbank ist jetzt leer – genau das ist der häufigste Datenverlust im Kurs.', en: 'Careful: "-v" deleted the volumes too. The database is empty now – that is the most common data loss in the course.' }
}

/* --------------------------------------------------------------------- Labs */

/**
 * Reihenfolge, Umfang, Voraussetzung, Kompetenzziel und Zeitrahmen an einer
 * Stelle. Die Lab-Seiten lesen ihre Einordnung hier heraus, die Startseite
 * ihren Fortschritt.
 */
const LABS = [
  {
    id: 'lab-01', nr: '01', datei: 'lab-01-terminal.html', uebungen: 6,
    titel: { de: 'Terminal und PowerShell', en: 'Terminal and PowerShell' },
    voraussetzung: null,
    zeit: { de: '90 Minuten', en: '90 minutes' },
    ziel: { de: 'Sich im Dateisystem bewegen, Dateien anlegen und lesen – unter macOS wie unter Windows.', en: 'Move around the file system, create and read files – on macOS as on Windows.' }
  },
  {
    id: 'lab-02', nr: '02', datei: 'lab-02-github.html', uebungen: 6,
    titel: { de: 'Git und GitHub', en: 'Git and GitHub' },
    voraussetzung: { de: 'Lab 01', en: 'Lab 01' },
    zeit: { de: '120 Minuten', en: '120 minutes' },
    ziel: { de: 'Stände festhalten, zurückholen und mit anderen zusammenführen, ohne Daten oder Zugangsdaten preiszugeben.', en: 'Record and recover states and merge them with others, without exposing data or credentials.' }
  },
  {
    id: 'lab-03', nr: '03', datei: 'lab-03-ide.html', uebungen: 5,
    titel: { de: 'PyCharm und WebStorm', en: 'PyCharm and WebStorm' },
    voraussetzung: { de: 'Lab 01, Lab 02', en: 'Lab 01, lab 02' },
    zeit: { de: '90 Minuten', en: '90 minutes' },
    ziel: { de: 'Ein Projekt mit eigener Umgebung führen und jederzeit sagen können, welcher Interpreter gerade rechnet.', en: 'Run a project with its own environment and always know which interpreter is computing.' }
  },
  {
    id: 'lab-04', nr: '04', datei: 'lab-04-colab.html', uebungen: 5,
    titel: { de: 'Google Colab', en: 'Google Colab' },
    voraussetzung: null,
    zeit: { de: '75 Minuten', en: '75 minutes' },
    ziel: { de: 'Ein Notebook so führen, dass es von oben nach unten reproduzierbar durchläuft.', en: 'Keep a notebook so that it runs reproducibly from top to bottom.' }
  },
  {
    id: 'lab-05', nr: '05', datei: 'lab-05-json.html', uebungen: 6,
    titel: { de: 'JSON-Datenstrukturen', en: 'JSON data structures' },
    voraussetzung: { de: 'Lab 04', en: 'Lab 04' },
    zeit: { de: '90 Minuten', en: '90 minutes' },
    ziel: { de: 'Verschachtelte Daten lesen, fehlerfrei schreiben und in eine Tabelle überführen.', en: 'Read nested data, write it without errors and turn it into a table.' }
  },
  {
    id: 'lab-06', nr: '06', datei: 'lab-06-sqlite.html', uebungen: 6,
    titel: { de: 'SQLite', en: 'SQLite' },
    voraussetzung: { de: 'Lab 01, Lab 05', en: 'Lab 01, lab 05' },
    zeit: { de: '105 Minuten', en: '105 minutes' },
    ziel: { de: 'Eine Datenbank als Datei anlegen, füllen und abfragen – und sagen können, wo SQLite aufhört und ein Server anfängt.', en: 'Create, fill and query a database as a file – and say where SQLite stops and a server begins.' }
  },
  {
    id: 'lab-07', nr: '07', datei: 'lab-07-docker.html', uebungen: 6,
    titel: { de: 'Docker', en: 'Docker' },
    voraussetzung: { de: 'Lab 01', en: 'Lab 01' },
    zeit: { de: '120 Minuten', en: '120 minutes' },
    ziel: { de: 'Eine Datenbank in einem Container betreiben und erklären, wovon ihre Daten das Löschen des Containers überleben.', en: 'Run a database in a container and explain what makes its data survive the container being deleted.' }
  },
  {
    id: 'lab-08', nr: '08', datei: 'lab-08-supabase.html', uebungen: 6,
    titel: { de: 'Supabase', en: 'Supabase' },
    voraussetzung: { de: 'Lab 06, Lab 07', en: 'Lab 06, lab 07' },
    zeit: { de: '105 Minuten', en: '105 minutes' },
    ziel: { de: 'Eine gehostete Postgres-Datenbank einrichten, füllen und so absichern, dass sie nicht öffentlich lesbar ist.', en: 'Set up a hosted Postgres database, fill it and secure it so that it is not publicly readable.' }
  },
  {
    id: 'lab-09', nr: '09', datei: 'lab-09-datagrip.html', uebungen: 5,
    titel: { de: 'DataGrip', en: 'DataGrip' },
    voraussetzung: { de: 'Lab 06, Lab 08', en: 'Lab 06, lab 08' },
    zeit: { de: '75 Minuten', en: '75 minutes' },
    ziel: { de: 'Eine SQLite-Datei und eine Postgres-Datenbank sicher anbinden und eine Änderung erst prüfen, dann festschreiben.', en: 'Connect an SQLite file and a Postgres database safely and check a change before committing it.' }
  },
  {
    id: 'lab-10', nr: '10', datei: 'lab-10-etl.html', uebungen: 6,
    titel: { de: 'ETL und ELT', en: 'ETL and ELT' },
    voraussetzung: { de: 'Lab 05, Lab 06, Lab 08', en: 'Lab 05, lab 06, lab 08' },
    zeit: { de: '120 Minuten', en: '120 minutes' },
    ziel: { de: 'Rohdaten wiederholbar in ein Auswertungsmodell überführen und begründen, wo die Umformung stattfindet.', en: 'Turn raw data into an analytical model repeatably and justify where the transformation takes place.' }
  },
  {
    id: 'lab-11', nr: '11', datei: 'lab-11-render.html', uebungen: 5,
    titel: { de: 'Render', en: 'Render' },
    voraussetzung: { de: 'Lab 02, Lab 07, Lab 08', en: 'Lab 02, lab 07, lab 08' },
    zeit: { de: '90 Minuten', en: '90 minutes' },
    ziel: { de: 'Einen Dienst aus einem Repository ins Netz bringen und die drei Einstellungen kennen, an denen jeder Deploy hängt.', en: 'Bring a service from a repository online and know the three settings every deploy hinges on.' }
  },
  {
    id: 'lab-12', nr: '12', datei: 'lab-12-powerbi.html', uebungen: 6,
    titel: { de: 'Power BI', en: 'Power BI' },
    voraussetzung: { de: 'Lab 10', en: 'Lab 10' },
    zeit: { de: '120 Minuten', en: '120 minutes' },
    ziel: { de: 'Ein Datenmodell mit Beziehungen aufbauen, Kennzahlen als Measures definieren und einen Bericht veröffentlichen.', en: 'Build a data model with relationships, define metrics as measures and publish a report.' }
  },
  {
    id: 'lab-13', nr: '13', datei: 'lab-13-tableau.html', uebungen: 6,
    titel: { de: 'Tableau', en: 'Tableau' },
    voraussetzung: { de: 'Lab 10, Lab 12', en: 'Lab 10, lab 12' },
    zeit: { de: '105 Minuten', en: '105 minutes' },
    ziel: { de: 'Dimension und Kennzahl, diskret und stetig auseinanderhalten und ein Dashboard bauen, das eine Frage beantwortet.', en: 'Tell dimension from measure and discrete from continuous, and build a dashboard that answers a question.' }
  }
]

const labVon = (id) => LABS.find(l => l.id === id)

/* --------------------------------------------------------------- Fortschritt */

const fortschrittSchluessel = (lab) => `winf:fortschritt:${lab}`

function ladeFortschritt (lab) {
  try { return JSON.parse(localStorage.getItem(fortschrittSchluessel(lab)) || '{}') } catch { return {} }
}
function merkeFortschritt (lab, id) {
  const f = ladeFortschritt(lab)
  f[id] = true
  try { localStorage.setItem(fortschrittSchluessel(lab), JSON.stringify(f)) } catch { /* egal */ }
  document.dispatchEvent(new CustomEvent('winf:fortschritt'))
}
function loescheFortschritt () {
  for (const l of LABS) {
    try { localStorage.removeItem(fortschrittSchluessel(l.id)) } catch { /* egal */ }
  }
  document.dispatchEvent(new CustomEvent('winf:fortschritt'))
}

/* ---------------------------------------------------------------- Werkzeuge */

const el = (tag, klasse, text) => {
  const n = document.createElement(tag)
  if (klasse) n.className = klasse
  if (text != null) n.textContent = text
  return n
}
const html = (tag, klasse, inhalt) => { const n = el(tag, klasse); n.innerHTML = inhalt; return n }
const basisUrl = new URL('..', import.meta.url)
const url = (pfad) => new URL(pfad, basisUrl).href

/** Beschriftet ein Element zweisprachig und haelt es bei Sprachwechsel nach. */
function zwei (knoten, wert, eigenschaft = 'textContent') {
  const setze = () => { knoten[eigenschaft] = txt(wert) }
  setze()
  document.addEventListener('winf:sprache', setze)
  return knoten
}

async function kopiere (text, echo) {
  try {
    await navigator.clipboard.writeText(text)
    if (echo) echo.textContent = txt(T.kopiert)
  } catch {
    if (echo) echo.textContent = txt(T.kopiertNein)
  }
}

/* ============================================================ Befehlskarten */

const OS_NAMEN = { mac: 'macOS · zsh', win: 'PowerShell', cmd: 'cmd.exe' }
const OS_PROMPT = { mac: '%', win: 'PS>', cmd: '>' }

/**
 * Baut eine Befehlskarte: die Zeile auf dunklem Grund, ein Kopierknopf und
 * darunter die Bestandteile einzeln erklaert. Wer einen Befehl abtippt, ohne
 * zu wissen, was die Bindestriche bedeuten, hat ihn nicht gelernt.
 */
function baueBefehl (ziel, def) {
  const karte = el('div', 'befehl')

  const kopf = el('div', 'befehl-kopf')
  kopf.append(zwei(el('span', 'titel'), def.titel))
  kopf.append(el('span', 'spacer'))

  const varianten = def.varianten || { alle: { befehl: def.befehl } }
  const mehrere = !varianten.alle
  if (mehrere) {
    const schalter = el('div', 'os-schalter')
    schalter.setAttribute('role', 'group')
    for (const os of ['mac', 'win', 'cmd']) {
      if (!varianten[os]) continue
      const b = el('button', 'os-btn', OS_NAMEN[os])
      b.type = 'button'
      b.dataset.osBtn = os
      b.addEventListener('click', () => setzeOs(os))
      schalter.append(b)
    }
    kopf.append(schalter)
  }
  karte.append(kopf)

  const zeile = el('div', 'befehl-zeile')
  const promptSpan = el('span', 'prompt', '$')
  const pre = el('pre')
  const knopf = zwei(el('button', 'befehl-kopieren'), T.kopieren)
  knopf.type = 'button'
  zeile.append(promptSpan, pre, knopf)
  karte.append(zeile)

  const teile = el('div', 'befehl-teile')
  const dl = el('dl')
  teile.append(dl)

  let ausgabe = null
  if (def.ausgabe) {
    ausgabe = el('div', 'befehl-ausgabe')
    karte.append(teile, ausgabe)
  } else {
    karte.append(teile)
  }

  const zeichne = () => {
    const os = mehrere ? (varianten[aktuellesOs()] ? aktuellesOs() : Object.keys(varianten)[0]) : 'alle'
    const v = varianten[os]
    pre.textContent = v.befehl
    promptSpan.textContent = mehrere ? OS_PROMPT[os] : (def.prompt || '$')
    dl.replaceChildren()
    const liste = v.teile || def.teile || []
    for (const t of liste) {
      dl.append(el('dt', null, t.was))
      dl.append(zwei(el('dd'), t.bedeutet))
    }
    teile.hidden = !liste.length
    if (ausgabe) ausgabe.textContent = typeof def.ausgabe === 'string' ? def.ausgabe : (def.ausgabe[os] || def.ausgabe.alle || '')
    knopf.onclick = () => kopiere(v.befehl, null)
  }
  zeichne()
  document.addEventListener('winf:os', zeichne)
  document.addEventListener('winf:sprache', zeichne)

  ziel.replaceChildren(karte)
}

/* ======================================================= Terminalnachbildung */

/**
 * Baut eine Konsole. Ohne `auftrag` ist sie ein Spielplatz, mit `auftrag`
 * eine Uebung: Jeder Schritt hat eine Bedingung, die entweder auf die
 * eingegebene Zeile passt oder den Zustand der Welt prueft.
 */
function baueTerminal (ziel, opt = {}) {
  const fest = opt.os || null
  const welt = neueWelt(fest || aktuellesOs())

  const kasten = el('div', 'terminal')

  const kopf = el('div', 'terminal-kopf')
  const ampel = el('span', 'ampel')
  ampel.append(el('i'), el('i'), el('i'))
  const shell = el('span', 'shell')
  kopf.append(ampel, shell, el('span', 'spacer'))

  const btnLeeren = zwei(el('button', 'btn-mini'), T.terminalLeeren)
  const btnZurueck = zwei(el('button', 'btn-mini'), T.terminalZuruck)
  btnLeeren.type = btnZurueck.type = 'button'
  kopf.append(btnLeeren, btnZurueck)
  kasten.append(kopf)

  const schirm = el('div', 'terminal-schirm')
  schirm.setAttribute('role', 'log')
  schirm.setAttribute('aria-live', 'polite')
  kasten.append(schirm)

  const eingabeZeile = el('div', 'terminal-eingabe')
  const promptSpan = el('span', 'prompt')
  const eingabe = document.createElement('input')
  eingabe.type = 'text'
  eingabe.spellcheck = false
  eingabe.autocapitalize = 'off'
  eingabe.autocomplete = 'off'
  eingabe.setAttribute('aria-label', 'Terminal')
  zwei(eingabe, T.eingabeHier, 'placeholder')
  eingabeZeile.append(promptSpan, eingabe)
  kasten.append(eingabeZeile)

  let auftragKasten = null
  let schritte = []
  if (opt.schritte && opt.schritte.length) {
    schritte = opt.schritte.map(s => ({ ...s, fertig: false }))
    auftragKasten = el('div', 'terminal-auftrag')
    kasten.append(auftragKasten)
  }

  ziel.replaceChildren(kasten)

  /* -- Ausgabe ------------------------------------------------------------ */

  const schreibe = (art, text) => {
    const z = el('div', art, text)
    schirm.append(z)
    schirm.scrollTop = schirm.scrollHeight
  }

  const zeichneKopf = () => {
    shell.textContent = `${OS_NAMEN[welt.os]} — ${pfadText(welt)}`
    promptSpan.textContent = prompt(welt)
  }

  const zeichneAuftrag = () => {
    if (!auftragKasten) return
    auftragKasten.replaceChildren()
    const kopfz = el('div')
    kopfz.append(el('strong', null, txt(T.auftrag) + ': '))
    kopfz.append(document.createTextNode(
      `${schritte.filter(s => s.fertig).length} / ${schritte.length}`))
    auftragKasten.append(kopfz)
    const ol = el('ol')
    // Die Schritte werden der Reihe nach abgearbeitet; der naechste ist markiert.
    const naechster = schritte.find(s => !s.fertig)
    for (const s of schritte) {
      const li = el('li', s.fertig ? 'erledigt' : (s === naechster ? 'aktuell' : null), txt(s.text))
      ol.append(li)
    }
    auftragKasten.append(ol)
    if (schritte.every(s => s.fertig)) {
      auftragKasten.append(el('div', 'gut', txt(T.allesErledigt)))
    }
  }

  /* -- Zustandspruefung --------------------------------------------------- */

  const zustandPasst = (z) => zustandTrifft(welt, z)

  /** Der Schritt, der als naechster abzuarbeiten ist. */
  const offenerSchritt = () => schritte.find(s => !s.fertig) || null

  /**
   * Haken setzen - und zwar nur am ersten offenen Schritt. Sonst gelten
   * spaetere Schritte als erledigt, sobald ihr Zustand zufaellig einmal passt;
   * "Zurueck ins Heimatverzeichnis" waere schon vor dem ersten Wechsel erfuellt.
   *
   * `vorher` sagt, ob die Bedingung schon vor diesem Befehl galt. Ein Schritt
   * ohne Muster verlangt eine Aenderung: Er zaehlt erst, wenn dieser Befehl den
   * Zustand hergestellt hat.
   */
  const pruefeSchritte = (zeile, vorher) => {
    const s = offenerSchritt()
    if (!s) return
    if (!schrittErfuellt(welt, s, zeile, vorher)) return
    s.fertig = true
    zeichneAuftrag()
    if (schritte.every(x => x.fertig) && opt.beiFertig) opt.beiFertig()
  }

  /* -- Eingabe ------------------------------------------------------------ */

  const verarbeite = (roh) => {
    // Zustand des naechsten offenen Schrittes VOR dem Befehl festhalten.
    const offen = offenerSchritt()
    const vorher = offen ? zustandPasst(offen.zustand) : false
    schreibe('eingabe-zeile', `${prompt(welt)} ${roh}`)
    const r = fuehreAus(welt, roh)
    if (r.leeren) schirm.replaceChildren()
    for (const z of r.zeilen) schreibe(z.art === 'fehler' ? 'fehler' : 'aus', z.text)
    if (r.hinweis && TERMINAL_HINWEISE[r.hinweis]) {
      schreibe('dim', '→ ' + txt(TERMINAL_HINWEISE[r.hinweis]))
    }
    zeichneKopf()
    pruefeSchritte(roh.trim(), vorher)
  }

  eingabe.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const roh = eingabe.value
      eingabe.value = ''
      if (roh.trim()) verarbeite(roh)
      return
    }
    // Pfeil hoch/runter blaettert durch die Historie, wie in einer echten Shell.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const h = welt.historie
      if (!h.length) return
      terminalZeiger += e.key === 'ArrowUp' ? -1 : 1
      terminalZeiger = Math.max(0, Math.min(h.length, terminalZeiger))
      eingabe.value = terminalZeiger === h.length ? '' : h[terminalZeiger]
    }
  })
  let terminalZeiger = 0
  eingabe.addEventListener('keyup', (e) => { if (e.key === 'Enter') terminalZeiger = welt.historie.length })

  kasten.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') eingabe.focus()
  })

  btnLeeren.addEventListener('click', () => schirm.replaceChildren())
  btnZurueck.addEventListener('click', () => {
    weltZuruecksetzen(welt)
    welt.os = fest || aktuellesOs()
    schirm.replaceChildren()
    schritte.forEach(s => { s.fertig = false })
    zeichneKopf(); zeichneAuftrag(); begruessung()
  })

  if (!fest) {
    document.addEventListener('winf:os', () => {
      welt.os = aktuellesOs()
      zeichneKopf()
      schreibe('dim', '→ ' + (aktuelleSprache() === 'de'
        ? `Shell gewechselt: ${OS_NAMEN[welt.os]}. Der Dateibaum bleibt.`
        : `Shell changed: ${OS_NAMEN[welt.os]}. The file tree stays.`))
    })
  }
  document.addEventListener('winf:sprache', zeichneAuftrag)

  const begruessung = () => {
    if (opt.begruessung) {
      for (const zeile of opt.begruessung) schreibe('dim', txt(zeile))
    }
  }

  zeichneKopf()
  zeichneAuftrag()
  begruessung()

  return { welt, verarbeite, schritte }
}

/* ================================================================ Datenbank

   Zwei Maschinen, eine Schnittstelle. PostgreSQL kommt als PGlite (WebAssembly),
   SQLite als sql.js (WebAssembly). Eine Seite waehlt ihre Maschine ueber das
   Attribut data-datenbank="postgres|sqlite"; eine einzelne Uebung kann mit
   `engine` abweichen. Ergebnisse haben immer die Form { fields, rows } mit
   Zeilen als Felder - damit gleichnamige Spalten nicht zusammenfallen.
   =========================================================================== */

const MASCHINEN = {
  postgres: { saat: 'data/velocity.sql', bereit: 'dbBereit', fehler: 'fehlerSql' },
  sqlite:   { saat: 'data/velocity.sqlite.sql', bereit: 'dbBereitSqlite', fehler: 'fehlerSqlite' }
}
let seitenMaschine = 'postgres'
const dbVersprechen = {}
const saatText = {}

async function ladePGlite () {
  try {
    return (await import('./pglite/index.js')).PGlite
  } catch (e) {
    console.warn('Lokale PGlite-Fassung nicht ladbar, weiche auf jsDelivr aus.', e)
    return (await import('https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.5/dist/index.js')).PGlite
  }
}

/** sql.js ist ein klassisches Skript, kein Modul: einmal nachladen, dann steht initSqlJs global. */
async function ladeSqlJs () {
  if (window.initSqlJs) return window.initSqlJs
  await new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = url('assets/sqljs/sql-wasm.js')
    s.onload = res
    s.onerror = () => rej(new Error('assets/sqljs/sql-wasm.js'))
    document.head.append(s)
  })
  return window.initSqlJs
}

async function holeDb (maschine = seitenMaschine) {
  if (!dbVersprechen[maschine]) {
    dbVersprechen[maschine] = (async () => {
      if (maschine === 'sqlite') {
        const init = await ladeSqlJs()
        const SQL = await init({ locateFile: (f) => url('assets/sqljs/' + f) })
        return { maschine, SQL, db: null }
      }
      const PGlite = await ladePGlite()
      return { maschine, db: await PGlite.create() }
    })()
  }
  return dbVersprechen[maschine]
}

async function holeSaat (maschine) {
  if (saatText[maschine] == null) {
    const r = await fetch(url(MASCHINEN[maschine].saat))
    if (!r.ok) throw new Error(MASCHINEN[maschine].saat + ': ' + r.status)
    saatText[maschine] = await r.text()
  }
  return saatText[maschine]
}

async function saeen (h) {
  if (h.maschine === 'sqlite') {
    if (h.db) h.db.close()
    h.db = new h.SQL.Database()
    h.db.exec(await holeSaat('sqlite'))
    return
  }
  // Alle selbst angelegten Schemata (public, staging, mart, …) fallen, damit
  // eine Pruefung immer auf demselben Ausgangsbestand rechnet.
  const schemata = await h.db.query(
    "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema'")
  for (const z of schemata.rows) await h.db.exec(`DROP SCHEMA IF EXISTS "${z.nspname}" CASCADE`)
  await h.db.exec('CREATE SCHEMA public;')
  await h.db.exec(await holeSaat('postgres'))
}

/**
 * Fuehrt SQL aus und liefert das letzte Ergebnis mit Spalten. Bei mehreren
 * Anweisungen zaehlt die letzte, die eine Tabelle liefert.
 */
async function fuehre (h, sql) {
  if (h.maschine === 'sqlite') {
    const mehrere = /;\s*\S/.test(sql)
    if (!mehrere) {
      const st = h.db.prepare(sql)
      try {
        const fields = st.getColumnNames().map(name => ({ name }))
        const rows = []
        while (st.step()) rows.push(st.get())
        return { fields, rows }
      } finally { st.free() }
    }
    const teile = h.db.exec(sql)
    const letzte = [...teile].reverse().find(t => t.columns && t.columns.length)
    return letzte ? { fields: letzte.columns.map(name => ({ name })), rows: letzte.values } : { fields: [], rows: [] }
  }
  if (!/;\s*\S/.test(sql)) return await h.db.query(sql, [], { rowMode: 'array' })
  const teile = await h.db.exec(sql, { rowMode: 'array' })
  return [...teile].reverse().find(t => t.fields && t.fields.length) || teile[teile.length - 1] || { fields: [], rows: [] }
}

/**
 * Die Werte einer Ergebniszeile in Spaltenreihenfolge. Abfragen laufen mit
 * rowMode 'array', also sind Zeilen Felder; ein Objekt kann aber noch von
 * anderswo kommen, dann entscheidet die Spaltenliste.
 */
function werteVon (zeile, fields = []) {
  if (Array.isArray(zeile)) return zeile
  return fields.length ? fields.map(f => zeile[f.name]) : Object.values(zeile)
}

/** Baut eine Ergebnistabelle. Zahlen rechtsbuendig, NULL erkennbar. */
function ergebnisTabelle (res, maxZeilen = 200) {
  const wrap = el('div', 'result-table')
  const tab = el('table')
  const thead = el('thead')
  const kopf = el('tr')
  for (const f of res.fields) kopf.append(el('th', null, f.name))
  thead.append(kopf); tab.append(thead)
  const tbody = el('tbody')
  for (const zeile of res.rows.slice(0, maxZeilen)) {
    const tr = el('tr')
    for (const wert of werteVon(zeile, res.fields)) {
      const td = el('td')
      if (wert === null || wert === undefined) { td.className = 'null'; td.textContent = 'NULL' }
      else if (wert instanceof Date) td.textContent = wert.toISOString().slice(0, 10)
      else if (wert instanceof Uint8Array) td.textContent = `<blob ${wert.length} B>`
      else if (typeof wert === 'object') td.textContent = JSON.stringify(wert)
      else {
        const s = String(wert)
        if (typeof wert === 'number' || typeof wert === 'bigint' || /^-?\d+(\.\d+)?$/.test(s)) td.className = 'num'
        td.textContent = s
      }
      tr.append(td)
    }
    tbody.append(tr)
  }
  tab.append(tbody); wrap.append(tab)
  return wrap
}

/** Vergleicht zwei Ergebnisse zeilenweise; Reihenfolge nur, wenn gefordert. */
function gleich (a, b, sortiert) {
  const norm = (r) => r.rows.map(z => werteVon(z, r.fields).map(v =>
    v === null || v === undefined ? '␀'
      : v instanceof Date ? v.toISOString().slice(0, 10)
        : typeof v === 'number' ? Number(v).toFixed(4)
          : /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v).toFixed(4)
            : String(v).trim()).join(''))
  let x = norm(a); let y = norm(b)
  if (!sortiert) { x = [...x].sort(); y = [...y].sort() }
  return x.length === y.length && x.every((v, i) => v === y[i])
}

function baueDbBand (ziel, maschine) {
  const band = el('div', 'db-status busy')
  band.append(el('span', 'dot'))
  const text = el('span', null, txt(T.dbLaden))
  band.append(text, el('span', 'spacer'))
  const btn = zwei(el('button', 'btn-sm'), T.dbZuruck)
  btn.type = 'button'
  btn.disabled = true
  band.append(btn)
  ziel.append(band)
  const bereit = () => txt(T[MASCHINEN[maschine].bereit])

  const setzen = async () => {
    band.className = 'db-status busy'
    text.textContent = txt(T.dbLaden)
    btn.disabled = true
    try {
      const h = await holeDb(maschine)
      await saeen(h)
      band.className = 'db-status ready'
      text.textContent = bereit()
      btn.disabled = false
      document.dispatchEvent(new CustomEvent('winf:datenbank'))
    } catch (e) {
      band.className = 'db-status failed'
      text.textContent = txt(T.dbFehler) + ' ' + e.message
    }
  }
  btn.addEventListener('click', setzen)
  document.addEventListener('winf:sprache', () => {
    if (band.classList.contains('ready')) text.textContent = bereit()
  })
  return setzen()
}

/* ============================================================== Uebungsboxen */

function status (ziel, art, ueberschrift, detail) {
  ziel.replaceChildren()
  const zeile = el('div', 'line ' + art)
  zeile.append(el('strong', null, ueberschrift))
  if (detail) {
    const p = el('pre'); p.textContent = detail; zeile.append(p)
  }
  ziel.append(zeile)
  return zeile
}

/** Fragenblock fuer den Typ `quiz`. Wird von zwei Bauformen genutzt. */
function baueFragen (fragen, ziel, uebungId) {
  const zustand = []
  fragen.forEach((f, i) => {
    const block = el('div', 'frage')
    block.append(html('p', null, txt(f.frage)))
    const mehrfach = !!f.mehrfach
    const eintraege = []
    f.optionen.forEach((o, j) => {
      const lab = el('label')
      const inp = document.createElement('input')
      inp.type = mehrfach ? 'checkbox' : 'radio'
      inp.name = `${uebungId}-f${i}`
      inp.value = String(j)
      const span = zwei(el('span'), o)
      lab.append(inp, span)
      block.append(lab)
      eintraege.push({ lab, inp, j })
    })
    const erk = el('div', 'erklaerung')
    erk.hidden = true
    block.append(erk)
    ziel.append(block)
    zustand.push({ f, eintraege, erk, mehrfach })
  })

  return {
    beantwortet: () => zustand.every(z => z.eintraege.some(e => e.inp.checked)),
    pruefe: () => {
      let alleRichtig = true
      for (const z of zustand) {
        const gewaehlt = z.eintraege.filter(e => e.inp.checked).map(e => e.j).sort()
        const richtig = [...z.f.richtig].sort()
        const passt = gewaehlt.length === richtig.length && gewaehlt.every((v, i) => v === richtig[i])
        if (!passt) alleRichtig = false
        for (const e of z.eintraege) {
          e.lab.classList.remove('richtig', 'falsch')
          if (richtig.includes(e.j)) e.lab.classList.add('richtig')
          else if (e.inp.checked) e.lab.classList.add('falsch')
        }
        if (z.f.erklaerung) { z.erk.hidden = false; z.erk.innerHTML = txt(z.f.erklaerung) }
      }
      return alleRichtig
    }
  }
}

/** Klappbare Hinweis- und Musterloesungsbloecke unter einer Eingabe. */
function hinweisUndLoesung (koerper, uebung, eingabe) {
  if (uebung.hinweis) {
    const d = el('details')
    d.append(zwei(el('summary'), T.hinweis))
    const inh = el('div', 'tip-box')
    const zeichne = () => { inh.innerHTML = txt(uebung.hinweis) }
    zeichne(); document.addEventListener('winf:sprache', zeichne)
    d.append(inh)
    koerper.append(d)
  }
  if (uebung.loesung) {
    const d = el('details')
    d.append(zwei(el('summary'), T.loesung))
    d.append(el('pre', 'code-block', uebung.loesung))
    const akt = el('div', 'uebung-aktionen')
    const bk = zwei(el('button', 'btn-sm'), T.kopieren)
    const bu = zwei(el('button', 'btn-sm'), T.uebernehmen)
    bk.type = bu.type = 'button'
    const echo = el('span', 'hinweis-klein')
    akt.append(bk, bu, echo)
    bk.addEventListener('click', () => kopiere(uebung.loesung, echo))
    bu.addEventListener('click', () => { eingabe.value = uebung.loesung; eingabe.focus() })
    d.append(akt)
    koerper.append(d)
  }
}

/* ======================================================== Regal-Simulator

   Ein Feld liegt auf einem Regal, und aus der Belegung entsteht ein Diagramm -
   das ist der Kern von Tableau (Columns/Rows/Marks) wie von Power BI
   (X-axis/Y-axis/Legend). Der Simulator bildet genau diesen Mechanismus nach,
   nicht die Oberflaeche: Felder werden per Auswahlliste auf Regale gelegt,
   Kennzahlen bekommen eine Aggregation, und das Diagramm rechnet live.
   =========================================================================== */

const REGAL_TEXTE = {
  tableau: {
    spalten: 'Columns', zeilen: 'Rows', farbe: 'Color', filter: 'Filters',
    felder: 'Data', dimension: { de: 'Dimension (diskret)', en: 'dimension (discrete)' }, kennzahl: { de: 'Kennzahl (stetig)', en: 'measure (continuous)' }
  },
  powerbi: {
    spalten: 'X-axis', zeilen: 'Y-axis', farbe: 'Legend', filter: 'Filters',
    felder: 'Data', dimension: { de: 'Spalte (Text/Datum)', en: 'column (text/date)' }, kennzahl: { de: 'Σ Kennzahl', en: 'Σ measure' }
  }
}

const regalDaten = {}
async function holeRegalDaten (quelle) {
  if (Array.isArray(quelle)) return quelle
  if (!regalDaten[quelle]) {
    regalDaten[quelle] = fetch(url(quelle)).then(r => { if (!r.ok) throw new Error(quelle + ': ' + r.status); return r.json() })
  }
  return regalDaten[quelle]
}

const FARBEN = ['#7A1F2E', '#E0B44C', '#4F6D7A', '#A0303F', '#8C9A5B', '#C98B6A', '#5B4F53']

function baueRegal (ziel, opt) {
  const V = REGAL_TEXTE[opt.variante] || REGAL_TEXTE.tableau
  const felder = opt.felder || []
  const belegung = { spalten: [], zeilen: [], farbe: null, filter: {}, ...(opt.start ? JSON.parse(JSON.stringify(opt.start)) : {}) }
  let daten = []

  const kasten = el('div', 'regal ' + (opt.variante || 'tableau'))
  const feldPane = el('div', 'regal-felder')
  const arbeit = el('div', 'regal-arbeit')
  kasten.append(feldPane, arbeit)
  ziel.replaceChildren(kasten)

  const feldName = (id) => txt(felder.find(f => f.id === id)?.titel || id)
  const istKennzahl = (id) => felder.find(f => f.id === id)?.typ === 'kennzahl'

  /* -- Feldliste links --------------------------------------------------- */
  const zeichneFelder = () => {
    feldPane.replaceChildren()
    feldPane.append(el('div', 'regal-titel', V.felder))
    for (const art of ['dimension', 'kennzahl']) {
      feldPane.append(el('div', 'regal-untertitel', txt(V[art])))
      for (const f of felder.filter(x => (x.typ === 'kennzahl') === (art === 'kennzahl'))) {
        const pill = el('span', 'pille ' + (f.typ === 'kennzahl' ? 'kennzahl' : 'dimension'))
        const symbol = f.typ === 'kennzahl' ? (opt.variante === 'powerbi' ? 'Σ' : '#') : (f.geordnet ? '📅' : 'Abc')
        pill.append(el('i', null, symbol), document.createTextNode(txt(f.titel)))
        pill.title = txt(f.erklaerung || '')
        feldPane.append(pill)
      }
    }
  }

  /* -- Regale ------------------------------------------------------------ */
  const regale = el('div', 'regale')
  const diagramm = el('div', 'regal-diagramm')
  arbeit.append(regale, diagramm)

  const chip = (regal, eintrag, i) => {
    const feld = typeof eintrag === 'string' ? eintrag : eintrag.feld
    const c = el('span', 'chip ' + (istKennzahl(feld) ? 'kennzahl' : 'dimension'))
    if (istKennzahl(feld)) {
      const sel = document.createElement('select')
      sel.className = 'agg'
      sel.setAttribute('aria-label', 'Aggregation')
      for (const a of AGGREGATE) { const o = el('option', null, a); o.value = a; sel.append(o) }
      sel.value = (typeof eintrag === 'object' && eintrag.agg) || 'SUM'
      sel.addEventListener('change', () => { belegung[regal][i] = { feld, agg: sel.value }; zeichneAlles() })
      c.append(sel, document.createTextNode('(' + feldName(feld) + ')'))
    } else {
      c.append(document.createTextNode(feldName(feld)))
    }
    const x = el('button', 'weg', '×'); x.type = 'button'; x.title = txt(T.entfernen); x.setAttribute('aria-label', txt(T.entfernen) + ' ' + feldName(feld))
    x.addEventListener('click', () => {
      if (regal === 'farbe') belegung.farbe = null
      else belegung[regal].splice(i, 1)
      zeichneAlles()
    })
    c.append(x)
    return c
  }

  const auswahl = (regal, nurDimension) => {
    const sel = document.createElement('select')
    sel.className = 'regal-auswahl'
    sel.setAttribute('aria-label', V[regal])
    const leer = el('option', null, txt(T.feldHinzu)); leer.value = ''
    sel.append(leer)
    for (const f of felder) {
      if (nurDimension && f.typ === 'kennzahl') continue
      const o = el('option', null, txt(f.titel)); o.value = f.id; sel.append(o)
    }
    sel.addEventListener('change', () => {
      if (!sel.value) return
      if (regal === 'farbe') belegung.farbe = sel.value
      else belegung[regal].push(istKennzahl(sel.value) ? { feld: sel.value, agg: 'SUM' } : sel.value)
      zeichneAlles()
    })
    return sel
  }

  const zeichneRegale = () => {
    regale.replaceChildren()
    for (const regal of ['spalten', 'zeilen']) {
      const z = el('div', 'regal-zeile')
      z.append(el('span', 'regal-name', V[regal]))
      const inhalt = el('span', 'regal-inhalt')
      belegung[regal].forEach((e, i) => inhalt.append(chip(regal, e, i)))
      inhalt.append(auswahl(regal, false))
      z.append(inhalt)
      regale.append(z)
    }
    const zf = el('div', 'regal-zeile')
    zf.append(el('span', 'regal-name', V.farbe))
    const inhaltF = el('span', 'regal-inhalt')
    if (belegung.farbe) inhaltF.append(chip('farbe', belegung.farbe, 0))
    else inhaltF.append(auswahl('farbe', true))
    zf.append(inhaltF)
    regale.append(zf)

    // Filter: ein Feld waehlen, dann Werte ankreuzen.
    const zfi = el('div', 'regal-zeile filter')
    zfi.append(el('span', 'regal-name', V.filter))
    const inhaltFi = el('span', 'regal-inhalt')
    for (const [feld, werte] of Object.entries(belegung.filter)) {
      if (!werte || !werte.length) continue
      const c = el('span', 'chip filter')
      c.append(document.createTextNode(`${feldName(feld)}: ${werte.join(', ')}`))
      const x = el('button', 'weg', '×'); x.type = 'button'; x.title = txt(T.entfernen)
      x.addEventListener('click', () => { delete belegung.filter[feld]; zeichneAlles() })
      c.append(x)
      inhaltFi.append(c)
    }
    const selF = document.createElement('select')
    selF.className = 'regal-auswahl'
    selF.setAttribute('aria-label', V.filter)
    const leerF = el('option', null, txt(T.feldHinzu)); leerF.value = ''
    selF.append(leerF)
    for (const f of felder.filter(x => x.typ !== 'kennzahl')) { const o = el('option', null, txt(f.titel)); o.value = f.id; selF.append(o) }
    inhaltFi.append(selF)
    const werteBox = el('div', 'filter-werte')
    inhaltFi.append(werteBox)
    selF.addEventListener('change', () => {
      werteBox.replaceChildren()
      if (!selF.value) return
      const feld = selF.value
      const werte = [...new Set(daten.map(z => z[feld]))]
      const ordnung = felder.find(f => f.id === feld)?.reihenfolge
      werte.sort((a, b) => ordnung ? ordnung.indexOf(a) - ordnung.indexOf(b) : String(a).localeCompare(String(b), 'de'))
      werteBox.append(el('span', 'hinweis-klein', txt(T.filterWerte) + ': '))
      for (const w of werte) {
        const lab = el('label', 'filter-wert')
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = String(w)
        cb.checked = (belegung.filter[feld] || []).map(String).includes(String(w))
        cb.addEventListener('change', () => {
          const aktuell = new Set((belegung.filter[feld] || []).map(String))
          if (cb.checked) aktuell.add(String(w)); else aktuell.delete(String(w))
          belegung.filter[feld] = [...aktuell]
          zeichneDiagramm()
          // Chips oben nachziehen, Auswahl aber offen lassen.
          zeichneRegale(); regale.querySelector('.filter select').value = feld; regale.querySelector('.filter select').dispatchEvent(new Event('change'))
        })
        lab.append(cb, document.createTextNode(String(w)))
        werteBox.append(lab)
      }
    })
    zfi.append(inhaltFi)
    regale.append(zfi)
  }

  /* -- Diagramm ---------------------------------------------------------- */
  const fmt = (v) => v == null ? '–' : (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('de-DE') : Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 }))

  const zeichneDiagramm = () => {
    diagramm.replaceChildren()
    const art = regalDarstellung(felder, belegung)
    if (art === 'leer' || !daten.length) { diagramm.append(el('p', 'hinweis-klein', txt(T.keineDaten))); return }
    const erg = regalErgebnis(daten, felder, belegung)

    if (art === 'tabelle') {
      const res = {
        fields: [...erg.dimensionen.map(d => ({ name: feldName(d.feld) })), ...erg.kennzahlen.map(k => ({ name: k.titel }))],
        rows: erg.zeilen.map(z => [...erg.dimensionen.map(d => z.schluessel[d.feld]), ...erg.kennzahlen.map(k => z.werte[k.titel] == null ? null : Math.round(z.werte[k.titel] * 100) / 100)])
      }
      diagramm.append(ergebnisTabelle(res, 50))
      return
    }

    // Achsen: die Dimension auf Spalten bildet die x-Achse (senkrechte Balken);
    // liegt sie auf Zeilen, werden die Balken waagerecht - wie im Werkzeug.
    const dimSp = erg.dimensionen.find(d => d.regal === 'spalten')
    const dimZe = erg.dimensionen.find(d => d.regal === 'zeilen')
    const waagerecht = !dimSp && !!dimZe
    const achse = (dimSp || dimZe).feld
    const kenn = erg.kennzahlen[0]
    const farbe = erg.dimensionen.find(d => d.regal === 'farbe')?.feld || null

    const kategorien = [...new Set(erg.zeilen.map(z => z.schluessel[achse]))]
    const reihen = farbe ? [...new Set(erg.zeilen.map(z => z.schluessel[farbe]))] : [null]
    const wert = (k, r) => erg.zeilen.find(z => z.schluessel[achse] === k && (!farbe || z.schluessel[farbe] === r))?.werte[kenn.titel] ?? 0
    const maxWert = Math.max(1, ...kategorien.map(k => art === 'linie' || !farbe ? Math.max(...reihen.map(r => wert(k, r))) : reihen.reduce((s, r) => s + wert(k, r), 0)))

    const B = 620; const H = waagerecht ? Math.max(180, 26 * kategorien.length + 60) : 300
    const rand = { l: waagerecht ? 130 : 60, r: 16, o: 16, u: waagerecht ? 30 : 60 }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', `0 0 ${B} ${H}`)
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', `${kenn.titel} ${txt({ de: 'nach', en: 'by' })} ${feldName(achse)}`)
    const ns = (tag, attrs, text) => {
      const n = document.createElementNS('http://www.w3.org/2000/svg', tag)
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
      if (text != null) n.textContent = text
      return n
    }
    const innenB = B - rand.l - rand.r; const innenH = H - rand.o - rand.u
    // Achsen und Raster
    for (let i = 0; i <= 4; i++) {
      const v = maxWert * i / 4
      if (waagerecht) {
        const x = rand.l + innenB * i / 4
        svg.append(ns('line', { x1: x, y1: rand.o, x2: x, y2: rand.o + innenH, class: 'raster' }))
        svg.append(ns('text', { x, y: H - 8, class: 'achse', 'text-anchor': 'middle' }, fmt(v)))
      } else {
        const y = rand.o + innenH - innenH * i / 4
        svg.append(ns('line', { x1: rand.l, y1: y, x2: B - rand.r, y2: y, class: 'raster' }))
        svg.append(ns('text', { x: rand.l - 6, y: y + 4, class: 'achse', 'text-anchor': 'end' }, fmt(v)))
      }
    }
    const farbeVon = (r) => FARBEN[reihen.indexOf(r) % FARBEN.length]
    if (art === 'linie') {
      const xVon = (i) => rand.l + (kategorien.length === 1 ? innenB / 2 : innenB * i / (kategorien.length - 1))
      for (const r of reihen) {
        const punkte = kategorien.map((k, i) => `${xVon(i)},${rand.o + innenH - innenH * wert(k, r) / maxWert}`).join(' ')
        svg.append(ns('polyline', { points: punkte, fill: 'none', stroke: farbeVon(r), 'stroke-width': 2.5 }))
        kategorien.forEach((k, i) => {
          const c = ns('circle', { cx: xVon(i), cy: rand.o + innenH - innenH * wert(k, r) / maxWert, r: 3.5, fill: farbeVon(r) })
          c.append(ns('title', {}, `${k}${r != null ? ' · ' + r : ''}: ${fmt(wert(k, r))}`))
          svg.append(c)
        })
      }
      kategorien.forEach((k, i) => svg.append(ns('text', { x: xVon(i), y: H - rand.u + 16, class: 'achse', 'text-anchor': 'middle' }, String(k))))
    } else {
      const schritt = (waagerecht ? innenH : innenB) / kategorien.length
      const breite = schritt * 0.7
      kategorien.forEach((k, i) => {
        let stapel = 0
        for (const r of reihen) {
          const v = wert(k, r)
          if (waagerecht) {
            const y = rand.o + schritt * i + (schritt - breite) / 2
            const x0 = rand.l + innenB * stapel / maxWert
            const rect = ns('rect', { x: x0, y, width: innenB * v / maxWert, height: breite, fill: farbeVon(r) })
            rect.append(ns('title', {}, `${k}${r != null ? ' · ' + r : ''}: ${fmt(v)}`))
            svg.append(rect)
          } else {
            const x = rand.l + schritt * i + (schritt - breite) / 2
            const h = innenH * v / maxWert
            const y = rand.o + innenH - innenH * stapel / maxWert - h
            const rect = ns('rect', { x, y, width: breite, height: h, fill: farbeVon(r) })
            rect.append(ns('title', {}, `${k}${r != null ? ' · ' + r : ''}: ${fmt(v)}`))
            svg.append(rect)
          }
          stapel += v
        }
        if (waagerecht) svg.append(ns('text', { x: rand.l - 6, y: rand.o + schritt * i + schritt / 2 + 4, class: 'achse', 'text-anchor': 'end' }, String(k)))
        else {
          const t = ns('text', { x: rand.l + schritt * i + schritt / 2, y: H - rand.u + 16, class: 'achse', 'text-anchor': 'middle' }, String(k))
          if (kategorien.length > 8) { t.setAttribute('transform', `rotate(-35 ${rand.l + schritt * i + schritt / 2} ${H - rand.u + 16})`); t.setAttribute('text-anchor', 'end') }
          svg.append(t)
        }
      })
    }
    svg.append(ns('text', { x: waagerecht ? B / 2 : 14, y: waagerecht ? H - 8 : H / 2, class: 'achse titel', 'text-anchor': 'middle', transform: waagerecht ? '' : `rotate(-90 14 ${H / 2})` }, kenn.titel))
    diagramm.append(svg)
    if (farbe) {
      const legende = el('div', 'legende')
      for (const r of reihen) { const s = el('span'); s.append(el('i')); s.querySelector('i').style.background = farbeVon(r); s.append(document.createTextNode(String(r))); legende.append(s) }
      diagramm.append(legende)
    }
  }

  const zeichneAlles = () => { zeichneRegale(); zeichneDiagramm() }

  if (opt.ziel) {
    const aktionen = el('div', 'uebung-aktionen')
    const btn = zwei(el('button', 'btn-sm primary'), T.pruefen)
    btn.type = 'button'
    const btnLeer = zwei(el('button', 'btn-sm'), T.leeren)
    btnLeer.type = 'button'
    aktionen.append(btn, btnLeer)
    arbeit.append(aktionen)
    btn.addEventListener('click', () => {
      // Die Abweichungen nennen das Regal mit dem Namen, den das Werkzeug verwendet.
      const fehler = regalAbweichungen(belegung, opt.ziel).map(f => ({
        ...f,
        text: f.regal === 'spalten' || f.regal === 'zeilen' || f.regal === 'farbe'
          ? { de: `Regal „${V[f.regal]}“ stimmt nicht.`, en: `Shelf “${V[f.regal]}” is not right.` }
          : f.text
      }))
      opt.beiPruefung(fehler)
    })
    btnLeer.addEventListener('click', () => { belegung.spalten = []; belegung.zeilen = []; belegung.farbe = null; belegung.filter = {}; zeichneAlles() })
  }

  zeichneFelder()
  zeichneAlles()
  holeRegalDaten(opt.datenQuelle).then(d => { daten = d; zeichneAlles() }).catch(e => {
    diagramm.append(el('p', 'hinweis-klein', 'Daten nicht ladbar: ' + e.message))
  })
  document.addEventListener('winf:sprache', () => { zeichneFelder(); zeichneAlles() })
  return { belegung }
}

/* ======================================================= Deploy-Simulator

   Das Formular "New Web Service" von Render, nachgebildet auf die Felder, an
   denen ein Deploy tatsaechlich haengt: Laufzeit, Root Directory, Build
   Command, Start Command, Umgebungsvariablen. Rechts das Repository, wie es
   auf GitHub liegt. Der Knopf erzeugt das Protokoll aus deploy.js.
   =========================================================================== */

function baueDeploy (ziel, opt) {
  const repo = opt.repo || { dateien: {}, liest: [] }
  const eingaben = { runtime: 'python', rootDir: '', build: '', start: '', env: [], dienst: 'web', ...(opt.start || {}) }
  eingaben.env = (eingaben.env || []).map(e => ({ ...e }))

  const kasten = el('div', 'deploy')
  const form = el('div', 'deploy-form')
  const repoPane = el('div', 'deploy-repo')
  kasten.append(form, repoPane)
  ziel.replaceChildren(kasten)

  /* -- Repository rechts ------------------------------------------------- */
  const zeichneRepo = () => {
    repoPane.replaceChildren()
    const kopf = el('div', 'deploy-repo-kopf')
    kopf.append(el('span', 'gh', ''), el('span', null, (repo.url || 'https://github.com/studi/velocity-api').replace('https://github.com/', '')))
    repoPane.append(kopf)
    const baum = el('ul', 'dateibaum')
    const inhalt = el('pre', 'dateiinhalt')
    const namen = Object.keys(repo.dateien || {}).sort()
    for (const n of namen) {
      const li = el('li')
      const b = el('button', 'datei', n); b.type = 'button'
      b.addEventListener('click', () => { baum.querySelectorAll('.datei').forEach(x => x.classList.remove('aktiv')); b.classList.add('aktiv'); inhalt.textContent = repo.dateien[n] })
      li.append(b); baum.append(li)
    }
    repoPane.append(baum, inhalt)
    if (namen.length) baum.querySelector('.datei').click()
  }

  /* -- Formular links ---------------------------------------------------- */
  const feld = (label, eingabe, hinweis) => {
    const z = el('div', 'deploy-feld')
    const l = el('label', null, label)
    l.htmlFor = eingabe.id = 'd-' + Math.random().toString(36).slice(2, 8)
    z.append(l, eingabe)
    if (hinweis) z.append(zwei(el('div', 'hinweis-klein'), hinweis))
    return z
  }
  const text = (wert, platzhalter, mono = true) => {
    const i = document.createElement('input'); i.type = 'text'; i.value = wert || ''; i.placeholder = platzhalter || ''
    i.spellcheck = false; i.autocomplete = 'off'; if (mono) i.className = 'mono'
    return i
  }

  form.append(el('div', 'deploy-titel', 'New Web Service'))
  const name = text(repo.name || 'velocity-api', '', false)
  name.disabled = true
  form.append(feld('Name', name))

  const runtime = document.createElement('select')
  for (const [v, t] of [['python', 'Python 3'], ['node', 'Node'], ['docker', 'Docker']]) { const o = el('option', null, t); o.value = v; runtime.append(o) }
  runtime.value = eingaben.runtime
  form.append(feld('Language', runtime))

  const rootDir = text(eingaben.rootDir, 'e.g. src', true)
  form.append(feld('Root Directory', rootDir, { de: 'Optional. Ordner im Repository, in dem gebaut wird.', en: 'Optional. Folder inside the repository the build runs in.' }))

  const build = text(eingaben.build, 'pip install -r requirements.txt')
  const start = text(eingaben.start, 'uvicorn main:app --host 0.0.0.0 --port $PORT')
  const buildFeld = feld('Build Command', build)
  const startFeld = feld('Start Command', start)
  form.append(buildFeld, startFeld)
  const dockerHinweis = zwei(el('div', 'hinweis-klein'), { de: 'Bei Docker bauen und starten Dockerfile und CMD – Build und Start Command entfallen.', en: 'With Docker, the Dockerfile and its CMD build and start – build and start command are not used.' })
  dockerHinweis.hidden = true
  form.append(dockerHinweis)

  const instanz = document.createElement('select')
  for (const t of ['Free · 512 MB RAM · 0.1 CPU', 'Starter · 512 MB · 0.5 CPU · $7/mo']) { const o = el('option', null, t); instanz.append(o) }
  form.append(feld('Instance Type', instanz))

  const envTitel = el('div', 'deploy-untertitel', 'Environment Variables')
  const envTab = el('div', 'env-tabelle')
  const envHinzu = zwei(el('button', 'btn-sm'), T.neuerEintrag)
  envHinzu.type = 'button'
  form.append(envTitel, envTab, envHinzu)
  const zeichneEnv = () => {
    envTab.replaceChildren()
    eingaben.env.forEach((e, i) => {
      const z = el('div', 'env-zeile')
      const k = text(e.name, 'NAME_OF_VARIABLE'); k.setAttribute('aria-label', 'Key')
      const v = text(e.value, 'value'); v.setAttribute('aria-label', 'Value')
      k.addEventListener('input', () => { e.name = k.value })
      v.addEventListener('input', () => { e.value = v.value })
      const x = el('button', 'weg', '×'); x.type = 'button'; x.title = txt(T.entfernen)
      x.addEventListener('click', () => { eingaben.env.splice(i, 1); zeichneEnv() })
      z.append(k, v, x)
      envTab.append(z)
    })
  }
  envHinzu.addEventListener('click', () => { eingaben.env.push({ name: '', value: '' }); zeichneEnv(); envTab.querySelector('.env-zeile:last-child input').focus() })
  zeichneEnv()

  const aktionen = el('div', 'uebung-aktionen')
  const btnDeploy = zwei(el('button', 'btn-sm primary'), T.deployStart)
  btnDeploy.type = 'button'
  aktionen.append(btnDeploy)
  form.append(aktionen)

  const log = el('div', 'deploy-log')
  log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite')
  log.hidden = true
  kasten.append(log)

  const lesen = () => {
    eingaben.runtime = runtime.value
    eingaben.rootDir = rootDir.value.trim()
    eingaben.build = build.value
    eingaben.start = start.value
    return eingaben
  }
  runtime.addEventListener('change', () => {
    const d = runtime.value === 'docker'
    buildFeld.hidden = startFeld.hidden = d
    dockerHinweis.hidden = !d
    if (runtime.value === 'node' && !build.value) build.placeholder = 'npm install'
    if (runtime.value === 'node' && !start.value) start.placeholder = 'node server.js'
  })
  runtime.dispatchEvent(new Event('change'))

  let laeuft = false
  btnDeploy.addEventListener('click', async () => {
    if (laeuft) return
    laeuft = true; btnDeploy.disabled = true
    const e = lesen()
    const r = simuliereDeploy(e, repo)
    log.hidden = false
    log.replaceChildren(el('div', 'dim', txt(T.deployLaeuft)))
    const sofort = matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const z of r.zeilen) {
      if (!sofort) await new Promise(res => setTimeout(res, z.text.startsWith('==>') ? 260 : 90))
      log.append(el('div', z.art, z.text))
      log.scrollTop = log.scrollHeight
    }
    laeuft = false; btnDeploy.disabled = false
    if (opt.beiErgebnis) opt.beiErgebnis(e, r)
  })

  zeichneRepo()
  return { eingaben }
}

function baueBox (uebung, ctx) {
  const box = el('section', 'uebung')
  box.id = 'uebung-' + uebung.id

  const kopf = el('div', 'uebung-kopf')
  kopf.append(el('span', 'uebung-id', uebung.id))
  kopf.append(zwei(el('span', 'uebung-typ'), T.typ[uebung.typ] || ''))
  kopf.append(zwei(el('span', 'uebung-titel'), uebung.titel))
  kopf.append(el('span', 'spacer'))
  const haken = zwei(el('span', 'badge'), T.ok)
  haken.hidden = !ctx.fortschritt[uebung.id]
  kopf.append(haken)
  box.append(kopf)

  const koerper = el('div', 'uebung-koerper')
  const aufgabe = el('div', 'uebung-aufgabe')
  const zeichneAufgabe = () => { aufgabe.innerHTML = txt(uebung.aufgabe) }
  zeichneAufgabe()
  document.addEventListener('winf:sprache', zeichneAufgabe)
  koerper.append(aufgabe)
  box.append(koerper)

  const erledigt = () => {
    haken.hidden = false
    merkeFortschritt(ctx.lab, uebung.id)
  }

  const meldung = el('div', 'uebung-status')

  /* ---------------------------------------------------------------- quiz */
  if (uebung.typ === 'quiz') {
    const fragenZiel = el('div')
    koerper.append(fragenZiel)
    const fragen = baueFragen(uebung.fragen, fragenZiel, uebung.id)
    const aktionen = el('div', 'uebung-aktionen')
    const btn = zwei(el('button', 'btn-sm primary'), T.pruefen)
    btn.type = 'button'
    aktionen.append(btn)
    koerper.append(aktionen, meldung)
    btn.addEventListener('click', () => {
      if (!fragen.beantwortet()) { status(meldung, 'note', txt(T.fragenOffen)); return }
      if (fragen.pruefe()) {
        status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
        erledigt()
      } else {
        status(meldung, 'fail', txt(T.nochNicht))
      }
    })
  }

  /* ------------------------------------------------------------ zuordnen */
  if (uebung.typ === 'zuordnen') {
    const gitter = el('div', 'zuordnen')
    const felder = []
    for (const p of uebung.paare) {
      const zeile = el('div', 'paar')
      zeile.append(zwei(el('span', 'begriff'), p.begriff))
      const sel = document.createElement('select')
      const leer = el('option', null, txt(T.waehlen))
      leer.value = ''
      sel.append(leer)
      for (const z of uebung.ziele) {
        const o = el('option', null, txt(z.text))
        o.value = z.id
        sel.append(o)
      }
      sel.setAttribute('aria-label', txt(p.begriff))
      zeile.append(sel)
      gitter.append(zeile)
      felder.push({ p, sel, zeile })
    }
    koerper.append(gitter)
    const aktionen = el('div', 'uebung-aktionen')
    const btn = zwei(el('button', 'btn-sm primary'), T.pruefen)
    btn.type = 'button'
    aktionen.append(btn)
    koerper.append(aktionen, meldung)

    document.addEventListener('winf:sprache', () => {
      for (const f of felder) {
        f.sel.options[0].textContent = txt(T.waehlen)
        uebung.ziele.forEach((z, i) => { f.sel.options[i + 1].textContent = txt(z.text) })
      }
    })

    btn.addEventListener('click', () => {
      if (felder.some(f => !f.sel.value)) { status(meldung, 'note', txt(T.alleZuordnen)); return }
      let alle = true
      for (const f of felder) {
        const passt = f.sel.value === f.p.ziel
        f.zeile.classList.toggle('richtig', passt)
        f.zeile.classList.toggle('falsch', !passt)
        if (!passt) alle = false
      }
      if (alle) {
        status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
        erledigt()
      } else status(meldung, 'fail', txt(T.nochNicht))
    })
  }

  /* ---------------------------------------------------------- checkliste */
  if (uebung.typ === 'checkliste') {
    const liste = el('ul', 'checkliste')
    const kaesten = []
    uebung.schritte.forEach((s, i) => {
      const li = el('li')
      const inp = document.createElement('input')
      inp.type = 'checkbox'
      inp.id = `${uebung.id}-s${i}`
      const lab = document.createElement('label')
      lab.className = 'schritt-text'
      lab.htmlFor = inp.id
      const zeichne = () => { lab.innerHTML = txt(s.text) }
      zeichne()
      document.addEventListener('winf:sprache', zeichne)
      li.append(el('span', 'schritt-nr', String(i + 1) + '.'), inp, lab)
      liste.append(li)
      kaesten.push({ inp, li })
    })
    koerper.append(liste, meldung)
    const pruefe = () => {
      for (const k of kaesten) k.li.classList.toggle('ab', k.inp.checked)
      if (kaesten.every(k => k.inp.checked)) {
        status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
        erledigt()
      }
    }
    for (const k of kaesten) k.inp.addEventListener('change', pruefe)
  }

  /* ------------------------------------------------------------ terminal */
  if (uebung.typ === 'terminal') {
    const halter = el('div')
    koerper.append(halter, meldung)
    baueTerminal(halter, {
      os: uebung.os && uebung.os !== 'alle' ? uebung.os : null,
      schritte: uebung.schritte,
      begruessung: uebung.begruessung,
      beiFertig: () => {
        status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
        erledigt()
      }
    })
  }

  /* ----------------------------------------------------------------- sql */
  if (uebung.typ === 'sql') {
    const maschine = uebung.engine || ctx.maschine || seitenMaschine
    const eingabe = document.createElement('textarea')
    eingabe.spellcheck = false
    eingabe.value = uebung.start || ''
    eingabe.setAttribute('aria-label', txt(uebung.titel))
    koerper.append(eingabe)

    const aktionen = el('div', 'uebung-aktionen')
    const btnRun = zwei(el('button', 'btn-sm'), T.ausfuehren)
    const btnCheck = zwei(el('button', 'btn-sm primary'), T.pruefen)
    btnRun.type = btnCheck.type = 'button'
    btnRun.append(el('kbd', null, navigator.platform.includes('Mac') ? '⌘⏎' : 'Strg+⏎'))
    aktionen.append(btnRun, btnCheck, el('span', 'spacer'))
    const btnLeeren = zwei(el('button', 'btn-sm'), T.leeren)
    btnLeeren.type = 'button'
    aktionen.append(btnLeeren)
    koerper.append(aktionen, meldung)

    hinweisUndLoesung(koerper, uebung, eingabe)

    const zeigeErgebnis = (art, kopfText, res, detail) => {
      const zeile = status(meldung, art, kopfText, detail)
      if (res && res.fields && res.fields.length) {
        meldung.append(el('div', 'result-meta',
          menge(res.rows.length, M.zeile) + (res.rows.length > 200 ? ` (200 ${txt(T.angezeigt)})` : '')))
        if (res.rows.length) meldung.append(ergebnisTabelle(res))
      }
      return zeile
    }

    const sperren = (an) => { btnRun.disabled = btnCheck.disabled = an }
    const fehlerText = () => txt(T[MASCHINEN[maschine].fehler])

    btnRun.addEventListener('click', async () => {
      const sql = eingabe.value.trim()
      if (!sql) { status(meldung, 'note', txt(T.leer)); return }
      sperren(true); status(meldung, 'note', txt(T.dbLaden))
      try {
        const h = await holeDb(maschine)
        if (!h.db) await saeen(h)
        const res = await fuehre(h, sql)
        if (res.fields && res.fields.length) zeigeErgebnis('note', txt(T.ergebnis), res)
        else status(meldung, 'note', txt(T.ausgefuehrt))
      } catch (e) {
        status(meldung, 'fail', fehlerText(), e.message)
      } finally { sperren(false) }
    })

    eingabe.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); btnRun.click() }
    })

    btnCheck.addEventListener('click', async () => {
      const sql = eingabe.value.trim()
      if (!sql) { status(meldung, 'note', txt(T.leer)); return }
      sperren(true); status(meldung, 'note', txt(T.dbLaden))
      try {
        const h = await holeDb(maschine)
        await saeen(h)
        if (uebung.vorher) await fuehre(h, uebung.vorher)
        const meins = await fuehre(h, sql)
        // Bei Anweisungen, die den Bestand aendern, wird das Ergebnis ueber
        // eine Kontrollabfrage verglichen - sonst ueber die Abfrage selbst.
        const kontrolle = uebung.kontrolle || null
        const meinsK = kontrolle ? await fuehre(h, kontrolle) : meins
        await saeen(h)
        if (uebung.vorher) await fuehre(h, uebung.vorher)
        await fuehre(h, uebung.loesung)
        const soll = kontrolle ? await fuehre(h, kontrolle) : await fuehre(h, uebung.loesung)
        const spaltenGleich = meinsK.fields.length === soll.fields.length
        if (!spaltenGleich) {
          zeigeErgebnis('fail', txt(T.nochNicht), meinsK, txt(T.spaltenFalsch))
        } else if (gleich(meinsK, soll, !!uebung.sortiert)) {
          zeigeErgebnis('ok', txt(T.richtig), meinsK, uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
          erledigt()
        } else {
          zeigeErgebnis('fail', txt(T.nochNicht), meinsK, txt(T.zeilenFalsch))
        }
      } catch (e) {
        status(meldung, 'fail', fehlerText(), e.message)
      } finally { sperren(false) }
    })

    btnLeeren.addEventListener('click', () => {
      eingabe.value = uebung.start || ''
      meldung.replaceChildren()
      eingabe.focus()
    })
  }

  /* ---------------------------------------------------------------- json */
  if (uebung.typ === 'json') {
    const eingabe = document.createElement('textarea')
    eingabe.spellcheck = false
    eingabe.className = 'json-eingabe'
    eingabe.value = uebung.start || ''
    eingabe.setAttribute('aria-label', txt(uebung.titel))
    koerper.append(eingabe)

    const aktionen = el('div', 'uebung-aktionen')
    const btnCheck = zwei(el('button', 'btn-sm primary'), T.pruefen)
    const btnFormat = zwei(el('button', 'btn-sm'), T.formatieren)
    const btnLeeren = zwei(el('button', 'btn-sm'), T.leeren)
    btnCheck.type = btnFormat.type = btnLeeren.type = 'button'
    aktionen.append(btnCheck, btnFormat, el('span', 'spacer'), btnLeeren)
    koerper.append(aktionen, meldung)
    hinweisUndLoesung(koerper, uebung, eingabe)

    const zeigeSyntaxfehler = (r) => {
      const detail = r.meldung + (r.ursache && JSON_URSACHEN[r.ursache] ? '\n→ ' + txt(JSON_URSACHEN[r.ursache]) : '')
      status(meldung, 'fail', txt(T.jsonUngueltig), detail)
    }

    btnCheck.addEventListener('click', () => {
      const text = eingabe.value
      if (!text.trim()) { status(meldung, 'note', txt(T.leer)); return }
      const r = pruefeJson(text, uebung)
      if (r.meldung) { zeigeSyntaxfehler(r); return }
      if (r.ok) {
        status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
        erledigt()
      } else {
        status(meldung, 'fail', txt(T.jsonGueltig), r.befunde.map(b => '• ' + txt(b.text)).join('\n'))
      }
    })
    btnFormat.addEventListener('click', () => {
      const r = pruefeJson(eingabe.value, {})
      if (r.meldung) { zeigeSyntaxfehler(r); return }
      eingabe.value = JSON.stringify(r.geparst, null, 2)
      status(meldung, 'note', txt(T.jsonFormatiert))
    })
    btnLeeren.addEventListener('click', () => { eingabe.value = uebung.start || ''; meldung.replaceChildren(); eingabe.focus() })
  }

  /* --------------------------------------------------------- reihenfolge */
  if (uebung.typ === 'reihenfolge') {
    const eintraege = uebung.eintraege
    const start = uebung.start || [...eintraege].map(e => e.id).reverse()
    let reihenfolge = [...start]
    const liste = el('ol', 'reihenfolge')
    koerper.append(liste)

    const zeichne = () => {
      liste.replaceChildren()
      reihenfolge.forEach((id, i) => {
        const e = eintraege.find(x => x.id === id)
        const li = el('li')
        li.dataset.id = id
        const text = el('span', 'text')
        text.innerHTML = txt(e.text)
        const knoepfe = el('span', 'knoepfe')
        const hoch = el('button', 'btn-mini', '▲'); hoch.type = 'button'; hoch.title = txt(T.hoch); hoch.setAttribute('aria-label', txt(T.hoch))
        const runter = el('button', 'btn-mini', '▼'); runter.type = 'button'; runter.title = txt(T.runter); runter.setAttribute('aria-label', txt(T.runter))
        hoch.disabled = i === 0
        runter.disabled = i === reihenfolge.length - 1
        hoch.addEventListener('click', () => { [reihenfolge[i - 1], reihenfolge[i]] = [reihenfolge[i], reihenfolge[i - 1]]; zeichne(); liste.children[i - 1].querySelector('button').focus() })
        runter.addEventListener('click', () => { [reihenfolge[i + 1], reihenfolge[i]] = [reihenfolge[i], reihenfolge[i + 1]]; zeichne(); liste.children[i + 1].querySelectorAll('button')[1].focus() })
        knoepfe.append(hoch, runter)
        li.append(el('span', 'nr', String(i + 1) + '.'), text, knoepfe)
        liste.append(li)
      })
    }
    zeichne()
    document.addEventListener('winf:sprache', zeichne)

    const aktionen = el('div', 'uebung-aktionen')
    const btn = zwei(el('button', 'btn-sm primary'), T.pruefen)
    btn.type = 'button'
    aktionen.append(btn)
    koerper.append(aktionen, meldung)
    btn.addEventListener('click', () => {
      let erste = -1
      reihenfolge.forEach((id, i) => {
        const passt = uebung.richtig[i] === id
        liste.children[i].classList.toggle('richtig', passt)
        liste.children[i].classList.toggle('falsch', !passt)
        if (!passt && erste < 0) erste = i
      })
      if (erste < 0) {
        status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
        erledigt()
      } else {
        status(meldung, 'fail', txt(T.nochNicht), txt(T.reihenfolgeFalsch).replace('{n}', String(erste + 1)))
      }
    })
  }

  /* --------------------------------------------------------------- regal */
  if (uebung.typ === 'regal') {
    const halter = el('div')
    koerper.append(halter, meldung)
    baueRegal(halter, {
      variante: uebung.variante || 'tableau',
      felder: uebung.felder || ctx.daten?.regal?.felder,
      datenQuelle: uebung.daten || ctx.daten?.regal?.daten,
      start: uebung.startBelegung,
      ziel: uebung.ziel,
      beiPruefung: (fehler) => {
        if (!fehler.length) {
          status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
          erledigt()
        } else {
          status(meldung, 'fail', txt(T.nochNicht), fehler.map(f => '• ' + txt(f.text)).join('\n'))
        }
      }
    })
  }

  /* -------------------------------------------------------------- deploy */
  if (uebung.typ === 'deploy') {
    const halter = el('div')
    koerper.append(halter, meldung)
    baueDeploy(halter, {
      repo: uebung.repo || ctx.daten?.repo,
      start: uebung.startEingaben,
      soll: uebung.soll,
      beiErgebnis: (eingaben, r) => {
        if (uebung.soll && deployErfuellt(eingaben, r, uebung.soll)) {
          status(meldung, 'ok', txt(T.richtig), uebung.rueckmeldung ? txt(uebung.rueckmeldung) : null)
          erledigt()
        } else if (!r.erfolg) {
          status(meldung, 'fail', txt(T.deployFehl), r.grund && DEPLOY_HINWEISE[r.grund] ? txt(DEPLOY_HINWEISE[r.grund]) : null)
        } else if (r.grund) {
          status(meldung, 'fail', txt(T.deployWarn), DEPLOY_HINWEISE[r.grund] ? txt(DEPLOY_HINWEISE[r.grund]) : null)
        } else {
          status(meldung, 'fail', txt(T.deployNichtSoll))
        }
      }
    })
  }

  return box
}

/* ========================================================= Seitenbausteine */

/** Setzt den Seitentitel bei Sprachwechsel um. */
function initTitel () {
  const en = document.querySelector('meta[name="winf:titel-en"]')?.content
  const de = document.title
  if (!en) return
  const setze = () => { document.title = aktuelleSprache() === 'en' ? en : de }
  setze()
  document.addEventListener('winf:sprache', setze)
}

/** Einordnung im Lab-Kopf: Voraussetzung, Umfang, Zeit, Kompetenzziel. */
function baueEinordnung (labId) {
  const ziel = document.querySelector('[data-einordnung]')
  if (!ziel) return
  const l = labVon(labId)
  if (!l) return
  const dl = el('dl', 'lab-einordnung')
  const paar = (schluessel, wert) => {
    dl.append(zwei(el('dt'), schluessel))
    dl.append(zwei(el('dd'), wert))
  }
  paar(T.voraussetzung, l.voraussetzung || T.keine)
  paar(T.umfang, { de: `${l.uebungen} Übungen`, en: `${l.uebungen} exercises` })
  paar(T.zeitrahmen, l.zeit)
  paar(T.ziel, l.ziel)
  ziel.replaceChildren(dl)
}

/** Hebt den Abschnitt hervor, der gerade gelesen wird. */
function initSeitennavigation () {
  const links = [...document.querySelectorAll('.sidebar-link[href^="#"]')]
  if (!links.length) return
  const abschnitte = links
    .map(a => ({ a, el: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter(x => x.el)
  const beob = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue
      for (const x of abschnitte) x.a.classList.toggle('active', x.el === e.target)
    }
  }, { rootMargin: '-76px 0px -70% 0px' })
  for (const x of abschnitte) beob.observe(x.el)
}

/** Vor- und Zurueck-Navigation am Fuss der Lab-Seiten. */
function baueLabNavigation (labId) {
  const ziel = document.querySelector('[data-lab-nav]')
  if (!ziel) return
  const i = LABS.findIndex(l => l.id === labId)
  const zeile = el('div', 'nav-bottom')
  const machen = (l, richtung) => {
    const a = el('a', 'btn')
    a.href = l.datei
    a.setAttribute('data-lab-link', '')
    zwei(a, {
      de: `${richtung === 'vor' ? '→ Weiter mit' : '← Zurück zu'} Lab ${l.nr}: ${l.titel.de}`,
      en: `${richtung === 'vor' ? '→ Continue with' : '← Back to'} lab ${l.nr}: ${l.titel.en}`
    })
    return a
  }
  if (i > 0) zeile.append(machen(LABS[i - 1], 'zurueck')); else zeile.append(el('span'))
  if (i < LABS.length - 1) zeile.append(machen(LABS[i + 1], 'vor')); else zeile.append(el('span'))
  ziel.replaceChildren(zeile)
  if (aktuelleSprache() === 'en') {
    ziel.querySelectorAll('a[data-lab-link]').forEach(a => { a.href = a.getAttribute('href').split('?')[0] + '?lang=en' })
  }
}

/** Fortschrittskarte: auf der Startseite ueber alle Labs, im Lab ueber eines. */
function karteFortschritt (nurLab = null) {
  const ziel = document.querySelector('[data-fortschritt]')
  if (!ziel) return
  const zeichne = () => {
    const labs = nurLab ? LABS.filter(l => l.id === nurLab) : LABS
    const geloest = labs.reduce((s, l) => s + Math.min(Object.keys(ladeFortschritt(l.id)).length, l.uebungen), 0)
    const gesamt = labs.reduce((s, l) => s + l.uebungen, 0)

    const karte = el('div', 'fortschritt')
    const kopf = el('div', 'fortschritt-kopf')
    kopf.append(zwei(el('span', 'titel'), T.stand))
    kopf.append(el('span', 'zahl', `${geloest} / ${gesamt} ${txt(T.geloest)}`))
    karte.append(kopf)

    const balken = el('div', 'balken')
    const fuellung = el('i')
    fuellung.style.width = gesamt ? `${Math.round(geloest / gesamt * 100)}%` : '0%'
    balken.append(fuellung)
    balken.setAttribute('role', 'progressbar')
    balken.setAttribute('aria-valuenow', String(geloest))
    balken.setAttribute('aria-valuemin', '0')
    balken.setAttribute('aria-valuemax', String(gesamt))
    karte.append(balken)

    if (!nurLab) {
      const ul = el('ul', 'fortschritt-liste')
      for (const l of LABS) {
        const n = Math.min(Object.keys(ladeFortschritt(l.id)).length, l.uebungen)
        const li = el('li', n === l.uebungen ? 'voll' : null)
        li.append(el('span', 'nr', l.nr))
        const a = el('a', 'name')
        a.href = l.datei
        a.setAttribute('data-lab-link', '')
        zwei(a, l.titel)
        li.append(a)
        li.append(el('span', 'stand', `${n} / ${l.uebungen}`))
        ul.append(li)
      }
      karte.append(ul)

      const akt = el('div', 'uebung-aktionen')
      const btn = zwei(el('button', 'btn-sm gefahr'), T.loeschen)
      btn.type = 'button'
      btn.disabled = geloest === 0
      const echo = el('span', 'hinweis-klein')
      akt.append(btn, echo)
      btn.addEventListener('click', () => {
        if (!confirm(txt(T.loeschenFrage))) return
        loescheFortschritt()
        echo.textContent = txt(T.geloescht)
      })
      karte.append(akt)
    } else if (geloest === gesamt && gesamt) {
      karte.append(el('p', 'hinweis-klein', txt(T.allesGeloest)))
    }

    ziel.replaceChildren(karte)
    if (aktuelleSprache() === 'en') {
      ziel.querySelectorAll('a[data-lab-link]').forEach(a => { a.href = a.getAttribute('href').split('?')[0] + '?lang=en' })
    }
  }
  zeichne()
  document.addEventListener('winf:fortschritt', zeichne)
  document.addEventListener('winf:sprache', zeichne)
}

/* ================================================================= Einstieg */

async function starteLab (labId) {
  const antwort = await fetch(url(`data/uebungen/${labId}.json`))
  if (!antwort.ok) throw new Error(`data/uebungen/${labId}.json: ${antwort.status}`)
  const daten = await antwort.json()

  // Befehlskarten
  for (const halter of document.querySelectorAll('[data-befehl]')) {
    const def = daten.befehle?.[halter.dataset.befehl]
    if (def) baueBefehl(halter, def)
    else halter.append(el('p', 'hinweis-klein', `Befehlskarte ${halter.dataset.befehl} fehlt.`))
  }

  // Freie Konsolen
  for (const halter of document.querySelectorAll('[data-terminal]')) {
    const schluessel = halter.dataset.terminal
    const def = schluessel ? daten.konsolen?.[schluessel] : null
    baueTerminal(halter, {
      os: halter.dataset.os || null,
      begruessung: def?.begruessung || [{
        de: 'Freie Konsole. Nichts hier richtet Schaden an – probieren Sie ruhig aus, was ein Befehl tut.',
        en: 'Free console. Nothing here does any damage – go ahead and try what a command does.'
      }]
    })
  }

  // Datenbankband, falls die Seite SQL enthaelt. Der Attributwert waehlt die
  // Maschine: data-datenbank="sqlite" oder (Standard) "postgres".
  const dbHalter = document.querySelector('[data-datenbank]')
  if (dbHalter) {
    seitenMaschine = dbHalter.dataset.datenbank === 'sqlite' ? 'sqlite' : 'postgres'
    baueDbBand(dbHalter, seitenMaschine)
  }

  // Freie SQL-Konsole: dieselbe Bauform, aber ohne Pruefknopf und ohne
  // Fortschrittseintrag - hier gibt es keine richtige Antwort.
  for (const halter of document.querySelectorAll('[data-sql-konsole]')) {
    const box = baueBox({
      id: 'frei', typ: 'sql',
      titel: { de: 'Freie Abfrage', en: 'Free query' },
      aufgabe: {
        de: '<p>Schreiben Sie eine beliebige Abfrage gegen die Beispieldatenbank. Nichts hier wirkt über diesen Browser hinaus.</p>',
        en: '<p>Write any query against the sample database. Nothing here has any effect beyond this browser.</p>'
      },
      start: halter.dataset.start || 'SELECT * FROM station ORDER BY station_id;',
      engine: halter.dataset.engine || null
    }, { lab: labId, fortschritt: {} })
    box.querySelector('.uebung-kopf').remove()
    box.querySelectorAll('.btn-sm.primary').forEach(b => b.remove())
    box.className = 'sql-konsole'
    halter.replaceChildren(box)
  }

  // Freie JSON-Werkbank: pruefen und formatieren, ohne Auftrag.
  for (const halter of document.querySelectorAll('[data-json-konsole]')) {
    const box = baueBox({
      id: 'frei', typ: 'json',
      titel: { de: 'JSON-Werkbank', en: 'JSON workbench' },
      aufgabe: {
        de: '<p>Fügen Sie beliebiges JSON ein. „Prüfen“ sagt, ob es gültig ist, „Formatieren“ rückt es ein. Nichts verlässt den Browser.</p>',
        en: '<p>Paste any JSON. “Check” tells you whether it is valid, “Format” indents it. Nothing leaves the browser.</p>'
      },
      start: halter.dataset.start || '{ "station": "Hauptbahnhof", "plaetze": 24 }'
    }, { lab: labId, fortschritt: {} })
    box.querySelector('.uebung-kopf').remove()
    box.className = 'sql-konsole'
    halter.replaceChildren(box)
  }

  // Freie Spielplaetze fuer Regal und Deploy (ohne Auftrag, ohne Fortschritt).
  for (const halter of document.querySelectorAll('[data-regal]')) {
    const def = daten.spielplaetze?.[halter.dataset.regal] || {}
    baueRegal(halter, {
      variante: def.variante || halter.dataset.variante || 'tableau',
      felder: def.felder || daten.regal?.felder,
      datenQuelle: def.daten || daten.regal?.daten,
      start: def.startBelegung
    })
  }
  for (const halter of document.querySelectorAll('[data-deploy]')) {
    const def = daten.spielplaetze?.[halter.dataset.deploy] || {}
    const meldung = el('div', 'uebung-status')
    baueDeploy(halter, {
      repo: def.repo || daten.repo,
      start: def.startEingaben,
      beiErgebnis: (e, r) => {
        if (r.erfolg && !r.grund) status(meldung, 'ok', txt(T.deployOk))
        else if (r.erfolg) status(meldung, 'note', txt(T.deployWarn), DEPLOY_HINWEISE[r.grund] ? txt(DEPLOY_HINWEISE[r.grund]) : null)
        else status(meldung, 'fail', txt(T.deployFehl), DEPLOY_HINWEISE[r.grund] ? txt(DEPLOY_HINWEISE[r.grund]) : null)
      }
    })
    halter.append(meldung)
  }

  // Uebungen
  const fortschritt = ladeFortschritt(labId)
  const ctx = { lab: labId, fortschritt, daten, maschine: seitenMaschine }
  for (const halter of document.querySelectorAll('[data-uebung]')) {
    const u = (daten.uebungen || []).find(x => x.id === halter.dataset.uebung)
    if (!u) { halter.append(el('p', 'hinweis-klein', `Übung ${halter.dataset.uebung} fehlt.`)); continue }
    halter.replaceChildren(baueBox(u, ctx))
  }

  baueEinordnung(labId)
  baueLabNavigation(labId)
  karteFortschritt(labId)
}

function start () {
  initSprache()
  initOs()
  initTitel()
  initSeitennavigation()

  const labId = document.body.dataset.lab
  if (labId) {
    starteLab(labId).catch(e => {
      console.error(e)
      for (const h of document.querySelectorAll('[data-uebung], [data-befehl]')) {
        h.append(el('p', 'hinweis-klein', 'Die Übungsdaten konnten nicht geladen werden: ' + e.message))
      }
    })
  } else {
    karteFortschritt(null)
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
else start()
