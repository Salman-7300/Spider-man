#!/usr/bin/env python3
"""Netzfaden-Textur aus einem erzeugten Makrobild bauen.

Der erste Versuch hat die Netze unsichtbar gemacht. Grund: das Material
verwirft mit alphaTest 0.12 jedes Pixel unter der Schwelle, und
placeStrand setzt repeat.y auf Laenge * 0,6 - ein 20-Meter-Faden zeigt
zwoelf Kacheln auf wenigen Bildschirmpunkten. Duenne Linien werden beim
Verkleinern weggemittelt, fallen unter die Schwelle, und dann verschwindet
der Faden GANZ.

Die Lehre daraus steckt im Aufbau: das Bild liefert nur das MATERIAL eines
Strangs - die Anordnung und die Breiten kommen von hier, mit denselben
Proportionen wie die gezeichnete Vorlage in game.js (fuenf Laengsstraenge,
abwechselnd kraeftig und fein, leicht geschlaengelt). Damit haengt das
Ergebnis nicht davon ab, wie dick die Faeden im Foto zufaellig ausfielen.

Die Vorgabewerte sind nicht geraten, sondern gemessen. Gezaehlt wurden
Bildpunkte, die der Faden im laufenden Spiel wirklich belegt (dieselbe
Kamera einmal mit und einmal ohne Faden, Differenz), gegen den
gezeichneten Canvas als Massstab:

  Kante 128, Boden 230:   4 m 247 | 10 m  20 | 25 m   0 | 50 m  0
  Kante  64, Boden 190:   4 m 322 | 10 m  54 | 25 m  45 | 50 m  4
  Kante  64, Boden 240:   4 m 353 | 10 m  66 | 25 m 100 | 50 m 38
  gezeichneter Canvas:    4 m 286 | 10 m  41 | 25 m  21 | 50 m  2

Die 128er Kachel faellt auf Entfernung auf null - sie wird eine
Mip-Stufe weiter verkleinert als die 64er des Originals. Deshalb 64.

Aufruf: netztextur-aufbereiten.py <quelle> <ziel> [kante] [boden]
"""
import math
import sys
from PIL import Image


def kachelbreite(im, schwelle=12):
    """Erzeugte Kacheln enthalten oft mehrere Perioden nebeneinander."""
    w, h = im.size
    px = im.load()
    prof = [sum(px[x, y] for y in range(0, h, 8)) / (h // 8) for x in range(w)]
    for teil in (2, 4):
        b = w // teil
        proben = range(0, w - b, 4)
        if sum(abs(prof[x] - prof[x + b]) for x in proben) / len(list(proben)) < 3.0:
            return b
    return w


def straenge(im, schwelle=30):
    """Zusammenhaengende helle Spalten - Anzahl und Breite der Straenge."""
    w, h = im.size
    px = im.load()
    schritt = max(1, h // 64)
    prof = [sum(px[x, y] for y in range(0, h, schritt)) / len(range(0, h, schritt)) for x in range(w)]
    aus, start = [], None
    for x, v in enumerate(prof):
        if v > schwelle and start is None: start = x
        elif v <= schwelle and start is not None:
            aus.append(x - start); start = None
    if start is not None: aus.append(w - start)
    return aus


def deckung(a, schwelle=30):
    px = list(a.getdata())
    return round(100 * sum(1 for v in px if v > schwelle) / len(px), 1)


def mipprobe(a, schwelle=30):
    """Was ueberlebt das Verkleinern? Hier ist der erste Versuch gestorben."""
    aus, k = {}, a.width
    while k >= 8:
        aus[k] = deckung(a if k == a.width else a.resize((k, k), Image.LANCZOS), schwelle)
        k //= 2
    return aus


def bestenStrang(grau):
    """Den breitesten Strang der Vorlage ausschneiden - der zeigt die
    Drehung am deutlichsten und ist die Materialprobe fuer alle."""
    sp = straenge(grau, 12)
    w, h = grau.size
    px = grau.load()
    schritt = max(1, h // 64)
    prof = [sum(px[x, y] for y in range(0, h, schritt)) / len(range(0, h, schritt)) for x in range(w)]
    bester, start, beste = None, None, 0
    for x, v in enumerate(prof):
        if v > 12 and start is None: start = x
        elif v <= 12 and start is not None:
            if x - start > beste: beste, bester = x - start, (start, x)
            start = None
    if bester is None: bester = (0, min(48, w))
    return grau.crop((bester[0], 0, bester[1], h))


def aufbereiten(quelle, ziel, kante=64, boden=240):
    grau = Image.open(quelle).convert('L')
    b = kachelbreite(grau)
    if b < grau.width:
        grau = grau.crop((0, 0, b, grau.height))
    probe = bestenStrang(grau)

    """Fuenf Straenge wie in der Vorlage: Abstand ein Fuenftel der Kachel,
    abwechselnd kraeftig und fein, jeweils leicht geschlaengelt. Die
    Breiten sind bewusst grosszuegig - lieber ein Faden, der beim
    Verkleinern ueberlebt, als einer, der ganz verschwindet."""
    alpha = Image.new('L', (kante, kante), 0)
    for i in range(5):
        breit = max(3, round(kante * (0.062 if i % 2 else 0.042)))
        s = probe.resize((breit, kante), Image.LANCZOS)
        """Alphaboden: innerhalb eines Strangs darf der Wert nicht beliebig
        tief fallen. Sonst mittelt sich der Faden auf kleinen Mip-Stufen
        unter alphaTest 0.12 und wird ganz verworfen - der Fehler, der die
        Netze unsichtbar gemacht hat. Die Drehung des Fotos bleibt als
        Helligkeitsspiel oberhalb des Bodens erhalten."""
        dunkler = 0.82 if i % 2 == 0 else 1.0
        s = s.point(lambda v: 0 if v < 8 else
                    min(255, int((boden + (255 - boden) * (v / 255) ** 0.7) * dunkler)))
        mitte = round(kante * (0.1 + i * 0.2))
        for y in range(kante):
            # Schlaengeln wie in der Vorlage, aber in ganzen Bildpunkten,
            # damit beim Umlauf kein Versatz entsteht.
            versatz = round(math.sin(y / kante * 2 * math.pi + i) * kante * 0.02)
            for dx in range(breit):
                x = (mitte + dx - breit // 2 + versatz) % kante
                v = s.getpixel((dx, y))
                if v > alpha.getpixel((x, y)):
                    alpha.putpixel((x, y), v)

    weiss = Image.new('L', (kante, kante), 255)
    Image.merge('RGBA', (weiss, weiss, weiss, alpha)).save(ziel, optimize=True)
    return {'ziel': ziel, 'kachelBreiteQuelle': b, 'kante': kante,
            'straenge': straenge(alpha), 'deckung': deckung(alpha),
            'mipDeckung': mipprobe(alpha)}


def altesCanvas(kante=64):
    """Die gezeichnete Vorlage aus game.js als Massstab."""
    from PIL import ImageDraw
    im = Image.new('L', (kante, kante), 0)
    d = ImageDraw.Draw(im)
    for i in range(5):
        x = 5 + i * 13
        d.line([(x + math.sin(y * 0.09 + i) * 2.2, y) for y in range(0, kante + 1, 8)],
               fill=242 if i % 2 else 226, width=2 if i % 2 else 2)
    return im


if __name__ == '__main__':
    import json, os
    q, z = sys.argv[1], sys.argv[2]
    kante = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    boden = int(sys.argv[4]) if len(sys.argv) > 4 else 240
    e = aufbereiten(q, z, kante, boden)
    e['bytes'] = os.path.getsize(z)
    alt = altesCanvas()
    e['massstabAltesCanvas'] = {'straenge': straenge(alt), 'deckung': deckung(alt),
                                'mipDeckung': mipprobe(alt)}
    print(json.dumps(e, indent=1))
