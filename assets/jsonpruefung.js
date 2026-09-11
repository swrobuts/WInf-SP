/**
 * WInf-SP-Lab · Pruefung von JSON-Uebungen
 *
 * Reine Logik ohne DOM, damit dieselbe Pruefung im Browser und im
 * Abnahmelauf (tools/verify.mjs) laeuft.
 *
 * Eine JSON-Uebung wird auf zwei Arten geprueft:
 *
 *   erwartet   Der eingegebene Text muss, geparst, demselben Wert entsprechen
 *              (Schluesselreihenfolge gleichgueltig, Feldreihenfolge nicht).
 *   regeln     Eine Liste von Bedingungen an Stellen im Dokument, adressiert
 *              als JSON Pointer (RFC 6901): "/stationen/0/name".
 *
 * Der Parsefehler des Browsers wird unveraendert weitergereicht - so lernen
 * Studierende die Meldung kennen, die sie draussen auch sehen - und um einen
 * uebersetzten Hinweis auf die haeufigste Ursache ergaenzt.
 */

/** JSON Pointer aufloesen; undefined, wenn der Pfad nicht existiert. */
export function zeiger (wert, pfad) {
  if (pfad === '' || pfad === '/') return wert
  const teile = pfad.split('/').slice(1).map(t => t.replace(/~1/g, '/').replace(/~0/g, '~'))
  let k = wert
  for (const t of teile) {
    if (k === null || typeof k !== 'object') return undefined
    if (Array.isArray(k)) {
      if (!/^\d+$/.test(t)) return undefined
      k = k[Number(t)]
    } else {
      if (!Object.prototype.hasOwnProperty.call(k, t)) return undefined
      k = k[t]
    }
    if (k === undefined) return undefined
  }
  return k
}

/** Der JSON-Typname eines Werts, wie ihn die Norm unterscheidet. */
export function typVon (w) {
  if (w === null) return 'null'
  if (Array.isArray(w)) return 'array'
  return typeof w === 'object' ? 'object' : typeof w
}

/** Tiefer Vergleich: Objekte ohne Ruecksicht auf die Reihenfolge, Felder mit. */
export function gleich (a, b) {
  if (typVon(a) !== typVon(b)) return false
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => gleich(x, b[i]))
  if (a !== null && typeof a === 'object') {
    const ka = Object.keys(a).sort(); const kb = Object.keys(b).sort()
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && gleich(a[k], b[k]))
  }
  return a === b
}

/**
 * Versucht, aus der Parsermeldung und dem Text die wahrscheinliche Ursache
 * zu erraten. Die Meldung selbst bleibt sichtbar; der Hinweis kommt dazu.
 */
export function ursacheRaten (text, meldung) {
  const t = text
  if (/^﻿/.test(t)) return 'bom'
  if (/'[^']*'\s*:/.test(t) || /:\s*'[^']*'/.test(t)) return 'einfacheAnfuehrung'
  if (/,\s*[}\]]/.test(t)) return 'nachkomma'
  if (/(^|[{,])\s*[A-Za-z_][A-Za-z0-9_]*\s*:/.test(t)) return 'schluesselOhneAnfuehrung'
  if (/\/\/|\/\*/.test(t)) return 'kommentar'
  if (/:\s*(undefined|NaN|Infinity)\b/.test(t)) return 'keinJsonWert'
  if (/:\s*(True|False|None)\b/.test(t)) return 'pythonLiteral'
  if (/[}\]]\s*[{\[]/.test(t) || /"\s*"/.test(t.replace(/\s/g, ''))) return 'kommaFehlt'
  if (/Unexpected end|Unexpected EOF|end of data|end of JSON input/i.test(meldung)) return 'unvollstaendig'
  return null
}

/**
 * Prueft einen eingegebenen Text gegen eine Uebung.
 *
 * @returns { ok, geparst, meldung, ursache, befunde: [{pfad, text}] }
 *   meldung  die unveraenderte Parsermeldung (nur bei Syntaxfehler)
 *   befunde  je verletzter Regel ein Eintrag mit zweisprachigem Text
 */
export function pruefeJson (text, uebung) {
  let geparst
  try {
    geparst = JSON.parse(text)
  } catch (e) {
    return { ok: false, geparst: undefined, meldung: e.message, ursache: ursacheRaten(text, e.message), befunde: [] }
  }
  const befunde = []
  if (uebung.erwartet !== undefined) {
    if (!gleich(geparst, uebung.erwartet)) {
      befunde.push({ pfad: '', text: { de: 'Der Wert entspricht nicht dem erwarteten Dokument.', en: 'The value does not match the expected document.' } })
    }
  }
  for (const r of uebung.regeln || []) {
    const w = zeiger(geparst, r.pfad)
    const verletzt = (text) => befunde.push({ pfad: r.pfad, text: r.text || text })
    if (r.vorhanden === false) { if (w !== undefined) verletzt({ de: `${r.pfad} darf nicht vorkommen.`, en: `${r.pfad} must not be present.` }); continue }
    if (w === undefined) { verletzt({ de: `${r.pfad} fehlt.`, en: `${r.pfad} is missing.` }); continue }
    if (r.typ && typVon(w) !== r.typ) { verletzt({ de: `${r.pfad} muss vom Typ ${r.typ} sein, ist aber ${typVon(w)}.`, en: `${r.pfad} must be of type ${r.typ} but is ${typVon(w)}.` }); continue }
    if (r.wert !== undefined && !gleich(w, r.wert)) verletzt({ de: `${r.pfad} hat nicht den erwarteten Wert.`, en: `${r.pfad} does not have the expected value.` })
    if (r.laenge !== undefined && (w?.length ?? Object.keys(w).length) !== r.laenge) verletzt({ de: `${r.pfad} muss genau ${r.laenge} Einträge haben.`, en: `${r.pfad} must have exactly ${r.laenge} entries.` })
    if (r.mindestens !== undefined && (w?.length ?? Object.keys(w).length) < r.mindestens) verletzt({ de: `${r.pfad} muss mindestens ${r.mindestens} Einträge haben.`, en: `${r.pfad} must have at least ${r.mindestens} entries.` })
    if (r.muster !== undefined && !(typeof w === 'string' && new RegExp(r.muster).test(w))) verletzt({ de: `${r.pfad} hat nicht die erwartete Form.`, en: `${r.pfad} does not have the expected form.` })
    if (r.schluessel) {
      const fehlend = r.schluessel.filter(k => !(w && typeof w === 'object' && !Array.isArray(w) && k in w))
      if (fehlend.length) verletzt({ de: `${r.pfad}: Schlüssel fehlen: ${fehlend.join(', ')}.`, en: `${r.pfad}: keys missing: ${fehlend.join(', ')}.` })
    }
    if (r.jedes) {
      // Regel fuer jedes Element eines Feldes: gleiche Felder wie oben.
      const liste = Array.isArray(w) ? w : []
      liste.forEach((e, i) => {
        const teil = pruefeJson(JSON.stringify(e), { regeln: r.jedes.map(x => ({ ...x, pfad: x.pfad || '' })) })
        for (const b of teil.befunde) befunde.push({ pfad: `${r.pfad}/${i}${b.pfad}`, text: b.text })
      })
    }
  }
  return { ok: befunde.length === 0, geparst, meldung: null, ursache: null, befunde }
}
