# CITY V2 Stufe 8B - Abnahme Baukoerper, Verkehr und Parken

Links immer **VORHER** (aa04428, Stufe 8A), rechts **NACHHER**. Keim
4711. Doku: `docs/CITY-V2-DESIGN.md`, Abschnitt 6r.

## A. Ein Gebaeude, eine Familie (`tools/pruef/fassaden-familien.js`)

Feste Hausauswahl (je Haustyp x Bezirk x Erdgeschoss-Programm ein Haus,
im neuen Stand gewaehlt, in beiden Staenden an derselben Stelle
gerendert), Augenhoehe 1,7 m, Tageszeit 0,45; Wagen und Passanten
ausgeblendet, Parkautos bleiben.

| Datei | Inhalt |
| --- | --- |
| `8b-fassaden-prozedural-1.jpg` | **Problemfall** Wohnhaus im Wohngebiet (kiste-WOHN-wohnen) aus 13 m / 7 m seitlich und schraeg aus 9 m / 12 m; dazu Wohnhaus mit Ecklaeden, Stadthaus gemischt |
| `8b-fassaden-prozedural-2.jpg` | Stadthaus mit Laden, Stadthaus wohnen, Uferhaus wohnen, Uferhaus Cafe |
| `8b-fassaden-modelle-1.jpg` | Ziegelmodelle (Brownstone FlatFacade_6, FlatFacade_3, Commercial_1_C, FlatFacade_5): Erdgeschoss in Modellziegel statt Wohnputz |
| `8b-fassaden-modelle-2.jpg` | Buero- und Betonmodelle im Mischgebiet (ModernOffice_1, Brutal_1): Buerofront in Modelltoenen statt Wohnputz; zum Vergleich ModernOffice_2 im Zentrum und im Geschaeftsviertel - dort ist nichts geaendert |
| `8b-fassaden-nacht-1.jpg`, `-2.jpg` | nachts (0,92): Wohnhaus (Problemfall), Wohnhaus mit Laeden, Stadthaus, Uferhaus, Brownstone FlatFacade_6, ModernOffice_1 - einzelne Fenster hell, auf den Achsen |

## B. Verkehr (`tools/pruef/verkehr-bilder.js`)

Nach 90 s Spielzeit (Tageszeit 0,45). Einzelbilder sind fuer Verkehr ein
schwacher Beleg - der Augenblick entscheidet. Deshalb zaehlt der
Pruefstand je Ansicht 60-mal im Sekundenabstand die fahrenden Wagen, die
wirklich zu sehen sind (Bildkegel, bis 150 m, nicht hinter einem Haus):

| Ansicht | vorher Mittel (leer von 60) | nachher Mittel (leer von 60) |
| --- | --- | --- |
| Boulevard z = 25, Mittelstreifen, Augenhoehe | 0,65 (30) | 4,30 (0) |
| Boulevard z = 25 aus 14 m | 0,43 (34) | 3,23 (0) |
| Avenue x = 25 aus 14 m | 0,87 (30) | 2,38 (2) |
| Boulevard-Achse aus 30 m | 0,65 (21) | 1,60 (13) |
| Zentrum, Strasse x = -25 | 0,40 (40) | 2,13 (3) |
| Zentrum aus der Luft (70 m) | 0,10 (55) | 0,98 (32) |
| Geschaeftsviertel, Boulevard x = -125 | 0,72 (27) | 1,55 (10) |
| Wohnstrasse z = 125, Augenhoehe | 0,05 (57) | 0,05 (57) |
| Wohnstrasse z = 125 aus 9 m | 0,00 (60) | 0,12 (53) |

| Datei | Inhalt |
| --- | --- |
| `8b-verkehr-1-boulevard.jpg` | Boulevard aus 14 m zu zwei Zeitpunkten (8 s Abstand), Boulevard-Achse aus 30 m |
| `8b-verkehr-2-avenue-zentrum.jpg` | Avenue aus 14 m, Zentrum aus der Luft, Zentrumsstrasse auf Augenhoehe |

## C. Parken

| Datei | Inhalt |
| --- | --- |
| `8b-parken-wohnstrasse.jpg` | Wohnstrasse z = 125 auf Augenhoehe und aus 9 m; Wohnen W-A2 mit der Spielkamera: markierte Stellplaetze, beidseitig belegt |
| `8b-parken-nah-tag-nacht.jpg` | geparkte Wagen aus der Naehe (Wohnen, Mischung, Zentrum), Tag und Nacht: Lack, Raeder, Markierung |

## Strassenhoehe, alle Stadtteile (`tools/pruef/district-bilder.js`)

Normale Spielkamera, eingefroren direkt nach dem Laden (die fahrenden
Wagen stehen dort, wo sie starten):

| Datei | Inhalt |
| --- | --- |
| `8b-strasse-1-zentrum-geschaeft.jpg` | Z-A1, Z-A2, G-A1, G-A2 |
| `8b-strasse-2-mischung-wohnen.jpg` | M-A1, M-A2, W-A1, W-A2 |
| `8b-strasse-3-ufer-park.jpg` | U-A1, U-A2, P-A1, P-A2 |
| `8b-strasse-4-luft-licht.jpg` | Luftansicht Wohnen und Mischung, Daemmerung, Nacht |
