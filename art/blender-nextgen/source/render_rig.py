# Gemeinsames Render-Setup (Blender EEVEE): Studio-Tag, Studio-Nacht, Kameras.
# Wird von den Abnahme-Skripten per exec geladen; legt nur Objekte mit Praefix "RIG_" an.
import bpy, math
from mathutils import Vector

def rig_clear(sc):
    for o in list(sc.objects):
        if o.name.startswith("RIG_"):
            bpy.data.objects.remove(o, do_unlink=True)

def rig_world(sc, night=False):
    w = bpy.data.worlds.get("RIG_World_night" if night else "RIG_World_day") or \
        bpy.data.worlds.new("RIG_World_night" if night else "RIG_World_day")
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexGradient")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    if night:
        ramp.color_ramp.elements[0].color = (0.004, 0.005, 0.009, 1)
        ramp.color_ramp.elements[1].color = (0.02, 0.025, 0.05, 1)
        bg.inputs["Strength"].default_value = 1.0
    else:
        ramp.color_ramp.elements[0].color = (0.16, 0.165, 0.17, 1)
        ramp.color_ramp.elements[1].color = (0.34, 0.38, 0.45, 1)
        bg.inputs["Strength"].default_value = 1.0
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[1].position = 0.6
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], out.inputs[0])
    sc.world = w

def rig_floor(sc, night=False, size=40):
    me = bpy.data.meshes.get("RIG_FloorMesh")
    if not me:
        me = bpy.data.meshes.new("RIG_FloorMesh")
        s = size / 2
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    m = bpy.data.materials.get("RIG_Floor") or bpy.data.materials.new("RIG_Floor")
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (0.05, 0.05, 0.055, 1) if night else (0.16, 0.16, 0.165, 1)
    b.inputs["Roughness"].default_value = 0.55
    if not me.materials:
        me.materials.append(m)
    ob = bpy.data.objects.new("RIG_Floor", me)
    sc.collection.objects.link(ob)
    return ob

def rig_lights(sc, night=False, target=(0, 0, 0.8)):
    def sun(name, rot, energy, color=(1, 1, 1), angle=0.05):
        d = bpy.data.lights.new(name, 'SUN'); d.energy = energy; d.color = color; d.angle = angle
        o = bpy.data.objects.new(name, d); o.rotation_euler = rot; sc.collection.objects.link(o)
        return o
    def area(name, loc, energy, size, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size; d.color = color
        o = bpy.data.objects.new(name, d); o.location = loc
        sc.collection.objects.link(o)
        dirv = Vector(target) - Vector(loc)
        o.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
        return o
    if night:
        sun("RIG_Moon", (math.radians(55), 0, math.radians(-140)), 0.25, (0.55, 0.65, 1.0))
        area("RIG_Street", (3.5, 2.5, 6.0), 900, 3.0, (1.0, 0.78, 0.55))
        area("RIG_Rim", (-5, -4, 3), 250, 4.0, (0.5, 0.6, 1.0))
    else:
        sun("RIG_Sun", (math.radians(48), 0, math.radians(35)), 2.2, (1.0, 0.96, 0.9), 0.08)
        area("RIG_Key", (5, -6, 5), 450, 6.0)
        area("RIG_Fill", (-6, 4, 3.5), 180, 8.0, (0.85, 0.9, 1.0))
        area("RIG_Rim", (0, 7, 4), 300, 6.0)

def rig_camera(sc, loc, target, lens=50, name="RIG_Cam"):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.clip_start = 0.05; cd.clip_end = 200
    o = bpy.data.objects.new(name, cd); sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = o
    return o

def rig_render_settings(sc, w=1600, h=1000, samples=48):
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    try:
        sc.eevee.taa_render_samples = samples
        sc.eevee.use_shadows = True
        sc.eevee.use_raytracing = True
    except Exception:
        pass
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'

def rig_shot(sc, path, loc, target, lens=50):
    for o in list(sc.objects):
        if o.name.startswith("RIG_Cam"):
            bpy.data.objects.remove(o, do_unlink=True)
    rig_camera(sc, loc, target, lens)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=sc.name)
    return path

def rig_setup(sc, night=False, target=(0, 0, 0.8)):
    rig_clear(sc)
    rig_world(sc, night)
    rig_floor(sc, night)
    rig_lights(sc, night, target)
    rig_render_settings(sc)
