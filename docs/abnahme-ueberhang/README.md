# Problem-2 - Klettern an Ueberhaengen: Abnahmebilder

Links immer **VORHER** (Stand 9afcf6d: Kletterhaut ohne Koerperrahmen, im
Pruefstand mit dem Schalter `koerperHautAlt`), rechts **NACHHER**
(Endstand). Keim 4711, Tageszeit 0,44, Wagen, Passanten und Gegner
ausgeblendet, sonst nichts veraendert. Beide Seiten fahren denselben
regulaeren Weg mit echten Tasten (`tools/pruef/ueberhang-video.js`, Wege
wie `tools/pruef/ueberhang-klettern.js`), jedes 4. Bild = 15 Bilder/s =
Echtzeit. Doku: `docs/CITY-V2-DESIGN.md`, Abschnitt 6t.

Oben links steht in jedem Bild, was der Pruefstand dort misst: wie tief
Kopf, Schultern und Brust in der sichtbaren Geometrie des Hauses stecken
(rot) - oder "frei" (gruen). Grau: die Figur haengt nicht an der Zielwand
(etwa noch beim Abfangen).

| Datei | Inhalt |
| --- | --- |
| `ueberhang-video-spiel.mp4` | normale Spielkamera: ModernOffice_1 hinunter (2938: vom Dach ueber die Kante, abfangen, durch das Band ueber dem Erdgeschoss), ModernOffice_1 seitwaerts (3825: vom Boden ankleben, auf Bandhoehe, seitwaerts unter dem Band), Brutal_1 hinunter (ueber den Kern), Brutal_1 seitwaerts (bis an die Kante des Kerns), Kontrolle an einer normalen Fassade (Harlem, hinunter) |
| `ueberhang-video-seite.mp4` | dieselben Abstiege (ModernOffice_1 2938, Brutal_1) mit fester Diagnosekamera seitlich der Stelle, 3,5 m laengs und 1,6 m vor der Fassade auf Hoehe der Figur: Koerper gegen Ueberhang im Profil |
| `ueberhang-standbilder.jpg` | je Weg das Bild mit der groessten Durchdringung vorher und das Bild auf derselben Hoehe nachher |
