/* Diagnose (nur messen): Klettern AUS der Arkade bis aufs Dach - liegen
   Brust oder Becken hinter einer sichtbaren Flaeche? Dieselbe Messung wie
   tools/pruef/kletterproxy.js (chestBehindVisibleSurface /
   pelvisBehindVisibleSurface): echte Knochen spine2/hips, Strahl von
   aussen (3 m entlang der Wandnormale) gegen die Meshes des Hauses;
   eine verdeckende Flaeche hoechstens ANBAU_M hinter der Kistenebene mit
   Wand dahinter (LEERE_M) zaehlt als Anbau, nicht als Fehler.
   Ablauf je Arkadenseite wie arcade-collision.js Schritt F: frontal an
   das Glas gehen (Alt+W), Z + W + Sprung, W halten bis zur Kante.
   Die Arkadenseiten kommen aus der json-Ausgabe von arcade-collision.js
   (Lauf neu).
   Aufruf: node tools/pruef/arkade-rumpf.js json=<datei> [nurKoll=4719+956] */
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const NUR = arg('nurKoll', null);
const JSON_EIN = arg('json', null);
if (!JSON_EIN) { console.log('Aufruf: node tools/pruef/arkade-rumpf.js json=<Ausgabe von arcade-collision.js> [nurKoll=4719+956]'); process.exit(1); }
const FAELLE = JSON.parse(require('node:fs').readFileSync(JSON_EIN, 'utf8')).neu.aus
  .filter((q) => q.gruppe === 'arkade').map((q) => ({ name: q.name, koll: q.koll, nx: q.nx, nz: q.nz, t: q.t }))
  .filter((q) => !NUR || NUR.split('+').map(Number).includes(q.koll));
(async () => {
  const { b, page } = await starte(320, 180, 4711, {});
  const r = await page.evaluate(async (FAELLE) => {
    const d = __dbg, P = d.player, T = window.THREE;
    d.frier(true); d.setzeRegen(0);
    const LEERE_M = 0.75, ANBAU_M = 0.1, SLAB = 0.25;
    const RC = new T.Raycaster();
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ'];
    const frei = () => { for (const t of TASTEN) d.taste(t, false); };
    const aus = [];
    for (const F of FAELLE) {
      const c = d.colliders.find((q) => q.id === F.koll);
      const o = d.hausModelle().find((q) => q.userData.hausKiste && q.userData.hausKiste.koll === c);
      const meshes = []; o.traverse((k) => { if (k.isMesh) meshes.push(k); });
      o.updateMatrixWorld(true);
      const { nx, nz } = F, ax = nx !== 0;
      const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      frei(); d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
      if (P.dead) { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true })); d.taste('Enter', false); }
      d.setzePos(ax ? front + nx * 4 : F.t, SLAB, ax ? F.t : front + nz * 4);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(-nx, -nz); d.kamStart(Math.atan2(nx, nz), 0.22);
      P.hockeT = 0; P.landT = 0; P.rollT = 0;
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      d.taste('AltLeft', true); d.taste('KeyW', true);
      for (let i = 0; i < 160; i++) d.schritt(1 / 60);
      frei(); d.taste('KeyZ', true); d.taste('KeyW', true);
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
      const M = { name: F.name, bilder: 0, brust: 0, becken: 0, anbau: 0, ersteFehler: null, kante: false, maxY: 0 };
      for (let i = 0; i < 1100; i++) {
        d.schritt(1 / 60);
        if (P.state === 'kante') M.kante = true;
        if (M.kante && P.state === 'ground') break;
        if (P.state !== 'climb' || !P.wallInfo || P.wallInfo.col !== c) continue;
        if (P.eckBogen || (P.eckT || 0) > 0) continue;
        M.bilder++; M.maxY = Math.max(M.maxY, P.pos.y);
        const wnx = P.wallInfo.nx, wnz = P.wallInfo.nz;
        const kn = d.animKnochen(['spine2', 'hips']);
        for (const [q, k] of [['brust', kn.spine2], ['becken', kn.hips]]) {
          if (!k) continue;
          RC.set(V(k.x + wnx * 3, k.y, k.z + wnz * 3), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = 3 - 0.02;
          const vorn = RC.intersectObjects(meshes, false);
          if (!vorn.length) continue;
          const tiefeVorn = vorn[0].distance - 3;
          RC.set(V(k.x, k.y, k.z), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = LEERE_M;
          const wandDahinter = RC.intersectObjects(meshes, false).length > 0;
          if (tiefeVorn <= ANBAU_M && wandDahinter) { M.anbau++; continue; }
          M[q]++;
          if (!M.ersteFehler) M.ersteFehler = { q, y: +(k.y - SLAB).toFixed(2), tiefe: +(ax ? (front - P.pos.x) * nx : (front - P.pos.z) * nz).toFixed(3), hautTiefe: +(P.hautTiefe || 0).toFixed(3) };
        }
      }
      frei();
      aus.push(M);
    }
    return aus;
  }, FAELLE);
  await b.close();
  let br = 0, be = 0, an = 0, bi = 0;
  for (const M of r) {
    br += M.brust; be += M.becken; an += M.anbau; bi += M.bilder;
    console.log('  ' + M.name.padEnd(16) + ' Kletterbilder ' + String(M.bilder).padStart(4) + '  Brust hinter Flaeche ' + M.brust + '  Becken ' + M.becken +
                '  (Anbau ' + M.anbau + ')  oben ' + (M.kante ? 'ja' : 'nein, maxY ' + M.maxY.toFixed(1)) + (M.ersteFehler ? '  erstes: ' + JSON.stringify(M.ersteFehler) : ''));
  }
  console.log('\nGESAMT ' + r.length + ' Faelle, ' + bi + ' Kletterbilder: chestBehindVisibleSurface ' + br + '  pelvisBehindVisibleSurface ' + be + '  (hinter Anbau ' + an + ')');
})();
