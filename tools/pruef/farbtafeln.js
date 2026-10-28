/* Qualitaets-Pass, Paket 3: Inventur aller grellen Farbflaechen.

   Sucht in der GANZEN Szene, nicht nur im Leuchtreklame-Mesh:
     1. jedes Mesh mit selbstleuchtendem Material (MeshBasicMaterial oder
        Eigenleuchten) - gruppiert nach Material, mit Zahl, Farbe, Groesse
        und Lage des ersten Vorkommens; Ampeln, Fahrzeuglichter, Marker
        und Fensterlicht stehen dann mit Namen in der Liste und koennen
        von Hand zugeordnet werden;
     2. in den verschmolzenen Deko-Kloetzchen jede flache Tafel ueber
        2,5 m Hoehe, groesser als 0,4 m2, in gesaettigter oder fast
        weisser Farbe;
     3. den Stand der Leuchtreklame (__dbg.neonStand: Kisten, Tafeln im
        Kletter-Overlay).
   Soll nach Paket 3: Leuchtreklame 0 Kisten, 0 Overlay-Tafeln, keine
   gesaettigte Tafel an einer Fassade.

   Aufruf:  node tools/pruef/farbtafeln.js [seed=4711] [neon=an]
            neon=an baut die alte Leuchtreklame (Pruefschalter) - fuer
            Vorher-Bilder im selben Stand.
   ========================================================================= */
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const SEED = +arg('seed', 4711), NEON = arg('neon', '') === 'an';
(async () => {
  const { b, page } = await starte(640, 360, SEED, { frierSofort: true, neonAn: NEON });
  const r = await page.evaluate(() => {
    const d = __dbg, T = THREE;
    const hsv = (c) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return { s: mx ? (mx - mn) / mx : 0, v: mx }; };
    const gruppen = new Map();
    const box = new T.Box3(), groesse = new T.Vector3(), mitte = new T.Vector3();
    d.szene.updateMatrixWorld(true);
    d.szene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        const leuchtet = m.isMeshBasicMaterial || (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.15 && (m.emissiveIntensity || 1) > 0);
        if (!leuchtet) continue;
        let g = gruppen.get(m);
        if (!g) {
          const farbe = m.isMeshBasicMaterial ? m.color : m.emissive;
          g = { typ: m.type, name: m.name || '', meshName: o.name || '', eltern: o.parent ? (o.parent.name || o.parent.type) : '',
                farbe: '#' + farbe.getHexString(), eckfarben: !!m.vertexColors, zahl: 0, sichtbar: 0, instanzen: 0 };
          const hv = hsv(farbe); g.s = +hv.s.toFixed(2); g.v = +hv.v.toFixed(2);
          if (o.geometry) {
            if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.getSize(groesse); box.getCenter(mitte);
            g.groesse = groesse.toArray().map((v) => +v.toFixed(2)); g.lage = mitte.toArray().map((v) => +v.toFixed(1));
          }
          gruppen.set(m, g);
        }
        g.zahl++;
        let sicht = o.visible; for (let p = o.parent; p && sicht; p = p.parent) sicht = p.visible;
        if (sicht) g.sichtbar++;
        if (o.isInstancedMesh) g.instanzen += o.count;
      }
    });
    /* Deko-Tafeln */
    const tafeln = [];
    for (const [w, h, dd, x, y, z, f] of d.dekoIm(-600, 600, 2.5, 400, -600, 600)) {
      const duenn = Math.min(w, h, dd), flaeche = [w * h, w * dd, h * dd].sort((p, q) => q - p)[0];
      if (duenn > 0.12 || flaeche < 0.4 || y < 2.5) continue;
      const c = new T.Color(f), hv = hsv(c);
      if ((hv.s > 0.55 && hv.v > 0.55) || (hv.s < 0.08 && hv.v > 0.93)) tafeln.push({ w, h, d: dd, x, y, z, f });
    }
    const neon = d.neonStand(), nk = d.neonKisten();
    neon.haeuser = new Set(nk.map((q) => q.haus)).size;
    return { gruppen: [...gruppen.values()], tafeln, neon };
  });
  console.log('Leuchtreklame', JSON.stringify(r.neon));
  console.log('Selbstleuchtende Materialien:', r.gruppen.length);
  for (const g of r.gruppen.sort((p, q) => q.zahl - p.zahl)) {
    console.log('  ' + g.typ.padEnd(20) + (g.farbe + (g.eckfarben ? ' +Eckfarben' : '')).padEnd(22) + 's ' + g.s + ' v ' + g.v +
      '  Meshes ' + g.zahl + ' (sichtbar ' + g.sichtbar + (g.instanzen ? ', Instanzen ' + g.instanzen : '') + ')  ' +
      (g.meshName || '-') + ' / ' + (g.eltern || '-') + '  Groesse ' + JSON.stringify(g.groesse) + ' bei ' + JSON.stringify(g.lage));
  }
  console.log('Grelle flache Deko-Tafeln ueber 2,5 m:', r.tafeln.length);
  for (const t of r.tafeln.slice(0, 20)) console.log('  ' + JSON.stringify(t));
  await b.close();
})();
