"""GLB mit kleinerer Textur neu packen.

Das erzeugte Haus wog 3,63 MB, davon 2,91 MB eine einzige 2048er JPEG mit
nahezu voller Qualitaet. Das komplette bestehende Hauspaket des Spiels wiegt
2,93 MB - ein einzelnes Haus darf also nicht mehr wiegen als das Ganze.
"""
import json, struct, sys, io
from PIL import Image

def lade(p):
    b = open(p, 'rb').read()
    off, js, binb = 12, None, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off)
        chunk = b[off+8:off+8+ln]
        if ty == 0x4E4F534A: js = json.loads(chunk.decode('utf8'))
        elif ty == 0x004E4942: binb = bytearray(chunk)
        off += 8 + ln
    return js, binb

def schreibe(p, js, binb):
    jb = json.dumps(js, separators=(',', ':')).encode('utf8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    bb = bytes(binb) + b'\0' * ((4 - len(binb) % 4) % 4)
    ganz = 12 + 8 + len(jb) + 8 + len(bb)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, ganz))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A)); f.write(jb)
        f.write(struct.pack('<II', len(bb), 0x004E4942)); f.write(bb)

def neu(quelle, ziel, kante, guete):
    js, binb = lade(quelle)
    im0 = js['images'][0]; v = js['bufferViews'][im0['bufferView']]
    st = v.get('byteOffset', 0); ln = v['byteLength']
    bild = Image.open(io.BytesIO(bytes(binb[st:st+ln]))).convert('RGB')
    if kante and bild.width > kante:
        bild = bild.resize((kante, kante), Image.LANCZOS)
    aus = io.BytesIO(); bild.save(aus, 'JPEG', quality=guete, optimize=True, progressive=True)
    neuB = aus.getvalue()
    # Neue Textur ans Ende des Puffers haengen, alten Bereich stehen lassen ist
    # Verschwendung - deshalb wird der Puffer neu zusammengesetzt.
    vor = bytes(binb[:st]); nach = bytes(binb[st+ln:])
    pad = (4 - len(vor) % 4) % 4
    vor += b'\0' * pad
    neuStart = len(vor)
    verschiebung = neuStart - st
    neuPuffer = bytearray(vor + neuB)
    padB = (4 - len(neuPuffer) % 4) % 4
    neuPuffer += b'\0' * padB
    nachStart = len(neuPuffer)
    neuPuffer += nach
    for i, bv in enumerate(js['bufferViews']):
        o = bv.get('byteOffset', 0)
        if i == im0['bufferView']:
            bv['byteOffset'] = neuStart; bv['byteLength'] = len(neuB)
        elif o >= st + ln:
            bv['byteOffset'] = o - (st + ln) + nachStart
    js['buffers'][0]['byteLength'] = len(neuPuffer)
    schreibe(ziel, js, neuPuffer)
    return bild.width, len(neuB)

if __name__ == '__main__':
    q, z, k, g = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    w, n = neu(q, z, k, g)
    import os
    print(json.dumps({'ziel': z, 'texturKante': w, 'texturBytes': n,
                      'dateiMB': round(os.path.getsize(z)/1024/1024, 2)}))
