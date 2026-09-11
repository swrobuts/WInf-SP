"""Velo City – Stationen mit Radanzahl.

Erstes Skript im PyCharm-Projekt „velocity“ (Lab 03). Es liest den
JSON-Export der Kostprobe (data/velocity-kostprobe.json, drei Stationen)
und gibt je Station aus, wie viele Räder dort stehen.

Läuft es, stimmen drei Dinge auf einmal: der Interpreter ist gesetzt,
pandas ist in genau diesem Interpreter installiert, und das Working
directory zeigt auf den Projektordner.
"""

import json
from pathlib import Path

import pandas as pd

# Pfad relativ zur Skriptdatei, nicht zum Arbeitsverzeichnis – so findet
# das Skript die Datei unabhängig davon, von wo es gestartet wird.
DATEI = Path(__file__).parent / "data" / "velocity-kostprobe.json"


def lade_export(pfad: Path) -> dict:
    """Liest die JSON-Datei und gibt das Dokument als dict zurück."""
    with pfad.open(encoding="utf-8") as datei:
        return json.load(datei)


def raeder_je_station(export: dict) -> pd.DataFrame:
    """Klappt die verschachtelte Liste „raeder“ auf und zählt je Station.

    json_normalize erzeugt eine Zeile je Rad; die Stationsfelder aus
    „meta“ werden in jeder Zeile wiederholt. Danach wird gruppiert.
    """
    raeder = pd.json_normalize(
        export["stationen"],
        record_path="raeder",                    # die innere Liste
        meta=["station_id", "name", "bezirk"],   # Felder der äußeren Ebene
    )
    return (
        raeder.groupby(["station_id", "name", "bezirk"])
        .size()
        .reset_index(name="raeder")
        .sort_values("station_id")
    )


def main() -> None:
    export = lade_export(DATEI)
    print(f"Quelle: {export['quelle']} – exportiert am {export['exportiert_am']}")
    print()

    tabelle = raeder_je_station(export)
    print(tabelle.to_string(index=False))
    print()
    print(f"{len(tabelle)} Stationen, {int(tabelle['raeder'].sum())} Räder insgesamt")


if __name__ == "__main__":
    main()
