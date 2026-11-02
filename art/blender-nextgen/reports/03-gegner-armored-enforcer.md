# 03 – Armored Street Enforcer v1

Quellen: `source/build_enforcer.py`, `source/enforcer_texture.py`, `source/gltf_pose.py`,
`source/accept_enforcer.py`; Messdaten `enforcer-blender.json`, `enemy-threejs.json`.

## Design

Schwerer Straßengegner auf Basis des vorhandenen `thug.glb`:
- **Plattenträger-Weste** (Front/Rücken als Platten, Seiten und Säume Stoff), Stehkragen,
  zwei Brusttaschen
- **Schulterpolster** (zwei Lagen, gedeckte rote Kante), Ellbogenschützer, Unterarmschoner
- **Gürtel** mit vier Taschen, Oberschenkeltaschen außen
- **Knieschoner**, schwere **Stiefel**
- **Strickmütze**: urbane Silhouette, Gesicht bleibt frei und erkennbar
- Anzug neu eingefärbt: Oliv-Anthrazit-Funktionsstoff statt Sci-Fi-Panzer; die orangen
  Leuchtstreifen sind gedecktes Dunkelrot ohne Leuchten; Kopf/Gesicht unverändert
  (exakte UV-Maske aus den kopfgewichteten Flächen)
- Die orangen „Sicheln“ des Ausgangsmodells (eigene Netzinsel, 100 Dreiecke) sind
  entfernt: in jeder Bewegung ragten sie wie Klingen aus dem Rücken.

Bauweise: Jedes Ausrüstungsteil wird in der Bind-Pose per Strahlen auf die echte Körperhaut
„angegossen“ (plus Abstand), verdickt, geglättet und erhält die **Skin-Gewichte der
nächstgelegenen Körperfläche** (baryzentrisch, max. 4 Einflüsse). Die Schulterpolster
sind abweichend starr am Oberarm (innen 35 % Schulter), siehe unten.

## Rig-Kompatibilität

| Prüfung | Ergebnis |
|---|---|
| Joints | 67 / 67, gleiche Namen, gleiche Hierarchie (einziger Unterschied: Name des Wurzelknotens) |
| Ruhe-Pose gegen `thug.glb` | max. 0,04° Rotation / 7·10⁻⁷ Translation (Rundung) |
| Ungewichtete Ecken | 0 (Körper und Ausrüstung) |
| Clips in Three.js (Spiel-Behandlung) | idle, walk, run, punch, kick, block, hit, fall, ausweichenL, uppercut, Threat Taunt: je **0 fehlende Knochen** |
| Retargeting | nicht nötig |

## Neue Animation: Threat Taunt (`animations/enemy-threat-taunt-v1.glb`)

3,0 s, 30 fps, gebacken (alle Knochen gesampelt, 78 KB). Aufrichten (Brust hoch, Schultern
zurück, Kinn hoch) → rechter Arm hebt sich, Faust erhoben → zweimal auf den Spieler zeigen
mit Kopfnicken → linke Faust vor dem Bauch → kontrollierte Rückkehr. Start und Ende sind
exakt das erste Idle-Bild (Abweichung 0,0°), damit der Übergang in Idle nahtlos ist.
Nur Rotationen der 22 Körperknochen; keine Positionsspur, keine Finger (das Spiel verwirft beides).

Wichtiger Befund: Mixamo-Aktionen sind in Blender relativ zur Ruhe-Pose der **Clip-Datei**,
die beim thug um bis zu 20° von `thug.glb` abweicht – Blender zeigte die Clips dadurch fast als
T-Pose. Das Spiel schreibt die lokalen Rotationen dagegen direkt in die Knoten.
`gltf_pose.py` bildet genau das nach (Knoten-Ruhe + Achskorrektur des Importers); die Blender-
Posenbilder und die Taunt-Basis verwenden diese Umrechnung.

## Skinning-Befunde

| Befund | Status |
|---|---|
| Schulterpolster standen bei hängendem Arm wie Flügel ab (Gewichte aus der T-Pose verteilt auf Rumpf/Arm) | behoben: Polster starr am Oberarm, beginnen außerhalb des Trapezes |
| Weste in der T-Pose: Strahlen trafen die Arme → Fass-Silhouette | behoben: Strahlstart 0,25 m, Seiten eingezogen |
| Stiefel: Strahlen trafen das andere Bein | behoben: Innenseite mit kurzem Strahlstart |
| Unter Spiel-Licht fast schwarze Silhouette | behoben: Grundfarben ≥ 0,13 linear |
| Bei starkem Tritt (kick) wird die Weste an der Hüfte etwas gestaucht | sichtbar, akzeptiert (folgt den Körpergewichten) |

## Kosten

| | bisher `thug.glb` | Enforcer v1 |
|---|---|---|
| Dreiecke | 14 808 | 24 972 (Körper 14 708 + Ausrüstung 10 264) |
| Zeichenaufrufe | 1 | 4 (Körper + 3 Ausrüstungsmaterialien) |
| Materialien | 1 | 4 |
| Texturen | 3 (diffuse, glow, normal) | 2 (diffuse, normal) = ~10,7 MB GPU inkl. Mips |
| Datei | 1,11 MB | 2,49 MB (Diffuse als JPEG, Normal als PNG) |
| Ladezeit lokal | – | ~45 ms |

Hinweis Größe: Das Spiel normiert jede Figur über die Bounding Box auf 1,76 m. Mit Mütze
ist der Enforcer 1,82 Einheiten hoch und wird dadurch ~3 % kleiner skaliert als der thug.
Bei Übernahme ggf. eigene Zielhöhe (z. B. 1,82 m) für diese Rolle.

## Bilder / Video

- Blender (EEVEE, Studio): `renders/enforcer/00…10` (Vergleich, T-Pose vorn, Seite, Rücken,
  3/4, Detail, Punch, Kick, Idle, drei Taunt-Phasen)
- Three.js r128 (exportiertes GLB, Spiel-Licht, gestellte Testszene): `renders/threejs/enemy/*`
- Video (Three.js, alt links / neu rechts, gleiche Zeit und Kamera): `renders/videos/enemy-threejs-compare.mp4`
