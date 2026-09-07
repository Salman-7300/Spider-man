'use strict';
/* Prueft die Stadtmoebel aus assets/stadtmoebel.glb gegen die Zahlen, mit
   denen game.js sie in die Stadt setzt. Der Sinn: Die Massen im Spiel sind
   an den Eckpunkten des Modells GEMESSEN. Wird das Modell ausgetauscht oder
   eine Zahl im Spiel verstellt, sitzen Leuchtkugeln und Haltepunkt wieder
   neben der Ampel - und genau das faellt hier auf, ohne dass jemand ein
   Bild anschauen muss. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { NodeIO } = require('@gltf-transform/core');

const wurzel = path.resolve(__dirname, '..');
const quelle = fs.readFileSync(path.join(wurzel, 'game.js'), 'utf8');

function lies(regex, was) {
  const t = quelle.match(regex);
  assert.ok(t, 'nicht in game.js gefunden: ' + was);
  return t[1];
}
const zahl = (regex, was) => parseFloat(lies(regex, was));

const AMPEL_HOCH = zahl(/const AMPEL_HOCH = ([\d.]+)/, 'AMPEL_HOCH');
const AMPEL_ARM = zahl(/const AMPEL_ARM = ([\d.]+)/, 'AMPEL_ARM');
const AMPEL_VOR = zahl(/const AMPEL_VOR = ([\d.]+)/, 'AMPEL_VOR');
const AMPEL_LINSE = JSON.parse(lies(/const AMPEL_LINSE = (\{[^}]*\})/, 'AMPEL_LINSE')
  .replace(/(\w+):/g, '"$1":'));
const AMPEL_LINSE_BAND = JSON.parse(lies(/const AMPEL_LINSE_BAND = (\[\[[^;]*\]\])/, 'AMPEL_LINSE_BAND'));

/* Die drei Linsen aus dem Modell holen: stark gesaettigte Eckpunkte im
   Signalkopf (x > 0,9), nach Hoehe zusammengefasst. */
async function linsenAusModell() {
  const doc = await new NodeIO().read(path.join(wurzel, 'assets', 'stadtmoebel.glb'));
  const mesh = doc.getRoot().listMeshes().find((m) => m.getName() === 'traffic_light_01');
  assert.ok(mesh, 'traffic_light_01 fehlt in stadtmoebel.glb');
  const prim = mesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION'), col = prim.getAttribute('COLOR_0');
  assert.ok(col, 'dem Ampelmodell fehlen die Eckpunktfarben');
  const p = [0, 0, 0], c = [0, 0, 0, 1];
  const kasten = { ymin: 1e9, ymax: -1e9 };
  const punkte = [];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, p);
    kasten.ymin = Math.min(kasten.ymin, p[1]); kasten.ymax = Math.max(kasten.ymax, p[1]);
    if (p[0] < 0.9) continue;
    col.getElement(i, c);
    const hell = Math.max(c[0], c[1], c[2]), dunkel = Math.min(c[0], c[1], c[2]);
    if (hell > 0.3 && (hell - dunkel) / hell > 0.5 && p[2] > 0.1) punkte.push([...p]);
  }
  /* Nach Hoehe in Gruppen zerlegen - dazwischen liegt immer eine Luecke. */
  punkte.sort((a, b) => a[1] - b[1]);
  const gruppen = [];
  for (const q of punkte) {
    const g = gruppen[gruppen.length - 1];
    if (g && q[1] - g.ymax < 0.03) { g.ymax = Math.max(g.ymax, q[1]); g.n++;
      g.xmin = Math.min(g.xmin, q[0]); g.xmax = Math.max(g.xmax, q[0]);
      g.zmax = Math.max(g.zmax, q[2]); continue; }
    gruppen.push({ ymin: q[1], ymax: q[1], xmin: q[0], xmax: q[0], zmax: q[2], n: 1 });
  }
  /* Nur die drei Leuchtscheiben, nicht die schmalen Blenden dazwischen. */
  return { gruppen: gruppen.filter((g) => g.n >= 40), hoch: kasten.ymax - kasten.ymin };
}

test('Ampelmodell: Hoehe im Spiel stimmt mit dem Modell ueberein', async () => {
  const { hoch } = await linsenAusModell();
  assert.ok(Math.abs(hoch - AMPEL_HOCH) < 0.02,
    'Modell ist ' + hoch.toFixed(2) + ' m hoch, das Spiel rechnet mit ' + AMPEL_HOCH);
});

test('Ampel: die brennende Lampe sitzt in der Linse des Modells', async () => {
  const { gruppen } = await linsenAusModell();
  assert.strictEqual(gruppen.length, 3,
    'im Signalkopf sollten genau drei Linsen liegen, gefunden: ' + gruppen.length);
  const namen = ['gruen', 'gelb', 'rot'];                 // von unten nach oben
  gruppen.forEach((g, i) => {
    const mitte = (g.ymin + g.ymax) / 2, wert = AMPEL_LINSE[namen[i]];
    assert.ok(Math.abs(wert - mitte) < 0.03,
      namen[i] + ': Lampe auf ' + wert + ' m, Linse aber auf ' + mitte.toFixed(3) + ' m');
    /* Seitlich und in der Tiefe muss die Kugel ebenfalls in der Linse sitzen. */
    assert.ok(AMPEL_ARM > g.xmin && AMPEL_ARM < g.xmax,
      'AMPEL_ARM ' + AMPEL_ARM + ' liegt nicht im Signalkopf (' + g.xmin.toFixed(2) + '..' + g.xmax.toFixed(2) + ')');
    assert.ok(AMPEL_VOR >= g.zmax && AMPEL_VOR < g.zmax + 0.08,
      'AMPEL_VOR ' + AMPEL_VOR + ' passt nicht zur Linsenvorderkante ' + g.zmax.toFixed(2));
  });
});

test('Ampel: die abgedunkelten Baender decken genau die drei Linsen', async () => {
  const { gruppen } = await linsenAusModell();
  assert.strictEqual(AMPEL_LINSE_BAND.length, 3);
  gruppen.forEach((g, i) => {
    const [u, o] = AMPEL_LINSE_BAND[i];
    assert.ok(u < g.ymin && o > g.ymax,
      'Band ' + i + ' (' + u + '..' + o + ') deckt die Linse ' +
      g.ymin.toFixed(2) + '..' + g.ymax.toFixed(2) + ' nicht');
  });
  for (let i = 1; i < 3; i++) assert.ok(AMPEL_LINSE_BAND[i][0] > AMPEL_LINSE_BAND[i - 1][1],
    'die Baender ueberlappen sich - dann wuerde eine Linse doppelt abgedunkelt');
});

test('ampelOrt setzt den Signalkopf ueber die richtige Fahrbahn', () => {
  const env = { THREE: require('../lib/three.min.js'), SLAB_H: 0.25, Math };
  vm.runInNewContext(quelle.slice(quelle.indexOf('function ampelOrt('),
    quelle.indexOf('function baueAmpeln(')) + '\nglobalThis.ampelOrt = ampelOrt;', env);
  const o = env.ampelOrt(10, 20, Math.PI, AMPEL_ARM, AMPEL_LINSE.rot, AMPEL_VOR);
  assert.ok(Math.abs(o.x - (10 - AMPEL_ARM)) < 1e-6, 'Arm zeigt nicht nach -x');
  assert.ok(Math.abs(o.z - (20 - AMPEL_VOR)) < 1e-6, 'Kopf schaut nicht nach -z');
  assert.ok(Math.abs(o.y - (0.25 + AMPEL_LINSE.rot)) < 1e-6, 'falsche Hoehe');
  const q = env.ampelOrt(10, 20, Math.PI / 2, AMPEL_ARM, 0, 0);
  assert.ok(Math.abs(q.z - (20 - AMPEL_ARM)) < 1e-6, 'Querarm zeigt nicht nach -z');
});

test('Die Leuchtfelder der Ampel entstehen vor dem Stadtbau', () => {
  /* Regression: 'var ampelX = null' stand frueher WEITER UNTEN als der
     Aufruf von baueAmpeln(). Die Zeile lief also nach dem Stadtbau und
     setzte die eben gebauten Felder wieder auf null - updateAmpeln() stieg
     danach in jedem Bild sofort aus und keine Ampel hat je umgeschaltet. */
  const varAmpel = new RegExp('\\bvar amp' + 'elX\\b');
  const anlegen = quelle.indexOf('let ampelX = null, ampelZ = null;');
  const bauen = quelle.indexOf('  baueAmpeln();');
  assert.ok(anlegen > 0, 'ampelX/ampelZ werden nicht mehr angelegt');
  assert.ok(bauen > 0, 'baueAmpeln() wird nicht mehr aufgerufen');
  assert.ok(anlegen < bauen,
    'ampelX/ampelZ werden erst nach baueAmpeln() angelegt - die Ampeln schalten dann nie');
  assert.ok(!varAmpel.test(quelle), 'ampelX ist wieder ein var - das ueberschreibt sich selbst');
});
