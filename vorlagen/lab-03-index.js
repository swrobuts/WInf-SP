// Velo City – Radanzahl je Station (Lab 03, WebStorm)
//
// Liest dieselbe Datei wie main.py (data/velocity-kostprobe.json) und gibt
// je Station die Zahl der Räder aus. Starten über das npm-Tool-Window
// (Script „start“) oder im Terminal mit: npm start

const fs = require("node:fs");
const path = require("node:path");

// Pfad relativ zur Skriptdatei – __dirname ist der Ordner, in dem index.js liegt.
const DATEI = path.join(__dirname, "data", "velocity-kostprobe.json");

function ladeExport(pfad) {
  // JSON.parse ist der Gegenpart zu json.load in Python.
  return JSON.parse(fs.readFileSync(pfad, "utf8"));
}

function raederJeStation(exportDaten) {
  // Eine Zeile je Station; die Radanzahl ist die Länge der inneren Liste.
  return exportDaten.stationen.map((station) => ({
    station_id: station.station_id,
    name: station.name,
    bezirk: station.bezirk,
    raeder: station.raeder.length,
  }));
}

function main() {
  const exportDaten = ladeExport(DATEI);
  console.log(`Quelle: ${exportDaten.quelle} – exportiert am ${exportDaten.exportiert_am}`);

  const tabelle = raederJeStation(exportDaten);
  console.table(tabelle);

  const gesamt = tabelle.reduce((summe, zeile) => summe + zeile.raeder, 0);
  console.log(`${tabelle.length} Stationen, ${gesamt} Räder insgesamt`);
}

main();
