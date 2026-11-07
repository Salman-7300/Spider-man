# CITY SWING - Web Hero Next-Gen v2: vollstaendiger Aufbau.
# 1) eigenes Koerpermesh (build_hero_v2_body.py)
# 2) Skin-Gewichte vom produktionserprobten Mixamo-Koerper desselben Skeletts (thug/Vanguard, Mixamo)
# 3) UV, eigener Anzug gemalt nach Koerperlage + Gewichtszone (Navy/Anthrazit, Dunkelrot, helle Akzente)
# 4) eigene Linsen (Geometrie am Kopfknochen), Rahmen
# Keine Geometrie, Textur oder Form aus hero.glb.
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

S = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
R = r"C:\Users\Salma\Projects\City-Swing-Blender"
exec(open(S + r"\source\build_hero_v2_body.py").read())
body_info = dict(result)
body = bpy.data.objects["WebHero2_Body"]
rig = bpy.data.objects["WebHero2_Rig"]

# ---------------------------------------------------------------- 2) Gewichte vom Mixamo-Referenzkoerper
before = set(bpy.data.objects)
with ctx():
    bpy.ops.import_scene.gltf(filepath=os.path.join(R, "assets", "thug.glb"), disable_bone_shape=True)
newobjs = [o for o in bpy.data.objects if o not in before]
ref = [o for o in newobjs if o.type == 'MESH'][0]
RB = bmesh.new(); RB.from_mesh(ref.data); RB.transform(ref.matrix_world)
RB.faces.ensure_lookup_table()
RBVH = BVHTree.FromBMesh(RB)
RDEF = RB.verts.layers.deform.active
RGROUPS = [g.name for g in ref.vertex_groups]
for g in RGROUPS:
    body.vertex_groups.new(name=g)
FING = ("Thumb", "Index", "Middle", "Ring", "Pinky")
def nearest_weights(co):
    loc, nor, idx, dist = RBVH.find_nearest(co)
    f = RB.faces[idx]
    vs = list(f.verts)
    tri = vs[:3] if len(vs) == 3 else min(([vs[0], vs[i], vs[i + 1]] for i in range(1, len(vs) - 1)),
                                         key=lambda t: (sum((x.co for x in t), Vector()) / 3 - loc).length)
    w3 = barycentric_transform(loc, tri[0].co, tri[1].co, tri[2].co, Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    acc = {}
    for k, bv in enumerate(tri):
        for gi, gw in bv[RDEF].items():
            acc[gi] = acc.get(gi, 0.0) + gw * max(0.0, w3[k])
    return acc
W = {}
for v in body.data.vertices:
    W[v.index] = nearest_weights(body.matrix_world @ v.co)
# Glaetten ueber Nachbarn (2 Durchgaenge), auf 4 Einfluesse begrenzen, normieren
bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table()
nbr = {v.index: [e.other_vert(v).index for e in v.link_edges] for v in bm.verts}
bm.free()
for _ in range(2):
    W2 = {}
    for i, acc in W.items():
        out = {g: w * 0.5 for g, w in acc.items()}
        ns = nbr[i]
        for j in ns:
            for g, w in W[j].items():
                out[g] = out.get(g, 0.0) + 0.5 * w / max(1, len(ns))
        W2[i] = out
    W = W2
for i, acc in W.items():
    top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
    s_ = sum(w for _, w in top) or 1.0
    for gi, w in top:
        if w / s_ > 0.01:
            body.vertex_groups[gi].add([i], w / s_, 'REPLACE')
RB.free()
for o in newobjs:
    bpy.data.objects.remove(o, do_unlink=True)
body.parent = rig
md = body.modifiers.new("Armature", 'ARMATURE'); md.object = rig

# ---------------------------------------------------------------- 3) UV
for o in sc.objects:
    o.select_set(False, view_layer=VL)
body.select_set(True, view_layer=VL); VL.objects.active = body
with bpy.context.temp_override(window=win, scene=sc, view_layer=VL, active_object=body, object=body,
                               selected_objects=[body], edit_object=body):
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.006, area_weight=0.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
info = {"body": body_info, "uv": len(body.data.uv_layers)}
result = info
