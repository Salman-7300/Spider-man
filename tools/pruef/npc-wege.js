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
const NUR_E = process.argv.includes('nurE');

(async () => {
  const { b, page } = await starte(700, 420, SEED);
  const aus = await page.evaluate(async ([SEED, NUR_E]) => {
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
      D_fahrgast: [],         // in die U-Bahn gestiegen: kein Fehler
      D_geschlagen: [],       // von einer Gang niedergeschlagen: kein Fehler
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

    /* ---- Nebenauftraege anhalten ----
       DAS war der "Ortssprung", der diesen Pruefstand drei Laeufe lang
       begleitet hat: nach 18 Sekunden startet das Spiel seinen ersten
       Nebenauftrag. Faellt die Wahl auf 'geisel', sucht er sich den
       Zivilisten, der dem Unterschlupf einer Gang am naechsten ist, und
       setzt ihn dorthin:
           civ.pos.x = g.home.x + rand(-3, 3);
       Der Pruefstand hat die Zivilistenliste auf EINE Figur gekuerzt -
       also traf es immer die Testfigur, immer beim selben Bild (531/532),
       und immer nur dann, wenn die Wuerfel auf 'geisel' fielen. Das war
       kein Gehfehler, sondern eine Mission, die ihre Geisel holt. */
    d.setzeMissionCd(1e9);

    /* ================= D: Zivilistenrouten ================= */
    /* Der Vorgabewert aus CFG.playerHP. Der Pruefstand steigt nie auf,
       also bleibt es bei 100. */
    const SPIELER_HP = 100;
    const civ = d.civilians[d.civilians.length - 1];
    const rest = d.civilians.filter((x) => x !== civ);
    d.civilians.length = 0; d.civilians.push(civ);
    if (d.cars) d.cars.length = 0;
    if (d.enemies) d.enemies.length = 0;
    let resetFehler = 0;
    const resetFehlerBsp = [];

    let versuche = 0;
    /* Mit "nurE" bleibt die D-Schleife aus. Damit laesst sich trennen,
       ob ein Befund in Frage E aus dem Spiel kommt oder aus dem, was
       hundert vorherige Szenarien in derselben Seite hinterlassen. */
    while (!NUR_E && F.D_route.n < 100 && versuche < 400) {
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
      let t = 0, strecke = 0, ankunft = false, ungueltig = null, fahrgast = null;
      let haengtGrund = null, geschlagen = null;
      /* Wer nicht ankommt, hat dafuer einen Zustand - "flee" heisst, dass
         eine Gang ihn von der Route gejagt hat, und das ist kein
         Gehfehler. Ohne diese Aufstellung bleibt "nicht angekommen" eine
         Zahl ohne Aussage. */
      const zBilder = {}, gzBilder = {};
      let vx = civ.pos.x, vz = civ.pos.z;
      let still = 0, stillGrund = null, stillMax = 0;
      let imHaus = 0, unterBoden = 0, haengt = 0;
      let ersterFehlerBild = null, ersterFehlerArt = null, ersterFehlerBox = null;
      let bild = 0;
      while (t < MAX) {
        /* Auch hier den Spieler am Leben halten. Er steht waehrend der
           hundert Routen unbeaufsichtigt herum, und die Gangs, die das
           Spiel selbst setzt, gehen auf ihn los. Stirbt er, ruft das Spiel
           respawn() - und das versetzt ihn nach (25|25). Das aendert
           schlagartig, welche Figuren "ausser Sicht" sind. */
        if (P.hp < SPIELER_HP) P.hp = SPIELER_HP;
        if (P.dead) P.dead = false;
        d.schritt(1 / 30); t += 1 / 30; bild++;
        const s = Math.hypot(civ.pos.x - vx, civ.pos.z - vz);
        /* ---- Ein Fussgaenger legt in einem Bild keine 20 Meter zurueck ----
           Die Ursache dieser Spruenge ist gefunden und abgestellt: es war
           der Geiselauftrag, der sich die Testfigur holte (siehe oben,
           setzeMissionCd), und an den U-Bahn-Knoten die Fahrt selbst
           (jetzt getrennt gezaehlt). Seither meldet der Bericht null
           verworfene Laeufe. Diese Schranke bleibt als Fangnetz stehen:
           schlaegt sie wieder an, ist eine NEUE Quelle dazugekommen, und
           der Lauf als Fehlschlag zu zaehlen waere eine Falschaussage
           ueber das Spiel. */
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
          if (still > grenze) {
            haengt = 1;
            /* Warum sie steht, muss im Bericht stehen - sonst laesst sich
               "blockiert" nicht von "will gerade gar nicht" trennen, und
               genau daran ist die Auswertung schon zweimal gescheitert.
               festStufe zaehlt nur hoch, wenn die GEWOLLTE Geschwindigkeit
               ueber 0,6 liegt; eine Figur, die absichtlich stehenbleibt,
               wird nie geloest - und muss es auch nicht. */
            let nachbarn = 0;
            for (const c2 of d.civilians) {
              if (c2 === civ) continue;
              if (Math.hypot(c2.pos.x - civ.pos.x, c2.pos.z - civ.pos.z) < 2.5) nachbarn++;
            }
            let autoNah = 0;
            for (const car of (d.cars || [])) {
              const m = car.mesh ? car.mesh.position : car.pos;
              if (m && Math.hypot(m.x - civ.pos.x, m.z - civ.pos.z) < 6) autoNah++;
            }
            let gegnerNah = 0;
            for (const e2 of (d.enemies || [])) {
              if (Math.hypot(e2.pos.x - civ.pos.x, e2.pos.z - civ.pos.z) < 6) gegnerNah++;
            }
            haengtGrund = { gz: civ.gehZustand, zustand: civ.state || null,
                            inListe: d.civilians.indexOf(civ) >= 0,
                            pose: civ.ruhePose || null,
                            gafft: !!civ.gafft, partner: !!civ.sozialPartner,
                            geisel: !!civ.geisel, fest: civ.festStufeN || 0,
                            v: +Math.hypot(civ.vel.x, civ.vel.z).toFixed(2),
                            nachbarn, autoNah, gegnerNah,
                            ort: [+civ.pos.x.toFixed(1), +civ.pos.z.toFixed(1)] };
            break;
          }
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
        /* ---- Fahrgast geworden ist KEIN Fehler ----
           Wer in einen Treppenschacht laeuft, wird vom Spiel zum Fahrgast
           dieser Station gemacht (machZuFahrgast): sein Rundweg fuehrt ab
           dann ueber Bahnsteig und Treppe, die Gehnetzroute gilt nicht
           mehr. Das ist gewolltes Verhalten und beantwortet Frage D nicht
           mit "nein", sondern gar nicht. Es erklaert auch die grossen
           Ortswechsel an den U-Bahn-Knoten: das ist die Fahrt. */
        zBilder[civ.state || '?'] = (zBilder[civ.state || '?'] || 0) + 1;
        gzBilder[civ.gehZustand || '?'] = (gzBilder[civ.gehZustand || '?'] || 0) + 1;
        if (civ.bahnsteig !== undefined) { fahrgast = bild; break; }
        /* ---- Niedergeschlagen ist auch kein Gehfehler ----
           Waehrend der hundert Routen setzt das Spiel selbst Gangs, und
           die schlagen Passanten nieder. Wer getroffen wird, liegt 40 bis
           60 Sekunden (hurtT) und wartet gegebenenfalls auf den Rettungs-
           dienst; die Route gilt dann nicht mehr. Gemessen: ALLE zehn
           Faelle in Frage C standen auf zustand 'hurt', mit der letzten
           Fluchtgeschwindigkeit 5,2 im vel und ohne einen einzigen
           Nachbarn, ein Auto oder einen Gegner in der Naehe - es sah nur
           wie Haengenbleiben aus. */
        if (civ.state === 'hurt') { geschlagen = bild; break; }
        if (Math.hypot(civ.pos.x - kB.x, civ.pos.z - kB.z) < 3.0) { ankunft = true; break; }
      }
      if (stillMax > F.F_ampel.laengster) F.F_ampel.laengster = +stillMax.toFixed(1);

      if (ungueltig) { F.D_ungueltig.push({ gegend: gName, von: [+kA.x.toFixed(2), +kA.z.toFixed(2)],
                                            nach: [+kB.x.toFixed(2), +kB.z.toFixed(2)],
                                            knotenVon: a, knotenNach: b2, seed: SEED, sprung: ungueltig });
                       continue; }
      if (geschlagen !== null) {
        F.D_geschlagen.push({ gegend: gName, bild: geschlagen, sekunden: +t.toFixed(1),
                              von: [+kA.x.toFixed(2), +kA.z.toFixed(2)],
                              nach: [+kB.x.toFixed(2), +kB.z.toFixed(2)],
                              knotenVon: a, knotenNach: b2 });
        continue;
      }
      if (fahrgast !== null) {
        F.D_fahrgast.push({ gegend: gName, bild: fahrgast, sekunden: +t.toFixed(1),
                            von: [+kA.x.toFixed(2), +kA.z.toFixed(2)],
                            nach: [+kB.x.toFixed(2), +kB.z.toFixed(2)],
                            knotenVon: a, knotenNach: b2 });
        continue;
      }
      F.D_route.n++;
      if (ankunft) F.D_route.ok++;
      const fall = { gegend: gName, ankunft, sekunden: +t.toFixed(1), luftlinie: +luft.toFixed(1),
                     umweg: luft > 1 ? +(strecke / luft).toFixed(2) : null,
                     stillMax: +stillMax.toFixed(1), stillGrund,
                     haengt: !!haengt, haengtGrund, imHaus, unterBoden,
                     zustandBilder: zBilder, gehBilder: gzBilder,
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
      /* ---- Den SPIELER genauso zuruecksetzen wie die Figur ----
         Ohne das war Frage E jahrelang unbeantwortbar: der Spieler steht
         hundertmal mitten in einer frischen Gang, wird verpruegelt und ist
         irgendwann tot. Dann greift in updateEnemies
             if (e.target === 'player' && (player.dead || dp > 40 ...))
                 { e.state = 'patrol'; e.target = null; }
         in JEDEM Bild - ab dem Tod des Spielers scheitert jedes weitere
         Szenario, egal wie gut die Verfolgung ist. Gemessen: der Gegner
         stand danach 1419 von 1420 Bildern auf 'patrol', obwohl der
         Pruefstand ihn in jedem Bild neu alarmierte. Genau das erklaert
         auch die Streuung der alten Zahlen (10, 12 und 41 von 100 bei
         gleichem Aufruf): sie sagten nur, wann der Spieler starb. */
      P.pos.set(ziel.x, d.groundYAt(ziel.x, ziel.z, 0), ziel.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.dead = false; P.hp = SPIELER_HP;
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
      /* Der kleinste erreichte Abstand entscheidet, ob ein "nicht erreicht"
         heisst "kam nie an" oder "stand davor und schlug zu": der Gegner
         haelt im Kampf seine eigene Reichweite (2,0 bis 3,0 m), die
         Schwelle hier liegt bei 2,5 m. Ohne diese Zahl ist die Antwort auf
         Frage E nicht zu lesen. */
      let minAbstand = 1e9, nahT = 0;
      /* Wird der Gegner vom Spiel abgebaut (ABBAU_UNSICHTBAR: weiter als
         42 m weg und ausser Blick), bleibt unsere Referenz bestehen, wird
         aber nicht mehr aktualisiert - die Figur steht dann bis zum Ende
         still, ohne dass irgendetwas kaputt waere. Das muss der Bericht
         unterscheiden koennen. */
      let entferntBei = null;
      const zustandBilder = {};
      const sperrBilder = { flieht: 0, dieb: 0, rueckzug: 0, betaeubt: 0,
                            netz: 0, ausholen: 0, schlag: 0, tot: 0 };
      let vx = e.pos.x, vz = e.pos.z, imHaus = 0, unterBoden = 0, haengt = 0;
      let ersterFehlerBild = null, ersterFehlerArt = null, ersterFehlerBox = null, bild = 0;
      while (t < MAX) {
        /* Und waehrend des Szenarios am Leben halten: der Gegner kommt an
           und schlaegt zu: stirbt der Spieler dabei, ist nicht nur DIESES
           Szenario hin, sondern jedes folgende. Gefragt ist, OB er
           ankommt - nicht, wie lange der Spieler das aushaelt. */
        if (P.hp < SPIELER_HP) P.hp = SPIELER_HP;
        if (P.dead) P.dead = false;
        d.schritt(1 / 30); t += 1 / 30; bild++;
        /* HIER messen, nicht weiter unten: weiter unten ist der Zustand
           schon wieder auf 'chase' gesetzt und die Statistik waere eine
           Aufzeichnung der eigenen Nachalarmierung. */
        if (entferntBei === null && d.enemies.indexOf(e) < 0) entferntBei = bild;
        zustandBilder[e.state] = (zustandBilder[e.state] || 0) + 1;
        if (e.flieht) sperrBilder.flieht++;
        if (e.dieb) sperrBilder.dieb++;
        if ((e.rueckzugT || 0) > 0) sperrBilder.rueckzug++;
        if ((e.betaeubtT || 0) > 0) sperrBilder.betaeubt++;
        if ((e.webT || 0) > 0) sperrBilder.netz++;
        if ((e.warnT || 0) > 0) sperrBilder.ausholen++;
        if (e.attack) sperrBilder.schlag++;
        if (e.dead) sperrBilder.tot++;
        const s = Math.hypot(e.pos.x - vx, e.pos.z - vz);
        if (s > 20) { eUngueltig = { bild: Math.round(t * 30), weit: +s.toFixed(1) }; break; }
        strecke += s; vx = e.pos.x; vz = e.pos.z;
        if (s < 0.005) { still += 1 / 30; if (still > stillMax) stillMax = still;
                         if (still > STILL_FEHLER) { haengt = 1; break; } }
        else still = 0;
        /* ---- NICHT jedes Bild chase erzwingen ----
           Der vorige Lauf tat das und kam auf 0 von 91. Isoliert
           nachgefahren erreicht derselbe Gegner den Spieler problemlos -
           er wechselt dabei unterwegs nach 'suchen' und von selbst
           zurueck nach 'chase'. Das Ueberschreiben in jedem Bild hat
           genau diesen Anlauf zerstoert. Jetzt wird nur nachalarmiert,
           wenn die KI ganz auf Patrouille zurueckfaellt. */
        if (e.state === 'patrol' && !e.dead) { e.state = 'chase'; e.target = 'player'; }
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
        const dpNow = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
        if (dpNow < minAbstand) minAbstand = dpNow;
        if (dpNow < 3.2) nahT += 1 / 30;
        if (dpNow < 2.5) { erreicht = true; break; }
      }
      if (eUngueltig) { F.E_ungueltig.push({ gegend: gName, sprung: eUngueltig }); continue; }
      F.E_jagd.n++;
      if (erreicht) F.E_jagd.ok++;
      const fall = { gegend: gName, erreicht, sekunden: +t.toFixed(1), luftlinie: +luft.toFixed(1),
                     umweg: luft > 1 ? +(strecke / luft).toFixed(2) : null,
                     minAbstand: +minAbstand.toFixed(2), nahT: +nahT.toFixed(1),
                     entferntBei, zustandBilder,
                     /* Wie viele Gegner ausser unserem noch mitspielen.
                        Das Spiel setzt waehrend der 60 Sekunden eigene
                        Gangs; sind mehrere auf den Spieler angesetzt,
                        verteilt verteileAngriffsrechte Plaetze im Ring -
                        und wer keinen Platz hat, haelt Abstand. Das ist
                        gewolltes Kampfverhalten und kein Wegfehler. */
                     gegnerGesamt: d.enemies.length,
                     gegnerBeimSpieler: (d.enemies || []).filter((x) => !x.dead &&
                       Math.hypot(x.pos.x - P.pos.x, x.pos.z - P.pos.z) < 15).length,
                     sperrBilder: Object.fromEntries(
                       Object.entries(sperrBilder).filter(([, v]) => v > 0)),
                     festStufeN: e.festStufeN || 0, mut: e.mut, hp: e.hp,
                     endZustand: e.state, endZiel: e.target === 'player' ? 'spieler'
                                  : (e.target ? 'anderes' : null),
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
  }, [SEED, NUR_E]);

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
  {
    const proGegend = {};
    for (const f of F.D_fahrgast) proGegend[f.gegend] = (proGegend[f.gegend] || 0) + 1;
    console.log('  Fahrgast geworden (kein Fehler, zaehlt bei D nicht mit): ' +
                F.D_fahrgast.length +
                (F.D_fahrgast.length ? ' ' + JSON.stringify(proGegend) : ''));
  }
  {
    const proGegend = {};
    for (const f of F.D_geschlagen) proGegend[f.gegend] = (proGegend[f.gegend] || 0) + 1;
    console.log('  niedergeschlagen (kein Fehler, zaehlt bei D nicht mit): ' +
                F.D_geschlagen.length +
                (F.D_geschlagen.length ? ' ' + JSON.stringify(proGegend) : ''));
  }
  console.log('  verworfen wegen Ortssprung (siehe Kommentar im Skript): ' +
              F.D_ungueltig.length + ' Routen, ' + F.E_ungueltig.length + ' Verfolgungen');
  if (F.D_ungueltig.length) console.log('    Beispiel: ' + JSON.stringify(F.D_ungueltig[0].sprung));
  console.log('  Wegsuche:', JSON.stringify(aus.gehSuche));

  for (const [name, liste] of [['A im Gebaeude', F.A_imGebaeude], ['B unter Boden', F.B_unterBoden],
                               ['C haengengeblieben', F.C_haengen]]) {
    if (!liste.length) continue;
    console.log('');
    console.log('== ' + name + ' (' + liste.length + ') - Einzelfaelle zum Nachfahren ==');
    if (name.startsWith('C')) {
      const z = { 'abgebaut (nicht mehr aktualisiert)': 0, 'Verkehr/Ueberweg': 0,
                  'Gedraenge': 0, 'Gegner daneben': 0,
                  'gafft': 0, 'im Gespraech': 0, 'sonst': 0 };
      for (const e of liste) {
        const g = e.haengtGrund;
        if (!g) { z.sonst++; continue; }
        if (g.inListe === false) z['abgebaut (nicht mehr aktualisiert)']++;
        else if (g.gafft) z.gafft++;
        else if (g.partner) z['im Gespraech']++;
        else if (g.gz === 'warten' || g.gz === 'queren') z['Verkehr/Ueberweg']++;
        else if (g.gegnerNah > 0) z['Gegner daneben']++;
        else if (g.nachbarn >= 2 || g.autoNah > 0) z.Gedraenge++;
        else z.sonst++;
      }
      console.log('   Grund: ' + JSON.stringify(z));
    }
    for (const e of liste.slice(0, 6)) console.log('   ' + JSON.stringify(e));
  }
  const dFehl = F.D_route.faelle.filter((e) => !e.ankunft);
  if (dFehl.length) {
    console.log('');
    console.log('== D: nicht angekommen (' + dFehl.length + ') ==');
    {
      const z = { 'ueberwiegend auf der Flucht': 0, 'viel gewartet': 0, 'gelaufen': 0 };
      for (const e of dFehl) {
        const zb = e.zustandBilder || {}, gb = e.gehBilder || {};
        const ges = Object.values(zb).reduce((a, v) => a + v, 0) || 1;
        const wartet = (gb.warten || 0) + (gb.queren || 0);
        if ((zb.flee || 0) / ges > 0.3) z['ueberwiegend auf der Flucht']++;
        else if (wartet / ges > 0.3) z['viel gewartet']++;
        else z.gelaufen++;
      }
      console.log('   ' + JSON.stringify(z));
    }
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
    const m = eFehl.map((e) => e.minAbstand).sort((a, b) => a - b);
    const med = m[Math.floor(m.length / 2)];
    const inReichweite = eFehl.filter((e) => e.minAbstand < 3.2).length;
    console.log('');
    console.log('  E, kleinster erreichter Abstand der Fehlschlaege: ' +
                'Median ' + med.toFixed(2) + ' m, bester ' + m[0].toFixed(2) +
                ' m, schlechtester ' + m[m.length - 1].toFixed(2) + ' m');
    console.log('  davon naeher als 3,2 m (also in Angriffsreichweite): ' +
                inReichweite + ' von ' + eFehl.length);
    const abgebaut = eFehl.filter((e) => e.entferntBei !== null);
    const mitAnderen = eFehl.filter((e) => (e.gegnerGesamt || 1) > 1).length;
    console.log('  waehrenddessen waren weitere Gegner im Spiel (Ringplaetze): ' +
                mitAnderen + ' von ' + eFehl.length);
    console.log('  vom Spiel abgebaut (nicht mehr aktualisiert): ' +
                abgebaut.length + ' von ' + eFehl.length +
                (abgebaut.length ? ', frueheste Stelle Bild ' +
                  Math.min(...abgebaut.map((e) => e.entferntBei)) : ''));
  }
  if (eFehl.length) {
    console.log('');
    console.log('== E: Spieler nicht erreicht (' + eFehl.length + ') ==');
    for (const e of eFehl.slice(0, 5)) console.log('   ' + JSON.stringify(e));
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(aus, null, 2));
  await b.close();
})();
