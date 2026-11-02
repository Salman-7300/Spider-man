"""Web Hero Next-Gen v1 - neuer Anzug auf dem UNVERAENDERTEN hero.glb-Netz und -Skelett.

Warum so: hero.glb ist ueber viele Runden mit seinen Animationen abgestimmt. Geometrie, Knochen,
Bind-Pose und Skin-Gewichte bleiben Byte fuer Byte erhalten -> jede vorhandene Bewegung laeuft
unveraendert. Neu sind ausschliesslich:
  - Anzug-Farbtextur (komplett neu gemalt, ohne Netzmuster/Spinnenlogo des Ausgangsmodells)
  - Rauheits-/Metall-Karte (ohne Netzlinien), Normalkarte geglaettet + eigene Naehte
  - Linsenform (Rahmen und Glas, nur Kopfknochen, Form im Gesichtsplan neu)
  - Faerbung der Handgelenkgeraete
Gemalt wird pro Texel aus der 3D-Lage auf dem Koerper (Bind-Pose) und den interpolierten
Skin-Gewichten (Koerperzone), d. h. das Muster sitzt am Koerper, nicht an UV-Inseln.
python art/blender-nextgen/source/hero_suit.py
"""
import io, os, re, math, json
import numpy as np
from PIL import Image, ImageFilter
from gltf_io import read, acc, image_bytes, write

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "assets", "hero.glb")
OUT = os.path.join(HERE, "..", "exports", "webhero-nextgen-v1.glb")
TEXDIR = os.path.join(HERE, "hero_tex")
os.makedirs(TEXDIR, exist_ok=True)
RES = 2048          # gemalt in 2048, gespeichert in 1024 (Kantenglaettung)
FINAL = 1024

js, bn = read(SRC)
skin = js["skins"][0]
jn = [re.sub(r"^mixamorig\d*:?", "", js["nodes"][j]["name"]) for j in skin["joints"]]

ZONES = ["HEAD", "NECK", "TORSO", "UPARM", "FOREARM", "HAND", "THIGH", "SHIN", "FOOT"]
def zone_of(n):
    if n.startswith("Head"): return 0
    if n == "Neck": return 1
    if n.startswith(("Spine", "Hips")) or "Shoulder" in n: return 2
    if n.endswith("ForeArm"): return 4
    if n.endswith("Arm"): return 3
    if "Hand" in n: return 5
    if n.endswith("UpLeg"): return 6
    if n.endswith("Leg"): return 7
    if "Foot" in n or "Toe" in n: return 8
    return 2
JZ = np.array([zone_of(n) for n in jn])

# ---------------------------------------------------------------- Linsen neu formen (Mesh 3 Rahmen, 4 Glas)
lens_new = {}
glass = acc(js, bn, js["meshes"][4]["primitives"][0]["attributes"]["POSITION"]).astype(np.float64)
centers = {}
for s in (-1, 1):
    g = glass[np.sign(glass[:, 0]) == s]
    centers[s] = (g[:, 0].mean(), (-g[:, 2]).mean(), np.abs(g[:, 0]).min(), np.abs(g[:, 0]).max())
def reshape_lens(P):
    P = P.copy()
    for i in range(len(P)):
        s = 1 if P[i, 0] >= 0 else -1
        cx, cz, xin, xout = centers[s]
        zp = -P[i, 2]
        t = min(1.0, max(0.0, (abs(P[i, 0]) - xin) / (xout - xin)))     # 0 innen, 1 aussen
        dz = zp - cz
        dout = (abs(P[i, 0]) - abs(cx))
        # innen schmal und spitz, aussen hoch und nach oben gezogen -> eigene, kantige Linse
        dz_new = dz * (0.48 + 0.42 * t) + 0.30 * dout
        P[i, 2] = -(cz + dz_new + 0.006)
    return P
for mi in (3, 4):
    ai = js["meshes"][mi]["primitives"][0]["attributes"]["POSITION"]
    lens_new[ai] = reshape_lens(acc(js, bn, ai).astype(np.float64)).astype(np.float32)

# ---------------------------------------------------------------- Rasterisieren (Atlas = Bild 0)
Pbuf = np.zeros((RES, RES, 3), np.float32)
Nbuf = np.zeros((RES, RES, 3), np.float32)
Zbuf = np.zeros((RES, RES, len(ZONES)), np.float32)
Mbuf = np.full((RES, RES), -1, np.int16)
for mi, mesh in enumerate(js["meshes"]):
    prim = mesh["primitives"][0]
    mat = js["materials"][prim["material"]]
    if mat["pbrMetallicRoughness"].get("baseColorTexture", {}).get("index") != 0:
        continue
    a = prim["attributes"]
    P = acc(js, bn, a["POSITION"]).astype(np.float32)
    if a["POSITION"] in lens_new: P = lens_new[a["POSITION"]]
    N = acc(js, bn, a["NORMAL"]).astype(np.float32)
    UV = acc(js, bn, a["TEXCOORD_0"]).astype(np.float32)
    UV = UV - np.floor(UV.min(0))      # Atlas liegt in der Kachel v = 1..2 (Wiederholung)
    J = acc(js, bn, a["JOINTS_0"]).astype(np.int64); W = acc(js, bn, a["WEIGHTS_0"]).astype(np.float32)
    Zv = np.zeros((len(P), len(ZONES)), np.float32)
    for k in range(4):
        np.add.at(Zv, (np.arange(len(P)), JZ[J[:, k]]), W[:, k])
    idx = acc(js, bn, prim["indices"]).reshape(-1, 3).astype(np.int64)
    Pz = P.copy(); Pz[:, 2] = -Pz[:, 2]          # Hoehe nach oben
    Nz = N.copy(); Nz[:, 2] = -Nz[:, 2]
    for tri in idx:
        uv = UV[tri] * RES
        x0, y0 = np.floor(uv.min(0)).astype(int); x1, y1 = np.ceil(uv.max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, RES - 1), min(y1, RES - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx_, cy_) = uv
        d = (by - cy_) * (ax - cx_) + (cx_ - bx) * (ay - cy_)
        if abs(d) < 1e-9: continue
        l0 = ((by - cy_) * (xs - cx_) + (cx_ - bx) * (ys - cy_)) / d
        l1 = ((cy_ - ay) * (xs - cx_) + (ax - cx_) * (ys - cy_)) / d
        l2 = 1 - l0 - l1
        m = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        if not m.any(): continue
        L = np.stack([l0[m], l1[m], l2[m]], 1)
        yy = ys[m].astype(int); xx = xs[m].astype(int)
        Pbuf[yy, xx] = L @ Pz[tri]
        Nbuf[yy, xx] = L @ Nz[tri]
        Zbuf[yy, xx] = L @ Zv[tri]
        Mbuf[yy, xx] = mi
valid = Mbuf >= 0
nl = np.linalg.norm(Nbuf, axis=2, keepdims=True); Nbuf = Nbuf / np.maximum(nl, 1e-6)
X, Y, H = Pbuf[..., 0], Pbuf[..., 1], Pbuf[..., 2]
NX, NY, NH = Nbuf[..., 0], Nbuf[..., 1], Nbuf[..., 2]
zone = Zbuf.argmax(2)
AX = np.abs(X)

# ---------------------------------------------------------------- Entwurf
def c(*rgb): return np.array(rgb, np.float32) / 255.0
NAVY, NAVY2, RED, RED_D = c(29, 35, 50), c(42, 49, 66), c(122, 24, 29), c(86, 16, 21)
SILV, EMB, SOLE, LENS, FRAME = c(150, 154, 160), c(188, 182, 170), c(24, 24, 27), c(206, 214, 222), c(18, 20, 26)
img = np.zeros((RES, RES, 3), np.float32); img[:] = NAVY
rough = np.full((RES, RES), 0.68, np.float32)
height = np.zeros((RES, RES), np.float32)       # fuer Nahtrillen in der Normalkarte

def paint(mask, col, r=None):
    img[mask] = col
    if r is not None: rough[mask] = r
def line(dist, w):                               # weiche Linie, 1 in der Mitte
    return np.clip(1 - np.abs(dist) / w, 0, 1)
def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = np.clip(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1)
    return np.hypot(px - (ax + t * vx), py - (ay + t * vy))

Z = zone
head, neck, torso = Z == 0, Z == 1, Z == 2
uparm, forearm, hand = Z == 3, Z == 4, Z == 5
thigh, shin, foot = Z == 6, Z == 7, Z == 8

# Rumpf: Seitenpaneele heller, rote Schulterpasse mit V zur Brustmitte, Guertelband
paint(torso & (AX > 0.135), NAVY2)
yoke_line = 1.845 + 0.78 * AX
yoke = (torso | neck & False) & (H > yoke_line)
paint(yoke, RED, 0.58)
paint(uparm & (H > 1.98), RED, 0.58)                          # Passe laeuft ueber die Schulterkappe
# Seitennaehte und Passen-Paspel (silbern, nur schmal)
pip = torso & (line(H - yoke_line, 0.006) > 0)
img[pip] = img[pip] * 0.3 + SILV * 0.7; rough[pip] = 0.4
height -= 0.6 * line(AX - 0.135, 0.004) * torso
belt = torso & (H > 1.495) & (H < 1.535)
paint(belt, RED_D, 0.55)
for e in (1.495, 1.535):
    m = torso & (line(H - e, 0.0035) > 0.3); img[m] = SILV; rough[m] = 0.4; height -= 0.5 * line(H - e, 0.004) * torso

# Emblem vorn und hinten: doppelter Pfeilwinkel mit Raute ("Schwung-Anker"), keine Spinne
def emblem(front, cz, s):
    face = torso & ((NY > 0.25) if front else (NY < -0.25))
    d = np.minimum.reduce([
        seg_dist(X, H, -0.105 * s, cz + 0.05 * s, 0, cz - 0.03 * s),
        seg_dist(X, H, 0.105 * s, cz + 0.05 * s, 0, cz - 0.03 * s),
        seg_dist(X, H, -0.06 * s, cz + 0.005 * s, 0, cz - 0.075 * s),
        seg_dist(X, H, 0.06 * s, cz + 0.005 * s, 0, cz - 0.075 * s),
    ])
    dia = (np.abs(X) + np.abs(H - (cz + 0.07 * s))) < 0.02 * s
    m = face & ((d < 0.0105 * s) | dia)
    img[m] = EMB; rough[m] = 0.42
    edge = face & (np.abs(d - 0.0105 * s) < 0.003)
    img[edge] = img[edge] * 0.5 + RED_D * 0.5
    height[m] += 0.5
emblem(True, 1.935, 1.0)
emblem(False, 1.94, 1.15)

# Arme: Navy mit roter Aussenbahn (oben/aussen), Paspel an den Kanten
out = (np.sign(X) * NX * 0.75 + NH * 0.66)
arm = uparm | forearm
stripe = arm & (out > 0.52)
paint(stripe, RED, 0.58)
m = arm & (np.abs(out - 0.52) < 0.035); img[m] = img[m] * 0.4 + SILV * 0.6
height -= 0.5 * (arm & (np.abs(out - 0.52) < 0.03))
# Handschuhe: rot, dunkle Handgelenkmanschette
paint(hand, RED, 0.6)
cuff = (hand | forearm) & (Zbuf[..., 5] > 0.25) & (Zbuf[..., 5] < 0.75)
paint(cuff, NAVY, 0.55)
# Beine: Aussenstreifen, Stiefel ab Schienbeinmitte, dunkle Sohle
legout = np.sign(X) * NX
paint((thigh | shin) & (legout > 0.82), RED_D, 0.6)
boot_top = 0.50
paint((shin | foot) & (H < boot_top), RED, 0.6)
m = (shin | foot) & (np.abs(H - boot_top) < 0.006); img[m] = SILV; rough[m] = 0.4
height -= 0.7 * ((shin | foot) & (np.abs(H - boot_top) < 0.008))
toe = foot & (H < 0.07) & (NY > 0.4)
paint(toe, RED_D, 0.5)
sole = (foot & ((NH < -0.55) | (H < 0.022))) | (Mbuf == 0)
paint(sole, SOLE, 0.85)
# Maske: Rot, dunklere Kinnpartie, Mittelnaht und Wangenpaneele
hd = head | (neck & (H > 2.16))
paint(hd, RED, 0.55)
hc_z = 2.33
chin = hd & (NY > 0.15) & (H < 2.245 + 0.35 * AX)
paint(chin, NAVY2, 0.6)            # zweifarbige Maske: dunkle Kinn-/Wangenpartie
seam = hd & (AX < 0.0028)
img[seam] = img[seam] * 0.45
height -= 0.8 * (hd & (AX < 0.003))
cheek = hd & (np.abs((H - 2.245 - 0.35 * AX)) < 0.0028) & (NY > 0.0)
img[cheek] = img[cheek] * 0.45
height -= 0.8 * (hd & (np.abs((H - 2.245 - 0.35 * AX)) < 0.003) & (NY > 0.0))
brow = hd & (np.abs(H - (2.43 - 0.55 * AX)) < 0.0028) & (NY > 0.2) & (AX < 0.09)
img[brow] = img[brow] * 0.5
height -= 0.8 * (hd & (np.abs(H - (2.43 - 0.55 * AX)) < 0.003) & (NY > 0.2) & (AX < 0.09))
paint(neck & (H <= 2.16), NAVY, 0.62)
# Linsen
paint(Mbuf == 4, LENS, 0.15)
paint(Mbuf == 3, FRAME, 0.4)

# Stoffstruktur: feiner Koeper (diagonal) + leichte grossflaechige Tonvariation
twill = 0.5 + 0.5 * np.sin(2 * np.pi * (X * 0.7 + H + Y * 0.7) / 0.0085)
fab = valid & (Mbuf != 4) & (Mbuf != 3)
var = 0.5 + 0.5 * np.sin(X * 37 + H * 23) * np.sin(Y * 31 - H * 17)
img[fab] *= (1 - 0.06 * twill[fab, None]) * (0.97 + 0.06 * var[fab, None])
height += 0.08 * twill * fab

# ---------------------------------------------------------------- Raender auffuellen (gegen Naehte im Mip)
def dilate(a, mask, n=6):
    a = a.copy(); m = mask.copy()
    for _ in range(n):
        acc_ = np.zeros_like(a); cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(a, dy, 0), dx, 1); shm = np.roll(np.roll(m, dy, 0), dx, 1)
            acc_[shm] += sh[shm]; cnt[shm] += 1
        grow = (~m) & (cnt > 0)
        a[grow] = acc_[grow] / cnt[grow][..., None] if a.ndim == 3 else acc_[grow] / cnt[grow]
        m = m | grow
    return a
img = dilate(img, valid, 8)
rough = dilate(rough, valid, 8)

def to_img(a, mode):
    a = np.clip(a, 0, 1)
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8), mode)
    return im.resize((FINAL, FINAL), Image.LANCZOS)
base = to_img(img, "RGB")
orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], 2)
ormi = to_img(orm, "RGB")

# Normalkarte: Ausgangskarte (Muskelrelief) geglaettet, damit feine Netzrillen verschwinden,
# plus eigene Nahtrillen aus der Hoehenkarte
old_n = Image.open(io.BytesIO(image_bytes(js, bn, 3))).convert("RGB").resize((FINAL, FINAL), Image.LANCZOS)
old_n = old_n.filter(ImageFilter.GaussianBlur(2.2))
nv = np.asarray(old_n, np.float32) / 255 * 2 - 1
hgt = np.asarray(Image.fromarray(np.clip((height + 1) * 127.5, 0, 255).astype(np.uint8)).resize((FINAL, FINAL), Image.LANCZOS), np.float32) / 255
gx = np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1); gy = np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)
k = 2.2
nv[..., 0] += -gx * k; nv[..., 1] += gy * k
nv /= np.linalg.norm(nv, axis=2, keepdims=True)
nmap = Image.fromarray(((nv + 1) * 127.5).astype(np.uint8), "RGB")

# Handgelenkgeraete (Bild 6): Gunmetal mit gedecktem Rot
dev = Image.open(io.BytesIO(image_bytes(js, bn, 6))).convert("RGB")
dl = np.asarray(dev.convert("L"), np.float32)[..., None] / 255
dr = np.asarray(dev, np.float32) / 255
redness = np.clip((dr[..., 0] - dr[..., 1] - 0.25) * 2, 0, 1)[..., None]
dnew = (0.10 + 0.55 * dl) * np.array([0.42, 0.45, 0.50]) * (1 - redness * 0.35) + redness * 0.35 * (0.2 + 0.6 * dl) * np.array([0.55, 0.1, 0.1])
devi = Image.fromarray((np.clip(dnew, 0, 1) * 255).astype(np.uint8), "RGB")

def enc(im, fmt="PNG", **kw):
    b = io.BytesIO(); im.save(b, fmt, **kw); return b.getvalue()
for nm, im in (("basecolor.png", base), ("orm.png", ormi), ("normal.png", nmap), ("device.png", devi)):
    im.save(os.path.join(TEXDIR, nm))

reps = {0: (enc(base, "JPEG", quality=92), "image/jpeg"),
        2: (enc(ormi, "JPEG", quality=90), "image/jpeg"),
        4: (enc(ormi, "JPEG", quality=90), "image/jpeg"),
        3: (enc(nmap), "image/png"),
        6: (enc(devi, "JPEG", quality=90), "image/jpeg")}
# Material-Feinheiten: Linsenglas nicht metallisch-spiegelnd (Spiel hat keine Umgebung), Namen eindeutig
js2 = json.loads(json.dumps(js))
names = ["WH_Soles", "WH_GloveL", "WH_Suit", "WH_LensFrame", "WH_LensGlass", "WH_DeviceL", "WH_DeviceR"]
for i, m in enumerate(js2["materials"]):
    m["name"] = names[i]
js2["materials"][4]["pbrMetallicRoughness"].update({"metallicFactor": 0.0, "roughnessFactor": 0.12})
js2["materials"][4]["emissiveFactor"] = [0.06, 0.065, 0.07]
js2["asset"]["extras"] = {"citySwing": "webhero-nextgen-v1: Netz/Skelett/Gewichte = assets/hero.glb, neuer Anzug"}
size = write(OUT, js2, bn, replace_images=reps, replace_accessor_data=lens_new)
print(json.dumps({"glbBytes": size, "zonesPainted": int(valid.sum()), "res": RES}))
