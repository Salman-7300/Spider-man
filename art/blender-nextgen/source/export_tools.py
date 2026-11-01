# Gemeinsame Pruef- und Exportfunktionen (Blender 5.2). Per exec geladen.
import bpy, bmesh, math, os, json
from mathutils import Vector

def deselect_all():
    for sc in bpy.data.scenes:
        for vl in sc.view_layers:
            for o in sc.objects:
                try:
                    o.select_set(False, view_layer=vl)
                except Exception:
                    pass

def gate_report(objs):
    """Harte Gates: NaN/Inf, negative Skalierung, Ursprung, nichtmanifolde Kanten, leere Gewichte."""
    rep = {}
    for o in objs:
        r = {"type": o.type, "scale": [round(v, 4) for v in o.scale]}
        r["negativeScale"] = any(v < 0 for v in o.matrix_world.to_scale()) or o.matrix_world.determinant() < 0
        if o.type == 'MESH':
            me = o.data
            bad = sum(1 for v in me.vertices if not all(math.isfinite(c) for c in v.co))
            bm = bmesh.new(); bm.from_mesh(me)
            nonman = sum(1 for e in bm.edges if not e.is_manifold)
            boundary = sum(1 for e in bm.edges if e.is_boundary)
            zero = sum(1 for f in bm.faces if f.calc_area() < 1e-10)
            bm.free()
            me.calc_loop_triangles()
            r.update({"verts": len(me.vertices), "tris": len(me.loop_triangles), "nanVerts": bad,
                      "nonManifoldEdges": nonman, "boundaryEdges": boundary, "zeroAreaFaces": zero,
                      "materials": [m.name if m else None for m in me.materials],
                      "valid": not me.validate(verbose=False)})
            if o.vertex_groups and o.find_armature():
                unw = sum(1 for v in me.vertices if sum(g.weight for g in v.groups) < 0.01)
                r["unweightedVerts"] = unw
        rep[o.name] = r
    return rep

def export_glb(path, root_objs, extra_kwargs=None):
    deselect_all()
    sel = set()
    for r in root_objs:
        sel.add(r)
        sel.update(r.children_recursive)
    vl = bpy.context.view_layer
    for o in sel:
        o.select_set(True, view_layer=vl)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, use_active_scene=True,
              export_yup=True, export_apply=True, export_extras=True, export_cameras=False,
              export_lights=False, export_materials='EXPORT', export_image_format='AUTO')
    if extra_kwargs:
        kw.update(extra_kwargs)
    bpy.ops.export_scene.gltf(**kw)
    deselect_all()
    return os.path.getsize(path)

def write_blend(path, scene):
    bpy.data.libraries.write(path, {scene}, fake_user=True, compress=True)
    return os.path.getsize(path)

def reimport_check(path, expect):
    """Re-Import in eine Wegwerf-Szene, vergleicht Objektnamen, Weltpositionen, Materialien."""
    win = bpy.context.window
    keep = win.scene
    tmp = bpy.data.scenes.new("_reimport")
    win.scene = tmp
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    got = {o.name.split(".")[0]: o for o in new}
    out = {"objects": len(new), "missing": [], "posDelta": {}, "materials": sorted({s.material.name.split(".")[0]
           for o in new if o.type == 'MESH' for s in o.material_slots if s.material})}
    for name, wpos in expect.items():
        o = got.get(name)
        if not o:
            out["missing"].append(name)
            continue
        out["posDelta"][name] = round((o.matrix_world.translation - Vector(wpos)).length, 5)
    tris = 0
    for o in new:
        if o.type == 'MESH':
            o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
    out["meshTrisAfterImport"] = tris
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    win.scene = keep
    bpy.data.scenes.remove(tmp)
    return out
