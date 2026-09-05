'use strict';
// Executes the actual game factories with Three.js r128, without a renderer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');
const createLook = require('../city-visuals.js');
const root = path.resolve(__dirname, '..');

function cityRuntime(modern = true) {
  const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  function between(start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('Factory not found: ' + start);
    return source.slice(a, b);
  }
  const look = createLook(THREE), env = {
    THREE, console, Math, scene: new THREE.Scene(), CITY_LOOK: modern ? look : null,
    pick: a => a[0], rand: (a, b) => (a + b) / 2,
    ZUG_WAGEN: 3, ZUG_WLANG: 17.5, ZUG_LUECKE: 0.9, ZUG_BREIT: 2.6,
    ZUG_HOCH: 3.5, ZUG_BODEN: 1.2, ZUG_BANK: 0.58, ZUG_TUER_X: [-4.6, 4.6], ZUG_TUER_B: 1.35,
  };
  vm.runInNewContext([
    between('const SKINS =', 'function baueDekoMesh('),
    between('function makeCarMesh(', '/* ======================= Helikopter'),
    between('function makeHeliMesh(', '/* Höchstes Haus entlang'),
    between('function makeFahrzeugMesh(', '/* ======================= Ampeln'),
    between('function baueZug(', 'function baueZuege('),
  ].join('\n'), env);
  return { ...env, look, source };
}
module.exports = { cityRuntime, THREE, root };
