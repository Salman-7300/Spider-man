/* problem-2, Human-Entscheidung zu a7e1e20: Rohre und Antennen einheitlich
   nach ihrer Geometrie einstufen.

   Teil 1  Inventar aller duennen, senkrechten Dachteile (__dbg.
           duenneDachteile): Quelle, Art, Querschnitt x/z, Hoehe, Anzahl,
           Hindernis ja/nein, und die Verteilung der Querschnitte.
   Teil 2  Verhalten je Art, Anlauf quer durch das Teil mit seitlichem
           Versatz 0 / 0,15 / 0,30 / 0,45 m:
             haengt      Bilder mit gehaltener Taste, in denen die Figur
                         nicht vorankommt (weniger als 2 cm je Bild),
                         bevor sie am Teil vorbei ist
             durch       am Ende hinter dem Teil
             rumpfDurch  das Teil geht SICHTBAR durch den Rumpf: seine
                         Achse naeher an der Koerpermitte als halbe
                         Rumpfbreite plus halbe Teilbreite, auf
                         Rumpfhoehe (0,9 bis 1,5 m)
             kapsel      groesste Eindringtiefe der Kapsel (0,45 m)
   Teil 3  Bilder je Art: die Figur daneben, und im Anlauf.

   Aufruf:  node tools/pruef/duenne-dachteile.js [klasse=fest|deko] [bilder=ordner]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const kArg = process.argv.find((v) => v.indexOf('klasse=') === 0);
const KLASSE = kArg === undefined ? null : kArg.slice(7);
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, KLASSE ? { duennKlasse: KLASSE } : {});
  const aus = await page.evaluate(async (O) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const teile = d.duenneDachteile();
    /* ---- Teil 1 ---- */
    const gruppen = {};
    for (const t of teile) {
      const q = (+t.w).toFixed(2) + ' x ' + (+t.d).toFixed(2);
      const k = t.quelle + ' | ' + t.art + ' | ' + q;
      const g = gruppen[k] || (gruppen[k] = { quelle: t.quelle, art: t.art, quer: q, n: 0, hMin: 1e9, hMax: 0,
                                                mitHindernis: 0, klasse: {} });
      g.n++; g.hMin = Math.min(g.hMin, t.h); g.hMax = Math.max(g.hMax, t.h);
      if (t.hindernis) g.mitHindernis++;
      g.klasse[t.klasse] = (g.klasse[t.klasse] || 0) + 1;
    }
    /* ---- Teil 2 ---- */
    const jeArt = new Map();
    for (const t of teile) {
      if (!jeArt.has(t.art)) jeArt.set(t.art, []);
      jeArt.get(t.art).push(t);
    }
    const los = () => { for (const k of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space']) d.taste(k, false); };
    const RUMPF_HALB = 0.2, R = P.radius === undefined ? 0.45 : P.radius;
    const verhalten = {};
    const bilder = [];
    for (const [art, liste] of jeArt) {
      const schritt = Math.max(1, Math.floor(liste.length / 10));
      const v = verhalten[art] = { laeufe: 0, haengtLaeufe: 0, haengtBilder: 0, durch: 0,
                                   rumpfDurch: 0, kapselMax: 0, beispielBild: false };
      for (let i = 0, n = 0; i < liste.length && n < 10; i += schritt, n++) {
        const t = liste[i];
        const halb = Math.max(t.w, t.d) / 2;
        for (const vers of [0, 0.15, 0.3, 0.45]) {
          los();
          d.setzePos(t.x - 3, t.y0 + 0.1, t.z + vers);
          P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true; P.facing = Math.PI / 2;
          d.setzeKamYaw(-Math.PI / 2);
          for (let k = 0; k < 10; k++) d.schritt(1 / 60);
          d.taste('KeyW', true);
          let vorX = P.pos.x, haengt = 0, rumpf = false, kaps = 0, bildGemacht = false;
          for (let k = 0; k < 150; k++) {
            d.schritt(1 / 60);
            const x = P.pos.x, y = P.pos.y, z = P.pos.z;
            const vorbei = x > t.x + halb + R;
            if (k > 20 && !vorbei && x - vorX < 0.02) haengt++;
            vorX = x;
            /* Achse des Teils zur Koerpermitte, auf Rumpfhoehe */
            const ab = Math.hypot(t.x - x, t.z - z);
            const ueberlapptHoehe = t.y0 < y + 1.5 && t.y0 + t.h > y + 0.9;
            if (ueberlapptHoehe && ab < RUMPF_HALB + halb) rumpf = true;
            if (ueberlapptHoehe) kaps = Math.max(kaps, R + halb - ab);
            /* Bild im Anlauf: genau wenn das Teil am naechsten ist */
            /* ... oder, wenn die Figur davor stehen bleibt, nach einer Sekunde */
            if (O.bilder && vers === 0 && !v.beispielBild && !bildGemacht && (Math.abs(x - t.x) < 0.25 || k === 60)) {
              d.aufnahme(t.x + 0.3, y + 1.6, t.z + 3.2, t.x, y + 1.0, t.z);
              bilder.push({ name: art.replace(/[^A-Za-z]/g, '') + '-anlauf', u: d.bildDaten(0.8) });
              bildGemacht = true;
            }
          }
          los();
          v.laeufe++;
          if (haengt > 0) v.haengtLaeufe++;
          v.haengtBilder += haengt;
          if (P.pos.x > t.x + halb + 0.5) v.durch++;
          if (rumpf) v.rumpfDurch++;
          v.kapselMax = Math.max(v.kapselMax, +Math.max(0, kaps).toFixed(2));
          if (bildGemacht) v.beispielBild = true;
        }
        /* Bild daneben: Figur steht 0,7 m neben dem Teil */
        if (O.bilder && n === 0) {
          los();
          /* Figur seitlich neben dem Teil, Kamera schraeg davor - beide
             im Bild, das Teil nicht hinter der Figur. */
          d.setzePos(t.x + 0.7 + halb, t.y0 + 0.1, t.z);
          P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true; P.facing = 0;
          for (let k = 0; k < 20; k++) d.schritt(1 / 60);
          d.aufnahme(t.x + 1.6, t.y0 + 1.6, t.z + 3.6, t.x + 0.35, t.y0 + 1.1, t.z);
          bilder.push({ name: art.replace(/[^A-Za-z]/g, '') + '-daneben', u: d.bildDaten(0.8) });
        }
      }
    }
    /* ---- Teil 2b: Haengenbleiben an genau EINEM Querschnitt ----
       Auf echten Daechern stehen andere Aufbauten im Weg - dort war das
       Haengenbleiben auch ohne Hindernis gemessen. Hier ein einzelnes
       Test-Hindernis auf einem freien Dach (kein anderes Hindernis
       naeher als 6 m). */
    /* Eine freie Flaeche am Boden: kein Hindernis naeher als 6 m. Die
       Daecher sind dafuer zu dicht bestueckt. */
    const frei = (() => {
      for (let gx = -245; gx <= 245; gx += 7) for (let gz = -245; gz <= 245; gz += 7) {
        let ok = true;
        for (const c of d.colliderNah(gx, gz)) {
          if (c.innen) continue;
          const y0 = c.y0 === undefined ? -1e9 : c.y0;
          if (y0 > 3) continue;
          const dx = Math.max(c.x0 - gx, 0, gx - c.x1), dz = Math.max(c.z0 - gz, 0, gz - c.z1);
          if (Math.hypot(dx, dz) < 6) { ok = false; break; }
        }
        if (!ok) continue;
        los();
        d.setzePos(gx, 3, gz); P.vel.set(0, 0, 0); P.state = 'air'; P.onGround = false;
        for (let k = 0; k < 90; k++) d.schritt(1 / 60);
        /* am Weltrand wird die Figur zurueckgesetzt - dort nicht */
        if (P.onGround && P.pos.y < 1 && Math.hypot(P.pos.x - gx, P.pos.z - gz) < 0.05 &&
            Math.abs(gx) < 250 && Math.abs(gz) < 250) return { x: gx, z: gz, y0: P.pos.y };
      }
      return null;
    })();
    const sauber = [];
    if (frei) {
      /* das Teil selbst hat evtl. ein Hindernis - ein Stueck daneben */
      const bx = frei.x, bz = frei.z;
      for (const w of [0.18, 0.22, 0.35, 0.6]) {
        const zeile = { w, laeufe: 0, haengtLaeufe: 0, haengtBilderMittel: 0, durch: 0, rumpfDurchOhne: 0 };
        let summe = 0;
        for (const winkel of [0, 0.35]) for (const vers of [0, 0.1, 0.2, 0.3, 0.4, 0.5]) {
          const id = O.klasse === 'deko' && w < 0.6 ? null : d.testHindernis(bx, bz, w, frei.y0, 3, w < 0.6);
          los();
          const sx = bx - 3 * Math.cos(winkel), sz = bz + vers - 3 * Math.sin(winkel);
          d.setzePos(sx, frei.y0 + 0.1, sz);
          P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true;
          P.facing = Math.atan2(Math.cos(winkel), Math.sin(winkel));
          d.setzeKamYaw(P.facing + Math.PI);
          for (let k = 0; k < 10; k++) d.schritt(1 / 60);
          d.taste('KeyW', true);
          let haengt = 0, vx = P.pos.x, vz = P.pos.z, rumpf = false;
          for (let k = 0; k < 150; k++) {
            d.schritt(1 / 60);
            const weg = Math.hypot(P.pos.x - vx, P.pos.z - vz);
            vx = P.pos.x; vz = P.pos.z;
            const vorbei = (P.pos.x - bx) * Math.cos(winkel) + (P.pos.z - bz) * Math.sin(winkel) > w / 2 + R;
            if (k > 20 && !vorbei && weg < 0.02) haengt++;
            if (Math.hypot(P.pos.x - bx, P.pos.z - bz) < RUMPF_HALB + w / 2) rumpf = true;
          }
          los();
          const vorbei = (P.pos.x - bx) * Math.cos(winkel) + (P.pos.z - bz) * Math.sin(winkel) > w / 2 + R;
          zeile.laeufe++; if (haengt) zeile.haengtLaeufe++; summe += haengt;
          if (vorbei) zeile.durch++;
          if (rumpf) zeile.rumpfDurchOhne++;
          if (id !== null) d.testHindernisWeg(id);
        }
        zeile.haengtBilderMittel = +(summe / zeile.laeufe).toFixed(1);
        sauber.push(zeile);
      }
    }
    return { gesamt: teile.length, gruppen: Object.values(gruppen), verhalten, bilder, sauber,
             freiesDach: frei ? [frei.x, frei.z] : null };
  }, { bilder: !!BILDER, klasse: KLASSE });
  await b.close();
  console.log('\n== Duenne Dachteile' + (KLASSE ? ' (alle duennen Teile gezwungen: ' + KLASSE + ')' : '') + ' ==');
  console.log('\n  Teil 1: Inventar (' + aus.gesamt + ')');
  console.log('  Quelle     Art                          Querschnitt   Anzahl  Hoehe          mit Hindernis  Klasse');
  aus.gruppen.sort((p, q) => p.quer.localeCompare(q.quer));
  for (const g of aus.gruppen)
    console.log('  ' + g.quelle.padEnd(10) + ' ' + g.art.padEnd(28) + ' ' + g.quer.padEnd(12) +
                String(g.n).padStart(7) + '  ' + (g.hMin.toFixed(2) + '-' + g.hMax.toFixed(2)).padEnd(14) +
                String(g.mitHindernis).padStart(13) + '  ' + JSON.stringify(g.klasse));
  console.log('\n  Teil 2: Anlauf quer durch das Teil (je Art bis 10 Teile x 4 Versaetze)');
  console.log('  Art                          Laeufe  haengt (Laeufe/Bilder)  durch  rumpfDurch  Kapsel max');
  for (const [art, v] of Object.entries(aus.verhalten))
    console.log('  ' + art.padEnd(28) + String(v.laeufe).padStart(7) + String(v.haengtLaeufe + ' / ' + v.haengtBilder).padStart(22) +
                String(v.durch).padStart(7) + String(v.rumpfDurch).padStart(12) + String(v.kapselMax).padStart(12));
  console.log('\n  Teil 2b: ein einzelnes Test-Hindernis auf einer freien Flaeche ' + JSON.stringify(aus.freiesDach) +
              ' (Versatz 0..0,5 m, gerade und 20 Grad schraeg)');
  console.log('  Querschnitt  Laeufe  haengt  Bilder je Lauf  vorbei  Rumpf traf Achse');
  for (const z of aus.sauber)
    console.log('  ' + String(z.w).padEnd(11) + String(z.laeufe).padStart(7) + String(z.haengtLaeufe).padStart(8) +
                String(z.haengtBilderMittel).padStart(16) + String(z.durch).padStart(8) + String(z.rumpfDurchOhne).padStart(18));
  if (BILDER) for (const x of aus.bilder)
    fs.writeFileSync(path.join(BILDER, (KLASSE || 'regel') + '-' + x.name + '.jpg'), Buffer.from(x.u.split(',')[1], 'base64'));
})();
