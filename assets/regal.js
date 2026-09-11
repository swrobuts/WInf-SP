/**
 * WInf-SP-Lab · Regal-Simulator (Power BI / Tableau)
 *
 * Reine Logik ohne DOM: Aus einer kleinen Tabelle und einer Regalbelegung
 * entsteht das aggregierte Ergebnis, das ein BI-Werkzeug zeichnen wuerde.
 * Die Zeichnung selbst macht winf.js; die Pruefung, ob eine Belegung dem
 * Auftrag entspricht, steht hier und laeuft auch im Abnahmelauf.
 *
 * Eine Belegung sieht so aus:
 *   { spalten: ['bezirk'], zeilen: [{ feld: 'preis_eur', agg: 'SUM' }],
 *     farbe: 'rad_typ', filter: { rad_typ: ['EBIKE'] } }
 *
 * Felder sind entweder Dimensionen (diskrete Werte: Text, Datum, Kennung)
 * oder Kennzahlen (Zahlen, die sich aggregieren lassen). Eine Dimension auf
 * dem Zeilenregal ist erlaubt - sie ergibt dann eine Tabelle statt eines
 * Balkendiagramms, wie im echten Werkzeug auch.
 */

export const AGGREGATE = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX']

function aggregiere (werte, agg) {
  const zahlen = werte.filter(v => v !== null && v !== undefined && v !== '').map(Number)
  if (agg === 'COUNT') return werte.length
  if (!zahlen.length) return null
  if (agg === 'SUM') return zahlen.reduce((s, v) => s + v, 0)
  if (agg === 'AVG') return zahlen.reduce((s, v) => s + v, 0) / zahlen.length
  if (agg === 'MIN') return Math.min(...zahlen)
  if (agg === 'MAX') return Math.max(...zahlen)
  return null
}

/** Wendet die Filter an: je Feld eine Liste erlaubter Werte. */
export function gefiltert (daten, filter = {}) {
  const eintraege = Object.entries(filter).filter(([, werte]) => Array.isArray(werte) && werte.length)
  if (!eintraege.length) return daten
  return daten.filter(z => eintraege.every(([feld, werte]) => werte.map(String).includes(String(z[feld]))))
}

/**
 * Berechnet die Ergebnistabelle: eine Zeile je Kombination der Dimensionen
 * auf Spalten, Zeilen und Farbe; je Kennzahl ein aggregierter Wert.
 *
 * @returns { dimensionen: [feld...], kennzahlen: [{feld, agg, titel}], zeilen: [{ schluessel: {...}, werte: {...} }] }
 */
export function ergebnis (daten, felder, belegung) {
  const typ = (f) => felder.find(x => x.id === f)?.typ
  const dims = []
  const kenn = []
  const einordnen = (eintrag, regal) => {
    const feld = typeof eintrag === 'string' ? eintrag : eintrag.feld
    if (!feld) return
    if (typ(feld) === 'kennzahl') kenn.push({ feld, agg: (typeof eintrag === 'object' && eintrag.agg) || 'SUM', regal })
    else if (!dims.some(d => d.feld === feld)) dims.push({ feld, regal })
  }
  for (const e of belegung.spalten || []) einordnen(e, 'spalten')
  for (const e of belegung.zeilen || []) einordnen(e, 'zeilen')
  if (belegung.farbe) einordnen(belegung.farbe, 'farbe')

  const gruppen = new Map()
  for (const z of gefiltert(daten, belegung.filter)) {
    const schluessel = dims.map(d => z[d.feld])
    const k = JSON.stringify(schluessel)
    if (!gruppen.has(k)) gruppen.set(k, { schluessel: Object.fromEntries(dims.map((d, i) => [d.feld, schluessel[i]])), roh: [] })
    gruppen.get(k).roh.push(z)
  }
  const zeilen = [...gruppen.values()].map(g => ({
    schluessel: g.schluessel,
    werte: Object.fromEntries(kenn.map(k => [`${k.agg}(${k.feld})`, aggregiere(g.roh.map(z => z[k.feld]), k.agg)]))
  }))
  // Sortierung: Dimensionen mit vorgegebener Reihenfolge (z. B. Monate) danach, sonst alphabetisch.
  const ordnung = (feld) => felder.find(x => x.id === feld)?.reihenfolge
  zeilen.sort((a, b) => {
    for (const d of dims) {
      const o = ordnung(d.feld)
      const va = a.schluessel[d.feld]; const vb = b.schluessel[d.feld]
      const ia = o ? o.indexOf(va) : -1; const ib = o ? o.indexOf(vb) : -1
      const c = (o && ia >= 0 && ib >= 0) ? ia - ib : String(va).localeCompare(String(vb), 'de')
      if (c) return c
    }
    return 0
  })
  return {
    dimensionen: dims,
    kennzahlen: kenn.map(k => ({ ...k, titel: `${k.agg}(${k.feld})` })),
    zeilen
  }
}

/**
 * Welche Darstellung ergibt die Belegung? Dieselbe Entscheidung, die
 * "Show Me" in Tableau bzw. die Standardvisualisierung in Power BI trifft.
 *   leer      nichts belegt
 *   tabelle   nur Dimensionen, oder Kennzahl ohne Dimension
 *   balken    Dimension auf einer Achse, Kennzahl auf der anderen
 *   linie     dasselbe mit einer geordneten Dimension (Datum, Monat, Stunde)
 */
export function darstellung (felder, belegung) {
  const typ = (f) => felder.find(x => x.id === (typeof f === 'string' ? f : f?.feld))
  const sp = (belegung.spalten || []).map(typ).filter(Boolean)
  const ze = (belegung.zeilen || []).map(typ).filter(Boolean)
  if (!sp.length && !ze.length) return 'leer'
  const dimsSp = sp.filter(f => f.typ !== 'kennzahl'); const kennSp = sp.filter(f => f.typ === 'kennzahl')
  const dimsZe = ze.filter(f => f.typ !== 'kennzahl'); const kennZe = ze.filter(f => f.typ === 'kennzahl')
  if ((dimsSp.length && kennZe.length) || (dimsZe.length && kennSp.length)) {
    const dim = dimsSp[0] || dimsZe[0]
    return dim.geordnet ? 'linie' : 'balken'
  }
  return 'tabelle'
}

/** Ein Soll-Eintrag kann 'feld' oder 'AGG:feld' sein. */
function sollPasst (eintrag, soll) {
  if (typeof soll !== 'string') return false
  const [agg, feld] = soll.includes(':') ? soll.split(':') : [null, soll]
  const istFeld = typeof eintrag === 'string' ? eintrag : eintrag?.feld
  const istAgg = typeof eintrag === 'object' ? (eintrag.agg || 'SUM') : 'SUM'
  return istFeld === feld && (!agg || istAgg === agg)
}

/**
 * Entspricht die Belegung dem Auftrag? Gibt die Liste der Abweichungen
 * zurueck; leer heisst erfuellt. Regale, die der Auftrag nicht nennt,
 * muessen leer sein - sonst gaelte jedes Diagramm mit dem richtigen Kern
 * als geloest, auch wenn drei ueberfluessige Felder daraufliegen.
 */
export function abweichungen (belegung, ziel) {
  const fehler = []
  for (const regal of ['spalten', 'zeilen']) {
    const ist = belegung[regal] || []
    const soll = ziel[regal] || []
    // Reihenfolge auf dem Regal ist gleichgueltig; Menge und Aggregation nicht.
    if (ist.length !== soll.length || !soll.every(s => ist.some(e => sollPasst(e, s)))) {
      fehler.push({ regal, text: { de: `Regal „${regal === 'spalten' ? 'Spalten' : 'Zeilen'}“ stimmt nicht.`, en: `Shelf “${regal === 'spalten' ? 'columns' : 'rows'}” is not right.` } })
    }
  }
  const farbeIst = belegung.farbe || null
  const farbeSoll = ziel.farbe || null
  if (farbeIst !== farbeSoll) fehler.push({ regal: 'farbe', text: { de: 'Das Farbregal stimmt nicht.', en: 'The colour shelf is not right.' } })
  if (ziel.filter) {
    for (const [feld, werte] of Object.entries(ziel.filter)) {
      const ist = (belegung.filter || {})[feld] || []
      const gleich = ist.length === werte.length && werte.every(w => ist.map(String).includes(String(w)))
      if (!gleich) fehler.push({ regal: 'filter', text: { de: `Der Filter auf ${feld} stimmt nicht.`, en: `The filter on ${feld} is not right.` } })
    }
  }
  const filterIst = Object.entries(belegung.filter || {}).filter(([, w]) => w && w.length).map(([f]) => f)
  for (const f of filterIst) {
    if (!ziel.filter || !(f in ziel.filter)) fehler.push({ regal: 'filter', text: { de: `Ein Filter auf ${f} ist nicht verlangt.`, en: `A filter on ${f} is not asked for.` } })
  }
  return fehler
}
