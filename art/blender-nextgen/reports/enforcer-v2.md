# Enforcer v2 – Polish

Quellen: `source/build_enforcer_v2.py`, `source/enforcer2_texture.py`, `source/accept_enforcer_v2.py`,
Messdaten `enforcer2-blender.json`, `enemy2-threejs.json`. Export `exports/enemy-armored-enforcer-v2.glb`.
Skelett unverändert (thug, 67 Gelenke).

## Was gegenüber v1 besser ist (gemessen bzw. in identischer Pose verglichen)

| Punkt | v1 | v2 |
|---|---|---|
| Weste beim hohen Tritt | Unterkante unter dem Hüftgelenk, Gewichte vom nächsten Körperpunkt (Oberschenkel) → vorne mitgezogen | Unterkante 1,045 m (über dem Hüftgelenk), Gewichte **nur** Hips/Spine/Spine1/Spine2/Schultern → bleibt am Rumpf (`00_compare_kick.jpg`) |
| Schulterlinie | Kragen-Strahlen trafen die T-Pose-Arme → Lappen, die bei Bewegung als „Stacheln“ abstanden | Kragen am Hals gestrahlt, nur Spine2/Neck → saubere Schulterlinie in allen Posen |
| Gürtel, Taschen | Gewichte teils vom Oberschenkel | starr am Becken |
| Oberschenkeltaschen, Knieschoner, Stiefel, Unterarmschoner, Ellbogen | gemischte Nachbargewichte | jeweils nur die eigenen Gliedknochen |
| Körperbau | Original-Körper | Schultern/Oberarme +9–10 mm, Brust +8–10 mm, Oberschenkel +10 mm entlang der Normalen (Bind-Pose) |
| Materialien | einfarbige Flächen | Stoff: Ripstop-Nylon (Farbe + Normalkarte, 256² kachelbar); Platten: feine Körnung; Weltmaßstab-UV (9 Kacheln/m) |
| Körpertextur | harte Sci-Fi-Plattenkanten sichtbar | Luminanz weicher, Hose dunkles Oliv / Oberteil Anthrazit getrennt |
| Höhe in Bind-Pose (Spiel normiert auf 1,76 m) | 1,812 → 1,2 % kleiner als der thug | 1,800 (Mütze eng) → 0,6 % kleiner |

## Kosten

| | v1 | v2 |
|---|---|---|
| Dreiecke | 24 972 | 24 972 |
| Zeichenaufrufe | 4 | **2** (Ausrüstung: ein Material mit Eckfarben) |
| Texturen | 2 (1024²) | 4 (2× 1024², 2× 256²) |
| GLB | 2,49 MB | 2,54 MB |

## Prüfungen
- Blender: 0 NaN, 0 ungewichtete Ecken, keine negative Skalierung, Export/Re-Import ok.
- Three.js (Spiel-Behandlung): idle, walk, run, punch, kick, block, hit, fall, ausweichenL, uppercut, Threat Taunt → 0 fehlende Knochen.
- Korrekturrunden: 1 (Kragen).

## Leistungskorrektur (nach Messung im Spiel)

Die erste v2-Fassung hatte wie v1 vier Zeichenaufrufe je Enforcer. `stadt-leistung.js` zeigte damit im
Spiel 865,5 (Gesamt) und **909,5 in der Luftansicht** gegenüber 857 / 890,5 bei `f4f2b2b`. Platte, Stoff und
Akzent sind deshalb jetzt Eckfarben (COLOR_0) unter **einem** Material mit der Stoff-Detailtextur:
2 Zeichenaufrufe je Enforcer – so viele wie thug + Rollenweste vorher. Rauheit ist dabei für alle
Ausrüstungsteile einheitlich 0,74 (vorher 0,62 / 0,88 / 0,6).
