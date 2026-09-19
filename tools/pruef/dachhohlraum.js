/* problem-1, Punkt 6: die Zwischenebene unter dem Dachgesims.

   Im Human-Video klettert Spider-Man an einer Hauswand hoch, kommt
   UNTER die vorstehende Dachkrone und haengt dort - ueber ihm eine
   sichtbare Platte, unter ihm die Wand, und weiter geht es nicht.

   Was das Haus oben hat (schmueckeHaus):

     Gesims oben    sichtbar oben-0,56 bis oben-0,01, steht VOR vor
     Hindernis      oben-0,90 bis oben, volle Breite, ABER klein:true
     Gesims unten   sichtbar oben-1,45 bis oben-0,75, steht halb so
                    weit vor - und hat GAR KEIN Hindernis

   Zwei Dinge fallen daran auf, und beide erzeugen genau das Bild:

     1. Das untere Band ragt sichtbar heraus, haelt aber nichts.
     2. Das Hindernis, das es gibt, ist als "klein" eingetragen. Die
        Kletterlogik ueberspringt kleine Hindernisse (sie sind fuer
        Laternenkoepfe und Poller gedacht). Die Figur kann also nicht
        auf die Krone uebersetzen und von dort ueber die Kante - sie
        bleibt an der Wand darunter haengen.

   Gemessen wird: von der Wand aus nach oben klettern. Kommt die Figur
   auf das Dach, oder bleibt sie unter der Krone stehen?

   Aufruf:  node tools/pruef/dachhohlraum.js [seed=4711] [alt]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;

/* ---------------------------------------------------------------------
   Der HARTE Befund: sichtbare Platte ueber dem Kopf, nichts dazwischen
   ------------------------------------------------------------------ */
async function hohlraum(page) {
  return page.evaluate(() => {
    const d = __dbg;
    const SLAB_H = 0.25;
    const kisten = d.hausKisten();
    /* Die Kletterprobe oben haengt am Verhalten und streut deshalb. Der
       Fehler aus dem Video ist aber GEOMETRIE und laesst sich ruhend
       messen: gibt es an der Wand eine Stelle, ueber der sichtbares
       Dachwerk liegt, ohne dass irgendetwas dazwischen fest ist?

       Abgetastet wird der Bereich der Dachkrone, dicht vor der Wand -
       genau dort, wo die Figur im Video haengt. */
    let hohl = 0, geprueft = 0, falscheFlaeche = 0;
    const bsp = [];
    const schritt = Math.max(1, Math.floor(kisten.length / 120));
    for (let i = 0; i < kisten.length; i += schritt) {
      const K = kisten[i];
      if (K.h < 10) continue;
      const oben = SLAB_H + K.h;
      const wandX = K.x + K.w / 2;
      /* Dicht vor der Ostwand, quer ueber die Krone. */
      for (const dy of [-1.35, -1.1, -0.85, -0.6, -0.35]) {
        const py = oben + dy;
        const px = wandX + 0.20, pz = K.z;
        geprueft++;
        /* Liegt hier sichtbares Dachwerk? dekoIm findet die Baender. */
        const sicht = d.dekoIm(px - 0.02, px + 0.02, py - 0.02, py + 0.02,
                               pz - 0.02, pz + 0.02, 0);
        if (!sicht.length) continue;
        /* Und haelt hier irgendetwas? */
        let fest = false;
        for (const c of d.colliderNah(px, pz)) {
          if (c.innen || c.parkAuto) continue;
          const y0 = c.y0 === undefined ? -1e9 : c.y0;
          if (px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1 &&
              py > y0 && py < c.h) { fest = true; break; }
        }
        if (!fest) {
          hohl++;
          if (bsp.length < 8) bsp.push({ x: +K.x.toFixed(1), z: +K.z.toFixed(1),
                                         oben: +oben.toFixed(2), y: +py.toFixed(2),
                                         sichtbar: sicht.length });
        }
      }
    }
    return { geprueft, roofCavity: hohl, falseRoofSurface: falscheFlaeche, bsp };
  });
}

(async () => {
  const { b, page } = await starte(900, 540, SEED, ALT ? { kroneAlt: true } : {});
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const P = d.player;
    const SLAB_H = 0.25;
    const kisten = d.hausKisten().filter((k) => k.h > 14 && k.h < 60);
    const kollVon = (k) => {
      for (const c of d.colliderNah(k.x, k.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - k.x) < 0.05 &&
            Math.abs((c.z0 + c.z1) / 2 - k.z) < 0.05) return c;
      }
      return null;
    };
    const schritt = Math.max(1, Math.floor(kisten.length / 40));
    let aufsDach = 0, unterKrone = 0, gefallen = 0, sonst = 0, geprueft = 0;
    const bsp = [];
    for (let i = 0; i < kisten.length && geprueft < 40; i += schritt) {
      const K = kisten[i];
      const c = kollVon(K);
      if (!c) continue;
      const oben = SLAB_H + K.h;
      /* An der Ostwand ansetzen, sechs Meter unter der Dachkante.

         Die Wand muss frei sein. Stoesst ein Nachbar an, klettert die
         Figur gar nicht erst hoch, und das hat mit der Dachkrone nichts
         zu tun - im ersten Stand dieser Pruefung waren genau solche
         Faelle die Haelfte der Beanstandungen. */
      const nx = 1, nz = 0;
      const wandX = c.x1;
      let verbaut = false;
      for (const n of d.colliderNah(wandX + 1.2, K.z)) {
        if (n === c || n.klein || n.innen || n.parkAuto || n.dachProp) continue;
        if (wandX + 1.2 > n.x0 && wandX + 1.2 < n.x1 &&
            K.z > n.z0 && K.z < n.z1 && (n.h || 0) > oben - 7) { verbaut = true; break; }
      }
      if (verbaut) continue;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      d.setzePos(wandX + 0.15, oben - 6, K.z);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col: c };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      geprueft++;
      d.taste('KeyW', true);
      /* Geht es ueberhaupt aufwaerts? Klettert die Figur in der ersten
         Sekunde nach UNTEN, stimmt die Wandnormale der Stichprobe
         nicht - auch das ist kein Befund zur Dachkrone. */
      const startY = P.pos.y;
      for (let s = 0; s < 60; s++) d.schritt(1 / 60);
      if (P.pos.y < startY + 0.5) { geprueft--; d.taste('KeyW', false); continue; }
      for (let s = 0; s < 240; s++) d.schritt(1 / 60);
      d.taste('KeyW', false);
      for (let s = 0; s < 30; s++) d.schritt(1 / 60);
      const y = P.pos.y;
      let was;
      if (y >= oben - 0.25) { aufsDach++; was = 'Dach'; }
      else if (y < oben - 8) { gefallen++; was = 'gefallen'; }
      else if (y >= oben - 2.6) { unterKrone++; was = 'unter der Krone'; }
      else { sonst++; was = 'steckengeblieben'; }
      if ((was === 'unter der Krone' || was === 'steckengeblieben') && bsp.length < 10)
        bsp.push({ was, x: +K.x.toFixed(1), z: +K.z.toFixed(1),
                   oben: +oben.toFixed(2), y: +y.toFixed(2),
                   fehlt: +(oben - y).toFixed(2), zustand: P.state });
    }
    return { geprueft, aufsDach, unterKrone, gefallen, sonst, bsp };
  });

  console.log('\n== Klettern ueber die Dachkrone (' + aus.geprueft + ' Waende) ==');
  console.log('  aufs Dach gekommen           ' + aus.aufsDach);
  console.log('  wallclimbIntoRoofVoid        ' + aus.unterKrone +
              '   (unter der Krone haengengeblieben)');
  console.log('  sonst steckengeblieben       ' + aus.sonst);
  console.log('  heruntergefallen             ' + aus.gefallen);
  if (aus.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of aus.bsp) console.log('    ' + JSON.stringify(e));
  }
  const hr = await hohlraum(page);
  console.log('\n== Sichtbares Dachwerk ohne Hindernis (' + hr.geprueft +
              ' Tastpunkte) ==');
  console.log('  roofCavity                   ' + hr.roofCavity);
  if (hr.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of hr.bsp) console.log('    ' + JSON.stringify(e));
  }
  console.log('\n  ' + hr.roofCavity + ' Beanstandungen (hart)' +
              (ALT ? '   (Stand VOR der Korrektur)' : ''));
  await b.close();
  process.exitCode = hr.roofCavity ? 1 : 0;
})();
