/* CITY V2, Stufe 6A: Strassendetails - Bestand und Platzierungsfehler.

   Was steht auf Augenhoehe an den Gehwegen, je Stadtteil und je
   Strassenklasse? Gelesen aus dem laufenden Spiel, nicht aus dem
   Quelltext:

     Baeume      alle Kronen der Stadt (createTree, auch die Instanzfelder
                 der Strassenbaeume aus 6A)
     Mobiliar    Baenke, Muelleimer, Pflanzkuebel, Poller, Kioske, Uhren,
                 die losen Gegenstaende (Muelltonne, Hydrant, Briefkasten)
     Technik     Laternen und Ampeln (zaehlen fuer leere Strecken mit,
                 nicht als Mobiliar)

   Je Stadtteil: Zahl je Art, Mobiliar je 100 m Gehweg, laengste ganz
   leere Gehwegstrecke einer Blockkante, verwendete Arten, Wiederholungen
   (Kanten mit identischem Muster, gleichmaessige Reihen, gleiche Variante
   direkt nebeneinander).

   Fuer die NEUEN Details aus 6A (__dbg.strassenDetails, fehlt vor 6A)
   zusaetzlich die harten Fehler - jeder muss 0 sein:
     Fahrbahn, Haus, Haustuer, Zebrastreifen, anderes Requisit, Baum in
     Parkauto, Baum an Laterne/Ampel/Baum, freier Gehweg unter 1,8 m,
     Gehnetzknoten eingeengt oder abgeschnitten, Kollider ohne Sichtbares,
     massives Sichtbares ohne Kollider, Kollider groesser als das Sichtbare.

   Aufruf:  node tools/pruef/street-details.js [ausgabe.json] [seed=4711]
   ========================================================================= */
const fs = require('node:fs');
const { starte, ausgabePfad } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const zielJson = ausgabePfad(process.argv[2]);

(async () => {
  const { b, page } = await starte(640, 360, SEED);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const R = d.raster();
    const SLAB_H = 0.25, ROAD_HALF = 6, HALB = R.pitch / 2 - ROAD_HALF;   // 19 m Blockhalbmesser
    const klassen = {};
    for (const s of d.strassen()) klassen[s.achse + ':' + s.linie] = s.klasse;
    const teile = {};
    for (const t of d.stadtteile()) teile[t.bi + ',' + t.bj] = t.art;
    const bezirk = (x, z) => {
      if (x > R.x1) return 'UFER';
      const bi = Math.min(R.blocksX - 1, Math.max(0, Math.floor((x - R.x0) / R.pitch)));
      const bj = Math.min(R.blocksZ - 1, Math.max(0, Math.floor((z - R.z0) / R.pitch)));
      return teile[bi + ',' + bj] || 'WOHN';
    };

    /* ---- Alles einsammeln, was auf Gehweghoehe steht ---- */
    const dinge = [];
    const zu = (art, x, z, r, quelle, extra) =>
      dinge.push(Object.assign({ art, x, z, r, quelle }, extra || {}));
    /* Baeume aus createTree: eine Gruppe mit 'TreeFoliage'. Die Variante
       steckt in der Geometrie (je Variante eine). */
    const varianten = new Map();
    d.szene.traverse((o) => {
      if (!o.isMesh || o.name !== 'TreeFoliage') return;
      if (o.isInstancedMesh) return;          // Instanzfelder kommen ueber strassenDetails
      if (!varianten.has(o.geometry.uuid)) varianten.set(o.geometry.uuid, varianten.size);
      const p = new THREE.Vector3(); o.getWorldPosition(p);
      if (p.y < -1) return;
      zu('Baum', p.x, p.z, 0.34, 'bestand', { variante: 'g' + varianten.get(o.geometry.uuid) });
    });
    for (const bk of d.bankStellen()) {
      if ((bk.y || 0) < -1) continue;         // Bahnsteige
      zu('Bank', bk.x, bk.z, 1.1, 'bestand');
    }
    for (const m of d.strassenMoebel()) {
      const art = m.art === 'Beet' ? 'Pflanzkuebel' : m.art;
      zu(art, m.x, m.z, m.r, 'bestand');
    }
    /* Lose Gegenstaende: Muelltonne 0,95 m, Hydrant 0,78 m, Briefkasten 1,10 m. */
    for (const o of d.ziehLose || []) {
      const h = o.hoehe, p = o.heim || o.mesh.position;
      const art = h > 1.0 ? 'Briefkasten' : h > 0.9 ? 'Muelltonne' : 'Hydrant';
      zu(art, p.x, p.z, 0.35, 'bestand');
    }
    /* Neue Details aus 6A */
    const neuRoh = d.strassenDetails ? d.strassenDetails() : [];
    for (const e of neuRoh) zu(e.art, e.x, e.z, e.r, 'neu', e);
    /* Baumscheibe und Pflanzscheibe (Park) liegen flach im Belag */
    const FLACH = { Baumscheibe: true, Pflanzscheibe: true };

    /* ---- Zuordnung: Stadtteil, Blockkante, Strassenklasse ---- */
    const kanteVon = (x, z) => {
      if (x > R.x1 + ROAD_HALF) return { art: 'PROMENADE', id: 'prom', laengs: z, klasse: 'PROMENADE' };
      const bi = Math.floor((x - R.x0) / R.pitch), bj = Math.floor((z - R.z0) / R.pitch);
      if (bi < 0 || bj < 0 || bi >= R.blocksX || bj >= R.blocksZ) return null;
      const cx = R.x0 + bi * R.pitch + R.pitch / 2, cz = R.z0 + bj * R.pitch + R.pitch / 2;
      const dx = x - cx, dz = z - cz;
      /* Welche Kante ist am naechsten? Innerhalb von 6 m vom Bordstein
         gehoert ein Ding zur Kante, tiefer im Block zum Block selbst. */
      const kand = [['N', HALB - dz, dx, 'z', cz + R.pitch / 2], ['S', HALB + dz, dx, 'z', cz - R.pitch / 2],
                    ['O', HALB - dx, dz, 'x', cx + R.pitch / 2], ['W', HALB + dx, dz, 'x', cx - R.pitch / 2]];
      kand.sort((a, c) => a[1] - c[1]);
      const [seite, tief, laengs, achse, linie] = kand[0];
      const art = teile[bi + ',' + bj];
      if (tief > 6.5 || tief < -0.5) return { art: art === 'PARK' ? 'PARKINNEN' : 'BLOCKINNEN', id: bi + ',' + bj + ':innen', laengs, klasse: art === 'PARK' ? 'PARK' : 'INNEN' };
      return { art: 'KANTE', id: bi + ',' + bj + ':' + seite, laengs, tief, klasse: klassen[achse + ':' + linie] || 'STREET', bi, bj, seite };
    };
    for (const g of dinge) {
      g.bezirk = bezirk(g.x, g.z);
      g.kante = kanteVon(g.x, g.z);
    }
    /* Die neuen Details mit ihrer Kante (Stadtteil, Seite) - geprueft
       werden diese Eintraege, nicht die Rohliste. */
    const neu = dinge.filter((g) => g.quelle === 'neu');

    /* ---- Gehweglaenge je Stadtteil: Bordsteinlinie aller Blockkanten,
       dazu die Promenade ---- */
    const gehweg = {}, kantenJe = {};
    for (const t of d.stadtteile()) {
      gehweg[t.art] = (gehweg[t.art] || 0) + 4 * 2 * HALB;
      kantenJe[t.art] = (kantenJe[t.art] || 0) + 4;
    }
    gehweg.UFER = (gehweg.UFER || 0) + (R.promZ1 - R.promZ0);

    /* ---- Leere Strecken je Kante: groesste Luecke zwischen zwei Dingen
       (Kantenenden zaehlen als Grenze) ---- */
    const jeKante = new Map();
    for (const g of dinge) {
      if (!g.kante || (g.kante.art !== 'KANTE' && g.kante.art !== 'PROMENADE')) continue;
      if (!jeKante.has(g.kante.id)) jeKante.set(g.kante.id, []);
      jeKante.get(g.kante.id).push(g);
    }
    const leer = {};          // stadtteil -> { max, ort, ganzLeer, kanten }
    const muster = new Map(); // Signatur -> Zahl (Wiederholung ganzer Kanten)
    const musterKanten = new Map(); // Signatur -> Kanten (fuer das Muster-Audit, Stufe 6B)
    let regelReihen = 0, gleicheNachbarn = 0, gleicheNachbarnNeu = 0;
    const regelBsp = [];
    for (const t of d.stadtteile()) {
      for (const seite of ['N', 'S', 'O', 'W']) {
        const id = t.bi + ',' + t.bj + ':' + seite;
        const l = (jeKante.get(id) || []).slice().sort((a, c) => a.kante.laengs - c.kante.laengs);
        let vor = -HALB, best = 0, wo = null;
        for (const g of l) {
          const a = g.kante.laengs;
          if (a - vor > best) { best = a - vor; wo = (vor + a) / 2; }
          vor = Math.max(vor, a);
        }
        if (HALB - vor > best) { best = HALB - vor; wo = (vor + HALB) / 2; }
        const L = leer[t.art] || (leer[t.art] = { max: 0, ort: null, ganzLeer: 0, ueber20: 0, kanten: 0, summe: 0 });
        L.kanten++; L.summe += best;
        if (!l.length) L.ganzLeer++;
        if (best >= 20) L.ueber20++;
        if (best > L.max) { L.max = +best.toFixed(1); L.ort = id + ' @' + (wo === null ? 0 : wo.toFixed(1)); }
        /* Muster der Kante: Arten mit Lage auf den Meter, ohne die Ampeln
           (die stehen an jeder Ecke gleich). */
        const sig = l.filter((g) => g.art !== 'Ampel').map((g) => g.art + '@' + Math.round(g.kante.laengs)).join('|');
        if (sig) muster.set(sig, (muster.get(sig) || 0) + 1);
        if (sig) {
          /* Kantenmitte und die Strasse davor (Achse + Linie), damit das
             Audit sagen kann, ob zwei gleiche Kanten einander sehen. */
          const cx = R.x0 + t.bi * R.pitch + R.pitch / 2, cz = R.z0 + t.bj * R.pitch + R.pitch / 2;
          const nv = { N: [0, 1], S: [0, -1], O: [1, 0], W: [-1, 0] }[seite];
          if (!musterKanten.has(sig)) musterKanten.set(sig, []);
          musterKanten.get(sig).push({ id, bezirk: t.art, mx: cx + nv[0] * HALB, mz: cz + nv[1] * HALB,
                                       achse: nv[0] !== 0 ? 'x' : 'z', linie: nv[0] !== 0 ? cx + nv[0] * R.pitch / 2 : cz + nv[1] * R.pitch / 2,
                                       neu: l.some((g) => g.quelle === 'neu') });
        }
        /* Gleichmaessige Reihen: drei gleiche hintereinander mit gleichem
           Abstand (+-0,3 m) */
        const gleich = (a, c) => a.art === c.art;
        for (let i = 0; i + 2 < l.length; i++) {
          if (!gleich(l[i], l[i + 1]) || !gleich(l[i + 1], l[i + 2])) continue;
          const d1 = l[i + 1].kante.laengs - l[i].kante.laengs, d2 = l[i + 2].kante.laengs - l[i + 1].kante.laengs;
          if (Math.abs(d1 - d2) < 0.3 && d1 > 0.5) { regelReihen++; if (regelBsp.length < 6) regelBsp.push(id + ' ' + l[i].art + ' ' + d1.toFixed(2)); }
        }
        /* Gleiche Variante direkt nebeneinander (nur Arten mit Varianten) */
        for (let i = 0; i + 1 < l.length; i++) {
          if (l[i].art !== l[i + 1].art || !l[i].variante || l[i].variante !== l[i + 1].variante) continue;
          gleicheNachbarn++;
          if (l[i].quelle === 'neu' && l[i + 1].quelle === 'neu') gleicheNachbarnNeu++;
        }
      }
    }
    const musterListe = [...muster.entries()].sort((a, c) => c[1] - a[1]);

    /* ---- Zahlen je Stadtteil und je Strassenklasse ---- */
    const MOEBEL = ['Bank', 'Muelleimer', 'Pflanzkuebel', 'Poller', 'Kiosk', 'Uhr', 'Muelltonne', 'Hydrant', 'Briefkasten'];
    const jeTeil = {}, jeKlasse = {};
    for (const g of dinge) {
      const T = jeTeil[g.bezirk] || (jeTeil[g.bezirk] = { arten: {}, neu: {}, baeume: 0, moebel: 0, technik: 0 });
      T.arten[g.art] = (T.arten[g.art] || 0) + 1;
      if (g.quelle === 'neu') T.neu[g.art] = (T.neu[g.art] || 0) + 1;
      if (g.art === 'Baum') T.baeume++;
      else if (MOEBEL.indexOf(g.art) >= 0) T.moebel++;
      else if (!FLACH[g.art]) T.technik++;
      const kl = g.kante ? g.kante.klasse : 'AUSSERHALB';
      const K = jeKlasse[kl] || (jeKlasse[kl] = {});
      K[g.art] = (K[g.art] || 0) + 1;
    }
    for (const [art, T] of Object.entries(jeTeil)) {
      T.gehwegM = Math.round(gehweg[art] || 0);
      T.moebelJe100 = T.gehwegM ? +(T.moebel * 100 / T.gehwegM).toFixed(2) : null;
      T.baeumeJe100 = T.gehwegM ? +(T.baeume * 100 / T.gehwegM).toFixed(2) : null;
      T.leer = leer[art] || null;
      if (T.leer) T.leer.mittel = +(T.leer.summe / T.leer.kanten).toFixed(1);
    }

    /* ---- Harte Fehler der neuen Details ---- */
    const fehler = {};
    const melde = (art, e, info) => { (fehler[art] = fehler[art] || []).push(Object.assign({ id: e.nr, art: e.art, x: +e.x.toFixed(2), z: +e.z.toFixed(2) }, info || {})); };
    const pruef = { anzahl: neu.length };
    if (neu.length) {
      const zebras = d.zebraFlaechen();
      const tueren = d.tuerStellen();
      const autos = d.parkAutos();
      const knoten = d.gehKnotenListe();
      const lampen = d.laterneStellen(), ampeln = d.ampelStellen();
      const kasten = (e) => e.kasten || { x0: e.x - e.r, x1: e.x + e.r, z0: e.z - e.r, z1: e.z + e.r };
      const ueber = (a, q, luft) => a.x1 + luft > q.x0 && a.x0 - luft < q.x1 && a.z1 + luft > q.z0 && a.z0 - luft < q.z1;
      const abstandKasten = (q, x, z) => Math.hypot(Math.max(q.x0 - x, 0, x - q.x1), Math.max(q.z0 - z, 0, z - q.z1));
      const andere = dinge.filter((g) => g.quelle === 'bestand');
      for (const e of neu) {
        const k = kasten(e);
        const flach = !!FLACH[e.art];
        /* Fahrbahn: der ganze Grundriss auf dem Gehweg (oder Promenade/Park) */
        const ecken = [[k.x0, k.z0], [k.x1, k.z0], [k.x0, k.z1], [k.x1, k.z1], [e.x, e.z]];
        for (const [px, pz] of ecken) {
          const y = d.groundYAt(px, pz, 2);
          if (Math.abs(y - SLAB_H) > 0.06) { melde('fahrbahnOderLoch', e, { y: +y.toFixed(2), px: +px.toFixed(2), pz: +pz.toFixed(2) }); break; }
        }
        /* Haus: jedes Hindernis, das kein Requisit ist */
        for (const c of d.colliderNah(e.x, e.z)) {
          if (c.klein || c.parkAuto || c.strassenDetail || (c.y0 !== undefined && c.y0 > 2.2) || (c.h || 0) < 0.6) continue;
          if (ueber(k, c, 0.05)) { melde('haus', e, { koll: c.id }); break; }
        }
        for (const tu of tueren) {
          if (ueber(k, tu.durchgang, 0.1) || ueber(k, tu.vorfeld, 0.1)) melde('haustuer', e, { haus: tu.haus });
        }
        for (const zb of zebras) if (ueber(k, zb, 0.4)) { melde('zebra', e); break; }
        /* Anderes Requisit: Bestand */
        if (!flach) for (const g of andere) {
          if (g.art === 'Ampel' || g.art === 'Laterne') continue;     // eigene Pruefung unten
          const ab = Math.hypot(g.x - e.x, g.z - e.z);
          const r2 = (e.kasten ? Math.min(k.x1 - k.x0, k.z1 - k.z0) / 2 : e.r);
          if (ab < r2 + (g.r || 0.3) - 0.05) { melde('requisitBestand', e, { mit: g.art, ab: +ab.toFixed(2) }); break; }
        }
        /* Anderes neues Requisit: Grundrisse duerfen sich nicht schneiden
           (Baumscheibe und ihr Baum gehoeren zusammen) */
        if (!flach) for (const f of neu) {
          if (f === e || FLACH[f.art] || f.nr < e.nr) continue;
          if (ueber(k, kasten(f), -0.02)) melde('requisitNeu', e, { mit: f.art + ' ' + f.nr });
        }
        if (e.art === 'Baum') {
          for (const a of autos) {
            const q = { x0: a.x - (a.achse === 'x' ? a.halbB : a.halbL), x1: a.x + (a.achse === 'x' ? a.halbB : a.halbL),
                        z0: a.z - (a.achse === 'x' ? a.halbL : a.halbB), z1: a.z + (a.achse === 'x' ? a.halbL : a.halbB) };
            if (abstandKasten(q, e.x, e.z) < 0.34 + 0.2) melde('baumInAuto', e);
          }
          for (const [lx, lz] of lampen) if (Math.hypot(lx - e.x, lz - e.z) < 3.5) melde('baumAnLaterne', e, { ab: +Math.hypot(lx - e.x, lz - e.z).toFixed(2) });
          for (const [ax, az] of ampeln) if (Math.hypot(ax - e.x, az - e.z) < 4.0) melde('baumAnAmpel', e, { ab: +Math.hypot(ax - e.x, az - e.z).toFixed(2) });
          for (const g of dinge) if (g.art === 'Baum' && g !== e && Math.hypot(g.x - e.x, g.z - e.z) < (e.gruppe ? 4.0 : 5.5)) {
            if (g.quelle === 'neu' && g.nr <= e.nr) continue;      // jedes Paar einmal, nie mit sich selbst
            melde('baumAnBaum', e, { ab: +Math.hypot(g.x - e.x, g.z - e.z).toFixed(2) });
          }
        }
        /* Freier Gehweg: von der Innenkante des Grundrisses quer zur Kante
           bis zum naechsten Hindernis (Haus oder Requisit) mind. 1,8 m */
        if (e.kante && e.kante.seite && !flach) {
          const s = e.kante.seite;
          const nx = s === 'O' ? 1 : s === 'W' ? -1 : 0, nz = s === 'N' ? 1 : s === 'S' ? -1 : 0;
          const innen = nx > 0 ? k.x0 : nx < 0 ? k.x1 : nz > 0 ? k.z0 : k.z1;
          let frei = 0;
          for (let w = 0.05; w <= 4.0; w += 0.05) {
            const px = nx !== 0 ? innen - nx * w : e.x, pz = nz !== 0 ? innen - nz * w : e.z;
            let zu2 = false;
            for (const c of d.colliderNah(px, pz)) {
              if (c === e.koll || c.parkAuto || (c.y0 !== undefined && c.y0 > 2.0) || (c.h || 0) < 0.5) continue;
              if (px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1) { zu2 = true; break; }
            }
            if (zu2 || Math.abs(d.groundYAt(px, pz, 2) - SLAB_H) > 0.06) break;
            frei = w;
          }
          if (frei < 1.8) melde('gehwegEng', e, { frei: +frei.toFixed(2) });
          e.freierGehweg = +frei.toFixed(2);
        }
        /* Gehnetz: Knoten brauchen 0,75 m um sich frei (gehFreiMass),
           Kanten 0,3 m (gehKanteFrei) - gegen die neuen KOLLIDER */
        if (e.koll) {
          for (let i = 0; i < knoten.length; i++) {
            const n = knoten[i];
            if (Math.abs(n.x - e.x) > 4 || Math.abs(n.z - e.z) > 4) continue;
            const ab = abstandKasten(e.koll, n.x, n.z);
            if (ab < 0.75) melde('gehKnotenEng', e, { knoten: i, ab: +ab.toFixed(2) });
          }
        }
      }
      /* Kanten des Gehnetzes, die ein neuer Kollider sperrt, und daraus:
         Knoten, die vom Hauptnetz abgeschnitten werden */
      const neuKoll = neu.filter((e) => e.koll).map((e) => e.koll);
      const gesperrt = new Set();
      for (let i = 0; i < knoten.length; i++) {
        const n = knoten[i];
        for (const kk of n.kanten) {
          if (kk.zu < i) continue;
          const m = knoten[kk.zu];
          const L = Math.hypot(m.x - n.x, m.z - n.z), schritte = Math.max(2, Math.ceil(L / 0.25));
          for (let s = 0; s <= schritte; s++) {
            const px = n.x + (m.x - n.x) * s / schritte, pz = n.z + (m.z - n.z) * s / schritte;
            if (neuKoll.some((q) => abstandKasten(q, px, pz) < 0.3)) { gesperrt.add(i + '-' + kk.zu); break; }
          }
        }
      }
      for (const g of gesperrt) melde('gehKanteGesperrt', { nr: -1, art: 'Kante', x: 0, z: 0 }, { kante: g });
      const insel = (ohne) => {
        const nr = new Array(knoten.length).fill(-1);
        let n = 0, groesste = 0;
        for (let i = 0; i < knoten.length; i++) {
          if (nr[i] >= 0) continue;
          const stapel = [i]; nr[i] = n; let g = 0;
          while (stapel.length) {
            const a = stapel.pop(); g++;
            for (const kk of knoten[a].kanten) {
              if (ohne && ohne.has(Math.min(a, kk.zu) + '-' + Math.max(a, kk.zu))) continue;
              if (nr[kk.zu] < 0) { nr[kk.zu] = n; stapel.push(kk.zu); }
            }
          }
          if (g > groesste) groesste = g;
          n++;
        }
        return { inseln: n, groesste };
      };
      const vorher = insel(null), nachher = insel(gesperrt);
      pruef.gehnetz = { knoten: knoten.length, vorher, nachher, abgeschnitten: vorher.groesste - nachher.groesste };
      if (nachher.groesste < vorher.groesste) melde('gehKnotenAbgeschnitten', { nr: -1, art: 'Netz', x: 0, z: 0 }, { zahl: vorher.groesste - nachher.groesste });

      /* Kollider und Sichtbares */
      const MASSIV = { Baum: true, Bank: true, Muelleimer: true, Pflanzkuebel: true, Kiosk: true };
      for (const e of neu) {
        if (MASSIV[e.art] && !e.koll) melde('massivOhneKollider', e);
        if (e.koll && !e.gezeichnet) melde('kolliderOhneSicht', e);
        if (e.koll && e.sicht) {
          /* Der Kollider darf ueber das Sichtbare nicht mehr als 5 cm
             hinausragen (Baumstamm: die bewaehrte Stammkiste) */
          const s = e.sicht;
          const ragt = Math.max(s.x0 - e.koll.x0, e.koll.x1 - s.x1, s.z0 - e.koll.z0, e.koll.z1 - s.z1, 0);
          if (e.art !== 'Baum' && ragt > 0.05) melde('kolliderRagt', e, { ragt: +ragt.toFixed(2) });
          pruef.ragtMax = Math.max(pruef.ragtMax || 0, e.art === 'Baum' ? 0 : ragt);
        }
      }
      pruef.neueKollider = neu.filter((e) => e.koll).length;
      pruef.gehwegFreiMin = Math.min(...neu.filter((e) => e.freierGehweg !== undefined).map((e) => e.freierGehweg));
    }
    const fehlerZahl = {};
    for (const [k, l] of Object.entries(fehler)) fehlerZahl[k] = l.length;

    return { gesamt: { dinge: dinge.length, neu: neu.length,
                       arten: dinge.reduce((a, g) => { a[g.art] = (a[g.art] || 0) + 1; return a; }, {}),
                       neuArten: neu.reduce((a, g) => { a[g.art] = (a[g.art] || 0) + 1; return a; }, {}) },
             jeTeil, jeKlasse, kantenJe,
             wiederholung: { regelReihen, regelBsp, gleicheNachbarn, gleicheNachbarnNeu,
                             haeufigstesMuster: musterListe.slice(0, 3).map(([m, n]) => ({ n, muster: m.slice(0, 120) })),
                             kantenMitGleichemMuster: musterListe.filter(([, n]) => n > 1).reduce((a, [, n]) => a + n, 0),
                             gruppen: musterListe.filter(([, n]) => n > 1).map(([m, n]) => ({ n, muster: m, kanten: musterKanten.get(m) })) },
             pruef, fehlerZahl, fehler: Object.fromEntries(Object.entries(fehler).map(([k, l]) => [k, l.slice(0, 8)])),
             neuListe: neu.map((e) => ({ nr: e.nr, art: e.art, x: +e.x.toFixed(2), z: +e.z.toFixed(2), variante: e.variante || null, bezirk: e.bezirk || null })) };
  });
  await b.close();

  const p = (s) => console.log(s);
  p('');
  p('== Strassendetails: ' + aus.gesamt.dinge + ' Dinge auf Gehweghoehe, davon neu ' + aus.gesamt.neu + ' ==');
  p('  Arten: ' + JSON.stringify(aus.gesamt.arten));
  if (aus.gesamt.neu) p('  neu:   ' + JSON.stringify(aus.gesamt.neuArten));
  p('');
  p('  Stadtteil   Gehweg m  Baeume  B/100m  Mobiliar  M/100m  Technik  leer max m  ganz leer  >=20 m  Kanten');
  for (const art of ['ZENTRUM', 'GESCHAEFT', 'MISCHUNG', 'UFER', 'WOHN', 'PARK']) {
    const T = aus.jeTeil[art];
    if (!T) { p('  ' + art.padEnd(10) + '  -'); continue; }
    const L = T.leer || {};
    p('  ' + art.padEnd(10) + String(T.gehwegM).padStart(10) + String(T.baeume).padStart(8) + String(T.baeumeJe100).padStart(8) +
      String(T.moebel).padStart(10) + String(T.moebelJe100).padStart(8) + String(T.technik).padStart(9) +
      String(L.max === undefined ? '-' : L.max).padStart(12) + String(L.ganzLeer === undefined ? '-' : L.ganzLeer).padStart(11) +
      String(L.ueber20 === undefined ? '-' : L.ueber20).padStart(8) + String(L.kanten || '-').padStart(8));
  }
  p('');
  p('  Arten je Stadtteil:');
  for (const art of ['ZENTRUM', 'GESCHAEFT', 'MISCHUNG', 'UFER', 'WOHN', 'PARK']) {
    const T = aus.jeTeil[art]; if (!T) continue;
    p('    ' + art.padEnd(10) + JSON.stringify(T.arten) + (Object.keys(T.neu).length ? '  neu ' + JSON.stringify(T.neu) : ''));
  }
  p('  Je Strassenklasse:');
  for (const [k, v] of Object.entries(aus.jeKlasse)) p('    ' + k.padEnd(11) + JSON.stringify(v));
  p('  Wiederholung: ' + aus.wiederholung.kantenMitGleichemMuster + ' Kanten teilen ihr Muster mit einer anderen; gleichmaessige Dreierreihen ' +
    aus.wiederholung.regelReihen + '; gleiche Variante nebeneinander ' + aus.wiederholung.gleicheNachbarn + ' (neu ' + aus.wiederholung.gleicheNachbarnNeu + ')');
  for (const m of aus.wiederholung.haeufigstesMuster) p('    ' + m.n + ' x  ' + m.muster);
  /* Muster-Audit (Stufe 6B): sind die Kanten mit gleichem Muster nur
     Bestand, oder sieht man die Wiederholung? Sichtbar heisst: zwei
     gleiche Kanten an derselben Strasse (gegenueber oder nebeneinander)
     mit hoechstens 120 m zwischen den Kantenmitten. */
  if (aus.wiederholung.gruppen) {
    const kl = { bestand: [0, 0], neuUnsichtbar: [0, 0], neuSichtbar: [0, 0] }, sichtbar = [];
    for (const g of aus.wiederholung.gruppen) {
      const K = g.kanten, neuDabei = K.some((k) => k.neu);
      let paar = null;
      for (let i = 0; i < K.length && !paar; i++) for (let j = i + 1; j < K.length && !paar; j++) {
        if (K[i].achse === K[j].achse && Math.abs(K[i].linie - K[j].linie) < 1 &&
            Math.hypot(K[i].mx - K[j].mx, K[i].mz - K[j].mz) <= 120) paar = [K[i].id, K[j].id];
      }
      const art = !neuDabei ? 'bestand' : paar ? 'neuSichtbar' : 'neuUnsichtbar';
      kl[art][0]++; kl[art][1] += K.length;
      if (paar && neuDabei) sichtbar.push({ muster: g.muster, kanten: K.map((k) => k.id + ' ' + k.bezirk), paar });
      g.audit = art;
    }
    aus.wiederholung.audit = { klassen: kl, sichtbar };
    p('  Muster-Audit: nur Bestand ' + kl.bestand[0] + ' Muster / ' + kl.bestand[1] + ' Kanten; mit neuen Dingen, nicht gemeinsam sichtbar ' +
      kl.neuUnsichtbar[0] + ' / ' + kl.neuUnsichtbar[1] + '; sichtbar wiederholt ' + kl.neuSichtbar[0] + ' / ' + kl.neuSichtbar[1]);
    for (const v of sichtbar) p('    sichtbar: ' + v.paar.join(' + ') + '   ' + v.muster.slice(0, 140));
  }
  if (aus.gesamt.neu) {
    p('');
    p('== Harte Fehler der neuen Details (Soll: alle 0) ==');
    const reihen = ['fahrbahnOderLoch', 'haus', 'haustuer', 'zebra', 'requisitBestand', 'requisitNeu', 'baumInAuto', 'baumAnLaterne',
                    'baumAnAmpel', 'baumAnBaum', 'gehwegEng', 'gehKnotenEng', 'gehKanteGesperrt', 'gehKnotenAbgeschnitten',
                    'kolliderOhneSicht', 'massivOhneKollider', 'kolliderRagt'];
    let summe = 0;
    for (const k of reihen) { const n = aus.fehlerZahl[k] || 0; summe += n; p('  ' + k.padEnd(26) + n + (n ? '  !!  ' + JSON.stringify(aus.fehler[k].slice(0, 3)) : '')); }
    p('  ' + 'SUMME'.padEnd(26) + summe);
    p('  neue Kollider ' + aus.pruef.neueKollider + '   freier Gehweg neben neuen Details min ' + aus.pruef.gehwegFreiMin + ' m' +
      '   Kollider ueber Sichtbares max ' + (aus.pruef.ragtMax || 0) + ' m');
    if (aus.pruef.gehnetz) p('  Gehnetz: ' + JSON.stringify(aus.pruef.gehnetz));
    p(summe === 0 ? 'STRASSENDETAILS: bestanden (0)' : 'STRASSENDETAILS: NICHT bestanden (' + summe + ')');
  }
  if (zielJson) fs.writeFileSync(zielJson, JSON.stringify(aus, null, 1));
})();
