"""velocity-api – Kennzahlen der Fallstudie Velo City als JSON (WInf-SP-Lab 11)."""
import os

import psycopg
from fastapi import FastAPI, Query

DATENBANK = os.environ["DATABASE_URL"]  # bewusst ohne Default – Erklärung direkt darunter

# Warum os.environ["…"] und nicht os.environ.get("…", "irgendein Default")?
# Fehlt die Variable, bricht der Start sofort ab – bei Render im Protokoll
# als
#   KeyError: 'DATABASE_URL'
#   ==> Exited with status 1
# Das ist gewollt: Der Fehler steht dort, wo er entstanden ist. Ein Default
# wie "sqlite:///lokal.db" würde ihn verstecken – der Dienst ginge online
# und antwortete mit leeren oder falschen Daten.
#
# Woher der Wert kommt:
#   lokal   aus der Datei .env (steht in .gitignore, Lab 02):
#             uvicorn main:app --reload --env-file .env
#   Render  aus „Environment Variables“ des Web Service – die .env-Datei
#           liegt nicht im Repository, Render kennt sie nicht.
# Der Wert ist die Zeichenkette des Session Poolers aus dem Connect-Dialog
# von Supabase (Lab 08): Port 5432, Benutzer postgres.[REF], am Ende
# ?sslmode=require.

app = FastAPI(title="velocity-api", version="1.0")


def abfrage(sql: str, parameter: tuple = ()) -> list[dict]:
    """Führt eine Abfrage aus und liefert je Zeile ein dict (Spaltenname → Wert).

    Je Anfrage eine Verbindung: einfach, und für einen Free-Dienst mit wenigen
    Aufrufen ausreichend. Der with-Block schließt die Verbindung auch dann,
    wenn die Abfrage scheitert.
    """
    with psycopg.connect(DATENBANK) as verbindung:
        with verbindung.cursor() as cursor:
            cursor.execute(sql, parameter)
            spalten = [s.name for s in cursor.description]
            return [dict(zip(spalten, zeile)) for zeile in cursor.fetchall()]


@app.get("/")
def status() -> dict:
    """Health Check Path: antwortet 200, sobald der Prozess läuft – ohne Datenbankzugriff."""
    return {"dienst": "velocity-api", "status": "ok"}


@app.get("/stationen")
def stationen() -> list[dict]:
    """Alle Stationen des Leihradsystems."""
    return abfrage(
        "SELECT station_id, name, bezirk, plaetze, eroeffnet "
        "FROM station ORDER BY station_id"
    )


@app.get("/fahrten")
def fahrten(limit: int = Query(20, ge=1, le=200)) -> list[dict]:
    """Die jüngsten Fahrten; ?limit=50 ändert die Anzahl (höchstens 200)."""
    return abfrage(
        "SELECT fahrt_id, rad_id, rad_typ, start_name, ziel_name, "
        "       start_zeit, dauer_min, preis_eur "
        "FROM fahrt_mit_typ ORDER BY start_zeit DESC LIMIT %s",
        (limit,),
    )


@app.get("/kennzahlen")
def kennzahlen() -> list[dict]:
    """Fahrten und Umsatz je Radtyp – dieselbe Abfrage wie in Lab 08, Übung W08-02."""
    return abfrage(
        "SELECT rad_typ, count(*) AS fahrten, sum(preis_eur) AS umsatz "
        "FROM fahrt_mit_typ GROUP BY rad_typ ORDER BY umsatz DESC"
    )


# Starten – lokal wie bei Render – mit Uvicorn, nie mit „python main.py“
# (das Skript definiert nur die App; es startet keinen Server und endet sofort):
#
#   uvicorn main:app --host 0.0.0.0 --port $PORT
#
# --host 0.0.0.0   Ohne diese Angabe bindet Uvicorn an 127.0.0.1 – erreichbar
#                  nur innerhalb des eigenen Containers. Render findet dann
#                  keinen Port: „No open ports detected“.
# --port $PORT     Render setzt die Variable PORT (Standard 10000) und
#                  erwartet den Dienst genau dort. Lokal ist $PORT leer –
#                  dann --port 8000 schreiben oder PORT selbst setzen.
