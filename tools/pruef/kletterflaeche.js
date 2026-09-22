/* problem-2, Punkt A.2: steckt die Figur wirklich im Nachbarhaus?

   Bei Punkt A.1 blieben 58 bzw. 43 Bilder uebrig, in denen die Figur
   laut Messung IM Nachbargebaeude stand. Die beiden Kollider dort
   liegen buendig: 32 endet bei x = -305,335, 49 beginnt bei
   x = -305,330.

   Bevor daran etwas geaendert wird, ist die Frage zu klaeren, die schon
   einmal falsch beantwortet wurde: Spielfehler oder Auswahlfehler des
   Pruefstands? Der alte Stand hat die Figur DIREKT an eine Flaeche
   gesetzt - auch an eine, die ein Spieler nie erreicht.

   Hier laeuft deshalb alles ueber den echten Eingabeweg:

     1. Die Figur steht auf der Strasse vor einer freien Fassade.
     2. Sie laeuft mit Anlauf hinein - die normale Wandlauf- und
        Anklebe-Logik entscheidet, ob und woran sie haengt.
     3. Sie klettert hoch und dann seitwaerts ueber die Naehte.

   Mitgeschrieben wird, WELCHE Flaechen dabei ueberhaupt vorkommen und
   wieviel freier Platz vor jeder von ihnen liegt.

   Die Einteilung einer Schauseite nach dem freien Platz davor:

     vergraben   weniger als climbGap + Koerperradius (0,60 m) - dort
                 passt die Figur nicht hin, die Flaeche steckt im
                 Nachbarn
     eng         bis 3,6 m - Gasse, Hof, Lichtschacht
     frei        mehr

   Kennzahlen (problem-2, Punkt A.2):

     climbOnBuriedFace             Bilder, in denen die Laengslage der
                                   Figur in KEINEM freien Abschnitt der
                                   bekletterten Schauseite liegt
     exposedSurfaceViolation       Bilder mit weniger als 0,60 m Platz
                                   vor der Wand, an der Stelle der Figur
     playerInsideNeighborWhileClimbing  Bilder, in denen der Koerper in
                                   einem fremden Kollider steckt
     buriedSurfaceEntry            Uebergaenge frei -> vergraben

   "alt" misst denselben Weg mit der ganzen Kolliderseite als
   Kletterflaeche - der Stand vor Punkt A.2.

   Aufruf:  node tools/pruef/kletterflaeche.js [seed=4711] [alt]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;

(async () => {
  const { b, page } = await starte(900, 540, SEED, ALT ? { flaecheAlt: true } : {});
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25, GAP = 0.15, R = 0.45;
    const NOETIG = GAP + R;                        // 0,60 m
    const SEITEN = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    /* Wieviel freier Platz liegt vor dieser Schauseite, auf Hoehe y?

       lx/lz geben die Stelle LAENGS der Wand an. Ohne sie wird in der
       Flaechenmitte gemessen - und genau das war beim ersten Versuch
       falsch: eine Schauseite kann in der Mitte sechs Meter frei sein
       und an ihrem Ende trotzdem im Nachbarn stecken. Die Figur steht
       aber an einer bestimmten Stelle, nicht in der Mitte. */
    const freieTiefe = (c, nx, nz, y, bis, lx, lz) => {
      const weit = bis === undefined ? 6 : bis;
      const sx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0)
                          : (lx === undefined ? (c.x0 + c.x1) / 2 : lx);
      const sz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0)
                          : (lz === undefined ? (c.z0 + c.z1) / 2 : lz);
      for (let t = 0.1; t <= weit; t += 0.1) {
        const px = sx + nx * t, pz = sz + nz * t;
        for (const n of d.colliderNah(px, pz)) {
          if (n === c || !fest(n)) continue;
          const y0 = n.y0 === undefined ? -1e9 : n.y0;
          if (px > n.x0 && px < n.x1 && pz > n.z0 && pz < n.z1 &&
              y > y0 && y < (n.h || 0)) return +t.toFixed(2);
        }
      }
      return weit;
    };

    /* ---- 1. Bestandsaufnahme aller Schauseiten ---- */
    const flaechen = [];
    const nachId = new Map();
    for (const K of d.hausKisten()) {
      for (const c of d.colliderNah(K.x, K.z)) {
        if (!fest(c) || (c.h || 0) < 8 || nachId.has(c.id)) continue;
        nachId.set(c.id, c); flaechen.push(c);
      }
    }
    const klasse = { vergraben: 0, eng: 0, frei: 0 };
    const vergrabene = new Set();
    const bsp = [];
    for (const c of flaechen) {
      const y = Math.min((c.h || 0) - 1, SLAB_H + 6);
      for (const [nx, nz] of SEITEN) {
        const t = freieTiefe(c, nx, nz, y);
        if (t < NOETIG) {
          klasse.vergraben++;
          vergrabene.add(c.id + ':' + nx + ',' + nz);
          if (bsp.length < 6) bsp.push({ koll: c.id, nx, nz, tiefe: t,
                                         h: +(c.h || 0).toFixed(1) });
        } else if (t < 3.6) klasse.eng++;
        else klasse.frei++;
      }
    }

    /* ---- 2. Der echte Eingabeweg ---- */
    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };

    /* ---- Startplaetze ----
       Gesucht sind ZWEI Sorten:

       a) irgendeine Wand mit Anlauf davor - der normale Fall
       b) eine Wand, die an der Anlaufstelle frei ist und weiter
          seitlich im Nachbarn steckt. Das ist der Fall, um den es
          geht: kann die Figur von der freien Stelle aus dorthin
          kriechen?

       Ohne b) beantwortet die Messung die Frage nicht - der erste
       Versuch hat neun beliebige Waende genommen und keine einzige
       vergrabene Stelle getroffen. */
    const starts = [];
    for (const c of flaechen) {
      if (starts.length >= 14) break;
      if ((c.h || 0) < 16) continue;
      for (const [nx, nz] of SEITEN) {
        const laengsX = nz !== 0;
        const l0 = laengsX ? c.x0 : c.z0, l1 = laengsX ? c.x1 : c.z1;
        if (l1 - l0 < 4) continue;
        /* Wo ist die Wand frei, wo vergraben? In Schritten laengs. */
        let freieStelle = null, engeStelle = null;
        for (let l = l0 + 0.6; l <= l1 - 0.6; l += 0.5) {
          const t = freieTiefe(c, nx, nz, SLAB_H + 3, 9,
                               laengsX ? l : undefined, laengsX ? undefined : l);
          if (t >= 7 && freieStelle === null) freieStelle = l;
          if (t < NOETIG && engeStelle === null) engeStelle = l;
        }
        if (freieStelle === null) continue;
        const fx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : freieStelle;
        const fz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : freieStelle;
        starts.push({ koll: c.id, nx, nz, fx, fz,
                      eng: engeStelle, frei: freieStelle, laengsX });
        break;
      }
    }
    /* Die Waende mit einer vergrabenen Stelle nach vorn. */
    starts.sort((a, c2) => (c2.eng === null ? 0 : 1) - (a.eng === null ? 0 : 1));

    const laeufe = [];
    const engBsp = [], eintritte = [];
    let drinGes = 0, angeklebt = 0, drinEng = 0;
    let vergrabenGes = 0, eintrittGes = 0, eintrittTiefe = 0, ankleben = 0;
    let kroneGes = 0;
    const ankBsp = [];
    const besucht = new Map();          // koll:nx,nz -> Zahl der Bilder
    const drinBsp = [];
    for (const S of starts) {
      los();
      /* Fuenf Meter vor der Fassade, Blick darauf. */
      d.setzePos(S.fx + S.nx * 5, SLAB_H + 0.1, S.fz + S.nz * 5);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(-S.nx, -S.nz);
      d.setzeKamYaw(Math.atan2(-S.nx, -S.nz));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      /* Anlauf: rennen. Nichts wird gesetzt - die Wandlauflogik
         entscheidet selbst. */
      d.taste('ShiftLeft', true); d.taste('KeyW', true);
      let angeklebtHier = false;
      for (let i = 0; i < 150 && !angeklebtHier; i++) {
        d.schritt(1 / 60);
        if (P.state === 'climb') angeklebtHier = true;
      }
      if (!angeklebtHier) { los(); laeufe.push({ koll: S.koll, angeklebt: false }); continue; }
      angeklebt++;
      /* Hoch, dann lange seitwaerts ueber die Naehte. */
      for (let i = 0; i < 120; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', false); d.taste('KeyW', false);
      /* Auf die vergrabene Stelle ZU kriechen, wenn es eine gibt. */
      let hin = 'KeyD';
      if (S.eng !== null) {
        const jetzt = S.laengsX ? P.pos.x : P.pos.z;
        /* D bewegt entlang der Wand; welche Richtung das ist, haengt an
           der Normale. Beide probieren und die nehmen, die naeher an
           die enge Stelle fuehrt. */
        const vorher = jetzt;
        d.taste('KeyD', true);
        for (let i = 0; i < 20; i++) d.schritt(1 / 60);
        const nachher = S.laengsX ? P.pos.x : P.pos.z;
        d.taste('KeyD', false);
        const naeher = Math.abs(nachher - S.eng) < Math.abs(vorher - S.eng);
        hin = naeher ? 'KeyD' : 'KeyA';
      }
      d.taste(hin, true);
      let drin = 0, engBesucht = 0, tiefsteEng = 9;
      let vorTiefe = null, vorLage = null;
      let aufVergraben = 0, vorFrei = null, ersteLage = null;
      const flaechenHier = new Set();
      for (let i = 0; i < 600; i++) {
        d.schritt(1 / 60);
        const k = d.kletterLage();
        if (k.zustand !== 'climb' || k.koll === null) continue;
        const schl = k.koll + ':' + k.nx + ',' + k.nz;
        flaechenHier.add(schl);
        besucht.set(schl, (besucht.get(schl) || 0) + 1);
        /* ---- Die entscheidende Zahl ----
           Wieviel Platz ist vor der Wand AN DER STELLE, an der die
           Figur gerade haengt? Weniger als climbGap plus Koerperradius
           heisst: sie steht dort, wo sie nicht hinpasst. */
        const c = nachId.get(k.koll);
        /* Liegt die Figur in einem FREIEN ABSCHNITT ihrer Flaeche? */
        let istFrei = null;
        if (c) {
          const t = k.nx !== 0 ? k.pos[2] : k.pos[0];
          istFrei = d.istFrei(k.koll, k.nx, k.nz, k.pos[1] + 1.0, t);
          if (ersteLage === null) {
            ersteLage = istFrei;
            if (istFrei === false) {
              ankleben++;
              if (ankBsp.length < 6)
                ankBsp.push({ start: S.koll, koll: k.koll, nx: k.nx, nz: k.nz,
                              pos: k.pos });
            }
          }
          if (istFrei === false) {
            aufVergraben++; vergrabenGes++;
            if (vorFrei === true) {
              eintrittGes++;
              if (eintritte.length < 10)
                eintritte.push({ art: 'frei -> vergraben', vor: vorLage,
                                 nach: { koll: k.koll, nx: k.nx, nz: k.nz,
                                         pos: k.pos, tiefe: null } });
            }
          }
          vorFrei = istFrei;
        }
        let tJetzt = null;
        if (c) {
          tJetzt = freieTiefe(c, k.nx, k.nz, k.pos[1] + 0.9, 2.0,
                              k.pos[0], k.pos[2]);
          if (tJetzt < NOETIG) {
            engBesucht++; drinEng++;
            if (tJetzt < tiefsteEng) tiefsteEng = tJetzt;
            if (engBsp.length < 8)
              engBsp.push({ start: S.koll, pos: k.pos, aufKoll: k.koll,
                            nx: k.nx, nz: k.nz, tiefe: tJetzt,
                            imHaus: k.imHaus, drin: k.drinWer ? k.drinWer.id : null });
          }
        }
        /* ---- Wodurch geraet die Figur auf eine vergrabene Stelle? ----
           Der Uebergang wird festgehalten: die Lage davor, die danach,
           und ob sich dabei die Flaeche, die Normale oder nur der Ort
           geaendert hat. Ohne das laesst sich nicht entscheiden, WO ein
           Riegel hingehoert - vier Versuche an der falschen Stelle
           haben die Zahlen jedes Mal verschlechtert. */
        if (tJetzt !== null && tJetzt < NOETIG && (vorTiefe === null || vorTiefe >= NOETIG)) {
          eintrittTiefe++;
          if (eintritte.length < 10)
            eintritte.push({ vor: vorLage, nach: { koll: k.koll, nx: k.nx, nz: k.nz,
                                                   pos: k.pos, tiefe: tJetzt },
                             art: !vorLage ? 'Ankleben'
                                : vorLage.koll !== k.koll ? 'andere Flaeche'
                                : (vorLage.nx !== k.nx || vorLage.nz !== k.nz) ? 'Ecke'
                                : 'seitwaerts auf derselben Flaeche' });
        }
        vorTiefe = tJetzt;
        vorLage = { koll: k.koll, nx: k.nx, nz: k.nz, pos: k.pos, tiefe: tJetzt };
        if (k.imHaus && k.drinWer) {
          /* Die eigene Dachkrone ist kein Nachbargebaeude - sie ragt
             aus der bekletterten Fassade heraus und wird getrennt
             gezaehlt. */
          if (k.drinWer.krone || k.drinWer.eigene) kroneGes++;
          else { drin++; drinGes++; }
          if (drinBsp.length < 6)
            drinBsp.push({ start: S.koll, pos: k.pos, aufKoll: k.koll,
                           nx: k.nx, nz: k.nz, wandAbstand: k.wandAbstand,
                           drin: k.drinWer,
                           flaeche: (() => { const c2 = nachId.get(k.koll);
                             return c2 ? { x: [+c2.x0.toFixed(3), +c2.x1.toFixed(3)],
                                           z: [+c2.z0.toFixed(3), +c2.z1.toFixed(3)],
                                           h: +(c2.h || 0).toFixed(2) } : null; })() });
        }
      }
      los();
      laeufe.push({ koll: S.koll, angeklebt: true, drin, eng: S.eng !== null,
                    flaechen: flaechenHier.size, engBesucht,
                    tiefsteEng: tiefsteEng === 9 ? null : tiefsteEng });
    }

    /* Wie tief ist es vor den Flaechen, die wirklich besucht wurden? */
    const besuchtListe = [];
    for (const [schl, bilder] of besucht) {
      const [id, n] = schl.split(':');
      const [nx, nz] = n.split(',').map(Number);
      const c = nachId.get(+id);
      if (!c) { besuchtListe.push({ schl, bilder, tiefe: null }); continue; }
      const y = Math.min((c.h || 0) - 1, SLAB_H + 12);
      besuchtListe.push({ schl, bilder, tiefe: freieTiefe(c, nx, nz, y),
                          vergraben: vergrabene.has(schl) });
    }
    besuchtListe.sort((a, c) => c.bilder - a.bilder);

    return { flaechen: flaechen.length, klasse, bsp,
             starts: starts.length, angeklebt, drinGes, drinEng, engBsp,
             climbOnBuriedFace: vergrabenGes, buriedSurfaceEntry: eintrittGes,
             ankleben, ankBsp, kroneGes,
             eintrittTiefe, eintritte, laeufe,
             besucht: besuchtListe.slice(0, 20),
             besuchtGes: besuchtListe.length,
             vergrabenBesucht: besuchtListe.filter((x) => x.vergraben).length,
             drinBsp };
  });

  console.log('\n== 1. Alle Schauseiten der Stadt ==');
  console.log('  Kollider mit Schauseiten   ' + aus.flaechen);
  console.log('  davon Schauseiten frei     ' + aus.klasse.frei);
  console.log('  eng (Gasse, Hof)           ' + aus.klasse.eng);
  console.log('  VERGRABEN (unter 0,60 m)   ' + aus.klasse.vergraben);
  if (aus.bsp.length) {
    console.log('\n  Beispiele vergrabener Schauseiten:');
    for (const e of aus.bsp) console.log('    ' + JSON.stringify(e));
  }

  console.log('\n== 2. Der echte Eingabeweg ==');
  console.log('  Anlaeufe                   ' + aus.starts);
  console.log('  davon mit vergrabener Stelle auf derselben Wand: ' +
              aus.laeufe.filter((l) => l.eng).length);
  console.log('  davon angeklebt            ' + aus.angeklebt);
  console.log('  Bilder im Nachbarhaus      ' + aus.drinGes);
  console.log('  climbOnBuriedFace                  ' + aus.climbOnBuriedFace);
  console.log('  exposedSurfaceViolation            ' + aus.drinEng);
  console.log('  playerInsideNeighborWhileClimbing  ' + aus.drinGes);
  console.log('  davon eigene Dachkrone (anderer Befund): ' + aus.kroneGes);
  console.log('  buriedSurfaceEntry                 ' + aus.buriedSurfaceEntry);
  console.log('  davon schon BEIM ANKLEBEN vergraben: ' + aus.ankleben +
              ' von ' + aus.angeklebt + ' Anlaeufen');
  for (const e of (aus.ankBsp || [])) console.log('      ' + JSON.stringify(e));
  console.log('  besuchte Schauseiten       ' + aus.besuchtGes);
  console.log('  davon VERGRABEN            ' + aus.vergrabenBesucht);
  if (aus.eintritte.length) {
    console.log('\n  WODURCH geraet die Figur auf eine vergrabene Stelle?');
    for (const e of aus.eintritte)
      console.log('    ' + e.art.padEnd(32) + ' vor ' +
                  (e.vor ? e.vor.koll + ':' + e.vor.nx + ',' + e.vor.nz +
                           ' (' + e.vor.tiefe + ' m)' : '-') +
                  '  ->  ' + e.nach.koll + ':' + e.nach.nx + ',' + e.nach.nz +
                  ' (' + e.nach.tiefe + ' m)');
  }
  if (aus.engBsp.length) {
    console.log('\n  Beispiele "kein Platz vor der Wand":');
    for (const e of aus.engBsp) console.log('    ' + JSON.stringify(e));
  }
  if (aus.drinBsp.length) {
    console.log('\n  Beispiele "im Haus":');
    for (const e of aus.drinBsp) console.log('    ' + JSON.stringify(e));
  }
  console.log('\n  Meistbesuchte Schauseiten (Flaeche:Normale, Bilder, freie Tiefe):');
  for (const e of aus.besucht)
    console.log('    ' + e.schl.padEnd(16) + String(e.bilder).padStart(5) +
                '   ' + (e.tiefe === null ? '?' : e.tiefe + ' m') +
                (e.vergraben ? '   VERGRABEN' : ''));
  await b.close();
})();
