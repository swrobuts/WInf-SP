-- lab-13-export.sql – flache Fahrtentabelle als CSV fuer Tableau (Velo City, Lab 13)
--
-- Erzeugt eine Zeile je Fahrt mit denselben Spalten wie data/regal-fahrten.json:
--   fahrt_id, monat, wochentag, stunde, bezirk, station, rad_typ, tarif, dauer_min, preis_eur
-- Grundlage: die Sicht fahrt_mit_typ (Lab 06 / Lab 08) plus kunde (tarif) und station (bezirk).
-- Der CSV-Export ist der Weg fuer die Tableau Desktop Public Edition, die keine Datenbank
-- anbinden kann. Free Edition und Creator verbinden sich direkt (Lab 13, Abschnitt Verbinden).
--
-- Zwei Bloecke, je einer pro Datenbank. Nur den passenden Block ausfuehren – die
-- Punktbefehle in Block A versteht nur sqlite3, das \copy in Block B nur psql.

-- ===========================================================================
-- A) SQLite – velocity.db aus Lab 06, in der sqlite3-Shell:
--      sqlite3 velocity.db
--    dann diesen Block einfuegen. Ergebnis: fahrten.csv im aktuellen Ordner.
--    In DB Browser for SQLite stattdessen die Abfrage ausfuehren und das Ergebnis
--    ueber das Export-Symbol des Ergebnisrasters als CSV sichern.
-- ===========================================================================
.mode csv
.headers on
.once fahrten.csv
SELECT f.fahrt_id,
       strftime('%Y-%m', f.start_zeit)                          AS monat,      -- start_zeit ist TEXT nach ISO 8601
       CASE strftime('%w', f.start_zeit)                                       -- %w: 0 = Sonntag … 6 = Samstag
            WHEN '0' THEN 'So' WHEN '1' THEN 'Mo' WHEN '2' THEN 'Di'
            WHEN '3' THEN 'Mi' WHEN '4' THEN 'Do' WHEN '5' THEN 'Fr'
            ELSE 'Sa' END                                        AS wochentag,
       CAST(strftime('%H', f.start_zeit) AS INTEGER)            AS stunde,
       s.bezirk,                                                                -- Startbezirk
       f.start_name                                              AS station,    -- Startstation
       f.rad_typ,
       k.tarif,
       f.dauer_min,
       f.preis_eur
FROM fahrt_mit_typ f
JOIN station s ON s.station_id = f.start_station
JOIN kunde   k ON k.kunde_id   = f.kunde_id
ORDER BY f.fahrt_id;

-- ===========================================================================
-- B) PostgreSQL – Supabase aus Lab 08, per psql ueber den Session Pooler (Port 5432,
--    Benutzer postgres.[REF], sslmode=require – siehe Lab 08, Befehlskarte B05):
--      psql "postgres://postgres.[REF]:[PASSWORT]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
--    \copy ist ein Befehl von psql und schreibt die Datei auf IHREN Rechner
--    (COPY … TO ohne Backslash schriebe auf den Server und ist dort nicht erlaubt).
--    \copy muss in EINER Zeile stehen – deshalb steht die Abfrage unten am Stueck.
-- ===========================================================================
\copy (SELECT f.fahrt_id, to_char(f.start_zeit, 'YYYY-MM') AS monat, (ARRAY['So','Mo','Di','Mi','Do','Fr','Sa'])[extract(dow FROM f.start_zeit)::int + 1] AS wochentag, extract(hour FROM f.start_zeit)::int AS stunde, s.bezirk, f.start_name AS station, f.rad_typ, k.tarif, f.dauer_min, f.preis_eur FROM fahrt_mit_typ f JOIN station s ON s.station_id = f.start_station JOIN kunde k ON k.kunde_id = f.kunde_id ORDER BY f.fahrt_id) TO 'fahrten.csv' WITH (FORMAT csv, HEADER)

-- Kontrolle nach dem Export (beide Datenbanken): 1.500 Zeilen, Umsatz gesamt 3172.14,
-- Fahrten je Radtyp CITY 913 / EBIKE 444 / CARGO 143. In Tableau: Data Source page,
-- unten rechts "1,500 rows"; Spalte preis_eur muss als # (Number (decimal)) erkannt sein.
