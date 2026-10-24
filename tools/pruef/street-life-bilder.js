/* CITY V2, Stufe 7A: Strassenleben im Bild.

   Dieselben zehn Strassenorte wie in Stufe 6 (street-bilder.js), aber MIT
   Passanten - und vier Ansichten aus Spielkamerahoehe (Zentrum, Wohnstrasse,
   Park, Uferpromenade).

   Passanten laufen. Damit vorher und nachher vergleichbar bleiben, gilt fuer
   beide derselbe Ablauf: Keim 4711, Spiel im ersten Bild nach dem Laden
   eingefroren (basis.js, frierSofort - sonst stehen die Figuren je nach
   Rechnertempo bei jedem Lauf woanders), dann <vorlauf>
   Spielsekunden in festen Schritten von 1/30 s rechnen (die Figur steht
   dabei auf einem Dach nahe dem Startpunkt), erst danach werden die Orte
   der Reihe nach besucht. An jedem
   Ort steht die unsichtbare Figur an der Kamera (davon haengt ab, wer
   gezeichnet wird), es werden 0,2 s weitergerechnet, dann gezeichnet.
   Gegner und Vorfaelle sind fuer den ganzen Lauf abgeschaltet (keine
   Gangs, kein Nachschub, jede Sekunde enden alle Ereignisse) und die Figur
   nimmt keinen Schaden: eine eingefrorene Figur am Startpunkt wurde sonst im
   Vorlauf k.o. geschlagen, und fliehende Passanten ueberdecken die
   Verteilung. Fahrende Wagen stehen nur in den vier Spielkamera-Ansichten.

   Eine einzelne Aufnahme ist ein Augenblick und beweist keine Dichte - die
   Zahlen dazu misst street-life.js ueber Minuten. Die vier Spielkamera-
   Ansichten entstehen deshalb zu drei Zeitpunkten (-t1, -t2, -t3, je 30 s
   auseinander).

   Je Aufnahme zwei Zaehlungen bis 25/50/100/150 m: "im Bildkegel" (Mitte
   der Figur im Sichtkegel - auch hinter einer Hauswand) und "wirklich
   sichtbar" (die Figur einmal ausgeblendet und neu gezeichnet: mindestens
   25 Bildpunkte in ihrem Bildrechteck aendern sich).

   Stufe 7B: die wirklich Sichtbaren bis 25/50/100 m dazu nach dem, was sie
   gerade tun - gehen (in Bewegung), sitzen (auf einer Bank), reden (im
   Gespraech), telefon (steht mit dem Handy), warten (steht sonst: wartet,
   schaut sich um, an der Ampel). Gilt fuer jeden Stand; vor Stufe 7B gibt
   es nur kein Sitzen.

   Aufruf:  node tools/pruef/street-life-bilder.js <ordner> [seed=4711]
              [zeit=0.45] [vorlauf=120] [zivis=N] [anteil=0.35] [mix=<datei.json>]
   anteil (ab Stufe 7B): hoechster Anteil der Strassenpassanten im
   Aufenthalt - fuer den Vergleich der Kandidaten; mix: Stadtteil ->
   Gewichte der Beschaeftigungen (nur zum Vergleich der Mischungen).
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2];
if (!ziel) { console.log('Aufruf: node tools/pruef/street-life-bilder.js <ordner>'); process.exit(1); }
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : +a.slice(k.length + 1); };
const SEED = arg('seed', 4711), ZEIT = arg('zeit', 0.45), VORLAUF = arg('vorlauf', 120), ZIVIS = arg('zivis', null);
const ANTEIL = arg('anteil', null);
const mixArg = process.argv.find((v) => v.indexOf('mix=') === 0);
const MIX = mixArg ? JSON.parse(fs.readFileSync(mixArg.slice(4), 'utf8')) : null;
fs.mkdirSync(ziel, { recursive: true });

/* Die zehn Orte aus street-bilder.js - gleiche Kamera. */
const ORTE = [
  { name: '01-zentrum', cx: 0, cz: -50, seite: 'N', a0: -13, a1: 15, titel: 'Zentrum - Block 0/-50, Nordkante (STREET)' },
  { name: '02-geschaeft', cx: -150, cz: -100, seite: 'O', a0: -13, a1: 15, titel: 'Geschaeft - Block -150/-100, Ostkante am Boulevard' },
  { name: '03-mischung', cx: -200, cz: 50, seite: 'N', a0: -13, a1: 15, titel: 'Mischung - Block -200/50, Nordkante (STREET)' },
  { name: '04-wohnen', cx: -250, cz: 100, seite: 'N', a0: -13, a1: 15, titel: 'Wohnen - Block -250/100, Nordkante (STREET)' },
  { name: '05-parkrand', cx: -200, cz: -150, seite: 'O', a0: -13, a1: 15, titel: 'Parkrand - Park -200/-150, Ostkante' },
  { name: '06-park-innen', frei: { x: -213, y: 0.25 + 1.65, z: -151.2, zx: -195, zy: 1.6, zz: -150 }, titel: 'Park innen - Weg zum Brunnen' },
  { name: '07-ufer', frei: { x: 186.5, y: 0.25 + 1.65, z: 30, zx: 186.0, zy: 1.5, zz: 58 }, titel: 'Ufer - Promenade nach Norden' },
  { name: '08-boulevard', cx: 100, cz: 0, seite: 'N', a0: -13, a1: 15, titel: 'Boulevard z=25 - Block 100/0, Nordkante' },
  { name: '09-local', cx: -300, cz: -250, seite: 'S', a0: -13, a1: 15, titel: 'Local Street z=-275 - Block -300/-250, Suedkante' },
  { name: '10-avenue', cx: 0, cz: 150, seite: 'O', a0: -13, a1: 15, titel: 'Avenue x=25 - Block 0/150, Ostkante' },
];
/* Spielkamera-Ansichten: rund 2,9 m hoch, Blick 30 m voraus - so etwa sieht
   man die Strasse hinter der laufenden Figur. */
const SPIEL = [
  { name: 'S1-zentrum', frei: { x: -14, y: 2.9, z: 33.4, zx: 16, zy: 1.2, zz: 33.0 }, autos: true, titel: 'Zentrum - Block 0/50, Gehweg am Boulevard nach Osten' },
  { name: 'S2-wohnstrasse', frei: { x: -268, y: 2.9, z: 117, zx: -236, zy: 1.2, zz: 116.5 }, autos: true, titel: 'Wohnstrasse - Nordkante Block -250/100 nach Osten' },
  { name: 'S3-park', frei: { x: -218, y: 2.9, z: -150.4, zx: -196, zy: 1.0, zz: -150 }, autos: false, titel: 'Park -200/-150 - Weg zum Brunnen' },
  { name: 'S4-uferpromenade', frei: { x: 186.4, y: 2.9, z: 20, zx: 186.2, zy: 1.2, zz: 50 }, autos: true, titel: 'Uferpromenade nach Norden' },
];

function kamera(o) {
  if (o.frei) return o.frei;
  const HALB = 19;
  const n = { N: [0, 1], S: [0, -1], O: [1, 0], W: [-1, 0] }[o.seite];
  const laengs = n[0] !== 0 ? [0, 1] : [1, 0];
  const bord = (a, innen) => [o.cx + n[0] * (HALB - innen) + laengs[0] * a, o.cz + n[1] * (HALB - innen) + laengs[1] * a];
  const [x, z] = bord(o.a0, 2.0), [zx, zz] = bord(o.a1, 1.0);
  return { x, y: 0.25 + 1.65, z, zx, zy: 1.5, zz };
}

(async () => {
  const opt = { frierSofort: true };
  if (ZIVIS !== null) opt.zivis = ZIVIS;
  const { b, page } = await starte(1280, 720, SEED, opt);
  await page.evaluate(({ vorlauf, anteil, mix }) => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    if (anteil !== null && d.setzeAufenthaltAnteil) d.setzeAufenthaltAnteil(anteil);
    if (mix && d.setzeAufenthaltMix) for (const [t, w] of Object.entries(mix)) d.setzeAufenthaltMix(t, w);
    d.player.iFrames = 1e9;
    d.setzeTempo('maxEnemies', 0);
    const ohneGegner = () => {
      d.evAlleBeenden();
      for (const e of d.enemies) { const w = e.visual && (e.visual.root || e.visual.group); if (w) w.visible = false; }
      d.enemies.length = 0;
    };
    /* Waehrend des Vorlaufs steht die Figur auf einem Dach nahe dem
       Startpunkt - auf der Kreuzung bliebe jeder im Umkreis von 9 m
       stehen und schaute sie an (siehe street-life.js). */
    let dach = null;
    for (const col of d.colliders) {
      if (col.klein || col.strassenDetail || col.boden) continue;
      const h = col.h || 0;
      if (h < 10 || h > 60 || col.x1 - col.x0 < 8 || col.z1 - col.z0 < 8) continue;
      const mx = (col.x0 + col.x1) / 2, mz = (col.z0 + col.z1) / 2, dd = Math.hypot(mx - 25, mz - 25);
      if (!dach || dd < dach.dd) dach = { x: mx, z: mz, h, dd };
    }
    const aufsDach = () => { if (dach && Math.abs(d.player.pos.y - dach.h) > 1) d.setzePos(dach.x, dach.h + 0.05, dach.z); };
    ohneGegner();
    for (let s = 0; s < vorlauf; s++) { aufsDach(); d.schritt(1 / 30, 30); ohneGegner(); }
  }, { vorlauf: VORLAUF, anteil: ANTEIL, mix: MIX });
  const info = [];
  /* Die zehn Orte einmal (nach dem Vorlauf), die vier Spielkamera-
     Ansichten zu drei Zeitpunkten (nach dem Vorlauf, +30 s, +60 s) - ein
     einzelner Augenblick zeigt zu oft zufaellig niemanden oder eine
     Gruppe. Zwischen den Zeitpunkten wird mit der Figur auf dem Dach
     weitergerechnet. */
  const AUFNAHMEN = [...ORTE.map((o) => Object.assign({ datei: o.name }, o))];
  for (const [k, plus] of [[0, 0], [1, 30], [2, 30]]) {
    for (const o of SPIEL) AUFNAHMEN.push(Object.assign({ datei: o.name + '-' + 't' + (k + 1), vorher: k === 0 ? 0 : (o === SPIEL[0] ? plus : 0) }, o));
  }
  for (const o of AUFNAHMEN) {
    if (o.vorher) {
      await page.evaluate((s) => {
        const d = __dbg;
        let dach = null;
        for (const col of d.colliders) {
          if (col.klein || col.strassenDetail || col.boden) continue;
          const h = col.h || 0;
          if (h < 10 || h > 60 || col.x1 - col.x0 < 8 || col.z1 - col.z0 < 8) continue;
          const mx = (col.x0 + col.x1) / 2, mz = (col.z0 + col.z1) / 2, dd = Math.hypot(mx - 25, mz - 25);
          if (!dach || dd < dach.dd) dach = { x: mx, z: mz, h, dd };
        }
        for (let i = 0; i < s; i++) {
          if (dach && Math.abs(d.player.pos.y - dach.h) > 1) d.setzePos(dach.x, dach.h + 0.05, dach.z);
          d.schritt(1 / 30, 30);
          d.evAlleBeenden(); d.enemies.length = 0;
        }
      }, o.vorher);
    }
    const k = kamera(o);
    const r = await page.evaluate((a) => {
      const d = __dbg;
      d.setzeRegen(0);
      for (const e of d.enemies) { const w = e.visual && (e.visual.root || e.visual.group); if (w) w.visible = false; }
      d.setzePos(a.k.x, 0.25, a.k.z);
      if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
      d.schritt(1 / 30, 6);
      window.__setzeZeit(a.zeit);
      d.schritt(1 / 30, 1);
      for (const e of d.enemies) { const w = e.visual && (e.visual.root || e.visual.group); if (w) w.visible = false; }
      for (const c of d.cars) if (c.mesh) c.mesh.visible = !!a.autos && c.mesh.visible;
      if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
      d.aufnahme(a.k.x, a.k.y, a.k.z, a.k.zx, a.k.zy, a.k.zz);
      d.aufnahme(a.k.x, a.k.y, a.k.z, a.k.zx, a.k.zy, a.k.zz);
      const ri = d.renderInfo();
      /* Wer steht im Bild? Mitte der Figur im Sichtkegel, bis 150 m. */
      const cam = d.camera;
      const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const p = new THREE.Vector3();
      const RADIEN = [25, 50, 100, 150];
      const n = [0, 0, 0, 0];
      const kandidaten = [];
      for (const c of d.civilians) {
        const w = c.visual && c.visual.root;
        if (!w || !w.visible || c.pos.y < -1) continue;
        p.set(c.pos.x, c.pos.y + 0.9, c.pos.z);
        if (!fr.containsPoint(p)) continue;
        const dist = p.distanceTo(cam.position);
        if (dist > 150) continue;
        RADIEN.forEach((g, i) => { if (dist <= g) n[i]++; });
        kandidaten.push({ c, dist });
      }
      /* Wer ist WIRKLICH zu sehen? Der Kegel zaehlt auch Figuren hinter
         einer Hauswand. Je Figur im Kegel: ausblenden, gleich noch einmal
         zeichnen und im Bildrechteck der Figur die geaenderten Bildpunkte
         zaehlen - ab 25 gilt sie als sichtbar. Gelesen wird direkt nach dem
         Zeichnen, im selben Schritt (readPixels). Die Schattenkarte wird
         dabei nicht neu gerechnet: gezaehlt wird der Koerper, nicht sein
         Schatten. Zum Schluss wird wieder mit allen gezeichnet - das ist
         das gespeicherte Bild. */
      const sicht = [0, 0, 0, 0];
      /* gafft: wer stehen bleibt und den Helden anschaut, anjubelt oder
         filmt. Das Werkzeug stellt den (unsichtbaren) Helden fuer jede
         Aufnahme an die Kamera; wer naeher als 9 m ist, gafft - das ist
         kein Aufenthalt und wird getrennt gezaehlt, nicht als wartend. */
      const ARTEN = ['gehen', 'sitzen', 'reden', 'telefon', 'warten', 'gafft'];
      const jeArt = {};
      for (const k of ARTEN.concat(['gesamt'])) jeArt[k] = [0, 0, 0];
      const artVon = (c) => {
        if (c.saAnker && c.saArt === 'sitzen' && ['setzen', 'da', 'auf'].indexOf(c.saPhase) >= 0) return 'sitzen';
        if (c.sozialPartner && c.gehZustand === 'sozial') return 'reden';
        if (c.gafft) return 'gafft';
        if (Math.hypot(c.vel.x, c.vel.z) > 0.3) return 'gehen';
        if (c.handy && c.handy.visible) return 'telefon';
        return 'warten';
      };
      const cv = [...document.querySelectorAll('canvas')].find((q) => q.id !== 'minimapC');
      const gl = cv && (cv.getContext('webgl2') || cv.getContext('webgl'));
      if (gl && kandidaten.length) {
        const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        const lies = () => { const buf = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); return buf; };
        const zeichne = () => d.aufnahme(a.k.x, a.k.y, a.k.z, a.k.zx, a.k.zy, a.k.zz);
        zeichne();
        const voll = lies();
        const q = new THREE.Vector3();
        for (const { c, dist } of kandidaten) {
          let x0 = W, x1 = -1, y0 = H, y1 = -1;
          for (const ox of [-0.5, 0.5]) for (const oy of [0, 1.95]) for (const oz of [-0.5, 0.5]) {
            q.set(c.pos.x + ox, c.pos.y + oy, c.pos.z + oz).project(cam);
            const px = (q.x + 1) / 2 * W, py = (q.y + 1) / 2 * H;
            x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
          }
          x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(W - 1, Math.ceil(x1));
          y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
          if (x1 < x0 || y1 < y0) continue;
          c.visual.root.visible = false;
          zeichne();
          const ohne = lies();
          c.visual.root.visible = true;
          let px = 0;
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const i = (y * W + x) * 4;
            if (Math.abs(voll[i] - ohne[i]) + Math.abs(voll[i + 1] - ohne[i + 1]) + Math.abs(voll[i + 2] - ohne[i + 2]) > 24) px++;
          }
          if (px >= 25) {
            RADIEN.forEach((g, i) => { if (dist <= g) sicht[i]++; });
            const art = artVon(c);
            [25, 50, 100].forEach((g, i) => { if (dist <= g) { jeArt[art][i]++; jeArt.gesamt[i]++; } });
          }
        }
        zeichne();
      }
      return { imKegel: n, sichtbar: gl ? sicht : null, jeArt: gl ? jeArt : null, calls: ri.calls, dreiecke: ri.dreiecke };
    }, { k, zeit: ZEIT, autos: !!o.autos });
    await page.screenshot({ path: path.join(ziel, o.datei + '.png') });
    info.push({ name: o.datei, titel: o.titel, kamera: k, imKegel25_50_100_150: r.imKegel, sichtbar25_50_100_150: r.sichtbar,
                sichtbarJeArt25_50_100: r.jeArt, calls: r.calls, dreiecke: r.dreiecke });
    console.log(o.datei.padEnd(20) + ' im Bildkegel 25/50/100/150 m: ' + r.imKegel.join(' / ').padEnd(16) +
                ' wirklich sichtbar: ' + (r.sichtbar ? r.sichtbar.join(' / ') : '-').padEnd(16) + ' Aufrufe ' + r.calls);
    if (r.jeArt) console.log('                     bis 25/50/100 m: ' + Object.entries(r.jeArt).map(([a, v]) => a + ' ' + v.join('/')).join('  '));
  }
  fs.writeFileSync(path.join(ziel, 'orte.json'), JSON.stringify({ seed: SEED, zeit: ZEIT, vorlauf: VORLAUF, anteil: ANTEIL, orte: info }, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
