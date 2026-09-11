/**
 * WInf-SP-Lab · Deploy-Simulator (Render)
 *
 * Reine Logik ohne DOM. Aus den Eingaben des Formulars "New Web Service"
 * und dem Inhalt eines nachgebildeten Repositories entsteht das Protokoll,
 * das Render beim Bauen und Starten schreiben wuerde - samt der Fehler, an
 * denen Studierende im Kurs am haeufigsten haengen bleiben:
 *
 *   * Build Command verweist auf eine Datei, die im Repository fehlt
 *   * Start Command bindet nicht an 0.0.0.0 oder ignoriert $PORT
 *   * Start Command startet ein Skript, das kein Server ist
 *   * eine Umgebungsvariable, die der Code liest, ist nicht gesetzt
 *
 * Die Zeilen sind dem echten Render-Protokoll nachempfunden ("==> ..."),
 * damit die Meldung draussen wiedererkannt wird. Was Render genau schreibt,
 * aendert sich mit der Zeit; die Kernaussagen (No open ports detected,
 * Exited with status 1, Your service is live) sind seit Jahren stabil.
 */

const RUNTIMES = {
  python: { name: 'Python 3', version: 'Python version 3.14.3 (default)', build: 'pip install -r requirements.txt' },
  node:   { name: 'Node', version: 'Node.js version 24.14.1 (default)', build: 'npm install' },
  docker: { name: 'Docker', version: null, build: null }
}

const zeile = (art, text) => ({ art, text })

/**
 * @param eingaben  { runtime, rootDir, build, start, env: [{name, value}], dienst: 'web'|'worker' }
 * @param repo      { dateien: { 'requirements.txt': '…', 'main.py': '…' }, liest: ['DATABASE_URL'], url }
 * @returns { zeilen: [{art,text}], erfolg, grund }
 *   grund  Schluessel des Fehlers (keineDatei, keinPort, lokalPort, festerPort, keinServer, umgebung, dockerfileFehlt) oder null
 */
export function simuliereDeploy (eingaben, repo) {
  const z = []
  const rt = RUNTIMES[eingaben.runtime] || RUNTIMES.python
  const dateien = repo.dateien || {}
  const root = (eingaben.rootDir || '').replace(/^\/|\/$/g, '')
  const datei = (n) => dateien[root ? `${root}/${n}` : n]
  const url = repo.url || 'https://github.com/studi/velocity-api'
  const name = repo.name || 'velocity-api'

  z.push(zeile('info', `==> Cloning from ${url}`))
  z.push(zeile('info', `==> Checking out commit 3f9a1c2 in branch main`))
  if (root) z.push(zeile('info', `==> Using root directory '${root}'`))

  /* ---------------------------------------------------------- Docker */
  if (eingaben.runtime === 'docker') {
    if (!datei('Dockerfile')) {
      z.push(zeile('fehler', `==> Build failed: failed to read dockerfile: open Dockerfile: no such file or directory`))
      z.push(zeile('fehler', '==> Build failed 😞'))
      return { zeilen: z, erfolg: false, grund: 'dockerfileFehlt' }
    }
    z.push(zeile('info', '==> Building image with Docker…'))
    z.push(zeile('aus', '#1 [internal] load build definition from Dockerfile'))
    z.push(zeile('aus', '#5 FROM docker.io/library/python:3.13-slim'))
    z.push(zeile('aus', '#8 RUN pip install --no-cache-dir -r requirements.txt'))
    z.push(zeile('info', '==> Pushing image to registry…'))
    z.push(zeile('gut', '==> Build successful 🎉'))
  } else {
    /* --------------------------------------------------------- Build */
    z.push(zeile('info', `==> Using ${rt.version}`))
    const build = (eingaben.build || '').trim()
    z.push(zeile('info', `==> Running build command '${build || rt.build}'…`))
    const verlangt = build.match(/-r\s+(\S+)/)?.[1] || (eingaben.runtime === 'python' ? 'requirements.txt' : null)
    if (eingaben.runtime === 'python' && verlangt && !datei(verlangt)) {
      z.push(zeile('fehler', `ERROR: Could not open requirements file: [Errno 2] No such file or directory: '${verlangt}'`))
      z.push(zeile('fehler', '==> Build failed 😞'))
      return { zeilen: z, erfolg: false, grund: 'keineDatei' }
    }
    if (eingaben.runtime === 'node' && !datei('package.json')) {
      z.push(zeile('fehler', 'npm error code ENOENT'))
      z.push(zeile('fehler', 'npm error path /opt/render/project/src/package.json'))
      z.push(zeile('fehler', '==> Build failed 😞'))
      return { zeilen: z, erfolg: false, grund: 'keineDatei' }
    }
    if (eingaben.runtime === 'python') {
      const pakete = (datei(verlangt) || '').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'))
      for (const p of pakete) z.push(zeile('aus', `Collecting ${p}`))
      z.push(zeile('aus', `Successfully installed ${pakete.map(p => p.replace(/[=<>~!].*$/, '')).join(' ')}`))
    } else if (eingaben.runtime === 'node') {
      z.push(zeile('aus', 'added 64 packages, and audited 65 packages in 3s'))
    }
    z.push(zeile('gut', '==> Build successful 🎉'))
  }

  /* --------------------------------------------------------- Start */
  z.push(zeile('info', '==> Deploying…'))
  const start = (eingaben.start || '').trim()
  if (eingaben.runtime !== 'docker') {
    if (!start) {
      z.push(zeile('fehler', '==> Start command is required for web services.'))
      return { zeilen: z, erfolg: false, grund: 'keinStart' }
    }
    z.push(zeile('info', `==> Running '${start}'`))
  } else {
    z.push(zeile('info', `==> Running 'uvicorn main:app --host 0.0.0.0 --port $PORT' (CMD from Dockerfile)`))
  }

  // Umgebungsvariablen, die der Code liest.
  const gesetzt = new Set((eingaben.env || []).filter(e => e.name && e.name.trim()).map(e => e.name.trim()))
  for (const v of repo.liest || []) {
    if (!gesetzt.has(v)) {
      z.push(zeile('aus', 'Traceback (most recent call last):'))
      z.push(zeile('aus', `  File "/opt/render/project/src/main.py", line 7, in <module>`))
      z.push(zeile('aus', `    DATENBANK = os.environ["${v}"]`))
      z.push(zeile('aus', `  File "<frozen os>", line 716, in __getitem__`))
      z.push(zeile('fehler', `KeyError: '${v}'`))
      z.push(zeile('fehler', '==> Exited with status 1'))
      z.push(zeile('fehler', '==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys'))
      return { zeilen: z, erfolg: false, grund: 'umgebung' }
    }
  }

  const befehl = eingaben.runtime === 'docker' ? 'uvicorn main:app --host 0.0.0.0 --port $PORT' : start
  const istServer = /\b(uvicorn|gunicorn|flask\s+run|node\b|npm\s+(start|run)|streamlit\s+run|waitress-serve|hypercorn|fastapi\s+run)\b/.test(befehl)
  const hostLokal = /--host\s+(127\.0\.0\.1|localhost)\b|-h\s+127\.0\.0\.1|--bind\s+127\.0\.0\.1|localhost:\d+/.test(befehl)
  const hostAlle = /--host\s+0\.0\.0\.0\b|--bind\s+0\.0\.0\.0|\b0\.0\.0\.0:|--server\.address\s+0\.0\.0\.0/.test(befehl)
  const portVar = /\$PORT\b|\$\{PORT\}|:\$PORT|process\.env\.PORT/.test(befehl)
  const portFest = /--port\s+(\d+)|-p\s+(\d+)|:(\d{4,5})\b/.exec(befehl)

  if (!istServer && eingaben.dienst !== 'worker') {
    z.push(zeile('aus', 'Fahrten geladen: 1500'))
    z.push(zeile('aus', 'Fertig.'))
    z.push(zeile('fehler', '==> Exited with status 0'))
    z.push(zeile('fehler', '==> Web services must bind to a port and stay running. This process finished without opening a port; create a Background Worker or a Cron Job for scripts that just run through.'))
    return { zeilen: z, erfolg: false, grund: 'keinServer' }
  }
  if (eingaben.dienst === 'worker') {
    z.push(zeile('aus', 'Fahrten geladen: 1500'))
    z.push(zeile('gut', '==> Your service is live 🎉'))
    return { zeilen: z, erfolg: true, grund: null }
  }

  const port = portVar ? 10000 : (portFest ? Number(portFest[1] || portFest[2] || portFest[3]) : 8000)
  const host = hostLokal ? '127.0.0.1' : (hostAlle ? '0.0.0.0' : (/\buvicorn\b/.test(befehl) ? '127.0.0.1' : '0.0.0.0'))
  if (/\buvicorn\b/.test(befehl)) z.push(zeile('aus', `INFO:     Uvicorn running on http://${host}:${port} (Press CTRL+C to quit)`))
  else if (/\bgunicorn\b/.test(befehl)) z.push(zeile('aus', `[1] [INFO] Listening at: http://${host}:${port} (1)`))
  else if (/\bflask\b/.test(befehl)) z.push(zeile('aus', ` * Running on http://${host}:${port}`))
  else z.push(zeile('aus', `Server listening on http://${host}:${port}`))

  if (host === '127.0.0.1') {
    z.push(zeile('warn', '==> No open ports detected, continuing to scan…'))
    z.push(zeile('fehler', '==> Port scan timeout reached, no open ports detected. Bind your service to at least one port. If you don\'t need to receive traffic on any port, create a background worker instead.'))
    z.push(zeile('fehler', '==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys'))
    return { zeilen: z, erfolg: false, grund: 'lokalPort' }
  }
  if (!portVar) {
    z.push(zeile('warn', `==> Detected service running on port ${port}`))
    z.push(zeile('warn', `==> Docs on specifying a port: https://render.com/docs/web-services#port-binding`))
    // Render findet einen offenen Port auch ohne $PORT - der Dienst geht online.
    // Die Warnung bleibt, weil der Weg zerbrechlich ist.
    z.push(zeile('gut', `==> Your service is live 🎉`))
    z.push(zeile('info', `==> Available at your primary URL https://${name}.onrender.com`))
    return { zeilen: z, erfolg: true, grund: 'festerPort' }
  }
  z.push(zeile('aus', `==> Detected service running on port ${port}`))
  z.push(zeile('gut', '==> Your service is live 🎉'))
  z.push(zeile('info', `==> Available at your primary URL https://${name}.onrender.com`))
  return { zeilen: z, erfolg: true, grund: null }
}

/**
 * Entspricht der Lauf dem Auftrag? `soll` nennt Bedingungen; jede ist ein
 * Muster (String, als RegExp gelesen) oder eine Liste von Variablennamen.
 */
export function deployErfuellt (eingaben, ergebnis, soll = {}) {
  if (!ergebnis.erfolg) return false
  if (soll.runtime && eingaben.runtime !== soll.runtime) return false
  if (soll.rootDir !== undefined && (eingaben.rootDir || '').replace(/^\/|\/$/g, '') !== soll.rootDir) return false
  if (soll.dienst && (eingaben.dienst || 'web') !== soll.dienst) return false
  if (soll.build && !new RegExp(soll.build).test(eingaben.build || '')) return false
  if (soll.start && !new RegExp(soll.start).test(eingaben.start || '')) return false
  if (soll.ohneWarnung && ergebnis.grund) return false
  for (const v of soll.env || []) {
    if (!(eingaben.env || []).some(e => e.name?.trim() === v && (e.value || '').trim())) return false
  }
  return true
}
