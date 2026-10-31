/* CITY V2, Stufe 7B: Aufenthalt - der Pruefstand.

   Misst, was die Strassenpassanten ausser Gehen tun und ob es dabei
   geometrisch stimmt:
     - Anker: wie viele Plaetze je Art, Ort und Stadtteil; welche Baenke
       einen Platz bekommen haben und warum nicht; jeder Platz noch einmal
       nachgeprueft (Hindernis, Fahrbahn, Gehnetz, Haustuer, Zebrastreifen,
       Gespraechsplatz: Abstand, Blickrichtung, nichts dazwischen, 1,8 m
       Gehweg daneben frei)
     - Lauf: Beschaeftigungen je Art und Stadtteil, Anteil der Passanten,
       die gerade sitzen/stehen/reden, Belegung der Sitzplaetze,
       Doppelbelegung, Figur in einem Ding oder Haus, abseits ihres Weges,
       Gespraeche (zu nah, zu weit, nicht zugewandt, in einem Hindernis,
       versperrt den Gehweg, durch ein Ding getrennt), wer durch die Beine
       eines Sitzenden laeuft, Trauben, laengster ungewollter Stillstand
       (wie street-life.js; eine Geisel der Mission gilt als gewollt) und
       die Kreuzung 86/-148 fuer sich
     - Sitzen: jede sitzende Figur auf der CPU gehaeutet wie im Shader
       (jeder Vertex), dazu jeder Look einmal auf jeder Bankart -
       Gesaess auf der Sitzflaeche (schwebt / steckt drin), Ruecken vor der
       Lehne, Sohlen auf dem Boden, Blick nach vorn, kein Teil im Nachbarn
     - Gefahr: neben einem Sitzenden, einem Telefonierenden und einem
       Gespraech taucht eine Gang auf - wer aufhoert, wie schnell, ob der
       Platz frei wird, ob danach wieder gegangen wird; niemand bleibt
       neben einem Gegner sitzen oder stehen. Dazu der Spieler 0,3 m neben
       einer sitzenden und einer stehenden Figur (Kollision): der
       Aufenthalt endet, die Figur weicht aus
     - Culling: die Haltungen des Aufenthalts gegen die Huellkugel der
       Passanten (Stufe 7A: Mitte 0,9 m, Halbmesser 1,3 m)
     - Sicht: an den zehn Orten aus street-life.js jede Sekunde, wer im
       Bildkegel der Kamera steht und nicht hinter einem Haus - nach
       Zustand (gehen, sitzen, reden, telefon, warten; Zuordnung wie
       street-life-bilder.js) bis 25/50/100 m, ueber den Lauf gemittelt.
       Laeuft auch auf einem Stand vor 7B (ohne __dbg.aufenthalt): dann
       nur Lauf und Sicht, ohne Anker, Sitzen, Culling und Gefahr - fuer
       den Vergleich vorher/nachher.

   Ablauf wie street-life.js: Keim 4711, Held unverwundbar auf einem Dach
   nahe dem Start, keine Gangs und Vorfaelle im ruhigen Teil.

   Harte Fehler (Exit 1): ungueltiger Anker, Doppelbelegung, Sitzfehler,
   Gespraechsfehler, Figur im Ding/Haus (>= 2 s), jemand laeuft durch
   einen Sitzenden, Aufenthalt neben einem Gegner, Figur bleibt neben dem
   Spieler im Aufenthalt, Ueberstand ueber die Huellkugel.

   Aufruf:  node tools/pruef/street-life-activities.js [ausgabe.json]
              [seed=4711] [dauer=240] [anteil=0.35] [gefahr=1] [kugel=1]
              [mix=<datei.json>]   (Stadtteil -> Gewichte, nur zum Messen)
   ========================================================================= */
const fs = require('node:fs');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]);
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : +a.slice(k.length + 1); };
const SEED = arg('seed', 4711), DAUER = arg('dauer', 240), ANTEIL = arg('anteil', null);
const GEFAHR = arg('gefahr', 1), KUGEL = arg('kugel', 1);
const mixArg = process.argv.find((v) => v.indexOf('mix=') === 0);
const MIX = mixArg ? JSON.parse(fs.readFileSync(mixArg.slice(4), 'utf8')) : null;

/* Die zehn Orte aus street-life.js (Kamera auf Augenhoehe am Gehweg) */
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
const kams = ORTE.map((o) => Object.assign({ name: o.name, teil: o.teil }, kamera(o)));

(async () => {
  const { b, page } = await starte(1280, 720, SEED, { frierSofort: true });
  const fehlerSeite = [];
  page.on('pageerror', (e) => fehlerSeite.push(String(e)));
  const aus = await page.evaluate(({ DAUER, ANTEIL, GEFAHR, KUGEL, MIX, kams }) => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const HAT = !!d.aufenthalt;                   // Stand mit Stufe 7B?
    if (HAT && ANTEIL !== null) d.setzeAufenthaltAnteil(ANTEIL);
    if (HAT && MIX) for (const [t, w] of Object.entries(MIX)) d.setzeAufenthaltMix(t, w);
    const SLAB = 0.25;
    const R = d.raster();
    const teile = new Map(d.stadtteile().map((t) => [t.bi + ',' + t.bj, t.art]));
    const teilAn = (x, z) => {
      if (x > R.x1) return 'UFER';
      const bi = Math.max(0, Math.min(R.blocksX - 1, Math.floor((x - R.x0) / R.pitch)));
      const bj = Math.max(0, Math.min(R.blocksZ - 1, Math.floor((z - R.z0) / R.pitch)));
      return teile.get(bi + ',' + bj) || 'WOHN';
    };
    const strasse = () => d.civilians.filter((c) => c.bahnsteig === undefined && !(c.eingestiegen > 0));
    const plus = (o, k, n) => { o[k] = (o[k] || 0) + (n === undefined ? 1 : n); };
    /* ---------- Werkzeuge (wie street-life.js) ---------- */
    const bodenCache = new Map();
    const steckt = (x, z, y, r) => {
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
          const tx = Math.min(x - q.x0, q.x1 - x), tz = Math.min(z - q.z0, q.z1 - z);
          if (tx < r || tz < r) continue;
          if (kl) ding++; else haus++;
        }
      }
      return { haus, ding };
    };
    /* frei fuer einen Punkt: kein Hindernis auf Koerperhoehe, Boden auf Gehweghoehe */
    const punktFrei = (x, z, r) => {
      if (d.inWasser(x, z)) return false;
      const gy = d.groundYAt(x, z, SLAB + 0.5);
      if (gy === null || gy === undefined || Math.abs(gy - SLAB) > 0.06) return false;
      for (const col of d.colliderNah(x, z)) {
        const y0 = col.y0 === undefined ? -50 : col.y0;
        if ((col.h || 0) <= SLAB + 0.15 || y0 >= SLAB + 1.7) continue;
        if (x > col.x0 - r && x < col.x1 + r && z > col.z0 - r && z < col.z1 + r) return false;
      }
      return true;
    };
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
            netz.get(k).push([a.x, a.z, z2.x, z2.z, !!e.ueberweg]);
          }
      }
    }
    /* naechste Gehnetzkante (ohne Ueberwege), die man vom Punkt aus auch
       erreicht - nicht der Brueckenweg hinter einem Gelaender: Abstand und
       Fusspunkt */
    const netzNah = (x, z) => {
      const kand = [];
      for (const [ax, az, bx, bz, ue] of (netz.get(zelleN(x, z)) || [])) {
        if (ue) continue;
        const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
        const px = ax + vx * t, pz = az + vz * t;
        kand.push({ d: Math.hypot(x - px, z - pz), px, pz });
      }
      kand.sort((a, c) => a.d - c.d);
      for (const k of kand) {
        let frei = true;
        for (let t = 0.1; t < 1; t += 0.1) if (!punktFrei(x + (k.px - x) * t, z + (k.pz - z) * t, 0.02)) { frei = false; break; }
        if (frei) return k;
      }
      return kand.length ? Object.assign({ unerreichbar: true }, kand[0]) : { d: 99, px: x, pz: z };
    };
    const tueren = d.tuerStellen().map((t) => ({ x0: t.vorfeld.x0 - 0.3, x1: t.vorfeld.x1 + 0.3, z0: t.vorfeld.z0 - 0.3, z1: t.vorfeld.z1 + 0.3 }));
    const vorTuer = (x, z) => tueren.some((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
    /* Bleibt neben einem Grundriss (Mitte x,z, Halbmesser r) der Gehweg
       frei? Von der Kante des Grundrisses ueber die naechste Gehnetzlinie
       hinweg 1,8 m: begehbar, ohne Hindernis. */
    const gehwegDaneben = (x, z, r) => {
      const n = netzNah(x, z);
      if (n.d > 6) return true;                    // kein Gehweg in der Naehe
      const l = Math.max(0.01, n.d), nx = (n.px - x) / l, nz = (n.pz - z) / l;
      for (let w = r + 0.05; w <= r + 1.8; w += 0.1) {
        for (const q of [-0.3, 0, 0.3]) {
          const px = x + nx * w - nz * q, pz = z + nz * w + nx * q;
          if (!punktFrei(px, pz, 0.02)) return false;
        }
      }
      return true;
    };
    const winkel = (a, b) => { let x = a - b; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return Math.abs(x); };

    /* ---------- 1. Anker ---------- */
    const A0 = HAT ? d.aufenthalt() : { anker: [], bank: null, ms: 0, fehler: null, sdModelle: null, verworfen: {} };
    const BANK = A0.bank;
    const anker = { gesamt: A0.anker.length, ms: +A0.ms.toFixed(1), fehler: A0.fehler, sdModelleBeimBau: A0.sdModelle, jeArt: {}, plaetzeJeArt: {}, jeOrt: {}, jeTeil: {},
                    verworfen: A0.verworfen, pruefung: { einzel: 0, paar: 0, bank: 0 }, fehlerListe: [] };
    for (const a of A0.anker) {
      plus(anker.jeArt, a.art); plus(anker.plaetzeJeArt, a.art, a.plaetze.length);
      plus(anker.jeOrt, a.art + ':' + a.ort);
      anker.jeTeil[a.teil] = anker.jeTeil[a.teil] || {};
      plus(anker.jeTeil[a.teil], a.art, a.plaetze.length);
    }
    const afehler = (g, a, mehr) => { plus(anker.pruefung, 'fehler'); if (anker.fehlerListe.length < 60) anker.fehlerListe.push(Object.assign({ g, id: a.id, art: a.art, ort: a.ort, x: +a.x.toFixed(1), z: +a.z.toFixed(1) }, mehr || {})); };
    /* Baenke: alle der Stufe 6A und alle Bestandsbaenke auf Strassenhoehe */
    const sdBaenke = d.strassenDetails().filter((e) => e.art === 'Bank');
    const bestBaenke = d.bankStellen().filter((e) => Math.abs(e.y - SLAB) < 0.05);
    const bankMitAnker = new Set(A0.anker.filter((a) => a.art === 'bank').map((a) => Math.round(a.x * 10) + ',' + Math.round(a.z * 10)));
    const baenke = { gesamt: sdBaenke.length + bestBaenke.length, modell: sdBaenke.length, bestand: bestBaenke.length,
                     mitAnker: 0, plaetze: anker.plaetzeJeArt.bank || 0, ohneAnker: [] };
    for (const e of sdBaenke.concat(bestBaenke)) {
      if (bankMitAnker.has(Math.round(e.x * 10) + ',' + Math.round(e.z * 10))) baenke.mitAnker++;
      else if (baenke.ohneAnker.length < 40) baenke.ohneAnker.push([+e.x.toFixed(1), +e.z.toFixed(1)]);
    }
    /* Anlaufweg jedes Platzes: Knoten, Umwegpunkte, Platz - alle 0,3 m
       frei fuer einen Koerper von 0,3 m (jetzt, mit allen Hindernissen,
       auch denen der spaeter geladenen Moebelmodelle). */
    const zugangFrei = (p) => {
      const kn = K[p.knoten];
      const pkt = [[kn.x, kn.z]].concat(p.weg || []).concat([[p.x, p.z]]);
      for (let i = 0; i + 1 < pkt.length; i++) {
        const [ax, az] = pkt[i], [bx, bz] = pkt[i + 1];
        const n2 = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3));
        for (let k = 1; k <= n2; k++) {
          const t = k / n2, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          if (!d.inWasser(x, z) && Math.abs(d.groundYAt(x, z, SLAB + 0.5) - SLAB) > 0.06) return false;
          for (const col of d.colliderNah(x, z)) {
            const y0 = col.y0 === undefined ? -50 : col.y0;
            if ((col.h || 0) <= SLAB + 0.15 || y0 >= SLAB + 1.7) continue;
            if (x > col.x0 - 0.3 && x < col.x1 + 0.3 && z > col.z0 - 0.3 && z < col.z1 + 0.3) return false;
          }
        }
      }
      return true;
    };
    for (const a of A0.anker) {
      for (const p of a.plaetze) if (!zugangFrei(p)) afehler('zugangBlockiert', a, { knoten: p.knoten });
      if (a.art === 'bank') {
        anker.pruefung.bank++;
        const M = BANK[a.bank];
        for (const p of a.plaetze) {
          if (!punktFrei(p.x, p.z, 0.25)) afehler('standpunktBlockiert', a);
          if (vorTuer(p.x, p.z)) afehler('standpunktVorTuer', a);
        }
        /* zwei Plaetze derselben Bank: weit genug auseinander */
        for (let i = 0; i < a.plaetze.length; i++) for (let j = i + 1; j < a.plaetze.length; j++) {
          const dd = Math.hypot(a.plaetze[i].lx - a.plaetze[j].lx, a.plaetze[i].lz - a.plaetze[j].lz);
          if (dd < 0.82 - 1e-6) afehler('plaetzeZuNah', a, { d: +dd.toFixed(3) });
        }
        if (!M) afehler('bankartUnbekannt', a);
        continue;
      }
      for (const p of a.plaetze) {
        if (!punktFrei(p.x, p.z, 0.3)) afehler(a.art + ':hindernis', a);
        if (vorTuer(p.x, p.z)) afehler(a.art + ':vorTuer', a);
        if (netzNah(p.x, p.z).d < 0.75) afehler(a.art + ':aufDemGehweg', a, { d: +netzNah(p.x, p.z).d.toFixed(2) });
        if (!gehwegDaneben(p.x, p.z, 0.35)) afehler(a.art + ':gehwegZu', a);
      }
      if (a.art === 'einzel') { anker.pruefung.einzel++; continue; }
      anker.pruefung.paar++;
      const [P, Q] = a.plaetze;
      const dd = Math.hypot(P.x - Q.x, P.z - Q.z);
      if (Math.abs(dd - 1.25) > 0.02) afehler('paar:abstand', a, { d: +dd.toFixed(3) });
      if (winkel(P.blick, Math.atan2(Q.x - P.x, Q.z - P.z)) > 0.05 || winkel(Q.blick, Math.atan2(P.x - Q.x, P.z - Q.z)) > 0.05) afehler('paar:blick', a);
      for (let t = 0.2; t <= 0.81; t += 0.15) if (!punktFrei(P.x + (Q.x - P.x) * t, P.z + (Q.z - P.z) * t, 0.08)) { afehler('paar:dazwischen', a); break; }
    }

    /* ---------- Held aufs Dach, ohne Gangs (wie street-life.js) ---------- */
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
    d.setzeTempo('maxEnemies', 0);
    const ohneGegner = () => {
      d.evAlleBeenden();
      for (const e of d.enemies) { const w = e.visual && (e.visual.root || e.visual.group); if (w) w.visible = false; }
      d.enemies.length = 0;
    };
    ohneGegner();

    /* ---------- Sicht an den zehn Orten (wie street-life.js) ----------
       Bildkegel der Ortskamera (Kugel 0,9 m um die Koerpermitte) und eine
       freie Sichtlinie zu Kopf oder Koerpermitte gegen alle hohen
       Hindernisse (Haeuser, keine Moebel). */
    const SICHT_ARTEN = ['gehen', 'sitzen', 'reden', 'telefon', 'warten'];
    const SICHT_R = [25, 50, 100];
    const kam = new THREE.PerspectiveCamera(d.camera.fov, 1280 / 720, 0.1, 900);
    const ORTE = kams.map((k) => {
      kam.position.set(k.x, k.y, k.z); kam.up.set(0, 1, 0); kam.lookAt(k.zx, k.zy, k.zz);
      kam.updateMatrixWorld(true); kam.updateProjectionMatrix();
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(kam.projectionMatrix, kam.matrixWorldInverse));
      const box = [];
      for (const c of d.colliders) {
        if (c.klein || c.strassenDetail) continue;
        const y0 = c.y0 || 0, h = c.h || 0;
        if (h - y0 < 2.5 || h < 2.5) continue;
        const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2;
        if (Math.hypot(mx - k.x, mz - k.z) > 200 + Math.max(c.x1 - c.x0, c.z1 - c.z0)) continue;
        box.push([c.x0, c.x1, y0, h, c.z0, c.z1]);
      }
      const sum = {};
      for (const a of SICHT_ARTEN.concat(['gesamt'])) sum[a] = [0, 0, 0];
      return { name: k.name, teil: k.teil, e: [k.x, k.y, k.z], fr, box, sum };
    });
    const sichtFrei = (o, tx, ty, tz) => {
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
    /* Das Handy zeigt das Spiel nur bis 32 m um den Helden (HANDY_FERN).
       Der Held steht hier auf dem Dach; gezaehlt wird, was man saehe,
       stuende er an der Kamera (wie in street-life-bilder.js): wer tippt
       oder telefoniert und hoechstens 32 m entfernt ist. */
    const sichtArt = (c, dist) => {
      if (c.saAnker && c.saArt === 'sitzen' && ['setzen', 'da', 'auf'].indexOf(c.saPhase) >= 0) return 'sitzen';
      if (c.sozialPartner && c.gehZustand === 'sozial') return 'reden';
      if (Math.hypot(c.vel.x, c.vel.z) > 0.3) return 'gehen';
      if (dist <= 32 && (c.ruhePose === 'tippen' || c.ruhePose === 'telefon' || (c.handy && c.handy.visible))) return 'telefon';
      return 'warten';
    };
    const sichtKugel = new THREE.Sphere(new THREE.Vector3(), 0.9);
    let sichtN = 0;
    const sichtZaehlen = (L) => {
      sichtN++;
      for (const o of ORTE) for (const c of L) {
        if (c.pos.y < -1) continue;
        const dist = Math.hypot(c.pos.x - o.e[0], c.pos.y + 1.1 - o.e[1], c.pos.z - o.e[2]);
        if (dist > SICHT_R[SICHT_R.length - 1]) continue;
        sichtKugel.center.set(c.pos.x, c.pos.y + 0.9, c.pos.z);
        if (!o.fr.intersectsSphere(sichtKugel)) continue;
        if (!sichtFrei(o, c.pos.x, c.pos.y + 1.5, c.pos.z) && !sichtFrei(o, c.pos.x, c.pos.y + 0.9, c.pos.z)) continue;
        const a = sichtArt(c, dist);
        SICHT_R.forEach((r, i) => { if (dist <= r) { o.sum[a][i]++; o.sum.gesamt[i]++; } });
      }
    };

    /* ---------- CPU-Haeutung einer Figur ---------- */
    const _p = new THREE.Vector3();
    const punkteVon = (c, schritt) => {
      const root = c.visual.root, aus = [];
      root.updateMatrixWorld(true);
      const fremd = new Set();
      for (const z of [c.handy, c.schirm]) if (z && !z.visible) z.traverse((q) => fremd.add(q));
      root.traverse((o) => {
        if (!o.isMesh || fremd.has(o)) return;
        for (let p = o; p && p !== root; p = p.parent) if (p.visible === false) return;
        const pos = o.geometry.attributes.position;
        const st = o.isSkinnedMesh ? Math.max(1, Math.floor(pos.count / (schritt || 3000))) : 1;
        for (let i = 0; i < pos.count; i += st) {
          if (o.isSkinnedMesh) { o.boneTransform(i, _p); _p.applyMatrix4(o.matrixWorld); }
          else _p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          aus.push(_p.x, _p.y, _p.z);
        }
      });
      return aus;
    };
    const kugelUeber = (c) => {
      const root = c.visual.root;
      let ueber = -1e9;
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!o.isSkinnedMesh || !o.frustumCulled) return;
        for (let p = o; p && p !== root; p = p.parent) if (p.visible === false) return;
        const s = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
        const pos = o.geometry.attributes.position;
        const st = Math.max(1, Math.floor(pos.count / 3000));
        for (let i = 0; i < pos.count; i += st) {
          o.boneTransform(i, _p); _p.applyMatrix4(o.matrixWorld);
          ueber = Math.max(ueber, _p.distanceTo(s.center) - s.radius);
        }
      });
      return ueber;
    };
    /* Sitzgeometrie einer sitzenden Figur gegen ihre Bank */
    const sitzPruefen = (c) => {
      const A = c.saAnker, P = A.plaetze[c.saPlatz], M = BANK[A.bank];
      const fx = P.fx, fz = P.fz, lx = fz, lz = -fx;
      const v = punkteVon(c, Infinity);               // jeder Vertex
      const vorn = M.vorn - M.lehne;              // Sitzkante, von der Lehnenflaeche gemessen
      /* Sitzplatte (beide Bankarten 5,5 cm stark): was ueber ihrer
         Unterkante liegt, ist Gesaess oder Oberschenkel - der tiefste
         Punkt davon gegen die Oberkante (schwebt / sitzt auf); was mehr als
         1,2 cm unter der Oberkante IN der Platte liegt, steckt drin. Waden
         unter der Sitzkante zaehlen nicht - darunter ist frei. */
      let gesaess = Infinity, platte = 0, sohle = Infinity, lehne = Infinity;
      let lat0 = Infinity, lat1 = -Infinity;
      const lehneOben = P.y + (A.bank === 'modell' ? 0.465 : 0.50);
      for (let i = 0; i < v.length; i += 3) {
        const x = v[i], y = v[i + 1], z = v[i + 2];
        const f = (x - P.lx) * fx + (z - P.lz) * fz, q = (x - P.lx) * lx + (z - P.lz) * lz;
        if (y < sohle) sohle = y;
        const ueberSitz = Math.abs(q) < 0.25 && f > 0.02 && f < vorn - 0.005;
        if (ueberSitz && y > P.y - 0.055 && y < P.y + 0.3) gesaess = Math.min(gesaess, y);
        if (ueberSitz && y > P.y - 0.055 && y < P.y - 0.012) platte = Math.max(platte, P.y - y);
        if (y > P.y + 0.08 && y < lehneOben && Math.abs(q) < 0.3) lehne = Math.min(lehne, f);
        if (y > P.y - 0.05) { lat0 = Math.min(lat0, q); lat1 = Math.max(lat1, q); }
      }
      return { gesaessLuft: +(gesaess - P.y).toFixed(3), platte: +platte.toFixed(3), sohle: +(sohle - P.boden).toFixed(3),
               lehne: +lehne.toFixed(3), blick: +winkel(c.facing, P.blick).toFixed(3), wurzelBlick: +winkel(c.visual.root.rotation.y, P.blick).toFixed(3),
               lat: [+lat0.toFixed(3), +lat1.toFixed(3)], anker: A.id, platz: c.saPlatz, bank: A.bank,
               modell: c.visual.modell, outfit: c.look ? c.look.outfit : null, x: +P.lx.toFixed(1), z: +P.lz.toFixed(1) };
    };

    /* ---------- 2. Lauf ---------- */
    const KREUZUNG = { x: 86, z: -148 };
    const lauf = { schnapp: 0, zustand: {}, jeTeil: {}, aktivMittel: 0, stillMittel: 0, aktivMax: 0, stillMax: 0,
                   sitzBelegtMittel: 0, sitzBelegtMax: 0, doppel: 0, gleicheStelle: 0, imDing: 0, imHaus: 0, abseitsWeg: 0,
                   paar: { schnapp: 0, zuNah: 0, zuWeit: 0, nichtZugewandt: 0, imHindernis: 0, gehwegZu: 0, getrennt: 0, abstandMin: 99, abstandMax: 0 },
                   durchSitzende: 0, aktivTraube: 0, stauGruppen: 0, groessteTraube: 0,
                   laengsterUngewollt: { s: 0 }, ungewollt10: 0, geiselSek: 0, kreuzung: { still10: 0, davonAufenthalt: 0, laengster: 0 },
                   sitzMessungen: [], sitz: { gemessen: 0, schwebt: 0, inBank: 0, inLehne: 0, fussHoch: 0, fussTief: 0, blick: 0, imNachbarn: 0 },
                   faelle: [] };
    const fall = (art, c, mehr) => lauf.faelle.length < 200 && lauf.faelle.push(Object.assign({ art, t: lauf.schnapp,
      x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1), zustand: (c.saAnker ? c.saArt + ':' + c.saPhase : c.state + ':' + (c.gehZustand || '-')) }, mehr || {}));
    const art = (c) => {
      if (c.state === 'flee') return 'flucht';
      if (c.state === 'hurt') return 'verletzt';
      if (c.saAnker) {
        if (c.saPhase === 'paar') return c.gehZustand === 'sozial' ? 'reden' : 'weg';
        if (c.saPhase === 'da') return c.saArt === 'reden' ? 'treff' : c.saArt;
        if (c.saPhase === 'setzen' || c.saPhase === 'auf') return 'sitzen';
        if (c.saPhase === 'drehen') return c.saArt === 'sitzen' ? 'sitzen' : c.saArt === 'reden' ? 'treff' : c.saArt;
        return 'weg';
      }
      if (c.gafft) return 'gaffen';
      if (c.gehZustand === 'aktivitaet') return 'kurzHalt';
      if (c.gehZustand === 'queren') return 'queren';
      if (c.gehZustand === 'warten') return 'ampel';
      return 'gehen';
    };
    const STILL = new Set(['sitzen', 'reden', 'treff', 'handy', 'warten', 'umschauen']);
    /* gewollt still: Aufenthalt, Gespraech, Ampel, Gaffen, verletzt - und
       die Geisel einer Mission (stGeisel setzt den naechsten Passanten
       dorthin und haelt ihn fest; der Aufenthalt bricht dabei ab). */
    const gewollt = (c) => !!c.saAnker || ['aktivitaet', 'sozial', 'sozialHin', 'warten'].indexOf(c.gehZustand) >= 0 ||
                           !!c.sozialPartner || !!c.gafft || c.state === 'hurt' || !!c.geisel;
    const merk = new Map();
    const weg = (c) => {
      /* der gepruefte Weg eines Anlaufs: Knoten, Umwegpunkte, Platz */
      const A = c.saAnker, P = A.plaetze[c.saPlatz], kn = K[P.knoten];
      const pkt = (c.saHinStart ? [[c.saHinStart.x, c.saHinStart.z]] : []).concat([[kn.x, kn.z]]).concat(P.weg || []).concat([[P.x, P.z]]);
      let best = 99;
      for (let i = 0; i + 1 < pkt.length; i++) {
        const [ax, az] = pkt[i], [bx, bz] = pkt[i + 1];
        const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((c.pos.x - ax) * vx + (c.pos.z - az) * vz) / l2));
        best = Math.min(best, Math.hypot(c.pos.x - ax - vx * t, c.pos.z - az - vz * t));
      }
      return best;
    };
    const schritt = () => {
      d.schritt(1 / 30, 30);
      ohneGegner();
      if (dach && Math.abs(d.player.pos.y - dach.h) > 1) aufsDach();
      lauf.schnapp++;
      const L = strasse();
      let aktiv = 0, still = 0, sitzBelegt = 0;
      const platzWer = new Map();
      for (const c of L) {
        const a = art(c);
        plus(lauf.zustand, a);
        if (c.geisel) lauf.geiselSek++;
        const t = teilAn(c.pos.x, c.pos.z);
        lauf.jeTeil[t] = lauf.jeTeil[t] || { personen: 0 };
        plus(lauf.jeTeil[t], 'personen'); plus(lauf.jeTeil[t], a);
        if (c.saAnker) {
          aktiv++;
          if (STILL.has(a)) still++;
          if (c.saPhase !== 'route') {
            const k = c.saAnker.id + ':' + c.saPlatz;
            if (platzWer.has(k)) { lauf.doppel++; fall('doppel', c); }
            platzWer.set(k, c);
          }
          if (c.saArt === 'sitzen' && ['setzen', 'da', 'auf'].indexOf(c.saPhase) >= 0) sitzBelegt++;
          if ((c.saPhase === 'hin' || c.saPhase === 'zurueck') && !c.geisel && weg(c) > 0.8) { lauf.abseitsWeg++; fall('abseitsWeg', c, { d: +weg(c).toFixed(2) }); }
        }
        /* im Ding / im Haus: Mittelpunkt mehr als 0,15 m drin, 2 s am Stueck */
        let m = merk.get(c);
        if (!m) { m = { x: c.pos.x, z: c.pos.z, still: 0, ding: 0, haus: 0 }; merk.set(c, m); }
        const s = steckt(c.pos.x, c.pos.z, c.pos.y, 0.15);
        m.ding = s.ding ? m.ding + 1 : 0; m.haus = s.haus ? m.haus + 1 : 0;
        if (m.ding === 2) { lauf.imDing++; fall('imDing', c); }
        if (m.haus === 2) { lauf.imHaus++; fall('imHaus', c); }
        const bew = Math.hypot(c.pos.x - m.x, c.pos.z - m.z);
        m.x = c.pos.x; m.z = c.pos.z;
        m.still = bew < 0.3 ? m.still + 1 : 0;
        /* ungewollt: nur die Sekunden am Stueck, in denen jemand steht und
           gerade NICHTS Gewolltes tut. Wer 40 s auf der Bank sass und in
           der ersten Sekunde nach dem Aufstehen noch am Platz steht, hat
           1 s ungewollten Stillstand, nicht 41 s (so zaehlt street-life.js,
           wo es so lange gewollte Pausen noch nicht gab). */
        const ungew = !gewollt(c);
        m.ungewollt = bew < 0.3 && ungew ? (m.ungewollt || 0) + 1 : 0;
        if (ungew) {
          if (m.ungewollt > lauf.laengsterUngewollt.s) lauf.laengsterUngewollt = { s: m.ungewollt, zustand: c.state + ':' + (c.gehZustand || '-'), x: +c.pos.x.toFixed(1), z: +c.pos.z.toFixed(1) };
          if (m.ungewollt === 10) { lauf.ungewollt10++; fall('ungewollt10', c); }
        }
        if (Math.hypot(c.pos.x - KREUZUNG.x, c.pos.z - KREUZUNG.z) < 8 && m.still === 10) {
          lauf.kreuzung.still10++;
          if (c.saAnker) lauf.kreuzung.davonAufenthalt++;
        }
        if (Math.hypot(c.pos.x - KREUZUNG.x, c.pos.z - KREUZUNG.z) < 8 && ungew) lauf.kreuzung.laengster = Math.max(lauf.kreuzung.laengster, m.ungewollt);
      }
      lauf.aktivMittel += aktiv; lauf.stillMittel += still; lauf.sitzBelegtMittel += sitzBelegt;
      lauf.aktivMax = Math.max(lauf.aktivMax, aktiv); lauf.stillMax = Math.max(lauf.stillMax, still);
      lauf.sitzBelegtMax = Math.max(lauf.sitzBelegtMax, sitzBelegt);
      /* zwei Sitzende an derselben Stelle (Becken naeher als 0,55 m) */
      const sitzende = L.filter((c) => c.saAnker && c.saArt === 'sitzen' && c.saPhase === 'da');
      for (let i = 0; i < sitzende.length; i++) for (let j = i + 1; j < sitzende.length; j++) {
        const P = sitzende[i].saAnker.plaetze[sitzende[i].saPlatz], Q = sitzende[j].saAnker.plaetze[sitzende[j].saPlatz];
        if (Math.hypot(P.lx - Q.lx, P.lz - Q.lz) < 0.55) { lauf.gleicheStelle++; fall('gleicheStelle', sitzende[i]); }
      }
      /* Wer laeuft durch die Beine eines Sitzenden? Beinflaeche von der
         Sitzkante bis zu den Fussspitzen dieser Figur (Hueftgelenk dort,
         wo saSitzLage es hinsetzt, Knoechel 0,46 m davor, Spitzen
         0,24 m weiter), 0,21 m je Seite; der Koerper eines anderen
         (Halbmesser 0,3 m) darf ihr nicht naeher kommen. */
      for (const s of sitzende) {
        const A = s.saAnker, P = A.plaetze[s.saPlatz], M = BANK[A.bank];
        const r = s.saLage ? s.saLage.r : (s.saMass ? Math.min(s.saMass.ruecken, P.rMax) : 0.31) + 0.015;
        const f0 = M.vorn - M.lehne, f1 = r + 0.46 + 0.24;
        for (const o of L) {
          if (o === s || o.saAnker === A || Math.abs(o.pos.y - s.pos.y) > 1) continue;
          const f = (o.pos.x - P.lx) * P.fx + (o.pos.z - P.lz) * P.fz;
          const q = (o.pos.x - P.lx) * P.fz - (o.pos.z - P.lz) * P.fx;
          const df = Math.max(0, f0 - f, f - f1), dq = Math.max(0, Math.abs(q) - 0.21);
          if (Math.hypot(df, dq) < 0.3) { lauf.durchSitzende++; fall('durchSitzende', o, { sitzt: d.civilians.indexOf(s), f: +f.toFixed(2), q: +q.toFixed(2) }); }
        }
      }
      /* Gespraeche */
      for (const c of L) {
        const o = c.sozialPartner;
        if (!o || c.gehZustand !== 'sozial' || o.gehZustand !== 'sozial' || d.civilians.indexOf(o) < d.civilians.indexOf(c)) continue;
        const P = lauf.paar;
        P.schnapp++;
        const dd = Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z);
        P.abstandMin = Math.min(P.abstandMin, dd); P.abstandMax = Math.max(P.abstandMax, dd);
        if (dd < 1.0) { P.zuNah++; fall('paarZuNah', c, { d: +dd.toFixed(2) }); }
        if (dd > 1.6) { P.zuWeit++; fall('paarZuWeit', c, { d: +dd.toFixed(2) }); }
        if ((c.sozialT || 0) > 1 && (winkel(c.facing, Math.atan2(o.pos.x - c.pos.x, o.pos.z - c.pos.z)) > 0.45 ||
                                     winkel(o.facing, Math.atan2(c.pos.x - o.pos.x, c.pos.z - o.pos.z)) > 0.45)) { P.nichtZugewandt++; fall('paarNichtZugewandt', c); }
        const s1 = steckt(c.pos.x, c.pos.z, c.pos.y, 0.05), s2 = steckt(o.pos.x, o.pos.z, o.pos.y, 0.05);
        if (s1.ding || s1.haus || s2.ding || s2.haus) { P.imHindernis++; fall('paarImHindernis', c); }
        if (!gehwegDaneben(c.pos.x, c.pos.z, 0.35) || !gehwegDaneben(o.pos.x, o.pos.z, 0.35)) { P.gehwegZu++; fall('paarGehwegZu', c); }
        for (let t = 0.2; t <= 0.81; t += 0.15) {
          if (!punktFrei(c.pos.x + (o.pos.x - c.pos.x) * t, c.pos.z + (o.pos.z - c.pos.z) * t, 0.05)) { P.getrennt++; fall('paarGetrennt', c); break; }
        }
      }
      /* Trauben (2 m, Kette): wie street-life.js; dazu Trauben, in denen
         mindestens drei im Aufenthalt stehen, die nicht zusammengehoeren
         (nicht dasselbe Gespraech, nicht dieselbe Bank). */
      const besucht = new Set();
      for (const c of L) {
        if (besucht.has(c)) continue;
        const gruppe = [c]; besucht.add(c);
        for (let i = 0; i < gruppe.length; i++) for (const o of L) {
          if (besucht.has(o)) continue;
          if (Math.hypot(o.pos.x - gruppe[i].pos.x, o.pos.z - gruppe[i].pos.z) < 2.0 && Math.abs(o.pos.y - gruppe[i].pos.y) < 1.5) { besucht.add(o); gruppe.push(o); }
        }
        lauf.groessteTraube = Math.max(lauf.groessteTraube, gruppe.length);
        if (gruppe.length >= 3 && gruppe.every((g) => (merk.get(g) || {}).ungewollt >= 10)) { lauf.stauGruppen++; fall('stau', c, { n: gruppe.length }); }
        const imAufenthalt = gruppe.filter((g) => STILL.has(art(g)));
        const anker = new Set(imAufenthalt.map((g) => g.saAnker ? g.saAnker.id : -1));
        if (imAufenthalt.length >= 3 && anker.size >= 2) { lauf.aktivTraube++; fall('aktivTraube', c, { n: imAufenthalt.length, anker: Array.from(anker) }); }
      }
      sichtZaehlen(L);
      /* Sitzgeometrie: alle 10 s jede sichtbare sitzende Figur (jenseits
         LOD_WEITE wird nicht gestellt und nicht gezeichnet) */
      if (lauf.schnapp % 10 === 0) sitzReihe(sitzende.filter((s) => s.visual.root.visible));
    };
    const sitzReihe = (liste) => {
      const jetzt = [];
      for (const s of liste) {
        const r = sitzPruefen(s);
        jetzt.push(r);
        lauf.sitzMessungen.length < 300 && lauf.sitzMessungen.push(r);
        const S = lauf.sitz;
        S.gemessen++;
        if (r.gesaessLuft > 0.03) { S.schwebt++; fall('sitztInDerLuft', s, r); }
        if (r.platte > 0.02) { S.inBank++; fall('steckInDerBank', s, r); }
        if (r.lehne < -0.01) { S.inLehne++; fall('inDerLehne', s, r); }
        if (r.sohle > 0.03) { S.fussHoch++; fall('fussZuHoch', s, r); }
        if (r.sohle < -0.03) { S.fussTief++; fall('fussZuTief', s, r); }
        if (r.blick > 0.1 || r.wurzelBlick > 0.1) { S.blick++; fall('falscheRichtung', s, r); }
      }
      /* Nachbarn auf derselben Bank: laengs ueberlappen sich die Teile nicht
         (lat ist je Platz um den eigenen Lehnenpunkt gemessen) */
      const proBank = new Map();
      for (const r of jetzt) { if (!proBank.has(r.anker)) proBank.set(r.anker, []); proBank.get(r.anker).push(r); }
      for (const l2 of proBank.values()) {
        if (l2.length < 2) continue;
        const A = A0.anker[l2[0].anker];
        const a0 = A.plaetze[l2[0].platz].lang, a1 = A.plaetze[l2[1].platz].lang;
        const [l, r2] = a0 < a1 ? [l2[0], l2[1]] : [l2[1], l2[0]];
        if (Math.min(a0, a1) + l.lat[1] > Math.max(a0, a1) + r2.lat[0]) { lauf.sitz.imNachbarn++; lauf.sitz.paarGemessen = (lauf.sitz.paarGemessen || 0) + 1; }
        else lauf.sitz.paarGemessen = (lauf.sitz.paarGemessen || 0) + 1;
      }
    };
    for (let s = 0; s < DAUER; s++) schritt();
    /* Zaehler am Ende des Laufs festhalten - die Proben danach (Kugel,
       Sitzen je Look, Gefahr, Spieler) rechnen weiter und setzen selbst
       Passanten hin; ihre Zaehler stehen getrennt in statNachProben. */
    const aLauf = HAT ? d.aufenthalt() : null;
    const zaehlerLauf = { stat: aLauf ? aLauf.stat : null, gespraeche: d.gehStat().gespraeche };
    /* ---------- 3. Culling-Kugel in den Haltungen des Aufenthalts ----------
       gleich nach dem Lauf: die Sitzprobe danach setzt Passanten auf
       Baenke und beendet dabei laufende Aufenthalte */
    /* Die stehenden Haltungen (Handy, Warten, Umschauen, Treffpunkt,
       Gespraech): zu jedem kurz hinueber (8,5 m hoch, dort gafft niemand;
       das Handy ist dann in der Hand, wie neben dem Spieler), zwei Bilder
       rechnen, messen - gestellt und gezeichnet werden nur nahe Figuren.
       Die Sitzhaltungen misst "Sitzen je Look" (jeder Look, jede Bankart). */
    const kugel = { gemessen: 0, max: -9, jeArt: {}, liste: 0, vorbei: 0, unsichtbar: 0 };
    if (KUGEL && HAT) {
      const liste = strasse().filter((c) => c.saAnker && STILL.has(art(c)) && art(c) !== 'sitzen').slice(0, 24);
      kugel.liste = liste.length;
      for (const c of liste) {
        if (!(c.saAnker && STILL.has(art(c)))) { kugel.vorbei++; continue; }
        d.setzePos(c.pos.x + 4, 8.5, c.pos.z + 4);
        d.schritt(1 / 30, 4);                      // ferne Figuren rechnen nur jedes dritte Bild
        if (!c.saAnker || !STILL.has(art(c))) { kugel.vorbei++; continue; }
        if (!c.visual.root.visible) { kugel.unsichtbar++; continue; }
        const u = kugelUeber(c);
        kugel.gemessen++;
        kugel.max = Math.max(kugel.max, u);
        const k = art(c) + (c.handy && c.handy.visible ? ' mit Handy' : '');
        kugel.jeArt[k] = Math.max(kugel.jeArt[k] === undefined ? -9 : kugel.jeArt[k], +u.toFixed(3));
      }
      aufsDach();
      d.schritt(1 / 30, 2);
      kugel.max = +kugel.max.toFixed(3);
    }

    /* Sitzprobe ueber die ganze Stadt: zu jedem, der gerade sitzt, kurz
       hinueber (8,5 m hoch, dort gafft niemand), zwei Bilder rechnen
       lassen, messen. Danach zurueck aufs Dach. */
    {
      const sitzend = strasse().filter((c) => c.saAnker && c.saArt === 'sitzen' && c.saPhase === 'da').slice(0, 30);
      for (const s of sitzend) {
        if (!(s.saAnker && s.saPhase === 'da')) continue;
        d.setzePos(s.pos.x + 4, 8.5, s.pos.z + 4);
        d.schritt(1 / 30, 2);
        if (!(s.saAnker && s.saPhase === 'da') || !s.visual.root.visible) continue;
        const nach = strasse().filter((o) => o.saAnker === s.saAnker && o.saArt === 'sitzen' && o.saPhase === 'da' && o.visual.root.visible);
        sitzReihe(nach);
      }
      aufsDach();
      d.schritt(1 / 30, 2);
    }
    /* Sitzen je Look: jeder Look der Strassenpassanten einmal auf jeder
       Bankart, mit der Platzierung des Spiels (aufenthaltSitzen: Phase da,
       Lage aus saSitzLage), jede Ecke gehaeutet wie oben; dazu die
       Huellkugel in dieser Haltung. Je Look und Bankart eine eigene,
       leere Bank. */
    const jeLook = { gemessen: 0, schwebt: 0, inBank: 0, inLehne: 0, fussHoch: 0, fussTief: 0, kugel: -9, nichtGesetzt: 0, ohnePlatz: 0, liste: [] };
    if (HAT && d.aufenthaltSitzen) {
      const looks = new Map();
      d.civilians.forEach((c, ci) => {
        if (c.bahnsteig !== undefined || !c.visual || c.state !== 'walk' || c.geisel || c.eingestiegen > 0) return;
        const sig = c.visual.modell + '|' + (c.look ? c.look.outfit : '-');
        if (!looks.has(sig)) looks.set(sig, ci);
      });
      /* freie Plaetze je Bankart: jeder Platz einer Bank, auf der niemand
         sitzt (die Bestandsbank hat zwei) */
      const frei = { modell: [], bestand: [] };
      for (const a of d.aufenthalt().anker) {
        if (a.art !== 'bank' || !frei[a.bank] || !a.belegt.every((o) => o < 0)) continue;
        a.plaetze.forEach((_, pi) => frei[a.bank].push({ a, pi }));
      }
      for (const [sig, ci] of looks) for (const bank of ['modell', 'bestand']) {
        /* Die Liste ist vom Anfang; inzwischen kann ein Passant eine der
           Baenke genommen haben - dann die naechste (hoechstens drei). */
        let a = null, pi = 0, P = null, c = null, grund = null;
        for (let versuch = 0; versuch < 3 && !c; versuch++) {
          const f = frei[bank].shift();
          if (!f) { a = null; break; }
          a = f.a; pi = f.pi;
          P = a.plaetze[pi];
          if (!d.aufenthaltSitzen(ci, a.id, pi)) { grund = 'belegt'; continue; }
          /* 1,5 s sitzen lassen wie nach dem echten Hinsetzen (0,9 s): so
             lange blendet der Sitzclip vom vorigen Clip ueber; nach vier
             Bildern stand das Becken noch halb in der alten Haltung (bis
             1,7 cm tiefer gemessen). Der Held bleibt 8,5 m darueber. */
          for (let k = 0; k < 9; k++) { d.setzePos(P.x + 4, 8.5, P.z + 4); d.schritt(1 / 30, 5); }
          const q = d.civilians[ci];
          if (!(q.saAnker && q.saPhase === 'da') || !q.visual.root.visible) { grund = 'phase ' + (q.saPhase || '-'); d.aufenthaltLoesen(ci); continue; }
          c = q;
        }
        if (!c) {
          if (a) { jeLook.nichtGesetzt++; jeLook.liste.push({ sig, bank, gesetzt: false, grund }); }
          else jeLook.ohnePlatz++;
          continue;
        }
        const r = sitzPruefen(c);
        const u = KUGEL ? +kugelUeber(c).toFixed(3) : null;
        jeLook.gemessen++;
        if (r.gesaessLuft > 0.03) jeLook.schwebt++;
        if (r.platte > 0.02) jeLook.inBank++;
        if (r.lehne < -0.01) jeLook.inLehne++;
        if (r.sohle > 0.03) jeLook.fussHoch++;
        if (r.sohle < -0.03) jeLook.fussTief++;
        if (u !== null) jeLook.kugel = Math.max(jeLook.kugel, u);
        jeLook.liste.push({ sig, bank, anker: a.id, platz: pi, gesaessLuft: r.gesaessLuft, platte: r.platte, sohle: r.sohle, lehne: r.lehne,
                            r: c.saLage ? +c.saLage.r.toFixed(3) : null, heben: c.saLage ? +c.saLage.heben.toFixed(3) : null, kugel: u });
        d.aufenthaltLoesen(ci);
      }
      aufsDach();
      d.schritt(1 / 30, 2);
    }
    lauf.sitzJeLook = jeLook;
    const n = lauf.schnapp || 1;
    lauf.aktivMittel = +(lauf.aktivMittel / n).toFixed(2); lauf.stillMittel = +(lauf.stillMittel / n).toFixed(2);
    lauf.sitzBelegtMittel = +(lauf.sitzBelegtMittel / n).toFixed(2);
    for (const k of Object.keys(lauf.zustand)) lauf.zustand[k] = +(lauf.zustand[k] / n).toFixed(2);
    for (const t of Object.keys(lauf.jeTeil)) for (const k of Object.keys(lauf.jeTeil[t])) lauf.jeTeil[t][k] = +(lauf.jeTeil[t][k] / n).toFixed(2);
    const A1 = HAT ? d.aufenthalt() : null;
    if (A1) { lauf.stat = zaehlerLauf.stat; lauf.statNachProben = A1.stat; lauf.orte = A1.orte.slice(0, 40); lauf.strasse = A1.strasse; lauf.anteil = A1.anteil; }
    else { lauf.strasse = strasse().length; lauf.anteil = null; }
    lauf.gespraeche = zaehlerLauf.gespraeche;
    const sn = sichtN || 1;
    const sicht = { radien: SICHT_R, orte: ORTE.map((o) => {
      const jeArt = {};
      for (const [a, v] of Object.entries(o.sum)) jeArt[a] = v.map((x) => +(x / sn).toFixed(2));
      return { name: o.name, teil: o.teil, jeArt };
    }), summe: {} };
    for (const a of SICHT_ARTEN.concat(['gesamt'])) sicht.summe[a] = SICHT_R.map((r, i) => +sicht.orte.reduce((s, o) => s + o.jeArt[a][i], 0).toFixed(2));

    /* ---------- 4. Gefahr: eine Gang neben einem Aufenthalt ---------- */
    const gefahr = { faelle: [], nebenGegner: 0, spieler: [] };
    if (GEFAHR && HAT) {
      const schon = [];
      for (const gruppe of [['reden'], ['sitzen'], ['handy', 'warten', 'umschauen', 'treff']]) {
        /* Gerade niemand in dieser Lage? Bis 180 s weiterrechnen
           (Gespraeche gibt es seltener: zwei Plaetze im Anteil). */
        let c = null, gewartet = 0;
        for (; gewartet <= 180 && !c; gewartet++) {
          c = strasse().find((q) => gruppe.indexOf(art(q)) >= 0 && schon.indexOf(q) < 0 && (gruppe[0] !== 'reden' || (q.sozialT || 0) > 1)) || null;
          if (!c) { d.schritt(1 / 30, 30); ohneGegner(); if (dach && Math.abs(d.player.pos.y - dach.h) > 1) aufsDach(); }
        }
        if (!c) { gefahr.faelle.push({ art: gruppe.join('/'), keiner: true }); continue; }
        schon.push(c);
        const vor = { art: art(c), anker: c.saAnker ? c.saAnker.id : null, platz: c.saPlatz };
        const A = c.saAnker, pl = c.saPlatz;
        const gang = d.spawnGang(c.pos.x + 7, c.pos.z + 5, 2, 'pruef');
        let frei = null, bewegt = null, flieht = null;
        const x0 = c.pos.x, z0 = c.pos.z;
        let neben = 0;
        for (let k = 1; k <= 60; k++) {
          d.schritt(1 / 30, 1);
          const t = k / 30;
          if (frei === null && !c.saAnker) frei = +t.toFixed(3);
          if (flieht === null && c.state === 'flee') flieht = +t.toFixed(3);
          if (bewegt === null && Math.hypot(c.pos.x - x0, c.pos.z - z0) > 0.3) bewegt = +t.toFixed(3);
          /* niemand bleibt im Aufenthalt, wenn ein Gegner naeher als 9 m ist
             (die kleinste Alarmweite) - nach 0,5 s Reaktionszeit */
          if (t > 0.5) for (const o of strasse()) {
            if (!o.saAnker || !STILL.has(art(o))) continue;
            if (d.enemies.some((e) => !e.dead && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) < 9)) neben++;
          }
        }
        gefahr.nebenGegner += neben;
        ohneGegner();
        /* 20 s spaeter: geht er wieder? */
        for (let k = 0; k < 20; k++) d.schritt(1 / 30, 30);
        gefahr.faelle.push(Object.assign(vor, { gewartet: gewartet - 1, freigegebenNach: frei, fliehtNach: flieht, bewegtNach: bewegt,
          wiederDort: A ? (A.belegt[pl] === c && c.saAnker === A) : null, danach: c.state + ':' + (c.gehZustand || '-'),
          hatRoute: !!c.route, neben }));
      }
      /* Spieler zu nah (Kollision): der Held steht 0,3 m neben einer
         sitzenden und neben einer stehenden Figur, 2 s lang an derselben
         Stelle. Erwartet: der Aufenthalt endet (Sitzende stehen in 0,35 s
         auf), danach weicht die Figur auf SPIELER_ABSTAND aus. */
      for (const gruppe of [['sitzen'], ['handy', 'warten', 'umschauen', 'treff', 'reden']]) {
        let c = null, gewartet = 0;
        for (; gewartet <= 120 && !c; gewartet++) {
          c = strasse().find((q) => q.saAnker && gruppe.indexOf(art(q)) >= 0 && schon.indexOf(q) < 0 &&
                                    (gruppe[0] !== 'sitzen' || q.saPhase === 'da')) || null;
          if (!c) { d.schritt(1 / 30, 30); ohneGegner(); if (dach && Math.abs(d.player.pos.y - dach.h) > 1) aufsDach(); }
        }
        if (!c) { gefahr.spieler.push({ art: gruppe.join('/'), keiner: true }); continue; }
        schon.push(c);
        /* der Spieler auf eine FREIE Stelle 0,3 m daneben - in einem
           Hindernis schoebe ihn das Spiel zurueck auf die Figur */
        const vor = art(c);
        let fest = null;
        for (let k = 0; k < 8 && !fest; k++) {
          const w = k * Math.PI / 4, x = c.pos.x + Math.cos(w) * 0.3, z = c.pos.z + Math.sin(w) * 0.3;
          if (punktFrei(x, z, 0.3)) fest = { x, y: c.pos.y, z };
        }
        if (!fest) { gefahr.spieler.push({ art: vor, keinPlatzFuerSpieler: true }); continue; }
        let los = null, unter = 0, verschoben = 0;
        for (let k = 1; k <= 60; k++) {
          d.setzePos(fest.x, fest.y, fest.z);
          d.schritt(1 / 30, 1);
          verschoben = Math.max(verschoben, Math.hypot(d.player.pos.x - fest.x, d.player.pos.z - fest.z));
          if (los === null && !c.saAnker) los = +(k / 30).toFixed(3);
          if (Math.hypot(c.pos.x - fest.x, c.pos.z - fest.z) < 0.45) unter++;
        }
        gefahr.spieler.push({ art: vor, gewartet: gewartet - 1, freigegebenNach: los, bilderUnter045: unter,
                              abstandNach2s: +Math.hypot(c.pos.x - fest.x, c.pos.z - fest.z).toFixed(2),
                              spielerVerschoben: +verschoben.toFixed(2), danach: c.state + ':' + (c.gehZustand || '-') });
        aufsDach();
        d.schritt(1 / 30, 2);
      }
    }
    return { stufe7b: HAT, anker: HAT ? anker : null, baenke: HAT ? baenke : null, lauf, sicht, kugel: HAT ? kugel : null,
             gefahr: HAT ? gefahr : null, bank: BANK, mass: A1 ? A1.mass : null };
  }, { DAUER, ANTEIL, GEFAHR, KUGEL, MIX, kams });
  aus.seitenfehler = fehlerSeite.slice(0, 10);
  fs.writeFileSync(ziel, JSON.stringify(aus, null, 1));

  const A = aus.anker, L = aus.lauf, P = L.paar, S = L.sitz, B = aus.baenke;
  const p = (s) => console.log(s);
  if (!aus.stufe7b) p('== Stand ohne Stufe 7B (kein __dbg.aufenthalt): nur Lauf und Sicht');
  if (A) {
  p('== Anker (' + A.ms + ' ms beim Laden; Moebelmodelle da: ' + JSON.stringify(A.sdModelleBeimBau) + '): ' + A.gesamt + '  ' + JSON.stringify(A.jeArt) + '  Plaetze ' + JSON.stringify(A.plaetzeJeArt));
  p('   je Ort ' + JSON.stringify(A.jeOrt));
  p('   je Stadtteil (Plaetze) ' + JSON.stringify(A.jeTeil));
  p('   verworfen ' + JSON.stringify(A.verworfen));
  p('   nachgeprueft: ' + JSON.stringify(A.pruefung) + (A.fehlerListe.length ? '  FEHLER ' + JSON.stringify(A.fehlerListe.slice(0, 8)) : ''));
  p('== Baenke: ' + B.gesamt + ' (Modell ' + B.modell + ', Bestand ' + B.bestand + '), mit Platz ' + B.mitAnker + ', Sitzplaetze ' + B.plaetze);
  }
  p('== Lauf ' + L.schnapp + ' s, Anteil ' + L.anteil + ' von ' + L.strasse + ' Strassenpassanten');
  p('   Mittel je Zustand ' + JSON.stringify(L.zustand));
  p('   im Aufenthalt (vorgemerkt) Mittel ' + L.aktivMittel + ' max ' + L.aktivMax + ';  davon stehend/sitzend/redend Mittel ' + L.stillMittel + ' max ' + L.stillMax);
  p('   Sitzplaetze belegt Mittel ' + L.sitzBelegtMittel + ' max ' + L.sitzBelegtMax + ';  Doppelbelegung ' + L.doppel + ', gleiche Stelle ' + L.gleicheStelle);
  for (const [t, v] of Object.entries(L.jeTeil)) p('   ' + t.padEnd(10) + JSON.stringify(v));
  p('   Gespraeche ' + L.gespraeche + ', Paar-Sekunden ' + P.schnapp + ', Abstand ' + (P.schnapp ? P.abstandMin.toFixed(2) + '..' + P.abstandMax.toFixed(2) : '-') +
    '  zuNah ' + P.zuNah + ' zuWeit ' + P.zuWeit + ' nichtZugewandt ' + P.nichtZugewandt + ' imHindernis ' + P.imHindernis + ' gehwegZu ' + P.gehwegZu + ' getrennt ' + P.getrennt);
  p('   im Ding ' + L.imDing + ', im Haus ' + L.imHaus + ', abseits des Anlaufwegs ' + L.abseitsWeg + ', durch Sitzende ' + L.durchSitzende);
  p('   Trauben: Stau ' + L.stauGruppen + ', Aufenthalt-Traube ' + L.aktivTraube + ', groesste ' + L.groessteTraube);
  p('   laengster ungewollter Stillstand ' + L.laengsterUngewollt.s + ' s ' + JSON.stringify(L.laengsterUngewollt) + ', ungewollt >= 10 s ' + L.ungewollt10 +
    ' (Geisel einer Mission: ' + L.geiselSek + ' Passanten-Sekunden, gilt als gewollt)');
  p('   Kreuzung 86/-148: still >= 10 s ' + L.kreuzung.still10 + ' (davon im Aufenthalt ' + L.kreuzung.davonAufenthalt + '), laengster ungewollt ' + L.kreuzung.laengster + ' s');
  if (L.stat) p('   Zaehler (Ende des Laufs) ' + JSON.stringify(L.stat));
  if (L.statNachProben) p('   Zaehler nach den Proben (Kugel, Sitzen je Look, Gefahr, Spieler) ' + JSON.stringify(L.statNachProben));
  const SI = aus.sicht;
  p('== Sicht an den zehn Orten, Mittel je Sekunde, bis ' + SI.radien.join('/') + ' m:');
  for (const o of SI.orte) p('   ' + o.name.padEnd(14) + Object.entries(o.jeArt).map(([a, v]) => a + ' ' + v.join('/')).join('  '));
  p('   SUMME         ' + Object.entries(SI.summe).map(([a, v]) => a + ' ' + v.join('/')).join('  '));
  if (aus.stufe7b) {
  p('== Sitzen: gemessen ' + S.gemessen + '  schwebt ' + S.schwebt + ' inBank ' + S.inBank + ' inLehne ' + S.inLehne + ' fussHoch ' + S.fussHoch + ' fussTief ' + S.fussTief + ' Blick ' + S.blick + ' imNachbarn ' + S.imNachbarn);
  if (L.sitzMessungen.length) {
    const sp = (k) => { const v = L.sitzMessungen.map((r) => r[k]); return Math.min(...v).toFixed(3) + '..' + Math.max(...v).toFixed(3); };
    p('   Gesaess ueber Sitz ' + sp('gesaessLuft') + ', in der Sitzplatte ' + sp('platte') + ', Sohle ueber Boden ' + sp('sohle') + ', vor der Lehne ' + sp('lehne'));
  }
  const J = L.sitzJeLook;
  if (J && J.liste.length) {
    const ok = J.liste.filter((q) => q.gesetzt !== false);
    const sp = (k) => { const v = ok.map((r) => r[k]); return v.length ? Math.min(...v).toFixed(3) + '..' + Math.max(...v).toFixed(3) : '-'; };
    p('== Sitzen je Look (' + new Set(J.liste.map((q) => q.sig)).size + ' Looks x Bankart): gemessen ' + J.gemessen + ', nicht gesetzt ' + J.nichtGesetzt + ', kein freier Platz ' + J.ohnePlatz +
      '  schwebt ' + J.schwebt + ' inBank ' + J.inBank + ' inLehne ' + J.inLehne + ' fussHoch ' + J.fussHoch + ' fussTief ' + J.fussTief);
    p('   Gesaess ueber Sitz ' + sp('gesaessLuft') + ', in der Sitzplatte ' + sp('platte') + ', Sohle ' + sp('sohle') + ', vor der Lehne ' + sp('lehne') +
      ', Huefte vor der Lehne ' + sp('r') + ', angehoben ' + sp('heben') + ', Huellkugel max ' + J.kugel);
  }
  p('== Culling-Kugel (stehend; sitzend siehe Sitzen je Look): von ' + aus.kugel.liste + ' gemessen ' + aus.kugel.gemessen + ' (inzwischen fertig ' + aus.kugel.vorbei +
    ', nicht sichtbar ' + aus.kugel.unsichtbar + '), groesster Ueberstand ' + aus.kugel.max + ' ' + JSON.stringify(aus.kugel.jeArt));
  p('== Gefahr: ' + JSON.stringify(aus.gefahr.faelle) + '  Aufenthalt neben Gegner: ' + aus.gefahr.nebenGegner);
  p('== Spieler zu nah: ' + JSON.stringify(aus.gefahr.spieler));
  }
  if (aus.seitenfehler.length) p('   Seitenfehler ' + JSON.stringify(aus.seitenfehler));
  const hart = !aus.stufe7b ? {
    imDing: L.imDing, imHaus: L.imHaus, paarZuNah: P.zuNah, paarZuWeit: P.zuWeit, paarNichtZugewandt: P.nichtZugewandt,
    paarImHindernis: P.imHindernis, paarGehwegZu: P.gehwegZu, paarGetrennt: P.getrennt, seitenfehler: aus.seitenfehler.length,
  } : {
    ankerFehler: A.pruefung.fehler || 0, doppel: L.doppel, gleicheStelle: L.gleicheStelle, imDing: L.imDing, imHaus: L.imHaus,
    durchSitzende: L.durchSitzende, paarZuNah: P.zuNah, paarZuWeit: P.zuWeit, paarNichtZugewandt: P.nichtZugewandt,
    paarImHindernis: P.imHindernis, paarGehwegZu: P.gehwegZu, paarGetrennt: P.getrennt,
    sitztInDerLuft: S.schwebt, steckInDerBank: S.inBank, inDerLehne: S.inLehne, fussZuHoch: S.fussHoch, fussZuTief: S.fussTief,
    falscheRichtung: S.blick, imNachbarn: S.imNachbarn, nebenGegner: aus.gefahr.nebenGegner,
    spielerNah: aus.gefahr.spieler.filter((q) => !q.keiner && (q.freigegebenNach === null || q.abstandNach2s < 0.45)).length,
    sitzJeLook: L.sitzJeLook ? L.sitzJeLook.schwebt + L.sitzJeLook.inBank + L.sitzJeLook.inLehne + L.sitzJeLook.fussHoch + L.sitzJeLook.fussTief + L.sitzJeLook.nichtGesetzt : 0,
    kugel: aus.kugel.max > 0 || (L.sitzJeLook && L.sitzJeLook.kugel > 0) ? 1 : 0, seitenfehler: aus.seitenfehler.length,
  };
  const summe = Object.values(hart).reduce((a, c) => a + c, 0);
  p('== Harte Fehler ' + summe + ' ' + JSON.stringify(hart));
  if (L.faelle.length) p('   Faelle ' + JSON.stringify(L.faelle.slice(0, 12)));
  await b.close();
  process.exit(summe ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
