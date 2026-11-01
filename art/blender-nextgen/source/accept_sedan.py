# Abnahme Sedan: bauen, Gates, Blender-Renderings, .blend, GLB, Re-Import.
import bpy, math, json, os
S = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
exec(open(S + r"\source\build_sedan.py").read())
build = dict(result)
exec(open(S + r"\source\render_rig.py").read())
exec(open(S + r"\source\export_tools.py").read())

sc = bpy.data.scenes["Sedan"]
bpy.context.window.scene = sc
root = bpy.data.objects["UrbanSedan_v1"]
parts = [root] + list(root.children_recursive)
gates = gate_report([o for o in parts if o.type == 'MESH'])

# ---- Renderings (Blender EEVEE, gestellte Studioszene)
R = S + r"\renders\sedan"
os.makedirs(R, exist_ok=True)
rig_setup(sc)
sc.render.image_settings.file_format = 'JPEG'
sc.render.image_settings.quality = 90
T = (0, 0.05, 0.62)
shots = {
    "01_front": ((0, -8.6, 1.25), (0, 0, 0.62), 50),
    "02_rear": ((0, 8.6, 1.35), (0, 0, 0.62), 50),
    "03_left": ((-8.8, 0, 0.95), (0, 0, 0.68), 50),
    "04_right": ((8.8, 0, 0.95), (0, 0, 0.68), 50),
    "05_threequarter_front": ((5.2, -5.6, 2.0), (0, 0.1, 0.62), 45),
    "06_threequarter_rear": ((-4.6, 5.4, 1.7), (0, 0.0, 0.62), 45),
    "07_interior": ((-2.05, 0.35, 1.32), (-0.05, -0.30, 0.82), 30),
    "08_detail_wheel_light": ((2.6, -3.05, 0.85), (0.7, -1.7, 0.55), 55),
}
for name, (loc, tgt, lens) in shots.items():
    rig_shot(sc, os.path.join(R, name + ".jpg"), loc, tgt, lens)
# Lenkeinschlag sichtbar machen (nur fuer das Bild)
for tag in ("FL", "FR"):
    bpy.data.objects["Steer_" + tag].rotation_euler.z = math.radians(24)
rig_shot(sc, os.path.join(R, "09_steering_left.jpg"), (1.9, -5.2, 2.9), (0, -1.35, 0.35), 40)
for tag in ("FL", "FR"):
    bpy.data.objects["Steer_" + tag].rotation_euler.z = 0
# Nacht
rig_setup(sc, night=True)
sc.render.image_settings.file_format = 'JPEG'
for m, k in (("Sedan_LampFront", 6.0), ("Sedan_LampRear", 4.0)):
    bpy.data.materials[m].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = k
rig_shot(sc, os.path.join(R, "10_night_front.jpg"), (5.2, -5.6, 1.6), (0, 0.1, 0.62), 45)
rig_shot(sc, os.path.join(R, "11_night_rear.jpg"), (-4.6, 5.4, 1.5), (0, 0.0, 0.62), 45)
for m, k in (("Sedan_LampFront", 2.0), ("Sedan_LampRear", 1.2)):
    bpy.data.materials[m].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = k
rig_clear(sc)

# ---- Speichern / Export
blend_bytes = write_blend(S + r"\source\vehicle-urban-sedan-v1.blend", sc)
glb = S + r"\exports\vehicle-urban-sedan-v1.glb"
glb_bytes = export_glb(glb, [root])
expect = {o.name: tuple(o.matrix_world.translation) for o in parts if o.name.startswith(("Wheel_", "Steer_", "DriverSeat"))}
reimp = reimport_check(glb, expect)

dims = {}
from mathutils import Vector
mn = Vector((1e9,) * 3); mx = -mn
for o in parts:
    if o.type == 'MESH':
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
dims = {"length_y": mx.y - mn.y, "width_x": mx.x - mn.x, "height_z": mx.z - mn.z, "min": list(mn), "max": list(mx)}
report = {"build": build, "gates": gates, "dims": dims, "blendBytes": blend_bytes, "glbBytes": glb_bytes,
          "reimport": reimp, "renders": sorted(os.listdir(R)),
          "blenderVersion": bpy.app.version_string}
json.dump(report, open(S + r"\reports\sedan-blender.json", "w"), indent=1)
result = {k: report[k] for k in ("dims", "blendBytes", "glbBytes", "reimport")}
result["gates"] = {k: {kk: v.get(kk) for kk in ("tris", "nanVerts", "negativeScale", "nonManifoldEdges", "zeroAreaFaces", "valid")} for k, v in gates.items()}
