# WEB HERO – Umgebungsprobe: von Referenzbildern zu 3D-Modellen

**Stand: 5. September 2026. Zwei GLB-Modelle liegen vor. Sie sind noch nicht
im Spiel eingebaut.**

Der Vorlauf (Branch `codex/higgsfield-environment-probe-2026-09-04`) hatte zwei
Referenzbilder erzeugt und ausdrücklich festgehalten, dass `generate_3d` im
damaligen Werkzeugumfang fehlte. Mit dem Plus-Zugang ist der Befehl verfügbar;
dieser Durchgang holt den fehlenden Schritt nach.

## Was jetzt vorliegt

| Datei | Dreiecke | Größe | Textur |
| --- | --- | --- | --- |
| `modelle/haus-laden.glb` | 5.904 | 0,81 MB | 1024², JPEG |
| `modelle/stadtwagen.glb` | 8.045 | 0,77 MB | 1024², JPEG |

Beide aus `meshy_v7_image_to_3d`, je ein Referenzbild, 38 Credits pro Modell,
zusammen 76 von 1.200 Credits. Guthaben vor dem Lauf bestätigt: Plan `plus`.

## Gemessen, nicht behauptet

Die Rohausgabe wog 3,63 MB (Haus) und 2,93 MB (Auto) – **je einzelnes Modell
mehr als das komplette bestehende Hauspaket des Spiels** (`assets/haeuser.glb`,
2,93 MB). Ursache war nicht die Geometrie, sondern eine 2048er JPEG mit nahezu
voller Qualitätsstufe: 2,91 MB bzw. 2,23 MB allein für die Textur.

`textur-packen.py` packt das GLB mit kleinerer Textur neu:

| Fassung | Haus | Auto |
| --- | --- | --- |
| Rohausgabe (2048, Qualität ~100) | 3,63 MB | 2,93 MB |
| 2048, Qualität 85 | 1,36 MB | 1,12 MB |
| **1024, Qualität 88 (übernommen)** | **0,81 MB** | **0,77 MB** |

Die 1024er Fassung ist auf den gerenderten Ansichten bei Spielentfernung nicht
vom Original zu unterscheiden. Die Ansichten liegen in `ansichten/`.

## Abnahme gegen MODEL-BRIEF.md

**Haus – erfüllt, bis auf Maßstab und Ursprung.**

- Dreiecke 5.904 gegen ein Budget von etwa 6.000.
- Ein Material, eine Textur (Budget: höchstens vier Materialien).
- Flaches Dach mit niedriger Brüstung, freie ebene Mitte – auf der Dachansicht
  sichtbar. Das ist die Bedingung fürs Landen und Hocken.
- Geschlossener Baukörper, gerade Außenwände, Rückseite vollständig modelliert
  (nur dunkler texturiert als die Vorderseite).
- Vier Geschosse: Laden plus drei Wohnetagen, wie in der Bildprobe akzeptiert.
- **Offen:** Das Modell ist auf Einheitsgröße normiert (1,398 × 1,902 × 1,407)
  statt in Metern, und der Ursprung sitzt in der Mitte (`minY` = −0,951) statt
  auf Bodenhöhe. Beides muss beim Einbau gesetzt werden.

**Stadtwagen – ein Punkt des Briefs ist nicht erfüllt.**

- Dreiecke 8.045 gegen ein Budget von etwa 8.000, ein Material, eine Textur.
- Karosserie, Räder mit Felgen, Scheiben und sichtbare Innensitze sind da.
- **Nicht erfüllt:** Der Brief verlangt getrennte benannte Knoten `body`,
  `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr`. Das GLB hat **einen**
  einzigen Knoten `mesh_node`; die Räder sind mit der Karosserie verschmolzen.
  Damit können sie weder rollen noch lenken. Das Spiel animiert beides
  (`city-visuals.js`), also ist dieses Modell **kein** Ersatz für `makeCarMesh`,
  solange die Räder nicht getrennt sind.
- Ebenfalls offen: Einheitsgröße statt Meter, Ursprung mittig statt am Boden.

## Was daraus folgt

Das Haus ist der aussichtsreichere Kandidat, weil ein Gebäude keine beweglichen
Teile hat. Der nächste belastbare Schritt ist der Einbauversuch aus dem Brief:
ein einzelnes Haus mit unveränderter bestehender Kollisionshülle aufstellen und
Dachlandung, Wandkontakt und Bodenkontakt messen.

Beim Auto gibt es drei Wege, und keiner davon ist geprüft: die Räder im Ladepfad
geometrisch abtrennen, Karosserie und Rad getrennt erzeugen und zusammensetzen,
oder beim vorhandenen prozeduralen Fahrzeug bleiben. Der letzte Weg ist heute
der einzige, der funktionierende Räder hat.

## Was diese Probe nicht ist

Sie ändert keine Mission, keinen Spielstand, keine Kollision und keine
Fahrzeuglogik. Die produktive Spielseite lädt aus `experiments/` nichts. Es
wurde keine Bildrate, keine Ladezeit und kein Draw-Call im Spiel gemessen –
diese Zahlen entstehen erst beim Einbauversuch.

Menschen und U-Bahn bleiben eigene Folgeschritte: Menschen brauchen zusätzlich
ein passendes Skelett und konsistente Bewegungen.

## Werkzeuge in diesem Ordner

- `pruef-glb.js` – liest ein GLB und nennt Dreiecke, Knoten, Materialien,
  Texturen, Maße und Ursprung. Ohne Three.js, direkt aus dem JSON-Chunk.
- `textur-packen.py` – packt ein GLB mit kleinerer oder stärker komprimierter
  Textur neu und schreibt die Puffer-Offsets korrekt um.
- `ansichten-rendern.js` – rendert fünf Ansichten (vorn, Seite, hinten, unten,
  Dachaufsicht) mit dem GLTFLoader des Spiels. Ein einzelnes Bild belegt keine
  Rückseite; deshalb werden mehrere gerendert.
