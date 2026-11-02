"""Enforcer-Basistextur aus der vorhandenen thug-Diffuse ableiten (System-Python mit Pillow).

- Kopf/Gesicht: exakt aus den UV-Polygonen der kopfgewichteten Flaechen (enforcer_head_uv.json),
  bleibt unveraendert.
- Rest: Luminanz behalten (Naehte, Kanten, Abnutzung), Farbe auf dunkles Anthrazit/Oliv-Schwarz
  ziehen -> wirkt wie Funktionsstoff statt Sci-Fi-Panzer.
- Die orangen Leuchtstreifen (Glow-Map) werden zu gedecktem Dunkelrot ohne Leuchten.
Ausgabe: exports nutzen enforcer_diffuse.png (1024^2). Kein Emissionsbild mehr.
python art/blender-nextgen/source/enforcer_texture.py
"""
import json, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

here = os.path.dirname(os.path.abspath(__file__))
dif = Image.open(os.path.join(here, "_tex_diffuse.png")).convert("RGB")
glow = Image.open(os.path.join(here, "_tex_glow.png")).convert("L").resize(dif.size)
W, H = dif.size

mask = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(mask)
for poly in json.load(open(os.path.join(here, "enforcer_head_uv.json"))):
    d.polygon([(u * W, (1 - v) * H) for u, v in poly], fill=255)
mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.5))

lum = dif.convert("L")
src = dif.load(); lp = lum.load(); gp = glow.load()
out = Image.new("RGB", (W, H)); op = out.load()
fabric = (0.42, 0.44, 0.41)     # Oliv-Anthrazit (Multiplikator auf Luminanz)
accent = (0.55, 0.13, 0.08)     # gedecktes Rot
for y in range(H):
    for x in range(W):
        r, g, b = src[x, y]
        l = lp[x, y] / 255.0
        # Rotbraune Sci-Fi-Flaechen erkennen (r deutlich > g) -> ebenfalls Akzent, aber dunkel
        red = max(0.0, min(1.0, ((r - g) - 25) / 60.0))
        gl = gp[x, y] / 255.0
        base = [min(1.0, 0.05 + l * 1.15) * c for c in fabric]
        acc = [min(1.0, 0.25 + l * 0.9) * c for c in accent]
        k = max(gl * 0.9, red * 0.55)
        c = [base[i] * (1 - k) + acc[i] * k for i in range(3)]
        op[x, y] = tuple(int(255 * v) for v in c)
out = Image.composite(dif, out, mask)
out.save(os.path.join(here, "enforcer_diffuse.png"), optimize=True)
mask.save(os.path.join(here, "_head_mask.png"))
print("ok", W, H)
