# CITY V2 Stufe 8A - Abnahme Erdgeschosse und Bezirksbild (Neufassung)

Die erste Fassung von 8A (9915ef5: Laden- und Bueroschilder, Wegweiser,
Banner, Parkportale) wurde nicht abgenommen. Diese Bilder zeigen die
Neufassung gegen beide Staende. Keim 4711, Tageszeit 0,45 (Nacht 0,92,
Daemmerung 0,765), gleiche Kamera und gleicher Ablauf - Wagen und
Passanten stehen in allen drei Spalten an derselben Stelle (eingefroren,
gleicher Zufallsstrom). Doku: `docs/CITY-V2-DESIGN.md`, Abschnitt 6q.

Spalten: **VOR 8A** (82607ec, Stufe 7B) | **8A ALT** (9915ef5, abgelehnt)
| **8A NEU**.

## Strassenhoehe, alle Stadtteile (`tools/pruef/district-bilder.js`)

Normale Spielkamera, die Figur steht auf dem Gehweg:

| Datei | Inhalt |
| --- | --- |
| `8a-vergleich-1-zentrum-geschaeft.jpg` | Z-A1, Z-A2, G-A1, G-A2 |
| `8a-vergleich-2-mischung-wohnen.jpg` | M-A1, M-A2, W-A1, W-A2 |
| `8a-vergleich-3-ufer-park.jpg` | U-A1, U-A2, P-A1, P-A2 |
| `8a-vergleich-4-grenzen.jpg` | Zentrum -> Mischung, Geschaeft -> Wohnen, Mischung -> Ufer |
| `8a-vergleich-5-licht.jpg` | Daemmerung (Wohnen), Nacht (Geschaeftsviertel), Regen (Zentrum) |

## Fensterfronten und fruehere Problemfaelle (8A ALT | 8A NEU)

Feste Kamerapunkte; Figur, fahrende Wagen und Passanten ausgeblendet, Parkautos bleiben:

| Datei | Inhalt |
| --- | --- |
| `8a-fenster-tuerme.jpg` | Hochhaus-Lobby frontal und schraeg (zwei Turmstile), Lobby nachts: Bueroscheiben mit Raum, eingerichtete Lobby |
| `8a-fenster-modelle.jpg` | Residential_3 (Pfeiler), PublicBuilding_1 (Saeulen), Brutal_1 (offene Halle), ModernOffice_1 (Arkade) - frontal |
| `8a-fenster-modelle-schraeg.jpg` | dieselben schraeg (6 m seitlich) |
| `8a-problemfaelle-tag.jpg` | die Stellen von "Friseur" (Arkade ModernOffice_1), "Apotheke", dem Ufer-Banner und dem Portal STADTPARK |
| `8a-problemfaelle-nacht.jpg` | dieselben Stellen nachts |

## Nahaufnahmen der Erdgeschoss-Programme

`8a-nah-tag.jpg`, `8a-nah-nacht.jpg`: je Stadtteil und Programm ein
Beispiel aus dem Lauf (nicht gestellt), frontal aus 8 m: Zentrum Buero und
Flagship, Geschaeft Laden und Buero, Mischung gemischt, Laden und Wohnen,
Wohnen Wohnzeile und Ecklaeden, Ufer Wohnen und Cafe.

## Gameplay-Video

`8a-video-bezirke.mp4`: Titeltafel, dann fuenf Gaenge zu Fuss (je 24 s,
Alt+W, normale Spielkamera, Echtzeit): Zentrum (Boulevard z = 25),
Geschaeftsviertel (Avenue z = 175), Mischgebiet (Strasse z = 75),
Wohngebiet (Strasse z = 125), Ufer (Promenade). Keim 4711, Tageszeit
0,45, Gangs und Vorfaelle aus. Der Ortsname oben links ist
Aufnahmeinformation - im Spiel gibt es keine Anzeige dafuer. Erzeugt mit
`tools/pruef/district-video.js`.

## Bekannte offene Fehler (nicht 8A)

1. Fliehende Passanten laufen durch den stehenden Helden (siehe
   `docs/abnahme-7b/README.md`).
2. npc-wege B: Fliehende kurz unter der Bodenflaeche an der
   Brueckenroute.
3. Weisser Promenadenbelag in einem Teil der Bilder (U-A1, in allen drei
   Staenden).
4. Bushaeuschen, an dem die Figur im 7A-Video haengen blieb.
