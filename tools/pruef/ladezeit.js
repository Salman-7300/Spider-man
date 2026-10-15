/* CITY V2, Stufe 6B: Wohin geht die Ladezeit? Zeitmarken nur im Pruefstand.

   Gemessen wird derselbe Ablauf wie in jedem Pruefstand (basis.js
   starte(): Seite laden, actorsReady, erster Turm, 0,9 s, vier gleiche
   Abfragen der Szenengroesse). Das Spiel wird NICHT veraendert - die
   Marken kommen von aussen:

     T0  Navigation beginnt (page.goto)
     T1  letzte Datei geladen (GLB, Bild, Ton - aus den Netzanfragen)
     T2  Stadtgeometrie fertig: die Zahl der Hausmodell-Tuerme steht
         (dieselbe Groesse, auf die basis.js wartet)
     T3  Strassendetail-Plan fertig (__dbg.strassenDetailInfo, nur ab 6A)
     T4  Instanzfelder fertig: alle 6A-Felder stehen in der Szene
     T5  erster vollstaendiger Render: Ende des ersten Bildes, in dem die
         Szene ihre endgueltige Objektzahl hat
     T6  der Pruefstand erklaert die Szene als ruhig (starte() kehrt
         zurueck)

   Je Abschnitt zwischen zwei Marken: Bilder und ihre Zeit, laengstes
   Bild, Shaderprogramme (linkProgram) und die Zeit, die das Spiel auf
   ihr Uebersetzen warten musste (Info-Log/Status-Abfragen - dort
   blockiert WebGL, bis der GPU-Prozess fertig ist), Textur- und
   Puffer-Uploads. Planungszeit aus strassenDetailInfo().ms.

   Aufruf:  node tools/pruef/ladezeit.js [wurzel=<Spielordner>] [ohneSD=1]
              [laeufe=3] [aus=<datei.json>]
   Der Spielordner (Standard: dieses Repo) bringt seine eigene basis.js
   mit - so laesst sich auch ein alter Stand messen.
   ========================================================================= */
const path = require('node:path');
const fs = require('node:fs');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const WURZEL = path.resolve(arg('wurzel', path.join(__dirname, '..', '..')));
const OHNE = arg('ohneSD', '0') === '1';
const LAEUFE = +arg('laeufe', 3);
const AUS = arg('aus', null);
const pw = require(path.join(WURZEL, 'tools/node_modules/playwright'));
const { starte } = require(path.join(WURZEL, 'tools/pruef/basis'));

let lauf = null;
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a);
  const neu = b.newPage.bind(b);
  b.newPage = async (...q) => {
    const p = await neu(...q);
    p.setDefaultTimeout(240000); p.setDefaultNavigationTimeout(240000);
    const L = lauf;
    const datei = /\.(glb|gltf|bin|png|jpe?g|webp|ktx2|ogg|mp3|wav|m4a)(\?|$)/i;
    const fertig = (r) => { if (datei.test(r.url())) { L.dateien++; L.letzteDatei = Date.now(); } };
    p.on('requestfinished', fertig);
    p.on('requestfailed', fertig);
    const goto = p.goto.bind(p);
    p.goto = async (...g) => { L.t0 = Date.now(); return goto(...g); };
    await p.addInitScript(() => {
      const Z = window.__lz = { bilder: [], gl: [], marken: {}, letzteObjekte: -1, felderSD: 0, tuerme: -1 };
      const jetzt = () => performance.timeOrigin + performance.now();
      /* Bilder: Ende und Dauer jedes requestAnimationFrame-Rueckrufs */
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => raf((t) => {
        const s = jetzt();
        try { cb(t); } finally {
          const e = jetzt();
          let n = -1;
          const d = window.__dbg;
          if (d && d.szene && d.actorsReady) { n = 0; d.szene.traverse(() => n++); }
          Z.bilder.push([s, e - s, n]);
        }
      });
      /* WebGL: Programme, Warten aufs Uebersetzen, Uploads */
      const zeit = (art, f) => function (...a) { const s = jetzt(); try { return f.apply(this, a); } finally { Z.gl.push([s, jetzt() - s, art]); } };
      for (const K of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!K) continue;
        const P = K.prototype;
        P.linkProgram = zeit('programm', P.linkProgram);
        for (const m of ['getProgramInfoLog', 'getShaderInfoLog', 'getProgramParameter', 'getShaderParameter']) P[m] = zeit('shaderWarten', P[m]);
        for (const m of ['texImage2D', 'texSubImage2D', 'compressedTexImage2D', 'texImage3D']) if (P[m]) P[m] = zeit('textur', P[m]);
        for (const m of ['bufferData', 'bufferSubData']) P[m] = zeit('puffer', P[m]);
      }
      /* Marken T2-T4 durch Abfragen alle 100 ms */
      const NAMEN = /^(StrassenBaum|Baumscheibe|Pflanzscheibe|Strassen[A-Z])/;
      setInterval(() => {
        const d = window.__dbg;
        if (!d || !d.szene) return;
        let turm = 0, felder = 0;
        d.szene.traverse((o) => { if (o.userData && o.userData.visualKind === 'tower') turm++; if (o.isInstancedMesh && NAMEN.test(o.name || '')) felder++; });
        const t = jetzt();
        if (turm !== Z.tuerme) { Z.tuerme = turm; Z.marken.turmZuletzt = t; }
        if (felder !== Z.felderSD) { Z.felderSD = felder; Z.marken.felderZuletzt = t; }
        if (!Z.marken.plan && d.strassenDetailInfo) { const i = d.strassenDetailInfo(); if (i && i.anzahl > 0) { Z.marken.plan = t; Z.planMs = i.ms; } }
      }, 100);
    });
    return p;
  };
  return b;
};

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

(async () => {
  const alle = [];
  for (let i = 0; i < LAEUFE; i++) {
    lauf = { t0: 0, dateien: 0, letzteDatei: 0 };
    const tStart = Date.now();
    const { b, page } = await starte(640, 360, 4711, OHNE ? { ohneSD: true } : {});
    const t6 = Date.now();
    const Z = await page.evaluate(() => {
      const z = window.__lz;
      let n = 0; window.__dbg.szene.traverse(() => n++);
      return { bilder: z.bilder, gl: z.gl, marken: z.marken, planMs: z.planMs || null, objekte: n, felderSD: z.felderSD, tuerme: z.tuerme };
    });
    await b.close();
    const T0 = lauf.t0;
    const rel = (t) => (t ? Math.round(t - T0) : null);
    /* T5: Ende des ersten Bildes mit der endgueltigen Objektzahl */
    const b5 = Z.bilder.find((q) => q[2] === Z.objekte);
    const M = {
      T0: 0,
      T1: rel(lauf.letzteDatei),
      T2: rel(Z.marken.turmZuletzt),
      T3: rel(Z.marken.plan),
      T4: Z.felderSD ? rel(Z.marken.felderZuletzt) : null,
      T5: b5 ? rel(b5[0] + b5[1]) : null,
      T6: rel(t6),
    };
    /* Abschnitte in zeitlicher Reihenfolge */
    const folge = Object.entries(M).filter(([, v]) => v !== null).sort((p, q) => p[1] - q[1]);
    const abschnitte = [];
    for (let k = 0; k + 1 < folge.length; k++) {
      const [a, ta] = folge[k], [e, te] = folge[k + 1];
      const im = (t) => t - T0 >= ta && t - T0 < te;
      const B = Z.bilder.filter((q) => im(q[0]));
      const G = Z.gl.filter((q) => im(q[0]));
      const summe = (art) => Math.round(G.filter((q) => q[2] === art).reduce((s, q) => s + q[1], 0));
      abschnitte.push({ von: a, bis: e, ms: te - ta, bilder: B.length, bildMs: Math.round(B.reduce((s, q) => s + q[1], 0)),
                        laengstesBild: B.length ? Math.round(Math.max(...B.map((q) => q[1]))) : 0,
                        programme: G.filter((q) => q[2] === 'programm').length, shaderWarten: summe('shaderWarten') + summe('programm'),
                        textur: summe('textur'), puffer: summe('puffer') });
    }
    const r = { lauf: i + 1, browserStartMs: T0 - tStart, marken: M, planMs: Z.planMs, dateien: lauf.dateien, objekte: Z.objekte,
                felderSD: Z.felderSD, programmeGesamt: Z.gl.filter((q) => q[2] === 'programm').length, abschnitte };
    alle.push(r);
    console.log(JSON.stringify({ lauf: r.lauf, marken: M, planMs: r.planMs && +r.planMs.toFixed(0), programme: r.programmeGesamt }));
    for (const s of abschnitte) console.log('   ' + (s.von + '-' + s.bis).padEnd(6) + String(s.ms).padStart(7) + ' ms  Bilder ' + String(s.bilder).padStart(3) +
      ' (' + s.bildMs + ' ms, laengstes ' + s.laengstesBild + ')  Programme ' + s.programme + '  Shaderwarten ' + s.shaderWarten +
      '  Textur ' + s.textur + '  Puffer ' + s.puffer);
  }
  const med = {};
  for (const k of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) med[k] = median(alle.map((r) => r.marken[k]).filter((v) => v !== null));
  console.log('\n== ' + path.basename(WURZEL) + (OHNE ? ' + ohneSD' : '') + ', Median ueber ' + LAEUFE + ' Laeufe: ' + JSON.stringify(med) +
    '  Planung ' + median(alle.map((r) => r.planMs).filter((v) => v)) + ' ms ==');
  if (AUS) fs.writeFileSync(AUS, JSON.stringify({ wurzel: WURZEL, ohneSD: OHNE, laeufe: alle, median: med }, null, 1));
})();
