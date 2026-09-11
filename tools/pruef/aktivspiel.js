/* Test A - 30 Minuten aktives Spiel.
   Ausdruecklich KEIN Kreis-Bot. Der Auftrag verlangt einen Spieler, der
   wirklich schwingt, klettert, laeuft, Verbrechen erledigt, Aktivitaeten
   besucht, U-Bahn faehrt, kaempft und Polizei/Rettung erlebt.

   Der Bot hier arbeitet deshalb nach einem Drehbuch aus acht Abschnitten
   und wechselt sie durch. Gemessen wird, was davon WIRKLICH passiert ist -
   nicht, was das Drehbuch vorhatte:

     schwingen     Bilder im Zustand swing
     klettern      Bilder im Zustand climb
     laufen        Bilder am Boden mit Tempo
     kaempfen      ausgefuehrte Angriffe und getroffene Gegner
     verbrechen    begonnene und beendete Ereignisse
     aktivitaeten  besuchte POI und Aktivitaeten
     u-bahn        Bilder unter Tage und Bilder im fahrenden Zug
     einsatz       gesehene Einsatzkraefte

   Dazu die Fehlerzaehler: Stuerze ins Wasser, Bilder im Haus, Bilder
   unter dem Boden, Bilder ohne Bodenkontakt trotz Bodenzustand. */
const { starte } = require('./basis');
const fs = require('fs');

(async () => {
  const { b, page } = await starte(900, 540, Number(process.argv[3]) || 4711);
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e.message).slice(0, 200)));
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const dt = 1 / 60;
    const ALLE = ['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','AltLeft',
                  'KeyZ','KeyX','KeyQ','KeyE','KeyF','KeyR','KeyG'];
    const frei = () => { for (const t of ALLE) d.taste(t, false); };

    const Z = { bilder: 0, swing: 0, climb: 0, kante: 0, zip: 0, air: 0, ground: 0,
                laufBilder: 0, gleitBilder: 0, wandlauf: 0,
                angriffe: 0, treffer: 0, gegnerBesiegt: 0,
                evBegonnen: 0, evBeendet: 0, poiBesucht: 0, aktBesucht: 0,
                unterTage: 0, imZug: 0, einsatzBilder: 0, bossBilder: 0,
                imWasser: 0, imHaus: 0, unterBoden: 0, gestorben: 0,
                punkte: 0, stufe: 0 };
    const gesehen = { ev: new Set(), poi: new Set(), akt: new Set() };
    const zustaende = {};

    const imKollider = (x, z, y) => {
      for (const c of d.colliderNah(x, z)) {
        if (x > c.x0 + 0.2 && x < c.x1 - 0.2 && z > c.z0 + 0.2 && z < c.z1 - 0.2 &&
            y < (c.h || 0) - 0.3 && y > (c.y0 || -1) + 0.3) return true;
      }
      return false;
    };

    /* ---- Die acht Abschnitte des Drehbuchs ---- */
    const drehbuch = [
      /* 1. Schwingen ueber die Stadt */
      (s) => { frei(); d.taste('KeyW', true); d.taste('Space', true);
               if (s % 300 === 0) d.setzeKamYaw(Math.random() * Math.PI * 2); },
      /* 2. Laufen und sprinten auf der Strasse */
      (s) => { frei(); d.taste('KeyW', true); d.taste('ShiftLeft', true);
               if (s % 180 === 0) d.setzeKamYaw(Math.random() * Math.PI * 2); },
      /* 3. Eine Wand hinauf und aufs Dach */
      (s) => { frei(); d.taste('KeyW', true); d.taste('KeyZ', true);
               if (s === 0) d.taste('ShiftLeft', true); },
      /* 4. Zum naechsten Verbrechen und kaempfen */
      (s) => {
        frei();
        const ev = (d.evStand() || [])[0];
        if (ev) {
          const dx = ev.ort[0] - P.pos.x, dz = ev.ort[1] - P.pos.z;
          const w = Math.atan2(dx, dz);
          P.facing = w; d.setzeKamYaw(w + Math.PI);
          if (Math.hypot(dx, dz) > 8) { d.taste('KeyW', true); d.taste('Space', true); }
          else { d.taste('KeyW', true);
                 if (s % 24 === 0) { d.tryAttack && d.tryAttack(); Z.angriffe++; }
                 if (s % 240 === 0) { d.uppercut && d.uppercut(); } }
        } else { d.taste('KeyW', true); d.taste('Space', true); }
      },
      /* 5. Eine Aktivitaet oder einen POI besuchen */
      (s) => {
        frei();
        const liste = (d.poiListe() || []).filter((p) => !p.besucht);
        const p = liste[0];
        if (p) {
          const w = Math.atan2(p.x - P.pos.x, p.z - P.pos.z);
          P.facing = w; d.setzeKamYaw(w + Math.PI);
          d.taste('KeyW', true);
          if (Math.hypot(p.x - P.pos.x, p.z - P.pos.z) > 15) d.taste('Space', true);
        } else d.taste('KeyW', true);
      },
      /* 6. U-Bahn: hinunter und mitfahren */
      (s) => {
        frei();
        if (s === 0) {
          const st = (d.ubahnen() || [])[Math.floor(Math.random() * (d.ubahnen() || []).length)];
          if (st) { d.setzePos(st.x, -8.6, (st.dz || 0) + 24);
                    P.state = 'ground'; P.onGround = true; }
        }
        d.taste('KeyW', true);
      },
      /* 7. Netz-Zug und Sprungkette */
      (s) => {
        frei(); d.taste('KeyW', true);
        if (s % 120 === 0) d.webZip && d.webZip();
        if (s % 120 === 40) d.tippeSprung && d.tippeSprung();
      },
      /* 8. Fallen und gleiten */
      (s) => {
        frei();
        if (s === 0) { P.pos.y += 60; P.state = 'air'; P.onGround = false; }
        d.taste('KeyW', true); d.taste('ShiftLeft', true);
      },
    ];

    const ABSCHNITT = 60 * 135;              // 2 min 15 s je Abschnitt
    const GESAMT = 30 * 60 * 60;             // 30 Minuten
    let vorPunkte = 0, vorGegner = 0, vorEv = 0;
    for (let i = 0; i < GESAMT; i++) {
      const nr = Math.floor(i / ABSCHNITT) % drehbuch.length;
      drehbuch[nr](i % ABSCHNITT);
      d.schritt(dt);
      Z.bilder++;

      zustaende[P.state] = (zustaende[P.state] || 0) + 1;
      if (P.state === 'swing') Z.swing++;
      if (P.state === 'climb') { Z.climb++; if (P.wandModus === 'lauf') Z.wandlauf++; }
      if (P.state === 'kante') Z.kante++;
      if (P.state === 'zip') Z.zip++;
      if (P.state === 'air') Z.air++;
      if (P.state === 'ground') { Z.ground++;
        if (Math.hypot(P.vel.x, P.vel.z) > 2) Z.laufBilder++; }
      if (P.gleiten) Z.gleitBilder++;

      if (P.pos.y < -5) Z.unterTage++;
      if (d.inWasser && d.inWasser(P.pos.x, P.pos.z) && P.pos.y < 0) Z.imWasser++;
      if (imKollider(P.pos.x, P.pos.z, P.pos.y + 0.9)) Z.imHaus++;
      const boden = d.groundYAt(P.pos.x, P.pos.z, P.pos.y);
      if (P.pos.y < boden - 0.6) Z.unterBoden++;
      if (P.dead) Z.gestorben++;

      if (i % 30 === 0) {
        const st = d.progStand ? d.progStand() : null;
        if (st) { Z.punkte = st.punkte; Z.stufe = st.stufe; }
        for (const e of (d.evStand() || [])) if (!gesehen.ev.has(e.id)) {
          gesehen.ev.add(e.id); Z.evBegonnen++;
        }
        for (const p of (d.poiListe() || [])) if (p.besucht && !gesehen.poi.has(p.id)) {
          gesehen.poi.add(p.id); Z.poiBesucht++;
        }
        for (const a of (d.aktListe() || [])) if (!gesehen.akt.has(a.id)) {
          gesehen.akt.add(a.id); Z.aktBesucht++;
        }
        const r = d.respAnzahl ? d.respAnzahl() : null;
        if (r && (r.einsaetze > 0 || r.wagen > 0)) Z.einsatzBilder++;
        if (d.bossListe && d.bossListe().length) Z.bossBilder++;
      }
      if (i % 60 === 0) {
        const zug = (d.zuegeRoh() || []).find((t) =>
          Math.abs(P.pos.x - t.x) < 25 && Math.abs(P.pos.z - t.z) < 2.0 &&
          P.pos.y < -5);
        if (zug) Z.imZug++;
      }
    }
    Z.evBeendet = d.evStatistik ? (d.evStatistik().beendet || 0) : 0;
    return { Z, zustaende, evStat: d.evStatistik ? d.evStatistik() : null,
             poiStat: d.poiStatistik ? d.poiStatistik() : null,
             aktStat: d.aktStatistik ? d.aktStatistik() : null,
             respStat: d.respStatistik ? d.respStatistik() : null,
             hyg: d.hygStatistik ? d.hygStatistik() : null };
  });

  const Z = aus.Z, B = Z.bilder || 1;
  const p = (n) => (100 * n / B).toFixed(1) + ' %';
  console.log('');
  console.log('30 Minuten aktives Spiel, ' + B + ' Bilder.');
  console.log('');
  console.log('Was wirklich passiert ist:');
  console.log('  schwingen        ' + p(Z.swing) + '   (' + Z.swing + ' Bilder)');
  console.log('  klettern         ' + p(Z.climb) + '   davon Wandlauf ' + Z.wandlauf);
  console.log('  an der Kante     ' + p(Z.kante));
  console.log('  Netz-Zug         ' + p(Z.zip));
  console.log('  in der Luft      ' + p(Z.air) + '   davon gleitend ' + Z.gleitBilder);
  console.log('  am Boden         ' + p(Z.ground) + '   davon laufend ' + Z.laufBilder);
  console.log('  unter Tage       ' + p(Z.unterTage) + '   im fahrenden Zug ' + Z.imZug);
  console.log('');
  console.log('  Angriffe         ' + Z.angriffe);
  console.log('  Verbrechen gesehen/beendet  ' + Z.evBegonnen + ' / ' + Z.evBeendet);
  console.log('  POI besucht      ' + Z.poiBesucht);
  console.log('  Aktivitaeten     ' + Z.aktBesucht);
  console.log('  Einsatzkraefte   ' + Z.einsatzBilder + ' Proben mit Einsatz');
  console.log('  Boss             ' + Z.bossBilder + ' Proben mit Boss');
  console.log('  Punkte / Stufe   ' + Z.punkte + ' / ' + Z.stufe);
  console.log('');
  console.log('Fehlerzaehler:');
  console.log('  im Wasser        ' + Z.imWasser);
  console.log('  im Haus          ' + Z.imHaus);
  console.log('  unter dem Boden  ' + Z.unterBoden);
  console.log('  gestorben        ' + Z.gestorben + ' Bilder');
  console.log('  Seitenfehler     ' + seitenFehler.length +
              (seitenFehler.length ? ': ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  console.log('');
  console.log('Zustaende:', JSON.stringify(aus.zustaende));
  if (aus.hyg) console.log('Hygiene:', JSON.stringify(aus.hyg));
  if (aus.respStat) console.log('Einsatz:', JSON.stringify(aus.respStat));
  if (process.argv[2]) fs.writeFileSync(process.argv[2],
    JSON.stringify({ aus, seitenFehler }, null, 2));
  await b.close();
})();
