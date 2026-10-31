/* CITY V2, Stufe 6B: Was kosten die Strassendetails je Kamera?

   An denselben 300 Stellen wie stadt-leistung.js (5 x 5 Blockmitten,
   Strasse / Dach / Luft, je vier Blickrichtungen) werden Zeichenaufrufe
   und Dreiecke nach Kategorie aufgeschluesselt: Baum, Baumscheibe,
   Pflanzscheibe, Bank, Muelleimer, Pflanzkuebel, Poller, Uhr, Kiosk und
   Bestand (alles andere; die Instanzfelder des Bestands - Ampel,
   Laterne, Eckpoller, Beet - zusaetzlich getrennt).

   Zwei Lesarten:
     eingefroren  wie stadt-leistung.js: das Spiel steht, nur die Kamera
                  wandert. Die Instanzfelder bleiben so belegt, wie sie um
                  die Figur am Startpunkt stehen - an jeder Stelle gleich.
     spielnah     die Figur steht an der Kamera, die Felder werden wie im
                  Spiel nachgezogen (updateMoebelSicht ueber
                  __dbg.setzeMoebelSicht).

   Die Felder werden nicht nach Sichtkegel geschnitten (frustumCulled
   false). Ihre Kosten folgen deshalb exakt aus Belegung und Geometrie:
   je Feld mit mindestens einer Instanz ein Aufruf je Materialgruppe -
   ein leeres Feld (count 0) zeichnet three.js r128 nicht
   (renderInstances bricht bei 0 ab) -, Dreiecke = count x Dreiecke je
   Stueck. Das rechnet der Pruefstand je Kategorie und prueft die Summe an
   JEDER Stelle gegen zwei echte Bilder: mit und ohne alle 6A-Felder.

   Dazu je Art: Sichtweite, Hoehe, Bildpunkte bei 50 bis 185 m, und was
   eine andere Sichtweite kostete (sicht=Muelleimer:80,Poller:100 -
   gerechnet ueber die Lage der Stuecke, ohne das Spiel zu aendern).

   Aufruf:  node tools/pruef/sd-leistung.js [aus.json] [sicht=Art:m,...]
              [lesart=beide|eingefroren|spielnah]
   ========================================================================= */
const fs = require('node:fs');
const { starte, ausgabePfad } = require('./basis');

const zielDatei = ausgabePfad(process.argv[2]);
const sArg = process.argv.find((v) => v.indexOf('sicht=') === 0);
const SICHT_NEU = {};
if (sArg) for (const t of sArg.slice(6).split(',')) { const [k, v] = t.split(':'); if (k && v) SICHT_NEU[k] = +v; }
const lArg = process.argv.find((v) => v.indexOf('lesart=') === 0);
const LESART = lArg ? lArg.slice(7) : 'beide';

(async () => {
  const { b, page } = await starte(1280, 720, 4711, {});
  const aus = await page.evaluate(({ SICHT_NEU, LESART }) => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const R = d.raster();
    const KAT = { StrassenBaum: 'Baum', Baumscheibe: 'Baumscheibe', Pflanzscheibe: 'Pflanzscheibe',
                  StrassenBank: 'Bank', StrassenMuelleimer: 'Muelleimer', StrassenPflanzkuebel: 'Pflanzkuebel',
                  StrassenPoller: 'Poller', StrassenUhr: 'Uhr', StrassenKiosk: 'Kiosk' };
    const ARTEN = ['Baum', 'Baumscheibe', 'Pflanzscheibe', 'Bank', 'Muelleimer', 'Pflanzkuebel', 'Poller', 'Uhr', 'Kiosk'];
    /* Felder: alle InstancedMesh der Szene */
    const felder = [];
    d.szene.traverse((o) => {
      if (!o.isInstancedMesh) return;
      const g = o.geometry, m = o.material;
      const gruppen = Array.isArray(m) && g.groups.length ? g.groups.length : 1;
      const tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
      felder.push({ o, kat: KAT[o.name] || null, gruppen, tri, name: o.name || '' });
    });
    const sd = felder.filter((f) => f.kat);
    const bestandFelder = felder.filter((f) => !f.kat);
    /* Lage der Stuecke je Art (fuer andere Sichtweiten) */
    const LISTE = d.strassenDetails ? d.strassenDetails() : [];
    const orte = {};
    for (const a of ARTEN) orte[a] = LISTE.filter((e) => e.art === a).map((e) => [e.x, e.z]);
    const Y = 0.25;
    const zaehle = (art, px, py, pz, w) => {
      let n = 0;
      const w2 = w * w;
      for (const [x, z] of orte[art]) { const dx = x - px, dy = Y - py, dz = z - pz; if (dx * dx + dy * dy + dz * dz <= w2) n++; }
      return n;
    };
    const kosten = () => {
      const k = {};
      for (const a of ARTEN) k[a] = { felder: 0, aufrufe: 0, dreiecke: 0, stueck: 0 };
      for (const f of sd) {
        if (!f.o.visible) continue;
        const q = k[f.kat];
        q.felder++;
        if (f.o.count > 0) q.aufrufe += f.gruppen;
        q.dreiecke += f.o.count * f.tri;
        q.stueck += f.o.count;
      }
      let bf = 0, bfTri = 0;
      for (const f of bestandFelder) {
        if (!f.o.visible) continue;
        if (f.o.count > 0) bf += f.gruppen;
        bfTri += f.o.count * f.tri;
      }
      return { k, bestandFelder: { aufrufe: bf, dreiecke: bfTri } };
    };
    const stuetz = (a0, a1, n) => { const r = []; for (let i = 0; i < n; i++) r.push(a0 + (a1 - a0) * (i + 0.5) / n); return r; };
    const xs = stuetz(R.x0, R.x1, 5), zs = stuetz(R.z0, R.z1, 5);
    const RICHTUNG = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const LAGEN = [{ name: 'strasse', y: 2.2, ziel: 2.0 }, { name: 'dach', y: 42, ziel: 30 }, { name: 'luft', y: 120, ziel: 20 }];
    const bild = (px, py, pz, zx, zy, zz, n) => { let r = null; for (let i = 0; i < n; i++) { d.aufnahme(px, py, pz, zx, zy, zz); r = d.renderInfo(); } return { calls: r.calls, dreiecke: r.dreiecke }; };
    const start = { x: d.player.pos.x, y: d.player.pos.y, z: d.player.pos.z };
    const ergebnis = { start, felderSD: sd.map((f) => ({ name: f.name, kat: f.kat, gruppen: f.gruppen, tri: f.tri, countStart: f.o.count })),
                       felderBestand: bestandFelder.length, lesarten: {} };
    for (const lesart of ['eingefroren', 'spielnah']) {
      if (LESART !== 'beide' && LESART !== lesart) continue;
      const proben = [];
      for (const lage of LAGEN) for (const x of xs) for (const z of zs) for (const [rx, rz] of RICHTUNG) {
        let ppx = start.x, ppy = start.y, ppz = start.z;
        if (lesart === 'spielnah') {
          ppx = x; ppy = Math.max(0.25, lage.y - 1.7); ppz = z;
          d.setzePos(ppx, ppy, ppz);
          d.setzeMoebelSicht(235);
        }
        const zx = x + rx * 60, zz = z + rz * 60;
        const mit = bild(x, lage.y, z, zx, lage.ziel, zz, 3);
        const ks = kosten();
        for (const f of sd) f.o.userData.__sdVis = f.o.visible, f.o.visible = false;
        const ohne = bild(x, lage.y, z, zx, lage.ziel, zz, 2);
        for (const f of sd) f.o.visible = f.o.userData.__sdVis;
        let sdA = 0, sdT = 0;
        for (const a of ARTEN) { sdA += ks.k[a].aufrufe; sdT += ks.k[a].dreiecke; }
        /* andere Sichtweiten (nur gerechnet): Stueckzahl und Aufrufe mit Leerfeld-Regel */
        const anders = {};
        for (const a of Object.keys(SICHT_NEU)) {
          if (!orte[a]) continue;
          const n = zaehle(a, ppx, ppy, ppz, SICHT_NEU[a]);
          const f0 = sd.filter((f) => f.kat === a);
          anders[a] = { stueck: n, dreiecke: n * (f0[0] ? f0[0].tri : 0), aufrufe: n > 0 ? f0.reduce((s, f) => s + f.gruppen, 0) : 0 };
        }
        proben.push({ lage: lage.name, x: +x.toFixed(1), z: +z.toFixed(1), rx, rz, mit, ohne,
                      gemessenSD: { aufrufe: mit.calls - ohne.calls, dreiecke: mit.dreiecke - ohne.dreiecke },
                      gerechnetSD: { aufrufe: sdA, dreiecke: sdT }, je: ks.k, bestandFelder: ks.bestandFelder, anders });
      }
      ergebnis.lesarten[lesart] = proben;
    }
    /* Lesbarkeit: Bildpunkte bei 720 Bildzeilen */
    const fov = d.camera.fov * Math.PI / 180;
    const HOCH = { Baum: 6.5, Baumscheibe: 0.04, Pflanzscheibe: 0.03, Bank: 0.95, Muelleimer: 0.9, Pflanzkuebel: 0.73, Poller: 0.89, Uhr: 2.61, Kiosk: 2.46 };
    ergebnis.lesbar = {};
    for (const a of ARTEN) {
      ergebnis.lesbar[a] = {};
      for (const w of [30, 50, 80, 100, 120, 150, 185]) ergebnis.lesbar[a][w] = +(HOCH[a] / (2 * w * Math.tan(fov / 2)) * 720).toFixed(1);
    }
    ergebnis.fov = d.camera.fov;
    return ergebnis;
  }, { SICHT_NEU, LESART });
  await b.close();

  const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const p = (s) => console.log(s);
  const ARTEN = ['Baum', 'Baumscheibe', 'Pflanzscheibe', 'Bank', 'Muelleimer', 'Pflanzkuebel', 'Poller', 'Uhr', 'Kiosk'];
  p('');
  p('== 6A-Felder (Belegung am Startpunkt ' + [aus.start.x, aus.start.z].map((v) => v.toFixed(1)).join('/') + ') ==');
  for (const f of aus.felderSD) p('  ' + f.name.padEnd(22) + ' ' + f.kat.padEnd(14) + ' Gruppen ' + f.gruppen + '  Dreiecke/Stueck ' + f.tri + '  count ' + f.countStart);
  p('  Instanzfelder Bestand: ' + aus.felderBestand);
  const bericht = { start: aus.start, felderSD: aus.felderSD, lesbar: aus.lesbar, fov: aus.fov, lesarten: {} };
  for (const lesart of Object.keys(aus.lesarten)) {
    const proben = aus.lesarten[lesart];
    const abw = proben.map((q) => Math.abs(q.gemessenSD.aufrufe - q.gerechnetSD.aufrufe));
    const abwT = proben.map((q) => Math.abs(q.gemessenSD.dreiecke - q.gerechnetSD.dreiecke));
    p('');
    p('== Lesart ' + lesart + ' (' + proben.length + ' Stellen) - gemessen gegen gerechnet: Aufrufe max Abweichung ' +
      Math.max(...abw) + ', Dreiecke max ' + Math.max(...abwT) + ' ==');
    const L = bericht.lesarten[lesart] = {};
    for (const lage of ['strasse', 'dach', 'luft', 'GESAMT']) {
      const Q = lage === 'GESAMT' ? proben : proben.filter((q) => q.lage === lage);
      const zeile = { aufrufe: median(Q.map((q) => q.mit.calls)), dreiecke: median(Q.map((q) => q.mit.dreiecke)),
                      ohneSD: median(Q.map((q) => q.ohne.calls)), sdAufrufe: median(Q.map((q) => q.gemessenSD.aufrufe)),
                      sdDreiecke: median(Q.map((q) => q.gemessenSD.dreiecke)), je: {} };
      for (const a of ARTEN) zeile.je[a] = { aufrufe: median(Q.map((q) => q.je[a].aufrufe)),
                                             dreiecke: median(Q.map((q) => q.je[a].dreiecke)), stueck: median(Q.map((q) => q.je[a].stueck)) };
      zeile.bestandFelder = { aufrufe: median(Q.map((q) => q.bestandFelder.aufrufe)) };
      zeile.anders = {};
      for (const a of Object.keys(SICHT_NEU)) {
        if (!Q[0] || !Q[0].anders[a]) continue;
        zeile.anders[a] = { sicht: SICHT_NEU[a], stueck: median(Q.map((q) => q.anders[a].stueck)), dreiecke: median(Q.map((q) => q.anders[a].dreiecke)),
                            aufrufe: median(Q.map((q) => q.anders[a].aufrufe)) };
      }
      L[lage] = zeile;
      p('  ' + lage.padEnd(8) + ' Aufrufe Med ' + String(zeile.aufrufe).padStart(6) + '  ohne 6A-Felder ' + String(zeile.ohneSD).padStart(6) +
        '  6A ' + String(zeile.sdAufrufe).padStart(3) + '   Dreiecke Med ' + zeile.dreiecke + '  davon 6A ' + zeile.sdDreiecke);
      p('           je Art (Aufrufe / Stueck / Dreiecke): ' +
        ARTEN.map((a) => a + ' ' + zeile.je[a].aufrufe + '/' + zeile.je[a].stueck + '/' + zeile.je[a].dreiecke).join('  '));
      p('           Bestand: Instanzfelder ' + zeile.bestandFelder.aufrufe + ' Aufrufe, uebriger Bestand ' + (zeile.ohneSD - zeile.bestandFelder.aufrufe));
      for (const a of Object.keys(zeile.anders)) {
        const z = zeile.anders[a];
        p('           Sichtweite ' + a + ' ' + z.sicht + ' m: Stueck ' + z.stueck + ' (jetzt ' + zeile.je[a].stueck + '), Dreiecke ' + z.dreiecke +
          ', Aufrufe ' + z.aufrufe);
      }
    }
  }
  p('');
  p('== Lesbarkeit: Bildpunkte hoch bei 720 Zeilen, Sichtfeld ' + aus.fov + ' Grad ==');
  for (const a of ARTEN) p('  ' + a.padEnd(14) + Object.entries(aus.lesbar[a]).map(([w, px]) => w + ' m ' + px).join('   '));
  if (zielDatei) { fs.writeFileSync(zielDatei, JSON.stringify(bericht, null, 1)); p(''); p('  geschrieben: ' + zielDatei); }
})();
