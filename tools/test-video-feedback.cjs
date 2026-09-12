'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, model, loadClip, THREE } = require('./animation-test-runtime.cjs');
const { cityRuntime } = require('./city-test-runtime.cjs');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pos = (v, n) => v.knochen[n].getWorldPosition(V());

for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  test(`Wandlauf: der Schritt geht die Wand hinauf, die Sohle liegt an (${nx},${nz})`, () => {
    /* Seit dem Umbau fuehrt die LAUFDATEI vom Boden den Wandlauf; die
       gerechneten Haltungen (poseWandlauf/poseWandSprint) sind nur noch
       Rueckfall. Entscheidend ist nicht, wie die Figur in einem Bild
       steht, sondern wohin der Schritt geht: die Wand hinauf, nicht in
       sie hinein. */
    const r = runtime(), v = r.makeVisual(['idle', 'run', 'kriechen']);
    const plane = -42, normal = V(nx, 0, nz);
    const hoch = V(0, 1, 0);
    v.root.rotation.y = Math.atan2(-nx, -nz);
    v.root.position.set(nx ? plane + nx * 0.52 : 19, 20, nz ? plane + nz * 0.52 : -17);
    const tiefe = (n) => pos(v, n).dot(normal) - plane * (nx || nz);
    let abMin = 9, abMax = -9, hochMin = 9, hochMax = -9;
    let sohleSumme = 0, auftritte = 0, kopfUeberHuefte = 9;
    for (let i = 0; i < 150; i++) {
      r.env.player.pos.copy(v.root.position);
      v.play('climb', { wandModus: 'lauf', wandKriechen: true, wandKontakt: true,
                        tempo: 5.4, speed: 5.4 }, 1 / 60);
      assert.equal(v.aktuellerClip, r.env.WANDLAUF_CLIP,
        'der Wandlauf muss aus der Laufdatei kommen');
      v.wandKriechen(1, 0.3, 0, true, true, 1 / 60);
      v.root.position.addScaledVector(normal, plane * (nx || nz) + 0.52 - pos(v, 'hips').dot(normal));
      v.wandGriff(nx, nz, plane, 0.9, undefined, true);
      if (v.wandlaufBlick) v.wandlaufBlick(r.env.WANDLAUF_KIPP, 1);
      v.poseWandlaufFuesse(nx, nz, plane, 0.95);
      if (i < 60) continue;
      /* Kein Glied steckt in der Fassade. */
      for (const n of ['leftfoot', 'rightfoot', 'lefthand', 'righthand',
                       'leftleg', 'rightleg', 'head', 'hips'])
        assert.ok(tiefe(n) > -0.03, n + ' steckt in der Wand: ' + tiefe(n).toFixed(3));
      /* Die Haende bleiben frei - Wandlaufen geht ohne Haende. */
      assert.ok(Math.min(tiefe('lefthand'), tiefe('righthand')) > 0.05,
        'die Haende kleben an der Wand');
      /* Weg des linken Knoechels: quer zur Wand und die Wand hinauf. */
      const knoe = pos(v, 'leftfoot'), hueft = pos(v, 'hips');
      const ab = tiefe('leftfoot'), hh = knoe.clone().sub(hueft).dot(hoch);
      abMin = Math.min(abMin, ab); abMax = Math.max(abMax, ab);
      hochMin = Math.min(hochMin, hh); hochMax = Math.max(hochMax, hh);
      /* Sohle: beim Auftritt zeigt die Fussachse laengs der Wand. */
      for (const s2 of ['left', 'right']) {
        if (tiefe(s2 + 'foot') > 0.25) continue;
        const achse = pos(v, s2 + 'toebase').sub(pos(v, s2 + 'foot')).normalize();
        sohleSumme += Math.abs(achse.dot(normal)); auftritte++;
      }
      kopfUeberHuefte = Math.min(kopfUeberHuefte, pos(v, 'head').y - hueft.y);
    }
    const wegAb = abMax - abMin, wegHoch = hochMax - hochMin;
    assert.ok(wegHoch > wegAb * 2,
      'der Schritt geht nicht die Wand hinauf: ' + wegHoch.toFixed(2) +
      ' m hinauf gegen ' + wegAb.toFixed(2) + ' m quer');
    assert.ok(auftritte > 20, 'kein Fuss kommt an die Fassade');
    assert.ok(sohleSumme / auftritte < 0.25,
      'die Sohle liegt nicht an der Wand: ' + (sohleSumme / auftritte).toFixed(3));
    assert.ok(kopfUeberHuefte > 0,
      'der Kopf faellt unter die Huefte - die Figur liegt auf dem Ruecken');
  });
  test(`Rueckfall ohne Laufdatei: poseWandSprint haelt die Fuesse an der Fassade (${nx},${nz})`, () => {
    for (const plane of [-125, -42, 37, 148]) {
      const r = runtime(), v = r.makeVisual(['idle', 'run', 'kriechen']);
      v.root.rotation.y = Math.atan2(-nx, -nz);
      v.root.position.set(nx ? plane + nx * 0.52 : 19, 20, nz ? plane + nz * 0.52 : -17);
      const normal = V(nx, 0, nz);
      for (let i = 0; i < 90; i++) {
        r.env.player.pos.copy(v.root.position);
        v.play('climb', { wandModus: 'lauf', wandKriechen: true, wandKontakt: true, tempo: 1.4, speed: 0 }, 1 / 60);
        v.wandKriechen(1, 0.3, 0, true, true, 1 / 60);
        v.root.position.addScaledVector(normal, plane * (nx || nz) + 0.52 - pos(v, 'hips').dot(normal));
        v.poseWandSprint(nx, nz, plane, i * 0.10, 0, 1);
        if (i < 25) continue;
        let tiefster = 0;
        for (const side of ['left', 'right']) {
          const distance = pos(v, side + 'foot').dot(normal) - plane * (nx || nz);
          assert.ok(distance > 0.03 && distance < 0.27, 'foot contact distance ' + distance);
          assert.ok(pos(v, side + 'foot').y < pos(v, 'hips').y - 0.10, 'legs do not extend sideways at hip height');
          tiefster = Math.max(tiefster, pos(v, 'hips').y - pos(v, side + 'foot').y);
        }
        /* ---- Der Standfuss muss WEIT unter der Huefte stehen ----
           Die alte Grenze (0,10 m) war erfuellt, obwohl die Figur die
           Wand hinaufkroch statt sie hinaufzulaufen: der Zielpunkt lag
           nur 0,14 bis 0,62 m unter der Huefte, bei 0,787 m Beinlaenge.
           Im Spiel gemessen lag der Abstand Huefte -> tieferer Fuss im
           Mittel bei 0,23 m - ein Bein, das sich nie streckt. Mit
           WANDLAUF_REICH 0,60 und Hub 0,18 sind es 0,33 bis 0,67.
           Diese Grenze haelt den Laufschritt fest. */
        assert.ok(tiefster > 0.30, 'Standbein bleibt zusammengefaltet: ' + tiefster.toFixed(2));
      }
    }
  });
  test(`Climb cycles, stop and reverse keep limbs outside a translated facade (${nx},${nz})`, () => {
    const r = runtime(), v = r.makeVisual(['idle', 'kriechen', 'run']), plane = -63;
    const normal = V(nx, 0, nz), right = V(-nz, 0, nx);
    v.root.rotation.y = Math.atan2(-nx, -nz);
    v.root.position.set(nx ? plane + nx * 0.26 : 0, 20, nz ? plane + nz * 0.26 : 0);
    let previous = null, maxStep = 0;
    for (let i = 0; i < 480; i++) {
      const velocity = i < 120 ? V(0, 2.6, 0) : i < 180 ? V() : i < 300 ? right.clone().multiplyScalar(4.4) : V(0, -2.6, 0);
      v.root.position.addScaledVector(velocity, 1 / 60);
      r.env.player.pos.copy(v.root.position);
      v.play('climb', { wandModus: 'kriechen', wandKriechen: true, wandKontakt: true, tempo: velocity.length(), speed: 0 }, 1 / 60);
      assert.equal(v.aktuellerClip, 'idle', 'prone clip must not fight the contact pose');
      v.wandKriechen(1, 0.3, 0, false, true, 1 / 60);
      v.root.position.addScaledVector(normal, plane * (nx || nz) + 0.26 - pos(v, 'hips').dot(normal));
      v.poseWandKontakt(nx, nz, plane, velocity, 1 / 60, 1);
      const now = {};
      for (const name of ['lefthand', 'righthand', 'leftfoot', 'rightfoot', 'leftleg', 'rightleg']) {
        const p = pos(v, name), depth = p.dot(normal) - plane * (nx || nz);
        assert.ok(Number.isFinite(p.length()) && depth >= 0.015 && depth < 0.8, name + ' at ' + depth);
        now[name] = p.clone().sub(v.root.position);
        if (previous && i > 30) maxStep = Math.max(maxStep, now[name].distanceTo(previous[name]));
      }
      /* Die Koerperachse folgt jetzt der Kletterrichtung (poseWandKontakt):
         beim Queren und Absteigen steht die Figur bewusst schraeg, wie im
         Vorbild. Was weiterhin gelten MUSS: sie haengt nie kopfueber. Die
         Neigung ist auf 60 Grad begrenzt; gemessen liegt der Kopf beim
         schnellsten Queren (4,4 m/s) noch 0,275 m ueber der Huefte,
         beim Hochklettern 0,55 m. */
      assert.ok(pos(v, 'head').y > pos(v, 'hips').y + 0.25);
      previous = now;
    }
    assert.ok(maxStep < 0.19, 'contact reset produces a large step: ' + maxStep);
  });
}

test('Perch is wider, supports the roof and retains a stable narrow variant', () => {
  for (const narrow of [0, 1]) {
    const v = runtime().makeVisual(['idle']);
    for (let i = 0; i < 90; i++) { v.play('idle', { speed: 0 }, 1 / 60); v.poseKauern(1, narrow); v.hockeAusgleich(0.35); }
    const span = pos(v, 'leftfoot').distanceTo(pos(v, 'rightfoot'));
    assert.ok(narrow ? span < 0.30 : span > 0.55);
    assert.ok(Math.min(pos(v, 'lefthand').y, pos(v, 'righthand').y) < 0.10, 'support hand reaches the roof');
    for (const n of ['leftfoot', 'rightfoot', 'leftleg', 'rightleg']) assert.ok(pos(v, n).y > 0.035);
  }
});

for (const speed of [2, 7, 11]) test('Gait uses bounded cadence and continuous foot release at ' + speed + ' m/s', () => {
  const r = runtime(), v = r.makeVisual(['idle', 'walk', 'run', 'sprint', 'sprint_lang']);
  let previous = null, previousClip = null, maxStep = 0, maxClipStep = 0;
  for (let i = 0; i < 420; i++) {
    const speedNow = i < 300 ? speed : speed * Math.max(0, 1 - (i - 300) / 60);
    v.root.position.z += speedNow / 60;
    r.env.player.pos.copy(v.root.position);
    v.play(speedNow > 0.1 ? 'run' : 'idle', { speed: speedNow, gang: speedNow > 8 ? 'sprint' : speedNow > 3 ? 'run' : 'walk' }, 1 / 60);
    v.bodenAusgleich(0.02); v.fussIK(() => 0, 0.85, 0, 1);
    const clipFoot = pos(v, 'leftfoot').sub(v.root.position);
    if (previousClip && i > 30) maxClipStep = Math.max(maxClipStep, clipFoot.distanceTo(previousClip));
    previousClip = clipFoot;
    v.gangKontakt(V(0, 0, speedNow), 1 / 60, () => 0);
    const p = pos(v, 'leftfoot').sub(v.root.position);
    if (previous && i > 30) maxStep = Math.max(maxStep, p.distanceTo(previous)); previous = p;
    assert.ok(pos(v, 'leftfoot').y > -0.025 && pos(v, 'rightfoot').y > -0.025);
    if (i === 180 && speed > 5.8) { assert.equal(v.aktuellerClip, 'sprint_lang'); assert.ok(v.laufInfo().faktor <= 1.65); }
  }
  // A fast sprint's authored swing foot already travels >20 cm/frame.
  // Contact release must not introduce a larger jump than that real clip.
  assert.ok(maxStep <= maxClipStep + 0.015, 'contact adds a snap: ' + maxStep + ' vs clip ' + maxClipStep);
});

test('Ambulance factory retains EMS light, wheel and driver references within its collider', () => {
  const r = cityRuntime(), g = r.look.createAmbulance(), car = { mesh: g, typ: { art: 'rtw', laenge: 5.4, breite: 2.1 } };
  assert.equal(g.userData.blaulicht.children.length, 2); assert.ok(g.userData.fahrerSitz);
  r.look.updateCar(g, 12, 0.05); r.look.updateCar(g, 0, 0.05);
  assert.equal(g.userData.cityMotion.brake.color.getHex(), 0xff4038);
  for (const yaw of [0, 0.37, Math.PI / 2, 2.4]) {
    g.rotation.y = yaw; const box = new THREE.Box3().setFromObject(g), hull = r.carAABB(car);
    assert.ok(hull.x0 <= box.min.x + 0.001 && hull.x1 >= box.max.x - 0.001);
    assert.ok(hull.z0 <= box.min.z + 0.001 && hull.z1 >= box.max.z - 0.001);
    assert.ok(Math.abs(hull.top - box.max.y) < 0.02);
  }
});
test('Bus aisle and all seat leg spaces are hollow; people fit below the ceiling', () => {
  const r = cityRuntime(), bus = r.look.createBus({ art: 'bus', laenge: 9.5, breite: 2.4 }, 0x3b7a3f);
  bus.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(V(0, 1.4, -1), V(0, -1, 0));
  const floor = ray.intersectObject(bus, true)[0]; assert.ok(floor && Math.abs(floor.point.y - 0.578) < 0.03);
  for (const [i, pl] of bus.userData.sitzplaetze.entries()) {
    const slot = ['civilian', 'civilian2', 'civilian3', 'civilian4', 'civilian5'][i % 5];
    const v = runtime().env.makeGlbVisual(model([loadClip('idle', 'civilian')], slot));
    v.root.scale.setScalar(pl.scale); v.root.position.set(pl.x, 0, pl.z);
    v.play('idle', { speed: 0 }, 1 / 60); v.poseSitzen(1, undefined, !!pl.fahrer);
    v.root.position.y += pl.y - v.sitzMasse().huefte;
    assert.ok(pos(v, 'head').y < 2.32 && pos(v, 'head').y > 1.65);
    for (const side of ['left', 'right']) {
      assert.ok(pos(v, side + 'foot').y > pl.floor, 'feet through bus floor');
      const foot = pos(v, side + 'foot');
      const wall = new THREE.Raycaster(foot, V(0, 1, 0)).intersectObject(bus.getObjectByName('BusShell'));
      assert.ok(wall.length && wall[0].point.y > 2.4, 'passenger legs inside body box');
    }
  }
});
test('Tree templates share immutable geometry and park paths stay open around the fountain', () => {
  const look = cityRuntime().look, variants = [];
  for (let i = 0; i < 4; i++) {
    const a = look.createTree(i), b = look.createTree(i); variants.push(a.children[1].geometry);
    assert.equal(a.children[0].geometry, b.children[0].geometry);
    assert.equal(a.children[1].geometry, b.children[1].geometry);
    assert.ok(a.userData.trunk.height > 4);
  }
  assert.equal(new Set(variants).size, 4);
  const park = look.createPark(38), box = new THREE.Box3().setFromObject(park);
  assert.ok(box.min.x >= -19.01 && box.max.x <= 19.01 && box.min.z >= -19.01 && box.max.z <= 19.01);
  for (const c of park.userData.solids.slice(1)) {
    assert.ok(Math.min(Math.abs(c.x0), Math.abs(c.x1)) > 1.8);
    assert.ok(Math.min(Math.abs(c.z0), Math.abs(c.z1)) > 1.8);
  }
});

/* ---- Klettern AUS DER BEWEGUNGSDATEI ----
   Der Test darueber prueft den gerechneten Weg (poseWandKontakt), der
   einspringt, wenn keine Wandkriechdatei da ist. Liegt sie vor, laeuft im
   Spiel ein voellig anderer Weg: die DATEI fuehrt, die Figur wird um -90
   Grad gekippt (weil sie in der Datei flach auf dem Bauch liegt), um die
   Wandnormale in die Laufrichtung gerollt, und nur der Griff (wandGriff)
   zieht die Glieder an die Fassade. Genau dieser Weg wird hier gefahren.
   Ohne die Kippung stand die Koerperachse gemessen 85,3 Grad zur
   Senkrechten - die Figur lag quer an der Wand. */
for (const [nx, nz] of [[1, 0], [0, -1]]) {
  test(`Klettern aus der Bewegungsdatei haelt die Glieder vor der Fassade (${nx},${nz})`, () => {
    const r = runtime(), v = r.makeVisual(['idle', 'kriechen', 'run', 'wandkriech_v']);
    /* Welche Datei an der Wand fuehrt, steht in game.js und wird von der
       Testumgebung dort gelesen - nicht hier abgeschrieben. */
    const datei = r.env.KLETTER_CLIP;
    const plane = -63, normal = V(nx, 0, nz), right = V(-nz, 0, nx);
    v.root.rotation.y = Math.atan2(-nx, -nz);
    v.root.position.set(nx ? plane + nx * 0.26 : 0, 20, nz ? plane + nz * 0.26 : 0);
    /* Die Wand als Kollisionskoerper - dieselbe Form, die gliederAusHaus
       im Spiel bekommt. Sie reicht von der Ebene aus nach hinten. */
    const kasten = { x0: nx > 0 ? -1e3 : plane, x1: nx > 0 ? plane : 1e3,
                     z0: nz > 0 ? -1e3 : plane, z1: nz > 0 ? plane : 1e3, y0: 0, h: 1e3 };
    if (!nx) { kasten.x0 = -1e3; kasten.x1 = 1e3; }
    if (!nz) { kasten.z0 = -1e3; kasten.z1 = 1e3; }
    const drin = (p) => (p.x > kasten.x0 && p.x < kasten.x1 &&
                         p.z > kasten.z0 && p.z < kasten.z1) ? kasten : null;
    let vorher = null, groessterSchritt = 0;
    for (let i = 0; i < 420; i++) {
      /* hinauf - stehen - quer - hinunter, wie im Spiel. */
      const v3 = i < 120 ? V(0, 2.6, 0) : i < 180 ? V()
               : i < 300 ? right.clone().multiplyScalar(4.4) : V(0, -2.6, 0);
      const tempo = v3.length();
      /* Die Rollung, die updateHeroVisual rechnet: der Kopf zeigt in die
         Fahrtrichtung. */
      const quer = -v3.x * nz + v3.z * nx;
      const roll = tempo > 0.9 ? Math.atan2(-quer, v3.y) : 0;
      v.root.position.addScaledVector(v3, 1 / 60);
      r.env.player.pos.copy(v.root.position);
      v.play('climb', { wandModus: 'kriechen', wandKriechen: true, wandKontakt: false,
                        tempo: tempo === 0 ? 0 : r.env.KLETTER_MAX, speed: 0 }, 1 / 60);
      assert.equal(v.aktuellerClip, datei, 'die Datei muss fuehren');
      v.wandKriechen(1, 0.3, roll, false, false, 1 / 60);
      v.root.position.addScaledVector(normal, plane * (nx || nz) + 0.26 - pos(v, 'hips').dot(normal));
      v.wandGriff(nx, nz, plane, 0.9, null, false);
      v.ausHaus(drin, 0.05);
      const jetzt = {};
      for (const name of ['lefthand', 'righthand', 'leftfoot', 'rightfoot', 'head', 'hips']) {
        const p = pos(v, name), tiefe = p.dot(normal) - plane * (nx || nz);
        assert.ok(Number.isFinite(p.length()), name + ' ist keine Zahl');
        assert.ok(tiefe > -0.06 && tiefe < 0.9, name + ' bei ' + tiefe.toFixed(3));
        jetzt[name] = p.clone().sub(v.root.position);
        if (vorher && i > 30 && i !== 120 && i !== 180 && i !== 300) {
          groessterSchritt = Math.max(groessterSchritt, jetzt[name].distanceTo(vorher[name]));
        }
      }
      /* Der Kopf zeigt in die Fahrtrichtung: hinauf ueber der Huefte,
         hinunter darunter. Waehrend der Rollung (rund 0,4 s) darf er
         dazwischen stehen. */
      if (i > 60 && i < 120) assert.ok(jetzt.head.y > jetzt.hips.y + 0.2, 'hinauf: Kopf oben');
      if (i > 360) assert.ok(jetzt.head.y < jetzt.hips.y - 0.2, 'hinunter: Kopf unten');
      vorher = jetzt;
    }
    /* Die Grenze ist eine andere als beim gerechneten Weg (dort 0,19).
       Der setzt seine Griffe an feste Weltpunkte und hat deshalb gar
       keine Eigenbewegung; hier laeuft eine echte Bewegungsdatei mit
       Faktor 2,4. Allein ihre greifende Hand legt bei ganz festgehaltener
       Rollung schon 0,188 m je Bild zurueck - das ist der Boden. Im Spiel
       gemessen (hinauf, stehen, quer, stehen, hinunter mit echten
       Tastenwechseln) sind es mit der begrenzten Rollung 0,245; im
       Pruefstand hier, wo das Tempo ohne Anlauf umspringt, 0,229. */
    assert.ok(groessterSchritt < 0.26, 'Sprung in der Haltung: ' + groessterSchritt.toFixed(3));
  });
}

test('Freier Fall benutzt die Fallbewegung, nicht die Gleithaltung', () => {
  /* Ueber dem freien Fall lag frueher dieselbe gerechnete Haltung wie im
     Gleitflug: Arme weit zur Seite, Beine gespreizt, Koerper waagerecht.
     Wer einfach herunterfiel, sah aus wie ein Fallschirmspringer.
     Die Figur hat eine eigene Fallbewegung; sie fuehrt jetzt allein. */
  const quelle = require('node:fs').readFileSync(
    require('node:path').resolve(__dirname, '..', 'game.js'), 'utf8');
  assert.ok(!/freiFallMisch/.test(quelle),
    'die Gleithaltung liegt wieder ueber dem freien Fall');
  /* Und die Fallbewegung muss ueberhaupt gesucht werden. */
  assert.match(quelle, /air: \[\/\^fall\$\/i/,
    'der freie Fall sucht keine eigene Fallbewegung mehr');
  /* poseGleiten darf nur noch ueber den Mischer laufen, also aus dem
     Gleitflug heraus - nicht mehr direkt aus einem Fallzweig. */
  const direkt = quelle.split('\n')
    .filter((z) => /heroVisual\.poseGleiten\(/.test(z) && !/a\[0\]/.test(z));
  assert.equal(direkt.length, 0,
    'poseGleiten wird ausserhalb des Gleitflugs gesetzt: ' + direkt.join(' | '));
});

test('Das Handy sitzt in der Faust, nicht daneben', () => {
  /* Der Versatz zaehlt vom Handgelenk aus. Nur "vorn und hoch" setzt das
     Geraet an den aeusseren Rand der Faust, neben den kleinen Finger.
     Am Skelett gemessen liegt die Hoehlung der Faust 4,9 cm nach INNEN,
     2,5 cm hoch und 1,8 cm vor dem Handgelenk. */
  const quelle = require('node:fs').readFileSync(
    require('node:path').resolve(__dirname, '..', 'game.js'), 'utf8');
  const zeile = quelle.match(/_vHalt\.set\(([^)]*)\)/);
  assert.ok(zeile, '_vHalt wird nicht mehr gesetzt');
  const t = zeile[1];
  assert.match(t, /-\s*rx\s*\*\s*0\.0(4[5-9]|5[0-3])/,
    'der Versatz geht nicht mehr nach innen in die Faust: ' + t);
  assert.match(t, /-\s*rz\s*\*\s*0\.0(4[5-9]|5[0-3])/,
    'der Versatz geht nicht mehr nach innen in die Faust: ' + t);
  const hoch = t.split(',')[1].trim();
  assert.ok(Math.abs(Number(hoch) - 0.025) < 0.008,
    'die Hoehe ueber dem Handgelenk stimmt nicht: ' + hoch);
});

/* ---- Kamera an der Wand ----
   Gemessen an einem echten Wandlauf im Browser: die Kamera stand 27 Grad
   neben der Wandnormale (dort, wo der Anlauf am Boden geendet hatte) und
   der Blick ging mit camPitch +0.22 nach unten, waehrend die Figur nach
   oben lief. Im Bild sah man die Hauskante und die Strasse, nicht den
   Weg. Diese Tests halten die Richtung fest, nicht meinen Geschmack. */
function wandKamera(r, nx, nz) {
  const e = r.env, c = { x0: -10, x1: 10, z0: -10, z1: 10, h: 70 };
  for (let i = Math.floor((c.x0 - e.ORIGIN) / e.PITCH); i <= Math.floor((c.x1 - e.ORIGIN) / e.PITCH); i++)
    for (let j = Math.floor((c.z0 - e.ORIGIN) / e.PITCH); j <= Math.floor((c.z1 - e.ORIGIN) / e.PITCH); j++) {
      const key = i + ',' + j; e.colliderGrid.set(key, [...(e.colliderGrid.get(key) || []), c]);
    }
  e.player.pos.set(nx * 10.18, 30, nz * 10.18);
  e.player.state = 'climb'; e.player.wallInfo = { col: c, nx, nz };
  return { e, normalYaw: Math.atan2(nx, nz) };
}
const winkelAb = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  test(`Wandlauf: die Kamera dreht vor die Fassade und schaut hinauf (${nx},${nz})`, () => {
    const r = runtime(), { e, normalYaw } = wandKamera(r, nx, nz);
    e.EINST.autokam = 'gleiten';
    e.player.wandlauf = true; e.player.vel.set(0, 11, 0);
    /* Startlage wie nach einem Anlauf am Boden: schraeg daneben und von
       oben herab. */
    r.run(`camYaw = ${normalYaw + 0.62}; camPitch = 0.22; mausRuhe = 1;
           camPos.copy(player.pos); camPos.y += 1.7;`);
    for (let i = 0; i < 120; i++) e.updateCamera(1 / 60);
    const yaw = r.run('camYaw'), pitch = r.run('camPitch');
    assert.ok(winkelAb(yaw, normalYaw) < 0.12,
      'die Kamera steht nicht vor der Fassade: ' +
      (winkelAb(yaw, normalYaw) * 180 / Math.PI).toFixed(0) + ' Grad daneben');
    assert.ok(pitch < -0.12,
      'die Kamera schaut beim Hochlaufen nicht hinauf: ' + pitch.toFixed(2));
    /* Und sie steht dabei ausserhalb der Wand. */
    const p = e.camera.position;
    assert.ok((nx ? p.x * nx : p.z * nz) > 10.3, 'die Kamera steckt in der Wand');
  });
}

test('An der Wand folgt der Blick der Richtung: hinauf, still, hinunter', () => {
  const werte = {};
  for (const [name, vy] of [['hoch', 8], ['still', 0], ['runter', -8]]) {
    const r = runtime(), { e, normalYaw } = wandKamera(r, 0, -1);
    e.EINST.autokam = 'gleiten';
    e.player.wandlauf = false; e.player.vel.set(0, vy, 0);
    r.run(`camYaw = ${normalYaw}; camPitch = 0; mausRuhe = 1;
           camPos.copy(player.pos); camPos.y += 1.7;`);
    for (let i = 0; i < 240; i++) e.updateCamera(1 / 60);
    werte[name] = r.run('camPitch');
  }
  assert.ok(werte.hoch < werte.still - 0.1,
    'hochklettern hebt den Blick nicht: ' + JSON.stringify(werte));
  assert.ok(werte.runter > werte.still + 0.1,
    'runterklettern senkt den Blick nicht: ' + JSON.stringify(werte));
  assert.ok(Math.abs(werte.still + 0.06) < 0.03,
    'im Stillstand ist der Blick nicht ruhig: ' + werte.still.toFixed(2));
});

test('"Kamera nur von Hand" bleibt auch an der Wand von Hand', () => {
  const r = runtime(), { e, normalYaw } = wandKamera(r, 0, -1);
  e.EINST.autokam = 'aus';
  e.player.wandlauf = true; e.player.vel.set(0, 11, 0);
  const start = normalYaw + 0.62;
  r.run(`camYaw = ${start}; camPitch = 0.22; mausRuhe = 1;
         camPos.copy(player.pos); camPos.y += 1.7;`);
  for (let i = 0; i < 120; i++) e.updateCamera(1 / 60);
  assert.ok(winkelAb(r.run('camYaw'), start) < 0.02,
    'die Kamera dreht sich, obwohl "nur von Hand" eingestellt ist');
  assert.ok(Math.abs(r.run('camPitch') - 0.22) < 0.02);
});

test('Eine Mausbewegung hat an der Wand sofort Vorrang', () => {
  const r = runtime(), { e, normalYaw } = wandKamera(r, 0, -1);
  e.EINST.autokam = 'gleiten';
  e.player.wandlauf = true; e.player.vel.set(0, 11, 0);
  r.run(`camYaw = ${normalYaw}; camPitch = 0; mausRuhe = 1;
         camPos.copy(player.pos); camPos.y += 1.7;`);
  /* Wischen und danach kein Nachziehen: die Ruhezeit beginnt von vorn. */
  for (let i = 0; i < 30; i++) { e.mouseDX = 40; e.updateCamera(1 / 60); }
  const nachMaus = r.run('camYaw');
  assert.ok(winkelAb(nachMaus, normalYaw) > 0.5,
    'die Maus kommt gegen den Wandzug nicht an: ' +
    winkelAb(nachMaus, normalYaw).toFixed(2));
  e.updateCamera(1 / 60);
  assert.ok(winkelAb(r.run('camYaw'), nachMaus) < 0.01,
    'die Kamera zieht sofort nach der Maus wieder weg');
});

/* ---- KI: um das Haus herum statt hinein ----
   "Die rennen auf Haus obwohl die umherum laufen sollen."
   Gemessen in der laufenden Stadt (40 s, 53 Zivilisten, 16 Gegner,
   gleicher Startwert): ohne Vorausschau drueckten sie zusammen 87,0 s
   (Zivilisten) und 76,0 s (Gegner) gegen Waende, mit Vorausschau 1,5 s
   und 13,4 s. Diese Tests pruefen die Vorausschau an einer bekannten
   Wand nach - ohne Browser. */
const fsA = require('node:fs');
const vmA = require('node:vm');
const pathA = require('node:path');
const wurzelA = pathA.resolve(__dirname, '..');
function ausweichRuntime() {
  const quelle = fsA.readFileSync(pathA.join(wurzelA, 'game.js'), 'utf8');
  const a = quelle.indexOf('/* ---- Vorausschauen statt anrennen ----');
  const b = quelle.indexOf('/* Weit genug weg, dass ein Versetzen nicht auffaellt? */');
  assert.ok(a > 0 && b > a, 'der Ausweich-Abschnitt fehlt in game.js');
  const env = { Math, ORIGIN: -175, PITCH: 50, colliderGrid: new Map(), console };
  vmA.createContext(env);
  vmA.runInContext(quelle.slice(a, b), env);
  env.setzeKlotz = (c) => {
    for (let i = Math.floor((c.x0 - env.ORIGIN) / env.PITCH);
         i <= Math.floor((c.x1 - env.ORIGIN) / env.PITCH); i++)
      for (let j = Math.floor((c.z0 - env.ORIGIN) / env.PITCH);
           j <= Math.floor((c.z1 - env.ORIGIN) / env.PITCH); j++) {
        const k = i + ',' + j;
        env.colliderGrid.set(k, [...(env.colliderGrid.get(k) || []), c]);
      }
  };
  return env;
}

test('Die Vorausschau misst die freie Strecke bis zur Wand', () => {
  const e = ausweichRuntime();
  e.setzeKlotz({ x0: -10, x1: 10, z0: 2, z1: 20, h: 30 });
  /* Von (0,0) nach +z: die Wand steht bei z = 2, der Laeufer ist
     0,4 m breit, also bleiben 1,6 m. */
  const frei = e.freieStrecke(0, 0, 0, 0, 1, 3.6, 0.4);
  assert.ok(Math.abs(frei - 1.6) < 0.05, 'freie Strecke ' + frei.toFixed(2) + ' statt 1,6');
  assert.equal(e.freieStrecke(0, 0, 0, 0, -1, 3.6, 0.4), 3.6, 'nach hinten ist frei');
  /* Ein Bordstein (h = 0,25) steht einem Laeufer nicht im Weg. */
  const e2 = ausweichRuntime();
  e2.setzeKlotz({ x0: -10, x1: 10, z0: 2, z1: 20, h: 0.25 });
  assert.equal(e2.freieStrecke(0, 0.3, 0, 0, 1, 3.6, 0.4), 3.6,
    'ein Bordstein wird als Hindernis gerechnet');
});

test('Vor einer Wand dreht die Vorausschau zur offenen Seite', () => {
  const e = ausweichRuntime();
  /* Eine Wand quer vor der Nase, die bei x = -2 endet. */
  e.setzeKlotz({ x0: -2, x1: 40, z0: 2, z1: 20, h: 30 });
  const a = { pos: { x: 0, y: 0, z: 0 } };
  const w = e.ausweichWinkel(a, 0, 1, 0.4, 1);
  assert.ok(w !== 0, 'die Vorausschau sieht die Wand nicht');
  /* Die Drehung macht aus (0,1) die Richtung (-sin w, cos w) - offen
     ist es bei -x, also muss w positiv sein. */
  assert.ok(w > 0, 'er dreht auf die geschlossene Seite: ' + w.toFixed(2));
  const frei = e.freieStrecke(0, 0, 0, -Math.sin(w), Math.cos(w), 3.6, 0.4);
  assert.ok(frei > 2.4, 'die gewaehlte Richtung ist auch nicht frei: ' + frei.toFixed(2));
});

test('Ist der Weg frei, aendert die Vorausschau nichts', () => {
  const e = ausweichRuntime();
  e.setzeKlotz({ x0: -10, x1: 10, z0: -40, z1: -20, h: 30 });
  assert.equal(e.ausweichWinkel({ pos: { x: 0, y: 0, z: 0 } }, 0, 1, 0.4, 1), 0);
});

test('Die Ausweichseite bleibt stehen und zappelt nicht', () => {
  const e = ausweichRuntime();
  e.setzeKlotz({ x0: -20, x1: 20, z0: 3, z1: 20, h: 30 });
  const a = { pos: { x: 0, y: 0, z: 0 } };
  const w1 = e.ausweichWinkel(a, 0, 1, 0.4, 1);
  assert.ok(w1 !== 0);
  /* Neu gerechnet wird nur zehnmal je Sekunde. */
  assert.equal(e.ausweichWinkel(a, 0, 1, 0.4, 1 / 60), w1);
  for (let i = 0; i < 20; i++)
    assert.equal(Math.sign(e.ausweichWinkel(a, 0, 1, 0.4, 1)), Math.sign(w1),
      'die Seite kippt hin und her');
});

test('Steckt einer schon im Klotz, nagelt die Vorausschau ihn nicht fest', () => {
  const e = ausweichRuntime();
  e.setzeKlotz({ x0: -5, x1: 5, z0: -5, z1: 5, h: 30 });
  /* Herausdruecken ist Sache von collideBody. Wuerde die Vorausschau
     hier 0 liefern, bliebe der Steckengebliebene fuer immer stehen. */
  assert.equal(e.freieStrecke(0, 0, 0, 1, 0, 3.6, 0.4), 3.6);
});

test('Der Umhaengegurt liegt auf der Jacke, nicht darin', () => {
  /* Nachgeschaut im Bild: vom Gurt war vorn nur ein Stummel an der
     Tasche zu sehen, der Rest steckte in der Jacke. Gerechnet lief die
     Vorderstrecke von (0.21, 1.02, 0.09) geradewegs zur Schulter
     (-0.16, 1.43, 0.015) - auf Brusthoehe 1.22 also bei z = 0.057, und
     dort ist der Brustkorb. Der Rucksackgurt derselben Datei liegt bei
     z = 0.145 aussen auf; das ist der Vergleichswert. */
  const q = fsA.readFileSync(pathA.join(wurzelA, 'city-visuals.js'), 'utf8');
  const a = q.indexOf("} else if (kind === 'satchel') {");
  const b = q.indexOf('} else {', a);
  assert.ok(a > 0 && b > a, 'die Umhaengetasche fehlt in city-visuals.js');
  const teil = q.slice(a, b);
  const beams = [...teil.matchAll(/b\.beam\(\[([^\]]+)\],\s*\[([^\]]+)\]/g)]
    .map((m) => [m[1].split(',').map(Number), m[2].split(',').map(Number)]);
  assert.ok(beams.length >= 3, 'der Gurt hat zu wenige Abschnitte: ' + beams.length);
  /* Eine feste Mindesttiefe waere zu grob - der Brustkorb ist unten
     breiter als an der Schulter. Geprueft wird deshalb das, worum es
     geht: die Vorderstrecke muss sich nach AUSSEN woelben. Eine gerade
     Verbindung von der Tasche zur Schulter schneidet durch den Koerper,
     ein aufliegender Gurt beult nach vorn.
     Alte Fassung: eine einzige gerade Strecke, Woelbung 0.
     Jetzt: geknickt ueber die Brust, Woelbung rund 0,09 m. */
  const vorn = beams.filter(([p, q2]) => p[2] > 0 && q2[2] > 0);
  assert.ok(vorn.length >= 2,
    'die Vorderstrecke ist nicht geknickt - sie schneidet gerade durch');
  const anfang = vorn[0][0], ende = vorn[vorn.length - 1][1];
  let woelbung = 0;
  for (const [p, q2] of vorn) {
    for (const punkt of [p, q2]) {
      const t = (punkt[1] - anfang[1]) / ((ende[1] - anfang[1]) || 1);
      const gerade = anfang[2] + (ende[2] - anfang[2]) * t;
      woelbung = Math.max(woelbung, punkt[2] - gerade);
    }
  }
  assert.ok(woelbung >= 0.045,
    'der Gurt liegt nicht auf dem Koerper auf, Woelbung nur ' + woelbung.toFixed(3) + ' m');
  /* Und er ist geschlossen: der letzte Punkt liegt wieder bei der Tasche. */
  const rundStart = beams[0][0], rundEnde = beams[beams.length - 1][1];
  const ab = Math.hypot(rundStart[0] - rundEnde[0], rundStart[1] - rundEnde[1],
                        rundStart[2] - rundEnde[2]);
  assert.ok(ab < 0.25, 'der Gurt endet frei in der Luft, Abstand ' + ab.toFixed(2));
});

test('Das Handy sitzt in der Hand, nicht daneben (gemessen in der Stadt)', () => {
  /* Gemessen ueber 120 Sekunden Stadt an 24 Proben: groesster Abstand
     zwischen Handy und naechster Hand 5,8 cm, keine ueber 22 cm. Dieser
     Test haelt die Regel fest, die das moeglich macht: das Handy wird
     ueber inDieHand an den Handknochen gehaengt. */
  const q = fsA.readFileSync(pathA.join(wurzelA, 'game.js'), 'utf8');
  assert.ok(/c\.handyInHand = c\.visual\.inDieHand\('R', c\.handy/.test(q),
    'das Handy wird nicht mehr an den Handknochen gehaengt');
});
