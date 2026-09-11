-- ===========================================================================
-- WInf-SP-Lab · Beispieldatenbank "Velo City"
--
-- Ein kleiner Ausschnitt aus der Fallstudie der Vorlesung: Stationen, Raeder,
-- Kundschaft und Fahrten eines fiktiven Leihradsystems in Wuerzburg. Alle
-- Daten sind synthetisch erzeugt; es gibt keine echten Personen, keine echten
-- Fahrten und damit auch keinen Personenbezug.
--
-- Der Bestand ist absichtlich klein: Er laeuft im Browser (PGlite) und soll
-- in Sekunden stehen, nicht in Minuten. Die Fahrten entstehen deterministisch
-- aus generate_series, damit dieselbe Abfrage bei allen dasselbe Ergebnis
-- liefert - sonst waeren die Musterloesungen wertlos.
-- ===========================================================================

CREATE TABLE station (
  station_id   integer PRIMARY KEY,
  name         text    NOT NULL,
  bezirk       text    NOT NULL,
  plaetze      integer NOT NULL,
  eroeffnet    date    NOT NULL
);

CREATE TABLE rad (
  rad_id       text    PRIMARY KEY,
  typ          text    NOT NULL CHECK (typ IN ('CITY', 'EBIKE', 'CARGO')),
  baujahr      integer NOT NULL,
  heimstation  integer NOT NULL REFERENCES station (station_id),
  status       text    NOT NULL DEFAULT 'aktiv'
);

CREATE TABLE kunde (
  kunde_id     integer PRIMARY KEY,
  tarif        text    NOT NULL CHECK (tarif IN ('Basis', 'Plus', 'Jahr')),
  registriert  date    NOT NULL,
  bezirk       text    NOT NULL
);

CREATE TABLE fahrt (
  fahrt_id     integer PRIMARY KEY,
  rad_id       text    NOT NULL REFERENCES rad (rad_id),
  kunde_id     integer NOT NULL REFERENCES kunde (kunde_id),
  start_station integer NOT NULL REFERENCES station (station_id),
  ziel_station  integer NOT NULL REFERENCES station (station_id),
  start_zeit   timestamp NOT NULL,
  dauer_min    integer NOT NULL,
  preis_eur    numeric(6,2) NOT NULL
);

-- --------------------------------------------------------------- Stationen

INSERT INTO station (station_id, name, bezirk, plaetze, eroeffnet) VALUES
  (1,  'Juliuspromenade',   'Altstadt',   18, '2024-04-02'),
  (2,  'Hauptbahnhof',      'Altstadt',   24, '2024-04-02'),
  (3,  'Residenz',          'Altstadt',   16, '2024-04-02'),
  (4,  'Sanderring',        'Sanderau',   14, '2024-05-15'),
  (5,  'Grombuehl Klinikum','Grombuehl',  20, '2024-05-15'),
  (6,  'Hubland Campus',    'Frauenland', 22, '2024-09-01'),
  (7,  'Zellerau Baeder',   'Zellerau',   12, '2025-03-10'),
  (8,  'Heuchelhof Zentrum','Heuchelhof', 12, '2025-03-10'),
  (9,  'Loewenbruecke',     'Sanderau',   10, '2025-06-01'),
  (10, 'Versbach Nord',     'Versbach',    8, '2025-06-01');

-- ------------------------------------------------------------------ Raeder
-- 60 Raeder: 36 City, 18 E-Bikes, 6 Lastenraeder.

INSERT INTO rad (rad_id, typ, baujahr, heimstation, status)
SELECT
  'R-' || lpad(i::text, 3, '0'),
  CASE WHEN i % 10 = 0 THEN 'CARGO'
       WHEN i % 10 IN (3, 6, 9) THEN 'EBIKE'
       ELSE 'CITY' END,
  2023 + (i % 3),
  1 + (i % 10),
  CASE WHEN i % 17 = 0 THEN 'werkstatt' ELSE 'aktiv' END
FROM generate_series(1, 60) AS g(i);

-- ------------------------------------------------------------------ Kunden
-- 200 Konten, drei Tarife, Registrierung ueber zwei Jahre verteilt.

INSERT INTO kunde (kunde_id, tarif, registriert, bezirk)
SELECT
  i,
  CASE WHEN i % 7 = 0 THEN 'Jahr'
       WHEN i % 3 = 0 THEN 'Plus'
       ELSE 'Basis' END,
  DATE '2024-04-01' + ((i * 3) % 700),
  (ARRAY['Altstadt','Sanderau','Grombuehl','Frauenland','Zellerau','Heuchelhof','Versbach'])[1 + (i % 7)]
FROM generate_series(1, 200) AS g(i);

-- ------------------------------------------------------------------ Fahrten
--
-- 1.500 Fahrten ueber ein Jahr. Erzeugt mit setseed() und random(): PostgreSQL
-- liefert nach einem festen Startwert eine wiederholbare Zufallsfolge, sodass
-- der Bestand bei allen gleich aussieht und trotzdem nicht kuenstlich
-- gleichmaessig ist. Ein Bestand, in dem jede Verbindung genau gleich oft
-- vorkommt, taeuscht bei jeder Haeufigkeitsauswertung.
--
-- Modelliert sind vier Dinge, die im Fallbeispiel eine Rolle spielen:
--   * Stationen sind unterschiedlich stark nachgefragt (Altstadt vor Randlage),
--   * Fahrtdauern sind rechtsschief - viele kurze, wenige lange,
--   * es gibt eine Morgen- und eine Nachmittagsspitze,
--   * der Preis setzt sich aus einem Grundpreis je Radtyp und einem
--     Minutentarif zusammen; Lastenraeder sind am teuersten.
-- Rundfahrten (Start = Ziel) kommen vor und sind in den Auswertungen
-- ausdruecklich ein Thema.

SELECT setseed(0.42);

INSERT INTO fahrt (fahrt_id, rad_id, kunde_id, start_station, ziel_station, start_zeit, dauer_min, preis_eur)
WITH roh AS (
  SELECT
    i,
    -- Gewichtete Stationswahl: die Zahlen bilden die Nachfrage nach, nicht die
    -- Stationsnummer. Station 1-3 (Altstadt) und 5 (Klinikum) tragen am meisten.
    (ARRAY[1,1,1,1,2,2,2,2,2,3,3,3,4,4,5,5,5,5,6,6,6,7,8,9,10])
      [1 + floor(random() * 25)::int]                                  AS start_station,
    (ARRAY[1,1,1,2,2,2,2,3,3,3,3,4,4,5,5,5,6,6,6,6,7,8,9,10,10])
      [1 + floor(random() * 25)::int]                                  AS ziel_station,
    1 + floor(random() * 60)::int                                      AS rad_nr,
    1 + floor(random() * 200)::int                                     AS kunde_id,
    floor(random() * 365)::int                                         AS tag,
    -- Zwei Spitzen: gegen 8 Uhr und gegen 17 Uhr, dazwischen Grundlast.
    CASE WHEN random() < 0.35 THEN 420 + floor(random() * 120)::int
         WHEN random() < 0.55 THEN 960 + floor(random() * 150)::int
         ELSE 360 + floor(random() * 840)::int END                     AS minute_am_tag,
    -- Rechtsschiefe Dauer: Median bei etwa 11 Minuten, wenige lange Fahrten.
    least(90, 3 + floor(-9.0 * ln(1 - random() * 0.999))::int)         AS dauer_min
  FROM generate_series(1, 1500) AS g(i)
)
SELECT
  roh.i,
  'R-' || lpad(roh.rad_nr::text, 3, '0'),
  roh.kunde_id,
  roh.start_station,
  roh.ziel_station,
  TIMESTAMP '2025-09-01 00:00:00'
    + (roh.tag || ' days')::interval
    + (roh.minute_am_tag || ' minutes')::interval,
  roh.dauer_min,
  ROUND((
    CASE r.typ WHEN 'CARGO' THEN 1.50 WHEN 'EBIKE' THEN 1.00 ELSE 0.50 END
    + roh.dauer_min * CASE r.typ WHEN 'CARGO' THEN 0.18
                                WHEN 'EBIKE' THEN 0.14
                                ELSE 0.10 END
  )::numeric, 2)
FROM roh
JOIN rad r ON r.rad_id = 'R-' || lpad(roh.rad_nr::text, 3, '0');

-- --------------------------------------------------------------- Hilfssicht
-- Eine Sicht, die den Radtyp an die Fahrt heftet. Sie erspart in den Uebungen
-- den immer gleichen Verbund und macht zugleich vor, wozu Sichten da sind.

CREATE VIEW fahrt_mit_typ AS
SELECT f.*, r.typ AS rad_typ, s.name AS start_name, z.name AS ziel_name
FROM fahrt f
JOIN rad     r ON r.rad_id = f.rad_id
JOIN station s ON s.station_id = f.start_station
JOIN station z ON z.station_id = f.ziel_station;
