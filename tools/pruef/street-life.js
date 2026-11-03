/* CITY V2, Stufe 7A: Strassenleben - der Pruefstand.

   Misst die Bevoelkerung der Strasse so, wie der Spieler sie trifft:
     - wie viele, wo (Stadtteil), welches Modell, welcher Look
     - wie viele davon an den zehn festen Strassenorten wirklich zu sehen
       sind (im Bildausschnitt UND ohne Haus dazwischen) in 25/50/100/150 m
     - ob eine Figur in einem Ding, in einem Haus, auf der Fahrbahn ohne
       Ueberweg, vor einer Haustuer, abseits des Gehnetzes oder in einer
       feststeckenden Traube steht - und wie lange jemand am laengsten still
       steht

   Ablauf: Keim 4711, Spiel im ersten Bild nach dem Laden eingefroren
   (basis.js, frierSofort). Zuerst wird jeder Strassenpassant an seinem
   Startpunkt geprueft, BEVOR ein Schritt gerechnet ist. Dann <dauer>
   Spielsekunden in festen Schritten von 1/30 s, jede Sekunde ein
   Schnappschuss. Die Figur steht unverwundbar auf einem Dach nahe dem
   Startpunkt (unten auf der Kreuzung wuerde sie angegafft); Gangs und
   Vorfaelle sind abgeschaltet, weil fliehende Passanten die Verteilung
   ueberdecken. Mit gegner=<s> folgt danach eine zweite Phase MIT Gangs
   und Vorfaellen - dort wird nur auf Geometriefehler geschaut.

   Harte Fehler (Exit 1): Start in einem Ding, in einem Haus, auf der
   Fahrbahn, im Wasser, vor einer Haustuer, mehr als 3 m neben dem
   Gehnetz oder auf demselben Punkt wie ein anderer; im Lauf eine Figur,
   die laenger als 1 s in einem Haus oder Ding steckt.

   Aufruf:  node tools/pruef/street-life.js [ausgabe.json] [seed=4711]
              [dauer=240] [zivis=N] [cullAlt] [gegner=120]
   ========================================================================= */
const fs = require('node:fs');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]);
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : +a.slice(k.length + 1); };
const SEED = arg('seed', 4711), DAUER = arg('dauer', 240), ZIVIS = arg('zivis', null), GEGNER = arg('gegner', 0);
const CULL_ALT = process.argv.indexOf('cullAlt') > 0;

/* Die zehn Orte aus street-bilder.js / street-life-bilder.js. */
const ORTE = [
  { name: '01-zentrum', teil: 'ZENTRUM', cx: 0, cz: -50, seite: 'N', a0: -13, a1: 15 },
  { name: '02-geschaeft', teil: 'GESCHAEFT', cx: -150, cz: -100, seite: 'O', a0: -13, a1: 15 },
  { name: '03-mischung', teil: 'MISCHUNG', cx: -200, cz: 50, seite: 'N', a0: -13, a1: 15 },
  { name: '04-wohnen', teil: 'WOHN', cx: -250, cz: 100, seite: 'N', a0: -13, a1: 15 },
  { name: '05-parkrand', teil: 'PARK', cx: -200, cz: -150, seite: 'O', a0: -13, a1: 15 },
  { name: '06-park-innen', teil: 'PARK', frei: { x: -213, y: 0.25 + 1.65, z: -151.2, zx: -195, zy: 1.6, zz: -150 } },
  { name: '07-ufer', teil: 'UFER', frei: { x: 186.5, y: 0.25 + 1.65, z: 30, zx: 186.0, zy: 1.5, zz: 58 } },
  { name: '08-boulevard', teil: 'ZENTRUM', cx: 100, cz: 0, seite: 'N', a0: -13, a1: 15 },
  { name: '09-local', teil: 'WOHN', cx: -300, cz: -250, seite: 'S', a0: -13, a1: 15 },
  { name: '10-avenue', teil: 'MISCHUNG', cx: 0, cz: 150, seite: 'O', a0: -13, a1: 15 },
];
function kamera(o) {
  if (o.frei) return o.frei;
  const HALB = 19;
  const n = { N: [0, 1], S: [0, -1], O: [1, 0], W: [-1, 0] }[o.seite];
  const laengs = n[0] !== 0 ? [0, 1] : [1, 0];
  const bord = (a, innen) => [o.cx + n[0] * (HALB - innen) + laengs[0] * a, o.cz + n[1] * (HALB - innen) + laengs[1] * a];
  const [x, z] = bord(o.a0, 2.0), [zx, zz] = bord(o.a1, 1.0);
  return { x, y: 0.25 + 1.65, z, zx, zy: 1.5, zz };
}

(async () => {
  const opt = { frierSofort: true };
  if (ZIVIS !== null) opt.zivis = ZIVIS;
  if (CULL_ALT) opt.ziviCullAlt = true;
  const { b, page } = await starte(1280, 720, SEED, opt);
  const kams = ORTE.map((o) => Object.assign({ name: o.name, teil: o.teil }, kamera(o)));
  const aus = await page.evaluate(({ DAUER, GEGNER, kams }) => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const R = d.raster();
    const SLAB = 0.25;
    /* ---------- Werkzeuge ---------- */
    const teile = new Map(d.stadtteile().map((t) => [t.bi + ',' + t.bj, t.art]));
    const teilAn = (x, z) => {
      if (x > R.x1) return 'UFER';
      const bi = Math.max(0, Math.min(R.blocksX - 1, Math.floor((x - R.x0) / R.pitch)));
      const bj = Math.max(0, Math.min(R.blocksZ - 1, Math.floor((z - R.z0) / R.pitch)));
      return teile.get(bi + ',' + bj) || 'WOHN';
    };
    const strasse = () => d.civilians.filter((c) => c.bahnsteig === undefined && !(c.eingestiegen > 0));
    /* Look: was das Spiel selbst dafuer haelt, sonst aus Modell, Kleidung und Farben. */
    const lookVon = (c) => {
      if (d.ziviLookSchluessel) { const k = d.ziviLookSchluessel(c); if (k) return k; }
      const v = c.visual || {};
      const f = [];
      if (v.root) v.root.traverse((o) => { if (o.isMesh && o.material && /mat$/i.test(o.material.name || '') && o.material.color) f.push(o.material.name + ':' + o.material.color.getHexString()); });
      const of = (v.root && v.root.userData.cityOutfit) || '-';
      if (v.modell === 'civilian3') return v.modell + '|' + ({ Alltag: 'r', Freizeit: 'r', Pendler: 't', Stadt: 't' }[of] || '-');
      return [v.modell, of, Array.from(new Set(f)).sort().join(',')].join('|');
    };
    /* Hindernisse am Koerper: Zylinder r 0,3 m, Hoehe 0,1-1,6 m ueber den Fuessen.
       Arkaden und offene Hallen (c.boden): dort zaehlen nur die massiven Teile. */
    const bodenCache = new Map();
    const steckt = (c) => {
      const x = c.pos.x, z = c.pos.z, y = c.pos.y;
      let haus = 0, ding = 0;
      for (const col of d.colliderNah(x, z)) {
        const y0 = col.y0 === undefined ? -50 : col.y0;
        if ((col.h || 0) <= y + 0.1 || y0 >= y + 1.6) continue;
        const kl = col.klein || col.strassenDetail || (col.h - Math.max(y0, 0)) < 2.5;
        let boxen = [col];
        if (col.boden) {
          if (!bodenCache.has(col.id)) bodenCache.set(col.id, d.bodenProfil(col.id));
          const bp = bodenCache.get(col.id);
          boxen = bp ? bp.teile.filter((t) => t.h > y + 0.1 && t.y0 < y + 1.6) : [col];
        }
        for (const q of boxen) {
          /* Wie tief steckt die Mitte drin? Randkontakt (bis 0,15 m) zaehlt nicht. */
          const tx = Math.min(x - q.x0, q.x1 - x), tz = Math.min(z - q.z0, q.z1 - z);
          if (tx < 0.15 || tz < 0.15) continue;
          if (kl) ding++; else haus++;
        }
      }
      return { haus, ding };
    };
    /* Fahrbahn: Boden auf Strassenhoehe (0), nicht Gehweg (0,25), nicht
       Bruecke, nicht Wasser - und nicht der Treppenschacht der U-Bahn,
       dessen Boden unter null liegt. */
    const fahrbahn = (c) => {
      const gy = d.groundYAt(c.pos.x, c.pos.z, c.pos.y + 0.5);
      if (gy === null || gy === undefined) return false;
      if (d.inWasser(c.pos.x, c.pos.z)) return false;
      if (d.aufBruecke(c.pos.x, c.pos.z)) return false;
      return gy < SLAB - 0.05 && gy > -0.15 && c.pos.y > -1;
    };
    const fall = (art, phase, c, mehr) => lauf.faelle.length < 400 && lauf.faelle.push(Object.assign({ art, phase, t: lauf.schnapp,
      x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), zustand: c.state + ':' + (c.gehZustand || '-'), heimat: c.heimat || 'frei',
      route: c.route ? (c.routeI + '/' + c.route.length) : '-' }, mehr || {}));
    /* Gehnetz als Strecken in einem 10-m-Raster - fuer "wie weit neben dem Netz". */
    const K = d.gehKnotenListe();
    const haupt = (() => { const n = {}; for (const k of K) if (k.insel !== undefined && k.insel >= 0) n[k.insel] = (n[k.insel] || 0) + 1; return +Object.keys(n).sort((a, c) => n[c] - n[a])[0]; })();
    const netz = new Map();
    const zelleN = (x, z) => Math.floor(x / 10) + ',' + Math.floor(z / 10);
    for (let i = 0; i < K.length; i++) {
      const a = K[i];
      if (a.tot || a.insel !== haupt) continue;
      for (const e of a.kanten) {
        if (e.zu < i) continue;
        const z2 = K[e.zu];
        const x0 = Math.min(a.x, z2.x) - 4, x1 = Math.max(a.x, z2.x) + 4, z0 = Math.min(a.z, z2.z) - 4, z1 = Math.max(a.z, z2.z) + 4;
        for (let gx = Math.floor(x0 / 10); gx <= Math.floor(x1 / 10); gx++)
          for (let gz = Math.floor(z0 / 10); gz <= Math.floor(z1 / 10); gz++) {
            const k = gx + ',' + gz;
            if (!netz.has(k)) netz.set(k, []);
            netz.get(k).push([a.x, a.z, z2.x, z2.z]);
          }
      }
    }
    const netzAbstand = (x, z) => {
      let best = 99;
      for (const [ax, az, bx, bz] of (netz.get(zelleN(x, z)) || [])) {
        const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
        best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
      }
      return best;
    };
    /* Haustueren: Vorfeld plus 0,3 m. Arkaden: 1,5-m-Streifen vor jeder Seite. */
    const tueren = d.tuerStellen().map((t) => ({ x0: t.vorfeld.x0 - 0.3, x1: t.vorfeld.x1 + 0.3, z0: t.vorfeld.z0 - 0.3, z1: t.vorfeld.z1 + 0.3, haus: t.haus }));
    const vorTuer = (x, z) => tueren.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
    const arkaden = [];
    for (const col of d.colliders) if (col.boden) arkaden.push({ x0: col.x0 - 1.5, x1: col.x1 + 1.5, z0: col.z0 - 1.5, z1: col.z1 + 1.5 });
    const anArkade = (x, z) => arkaden.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);

    /* ---------- 1. Startpruefung (noch kein Schritt gerechnet) ---------- */
    const start = { gesamt: 0, fehler: { imDing: 0, imHaus: 0, fahrbahn: 0, wasser: 0, vorTuer: 0, abseitsNetz: 0, gleicherPunkt: 0 },
                    hinweis: { anArkade: 0 }, faelle: [] };
    const S0 = strasse();
    for (const c of S0) {
      start.gesamt++;
      const s = steckt(c);
      const f = [];
      if (s.ding) f.push('imDing');
      if (s.haus) f.push('imHaus');
      if (fahrbahn(c)) f.push('fahrbahn');
      if (d.inWasser(c.pos.x, c.pos.z)) f.push('wasser');
      if (vorTuer(c.pos.x, c.pos.z)) f.push('vorTuer');
      if (netzAbstand(c.pos.x, c.pos.z) > 3) f.push('abseitsNetz');
      if (S0.some((o) => o !== c && Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) < 0.5)) f.push('gleicherPunkt');
      if (anArkade(c.pos.x, c.pos.z)) start.hinweis.anArkade++;
      for (const k of f) start.fehler[k]++;
      if (f.length) start.faelle.push({ x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), heimat: c.heimat || 'frei', f });
    }

    /* ---------- Bevoelkerung und Looks am Start ---------- */
    const bev = { gesamt: d.civilians.length, strasse: S0.length, bahnsteig: d.civilians.filter((c) => c.bahnsteig !== undefined).length,
                  jeHeimat: {}, jeModell: {}, jeModellJeTeil: {}, jeOutfit: {}, looks: 0, begleiterGleich: 0, paare: 0 };
    const lookSet = new Set();
    for (const c of S0) {
      const h = c.heimat || 'frei';
      bev.jeHeimat[h] = (bev.jeHeimat[h] || 0) + 1;
      const m = (c.visual && c.visual.modell) || 'prozedural';
      bev.jeModell[m] = (bev.jeModell[m] || 0) + 1;
      const t = c.heimat || teilAn(c.pos.x, c.pos.z);
      bev.jeModellJeTeil[t] = bev.jeModellJeTeil[t] || {};
      bev.jeModellJeTeil[t][m] = (bev.jeModellJeTeil[t][m] || 0) + 1;
      const of = (c.visual && c.visual.root && c.visual.root.userData.cityOutfit) || '-';
      bev.jeOutfit[of] = (bev.jeOutfit[of] || 0) + 1;
      lookSet.add(lookVon(c));
      if (c.begleiter && d.civilians.indexOf(c.begleiter) > d.civilians.indexOf(c)) {
        bev.paare++;
        if (lookVon(c) === lookVon(c.begleiter)) bev.begleiterGleich++;
      }
    }
    bev.looks = lookSet.size;
    bev.plan = d.strassenLeben ? d.strassenLeben() : null;

    /* ---------- 2. Lauf ohne Gangs ---------- */
    /* Die Figur steht waehrend der Messung auf einem Dach nahe dem
       Startpunkt, nicht auf der Startkreuzung: Passanten im Umkreis von
       9 m bleiben stehen und schauen den Helden an - auch mitten auf dem
       Ueberweg. Mit einem eingefrorenen Helden auf der Kreuzung haette die
       Messung das Gaffen gemessen, nicht die Bevoelkerung. Auf dem Dach
       (mehr als 6 m hoeher) schaut niemand, und die Passanten im Zentrum
       werden genauso oft gerechnet wie vorher (FERN zaehlt nur waagerecht). */
    const dach = (() => {
      let best = null;
      for (const col of d.colliders) {
        if (col.klein || col.strassenDetail || col.boden) continue;
        const h = col.h || 0;
        if (h < 10 || h > 60 || col.x1 - col.x0 < 8 || col.z1 - col.z0 < 8) continue;
        const mx = (col.x0 + col.x1) / 2, mz = (col.z0 + col.z1) / 2;
        const dd = Math.hypot(mx - 25, mz - 25);
        if (!best || dd < best.dd) best = { x: mx, z: mz, h, dd };
      }
      return best;
    })();
    const aufsDach = () => { if (dach) d.setzePos(dach.x, dach.h + 0.05, dach.z); };
    aufsDach();
    d.player.iFrames = 1e9;
    const maxE = 14;
    d.setzeTempo('maxEnemies', 0);
    const ohneGegner = () => {
      d.evAlleBeenden();
      for (const e of d.enemies) { const w = e.visual && (e.visual.root || e.visual.group); if (w) w.visible = false; }
      d.enemies.length = 0;
    };
    ohneGegner();
    /* Sicht an den zehn Orten */
    const cam = new THREE.PerspectiveCamera(d.camera.fov, 1280 / 720, 0.1, 900);
    const ORTE = kams.map((k) => {
      cam.position.set(k.x, k.y, k.z); cam.up.set(0, 1, 0); cam.lookAt(k.zx, k.zy, k.zz);
      cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const box = [];
      for (const c of d.colliders) {
        if (c.klein || c.strassenDetail) continue;
        const y0 = c.y0 || 0, h = c.h || 0;
        if (h - y0 < 2.5 || h < 2.5) continue;
        const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2;
        if (Math.hypot(mx - k.x, mz - k.z) > 200 + Math.max(c.x1 - c.x0, c.z1 - c.z0)) continue;
        box.push([c.x0, c.x1, y0, h, c.z0, c.z1]);
      }
      return { name: k.name, teil: k.teil, e: [k.x, k.y, k.z], fr, box };
    });
    const frei = (o, tx, ty, tz) => {
      const [ex, ey, ez] = o.e;
      const dx = tx - ex, dy = ty - ey, dz = tz - ez;
      for (const q of o.box) {
        let t0 = 0, t1 = 1, raus = false;
        for (const [dd, e0, lo, hi] of [[dx, ex, q[0], q[1]], [dy, ey, q[2], q[3]], [dz, ez, q[4], q[5]]]) {
          if (Math.abs(dd) < 1e-9) { if (e0 < lo || e0 > hi) { raus = true; break; } continue; }
          let a = (lo - e0) / dd, c2 = (hi - e0) / dd;
          if (a > c2) { const s = a; a = c2; c2 = s; }
          if (a > t0) t0 = a; if (c2 < t1) t1 = c2;
          if (t0 > t1) { raus = true; break; }
        }
        if (!raus && t1 > 0.02 && t0 < 0.98) return false;
      }
      return true;
    };
    /* ---------- Park und Ufer ----------
       Park: Der Ring um den Park (17 m von der Mitte) liegt seit jeher im
       Rasen - einen gepflasterten Gehweg gibt es dort nicht, der Rasen
       reicht bis an den Bordstein. Rasen allein ist deshalb kein Fehler;
       gezaehlt wird, WO jemand im Park ist:
         busch   - mitten in einem der niedrigen Bueschel am Nord- und
                   Suedrand (createPark: x = +-5,8 ... 9,1 m, z = +-16,05
                   und +-16,5 m; 0,35 x 0,27 m, dazu 0,15 m fuer die Beine)
         scheibe - auf einer Pflanzscheibe (die zwoelf Parkbaeume aus
                   createPark mit 0,94 m, dazu die Pflanzscheiben aus 6A)
         rand    - Rasenstreifen des Rings (mehr als 16,3 m von der Mitte)
         rasen   - Rasen weiter innen, weder Wegekreuz (halbe Breite 1,6 m,
                   0,4 m Spiel) noch Brunnenplatz (bis 6,4 m)
         eingang (letzte 4 m eines Arms), bank (bis 3 m an einer der vier
         Baenke), platz, weg.
       Gezaehlt nur in der ruhigen Phase - fliehende Passanten laufen quer.
       Ufer: Promenade zwischen Promenadenkante und Fluss. */
    const PARKS = (d.parks || []).map((pk) => ({ x: pk.x, z: pk.z, halb: (pk.s || 38) / 2, buesche: [], scheiben: [] }));
    for (const pk of PARKS) {
      const h = pk.halb, rb = Math.min(h - 4.1, h * 0.8);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 14; i++) {
        const x = sx * (5.8 + (i % 7) * 0.55), z = sz * (h - 2.5 - Math.floor(i / 7) * 0.45);
        if (Math.abs(x) <= h - 2) pk.buesche.push([x, z]);
      }
      for (let i = 0; i < 12; i++) {
        const a = (i + 0.5) * Math.PI / 6, x = Math.cos(a) * rb, z = Math.sin(a) * rb;
        if (Math.abs(x) >= 3.2 && Math.abs(z) >= 3.2) pk.scheiben.push([pk.x + x, pk.z + z, 0.94]);
      }
    }
    for (const e of (d.strassenDetails ? d.strassenDetails() : [])) {
      if (e.art !== 'Pflanzscheibe' || !e.kasten) continue;
      const k = e.kasten, mx = (k.x0 + k.x1) / 2, mz = (k.z0 + k.z1) / 2;
      const pk = PARKS.find((q) => Math.abs(mx - q.x) <= q.halb && Math.abs(mz - q.z) <= q.halb);
      if (pk) pk.scheiben.push([mx, mz, Math.max(k.x1 - k.x0, k.z1 - k.z0) / 2]);
    }
    const BAENKE = [[-7, 2.4], [7, 2.4], [2.4, -7], [2.4, 7]];
    const parkZone = (x, z) => {
      for (const pk of PARKS) {
        const dx = x - pk.x, dz = z - pk.z;
        if (Math.abs(dx) > pk.halb + 0.5 || Math.abs(dz) > pk.halb + 0.5) continue;
        if (pk.buesche.some(([bx, bz]) => Math.abs(dx - bx) < 0.5 && Math.abs(dz - bz) < 0.42)) return 'busch';
        if (pk.scheiben.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r)) return 'scheibe';
        if (Math.abs(dx) > 16.3 || Math.abs(dz) > 16.3) return 'rand';
        const r = Math.hypot(dx, dz);
        const aufWeg = Math.abs(dx) < 2.0 || Math.abs(dz) < 2.0 || r < 6.4;
        if (!aufWeg) return 'rasen';
        if (BAENKE.some(([bx, bz]) => Math.hypot(dx - bx, dz - bz) < 3)) return 'bank';
        if (r < 6.4) return 'platz';
        if (Math.max(Math.abs(dx), Math.abs(dz)) > 12.3) return 'eingang';
        return 'weg';
      }
      return null;
    };
    const PROM = { x0: R.promX0, x1: R.flussX0 };
    const aufPromenade = (x, z) => x > PROM.x0 && x < PROM.x1;
    const PARK_ZONEN = ['rand', 'eingang', 'bank', 'platz', 'weg', 'rasen', 'busch', 'scheibe'];
    const park = { faelle: [], jeHeimat: {} };
    for (const k of PARK_ZONEN) park[k] = 0;
    const prom = { summe: 0, max: 0, dichteMax5m: 0 };
    const RADIEN = [25, 50, 100, 150];
    const sumO = ORTE.map(() => ({ bild: [0, 0, 0, 0], umkreis: [0, 0, 0, 0], mind1: [0, 0, 0, 0] }));
    const sp = new THREE.Sphere(new THREE.Vector3(), 0.9);
    /* Laufende Zaehler je Figur */
    const merk = new Map();
    const lauf = { schnapp: 0, imDing: 0, imHaus: 0, fahrbahnOhneUeberweg: 0, fahrbahnFlucht: 0, eingangBlockiert: 0, abseitsNetz: 0,
                   stauGruppen: 0, groessteTraube: 0, schmalBlockiert: 0, doppelteLooksNah: 0, begleiterGleich: 0,
                   laengsterStillstand: { s: 0, zustand: null, x: 0, z: 0 }, laengsterUngewollt: { s: 0, zustand: null, x: 0, z: 0 },
                   dichteMax5m: 0, jeTeilMittel: {}, faelle: [] };
    const gewollt = (c) => ['aktivitaet', 'sozial', 'sozialHin', 'warten'].indexOf(c.gehZustand) >= 0 || !!c.sozialPartner || !!c.gafft || c.state === 'hurt';
    const stauSchon = new Set();
    const tSim = [];
    const teilSumme = {};
    const schritt = (phase) => {
      const t0 = performance.now();
      d.schritt(1 / 30, 30);
      tSim.push(performance.now() - t0);
      if (phase === 'ruhig') ohneGegner();
      if (dach && Math.abs(d.player.pos.y - dach.h) > 1) aufsDach();
      lauf.schnapp++;
      const L = strasse();
      /* Bevoelkerung je Stadtteil */
      for (const c of L) { const t = teilAn(c.pos.x, c.pos.z); teilSumme[t] = (teilSumme[t] || 0) + 1; }
      /* Park und Promenade */
      let aufProm = 0;
      for (const c of L) {
        if (c.pos.y < -1) continue;
        const pz = phase === 'ruhig' ? parkZone(c.pos.x, c.pos.z) : null;
        if (pz) {
          park[pz]++;
          if (pz === 'busch' || pz === 'scheibe' || pz === 'rasen') {
            const h = (park.jeHeimat[pz] || (park.jeHeimat[pz] = {}));
            h[c.heimat || 'frei'] = (h[c.heimat || 'frei'] || 0) + 1;
            if (park.faelle.length < 40) park.faelle.push({ zone: pz, t: lauf.schnapp, x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), zustand: c.state + ':' + (c.gehZustand || '-'), heimat: c.heimat || 'frei' });
          }
        }
        if (aufPromenade(c.pos.x, c.pos.z)) {
          aufProm++;
          let n = 0;
          for (const o of L) if (o !== c && aufPromenade(o.pos.x, o.pos.z) && Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) < 5) n++;
          if (n > prom.dichteMax5m) prom.dichteMax5m = n;
        }
      }
      if (phase === 'ruhig') { prom.summe += aufProm; if (aufProm > prom.max) prom.max = aufProm; }
      /* Je Figur: Stillstand, Fehlerdauern */
      for (const c of L) {
        let m = merk.get(c);
        if (!m) { m = { x: c.pos.x, z: c.pos.z, still: 0, ding: 0, haus: 0, fb: 0, tuer: 0, netz: 0 }; merk.set(c, m); }
        const bew = Math.hypot(c.pos.x - m.x, c.pos.z - m.z);
        m.x = c.pos.x; m.z = c.pos.z;
        m.still = bew < 0.3 ? m.still + 1 : 0;
        if (m.still > lauf.laengsterStillstand.s) lauf.laengsterStillstand = { s: m.still, zustand: c.state + ':' + (c.gehZustand || '-'), x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), heimat: c.heimat || 'frei', warteT: +(c.warteT || 0).toFixed(1) };
        if (!gewollt(c) && m.still > lauf.laengsterUngewollt.s) lauf.laengsterUngewollt = { s: m.still, zustand: c.state + ':' + (c.gehZustand || '-'), x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), heimat: c.heimat || 'frei', route: c.route ? c.routeI + '/' + c.route.length : '-' };
        /* Stillstand ueber 60 s: einmal je Figur notieren */
        if (m.still === 60) fall('still60', phase, c, { warteT: +(c.warteT || 0).toFixed(1), frei: c.frei });
        const s = steckt(c);
        m.ding = s.ding ? m.ding + 1 : 0;
        m.haus = s.haus ? m.haus + 1 : 0;
        if (m.ding === 2) { lauf.imDing++; fall('imDing', phase, c); }
        if (m.haus === 2) { lauf.imHaus++; fall('imHaus', phase, c); }
        const fb = fahrbahn(c);
        const fbOk = c.gehZustand === 'queren';
        m.fb = fb && !fbOk ? m.fb + 1 : 0;
        if (m.fb === 2) { if (c.state === 'walk') { lauf.fahrbahnOhneUeberweg++; fall('fahrbahn', phase, c, { gafft: !!c.gafft, sozial: !!c.sozialPartner }); } else lauf.fahrbahnFlucht++; }
        const steht = m.still >= 2;
        m.tuer = steht && vorTuer(c.pos.x, c.pos.z) ? m.tuer + 1 : 0;
        if (m.tuer === 5) { lauf.eingangBlockiert++; fall('eingang', phase, c); }
        m.netz = c.state === 'walk' && !c.geisel && netzAbstand(c.pos.x, c.pos.z) > 3 ? m.netz + 1 : 0;
        if (m.netz === 3) { lauf.abseitsNetz++; fall('abseitsNetz', phase, c, { abstand: +netzAbstand(c.pos.x, c.pos.z).toFixed(1), y: +c.pos.y.toFixed(2), gafft: !!c.gafft }); }
        /* Steht er an einer engen Stelle? Quer zur Gehrichtung (laengs des
           naechsten Netzstuecks) beidseits innerhalb 1 m ein Hindernis oder
           eine andere Figur - dann kommt dort niemand vorbei. */
        if (m.still >= 5 && !(c.gehZustand === 'warten')) {
          let best = null, bd = 99;
          for (const q of (netz.get(zelleN(c.pos.x, c.pos.z)) || [])) {
            const vx = q[2] - q[0], vz = q[3] - q[1], l2 = vx * vx + vz * vz || 1;
            const t = Math.max(0, Math.min(1, ((c.pos.x - q[0]) * vx + (c.pos.z - q[1]) * vz) / l2));
            const dd = Math.hypot(c.pos.x - q[0] - vx * t, c.pos.z - q[1] - vz * t);
            if (dd < bd) { bd = dd; best = [vx, vz]; }
          }
          if (best) {
            const l = Math.hypot(best[0], best[1]) || 1, qx = -best[1] / l, qz = best[0] / l;
            const zu = (sgn) => {
              for (let o2 = 0.45; o2 <= 1.0; o2 += 0.1) {
                const px = c.pos.x + qx * o2 * sgn, pz = c.pos.z + qz * o2 * sgn;
                for (const col of d.colliderNah(px, pz)) {
                  const y0 = col.y0 === undefined ? -50 : col.y0;
                  if ((col.h || 0) <= c.pos.y + 0.3 || y0 >= c.pos.y + 1.6) continue;
                  if (px > col.x0 && px < col.x1 && pz > col.z0 && pz < col.z1) return true;
                }
                if (d.groundYAt(px, pz, c.pos.y + 0.5) < SLAB - 0.05 && !d.aufBruecke(px, pz)) return true;
                for (const o of L) if (o !== c && Math.hypot(o.pos.x - px, o.pos.z - pz) < 0.35) return true;
              }
              return false;
            };
            if (zu(1) && zu(-1)) { m.schmal = (m.schmal || 0) + 1; if (m.schmal === 1) { lauf.schmalBlockiert++; fall('engeStelle', phase, c, { still: m.still, gafft: !!c.gafft, sozial: !!c.sozialPartner }); } }
            else m.schmal = 0;
          }
        } else m.schmal = 0;
      }
      /* Trauben: Figuren im 2-m-Radius einer anderen (einfache Kette) */
      const besucht = new Set();
      for (const c of L) {
        if (besucht.has(c)) continue;
        const gruppe = [c]; besucht.add(c);
        for (let i = 0; i < gruppe.length; i++) {
          for (const o of L) {
            if (besucht.has(o)) continue;
            if (Math.hypot(o.pos.x - gruppe[i].pos.x, o.pos.z - gruppe[i].pos.z) < 2.0 && Math.abs(o.pos.y - gruppe[i].pos.y) < 1.5) { besucht.add(o); gruppe.push(o); }
          }
        }
        if (gruppe.length > lauf.groessteTraube) lauf.groessteTraube = gruppe.length;
        if (gruppe.length >= 3 && gruppe.every((g) => (merk.get(g) || {}).still >= 10 && !gewollt(g))) {
          const k = gruppe.map((g) => d.civilians.indexOf(g)).sort((a, c2) => a - c2).join(',');
          if (!stauSchon.has(k)) { stauSchon.add(k); lauf.stauGruppen++; fall('stau', phase, c, { n: gruppe.length }); }
        }
      }
      /* Dichte: wie viele andere im 5-m-Umkreis, Hoechstwert */
      for (const c of L) {
        let n = 0;
        for (const o of L) if (o !== c && Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z) < 5) n++;
        if (n > lauf.dichteMax5m) lauf.dichteMax5m = n;
      }
      /* Gleiche Looks nebeneinander (bis 3 m) */
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], c2 = L[j];
        if (Math.hypot(a.pos.x - c2.pos.x, a.pos.z - c2.pos.z) > 3) continue;
        if (lookVon(a) !== lookVon(c2)) continue;
        lauf.doppelteLooksNah++;
        if (a.begleiter === c2) lauf.begleiterGleich++;
      }
      if (phase !== 'ruhig') return;
      /* Sicht an den zehn Orten */
      ORTE.forEach((o, oi) => {
        const n = [0, 0, 0, 0], u = [0, 0, 0, 0];
        for (const c of L) {
          if (c.pos.y < -1) continue;
          const dist = Math.hypot(c.pos.x - o.e[0], c.pos.y + 1.1 - o.e[1], c.pos.z - o.e[2]);
          if (dist > 150) continue;
          const sicht = frei(o, c.pos.x, c.pos.y + 1.5, c.pos.z) || frei(o, c.pos.x, c.pos.y + 0.9, c.pos.z);
          if (!sicht) continue;
          sp.center.set(c.pos.x, c.pos.y + 0.9, c.pos.z);
          const imBild = o.fr.intersectsSphere(sp);
          RADIEN.forEach((r, ri) => { if (dist <= r) { u[ri]++; if (imBild) n[ri]++; } });
        }
        for (let ri = 0; ri < 4; ri++) { sumO[oi].bild[ri] += n[ri]; sumO[oi].umkreis[ri] += u[ri]; if (n[ri] > 0) sumO[oi].mind1[ri]++; }
      });
    };
    for (let s = 0; s < DAUER; s++) schritt('ruhig');
    const nRuhig = lauf.schnapp;
    const sicht = ORTE.map((o, oi) => ({ name: o.name, teil: o.teil,
      bild: sumO[oi].bild.map((v) => +(v / nRuhig).toFixed(2)),
      umkreis: sumO[oi].umkreis.map((v) => +(v / nRuhig).toFixed(2)),
      anteilMind1: sumO[oi].mind1.map((v) => +(v / nRuhig).toFixed(2)) }));
    for (const t of Object.keys(teilSumme)) lauf.jeTeilMittel[t] = +(teilSumme[t] / nRuhig).toFixed(1);
    tSim.sort((a, c) => a - c);
    const simMs = +(tSim[tSim.length >> 1] / 30).toFixed(2);
    const geh = d.gehSuche ? d.gehSuche() : null;
    /* ---------- 3. Optional: mit Gangs und Vorfaellen ---------- */
    let mitGegnern = null;
    if (GEGNER > 0) {
      const vorher = { imDing: lauf.imDing, imHaus: lauf.imHaus, fahrbahnOhneUeberweg: lauf.fahrbahnOhneUeberweg, fahrbahnFlucht: lauf.fahrbahnFlucht, abseitsNetz: lauf.abseitsNetz };
      d.setzeTempo('maxEnemies', maxE);
      let flucht = 0;
      for (let s = 0; s < GEGNER; s++) {
        schritt('gegner');
        flucht += strasse().filter((c) => c.state === 'flee').length;
      }
      mitGegnern = { sekunden: GEGNER, gegnerAmEnde: d.enemies.length, fluchtSekunden: flucht };
      for (const k of Object.keys(vorher)) mitGegnern[k] = lauf[k] - vorher[k];
    }
    lauf.faelle = lauf.faelle.slice(0, 400);
    const nR = Math.max(1, nRuhig);
    const parkAus = { personSekunden: {}, mittel: {}, jeHeimat: park.jeHeimat, faelle: park.faelle };
    for (const k of PARK_ZONEN) { parkAus.personSekunden[k] = park[k]; parkAus.mittel[k] = +(park[k] / nR).toFixed(2); }
    const promAus = { mittel: +(prom.summe / nR).toFixed(2), max: prom.max, dichteMax5m: prom.dichteMax5m };
    return { start, bev, lauf, sicht, simMsJeSchritt: simMs, gehSuche: geh, mitGegnern, heldAufDach: dach, park: parkAus, promenade: promAus };
  }, { DAUER, GEGNER, kams });
  await b.close();

  /* ---------- Bericht ---------- */
  const p = (s) => console.log(s);
  const B = aus.bev, L = aus.lauf, S = aus.start;
  p('== Bevoelkerung ==');
  p('  Zivilisten ' + B.gesamt + '  (Strasse ' + B.strasse + ', U-Bahn ' + B.bahnsteig + ')');
  p('  je Heimat ' + JSON.stringify(B.jeHeimat));
  p('  im Mittel je Stadtteil (Lauf) ' + JSON.stringify(L.jeTeilMittel));
  p('  Modelle ' + JSON.stringify(B.jeModell) + '   Kleidung ' + JSON.stringify(B.jeOutfit));
  p('  verschiedene Looks ' + B.looks + ' von ' + B.strasse + '   Paare ' + B.paare + ' (gleich gekleidet ' + B.begleiterGleich + ')');
  if (B.plan) p('  Plan: soll ' + B.plan.soll + ', gesetzt ' + B.plan.extra + ', ausgelassen ' + B.plan.ausgelassen + ', Parkknoten ' + B.plan.parkKnoten + ', Materialien ' + B.plan.materialien + ', ' + B.plan.ms + ' ms');
  p('== Start (vor dem ersten Schritt) ==');
  p('  geprueft ' + S.gesamt + '   Fehler ' + JSON.stringify(S.fehler) + '   an Arkade (Hinweis) ' + S.hinweis.anArkade);
  for (const f of S.faelle.slice(0, 8)) p('    ' + JSON.stringify(f));
  p('== Sicht (Mittel je Sekunde, ' + DAUER + ' s): im Bild + freie Sicht / Umkreis 360 Grad, 25/50/100/150 m ==');
  for (const e of aus.sicht) p('  ' + e.name.padEnd(14) + ' ' + e.teil.padEnd(9) + ' bild ' + e.bild.join(' / ').padEnd(26) + ' umkreis ' + e.umkreis.join(' / ').padEnd(26) + ' >=1 im Bild ' + e.anteilMind1.join(' / '));
  p('== Lauf ==');
  p('  in Ding >1 s ' + L.imDing + '   in Haus >1 s ' + L.imHaus + '   Fahrbahn ohne Ueberweg (gehend) ' + L.fahrbahnOhneUeberweg + '   (fliehend ' + L.fahrbahnFlucht + ')');
  p('  Eingang blockiert >5 s ' + L.eingangBlockiert + '   abseits Netz >3 s ' + L.abseitsNetz + '   Stau-Trauben ' + L.stauGruppen + '   groesste Traube (2 m) ' + L.groessteTraube + '   enge Stelle blockiert ' + L.schmalBlockiert);
  p('  laengster Stillstand ' + L.laengsterStillstand.s + ' s (' + L.laengsterStillstand.zustand + ')   ungewollt ' + L.laengsterUngewollt.s + ' s (' + L.laengsterUngewollt.zustand + ' bei ' + L.laengsterUngewollt.x + '/' + L.laengsterUngewollt.z + ')');
  p('  dichteste Stelle: ' + L.dichteMax5m + ' andere im 5-m-Umkreis   gleiche Looks unter 3 m: ' + L.doppelteLooksNah + ' Paar-Sekunden (davon Begleiter ' + L.begleiterGleich + ')');
  const PS = aus.park.personSekunden;
  p('  Park (Mittel Personen): ' + JSON.stringify(aus.park.mittel));
  p('  Park, Personen-Sekunden: Rasen innen ' + PS.rasen + '   im Busch ' + PS.busch + '   auf Pflanzscheibe ' + PS.scheibe + '   (Ringstreifen ' + PS.rand + ')');
  p('  Promenade: im Mittel ' + aus.promenade.mittel + ' Personen, hoechstens ' + aus.promenade.max + ', dichteste Stelle ' + aus.promenade.dichteMax5m + ' andere im 5-m-Umkreis');
  p('  Simulation ' + aus.simMsJeSchritt + ' ms je Schritt (Median)' + (aus.gehSuche ? '   Wegsuche ' + aus.gehSuche.anzahl + ' x ' + aus.gehSuche.msJeSuche + ' ms' : ''));
  if (aus.mitGegnern) p('== Mit Gangs ' + JSON.stringify(aus.mitGegnern));
  const hart = Object.values(S.fehler).reduce((a, c) => a + c, 0) + L.imDing + L.imHaus;
  p('== harte Geometriefehler: ' + hart + ' ==');
  if (ziel) fs.writeFileSync(ziel, JSON.stringify(aus, null, 1));
  process.exitCode = hart ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
