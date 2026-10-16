#!/usr/bin/env node
'use strict';

// Ableitung aus der vorhandenen StraightDive-Pose auf demselben Skelett.
// Drei Sekunden ruhiger Koerperausgleich; Kurven und Tempo steuert das Spiel.
// Keine neuen Abhaengigkeiten. Aufruf: node tools/create-glide-animation.cjs
const fs = require('node:fs');
const path = require('node:path');
const THREE = require('../lib/three.min.js');
const root = path.resolve(__dirname, '..');

function readGLB(file) {
  const data = fs.readFileSync(file);
  if (data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2) {
    throw new Error('GLB 2.0 erwartet: ' + file);
  }
  let json, bin;
  for (let offset = 12; offset + 8 <= data.length;) {
    const size = data.readUInt32LE(offset), type = data.readUInt32LE(offset + 4);
    const chunk = data.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString());
    if (type === 0x004e4942) bin = chunk;
    offset += 8 + size;
  }
  return { json, bin };
}

function firstValue(source, index) {
  const a = source.json.accessors[index], view = source.json.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.sparse) throw new Error('Float-Spur erwartet');
  const size = { VEC3: 3, VEC4: 4 }[a.type];
  const offset = (view.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({ length: size }, (_, i) => source.bin.readFloatLE(offset + i * 4));
}

function buildGlide(sourcePath, outputPath) {
  const source = readGLB(sourcePath);
  const duration = 3, count = 91;
  const doc = {
    asset: { version: '2.0', generator: 'WEB HERO create-glide-animation.cjs' },
    scene: 0, scenes: source.json.scenes, nodes: source.json.nodes,
    animations: [{ name: 'gleiten', channels: [], samplers: [] }],
    accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }],
  };
  const buffers = [];
  function accessor(values, type, extra = {}) {
    const data = Buffer.alloc(values.length * 4);
    values.forEach((v, i) => data.writeFloatLE(v, i * 4));
    const view = doc.bufferViews.length;
    doc.bufferViews.push({ buffer: 0, byteOffset: doc.buffers[0].byteLength, byteLength: data.length });
    doc.buffers[0].byteLength += data.length;
    buffers.push(data);
    const size = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
    doc.accessors.push({ bufferView: view, componentType: 5126, type, count: values.length / size, ...extra });
    return doc.accessors.length - 1;
  }
  const time = accessor(Array.from({ length: count }, (_, i) => i * duration / (count - 1)),
                        'SCALAR', { min: [0], max: [duration] });
  const base = new THREE.Quaternion(), delta = new THREE.Quaternion(), euler = new THREE.Euler();
  for (const channel of source.json.animations[0].channels) {
    if (channel.target.path !== 'rotation') continue;
    const name = doc.nodes[channel.target.node].name.toLowerCase().replace(/^mixamorig:?/, '');
    base.fromArray(firstValue(source, source.json.animations[0].samplers[channel.sampler].output)).normalize();
    const frames = [];
    for (let i = 0; i < count; i++) {
      const phase = (i === count - 1 ? 0 : i / (count - 1)) * Math.PI * 2;
      const breathe = Math.sin(phase), sway = Math.sin(phase * 2);
      const side = name.startsWith('left') ? 1 : -1;
      let x = 0, y = 0, z = 0;
      if (name === 'spine') { x = breathe * 0.025; z = sway * 0.012; }
      else if (name === 'spine1' || name === 'spine2') { x = breathe * 0.018; y = sway * 0.016; }
      else if (name === 'neck' || name === 'head') { x = -breathe * 0.012; y = sway * 0.012; }
      else if (/shoulder$/.test(name)) { x = breathe * 0.025; z = sway * side * 0.025; }
      else if (/forearm$/.test(name)) x = Math.sin(phase + side * 0.7) * 0.045;
      else if (/arm$/.test(name)) { x = breathe * 0.035; z = sway * side * 0.035; }
      else if (/upleg$/.test(name)) { x = Math.sin(phase + side * 0.5) * 0.035; z = sway * side * 0.018; }
      else if (/leg$/.test(name)) x = Math.sin(phase + side * 0.5) * 0.055;
      delta.setFromEuler(euler.set(x, y, z));
      const q = base.clone().multiply(delta).normalize();
      frames.push(q.x, q.y, q.z, q.w);
    }
    const output = accessor(frames, 'VEC4');
    const animation = doc.animations[0];
    animation.channels.push({ sampler: animation.samplers.length, target: { ...channel.target } });
    animation.samplers.push({ input: time, output, interpolation: 'LINEAR' });
  }
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const bin = Buffer.concat(buffers), out = Buffer.alloc(28 + json.length + bin.length);
  out.write('glTF'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(json.length, 12); out.writeUInt32LE(0x4e4f534a, 16); json.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length);
  bin.copy(out, 28 + json.length); fs.writeFileSync(outputPath, out);
  return out;
}

if (require.main === module) {
  const output = path.join(root, 'assets/hero@gleiten.glb');
  const bytes = buildGlide(path.join(root, 'assets/hero@sturzflug.glb'), output);
  console.log('Gleitflug: 3 Sekunden, 91 Schluesselbilder, ' + bytes.length + ' Bytes');
}
module.exports = { buildGlide, readGLB };
