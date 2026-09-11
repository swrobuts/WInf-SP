/**
 * WInf-SP-Lab · Datenerzeugung
 *
 * Laesst data/velocity.sql einmal in PGlite laufen und schreibt denselben
 * Bestand in zwei weiteren Formen heraus:
 *
 *   data/velocity.sqlite.sql   SQLite-Dialekt (Lab 06, Lab 09)
 *   data/velocity.json         verschachtelter Export, wie ihn eine
 *                              Schnittstelle liefern wuerde (Lab 05, Lab 10)
 *   data/fahrten.jsonl         JSON Lines, eine Fahrt je Zeile (Lab 05)
 *
 * So rechnen alle Labs auf identischen Zahlen: Was in SQLite 1.500 Fahrten
 * sind, sind in Postgres und im JSON dieselben 1.500.
 *
 * Aufruf:  node tools/gen_daten.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const { PGlite } = await import(join(WURZEL, 'assets/pglite/index.js'))
const db = await PGlite.create()
await db.exec(readFileSync(join(WURZEL, 'data/velocity.sql'), 'utf8'))

const zeilen = async (sql) => (await db.query(sql)).rows
const stationen = await zeilen('SELECT station_id, name, bezirk, plaetze, eroeffnet::text AS eroeffnet FROM station ORDER BY station_id')
const raeder = await zeilen('SELECT * FROM rad ORDER BY rad_id')
const kunden = await zeilen('SELECT kunde_id, tarif, registriert::text AS registriert, bezirk FROM kunde ORDER BY kunde_id')
// start_zeit als Text: Ein JavaScript-Date wuerde die zeitzonenlose Uhrzeit nach UTC verschieben.
const fahrten = await zeilen("SELECT fahrt_id, rad_id, kunde_id, start_station, ziel_station, to_char(start_zeit, 'YYYY-MM-DD HH24:MI:SS') AS start_zeit, dauer_min, preis_eur FROM fahrt ORDER BY fahrt_id")

const iso = (d) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d)
const isoZeit = (d) => d instanceof Date ? d.toISOString().slice(0, 19).replace('T', ' ') : String(d)
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

/* ------------------------------------------------------------- SQLite */
let s = `-- ===========================================================================
-- WInf-SP-Lab · Beispieldatenbank "Velo City" im SQLite-Dialekt
--
-- Derselbe Bestand wie in data/velocity.sql (PostgreSQL), erzeugt von
-- tools/gen_daten.mjs: 10 Stationen, 60 Raeder, 200 Kunden, 1.500 Fahrten.
-- Alle Daten sind synthetisch; es gibt keinen Personenbezug.
--
-- Unterschiede zum Postgres-Skript, absichtlich sichtbar gelassen:
--   * SQLite kennt keine Typen DATE, TIMESTAMP, NUMERIC(6,2) im strengen
--     Sinn; Datum und Zeit sind TEXT nach ISO 8601, Preise REAL.
--   * Fremdschluessel gelten nur, wenn PRAGMA foreign_keys = ON gesetzt ist.
--   * Es gibt kein generate_series und kein setseed - die Zeilen stehen
--     ausgeschrieben da.
-- ===========================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE station (
  station_id   INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL,
  bezirk       TEXT    NOT NULL,
  plaetze      INTEGER NOT NULL,
  eroeffnet    TEXT    NOT NULL
);

CREATE TABLE rad (
  rad_id       TEXT    PRIMARY KEY,
  typ          TEXT    NOT NULL CHECK (typ IN ('CITY', 'EBIKE', 'CARGO')),
  baujahr      INTEGER NOT NULL,
  heimstation  INTEGER NOT NULL REFERENCES station (station_id),
  status       TEXT    NOT NULL DEFAULT 'aktiv'
);

CREATE TABLE kunde (
  kunde_id     INTEGER PRIMARY KEY,
  tarif        TEXT    NOT NULL CHECK (tarif IN ('Basis', 'Plus', 'Jahr')),
  registriert  TEXT    NOT NULL,
  bezirk       TEXT    NOT NULL
);

CREATE TABLE fahrt (
  fahrt_id      INTEGER PRIMARY KEY,
  rad_id        TEXT    NOT NULL REFERENCES rad (rad_id),
  kunde_id      INTEGER NOT NULL REFERENCES kunde (kunde_id),
  start_station INTEGER NOT NULL REFERENCES station (station_id),
  ziel_station  INTEGER NOT NULL REFERENCES station (station_id),
  start_zeit    TEXT    NOT NULL,
  dauer_min     INTEGER NOT NULL,
  preis_eur     REAL    NOT NULL
);

`
s += 'INSERT INTO station (station_id, name, bezirk, plaetze, eroeffnet) VALUES\n' +
  stationen.map(r => `  (${r.station_id}, ${q(r.name)}, ${q(r.bezirk)}, ${r.plaetze}, ${q(iso(r.eroeffnet))})`).join(',\n') + ';\n\n'
s += 'INSERT INTO rad (rad_id, typ, baujahr, heimstation, status) VALUES\n' +
  raeder.map(r => `  (${q(r.rad_id)}, ${q(r.typ)}, ${r.baujahr}, ${r.heimstation}, ${q(r.status)})`).join(',\n') + ';\n\n'
s += 'INSERT INTO kunde (kunde_id, tarif, registriert, bezirk) VALUES\n' +
  kunden.map(r => `  (${r.kunde_id}, ${q(r.tarif)}, ${q(iso(r.registriert))}, ${q(r.bezirk)})`).join(',\n') + ';\n\n'
s += 'INSERT INTO fahrt (fahrt_id, rad_id, kunde_id, start_station, ziel_station, start_zeit, dauer_min, preis_eur) VALUES\n' +
  fahrten.map(r => `  (${r.fahrt_id}, ${q(r.rad_id)}, ${r.kunde_id}, ${r.start_station}, ${r.ziel_station}, ${q(isoZeit(r.start_zeit))}, ${r.dauer_min}, ${Number(r.preis_eur).toFixed(2)})`).join(',\n') + ';\n\n'
s += `-- Dieselbe Hilfssicht wie in Postgres.
CREATE VIEW fahrt_mit_typ AS
SELECT f.*, r.typ AS rad_typ, s.name AS start_name, z.name AS ziel_name
FROM fahrt f
JOIN rad     r ON r.rad_id = f.rad_id
JOIN station s ON s.station_id = f.start_station
JOIN station z ON z.station_id = f.ziel_station;
`
writeFileSync(join(WURZEL, 'data/velocity.sqlite.sql'), s)

/* --------------------------------------------------------------- JSON */
// So, wie eine Schnittstelle des Leihradsystems antworten wuerde: ein
// Umschlag mit Metadaten, darin Listen; Stationen tragen ihre Raeder
// verschachtelt, Fahrten verweisen ueber Kennungen.
const stationMitRaedern = stationen.map(st => ({
  station_id: st.station_id,
  name: st.name,
  bezirk: st.bezirk,
  plaetze: st.plaetze,
  eroeffnet: iso(st.eroeffnet),
  raeder: raeder.filter(r => r.heimstation === st.station_id).map(r => ({
    rad_id: r.rad_id, typ: r.typ, baujahr: r.baujahr, status: r.status
  }))
}))
const exportObjekt = {
  quelle: 'Velo City Betreiberportal',
  exportiert_am: '2026-09-01T06:00:00+02:00',
  waehrung: 'EUR',
  stationen: stationMitRaedern,
  kunden: kunden.map(k => ({ kunde_id: k.kunde_id, tarif: k.tarif, registriert: iso(k.registriert), bezirk: k.bezirk })),
  fahrten: fahrten.map(f => ({
    fahrt_id: f.fahrt_id, rad_id: f.rad_id, kunde_id: f.kunde_id,
    start: { station_id: f.start_station, zeit: isoZeit(f.start_zeit).replace(' ', 'T') },
    ziel: { station_id: f.ziel_station },
    dauer_min: f.dauer_min, preis_eur: Number(f.preis_eur)
  }))
}
writeFileSync(join(WURZEL, 'data/velocity.json'), JSON.stringify(exportObjekt, null, 2) + '\n')
writeFileSync(join(WURZEL, 'data/fahrten.jsonl'),
  exportObjekt.fahrten.map(f => JSON.stringify(f)).join('\n') + '\n')

// Kleine Kostprobe fuer Lab 05: die ersten drei Stationen samt Raedern, damit
// die Datei im Editor uebersichtlich bleibt.
const kostprobe = { ...exportObjekt, stationen: stationMitRaedern.slice(0, 3), kunden: exportObjekt.kunden.slice(0, 5), fahrten: exportObjekt.fahrten.slice(0, 8) }
writeFileSync(join(WURZEL, 'data/velocity-kostprobe.json'), JSON.stringify(kostprobe, null, 2) + '\n')

console.log(`Stationen ${stationen.length}, Räder ${raeder.length}, Kunden ${kunden.length}, Fahrten ${fahrten.length}`)
console.log('Umsatz gesamt', fahrten.reduce((s, f) => s + Number(f.preis_eur), 0).toFixed(2))
await db.close()
