/* Mega-Update 1.0, M5: Bilder fuer die Human-Abnahme der Nebenreihe.
   =========================================================================
   Spielkamera, HUD sichtbar (Auftragszeile oben, Hinweis unten in der
   Mitte, Minikarte, Bossleiste); fuer "Beobachter" und "Ansatz" eine
   gesetzte Seitenkamera, weil die Spielkamera das Ziel dort hinter dem
   Helden verdeckt. Die Auftraege werden hier direkt in
   der gewuenschten Phase gestartet (storyStarte(id, phase)) - wie sie
   regulaer am Empfang beginnen und durchlaufen, prueft
   tools/pruef/mega-neben.js.
     m5-1-empfang      im Kai 7 am Empfang: "Auftrag annehmen: Schatten I"
     m5-2-spur         Schatten I: Spurenmarke, Hinweis "Spur untersuchen"
     m5-3-beobachter   Schatten I: der Beobachter, blauer Leuchtturm
     m5-4-koffer       Schatten II: der Koffer im Hof, "Koffer sichern"
     m5-5-rauch        Schatten III: SCHATTEN setzt zum Rauchsprung an
     m5-6-auftauchen   Schatten III: er taucht hinter dem Helden auf
     m5-7-gerissen     Schatten III: Netz beim Auftauchen - aus dem Rauch gerissen
     m5-8-fortschritt  P-Ansicht mit der Nebenreihe

   Aufruf:  node tools/pruef/mega-neben-bilder.js <ordner>
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ZIEL = process.argv[2];
if (!ZIEL) { console.log('Aufruf: node tools/pruef/mega-neben-bilder.js <ordner>'); process.exit(1); }

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  const { b, page } = await starte(960, 540, 4711, { frierSofort: true });
  await page.evaluate(() => {
    const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
    const h = document.getElementById('hud'); if (h) h.style.display = 'block';
    __dbg.frier(true);
    __dbg.mega.blockiere(true);
  });
  /* Seitenansicht: Kamera seitlich der Linie Held -> Ziel, Blick auf die Mitte.
     Fuer die zwei Bilder, in denen die Spielkamera das Ziel hinter dem
     Helden verdeckt. */
  const seitlich = async (name, seite, weite, hoehe) => {
    await page.evaluate(({ seite, weite, hoehe }) => {
      const d = __dbg, P = d.player, z = window.__ziel;
      d.schritt(1 / 60, 1);
      const mx = (P.pos.x + z.x) / 2, mz = (P.pos.z + z.z) / 2;
      const lx = z.x - P.pos.x, lz = z.z - P.pos.z, l = Math.hypot(lx, lz) || 1;
      const qx = -lz / l * seite, qz = lx / l * seite;
      d.aufnahme(mx + qx * weite - lx / l * 2, P.pos.y + hoehe, mz + qz * weite - lz / l * 2, mx, P.pos.y + 1.1, mz);
    }, { seite, weite, hoehe });
    fs.writeFileSync(path.join(ZIEL, name + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
    console.log('Bild', name, '(seitlich)');
  };
  const auf = async (name) => {
    await page.evaluate(() => { __dbg.schritt(1 / 60, 1); __dbg.zeichne(); });
    fs.writeFileSync(path.join(ZIEL, name + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
    console.log('Bild', name);
  };
  /* Helfer im Spiel: Held hinstellen, Blick setzen, laufen lassen */
  await page.evaluate(() => {
    const d = __dbg, P = d.player;
    window.__b = {
      stelle(x, z, gier, pitch, bilder) {
        d.setzePos(x, d.groundYAt(x, z, 2) + 0.05, z);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        P.facing = gier; d.setzeKamYaw(gier + Math.PI); d.setzeKamPitch(pitch === undefined ? 0.15 : pitch);
        for (let i = 0; i < (bilder || 30); i++) { if (P.hp < 60) P.hp = 100; d.schritt(1 / 60); }
      },
      blick(x, z) { return Math.atan2(x - P.pos.x, z - P.pos.z); },
      /* freier Standpunkt r Meter vor (x, z) mit freier Sicht dorthin */
      sicht(x, z, r) {
        const frei = (ax, az) => {
          const n = Math.ceil(Math.hypot(x - ax, z - az) / 1.5);
          for (let i = 0; i <= n; i++) {
            const o = d.mega.ort(ax + (x - ax) * i / n, az + (z - az) * i / n);
            if (o.haus || o.wasser || o.y < -0.5 || o.y > 1.5) return false;
          }
          return true;
        };
        for (const rr of [r, r - 4, r + 4, r - 8]) for (let i = 0; i < 32; i++) {
          const a = i / 32 * Math.PI * 2, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
          if (d.neben.punktOk(px, pz) && frei(px, pz)) return { x: px, z: pz };
        }
        return window.__b.frei(x, z, r);
      },
      frei(x, z, r) {
        for (const rr of [r, r + 3, r - 3, r + 6]) for (let i = 0; i < 24; i++) {
          const a = i / 24 * Math.PI * 2, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
          if (d.neben.punktOk(px, pz)) return { x: px, z: pz };
        }
        return { x, z };
      },
    };
  });

  /* 1: Empfang */
  await page.evaluate(() => {
    const d = __dbg, P = d.player, T = d.mega.orteTueren().buero;
    window.__b.stelle(T.ex + T.nx * 0.6, T.ez + T.nz * 0.6, Math.atan2(-T.nx, -T.nz), 0.15, 10);
    d.mega.interagieren();
    for (let i = 0; i < 90 && !(d.innen.active && !d.innen.phase); i++) d.schritt(1 / 60);
    const h = d.innen.raum.aktionen.find((a) => a.id === 'empfang');
    const s = d.innen.raum.spielerStart;
    window.__b.stelle(h.x + (s.x - h.x) * 0.12, h.z + (s.z - h.z) * 0.12, Math.atan2(h.x - s.x, h.z - s.z) + 0.35, 0.12, 20);
  });
  await auf('m5-1-empfang');
  await page.evaluate(() => { __dbg.innenSofortRaus(); __dbg.schritt(1 / 60, 10); });

  /* 2: Spur (Schatten I, Phase 1) */
  await page.evaluate(() => {
    const d = __dbg;
    d.storyStarte('s1', 1);
    const m = d.neben.daten();
    const q = m.spuren[0];
    const p = window.__b.frei(q.x, q.z, 2.1);
    const g = Math.atan2(q.x - p.x, q.z - p.z);
    window.__b.stelle(p.x, p.z, g, 0.32, 40);
    d.setzeKamYaw(g + Math.PI + 0.75);            // seitlich: Marke neben der Figur sichtbar
    d.schritt(1 / 60, 10);
  });
  await auf('m5-2-spur');

  /* 3: Beobachter (Phase 2) */
  await page.evaluate(() => {
    const d = __dbg;
    d.storyEnde('abbruch');
    d.schritt(1 / 60, 5);
    d.storyStarte('s1', 2);
    d.schritt(1 / 60, 2);
    let m = d.neben.daten();
    const o = m.zielPos || (m.beobachter && m.beobachter.pos);     // dort steht er (gleich)
    const p = window.__b.sicht(o.x, o.z, 16);
    window.__b.stelle(p.x, p.z, Math.atan2(o.x - p.x, o.z - p.z), 0.04, 60);
    m = d.neben.daten();
    window.__beobLog = { beob: m.beobachter, held: [d.player.pos.x, d.player.pos.z], ziel: o };
    if (m.beobachter) {
      const g = window.__b.blick(m.beobachter.pos.x, m.beobachter.pos.z);
      window.__b.stelle(d.player.pos.x, d.player.pos.z, g, 0.02, 20);
      d.setzeKamYaw(g + Math.PI + 0.42);        // seitlich: er steht neben der Figur im Bild
      d.schritt(1 / 60, 10);
    }
  });
  await page.evaluate(() => { const m = __dbg.neben.daten(); window.__ziel = m.beobachter ? m.beobachter.pos : m.zielPos; });
  await seitlich('m5-3-beobachter', 1, 9, 3.2);
  console.log('Beobachter', JSON.stringify(await page.evaluate(() => window.__beobLog)));

  /* 4: Koffer (Schatten II, Phase 4) */
  await page.evaluate(() => {
    const d = __dbg;
    d.storyEnde('abbruch');
    d.schritt(1 / 60, 5);
    d.prog.neben.fertig.push('s1');
    d.storyStarte('s2', 4);
    const m = d.neben.daten();
    const k = m.koffer;
    const p = window.__b.frei(k.x, k.z, 1.9);
    const g = Math.atan2(k.x - p.x, k.z - p.z);
    window.__b.stelle(p.x, p.z, g, 0.34, 30);
    d.setzeKamYaw(g + Math.PI + 0.75);            // seitlich: der Koffer neben der Figur
    d.schritt(1 / 60, 10);
  });
  await auf('m5-4-koffer');

  /* 5-7: SCHATTEN (Schatten III, Phase 2) */
  await page.evaluate(() => {
    const d = __dbg;
    d.storyEnde('abbruch');
    d.schritt(1 / 60, 5);
    d.prog.neben.fertig.push('s2');
    d.storyStarte('s3', 2);
    const m = d.neben.daten();
    const o = m.ort;
    const p = window.__b.frei(o.x, o.z, 6);
    window.__b.stelle(p.x, p.z, Math.atan2(o.x - p.x, o.z - p.z), 0.12, 20);
  });
  /* auf den Ansatz warten (Rauch steigt auf), dann ins Bild */
  const zustand = (bed, max) => page.evaluate(({ bed, max }) => {
    const d = __dbg, P = d.player;
    for (let i = 0; i < max; i++) {
      const b = d.neben.daten().boss;
      if (b && !b.dead) {
        P.facing = Math.atan2(b.pos.x - P.pos.x, b.pos.z - P.pos.z);
        d.setzeKamYaw(P.facing + Math.PI);
        if (new Function('b', 'return ' + bed)(b)) return true;
      }
      if (P.hp < 60) P.hp = 100;
      d.schritt(1 / 60);
    }
    return false;
  }, { bed, max });
  console.log('Ansatz', await zustand("(b.angriff === 'rauch' || b.angriff === 'rauch2') && b.warnT > 0 && b.warnT < 0.6", 60 * 30));
  /* von der Seite: Held und SCHATTEN im Qualm nebeneinander */
  await page.evaluate(() => { window.__ziel = __dbg.neben.daten().boss.pos; });
  await seitlich('m5-5-rauch', 1, 5.5, 2.4);
  console.log('Auftauchen', await zustand('b.fenster > 0 && b.fenster < 0.7', 60 * 6));
  /* Kamera so drehen, dass Held und SCHATTEN hinter ihm im Bild sind */
  await page.evaluate(() => {
    const d = __dbg, P = d.player, b = d.neben.daten().boss;
    const g = Math.atan2(b.pos.x - P.pos.x, b.pos.z - P.pos.z);
    d.setzeKamYaw(g + Math.PI * 0.75);
  });
  await auf('m5-6-auftauchen');
  await page.evaluate(() => {
    const d = __dbg, P = d.player, b = d.neben.daten().boss;
    P.facing = Math.atan2(b.pos.x - P.pos.x, b.pos.z - P.pos.z);
    d.setzeKamYaw(P.facing + Math.PI);
    d.kamStart(Math.atan2(-(b.pos.x - P.pos.x), -(b.pos.z - P.pos.z)), 0.1);
    d.webShot();
    for (let i = 0; i < 26; i++) d.schritt(1 / 60);
  });
  await auf('m5-7-gerissen');
  console.log('Statistik', JSON.stringify(await page.evaluate(() => __dbg.neben.statistik())));

  /* 8: Fortschrittsansicht */
  await page.evaluate(() => {
    const d = __dbg;
    d.storyEnde('abbruch');
    d.schritt(1 / 60, 5);
    if (window.WEB_HERO_MENU) window.WEB_HERO_MENU.open('fortschritt');
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.getElementById('fsInhalt');
    const h = el && Array.from(el.querySelectorAll('h3')).find((x) => /NEBEN/.test(x.textContent));
    if (h) h.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(200);
  fs.writeFileSync(path.join(ZIEL, 'm5-8-fortschritt.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  console.log('Bild m5-8-fortschritt');
  await b.close();
})();
