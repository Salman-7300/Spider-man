# 📦 Eigene 3D-Charaktere (GLB) einbauen

Lege hier einfach GLB-Dateien mit diesen Namen ab – das Spiel erkennt sie
automatisch und ersetzt damit die eingebauten Figuren:

| Dateiname | Wird verwendet für |
|---|---|
| `hero.glb` | dein Held |
| `civilian.glb` | Zivilisten |
| `civilian2.glb`, `civilian3.glb` | weitere Zivilisten-Varianten (optional) |
| `thug.glb` | Gegner ✅ *(Beispiel liegt schon bei)* |

Fehlt eine Datei, nutzt das Spiel automatisch die eingebaute Figur –
es geht also nie etwas kaputt.

**Wichtig:** GLB-Modelle werden nur geladen, wenn das Spiel über eine
Webseite (z. B. GitHub Pages) oder einen lokalen Server läuft. Beim
Doppelklick auf `index.html` (file://) blockiert der Browser das Nachladen
von Dateien – dann erscheinen die eingebauten Figuren.

## Woher bekomme ich Modelle?

- **[Mixamo](https://www.mixamo.com)** (kostenlos, Adobe-Konto nötig):
  Charakter aussuchen → Animationen (z. B. *Idle*, *Walking*, *Running*,
  *Punching*) hinzufügen → als **FBX** herunterladen → in
  [Blender](https://www.blender.org) importieren → als **glTF 2.0 (.glb)**
  exportieren (Häkchen bei „Animationen“ setzen)
- **[Ready Player Me](https://readyplayer.me)**: eigene realistische Avatare
  direkt als `.glb`
- **[Sketchfab](https://sketchfab.com)**: Filter „Downloadable“ + Lizenz
  beachten, Format glTF
- **[Quaternius](https://quaternius.com)** / **[Kenney](https://kenney.nl)**:
  kostenlose (CC0) stilisierte Menschen, sehr performant

## Welche Animationen sollte das Modell haben?

Das Spiel sucht Animations-Clips über ihre Namen (Groß-/Kleinschreibung egal):

| Spielsituation | erkannte Namen (Beispiele) |
|---|---|
| Stehen | `Idle`, `Stand` |
| Gehen/Rennen | `Walk`, `Run`, `Jog`, `Sprint` |
| Springen/Fallen | `Jump`, `Fall` |
| Schwingen (Held) | `Swing`, `Fly`, `Hang` |
| Klettern (Held) | `Climb`, `Crawl` |
| Angriff | `Punch`, `Attack`, `Hit`, `Kick` |
| Verletzt sitzen | `Sit`, `Hurt`, `Crouch` |

Fehlende Clips werden automatisch durch passende ersetzt (z. B. Idle).
Mindestens `Idle` + `Walk` oder `Run` reichen schon für ein gutes Ergebnis.

## Modell läuft rückwärts?

Manche Modelle schauen nach −Z statt +Z. Dann in `game.js` oben bei
`GLB_YAW` für den jeweiligen Slot `Math.PI` eintragen, z. B.:

```js
const GLB_YAW = { thug: Math.PI, civilian: Math.PI };
```

## Beiliegendes Beispielmodell

`thug.glb` ist das „Soldier“-Modell aus den offiziellen
[Three.js-Beispielen](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf)
(Mixamo-Charakter „Vanguard“, mit Idle-/Walk-/Run-Animationen) und dient als
Demo für die GLB-Unterstützung. Du kannst es jederzeit durch ein eigenes
Modell ersetzen.
