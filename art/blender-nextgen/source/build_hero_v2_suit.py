# Web Hero Next-Gen v2 - Anzug, Linsen, Materialien (laeuft nach build_hero_v2.py in derselben Blender-Sitzung).
# Gemalt pro Texel aus der Lage auf dem Koerper (Bind-Pose, Blender-Koordinaten: x = Figur-links,
# -y = vorn, z = oben) und den interpolierten Gewichtszonen. Netzmuster/Spinnenmotive gibt es nicht.
import bpy, bmesh, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

body = bpy.data.objects["WebHero2_Body"]
rig = bpy.data.objects["WebHero2_Rig"]
me = body.data
RES, FINAL = 2048, 1024

# ---------------------------------------------------------------- Zonen je Ecke
ZN = ["HEAD", "NECK", "TORSO", "UPARM", "FOREARM", "HAND", "THIGH", "SHIN", "FOOT"]
def zone_of(n):
    n = n.replace("mixamorig:", "")
    if n.startswith("Head") or "Eye" in n: return 0
    if n == "Neck": return 1
    if n.startswith(("Spine", "Hips")) or "Shoulder" in n: return 2
    if n.endswith("ForeArm"): return 4
    if n.endswith("Arm"): return 3
    if "Hand" in n: return 5
    if n.endswith("UpLeg"): return 6
    if n.endswith("Leg"): return 7
    return 8
gz = [zone_of(g.name) for g in body.vertex_groups]
nv = len(me.vertices)
P = np.array([v.co[:] for v in me.vertices], np.float32)
Nn = np.array([v.normal[:] for v in me.vertices], np.float32)
Z = np.zeros((nv, len(ZN)), np.float32)
for v in me.vertices:
    for g in v.groups:
        Z[v.index, gz[g.group]] += g.weight

# ---------------------------------------------------------------- Rasterisieren
me.calc_loop_triangles()
uvl = me.uv_layers.active.data
Pb = np.zeros((RES, RES, 3), np.float32); Nb = np.zeros((RES, RES, 3), np.float32)
Zb = np.zeros((RES, RES, len(ZN)), np.float32); valid = np.zeros((RES, RES), bool)
for t in me.loop_triangles:
    vi = list(t.vertices)
    uv = np.array([uvl[li].uv[:] for li in t.loops], np.float32) * RES
    x0, y0 = np.floor(uv.min(0)).astype(int); x1, y1 = np.ceil(uv.max(0)).astype(int)
    x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, RES - 1), min(y1, RES - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    (ax, ay), (bx, by), (cx, cy) = uv
    d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(d) < 1e-9: continue
    l0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d
    l1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d
    l2 = 1 - l0 - l1
    m = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
    if not m.any(): continue
    L = np.stack([l0[m], l1[m], l2[m]], 1)
    yy = ys[m].astype(int); xx = xs[m].astype(int)
    Pb[yy, xx] = L @ P[vi]; Nb[yy, xx] = L @ Nn[vi]; Zb[yy, xx] = L @ Z[vi]; valid[yy, xx] = True
Nb /= np.maximum(np.linalg.norm(Nb, axis=2, keepdims=True), 1e-6)
X, Y, H = Pb[..., 0], Pb[..., 1], Pb[..., 2]
NX, NF, NH = Nb[..., 0], -Nb[..., 1], Nb[..., 2]          # NF > 0: zeigt nach vorn
AX = np.abs(X)
zone = Zb.argmax(2)
head, neck, torso = zone == 0, zone == 1, zone == 2
uparm, forearm, hand = zone == 3, zone == 4, zone == 5
thigh, shin, foot = zone == 6, zone == 7, zone == 8

def c(*rgb): return np.array(rgb, np.float32) / 255
NAVY, NAVY2, ANTH = c(27, 33, 48), c(40, 47, 64), c(44, 47, 54)
RED, RED_D = c(128, 26, 31), c(88, 17, 22)
SILV, EMB, SOLE = c(152, 156, 162), c(190, 184, 172), c(22, 22, 25)
img = np.zeros((RES, RES, 3), np.float32); img[:] = NAVY
rough = np.full((RES, RES), 0.7, np.float32)
hgt = np.zeros((RES, RES), np.float32)
def paint(mask, col, r=None):
    img[mask] = col
    if r is not None: rough[mask] = r
def line(dist, w): return np.clip(1 - np.abs(dist) / w, 0, 1)
def seam(mask, dist, w=0.0032, depth=0.8, darken=0.55):
    m = mask & (np.abs(dist) < w)
    img[m] *= darken; hgt[...] -= depth * line(dist, w * 1.2) * mask
def pipe(mask, dist, w=0.004):
    m = mask & (np.abs(dist) < w)
    img[m] = img[m] * 0.25 + SILV * 0.75; rough[m] = 0.4; hgt[...] -= 0.5 * line(dist, w) * mask
def seg(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = np.clip(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(px - (ax + t * vx), py - (ay + t * vy))

# Rumpf: anthrazite Seitenpaneele, rote Schulterpasse mit V, Guertel
paint(torso & (AX > 0.105), ANTH)
seam(torso, AX - 0.105)
yoke = 1.405 + 0.62 * AX
paint((torso | neck) & (H > yoke), RED, 0.58)
paint(uparm & (H > 1.47) & (AX < 0.27), RED, 0.58)            # Passe ueber die Schulterkappe
pipe(torso, H - yoke)
paint(torso & (H > 1.075) & (H < 1.108), RED_D, 0.55)
for e in (1.075, 1.108): pipe(torso, H - e, 0.0032)
# Brustmittelnaht und Bauch-Panelnaehte (dezent)
seam(torso & (NF > 0.3) & (H < yoke) & (H > 1.11), X, 0.0025, 0.6, 0.75)
seam(torso & (NF > 0.3) & (H < 1.30) & (H > 1.11), H - 1.21, 0.0025, 0.5, 0.8)

# Emblem: doppelter Pfeilwinkel + Raute ("Schwung-Anker"), vorn klein, hinten groesser
def emblem(front, cz, s):
    face = torso & ((NF > 0.25) if front else (NF < -0.25))
    d = np.minimum.reduce([seg(X, H, -0.10 * s, cz + 0.048 * s, 0, cz - 0.03 * s),
                           seg(X, H, 0.10 * s, cz + 0.048 * s, 0, cz - 0.03 * s),
                           seg(X, H, -0.058 * s, cz + 0.004 * s, 0, cz - 0.072 * s),
                           seg(X, H, 0.058 * s, cz + 0.004 * s, 0, cz - 0.072 * s)])
    dia = (np.abs(X) + np.abs(H - (cz + 0.068 * s))) < 0.019 * s
    m = face & ((d < 0.0105 * s) | dia)
    img[m] = EMB; rough[m] = 0.42; hgt[...] += 0.6 * m
    edge = face & (np.abs(d - 0.0105 * s) < 0.0028)
    img[edge] = img[edge] * 0.4 + RED_D * 0.6
emblem(True, 1.345, 0.95)
emblem(False, 1.33, 1.2)

# Arme: Navy, rote Oberbahn (zeigt in der T-Pose nach oben), Paspel
arm = uparm | forearm
paint(arm & (NH > 0.55), RED, 0.58)
pipe(arm, NH - 0.55, 0.03)
# Handschuhe rot, Manschette navy mit Paspel, Knoechelpolster dunkel
hw = Zb[..., 5]
paint(hand | (forearm & (hw > 0.25)), RED, 0.6)
cuff = (hand | forearm) & (hw > 0.22) & (hw < 0.62)
paint(cuff, NAVY2, 0.55)
pipe(hand | forearm, hw - 0.62, 0.05)
paint(hand & (NH > 0.6) & (Zb[..., 5] > 0.9), RED_D, 0.62)
# Beine: Aussenstreifen, Knieverstaerkung, Stiefel
legout = np.sign(X) * NX
paint((thigh | shin) & (legout > 0.82), RED_D, 0.6)
knee_d = np.hypot(np.maximum(0, np.abs(H - 0.515) - 0.02), (NF - 1) * 0.08)
paint((thigh | shin) & (NF > 0.55) & (np.abs(H - 0.515) < 0.045), ANTH, 0.6)
seam((thigh | shin) & (NF > 0.5), np.abs(H - 0.515) - 0.045, 0.0025, 0.6, 0.7)
boot_top = 0.33
paint((shin | foot) & (H < boot_top), RED, 0.6)
pipe(shin | foot, H - boot_top, 0.0045)
paint(foot & (H < 0.075) & (NF > 0.35), RED_D, 0.5)
paint(foot & ((NH < -0.55) | (H < 0.022)), SOLE, 0.85)
seam(foot, H - 0.022, 0.003, 0.9, 0.5)
# Maske: Rot, dunkle Kinn-/Wangenpartie, Mittel-, Brauen- und Wangennaht, Hals rot mit Kragenring
hd = head | (neck & (H > 1.57))
paint(hd | neck, RED, 0.55)
chin = hd & (NF > 0.1) & (H < 1.628 + 0.42 * AX)
paint(chin, NAVY2, 0.6)
seam(hd, X, 0.0024, 0.8, 0.5)
seam(hd & (NF > 0.0), H - (1.628 + 0.42 * AX), 0.0026, 0.8, 0.5)
seam(hd & (NF > 0.35) & (AX < 0.085), H - (1.722 - 0.35 * AX), 0.0024, 0.7, 0.55)
pipe(neck | torso, H - 1.515, 0.0035)

# Stoff: feiner Koeper + grossflaechige Tonvariation
tw = 0.5 + 0.5 * np.sin(2 * np.pi * (X * 0.7 + H + Y * 0.7) / 0.0055)
var = 0.5 + 0.5 * np.sin(X * 37 + H * 23) * np.sin(Y * 31 - H * 17)
img[valid] *= ((1 - 0.025 * tw) * (0.97 + 0.06 * var))[valid][:, None]
hgt += 0.035 * tw * valid

def dilate(a, mask, n=10):
    a = a.copy(); m = mask.copy()
    for _ in range(n):
        acc = np.zeros_like(a); cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(a, dy, 0), dx, 1); shm = np.roll(np.roll(m, dy, 0), dx, 1)
            acc[shm] += sh[shm]; cnt[shm] += 1
        grow = (~m) & (cnt > 0)
        a[grow] = (acc[grow] / cnt[grow][..., None]) if a.ndim == 3 else acc[grow] / cnt[grow]
        m |= grow
    return a
img = dilate(img, valid); rough = dilate(rough, valid); hgt = dilate(hgt, valid)

def down(a):        # 2048 -> 1024 Mittelwert (Kantenglaettung)
    return a.reshape(FINAL, 2, FINAL, 2, *a.shape[2:]).mean((1, 3))
base = down(img); rgh = down(rough); hh = down(hgt)
gx = np.roll(hh, -1, 1) - np.roll(hh, 1, 1); gy = np.roll(hh, -1, 0) - np.roll(hh, 1, 0)
nrm = np.stack([-gx * 2.2, -gy * 2.2, np.ones_like(hh)], -1)
nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True); nrm = nrm * 0.5 + 0.5

def to_image(name, arr, noncolor=False):
    im = bpy.data.images.get(name)
    if im: bpy.data.images.remove(im)
    im = bpy.data.images.new(name, FINAL, FINAL, alpha=False)
    if noncolor: im.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((FINAL, FINAL, 4), np.float32); rgba[..., :3] = arr
    im.pixels.foreach_set(rgba.ravel())          # Blender-Bildzeile 0 = unten = UV v 0 (wie gemalt)
    im.file_format = 'PNG'; im.pack()
    return im
IM_BASE = to_image("WH2_suit_basecolor", base)        # Byte-Bild: .pixels erwartet sRGB-Werte
IM_ORM = to_image("WH2_suit_orm", np.stack([np.ones_like(rgh), rgh, np.zeros_like(rgh)], -1), True)
IM_NRM = to_image("WH2_suit_normal", nrm, True)

# ---------------------------------------------------------------- Materialien
def material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in [n for n in nt.nodes if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL')]: nt.nodes.remove(n)
    return m, nt, nt.nodes.get("Principled BSDF")
M_SUIT, nt, b = material("WH2_Suit")
tb = nt.nodes.new("ShaderNodeTexImage"); tb.image = IM_BASE
nt.links.new(tb.outputs["Color"], b.inputs["Base Color"])
to = nt.nodes.new("ShaderNodeTexImage"); to.image = IM_ORM
sep = nt.nodes.new("ShaderNodeSeparateColor"); nt.links.new(to.outputs["Color"], sep.inputs["Color"])
nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
b.inputs["Metallic"].default_value = 0.0
tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = IM_NRM
nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
M_LENS, nt2, b2 = material("WH2_Lens")
b2.inputs["Base Color"].default_value = (0.80, 0.84, 0.88, 1); b2.inputs["Roughness"].default_value = 0.14
b2.inputs["Metallic"].default_value = 0.0; b2.inputs["Coat Weight"].default_value = 0.6
b2.inputs["Emission Color"].default_value = (0.75, 0.82, 0.9, 1); b2.inputs["Emission Strength"].default_value = 0.08
M_FRAME, nt3, b3 = material("WH2_LensFrame")
b3.inputs["Base Color"].default_value = (0.035, 0.037, 0.045, 1); b3.inputs["Roughness"].default_value = 0.38
me.materials.clear()
for m in (M_SUIT, M_LENS, M_FRAME):
    me.materials.append(m)
for p in me.polygons: p.material_index = 0

# ---------------------------------------------------------------- Linsen (eigene Form) am Kopfknochen
bmB = bmesh.new(); bmB.from_mesh(me); bvh = BVHTree.FromBMesh(bmB); bmB.free()
# Eigene Linsenform: innen schmal und tief, aussen hoch und schraeg nach oben gezogen, kantig
LENS = [(0.012, 1.664), (0.020, 1.684), (0.040, 1.700), (0.064, 1.712), (0.080, 1.712), (0.084, 1.700),
        (0.074, 1.682), (0.052, 1.668), (0.030, 1.660)]
def inside(px, pz, poly):
    c = False; n = len(poly)
    for i in range(n):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % n]
        if (z1 > pz) != (z2 > pz) and px < (x2 - x1) * (pz - z1) / (z2 - z1 + 1e-12) + x1: c = not c
    return c
def hit(x, z, lift):
    """Radial vom Kopfinneren nach aussen projizieren: auch an der Kopfseite sauber (keine Streifschuesse)."""
    c = Vector((0.0, 0.03, z))
    d = (Vector((x * 1.15, -0.09, z)) - c).normalized()
    loc, nor, idx, dd = bvh.ray_cast(c + d * 0.3, -d, 0.3)
    if loc is None:
        loc, nor, idx, dd = bvh.find_nearest(c + d * 0.08)
    return loc + nor * lift
def grow(poly, d):
    cx = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
    return [(cx + (x - cx) * (1 + d / max(1e-6, math.hypot(x - cx, z - cz))), cz + (z - cz) * (1 + d / max(1e-6, math.hypot(x - cx, z - cz)))) for x, z in poly]
head_g = body.vertex_groups["mixamorig:Head"]
add = bmesh.new(); add.from_mesh(me)
dl = add.verts.layers.deform.verify()
HEADI = head_g.index
def add_quad_grid(poly, lift, mi, nx=16, nz=10):
    xs = [min(p[0] for p in poly), max(p[0] for p in poly)]; zs = [min(p[1] for p in poly), max(p[1] for p in poly)]
    G = {}
    for i in range(nx + 1):
        for k in range(nz + 1):
            x = xs[0] + (xs[1] - xs[0]) * i / nx; z = zs[0] + (zs[1] - zs[0]) * k / nz
            if inside(x, z, poly):
                p = hit(x, z, lift)
                if p is not None:
                    v = add.verts.new(p); v[dl][HEADI] = 1.0; G[(i, k)] = v
    for i in range(nx):
        for k in range(nz):
            q = [G.get((i, k)), G.get((i + 1, k)), G.get((i + 1, k + 1)), G.get((i, k + 1))]
            if None in q: continue
            f = add.faces.new(q); f.material_index = mi
def add_fan(poly, lift, mi, rings=5):
    """Linse aus konzentrischen Ringen, jeder auf den Kopf projiziert -> folgt der Kruemmung."""
    cx = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
    R_ = []
    for r in range(rings):
        t = 1 - r / rings
        row = []
        for x, z in poly:
            v = add.verts.new(hit(cx + (x - cx) * t, cz + (z - cz) * t, lift)); v[dl][HEADI] = 1.0; row.append(v)
        R_.append(row)
    vc = add.verts.new(hit(cx, cz, lift)); vc[dl][HEADI] = 1.0
    n = len(poly)
    for r in range(rings - 1):
        a_, b_ = R_[r], R_[r + 1]
        for i in range(n):
            j = (i + 1) % n
            f = add.faces.new((a_[i], a_[j], b_[j], b_[i])); f.material_index = mi
    for i in range(n):
        f = add.faces.new((vc, R_[-1][i], R_[-1][(i + 1) % n])); f.material_index = mi
def add_ring(inner, outer, lift, mi):
    a = [hit(x, z, lift) for x, z in inner]; b = [hit(x, z, lift) for x, z in outer]
    va = []; vb = []
    for p in a:
        v = add.verts.new(p); v[dl][HEADI] = 1.0; va.append(v)
    for p in b:
        v = add.verts.new(p); v[dl][HEADI] = 1.0; vb.append(v)
    n = len(va)
    for i in range(n):
        j = (i + 1) % n
        f = add.faces.new((va[i], va[j], vb[j], vb[i])); f.material_index = mi
def dense(poly, k=4):
    out = []
    for i in range(len(poly)):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % len(poly)]
        for t in range(k): out.append((x1 + (x2 - x1) * t / k, z1 + (z2 - z1) * t / k))
    return out
for s in (1, -1):
    poly = [(s * x, z) for x, z in LENS]
    if s < 0: poly = poly[::-1]
    dp = dense(poly)
    add_fan(dp, 0.0046, 1)
    add_ring(dp, grow(dp, 0.0068), 0.0048, 2)
bmesh.ops.recalc_face_normals(add, faces=[f for f in add.faces if f.material_index > 0])
# Normalen der Linsenflaechen nach vorn ausrichten (erst berechnen - neue Flaechen haben noch keine)
add.normal_update()
for f in add.faces:
    if f.material_index > 0 and f.normal.y > 0: f.normal_flip()
add.to_mesh(me); add.free()
me.shade_smooth()
me.calc_loop_triangles()
result = {"tris": len(me.loop_triangles), "verts": len(me.vertices), "mats": [m.name for m in me.materials],
          "painted": int(valid.sum())}
