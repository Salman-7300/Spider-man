"""Enforcer v2 - Basistextur (System-Python mit Pillow + numpy).

Gegenueber v1: Die Sci-Fi-Plattenkanten des Ausgangsanzugs blieben in v1 als harte Helligkeitslinien
sichtbar (Beine, Arme). v2 nimmt die Luminanz weicher (Mischung mit unscharfer Kopie), hellt die
Grundtoene fuer das Spiellicht etwas auf und trennt Hose (dunkles Oliv) von Oberteil (Anthrazit).
Der Kopf bleibt Pixel fuer Pixel wie im Original.
python art/blender-nextgen/source/enforcer2_texture.py
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

here = os.path.dirname(os.path.abspath(__file__))
dif = Image.open(os.path.join(here, "_tex_diffuse.png")).convert("RGB")
glow = Image.open(os.path.join(here, "_tex_glow.png")).convert("L").resize(dif.size)
W, H = dif.size

mask = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(mask)
for poly in json.load(open(os.path.join(here, "enforcer_head_uv.json"))):
    d.polygon([(u * W, (1 - v) * H) for u, v in poly], fill=255)
mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.5))

src = np.asarray(dif, np.float32) / 255
lum = np.asarray(dif.convert("L"), np.float32) / 255
lum_soft = np.asarray(dif.convert("L").filter(ImageFilter.GaussianBlur(3.0)), np.float32) / 255
l = 0.45 * lum + 0.55 * lum_soft                       # Kanten weicher, Falten bleiben
gl = np.asarray(glow, np.float32) / 255
red = np.clip(((src[..., 0] - src[..., 1]) * 255 - 25) / 60, 0, 1)

# Hose vs. Oberteil: grobe Trennung nach UV-Lage (untere Atlashaelfte = Beine im thug-Atlas)
vv = (np.arange(H, dtype=np.float32) / H)[:, None] * np.ones((1, W), np.float32)
pants = np.clip((vv - 0.55) / 0.05, 0, 1)
top_col = np.array([0.45, 0.47, 0.46], np.float32)
pant_col = np.array([0.43, 0.44, 0.36], np.float32)
fabric = top_col * (1 - pants[..., None]) + pant_col * pants[..., None]
accent = np.array([0.58, 0.14, 0.08], np.float32)
base = np.clip(0.08 + l[..., None] * 1.12, 0, 1) * fabric
acc = np.clip(0.25 + l[..., None] * 0.9, 0, 1) * accent
k = np.maximum(gl * 0.85, red * 0.5)[..., None]
out = base * (1 - k) + acc * k
out_img = Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
out_img = Image.composite(dif, out_img, mask)
out_img.save(os.path.join(here, "enforcer2_diffuse.png"), optimize=True)
print("ok", W, H)
