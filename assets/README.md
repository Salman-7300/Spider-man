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

| Im Dateinamen | wird zu | wofür im Spiel |
|---|---|---|
| `Idle`, `Breathing`, `Standing` | `idle` | Stehen |
| `Walking` | `walk` | Gehen |
| `Running`, `Jog`, `Sprint` | `run` | Rennen |
| `Jump`, `Leap` | `jump` | Absprung |
| `Fall`, `Air` | `fall` | freier Fall |
| `Land`, `Landing` | `land` | Aufkommen |
| `Swing`, `Hang`, `Brachiat` | `swing` | 🕸️ Netzschwung |
| `Climb`, `Ladder` | `climb` | Klettern an der Wand |
| `Roll`, `Dodge`, `Dive`, `Evade` | `roll` | Ausweichrolle |
| `Punch`, `Jab`, `Hook`, `Boxing` | `punch` | Schlag-Kombo |
| `Kick` | `kick` | Tritt |
| `Hit`, `Impact`, `React`, `Stagger` | `hit` | Treffer einstecken |
| `Sit`, `Crouch`, `Dying`, `Knock` | `sit` | am Boden liegen |

Die Reihenfolge in der Tabelle ist auch die Prüfreihenfolge – „Falling To
Landing" zählt also als Landung, nicht als Fall.

Fehlende Bewegungen werden durch passende ersetzt. Mit nur `idle` + `walk` +
`run` läuft das Spiel zwar, aber Springen, Schwingen und Klettern sehen dann
falsch aus, weil dafür die Laufbewegung herhalten muss.

## 🛒 Einkaufsliste: die 13 Bewegungen für den Helden

Auf <https://www.mixamo.com> anmelden (kostenlos, Adobe-Konto), links oben auf
**„Animations"** und der Reihe nach diese Begriffe suchen. Bei jedem Treffer
rechts **Download** → **FBX Binary**, **Without Skin**, **30 FPS**.

| Suchbegriff bei Mixamo | Was du nehmen willst |
|---|---|
| `Breathing Idle` | ruhiges Stehen |
| `Walking` | ✅ **„In Place" ankreuzen** |
| `Running` | ✅ **„In Place" ankreuzen** |
| `Jumping Up` | Absprung nach oben |
| `Falling Idle` | Fallen mit ausgebreiteten Armen |
| `Falling To Landing` | weiche Landung |
| `Hanging Idle` | Körperhaltung am Netz (**wichtigste Datei fürs Schwingen**) |
| `Climbing` | Wandklettern, ✅ „In Place" |
| `Stand To Roll` oder `Sprint Forward Roll` | Ausweichrolle |
| `Punching` | Schlag |
| `Roundhouse Kick` | Tritt |
| `Standing React` | Treffer einstecken |
| `Falling Back Death` | K.-o. am Boden |

Alle 13 Dateien zusammen in **ein** Release hängen (Tag `mixamo-2`) – der Rest
läuft automatisch. Reihenfolge, Dateinamen und Sortierung sind egal.

**Warum Mixamo?** Unser Heldenmodell hat ein echtes Mixamo-Skelett
(`mixamorig:Hips`, `mixamorig:Spine`, … – 66 Knochen). Jede Mixamo-Animation
passt deshalb ohne Nacharbeit auf jede unserer Figuren. Andere Quellen
(Sketchfab, ActorCore, Adobe Stock) bringen fremde Skelette mit, die erst
umgerechnet werden müssten – genau dabei entstehen die verbogenen Beine.

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
