/* problem-2, FlatFacade Top-out Push: wer schiebt die Figur nach dem
   Hochziehen 1,5 m Richtung Dachkante?

   Gefunden im Human-Video (Brownstone_FlatFacade_1, Kollider 169, Seite
   +z): nach dem Ueberziehen steht die Figur oben, im naechsten Bild
   1,5 m weiter aussen, und laeuft dann mit W gegen einen Dachaufbau.

   Echter Eingabeweg wie klettervideo.js: fuenf Meter vor der Fassade,
   Anlauf mit Shift+W, danach weiter W (oder ein anderer Tastenplan).
   Mitgeschrieben wird JEDES Spielbild vom letzten Kletterbild bis
   NACH Sekunden nach dem Top-out:

     pos, vel, Zustand, Kante (t, Ziel), onGround, groundTop
     dach      der Kasten unter den Fuessen (Oberkante = Fusshoehe)
     naechst   naechster fester Kasten in Koerperhoehe, waagrechter
               Abstand (0 = Mittelpunkt im Kasten)
     drin      Kaesten, die der Koerperzylinder (Radius player.radius)
               schneidet - Eindringtiefe wie collideBody (kleinste Weite)
     korr      Lagekorrekturen aus collideBody (KOLL_LOG): Kasten, Seite,
               Korrekturvektor
     taste     gedrueckte Tasten
     huefte    waagrechter Versatz der sichtbaren Huefte zum Fusspunkt
               (Animation; die Physik setzt pos selbst)

   Aufruf:
     node tools/pruef/topoutschub.js [koll=169] [seite=0,1] [f=0.5]
          [plan=W] [nach=2] [anlauf=150] [json=datei] [alt=krone,landung]
       alt   Gegenprobe: krone = Modellkrone als ein Quader,
             landung = Ueberziehen ohne Landepruefung
       plan  W (gehalten) | LOS (nach dem Ansprung nichts) | WA | WD
             (W, ab dem Top-out leicht links/rechts dazu)
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const KOLL = +arg('koll', 169);
const SEITE = arg('seite', '0,1').split(',').map(Number);
const F = +arg('f', 0.5);
const PLAN = arg('plan', 'W');
const NACH = +arg('nach', 2);
const ANLAUF = +arg('anlauf', 150);
const JSON_AUS = arg('json', null);
const ALT = arg('alt', '').split(',');

(async () => {
  const { b, page } = await starte(640, 360, 4711, { kroneTeileAlt: ALT.includes('krone'), kanteLandungAlt: ALT.includes('landung') });
  const aus = await page.evaluate((a) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
    for (const t of TASTEN) d.taste(t, false);
    const c = d.colliders.find((q) => q.id === a.KOLL);
    if (!c) return { fehler: 'Kollider nicht gefunden' };
    const [nx, nz] = a.SEITE;
    const ax = nx !== 0, l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
    const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
    const t = l0 + (l1 - l0) * a.F;
    d.setzePos(ax ? front + nx * 5 : t, 0.3, ax ? t : front + nz * 5);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.wallInfo = null; P.wall = null;
    P.facing = Math.atan2(-nx, -nz);
    d.setzeKamYaw(Math.atan2(nx, nz));
    for (let i = 0; i < 20; i++) d.schritt(1 / 60);

    /* ALLE Kaesten, wie collideBody - auch klein (die Modellkrone ist klein) */
    const fest = () => true;
    const r = P.radius;
    const kurz = (q) => ({ id: q.id, dachProp: !!q.dachProp, krone: !!q.krone, klein: !!q.klein, kronenTeil: !!q.kronenTeil,
      bau: q.bau ? (q.bau.kit ? 'kit' : q.bau.id) : null,
      kasten: [q.x0, q.x1, q.z0, q.z1, q.y0 === undefined ? null : q.y0, q.h].map((v) => v === null ? null : +v.toFixed(3)) });
    const lage = () => {
      const p = P.pos;
      let dach = null, naechst = null, nAb = Infinity;
      const drin = [];
      for (const q of d.colliderNah(p.x, p.z)) {
        if (!fest(q)) continue;
        const y0 = q.y0 === undefined ? -1e9 : q.y0;
        if (Math.abs((q.h || 0) - p.y) < 0.03 && p.x >= q.x0 && p.x <= q.x1 && p.z >= q.z0 && p.z <= q.z1 &&
            (!dach || q.h > dach.h)) dach = q;
        /* in Koerperhoehe? (wie collideBody: Fuss unter Oberkante, Kopf ueber Unterkante) */
        if (!(p.y < (q.h || 0) - 0.001 && p.y + 1.75 >= y0)) continue;
        const dx = Math.max(q.x0 - p.x, 0, p.x - q.x1), dz = Math.max(q.z0 - p.z, 0, p.z - q.z1);
        const ab = Math.hypot(dx, dz);
        if (ab < nAb) { nAb = ab; naechst = q; }
        if (p.x > q.x0 - r && p.x < q.x1 + r && p.z > q.z0 - r && p.z < q.z1 + r) {
          const weiten = [p.x - (q.x0 - r), (q.x1 + r) - p.x, p.z - (q.z0 - r), (q.z1 + r) - p.z];
          drin.push(Object.assign(kurz(q), { tiefe: +Math.min(...weiten).toFixed(3) }));
        }
      }
      return { dach: dach ? dach.id : null, naechst: naechst ? Object.assign(kurz(naechst), { ab: +nAb.toFixed(3) }) : null, drin };
    };

    const bilder = [];
    let anlauf = true, nr = 0, kanteAb = -1, bodenAb = -1, letztesKlettern = -1, topoutNr = -1;
    d.kollLogAn(true);
    const gesamt = a.ANLAUF + 2400;
    for (let i = 0; i < gesamt; i++) {
      /* Tasten: Anlauf mit Shift+W bis zum Ansprung; danach der Plan */
      if (anlauf && (i >= a.ANLAUF || P.state === 'climb')) anlauf = false;
      const oben = P.state === 'kante' || kanteAb >= 0;
      let w = true, l = false, rr = false;
      if (!anlauf && a.PLAN === 'LOS' && oben) w = false;
      if (!anlauf && a.PLAN === 'WA' && oben) l = true;
      if (!anlauf && a.PLAN === 'WD' && oben) rr = true;
      d.taste('KeyW', w); d.taste('KeyA', l); d.taste('KeyD', rr);
      d.taste('ShiftLeft', anlauf && P.state !== 'climb');
      const vorZ = P.state;
      const vorPos = [P.pos.x, P.pos.y, P.pos.z];
      d.schritt(1 / 60);
      const korr = d.kollLogHol();
      if (P.state === 'climb') letztesKlettern = i;
      if (P.state === 'kante' && kanteAb < 0) kanteAb = i;
      if (kanteAb >= 0 && P.state !== 'kante' && bodenAb < 0) { bodenAb = i; topoutNr = bilder.length; }
      /* aufzeichnen ab dem letzten Kletterbild vor der Kante */
      const fenster = (P.state === 'climb') || kanteAb >= 0;
      if (!fenster) continue;
      const L = lage();
      const kn = d.animKnochen(['hips']).hips;
      const eintrag = {
        i, zustand: P.state, vorher: vorZ,
        pos: [P.pos.x, P.pos.y, P.pos.z].map((v) => +v.toFixed(4)),
        schritt: [P.pos.x - vorPos[0], P.pos.y - vorPos[1], P.pos.z - vorPos[2]].map((v) => +v.toFixed(4)),
        vel: [P.vel.x, P.vel.y, P.vel.z].map((v) => +v.toFixed(3)),
        onGround: !!P.onGround, groundTop: P.groundTop === undefined ? null : +(+P.groundTop).toFixed(3),
        kante: P.kante ? { t: +P.kante.t.toFixed(3), dauer: +P.kante.dauer.toFixed(3),
                           von: [P.kante.von.x, P.kante.von.y, P.kante.von.z].map((v) => +v.toFixed(3)),
                           nach: [P.kante.nach.x, P.kante.nach.y, P.kante.nach.z].map((v) => +v.toFixed(3)) } : null,
        wand: P.wallInfo ? P.wallInfo.col.id + ':' + P.wallInfo.nx + ',' + P.wallInfo.nz : null,
        anim: P.anim,
        taste: (w ? 'W' : '') + (l ? 'A' : '') + (rr ? 'D' : ''),
        dach: L.dach, naechst: L.naechst, drin: L.drin, korr,
        huefte: kn ? [+(kn.x - P.pos.x).toFixed(3), +(kn.z - P.pos.z).toFixed(3)] : null,
      };
      bilder.push(eintrag);
      if (P.state === 'climb' && kanteAb < 0) {
        /* nur das letzte Kletterbild vor der Kante behalten */
        if (bilder.length > 1) bilder.splice(0, bilder.length - 1);
      }
      if (bodenAb >= 0 && i - bodenAb >= Math.round(a.NACH * 60)) break;
    }
    d.kollLogAn(false);
    const k = d.colliders.find((q) => q.id === a.KOLL);
    return { koll: a.KOLL, h: k.h, radius: r, kanteAb, bodenAb, topoutNr, bilder,
             dachProps: d.dachProps().filter((p) => p.koll && Math.abs(p.x - P.pos.x) < 12 && Math.abs(p.z - P.pos.z) < 12) };
  }, { KOLL, SEITE, F, PLAN, NACH, ANLAUF });
  await b.close();
  if (aus.fehler) { console.log(aus.fehler); return; }
  if (JSON_AUS) fs.writeFileSync(JSON_AUS, JSON.stringify(aus, null, 1));
  console.log('\n== Top-out FlatFacade: Kollider ' + aus.koll + ' Seite ' + SEITE + ' f ' + F + ' Plan ' + PLAN + ' ==');
  console.log('  Haushoehe ' + aus.h + '  Radius ' + aus.radius + '  Kante ab Bild ' + aus.kanteAb + '  Boden ab Bild ' + aus.bodenAb);
  console.log('  Dachaufbauten in der Naehe:');
  for (const p of aus.dachProps) console.log('    ' + p.art + '  koll x ' + p.koll.x0.toFixed(2) + '..' + p.koll.x1.toFixed(2) +
              '  z ' + p.koll.z0.toFixed(2) + '..' + p.koll.z1.toFixed(2) + '  y ' + (+p.koll.y0).toFixed(2) + '..' + (+p.koll.h).toFixed(2));
  /* groesste Lageaenderung je Bild nach dem Top-out (ohne Kante) */
  let max = null;
  aus.bilder.forEach((e, n) => {
    const s = Math.hypot(e.schritt[0], e.schritt[2]);
    if (e.zustand !== 'kante' && e.vorher !== 'climb' && (!max || s > max.s)) max = { s, n, e };
  });
  for (const e of aus.bilder) {
    const s = Math.hypot(e.schritt[0], e.schritt[2]);
    const mark = max && e === max.e ? '  <<< SCHUB' : '';
    console.log('  ' + String(e.i).padStart(4) + ' ' + (e.vorher + '>' + e.zustand).padEnd(13) + ' ' + e.taste.padEnd(2) +
      ' pos ' + e.pos.map((v) => v.toFixed(3)).join(',') + '  d ' + s.toFixed(3) + '  vel ' + e.vel.join(',') +
      '  g ' + (e.onGround ? 1 : 0) + '  dach ' + e.dach +
      (e.kante ? '  kante t ' + e.kante.t : '') +
      (e.drin.length ? '  DRIN ' + e.drin.map((q) => q.id + (q.dachProp ? '(prop)' : q.krone ? '(krone)' : q.kronenTeil ? '(kronenteil)' : q.klein ? '(klein)' : '') + ':' + q.tiefe).join(' ') : '') +
      (e.korr.length ? '  KORR ' + e.korr.map((q) => q.art === 'oben' ? 'oben ' + q.id : q.id + ' wahl ' + q.wahl + ' ' + q.korrektur.join(',') + (q.vorDrin ? ' vorDrin' : '')).join(' | ') : '') +
      mark);
  }
  if (max) {
    console.log('\n  groesster waagrechter Schritt ausserhalb von Kante/Klettern: ' + max.s.toFixed(3) + ' m in Bild ' + max.e.i);
    console.log('  ' + JSON.stringify({ korr: max.e.korr, drin: max.e.drin, naechst: max.e.naechst }));
  }
})();
