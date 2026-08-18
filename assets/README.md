# 📦 Eigene 3D-Charaktere (GLB) einbauen

Das Spiel lädt automatisch 3D-Menschenmodelle aus diesem Ordner und ersetzt
damit die eingebauten Figuren. Fehlt eine Datei, erscheint automatisch die
eingebaute Figur – es kann also nie etwas kaputtgehen.

## Der einfache Weg: FBX ins Release, Rest macht GitHub

Mixamo-Dateien sind oft größer als 25 MB und lassen sich deshalb **nicht**
normal zu GitHub hochladen. Lösung: **GitHub Releases** (erlaubt bis 2 GB pro
Datei). Ein Workflow wandelt die Dateien dann automatisch um.

1. Auf GitHub: **Releases → „Draft a new release“**
2. Tag z. B. `mixamo-1` eingeben, Titel frei wählen
3. Alle FBX-Dateien in das Feld **„Attach binaries“** ziehen
   – Namensschema: `<slot>-<teil>.fbx`, zum Beispiel:
   `thug-model.fbx`, `thug-idle.fbx`, `thug-walk.fbx`, `thug-run.fbx`,
   `thug-punch.fbx`, `civilian-model.fbx`, `civilian-idle.fbx`, …
4. **„Publish release“** klicken

Danach läuft der Workflow *„3D-Charaktere aus Release umwandeln“* automatisch:
Er wandelt FBX → GLB um, verkleinert Texturen, entfernt aus Animationsdateien
alles außer der Bewegung (spart ~80 % Größe) und committet die fertigen
Modelle hierher. Das Pages-Deployment startet danach von selbst.

## Slots (Dateinamen)

| Slot | Wird verwendet für |
|---|---|
| `hero` | dein Held |
| `civilian` | Zivilisten |
| `civilian2`, `civilian3` | weitere Zivilisten-Varianten (optional) |
| `thug` | Gegner ✅ *(Beispiel liegt bei)* |

Ergebnisdateien: `<slot>.glb` (Modell) und `<slot>@<teil>.glb` (je Animation).

## Mixamo-Downloadeinstellungen

- **Modell** (einmal pro Charakter): Charakter wählen → Download →
  Format **FBX Binary**, Pose **T-Pose** → speichern als `<slot>-model.fbx`
- **Animationen**: Format **FBX Binary**, Skin **Without Skin**, 30 FPS,
  bei „Walking“/„Running“ unbedingt **„In Place“** ankreuzen
  → speichern als `<slot>-idle.fbx`, `<slot>-walk.fbx`, `<slot>-run.fbx`,
  `<slot>-punch.fbx`

## Welche Animationen erkennt das Spiel?

Über den Dateinamen-Teil bzw. Clip-Namen (Groß-/Kleinschreibung egal):

| Spielsituation | erkannte Teile / Namen |
|---|---|
| Stehen | `idle`, `stand` |
| Gehen / Rennen | `walk`, `run`, `jog`, `sprint` |
| Springen / Fallen | `jump`, `fall` |
| Schwingen (Held) | `swing`, `fly`, `hang` |
| Klettern (Held) | `climb`, `crawl` |
| Angriff | `punch`, `attack`, `hit`, `kick` |
| Verletzt sitzen | `sit`, `hurt`, `crouch` |

Fehlende Animationen werden automatisch durch passende ersetzt.
`idle` + `walk` oder `run` reichen schon für ein gutes Ergebnis.

## Selbst umwandeln (ohne GitHub)

```bash
npm install --prefix tools          # einmalig
# FBX-Dateien nach tools/input/ legen, dann:
node tools/convert-mixamo.mjs tools/input assets
```

## Modell läuft rückwärts?

Manche Modelle schauen nach −Z statt +Z. Dann in `game.js` bei `GLB_YAW` den
Slot auf `Math.PI` setzen, z. B.:

```js
const GLB_YAW = { thug: Math.PI, civilian: Math.PI };
```

## Hinweise

- GLB-Modelle laden nur über http(s) – also auf der Webseite oder mit lokalem
  Server. Beim Doppelklick auf `index.html` (file://) blockiert der Browser das
  Nachladen, dann erscheinen die eingebauten Figuren.
- Weit entfernte Figuren werden aus Leistungsgründen seltener bzw. gar nicht
  animiert (ab 45 m seltener, ab 130 m ausgeblendet).
- `thug.glb` ist das „Soldier“-Modell aus den offiziellen
  [Three.js-Beispielen](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf)
  (Mixamo-Charakter „Vanguard“) und dient als Demo. Du kannst es jederzeit
  ersetzen.
