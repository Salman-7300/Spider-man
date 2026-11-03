/* Vermisst eine BINAERE FBX-Datei, ohne sie zu laden.

   Zwei der BUILD-2-Pakete liefern ihr Modell nur als FBX: die
   City-Props-Sammlung und der Chevy. Ein FBX im Browser zu oeffnen geht
   gar nicht, und es zu konvertieren, bevor man weiss, ob es sich lohnt,
   waere die falsche Reihenfolge.

   Das binaere FBX-Format ist eine Baumstruktur aus Datensaetzen:

     endOffset (4 bzw. 8 Byte)   Zeiger hinter diesen Datensatz
     numProperties               Zahl der Eigenschaften
     propertyListLen             Bytes der Eigenschaften
     nameLen + name              Name des Datensatzes
     Eigenschaften ...
     verschachtelte Datensaetze ...
     Nullsatz als Abschluss

   Gebraucht werden nur:
     Objects/Geometry  -> "Vertices" (Doubles) und "PolygonVertexIndex"
                          (Ints, negatives Vorzeichen = letzter Punkt
                          eines Polygons)
     Objects/Model     -> Namen und Typ
     Objects/Material  -> Materialnamen
     Objects/Texture   -> Texturpfade
     Objects/Deformer  -> Skin und Knochen

   Arrays koennen zlib-gepackt sein; node bringt zlib mit. Es wird nur
   ausgepackt, was gezaehlt werden muss - Vertices fuer die Bounding Box,
   Indizes fuer die Dreiecke.

   Aufruf:  node tools/build2-fbx.mjs <datei.fbx> [--objekte] */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function leseArray(buf, off, typ) {
  const laenge = buf.readUInt32LE(off);
  const kodierung = buf.readUInt32LE(off + 4);
  const bytes = buf.readUInt32LE(off + 8);
  let daten = buf.slice(off + 12, off + 12 + bytes);
  if (kodierung === 1) {
    try { daten = zlib.inflateSync(daten); } catch { return { werte: null, ende: off + 12 + bytes }; }
  }
  const breite = typ === 'd' ? 8 : typ === 'f' ? 4 : typ === 'l' ? 8 : 4;
  const n = Math.min(laenge, Math.floor(daten.length / breite));
  const out = typ === 'd' ? new Float64Array(n) : typ === 'f' ? new Float32Array(n)
            : typ === 'l' ? new BigInt64Array(n) : new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (typ === 'd') out[i] = daten.readDoubleLE(i * 8);
    else if (typ === 'f') out[i] = daten.readFloatLE(i * 4);
    else if (typ === 'l') out[i] = daten.readBigInt64LE(i * 8);
    else out[i] = daten.readInt32LE(i * 4);
  }
  return { werte: out, ende: off + 12 + bytes };
}

function leseEigenschaften(buf, off, anzahl) {
  const raus = [];
  for (let i = 0; i < anzahl; i++) {
    const typ = String.fromCharCode(buf[off]); off++;
    if (typ === 'Y') { raus.push(buf.readInt16LE(off)); off += 2; }
    else if (typ === 'C') { raus.push(!!buf[off]); off += 1; }
    else if (typ === 'I') { raus.push(buf.readInt32LE(off)); off += 4; }
    else if (typ === 'F') { raus.push(buf.readFloatLE(off)); off += 4; }
    else if (typ === 'D') { raus.push(buf.readDoubleLE(off)); off += 8; }
    else if (typ === 'L') { raus.push(buf.readBigInt64LE(off)); off += 8; }
    else if (typ === 'S' || typ === 'R') {
      const l = buf.readUInt32LE(off); off += 4;
      raus.push(typ === 'S' ? buf.slice(off, off + l).toString('utf8') : buf.slice(off, off + l));
      off += l;
    } else if ('fdlib'.includes(typ)) {
      const a = leseArray(buf, off, typ);
      raus.push(a.werte); off = a.ende;
    } else { raus.push(null); break; }
  }
  return { props: raus, off };
}

export function leseFbx(datei, opt) {
  const buf = fs.readFileSync(datei);
  if (buf.slice(0, 20).toString('latin1') !== 'Kaydara FBX Binary  ') {
    throw new Error('kein binaeres FBX (vielleicht ASCII-FBX?)');
  }
  const version = buf.readUInt32LE(23);
  const gross = version >= 7500;           // ab 7.5 sind die Zeiger 64 Bit
  const R = { datei: path.basename(datei), bytes: buf.length, version,
              geometrien: [], modelle: [], materialien: [], texturen: [],
              deformer: 0, knochen: [], animationen: [], dreiecke: 0, ecken: 0,
              bbox: { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] } };

  const satz = (off, pfad) => {
    const endOffset = gross ? Number(buf.readBigUInt64LE(off)) : buf.readUInt32LE(off);
    if (endOffset === 0) return { ende: 0 };
    let p = off + (gross ? 24 : 12);
    const numProps = gross ? Number(buf.readBigUInt64LE(off + 8)) : buf.readUInt32LE(off + 4);
    const propLen = gross ? Number(buf.readBigUInt64LE(off + 16)) : buf.readUInt32LE(off + 8);
    const nameLen = buf[off + (gross ? 24 : 12)];
    p = off + (gross ? 25 : 13);
    const name = buf.slice(p, p + nameLen).toString('utf8');
    p += nameLen;
    const propStart = p;
    const eigene = pfad.concat(name);
    let props = null;
    /* Eigenschaften nur dort auspacken, wo sie gebraucht werden - sonst
       zahlt man fuer jedes Array der ganzen Datei. */
    const brauchtProps = ['Vertices', 'PolygonVertexIndex', 'Geometry', 'Model',
                          'Material', 'Texture', 'RelativeFilename', 'FileName',
                          'Deformer', 'AnimationStack'].includes(name);
    if (brauchtProps && numProps > 0) props = leseEigenschaften(buf, propStart, numProps).props;
    p = propStart + propLen;

    const inObjects = pfad.includes('Objects');
    if (inObjects && name === 'Geometry' && props) {
      /* Der dritte Eintrag sagt, WAS das ist: "Mesh" ist echte
         Geometrie, "Shape" ein Blendshape-Ziel. Der erste Durchlauf hat
         beides zusammengezaehlt und fuer MikeAlger.fbx 1.033.683
         Dreiecke gemeldet - in Wahrheit sind das 50 Gesichts-
         Blendshapes, also 50 Kopien desselben Kopfes. */
      const art = (props[2] || '').toString();
      R._geo = { name: (props[1] || '').split('\0')[0], art, dreiecke: 0, ecken: 0 };
      if (art === 'Shape') { R.blendshapes = (R.blendshapes || 0) + 1; R._geo.shape = true; }
      R.geometrien.push(R._geo);
    }
    if (inObjects && name === 'Model' && props) {
      R.modelle.push({ name: (props[1] || '').split('\0')[0], typ: props[2] || null });
    }
    if (inObjects && name === 'Material' && props) {
      R.materialien.push((props[1] || '').split('\0')[0]);
    }
    if (inObjects && name === 'Texture' && props) {
      R.texturen.push((props[1] || '').split('\0')[0]);
    }
    if (inObjects && name === 'Deformer' && props) {
      R.deformer++;
      const t = (props[2] || '').toString();
      if (t === 'Cluster') R.knochen.push((props[1] || '').split('\0')[0]);
    }
    if (inObjects && name === 'AnimationStack' && props) {
      R.animationen.push((props[1] || '').split('\0')[0]);
    }
    if (name === 'Vertices' && props && props[0]) {
      const v = props[0];
      if (!(R._geo && R._geo.shape)) R.ecken += v.length / 3;
      if (R._geo) R._geo.ecken = v.length / 3;
      const lb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (let i = 0; i + 2 < v.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const w = v[i + k];
          if (w < R.bbox.min[k]) R.bbox.min[k] = w;
          if (w > R.bbox.max[k]) R.bbox.max[k] = w;
          if (w < lb.min[k]) lb.min[k] = w;
          if (w > lb.max[k]) lb.max[k] = w;
        }
      }
      if (R._geo && lb.min[0] !== Infinity) {
        R._geo.masse = [ +(lb.max[0] - lb.min[0]).toFixed(3),
                         +(lb.max[1] - lb.min[1]).toFixed(3),
                         +(lb.max[2] - lb.min[2]).toFixed(3) ];
        R._geo.unten = +lb.min[1].toFixed(3);
      }
    }
    if (name === 'PolygonVertexIndex' && props && props[0]) {
      /* Ein negativer Index markiert das ENDE eines Polygons (als
         ~index). Ein Polygon mit n Ecken sind n-2 Dreiecke. */
      const idx = props[0];
      let ecken = 0, dr = 0;
      for (let i = 0; i < idx.length; i++) {
        ecken++;
        if (idx[i] < 0) { dr += Math.max(0, ecken - 2); ecken = 0; }
      }
      if (!(R._geo && R._geo.shape)) R.dreiecke += dr;
      if (R._geo) R._geo.dreiecke = dr;
    }

    /* Verschachtelte Saetze */
    while (p + (gross ? 25 : 13) <= endOffset) {
      const k = satz(p, eigene);
      if (!k.ende) break;
      p = k.ende;
    }
    return { ende: endOffset };
  };

  let off = 27;
  while (off + (gross ? 25 : 13) < buf.length) {
    const k = satz(off, []);
    if (!k.ende) break;
    off = k.ende;
  }
  delete R._geo;
  /* ---- Namen nachtragen ----
     Manche Exporte benennen nur den Model-Satz und lassen den
     Geometry-Satz namenlos - so ist es in CityPropsCollection.fbx: 32
     Geometrien ohne Namen, 32 Modelle MIT Namen, in derselben
     Reihenfolge. Der Zusammenhang ist nicht geraten, sondern an den
     Massen geprueft: "Light" ist 0,47 x 4,15 x 0,46 m (eine
     Strassenlaterne), "FireHydrant" 0,49 x 1,13 x 0,48 m, "BusStop"
     6,26 x 3,26 x 3,95 m. Passt die Zahl der Modelle nicht zur Zahl der
     Geometrien, wird NICHTS zugeordnet - dann lieber namenlos als
     falsch benannt. */
  R.blendshapes = R.blendshapes || 0;
  R.echteGeometrien = R.geometrien.filter((x) => !x.shape);
  R.namenAusModellen = false;
  if (R.geometrien.length === R.modelle.length &&
      R.geometrien.every((g) => !g.name)) {
    R.namenAusModellen = true;
    R.geometrien.forEach((g, i) => { g.name = R.modelle[i].name; });
  }
  if (R.bbox.min[0] !== Infinity) {
    R.masse = [ +(R.bbox.max[0] - R.bbox.min[0]).toFixed(3),
                +(R.bbox.max[1] - R.bbox.min[1]).toFixed(3),
                +(R.bbox.max[2] - R.bbox.min[2]).toFixed(3) ];
  }
  /* ---- Knochennamen ----
     Die Cluster-Saetze (Deformer) sind in diesen Dateien namenlos; die
     Knochen stehen als Model-Saetze vom Typ "LimbNode" da. Erster
     Durchlauf meldete deshalb 88 leere Namen. */
  const limbs = R.modelle.filter((m2) => m2.typ === 'LimbNode').map((m2) => m2.name);
  if (limbs.length && R.knochen.every((k) => !k)) R.knochen = limbs;
  R.modellTypen = {};
  for (const m2 of R.modelle) R.modellTypen[m2.typ] = (R.modellTypen[m2.typ] || 0) + 1;
  /* ---- Doppelte Geometrie finden ----
     MikeAlger.fbx liefert seine 50 Gesichtsausdruecke nicht als
     Blendshape-Ziele, sondern als 50 VOLLE Kopien des Koerpers - jede
     19.580 Dreiecke. Wer nur die Gesamtzahl liest, haelt die Figur fuer
     eine Million Dreiecke schwer. Gruppiert wird nach Dreieckszahl und
     Bounding Box; was mehr als einmal vorkommt, wird gemeldet. */
  const schluessel = (x) => x.dreiecke + '|' + (x.masse || []).join(',');
  const zaehl = {};
  for (const x of R.geometrien) { if (x.shape) continue;
    const k = schluessel(x); (zaehl[k] = zaehl[k] || []).push(x); }
  R.doppelte = Object.values(zaehl).filter((a) => a.length > 1)
    .map((a) => ({ anzahl: a.length, dreiecke: a[0].dreiecke, masse: a[0].masse }))
    .sort((a, b) => b.anzahl * b.dreiecke - a.anzahl * a.dreiecke);
  R.dreieckeEinmalig = Object.values(zaehl).reduce((sum, a) => sum + a[0].dreiecke, 0);
  R.materialien = [...new Set(R.materialien)];
  R.texturen = [...new Set(R.texturen)];
  return R;
}

const hier = path.resolve(process.argv[1] || '');
if (hier.endsWith('build2-fbx.mjs')) {
  for (const f of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
    let r;
    try { r = leseFbx(f); } catch (e) { console.log('=== ' + path.basename(f) + ' ===\n  FEHLER: ' + e.message); continue; }
    console.log('');
    console.log('=== ' + r.datei + ' ===');
    console.log('  FBX ' + r.version + '   Dateigroesse ' + (r.bytes / 1048576).toFixed(2) + ' MB');
    console.log('  Geometrien ' + r.echteGeometrien.length +
                (r.blendshapes ? ' (+ ' + r.blendshapes + ' Blendshape-Ziele)' : '') +
                '   Modelle ' + r.modelle.length +
                '   Dreiecke ' + r.dreiecke.toLocaleString('de-DE') +
                (r.dreieckeEinmalig && r.dreieckeEinmalig < r.dreiecke * 0.9
                  ? ' (nur einmalige: ' + r.dreieckeEinmalig.toLocaleString('de-DE') + ')' : '') +
                '   Ecken ' + Math.round(r.ecken).toLocaleString('de-DE'));
    console.log('  Materialien ' + r.materialien.length + '   Texturverweise ' + r.texturen.length +
                '   Deformer ' + r.deformer + ' (Knochen ' + r.knochen.length + ')' +
                '   Animationen ' + r.animationen.length);
    if (r.masse) console.log('  Gesamtmasse (FBX-Einheiten, meist Zentimeter) ' + r.masse.join(' x '));
    if (r.namenAusModellen) console.log('  Hinweis: die Geometrien sind namenlos - die Namen stammen ' +
      'aus den Model-Saetzen in derselben Reihenfolge (an den Massen geprueft).');
    if (r.animationen.length) console.log('  Animationen: ' + r.animationen.slice(0, 12).join(', '));
    if (r.doppelte && r.doppelte.length) {
      console.log('  Mehrfach dieselbe Geometrie:');
      for (const d of r.doppelte.slice(0, 5))
        console.log('    ' + d.anzahl + 'x je ' + d.dreiecke + ' Dreiecke  (' +
          (d.masse || []).join(' x ') + ')');
    }
    if (r.modellTypen) console.log('  Modelltypen: ' + Object.entries(r.modellTypen)
      .map(([k, v]) => v + 'x ' + k).join(', '));
    if (r.knochen.length) console.log('  Knochen (' + r.knochen.length + '): ' +
      r.knochen.slice(0, 24).join(', ') + (r.knochen.length > 24 ? ' ...' : ''));
    const sortiert = r.echteGeometrien.slice().sort((a, b) => b.dreiecke - a.dreiecke);
    console.log('  Einzelteile (Dreiecke | Masse in FBX-Einheiten | Unterkante):');
    for (const g of sortiert.slice(0, 40)) {
      console.log('    ' + String(g.dreiecke).padStart(8) + '  ' +
        String((g.masse || []).join(' x ')).padEnd(30) + ' y0=' +
        String(g.unten === undefined ? '?' : g.unten).padStart(10) + '  ' + (g.name || '(ohne Namen)'));
    }
    if (sortiert.length > 40) console.log('    ... und ' + (sortiert.length - 40) + ' weitere');
  }
}
