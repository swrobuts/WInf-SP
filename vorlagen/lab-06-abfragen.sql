-- lab-06-abfragen.sql – Beispielabfragen fuer velocity.db (Velo City, Lab 06)
--
-- Ausfuehren in der Shell:      sqlite3 velocity.db < lab-06-abfragen.sql
-- oder in der Sitzung:          sqlite> .read lab-06-abfragen.sql
-- oder in DB Browser for SQLite: Reiter "Execute SQL", Abfrage markieren, Strg+Enter.
-- Jede Abfrage laeuft auch in der SQL-Konsole der Lab-Seite.

.mode box
.headers on

-- 1) Aggregation: Fahrten und Umsatz je Radtyp ueber die Sicht fahrt_mit_typ.
--    round(x, 2), weil preis_eur ein REAL ist – die Summe hat sonst Nachkommastellen
--    wie 1522.5000000000002. Kontrollwerte: CITY 913 / 1522.50, EBIKE 444 / 1153.80,
--    CARGO 143 / 495.84, gesamt 3172.14.
SELECT rad_typ,
       count(*)                  AS fahrten,
       round(sum(preis_eur), 2)  AS umsatz
FROM fahrt_mit_typ
GROUP BY rad_typ
ORDER BY umsatz DESC;

-- 2) Zeit: Umsatz je Monat. start_zeit ist TEXT nach ISO 8601, also liefert
--    strftime('%Y-%m', …) den Monat als Text '2025-09' – in Postgres waere das
--    date_trunc('month', start_zeit) oder to_char(start_zeit, 'YYYY-MM').
SELECT strftime('%Y-%m', start_zeit) AS monat,
       count(*)                       AS fahrten,
       round(sum(preis_eur), 2)       AS umsatz
FROM fahrt
GROUP BY monat
ORDER BY monat;

-- 3) JOIN: Abfahrten je Station, mit Bezirk. Zwei Tabellen ueber den
--    Fremdschluessel start_station -> station.station_id verbunden.
SELECT s.name                   AS station,
       s.bezirk,
       count(*)                 AS abfahrten,
       round(avg(f.dauer_min), 1) AS dauer_mittel
FROM fahrt f
JOIN station s ON s.station_id = f.start_station
GROUP BY s.station_id
ORDER BY abfahrten DESC;

-- 4) Fensterfunktion: Rang der Stationen nach Abfahrten und kumulierter Umsatz
--    je Monat. OVER () rechnet ueber die Ergebnismenge, ohne sie zu gruppieren.
SELECT s.name                                  AS station,
       count(*)                                AS abfahrten,
       rank() OVER (ORDER BY count(*) DESC)    AS rang
FROM fahrt f
JOIN station s ON s.station_id = f.start_station
GROUP BY s.name
ORDER BY rang;

SELECT monat,
       umsatz,
       round(sum(umsatz) OVER (ORDER BY monat), 2) AS kumuliert
FROM (
  SELECT strftime('%Y-%m', start_zeit) AS monat,
         round(sum(preis_eur), 2)       AS umsatz
  FROM fahrt
  GROUP BY monat
)
ORDER BY monat;

-- 5) JSON: Zeilen zu JSON (json_object, json_group_array) und zurueck (->>).
--    Das ist die Bruecke zu Lab 05 – und im Kleinen das, was Lab 10 als ELT macht.
SELECT bezirk,
       json_group_array(name) AS stationen
FROM station
GROUP BY bezirk;

SELECT json_object('rad_id', rad_id, 'typ', typ, 'baujahr', baujahr) AS rad_json
FROM rad
WHERE status = 'werkstatt';

-- Aus einem JSON-Text Spalten machen: -> liefert JSON-Text, ->> den SQL-Wert.
SELECT doc ->> '$.fahrt_id'          AS fahrt_id,
       doc ->> '$.start.station_id'  AS start_station,
       doc ->> '$.dauer_min'         AS dauer_min,
       typeof(doc ->> '$.dauer_min') AS typ
FROM (SELECT '{"fahrt_id":1,"rad_id":"R-057","start":{"station_id":6,"zeit":"2025-10-05T07:58:00"},"ziel":{"station_id":3},"dauer_min":7,"preis_eur":1.2}' AS doc);

-- 6) Typen sichtbar machen: typeof() zeigt die Speicherklasse des Werts.
SELECT typeof(station_id), typeof(name), typeof(eroeffnet), typeof(plaetze)
FROM station
LIMIT 1;
