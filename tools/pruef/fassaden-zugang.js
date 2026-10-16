/* CITY V2, Stufe 6B: Kommt man vom Gehweg an die Fassade?

   Seit 6A stehen Baeume, Baenke, Kuebel und Muelleimer in der
   Moeblierungszone am Bordstein. Dieser Pruefstand laeuft echt (Taste W,
   derselbe Eingabeweg wie topoutlandung.js) an 20 Fassaden mit neuen
   Strassendetails davor auf die Wand zu. Die Fassaden werden
   deterministisch gewaehlt: Kandidaten sind Hausseiten auf der Bauflucht
   (12,5 bis 16 m von der Blockmitte), vor denen auf derselben Kante
   mindestens ein neues Ding steht; Reihenfolge nach einem festen Hash
   aus Haus und Seite, die Stadtteile reihum.

   Je Fassade wird alle 1,5 m entlang der Front gelaufen, zweimal:
     vom Bordstein  Start 0,4 m innerhalb der Bordsteinkante - wer von
                    der Strasse kommt, muss durch die Moeblierungszone
     vom Gehweg     Start auf der Gehlinie, 17 m von der Blockmitte
   Ein Lauf kommt an, wenn die Figur bis 0,8 m an die Fassadenebene
   herankommt oder zu klettern beginnt. Startpunkte, an denen die Figur
   schon beim Hinstellen weggeschoben wird (in einem Hindernis), zaehlen
   nicht als Lauf.

   Ergebnis je Fassade: Wand erreichbar, direkte Zugaenge vom Bordstein
   und vom Gehweg, completelyBlockedFacadeAccess (kein einziger Lauf
   kommt an). Dazu fuer die ganze Stadt: Haustuer-Durchgang und -Vorfeld
   sowie der 1,5-m-Streifen vor Arkaden und offenen Erdgeschosshallen -
   steht dort ein neues Strassendetail? -, und an jeder Haustuer ein
   echter Lauf vom Gehweg zur Tuer.

   Aufruf:  node tools/pruef/fassaden-zugang.js [aus.json] [anzahl=20]
   ========================================================================= */
const fs = require('node:fs');
const { starte, ausgabePfad } = require('./basis');
const zielDatei = ausgabePfad(process.argv[2]);
const nArg = process.argv.find((v) => v.indexOf('anzahl=') === 0);
const ANZAHL = nArg ? +nArg.slice(7) : 20;

(async () => {
  const { b, page } = await starte(320, 180, 4711, {});
  const aus = await page.evaluate((ANZAHL) => {
    const d = __dbg, P = d.player, R = d.raster();
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft'];
    const los = () => { for (const t of TASTEN) d.taste(t, false); };
    const HALB = 19, GEH = 17;
    const teile = new Map(d.stadtteile().map((t) => [t.bi + ',' + t.bj, t]));
    const SD = d.strassenDetails ? d.strassenDetails() : [];
    const SEITEN = { N: [0, 1], S: [0, -1], O: [1, 0], W: [-1, 0] };
    const ueber = (a, q) => a.x0 < q.x1 && a.x1 > q.x0 && a.z0 < q.z1 && a.z1 > q.z0;

    /* ---- Kandidaten ---- */
    const kand = [];
    for (const c of d.colliders) {
      if (c.bau !== c || c.klein || c.innen || c.dachProp || c.krone || c.parkAuto || (c.h || 0) < 4) continue;
      const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2;
      const bi = Math.floor((mx - R.x0) / R.pitch), bj = Math.floor((mz - R.z0) / R.pitch);
      const t = teile.get(bi + ',' + bj);
      if (!t) continue;
      for (const [seite, [nx, nz]] of Object.entries(SEITEN)) {
        const ebene = nx > 0 ? c.x1 : nx < 0 ? c.x0 : nz > 0 ? c.z1 : c.z0;
        const tiefe = nx !== 0 ? (ebene - t.x) * nx : (ebene - t.z) * nz;
        if (tiefe < 12.5 || tiefe > 16) continue;
        const a0 = Math.max(nx !== 0 ? c.z0 : c.x0, (nx !== 0 ? t.z : t.x) - 16.5);
        const a1 = Math.min(nx !== 0 ? c.z1 : c.x1, (nx !== 0 ? t.z : t.x) + 16.5);
        if (a1 - a0 < 3) continue;
        /* neue Dinge auf dieser Kante vor der Front */
        const vor = SD.filter((e) => {
          const q = nx !== 0 ? (e.x - t.x) * nx : (e.z - t.z) * nz;
          const l = nx !== 0 ? e.z : e.x;
          return q > 16.5 && q < HALB && l > a0 - 2 && l < a1 + 2 && !e.flach;
        });
        if (!vor.length) continue;
        const hash = (Math.imul(c.id, 2654435761) ^ Math.imul(Object.keys(SEITEN).indexOf(seite) + 1, 40503)) >>> 0;
        kand.push({ id: c.id, seite, nx, nz, ebene, a0, a1, cx: t.x, cz: t.z, bezirk: t.art, vor: vor.map((e) => e.art), hash });
      }
    }
    kand.sort((p, q) => p.hash - q.hash);
    const reihum = ['ZENTRUM', 'GESCHAEFT', 'MISCHUNG', 'WOHN', 'UFER'];
    const wahl = [];
    const genutzt = new Set();
    while (wahl.length < ANZAHL) {
      let neu = 0;
      for (const bz of reihum) {
        if (wahl.length >= ANZAHL) break;
        const k = kand.find((q) => q.bezirk === bz && !genutzt.has(q.id + q.seite));
        if (k) { genutzt.add(k.id + k.seite); wahl.push(k); neu++; }
      }
      if (!neu) break;
    }

    /* ---- Ein Lauf: von (sx, sz) mit W auf die Ebene zu ---- */
    const lauf = (sx, sz, nx, nz, ebene) => {
      los();
      d.setzePos(sx, 0.3, sz);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(-nx, -nz);
      d.setzeKamYaw(Math.atan2(nx, nz));
      for (let i = 0; i < 12; i++) d.schritt(1 / 60);
      if (Math.hypot(P.pos.x - sx, P.pos.z - sz) > 0.5) return 'startBelegt';
      for (let i = 0; i < 300; i++) {
        d.taste('KeyW', true);
        d.schritt(1 / 60);
        const ab = nx !== 0 ? (P.pos.x - ebene) * nx : (P.pos.z - ebene) * nz;
        if (ab < 0.8 || P.state === 'climb' || P.state === 'kante') { los(); return 'an'; }
      }
      los();
      return 'nicht';
    };

    const fassaden = [];
    for (const k of wahl) {
      const F = { haus: k.id, seite: k.seite, bezirk: k.bezirk, laenge: +(k.a1 - k.a0).toFixed(1), vor: k.vor,
                  bord: { an: 0, nicht: 0, startBelegt: 0 }, gehweg: { an: 0, nicht: 0, startBelegt: 0 }, gesperrteStellen: [] };
      for (let a = k.a0 + 0.75; a <= k.a1 - 0.75 + 1e-6; a += 1.5) {
        for (const [art, tiefe] of [['bord', HALB - 0.4], ['gehweg', GEH]]) {
          const sx = k.nx !== 0 ? k.cx + k.nx * tiefe : a, sz = k.nz !== 0 ? k.cz + k.nz * tiefe : a;
          const r = lauf(sx, sz, k.nx, k.nz, k.ebene);
          F[art][r]++;
          if (r === 'nicht' && art === 'bord') F.gesperrteStellen.push(+a.toFixed(1));
        }
      }
      F.erreichbar = F.bord.an + F.gehweg.an > 0;
      F.completelyBlocked = !F.erreichbar;
      fassaden.push(F);
    }

    /* ---- Haustueren: Durchgang/Vorfeld frei von neuen Dingen, echter Lauf vom Gehweg ---- */
    const tueren = [];
    for (const t of d.tuerStellen()) {
      const imWeg = SD.filter((e) => !e.flach && (ueber(e.kasten, t.durchgang) || ueber(e.kasten, t.vorfeld))).map((e) => e.art + ' ' + e.nr);
      const mx = (t.durchgang.x0 + t.durchgang.x1) / 2, mz = (t.durchgang.z0 + t.durchgang.z1) / 2;
      /* Lauf: 3 m vor der Tuer (Aussennormale) auf die Tuermitte zu */
      const nx = Math.abs(t.nx) > 0.5 ? Math.sign(t.nx) : 0, nz = nx === 0 ? Math.sign(t.nz) : 0;
      const ebene = nx !== 0 ? (nx > 0 ? t.durchgang.x1 : t.durchgang.x0) : (nz > 0 ? t.durchgang.z1 : t.durchgang.z0);
      const r = lauf(mx + nx * 3, mz + nz * 3, nx, nz, ebene - (nx + nz) * 0.4);
      tueren.push({ haus: t.haus, x: +mx.toFixed(1), z: +mz.toFixed(1), imWeg, lauf: r });
    }
    /* ---- Arkaden / offene Hallen: 1,5-m-Streifen vor jeder Seite ---- */
    const arkaden = [];
    for (const c of d.colliders) {
      if (!c.boden) continue;
      const B = 1.5;
      for (const [seite, q] of [['W', { x0: c.x0 - B, x1: c.x0, z0: c.z0, z1: c.z1 }], ['O', { x0: c.x1, x1: c.x1 + B, z0: c.z0, z1: c.z1 }],
                                 ['S', { x0: c.x0, x1: c.x1, z0: c.z0 - B, z1: c.z0 }], ['N', { x0: c.x0, x1: c.x1, z0: c.z1, z1: c.z1 + B }]]) {
        const imWeg = SD.filter((e) => !e.flach && ueber(e.kasten, q)).map((e) => e.art + ' ' + e.nr);
        arkaden.push({ haus: c.id, seite, imWeg });
      }
    }
    return { kandidaten: kand.length, fassaden, tueren, arkaden };
  }, ANZAHL);
  await b.close();

  const p = (s) => console.log(s);
  p('');
  p('== Fassaden-Zugang: ' + aus.fassaden.length + ' Fassaden (aus ' + aus.kandidaten + ' Kandidaten mit neuen Strassendetails davor) ==');
  for (const F of aus.fassaden) {
    p('  Haus ' + String(F.haus).padStart(5) + ' ' + F.seite + ' ' + F.bezirk.padEnd(9) + ' ' + String(F.laenge).padStart(5) + ' m  vom Bordstein ' +
      F.bord.an + '/' + (F.bord.an + F.bord.nicht) + (F.bord.startBelegt ? ' (+' + F.bord.startBelegt + ' Start belegt)' : '') +
      '   vom Gehweg ' + F.gehweg.an + '/' + (F.gehweg.an + F.gehweg.nicht) +
      '   ' + (F.completelyBlocked ? 'KOMPLETT GESPERRT' : 'erreichbar') +
      (F.gesperrteStellen.length ? '   Bordstein zu bei ' + F.gesperrteStellen.join(',') : '') + '   davor: ' + F.vor.join(','));
  }
  const gesperrt = aus.fassaden.filter((F) => F.completelyBlocked).length;
  const tuerWeg = aus.tueren.filter((t) => t.imWeg.length);
  const tuerLauf = aus.tueren.filter((t) => t.lauf !== 'an');
  const arkWeg = aus.arkaden.filter((a) => a.imWeg.length);
  p('');
  p('  completelyBlockedFacadeAccess  ' + gesperrt + ' von ' + aus.fassaden.length);
  p('  Wand erreichbar                ' + aus.fassaden.filter((F) => F.erreichbar).length + ' von ' + aus.fassaden.length);
  p('  Haustueren: neues Ding in Durchgang/Vorfeld ' + tuerWeg.length + ' von ' + aus.tueren.length +
    ', Lauf vom Gehweg nicht angekommen ' + tuerLauf.length + (tuerLauf.length ? ' ' + JSON.stringify(tuerLauf) : ''));
  p('  Arkaden/Hallen-Seiten mit neuem Ding im 1,5-m-Streifen ' + arkWeg.length + ' von ' + aus.arkaden.length +
    (arkWeg.length ? ' ' + JSON.stringify(arkWeg) : ''));
  if (zielDatei) fs.writeFileSync(zielDatei, JSON.stringify(aus, null, 1));
  process.exit(gesperrt || tuerWeg.length || arkWeg.length ? 1 : 0);
})();
