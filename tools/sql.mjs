/**
 * WInf-SP-Lab · SQL ohne Browser ausprobieren
 *
 *   node tools/sql.mjs postgres "SELECT count(*) FROM fahrt"
 *   node tools/sql.mjs sqlite   "SELECT typeof(preis_eur) FROM fahrt LIMIT 1"
 *   node tools/sql.mjs sqlite   --datei abfrage.sql
 *
 * Laesst dieselben Saatdaten wie im Browser laufen (PGlite bzw. sql.js) und
 * druckt das Ergebnis. Gedacht, um Musterloesungen zu pruefen, bevor sie in
 * eine Uebung wandern.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const [maschine, ...rest] = process.argv.slice(2)
if (!['postgres', 'sqlite'].includes(maschine)) {
  console.error('Aufruf: node tools/sql.mjs postgres|sqlite "SQL" | --datei pfad')
  process.exit(2)
}
const sql = rest[0] === '--datei' ? readFileSync(rest[1], 'utf8') : rest.join(' ')

export async function fuehreAus (maschine, sql) {
  if (maschine === 'postgres') {
    const { PGlite } = await import(join(WURZEL, 'assets/pglite/index.js'))
    const db = await PGlite.create()
    await db.exec(readFileSync(join(WURZEL, 'data/velocity.sql'), 'utf8'))
    const teile = await db.exec(sql, { rowMode: 'array' })
    await db.close()
    const letzte = [...teile].reverse().find(t => t.fields && t.fields.length) || { fields: [], rows: [] }
    return { spalten: letzte.fields.map(f => f.name), zeilen: letzte.rows }
  }
  const require = createRequire(import.meta.url)
  const initSqlJs = require(join(WURZEL, 'assets/sqljs/sql-wasm.js'))
  const SQL = await initSqlJs({ locateFile: (f) => join(WURZEL, 'assets/sqljs', f) })
  const db = new SQL.Database()
  db.exec(readFileSync(join(WURZEL, 'data/velocity.sqlite.sql'), 'utf8'))
  const teile = db.exec(sql)
  db.close()
  const letzte = [...teile].reverse().find(t => t.columns && t.columns.length) || { columns: [], values: [] }
  return { spalten: letzte.columns, zeilen: letzte.values }
}

const r = await fuehreAus(maschine, sql)
if (!r.spalten.length) { console.log('(keine Tabelle)'); process.exit(0) }
console.log(r.spalten.join(' | '))
for (const z of r.zeilen.slice(0, 50)) console.log(z.map(v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).join(' | '))
console.log(`-- ${r.zeilen.length} Zeilen`)
