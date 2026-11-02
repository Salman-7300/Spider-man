# 05 – Animations- und Three.js-Kompatibilität

## Wie geprüft wird

1. **Dateiebene** – `tools/compat-test.cjs` (nur lesend, Ergebnis `compat-test.json`, Exit-Code ≠ 0 bei Fehler):
   12 Prüfungen, **12/12 bestanden**:
   - Held: Knoten, Transformationen, Skin, inverse Bind-Matrizen, alle Vertex-Attribute und Indizes
     bytegleich mit `assets/hero.glb` (einzige Ausnahme: Linsenpositionen)
   - Enforcer: gleiche 67 Gelenke wie `thug.glb`, Ruhe-Rotationen max. 0,04° abweichend
   - Threat Taunt: erstes und letztes Bild = `thug@idle` Bild 0, nur bekannte Knochen
   - Hero Landing: letztes Bild = `hero@idle` Bild 0, alle 22 Körperknochen angesteuert
2. **Browser** – `preview/` mit `tools/cdp-capture.cjs` + `plan-*.cjs` in headless Chrome (WebGL 2,
   Three.js r128 aus `lib/`). Clips werden wie in `game.js` behandelt: Knochennamen vereinheitlicht
   (`knochenName`), Positions- und Fingerspuren entfernt, Figur auf 1,76 m normiert, Metall ≤ 0,08,
   Rauheit 0,35–0,9, Eigenleuchten 0x14141a, Schattenkurve auf Texturen, lineare Ausgabe ohne
   Tonemapping, Sonne + Himmel mit den Spielwerten, Bodenausgleich über die Zehenknochen.
   Für jeden Clip: `boneCheck` (jede Spur muss einen Knochen treffen) und Bild alt/neu bei
   gleicher Kamera, Zeit und Belichtung.
3. **Blender** – Posen werden mit `source/gltf_pose.py` exakt so angelegt, wie das Spiel sie
   anwendet (siehe Befund unten), und gerendert.

## Ergebnisse

| Figur | Clips | fehlende Knochen | Spuren | Aufrufe | Dreiecke |
|---|---|---|---|---|---|
| Enforcer | idle, walk, run, punch, kick, block, hit, fall, ausweichenL, uppercut, Threat Taunt | 0 | 22 (Taunt 54 inkl. Skalierung) | 4 | 24 972 |
| Web Hero | idle, walk, run, sprint, jump, land, roll, fall, swing, schwungpose, zip_zug, gleiten, sturzflug, sturzflug2, klettern, klettern_seit, wandlauf, kante, punch, kick, uppercut, hit, luftangriff, Landing | 0 | 22 (Landing 52) | 7 | 13 400 |

Keine Root-Motion in den Prototyp-Clips (Positionsspuren würden vom Spiel ohnehin verworfen).

## Befunde

- **Mixamo-Clips in Blender:** Ein importierter Clip ist in Blender relativ zur Ruhe-Pose der
  *Clip-Datei* gespeichert; die weicht beim thug um bis zu 20° von `thug.glb` ab. Das Spiel schreibt die
  lokalen Rotationen dagegen direkt in die Knoten. Ohne Umrechnung standen die Figuren in Blender
  fast in T-Pose. `gltf_pose.py` rechnet über Knoten-/Bind-Ruhe und die Achskorrektur des
  Importers um; die Exporte treffen die Spielwerte nachweislich (Prüfungen oben).
- **Held: Bind-Pose ≠ Knoten-Ruhe.** Die Bind-Pose von `hero.glb` liegt waagerecht
  (Sketchfab-Ausrichtung). Für Blender wird deshalb die Bind-Pose aus den inversen Bind-Matrizen
  als Bezug genommen.
- **Importierte Clip-Aktionen haben mehrere Slots:** Slot 0 ist der Objekt-Slot. Falsch gebunden
  hob er die Figur 2 m an. Jetzt wird der Knochen-Slot gewählt, und Nicht-Rotationen werden entfernt.
- Viewer-Fehler (behoben, nicht im Modell): Klone teilen Materialien mit dem Cache. Die Schattenkurve
  wurde dadurch mehrfach angewendet, und die Figuren wurden weiß.

## Animationsprototypen

| Datei | Länge | Inhalt |
|---|---|---|
| `animations/enemy-threat-taunt-v1.glb` | 3,0 s | Aufrichten → Faust heben → zweimal zeigen + Nicken → zurück in Idle |
| `animations/webhero-landing-pose-v1.glb` | 2,1 s | Fall → tiefe Landehocke → Halten → Aufrichten → Idle |

Beide sind nur Rotationen, gebacken mit 30 fps und als eigene Dateien abgelegt.
Keine bestehende Animationsdatei wurde überschrieben.

## Nicht geprüft

- Kein Lauf im echten Spiel (die Prototypen sind absichtlich nicht eingebunden). Die
  Spiel-Behandlung ist im Viewer nachgebaut, nicht aus `game.js` geladen.
- Bewegungen, die das Spiel selbst prozedural verändert (Wandkriechen-Kippung, Schwung-Bogen,
  Spiegelungen), sind nicht nachgestellt.
