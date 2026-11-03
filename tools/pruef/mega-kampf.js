/* Mega-Update 1.0, M2: Combat 2.0 im laufenden Spiel.
   =========================================================================
   Echte Eingaben (Linksklick = tryAttack('punch'), F = tryAttack('kick'),
   R = uppercut, Q = webShot, Leertaste = tryJump). Gestellt wird nur die
   Ausgangslage: Held und Gegner an einen festen Ort, damit die Bedingung
   des Abschlusses sicher vorliegt (Wand dahinter / keine Wand / Gegner in
   der Luft). Regisseur, Auftraege und fremde Ganoven sind fuer den Test
   ausgeschaltet bzw. entfernt.

     wand      6 Ladenfronten: Gegner 2 m vor der Fassade, Held davor;
               drei Schlaege, dann Q -> an die Wand geheftet?
     ohnewand  freie Kreuzung, Gegner ohne Wand dahinter; drei Schlaege,
               dann Q -> normaler Netzschuss (Rueckfall), kein Wandabschluss
     luft      zwei Gegner: Aufwaertshaken, Leertaste hinterher, ein Schlag
               in der Luft, F -> Luft-Finisher, Druckwelle trifft den zweiten?
     rollen    Kampf gegen fuenf Rollen (flink, waechter, schlaeger, brecher,
               werfer), Held steht und schlaegt nur zu, wer ihm nahe kommt;
               je Rolle der Winkel zur Blickrichtung des Helden, Abstand,
               Angreifer gleichzeitig - mit und ohne Rollentaktik
               (kampfAlt=1 im zweiten Browser)

   Aufruf:  node pruef/mega-kampf.js [teil=alle|wand|ohnewand|luft|rollen] [aus=datei.json]
   Exit 1, wenn eine Pruefbedingung verfehlt ist.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const TEIL = arg('teil', 'alle');
const AUS = arg('aus', null);
/* M6: Fertigkeiten vor dem Lauf kaufen (z. B. skill=abschluss) - fuer den
   Vergleich in tools/pruef/mega-fortschritt.js. */
const SKILL = arg('skill', null);

const seitenCode = () => {
  const d = __dbg, P = d.player;
  d.frier(true);
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
  const tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
  const K = window.__mk = {};
  K.vorbereiten = () => {
    d.evAlleBeenden();
    d.mega.blockiere(true);
    if (d.stufe < 3) d.addScore(60000);           // Aufwaertshaken und Wurf frei
    for (const g of d.enemies) { if (!g.dead) { g.dead = true; g.deadT = 0.01; g.liegt = true; } }
    for (let i = 0; i < 30; i++) d.schritt(1 / 60);
  };
  K.schritt = (n) => { for (let i = 0; i < n; i++) { d.mega.blockiere(true); if (P.hp < 60) P.hp = 100; d.schritt(1 / 60); } };
  /* Wie ein Spieler: erst druecken, wenn die Schlagsperre vorbei ist -
     sonst verwirft das Spiel die Eingabe (attackCd). */
  K.bereit = () => { for (let i = 0; i < 90 && P.attackCd > 0.05; i++) K.schritt(1); };
  K.setze = (x, z, blickX, blickZ) => {
    const y = d.groundYAt(x, z, 2);
    P.pos.set(x, y, z); P.vel.set(0, 0, 0);
    P.state = 'ground'; P.onGround = true; P.dead = false; P.hp = 100;
    P.facing = Math.atan2(blickX - x, blickZ - z);
    d.kamStart(Math.atan2(-(blickX - x), -(blickZ - z)), 0.2);
    tasten([]);
  };
  K.gegner = (x, z, art) => {
    const g = d.spawnGang(x, z, 1, 'event').enemies[0];
    g.pos.set(x, d.groundYAt(x, z, 2), z);
    if (art) {
      const typ = d.mega.ganoven().find((t) => t.art === art);
      if (typ) { g.typ = typ; g.hp = typ.hp; g.hpMax = typ.hp; }
    }
    /* Viel Leben: getestet wird der Abschluss, nicht wie schnell der
       Gegner faellt (ab Stufe 3 reichen sonst zwei Schlaege). */
    g.hp = g.hpMax = 400;
    g.state = 'chase'; g.target = 'player'; g.anfuehrer = false;
    g.blockT = 0; g.blockCd = 99; g.paradeCd = 99; g.ausweichCd = 99;
    return g;
  };
  K.wand = (n) => {
    const aus = [];
    const L = d.mega.ladenListe();
    let probiert = 0;
    for (const l of L) {
      if (aus.length >= n || probiert > 60) break;
      probiert++;
      const ex = l.tx + l.nx * 2.0, ez = l.tz + l.nz * 2.0;
      const px = l.tx + l.nx * 3.9, pz = l.tz + l.nz * 3.9;
      const oe = d.mega.ort(ex, ez), op = d.mega.ort(px, pz);
      if (oe.haus || op.haus || Math.abs(oe.y - op.y) > 0.2 || oe.oben > oe.y + 0.3 || op.oben > op.y + 0.3) continue;
      K.vorbereiten();
      const vor = d.mega.kampf();
      K.setze(px, pz, ex, ez);
      const g = K.gegner(ex, ez, 'schlaeger');
      const f0 = { combo: 0 };
      /* drei Schlaege */
      for (let i = 0; i < 3; i++) { K.bereit(); d.tryAttack('punch'); K.schritt(8); }
      K.bereit();
      f0.combo = P.combo; f0.stagger = +g.staggerT.toFixed(2); f0.hpAnteil = +(g.hp / g.hpMax).toFixed(2);
      const vorQ = d.mega.kampf();
      d.webShot();
      let imp = 0;
      for (let i = 0; i < 90; i++) { K.schritt(1); imp = Math.max(imp, d.mega.kamImpuls()); }
      const nach = d.mega.kampf();
      const wandAbstand = (g.pos.x - l.tx) * l.nx + (g.pos.z - l.tz) * l.nz;
      aus.push({ laden: l.nr, programm: l.programm, gestartet: nach.wandStart - vorQ.wandStart,
                 finisher: nach.wandFinish - vorQ.wandFinish, rueckfall: nach.wandFallback - vorQ.wandFallback,
                 ohneWand: nach.wandOhneWand - vorQ.wandOhneWand, nichtOffen: nach.wandNichtOffen - vorQ.wandNichtOffen,
                 anWand: !!g.anWand, webStufe: g.webStufe || 0, tot: !!g.dead,
                 wandAbstand: +wandAbstand.toFixed(2), hoehe: +(g.pos.y - d.groundYAt(g.pos.x, g.pos.z, 2)).toFixed(2),
                 kamImpulsMax: +imp.toFixed(2), vorher: f0 });
      g.dead = true; g.deadT = 0.01;
    }
    return aus;
  };
  K.ohnewand = () => {
    K.vorbereiten();
    /* freie Kreuzungsmitte suchen, in der auf 7 m keine Wand liegt */
    const kand = [[25, 25], [75, -25], [-25, 75], [-75, 25], [25, -75], [-125, -25]];
    for (const [x, z] of kand) {
      if (d.mega.wandHinter(x, z, 1, 0, 7.5) || d.mega.wandHinter(x, z, -1, 0, 7.5)) continue;
      const vorQ0 = d.mega.kampf();
      K.setze(x - 2.4, z, x, z);
      const g = K.gegner(x, z, 'schlaeger');
      for (let i = 0; i < 3; i++) { K.bereit(); d.tryAttack('punch'); K.schritt(8); }
      K.bereit();
      const vorQ = d.mega.kampf();
      d.webShot();
      K.schritt(60);
      const nach = d.mega.kampf();
      const r = { ort: [x, z], gestartet: nach.wandStart - vorQ.wandStart, ohneWand: nach.wandOhneWand - vorQ.wandOhneWand,
                  webStufe: g.webStufe || 0, anWand: !!g.anWand, combo: P.combo };
      g.dead = true; g.deadT = 0.01;
      return r;
    }
    return { fehler: 'keine freie Kreuzung' };
  };
  K.luft = () => {
    K.vorbereiten();
    const x = 25, z = 25;
    K.setze(x - 1.6, z, x, z);
    const a = K.gegner(x, z, 'schlaeger');
    const b = K.gegner(x + 2.4, z + 0.6, 'schlaeger');
    b.state = 'patrol'; b.target = null;
    const vor = d.mega.kampf();
    const spur = [];
    /* Direkt der Aufwaertshaken: ein Schlag davor stiess den Gegner je
       nach Lage schon ueber die 2,8 m Reichweite des Hakens hinaus. */
    K.bereit();
    d.uppercut(); K.schritt(12);
    spur.push(['haken', +a.pos.y.toFixed(2), +(a.inDerLuft || 0).toFixed(2)]);
    d.tryJump(); K.schritt(14);
    spur.push(['hinterher', +P.pos.y.toFixed(2), +a.pos.y.toFixed(2), P.onGround]);
    K.bereit(); d.tryAttack('punch'); K.schritt(6);
    spur.push(['luftschlag', +P.pos.y.toFixed(2), +a.pos.y.toFixed(2)]);
    const bHpVor = b.hp;
    K.bereit();
    spur.push(['vorF', +P.pos.y.toFixed(2), P.onGround, +a.pos.y.toFixed(2), +(a.inDerLuft || 0).toFixed(2)]);
    const aHpVor = a.hp;
    d.tryAttack('kick');
    const schadenFinisher = +(aHpVor - a.hp).toFixed(2);   // M6: Schaden des Finishers selbst
    let imp = 0, landung = null;
    for (let i = 0; i < 120; i++) {
      K.schritt(1); imp = Math.max(imp, d.mega.kamImpuls());
      if (landung === null && a.pos.y <= d.groundYAt(a.pos.x, a.pos.z, 2) + 0.05) landung = i;
    }
    const nach = d.mega.kampf();
    return { finisher: nach.luftFinish - vor.luftFinish, welle: nach.luftWelle - vor.luftWelle, schadenFinisher,
             ohneKombo: nach.luftOhneKombo - vor.luftOhneKombo,
             zweiterGetroffen: b.hp < bHpVor, zweiterTaumel: +(b.staggerT || 0).toFixed(2),
             landungNachBildern: landung, kamImpulsMax: +imp.toFixed(2), spur,
             heldLandet: P.onGround, heldY: +P.pos.y.toFixed(2) };
  };
  K.rollen = (sekunden, runden) => {
    runden = runden || 1;
    const x = 25, z = 25;
    const rollen = ['flink', 'waechter', 'schlaeger', 'brecher', 'werfer'];
    const winkel = {}, abst = {};
    for (const r of rollen) { winkel[r] = []; abst[r] = []; }
    let gleichzeitigMax = 0, nahGleichzeitigMax = 0, angriffe = {}, hinten = {}, bilderDrei = 0, bilder = 0, quelleDrei = {};
    const dreiDetails = [];
    let ms = 0;
    for (let rd = 0; rd < runden; rd++) {
    K.vorbereiten();
    K.setze(x, z, x, z + 10);                 // Blick nach +z
    /* Jede Runde beginnen die Rollen an anderen Plaetzen. */
    const G = rollen.map((r, i) => {
      const w = (i + rd * 1.37) / rollen.length * Math.PI * 2;
      const g = K.gegner(x + Math.sin(w) * 7, z + Math.cos(w) * 7, r);
      g.blockCd = 0; g.paradeCd = 0; g.ausweichCd = 0;
      return g;
    });
    const vorn = P.facing;
    const wd = (a, b) => { let q = (a - b) % (Math.PI * 2); if (q > Math.PI) q -= Math.PI * 2; if (q < -Math.PI) q += Math.PI * 2; return Math.abs(q); };
    for (let f = 0; f < sekunden * 60; f++) {
      /* Der Held dreht sich nicht weg: er schaut nach +z und schlaegt nur,
         wenn jemand vor ihm steht. */
      P.facing = vorn;
      if (f % 20 === 0) {
        let nah = null, nd = 2.2;
        for (const g of G) {
          if (g.dead) continue;
          const dd = Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z);
          if (dd < nd && wd(Math.atan2(g.pos.x - P.pos.x, g.pos.z - P.pos.z), vorn) < 0.8) { nd = dd; nah = g; }
        }
        if (nah) d.tryAttack('punch');
      }
      const t0 = performance.now();
      K.schritt(1);
      ms += performance.now() - t0;
      if (P.hp < 100) P.hp = 100;
      let gl = 0, glNah = 0;
      for (let i = 0; i < G.length; i++) {
        const g = G[i], r = rollen[i];
        if (g.dead) continue;
        /* Gezaehlt wird, wer den HELDEN angreift - ein Ganove, der sich
           einen Passanten vornimmt, steht nicht unter der Kampfleitung. */
        if ((g.attack || g.warnT > 0) && g.target === 'player') {
          gl++;
          if (r !== 'werfer') glNah++;
          if (!g._lief) {
            angriffe[r] = (angriffe[r] || 0) + 1;
            const rel = wd(Math.atan2(g.pos.x - P.pos.x, g.pos.z - P.pos.z), vorn);
            if (rel > 2.0) hinten[r] = (hinten[r] || 0) + 1;
          }
          g._lief = true;
        } else g._lief = false;
        /* Der Platz am Ring zaehlt nur fuer wer im Kampf ist (bis 8 m). */
        if (f % 15 === 0 && g.state === 'chase' &&
            Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z) < 8) {
          winkel[r].push(wd(Math.atan2(g.pos.x - P.pos.x, g.pos.z - P.pos.z), vorn));
          abst[r].push(Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z));
        }
      }
      gleichzeitigMax = Math.max(gleichzeitigMax, gl);
      nahGleichzeitigMax = Math.max(nahGleichzeitigMax, glNah);
      bilder++;
      if (glNah >= 3) {
        bilderDrei++;
        /* Wer steht dann ohne Angriffsrecht im Angriff? Pariert, Kombo-Fortsetzung oder Finte? */
        for (let i = 0; i < G.length; i++) {
          const g = G[i];
          if (g.dead || rollen[i] === 'werfer' || !(g.attack || g.warnT > 0) || g.target !== 'player') continue;
          if (!d.mega.hatRecht(g)) {
            const q = g.finte ? 'finte' : (g.komboRest > 0 ? 'kombo' : (g.paradeT > 0 || g.paradeFehlT > 0 ? 'parade' : 'sonst'));
            quelleDrei[q] = (quelleDrei[q] || 0) + 1;
            if (dreiDetails.length < 6) dreiDetails.push({ f, art: rollen[i], q, at: g.attack ? +g.attack.t.toFixed(2) : null,
              warn: +(g.warnT || 0).toFixed(2), kombo: g.komboRest || 0, mut: +(g.mut || 0).toFixed(2), flieht: !!g.flieht,
              rz: +(g.rueckzugT || 0).toFixed(2), bet: +(g.betaeubtT || 0).toFixed(2), web: +(g.webT || 0).toFixed(2),
              st: +(g.staggerT || 0).toFixed(2), state: g.state });
          }
        }
      }
    }
    for (const g of G) { g.dead = true; g.deadT = 0.01; }
    }
    const med = (a) => { if (!a.length) return null; const s = a.slice().sort((p, q) => p - q); return +s[Math.floor(s.length / 2)].toFixed(2); };
    const anteil = (a, f) => a.length ? +(a.filter(f).length / a.length).toFixed(2) : null;
    const aus = { runden, msJeSchritt: +(ms / (sekunden * 60 * runden)).toFixed(3), gleichzeitigMax, nahGleichzeitigMax, anteilDreiNah: +(bilderDrei / Math.max(1, bilder)).toFixed(4),
                  ohneRechtBeiDrei: quelleDrei, dreiDetails, angriffe, hintenAngriffe: hinten, kampf: d.mega.kampf() };
    for (const r of rollen) aus[r] = { winkelMedian: med(winkel[r]), abstandMedian: med(abst[r]),
      anteilHinten: anteil(winkel[r], (w) => w > 2.0), anteilVorn: anteil(winkel[r], (w) => w < 0.8), proben: winkel[r].length };
    return aus;
  };
};

(async () => {
  const ergebnis = {};
  let fehler = 0;
  const teile = TEIL === 'alle' ? ['wand', 'ohnewand', 'luft', 'rollen'] : TEIL.split(',');
  const { b, page } = await starte(800, 480, 4711, { frierSofort: true });
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e)));
  await page.evaluate(seitenCode);
  if (SKILL) await page.evaluate((ids) => { __dbg.punkteGeben(ids.length); for (const id of ids) __dbg.skillKaufen(id); }, SKILL.split(','));
  for (const t of teile) {
    if (t === 'wand') {
      const r = await page.evaluate(() => window.__mk.wand(6));
      ergebnis.wand = r;
      const ok = r.filter((x) => x.finisher === 1 && x.anWand).length;
      console.log(`wand: ${ok}/${r.length} an die Wand geheftet`);
      for (const x of r) console.log('   ' + JSON.stringify(x));
      if (ok < r.length || r.length < 4) fehler++;
    } else if (t === 'ohnewand') {
      const r = await page.evaluate(() => window.__mk.ohnewand());
      ergebnis.ohnewand = r;
      const ok = r.gestartet === 0 && r.ohneWand >= 1 && r.webStufe >= 1 && !r.anWand;
      console.log('ohnewand: ' + (ok ? 'ok (Rueckfall Netzschuss)' : 'FEHL') + '  ' + JSON.stringify(r));
      if (!ok) fehler++;
    } else if (t === 'luft') {
      const r = await page.evaluate(() => window.__mk.luft());
      ergebnis.luft = r;
      const ok = r.finisher === 1 && r.welle >= 1 && r.zweiterGetroffen;
      console.log('luft: ' + (ok ? 'ok' : 'FEHL') + '  ' + JSON.stringify(r));
      if (!ok) fehler++;
    } else if (t === 'rollen') {
      /* Jeder Kampf in einem frischen Browser - mit und ohne Rollentaktik,
         auf zwei Keimen. Im selben Browser nach den anderen Teilen ist der
         Kampf nicht vergleichbar (Moral, Druck, Kombo laufen nach). */
      ergebnis.rollen = {};
      let okAlle = true;
      for (const keim of [4711, 2024]) {
        const lauf = async (alt) => {
          const z = await starte(800, 480, keim, { frierSofort: true, kampfAlt: alt });
          await z.page.evaluate(seitenCode);
          const r = await z.page.evaluate(() => window.__mk.rollen(30, 4));
          await z.b.close();
          return r;
        };
        const r = await lauf(false), r2 = await lauf(true);
        ergebnis.rollen[keim] = { mit: r, ohne: r2 };
        /* Bedingung: der Flinke steht im Kampf ueberwiegend hinter dem
           Helden, der Waechter ueberwiegend vor ihm; hoechstens 0,5 Prozent
           der Bilder mit drei Nahkaempfern im Angriff (einzelne
           Uebergangsbilder zaehlen mit; der Werfer hat kein Nahkampfrecht). */
        const ok = r.flink.anteilHinten >= 0.6 && r.waechter.anteilVorn >= 0.45 && r.anteilDreiNah <= 0.005;
        if (!ok) okAlle = false;
        console.log(`rollen keim ${keim}: ` + (ok ? 'ok' : 'FEHL') + '  Flinker hinten ' + r.flink.anteilHinten +
                    ' (ohne ' + r2.flink.anteilHinten + '), Waechter vorn ' + r.waechter.anteilVorn + ' (ohne ' +
                    r2.waechter.anteilVorn + '), Bilder mit drei Nahkaempfern ' + r.anteilDreiNah + ' (ohne ' +
                    r2.anteilDreiNah + '), Flinker greift an ' + (r.angriffe.flink || 0) + ' davon von hinten ' +
                    (r.hintenAngriffe.flink || 0) + ' (ohne ' + (r2.angriffe.flink || 0) + '/' + (r2.hintenAngriffe.flink || 0) +
                    '), ms/Schritt ' + r.msJeSchritt + ' (ohne ' + r2.msJeSchritt + ')');
      }
      if (!okAlle) fehler++;
    }
  }
  console.log('Seitenfehler: ' + seitenFehler.length + (seitenFehler.length ? ' ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(ergebnis, null, 1));
  await b.close();
  process.exit(fehler || seitenFehler.length ? 1 : 0);
})();
