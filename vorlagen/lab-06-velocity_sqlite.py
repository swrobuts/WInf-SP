"""
lab-06-velocity_sqlite.py – Velo City: vom JSON-Export (Lab 05) zur SQLite-Datei

Liest data/velocity.json und legt velocity.db an: vier Tabellen, eine Sicht,
Fremdschluessel eingeschaltet. Danach eine Kontrollabfrage.

Aufruf im Projektordner (dort liegt der Ordner data/):
    python3 lab-06-velocity_sqlite.py      # macOS / Linux
    python  lab-06-velocity_sqlite.py      # Windows

Braucht nichts ausser der Standardbibliothek – sqlite3 ist in Python enthalten.
"""

import json
import sqlite3
from pathlib import Path

QUELLE = Path("data/velocity.json")   # der Export aus Lab 05
ZIEL = Path("velocity.db")            # eine Datei = eine Datenbank

# Schema wie in data/velocity.sqlite.sql, aber STRICT: Dann prueft SQLite die
# Typen beim Einfuegen, statt 'abc' still in eine INTEGER-Spalte zu schreiben.
# STRICT erlaubt nur INT, INTEGER, REAL, TEXT, BLOB, ANY – kein DATE, kein
# VARCHAR, kein BOOLEAN. Datum und Zeit sind TEXT nach ISO 8601.
SCHEMA = """
CREATE TABLE station (
  station_id   INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL,
  bezirk       TEXT    NOT NULL,
  plaetze      INTEGER NOT NULL,
  eroeffnet    TEXT    NOT NULL
) STRICT;

CREATE TABLE rad (
  rad_id       TEXT    PRIMARY KEY,
  typ          TEXT    NOT NULL CHECK (typ IN ('CITY', 'EBIKE', 'CARGO')),
  baujahr      INTEGER NOT NULL,
  heimstation  INTEGER NOT NULL REFERENCES station (station_id),
  status       TEXT    NOT NULL DEFAULT 'aktiv'
) STRICT;

CREATE TABLE kunde (
  kunde_id     INTEGER PRIMARY KEY,
  tarif        TEXT    NOT NULL CHECK (tarif IN ('Basis', 'Plus', 'Jahr')),
  registriert  TEXT    NOT NULL,
  bezirk       TEXT    NOT NULL
) STRICT;

CREATE TABLE fahrt (
  fahrt_id      INTEGER PRIMARY KEY,
  rad_id        TEXT    NOT NULL REFERENCES rad (rad_id),
  kunde_id      INTEGER NOT NULL REFERENCES kunde (kunde_id),
  start_station INTEGER NOT NULL REFERENCES station (station_id),
  ziel_station  INTEGER NOT NULL REFERENCES station (station_id),
  start_zeit    TEXT    NOT NULL,
  dauer_min     INTEGER NOT NULL,
  preis_eur     REAL    NOT NULL
) STRICT;

CREATE VIEW fahrt_mit_typ AS
SELECT f.*, r.typ AS rad_typ, s.name AS start_name, z.name AS ziel_name
FROM fahrt f
JOIN rad     r ON r.rad_id = f.rad_id
JOIN station s ON s.station_id = f.start_station
JOIN station z ON z.station_id = f.ziel_station;
"""


def lade_export(pfad: Path) -> dict:
    """Liest den JSON-Export. encoding="utf-8" ausdruecklich – unter Windows
    ist die Voreinstellung sonst cp1252 (Lab 05)."""
    with open(pfad, encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    export = lade_export(QUELLE)

    # Frisch beginnen: connect() legt die Datei an, wenn sie fehlt. Eine alte
    # Datei wuerde beim zweiten Lauf mit "UNIQUE constraint failed" abbrechen.
    if ZIEL.exists():
        ZIEL.unlink()

    con = sqlite3.connect(ZIEL)
    # Fremdschluessel gelten in SQLite nur, wenn man sie JE VERBINDUNG einschaltet.
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(SCHEMA)

    # Aus dem verschachtelten Export werden flache Zeilen (Lab 05: normalisieren).
    # Die Raeder haengen im JSON unter ihrer Station – daraus wird heimstation.
    stationen = [
        (s["station_id"], s["name"], s["bezirk"], s["plaetze"], s["eroeffnet"])
        for s in export["stationen"]
    ]
    raeder = [
        (r["rad_id"], r["typ"], r["baujahr"], s["station_id"], r["status"])
        for s in export["stationen"]
        for r in s["raeder"]
    ]
    kunden = [
        (k["kunde_id"], k["tarif"], k["registriert"], k["bezirk"])
        for k in export["kunden"]
    ]
    # start.zeit steht im Export als 2025-10-05T07:58:00; in der Datenbank
    # verwenden wir das Format mit Leerzeichen, das strftime() ebenso liest.
    fahrten = [
        (
            f["fahrt_id"], f["rad_id"], f["kunde_id"],
            f["start"]["station_id"], f["ziel"]["station_id"],
            f["start"]["zeit"].replace("T", " "),
            f["dauer_min"], f["preis_eur"],
        )
        for f in export["fahrten"]
    ]

    # with con: eine Transaktion – am Ende commit, bei einer Ausnahme rollback.
    # ?-Platzhalter statt f-Strings: SQLite setzt die Werte ein, nie Textbau.
    with con:
        con.executemany("INSERT INTO station VALUES (?, ?, ?, ?, ?)", stationen)
        con.executemany("INSERT INTO rad     VALUES (?, ?, ?, ?, ?)", raeder)
        con.executemany("INSERT INTO kunde   VALUES (?, ?, ?, ?)", kunden)
        con.executemany("INSERT INTO fahrt   VALUES (?, ?, ?, ?, ?, ?, ?, ?)", fahrten)

    # Kontrollabfrage: Zeilen nach Spaltennamen ansprechen statt nach Position.
    con.row_factory = sqlite3.Row
    print(f"{'rad_typ':8}{'fahrten':>8}{'umsatz':>10}")
    for zeile in con.execute(
        "SELECT rad_typ, count(*) AS fahrten, round(sum(preis_eur), 2) AS umsatz "
        "FROM fahrt_mit_typ GROUP BY rad_typ ORDER BY umsatz DESC"
    ):
        print(f"{zeile['rad_typ']:8}{zeile['fahrten']:>8}{zeile['umsatz']:>10.2f}")
    print(f"SQLite {sqlite3.sqlite_version} – Datei: {ZIEL.resolve()}")

    # with con schliesst NICHT – das macht erst close(). Solange die Verbindung
    # offen ist, sieht ein zweites Programm womoeglich "database is locked".
    con.close()


if __name__ == "__main__":
    main()
