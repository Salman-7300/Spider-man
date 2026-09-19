# BUILD-2 → CITY V2: konkreter Auswahlvorschlag

Grundlage: `docs/BUILD2-ASSET-AUDIT.md`. **Nichts davon ist gebaut.**
Das ist ein Vorschlag zur Freigabe, keine Umsetzung.

> **Sperre:** Alle 15 Assets stehen auf *PROVENANCE OFFEN*. Kein
> einziges Paket enthält eine Lizenzdatei oder ein Autorenfeld. Nach
> deiner eigenen Vorgabe („kein Build-2-Asset produktiv mit offener
> Lizenz") darf **keiner** der unten genannten Schritte begonnen werden,
> bevor je Asset Quelle, Autor, Lizenz, kommerzielle Nutzung und
> Änderungserlaubnis belegt sind — so wie es in `docs/MODELL-QUELLEN.md`
> für `haeuser.glb` schon steht.

---

## Die Auswahl in einem Satz

Von 15 Paketen tragen **fünf** die City V2: die zehn Häuser aus
`buildings.zip` für die Straßenwände, rund fünfzehn Teile aus der
City-Props-Sammlung fürs Mobiliar, der `generic_sedan_car` und der
Chevy von FrigonTech für den Verkehr, `MikeAlger` als zusätzliche
Zivilistenvariante — und `skyscrapers_pack` **nur** als Silhouette am
Stadtrand.

---

## 1. Häuser — 10 Modelle aus `buildings.zip`

Die Vorgabe nennt 8 bis 20 Gebäude. Vorgeschlagen sind **alle zehn** aus
`Buildings.glb`, weil sie zusammen weniger kosten als ein einziger Turm
aus `skyscrapers_pack`:

| Modell | Dreiecke | Grundfläche | Höhe | Geschosse | Rolle |
|---|---|---|---|---|---|
| Building_08 | 126 | 15,5 × 14,0 | 13,0 m | 4 | Reihenhaus schmal |
| Building_09 | 236 | 16,9 × 13,9 | 11,9 m | 4 | Reihenhaus schmal |
| Building_03 | 256 | 23,2 × 17,1 | 18,8 m | 6 | Ladenzeile mittel |
| Building_04 | 162 | 25,5 × 18,2 | 18,6 m | 6 | Ladenzeile mittel |
| Building_07 | 220 | 24,9 × 16,2 | 14,8 m | 5 | Ladenzeile mittel |
| Building | 196 | 28,2 × 19,4 | 19,6 m | 6 | Blockecke |
| Building_05 | 360 | 29,8 × 19,1 | 18,8 m | 6 | Blockecke |
| Building_06 | 204 | 33,5 × 18,7 | 14,5 m | 5 | breite Front |
| Building_01 | 162 | 34,1 × 19,5 | 23,6 m | 7 | breite Front |
| Building_02 | 548 | 40,8 × 22,9 | 26,3 m | 8 | Ankergebäude |
| **Summe** | **2 470** | | | | |

**Warum diese und nicht die Wolkenkratzer:** die Vorgabe will
„3-bis-8-geschossige Häuser direkt nebeneinander für echte
Straßenschluchten, nicht nur mehr Wolkenkratzer". Genau das sind sie —
mit Ladenzeile im Erdgeschoss, geschlossenen Seiten und flachem Dach.

**Lotbreiten:** die Vorgabe nennt 7–18 m je Lot. Diese Häuser sind
15,5 bis 40,8 m breit. Die Lotaufteilung muss sich also an den **echten
Modellbreiten** orientieren, nicht umgekehrt: ein Blockrand von 50 m
trägt ein Building_02 (40,8) plus nichts, oder Building_08 + Building_09
+ Building_03 (15,5 + 16,9 + 23,2 = 55,6 — zu viel). Realistisch sind
**2 bis 3 Häuser je Blockrand**, nicht 3 bis 8. Das ist eine Korrektur
an der Vorgabe, die aus der Messung folgt.

**Seitenwände sind fensterlos.** Häuser müssen Schulter an Schulter
stehen; freistehend sehen sie falsch aus. Für die geforderten 80–95 %
Straßenwand-Belegung ist das genau richtig, an Blockenden braucht es
aber ein Haus, dessen Seite sichtbar sein darf — oder eine Brandmauer.

**Optimierung:** sechs große Texturen (1250 × 1019 bis 950 × 1024) auf
512 herunter, 52 Materialien je Haus zu einem Atlas zusammenfassen
(5 → 1 Zeichenaufruf). Erwartet **~2,5 MB, 10 Zeichenaufrufe für zehn
Typen**, je Typ instanzierbar.

**Kollider:** ein Kasten je Haus, die Bounding Box aus der Tabelle. Kein
Sonderfall nötig — alle stehen auf y ≈ 0.

---

## 2. Straßenmobiliar — Ersetzungstabelle

Aus `city-props-collection-volume-1` (FBX → GLB, nur Diffuse, 512²).

### Ersetzen

| heute | wird | Dreiecke alt → neu | warum |
|---|---|---|---|
| `trash_bin_01` (Bahnhof) | `TrashCanSmall` | 3 480 → **2 072** | sieht besser aus **und** ist billiger |
| `plaza_bench_01` | `Bench` | 428 → 2 712 | die alte Bank ist ein Kasten mit Beinen |
| `Prop_Bollard` | `PostBarrier` (dezimiert) | 190 → ~400 | erst dezimieren, sonst ×5,9 |
| `Prop_ManholeCover` | `Manhole` | 118 → 160 | texturiert, praktisch gleich teuer |
| `street_lamp_01` | `Light` | 2 296 → 3 040 | texturiert, +32 % — vertretbar |

### Neu (das Spiel hat sie nicht)

| Teil | Dreiecke | Kollider |
|---|---|---|
| `FireHydrant` | 3 364 | ja |
| `PostBox` | 3 327 | ja |
| `ParkingMeter` | 2 102 | nein (zu dünn) |
| `Dumpster` + 2 Deckel | 4 996 | ja |
| `TrashCommercial` | 2 016 | ja |
| `Utility` (Verteilerkasten) | 2 128 | ja |
| `ConcreteBench` | 2 304 | ja |
| `pallet1`, `pallet2` | je 348 | nein (flach) |
| `TarpCrate1`–`4` | je 40 | ja (Stapel) |

### Nicht übernehmen

| Teil | Grund |
|---|---|
| `Grate` 8 764 | ein flaches Bodengitter zum Preis von vier Häusern |
| `StormDrain` 2 772, `Drain` 2 152 | dito, gehören auf 200–400 Dreiecke oder in eine Textur |
| `BusStop` 7 818 | zu teuer; der vorhandene `info_kiosk_01` (224) tut es |
| `ParkBenchLong` 5 364 | `Bench` (2 712) genügt |
| `Crossing` 406 | Zebrastreifen sind im Spiel schon prozedural |

**Ampel und Beet bleiben, wie sie sind** — dafür gibt es in Build-2
keinen Ersatz.

**Texturbudget Mobiliar:** heute 8 Texturen für das gesamte Mobiliar.
Neu: 15 Teile × 1 Diffuse × 512² ≈ **2 MB**. Die Normal-, Emissive- und
ORM-Karten des Pakets werden **nicht** mitgenommen — das Spiel rechnet
mit Lambert, sie wären wirkungslos.

### Ereignis-Deko aus `street_props.glb`

Absperrgitter, Warnbaken, Verkehrshütchen und das „ROAD CLOSED"-Schild
als Deko für Unfall- und Baustellenereignisse. Vorher dezimieren: ein
Teil des Pakets hat 14 154 Dreiecke bei 0,82 m Größe. Die
km/h-Rundschilder passen nicht zur Stadt und bleiben draußen.

---

## 3. Verkehr — 2 Fahrzeugvarianten plus Parker

Die Vorgabe nennt 2–4 Varianten.

| Rolle | Modell | Dreiecke | Räder | nach Optimierung |
|---|---|---|---|---|
| Standardverkehr | `generic_sedan_car.glb` | 113 191 | `DEF-Wheel.Ft.L/.Ft.R/.Bk.L/.Bk.R` ✓ | ~5 MB |
| zweite Variante | Chevy (FrigonTech) | 39 099 einmalig | `FR, FL, RR, RL` ✓ | ~4 MB |
| Parkauto (ohne KI) | `chevrolet-impala-1967` | 56 982 | **keine getrennten** | ~5 MB |

Die vorhandenen `createCar`-Varianten (Fastback, Crossover, Sportkombi)
bleiben. Die zwei neuen kommen **als Varianten dazu**, nicht als Ersatz —
Verkehrs-KI, Routen und Kollision bleiben unberührt.

Der Chevrolet 1967 taugt nur als **stehendes Parkauto** (Kollider,
keine KI), weil seine Räder nicht getrennt sind. Genau dafür sieht die
City-V2-Vorgabe „geparkte Autos (visuell + Collider, keine Verkehrs-KI)"
ohnehin eine eigene Kategorie vor.

**Der Lamborghini bleibt draußen** — 154 698 Dreiecke, sechs UV-Sätze,
und er ist um Faktor ~1,5 zu groß modelliert. Als einmaliges
Story-Fahrzeug später denkbar.

---

## 4. Zivilisten — genau eine neue Variante

| Modell | Knochen | passt auf das Spiel-Rig? | Dreiecke | nach Optimierung |
|---|---|---|---|---|
| **MikeAlger** | 67, `mixamorig_*` | **ja, direkt** | ~55 000 | ~2 MB |
| Eric | 89, RenderPeople | nein, Retargeting | 20 542 | ~2,5 MB |
| Carla | 88, RenderPeople | nein, Retargeting | 19 988 | ~2,5 MB |
| Claudia | 88, RenderPeople | nein, Retargeting | 21 492 | ~2,5 MB |

**Vorschlag: nur MikeAlger.** Er trägt dasselbe Skelett wie
`civilian.glb` und `civilian2.glb` und bindet ohne einen einzigen neuen
Mechanismus an die vorhandene Bewegungsbibliothek. Beim Export müssen
die 50 als Vollkopien gespeicherten Gesichtsausdrücke entfallen — sonst
wandern 979 000 unnötige Dreiecke mit.

Eric, Carla und Claudia **erst dann**, wenn eine davon optisch wirklich
gebraucht wird. Dann genügt **eine** Zuordnungstabelle für alle drei
(gleiches Rig), aber es bleibt echtes Retargeting mit anderer Ruhepose
und Dreh-Hilfsknochen. Ein neuer NPC-Unterbau wird dafür **nicht**
gebaut — die neuen Figuren sind reine Sichtvarianten auf der
vorhandenen Zivilisten-KI, wie es die City-V2-Vorgabe verlangt.

---

## 5. Bäume — kein Build-2-Asset

`trees_pack.glb` wird **nicht** verwendet: 2 894 706 Dreiecke, ein
einzelner Baum kostet so viel wie die halbe heutige Stadt, und
Dezimieren auf ein Browser-Budget lässt keinen Baum übrig.

Die Vorgabe nennt 3–6 Baumarten. Der Weg dorthin führt **nicht** über
dieses Paket, sondern über Alpha-Karten-Bäume (Stamm plus zwei bis vier
gekreuzte Blattkarten, 200–800 Dreiecke). Die vorhandene
`createTree`-Funktion in `city-visuals.js` bleibt bis dahin die
Grundlage.

---

## 6. Skyline — `skyscrapers_pack.glb`, stark dezimiert

Die sieben Türme (88 bis 238 m) sind für Straßenebene unbezahlbar, für
eine **Skyline-Schicht am Stadtrand** aber genau richtig: dort gibt es
keinen Kollider, keine NPCs, keine Nähe. Auf 10–15 % dezimiert (33 000 →
~4 000 Dreiecke je Turm) und mit einer einfachen Fassadentextur statt
modellierter Fenster kostet die ganze Schicht rund **8 MB und 2
Zeichenaufrufe** (zwei Materialien, je ein InstancedMesh).

`generic_1960s_office_skyscraper.glb` (45 764 Dreiecke, untexturiert)
kann als achter Typ dazu — sein Ursprung liegt allerdings nicht in der
Mitte (xz-Mitte bei 0 | 40), das muss beim Setzen ausgeglichen werden.

---

## Downloadbudget

| Posten | roh | optimiert |
|---|---|---|
| 10 Häuser | 29,3 MB | ~2,5 MB |
| 15 Mobiliarteile | 121,0 MB | ~2,0 MB |
| Ereignis-Deko (Baustelle) | 3,4 MB | ~0,8 MB |
| `generic_sedan_car` | 44,8 MB | ~5,0 MB |
| Chevy (FrigonTech) | 44,4 MB | ~4,0 MB |
| Chevrolet 1967 (Parker) | 128,3 MB | ~5,0 MB |
| MikeAlger | 31,1 MB | ~2,0 MB |
| Skyline (7 + 1 Türme) | 44,3 MB | ~8,0 MB |
| **Summe** | **446,6 MB** | **~29,3 MB** |

Das liegt im von der City-V2-Vorgabe genannten Rahmen von 15–30 MB
zusätzlichem optimiertem Inhalt — am oberen Ende. Wenn es enger werden
soll, fällt zuerst der Chevrolet-Parker (−5 MB), dann die Skyline-
Schicht auf vier statt acht Türme (−4 MB).

**Texturbudget:** durchgängig 512², nur 1024² dort, wo eine Fassade oder
eine Figur es wirklich braucht. Keine Normal-, Emissive- oder ORM-Karten
— das Spiel rechnet mit Lambert und Phong.

---

## Reihenfolge, wenn freigegeben

1. **Lizenzen klären.** Ohne das passiert nichts. Fünf Pakete reichen
   für den ganzen Vorschlag: `buildings.zip`,
   `city-props-collection-volume-1.zip`, `generic_sedan_car.glb`,
   `chevy-impala-rigged-by-frigon-tech.zip`,
   `rigged-t-pose-human-male-w-50-face-blendshapes.zip`. Drei weitere,
   wenn Skyline und Parkautos dazukommen sollen.
2. Ein Konverter je Paket in `tools/`, nach dem Muster von
   `tools/convert-haeuser.mjs`: Quelle, Autor und Lizenz im Kopf
   dokumentiert, Texturgrößen und Zielbudget im Code.
3. Erst dann Stage 1 der City V2.

**Vorher wird nichts an Straßenbreite, Blockraster, Navigation oder
Stadtgröße angefasst.** Das steht so in der City-V2-Vorgabe und gilt
unverändert.
