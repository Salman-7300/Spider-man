# CITY V2, Stufe 5: Bestandsaufnahme der Stadt

Automatisch erzeugt von `tools/pruef/stadtbestand.js` aus dem
laufenden Spiel - keine Zahl ist aus dem Quelltext geschaetzt.
Stand: vor dem Umbau der Bebauung (Stufe 5).

## Die ganze Stadt

| Groesse | Wert |
|---------|------|
| bloecke | 110 |
| gebaeude | 274 |
| gebaeudeInBloecken | 235 |
| gebaeudeAusserhalb | 39 |
| gebaeudeJeBlock | 2.49 |
| blockkanten | 440 |
| kantenMitHaus | 217 |
| haeuserJeKanteMittel | 0.72 |
| haeuserJeKanteMedian | 0 |
| kantenBelegungMittel | 19.56 |
| kantenBelegungMedian | 0 |
| kantenBelegungMax | 69 |
| hoeheMedian | 31.6 |
| hoeheMax | 97 |
| hoeheMin | 14.3 |
| verteilung | {"LOW":0,"MID":26.8,"UPPER":46.8,"HIGH":24.7,"HOCHHAUS":1.7} |
| zeichenaufrufe | 863 |
| dreiecke | 4148713 |
| kollider | 2884 |
| objekte | 16512 |
| hausModelle | 274 |
| objekteJeHausModell | 4.2 |
| dreieckeJeHausModell | 2441 |
| dreieckeAlleHausModelle | 668715 |
| tueren | 25 |
| gehknoten | 1468 |
| geometrien | 1826 |
| texturen | 298 |

## Was diese Zahlen ueber die Bebauung sagen

- Es gibt 274 Baukoerper, 235 davon in einem der 110 Bloecke, 39 ausserhalb (Ufer, Randstreifen). Das sind 2.49 Gebaeude je Block.
- Von 440 Blockkanten haben 217 ueberhaupt ein Gebaeude an der Bauflucht. Im Mittel stehen 0.72 Haeuser je Kante, der Median ist 0.
- Die Kantenbelegung liegt im Mittel bei 19.56 %, im Median bei 0 %, hoechstens bei 69 %. Eine geschlossene Strassenwand gibt es nirgends.
- Das niedrigste Gebaeude der Stadt ist 14.3 m hoch. Es gibt kein einziges Haus unter 12,8 m, also keine
  zwei- bis viergeschossige Bebauung - der Anteil LOW ist 0 %.
- Jede Kiste aus HAUS_KISTEN bekommt in setzeHausModelle eine eigene
  Kopie eines Gebaeudemodells: 274 Kopien, 4.2 Objekte und 2441
  Dreiecke je Haus, zusammen 668715 Dreiecke.
  Gezeichnet werden an den vier Messstellen im Median 4148713 Dreiecke,
  die Hausmodelle sind davon nur ein Teil - der groessere Posten sind
  Kulisse, Strassen und Deko. Ein zusaetzliches Haus kostet also rund
  2441 Dreiecke und 4.2 Szenenobjekte. Diese Zahl schwankt zwischen zwei Laeufen um
  etwa ein halbes Prozent, weil die Modelldateien verschieden schnell
  geladen sind - sie ist eine Groessenordnung, keine Konstante.
- Hoehenverteilung: LOW 0 %, MID 26.8 %, UPPER 46.8 %, HIGH 24.7 %, HOCHHAUS 1.7 %.

## Die fertigen Hausmodelle

Aus KIT_HAEUSER - gemessene Umrisse, nicht geschaetzt. Diese drei
Modelle sind die einzigen begehbaren Haeuser; alles andere sind
selbstgebaute Quader aus makeBuildingMesh.

| Modell | Breite m | Tiefe m | Hoehe m | Dach m | Tuer m | Hochparterre m | gesetzt |
|--------|----------|---------|---------|--------|--------|----------------|---------|
| Building_Small_1 | 12.46 | 14.54 | 17 | 16.8 | 1.45 | 1 | 11 |
| Building_Medium_2_001 | 15.06 | 13.06 | 25 | 24.8 | 1.45 | 0 | 7 |
| Building_Large_2 | 20.64 | 16.64 | 28 | 27.8 | 1.45 | 0 | 7 |

Die Quader aus makeBuildingMesh sind 6.5 bis 26.4 m breit und 6.6 bis 26.4 m tief.

## Bezirke

| Bezirk | Bloecke | Gebaeude | Hoehe Median |
|--------|---------|----------|--------------|
| WOHN | 65 | 149 | 27.5 |
| ZENTRUM | 32 | 63 | 39.2 |
| PARK | 2 | 0 | 0.0 |
| UFER | 11 | 23 | 33.2 |

## Jeder Block

Kantenbelegung ist der Anteil der Blockkante, vor dem ein Gebaeude
steht (Flanke hoechstens 6 m hinter der Bauflucht).

| bi | bj | x | z | Kern | Haeuser | Hoehe Med | bebaut m2 | Bezirk | N | O | S | W | Belegung N/O/S/W | POI | Tueren | Parkautos |
|----|----|---|---|------|---------|-----------|-----------|--------|---|---|---|---|------------------|-----|--------|-----------|
| 0 | 0 | -300 | -250 | - | 3 | 19.2 | 232 | WOHN | STREET | AVENUE | LOCAL | LOCAL | 24/0/29/0 | 0 | 0 | 10 |
| 0 | 1 | -300 | -200 | - | 0 | 0 | 0 | WOHN | STREET | AVENUE | STREET | LOCAL | 0/0/0/0 | 0 | 4 | 3 |
| 0 | 2 | -300 | -150 | - | 3 | 29.8 | 259 | WOHN | AVENUE | AVENUE | STREET | LOCAL | 26/0/30/0 | 0 | 0 | 2 |
| 0 | 3 | -300 | -100 | - | 1 | 58.3 | 538 | ZENTRUM | STREET | AVENUE | AVENUE | LOCAL | 0/0/0/58 | 1 | 0 | 3 |
| 0 | 4 | -300 | -50 | - | 0 | 0 | 0 | WOHN | STREET | AVENUE | STREET | LOCAL | 0/0/0/0 | 0 | 3 | 3 |
| 0 | 5 | -300 | 0 | - | 4 | 22.6 | 366 | WOHN | BOULEVARD | AVENUE | STREET | LOCAL | 48/48/50/55 | 0 | 0 | 4 |
| 0 | 6 | -300 | 50 | - | 1 | 56.4 | 507 | ZENTRUM | STREET | AVENUE | BOULEVARD | LOCAL | 0/55/0/0 | 1 | 0 | 5 |
| 0 | 7 | -300 | 100 | - | 3 | 25.8 | 249 | WOHN | STREET | AVENUE | STREET | LOCAL | 26/0/29/0 | 0 | 0 | 4 |
| 0 | 8 | -300 | 150 | - | 3 | 25.7 | 202 | WOHN | AVENUE | AVENUE | STREET | LOCAL | 0/28/0/26 | 0 | 0 | 2 |
| 0 | 9 | -300 | 200 | - | 1 | 44.6 | 434 | ZENTRUM | STREET | AVENUE | AVENUE | LOCAL | 47/0/0/0 | 0 | 0 | 5 |
| 0 | 10 | -300 | 250 | - | 3 | 28.4 | 277 | WOHN | LOCAL | AVENUE | STREET | LOCAL | 51/24/28/49 | 0 | 0 | 5 |
| 1 | 0 | -250 | -250 | - | 3 | 17.1 | 268 | WOHN | STREET | STREET | LOCAL | AVENUE | 29/0/30/0 | 0 | 0 | 4 |
| 1 | 1 | -250 | -200 | - | 1 | 49.4 | 477 | ZENTRUM | STREET | STREET | STREET | AVENUE | 0/0/0/0 | 0 | 0 | 2 |
| 1 | 2 | -250 | -150 | - | 3 | 17.4 | 267 | WOHN | AVENUE | STREET | STREET | AVENUE | 26/55/46/21 | 0 | 0 | 1 |
| 1 | 3 | -250 | -100 | - | 3 | 15.1 | 227 | WOHN | STREET | STREET | AVENUE | AVENUE | 0/26/0/25 | 0 | 0 | 3 |
| 1 | 4 | -250 | -50 | - | 3 | 26.6 | 235 | WOHN | STREET | STREET | STREET | AVENUE | 0/25/0/27 | 0 | 0 | 3 |
| 1 | 5 | -250 | 0 | - | 1 | 47.5 | 472 | ZENTRUM | BOULEVARD | STREET | STREET | AVENUE | 0/0/0/0 | 0 | 0 | 0 |
| 1 | 6 | -250 | 50 | - | 0 | 0 | 0 | WOHN | STREET | STREET | BOULEVARD | AVENUE | 0/0/0/0 | 0 | 3 | 1 |
| 1 | 7 | -250 | 100 | - | 3 | 27.2 | 258 | WOHN | STREET | STREET | STREET | AVENUE | 49/23/24/50 | 0 | 0 | 1 |
| 1 | 8 | -250 | 150 | - | 3 | 27.5 | 268 | WOHN | AVENUE | STREET | STREET | AVENUE | 23/25/52/50 | 0 | 0 | 2 |
| 1 | 9 | -250 | 200 | - | 3 | 17.3 | 247 | WOHN | STREET | STREET | AVENUE | AVENUE | 30/0/27/0 | 0 | 0 | 2 |
| 1 | 10 | -250 | 250 | - | 3 | 21.8 | 283 | WOHN | LOCAL | STREET | STREET | AVENUE | 50/54/25/25 | 0 | 0 | 1 |
| 2 | 0 | -200 | -250 | - | 0 | 0 | 0 | WOHN | STREET | STREET | LOCAL | STREET | 0/0/0/0 | 0 | 3 | 3 |
| 2 | 1 | -200 | -200 | - | 3 | 26.8 | 235 | WOHN | STREET | STREET | STREET | STREET | 0/29/0/24 | 0 | 0 | 4 |
| 2 | 2 | -200 | -150 | - | 0 | 0 | 0 | PARK | AVENUE | STREET | STREET | STREET | 0/0/0/0 | 1 | 0 | 3 |
| 2 | 3 | -200 | -100 | - | 3 | 32.5 | 258 | WOHN | STREET | STREET | AVENUE | STREET | 0/24/0/30 | 0 | 0 | 2 |
| 2 | 4 | -200 | -50 | - | 4 | 35.1 | 361 | ZENTRUM | STREET | STREET | STREET | STREET | 48/50/47/57 | 0 | 0 | 4 |
| 2 | 5 | -200 | 0 | - | 4 | 30.8 | 318 | ZENTRUM | BOULEVARD | STREET | STREET | STREET | 46/46/50/45 | 1 | 0 | 1 |
| 2 | 6 | -200 | 50 | - | 1 | 51.8 | 369 | ZENTRUM | STREET | STREET | BOULEVARD | STREET | 0/0/0/0 | 1 | 0 | 0 |
| 2 | 7 | -200 | 100 | - | 4 | 35.9 | 363 | ZENTRUM | STREET | STREET | STREET | STREET | 52/51/51/46 | 0 | 0 | 3 |
| 2 | 8 | -200 | 150 | - | 1 | 44.6 | 496 | ZENTRUM | AVENUE | STREET | STREET | STREET | 0/0/0/0 | 0 | 0 | 1 |
| 2 | 9 | -200 | 200 | - | 4 | 29.3 | 355 | WOHN | STREET | STREET | AVENUE | STREET | 47/53/52/47 | 0 | 0 | 2 |
| 2 | 10 | -200 | 250 | - | 3 | 27.5 | 228 | WOHN | LOCAL | STREET | STREET | STREET | 0/27/0/27 | 0 | 0 | 6 |
| 3 | 0 | -150 | -250 | - | 3 | 16.8 | 212 | WOHN | STREET | BOULEVARD | LOCAL | STREET | 0/31/0/25 | 0 | 0 | 4 |
| 3 | 1 | -150 | -200 | - | 3 | 34.8 | 245 | ZENTRUM | STREET | BOULEVARD | STREET | STREET | 49/45/22/26 | 0 | 0 | 2 |
| 3 | 2 | -150 | -150 | ja | 1 | 48.8 | 445 | ZENTRUM | AVENUE | BOULEVARD | STREET | STREET | 0/0/0/0 | 0 | 0 | 4 |
| 3 | 3 | -150 | -100 | ja | 3 | 32.1 | 255 | ZENTRUM | STREET | BOULEVARD | AVENUE | STREET | 24/21/50/51 | 0 | 0 | 4 |
| 3 | 4 | -150 | -50 | ja | 4 | 30.5 | 328 | ZENTRUM | STREET | BOULEVARD | STREET | STREET | 47/47/47/50 | 0 | 0 | 3 |
| 3 | 5 | -150 | 0 | ja | 1 | 53.1 | 512 | WOHN | BOULEVARD | BOULEVARD | STREET | STREET | 0/0/0/0 | 2 | 0 | 4 |
| 3 | 6 | -150 | 50 | ja | 2 | 28.9 | 172 | WOHN | STREET | BOULEVARD | BOULEVARD | STREET | 50/24/0/24 | 0 | 0 | 3 |
| 3 | 7 | -150 | 100 | ja | 1 | 49.6 | 461 | ZENTRUM | STREET | BOULEVARD | STREET | STREET | 48/0/0/0 | 0 | 0 | 4 |
| 3 | 8 | -150 | 150 | ja | 3 | 21.1 | 237 | WOHN | AVENUE | BOULEVARD | STREET | STREET | 27/0/31/0 | 0 | 0 | 1 |
| 3 | 9 | -150 | 200 | - | 4 | 30.3 | 390 | WOHN | STREET | BOULEVARD | AVENUE | STREET | 48/53/53/54 | 0 | 0 | 0 |
| 3 | 10 | -150 | 250 | - | 1 | 35.5 | 652 | ZENTRUM | LOCAL | BOULEVARD | STREET | STREET | 0/0/69/65 | 0 | 0 | 4 |
| 4 | 0 | -100 | -250 | - | 1 | 57.2 | 387 | ZENTRUM | STREET | STREET | LOCAL | BOULEVARD | 0/0/0/0 | 1 | 0 | 6 |
| 4 | 1 | -100 | -200 | - | 3 | 24.2 | 226 | WOHN | STREET | STREET | STREET | BOULEVARD | 0/31/0/25 | 0 | 0 | 3 |
| 4 | 2 | -100 | -150 | ja | 1 | 61.6 | 499 | ZENTRUM | AVENUE | STREET | STREET | BOULEVARD | 0/0/0/50 | 1 | 0 | 1 |
| 4 | 3 | -100 | -100 | ja | 3 | 34.4 | 245 | WOHN | STREET | STREET | AVENUE | BOULEVARD | 0/28/0/28 | 1 | 0 | 1 |
| 4 | 4 | -100 | -50 | ja | 2 | 40.2 | 160 | WOHN | STREET | STREET | STREET | BOULEVARD | 51/23/0/21 | 1 | 0 | 2 |
| 4 | 5 | -100 | 0 | ja | 3 | 31 | 249 | WOHN | BOULEVARD | STREET | STREET | BOULEVARD | 0/27/0/30 | 0 | 0 | 2 |
| 4 | 6 | -100 | 50 | ja | 0 | 0 | 0 | WOHN | STREET | STREET | BOULEVARD | BOULEVARD | 0/0/0/0 | 0 | 3 | 1 |
| 4 | 7 | -100 | 100 | ja | 2 | 23 | 154 | WOHN | STREET | STREET | STREET | BOULEVARD | 0/0/31/0 | 1 | 0 | 4 |
| 4 | 8 | -100 | 150 | ja | 1 | 52 | 481 | WOHN | AVENUE | STREET | STREET | BOULEVARD | 0/0/0/0 | 1 | 0 | 1 |
| 4 | 9 | -100 | 200 | - | 1 | 43 | 432 | ZENTRUM | STREET | STREET | AVENUE | BOULEVARD | 0/0/0/0 | 0 | 0 | 0 |
| 4 | 10 | -100 | 250 | - | 4 | 29.5 | 382 | WOHN | LOCAL | STREET | STREET | BOULEVARD | 50/52/50/55 | 0 | 0 | 4 |
| 5 | 0 | -50 | -250 | - | 0 | 0 | 0 | WOHN | STREET | STREET | LOCAL | STREET | 0/0/0/0 | 0 | 3 | 7 |
| 5 | 1 | -50 | -200 | - | 0 | 0 | 0 | PARK | STREET | STREET | STREET | STREET | 0/0/0/0 | 1 | 0 | 4 |
| 5 | 2 | -50 | -150 | ja | 1 | 67 | 653 | ZENTRUM | AVENUE | STREET | STREET | STREET | 66/69/0/0 | 1 | 0 | 3 |
| 5 | 3 | -50 | -100 | ja | 4 | 36.1 | 390 | ZENTRUM | STREET | STREET | AVENUE | STREET | 53/53/51/52 | 0 | 0 | 3 |
| 5 | 4 | -50 | -50 | ja | 4 | 47.9 | 351 | ZENTRUM | STREET | STREET | STREET | STREET | 50/51/49/48 | 2 | 0 | 5 |
| 5 | 5 | -50 | 0 | ja | 1 | 84.9 | 390 | WOHN | BOULEVARD | STREET | STREET | STREET | 0/0/0/0 | 2 | 0 | 2 |
| 5 | 6 | -50 | 50 | ja | 0 | 0 | 0 | WOHN | STREET | STREET | BOULEVARD | STREET | 0/0/0/0 | 0 | 0 | 2 |
| 5 | 7 | -50 | 100 | ja | 1 | 56 | 498 | WOHN | STREET | STREET | STREET | STREET | 0/52/0/0 | 1 | 0 | 7 |
| 5 | 8 | -50 | 150 | ja | 3 | 26 | 220 | WOHN | AVENUE | STREET | STREET | STREET | 27/0/29/0 | 0 | 0 | 4 |
| 5 | 9 | -50 | 200 | - | 3 | 27.6 | 277 | WOHN | STREET | STREET | AVENUE | STREET | 45/54/24/29 | 0 | 0 | 1 |
| 5 | 10 | -50 | 250 | - | 3 | 33 | 244 | ZENTRUM | LOCAL | STREET | STREET | STREET | 45/23/28/46 | 0 | 0 | 4 |
| 6 | 0 | 0 | -250 | - | 3 | 36.5 | 258 | ZENTRUM | STREET | AVENUE | LOCAL | STREET | 22/25/48/52 | 0 | 0 | 4 |
| 6 | 1 | 0 | -200 | - | 3 | 27.1 | 254 | WOHN | STREET | AVENUE | STREET | STREET | 0/29/0/31 | 0 | 0 | 2 |
| 6 | 2 | 0 | -150 | ja | 0 | 0 | 0 | WOHN | AVENUE | AVENUE | STREET | STREET | 0/0/0/0 | 0 | 3 | 1 |
| 6 | 3 | 0 | -100 | ja | 2 | 42.4 | 149 | WOHN | STREET | AVENUE | AVENUE | STREET | 0/0/31/0 | 1 | 0 | 0 |
| 6 | 4 | 0 | -50 | ja | 0 | 0 | 0 | WOHN | STREET | AVENUE | STREET | STREET | 0/0/0/0 | 0 | 0 | 1 |
| 6 | 5 | 0 | 0 | ja | 0 | 0 | 0 | WOHN | BOULEVARD | AVENUE | STREET | STREET | 0/0/0/0 | 0 | 3 | 2 |
| 6 | 6 | 0 | 50 | ja | 1 | 97 | 491 | ZENTRUM | STREET | AVENUE | BOULEVARD | STREET | 0/0/0/53 | 1 | 0 | 0 |
| 6 | 7 | 0 | 100 | ja | 2 | 45.6 | 145 | WOHN | STREET | AVENUE | STREET | STREET | 0/25/44/21 | 2 | 0 | 2 |
| 6 | 8 | 0 | 150 | ja | 2 | 35 | 196 | WOHN | AVENUE | AVENUE | STREET | STREET | 49/28/0/27 | 0 | 0 | 1 |
| 6 | 9 | 0 | 200 | - | 3 | 31.2 | 231 | WOHN | STREET | AVENUE | AVENUE | STREET | 0/24/0/29 | 0 | 0 | 2 |
| 6 | 10 | 0 | 250 | - | 3 | 30 | 224 | WOHN | LOCAL | AVENUE | STREET | STREET | 46/45/23/22 | 0 | 0 | 3 |
| 7 | 0 | 50 | -250 | - | 1 | 40.3 | 562 | ZENTRUM | STREET | STREET | LOCAL | AVENUE | 0/0/0/0 | 0 | 0 | 4 |
| 7 | 1 | 50 | -200 | - | 1 | 58.2 | 425 | ZENTRUM | STREET | STREET | STREET | AVENUE | 0/0/0/0 | 1 | 0 | 3 |
| 7 | 2 | 50 | -150 | ja | 3 | 25.9 | 238 | WOHN | AVENUE | STREET | STREET | AVENUE | 26/0/25/0 | 0 | 0 | 1 |
| 7 | 3 | 50 | -100 | ja | 4 | 41.2 | 375 | ZENTRUM | STREET | STREET | AVENUE | AVENUE | 55/46/52/52 | 1 | 0 | 3 |
| 7 | 4 | 50 | -50 | ja | 3 | 24.7 | 257 | WOHN | STREET | STREET | STREET | AVENUE | 0/26/0/29 | 0 | 0 | 4 |
| 7 | 5 | 50 | 0 | ja | 1 | 46.5 | 87 | WOHN | BOULEVARD | STREET | STREET | AVENUE | 0/0/27/23 | 1 | 0 | 0 |
| 7 | 6 | 50 | 50 | ja | 2 | 41.4 | 199 | WOHN | STREET | STREET | BOULEVARD | AVENUE | 53/25/0/27 | 0 | 0 | 3 |
| 7 | 7 | 50 | 100 | ja | 3 | 33 | 239 | WOHN | STREET | STREET | STREET | AVENUE | 25/0/30/0 | 0 | 0 | 2 |
| 7 | 8 | 50 | 150 | ja | 4 | 32.2 | 395 | WOHN | AVENUE | STREET | STREET | AVENUE | 56/52/51/50 | 0 | 0 | 0 |
| 7 | 9 | 50 | 200 | - | 3 | 34.1 | 266 | WOHN | STREET | STREET | AVENUE | AVENUE | 52/49/24/24 | 0 | 0 | 0 |
| 7 | 10 | 50 | 250 | - | 1 | 36.4 | 618 | ZENTRUM | LOCAL | STREET | STREET | AVENUE | 0/0/65/0 | 0 | 0 | 6 |
| 8 | 0 | 100 | -250 | - | 1 | 56 | 595 | ZENTRUM | STREET | STREET | LOCAL | STREET | 59/0/0/69 | 1 | 0 | 5 |
| 8 | 1 | 100 | -200 | - | 4 | 25.3 | 359 | WOHN | STREET | STREET | STREET | STREET | 46/46/55/52 | 0 | 0 | 1 |
| 8 | 2 | 100 | -150 | ja | 3 | 40.2 | 279 | ZENTRUM | AVENUE | STREET | STREET | STREET | 21/28/53/51 | 0 | 0 | 2 |
| 8 | 3 | 100 | -100 | ja | 3 | 30 | 231 | WOHN | STREET | STREET | AVENUE | STREET | 0/24/0/25 | 1 | 0 | 1 |
| 8 | 4 | 100 | -50 | ja | 1 | 59.3 | 519 | WOHN | STREET | STREET | STREET | STREET | 0/0/0/52 | 1 | 0 | 0 |
| 8 | 5 | 100 | 0 | ja | 3 | 36.1 | 237 | WOHN | BOULEVARD | STREET | STREET | STREET | 31/0/29/0 | 0 | 0 | 3 |
| 8 | 6 | 100 | 50 | ja | 1 | 60.5 | 433 | WOHN | STREET | STREET | BOULEVARD | STREET | 0/0/0/0 | 1 | 0 | 2 |
| 8 | 7 | 100 | 100 | ja | 2 | 38 | 160 | WOHN | STREET | STREET | STREET | STREET | 0/27/44/24 | 1 | 0 | 2 |
| 8 | 8 | 100 | 150 | ja | 2 | 31.4 | 208 | WOHN | AVENUE | STREET | STREET | STREET | 52/28/0/27 | 0 | 0 | 0 |
| 8 | 9 | 100 | 200 | - | 1 | 54.8 | 633 | ZENTRUM | STREET | STREET | AVENUE | STREET | 0/64/0/0 | 1 | 0 | 5 |
| 8 | 10 | 100 | 250 | - | 4 | 24.7 | 376 | WOHN | LOCAL | STREET | STREET | STREET | 46/49/57/52 | 0 | 0 | 4 |
| 9 | 0 | 150 | -250 | - | 3 | 30.6 | 274 | UFER | STREET | STREET | LOCAL | STREET | 24/55/49/23 | 0 | 0 | 5 |
| 9 | 1 | 150 | -200 | - | 1 | 48.5 | 519 | UFER | STREET | STREET | STREET | STREET | 0/0/0/0 | 0 | 0 | 1 |
| 9 | 2 | 150 | -150 | ja | 1 | 51.3 | 581 | UFER | AVENUE | STREET | STREET | STREET | 0/0/0/0 | 1 | 0 | 2 |
| 9 | 3 | 150 | -100 | ja | 4 | 36.3 | 359 | UFER | STREET | STREET | AVENUE | STREET | 53/44/50/53 | 0 | 0 | 3 |
| 9 | 4 | 150 | -50 | ja | 3 | 26.4 | 239 | UFER | STREET | STREET | STREET | STREET | 0/29/0/25 | 0 | 0 | 2 |
| 9 | 5 | 150 | 0 | ja | 2 | 37.6 | 186 | UFER | BOULEVARD | STREET | STREET | STREET | 0/27/50/25 | 1 | 0 | 4 |
| 9 | 6 | 150 | 50 | ja | 2 | 35.5 | 173 | UFER | STREET | STREET | BOULEVARD | STREET | 48/28/0/21 | 0 | 0 | 3 |
| 9 | 7 | 150 | 100 | ja | 1 | 53.9 | 399 | UFER | STREET | STREET | STREET | STREET | 0/0/0/0 | 1 | 0 | 5 |
| 9 | 8 | 150 | 150 | ja | 1 | 35.5 | 439 | UFER | AVENUE | STREET | STREET | STREET | 0/0/0/0 | 0 | 0 | 1 |
| 9 | 9 | 150 | 200 | - | 1 | 59.6 | 417 | UFER | STREET | STREET | AVENUE | STREET | 0/0/0/0 | 1 | 0 | 3 |
| 9 | 10 | 150 | 250 | - | 4 | 30 | 358 | UFER | LOCAL | STREET | STREET | STREET | 53/46/46/55 | 0 | 0 | 7 |
