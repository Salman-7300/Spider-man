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

test('moebelOrt setzt den Signalkopf ueber die richtige Fahrbahn', () => {
  const env = { THREE: require('../lib/three.min.js'), SLAB_H: 0.25, Math };
  vm.runInNewContext(quelle.slice(quelle.indexOf('function moebelOrt('),
    quelle.indexOf('function baueAmpeln(')) + '\nglobalThis.moebelOrt = moebelOrt;', env);
  const o = env.moebelOrt(10, 20, Math.PI, AMPEL_ARM, AMPEL_LINSE.rot, AMPEL_VOR);
  assert.ok(Math.abs(o.x - (10 - AMPEL_ARM)) < 1e-6, 'Arm zeigt nicht nach -x');
  assert.ok(Math.abs(o.z - (20 - AMPEL_VOR)) < 1e-6, 'Kopf schaut nicht nach -z');
  assert.ok(Math.abs(o.y - (0.25 + AMPEL_LINSE.rot)) < 1e-6, 'falsche Hoehe');
  const q = env.moebelOrt(10, 20, Math.PI / 2, AMPEL_ARM, 0, 0);
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

const LATERNE_HOCH = zahl(/const LATERNE_HOCH = ([\d.]+)/, 'LATERNE_HOCH');
const LATERNE_ARM = zahl(/const LATERNE_ARM = ([\d.]+)/, 'LATERNE_ARM');
const LATERNE_LICHT = zahl(/const LATERNE_LICHT = ([\d.]+)/, 'LATERNE_LICHT');
const BEET_HOCH = zahl(/const BEET_HOCH = ([\d.]+)/, 'BEET_HOCH');

/* Rohmasse eines Modells: Kasten und, falls gewuenscht, die hellen
   Punkte (bei der Laterne die Leuchtflaeche unter dem Kopf). */
async function modellMasse(name) {
  const doc = await new NodeIO().read(path.join(wurzel, 'assets', 'stadtmoebel.glb'));
  const mesh = doc.getRoot().listMeshes().find((m) => m.getName() === name);
  assert.ok(mesh, name + ' fehlt in stadtmoebel.glb');
  const prim = mesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION'), col = prim.getAttribute('COLOR_0');
  const p = [0, 0, 0], c = [0, 0, 0, 1];
  const k = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9] };
  const hell = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], n: 0 };
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, p);
    for (let a = 0; a < 3; a++) { k.mn[a] = Math.min(k.mn[a], p[a]); k.mx[a] = Math.max(k.mx[a], p[a]); }
    if (!col) continue;
    col.getElement(i, c);
    if ((c[0] + c[1] + c[2]) / 3 < 0.55 || p[1] < 3) continue;   // nur der Leuchtenkopf
    hell.n++;
    for (let a = 0; a < 3; a++) { hell.mn[a] = Math.min(hell.mn[a], p[a]); hell.mx[a] = Math.max(hell.mx[a], p[a]); }
  }
  return { kasten: k, hell, hoch: k.mx[1] - k.mn[1] };
}

test('Laterne: Hoehe, Ausleger und Leuchtmittel stimmen mit dem Modell', async () => {
  const m = await modellMasse('street_lamp_01');
  assert.ok(Math.abs(m.hoch - LATERNE_HOCH) < 0.02,
    'Modell ist ' + m.hoch.toFixed(2) + ' m hoch, das Spiel rechnet mit ' + LATERNE_HOCH);
  assert.ok(m.hell.n > 20, 'keine Leuchtflaeche im Modell gefunden');
  assert.ok(LATERNE_ARM > m.hell.mn[0] && LATERNE_ARM < m.hell.mx[0],
    'LATERNE_ARM ' + LATERNE_ARM + ' liegt nicht unter dem Leuchtenkopf (' +
    m.hell.mn[0].toFixed(2) + '..' + m.hell.mx[0].toFixed(2) + ')');
  /* Die Kugel sitzt knapp UNTER der Leuchtflaeche, sonst steckt sie im Blech. */
  const unten = m.hell.mn[1];
  assert.ok(LATERNE_LICHT <= unten && LATERNE_LICHT > unten - 0.12,
    'LATERNE_LICHT ' + LATERNE_LICHT + ' passt nicht zur Leuchtflaeche auf ' + unten.toFixed(2));
});

test('Beet: Hoehe stimmt mit dem Modell', async () => {
  const m = await modellMasse('plaza_planter_01');
  assert.ok(Math.abs(m.hoch - BEET_HOCH) < 0.02,
    'Modell ist ' + m.hoch.toFixed(2) + ' m hoch, das Spiel rechnet mit ' + BEET_HOCH);
});

test('Jedes Stadtmoebel hat eine Ersatzform, falls die Datei fehlt', () => {
  /* Kommt stadtmoebel.glb nicht an, darf die Stadt nicht kahl sein. */
  assert.ok(/ampelRoh\.visible = false/.test(quelle), 'Ampel ohne Ersatzform');
  assert.ok(/for \(const r of LATERNE_ROH\) r\.visible = false/.test(quelle), 'Laterne ohne Ersatzform');
  assert.ok(/versteckeTeil\(BEET_ERSATZ\)/.test(quelle), 'Beet ohne Ersatzform');
});

/* ---- Moebel der Zwischenebene ---- */
const UB_MOEBEL = (() => {
  const roh = lies(/const UB_MOEBEL = \{([\s\S]*?)\n\};/, 'UB_MOEBEL');
  const aus = {};
  for (const z of roh.split('\n')) {
    const t = z.match(/(\w+):\s*\{\s*modell:\s*'([^']+)',\s*hoch:\s*([\d.]+)/);
    if (t) aus[t[1]] = { modell: t[2], hoch: parseFloat(t[3]) };
  }
  return aus;
})();

test('Zwischenebene: die Moebelmasse stimmen mit den Modellen ueberein', async () => {
  const io = new NodeIO();
  const dateien = await Promise.all(['stadtmoebel.glb', 'bahnhofmoebel.glb']
    .map((d) => io.read(path.join(wurzel, 'assets', d))));
  const arten = Object.entries(UB_MOEBEL);
  assert.ok(arten.length >= 4, 'zu wenige Moebelarten gefunden: ' + arten.length);
  for (const [art, a] of arten) {
    let mesh = null;
    for (const doc of dateien) {
      const t = doc.getRoot().listMeshes().find((m) => m.getName() === a.modell);
      if (t) mesh = t;
    }
    assert.ok(mesh, art + ': Modell ' + a.modell + ' fehlt in beiden Moebeldateien');
    const pos = mesh.listPrimitives()[0].getAttribute('POSITION');
    const p = [0, 0, 0];
    let ymin = 1e9, ymax = -1e9;
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, p);
      ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]);
    }
    const hoch = ymax - ymin;
    assert.ok(Math.abs(hoch - a.hoch) < 0.03,
      art + ': Modell ist ' + hoch.toFixed(2) + ' m hoch, das Spiel rechnet mit ' + a.hoch);
  }
});

test('Zwischenebene: jede ersetzte Moebelart hat eine Ersatzform', () => {
  /* Ersetzte Arten (Muelleimer, Bank) muessen eine Kistenform haben,
     damit die Halle auch ohne die Moebeldatei moebliert ist. Kiosk und
     Uhr kommen nur dazu und brauchen keine. */
  for (const art of ['muell', 'bank'])
    assert.ok(new RegExp("ubRohDeko\\('" + art + "'").test(quelle),
      art + ' hat keine Ersatzform');
});

/* ---- Baenke auf dem Bahnsteig ---- */
test('Bahnsteigbaenke stehen an der Wand, nicht im Treppenloch', () => {
  /* Die Wand laeuft nur auf der Seite, auf der KEIN Treppenschacht
     liegt - auf der anderen ist die Decke offen und die Treppe kommt
     herunter. Vorher stand je Bahnsteig eine der beiden Baenke bei
     x +/- 8 genau dort. */
  const env = { Math };
  const hx = zahl(/const UB_HALLE_X = ([\d.]+)/, 'UB_HALLE_X');
  const werte = vm.runInNewContext(
    lies(/(const UB_SCHAECHTE = \[[\s\S]*?\n\];)/, 'UB_SCHAECHTE') + '\n' +
    lies(/(const UB_BANK_ABSTAND = \[[^\]]*\];)/, 'UB_BANK_ABSTAND') +
    '\n({ schaechte: UB_SCHAECHTE, abstaende: UB_BANK_ABSTAND })');
  const schaechte = werte.schaechte, abstaende = werte.abstaende;
  vm.runInNewContext(lies(/(function ubWandSeite\(sch\) \{[^}]*\})/, 'ubWandSeite') +
    '\nglobalThis.ubWandSeite = ubWandSeite;', env);
  const L = 2.2;                                   // Laenge einer Bank
  for (const sch of schaechte) {
    const seite = env.ubWandSeite(sch);
    const lochA = Math.min(sch.xFuss, sch.xKopf), lochE = Math.max(sch.xFuss, sch.xKopf);
    /* Gewandete Strecke: von der Hallenkante bis an das Treppenloch. */
    const wandA = seite < 0 ? -hx / 2 : lochE, wandE = seite < 0 ? lochA : hx / 2;
    for (const a of abstaende) {
      const bx = seite * a;
      assert.ok(bx - L / 2 > wandA && bx + L / 2 < wandE,
        sch.steig + ': Bank bei x=' + bx + ' liegt nicht auf der Wandstrecke ' +
        wandA + '..' + wandE);
      assert.ok(bx + L / 2 < lochA || bx - L / 2 > lochE,
        sch.steig + ': Bank bei x=' + bx + ' steht im Treppenloch ' + lochA + '..' + lochE);
    }
  }
  /* Und die Namenstafel in der Mitte (3,8 m breit) bleibt frei. */
  for (const a of abstaende) assert.ok(a - L / 2 > 1.9,
    'Bank bei ' + a + ' m steht vor der Namenstafel');
});

/* ---- Handy-Haltung der Zivilisten ---- */
test('Der Handyarm zielt auf die richtige Koerperseite', () => {
  /* (cos f | -sin f) zeigt nach LINKS von der Figur: wer in +z schaut,
     hat die rechte Hand bei -x. Mit dem falschen Vorzeichen wurde der
     rechte Arm quer ueber die Brust gezogen - am Skelett gemessen lag
     der Ellbogen dann auf der Mittellinie und die Hand auf der falschen
     Seite des Gesichts. */
  const zeile = lies(/(const rx = [^;]+;\s*\/\/ rechts von der Figur)/, 'Handyarm-Seite');
  assert.match(zeile, /rx = -co/, 'die Seitenrichtung ist wieder gespiegelt');
  assert.match(zeile, /rz = si/, 'die Seitenrichtung ist wieder gespiegelt');
});

test('Der Umhaengegurt endet nicht frei in der Luft', () => {
  const quelleV = fs.readFileSync(path.join(wurzel, 'city-visuals.js'), 'utf8');
  const block = quelleV.match(/kind === 'satchel'\)\s*\{([\s\S]*?)\n    \} else \{/);
  assert.ok(block, "der Satchel-Block steht nicht mehr in city-visuals.js");
  /* Jeder Gurtabschnitt muss dort anfangen, wo der vorige aufhoert -
     sonst haengt ein Ende im Nichts. */
  const beams = [...block[1].matchAll(/b\.beam\(\[([^\]]+)\],\s*\[([^\]]+)\]/g)]
    .map((m) => [m[1].split(',').map(Number), m[2].split(',').map(Number)]);
  assert.ok(beams.length >= 2, 'der Gurt besteht aus weniger als zwei Stuecken');
  for (let i = 1; i < beams.length; i++) {
    const a = beams[i - 1][1], b = beams[i][0];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    assert.ok(d < 0.01, 'Gurtstueck ' + i + ' setzt ' + d.toFixed(3) + ' m neben dem vorigen an');
  }
  /* Kein Ende darf vor dem Gesicht schweben: ueber 1,35 m Hoehe nur
     dicht am Koerper (die Schulter liegt bei 1,45 | 0,19). */
  for (const [a, b] of beams) for (const p of [a, b]) {
    if (p[1] > 1.35) assert.ok(Math.abs(p[2]) < 0.06,
      'Gurtende auf ' + p[1] + ' m steht ' + p[2] + ' m vor dem Koerper');
  }
});

test('Die Decke der Zwischenebene bleibt unter dem Gehweg', () => {
  /* Regression: mit 4,2 m lichter Hoehe lag die Deckenoberkante bei
     +0,345 - die Halle stand als 16 x 26 m grosse weisse Platte auf dem
     Gehweg, und ihr Anstosser war eine unsichtbare Wand quer ueber den
     Buergersteig. Der Gehwegsockel reicht von -SLAB_H bis +SLAB_H. */
  const SLAB_H = zahl(/const SLAB_H = ([\d.]+)/, 'SLAB_H');
  const UB_MITTE = zahl(/const UB_MITTE = (-?[\d.]+)/, 'UB_MITTE');
  const UB_BE_HOCH = zahl(/const UB_BE_HOCH = ([\d.]+)/, 'UB_BE_HOCH');
  const u1 = UB_MITTE + UB_BE_HOCH;
  /* Deckenplatte: Mitte u1 + 0,17, Dicke 0,35. Anstosser bis u1 + 0,35. */
  assert.ok(u1 + 0.35 < -SLAB_H,
    'Hallendecke reicht bis ' + (u1 + 0.35).toFixed(3) +
    ' m, der Gehweg beginnt schon bei ' + (-SLAB_H) + ' m');
  /* Decke der Zwischenebene im Schacht: Mitte UB_MITTE + hoch, Dicke 0,35. */
  assert.ok(UB_MITTE + UB_BE_HOCH + 0.175 < -SLAB_H,
    'Decke des Treppenabsatzes reicht bis ' + (UB_MITTE + UB_BE_HOCH + 0.175).toFixed(3) + ' m');
  /* Und hoch genug zum Durchgehen muss sie trotzdem sein. */
  assert.ok(UB_BE_HOCH > 2.9, 'die Halle waere mit ' + UB_BE_HOCH + ' m zu niedrig');
});

/* ================= Wo etwas steht =================
   Nachgemessen an der gebauten Stadt (634 Gegenstaende): 113 Poller
   standen bis zu 0,82 m auf der Fahrbahn, 65 Poller und 26 Beete
   steckten im Ampelmast, 12 Bahnsteigbaenke standen paarweise exakt
   uebereinander, 10 Baenke standen im Aufzug. Diese Tests rechnen die
   Orte aus denselben Zahlen nach, mit denen game.js sie setzt. */
const BLOCKS = zahl(/const BLOCKS = (\d+)/, 'BLOCKS');
const PITCH = zahl(/const PITCH = (\d+)/, 'PITCH');
const ORIGIN = zahl(/const ORIGIN = (-?\d+)/, 'ORIGIN');
const ROAD_HALF = zahl(/const ROAD_HALF = ([\d.]+)/, 'ROAD_HALF');
const POLLER_AB = zahl(/const POLLER_AB = ([\d.]+)/, 'POLLER_AB');
const POLLER_LUECKE = zahl(/POLLER_AB = [\d.]+, POLLER_LUECKE = ([\d.]+)/, 'POLLER_LUECKE');
const MOEBEL_RADIUS = JSON.parse(
  lies(/const MOEBEL_RADIUS = (\{[\s\S]*?\});/, 'MOEBEL_RADIUS')
    .replace(/(\w+):/g, '"$1":'));

/* Die Reihe beginnt am Eckpunkt (Blockmitte plus halbe Seite minus 1 m)
   und laeuft nach INNEN. */
const halbBlock = PITCH / 2 - ROAD_HALF;          // 19
const eckAb = halbBlock - 1.0;                    // 18

test('Poller und Beete bleiben auf dem Gehweg', () => {
  for (let k = 0; k < 3; k++) {
    const weg = eckAb - (POLLER_AB + k * POLLER_LUECKE);
    assert.ok(weg + MOEBEL_RADIUS.Poller <= halbBlock,
      'Poller ' + k + ' ragt ueber die Gehwegkante: ' +
      (weg + MOEBEL_RADIUS.Poller).toFixed(2) + ' > ' + halbBlock);
    assert.ok(weg > 0, 'Poller ' + k + ' liegt jenseits der Blockmitte');
  }
  assert.ok(eckAb - POLLER_AB + MOEBEL_RADIUS.Beet <= halbBlock,
    'das Beet ragt ueber die Gehwegkante');
});

test('Poller und Beete stehen nicht im Ampelmast', () => {
  /* Der Mast sitzt auf der Rasterlinie plus ROAD_HALF + 1,2 - vom
     Eckpunkt des Blocks aus gesehen also 0,2 m weiter aussen. */
  const mastAb = halbBlock - (ROAD_HALF + 1.2) + ROAD_HALF;   // 18.2 vom Blockmittelpunkt
  const naeh = Math.abs(mastAb - (eckAb - POLLER_AB));
  assert.ok(naeh >= MOEBEL_RADIUS.Ampel + MOEBEL_RADIUS.Beet + 0.3,
    'Beet und Ampelmast stehen ' + naeh.toFixed(2) + ' m auseinander');
  assert.ok(naeh >= MOEBEL_RADIUS.Ampel + MOEBEL_RADIUS.Poller + 0.3,
    'Poller und Ampelmast stehen ' + naeh.toFixed(2) + ' m auseinander');
});

test('Die Bahnsteigbank steht neben dem Aufzugsschacht, nicht darin', () => {
  const AUF_B = zahl(/const AUF_B = ([\d.]+)/, 'AUF_B');
  const AUF_ABST = zahl(/const AUF_ABST = ([\d.]+)/, 'AUF_ABST');
  const BANK = JSON.parse(lies(/const UB_BANK_ABSTAND = (\[[^\]]*\])/, 'UB_BANK_ABSTAND'));
  /* Schacht 0: xFuss 2,0, Richtung -1 -> Kabine von 2,0 bis 4,4 neben
     der Hallenmitte. Die Bank ist 2,2 m lang. */
  const xFuss = zahl(/\{ z0: 31\.8, z1: 34\.4, xFuss: ([\d.]+)/, 'xFuss Schacht Nord');
  const nah = AUF_ABST - xFuss;                 // 2.0
  const fern = nah + AUF_B;                     // 4.4
  for (const ab of BANK) {
    const bankNah = ab - 1.1;                   // naeheres Bankende
    assert.ok(bankNah > fern || ab + 1.1 < nah,
      'Bank bei ' + ab + ' m steht im Aufzug (' + nah + '..' + fern + ')');
  }
  assert.ok(BANK[0] - 1.1 - fern >= 0.4,
    'zwischen Bank und Aufzug bleibt zu wenig Luft');
});

test('Der Linienversatz steht bei der Bahnsteigbank drin', () => {
  /* deko() rechnet UB_DZ nicht dazu, ubDeko schon. Fehlt er hier, landen
     die Baenke aller drei Linien auf derselben Linie. */
  const stelle = quelle.indexOf('for (const abstand of UB_BANK_ABSTAND)');
  assert.ok(stelle > 0, 'die Bankschleife fehlt');
  const zeile = quelle.slice(stelle, stelle + 260);
  assert.ok(/baueBank\([^)]*\+ UB_DZ/.test(zeile.replace(/\n/g, ' ')),
    'der Bahnsteigbank fehlt der Linienversatz UB_DZ');
});

test('Wer winkt oder jubelt, hat kein Handy in der Hand', () => {
  const haende = JSON.parse(lies(/const RUHE_POSEN_HAENDE = (\[[^\]]*\])/, 'RUHE_POSEN_HAENDE')
    .replace(/'/g, '"'));
  for (const p of ['winken', 'jubel', 'reden'])
    assert.ok(haende.includes(p), p + ' fehlt in RUHE_POSEN_HAENDE');
  const stelle = quelle.indexOf('RUHE_POSEN_HAENDE.includes(c.ruhePose)');
  assert.ok(stelle > 0, 'die Pruefung fehlt in der Zivilisten-Schleife');
  /* Sie muss NACH der Wahl der Haltung stehen, sonst nuetzt sie nichts. */
  assert.ok(stelle > quelle.indexOf('c.ruhePose = c.gaffPose;'),
    'das Handy wird abgeschaltet, bevor die Haltung feststeht');
});

/* ================= Teil 19: U-Bahn =================
   Nachgelaufen im Spiel: an allen 20 Zugaengen (10 Stationen mal zwei
   Schaechte) kommt der Spieler bis auf den Bahnsteig - keine unsichtbare
   Wand. Diese Tests halten die Zahlen fest, aus denen sich das ergibt. */
test('Jede Station hat zwei Schaechte, und der Abgang ist begehbar lang', () => {
  const linien = lies(/const UB_LINIEN = \[([\s\S]*?)\];/, 'UB_LINIEN');
  const statX = [...linien.matchAll(/statX: \[([^\]]+)\]/g)]
    .map((m) => m[1].split(',').map(Number));
  assert.equal(statX.length, 3, 'es sind nicht mehr drei Linien');
  const stationen = statX.reduce((s, a) => s + a.length, 0);
  assert.equal(stationen, 10, 'es sind nicht mehr zehn Stationen: ' + stationen);
  const TR_OBEN = zahl(/const UB_TR_OBEN = ([\d.]+)/, 'UB_TR_OBEN');
  const HALLE = zahl(/const UB_HALLE_LANG = ([\d.]+)/, 'UB_HALLE_LANG');
  const TR_UNTEN = zahl(/const UB_TR_UNTEN = ([\d.]+)/, 'UB_TR_UNTEN');
  const MITTE = zahl(/const UB_MITTE = (-[\d.]+)/, 'UB_MITTE');
  const TIEF = zahl(/const UB_TIEF = (-[\d.]+)/, 'UB_TIEF');
  /* Keine Treppe steiler als 45 Grad - sonst laeuft man sie nicht mehr
     hinauf, sondern klettert. */
  const obenGrad = Math.atan2(Math.abs(MITTE - 0.25), TR_OBEN) * 180 / Math.PI;
  const untenGrad = Math.atan2(Math.abs(TIEF - MITTE), TR_UNTEN) * 180 / Math.PI;
  assert.ok(obenGrad < 45, 'die obere Treppe ist ' + obenGrad.toFixed(0) + ' Grad steil');
  assert.ok(untenGrad < 45, 'die untere Treppe ist ' + untenGrad.toFixed(0) + ' Grad steil');
  assert.ok(HALLE >= 3, 'die Zwischenebene ist zu kurz zum Stehen');
});

test('Die Zuglichter haengen an der Fahrtrichtung', () => {
  /* Sonst leuchtet auch am Zugende ein weisser Scheinwerfer. game.js
     reicht die Richtung durch, city-visuals faerbt danach um. */
  const q = fs.readFileSync(path.join(wurzel, 'city-visuals.js'), 'utf8');
  const a = q.indexOf('function updateTrain(');
  assert.ok(a > 0, 'updateTrain fehlt in city-visuals.js');
  const teil = q.slice(a, a + 900);
  assert.ok(/frontLights\.color\.setHex\(sign > 0/.test(teil),
    'die Frontlichter richten sich nicht nach der Fahrtrichtung');
  assert.ok(/rearLights\.color\.setHex\(sign > 0/.test(teil),
    'die Schlusslichter richten sich nicht nach der Fahrtrichtung');
  assert.ok(/CITY_LOOK\.updateTrain\(t\.mesh,[\s\S]{0,120}?t\.richtung\)/.test(quelle),
    'game.js reicht die Fahrtrichtung nicht an updateTrain weiter');
});
