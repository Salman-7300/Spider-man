/* problem-2, MO1-Arkade: stimmt die Bodenkollision unter der Arkade mit
   der SICHTBAREN Geometrie ueberein?

   Gemessen wird gegen die Dreiecke des Hausmodells selbst - nicht gegen
   das Erdgeschoss-Profil, das das Spiel daraus baut (sonst prueft das
   Spiel sich selbst). Je Haus werden die Dreiecke einmal abgetastet:
     - Grundriss in Koerperhoehe (0,1-1,8 m ueber dem Modellboden),
       Raster 0,05 m: wo steht sichtbar etwas?
     - je Seite die vorderste Flaeche im Erdgeschoss (Koerperhoehe) und im
       Bezugsband darueber (0,30-0,35 Haushoehen): die sichtbare Arkade
       ist, wo das Erdgeschoss mehr als 0,25 m hinter dem Obergeschoss
       liegt und das Obergeschoss buendig mit der Kiste ist,
     - die Arkadendecke: tiefster sichtbarer Punkt ueber 1,9 m vor dem
       Erdgeschoss.

   Faelle: jede MO1-Seite mit sichtbarer Arkade, vor der die Figur
   tatsaechlich stehen kann (kein Nachbarhaus, keine Parkreihe im
   Anlauf). Ablauf mit echter Eingabe und echter Spielkamera
   (d.taste, Tastaturereignisse, d.schritt):
     A  frontal hineingehen (Alt+W), danach frontal hineinrennen (W)
     B  an der Glasfront nach links und nach rechts bis zum Pfeiler
     C  gegen den sichtbaren Pfeiler (Ende von B)
     D  an der Glasfront weiter W, schraeg W+A und W+D
     E  springen und rollen in der Arkade
     F  aus der Arkade hochklettern wollen (Z halten, W, Sprung), dann W
        bis oben
     A3 schraeg in die Arkade rennen (W, etwa 20 Grad zur Normalen)
     P  den Eckpfeiler neben der Arkade von aussen anrennen (Wandlauf)
     S  an der Fassade ueber der Arkade bis zum Boden herunterklettern

   Kennzahlen (je Fall, Summe ueber alle):
     invisibleCollisionInArcade      Figur steht still, obwohl vor ihr
                                     (in Lauf- bzw. Schieberichtung) mehr
                                     als TOL_LUFT sichtbar frei ist
     playerThroughVisiblePillar      Bilder mit sichtbarer Pfeiler-/
                                     Wandgeometrie im Koerper (Radius
                                     R_PEN) - vor der Glasebene
     playerThroughGlassFront         dasselbe an der Glasfront (oder
                                     dahinter)
     playerInsideBuildingFromArcade  Bilder, in denen der Mittelpunkt
                                     hinter der sichtbaren Erdgeschoss-
                                     front liegt
     interiorClimbFromArcade         Kletterzustand an einer Flaeche, die
                                     nicht die Fassade dieser Seite ist,
                                     oder mit dem Mittelpunkt im Haus
     topOutFromArcadeInterior        Ueberziehen (kante) nicht an der
                                     Dachkante, oder der Rumpf lag auf dem
                                     Weg dorthin hinter der sichtbaren
                                     Fassade
   dazu: Kopf in der Arkadendecke, Ortssprung > 0,35 m in einem Bild am
   Boden/in der Luft, Kameraabstand in der Arkade, Wandlauf ja/nein.

   Ankleben aus der Arkade (Climb-Owner, Aufgabe "Arkade und Climb-Owner
   konsistent"): je Fall eine Kategorie aus der SICHTBAREN Geometrie am
   Glas (Spalte des Mittelpunkts, 0,5-2 m ueber dem Boden):
     A  sichtbare Flaeche in Reichweite (Tiefe <= HAUT_MAX)
     B  sichtbare Flaeche, aber tiefer als HAUT_MAX
     C  keine sichtbare Flaeche in der Spalte
     D  der Weg dorthin wird von anderer echter Geometrie (anderes
        Hindernis als das Haus) gestoppt
   und je Bild in A2, A3 und F die Ankleb-Entscheidung des Spiels
   (anklebPruef): blockedOnlyByCoarseOwnerBox zaehlt die Schritte, in
   denen alles fuer das Ankleben sprach (Wand traegt, beim Anrennen auch
   Tempo/Richtung/Hoehe), es aber abgelehnt wurde, weil die Figur in der
   GROBEN Kiste stand, nicht in massiver Geometrie.

   Kontrollen: andere Seiten von ModernOffice_1, ModernOffice_2,
   PublicBuilding_1, FlatFacade, ein MERGED-Haus - gehen, rennen, seitlich,
   springen. Mit modus=beide laeuft alles zweimal (mit und ohne Profil,
   je eine frisch geladene Seite) und die Kontrollen muessen Bild fuer
   Bild gleich sein.

   Aufruf:  node tools/pruef/arcade-collision.js [modus=beide|neu|alt]
            [nur=arkade|kontrolle] [max=12] [json=datei] [vergleich=datei]
            [alt=bodenProfilAlt|bodenOwnerAlt]
   alt=: welcher Stand "vorher" ist - ohne Erdgeschoss-Profil (Vorgabe)
   oder mit Profil, aber Ankleben ueber die grobe Kiste (Stand ba014f6).
   vergleich=: die json-Datei eines frueheren Laufs im anderen Modus -
   damit lassen sich vorher und nachher in zwei Aufrufen fahren (jeder
   unter der Zeitgrenze) und trotzdem Bild fuer Bild vergleichen.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const MODUS = arg('modus', 'beide');
const NUR = arg('nur', null);
const MAX = +arg('max', 12);
const JSON_AUS = arg('json', null);
const VERGLEICH = arg('vergleich', null);
/* nurKoll=<id>: nur die Faelle dieses Hauses; spur=1: Bahn je Bild mit
   Schritt (A, A2, B, ...) in die json-Datei */
const NUR_KOLL = arg('nurKoll', null);
const SPUR = arg('spur', '0') === '1';
const ALT_OPT = arg('alt', 'bodenProfilAlt');

async function fahre(alt) {
  const { b, page } = await starte(320, 180, 4711, alt ? { [ALT_OPT]: true } : {});
  const r = await page.evaluate(async (a) => {
    const d = __dbg, P = d.player, T = window.THREE;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const R = 0.45, R_PEN = 0.40, TOL_LUFT = 0.10, SLAB = 0.25;
    /* Ortssprung: mehr als die normale Absetzkorrektur. Wer an irgendeiner
       Wand bis zum Boden herunterklettert, haengt 0,15 m vor der Flaeche
       und steht danach 0,45 m davor - 0,30 m in einem Bild, ueberall in
       der Stadt (gemessen an buendigen Seiten: 0,301-0,302 m). */
    const SPRUNG_MAX = 0.35;
    const HAUT_MAX = 1.2;                 // wie im Spiel (Reachable Visual Climb Skin V2)
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ'];
    const frei = () => { for (const t of TASTEN) d.taste(t, false); };
    const typ = new Map(), modellVon = new Map();
    for (const o of d.hausModelle()) { const K = o.userData.hausKiste; if (K && K.koll) { typ.set(K.koll, o.userData.modellName); modellVon.set(K.koll, o); } }

    /* ---------- sichtbare Geometrie eines Hauses ---------- */
    const SICHT = new Map();
    /* fein: 0,05 m und die Tiefe je 0,25 m Hoehe bis 20 m (fuer F);
       sonst grob (Fallauswahl): 0,1 m, nur bis ueber das Bezugsband */
    function sicht(c, fein) {
      const key = c.id + ':' + (fein ? 'f' : 'g');
      if (SICHT.has(key)) return SICHT.get(key);
      const obj = modellVon.get(c);
      obj.updateMatrixWorld(true);
      const M = 2.0, Z = 0.05;
      const gx0 = c.x0 - M, gz0 = c.z0 - M, NX = Math.ceil((c.x1 - c.x0 + 2 * M) / Z), NZ = Math.ceil((c.z1 - c.z0 + 2 * M) / Z);
      const koerper = new Uint8Array(NX * NZ);
      const h = c.h - SLAB, bez0 = SLAB + 0.30 * h, bez1 = SLAB + 0.35 * h;
      const yMax = fein ? SLAB + 20 : bez1 + 0.5, schritt = fein ? 0.05 : 0.1;
      const S = 0.05, seiten = {};
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = nx !== 0, l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
        const NL = Math.ceil((l1 - l0) / S);
        seiten[nx + ',' + nz] = { nx, nz, ax, l0, NL, front: ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0),
          boden: new Float32Array(NL).fill(9), bezug: new Float32Array(NL).fill(9), decke: new Float32Array(NL).fill(99),
          hoch: fein ? new Float32Array(NL * 80).fill(9) : null };   // je 0,25 m Hoehe bis 20 m: vorderste Tiefe
      }
      const v = new T.Vector3();
      const abtasten = (fn) => obj.traverse((m) => {
        if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
        const p = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : p.count;
        for (let i = 0; i + 2 < n; i += 3) {
          const P3 = [];
          for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(m.matrixWorld); P3.push(v.x, v.y, v.z); }
          if (Math.min(P3[1], P3[4], P3[7]) > yMax) continue;
          const lang = Math.max(Math.hypot(P3[3] - P3[0], P3[5] - P3[2], P3[4] - P3[1]), Math.hypot(P3[6] - P3[0], P3[8] - P3[2], P3[7] - P3[1]), Math.hypot(P3[6] - P3[3], P3[8] - P3[5], P3[7] - P3[4]));
          const st = Math.min(700, Math.max(1, Math.ceil(lang / schritt)));
          for (let s = 0; s <= st; s++) for (let t = 0; t <= st - s; t++) {
            const u = s / st, w = t / st;
            const y = P3[1] + u * (P3[4] - P3[1]) + w * (P3[7] - P3[1]);
            if (y > yMax) continue;
            fn(P3[0] + u * (P3[3] - P3[0]) + w * (P3[6] - P3[0]), y, P3[2] + u * (P3[5] - P3[2]) + w * (P3[8] - P3[2]));
          }
        }
      });
      const liste = Object.values(seiten);
      abtasten((x, y, z) => {
        const hy = y - SLAB;
        if (hy > 0.1 && hy < 1.8) {
          const ix = Math.floor((x - gx0) / Z), iz = Math.floor((z - gz0) / Z);
          if (ix >= 0 && iz >= 0 && ix < NX && iz < NZ) koerper[iz * NX + ix] = 1;
        }
        for (const sd of liste) {
          const lt = sd.ax ? z : x, dep = sd.ax ? (sd.front - x) * sd.nx : (sd.front - z) * sd.nz;
          if (dep < -1 || dep > 8) continue;
          const il = Math.floor((lt - sd.l0) / S);
          if (il < 0 || il >= sd.NL) continue;
          if (hy > 0.1 && hy < 1.8 && dep < sd.boden[il]) sd.boden[il] = dep;
          if (y >= bez0 && y <= bez1 && dep < sd.bezug[il]) sd.bezug[il] = dep;
          if (sd.hoch) {
            const ih = Math.floor(hy / 0.25);
            if (ih >= 0 && ih < 80 && dep < sd.hoch[ih * sd.NL + il]) sd.hoch[ih * sd.NL + il] = dep;
          }
        }
      });
      /* Decke: tiefster Punkt ueber 1,9 m vor der Erdgeschossfront */
      abtasten((x, y, z) => {
        const hy = y - SLAB;
        if (hy <= 1.9) return;
        for (const sd of liste) {
          const lt = sd.ax ? z : x, dep = sd.ax ? (sd.front - x) * sd.nx : (sd.front - z) * sd.nz;
          const il = Math.floor((lt - sd.l0) / S);
          if (il < 0 || il >= sd.NL) continue;
          if (dep > 0.02 && dep < sd.boden[il] - 0.02 && y < sd.decke[il]) sd.decke[il] = y;
        }
      });
      const e = { c, gx0, gz0, NX, NZ, Z, koerper, seiten };
      SICHT.set(key, e);
      return e;
    }
    /* sichtbare Arkade einer Seite: laengster Abschnitt mit Ruecksprung */
    function arkade(e, nx, nz) {
      const sd = e.seiten[nx + ',' + nz];
      let best = null, s0 = -1;
      for (let i = 0; i <= sd.NL; i++) {
        const ok = i < sd.NL && sd.bezug[i] < 0.15 && sd.boden[i] - sd.bezug[i] > 0.25 && sd.boden[i] < 8;
        if (ok && s0 < 0) s0 = i;
        if (!ok && s0 >= 0) { if (!best || i - s0 > best.n) best = { i0: s0, i1: i - 1, n: i - s0 }; s0 = -1; }
      }
      if (!best || best.n * 0.05 < 1.5) return null;
      /* Tiefe der Glasfront: Median ueber den Abschnitt (an den Enden
         liegt die Fase zum Pfeiler); Decke: tiefster Punkt */
      const t = [];
      let decke = 99;
      for (let i = best.i0; i <= best.i1; i++) { t.push(sd.boden[i]); decke = Math.min(decke, sd.decke[i]); }
      t.sort((p, q) => p - q);
      return { t0: sd.l0 + best.i0 * 0.05, t1: sd.l0 + (best.i1 + 1) * 0.05, tiefe: t[Math.floor(t.length / 2)], tiefeMin: t[0], decke };
    }
    /* Der Koerper ist im Spiel ein QUADRAT mit halber Kante R (collideBody
       rechnet achsweise) - gemessen wird mit demselben Koerper, sonst
       zaehlte jede Innenecke als unsichtbarer Anschlag.
       Liegt in Koerperhoehe im Quadrat (x, z, halbe Kante h) sichtbare
       Geometrie? Liefert den kleinsten achsweisen Abstand (oder 9). */
    const NAECHST = { x: 0, z: 0 };
    function naechste(e, x, z, h) {
      const i0 = Math.floor((x - h - e.gx0) / e.Z), i1 = Math.floor((x + h - e.gx0) / e.Z);
      const j0 = Math.floor((z - h - e.gz0) / e.Z), j1 = Math.floor((z + h - e.gz0) / e.Z);
      let best = 9;
      for (let j = Math.max(0, j0); j <= Math.min(e.NZ - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(e.NX - 1, i1); i++) {
        if (!e.koerper[j * e.NX + i]) continue;
        const cx = e.gx0 + (i + 0.5) * e.Z, cz = e.gz0 + (j + 0.5) * e.Z;
        const dd = Math.max(Math.abs(cx - x), Math.abs(cz - z));
        if (dd < best) { best = dd; NAECHST.x = cx; NAECHST.z = cz; }
      }
      return best;
    }
    /* Laeuft die Figur geradeaus von (x,z) in Richtung (dx,dz), wie weit
       bis die sichtbare Geometrie ihren Koerper (halbe Kante R, wie im
       Spiel) beruehrt? Die Toleranz steckt allein in TOL_LUFT. */
    function sichtFrei(e, x, z, dx, dz, max) {
      for (let s = 0; s <= max; s += 0.01) if (naechste(e, x + dx * s, z + dz * s, R) < R) return s;
      return max;
    }
    function zugang(c, nx, nz, t) {
      const front = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      for (let s = -0.3; s <= 4.5; s += 0.25) {
        const x = nx !== 0 ? front + nx * s : t, z = nz !== 0 ? front + nz * s : t;
        if (Math.abs(d.groundYAt(x, z) - SLAB) > 0.05) return false;
        for (const q of d.colliderNah(x, z)) {
          if (q === c || q.bau === c || (q.h || 0) < 0.3 || (q.y0 !== undefined && q.y0 > 2)) continue;
          if (x > q.x0 - 0.6 && x < q.x1 + 0.6 && z > q.z0 - 0.6 && z < q.z1 + 0.6) return false;
        }
      }
      return true;
    }

    /* ---------- Faelle ---------- */
    /* Kontrollen ZUERST: dann starten sie in beiden Laeufen aus demselben
       Zustand, egal was danach in der Arkade anders verlaeuft. */
    const faelle = [];
    if (a.NUR !== 'arkade') {
      const frei2 = (c, nx, nz) => zugang(c, nx, nz, nx !== 0 ? (c.z0 + c.z1) / 2 : (c.x0 + c.x1) / 2);
      const kandidat = (passt, seiten) => {
        for (const c of d.colliders) {
          if (c.bau !== c || c.klein || c.innen || (c.h || 0) < 10 || !passt(c)) continue;
          for (const s of seiten) if (frei2(c, s[0], s[1])) return [c, s];
        }
        return null;
      };
      const alle4 = [[0, -1], [0, 1], [1, 0], [-1, 0]];
      const k = [
        ['MO1 Seite ohne Arkade +x', (c) => typ.get(c) === 'Downtown_ModernOffice_1', [[1, 0]]],
        ['MO1 Seite ohne Arkade +z', (c) => typ.get(c) === 'Downtown_ModernOffice_1', [[0, 1]]],
        ['ModernOffice_2', (c) => typ.get(c) === 'Downtown_ModernOffice_2', alle4],
        ['PublicBuilding_1', (c) => typ.get(c) === 'Downtown_PublicBuilding_1', alle4],
        ['FlatFacade', (c) => /Brownstone_FlatFacade/.test(typ.get(c) || ''), alle4],
        ['MERGED', (c) => !typ.has(c) && !c.fassade, alle4],
      ];
      for (const [name, passt, seiten] of k) {
        const w = kandidat(passt, seiten);
        if (!w) { faelle.push({ gruppe: 'kontrolle', name: name + ': kein Haus', fehlt: true }); continue; }
        const [c, [nx, nz]] = w;
        faelle.push({ gruppe: 'kontrolle', name: name + ' ' + c.id + ' ' + nx + ',' + nz, koll: c.id, nx, nz,
                      t: nx !== 0 ? (c.z0 + c.z1) / 2 : (c.x0 + c.x1) / 2 });
      }
    }

    if (a.NUR !== 'kontrolle') {
      const arkFaelle = [];
      const mo1 = d.colliders.filter((c) => typ.get(c) === 'Downtown_ModernOffice_1');
      for (const c of mo1) {
        const e = sicht(c, false);
        for (const [nx, nz] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
          const ak = arkade(e, nx, nz);
          if (!ak) continue;
          const t = (ak.t0 + ak.t1) / 2;
          if (!zugang(c, nx, nz, t)) continue;
          arkFaelle.push({ gruppe: 'arkade', name: 'MO1 ' + c.id + ' ' + nx + ',' + nz, koll: c.id, nx, nz, t });
        }
      }
      faelle.push(...arkFaelle.slice(0, a.MAX));
    }
    if (a.NUR_KOLL !== null) {
      const ids = String(a.NUR_KOLL).split('+').map(Number);
      for (let i = faelle.length - 1; i >= 0; i--) if (!ids.includes(faelle[i].koll)) faelle.splice(i, 1);
    }
    /* ---------- Ablauf ---------- */
    const taste = (code, an) => {
      if (code === 'Space' || code === 'ControlLeft') {
        if (an) document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        else document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      }
      d.taste(code, an);
    };
    const aus = [];
    for (const F of faelle) {
      if (F.fehlt) { aus.push(F); continue; }
      const c = d.colliders.find((q) => q.id === F.koll);
      const arkadeFall = F.gruppe === 'arkade';
      const e = arkadeFall ? sicht(c, true) : null;
      const ak = arkadeFall ? arkade(e, F.nx, F.nz) : null;
      const { nx, nz } = F, ax = nx !== 0;
      const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      const tiefeVon = () => ax ? (front - P.pos.x) * nx : (front - P.pos.z) * nz;
      const laengs = () => ax ? P.pos.z : P.pos.x;
      const M = { name: F.name, gruppe: F.gruppe, koll: F.koll, nx, nz, t: +F.t.toFixed(3), invisible: 0, durchPfeiler: 0, durchGlas: 0,
                  imHaus: 0, innenKlettern: 0, topOutInnen: 0, kopfInDecke: 0, ortsSprung: 0, maxSprung: 0,
                  grobBlock: { A2: 0, A3: 0, F: 0 }, abgelehnt: { A2: null, A3: null, F: null }, fremdKontakt: null,
                  bahn: [], schritte: {} };
      if (ak) Object.assign(M, { arkadeTiefe: +ak.tiefe.toFixed(3), arkadeDecke: +ak.decke.toFixed(3),
                                 arkadeVon: +ak.t0.toFixed(2), arkadeBis: +ak.t1.toFixed(2) });
      let vor = null;
      /* ein Bild: Schritt, dann alles messen */
      let wlZahl = 0;
      const bild = (phase) => {
        d.schritt(1 / 60);
        if (arkadeFall && (phase === 'A2' || phase === 'A3' || phase === 'F') && P.state !== 'climb' && P.state !== 'kante') {
          /* Anrennen: nur Bilder, in denen Tempo, Richtung und Hoehe den
             Wandlauf schon erlaubten (WL_LOG ok); Ankleben im Sprung (F):
             jedes Bild in der Luft mit Wandkontakt (Z gehalten) */
          let bereit = false;
          if (phase === 'F') bereit = !!P.wall && !P.onGround;
          else { const L = d.wlLog(); for (let i = wlZahl; i < L.length; i++) if (L[i].ok) bereit = true; wlZahl = L.length; }
          const k = bereit ? d.anklebPruef() : null;
          if (k && k.koll === c.id) {
            if (k.traegt && !k.vonAussen && k.kiste && !k.massiv) M.grobBlock[phase]++;
            if (!M.abgelehnt[phase] && !(k.traegt && k.vonAussen))
              M.abgelehnt[phase] = { traegt: k.traegt, vonAussen: k.vonAussen, kiste: k.kiste, massiv: k.massiv, tiefe: +tiefeVon().toFixed(3) };
          }
          /* Kontakt mit einem anderen Hindernis als dem Haus auf dem Weg? */
          if (P.wall && P.wall.col && P.wall.col.id !== c.id && !M.fremdKontakt) M.fremdKontakt = { id: P.wall.col.id, phase };
        }
        const p = P.pos, tf = tiefeVon(), tl = laengs();
        M.bahn.push(a.SPUR ? [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), P.state, phase, +tf.toFixed(3), +tl.toFixed(3), P.hp, !!P.dead,
                              d.enemies.filter((g) => !g.dead && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 12).length,
                              d.civilians.filter((g) => Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 6).length]
                           : [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), P.state]);
        /* Das erste Bild nach dem Klettern steht noch in der Kletterlage
           (0,15 m vor der Flaeche); aufgeloest wird im naechsten Bild -
           fuer Sprung UND Eindringen zaehlt es deshalb nicht. */
        const ausKlettern = !!vor && (vor[3] === 'climb' || vor[3] === 'kante');
        if (vor && P.state !== 'climb' && P.state !== 'kante' && !ausKlettern) {
          const sp = Math.hypot(p.x - vor[0], p.y - vor[1], p.z - vor[2]);
          if (sp > M.maxSprung) M.maxSprung = +sp.toFixed(3);
          if (sp > SPRUNG_MAX) M.ortsSprung++;
        }
        vor = [p.x, p.y, p.z, P.state];
        if (ausKlettern) return;
        if (!arkadeFall) return;
        const unterDecke = p.y + 0.3 < ak.decke;
        if (P.state !== 'climb' && P.state !== 'kante' && unterDecke && p.y < SLAB + 1.8) {
          const nah = naechste(e, p.x, p.z, R);
          if (nah < R_PEN) {
            /* liegt das Beruehrte vor der Glasebene? dann Pfeiler/Wand */
            const tb = ax ? (front - NAECHST.x) * nx : (front - NAECHST.z) * nz;
            if (tb < ak.tiefeMin - 0.08) M.durchPfeiler++; else M.durchGlas++;
          }
          /* Mittelpunkt hinter der sichtbaren Erdgeschossfront? */
          const sd = e.seiten[nx + ',' + nz], il = Math.floor((tl - sd.l0) / 0.05);
          if (il >= 0 && il < sd.NL && tf > sd.boden[il] + 0.02 && Math.abs(tf) < 3) M.imHaus++;
        }
        if (unterDecke || p.y < ak.decke) {
          /* unter der Decke heisst: der Koerper ragt unter sie (an der
             Kistenebene stehend, tf = -R, ist er davor) */
          if (P.state !== 'climb' && P.state !== 'kante' && tf > -R + 0.01 && p.y + 1.75 > ak.decke + 0.05) M.kopfInDecke++;
        }
      };
      const start = (abstand, tt) => {
        frei();
        /* Ambiente-Gangs, Passanten und Verkehr wachsen ueber die lange
           Spielzeit des Pruefstands nach (gemessen: Gegner bis 12 m an
           die Figur heran). Gemessen wird die Kollision, nicht der Kampf:
           vor jedem Schritt wieder leer. */
        d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
        /* nach einem Sturz im vorigen Fall: wiederbeleben */
        if (P.dead) { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true })); d.taste('Enter', false); }
        P.hp = Math.max(P.hp, 100);
        d.setzePos(ax ? front + nx * abstand : tt, SLAB, ax ? tt : front + nz * abstand);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
        P.facing = Math.atan2(-nx, -nz); d.kamStart(Math.atan2(nx, nz), 0.22);
        P.hockeT = 0; P.landT = 0; P.rollT = 0; P.hartLandung = 0; P.dreiPunktT = 0;
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        vor = null;
      };
      const halte = (codes, n, phase) => { frei(); for (const k of codes) d.taste(k, true); for (let i = 0; i < n; i++) bild(phase); frei(); };

      /* A: gehen */
      start(4, F.t);
      halte(['AltLeft', 'KeyW'], 160, 'A');
      const A = { tiefe: +tiefeVon().toFixed(3), zustand: P.state };
      if (arkadeFall) {
        /* frei vor ihr in Laufrichtung: sichtbare Geometrie ab dem Mittelpunkt */
        const luft = sichtFrei(e, P.pos.x, P.pos.z, -nx, -nz, 2.0);
        A.luft = +luft.toFixed(3);
        A.laengs = +(laengs() - F.t).toFixed(3);
        if (luft > TOL_LUFT) M.invisible++;
      }
      M.schritte.A = A;
      if (arkadeFall) {
        /* Kategorie der Kletterflaeche am Glas: vorderste sichtbare Flaeche
           in der Spalte des Mittelpunkts, 0,5-2 m ueber dem Boden (Median) */
        const sd = e.seiten[nx + ',' + nz], il = Math.floor((laengs() - sd.l0) / 0.05);
        const t = [];
        if (il >= 0 && il < sd.NL) for (let ih = 2; ih < 8; ih++) { const v = sd.hoch[ih * sd.NL + il]; if (v < 8) t.push(v); }
        t.sort((p2, q) => p2 - q);
        const dv = t.length ? t[Math.floor(t.length / 2)] : null;
        M.flaeche = { tiefe: dv === null ? null : +dv.toFixed(3), zeilen: t.length };
        M.kategorie = dv === null ? 'C' : dv <= HAUT_MAX ? 'A' : 'B';
      }
      /* A2: rennen */
      start(4, F.t);
      let an = null;
      d.wlLogAn(true); wlZahl = 0;
      { frei(); d.taste('KeyW', true);
        for (let i = 0; i < 150; i++) { bild('A2'); if (P.state === 'climb' && !an) an = { tiefe: +tiefeVon().toFixed(3), y: +P.pos.y.toFixed(2), wand: P.wallInfo ? [P.wallInfo.col.id, P.wallInfo.nx, P.wallInfo.nz] : null }; }
        frei(); }
      d.wlLogAn(false);
      M.schritte.A2 = { wandlauf: !!an, an, tiefe: +tiefeVon().toFixed(3), y: +P.pos.y.toFixed(2) };
      if (an && arkadeFall && (an.wand[0] !== c.id || an.wand[1] !== nx || an.wand[2] !== nz)) M.innenKlettern++;
      /* A3: schraeg hineinrennen - 1,5 m seitlich versetzt auf die Mitte
         des Abschnitts zu (gut 20 Grad zur Normalen), nur W */
      if (arkadeFall) {
        start(4, F.t);
        const qx = ax ? 0 : 1, qz = ax ? 1 : 0;                     // laengs der Seite
        const sx = (ax ? front + nx * 4 : F.t + 1.5), sz = (ax ? F.t + 1.5 : front + nz * 4);
        const zx = ax ? front : F.t, zz = ax ? F.t : front;
        d.setzePos(sx, SLAB, sz);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
        const rx = zx - sx, rz = zz - sz, rl = Math.hypot(rx, rz);
        P.facing = Math.atan2(rx / rl, rz / rl); d.kamStart(Math.atan2(-rx / rl, -rz / rl), 0.22);
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        vor = null;
        let an3 = null;
        d.wlLogAn(true); wlZahl = 0;
        frei(); d.taste('KeyW', true);
        for (let i = 0; i < 150; i++) { bild('A3'); if (P.state === 'climb' && !an3) an3 = { tiefe: +tiefeVon().toFixed(3), y: +P.pos.y.toFixed(2), laengs: +(laengs() - F.t).toFixed(2), wand: P.wallInfo ? [P.wallInfo.col.id, P.wallInfo.nx, P.wallInfo.nz] : null }; }
        frei(); d.wlLogAn(false);
        M.schritte.A3 = { wandlauf: !!an3, an: an3, tiefe: +tiefeVon().toFixed(3), y: +P.pos.y.toFixed(2), qx, qz };
        if (an3 && (an3.wand[0] !== c.id || an3.wand[1] !== nx || an3.wand[2] !== nz)) M.innenKlettern++;
      }

      /* B/C: an der Glasfront (bzw. an der Wand) seitlich bis zum Anschlag */
      for (const [seite, code] of [['links', 'KeyA'], ['rechts', 'KeyD']]) {
        start(4, F.t);
        halte(['AltLeft', 'KeyW'], 160, 'B');
        const t0 = laengs();
        frei(); d.taste('AltLeft', true); d.taste(code, true); d.taste('KeyW', true);
        let still = 0, letzt = laengs();
        d.kollLogAn(true); d.kollLogHol();
        let stopper = new Set();
        for (let i = 0; i < 400 && still < 20; i++) {
          bild('B');
          const l = laengs();
          still = Math.abs(l - letzt) < 0.004 ? still + 1 : 0;
          letzt = l;
          /* wer drueckt die Figur laengs der Fassade zurueck? */
          const k = d.kollLogHol().filter((q) => q.art === 'seitlich' && (ax ? q.korrektur[1] !== 0 : q.korrektur[0] !== 0));
          if (still > 0) for (const q of k) stopper.add(q.id);
        }
        d.kollLogAn(false);
        frei();
        const B = { weg: +(laengs() - t0).toFixed(3), tiefe: +tiefeVon().toFixed(3) };
        /* Anschlag an einem ANDEREN Hindernis (Nachbarhaus vor einem Teil
           der Arkade): gehoert nicht zur Arkade dieses Hauses */
        const fremd = [...stopper].filter((id) => id !== c.id);
        if (fremd.length) B.anschlag = fremd.map((id) => { const q = d.colliders.find((w) => w.id === id); return id + ' ' + (typ.get(q) || (q && !q.fassade && q.bau === q ? 'MERGED' : 'Hindernis')); });
        if (arkadeFall) {
          /* Schieberichtung laengs der Fassade */
          const lx = ax ? 0 : (laengs() > t0 ? 1 : -1), lz = ax ? (laengs() > t0 ? 1 : -1) : 0;
          const luft = sichtFrei(e, P.pos.x, P.pos.z, lx, lz, 2.0);
          B.luft = +luft.toFixed(3);
          /* nur in der Arkade: wer sie verlassen hat (um die Hausecke,
             zurueck auf den Gehweg), steht nicht mehr unter ihr */
          const drin = tiefeVon() > -R + 0.05 && laengs() > ak.t0 && laengs() < ak.t1;
          B.inArkade = drin;
          if (luft > TOL_LUFT && still >= 20 && drin && !B.anschlag) M.invisible++;
        }
        M.schritte['B' + seite] = B;
      }
      /* D: an der Glasfront weiter druecken, schraeg */
      start(4, F.t);
      halte(['AltLeft', 'KeyW'], 160, 'D');
      halte(['AltLeft', 'KeyW'], 40, 'D');
      halte(['AltLeft', 'KeyW', 'KeyA'], 40, 'D');
      halte(['AltLeft', 'KeyW', 'KeyD'], 40, 'D');
      M.schritte.D = { tiefe: +tiefeVon().toFixed(3) };
      /* E: springen und rollen */
      start(4, F.t);
      halte(['AltLeft', 'KeyW'], 160, 'E');
      /* Sprung auf der Stelle (an der Glasfront), dann Rollen auf das Glas
         zu und laengs der Arkade - nur am Boden/in der Luft gemessen */
      let yMax = 0, deckeStoss = 0;
      d.kollLogAn(true); d.kollLogHol();
      taste('Space', true); taste('Space', false);
      for (let i = 0; i < 70; i++) { bild('E'); if (P.state !== 'climb' && P.state !== 'kante') yMax = Math.max(yMax, P.pos.y); }
      deckeStoss += d.kollLogHol().filter((q) => q.art === 'decke').length;
      frei();
      d.taste('AltLeft', true); d.taste('KeyW', true); taste('ControlLeft', true); taste('ControlLeft', false);
      for (let i = 0; i < 60; i++) bild('E');
      frei(); d.taste('AltLeft', true); d.taste('KeyA', true); taste('ControlLeft', true); taste('ControlLeft', false);
      for (let i = 0; i < 60; i++) bild('E');
      frei(); d.taste('AltLeft', true); d.taste('KeyD', true); taste('ControlLeft', true); taste('ControlLeft', false);
      for (let i = 0; i < 60; i++) bild('E');
      frei();
      d.kollLogHol(); d.kollLogAn(false);
      M.schritte.E = { kopfMax: +(yMax + 1.75).toFixed(3), deckeStoss, tiefe: +tiefeVon().toFixed(3), zustand: P.state };
      /* Kamera in der Arkade */
      start(4, F.t);
      halte(['AltLeft', 'KeyW'], 160, 'K');
      for (let i = 0; i < 90; i++) bild('K');
      const cam = d.camera.position, kopf = [P.pos.x, P.pos.y + 1.7, P.pos.z];
      M.schritte.K = { kamAbstand: +Math.hypot(cam.x - kopf[0], cam.y - kopf[1], cam.z - kopf[2]).toFixed(3) };
      /* F: aus der Arkade hochklettern wollen */
      start(4, F.t);
      halte(['AltLeft', 'KeyW'], 160, 'F');
      frei(); d.taste('KeyZ', true); d.taste('KeyW', true);
      taste('Space', true); taste('Space', false);
      let fan = null, kante = null, maxHinter = 0;
      /* bis 1100 Bilder: die hoechsten MO1 (38 m) brauchen gut 14 s bis zur Kante */
      for (let i = 0; i < 1100; i++) {
        bild('F');
        if (P.state === 'climb' && !fan) {
          fan = { tiefe: +tiefeVon().toFixed(3), y: +P.pos.y.toFixed(2), wand: P.wallInfo ? [P.wallInfo.col.id, P.wallInfo.nx, P.wallInfo.nz] : null };
          if (fan.wand && (fan.wand[0] !== c.id || fan.wand[1] !== nx || fan.wand[2] !== nz)) M.innenKlettern++;
          if (arkadeFall) {
            const sd = e.seiten[nx + ',' + nz], il = Math.floor((laengs() - sd.l0) / 0.05);
            if (il >= 0 && il < sd.NL && tiefeVon() > sd.boden[il] + 0.02) M.innenKlettern++;
          }
        }
        if (P.state === 'climb' && arkadeFall) {
          /* Rumpf hinter der sichtbaren Fassade in seiner Hoehe? */
          const sd = e.seiten[nx + ',' + nz], il = Math.floor((laengs() - sd.l0) / 0.05);
          const ih = Math.floor((P.pos.y + 1.0 - SLAB) / 0.25);
          if (il >= 0 && il < sd.NL && ih >= 0 && ih < 80) maxHinter = Math.max(maxHinter, tiefeVon() - sd.hoch[ih * sd.NL + il]);
        }
        if (P.state === 'kante' && !kante) kante = { y: +P.pos.y.toFixed(2), hoch: +(P.kante && P.kante.hoch || 0).toFixed(2) };
        if (kante && P.state === 'ground') break;
      }
      frei();
      if (kante && (kante.hoch < c.h - 0.5 || maxHinter > 0.15)) M.topOutInnen++;
      M.schritte.F = { an: fan, kante, maxHinter: +maxHinter.toFixed(3), ende: P.state, y: +P.pos.y.toFixed(2) };
      /* P: der Eckpfeiler neben der Arkade - von aussen anrennen (W).
         Der Pfeiler steht buendig an der Kiste und bleibt Fassade: der
         Wandlauf soll dort greifen wie vorher. Gerannt wird auf die
         Pfeilermitte, sofern davor frei ist. */
      if (arkadeFall) {
        const sd = e.seiten[nx + ',' + nz], ende = sd.l0 + sd.NL * 0.05;
        let tp = null;
        for (const [von, schritt] of [[ak.t1, 1], [ak.t0, -1]]) {
          let a0 = null, a1 = null;
          for (let q = von + schritt * 0.025; q > sd.l0 && q < ende; q += schritt * 0.05) {
            const il = Math.floor((q - sd.l0) / 0.05);
            const buendig = sd.boden[il] < 0.06 && sd.bezug[il] < 0.15;
            if (buendig && a0 === null) a0 = q;
            if (!buendig && a0 !== null) break;
            if (buendig) a1 = q;
          }
          if (a0 !== null && Math.abs(a1 - a0) > 0.3 && zugang(c, nx, nz, (a0 + a1) / 2)) { tp = (a0 + a1) / 2; break; }
        }
        if (tp !== null) {
          start(4, tp);
          let pan = null;
          frei(); d.taste('KeyW', true);
          for (let i = 0; i < 150; i++) {
            bild('P');
            if (P.state === 'climb' && !pan) pan = { tiefe: +tiefeVon().toFixed(3), wand: P.wallInfo ? [P.wallInfo.col.id, P.wallInfo.nx, P.wallInfo.nz] : null };
          }
          frei();
          M.schritte.P = { t: +tp.toFixed(2), wandlauf: !!pan, an: pan };
          if (pan && pan.wand && (pan.wand[0] !== c.id || pan.wand[1] !== nx || pan.wand[2] !== nz)) M.innenKlettern++;
        } else M.schritte.P = { t: null };
        /* S: an der Fassade ueber der Arkade haengen (wie kletterproxy.js:
           Kletterzustand an der Kiste, neue Haut) und mit S bis zum Boden
           herunterklettern. Die Kletterhaut fuehrt die Figur unten an die
           zurueckgesetzte Glasfront; am Boden steht sie im Erdgeschoss-
           Profil. Gemessen: Ortssprung (auch im Uebergangsbild), im Haus,
           durchs Glas. */
        frei();
        d.setzePos(ax ? front + nx * 0.15 : F.t, ak.decke + 1.5, ax ? F.t : front + nz * 0.15);
        P.vel.set(0, 0, 0); P.state = 'climb'; P.onGround = false;
        P.wallInfo = P.wall = { nx, nz, col: c };
        P.eckSperre = 0; P.wandUebergaenge = 0; P.hockeT = 0; P.perchMix = 0;
        P.hautTiefe = 0; P.eckBogen = null; P.eckT = 0;
        d.kamStart(Math.atan2(nx, nz), 0.1);
        for (let i = 0; i < 20; i++) d.schritt(1 / 60);
        vor = null;
        d.taste('KeyS', true);
        let unten = -1, sMax = 0, alt = null;
        for (let i = 0; i < 500; i++) {
          bild('S');
          const q = [P.pos.x, P.pos.y, P.pos.z];
          if (alt) sMax = Math.max(sMax, Math.hypot(q[0] - alt[0], q[1] - alt[1], q[2] - alt[2]));
          alt = q;
          if (P.state !== 'climb' && unten < 0) { unten = i; d.taste('KeyS', false); }
          if (unten >= 0 && i > unten + 60) break;
        }
        frei();
        M.schritte.S = { unten, tiefe: +tiefeVon().toFixed(3), y: +P.pos.y.toFixed(2), laengs: +(laengs() - F.t).toFixed(3),
                         zustand: P.state, maxSprung: +sMax.toFixed(3) };
        if (sMax > SPRUNG_MAX) M.ortsSprung++;
      }
      /* D: auf dem Weg zum Glas stoppte ein anderes Hindernis als das Haus */
      if (arkadeFall && M.fremdKontakt) M.kategorie = 'D';
      if (!arkadeFall) M.bahnHash = M.bahn.map((q) => q.slice(0, 4).join(',')).join(';');
      M.bilder = M.bahn.length;
      if (!a.SPUR) delete M.bahn;
      aus.push(M);
    }
    return { aus, kollider: d.colliders.length,
             profile: d.colliders.filter((c) => d.bodenProfil && d.bodenProfil(c.id)).length,
             profilTeile: d.colliders.reduce((s, c) => s + (d.bodenProfil && d.bodenProfil(c.id) ? d.bodenProfil(c.id).teile.length : 0), 0) };
  }, { NUR, MAX, NUR_KOLL, SPUR });
  await b.close();
  return r;
}

(async () => {
  const laeufe = {};
  if (MODUS === 'beide' || MODUS === 'alt') laeufe.alt = await fahre(true);
  if (MODUS === 'beide' || MODUS === 'neu') laeufe.neu = await fahre(false);
  if (JSON_AUS) fs.writeFileSync(JSON_AUS, JSON.stringify(laeufe, null, 1));
  if (VERGLEICH) {
    const anders = JSON.parse(fs.readFileSync(VERGLEICH, 'utf8'));
    for (const k of ['alt', 'neu']) if (!laeufe[k] && anders[k]) laeufe[k] = anders[k];
  }
  const KZ = ['invisible', 'durchPfeiler', 'durchGlas', 'imHaus', 'innenKlettern', 'topOutInnen', 'kopfInDecke', 'ortsSprung'];
  const NAMEN = { invisible: 'invisibleCollisionInArcade', durchPfeiler: 'playerThroughVisiblePillar', durchGlas: 'playerThroughGlassFront',
                  imHaus: 'playerInsideBuildingFromArcade', innenKlettern: 'interiorClimbFromArcade', topOutInnen: 'topOutFromArcadeInterior',
                  kopfInDecke: 'Kopf in der Arkadendecke', ortsSprung: 'Ortssprung > 0,35 m' };
  for (const [modus, r] of Object.entries(laeufe)) {
    console.log('\n=== ' + (modus === 'alt' ? 'VORHER (' + (ALT_OPT === 'bodenOwnerAlt' ? 'Profil, Ankleben ueber die grobe Kiste' : 'ohne Erdgeschoss-Profil') + ')' : 'NACHHER (aktueller Stand)') +
                '  Kollider ' + r.kollider + ', Haeuser mit Profil ' + r.profile + ', Profil-Rechtecke ' + r.profilTeile);
    for (const M of r.aus) {
      if (M.fehlt) { console.log('  ' + M.name); continue; }
      const s = M.schritte;
      console.log('  ' + M.name.padEnd(34) + (M.arkadeTiefe !== undefined ? ' Arkade ' + M.arkadeTiefe.toFixed(2) + ' m tief, Decke ' + (M.arkadeDecke - 0.25).toFixed(2) + ' m' : ''));
      console.log('     A gehen: Tiefe ' + s.A.tiefe.toFixed(3) + (s.A.luft !== undefined ? '  frei davor ' + s.A.luft.toFixed(3) : '') +
                  '   A2 rennen: ' + (s.A2.wandlauf ? 'Wandlauf bei Tiefe ' + s.A2.an.tiefe.toFixed(3) : 'kein Wandlauf, Tiefe ' + s.A2.tiefe.toFixed(3)) +
                  '   B links ' + s.Blinks.weg.toFixed(2) + (s.Blinks.luft !== undefined ? ' (frei ' + s.Blinks.luft.toFixed(2) + ')' : '') +
                  (s.Blinks.anschlag ? ' [Nachbar ' + s.Blinks.anschlag.join(',') + ']' : '') +
                  ' rechts ' + s.Brechts.weg.toFixed(2) + (s.Brechts.luft !== undefined ? ' (frei ' + s.Brechts.luft.toFixed(2) + ')' : '') +
                  (s.Brechts.anschlag ? ' [Nachbar ' + s.Brechts.anschlag.join(',') + ']' : ''));
      if (s.P) console.log('     P Eckpfeiler ' + (s.P.t === null ? 'nicht frei erreichbar' : 'bei ' + s.P.t + ': ' + (s.P.wandlauf ? 'Wandlauf bei Tiefe ' + s.P.an.tiefe.toFixed(3) + ' an ' + JSON.stringify(s.P.an.wand) : 'kein Wandlauf')) +
                           (s.S ? '   S herunter: ' + (s.S.unten < 0 ? 'nicht unten' : 'unten nach ' + s.S.unten + ' Bildern, Tiefe ' + s.S.tiefe.toFixed(3) + ', laengs ' + s.S.laengs.toFixed(2) + ', groesster Sprung ' + s.S.maxSprung.toFixed(3) + ' m') : ''));
      console.log('     D Tiefe ' + s.D.tiefe.toFixed(3) + '   E Kopf max ' + s.E.kopfMax.toFixed(2) + (s.E.deckeStoss ? ' (Decke ' + s.E.deckeStoss + 'x)' : '') + '   Kamera ' + s.K.kamAbstand.toFixed(2) + ' m' +
                  '   F ' + (s.F.an ? 'Klettern ab Tiefe ' + s.F.an.tiefe.toFixed(3) + ' an ' + JSON.stringify(s.F.an.wand) : 'kein Klettern') +
                  (s.F.kante ? ', Ueberziehen bei ' + s.F.kante.hoch + ' m' : '') + ', hinter Fassade max ' + s.F.maxHinter.toFixed(2) +
                  '   max. Ortssprung ' + M.maxSprung.toFixed(3));
      if (M.kategorie) {
        const ja = (v) => v ? 'ja' : 'nein';
        const g = M.grobBlock, ab = M.abgelehnt;
        console.log('     Ankleben: Kategorie ' + M.kategorie + (M.flaeche && M.flaeche.tiefe !== null ? ' (Flaeche ' + M.flaeche.tiefe.toFixed(2) + ' m)' : '') +
                    '   F aus dem Stand ' + ja(s.F.an) + '   A2 Wandlauf ' + ja(s.A2.wandlauf) + '   A3 schraeg ' + ja(s.A3 && s.A3.wandlauf) +
                    (s.A3 && s.A3.an ? ' (bei Tiefe ' + s.A3.an.tiefe.toFixed(3) + ')' : '') +
                    '   nur grobe Kiste: A2 ' + g.A2 + ' A3 ' + g.A3 + ' F ' + g.F +
                    (M.fremdKontakt ? '   anderes Hindernis ' + M.fremdKontakt.id + ' in ' + M.fremdKontakt.phase : ''));
        const abl = ['A2', 'A3', 'F'].filter((q) => ab[q] && !(q === 'F' ? s.F.an : s[q] && s[q].wandlauf));
        if (abl.length) console.log('       abgelehnt: ' + abl.map((q) => q + ' ' + JSON.stringify(ab[q])).join('  '));
      }
      const k = KZ.filter((q) => M[q] > 0).map((q) => NAMEN[q] + ' ' + M[q]);
      if (k.length) console.log('     !! ' + k.join(', '));
    }
    const ark = r.aus.filter((M) => M.gruppe === 'arkade' && !M.fehlt);
    console.log('  Summe Arkade (' + ark.length + ' Faelle): ' + KZ.map((q) => NAMEN[q] + ' = ' + ark.reduce((s, M) => s + M[q], 0)).join(', '));
    const kat = {};
    for (const M of ark) kat[M.kategorie] = (kat[M.kategorie] || 0) + 1;
    const katA = ark.filter((M) => M.kategorie === 'A');
    const nGrob = ark.filter((M) => M.grobBlock.A2 + M.grobBlock.A3 + M.grobBlock.F > 0).length;
    console.log('  Ankleben aus der Arkade: Kategorien ' + JSON.stringify(kat) +
                '   in A: aus dem Stand ' + katA.filter((M) => M.schritte.F.an).length + '/' + katA.length +
                ', Wandlauf frontal ' + katA.filter((M) => M.schritte.A2.wandlauf).length + '/' + katA.length +
                ', schraeg ' + katA.filter((M) => M.schritte.A3 && M.schritte.A3.wandlauf).length + '/' + katA.length +
                ', ueberzogen ' + katA.filter((M) => M.schritte.F.kante).length + '/' + katA.length +
                '   blockedOnlyByCoarseOwnerBox = ' + nGrob + ' Faelle (' +
                ark.reduce((s2, M) => s2 + M.grobBlock.A2 + M.grobBlock.A3 + M.grobBlock.F, 0) + ' Bilder)');
  }
  if (laeufe.alt && laeufe.neu) {
    console.log('\n=== Arkade vorher -> nachher');
    for (const M of laeufe.neu.aus.filter((q) => q.gruppe === 'arkade' && !q.fehlt)) {
      const A = laeufe.alt.aus.find((q) => q.name === M.name);
      if (!A) continue;
      const wl = (q) => q.schritte.A2.wandlauf ? 'ja' : 'nein', kl = (q) => q.schritte.F.an ? 'ja' : 'nein';
      const w3 = (q) => q.schritte.A3 ? (q.schritte.A3.wandlauf ? 'ja' : 'nein') : '-';
      const pf = (q) => !q.schritte.P || q.schritte.P.t === null ? '-' : q.schritte.P.wandlauf ? 'ja' : 'nein';
      console.log('  ' + M.name.padEnd(16) + ' Glas ' + M.arkadeTiefe.toFixed(2) + ' m   gehen: Tiefe ' + A.schritte.A.tiefe.toFixed(3) + ' -> ' + M.schritte.A.tiefe.toFixed(3) +
                  ' (frei davor ' + A.schritte.A.luft.toFixed(2) + ' -> ' + M.schritte.A.luft.toFixed(2) + ')   Wandlauf ' + wl(A) + ' -> ' + wl(M) +
                  '   schraeg ' + w3(A) + ' -> ' + w3(M) +
                  '   Klettern aus F ' + kl(A) + ' -> ' + kl(M) + '   Pfeiler ' + pf(A) + ' -> ' + pf(M) + '   Kat ' + (M.kategorie || '-'));
    }
    console.log('\n=== Kontrollen alt/neu Bild fuer Bild');
    let gleich = 0, n = 0;
    for (const M of laeufe.neu.aus.filter((q) => q.gruppe === 'kontrolle' && !q.fehlt)) {
      const A = laeufe.alt.aus.find((q) => q.name === M.name);
      n++;
      const ok = A && A.bahnHash === M.bahnHash;
      if (ok) gleich++;
      console.log('  ' + M.name.padEnd(34) + (ok ? 'gleich (' + M.bilder + ' Bilder)' : 'VERSCHIEDEN'));
    }
    console.log('  Kontrollen gleich: ' + gleich + '/' + n);
  }
})();
