"""Velo City – Extract, (leichtes) Transform, Load.

Lab 10 der WInf-SP-Lab. Das Skript holt den verschachtelten JSON-Export
(Lab 05), klappt ihn mit pandas in vier flache Tabellen auf, setzt Typen
und Zeitzonen richtig, entfernt Duplikate und lädt das Ergebnis

  1. in eine SQLite-Datei als Staging auf dem Laptop (Lab 06) und
  2. in das Schema "staging" einer Postgres-Datenbank (Supabase, Lab 08).

Die fachliche Umformung zum Sternschema passiert danach in SQL, in der
Zieldatenbank: vorlagen/lab-10-sternschema.sql. Das Muster heißt EtLT:
kleines t vor dem Laden (Typen, Zeitzone, Duplikate), großes T danach.

Das Skript ist wiederholbar: Jeder Lauf ersetzt die Staging-Tabellen
vollständig (if_exists="replace"). Duplikate durch mehrfaches Ausführen
entstehen so nicht.

Voraussetzungen (requirements.txt):
    pandas  sqlalchemy  "psycopg[binary]"  python-dotenv  requests

Aufruf:
    python lab-10-etl.py
Die Zugangsdaten kommen aus der Datei .env (siehe lab-10-env.example),
nie aus dem Quelltext.
"""

import json
import logging
import os
import sys
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv
from sqlalchemy import DateTime, Numeric, create_engine, text

# ------------------------------------------------------------------ Setup

# .env in die Umgebung laden. Vorhandene Variablen werden nicht
# überschrieben – auf einem Server (Lab 11) gewinnt also das Dashboard.
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("etl")

QUELLE = os.getenv("VELOCITY_QUELLE", "data/velocity.json")
STAGING_DB = os.getenv("STAGING_DB", "sqlite:///velocity-staging.db")
DATABASE_URL = os.getenv("DATABASE_URL")          # None, wenn nicht gesetzt
ZEITZONE_QUELLE = "Europe/Berlin"                 # die Zeiten im Export sind Ortszeit


# ---------------------------------------------------------------- Extract

def extract(quelle: str) -> dict:
    """Liest den Export aus einer Datei oder von einer URL – unverändert."""
    if quelle.startswith(("http://", "https://")):
        antwort = requests.get(quelle, timeout=30)
        antwort.raise_for_status()               # 4xx/5xx wird zum Fehler
        export = antwort.json()
    else:
        with Path(quelle).open(encoding="utf-8") as datei:
            export = json.load(datei)
    log.info(
        "Extract: %s – Quelle %r, exportiert am %s",
        quelle, export.get("quelle"), export.get("exportiert_am"),
    )
    return export


# -------------------------------------------------------------- Transform

def transform(export: dict, quelle: str) -> dict[str, pd.DataFrame]:
    """Klappt das verschachtelte Dokument in vier flache Tabellen auf.

    Hier passiert nur das leichte t: Struktur, Typen, Zeitzone, Duplikate.
    Fachliche Logik (Sternschema, Kennzahlen) gehört in SQL, siehe
    lab-10-sternschema.sql.
    """
    loaded_at = pd.Timestamp.now(tz="UTC")       # ein Zeitstempel je Lauf
    source_file = Path(quelle).name

    # Stationen: die innere Liste "raeder" wird zu einer eigenen Tabelle.
    station = pd.json_normalize(export["stationen"]).drop(columns=["raeder"])
    station = station.astype({"station_id": "int64", "plaetze": "int64"})
    station["eroeffnet"] = pd.to_datetime(station["eroeffnet"]).dt.date

    # Räder: eine Zeile je Rad, die Station der äußeren Ebene wird wiederholt.
    rad = pd.json_normalize(
        export["stationen"], record_path="raeder", meta=["station_id"]
    ).rename(columns={"station_id": "heimstation"})
    rad = rad.astype({"baujahr": "int64", "heimstation": "int64"})

    kunde = pd.json_normalize(export["kunden"]).astype({"kunde_id": "int64"})
    kunde["registriert"] = pd.to_datetime(kunde["registriert"]).dt.date

    # Fahrten: verschachtelte Felder werden zu start_station_id, start_zeit,
    # ziel_station_id (sep="_" statt des Standards ".").
    fahrt = pd.json_normalize(export["fahrten"], sep="_")
    fahrt = fahrt.astype({
        "fahrt_id": "int64", "kunde_id": "int64", "dauer_min": "int64",
        "start_station_id": "int64", "ziel_station_id": "int64",
    })

    # Zeitzone: Der Export enthält naive Ortszeiten ("2025-10-05T07:58:00").
    # Erst als Europe/Berlin kennzeichnen, dann nach UTC umrechnen – so
    # steht in der Datenbank ein eindeutiger Zeitpunkt (timestamptz).
    # to_datetime(..., utc=True) allein wäre hier FALSCH: Es würde die
    # Ortszeit als UTC lesen und alles um ein bis zwei Stunden verschieben.
    fahrt["start_zeit"] = (
        pd.to_datetime(fahrt["start_zeit"])
        .dt.tz_localize(ZEITZONE_QUELLE, ambiguous="NaT", nonexistent="shift_forward")
        .dt.tz_convert("UTC")
    )
    unklar = int(fahrt["start_zeit"].isna().sum())
    if unklar:
        log.warning("Transform: %d Zeitstempel in der Umstellungsstunde nicht eindeutig", unklar)

    # Geld: zwei Nachkommastellen; in der Datenbank wird es numeric(6,2),
    # nicht double precision (siehe dtype beim Laden).
    fahrt["preis_eur"] = fahrt["preis_eur"].round(2)

    # Duplikate: kommt eine fahrt_id doppelt vor, gilt die letzte Fassung.
    vorher = len(fahrt)
    fahrt = fahrt.drop_duplicates(subset=["fahrt_id"], keep="last")
    log.info("Transform: %d Fahrten, davon %d Duplikate entfernt", vorher, vorher - len(fahrt))

    # Herkunftsspalten in jeder Staging-Tabelle: Wann und woher.
    tabellen = {"station": station, "rad": rad, "kunde": kunde, "fahrt": fahrt}
    for df in tabellen.values():
        df["loaded_at"] = loaded_at
        df["source_file"] = source_file

    # Der aware Zeitstempel des Exports: hier ist utc=True richtig, weil
    # der Wert eine Zone trägt ("+02:00") und nur umgerechnet wird.
    exportiert = pd.to_datetime(export["exportiert_am"], utc=True)
    log.info("Transform: Export vom %s (UTC)", exportiert.isoformat())

    for name, df in tabellen.items():
        log.info("Transform: %-8s %5d Zeilen, %d Spalten", name, len(df), df.shape[1])
    return tabellen


# ------------------------------------------------------------------- Load

# Spaltentypen, die pandas nicht von allein richtig wählt: Geld exakt,
# Zeitstempel mit Zeitzone. Gilt für beide Ziele.
TYPEN = {
    "fahrt": {"preis_eur": Numeric(6, 2), "start_zeit": DateTime(timezone=True)},
}


def load(tabellen: dict[str, pd.DataFrame], url: str, schema: str | None) -> None:
    """Schreibt jede Tabelle vollständig neu in die Datenbank hinter url.

    if_exists="replace" löscht die Tabelle samt Indizes und legt sie neu an.
    Für eine Staging-Schicht ist das gewollt: Sie ist eine Kopie der
    Quelle, kein Bestand, der wächst. Für Fakten- und Dimensionstabellen
    wäre es falsch – dort arbeitet lab-10-sternschema.sql mit Upserts.
    """
    engine = create_engine(url)
    if schema:
        with engine.begin() as verbindung:
            verbindung.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
    for name, df in tabellen.items():
        zeilen = df.to_sql(
            name, engine,
            schema=schema,
            if_exists="replace",
            index=False,
            chunksize=500,           # 500 Zeilen je INSERT-Paket
            method="multi",          # mehrere Zeilen je INSERT
            dtype=TYPEN.get(name),
        )
        ziel = f"{schema}.{name}" if schema else name
        log.info("Load: %-16s %5s Zeilen → %s", ziel, zeilen, engine.url.render_as_string(hide_password=True))
    engine.dispose()


# ------------------------------------------------------------------- main

def main() -> int:
    export = extract(QUELLE)
    tabellen = transform(export, QUELLE)

    # 1. Staging auf dem Laptop: SQLite kennt keine Schemata, daher schema=None.
    load(tabellen, STAGING_DB, schema=None)

    # 2. Staging in Postgres: nur, wenn DATABASE_URL gesetzt ist.
    if not DATABASE_URL:
        log.warning("Load: DATABASE_URL nicht gesetzt – Postgres übersprungen (siehe .env)")
        return 0
    load(tabellen, DATABASE_URL, schema="staging")
    log.info("Fertig. Nächster Schritt: lab-10-sternschema.sql in der Zieldatenbank ausführen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
