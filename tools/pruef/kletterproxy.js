/* problem-3, Blocker 1: klettert die Figur an der SICHTBAREN Fassade?

   Gemessen wird gegen die sichtbare Geometrie des Hauses selbst - nicht
   gegen den Kollider und nicht gegen die Tiefenkarte, die das Spiel
   benutzt. Sonst prueft das Spiel sich selbst.

   Je Haustyp (GLB-Modelle und prozedurale Tuerme) werden Haeuser mit
   einer freien Schauseite gesucht. Die Figur wird an die Wand gesetzt
   (Kletterzustand, wie zeilenuebergang.js) und klettert: hinauf,
   seitwaerts, wieder hinauf. In jedem Bild, auf Brust- und
   Beckenhoehe (echte Knochen):

     chestBehindVisibleSurface   zwischen Brust und Strasse liegt eine
                                 sichtbare Flaeche (Brust steckt in der
                                 Fassade oder im Innenraum)
     pelvisBehindVisibleSurface  dasselbe fuer das Becken
     climbingInVisualVoid        hinter Brust UND Becken ist innerhalb
                                 LEERE_M keine sichtbare Flaeche, weder
                                 mittig noch 0,2 m links oder rechts -
                                 der Rumpf haengt vor einem Loch
     climbingOnRawBoxFace        die Figur steht auf der Kolliderebene,
                                 obwohl die sichtbare Flaeche an ihrer
                                 Stelle mehr als 0,25 m dahinter liegt

   Getrennt gezaehlt, KEIN Fehler (problem-3, finaler Pass; die 32
   Becken- und 52 Kistenfaelle von bf24ab6 waren genau das):
     hinter Anbau    die Flaeche vor Brust/Becken liegt an der aeusseren
                     Huelle (<= 0,1 m hinter der Kiste: Feuerleiter-
                     Gelaender, Podest, Nischensturz), und hinter dem
                     Punkt steht innerhalb 0,75 m eine sichtbare Wand
     an Element      die Figur steht auf der Kistenebene, aber im
                     Greifbereich liegt dort ein sichtbares Element
                     (Podest, Sims) hoechstens 0,25 m dahinter

   Sichtbar ist: jedes Mesh des Hausmodells; beim Turm nur Tragwerk und
   Scheiben (keine Moebel, keine Lampen).

   Aufruf:  node tools/pruef/kletterproxy.js [je=3] [bilder=ordner] [video=Typ] [alle] [nur=Typ,...]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const jArg = process.argv.find((v) => v.indexOf('je=') === 0);
const JE = jArg === undefined ? 3 : +jArg.slice(3);
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
const vArg = process.argv.find((v) => v.indexOf('video=') === 0);
const VIDEO = vArg === undefined ? null : vArg.slice(6);
const ALT = process.argv.indexOf('proxyAlt') > 0;
/* alle freien Schauseiten statt nur der ersten; nur=Typ,Typ */
const ALLE = process.argv.indexOf('alle') > 0;
const nArg = process.argv.find((v) => v.indexOf('nur=') === 0);
const NUR = nArg === undefined ? null : nArg.slice(4).split(',');
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, ALT ? { proxyAlt: true } : {});
  const aus = await page.evaluate(async (O) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const LEERE_M = 0.75;
    const ANBAU_M = 0.1;
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyZ', 'Space', 'KeyX'];
    const frei = () => { for (const t of TASTEN) d.taste(t, false); };
    const RC = new THREE.Raycaster();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    /* sichtbare Meshes eines Hauses */
    const sichtbar = (o) => {
      const l = [];
      o.traverse((k) => {
        if (!k.isMesh) return;
        if (o.userData.modellName && o.userData.modellName.indexOf('Turm_') === 0 &&
            k.name !== 'Structure' && k.name !== 'Glazing') return;
        l.push(k);
      });
      return l;
    };
    /* Haeuser je Typ mit einer freien Schauseite */
    const typen = new Map();
    for (const o of d.hausModelle()) {
      const K = o.userData.hausKiste, n = o.userData.modellName;
      if (!K || !n || !K.koll) continue;
      if (!typen.has(n)) typen.set(n, []);
      typen.get(n).push(o);
    }
    const frei1m = (c, nx, nz, y, t) => {
      const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 0.6 : t;
      const pz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * 0.6 : t;
      for (const q of d.colliderNah(px, pz)) {
        if (q === c || q.innen || q.parkAuto) continue;
        const y0 = q.y0 === undefined ? -1e9 : q.y0;
        if (px > q.x0 - 0.5 && px < q.x1 + 0.5 && pz > q.z0 - 0.5 && pz < q.z1 + 0.5 && y > y0 && y < (q.h || 0)) return false;
      }
      return true;
    };
    const faelle = [];
    for (const [typ, liste] of typen) {
      if (O.video && typ !== O.video) continue;
      if (O.nur && O.nur.indexOf(typ) < 0) continue;
      let n = 0;
      for (const o of liste) {
        if (n >= O.je) break;
        const K = o.userData.hausKiste, c = K.koll;
        let wahl = null;
        for (const [nx, nz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
          const tm = nx !== 0 ? (c.z0 + c.z1) / 2 : (c.x0 + c.x1) / 2;
          const ym = 0.25 + K.h * 0.3;
          let ok = true;
          for (const f of [0.25, 0.5, 0.75]) {
            const t = nx !== 0 ? c.z0 + (c.z1 - c.z0) * f : c.x0 + (c.x1 - c.x0) * f;
            if (!frei1m(c, nx, nz, ym, t) || !frei1m(c, nx, nz, ym + 4, t)) ok = false;
          }
          if (ok) {
            if (O.alle) faelle.push({ typ, o, K, c, nx, nz });
            else { wahl = [nx, nz, tm]; break; }
          }
        }
        if (O.alle) { n++; continue; }
        if (!wahl) continue;
        n++;
        faelle.push({ typ, o, K, c, nx: wahl[0], nz: wahl[1] });
      }
    }
    const ergebnis = [];
    const bilder = [];
    for (const F of faelle) {
      const { o, K, c, nx, nz } = F;
      const meshes = sichtbar(o);
      o.updateMatrixWorld(true);
      const achseX = nx !== 0;
      const l0 = achseX ? c.z0 : c.x0, l1 = achseX ? c.z1 : c.x1;
      const front = achseX ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      /* Start: an drei Laengsstellen, je ein eigener Lauf */
      for (const f of [0.3, 0.5, 0.7]) {
        const t = l0 + (l1 - l0) * f, y = 0.25 + K.h * 0.25;
        /* ---- Nur dort starten, wo das Spiel ankleben wuerde ----
           problem-2, Reachable Visual Climb Skin. Liegt die sichtbare
           Flaeche tiefer als HAUT_MAX (ModernOffice_1: Ruecksprung 2,9 bis
           3,5 m), klebt die Figur dort nicht an. Frueher wurde sie trotzdem
           hingesetzt; gemessen wurde dann ein Zustand, den es im Spiel
           nicht gibt. Solche Startstellen werden gezaehlt, nicht
           gefahren. */
        const sx = achseX ? front + nx * 0.15 : t, sz = achseX ? t : front + nz * 0.15;
        if (d.wandTraegtDbg && d.wandTraegtDbg(c.id, nx, nz, y + 1.0, sx, sz) === false) {
          ergebnis.push({ typ: F.typ, koll: c.id, nx, nz, f, nichtAnklebbar: true });
          continue;
        }
        frei();
        d.setzePos(achseX ? front + nx * 0.15 : t, y, achseX ? t : front + nz * 0.15);
        P.vel.set(0, 0, 0); P.state = 'climb'; P.onGround = false;
        P.wallInfo = P.wall = { nx, nz, col: c };
        P.eckSperre = 0; P.wandUebergaenge = 0; P.hockeT = 0; P.perchMix = 0;
        /* wie ein echter Ansprung (siehe updatePlayer): neue Wand, neue
           Haut. Sonst traegt der Lauf Hauttiefe und Eckbogen des vorigen
           Laufs (anderes Haus) mit - gemessen: 12 Bilder Becken hinter der
           Flaeche an einer geraden Seite, Haut 0,03, hautTiefe noch 0,86. */
        P.hautTiefe = 0; P.eckBogen = null; P.eckT = 0;
        d.kamStart(Math.atan2(nx, nz), 0.1);
        const st = { typ: F.typ, koll: c.id, nx, nz, f, bilder: 0, brust: 0, becken: 0, void: 0,
                     roh: 0, losgelassen: 0, maxSprung: 0, tiefeMax: 0, beispiele: [] };
        let vor = null, nr = 0;
        const plan = [['KeyW', 70], ['KeyD', 60], ['KeyW', 50], ['KeyA', 90], ['KeyW', 50]];
        for (const [taste, n] of plan) {
          frei(); d.taste(taste, true);
          for (let i = 0; i < n; i++) {
            d.schritt(1 / 60);
            /* die ersten 20 Bilder nach dem Umsetzen stellt sich die
               Haltung erst ein - sie zaehlen nicht */
            if (++nr <= 20) continue;
            if (P.state !== 'climb' || !P.wallInfo || P.wallInfo.col !== c) { st.losgelassen++; continue; }
            /* gemessen wird an der Wand, an der sie JETZT haengt (nach
               einer Aussenecke ist das die Querflaeche); waehrend des
               Eckbogens selbst nicht */
            if (P.eckBogen || (P.eckT || 0) > 0) { st.ecke = (st.ecke || 0) + 1; continue; }
            const wnx = P.wallInfo.nx, wnz = P.wallInfo.nz;
            if (vor) st.maxSprung = Math.max(st.maxSprung, Math.hypot(P.pos.x - vor[0], P.pos.y - vor[1], P.pos.z - vor[2]));
            vor = [P.pos.x, P.pos.y, P.pos.z];
            st.bilder++;
            const kn = d.animKnochen(['spine2', 'hips']);
            let brustH = false, beckenH = false, leer = 0, brustA = false, beckenA = false;
            for (const [q, k] of [['brust', kn.spine2], ['becken', kn.hips]]) {
              if (!k) continue;
              /* von aussen zum Punkt: liegt eine Flaeche davor? */
              const aussen = V(k.x + wnx * 3, k.y, k.z + wnz * 3);
              RC.set(aussen, V(-wnx, 0, -wnz)); RC.near = 0; RC.far = 3 - 0.02;
              const vorn = RC.intersectObjects(meshes, false);
              if (vorn.length) {
                /* ---- Hinter einer Auskragung, vor der Wand? ----
                   problem-3, finaler Pass. Liegt die verdeckende Flaeche
                   an der aeusseren Huelle (hoechstens ANBAU_M hinter der
                   Kistenebene: Feuerleiter-Gelaender, Podest, Sturz einer
                   Nische) UND hat der Punkt eine sichtbare Wand hinter
                   sich (LEERE_M), haengt die Figur zwischen Anbau und
                   Wand - wie an einer echten Feuerleiter. Das ist kein
                   Koerper hinter der Kletterflaeche; es wird getrennt
                   gezaehlt (hinterAnbau), nicht als Fehler. */
                const tiefeVorn = vorn[0].distance - 3;
                RC.set(V(k.x, k.y, k.z), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = LEERE_M;
                const wandDahinter = RC.intersectObjects(meshes, false).length > 0;
                const anbau = tiefeVorn <= ANBAU_M && wandDahinter;
                if (q === 'brust') { if (anbau) brustA = true; else brustH = true; }
                else { if (anbau) beckenA = true; else beckenH = true; }
              }
              /* vom Punkt nach innen: liegt in Rumpfbreite (Mitte und
                 +-0,2 m quer) innerhalb LEERE_M eine Flaeche? Eine
                 schmale Fensterlaibung neben dem Mauerpfeiler ist kein
                 Loch. */
              let traegt = false;
              for (const q2 of [0, -0.2, 0.2]) {
                RC.set(V(k.x + wnz * q2, k.y, k.z - wnx * q2), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = LEERE_M;
                if (RC.intersectObjects(meshes, false).length) { traegt = true; break; }
              }
              if (!traegt) leer++;
            }
            /* Dasselbe entlang der Flaechennormale, an der die Figur haengt
               (P.hautN): an einer schraegen Flaeche liegt die Flaeche
               entlang der Kistennormale um 1/cos weiter weg - an einer
               60-Grad-Fase genau an der 0,75-m-Grenze. An einer geraden
               Wand ist beides gleich. */
            let leerN = 0;
            {
              const hn = P.hautN && P.hautTiefe > 0.02 ? P.hautN : { x: wnx, z: wnz };
              const kn3 = d.animKnochen(['spine2', 'hips']);
              for (const k of [kn3.spine2, kn3.hips]) {
                if (!k) continue;
                let traegt = false;
                for (const q2 of [0, -0.2, 0.2]) {
                  RC.set(V(k.x + hn.z * q2, k.y, k.z - hn.x * q2), V(-hn.x, 0, -hn.z)); RC.near = 0; RC.far = LEERE_M;
                  if (RC.intersectObjects(meshes, false).length) { traegt = true; break; }
                }
                if (!traegt) leerN++;
              }
            }
            if (leerN === 2) st.voidN = (st.voidN || 0) + 1;
            /* ---- Schraege Fassaden (problem-3, finaler struktureller Pass) ----
               koerperImHaus: Kopf, Schultern oder Hueften hinter einer
               sichtbaren Flaeche (Strahl von aussen, wie bei Brust/Becken).
               Dazu am Becken: Normale der sichtbaren Flaeche gegen die
               Proxy-Normale der Figur (P.hautN), und der Abstand von Becken
               und Brust zur Flaeche entlang der Normale. */
            {
              const kn2 = d.animKnochen(['head', 'leftarm', 'rightarm', 'leftupleg', 'rightupleg', 'hips', 'spine2']);
              let drin = false;
              for (const q of ['head', 'leftarm', 'rightarm', 'leftupleg', 'rightupleg']) {
                const k = kn2[q]; if (!k) continue;
                RC.set(V(k.x + wnx * 3, k.y, k.z + wnz * 3), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = 3 - 0.02;
                const vorn = RC.intersectObjects(meshes, false);
                if (vorn.length && !(vorn[0].distance - 3 <= ANBAU_M)) { drin = true; break; }
              }
              if (drin || brustH || beckenH) st.koerper = (st.koerper || 0) + 1;
              const hn = P.hautN && P.hautTiefe > 0.02 ? P.hautN : { x: wnx, z: wnz };
              for (const [q, feld] of [['hips', 'abBecken'], ['spine2', 'abBrust']]) {
                const k = kn2[q]; if (!k) continue;
                RC.set(V(k.x, k.y, k.z), V(-hn.x, 0, -hn.z)); RC.near = 0; RC.far = 3;
                const t = RC.intersectObjects(meshes, false);
                if (!t.length) continue;
                (st[feld] || (st[feld] = [])).push(t[0].distance);
                if (q === 'hips' && t[0].face) {
                  const nm = new THREE.Matrix3().getNormalMatrix(t[0].object.matrixWorld);
                  const nv = t[0].face.normal.clone().applyMatrix3(nm).normalize();
                  const l = Math.hypot(nv.x, nv.z);
                  if (l > 0.3) {
                    const cw = (nv.x * hn.x + nv.z * hn.z) / l;
                    (st.winkel || (st.winkel = [])).push(Math.acos(Math.max(-1, Math.min(1, cw))) * 180 / Math.PI);
                  }
                }
              }
            }
            const wx = wnx !== 0;
            const wfront = wx ? (wnx > 0 ? c.x1 : c.x0) : (wnz > 0 ? c.z1 : c.z0);
            const ebene = wx ? (P.pos.x - wfront) * wnx : (P.pos.z - wfront) * wnz;
            const tiefe = d.fassadenProxyTiefe ? d.fassadenProxyTiefe(c.id, wnx, wnz, P.pos.y, wx ? P.pos.z : P.pos.x) : null;
            if (tiefe !== null && tiefe > st.tiefeMax && tiefe < 1e8) st.tiefeMax = tiefe;
            const rohHuelle = Math.abs(ebene - 0.15) < 0.02 && tiefe !== null && tiefe > 0.25 && tiefe < 1e8;
            /* ---- Wirklich die rohe Kistenflaeche? ----
               Nur, wenn im Greifbereich (+-0,3 m quer, Huefte bis ueber
               den Kopf, beim Steigen mit derselben Vorausschau wie das
               Spiel) KEINE sichtbare Flaeche nahe der Kistenebene liegt
               (hoechstens 0,25 m dahinter). Steht dort ein Podest oder
               ein Sims, haengt die Figur an etwas Sichtbarem. */
            let roh = rohHuelle;
            if (rohHuelle) {
              const oben = 0.8 + Math.max(0, P.vel.y) * 0.25;
              for (const hq of [-0.3, 0, 0.3]) for (const hy of [-0.3, 0.25, oben * 0.5 + 0.1, oben]) {
                const ox = wx ? wfront + wnx * 3 : P.pos.x + hq, oz = wx ? P.pos.z + hq : wfront + wnz * 3;
                RC.set(V(ox, P.pos.y + hy, oz), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = 3 + 0.25;
                if (RC.intersectObjects(meshes, false).length) roh = false;
              }
              if (!roh) st.rohEcht = (st.rohEcht || 0) + 1;
            }
            if (brustH) st.brust++;
            if (beckenH) st.becken++;
            if (brustA) st.brustA = (st.brustA || 0) + 1;
            if (beckenA) st.beckenA = (st.beckenA || 0) + 1;
            if (leer === 2) {
              st.void++;
              if (O.bilder && !st.voidBild) {
                st.voidBild = true; d.zeichne();
                bilder.push({ name: 'VOID-' + F.typ + '-k' + c.id + '-f' + f + '-b' + st.bilder, u: d.bildDaten(0.8) });
              }
            }
            if (roh) st.roh++;
            /* ---- Einzelfall (problem-3, finaler Pass) ----
               Je zusammenhaengender Episode ein Eintrag: was liegt an der
               Stelle wirklich, und wie tief? Tiefen in m hinter der
               Kistenebene (positiv = im Haus). */
            const art = beckenH ? 'becken' : roh ? 'roh' : null;
            if (art) {
              const ep = st.episoden || (st.episoden = []);
              const letzte = ep[ep.length - 1];
              if (letzte && letzte.art === art && st.bilder - letzte.bis <= 2) { letzte.bis = st.bilder; letzte.n++; }
              else {
                const tiefeVon = (k) => k ? +((wx ? (wfront - k.x) * wnx : (wfront - k.z) * wnz)).toFixed(2) : null;
                const kn3 = d.animKnochen(['spine2', 'hips', 'head']);
                /* sichtbare Flaeche vor dem Becken: erster Treffer von aussen */
                const hk = kn3.hips;
                RC.set(V(hk.x + wnx * 3, hk.y, hk.z + wnz * 3), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = 6;
                const tr = RC.intersectObjects(meshes, false);
                const tt = wx ? P.pos.z : P.pos.x;
                const ll0 = wx ? c.z0 : c.x0, ll1 = wx ? c.z1 : c.x1;
                ep.push({ art, von: st.bilder, bis: st.bilder, n: 1, typ: F.typ, koll: c.id, seite: [wnx, wnz],
                          pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
                          sichtbar: tr.length ? +(tr[0].distance - 3).toFixed(2) : null,
                          mesh: tr.length ? (tr[0].object.name || tr[0].object.type) : null,
                          haut: tiefe === null ? null : +(+tiefe).toFixed(2), hautJetzt: +(d.hautTiefeJetzt()).toFixed(2),
                          kiste: 0, figur: +(-ebene + 0.15).toFixed(2),
                          becken: tiefeVon(kn3.hips), brust: tiefeVon(kn3.spine2), kopf: tiefeVon(kn3.head),
                          rand: +Math.min(tt - ll0, ll1 - tt).toFixed(2) });
                if (O.bilder && ep.length <= 4) {
                  const px = hk.x + wnx * 1.6 + (wx ? 0 : 1.6), pz = hk.z + wnz * 1.6 + (wx ? 1.6 : 0);
                  d.aufnahme(px, hk.y + 0.6, pz, hk.x, hk.y, hk.z);
                  bilder.push({ name: 'FALL-' + art + '-' + F.typ + '-k' + c.id + '-s' + wnx + '_' + wnz + '-f' + f + '-b' + st.bilder, u: d.bildDaten(0.85) });
                }
              }
            }
            if ((brustH || beckenH || leer === 2) && st.beispiele.length < 3)
              st.beispiele.push({ y: +P.pos.y.toFixed(2), t: +(wx ? P.pos.z : P.pos.x).toFixed(2), n: [wnx, wnz], ebene: +ebene.toFixed(3),
                                  brustH, beckenH, leer, tiefe: tiefe === null ? null : +(+tiefe).toFixed(2) });
            if (O.bilder && f === 0.5 && i === n - 1 && taste !== 'KeyA') {
              d.zeichne();
              bilder.push({ name: F.typ + '-k' + c.id + '-' + taste + '-' + st.bilder, u: d.bildDaten(0.8) });
            }
          }
        }
        frei();
        st.seitenwechsel = P.hautSeitenwechsel || 0; P.hautSeitenwechsel = 0;
        ergebnis.push(st);
      }
    }
    return { ergebnis, bilder };
  }, { je: JE, bilder: !!BILDER, video: VIDEO, alle: ALLE, nur: NUR });
  /* Startstellen, an denen das Spiel nicht ankleben wuerde (Tiefe >
     HAUT_MAX): getrennt ausgewiesen, nicht gefahren. */
  const nichtAn = aus.ergebnis.filter((e) => e.nichtAnklebbar);
  aus.ergebnis = aus.ergebnis.filter((e) => !e.nichtAnklebbar);
  console.log('Startstellen ohne Ankleben (sichtbare Flaeche > HAUT_MAX): ' + nichtAn.length +
              (nichtAn.length ? '  ' + nichtAn.map((e) => e.koll + ':' + e.nx + ',' + e.nz + ' f' + e.f).join('  ') : ''));
  const sum = {};
  for (const e of aus.ergebnis) {
    const s = sum[e.typ] || (sum[e.typ] = { laeufe: 0, bilder: 0, brust: 0, becken: 0, void: 0, roh: 0, los: 0, sprung: 0, tiefe: 0 });
    s.laeufe++; s.bilder += e.bilder; s.brust += e.brust; s.becken += e.becken; s.void += e.void;
    s.roh += e.roh; s.los += e.losgelassen;
    s.brustA = (s.brustA || 0) + (e.brustA || 0); s.beckenA = (s.beckenA || 0) + (e.beckenA || 0); s.rohEcht = (s.rohEcht || 0) + (e.rohEcht || 0); s.sprung = Math.max(s.sprung, e.maxSprung); s.tiefe = Math.max(s.tiefe, e.tiefeMax);
  }
  console.log('Typ                          Laeufe Bilder  chestBehind pelvisBehind  inVisualVoid  onRawBoxFace  losgelassen  maxSprung  Proxytiefe max');
  const ges = { bilder: 0, brust: 0, becken: 0, void: 0, roh: 0 };
  for (const [t, s] of Object.entries(sum)) {
    console.log('  ' + t.padEnd(27) + String(s.laeufe).padStart(6) + String(s.bilder).padStart(7) + String(s.brust).padStart(13) +
                String(s.becken).padStart(13) + String(s.void).padStart(14) + String(s.roh).padStart(14) +
                String(s.los).padStart(13) + s.sprung.toFixed(3).padStart(11) + s.tiefe.toFixed(2).padStart(16));
    for (const k of Object.keys(ges)) ges[k] += s[k];
  }
  console.log('  GESAMT  Bilder ' + ges.bilder + '  chestBehindVisibleSurface ' + ges.brust + '  pelvisBehindVisibleSurface ' + ges.becken +
              '  climbingInVisualVoid ' + ges.void + '  climbingOnRawBoxFaceWhenProxyExists ' + ges.roh);
  let bA = 0, brA = 0, rE = 0;
  for (const s of Object.values(sum)) { bA += s.beckenA || 0; brA += s.brustA || 0; rE += s.rohEcht || 0; }
  console.log('  getrennt gezaehlt (kein Fehler): Brust hinter Anbau ' + brA + '  Becken hinter Anbau ' + bA +
              '  Kistenebene an sichtbarem Element ' + rE);
  for (const e of aus.ergebnis) if (e.beispiele.length)
    console.log('    ' + e.typ + ' koll ' + e.koll + ' f ' + e.f + ' ' + JSON.stringify(e.beispiele));
  const q = (a, p) => { if (!a || !a.length) return null; const b = a.slice().sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2); };
  if (NUR) for (const e of aus.ergebnis)
    console.log('    Lauf ' + e.typ + ' koll ' + e.koll + ' Seite ' + e.nx + ',' + e.nz + ' f ' + e.f + '  Bilder ' + e.bilder +
                '  Brust ' + e.brust + '  Becken ' + e.becken + '  Koerper ' + (e.koerper || 0) + '  Loch ' + e.void + '  Kiste ' + e.roh +
                '  Haut max ' + e.tiefeMax.toFixed(2) + '  Winkel p50/p95 ' + q(e.winkel, 0.5) + '/' + q(e.winkel, 0.95) +
                '  Becken-Abst p05/p50 ' + q(e.abBecken, 0.05) + '/' + q(e.abBecken, 0.5) + '  Brust-Abst p05/p50 ' + q(e.abBrust, 0.05) + '/' + q(e.abBrust, 0.5) +
                '  Seitenwechsel ' + (e.seitenwechsel || 0) + '  Loch(Flaechennormale) ' + (e.voidN || 0));
  { let k = 0; for (const e of aus.ergebnis) k += e.koerper || 0; console.log('  playerCutsFacade (Kopf/Schultern/Hueften/Brust/Becken hinter sichtbarer Flaeche): ' + k); }
  { let k = 0; for (const e of aus.ergebnis) k += e.voidN || 0; console.log('  climbingInVisualVoid entlang der Flaechennormale (P.hautN): ' + k); }
  const epi = [];
  for (const e of aus.ergebnis) for (const x of (e.episoden || [])) epi.push(Object.assign({ f: e.f }, x));
  if (epi.length) {
    console.log('\n  Einzelfaelle (Episoden; Tiefen in m hinter der Kistenebene):');
    for (const x of epi) console.log('    ' + JSON.stringify(x));
  }
  if (BILDER) for (const x of aus.bilder)
    fs.writeFileSync(path.join(BILDER, x.name + '.jpg'), Buffer.from(x.u.split(',')[1], 'base64'));
  await b.close();
})();
