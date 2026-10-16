/* problem-2, Brutal_1: Messungen fuer das Grundriss-Raster der offenen
   Erdgeschosshalle (siehe baueBodenRaster in game.js) - nur messen.

   teil=oeffnung <ordner>   die dunkle Oeffnung am Kern: Strahlen quer
            durch die Nische (beidseitig, eigene Schnittrechnung gegen ALLE
            Dreiecke des Hauses: erster Treffer, alle weiteren, Vorder-/
            Rueckseite, Material), senkrechte Strahlen im Kern (Boden?
            Decke?), exakte Schnitte (Draufsicht bei 0,5/1,0/1,5/2,0 m,
            Seitenschnitt durch die Nischenmitte), Bilder in Augenhoehe, nah,
            schraeg, Uebersicht, und die Textur der Nischenflaeche.
   teil=masse       Masse fuer die Rasteraufloesung: waagrechte Schnitte
            alle 0,1 m (Umrisse von Saeulen und Kern mit Ausdehnung),
            kleinste Abstaende zwischen Umrissen in 1,0 m Hoehe, Abstand zum
            Kistenrand, nach unten gewandte Flaechen (Hallendecke), Groessen
            aller Brutal-Instanzen.

   Aufruf: node tools/pruef/brutal-raster.js teil=oeffnung|masse [ordner] [koll=2780] */
const path = require('node:path');
const fs = require('node:fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const TEIL = arg('teil', 'masse');
const KOLL = +arg('koll', 2780);
const ziel = process.argv.slice(2).find((v) => !/^[a-z]+=/.test(v)) || 'brutal-oeffnung';

async function oeffnung() {
  fs.mkdirSync(ziel, { recursive: true });
  const { b, page } = await starte(960, 540, 4711, {});
  const r = await page.evaluate((KOLL) => {
    const d = __dbg, T = window.THREE;
    d.frier(true); d.setzeRegen(0); d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const c = d.colliders.find((q) => q.id === KOLL);
    const obj = d.hausModelle().find((o) => o.userData.hausKiste && o.userData.hausKiste.koll === c);
    obj.updateMatrixWorld(true);
    const v = new T.Vector3(), tris = [];
    let minY = 1e9, quad = null;
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const p = m.geometry.attributes.position, uv = m.geometry.attributes.uv, idx = m.geometry.index, n = idx ? idx.count : p.count;
      const mn = m.material.name;
      for (let i = 0; i + 2 < n; i += 3) {
        const P3 = [], U = [];
        for (let k = 0; k < 3; k++) {
          const j = idx ? idx.getX(i + k) : i + k;
          v.fromBufferAttribute(p, j).applyMatrix4(m.matrixWorld); P3.push(v.x, v.y, v.z);
          if (uv) U.push(uv.getX(j), uv.getY(j));
        }
        tris.push({ P3, mn, U });
        minY = Math.min(minY, P3[1], P3[4], P3[7]);
      }
    });
    const W = c.x1 - c.x0, D = c.z1 - c.z0;
    /* beidseitiger Strahltest (Moeller-Trumbore), alle Treffer */
    const strahl = (o, dir, far) => {
      const hits = [];
      for (const t of tris) {
        const P = t.P3;
        const e1 = [P[3] - P[0], P[4] - P[1], P[5] - P[2]], e2 = [P[6] - P[0], P[7] - P[1], P[8] - P[2]];
        const pv = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
        const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2];
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tv = [o[0] - P[0], o[1] - P[1], o[2] - P[2]];
        const uu = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * inv;
        if (uu < 0 || uu > 1) continue;
        const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
        const vv = (dir[0] * qv[0] + dir[1] * qv[1] + dir[2] * qv[2]) * inv;
        if (vv < 0 || uu + vv > 1) continue;
        const dist = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv;
        if (dist < 0 || dist > far) continue;
        /* Normale (Wicklung) gegen die Strahlrichtung: Vorderseite, wenn sie zum Strahl zeigt */
        const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const vorn = nrm[0] * dir[0] + nrm[1] * dir[1] + nrm[2] * dir[2] < 0;
        hits.push({ dist: +dist.toFixed(3), vorn, mn: t.mn });
      }
      hits.sort((p, q) => p.dist - q.dist);
      /* gleiche Flaeche aus zwei Dreiecken (Diagonale) nur einmal */
      return hits.filter((h, i) => i === 0 || Math.abs(h.dist - hits[i - 1].dist) > 0.002 || h.vorn !== hits[i - 1].vorn);
    };
    /* Nische aus kern1: x 4,20-6,01, Rueckwand z 2,71, Laibung bis z 3,05 (relativ zu x0/z0) */
    const nische = { x0: 4.20, x1: 6.01, zRueck: 2.71, zVorn: 3.05 };
    const scan = [];
    for (let xr = 3.5; xr <= 6.71; xr += 0.1) {
      for (const hy of [0.3, 1.0, 1.7, 2.4, 3.1, 3.3]) {
        const o = [c.x0 + xr, minY + hy, c.z0 + 6.0];
        const h = strahl(o, [0, 0, -1], 12);
        scan.push({ xr: +xr.toFixed(2), hy, hits: h.map((q) => ({ z: +(6.0 - q.dist).toFixed(3), vorn: q.vorn, mn: q.mn.replace('Downtown_', '').replace('_FLR_1', '') })) });
      }
    }
    /* senkrecht im Kern: von 3,0 m nach unten, von 0,5 m nach oben */
    const senk = [];
    for (const [xr, zr] of [[5.1, 1.3], [4.0, 0.5], [6.2, 2.3], [5.1, 2.9]]) {
      const ab = strahl([c.x0 + xr, minY + 3.0, c.z0 + zr], [0, -1, 0], 4);
      const auf = strahl([c.x0 + xr, minY + 0.5, c.z0 + zr], [0, 1, 0], 12);
      senk.push({ xr, zr, ab: ab.map((q) => ({ y: +(3.0 - q.dist).toFixed(3), vorn: q.vorn, mn: q.mn })), auf: auf.map((q) => ({ y: +(0.5 + q.dist).toFixed(3), vorn: q.vorn, mn: q.mn })) });
    }
    /* Bodenhoehe der Stadt unter dem Kern */
    const bodenStadt = [[5.1, 1.3], [5.1, 2.9], [5.1, 4.0]].map(([xr, zr]) => +d.groundYAt(c.x0 + xr, c.z0 + zr).toFixed(3));
    /* exakte Schnitte */
    const schnittY = (y) => {
      const seg = [];
      for (const t of tris) {
        const P = t.P3, pts = [];
        for (let k = 0; k < 3; k++) {
          const a = k * 3, bq = ((k + 1) % 3) * 3;
          const ya = P[a + 1], yb = P[bq + 1];
          if ((ya - y) * (yb - y) < 0) { const f = (y - ya) / (yb - ya); pts.push([P[a] + f * (P[bq] - P[a]), P[a + 2] + f * (P[bq + 2] - P[a + 2])]); }
        }
        if (pts.length === 2) seg.push({ a: pts[0], b: pts[1], mn: t.mn });
      }
      return seg;
    };
    const schnittX = (x) => {
      const seg = [];
      for (const t of tris) {
        const P = t.P3, pts = [];
        for (let k = 0; k < 3; k++) {
          const a = k * 3, bq = ((k + 1) % 3) * 3;
          const xa = P[a], xb = P[bq];
          if ((xa - x) * (xb - x) < 0) { const f = (x - xa) / (xb - xa); pts.push([P[a + 2] + f * (P[bq + 2] - P[a + 2]), P[a + 1] + f * (P[bq + 1] - P[a + 1])]); }
        }
        if (pts.length === 2) seg.push({ a: pts[0], b: pts[1], mn: t.mn });
      }
      return seg;
    };
    const schnitte = {};
    for (const hy of [0.5, 1.0, 1.5, 2.0]) schnitte['y' + hy] = schnittY(minY + hy);
    const seite = schnittX(c.x0 + 5.1);
    /* Nischenflaeche: UVs und Textur */
    const qt = tris.filter((t) => t.mn === 'Downtown_Modern_Firstfloor_FLR_1' && Math.abs(t.P3[2] - (c.z0 + nische.zRueck)) < 0.05 && Math.abs(t.P3[5] - t.P3[2]) < 0.01);
    let texInfo = null;
    obj.traverse((m) => {
      if (m.isMesh && m.material.name === 'Downtown_Modern_Firstfloor_FLR_1' && m.material.map && m.material.map.image) {
        const im = m.material.map.image;
        texInfo = { w: im.width, h: im.height, wrapS: m.material.map.wrapS, wrapT: m.material.map.wrapT, flipY: m.material.map.flipY,
                    repeat: [m.material.map.repeat.x, m.material.map.repeat.y], offset: [m.material.map.offset.x, m.material.map.offset.y] };
        try {
          const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
          const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
          texInfo.png = cv.toDataURL('image/png');
        } catch (e) { texInfo.fehler = String(e); }
      }
    });
    const quadUV = qt.map((t) => ({ U: t.U.map((q) => +q.toFixed(4)), P: t.P3.map((q, i) => +(i % 3 === 0 ? q - c.x0 : i % 3 === 1 ? q - minY : q - c.z0).toFixed(3)) }));
    window.__pk = { x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, minY };
    return { kasten: [c.x0, c.x1, c.z0, c.z1, c.h], W, D, minY, scan, senk, bodenStadt, schnitte, seite, quadUV, texInfo, nische };
  }, KOLL);
  fs.writeFileSync(path.join(ziel, 'messung.json'), JSON.stringify({ kasten: r.kasten, W: r.W, D: r.D, minY: r.minY, scan: r.scan, senk: r.senk, bodenStadt: r.bodenStadt, quadUV: r.quadUV, tex: r.texInfo ? { ...r.texInfo, png: undefined } : null }, null, 1));
  if (r.texInfo && r.texInfo.png) fs.writeFileSync(path.join(ziel, 'textur-firstfloor.png'), Buffer.from(r.texInfo.png.split(',')[1], 'base64'));
  /* Bilder */
  const ansichten = {
    '1-augenhoehe-vor-nische': (k) => ({ pos: [k.x0 + 5.1, k.minY + 1.6, k.z0 + 7.0], ziel: [k.x0 + 5.1, k.minY + 1.5, k.z0 + 2.7] }),
    '2-nah-vor-nische': (k) => ({ pos: [k.x0 + 5.1, k.minY + 1.6, k.z0 + 4.6], ziel: [k.x0 + 5.1, k.minY + 1.4, k.z0 + 2.7] }),
    '3-schraeg-nische-tiefe': (k) => ({ pos: [k.x0 + 7.6, k.minY + 1.2, k.z0 + 3.9], ziel: [k.x0 + 5.0, k.minY + 1.4, k.z0 + 2.85] }),
    '4-schraeg-andere-seite': (k) => ({ pos: [k.x0 + 2.6, k.minY + 1.2, k.z0 + 3.9], ziel: [k.x0 + 5.2, k.minY + 1.4, k.z0 + 2.85] }),
    '5-uebersicht-kern': (k) => ({ pos: [k.x0 + 9.5, k.minY + 2.4, k.z0 + 8.6], ziel: [k.x0 + 5.1, k.minY + 2.0, k.z0 + 1.8] }),
    '6-kern-minus-x': (k) => ({ pos: [k.x0 + 0.8, k.minY + 1.6, k.z0 + 4.5], ziel: [k.x0 + 3.7, k.minY + 1.6, k.z0 + 1.3] }),
  };
  for (const [name, f] of Object.entries(ansichten)) {
    await page.evaluate((src) => {
      const k = window.__pk, s = (new Function('k', 'return (' + src + ')(k)'))(k), cam = __dbg.camera;
      const fov = cam.fov; cam.fov = 70; cam.updateProjectionMatrix();
      cam.position.set(...s.pos); cam.lookAt(...s.ziel); cam.updateMatrixWorld(true);
      __dbg.zeichne();
      cam.fov = fov; cam.updateProjectionMatrix();
    }, f.toString());
    await page.screenshot({ path: path.join(ziel, name + '.jpg'), type: 'jpeg', quality: 88 });
  }
  await b.close();
  /* Draufsicht-Schnitte und Seitenschnitt als SVG -> PNG */
  const farbe = (mn) => /Firstfloor/.test(mn) ? '#1060ff' : '#333';
  const [x0, x1, z0, z1] = r.kasten, S = 70, R = 0.8;
  const svgs = {};
  {
    /* Draufsicht: Ausschnitt Kern u 2,8-7,5 m, z -0,6-4,6 m; vier Hoehen nebeneinander */
    const ax0 = 2.8, ax1 = 7.5, az0 = -0.6, az1 = 4.6, BW = (ax1 - ax0) * S, BH = (az1 - az0) * S;
    let inhalt = '';
    Object.keys(r.schnitte).forEach((key, i) => {
      const ox = i * (BW + 20) + 10, oy = 40;
      const X = (x) => (ox + (x - x0 - ax0) * S).toFixed(1), Z = (z) => (oy + (z - z0 - az0) * S).toFixed(1);
      inhalt += '<rect x="' + ox + '" y="' + oy + '" width="' + BW + '" height="' + BH + '" fill="#f6f6f6" stroke="#bbb"/>';
      inhalt += '<line x1="' + X(x0) + '" y1="' + Z(z0) + '" x2="' + X(x0 + 10) + '" y2="' + Z(z0) + '" stroke="#e01010" stroke-dasharray="6 4"/>';
      for (const s of r.schnitte[key]) {
        const ux = Math.max(s.a[0], s.b[0]) - x0, lx = Math.min(s.a[0], s.b[0]) - x0, uz = Math.max(s.a[1], s.b[1]) - z0, lz = Math.min(s.a[1], s.b[1]) - z0;
        if (ux < ax0 || lx > ax1 || uz < az0 || lz > az1) continue;
        inhalt += '<line x1="' + X(s.a[0]) + '" y1="' + Z(s.a[1]) + '" x2="' + X(s.b[0]) + '" y2="' + Z(s.b[1]) + '" stroke="' + farbe(s.mn) + '" stroke-width="' + (/Firstfloor/.test(s.mn) ? 4 : 2.5) + '"/>';
      }
      inhalt += '<text x="' + (ox + 6) + '" y="' + (oy - 10) + '">Schnitt ' + key.slice(1).replace('.', ',') + ' m ueber Boden</text>';
    });
    const GW = 4 * (BW + 20) + 10, GH = BH + 110;
    inhalt += '<text x="10" y="' + (BH + 70) + '">Draufsicht (exakte Schnittlinien aller Dreiecke von Haus ' + KOLL + '), +x rechts, +z unten (Halle), 1 m = ' + S + ' px. schwarz: Beton, blau: Firstfloor-Flaeche (Nischenrueckwand), rot gestrichelt: Kistenebene -z</text>';
    inhalt += '<text x="10" y="' + (BH + 94) + '">Nische: x 4,20-6,01 m (1,81 m breit), 0,34 m tief (z 2,71-3,05 m). Der Kern ist ein geschlossener Ring; innen keine Flaeche.</text>';
    svgs['7-draufsicht-schnitte'] = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + GW + '" height="' + GH + '" style="background:#fff;font:15px sans-serif">' + inhalt + '</svg>', w: GW, h: GH };
  }
  {
    /* Seitenschnitt x = 5,1 m: z waagrecht, y senkrecht */
    const az0 = -0.8, az1 = 9.6, ay1 = 11, BW = (az1 - az0) * S * 0.6, BH = ay1 * S * 0.6, s6 = S * 0.6;
    const Zx = (z) => (20 + (z - z0 - az0) * s6).toFixed(1), Yy = (y) => (30 + (ay1 - (y - r.minY)) * s6).toFixed(1);
    let inhalt = '<rect x="20" y="30" width="' + BW + '" height="' + BH + '" fill="#f6f6f6" stroke="#bbb"/>';
    inhalt += '<line x1="20" y1="' + Yy(r.minY) + '" x2="' + (20 + BW) + '" y2="' + Yy(r.minY) + '" stroke="#999" stroke-dasharray="4 3"/>';
    for (const s of r.seite) inhalt += '<line x1="' + Zx(s.a[0]) + '" y1="' + Yy(s.a[1]) + '" x2="' + Zx(s.b[0]) + '" y2="' + Yy(s.b[1]) + '" stroke="' + farbe(s.mn) + '" stroke-width="' + (/Firstfloor/.test(s.mn) ? 4 : 2.5) + '"/>';
    inhalt += '<line x1="' + Zx(z0) + '" y1="30" x2="' + Zx(z0) + '" y2="' + (30 + BH) + '" stroke="#e01010" stroke-dasharray="6 4"/>';
    inhalt += '<line x1="' + Zx(z1) + '" y1="30" x2="' + Zx(z1) + '" y2="' + (30 + BH) + '" stroke="#e01010" stroke-dasharray="6 4"/>';
    inhalt += '<text x="20" y="20">Seitenschnitt durch die Nischenmitte (x = 5,1 m), Blick in +x; links -z (Kistenebene z0), rechts +z (z1); 1 m = ' + s6.toFixed(0) + ' px</text>';
    inhalt += '<text x="20" y="' + (BH + 60) + '">schwarz: Beton, blau: Firstfloor (Nischenrueckwand z 2,71 m), grau gestrichelt: Boden. Hinter der blauen Flaeche bis zur Wand bei z 0: keine Flaeche, kein Boden.</text>';
    svgs['8-seitenschnitt'] = { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + (BW + 40) + '" height="' + (BH + 80) + '" style="background:#fff;font:15px sans-serif">' + inhalt + '</svg>', w: BW + 40, h: BH + 80 };
  }
  const { chromium } = require(require.resolve('playwright', { paths: [__dirname] }));
  const b2 = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  for (const [name, s] of Object.entries(svgs)) {
    fs.writeFileSync(path.join(ziel, name + '.svg'), s.svg);
    const p2 = await b2.newPage({ viewport: { width: Math.ceil(s.w), height: Math.ceil(s.h) } });
    await p2.setContent('<html><body style="margin:0">' + s.svg + '</body></html>');
    await p2.screenshot({ path: path.join(ziel, name + '.png') });
    await p2.close();
  }
  await b2.close();
  /* Text */
  const out = [];
  out.push('Haus ' + KOLL + ' Kiste ' + r.kasten.map((q) => q.toFixed(3)).join(' ') + '  Modellboden ' + r.minY.toFixed(3) + '  Stadtboden unter Kern/Nische/Halle ' + r.bodenStadt.join(' / '));
  out.push('\nStrahlen in -z (von z 6,0 m aus der Halle), x relativ zu x0; Treffer z (V=Vorderseite zum Strahl, R=Rueckseite):');
  for (const s of r.scan) out.push('  x ' + s.xr.toFixed(2) + ' h ' + s.hy.toFixed(1) + ': ' + (s.hits.map((h) => h.z.toFixed(2) + (h.vorn ? 'V' : 'R') + ' ' + h.mn).join(' | ') || 'kein Treffer'));
  out.push('\nSenkrechte Strahlen:');
  for (const s of r.senk) out.push('  x ' + s.xr + ' z ' + s.zr + '  ab 3,0 m nach unten: ' + (s.ab.map((h) => h.y + (h.vorn ? 'V' : 'R')).join(', ') || 'nichts') + '   ab 0,5 m nach oben: ' + (s.auf.map((h) => h.y + (h.vorn ? 'V' : 'R')).join(', ') || 'nichts'));
  out.push('\nNischenflaeche (Firstfloor) Dreiecke, P relativ (x,y,z), UV:');
  for (const q of r.quadUV) out.push('  P ' + JSON.stringify(q.P) + '  UV ' + JSON.stringify(q.U));
  out.push('Textur: ' + JSON.stringify(r.texInfo ? { ...r.texInfo, png: r.texInfo.png ? '(gespeichert)' : undefined } : null));
  fs.writeFileSync(path.join(ziel, 'messung.txt'), out.join('\n') + '\n');
  console.log(out.slice(0, 3).join('\n'));
  console.log('Bilder in ' + ziel);
}

async function masse() {
  const { b, page } = await starte(320, 180, 4711, {});
  const r = await page.evaluate((KOLL) => {
    const d = __dbg, T = window.THREE;
    d.frier(true);
    const c = d.colliders.find((q) => q.id === KOLL);
    const obj = d.hausModelle().find((o) => o.userData.hausKiste && o.userData.hausKiste.koll === c);
    obj.updateMatrixWorld(true);
    const v = new T.Vector3(), tris = [];
    let minY = 1e9;
    obj.traverse((m) => {
      if (!m.isMesh) return;
      const p = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : p.count;
      for (let i = 0; i + 2 < n; i += 3) {
        const P3 = [];
        for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(m.matrixWorld); P3.push(v.x, v.y, v.z); }
        tris.push(P3);
        minY = Math.min(minY, P3[1], P3[4], P3[7]);
      }
    });
    const W = c.x1 - c.x0, D = c.z1 - c.z0;
    const schnitt = (y) => {
      const seg = [];
      for (const P of tris) {
        const pts = [];
        for (let k = 0; k < 3; k++) {
          const a = k * 3, bq = ((k + 1) % 3) * 3, ya = P[a + 1], yb = P[bq + 1];
          if ((ya - y) * (yb - y) < 0) { const f = (y - ya) / (yb - ya); pts.push([P[a] + f * (P[bq] - P[a]) - c.x0, P[a + 2] + f * (P[bq + 2] - P[a + 2]) - c.z0]); }
        }
        if (pts.length === 2) seg.push(pts);
      }
      /* zusammenhaengende Umrisse: Endpunkte auf 2 mm gleich */
      const key = (p) => Math.round(p[0] * 500) + ',' + Math.round(p[1] * 500);
      const par = new Map();
      const find = (k) => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
      for (const s of seg) { for (const p of s) if (!par.has(key(p))) par.set(key(p), key(p)); const a = find(key(s[0])), bq = find(key(s[1])); if (a !== bq) par.set(a, bq); }
      const komp = new Map();
      for (const s of seg) {
        const k = find(key(s[0]));
        let e = komp.get(k);
        if (!e) { e = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, n: 0, seg: [] }; komp.set(k, e); }
        for (const p of s) { e.x0 = Math.min(e.x0, p[0]); e.x1 = Math.max(e.x1, p[0]); e.z0 = Math.min(e.z0, p[1]); e.z1 = Math.max(e.z1, p[1]); }
        e.n++; e.seg.push(s);
      }
      return [...komp.values()];
    };
    const zeilen = [];
    for (let hy = 0.05; hy <= 10.0; hy += 0.1) {
      const k = schnitt(minY + hy).filter((q) => q.x1 - q.x0 < W * 0.9 || q.z1 - q.z0 < D * 0.9);
      const voll = schnitt(minY + hy).some((q) => q.x1 - q.x0 >= W * 0.9 && q.z1 - q.z0 >= D * 0.9);
      zeilen.push({ hy: +hy.toFixed(2), voll, komp: k.map((q) => ({ x0: +q.x0.toFixed(3), x1: +q.x1.toFixed(3), z0: +q.z0.toFixed(3), z1: +q.z1.toFixed(3), n: q.n })) });
    }
    /* kleinste Abstaende zwischen Umrissen bei 1,0 m (Segment-Segment, grob ueber Punkte alle 2 cm) */
    const k1 = schnitt(minY + 1.0);
    const pkt = k1.map((q) => {
      const P = [];
      for (const s of q.seg) { const L = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]), n = Math.max(1, Math.ceil(L / 0.02)); for (let i = 0; i <= n; i++) P.push([s[0][0] + (s[1][0] - s[0][0]) * i / n, s[0][1] + (s[1][1] - s[0][1]) * i / n]); }
      return { bb: [q.x0, q.x1, q.z0, q.z1], P };
    });
    const abst = [];
    for (let i = 0; i < pkt.length; i++) for (let j = i + 1; j < pkt.length; j++) {
      let best = 1e9;
      for (const a of pkt[i].P) for (const bq of pkt[j].P) { const dd = Math.hypot(a[0] - bq[0], a[1] - bq[1]); if (dd < best) best = dd; }
      abst.push({ i, j, d: +best.toFixed(3), a: pkt[i].bb.map((q) => +q.toFixed(2)), b: pkt[j].bb.map((q) => +q.toFixed(2)) });
    }
    abst.sort((p, q) => p.d - q.d);
    /* Abstand jedes Umrisses zum Kistenrand */
    const rand = pkt.map((q) => ({ bb: q.bb.map((v2) => +v2.toFixed(3)), links: +q.bb[0].toFixed(3), rechts: +(W - q.bb[1]).toFixed(3), vorn: +q.bb[2].toFixed(3), hinten: +(D - q.bb[3]).toFixed(3) }));
    /* nach unten gewandte Flaechen ueber 2 m: Hoehe und Flaeche */
    const decken = new Map();
    for (const P of tris) {
      const e1 = [P[3] - P[0], P[4] - P[1], P[5] - P[2]], e2 = [P[6] - P[0], P[7] - P[1], P[8] - P[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...n);
      if (l < 1e-9 || n[1] / l > -0.5) continue;
      const y = Math.min(P[1], P[4], P[7]) - minY;
      if (y < 0.05 || y > 12) continue;
      const k = (Math.round(y * 100) / 100).toFixed(2);
      decken.set(k, (decken.get(k) || 0) + l / 2);
    }
    /* Instanzen */
    const inst = d.hausModelle().filter((o) => o.userData.modellName === 'Downtown_Brutal_1').map((o) => { const q = o.userData.hausKiste.koll; return { id: q.id, w: +(q.x1 - q.x0).toFixed(2), d: +(q.z1 - q.z0).toFixed(2), h: +q.h.toFixed(2) }; });
    return { kasten: [c.x0, c.x1, c.z0, c.z1, c.h], W, D, minY, zeilen, abst: abst.slice(0, 40), rand, decken: [...decken.entries()].sort((p, q) => +p[0] - +q[0]), inst };
  }, KOLL);
  await b.close();
  console.log('Haus ' + KOLL + ' W ' + r.W.toFixed(3) + ' D ' + r.D.toFixed(3) + ' Modellboden ' + r.minY);
  const ws = r.inst.map((i) => i.w).sort((p, q) => p - q), ds = r.inst.map((i) => i.d).sort((p, q) => p - q), hs = r.inst.map((i) => i.h).sort((p, q) => p - q);
  console.log('Instanzen ' + r.inst.length + ': W ' + ws[0] + '-' + ws[ws.length - 1] + '  D ' + ds[0] + '-' + ds[ds.length - 1] + '  h ' + hs[0] + '-' + hs[hs.length - 1]);
  console.log('  W/D-Verhaeltnis: ' + r.inst.map((i) => (i.w / i.d).toFixed(2)).sort().join(' '));
  console.log('\nSchnitte (Umrisse je Hoehe; x/z relativ zur Kiste):');
  let vorher = '';
  for (const z of r.zeilen) {
    const s = z.komp.map((q) => '[' + q.x0.toFixed(2) + '..' + q.x1.toFixed(2) + ' x ' + q.z0.toFixed(2) + '..' + q.z1.toFixed(2) + ']').join(' ');
    const sig = z.komp.length + '|' + z.komp.map((q) => (q.x1 - q.x0).toFixed(2) + 'x' + (q.z1 - q.z0).toFixed(2)).join(',');
    if (sig !== vorher) console.log('  h ' + z.hy.toFixed(2) + (z.voll ? ' VOLL' : '') + '  ' + z.komp.length + ' Umrisse: ' + s);
    vorher = sig;
  }
  console.log('\nKleinste Abstaende zwischen Umrissen bei 1,0 m:');
  for (const a of r.abst.slice(0, 25)) console.log('  ' + a.d.toFixed(3) + ' m  zwischen ' + JSON.stringify(a.a) + ' und ' + JSON.stringify(a.b));
  console.log('\nAbstand zum Kistenrand bei 1,0 m (links=-x, rechts=+x, vorn=-z, hinten=+z):');
  for (const q of r.rand) console.log('  ' + JSON.stringify(q.bb) + '  -x ' + q.links + '  +x ' + q.rechts + '  -z ' + q.vorn + '  +z ' + q.hinten);
  console.log('\nNach unten gewandte Flaechen (Hoehe ueber Boden: Flaeche m2):');
  console.log('  ' + r.decken.map(([y, a]) => y + ':' + a.toFixed(2)).join('  '));
}

(TEIL === 'oeffnung' ? oeffnung() : masse());
