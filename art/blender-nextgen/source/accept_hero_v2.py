# Abnahme Web Hero v2: Aufbau, Gates, Renderings (Ansichten, Maske, Material, Spielposen wie im Spiel,
# v1|v2-Vergleich in identischer Pose), .blend, GLB-Export, Re-Import.
import bpy, math, json, os
from mathutils import Vector
S = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
R = r"C:\Users\Salma\Projects\City-Swing-Blender"
exec(open(S + r"\source\build_hero_v2.py").read())
exec(open(S + r"\source\build_hero_v2_suit.py").read())
build = dict(result)
exec(open(S + r"\source\render_rig.py").read())
exec(open(S + r"\source\export_tools.py").read())
exec(open(S + r"\source\gltf_pose.py").read())
win = bpy.context.window
sc = bpy.data.scenes["Hero2"]; win.scene = sc; VL = sc.view_layers[0]
rig = bpy.data.objects["WebHero2_Rig"]; body = bpy.data.objects["WebHero2_Body"]
gates = gate_report([body])
REST = node_rest(os.path.join(R, "assets", "thug.glb"))
AX = axis_corrections(rig, REST)

def bbox(objs):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9,) * 3); mx = -mn
    for o in objs:
        e = o.evaluated_get(dg); m = e.to_mesh()
        for v in m.vertices:
            w = e.matrix_world @ v.co
            for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
        e.to_mesh_clear()
    return mn, mx
def ground(root, objs):
    mn, mx = bbox(objs); root.location.z -= mn.z; bpy.context.view_layer.update()
def pose(r, rest, ax, clip, frac):
    L, _ = clip_locals(os.path.join(R, "assets", "hero@" + clip + ".glb"), frac=frac)
    apply_locals(r, rest, ax, L); bpy.context.view_layer.update()
def rest_pose(r):
    for pb in r.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    bpy.context.view_layer.update()

mn, mx = bbox([body]); size = {"bind_height": round(mx.z - mn.z, 4)}
OUT = S + r"\renders\hero-v2"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
rig_setup(sc, target=(0, 0, 0.95))
sc.render.resolution_x = 1000; sc.render.resolution_y = 1250
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
T = (0, 0, 0.95)
pose(rig, REST, AX, "idle", 0.0); ground(rig, [body])
for name, loc in (("01_front", (0, -4.3, 1.15)), ("02_back", (0, 4.3, 1.15)), ("03_side", (4.3, 0, 1.15)),
                  ("04_threequarter", (2.8, -3.2, 1.5))):
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), loc, T, 50)
mn, mx = bbox([body]); hz = mx.z - 0.12
rig_shot(sc, os.path.join(OUT, "05_detail_mask.jpg"), (0.22, -0.82, hz + 0.04), (0, 0, hz), 80)
rig_shot(sc, os.path.join(OUT, "06_detail_material_chest.jpg"), (0.35, -0.95, 1.35), (0, 0, 1.28), 70)
POSES = [("07_idle", "idle", 0.0, (2.4, -3.4, 0.4)), ("08_run", "run", 0.25, (3.4, -2.4, 0.3)),
         ("09_combat_punch", "punch", 0.42, (2.4, -3.4, 0.4)), ("10_combat_kick", "kick", 0.40, (3.4, -2.6, 0.3)),
         ("11_strong_bend_roll", "roll", 0.40, (3.4, -2.4, 0.2)), ("12_swing", "swing", 0.30, (3.0, -3.0, 0.4)),
         ("13_climb", "klettern", 0.30, (2.2, 3.2, 0.4)), ("14_glide", "gleiten", 0.50, (3.0, -3.0, 0.8)),
         ("15_dive_w", "sturzflug2", 0.5, (3.0, -3.0, 0.8)), ("16_zip", "zip_zug", 0.5, (3.0, -3.0, 0.4)),
         ("17_landing", "land", 0.18, (3.0, -2.8, 0.3)), ("18_uppercut", "uppercut", 0.45, (2.8, -3.0, 0.4)),
         ("19_wallrun", "wandlauf", 0.5, (3.0, -2.8, 0.4))]
for name, clip, frac, cam in POSES:
    rig.location = (0, 0, 0); pose(rig, REST, AX, clip, frac); ground(rig, [body])
    mn, mx = bbox([body]); c = (mn + mx) / 2
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), (c.x + cam[0], c.y + cam[1], c.z + cam[2]), tuple(c), 45)

# ---------------------------------------------------------------- v1 | v2 (Spiel-Normierung: beide 1,76 m), gleiche Pose
rig.location = (0, 0, 0)
before = set(bpy.data.objects)
with bpy.context.temp_override(window=win, scene=sc, view_layer=VL, collection=sc.collection):
    bpy.ops.import_scene.gltf(filepath=S + r"\exports\webhero-nextgen-v1.glb", disable_bone_shape=True)
v1 = [o for o in bpy.data.objects if o not in before]
v1rig = [o for o in v1 if o.type == 'ARMATURE'][0]; v1m = [o for o in v1 if o.type == 'MESH']
v1root = bpy.data.objects.new("H2_v1root", None); sc.collection.objects.link(v1root)
for o in v1:
    if o.parent is None: o.parent = v1root
REST1 = bind_rest(S + r"\exports\webhero-nextgen-v1.glb"); AX1 = axis_corrections(v1rig, REST1)
NODE1 = {k: v[0] for k, v in node_rest(S + r"\exports\webhero-nextgen-v1.glb").items()}
apply_locals(v1rig, REST1, AX1, NODE1)
mn1, mx1 = bbox(v1m); s1 = 1.76 / (mx1.z - mn1.z); v1root.scale = (s1, s1, s1)
rest_pose(rig); mn2, mx2 = bbox([body]); s2 = 1.76 / (mx2.z - mn2.z); rig.scale = (s2, s2, s2)
def place(clip, frac):
    for r, rr, ax, root, ms, x in ((v1rig, REST1, AX1, v1root, v1m, -0.6), (rig, REST, AX, rig, [body], 0.6)):
        if clip: pose(r, rr, ax, clip, frac)
        else:
            if r is v1rig: apply_locals(v1rig, REST1, AX1, NODE1)
            else: rest_pose(rig)
        bpy.context.view_layer.update()
        mn, mx = bbox(ms); root.location += Vector((x - (mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))
        bpy.context.view_layer.update()
for name, clip, frac in (("00_compare_bind", None, 0), ("00_compare_idle", "idle", 0.0), ("00_compare_run", "run", 0.25),
                         ("00_compare_swing", "swing", 0.3), ("00_compare_kick", "kick", 0.4)):
    place(clip, frac)
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), (0, -5.4, 1.15), (0, 0, 0.92), 45)
for o in v1 + [v1root]:
    bpy.data.objects.remove(o, do_unlink=True)
rig.scale = (1, 1, 1); rig.location = (0, 0, 0)
rig_clear(sc)

# ---------------------------------------------------------------- Export
rest_pose(rig)
glb = S + r"\exports\webhero-nextgen-v2.glb"
deselect_all()
with bpy.context.temp_override(window=win, scene=sc, view_layer=VL):
    for o in (rig, body):
        o.select_set(True, view_layer=VL)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True,
        export_animations=False, export_def_bones=False, export_leaf_bone=False, export_skins=True,
        export_influence_nb=4, export_yup=True, export_apply=True, export_materials='EXPORT',
        export_image_format='JPEG', export_image_quality=90)
deselect_all()
glb_bytes = os.path.getsize(glb)
blend_bytes = write_blend(S + r"\source\webhero-nextgen-v2.blend", sc)
reimp = reimport_check(glb, {})
report = {"build": build, "body": build_info if 'build_info' in dir() else None, "gates": gates, "size": size,
          "glbBytes": glb_bytes, "blendBytes": blend_bytes, "reimport": reimp, "renders": sorted(os.listdir(OUT))}
json.dump(report, open(S + r"\reports\hero2-blender.json", "w"), indent=1)
result = {k: report[k] for k in ("size", "glbBytes", "blendBytes", "reimport")}
result["gates"] = {k: {kk: v.get(kk) for kk in ("tris", "nanVerts", "negativeScale", "unweightedVerts", "valid", "materials")} for k, v in gates.items()}
