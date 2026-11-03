/* Mega-Update 1.0, M4: begehbare Orte im laufenden Spiel.
   =========================================================================
   Mit echten Eingaben (W, C = interagieren()) an beiden Orten:

     orte        Tueren gefunden (Laden-/Buero-Programm), Gehweg davor frei,
                 Lampe ueber der Tuer, Minikartensymbol vorhanden
     zyklus      je Ort: 6 m vor die Tuer, mit W heran bis der Hinweis
                 erscheint, C -> Blende -> drinnen: Startpunkt frei, auf dem
                 Boden, Kamera im Raum und unter der Decke, Figuren da und
                 sichtbar; zum Handlungspunkt laufen (Wegpunkte), C ->
                 Wirkung; zurueck zum Ausgang, C -> draussen: freier Punkt,
                 kein Wagen im Umkreis von 3,2 m, nicht im Haus; Aussenwelt
                 unveraendert (Wagen, Passanten, Ereignisse)
     wiederholt  20 Ein- und Austritte im Wechsel: Szene, Kollider, Figuren,
                 Geometrien und Texturen bleiben nach dem ersten Bau gleich
     sperren     Kampf in der Naehe -> kein Betreten; Storymission -> kein
                 Hinweis; Wagen vor der Tuer -> Austritt seitlich versetzt
     laufen      je Ort 40 s Bot mit wechselnden Richtungen: nie ausserhalb
                 der Raumgrenzen, nie im Moebel, nie unter dem Boden, Kamera
                 nie hinter einer Wand oder ueber der Decke
     last        Zeichenaufrufe und Dreiecke draussen und in beiden Raeumen
                 (mit laufendem Bild)

   Aufruf:  node tools/pruef/mega-innen.js [teil=alle] [keim=4711]
   Exit 1, wenn eine Pruefung scheitert.
   ========================================================================= */
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const TEIL = arg('teil', 'alle');
const KEIM = Number(arg('keim', 4711));

function laufe(teil) {
  const d = __dbg, P = d.player, DT = 1 / 60;
  d.frier(true);
  const R = {};
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'];
  const frei = () => { for (const t of TASTEN) d.taste(t, false); };
  const I = d.innen;
  /* Weltereignisse ruhig halten (sie wuerden den Weg zur Tuer kreuzen) */
  d.mega.blockiere && d.mega.blockiere(true);
  const tueren = d.mega.orteTueren();
  const schritt = (n) => { for (let i = 0; i < n; i++) d.schritt(DT); };
  const warteBis = (bed, max) => { for (let i = 0; i < (max || 600); i++) { if (bed()) return i; d.schritt(DT); } return -1; };
  const drinFrei = (r, x, z, y) => d.versteckFrei(x, z, y, 0.4);
  const weltSchnapp = () => ({
    wagen: d.cars.length, zivis: d.civilians.length, ev: (d.mega.ereignisse() || []).length,
    wagenOrt: d.cars.slice(0, 12).map((c) => c.mesh ? [+c.mesh.position.x.toFixed(3), +c.mesh.position.z.toFixed(3)] : null),
    zivisOrt: d.civilians.slice(0, 12).map((c) => [+c.pos.x.toFixed(3), +c.pos.z.toFixed(3)]),
  });

  if (teil === 'alle' || teil === 'orte') {
    R.orte = {};
    for (const id of ['laden', 'buero']) {
      const t = tueren && tueren[id];
      R.orte[id] = t ? { tuer: [+t.tx.toFixed(2), +t.tz.toFixed(2)], vor: [+t.qx.toFixed(2), +t.qz.toFixed(2)],
                         teil: t.teil, normal: [t.nx, t.nz], gehwegFrei: d.versteckFrei(t.qx, t.qz, t.y, 0.45) } : null;
    }
    R.orte.lampen = d.mega.orteLampen();
  }

  /* Ein ganzer Besuch mit echten Eingaben. */
  const besuch = (id, schaden) => {
    const t = tueren[id];
    const out = { id };
    frei();
    /* Auf den freien Gehwegpunkt vor der Tuer (2,6 m), Blick zur Tuer.
       Weiter draussen stehen oft Parkautos am Bordstein. */
    d.setzePos(t.qx + t.nx * 0.4, 1, t.qz + t.nz * 0.4);
    P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.facing = Math.atan2(-t.nx, -t.nz);
    d.setzeKamYaw(P.facing + Math.PI);
    schritt(5);
    d.taste('KeyW', true);
    const iHinweis = warteBis(() => /betreten/.test(d.mega.prompt() || ''), 300);
    frei();
    out.hinweis = iHinweis >= 0 ? d.mega.prompt() : null;
    out.hinweisNachS = iHinweis >= 0 ? +(iHinweis * DT).toFixed(2) : null;
    if (iHinweis < 0) return out;
    schritt(8);                                   // Hinweis ist ein paar Bilder alt (alle 0,1 s)
    d.mega.interagieren();
    const iDrin = warteBis(() => I.active && !I.phase, 120);
    out.drin = iDrin >= 0;
    out.blendeS = iDrin >= 0 ? +(iDrin * DT).toFixed(2) : null;
    if (!out.drin) return out;
    const r = I.raum;
    out.raum = r.id;
    /* Ab hier steht die Aussenwelt: Schnappschuss gleich nach dem Betreten,
       Vergleich unmittelbar vor dem Hinausgehen. */
    const vorher = weltSchnapp();
    out.startFrei = drinFrei(r, P.pos.x, P.pos.z, P.pos.y);
    out.startAufBoden = Math.abs(P.pos.y - r.bodenY) < 0.05;
    schritt(30);
    const k = d.kamera();
    const g = r.grenzen;
    out.kamera = { imRaum: k.pos[0] > g.x0 - 0.6 && k.pos[0] < g.x1 + 0.6 && k.pos[2] > g.z0 - 0.6 && k.pos[2] < g.z1 + 0.6,
                   unterDecke: k.pos[1] < r.bodenY + r.masse.hoehe, steckt: k.steckt, abstand: k.abstand };
    const figuren = d.mega.orteFiguren(id);
    out.figuren = figuren.length;
    out.figurenSichtbar = figuren.filter((f) => f.v.root.visible && f.v.root.parent && f.v.root.parent.visible).length;
    out.personen = r.personen.length;
    /* Zum Handlungspunkt: Wegpunkte gerade anlaufen (Blick setzen, W halten) */
    const h = r.aktionen[0];
    const geheZu = (x, z, max) => {
      for (let i = 0; i < (max || 600); i++) {
        const dx = x - P.pos.x, dz = z - P.pos.z;
        if (Math.hypot(dx, dz) < 0.5) { frei(); return i; }
        P.facing = Math.atan2(dx, dz); d.setzeKamYaw(P.facing + Math.PI);
        d.taste('KeyW', true);
        d.schritt(DT);
      }
      frei(); return -1;
    };
    const wege = id === 'laden'
      ? [[r.spielerStart.x + 3.2, r.spielerStart.z - 1.6], [h.x, h.z]]
      : [[h.x, h.z]];
    let ok = true;
    for (const [x, z] of wege) if (geheZu(x, z) < 0) ok = false;
    out.zumHandlungspunkt = ok;
    schritt(10);
    out.hinweisDrinnen = d.mega.prompt();
    if (schaden) P.hp = 40;
    const hpVor = P.hp;
    d.mega.interagieren();
    schritt(5);
    out.handlung = { text: out.hinweisDrinnen, hpVor, hpNach: P.hp };
    /* Zurueck zum Ausgang */
    ok = geheZu(r.ausgang.x, r.ausgang.z - 0.3 * Math.sign(r.ausgang.z - r.spielerStart.z || 1)) >= 0;
    schritt(10);
    out.hinweisAusgang = d.mega.prompt();
    const nachher = weltSchnapp();
    out.weltGleich = JSON.stringify(vorher) === JSON.stringify(nachher);
    if (!out.weltGleich) out.welt = { vorher, nachher };
    d.mega.interagieren();
    const iRaus = warteBis(() => !I.active && !I.phase, 120);
    out.draussen = iRaus >= 0;
    if (!out.draussen) return out;
    out.aussen = { x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), imHaus: d.mega.inGebaeude(P.pos.x, P.pos.z),
                   frei: d.versteckFrei(P.pos.x, P.pos.z, P.pos.y, 0.45),
                   wagenNah: d.cars.filter((c) => c.mesh && Math.hypot(c.mesh.position.x - P.pos.x, c.mesh.position.z - P.pos.z) < 3.2).length,
                   abstandTuer: +Math.hypot(P.pos.x - t.qx, P.pos.z - t.qz).toFixed(2) };
    /* Draussen laeuft die Welt weiter. */
    const a0 = weltSchnapp();
    schritt(60);
    const a1 = weltSchnapp();
    out.weltLaeuftWeiter = JSON.stringify(a0.wagenOrt) !== JSON.stringify(a1.wagenOrt);
    return out;
  };

  if (teil === 'alle' || teil === 'zyklus') {
    R.zyklus = [besuch('laden', true), besuch('buero', false)];
  }

  if (teil === 'alle' || teil === 'wiederholt') {
    /* Gezaehlt wird, was M4 gehoert (Raumgruppen, Figuren, Kollider) und
       der Grafikspeicher. Die Gesamtzahl der Szenenobjekte schwankt mit der
       Aussenwelt, die zwischen den Besuchen weiterlaeuft (Effekte,
       Einsatzwagen) - sie steht nur zur Auskunft dabei. */
    const raeume = () => d.szene.children.filter((o) => /^WEB_HERO_Interior_/.test(o.name || '')).length;
    const zaehl = () => ({ raeume: raeume(), kollider: d.colliders.length,
                           figuren: d.mega.orteFiguren('laden').length + d.mega.orteFiguren('buero').length,
                           geo: d.renderInfo().geometrien, tex: d.renderInfo().texturen });
    besuch('laden', false); besuch('buero', false);
    const z0 = zaehl();
    const szene0 = d.szene.children.length;
    let fehler = 0;
    for (let i = 0; i < 20; i++) {
      const b = besuch(i % 2 ? 'buero' : 'laden', false);
      if (!b.drin || !b.draussen) fehler++;
    }
    R.wiederholt = { vorher: z0, nachher: zaehl(), fehler, zyklen: d.innenZyklen, aktiv: I.active, phase: I.phase,
                     szeneVorher: szene0, szeneNachher: d.szene.children.length };
  }

  if (teil === 'alle' || teil === 'sperren') {
    const S = {};
    /* Storymission: kein Hinweis an der Tuer */
    const t = tueren.laden;
    frei();
    d.setzePos(t.ex, 1, t.ez); P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
    P.state = 'ground'; P.onGround = true; schritt(15);
    S.hinweisNormal = d.mega.prompt();
    const art = d.mission.art;
    d.mission.art = 'story'; schritt(15);
    S.hinweisStory = d.mega.prompt();
    d.mission.art = art; schritt(15);
    /* Kampf in der Naehe: Betreten abgelehnt */
    const gang = d.spawnGang(P.pos.x + 6, P.pos.z, 1, 'event');
    const e = gang && gang.enemies ? gang.enemies[0] : null;
    if (e) { e.target = 'player'; }
    schritt(15);
    const vor = d.mega.orteStatistik().kampfAbgelehnt;
    d.mega.interagieren(); schritt(30);
    S.kampf = { gegner: !!e, drin: I.active, abgelehnt: d.mega.orteStatistik().kampfAbgelehnt - vor };
    if (e) { e.dead = true; e.hp = 0; }
    for (const g of d.enemies) { g.dead = true; }
    schritt(30);
    /* Wagen vor der Tuer beim Hinausgehen: seitlich versetzt */
    d.mega.interagieren();
    warteBis(() => I.active && !I.phase, 120);
    const c = d.cars.find((q) => q.mesh);
    let altPos = null;
    if (c) { altPos = c.mesh.position.clone(); c.mesh.position.set(t.qx, c.mesh.position.y, t.qz); }
    const vers0 = d.mega.orteStatistik().ausgangVersetzt;
    d.mega.orteVerlassen();
    /* Austrittspunkt im Bild des Wechsels: die Welt laeuft danach weiter,
       und der Wagen faehrt auf seine Spur zurueck. Gemessen wird gegen die
       Stelle, an der er beim Hinausgehen stand. */
    let aus = null;
    warteBis(() => { if (!I.active && !aus) aus = { x: P.pos.x, z: P.pos.z }; return !I.active && !I.phase; }, 120);
    S.wagenVorTuer = { versetzt: d.mega.orteStatistik().ausgangVersetzt - vers0,
                       wagenNah: c && aus ? +Math.hypot(t.qx - aus.x, t.qz - aus.z).toFixed(2) : null,
                       draussen: !I.active };
    if (c && altPos) c.mesh.position.copy(altPos);
    R.sperren = S;
  }

  if (teil === 'alle' || teil === 'laufen') {
    R.laufen = {};
    for (const id of ['laden', 'buero']) {
      d.innenBetreten(null, 0, null, 0, id);
      warteBis(() => I.active && !I.phase, 120);
      const r = I.raum, g = r.grenzen;
      let ausserhalb = 0, imMoebel = 0, unterBoden = 0, kamHinterWand = 0, kamUeberDecke = 0, bilder = 0;
      const RICHT = [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']];
      for (let i = 0; i < 40 * 60; i++) {
        if (i % 50 === 0) { frei(); for (const t of RICHT[(i / 50 + (id === 'buero' ? 3 : 0)) % 8]) d.taste(t, true); d.setzeKamYaw((i / 50) * 0.7); }
        if (i % 330 === 200) d.tippeSprung();
        d.schritt(DT);
        bilder++;
        const p = P.pos;
        if (p.x < g.x0 - 0.05 || p.x > g.x1 + 0.05 || p.z < g.z0 - 0.05 || p.z > g.z1 + 0.05) ausserhalb++;
        if (p.y < r.bodenY - 0.03) unterBoden++;
        if (P.onGround && !d.versteckFrei(p.x, p.z, p.y, 0.2)) imMoebel++;
        const k = d.kamera();
        if (k.pos[0] < g.x0 - 0.6 || k.pos[0] > g.x1 + 0.6 || k.pos[2] < g.z0 - 0.6 || k.pos[2] > g.z1 + 0.6) kamHinterWand++;
        if (k.pos[1] > r.bodenY + r.masse.hoehe - 0.02) kamUeberDecke++;
      }
      frei();
      d.innenSofortRaus();
      R.laufen[id] = { bilder, ausserhalb, imMoebel, unterBoden, kamHinterWand, kamUeberDecke };
    }
  }
  d.mega.blockiere && d.mega.blockiere(false);
  return R;
}

(async () => {
  const { b, page } = await starte(900, 540, KEIM, { frierSofort: true });
  /* Seit M5 beginnt am Empfang die Nebenreihe. Dieser Pruefstand prueft
     die Raeume - die Reihe gilt hier als erledigt, damit C am Empfang nur
     spricht und kein Auftrag die Tueren sperrt (die Reihe selbst prueft
     tools/pruef/mega-neben.js). */
  await page.evaluate(() => {
    if (!__dbg.neben) return;
    const n = __dbg.prog.neben;
    for (const id of ['s1', 's2', 's3']) if (!n.fertig.includes(id)) n.fertig.push(id);
  });
  const R = await page.evaluate(laufe, TEIL);
  /* Last mit laufendem Bild: draussen, im Laden, im Buero */
  if (TEIL === 'alle' || TEIL === 'last') {
    await page.evaluate(() => __dbg.frier(false));
    const bild = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() =>
      res({ r: { calls: __dbg.renderInfo().calls, triangles: __dbg.renderInfo().dreiecke }, innen: __dbg.innenAktiv, blende: __dbg.innenBlende })))));
    const mittel = async (n) => { const a = []; for (let i = 0; i < n; i++) a.push(await bild()); return {
      calls: Math.round(a.reduce((s, x) => s + x.r.calls, 0) / n), dreiecke: Math.round(a.reduce((s, x) => s + x.r.triangles, 0) / n) }; };
    R.last = { draussen: await mittel(20) };
    for (const id of ['laden', 'buero']) {
      await page.evaluate((id) => __dbg.innenBetreten(null, 0, null, 0, id), id);
      for (let i = 0; i < 200; i++) { const z = await bild(); if (z.innen && z.blende <= 0) break; }
      R.last[id] = await mittel(20);
      await page.evaluate(() => __dbg.innenSofortRaus());
      for (let i = 0; i < 10; i++) await bild();
    }
  }
  await b.close();
  console.log(JSON.stringify(R, null, 1));
  const pruef = [];
  const P_ = (n, ok, w) => pruef.push({ n, ok: !!ok, w });
  if (R.orte) {
    P_('orte: Ladentuer gefunden, Gehweg frei', R.orte.laden && R.orte.laden.gehwegFrei, JSON.stringify(R.orte.laden));
    P_('orte: Buerotuer gefunden, Gehweg frei', R.orte.buero && R.orte.buero.gehwegFrei, JSON.stringify(R.orte.buero));
  }
  for (const z of R.zyklus || []) {
    P_(z.id + ': Hinweis an der Tuer', !!z.hinweis, z.hinweis);
    P_(z.id + ': betreten (Blende <= 0,4 s)', z.drin && z.blendeS <= 0.4, z.blendeS);
    P_(z.id + ': Start frei und auf dem Boden', z.startFrei && z.startAufBoden, JSON.stringify([z.startFrei, z.startAufBoden]));
    P_(z.id + ': Kamera im Raum, unter der Decke, nicht in einer Wand', z.kamera && z.kamera.imRaum && z.kamera.unterDecke && !z.kamera.steckt, JSON.stringify(z.kamera));
    P_(z.id + ': Figuren da und sichtbar', z.figuren === z.personen && z.figurenSichtbar === z.personen, z.figuren + '/' + z.personen + ' sichtbar ' + z.figurenSichtbar);
    P_(z.id + ': Handlungspunkt erreicht, Hinweis', z.zumHandlungspunkt && !!(z.handlung && z.handlung.text), JSON.stringify(z.handlung));
    if (z.id === 'laden') P_('laden: Inhaber versorgt (Gesundheit voll)', z.handlung && z.handlung.hpNach > z.handlung.hpVor, JSON.stringify(z.handlung));
    P_(z.id + ': Hinweis am Ausgang', /Hinausgehen/.test(z.hinweisAusgang || ''), z.hinweisAusgang);
    P_(z.id + ': draussen frei (kein Haus, kein Hindernis, kein Wagen)', z.draussen && z.aussen && !z.aussen.imHaus && z.aussen.frei && z.aussen.wagenNah === 0, JSON.stringify(z.aussen));
    P_(z.id + ': Aussenwelt drinnen angehalten (Wagen, Passanten, Ereignisse)', z.weltGleich, z.weltGleich ? 'gleich' : String(JSON.stringify(z.welt || null)).slice(0, 300));
    P_(z.id + ': Aussenwelt laeuft danach weiter', z.weltLaeuftWeiter, z.weltLaeuftWeiter);
  }
  if (R.wiederholt) {
    const w = R.wiederholt;
    P_('wiederholt: 20 Besuche ohne Fehler', w.fehler === 0 && !w.aktiv && !w.phase, JSON.stringify(w));
    P_('wiederholt: nichts waechst (Raeume, Kollider, Figuren, Geometrien, Texturen)',
       JSON.stringify(w.vorher) === JSON.stringify(w.nachher), JSON.stringify([w.vorher, w.nachher]));
  }
  if (R.sperren) {
    const s = R.sperren;
    P_('sperren: Storymission -> kein Hinweis an der Tuer', /betreten/.test(s.hinweisNormal || '') && !/betreten/.test(s.hinweisStory || ''), JSON.stringify([s.hinweisNormal, s.hinweisStory]));
    if (s.kampf.gegner) P_('sperren: Kampf in der Naehe -> kein Betreten', !s.kampf.drin && s.kampf.abgelehnt === 1, JSON.stringify(s.kampf));
    P_('sperren: Wagen vor der Tuer -> Austritt versetzt, frei', s.wagenVorTuer.draussen && s.wagenVorTuer.versetzt === 1 && s.wagenVorTuer.wagenNah >= 3.2, JSON.stringify(s.wagenVorTuer));
  }
  for (const id in (R.laufen || {})) {
    const l = R.laufen[id];
    P_(id + ': 40 s Laufen ohne Austritt, Moebel, Boden, Kamerafehler',
       l.ausserhalb === 0 && l.imMoebel === 0 && l.unterBoden === 0 && l.kamHinterWand === 0 && l.kamUeberDecke === 0, JSON.stringify(l));
  }
  if (R.last) console.log('LAST', JSON.stringify(R.last));
  console.log('');
  for (const p of pruef) console.log((p.ok ? 'PRUEF ok    ' : 'PRUEF FEHLER') + '  ' + p.n + '  [' + p.w + ']');
  process.exit(pruef.every((p) => p.ok) ? 0 : 1);
})();
