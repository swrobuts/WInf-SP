/**
 * WInf-SP-Lab · Daten fuer den Regal-Simulator (Lab 12, Lab 13)
 *
 * Eine flache Tabelle, eine Zeile je Fahrt, mit den Feldern, die man in
 * Power BI oder Tableau auf ein Regal legen wuerde. Erzeugt aus derselben
 * PGlite-Datenbank wie alles andere. Aufruf: node tools/gen_regal.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const { PGlite } = await import(join(WURZEL, 'assets/pglite/index.js'))
const db = await PGlite.create()
await db.exec(readFileSync(join(WURZEL, 'data/velocity.sql'), 'utf8'))
const r = await db.query(`
  SELECT f.fahrt_id,
         to_char(f.start_zeit, 'YYYY-MM')          AS monat,
         to_char(f.start_zeit, 'TMDy')             AS wochentag,
         extract(hour FROM f.start_zeit)::int      AS stunde,
         s.bezirk                                  AS bezirk,
         s.name                                    AS station,
         r.typ                                     AS rad_typ,
         k.tarif                                   AS tarif,
         f.dauer_min,
         f.preis_eur::float                        AS preis_eur
  FROM fahrt f
  JOIN station s ON s.station_id = f.start_station
  JOIN rad r ON r.rad_id = f.rad_id
  JOIN kunde k ON k.kunde_id = f.kunde_id
  ORDER BY f.fahrt_id`)
const TAGE = { Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So' }
const zeilen = r.rows.map(z => ({ ...z, wochentag: TAGE[z.wochentag] || z.wochentag }))
writeFileSync(join(WURZEL, 'data/regal-fahrten.json'), JSON.stringify(zeilen) + '\n')
console.log(zeilen.length, 'Zeilen,', Object.keys(zeilen[0]).join(', '))
console.log('Monate:', [...new Set(zeilen.map(z => z.monat))].sort().join(' '))
await db.close()
