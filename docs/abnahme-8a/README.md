# CITY V2 Stufe 8A - Abnahme Bezirksidentitaet

Vorher: Stand 82607ec (Stufe 7B), nachher: Stufe 8A. Keim 4711,
Tageszeit 0,45, gleiche Kamera und gleicher Ablauf - Wagen und Passanten
stehen in beiden Bildern an derselben Stelle (eingefroren, gleicher
Zufallsstrom). Erzeugt mit `tools/pruef/district-bilder.js`, Doku:
`docs/CITY-V2-DESIGN.md`, Abschnitt 6q. Bilder und Nahaufnahmen zeigen
den eingecheckten Stand (nach der Atlas-Korrektur, siehe 6q, Leistung).

## Vergleichsbilder VORHER | NACHHER

Strassenaufnahmen mit der normalen Spielkamera (die Figur steht auf dem
Gehweg), je Stadtteil zwei:

| Datei | Inhalt |
| --- | --- |
| `8a-vergleich-1-zentrum-geschaeft.jpg` | Z-A1, Z-A2, G-A1, G-A2 |
| `8a-vergleich-2-mischung-wohnen.jpg` | M-A1, M-A2, W-A1, W-A2 |
| `8a-vergleich-3-ufer-park.jpg` | U-A1, U-A2, P-A1, P-A2 |
| `8a-vergleich-4-luft-a.jpg` | Luftansichten Zentrum, Geschaeft, Mischung |
| `8a-vergleich-5-luft-b.jpg` | Luftansichten Wohnen, Ufer, Park |
| `8a-vergleich-6-grenzen.jpg` | Zentrum -> Mischung, Geschaeft -> Wohnen, Mischung -> Ufer |
| `8a-vergleich-7-licht.jpg` | Daemmerung (Wohnen), Nacht (Geschaeftsviertel), Regen (Zentrum) |

Die Ortsnamen stehen nur in der Bildbeschriftung (Aufnahmeinformation),
nicht im Spiel.

## Erkennbarkeit ohne Namen

`8a-blindtest-nachher.jpg` und `8a-blindtest-vorher.jpg`: dieselben zwoelf
Strassenaufnahmen, ohne Beschriftung, gemischt. Schluessel:
1 Wohnen (W-A2), 2 Zentrum (Z-A1), 3 Ufer (U-A2), 4 Geschaeft (G-A1),
5 Mischung (M-A2), 6 Park (P-A1), 7 Zentrum (Z-A2), 8 Wohnen (W-A1),
9 Park (P-A2), 10 Geschaeft (G-A2), 11 Ufer (U-A1), 12 Mischung (M-A1).

## Nahaufnahmen

`8a-nah-tag.jpg`, `8a-nah-nacht.jpg`: je Art ein Beispiel aus dem Lauf
(nicht gestellt) - Ladenschild, Bueroschild, Hauseingang mit Nummer und
Leuchte, Wegweiser, Banner, Parkportal, Wahrzeichen, Vorplatz. Nachts
leuchten Laden- und Bueroschilder, Schaufenster, Tuerleuchten und die
Wahrzeichen; Wegweiser, Banner und Portal nicht.

## Gameplay-Video

`8a-video-bezirke.mp4`: Titeltafel, dann sechs Gaenge zu Fuss (je 24 s,
Alt+W, normale Spielkamera, Echtzeit) und zwei erhoehte Blicke von einer
Dachkante (je 14 s, die Spielkamera dreht sich um die Figur):

1. Zentrum - Boulevard z = 25, Nordseite nach Osten
2. Geschaeftsviertel - Avenue z = 175, Suedseite nach Osten
3. Mischgebiet - Strasse z = 75, Suedseite nach Osten
4. Wohngebiet - Strasse z = 125, Nordseite nach Osten
5. Ufer - Promenade nach Norden
6. Park -200/-150 - vom Gehweg durch das Westportal zum Brunnen und durch
   das Nordportal hinaus
7. Erhoeht - Dachkante im Zentrum
8. Erhoeht - Dachkante am Ufer (Fluss und Bruecke)

Keim 4711, Tageszeit 0,45, Gangs und Vorfaelle aus - das Video zeigt die
Stadt, keinen Kampf. Der Ortsname oben links ist Aufnahmeinformation.
Erzeugt mit `tools/pruef/district-video.js`, aufgenommen vor der
Atlas-Korrektur (die Tafeln unterscheiden sich davon nur in einzelnen
Randpixeln kleiner Tafeln). Der Parkweg weicht der Bank
am Brunnen aus: auf dem 7A/7B-Weg blieb die Figur an ihr stehen (schon
im 7B-Video).

## Bekannte offene Fehler (nicht 8A)

1. Fliehende Passanten laufen durch den stehenden Helden (siehe
   `docs/abnahme-7b/README.md`).
2. npc-wege B: Fliehende kurz unter der Bodenflaeche an der
   Brueckenroute.
3. Weisser Promenadenbelag in einem Teil der Bilder (U-A1 vorher und
   nachher).
4. Bushaeuschen, an dem die Figur im 7A-Video haengen blieb.
