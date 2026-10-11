# Stadt, Fahrzeuge und Schwunganimation – Teststand

Folgedurchgang vom 5. September 2026:
[Glas, Kletterkamera und Kontakt](REALISM-CAMERA-POLISH.md).
Die Modellübersicht unten zeigt den aktuellen Stand; die Beschreibung und
Messwerte dieses Berichts dokumentieren den davorliegenden Durchgang.

Grundlage: Claudes Branch `claude/spider-man-game-dev-8cepen` bis
`28a5a232779e1018329cfb8570b656cc8313f96c`, einschließlich seiner letzten
Korrekturen an Mission 6 und dem Missionsziel von Mission 8. Diese Änderungen
sind mit dem bisherigen Animationsstand aus PR #1 zusammengeführt.

## Eingebaut

| Bereich | Änderung |
| --- | --- |
| Hochhäuser | Vier Fassadenstile ab 38 m: Glasraster, Kalkstein, Kupferrippen und Silberband. Fenster, tiefe Streben und Erdgeschossdetails. Vorhandene Grundflächen, Gebäudehöhen und begehbare Dachflächen bleiben erhalten. |
| Autos | Drei Karosserievarianten mit schrägen Scheiben, offenen Fahrgastzellen, Spiegeln, Felgen, LED-Leuchten und Bremslichtern. Räder rollen mit der Fahrstrecke; Vorderräder lenken in Kurven. |
| Taxi und Polizei | Neue Autokarosserien mit bestehenden Rollen und Insassen. Das Taxischild sitzt über dem Dach. Der vorhandene Blaulichtbalken bleibt erhalten. |
| Lkw | Kühlergrill, Leuchten, Spiegel, Trittstufen, Dachverkleidung, gerippter Ladeaufbau und reflektierende Streifen. Animierte Räder mit Felgen. |
| Bus | Überarbeitete Leuchten und Außenleisten, animierte Räder mit Felgen. Bestehende Fahrgastplätze und Innenräume bleiben erhalten. |
| Helikopter | Geformter Rumpf und Cockpit, Scheibenrahmen und seitliche Details. Heckrotorblätter liegen jetzt in ihrer tatsächlichen Rotationsebene. Flugsteuerung, Besatzung und Suchscheinwerfer bleiben angebunden. |
| U-Bahn | Metallverkleidung, Glasfenster, Haltestangen, Leuchten und drehende Räder. Bewegliche Türen enthalten ihre eigenen Scheiben. Wand und Sitzbank verdecken den geöffneten Einstieg nicht mehr. Alle 30 bestehenden Sitzplätze bleiben angebunden. |
| Zivilisten | Sechs Kleidungs-/Zubehörvarianten auf den vorhandenen Figuren. Rucksäcke und Taschen folgen dem Oberkörper. Haut- und gemeinsame Körpertexturen werden nicht pauschal eingefärbt. |
| Gegner | Erkennbare Westen, Gurte und Ausrüstung für die vorhandenen Rollen Schläger, Brecher, Flink, Wächter, Werfer und ENFORCER. Keine neuen Gegnertypen oder Kampfwerte. |
| Spider-Man | Schwunghaltung folgt dem Pendelbogen. Armführung berücksichtigt Ober- und Unterarm; Umgreifen und der zweite Griff blenden weich ein. Schulter- und Armbewegungen sind zeitabhängig begrenzt. Richtungswechsel und Ankerführung werden exponentiell geglättet. |

Der vorhandene `schwung2`-Clip ist eine einmalige Drehbewegung, keine nahtlose
Schleife: Anfang und Ende unterscheiden sich am linken Unterschenkel um etwa
149 Grad. Die neue Schwungdarstellung verwendet dessen stabilen Anfang und
steuert die Abspielposition über den tatsächlichen Pendelbogen. Ein allgemeiner
Fallback darf diesen ausgewählten Clip außerdem nicht mehr durch Idle ersetzen.
Die Armkorrektur erfolgt nach der Rumpfkorrektur und hält eine leichte Beugung.

Die Verbesserungen an Auslaufen, Duckstand, Gleitclip und Kamera aus dem ersten
Durchgang bleiben enthalten; siehe [ANIMATION-POLISH.md](ANIMATION-POLISH.md).

## Modelle ansehen

![Echte Spielgeometrie mit vereinfachtem Licht](city-model-preview.png)

Die Übersicht wird aus denselben Modellfunktionen wie das Spiel berechnet.
Sie verwendet eine CPU-Rasterung mit Tiefenpuffer und vereinfachter Beleuchtung.
Sie zeigt keine Spielsituation, keine GPU-Leistung und keine gerenderten
Spider-Man-Animationen. Maßstab je Kachel angepasst.

`city-visuals.js` erzeugt native Three.js-Geometrie. Es werden keine zusätzlichen
Texturen, CDN-Bibliotheken oder KI-Videoclips zur Laufzeit geladen. Für diesen
Durchgang wurden keine weiteren Higgsfield-Generierungen beauftragt.

## Prüfung

```sh
node --check game.js
node --check city-visuals.js
node --test tools/test-animation-polish.cjs tools/test-city-polish.cjs
git diff --check
```

27 gezielte Tests bestanden. Sie laden die betroffenen Originalfunktionen mit
Three.js r128 und für Skelettprüfungen das vorhandene Heldenrig mit echten
Animationsspuren. Die neuen Prüfungen erfassen Gebäudegrenzen, freie
Fahrgastzellen, Sitz-/Blaulichtreferenzen, Radbewegung, Türöffnungen, Rotorachsen,
gemeinsame Hautmaterialien und wiederholte Wechsel der Gegnerausrüstung.

Die Schwungsequenz läuft jeweils 30 simulierte Sekunden bei 30, 60 und 120 Hz,
einschließlich Seitenwechseln und Wechseln zwischen einer und zwei Händen.
Quaternionen bleiben normiert; lokale Gelenkänderungen bleiben innerhalb der
zeitabhängigen Grenze. Das sind Skelettmessungen, keine gemessenen Spiel-FPS.

Ein 18 × 90 × 22 m großes Hochhaus enthält je nach Variante 3.294–3.566 Dreiecke
in zwei Meshes. Im Größentest mit bis zu 132 m Höhe bleiben alle Varianten unter
6.500 Dreiecken. Fenster werden zusammengefasst, nicht einzeln gezeichnet.
Fahrzeugteile und Zubehör verwenden wiederverwendete Geometrien. Eine Messung
der gesamten Stadt auf einer GPU steht aus.

Modellübersicht reproduzieren (Python 3, Pillow und NumPy erforderlich):

```sh
node tools/render-city-preview.cjs
```

## Im laufenden Spiel vergleichen

1. Zwischen mehreren Hochhäusern schwingen, auf Dächern landen und wieder abspringen.
2. Wiederholt das Netz wechseln und beim Schwingen den zweiten Griff einsetzen.
3. Von Schwung zu Gleiten, Landung, Laufen und Wandklettern wechseln.
4. Autos, Lkw und Busse beim Fahren, Abbiegen und Anhalten beobachten.
5. Helikopter im Flug ansehen; U-Bahn-Türen öffnen lassen, einsteigen und mitfahren.
6. Zivilisten und vorhandene Gegnerrollen auch während ihrer Animationen ansehen.

Zum Vergleich der Stadtmodelle `?classicVisuals=1` an die Spieladresse hängen.
Diese Option schaltet die neuen Stadt-/Figurenoptiken aus; die Animations- und
Kamerafixes werden dadurch nicht zurückgesetzt.

Der hier verfügbare Browser konnte keinen WebGL-Kontext erzeugen. Vollständiger
Spieltest, Skinning-/Texturvergleich, FPS und der menschliche Act-1-Durchlauf
bleiben deshalb offen. Die 27 Tests ersetzen Claudes Kampagnenregression und
Human-Play-Gate nicht. Missionen, Save-System, Checkpoints, Progression,
Gegner-KI, Bosswerte, Police/EMS und World Hygiene werden nicht umgebaut.
Act 2 wird nicht begonnen.

Die Änderungen liegen im separaten Testbranch von PR #1. Der normale
GitHub-Pages-Spiellink erhält sie erst nach Übernahme in den Spielbranch.
