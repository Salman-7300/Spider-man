"""Minimaler GLB-Leser/-Schreiber (System-Python + numpy). Kein externes Paket noetig."""
import json, struct
import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

def read(path):
    data = open(path, "rb").read()
    off, js, bn = 12, None, b""
    while off < len(data):
        size, typ = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + size]
        if typ == 0x4E4F534A: js = json.loads(chunk)
        elif typ == 0x004E4942: bn = bytes(chunk)
        off += 8 + size
    return js, bn

def acc(js, bn, i):
    a = js["accessors"][i]; v = js["bufferViews"][a["bufferView"]]
    dt = COMP[a["componentType"]]; n = NCOMP[a["type"]]
    itemsize = np.dtype(dt).itemsize * n
    stride = v.get("byteStride", itemsize)
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    if stride == itemsize:
        arr = np.frombuffer(bn, dtype=dt, count=a["count"] * n, offset=start).reshape(a["count"], n)
    else:
        raw = np.frombuffer(bn, dtype=np.uint8, count=stride * a["count"], offset=start).reshape(a["count"], stride)
        arr = raw[:, :itemsize].copy().view(dt).reshape(a["count"], n)
    if a.get("normalized") and dt != np.float32:
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr

def image_bytes(js, bn, i):
    v = js["bufferViews"][js["images"][i]["bufferView"]]
    return bn[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]

def write(path, js, bn, replace_images=None, replace_accessor_data=None):
    """Baut den Binaerpuffer neu auf. replace_images: {bildindex: (bytes, mime)};
    replace_accessor_data: {accessorindex: float32-array gleicher Form} (wird angehaengt)."""
    replace_images = replace_images or {}
    replace_accessor_data = replace_accessor_data or {}
    js = json.loads(json.dumps(js))
    out = bytearray()
    views = js["bufferViews"]
    newviews = []
    remap = {}
    img_views = {js["images"][i]["bufferView"]: i for i in replace_images}
    for vi, v in enumerate(views):
        data = bn[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]]
        if vi in img_views:
            data, mime = replace_images[img_views[vi]]
            js["images"][img_views[vi]]["mimeType"] = mime
        while len(out) % 4: out.append(0)
        nv = dict(v); nv["byteOffset"] = len(out); nv["byteLength"] = len(data)
        out += data
        remap[vi] = len(newviews); newviews.append(nv)
    for ai, arr in replace_accessor_data.items():
        a = js["accessors"][ai]
        arr = np.ascontiguousarray(arr, dtype=np.float32)
        while len(out) % 4: out.append(0)
        nv = {"buffer": 0, "byteOffset": len(out), "byteLength": arr.nbytes}
        out += arr.tobytes()
        a["bufferView"] = len(newviews); a["byteOffset"] = 0
        a["min"] = arr.min(axis=0).tolist(); a["max"] = arr.max(axis=0).tolist()
        newviews.append(nv)
    js["bufferViews"] = newviews
    while len(out) % 4: out.append(0)
    js["buffers"] = [{"byteLength": len(out)}]
    jb = json.dumps(js, separators=(",", ":")).encode()
    while len(jb) % 4: jb += b" "
    total = 12 + 8 + len(jb) + 8 + len(out)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A)); f.write(jb)
        f.write(struct.pack("<II", len(out), 0x004E4942)); f.write(out)
    return total
