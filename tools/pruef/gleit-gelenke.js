/* problem-3, Blocker 3: Gleitflug mit W - Gelenke im Koerpersystem.

   Human-Befund (54-58 s): ein Bein sehr hoch, das andere unten, Arm- und
   Beinketten nicht gespiegelt. Dieser Pruefstand fliegt die Folge aus
   dem Human-Test nach - normaler Gleitflug, W halten, kurze W-Stoesse,
   A, D, W+A, W+D, Sturzflug, zurueck ins Gleiten - und prueft in JEDEM
   Bild, nach dem vollstaendigen Schritt (Mischer, Loeser, Nacharbeiten), im koerpereigenen System der Figur
   (x quer, links negativ; y hoch; z in Flugrichtung):

     Arme   linkes Handgelenk x < 0, rechtes x > 0 (keine Mittellinie
            gekreuzt), Ellbogen auf der eigenen Seite, Ellbogen gebeugt
            (Winkel unter 172 Grad), Ellbogen und Haende links/rechts auf
            aehnlicher Hoehe
     Beine  Knie und Knoechel auf der eigenen Seite, Knie und Knoechel
            tiefer als das Becken und hinter ihm, kein Knie Richtung
            Kopf, links/rechts kleine Hoehen- und Laengsunterschiede
            (kein Spagat)
     Rumpf  Kopf vor dem Becken (in Flugrichtung)

   Die Schwellen kommen aus dem Rig: Oberschenkel-, Unterschenkel-,
   Oberarmlaenge und Hueftbreite in der Ruhe gemessen.

   Aufruf:  node tools/pruef/gleit-gelenke.js [bilder=ordner] [gelenkAlt]
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
const ALT = process.argv.indexOf('gelenkAlt') > 0;
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

/* Die Folge: [Tasten, Bilder] */
const FOLGE = [
  ['', 90, 'Gleiten'],
  ['W', 180, 'W halten'],
  ['', 90, 'los'],
  ['W', 8, 'W-Stoss'], ['', 20, ''], ['W', 8, 'W-Stoss'], ['', 20, ''], ['W', 8, 'W-Stoss'], ['', 20, ''],
  ['W', 12, 'W-Stoss'], ['', 20, ''], ['W', 12, 'W-Stoss'], ['', 40, ''],
  ['A', 90, 'A'], ['D', 90, 'D'],
  ['WA', 90, 'W+A'], ['WD', 90, 'W+D'],
  ['W', 200, 'Sturzflug'],
  ['', 150, 'zurueck ins Gleiten'],
];

(async () => {
  const { b, page } = await starte(960, 540, 4711, ALT ? { gelenkAlt: true } : {});
  const r = await page.evaluate(async (O) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
    for (const t of TASTEN) d.taste(t, false);
    const N = ['hips', 'head', 'leftarm', 'rightarm', 'leftforearm', 'rightforearm', 'lefthand', 'righthand',
               'leftupleg', 'rightupleg', 'leftleg', 'rightleg', 'leftfoot', 'rightfoot'];
    const V = (a) => [a.x, a.y, a.z];
    const ab = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    /* Rig-Masse in der Ruhe (am Boden stehend) */
    d.setzePos(-120, 0.25, -40); P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    for (let i = 0; i < 30; i++) d.schritt(1 / 60);
    const R = d.animKnochenLokal(N);
    const links = R.leftupleg.x < 0 ? 1 : -1;   // links soll negativ sein
    const M = {
      oberschenkel: (ab(R.leftupleg, R.leftleg) + ab(R.rightupleg, R.rightleg)) / 2,
      unterschenkel: (ab(R.leftleg, R.leftfoot) + ab(R.rightleg, R.rightfoot)) / 2,
      oberarm: (ab(R.leftarm, R.leftforearm) + ab(R.rightarm, R.rightforearm)) / 2,
      huefte: Math.abs(R.leftupleg.x - R.rightupleg.x),
    };
    /* Schwellen aus dem Rig */
    const S = {
      armHoehe: 0.5 * M.oberarm,        // Ellbogen/Hand links gegen rechts
      beinHoehe: 0.35 * M.oberschenkel, // Knie links gegen rechts
      fussHoehe: 0.35 * M.unterschenkel,
      beinLaengs: 0.35 * M.oberschenkel,
      fussLaengs: 0.35 * M.unterschenkel,
      kopfKnie: M.oberschenkel + M.unterschenkel,
    };
    /* hoch ueber der Stadt, ins Gleiten */
    /* hoch genug, dass die ganze Folge im Gleitflug bleibt (Sturzflug
       sinkt bis 28 m/s) */
    d.setzePos(-120, 320, -40);
    P.vel.set(0, 0, 18); P.facing = 0; P.state = 'air'; P.onGround = false;
    P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0; P.gleitKurve = 0;
    d.kamStart(Math.PI, 0.22);
    d.taste('ShiftLeft', true);
    for (let i = 0; i < 300; i++) { d.schritt(1 / 60); if (P.gleiten && (P.gleitMisch || 0) >= 0.99) break; }
    const zaehl = { bilder: 0, fehler: 0 };
    const art = {};
    const beispiele = [];
    const bilder = [], nah = [];
    const winkel = (a, m, e) => {
      const ux = a.x - m.x, uy = a.y - m.y, uz = a.z - m.z, vx = e.x - m.x, vy = e.y - m.y, vz = e.z - m.z;
      const c = (ux * vx + uy * vy + uz * vz) / (Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1);
      return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
    };
    let nr = 0;
    for (const [tasten, n, name] of O.FOLGE) {
      d.taste('KeyW', tasten.indexOf('W') >= 0);
      d.taste('KeyA', tasten.indexOf('A') >= 0);
      d.taste('KeyD', tasten.indexOf('D') >= 0);
      for (let i = 0; i < n; i++, nr++) {
        d.schritt(1 / 60);
        /* Die Knochen stehen nach dem Schritt endgueltig (Mischer, Loeser,
           alle Nacharbeiten); gezeichnet wird nur fuer die Videobilder. */
        if (O.bilder && nr % 4 === 0) bilder.push(d.bildDaten(0.8));
        /* Nah: 3 m hinter der Figur, 1 m seitlich, 0,8 m hoeher */
        if (O.bilder && nr % 8 === 0 && P.gleiten) {
          const fx = Math.sin(P.facing), fz = Math.cos(P.facing);
          d.aufnahme(P.pos.x - fx * 3 + fz * 1.0, P.pos.y + 1.6, P.pos.z - fz * 3 - fx * 1.0, P.pos.x, P.pos.y + 0.8, P.pos.z);
          nah.push(d.bildDaten(0.85));
        }
        if (!P.gleiten) continue;
        const K = d.animKnochenLokal(N);
        for (const k of Object.values(K)) k.x *= links;
        const h = K.hips, f = [];
        for (const [s, sg] of [['left', -1], ['right', 1]]) {
          const wr = K[s + 'hand'], el = K[s + 'forearm'], sh = K[s + 'arm'];
          const kn = K[s + 'leg'], an = K[s + 'foot'];
          if (wr.x * sg <= 0) f.push(s + 'Handgelenk ueber der Mittellinie');
          if (el.x * sg <= 0) f.push(s + 'Ellbogen ueber der Mittellinie');
          if (winkel(sh, el, wr) > 172) f.push(s + 'Ellbogen gestreckt');
          if (kn.x * sg <= 0) f.push(s + 'Knie ueber der Mittellinie');
          if (an.x * sg <= 0) f.push(s + 'Knoechel ueber der Mittellinie');
          if (kn.y >= h.y) f.push(s + 'Knie ueber dem Becken');
          if (an.y >= h.y) f.push(s + 'Knoechel ueber dem Becken');
          if (kn.z >= h.z) f.push(s + 'Knie vor dem Becken');
          if (an.z >= h.z) f.push(s + 'Knoechel vor dem Becken');
          if (ab(kn, K.head) < S.kopfKnie * 0.75) f.push(s + 'Knie am Kopf');
        }
        const L = (a) => K['left' + a], Rr = (a) => K['right' + a];
        if (Math.abs(L('forearm').y - Rr('forearm').y) > S.armHoehe) f.push('Ellbogen ungleich hoch');
        if (Math.abs(L('hand').y - Rr('hand').y) > S.armHoehe) f.push('Haende ungleich hoch');
        if (Math.abs(L('leg').y - Rr('leg').y) > S.beinHoehe) f.push('Knie ungleich hoch');
        if (Math.abs(L('foot').y - Rr('foot').y) > S.fussHoehe) f.push('Fuesse ungleich hoch');
        if (Math.abs(L('leg').z - Rr('leg').z) > S.beinLaengs) f.push('Spagat Knie');
        if (Math.abs(L('foot').z - Rr('foot').z) > S.fussLaengs) f.push('Spagat Fuesse');
        if (K.head.z <= h.z) f.push('Kopf hinter dem Becken');
        zaehl.bilder++;
        if (f.length) {
          zaehl.fehler++;
          for (const x of f) art[x] = (art[x] || 0) + 1;
          if (beispiele.length < 16 && (beispiele.length === 0 || nr - beispiele[beispiele.length - 1].nr > 20))
            beispiele.push({ nr, phase: name, sturz: !!P.sturzflug, clip: d.animClipJetzt, nase: +(P.gleitNase || 0).toFixed(2),
                             f: f.join(', '),
                             knie: [V(L('leg')), V(Rr('leg'))].map((v) => v.map((x) => +x.toFixed(2))),
                             fuss: [V(L('foot')), V(Rr('foot'))].map((v) => v.map((x) => +x.toFixed(2))),
                             becken: V(h).map((x) => +x.toFixed(2)) });
        }
      }
    }
    for (const t of TASTEN) d.taste(t, false);
    return { M, S, zaehl, art, beispiele, bilder, nah };
  }, { FOLGE, bilder: !!BILDER });
  const f3 = (x) => +x.toFixed(3);
  console.log('Rig: Oberschenkel ' + f3(r.M.oberschenkel) + '  Unterschenkel ' + f3(r.M.unterschenkel) +
              '  Oberarm ' + f3(r.M.oberarm) + '  Hueftbreite ' + f3(r.M.huefte));
  console.log('Schwellen: ' + JSON.stringify(Object.fromEntries(Object.entries(r.S).map(([k, v]) => [k, f3(v)]))));
  console.log('Bilder im Gleitflug ' + r.zaehl.bilder + '   mit Verstoss ' + r.zaehl.fehler);
  for (const [k, v] of Object.entries(r.art).sort((a, b) => b[1] - a[1])) console.log('  ' + String(v).padStart(5) + '  ' + k);
  for (const e of r.beispiele) console.log('    ' + JSON.stringify(e));
  if (BILDER) {
    r.bilder.forEach((u, i) => fs.writeFileSync(BILDER + '/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(u.split(',')[1], 'base64')));
    fs.mkdirSync(BILDER + '/nah', { recursive: true });
    r.nah.forEach((u, i) => fs.writeFileSync(BILDER + '/nah/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(u.split(',')[1], 'base64')));
  }
  console.log(r.zaehl.fehler === 0 ? 'GLEITGELENKE: bestanden' : 'GLEITGELENKE: NICHT bestanden (' + r.zaehl.fehler + ' Bilder)');
  await b.close();
})();
