/* Mega-Update 1.0, M3: Bilder fuer die Human-Abnahme der Dachkette.
   =========================================================================
   Spielt die Dachparkour-Kette aus tools/pruef/mega-bewegung.js (teil=dach)
   mit denselben echten Eingaben und haelt vier Momente mit der normalen
   Spielkamera fest (HUD sichtbar), dazu eine Seitenansicht des Wandlaufs:
     1  Sprint ueber Dach A, kurz vor der Kante
     2  Netz-Zip ueber der Strasse
     3  Wandlauf an der Fassade von B (Schwung des Zugs)
     4  auf Dach B, Flow-Bonus rechts unter der Kombo
     S  Seitenansicht waehrend des Wandlaufs

   Aufruf:  node tools/pruef/mega-bewegung-bilder.js <ordner> [A=1091] [B=1695] [richtung=+x]
            [alt]   (gleicher Ablauf mit window.__WEBHERO_FLUSS_ALT)
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const ZIEL = process.argv[2];
if (!ZIEL) { console.log('Aufruf: node tools/pruef/mega-bewegung-bilder.js <ordner> [A=] [B=] [richtung=+x] [alt]'); process.exit(1); }
const ALT = process.argv.includes('alt');

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  const { b, page } = await starte(960, 540, Number(arg('keim', 4711)), { frierSofort: true, flussAlt: ALT });
  await page.evaluate(() => {
    const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
    const h = document.getElementById('hud'); if (h) h.style.display = 'block';
  });
  const auf = async (name) => {
    await page.evaluate(() => __dbg.zeichne());
    fs.writeFileSync(path.join(ZIEL, name + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  };
  const ri = arg('richtung', '+x');
  const setup = await page.evaluate(([aId, bId, ri]) => {
    const d = __dbg, P = d.player;
    d.frier(true);
    for (const arr of [d.cars, d.civilians, d.enemies]) if (arr) arr.length = 0;
    const A = d.colliders.find((c) => c.id === aId), B = d.colliders.find((c) => c.id === bId);
    const ax = ri[1], s = ri[0] === '+' ? 1 : -1;
    const quer = (c) => ax === 'x' ? [c.z0, c.z1] : [c.x0, c.x1];
    const [a0, a1] = quer(A), [b0, b1] = quer(B);
    const qm = (Math.max(a0, b0) + 1.5 + Math.min(a1, b1) - 1.5) / 2;
    const k = ax === 'x' ? (s > 0 ? A.x1 : A.x0) : (s > 0 ? A.z1 : A.z0);
    const laengs = ax === 'x' ? A.x1 - A.x0 : A.z1 - A.z0;
    const start = k - s * Math.min(10, laengs - 1);
    if (ax === 'x') d.setzePos(start, A.h + 0.05, qm); else d.setzePos(qm, A.h + 0.05, start);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.facing = ax === 'x' ? (s > 0 ? Math.PI / 2 : -Math.PI / 2) : (s > 0 ? 0 : Math.PI);
    d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.18);
    if (d.mega.flussLeeren) d.mega.flussLeeren();
    d.schritt(1 / 60, 30);
    window.__m3 = { A, B, ax, s, k, i: 0, sprung: -1, zip: -1, an: -1, aufB: -1, aus: false };
    return { ok: Math.abs(P.pos.y - A.h) < 0.4, hA: A.h, hB: B.h };
  }, [Number(arg('A', 1091)), Number(arg('B', 1695)), ri]);
  console.log('Start auf Dach A:', setup.ok, 'hA', setup.hA, 'hB', setup.hB);

  /* Ein Schritt mit den Eingaben der Kette; gibt die Ereignisse zurueck. */
  const schritt = () => page.evaluate(() => {
    const d = __dbg, P = d.player, m = window.__m3;
    const lage = m.ax === 'x' ? P.pos.x : P.pos.z;
    if (m.i === 0) { d.taste('KeyW', true); d.taste('ShiftLeft', true); }
    if (m.sprung < 0 && P.onGround && (m.k - lage) * m.s < 1.7) { m.sprung = m.i; d.tippeSprung(); d.taste('ShiftLeft', false); }
    if (m.sprung >= 0 && m.zip < 0 && m.i === m.sprung + 8) d.webZip();
    d.schritt(1 / 60);
    if (P.state === 'zip' && m.zip < 0) m.zip = m.i;
    if (m.zip >= 0 && m.an < 0 && P.state === 'climb') m.an = m.i;
    const B = m.B;
    if (m.aufB < 0 && P.onGround && P.state === 'ground' && P.pos.x > B.x0 && P.pos.x < B.x1 &&
        P.pos.z > B.z0 && P.pos.z < B.z1 && Math.abs(P.pos.y - B.h) < 0.6) {
      m.aufB = m.i;
      for (const t of ['KeyW', 'ShiftLeft', 'Space']) d.taste(t, false);   // stehen bleiben: Kette endet, Bonus
    }
    m.i++;
    const f = d.mega.fluss();
    return { i: m.i - 1, st: P.state, wl: !!P.wandlauf, lage: +(m.k - lage).toFixed(2) * m.s, sprung: m.sprung, zip: m.zip, an: m.an,
             aufB: m.aufB, anzeige: f.anzeige, pos: [P.pos.x, P.pos.y, P.pos.z], w: P.wallInfo ? [P.wallInfo.nx, P.wallInfo.nz] : null };
  });

  let erst = false, zwei = false, drei = false, seite = false, vier = false, zeilen = [];
  for (let n = 0; n < 900; n++) {
    const z = await schritt();
    zeilen.push(z.i + ' ' + z.st + (z.wl ? ' WL' : '') + ' ' + z.anzeige);
    if (!erst && z.sprung < 0 && z.lage < 3.2) { erst = true; await auf('m3-1-sprint'); }
    if (!zwei && z.zip >= 0 && z.i === z.zip + 6) { zwei = true; await auf('m3-2-zip'); }
    if (!drei && z.an >= 0 && z.i === z.an + 14) {
      drei = true; await auf('m3-3-wandlauf');
      /* Seitenansicht: 12 m seitlich der Wand, auf Hoehe der Figur */
      if (z.w) {
        const [nx, nz] = z.w, p = z.pos;
        await page.evaluate(([p, nx, nz]) => {
          const sx = -nz, sz = nx;                  // laengs der Wand
          __dbg.aufnahme(p[0] + nx * 7 + sx * 9, p[1] + 1.5, p[2] + nz * 7 + sz * 9, p[0], p[1] + 1.2, p[2]);
        }, [p, nx, nz]);
        fs.writeFileSync(path.join(ZIEL, 'm3-s-wandlauf-seite.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
        seite = true;
      }
    }
    if (!vier && z.aufB >= 0 && z.anzeige.indexOf('+') === 0) { vier = true; await auf('m3-4-dach-b-flow'); break; }
  }
  fs.writeFileSync(path.join(ZIEL, 'm3-ablauf.txt'), zeilen.join('\n'));
  console.log('Bilder:', { erst, zwei, drei, seite, vier });
  await b.close();
})();
