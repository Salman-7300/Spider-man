'use strict';
// Three.js-Abnahme Sedan: Bilder, Messwerte, Raeder, Fahrer, Mehrfach-Szene, Videobilder.
const path = require('node:path');
const fs = require('node:fs');
module.exports = async function (api) {
  const out = path.join(api.root, 'art/blender-nextgen/renders/threejs/sedan');
  const rep = {};
  await api.open('?capture=1');
  rep.gl = (await api.ev('T.stats()')).gl;
  const shots = [
    ['01_new_threequarter_day', { which: 'new', mode: 'gameDay', env: 'neutral' }, 'stand', { yaw: 35, pitch: 12, dist: 62 }],
    ['02_compare_threequarter_day', { which: 'compare', mode: 'gameDay', env: 'neutral' }, 'stand', { yaw: 35, pitch: 12, dist: 70 }],
    ['03_compare_side', { which: 'compare', mode: 'gameDay', env: 'neutral' }, 'stand', { yaw: 90, pitch: 4, dist: 72 }],
    ['04_compare_rear', { which: 'compare', mode: 'gameDay', env: 'neutral' }, 'stand', { yaw: 200, pitch: 10, dist: 70 }],
    ['05_new_city_day_driving', { which: 'new', mode: 'gameDay', env: 'city' }, 'vorwaerts', { yaw: 60, pitch: 10, dist: 62 }],
    ['06_new_steer_left', { which: 'new', mode: 'gameDay', env: 'neutral' }, 'links', { yaw: 20, pitch: 35, dist: 55 }],
    ['07_new_steer_right', { which: 'new', mode: 'gameDay', env: 'neutral' }, 'rechts', { yaw: -20, pitch: 35, dist: 55 }],
    ['08_new_driver', { which: 'new', mode: 'gameDay', env: 'neutral' }, 'fahrer', { yaw: -70, pitch: 14, dist: 42 }],
    ['09_compare_driver', { which: 'compare', mode: 'gameDay', env: 'neutral' }, 'fahrer', { yaw: -75, pitch: 10, dist: 48 }],
    ['10_new_city_night', { which: 'new', mode: 'gameNight', env: 'city' }, 'stand', { yaw: 30, pitch: 10, dist: 62 }],
    ['11_compare_night', { which: 'compare', mode: 'gameNight', env: 'city' }, 'stand', { yaw: 150, pitch: 10, dist: 66 }],
    ['12_new_studio', { which: 'new', mode: 'studio', env: 'neutral' }, 'stand', { yaw: 35, pitch: 12, dist: 62 }],
  ];
  rep.shots = {};
  for (const [name, setup, clip, view] of shots) {
    await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan', ...setup, clip })})`);
    await api.ev(`T.clip(${JSON.stringify(clip)})`);
    await api.ev(`T.view(${JSON.stringify({ ...view, target: null })})`);
    await api.ev('T.renderAt(0.37)');
    await api.shot(path.join(out, name + '.jpg'));
    rep.shots[name] = await api.ev('T.stats()');
    if (clip === 'fahrer') rep.shots[name].driver = await api.ev('T.driver()');
  }
  // Paint-Varianten (ein Bild je Lack, Materialtausch ohne Modellkopie)
  for (const p of ['white', 'black', 'silver', 'dark_blue', 'muted_red']) {
    await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan', which: 'new', mode: 'gameDay', env: 'neutral', clip: 'stand', paint: p })})`);
    await api.ev(`T.view(${JSON.stringify({ yaw: 35, pitch: 12, dist: 62, target: null })})`);
    await api.ev('T.renderAt(0)');
    await api.shot(path.join(out, 'paint_' + p + '.jpg'));
  }
  // Raeder: Achse, Drehsinn vorwaerts/rueckwaerts, Lenkung, Stillstand
  rep.wheels = {};
  for (const c of ['stand', 'vorwaerts', 'rueckwaerts', 'links', 'rechts']) {
    await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan', which: 'new', mode: 'gameDay', env: 'neutral', clip: c })})`);
    await api.ev('T.renderAt(0.05)');
    rep.wheels[c] = await api.ev('T.wheelCheck()');
  }
  rep.bounds = await api.ev('T.bounds()');
  // Mehrfach-Szene: 1, 20, 80 Exemplare alt/neu
  rep.perf = [];
  for (const n of [1, 20, 80]) for (const w of ['old', 'new']) {
    await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan', which: 'new', mode: 'gameDay', env: 'neutral', clip: 'stand' })})`);
    rep.perf.push(await api.ev(`T.perfCars(${n}, '${w}', 90)`));
  }
  // Videobilder: Fahrt mit Lenkwechsel in der Stadtszene (Spiel-Licht)
  const frames = path.join(out, 'frames');
  fs.rmSync(frames, { recursive: true, force: true });
  await api.size(1280, 720);
  await api.ev(`T.setup(${JSON.stringify({ asset: 'sedan', which: 'new', mode: 'gameDay', env: 'city', clip: 'vorwaerts' })})`);
  for (let f = 0; f < 150; f++) {
    const t = f / 30;
    const steer = Math.sin(t * 1.3) * 0.38;
    await api.ev(`T.state.steer=${steer}; T.state.speed=${f < 120 ? 6 : -2}; T.view({yaw:${40 + f * 0.9},pitch:12,dist:58,target:null})`);
    await api.ev(`T.renderAt(${t})`);
    await api.shot(path.join(frames, String(f).padStart(4, '0') + '.jpg'), 88);
  }
  fs.writeFileSync(path.join(api.root, 'art/blender-nextgen/reports/sedan-threejs.json'), JSON.stringify(rep, null, 1));
  api.log({ perf: rep.perf, bounds: rep.bounds, driver: rep.shots['08_new_driver'].driver, oldDriver: rep.shots['09_compare_driver'].driver,
    stats: rep.shots['02_compare_threequarter_day'].per, wheelsFwd: rep.wheels.vorwaerts, wheelsLeft: rep.wheels.links });
};
