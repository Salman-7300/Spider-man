# Abnahme Enforcer: bauen, Gates, Renderings (T-Pose, Seite, Ruecken, 3/4, Angriff, Vergleich),
# Threat-Taunt-Animation auf dem vorhandenen Rig, .blend, GLB-Exporte, Re-Import.
import bpy, math, json, os
from mathutils import Vector, Matrix, Quaternion
S = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
R = r"C:\Users\Salma\Projects\City-Swing-Blender"
exec(open(S + r"\source\build_enforcer.py").read())
build = dict(result)
exec(open(S + r"\source\render_rig.py").read())
exec(open(S + r"\source\export_tools.py").read())
exec(open(S + r"\source\gltf_pose.py").read())
sc = bpy.data.scenes["Enforcer"]
rig = bpy.data.objects["Enforcer_Rig"]
body = bpy.data.objects["Enforcer_Body"]
gear = bpy.data.objects["Enforcer_Gear"]
gates = gate_report([body, gear])

def load_action(path, name):
    before_o, before_a = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path, disable_bone_shape=True)
    for o in [o for o in bpy.data.objects if o not in before_o]:
        bpy.data.objects.remove(o, do_unlink=True)
    act = [a for a in bpy.data.actions if a not in before_a][0]
    act.name = name
    clean_like_game(act)
    return act

def clean_like_game(act):
    """Wie game.js: nur Knochen-Rotationen behalten (keine Positionen, keine Skalierung, kein Objekt-Transform)."""
    for slot in act.slots:
        cb = act.layers[0].strips[0].channelbag(slot)
        if not cb:
            continue
        for fc in list(cb.fcurves):
            if not (fc.data_path.startswith("pose.bones") and fc.data_path.endswith("rotation_quaternion")):
                cb.fcurves.remove(fc)

def assign(act):
    rig.animation_data_create()
    rig.animation_data.action = act
    if act and act.slots:
        # Slot mit den meisten Knochenkurven waehlen (Slot 0 ist beim glTF-Import der Objekt-Slot)
        best = max(act.slots, key=lambda sl: len(act.layers[0].strips[0].channelbag(sl).fcurves)
                   if act.layers and act.layers[0].strips and act.layers[0].strips[0].channelbag(sl) else 0)
        rig.animation_data.action_slot = best
    rig.location = (0, 0, 0); rig.rotation_quaternion = (1, 0, 0, 0); rig.rotation_euler = (0, 0, 0)

# ---------------------------------------------------------------- Renderings
OUT = S + r"\renders\enforcer"
os.makedirs(OUT, exist_ok=True)
rig_setup(sc, target=(0, 0, 0.95))
sc.render.resolution_x = 1000; sc.render.resolution_y = 1250
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
T = (0, 0, 0.95)
for name, loc in (("01_front_tpose", (0, -4.4, 1.15)), ("02_side", (4.4, 0, 1.15)),
                  ("03_back", (0, 4.4, 1.15)), ("04_threequarter", (2.9, -3.3, 1.55))):
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), loc, T, 50)
rig_shot(sc, os.path.join(OUT, "05_detail_head_shoulder.jpg"), (0.75, -1.25, 1.62), (0.12, 0, 1.45), 55)
# Angriffspose / starke Beugung: echte Clips, so angewendet wie im Spiel (gltf_pose.py)
REST = node_rest(os.path.join(R, "assets", "thug.glb"))
AX = axis_corrections(rig, REST)
def game_pose(clip, frac):
    L, _ = clip_locals(os.path.join(R, "assets", clip), frac=frac)
    apply_locals(rig, REST, AX, L)
    bpy.context.view_layer.update()
game_pose("thug@punch.glb", 0.42)
rig_shot(sc, os.path.join(OUT, "06_attack_pose_punch.jpg"), (2.4, -3.4, 1.35), T, 50)
game_pose("thug@kick.glb", 0.40)
rig_shot(sc, os.path.join(OUT, "07_strong_bend_kick.jpg"), (3.4, -2.6, 1.25), T, 50)
game_pose("thug@idle.glb", 0.0)
rig_shot(sc, os.path.join(OUT, "07b_idle.jpg"), (2.4, -3.4, 1.35), T, 50)
for pb in rig.pose.bones:
    pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
sc.frame_set(0)
# Vorher/Nachher: alter thug daneben (gleiche Szene, gleiches Licht)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(R, "assets", "thug.glb"), disable_bone_shape=True)
old = [o for o in bpy.data.objects if o not in before]
old_root = [o for o in old if o.parent is None][0]
old_root.location.x = -1.9
rig.location.x = 0.0
rig_shot(sc, os.path.join(OUT, "00_compare_old_left_new_right.jpg"), (-0.95, -6.6, 1.2), (-0.95, 0, 0.95), 45)
for o in old:
    bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- Threat Taunt (neue Animation, vorhandenes Rig)
game_pose("thug@idle.glb", 0.0)          # Basis = erstes Idle-Bild, wie es im Spiel aussieht
BASE = {pb.name: pb.rotation_quaternion.copy() for pb in rig.pose.bones}
BONES = [pb.name for pb in rig.pose.bones if not any(k in pb.name for k in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Eye", "_End"))]
ORDER = [pb.name for pb in rig.pose.bones]          # Eltern vor Kindern

def set_base():
    for pb in rig.pose.bones:
        pb.rotation_quaternion = BASE[pb.name]
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()

def rot_about_head(pb, q):
    h = pb.matrix.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()

def aim(pb, want, w):
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(Vector(want).normalized())
    rot_about_head(pb, Quaternion().slerp(q, w))

def X(deg):
    return Quaternion((1, 0, 0), math.radians(deg))
P = lambda n: rig.pose.bones["mixamorig:" + n]

# Vorwaerts = -Y. Rechter Arm liegt auf -X.
UP_A = (-0.30, -0.82, 0.10)      # Oberarm nach vorn, leicht aussen
FORE_UP = (-0.05, -0.40, 0.92)   # Faust erhoben
FORE_PT = (-0.10, -0.97, 0.20)   # auf den Spieler zeigen
def pose(lean, arm_w, fore, nod=0.0, left=0.0):
    set_base()
    for n, k in (("Spine", 2.5), ("Spine1", 3.5), ("Spine2", 4.0)):
        rot_about_head(P(n), X(k * lean))
    rot_about_head(P("Neck"), X(-2.0 * lean))
    rot_about_head(P("Head"), X(5.0 * lean - 9.0 * nod))
    for n in ("LeftShoulder", "RightShoulder"):
        rot_about_head(P(n), X(6.0 * lean))
    if arm_w > 0:
        aim(P("RightArm"), UP_A, arm_w)
        aim(P("RightForeArm"), fore, arm_w)
    if left > 0:   # linke Faust geballt vor den Bauch
        aim(P("LeftArm"), (0.35, -0.25, -0.90), left)
        aim(P("LeftForeArm"), (-0.35, -0.85, 0.25), left)

KEYS = [  # frame, lean, arm, Unterarm, nicken, links
    (0, 0.0, 0.0, FORE_UP, 0.0, 0.0),
    (14, 1.0, 0.0, FORE_UP, 0.0, 0.25),
    (28, 1.0, 1.0, FORE_UP, 0.0, 0.45),
    (37, 1.0, 1.0, FORE_PT, 0.6, 0.45),
    (45, 1.0, 1.0, FORE_UP, 0.0, 0.45),
    (53, 1.0, 1.0, FORE_PT, 0.6, 0.45),
    (63, 0.9, 1.0, FORE_UP, 0.0, 0.40),
    (78, 0.35, 0.35, FORE_UP, 0.0, 0.15),
    (90, 0.0, 0.0, FORE_UP, 0.0, 0.0),
]
taunt = bpy.data.actions.new("threat_taunt")
assign(taunt)
for fr_, lean, aw, fore, nod, left in KEYS:
    pose(lean, aw, fore, nod, left)
    for n in BONES:
        rig.pose.bones[n].keyframe_insert("rotation_quaternion", frame=fr_)
taunt = rig.animation_data.action
taunt.name = "threat_taunt"
# Kontrolle: Start = Ende = Idle-Basis
sc.frame_set(0); a0 = {n: rig.pose.bones[n].rotation_quaternion.copy() for n in BONES}
sc.frame_set(90); a1 = {n: rig.pose.bones[n].rotation_quaternion.copy() for n in BONES}
loop_err = max(math.degrees(a0[n].rotation_difference(a1[n]).angle) for n in BONES)
base_err = max(math.degrees(a0[n].rotation_difference(BASE[n]).angle) for n in BONES)
# Taunt-Standbilder
for fr_, nm in ((14, "08_taunt_a_chest_up"), (37, "09_taunt_b_point"), (53, "10_taunt_c_point2")):
    sc.frame_set(fr_)
    rig_shot(sc, os.path.join(OUT, nm + ".jpg"), (2.2, -3.6, 1.4), T, 50)
rig_clear(sc)

# ---------------------------------------------------------------- Export
sc.frame_start, sc.frame_end = 0, 90
sc.render.fps = 30
os.makedirs(S + r"\animations", exist_ok=True)
# 1) Animationsprototyp: nur das Skelett mit der Aktion (wie assets/thug@*.glb)
anim_path = S + r"\animations\enemy-threat-taunt-v1.glb"
deselect_all()
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=anim_path, export_format='GLB', use_selection=True, use_active_scene=True,
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_force_sampling=True,
    export_frame_range=True, export_anim_single_armature=True, export_def_bones=False, export_leaf_bone=False,
    export_skins=False, export_materials='NONE', export_yup=True, export_reset_pose_bones=True)
anim_bytes = os.path.getsize(anim_path)
# 2) Modell ohne Animation, Ruhe-Pose
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
sc.frame_set(0)
glb = S + r"\exports\enemy-armored-enforcer-v1.glb"
deselect_all()
for o in (rig, body, gear):
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True,
    export_animations=False, export_def_bones=False, export_leaf_bone=False, export_skins=True,
    export_influence_nb=4, export_yup=True, export_apply=True, export_materials='EXPORT', export_image_format='AUTO')
deselect_all()
glb_bytes = os.path.getsize(glb)
# Aufraeumen der Referenz-Aktionen vor dem Speichern
blend_bytes = write_blend(S + r"\source\enemy-armored-enforcer-v1.blend", sc)
reimp = reimport_check(glb, {})
report = {"build": build, "gates": gates, "glbBytes": glb_bytes, "animBytes": anim_bytes, "blendBytes": blend_bytes,
          "reimport": reimp, "taunt": {"frames": 91, "fps": 30, "loopErrDeg": round(loop_err, 4), "startVsIdleDeg": round(base_err, 4),
          "bonesKeyed": len(BONES)}, "renders": sorted(os.listdir(OUT))}
json.dump(report, open(S + r"\reports\enforcer-blender.json", "w"), indent=1)
result = {k: report[k] for k in ("glbBytes", "animBytes", "blendBytes", "taunt", "reimport")}
result["gates"] = {k: {kk: v.get(kk) for kk in ("tris", "nanVerts", "negativeScale", "unweightedVerts", "valid", "materials")} for k, v in gates.items()}
