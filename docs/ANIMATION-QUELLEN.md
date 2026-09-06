# Woher die Bewegungen kommen - und was aus einem Release wirklich brauchbar ist

Zu den Releases im Repo (`mixamo-*`, `animation-*`, `hero-*`, `civilian-*`)
kommen fertige Modelle und Bewegungsdateien. Nicht alles davon ist neu, und
nicht alles darf ins Spiel. Diese Notiz haelt fest, wie geprueft wird, damit
dieselbe Datei nicht zweimal eingebaut wird.

## Die drei Fragen, in dieser Reihenfolge

**1. Darf die Datei ueberhaupt benutzt werden?**
Alles, was aus einem kommerziellen Spiel stammt, faellt raus - auch dann,
wenn es technisch passt. Erkennungszeichen: `.smpcmod` (Modding-Werkzeug fuer
Marvel's Spider-Man Remastered), `.pak`/`.uasset` aus einem Spielordner,
Dateinamen mit `-<zahl>-<zahl>-<zeitstempel>` (Nexus-Mods-Schema), Ordner mit
den Originaltexturen eines Spiels.

**2. Passt das Skelett?**
`node tools/anim-vergleich.mjs <neu.glb> <vorhanden.glb>` listet zuerst die
bewegten Knochen beider Dateien. Sind die Namen dieselben (Mixamo:
`mixamorig:Hips` usw.), laesst sich die Datei ohne Umrechnung benutzen -
`tools/convert-mixamo.mjs` macht daraus direkt `<slot>@<name>.glb`.
Fehlende Fingerspuren sind kein Hindernis: das Spiel entfernt Fingerspuren
aus Clips ohnehin (`entferneFinger`) und setzt die Finger selbst.
Steht dort dagegen "keine gemeinsamen Knochen", braucht es eine
Namenszuordnung und eine Umrechnung ueber die Knochenachsen - dafuer gibt es
`tools/retarget-ue4.mjs` (dort fuer das UE4-Mannequin).

**3. Ist die Bewegung wirklich neu?**
Dieselbe Frage, die man im Standbild nicht beantworten kann: zwei
Kriechbewegungen sehen immer gleich aus. `tools/anim-vergleich.mjs` tastet
beide Kurven auf 40 Stellen ueber ihre eigene Laenge ab und gibt den
groessten Winkelunterschied je Knochen aus.

    unter  3 Grad im Mittel  ->  dieselbe Bewegung, kein Gewinn
    rund  14 Grad im Mittel  ->  dieselbe Bewegung, andere Fassung
    ueber 30 Grad im Mittel  ->  wirklich etwas anderes

## Beispiel: Release `animation-2` (September 2026)

Vier Dateien, gemessen mit genau diesem Ablauf:

| Datei | Befund | Ergebnis |
|---|---|---|
| `Expressive.Web.Climbing...rar` | enthaelt `.smpcmod` - Mod fuer Marvel's Spider-Man Remastered | nicht verwendbar (Frage 1) |
| `swing-to-land-spider-man-rig-update.zip` | 52 bewegte Knochen, identisch zu `hero@schwungland.glb`; Mittel **2,1 Grad**, Maximum 12,4 (nur Daumen) | dieselbe Bewegung, kein Gewinn |
| `low-crawl-spiderman.zip` | "Low Crawl" auf Mixamo-Skelett, 22 bewegte Knochen. `hero@kriechen.glb` IST bereits Low Crawl, hat aber **65** bewegte Knochen. Mittel **14,0 Grad** (Fuesse und Haende) | dieselbe Bewegung in schlechterer Fassung |
| `spiderman-walk-animation.zip` | fremdes Skelett (`COG_J`, `Pelvis_J`, `L_shldr_J` ...), 21 bewegte Knochen, 1,03 s | nur nach Umrechnung nutzbar; wir haben `hero@walk.glb` bereits |

Aus diesem Release wurde deshalb nichts uebernommen. Das ist kein Versaeumnis,
sondern das Ergebnis der Messung - und in fuenf Minuten wiederholbar.

## Stolperstein beim Ansehen einer fremden GLB

FBX2glTF schreibt fuer TGA-Texturen `"mimeType": "image/unknown"`. Der
GLTFLoader wartet dann im Browser ewig auf ein Bild, das er nie dekodieren
kann - die Datei wird nie fertig geladen, ohne Fehlermeldung. Wer eine
solche Datei nur anschauen will, entfernt vorher `images`, `textures` und
`samplers` aus dem JSON-Teil der GLB.
