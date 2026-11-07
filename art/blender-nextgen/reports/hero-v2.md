# Web Hero Next-Gen v2 – eigenes Modell

Quellen: `source/build_hero_v2_body.py` (Körper), `source/build_hero_v2.py` (Gewichte, UV),
`source/build_hero_v2_suit.py` (Anzug, Linsen, Materialien), `source/accept_hero_v2.py` (Abnahme);
Messdaten `hero2-blender.json`, `hero2-threejs.json`. Export `exports/webhero-nextgen-v2.glb`.

## Lizenz – Grund für das neue Modell

| Teil | Herkunft | Ergebnis |
|---|---|---|
| `assets/hero.glb` (Spiel, bisher) | Datei-interne Knoten `Sketchfab_model` → `Amazing Spider Man 2 Rigged.fbx`; Fanmodell eines Marvel/Sony-Kostüms. `docs/MODELL-QUELLEN.md` nennt fälschlich Mixamo | **nicht geklärt**, für eine Veröffentlichung nicht freigebbar |
| Web Hero v1 (Prototyp) | Geometrie, Skelett, Gewichte = `hero.glb`, nur neu bemalt | erbt das Problem, **nicht veröffentlichungsreif** |
| **Web Hero v2** | Geometrie, UV, Texturen, Linsen: **in dieser Arbeit erzeugt** (Skripte im Repo). Skelett und Gewichtsvorlage: Mixamo-Skelett (`thug.glb` = Mixamo „Vanguard“, laut Adobe-FAQ lizenzfrei in Spielen nutzbar, Rohdateien nicht einzeln weitergeben) | eigenes Modell; offen ist nur die allgemeine Mixamo-Frage, die für alle Figuren des Spiels gleich gilt |

Adobe nennt in seinen Mixamo-FAQ die lizenzfreie Nutzung für Spiele; die Seite selbst war beim Abruf nicht lesbar (HTTP 403), die Aussage stammt aus der Suche und dem Adobe-Forum-FAQ. Vor einer kommerziellen Veröffentlichung bitte direkt prüfen.

## Was an der Geometrie wirklich neu ist

Nichts stammt von `hero.glb`. Der Körper ist aus Muskelvolumen entlang der echten Knochen modelliert:
Kopf (glatte Maskenform, flacher Brauenbogen, Wangenknochen), Hals, Trapez, Brustkorb, Brustmuskeln,
Latissimus (V-Form), schmale Taille, Bauch, Becken, Gesäß, Deltamuskeln, Bizeps/Trizeps, Ellbogen,
Unterarme (Beuger/Strecker), Hände mit fünf einzeln geformten Fingern, Oberschenkel mit Quadrizeps und
Beinbeuger, Kniescheibe, Wade, Knöchel, Stiefelform. Ein Messfehler in der ersten Fassung (Metaball-Radius
0,837 angenommen, 0,574 gemessen) ist kalibriert und dokumentiert.
Aufbau: Metaballs → Voxel-Vereinigung (0,0042 m) → Glätten → QuadriFlow-Quadnetz (Körper) bzw.
feiner Voxel + Reduktion (Hände, damit die Finger getrennt bleiben).

## Anzug, Maske, Linsen

- Navy/Anthrazit, dunkelrote Schulterpasse mit V, anthrazite Seitenpaneele mit Naht, rotes Gürtelband
  mit Silberpaspeln, rote Armoberbahnen, rote Handschuhe mit Navy-Manschette, Knieverstärkung, rote Stiefel
  mit Paspel, dunkle Zehenkappe und Sohle, feiner Köper + Tonvariation.
- Eigenes Emblem (doppelter Pfeilwinkel + Raute) vorn und größer hinten; kein Netz-, kein Spinnenmotiv.
- Maske zweifarbig (rot, dunkle Kinn-/Wangenpartie) mit Mittel-, Brauen- und Wangennaht.
- Linsen: eigene kantige Form (innen schmal, außen hoch gezogen), in Ringen radial auf den Kopf projiziert,
  durchgehender dunkler Rahmen, am Kopfknochen.
- Texturen 1024² (Farbe, Rauheit, Normalkarte aus den Nahthöhen), gemalt in 2048² nach Körperlage und Gewichtszone.

## Rig und Animationen

Mixamo-Skelett (67 Gelenke, gleiche Namen/Achsen wie die Spielclips). Gewichte vom Mixamo-Referenzkörper
desselben Skeletts übertragen, 2× geglättet, max. 4 Einflüsse, 0 ungewichtete Ecken.
Three.js (Spiel-Behandlung, exportiertes GLB): idle, walk, run, sprint, jump, land, roll, fall, swing,
schwungpose, zip_zug, gleiten, sturzflug, sturzflug2 (W), klettern, klettern_seit, wandlauf, kante, punch,
kick, uppercut, hit, luftangriff, block, ausweichenL → **25/25, 0 fehlende Knochen**.
Blender-Posen (wie im Spiel angewandt): Hocke/Rolle, hoher Tritt, Schwung, Wandlauf, Gleiten, Sturzflug,
Landung – keine gebrochenen Gelenke, keine abstehenden Teile.

Bekannt: Der v1-Landeprototyp adressiert zusätzlich `_rootJoint` (gibt es im v2-Skelett nicht) –
diese eine Spur bleibt wirkungslos, die übrigen 51 greifen.

## Kosten

| | `hero.glb` / v1 | v2 |
|---|---|---|
| Dreiecke | 13 400 | 14 958 |
| Zeichenaufrufe | 7 | **3** |
| Materialien / Texturen | 7 / 8 (~30,7 MB GPU) | 3 / 3 (~16 MB GPU) |
| GLB | 2,17 / 2,60 MB | **1,04 MB** |
| Bind-Höhe | über Knochen gemessen | 1,79 m (Spiel normiert auf 1,76 m über die Mesh-Box) |
