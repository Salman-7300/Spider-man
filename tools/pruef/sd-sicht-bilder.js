/* CITY V2, Stufe 6B: Ab welcher Entfernung faellt ein kleines Strassendetail
   noch auf? Mit Bildern pruefen, nicht raten.

   An festen Spielkamera-Stellen (Strassenhoehe hinter der Figur, Dach)
   wird JE ART dieselbe Ansicht mehrmals gezeichnet: mit der heutigen
   Sichtweite und mit 50 / 80 / 100 / 120 / 150 m. Dafuer werden nur die
   Instanzen dieser Art jenseits der Probe-Entfernung aus dem Feld
   genommen (wie updateMoebelSicht es mit einem kleineren Radius taete),
   alles andere bleibt. Danach zaehlt ImageMagick die Bildpunkte, die sich
   gegen die heutige Sichtweite aendern (compare -metric AE -fuzz 6%), und
   legt die Bilder nebeneinander.

   Aufruf:  node tools/pruef/sd-sicht-bilder.js <ordner> [arten=Muelleimer,...]
              [weiten=50,80,100,120,150]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { starte } = require('./basis');
const ziel = process.argv[2];
if (!ziel) { console.log('Aufruf: node tools/pruef/sd-sicht-bilder.js <ordner>'); process.exit(1); }
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const ARTEN = arg('arten', 'Muelleimer,Poller,Pflanzkuebel,Bank,Uhr,Kiosk,Baumscheibe').split(',');
const WEITEN = arg('weiten', '50,80,100,120,150').split(',').map(Number);
/* stellen=<datei.json>: eigene Kamerastellen statt der vier festen */
const STELLEN_DATEI = arg('stellen', null);
fs.mkdirSync(ziel, { recursive: true });
const FELD = { Baum: 'StrassenBaum', Baumscheibe: 'Baumscheibe', Pflanzscheibe: 'Pflanzscheibe', Bank: 'StrassenBank',
               Muelleimer: 'StrassenMuelleimer', Pflanzkuebel: 'StrassenPflanzkuebel', Poller: 'StrassenPoller',
               Uhr: 'StrassenUhr', Kiosk: 'StrassenKiosk' };
/* Figur (px, pz) und Kamera dahinter; Blick laengs der Strasse. */
const STELLEN = [
  { name: 'boulevard', px: -100, pz: 31, x: -106.5, y: 3.4, z: 31.3, zx: -40, zy: 1.2, zz: 30.5, titel: 'Boulevard z=25, Zentrum, Nordseite nach Osten' },
  { name: 'avenue', px: -170, pz: 166.5, x: -176.5, y: 3.4, z: 166.8, zx: -100, zy: 1.2, zz: 166, titel: 'Geschaeft, Avenue z=175, nach Osten' },
  { name: 'promenade', px: 186.5, pz: 20, x: 186.5, y: 3.4, z: 13.5, zx: 186, zy: 1.2, zz: 100, titel: 'Uferpromenade nach Norden' },
  { name: 'dach', px: -60, pz: 10, x: -60, y: 32, z: 10, zx: 0, zy: 2, zz: 26, titel: 'Dachkante ueber dem Boulevard, Blick nach Osten' },
];

if (STELLEN_DATEI) STELLEN.splice(0, STELLEN.length, ...JSON.parse(fs.readFileSync(STELLEN_DATEI, 'utf8')));
(async () => {
  const { b, page } = await starte(1280, 720, 4711, {});
  await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0); window.__setzeZeit(0.45);
    for (const c of d.cars) if (c.mesh) c.mesh.visible = false;
    for (const c of d.civilians) { const r = c.visual && (c.visual.root || c.visual.group); if (r) r.visible = false; }
    for (const e of d.enemies) { const r = e.visual && (e.visual.root || e.visual.group); if (r) r.visible = false; }
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
  });
  const bericht = [];
  for (const S of STELLEN) {
    for (const art of ARTEN) {
      const bilder = [];
      for (const w of [null, ...WEITEN]) {
        const info = await page.evaluate(({ S, feld, w }) => {
          const d = __dbg;
          d.setzePos(S.px, 0.25, S.pz);
          if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
          d.setzeMoebelSicht(235);
          let vorher = 0, nachher = 0;
          const m = new THREE.Matrix4(), p = new THREE.Vector3();
          d.szene.traverse((o) => {
            if (!o.isInstancedMesh || o.name !== feld) return;
            vorher += o.count;
            if (w === null) { nachher += o.count; return; }
            const behalten = [];
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m); p.setFromMatrixPosition(m);
              if (Math.hypot(p.x - S.px, p.y - 0.25, p.z - S.pz) <= w) behalten.push(m.clone());
            }
            behalten.forEach((q, i) => o.setMatrixAt(i, q));
            o.count = behalten.length; o.instanceMatrix.needsUpdate = true;
            nachher += o.count;
          });
          d.aufnahme(S.x, S.y, S.z, S.zx, S.zy, S.zz);
          d.aufnahme(S.x, S.y, S.z, S.zx, S.zy, S.zz);
          return { vorher, nachher };
        }, { S, feld: FELD[art], w });
        const datei = path.join(ziel, S.name + '-' + art + '-' + (w === null ? 'jetzt' : w) + '.png');
        await page.screenshot({ path: datei });
        bilder.push({ w, datei, stueck: info.nachher });
      }
      /* Unterschied gegen die heutige Sichtweite */
      const zeile = { stelle: S.name, art, jetzt: bilder[0].stueck, weiten: {} };
      for (const B of bilder.slice(1)) {
        let ae = 0;
        try { execFileSync('compare', ['-metric', 'AE', '-fuzz', '6%', bilder[0].datei, B.datei, 'null:'], { stdio: 'pipe' }); }
        catch (e) { ae = parseFloat(String(e.stderr || e.stdout || '0')) || 0; }
        zeile.weiten[B.w] = { stueck: B.stueck, geaendertePunkte: ae };
      }
      bericht.push(zeile);
      console.log(S.name.padEnd(10) + ' ' + art.padEnd(13) + ' heute ' + String(zeile.jetzt).padStart(3) + ' Stueck   ' +
        WEITEN.map((w) => w + ' m: ' + zeile.weiten[w].stueck + ' Stk ' + zeile.weiten[w].geaendertePunkte + ' Pkt').join('   '));
      /* Blatt: heute | jede Weite, darunter die Differenzbilder */
      try {
        const reihe = bilder.map((B) => B.datei);
        execFileSync('montage', [...reihe, '-tile', bilder.length + 'x1', '-geometry', '640x360+2+2', '-background', '#222',
          path.join(ziel, 'blatt-' + S.name + '-' + art + '.jpg')]);
      } catch (e) { /* Blatt ist nur eine Hilfe */ }
    }
  }
  fs.writeFileSync(path.join(ziel, 'sicht.json'), JSON.stringify(bericht, null, 1));
  await b.close();
})();
