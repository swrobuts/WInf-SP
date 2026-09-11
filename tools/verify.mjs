/**
 * WInf-SP-Lab · Abnahmelauf
 *
 * Prueft ohne Browser, was sich ohne Browser pruefen laesst:
 *
 *   1. Struktur  - Platzhalter und JSON deckungsgleich, Zweisprachigkeit,
 *                  Antwortindizes im Bereich, Zuordnungsziele vorhanden;
 *                  JSON-, Reihenfolge-, Regal- und Deploy-Uebungen sind mit
 *                  ihrer hinterlegten Loesung loesbar.
 *   2. Loesungen - jede Terminaluebung wird in jedem passenden Dialekt
 *                  durchgespielt. Nach jedem Befehl muss die Zahl der
 *                  erledigten Schritte genau stimmen: zu wenige heisst
 *                  unloesbar, zu viele heisst vorzeitig abgehakt.
 *   3. Befunde   - je gemeldeter Fehler eine Zusicherung, die ohne die
 *                  Korrektur scheitert.
 *
 * Aufruf:  node tools/verify.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { neueWelt, fuehreAus } from '../assets/terminal.js'
import { zustandTrifft, schrittErfuellt } from '../assets/pruefung.js'
import { pruefeJson } from '../assets/jsonpruefung.js'
import { abweichungen as regalAbweichungen, ergebnis as regalErgebnis } from '../assets/regal.js'
import { simuliereDeploy, deployErfuellt } from '../assets/deploy.js'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p) => readFileSync(join(WURZEL, p), 'utf8')
const liesJson = (p) => JSON.parse(lies(p))

let fehler = 0
let geprueft = 0
const gut = (bedingung, was, zusatz = '') => {
  geprueft++
  if (bedingung) return true
  fehler++
  console.log(`  FEHL  ${was}${zusatz ? '  — ' + zusatz : ''}`)
  return false
}
const abschnitt = (titel) => console.log('\n' + titel + '\n' + '-'.repeat(titel.length))

/* ========================================================== 1. Struktur */

abschnitt('1. Struktur')

const HTML_ZU_LAB = {}
for (const f of readdirSync(WURZEL).filter(n => /^lab-\d\d-.*\.html$/.test(n))) {
  HTML_ZU_LAB['lab-' + f.slice(4, 6)] = f
}

const labsQuelle = lies('assets/winf.js')
const labBlock = labsQuelle.match(/const LABS = \[[\s\S]*?\n\]/)[0]
const erwartet = Object.fromEntries(
  [...labBlock.matchAll(/id: '(lab-\d\d)'[\s\S]*?uebungen: (\d+)/g)].map(m => [m[1], Number(m[2])]))

const LABS = {}
for (const [lab, htmlDatei] of Object.entries(HTML_ZU_LAB).sort()) {
  const html = lies(htmlDatei)
  const d = liesJson(`data/uebungen/${lab}.json`)
  LABS[lab] = d
  const phU = new Set([...html.matchAll(/data-uebung="([^"]+)"/g)].map(m => m[1]))
  const phB = new Set([...html.matchAll(/data-befehl="([^"]+)"/g)].map(m => m[1]))
  const jsU = new Set(d.uebungen.map(u => u.id))
  const jsB = new Set(Object.keys(d.befehle || {}))
  const gleich = (a, b) => a.size === b.size && [...a].every(x => b.has(x))

  gut(gleich(phU, jsU), `${lab}: Übungsplatzhalter und JSON deckungsgleich`,
    `nur im HTML ${[...phU].filter(x => !jsU.has(x))}, nur im JSON ${[...jsU].filter(x => !phU.has(x))}`)
  gut(gleich(phB, jsB), `${lab}: Befehlskarten deckungsgleich`)
  gut(erwartet[lab] === jsU.size, `${lab}: LABS nennt ${erwartet[lab]}, JSON hat ${jsU.size} Übungen`)

  for (const u of d.uebungen) {
    for (const feld of ['titel', 'aufgabe']) {
      gut(u[feld]?.de && u[feld]?.en, `${u.id}: ${feld} in beiden Sprachen`)
    }
    for (const [i, f] of (u.fragen || []).entries()) {
      gut(f.frage?.de && f.frage?.en, `${u.id} Frage ${i + 1}: zweisprachig`)
      gut(f.optionen.every(o => o.de && o.en), `${u.id} Frage ${i + 1}: Antworten zweisprachig`)
      gut(f.erklaerung?.de && f.erklaerung?.en, `${u.id} Frage ${i + 1}: Erklärung zweisprachig`)
      gut(Math.max(...f.richtig) < f.optionen.length, `${u.id} Frage ${i + 1}: Antwortindex im Bereich`)
      gut(f.richtig.length === 1 || f.mehrfach === true,
        `${u.id} Frage ${i + 1}: Mehrfachauswahl ist als solche gekennzeichnet`)
    }
    const ziele = new Set((u.ziele || []).map(z => z.id))
    for (const p of u.paare || []) gut(ziele.has(p.ziel), `${u.id}: Zuordnungsziel ${p.ziel} existiert`)
    gut(['quiz', 'zuordnen', 'checkliste', 'terminal', 'sql', 'json', 'reihenfolge', 'regal', 'deploy'].includes(u.typ),
      `${u.id}: Typ ${u.typ} ist bekannt`)
    if (u.typ === 'sql') {
      gut(!!u.loesung, `${u.id}: SQL-Übung hat eine Musterlösung`)
      gut(!u.engine || ['sqlite', 'postgres'].includes(u.engine), `${u.id}: engine ist sqlite oder postgres`)
    }
    if (u.typ === 'json') {
      gut(!!u.loesung, `${u.id}: JSON-Übung hat eine Musterlösung`)
      const r = u.loesung ? pruefeJson(u.loesung, u) : { ok: false, meldung: 'keine Lösung' }
      gut(r.ok, `${u.id}: Musterlösung besteht die eigene Prüfung`, r.meldung || (r.befunde || []).map(b => b.pfad + ': ' + b.text.de).join('; '))
      if (u.start) {
        const s = pruefeJson(u.start, u)
        gut(!s.ok, `${u.id}: der Starttext ist noch nicht die Lösung`)
      }
      gut(u.erwartet !== undefined || (u.regeln || []).length > 0, `${u.id}: hat erwartet oder regeln`)
    }
    if (u.typ === 'reihenfolge') {
      const ids = new Set((u.eintraege || []).map(e => e.id))
      gut(ids.size === (u.eintraege || []).length && ids.size >= 3, `${u.id}: Einträge mit eindeutigen Kennungen`)
      gut((u.richtig || []).length === ids.size && u.richtig.every(x => ids.has(x)), `${u.id}: richtig nennt jede Kennung genau einmal`)
      const start = u.start || [...(u.eintraege || [])].map(e => e.id).reverse()
      gut(start.length === ids.size && start.every(x => ids.has(x)), `${u.id}: Startreihenfolge ist vollständig`)
      gut(JSON.stringify(start) !== JSON.stringify(u.richtig), `${u.id}: Startreihenfolge ist nicht schon die Lösung`)
      gut((u.eintraege || []).every(e => e.text?.de && e.text?.en), `${u.id}: Einträge zweisprachig`)
    }
    if (u.typ === 'regal') {
      const felder = u.felder || d.regal?.felder || []
      gut(felder.length > 0, `${u.id}: Felder vorhanden`)
      gut(felder.every(f => f.id && f.titel?.de && f.titel?.en && ['dimension', 'kennzahl'].includes(f.typ)), `${u.id}: Felder vollständig (id, titel de/en, typ)`)
      const ids = new Set(felder.map(f => f.id))
      const genannt = [...(u.ziel?.spalten || []), ...(u.ziel?.zeilen || [])].map(s => s.includes(':') ? s.split(':')[1] : s)
      if (u.ziel?.farbe) genannt.push(u.ziel.farbe)
      for (const f of Object.keys(u.ziel?.filter || {})) genannt.push(f)
      gut(genannt.every(f => ids.has(f)), `${u.id}: Ziel nennt nur bekannte Felder`, genannt.filter(f => !ids.has(f)).join(', '))
      gut(!!u.loesungBelegung, `${u.id}: Regal-Übung hat eine loesungBelegung`)
      if (u.loesungBelegung) {
        const abw = regalAbweichungen(u.loesungBelegung, u.ziel || {})
        gut(abw.length === 0, `${u.id}: loesungBelegung erfüllt das Ziel`, abw.map(a => a.text.de).join('; '))
        const leer = regalAbweichungen({ spalten: [], zeilen: [], farbe: null, filter: {} }, u.ziel || {})
        gut(leer.length > 0, `${u.id}: die leere Belegung erfüllt das Ziel nicht`)
        const daten = liesJson(u.daten || d.regal?.daten || 'data/regal-fahrten.json')
        const erg = regalErgebnis(daten, felder, u.loesungBelegung)
        gut(erg.zeilen.length > 0, `${u.id}: die Lösung liefert Zeilen auf den Daten`)
      }
    }
    if (u.typ === 'deploy') {
      const repo = u.repo || d.repo
      gut(!!repo && Object.keys(repo.dateien || {}).length > 0, `${u.id}: Repository mit Dateien vorhanden`)
      gut(!!u.soll, `${u.id}: Deploy-Übung hat ein soll`)
      for (const k of ['build', 'start']) {
        if (u.soll?.[k]) { let ok = true; try { new RegExp(u.soll[k]) } catch { ok = false } gut(ok, `${u.id}: soll.${k} ist ein gültiger Ausdruck`) }
      }
      gut(!!u.loesungEingaben, `${u.id}: Deploy-Übung hat loesungEingaben`)
      if (u.loesungEingaben && repo) {
        const r = simuliereDeploy(u.loesungEingaben, repo)
        gut(r.erfolg && deployErfuellt(u.loesungEingaben, r, u.soll || {}), `${u.id}: loesungEingaben führen zum Erfolg`, r.zeilen.slice(-3).map(z => z.text).join(' | '))
        if (u.startEingaben) {
          const s = simuliereDeploy(u.startEingaben, repo)
          gut(!(s.erfolg && deployErfuellt(u.startEingaben, s, u.soll || {})), `${u.id}: die Starteingaben sind noch nicht die Lösung`)
        }
      }
    }
    for (const [i, s] of (u.schritte || []).entries()) {
      if (u.typ !== 'terminal') continue
      gut(!!(s.muster || s.zustand), `${u.id} Schritt ${i + 1}: hat Muster oder Zustand`)
      if (s.muster) {
        let ok = true
        try { new RegExp(s.muster, 'i') } catch { ok = false }
        gut(ok, `${u.id} Schritt ${i + 1}: Muster ist ein gültiger Ausdruck`)
      }
    }
  }
  for (const [id, b] of Object.entries(d.befehle || {})) {
    gut(b.titel?.de && b.titel?.en, `${lab}/${id}: Titel zweisprachig`)
    gut(!!(b.befehl || b.varianten), `${lab}/${id}: hat einen Befehl`)
    const teile = b.teile || Object.values(b.varianten || {}).flatMap(v => v.teile || [])
    gut(teile.every(t => t.bedeutet?.de && t.bedeutet?.en), `${lab}/${id}: Erläuterungen zweisprachig`)
  }
}

// Jede in einer Seite verlinkte Kopiervorlage muss existieren; Kopf und Nummern muessen stimmen.
for (const [lab, htmlDatei] of Object.entries(HTML_ZU_LAB)) {
  const html = lies(htmlDatei)
  for (const m of html.matchAll(/href="((?:vorlagen|data)\/[^"]+)"/g)) {
    gut(existsSync(join(WURZEL, m[1])), `${lab}: verlinkte Datei ${m[1]} existiert`)
  }
  gut(!/PITM-Lab|pitm\.css|pitm\.js|pitm:/.test(html), `${lab}: keine PITM-Reste`)
  gut(new RegExp(`data-lab="${lab}"`).test(html), `${lab}: data-lab stimmt`)
  gut(new RegExp(`lab-num-big">${lab.slice(4)}<`).test(html), `${lab}: die große Lab-Nummer im Kopf stimmt`)
  gut(!/\blab 0[89]X|Lab 0[89]X/.test(html), `${lab}: keine offenen Umnummerierungen (08X/09X)`)
  gut(/<div data-einordnung><\/div>/.test(html) && /data-lab-nav/.test(html) && /data-fortschritt/.test(html),
    `${lab}: Einordnung, Fortschritt und Navigation vorhanden`)
  // Jeder Sidebar-Link zeigt auf einen vorhandenen Abschnitt.
  for (const m of html.matchAll(/class="sidebar-link" href="#([^"]+)"/g)) {
    gut(new RegExp(`id="${m[1]}"`).test(html), `${lab}: Abschnitt #${m[1]} existiert`)
  }
}

// Kein eingedeutschtes "Schale" mehr, weder im Text noch im Quellcode.
for (const f of [...Object.values(HTML_ZU_LAB), 'index.html', 'README.md',
  'assets/winf.js', 'assets/terminal.js', 'assets/pruefung.js', 'assets/winf.css']) {
  gut(!/schale/i.test(lies(f)), `${f}: spricht von Shell, nicht von „Schale“`)
}

// Das hidden-Attribut muss jede Komponentenregel überstimmen.
const css = lies('assets/winf.css')
gut(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css),
  'winf.css: [hidden] überstimmt eigene display-Regeln (Erledigt-Abzeichen)')
gut(css.indexOf('[hidden]') < css.indexOf('.badge {'),
  'winf.css: die hidden-Regel steht vor den Komponenten')

// Was das README als Klassen beschreibt, muss auch verwendet werden.
const alleSeiten = [...Object.values(HTML_ZU_LAB), 'index.html'].map(lies).join('\n')
for (const kl of ['nur-win', 'nur-mac', 'nur-cmd', 'nur-unix', 'nur-windows']) {
  const inCss = css.includes(kl)
  gut(!inCss || alleSeiten.includes(kl), `Klasse ${kl}: im CSS beschrieben und in einer Seite verwendet`)
}
// Was die Laufzeit als Hinweisschluessel liefert, muss uebersetzt sein.
{
  const terminal = lies('assets/terminal.js')
  const laufzeit = lies('assets/winf.js')
  const geliefert = new Set([...terminal.matchAll(/hinweis:\s*'([a-zA-Z]+)'/g)].map(m => m[1]))
  const tabelle = laufzeit.slice(laufzeit.indexOf('TERMINAL_HINWEISE'), laufzeit.indexOf('const LABS'))
  for (const k of geliefert) {
    gut(new RegExp(`\\b${k}:`).test(tabelle), `Hinweis "${k}" ist in beiden Sprachen hinterlegt`)
  }
}
gut(!/cd PITM\b(?!-Lab)/.test(lies('README.md')), 'README: der Ordnername stimmt (WInf-SP-Lab)')

/* ========================================================= 2. Loesungen */

abschnitt('2. Lösungswege je Dialekt')

/**
 * Je Uebung und Dialekt eine Folge `[Befehl, erledigte Schritte danach]`.
 * Die Zahl ist der eigentliche Test: Sie faellt auf, wenn ein Schritt zu
 * frueh abgehakt oder gar nicht erkannt wird.
 */
const LOESUNGEN = {
  'W01-01': {
    mac: [['pwd', 1], ['ls', 2], ['cd velocity/analytics', 3], ['ls', 4], ['cd ~', 5]],
    win: [['Get-Location', 1], ['Get-ChildItem', 2], ['Set-Location velocity\\analytics', 3],
      ['dir', 4], ['cd C:\\Users\\studi', 5]],
    cmd: [['cd', 1], ['dir', 2], ['cd velocity\\analytics', 3], ['dir', 4], ['cd %USERPROFILE%', 5]]
  },
  'W01-02': {
    mac: [['mkdir projekt', 1], ['mkdir projekt/daten', 2], ['touch projekt/notizen.md', 3],
      ['cd projekt', 3], ['ls', 4]],
    win: [['New-Item -ItemType Directory projekt', 1], ['New-Item -ItemType Directory projekt\\daten', 2],
      ['New-Item -ItemType File projekt\\notizen.md', 3], ['cd projekt', 3], ['Get-ChildItem', 4]],
    cmd: [['md projekt', 1], ['md projekt\\daten', 2], ['type nul > projekt\\notizen.md', 3],
      ['cd projekt', 3], ['dir', 4]]
  },
  'W01-03': {
    mac: [['head -n 5 Downloads/fahrten_2026.csv', 1], ['mkdir -p projekt/daten', 2],
      ['cp Downloads/fahrten_2026.csv projekt/daten/', 3], ['ls Downloads', 4]],
    win: [['Get-Content Downloads\\fahrten_2026.csv -TotalCount 5', 1],
      ['New-Item -ItemType Directory -Force projekt\\daten', 2],
      ['Copy-Item Downloads\\fahrten_2026.csv projekt\\daten', 3], ['Get-ChildItem Downloads', 4]],
    cmd: [['type Downloads\\fahrten_2026.csv', 1], ['md projekt\\daten', 2],
      ['copy Downloads\\fahrten_2026.csv projekt\\daten', 3], ['dir Downloads', 4]]
  },
  'W01-06': {
    mac: [['mv Dokumente/notizen.txt Dokumente/termine.txt', 1], ['touch test.tmp', 2], ['ls', 3],
      ['rm test.tmp', 4], ['ls Dokumente', 5]],
    win: [['Rename-Item Dokumente\\notizen.txt termine.txt', 1], ['New-Item -ItemType File test.tmp', 2],
      ['Get-ChildItem', 3], ['Remove-Item test.tmp', 4], ['Get-ChildItem Dokumente', 5]],
    cmd: [['ren Dokumente\\notizen.txt termine.txt', 1], ['type nul > test.tmp', 2], ['dir', 3],
      ['del test.tmp', 4], ['dir Dokumente', 5]]
  },
  'W02-01': {
    mac: [['git status', 1], ['git clone https://github.com/studi/velocity-analyse.git', 2],
      ['cd velocity-analyse', 3], ['ls -a', 4], ['cat .gitignore', 5], ['git log --oneline', 6]],
    win: [['git status', 1], ['git clone https://github.com/studi/velocity-analyse.git', 2],
      ['cd velocity-analyse', 3], ['Get-ChildItem -Force', 4], ['Get-Content .gitignore', 5],
      ['git log --oneline', 6]],
    cmd: [['git status', 1], ['git clone https://github.com/studi/velocity-analyse.git', 2],
      ['cd velocity-analyse', 3], ['dir /a', 4], ['type .gitignore', 5], ['git log --oneline', 6]]
  },
  'W02-02': {
    mac: [['git clone https://github.com/studi/velocity-analyse.git', 0], ['cd velocity-analyse', 1],
      ['touch auswertung.py', 2], ['git status', 3], ['git add auswertung.py', 4],
      ['git commit -m "Auswertung ergänzt"', 5], ['git log', 6], ['git push', 7]],
    cmd: [['git clone https://github.com/studi/velocity-analyse.git', 0], ['cd velocity-analyse', 1],
      ['type nul > auswertung.py', 2], ['git status', 3], ['git add auswertung.py', 4],
      ['git commit -m "Auswertung ergänzt"', 5], ['git log', 6], ['git push', 7]]
  },
  'W02-03': {
    mac: [['git clone https://github.com/studi/velocity-analyse.git', 1], ['cd velocity-analyse', 1],
      ['git switch -c experiment', 2], ['touch notiz.txt', 2], ['git add .', 2],
      ['git commit -m "Notiz auf dem Zweig"', 3], ['git branch', 4], ['git switch main', 5],
      ['git log --oneline', 6], ['git merge experiment', 7]]
  },
  'W07-01': {
    mac: [['docker run --rm hello-world', 1], ['docker ps', 2], ['docker images', 3],
      ['docker run -d --name still nginx:1.27', 4],
      ['docker run -d --name web -p 8080:80 nginx:1.27', 5], ['docker ps', 6]]
  },
  'W07-02': {
    mac: [['docker volume create pgdata', 1],
      ['docker run -d --name pg -e POSTGRES_PASSWORD=geheim -p 127.0.0.1:5432:5432 -v pgdata:/var/lib/postgresql/data postgres:16', 2],
      ['docker logs pg', 3],
      ['docker run -d --name pg2 -p 127.0.0.1:5432:5432 postgres:16', 4],
      ['docker run -d --name pg2 -p 127.0.0.1:15432:5432 postgres:16', 5],
      ['docker ps', 6]]
  },
  'W07-03': {
    mac: [['docker run -d --name pg -v pgdata:/var/lib/postgresql/data postgres:16', 1],
      ['docker rm pg', 2], ['docker stop pg', 2], ['docker rm pg', 3], ['docker volume ls', 4],
      ['docker run -d --name pg -v pgdata:/var/lib/postgresql/data postgres:16', 5],
      ['docker run -d --name fluechtig postgres:16', 6], ['docker system df', 7]]
  },
  'W07-04': {
    mac: [['docker compose up -d', 1], ['touch compose.yaml', 2], ['docker compose up -d', 3],
      ['docker compose ps', 4], ['docker compose down', 4], ['docker volume ls', 5],
      ['docker compose up -d', 6], ['docker compose down -v', 7]],
    win: [['docker compose up -d', 1], ['New-Item -ItemType File compose.yaml', 2],
      ['docker compose up -d', 3], ['docker compose ps', 4], ['docker compose down', 4],
      ['docker volume ls', 5], ['docker compose up -d', 6], ['docker compose down -v', 7]],
    cmd: [['docker compose up -d', 1], ['type nul > compose.yaml', 2], ['docker compose up -d', 3],
      ['docker compose ps', 4], ['docker compose down', 4], ['docker volume ls', 5],
      ['docker compose up -d', 6], ['docker compose down -v', 7]]
  },
}

const alleUebungen = Object.values(LABS).flatMap(d => d.uebungen)
const terminalUebungen = alleUebungen.filter(u => u.typ === 'terminal')

for (const u of terminalUebungen) {
  const wege = LOESUNGEN[u.id]
  if (!gut(!!wege, `${u.id}: ein Lösungsweg ist hinterlegt`)) continue
  for (const [os, folge] of Object.entries(wege)) {
    const welt = neueWelt(os)
    const schritte = u.schritte.map(s => ({ ...s, fertig: false }))
    let stolper = null
    for (const [befehl, soll] of folge) {
      const offen = schritte.find(s => !s.fertig)
      const vorher = offen ? zustandTrifft(welt, offen.zustand) : false
      fuehreAus(welt, befehl)
      if (offen && schrittErfuellt(welt, offen, befehl, vorher)) offen.fertig = true
      const ist = schritte.filter(s => s.fertig).length
      if (ist !== soll && !stolper) stolper = `nach "${befehl}": ${ist} statt ${soll} Schritte`
    }
    gut(!stolper && schritte.every(s => s.fertig),
      `${u.id} · ${os}: alle ${schritte.length} Schritte in der richtigen Reihenfolge`,
      stolper || 'offen: ' + schritte.map((s, i) => s.fertig ? '' : i + 1).filter(Boolean).join(', '))
  }
}

/* =========================================================== 3. Befunde */

abschnitt('3. Gemeldete Befunde')

/** Fuehrt eine Folge von Befehlen aus und liefert Welt plus letzte Ausgabe. */
const lauf = (os, ...befehle) => {
  const w = neueWelt(os)
  let r = null
  for (const b of befehle) r = fuehreAus(w, b)
  return { w, r, text: (r?.zeilen || []).map(z => z.text).join('\n'), art: r }
}
const hatDatei = (w, pfad) => {
  let k = w.wurzel
  for (const t of pfad.split('/')) { if (!k || k.typ !== 'ordner' || !k.kinder[t]) return null; k = k.kinder[t] }
  return k
}
const istFehler = (r) => (r?.zeilen || []).some(z => z.art === 'fehler')

// Befund 3: leere Datei in cmd, auf allen drei Wegen.
for (const b of ['type nul > x.txt', 'echo. > x.txt', 'copy nul x.txt']) {
  const { w, r } = lauf('cmd', b)
  gut(!!hatDatei(w, 'x.txt') && !istFehler(r), `cmd: "${b}" legt eine Datei an`)
}
gut(!istFehler(lauf('cmd', 'type nul').r), 'cmd: "type nul" ist kein Fehler')
{
  const { w } = lauf('cmd', 'echo Kickoff > notiz.txt', 'echo Zwischenstand >> notiz.txt')
  gut(hatDatei(w, 'notiz.txt')?.inhalt === 'Kickoff\nZwischenstand\n', 'cmd: > und >> schreiben und hängen an')
}

// Befund 4: md legt Zwischenordner an, meldet aber Bestehendes.
{
  const { w, r } = lauf('cmd', 'md projekt\\daten\\rohdaten')
  gut(hatDatei(w, 'projekt/daten/rohdaten')?.typ === 'ordner' && !istFehler(r),
    'cmd: md legt Zwischenordner an')
  gut(istFehler(lauf('cmd', 'md projekt', 'md projekt').r), 'cmd: md meldet einen bestehenden Ordner')
}

// Befund 5: umbenennen benennt um, es verschiebt nicht.
for (const [os, befehl] of [['win', 'Rename-Item Dokumente\\notizen.txt termine.txt'],
  ['cmd', 'ren Dokumente\\notizen.txt termine.txt']]) {
  const { w, r } = lauf(os, befehl)
  gut(!!hatDatei(w, 'Dokumente/termine.txt') && !hatDatei(w, 'termine.txt') && !istFehler(r),
    `${os}: "${befehl.split(' ')[0]}" benennt im Ordner um, statt in die Heimat zu verschieben`)
}
gut(istFehler(lauf('win', 'Rename-Item Dokumente\\notizen.txt Downloads\\termine.txt').r),
  'win: Rename-Item weist einen Pfad als neuen Namen ab')
gut(istFehler(lauf('cmd', 'ren Dokumente\\notizen.txt Downloads\\termine.txt').r),
  'cmd: ren weist einen Pfad als neuen Namen ab')
// Verschieben bleibt Verschieben.
{
  const { w } = lauf('cmd', 'move Dokumente\\notizen.txt Downloads\\termine.txt')
  gut(!!hatDatei(w, 'Downloads/termine.txt'), 'cmd: move verschiebt weiterhin')
}

// Befund 6: Port mit Bindungsadresse gilt als dieselbe Abbildung.
{
  const { w } = lauf('mac', 'docker run -d --name pg -p 127.0.0.1:5432:5432 postgres:16')
  gut(zustandTrifft(w, { portGebunden: '5432:5432' }),
    'docker: -p 127.0.0.1:5432:5432 erfüllt die Prüfung auf 5432:5432')
  gut(/127\.0\.0\.1:5432->5432\/tcp/.test(lauf('mac',
    'docker run -d --name pg -p 127.0.0.1:5432:5432 postgres:16', 'docker ps').text),
  'docker ps: zeigt die Bindungsadresse in der PORTS-Spalte')
}

// Mittlere Befunde: absolute Heimatpfade.
gut(lauf('cmd', 'cd C:\\Users\\studi\\Downloads').w.pfad.join('/') === 'Downloads',
  'cmd: absoluter Heimatpfad wird aufgelöst')
gut(lauf('cmd', 'cd /d C:\\Users\\studi\\Downloads').w.pfad.join('/') === 'Downloads',
  'cmd: cd /d wird verstanden')
gut(lauf('win', 'Set-Location C:\\Users\\studi\\Dokumente').w.pfad.join('/') === 'Dokumente',
  'win: absoluter Heimatpfad wird aufgelöst')
gut(lauf('mac', 'cd /Users/studi/Downloads').w.pfad.join('/') === 'Downloads',
  'mac: absoluter Heimatpfad wird aufgelöst')
gut(lauf('cmd', 'cd %USERPROFILE%\\Downloads').w.pfad.join('/') === 'Downloads',
  'cmd: %USERPROFILE% wird eingesetzt')
gut(lauf('mac', 'cd $HOME/Downloads').w.pfad.join('/') === 'Downloads',
  'mac: $HOME wird eingesetzt')

// Mittlere Befunde: head/tail/wc/grep.
gut(lauf('mac', 'head -n 2 Downloads/fahrten_2026.csv').text.split('\n').length === 2,
  'mac: head -n 2 liefert zwei Zeilen')
gut(lauf('mac', 'head -1 Downloads/fahrten_2026.csv').text.split('\n').length === 1,
  'mac: head -1 liefert eine Zeile')
gut(lauf('mac', 'tail -n 1 Downloads/fahrten_2026.csv').text.startsWith('2;R-227'),
  'mac: tail -n 1 liefert die letzte Zeile')
gut(/^\s*3\s/.test(lauf('mac', 'wc -l Downloads/fahrten_2026.csv').text),
  'mac: wc -l zählt die Zeilen')
gut(lauf('mac', 'grep Residenz Downloads/fahrten_2026.csv').text.includes('R-227'),
  'mac: grep findet die Zeile')
gut(lauf('mac', 'grep -n Residenz Downloads/fahrten_2026.csv').text.startsWith('3:'),
  'mac: grep -n stellt die Zeilennummer voran')
gut(lauf('cmd', 'find "Residenz" Downloads\\fahrten_2026.csv').text.includes('R-227'),
  'cmd: find durchsucht eine Datei')

// Mittlere Befunde: PowerShell prueft Parameter.
{
  const r = lauf('win', 'ls -la')
  gut(istFehler(r.r) && /parameter name 'la'/.test(r.text),
    'win: "ls -la" wird zurückgewiesen, statt still zu gelingen')
  gut(!istFehler(lauf('win', 'Get-ChildItem -Force').r), 'win: -Force ist gültig')
  gut(!istFehler(lauf('win', 'Get-ChildItem -Rec').r), 'win: Abkürzung -Rec wird aufgelöst')
  const m = lauf('win', 'Remove-Item -f test')
  gut(/ambiguous/.test(m.text), 'win: mehrdeutige Abkürzung -f wird als solche gemeldet')
  gut(lauf('win', 'Get-ChildItem').text.includes('Dokumente') &&
      !lauf('win', 'Get-ChildItem').text.includes('.git'),
  'win: ohne -Force bleiben versteckte Einträge aussen vor')
}

// Mittlere Befunde: Fehlermeldungen im richtigen Dialekt.
gut(/Set-Location: Cannot find path/.test(lauf('win', 'cd nix').text),
  'win: cd auf nichts meldet in PowerShell-Sprache')
gut(/Das System kann den angegebenen Pfad nicht finden/.test(lauf('cmd', 'cd nix').text),
  'cmd: cd auf nichts meldet auf cmd-Deutsch')
gut(/Get-Content: Cannot find path/.test(lauf('win', 'Get-Content nix.txt').text),
  'win: Get-Content meldet in PowerShell-Sprache')
gut(/Remove-Item: The item at/.test(lauf('win', 'Remove-Item Dokumente').text),
  'win: Remove-Item auf einen Ordner verlangt -Recurse')
gut(/no such file or directory/i.test(lauf('mac', 'cd nix').text),
  'mac: zsh bleibt bei seiner Meldung')

// Mittlere Befunde: Docker-Details.
gut(lauf('mac', 'docker run -d --name=web nginx:1.27').w.docker.container[0].name === 'web',
  'docker: --name=web wird verstanden')
{
  const w = neueWelt('mac')
  for (let i = 0; i < 6; i++) fuehreAus(w, `docker run -d --name c${i} nginx:1.27`)
  gut(w.docker.container.every(c => /^[0-9a-f]{12}$/.test(c.id)),
    'docker: Kennungen sind zwölfstellige Hexwerte')
  gut(new Set(w.docker.container.map(c => c.id)).size === 6,
    'docker: Kennungen sind untereinander verschieden')
  // Volle Kennung trifft genau einen Container.
  const voll = w.docker.container[2].id
  gut(!istFehler(fuehreAus(w, `docker logs ${voll}`)), 'docker: die volle Kennung trifft')
  // Ein Praefix, das mehrere Container teilen, muss zurueckgewiesen werden.
  const erstes = voll[0]
  const wieViele = w.docker.container.filter(c => c.id.startsWith(erstes)).length
  const r = fuehreAus(w, `docker logs ${erstes}`)
  gut(wieViele > 1 ? /multiple IDs found/.test((r.zeilen[0] || {}).text || '') : !istFehler(r),
    `docker: Kennungspräfix "${erstes}" (${wieViele} Treffer) wird richtig behandelt`,
    (r.zeilen[0] || {}).text)
  // Und ein Praefix, das niemand hat, ist ein Fehler.
  gut(istFehler(fuehreAus(w, 'docker logs zzzzzz')), 'docker: unbekannte Kennung wird gemeldet')
}
{
  const w = lauf('mac', 'docker run -d --name pg -v pgdata:/var/lib/postgresql/data postgres:16').w
  const r = fuehreAus(w, 'docker volume rm pgdata')
  gut(istFehler(r) && w.docker.volumen.includes('pgdata'),
    'docker: ein eingehängtes Band lässt sich nicht entfernen')
  fuehreAus(w, 'docker rm -f pg')
  gut(!istFehler(fuehreAus(w, 'docker volume rm pgdata')),
    'docker: nach dem Container geht das Band weg')
}
{
  const w = lauf('mac', 'touch compose.yaml', 'docker compose up -d').w
  const bandliste = fuehreAus(w, 'docker volume ls').zeilen.map(z => z.text).join('\n')
  gut(bandliste.includes('projekt_pgdata'),
    'docker compose: Bandname in der Liste stimmt mit der Meldung überein')
}
gut(istFehler(lauf('cmd', 'rd Dokumente').r), 'cmd: rd verweigert einen gefüllten Ordner')
gut(!istFehler(lauf('cmd', 'rd /s /q Dokumente').r), 'cmd: rd /s /q entfernt ihn')
gut(!istFehler(lauf('cmd', 'python --version').r), 'cmd: python ist auch dort bekannt')
gut(lauf('cmd', 'python --version').text === 'Python 3.12.7', 'cmd: python --version antwortet')
for (const [os, befehl] of [['mac', 'open .'], ['win', 'ii .'], ['win', 'explorer .'], ['cmd', 'start .']]) {
  const r = lauf(os, befehl).r
  gut(!istFehler(r) && !!r.hinweis, `${os}: "${befehl}" wird erkannt und erklärt`)
}
gut(lauf('cmd', 'set').text.includes('USERPROFILE='), 'cmd: set zeigt USERPROFILE')

// Befund: git zaehlt Dateien, nicht Ordner - und echte Zeilen.
{
  const w = neueWelt('mac')
  fuehreAus(w, 'git clone https://github.com/studi/velocity-analyse.git')
  fuehreAus(w, 'cd velocity-analyse')
  fuehreAus(w, 'mkdir -p auswertung/teil')
  fuehreAus(w, 'echo eins > auswertung/a.py')
  fuehreAus(w, 'echo zwei > auswertung/teil/b.py')
  const st = fuehreAus(w, 'git status').zeilen.map(z => z.text).join('\n')
  gut(/auswertung\//.test(st), 'git status: ein unbekannter Ordner erscheint mit Schrägstrich')
  fuehreAus(w, 'git add auswertung')
  const c = fuehreAus(w, 'git commit -m "Auswertung"').zeilen.map(z => z.text).join('\n')
  gut(/2 files changed, 2 insertions/.test(c),
    'git commit: zählt die Dateien im Ordner, nicht den Ordner', c)
  fuehreAus(w, 'git switch -c zweig')
  fuehreAus(w, 'echo drei > dritte.py')
  fuehreAus(w, 'git add dritte.py')
  fuehreAus(w, 'git commit -m "Dritte"')
  fuehreAus(w, 'git switch main')
  const m = fuehreAus(w, 'git merge zweig').zeilen.map(z => z.text).join('\n')
  gut(/ dritte\.py \| /.test(m) && /1 file changed, 1 insertion/.test(m),
    'git merge: listet Dateien und zählt echte Zeilen', m)
}

/* ================================================================ Ende */

console.log('\n' + '='.repeat(60))
console.log(fehler
  ? `${fehler} von ${geprueft} Zusicherungen gescheitert.`
  : `Alle ${geprueft} Zusicherungen erfüllt.`)
process.exit(fehler ? 1 : 0)
