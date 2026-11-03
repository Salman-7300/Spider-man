/* Mega-Update 1.0, M6: Fortschritt, alte Spielstaende, HUD-Vorrang.
   =========================================================================
   Teile (teil=alle oder Liste):
     altstand    Beispiel 4 des Auftrags: ein ECHTER alter Spielstand -
                 erzeugt mit dem Code vor dem Mega-Update (Version 3) bzw.
                 mit M5 (Version 4), siehe stand=... - wird geladen:
                 Punkte, Stufe, gekaufte Fertigkeiten, Akt 1 samt
                 Kontrollpunkt, Bezirke, Meilensteine, Statistik bleiben;
                 die neuen Zaehler starten bei 0, die Nebenreihe offen;
                 die P-Ansicht (echte Taste P) zeigt alles richtig; nach dem
                 Speichern und Neuladen ist alles noch da.
     meilen      die neuen Meilensteine: genau einmal, mit Belohnung, auch
                 nach dem Neuladen nicht doppelt; "Hinter den Fassaden"
                 ueber zwei echte Besuche (Tuer, C)
     fertigkeit  die zwei angebundenen Fertigkeiten wirken messbar:
                 "Sauberer Abschluss" auf den Luft-Finisher (Schaden),
                 "Schwungkunst" auf die Bewegungskette (Punkte) - jeweils
                 derselbe echte Ablauf ohne und mit Fertigkeit
     hud         Vorrang: laeuft ein Auftrag, gehoeren Leuchtturm und
                 Zieltext dem Auftrag, nicht einem Ereignis; ohne Auftrag
                 zeigt das Ereignis Ziel und Entfernung; waehrend eines
                 Auftrags keine Streckenangebote; der Abschluss eines
                 Ereignisses nennt die Belohnung

   Aufruf:  node tools/pruef/mega-fortschritt.js [teil=alle] [v3=datei.json] [v4=datei.json] [aus=datei.json]
   Ohne v3/v4 werden die beiden Staende aus tools/pruef/daten/ genommen.
   Exit 1, wenn eine Pruefung fehlschlaegt.
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');

const arg = (k, std) => {
  const a = process.argv.find((x) => x.startsWith(k + '='));
  return a ? a.slice(k.length + 1) : std;
};
const TEILE = arg('teil', 'alle');
const AUS = arg('aus', null);
const will = (t) => TEILE === 'alle' || TEILE.split(',').includes(t);
const DATEN = path.join(__dirname, 'daten');
const V3 = fs.readFileSync(arg('v3', path.join(DATEN, 'spielstand-v3-vor-mega.json')), 'utf8');
const V4 = fs.readFileSync(arg('v4', path.join(DATEN, 'spielstand-v4-m5.json')), 'utf8');

const pruef = [];
const ok = (name, bed, wert) => {
  pruef.push({ name, ok: !!bed, wert });
  console.log('PRUEF ' + (bed ? 'ok    ' : 'FEHLER') + '  ' + name + (wert === undefined ? '' : '  ' + JSON.stringify(wert)));
};

(async () => {
  const { b, page } = await starte(900, 560, 4711, { frierSofort: true });
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e)));
  const E = (fn, a) => page.evaluate(fn, a);
  const neuLaden = async (text) => {
    await E((t) => { if (t === null) localStorage.clear(); else __dbg.progSchreib(t); }, text);
    await page.reload();
    await page.waitForFunction(() => window.__dbg && window.__dbg.actorsReady, null, { timeout: 240000 });
    await E(() => { __dbg.frier(true); const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
                    const h = document.getElementById('hud'); if (h) h.style.display = 'block'; });
  };
  const schritte = (n) => E((k) => { for (let i = 0; i < k; i++) __dbg.schritt(1 / 60); }, n);
  const pAnsicht = async () => {
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(150);
    const r = await E(() => {
      const el = document.getElementById('fortschritt'), inh = document.getElementById('fsInhalt');
      return { offen: !!el && getComputedStyle(el).display !== 'none', html: inh ? inh.innerHTML : '', text: inh ? inh.innerText : '' };
    });
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(100);
    return r;
  };
  const ergebnis = {};

  /* ================= altstand (Beispiel 4) ================= */
  if (will('altstand')) {
    for (const [name, text] of [['v3', V3], ['v4', V4]]) {
      const alt = JSON.parse(text);
      await neuLaden(text);
      await schritte(200);
      const st = await E(() => {
        const d = __dbg, P = d.prog;
        return { version: P.version, punkte: P.punkte, best: P.bestPunkte, score: d.player.score, stufe: d.stufe,
                 fp: P.fertigkeitspunkte, skills: Object.assign({}, P.skills), story: JSON.parse(JSON.stringify(P.story)),
                 neben: JSON.parse(JSON.stringify(P.neben)), meilen: P.meilensteine.slice(), bezirke: JSON.parse(JSON.stringify(P.bezirke)),
                 statistik: Object.assign({}, P.statistik), info: d.progInfo ? d.progInfo() : null,
                 hudStufe: document.getElementById('best').textContent,
                 abschluss: d.skillWert('abschluss'), schwungweite: d.skillWert('schwungweite'), schwungkunst: d.skillWert('schwungkunst') };
      });
      const neue = ['evUeberfall', 'evGang', 'evUnfall', 'evLaden', 'evAutodieb', 'evDach', 'wandFinisher', 'luftFinisher'];
      ergebnis['altstand_' + name] = st;
      console.log('ALTSTAND ' + name, JSON.stringify({ version: st.version, punkte: st.punkte, stufe: st.stufe, fp: st.fp, skills: st.skills,
                  story: st.story, neben: st.neben, meilen: st.meilen, hud: st.hudStufe }));
      ok(name + ': Punkte und Bestwert unveraendert', st.punkte === alt.punkte && st.best === alt.bestPunkte && st.score === alt.punkte,
         { alt: [alt.punkte, alt.bestPunkte], neu: [st.punkte, st.best, st.score] });
      ok(name + ': Stufe folgt dem Bestwert (Stufe 6 · Ikone) und steht so im HUD', st.stufe === 5 && /Stufe 6 · Ikone/.test(st.hudStufe),
         { stufe: st.stufe + 1, hud: st.hudStufe });
      ok(name + ': gekaufte Fertigkeiten und freie Punkte bleiben, und sie wirken',
         JSON.stringify(st.skills) === JSON.stringify(alt.skills) && st.fp === alt.fertigkeitspunkte &&
         st.abschluss === 1.15 && st.schwungweite === 1.15 && st.schwungkunst === 1,
         { skills: st.skills, fp: st.fp, faktoren: [st.abschluss, st.schwungweite, st.schwungkunst] });
      ok(name + ': Akt 1 korrekt (zwei Missionen fertig, Kontrollpunkt Mission 3 Phase 2)',
         st.story.akt === 1 && st.story.fertig.join() === 'm1,m2' && st.story.checkpointId === 'm3' && st.story.checkpointPhase === 1,
         st.story);
      ok(name + ': Bezirk, Meilensteine und Statistik bleiben',
         JSON.stringify(st.bezirke) === JSON.stringify(alt.bezirke) && st.meilen.join() === alt.meilensteine.join() &&
         st.statistik.crimes === alt.statistik.crimes && st.statistik.gerettet === alt.statistik.gerettet && st.statistik.bosse === alt.statistik.bosse,
         { bezirke: st.bezirke, meilen: st.meilen, crimes: st.statistik.crimes });
      ok(name + ': neue Zaehler starten bei 0, Nebenreihe im Anfangszustand, Version 4',
         neue.every((k) => st.statistik[k] === 0) && st.statistik.nebenAuftraege === 0 && st.version === 4 &&
         JSON.stringify(st.neben) === JSON.stringify({ fertig: [], checkpointId: null, checkpointPhase: 0, flags: {} }),
         { neue: neue.map((k) => st.statistik[k]), neben: st.neben, version: st.version });
      const pa = await pAnsicht();
      ergebnis['pAnsicht_' + name] = pa.text.slice(0, 3000);
      const t = pa.text;
      ok(name + ': P-Ansicht (Taste P) zeigt Stufe, freie Punkte, die gekauften Fertigkeiten, Geschichte, Nebenreihe und Einsaetze',
         pa.offen && /Stufe 6 · Ikone/.test(t) && /2 Fertigkeitspunkte frei/.test(t) && /Als Nächstes/i.test(t) &&
         /NEBENAUFTRÄGE/i.test(t) && /Besondere Einsätze/i.test(t) && /GESCHICHTE/i.test(t) &&
         (t.match(/aktiv/g) || []).length >= 3,
         { offen: pa.offen, auszug: t.slice(0, 400) });
      /* speichern und neu laden: alles bleibt */
      await E(() => __dbg.progSpeichern(true));
      const roh = await E(() => __dbg.progRoh());
      await neuLaden(null === roh ? null : roh);
      const st2 = await E(() => { const P = __dbg.prog; return { punkte: P.punkte, skills: Object.assign({}, P.skills),
        story: P.story.fertig.join() + '|' + P.story.checkpointId, meilen: P.meilensteine.slice(), fp: P.fertigkeitspunkte }; });
      ok(name + ': nach Speichern und Neuladen derselbe Stand',
         st2.punkte === st.punkte && JSON.stringify(st2.skills) === JSON.stringify(st.skills) && st2.story === 'm1,m2|m3' && st2.fp === st.fp,
         st2);
    }
  }

  /* ================= meilen ================= */
  if (will('meilen')) {
    const basis = JSON.parse(V4);
    basis.statistik.evAutodieb = 3;            // Zaehler wie nach drei gestoppten Autodieben
    await neuLaden(JSON.stringify(basis));
    const vor = await E(() => ({ score: __dbg.player.score, ruf: __dbg.ruf, meilen: __dbg.prog.meilensteine.slice() }));
    await schritte(200);
    const nach = await E(() => ({ score: __dbg.player.score, ruf: __dbg.ruf, meilen: __dbg.prog.meilensteine.slice(),
                                  roh: JSON.parse(__dbg.progRoh()).meilensteine }));
    ok('meilen: "Kein Entkommen" (3 Autodiebe) wird vergeben, mit Punkten, sofort gespeichert',
       nach.meilen.includes('jagd3') && !vor.meilen.includes('jagd3') && nach.score > vor.score && nach.roh.includes('jagd3'),
       { vor: vor.score, nach: nach.score, meilen: nach.meilen });
    const andere = nach.meilen.filter((m) => !vor.meilen.includes(m) && m !== 'jagd3');
    ok('meilen: kein anderer neuer Meilenstein ohne Grund', andere.length === 0, andere);
    await neuLaden(await E(() => __dbg.progRoh()));
    const s1 = await E(() => __dbg.player.score);
    await schritte(300);
    const s2 = await E(() => ({ score: __dbg.player.score, n: __dbg.prog.meilensteine.filter((m) => m === 'jagd3').length }));
    ok('meilen: nach dem Neuladen keine zweite Belohnung', s2.score === s1 && s2.n === 1, { vorher: s1, nachher: s2 });
    /* Hinter den Fassaden: zwei echte Besuche */
    const besuch = await E(() => {
      const d = __dbg, P = d.player, r = {};
      d.mega.blockiere(true);
      const T = d.mega.orteTueren();
      for (const id of ['laden', 'buero']) {
        const t = T[id];
        if (!t) { r[id] = 'keine Tuer'; continue; }
        P.pos.set(t.ex + t.nx * 0.6, d.groundYAt(t.ex + t.nx * 0.6, t.ez + t.nz * 0.6, 2), t.ez + t.nz * 0.6);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.facing = Math.atan2(-t.nx, -t.nz);
        for (let i = 0; i < 10; i++) d.schritt(1 / 60);
        d.mega.interagieren();
        for (let i = 0; i < 120 && !(d.innen.active && !d.innen.phase); i++) d.schritt(1 / 60);
        r[id] = d.innen.active ? d.innen.id : 'nicht drin';
        d.innenSofortRaus();
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      }
      for (let i = 0; i < 200; i++) d.schritt(1 / 60);
      r.einmalig = d.prog.einmalig.filter((k) => /^innen:/.test(k));
      r.meilen = d.prog.meilensteine.includes('innen2');
      return r;
    });
    ok('meilen: "Hinter den Fassaden" nach echten Besuchen von Laden und Kai 7', besuch.laden === 'laden' && besuch.buero === 'buero' &&
       besuch.einmalig.length === 2 && besuch.meilen, besuch);
    const pa = await pAnsicht();
    ok('meilen: die neuen Meilensteine stehen in der P-Ansicht (erledigt bzw. mit Anteil)',
       /Kein Entkommen/.test(pa.text) && /Hinter den Fassaden/.test(pa.text) && /An die Wand/.test(pa.text) &&
       /Aus der Luft/.test(pa.text) && /Im Fluss/.test(pa.text) && /Die Schatten der Stadt/.test(pa.text) && /Die Stadt kennt dich/.test(pa.text),
       pa.text.slice(pa.text.search(/Meilensteine/i), pa.text.search(/Meilensteine/i) + 300));
  }

  /* ================= fertigkeit =================
     Die Ablaeufe kommen aus den Pruefstaenden von M2 und M3 (dort laufen
     sie zuverlaessig mit echten Eingaben): einmal ohne, einmal mit der
     Fertigkeit, je in einem frischen Browser. */
  if (will('fertigkeit')) {
    const { execFileSync } = require('node:child_process');
    const os = require('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fortschritt-'));
    const lauf = (skript, args) => {
      const aus = path.join(tmp, path.basename(skript) + '-' + args.join('_').replace(/[^a-z0-9_]/gi, '') + '.json');
      try {
        execFileSync(process.execPath, process.execArgv.concat([path.join(__dirname, skript)].concat(args, ['aus=' + aus])),
                     { stdio: 'ignore', timeout: 1500000 });
      } catch (e) { /* Exit 1 heisst nur: eine Pruefung dort fehlgeschlagen - die Werte zaehlen trotzdem */ }
      return fs.existsSync(aus) ? JSON.parse(fs.readFileSync(aus, 'utf8')) : null;
    };
    const k0 = lauf('mega-kampf.js', ['teil=luft']);
    const k1 = lauf('mega-kampf.js', ['teil=luft', 'skill=abschluss']);
    const f0 = lauf('mega-bewegung.js', ['teil=fluss']);
    const f1 = lauf('mega-bewegung.js', ['teil=fluss', 'skill=schwungkunst']);
    const lo = k0 && k0.luft, lm = k1 && k1.luft;
    const ko = f0 && f0.neu && f0.neu.fluss && f0.neu.fluss.echteKette, km = f1 && f1.neu && f1.neu.fluss && f1.neu.fluss.echteKette;
    ergebnis.fertigkeit = { luftOhne: lo, luftMit: lm, ketteOhne: ko, ketteMit: km };
    console.log('FERTIGKEIT', JSON.stringify({ luft: [lo && lo.schadenFinisher, lm && lm.schadenFinisher],
      kette: [ko && ko.letzte, km && km.letzte] }));
    ok('fertigkeit: Luft-Finisher in beiden Laeufen ausgeloest (Pruefstand M2, Teil luft)',
       lo && lm && lo.finisher === 1 && lm.finisher === 1, [lo && lo.finisher, lm && lm.finisher]);
    ok('fertigkeit: "Sauberer Abschluss" macht den Luft-Finisher 15 % staerker (30 -> 34,5)',
       lo && lm && Math.abs(lo.schadenFinisher - 30) < 0.01 && Math.abs(lm.schadenFinisher - 34.5) < 0.01,
       { ohne: lo && lo.schadenFinisher, mit: lm && lm.schadenFinisher });
    ok('fertigkeit: Bewegungskette in beiden Laeufen genau einmal ausgezahlt, gleich lang (Pruefstand M3, Teil fluss)',
       ko && km && ko.ausgezahlt === 1 && km.ausgezahlt === 1 && ko.letzte && km.letzte && ko.letzte.n === km.letzte.n,
       { ohne: ko && ko.letzte, mit: km && km.letzte });
    if (ko && km && ko.letzte && km.letzte && ko.letzte.punkte > 0) {
      const q = km.letzte.punkte / ko.letzte.punkte;
      ok('fertigkeit: "Schwungkunst" gibt fuer dieselbe Kette rund das 1,5-Fache', q > 1.45 && q < 1.55,
         { ohne: ko.letzte.punkte, mit: km.letzte.punkte, faktor: +q.toFixed(3) });
    }
  }

  /* ================= hud ================= */
  if (will('hud')) {
    await neuLaden(null);
    const H = await E(() => {
      const d = __dbg, P = d.player, r = {};
      const ziel = () => { const o = document.getElementById('objective'); return o && o.style.display !== 'none' ? o.textContent : ''; };
      d.mega.blockiere(false);
      P.pos.set(25, d.groundYAt(25, 25, 2), 25);
      /* 1) Ein Ereignis ohne Auftrag: es zeigt Ziel, Entfernung und Leuchtturm */
      d.evAlleBeenden();
      const e = d.evStarte('ueberfall');
      let ev = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
      for (let i = 0; i < 600 && ev && !ev.entdeckt; i++) {
        /* naeher heran, bis es entdeckt ist */
        const dx = ev.ort.x - P.pos.x, dz = ev.ort.z - P.pos.z, dist = Math.hypot(dx, dz);
        if (dist > 40) P.pos.set(P.pos.x + dx / dist * 1.5, d.groundYAt(P.pos.x + dx / dist * 1.5, P.pos.z + dz / dist * 1.5, 2), P.pos.z + dz / dist * 1.5);
        d.schritt(1 / 60);
        ev = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
      }
      d.schritt(1 / 60);
      r.ohneAuftrag = { ziel: ziel(), beacon: d.beaconStand(), entdeckt: ev && ev.entdeckt };
      /* 2) Jetzt laeuft eine Storymission dazu: Auftrag hat Vorrang */
      d.storyStarte('m1');
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      r.mitAuftrag = { ziel: ziel(), beacon: d.beaconStand(), story: d.storyStand().aktiv,
                       evNoch: d.mega.ereignisse().filter((x) => x.entdeckt && (x.zustand === 'AKTIV' || x.zustand === 'ESKALIERT')).length };
      /* 3) Streckenangebote waehrend des Auftrags gesperrt - erst ohne
         Ereignis pruefen, damit nur der Auftrag zaehlt */
      d.evAlleBeenden();
      for (let i = 0; i < 5; i++) d.schritt(1 / 60);
      r.betriebMitAuftrag = d.taktBetriebJetzt();
      d.storyEnde('abbruch');
      for (let i = 0; i < 10; i++) d.schritt(1 / 60);
      r.betriebOhne = d.taktBetriebJetzt();
      return r;
    });
    ergebnis.hud = H;
    console.log('HUD', JSON.stringify(H));
    ok('hud: ohne Auftrag zeigt das Ereignis Ziel und Entfernung, Leuchtturm rot',
       H.ohneAuftrag.entdeckt && /stoppen/.test(H.ohneAuftrag.ziel) && / m$/.test(H.ohneAuftrag.ziel.trim()) &&
       H.ohneAuftrag.beacon.sichtbar && H.ohneAuftrag.beacon.farbe === 'ff2233', H.ohneAuftrag);
    ok('hud: laeuft eine Storymission, gehoeren Zieltext UND Leuchtturm dem Auftrag (orange), nicht dem Ereignis',
       H.mitAuftrag.story === 'm1' && H.mitAuftrag.evNoch > 0 && !/Überfall stoppen/.test(H.mitAuftrag.ziel) &&
       (!H.mitAuftrag.beacon.sichtbar || H.mitAuftrag.beacon.farbe === 'ffb03c'), H.mitAuftrag);
    ok('hud: waehrend eines Auftrags keine Streckenangebote (Taktgeber besetzt), danach wieder frei',
       H.betriebMitAuftrag === true && H.betriebOhne === false, { mit: H.betriebMitAuftrag, ohne: H.betriebOhne });
    /* 4) Abschluss nennt die Belohnung */
    const BEL = await E(() => {
      const d = __dbg, P = d.player;
      d.evAlleBeenden();
      const popups = [];
      const beob = new MutationObserver((m) => { for (const x of m) for (const n of x.addedNodes) if (n.className === 'popup') popups.push(n.textContent); });
      beob.observe(document.getElementById('hud'), { childList: true });
      d.evStarte('ueberfall');
      let ev = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
      /* hingehen, entdecken, die Taeter niederringen (Netz + Schlaege wie im Spiel) */
      for (let i = 0; i < 60 * 90; i++) {
        ev = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
        if (!ev || ev.zustand === 'GELOEST' || ev.zustand === 'GESCHEITERT') break;
        const g = ev.gegner.find((x) => !x.tot);
        const ziel = g || ev.ort;
        const dx = ziel.x - P.pos.x, dz = ziel.z - P.pos.z, dist = Math.hypot(dx, dz);
        if (dist > 30) P.pos.set(ziel.x - dx / dist * 25, d.groundYAt(ziel.x - dx / dist * 25, ziel.z - dz / dist * 25, 2), ziel.z - dz / dist * 25);
        P.facing = Math.atan2(dx, dz);
        d.kamStart(Math.atan2(-dx, -dz), 0.2);
        if (dist > 1.6) { d.taste('KeyW', true); } else { d.taste('KeyW', false); if (i % 12 === 0) d.tryAttack('punch'); }
        if (P.hp < 60) P.hp = 100;
        d.schritt(1 / 60);
      }
      d.taste('KeyW', false);
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      /* Die Beobachtung meldet erst nach diesem Skript - offene Meldungen
         jetzt abholen. */
      for (const x of beob.takeRecords()) for (const n of x.addedNodes) if (n.className === 'popup') popups.push(n.textContent);
      beob.disconnect();
      return { popups, zustand: ev ? ev.zustand : 'weg' };
    });
    ergebnis.belohnung = BEL;
    console.log('BELOHNUNG', JSON.stringify(BEL));
    const p = BEL.popups.find((t) => /entschärft/.test(t));
    ok('hud: der Abschluss eines Ereignisses nennt die Belohnung (Punkte, Ruf)', !!p && /\+\d+ Punkte/.test(p), { popup: p, alle: BEL.popups.slice(-6) });
  }

  console.log('\nSeitenfehler: ' + seitenFehler.length + (seitenFehler.length ? ' ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  ok('keine Seitenfehler', seitenFehler.length === 0, seitenFehler.slice(0, 3));
  ergebnis.pruef = pruef;
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(ergebnis, null, 1));
  await b.close();
  const fehler = pruef.filter((x) => !x.ok).length;
  console.log('\nERGEBNIS ' + (pruef.length - fehler) + '/' + pruef.length);
  process.exit(fehler ? 1 : 0);
})();
