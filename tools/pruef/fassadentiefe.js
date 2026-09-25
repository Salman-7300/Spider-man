/* problem-2, HUMAN REJECTION PASS 2, Blocker 1: haengt die Figur SICHTBAR
   an einer Wand - oder im Fensterloch dahinter?

   Das Human-Bild zeigt die Figur INNERHALB eines Modellhauses: um sie
   herum Fensteroeffnungen und Laibungen, unter ihr keine Flaeche.

   Die Vermutung steht in game.js selbst (Zeile 5375): "Sobald der
   Haeusersatz geladen ist, wird ueber jede dieser Kisten ein echtes
   Gebaeudemodell gestellt. Die KOLLISION bleibt die Kiste."
   Die Kiste ist die aeussere Huelle des Modells. Wo das Modell hinter
   dieser Huelle zurueckspringt - Fensternische, Staffelgeschoss,
   Lichthof, Innenecke -, klettert die Figur an einer Ebene, vor der
   nichts Sichtbares mehr steht.

   Dieser Stand MISST das, bevor irgendetwas geaendert wird.

   Teil 1  Bestandsaufnahme je Modelltyp
           Von 2,5 m vor der Kolliderflaeche wird nach innen gestrahlt -
           gegen NUR DIESES Hausmodell. Gemessen wird:
             climbPlaneDepth    0 (die Kletterebene ist die Kolliderflaeche)
             visualFacadeDepth  Abstand der ersten sichtbaren Flaeche
                                dahinter, in Metern
             difference         dasselbe, vorzeichenbehaftet
             visibleSurfacePresent  ob ueberhaupt etwas getroffen wird
           Vergleichsgruppe: die 'merged'-Haeuser, deren Fassade
           selbstgebaut auf der Kiste sitzt.

   Teil 2  Der echte Eingabeweg
           Anlauf, Ankleben, Hochklettern, seitwaerts - und in jedem
           Bild dieselbe Messung auf Becken-, Brust- und Kopfhoehe:
             pelvisBehindVisibleFacade
             chestBehindVisibleFacade
             headBehindVisibleFacade
             climbingWithoutVisibleSurface

   Aufruf:  node tools/pruef/fassadentiefe.js [seed=4711] [tief=0.25]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const tArg = process.argv.find((v) => v.indexOf('tief=') === 0);
const TIEF = tArg === undefined ? 0.25 : +tArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
/* Der Pruefstand strahlt zehntausendfach; ein voller Lauf sprengt jedes
   Zeitfenster. teil= waehlt aus, was gemessen wird. */
const fs = require('node:fs');
const jArg = process.argv.find((v) => v.indexOf('json=') === 0);
const JSONAUS = jArg === undefined ? null : jArg.slice(5);
const teilArg = process.argv.find((v) => v.indexOf('teil=') === 0);
const TEIL = teilArg === undefined ? 'alle' : teilArg.slice(5);

(async () => {
  const { b, page } = await starte(900, 540, SEED, ALT ? { fassAlt: true } : {});
  const aus = await page.evaluate(async ({ TIEF, TEIL }) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25, GAP = 0.15, R = 0.45, NOETIG = GAP + R;
    const SEITEN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const VOR = 2.5;                       // Strahlstart vor der Ebene
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);

    /* ---- Modelle den Kisten und Kollidern zuordnen ---- */
    const modelle = d.hausModelle();
    const haeuser = [];                    // { obj, kiste, name, koll }
    for (const o of modelle) {
      const K = o.userData && o.userData.hausKiste;
      if (!K) continue;
      let koll = null;
      for (const c of d.colliderNah(K.x, K.z)) {
        if (!fest(c)) continue;
        if (Math.abs(c.x0 - (K.x - K.w / 2)) < 0.05 &&
            Math.abs(c.x1 - (K.x + K.w / 2)) < 0.05 &&
            Math.abs(c.z0 - (K.z - K.d / 2)) < 0.05 &&
            Math.abs(c.z1 - (K.z + K.d / 2)) < 0.05) { koll = c; break; }
      }
      haeuser.push({ obj: o, kiste: K, koll,
                     name: (o.userData.modellName || o.name || '?') });
    }

    /* ---- Der Strahl ---- */
    const RC = new THREE.Raycaster();
    const O = new THREE.Vector3(), D = new THREE.Vector3();
    /* Wie weit hinter der Kletterebene liegt die erste sichtbare
       Flaeche? null = gar keine. */
    function sichtTiefe(ziel, c, nx, nz, y, t, weit) {
      const fx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : t;
      const fz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : t;
      O.set(fx + nx * VOR, y, fz + nz * VOR);
      D.set(-nx, 0, -nz);
      RC.set(O, D);
      RC.far = VOR + (weit === undefined ? 8 : weit);
      RC.near = 0;
      const tr = Array.isArray(ziel) ? RC.intersectObjects(ziel, true)
                                     : RC.intersectObject(ziel, true);
      if (!tr.length) return null;
      return { t: +(tr[0].distance - VOR).toFixed(3),
               mesh: tr[0].object.name || '(ohne Namen)' };
    }

    /* ==== Teil 1: Bestandsaufnahme je Modelltyp ==== */
    const nachName = new Map();
    for (const H of haeuser) {
      if (!H.koll) continue;
      if (!nachName.has(H.name)) nachName.set(H.name, []);
      nachName.get(H.name).push(H);
    }
    const typen = [];
    const will = (n) => TEIL === 'alle' || TEIL === String(n);
    for (const [name, liste] of (will(1) ? nachName : [])) {
      /* hoechstens vier Haeuser je Modelltyp, ortsstabil gewaehlt */
      liste.sort((a, c) => (a.kiste.x + a.kiste.z) - (c.kiste.x + c.kiste.z));
      const wahl = [];
      const schritt = Math.max(1, Math.floor(liste.length / 4));
      for (let i = 0; i < liste.length && wahl.length < 4; i += schritt) wahl.push(liste[i]);
      let proben = 0, ohne = 0, tief = 0, summe = 0, max = -1e9;
      const bsp = [];
      for (const H of wahl) {
        const c = H.koll, K = H.kiste;
        for (const [nx, nz] of SEITEN) {
          const laengsX = nz !== 0;
          const l0 = laengsX ? c.x0 : c.z0, l1 = laengsX ? c.x1 : c.z1;
          for (let u = 0.12; u <= 0.88; u += 0.152) {
            const t = l0 + (l1 - l0) * u;
            for (let v = 0.10; v <= 0.92; v += 0.1025) {
              const y = SLAB_H + K.h * v;
              const tr = sichtTiefe(H.obj, c, nx, nz, y, t);
              proben++;
              if (tr === null) {
                ohne++;
                if (bsp.length < 4) bsp.push({ art: 'keine Flaeche', koll: c.id,
                  nx, nz, y: +y.toFixed(2), t: +t.toFixed(2) });
                continue;
              }
              summe += tr.t;
              if (tr.t > max) max = tr.t;
              if (tr.t > TIEF) {
                tief++;
                if (bsp.length < 4) bsp.push({ art: 'zurueckgesetzt', koll: c.id,
                  nx, nz, y: +y.toFixed(2), t: +t.toFixed(2),
                  tiefe: tr.t, mesh: tr.mesh });
              }
            }
          }
        }
      }
      typen.push({ name, haeuser: liste.length, geprueft: wahl.length, proben,
                   ohne, tief, mittel: proben > ohne ? +(summe / (proben - ohne)).toFixed(3) : null,
                   max: max === -1e9 ? null : +max.toFixed(3),
                   anteilOhne: +(ohne / proben).toFixed(3),
                   anteilTief: +(tief / proben).toFixed(3), bsp });
    }
    typen.sort((a, c) => (c.anteilOhne + c.anteilTief) - (a.anteilOhne + a.anteilTief));

    /* ---- Vergleichsgruppe MERGED ---- */
    const fassaden = d.hausFassaden ? d.hausFassaden() : [];
    const mergedKisten = d.hausKisten().filter((k) => k.visual !== 'model');
    let mProben = 0, mOhne = 0, mTief = 0, mSumme = 0, mMax = -1e9;
    for (let i = 0; will(1) && i < mergedKisten.length && i < 20; i += 1) {
      const K = mergedKisten[Math.floor(i * mergedKisten.length / 20)];
      if (!K) continue;
      let koll = null;
      for (const c of d.colliderNah(K.x, K.z)) {
        if (!fest(c)) continue;
        if (Math.abs(c.x0 - (K.x - K.w / 2)) < 0.05 &&
            Math.abs(c.z0 - (K.z - K.d / 2)) < 0.05) { koll = c; break; }
      }
      if (!koll) continue;
      for (const [nx, nz] of SEITEN) {
        const laengsX = nz !== 0;
        const l0 = laengsX ? koll.x0 : koll.z0, l1 = laengsX ? koll.x1 : koll.z1;
        for (let u = 0.15; u <= 0.85; u += 0.175) {
          const t = l0 + (l1 - l0) * u;
          for (let v = 0.12; v <= 0.9; v += 0.13) {
            const y = SLAB_H + K.h * v;
            const tr = sichtTiefe(fassaden, koll, nx, nz, y, t, 3);
            mProben++;
            if (tr === null) { mOhne++; continue; }
            mSumme += tr.t; if (tr.t > mMax) mMax = tr.t;
            if (tr.t > TIEF) mTief++;
          }
        }
      }
    }
    const merged = { proben: mProben, ohne: mOhne, tief: mTief,
                     mittel: mProben > mOhne ? +(mSumme / (mProben - mOhne)).toFixed(3) : null,
                     max: mMax === -1e9 ? null : +mMax.toFixed(3) };

    /* ==== Teil 2: der echte Eingabeweg ==== */
    const freieTiefe = (c, nx, nz, y, bis, lx, lz) => {
      const weit = bis === undefined ? 6 : bis;
      const sx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (lx === undefined ? (c.x0 + c.x1) / 2 : lx);
      const sz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : (lz === undefined ? (c.z0 + c.z1) / 2 : lz);
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
    /* Kollider-ID -> Hausmodell, damit im Lauf sofort gestrahlt werden kann. */
    const objNachKoll = new Map(), namNachKoll = new Map();
    for (const H of haeuser) if (H.koll) {
      objNachKoll.set(H.koll.id, H.obj); namNachKoll.set(H.koll.id, H.name);
    }

    /* Startplaetze: je Modelltyp bis zu vier, freie Fassade mit Anlauf. */
    const starts = [];
    const proTyp = new Map();
    for (const H of haeuser) {
      if (!H.koll || H.kiste.h < 14) continue;
      const n = proTyp.get(H.name) || 0;
      if (n >= 4 || starts.length >= 26) continue;
      const c = H.koll;
      for (const [nx, nz] of SEITEN) {
        const laengsX = nz !== 0;
        const l0 = laengsX ? c.x0 : c.z0, l1 = laengsX ? c.x1 : c.z1;
        if (l1 - l0 < 4) continue;
        const mitte = (l0 + l1) / 2;
        const tief = freieTiefe(c, nx, nz, SLAB_H + 3, 9,
                                laengsX ? mitte : undefined, laengsX ? undefined : mitte);
        if (tief < 7) continue;
        const fx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : mitte;
        const fz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : mitte;
        starts.push({ koll: c.id, nx, nz, fx, fz, name: H.name, h: H.kiste.h,
                      art: H.kiste.art, obj: H.obj });
        proTyp.set(H.name, n + 1);
        break;
      }
    }

    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };
    const HOEHEN = [['pelvis', 0.9], ['chest', 1.4], ['head', 1.75]];
    /* ---- Die Ursachenarten ----
       Reihenfolge ist Absicht: was zuerst passt, gewinnt. Ein Bild
       neben der Schauseite ist ein Messfehler und kein Fassadenbefund,
       auch wenn die Karte dort ein Loch meldet. */
    const ursacheOhne = {}, ursacheUeber60 = {}, ursacheUeber100 = {};
    const ursacheKeinGriff = {};
    const bspUrsache = {}, bspOhneArt = {}, bspKeinGriff = {};
    const einordnen = (L, k, laengsDrin, hochDrin) => {
      if (!laengsDrin) return 'Pruefstand: neben der Schauseite';
      if (!hochDrin) return 'Pruefstand: ueber der Traufe';
      if (!L) return 'ohne Auskunft';
      if (!L.karte) return 'ohne Tiefenkarte (Turm oder merged)';
      if (L.ausserhalb) return 'Pruefstand: ausserhalb der Karte';
      if (k.drinWer && (k.drinWer.krone || k.drinWer.eigene)) return 'Kronenproblem';
      if (k.drinWer) return 'Nachbarproblem';
      if (L.halt === 'tragend' && L.zelle !== null && L.zelle <= L.luft)
        return 'solide Fassade (Strahl trifft Fuge)';
      if (L.halt === 'tragend') return 'tragend ueber die Nachbarzelle';
      if (L.halt === 'zurueckgesetzt') return 'zurueckgesetzte Wand (' + L.mit1 + ' m)';
      if (L.halt === 'Band') return 'Fensterband, Fassade in Reichweite darueber';
      if (L.halt === 'Pfeiler') return 'Pfeiler seitlich in Reichweite';
      return 'echtes Void (Loch ' + L.lochHoch + ' m hoch, seitlich ' + L.wandSeitlich + ')';
    };
    const zaehler = { pelvis: 0, chest: 0, head: 0, ohne: 0, bilder: 0,
                      ohneEcht: 0, nebenDerFlaeche: 0, ueberDemHaus: 0,
                      ueber30: 0, ueber60: 0, ueber100: 0, ueber200: 0,
                      falschesLoch: 0, uebersehenesLoch: 0, losgelassen: 0,
                      griff30: 0, griff60: 0, griff100: 0, griff200: 0,
                      griffSumme: 0, keinGriff: 0, keinGriffEcht: 0 };
    const bspLoch = [];
    const laeufe = [], bspTief = [], bspOhne = [];
    const nachTyp = new Map();
    for (const S of (will(2) ? starts : [])) {
      los();
      d.setzePos(S.fx + S.nx * 5, SLAB_H + 0.1, S.fz + S.nz * 5);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(-S.nx, -S.nz);
      d.setzeKamYaw(Math.atan2(-S.nx, -S.nz));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', true); d.taste('KeyW', true);
      let klebt = false;
      for (let i = 0; i < 150 && !klebt; i++) {
        d.schritt(1 / 60);
        if (P.state === 'climb') klebt = true;
      }
      if (!klebt) { los(); laeufe.push({ name: S.name, koll: S.koll, angeklebt: false }); continue; }
      for (let i = 0; i < 100; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', false); d.taste('KeyW', false);
      d.taste('KeyD', true);
      const z = { pelvis: 0, chest: 0, head: 0, ohne: 0, bilder: 0, maxTiefe: 0 };
      let vorZustand = 'climb';
      for (let i = 0; i < 420; i++) {
        d.schritt(1 / 60);
        const k = d.kletterLage();
        if (vorZustand === 'climb' && k.zustand !== 'climb') zaehler.losgelassen++;
        vorZustand = k.zustand;
        if (k.zustand !== 'climb' || k.koll === null) continue;
        const obj = objNachKoll.get(k.koll);
        if (!obj) continue;                 // MERGED-Haus: hier nicht gemessen
        let c = null;
        for (const q of d.colliderNah(k.pos[0], k.pos[2])) if (q.id === k.koll) { c = q; break; }
        if (!c) continue;
        z.bilder++; zaehler.bilder++;
        const t = k.nx !== 0 ? k.pos[2] : k.pos[0];
        /* Liegt die Figur ueberhaupt VOR dieser Schauseite? Jenseits
           ihrer Kanten misst der Strahl neben dem Haus vorbei - das
           waere ein Messfehler, kein Fassadenloch. */
        const l0 = k.nx !== 0 ? c.z0 : c.x0, l1 = k.nx !== 0 ? c.z1 : c.x1;
        const laengsDrin = t >= l0 && t <= l1;
        const hochDrin = k.pos[1] + 1.4 <= (c.h || 0);
        if (!laengsDrin) zaehler.nebenDerFlaeche++;
        if (!hochDrin) zaehler.ueberDemHaus++;
        let ohneAlle = true;
        for (const [teil, hoch] of HOEHEN) {
          const tr = sichtTiefe(obj, c, k.nx, k.nz, k.pos[1] + hoch, t);
          if (tr === null) continue;
          ohneAlle = false;
          if (tr.t > TIEF) {
            z[teil]++; zaehler[teil]++;
            if (tr.t > z.maxTiefe) z.maxTiefe = tr.t;
          }
          if (teil !== 'chest') continue;
          /* ---- Was die HAND erreicht, nicht was der Mittelstrahl trifft ----
             Ein einzelner Strahl aus der Koerpermitte geht durch jede
             Fensterfuge und meldet dann "keine Flaeche", obwohl einen
             halben Meter daneben Wand steht. Die Figur greift aber mit
             beiden Haenden. Gemessen wird deshalb zusaetzlich der
             naechste Treffer aus drei Strahlen: Mitte und beide
             Handstellen (je einen Koerperradius seitlich). */
          let griff = tr.t;
          for (const versatz of [-0.45, 0.45]) {
            const q = sichtTiefe(obj, c, k.nx, k.nz, k.pos[1] + hoch, t + versatz);
            if (q !== null && q.t < griff) griff = q.t;
          }
          zaehler.griffSumme += griff;
          if (griff > 0.30) zaehler.griff30++;
          if (griff > 0.60) zaehler.griff60++;
          if (griff > 1.00) zaehler.griff100++;
          if (griff > 2.00) zaehler.griff200++;
          /* ---- Restfaelle nach URSACHE aufteilen ----
             Nicht weiter aggregiert optimieren: fuer jedes Bild, das
             auffaellt, wird festgehalten, WARUM. */
          if (tr.t > 0.60 || ohneAlle) {
            const L = d.fassLage ? d.fassLage(k.koll, k.nx, k.nz, k.pos[1] + 1.0, t) : null;
            const art = einordnen(L, k, laengsDrin, hochDrin);
            const topf = tr.t > 1.0 ? ursacheUeber100 : ursacheUeber60;
            topf[art] = (topf[art] || 0) + 1;
            if ((bspUrsache[art] || []).length < 3) {
              (bspUrsache[art] = bspUrsache[art] || []).push({
                art, modell: namNachKoll.get(k.koll), koll: k.koll,
                nx: k.nx, nz: k.nz, pos: k.pos, strahl: tr.t, mesh: tr.mesh,
                drin: k.drinWer || null, lage: L });
            }
          }
          /* ---- Karte gegen Strahl AUF DEM ECHTEN WEG ----
             Ein falsches Loch in der Karte laesst die Figur an einer
             tadellosen Wand loslassen. Deshalb wird hier, wo sie
             wirklich haengt, beides verglichen. */
          if (d.fassTiefe) {
            const q = d.fassTiefe(k.koll, k.nx, k.nz, k.pos[1] + hoch, t);
            if (q && q.karte) {
              const kLoch = q.tiefe === null || q.tiefe > 0.6;
              const sLoch = tr.t > 0.6;
              if (kLoch && !sLoch) {
                zaehler.falschesLoch++;
                if (bspLoch.length < 6)
                  bspLoch.push({ modell: namNachKoll.get(k.koll), koll: k.koll,
                                 nx: k.nx, nz: k.nz, pos: k.pos,
                                 karte: q.tiefe, strahl: tr.t, mesh: tr.mesh });
              } else if (!kLoch && sLoch) zaehler.uebersehenesLoch++;
            }
          }
          /* Verteilung statt einer einzigen Schwelle - sonst haengt der
             Befund daran, welche Zahl man gewaehlt hat. */
          if (tr.t > 0.30) zaehler.ueber30++;
          if (tr.t > 0.60) zaehler.ueber60++;
          if (tr.t > 1.00) zaehler.ueber100++;
          if (tr.t > 2.00) zaehler.ueber200++;
          /* ---- Warum steht die Figur trotzdem hier? ----
             istFrei ist das Urteil des SPIELS (freie Abschnitte samt
             Tiefenkarte), fassTiefe die Karte allein. Weichen sie vom
             Strahl ab, liegt es an der Karte; stimmen sie ueberein und
             die Figur steht trotzdem da, fragt dieser Weg die Abschnitte
             gar nicht. */
          if (tr.t > 1.0 && bspTief.length < 12) {
            const frei = d.istFrei ? d.istFrei(k.koll, k.nx, k.nz, k.pos[1] + 1.0, t) : null;
            const q = d.fassTiefe ? d.fassTiefe(k.koll, k.nx, k.nz, k.pos[1] + hoch, t) : null;
            const l0 = k.nx !== 0 ? c.z0 : c.x0, l1 = k.nx !== 0 ? c.z1 : c.x1;
            bspTief.push({ modell: namNachKoll.get(k.koll), koll: k.koll,
                           nx: k.nx, nz: k.nz, pos: k.pos,
                           visualFacadeDepth: tr.t, karte: q && q.tiefe,
                           spielUrteilFrei: frei, mesh: tr.mesh,
                           laengsDrin, spanne: [+l0.toFixed(2), +l1.toFixed(2)],
                           wandAbstand: k.wandAbstand });
          }
        }
        /* Und findet ueberhaupt EINE der drei Handstellen etwas? */
        {
          let was = false;
          for (const versatz of [-0.45, 0, 0.45])
            if (sichtTiefe(obj, c, k.nx, k.nz, k.pos[1] + 1.4, t + versatz) !== null)
              { was = true; break; }
          if (!was) {
            zaehler.keinGriff++;
            if (laengsDrin && hochDrin) zaehler.keinGriffEcht++;
            const L = d.fassLage ? d.fassLage(k.koll, k.nx, k.nz, k.pos[1] + 1.0, t) : null;
            const art = einordnen(L, k, laengsDrin, hochDrin);
            ursacheKeinGriff[art] = (ursacheKeinGriff[art] || 0) + 1;
            if ((bspKeinGriff[art] || []).length < 2)
              (bspKeinGriff[art] = bspKeinGriff[art] || []).push({
                art, modell: namNachKoll.get(k.koll), koll: k.koll,
                nx: k.nx, nz: k.nz, pos: k.pos, lage: L });
          }
        }
        if (ohneAlle) {
          z.ohne++; zaehler.ohne++;
          if (laengsDrin && hochDrin) zaehler.ohneEcht++;
          {
            const L = d.fassLage ? d.fassLage(k.koll, k.nx, k.nz, k.pos[1] + 1.0, t) : null;
            const art = einordnen(L, k, laengsDrin, hochDrin);
            ursacheOhne[art] = (ursacheOhne[art] || 0) + 1;
            if ((bspOhneArt[art] || []).length < 3)
              (bspOhneArt[art] = bspOhneArt[art] || []).push({
                art, modell: namNachKoll.get(k.koll), koll: k.koll,
                nx: k.nx, nz: k.nz, pos: k.pos, drin: k.drinWer || null, lage: L });
          }
          if (bspOhne.length < 12) {
            /* Gegenprobe: WAS steht dort, wenn nicht dieses Modell?
               Ohne diese Frage waere "keine Flaeche" nicht von einem
               Messfehler zu unterscheiden. */
            const box = new THREE.Box3().setFromObject(obj);
            const alles = sichtTiefe(modelle, c, k.nx, k.nz, k.pos[1] + 1.4, t);
            /* Dieselbe Hoehe, aber in der MITTE der Schauseite: trifft
               der Strahl dort? Dann liegt es an der Stelle, nicht am
               Modell oder am Messverfahren. */
            const mitteT = k.nx !== 0 ? (c.z0 + c.z1) / 2 : (c.x0 + c.x1) / 2;
            const inDerMitte = sichtTiefe(obj, c, k.nx, k.nz, k.pos[1] + 1.4, mitteT);
            let meshe = 0; obj.traverse((q) => { if (q.isMesh) meshe++; });
            bspOhne.push({ modell: namNachKoll.get(k.koll), koll: k.koll,
                           nx: k.nx, nz: k.nz, pos: k.pos,
                           kiste: [+c.x0.toFixed(2), +c.x1.toFixed(2),
                                   +c.z0.toFixed(2), +c.z1.toFixed(2), +(c.h || 0).toFixed(2)],
                           modellBox: [+box.min.x.toFixed(2), +box.max.x.toFixed(2),
                                       +box.min.y.toFixed(2), +box.max.y.toFixed(2),
                                       +box.min.z.toFixed(2), +box.max.z.toFixed(2)],
                           inAllenModellen: alles, inDerMitte, meshe });
          }
        }
      }
      los();
      const e = nachTyp.get(S.name) || { bilder: 0, pelvis: 0, chest: 0, head: 0, ohne: 0, max: 0 };
      e.bilder += z.bilder; e.pelvis += z.pelvis; e.chest += z.chest;
      e.head += z.head; e.ohne += z.ohne; e.max = Math.max(e.max, z.maxTiefe);
      nachTyp.set(S.name, e);
      laeufe.push({ name: S.name, koll: S.koll, angeklebt: true, h: +S.h.toFixed(1),
                    art: S.art, bilder: z.bilder, pelvis: z.pelvis, chest: z.chest,
                    head: z.head, ohne: z.ohne, maxTiefe: +z.maxTiefe.toFixed(2) });
    }

    /* ==== Teil 3: stimmt die vorberechnete Tiefenkarte? ====
       Die Karte wird EINMAL je Modelltyp aus den Dreiecken gebaut. Ob
       sie das trifft, was der Strahl sieht, ist die Bedingung dafuer,
       dass eine darauf gestuetzte Sperre etwas taugt. */
    const karte = { proben: 0, beide: 0, nurKarte: 0, nurStrahl: 0,
                    fehlerSumme: 0, fehlerMax: 0, ohneKarte: 0, bsp: [] };
    if (will(3) && d.fassTiefe) {
      let n = 0;
      for (const H of haeuser) {
        if (!H.koll || n >= 40) continue;
        n++;
        const c = H.koll, K = H.kiste;
        for (const [nx, nz] of SEITEN) {
          const laengsX = nz !== 0;
          const l0 = laengsX ? c.x0 : c.z0, l1 = laengsX ? c.x1 : c.z1;
          for (let u = 0.08; u <= 0.94; u += 0.12) {
            const t = l0 + (l1 - l0) * u;
            for (let v = 0.08; v <= 0.94; v += 0.12) {
              const y = SLAB_H + K.h * v;
              const strahl = sichtTiefe(H.obj, c, nx, nz, y, t);
              const q = d.fassTiefe(c.id, nx, nz, y, t);
              if (!q || !q.karte) { karte.ohneKarte++; continue; }
              karte.proben++;
              const sLoch = strahl === null || strahl.t > 0.6;
              const kLoch = q.tiefe === null || q.tiefe > 0.6;
              if (sLoch && kLoch) karte.beide++;
              else if (kLoch) {
                karte.nurKarte++;
                if (karte.bsp.length < 8)
                  karte.bsp.push({ art: 'Karte sagt Loch, Strahl sieht Wand',
                    modell: H.name, koll: c.id, nx, nz, y: +y.toFixed(2),
                    t: +t.toFixed(2), strahl: strahl && strahl.t, karte: q.tiefe });
              } else if (sLoch) {
                karte.nurStrahl++;
                if (karte.bsp.length < 8)
                  karte.bsp.push({ art: 'Strahl sieht Loch, Karte sagt Wand',
                    modell: H.name, koll: c.id, nx, nz, y: +y.toFixed(2),
                    t: +t.toFixed(2), strahl: strahl && strahl.t, karte: q.tiefe });
              } else {
                const f = Math.abs((strahl.t) - (q.tiefe === null ? 0 : q.tiefe));
                karte.fehlerSumme += f;
                if (f > karte.fehlerMax) karte.fehlerMax = f;
              }
            }
          }
        }
      }
    }

    return { haeuser: haeuser.length, typen, merged, karte,
             stand: d.fassStand ? d.fassStand() : null,
             starts: starts.length, laeufe,
             zaehler, bspTief, bspOhne, bspLoch,
             ursacheOhne, ursacheUeber60, ursacheUeber100, bspUrsache, bspOhneArt,
             ursacheKeinGriff, bspKeinGriff,
             nachTyp: [...nachTyp].map(([n, e]) => Object.assign({ name: n }, e)) };
  }, { TIEF, TEIL });

  console.log('\n== Teil 1: wie weit liegt die sichtbare Fassade hinter der Kletterebene? ==');
  console.log('  Modellhaeuser gesetzt: ' + aus.haeuser + '   Schwelle: ' + TIEF + ' m');
  console.log('\n  ' + 'Modell'.padEnd(26) + 'Haeuser Proben  ohneFlaeche  >Schwelle  mittel   max');
  for (const t of aus.typen)
    console.log('  ' + t.name.padEnd(26) + String(t.haeuser).padStart(5) +
                String(t.proben).padStart(8) +
                (t.ohne + ' (' + (t.anteilOhne * 100).toFixed(1) + '%)').padStart(14) +
                (t.tief + ' (' + (t.anteilTief * 100).toFixed(1) + '%)').padStart(13) +
                String(t.mittel).padStart(8) + String(t.max).padStart(7));
  console.log('\n  Vergleichsgruppe MERGED (selbstgebaute Fassade auf der Kiste):');
  console.log('    Proben ' + aus.merged.proben + '   ohne Flaeche ' + aus.merged.ohne +
              '   > Schwelle ' + aus.merged.tief + '   mittel ' + aus.merged.mittel +
              '   max ' + aus.merged.max);
  console.log('\n  Beispiele:');
  for (const t of aus.typen.slice(0, 4))
    for (const e of t.bsp.slice(0, 2))
      console.log('    ' + t.name.padEnd(24) + JSON.stringify(e));

  if (aus.stand)
    console.log('\n  Tiefenkarten: ' + aus.stand.karten + ' Modelltypen, ' +
                aus.stand.mitKarte + ' von ' + aus.stand.modelle + ' Haeusern, ' +
                aus.stand.zellen + ' Zellen, davon leer ' + aus.stand.leer +
                ' und tiefer als ' + aus.stand.luft + ' m: ' + aus.stand.tief);
  console.log('\n== Teil 3: Karte gegen Strahl ==');
  const K = aus.karte;
  console.log('  Proben ' + K.proben + '   beide Loch ' + K.beide +
              '   nur die Karte ' + K.nurKarte + '   nur der Strahl ' + K.nurStrahl);
  console.log('  mittlerer Fehler ' +
              (K.proben ? (K.fehlerSumme / Math.max(1, K.proben - K.beide - K.nurKarte - K.nurStrahl)).toFixed(3) : '-') +
              ' m   groesster ' + K.fehlerMax.toFixed(3) + ' m   ohne Karte ' + K.ohneKarte);
  for (const e of K.bsp) console.log('    ' + JSON.stringify(e));

  console.log('\n== Teil 2: der echte Eingabeweg ==');
  console.log('  Anlaeufe ' + aus.starts + '   angeklebt ' +
              aus.laeufe.filter((l) => l.angeklebt).length +
              '   Kletterbilder ' + aus.zaehler.bilder);
  console.log('  pelvisBehindVisibleFacade     ' + aus.zaehler.pelvis);
  console.log('  chestBehindVisibleFacade      ' + aus.zaehler.chest);
  console.log('  headBehindVisibleFacade       ' + aus.zaehler.head);
  console.log('  climbingWithoutVisibleSurface ' + aus.zaehler.ohne +
              '   (davon vor der Schauseite und unter der Traufe: ' +
              aus.zaehler.ohneEcht + ')');
  console.log('    Bilder neben der Schauseite ' + aus.zaehler.nebenDerFlaeche +
              ', ueber dem Haus ' + aus.zaehler.ueberDemHaus);
  console.log('  Karte sagt Loch, Strahl sieht Wand ' + aus.zaehler.falschesLoch +
              '   umgekehrt ' + aus.zaehler.uebersehenesLoch +
              '   Loslassen ' + aus.zaehler.losgelassen);
  for (const e of (aus.bspLoch || [])) console.log('    ' + JSON.stringify(e));
  const tafel = (nm, topf, bsp) => {
    const zeilen = Object.entries(topf).sort((a, b2) => b2[1] - a[1]);
    console.log('\n  ' + nm + ':');
    if (!zeilen.length) { console.log('    (keine)'); return; }
    for (const [art, n] of zeilen) console.log('    ' + String(n).padStart(5) + '  ' + art);
    for (const [art] of zeilen.slice(0, 4))
      for (const e of ((bsp && bsp[art]) || []).slice(0, 2))
        console.log('      ' + JSON.stringify(e));
  };
  tafel('climbingWithoutVisibleSurface nach Ursache', aus.ursacheOhne, aus.bspOhneArt);
  tafel('Brusttiefe 0,60-1,00 m nach Ursache', aus.ursacheUeber60, aus.bspUrsache);
  tafel('Brusttiefe ueber 1,00 m nach Ursache', aus.ursacheUeber100, aus.bspUrsache);
  console.log('  ---- was die HAND erreicht (Mitte und beide Handstellen) ----');
  console.log('  Grifftiefe ueber 0,30 m ' + aus.zaehler.griff30 +
              '   ueber 0,60 m ' + aus.zaehler.griff60 +
              '   ueber 1,00 m ' + aus.zaehler.griff100 +
              '   ueber 2,00 m ' + aus.zaehler.griff200);
  console.log('  noGripWithinReach ' + aus.zaehler.keinGriff +
              '   (davon vor der Schauseite und unter der Traufe: ' +
              aus.zaehler.keinGriffEcht + ')');
  tafel('noGripWithinReach nach Ursache', aus.ursacheKeinGriff, aus.bspKeinGriff);
  console.log('  ---- was der MITTELSTRAHL trifft ----');
  console.log('  Brusttiefe ueber 0,30 m ' + aus.zaehler.ueber30 +
              '   ueber 0,60 m ' + aus.zaehler.ueber60 +
              '   ueber 1,00 m ' + aus.zaehler.ueber100 +
              '   ueber 2,00 m ' + aus.zaehler.ueber200);
  console.log('\n  je Modelltyp:');
  console.log('  ' + 'Modell'.padEnd(26) + 'Bilder  pelvis   chest    head    ohne     max');
  for (const e of aus.nachTyp)
    console.log('  ' + e.name.padEnd(26) + String(e.bilder).padStart(6) +
                String(e.pelvis).padStart(8) + String(e.chest).padStart(8) +
                String(e.head).padStart(8) + String(e.ohne).padStart(8) +
                (' ' + e.max.toFixed(2)).padStart(8));
  if (aus.bspTief.length) {
    console.log('\n  Beispiele "Brust mehr als 1 m hinter der sichtbaren Fassade":');
    for (const e of aus.bspTief) console.log('    ' + JSON.stringify(e));
  }
  if (aus.bspOhne.length) {
    console.log('\n  Beispiele "gar keine sichtbare Flaeche":');
    for (const e of aus.bspOhne) console.log('    ' + JSON.stringify(e));
  }
  console.log('\n  Laeufe:');
  for (const l of aus.laeufe)
    console.log('    ' + (l.name || '?').padEnd(24) + ' koll ' + String(l.koll).padEnd(6) +
                (l.angeklebt ? ' Bilder ' + String(l.bilder).padStart(4) +
                  '  pelvis ' + String(l.pelvis).padStart(4) +
                  '  chest ' + String(l.chest).padStart(4) +
                  '  head ' + String(l.head).padStart(4) +
                  '  ohne ' + String(l.ohne).padStart(4) +
                  '  max ' + l.maxTiefe
                 : ' NICHT angeklebt'));
  if (JSONAUS) {
    fs.writeFileSync(JSONAUS, JSON.stringify({
      zaehler: aus.zaehler, ursacheOhne: aus.ursacheOhne,
      ursacheUeber60: aus.ursacheUeber60, ursacheUeber100: aus.ursacheUeber100,
      bspUrsache: aus.bspUrsache, bspOhneArt: aus.bspOhneArt }, null, 1));
    console.log('\n  Beispiele geschrieben nach ' + JSONAUS);
  }
  await b.close();
})();
