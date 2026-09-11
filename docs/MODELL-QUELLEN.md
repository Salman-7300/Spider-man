# Woher die Modelle kommen

Phase 13, Teil 24. Für die Bewegungen gilt `ANIMATION-QUELLEN.md`; diese
Notiz zählt die **statischen** Modelle auf, mit Zahlen aus den Dateien
selbst (gemessen über `@gltf-transform`, nicht abgeschrieben).

## Higgsfield (Katalog „3D Jutsu“) – 7 Objekte

Ausschließlich statische Welt-Modelle. Beide Dateien enthalten **null
Animationen und null Skelette** – sie berühren den Helden-Rig also
nirgends. Sie tragen auch keine Texturen; die Farben stecken in den
Eckpunkten.

| Datei | Objekt | Dreiecke |
|---|---|---|
| `assets/stadtmoebel.glb` (0,47 MB) | `traffic_light_01` | 3.424 |
| | `street_lamp_01` | 2.296 |
| | `plaza_planter_01` | 600 |
| | `plaza_bench_01` | 428 |
| `assets/bahnhofmoebel.glb` (0,37 MB) | `trash_bin_01` | 3.480 |
| | `station_clock` | 1.173 |
| | `info_kiosk_01` | 224 |
| **Summe** | **7 Objekte** | **11.625** |

Jedes der sieben Objekte wird im Spiel wirklich benutzt – jeder Name kommt
in `game.js` genau einmal als Nachschlag vor (Ampel, Laterne, Beet, Bank,
Mülltonne, Bahnhofsuhr, Kiosk). Gezeichnet werden sie als `InstancedMesh`,
also eine Zeichenaufruf-Sorte je Objekt, nicht je Aufstellung.

**Gegen das Budget:** Der Phase-13-Auftrag nennt höchstens **fünf**
Higgsfield-Objekte. Es sind **sieben**, also zwei zu viel. Alle sieben sind
lange vor dieser Phase entstanden und bezahlt; in Phase 13 wurde **keine
einzige neue Generierung beauftragt**, also auch kein Guthaben verbraucht.
Zwei davon wieder herauszunehmen würde die Stadt schlechter machen, ohne
irgendetwas zu sparen. Die Entscheidung darüber gehört dem Auftraggeber –
hier steht nur die Zahl.

## Quaternius, „Downtown City MegaKit“ (CC0) – `stadtteile.glb`

13 Objekte, 91.467 Dreiecke, 4,55 MB, 8 Texturen. Straßenrequisiten auf
Augenhöhe: Gullideckel, Poller, Türen, Türrahmen, Klimagerät, Pflanzkübel,
Abfluss – dazu drei große Baukörper. CC0, also ohne Auflagen verwendbar.

## `haeuser.glb` – Herkunft nicht im Repo vermerkt

18 Gebäude, 39.745 Dreiecke, 2,80 MB, 21 Texturen, über
`tools/convert-haeuser.mjs` auf einen Einheitswürfel normiert. Die Quelle
ist in `game.js` und im Werkzeug nur als **„Brownstone Building Set"** und
**„Downtown Buildings Set"** benannt – **ohne Anbieter und ohne Lizenz**.

Das ist die einzige offene Stelle dieser Prüfung. Ich kann sie nicht selbst
schließen: die Dateien sind über ein Release ins Repo gekommen, und woher
sie stammen, weiß nur der Auftraggeber. **Bitte nachtragen**, sobald
bekannt: Anbieter, Lizenz und ob eine Namensnennung nötig ist.

## Figuren und Bewegungen

- `thug.glb` ist das „Soldier"-Modell aus den offiziellen
  Three.js-Beispielen (Mixamo-Charakter „Vanguard"), siehe
  `assets/README.md`.
- `hero.glb`, `civilian*.glb` und alle `*@*.glb` kommen über Mixamo bzw.
  über die in `ANIMATION-QUELLEN.md` beschriebene Prüfkette.
- Die Gegnertexturen in `assets/texturen/gegner/` sind **keine eigene
  Quelle**: `tools/gegner-skins.py` färbt die Textur des jeweiligen Modells
  um (nur der Farbton wechselt, Helligkeit und alle Kanten bleiben). Ihre
  Herkunft ist damit die Herkunft des Modells.

## Was hier ausdrücklich NICHT liegt

Kein `.smpcmod`, kein `.pak`, kein `.uasset` aus einem Spielordner, keine
Datei aus einem kommerziellen Marvel- oder Sony-Titel. Die Regel dazu steht
in `ANIMATION-QUELLEN.md` und gilt unverändert.
