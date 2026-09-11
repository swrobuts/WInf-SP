"""
Velo City – den JSON-Export lesen und in Tabellen überführen (Lab 05).

Ablauf:
  1. Datei öffnen – immer mit encoding="utf-8"
  2. Werte über Schlüssel und Index erreichen (Umschlag → Liste → Objekt → Wert)
  3. Verschachtelte Listen mit json_normalize in Tabellen überführen
  4. Tabellen als CSV schreiben: stationen.csv und raeder.csv
  5. Ein Objekt wieder als JSON ausgeben (Umlaute, Einrückung, Datumswerte)

Aufruf:   python lab-05-json_lesen.py
Erwartet: velocity-kostprobe.json im selben Ordner (Download aus der Lernumgebung).
Braucht:  pandas (pip install pandas)
"""
import json
from datetime import date
from pathlib import Path

import pandas as pd

PFAD = Path("velocity-kostprobe.json")

# 1. Laden. Ohne encoding nimmt Windows bis Python 3.14 die Kodierung cp1252,
#    und aus "Würzburg" wird Datenmüll oder ein UnicodeDecodeError.
with open(PFAD, encoding="utf-8") as f:
    export = json.load(f)          # json.load liest eine Datei, json.loads eine Zeichenkette

# 2. Navigieren: Objekt → Schlüssel, Liste → Index (ab 0)
print(export["quelle"], "|", export["exportiert_am"], "|", export["waehrung"])
print(len(export["stationen"]), "Stationen,", len(export["kunden"]), "Kunden,",
      len(export["fahrten"]), "Fahrten")

erste = export["stationen"][0]                       # JSON Pointer: /stationen/0
print(erste["name"], "-", erste["raeder"][1]["typ"])   # JSON Pointer: /stationen/0/raeder/1/typ

# Ein Schlüssel, der fehlen darf: .get liefert None statt eines KeyError.
print("Zielzeit der ersten Fahrt:", export["fahrten"][0]["ziel"].get("zeit"))

# 3a. Stationen als Tabelle: eine Zeile je Station. Die Liste raeder passt in
#     keine Zelle einer CSV-Datei – sie wird zur eigenen Tabelle (3b).
stationen = pd.json_normalize(export["stationen"]).drop(columns="raeder")

# 3b. Räder: record_path nennt die Liste, die zu Zeilen wird; meta nennt die
#     Felder des Elternobjekts, die auf jeder Zeile wiederholt werden.
#     station_id ist damit der Fremdschlüssel auf stationen – genau das Schema
#     der Tabellen station und rad in Lab 06.
raeder = pd.json_normalize(export["stationen"], record_path="raeder", meta=["station_id", "name"])
raeder = raeder.rename(columns={"name": "station_name"})

# 3c. Fahrten: Unterobjekte werden zu Punktspalten (start.station_id, start.zeit, ziel.station_id).
fahrten = pd.json_normalize(export["fahrten"])
fahrten = fahrten.rename(columns={"start.station_id": "start_station",
                                  "start.zeit": "start_zeit",
                                  "ziel.station_id": "ziel_station"})

print(stationen.head(3).to_string())
print(raeder.head(3).to_string())
print(fahrten.head(3).to_string())

# 4. Schreiben. index=False lässt die Zeilennummer weg; encoding="utf-8" auch beim Schreiben.
stationen.to_csv("stationen.csv", index=False, encoding="utf-8")
raeder.to_csv("raeder.csv", index=False, encoding="utf-8")
print("geschrieben: stationen.csv", stationen.shape, "raeder.csv", raeder.shape)

# 5. Zurück nach JSON. ensure_ascii=False erhält Umlaute, indent=2 rückt ein,
#    default=str wandelt Werte, die JSON nicht kennt (date, datetime, Decimal), in Zeichenketten.
zusammenfassung = {
    "quelle": export["quelle"],
    "ausgewertet_am": date.today(),         # ohne default=str: TypeError: Object of type date is not JSON serializable
    "stadt": "Würzburg",
    "stationen": len(stationen),
    "raeder_je_typ": raeder["typ"].value_counts().to_dict(),
}
print(json.dumps(zusammenfassung, ensure_ascii=False, indent=2, default=str))
