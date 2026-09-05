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
    glass: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 65, specular: 0x829ea9 }),
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
    panel(w, h, x, y, z, color, ry = 0) {
      const q = new THREE.Quaternion().setFromAxisAngle(up, ry);
      this.geometry(plane, color, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, 1)));
    }
    quad(a, b, c, d, color) {
      const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a))
        .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a))).normalize();
      const col = new THREE.Color(color);
      for (const v of [a, b, c, a, c, d]) {
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
    { name: 'Kupferrippen', wall: 0x263d43, trim: 0xb28561, glass: [0x365e65, 0x45717a, 0x254c57, 0x62858a] },
    { name: 'Silberband', wall: 0x526069, trim: 0xc8cdd0, glass: [0x46687f, 0x627f91, 0x365b73, 0x8199a4] },
  ];
  function createTower(w, h, d, variant = 0) {
    if (![w, h, d].every(Number.isFinite) || Math.min(w, h, d) <= 0) throw new Error('Invalid tower dimensions');
    const kind = ((variant % TOWERS.length) + TOWERS.length) % TOWERS.length, style = TOWERS[kind];
    const solid = new Batch(), glazing = new Batch(), group = new THREE.Group();
    const lobby = Math.min(4.2, h * 0.18), floors = Math.max(1, Math.floor((h - lobby) / 3.15));
    const rise = (h - lobby - 0.36) / floors;
    solid.box(w - 0.08, h - 0.12, d - 0.08, 0, (h - 0.12) / 2, 0, style.wall);
    solid.box(w, 0.12, d, 0, h - 0.06, 0, 0x849095); // exact walkable roof; no invisible crown
    for (let face = 0; face < 4; face++) {
      const width = face % 2 ? d : w, depth = face % 2 ? w : d, ry = face * Math.PI / 2;
      const local = (x, z) => [Math.cos(ry) * x + Math.sin(ry) * z, -Math.sin(ry) * x + Math.cos(ry) * z];
      const bar = (bw, bh, bd, x, y, inset, color) => {
        const [px, pz] = local(x, depth / 2 - inset); solid.box(bw, bh, bd, px, y, pz, color, ry);
      };
      const window = (bw, bh, x, y, color, inset = 0.015) => {
        const [px, pz] = local(x, depth / 2 - inset); glazing.panel(bw, bh, px, y, pz, color, ry);
      };
      const cols = Math.max(2, Math.floor((width - 0.5) / (kind === 1 ? 2.9 : 2.5)));
      const step = (width - 0.5) / cols;
      for (let col = 0; col < cols; col++) {
        const x = -width / 2 + 0.25 + (col + 0.5) * step;
        window(step - 0.15, lobby - 0.55, x, lobby / 2, style.glass[(col + face) % 4]);
        for (let floor = 0; floor < floors; floor++) {
          const y = lobby + (floor + 0.5) * rise;
          window(step - (kind === 1 ? 0.52 : 0.11), rise - (kind === 3 ? 0.62 : 0.23), x, y,
            style.glass[(floor * 11 + col * 7 + face * 3) % 4]);
        }
      }
      // Columns and floor bands have depth, but stay inside the existing collision box.
      for (let col = 0; col <= cols; col++) {
        const x = -width / 2 + 0.25 + col * step;
        bar(kind === 1 ? 0.3 : kind === 2 ? 0.16 : 0.08, h - 0.22, 0.1, x, (h - 0.22) / 2, 0.05, style.trim);
      }
      for (let floor = 0; floor <= floors; floor++) {
        const y = lobby + floor * rise;
        bar(width - 0.2, kind === 3 ? 0.31 : floor % 5 === 0 ? 0.23 : 0.09, 0.1, 0, y, 0.05, style.trim);
      }
      bar(width, 0.16, 0.12, 0, h - 0.25, 0.06, style.trim);
      bar(width, 0.18, 0.12, 0, 0.09, 0.06, style.trim);
      // A narrow recessed double door makes the ground floor readable at street level.
      if (face === 0) {
        window(Math.min(2.25, width * 0.24), lobby - 0.65, 0, (lobby - 0.65) / 2, 0x20343e, 0.008);
        bar(0.07, lobby - 0.65, 0.1, 0, (lobby - 0.65) / 2, 0.05, style.trim);
      }
    }
    group.add(solid.mesh(materials.stone, 'Structure'), glazing.mesh(materials.glass, 'Glazing'));
    group.name = 'WEB_HERO_Hochhaus_' + style.name;
    group.userData = { visualKind: 'tower', variant: kind, floors: floors + 1, roofHeight: h,
      footprint: { width: w, depth: d }, source: 'native-geometry' };
    return group;
  }

  function loft(batch, sections, color) {
    for (let i = 0; i < sections.length - 1; i++) {
      const [az, aw, al, ah] = sections[i], [bz, bw, bl, bh] = sections[i + 1];
      batch.quad([aw, al, az], [aw, ah, az], [bw, bh, bz], [bw, bl, bz], color);
      batch.quad([-aw, al, az], [-bw, bl, bz], [-bw, bh, bz], [-aw, ah, az], color);
      batch.quad([-aw, ah, az], [-bw, bh, bz], [bw, bh, bz], [aw, ah, az], color);
      batch.quad([-aw, al, az], [aw, al, az], [bw, bl, bz], [-bw, bl, bz], color);
    }
    const [az, aw, al, ah] = sections[0], [bz, bw, bl, bh] = sections[sections.length - 1];
    batch.quad([-aw, al, az], [-aw, ah, az], [aw, ah, az], [aw, al, az], color);
    batch.quad([-bw, bl, bz], [bw, bl, bz], [bw, bh, bz], [-bw, bh, bz], color);
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
      retiredWheelGeometry.add(axle.roll.geometry);
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
    }
    g.add(frame.mesh(materials.trim, 'CockpitFrame'));
    g.userData.visualKind = 'modern-helicopter'; return g;
  }

  let trainWheelGeometry;
  function trainDetails(count, length, gap, width, height, floor, color) {
    const metal = new Batch(), lamp = new Batch(), g = new THREE.Group();
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
        for (const sz of [-1, 1]) lamp.box(0.048, 0.065, 0.39, end, floor + 0.76, sz * 0.8, 0xe8f3f7);
        metal.box(0.041, 0.19, 0.8, end, floor + 3.02, 0, 0x1c3039);
        lamp.box(0.047, 0.035, 0.53, end, floor + 3.02, 0, 0xf4d885);
      }
    }
    g.add(metal.mesh(materials.trim, 'TrainMetalwork'), lamp.mesh(materials.light, 'TrainLED'));
    if (!trainWheelGeometry) trainWheelGeometry = wheel().clone().rotateY(Math.PI / 2).scale(0.37 / 0.35, 0.37 / 0.35, 0.37 / 0.35);
    const wheels = new THREE.InstancedMesh(trainWheelGeometry, materials.trim, wheelSpots.length);
    wheels.name = 'TrainWheels'; wheels.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    wheelSpots.forEach((p, i) => { matrix.makeTranslation(p.x, p.y, p.z); wheels.setMatrixAt(i, matrix); });
    g.add(wheels); g.userData.trainMotion = { wheels, wheelSpots, phase: 0, matrix };
    return g;
  }
  function updateTrain(g, speed, dt) {
    const m = g.userData.trainMotion;
    if (!m || !Number.isFinite(speed) || !Number.isFinite(dt) || dt <= 0 || speed === 0) return;
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
    enforcer: { color: 0xa95845, plate: 0x292f38, width: 0.52 },
  };
  function accessory(kind) {
    if (accessoryCache.has(kind)) return accessoryCache.get(kind);
    const b = new Batch();
    if (kind === 'backpack') {
      b.box(0.29, 0.36, 0.14, 0, 1.3, -0.2, 0x334b54);
      b.box(0.25, 0.14, 0.04, 0, 1.19, -0.285, 0x54717a);
      for (const sx of [-1, 1]) b.beam([sx * 0.11, 1.51, -0.15], [sx * 0.12, 1.12, 0.145], 0.037, 0.022, 0x35434b);
    } else if (kind === 'satchel') {
      b.box(0.17, 0.23, 0.23, 0.22, 0.94, -0.05, 0x795e47);
      b.beam([-0.13, 1.49, 0.14], [0.22, 0.99, 0.12], 0.035, 0.022, 0x574638);
    } else {
      const e = ENEMIES[kind];
      b.box(e.width, kind === 'flink' ? 0.19 : 0.33, 0.06, 0, 1.3, 0.145, e.plate);
      b.box(e.width * 0.74, 0.045, 0.071, 0, 1.36, 0.15, e.color);
      for (const sx of [-1, 1]) b.box(0.055, 0.4, 0.035, sx * e.width * 0.35, 1.29, 0.18, e.color);
      if (kind === 'brecher' || kind === 'enforcer') {
        for (const sx of [-1, 1]) b.box(0.15, 0.12, 0.24, sx * 0.26, 1.49, 0.01, e.plate);
      }
      if (kind === 'waechter') for (const y of [1.18, 1.26, 1.43]) b.box(0.4, 0.046, 0.035, 0, y, 0.19, e.color);
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
  return { enabled, createTower, createCar, updateCar, finishUtilityVehicle, createHelicopterShell,
    trainDetails, updateTrain, dressCivilian, dressEnemy,
    towerStyles: TOWERS.map(t => t.name), carStyles: ['Fastback', 'Crossover', 'Sportkombi'],
    civilianStyles: OUTFITS.map(o => o.name), enemyStyles: Object.keys(ENEMIES) };
});
