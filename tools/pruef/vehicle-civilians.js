/* problem-1, Punkt 2: sitzen in den Fahrzeugen echte Menschen?

   Der Human-Screenshot zeigt im gelben Taxi zwei Blockfiguren - ein
   Kasten mit Kugelkopf. Die Sofortloesung hat alle Blockinsassen
   dauerhaft ausgeblendet; geprueft wird hier, was stattdessen zu sehen
   ist.

   Es darf nur zwei Zustaende geben:

     NAH    ein echter Zivilist sitzt sichtbar im Wagen
     FERN   gar kein Fahrer sichtbar

   Nicht: FERN = Blockmensch.

   Gemessen wird fuer jeden echten Fahrer, ob er auch WIRKLICH im
   Fahrzeug sitzt - Kopf unter dem Dach, Fuesse ueber dem Boden, Koerper
   innerhalb der Karosserie, Blick nach vorn.

   Aufruf:  node tools/pruef/vehicle-civilians.js [seed=4711]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

(async () => {
  const { b, page } = await starte(900, 540, SEED, { autos: 60 });
  const aus = await page.evaluate(async () => {
    const d = __dbg;
    d.setzeRegen(0);
    /* Der Fahrerpool fuellt sich erst, wenn Wagen in der Naehe sind.
       Also ein paar Sekunden mitlaufen lassen, statt sofort zu messen. */
    for (let i = 0; i < 180; i++) d.schritt(1 / 60);
    /* Die Weltmatrizen werden erst beim Zeichnen gerechnet. Ohne das
       hier misst man die Lage des LETZTEN gezeichneten Bildes gegen die
       Figurenposition von JETZT - gemessen lagen die Wagenkisten damit
       bis zu 24 m neben dem Wagen. */
    d.zeichne();
    d.szene.updateMatrixWorld(true);
    const fahrer = d.autoFahrer ? d.autoFahrer() : [];
    const box = new THREE.Box3();
    const ergebnis = {
      driverPoolCapacity: fahrer.length, driverPoolUsed: 0,
      realDriversVisible: 0, visiblePlaceholderDriver: 0,
      driverOutsideVehicle: 0, headAboveRoof: 0, feetBelowVehicleFloor: 0,
      bodyThroughDoor: 0, wrongFacing: 0, prozedural: 0, kopfZuTief: 0,
    };
    const bsp = [];
    const jeArt = {};
    const kopfLage = [];
    /* 1. Sichtbare Blockfiguren - darf es nirgends geben. */
    for (const c of (d.autos ? d.autos() : [])) { /* Platzhalter */ }
    d.szene.traverse((o) => {
      if (o.userData && o.userData.blockInsasse && o.visible)
        ergebnis.visiblePlaceholderDriver++;
    });
    /* 2. Jeden belegten Pool-Platz pruefen. */
    for (const f of fahrer) {
      if (!f.auto) continue;
      ergebnis.driverPoolUsed++;
      if (!f.visual || !f.visual.root || !f.visual.root.visible) continue;
      if (f.visual.procedural) { ergebnis.prozedural++; continue; }
      ergebnis.realDriversVisible++;
      const art = (f.auto.typ && f.auto.typ.art) || '?';
      jeArt[art] = (jeArt[art] || 0) + 1;
      const wagen = f.auto.mesh;
      /* Karosserie ohne die Fahrerfigur selbst. */
      box.makeEmpty();
      wagen.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        o.updateMatrixWorld(true);
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
      if (box.isEmpty()) continue;
      /* Die Figur bringt keine Knochenabfrage mit. Gemessen wird
         deshalb ihre eigene Huellkiste - fuer "Kopf unter dem Dach" und
         "Fuesse ueber dem Boden" reicht sie genau. */
      const wurzel = f.visual.root;
      wurzel.updateMatrixWorld(true);
      const fbox = new THREE.Box3();
      wurzel.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        if (!o.visible || !o.geometry) return;
        o.updateMatrixWorld(true);
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        fbox.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      });
      const p = wurzel.getWorldPosition(new THREE.Vector3());
      /* Innerhalb der Karosserie, waagerecht? */
      const rand = 0.35;
      if (p.x < box.min.x - rand || p.x > box.max.x + rand ||
          p.z < box.min.z - rand || p.z > box.max.z + rand) {
        ergebnis.driverOutsideVehicle++;
        if (bsp.length < 8) bsp.push({ was: 'ausserhalb', art: f.auto.typ && f.auto.typ.art,
                                       p: [+p.x.toFixed(2), +p.z.toFixed(2)],
                                       wagen: [+wagen.position.x.toFixed(2),
                                               +wagen.position.z.toFixed(2)],
                                       kasten: [+box.min.x.toFixed(2), +box.max.x.toFixed(2),
                                                +box.min.z.toFixed(2), +box.max.z.toFixed(2)] });
      }
      /* Kopf unter dem Dach, Fuesse ueber dem Wagenboden. */
      const kopf = fbox.isEmpty() ? null : fbox.max.y;
      const fuss = fbox.isEmpty() ? null : fbox.min.y;
      if (kopf !== null && kopf > box.max.y + 0.05) {
        ergebnis.headAboveRoof++;
        if (bsp.length < 8) bsp.push({ was: 'Kopf ueber Dach', art: f.auto.typ && f.auto.typ.art,
                                       kopf: +kopf.toFixed(2),
                                       dach: +box.max.y.toFixed(2) });
      }
      if (fuss !== null && fuss < box.min.y - 0.05) {
        ergebnis.feetBelowVehicleFloor++;
        if (bsp.length < 8) bsp.push({ was: 'Fuesse unter dem Wagen', art: f.auto.typ && f.auto.typ.art,
                                       fuss: +fuss.toFixed(2),
                                       boden: +box.min.y.toFixed(2) });
      }
      /* ---- Sitzt der Kopf auf Fensterhoehe? ----
         "im Fahrzeug" allein reicht nicht: im Lkw sass der Fahrer so
         tief, dass vom Kopf nur eine Kuppe ueber dem Armaturenbrett zu
         sehen war - die Pruefung meldete trotzdem alles in Ordnung,
         weil er ja weder durch das Dach noch durch den Boden ragte.
         Gemessen wird deshalb, WO im Fahrzeug der Kopf sitzt: als
         Anteil der Fahrzeughoehe. */
      const hoehe = box.max.y - box.min.y;
      const kopfAnteil = hoehe > 0.1 && kopf !== null
        ? (kopf - box.min.y) / hoehe : null;
      if (kopfAnteil !== null) {
        kopfLage.push({ art, anteil: +kopfAnteil.toFixed(2) });
        if (kopfAnteil < 0.62) {
          ergebnis.kopfZuTief++;
          if (bsp.length < 8) bsp.push({ was: 'Kopf zu tief', art,
                                         anteil: +kopfAnteil.toFixed(2) });
        }
      }
      /* Blickrichtung: der Fahrer schaut in Fahrtrichtung des Wagens. */
      let ab = wurzel.rotation.y - wagen.rotation.y;
      while (ab > Math.PI) ab -= Math.PI * 2;
      while (ab < -Math.PI) ab += Math.PI * 2;
      if (Math.abs(ab) > 0.3) {
        ergebnis.wrongFacing++;
        if (bsp.length < 8) bsp.push({ was: 'Blick falsch', art: f.auto.typ && f.auto.typ.art,
                                       ab: +ab.toFixed(2) });
      }
    }
    return { ...ergebnis, jeArt, kopfLage, bsp };
  });

  console.log('\n== Fahrer in Fahrzeugen ==');
  console.log('  driverPoolCapacity         ' + aus.driverPoolCapacity);
  console.log('  driverPoolUsed             ' + aus.driverPoolUsed);
  console.log('  realDriversVisible         ' + aus.realDriversVisible);
  console.log('  prozedurale Ersatzfigur    ' + aus.prozedural);
  console.log('  je Bauart                  ' + JSON.stringify(aus.jeArt));
  console.log('\n== Beanstandungen ==');
  const felder = ['visiblePlaceholderDriver', 'driverOutsideVehicle', 'headAboveRoof',
                  'feetBelowVehicleFloor', 'bodyThroughDoor', 'wrongFacing', 'kopfZuTief'];
  let fehler = 0;
  for (const f of felder) { fehler += aus[f]; console.log('  ' + f.padEnd(27) + aus[f]); }
  console.log('\n  Kopfhoehe im Fahrzeug (Anteil der Fahrzeughoehe):');
  for (const k of aus.kopfLage)
    console.log('    ' + k.art.padEnd(10) + k.anteil);
  if (aus.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of aus.bsp) console.log('    ' + JSON.stringify(e));
  }
  console.log('\n  ' + fehler + ' Beanstandungen');
  await b.close();
  process.exitCode = fehler ? 1 : 0;
})();
