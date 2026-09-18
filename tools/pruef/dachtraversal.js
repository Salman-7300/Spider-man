/* CITY V2, Stufe 5 Teil F: die vielen neuen Dachkanten begehen.

   Stufe 5 hat aus 274 freistehenden Baukoerpern ueber 600 Haeuser in
   Zeilen gemacht - und damit sehr viel mehr Dachkanten, die dicht
   nebeneinander liegen. Dieser Pruefstand faehrt sie ab. Er baut KEINE
   neue Bewegung, er sucht Regressionen.

   Vier Uebungen, je an verschiedenen Haeusern der Stadt:

     Dachlandung      aus zwoelf Metern auf die Dachmitte fallen
     Wandklettern     zwei Meter unter der Dachkante anfangen und
                      hinaufklettern, bis die Figur oben steht
     Nachbarsprung    vom Dach zum unmittelbaren Nachbarn springen
     Dachkante        auf der Kante stehen bleiben, nicht abrutschen

   Gemessen wird je Versuch:

     unterDach        die Figur endet UNTER der Dachflaeche
     inKollider       sie steht in einem Hindernis
     festgehangen     sie bewegt sich ueber eine Sekunde gar nicht,
                      obwohl sie fallen oder laufen muesste
     bodenFalsch      onGround gemeldet, aber nicht auf dem Dach
     teleport         ein Bild mit mehr als drei Metern Versatz

   Aufruf:  node tools/pruef/dachtraversal.js [seed] [anzahl]
   ========================================================================= */
const { starte } = require('./basis');
const zahl = (v, standard) => {
  const n = Number(v);
  return (v === undefined || v === '-' || v === '' || !isFinite(n)) ? standard : n;
};
const seed = zahl(process.argv[2], 4711);
const anzahl = zahl(process.argv[3], 20);

(async () => {
  const { b, page } = await starte(900, 540, seed);
  const aus = await page.evaluate(async ([N]) => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const SLAB_H = 0.25;
    const K = d.hausKisten().filter((h) => h.h >= 8 && h.zeile);
    /* Gleichmaessig ueber die Stadt verteilt waehlen. */
    const nimm = (n) => {
      const s = Math.max(1, Math.floor(K.length / n));
      const w = [];
      for (let i = 0; i < K.length && w.length < n; i += s) w.push(K[i]);
      return w;
    };
    const inKollider = (x, y, z) => {
      for (const c of d.colliderNah(x, z)) {
        if (c.innen || c.parkAuto) continue;
        const y0 = c.y0 === undefined ? 0 : c.y0;
        if (x > c.x0 + 0.02 && x < c.x1 - 0.02 &&
            z > c.z0 + 0.02 && z < c.z1 - 0.02 &&
            y > y0 + 0.02 && y < c.h - 0.02) return c;
      }
      return null;
    };
    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD',
                                             'ShiftLeft','KeyZ','Space','KeyX'])
                              d.taste(t, false); };
    /* Einen Lauf ausfuehren und dabei Sprung und Stillstand mitschreiben. */
    const laufe = (bilder) => {
      let maxSprung = 0, still = 0, stillMax = 0;
      let vx = P.pos.x, vy = P.pos.y, vz = P.pos.z;
      for (let i = 0; i < bilder; i++) {
        d.schritt(1 / 60);
        const s = Math.hypot(P.pos.x - vx, P.pos.y - vy, P.pos.z - vz);
        if (s > maxSprung) maxSprung = s;
        if (s < 0.002) { still++; if (still > stillMax) stillMax = still; } else still = 0;
        vx = P.pos.x; vy = P.pos.y; vz = P.pos.z;
      }
      return { maxSprung: +maxSprung.toFixed(2), stillMax };
    };

    const ergebnis = {};

    /* ---- 1. Dachlandung ---- */
    ergebnis.dachlandung = [];
    for (const h of nimm(N)) {
      const dach = SLAB_H + h.h;
      alleAus();
      d.setzePos(h.x, dach + 12, h.z);
      P.vel.set(0, 0, 0); P.state = 'air'; P.onGround = false;
      const l = laufe(240);
      ergebnis.dachlandung.push({
        haus: [h.x, h.z], dach: +dach.toFixed(2), y: +P.pos.y.toFixed(2),
        zustand: P.state, onGround: !!P.onGround,
        unterDach: P.pos.y < dach - 0.5,
        inKollider: !!inKollider(P.pos.x, P.pos.y + 1.0, P.pos.z),
        bodenFalsch: !!P.onGround && Math.abs(P.pos.y - dach) > 0.6,
        festgehangen: l.stillMax > 60 && P.pos.y > dach + 1.0,
        teleport: l.maxSprung > 3.0, maxSprung: l.maxSprung,
      });
    }

    /* ---- 2. Wandklettern bis aufs Dach ---- */
    ergebnis.klettern = [];
    for (const h of nimm(N)) {
      const dach = SLAB_H + h.h;
      const seite = h.zeile.split('|')[2];
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      const front = nx !== 0 ? h.x + nx * (h.w / 2) : h.z + nz * (h.d / 2);
      let col = null;
      for (const c of d.colliderNah(h.x, h.z)) {
        if (c.klein || c.innen || c.parkAuto) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - h.x) < 0.02 &&
            Math.abs((c.z0 + c.z1) / 2 - h.z) < 0.02) { col = c; break; }
      }
      if (!col) continue;
      alleAus();
      d.setzePos(nx !== 0 ? front + nx * 0.15 : h.x, dach - 2.0,
                 nz !== 0 ? front + nz * 0.15 : h.z);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      d.taste('KeyW', true);
      const l = laufe(300);
      alleAus();
      ergebnis.klettern.push({
        haus: [h.x, h.z], dach: +dach.toFixed(2), y: +P.pos.y.toFixed(2),
        zustand: P.state,
        obenAngekommen: P.pos.y >= dach - 0.4,
        unterDach: P.pos.y < dach - 2.5,
        inKollider: !!inKollider(P.pos.x, P.pos.y + 1.0, P.pos.z),
        festgehangen: l.stillMax > 90 && P.pos.y < dach - 0.4,
        teleport: l.maxSprung > 3.0, maxSprung: l.maxSprung,
      });
    }

    /* ---- 3. Sprung zum unmittelbaren Nachbarn ---- */
    ergebnis.sprung = [];
    const zeilen = new Map();
    for (const h of K) {
      if (!zeilen.has(h.zeile)) zeilen.set(h.zeile, []);
      zeilen.get(h.zeile).push(h);
    }
    const paare = [];
    for (const [key, liste] of zeilen) {
      if (liste.length < 2) continue;
      const laengsX = key.split('|')[2] === 'N' || key.split('|')[2] === 'S';
      liste.sort((p, q) => (laengsX ? p.x - q.x : p.z - q.z));
      for (let i = 1; i < liste.length; i++) paare.push([liste[i - 1], liste[i]]);
    }
    const schritt = Math.max(1, Math.floor(paare.length / N));
    for (let i = 0; i < paare.length && ergebnis.sprung.length < N; i += schritt) {
      const [A, B] = paare[i];
      const dachA = SLAB_H + A.h, dachB = SLAB_H + B.h;
      alleAus();
      d.setzePos(A.x, dachA + 0.1, A.z);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      /* Zum Nachbarn schauen und loslaufen, dann springen. */
      const rx = B.x - A.x, rz = B.z - A.z;
      d.setzeKamYaw(Math.atan2(rx, rz) + Math.PI);
      d.taste('KeyW', true); d.taste('ShiftLeft', true);
      laufe(40);
      d.tippeSprung();
      const l = laufe(180);
      alleAus();
      const aufB = Math.abs(P.pos.x - B.x) <= B.w / 2 + 0.6 &&
                   Math.abs(P.pos.z - B.z) <= B.d / 2 + 0.6;
      ergebnis.sprung.push({
        von: [A.x, A.z], nach: [B.x, B.z],
        dachA: +dachA.toFixed(2), dachB: +dachB.toFixed(2),
        y: +P.pos.y.toFixed(2), zustand: P.state,
        aufNachbardach: aufB && P.pos.y >= dachB - 0.6,
        gefallen: P.pos.y < Math.min(dachA, dachB) - 3.0,
        inKollider: !!inKollider(P.pos.x, P.pos.y + 1.0, P.pos.z),
        teleport: l.maxSprung > 3.0, maxSprung: l.maxSprung,
      });
    }

    /* ---- 4. Auf der Dachkante stehen ---- */
    ergebnis.kante = [];
    for (const h of nimm(10)) {
      const dach = SLAB_H + h.h;
      const seite = h.zeile.split('|')[2];
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      const kx = nx !== 0 ? h.x + nx * (h.w / 2 - 0.25) : h.x;
      const kz = nz !== 0 ? h.z + nz * (h.d / 2 - 0.25) : h.z;
      alleAus();
      d.setzePos(kx, dach + 0.05, kz);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      const l = laufe(180);
      ergebnis.kante.push({
        haus: [h.x, h.z], dach: +dach.toFixed(2), y: +P.pos.y.toFixed(2),
        zustand: P.state, onGround: !!P.onGround,
        abgerutscht: P.pos.y < dach - 0.6,
        versatz: +Math.hypot(P.pos.x - kx, P.pos.z - kz).toFixed(2),
        inKollider: !!inKollider(P.pos.x, P.pos.y + 1.0, P.pos.z),
        teleport: l.maxSprung > 3.0,
      });
    }
    return { haeuser: K.length, paare: paare.length, ergebnis };
  }, [anzahl]);
  await b.close();

  const p = (s) => console.log(s);
  const E = aus.ergebnis;
  const z = (arr, f) => arr.filter(f).length;
  p('');
  p('== Dach-Traversal (Keim ' + seed + ') ==');
  p('  ' + aus.haeuser + ' Haeuser ab 8 m in Zeilen, ' + aus.paare + ' Nachbarpaare');
  p('');
  const block = (name, arr, zeilen) => {
    p('  ' + name + '  (' + arr.length + ' Versuche)');
    for (const [t, f] of zeilen) p('    ' + t.padEnd(34) + z(arr, f));
    p('');
  };
  block('Dachlandung', E.dachlandung, [
    ['auf dem Dach gelandet', (q) => q.onGround && !q.unterDach && !q.bodenFalsch],
    ['unter der Dachflaeche', (q) => q.unterDach],
    ['in einem Hindernis', (q) => q.inKollider],
    ['Boden falsch erkannt', (q) => q.bodenFalsch],
    ['festgehangen', (q) => q.festgehangen],
    ['Teleport (> 3 m in einem Bild)', (q) => q.teleport]]);
  block('Wandklettern bis aufs Dach', E.klettern, [
    ['oben angekommen', (q) => q.obenAngekommen],
    ['unter der Dachflaeche', (q) => q.unterDach],
    ['in einem Hindernis', (q) => q.inKollider],
    ['festgehangen', (q) => q.festgehangen],
    ['Teleport', (q) => q.teleport]]);
  block('Sprung zum Nachbarn', E.sprung, [
    ['auf dem Nachbardach', (q) => q.aufNachbardach],
    ['heruntergefallen', (q) => q.gefallen],
    ['in einem Hindernis', (q) => q.inKollider],
    ['Teleport', (q) => q.teleport]]);
  block('Auf der Dachkante', E.kante, [
    ['steht', (q) => q.onGround && !q.abgerutscht],
    ['abgerutscht', (q) => q.abgerutscht],
    ['in einem Hindernis', (q) => q.inKollider],
    ['Teleport', (q) => q.teleport]]);
  const schlimm = [...E.dachlandung, ...E.klettern, ...E.sprung, ...E.kante]
    .filter((q) => q.unterDach || q.inKollider || q.teleport || q.festgehangen ||
                   q.bodenFalsch || q.abgerutscht);
  p('  Auffaellige Versuche: ' + schlimm.length);
  for (const q of schlimm.slice(0, 10)) p('    ' + JSON.stringify(q));
  p('');
})();
