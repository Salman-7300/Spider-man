#!/usr/bin/env python3
"""Netzfaden-Textur aus einem erzeugten Bild aufbereiten.

Das Netzmaterial im Spiel ist MeshBasicMaterial mit transparent, alphaTest
0.12 und weisser Grundfarbe. Es braucht also eine Textur MIT Alphakanal:
weiss, wo ein Faden liegt, durchsichtig sonst. Ein erzeugtes Bild ist
undurchsichtig, deshalb wird hier die Helligkeit zum Alphakanal.

Die Kachel wiederholt sich entlang des Fadens (repeat.set(1, len * 0.6))
und laeuft quer um den Zylinder herum. Beide Richtungen muessen also
stetig sein.

Aufruf: netztextur-aufbereiten.py <quelle> <ziel> [kante] [gamma] [band]
"""
import sys
from PIL import Image


def naht(im, kanal, schritt=2):
    w, h = im.size
    px = im.load()
    def wert(x, y):
        p = px[x, y]
        return p[kanal] if isinstance(p, tuple) else p
    def md(paare):
        return sum(abs(a - b) for a, b in paare) / len(paare)
    return {
        'obenUnten': round(md([(wert(x, 0), wert(x, h - 1)) for x in range(0, w, schritt)]), 2),
        'kornZeilen': round(md([(wert(x, h // 2), wert(x, h // 2 + 1)) for x in range(0, w, schritt)]), 2),
        'linksRechts': round(md([(wert(0, y), wert(w - 1, y)) for y in range(0, h, schritt)]), 2),
        'kornSpalten': round(md([(wert(w // 2, y), wert(w // 2 + 1, y)) for y in range(0, h, schritt)]), 2),
    }


def aufbereiten(quelle, ziel, kante=256, gamma=0.75, band=None):
    grau = Image.open(quelle).convert('L')
    if kante and grau.width != kante:
        grau = grau.resize((kante, kante), Image.LANCZOS)
    w, h = grau.size
    if band is None:
        band = max(3, h // 32)

    """Duenne Faeden sind dunkel und wuerden am alphaTest von 0.12
    haengenbleiben. Eine Gammakurve unter 1 hebt gerade sie an, ohne die
    kraeftigen Straenge zu ueberzeichnen."""
    kurve = [min(255, int(round(255 * (i / 255) ** gamma))) for i in range(256)]
    alpha = grau.point(kurve)

    """Rand stetig machen: gegenueberliegende Raender auf ihren
    gemeinsamen Mittelwert ziehen und ueber ein schmales Band ausblenden.
    Ueber wenige Bildpunkte verschmiert das die Faeden kaum, waehrend ein
    Sprung an der Wiederholung als Knick im Faden sichtbar waere."""
    px = alpha.load()
    for i in range(band):
        f = 1.0 - i / band
        for x in range(w):
            a, b = px[x, i], px[x, h - 1 - i]
            m = (a + b) / 2
            px[x, i] = int(round(a + (m - a) * f))
            px[x, h - 1 - i] = int(round(b + (m - b) * f))
    for i in range(band):
        f = 1.0 - i / band
        for y in range(h):
            a, b = px[i, y], px[w - 1 - i, y]
            m = (a + b) / 2
            px[i, y] = int(round(a + (m - a) * f))
            px[w - 1 - i, y] = int(round(b + (m - b) * f))

    weiss = Image.new('L', (w, h), 255)
    aus = Image.merge('RGBA', (weiss, weiss, weiss, alpha))
    aus.save(ziel, optimize=True)
    return {'ziel': ziel, 'kante': w, 'gamma': gamma, 'band': band,
            'alphaNaht': naht(aus, 3)}


if __name__ == '__main__':
    import json, os
    q, z = sys.argv[1], sys.argv[2]
    kante = int(sys.argv[3]) if len(sys.argv) > 3 else 256
    gamma = float(sys.argv[4]) if len(sys.argv) > 4 else 0.75
    e = aufbereiten(q, z, kante, gamma)
    e['bytes'] = os.path.getsize(z)
    print(json.dumps(e, indent=1))
