const fs = require('fs');
/* Auswertung zu flucht-ueberlappung.js nach dem vorab festgelegten Plan
   (docs/abnahme-7b/plan-ueberlappung.txt): Summen je Stand, exakter
   bedingter Binomialtest 7B gegen e92110a, Clopper-Pearson-Grenzen des
   Ratenverhaeltnisses, Vorzeichentest je Episode, Entscheidung B.
   Aufruf:  node tools/pruef/flucht-ueberlappung-auswertung.js <ordner>
            <ordner> enthaelt ref-<keim>.json und neu-<keim>.json */
const F = process.argv[2];
const KEIME = [4711, 1234, 2026, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
const lnf = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const binom = (k, n, p) => Math.exp(lnf(n) - lnf(k) - lnf(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
const pGe = (k, n) => { let s = 0; for (let i = k; i <= n; i++) s += binom(i, n, 0.5); return s; };
const cp = (k, n, a = 0.05) => { // Clopper-Pearson ueber Bisektion
  const cdf = (x, p) => { let s = 0; for (let i = 0; i <= x; i++) s += binom(i, n, p); return s; };
  const bis = (f) => { let lo = 1e-9, hi = 1 - 1e-9; for (let j = 0; j < 80; j++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; } return (lo + hi) / 2; };
  const lo = k === 0 ? 0 : bis((p) => 1 - cdf(k - 1, p) >= a / 2);
  const hi = k === n ? 1 : bis((p) => cdf(k, p) <= a / 2);
  return [lo, hi];
};
const summe = {};
const proEp = {};
for (const st of ['ref', 'neu']) {
  const s = summe[st] = { episoden: 0, ungueltig: 0, begegnungen: 0, begNachGang: 0, ovlAlle: 0, ovlFlucht: 0, ovlFluchtTief: 0, ovlNichtFlucht: 0,
    dauer: [], tiefe: [], zaehler: 0, nah: {}, vorOvl: {}, vorBeg: {}, ausAufenthaltOvl: 0, ausAufenthaltBeg: 0, fluchtSeit: [], heldVersatz: 0, liste: [] };
  for (const k of KEIME) {
    const a = JSON.parse(fs.readFileSync(`${F}/${st}-${k}.json`, 'utf8'));
    for (const e of a.episoden) {
      const id = k + ':' + e.ort;
      if (e.ungueltig) { s.ungueltig++; (proEp[id] = proEp[id] || {})[st] = null; continue; }
      s.episoden++;
      s.heldVersatz = Math.max(s.heldVersatz, e.heldVersatzMax);
      for (const [kk, v] of Object.entries(e.nahBeiGang || {})) s.nah[kk] = (s.nah[kk] || 0) + v;
      s.begegnungen += e.begegnungen.length;
      for (const b of e.begegnungen) { if (b.t >= 30) s.begNachGang++; s.vorBeg[b.vor] = (s.vorBeg[b.vor] || 0) + 1; if (b.ausAufenthalt) s.ausAufenthaltBeg++; }
      s.zaehler += e.zaehler;
      let fl = 0;
      for (const o of e.ereignisse) {
        s.ovlAlle++;
        if (o.zustand === 'flee') {
          s.ovlFlucht++; fl++;
          if (o.minD < 0.45) s.ovlFluchtTief++;
          s.dauer.push(o.dauer); s.tiefe.push(o.tiefe);
          s.vorOvl[o.vor] = (s.vorOvl[o.vor] || 0) + 1;
          if (o.ausAufenthalt) s.ausAufenthaltOvl++;
          if (o.fluchtSeit !== null) s.fluchtSeit.push(o.fluchtSeit);
          s.liste.push(Object.assign({ keim: k, ort: e.name }, o));
        } else s.ovlNichtFlucht++;
      }
      (proEp[id] = proEp[id] || {})[st] = { ovl: fl, beg: e.begegnungen.length };
    }
  }
}
const med = (x) => { if (!x.length) return null; const y = x.slice().sort((a, b) => a - b); return y[Math.floor(y.length / 2)]; };
for (const st of ['ref', 'neu']) {
  const s = summe[st];
  console.log(`== ${st === 'ref' ? 'e92110a' : '7B (aktuell)'}: Episoden ${s.episoden}, ungueltig ${s.ungueltig}`);
  console.log(`   Leute im 10-m-Kreis bei Gangbeginn: ${JSON.stringify(s.nah)}`);
  console.log(`   Fluchtbegegnungen < 2 m: ${s.begegnungen} (nach Gangbeginn ${s.begNachGang}), Vorzustand ${JSON.stringify(s.vorBeg)}, aus Aufenthalt ${s.ausAufenthaltBeg}`);
  console.log(`   Ueberschneidungen gesamt ${s.ovlAlle}: mit Fliehenden ${s.ovlFlucht} (davon tief < 0,45 m: ${s.ovlFluchtTief}), ohne Flucht ${s.ovlNichtFlucht}`);
  console.log(`   Fliehende: Dauer ${s.dauer.length ? Math.min(...s.dauer) + '..' + Math.max(...s.dauer) + ' s (Median ' + med(s.dauer) + ')' : '-'}, Tiefe ${s.tiefe.length ? Math.min(...s.tiefe) + '..' + Math.max(...s.tiefe) + ' m (Median ' + med(s.tiefe) + ')' : '-'}`);
  console.log(`   Vorzustand ${JSON.stringify(s.vorOvl)}, aus Aufenthalt ${s.ausAufenthaltOvl}, Flucht seit (s) ${s.fluchtSeit.map((x) => x.toFixed(2)).join(', ')}`);
  console.log(`   Spielzaehler playerNpcOverlap ${s.zaehler}, Held versetzt max ${s.heldVersatz} m`);
}
const test = (name, a, b) => {
  const n = a + b;
  if (!n) { console.log(`${name}: 7B ${a}, e92110a ${b} - keine Ereignisse, Test nicht moeglich`); return null; }
  const p = pGe(a, n), [lo, hi] = cp(a, n);
  const rr = (q) => (q >= 1 ? Infinity : q / (1 - q));
  console.log(`${name}: 7B ${a}, e92110a ${b}; einseitig p(7B >= ${a} | ${n}) = ${p.toFixed(4)}; Ratenverhaeltnis ${b ? (a / b).toFixed(2) : 'inf'} (95 %: ${rr(lo).toFixed(2)} .. ${isFinite(rr(hi)) ? rr(hi).toFixed(2) : 'unendlich'})`);
  return { p, hiRR: rr(hi) };
};
console.log('');
const prim = test('PRIMAER Ueberschneidungen mit Fliehenden', summe.neu.ovlFlucht, summe.ref.ovlFlucht);
test('Fluchtbegegnungen', summe.neu.begegnungen, summe.ref.begegnungen);
test('tiefe Ueberschneidungen (< 0,45 m)', summe.neu.ovlFluchtTief, summe.ref.ovlFluchtTief);
test('Spielzaehler-Bilder', summe.neu.zaehler, summe.ref.zaehler);
/* gepaart je Episode */
let mehr = 0, weniger = 0, gleich = 0, bm = 0, bw = 0;
for (const v of Object.values(proEp)) {
  if (!v.ref || !v.neu) continue;
  if (v.neu.ovl > v.ref.ovl) mehr++; else if (v.neu.ovl < v.ref.ovl) weniger++; else gleich++;
  if (v.neu.beg > v.ref.beg) bm++; else if (v.neu.beg < v.ref.beg) bw++;
}
console.log(`gepaart je Episode, Ueberschneidungen: 7B mehr ${mehr}, weniger ${weniger}, gleich ${gleich}; Vorzeichentest einseitig p = ${(mehr + weniger ? pGe(mehr, mehr + weniger) : 1).toFixed(4)}`);
console.log(`gepaart je Episode, Begegnungen: 7B mehr ${bm}, weniger ${bw}; einseitig p = ${(bm + bw ? pGe(bm, bm + bw) : 1).toFixed(4)}`);
let urteil = 'unklar';
if (prim && prim.p < 0.05) urteil = 'erhoeht';
else if (prim && prim.hiRR <= 2) urteil = 'nicht nachgewiesen';
console.log('ENTSCHEIDUNG B (Regel aus plan.txt): ' + urteil);
fs.writeFileSync(F + '/auswertung.json', JSON.stringify({ summe, urteil }, null, 1));
for (const st of ['ref', 'neu']) for (const o of summe[st].liste) console.log('  ' + st + ' ' + JSON.stringify(o));
