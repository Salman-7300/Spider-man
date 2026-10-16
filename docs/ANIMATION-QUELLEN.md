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

## Beispiel: Release `hero-4` - Laufen und Rennen (September 2026)

Das Unreal-Projekt "SpiderMan Traversal Project" bringt 145 Bewegungen mit,
darunter `Running`, `Running1`, `Jog_Forward1`, `Jog_Forward2`. Der Wunsch
war, damit das Laufen im Spiel zu ersetzen. Geprueft mit demselben Ablauf -
und **nichts davon uebernommen**. Warum, mit Zahlen:

**Frage 3 zuerst: sind es ueberhaupt verschiedene Dateien?**
`Jog_Forward1` und `Jog_Forward2` sind identisch (2,8 Grad Mittel),
`Running` und `Running1` unterscheiden sich nur an der rechten Hand
(31,8 Grad dort, sonst unter 12). Aus vier Dateien werden also zwei.

**Die Eigengeschwindigkeit.** Gemessen als Rueckwaertsgeschwindigkeit des
Standfusses gegenueber der Huefte, gemittelt ueber den Bodenkontakt. Zur
Probe liefert dasselbe Verfahren fuer `walk` 1,486 m/s, waehrend
`GANG_REF.walk` unabhaengig davon seit langem auf 1,49 steht:

    walk 1,486   gehen 1,367   run 2,840   sprint 3,466   sprint_lang 6,879
    Running 4,281   Jog_Forward 1,672

**Fuellen sie eine Luecke?** Nein. Die Gangartenkette hat vier Stufen, und
jede laeuft schon mit einem Zeitfaktor zwischen 1,3 und 1,9 - keine haengt
am Anschlag. Gemessen wurde das Netto-Rutschen: wie weit ein Fuss waehrend
EINES ganzen Bodenkontakts wandert, im Verhaeltnis zum Weg der Figur:

    2,8 m/s   gehen         Faktor 1,81   Rutschen 20,5 %
    3,2 m/s   run           Faktor 1,45    8,3 %
    4,7 m/s   sprint        Faktor 1,47    8,8 %
    7,0 m/s   sprint_lang   Faktor 1,27   10,1 %
    11  m/s   sprint_lang   Faktor 1,65   14,8 %

**Der eine schwache Punkt** ist der Gehschritt bei 2,8 m/s (20,5 %). Genau
dort waere ein Jog die richtige Gangart - `Jog_Forward` wurde deshalb
eingesetzt und ueber fuenf Bezugstempi durchgemessen:

    Bezug 1,0   Faktor 2,80   Rutschen 42,9 %
    Bezug 1,2   Faktor 2,33   61,2 %
    Bezug 1,4   Faktor 2,00   68,6 %
    Bezug 1,672 Faktor 1,67   49,8 %
    Bezug 2,0   Faktor 1,40   44,9 %

Bei JEDEM Wert rutscht der Jog mehr als doppelt so stark wie der
vorhandene Gehschritt. Seine Fusskontakte tragen nicht - daran aendert
kein Bezugstempo etwas.

**Und `Running`?** Mechanisch brauchbar (4,281 m/s liegt zwischen `sprint`
und `sprint_lang`), aber es gibt keine Stufe, die darauf wartet. Im
Bildvergleich ueber sechs Stellen des Takts wirkt der vorhandene `sprint`
sogar dynamischer: mehr Vorlage, Arme hoeher gefuehrt; `Running` schwingt
die Arme tief nach hinten.

Ergebnis: aus `hero-4` kommen die Kletterbewegungen ins Spiel, das Laufen
nicht. Das ist kein Versaeumnis, sondern das Ergebnis der Messung.
