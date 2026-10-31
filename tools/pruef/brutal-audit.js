/* Audit Downtown_Brutal_1 (nur messen): Varianten, Instanzen, Nachbarn je
   Seite; fuer ein Haus je Seite und Spalte (0,25 m) die vorderste
   sichtbare Flaeche im Erdgeschoss (0,1-1,8 m ueber dem Modellboden),
   im Obergeschoss-Band (0,30-0,35 Haushoehen), die Unterkante darueber
   (tiefste Geometrie ueber 1,9 m vor der Erdgeschossfront) und das
   Material der vordersten Erdgeschossflaeche.
   Aufruf: node tools/pruef/brutal-audit.js [modell=Downtown_Brutal_1] [koll=<id>] */
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const MODELL = arg('modell', 'Downtown_Brutal_1');
const KOLL = arg('koll', null);
(async () => {
  const { b, page } = await starte(320, 180, 4711, {});
  const r = await page.evaluate((a) => {
    const d = __dbg, T = window.THREE;
    d.frier(true);
    const namen = {};
    for (const o of d.hausModelle()) namen[o.userData.modellName] = (namen[o.userData.modellName] || 0) + 1;
    const varianten = Object.keys(namen).filter((n) => /Brutal/i.test(n));
    const inst = d.hausModelle().filter((o) => o.userData.modellName === a.MODELL).map((o) => {
      const c = o.userData.hausKiste.koll;
      const frei = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([nx, nz]) => {
        const px = nx ? (nx > 0 ? c.x1 + 0.3 : c.x0 - 0.3) : (c.x0 + c.x1) / 2, pz = nz ? (nz > 0 ? c.z1 + 0.3 : c.z0 - 0.3) : (c.z0 + c.z1) / 2;
        const n = d.colliders.filter((q) => q !== c && !q.klein && (q.h || 0) > 6 && px > q.x0 && px < q.x1 && pz > q.z0 && pz < q.z1);
        return { n: [nx, nz], frei: !n.length };
      });
      return { id: c.id, w: +(c.x1 - c.x0).toFixed(2), dd: +(c.z1 - c.z0).toFixed(2), h: +c.h.toFixed(2), frei };
    });
    const id = a.KOLL !== null ? +a.KOLL : (inst.slice().sort((p, q) => q.frei.filter((f) => f.frei).length - p.frei.filter((f) => f.frei).length)[0] || {}).id;
    const c = d.colliders.find((q) => q.id === id);
    const obj = d.hausModelle().find((o) => o.userData.hausKiste && o.userData.hausKiste.koll === c);
    obj.updateMatrixWorld(true);
    const v = new T.Vector3(), tris = [];
    let minY = 1e9;
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const p = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : p.count;
      const mn = (m.material && m.material.name) || '?';
      for (let i = 0; i + 2 < n; i += 3) {
        const P3 = [];
        for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(m.matrixWorld); P3.push(v.x, v.y, v.z); }
        tris.push({ P3, mn });
        minY = Math.min(minY, P3[1], P3[4], P3[7]);
      }
    });
    const H = c.h - minY, bez0 = minY + 0.30 * H, bez1 = minY + 0.35 * H;
    const seiten = [];
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ax = nx !== 0, l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
      const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      const tiefMax = ax ? (c.x1 - c.x0) : (c.z1 - c.z0);
      const S = 0.25, NL = Math.ceil((l1 - l0) / S);
      const boden = new Float32Array(NL).fill(1e9), mat = new Array(NL).fill(''), oben = new Float32Array(NL).fill(1e9), decke = new Float32Array(NL).fill(1e9);
      for (const { P3, mn } of tris) {
        if (Math.min(P3[1], P3[4], P3[7]) > bez1 + 0.5) continue;
        const lang = Math.max(Math.hypot(P3[3] - P3[0], P3[5] - P3[2], P3[4] - P3[1]), Math.hypot(P3[6] - P3[0], P3[8] - P3[2], P3[7] - P3[1]), Math.hypot(P3[6] - P3[3], P3[8] - P3[5], P3[7] - P3[4]));
        const st = Math.min(500, Math.max(1, Math.ceil(lang / 0.05)));
        for (let s = 0; s <= st; s++) for (let t = 0; t <= st - s; t++) {
          const u = s / st, w = t / st;
          const x = P3[0] + u * (P3[3] - P3[0]) + w * (P3[6] - P3[0]);
          const y = P3[1] + u * (P3[4] - P3[1]) + w * (P3[7] - P3[1]);
          const z = P3[2] + u * (P3[5] - P3[2]) + w * (P3[8] - P3[2]);
          const lt = ax ? z : x, dep = ax ? (front - x) * nx : (front - z) * nz;
          if (dep < -1 || dep > tiefMax + 0.5) continue;
          const il = Math.floor((lt - l0) / S);
          if (il < 0 || il >= NL) continue;
          const hy = y - minY;
          if (hy > 0.1 && hy < 1.8 && dep < boden[il]) { boden[il] = dep; mat[il] = mn; }
          if (y >= bez0 && y <= bez1 && dep < oben[il]) oben[il] = dep;
        }
      }
      for (const { P3 } of tris) {
        if (Math.min(P3[1], P3[4], P3[7]) > bez1 + 0.5) continue;
        const lang = Math.max(Math.hypot(P3[3] - P3[0], P3[5] - P3[2], P3[4] - P3[1]), Math.hypot(P3[6] - P3[0], P3[8] - P3[2], P3[7] - P3[1]), Math.hypot(P3[6] - P3[3], P3[8] - P3[5], P3[7] - P3[4]));
        const st = Math.min(500, Math.max(1, Math.ceil(lang / 0.05)));
        for (let s = 0; s <= st; s++) for (let t = 0; t <= st - s; t++) {
          const u = s / st, w = t / st;
          const x = P3[0] + u * (P3[3] - P3[0]) + w * (P3[6] - P3[0]);
          const y = P3[1] + u * (P3[4] - P3[1]) + w * (P3[7] - P3[1]);
          const z = P3[2] + u * (P3[5] - P3[2]) + w * (P3[8] - P3[2]);
          const lt = ax ? z : x, dep = ax ? (front - x) * nx : (front - z) * nz;
          const il = Math.floor((lt - l0) / S);
          if (il < 0 || il >= NL || y - minY <= 1.9) continue;
          if (dep > 0.02 && dep < Math.min(boden[il], tiefMax) - 0.02 && y < decke[il]) decke[il] = y;
        }
      }
      seiten.push({ n: [nx, nz], l0, NL, tiefMax: +tiefMax.toFixed(2),
                    boden: Array.from(boden).map((q) => q > 1e8 ? null : +q.toFixed(2)), mat,
                    oben: Array.from(oben).map((q) => q > 1e8 ? null : +q.toFixed(2)),
                    decke: Array.from(decke).map((q) => q > 1e8 ? null : +(q - minY).toFixed(2)) });
    }
    return { namen, varianten, inst, id, kasten: [c.x0, c.x1, c.z0, c.z1, c.h].map((q) => +q.toFixed(2)), minY: +minY.toFixed(3), H: +H.toFixed(2), seiten };
  }, { MODELL, KOLL });
  await b.close();
  console.log('Brutal-Varianten: ' + JSON.stringify(r.varianten) + '   Instanzen ' + MODELL + ': ' + r.inst.length);
  const freiJe = { '1,0': 0, '-1,0': 0, '0,1': 0, '0,-1': 0 };
  for (const i of r.inst) for (const f of i.frei) if (f.frei) freiJe[f.n.join(',')]++;
  const ws = r.inst.map((i) => i.w).sort((p, q) => p - q), hs = r.inst.map((i) => i.h).sort((p, q) => p - q);
  console.log('  Breite ' + ws[0] + '-' + ws[ws.length - 1] + ' m, Hoehe ' + hs[0] + '-' + hs[hs.length - 1] + ' m; Seiten ohne Nachbarhaus: ' + JSON.stringify(freiJe));
  console.log('\nHaus ' + r.id + '  Kiste ' + r.kasten.join(' ') + '  Modellboden ' + r.minY + '  Hoehe ueber Boden ' + r.H);
  for (const s of r.seiten) {
    console.log('\nSeite ' + s.n + ' (Tiefe der Kiste ' + s.tiefMax + ' m): Spalte | laengs | Erdgeschoss-Tiefe [Material] | Obergeschoss-Tiefe | Unterkante ueber Boden');
    for (let i = 0; i < s.NL; i++) {
      const f = (v) => v === null ? '    -' : v.toFixed(2).padStart(5);
      console.log('  ' + String(i).padStart(3) + ' ' + (i * 0.25).toFixed(2).padStart(6) + '  ' + f(s.boden[i]) + ' ' + (s.mat[i] || '').padEnd(28) + f(s.oben[i]) + '   ' + f(s.decke[i]));
    }
  }
})();
