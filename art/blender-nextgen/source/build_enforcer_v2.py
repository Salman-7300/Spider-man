# CITY SWING - Blender Next Gen
# Armored Street Enforcer v2 (Polish): wie v1, plus Koerperbau, Gewichtszonen je Teil,
# eng anliegende Muetze (Spielnormierung), UV + Detailtexturen fuer Stoff/Platten.
# Basis Armored Street Enforcer v1: vorhandenes thug-Skelett + Koerper, neue taktische Ausruestung.
# Jedes Ausruestungsteil wird um den echten Koerper in der Bind-Pose "angegossen"
# (Strahlen von aussen auf die Koerperhaut, plus Abstand), dann verdickt und bekommt die
# Skin-Gewichte der naechstgelegenen Koerperflaeche (baryzentrisch). Skelett, Knochennamen,
# Bind-Pose bleiben unveraendert -> alle thug@*-Clips laufen ohne Retargeting.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

R = r"C:\Users\Salma\Projects\City-Swing-Blender"
S = R + r"\art\blender-nextgen"
SCENE = "Enforcer2"

win = bpy.context.window
sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
win.scene = sc
for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(R, "assets", "thug.glb"), disable_bone_shape=True)
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
body = [o for o in sc.objects if o.type == 'MESH'][0]
arm.name = "Enforcer2_Rig"
body.name = "Enforcer2_Body"

# ---------------------------------------------------------------- Knochenpunkte (Bind-Pose, Welt)
def bone(n, tail=False):
    b = arm.data.bones["mixamorig:" + n]
    return arm.matrix_world @ (b.tail_local if tail else b.head_local)

# ---------------------------------------------------------------- Materialien
def mat(name, color, metal=0.0, rough=0.6, emit=None, es=0.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Emission Strength"].default_value = es
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
    return m

# Spiel-Licht ohne Umgebung: dunkler als ~0,12 wird zur schwarzen Silhouette (Browser-Test)
M_PLATE = mat("Enf2_Plate", (0.125, 0.13, 0.12), metal=0.05, rough=0.62)
M_FABRIC = mat("Enf2_Fabric", (0.17, 0.175, 0.14), rough=0.88)
M_ACCENT = mat("Enf2_Accent", (0.42, 0.075, 0.04), rough=0.6)

# ---- Detailtexturen (256^2, kachelbar), prozedural mit numpy
import numpy as np
def _img(name, arr, noncolor=False):
    h, w = arr.shape[:2]
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, w, h, alpha=False)
    if noncolor:
        im.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((h, w, 4), np.float32); rgba[..., :3] = arr
    im.pixels.foreach_set(rgba.ravel())
    im.file_format = 'PNG'
    im.pack()
    return im
N = 256
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
rng = np.random.default_rng(7)
weave = 0.5 + 0.5 * np.sin((xx + yy) * 2 * np.pi / 4)                 # Koeperbindung
rip = (np.minimum(np.abs((xx % 32) - 1), np.abs((yy % 32) - 1)) < 1.2).astype(np.float32)   # Ripstop-Raster
noise = rng.normal(0, 1, (N, N)).astype(np.float32)
for _ in range(3):
    noise = (noise + np.roll(noise, 1, 0) + np.roll(noise, 1, 1) + np.roll(noise, -1, 0) + np.roll(noise, -1, 1)) / 5
noise = noise / (np.abs(noise).max() + 1e-6)
fab_v = 0.88 + 0.04 * weave - 0.025 * rip + 0.035 * noise
fab_h = 0.5 * weave + 0.5 * rip
plate_v = 0.90 + 0.05 * noise - 0.03 * (rng.random((N, N)) > 0.985)
def normal_from(hgt, k):
    gx = np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1); gy = np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)
    n = np.stack([-gx * k, gy * k, np.ones_like(hgt)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5
IMG_FAB = _img("enf2_fabric_col", np.repeat(fab_v[..., None], 3, 2))
IMG_FAB_N = _img("enf2_fabric_nrm", normal_from(fab_h, 0.5), noncolor=True)
IMG_PLATE = _img("enf2_plate_col", np.repeat(plate_v[..., None], 3, 2))
def texture(m, col_img, nrm_img=None):
    nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
    for n in [n for n in nt.nodes if n.type in ('TEX_IMAGE', 'NORMAL_MAP', 'MIX')]:
        nt.nodes.remove(n)
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = col_img
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["A"].default_value = b.inputs["Base Color"].default_value[:]
    nt.links.new(t.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    if nrm_img:
        tn = nt.nodes.new("ShaderNodeTexImage"); tn.image = nrm_img
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.7
        nt.links.new(tn.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
texture(M_FABRIC, IMG_FAB, IMG_FAB_N)
texture(M_ACCENT, IMG_FAB, IMG_FAB_N)
texture(M_PLATE, IMG_PLATE)
ARMOR_MATS = [M_PLATE, M_FABRIC, M_ACCENT]
PL, FA, AC = 0, 1, 2

# Koerpermaterial: neue Basistextur, Normalmap behalten, kein Leuchten mehr
bm_ = body.data.materials[0]
bm_.name = "Enf2_Skin_Suit"
nt = bm_.node_tree
for n in list(nt.nodes):
    if n.type == 'TEX_IMAGE' and n.image and "glow" in n.image.name:
        nt.nodes.remove(n)
    elif n.type == 'TEX_IMAGE' and n.image and "diffuse" in n.image.name:
        img = bpy.data.images.load(S + r"\source\enforcer2_diffuse.png", check_existing=True)
        img.name = "enforcer2_diffuse"
        n.image = img
pb = nt.nodes.get("Principled BSDF")
pb.inputs["Emission Strength"].default_value = 0.0
pb.inputs["Metallic"].default_value = 0.0
pb.inputs["Roughness"].default_value = 0.7

# ---------------------------------------------------------------- Sci-Fi-Sichel entfernen
# Das Ausgangsmodell traegt ueber jedem Arm eine orange Sichel (eigene Netzinsel). In der T-Pose liegt
# sie am Arm an, in jeder Bewegung ragt sie wie eine Klinge aus dem Ruecken -> fuer einen urbanen
# Gegner unpassend. Saat: Flaechen in diesem UV-Band ausserhalb der Schulter, dann Inselsuche.
_bm = bmesh.new(); _bm.from_mesh(body.data)
_uv = _bm.loops.layers.uv.active
seed = []
for f in _bm.faces:
    u = sum(l[_uv].uv.x for l in f.loops) / len(f.loops); v = sum(l[_uv].uv.y for l in f.loops) / len(f.loops)
    c = body.matrix_world @ f.calc_center_median()
    if 0.09 < u < 0.145 and v > 0.86 and abs(c.x) > 0.3:
        seed.append(f)
island, stack = set(seed), list(seed)
while stack:
    f = stack.pop()
    for e in f.edges:
        for g in e.link_faces:
            if g not in island:
                island.add(g); stack.append(g)
REMOVED_SICKLE_FACES = len(island)
bmesh.ops.delete(_bm, geom=list(island), context='FACES')
_bm.to_mesh(body.data); _bm.free()

# ---------------------------------------------------------------- Koerperbau (Bind-Pose)
# Kraeftiger, aber glaubwuerdig: Schultern/Oberarme, Unterarme, Oberschenkel, Brust leicht nach aussen.
BULK = {"Shoulder": 0.010, "Arm": 0.009, "ForeArm": 0.006, "UpLeg": 0.010, "Leg": 0.005,
        "Spine1": 0.008, "Spine2": 0.010, "Spine": 0.006}
_names = [g.name.replace("mixamorig:", "") for g in body.vertex_groups]
_me = body.data
BULKED = 0
for v in _me.vertices:
    amt = 0.0
    for g in v.groups:
        key = _names[g.group].replace("Left", "").replace("Right", "")
        if key in BULK:
            amt += BULK[key] * g.weight
    if amt:
        v.co += v.normal * amt
        BULKED += 1
_me.update()

# ---------------------------------------------------------------- Koerper als Ziel fuer Strahlen und Gewichte
dg = bpy.context.evaluated_depsgraph_get()
B = bmesh.new()
B.from_mesh(body.data)
B.transform(body.matrix_world)
B.faces.ensure_lookup_table(); B.verts.ensure_lookup_table()
BVH = BVHTree.FromBMesh(B)
DEF = B.verts.layers.deform.active
GROUPS = [g.name for g in body.vertex_groups]

def cast_in(origin, target):
    d = (Vector(target) - Vector(origin))
    loc, nor, idx, dist = BVH.ray_cast(Vector(origin), d.normalized(), d.length)
    return loc, nor

# ---------------------------------------------------------------- Bauhelfer
def grid_mesh(name, pts, closed_u, mi_fn):
    """pts[row][col] -> Flaeche; mi_fn(row, col) gibt Materialindex."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    V = [[bm.verts.new(p) for p in row] for row in pts]
    nr, nc = len(V), len(V[0])
    # Bogenlaengen-UV (5 Kacheln je Meter): Webmuster gleich gross auf allen Teilen
    U = [[0.0] * (nc + 1) for _ in range(nr)]
    for r in range(nr):
        for c in range(1, nc + 1):
            U[r][c] = U[r][c - 1] + (Vector(pts[r][c % nc]) - Vector(pts[r][c - 1])).length * 9
    W = [[0.0] * (nc + 1) for _ in range(nr)]
    for r in range(1, nr):
        for c in range(nc + 1):
            W[r][c] = W[r - 1][c] + (Vector(pts[r][c % nc]) - Vector(pts[r - 1][c % nc])).length * 9
    for r in range(nr - 1):
        for c in range(nc if closed_u else nc - 1):
            c2 = (c + 1) % nc
            f = bm.faces.new((V[r][c], V[r][c2], V[r + 1][c2], V[r + 1][c]))
            f.material_index = mi_fn(r, c)
            for loop, (rr, cc) in zip(f.loops, ((r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c))):
                loop[uvl].uv = (U[rr][cc], W[rr][cc])
    return bm

def finish(name, bm, thick, smooth_iters=2, outward_ref=None, allow=None):
    """Glaetten, verdicken (Solidify), Gewichte uebertragen, an das Rig haengen."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if outward_ref is not None:          # Normalen nach aussen (weg von der Achse)
        f0 = bm.faces[0] if hasattr(bm.faces, '__getitem__') else None
    for _ in range(smooth_iters):
        bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary], factor=0.5,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for m in ARMOR_MATS:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    sol = ob.modifiers.new("solid", 'SOLIDIFY')
    sol.thickness = thick; sol.offset = -1.0; sol.use_even_offset = True; sol.use_rim = True
    sol.use_quality_normals = True
    dg = bpy.context.evaluated_depsgraph_get()
    newme = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data; ob.data = newme; bpy.data.meshes.remove(old)
    newme.shade_smooth()
    newme.set_sharp_from_angle(angle=math.radians(50))
    transfer_weights(ob, allow)
    ob.parent = arm
    md = ob.modifiers.new("Armature", 'ARMATURE'); md.object = arm
    return ob

def transfer_weights(ob, allow=None):
    for g in GROUPS:
        ob.vertex_groups.new(name=g)
    for v in ob.data.vertices:
        co = ob.matrix_world @ v.co
        loc, nor, idx, dist = BVH.find_nearest(co)
        f = B.faces[idx]
        acc = {}
        # baryzentrische Gewichte ueber ein Dreieck des Polygons
        vs = f.verts
        tri = [vs[0], vs[1], vs[2]] if len(vs) == 3 else min(
            ([vs[0], vs[i], vs[i + 1]] for i in range(1, len(vs) - 1)),
            key=lambda t: (sum((x.co for x in t), Vector()) / 3 - loc).length)
        w3 = barycentric_transform(loc, tri[0].co, tri[1].co, tri[2].co,
                                   Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
        for k, bv in enumerate(tri):
            wk = max(0.0, w3[k])
            for gi, gw in bv[DEF].items():
                acc[gi] = acc.get(gi, 0.0) + gw * wk
        if allow:      # v2: nur die Knochen, an denen das Teil wirklich haengt
            ok = {gi: w for gi, w in acc.items() if GROUPS[gi].replace("mixamorig:", "") in allow and w > 0}
            if not ok:
                best = min(allow, key=lambda n: (bone(n) - co).length)
                ok = {GROUPS.index("mixamorig:" + best): 1.0}
            acc = ok
        top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
        s = sum(w for _, w in top) or 1.0
        for gi, w in top:
            if w / s > 0.01:
                ob.vertex_groups[gi].add([v.index], w / s, 'REPLACE')

def rigid(ob, side, L, sh):
    arm_g, sh_g = "mixamorig:" + L + "Arm", "mixamorig:" + L + "Shoulder"
    for v in ob.data.vertices:
        for g in list(v.groups):
            ob.vertex_groups[g.group].remove([v.index])
        x = abs((ob.matrix_world @ v.co).x)
        t = max(0.0, min(1.0, (x - abs(sh.x) + 0.01) / 0.08))     # innen -> aussen
        ob.vertex_groups[sh_g].add([v.index], 0.35 * (1 - t), 'REPLACE')
        ob.vertex_groups[arm_g].add([v.index], 1.0 - 0.35 * (1 - t), 'REPLACE')

def ring_fit(center_fn, basis_fn, ts, angles, off, start_r=0.6, start_fn=None):
    """center_fn(t)->Punkt auf der Achse, basis_fn(t)->(u,w) Einheitsvektoren senkrecht zur Achse.
    Fuer jedes (t, Winkel) wird von aussen zur Achse gestrahlt; Treffer + off entlang der Strahlrichtung."""
    rows = []
    for t in ts:
        c = center_fn(t)
        u, w = basis_fn(t)
        row = []
        for a in angles:
            d = (u * math.cos(a) + w * math.sin(a)).normalized()
            o = c + d * (start_fn(d) if start_fn else start_r)
            loc, nor = cast_in(o, c)
            if loc is None:
                loc = c + d * 0.1
            row.append(loc + d * off)
        rows.append(row)
    return rows

def lerp(a, b, t):
    return a + (b - a) * t

parts = []
ZUP = Vector((0, 0, 1))

# ---------------------------------------------------------------- Weste (Torso)
hips, sp2, neck = bone("Hips"), bone("Spine2"), bone("Neck")
def torso_c(t):
    z = t
    a = lerp(hips, neck, (z - hips.z) / (neck.z - hips.z))
    return Vector((0, a.y, z))
NA = 40
angles = [-math.pi / 2 + 2 * math.pi * i / NA for i in range(NA)]   # i=0 -> vorn (-Y)
def front_w(a):          # 1 vorn/hinten, 0 an den Seiten
    return abs(math.sin(a + math.pi / 2)) if False else abs(math.cos(a + math.pi / 2 - math.pi / 2))
rows = []
nrow = 14
for r in range(nrow):
    t = r / (nrow - 1)
    row = []
    for a in angles:
        fw = abs(math.sin(a))          # |sin| = 1 vorn/hinten (a=-pi/2 vorn, +pi/2 hinten), 0 seitlich
        top = 1.335 + 0.135 * fw ** 1.6      # Armausschnitt: seitlich niedriger
        z = lerp(1.045, top, t)        # v2: Unterkante ueber dem Hueftgelenk (hoher Tritt)
        c = torso_c(z)
        d = Vector((math.cos(a), math.sin(a), 0))
        loc, nor = cast_in(c + d * 0.25, c)     # 0,25 m: Strahl startet vor den Armen
        if loc is None:
            loc = c + d * 0.15
        bulk = 0.024 + 0.008 * fw * (1 - abs(t - 0.55))     # Platten vorn/hinten etwas dicker aufgebaut
        p_ = loc + d * bulk
        # Plattentraeger: Seiten weich auf max. 0,215 m einziehen (sonst Fass-Silhouette)
        if abs(p_.x) > 0.19:
            p_.x = math.copysign(0.19 + 0.025 * math.tanh((abs(p_.x) - 0.19) / 0.025), p_.x)
        row.append(p_)
    rows.append(row)
def vest_mat(r, c):
    a = angles[c]
    if r in (0, nrow - 2):
        return FA                      # Saeume aus Stoff
    if abs(math.cos(a)) > 0.86:
        return FA                      # Seitenteile Stoff (Klett/Gurt)
    return PL
vest = finish("Enf_Vest", grid_mesh("Enf_Vest", rows, True, vest_mat), 0.014, smooth_iters=3,
              allow={"Hips", "Spine", "Spine1", "Spine2", "LeftShoulder", "RightShoulder"})
parts.append(vest)

# Kragen / hoher Stehkragen
rows = ring_fit(lambda t: Vector((0, lerp(neck.y, neck.y, t), t)), lambda t: (Vector((1, 0, 0)), Vector((0, 1, 0))),
                [1.44, 1.47, 1.505], angles, 0.022, start_fn=lambda d: 0.14)   # v2: Strahl startet am Hals, nicht in den T-Pose-Armen
parts.append(finish("Enf_Collar", grid_mesh("c", rows, True, lambda r, c: FA), 0.012, 1, allow={"Spine2", "Neck"}))

# ---------------------------------------------------------------- Schulterpolster, Ellbogen, Unterarm
for side in (1, -1):
    L = "Left" if side > 0 else "Right"
    sh, el, wr = bone(L + "Arm"), bone(L + "ForeArm"), bone(L + "Hand")
    def arm_c(x, sh=sh, el=el, wr=wr):
        if abs(x) <= abs(el.x):
            return sh.lerp(el, (x - sh.x) / (el.x - sh.x))
        return el.lerp(wr, (x - el.x) / (wr.x - el.x))
    basis = lambda t: (Vector((0, -1, 0)), Vector((0, 0, 1)))
    # Schulterpolster: zwei ueberlappende Lagen, obere Haelfte (Winkel um +Z), Kante in Akzentfarbe
    for k, (x0, x1, spread, off) in enumerate(((0.19, 0.33, 1.35, 0.036), (0.26, 0.37, 1.20, 0.028))):
        xs = [side * lerp(x0, x1, i / 6) for i in range(7)]
        angs = [math.pi / 2 + lerp(-spread, spread, j / 12) for j in range(13)]
        rows = ring_fit(arm_c, basis, xs, angs, off)
        # Polster nach aussen leicht kuppeln
        for i, row in enumerate(rows):
            bump = math.sin(math.pi * i / 6) * 0.012
            for j in range(len(row)):
                row[j] = row[j] + Vector((0, 0, bump))
        mi = lambda r, c, k=k: AC if (k == 0 and r == 5) else PL
        pad = finish("Enf_Shoulder%s%d" % (L[0], k), grid_mesh("s", rows, False, mi), 0.012, 2)
        # Am Oberarm festgeschnallt: starr mit dem Oberarm, innen etwas Schulter (sonst stehen
        # die Polster bei haengendem Arm wie Fluegel ab - im ersten Posen-Test gesehen)
        rigid(pad, side, L, sh)
        parts.append(pad)
    # Ellbogenschutz: hinten (+Y), wo der Ellbogen in der T-Pose zeigt
    xs = [side * lerp(abs(el.x) - 0.055, abs(el.x) + 0.06, i / 5) for i in range(6)]
    angs = [math.pi + lerp(-1.25, 1.25, j / 10) for j in range(11)]   # +Y Richtung
    basis_e = lambda t: (Vector((0, -1, 0)), Vector((0, 0, 1)))
    rows = ring_fit(arm_c, basis_e, xs, angs, 0.022)
    parts.append(finish("Enf_Elbow" + L[0], grid_mesh("e", rows, False, lambda r, c: PL), 0.012, 2,
                        allow={L + "Arm", L + "ForeArm"}))
    # Unterarmschoner rundum
    xs = [side * lerp(abs(el.x) + 0.09, abs(wr.x) - 0.03, i / 6) for i in range(7)]
    angs = [2 * math.pi * j / 18 for j in range(18)]
    rows = ring_fit(arm_c, basis, xs, angs, 0.012)
    parts.append(finish("Enf_Bracer" + L[0], grid_mesh("b", rows, True,
        lambda r, c: AC if r == 0 else (FA if r == 5 else PL)), 0.009, 1, allow={L + "ForeArm", L + "Hand"}))

# ---------------------------------------------------------------- Beine: Knieschoner, Schienbein, Stiefel, Guertel
for side in (1, -1):
    L = "Left" if side > 0 else "Right"
    up, kn, an = bone(L + "UpLeg"), bone(L + "Leg"), bone(L + "Foot")
    def leg_c(z, up=up, kn=kn, an=an):
        if z >= kn.z:
            return kn.lerp(up, (z - kn.z) / (up.z - kn.z))
        return an.lerp(kn, (z - an.z) / (kn.z - an.z))
    basisz = lambda t: (Vector((1, 0, 0)), Vector((0, 1, 0)))
    # Knieschoner vorn (-Y)
    zs = [lerp(kn.z - 0.10, kn.z + 0.09, i / 7) for i in range(8)]
    angs = [-math.pi / 2 + lerp(-1.3, 1.3, j / 12) for j in range(13)]
    inner = lambda d, side=side: 0.11 if d.x * side < -0.3 else 0.2
    rows = ring_fit(leg_c, basisz, zs, angs, 0.026, start_fn=inner)
    for i, row in enumerate(rows):
        bump = math.sin(math.pi * i / 7) * 0.014
        for j in range(len(row)):
            row[j] = row[j] + Vector((0, -bump, 0))
    parts.append(finish("Enf_Knee" + L[0], grid_mesh("k", rows, False,
        lambda r, c: AC if r == 3 and 4 <= c <= 8 else PL), 0.014, 2, allow={L + "UpLeg", L + "Leg"}))
    # Stiefel: rundum vom Boden bis Wade; Fuss strahlt bis zur Spitze aus
    zs = [0.012, 0.04, 0.075, 0.11, 0.15, 0.185, 0.215]
    angs = [2 * math.pi * j / 24 for j in range(24)]
    def boot_c(z, an=an):
        return Vector((an.x, an.y - 0.035, z))
    rows = ring_fit(boot_c, basisz, zs, angs, 0.010, start_fn=lambda d, side=side: 0.10 if d.x * side < -0.3 else 0.28)
    for j in range(len(rows[0])):          # Sohle flach auf den Boden, leicht breiter
        rows[0][j] = Vector((rows[0][j].x, rows[0][j].y, 0.0)) + (rows[0][j] - boot_c(0.0)).normalized() * 0.008
        rows[0][j].z = 0.0
    parts.append(finish("Enf_Boot" + L[0], grid_mesh("bo", rows, True,
        lambda r, c: PL if r == 0 else FA), 0.010, 1, allow={L + "Leg", L + "Foot", L + "ToeBase"}))
    # Oberschenkeltasche aussen
    zc = lerp(kn.z, up.z, 0.55)
    zs = [zc - 0.08 + 0.16 * i / 5 for i in range(6)]
    angs = [lerp(-0.55, 0.55, j / 6) + (0 if side > 0 else math.pi) for j in range(7)]
    rows = ring_fit(leg_c, basisz, zs, angs, 0.040, start_fn=lambda d: 0.2)
    parts.append(finish("Enf_ThighPouch" + L[0], grid_mesh("tp", rows, False, lambda r, c: FA), 0.03, 1,
                        allow={L + "UpLeg"}))

# Guertel mit Taschen
zs = [0.93, 0.955, 0.98, 1.005]
rows = ring_fit(lambda z: Vector((0, hips.y, z)), lambda t: (Vector((1, 0, 0)), Vector((0, 1, 0))), zs, angles, 0.05)
parts.append(finish("Enf_Belt", grid_mesh("bt", rows, True, lambda r, c: AC if r == 1 and c % 10 == 0 else FA), 0.014, 1,
                    allow={"Hips"}))
for a in (-0.55, 0.55, math.pi / 2 + 0.6, math.pi / 2 - 0.6 + math.pi):    # zwei vorn seitlich, zwei hinten
    zs = [0.90 + 0.11 * i / 4 for i in range(5)]
    angs = [math.pi + a + lerp(-0.28, 0.28, j / 4) if False else -math.pi / 2 + a + lerp(-0.26, 0.26, j / 4) for j in range(5)]
    rows = ring_fit(lambda z: Vector((0, hips.y, z)), lambda t: (Vector((1, 0, 0)), Vector((0, 1, 0))), zs, angs, 0.085)
    parts.append(finish("Enf_Pouch", grid_mesh("p", rows, False, lambda r, c: FA), 0.035, 1, allow={"Hips"}))
# Brusttaschen auf der Weste
for a in (-0.42, 0.42):
    zs = [1.20 + 0.10 * i / 4 for i in range(5)]
    angs = [-math.pi / 2 + a + lerp(-0.22, 0.22, j / 4) for j in range(5)]
    rows = ring_fit(torso_c, lambda t: (Vector((1, 0, 0)), Vector((0, 1, 0))), zs, angs, 0.075)
    parts.append(finish("Enf_ChestPouch", grid_mesh("cp", rows, False, lambda r, c: FA), 0.028, 1,
                        allow={"Spine1", "Spine2"}))

# ---------------------------------------------------------------- Muetze (Strickmuetze, gibt Strassen-Silhouette)
hc = Vector((0, bone("Head").y - 0.005, 1.705))
rows = []
for i in range(9):
    el = math.radians(lerp(-4, 84, i / 8))
    row = []
    for j in range(24):
        az = 2 * math.pi * j / 24
        d = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        loc, nor = cast_in(hc + d * 0.4, hc)
        if loc is None:
            loc = hc + d * 0.1
        row.append(loc + d * 0.0075)
    rows.append(row)
top = hc + Vector((0, 0, 0.088))       # v2: eng anliegend -> Gesamthoehe ~ thug
rows.append([top] * 24)
cap = grid_mesh("cap", rows, True, lambda r, c: FA)
bmesh.ops.remove_doubles(cap, verts=cap.verts, dist=0.0005)
parts.append(finish("Enf_Beanie", cap, 0.006, 2, allow={"Head"}))

# ---------------------------------------------------------------- Zusammenfuehren (ein Mesh, 3 Materialien)
bpy.ops.object.select_all(action='DESELECT')
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
with bpy.context.temp_override(active_object=parts[0], selected_editable_objects=parts, selected_objects=parts):
    bpy.ops.object.join()
gear = parts[0]
gear.name = "Enforcer2_Gear"
gear.data.name = "Enforcer2_Gear"
B.free()

gear.data.calc_loop_triangles(); body.data.calc_loop_triangles()
result = {"gear_tris": len(gear.data.loop_triangles), "body_tris": len(body.data.loop_triangles),
          "gear_groups": len(gear.vertex_groups), "rig": arm.name, "removedSickleFaces": REMOVED_SICKLE_FACES, "bulkedVerts": BULKED}
