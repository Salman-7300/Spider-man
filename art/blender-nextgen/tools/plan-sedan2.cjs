'use strict';
// Three.js-Abnahme Sedan v2 (exportiertes GLB): Vergleich v1|v2 und Spielauto|v2, Raeder, Fahrer, Nacht,
// Mehrfach-Szene (Spielauto, v1, v2 LOD0, v2 LOD1), Videobilder.
const path = require('node:path');
const fs = require('node:fs');
module.exports = async function (api) {
  const out = path.join(api.root, 'art/blender-nextgen/renders/threejs/sedan2');
  fs.mkdirSync(out, { recursive: true });
  const rep = { shots: {} };
  await api.open('?capture=1');
  const shots = [
    ['01_v1_v2_threequarter', 'sedan2', 'compare', 'gameDay', 'neutral', 'stand', { yaw: 35, pitch: 12, dist: 70 }],
    ['02_v1_v2_front', 'sedan2', 'compare', 'gameDay', 'neutral', 'stand', { yaw: 0, pitch: 6, dist: 66 }],
    ['03_v1_v2_rear', 'sedan2', 'compare', 'gameDay', 'neutral', 'stand', { yaw: 180, pitch: 8, dist: 66 }],
    ['04_v1_v2_side', 'sedan2', 'compare', 'gameDay', 'neutral', 'stand', { yaw: 90, pitch: 4, dist: 72 }],
    ['05_v2_city_driving', 'sedan2', 'new', 'gameDay', 'city', 'vorwaerts', { yaw: 60, pitch: 10, dist: 62 }],
    ['06_v2_steer_left', 'sedan2', 'new', 'gameDay', 'neutral', 'links', { yaw: 20, pitch: 35, dist: 55 }],
    ['07_v2_steer_right', 'sedan2', 'new', 'gameDay', 'neutral', 'rechts', { yaw: -20, pitch: 35, dist: 55 }],
    ['08_v2_driver', 'sedan2', 'new', 'gameDay', 'neutral', 'fahrer', { yaw: -70, pitch: 14, dist: 42 }],
    ['09_v1_v2_night', 'sedan2', 'compare', 'gameNight', 'city', 'stand', { yaw: 150, pitch: 10, dist: 66 }],
    ['10_v2_night_front', 'sedan2', 'new', 'gameNight', 'city', 'stand', { yaw: 30, pitch: 10, dist: 62 }],
  ];
  for (const [name, asset, which, mode, env, clip, view] of shots) {
    await api.ev(`T.setup(${JSON.stringify({ asset, which, mode, env, clip })})`);
    await api.ev(`T.clip(${JSON.stringify(clip)})`);
    await api.ev(`T.view(${JSON.stringify({ ...view, target: null })})`);
    await api.ev('T.renderAt(0.37)');
    await api.shot(path.join(out, name + '.jpg'));
    rep.shots[name] = await api.ev('T.stats()');
    if (clip === 'fahrer') rep.shots[name].driver = await api.ev('T.driver()');
  }
  // Spielauto (createCar) gegen v2
  await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan', which: 'old', mode: 'gameDay', env: 'neutral', clip: 'stand' })})`);
  await api.ev(`T.view({yaw:35,pitch:12,dist:62,target:null})`); await api.ev('T.renderAt(0)');
  await api.shot(path.join(out, '00_spielauto_createCar.jpg'));
  for (const p of ['white', 'black', 'silver', 'dark_blue', 'muted_red', 'neutral_graphite']) {
    await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan2', which: 'new', mode: 'gameDay', env: 'neutral', clip: 'stand', paint: p })})`);
    await api.ev(`T.view({yaw:35,pitch:12,dist:62,target:null})`); await api.ev('T.renderAt(0)');
    await api.shot(path.join(out, 'paint_' + p + '.jpg'));
  }
  rep.wheels = {};
  for (const c of ['stand', 'vorwaerts', 'rueckwaerts', 'links', 'rechts']) {
    await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan2', which: 'new', mode: 'gameDay', env: 'neutral', clip: c })})`);
    await api.ev('T.renderAt(0.05)');
    rep.wheels[c] = await api.ev('T.wheelCheck()');
  }
  rep.perf = [];
  for (const n of [1, 20, 80]) for (const [w, a] of [['old', 'sedan'], ['old', 'sedan2'], ['new', 'sedan2'], ['lod1', 'sedan2']]) {
    await api.ev(`T.setup(${JSON.stringify({ asset: a, which: 'new', mode: 'gameDay', env: 'neutral', clip: 'stand' })})`);
    const r = await api.ev(`T.perfCars(${n}, '${w}', 90, '${a}')`);
    r.modell = w === 'old' ? (a === 'sedan' ? 'Spielauto createCar' : 'Sedan v1') : (w === 'new' ? 'Sedan v2 LOD0' : 'Sedan v2 LOD1');
    rep.perf.push(r);
  }
  const frames = path.join(out, 'frames');
  fs.rmSync(frames, { recursive: true, force: true });
  await api.size(1280, 720);
  let f = 0;
  const seq = [['compare', 'gameDay', 'neutral', 'stand', 60, (i) => `T.view({yaw:${30 + i * 3},pitch:10,dist:68,target:null})`],
               ['new', 'gameDay', 'city', 'vorwaerts', 120, (i) => `T.state.steer=${0}+Math.sin(${i}/30*1.3)*0.38; T.view({yaw:${40 + i * 0.9},pitch:12,dist:58,target:null})`],
               ['new', 'gameDay', 'neutral', 'fahrer', 45, (i) => `T.view({yaw:${-80 + i * 0.6},pitch:14,dist:42,target:null})`],
               ['compare', 'gameNight', 'city', 'stand', 60, (i) => `T.view({yaw:${120 + i * 2},pitch:10,dist:66,target:null})`]];
  for (const [which, mode, env, clip, n, view] of seq) {
    await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan2', which, mode, env, clip })})`);
    await api.ev(`T.clip(${JSON.stringify(clip)})`);
    for (let i = 0; i < n; i++, f++) {
      await api.ev(view(i)); await api.ev(`T.renderAt(${i / 30})`);
      await api.shot(path.join(frames, String(f).padStart(4, '0') + '.jpg'), 86);
    }
  }
  rep.frames = f;
  fs.writeFileSync(path.join(api.root, 'art/blender-nextgen/reports/sedan2-threejs.json'), JSON.stringify(rep, null, 1));
  api.log({ perf: rep.perf.map((p) => [p.modell, p.n, p.calls, p.tris, p.medianMs]), driver: rep.shots['08_v2_driver'].driver,
    stats: rep.shots['01_v1_v2_threequarter'].per.map((p) => [p.tris, p.drawCalls, p.materials]), left: rep.wheels.links });
};
