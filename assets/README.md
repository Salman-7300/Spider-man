# 📦 Eigene 3D-Charaktere (GLB) einbauen

Das Spiel lädt automatisch 3D-Menschenmodelle aus diesem Ordner und ersetzt
damit die eingebauten Figuren. Fehlt eine Datei, erscheint automatisch die
eingebaute Figur – es kann also nie etwas kaputtgehen.

## ⚠️ Wichtig: Mixamo-Dateien gehören ins RELEASE, nicht in den Datei-Upload

Der normale Datei-Upload („Add file → Upload files“) erlaubt **nur 25 MB**.
Für große Dateien gibt es **Releases** – dort sind **2 GB pro Datei** erlaubt.

**Der einfachste Weg – alles auf einmal:**

1. Öffne: <https://github.com/Salman-7300/Spider-man/releases/new>
2. Bei **„Choose a tag“** irgendeinen Namen eintippen (z. B. `mixamo-1`) und
   **„Create new tag“** klicken
3. **Alle** FBX-Dateien aus dem Download-Ordner in das Feld
   **„Attach binaries by dropping them here“** ziehen – auf einmal, ohne
   Sortieren und ohne Umbenennen
4. **„Publish release“** klicken

Die Umwandlung erkennt dann von selbst:

- welche Datei ein **Modell** ist (enthält ein Netz, aber keine Bewegung)
- welche Datei eine **Animation** ist und welche Bewegung sie zeigt
- welche Dateien **doppelt** sind – von mehreren Versionen derselben Bewegung
  gewinnt automatisch die kleinste (der „Without Skin“-Download)

Modelle werden der Reihe nach auf `civilian`, `civilian2`, `civilian3`
verteilt; Figuren mit typischen Schurkennamen (z. B. *Warrok*, *Brute*,
*Zombie*) landen beim Gegner (`thug`). Der Held behält sein Netz-Kostüm,
außer eine Datei heißt ausdrücklich `hero...` oder `spider...`.

Weil alle Mixamo-Figuren dasselbe Skelett benutzen, gilt **ein Satz
Animationen für alle Figuren** – du musst also nicht pro Charakter
Bewegungen hochladen.

**Wenn du die Zuordnung selbst bestimmen willst:** Nenne den Release-Tag nach
der Figur (`thug-1`, `civilian-1`, `hero-1`) – dann gehören alle Dateien
dieses Releases zu genau dieser Figur.

## Wie Dateien erkannt werden

- **Modell oder Animation?** Wird am *Inhalt* der Datei erkannt, nicht am Namen.
  Eine Datei ohne Animation (T-Pose-Export) wird zum Modell, alles andere zur
  Animation.
- **Welche Animation?** Über Schlüsselwörter im Dateinamen:

| Im Dateinamen | wird zu |
|---|---|
| `Idle`, `Breathing`, `Standing` | Stehen |
| `Walking` | Gehen |
| `Running`, `Jog`, `Sprint` | Rennen |
| `Jump`, `Fall` | Springen |
| `Punching`, `Jab`, `Hook` | Schlag |
| `Kick` | Tritt |
| `Sit`, `Crouch`, `Dying` | Verletzt am Boden |
| `Climb` | Klettern |
| `Swing`, `Hang`, `Fly` | Netzschwung |

Fehlende Animationen werden automatisch durch passende ersetzt.
`Idle` + `Walking` oder `Running` reichen schon für ein gutes Ergebnis.

## Slots (Figuren)

| Slot | Wird verwendet für |
|---|---|
| `hero` | dein Held |
| `civilian` | Zivilisten |
| `civilian2`, `civilian3` | weitere Zivilisten-Varianten (optional) |
| `thug` | Gegner ✅ *(Beispiel liegt bei)* |

Ergebnisdateien: `<slot>.glb` (Modell) und `<slot>@<animation>.glb`.

## Mixamo-Downloadeinstellungen

- **Modell** (einmal pro Charakter): Charakter wählen → Download →
  Format **FBX Binary**, Pose **T-Pose**
- **Animationen**: Format **FBX Binary**, Skin **Without Skin**, 30 FPS,
  bei „Walking“/„Running“ unbedingt **„In Place“** ankreuzen

„With Skin“ funktioniert auch – die Umwandlung räumt automatisch auf, der
Upload dauert nur länger.

## Selbst umwandeln (ohne GitHub)

```bash
npm install --prefix tools               # einmalig
# FBX-Dateien nach tools/input/ legen, dann:
node tools/convert-mixamo.mjs tools/input assets --slot=thug
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
