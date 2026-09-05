#!/usr/bin/env python3
"""Gegner-Skins aus der vorhandenen Ruestungstextur bauen.

Fuenf der sieben Gegnerrollen benutzen dasselbe thug.glb mit EINEM Material
und einer Diffusetextur - sie sehen deshalb identisch aus. Dieses Werkzeug
erzeugt je Rolle eine eigene Farbgebung.

Bewusst KEINE freie Bildgenerierung ueber den Atlas: die UV-Inseln muessten
dabei pixelgenau erhalten bleiben, und generative Modelle verschieben das
Gesicht. Stattdessen wird die vorhandene Textur umgefaerbt - jede
Plattenkante, jeder Kratzer und jede Abnutzung bleibt erhalten, weil nur
der Farbton geaendert wird und die Helligkeit steht.

Der Kopf wird dabei ausgespart. Seine UV-Insel wird nicht geraten, sondern
gefunden: Saatpunkt ist der groesste hautfarbene Klumpen, von dort wird
ueber hautartige Farben geflutet. Ruestungsgrau hat mehr Blau als Gruen,
Haut nicht - daran trennen sich die beiden. Duenne Bruecken zu
angrenzenden Ruestungsteilen werden durch Erosion gekappt.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter


def kopfmaske(im):
    w, h = im.size
    px = im.load()

    def hautartig(x, y):
        r, g, b = px[x, y]
        return (r + g + b) > 24 and abs(g - b) <= 22 and g >= b - 4 and 4 <= (r - g) <= 85

    proben = [(x, y) for y in range(0, h, 2) for x in range(0, w, 2)
              if px[x, y][0] > 120 and abs(px[x, y][1] - px[x, y][2]) < 18
              and 20 < (px[x, y][0] - px[x, y][1]) < 75]
    if not proben:
        return Image.new('L', (w, h), 0)
    s, gesehen, best = set(proben), set(), []
    for p in proben:
        if p in gesehen: continue
        q, teil = deque([p]), []
        gesehen.add(p)
        while q:
            x, y = q.popleft(); teil.append((x, y))
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2), (2, 2), (-2, -2), (2, -2), (-2, 2)):
                n = (x + dx, y + dy)
                if n in s and n not in gesehen: gesehen.add(n); q.append(n)
        if len(teil) > len(best): best = teil
    saat = (sum(p[0] for p in best) // len(best), sum(p[1] for p in best) // len(best))

    m = Image.new('L', (w, h), 0); mp = m.load()
    q = deque([saat]); mp[saat[0], saat[1]] = 255
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and mp[nx, ny] == 0 and hautartig(nx, ny):
                mp[nx, ny] = 255; q.append((nx, ny))

    """Oeffnen: Erosion kappt duenne Bruecken zu angrenzenden
    Ruestungsteilen, danach bleibt nur der groesste Rest - der Kopf."""
    m = m.filter(ImageFilter.MinFilter(9))
    mp = m.load()
    gesehen2 = set(); best2 = []
    for sy in range(0, h, 3):
        for sx in range(0, w, 3):
            if mp[sx, sy] == 0 or (sx, sy) in gesehen2: continue
            q, teil = deque([(sx, sy)]), []
            gesehen2.add((sx, sy))
            while q:
                x, y = q.popleft(); teil.append((x, y))
                for dx, dy in ((3, 0), (-3, 0), (0, 3), (0, -3)):
                    n = (x + dx, y + dy)
                    if 0 <= n[0] < w and 0 <= n[1] < h and n not in gesehen2 and mp[n[0], n[1]]:
                        gesehen2.add(n); q.append(n)
            if len(teil) > len(best2): best2 = teil
    m2 = Image.new('L', (w, h), 0); m2p = m2.load()
    for x, y in best2:
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if 0 <= x + dx < w and 0 <= y + dy < h: m2p[x + dx, y + dy] = 255
    return m2.filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(3))


def faerbe(im, maske, ton, saettigung=1.0, schwelle=0.34):
    """Farbton der gesaettigten Flaechen aendern, Helligkeit unangetastet.

    Nur was farbig ist, wird umgefaerbt - Stahl, Schwarz und Gummi bleiben,
    wie sie sind. Der Kopf ist ueber die Maske ausgenommen; an ihren
    weichen Raendern wird ueberblendet, damit keine Kante entsteht.
    """
    import colorsys
    w, h = im.size
    aus = im.copy(); ap = aus.load(); px = im.load(); mp = maske.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx == 0: continue
            sat = (mx - mn) / mx
            if sat < schwelle: continue
            schutz = mp[x, y] / 255
            if schutz > 0.99: continue
            hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            nr, ng, nb = colorsys.hls_to_rgb(ton, ll, min(1.0, ss * saettigung))
            f = 1 - schutz
            ap[x, y] = (round(r + (nr * 255 - r) * f),
                        round(g + (ng * 255 - g) * f),
                        round(b + (nb * 255 - b) * f))
    return aus


def leuchten(im, ton, saettigung=1.0):
    """Faerbt eine Emissive-Karte um.

    ZURZEIT UNBENUTZT: das Spiel ersetzt das GLB-Material durch ein
    MeshLambertMaterial ohne emissiveMap (am laufenden Spiel nachgesehen).
    Die orangen Lichter stecken in der Farbtextur selbst und werden dort
    mit umgefaerbt. Die Funktion bleibt stehen, falls das Leuchten spaeter
    einmal ueber eine eigene Karte laeuft."""
    import colorsys
    w, h = im.size
    aus = im.copy(); ap = aus.load(); px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx = max(r, g, b)
            if mx < 12: continue
            hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            nr, ng, nb = colorsys.hls_to_rgb(ton, ll, min(1.0, ss * saettigung))
            ap[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255))
    return aus


"""Fuenf Rollen, fuenf Farbgebungen. Die Toene sind so gewaehlt, dass die
Rollen sich auch aus der Entfernung unterscheiden lassen - das ist der
Zweck, nicht Buntheit. schlaeger behaelt das vorhandene Rot."""
ROLLEN = {
    'schlaeger': None,                       # unveraendert, das Original
    'brecher':   {'ton': 0.075, 'sat': 1.05, 'glut': 0.12},   # Rostbraun, gelbe Glut
    'flink':     {'ton': 0.55,  'sat': 0.95, 'glut': 0.50},   # Stahlblau, tuerkise Glut
    'waechter':  {'ton': 0.33,  'sat': 0.75, 'glut': 0.28},   # Olivgruen, gruene Glut
    'werfer':    {'ton': 0.78,  'sat': 0.85, 'glut': 0.80},   # Violett, magenta Glut
}


if __name__ == '__main__':
    import json, os
    quelle, glutquelle, ziel = sys.argv[1], sys.argv[2], sys.argv[3]
    kante = int(sys.argv[4]) if len(sys.argv) > 4 else 512
    im = Image.open(quelle).convert('RGB')
    glut = Image.open(glutquelle).convert('RGB')
    maske = kopfmaske(im)
    anteil = round(100 * sum(1 for v in maske.getdata() if v > 128) / (im.width * im.height), 1)
    os.makedirs(ziel, exist_ok=True)
    maske.resize((256, 256)).save(os.path.join(ziel, '_kopfmaske.png'))
    bericht = {'kopfmaskeProzent': anteil, 'rollen': {}}
    for rolle, cfg in ROLLEN.items():
        if cfg is None:
            bericht['rollen'][rolle] = 'unveraendert'
            continue
        d = faerbe(im, maske, cfg['ton'], cfg['sat']).resize((kante, kante), Image.LANCZOS)
        dp = os.path.join(ziel, rolle + '_diffuse.jpg')
        d.save(dp, quality=88, optimize=True)
        bericht['rollen'][rolle] = {'diffuse': os.path.getsize(dp)}
    print(json.dumps(bericht, indent=1))
