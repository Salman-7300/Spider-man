# Abnahme Sedan v2: bauen, Gates, Blender-Renderings (+ v1|v2 gleiche Kamera), LOD0- und LOD1-Export.
import bpy, bmesh, math, json, os
from mathutils import Vector
S = r"C:\Users\Salma\Projects\City-Swing-Blender\art\blender-nextgen"
exec(open(S + r"\source\build_sedan_v2.py").read())
build = dict(result)
exec(open(S + r"\source\render_rig.py").read())
exec(open(S + r"\source\export_tools.py").read())
win = bpy.context.window
sc = bpy.data.scenes["Sedan2"]; win.scene = sc; VL = sc.view_layers[0]
root = bpy.data.objects["UrbanSedan_v2"]
parts = [root] + list(root.children_recursive)
gates = gate_report([o for o in parts if o.type == 'MESH'])

OUT = S + r"\renders\sedan-v2"
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
rig_setup(sc)
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90
shots = {
    "01_front": ((0, -8.6, 1.25), (0, 0, 0.62), 50), "02_rear": ((0, 8.6, 1.35), (0, 0, 0.62), 50),
    "03_left": ((-8.8, 0, 0.95), (0, 0, 0.68), 50), "04_right": ((8.8, 0, 0.95), (0, 0, 0.68), 50),
    "05_threequarter_front": ((5.2, -5.6, 2.0), (0, 0.1, 0.62), 45), "06_threequarter_rear": ((-4.6, 5.4, 1.7), (0, 0.0, 0.62), 45),
    "07_interior": ((-2.05, 0.35, 1.32), (-0.05, -0.30, 0.82), 30), "08_detail_front": ((2.2, -3.6, 1.05), (0.3, -2.0, 0.65), 50),
}
for name, (loc, tgt, lens) in shots.items():
    rig_shot(sc, os.path.join(OUT, name + ".jpg"), loc, tgt, lens)
for tag in ("FL", "FR"):
    bpy.data.objects["Steer_" + tag].rotation_euler.z = math.radians(24)
rig_shot(sc, os.path.join(OUT, "09_steering_left.jpg"), (1.9, -5.2, 2.9), (0, -1.35, 0.35), 40)
for tag in ("FL", "FR"):
    bpy.data.objects["Steer_" + tag].rotation_euler.z = 0
# v1 | v2 nebeneinander, gleiche Kamera und gleiches Licht
before = set(bpy.data.objects)
with bpy.context.temp_override(window=win, scene=sc, view_layer=VL, collection=sc.collection):
    bpy.ops.import_scene.gltf(filepath=S + r"\exports\vehicle-urban-sedan-v1.glb")
v1 = [o for o in bpy.data.objects if o not in before]
for o in v1:
    if o.parent is None: o.location.x -= 2.4
root.location.x = 1.2
rig_shot(sc, os.path.join(OUT, "00_compare_v1_left_v2_right_front.jpg"), (1.0, -10.5, 2.4), (-0.6, 0, 0.6), 45)
rig_shot(sc, os.path.join(OUT, "00_compare_v1_left_v2_right_rear.jpg"), (-2.2, 10.5, 2.4), (-0.6, 0, 0.6), 45)
for o in v1: bpy.data.objects.remove(o, do_unlink=True)
root.location.x = 0
rig_setup(sc, night=True)
sc.render.image_settings.file_format = 'JPEG'
for m, k in (("Sedan2_LampFront", 6.0), ("Sedan2_LampRear", 4.0)):
    bpy.data.materials[m].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = k
rig_shot(sc, os.path.join(OUT, "10_night_front.jpg"), (5.2, -5.6, 1.6), (0, 0.1, 0.62), 45)
rig_shot(sc, os.path.join(OUT, "11_night_rear.jpg"), (-4.6, 5.4, 1.5), (0, 0.0, 0.62), 45)
for m, k in (("Sedan2_LampFront", 2.0), ("Sedan2_LampRear", 1.2)):
    bpy.data.materials[m].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = k
rig_clear(sc)

# ---------------------------------------------------------------- LOD0
glb = S + r"\exports\vehicle-urban-sedan-v2.glb"
deselect_all()
with bpy.context.temp_override(window=win, scene=sc, view_layer=VL):
    for o in parts: o.select_set(True, view_layer=VL)
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, use_active_scene=True,
        export_yup=True, export_apply=True, export_extras=True, export_cameras=False, export_lights=False,
        export_materials='EXPORT', export_vertex_color='MATERIAL')
deselect_all()

# ---------------------------------------------------------------- LOD1: ohne Innenraum, Raeder fest, reduziert
body = bpy.data.objects["Sedan2_Body"]
bm = bmesh.new(); bm.from_mesh(body.data)
cab = CABIN
drop = [f for f in bm.faces if f.material_index == 1 and abs(f.calc_center_median().x) < cab["x"] - 0.01
        and cab["f0"] < -f.calc_center_median().y < cab["f1"] and cab["z0"] + 0.02 < f.calc_center_median().z < 1.30]
bmesh.ops.delete(bm, geom=drop, context='FACES')
for o in parts:
    if o.name.startswith("Wheel_"):
        w = bmesh.new(); w.from_mesh(o.data); w.transform(o.matrix_world)
        cl = w.loops.layers.color.get("Col")
        tmp = bpy.data.meshes.new("_w"); w.to_mesh(tmp); w.free()
        for p in tmp.polygons: p.material_index = 1
        bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
lme = bpy.data.meshes.new("Sedan2_LOD1"); bm.to_mesh(lme); bm.free()
for m in body.data.materials: lme.materials.append(m)
lod = bpy.data.objects.new("UrbanSedan_v2_LOD1", lme); sc.collection.objects.link(lod)
dec = lod.modifiers.new("dec", 'DECIMATE'); dec.ratio = 0.24; dec.use_collapse_triangulate = True
dg = bpy.context.evaluated_depsgraph_get()
lme2 = bpy.data.meshes.new_from_object(lod.evaluated_get(dg)); lod.modifiers.clear()
old = lod.data; lod.data = lme2; bpy.data.meshes.remove(old)
lod.data.shade_smooth(); lod.data.set_sharp_from_angle(angle=math.radians(40))
lod.location = (0, 0, 0)
glb1 = S + r"\exports\vehicle-urban-sedan-v2-lod1.glb"
deselect_all()
with bpy.context.temp_override(window=win, scene=sc, view_layer=VL):
    lod.select_set(True, view_layer=VL)
    bpy.ops.export_scene.gltf(filepath=glb1, export_format='GLB', use_selection=True, use_active_scene=True,
        export_yup=True, export_apply=True, export_materials='EXPORT', export_vertex_color='MATERIAL')
deselect_all()
lod.data.calc_loop_triangles()
lod1 = {"tris": len(lod.data.loop_triangles), "materials": [m.name for m in lod.data.materials], "bytes": os.path.getsize(glb1)}
rig_setup(sc); sc.render.image_settings.file_format = 'JPEG'
lod.location.x = 2.6; root.location.x = -1.3
rig_shot(sc, os.path.join(OUT, "12_lod0_left_lod1_right.jpg"), (1.0, -10.5, 2.6), (0.6, 0, 0.6), 45)
lod.location.x = 0; root.location.x = 0
bpy.data.objects.remove(lod, do_unlink=True)
rig_clear(sc)

blend_bytes = write_blend(S + r"\source\vehicle-urban-sedan-v2.blend", sc)
expect = {o.name: tuple(o.matrix_world.translation) for o in parts if o.name.startswith(("Wheel_", "Steer_", "DriverSeat"))}
reimp = reimport_check(glb, expect)
report = {"build": build, "gates": gates, "glbBytes": os.path.getsize(glb), "blendBytes": blend_bytes, "lod1": lod1,
          "reimport": reimp, "renders": sorted(os.listdir(OUT))}
json.dump(report, open(S + r"\reports\sedan2-blender.json", "w"), indent=1)
result = {k: report[k] for k in ("build", "glbBytes", "lod1", "reimport")}
