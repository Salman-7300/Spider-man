# BUILD-2 — Asset-Audit

Stand: Release [`build-2`](https://github.com/Salman-7300/Spider-man/releases/tag/build-2),
15 Anhänge, 861,2 MB roh.

**Dies ist ein Audit. Es wurde nichts eingebaut, nichts nach `assets/`
kopiert, keine Straße verbreitert, kein Block verändert.** Kein Paket
wurde ins Spiel geladen — gemessen wurde offline.

---

## Wie gemessen wurde

Drei neue Werkzeuge, alle im Repository, alle ohne Browser:

| Werkzeug | wofür |
|---|---|
| `tools/build2-inspect.mjs` | GLB/glTF: Dreiecke, Ecken, Materialien, Texturen samt Auflösung, Bounding Box, Knoten, Skin, Knochen, Animationen, Blendshapes |
| `tools/build2-fbx.mjs` | binäres FBX: dasselbe, plus Doppel-Geometrie-Erkennung |
| `tools/build2-texturen.mjs` | lose Texturdateien: Format, Auflösung, Bytes |

Keines davon dekodiert Geometrie oder Texturen. Ein GLB ist ein
Behälter aus JSON und einem Binärblock — Dreiecke stehen als
Zugriffszahlen im JSON, die Bounding Box als `min`/`max` des
POSITION-Zugriffs, die Texturgröße im Kopf des eingebetteten PNG oder
JPEG. Ein 126-MB-Baumpaket ist damit in Millisekunden vermessen. Genau
das verlangt die Vorgabe „NIEMALS roh laden".

Zwei Pakete wurden zusätzlich **angesehen** — Zahlen allein tragen keine
Empfehlung. `tools/build2-bilder.mjs` lädt ein Modell in einer leeren
Seite mit eigenem Renderer (das Spiel wird nicht angefasst) und legt
vier Ansichten ab.

### Grenzen der Messung, ehrlich benannt

* **FBX-Maße sind lokal, nicht Welt.** Der glTF-Leser rechnet den
  Szenengraph durch; der FBX-Leser tut das nicht. Bei
  `CityPropsCollection.fbx` stimmen die Maße trotzdem (die Teile liegen
  dort schon in Weltkoordinaten, geprüft an „Light" = 0,47 × 4,15 ×
  0,46 m = eine Straßenlaterne). Beim Chevy stimmen sie **nicht** — dort
  sitzt die Transformation auf den Model-Knoten. Fahrzeugmaße aus FBX
  stehen deshalb unten als „nicht gemessen".
* **FBX-Einheiten** sind in allen hier geprüften Dateien Zentimeter.
  Das ist aus den Größen erschlossen, nicht aus einem Kopfdatenfeld.
* **`street_props.glb` hat keine sprechenden Namen** (`Object_79` …).
  Was die 37 Teile sind, sagt nur das Bild.

---

## Lizenz und Herkunft — das wichtigste Ergebnis zuerst

> **Kein einziges der 15 Pakete enthält eine Lizenzdatei, eine README
> oder ein Autorenfeld.**

Nachgesehen wurde:

* jede Datei jedes Archivs auf `*license*`, `*readme*`, `*.txt`,
  `*.md`, `*.pdf` → **null Treffer** in allen 15 Paketen;
* das `asset.copyright`-Feld jeder GLB-Datei → **überall leer**;
* das `asset.generator`-Feld → siehe Tabelle.

Was sich damit **beweisen** lässt:

| Beweis | Aussage |
|---|---|
| `generator = "Sketchfab-12.65.0"` … `"Sketchfab-16.33.0"` in 7 GLB-Dateien | Diese Dateien sind durch Sketchfabs Konverter gelaufen. |
| Archivaufbau `source/` + `textures/` ohne Wurzeldateien | Das ist Sketchfabs Layout für den Download „Original format". |
| `rp_carla_rigged_001_yup_a.fbx`, `rp_claudia_rigged_002_yup_a.fbx` | `rp_<name>_rigged_<nnn>` ist das Namensschema von **RenderPeople**. |
| `Chevy Impala Rigged by FrigonTech.fbx` | Der Urheber steht im Dateinamen: **FrigonTech**. |
| `Buildings.glb`, `generator = "Khronos glTF Blender I/O v4.1.62"` | aus Blender exportiert, nicht über Sketchfab konvertiert. |

Was sich **nicht** beweisen lässt: welcher Sketchfab-Eintrag, welcher
Autor, welche Lizenz, ob kommerzielle Nutzung erlaubt ist, ob Änderung
erlaubt ist. Ein Dateiname ist kein Lizenznachweis, und ein
Konverter-Stempel sagt nichts über die Rechte.

**Ergebnis: alle 15 Assets = STATUS „PROVENANCE OFFEN".** Keines darf
nach der eigenen Vorgabe produktiv verwendet werden, bevor für jedes
einzeln Quelle, Autor, Lizenztext, kommerzielle Nutzung und
Änderungserlaubnis belegt sind.

Bei zwei Paketen ist das Risiko besonders zu beachten: **RenderPeople**
(Carla, Claudia — und Eric trägt denselben Rig und dasselbe
Namensschema `eric_rigged_001`) verkauft seine Modelle unter einer
Endnutzerlizenz, die Weitergabe in einem Spiel-Build und das Hochladen
in ein öffentliches Repository ausdrücklich regelt. Das ist keine
Behauptung über diese Kopien — es ist der Grund, warum genau hier der
Nachweis zuerst kommen muss.

### Was du je Asset brauchst

Für jedes Paket: die Quell-URL, den Autorennamen, die dort angegebene
Lizenz (z. B. „CC Attribution", „CC0", „Royalty Free — Editorial Use"),
und ob kommerzielle Nutzung und Änderung erlaubt sind. So wie es in
`docs/MODELL-QUELLEN.md` für `haeuser.glb` schon steht.

---

## Übersichtstabelle

Größen: Original = Anhang im Release. Ziel = geschätzt nach der
Optimierung, die in der jeweiligen Detailnotiz steht.

| Asset | Format | Original | Ziel | Dreiecke | Mat. | Texturen | Rig | Anim. | Kat. | Empfehlung |
|---|---|---|---|---|---|---|---|---|---|---|
| `buildings.zip` → `Buildings.glb` | GLB in RAR in ZIP | 29,3 MB | **~2,5 MB** | **2 470** (10 Häuser) | 52 | 52 eingebettet, 8,3 MB | – | – | **A** | **Erste Wahl für Straßenwände** |
| `city-props-collection-volume-1.zip` | FBX + 94 PNG | 121,0 MB | ~6 MB | 70 831 (32 Teile) | 31 | 94 × 1024², 45 MB | – | – | **B** | gute Teilauswahl, FBX→GLB nötig |
| `game-ready-city-buildings-pack.zip` | **nur .blend** | 49,1 MB | – | **nicht messbar** | – | 21, 27,3 MB | – | – | **C** | ohne Blender nicht verwertbar |
| `generic_1960s_office_skyscraper.glb` | GLB | 2,2 MB | ~1,2 MB | 45 764 | 7 | **0** | – | – | **B** | nur als Skyline-Proxy |
| `skyscrapers_pack.glb` | GLB | 42,1 MB | ~8 MB | **556 414** (7 Türme) | 2 | **0** | – | – | **B** | nur als Skyline-Schicht, stark dezimiert |
| `street_props.glb` | GLB | 3,4 MB | ~1,5 MB | 32 453 (37 Teile) | 4 | 3 × 1024² | – | – | **B** | Baustellen-Set, kein Stadtmobiliar |
| `trees_pack.glb` | GLB | 132,1 MB | – | **2 894 706** (12 Arten) | 63 | 14, 5,4 MB | – | – | **C** | technisch ungeeignet |
| `generic_sedan_car.glb` | GLB | 44,8 MB | ~5 MB | 113 191 | 23 | 24, **37,3 MB** | Rad-/Tür-Knoten | – | **A** | **Erste Wahl Verkehr** |
| `lamborghini_car_rigged.glb` | GLB | 18,7 MB | ~4 MB | 154 698 | 31 | 25, 9,2 MB | Rad-/Tür-Knoten | – | **B** | Sonderfahrzeug, 1,5× zu groß |
| `chevy-impala-rigged-by-frigon-tech.zip` | FBX + 19 PNG | 44,4 MB | ~4 MB | 57 104 (39 099 einmalig) | 6 | 19 × 2048², 40,4 MB | **13er Auto-Rig** | – | **B** | bestes Auto-Rig, FBX→GLB nötig |
| `chevrolet-impala-1967.zip` | FBX + 36 PNG | 128,3 MB | ~5 MB | 56 982 | 6 | 36 × 2048², **119,4 MB** | – | 1 leer | **B** | dieselbe Karosserie ohne Rig |
| `carla-rigged-001-…zip` | FBX + 2 JPG | 90,2 MB | ~2,5 MB | 19 988 | 1 | 2 × **8192²**, 64,4 MB | 88 Knochen, **kein Mixamo** | – | **D→B** | Retargeting nötig |
| `claudia-rigged-002-…zip` | FBX + 2 JPG | 87,3 MB | ~2,5 MB | 21 492 | 1 | 2 × **8192²**, 62,6 MB | 88 Knochen, **kein Mixamo** | – | **D→B** | Retargeting nötig |
| `eric_rigged_001_…glb` | GLB | 37,2 MB | ~2,5 MB | 20 542 | 1 | 2 × **8192²**, 34,5 MB | 89 Knochen, **kein Mixamo** | – | **D→B** | Retargeting nötig |
| `rigged-t-pose-human-male-…zip` | FBX + 2 JPG | 31,1 MB | ~2 MB | 1 033 683 → **~55 000 echt** | 7 | 1 × 2048², 0,85 MB | 67 Knochen, **Mixamo** | – | **A** | **Erste Wahl Zivilist** |

Kategorien: **A** = nach Optimierung direkt verwendbar · **B** = nach
Konvertierung oder Retargeting verwendbar · **C** = technisch
ungeeignet · **D** = Lizenz/Provenienz offen.

> Jedes Asset trägt zusätzlich **D**, siehe oben. Die Kategorie in der
> Tabelle sagt, was technisch möglich wäre, **wenn** die Lizenz geklärt
> ist.

---

## Häuser

### `buildings.zip` — 10 Häuser, 2 470 Dreiecke

Der Fund des Audits. Im ZIP liegt kein Modell, sondern
`source/Buildings.rar`; darin `Buildings/Models/Buildings.glb` (9,87 MB)
sowie eine DAE- und eine FBX-Fassung derselben Häuser.

    Haus         Dreiecke   Grundfläche        Höhe
    Building_02       548   40,8 × 22,9 m     26,3 m   (8 Geschosse)
    Building_05       360   29,8 × 19,1 m     18,8 m   (6)
    Building_03       256   23,2 × 17,1 m     18,8 m   (6)
    Building_09       236   16,9 × 13,9 m     11,9 m   (4)
    Building_07       220   24,9 × 16,2 m     14,8 m   (5)
    Building_06       204   33,5 × 18,7 m     14,5 m   (5)
    Building          196   28,2 × 19,4 m     19,6 m   (6)
    Building_01       162   34,1 × 19,5 m     23,6 m   (7)
    Building_04       162   25,5 × 18,2 m     18,6 m   (6)
    Building_08       126   15,5 × 14,0 m     13,0 m   (4)

**Genau die 3-bis-8-Geschosser, die für echte Straßenschluchten
fehlen.** Zum Vergleich: das vorhandene `haeuser.glb` hat 18 Modelle mit
39 745 Dreiecken (Ø 2 208), diese zehn brauchen zusammen 2 470.

Am Bild geprüft (`tools/build2-bilder.mjs`):

* Erdgeschoss ist überall **Ladenzeile** — Schaufenster, Markisen,
  Leuchtschilder („CityDental", Diner, Läden). Fotografierte Fassaden.
* **Rückseiten und Seiten sind geschlossen**, mit schlichtem
  Ziegel-Text­ur. Sie sind fensterlos — die Häuser gehören also
  **Schulter an Schulter in eine Reihe**, freistehend sähen sie falsch
  aus. Für eine Straßenwand ist das genau richtig.
* **Dächer sind flach und texturiert**, kein Loch, keine Aufbauten.
  Begehbar mit einem einzigen Kastenkollider.
* Jedes Haus steht auf y = 0,004 — praktisch exakt auf dem Boden.
* Keine getrennten Türen, keine Treppen, keine Feuerleitern, keine
  modularen Fassadenstücke. Ein Haus ist EIN Objekt, ein Kasten.

Kosten: 0,11 MB Geometrie, **9,69 MB Textur**. 52 Materialien für 10
Häuser, also im Schnitt 5 Zeichenaufrufe je Haus.

**Optimierungsvorschlag:** die sechs großen Texturen
(1250 × 1019, 1250 × 877, 1250 × 872, 1024 × 921, 950 × 1024, 954 × 902)
auf 512 herunterrechnen, die übrigen 256-hohen Streifen so lassen; die
52 Materialien zu einem Atlas je Haus zusammenfassen (5 → 1
Zeichenaufruf). Erwartet **~2,5 MB und 10 Zeichenaufrufe für zehn
Haustypen**, instanzierbar je Typ.

### `game-ready-city-buildings-pack.zip` — nicht verwertbar

Enthält **nur** `source/CITYSKETCHFAB.blend` (15,3 MB) und 21 Texturen.
Kein glTF, kein FBX, kein OBJ. In dieser Umgebung ist kein Blender
installiert, also lässt sich weder Geometrie noch Modellzahl messen —
alles darüber wäre geraten.

Die Texturen sagen, worum es geht: `Atlas.png` und `atlas.png` (je
2048²), `roadmarkings.png`, `asphalt`, `pavement`, `manholes`,
`rooftop`, `Signs` — das ist ein **Straßen- und Bodenpaket**, kein
Häuserpaket im engeren Sinn. 27,31 MB in 21 Dateien, 6 davon größer als
1024².

**Kategorie C**, solange keine exportierte Fassung vorliegt. Wenn du das
Paket haben willst, brauche ich eine glTF- oder FBX-Ausgabe daraus.

### `skyscrapers_pack.glb` — 7 Türme, 556 414 Dreiecke

    Skyscraper1   61,6 × 133,2 × 33,1 m
    Skyscraper2   62,0 × 138,9 × 52,7 m
    Skyscraper3   26,0 × 154,0 × 26,0 m
    Skyscraper4   91,3 × 154,0 × 35,7 m
    Skyscraper5   24,2 × 237,6 × 24,2 m
    Skyscraper6   51,1 × 165,1 × 51,1 m
    Skyscraper7   81,2 × 156,3 × 30,4 m

Zwei Materialien (`Wall`, `Glass`), **null Texturen** — die Fassaden
sind modellierte Geometrie, kein Bild. Deshalb 40 MB Geometrie bei
33 000 bis 67 000 Dreiecken je Turm. Das ist 15- bis 30-mal so teuer wie
ein Haus aus `haeuser.glb`.

Auf Straßenebene **nicht tragbar**. Als **Skyline-Schicht am Stadtrand**
(kein Kollider, keine NPCs, nur Silhouette) sinnvoll — dort trägt
Dezimierung auf 10–15 %, weil man die Fassadendetails aus 300 m nicht
sieht.

### `generic_1960s_office_skyscraper.glb`

45 764 Dreiecke, 7 Materialien, **null Texturen**, 31,2 × 61,5 × 31,2 m,
Unterkante y = 0. Die Mitte liegt bei xz (0 | 40) — das Modell ist
**nicht um seinen Ursprung zentriert**, beim Setzen muss das versetzt
werden. Ein einzelnes 61-m-Bürohaus; 2,1 MB. Als einzelner Blickfang
oder in der Skyline brauchbar, für eine Straßenwand zu hoch und zu
teuer.

---

## Stadtmobiliar — ALT gegen BUILD-2

Das Spiel hat heute (gemessen in `assets/`):

| Teil | Datei | Dreiecke | Maße |
|---|---|---|---|
| Ampel | `stadtmoebel.glb` `traffic_light_01` | 3 424 | 2,01 × 4,30 × 1,34 m |
| Laterne | `stadtmoebel.glb` `street_lamp_01` | 2 296 | 1,78 × 4,10 × 0,71 m |
| Beet | `stadtmoebel.glb` `plaza_planter_01` | 600 | 1,37 × 0,73 × 0,60 m |
| Bank | `stadtmoebel.glb` `plaza_bench_01` | 428 | 1,50 × 0,95 × 0,48 m |
| Mülltonne | `bahnhofmoebel.glb` `trash_bin_01` | 3 480 | 0,84 × 0,90 × 0,74 m |
| Kiosk | `bahnhofmoebel.glb` `info_kiosk_01` | 224 | 2,00 × 2,46 × 1,40 m |
| Bahnhofsuhr | `bahnhofmoebel.glb` `station_clock` | 1 173 | 0,62 × 2,61 × 0,50 m |
| Poller | `stadtteile.glb` `Prop_Bollard` | 190 | 0,22 × 0,89 × 0,23 m |
| Gullideckel | `stadtteile.glb` `Prop_ManholeCover` | 118 | 0,93 × 0,03 × 0,93 m |
| Pflanzkübel | `stadtteile.glb` `Prop_Planter_Single` | 118 | 2,00 × 0,60 × 2,00 m |
| Abfluss | `stadtteile.glb` `Prop_Drain` | 10 | 0,59 × 0,04 × 0,59 m |
| Klimagerät | `stadtteile.glb` `Prop_ACUnit` | 136 | 0,89 × 0,60 × 0,35 m |

Zusammen 4 + 3 + 9 Materialien, **8 Texturen insgesamt** — das
vorhandene Mobiliar ist fast durchweg untexturiert und sehr billig.

`city-props-collection-volume-1.zip` (32 Teile, Zentimetermaße,
Unterkante überall bei 0 — Werte hier schon in Metern):

| Teil | Dreiecke | Maße |
|---|---|---|
| Grate (Bodengitter) | **8 764** | 2,02 × 0,03 × 2,73 |
| BusStop | **7 818** | 6,26 × 3,26 × 3,95 |
| ParkBenchLong | 5 364 | 1,04 × 1,08 × 3,22 |
| FireHydrant | 3 364 | 0,49 × 1,13 × 0,48 |
| PostBox | 3 327 | 0,73 × 1,19 × 0,73 |
| ParkBenchShort | 3 292 | 1,10 × 1,07 × 1,92 |
| Dumpster (+2 Deckel) | 3 276 (+1 720) | 1,44 × 1,47 × 2,13 |
| Light (Straßenlaterne) | 3 040 | 0,47 × 4,15 × 0,46 |
| TrashCanCap | 2 860 | 0,93 × 1,26 × 0,93 |
| StormDrain | 2 772 | 1,17 × 0,04 × 1,33 |
| Bench | 2 712 | 2,03 × 0,53 × 1,43 |
| TrashCanLarge | 2 432 | 0,89 × 0,97 × 0,89 |
| ConcreteBench | 2 304 | 1,15 × 1,08 × 2,07 |
| Tarp (Plane) | 2 170 | 2,76 × 1,02 × 2,69 |
| Drain | 2 152 | 1,30 × 0,03 × 1,11 |
| Utility (Kasten) | 2 128 | 2,30 × 2,12 × 1,31 |
| ParkingMeter | 2 102 | 0,21 × 1,39 × 0,11 |
| TrashCanSmall | 2 072 | 0,63 × 0,87 × 0,63 |
| TrashCommercial | 2 016 | 0,60 × 1,02 × 0,60 |
| ATM | 1 484 | 0,76 × 0,92 × 0,11 |
| PostBarrier / PostBarrier2 | je 1 120 | 3,57 × 1,02 × 1,30 |
| Crossing | 406 | 0,53 × 1,10 × 0,50 |
| pallet1 / pallet2 | je 348 | 1,90 × 0,14 × 1,79 |
| Manhole | 160 | 1,00 × 0,02 × 1,00 |
| TarpCrate1–4 | je 40 | ~1,00 × 0,8 × 1,00 |

### Vergleich je Typ

| Typ | ALT | BUILD-2 | optisch besser? | Dreiecke | Mat. | Texturkosten | Instancing | Kollider |
|---|---|---|---|---|---|---|---|---|
| Laterne | 2 296 | Light 3 040 | ja (texturiert) | +32 % | 1 → 1 | +3 × 1024² | ja | ja (vorhanden) |
| Bank | 428 | Bench 2 712 | ja | **×6,3** | 1 → 1 | +3 × 1024² | ja | ja |
| Mülltonne | 3 480 | TrashCanSmall 2 072 | ja | **−40 %** | 1 → 1 | +3 × 1024² | ja | ja |
| Poller | 190 | PostBarrier 1 120 | ja | ×5,9 | 1 → 1 | +3 × 1024² | ja | ja |
| Gullideckel | 118 | Manhole 160 | ja | +36 % | 1 → 1 | +3 × 1024² | ja | nein |
| Beet | 600 | – | – | – | – | – | – | – |
| Ampel | 3 424 | – | – | – | – | – | – | – |
| Kiosk | 224 | BusStop 7 818 | ja, aber anderes Objekt | ×35 | 1 → 2 | +6 × 1024² | ja | ja |
| Hydrant | **fehlt** | FireHydrant 3 364 | neu | – | +1 | +3 × 1024² | ja | ja |
| Briefkasten | **fehlt** | PostBox 3 327 | neu | – | +1 | +3 × 1024² | ja | ja |
| Parkuhr | **fehlt** | ParkingMeter 2 102 | neu | – | +1 | +3 × 1024² | ja | nein (dünn) |
| Container | **fehlt** | Dumpster 4 996 | neu | – | +2 | +6 × 1024² | ja | ja |

Zwei Dinge fallen auf. **Die alte Mülltonne ist teurer als die neue**
(3 480 gegen 2 072) — der Austausch ist dort ein doppelter Gewinn. Und
**das Spiel hat keinen Hydranten, keinen Briefkasten, keine Parkuhr,
keinen Container** — die vier sind Zugewinn statt Ersatz.

Dagegen sind `Grate` (8 764), `BusStop` (7 818) und `ParkBenchLong`
(5 364) für das, was sie darstellen, deutlich zu teuer; Grate und
StormDrain sind flache Bodengitter und gehören auf 200–400 Dreiecke
dezimiert oder durch eine Textur ersetzt.

**Texturkosten:** 94 Dateien à 1024², 44,95 MB, 97,8 Megapixel —
und zwar Diffuse + Normal + Emissive + OcclusionRoughnessMetallic je
Teil. Für ein Spiel mit Lambert-Materialien sind Normal, Emissive und
ORM **überflüssig**: nur Diffuse behalten, auf 512 herunterrechnen, das
sind rund **6 MB für alle 32 Teile**.

### `street_props.glb` — ein Baustellen-Set, kein Stadtmobiliar

Am Bild identifiziert: zwei Absperrgitter, drei gelb-schwarze
Warnbaken, ein Stapel Verkehrshütchen, Kartons, Betonblöcke, eine
Holzkiste, eine grüne Mülltonne, eine Metall-Mülltonne, eine Holzbank,
drei Verkehrsschilder (darunter „60" und „ROAD CLOSED").

32 453 Dreiecke für 37 Teile, davon ein einzelnes Teil mit **14 154
Dreiecken** bei 0,82 × 0,25 × 0,20 m Größe — das ist für ein
handgroßes Objekt absurd und muss vor jeder Verwendung dezimiert
werden. Die Schilder sind europäisch beschriftet (km/h-Rundschild) und
passen nicht zu einer US-artigen Stadt.

Nützlich wären daraus: Absperrgitter, Warnbaken, Hütchen und
„ROAD CLOSED" — als **Ereignis-Deko** (Unfallstelle, Baustelle), nicht
als Dauermobiliar.

---

## Fahrzeuge

Vergleichsmaßstab: ein echter Pkw ist rund 4,5 × 1,8 × 1,5 m.

| | `generic_sedan_car.glb` | `lamborghini_car_rigged.glb` | Chevy (FrigonTech) | Chevrolet 1967 |
|---|---|---|---|---|
| Format | GLB | GLB | FBX | FBX |
| Datei | 44,8 MB | 18,7 MB | 44,4 MB (ZIP) | 128,3 MB (ZIP) |
| Dreiecke | 113 191 | 154 698 | 57 104 (39 099 einmalig) | 56 982 |
| Materialien | 23 | 31 | 6 | 6 |
| Texturen | 24, **37,3 MB** (3 × 4096², 16 × 2048²) | 25, 9,2 MB | 19 × 2048², 40,4 MB | 36 × 2048², **119,4 MB** |
| Maße | **2,18 × 1,51 × 4,98 m** ✓ | 3,38 × 1,74 × 6,64 m ✗ (~1,5× zu groß) | nicht messbar (FBX-lokal) | nicht messbar |
| Ursprung | Boden, zentriert (0,00 / 0,00) ✓ | Boden, xz-Mitte bei z = 2,20 ✗ | – | – |
| **Räder getrennt** | **ja** `DEF-Wheel.Ft.L/.Ft.R/.Bk.L/.Bk.R` | **ja** `DEF-Wheel.Ft.L` … | **ja** `FR, FL, RR, RL` | **nein** |
| Türen getrennt | ja, vorn+hinten l/r, Haube | ja, Tür, Haube, Kofferraum | ja, `FL_Door … RR_Door` | nein |
| Lenkrad | ja `steering-wheel` | – | ja `SteeringWheel` | – |
| Innenraum | ja (Türverkleidungen, Sitze) | ja | ja (`CouchUP`, `BaseClock`, `DonutDrive`) | ja |
| Skin/Skelett | nein (Knotenhierarchie) | nein | 13 `LimbNode`-Knoten | keine |
| Animationen | – | – | – | 1 leere (`Take 001`) |

**`generic_sedan_car.glb` ist die erste Wahl für Verkehr**: echte
Pkw-Maße, Ursprung am Boden und zentriert, alle vier Räder einzeln
benannt, Türen und Lenkrad getrennt. Sein einziges Problem sind die
Texturen — 37,3 von 44,8 MB. Auf 512/1024 herunter und ohne die
überflüssigen Karten sind es **rund 5 MB**.

Der **Chevy von FrigonTech** hat das *beste* Rig (13 benannte Knoten,
vier Räder, vier Türen, Lenkrad) bei nur 1,86 MB FBX und 39 099
einmaligen Dreiecken. Er braucht eine FBX→GLB-Konvertierung; die
Texturen (40,4 MB) sind derselbe Fall wie oben.

Der **Chevrolet 1967** ist dieselbe Karosserie **ohne Rig** —
keine getrennten Räder. Als Verkehrsfahrzeug damit unbrauchbar, als
stehendes Parkauto tauglich. Seine 119,4 MB Texturen sind der größte
einzelne Brocken des ganzen Release.

Der **Lamborghini** ist ein Sonderfahrzeug: 154 698 Dreiecke (mehr als
der ganze Innenraum von Mission 6 mal zehn), sechs UV-Sätze
(`TEXCOORD_0` bis `TEXCOORD_5`), und er ist um Faktor ~1,5 zu groß
modelliert. Als *ein* auffälliges Fahrzeug an einer Story-Stelle
denkbar, nicht als Verkehrsvariante.

---

## Figuren

Vergleichsmaßstab — was das Spiel heute hat:

| Datei | Dreiecke | Mat. | Tex. | Größe | Knochen | Namensschema |
|---|---|---|---|---|---|---|
| `assets/hero.glb` | 13 400 | 7 | 8 | 2,07 MB | 66 | `mixamorig:*` |
| `assets/civilian.glb` | 35 193 | 6 | 15 | 3,62 MB | 67 | `mixamorig:*` |
| `assets/civilian2.glb` | 53 452 | 2 | 4 | 6,14 MB | 65 | `mixamorig:*` |

Die gesamte Animationsbibliothek (94 Bewegungen für den Helden, 50 und
42 für die Zivilisten, 42 für die Ganoven) bindet über **`mixamorig:`**.

| | MikeAlger | Eric | Carla | Claudia |
|---|---|---|---|---|
| Datei | 31,1 MB (ZIP) | 37,2 MB | 90,2 MB (ZIP) | 87,3 MB (ZIP) |
| Format | FBX 7.5 | GLB | FBX 7.3 | FBX 7.3 |
| Dreiecke | 1 033 683 → **~55 000 echt** | 20 542 | 19 988 | 21 492 |
| Materialien | 7 | 1 | 1 | 1 |
| Texturen | **1 × 2048² (0,85 MB)** | 2 × **8192²** (34,5 MB) | 2 × **8192²** (64,4 MB) | 2 × **8192²** (62,6 MB) |
| Größe | 1,83 m | 1,86 m | 1,73 m | 1,84 m |
| Knochen | **67, `mixamorig_*`** | 89, `hip/spine_01/upperarm_l` | 88, dito | 88, dito |
| Ruhepose | T-Pose | T-Pose | T-Pose | T-Pose |
| Blendshapes | **50 Gesichtsziele** | – | – | – |
| Teile | Body, Sweatshirt, Pants, Hair, Shirt, Shoes, Bracelet | 1 Mesh | 1 Mesh | 1 Mesh |

**MikeAlger ist der einzige mit Mixamo-Knochen.** `mixamorig_Hips`,
`mixamorig_Spine`, `mixamorig_Spine1`, `mixamorig_Spine2`,
`mixamorig_Neck`, `mixamorig_Head`, `mixamorig_LeftShoulder`, … — das
ist bis auf den Unterstrich statt des Doppelpunkts (FBX erlaubt keinen
Doppelpunkt) **exakt das Skelett des Spiels**. Er bindet ohne
Retargeting an die vorhandene Bibliothek.

Die 1 033 683 Dreiecke sind eine Falle: die Datei speichert ihre **50
Gesichtsausdrücke als 50 volle Kopien des Körpers** (je 19 580
Dreiecke), benannt `Blink_Left`, `Jaw_Up`, `Smile_Right` … Die echte
Figur sind Body (19 580) + Sweatshirt (15 108) + Pants (14 410) + Hair
(2 950) + Shirt (1 532) + Shoes (911) + Bracelet (192) ≈ **55 000
Dreiecke** — vergleichbar mit `civilian2.glb`. Beim Export müssen die 50
Kopien weg oder als echte Blendshape-Ziele zusammengefasst werden.

**Eric, Carla und Claudia teilen sich EIN Skelett** — dieselben 88/89
Knochen mit denselben Namen (`root, hip, spine_01..03, neck, head,
shoulder_l, upperarm_l, lowerarm_l, hand_l, upperleg_l, lowerleg_l,
foot_l, ball_l` plus Dreh- und Gesichtsknochen). Das ist ein
RenderPeople-Rig, nicht Mixamo. Folge:

* Die vorhandenen Bewegungsdateien binden **nicht**.
* Die Topologie ist aber gleichartig (Hüfte → drei Wirbelsäulenglieder →
  Hals → Kopf; Schulter → Ober- → Unterarm → Hand; Ober- → Unterschenkel
  → Fuß → Ballen). Eine **Namenszuordnung ist mechanisch möglich** —
  aber Ruhepose, Dreh-Hilfsknochen (`*_twist_*`) und Fingerzählung
  weichen ab. Das ist echtes Retargeting, kein Umbenennen.

**Empfehlung zu den Figuren:** keinen neuen NPC-Unterbau bauen. Wenn
mehr Zivilisten-Varianten gewünscht sind, ist der billigste Weg nicht
Eric/Carla/Claudia, sondern **MikeAlger** — er läuft sofort auf dem
vorhandenen Zivilisten-Rig. Ein Retargeting der drei RenderPeople-
Figuren lohnt erst, wenn eines davon optisch unbedingt gebraucht wird;
dann deckt **eine** Zuordnungstabelle alle drei ab.

Für alle vier gilt: die 8192²-Texturen sind der ganze Dateiumfang. Auf
1024² herunter kostet jede Figur ~2,5 MB statt 37–90 MB.

---

## Bäume

`trees_pack.glb`: 12 Arten, **2 894 706 Dreiecke**, 126 MB, davon 120,5
MB reine Geometrie und nur 5,4 MB Textur (12 × 512², 1 × 256²,
1 × 512×1024).

    HCT Tree 09   760 752 Dreiecke   8,5 m
    HCT Tree 12   519 295            11,5 m
    HCT Tree 08   388 747             8,3 m
    HCT Tree 05   302 234            11,7 m
    HCT Tree 01   256 460             9,8 m
    HCT Tree 06   202 075             9,0 m
    HCT Tree 04   131 320            14,1 m
    HCT Tree 03    74 202             9,5 m
    HCT Tree 10    71 108            12,6 m
    HCT Tree 11    69 736             5,7 m
    HCT Tree 07    65 763             8,2 m
    HCT Tree 02    53 014            10,1 m

63 Materialien (`Bark`, `Branches`, `Branchets`, `Leafs`, `Stump` je
Baum), **alle doppelseitig**, 15 davon durchsichtig.

**Ein einziger Baum dieses Pakets kostet so viel wie die halbe heutige
Stadt.** Die Zweige sind echte Geometrie, keine Alpha-Karten. Das ist
für einen Browser-Open-World nicht zu retten: von 760 000 auf 3 000
Dreiecke zu dezimieren, lässt keinen Baum übrig, sondern einen
Stummel — und genau das verbietet die Vorgabe („KEINE sichtbare
Zerstörung nur für Prozentwerte").

**Kategorie C.** Wer Bäume will, braucht ein Alpha-Karten-Paket
(Stamm + zwei bis vier gekreuzte Blattkarten, 200–800 Dreiecke je Baum).
Die 12 Texturen dieses Pakets (512², sauber) wären dafür brauchbar —
die Karten müsste man aber neu bauen, und das ist Neuerstellung, keine
Optimierung.

---

## Wo die 861 MB liegen

| Posten | MB | Anteil |
|---|---|---|
| Texturen größer als 1024² | ~520 | 60 % |
| Baumgeometrie | 120 | 14 % |
| Wolkenkratzergeometrie (untexturiert) | 40 | 5 % |
| doppelte Blendshape-Kopien (MikeAlger) | ~27 | 3 % |
| alles andere | ~154 | 18 % |

Der Löwenanteil ist **Textur, die niemand in diesem Spiel sieht**: drei
4096²-Karten auf einem Auto, das meist 30 m entfernt und 60 Pixel groß
ist; 8192²-Hautkarten auf Passanten; ORM- und Emissive-Karten für
Materialien, die im Spiel Lambert sind.

**Geschätztes Downloadbudget nach Optimierung für die unten
vorgeschlagene Auswahl: 18–24 MB.** Die Rechnung steht in
`docs/BUILD2-CITY-V2-VORSCHLAG.md`.

---

## Was NICHT verwendet werden sollte

| Asset | Grund |
|---|---|
| `trees_pack.glb` | 2,9 Mio Dreiecke, nicht rettbar ohne Neuerstellung |
| `game-ready-city-buildings-pack.zip` | nur .blend, nicht messbar, nicht ladbar |
| `chevrolet-impala-1967.zip` | Räder nicht getrennt → kein Verkehrsfahrzeug; 119 MB Textur |
| `lamborghini_car_rigged.glb` als Verkehr | 154 698 Dreiecke, 1,5× zu groß, 6 UV-Sätze |
| `skyscrapers_pack.glb` auf Straßenebene | 33–67 k Dreiecke je Turm, untexturiert |
| Eric / Carla / Claudia **vor** MikeAlger | falsches Rig, 8192²-Texturen, Retargeting nötig |
| **alle 15 produktiv** | solange die Lizenz offen ist |
