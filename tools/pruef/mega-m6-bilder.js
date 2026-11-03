/* Mega-Update 1.0, M6: Bilder fuer die Human-Abnahme (HUD, Fortschritt,
   Tag und Nacht).
   =========================================================================
   GESTELLTE TESTAUFNAHMEN: Held und Lage werden gesetzt (Versetzen,
   Ereignis gestartet), die Spielkamera und das HUD sind die echten. Wie
   die Ablaeufe regulaer entstehen und funktionieren, pruefen
   tools/pruef/mega-ereignisse.js, mega-fortschritt.js und mega-klang.js.
     m6-1-ereignis     Ereignis ohne Auftrag: Zieltext mit Entfernung, roter
                       Leuchtturm, Kampf mit Kombo-Anzeige
     m6-2-auftrag      Storymission laeuft, das Ereignis auch: Zieltext und
                       Leuchtturm (orange) gehoeren dem Auftrag
     m6-3-belohnung    Abschluss eines Ereignisses mit Belohnung im Hinweis
     m6-4-fortschritt  P-Ansicht: "Als Naechstes" und "Besondere Einsaetze"
     m6-5-tag          Strasse am Tag
     m6-6-nacht        dieselbe Strasse in der Nacht

   Aufruf:  node tools/pruef/mega-m6-bilder.js <ordner> [nur=1,2,...]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ZIEL = process.argv[2];
if (!ZIEL) { console.log('Aufruf: node tools/pruef/mega-m6-bilder.js <ordner>'); process.exit(1); }
const NUR = (process.argv.find((a) => a.startsWith('nur=')) || '').slice(4).split(',').filter(Boolean);
const will = (n) => !NUR.length || NUR.includes(String(n));

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  const { b, page } = await starte(1280, 720, 4711, { frierSofort: true });
  const E = (fn, a) => page.evaluate(fn, a);
  await E(() => {
    const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
    const h = document.getElementById('hud'); if (h) h.style.display = 'block';
    __dbg.frier(true);
  });
  const auf = async (name) => {
    await E(() => { __dbg.schritt(1 / 60, 1); __dbg.zeichne(); });
    fs.writeFileSync(path.join(ZIEL, name + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 86 }));
    console.log('Bild', name);
  };
  await E(() => {
    const d = __dbg, P = d.player;
    window.__b = {
      stelle(x, z, blickX, blickZ) {
        const y = d.groundYAt(x, z, 2);
        P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.facing = Math.atan2(blickX - x, blickZ - z);
        d.kamStart(Math.atan2(-(blickX - x), -(blickZ - z)), 0.22);
      },
      schritte(n, f) { for (let i = 0; i < n; i++) { if (f) f(i); if (P.hp < 60) P.hp = 100; d.schritt(1 / 60); } },
    };
  });

  /* 1) Ereignis ohne Auftrag, mit Kampf und Kombo - der Bot aus
        tools/pruef/mega-bot.js spielt den Ladenueberfall (Anreise
        abgekuerzt), bis eine Kombo steht */
  if (will(1) || will(2)) {
    await E(require('./mega-bot').botCode);
    const r = await E(() => {
      const d = __dbg, P = d.player;
      const st = window.__mb.start('laden');
      let z = null;
      for (let i = 0; i < 1200; i++) {
        z = window.__mb.takt(1);
        if (z.phase === 'fertig' || z.phase === 'nach') break;
        if (P.combo >= 3) break;
      }
      return { aufbau: st && st.aufbau, combo: P.combo, ev: z && z.ev, ziel: document.getElementById('objective').textContent };
    });
    console.log('Lage 1', JSON.stringify(r));
    if (will(1)) await auf('m6-1-ereignis');
    /* 2) jetzt eine Storymission dazu */
    if (will(2)) {
      const r2 = await E(() => {
        const d = __dbg, B = window.__b;
        d.storyStarte('m1');
        B.schritte(40);
        return { ziel: document.getElementById('objective').textContent, beacon: d.beaconStand(),
                 ev: d.mega.ereignisse().map((x) => x.art + ':' + x.zustand) };
      });
      console.log('Lage 2', JSON.stringify(r2));
      await auf('m6-2-auftrag');
      await E(() => { __dbg.storyEnde('abbruch'); window.__b.schritte(10); });
    }
  }

  /* 3) Abschluss mit Belohnung */
  if (will(3)) {
    const r = await E(() => {
      const d = __dbg, P = d.player;
      d.mega.blockiere(false); d.evAlleBeenden();
      window.__b.stelle(25, 25, 60, 25);
      d.evStarte('ueberfall');
      let fertig = false;
      for (let i = 0; i < 60 * 120 && !fertig; i++) {
        const ev = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
        if (!ev || ev.zustand === 'GELOEST') { fertig = true; break; }
        const g = ev.gegner.find((x) => !x.tot);
        const z = g || ev.ort;
        const dx = z.x - P.pos.x, dz = z.z - P.pos.z, dist = Math.hypot(dx, dz);
        if (dist > 30) { const s = (dist - 25) / dist; P.pos.set(P.pos.x + dx * s, d.groundYAt(P.pos.x + dx * s, P.pos.z + dz * s, 2), P.pos.z + dz * s); }
        P.facing = Math.atan2(dx, dz);
        if (i % 2 === 0) d.kamStart(Math.atan2(-dx, -dz), 0.24);
        if (dist > 1.7) d.taste('KeyW', true); else { d.taste('KeyW', false); if (i % 12 === 0) d.tryAttack('punch'); }
        if (P.hp < 60) P.hp = 100;
        d.schritt(1 / 60);
      }
      d.taste('KeyW', false);
      /* den Hinweis im ersten Viertel seiner Lebenszeit zeigen */
      for (let i = 0; i < 6; i++) d.schritt(1 / 60);
      const p = [...document.querySelectorAll('.popup')].map((x) => x.textContent);
      /* Popups verblassen per CSS-Uebergang und werden nach 0,95 s
         entfernt - fuers Bild eine Kopie des Abschlusshinweises stehen
         lassen (gleicher Text, gleiche Stelle). */
      const orig = [...document.querySelectorAll('.popup')].find((x) => /entschärft/.test(x.textContent));
      if (orig) {
        const k = orig.cloneNode(true);
        k.style.transition = 'none'; k.style.opacity = 1; k.style.marginTop = '0px';
        k.classList.add('festgehalten');
        document.getElementById('hud').appendChild(k);
      }
      return { fertig, popups: p };
    });
    console.log('Lage 3', JSON.stringify(r));
    await auf('m6-3-belohnung');
    await E(() => { for (const x of document.querySelectorAll('.popup.festgehalten')) x.remove(); });
  }

  /* 4) P-Ansicht */
  if (will(4)) {
    await E(() => { __dbg.evAlleBeenden(); __dbg.mega.blockiere(true); });
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    /* bis zu den neuen Abschnitten scrollen */
    await E(() => {
      const el = document.getElementById('fsInhalt');
      const h = [...el.querySelectorAll('h3')].find((x) => /Als N/i.test(x.textContent));
      if (h) h.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(150);
    fs.writeFileSync(path.join(ZIEL, 'm6-4-fortschritt.jpg'), await page.screenshot({ type: 'jpeg', quality: 86 }));
    console.log('Bild m6-4-fortschritt');
    await E(() => {
      const el = document.getElementById('fsInhalt');
      const h = [...el.querySelectorAll('h3')].find((x) => /Besondere/i.test(x.textContent));
      if (h) h.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(150);
    fs.writeFileSync(path.join(ZIEL, 'm6-4b-einsaetze.jpg'), await page.screenshot({ type: 'jpeg', quality: 86 }));
    console.log('Bild m6-4b-einsaetze');
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(150);
    /* Das Schliessen der Ansicht oeffnet das Menue (Pause) - wieder ins Spiel */
    await E(() => {
      window.WEB_HERO_MENU.closeAll();
      const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
      const h = document.getElementById('hud'); if (h) h.style.display = 'block';
    });
  }

  /* 5/6) Tag und Nacht an derselben Stelle */
  if (will(5) || will(6)) {
    for (const [name, zeit] of [['m6-5-tag', 0.5], ['m6-6-nacht', 0.02]]) {
      if (!will(name === 'm6-5-tag' ? 5 : 6)) continue;
      await E((zt) => {
        const d = __dbg;
        d.evAlleBeenden(); d.mega.blockiere(true);
        window.__setzeZeit(zt);
        window.__b.stelle(25, 25, 80, 25);
        window.__b.schritte(90);
      }, zeit);
      await auf(name);
    }
  }
  await b.close();
})();
