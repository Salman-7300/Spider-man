/* problem-2, FlatFacade Top-out Push: Pflichttest Landung nach dem
   Ueberziehen.

   Echter Eingabeweg wie klettervideo.js: fuenf Meter vor der Fassade,
   Anlauf mit Shift+W, Klettern mit W bis zum Ueberziehen. Ab dem
   Ueberziehen ein Tastenplan:

     W     W bleibt gehalten
     LOS   nichts gedrueckt
     WA    W und leicht links (A)
     WD    W und leicht rechts (D)

   JEDER Fall laeuft in einer frisch geladenen Seite. Mehrere Laeufe in
   einer Seite hintereinander gaben an derselben Stelle verschiedene
   Ergebnisse (Zustand des vorigen Laufs), mit frischer Seite ist jede
   Stelle reproduzierbar (gemessen: f 0,5 zweimal Ueberziehen bei Bild
   152, f 0,3 zweimal haengen bei y 4,72).

   Gemessen ab dem ersten Bodenbild nach der Kante (erster voller
   Dachkontakt) ueber NACH Sekunden:

     aufsDach        ohne Eingabe: am Ende auf der Hoehe des Landepunkts
                     (der ueberzogenen Kante, ggf. auf einem Absatz);
                     mit Eingabe: nicht ueber die gekletterte Kante
                     zurueckgefallen
     haus            ueber welche Kante gezogen wurde (an einer Naht kann
                     es das Nachbarhaus sein)
     gefallen        Sturz ueber die GEKLETTERTE Kante (Hoehe unter Dach
                     - 0,5 m, Lage vor der Fassade). Wer mit W/A/D ueber
                     die hintere oder seitliche Kante weiterlaeuft, faellt
                     nicht wegen des Ueberziehens.
     eindringen      Lagekorrekturen aus collideBody (KOLL_LOG), die
                     tiefer sind als ein Laufschritt (> 0,15 m): die
                     Figur stand schon IN einem Kasten
     zurKante        Summe der collideBody-Korrekturen Richtung
                     Wandnormale (zur Absturzkante), m - als Gate nur
                     ohne Eingabe (mit W schiebt die Kollision beim
                     Gegenlaufen an einen Kasten je Bild einen Laufschritt
                     zurueck; das ist normale Kollision)
     teleport        waagrechter Schritt je Bild > 0,3 m
     postTopOutUnexpectedDisplacement
                     NUR ohne Eingabe (LOS): groesster waagrechter
                     Abstand zur ersten Bodenlage im Messfenster

   Die Grenze fuer postTopOutUnexpectedDisplacement wird nicht geraten:
   sie kommt aus den LOS-Laeufen an den KONTROLLHAEUSERN, an denen
   collideBody nichts korrigiert (normale Landung): Maximum + 2 cm.

   Faelle:
     problem   Brownstone_FlatFacade_1, Kollider 169, Seite +z: 11 Stellen
               ohne Eingabe, dazu f 0,5 mit W, LOS, WA und WD
     kontrolle je ein Haus Downtown_ModernOffice_1,
               Downtown_PublicBuilding_1, ein MERGED-Haus und eine
               FlatFacade ohne Dachaufbau nahe der Kante (je W und LOS)

   Aufruf:  node tools/pruef/topoutlandung.js [nur=problem|kontrolle]
              [alt=krone,landung] [nach=1.5]
   ========================================================================= */
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const NUR = arg('nur', '');
const ALT = arg('alt', '').split(',');
const NACH = +arg('nach', 1.5);
const OPT = { kroneTeileAlt: ALT.includes('krone'), kanteLandungAlt: ALT.includes('landung') };

/* Die Kontrollhaeuser waehlt die erste Seite; sie haengen nur vom
   Stadtplan ab (Keim 4711), nicht vom Stand. */
async function kontrollFaelle() {
  const { b, page } = await starte(320, 180, 4711, OPT);
  const F = await page.evaluate(() => {
    const d = __dbg, R = d.player.radius, aus = [];
    const frei1m = (c, nx, nz, y, t) => {
      const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 0.6 : t;
      const pz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * 0.6 : t;
      for (const q of d.colliderNah(px, pz)) {
        if (q === c || q.innen || q.parkAuto) continue;
        const y0 = q.y0 === undefined ? -1e9 : q.y0;
        if (px > q.x0 - 0.5 && px < q.x1 + 0.5 && pz > q.z0 - 0.5 && pz < q.z1 + 0.5 && y > y0 && y < (q.h || 0)) return false;
      }
      return true;
    };
    const zielLeer = (c, nx, nz, t) => {
      const front = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      const zx = nx !== 0 ? front - nx * (R + 0.9) : t, zz = nz !== 0 ? front - nz * (R + 0.9) : t;
      for (const q of d.colliderNah(zx, zz)) {
        if (q === c || (q.h || 0) <= c.h + 0.05) continue;
        if (zx > q.x0 - 1.5 && zx < q.x1 + 1.5 && zz > q.z0 - 1.5 && zz < q.z1 + 1.5) return false;
      }
      return true;
    };
    const seite = (c, leer) => {
      for (const [nx, nz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
        let ok = true;
        for (const f of [0.4, 0.5, 0.6]) {
          const t = nx !== 0 ? c.z0 + (c.z1 - c.z0) * f : c.x0 + (c.x1 - c.x0) * f;
          for (const y of [c.h - 6, c.h - 2]) if (!frei1m(c, nx, nz, y, t)) ok = false;
          if (leer && !zielLeer(c, nx, nz, t)) ok = false;
        }
        if (ok) return [nx, nz];
      }
      return null;
    };
    const typ = new Map();
    for (const o of d.hausModelle()) { const K = o.userData.hausKiste; if (K && K.koll) typ.set(K.koll, o.userData.modellName); }
    const wahl = [
      ['ModernOffice_1', (c) => typ.get(c) === 'Downtown_ModernOffice_1', false],
      ['PublicBuilding_1', (c) => typ.get(c) === 'Downtown_PublicBuilding_1', false],
      ['MERGED', (c) => !typ.has(c) && !c.fassade, false],
      ['FlatFacade ohne Aufbau', (c) => /Brownstone_FlatFacade/.test(typ.get(c) || ''), true],
    ];
    for (const [name, passt, leer] of wahl) {
      const c = d.colliders.find((q) => q.bau === q && !q.klein && !q.dachProp && !q.krone && !q.innen &&
                                        (q.h || 0) > 10 && passt(q) && seite(q, leer));
      if (!c) { aus.push({ gruppe: 'kontrolle', name: name + ': kein Haus gefunden', fehlt: true }); continue; }
      const s = seite(c, leer);
      for (const plan of ['W', 'LOS'])
        aus.push({ gruppe: 'kontrolle', name: name + ' ' + c.id + ' ' + s.join(',') + ' ' + plan, koll: c.id, nx: s[0], nz: s[1], f: 0.5, plan });
    }
    return aus;
  });
  await b.close();
  return F;
}

async function fahre(F) {
  const { b, page } = await starte(320, 180, 4711, OPT);
  const r = await page.evaluate((a) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) d.taste(t, false);
    const c = d.colliders.find((q) => q.id === a.koll);
    const { nx, nz } = a, ax = nx !== 0, l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
    const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
    const t = l0 + (l1 - l0) * a.f;
    d.setzePos(ax ? front + nx * 5 : t, 0.3, ax ? t : front + nz * 5);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.wallInfo = null; P.wall = null;
    P.facing = Math.atan2(-nx, -nz);
    d.setzeKamYaw(Math.atan2(nx, nz));
    for (let i = 0; i < 20; i++) d.schritt(1 / 60);
    let anlauf = true, kanteAb = -1, boden = null, boden0 = null, fenster = 0, maxY = 0;
    const M = { aufsDach: false, gefallen: false, eindringen: 0, eindringenMax: 0, zurKante: 0, teleport: 0,
                schrittMax: 0, ptud: 0, korrSeitlich: 0, dachH: c.h, kanteZiel: null };
    d.kollLogAn(true);
    for (let i = 0; i < 3000; i++) {
      if (anlauf && (i >= 150 || P.state === 'climb')) anlauf = false;
      const oben = kanteAb >= 0;
      d.taste('KeyW', !(oben && a.plan === 'LOS'));
      d.taste('KeyA', oben && a.plan === 'WA');
      d.taste('KeyD', oben && a.plan === 'WD');
      d.taste('ShiftLeft', anlauf && P.state !== 'climb');
      const vx = P.pos.x, vz = P.pos.z;
      d.schritt(1 / 60);
      maxY = Math.max(maxY, P.pos.y);
      const korr = d.kollLogHol();
      if (P.state === 'kante' && kanteAb < 0) {
        kanteAb = i; M.kanteZiel = [P.kante.nach.x, P.kante.nach.y, P.kante.nach.z].map((v) => +v.toFixed(3));
        M.haus = P.kante.wand && P.kante.wand.col ? P.kante.wand.col.id : null;
      }
      if (kanteAb >= 0 && P.state !== 'kante' && !boden) { boden = i; boden0 = [P.pos.x, P.pos.y, P.pos.z]; }
      if (!boden) { if (i > 2400) break; continue; }
      fenster++;
      const s = Math.hypot(P.pos.x - vx, P.pos.z - vz);
      if (fenster > 1) { M.schrittMax = Math.max(M.schrittMax, s); if (s > 0.3) M.teleport++; }
      for (const k of korr) {
        if (k.art !== 'seitlich') continue;
        const kl = Math.hypot(k.korrektur[0], k.korrektur[1]);
        M.korrSeitlich++;
        if (kl > 0.15) { M.eindringen++; M.eindringenMax = Math.max(M.eindringenMax, kl); }
        const zk = k.korrektur[0] * nx + k.korrektur[1] * nz;
        if (zk > 0) M.zurKante += zk;
      }
      /* Sturz ueber die gekletterte Kante: tiefer als Dach - 0,5 m UND vor
         der Fassade */
      const vor = (P.pos.x - (ax ? front : 0)) * nx + (P.pos.z - (ax ? 0 : front)) * nz;
      if (P.pos.y < c.h - 0.5 && vor > 0) M.gefallen = true;
      if (a.plan === 'LOS') M.ptud = Math.max(M.ptud, Math.hypot(P.pos.x - boden0[0], P.pos.z - boden0[2]));
      if (fenster >= Math.round(a.nach * 60)) break;
    }
    d.kollLogAn(false);
    if (!boden) return { fehler: kanteAb < 0 ? 'kein Ueberziehen (Klettern endet bei y ' + maxY.toFixed(2) + ')' : 'kein Bodenbild nach der Kante' };
    /* auf dem Dach: ohne Eingabe auf Dachhoehe (oder einem Teil darauf);
       mit Eingabe genuegt, dass nichts ueber die geklett. Kante fiel */
    M.aufsDach = !M.gefallen && (a.plan !== 'LOS' || P.pos.y >= M.kanteZiel[1] - 0.05);
    M.boden0 = boden0.map((v) => +v.toFixed(3));
    M.ende = [P.pos.x, P.pos.y, P.pos.z].map((v) => +v.toFixed(3));
    return M;
  }, Object.assign({ nach: NACH }, F));
  await b.close();
  return Object.assign({}, F, r);
}

(async () => {
  const faelle = [];
  if (NUR !== 'kontrolle') {
    for (const f of [0.05, 0.15, 0.25, 0.45, 0.55, 0.6, 0.65, 0.8, 0.85, 0.9, 0.95])
      faelle.push({ gruppe: 'problem', name: 'FlatFacade_1 169 +z f' + f + ' LOS', koll: 169, nx: 0, nz: 1, f, plan: 'LOS' });
    for (const plan of ['W', 'LOS', 'WA', 'WD'])
      faelle.push({ gruppe: 'problem', name: 'FlatFacade_1 169 +z f0.5 ' + plan, koll: 169, nx: 0, nz: 1, f: 0.5, plan });
  }
  if (NUR !== 'problem') faelle.push(...await kontrollFaelle());
  const ergebnisse = [];
  for (const F of faelle) {
    if (F.fehlt) { ergebnisse.push(Object.assign({}, F)); continue; }
    let e;
    for (let versuch = 0; versuch < 2 && !e; versuch++) {
      try { e = await fahre(F); } catch (err) { if (versuch) e = Object.assign({}, F, { fehler: 'Laden: ' + err.message.split('\n')[0] }); }
    }
    ergebnisse.push(e);
    process.stdout.write('.');
  }

  console.log('\n\n== Top-out-Landung (' + (ALT[0] ? 'ALT: ' + ALT.join(',') : 'aktueller Stand') + ', Fenster ' + NACH + ' s, je Fall frische Seite) ==');
  for (const e of ergebnisse) {
    if (e.fehlt) { console.log('  ' + e.name); continue; }
    if (e.fehler) { console.log('  ' + e.name.padEnd(44) + ' ' + e.fehler); continue; }
    console.log('  ' + e.name.padEnd(44) + ' Haus ' + e.haus + (e.haus !== e.koll ? ' (Nachbar)' : '') +
      '  aufsDach ' + (e.aufsDach ? 'ja ' : 'NEIN') + '  gefallen ' + (e.gefallen ? 'JA' : 'nein') +
      '  eindringen ' + e.eindringen + (e.eindringen ? ' (max ' + e.eindringenMax.toFixed(3) + ')' : '') +
      '  zurKante ' + e.zurKante.toFixed(3) + '  teleport ' + e.teleport + '  Schritt max ' + e.schrittMax.toFixed(3) +
      (e.plan === 'LOS' ? '  postTopOutUnexpectedDisplacement ' + e.ptud.toFixed(3) : '') +
      '  Ziel ' + JSON.stringify(e.kanteZiel) + ' -> Ende ' + JSON.stringify(e.ende));
  }
  const normal = ergebnisse.filter((e) => e.gruppe === 'kontrolle' && !e.fehler && !e.fehlt && e.plan === 'LOS' && e.korrSeitlich === 0).map((e) => e.ptud);
  const grenze = normal.length ? Math.max(...normal) + 0.02 : null;
  console.log('\n  normale Landungen (Kontrolle, LOS, collideBody korrigiert nichts): ' + normal.length +
              (normal.length ? '  postTopOutUnexpectedDisplacement max ' + Math.max(...normal).toFixed(3) + ' m -> Grenze ' + grenze.toFixed(3) + ' m' : ''));
  for (const g of ['problem', 'kontrolle']) {
    const L = ergebnisse.filter((e) => e.gruppe === g && !e.fehlt);
    if (!L.length) continue;
    const oben = L.filter((e) => !e.fehler);
    const ok = oben.filter((e) => e.aufsDach && !e.gefallen && e.eindringen === 0 && e.teleport === 0 &&
                                  (e.plan !== 'LOS' || (e.zurKante < 0.05 && (grenze === null || e.ptud <= grenze))));
    console.log('  ' + g.padEnd(10) + ' Ueberziehen ' + oben.length + '/' + L.length + '   davon bestanden ' + ok.length + '/' + oben.length);
  }
})();
