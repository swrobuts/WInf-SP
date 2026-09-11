/**
 * WInf-SP-Lab · Pruefung der Terminalschritte
 *
 * Hier steht die ganze Logik, die entscheidet, ob ein Schritt einer
 * Terminaluebung erledigt ist. Sie liegt bewusst in einer eigenen Datei ohne
 * DOM-Bezug: So laeuft dieselbe Pruefung im Browser und im Testlauf auf der
 * Kommandozeile (`tools/verify.mjs`). Was auf der Kommandozeile besteht,
 * besteht auch im Browser.
 *
 * Zwei Regeln tragen das Ganze:
 *
 *   1. Es wird immer nur der erste offene Schritt geprueft. Ohne diese Regel
 *      gelten spaetere Schritte als erledigt, sobald ihr Zustand zufaellig
 *      einmal passt - "Zurueck ins Heimatverzeichnis" waere schon vor dem
 *      ersten Wechsel erfuellt.
 *   2. Ein Schritt ohne Muster verlangt eine Aenderung: Er zaehlt erst, wenn
 *      dieser Befehl den Zustand hergestellt hat, nicht wenn er ohnehin schon
 *      galt.
 */

/** Host- und Container-Port ohne die vorangestellte Bindungsadresse. */
const portPaar = (p) => (p || '').split(':').slice(-2).join(':')

/**
 * Prueft eine deklarative Bedingung gegen die Welt. Absichtlich klein
 * gehalten: Es geht darum, ob ein Ziel erreicht ist, nicht darum, auf
 * welchem Weg.
 */
export function zustandTrifft (welt, z) {
  if (!z) return true
  if (z.pfad != null && welt.pfad.join('/') !== z.pfad) return false
  if (z.datei) {
    const teile = z.datei.split('/')
    let k = welt.wurzel
    for (const t of teile) {
      if (!k || k.typ !== 'ordner' || !k.kinder[t]) return false
      k = k.kinder[t]
    }
    if (z.dateiTyp && k.typ !== z.dateiTyp) return false
  }
  if (z.gitRepo && !welt.git) return false
  const zweig = welt.git ? welt.git.zweige[welt.git.zweig] : null
  if (z.gitCommits != null && (zweig?.commits.length || 0) < z.gitCommits) return false
  if (z.gitZweig && welt.git?.zweig !== z.gitZweig) return false
  if (z.gitIndexLeer && welt.git && welt.git.index.length) return false
  if (z.gitIndexGefuellt && !(welt.git && welt.git.index.length)) return false
  if (z.gitVeroeffentlicht && (!zweig || !zweig.commits.length || zweig.gepusht < zweig.commits.length)) return false
  if (z.containerLaeuft && !welt.docker.container.some(c => c.name === z.containerLaeuft && c.laeuft)) return false
  if (z.containerWeg && welt.docker.container.some(c => c.name === z.containerWeg)) return false
  if (z.volumen && !welt.docker.volumen.includes(z.volumen)) return false
  if (z.abbild && !welt.docker.abbilder.some(a => a.voll === z.abbild || a.name === z.abbild)) return false
  // `-p 127.0.0.1:5432:5432` ist dieselbe Abbildung wie `-p 5432:5432`, nur
  // enger gebunden - die Befehlskarten lehren die engere Fassung.
  if (z.portGebunden && !welt.docker.container.some(c =>
    c.laeuft && portPaar(c.port) === portPaar(z.portGebunden))) return false
  if (z.umgebung && !welt.docker.container.some(c =>
    (c.umgebung || []).some(e => e.startsWith(z.umgebung)))) return false
  if (z.bandAn && !welt.docker.container.some(c =>
    (c.baender || []).some(b => b.startsWith(z.bandAn + ':')))) return false
  return true
}

/**
 * Ist dieser Schritt durch die eingegebene Zeile erledigt?
 *
 * @param welt     Zustand NACH der Ausfuehrung
 * @param schritt  Schrittdefinition mit `muster` und/oder `zustand`
 * @param zeile    die eingetippte Zeile
 * @param vorher   galt `schritt.zustand` schon VOR dieser Zeile?
 */
export function schrittErfuellt (welt, schritt, zeile, vorher) {
  if (schritt.muster && !new RegExp(schritt.muster, 'i').test(zeile)) return false
  if (schritt.zustand) {
    if (!zustandTrifft(welt, schritt.zustand)) return false
    if (!schritt.muster && vorher) return false
  }
  return true
}
