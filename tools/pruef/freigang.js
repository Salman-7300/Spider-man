/* Test E - funktionale Freigaengigkeit der Stadt.
   Jeder gesetzte Gegenstand wird gegen die Flaechen geprueft, die frei
   bleiben MUESSEN, damit die Stadt benutzbar ist:

     Fahrbahn            Autos fahren dort
     Zebrastreifen       Passanten queren dort
     U-Bahn-Treppe       Abgang und Stufen
     Aufzug              Kabine und Schacht
     U-Bahn-Eingang      der Mund des Schachts an der Strasse
     Brueckenuebergang   Rampe und Uebergang Strasse/Deck
     Haustueren          Durchgang und ein Vorfeld von 1,6 m
     POI-Anker           wo eine Aktivitaet stattfindet
     Bewegungspfade      die Kanten des Gehnetzes

   Gemeldet wird JEDE Ueberschneidung mit Ort und Ueberlappung in Metern.
   Was hier gruen ist, heisst nicht "sieht gut aus" - es heisst "steht
   nichts im Weg". */
const { starte } = require('./basis');
const fs = require('fs');

(async () => {
  const { b, page } = await starte(700, 420, Number(process.argv[3]) || 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);

    /* ---- Die Gegenstaende einsammeln ---- */
    const dinge = [];
    for (const m of d.strassenMoebel()) dinge.push({ art: m.art, x: m.x, z: m.z, y: 0, r: m.r });
    for (const bk of d.bankStellen()) dinge.push({ art: 'Bank', x: bk.x, z: bk.z,
      y: bk.y || 0, r: Math.max(0.6, bk.laengsZ ? 0.6 : 1.1) });
    for (const name of d.teilArten()) {
      for (const t of d.teilStellen(name)) {
        if (dinge.some((o) => o.art === 'Poller' && Math.abs(o.x - t.x) < 0.01 &&
                              Math.abs(o.z - t.z) < 0.01)) continue;
        dinge.push({ art: name, x: t.x, z: t.z, y: t.y || 0, r: 0.5 });
      }
    }
    /* ---- Wer steht ueberhaupt auf der Strasse? ----
       Der erste Durchlauf meldete 41 Gegenstaende "auf der Fahrbahn", von
       denen die meisten Klimageraete in 19 bis 30 m Hoehe auf DAECHERN
       waren. Eine Flaeche am Boden kann nur blockiert werden von etwas,
       das am Boden steht. */
    const BODEN_MAX = 3.0;
    /* Kanaldeckel liegen FLACH IN der Fahrbahn - dort gehoeren sie hin,
       und sie versperren nichts. Sie im ersten Durchlauf als "steht auf
       der Fahrbahn" zu melden war so richtig wie nutzlos. */
    const FLACH = new Set(['Prop_ManholeCover']);
    const amBoden = dinge.filter((g) => (g.y || 0) < BODEN_MAX && !FLACH.has(g.art));
    const obenDrauf = dinge.filter((g) => (g.y || 0) >= BODEN_MAX);
    const flachDrin = dinge.filter((g) => FLACH.has(g.art));

    /* ---- Die Flaechen, die frei bleiben muessen ---- */
    const ORIGIN = -175, PITCH = 50, BLOCKS = 7, ROAD_HALF = 6;
    const RASTER_X1 = ORIGIN + BLOCKS * PITCH;          // 175
    const linien = [];
    for (let i = 0; i <= BLOCKS; i++) linien.push(ORIGIN + i * PITCH);
    /* Das Raster hoert auf. Es endet an der Uferstrasse; ab PROM_X0 = 181
       beginnt die Promenade, und ab dem Fluss gibt es gar nichts mehr.
       Der erste Durchlauf hatte die x-Strassen unbegrenzt nach Osten
       verlaengert und deshalb jede Laterne auf der Promenade bei x = 183
       als "auf der Fahrbahn" gemeldet. */
    const GITTER_MIN = ORIGIN - ROAD_HALF, GITTER_MAX = RASTER_X1 + ROAD_HALF;
    /* Eigenes, engeres Raster am anderen Ufer. */
    const SHORE_PITCH = 32, SHORE_ROAD = 5, SHORE_OX = 336, SHORE_OZ = -192;
    const SHORE_NX = 2, SHORE_NZ = 12;
    /* Bruecke: die Fahrbahn zwischen den Gehwegen. */
    const BRIDGE_Z = -25, BR_X0 = 181, BR_X1 = 334, BR_GEH_INNEN = 5.6;

    /* 0,3 m Sicherheitsabstand, damit ein Bordsteinpoller nicht zaehlt. */
    const LUFT = 0.3;
    function aufFahrbahn(x, z, r) {
      const eng = r + LUFT;
      /* Stadtraster */
      if (x > GITTER_MIN && x < GITTER_MAX && z > GITTER_MIN && z < GITTER_MAX) {
        for (const l of linien) {
          if (Math.abs(z - l) < ROAD_HALF - eng) return { wo: 'x-Strasse bei z=' + l,
            tief: +(ROAD_HALF - eng - Math.abs(z - l)).toFixed(2) };
          if (Math.abs(x - l) < ROAD_HALF - eng) return { wo: 'z-Strasse bei x=' + l,
            tief: +(ROAD_HALF - eng - Math.abs(x - l)).toFixed(2) };
        }
      }
      /* Uferstrasse: die beiden Spuren liegen bei 172 und 178. */
      if (z > GITTER_MIN && z < GITTER_MAX && Math.abs(x - RASTER_X1) < ROAD_HALF - eng)
        return { wo: 'Uferstrasse', tief: +(ROAD_HALF - eng - Math.abs(x - RASTER_X1)).toFixed(2) };
      /* Raster am anderen Ufer */
      if (x > SHORE_OX - SHORE_ROAD && x < SHORE_OX + SHORE_NX * SHORE_PITCH + SHORE_ROAD &&
          z > SHORE_OZ - SHORE_ROAD && z < SHORE_OZ + SHORE_NZ * SHORE_PITCH + SHORE_ROAD) {
        for (let i = 0; i <= SHORE_NX; i++) {
          const L = SHORE_OX + i * SHORE_PITCH;
          if (Math.abs(x - L) < SHORE_ROAD - eng)
            return { wo: 'Uferraster z-Strasse bei x=' + L,
                     tief: +(SHORE_ROAD - eng - Math.abs(x - L)).toFixed(2) };
        }
        for (let j = 0; j <= SHORE_NZ; j++) {
          const L = SHORE_OZ + j * SHORE_PITCH;
          if (Math.abs(z - L) < SHORE_ROAD - eng)
            return { wo: 'Uferraster x-Strasse bei z=' + L,
                     tief: +(SHORE_ROAD - eng - Math.abs(z - L)).toFixed(2) };
        }
      }
      /* Brueckenfahrbahn */
      if (x > BR_X0 && x < BR_X1 && Math.abs(z - BRIDGE_Z) < BR_GEH_INNEN - eng)
        return { wo: 'Brueckenfahrbahn',
                 tief: +(BR_GEH_INNEN - eng - Math.abs(z - BRIDGE_Z)).toFixed(2) };
      return null;
    }

    const zebras = d.zebraFlaechen();
    const schaechte = d.ubahnen();
    const schachtFormen = d.ubSchaechte();
    const aufz = d.aufzuege();
    const tueren = d.tuerStellen();
    const pois = d.poiListe();

    function inRechteck(x, z, r, q) {
      const dx = Math.max(q.x0 - x, 0, x - q.x1);
      const dz = Math.max(q.z0 - z, 0, z - q.z1);
      const abstand = Math.hypot(dx, dz);
      return abstand < r ? +(r - abstand).toFixed(2) : null;
    }

    const befunde = [];
    function melde(art, ding, wo, tief, zusatz) {
      befunde.push({ flaeche: art, ding: ding.art,
                     ort: [Math.round(ding.x), Math.round(ding.z)],
                     ueberlappung: tief, wo: wo, zusatz: zusatz || null });
    }

    for (const g of amBoden) {
      const r = g.r || 0.5;

      const f = aufFahrbahn(g.x, g.z, r);
      if (f) melde('Fahrbahn', g, f.wo, f.tief);

      for (const zb of zebras) {
        const t = inRechteck(g.x, g.z, r, zb);
        if (t) melde('Zebrastreifen', g, [zb.x0, zb.z0].join('/'), t);
      }

      /* U-Bahn: Abgang, Stufen und Schachtmund. UB_SCHAECHTE liegen
         relativ zur Station; die Stationen stehen bei x aus ubahnen(). */
      /* Die Stationen liegen bei x mit einem z-Versatz dz - der fehlte im
         ersten Durchlauf, deshalb wurde jeder Fund doppelt gemeldet und
         an der falschen Stelle gesucht. Und die Zone ist jetzt der
         Abgang selbst (2,6 m breit), nicht ein um 1,6 m aufgeblasener
         Kasten: ein Poller NEBEN dem Abgang gehoert dorthin. */
      for (const st of schaechte) {
        for (const sch of schachtFormen) {
          const q = { x0: st.x + Math.min(sch.xFuss, sch.xKopf),
                      x1: st.x + Math.max(sch.xFuss, sch.xKopf),
                      z0: (st.dz || 0) + sch.z0, z1: (st.dz || 0) + sch.z1 };
          const t = inRechteck(g.x, g.z, r, q);
          if (t) melde('U-Bahn-Abgang', g,
                       'Station x=' + st.x + ' dz=' + (st.dz || 0) + ' ' + sch.steig, t);
        }
      }

      for (const a of aufz) {
        const q = { x0: a.x - 1.6, x1: a.x + 1.6, z0: a.z - 1.6, z1: a.z + 1.6 };
        const t = inRechteck(g.x, g.z, r, q);
        if (t) melde('Aufzug', g, a.x + '/' + a.z, t);
      }

      /* Brueckenuebergang: die beiden Rampen und ein Meter davor. */
      const BRIDGE_Z = -25, BRIDGE_HW = 10.0, BR_X0 = 181, BR_X1 = 334, BR_RAMPE = 6;
      for (const [xa, xb] of [[BR_X0 - BR_RAMPE - 1, BR_X0 + 1],
                              [BR_X1 - 1, BR_X1 + BR_RAMPE + 1]]) {
        const q = { x0: xa, x1: xb, z0: BRIDGE_Z - BRIDGE_HW, z1: BRIDGE_Z + BRIDGE_HW };
        const t = inRechteck(g.x, g.z, r, q);
        if (t) melde('Brueckenuebergang', g, xa + '..' + xb, t);
      }

      for (const tu of tueren) {
        const t1 = inRechteck(g.x, g.z, r, tu.durchgang);
        if (t1) melde('Haustuer (Durchgang)', g, tu.haus + ' @' + tu.x + '/' + tu.z, t1);
        else {
          const t2 = inRechteck(g.x, g.z, r, tu.vorfeld);
          if (t2) melde('Haustuer (Vorfeld)', g, tu.haus + ' @' + tu.x + '/' + tu.z, t2);
        }
      }

      for (const p of pois) {
        /* Auch in der HOEHE vergleichen: ein Dach-POI auf 39 m und eine
           Laterne auf der Strasse sind sich nicht im Weg. */
        if (Math.abs((p.y || 0) - (g.y || 0)) > 3) continue;
        const ab = Math.hypot(p.x - g.x, p.z - g.z);
        if (ab < r + 1.2) melde('POI-Anker', g, p.art + ' ' + p.id,
                                +(r + 1.2 - ab).toFixed(2));
      }
    }

    /* ---- Bewegungspfade: Kanten des Gehnetzes ---- */
    const knoten = d.gehKnotenListe();
    let kantenGeprueft = 0;
    const pfadBefunde = [];
    for (let i = 0; i < knoten.length; i++) {
      const n = knoten[i];
      for (const k of n.kanten) {
        /* Der Schluessel heisst 'zu' und ist ein INDEX in die Knotenliste.
           Im ersten Durchlauf hatte ich 'ziel' geraten - es wurden null
           Kanten geprueft und "Bewegungspfade frei" gemeldet, ohne dass
           irgendetwas geprueft worden waere. */
        const m = knoten[k.zu];
        if (!m) continue;
        /* jede Kante nur einmal */
        if (!(n.x < m.x || (n.x === m.x && n.z < m.z))) continue;
        kantenGeprueft++;
        for (const g of amBoden) {
          const r = g.r || 0.5;
          /* Abstand Punkt zu Strecke */
          const vx = m.x - n.x, vz = m.z - n.z;
          const len2 = vx * vx + vz * vz;
          const t = len2 > 0 ? Math.max(0, Math.min(1, ((g.x - n.x) * vx + (g.z - n.z) * vz) / len2)) : 0;
          const px = n.x + vx * t, pz = n.z + vz * t;
          const ab = Math.hypot(g.x - px, g.z - pz);
          /* 0,45 m ist der halbe Kollisionszylinder eines Passanten. */
          if (ab < r + 0.45) {
            /* Eine Beruehrung der IDEALLINIE ist noch keine Sperre: der
               Gehweg ist mehrere Meter breit, und Passanten weichen aus.
               Entscheidend ist, ob daneben eine freie Spur bleibt.
               Also seitlich versetzte Spuren durchprobieren: existiert
               eine, die an DIESER Stelle frei ist und noch auf dem
               Gehweg liegt, kommt man durch. */
            const len = Math.sqrt(len2) || 1;
            const qx = -vz / len, qz = vx / len;      // quer zur Kante
            /* Den Querschnitt des Gehwegs an dieser Stelle abtasten und
               die breiteste zusammenhaengende freie Luecke suchen. Eine
               feste Leiter von Ausweichspuren war zu grob: bei 5 cm
               Ueberlappung kommt man mit einem halben Schritt vorbei,
               nur eben nicht auf genau 0,7 m Versatz. */
            const SCHRITT = 0.1, WEITE = 3.0;
            /* Begehbar heisst hier: gleiche Ebene wie die Kante (kein
               Absatz, kein Wasser) und kein Hindernis. aufGehweg() taugte
               dafuer NICHT - es kennt nur das Stadtraster und meldete auf
               der Bruecke und am anderen Ufer ueberall "kein Gehweg". Die
               sechs angeblich gesperrten Stellen des vorigen Durchlaufs
               lagen genau dort. */
            const hKante = d.groundYAt(px, pz, 0);
            const frei1 = (sx, sz) => {
              if (Math.abs(d.groundYAt(sx, sz, hKante) - hKante) > 0.35) return false;
              for (const c of d.colliderNah(sx, sz)) {
                if (sx > c.x0 && sx < c.x1 && sz > c.z0 && sz < c.z1 &&
                    (c.h || 0) > hKante + 0.4) return false;
              }
              for (const o of amBoden) {
                if (Math.hypot(o.x - sx, o.z - sz) < (o.r || 0.5)) return false;
              }
              return true;
            };
            let beste = 0, lauf = 0;
            for (let seit = -WEITE; seit <= WEITE + 1e-9; seit += SCHRITT) {
              lauf = frei1(px + qx * seit, pz + qz * seit) ? lauf + SCHRITT : 0;
              if (lauf > beste) beste = lauf;
            }
            /* 0,9 m ist die Breite des Passanten-Kollisionszylinders. */
            const freieSpur = beste >= 0.9 - 1e-6 ? +beste.toFixed(2) : null;   // Rundung der 0,1-Schritte
            pfadBefunde.push({ ding: g.art, ort: [Math.round(g.x), Math.round(g.z)],
                               ueberlappung: +(r + 0.45 - ab).toFixed(2),
                               freieSpur: freieSpur,
                               luecke: +beste.toFixed(2),
                               kante: [Math.round(n.x), Math.round(n.z), Math.round(m.x), Math.round(m.z)] });
          }
        }
      }
    }

    return {
      dinge: dinge.length,
      amBoden: amBoden.length,
      obenDrauf: obenDrauf.length,
      flachDrin: flachDrin.length,
      artenZahl: dinge.reduce((a, g) => { a[g.art] = (a[g.art] || 0) + 1; return a; }, {}),
      befunde,
      pfadBefunde,
      kantenGeprueft,
      netz: d.gehNetz(),
      hyg: d.hygStatistik ? d.hygStatistik() : null,
      aufFahrbahnZaehler: d.aufFahrbahn ? d.aufFahrbahn() : null,
      zonen: { zebras: zebras.length, stationen: schaechte.length,
               aufzuege: aufz.length, tueren: tueren.length, pois: pois.length },
    };
  });

  console.log('');
  console.log('Geprueft: ' + aus.dinge + ' Gegenstaende gegen ' +
              (aus.zonen.zebras + aus.zonen.stationen * 2 + aus.zonen.aufzuege +
               aus.zonen.tueren + aus.zonen.pois + 2) + ' Flaechen und ' +
              aus.kantenGeprueft + ' Kanten des Gehnetzes.');
  console.log('Gegenstaende:', JSON.stringify(aus.artenZahl));
  console.log('Flaechen:', JSON.stringify(aus.zonen));
  console.log('');

  const nach = {};
  for (const b2 of aus.befunde) (nach[b2.flaeche] = nach[b2.flaeche] || []).push(b2);
  const reihen = ['Fahrbahn', 'Zebrastreifen', 'U-Bahn-Abgang', 'Aufzug',
                  'Brueckenuebergang', 'Haustuer (Durchgang)', 'Haustuer (Vorfeld)',
                  'POI-Anker'];
  console.log('Flaeche'.padEnd(24), 'Befunde');
  console.log('-'.repeat(74));
  for (const k of reihen) {
    const l = nach[k] || [];
    console.log(k.padEnd(24), l.length === 0 ? 'frei' : l.length + '  !!');
  }
  const gesperrt = aus.pfadBefunde.filter((e) => e.freieSpur === null);
  console.log('Bewegungspfade'.padEnd(24),
              gesperrt.length === 0
                ? 'frei (' + aus.pfadBefunde.length + ' mal die Ideallinie gestreift, ' +
                  'daneben aber ueberall >= 0,9 m Luecke)'
                : gesperrt.length + ' von ' + aus.pfadBefunde.length + ' wirklich gesperrt  !!');
  console.log('-'.repeat(74));
  console.log('Gehnetz:', JSON.stringify(aus.netz));
  if (aus.aufFahrbahnZaehler !== null)
    console.log('Zaehler des Spiels "auf Fahrbahn":', aus.aufFahrbahnZaehler);

  for (const k of reihen) {
    const l = nach[k] || [];
    if (!l.length) continue;
    console.log('');
    console.log('== ' + k + ' (' + l.length + ') ==');
    for (const e of l.slice(0, 20))
      console.log('  ' + e.ding.padEnd(18) + ' bei ' + JSON.stringify(e.ort) +
                  '  ' + e.ueberlappung + ' m  in ' + e.wo);
    if (l.length > 20) console.log('  ... und ' + (l.length - 20) + ' weitere');
  }
  if (aus.pfadBefunde.length) {
    console.log('');
    console.log('== Bewegungspfade ==');
    const proArt = {};
    for (const e of aus.pfadBefunde) proArt[e.ding] = (proArt[e.ding] || 0) + 1;
    console.log('  Ideallinie gestreift: ' + aus.pfadBefunde.length + ' ' +
                JSON.stringify(proArt));
    const tief = aus.pfadBefunde.map((e) => e.ueberlappung).sort((a, b) => b - a);
    console.log('  groesste Ueberlappung ' + tief[0] + ' m, Mittelwert ' +
                (tief.reduce((a, v) => a + v, 0) / tief.length).toFixed(3) + ' m');
    console.log('  wirklich gesperrt (keine freie Spur daneben): ' + gesperrt.length);
    for (const e of gesperrt.slice(0, 20))
      console.log('  ' + e.ding.padEnd(18) + ' bei ' + JSON.stringify(e.ort) +
                  '  Ueberlappung ' + e.ueberlappung + ' m, breiteste Luecke ' +
                  e.luecke + ' m  auf Kante ' + JSON.stringify(e.kante));
    if (gesperrt.length > 20) console.log('  ... und ' + (gesperrt.length - 20) + ' weitere');
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(aus, null, 2));
  await b.close();
})();
