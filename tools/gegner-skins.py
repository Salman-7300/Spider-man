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


"""---- Die zwei restlichen Rollen ----
duellant und stuermer benutzen nicht thug.glb, sondern civilian4 und
civilian5 - dieselben Modelle, die auch als Passanten durch die Stadt
laufen. Ein Gegner im minzgestreiften Polohemd ist von einem Passanten
nicht zu unterscheiden; genau das ist hier das Problem, nicht die
Buntheit.

Der Kopf wird hier NICHT ueber die Flutfuellung ausgespart. Die beiden
Atlanten trennen Haut und Kleidung sauber im FARBTON: gemessen liegen
Haut, Haende und Gesicht bei 0,00 bis 0,083 (civilian4 39 %, civilian5
29 % der gesaettigten Flaeche), die Kleidung dagegen bei 0,44/0,58
(Minzhemd, Jeans) beziehungsweise 0,86/0,92 (rosa Kapuzenpulli). Rot bis
Rosa oberhalb von 0,97 sind Schuhe, Lippen und Augen - die bleiben
ebenfalls stehen. Deshalb genuegt ein Farbtonfenster, und es kann nichts
ins Gesicht laufen.

Die weissen Streifen des Hemdes und die weissen Turnschuhe sind zu
blass fuer das Fenster. Sie werden ueber die UMGEBUNG erfasst: wo im
Umkreis von zwoelf Pixeln ueberwiegend Kleidung liegt, gehoert auch der
blasse Punkt zur Kleidung. Das ist ein oertlicher Test, keine
Flutfuellung - er kann nicht ueber den dunklen Atlashintergrund von
einer Insel zur naechsten springen.
"""

HAUT_VON, HAUT_BIS = 0.955, 0.105       # Farbtonfenster der Haut (laeuft ueber 0)


def istHaut(h):
    return h >= HAUT_VON or h <= HAUT_BIS


def kleidungsmaske(im, radius=11):
    """Wo liegt Kleidung? Gesaettigte Nicht-Haut-Toene, plus blasse
    Stellen, die von Kleidung umgeben sind."""
    import colorsys
    w, h = im.size
    px = im.load()
    kern = Image.new('L', (w, h), 0)
    kp = kern.load()
    blass = Image.new('L', (w, h), 0)
    bp = blass.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            if mx == 0:
                continue
            sat = (mx - mn) / mx
            hh = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)[0]
            if sat >= 0.16 and not istHaut(hh):
                kp[x, y] = 255
            elif sat < 0.16:
                bp[x, y] = 255
    """Umgebung: der Kleidungskern wird um radius Pixel AUFGEWEITET.
    Eine blasse Stelle, die danach im aufgeweiteten Bereich liegt, ist von
    Kleidung umgeben und zaehlt mit - so kommen die weissen Streifen des
    Hemdes und die hellen Sohlen dazu.
    Erst mit dem Weichzeichner probiert: bei acht Pixel breiten Streifen
    liegt der Anteil im Umkreis genau an der Schwelle, und die Maske kam
    als Streifenmuster heraus - die weissen Streifen blieben weiss. Die
    Aufweitung entscheidet dagegen eindeutig."""
    umgebung = kern.filter(ImageFilter.MaxFilter(2 * radius + 1)).load()
    ganz = kern.copy()
    gp = ganz.load()
    for y in range(h):
        for x in range(w):
            if bp[x, y] and umgebung[x, y] > 128:
                gp[x, y] = 255
    return ganz.filter(ImageFilter.GaussianBlur(1.2))


def zivilKleidung(im, ton, saettigung=1.0, dunkler=1.0, radius=11, deckel=0.46):
    """Kleidung umfaerben und abdunkeln, Haut und Schuhe bleiben.

    deckel ist eine Helligkeitsobergrenze. Ohne sie blieben die weissen
    Streifen des Hemdes weiss, auch wenn sie in der Maske liegen - und ein
    weiss-tuerkis gestreiftes Polohemd ist wieder ein Passant."""
    import colorsys
    w, h = im.size
    maske = kleidungsmaske(im, radius)
    mp = maske.load()
    aus = im.copy()
    ap = aus.load()
    px = im.load()
    for y in range(h):
        for x in range(w):
            k = mp[x, y] / 255
            if k < 0.02:
                continue
            r, g, b = px[x, y]
            hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            nl = max(0.0, min(deckel, ll * dunkler))
            ns = min(1.0, max(ss, 0.12) * saettigung)
            nr, ng, nb = colorsys.hls_to_rgb(ton, nl, ns)
            ap[x, y] = (round(r + (nr * 255 - r) * k),
                        round(g + (ng * 255 - g) * k),
                        round(b + (nb * 255 - b) * k))
    return aus, maske


"""Zwei dunkle Strassenfarben. Sie muessen sich von den fuenf
Ruestungsrollen und voneinander unterscheiden, vor allem aber vom
Passanten, aus dem sie gebaut sind."""
ZIVIL_ROLLEN = {
    'duellant': {'quelle': 'civilian4', 'ton': 0.50, 'sat': 0.70, 'dunkel': 0.55},  # dunkles Petrol
    'stuermer': {'quelle': 'civilian5', 'ton': 0.94, 'sat': 0.75, 'dunkel': 0.52},  # Oxblood
}


if __name__ == '__main__':
    import json, os
    """Zwei Betriebsarten:
         ruestung <diffuse> <glut> <ziel> [kante]   - die fuenf thug-Rollen
         zivil <c4-diffuse> <c5-diffuse> <ziel> [kante] - duellant/stuermer"""
    if sys.argv[1] == 'zivil':
        c4, c5, ziel = sys.argv[2], sys.argv[3], sys.argv[4]
        kante = int(sys.argv[5]) if len(sys.argv) > 5 else 512
        os.makedirs(ziel, exist_ok=True)
        quellen = {'civilian4': Image.open(c4).convert('RGB'),
                   'civilian5': Image.open(c5).convert('RGB')}
        bericht = {}
        for rolle, cfg in ZIVIL_ROLLEN.items():
            im = quellen[cfg['quelle']]
            d, maske = zivilKleidung(im, cfg['ton'], cfg['sat'], cfg['dunkel'])
            anteil = round(100 * sum(1 for v in maske.getdata() if v > 128)
                           / (im.width * im.height), 1)
            maske.resize((256, 256)).save(os.path.join(ziel, '_' + rolle + '_maske.png'))
            dp = os.path.join(ziel, rolle + '_diffuse.jpg')
            d.resize((kante, kante), Image.LANCZOS).save(dp, quality=88, optimize=True)
            bericht[rolle] = {'quelle': cfg['quelle'], 'kleidungProzent': anteil,
                              'diffuse': os.path.getsize(dp)}
        print(json.dumps(bericht, indent=1))
        sys.exit(0)
    quelle, glutquelle, ziel = sys.argv[2], sys.argv[3], sys.argv[4]
    kante = int(sys.argv[5]) if len(sys.argv) > 5 else 512
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