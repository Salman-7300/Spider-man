#!/usr/bin/env python3
"""Erzeugte Oberflaechentextur fuer city-visuals.js aufbereiten.

Die Textur wird im Spiel MIT der vorhandenen Vertexfarbe multipliziert.
Eine Kachel mit Mittelwert 184 wuerde jedes Gebaeude um rund 28 Prozent
abdunkeln und alle vier Fassadenstile verfaelschen. Deshalb wird der
Mittelwert nach oben gelegt und nur die Abweichung davon bleibt stehen:
die Textur traegt dann Oberflaeche, keine Farbe.

Aufruf: textur-aufbereiten.py <quelle> <ziel> [kante] [zielmittel] [kontrast]
"""
import sys
from PIL import Image


def naht(im, schritt=4):
    """Wie stark springt die Kachel an ihrer Naht - gemessen gegen das
    normale Korn zweier benachbarter Zeilen. Werte in derselben
    Groessenordnung bedeuten: keine sichtbare Naht."""
    w, h = im.size
    px = im.load()
    def md(paare):
        return sum(abs(a - b) for a, b in paare) / len(paare)
    return {
        'nahtObenUnten': round(md([(px[x, 0], px[x, h - 1]) for x in range(0, w, schritt)]), 2),
        'kornZeilen': round(md([(px[x, h // 2], px[x, h // 2 + 1]) for x in range(0, w, schritt)]), 2),
        'nahtLinksRechts': round(md([(px[0, y], px[w - 1, y]) for y in range(0, h, schritt)]), 2),
        'kornSpalten': round(md([(px[w // 2, y], px[w // 2 + 1, y]) for y in range(0, h, schritt)]), 2),
    }


def randAngleichen(im, band=None):
    """Die Kachel an ihrer Naht stetig machen.

    Das Bildmodell liefert eine fast nahtlose Kachel; nach dem Verkleinern
    hebt sich der Rest der Naht aber vom geglaetteten Korn ab. Beide
    gegenueberliegenden Raender werden deshalb auf ihren gemeinsamen
    Mittelwert gezogen, und dieser Eingriff blendet ueber ein schmales Band
    wieder aus. Am Rand ist die Kachel danach exakt stetig, in der Flaeche
    bleibt sie unveraendert.
    """
    w, h = im.size
    if band is None:
        band = max(4, w // 32)
    px = im.load()
    for i in range(band):
        f = 1.0 - i / band                      # 1 am Rand, 0 am Bandende
        for y in range(h):
            a, b = px[i, y], px[w - 1 - i, y]
            m = (a + b) / 2
            px[i, y] = int(round(a + (m - a) * f))
            px[w - 1 - i, y] = int(round(b + (m - b) * f))
    for i in range(band):
        f = 1.0 - i / band
        for x in range(w):
            a, b = px[x, i], px[x, h - 1 - i]
            m = (a + b) / 2
            px[x, i] = int(round(a + (m - a) * f))
            px[x, h - 1 - i] = int(round(b + (m - b) * f))
    return im


def aufbereiten(quelle, ziel, kante=512, zielmittel=236, kontrast=1.0):
    im = Image.open(quelle).convert('L')
    vorher = naht(im)
    px = list(im.getdata())
    mittel = sum(px) / len(px)
    neu = [max(0, min(255, int(round((v - mittel) * kontrast + zielmittel)))) for v in px]
    im.putdata(neu)
    if kante and im.width != kante:
        im = im.resize((kante, kante), Image.LANCZOS)
    randAngleichen(im)
    im.save(ziel, optimize=True)
    nach = list(im.getdata())
    return {
        'ziel': ziel, 'kante': im.width,
        'mittelVorher': round(mittel, 1),
        'mittelNachher': round(sum(nach) / len(nach), 1),
        'minMax': [min(nach), max(nach)],
        'nahtVorher': vorher, 'nahtNachher': naht(im),
    }


if __name__ == '__main__':
    q, z = sys.argv[1], sys.argv[2]
    kante = int(sys.argv[3]) if len(sys.argv) > 3 else 512
    zm = int(sys.argv[4]) if len(sys.argv) > 4 else 236
    ko = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
    import json, os
    e = aufbereiten(q, z, kante, zm, ko)
    e['bytes'] = os.path.getsize(z)
    print(json.dumps(e, indent=1))
