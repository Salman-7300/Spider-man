/* problem-2, finaler Blocker-Pass: Ort 1 als dauerhafter Pruefstand.

   Downtown_ModernOffice_1, Kollider 1216, Seite -X. Das Modell hat an
   der Ecke z 159,9..163,59 eine Fase ueber die ganze Hoehe, die Kiste
   eine scharfe Ecke. Vorher parkte die Figur bei z 161,26: Brust und
   Becken 1,775 m vor der sichtbaren Flaeche, rechts 5,35 m nichts.

   Zwei Wege dorthin, beide ueber Tasten:
     kriechen   an der buendigen Wand ansetzen und 5 s seitlich auf die
                Fase zu kriechen
     ankleben   direkt an der schlechten Stelle ansetzen und 5 s halten
                - prueft die Fuehrung zurueck auf die tragende Flaeche

   Je Bild gemessen: Kletterzustand, Ortssprung, Rumpfabstand zur
   sichtbaren Flaeche (Becken und Brust, der kleinere zaehlt - so hat
   der Mensch Ort 2 beurteilt), Hand- und Fussabstand, Eindringen in
   eine Kiste.

   Gefunden wird das Haus ueber Modell und Lage (x0 -263,6, Ecke bei z 163,59), nicht
   ueber die laufende Nummer des Hindernisses - die verschiebt sich, wenn
   irgendwo davor ein Hindernis dazukommt oder wegfaellt (so geschehen mit
   der einheitlichen Einstufung der Dachaufbauten).

   Aufruf:  node tools/pruef/ort1-fase.js [alt] [bilder=ordner]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ALT = process.argv.indexOf('alt') > 0;
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, 4711, ALT ? { rumpfAlt: true } : {});
  await page.evaluate(() => {
    window.ORT1 = (o, K) => (o.userData.modellName || o.name) === 'Downtown_ModernOffice_1' &&
                            Math.abs(K.koll.z1 - 163.59) < 0.05 && Math.abs(K.koll.x0 + 263.6) < 0.05;
  });
  const faelle = [
    { name: 'kriechen', z: 158.4, y: 15.4, taste: 'richtung Fase' },
    { name: 'ankleben', z: 161.26, y: 16.92, taste: 'halten' },
  ];
  const ergebnis = [];
  for (const F of faelle) {
    const r = await page.evaluate(async (F) => {
      const d = __dbg, P = d.player;
      d.frier(true); d.setzeRegen(0);
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ']) d.taste(t, false);
      let obj = null, col = null;
      for (const o of d.hausModelle()) {
        const K = o.userData && o.userData.hausKiste;
        if (K && K.koll && ORT1(o, K)) { obj = o; col = K.koll; }
      }
      const RC = new THREE.Raycaster();
      const tiefe = (y, z) => {
        RC.set(new THREE.Vector3(col.x0 - 2.5, y, z), new THREE.Vector3(1, 0, 0));
        RC.near = 0; RC.far = 14;
        const tr = RC.intersectObject(obj, true);
        return tr.length ? tr[0].distance - 2.5 : 99;
      };
      d.setzePos(col.x0 - 0.15, F.y, F.z);
      P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx: -1, nz: 0, col };
      P.eckSperre = 0; P.fassGnade = 0;
      d.setzeKamYaw(Math.atan2(1, 0));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      /* Welche Taste fuehrt zur Fase (+z)? */
      let taste = null;
      if (F.taste !== 'halten') {
        const z0 = P.pos.z;
        d.taste('KeyD', true); for (let i = 0; i < 8; i++) d.schritt(1 / 60); d.taste('KeyD', false);
        taste = P.pos.z > z0 ? 'KeyD' : 'KeyA';
        d.setzePos(col.x0 - 0.15, F.y, F.z); P.vel.set(0, 0, 0); P.state = 'climb';
        P.wallInfo = P.wall = { nx: -1, nz: 0, col };
        for (let i = 0; i < 20; i++) d.schritt(1 / 60);
        d.taste(taste, true);
      }
      let vor = P.pos.clone(), vorZ = P.state;
      let wechsel = 0, maxSprung = 0, maxRumpf = 0, imHaus = 0, bilder = 0;
      let rumpfSumme = 0;
      const verlauf = [];
      for (let i = 0; i < 300; i++) {
        d.schritt(1 / 60);
        bilder++;
        if (P.state !== vorZ) wechsel++;
        vorZ = P.state;
        const sp = P.pos.distanceTo(vor); if (sp > maxSprung) maxSprung = sp;
        vor.copy(P.pos);
        const rumpf = Math.min(tiefe(P.pos.y + 0.9, P.pos.z), tiefe(P.pos.y + 1.4, P.pos.z));
        if (rumpf > maxRumpf) maxRumpf = rumpf;
        rumpfSumme += rumpf;
        const k = d.kletterLage();
        if (k.imHaus) imHaus++;
        if (i % 30 === 0) verlauf.push({ i, z: +P.pos.z.toFixed(2), y: +P.pos.y.toFixed(2),
                                         zustand: P.state, rumpf: +rumpf.toFixed(2) });
      }
      for (const t of ['KeyA','KeyD']) d.taste(t, false);
      const z = P.pos.z, y = P.pos.y;
      return {
        name: F.name, taste, zustandEnde: P.state, zustandsWechsel: wechsel,
        maxOrtsprung: +maxSprung.toFixed(3), imHaus,
        endeZ: +z.toFixed(3), endeY: +y.toFixed(2),
        rumpfEnde: +Math.min(tiefe(y + 0.9, z), tiefe(y + 1.4, z)).toFixed(3),
        rumpfMax: +maxRumpf.toFixed(3), rumpfMittel: +(rumpfSumme / bilder).toFixed(3),
        brustEnde: +tiefe(y + 1.4, z).toFixed(3), beckenEnde: +tiefe(y + 0.9, z).toFixed(3),
        handL: +tiefe(y + 1.5, z - 0.45).toFixed(3), handR: +tiefe(y + 1.5, z + 0.45).toFixed(3),
        fussL: +tiefe(y + 0.3, z - 0.15).toFixed(3), fussR: +tiefe(y + 0.3, z + 0.15).toFixed(3),
        verlauf,
      };
    }, F);
    ergebnis.push(r);
    console.log('\n== ' + r.name + (ALT ? '  (OHNE Rumpfpruefung)' : '') + ' ==');
    console.log('  Zustand am Ende ' + r.zustandEnde + '   Zustandswechsel ' + r.zustandsWechsel +
                '   groesster Ortssprung ' + r.maxOrtsprung + ' m   Bilder in einer Kiste ' + r.imHaus);
    console.log('  Ende z ' + r.endeZ + '  y ' + r.endeY);
    console.log('  Rumpf zur sichtbaren Flaeche: Ende ' + r.rumpfEnde + ' m (Becken ' + r.beckenEnde +
                ', Brust ' + r.brustEnde + ')   Mittel ' + r.rumpfMittel + '   max ' + r.rumpfMax);
    console.log('  Haende ' + r.handL + ' / ' + r.handR + '   Fuesse ' + r.fussL + ' / ' + r.fussR);
    console.log('  Verlauf ' + JSON.stringify(r.verlauf));
    if (BILDER) {
      const vor = (ALT ? 'vorher-' : 'nachher-') + r.name;
      await page.evaluate(() => { const P = __dbg.player;
        __dbg.aufnahme(P.pos.x - 3.4, P.pos.y + 1.4, P.pos.z + 2.6, P.pos.x + 0.3, P.pos.y + 1.1, P.pos.z); });
      await page.screenshot({ path: path.join(BILDER, vor + '-seite.png') });
      /* Von oben, schraeg: der Abstand Rumpf - Flaeche ist hier direkt
         zu sehen, in der Seitenansicht verschwindet er in der Tiefe. */
      await page.evaluate(() => { const P = __dbg.player;
        __dbg.aufnahme(P.pos.x - 2.2, P.pos.y + 4.2, P.pos.z - 0.6, P.pos.x + 0.6, P.pos.y + 1.1, P.pos.z + 0.4); });
      await page.screenshot({ path: path.join(BILDER, vor + '-oben.png') });
      await page.evaluate(() => __dbg.zeichne());
      await page.screenshot({ path: path.join(BILDER, vor + '-spielkamera.png') });
    }
  }
  /* Video: 5 s Kriechen auf die Fase zu, echte Spielkamera */
  if (BILDER) {
    const vdir = path.join(BILDER, (ALT ? 'vorher' : 'nachher') + '-folge');
    fs.mkdirSync(vdir, { recursive: true });
    await page.evaluate(() => {
      const d = __dbg, P = d.player;
      let col = null;
      for (const o of d.hausModelle()) { const K = o.userData && o.userData.hausKiste;
        if (K && K.koll && ORT1(o, K)) col = K.koll; }
      d.setzePos(col.x0 - 0.15, 15.4, 158.4); P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx: -1, nz: 0, col }; P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(1, 0));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
    });
    const taste = ergebnis[0].taste;
    await page.evaluate((t) => __dbg.taste(t, true), taste);
    for (let f = 0; f < 100; f++) {
      await page.evaluate(() => { for (let i = 0; i < 3; i++) __dbg.schritt(1 / 60);
        const P = __dbg.player;
        __dbg.aufnahme(P.pos.x - 3.4, P.pos.y + 1.4, P.pos.z + 2.6, P.pos.x + 0.3, P.pos.y + 1.1, P.pos.z); });
      await page.screenshot({ path: path.join(vdir, String(f).padStart(4, '0') + '.jpg'),
                              type: 'jpeg', quality: 80 });
    }
    await page.evaluate((t) => __dbg.taste(t, false), taste);
  }
  await b.close();
})();
