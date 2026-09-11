/* Test D - NPC-Hindernisse.
   100 Zivilistenrouten und 100 Gegnerverfolgungen an SCHWIERIGEN Orten:
   Bruecke, U-Bahn-Abgang, Uferpromenade, anderes Ufer, Kreuzungen mit
   viel Stadtmoebel. Nicht 200 zufaellige Punkte irgendwo, sondern die
   Stellen, an denen in frueheren Phasen wirklich Fehler sassen.

   Gemessen wird je Lauf:
     ankunft     hat er das Ziel erreicht
     sekunden    wie lange
     steckt      Bilder ohne nennenswerten Fortschritt
     imHaus      Bilder, in denen er in einem Kollider stand
     abgesackt   Bilder unter dem Boden
     umweg       gelaufene Strecke geteilt durch Luftlinie
*/
const { starte } = require('./basis');
const fs = require('fs');

(async () => {
  const { b, page } = await starte(700, 420, Number(process.argv[3]) || 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const knoten = d.gehKnotenListe();

    /* ---- Schwierige Gegenden ---- */
    const gegenden = [
      ['Bruecke',        (n) => n.art === 'bruecke'],
      ['U-Bahn-Abgang',  (n) => n.art === 'ubahn'],
      ['Uferpromenade',  (n) => n.art === 'prom'],
      ['anderes Ufer',   (n) => n.art === 'ufer'],
      ['Kreuzungsecke',  (n) => n.art === 'ecke'],
    ];
    const nachArt = {};
    for (const [name, f] of gegenden) {
      nachArt[name] = [];
      for (let i = 0; i < knoten.length; i++) if (!knoten[i].tot && f(knoten[i])) nachArt[name].push(i);
    }

    /* Reproduzierbare Zufallsfolge, damit ein Befund nachfahrbar ist. */
    let keim = 20240613;
    const zuf = () => { keim = (keim * 1103515245 + 12345) & 0x7fffffff; return keim / 0x7fffffff; };
    const wahl = (a) => a[Math.floor(zuf() * a.length)];

    const imKollider = (x, z, y) => {
      for (const c of d.colliderNah(x, z)) {
        if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 &&
            y < (c.h || 0) - 0.15 && y > (c.y0 || -1) - 0.15) return true;
      }
      return false;
    };

    /* ================= 100 Zivilistenrouten ================= */
    const civ = (d.civilians || [])[0];
    const zivErg = [];
    if (civ) {
      /* Die Welt leeren, damit niemand dazwischenlaeuft und der Befund
         eindeutig einer Route gehoert. */
      const rest = d.civilians.splice(1);
      if (d.cars) d.cars.length = 0;
      if (d.enemies) d.enemies.length = 0;

      let lauf = 0;
      while (zivErg.length < 100 && lauf < 600) {
        lauf++;
        const [gName, gFilter] = gegenden[zivErg.length % gegenden.length];
        const liste = nachArt[gName];
        if (!liste.length) continue;
        const a = wahl(liste);
        /* ---- Ein erreichbares Ziel, kein beliebiger Punkt der Karte ----
           Der erste Durchlauf zog das Ziel aus ALLEN 728 Knoten: dabei
           kamen Luftlinien bis 355 m heraus. Ein Passant geht rund
           1,4 m/s; 355 m sind vier Minuten, gemessen wurde aber 90 s.
           2 von 100 "Ankuenften" waren deshalb kein Befund ueber die
           Stadt, sondern ueber meine Stoppuhr. Jetzt: 30 bis 90 m. */
        const b2 = wahl(knoten.map((_, i) => i).filter((i) => {
          if (knoten[i].tot || i === a || knoten[i].insel !== knoten[a].insel) return false;
          const dd = Math.hypot(knoten[i].x - knoten[a].x, knoten[i].z - knoten[a].z);
          return dd > 30 && dd < 90;
        }));
        if (b2 === undefined) continue;
        const route = d.gehRoute ? d.gehRoute(a, b2) : null;
        if (!route) { zivErg.push({ gegend: gName, ankunft: false,
                                    grund: 'keine Route im Netz', von: a, nach: b2 }); continue; }

        const kA = knoten[a], kB = knoten[b2];
        civ.pos.set(kA.x, d.groundYAt(kA.x, kA.z, 0), kA.z);
        civ.knoten = a; civ.route = route; civ.routeI = 0;
        civ.gehZustand = 'gehen';
        civ.sozialPartner = null; civ.aktivT = 0;
        civ.vel && civ.vel.set && civ.vel.set(0, 0, 0);

        const luft = Math.hypot(kB.x - kA.x, kB.z - kA.z);
        let t = 0, strecke = 0, steckt = 0, imHaus = 0, abgesackt = 0;
        let vx = civ.pos.x, vz = civ.pos.z, ankunft = false;
        /* Zeit nach der Strecke bemessen, mit reichlich Zuschlag fuer
           Ampeln, Ausweichen und die kurzen Pausen am Ziel. */
        const MAX = luft / 0.8 + 40;
        /* Stillstand zaehlt erst als STECKEN, wenn er lange genug
           dauert: an einer roten Ampel zu warten ist kein Fehler. */
        let stillSeit = 0, laengsterStillstand = 0;
        while (t < MAX) {
          d.schritt(1 / 30);
          t += 1 / 30;
          const s = Math.hypot(civ.pos.x - vx, civ.pos.z - vz);
          strecke += s;
          if (s < 0.005) { stillSeit += 1 / 30;
                           if (stillSeit > laengsterStillstand) laengsterStillstand = stillSeit; }
          else stillSeit = 0;
          if (stillSeit > 8) { steckt++; break; }     // acht Sekunden ohne Schritt
          vx = civ.pos.x; vz = civ.pos.z;
          const boden = d.groundYAt(civ.pos.x, civ.pos.z, civ.pos.y);
          if (civ.pos.y < boden - 0.4) abgesackt++;
          if (imKollider(civ.pos.x, civ.pos.z, civ.pos.y + 0.9)) imHaus++;
          if (Math.hypot(civ.pos.x - kB.x, civ.pos.z - kB.z) < 3.0) { ankunft = true; break; }
        }
        zivErg.push({ gegend: gName, ankunft,
                      sekunden: +t.toFixed(1),
                      luftlinie: +luft.toFixed(1),
                      umweg: luft > 1 ? +(strecke / luft).toFixed(2) : null,
                      steckt, imHaus, abgesackt,
                      stillstand: +laengsterStillstand.toFixed(1),
                      von: [Math.round(kA.x), Math.round(kA.z)],
                      nach: [Math.round(kB.x), Math.round(kB.z)],
                      grund: ankunft ? null
                             : steckt ? 'acht Sekunden keinen Schritt'
                             : 'Zeit abgelaufen (' + MAX.toFixed(0) + ' s)' });
      }
      d.civilians.push(...rest);
    }

    /* ================= 100 Gegnerverfolgungen ================= */
    const jagdErg = [];
    const P = d.player;
    if (d.enemies) {
      for (let i = 0; i < 100; i++) {
        const [gName] = gegenden[i % gegenden.length];
        const liste = nachArt[gName];
        if (!liste.length) { jagdErg.push({ gegend: gName, erreicht: false,
                                            grund: 'keine Knoten dieser Art' }); continue; }
        const a = knoten[wahl(liste)];
        /* Der Spieler steht ein Stueck weiter auf demselben Gehnetz. */
        const nah = liste.map((k) => knoten[k])
          .filter((n) => { const dd = Math.hypot(n.x - a.x, n.z - a.z); return dd > 12 && dd < 45; });
        const ziel = nah.length ? wahl(nah) : a;

        d.enemies.length = 0;
        if (d.gangs) d.gangs.length = 0;
        if (d.cars) d.cars.length = 0;
        P.pos.set(ziel.x, d.groundYAt(ziel.x, ziel.z, 0), ziel.z);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        /* ---- Direkt aufstellen statt "irgendwo weit weg" ----
           spawnGangAwayFromPlayer sucht einen Platz 55 bis 220 m vom
           Spieler unter festen SPOTS. Im ersten Durchlauf schlug das
           93 von 100 mal fehl ("kein Gegner erzeugt") - kein Befund ueber
           die Gegner-KI, sondern ueber meinen Aufbau. */
        if (d.spawnGang) d.spawnGang(a.x, a.z, 1, 'test');
        d.schritt(1 / 30, 3);
        const e = (d.enemies || [])[0];
        if (!e) { jagdErg.push({ gegend: gName, erreicht: false,
                                 grund: 'kein Gegner erzeugt' }); continue; }
        e.pos.set(a.x, d.groundYAt(a.x, a.z, 0), a.z);
        if (e.visual && e.visual.root) e.visual.root.position.copy(e.pos);

        const luft = Math.hypot(ziel.x - a.x, ziel.z - a.z);
        let t = 0, steckt = 0, imHaus = 0, abgesackt = 0, strecke = 0, erreicht = false;
        let vx = e.pos.x, vz = e.pos.z;
        let stillSeit = 0, laengsterStillstand = 0;
        const MAX = luft / 1.5 + 40;
        while (t < MAX) {
          d.schritt(1 / 30);
          t += 1 / 30;
          const s = Math.hypot(e.pos.x - vx, e.pos.z - vz);
          strecke += s;
          if (s < 0.005) { stillSeit += 1 / 30;
                           if (stillSeit > laengsterStillstand) laengsterStillstand = stillSeit; }
          else stillSeit = 0;
          if (stillSeit > 8) { steckt++; break; }
          vx = e.pos.x; vz = e.pos.z;
          const boden = d.groundYAt(e.pos.x, e.pos.z, e.pos.y);
          if (e.pos.y < boden - 0.4) abgesackt++;
          if (imKollider(e.pos.x, e.pos.z, e.pos.y + 0.9)) imHaus++;
          if (e.dead) break;
          if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 2.5) { erreicht = true; break; }
        }
        jagdErg.push({ gegend: gName, erreicht,
                       sekunden: +t.toFixed(1), luftlinie: +luft.toFixed(1),
                       umweg: luft > 1 ? +(strecke / luft).toFixed(2) : null,
                       steckt, imHaus, abgesackt,
                       stillstand: +laengsterStillstand.toFixed(1),
                       von: [Math.round(a.x), Math.round(a.z)],
                       nach: [Math.round(ziel.x), Math.round(ziel.z)],
                       grund: erreicht ? null : e.dead ? 'Gegner gestorben'
                              : steckt ? 'acht Sekunden keinen Schritt'
                              : 'Zeit abgelaufen (' + MAX.toFixed(0) + ' s)' });
      }
    }

    return { zivErg, jagdErg, netz: d.gehNetz(),
             knotenArten: Object.fromEntries(gegenden.map(([n]) => [n, nachArt[n].length])),
             gehSuche: d.gehSuche() };
  });

  function bericht(name, liste, feld) {
    console.log('');
    console.log('=== ' + name + ' (' + liste.length + ') ===');
    const proGegend = {};
    for (const e of liste) {
      const g = proGegend[e.gegend] = proGegend[e.gegend] ||
        { n: 0, ok: 0, steckt: 0, imHaus: 0, abgesackt: 0, umwege: [], zeiten: [] };
      g.n++;
      if (e[feld]) { g.ok++; if (e.umweg) g.umwege.push(e.umweg); g.zeiten.push(e.sekunden); }
      g.steckt += e.steckt || 0;
      g.imHaus += e.imHaus || 0;
      g.abgesackt += e.abgesackt || 0;
    }
    console.log('Gegend'.padEnd(17), 'ok'.padStart(7), 'Umweg'.padStart(7),
                'Sek.'.padStart(7), 'steckt'.padStart(8), 'imHaus'.padStart(8), 'unterBoden'.padStart(11));
    const mit = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-';
    for (const [k, g] of Object.entries(proGegend)) {
      console.log(k.padEnd(17), (g.ok + '/' + g.n).padStart(7),
                  String(mit(g.umwege)).padStart(7), String(mit(g.zeiten)).padStart(7),
                  String(g.steckt).padStart(8), String(g.imHaus).padStart(8),
                  String(g.abgesackt).padStart(11));
    }
    const ok = liste.filter((e) => e[feld]).length;
    console.log('GESAMT'.padEnd(17), (ok + '/' + liste.length).padStart(7));
    const fehl = liste.filter((e) => !e[feld]);
    if (fehl.length) {
      const gruende = {};
      for (const e of fehl) gruende[e.grund || '?'] = (gruende[e.grund || '?'] || 0) + 1;
      console.log('Gruende:', JSON.stringify(gruende));
      for (const e of fehl.slice(0, 10))
        console.log('   ' + e.gegend.padEnd(16) + JSON.stringify(e.von) + ' -> ' +
                    JSON.stringify(e.nach) + '  ' + (e.grund || '') +
                    '  steckt=' + (e.steckt || 0) + ' imHaus=' + (e.imHaus || 0));
      if (fehl.length > 10) console.log('   ... und ' + (fehl.length - 10) + ' weitere');
    }
  }

  console.log('Knoten je Gegend:', JSON.stringify(aus.knotenArten));
  console.log('Gehnetz:', JSON.stringify(aus.netz));
  bericht('Zivilistenrouten', aus.zivErg, 'ankunft');
  bericht('Gegnerverfolgungen', aus.jagdErg, 'erreicht');
  console.log('');
  console.log('Wegsuche:', JSON.stringify(aus.gehSuche));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(aus, null, 2));
  await b.close();
})();
