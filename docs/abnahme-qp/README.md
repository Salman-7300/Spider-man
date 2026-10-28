# CITY V2 Qualitaets-Pass - Abnahmebilder

Links immer **VORHER** (64d4952, Stufe 8B), rechts **NACHHER**. Keim
4711, Tageszeit 0,45. Doku: `docs/CITY-V2-DESIGN.md`, Abschnitt 6s.

## Die drei Screenshot-Situationen

`qp-00-screenshots-8b-gegen-endstand.jpg`: dieselbe Kamera auf dem Stand
8B (64d4952) und im Endstand des Passes - Screenshot 1 (Avenue x = 25,
weiss-gelb-weiss), Screenshot 2 (Stadthaus neben PublicBuilding_1 mit den
Farbtafeln, dazu die Fassade jetzt hell und scharf), Screenshot 3 (die
Wohnstrasse mit Parkplaetzen - Parken unveraendert, nur die Mittellinie
endet vor dem Zebrastreifen).

## Paket 1: Fahrbahnmarkierung

Normale Spielkamera, die Figur steht auf der Fahrbahn und schaut laengs
der Strasse; dieselbe Kamera in beiden Staenden.

| Datei | Inhalt |
| --- | --- |
| `qp-strasse-1-zweispurig.jpg` | STREET x = -75, LOCAL x = -325 (Stadtrand), Wohnstrasse z = 125 mit Parkstreifen (von oben): eine gestrichelte gelbe Mitte, keine weissen Linien, Striche enden vor dem Zebrastreifen |
| `qp-strasse-2-vierspurig.jpg` | AVENUE x = 25 (der Screenshot) und z = -125: doppelte gelbe Mitte, weisse Trenner der zwei Spuren je Richtung; BOULEVARD z = 25 und x = -125: Mittelstreifen betongrau statt grell weiss |
| `qp-strasse-3-kreuzung-bruecke-ufer.jpg` | Kreuzung Avenue x = 25 / z = 75, Brueckenstrasse z = -25 zur Bruecke, Uferstrasse x = 175 |

## Paket 2: Gebaeudequalitaet (`tools/pruef/gebaeude-bilder.js`)

Feste Hausauswahl je Typ, dieselben Kameras in beiden Staenden; Wagen,
Passanten und Figur ausgeblendet. Die Leuchttafeln sind in diesen Bildern
noch da - sie verschwinden erst mit Paket 3.

| Datei | Inhalt |
| --- | --- |
| `qp-gebaeude-00-uebersicht-nachher.jpg` | alle 12 Typen nachher aus Strassenabstand: drei prozedurale Familien, sieben Modelle, zwei Hochhaeuser - die Vielfalt bleibt |
| `qp-gebaeude-01-Wohnhaus.jpg` bis `-03-Uferhaus.jpg` | prozedurale Familien (Referenzqualitaet, unveraendert) |
| `qp-gebaeude-04-Brownstone.jpg`, `-05-Brownstone2.jpg` | Brownstone FlatFacade_6 und Lowrise_1 |
| `qp-gebaeude-06-ModernOffice1.jpg`, `-07-ModernOffice2.jpg` | Bueromodelle |
| `qp-gebaeude-08-PublicBuilding.jpg`, `-09-Brutal.jpg`, `-10-Residential.jpg` | Downtown-Modelle |
| `qp-gebaeude-11-Turm-a.jpg`, `-12-Turm-b.jpg` | zwei Hochhaeuser (Turm_1, Turm_3, unveraendert) |
| `qp-gebaeude-13-schaerfe-1zu1.jpg` | Obergeschosse als Ausschnitt ohne Verkleinerung: ModernOffice_2, PublicBuilding_1, Residential_3, Brutal_1, Brownstone Lowrise_1 |

Je Typ-Bild fuenf Zeilen: Strassenabstand 16 m, nah 4,5 m, streifend
schraeg (3,5 m vor der Front, bis 20 m seitlich), Obergeschosse aus
18 m, Nacht (Tageszeit 0,92).

## Paket 3: Grelle Farbtafeln (`tools/pruef/leuchttafel-bilder.js`, `district-bilder.js neon=an`)

Vorher und nachher im SELBEN Stand (Paket 1 und 2 enthalten) - nur der
Pruefschalter fuer die alte Leuchtreklame unterscheidet die Bilder.

| Datei | Inhalt |
| --- | --- |
| `qp-tafeln-1-screenshot-lage.jpg` | die Lage aus Screenshot 2: Stadthaus mit magenta Querband, daneben PublicBuilding_1 mit roter und weisser Tafel - Tag und Nacht |
| `qp-tafeln-2-stellen.jpg` | sechs weitere Stellen: Zentrum (ModernOffice_2, gruen), Geschaeftsviertel (Turm_1, weiss), Mischung (PublicBuilding_1, rot), Wohnen (Wohnhaus, cyan), Ufer (ModernOffice_1, pink), Hochhaus Turm_2 mit acht Tafeln; Zentrum und Geschaeft auch nachts |
| `qp-tafeln-3-bezirke.jpg` | feste Spielkamera-Ansichten: Zentrum Z-A1, Geschaeft G-A1, Mischung M-A1, Wohnen W-A1, Ufer U-A2, Nachtstrasse K-NACHT |
