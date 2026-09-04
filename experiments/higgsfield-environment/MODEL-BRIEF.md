# Modellvorgaben für die Umgebungsprobe

Diese Vorgaben beschreiben noch ausstehende 3D-Arbeit. Sie sind keine Messwerte oder zugesicherten Eigenschaften der erzeugten Bilder.

## Gemeinsamer Export

- Format: GLB mit eingebetteten Texturen, Einheit Meter, Y nach oben; Skalierung vor Export anwenden.
- Ursprung: mittig auf Bodenniveau. Fahrzeugfront in Richtung +Z; beim Import an die tatsächliche Spielausrichtung anpassen.
- Saubere UVs und Normalen; keine eingebrannte harte Studiobeleuchtung. Hintergrund und Kontaktschatten aus dem Referenzbild gehören nicht zur Textur.
- Konservative erste Budgets: Haus bis etwa 6.000, Auto bis etwa 8.000 Dreiecke; möglichst wenige Materialien, zunächst höchstens vier pro Modell. Das sind Arbeitsziele, kein bereits gemessener Leistungsnachweis.
- Texturen zunächst 1024 Pixel; 2048 nur bei sichtbarem Nutzen. Standardmaterialien verwenden und mit der bestehenden Three.js-Version prüfen.
- Mehrere Ansichten vor Abnahme kontrollieren. Die Einzelbilder zeigen Rückseiten und Unterseiten nicht.

## Haus mit Laden

Referenz: [brick-shop-reference.png](brick-shop-reference.png).

- Vier Geschosse insgesamt: ein Laden, drei Wohnetagen. Ursprünglich angeforderte fünf Geschosse werden für diese Probe nicht erzwungen.
- Arbeitsmaß ungefähr 12 m breit, 10 m tief, 14 m hoch; vor Einbau an einen vorhandenen Bauplatz anpassen.
- Boxförmiger Grundkörper, gerade Außenwände, matte Backsteinfassade, helle Fensterbänke und petrolfarbene Markise.
- Freie, ebene Dachfläche mit niedriger Brüstung. Das Flachdach muss zum vorhandenen Klettern und Landen passen.
- Fenster vorwiegend über Texturen und flache Vertiefungen darstellen. Keine einzeln modellierten Ziegel.
- Einfache Kollisionshülle getrennt von dekorativer Geometrie vorsehen. Tatsächliche begehbare Dachhöhe ausdrücklich prüfen: Brüstung und Gesims dürfen den Dachkontakt nicht verfälschen.

Bestehender Ansatzpunkt im untersuchten Code: `ladeHaeuser` / `setzeHausModelle` und `assets/haeuser.glb`. Modellnamen werden zur Auswahl verwendet. Ein neues Modell muss eine passende Zuordnung erhalten; nicht ungeprüft das gesamte vorhandene Hauspaket ersetzen.

## Stadtwagen

Referenz: [city-car-reference.png](city-car-reference.png).

- Arbeitsmaß ungefähr 4,5 m lang, 1,9 m breit, 1,6 m hoch. Vor Einbau vorhandene Fahrzeuggrenzen und Sitzpositionen prüfen.
- Karosserie und vier Räder als getrennte benannte Knoten: `body`, `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr`.
- Radursprünge im jeweiligen Achsmittelpunkt. Rollachse und Lenkrichtung im Spiel prüfen.
- Geschlossene Türen; nutzbare Kabine mit vier Sitzpositionen. Scheiben dürfen vorhandene Insassen nicht verdecken oder fehlerhafte Sortierung verursachen.
- Leuchten als klar getrennte Materialien oder Knoten. Normale Stadtwagen zunächst vor Taxi-, Polizei- oder Missionsvarianten erproben.

Bestehender Ansatzpunkt im untersuchten Code: `makeCarMesh` / `makeFahrzeugMesh`. Das neue Modell muss in die vorhandene Fahrzeughülle passen. Bestehende Metadaten, Insassen, Fahrverhalten und Blaulichtreferenzen bleiben Aufgabe der vorhandenen Logik.

## Abnahme vor Einbau

1. GLB laden und Geometrie, Texturen, Ursprung, Maße und Knotennamen prüfen.
2. Haus mit identischer bestehender Kollisionshülle aufstellen; Dachlandung, Wandkontakt und Bodenkontakt prüfen.
3. Einen normalen PKW visuell ersetzen; Räder, Insassen, Fahrtrichtung, Bremsen und Kamera prüfen.
4. Identische Szene mit und ohne neue Modelle vergleichen: Ladezeit, Draw Calls, Texturspeicher und Bildrate dokumentieren.
5. Erst nach erfolgreicher Probe die weitere Verteilung in der Stadt planen.

Menschen und U-Bahn sind eigene Folgeschritte. Menschen benötigen zusätzlich ein passendes Skelett und konsistente Bewegungen; eine U-Bahn benötigt Geometrie, Streckenführung und Spiellogik. Bild- oder Videogenerierung allein liefert diese Systeme nicht.

