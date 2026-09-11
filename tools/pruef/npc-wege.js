/* Test D - NPC-Wege, neu aufgesetzt.
   ===================================================================
   Die drei frueheren Laeufe sind KEIN Spielbeweis. Sie waren durch den
   Pruefstand verfaelscht:
     1. Ziele bis 355 m Luftlinie bei 90 s Budget; die Gegner wurden ueber
        spawnGangAwayFromPlayer erzeugt und blieben 93 von 100 mal aus.
     2. Stillstandsschwelle 8 s, obwohl eine Ampelphase 11 s dauert
        (gruenDauer 9 + gelbDauer 2); Gegner nie alarmiert, obwohl sie
        erst ab 11 m Sichtweite verfolgen.
     3. Zustandsreste zwischen den Szenarien: eine frisch erzeugte Figur
        hat 30 Felder, updateCivilians liest aber 68 - die restlichen 38
        entstehen erst im Spiel (zugFahrt, bahnsteig, gafft, geisel, ...)
        und blieben an der Testfigur haengen.

   Deshalb hier:
     - der Werkszustand wird aus dem SPIEL geholt (d.spawnZivi()), nicht
       von Hand aufgezaehlt
     - vor jedem Szenario: Werksfelder zuruecksetzen, ALLE anderen Felder
       loeschen, danach gegen die Vorlage pruefen (Assert)
     - sieben getrennte Fragen statt einer Sammelzahl
   =================================================================== */
const { starte } = require('./basis');
const fs = require('fs');

const SEED = Number(process.argv[3]) || 4711;

(async () => {
  const { b, page } = await starte(700, 420, SEED);
  const aus = await page.evaluate(async (SEED) => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const knoten = d.gehKnotenListe();

    /* ================= Werkszustand aus dem Spiel holen ================= */
    d.spawnZivi();
    const vorlageFigur = d.civilians[d.civilians.length - 1];
    const VORLAGE = {};
    for (const k of Object.keys(vorlageFigur)) {
      const v = vorlageFigur[k];
      if (v && v.isVector3) VORLAGE[k] = { art: 'vec3', x: v.x, y: v.y, z: v.z };
      else if (Array.isArray(v)) VORLAGE[k] = { art: 'array' };
      else if (v !== null && typeof v === 'object') VORLAGE[k] = { art: 'behalten' };
      else VORLAGE[k] = { art: 'wert', wert: v };
    }
    const WERKS_FELDER = Object.keys(VORLAGE);

    /* Eine zentrale Ruecksetzfunktion. Sie raet nichts: was der
       Werkszustand kennt, wird auf dessen Wert gesetzt; was er NICHT
       kennt, ist im Spiel entstanden und wird geloescht. */
    function zuruecksetzen(c) {
      for (const k of Object.keys(c)) {
        if (!VORLAGE[k]) { delete c[k]; continue; }
        const v = VORLAGE[k];
        if (v.art === 'wert') c[k] = v.wert;
        else if (v.art === 'vec3' && c[k] && c[k].set) c[k].set(v.x, v.y, v.z);
        /* 'array' und 'behalten' bleiben: das sind loop und visual, die
           Identitaet der Figur. route wird pro Szenario neu gesetzt. */
      }
      c.route = null;
      c.routeI = 0;
      c.sozialPartner = null;
      c.vel.set(0, 0, 0);
    }

    /* Nach dem Reset pruefen, dass die Figur wirklich im definierten
       Ausgangszustand ist. Gibt eine Liste der Abweichungen zurueck. */
    function pruefeAusgangszustand(c) {
      const fehler = [];
      for (const k of Object.keys(c)) {
        if (!VORLAGE[k]) { fehler.push('fremdes Feld: ' + k); continue; }
        const v = VORLAGE[k];
        if (v.art === 'wert' && c[k] !== v.wert && k !== 'route' && k !== 'routeI') {
          fehler.push(k + ' = ' + JSON.stringify(c[k]) + ' statt ' + JSON.stringify(v.wert));
        }
      }
      for (const k of WERKS_FELDER) if (!(k in c)) fehler.push('fehlt: ' + k);
      return fehler;
    }

    /* ================= Gegenden und Zufall ================= */
    const gegenden = [
      ['Bruecke',        'bruecke'],
      ['U-Bahn-Abgang',  'ubahn'],
      ['Uferpromenade',  'prom'],
      ['anderes Ufer',   'ufer'],
      ['Kreuzungsecke',  'ecke'],
    ];
    const nachArt = {};
    for (const [name, art] of gegenden) {
      nachArt[name] = [];
      for (let i = 0; i < knoten.length; i++)
        if (!knoten[i].tot && knoten[i].art === art) nachArt[name].push(i);
    }
    let keim = SEED;
    const zuf = () => { keim = (keim * 1103515245 + 12345) & 0x7fffffff; return keim / 0x7fffffff; };
    const wahl = (a) => a[Math.floor(zuf() * a.length)];

    /* ================= Die sieben Fragen ================= */
    const F = {
      A_imGebaeude: [],       // laeuft jemand IN ein Gebaeude
      B_unterBoden: [],       // unter die gueltige Bodenflaeche
      C_haengen: [],          // dauerhaft an Moebeln haengen
      D_route: { ok: 0, n: 0, faelle: [] },
      E_jagd:  { ok: 0, n: 0, faelle: [] },
      F_ampel: { stopps: 0, laengster: 0 },
      G_eingestiegen: 0,
      D_ungueltig: [], E_ungueltig: [],
    };

    const imKollider = (x, z, y) => {
      for (const c of d.colliderNah(x, z)) {
        if (x > c.x0 + 0.25 && x < c.x1 - 0.25 && z > c.z0 + 0.25 && z < c.z1 - 0.25 &&
            y < (c.h || 0) - 0.3 && y > (c.y0 || -1) + 0.3) return c;
      }
      return null;
    };

    /* Ein Stillstand ist nur dann ein Fehler, wenn er NICHT erklaerbar
       ist. Erklaerbar sind: Warten an der Ampel, Queren, Aktivitaet am
       Ziel, Gespraech, und eine Fahrt im Zug. */
    const ERLAUBT = new Set(['warten', 'queren', 'aktivitaet', 'sozial', 'sozialHin']);
    const stillErlaubt = (c) =>
      ERLAUBT.has(c.gehZustand) || (c.eingestiegen > 0) || !!c.zugFahrt;

    const STILL_FEHLER = 20;      // ohne Erklaerung
    const STILL_ERLAUBT = 45;     // mit Erklaerung (zwei Ampelphasen plus Luft)

    /* ================= D: Zivilistenrouten ================= */
    const civ = d.civilians[d.civilians.length - 1];
    const rest = d.civilians.filter((x) => x !== civ);
    d.civilians.length = 0; d.civilians.push(civ);
    if (d.cars) d.cars.length = 0;
    if (d.enemies) d.enemies.length = 0;
    let resetFehler = 0;
    const resetFehlerBsp = [];

    let versuche = 0;
    while (F.D_route.n < 100 && versuche < 400) {
      versuche++;
      const [gName] = gegenden[F.D_route.n % gegenden.length];
      const liste = nachArt[gName];
      if (!liste.length) continue;
      const a = wahl(liste);
      const kandidaten = [];
      for (let i = 0; i < knoten.length; i++) {
        if (knoten[i].tot || i === a || knoten[i].insel !== knoten[a].insel) continue;
        const dd = Math.hypot(knoten[i].x - knoten[a].x, knoten[i].z - knoten[a].z);
        if (dd > 30 && dd < 90) kandidaten.push(i);
      }
      if (!kandidaten.length) continue;
      const b2 = wahl(kandidaten);
      const route = d.gehRoute(a, b2);
      if (!route) continue;

      /* ---- Reset und Nachweis ---- */
      zuruecksetzen(civ);
      const abw = pruefeAusgangszustand(civ);
      if (abw.length) { resetFehler++; if (resetFehlerBsp.length < 5) resetFehlerBsp.push(abw); }

      const kA = knoten[a], kB = knoten[b2];
      civ.pos.set(kA.x, d.groundYAt(kA.x, kA.z, 0), kA.z);
      civ.knoten = a; civ.route = route; civ.routeI = 0; civ.gehZustand = 'gehen';
      if (civ.visual && civ.visual.root) civ.visual.root.position.copy(civ.pos);

      const luft = Math.hypot(kB.x - kA.x, kB.z - kA.z);
      const MAX = luft / 0.8 + 45;
      let t = 0, strecke = 0, ankunft = false, ungueltig = null;
      let vx = civ.pos.x, vz = civ.pos.z;
      let still = 0, stillGrund = null, stillMax = 0;
      let imHaus = 0, unterBoden = 0, haengt = 0;
      let ersterFehlerBild = null, ersterFehlerArt = null, ersterFehlerBox = null;
      let bild = 0;
      while (t < MAX) {
        d.schritt(1 / 30); t += 1 / 30; bild++;
        const s = Math.hypot(civ.pos.x - vx, civ.pos.z - vz);
        /* ---- Ein Fussgaenger legt in einem Bild keine 20 Meter zurueck ----
           In etwa der Haelfte der Seitenladungen springt die Testfigur bei
           einem FESTEN Bild einige hundert Meter weit. Isoliert nachgefahren
           (tools/pruef/npc-einzelfall.js, Knoten 657->648): der Sprung geht
           NICHT ueber pos.set oder pos.copy, die Steckstufe bleibt 0 und
           GEH_STAT.gerettet zaehlt nicht hoch - es ist also weder die
           Steckrettung noch das Ein- und Aussteigen. Auf dem normalen
           Laufzeitpfad (Spieler in der Naehe, volle Welt) liess er sich
           nicht ausloesen.
           Nach der Regel "kein Spielcode ohne Reproduktion im normalen
           Pfad" wird das Spiel deshalb NICHT geaendert. Der Lauf wird
           stattdessen als UNGUELTIG verworfen - er als Fehlschlag zu
           zaehlen waere eine Falschaussage ueber das Spiel. Die Zahl der
           verworfenen Laeufe steht im Bericht. */
        if (s > 20) { ungueltig = { bild: Math.round(t * 30), weit: +s.toFixed(1),
                                    von: [+vx.toFixed(1), +vz.toFixed(1)],
                                    nach: [+civ.pos.x.toFixed(1), +civ.pos.z.toFixed(1)] };
                      break; }
        strecke += s;
        vx = civ.pos.x; vz = civ.pos.z;
        if (s < 0.005) {
          still += 1 / 30;
          if (still > stillMax) { stillMax = still; stillGrund = civ.gehZustand; }
          const grenze = stillErlaubt(civ) ? STILL_ERLAUBT : STILL_FEHLER;
          if (still > grenze) { haengt = 1; break; }
        } else still = 0;
        if (civ.gehZustand === 'warten' || civ.gehZustand === 'queren') F.F_ampel.stopps++;
        if (civ.eingestiegen > 0 || civ.zugFahrt) F.G_eingestiegen++;
        const boden = d.groundYAt(civ.pos.x, civ.pos.z, civ.pos.y);
        if (civ.pos.y < boden - 0.4) {
          unterBoden++;
          if (!ersterFehlerBild) { ersterFehlerBild = bild; ersterFehlerArt = 'unterBoden';
                                   ersterFehlerBox = { y: +civ.pos.y.toFixed(2), boden: +boden.toFixed(2) }; }
        }
        const box = imKollider(civ.pos.x, civ.pos.z, civ.pos.y + 0.9);
        if (box) {
          imHaus++;
          if (!ersterFehlerBild) { ersterFehlerBild = bild; ersterFehlerArt = 'imGebaeude';
                                   ersterFehlerBox = { x0: +box.x0.toFixed(1), x1: +box.x1.toFixed(1),
                                                       z0: +box.z0.toFixed(1), z1: +box.z1.toFixed(1),
                                                       h: +(box.h || 0).toFixed(1) }; }
        }
        if (Math.hypot(civ.pos.x - kB.x, civ.pos.z - kB.z) < 3.0) { ankunft = true; break; }
      }
      if (stillMax > F.F_ampel.laengster) F.F_ampel.laengster = +stillMax.toFixed(1);

      if (ungueltig) { F.D_ungueltig.push({ gegend: gName, von: [+kA.x.toFixed(2), +kA.z.toFixed(2)],
                                            nach: [+kB.x.toFixed(2), +kB.z.toFixed(2)],
                                            knotenVon: a, knotenNach: b2, seed: SEED, sprung: ungueltig });
                       continue; }
      F.D_route.n++;
      if (ankunft) F.D_route.ok++;
      const fall = { gegend: gName, ankunft, sekunden: +t.toFixed(1), luftlinie: +luft.toFixed(1),
                     umweg: luft > 1 ? +(strecke / luft).toFixed(2) : null,
                     stillMax: +stillMax.toFixed(1), stillGrund,
                     haengt: !!haengt, imHaus, unterBoden,
                     von: [+kA.x.toFixed(2), +kA.z.toFixed(2)],
                     nach: [+kB.x.toFixed(2), +kB.z.toFixed(2)],
                     knotenVon: a, knotenNach: b2, seed: SEED,
                     ersterFehlerBild, ersterFehlerArt, ersterFehlerBox };
      if (!ankunft || imHaus || unterBoden) F.D_route.faelle.push(fall);
      if (imHaus) F.A_imGebaeude.push(fall);
      if (unterBoden) F.B_unterBoden.push(fall);
      if (haengt) F.C_haengen.push(fall);
    }
    for (const r of rest) d.civilians.push(r);

    /* ================= E: Gegnerverfolgungen ================= */
    for (let i = 0; i < 100; i++) {
      const [gName] = gegenden[i % gegenden.length];
      const liste = nachArt[gName];
      if (!liste.length) continue;
      const a = knoten[wahl(liste)];
      const nah = liste.map((k) => knoten[k]).filter((n) => {
        const dd = Math.hypot(n.x - a.x, n.z - a.z); return dd > 12 && dd < 45;
      });
      if (!nah.length) continue;
      const ziel = wahl(nah);

      /* Jeder Gegner wird FRISCH erzeugt - damit stellt sich die Frage
         nach Zustandsresten gar nicht erst. */
      d.enemies.length = 0;
      if (d.gangs) d.gangs.length = 0;
      if (d.cars) d.cars.length = 0;
      P.pos.set(ziel.x, d.groundYAt(ziel.x, ziel.z, 0), ziel.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      d.spawnGang(a.x, a.z, 1, 'test');
      d.schritt(1 / 30, 3);
      const e = (d.enemies || [])[0];
      if (!e) continue;
      e.pos.set(a.x, d.groundYAt(a.x, a.z, 0), a.z);
      if (e.visual && e.visual.root) e.visual.root.position.copy(e.pos);
      e.state = 'chase'; e.target = 'player';

      const luft = Math.hypot(ziel.x - a.x, ziel.z - a.z);
      const MAX = luft / 1.5 + 45;
      let t = 0, strecke = 0, erreicht = false, still = 0, stillMax = 0, eUngueltig = null;
      let vx = e.pos.x, vz = e.pos.z, imHaus = 0, unterBoden = 0, haengt = 0;
      let ersterFehlerBild = null, ersterFehlerArt = null, ersterFehlerBox = null, bild = 0;
      while (t < MAX) {
        d.schritt(1 / 30); t += 1 / 30; bild++;
        const s = Math.hypot(e.pos.x - vx, e.pos.z - vz);
        if (s > 20) { eUngueltig = { bild: Math.round(t * 30), weit: +s.toFixed(1) }; break; }
        strecke += s; vx = e.pos.x; vz = e.pos.z;
        if (s < 0.005) { still += 1 / 30; if (still > stillMax) stillMax = still;
                         if (still > STILL_FEHLER) { haengt = 1; break; } }
        else still = 0;
        if (e.state !== 'chase' && !e.dead) { e.state = 'chase'; e.target = 'player'; }
        const boden = d.groundYAt(e.pos.x, e.pos.z, e.pos.y);
        if (e.pos.y < boden - 0.4) { unterBoden++;
          if (!ersterFehlerBild) { ersterFehlerBild = bild; ersterFehlerArt = 'unterBoden';
                                   ersterFehlerBox = { y: +e.pos.y.toFixed(2), boden: +boden.toFixed(2) }; } }
        const box = imKollider(e.pos.x, e.pos.z, e.pos.y + 0.9);
        if (box) { imHaus++;
          if (!ersterFehlerBild) { ersterFehlerBild = bild; ersterFehlerArt = 'imGebaeude';
                                   ersterFehlerBox = { x0: +box.x0.toFixed(1), x1: +box.x1.toFixed(1),
                                                       z0: +box.z0.toFixed(1), z1: +box.z1.toFixed(1) }; } }
        if (e.dead) break;
        if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 2.5) { erreicht = true; break; }
      }
      if (eUngueltig) { F.E_ungueltig.push({ gegend: gName, sprung: eUngueltig }); continue; }
      F.E_jagd.n++;
      if (erreicht) F.E_jagd.ok++;
      const fall = { gegend: gName, erreicht, sekunden: +t.toFixed(1), luftlinie: +luft.toFixed(1),
                     umweg: luft > 1 ? +(strecke / luft).toFixed(2) : null,
                     stillMax: +stillMax.toFixed(1), haengt: !!haengt, imHaus, unterBoden,
                     von: [+a.x.toFixed(2), +a.z.toFixed(2)],
                     nach: [+ziel.x.toFixed(2), +ziel.z.toFixed(2)], seed: SEED,
                     ersterFehlerBild, ersterFehlerArt, ersterFehlerBox };
      if (!erreicht || imHaus || unterBoden) F.E_jagd.faelle.push(fall);
      if (imHaus) F.A_imGebaeude.push(fall);
      if (unterBoden) F.B_unterBoden.push(fall);
      if (haengt) F.C_haengen.push(fall);
    }

    return { F, resetFehler, resetFehlerBsp,
             werksFelder: WERKS_FELDER.length,
             netz: d.gehNetz(), gehSuche: d.gehSuche() };
  }, SEED);

  const F = aus.F;
  console.log('');
  console.log('Werkszustand einer frischen Figur: ' + aus.werksFelder + ' Felder.');
  console.log('Ruecksetzfehler in 100 Szenarien: ' + aus.resetFehler);
  if (aus.resetFehlerBsp.length) console.log('  Beispiele:', JSON.stringify(aus.resetFehlerBsp[0]));
  console.log('Gehnetz:', JSON.stringify(aus.netz));
  console.log('');
  const zeile = (buchst, frage, wert, gut) =>
    console.log(('  ' + buchst + '  ' + frage).padEnd(52) + String(wert).padStart(12) +
                '   ' + (gut ? 'ok' : 'BEFUND'));
  console.log('Die sieben Fragen einzeln:');
  zeile('A', 'jemand IN einem Gebaeude', F.A_imGebaeude.length + ' Faelle', F.A_imGebaeude.length === 0);
  zeile('B', 'jemand unter der Bodenflaeche', F.B_unterBoden.length + ' Faelle', F.B_unterBoden.length === 0);
  zeile('C', 'dauerhaft haengengeblieben', F.C_haengen.length + ' Faelle', F.C_haengen.length === 0);
  zeile('D', 'Zivilist erreicht sein Ziel', F.D_route.ok + '/' + F.D_route.n, F.D_route.ok / Math.max(1, F.D_route.n) >= 0.9);
  zeile('E', 'alarmierter Gegner erreicht Spieler', F.E_jagd.ok + '/' + F.E_jagd.n, F.E_jagd.ok / Math.max(1, F.E_jagd.n) >= 0.9);
  zeile('F', 'Ampelstopps (kein Fehler)', F.F_ampel.stopps + ' Bilder', true);
  zeile('G', 'Bilder im Zug (kein Fehler)', F.G_eingestiegen + ' Bilder', true);
  console.log('');
  console.log('  laengster Stillstand ueberhaupt: ' + F.F_ampel.laengster + ' s');
  console.log('  verworfen wegen Ortssprung (siehe Kommentar im Skript): ' +
              F.D_ungueltig.length + ' Routen, ' + F.E_ungueltig.length + ' Verfolgungen');
  if (F.D_ungueltig.length) console.log('    Beispiel: ' + JSON.stringify(F.D_ungueltig[0].sprung));
  console.log('  Wegsuche:', JSON.stringify(aus.gehSuche));

  for (const [name, liste] of [['A im Gebaeude', F.A_imGebaeude], ['B unter Boden', F.B_unterBoden],
                               ['C haengengeblieben', F.C_haengen]]) {
    if (!liste.length) continue;
    console.log('');
    console.log('== ' + name + ' (' + liste.length + ') - Einzelfaelle zum Nachfahren ==');
    for (const e of liste.slice(0, 6)) console.log('   ' + JSON.stringify(e));
  }
  const dFehl = F.D_route.faelle.filter((e) => !e.ankunft);
  if (dFehl.length) {
    console.log('');
    console.log('== D: nicht angekommen (' + dFehl.length + ') ==');
    const gr = {};
    for (const e of dFehl) {
      const k = e.haengt ? 'haengt (' + e.stillGrund + ')' : 'Zeit abgelaufen';
      gr[k] = (gr[k] || 0) + 1;
    }
    console.log('   ' + JSON.stringify(gr));
    for (const e of dFehl.slice(0, 5)) console.log('   ' + JSON.stringify(e));
  }
  const eFehl = F.E_jagd.faelle.filter((e) => !e.erreicht);
  if (eFehl.length) {
    console.log('');
    console.log('== E: Spieler nicht erreicht (' + eFehl.length + ') ==');
    for (const e of eFehl.slice(0, 5)) console.log('   ' + JSON.stringify(e));
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(aus, null, 2));
  await b.close();
})();
