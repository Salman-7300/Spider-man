# Abnahme Enforcer v2: bauen, Gates, Blender-Renderings (alle Ansichten, Spielposen wie im Spiel),
# Vorher/Nachher v1|v2 in identischer Pose, Kamera und Licht, .blend, GLB, Re-Import.
import bpy, math, json, os
from mathutils import Vector
S = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
R = r"C:\Users\Salma\Projects\City-Swing-Blender"
exec(open(S + r"\source\build_enforcer_v2.py").read())
build = dict(result)
exec(open(S + r"\source\render_rig.py").read())
exec(open(S + r"\source\export_tools.py").read())
exec(open(S + r"\source\gltf_pose.py").read())
sc = bpy.data.scenes["Enforcer2"]
win = bpy.context.window
win.scene = sc
rig = bpy.data.objects["Enforcer2_Rig"]
body = bpy.data.objects["Enforcer2_Body"]
gear = bpy.data.objects["Enforcer2_Gear"]
gates = gate_report([body, gear])

def height(objs):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    lo, hi = 1e9, -1e9
    for o in objs:
        e = o.evaluated_get(dg); m = e.to_mesh()
        for v in m.vertices:
            z = (e.matrix_world @ v.co).z; lo = min(lo, z); hi = max(hi, z)
        e.to_mesh_clear()
    return lo, hi

REST = node_rest(os.path.join(R, "assets", "thug.glb"))
AX = axis_corrections(rig, REST)
CLIP = lambda n: os.path.join(R, "assets", "thug@" + n + ".glb")
def game_pose(r, ax, clip, frac):
    L, _ = clip_locals(CLIP(clip), frac=frac)
    apply_locals(r, REST, ax, L)
    bpy.context.view_layer.update()
def rest_pose(r):
    for pb in r.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    bpy.context.view_layer.update()

lo, hi = height([body, gear])
size = {"v2_bind_height": round(hi - lo, 4)}

OUT = S + r"\renders\enforcer-v2"
os.makedirs(OUT, exist_ok=True)
rig_setup(sc, target=(0, 0, 0.95))
sc.render.resolution_x = 1000; sc.render.resolution_y = 1250
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
T = (0, 0, 0.95)
game_pose(rig, AX, "idle", 0.0)
for name, loc in (("01_front", (0, -4.4, 1.15)), ("02_back", (0, 4.4, 1.15)),
                  ("03_side", (4.4, 0, 1.15)), ("04_threequarter", (2.9, -3.3, 1.55))):
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), loc, T, 50)
rig_shot(sc, os.path.join(OUT, "05_detail_head.jpg"), (0.55, -1.15, 1.70), (0.0, 0, 1.58), 60)
rig_shot(sc, os.path.join(OUT, "06_detail_material_vest_shoulder.jpg"), (0.85, -1.05, 1.38), (0.12, 0, 1.25), 60)
POSES = [("07_idle", "idle", 0.0, (2.4, -3.4, 1.35)), ("08_walk", "walk", 0.3, (3.4, -2.4, 1.2)),
         ("09_run", "run", 0.25, (3.4, -2.4, 1.2)), ("10_punch", "punch", 0.42, (2.4, -3.4, 1.35)),
         ("11_kick_high", "kick", 0.40, (3.4, -2.6, 1.25)), ("12_block", "block", 0.4, (2.4, -3.4, 1.35)),
         ("13_hit", "hit", 0.3, (2.4, -3.4, 1.35)), ("14_uppercut_heavy", "uppercut", 0.45, (3.0, -3.0, 1.3))]
for name, clip, frac, cam in POSES:
    game_pose(rig, AX, clip, frac)
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), cam, T, 50)

# ---------------------------------------------------------------- Vorher/Nachher (v1 links, v2 rechts)
before = set(bpy.data.objects)
with bpy.context.temp_override(window=win, scene=sc, view_layer=sc.view_layers[0], collection=sc.collection):
    bpy.ops.import_scene.gltf(filepath=S + r"\exports\enemy-armored-enforcer-v1.glb", disable_bone_shape=True)
v1 = [o for o in bpy.data.objects if o not in before]
v1rig = [o for o in v1 if o.type == 'ARMATURE'][0]
v1root = [o for o in v1 if o.parent is None]
for o in v1root:
    o.location.x -= 1.1
rig.location.x = 0.55
AX1 = axis_corrections(v1rig, REST)
for name, clip, frac, cam in (("00_compare_idle_front", "idle", 0.0, (-0.27, -5.6, 1.25)),
                              ("00_compare_idle_back", "idle", 0.0, (-0.27, 5.6, 1.25)),
                              ("00_compare_kick", "kick", 0.40, (-0.27, -5.6, 1.25)),
                              ("00_compare_punch", "punch", 0.42, (-0.27, -5.6, 1.25))):
    game_pose(rig, AX, clip, frac); game_pose(v1rig, AX1, clip, frac)
    tgt = (-0.27, cam[1] * 0.0, 0.95)
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), cam, tgt, 45)
# Hoehe v1 zum Vergleich (Bind-Pose)
rest_pose(v1rig)
v1lo, v1hi = height([o for o in v1 if o.type == 'MESH'])
size["v1_bind_height"] = round(v1hi - v1lo, 4)
size["thug_bind_height"] = 1.7898
for o in v1:
    bpy.data.objects.remove(o, do_unlink=True)
rig.location.x = 0.0
rig_clear(sc)

# ---------------------------------------------------------------- Export
rest_pose(rig)
glb = S + r"\exports\enemy-armored-enforcer-v2.glb"
vl = sc.view_layers[0]
deselect_all()
with bpy.context.temp_override(window=win, scene=sc, view_layer=vl):
    for o in (rig, body, gear):
        o.select_set(True, view_layer=vl)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True,
        export_animations=False, export_def_bones=False, export_leaf_bone=False, export_skins=True,
        export_influence_nb=4, export_yup=True, export_apply=True, export_materials='EXPORT',
        export_image_format='AUTO', export_image_quality=88)
deselect_all()
glb_bytes = os.path.getsize(glb)
blend_bytes = write_blend(S + r"\source\enemy-armored-enforcer-v2.blend", sc)
reimp = reimport_check(glb, {})
report = {"build": build, "gates": gates, "glbBytes": glb_bytes, "blendBytes": blend_bytes, "size": size,
          "reimport": reimp, "renders": sorted(os.listdir(OUT))}
json.dump(report, open(S + r"\reports\enforcer2-blender.json", "w"), indent=1)
result = {k: report[k] for k in ("glbBytes", "blendBytes", "size", "reimport")}
result["build"] = build
result["gates"] = {k: {kk: v.get(kk) for kk in ("tris", "nanVerts", "negativeScale", "unweightedVerts", "valid", "materials")} for k, v in gates.items()}
