/* Mega-Update 1.0, M6: Integrationsfaelle und kombinierte Belastung.
   =========================================================================
   Die Module einzeln zu pruefen reicht nicht - hier kommen sie zusammen.
   Jeder Teil laeuft in einem eigenen, frischen Browser.

     b1  Beispiel 1: durch die Stadt schwingen (echter Schwung mit der
         Leertaste), einen Ladenueberfall entdecken, kaempfen, ein Taeter
         flieht, die Polizei uebernimmt. Erwartet: keine doppelten Gegner,
         kein verlorener Leuchtturm, genau eine richtige Belohnung, die
         Polizei faehrt ab, die Strasse wird frei.
         (Ablauf: der Bot aus tools/pruef/mega-bot.js, Anreise abgekuerzt.)
     b2  Beispiel 2: mitten in einem Nebenauftrag einen Innenraum betreten.
         Erwartet: Auftrag bleibt aktiv, kein neues Weltereignis in der
         Innenphase, draussen wird nichts geloescht, Rueckkehrpunkt stimmt,
         Kontrollpunkte bleiben; danach laesst sich der Auftrag beenden.
     b3  Beispiel 3: Luft-Finisher dicht vor einer Hausfassade (drei
         Fassaden). Erwartet: der Gegner steckt nie in der Wand, der Held
         geraet nicht ins Klettern, die Kamera bleibt frei, danach normale
         Bewegung.
     b5  Beispiel 5: 30 Minuten Spiel (Spielzeit) mit Ton: Laufen, Kaempfe,
         Ereignisse, Innenraum-Besuche, Tag und Nacht. Erwartet: keine
         wachsende Zahl verwaister Gegner, keine endlosen Ereignisse, kein
         dauerhaft belegter Innenraum, keine wachsende Zahl klingender
         Quellen, keine endlosen Effekte, keine doppelten Belohnungen.
         Dazu CPU je Bild und Draw Calls unter dieser Last.
     (Beispiel 4, alter Spielstand: tools/pruef/mega-fortschritt.js, Teil altstand.)

   Aufruf:  node tools/pruef/mega-last.js [teil=b1,b2,b3,b5] [minuten=30] [keim=4711] [aus=datei.json]
   Exit 1, wenn eine Pruefung fehlschlaegt.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const { botCode: ereignisBot } = require('./mega-bot');
const { botCode: nebenBot } = require('./mega-neben-bot');
const { klangTaktCode } = require('./klang-takt');

const arg = (k, std) => {
  const a = process.argv.find((x) => x.startsWith(k + '='));
  return a ? a.slice(k.length + 1) : std;
};
const TEILE = arg('teil', 'b1,b2,b3,b5').split(',');
const MINUTEN = Number(arg('minuten', 30));
const KEIM = Number(arg('keim', 4711));
const AUS = arg('aus', null);

const pruef = [];
const ok = (name, bed, wert) => {
  pruef.push({ name, ok: !!bed, wert });
  console.log('PRUEF ' + (bed ? 'ok    ' : 'FEHLER') + '  ' + name + (wert === undefined ? '' : '  ' + JSON.stringify(wert)));
};
const ergebnis = { keim: KEIM };
const seitenFehler = [];

async function browser(opt) {
  const { b, page } = await starte(800, 480, KEIM, { frierSofort: true });
  page.on('pageerror', (e) => seitenFehler.push(String(e)));
  if (opt && opt.ton) {
    await page.addInitScript(klangTaktCode({ rate: 8000, kanaele: 1, sekunden: MINUTEN * 60 + 400 }));
    await page.reload();
    await page.waitForFunction(() => window.__dbg && window.__dbg.actorsReady, null, { timeout: 240000 });
  }
  await page.evaluate(() => {
    __dbg.frier(true);
    const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
    const h = document.getElementById('hud'); if (h) h.style.display = 'block';
  });
  return { b, page };
}

(async () => {
  /* ================= b1: Schwung -> Ladenueberfall -> Flucht -> Polizei ================= */
  if (TEILE.includes('b1')) {
    const { b, page } = await browser();
    await page.evaluate(ereignisBot);
    const r = await page.evaluate(() => {
      const d = __dbg, P = d.player, R = { spur: [] };
      /* echter Schwung: in 30 m Hoehe mit Tempo, Leertaste halten, loslassen */
      d.mega.blockiere(true);
      d.setzePos(25, 30, 25); P.state = 'air'; P.onGround = false; P.vel.set(14, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.2);
      let schwung = 0;
      for (let i = 0; i < 240; i++) {
        d.taste('Space', i > 2 && i < 150);
        d.schritt(1 / 60);
        if (P.state === 'swing') schwung++;
      }
      d.taste('Space', false);
      R.schwungBilder = schwung;
      /* der Ueberfall */
      const scoreVor = P.score;
      const st = window.__mb.start('laden');
      R.aufbau = st && st.aufbau;
      const evId = (d.mega.ereignisse()[0] || {}).id;
      R.evId = evId;
      const doppelt = new Set();
      let beaconFehlt = 0, beaconBilder = 0, maxGegner = 0, ende = null, belohnt = 0;
      let flucht = false, polizei = new Set();
      const popups = [];
      const beob = new MutationObserver((m) => { for (const x of m) for (const n of x.addedNodes) if (n.className === 'popup') popups.push(n.textContent); });
      beob.observe(document.getElementById('hud'), { childList: true });
      for (let i = 0; i < 60 * 300; i++) {
        const z = window.__mb.takt(1);
        const ev = d.mega.ereignisse().find((x) => x.id === evId);
        /* keine doppelten Gegner: jedes Objekt nur einmal, keine zwei
           lebenden Taeter auf demselben Fleck */
        const set = new Set(d.enemies);
        if (set.size !== d.enemies.length) doppelt.add('objekt');
        if (ev) {
          const lebend = ev.gegner.filter((g) => !g.tot);
          maxGegner = Math.max(maxGegner, lebend.length);
          for (let a = 0; a < lebend.length; a++) for (let c = a + 1; c < lebend.length; c++) {
            if (Math.hypot(lebend[a].x - lebend[c].x, lebend[a].z - lebend[c].z) < 0.05) doppelt.add('fleck');
          }
          if (ev.gegner.some((g) => g.flieht)) flucht = true;
          /* Leuchtturm: entdeckt und laufend -> sichtbar */
          if (ev.entdeckt && (ev.zustand === 'AKTIV' || ev.zustand === 'ESKALIERT')) {
            beaconBilder++;
            if (!d.beaconStand().sichtbar) beaconFehlt++;
          }
          if (ende === null && (ev.zustand === 'GELOEST' || ev.zustand === 'GESCHEITERT')) ende = { bild: i, zustand: ev.zustand };
        }
        for (const x of d.mega.resp().liste) if (x.ev === evId && x.art === 'polizei') polizei.add(x.id);
        if (z.phase === 'fertig') break;
      }
      for (const x of beob.takeRecords()) for (const n of x.addedNodes) if (n.className === 'popup') popups.push(n.textContent);
      R.ende = ende; R.maxGegner = maxGegner; R.doppelt = [...doppelt]; R.flucht = flucht;
      R.beacon = { bilder: beaconBilder, fehlt: beaconFehlt };
      R.belohnungsHinweise = popups.filter((t) => /\+\d+ Punkte/.test(t));
      R.popups = popups.slice(-12);
      R.polizeiIds = [...polizei];
      /* nach dem Ende: die Polizei faehrt ab, Strasse frei (bis 240 s) */
      let respWeg = null;
      for (let i = 0; i < 60 * 240; i++) {
        d.mega.blockiere(true);
        if (P.hp < 60) P.hp = 100;
        d.schritt(1 / 60);
        const offen = d.mega.resp().liste.filter((x) => x.ev === evId);
        if (!offen.length) { respWeg = i; break; }
      }
      R.respWegNachS = respWeg === null ? null : +(respWeg / 60).toFixed(1);
      R.respRest = d.mega.resp().liste.filter((x) => x.ev === evId);
      R.ergebnis = window.__mb.ergebnis();
      /* Strasse frei: im Umkreis von 30 m keine Rolle, kein Einsatzwagen,
         der Verkehr rollt (mindestens ein Wagen faehrt) */
      const o = R.aufbau ? R.aufbau.ort : null;
      if (o) {
        /* noch 20 s: abfahrende Einsatzwagen verschwinden ausser Sicht */
        for (let i = 0; i < 60 * 20; i++) { d.mega.blockiere(true); d.schritt(1 / 60); }
        const nahe = d.cars.filter((c) => !c.aus && Math.hypot(c.mesh.position.x - o.x, c.mesh.position.z - o.z) < 60);
        const rolle = (c) => c.eventId === evId || c.flucht || (c.notfall && !c.notfallWeg && c.notfallEinsatz && c.notfallEinsatz.evId === evId) || c.leer;
        R.strasse = { wagen: nahe.length, rollen: nahe.filter(rolle).length,
                      rollenArt: nahe.filter(rolle).map((c) => ({ ev: c.eventId, flucht: !!c.flucht, notfall: !!c.notfall, weg: c.notfallWeg || 0, leer: !!c.leer })),
                      fahren: nahe.filter((c) => (c.tempoJetzt || 0) > 0.5).length };
      }
      R.leck = { ev: d.evLeck(), resp: d.respLeck() };
      R.scoreDelta = P.score - scoreVor;
      return R;
    });
    ergebnis.b1 = r;
    console.log('B1', JSON.stringify({ schwung: r.schwungBilder, aufbau: r.aufbau, ende: r.ende, flucht: r.flucht, beacon: r.beacon,
      belohnung: r.belohnungsHinweise, polizei: r.polizeiIds, respWeg: r.respWegNachS, strasse: r.strasse, leck: r.leck,
      hart: r.ergebnis && r.ergebnis.hart, ausgang: r.ergebnis && r.ergebnis.ausgang }));
    ok('b1: echter Netzschwung vor dem Einsatz', r.schwungBilder > 30, r.schwungBilder);
    ok('b1: Ladenueberfall geloest, ein Taeter ist geflohen', r.ende && r.ende.zustand === 'GELOEST' && r.flucht, { ende: r.ende, flucht: r.flucht });
    ok('b1: keine doppelten Gegner', r.doppelt.length === 0 && r.maxGegner <= (r.aufbau ? r.aufbau.gegner : 9), { doppelt: r.doppelt, max: r.maxGegner });
    ok('b1: kein verlorener Leuchtturm (entdeckt und laufend -> sichtbar)', r.beacon.bilder > 60 && r.beacon.fehlt === 0, r.beacon);
    ok('b1: genau eine Belohnung, im Hinweis genannt', r.belohnungsHinweise.length === 1 && /\+\d+ Punkte/.test(r.belohnungsHinweise[0]),
       r.belohnungsHinweise);
    ok('b1: die Polizei kam und ist wieder abgefahren', r.polizeiIds.length >= 1 && r.respWegNachS !== null, { polizei: r.polizeiIds, wegNachS: r.respWegNachS, rest: r.respRest });
    ok('b1: Strasse frei (keine Rollen, keine Einsatzwagen, Verkehr rollt), keine Lecks',
       r.strasse && r.strasse.rollen === 0 && r.strasse.fahren > 0 && r.leck.ev === 0, { strasse: r.strasse, leck: r.leck });
    ok('b1: keine harten Fehler im Ablauf (Bot aus M1)', r.ergebnis && Object.values(r.ergebnis.hart || {}).every((v) => !v), r.ergebnis && r.ergebnis.hart);
    await b.close();
  }

  /* ================= b2: Nebenauftrag -> Innenraum -> zurueck -> Abschluss ================= */
  if (TEILE.includes('b2')) {
    const { b, page } = await browser();
    await page.evaluate(nebenBot);
    const r = await page.evaluate(() => {
      const d = __dbg, P = d.player, N = d.neben, B = window.__nb, R = {};
      d.mega.blockiere(false);
      /* Auftrag am Empfang annehmen (echter Weg) und bis zu den Spuren spielen */
      R.empfang = B.empfang();
      B.spiele({ max: 240, stopBei: (info) => info.phase >= 1 });
      for (let i = 0; i < 60 * 35; i++) B.schritt(1);       // Kontrollpunkt (Takt 30 s) sicher geschrieben
      const vor = {
        aktiv: d.storyStand().aktiv, phase: d.storyStand().phase,
        neben: JSON.parse(JSON.stringify(d.prog.neben)), story: JSON.parse(JSON.stringify(d.prog.story)),
        roh: JSON.parse(d.progRoh() || '{}').neben,
        gegner: d.enemies.filter((e) => !e.dead).map((e) => [+e.pos.x.toFixed(2), +e.pos.z.toFixed(2)]),
        wagen: d.cars.length, zivis: d.civilians.length, ev: d.mega.ereignisse().map((e) => e.id).join(),
        marken: N.marken(),
      };
      R.vor = vor;
      /* zur Tuer des Eckmarkts (Anreise abgekuerzt), C */
      const T = d.mega.orteTueren().laden;
      P.pos.set(T.ex + T.nx * 0.6, d.groundYAt(T.ex + T.nx * 0.6, T.ez + T.nz * 0.6, 2), T.ez + T.nz * 0.6);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true; P.facing = Math.atan2(-T.nx, -T.nz);
      for (let i = 0; i < 10; i++) B.schritt(1);
      R.hinweisTuer = d.mega.prompt();
      d.mega.interagieren();
      for (let i = 0; i < 120 && !(d.innen.active && !d.innen.phase); i++) B.schritt(1);
      R.drin = d.innen.active && d.innen.id === 'laden';
      /* Momentaufnahme direkt nach dem Eintreten - bis hierher lief draussen
         alles normal weiter (der Weg zur Tuer) */
      R.beimEintritt = { gegner: d.enemies.filter((e) => !e.dead).map((e) => [+e.pos.x.toFixed(2), +e.pos.z.toFixed(2)]),
                         wagen: d.cars.map((c) => [+c.mesh.position.x.toFixed(2), +c.mesh.position.z.toFixed(2)]),
                         zivis: d.civilians.length };
      /* 30 s drinnen - die Welt darf weiterlaufen wollen */
      d.mega.blockiere(false); d.evRuheAus();
      for (let i = 0; i < 60 * 30; i++) { d.schritt(1 / 60); if (P.hp < 60) P.hp = 100; }
      R.drinnen = {
        aktiv: d.storyStand().aktiv, phase: d.storyStand().phase, ziel: document.getElementById('objective').textContent,
        ev: d.mega.ereignisse().map((e) => e.id).join(), gegner: d.enemies.filter((e) => !e.dead).map((e) => [+e.pos.x.toFixed(2), +e.pos.z.toFixed(2)]),
        wagenPos: d.cars.map((c) => [+c.mesh.position.x.toFixed(2), +c.mesh.position.z.toFixed(2)]),
        wagen: d.cars.length, zivis: d.civilians.length, neben: JSON.parse(JSON.stringify(d.prog.neben)),
      };
      /* hinaus: zum Ausgang laufen, C */
      const a = d.innen.raum.ausgang;
      for (let i = 0; i < 900 && !B.hin(a.x, a.z, false, 0.8); i++) B.schritt(1);
      B.stopp(); B.schritt(8);
      d.mega.interagieren();
      for (let i = 0; i < 120 && (d.innen.active || d.innen.phase); i++) B.schritt(1);
      B.schritt(4);
      R.draussen = { aktiv: d.storyStand().aktiv, phase: d.storyStand().phase,
                     abstandTuer: +Math.hypot(P.pos.x - (T.ex + T.nx * 1.0), P.pos.z - (T.ez + T.nz * 1.0)).toFixed(2),
                     innen: d.innen.active, story: JSON.parse(JSON.stringify(d.prog.story)) };
      /* den Auftrag zu Ende spielen */
      R.rest = B.spiele({ max: 420 });
      R.fertig = d.prog.neben.fertig.slice();
      return R;
    });
    ergebnis.b2 = r;
    console.log('B2', JSON.stringify({ empfang: r.empfang && r.empfang.nachher, vor: { aktiv: r.vor.aktiv, phase: r.vor.phase, neben: r.vor.neben, gegner: r.vor.gegner.length },
      hinweis: r.hinweisTuer, drin: r.drin, drinnen: { aktiv: r.drinnen.aktiv, phase: r.drinnen.phase, ziel: r.drinnen.ziel, ev: r.drinnen.ev },
      draussen: r.draussen, rest: r.rest && r.rest.ausgang, fertig: r.fertig }));
    ok('b2: Nebenauftrag laeuft (Schatten I, ab Phase 2), Kontrollpunkt geschrieben',
       r.vor.aktiv === 's1' && r.vor.phase >= 1 && r.vor.roh && r.vor.roh.checkpointId === 's1', { vor: r.vor.aktiv, phase: r.vor.phase, roh: r.vor.roh });
    ok('b2: die Tuer bietet waehrend des Nebenauftrags den Eintritt an, der Held ist drin',
       /betreten/.test(r.hinweisTuer || '') && r.drin, { hinweis: r.hinweisTuer, drin: r.drin });
    ok('b2: drinnen bleibt der Auftrag aktiv in derselben Phase, Zieltext sagt "ruht"',
       r.drinnen.aktiv === 's1' && r.drinnen.phase === r.vor.phase && /ruht/.test(r.drinnen.ziel), r.drinnen);
    ok('b2: kein neues Weltereignis in der Innenphase (30 s, Regisseur frei)', r.drinnen.ev === r.vor.ev, { vor: r.vor.ev, drinnen: r.drinnen.ev });
    ok('b2: draussen nichts geloescht oder verschoben, solange der Held drinnen ist (Gegner, Wagen, Passanten - 30 s)',
       JSON.stringify(r.drinnen.gegner) === JSON.stringify(r.beimEintritt.gegner) &&
       JSON.stringify(r.drinnen.wagenPos) === JSON.stringify(r.beimEintritt.wagen) && r.drinnen.zivis === r.beimEintritt.zivis,
       { gegner: [r.beimEintritt.gegner.length, r.drinnen.gegner.length], wagen: [r.beimEintritt.wagen.length, r.drinnen.wagenPos.length],
         zivis: [r.beimEintritt.zivis, r.drinnen.zivis] });
    ok('b2: Kontrollpunkte unveraendert (Nebenreihe und Akt 1)',
       JSON.stringify(r.drinnen.neben) === JSON.stringify(r.vor.neben) && JSON.stringify(r.draussen.story) === JSON.stringify(r.vor.story),
       { neben: [r.vor.neben, r.drinnen.neben] });
    ok('b2: Rueckkehr an der Tuer, Auftrag laeuft weiter', !r.draussen.innen && r.draussen.abstandTuer < 3 && r.draussen.aktiv === 's1',
       r.draussen);
    ok('b2: der Auftrag laesst sich danach regulaer beenden', r.rest && r.rest.ausgang === 'beendet' && r.fertig.includes('s1'),
       { ausgang: r.rest && r.rest.ausgang, fertig: r.fertig });
    await b.close();
  }

  /* ================= b3: Luft-Finisher vor einer Fassade ================= */
  if (TEILE.includes('b3')) {
    const { b, page } = await browser();
    const r = await page.evaluate(() => {
      const d = __dbg, P = d.player, aus = [];
      const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
      const tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
      const schritt = (n, f) => { for (let i = 0; i < n; i++) { d.mega.blockiere(true); if (P.hp < 60) P.hp = 100; d.schritt(1 / 60); if (f) f(i); } };
      const bereit = () => { for (let i = 0; i < 90 && P.attackCd > 0.05; i++) schritt(1); };
      d.evAlleBeenden(); d.mega.blockiere(true);
      if (d.stufe < 3) d.addScore(60000);
      const L = d.mega.ladenListe();
      let n = 0;
      for (const l of L) {
        if (n >= 3) break;
        /* Gegner 2,2 m vor der Fassade, Held 1,6 m dahinter (zur Strasse) */
        const ex = l.tx + l.nx * 2.2, ez = l.tz + l.nz * 2.2;
        const px = l.tx + l.nx * 3.8, pz = l.tz + l.nz * 3.8;
        const oe = d.mega.ort(ex, ez), op = d.mega.ort(px, pz);
        if (oe.haus || op.haus || Math.abs(oe.y - op.y) > 0.2 || oe.oben > oe.y + 0.3 || op.oben > op.y + 0.3) continue;
        for (const g of d.enemies) if (!g.dead) { g.dead = true; g.deadT = 0.01; g.liegt = true; }
        schritt(20);
        P.pos.set(px, d.groundYAt(px, pz, 2), pz); P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.facing = Math.atan2(ex - px, ez - pz);
        d.kamStart(Math.atan2(-(ex - px), -(ez - pz)), 0.2); tasten([]);
        /* Die Kamera nach dem Versetzen nachziehen lassen (nur die Kamera,
           die Welt steht) - sonst misst das erste Bild den alten Ort. */
        for (let i = 0; i < 40; i++) d.kamSchritt(1 / 60);
        const g = d.spawnGang(ex, ez, 1, 'event').enemies[0];
        g.pos.set(ex, d.groundYAt(ex, ez, 2), ez);
        const typ = d.mega.ganoven().find((t) => t.art === 'schlaeger'); if (typ) g.typ = typ;
        g.hp = g.hpMax = 400; g.state = 'chase'; g.target = 'player'; g.anfuehrer = false;
        g.blockT = 0; g.blockCd = 99; g.paradeCd = 99; g.ausweichCd = 99;
        const k0 = d.mega.kampf().luftFinish;
        let inWand = 0, klettern = 0, kamDrin = 0, kamWeit = 0, kamMax = 0;
        const beob = () => {
          if (d.mega.ort(g.pos.x, g.pos.z).haus && g.pos.y < d.mega.ort(g.pos.x, g.pos.z).oben - 0.3) inWand++;
          if (P.state === 'climb' || P.state === 'wall') klettern++;
          const k = d.kamera();
          if (k.steckt) kamDrin++;
          kamMax = Math.max(kamMax, k.abstand);
          if (k.abstand > 18) kamWeit++;
        };
        bereit(); d.uppercut(); schritt(12, beob);
        d.tryJump(); schritt(14, beob);
        bereit(); d.tryAttack('punch'); schritt(6, beob);
        bereit();
        d.tryAttack('kick');
        schritt(150, beob);
        const fin = d.mega.kampf().luftFinish - k0;
        /* danach: 1 s W zur Strasse hin - der Held bewegt sich normal */
        const p0 = { x: P.pos.x, z: P.pos.z };
        d.kamStart(Math.atan2(-l.nx, -l.nz), 0.2);
        tasten(['KeyW']);
        schritt(60, beob);
        tasten([]);
        const weg = Math.hypot(P.pos.x - p0.x, P.pos.z - p0.z);
        aus.push({ laden: l.nr, finisher: fin, inWand, klettern, kamDrin, kamWeit, kamMax: +kamMax.toFixed(2), weg: +weg.toFixed(2),
                   gegnerAbstandWand: +((g.pos.x - l.tx) * l.nx + (g.pos.z - l.tz) * l.nz).toFixed(2), zustand: P.state });
        g.dead = true; g.deadT = 0.01;
        n++;
      }
      return aus;
    });
    ergebnis.b3 = r;
    console.log('B3', JSON.stringify(r));
    ok('b3: drei Fassaden geprueft, der Luft-Finisher loest jedes Mal aus', r.length === 3 && r.every((x) => x.finisher === 1), r.map((x) => x.finisher));
    ok('b3: der Gegner steckt nie in der Wand', r.every((x) => x.inWand === 0 && x.gegnerAbstandWand > 0.2), r.map((x) => [x.inWand, x.gegnerAbstandWand]));
    ok('b3: der Held geraet nicht ins Klettern', r.every((x) => x.klettern === 0), r.map((x) => x.klettern));
    ok('b3: die Kamera bleibt frei (nie im Haus, nie weiter als 18 m vom Helden)', r.every((x) => x.kamDrin === 0 && x.kamWeit === 0),
       r.map((x) => [x.kamDrin, x.kamMax]));
    ok('b3: danach normale Bewegung (1 s W: mindestens 2 m)', r.every((x) => x.weg >= 2), r.map((x) => x.weg));
    await b.close();
  }

  /* ================= b5: 30 Minuten mit Ton ================= */
  if (TEILE.includes('b5')) {
    const { b, page } = await browser({ ton: true });
    await page.evaluate(() => { const o = document.getElementById('overlay'); o.style.display = 'flex'; });
    await page.click('#clickmsg');
    await page.evaluate(() => { __dbg.frier(true); document.getElementById('overlay').style.display = 'none';
                                document.getElementById('hud').style.display = 'block'; });
    await page.evaluate(() => {
      const d = __dbg, P = d.player, K = window.__kt;
      const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
      const tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
      const L = window.__lauf = { ton: 0, bild: 0, proben: [], ms: [], calls: [], besuche: [], popups: [], fehlerInnen: 0,
                                  verlaufGeloest: new Set(), zi: 0, blockiert: 0 };
      L.beob = new MutationObserver((m) => { for (const x of m) for (const n of x.addedNodes) if (n.className === 'popup') L.popups.push(n.textContent); });
      L.beob.observe(document.getElementById('hud'), { childList: true });
      L.ziele = [[25, 25], [-120, 80], [-200, -150], [60, -180], [130, 40], [-60, 150], [-260, 20]];
      L.stat0 = Object.assign({}, d.prog.statistik);
      L.geo0 = d.renderInfo();
      L.blick = (x, z) => { const dx = x - P.pos.x, dz = z - P.pos.z; d.kamStart(Math.atan2(-dx, -dz), 0.2); };
      /* ein Bild Spiel mit dem einfachen Bot: kaempfen, wenn jemand den
         Helden angreift; zu einem nahen, entdeckten Ereignis laufen;
         sonst zwischen den Wegpunkten laufen */
      L.eingabe = () => {
        let feind = null, fd = 1e9;
        for (const e of d.enemies) {
          if (e.dead || e.target !== 'player') continue;
          const dd = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
          if (dd < fd) { fd = dd; feind = e; }
        }
        if (feind && fd < 14) {
          L.blick(feind.pos.x, feind.pos.z); P.facing = Math.atan2(feind.pos.x - P.pos.x, feind.pos.z - P.pos.z);
          if (fd > 1.7) tasten(['KeyW']); else { tasten([]); if (L.bild % 13 === 0) d.tryAttack('punch'); }
          return;
        }
        const ev = d.mega.ereignisse().find((e) => e.entdeckt && (e.zustand === 'AKTIV' || e.zustand === 'ESKALIERT'));
        let z = null;
        if (ev) {
          const g = ev.gegner.find((x) => !x.tot);
          z = g ? [g.x, g.z] : [ev.ort.x, ev.ort.z];
          if (Math.hypot(z[0] - P.pos.x, z[1] - P.pos.z) > 70) z = null;
        }
        if (!z) {
          z = L.ziele[L.zi % L.ziele.length];
          if (Math.hypot(z[0] - P.pos.x, z[1] - P.pos.z) < 8) { L.zi++; z = L.ziele[L.zi % L.ziele.length]; }
        }
        if (L.bild % 2 === 0) L.blick(z[0], z[1]);
        tasten(['KeyW', 'ShiftLeft']);
        if (P.state === 'climb' && L.bild % 40 === 0) d.tryJump();
      };
      L.schritt = async (n) => {
        for (let i = 0; i < n; i++) {
          L.eingabe();
          if (P.hp < 60) P.hp = 100;
          if (P.dead) { P.dead = false; P.hp = 100; }
          const t0 = performance.now();
          d.schritt(1 / 60);
          L.ms.push(performance.now() - t0);
          L.bild++; L.ton += 1 / 60;
          if (L.bild % 4 === 0) await K.bis(L.ton);
        }
      };
      /* Innenraum-Besuch: zur Tuer, C, 15 s drinnen, zum Ausgang, C */
      L.besuch = async (id) => {
        const T = d.mega.orteTueren()[id];
        const r = { id, t: Math.round(L.ton) };
        if (!T) { r.fehler = 'keine Tuer'; L.besuche.push(r); return; }
        P.pos.set(T.ex + T.nx * 0.6, d.groundYAt(T.ex + T.nx * 0.6, T.ez + T.nz * 0.6, 2), T.ez + T.nz * 0.6);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true; P.facing = Math.atan2(-T.nx, -T.nz);
        for (const e of d.enemies) if (!e.dead && e.target === 'player') { e.target = null; e.state = 'patrol'; }
        tasten([]);
        for (let i = 0; i < 10; i++) { d.schritt(1 / 60); L.ton += 1 / 60; L.bild++; }
        await K.bis(L.ton);
        d.mega.interagieren();
        for (let i = 0; i < 120 && !(d.innen.active && !d.innen.phase); i++) { d.schritt(1 / 60); L.ton += 1 / 60; L.bild++; if (i % 4 === 0) await K.bis(L.ton); }
        r.drin = d.innen.active;
        for (let i = 0; i < 60 * 15; i++) { tasten([]); d.schritt(1 / 60); L.ton += 1 / 60; L.bild++; if (i % 4 === 0) await K.bis(L.ton); }
        const a = d.innen.raum && d.innen.raum.ausgang;
        if (a) {
          for (let i = 0; i < 900; i++) {
            const dist = Math.hypot(a.x - P.pos.x, a.z - P.pos.z);
            if (dist < 0.8) break;
            L.blick(a.x, a.z); tasten(['KeyW']);
            d.schritt(1 / 60); L.ton += 1 / 60; L.bild++; if (i % 4 === 0) await K.bis(L.ton);
          }
          tasten([]);
          for (let i = 0; i < 8; i++) { d.schritt(1 / 60); L.ton += 1 / 60; L.bild++; }
          d.mega.interagieren();
          for (let i = 0; i < 120 && (d.innen.active || d.innen.phase); i++) { d.schritt(1 / 60); L.ton += 1 / 60; L.bild++; if (i % 4 === 0) await K.bis(L.ton); }
        }
        r.draussen = !d.innen.active;
        if (d.innen.active) { L.fehlerInnen++; d.innenSofortRaus(); }
        L.besuche.push(r);
      };
      L.probe = () => {
        const k = d.klangStand();
        const evs = d.mega.ereignisse();
        const lebend = d.enemies.filter((e) => !e.dead);
        /* verwaist: lebt, gehoert zu keiner Gruppe, keinem Ereignis, keinem
           Auftrag, ist kein Boss und nicht in Gewahrsam */
        const ohneHerkunft = lebend.filter((e) => !e.eventId && !e.storyGegner && !e.boss && !e.policeCustody && !e.gang).length;
        const gewahrsam = lebend.filter((e) => e.policeCustody).length;
        const ri = d.renderInfo();
        L.proben.push({
          t: Math.round(L.ton), gegner: lebend.length, ohneHerkunft, gewahrsam, alle: d.enemies.length,
          ev: evs.length, evAeltestes: evs.length ? Math.max(...evs.map((e) => e.leben)) : 0,
          evUeberZeit: evs.filter((e) => e.maxLeben && e.leben > e.maxLeben + 90).length,
          innen: d.innen.active, quellen: K.gestartet - K.beendet, sfx: k.sfx.laufend, ausgelassen: k.sfx.ausgelassen,
          geometrien: ri.geometrien, texturen: ri.texturen, sichtbar: d.szeneSichtbar(), objekte: d.szeneObjekte(),
          popupsDom: document.querySelectorAll('.popup').length, resp: d.mega.resp().liste.length,
          tag: +d.tag.zeit.toFixed(2), regen: +d.regenStaerke().toFixed(2),
          heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
        });
        for (const v of d.evVerlauf()) if (v.erfolg) L.verlaufGeloest.add(v.id + ':' + v.art);
      };
    });
    const minuten = MINUTEN;
    const t0 = Date.now();
    for (let m = 0; m < minuten; m++) {
      await page.evaluate(async (m) => {
        const d = __dbg, L = window.__lauf;
        if (m % 5 === 2) await L.besuch(m % 10 === 2 ? 'laden' : 'buero');
        d.mega.blockiere(false);
        if (m % 2 === 0) d.evRuheAus();
        /* eine Minute Spiel in vier Teilen; alle 3 min ein Bild fuer Draw Calls */
        for (let q = 0; q < 4; q++) await L.schritt(900);
        if (m % 3 === 1) { d.zeichne(); L.calls.push(d.renderInfo().calls); }
        L.probe();
      }, m);
      if (m % 5 === 4) console.log('   Minute ' + (m + 1) + ' von ' + minuten + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
    }
    const r = await page.evaluate(async () => {
      const d = __dbg, L = window.__lauf, K = window.__kt;
      /* Ruhe: keine Ereignisse mehr, 20 s stehen */
      d.evAlleBeenden(); d.mega.blockiere(true);
      for (const k of ['KeyW', 'ShiftLeft']) d.taste(k, false);
      for (let i = 0; i < 60 * 20; i++) { d.schritt(1 / 60); L.ton += 1 / 60; if (i % 4 === 0) await K.bis(L.ton); }
      await K.bis(L.ton);
      L.probe();
      for (const x of L.beob.takeRecords()) for (const n of x.addedNodes) if (n.className === 'popup') L.popups.push(n.textContent);
      const s1 = d.prog.statistik, s0 = L.stat0;
      const neu = ['evUeberfall', 'evGang', 'evUnfall', 'evLaden', 'evAutodieb', 'evDach'];
      const zaehlerDelta = neu.reduce((a, k) => a + (s1[k] - s0[k]), 0);
      const verlauf = d.evVerlauf();
      const ms = L.ms.slice().sort((a, b) => a - b);
      return {
        proben: L.proben, besuche: L.besuche, fehlerInnen: L.fehlerInnen, calls: L.calls,
        cpu: { median: +ms[Math.floor(ms.length / 2)].toFixed(3), p90: +ms[Math.floor(ms.length * 0.9)].toFixed(3),
               p99: +ms[Math.floor(ms.length * 0.99)].toFixed(3), bilder: ms.length },
        geloestIds: [...L.verlaufGeloest], verlaufLaenge: verlauf.length,
        geloestNichtEnforcer: [...L.verlaufGeloest].filter((x) => !/:enforcer$/.test(x)).length,
        zaehlerDelta, belohnungsHinweise: L.popups.filter((t) => /\+\d+ Punkte/.test(t)).length,
        geloestEntdeckt: verlauf.filter((v) => v.erfolg && v.entdeckt).length,
        evStatistik: d.evStatistik(), leck: { ev: d.evLeck(), resp: d.respLeck(), akt: d.aktLeck() },
        maxQuellen: K.maxLaufend, klang: d.klangStand().sfx, geo0: L.geo0,
      };
    });
    ergebnis.b5 = r;
    console.log('B5', JSON.stringify({ cpu: r.cpu, calls: r.calls, besuche: r.besuche, maxQuellen: r.maxQuellen, klang: r.klang,
      geloest: r.geloestIds.length, zaehlerDelta: r.zaehlerDelta, hinweise: r.belohnungsHinweise, leck: r.leck,
      ev: r.evStatistik && { gestartet: r.evStatistik.gestartet, geloest: r.evStatistik.geloest, gescheitert: r.evStatistik.gescheitert } }));
    for (const p of r.proben) console.log('   ' + JSON.stringify(p));
    const P = r.proben, n = P.length;
    const drittel = Math.max(1, Math.floor(n / 3));
    const mittel = (a, k) => a.reduce((s, x) => s + x[k], 0) / Math.max(1, a.length);
    const anfang = P.slice(0, drittel), schluss = P.slice(n - drittel - 1, n - 1);
    ok('b5: ' + MINUTEN + ' Minuten Spielzeit gelaufen, Ereignisse geloest', n >= MINUTEN && r.geloestIds.length >= 3,
       { proben: n, geloest: r.geloestIds.length });
    ok('b5: keine wachsende Zahl von Gegnern ohne Herkunft (letztes Drittel nicht ueber dem ersten + 2)',
       mittel(schluss, 'ohneHerkunft') <= mittel(anfang, 'ohneHerkunft') + 2,
       { anfang: +mittel(anfang, 'ohneHerkunft').toFixed(1), schluss: +mittel(schluss, 'ohneHerkunft').toFixed(1) });
    ok('b5: keine Leichen, die nie entfernt werden (Gegnerliste insgesamt ohne Anstieg), Gewahrsam wird abgeholt',
       mittel(schluss, 'alle') <= mittel(anfang, 'alle') + 8 && mittel(schluss, 'gewahrsam') <= mittel(anfang, 'gewahrsam') + 2,
       { alle: [+mittel(anfang, 'alle').toFixed(1), +mittel(schluss, 'alle').toFixed(1)],
         gewahrsam: [+mittel(anfang, 'gewahrsam').toFixed(1), +mittel(schluss, 'gewahrsam').toFixed(1)] });
    ok('b5: lebende Gegner bleiben begrenzt (hoechstens 40, kein Anstieg ueber das erste Drittel + 6)',
       Math.max(...P.map((p) => p.gegner)) <= 40 && mittel(schluss, 'gegner') <= mittel(anfang, 'gegner') + 6,
       { max: Math.max(...P.map((p) => p.gegner)), anfang: +mittel(anfang, 'gegner').toFixed(1), schluss: +mittel(schluss, 'gegner').toFixed(1) });
    ok('b5: keine endlosen Ereignisse (keins laenger als seine Hoechstdauer + 90 s, hoechstens 3 zugleich)',
       P.every((p) => p.evUeberZeit === 0 && p.ev <= 3), P.map((p) => [p.ev, p.evAeltestes]));
    ok('b5: kein dauerhaft belegter Innenraum (jeder Besuch endet draussen)',
       r.besuche.length >= Math.floor(MINUTEN / 5) && r.besuche.every((x) => x.drin && x.draussen) && r.fehlerInnen === 0 && P.every((p) => !p.innen),
       r.besuche);
    ok('b5: keine wachsende Zahl klingender Quellen (letztes Drittel hoechstens 1,5-fach + 4, nie ueber 60)',
       mittel(schluss, 'quellen') <= mittel(anfang, 'quellen') * 1.5 + 4 && r.maxQuellen <= 60,
       { anfang: +mittel(anfang, 'quellen').toFixed(1), schluss: +mittel(schluss, 'quellen').toFixed(1), max: r.maxQuellen, ausgelassen: r.klang.ausgelassen });
    ok('b5: nach der Ruhe klingen nur noch die Dauerquellen und Musikstimmen (hoechstens 26)', P[n - 1].quellen <= 26, P[n - 1].quellen);
    /* Effekte sind Objekte in der Szene: wachsen sie nicht, bleibt nichts
       liegen. Die Zahlen des Renderers (Geometrien, Texturen) wachsen
       dagegen mit jedem Stadtteil, der zum ersten Mal ins Bild kommt, und
       werden nur zur Auskunft mitgeschrieben. */
    ok('b5: keine endlosen Effekte (Objekte in der Szene ohne Anstieg, hoechstens 10 Hinweise im Bild)',
       mittel(schluss, 'objekte') <= mittel(anfang, 'objekte') * 1.03 + 30 && P.every((p) => p.popupsDom <= 10),
       { objekte: [Math.round(mittel(anfang, 'objekte')), Math.round(mittel(schluss, 'objekte'))],
         geometrien: [P[0].geometrien, P[n - 1].geometrien], texturen: [P[0].texturen, P[n - 1].texturen],
         popups: Math.max(...P.map((p) => p.popupsDom)) });
    ok('b5: keine doppelten Belohnungen (Zaehler je Art = geloeste Ereignisse, Hinweise = geloest und entdeckt)',
       r.zaehlerDelta === r.geloestNichtEnforcer && r.belohnungsHinweise === r.geloestEntdeckt,
       { zaehler: r.zaehlerDelta, geloest: r.geloestNichtEnforcer, hinweise: r.belohnungsHinweise, geloestEntdeckt: r.geloestEntdeckt });
    ok('b5: keine Lecks am Ende (Ereignisrollen, Einsatzwagen, Aktivitaeten)', r.leck.ev === 0 && r.leck.akt === 0, r.leck);
    if (P[0].heapMB !== null) {
      ok('b5: Speicher ohne Anstieg (JS-Heap: letztes Drittel hoechstens 15 % ueber dem ersten)',
         mittel(schluss, 'heapMB') <= mittel(anfang, 'heapMB') * 1.15,
         { anfangMB: +mittel(anfang, 'heapMB').toFixed(1), schlussMB: +mittel(schluss, 'heapMB').toFixed(1),
           minMB: Math.min(...P.map((p) => p.heapMB)), maxMB: Math.max(...P.map((p) => p.heapMB)) });
    }
    ok('b5: Draw Calls unter Last unter 899 (Median der Stichproben)',
       r.calls.length > 0 && r.calls.slice().sort((a, b) => a - b)[Math.floor(r.calls.length / 2)] < 899, r.calls);
    await b.close();
  }

  console.log('\nSeitenfehler: ' + seitenFehler.length + (seitenFehler.length ? ' ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  ok('keine Seitenfehler', seitenFehler.length === 0, seitenFehler.slice(0, 3));
  ergebnis.pruef = pruef;
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(ergebnis, null, 1));
  const fehler = pruef.filter((p) => !p.ok).length;
  console.log('\nERGEBNIS ' + (pruef.length - fehler) + '/' + pruef.length);
  process.exit(fehler ? 1 : 0);
})();
