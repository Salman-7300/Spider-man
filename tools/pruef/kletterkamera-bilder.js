/* problem-2, Punkt A.1: wie SIEHT die Kletterkamera an der Naht aus?

   Die Zahlen stehen in kletterkamera.js. Ein Abstand ist aber kein
   Bild: der Human-Befund lautet "die Kamera klebt an der Figur", und
   das muss man sehen koennen.

   Aufgenommen wird dieselbe Stelle zweimal - einmal mit dem alten
   Strahlanfang (Schalter kamEngAlt), einmal mit dem neuen. Gesucht
   werden Stellen, an denen ein niedriges Haus einen buendigen, hoeheren
   Nachbarn hat; dicht unter der Dachkante liegt der Blickpunkt dort
   ueber dem eigenen Dach, aber immer noch neben dem Nachbarn.

   Mitgemessen, weil ein Bild allein nichts beweist:
     kamAbstand   Abstand der Kamera zur Figur
     blick        Blickrichtung der Kamera - (0,0,-1) heisst, dass
                  lookAt auf den eigenen Standort zeigte und gar keine
                  Richtung mehr uebrig war
     blocker      wer den Strahl einengt, mit Kennung

   Aufruf:  node tools/pruef/kletterkamera-bilder.js <ordner> [seed] [alt]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2] || 'bilder-kletterkamera';
const seed = +(process.argv[3] || 4711);
const alt = process.argv.indexOf('alt') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, seed, alt ? { kamEngAlt: true } : {});
  const stellen = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    const kollVon = (k) => {
      for (const c of d.colliderNah(k.x, k.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - k.x) < 0.05 &&
            Math.abs((c.z0 + c.z1) / 2 - k.z) < 0.05) return c;
      }
      return null;
    };
    /* Gesammelt werden die KOLLIDER, nicht die Hauskisten: die Wand aus
       dem Human-Video gehoert zu keiner Hauskiste, eine Suche ueber die
       Kisten fand null Stellen. */
    const flaechen = [];
    const gesehen = new Set();
    for (const K of d.hausKisten()) {
      for (const c of d.colliderNah(K.x, K.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if ((c.h || 0) < 12 || gesehen.has(c.id)) continue;
        gesehen.add(c.id); flaechen.push(c);
      }
    }
    const aus = [];
    for (const c of flaechen) {
      if (aus.length >= 60) break;
      let fertig = false;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (c.x0 + c.x1) / 2;
        const fz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : (c.z0 + c.z1) / 2;
        for (const n of d.colliderNah(fx, fz)) {
          if (n === c || n.klein || n.innen || n.parkAuto || n.dachProp) continue;
          if ((n.h || 0) < (c.h || 0) + 1.5) continue;
          const buendig = nx !== 0
            ? Math.abs(nx > 0 ? n.x1 - c.x1 : n.x0 - c.x0) < 0.5
            : Math.abs(nz > 0 ? n.z1 - c.z1 : n.z0 - c.z0) < 0.5;
          if (!buendig) continue;
          /* ---- Die Stelle ist die NAHT, nicht die Mitte ----
             Der hoehere Nachbar liegt neben c, er ueberlappt es nicht.
             Gesucht ist daher ein Punkt auf der Wand von c, der dicht
             an der gemeinsamen Grenze liegt: 0,10 m davor ist weniger
             als der Kameraradius von 0,30 m, der Blickpunkt liegt also
             in der aufgeblasenen Huelle des Nachbarn. Genau diese
             Stelle zeigt das Human-Video. */
          const quer = nx !== 0 ? [n.z0 - 0.1, n.z1 + 0.1] : [n.x0 - 0.1, n.x1 + 0.1];
          const tief = nx !== 0 ? [c.z0 + 0.05, c.z1 - 0.05] : [c.x0 + 0.05, c.x1 - 0.05];
          const q = quer.find((v) => v > tief[0] && v < tief[1]);
          if (q === undefined) continue;
          const y = (c.h || 0) - 0.5;
          const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 0.15 : q;
          const pz = nx !== 0 ? q : (nz > 0 ? c.z1 : c.z0) + nz * 0.15;
          aus.push({ nx, nz, x: px, y, z: pz, koll: c.id,
                     nachbar: n.id, hoch: +(c.h || 0).toFixed(1) });
          fertig = true; break;
        }
        if (fertig) break;
      }
    }
    const schritt = Math.max(1, Math.floor(aus.length / 6));
    const w = [];
    for (let i = 0; i < aus.length && w.length < 6; i += schritt) w.push(aus[i]);
    return w;
  });

  const werte = [];
  for (let n = 0; n < stellen.length; n++) {
    const mess = await page.evaluate(async (st) => {
      const d = __dbg, P = d.player;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      const col = d.colliderNah(st.x, st.z).find((c) => c.id === st.koll);
      d.setzeKamYaw(Math.atan2(-st.nx, -st.nz));
      for (let i = 0; i < 90; i++) {
        d.setzePos(st.x, st.y, st.z); P.vel.set(0, 0, 0); P.state = 'climb';
        P.wallInfo = P.wall = { nx: st.nx, nz: st.nz, col }; P.eckSperre = 0;
        d.schritt(1 / 60);
      }
      const k = d.kamera();
      return { pos: [+st.x.toFixed(2), +st.y.toFixed(2), +st.z.toFixed(2)],
               koll: st.koll, nachbar: st.nachbar, hoch: st.hoch,
               kam: k, block: d.kamBlock() };
    }, stellen[n]);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => __dbg.zeichne());
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    }
    const name = String(n + 1).padStart(2, '0') + '-naht';
    await page.screenshot({ path: path.join(ziel, name + '.png') });
    werte.push({ name, ...mess });
    console.log('  ' + name + '   Kameraabstand ' + mess.kam.abstand +
                '   Blick ' + JSON.stringify(mess.kam.blick) +
                '   Blocker ' + (mess.block.blocker ? mess.block.blocker.id : '-'));
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length + ' Aufnahmen' + (alt ? '  (ALTER Strahlanfang)' : ''));
})();
