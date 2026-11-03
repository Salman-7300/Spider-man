/* CITY V2, Abnahme Stufe 7B: gepaarter Vergleich der Spieler-Passanten-
   Ueberlappung, e92110a gegen den aktuellen Stand (dritte Fassung).
   Pilotlaeufe NUR auf e92110a, nur zur Ereignisrate: 10 s Stehen an den
   zehn Strassenorten ergab 1 Fluchtbegegnung in 10 Episoden, an 30
   Gehnetzknoten 0 in 30 (insgesamt 2 Passanten im 10-m-Kreis, als die
   Gang kam). Begegnungen entstehen erst, wenn der Held laenger steht und
   sich Gaffer sammeln - wie im Kernsystem-Lauf.

   Vorab festgelegt (fuer beide Staende gleich, keine Auswahl danach):
     Keime   4711 1234 2026 11 12 13 14 15 16 17 (je Keim ein Lauf)
     Orte    die zehn Strassenorte aus street-life-activities.js (Held am
             Kamerapunkt auf dem Gehweg, Blick in Kamerarichtung).
     Gang    10 m voraus in Blickrichtung spawnGang(3 Gegner, Quelle
             'pruef'), vorher der Zufall auf Keim*1000+Ort+1 gesetzt
             (Xorshift wie im Spiel) - gleiche Typen und Startpunkte auf
             beiden Staenden.
     Ablauf  eingefroren im ersten Bild nach dem Laden, Regen 0,
             Tageszeit 0,45, keine Zufallsmission, Weltereignisse in jedem
             Schritt beendet, keine Ambient-Gangs (maxEnemies 0).
             120 s Vorlauf (1/30 s), Held auf dem Dach.
             Je Ort (60 Hz): Held auf den Ort, steht still (keine Taste),
             unverwundbar (kein Rueckstoss); 30 s Stehen (wer ihn sieht,
             bleibt stehen und gafft - wie im Kernsystem-Lauf), dann die
             Gang, 10 s Flucht; danach Gegner weg, Held aufs Dach, 5 s
             Ruhe, naechster Ort.
     Messung 40 s je Ort. Koerper: Held Radius player.radius (0,45) /
             Hoehe player.height (1,75), Passant c.radius (0,35) / 1,75.
             Ueberschneidung: Mittenabstand waagerecht unter der
             Radiensumme UND Hoehen ueberlappen (> 0,2 m). Ereignis =
             zusammenhaengende Bilder (Luecken bis 3 Bilder). Tiefe =
             Radiensumme - kleinster Abstand. Fluchtbegegnung =
             fliehender Passant unter 2,0 m (Hoehen ueberlappen), einmal je
             Annaeherung (vorbei ab 2,5 m). Vorzustand = letzter Zustand
             vor der Flucht. Nach Aufenthalts-Abbruch = Flucht begann aus
             einem Aufenthalt. Dazu der Spielzaehler playerNpcOverlap und
             wer 10 m um den Helden war, als die Gang kam.
   Aufruf:  node tools/pruef/flucht-ueberlappung.js <wurzel> <keim> <ausgabe.json>
            <wurzel> = Ordner eines Spielstands (dieses Repo oder eine Kopie
            von e92110a); Auswertung: flucht-ueberlappung-auswertung.js */
const fs = require('node:fs');
const path = require('node:path');
const wurzel = path.resolve(process.argv[2]);
const KEIM = +process.argv[3];
const ziel = process.argv[4];
const { starte } = require(path.join(wurzel, 'tools/pruef/basis'));
const STEHEN = 30, FLUCHT = 10, GANG_AB = 10;
const ORTE = [
  { name: '01-zentrum', cx: 0, cz: -50, seite: 'N', a0: -13, a1: 15 },
  { name: '02-geschaeft', cx: -150, cz: -100, seite: 'O', a0: -13, a1: 15 },
  { name: '03-mischung', cx: -200, cz: 50, seite: 'N', a0: -13, a1: 15 },
  { name: '04-wohnen', cx: -250, cz: 100, seite: 'N', a0: -13, a1: 15 },
  { name: '05-parkrand', cx: -200, cz: -150, seite: 'O', a0: -13, a1: 15 },
  { name: '06-park-innen', frei: { x: -213, z: -151.2, zx: -195, zz: -150 } },
  { name: '07-ufer', frei: { x: 186.5, z: 30, zx: 186.0, zz: 58 } },
  { name: '08-boulevard', cx: 100, cz: 0, seite: 'N', a0: -13, a1: 15 },
  { name: '09-local', cx: -300, cz: -250, seite: 'S', a0: -13, a1: 15 },
  { name: '10-avenue', cx: 0, cz: 150, seite: 'O', a0: -13, a1: 15 },
];
function kamOrt(o) {
  if (o.frei) return o.frei;
  const HALB = 19;
  const n = { N: [0, 1], S: [0, -1], O: [1, 0], W: [-1, 0] }[o.seite];
  const laengs = n[0] !== 0 ? [0, 1] : [1, 0];
  const bord = (a, innen) => [o.cx + n[0] * (HALB - innen) + laengs[0] * a, o.cz + n[1] * (HALB - innen) + laengs[1] * a];
  const [x, z] = bord(o.a0, 2.0), [zx, zz] = bord(o.a1, 1.0);
  return { x, z, zx, zz };
}
const PLAN = ORTE.map((o, i) => {
  const k = kamOrt(o), lx = k.zx - k.x, lz = k.zz - k.z, ll = Math.hypot(lx, lz) || 1;
  return { nr: i, name: o.name, art: o.name, x: k.x, z: k.z,
           gang: { x: +(k.x + lx / ll * GANG_AB).toFixed(2), z: +(k.z + lz / ll * GANG_AB).toFixed(2) } };
});

(async () => {
  const { b, page } = await starte(640, 360, KEIM, { frierSofort: true });
  const fehlerSeite = [];
  page.on('pageerror', (e) => fehlerSeite.push(String(e).slice(0, 300)));
  const vor = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0); window.__setzeZeit(0.45);
    for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ']) d.taste(t, false);
    d.setzeTempo('maxEnemies', 0); d.setzeMissionCd(1e9);
    P.iFrames = 1e9;
    const weg = () => { for (const e of d.enemies) { const w = e.visual && (e.visual.root || e.visual.group); if (w) w.visible = false; } d.enemies.length = 0; };
    window.__ruhe = () => { d.evAlleBeenden(); d.setzeMissionCd(1e9); };
    window.__weg = weg;
    let dach = null;
    for (const col of d.colliders) {
      if (col.klein || col.strassenDetail || col.boden) continue;
      const h = col.h || 0;
      if (h < 10 || h > 60 || col.x1 - col.x0 < 8 || col.z1 - col.z0 < 8) continue;
      const mx = (col.x0 + col.x1) / 2, mz = (col.z0 + col.z1) / 2, dd = Math.hypot(mx - 25, mz - 25);
      if (!dach || dd < dach.dd) dach = { x: mx, z: mz, h, dd };
    }
    window.__aufsDach = () => { if (dach) d.setzePos(dach.x, dach.h + 0.05, dach.z); P.vel.set(0, 0, 0); };
    window.__ruhe(); weg();
    for (let s = 0; s < 120; s++) {
      if (dach && Math.abs(P.pos.y - dach.h) > 1) window.__aufsDach();
      for (let k = 0; k < 30; k++) { window.__ruhe(); d.schritt(1 / 30); }
      weg();
    }
    return { dach: !!dach, zivis: d.civilians.length, heldR: P.radius, heldH: P.height };
  }, {});
  const episoden = [];
  for (const o of PLAN) {
    if (!o.gang) { episoden.push({ ort: o.nr, ungueltig: 'kein Gangknoten' }); continue; }
    const r = await page.evaluate(({ o, KEIM, STEHEN, FLUCHT }) => {
      const d = __dbg, P = d.player;
      const RH = P.radius || 0.45, HH = P.height || 1.75, HC = 1.75;
      const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
      const imHindernis = (x, y, z) => d.colliderNah(x, z).some((n) => fest(n) && x > n.x0 && x < n.x1 && z > n.z0 && z < n.z1 &&
        y > (n.y0 === undefined ? -1e9 : n.y0) && y < (n.h || 0));
      window.__ruhe(); window.__weg();
      const gy = d.groundYAt(o.x, o.z, 3);
      d.setzePos(o.x, gy + 0.05, o.z);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      const lx = o.gang.x - o.x, lz = o.gang.z - o.z, ll = Math.hypot(lx, lz) || 1;
      P.facing = Math.atan2(lx / ll, lz / ll);
      const C = d.civilians, n = C.length;
      const vorZ = new Array(n).fill('gehen:-'), warFlucht = new Array(n).fill(false), flucht = new Array(n).fill(null);
      const beg = new Array(n).fill(false), ovl = new Array(n).fill(null);
      const beschreibe = (c) => {
        if (c.saAnker) return 'aufenthalt:' + c.saArt + ':' + c.saPhase;
        if (c.sozialPartner) return 'begegnung';
        if (c.gafft) return 'gafft';
        if (c.state === 'walk') return 'gehen:' + (c.gehZustand || '-');
        return c.state;
      };
      for (let i = 0; i < n; i++) { const c = C[i]; warFlucht[i] = c.state === 'flee'; if (c.state !== 'flee') vorZ[i] = beschreibe(c); }
      const ereignisse = [], begegnungen = [];
      let ungueltig = null, heldMax = 0, nahBeiGang = null, gang = null;
      const v0 = d.validZaehler().playerNpcOverlap;
      const start = { x: o.x, z: o.z };
      const schliesse = (i) => {
        const e = ovl[i]; if (!e) return;
        ovl[i] = null;
        e.dauer = +(e.bilder / 60).toFixed(3); e.tiefe = +e.tiefe.toFixed(3); e.minD = +e.minD.toFixed(3);
        delete e.letztes;
        ereignisse.push(e);
      };
      const GANG_BILD = STEHEN * 60, BILDER = (STEHEN + FLUCHT) * 60;
      for (let f = 0; f < BILDER; f++) {
        if (f === GANG_BILD) {
          nahBeiGang = {};
          for (const c of C) {
            if (!c || Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z) > 10) continue;
            const k = beschreibe(c).split(':').slice(0, 2).join(':');
            nahBeiGang[k] = (nahBeiGang[k] || 0) + 1;
          }
          let S = (KEIM * 1000 + o.nr + 1) >>> 0;
          Math.random = function () { let s = S; s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; S = s; return s / 4294967296; };
          const vorher = d.enemies.length;
          d.spawnGang(o.gang.x, o.gang.z, 3, 'pruef');
          gang = { neu: d.enemies.length - vorher };
        }
        window.__ruhe();
        d.schritt(1 / 60);
        const t = f / 60;
        if (f === 30 && (P.state !== 'ground' || Math.hypot(P.pos.x - o.x, P.pos.z - o.z) > 0.6 || imHindernis(P.pos.x, P.pos.y + 1.2, P.pos.z))) {
          ungueltig = 'Heldenstart ungueltig (' + P.state + ', ' + Math.hypot(P.pos.x - o.x, P.pos.z - o.z).toFixed(2) + ' m)';
          break;
        }
        heldMax = Math.max(heldMax, Math.hypot(P.pos.x - start.x, P.pos.z - start.z));
        const hy0 = P.pos.y, hy1 = P.pos.y + HH;
        for (let i = 0; i < n; i++) {
          const c = C[i];
          if (!c || !c.pos) continue;
          const fl = c.state === 'flee';
          if (fl && !warFlucht[i]) flucht[i] = { t: +t.toFixed(3), vor: vorZ[i], ausAufenthalt: vorZ[i].indexOf('aufenthalt:') === 0 };
          if (!fl) { vorZ[i] = beschreibe(c); flucht[i] = null; }
          warFlucht[i] = fl;
          const dx = c.pos.x - P.pos.x, dz = c.pos.z - P.pos.z;
          if (Math.abs(dx) > 3 || Math.abs(dz) > 3) {
            if (beg[i]) beg[i] = false;
            if (ovl[i] && f - ovl[i].letztes > 3) schliesse(i);
            continue;
          }
          const dist = Math.hypot(dx, dz);
          const gleicheHoehe = Math.min(hy1, c.pos.y + HC) - Math.max(hy0, c.pos.y) > 0.2;
          if (fl && gleicheHoehe && dist < 2.0) {
            if (!beg[i]) {
              beg[i] = true;
              begegnungen.push({ ci: i, t: +t.toFixed(3), vor: flucht[i] ? flucht[i].vor : vorZ[i],
                ausAufenthalt: flucht[i] ? flucht[i].ausAufenthalt : false, fluchtSeit: flucht[i] ? +(t - flucht[i].t).toFixed(3) : null });
            }
          } else if (beg[i] && (!fl || dist > 2.5)) beg[i] = false;
          const rs = RH + (c.radius || 0.35);
          if (gleicheHoehe && dist < rs) {
            if (!ovl[i]) ovl[i] = { ci: i, start: +t.toFixed(3), bilder: 0, letztes: f, minD: dist, tiefe: rs - dist, unter045: 0,
              zustand: c.state, gz: c.gehZustand || null, sa: c.saAnker ? c.saArt + ':' + c.saPhase : null,
              vor: fl ? (flucht[i] ? flucht[i].vor : '?') : vorZ[i], fluchtSeit: fl && flucht[i] ? +(t - flucht[i].t).toFixed(3) : null,
              ausAufenthalt: fl && flucht[i] ? flucht[i].ausAufenthalt : false, gangDa: f >= GANG_BILD };
            const e = ovl[i];
            e.bilder++; e.letztes = f;
            if (dist < e.minD) { e.minD = dist; e.tiefe = rs - dist; }
            if (dist < 0.45) e.unter045++;
          } else if (ovl[i] && f - ovl[i].letztes > 3) schliesse(i);
        }
      }
      for (let i = 0; i < n; i++) schliesse(i);
      const zaehler = d.validZaehler().playerNpcOverlap - v0;
      window.__weg(); window.__aufsDach();
      for (let s = 0; s < 5; s++) { for (let k = 0; k < 30; k++) { window.__ruhe(); d.schritt(1 / 30); } window.__weg(); }
      return { ort: o.nr, name: o.name, ungueltig, gang, nahBeiGang, ereignisse, begegnungen, zaehler, heldVersatzMax: +heldMax.toFixed(3) };
    }, { o, KEIM, STEHEN, FLUCHT });
    episoden.push(r);
    if (r.ungueltig) console.log('Ort', o.nr, r.ungueltig);
  }
  const s = { orte: 0, ungueltig: 0, begegnungen: 0, ereignisse: 0, fliehend: 0, zaehler: 0 };
  for (const e of episoden) {
    if (e.ungueltig) { s.ungueltig++; continue; }
    s.orte++; s.begegnungen += e.begegnungen.length; s.ereignisse += e.ereignisse.length;
    s.fliehend += e.ereignisse.filter((q) => q.zustand === 'flee').length; s.zaehler += e.zaehler;
  }
  console.log('Keim ' + KEIM + ' ' + JSON.stringify(s));
  fs.writeFileSync(ziel, JSON.stringify({ keim: KEIM, wurzel, vor, episoden, fehlerSeite, summe: s }, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
