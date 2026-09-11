'use strict';
/* Das Testfenster (window.__dbg) ist ein einziges Objektliteral mit ueber
   400 Eintraegen. Ein doppelter Schluessel darin ist STILL: JavaScript
   nimmt den letzten, meldet nichts, und der erste Eintrag ist fuer immer
   unerreichbar. Genau das ist zweimal passiert:

     ubahnen    - einmal als Funktion, einmal als Liste; Tests bekamen
                  die Funktion und verglichen Unsinn
     evStand    - einmal als Liste der laufenden Ereignisse, einmal als
                  Zusammenfassung; in Test B stand die Reihe "ereignisse"
                  deshalb eine Stunde lang auf undefined

   Zur Laufzeit laesst sich das nicht pruefen - da ist der doppelte
   Eintrag schon weg. Deshalb hier am Quelltext, und zwar strukturell:
   gezaehlt werden die Schluessel auf der obersten Ebene des Literals. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const wurzel = path.resolve(__dirname, '..');
const quelle = fs.readFileSync(path.join(wurzel, 'game.js'), 'utf8');

/* Den Block zwischen "window.__dbg = {" und der schliessenden Klammer
   herausschneiden - ueber die Klammerbilanz, nicht ueber einen Regex. */
function dbgBlock() {
  const marke = 'window.__dbg = {';
  const a = quelle.indexOf(marke);
  assert.ok(a >= 0, 'window.__dbg nicht in game.js gefunden');
  let tiefe = 0, i = a + marke.length - 1;
  for (; i < quelle.length; i++) {
    const c = quelle[i];
    if (c === '{') tiefe++;
    else if (c === '}') { tiefe--; if (tiefe === 0) break; }
  }
  assert.ok(tiefe === 0, 'das Testfenster ist nicht geschlossen');
  return quelle.slice(a + marke.length, i);
}

/* Die Schluessel der OBERSTEN Ebene einsammeln.
   Zeilenweise ging das nicht: mehrere Eintraege teilen sich eine Zeile
   ("player, enemies, civilians, cars, ..."). Der erste Anlauf fand
   274 von 327 Schluesseln - und haette einen doppelten unter den
   fehlenden 53 glatt uebersehen. Also wird der Block durchlaufen, mit
   Buchhaltung ueber Klammern, Zeichenketten und Kommentare; gezaehlt
   wird jeder Bezeichner, der auf Tiefe 1 vor einem ':' oder '(' steht
   oder als Kurzschreibweise allein vor ',' oder Zeilenende. */
function schluessel(block) {
  const aus = [];
  let tiefe = 0, i = 0, wort = null, wortEnde = -1;
  const merke = () => {
    if (wort && !['get', 'set', 'async'].includes(wort)) aus.push(wort);
    wort = null;
  };
  while (i < block.length) {
    const c = block[i];
    if (c === '/' && block[i + 1] === '*') { const e = block.indexOf('*/', i + 2);
      i = e < 0 ? block.length : e + 2; wort = null; continue; }
    if (c === '/' && block[i + 1] === '/') { const e = block.indexOf('\n', i);
      i = e < 0 ? block.length : e + 1; wort = null; continue; }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; i++;
      while (i < block.length && block[i] !== q) { if (block[i] === '\\') i++; i++; }
      i++; wort = null; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < block.length && /[\w$]/.test(block[j])) j++;
      if (tiefe === 0) { wort = block.slice(i, j); wortEnde = j; }
      i = j; continue;
    }
    /* Zuerst die Abschlusszeichen pruefen - ein '(' beendet einen
       Methodennamen UND oeffnet die Argumentliste. Wer erst die Klammer
       zaehlt, verliert jeden Methodennamen (erster Anlauf: 136 statt
       327 Schluessel). */
    if (tiefe === 0 && wort && /\S/.test(block.slice(wortEnde, i)) === false) {
      if (c === ':') {
        merke();
        /* Nach dem Doppelpunkt kommt der WERT, kein Schluessel. Ohne
           diesen Sprung zaehlte "hausStellen: HAUS_STELLEN" als zwei
           Eintraege - der Parser fand 357 statt 327. */
        i++;
        let t2 = 0;
        while (i < block.length) {
          const z = block[i];
          if (z === '/' && block[i + 1] === '*') { const e = block.indexOf('*/', i + 2);
            i = e < 0 ? block.length : e + 2; continue; }
          if (z === '/' && block[i + 1] === '/') { const e = block.indexOf('\n', i);
            i = e < 0 ? block.length : e + 1; continue; }
          if (z === "'" || z === '"' || z === '`') {
            const q = z; i++;
            while (i < block.length && block[i] !== q) { if (block[i] === '\\') i++; i++; }
            i++; continue;
          }
          if (z === '{' || z === '[' || z === '(') t2++;
          else if (z === '}' || z === ']' || z === ')') { if (t2 === 0) break; t2--; }
          else if (z === ',' && t2 === 0) { i++; break; }
          i++;
        }
        continue;
      }
      if (c === '(' || c === ',' || c === '\n') merke();
      else if (/\S/.test(c)) wort = null;
    } else if (/\S/.test(c) && c !== '(' && c !== '{' && c !== '[') {
      if (tiefe === 0) wort = null;
    }
    if (c === '{' || c === '[' || c === '(') tiefe++;
    else if (c === '}' || c === ']' || c === ')') tiefe--;
    i++;
  }
  return aus;
}

test('Das Testfenster hat keine doppelten Schluessel', () => {
  const k = schluessel(dbgBlock());
  /* Gegenprobe gegen die Laufzeit: window.__dbg hat 327 Schluessel.
     Der Parser muss mindestens so viele finden (mehr, wenn doppelte
     dabei sind) - sonst liest er nicht den ganzen Block. */
  /* Gegenprobe gegen die Laufzeit: window.__dbg hat 327 Schluessel.
     Der Parser muss GENAU so viele finden, solange keiner doppelt ist -
     weniger heisst, er liest nicht alles, mehr heisst, er zaehlt Werte
     mit. Beides ist in dieser Datei schon passiert. */
  assert.ok(k.length >= 320 && k.length <= 340,
    k.length + ' Eintraege gefunden, erwartet rund 327 - der Parser stimmt nicht');
  const zahl = {};
  for (const n of k) zahl[n] = (zahl[n] || 0) + 1;
  const doppelt = Object.keys(zahl).filter((n) => zahl[n] > 1);
  assert.deepStrictEqual(doppelt, [],
    'doppelte Eintraege im Testfenster - der jeweils ERSTE ist unerreichbar: ' +
    doppelt.map((n) => n + ' (' + zahl[n] + 'x)').join(', '));
});

test('Die beiden frueheren Faelle sind getrennt benannt', () => {
  const k = schluessel(dbgBlock());
  /* Regressionsschutz fuer genau die zwei Namen, die es schon erwischt
     hat - falls jemand den zweiten Eintrag wieder gleich nennt. */
  for (const n of ['evStand', 'ubahnen']) {
    assert.strictEqual(k.filter((x) => x === n).length, 1, n + ' ist wieder doppelt');
  }
  assert.ok(k.includes('evUebersicht'),
    'evUebersicht fehlt - die Zusammenfassung der Ereignisse ist nicht mehr erreichbar');
});
