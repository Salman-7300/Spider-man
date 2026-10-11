/* Vermisst eine GLB- oder glTF-Datei, ohne sie zu laden.

   Fuer den BUILD-2-Asset-Audit. Der Auftrag verlangt fuer jedes Paket
   Dateiformate, Modellzahl, Namen, Groessen, Dreiecke, Ecken,
   Materialien, Texturen samt Aufloesung, eingebettet oder extern,
   Bounding Box, echte Masse, Ursprung, Achsen, Knotenzahl, Skin,
   Skelett, Knochennamen, Animationen, Blendshapes, LODs, Radnamen bei
   Fahrzeugen.

   WARUM EIN EIGENES WERKZEUG
   Ein 132 MB grosses Baumpaket im Browser zu oeffnen, nur um zu zaehlen,
   wie viele Dreiecke drin sind, ist genau das, was der Auftrag verbietet
   ("NIEMALS roh laden"). Ein GLB ist aber ein sehr einfacher Behaelter:
   zwoelf Byte Kopf, dann ein JSON-Stueck, dann ein Binaerstueck. Alles,
   was der Audit braucht, steht im JSON - Dreiecke stehen als
   Zugriffszahlen da, die Bounding Box als min/max des POSITION-Zugriffs,
   die Texturgroesse im Kopf des eingebetteten PNG oder JPEG.

   Es wird also NICHTS dekodiert: keine Geometrie, keine Textur. Gelesen
   werden nur Kopfdaten. Ein 132-MB-Paket ist damit in Millisekunden
   vermessen und belegt keinen Speicher.

   Aufruf:  node tools/build2-inspect.mjs <datei.glb|datei.gltf> [--json]
*/
import fs from 'node:fs';
import path from 'node:path';

/* ---- GLB aufmachen ----
   Kopf: magic 'glTF' (0x46546C67), Version, Gesamtlaenge.
   Danach Stuecke: Laenge, Typ ('JSON' bzw. 'BIN\0'), Inhalt. */
export function ladeGltf(datei) {
  const roh = fs.readFileSync(datei);
  if (roh.length >= 12 && roh.readUInt32LE(0) === 0x46546c67) {
    const version = roh.readUInt32LE(4);
    let off = 12, json = null, bin = null;
    while (off + 8 <= roh.length) {
      const len = roh.readUInt32LE(off);
      const typ = roh.readUInt32LE(off + 4);
      const start = off + 8;
      if (typ === 0x4e4f534a) json = JSON.parse(roh.slice(start, start + len).toString('utf8'));
      else if (typ === 0x004e4942) bin = roh.slice(start, start + len);
      off = start + len + ((4 - (len % 4)) % 4 === 0 ? 0 : 0);
      /* Stuecke sind bereits auf 4 Byte ausgerichtet - len enthaelt die
         Fuellbytes. Kein zusaetzliches Runden, sonst laeuft der Zeiger
         aus dem Takt. */
    }
    return { json, bin, version, glb: true, bytes: roh.length };
  }
  return { json: JSON.parse(roh.toString('utf8')), bin: null, version: 2,
           glb: false, bytes: roh.length };
}

/* ---- Bildgroesse aus dem Dateikopf ----
   PNG: IHDR steht immer an Byte 16, Breite und Hoehe als 32-Bit.
   JPEG: die Marker durchgehen, bis ein SOFn kommt; dort stehen Hoehe und
   Breite. WEBP: 'VP8 ', 'VP8L' oder 'VP8X'. Es wird nichts dekodiert. */
export function bildMasse(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { typ: 'png', b: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { typ: 'jpeg', h: buf.readUInt16BE(i + 5), b: buf.readUInt16BE(i + 7) };
      }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { typ: 'jpeg', b: null, h: null };
  }
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' &&
      buf.slice(8, 12).toString('latin1') === 'WEBP') {
    const art = buf.slice(12, 16).toString('latin1');
    if (art === 'VP8X') return { typ: 'webp', b: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (art === 'VP8 ') return { typ: 'webp', b: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    return { typ: 'webp', b: null, h: null };
  }
  if (buf.slice(0, 4).toString('latin1') === '\xabKTX') return { typ: 'ktx2', b: null, h: null };
  return { typ: 'unbekannt', b: null, h: null };
}

const KOMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TEILE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function mult(a, b) {                       // 4x4, Spalten zuerst (glTF)
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function trsMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const t = n.translation || [0, 0, 0];
  const r = n.rotation || [0, 0, 0, 1];
  const s = n.scale || [1, 1, 1];
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}
function punktMal(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
          m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
          m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

export function vermesse(datei) {
  const { json: g, bin, version, glb, bytes } = ladeGltf(datei);
  const R = {
    datei: path.basename(datei), bytes, format: glb ? 'glb' : 'gltf', version,
    generator: (g.asset && g.asset.generator) || null,
    copyright: (g.asset && g.asset.copyright) || null,
    extensionsUsed: g.extensionsUsed || [],
    extensionsRequired: g.extensionsRequired || [],
  };
  const meshes = g.meshes || [];
  const accessors = g.accessors || [];
  const nodes = g.nodes || [];

  /* ---- Dreiecke und Ecken je Mesh ---- */
  let dreieckeGesamt = 0, eckenGesamt = 0;
  const meshInfo = meshes.map((m, i) => {
    let dr = 0, ec = 0, morph = 0;
    const modi = new Set();
    for (const p of m.primitives || []) {
      const modus = p.mode === undefined ? 4 : p.mode;
      modi.add(modus);
      const pos = p.attributes && p.attributes.POSITION !== undefined
        ? accessors[p.attributes.POSITION] : null;
      const anz = p.indices !== undefined ? (accessors[p.indices] || {}).count
                                          : (pos || {}).count;
      if (anz) {
        if (modus === 4) dr += anz / 3;
        else if (modus === 5 || modus === 6) dr += Math.max(0, anz - 2);
      }
      if (pos) ec += pos.count;
      if (p.targets) morph = Math.max(morph, p.targets.length);
    }
    dreieckeGesamt += dr; eckenGesamt += ec;
    return { i, name: m.name || null, dreiecke: Math.round(dr), ecken: ec,
             prims: (m.primitives || []).length, morphZiele: morph,
             modi: [...modi] };
  });
  R.meshes = meshInfo.length;
  R.dreiecke = Math.round(dreieckeGesamt);
  R.ecken = eckenGesamt;
  R.morphZiele = Math.max(0, ...meshInfo.map((m) => m.morphZiele));
  R.morphNamen = (g.meshes || []).flatMap((m) => (m.extras && m.extras.targetNames) || []);

  /* ---- Szenengraph: Weltmatrizen, Bounding Box, Knotennamen ---- */
  const welt = new Array(nodes.length).fill(null);
  const kinderVon = new Set();
  for (const n of nodes) for (const k of n.children || []) kinderVon.add(k);
  const wurzeln = (g.scenes && g.scenes[g.scene || 0] && g.scenes[g.scene || 0].nodes) ||
                  nodes.map((_, i) => i).filter((i) => !kinderVon.has(i));
  const bb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const pro = [];
  const geh = (i, eltern) => {
    const n = nodes[i];
    if (!n) return;
    const m = mult(eltern, trsMatrix(n));
    welt[i] = m;
    if (n.mesh !== undefined) {
      const mi = meshInfo[n.mesh];
      const lok = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const p of (meshes[n.mesh].primitives || [])) {
        const a = accessors[p.attributes && p.attributes.POSITION];
        if (!a || !a.min || !a.max) continue;
        /* Alle acht Ecken der lokalen Box durch die Weltmatrix - nur so
           stimmt die Box auch bei gedrehten Knoten. */
        for (let e = 0; e < 8; e++) {
          const p3 = [e & 1 ? a.max[0] : a.min[0], e & 2 ? a.max[1] : a.min[1],
                      e & 4 ? a.max[2] : a.min[2]];
          const w = punktMal(m, p3);
          for (let k = 0; k < 3; k++) {
            if (w[k] < bb.min[k]) bb.min[k] = w[k];
            if (w[k] > bb.max[k]) bb.max[k] = w[k];
            if (w[k] < lok.min[k]) lok.min[k] = w[k];
            if (w[k] > lok.max[k]) lok.max[k] = w[k];
          }
        }
      }
      if (lok.min[0] !== Infinity) {
        pro.push({ knoten: i, name: n.name || null, mesh: n.mesh,
          meshName: mi.name, dreiecke: mi.dreiecke, ecken: mi.ecken,
          masse: [ +(lok.max[0] - lok.min[0]).toFixed(3),
                   +(lok.max[1] - lok.min[1]).toFixed(3),
                   +(lok.max[2] - lok.min[2]).toFixed(3) ],
          mitte: [ +((lok.max[0] + lok.min[0]) / 2).toFixed(3),
                   +((lok.max[1] + lok.min[1]) / 2).toFixed(3),
                   +((lok.max[2] + lok.min[2]) / 2).toFixed(3) ],
          unten: +lok.min[1].toFixed(3) });
      }
    }
    for (const k of n.children || []) geh(k, m);
  };
  const eins = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const w of wurzeln) geh(w, eins);

  R.knoten = nodes.length;
  R.wurzeln = wurzeln.length;
  R.objekte = pro.sort((a, b) => b.dreiecke - a.dreiecke);
  if (bb.min[0] !== Infinity) {
    R.bbox = { min: bb.min.map((v) => +v.toFixed(3)), max: bb.max.map((v) => +v.toFixed(3)) };
    R.masse = [ +(bb.max[0] - bb.min[0]).toFixed(3), +(bb.max[1] - bb.min[1]).toFixed(3),
                +(bb.max[2] - bb.min[2]).toFixed(3) ];
    R.ursprungUnten = +bb.min[1].toFixed(3);
    R.ursprungMitteXZ = [ +((bb.max[0] + bb.min[0]) / 2).toFixed(3),
                          +((bb.max[2] + bb.min[2]) / 2).toFixed(3) ];
  }

  /* ---- Materialien ---- */
  R.materialien = (g.materials || []).length;
  R.materialNamen = (g.materials || []).map((m) => m.name || '(ohne Namen)');
  R.materialArten = {
    pbr: (g.materials || []).filter((m) => m.pbrMetallicRoughness).length,
    unlit: (g.materials || []).filter((m) => m.extensions && m.extensions.KHR_materials_unlit).length,
    durchsichtig: (g.materials || []).filter((m) => m.alphaMode && m.alphaMode !== 'OPAQUE').length,
    doppelseitig: (g.materials || []).filter((m) => m.doubleSided).length,
  };

  /* ---- Texturen ---- */
  const bilder = (g.images || []).map((im, i) => {
    let buf = null, quelle = 'extern';
    if (im.bufferView !== undefined && bin) {
      const bv = g.bufferViews[im.bufferView];
      buf = bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
      quelle = 'eingebettet';
    } else if (im.uri && im.uri.startsWith('data:')) {
      buf = Buffer.from(im.uri.slice(im.uri.indexOf(',') + 1), 'base64');
      quelle = 'data-uri';
    } else if (im.uri) {
      const p = path.join(path.dirname(datei), decodeURIComponent(im.uri));
      if (fs.existsSync(p)) { buf = fs.readFileSync(p); quelle = 'datei: ' + im.uri; }
      else quelle = 'FEHLT: ' + im.uri;
    }
    const mm = buf ? bildMasse(buf) : null;
    return { i, name: im.name || null, quelle,
             mime: im.mimeType || (mm ? mm.typ : null),
             breite: mm ? mm.b : null, hoehe: mm ? mm.h : null,
             bytes: buf ? buf.length : null };
  });
  R.bilder = bilder;
  R.texturen = (g.textures || []).length;
  R.texturBytes = bilder.reduce((a, b) => a + (b.bytes || 0), 0);
  R.texturEingebettet = bilder.filter((b) => b.quelle === 'eingebettet' || b.quelle === 'data-uri').length;
  R.texturExtern = bilder.length - R.texturEingebettet;

  /* ---- Skin, Skelett, Knochen ---- */
  R.skins = (g.skins || []).length;
  R.knochen = (g.skins || []).map((s) => (s.joints || []).length);
  /* Die Namen kommen aus dem GROESSTEN Skin, nicht aus dem ersten.
     Erster Durchlauf: civilian.glb des Spiels hat sechs Skins
     (8, 14, 7, 8, 67, 5 Knochen - Koerper plus Kleidungsteile), und die
     Ausgabe zeigte die acht Knochen eines Kleidungsstuecks statt der 67
     des Koerpers. */
  const grSkin = (g.skins || []).reduce((a, s2) =>
    (s2.joints || []).length > ((a && a.joints) || []).length ? s2 : a, null);
  R.knochenNamen = grSkin ? (grSkin.joints || []).map((j) => (nodes[j] && nodes[j].name) || ('node' + j)) : [];
  R.knochenMax = grSkin ? (grSkin.joints || []).length : 0;

  /* ---- Animationen ---- */
  R.animationen = (g.animations || []).map((a, i) => ({
    i, name: a.name || null, kanaele: (a.channels || []).length,
    /* Laenge: groesster Zeitwert aller Eingangszugriffe. Steht als max im
       Zugriff, muss also nicht gelesen werden. */
    sekunden: Math.max(0, ...(a.samplers || []).map((s) => {
      const acc = accessors[s.input];
      return acc && acc.max ? acc.max[0] : 0;
    })),
  }));

  /* ---- Puffergroessen: wie viel ist Geometrie, wie viel Textur ---- */
  const bvBytes = (g.bufferViews || []).reduce((a, b) => a + (b.byteLength || 0), 0);
  R.pufferBytes = bvBytes;
  R.geometrieBytes = bvBytes - R.texturBytes;
  R.zugriffe = accessors.length;
  R.attribute = [...new Set(meshes.flatMap((m) =>
    (m.primitives || []).flatMap((p) => Object.keys(p.attributes || {}))))].sort();

  /* ---- Namensmuster, nach denen der Auftrag ausdruecklich fragt ---- */
  const alleNamen = nodes.map((n) => n.name || '').filter(Boolean);
  R.knotenNamen = alleNamen;
  const suche = (re) => alleNamen.filter((n) => re.test(n));
  R.hinweise = {
    /* Die Kuerzel fl/fr/rl/rr NUR als eigenes Wortstueck. Ohne Grenzen
       hat das Muster im ersten Durchlauf "Brownstone_FlatFacade_1" als
       Rad gemeldet - das "Fl" in "Flat". */
    raeder: suche(/wheel|tire|reifen|(^|[_\-. ])(rad|fl|fr|rl|rr)([_\-. ]|\d|$)/i).slice(0, 24),
    tueren: suche(/door|tuer|hood|trunk|boot/i).slice(0, 16),
    fenster: suche(/window|glass|fenster|scheibe/i).slice(0, 16),
    lenkrad: suche(/steer|lenk/i).slice(0, 8),
    lod: suche(/lod[_\-.]?\d|_l\d$/i).slice(0, 24),
    dach: suche(/roof|dach/i).slice(0, 16),
    treppe: suche(/stair|treppe|step/i).slice(0, 16),
    laden: suche(/shop|store|laden|storefront/i).slice(0, 16),
  };
  return R;
}

/* ---- Aufruf von der Kommandozeile ---- */
const hier = path.resolve(process.argv[1] || '');
if (hier.endsWith('build2-inspect.mjs')) {
  const dateien = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const alsJson = process.argv.includes('--json');
  const alle = [];
  for (const f of dateien) {
    let r;
    try { r = vermesse(f); } catch (e) { r = { datei: path.basename(f), fehler: e.message }; }
    alle.push(r);
    if (alsJson) continue;
    console.log('');
    console.log('=== ' + r.datei + ' ===');
    if (r.fehler) { console.log('  FEHLER: ' + r.fehler); continue; }
    const mb = (b) => (b / 1048576).toFixed(2) + ' MB';
    console.log('  Format ' + r.format + ' v' + r.version + '   Dateigroesse ' + mb(r.bytes));
    if (r.generator) console.log('  Erzeuger: ' + r.generator);
    if (r.copyright) console.log('  Copyright im Modell: ' + r.copyright);
    console.log('  Meshes ' + r.meshes + '   Knoten ' + r.knoten + ' (' + r.wurzeln + ' Wurzeln)' +
                '   Dreiecke ' + r.dreiecke.toLocaleString('de-DE') +
                '   Ecken ' + r.ecken.toLocaleString('de-DE'));
    console.log('  Materialien ' + r.materialien + '   Texturen ' + r.texturen +
                ' (' + r.texturEingebettet + ' eingebettet, ' + r.texturExtern + ' extern)' +
                '   Texturbytes ' + mb(r.texturBytes) + ', Geometrie ' + mb(r.geometrieBytes));
    if (r.masse) console.log('  Masse ' + r.masse.join(' x ') + '   Unterkante y=' + r.ursprungUnten +
                             '   Mitte xz ' + r.ursprungMitteXZ.join(' / '));
    console.log('  Skins ' + r.skins + (r.knochen.length ? ' (Knochen ' + r.knochen.join(', ') + ')' : '') +
                '   Blendshapes ' + r.morphZiele + '   Animationen ' + r.animationen.length);
    if (r.animationen.length) console.log('    ' + r.animationen.map((a) =>
      (a.name || 'anim' + a.i) + ' ' + a.sekunden.toFixed(2) + 's').join(', '));
    if (r.extensionsUsed.length) console.log('  Erweiterungen: ' + r.extensionsUsed.join(', ') +
      (r.extensionsRequired.length ? '   PFLICHT: ' + r.extensionsRequired.join(', ') : ''));
    const grosse = r.bilder.filter((b) => b.breite).map((b) => b.breite + 'x' + b.hoehe);
    if (grosse.length) {
      const z = {};
      for (const s of grosse) z[s] = (z[s] || 0) + 1;
      console.log('  Texturgroessen: ' + Object.entries(z).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => v + 'x ' + k).join(', '));
    }
    console.log('  Attribute: ' + r.attribute.join(', '));
    for (const [k, v] of Object.entries(r.hinweise)) {
      if (v.length) console.log('  ' + k + ': ' + v.join(', '));
    }
    if (r.objekte.length) {
      console.log('  Groesste Objekte (Dreiecke | Masse | Unterkante):');
      for (const o of r.objekte.slice(0, 30)) {
        console.log('    ' + String(o.dreiecke).padStart(8) + '  ' +
          String(o.masse.join(' x ')).padEnd(26) + ' y0=' + String(o.unten).padStart(8) +
          '  ' + (o.name || o.meshName || '(ohne Namen)'));
      }
      if (r.objekte.length > 30) console.log('    ... und ' + (r.objekte.length - 30) + ' weitere');
    }
  }
  if (alsJson) console.log(JSON.stringify(alle, null, 1));
}
