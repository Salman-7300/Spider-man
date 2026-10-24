/* CITY V2, Stufe 8A: Bezirksidentitaet und visuelle Orientierung.

   Drei Teile, alle aus dem laufenden Spiel gelesen:

   1. BESTAND je Stadtteil - Bloecke, Haeuser, Hoehen, Darstellung
      (Modell / prozedural), Modelle und Fassadentexturen, Fassadenfarben
      (aus den Materialien, nach Fassadenflaeche gewichtet),
      Kantennutzung, Leuchtschilder, Strassendetails, Laternen,
      Ampeln, Baenke, POIs, U-Bahn, Altbauhaeuser, Aufenthaltsanker.

   2. DIE NEUEN DETAILS (Stufe 8A, __dbg.bezirksIdentitaet): Zahl und Art
      je Stadtteil und die harten Platzierungsfehler, Soll ueberall 0:
        - flaches Fassadendetail: Rueckseite nicht auf der sichtbaren
          Wand (schwebt) oder in ihr (steckt), Wand hinter der Flaeche
          nicht eben, ausserhalb der Hausfront, in einem Nachbarhaus,
          ueber einem Leuchtschild
        - bodenstehendes Detail: nicht auf Gehwegboden, im Hindernis,
          Gehweg nach innen unter 1,8 m, Zebrastreifen, U-Bahn-Abgang,
          Haustuer, POI, Sitz- und Aufenthaltsplatz, Gehnetz
        - Mastdetail: Mast fehlt, Tafel im Mast oder im Haus, ueber der
          Fahrbahn unter Fahrzeughoehe
        - neue Hindernisse (Soll 0 - alles Neue ist flach oder haengt
          an Vorhandenem)
      und die Lesbarkeit: kleinste Schrifthoehe je Tafelart.

   3. WELT-FINGERABDRUCK: Bezirkszuordnung, Haeuser und Lots, Modelle,
      Fassadentexturen, Hindernisse, Parkautos, fahrende Wagen,
      Passanten samt Looks, Gegner, POIs, Strassendetails,
      Aufenthaltsanker, Missionen - nach dem Laden und nach 20 s
      Spielzeit. Mit vergleich=<json> gegen einen anderen Stand.

   Aufruf:  node tools/pruef/district-identity.js <ausgabe.json> [seed=4711] [vergleich=alt.json]
   Rueckgabe 0 = alles in Ordnung, 1 = harter Fehler oder Fingerabdruck verschieden.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const ziel = process.argv[2];
if (!ziel) { console.log('Aufruf: node tools/pruef/district-identity.js <ausgabe.json> [seed=4711] [vergleich=alt.json]'); process.exit(1); }
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const SEED = +arg('seed', 4711);
const VERGLEICH = arg('vergleich', null);

/* Fester, einfacher Fingerabdruck (wie determinismus.js). */
function finger(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
    h2 = ((h2 + s.charCodeAt(i) * (i + 1)) * 2654435761) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

(async () => {
  const { b, page } = await starte(800, 480, SEED, { frierSofort: true });
  const roh = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const R = d.raster();
    const T = d.stadtteile();
    const blockVon = (x, z) => {
      if (x > R.x1) return null;
      const bi = Math.floor((x - R.x0) / R.pitch), bj = Math.floor((z - R.z0) / R.pitch);
      return T.find((t) => t.bi === bi && t.bj === bj) || null;
    };
    const artVon = (x, z) => { if (x > R.x1) return 'UFER'; const t = blockVon(x, z); return t ? t.art : null; };
    const ARTEN = ['ZENTRUM', 'GESCHAEFT', 'MISCHUNG', 'WOHN', 'UFER', 'PARK'];
    const je = () => Object.fromEntries(ARTEN.map((a) => [a, 0]));

    /* ---- 1. Bestand ---- */
    const K = d.hausKisten();
    const S = d.strassen();
    const klasseAn = (achse, linie) => { const s = S.find((q) => q.achse === achse && Math.abs(q.linie - linie) < 0.5); return s ? s.klasse : null; };

    /* Fassadenfarbe je Haus: Materialfarbe x mittlere Texturfarbe, je
       Teilmesh nach Dreieckszahl gewichtet; Modelle je Typ einmal. */
    const leinwand = document.createElement('canvas'); leinwand.width = leinwand.height = 16;
    const g2 = leinwand.getContext('2d');
    const bildMittel = new Map();
    const mittelVonBild = (img) => {
      if (!img) return null;
      if (bildMittel.has(img)) return bildMittel.get(img);
      let m = null;
      try {
        g2.clearRect(0, 0, 16, 16); g2.drawImage(img, 0, 0, 16, 16);
        const p = g2.getImageData(0, 0, 16, 16).data;
        let r = 0, gg = 0, bb = 0, n = 0;
        for (let i = 0; i < p.length; i += 4) { if (p[i + 3] < 128) continue; r += p[i]; gg += p[i + 1]; bb += p[i + 2]; n++; }
        if (n) m = [r / n / 255, gg / n / 255, bb / n / 255];
      } catch (e) { m = null; }
      bildMittel.set(img, m);
      return m;
    };
    const farbeVonObjekt = (o) => {
      let r = 0, g = 0, bl = 0, w = 0;
      o.traverse((k) => {
        if (!k.isMesh || !k.geometry || !k.geometry.attributes.position) return;
        const mats = Array.isArray(k.material) ? k.material : [k.material];
        const n = (k.geometry.index ? k.geometry.index.count : k.geometry.attributes.position.count) / 3;
        for (const m of mats) {
          if (!m || m.transparent) continue;
          let c = m.color ? [m.color.r, m.color.g, m.color.b] : [1, 1, 1];
          const t = m.map && m.map.image ? mittelVonBild(m.map.image) : null;
          if (t) c = [c[0] * t[0], c[1] * t[1], c[2] * t[2]];
          if (m.vertexColors && k.geometry.attributes.color) {
            const ca = k.geometry.attributes.color; let vr = 0, vg = 0, vb = 0;
            const st = Math.max(1, Math.floor(ca.count / 400));
            let vn = 0;
            for (let i = 0; i < ca.count; i += st) { vr += ca.getX(i); vg += ca.getY(i); vb += ca.getZ(i); vn++; }
            c = [c[0] * vr / vn, c[1] * vg / vn, c[2] * vb / vn];
          }
          r += c[0] * n / mats.length; g += c[1] * n / mats.length; bl += c[2] * n / mats.length; w += n / mats.length;
        }
      });
      return w ? [r / w, g / w, bl / w] : null;
    };
    const modellFarbe = {};
    for (const o of d.hausModelle()) {
      const nm = o.userData.modellName;
      if (nm && !modellFarbe[nm]) modellFarbe[nm] = farbeVonObjekt(o);
    }
    /* Prozedurale Fassaden: die drei Wandmaterialien in Erzeugungsreihenfolge */
    const wandMats = [];
    for (const m of d.hausFassaden()) if (m.material && m.material.map && wandMats.indexOf(m.material) < 0 && !/dach/i.test(m.material.name || '')) wandMats.push(m.material);
    wandMats.sort((a, b2) => a.id - b2.id);
    const texFarbe = wandMats.map((m) => mittelVonBild(m.map.image));
    const hsl = (c) => {
      const [r, g, bl] = c; const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), l = (mx + mn) / 2;
      let h = 0, s = 0;
      if (mx !== mn) { const dd = mx - mn; s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
        h = mx === r ? (g - bl) / dd + (g < bl ? 6 : 0) : mx === g ? (bl - r) / dd + 2 : (r - g) / dd + 4; h *= 60; }
      return [h, s, l];
    };
    const familie = (c) => {
      if (!c) return 'unbekannt';
      const [h, s, l] = hsl(c);
      if (l > 0.66 && s < 0.25) return 'hell (weiss/hellgrau)';
      if (s < 0.10) return l < 0.30 ? 'dunkelgrau' : 'grau';
      if (h >= 180 && h < 260) return l < 0.30 ? 'dunkles Blaugrau' : 'Blaugrau/Glas';
      if ((h < 18 || h >= 340) && s > 0.2) return 'Backsteinrot';
      if (h >= 18 && h < 45) return l < 0.35 ? 'Braun' : 'Ocker/Sand';
      if (h >= 45 && h < 70) return 'Beige/Gelb';
      return 'sonstig';
    };
    const bestand = {};
    for (const a of ARTEN) bestand[a] = { bloecke: 0, haeuser: 0, hoehen: [], model: 0, merged: 0, ecke: 0, modelle: {}, texturen: {},
      farben: {}, farbSumme: [0, 0, 0, 0], kanten: {}, neon: 0, neonFarben: {}, sd: {}, laternen: 0, ampeln: 0, baenke: 0,
      poller: 0, beete: 0, pois: {}, ubahn: 0, altbau: 0, anker: {} };
    for (const t of T) bestand[t.art].bloecke++;
    for (const h of K) {
      const a = h.art || artVon(h.x, h.z); if (!a || !bestand[a]) continue;
      const B = bestand[a];
      B.haeuser++; B.hoehen.push(h.h);
      if (h.visual === 'model') B.model++; else B.merged++;
      if (h.ecke) B.ecke++;
      const nm = h.visual === 'model' ? (h.modell || '?') : 'prozedural-Textur' + h.textur;
      B.modelle[nm] = (B.modelle[nm] || 0) + 1;
      const c = h.visual === 'model' ? modellFarbe[h.modell] : texFarbe[h.textur];
      const flaeche = (h.w + h.d) * h.h;
      const f = familie(c);
      B.farben[f] = (B.farben[f] || 0) + flaeche;
      if (c) { B.farbSumme[0] += c[0] * flaeche; B.farbSumme[1] += c[1] * flaeche; B.farbSumme[2] += c[2] * flaeche; B.farbSumme[3] += flaeche; }
    }
    for (const t of T) {
      for (const [seite, achse, linie] of [['N', 'z', t.z + 25], ['S', 'z', t.z - 25], ['O', 'x', t.x + 25], ['W', 'x', t.x - 25]]) {
        const kl = klasseAn(achse, linie);
        const nu = d.kantenNutzung(t.art, kl);
        bestand[t.art].kanten[nu] = (bestand[t.art].kanten[nu] || 0) + 1;
      }
    }
    /* Leuchtschilder ueber das Kletter-Overlay: Hindernis -> Haus -> Stadtteil */
    const kollNachId = new Map(); for (const c of d.colliders) kollNachId.set(c.id, c);
    const neonGesehen = new Set();
    for (const q of d.neonUeber()) {
      const c = kollNachId.get(q.koll); if (!c) continue;
      const key = q.koll + ':' + q.l0 + ':' + q.y0;
      if (neonGesehen.has(key)) continue; neonGesehen.add(key);
      const a = artVon((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2); if (a && bestand[a]) bestand[a].neon++;
    }
    for (const e of d.strassenDetails()) { const a = e.bezirk || artVon(e.x, e.z); if (a && bestand[a]) bestand[a].sd[e.art] = (bestand[a].sd[e.art] || 0) + 1; }
    for (const l of d.laterneStellen()) { const a = artVon(l[0], l[1]); if (a && bestand[a]) bestand[a].laternen++; }
    for (const s of d.ampelStellen()) { const a = artVon(s[0], s[1]); if (a && bestand[a]) bestand[a].ampeln++; }
    for (const s of d.bankStellen()) { const a = artVon(s.x, s.z); if (a && bestand[a]) bestand[a].baenke++; }
    for (const s of d.teilStellen('Prop_Bollard')) { const a = artVon(s.x, s.z); if (a && bestand[a]) bestand[a].poller++; }
    for (const s of d.beetStellen()) { const a = artVon(s[0], s[1]); if (a && bestand[a]) bestand[a].beete++; }
    const POIS = d.poiListe();
    for (const p of POIS) { const a = artVon(p.x, p.z); if (a && bestand[a]) bestand[a].pois[p.art + (p.name ? ' ' + p.name : '')] = (bestand[a].pois[p.art + (p.name ? ' ' + p.name : '')] || 0) + 1; }
    for (const u of d.ubahnen()) { const a = artVon(u.x, u.z !== undefined ? u.z : 25); if (a && bestand[a]) bestand[a].ubahn++; }
    for (const k of d.kitKopien()) { const a = artVon(k.position.x, k.position.z); if (a && bestand[a]) bestand[a].altbau++; }
    const AUF = d.aufenthalt();
    for (const an of AUF.anker) { const a = artVon(an.x, an.z); if (a && bestand[a]) bestand[a].anker[an.art] = (bestand[a].anker[an.art] || 0) + 1; }
    for (const a of ARTEN) {
      const B = bestand[a];
      const hs = B.hoehen.sort((x, y) => x - y);
      B.hoeheMedian = hs.length ? +hs[hs.length >> 1].toFixed(1) : 0;
      B.hoeheMax = hs.length ? +hs[hs.length - 1].toFixed(1) : 0;
      delete B.hoehen;
      B.mittelFarbe = B.farbSumme[3] ? '#' + B.farbSumme.slice(0, 3).map((v) => Math.round(v / B.farbSumme[3] * 255).toString(16).padStart(2, '0')).join('') : null;
      delete B.farbSumme;
      const ges = Object.values(B.farben).reduce((s, v) => s + v, 0) || 1;
      B.farben = Object.fromEntries(Object.entries(B.farben).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, Math.round(v / ges * 100)]));
    }

    /* ---- 2. Neue Details (Stufe 8A) ---- */
    const BI = d.bezirksIdentitaet ? d.bezirksIdentitaet() : null;
    let pruef = null;
    if (BI && BI.liste) {
      const F = {};                                   // harte Fehler: Art -> Zahl
      const fehl = (k, e, info) => { F[k] = (F[k] || 0) + 1; if (!pruef.beispiele[k]) pruef.beispiele[k] = Object.assign({ nr: e.nr, art: e.art, bezirk: e.bezirk }, info || {}); };
      pruef = { beispiele: {}, zahlen: {}, orientierung: {}, schrift: {}, vorstand: 0, abstandMax: 0, abstandMin: Infinity,
                strahlen: 0, ohneTreffer: 0, jeFront: 0, gleichesWortNachbar: 0, fronten: 0 };
      const NEON = d.neonKisten();
      const meshe = new Map();                        // Haus -> sichtbare Geometrie zum Abtasten
      /* Modell -> Index des Hauses (hausKisten() liefert Kopien) */
      const nachOrt = new Map();
      K.forEach((k, i) => nachOrt.set(k.x.toFixed(2) + '|' + k.z.toFixed(2) + '|' + k.h.toFixed(2), i));
      for (const o of d.hausModelle()) {
        const hk = o.userData.hausKiste; if (!hk) continue;
        const i = nachOrt.get(hk.x.toFixed(2) + '|' + hk.z.toFixed(2) + '|' + hk.h.toFixed(2));
        if (i !== undefined) meshe.set(i, o);
      }
      const prod = d.hausFassaden().filter((m) => m.visible);
      const ray = new THREE.Raycaster();
      const dir = new THREE.Vector3(), org = new THREE.Vector3();
      const KO = K;
      const kistenRoh = d.hausKistenRoh ? d.hausKistenRoh() : null;
      const koll = (h) => d.colliders.find((q) => q.bau === q && Math.abs((q.x0 + q.x1) / 2 - h.x) < 0.01 &&
                                                  Math.abs((q.z0 + q.z1) / 2 - h.z) < 0.01 && Math.abs(q.h - (0.25 + h.h)) < 0.05);
      const zaehl = (e) => { const k = e.bezirk + ':' + e.art; pruef.zahlen[k] = (pruef.zahlen[k] || 0) + 1; };
      const jeFront = new Map();
      for (const e of BI.liste) {
        zaehl(e);
        if (['wegweiser', 'banner', 'portal', 'wahrzeichen'].indexOf(e.art) >= 0)
          pruef.orientierung[e.bezirk] = (pruef.orientierung[e.bezirk] || 0) + 1;
        if (e.haus !== undefined && e.art !== 'banner' && e.art !== 'portal' && e.art !== 'vorplatz') {
          const H = KO[e.haus];
          const breite = e.nx ? H.d : H.w;
          const fk = e.haus + '|' + e.nx + '|' + e.nz;
          if (!jeFront.has(fk)) jeFront.set(fk, []);
          jeFront.get(fk).push(e);
          /* in der Hausfront */
          if (e.l0 < -breite / 2 - 1e-3 || e.l1 > breite / 2 + 1e-3 || e.y0 < -1e-3 || e.y1 > H.h - 0.5) fehl('ausserhalbFront', e, { l0: e.l0, l1: e.l1, breite });
          /* Leuchtschild ueberdeckt? */
          for (const q of NEON) {
            if (q.haus !== e.haus || q.nx !== e.nx || q.nz !== e.nz) continue;
            const quer = q.nx !== 0, breitQ = quer ? q.d : q.w;
            const l = e.nz ? e.nz * (q.x0 - H.x) : -e.nx * (q.z0 - H.z);
            const ny0 = q.y - q.h / 2 - 0.25, ny1 = q.y + q.h / 2 - 0.25;
            if (e.l1 > l - breitQ / 2 && e.l0 < l + breitQ / 2 && e.y1 > ny0 && e.y0 < ny1) fehl('ueberNeon', e, { neonY: [ny0, ny1] });
          }
          /* Abtasten: von 1 m vor der Tafel senkrecht auf die Front - die
             erste sichtbare Flaeche des EIGENEN Hauses muss 1,5 cm hinter
             der Tafel liegen (+-2 cm); ein fremdes Haus davor ist ein
             Schnitt mit dem Nachbarn. */
          const ebene = e.nx ? H.x + e.nx * H.w / 2 : H.z + e.nz * H.d / 2;
          const tafel = ebene + (e.nx || e.nz) * (BI.vor - e.tiefe);
          const ziele = [];
          const eigen = meshe.get(e.haus) || null;
          for (const [fl, fy] of [[0.5, 0.5], [0.1, 0.2], [0.9, 0.2], [0.1, 0.8], [0.9, 0.8]]) {
            const l = e.l0 + (e.l1 - e.l0) * fl, y = 0.25 + e.y0 + (e.y1 - e.y0) * fy;
            const px = e.nx ? tafel : H.x + e.nz * l, pz = e.nx ? H.z - e.nx * l : tafel;
            org.set(px + e.nx * 1.0, y, pz + e.nz * 1.0); dir.set(-e.nx, 0, -e.nz);
            ray.set(org, dir); ray.near = 0; ray.far = 2.5;
            const kand = [];
            if (H.modell && eigen) kand.push(eigen); else for (const m of prod) kand.push(m);
            const treffer = ray.intersectObjects(kand, true).filter((t) => !t.object.userData || t.object.name !== 'Bezirksdetails');
            pruef.strahlen++;
            if (!treffer.length) { pruef.ohneTreffer++; fehl('keineFlaecheDahinter', e, { l, y }); continue; }
            const ab = treffer[0].distance - 1.0;      // Tafel -> sichtbare Flaeche
            if (ab > pruef.abstandMax) pruef.abstandMax = ab;
            if (ab < pruef.abstandMin) pruef.abstandMin = ab;
            if (ab > 0.035) fehl('schwebt', e, { abstand: +ab.toFixed(3), l: +l.toFixed(2), y: +y.toFixed(2), modell: H.modell });
            if (ab < -0.005) fehl('steckt', e, { abstand: +ab.toFixed(3), l: +l.toFixed(2), y: +y.toFixed(2), modell: H.modell });
          }
          /* fremdes Hindernis vor der Tafel (bis 0,5 m) */
          for (const fl of [0.1, 0.5, 0.9]) for (const fy of [0.2, 0.8]) {
            const l = e.l0 + (e.l1 - e.l0) * fl, y = 0.25 + e.y0 + (e.y1 - e.y0) * fy;
            const px = e.nx ? ebene + e.nx * 0.25 : H.x + e.nz * l, pz = e.nx ? H.z - e.nx * l : ebene + e.nz * 0.25;
            const eigenK = koll(H);
            for (const c of d.colliderNah(px, pz)) {
              if (c.klein || c === eigenK || (eigenK && c.bau === eigenK)) continue;
              const unten = c.y0 === undefined ? -50 : c.y0;
              if (px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1 && y > unten && y < c.h) { fehl('inNachbarhaus', e, { kollId: c.id }); break; }
            }
          }
          /* Schrift: kleinste Zeilenhoehe je Art */
          const sh = e.art === 'wegweiser' ? BI.masse.zeile : e.y1 - e.y0;
          if (e.art !== 'eingang' && (pruef.schrift[e.art] === undefined || sh < pruef.schrift[e.art])) pruef.schrift[e.art] = +sh.toFixed(3);
        } else if (e.art === 'banner') {
          if (e.y0 < 2.3) fehl('bannerZuTief', e, { y0: e.y0 });
          const L = d.laterneStellen()[e.laterne];
          if (!L) fehl('bannerOhneLaterne', e);
          else if (Math.hypot(L[0] - e.x, L[1] - e.z) > BI.masse.bannerAb + BI.masse.banner[0] / 2 + 0.01) fehl('bannerSchwebt', e);
          const k = e.kasten;
          for (const c of d.colliderNah(e.x, e.z)) {
            if (c.klein) continue;
            const unten = c.y0 === undefined ? -50 : c.y0;
            if (k.x1 > c.x0 && k.x0 < c.x1 && k.z1 > c.z0 && k.z0 < c.z1 && e.y1 > unten && e.y0 < c.h) { fehl('bannerImHindernis', e, { kollId: c.id }); break; }
          }
          pruef.schrift.banner = Math.min(pruef.schrift.banner || 9, 0.09);
        } else if (e.art === 'vorplatz') {
          /* flach im Belag: ueberall Gehweg darunter, kein Ueberweg, kein Schacht */
          for (const [px, pz] of [[e.x0, e.z0], [e.x1, e.z0], [e.x0, e.z1], [e.x1, e.z1], [(e.x0 + e.x1) / 2, (e.z0 + e.z1) / 2]])
            if (Math.abs(d.groundYAt(px, pz) - 0.25) > 0.011) { fehl('vorplatzNichtAufGehweg', e, { px, pz }); break; }
          if (d.aufZebra(e.x0, e.x1, e.z0, e.z1)) fehl('vorplatzAufZebra', e);
          for (const l of d.ubLoecher()) if (e.x1 > l.x0 && e.x0 < l.x1 && e.z1 > l.z0 && e.z0 < l.z1) fehl('vorplatzUeberSchacht', e);
          if (Math.abs(e.y - 0.254) > 0.002) fehl('vorplatzHoehe', e, { y: e.y });
        } else if (e.art === 'portal') {
          if (e.y0 < 2.6) fehl('portalZuTief', e);
          for (const p of e.stuetzen) {
            if (Math.abs(d.groundYAt(p.x, p.z) - 0.25) > 0.03) fehl('stuetzeNichtAufBoden', e, p);
            for (const A2 of AUF.anker) for (const P of A2.plaetze) if (Math.hypot(P.x - p.x, P.z - p.z) < 0.7) fehl('stuetzeAmAnker', e, { anker: A2.id });
            for (const s of d.strassenDetails()) if (Math.abs(s.x - p.x) < s.r + 0.2 && Math.abs(s.z - p.z) < s.r + 0.2) fehl('stuetzeAmDetail', e, { sd: s.nr });
            for (const q of POIS) if (Math.abs(q.y - 0.3) < 3 && Math.hypot(q.x - p.x, q.z - p.z) < 3) fehl('stuetzeAmPoi', e);
          }
          pruef.schrift.portal = +(e.y1 - e.y0).toFixed(3);
        }
      }
      /* je Front hoechstens ein Laden, ein Eingang, ein Wegweiser; keine
         zwei Rechtecke uebereinander */
      for (const [, l] of jeFront) {
        pruef.fronten++;
        const art = {};
        for (const e of l) art[e.art] = (art[e.art] || 0) + 1;
        if (Object.values(art).some((n) => n > 1)) fehl('mehrfachAnFront', l[0], art);
        for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
          const a = l[i], b2 = l[j];
          const yA = [a.y0, a.y1], yB = [b2.y0, b2.y1];
          if (a.art === 'laden' && a.fenster) yA[0] = Math.min(yA[0], a.f0);
          if (b2.art === 'laden' && b2.fenster) yB[0] = Math.min(yB[0], b2.f0);
          if (a.l1 > b2.l0 + 1e-3 && a.l0 < b2.l1 - 1e-3 && yA[1] > yB[0] + 1e-3 && yA[0] < yB[1] - 1e-3) fehl('ueberlappung', a, { mit: b2.nr });
        }
      }
      /* gleiches Ladenwort an zwei Nachbarhaeusern derselben Zeile */
      const laeden = BI.liste.filter((e) => e.art === 'laden');
      for (const a of laeden) for (const b2 of laeden) {
        if (b2.nr <= a.nr || a.nx !== b2.nx || a.nz !== b2.nz || a.wort !== b2.wort) continue;
        const A2 = KO[a.haus], B2 = KO[b2.haus];
        if (A2.zeile && A2.zeile === B2.zeile && Math.hypot(A2.x - B2.x, A2.z - B2.z) < (A2.w + B2.w + A2.d + B2.d) / 2 + 0.5) pruef.gleichesWortNachbar++;
      }
      pruef.fehler = F;
      pruef.hart = Object.values(F).reduce((s2, v) => s2 + v, 0);
    }

    /* ---- 3. Fingerabdruck ---- */
    const fp = (t) => t;
    const aufnahme = () => ({
      parkAutos: d.parkAutos().map((p) => [p.x, p.z, p.klasse, p.art, p.ry].join(',')).join(';'),
      wagen: d.cars.map((c) => [c.mesh ? c.mesh.position.x.toFixed(2) : '-', c.mesh ? c.mesh.position.z.toFixed(2) : '-', c.notfall ? 1 : 0].join(',')).join(';'),
      wagenZahl: d.cars.length,
      zivis: d.civilians.map((c) => [c.pos.x.toFixed(2), c.pos.z.toFixed(2), d.ziviLookSchluessel(c) || '-', c.saAnker ? c.saAnker.id : '-'].join(',')).join(';'),
      ziviZahl: d.civilians.length,
      gegner: d.enemies.map((e) => [e.pos.x.toFixed(2), e.pos.z.toFixed(2), e.art || e.typ || '-'].join(',')).join(';'),
      gegnerZahl: d.enemies.length,
    });
    const kollider = d.colliders.filter((c) => !c.bezirksDetail);
    const statisch = {
      bezirke: T.map((t) => t.bi + ',' + t.bj + ',' + t.art).join(';'),
      haeuser: K.map((h) => [h.x, h.z, h.w, h.d, h.h, h.visual, h.textur, h.modell || '-', h.art || '-', h.zeile || '-'].join(',')).join(';'),
      /* Die MENGE der Hindernisse. Ihre Reihenfolge haengt daran, ob
         haeuser.glb oder stadtmoebel.glb zuerst fertig geladen ist (beide
         tragen Hindernisse nach) - sie steht getrennt in kolliderFolge
         und zaehlt nicht als Abweichung der Welt. */
      kollider: kollider.map((c) => [c.x0, c.x1, c.z0, c.z1, c.h, c.y0 === undefined ? '-' : c.y0, c.klein ? 1 : 0].map((v) => typeof v === 'number' ? v.toFixed(2) : v).join(',')).sort().join(';'),
      kolliderFolge: kollider.map((c) => [c.x0, c.x1, c.z0, c.z1, c.h].map((v) => v.toFixed(2)).join(',')).join(';'),
      kolliderZahl: kollider.length,
      kolliderNeu: d.colliders.length - kollider.length,
      pois: POIS.map((p) => [p.id, p.art, p.x, p.z, p.name || '-'].join(',')).join(';'),
      sd: d.strassenDetails().map((e) => [e.nr, e.art, e.x.toFixed(2), e.z.toFixed(2), (e.ry || 0).toFixed(3)].join(',')).join(';'),
      anker: AUF.anker.map((a) => [a.id, a.art, a.x.toFixed(2), a.z.toFixed(2), a.plaetze.length].join(',')).join(';'),
      laternen: d.laterneStellen().map((l) => l.map((v) => (+v).toFixed(2)).join(',')).join(';'),
      neon: d.neonZahl(),
      gehnetz: (() => { const g = d.gehNetz(); return [g.knoten, g.kanten].join(','); })(),
      missionen: (() => { try { return JSON.stringify(d.storyDefs()); } catch (e) { return '-'; } })(),
    };
    const nachLaden = aufnahme();
    for (let i = 0; i < 20; i++) d.schritt(1 / 30, 30);
    const nach20 = aufnahme();
    if (BI) delete BI.liste;
    return { bestand, BI, pruef, statisch, nachLaden, nach20, info: d.hausInfo() };
  });
  await b.close();

  /* Fingerabdruecke */
  const F = {};
  for (const [k, v] of Object.entries(roh.statisch)) F['statisch.' + k] = typeof v === 'string' ? finger(v) : v;
  for (const [k, v] of Object.entries(roh.nachLaden)) F['laden.' + k] = typeof v === 'string' ? finger(v) : v;
  for (const [k, v] of Object.entries(roh.nach20)) F['t20.' + k] = typeof v === 'string' ? finger(v) : v;

  const aus = { seed: SEED, bestand: roh.bestand, neu: roh.BI, pruef: roh.pruef, fingerabdruck: F, hausInfo: roh.info };
  /* Ausgabe Bestand */
  const ARTEN = Object.keys(roh.bestand);
  console.log('\nBESTAND je Stadtteil (Keim ' + SEED + ')');
  console.log('Stadtteil   Bloecke Haeuser Modell Proz. Hoehe(Med/Max) Laeden-Kanten Neon Laternen Ampeln Baenke  Mittelfarbe');
  for (const a of ARTEN) {
    const B = roh.bestand[a];
    console.log(a.padEnd(11) + String(B.bloecke).padStart(7) + String(B.haeuser).padStart(8) + String(B.model).padStart(7) + String(B.merged).padStart(6) +
      (' ' + B.hoeheMedian + '/' + B.hoeheMax).padStart(16) + String(B.kanten.LADEN || 0).padStart(14) + String(B.neon).padStart(5) +
      String(B.laternen).padStart(9) + String(B.ampeln).padStart(7) + String(B.baenke).padStart(7) + '  ' + B.mittelFarbe);
  }
  for (const a of ARTEN) {
    const B = roh.bestand[a];
    const top = Object.entries(B.modelle).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => k + ' ' + v).join(', ');
    console.log('\n' + a + ': Modelle ' + top);
    console.log('  Farben ' + JSON.stringify(B.farben) + '  Kanten ' + JSON.stringify(B.kanten));
    console.log('  Strassendetails ' + JSON.stringify(B.sd) + '  Poller ' + B.poller + ' Beete ' + B.beete);
    console.log('  POIs ' + JSON.stringify(B.pois) + '  U-Bahn ' + B.ubahn + '  Altbau ' + B.altbau + '  Anker ' + JSON.stringify(B.anker));
  }
  let fehler = 0;
  if (roh.pruef) {
    const P = roh.pruef;
    console.log('\nNEUE DETAILS (Stufe 8A): Bauzeit ' + roh.BI.ms + ' ms, ' + roh.BI.dreiecke + ' Dreiecke, Fehler im Bau: ' + roh.BI.fehler);
    console.log('Stadtteil   ' + ['laden', 'buero', 'eingang', 'wegweiser', 'banner', 'portal', 'wahrzeichen', 'vorplatz'].map((k) => k.padStart(12)).join(''));
    for (const a of ARTEN) console.log(a.padEnd(11) + ' ' + ['laden', 'buero', 'eingang', 'wegweiser', 'banner', 'portal', 'wahrzeichen', 'vorplatz'].map((k) => String(P.zahlen[a + ':' + k] || 0).padStart(12)).join(''));
    console.log('Orientierungselemente je Stadtteil ' + JSON.stringify(P.orientierung));
    console.log('Belag ' + JSON.stringify(Object.fromEntries(Object.entries(roh.BI.belag).map(([k, v]) => [k, '#' + v.farbe.toString(16) + ' / ' + v.kachel + ' m']))));
    console.log('verworfen ' + JSON.stringify(roh.BI.verworfen));
    console.log('Abtastung: ' + P.strahlen + ' Strahlen, Tafel->Flaeche ' + P.abstandMin.toFixed(3) + ' bis ' + P.abstandMax.toFixed(3) + ' m');
    console.log('kleinste Schrifthoehe (Zeile/Tafel, m) ' + JSON.stringify(P.schrift) + '   gleiches Ladenwort an Nachbarhaeusern ' + P.gleichesWortNachbar);
    console.log('HARTE FEHLER ' + P.hart + ' ' + JSON.stringify(P.fehler));
    for (const [k, v] of Object.entries(P.beispiele)) console.log('  ' + k + ': ' + JSON.stringify(v));
    if (P.hart) fehler++;
  }
  console.log('neue Hindernisse: ' + (roh.statisch.kolliderNeu || 0));
  if (roh.statisch.kolliderNeu) fehler++;
  if (VERGLEICH) {
    const alt = JSON.parse(fs.readFileSync(VERGLEICH, 'utf8'));
    console.log('\nFINGERABDRUCK gegen ' + VERGLEICH);
    let gleich = 0, anders = 0;
    for (const k of Object.keys(F)) {
      const a2 = alt.fingerabdruck[k];
      if (a2 === undefined) { console.log('  ' + k.padEnd(28) + ' neu'); continue; }
      if (k === 'statisch.kolliderFolge') { console.log('  ' + k.padEnd(28) + (a2 === F[k] ? ' gleich' : ' andere Reihenfolge (Laderennen, nur Hinweis)')); continue; }
      if (a2 === F[k]) gleich++;
      else { anders++; console.log('  ' + k.padEnd(28) + ' VERSCHIEDEN  ' + a2 + ' -> ' + F[k]); }
    }
    console.log('  gleich ' + gleich + ', verschieden ' + anders);
    if (anders) fehler++;
  }
  fs.writeFileSync(ziel, JSON.stringify(aus, null, 1));
  process.exitCode = fehler ? 1 : 0;
})();
