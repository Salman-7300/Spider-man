/* Mega-Update 1.0, M4: Bilder fuer die Human-Abnahme der begehbaren Orte.
   =========================================================================
   Echte Spielkamera, HUD sichtbar (Hinweis unten in der Mitte, Minikarte):
     m4-laden-1-tuer       vor der Ladentuer: Lampe, Hinweis "C Eckmarkt betreten"
     m4-laden-2-innen      gleich nach dem Betreten
     m4-laden-3-theke      an der Theke, Hinweis "Mit dem Inhaber sprechen"
     m4-laden-4-gang       Blick durch einen Regalgang zu den Kuehlregalen
     m4-buero-1-tuer       vor der Tuer des Kai 7
     m4-buero-2-innen      gleich nach dem Betreten (Empfang)
     m4-buero-3-warten     Wartebereich
     m4-buero-4-arbeit     Arbeitsplaetze mit sitzender Mitarbeiterin

   Aufruf:  node tools/pruef/mega-innen-bilder.js <ordner>
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ZIEL = process.argv[2];
if (!ZIEL) { console.log('Aufruf: node tools/pruef/mega-innen-bilder.js <ordner>'); process.exit(1); }

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  const { b, page } = await starte(960, 540, 4711, { frierSofort: true });
  await page.evaluate(() => {
    const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
    const h = document.getElementById('hud'); if (h) h.style.display = 'block';
    __dbg.frier(true);
    __dbg.mega.blockiere && __dbg.mega.blockiere(true);
  });
  const auf = async (name) => {
    await page.evaluate(() => { __dbg.schritt(1 / 60, 2); __dbg.zeichne(); });
    fs.writeFileSync(path.join(ZIEL, name + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 88 }));
  };
  /* Figur an einen Punkt stellen, Blick (gier) setzen, ein paar Bilder laufen lassen */
  const stelle = (x, z, gier, pitch, bilder) => page.evaluate(([x, z, gier, pitch, bilder]) => {
    const d = __dbg, P = d.player;
    d.setzePos(x, 1, z); P.pos.y = d.groundYAt(x, z);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.facing = gier; d.setzeKamYaw(gier + Math.PI); d.setzeKamPitch(pitch);
    d.schritt(1 / 60, bilder || 40);
  }, [x, z, gier, pitch, bilder]);
  const T = await page.evaluate(() => {
    const T = __dbg.mega.orteTueren();
    return { laden: T.laden, buero: T.buero };
  });
  for (const id of ['laden', 'buero']) {
    const t = T[id];
    /* 1: vor der Tuer, etwas seitlich, damit Tuer und Lampe im Bild sind */
    const lx = -t.nz, lz = t.nx;
    await stelle(t.ex + t.nx * 0.6 + lx * 0.8, t.ez + t.nz * 0.6 + lz * 0.8, Math.atan2(-t.nx, -t.nz), 0.12, 30);
    await auf('m4-' + id + '-1-tuer');
    /* hinein */
    await page.evaluate(() => { __dbg.mega.interagieren(); });
    await page.evaluate(() => { const I = __dbg.innen; for (let i = 0; i < 60 && !(I.active && !I.phase); i++) __dbg.schritt(1 / 60); __dbg.schritt(1 / 60, 30); });
    await auf('m4-' + id + '-2-innen');
    const r = await page.evaluate(() => {
      const r = __dbg.innen.raum;
      return { aktion: r.aktionen[0], start: r.spielerStart, personen: r.personen, grenzen: r.grenzen };
    });
    if (id === 'laden') {
      /* 3: an der Theke, Blick zum Inhaber */
      const ih = r.personen.find((p) => p.rolle === 'inhaber');
      await stelle(r.aktion.x - 1.2, r.aktion.z + 1.3, Math.atan2(ih.x - (r.aktion.x - 1.2), ih.z - (r.aktion.z + 1.3)), 0.1, 20);
      await stelle(r.aktion.x, r.aktion.z, Math.atan2(ih.x - r.aktion.x, ih.z - r.aktion.z) - 0.35, 0.1, 30);
      await auf('m4-laden-3-theke');
      /* 4: Blick durch den Gang zwischen den Regalen nach Norden */
      await stelle(r.start.x + 3.2, r.start.z - 2.0, Math.PI, 0.1, 30);
      await auf('m4-laden-4-gang');
    } else {
      /* 3: Wartebereich, Blick nach Westen */
      await stelle(r.start.x - 2.5, r.start.z - 1.0, -Math.PI / 2 - 0.25, 0.12, 30);
      await auf('m4-buero-3-warten');
      /* 4: Arbeitsplaetze, Blick nach Nordosten */
      await stelle(r.start.x + 2.5, r.start.z - 1.5, Math.PI * 0.82, 0.12, 30);
      await auf('m4-buero-4-arbeit');
    }
    await page.evaluate(() => { __dbg.innenSofortRaus(); __dbg.schritt(1 / 60, 10); });
  }
  await b.close();
  console.log('fertig');
})();
