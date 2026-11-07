# CITY SWING - Web Hero Next-Gen v2: EIGENES Koerpermesh.
# Keine Geometrie aus hero.glb (Sketchfab/Marvel-Fanmodell, Lizenz ungeklaert). Grundlage ist nur das
# Mixamo-Skelett (thug.glb, 67 Gelenke) als Kompatibilitaetsreferenz fuer die vorhandenen Bewegungen.
# Form: Muskelvolumen als Metaball-Elemente entlang der echten Knochenlagen (T-Pose), verschmolzen,
# per Voxel vereinigt, geglaettet und als Quad-Netz neu aufgebaut.
import bpy, bmesh, math, os
from mathutils import Vector, Quaternion, Matrix

R = r"C:\Users\Salma\Projects\City-Swing-Blender"
S = R + r"\art\blender-nextgen"
SCENE = "Hero2"
win = bpy.context.window
sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
win.scene = sc
VL = sc.view_layers[0]
for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for mb in [m for m in bpy.data.metaballs if m.name.startswith("H2")]:
    bpy.data.metaballs.remove(mb)

def ctx():
    return bpy.context.temp_override(window=win, scene=sc, view_layer=VL, collection=sc.collection)

with ctx():
    bpy.ops.import_scene.gltf(filepath=os.path.join(R, "assets", "thug.glb"), disable_bone_shape=True)
rig = [o for o in sc.objects if o.type == 'ARMATURE'][0]
for o in [o for o in sc.objects if o.type == 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)          # thug-Netz verwerfen, nur Skelett behalten
rig.name = "WebHero2_Rig"
rig.data.name = "WebHero2_Skeleton"

def B(n, tail=False):
    b = rig.data.bones["mixamorig:" + n]
    return rig.matrix_world @ (b.tail_local if tail else b.head_local)

K = 0.574     # gemessen (Kalibrierung): Einzelelement-Oberflaeche = 0,574 * Radius (Steifigkeit 2, Schwelle 0,6)

def family(name, res):
    mb = bpy.data.metaballs.new(name)
    mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    ob = bpy.data.objects.new(name, mb)
    sc.collection.objects.link(ob)
    return mb

def ell(mb, c, sx, sy, sz, rot=None, neg=False, stiff=2.0):
    e = mb.elements.new(type='ELLIPSOID')
    e.co = Vector(c); e.radius = 1.0 / K; e.stiffness = stiff
    e.size_x, e.size_y, e.size_z = sx, sy, sz
    if rot: e.rotation = rot
    e.use_negative = neg
    return e

def cap(mb, a, b, r, stiff=2.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    e = mb.elements.new(type='CAPSULE')
    e.co = (a + b) / 2; e.radius = r / K; e.stiffness = stiff
    e.size_x = d.length / 2
    e.rotation = Vector((1, 0, 0)).rotation_difference(d.normalized())
    return e

def ball(mb, c, r, stiff=2.0):
    e = mb.elements.new(type='BALL'); e.co = Vector(c); e.radius = r / K; e.stiffness = stiff
    return e

def V(x, y, z): return Vector((x, y, z))

# ---------------------------------------------------------------- Rumpf, Kopf, Arme, Beine (eine Familie)
body = family("H2_Body", 0.0075)
hp, sp, sp1, sp2, nk, hd = B("Hips"), B("Spine"), B("Spine1"), B("Spine2"), B("Neck"), B("Head")
# Kopf (glatte Maskenform, kein Gesicht noetig), Kiefer, Hals
ell(body, V(0, 0.018, 1.688), 0.074, 0.092, 0.104)
ell(body, V(0, -0.03, 1.622), 0.054, 0.056, 0.046)
ell(body, V(0, -0.052, 1.704), 0.056, 0.016, 0.014, stiff=1.2)                      # Brauenbogen (flach)
for s in (-1, 1):
    ell(body, V(s * 0.043, -0.058, 1.655), 0.024, 0.018, 0.02, stiff=1.6)          # Wangenknochen
cap(body, V(0, 0.032, 1.49), V(0, 0.022, 1.612), 0.056)
# Trapez, Brustkorb, Brustmuskeln, Latissimus, Bauch, Becken, Gesaess
ell(body, V(0, 0.055, 1.47), 0.145, 0.062, 0.055)                                  # Trapez
ell(body, V(0, 0.018, 1.335), 0.158, 0.112, 0.15)                                  # Brustkorb
for s in (-1, 1):
    ell(body, V(s * 0.074, -0.078, 1.375), 0.088, 0.044, 0.066, rot=Quaternion((0, 1, 0), s * math.radians(-12)))   # Brust
    ell(body, V(s * 0.132, 0.045, 1.30), 0.066, 0.085, 0.13, rot=Quaternion((0, 1, 0), s * math.radians(14)))      # Latissimus
    ell(body, V(s * 0.06, -0.09, 1.075), 0.03, 0.02, 0.07, stiff=1.5)                                             # Leistenlinie
ell(body, V(0, -0.004, 1.165), 0.112, 0.09, 0.12)                                  # Taille schmaler
ell(body, V(0, -0.07, 1.19), 0.064, 0.03, 0.115)                                   # Bauchmuskeln
ell(body, V(0, 0.0, 1.0), 0.146, 0.104, 0.104)
for s in (-1, 1):
    ell(body, V(s * 0.074, 0.068, 0.952), 0.074, 0.066, 0.085)
# Arme (T-Pose: entlang +/-x, Handflaeche nach unten, Bizeps zeigt nach vorn = -y)
for s in (-1, 1):
    L = "Left" if s > 0 else "Right"
    ar, fa, hn = B(L + "Arm"), B(L + "ForeArm"), B(L + "Hand")
    ell(body, V(s * 0.21, 0.04, 1.434), 0.078, 0.068, 0.066)                       # Deltamuskel
    cap(body, ar + V(s * 0.015, 0, 0), fa - V(s * 0.01, 0, 0), 0.046)              # Oberarm
    ell(body, ar.lerp(fa, 0.52) + V(0, -0.026, 0.003), 0.072, 0.035, 0.037)        # Bizeps
    ell(body, ar.lerp(fa, 0.42) + V(0, 0.036, 0.0), 0.08, 0.034, 0.039)            # Trizeps
    ball(body, fa, 0.038)                                                          # Ellbogen
    mid = fa.lerp(hn, 0.48)
    cap(body, fa + V(s * 0.01, 0, 0), mid, 0.043)                                  # Unterarm oben
    cap(body, mid, hn - V(s * 0.012, 0, 0), 0.029)                                 # Unterarm unten
    ell(body, fa.lerp(hn, 0.25) + V(0, 0.002, 0.004), 0.07, 0.046, 0.038)          # Beuger/Strecker
    ell(body, hn + V(s * 0.004, 0, 0), 0.024, 0.031, 0.022)                        # Handgelenk
    cap(body, hn, hn + V(s * 0.03, 0.002, 0), 0.026)                               # Handansatz (unter der Manschette)
# Beine
for s in (-1, 1):
    L = "Left" if s > 0 else "Right"
    up, kn, an, toe = B(L + "UpLeg"), B(L + "Leg"), B(L + "Foot"), B(L + "ToeBase")
    cap(body, up + V(0, 0, -0.02), up.lerp(kn, 0.55), 0.079)                       # Oberschenkel oben
    cap(body, up.lerp(kn, 0.55), kn + V(0, 0, 0.03), 0.058)                         # Oberschenkel unten
    ell(body, up.lerp(kn, 0.45) + V(s * 0.008, -0.04, 0), 0.062, 0.054, 0.15)       # Quadrizeps
    ell(body, up.lerp(kn, 0.5) + V(0, 0.036, 0), 0.054, 0.048, 0.13)                # Beinbeuger
    ball(body, kn, 0.049)                                                          # Knie
    ell(body, kn + V(0, -0.038, 0.004), 0.034, 0.02, 0.036)                         # Kniescheibe
    cap(body, kn + V(0, 0, -0.02), kn.lerp(an, 0.55), 0.048)                        # Unterschenkel oben
    cap(body, kn.lerp(an, 0.55), an + V(0, 0, 0.02), 0.035)                         # Unterschenkel unten
    ell(body, kn.lerp(an, 0.28) + V(0, 0.036, 0), 0.05, 0.05, 0.1)                 # Wade
    ball(body, an, 0.036)                                                          # Knoechel
    # Fuss/Stiefel: Ferse, Mittelfuss, Zehenkappe
    ell(body, V(an.x, an.y + 0.03, 0.052), 0.044, 0.05, 0.05)
    ell(body, (an.lerp(toe, 0.6)) * 1 + V(0, 0, 0.0) - V(0, 0, (an.lerp(toe, 0.6)).z - 0.048), 0.048, 0.08, 0.046)
    ell(body, V(toe.x, toe.y - 0.03, 0.034), 0.042, 0.055, 0.034)
# Schritt freihalten (negative Elemente zwischen den Oberschenkeln)
for z in (0.62, 0.74, 0.84):
    ell(body, V(0, 0.0, z), 0.03, 0.09, 0.06, neg=True, stiff=2.5)

# ---------------------------------------------------------------- Haende (eigene Familien -> keine Schwimmhaeute)
for s in (-1, 1):
    L = "Left" if s > 0 else "Right"
    hand = family("H2_Hand" + L, 0.0032)
    hn = B(L + "Hand")
    m1 = B(L + "HandMiddle1"); i1 = B(L + "HandIndex1"); p1 = B(L + "HandPinky1")
    palm_c = hn.lerp(m1, 0.55) + V(0, 0.008, -0.002)
    ell(hand, palm_c, 0.056, 0.047, 0.017)
    ell(hand, hn.lerp(m1, 0.2) + V(0, 0.01, 0), 0.03, 0.035, 0.019)
    for f, r0 in (("Index", 0.0098), ("Middle", 0.0102), ("Ring", 0.0096), ("Pinky", 0.0086), ("Thumb", 0.0118)):
        pts = [B(L + "Hand" + f + str(k)) for k in (1, 2, 3, 4)] + [B(L + "Hand" + f + "4", tail=True)]
        if f == "Thumb":
            pts = [hn.lerp(pts[0], 0.6)] + pts
        for k in range(len(pts) - 1):
            rr = r0 * (1 - 0.1 * k / (len(pts) - 1))
            cap(hand, pts[k], pts[k + 1].lerp(pts[k], 0.06 if k == len(pts) - 2 else 0.0), rr)

# ---------------------------------------------------------------- In Netze wandeln, vereinigen, neu aufbauen
dg = bpy.context.evaluated_depsgraph_get()
parts = []
for ob in [o for o in sc.objects if o.type == 'META' and o.name.startswith("H2_") and not o.name.endswith(tuple("0123456789")) or o.type == 'META']:
    pass
mesh_objs = []
for name in ("H2_Body",):
    mob = bpy.data.objects[name]
    me = bpy.data.meshes.new_from_object(mob.evaluated_get(dg))
    o = bpy.data.objects.new(name + "_mesh", me); sc.collection.objects.link(o)
    mesh_objs.append(o)
bpy.data.objects.remove(bpy.data.objects["H2_Body"], do_unlink=True)
hand_objs = []
for name in ("H2_HandLeft", "H2_HandRight"):
    mob = bpy.data.objects[name]
    hme = bpy.data.meshes.new_from_object(mob.evaluated_get(dg))
    ho = bpy.data.objects.new(name + "_mesh", hme); sc.collection.objects.link(ho)
    bpy.data.objects.remove(mob, do_unlink=True)
    r2 = ho.modifiers.new("vox", 'REMESH'); r2.mode = 'VOXEL'; r2.voxel_size = 0.0022
    s2 = ho.modifiers.new("smooth", 'SMOOTH'); s2.factor = 0.5; s2.iterations = 3
    d2 = ho.modifiers.new("dec", 'DECIMATE'); d2.ratio = 0.06
    dgh = bpy.context.evaluated_depsgraph_get()
    hm2 = bpy.data.meshes.new_from_object(ho.evaluated_get(dgh))
    ho.modifiers.clear(); oldh = ho.data; ho.data = hm2; bpy.data.meshes.remove(oldh)
    hand_objs.append(ho)
raw = {o.name: len(o.data.polygons) for o in mesh_objs + hand_objs}
# zusammenfuehren
bm = bmesh.new()
for o in mesh_objs:
    bm.from_mesh(o.data)
for o in mesh_objs:
    bpy.data.objects.remove(o, do_unlink=True)
me = bpy.data.meshes.new("WebHero2_BodyRaw"); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new("WebHero2_Body", me); sc.collection.objects.link(ob)
# Voxel-Vereinigung (Hand an Handgelenk), Glaetten
rm = ob.modifiers.new("vox", 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.0042; rm.adaptivity = 0.0
sm = ob.modifiers.new("smooth", 'SMOOTH'); sm.factor = 0.6; sm.iterations = 4
dg = bpy.context.evaluated_depsgraph_get()
me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
ob.modifiers.clear(); old = ob.data; ob.data = me2; bpy.data.meshes.remove(old)
voxel_faces = len(ob.data.polygons)
# Fussohlen flach auf den Boden
for v in ob.data.vertices:
    if v.co.z < 0.004:
        v.co.z = 0.0
# Quad-Neuaufbau
quad_ok = False
try:
    for o in sc.objects:
        o.select_set(False, view_layer=VL)
    ob.select_set(True, view_layer=VL); VL.objects.active = ob
    with bpy.context.temp_override(window=win, scene=sc, view_layer=VL, active_object=ob, object=ob, selected_objects=[ob]):
        r = bpy.ops.object.quadriflow_remesh(target_faces=6400, use_mesh_symmetry=False, use_preserve_sharp=False,
                                             use_preserve_boundary=False, smooth_normals=True, seed=3)
    quad_ok = 'FINISHED' in r
except Exception as e:
    quad_err = str(e)
# Haende anfuegen (Handschuh: eigene Flaechen, Manschette ueberdeckt den Uebergang)
bm = bmesh.new(); bm.from_mesh(ob.data)
for ho in hand_objs:
    bm.from_mesh(ho.data)
    bpy.data.objects.remove(ho, do_unlink=True)
bm.to_mesh(ob.data); bm.free()
ob.data.shade_smooth()
ob.data.calc_loop_triangles()
result = {"raw": raw, "voxelFaces": voxel_faces, "quadriflow": quad_ok, "faces": len(ob.data.polygons),
          "tris": len(ob.data.loop_triangles), "verts": len(ob.data.vertices)}
