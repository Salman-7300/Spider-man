# Abnahme Web Hero Next-Gen: exportiertes GLB in Blender pruefen und rendern, Vergleich mit hero.glb,
# Posen exakt wie im Spiel (gltf_pose.py), neue Animation "Hero Landing Pose", .blend.
import bpy, math, json, os
from mathutils import Vector, Quaternion, Matrix
S = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
R = r"C:\Users\Salma\Projects\City-Swing-Blender"
exec(open(S + r"\source\render_rig.py").read())
exec(open(S + r"\source\export_tools.py").read())
exec(open(S + r"\source\gltf_pose.py").read())
A_DIR = os.path.join(R, "assets")
NEW = S + r"\exports\webhero-nextgen-v1.glb"

win = bpy.context.window
sc = bpy.data.scenes.get("Hero") or bpy.data.scenes.new("Hero")
win.scene = sc
for o in list(sc.objects):
    bpy.data.objects.remove(o, do_unlink=True)

def load(path, tag):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path, disable_bone_shape=True)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new("WH_Root_" + tag, None)
    sc.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    rig = [o for o in new if o.type == 'ARMATURE'][0]
    meshes = [o for o in new if o.type == 'MESH']
    return root, rig, meshes

def bbox(meshes):
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9,) * 3); mx = -mn
    for o in meshes:
        e = o.evaluated_get(dg); m = e.to_mesh()
        for v in m.vertices:
            w = e.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
        e.to_mesh_clear()
    return mn, mx

def normalize(root, meshes, x=0.0):
    """Wie messeModell im Spiel: Bind-Pose auf 1,76 m, Mitte auf den Ursprung, Fuesse auf den Boden."""
    bpy.context.view_layer.update()
    mn, mx = bbox(meshes)
    s = 1.76 / (mx.z - mn.z)
    root.scale = root.scale * s
    bpy.context.view_layer.update()
    mn, mx = bbox(meshes)
    root.location += Vector((x - (mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))
    bpy.context.view_layer.update()
    return s

def ground(root, meshes):
    bpy.context.view_layer.update()
    mn, _ = bbox(meshes)
    root.location.z -= mn.z
    bpy.context.view_layer.update()

root, rig, meshes = load(NEW, "new")
for m in meshes:
    m.name = "WH_" + m.data.materials[0].name
scale = normalize(root, meshes)
gates = gate_report(meshes)
REST = bind_rest(NEW)
AX = axis_corrections(rig, REST)
def game_pose(clip, frac=None, t=None):
    L, d = clip_locals(os.path.join(A_DIR, clip), t=t, frac=frac)
    apply_locals(rig, REST, AX, L)
    bpy.context.view_layer.update()
    ground(root, meshes)
    return L
NODE_REST = {k: v[0] for k, v in node_rest(NEW).items()}
def rest_pose():
    # Die Bind-Pose dieses Modells liegt waagerecht (Sketchfab-Ausrichtung); die stehende Grundhaltung
    # ist die Knoten-Ruhe der Datei -> genau diese wieder anlegen (nicht Identitaet).
    apply_locals(rig, REST, AX, NODE_REST)
    bpy.context.view_layer.update()
    normalize(root, meshes)

OUT = S + r"\renders\hero"
os.makedirs(OUT, exist_ok=True)
rig_setup(sc, target=(0, 0, 0.95))
sc.render.resolution_x = 1000; sc.render.resolution_y = 1250
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
T = (0, 0, 0.92)
# Bind-Pose
for name, loc in (("01_front_bind", (0, -4.3, 1.1)), ("02_side", (4.3, 0, 1.1)),
                  ("03_back", (0, 4.3, 1.1)), ("04_threequarter", (2.8, -3.2, 1.45))):
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), loc, T, 50)
mn, mx = bbox(meshes)
headz = mx.z - 0.13
rig_shot(sc, os.path.join(OUT, "05_detail_mask.jpg"), (0.25, -0.95, headz + 0.05), (0, 0, headz), 70)
# Posen wie im Spiel
for name, clip, frac, cam in (("06_idle", "hero@idle.glb", 0.0, (2.4, -3.4, 1.3)),
                              ("07_walk", "hero@walk.glb", 0.3, (3.4, -2.4, 1.2)),
                              ("08_run", "hero@run.glb", 0.25, (3.4, -2.4, 1.2)),
                              ("09_combat_punch", "hero@punch.glb", 0.42, (2.4, -3.4, 1.3)),
                              ("10_combat_kick", "hero@kick.glb", 0.40, (3.4, -2.6, 1.2)),
                              ("11_strong_bend_roll", "hero@roll.glb", 0.40, (3.4, -2.4, 1.0)),
                              ("12_swing", "hero@swing.glb", 0.30, (3.0, -3.0, 1.3)),
                              ("13_climb", "hero@klettern.glb", 0.30, (2.2, 3.2, 1.3)),
                              ("14_glide", "hero@gleiten.glb", 0.50, (3.0, -3.0, 1.6)),
                              ("15_dive_sturzflug", "hero@sturzflug.glb", 0.0, (3.0, -3.0, 1.6))):
    game_pose(clip, frac=frac)
    mn, mx = bbox(meshes)
    c = (mn + mx) / 2
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), (c.x + cam[0], c.y + cam[1], c.z + cam[2] - 0.92), tuple(c), 50)
# Vorher/Nachher (Bind-Pose und Lauf), gleiches Licht
rest_pose()
oroot, orig, omeshes = load(os.path.join(A_DIR, "hero.glb"), "old")
OREST = bind_rest(os.path.join(A_DIR, "hero.glb"))
OAX = axis_corrections(orig, OREST)
apply_locals(orig, OREST, OAX, {k: v[0] for k, v in node_rest(os.path.join(A_DIR, "hero.glb")).items()})
normalize(oroot, omeshes, x=-1.2)
normalize(root, meshes, x=0.6)
rig_shot(sc, os.path.join(OUT, "00_compare_old_left_new_right.jpg"), (-0.3, -5.6, 1.2), (-0.3, 0, 0.92), 45)
L, _ = clip_locals(os.path.join(A_DIR, "hero@run.glb"), frac=0.25)
apply_locals(orig, OREST, OAX, L); ground(oroot, omeshes)
game_pose("hero@run.glb", frac=0.25)
rig_shot(sc, os.path.join(OUT, "00b_compare_run.jpg"), (-0.3, -5.6, 1.2), (-0.3, 0, 0.92), 45)
for o in [oroot] + list(oroot.children_recursive):
    bpy.data.objects.remove(o, do_unlink=True)
normalize(root, meshes)

# ---------------------------------------------------------------- Hero Landing Pose (neue Animation)
# Aus echten Spielposen zusammengesetzt (glTF-Lokalrotationen) + gezielte Korrekturen:
# Fall -> Aufprall in tiefer Hocke, rechte Faust am Boden, linker Arm zur Balance nach hinten,
# Blick nach vorn -> kurzes Halten -> kontrolliertes Aufrichten -> exakt erstes Idle-Bild.
L_fall, _ = clip_locals(os.path.join(A_DIR, "hero@fall.glb"), frac=0.5)
# tiefste Hocke im echten Lande-Clip suchen (Huefte am naechsten ueber den Zehen)
best = None
for i in range(0, 31):
    Li, _ = clip_locals(os.path.join(A_DIR, "hero@land.glb"), frac=i / 50)
    apply_locals(rig, REST, AX, Li); bpy.context.view_layer.update()
    hz = (rig.matrix_world @ next(pb for pb in rig.pose.bones if norm(pb.name) == "mixamorigHips").head).z
    tz = min((rig.matrix_world @ pb.head).z for pb in rig.pose.bones if norm(pb.name).endswith("ToeBase"))
    if best is None or hz - tz < best[0]:
        best = (hz - tz, i / 50, Li)
LAND_FRAC, L_land = best[1], best[2]
L_idle, _ = clip_locals(os.path.join(A_DIR, "hero@idle.glb"), t=0.0)
def mix(La, Lb, w):
    return {k: La[k].slerp(Lb.get(k, La[k]), w) for k in La}
P = lambda n: next(pb for pb in rig.pose.bones if norm(pb.name) == "mixamorig" + n)
def rot_about_head(pb, q):
    h = pb.matrix.translation.copy()
    pb.matrix = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()
def aim(pb, want, w):
    if w <= 0: return
    # Richtungen in "Figurraum": vorne = Blickrichtung des Rigs
    m = rig.matrix_world.to_3x3().normalized()
    want_w = (FWD * want[1] + SIDE * want[0] + UPV * want[2]).normalized()
    cur = (rig.matrix_world @ pb.tail - rig.matrix_world @ pb.head).normalized()
    q = cur.rotation_difference(want_w)
    q_arm = m.to_quaternion().inverted() @ q @ m.to_quaternion()
    rot_about_head(pb, Quaternion().slerp(q_arm, w))
apply_locals(rig, REST, AX, L_idle); bpy.context.view_layer.update()
# Blickrichtung aus dem Rig: Zehen vor dem Knoechel
toe = rig.matrix_world @ P("LeftToeBase").head; ank = rig.matrix_world @ P("LeftFoot").head
FWD = Vector((toe.x - ank.x, toe.y - ank.y, 0)).normalized()
UPV = Vector((0, 0, 1)); SIDE = FWD.cross(UPV).normalized() * -1      # +SIDE = linke Koerperseite
side_check = (rig.matrix_world @ P("LeftArm").head - rig.matrix_world @ P("RightArm").head).dot(SIDE)
if side_check < 0: SIDE = -SIDE

def landing(w_land, hand, look=0.0):
    apply_locals(rig, REST, AX, mix(L_land, L_idle, 0) if w_land >= 1 else mix(L_idle, L_land, w_land))
    bpy.context.view_layer.update()
    aim(P("RightArm"), (-0.25, 0.35, -0.90), hand)          # rechter Arm nach vorn-unten
    aim(P("RightForeArm"), (-0.05, 0.15, -0.99), hand)      # Faust zum Boden
    aim(P("LeftArm"), (0.75, -0.45, -0.10), hand * 0.9)     # linker Arm seitlich nach hinten
    aim(P("LeftForeArm"), (0.80, -0.55, 0.10), hand * 0.9)
    if look:
        rot_about_head(P("Head"), Quaternion(SIDE, math.radians(-14 * look)))
KEYS = []
def key(frame, fn):
    fn()
    for pb in rig.pose.bones:
        n = norm(pb.name)
        if any(k in n for k in ("Thumb", "Index", "Middle", "Ring", "Pinky", "_End")): continue
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    KEYS.append(frame)
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
rig.animation_data_create()
act = bpy.data.actions.new("landing_pose")
rig.animation_data.action = act
key(0, lambda: (apply_locals(rig, REST, AX, L_fall), bpy.context.view_layer.update()))
key(7, lambda: landing(1.0, 1.0, 1.0))
key(12, lambda: landing(1.0, 1.0, 1.0))     # Aufprall halten (Schwerpunkt tief)
key(26, lambda: landing(1.0, 0.85, 0.6))
key(44, lambda: landing(0.45, 0.25, 0.0))   # Aufrichten
key(62, lambda: (apply_locals(rig, REST, AX, L_idle), bpy.context.view_layer.update()))
act = rig.animation_data.action
end_err = 0.0
sc.frame_set(62)
for pb in rig.pose.bones:
    n = norm(pb.name)
    if n in L_idle and pb.name in AX:
        want = AX[pb.name].inverted() @ REST[n][0].inverted() @ L_idle[n] @ AX[pb.name]
        end_err = max(end_err, math.degrees(want.rotation_difference(pb.rotation_quaternion).angle))
for fr_, nm in ((0, "16_landing_a_fall"), (9, "17_landing_b_impact"), (26, "18_landing_c_hold"), (44, "19_landing_d_rise")):
    sc.frame_set(fr_); ground(root, meshes)
    mn, mx = bbox(meshes); c = (mn + mx) / 2
    rig_shot(sc, os.path.join(OUT, nm + ".jpg"), (c.x + 2.6, c.y - 3.0, 1.1), (c.x, c.y, max(0.55, c.z)), 50)
rig_clear(sc)
sc.frame_start, sc.frame_end = 0, 62
sc.render.fps = 30
anim_path = S + r"\animations\webhero-landing-pose-v1.glb"
deselect_all(); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=anim_path, export_format='GLB', use_selection=True, use_active_scene=True,
    export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_force_sampling=True,
    export_frame_range=True, export_def_bones=False, export_leaf_bone=False, export_skins=False,
    export_materials='NONE', export_yup=True)
deselect_all()
rig.animation_data.action = None
rest_pose()
blend_bytes = write_blend(S + r"\source\webhero-nextgen-v1.blend", sc)
report = {"gates": gates, "normalizeScale": scale, "animBytes": os.path.getsize(anim_path), "blendBytes": blend_bytes,
          "landing": {"frames": 63, "fps": 30, "landFrac": LAND_FRAC, "endVsIdleDeg": round(end_err, 4), "keys": KEYS}, "renders": sorted(os.listdir(OUT))}
json.dump(report, open(S + r"\reports\hero-blender.json", "w"), indent=1)
result = {k: report[k] for k in ("animBytes", "blendBytes", "landing")}
result["gates"] = {k: {kk: v.get(kk) for kk in ("tris", "nanVerts", "negativeScale", "unweightedVerts", "valid")} for k, v in gates.items()}
