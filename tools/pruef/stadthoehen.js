/* CITY V2, Stufe 5 Teil E: hat die Stadt einen Hoehenrhythmus?

   Eine Zeile aus lauter gleich hohen Haeusern ist eine Mauer. Eine Zeile,
   in der jedes Haus zufaellig irgendeine Hoehe hat, ist ein Saegeblatt.
   Beides sieht falsch aus, und beides erkennt man an denselben Zahlen:
   an den Unterschieden zwischen UNMITTELBAREN Nachbarn in einer Zeile.

   Gemessen wird je Stadtteil:

     Median der Nachbardifferenz     das uebliche Mass des Rhythmus
     90. und 95. Perzentil           wie gross die grossen Spruenge sind
     groesster Sprung                der Ausreisser
     fast gleich (< 1,0 m)           Anteil und laengster Lauf
     starker Zickzack                hoch-tief-hoch-tief mit je > 8 m,
                                     mindestens vier Haeuser lang
     Hoehenwerte, die sich haeufen   verraet ein Generatormuster: bei
                                     stetigem Zufall darf kein einzelner
                                     Wert mehrfach exakt vorkommen
     wiederkehrende Hoehenfolgen     dieselbe gerundete Folge auf
                                     mehreren Kanten

   WICHTIG: dieses Werkzeug glaettet nichts. Es zeigt nur, ob der
   Rhythmus aus einem kuenstlichen Muster des Generators stammt.

   Aufruf:  node tools/pruef/stadthoehen.js [ausgabe.json] [seed] [alt]
   ========================================================================= */
const fs = require('node:fs');
const { starte, ausgabePfad } = require('./basis');
const zielJson = ausgabePfad(process.argv[2]);
const seed = +(process.argv[3] || 4711);
const alt = process.argv[4] === 'alt';

(async () => {
  const { b, page } = await starte(1024, 576, seed, alt ? { wdhAlt: true } : {});
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const kisten = d.hausKisten().filter((h) => h.zeile);

    /* ---- Haeuser je Zeile, in Laufrichtung sortiert ----
       Die Zeilenkennung ist "cx|cz|seite". Bei den Kanten Nord und Sued
       laeuft man in x, bei Ost und West in z. */
    const zeilen = new Map();
    for (const h of kisten) {
      if (!zeilen.has(h.zeile)) zeilen.set(h.zeile, []);
      zeilen.get(h.zeile).push(h);
    }
    const listen = [];
    for (const [key, arr] of zeilen) {
      if (arr.length < 2) continue;
      const seite = key.split('|')[2];
      const nachX = seite === 'N' || seite === 'S';
      arr.sort((p, q) => (nachX ? p.x - q.x : p.z - q.z));
      listen.push({ key, art: arr[0].art || 'UNBEKANNT', h: arr.map((e) => e.h) });
    }

    /* ---- Kennzahlen je Stadtteil ---- */
    const proz = (v, p) => {
      if (!v.length) return 0;
      const s = v.slice().sort((a, c) => a - c);
      const i = Math.min(s.length - 1, Math.floor(p / 100 * s.length));
      return +s[i].toFixed(2);
    };
    const arten = {};
    for (const z of listen) {
      const a = arten[z.art] || (arten[z.art] = {
        zeilen: 0, haeuser: 0, diffs: [], nahPaare: 0, paare: 0,
        laengsterNah: 0, zickzack: 0, hoehen: [], folgen: [] });
      a.zeilen++; a.haeuser += z.h.length;
      for (const v of z.h) a.hoehen.push(+v.toFixed(2));
      a.folgen.push(z.h.map((v) => Math.round(v)).join(','));
      let lauf = 1;
      for (let i = 1; i < z.h.length; i++) {
        const dd = Math.abs(z.h[i] - z.h[i - 1]);
        a.diffs.push(dd); a.paare++;
        if (dd < 1.0) { a.nahPaare++; lauf++; if (lauf > a.laengsterNah) a.laengsterNah = lauf; }
        else lauf = 1;
      }
      if (a.laengsterNah < 1 && z.h.length) a.laengsterNah = 1;
      /* Starker Zickzack: vier Haeuser, abwechselnd hoch und tief,
         jeder Schritt groesser als acht Meter. */
      for (let i = 3; i < z.h.length; i++) {
        const s1 = z.h[i - 2] - z.h[i - 3], s2 = z.h[i - 1] - z.h[i - 2],
              s3 = z.h[i] - z.h[i - 1];
        if (Math.abs(s1) > 8 && Math.abs(s2) > 8 && Math.abs(s3) > 8 &&
            s1 * s2 < 0 && s2 * s3 < 0) a.zickzack++;
      }
    }
    const raus = {};
    for (const k of Object.keys(arten)) {
      const a = arten[k];
      /* Haeufen sich einzelne exakte Hoehenwerte? Bei stetigem Zufall
         darf das praktisch nicht vorkommen. */
      const zaehl = {};
      for (const v of a.hoehen) zaehl[v] = (zaehl[v] || 0) + 1;
      const mehrfach = Object.entries(zaehl).filter(([, n]) => n > 1)
                             .sort((p, q) => q[1] - p[1]).slice(0, 5);
      const fz = {};
      for (const f of a.folgen) fz[f] = (fz[f] || 0) + 1;
      const wiederFolgen = Object.entries(fz).filter(([, n]) => n > 1)
                                 .sort((p, q) => q[1] - p[1]).slice(0, 5);
      raus[k] = {
        zeilen: a.zeilen, haeuser: a.haeuser, paare: a.paare,
        median: proz(a.diffs, 50), p90: proz(a.diffs, 90), p95: proz(a.diffs, 95),
        max: a.diffs.length ? +Math.max(...a.diffs).toFixed(2) : 0,
        nah: a.nahPaare, nahAnteil: a.paare ? +(a.nahPaare / a.paare * 100).toFixed(1) : 0,
        laengsterNahLauf: a.laengsterNah, zickzack: a.zickzack,
        maxHoehe: a.hoehen.length ? +Math.max(...a.hoehen).toFixed(2) : 0,
        medianHoehe: proz(a.hoehen, 50),
        mehrfachWerte: mehrfach.map(([v, n]) => ({ hoehe: +v, mal: n })),
        wiederFolgen: wiederFolgen.map(([f, n]) => ({ folge: f, mal: n })),
      };
    }
    /* ---- Hohe Akzente ---- */
    const alle = d.hausKisten();
    const akz = {};
    for (const h of alle) {
      const a = h.art || 'FREI';
      const e = akz[a] || (akz[a] = { n: 0, hoch: 0, max: 0 });
      e.n++; if (h.h >= 45) e.hoch++; if (h.h > e.max) e.max = +h.h.toFixed(2);
    }
    for (const k of Object.keys(akz))
      akz[k].hochAnteil = +(akz[k].hoch / akz[k].n * 100).toFixed(1);

    /* ---- Stehen die hohen Haeuser in Klumpen? ----
       Fuer jedes Haus ab 45 m: wieviele andere hohe Haeuser stehen
       naeher als 60 m? */
    const hoch = alle.filter((h) => h.h >= 45);
    let klumpen = 0, maxNah = 0, fernKlumpen = 0;
    const abstaende = [];
    for (const h of hoch) {
      let n = 0;
      for (const o of hoch) {
        if (o === h) continue;
        if (Math.hypot(o.x - h.x, o.z - h.z) < 60) n++;
      }
      if (n > maxNah) maxNah = n;
      const r = Math.hypot(h.x, h.z);
      abstaende.push(r);
      /* Ein Klumpen hoher Haeuser IM Kern ist die Skyline und gewollt.
         Derselbe Klumpen draussen waere ein Fehler. */
      if (n >= 4) { klumpen++; if (r > 300) fernKlumpen++; }
    }
    abstaende.sort((p, q) => p - q);
    return { zeilen: listen.length, haeuser: kisten.length, stadtteile: raus,
             akzente: akz,
             hoch: { n: hoch.length, klumpen, fernKlumpen, maxNachbarn: maxNah,
                     rMin: abstaende.length ? +abstaende[0].toFixed(1) : 0,
                     rMax: abstaende.length ? +abstaende[abstaende.length - 1].toFixed(1) : 0,
                     ausserhalbKern: abstaende.filter((r) => r > 150).length,
                     ausserhalbMisch: abstaende.filter((r) => r > 300).length } };
  });
  await b.close();

  const p = (s) => console.log(s);
  p('');
  p(`Hoehenrhythmus, Seed ${seed}${alt ? '  (Wiederholungsbremsen AUS)' : ''}`);
  p(`  ${aus.zeilen} Zeilen mit mindestens zwei Haeusern, ${aus.haeuser} Haeuser in Zeilen`);
  p('');
  p('  Stadtteil    Zeilen  Paare  Median   p90    p95    max   fast gleich  Lauf  Zickzack');
  for (const k of Object.keys(aus.stadtteile).sort()) {
    const a = aus.stadtteile[k];
    p('  ' + k.padEnd(12) + String(a.zeilen).padStart(5) + String(a.paare).padStart(7) +
      (a.median + ' m').padStart(9) + (a.p90 + '').padStart(7) + (a.p95 + '').padStart(7) +
      (a.max + '').padStart(7) + (a.nahAnteil + ' %').padStart(12) +
      String(a.laengsterNahLauf).padStart(6) + String(a.zickzack).padStart(10));
  }
  p('');
  p('  Kuenstliche Muster (mehrfach exakt gleiche Hoehe / wiederkehrende Folge):');
  for (const k of Object.keys(aus.stadtteile).sort()) {
    const a = aus.stadtteile[k];
    const m = a.mehrfachWerte.length ? a.mehrfachWerte.map((e) => `${e.hoehe} m x${e.mal}`).join(', ') : 'keine';
    const f = a.wiederFolgen.length ? a.wiederFolgen.map((e) => `[${e.folge}] x${e.mal}`).join(', ') : 'keine';
    p('    ' + k.padEnd(12) + 'Werte: ' + m);
    p('    ' + ''.padEnd(12) + 'Folgen: ' + f);
  }
  p('');
  p('  Hohe Haeuser ab 45 m je Stadtteil:');
  for (const k of Object.keys(aus.akzente).sort()) {
    const a = aus.akzente[k];
    p('    ' + k.padEnd(12) + String(a.hoch).padStart(4) + ' von ' + String(a.n).padStart(4) +
      (a.hochAnteil + ' %').padStart(9) + '   hoechstes ' + a.max + ' m');
  }
  p(`  ${aus.hoch.n} hohe Haeuser, davon ${aus.hoch.klumpen} mit vier oder mehr hohen `
    + `Nachbarn im Umkreis 60 m (groesste Nachbarschaft ${aus.hoch.maxNachbarn})`);
  p(`  Abstand zur Stadtmitte ${aus.hoch.rMin} bis ${aus.hoch.rMax} m; `
    + `${aus.hoch.ausserhalbKern} ausserhalb des Kerns (150 m), `
    + `${aus.hoch.ausserhalbMisch} ausserhalb der Mischung (300 m), `
    + `davon ${aus.hoch.fernKlumpen} als Klumpen`);
  p('');
  if (zielJson) {
    fs.writeFileSync(zielJson, JSON.stringify(aus, null, 2));
    p('  geschrieben: ' + zielJson);
  }
})();
