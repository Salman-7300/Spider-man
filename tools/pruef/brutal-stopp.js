/* Audit Downtown_Brutal_1 (nur messen): an jeder freien Seite (kein
   Nachbarhaus, Zugang frei) frontal hineingehen (Alt+W); wo bleibt die
   Figur stehen, und wie viel sichtbar freier Raum liegt vor ihr? Freier
   Raum = Strahl in Laufrichtung gegen die Dreiecke des Hausmodells, in
   0,5 / 1,0 / 1,5 m Hoehe, das Minimum. Gegangen wird bei 25, 50 und 75 %
   der Seite (die Seitenmitte trifft oft eine Saeule).
   Aufruf: node tools/pruef/brutal-stopp.js [max=20] */
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const MAX = +arg('max', 20);
(async () => {
  const { b, page } = await starte(320, 180, 4711, {});
  const r = await page.evaluate((MAX) => {
    const d = __dbg, P = d.player, T = window.THREE;
    d.frier(true); d.setzeRegen(0);
    const SLAB = 0.25;
    const ray = new T.Raycaster();
    const faelle = [];
    const haeuser = d.hausModelle().filter((o) => o.userData.modellName === 'Downtown_Brutal_1');
    for (const o of haeuser) {
      const c = o.userData.hausKiste.koll;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = nx !== 0, front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
        const l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
        for (const f of [0.25, 0.5, 0.75]) {
          const t = l0 + f * (l1 - l0);
          /* Zugang: 4,5 m davor ebener Gehweg ohne anderes Hindernis */
          let frei = true;
          for (let s = -0.3; s <= 4.5 && frei; s += 0.25) {
            const x = ax ? front + nx * s : t, z = ax ? t : front + nz * s;
            if (Math.abs(d.groundYAt(x, z) - SLAB) > 0.05) frei = false;
            for (const q of d.colliderNah(x, z)) {
              if (q === c || q.bau === c || (q.h || 0) < 0.3 || (q.y0 !== undefined && q.y0 > 2)) continue;
              if (x > q.x0 - 0.6 && x < q.x1 + 0.6 && z > q.z0 - 0.6 && z < q.z1 + 0.6) frei = false;
            }
          }
          if (!frei) continue;
          d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
          for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ']) d.taste(k, false);
          d.setzePos(ax ? front + nx * 4 : t, SLAB, ax ? t : front + nz * 4);
          P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
          P.facing = Math.atan2(-nx, -nz); d.kamStart(Math.atan2(nx, nz), 0.22);
          for (let i = 0; i < 30; i++) d.schritt(1 / 60);
          d.taste('AltLeft', true); d.taste('KeyW', true);
          for (let i = 0; i < 160; i++) d.schritt(1 / 60);
          d.taste('AltLeft', false); d.taste('KeyW', false);
          const tiefe = ax ? (front - P.pos.x) * nx : (front - P.pos.z) * nz;
          o.updateMatrixWorld(true);
          let luft = 99;
          for (const hy of [0.5, 1.0, 1.5]) {
            ray.set(new T.Vector3(P.pos.x, SLAB + hy, P.pos.z), new T.Vector3(-nx, 0, -nz));
            ray.far = 30;
            const hit = ray.intersectObject(o, true)[0];
            const dist = hit ? hit.distance : 30;
            luft = Math.min(luft, dist);
          }
          /* der Koerper hat halbe Kante 0,45 m: frei vor ihm = Strahl - 0,45 */
          faelle.push({ koll: c.id, seite: [nx, nz], f, tiefe: +tiefe.toFixed(3), freiVorKoerper: +(luft - 0.45).toFixed(2) });
          if (faelle.length >= MAX) return faelle;
        }
      }
    }
    return faelle;
  }, MAX);
  await b.close();
  let gestoppt = 0;
  for (const q of r) {
    const vor = q.freiVorKoerper > 0.1 && q.tiefe < -0.4;
    if (vor) gestoppt++;
    console.log('  Haus ' + String(q.koll).padStart(5) + ' Seite ' + q.seite.join(',').padEnd(5) + ' bei ' + q.f + ': Mittelpunkt ' + q.tiefe.toFixed(3) +
                ' m zur Kistenebene, sichtbar frei vor dem Koerper ' + (q.freiVorKoerper >= 29 ? '> 29 m (durch die Halle)' : q.freiVorKoerper.toFixed(2) + ' m') + (vor ? '   <- unsichtbarer Anschlag' : ''));
  }
  console.log('\n' + r.length + ' Anlaeufe, davon ' + gestoppt + ' vor mehr als 0,1 m sichtbar freiem Raum an der Kistenebene gestoppt');
})();
