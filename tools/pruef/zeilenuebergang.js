/* CITY V2: der Uebergang von einem Reihenhaus zum naechsten.

   HUMAN-BEFUND: beim Hochklettern an einer Zeilenfassade geriet die
   Figur an der Grenze zum Nachbarhaus zwischen die beiden Gebaeude, die
   Kamera wurde in den Spalt gedrueckt und zeigte nur noch Wand.

   Die GEOMETRIE ist dabei nicht das Problem - das wurde zuerst gemessen:
   zwischen direkten Nachbarn einer Zeile ist die groesste
   Hindernis-Luecke 0,01 m, und ueber fuenf Weltkeime hinweg gibt es
   stadtweit keinen einzigen Spalt zwischen 0,02 und 0,9 m.

   Gemessen wird deshalb das VERHALTEN: die Figur wird direkt in den
   Kletterzustand gesetzt - dicht vor der Naht, auf der Schauseite des
   linken Hauses - und kriecht dann seitlich darueber. Kein Anlauf, kein
   Anlegen: sonst haengt das Ergebnis daran, ob das Anlegen geklappt hat,
   und genau daran ist die erste Fassung dieses Pruefstands gescheitert
   (nur 11 von 20 Anlaeufen legten ueberhaupt an).

   Gemeldet wird je Uebergang:
     steckt         die Figur steht danach IN einem Hindernis
     wandGedreht    die Wandnormale hat sich um 90 Grad gedreht, obwohl
                    die Strassenwand geradeaus weiterlaeuft
     uebernommen    die Wand wurde an den Nachbarn weitergereicht
     abstand        Abstand der Figur zur Fassadenebene

   Aufruf:  node tools/pruef/zeilenuebergang.js [seed] [max] [alt]
   ========================================================================= */
const { starte } = require('./basis');
/* Eine Zahl oder der Standardwert - "-" und Unsinn werden NICHT zu NaN.
   Mit NaN als Weltkeim baut das Spiel eine ungeseedete Zufallsstadt, und
   der Lauf misst dann etwas anderes als gemeint. Genau das ist in einem
   Regressionslauf passiert (211 statt 221 Nachbarpaare). */
const zahl = (v, standard) => {
  const n = Number(v);
  return (v === undefined || v === '-' || v === '' || !isFinite(n)) ? standard : n;
};
const seed = zahl(process.argv[2], 4711);
const max = zahl(process.argv[3], 0);       // 0 = alle
/* "alt" schaltet die Uebergabe an den Nachbarn ab - damit misst derselbe
   Pruefstand das Verhalten vor der Korrektur. */
const alt = process.argv.indexOf('alt') > 0;
/* Vergleichslauf ohne die Tiefenkarte der sichtbaren Fassade. */
const fassAlt = process.argv.indexOf('fassAlt') > 0;

(async () => {
  const { b, page } = await starte(900, 540, seed,
    Object.assign({}, alt ? { nahtAlt: true } : {}, fassAlt ? { fassAlt: true } : {}));
  const aus = await page.evaluate(async (MAX) => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const K = d.hausKisten().filter((h) => h.zeile);

    /* Das Hindernis zu einem Haus: seine Kiste steht so in der Liste. */
    const kollVon = (h) => {
      for (const c of d.colliderNah(h.x, h.z)) {
        if (c.klein || c.innen || c.parkAuto) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - h.x) < 0.02 &&
            Math.abs((c.z0 + c.z1) / 2 - h.z) < 0.02) return c;
      }
      return null;
    };
    const inKollider = (x, y, z, ausser) => {
      for (const c of d.colliderNah(x, z)) {
        if (c === ausser || c.innen || c.parkAuto || c.klein) continue;
        const y0 = c.y0 === undefined ? 0 : c.y0;
        if (x > c.x0 + 0.01 && x < c.x1 - 0.01 &&
            z > c.z0 + 0.01 && z < c.z1 - 0.01 &&
            y > y0 + 0.01 && y < c.h - 0.01) return c;
      }
      return null;
    };

    const zeilen = new Map();
    for (const h of K) {
      if (!zeilen.has(h.zeile)) zeilen.set(h.zeile, []);
      zeilen.get(h.zeile).push(h);
    }
    const paare = [];
    for (const [key, liste] of zeilen) {
      if (liste.length < 2) continue;
      const seite = key.split('|')[2];
      const laengsX = seite === 'N' || seite === 'S';
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      liste.sort((p, q) => (laengsX ? p.x - q.x : p.z - q.z));
      for (let i = 1; i < liste.length; i++)
        paare.push({ key, seite, laengsX, nx, nz, A: liste[i - 1], B: liste[i] });
    }
    const wahl = MAX > 0 ? paare.slice(0, MAX) : paare;

    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD',
                                             'ShiftLeft','KeyZ','Space','KeyX'])
                              d.taste(t, false); };
    const faelle = [];
    for (const w of wahl) {
      const { A, B, nx, nz, laengsX } = w;
      const cA = kollVon(A), cB = kollVon(B);
      if (!cA || !cB) { faelle.push({ seite: w.seite, ohneKollider: true }); continue; }
      /* Die Naht: A endet dort, B faengt dort an. */
      const naht = laengsX ? (cA.x1 + cB.x0) / 2 : (cA.z1 + cB.z0) / 2;
      /* Die Fassadenebene, an der geklettert wird. */
      const front = nx !== 0 ? (nx > 0 ? cA.x1 : cA.x0)
                             : (nz > 0 ? cA.z1 : cA.z0);
      /* Startpunkt: 0,8 m vor der Naht, auf halber Haushoehe. */
      const y = Math.min(A.h, B.h) * 0.5;
      const laengs = naht - 0.8;
      const px = laengsX ? laengs : front + nx * 0.15;
      const pz = laengsX ? front + nz * 0.15 : laengs;
      alleAus();
      d.setzePos(px, y, pz);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col: cA };
      P.eckSperre = 0;
      P.wandUebergaenge = 0;
      /* Blick zur Fassade, damit die seitliche Taste auch seitlich
         bedeutet. */
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      /* Welche Taste fuehrt zur Naht? Zehn Bilder ausprobieren. */
      const vor = laengsX ? P.pos.x : P.pos.z;
      d.taste('KeyD', true);
      for (let i = 0; i < 10; i++) d.schritt(1 / 60);
      const jetzt = laengsX ? P.pos.x : P.pos.z;
      if ((jetzt - vor) * (naht - vor) <= 0) {
        d.taste('KeyD', false); d.taste('KeyA', true);
      }
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      alleAus();
      const endeL = laengsX ? P.pos.x : P.pos.z;
      const steckt = inKollider(P.pos.x, P.pos.y + 1.0, P.pos.z, null);
      const wandNach = P.wall ? { nx: P.wall.nx, nz: P.wall.nz } : null;
      const quer = laengsX ? P.pos.z : P.pos.x;
      const abstand = +((quer - front) * (nz || nx)).toFixed(3);
      faelle.push({
        seite: w.seite, zeile: w.key,
        nahtUeberschritten: (endeL - naht) * Math.sign(naht - vor) > 0,
        aufNachbar: !!(P.wall && P.wall.col === cB),
        uebernommen: P.wandUebergaenge > 0,
        wandGedreht: !!(wandNach && (wandNach.nx !== nx || wandNach.nz !== nz)),
        zustand: P.state,
        steckt: !!steckt,
        steckTiefe: steckt ? +Math.min(P.pos.x - steckt.x0, steckt.x1 - P.pos.x,
                                       P.pos.z - steckt.z0, steckt.z1 - P.pos.z).toFixed(2) : 0,
        abstand,
        gefallen: +(y - P.pos.y).toFixed(2),
      });
    }
    /* ================================================================
       GEGENPROBE: die echte Aussenecke muss weiter funktionieren
       ================================================================
       Die Korrektur darf nur die NAHT betreffen. Am Ende einer Zeile
       liegt die Querflaeche wirklich frei - dort gehoert der
       Eckenwechsel hin. Deshalb wird von jedem Zeilenende nach AUSSEN
       gekrochen und geprueft, dass die Wand sich dort weiterhin dreht. */
    const ecken = [];
    for (const [key, liste] of zeilen) {
      if (liste.length < 2) continue;
      const seite = key.split('|')[2];
      const laengsX = seite === 'N' || seite === 'S';
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      liste.sort((p, q) => (laengsX ? p.x - q.x : p.z - q.z));
      const E = liste[liste.length - 1];         // das letzte Haus der Zeile
      const cE = kollVon(E);
      if (!cE) continue;
      const front = nx !== 0 ? (nx > 0 ? cE.x1 : cE.x0)
                             : (nz > 0 ? cE.z1 : cE.z0);
      const aussen = laengsX ? cE.x1 : cE.z1;    // die freie Querkante
      const y = E.h * 0.5;
      const laengs = aussen - 0.8;
      alleAus();
      d.setzePos(laengsX ? laengs : front + nx * 0.15, y,
                 laengsX ? front + nz * 0.15 : laengs);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col: cE };
      P.eckSperre = 0; P.wandUebergaenge = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      const vor = laengsX ? P.pos.x : P.pos.z;
      d.taste('KeyD', true);
      for (let i = 0; i < 10; i++) d.schritt(1 / 60);
      const jetzt = laengsX ? P.pos.x : P.pos.z;
      if ((jetzt - vor) * (aussen - vor) <= 0) {
        d.taste('KeyD', false); d.taste('KeyA', true);
      }
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      alleAus();
      const wandNach = P.wall ? { nx: P.wall.nx, nz: P.wall.nz } : null;
      ecken.push({
        seite,
        gedreht: !!(wandNach && (wandNach.nx !== nx || wandNach.nz !== nz)),
        uebernommen: P.wandUebergaenge > 0,
        steckt: !!inKollider(P.pos.x, P.pos.y + 1.0, P.pos.z, null),
        zustand: P.state,
      });
    }
    return { paare: paare.length, gefahren: faelle.length, faelle, ecken };
  }, max);
  await b.close();

  const p = (s) => console.log(s);
  const F = aus.faelle.filter((f) => !f.ohneKollider);
  const z = (f) => F.filter(f).length;
  p('');
  p('== Uebergang zwischen zwei Reihenhaeusern (Keim ' + seed +
    (alt ? ', OHNE die Uebergabe an den Nachbarn' : '') + ') ==');
  p('  ' + aus.paare + ' Nachbarpaare, ' + F.length + ' abgefahren, '
    + (aus.gefahren - F.length) + ' ohne gefundenes Hindernis');
  p('');
  p('  Naht ueberschritten                 ' + z((f) => f.nahtUeberschritten));
  p('  Wand an den Nachbarn uebergeben     ' + z((f) => f.uebernommen));
  p('  klettert danach am Nachbarhaus      ' + z((f) => f.aufNachbar));
  p('  Wandnormale um 90 Grad gedreht      ' + z((f) => f.wandGedreht));
  p('  STECKT in einem Hindernis           ' + z((f) => f.steckt));
  p('  nicht mehr im Kletterzustand        ' + z((f) => f.zustand !== 'climb'));
  const ab = F.map((f) => f.abstand);
  if (ab.length) {
    ab.sort((a, b2) => a - b2);
    p('  Abstand zur Fassade   min ' + ab[0].toFixed(3)
      + '   Median ' + ab[ab.length >> 1].toFixed(3)
      + '   max ' + ab[ab.length - 1].toFixed(3));
  }
  const E = aus.ecken || [];
  p('');
  p('  Gegenprobe echte Aussenecke (Zeilenende), ' + E.length + ' Stellen:');
  p('    Wand dreht sich weiterhin          ' + E.filter((f) => f.gedreht).length);
  p('    faelschlich an Nachbarn uebergeben ' + E.filter((f) => f.uebernommen).length);
  p('    steckt in einem Hindernis          ' + E.filter((f) => f.steckt).length);
  p('    nicht mehr im Kletterzustand       ' + E.filter((f) => f.zustand !== 'climb').length);
  const losE = E.filter((f) => f.zustand !== 'climb').slice(0, 6);
  if (losE.length) {
    p('    davon im Einzelnen:');
    for (const f of losE) p('      ' + JSON.stringify(f));
  }
  const losF = F.filter((f) => f.zustand !== 'climb').slice(0, 6);
  if (losF.length) {
    p('  Naht, nicht mehr im Kletterzustand:');
    for (const f of losF) p('      ' + JSON.stringify(f));
  }
  const schlimm = F.filter((f) => f.steckt || f.wandGedreht).slice(0, 12);
  p('');
  p('  Auffaellige Faelle (' + F.filter((f) => f.steckt || f.wandGedreht).length + '):');
  if (!schlimm.length) p('    keine');
  for (const f of schlimm)
    p('    ' + (f.steckt ? 'STECKT Tiefe ' + f.steckTiefe : 'gedreht          ')
      + '  ' + f.seite + '  Zustand ' + f.zustand
      + '  Abstand ' + f.abstand + '  Zeile ' + f.zeile);
  p('');
})();
