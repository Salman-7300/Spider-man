# CITY SWING - Blender Next Gen
# Urban Premium Sedan v1 - prozedural, reproduzierbar.
# Ausfuehren in Blender 5.2:  exec(open(r"...\build_sedan.py").read())
#
# Koordinaten: Autor-Koordinaten (x quer, f vorwaerts, h hoch) -> Blender (x, -f, h).
# Nach glTF-Export (+Y oben) zeigt die Front damit nach three.js +Z, wie im Spiel
# (city-visuals.js createCar: Scheinwerfer bei z = +2.285).
import bpy, bmesh, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
SCENE = "Sedan"

# ---------------------------------------------------------------- Masse
L = 4.72           # Laenge
HALF = L / 2
WMAX = 0.905       # halbe Karosseriebreite an der Taille (1,81 m; ueber den Radhaeusern 1,87 m)
AX_F, AX_R = 1.39, -1.43   # Achsen (Radstand 2,82 m)
TRACK = 0.795      # Radmitte quer
R_TIRE = 0.335
R_RIM = 0.236
ARCH_R = 0.378
CABIN = dict(x=0.845, f0=-1.47, f1=0.93, z0=0.24)
SEAT_H = 0.45      # Huefte des Fahrers: Spiel-Sitzpose braucht ~0,98 m bis zum Scheitel
DRIVER = (-0.44, -0.06, SEAT_H)   # Spielkonvention: Fahrer bei x = -0.44

def P(x, f, h):
    return Vector((x, -f, h))

# ---------------------------------------------------------------- Szene
win = bpy.context.window
sc = bpy.data.scenes.get(SCENE)
if sc:
    for o in list(sc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
else:
    sc = bpy.data.scenes.new(SCENE)
win.scene = sc
sc.unit_settings.system = 'METRIC'

def link(ob):
    sc.collection.objects.link(ob)
    return ob

# ---------------------------------------------------------------- Materialien
def mat(name, color, metal=0.0, rough=0.5, emit=None, emit_strength=0.0,
        alpha=1.0, coat=0.0, coat_rough=0.05, double=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Alpha"].default_value = alpha
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    else:
        b.inputs["Emission Strength"].default_value = 0.0
    m.use_backface_culling = not double
    if alpha < 1.0:
        m.surface_render_method = 'BLENDED'
    return m

M = {
    # neutrale Grundversion: Graphitgrau-Metallic. Farbvarianten nur ueber diesen Lack.
    # Ohne Umgebungskarte (Spiel) wird Metall schwarz -> geringer Metallanteil, Klarlack fuer Glanzlichter.
    "Paint":     mat("Sedan_Paint", (0.20, 0.215, 0.23), metal=0.12, rough=0.38, coat=1.0, double=True),
    "Trim":      mat("Sedan_TrimBlack", (0.018, 0.019, 0.021), rough=0.38),
    "Matte":     mat("Sedan_MatteDark", (0.035, 0.036, 0.038), rough=0.85, double=True),
    "Metal":     mat("Sedan_Metal", (0.70, 0.72, 0.74), metal=0.45, rough=0.28),
    "Glass":     mat("Sedan_Glass", (0.015, 0.022, 0.028), metal=0.0, rough=0.03, alpha=0.62, double=True),
    "LampF":     mat("Sedan_LampFront", (0.85, 0.88, 0.9), rough=0.2, emit=(1.0, 0.97, 0.92), emit_strength=2.0),
    "LampR":     mat("Sedan_LampRear", (0.35, 0.02, 0.02), rough=0.25, emit=(1.0, 0.06, 0.04), emit_strength=1.2),
    "Interior":  mat("Sedan_Interior", (0.075, 0.07, 0.065), rough=0.7, double=True),
}
ORDER = ["Paint", "Trim", "Matte", "Metal", "Glass", "LampF", "LampR", "Interior"]
MI = {k: i for i, k in enumerate(ORDER)}

def new_obj(name, bm, mats=ORDER):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for k in mats:
        me.materials.append(M[k])
    return link(bpy.data.objects.new(name, me))

# ---------------------------------------------------------------- Profilfunktionen
def smooth(a, b, t):
    t = max(0.0, min(1.0, (t - a) / (b - a)))
    return t * t * (3 - 2 * t)

def lerp(a, b, t):
    return a + (b - a) * t

def z_top(f):
    """Oberkante der Unterkarosserie: Haube, Guertellinie, Kofferraum."""
    if f >= 0.95:            # Haube faellt zur Nase
        t = (f - 0.95) / (HALF - 0.95)
        return 0.975 - 0.10 * t ** 2.2
    if f >= -1.50:           # Guertel steigt leicht nach hinten (Keil)
        t = (0.95 - f) / 2.45
        return 0.965 + 0.05 * t
    t = (-1.50 - f) / (HALF - 1.50)   # Kofferraumdeckel, Abrisskante, dann Heck
    return 1.015 + 0.02 * math.sin(min(t, 0.8) / 0.8 * math.pi / 2) - 0.13 * smooth(0.78, 1.0, t)

def z_bot(f):
    if f > AX_F:
        return 0.20 + 0.11 * smooth(AX_F, HALF, f)
    if f < AX_R:
        return 0.20 + 0.13 * smooth(-AX_R, HALF, -f)
    return 0.20

def plan(f):
    """Grundriss-Verrundung an Front und Heck (Superellipse)."""
    f0 = 1.86 if f > 0 else 1.90
    a = abs(f)
    if a <= f0:
        return 1.0
    u = min((a - f0) / (HALF - f0), 0.9985)
    p = 4.6 if f > 0 else 5.0
    return (1 - u ** p) ** (1 / p)

def flare(f, z):
    """Kotfluegel-Schultern ueber den Raedern: macht die Seite breiter, wo das Rad steht."""
    g = math.exp(-((f - AX_F) / 0.62) ** 2) + math.exp(-((f - AX_R) / 0.62) ** 2)
    return 0.034 * g * math.exp(-((z - 0.66) / 0.24) ** 2)

def section(f, n=12):
    """Geschlossener Querschnitt, Start unten Mitte, ueber +x nach oben, zurueck ueber -x."""
    zt, zb = z_top(f), z_bot(f)
    pl = plan(f)
    w = WMAX * pl
    # an den Enden runden sich auch Ober- und Unterkante ein
    endr = 1 - pl
    zt -= 0.035 * endr
    zb += 0.05 * endr
    zc = zb + 0.60 * (zt - zb)
    ht, hb = zt - zc, zc - zb
    pts = []
    for i in range(2 * n + 1):
        t = -math.pi / 2 + math.pi * i / (2 * n)
        c, s = math.cos(t), math.sin(t)
        e = 2 / (6.0 if s > 0 else 3.6)
        x = w * (abs(c) ** e)
        z = zc + (ht if s > 0 else hb) * math.copysign(abs(s) ** e, s)
        x *= 1 + flare(f, z)
        pts.append((x, z))
    right = pts                      # unten-Mitte .. oben-Mitte auf +x
    left = [(-x, z) for (x, z) in reversed(pts[1:-1])]
    return right + left

def stations(n_mid=20, n_end=10):
    out = []
    # dichte Stationen an den Enden (Kosinus), lockerer in der Mitte
    for i in range(n_end):
        t = i / n_end
        out.append(-HALF + (HALF - 1.90) * (1 - math.cos(t * math.pi / 2)) + 0.0004)
    for i in range(n_mid + 1):
        out.append(lerp(-1.90, 1.86, i / n_mid))
    for i in range(1, n_end + 1):
        t = i / n_end
        out.append(1.86 + (HALF - 1.86) * math.sin(t * math.pi / 2) - 0.0004)
    return out

# ---------------------------------------------------------------- Unterkarosserie
def build_lower():
    bm = bmesh.new()
    rings = []
    for f in stations():
        ring = [bm.verts.new(P(x, f, z)) for (x, z) in section(f)]
        rings.append(ring)
    n = len(rings[0])
    for a, b in zip(rings[:-1], rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for fc in bm.faces:
        fc.material_index = MI["Paint"]
    return new_obj("Sedan_LowerBody", bm)

def cutter_box(name, x0, x1, f0, f1, z0, z1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((lerp(x0, x1, v.co.x + 0.5), -lerp(f0, f1, v.co.y + 0.5), lerp(z0, z1, v.co.z + 0.5)))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))

def cutter_cyl(name, f, side):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=ARCH_R, radius2=ARCH_R, depth=0.6)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=P(side * 0.93, f, R_TIRE + 0.01))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))

def boolean(target, cutters):
    for c in cutters:
        md = target.modifiers.new("cut_" + c.name, 'BOOLEAN')
        md.operation = 'DIFFERENCE'; md.solver = 'EXACT'; md.object = c
        c.hide_render = True; c.hide_viewport = True
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(target.evaluated_get(dg))
    old = target.data
    target.modifiers.clear()
    target.data = new
    bpy.data.meshes.remove(old)
    for c in cutters:
        bpy.data.objects.remove(c, do_unlink=True)

# ---------------------------------------------------------------- Kabine (Glashaus)
GH_F0, GH_F1 = -1.53, 0.955        # hinten / vorn am Guertel
ROOF_F0, ROOF_F1 = -0.86, 0.08     # Dachflaeche
ROOF_Z = 1.50

def roof_center(f):
    if f >= ROOF_F1:                       # Frontscheibe
        t = (f - ROOF_F1) / (GH_F1 - ROOF_F1)
        return lerp(ROOF_Z - 0.005, z_top(GH_F1) - 0.012, t ** 1.12)
    if f <= ROOF_F0:                       # Heckscheibe (Fastback-Ansatz)
        t = (ROOF_F0 - f) / (ROOF_F0 - GH_F0)
        return lerp(ROOF_Z - 0.01, z_top(GH_F0) - 0.012, t ** 1.18)
    t = (f - ROOF_F0) / (ROOF_F1 - ROOF_F0)
    return ROOF_Z + 0.006 * math.sin(t * math.pi) - 0.01 * (1 - t)

def gh_section(f, ns=7, nt=9):
    """Halbschnitt von Guertel (+x) zur Dachmitte; Rueckgabe Liste (x,z,teil)."""
    zb = z_top(f) - 0.012
    zt = roof_center(f)
    h = max(zt - zb, 0.0)
    wb = WMAX * plan(f) - 0.035
    tumble = 0.21 * h / 0.5
    xc = wb - tumble
    rc = min(0.065, h * 0.30)
    zc = zt - rc - 0.03 * h
    pts = []
    for i in range(ns):                        # Seite: leicht ballig
        t = i / ns
        x = lerp(wb, xc, t) + 0.018 * math.sin(t * math.pi) * (h / 0.5)
        pts.append((x, lerp(zb, zc, t), 'side', t))
    for i in range(nt + 1):                    # Dachbogen
        t = i / nt
        a = t * math.pi / 2
        x = xc * (1 - math.sin(a)) ** 1.0 if t < 1 else 0.0
        x = xc * math.cos(a) ** 0.55
        z = zc + (zt - zc) * math.sin(a) ** 0.75
        pts.append((x, z, 'top', t))
    return pts

def gh_stations():
    fs = []
    for i in range(10):
        fs.append(lerp(GH_F0, ROOF_F0, i / 10))
    for i in range(10):
        fs.append(lerp(ROOF_F0, ROOF_F1, i / 10))
    for i in range(11):
        fs.append(lerp(ROOF_F1, GH_F1, i / 10))
    return fs

WIN_F0, WIN_F1 = -1.10, 0.86     # Seitenfenster-Ausschnitt (dahinter kraeftige C-Saeule)
BPILLAR = (-0.215, -0.135)

def build_greenhouse():
    bm = bmesh.new()
    rows = []
    fs = gh_stations()
    for f in fs:
        half = gh_section(f)
        right = [(x, z, part, t) for (x, z, part, t) in half]
        left = [(-x, z, part, t) for (x, z, part, t) in reversed(half[:-1])]
        rows.append([(bm.verts.new(P(x, f, z)), part, t, x) for (x, z, part, t) in right + left])
    n = len(rows[0])
    for ri in range(len(rows) - 1):
        a, b = rows[ri], rows[ri + 1]
        fm = (fs[ri] + fs[ri + 1]) / 2
        for i in range(n - 1):
            vs = (a[i][0], b[i][0], b[i + 1][0], a[i + 1][0])
            if len({v.index for v in vs}) < 4:
                pass
            try:
                fc = bm.faces.new(vs)
            except ValueError:
                continue
            part, t = a[i][1], a[i][2]
            part2, t2 = a[i + 1][1], a[i + 1][2]
            # Material: Dach Lack, Scheiben Glas, A-Saeule schwarz, C-Saeule Lack, Rahmen schwarz
            tmin = min(t, t2)
            if part == 'top' and part2 == 'top':
                if ROOF_F0 + 0.03 < fm < ROOF_F1 - 0.03:
                    mi = MI["Paint"]
                elif fm <= ROOF_F0 + 0.03:                 # Heckscheibe mit breiter C-Saeule
                    mi = MI["Glass"] if tmin > 0.42 else (MI["Trim"] if tmin > 0.34 else MI["Paint"])
                else:                                       # Frontscheibe, schwarze A-Saeule
                    mi = MI["Glass"] if tmin > 0.24 else MI["Trim"]
            elif part == 'side' and part2 == 'side' and t >= 1 / 7 and WIN_F0 < fm < WIN_F1:
                mi = MI["Glass"]
                if BPILLAR[0] < fm < BPILLAR[1]:
                    mi = MI["Trim"]
            elif part == 'side' and WIN_F0 - 0.05 < fm < WIN_F1 + 0.05:
                mi = MI["Trim"]                             # Fensterrahmen unten / Dachkante
            elif part == 'side':
                mi = MI["Paint"]
            else:                                           # Uebergang Seite->Dach
                mi = MI["Trim"] if (WIN_F0 < fm < WIN_F1 or fm > ROOF_F1) else MI["Paint"]
            fc.material_index = mi
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0008, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj("Sedan_Greenhouse", bm)

# ---------------------------------------------------------------- Hilfen fuer Anbauteile
class Surface:
    def __init__(self, objs):
        dg = bpy.context.evaluated_depsgraph_get()
        bm = bmesh.new()
        for o in objs:
            tmp = bmesh.new(); tmp.from_object(o, dg); tmp.transform(o.matrix_world)
            me = bpy.data.meshes.new("_tmp"); tmp.to_mesh(me); tmp.free()
            bm.from_mesh(me); bpy.data.meshes.remove(me)
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()

    def hit(self, origin, direction):
        loc, nor, idx, d = self.bvh.ray_cast(Vector(origin), Vector(direction).normalized(), 5.0)
        return (loc, nor) if loc is not None else (None, None)

def ribbon(bm, pts, width, lift, mi):
    """Flaches Band ueber einer Liste (Punkt, Normale)."""
    prev = None
    for k, (p, n) in enumerate(pts):
        nxt = pts[min(k + 1, len(pts) - 1)][0]
        prv = pts[max(k - 1, 0)][0]
        tan = (nxt - prv).normalized()
        side = tan.cross(n).normalized() * (width / 2)
        a = bm.verts.new(p + n * lift + side)
        b = bm.verts.new(p + n * lift - side)
        if prev:
            fc = bm.faces.new((prev[0], prev[1], b, a)); fc.material_index = mi
        prev = (a, b)

def surface_grid(bm, rays, lift, mi, flip=False):
    """rays: 2D-Liste von (origin, dir). Baut ein Gitter auf der getroffenen Flaeche."""
    grid = []
    for row in rays:
        r = []
        for o, d in row:
            p, n = SURF.hit(o, d)
            r.append(bm.verts.new(p + n * lift) if p is not None else None)
        grid.append(r)
    for i in range(len(grid) - 1):
        for j in range(len(grid[0]) - 1):
            q = (grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])
            if None in q:
                continue
            fc = bm.faces.new(tuple(reversed(q)) if flip else q)
            fc.material_index = mi
    return grid

def rounded_box(bm, size, center, mi, bevel=0.3, seg=1, rot=None):
    before = set(bm.verts)
    sub = bmesh.ops.create_cube(bm, size=1.0)
    vs = sub["verts"]
    for v in vs:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    edges = list({e for v in vs for e in v.link_edges})
    bmesh.ops.bevel(bm, geom=vs + edges, offset=min(size) * bevel, segments=seg,
                    affect='EDGES', profile=0.5)
    allv = [v for v in bm.verts if v not in before]
    faces = list({f for v in allv for f in v.link_faces})
    for f in faces:
        f.material_index = mi
    if rot:
        bmesh.ops.rotate(bm, verts=allv, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, verts=allv, vec=Vector(center))
    return allv

# ---------------------------------------------------------------- Details
def build_details():
    bm = bmesh.new()
    T, Mt, Me, Lf, Lr, Pa, G = MI["Trim"], MI["Matte"], MI["Metal"], MI["LampF"], MI["LampR"], MI["Paint"], MI["Glass"]

    # Tuerfugen links/rechts (Strahl von aussen)
    def side_line(points_fz, side):
        out = []
        for f, z in points_fz:
            p, n = SURF.hit(P(side * 2.0, f, z), Vector((-side, 0, 0)))
            if p is not None:
                out.append((p, n))
        return out

    def dense(poly, step=0.05):
        pts = []
        for (a, b) in zip(poly[:-1], poly[1:]):
            d = math.dist(a, b); k = max(1, int(d / step))
            for i in range(k):
                pts.append((lerp(a[0], b[0], i / k), lerp(a[1], b[1], i / k)))
        pts.append(poly[-1])
        return pts

    seams = [
        [(0.93, 0.95), (0.93, 0.62), (0.97, 0.40), (0.95, 0.30)],        # Vordertuer vorn
        [(-0.175, 0.955), (-0.175, 0.29)],                               # Tuerspalt mitte
        [(-1.03, 0.98), (-1.05, 0.62), (-1.03, 0.30)],                   # Hintertuer hinten
        [(0.95, 0.295), (-1.03, 0.295)],                                 # Schweller
    ]
    for side in (-1, 1):
        for poly in seams:
            pts = side_line(dense(poly), side)
            if len(pts) > 1:
                ribbon(bm, pts, 0.0085, 0.0016, T)
        # Seitenschweller-Blende
        rays = [[(P(side * 2, f, z), Vector((-side, 0, 0))) for f in [lerp(-1.02, 0.98, i / 14) for i in range(15)]]
                for z in (0.215, 0.245, 0.275)]
        surface_grid(bm, rays, 0.004, T, flip=(side < 0))
        # Tuergriffe (buendig, Metall)
        for f in (0.30, -0.66):
            p, n = SURF.hit(P(side * 2.0, f, 0.885), Vector((-side, 0, 0)))
            if p is None:
                continue
            tan = Vector((0, -1, 0))
            up = n.cross(tan).normalized()
            tan = up.cross(n).normalized()
            rot = Matrix((tan, up, n)).transposed().to_4x4()
            vs = rounded_box(bm, (0.165, 0.028, 0.016), (0, 0, 0), Me, bevel=0.45, seg=2)
            for v in vs:
                v.co = (rot @ v.co.to_4d()).to_3d() + p + n * 0.004
        # Aussenspiegel: Fuss + Gehaeuse (Lack) + Spiegelflaeche
        base = P(side * 0.84, 0.80, 1.005)
        rounded_box(bm, (0.05, 0.10, 0.06), base + Vector((side * 0.03, 0, 0.02)), T, bevel=0.3)
        hous_c = base + Vector((side * 0.095, 0.02, 0.07))
        sub = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=8, radius=1.0)
        for v in sub["verts"]:
            v.co = Vector((v.co.x * 0.105, v.co.y * 0.055 * (1.25 if v.co.y > 0 else 1.0), v.co.z * 0.062)) + hous_c
        for fc in {f for v in sub["verts"] for f in v.link_faces}:
            fc.material_index = Pa
        mir = rounded_box(bm, (0.17, 0.004, 0.09), hous_c + Vector((0, 0.058, 0)), Me, bevel=0.2, seg=1)

    # Haubenfugen (Strahl von oben)
    def top_line(poly):
        out = []
        for x, f in poly:
            p, n = SURF.hit(P(x, f, 3.0), Vector((0, 0, -1)))
            if p is not None:
                out.append((p, n))
        return out

    for sx in (-1, 1):
        poly = [(sx * 0.79, 0.99), (sx * 0.80, 1.60), (sx * 0.76, 2.02), (sx * 0.62, 2.20)]
        pts = top_line([(lerp(a[0], b[0], i / 12), lerp(a[1], b[1], i / 12))
                        for a, b in zip(poly[:-1], poly[1:]) for i in range(12)])
        ribbon(bm, pts, 0.006, 0.0012, T)
        poly = [(sx * 0.80, -1.585), (sx * 0.80, -2.05), (sx * 0.70, -2.22)]
        pts = top_line([(lerp(a[0], b[0], i / 12), lerp(a[1], b[1], i / 12))
                        for a, b in zip(poly[:-1], poly[1:]) for i in range(12)])
        ribbon(bm, pts, 0.006, 0.0012, T)
    pts = top_line([(lerp(-0.62, 0.62, i / 30), 2.20) for i in range(31)])
    ribbon(bm, pts, 0.006, 0.0012, T)
    pts = top_line([(lerp(-0.80, 0.80, i / 30), -1.585) for i in range(31)])
    ribbon(bm, pts, 0.006, 0.0012, T)
    # Windlauf (Wasserkasten) unter der Frontscheibe
    rays = [[(P(lerp(-0.80, 0.80, i / 20), f, 3.0), Vector((0, 0, -1))) for i in range(21)] for f in (0.965, 1.02, 1.07)]
    surface_grid(bm, rays, 0.003, T)

    # Front: Grill, Rahmen, Lufteinlass, Kennzeichen
    def front_rays(x0, x1, z0, z1, nx=16, nz=4, back=False):
        d = Vector((0, 1, 0)) if not back else Vector((0, -1, 0))
        fo = 3.0 if not back else -3.0
        return [[(P(lerp(x0, x1, i / nx), fo, lerp(z0, z1, k / nz)), d) for i in range(nx + 1)] for k in range(nz + 1)]

    surface_grid(bm, front_rays(-0.56, 0.56, 0.48, 0.68, 22, 5), 0.004, T)
    for k in range(5):                       # Lamellen
        z = 0.505 + k * 0.038
        pts = []
        for i in range(21):
            p, n = SURF.hit(P(lerp(-0.54, 0.54, i / 20), 3.0, z), Vector((0, 1, 0)))
            if p is not None:
                pts.append((p, n))
        ribbon(bm, pts, 0.008, 0.009, Mt)
    pts = []
    for (x, z) in ([(lerp(-0.56, 0.56, i / 20), 0.685) for i in range(21)]):
        p, n = SURF.hit(P(x, 3.0, z), Vector((0, 1, 0)))
        if p is not None:
            pts.append((p, n))
    ribbon(bm, pts, 0.012, 0.006, Me)        # Chromleiste oben am Grill
    surface_grid(bm, front_rays(-0.72, 0.72, 0.27, 0.37, 20, 2), 0.004, T)
    surface_grid(bm, front_rays(-0.26, 0.26, 0.405, 0.505, 6, 2), 0.006, Mt)   # Kennzeichenhalter
    surface_grid(bm, front_rays(-0.245, 0.245, 0.415, 0.495, 6, 2), 0.009, Me)  # Schild (hell, leer)

    # Scheinwerfer: Strahlenfaecher aus der Wagenecke
    def corner_rays(cx, cf, z0, z1, a0, a1, nz=3, na=10):
        rows = []
        for k in range(nz + 1):
            z = lerp(z0, z1, k / nz)
            row = []
            for i in range(na + 1):
                a = math.radians(lerp(a0, a1, i / na))
                d = Vector((math.sin(a), -math.cos(a), 0))   # a=0 -> vorwaerts (-Y)
                row.append((P(cx, cf, z), d))
            rows.append(row)
        return rows

    for sx in (-1, 1):
        a0, a1 = (sx * 8, sx * 62)
        g = surface_grid(bm, corner_rays(sx * 0.50, 2.00, 0.745, 0.83, a0, a1), 0.004, T, flip=(sx < 0))
        surface_grid(bm, corner_rays(sx * 0.50, 2.00, 0.785, 0.815, sx * 12, sx * 58, 2, 10), 0.007, Lf, flip=(sx < 0))
        surface_grid(bm, corner_rays(sx * 0.50, 2.00, 0.755, 0.768, sx * 14, sx * 50, 1, 8), 0.0075, Me, flip=(sx < 0))

    # Heckleuchten + Lichtband
    def rear_corner_rays(cx, cf, z0, z1, a0, a1, nz=3, na=10):
        rows = []
        for k in range(nz + 1):
            z = lerp(z0, z1, k / nz)
            row = []
            for i in range(na + 1):
                a = math.radians(lerp(a0, a1, i / na))
                d = Vector((math.sin(a), math.cos(a), 0))    # a=0 -> rueckwaerts (+Y)
                row.append((P(cx, cf, z), d))
            rows.append(row)
        return rows

    for sx in (-1, 1):
        surface_grid(bm, rear_corner_rays(sx * 0.50, -2.05, 0.80, 0.90, sx * 4, sx * 64), 0.004, T, flip=(sx > 0))
        surface_grid(bm, rear_corner_rays(sx * 0.50, -2.05, 0.82, 0.88, sx * 6, sx * 60), 0.007, Lr, flip=(sx > 0))
    surface_grid(bm, front_rays(-0.60, 0.60, 0.845, 0.86, 24, 1, back=True), 0.006, Lr, )
    surface_grid(bm, front_rays(-0.25, 0.25, 0.56, 0.68, 6, 2, back=True), 0.006, Mt)
    surface_grid(bm, front_rays(-0.235, 0.235, 0.57, 0.67, 6, 2, back=True), 0.009, Me)
    surface_grid(bm, front_rays(-0.70, 0.70, 0.30, 0.40, 20, 2, back=True), 0.004, T)

    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.material_index in (Pa,)])
    return new_obj("Sedan_Details", bm)

# ---------------------------------------------------------------- Innenraum
def build_interior():
    bm = bmesh.new()
    I, T, Me, Mt = MI["Interior"], MI["Trim"], MI["Metal"], MI["Matte"]
    tilt = Matrix.Rotation(math.radians(-14), 3, 'X')   # Lehne nach hinten
    for sx in (-0.44, 0.44):
        rounded_box(bm, (0.50, 0.52, 0.12), P(sx, -0.02, 0.35), I, bevel=0.35)
        back = rounded_box(bm, (0.50, 0.12, 0.62), (0, 0, 0), I, bevel=0.3, rot=tilt)
        for v in back:
            v.co += P(sx, -0.30, 0.70)
        head = rounded_box(bm, (0.26, 0.10, 0.16), (0, 0, 0), I, bevel=0.4, rot=tilt)
        for v in head:
            v.co += P(sx, -0.40, 1.08)
    rounded_box(bm, (1.40, 0.50, 0.13), P(0, -1.02, 0.37), I, bevel=0.3)
    back = rounded_box(bm, (1.40, 0.14, 0.52), (0, 0, 0), I, bevel=0.25,
                       rot=Matrix.Rotation(math.radians(-20), 3, 'X'))
    for v in back:
        v.co += P(0, -1.28, 0.70)
    rounded_box(bm, (0.22, 0.95, 0.20), P(0, 0.25, 0.36), T, bevel=0.3)      # Mittelkonsole
    # Armaturenbrett: Loft quer ueber die Breite
    prof = [(0.94, 0.955), (0.78, 0.975), (0.62, 0.955), (0.57, 0.88), (0.58, 0.74), (0.70, 0.60), (0.86, 0.52)]
    rows = []
    nx = 16
    for i in range(nx + 1):
        x = lerp(-0.80, 0.80, i / nx)
        rows.append([bm.verts.new(P(x, f, z)) for (f, z) in prof])
    for i in range(nx):
        for k in range(len(prof) - 1):
            fc = bm.faces.new((rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1]))
            fc.material_index = I if k < 2 else T
    rounded_box(bm, (0.30, 0.10, 0.12), P(-0.44, 0.66, 0.99), T, bevel=0.3)   # Instrumente
    rounded_box(bm, (0.24, 0.02, 0.15), P(0.0, 0.60, 0.98), T, bevel=0.2,
                rot=Matrix.Rotation(math.radians(-12), 3, 'X'))                 # Bildschirm
    # Lenkrad (Torus) + Speichen + Saeule
    col_tilt = Matrix.Rotation(math.radians(64), 3, 'X')
    c = P(DRIVER[0], 0.40, 0.87)
    ring = bmesh.ops.create_circle(bm, cap_ends=False, segments=24, radius=0.175)
    sweep = []
    seg, tube = 24, 0.017
    vs_rows = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        cen = Vector((math.cos(a) * 0.175, math.sin(a) * 0.175, 0))
        radial = cen.normalized()
        row = []
        for k in range(8):
            b = 2 * math.pi * k / 8
            p = cen + radial * math.cos(b) * tube + Vector((0, 0, math.sin(b) * tube))
            row.append(bm.verts.new(col_tilt @ p + c))
        vs_rows.append(row)
    for i in range(seg):
        for k in range(8):
            a, b = vs_rows[i], vs_rows[(i + 1) % seg]
            fc = bm.faces.new((a[k], b[k], b[(k + 1) % 8], a[(k + 1) % 8])); fc.material_index = T
    for v in ring["verts"]:
        bm.verts.remove(v)
    hub = rounded_box(bm, (0.11, 0.11, 0.05), (0, 0, 0), T, bevel=0.4, rot=col_tilt)
    for v in hub:
        v.co += c
    for a in (math.pi, 0, -math.pi / 2):
        spoke = rounded_box(bm, (0.15, 0.03, 0.012), (0, 0, 0), Me if a == -math.pi / 2 else T, bevel=0.3,
                            rot=col_tilt @ Matrix.Rotation(a, 3, 'Z'))
        off = col_tilt @ (Matrix.Rotation(a, 3, 'Z') @ Vector((0.09, 0, 0)))
        for v in spoke:
            v.co += c + off
    colm = rounded_box(bm, (0.07, 0.07, 0.30), (0, 0, 0), T, bevel=0.3, rot=col_tilt)
    for v in colm:
        v.co += c + col_tilt @ Vector((0, 0, -0.17))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_obj("Sedan_Interior", bm)

# ---------------------------------------------------------------- Raeder
def lathe(bm, profile, segs, mi, axis_x_sign=1):
    """profile: Liste (r, x). Dreht um die X-Achse."""
    rows = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ca, sa = math.cos(a), math.sin(a)
        rows.append([bm.verts.new(Vector((x * axis_x_sign, r * ca, r * sa))) for (r, x) in profile])
    for i in range(segs):
        a, b = rows[i], rows[(i + 1) % segs]
        for k in range(len(profile) - 1):
            fc = bm.faces.new((a[k], a[k + 1], b[k + 1], b[k]))
            fc.material_index = mi
    return rows

def build_wheel(name, side):
    """side=+1: Felgenseite zeigt nach +x (rechts). Ursprung = Nabenmitte. Rollachse = lokale X."""
    bm = bmesh.new()
    Mt, Me, T = 0, 1, 2
    hw = 0.1125
    tire = [(R_RIM + 0.004, -hw + 0.012), (0.272, -hw - 0.002), (0.310, -hw + 0.004), (0.329, -hw + 0.022),
            (R_TIRE, -0.072), (R_TIRE, -0.050), (0.329, -0.044), (0.329, -0.032), (R_TIRE, -0.026),
            (R_TIRE, 0.026), (0.329, 0.032), (0.329, 0.044), (R_TIRE, 0.050), (R_TIRE, 0.072),
            (0.329, hw - 0.022), (0.310, hw - 0.004), (0.272, hw + 0.002), (R_RIM + 0.004, hw - 0.012)]
    lathe(bm, tire, 26, Mt)
    # Felgenbett + Horn
    barrel = [(0.214, -0.09), (0.226, -0.098), (R_RIM, -0.095), (R_RIM, 0.090),
              (R_RIM + 0.004, 0.100), (0.226, 0.104), (0.214, 0.094)]
    lathe(bm, barrel, 26, Me)
    # Bremsscheibe (dreht mit)
    lathe(bm, [(0.060, -0.020), (0.172, -0.020), (0.172, -0.042)], 20, Mt)
    # Nabe
    lathe(bm, [(0.0, 0.088), (0.040, 0.087), (0.056, 0.080), (0.062, 0.060), (0.064, 0.040)], 16, Me)
    # 5 Doppelspeichen mit Schuesselung
    for i in range(5):
        for off in (-0.10, 0.10):
            a = 2 * math.pi * i / 5 + off
            d = Vector((0, math.cos(a), math.sin(a)))
            t = Vector((0, -math.sin(a), math.cos(a)))
            spoke = []
            for (r, x, w) in ((0.055, 0.074, 0.020), (0.150, 0.082, 0.015), (0.218, 0.090, 0.017)):
                for s in (-1, 1):
                    for depth in (0.0, -0.022):
                        spoke.append(bm.verts.new(d * r + t * (s * w / 2 - off * r * 0.18) + Vector((x + depth, 0, 0))))
            # 3 Stationen x (2 Seiten x 2 Tiefen): Indizes st*4 + s*2 + depth
            def V(st, s, dp):
                return spoke[st * 4 + s * 2 + dp]
            for st in range(2):
                quads = [(V(st, 0, 0), V(st, 1, 0), V(st + 1, 1, 0), V(st + 1, 0, 0)),      # Front
                         (V(st, 0, 1), V(st + 1, 0, 1), V(st + 1, 1, 1), V(st, 1, 1)),      # Rueck
                         (V(st, 0, 0), V(st + 1, 0, 0), V(st + 1, 0, 1), V(st, 0, 1)),
                         (V(st, 1, 0), V(st, 1, 1), V(st + 1, 1, 1), V(st + 1, 1, 0))]
                for q in quads:
                    fc = bm.faces.new(q); fc.material_index = Me
    # Radbolzen
    for i in range(5):
        a = 2 * math.pi * (i + 0.5) / 5
        cen = Vector((0.090, math.cos(a) * 0.040, math.sin(a) * 0.040))
        sub = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.008, radius2=0.008, depth=0.012)
        bmesh.ops.rotate(bm, verts=sub["verts"], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
        bmesh.ops.translate(bm, verts=sub["verts"], vec=cen)
        for fc in {f for v in sub["verts"] for f in v.link_faces}:
            fc.material_index = Mt
    if side < 0:
        bmesh.ops.scale(bm, vec=(-1, 1, 1), verts=bm.verts)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for k in ("Matte", "Metal"):
        me.materials.append(M[k])
    return me

# ---------------------------------------------------------------- Aufbau
lower = build_lower()
boolean(lower, [
    cutter_box("cut_cabin", -CABIN["x"], CABIN["x"], CABIN["f0"], CABIN["f1"], CABIN["z0"], 2.0),
    *[cutter_cyl("cut_arch_%d_%d" % (i, s), f, s) for i, f in enumerate((AX_F, AX_R)) for s in (-1, 1)],
])
# Material nachtraeglich: Unterboden, Radhaeuser, Kabine innen
me = lower.data
for p in me.polygons:
    c = p.center
    f = -c.y
    if p.normal.z < -0.85 and c.z < 0.36:
        p.material_index = MI["Matte"]
    for ax in (AX_F, AX_R):
        if math.hypot(f - ax, c.z - (R_TIRE + 0.01)) < ARCH_R + 0.004 and abs(c.x) < 0.93:
            p.material_index = MI["Matte"]
    if abs(c.x) < CABIN["x"] + 0.003 and CABIN["f0"] - 0.003 < f < CABIN["f1"] + 0.003 and c.z > CABIN["z0"] - 0.003:
        p.material_index = MI["Interior"]

gh = build_greenhouse()
SURF = Surface([lower, gh])
details = build_details()
interior = build_interior()

# Alles Statische zu einer Karosserie zusammenfuegen
body_bm = bmesh.new()
for o in (lower, gh, details, interior):
    # alle Teile tragen die Materialien in der Reihenfolge ORDER
    names = [m.name if m else None for m in o.data.materials]
    assert names[:len(ORDER)] == [M[k].name for k in ORDER], (o.name, names)
    tmp = o.data.copy()
    body_bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
for o in (lower, gh, details, interior):
    bpy.data.objects.remove(o, do_unlink=True)
body = new_obj("Sedan_Body", body_bm)
body.data.shade_smooth()
body.data.set_sharp_from_angle(angle=math.radians(38))

root = link(bpy.data.objects.new("UrbanSedan_v1", None))
root.empty_display_type = 'ARROWS'
body.parent = root

wheel_R = build_wheel("WheelMesh_R", +1)
wheel_L = build_wheel("WheelMesh_L", -1)
for wm in (wheel_R, wheel_L):
    wm.shade_smooth(); wm.set_sharp_from_angle(angle=math.radians(40))
for tag, f, sx in (("FL", AX_F, -1), ("FR", AX_F, 1), ("RL", AX_R, -1), ("RR", AX_R, 1)):
    piv = link(bpy.data.objects.new("Steer_" + tag, None))
    piv.empty_display_type = 'PLAIN_AXES'; piv.empty_display_size = 0.2
    piv.parent = root
    piv.location = P(sx * TRACK, f, R_TIRE)
    w = link(bpy.data.objects.new("Wheel_" + tag, wheel_R if sx > 0 else wheel_L))
    w.parent = piv
seat = link(bpy.data.objects.new("DriverSeat", None))
seat.parent = root; seat.location = P(*DRIVER); seat.empty_display_type = 'SINGLE_ARROW'

root["citySwing"] = {
    "asset": "vehicle-urban-sedan-v1",
    "forward": "+Z (three.js)",
    "wheelRadius": R_TIRE,
    "wheels": ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"],
    "steerPivots": ["Steer_FL", "Steer_FR"],
    "rollAxis": "local X (positive = forward roll, like city-visuals.js updateCar)",
    "steerAxis": "local Y of Steer_* (three.js)",
    "driverSeat": {"x": DRIVER[0], "y": DRIVER[2], "z": DRIVER[1]},
    "collisionHull": {"halfWidth": 0.94, "halfLength": HALF, "roof": ROOF_Z},
    "paintMaterial": "Sedan_Paint",
    "paintVariants": {
        "neutral_graphite": [0.20, 0.215, 0.23],
        "white": [0.80, 0.80, 0.78],
        "black": [0.012, 0.013, 0.015],
        "silver": [0.55, 0.57, 0.59],
        "dark_blue": [0.025, 0.05, 0.12],
        "muted_red": [0.33, 0.045, 0.04],
    },
}
result = {"body_tris": sum(len(p.vertices) - 2 for p in body.data.polygons),
          "wheel_tris": sum(len(p.vertices) - 2 for p in wheel_R.polygons)}
mats = {}
for p in body.data.polygons:
    mats[ORDER[p.material_index]] = mats.get(ORDER[p.material_index], 0) + 1
result["faces_per_material"] = mats
result["body_name"] = body.name
