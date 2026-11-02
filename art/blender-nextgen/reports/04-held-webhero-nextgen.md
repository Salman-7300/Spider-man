# 04 – Web Hero Next-Gen v1 (visueller Prototyp)

Quellen: `source/hero_suit.py` (Anzug-Maler + GLB-Neubau), `source/gltf_io.py`,
`source/accept_hero.py` (Blender-Abnahme), Messdaten `hero-blender.json`, `hero-threejs.json`,
`compat-test.json`. **`assets/hero.glb` und alle `assets/hero@*.glb` sind unverändert.**

## Ansatz

Das Heldenmodell ist über viele Runden mit seinen Bewegungen abgestimmt. Deshalb bleiben
Geometrie, Skelett, Bind-Pose, Skin-Gewichte und Gelenkindizes **Byte für Byte** erhalten
(per `tools/compat-test.cjs` geprüft). Neu ist alles Sichtbare, das ohne Eingriff ins Rig geht:

| Teil | Bisher | Neu |
|---|---|---|
| Anzugtextur | Filmanzug mit Netzgitter und Spinnenlogo | komplett neu gemalt, kein Netz-, kein Spinnenmotiv |
| Farbwelt | Rot/Blau | tiefes Navy-Anthrazit, kontrolliertes Dunkelrot, sehr sparsame helle Akzente |
| Emblem | Spinne | eigenes „Schwung-Anker“-Emblem: doppelter Pfeilwinkel + Raute (Brust klein, Rücken größer) |
| Maske | rot mit Netz | zweifarbig: Rot mit Mittel-, Brauen- und Wangennähten, dunkle Kinn-/Wangenpartie |
| Linsen | große Tropfenform | eigene Form: innen schmal und spitz, außen hoch gezogen (nur Kopfknochen, Netz neu geformt) |
| Rauheit/Metall | Karte mit Netzlinien | Zonen: Stoff 0,68, Rot 0,58, Emblem/Paspel 0,4, Linse 0,12 |
| Normalkarte | Muskelrelief + Netzrillen | Muskelrelief geglättet (Netzrillen weg) + eigene Nahtrillen |
| Handgelenkgeräte | rot | Gunmetal mit gedecktem Rot |

Gemalt wird pro Texel aus der **3D-Lage auf dem Körper** (Bind-Pose) und den **interpolierten
Skin-Gewichten** (Körperzone Kopf/Rumpf/Arm/Hand/Bein/Fuß). Das Muster sitzt dadurch am Körper,
nicht an UV-Inseln, und Zonenwechsel liegen genau an den Gelenken. Gemalt in 2048², gespeichert in
1024² (Kantenglättung). Fabric: feiner diagonaler Köper + leichte Tonvariation.

Anzugzonen: rote Schulterpasse mit V zur Brustmitte und silberner Paspel, hellere Seitenpaneele,
rotes Gürtelband mit Paspeln, rote Außenbahnen an den Armen, rote Handschuhe mit dunkler
Manschette, rote Stiefel ab Schienbeinmitte mit Paspel, dunkle Zehenkappe und Sohle.

## Rig und Animationen

| Prüfung | Ergebnis |
|---|---|
| Knoten, Transformationen, Skin, inverse Bind-Matrizen | identisch mit `hero.glb` |
| Positionen, Normalen, Tangenten, UV, Gewichte, Gelenkindizes, Indizes | bytegleich (einzige Ausnahme: Linsen-Positionen) |
| Three.js, Spiel-Behandlung: idle, walk, run, sprint, jump, land, roll, fall, swing, schwungpose, zip_zug, gleiten, sturzflug, sturzflug2, klettern, klettern_seit, wandlauf, kante, punch, kick, uppercut, hit, luftangriff | alle 23 laufen, **0 fehlende Knochen**, 22 Spuren |
| Bewegt sich der neue Held anders als der alte? | nein – gleiche Gewichte, gleiche Knochen: Deformation identisch (Vergleichsvideo) |

Gleiten und beide Sturzflüge (W-gehalten) sind geprüft: waagerechte Lage, keine abstehenden Teile.

Was das **nicht** beweist: Die Deformationsqualität ist so gut wie beim Original –
nicht besser. Schulter- und Knieverformung sind die des bestehenden Skinnings.
Ein neues Mesh mit eigenem Skinning wäre der nächste Schritt (siehe offene Punkte).

## Neue Animation: Hero Landing Pose (`animations/webhero-landing-pose-v1.glb`)

2,1 s, 30 fps, gebacken. Aus echten Spielposen zusammengesetzt: `fall` (in der Luft) →
Aufprall in die tiefste Hocke aus `land` (automatisch gesucht, Bild 0) mit rechtem Arm nach
vorn-unten und linkem Arm zur Balance nach hinten, Blick nach vorn → Halten → Aufrichten →
exakt erstes `idle`-Bild (Abweichung < 0,5° in glTF-Lokalrotationen, geprüft). Keine Positionsspur,
kein Root-Motion. Nicht in die Spiel-Logik eingebaut.

Bekannte Grenze: Die rechte Faust berührt den Boden nicht ganz (Armzielrichtung ohne IK).

## Kosten

| | `hero.glb` | Next-Gen v1 |
|---|---|---|
| Dreiecke | 13 400 | 13 400 |
| Zeichenaufrufe | 7 | 7 |
| Materialien / Texturen | 7 / 8 | 7 / 8 |
| Texturspeicher (GPU, inkl. Mips) | ~30,7 MB | ~30,7 MB (gleiche Auflösungen) |
| Datei | 2,17 MB (WebP) | 2,60 MB (JPEG/PNG; WebP-Encoding wäre der nächste Sparschritt) |
| Ladezeit lokal | ~60 ms | ~55–70 ms |

## Bilder / Video

- Blender (EEVEE, Studio): `renders/hero/00…19` – Vergleich, Grundhaltung vorn/Seite/Rücken/3/4,
  Masken-Detail, idle, walk, run, punch, kick, roll (starke Beugung), swing, climb, glide, dive,
  vier Phasen der Landung
- Three.js r128 (exportiertes GLB, Spiel-Licht): `renders/threejs/hero/*`
- Video (alt links / neu rechts): `renders/videos/hero-threejs-compare.mp4`

## Offene Punkte / ehrliche Einordnung

- **Kein neues Körpermesh.** Proportionen und Silhouette sind die des Ausgangsmodells; der
  Auftrag nannte „bessere Körpergeometrie“. Das ist bewusst nicht gemacht worden, weil ein neues
  Mesh neu geskinnt werden muss und die Kompatibilität dann nicht mehr per Konstruktion garantiert
  ist. Empfehlung: als eigener nächster Schritt, mit diesem Prototyp als Referenz für Farbe und Muster.
- Die Herkunft des Basismodells (`Amazing Spider Man 2 Rigged`, Sketchfab) bleibt dieselbe wie im
  Spiel; Netzmuster und Spinnenlogo sind aus Textur, Rauheits- und Normalkarte entfernt, die
  Linsenform ist geändert. Die Grundsilhouette (Kopfform, Anzugschnitt) stammt weiter von dort.
