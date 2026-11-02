# glTF-Posen exakt so auf ein importiertes Rig legen, wie das SPIEL sie anwendet.
# Das Spiel (three.js) schreibt die lokalen Rotationen eines Clips direkt in die Knoten des
# Modells (Positionen/Finger werden verworfen). Blender-Aktionen aus einem Clip-Import sind
# dagegen relativ zur Ruhe-Pose der CLIP-Datei - die weicht beim thug um bis zu 20 Grad ab.
# Hier: node_local = N_rest * A * P * A^-1  ->  P = A^-1 * N_rest^-1 * L * A
# mit A = Achsenkorrektur Knochen <-> Knoten (vom glTF-Importer), aus Daten berechnet.
import json, struct, math
from mathutils import Quaternion, Matrix

def read_glb(path):
    data = open(path, "rb").read()
    off, js, bn = 12, None, None
    while off < len(data):
        size, typ = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + size]
        if typ == 0x4E4F534A: js = json.loads(chunk)
        elif typ == 0x004E4942: bn = chunk
        off += 8 + size
    return js, bn

def norm(n):
    import re
    return re.sub(r"_\d+(?=\.|$)", "", re.sub(r"^mixamorig\d*:?", "mixamorig", n or "", flags=re.I))

def q_gl(xyzw):
    x, y, z, w = xyzw
    return Quaternion((w, x, y, z))

def accessor(js, bn, i):
    a = js["accessors"][i]; v = js["bufferViews"][a["bufferView"]]
    n = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[a["type"]]
    base = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride", 4 * n)
    return [struct.unpack_from("<%df" % n, bn, base + k * stride) for k in range(a["count"])]

def node_rest(path):
    js, _ = read_glb(path)
    par = {}
    for i, nd in enumerate(js["nodes"]):
        for c in nd.get("children", []): par[c] = i
    loc = {i: q_gl(nd.get("rotation", [0, 0, 0, 1])) for i, nd in enumerate(js["nodes"])}
    def world(i):
        q = loc[i]
        while i in par:
            i = par[i]; q = loc[i] @ q
        return q
    out = {}
    for i, nd in enumerate(js["nodes"]):
        out[norm(nd.get("name"))] = (loc[i], world(i))
    return out

def clip_locals(path, t=None, frac=None):
    """Lokale Rotationen (nur Rotation, ohne Finger) zum Zeitpunkt t oder Anteil frac."""
    js, bn = read_glb(path)
    an = js["animations"][0]
    out, dur = {}, 0
    tracks = []
    for ch in an["channels"]:
        if ch["target"]["path"] != "rotation": continue
        s = an["samplers"][ch["sampler"]]
        times = [v[0] for v in accessor(js, bn, s["input"])]
        vals = accessor(js, bn, s["output"])
        dur = max(dur, times[-1])
        tracks.append((norm(js["nodes"][ch["target"]["node"]]["name"]), times, vals))
    if t is None: t = dur * (frac or 0)
    for name, times, vals in tracks:
        if any(k in name for k in ("Thumb", "Index", "Middle", "Ring", "Pinky")): continue
        k = 0
        while k + 1 < len(times) and times[k + 1] <= t: k += 1
        if k + 1 < len(times) and times[k + 1] > times[k]:
            u = (t - times[k]) / (times[k + 1] - times[k])
            q = q_gl(vals[k]).slerp(q_gl(vals[k + 1]), max(0, min(1, u)))
        else:
            q = q_gl(vals[k])
        out[name] = q
    return out, dur

C_GL2BL = Quaternion((1, 0, 0), math.radians(90))   # glTF Y-oben -> Blender Z-oben

def axis_corrections(rig, rest):
    A = {}
    for b in rig.data.bones:
        n = norm(b.name)
        if n not in rest: continue
        Wn = C_GL2BL @ rest[n][1]
        Bq = (rig.matrix_world.to_quaternion() @ b.matrix_local.to_quaternion())
        A[b.name] = Wn.inverted() @ Bq
    return A

def apply_locals(rig, rest, A, locals_):
    for pb in rig.pose.bones:
        n = norm(pb.name)
        pb.rotation_mode = 'QUATERNION'
        pb.location = (0, 0, 0)
        if n in locals_ and pb.name in A:
            a = A[pb.name]
            pb.rotation_quaternion = a.inverted() @ rest[n][0].inverted() @ locals_[n] @ a
        else:
            pb.rotation_quaternion = (1, 0, 0, 0)
