/* WEB HERO: native, offline 3D city assets. Geometry only; no gameplay state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.WEB_HERO_VISUALS = factory(root.THREE);
})(typeof window === 'object' ? window : this, function (THREE) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const blend = (rate, dt) => 1 - Math.exp(-rate * Math.max(0, dt));
  const enabled = typeof location === 'undefined' || !/[?&]classicVisuals=1(?:&|$)/.test(location.search);
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const plane = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  const up = new THREE.Vector3(0, 1, 0);
  const materials = {
    stone: new THREE.MeshLambertMaterial({ vertexColors: true }),
    glass: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 95, specular: 0xb6ceda,
      transparent: true, opacity: 0.23, depthWrite: false, side: THREE.DoubleSide }),
    trim: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 32, specular: 0x596370 }),
    windows: new THREE.MeshPhongMaterial({ color: 0x718b99, transparent: true,
      opacity: 0.25, depthWrite: false, shininess: 45 }),
    light: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };

  // One draw call per surface group, never one per window or brick.
  class Batch {
    constructor() { this.p = []; this.n = []; this.c = []; }
    geometry(g, color, matrix) {
      const p = g.attributes.position, n = g.attributes.normal;
      const v = new THREE.Vector3(), nn = new THREE.Vector3();
      const normal = new THREE.Matrix3().getNormalMatrix(matrix);
      const c = new THREE.Color(color);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(matrix);
        nn.fromBufferAttribute(n, i).applyMatrix3(normal).normalize();
        this.p.push(v.x, v.y, v.z); this.n.push(nn.x, nn.y, nn.z); this.c.push(c.r, c.g, c.b);
      }
    }
    box(w, h, d, x, y, z, color, ry = 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(up, ry);
      this.geometry(box, color, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, d)));
    }
    softBox(w, h, d, x, y, z, color) {
      const b = new Batch();
      loft(b, [[-d / 2, w / 2, -h / 2, h / 2], [d / 2, w / 2, -h / 2, h / 2]], color);
      const geo = b.finish(); this.geometry(geo, color, new THREE.Matrix4().makeTranslation(x, y, z)); geo.dispose();
    }
    panel(w, h, x, y, z, color, ry = 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(up, ry);
      this.geometry(plane, color, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, 1)));
    }
    quad(a, b, c, d, color) {
      this.polygon([a, b, c, d], color);
    }
    polygon(vertices, color) {
      const [a, b, c] = vertices;
      const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
        .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a))).normalize();
      const col = new THREE.Color(color);
      for (let i = 1; i < vertices.length - 1; i++) for (const v of [a, vertices[i], vertices[i + 1]]) {
          this.p.push(...v); this.n.push(n.x, n.y, n.z); this.c.push(col.r, col.g, col.b);
        }
    }
    beam(a, b, w, d, color) {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), dir = end.clone().sub(start);
      this.geometry(box, color, new THREE.Matrix4().compose(start.add(end).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()), new THREE.Vector3(w, dir.length(), d)));
    }
    finish() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.computeBoundingBox(); g.computeBoundingSphere(); return g;
    }
    mesh(mat, name) {
      const m = new THREE.Mesh(this.finish(), mat); m.name = name;
      m.castShadow = mat !== materials.windows && mat !== materials.light;
      m.receiveShadow = true; return m;
    }
  }

  const TOWERS = [
    { name: 'Glasraster', wall: 0x233c48, trim: 0xa4b4bc, glass: [0x426876, 0x527f8d, 0x315967, 0x69929b] },
    { name: 'Kalkstein', wall: 0xb8b5a8, trim: 0xd8d3c5, glass: [0x294c5c, 0x365f6b, 0x254453, 0x526d72] },
    { name: 'Backstein & Kupfer', wall: 0x735449, trim: 0xb28561, glass: [0x365e65, 0x45717a, 0x254c57, 0x62858a] },
    { name: 'Silberband', wall: 0x526069, trim: 0xc8cdd0, glass: [0x46687f, 0x627f91, 0x365b73, 0x8199a4] },
  ];
  function createTower(w, h, d, variant = 0) {
    if (![w, h, d].every(Number.isFinite) || Math.min(w, h, d) <= 0) throw new Error('Invalid tower dimensions');
    const kind = ((variant % TOWERS.length) + TOWERS.length) % TOWERS.length, style = TOWERS[kind];
    const solid = new Batch(), glazing = new Batch(), rooms = new Batch(), lamps = new Batch();
    const group = new THREE.Group();
    const lobby = Math.min(4.2, h * 0.18), floors = Math.max(1, Math.floor((h - lobby) / 3.15));
    const rise = (h - lobby - 0.36) / floors;
    const roomDepth = Math.min(3.6, Math.min(w, d) * 0.28);
    // Real space behind the glass: the opaque core is recessed by several
    // metres. Collision remains the original closed building envelope.
    solid.box(w - roomDepth * 2, h - 0.12, d - roomDepth * 2, 0, (h - 0.12) / 2, 0, 0x696963);
    solid.box(w, 0.12, d, 0, 0.06, 0, 0x8c8b83);
    solid.box(w, 0.12, d, 0, h - 0.06, 0, 0x849095); // exact walkable roof; no invisible crown
    for (let floor = 0; floor <= floors; floor++) {
      const y = lobby + floor * rise;
      solid.box(w - 0.08, 0.16, d - 0.08, 0, y + 0.08, 0, 0xa6a59c);
    }
    for (let face = 0; face < 4; face++) {
      const width = face % 2 ? d : w, depth = face % 2 ? w : d, ry = face * Math.PI / 2;
      const local = (x, z) => [Math.cos(ry) * x + Math.sin(ry) * z, -Math.sin(ry) * x + Math.cos(ry) * z];
      const bar = (bw, bh, bd, x, y, inset, color) => {
        const [px, pz] = local(x, depth / 2 - inset); solid.box(bw, bh, bd, px, y, pz, color, ry);
      };
      const window = (bw, bh, x, y, color, inset = 0.015) => {
        const [px, pz] = local(x, depth / 2 - inset); glazing.panel(bw, bh, px, y, pz, color, ry);
      };
      const inside = (batch, bw, bh, bd, x, y, inset, color) => {
        const [px, pz] = local(x, depth / 2 - inset); batch.box(bw, bh, bd, px, y, pz, color, ry);
      };
      const cols = Math.max(2, Math.floor((width - 0.5) / (kind === 1 ? 2.9 : 2.5)));
      const step = (width - 0.5) / cols;
      const column = [0.22, 1.05, 0.66, 0.40][kind];
      const band = [0.58, 1.05, 0.82, 1.12][kind];
      for (let col = 0; col < cols; col++) {
        const x = -width / 2 + 0.25 + (col + 0.5) * step;
        window(step - column, lobby - 0.18, x, lobby / 2, 0xc1d6d9);
        for (let floor = 0; floor < floors; floor++) {
          const base = lobby + floor * rise, y = base + rise / 2;
          const seed = floor * 11 + col * 7 + face * 3 + kind * 17;
          window(step - column, rise - band, x, y, seed % 3 ? 0xc2d8dd : 0xb0cbd4);
          // Some offices have blinds. Others reveal desks, chairs and
          // monitors; no furniture or luminous panel sits on the glass.
          if (seed % 9 === 0) {
            inside(rooms, step - column - 0.08, rise * 0.28, 0.018, x,
              base + rise * 0.79, 0.13, 0xb9b7aa);
          }
          if (seed % 12 === 0) {
            const deskDepth = Math.min(roomDepth - 0.55, 1.55);
            inside(rooms, Math.min(step * 0.65, 1.45), 0.07, 0.68, x, base + 0.88, deskDepth, 0x9c8262);
            for (const sx of [-1, 1]) inside(rooms, 0.055, 0.67, 0.5,
              x + sx * Math.min(step * 0.24, 0.54), base + 0.51, deskDepth, 0x495258);
            inside(rooms, 0.49, 0.31, 0.05, x, base + 1.09, deskDepth + 0.13, 0x26333c);
            inside(rooms, 0.43, 0.37, 0.06, x, base + 0.75, deskDepth - 0.48, 0x4c6269);
          }
          if (seed % 5 === 0) {
            const half = Math.min(step - 0.3, 1.1) / 2, z = depth / 2 - roomDepth * 0.52;
            const corners = [[x - half, z - 0.21], [x + half, z - 0.21],
              [x + half, z + 0.21], [x - half, z + 0.21]].map(([px, pz]) => {
                const p = local(px, pz); return [p[0], base + rise - 0.1, p[1]];
              });
            lamps.quad(...corners, seed % 2 ? 0xeadcc2 : 0xd2e3e5);
          }
          if (col > 0 && col % 3 === 0) inside(solid, 0.07, rise - 0.16,
            roomDepth - 0.13, x - step / 2, y + 0.08, roomDepth / 2 + 0.065, 0xaba89c);
        }
      }
      // Columns and floor bands have depth, but stay inside the existing collision box.
      for (let col = 0; col <= cols; col++) {
        const x = -width / 2 + 0.25 + col * step;
        bar(col === 0 || col === cols ? Math.min(0.5, column) : column,
          h - 0.22, 0.18, x, (h - 0.22) / 2, 0.09, kind === 1 || kind === 2 ? style.wall : style.trim);
      }
      for (let floor = 0; floor <= floors; floor++) {
        const y = lobby + floor * rise;
        bar(width - 0.2, floor === floors ? Math.min(band, 0.45) : band,
          0.16, 0, y, 0.08, kind === 1 || kind === 2 ? style.wall : style.trim);
      }
      bar(width, 0.16, 0.12, 0, h - 0.25, 0.06, style.trim);
      bar(width, 0.18, 0.12, 0, 0.09, 0.06, style.trim);
      // A narrow recessed double door makes the ground floor readable at street level.
      if (face === 0) {
        window(Math.min(2.25, width * 0.24), lobby - 0.65, 0, (lobby - 0.65) / 2, 0xb9d1d4, 0.008);
        bar(0.07, lobby - 0.65, 0.1, 0, (lobby - 0.65) / 2, 0.05, style.trim);
        inside(rooms, Math.min(width * 0.3, 3.5), 0.92, 0.7, 0, 0.58, roomDepth - 0.5, 0x776f61);
      }
    }
    const interior = new THREE.LOD(); interior.name = 'OfficeDetails';
    interior.addLevel(rooms.mesh(materials.stone, 'OfficeFurniture'), 0);
    interior.addLevel(new THREE.Group(), 150);
    const panes = glazing.mesh(materials.glass, 'Glazing'); panes.castShadow = false; panes.renderOrder = 2;
    group.add(solid.mesh(materials.stone, 'Structure'), panes, lamps.mesh(materials.light, 'OfficeLights'), interior);
    group.name = 'WEB_HERO_Hochhaus_' + style.name;
    group.userData = { visualKind: 'tower', variant: kind, floors: floors + 1, roofHeight: h,
      footprint: { width: w, depth: d }, roomDepth, source: 'native-geometry' };
    return group;
  }

  function loft(batch, sections, color) {
    const rings = sections.map(([z, w, low, high]) => {
      const b = Math.min(0.065, (high - low) * 0.3, w * 0.13);
      return [[-w + b, low, z], [w - b, low, z], [w, low + b, z], [w, high - b, z],
        [w - b, high, z], [-w + b, high, z], [-w, high - b, z], [-w, low + b, z]];
    });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 8; j++) {
      const next = (j + 1) % 8;
      batch.quad(rings[i][j], rings[i][next], rings[i + 1][next], rings[i + 1][j], color);
    }
    batch.polygon(rings[0].slice().reverse(), color);
    batch.polygon(rings[rings.length - 1], color);
  }
  let carSerial = 0;
  const carCache = new Map();
  let wheelGeometry;
  function wheel() {
    if (wheelGeometry) return wheelGeometry;
    const b = new Batch(), tire = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 20).toNonIndexed();
    b.geometry(tire, 0x181c23, new THREE.Matrix4().makeRotationZ(Math.PI / 2)); tire.dispose();
    for (const sx of [-1, 1]) {
      const rim = new THREE.CylinderGeometry(0.235, 0.235, 0.014, 16).toNonIndexed();
      const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2); m.setPosition(sx * 0.127, 0, 0);
      b.geometry(rim, 0x3b444c, m); rim.dispose();
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        b.beam([sx * 0.139, 0, 0], [sx * 0.139, Math.cos(angle) * 0.215, Math.sin(angle) * 0.215], 0.024, 0.045, 0xc1cbd0);
      }
    }
    wheelGeometry = b.finish(); return wheelGeometry;
  }
  function carParts(color, kind) {
    const key = color + ':' + kind;
    if (carCache.has(key)) return carCache.get(key);
    const trim = new Batch(), glass = new Batch(), lights = new Batch();
    const rearRoof = kind === 2 ? -1.48 : kind === 1 ? -1.38 : -1.3;
    const nose = kind === 1 ? 0.99 : 0.92;
    // Open cabin: the low tub stays below the existing seat cushions.
    const open = new Batch();
    loft(open, [[-2.28, 0.76, 0.4, 0.7], [-1.93, 0.94, 0.3, 0.76],
      [1.78, 0.94, 0.3, 0.76], [2.28, 0.78, 0.42, 0.7]], color);
    loft(open, [[1.07, 0.9, 0.75, 1.1], [1.8, 0.93, 0.68, 1.04], [2.28, 0.78, 0.6, nose]], color);
    loft(open, [[-2.28, 0.76, 0.6, 0.86], [-1.85, 0.93, 0.7, 1.08], [-1.53, 0.9, 0.75, 1.12]], color);
    for (const sx of [-1, 1]) {
      open.box(0.1, 0.36, 2.62, sx * 0.88, 0.93, -0.23, color);
      trim.box(0.025, 0.055, 2.6, sx * 0.939, 1.1, -0.22, 0x263039);
      trim.box(0.025, 0.32, 0.021, sx * 0.94, 0.92, -0.37, 0x303b42);
      for (const z of [0.38, -0.94]) trim.box(0.035, 0.035, 0.17, sx * 0.949, 1.02, z, 0xbcc7cb);
      open.box(0.17, 0.11, 0.25, sx * 0.956, 1.29, 0.74, color);
      trim.box(0.12, 0.07, 0.018, sx * 0.956, 1.29, 0.605, 0x455966);
      const A = [sx * 0.87, 1.12, 1.08], B = [sx * 0.78, 1.88, 0.64];
      const C = [sx * 0.78, 1.88, rearRoof], D = [sx * 0.87, 1.12, -1.55];
      trim.beam(A, B, 0.065, 0.075, 0x28333c); trim.beam(C, D, 0.075, 0.08, 0x28333c);
      trim.beam([sx * 0.87, 1.12, -0.39], [sx * 0.78, 1.88, -0.39], 0.06, 0.075, 0x28333c);
      if (sx > 0) glass.quad(D, C, B, A, 0xffffff); else glass.quad(A, B, C, D, 0xffffff);
    }
    glass.quad([-0.87, 1.12, 1.08], [0.87, 1.12, 1.08], [0.78, 1.88, 0.64], [-0.78, 1.88, 0.64], 0xffffff);
    glass.quad([-0.87, 1.12, -1.55], [-0.78, 1.88, rearRoof], [0.78, 1.88, rearRoof], [0.87, 1.12, -1.55], 0xffffff);
    loft(open, [[rearRoof - 0.06, 0.76, 1.88, 1.94], [rearRoof + 0.2, 0.81, 1.88, 1.98],
      [0.44, 0.81, 1.88, 1.98], [0.7, 0.76, 1.87, 1.94]], color);
    for (const sz of [-1, 1]) trim.box(1.52, 0.12, 0.065, 0, 0.48, sz * 2.27, 0x202a33);
    // Wipers follow the windshield, rather than floating across the cabin.
    for (const sx of [-1, 1]) trim.beam([sx * 0.55, 1.155, 1.082],
      [sx * 0.16, 1.43, 0.928], 0.018, 0.018, 0x263039);
    if (kind !== 0) for (const sx of [-1, 1]) trim.box(0.045, 0.045, 1.56,
      sx * 0.7, 1.954, -0.42, kind === 1 ? 0x343c41 : 0x9ca9ae);
    trim.box(0.94, 0.17, 0.02, 0, 0.73, 2.285, 0x1c2932);
    for (let i = 0; i < 5; i++) trim.box(0.8, 0.008, 0.025, 0, 0.67 + i * 0.026, 2.3, 0x4f5e66);
    for (const sx of [-1, 1]) lights.box(0.4, 0.065, 0.028, sx * 0.51, 0.86, 2.285, 0xe9f5fa);
    if (kind === 1) lights.box(0.55, 0.025, 0.029, 0, 0.86, 2.285, 0xe9f5fa);
    const result = [open.finish(), trim.finish(), glass.finish(), lights.finish()];
    carCache.set(key, result); return result;
  }
  function createCar(color, variant) {
    const kind = variant === undefined ? carSerial++ % 3 : ((variant % 3) + 3) % 3;
    const g = new THREE.Group(), parts = carParts(color, kind), wheels = [];
    const mats = [materials.trim, materials.trim, materials.windows, materials.light];
    parts.forEach((geo, i) => { const m = new THREE.Mesh(geo, mats[i]); m.name = ['Body', 'Trim', 'Windows', 'LED'][i]; m.castShadow = i < 2; m.receiveShadow = true; g.add(m); });
    for (const sx of [-1, 1]) for (const z of [1.36, -1.36]) {
      const steer = new THREE.Group(), roll = new THREE.Mesh(wheel(), materials.trim);
      steer.position.set(sx * 0.93, 0.35, z); steer.add(roll); g.add(steer);
      steer.name = (z > 0 ? 'Front' : 'Rear') + (sx < 0 ? 'Left' : 'Right');
      wheels.push({ steer, roll, front: z > 0 });
    }
    const brake = new THREE.MeshBasicMaterial({ color: 0x8d292b });
    const tail = new Batch();
    for (const sx of [-1, 1]) tail.box(0.44, 0.07, 0.03, sx * 0.51, 0.8, -2.29, 0xffffff);
    g.add(tail.mesh(brake, 'BrakeLights'));
    g.name = 'WEB_HERO_' + ['Fastback', 'Crossover', 'Sportkombi'][kind];
    g.userData.visualKind = 'modern-car'; g.userData.variant = kind; g.userData.roofHeight = 1.98;
    g.userData.collisionHull = { halfWidth: 1.09, halfLength: 2.32, roof: 1.98 };
    g.userData.cityMotion = { wheels, brake, speed: 0, yaw: null, steering: 0 };
    return g;
  }
  function updateCar(g, speed, dt) {
    const m = g.userData.cityMotion;
    if (!m || !Number.isFinite(speed) || !Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(dt, 0.1), yaw = g.rotation.y;
    const turn = m.yaw === null ? 0 : Math.atan2(Math.sin(yaw - m.yaw), Math.cos(yaw - m.yaw));
    const target = Math.abs(turn) < 0.8 && speed > 0.3 ? clamp(Math.atan(2.72 * turn / step / Math.max(3, speed)), -0.45, 0.45) : 0;
    m.steering += (target - m.steering) * blend(10, step);
    for (const wheel of m.wheels) {
      wheel.roll.rotation.x = (wheel.roll.rotation.x + speed * step / (m.radius || 0.35)) % (Math.PI * 2);
      if (wheel.front) wheel.steer.rotation.y = m.steering;
    }
    m.brake.color.setHex(speed < 0.1 || (speed - m.speed) / step < -1.1 ? 0xff4038 : 0x8d292b);
    m.speed = speed; m.yaw = yaw;
  }

  let utilityWheelGeometry;
  // Truck and bus bodies already contain working interiors. Refine their shell
  // and animate the existing axles without replacing passenger or traffic data.
  function finishUtilityVehicle(g, type, color, wheels) {
    const L = type.laenge, B = type.breite, cargo = type.art !== 'bus';
    const detail = new Batch(), lights = new Batch(), tail = new Batch();
    if (!utilityWheelGeometry) utilityWheelGeometry = wheel().clone().scale(1.25, 0.46 / 0.35, 0.46 / 0.35);
    const retiredWheelGeometry = new Set();
    for (const axle of wheels) {
      if (!axle.roll.userData.sharedFleetWheel) retiredWheelGeometry.add(axle.roll.geometry);
      axle.roll.geometry = utilityWheelGeometry; axle.roll.material = materials.trim;
      axle.roll.rotation.set(0, 0, 0);
    }
    for (const old of retiredWheelGeometry) if (old !== utilityWheelGeometry) old.dispose();
    const front = L / 2;
    detail.box(B - 0.2, 0.16, 0.11, 0, 0.43, front - 0.02, 0x24313a);
    detail.box(B * 0.53, 0.37, 0.035, 0, 0.91, front + 0.061, 0x26353f);
    for (let i = 0; i < 5; i++) detail.box(B * 0.46, 0.018, 0.02, 0, 0.77 + i * 0.065, front + 0.084, 0x87979e);
    for (const sx of [-1, 1]) {
      detail.box(0.14, 0.22, 0.2, sx * (B / 2 - 0.02), 1.82, front - 0.4, 0x29353d);
      detail.box(0.15, 0.06, 0.64, sx * (B / 2 - 0.03), 0.39, front - 1.1, 0x6e808b);
      lights.box(0.44, 0.055, 0.04, sx * (B / 2 - 0.41), 0.72, front + 0.075, 0xeaf5fa);
      tail.box(0.27, 0.09, 0.04, sx * (B / 2 - 0.3), 0.66, -L / 2 - 0.025, 0xffffff);
      if (cargo) {
        // Corrugated cargo panels, reflective safety stripe and rear loading door.
        for (let i = 0; i < 11; i++) detail.box(0.026, 1.9, 0.045, sx * (B / 2 + 0.065), 1.6,
          -L / 2 + 0.2 + i * (L - 3.0) / 10, 0xb0bac1);
        detail.box(0.026, 0.105, L - 2.8, sx * (B / 2 + 0.067), 0.59, -1.3, 0xdcbf68);
      } else {
        detail.box(0.025, 0.08, L - 0.6, sx * (B / 2 + 0.014), 1.37, 0, 0xc5d5db);
      }
    }
    if (cargo) {
      for (const x of [-B / 2 + 0.12, 0, B / 2 - 0.12]) detail.box(0.045, 2.04, 0.035, x, 1.6, -L / 2 - 0.07, 0x7c8b96);
      // Sloping fairing above the cab stays below the existing cargo roof.
      loft(detail, [[front - 2.22, B * 0.47, 2.34, 2.71], [front - 0.35, B * 0.4, 2.34, 2.4]], color);
    }
    g.add(detail.mesh(materials.trim, 'UtilityBodyDetails'), lights.mesh(materials.light, 'DaytimeLED'));
    const brake = new THREE.MeshBasicMaterial({ color: 0x8d292b });
    g.add(tail.mesh(brake, 'BrakeLights'));
    g.userData.cityMotion = { wheels, brake, speed: 0, yaw: null, steering: 0, radius: 0.46 };
    g.userData.visualKind = cargo ? 'modern-truck' : 'modern-bus';
    g.userData.collisionHull = { halfWidth: B / 2 + 0.09, halfLength: L / 2 + 0.1, roof: cargo ? 2.75 : 2.7 };
  }

  const fleetWheelCache = new Map();
  function fleetWheels(g, width, front, rear, radius) {
    if (!fleetWheelCache.has(radius)) fleetWheelCache.set(radius,
      wheel().clone().scale(1.15, radius / 0.35, radius / 0.35));
    const wheels = [];
    for (const z of [front, rear]) for (const side of [-1, 1]) {
      const steer = new THREE.Group(), roll = new THREE.Mesh(fleetWheelCache.get(radius), materials.trim);
      roll.userData.sharedFleetWheel = true;
      steer.position.set(side * (width / 2 - 0.12), radius, z);
      steer.add(roll); g.add(steer); wheels.push({ steer, roll, front: z === front });
    }
    return wheels;
  }
  const signCache = new Map();
  function fleetSign(g, text, w, h, x, y, z, ry = 0) {
    if (typeof document === 'undefined') return;
    if (!signCache.has(text)) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#172832'; ctx.fillRect(0, 0, 512, 96);
      ctx.fillStyle = '#e8f1e8'; ctx.font = 'bold 47px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(text, 256, 65, 495);
      const texture = new THREE.CanvasTexture(canvas);
      signCache.set(text, new THREE.MeshBasicMaterial({ map: texture }));
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signCache.get(text));
    m.name = 'FleetSign'; m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
  }
  function createAmbulance() {
    const g = new THREE.Group(), body = new Batch(), glass = new Batch(), trim = new Batch(), leds = new Batch(), tail = new Batch();
    const white = 0xdce2df, red = 0xc04b37, dark = 0x27333a;
    // A separate hollow cab and chamfered patient module, with a real sill.
    body.softBox(2.06, 1.87, 3.24, 0, 1.365, -0.85, white);
    loft(body, [[1.98, 0.94, 0.44, 1.17], [2.62, 0.88, 0.49, 1.02]], white);
    body.softBox(1.91, 0.12, 1.13, 0, 2.05, 1.30, white);
    body.box(1.9, 0.1, 1.85, 0, 0.58, 1.54, dark);
    for (const sx of [-1, 1]) {
      body.box(0.08, 0.59, 1.27, sx * 0.94, 0.915, 1.345, white);
      body.box(0.075, 0.91, 0.10, sx * 0.915, 1.6, 0.78, white);
      body.beam([sx * 0.91, 1.99, 1.86], [sx * 0.91, 1.17, 2.25], 0.075, 0.075, white);
      glass.quad([sx * 0.918, 1.22, 0.83], [sx * 0.918, 1.98, 0.83],
        [sx * 0.918, 1.98, 1.81], [sx * 0.918, 1.22, 2.16], 0xb7d6db);
      body.box(0.026, 0.26, 3.05, sx * 1.039, 1.14, -0.86, red);
      trim.box(0.027, 0.07, 4.72, sx * 1.04, 0.60, -0.02, 0xe6d187);
      trim.box(0.065, 0.29, 0.20, sx * 1.07, 1.71, 1.95, dark);
      trim.box(0.03, 0.08, 0.20, sx * 0.963, 1.17, 1.04, dark);
      leds.box(0.39, 0.11, 0.035, sx * 0.65, 0.97, 2.625, 0xe0edf2);
      tail.box(0.13, 0.30, 0.026, sx * 0.85, 0.93, -2.483, 0xffffff);
      // Six-arm emergency-service symbol, no third-party logo texture.
      for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
        trim.geometry(box, 0x2f6883, new THREE.Matrix4().compose(new THREE.Vector3(sx * 1.042, 1.72, -0.68), q,
          new THREE.Vector3(0.012, 0.53, 0.15)));
      }
      // Patient module rear doors and handles.
      trim.box(0.83, 0.55, 0.026, sx * 0.50, 1.88, -2.483, 0x526b73);
      trim.box(0.035, 0.25, 0.035, sx * 0.08, 1.31, -2.497, 0x92a5aa);
      fleetSign(g, 'RETTUNG 112', 1.35, 0.24, sx * 1.051, 2.11, -0.72, sx * Math.PI / 2);
    }
    glass.quad([-0.87, 1.23, 2.24], [0.87, 1.23, 2.24], [0.87, 1.99, 1.90], [-0.87, 1.99, 1.90], 0xa7c6cc);
    trim.box(0.035, 1.69, 0.025, 0, 1.34, -2.498, dark);
    trim.box(1.66, 0.18, 0.10, 0, 0.46, 2.64, dark);
    trim.box(0.86, 0.25, 0.03, 0, 0.90, 2.638, dark);
    for (let i = 0; i < 4; i++) trim.box(0.78, 0.014, 0.015, 0, 0.82 + i * 0.055, 2.659, 0x869a9f);
    for (const sx of [-1, 1]) {
      trim.softBox(0.55, 0.12, 0.48, sx * 0.44, 1.12, 1.18, dark);
      trim.softBox(0.53, 0.64, 0.10, sx * 0.44, 1.46, 0.94, dark);
    }
    trim.box(1.65, 0.16, 0.30, 0, 1.44, 1.83, dark);
    const wheelRing = new THREE.TorusGeometry(0.18, 0.026, 6, 18).toNonIndexed();
    trim.geometry(wheelRing, dark, new THREE.Matrix4().makeRotationX(1.18).setPosition(-0.44, 1.52, 1.61)); wheelRing.dispose();
    g.add(body.mesh(materials.trim, 'AmbulanceBody'), trim.mesh(materials.trim, 'AmbulanceEquipment'),
      glass.mesh(materials.glass, 'AmbulanceCabGlass'), leds.mesh(materials.light, 'AmbulanceLED'));
    const beacons = new THREE.Group();
    for (const sx of [-1, 1]) {
      const b = new Batch();
      b.box(0.49, 0.13, 0.26, sx * 0.32, 2.39, 0.52, 0x458df2);
      b.box(0.10, 0.11, 0.21, sx * 0.98, 2.17, -2.10, 0x458df2);
      beacons.add(b.mesh(materials.light, 'BlueBeacon'));
    }
    g.add(beacons); g.userData.blaulicht = beacons;
    g.userData.fahrerSitz = { x: -0.44, y: 1.24, z: 1.18, scale: 0.85 };
    const brake = new THREE.MeshBasicMaterial({ color: 0x8d292b });
    g.add(tail.mesh(brake, 'BrakeLights'));
    g.userData.cityMotion = { wheels: fleetWheels(g, 2.1, 1.76, -1.64, 0.41), brake, speed: 0, yaw: null, steering: 0, radius: 0.41 };
    g.userData.collisionHull = { halfWidth: 1.12, halfLength: 2.72, roof: 2.46 };
    g.userData.visualKind = 'modern-ambulance';
    return g;
  }
  function createBus(type, color) {
    const g = new THREE.Group(), body = new Batch(), interior = new Batch(), glass = new Batch(), light = new Batch();
    const L = type.laenge, B = type.breite, front = L / 2;
    const paint = new THREE.Color(color).lerp(new THREE.Color(0x34474b), 0.42).getHex();
    const floor = 0.57, seatY = 1.12, windowBottom = 1.16, windowTop = 2.43;
    // The aisle is hollow. No full body box through passengers' legs.
    body.softBox(B, 0.20, L, 0, 0.44, 0, 0x394750);
    body.softBox(B, 0.22, L, 0, 2.59, 0, 0xd3d9d5);
    interior.box(B - 0.17, 0.06, L - 0.20, 0, floor - 0.03, 0, 0x454e51);
    interior.box(0.68, 0.008, L - 1.7, 0, floor + 0.004, -0.45, 0x6b7370);
    body.box(B, 0.58, 0.08, 0, 0.86, -front + 0.04, paint);
    body.box(B - 0.08, 0.58, 0.10, 0, 0.86, front - 0.05, paint);
    body.box(B - 0.06, 1.32, 0.08, 0, 1.81, -front + 0.04, 0xd3d9d5);
    for (const sx of [-1, 1]) {
      body.box(0.08, 0.59, L - 0.15, sx * (B / 2 - 0.04), 0.865, 0, paint);
      body.box(0.022, 0.09, L - 0.3, sx * (B / 2 + 0.011), 1.105, 0, 0x9aaeb0);
      glass.panel(L - 0.25, windowTop - windowBottom, sx * (B / 2 - 0.026),
        (windowTop + windowBottom) / 2, 0, 0xb7d1d6, sx * Math.PI / 2);
      for (let i = 0; i <= 6; i++) body.box(0.09, 1.29, 0.075,
        sx * (B / 2 - 0.044), 1.805, -front + 0.13 + i * (L - 0.26) / 6, 0x283b42);
      interior.box(0.036, 0.036, L - 1.25, sx * 0.43, 2.29, -0.12, 0xd6b650);
      light.box(0.065, 0.016, L - 1.1, sx * 0.69, 2.468, 0, 0xe4ebdb);
      for (const z of [-2.6, -0.1, 2.4]) interior.box(0.035, 1.72, 0.035, sx * 0.42, 1.43, z, 0xd6b650);
    }
    glass.panel(B - 0.17, 1.29, 0, 1.805, front - 0.018, 0xadc7d1);
    const seats = [];
    const addSeat = (x, z, driver = false) => {
      const shade = driver ? 0x29363e : 0x3a6672;
      interior.softBox(0.53, 0.10, 0.48, x, seatY - 0.06, z + 0.035, shade);
      interior.softBox(0.52, 0.56, 0.09, x, seatY + 0.23, z - 0.22, shade);
      interior.box(0.18, seatY - floor - 0.10, 0.17, x, (floor + seatY - 0.10) / 2, z, 0x9ba8a8);
      interior.box(0.42, 0.045, 0.10, x, seatY + 0.525, z - 0.22, 0xc4cccc);
      seats.push({ x, y: seatY + 0.06, z, ry: 0, fahrer: driver, scale: 0.94, floor });
    };
    addSeat(-0.65, front - 1.25, true);
    // Interleave both sides so a bounded real-person pool fills the cabin evenly.
    for (const z of [-2.8, -1.55, -0.3, 0.95]) for (const sx of [-1, 1]) addSeat(sx * 0.75, z);
    interior.box(B - 0.26, 0.16, 0.45, 0, 1.43, front - 0.56, 0x27343c);
    interior.box(0.61, 0.74, 0.055, -0.65, 0.97, front - 1.57, 0xb7c3c0);
    interior.box(0.13, 0.20, 0.11, 0.55, 1.43, front - 1.28, 0x384c5b);
    const wheelRing = new THREE.TorusGeometry(0.2, 0.026, 6, 18).toNonIndexed();
    interior.geometry(wheelRing, 0x1e2b32, new THREE.Matrix4().makeRotationX(1.18).setPosition(-0.65, 1.45, front - 0.846)); wheelRing.dispose();
    // Front and centre folding-door seams and contrasting step edges.
    for (const z of [front - 0.73, -0.35]) {
      for (const dz of [-0.48, 0, 0.48]) body.box(0.013, 1.78, 0.028, B / 2 + 0.004, 1.42, z + dz, 0x28383f);
      interior.box(0.25, 0.012, 0.91, B / 2 - 0.20, floor + 0.006, z, 0xd8bd62);
    }
    g.add(body.mesh(materials.trim, 'BusShell'), interior.mesh(materials.stone, 'BusInterior'),
      glass.mesh(materials.glass, 'BusGlass'), light.mesh(materials.light, 'BusCeilingLights'));
    const wheels = fleetWheels(g, B, front - 1.3, -front + 1.6, 0.46);
    // Reuse the existing vehicle motion and conservative collision envelope.
    finishUtilityVehicle(g, type, paint, wheels);
    g.userData.sitzplaetze = seats; g.userData.floorHeight = floor;
    fleetSign(g, 'M4  CENTRAL', 1.55, 0.19, 0, 2.573, front + 0.008);
    fleetSign(g, 'NÄCHSTER HALT · CENTRAL', 1.33, 0.17, 0, 2.30, front - 0.36, Math.PI);
    return g;
  }

  const treeCache = new Map();
  function createTree(variant = 0) {
    const kind = ((variant % 4) + 4) % 4;
    if (!treeCache.has(kind)) {
      const wood = new Batch(), leaves = new Batch();
      let seed = 171 + kind * 83;
      const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
      const branch = (a, b, r0, r1) => {
        const p = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(p);
        const geo = new THREE.CylinderGeometry(r1, r0, delta.length(), 8).toNonIndexed();
        wood.geometry(geo, 0x685743, new THREE.Matrix4().compose(p.add(end).multiplyScalar(0.5),
          new THREE.Quaternion().setFromUnitVectors(up, delta.normalize()), new THREE.Vector3(1, 1, 1))); geo.dispose();
      };
      const h = [6.4, 7.3, 5.8, 6.9][kind], spread = [2.25, 1.65, 2.45, 1.95][kind];
      branch([0, 0, 0], [0.09, h * 0.7, -0.07], 0.29, 0.085);
      for (let i = 0; i < 11; i++) {
        const angle = i * 2.39996 + kind, reach = spread * (0.48 + random() * 0.45);
        const y = h * (0.48 + random() * 0.27), x = Math.cos(angle) * reach, z = Math.sin(angle) * reach;
        branch([0.04, y - 0.85, 0], [x, y + 0.43, z], 0.105, 0.025);
        for (let j = 0; j < 3; j++) {
          const geo = new THREE.IcosahedronGeometry(1, 1), p = geo.attributes.position;
          // Uneven clusters and a porous silhouette instead of one smooth ball.
          for (let n = 0; n < p.count; n++) {
            const wobble = 0.92 + 0.14 * Math.sin(p.getX(n) * 17 + p.getY(n) * 9 + kind);
            p.setXYZ(n, p.getX(n) * wobble, p.getY(n) * wobble, p.getZ(n) * wobble);
          }
          geo.computeVertexNormals();
          const scale = 0.60 + random() * 0.28;
          leaves.geometry(geo, [0x416943, 0x587948, 0x365b40, 0x6c844e][(i + j + kind) % 4],
            new THREE.Matrix4().compose(new THREE.Vector3(x + (random() - 0.5) * 0.8,
              y + 0.50 + j * 0.34, z + (random() - 0.5) * 0.8),
              new THREE.Quaternion().setFromAxisAngle(up, random() * 6.28), new THREE.Vector3(scale * 1.2, scale, scale)));
          geo.dispose();
        }
      }
      treeCache.set(kind, { wood: wood.finish(), leaves: leaves.finish(), height: h });
    }
    const data = treeCache.get(kind), g = new THREE.Group();
    for (const [geo, name] of [[data.wood, 'TreeBranches'], [data.leaves, 'TreeFoliage']]) {
      const m = new THREE.Mesh(geo, materials.stone); m.name = name; m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    g.userData.trunk = { halfWidth: 0.34, height: data.height * 0.7 + 0.03 };
    return g;
  }
  function createPark(size, grassTexture) {
    const g = new THREE.Group(), ground = new Batch(), detail = new Batch(), water = new Batch(), solids = [];
    const half = size / 2;
    ground.box(size, 0.012, size, 0, 0.002, 0, 0x547245);
    if (grassTexture) {
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshLambertMaterial({ map: grassTexture }));
      grass.rotation.x = -Math.PI / 2; grass.position.y = 0.010;
      grass.name = 'ParkGrass'; grass.receiveShadow = true; g.add(grass);
    }
    // The existing cross routes remain level and open, with a paved fountain plaza.
    for (const [w, d] of [[size, 3.2], [3.2, size]]) ground.box(w, 0.012, d, 0, 0.012, 0, 0xb6ac95);
    const plaza = new THREE.CylinderGeometry(5.25, 5.25, 0.014, 48).toNonIndexed();
    ground.geometry(plaza, 0xc5bba8, new THREE.Matrix4().makeTranslation(0, 0.014, 0)); plaza.dispose();
    for (const sx of [-1, 1]) {
      ground.box(size, 0.012, 0.12, 0, 0.021, sx * 1.6, 0x827e70);
      ground.box(0.12, 0.012, size, sx * 1.6, 0.021, 0, 0x827e70);
    }
    for (let v = -half + 0.7; v < half; v += 1.3) {
      ground.box(3.15, 0.004, 0.025, 0, 0.022, v, 0xa29882);
      ground.box(0.025, 0.004, 3.15, v, 0.022, 0, 0xa29882);
    }
    const ring = new THREE.TorusGeometry(3.03, 0.20, 8, 48).toNonIndexed();
    detail.geometry(ring, 0x999d91, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.50, 0)); ring.dispose();
    const basin = new THREE.CylinderGeometry(3.0, 3.2, 0.38, 48).toNonIndexed();
    detail.geometry(basin, 0x828f88, new THREE.Matrix4().makeTranslation(0, 0.22, 0)); basin.dispose();
    const surface = new THREE.CircleGeometry(2.87, 48).toNonIndexed();
    water.geometry(surface, 0x64959a, new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0.423, 0)); surface.dispose();
    for (const r of [1.3, 2.1, 2.65]) {
      const ripple = new THREE.TorusGeometry(r, 0.009, 3, 48).toNonIndexed();
      water.geometry(ripple, 0xa2c5c4, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 0.431, 0)); ripple.dispose();
    }
    solids.push({ x0: -3.25, x1: 3.25, z0: -3.25, z1: 3.25, h: 0.71 });
    for (let i = 0; i < 12; i++) {
      const angle = (i + 0.5) * Math.PI / 6, radius = Math.min(half - 4.1, half * 0.8);
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (Math.abs(x) < 3.2 || Math.abs(z) < 3.2) continue;
      const tree = createTree(i % 4); tree.position.set(x, 0, z); tree.rotation.y = i * 1.7; g.add(tree);
      solids.push({ x0: x - 0.34, x1: x + 0.34, z0: z - 0.34, z1: z + 0.34, h: tree.userData.trunk.height });
      const bed = new THREE.CylinderGeometry(0.94, 0.94, 0.012, 20).toNonIndexed();
      ground.geometry(bed, 0x675b44, new THREE.Matrix4().makeTranslation(x, 0.018, z)); bed.dispose();
    }
    // Low planting sits away from paths; no decorative object blocks an entrance.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 14; i++) {
      const x = sx * (5.8 + (i % 7) * 0.55), z = sz * (half - 2.5 - Math.floor(i / 7) * 0.45);
      if (Math.abs(x) > half - 2) continue;
      const bush = new THREE.IcosahedronGeometry(0.27, 0);
      detail.geometry(bush, i % 3 ? 0x4c6650 : 0x988397,
        new THREE.Matrix4().makeScale(1.3, 0.68, 1).setPosition(x, 0.18, z)); bush.dispose();
    }
    g.add(ground.mesh(materials.stone, 'ParkGround'), detail.mesh(materials.stone, 'ParkPlantingAndBasin'),
      water.mesh(materials.trim, 'ParkWater'));
    g.userData.solids = solids; g.userData.pathHalfWidth = 1.6;
    return g;
  }

  function createHelicopterShell() {
    const g = new THREE.Group(), frame = new Batch(), glass = materials.windows.clone();
    glass.opacity = 0.3;
    const fuselage = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14),
      new THREE.MeshPhongMaterial({ color: 0x33485d, shininess: 45 }));
    fuselage.scale.set(1.03, 0.77, 1.85); fuselage.position.set(0, 0.2, -0.65);
    fuselage.castShadow = true; fuselage.name = 'StreamlinedFuselage'; g.add(fuselage);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass);
    canopy.scale.set(0.94, 0.8, 1.28); canopy.position.set(0, 0.25, 1.75); g.add(canopy);
    loft(frame, [[0.5, 0.8, -0.56, -0.27], [2.35, 0.71, -0.45, -0.18], [2.94, 0.21, -0.23, -0.13]], 0x33485d);
    frame.beam([0, -0.05, 2.95], [0, 0.99, 1.82], 0.055, 0.055, 0x243441);
    for (const sx of [-1, 1]) {
      frame.beam([sx * 0.9, -0.27, 1.3], [sx * 0.78, 0.89, 1.17], 0.06, 0.06, 0x243441);
      frame.box(0.035, 0.12, 1.6, sx * 0.994, 0.24, -0.46, 0xc5d4dc);
      frame.box(0.025, 0.035, 0.27, sx * 1.015, 0.1, -0.25, 0x92a7b4);
      // Door seam, hinge and ventilation grille follow the body envelope.
      frame.beam([sx * 0.95, -0.13, 0.28], [sx * 0.91, 0.63, 0.17], 0.022, 0.022, 0x20313e);
      for (let i = 0; i < 5; i++) frame.box(0.025, 0.018, 0.31,
        sx * 0.91, 0.44 + i * 0.04, -1.19, 0x1e2e38);
    }
    g.add(frame.mesh(materials.trim, 'CockpitFrame'));
    g.userData.visualKind = 'modern-helicopter'; return g;
  }

  let trainWheelGeometry;
  function trainDetails(count, length, gap, width, height, floor, color) {
    const metal = new Batch(), lamp = new Batch(), g = new THREE.Group();
    const positive = new Batch(), negative = new Batch();
    const wheelSpots = [];
    for (let w = 0; w < count; w++) {
      const x = (w - (count - 1) / 2) * (length + gap);
      // Ribbed roof housings stay within the existing roof height.
      for (const side of [-1, 1]) {
        metal.box(length - 0.3, 0.06, 0.09, x, floor + height - 0.23, side * (width / 2 + 0.015), 0xbecbd2);
        for (const px of [-2, 0, 2]) {
          metal.box(0.032, 1.82, 0.032, x + px, floor + 1.15, side * (width / 2 - 0.53), 0xd6b76b);
        }
      }
      for (const dx of [-length / 2 + 2.4, length / 2 - 2.4]) {
        for (const z of [-width / 2 + 0.2, width / 2 - 0.2]) {
          wheelSpots.push(new THREE.Vector3(x + dx, floor - 0.67, z));
        }
      }
      if (w === 0 || w === count - 1) {
        const sx = w === 0 ? -1 : 1, end = x + sx * (length / 2 + 0.075);
        metal.box(0.04, 0.12, width - 0.2, end, floor + 1.07, 0, color);
        for (const sz of [-1, 1]) (sx > 0 ? positive : negative).box(0.048, 0.065, 0.39,
          end, floor + 0.76, sz * 0.8, 0xffffff);
        metal.box(0.041, 0.19, 0.8, end, floor + 3.02, 0, 0x1c3039);
        lamp.box(0.047, 0.035, 0.53, end, floor + 3.02, 0, 0xf4d885);
      }
    }
    g.add(metal.mesh(materials.trim, 'TrainMetalwork'), lamp.mesh(materials.light, 'TrainLED'));
    const frontLights = new THREE.MeshBasicMaterial({ color: 0xe8f3f7 });
    const rearLights = new THREE.MeshBasicMaterial({ color: 0xd24632 });
    g.add(positive.mesh(frontLights, 'PositiveEndLights'), negative.mesh(rearLights, 'NegativeEndLights'));
    if (!trainWheelGeometry) trainWheelGeometry = wheel().clone().rotateY(Math.PI / 2).scale(0.37 / 0.35, 0.37 / 0.35, 0.37 / 0.35);
    const wheels = new THREE.InstancedMesh(trainWheelGeometry, materials.trim, wheelSpots.length);
    wheels.name = 'TrainWheels'; wheels.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    wheelSpots.forEach((p, i) => { matrix.makeTranslation(p.x, p.y, p.z); wheels.setMatrixAt(i, matrix); });
    g.add(wheels); g.userData.trainMotion = { wheels, wheelSpots, phase: 0, matrix, frontLights, rearLights };
    return g;
  }
  function updateTrain(g, speed, dt, direction) {
    const m = g.userData.trainMotion;
    if (!m || !Number.isFinite(speed) || !Number.isFinite(dt) || dt <= 0) return;
    const sign = Number.isFinite(direction) && direction !== 0 ? Math.sign(direction) : Math.sign(speed);
    if (sign) { m.frontLights.color.setHex(sign > 0 ? 0xe8f3f7 : 0xd24632);
      m.rearLights.color.setHex(sign > 0 ? 0xd24632 : 0xe8f3f7); }
    if (speed === 0) return;
    m.phase = (m.phase - speed * Math.min(dt, 0.1) / 0.37) % (Math.PI * 2);
    m.wheelSpots.forEach((p, i) => {
      m.matrix.makeRotationZ(m.phase); m.matrix.setPosition(p); m.wheels.setMatrixAt(i, m.matrix);
    });
    m.wheels.instanceMatrix.needsUpdate = true;
  }

  const OUTFITS = [
    { name: 'Alltag', top: 0x93adaf, pants: 0x667384, accessory: 'backpack' },
    { name: 'Pendler', top: 0xc2b3a0, pants: 0x676b78, accessory: 'satchel' },
    { name: 'Sport', top: 0xb18184, pants: 0x777c87, accessory: 'none' },
    { name: 'Freizeit', top: 0x7e9c87, pants: 0x8c8173, accessory: 'backpack' },
    { name: 'Stadt', top: 0xc3b897, pants: 0x767d8f, accessory: 'satchel' },
    { name: 'Abend', top: 0x939bbb, pants: 0x737784, accessory: 'none' },
  ];
  let civilianSerial = 0;
  const accessoryCache = new Map();
  const ENEMIES = {
    schlaeger: { color: 0x894b47, plate: 0x3d434b, width: 0.39 },
    brecher: { color: 0x947250, plate: 0x393d43, width: 0.5 },
    flink: { color: 0x718887, plate: 0x303d42, width: 0.34 },
    waechter: { color: 0x647e99, plate: 0x283747, width: 0.46 },
    werfer: { color: 0xb69454, plate: 0x504a39, width: 0.38 },
    duellant: { color: 0x70acb3, plate: 0x273b45, width: 0.32 },
    stuermer: { color: 0xe0a05b, plate: 0x593c32, width: 0.37 },
    enforcer: { color: 0xa95845, plate: 0x292f38, width: 0.52 },
  };
  function accessory(kind) {
    if (accessoryCache.has(kind)) return accessoryCache.get(kind);
    const b = new Batch();
    if (kind === 'backpack') {
      b.softBox(0.29, 0.36, 0.14, 0, 1.3, -0.2, 0x334b54);
      b.softBox(0.25, 0.14, 0.04, 0, 1.19, -0.285, 0x54717a);
      for (const sx of [-1, 1]) b.beam([sx * 0.11, 1.51, -0.15], [sx * 0.12, 1.12, 0.145], 0.037, 0.022, 0x35434b);
    } else if (kind === 'satchel') {
      b.softBox(0.17, 0.23, 0.23, 0.22, 0.94, -0.05, 0x795e47);
      b.beam([-0.13, 1.49, 0.14], [0.22, 0.99, 0.12], 0.035, 0.022, 0x574638);
    } else {
      const e = ENEMIES[kind];
      b.softBox(e.width, kind === 'flink' ? 0.19 : 0.33, 0.06, 0, 1.3, 0.145, e.plate);
      b.box(e.width * 0.74, 0.045, 0.071, 0, 1.36, 0.15, e.color);
      for (const sx of [-1, 1]) b.box(0.055, 0.4, 0.035, sx * e.width * 0.35, 1.29, 0.18, e.color);
      if (kind === 'brecher' || kind === 'enforcer') {
        for (const sx of [-1, 1]) b.softBox(0.15, 0.12, 0.24, sx * 0.26, 1.49, 0.01, e.plate);
      }
      if (kind === 'waechter') for (const y of [1.18, 1.26, 1.43]) b.box(0.4, 0.046, 0.035, 0, y, 0.19, e.color);
      if (kind === 'duellant') {
        b.beam([-0.17, 1.5, 0.19], [0.18, 1.13, 0.19], 0.07, 0.025, e.color);
        b.softBox(0.18, 0.19, 0.10, -0.22, 1.42, -0.01, e.plate);
      }
      if (kind === 'stuermer') {
        b.softBox(0.30, 0.29, 0.13, 0, 1.36, -0.21, e.plate);
        for (const x of [-0.09, 0.09]) b.box(0.035, 0.35, 0.02, x, 1.29, 0.20, e.color);
      }
      if (kind === 'werfer') {
        b.box(0.22, 0.22, 0.13, 0.17, 1.03, -0.17, e.color);
        for (const x of [-0.09, 0.09]) b.box(0.065, 0.27, 0.11, x, 1.3, -0.2, 0x8e927b);
      }
    }
    const geo = b.finish(); accessoryCache.set(kind, geo); return geo;
  }
  function attachAtBind(v, geometry, label) {
    const bone = v.knochen && (v.knochen.spine1 || v.knochen.spine || v.knochen.hips);
    if (!bone) return null;
    v.root.updateMatrixWorld(true);
    const mesh = new THREE.Mesh(geometry, materials.stone); mesh.name = label; mesh.castShadow = false;
    // Geometry is authored in character coordinates; transform once into the torso's bind space.
    const matrix = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(v.root.matrixWorld);
    matrix.decompose(mesh.position, mesh.quaternion, mesh.scale); bone.add(mesh); return mesh;
  }
  function dressCivilian(v, variant) {
    if (!v || !v.root || v.procedural || v.root.userData.cityOutfit) return;
    const kind = variant === undefined ? civilianSerial++ % OUTFITS.length : ((variant % OUTFITS.length) + OUTFITS.length) % OUTFITS.length;
    const outfit = OUTFITS[kind], copies = new Map();
    v.root.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const name = o.name || '';
      const original = Array.isArray(o.material) ? o.material : [o.material];
      const changed = original.map(mat => {
        // Never recolor a combined body/skin atlas, hair, eyes or a bare body mesh.
        const region = /^(Topmat)$/i.test(mat.name) || /cloth|shirt|tops/i.test(name) ? 'top'
          : /^(Bottommat)$/i.test(mat.name) || /pants|bottoms/i.test(name) ? 'pants' : null;
        if (!region || !mat.color) return mat;
        const key = mat.uuid + ':' + region;
        if (!copies.has(key)) { const copy = mat.clone(); copy.color.multiply(new THREE.Color(outfit[region])); copies.set(key, copy); }
        return copies.get(key);
      });
      o.material = Array.isArray(o.material) ? changed : changed[0];
    });
    if (outfit.accessory !== 'none') attachAtBind(v, accessory(outfit.accessory), 'CityAccessory');
    v.root.userData.cityOutfit = outfit.name;
  }
  function dressEnemy(v, role) {
    if (!v || !v.root || v.procedural) return;
    const key = ENEMIES[role] ? role : 'schlaeger';
    if (v.root.userData.cityRole === key) return;
    if (!v.cityGear) v.cityGear = attachAtBind(v, accessory(key), 'EnemyRoleGear');
    else v.cityGear.geometry = accessory(key); // shared immutable geometry; no nodes accumulate on role changes
    v.root.userData.cityRole = key;
  }
  return { enabled, createTower, createCar, updateCar, finishUtilityVehicle, createAmbulance, createBus, createTree, createPark, createHelicopterShell,
    trainDetails, updateTrain, dressCivilian, dressEnemy,
    towerStyles: TOWERS.map(t => t.name), carStyles: ['Fastback', 'Crossover', 'Sportkombi'],
    civilianStyles: OUTFITS.map(o => o.name), enemyStyles: Object.keys(ENEMIES) };
});
