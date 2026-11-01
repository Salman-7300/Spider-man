# 01 – Blender-Verbindung und Bestandsaufnahme

Stand: 2026-11-01, Branch `art/blender-nextgen-prototypes`, Ausgang `e05d424`.
Alle Zahlen stammen aus Werkzeugläufen in dieser Sitzung, nicht aus Annahmen.

## A. Blender-MCP-Verbindung

| Prüfung | Ergebnis |
|---|---|
| Lesender Zugriff (`execute_blender_code`, Szeneninhalt) | ✅ echte, laufende Blender-Sitzung (GUI, nicht Hintergrund) |
| `bpy.app.version_string` | **5.2.1 LTS** |
| Python in Blender | 3.13.13 (MSC v.1944, 64 bit) |
| Blender-Dateipfad | ungespeicherte Startdatei (`""`), Szene `Scene` mit `Cube`, `Light`, `Camera` – wurde nicht verändert |
| Arbeitsverzeichnis von Blender | `C:\Program Files\Blender Foundation\Blender 5.2` |
| Import/Export-Operatoren | `import_scene.gltf/fbx`, `export_scene.gltf/fbx` (Parameter der installierten Version ausgelesen, z. B. `export_def_bones`, `export_influence_nb`, `use_active_scene`) |
| Render-Engines | `BLENDER_EEVEE` (Cycles nicht aktiviert – nicht benötigt) |
| Add-on | `lab_blender_org/mcp` (Blender Lab MCP, Extension) aktiv, Server läuft im Blender-Prozess |

### Schreib-/Exporttest (`_conntest/`)

1. Eigene Szene `ConnTest`, Würfel mit Position (1,25 / −2,5 / 0,75), Skalierung (2 / 1 / 0,5), Material Rot/Rauheit 0,42.
2. `.blend` per `bpy.data.libraries.write` → `_conntest/conntest.blend` (175 806 B).
3. GLB-Export → `_conntest/conntest.glb` (3 416 B).
4. Re-Import: Position, Skalierung, Rotation identisch; Material `ConnMat` mit Farbe (0,8/0,1/0,05) und Rauheit 0,42 erhalten.
5. Testszene und Testobjekte danach aus der Blender-Sitzung entfernt.

Befund am Rand: Beim ersten Export mit `use_selection=True` wurde der in der
Startszene ausgewählte Standardwürfel mit exportiert. Alle Exporte heben deshalb
jetzt vorher jede Auswahl in allen Szenen auf (`source/export_tools.py`,
`deselect_all`) und exportieren nur die aktive Szene.

### Dateizugriff

Blender und Claude Code sehen **dasselbe Dateisystem**: Blender liest
`C:\Users\Salma\Projects\City-Swing-Blender\assets\hero.glb` direkt, und die von
Blender geschriebenen Dateien liegen sofort im Git-Worktree (per `ls` geprüft).
Kein Transferordner nötig.

## B. Bestandsmodelle (`assets/`)

Gemessen mit Blender (Skin-Meshes, ohne die Knochen-Anzeigekugel, die der
glTF-Importer anlegt) und mit `tools/audit-rigs.cjs` direkt aus dem GLB-JSON.

| Modell | Datei | Skin-Dreiecke | Meshes | Materialien | Texturen | Joints | Skins |
|---|---|---|---|---|---|---|---|
| `hero.glb` | 2 173 216 B | 13 400 | 7 | 7 | 8 (6× 1024², 3× 512²) | 66 | 1 |
| `thug.glb` | 1 108 204 B | 14 808 | 1 | 1 | 3 (1024²: diffuse, glow, normal) | 67 | 1 |
| `civilian.glb` | 3 800 860 B | 35 193 | 7 | 6 | 15 | 67 | 6 |
| `civilian2.glb` | 6 435 340 B | 53 452 | 6 | 2 | 4 | 65 | 4 |

Details: `model-baseline-heights.json`, `rig-audit.json` (vollständige Hierarchien).

- **Vorwärtsrichtung:** Zehen liegen bei allen Gegner-/Zivilmodellen in Blender −Y
  vom Knöchel ⇒ nach glTF-Export +Z in three.js. Das deckt sich mit `GLB_YAW = {}`
  in `game.js` (Spiel erwartet Blick nach +Z).
- **Maßstab:** Das Spiel misst jede Figur über `Box3.setFromObject` und skaliert auf
  1,76 m (`messeModell`). Thug: 1,79 Einheiten → Faktor 0,983. Der Held hat ein
  Armature-Objekt mit Weltmaßstab 0,000127 und liegt in der Bind-Pose entlang
  Blender-Y (Sketchfab-Wurzeldrehung); das Spiel normiert das ebenfalls über die Box.
- **Skin-Gewichte:** alle Skin-Meshes vollständig gewichtet (0 ungewichtete Ecken),
  max. 4 Einflüsse (Hero-Teilmeshes 2–4).

## C. Skelette

- Hero: 66 Joints = `_rootJoint` + 65 Mixamo-Knochen.
- Thug: 67 Joints = 65 Mixamo-Knochen + `LeftEye`, `RightEye`.
- Hero ↔ Thug: identische Mixamo-Namen und -Hierarchie, Unterschied nur `_rootJoint`
  (Hero) bzw. die zwei Augenknochen (Thug).
- Namen werden im Spiel über `knochenName()` vereinheitlicht (`mixamorig:Hips_98` → `mixamorigHips`).

## D. Animationen – was wirklich angesteuert wird

Alle geprüften Clips (Hero: idle, walk, run, sprint, jump, land, swing, klettern,
klettern_seit, gleiten, punch, kick, roll, fall, schwungpose, zip_zug, wandlauf,
kante, uppercut, hit, luftangriff, sturzflug, sturzland, schwungland; Thug: idle,
walk, run, punch, kick, block, hit, fall, ausweichenL/R, taunt, uppercut) existieren.

- Jeder Clip steuert **22 Nicht-Finger-Knochen** an (Hips, Spine–Spine2, Neck, Head,
  Schultern, Ober-/Unterarme, Hände, Ober-/Unterschenkel, Füße, Zehen) plus 0–30 Fingerknochen.
- **Kein** angesteuerter Knochen fehlt am Hero- oder Thug-Modell.
- Das Spiel entfernt beim Laden alle Positionsspuren (`entferneVersatz`) und alle
  Fingerspuren (`entferneFinger`). Wirksam sind also nur **lokale Rotationen** der 22 Knochen.
- `hero@*`- und `thug@*`-Dateien gleichen Namens sind byte-identisch groß
  (dieselben Mixamo-Clips).

### Folgerung für die neuen Charaktere

Weil die Rotationsspuren absolut auf die lokalen Knochen geschrieben werden,
funktionieren alle vorhandenen Clips **ohne Retargeting genau dann**, wenn
Knochennamen, Hierarchie und Ruhe-Orientierungen identisch bleiben. Beide neuen
Figuren verwenden deshalb das vorhandene Skelett unverändert (gleiche Bind-Pose,
gleiche Namen) und tauschen bzw. ergänzen nur sichtbare Meshes und Materialien.
Ein neues Skelett wäre nur mit Retargeting jeder Datei nutzbar – das ist
ausdrücklich nicht vorgesehen.
