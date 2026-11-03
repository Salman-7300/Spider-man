/* Mega-Update 1.0, M1: die neuen Ereignisablaeufe im laufenden Spiel.
   =========================================================================
   Jeder Ablauf wird mit echten Eingaben gespielt - dieselben Funktionen,
   die Tasten und Maus ausloesen (W/Shift ueber d.taste, Linksklick =
   tryAttack('punch'), Q = webShot, E = webZip, Leertaste = tryJump,
   C = interagieren). Nur die Anreise wird abgekuerzt: der Held startet
   30 bis 40 m vor dem Ort, weil der Weg dorthin nicht Teil des Tests ist.
   Einzige weitere Abkuerzung: bei der Verfolgungsjagd wird der Held dem
   Fluchtwagen nachgefuehrt (8 bis 14 m hinter ihm), weil ein Bot nicht
   wie ein Mensch schwingen kann. Die Treffer selbst fallen echt: Netz (Q)
   im Blickkegel oder Schlag am Wagen.

   Gemessen je Ablauf: Phasenfolge mit Zeit, Ausgang, Polizei/Rettung,
   Zuschauer, und alle 0,5 s die sechs harten Fehler des Auftrags
   (__dbg.mega.hart): haengengebliebenes Ereignis, doppelte Figuren,
   blockiertes Fahrzeug, Marker ohne Ereignis, Gegner/Passanten nach dem
   Aufraeumen noch gebunden, Fahrzeuge in Haeusern. Nach dem Ende wird
   weitergerechnet, bis das Ereignis aufgeraeumt ist, und noch 10 s danach.

   Aufruf:  node pruef/mega-ereignisse.js [fall=alle|laden|autodieb|direkt|dach|unfall|dauer]
                                          [keim=4711] [minuten=12] [aus=datei.json]
   'dauer' laesst den Regisseur frei laufen (alle Arten gemischt, keine
   Eingriffe des Spielers ausser Herumlaufen) - das prueft vor allem die
   Wege, auf denen Ereignisse scheitern oder auslaufen.
   Exit 1, wenn ein harter Fehler auftritt.
   ========================================================================= */
const path = require('path');
const fs = require('fs');
const { starte } = require('./basis');
const { botCode } = require('./mega-bot');

const arg = (k, std) => {
  const a = process.argv.find((x) => x.startsWith(k + '='));
  return a ? a.slice(k.length + 1) : std;
};
const FALL = arg('fall', 'alle');
const KEIM = Number(arg('keim', 4711));
const MINUTEN = Number(arg('minuten', 12));
const AUS = arg('aus', null);

(async () => {
  const { b, page } = await starte(800, 480, KEIM, { frierSofort: true });
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e)));
  await page.evaluate(botCode);
  const faelle = FALL === 'alle' ? ['laden', 'autodieb', 'direkt', 'dach', 'unfall'] : FALL.split(',');
  const ergebnis = { keim: KEIM, faelle: {} };
  for (const fall of faelle) {
    const r = await page.evaluate(({ fall, minuten }) =>
      fall === 'dauer' ? window.__mb.dauer(minuten) : window.__mb.fall(fall), { fall, minuten: MINUTEN });
    ergebnis.faelle[fall] = r;
    const h = r.hart, hs = Object.keys(h).filter((k) => h[k]).map((k) => k + '=' + h[k]).join(' ') || 'keine';
    console.log(`\n== ${fall}: ${r.ok ? 'ok' : 'NICHT GELOEST'}  Ausgang ${r.ausgang || '-'}  Dauer ${r.dauer || '-'} s`);
    if (r.aufbau) console.log('   Aufbau ' + JSON.stringify(r.aufbau));
    if (r.phasen && r.phasen.length) console.log('   Phasen ' + r.phasen.map((p) => p[0] + '@' + p[1]).join(' > '));
    if (r.arten) console.log('   Arten ' + JSON.stringify(r.arten) + '\n   Phasen ' + JSON.stringify(r.phasenStatistik) +
                             '\n   Regisseur ' + JSON.stringify(r.evStatistik));
    console.log('   harte Fehler: ' + hs + (r.details.length ? '  ' + JSON.stringify(r.details) : ''));
    console.log('   Polizei/Rettung ' + JSON.stringify(r.resp) + '  offen ' + r.respOffen +
                '   Zuschauer max ' + JSON.stringify(r.zuschauerMax || null));
    console.log('   Welt ' + JSON.stringify(r.welt) + '   Objekte ' + JSON.stringify(r.objekte));
    console.log('   Bot ' + JSON.stringify(r.bot));
    if (r.notiz.length) console.log('   Notiz ' + r.notiz.join('; '));
  }
  console.log('\nSeitenfehler: ' + seitenFehler.length + (seitenFehler.length ? ' ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  ergebnis.seitenFehler = seitenFehler;
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(ergebnis, null, 1));
  await b.close();
  const fehler = Object.values(ergebnis.faelle).some((r) => Object.values(r.hart).some((v) => v > 0)) || seitenFehler.length;
  process.exit(fehler ? 1 : 0);
})();
