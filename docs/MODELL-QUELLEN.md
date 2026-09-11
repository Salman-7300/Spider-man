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

## `haeuser.glb` – Lizenz weiterhin OFFEN

18 Gebäude, 39.745 Dreiecke, 2,80 MB, 21 Texturen, über
`tools/convert-haeuser.mjs` auf einen Einheitswürfel normiert.

### Was die Nachforschung ergeben hat

Gesucht wurde in Arbeitsbaum, gesamter Commit-Historie (alle Branches,
alle Dateiversionen), Commit-Nachrichten und den GitHub-Releases nach
„Brownstone Building Set", „Downtown Buildings Set" und `haeuser.glb`.

**Die Originalarchive liegen im Release `build-1`** (veröffentlicht am
26.08.2026, hochgeladen von `Salman-7300`):

| Datei im Release | Größe |
|---|---|
| `brownstone-building-set-low-poly-model.zip` | 36,7 MB |
| `downtown-buildings-set-low-poly-model.zip` | 44,8 MB |

Beide Archive wurden heruntergeladen und vollständig durchsucht:

- **Keine Lizenzdatei, kein README, keine Nutzungsbedingungen.** 42 bzw.
  61 Dateien, ausschließlich `source/*.fbx` und `textures/*.jpeg`.
- Der Aufbau `source/` + `textures/` entspricht dem Downloadpaket von
  Sketchfab. Das ist ein **Indiz, kein Nachweis** – dieselbe Struktur
  benutzen andere Portale auch.

Aus den FBX-Metadaten selbst gelesen (nicht abgeschrieben):

| Feld | Brownstone | Downtown |
|---|---|---|
| Erzeugt mit | Autodesk 3ds Max 2021 | Autodesk 3ds Max 2021 |
| FBX SDK | 2020.0.1 | 2020.0.1 |
| Datum (GMT) | 12.03.2025 01:53 | 12.03.2025 14:33 |
| Ursprungspfad | `C:\Users\DanielPC\Desktop\Moontears\Buildings_Models\Brownstone_Building_Set\` | `…\Moontears\Buildings_Models\Downtown_Building_Set\` |
| `Author` | **leer** | **leer** |
| `Copyright` | **nicht gesetzt** | **nicht gesetzt** |

### Urteil: OFFEN

Ein Ordnername („Moontears"), ein Vorname im Benutzerpfad und ein
Modellierungsprogramm sind **kein Anbieter und keine Lizenz**. Eine
Lizenz wird hier nicht erfunden und nicht aus der Paketstruktur
abgeleitet.

**Was zum Schließen fehlt – und nur der Auftraggeber weiß es:** von
welchem Portal oder Verkäufer die beiden Sets stammen, unter welcher
Lizenz sie erworben wurden und ob eine Namensnennung verlangt ist.

Die belastbaren Anhaltspunkte oben sollten die Suche erheblich
abkürzen: Urheber-/Studioname **„Moontears"**, Sets **„Brownstone
Building Set"** und **„Downtown Buildings Set"**, erstellt **März 2025**.

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
