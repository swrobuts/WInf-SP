-- ===========================================================================
-- WInf-SP-Lab · Lab 10 · Sternschema "Velo City" für PostgreSQL (Supabase)
--
-- Das ist der Teil "T" und "L" einer ELT-Pipeline: Die Rohdaten liegen
-- bereits im Schema staging (geladen von vorlagen/lab-10-etl.py), die
-- Umformung findet hier, in der Zieldatenbank, in SQL statt.
--
-- Grain der Faktentabelle: EINE ZEILE = EINE FAHRT.
--
-- Das Skript ist idempotent: Es darf beliebig oft laufen. Tabellen werden
-- nur angelegt, wenn sie fehlen (IF NOT EXISTS), Dimensionen werden per
-- Upsert (ON CONFLICT … DO UPDATE) aktualisiert, Fakten werden nur
-- eingefügt, wenn die Fahrt noch fehlt (ON CONFLICT … DO NOTHING).
--
-- Voraussetzung: staging.station, staging.rad, staging.kunde, staging.fahrt
-- mit den Spalten, die lab-10-etl.py schreibt. In staging.fahrt heißen die
-- entpackten Spalten start_station_id, start_zeit (timestamptz, UTC),
-- ziel_station_id; dazu loaded_at und source_file.
--
-- Ausführen: im SQL Editor von Supabase (Lab 08) oder in DataGrip (Lab 09).
-- ===========================================================================

CREATE SCHEMA IF NOT EXISTS mart;

-- ---------------------------------------------------------------------------
-- 1. Datumsdimension
--    Schlüssel YYYYMMDD als Ganzzahl (die einzige Dimension, bei der ein
--    sprechender Schlüssel üblich ist). Eine Zeile -1 für "unbekannt", damit
--    ein Fakt ohne gültiges Datum nicht verloren geht.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mart.dim_datum (
  datum_key       integer PRIMARY KEY,      -- 20260901, -1 = unbekannt
  datum           date,
  jahr            integer,
  quartal         integer,
  monat           integer,
  monat_name      text,
  kw_iso          integer,
  wochentag       integer,                  -- ISO: 1 = Montag … 7 = Sonntag
  wochentag_name  text,
  wochenende      boolean NOT NULL DEFAULT false
);

INSERT INTO mart.dim_datum
  (datum_key, datum, jahr, quartal, monat, monat_name, kw_iso, wochentag, wochentag_name, wochenende)
SELECT
  to_char(d, 'YYYYMMDD')::int,
  d::date,
  extract(year    FROM d)::int,
  extract(quarter FROM d)::int,
  extract(month   FROM d)::int,
  (ARRAY['Januar','Februar','März','April','Mai','Juni','Juli','August',
         'September','Oktober','November','Dezember'])[extract(month FROM d)::int],
  extract(week    FROM d)::int,
  extract(isodow  FROM d)::int,
  (ARRAY['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'])
         [extract(isodow FROM d)::int],
  extract(isodow  FROM d) >= 6
FROM generate_series(DATE '2024-01-01', DATE '2027-12-31', interval '1 day') AS d
ON CONFLICT (datum_key) DO NOTHING;

INSERT INTO mart.dim_datum (datum_key, monat_name, wochentag_name)
VALUES (-1, 'Unbekannt', 'Unbekannt')
ON CONFLICT (datum_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Stationsdimension
--    Surrogatschlüssel station_sk (vom System vergeben), natürlicher
--    Schlüssel station_id (aus der Quelle) bleibt als Attribut mit UNIQUE.
--    Der Upsert ist SCD Typ 1: Ein neuer Stationsname überschreibt den alten.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mart.dim_station (
  station_sk  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  station_id  integer NOT NULL UNIQUE,      -- natürlicher Schlüssel
  name        text    NOT NULL,
  bezirk      text    NOT NULL,
  plaetze     integer,
  eroeffnet   date
);

-- Die Unbekannt-Zeile bekommt ausdrücklich den Schlüssel -1. Bei einer
-- Identity-Spalte geht das nur mit OVERRIDING SYSTEM VALUE.
INSERT INTO mart.dim_station (station_sk, station_id, name, bezirk)
OVERRIDING SYSTEM VALUE
VALUES (-1, -1, 'Unbekannt', 'Unbekannt')
ON CONFLICT (station_id) DO NOTHING;

INSERT INTO mart.dim_station (station_id, name, bezirk, plaetze, eroeffnet)
SELECT station_id, name, bezirk, plaetze, eroeffnet::date
FROM staging.station
ON CONFLICT (station_id) DO UPDATE
   SET name      = EXCLUDED.name,
       bezirk    = EXCLUDED.bezirk,
       plaetze   = EXCLUDED.plaetze,
       eroeffnet = EXCLUDED.eroeffnet;

-- ---------------------------------------------------------------------------
-- 3. Raddimension
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mart.dim_rad (
  rad_sk       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rad_id       text    NOT NULL UNIQUE,     -- natürlicher Schlüssel, z. B. R-017
  typ          text    NOT NULL,            -- CITY, EBIKE, CARGO
  baujahr      integer,
  heimstation  integer,
  status       text
);

INSERT INTO mart.dim_rad (rad_sk, rad_id, typ)
OVERRIDING SYSTEM VALUE
VALUES (-1, 'UNBEKANNT', 'Unbekannt')
ON CONFLICT (rad_id) DO NOTHING;

INSERT INTO mart.dim_rad (rad_id, typ, baujahr, heimstation, status)
SELECT rad_id, typ, baujahr, heimstation, status
FROM staging.rad
ON CONFLICT (rad_id) DO UPDATE
   SET typ         = EXCLUDED.typ,
       baujahr     = EXCLUDED.baujahr,
       heimstation = EXCLUDED.heimstation,
       status      = EXCLUDED.status;

-- ---------------------------------------------------------------------------
-- 4. Kundendimension
--    Enthält keine Namen oder Adressen – die Quelle liefert nur Tarif,
--    Registrierungsdatum und Bezirk. Personenbezogene Felder würde man
--    VOR dem Laden entfernen (das wäre der ETL-Fall), nicht hier.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mart.dim_kunde (
  kunde_sk     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kunde_id     integer NOT NULL UNIQUE,     -- natürlicher Schlüssel
  tarif        text    NOT NULL,            -- Basis, Plus, Jahr
  registriert  date,
  bezirk       text
);

INSERT INTO mart.dim_kunde (kunde_sk, kunde_id, tarif)
OVERRIDING SYSTEM VALUE
VALUES (-1, -1, 'Unbekannt')
ON CONFLICT (kunde_id) DO NOTHING;

INSERT INTO mart.dim_kunde (kunde_id, tarif, registriert, bezirk)
SELECT kunde_id, tarif, registriert::date, bezirk
FROM staging.kunde
ON CONFLICT (kunde_id) DO UPDATE
   SET tarif       = EXCLUDED.tarif,
       registriert = EXCLUDED.registriert,
       bezirk      = EXCLUDED.bezirk;

-- ---------------------------------------------------------------------------
-- 5. Faktentabelle – Grain: eine Zeile je Fahrt
--    Fremdschlüssel zeigen auf die Surrogatschlüssel der Dimensionen.
--    fahrt_id bleibt als degenerierte Dimension in der Faktentabelle und
--    sichert als UNIQUE, dass ein zweiter Lauf keine Fahrt doppelt anlegt.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mart.fact_fahrt (
  fahrt_id          integer PRIMARY KEY,                             -- natürlicher Schlüssel
  datum_key         integer NOT NULL REFERENCES mart.dim_datum   (datum_key),
  start_station_sk  integer NOT NULL REFERENCES mart.dim_station (station_sk),
  ziel_station_sk   integer NOT NULL REFERENCES mart.dim_station (station_sk),
  rad_sk            integer NOT NULL REFERENCES mart.dim_rad     (rad_sk),
  kunde_sk          integer NOT NULL REFERENCES mart.dim_kunde   (kunde_sk),
  start_zeit        timestamptz NOT NULL,
  stunde            integer NOT NULL,                                -- Ortszeit Europe/Berlin
  dauer_min         integer NOT NULL,                                -- Measure
  preis_eur         numeric(6,2) NOT NULL,                           -- Measure, exakt
  loaded_at         timestamptz NOT NULL DEFAULT now()
);

-- Deduplizieren: Kommt eine Fahrt in staging mehrfach vor (zwei Läufe,
-- zwei Exportdateien), zählt die zuletzt geladene Fassung.
WITH nummeriert AS (
  SELECT f.*,
         row_number() OVER (PARTITION BY f.fahrt_id ORDER BY f.loaded_at DESC) AS rn
  FROM staging.fahrt f
),
bereinigt AS (
  SELECT * FROM nummeriert WHERE rn = 1
)
INSERT INTO mart.fact_fahrt
  (fahrt_id, datum_key, start_station_sk, ziel_station_sk, rad_sk, kunde_sk,
   start_zeit, stunde, dauer_min, preis_eur)
SELECT
  b.fahrt_id,
  COALESCE(d.datum_key, -1),
  COALESCE(s1.station_sk, -1),
  COALESCE(s2.station_sk, -1),
  COALESCE(r.rad_sk, -1),
  COALESCE(k.kunde_sk, -1),
  b.start_zeit,
  extract(hour FROM (b.start_zeit AT TIME ZONE 'Europe/Berlin'))::int,
  b.dauer_min,
  b.preis_eur::numeric(6,2)
FROM bereinigt b
LEFT JOIN mart.dim_datum   d  ON d.datum      = (b.start_zeit AT TIME ZONE 'Europe/Berlin')::date
LEFT JOIN mart.dim_station s1 ON s1.station_id = b.start_station_id
LEFT JOIN mart.dim_station s2 ON s2.station_id = b.ziel_station_id
LEFT JOIN mart.dim_rad     r  ON r.rad_id      = b.rad_id
LEFT JOIN mart.dim_kunde   k  ON k.kunde_id    = b.kunde_id
ON CONFLICT (fahrt_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Ein leichtes Mart als Materialized View: Fahrten je Station und Tag.
--    Der UNIQUE-Index ist Pflicht, sonst ist REFRESH … CONCURRENTLY nicht
--    erlaubt. CONCURRENTLY sperrt Lesende nicht aus – Power BI und Tableau
--    (Lab 12/13) können während der Aktualisierung weiter abfragen.
-- ---------------------------------------------------------------------------

CREATE MATERIALIZED VIEW IF NOT EXISTS mart.fahrten_station_tag AS
SELECT
  d.datum,
  d.wochentag_name,
  d.wochenende,
  s.name                    AS station,
  s.bezirk,
  count(*)                  AS fahrten,
  sum(f.dauer_min)          AS minuten,
  sum(f.preis_eur)          AS umsatz_eur
FROM mart.fact_fahrt f
JOIN mart.dim_datum   d ON d.datum_key  = f.datum_key
JOIN mart.dim_station s ON s.station_sk = f.start_station_sk
GROUP BY d.datum, d.wochentag_name, d.wochenende, s.name, s.bezirk;

CREATE UNIQUE INDEX IF NOT EXISTS fahrten_station_tag_uq
  ON mart.fahrten_station_tag (datum, station);

REFRESH MATERIALIZED VIEW CONCURRENTLY mart.fahrten_station_tag;

-- ---------------------------------------------------------------------------
-- 7. Datenqualität als SQL-Zusicherungen (dieselben vier Tests wie in dbt:
--    unique, not_null, accepted_values, relationships). Jede Abfrage muss
--    0 liefern; alles andere ist ein Befund, der den Lauf stoppen sollte.
-- ---------------------------------------------------------------------------

SELECT 'unique fahrt_id'        AS test, count(*) - count(DISTINCT fahrt_id) AS befunde FROM mart.fact_fahrt
UNION ALL
SELECT 'not_null preis_eur',       count(*) FROM mart.fact_fahrt WHERE preis_eur IS NULL
UNION ALL
SELECT 'accepted_values typ',      count(*) FROM mart.dim_rad WHERE typ NOT IN ('CITY','EBIKE','CARGO','Unbekannt')
UNION ALL
SELECT 'relationships station',    count(*) FROM mart.fact_fahrt f
                                   LEFT JOIN mart.dim_station s ON s.station_sk = f.start_station_sk
                                   WHERE s.station_sk IS NULL
UNION ALL
SELECT 'unbekannte Schlüssel',     count(*) FROM mart.fact_fahrt
                                   WHERE -1 IN (datum_key, start_station_sk, ziel_station_sk, rad_sk, kunde_sk);

-- ---------------------------------------------------------------------------
-- 8. Nächtliche Aktualisierung auf Supabase mit pg_cron
--    (Erweiterung unter Database → Extensions einschalten; Zeiten in UTC,
--    also 02:15 UTC = 04:15 Sommerzeit / 03:15 Winterzeit in Würzburg).
--    Das Auskommentieren aufheben, wenn pg_cron aktiv ist:
--
-- SELECT cron.schedule(
--   'refresh-fahrten-station-tag',                                  -- Name des Jobs
--   '15 2 * * *',                                                   -- täglich 02:15 UTC
--   $$REFRESH MATERIALIZED VIEW CONCURRENTLY mart.fahrten_station_tag$$
-- );
-- SELECT * FROM cron.job;                  -- eingerichtete Jobs
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;   -- Protokoll
-- ---------------------------------------------------------------------------
