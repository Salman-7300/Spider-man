'use strict';
// CPU model contact sheet. Uses the real game factories, not an AI illustration.
// Requires Node.js and Python 3 with Pillow; no WebGL or external JS packages.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { cityRuntime, THREE, root } = require('./city-test-runtime.cjs');
const runtime = cityRuntime();
const windows = process.argv.includes('--windows');
const life = process.argv.includes('--life');
const outputArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const out = path.resolve(outputArg || path.join(root, life ? 'docs/city-life-preview.png' : windows ? 'docs/window-interior-preview.png' : 'docs/city-model-preview.png'));
const panels = [];

function panel(model, label, rect, direction = [1, 0.6, 1.25], focus) {
  model.visible = true;
  model.updateMatrixWorld(true);
  const view = new THREE.Vector3(...direction).normalize();
  const right = new THREE.Vector3(view.z, 0, -view.x).normalize();
  const up = new THREE.Vector3().crossVectors(view, right);
  const light = new THREE.Vector3(-0.3, 0.9, 0.7).normalize();
  const triangles = [], points = [];
  model.traverseVisible(mesh => {
    if (!mesh.isMesh || mesh.userData.previewSkip) return;
    const geo = mesh.geometry, p = geo.attributes.position, colors = geo.attributes.color;
    if (!p) return;
    const count = geo.index ? geo.index.count : p.count;
    const matrices = [];
    if (mesh.isInstancedMesh) {
      for (let i = 0; i < mesh.count; i++) {
        const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m);
        matrices.push(m.premultiply(mesh.matrixWorld));
      }
    } else matrices.push(mesh.matrixWorld);
    for (const matrix of matrices) for (let i = 0; i < count; i += 3) {
      const group = geo.groups.find(g => i >= g.start && i < g.start + g.count);
      const mat = Array.isArray(mesh.material) ? mesh.material[group ? group.materialIndex : 0] : mesh.material;
      if (!mat || mat.visible === false || mat.opacity === 0) continue;
      const ids = [0, 1, 2].map(j => geo.index ? geo.index.getX(i + j) : i + j);
      const v = ids.map(id => new THREE.Vector3().fromBufferAttribute(p, id).applyMatrix4(matrix));
      const n = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
      if (mat.side === THREE.FrontSide && n.dot(view) < 0) continue;
      const rgb = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
      if (mat.vertexColors && colors) rgb.multiply(new THREE.Color().fromArray(colors.array, ids[0] * 3));
      const brightness = mat.isMeshBasicMaterial ? 1 : 0.58 + 0.42 * Math.max(0, n.dot(light));
      const xy = v.map(a => [a.dot(right), -a.dot(up)]); points.push(...xy);
      triangles.push({ xy, z: v.map(a => a.dot(view)), depth: v.reduce((sum, a) => sum + a.dot(view), 0) / 3,
        color: [rgb.r, rgb.g, rgb.b].map(c => Math.round(Math.min(1, c * brightness) * 255)),
        alpha: mat.transparent ? mat.opacity : 1 });
    }
  });
  const center = focus && new THREE.Vector3(...focus.center);
  const minX = focus ? center.dot(right) - focus.width / 2 : points.reduce((v, p) => Math.min(v, p[0]), Infinity);
  const maxX = focus ? center.dot(right) + focus.width / 2 : points.reduce((v, p) => Math.max(v, p[0]), -Infinity);
  const minY = focus ? -center.dot(up) - focus.height / 2 : points.reduce((v, p) => Math.min(v, p[1]), Infinity);
  const maxY = focus ? -center.dot(up) + focus.height / 2 : points.reduce((v, p) => Math.max(v, p[1]), -Infinity);
  const [x, y, w, h] = rect, scale = Math.min((w - 46) / (maxX - minX), (h - 64) / (maxY - minY));
  const cx = x + w / 2, cy = y + (h - 32) / 2;
  for (const t of triangles) t.xy = t.xy.map(p => [cx + (p[0] - (minX + maxX) / 2) * scale,
    cy + (p[1] - (minY + maxY) / 2) * scale]);
  triangles.sort((a, b) => a.depth - b.depth);
  panels.push({ label, rect, triangles });
}

if (life) {
  panel(runtime.look.createAmbulance(), 'Rettungswagen · Kabine und Aufbau', [24, 118, 768, 360], [1, 0.45, 1.2]);
  panel(runtime.look.createAmbulance(), 'Rettungswagen · Hecktüren und Leuchten', [816, 118, 768, 360], [-1, 0.45, -1.2]);
  const bus = runtime.look.createBus({ art: 'bus', laenge: 9.5, breite: 2.4 }, 0x3b7a3f);
  panel(bus, 'Stadtbus · offene Fenster und flacher Boden', [24, 494, 768, 355], [1, 0.5, 1.1]);
  bus.getObjectByName('BusShell').userData.previewSkip = true;
  bus.getObjectByName('BusGlass').userData.previewSkip = true;
  panel(bus, 'Innenraum · Schnittansicht ohne Außenhaut', [816, 494, 768, 355], [0.9, 0.85, 1.1]);
  panel(runtime.look.createPark(38), 'Park · Wege, Pflanzflächen und Brunnenplatz', [24, 865, 1050, 470], [1, 1.1, 1.2]);
  panel(runtime.look.createTree(0), 'Baum · Stamm, Äste und Laubgruppen', [1090, 865, 494, 470], [1, 0.3, 1.2]);
} else if (windows) {
  for (let i = 0; i < 4; i++) panel(runtime.look.createTower(18, 90, 22, i),
    runtime.look.towerStyles[i] + ' · Glas vor einem echten Innenraum',
    [24 + (i % 2) * 792, 118 + Math.floor(i / 2) * 476, 768, 460], [0.16, 0.12, 1],
    { center: [-3.5, 7.1, 10.5], width: 10.2, height: 6 });
} else {
for (let i = 0; i < 4; i++) panel(runtime.look.createTower(18, 90, 22, i),
  runtime.look.towerStyles[i], [24 + i * 392, 118, 376, 460]);
for (let i = 0; i < 3; i++) panel(runtime.makeCarMesh([0x426e85, 0xaaa69f, 0x873f48][i]),
  runtime.look.carStyles[i], [24 + i * 525, 594, 508, 260]);
panel(runtime.makeFahrzeugMesh({ art: 'lkw', laenge: 8, breite: 2.3 }, 0x416f87),
  'Lkw · Fahrerhaus und Ladeaufbau', [24, 870, 508, 270]);
panel(runtime.makeFahrzeugMesh({ art: 'bus', laenge: 9.5, breite: 2.4 }, 0x387a86),
  'Stadtbus · bestehender Innenraum', [549, 870, 508, 270]);
const heli = runtime.makeHeliMesh();
for (const mesh of [heli.strahl, heli.fleck]) if (mesh) mesh.userData.previewSkip = true;
panel(heli.mesh, 'Helikopter · Rumpf und Cockpit', [1074, 870, 508, 270], [1, 0.7, 1.35]);
const train = runtime.baueZug(0x376f95);
train.userData.tuerL.position.x = -1.19; train.userData.tuerR.position.x = 1.19;
panel(train, 'U-Bahn · drei Wagen, geöffnete Türen', [24, 1156, 1558, 295], [0.43, 0.45, 1.4]);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
const python = String.raw`
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
data=json.load(sys.stdin); S=2
im=Image.new('RGB',(1608*S,data['height']*S),(16,25,35)); d=ImageDraw.Draw(im)
def font(size,bold=False):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',size*S)
def text(x,y,s,size,color=(223,233,240),bold=False): d.text((x*S,y*S),s,font=font(size,bold),fill=color)
text(24,20,data['title'],30,bold=True)
text(24,67,'Echte Spielgeometrie · CPU-Modellansicht mit vereinfachtem Licht · kein Gameplay-Screenshot',17,(149,170,185))
for p in data['panels']:
    x,y,w,h=p['rect']; bg=(28,41,53)
    d.rounded_rectangle((x*S,y*S,(x+w)*S,(y+h)*S),radius=12*S,fill=bg,outline=(48,64,77),width=S)
    pixels=np.asarray(im.crop((x*S,y*S,(x+w)*S,(y+h)*S))).astype(np.float32).copy()
    depth=np.full((h*S,w*S),-np.inf,dtype=np.float32)
    # Z-buffer preserves small facade details in front of large wall triangles.
    for transparent in [False,True]:
      for t in p['triangles']:
        if (t['alpha']<1)!=transparent: continue
        pts=np.array(t['xy'])*S-np.array([x*S,y*S]); z=np.array(t['z'])
        lo=np.maximum(np.floor(pts.min(axis=0)).astype(int),[0,0])
        hi=np.minimum(np.ceil(pts.max(axis=0)).astype(int)+1,[w*S,h*S])
        if np.any(hi<=lo): continue
        x0,y0=pts[0]; x1,y1=pts[1]; x2,y2=pts[2]
        denom=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(denom)<1e-8: continue
        yy,xx=np.mgrid[lo[1]:hi[1],lo[0]:hi[0]]; xx=xx+.5; yy=yy+.5
        a=((y1-y2)*(xx-x2)+(x2-x1)*(yy-y2))/denom
        b=((y2-y0)*(xx-x2)+(x0-x2)*(yy-y2))/denom; c=1-a-b
        zz=a*z[0]+b*z[1]+c*z[2]
        ds=depth[lo[1]:hi[1],lo[0]:hi[0]]; ps=pixels[lo[1]:hi[1],lo[0]:hi[0]]
        mask=(a>=0)&(b>=0)&(c>=0)&(zz>=ds-1e-6)
        if transparent: ps[mask]=np.array(t['color'])*t['alpha']+ps[mask]*(1-t['alpha'])
        else: ps[mask]=t['color']; ds[mask]=zz[mask]
    im.paste(Image.fromarray(np.clip(pixels,0,255).astype(np.uint8)),(x*S,y*S)); d=ImageDraw.Draw(im)
    text(x+18,y+h-34,p['label'],17)
text(24,data['height']-37,'Modelle aus city-visuals.js und game.js · Maßstab je Kachel angepasst',16,(149,170,185))
im.resize((1608,data['height']),Image.Resampling.LANCZOS).save(data['out'])
`;
const result = spawnSync('python3', ['-c', python], { input: JSON.stringify({ panels, out,
  height: life ? 1395 : windows ? 1110 : 1512, title: life ? 'WEB HERO  /  RETTUNG, BUS & PARK' : windows ? 'WEB HERO  /  FENSTER & INNENRÄUME' : 'WEB HERO  /  STADT & FAHRZEUGE' }),
  encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
if (result.status !== 0) throw new Error(result.stderr || 'CPU preview failed');
console.log(out);
