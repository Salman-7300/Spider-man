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

**Freigabe: 7 von 7 – die Fünfer-Grenze ist aufgehoben.**

Der ursprüngliche Phase-13-Auftrag nannte höchstens fünf Higgsfield-
Objekte. Bei der Finalisierung von Phase 13 hat der Auftraggeber diese
Grenze ausdrücklich aufgehoben und **alle sieben** Objekte namentlich
freigegeben:

    traffic_light_01   street_lamp_01   plaza_planter_01   plaza_bench_01
    trash_bin_01       station_clock    info_kiosk_01

Die Begründung stützt sich auf genau das, was oben gemessen ist: die
Objekte enthalten **weder Skelett noch Animation**, greifen also nirgends
in den Helden-Rig ein, sind lange vor dieser Phase entstanden und bezahlt
und werden instanziert gezeichnet. In Phase 13 wurde **keine einzige neue
Generierung beauftragt**, also auch kein Guthaben verbraucht.

**Der ABSOLUTE HERO-RIG LOCK bleibt davon unberührt:** das
Higgsfield-Rig mit 23 Knochen wird nicht verwendet, der Mixamo-Rig des
Helden bleibt vollständig erhalten. Die Freigabe betrifft ausschließlich
statische Stadtobjekte.

**Weiterhin gesperrt:** neue Higgsfield-Generierungen jeder Art.

## Quaternius, „Downtown City MegaKit“ (CC0) – `stadtteile.glb`

13 Objekte, 91.467 Dreiecke, 4,55 MB, 8 Texturen. Straßenrequisiten auf
Augenhöhe: Gullideckel, Poller, Türen, Türrahmen, Klimagerät, Pflanzkübel,
Abfluss – dazu drei große Baukörper. CC0, also ohne Auflagen verwendbar.

## `haeuser.glb` – Herkunft benannt: Sketchfab, CC Attribution

18 Gebäude, 39.745 Dreiecke, 2,80 MB, 21 Texturen, über
`tools/convert-haeuser.mjs` auf einen Einheitswürfel normiert.

### Die beiden Quellsätze

Der Auftraggeber hat die Herkunft benannt. Beide Sätze stammen von
**Daniel Zhabotinsky (@DanielZhabotinsky)** und stehen auf Sketchfab
unter **CC Attribution**:

| Satz | Seite |
|---|---|
| Brownstone Building Set – Low poly model | <https://sketchfab.com/3d-models/brownstone-building-set-low-poly-model-b15e6344acd844eabc823e1cc8332574> |
| Downtown Buildings Set – Low Poly model | <https://sketchfab.com/3d-models/downtown-buildings-set-low-poly-model-7378e7fb9c914c39880d9913a6f4e1d6> |

### Was daran belegt ist und was nicht

Belegt ist die **Übereinstimmung der Namen**: `tools/convert-haeuser.mjs`
nennt in seinem Kopf wörtlich die beiden Sätze

    "Brownstone Building Set", "Downtown Buildings Set"

und genau diese beiden Sets sind unter den oben genannten Adressen
veröffentlicht. Die Archive im Release `build-1` heißen entsprechend
`brownstone-building-set-low-poly-model.zip` und
`downtown-buildings-set-low-poly-model.zip`.

**Nicht belegt ist der Download selbst.** Es gibt keine Prüfsumme, keine
Downloadquittung und keinen kryptographischen Nachweis, dass genau diese
Dateien von genau dieser Seite geladen wurden. Die Zuordnung stützt sich
auf die Namensgleichheit und auf die Angabe des Auftraggebers.

Was ich unabhängig davon aus den FBX-Metadaten gelesen hatte, passt dazu,
ersetzt den Nachweis aber nicht:

| Feld | Brownstone | Downtown |
|---|---|---|
| Erzeugt mit | Autodesk 3ds Max 2021 | Autodesk 3ds Max 2021 |
| FBX SDK | 2020.0.1 | 2020.0.1 |
| Datum (GMT) | 12.03.2025 01:53 | 12.03.2025 14:33 |
| Ursprungspfad | `C:\Users\DanielPC\Desktop\Moontears\Buildings_Models\Brownstone_Building_Set\` | `…\Moontears\Buildings_Models\Downtown_Building_Set\` |
| `Author` | leer | leer |
| `Copyright` | nicht gesetzt | nicht gesetzt |

Der Benutzerpfad `DanielPC` und der Vorname des genannten Urhebers
stimmen überein; die Archive selbst enthalten keine Lizenzdatei.

### Namensnennung (Pflicht bei CC Attribution)

CC Attribution verlangt, dass Urheber und Quelle genannt werden. Der
folgende Text erfüllt das und gehört an jede Stelle, an der das Spiel
veröffentlicht wird:

    Gebäudemodelle: "Brownstone Building Set - Low poly model" und
    "Downtown Buildings Set - Low Poly model" von Daniel Zhabotinsky
    (@DanielZhabotinsky), Sketchfab, lizenziert unter CC Attribution.

**Offen bleibt allein die Anzeige im Spiel:** diese Notiz steht im
Repository, aber CITY SWING hat noch keine Stelle, an der die
Namensnennung für die Spielenden sichtbar ist (Titelbild, Menü oder eine
Abspann-/Danksagungsseite). Das ist eine Änderung am Spiel und wurde
hier bewusst nicht mitgemacht.

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
