# Teil 25: Architektur von game.js — Befund, nicht Meinung

Auftrag war, die Architektur zu **beurteilen**. Also wurde gemessen, bevor
geurteilt wurde. Jede Zahl unten ist mit einem Befehl nachrechenbar; die
Befehle stehen dabei. Geaendert wurde an dieser Stelle nichts: Phase 13 sagt
"keine Reparatur ohne Reproduktion oder messbaren Befund", und ein Umbau der
Dateistruktur waere die groesste denkbare Aenderung ohne einen einzigen
gemessenen Fehler als Anlass.

---

## 1. Die Zahlen

    wc -lc game.js city-visuals.js menu.js index.html

| Datei           | Zeilen | Bytes     |
|-----------------|--------|-----------|
| game.js         | 32.623 | 1.566.559 |
| city-visuals.js |    974 |    57.838 |
| menu.js         |     65 |     3.152 |
| index.html      |    544 |    33.317 |

Zeilenarten in game.js (Blockkommentare mitgezaehlt, weil die Datei fast nur
`/* ... */` benutzt):

| Art         | Zeilen |
|-------------|--------|
| Code        | 21.501 |
| Kommentar   | 10.165 |
| leer        |    957 |

**32,1 % der Datei ist Kommentar.** Das ist fuer Spielcode sehr viel und in
diesem Fall ein Vorteil, kein Ballast — siehe Abschnitt 2.

Struktur (**Stand der Messung, also VOR den Eingriffen aus Abschnitt 8** —
danach sind es 93 Abschnitte und 635 Funktionen auf oberster Ebene):

| Merkmal                                  | Zahl |
|------------------------------------------|------|
| Abschnitts-Ueberschriften `/* === ... */` |   92 |
| Funktionen auf oberster Ebene             |  634 |
| `const` auf oberster Ebene                |  538 |
| `let` auf oberster Ebene                  |  128 |
| davon ALL_CAPS-Stellschrauben             |   47 |
| echte veraenderliche globale Zustaende     |   81 |
| Vorkommen von `player.`                   | 2.213 |
| Funktionen, die `player.` anfassen        |  169 |

Auslieferung vor dem ersten Bild: `lib/three.min.js` 603 kB + `game.js`
1.567 kB + `city-visuals.js` 58 kB + `index.html` 33 kB = **2,26 MB
JavaScript und HTML**, unkomprimiert, ohne Bauschritt, ohne Modul-Lader.

---

## 2. Was gut ist (und warum es so bleiben soll)

**a) Kein Bauschritt.** `index.html` laedt vier Dateien per `<script>`. Wer
das Repo klont, kann sofort spielen; `github.io` liefert es ohne Pipeline
aus. Es gibt keinen Zustand "der Build ist kaputt". Das ist fuer ein
Ein-Personen-Projekt mehr wert als jede Modulstruktur.

**b) Die 92 Abschnitte sind echte Kapitel.** Median 146 Zeilen. Man findet
den U-Bahn-Code, indem man nach `/* === U-Bahn` sucht — nicht, indem man ein
Abhaengigkeitsdiagramm liest.

**c) Die Kommentare halten fest, WARUM und WAS GEMESSEN wurde.** Beispiel
aus dem groessten Abschnitt:

    punch3   Schlag liegt bei 57-80 % des Clips, gezeigt wurden 0-42 %
             -> der vierte Schlag der Kombo zeigte NUR das Ausholen

Das ist kein Kommentar, das ist ein Messprotokoll an der Stelle, an der die
Zahl wirkt. Solche Kommentare haben in dieser Phase mehrfach verhindert,
dass eine bereits widerlegte Idee ein zweites Mal eingebaut wird. Sie sind
der Grund, warum 32 % Kommentaranteil hier richtig ist.

**d) Die `__dbg`-Schnittstelle.** Zeilen 31.782–32.621, **840 Zeilen,
42 kB, 2,7 % der Datei.** Sie liegt hinter

    if (window.__WEBHERO_TEST__ === true) {

Ohne dieses Fenster waere die gesamte Phase 13 nicht messbar gewesen: 15
Pruefskripte unter `tools/pruef/` fahren damit die echte Spielschleife an,
frieren sie ein, simulieren einzelne Zeitschritte und lesen Zustaende aus.
Das ist die wertvollste Einzelentscheidung in der Architektur dieser Datei.

**e) Die veraenderlichen Globalen sind ruhiger als befuerchtet.** Gezaehlte
Schreibstellen je Global — der schlimmste Fall ist `camShake` mit 25, danach
faellt es steil ab: `swingHeld` 8, `stufe` 7, `missionCd` 7, `camYaw` 7,
`bossAktiv` 6, alles Weitere 5 oder weniger. 81 globale Zustaende klingen
nach Chaos, sind aber ueberwiegend an einer Stelle gesetzt und sonst nur
gelesen. **Das ist kein Problem, das repariert werden muss.**

---

## 3. Was wirklich fragil ist

Drei Befunde, nach Schwere:

### 3.1 Eine Funktion mit 3.256 Zeilen

Laengste Funktionen auf oberster Ebene:

| Zeilen | ab Zeile | Funktion             |
|--------|----------|----------------------|
| 3.256  |  7.099   | `makeGlbVisual`      |
| 1.497  | 15.175   | `updatePlayer`       |
| 1.215  | 25.176   | `updateEnemies`      |
|   945  | 31.678   | `simuliere`          |
|   776  | 22.796   | `updateCivilians`    |
|   751  | 17.049   | `updateHeroVisual`   |

`makeGlbVisual` enthaelt 33 innere Funktionen. Das ist keine Funktion mehr,
das ist ein Modul ohne Modulgrenze.

### 3.2 Ein Abschnittstitel, der seit langem luegt

Der groesste Abschnitt hiess **"Kernfenster der Bewegungsdateien"**
(Zeile 6.058, 4.500 Zeilen). *(Mit S1 in Abschnitt 8 behoben; der Befund
steht hier unveraendert, weil er der Anlass war.)* Die ersten rund 100 Zeilen halten das auch:
Angriffsfenster, Blenddauern, Wandgriff-Masse. Danach steht dort etwas voellig
anderes:

    Zeile 6.438  Netz-Kostuem: faerbt ein Menschmodell zum Helden um
    Zeile 6.539  Symbiontentextur aus der Anzugtextur
    Zeile 6.776  Anzugkoerper
    Zeile 7.099  makeGlbVisual  (3.256 Zeilen)
    Zeile 10.399 Kleidung einfaerben
    Zeile 10.432 Gegner: eigene Farbgebung je Rolle

Von 4.500 Zeilen unter der Ueberschrift "Bewegungsdateien" gehoeren knapp
100 zum Thema. Der Rest ist Kostuem-, Textur- und Modellbau. **Wer nach dem
Anzugcode sucht, findet ihn nicht, weil der Wegweiser falsch beschriftet
ist.** Das ist der billigste und wirksamste Eingriff, der hier moeglich ist.

### 3.3 Tests koennen nur pruefen, was sich herausschneiden laesst

Die Testlage: 139 Tests in 9 Dateien, alle gruen (`cd tools && node --test`).
Sie zerfallen in drei Klassen:

1. **Echte Ausfuehrung.** `tools/city-test-runtime.cjs` und
   `tools/animation-test-runtime.cjs` schneiden Fabrikfunktionen per
   Textmarke aus `game.js` heraus und fuehren sie mit echtem Three.js r128
   ohne Renderer aus. Gleiches gilt fuer `test-verkehr.cjs`, das
   `querverkehrWarten` herausloest und mit erfundenen Autos durchrechnet.
   Das sind Verhaltenstests.

2. **Konstante gegen Aussenwelt.** `test-stadtmoebel.cjs` liest Masse wie
   `AMPEL_HOCH` per Regex aus `game.js` und vergleicht sie mit den
   **gemessenen Eckpunkten von `assets/stadtmoebel.glb`**. Der Regex ist nur
   das Lesegeraet; gepruefte Wahrheit ist das Modell. Auch das sind echte
   Tests.

3. **Behauptungen ueber den Quelltext.** Genau **10 Zusicherungen** der Form
   "dieser Text steht in game.js". **Neun davon stehen in
   `tools/test-bruecke.cjs` — die habe ich in dieser Phase selbst
   geschrieben.** Sie sichern nichts ab: benennt jemand `zh` um, schlagen sie
   fehl, ohne dass etwas kaputt ist; faehrt ein Auto durch das Gelaender,
   bleiben sie gruen.

Der strukturelle Grund dafuer ist wichtiger als die Schuldfrage: **Was in
einer eigenen Funktion steht, bekommt einen echten Test. Was in
`updatePlayer` oder `autoKreuzung` eingewachsen ist, bekommt nur eine
Textbehauptung.** Genau deshalb wurde in Teil 17 `querverkehrWarten`
herausgeloest — und genau deshalb konnte die Brueckenhoehe der Autos nur als
Text zugesichert werden. Die Testqualitaet haengt direkt an der
Funktionsgroesse.

Zweiter Punkt zur Kopplung der Tests: `city-test-runtime.cjs` schneidet mit

    between('const SKINS =', 'function baueDekoMesh(')

Wird `baueDekoMesh` umbenannt, faellt nicht ein Test mit klarer Meldung um,
sondern der Testlauf stirbt mit "Factory not found". Das ist die direkte
Folge davon, dass es keine Exporte gibt.

---

## 4. `player` ist die eigentliche Kopplung

2.213 Vorkommen von `player.`, verteilt auf **169 der 634 Funktionen** —
gut jede vierte Funktion in der Datei fasst den Spieler an. Das ist die
groesste Kopplungszahl im Projekt, groesser als alles bei den Globalen.

Das ist zu erwarten: es ist ein Spiel mit genau einer Spielfigur. Es heisst
aber auch, dass jede Aenderung an einem `player`-Feld potenziell 169
Funktionen betrifft und dass ein "einfaches" Herausziehen der
Spielerbewegung in eine eigene Datei kein Herausziehen waere, sondern das
Erfinden einer Schnittstelle, die es heute nicht gibt.

---

## 5. Was NICHT getan werden soll

**Kein Aufteilen von game.js in Module.** Gruende, in dieser Reihenfolge:

1. Der Auftrag verbietet den grossen Umbau ausdruecklich ("kein Big-Bang-
   Refactor von game.js"). Das allein reicht.
2. Es gibt kein Modulsystem und keinen Bauschritt. Ein Aufteilen erzwingt
   entweder `type="module"` (und damit andere Ladereihenfolge, anderes
   Fehlerverhalten, CORS-Probleme beim Oeffnen per `file://`) oder ein
   Bauwerkzeug. Beides tauscht ein Problem, das niemand gemeldet hat, gegen
   eine neue Klasse von Problemen ein.
3. Die Tests schneiden per Textmarke. Jede Dateigrenze bricht sie.
4. **Es gibt keinen gemessenen Fehler, der daraus folgt.** Kein Befund aus
   Teil 3–23 lautet "zu grosse Datei". Die Fehler waren Geometrie,
   Zeitfenster, Schwellwerte und dreimal mein eigenes Messgeraet.

**Kein Auslagern von `__dbg`** — mit einer Korrektur an meiner eigenen
frueheren Einschaetzung: Ich hatte den Block als Laufzeitkosten im Kopf. Er
ist es nicht. Er steht hinter `if (window.__WEBHERO_TEST__ === true)` und
wird im normalen Spiel **nie ausgefuehrt**. Auslagern wuerde 42 kB Ladezeit
sparen (2,7 %) und dafuer den Pruefstand zerbrechlicher machen. Das Verhaeltnis
stimmt nicht.

---

## 6. Was sich lohnt — klein, messbar, einzeln

Nach Nutzen je Risiko geordnet. Keiner dieser Schritte aendert Spielverhalten.
**S1, S3 und S4 sind mit diesem Stand erledigt, S2 angefangen** — was genau
getan wurde, steht in Abschnitt 8.

**S1 — Abschnitt 6.058 richtig beschriften und teilen.** [erledigt]
Aus einer falsch benannten 4.500-Zeilen-Halde werden zwei ehrliche
Abschnitte: "Kernfenster der Bewegungsdateien" (ca. 380 Zeilen) und
"Heldenmodell, Anzug und Einfaerbung" (ca. 4.120 Zeilen). Reine
Kommentaraenderung, kein Code wird verschoben.

**S2 — `makeGlbVisual` an seinen 33 inneren Funktionen aufbrechen.**
[nicht angefangen; stellvertretend wurde `ohnePylonen` geholt]
Nicht auf einmal. Die inneren Funktionen, die nichts aus dem Abschluss
brauchen, koennen einzeln auf die oberste Ebene wandern. Jede einzelne
Verschiebung ist fuer sich pruefbar. Nutzen: was oben steht, kann getestet
werden — siehe 3.3.

**S3 — Die neun Textbehauptungen in `test-bruecke.cjs` ersetzen.** [erledigt]

**S4 — Textmarken der Testlaufzeit absichern.** [erledigt]

Nicht auf der Liste, bewusst: Umbenennen von Globalen, Einfuehren einer
Zustandsklasse fuer `player`, Aufteilen der Datei, Minifizieren. Alles
Aufwand ohne gemessenen Anlass.

---

## 7. Urteil

Die Architektur ist **fuer das, was dieses Projekt ist, angemessen**: eine
einzelne, dicht kommentierte Datei ohne Bauschritt, mit 92 benannten
Kapiteln und einem ausgebauten Pruefzugang, die seit Monaten
aenderungsfaehig geblieben ist — 23 Pruefteile dieser Phase haben Fehler
gefunden, die alle lokal behebbar waren. Keiner der gefundenen Fehler ging
auf die Dateigroesse zurueck.

Fragil ist sie an drei konkreten, benennbaren Stellen: einer 3.256-Zeilen-
Funktion, einem Abschnittstitel, der sein Kapitel nicht mehr beschreibt, und
der Tatsache, dass grosse Funktionen nur noch per Textbehauptung "geprueft"
werden koennen. Diese drei Stellen lassen sich einzeln und ohne Risiko
angehen. Der grosse Umbau nicht.


---

## 8. Was an diesem Stand tatsaechlich geaendert wurde

Die Beurteilung blieb nicht bei der Beurteilung. Vier Eingriffe, alle ohne
Spielverhalten zu aendern:

### 8.1 Neue Abschnittsueberschrift (S1)

Vor `/* ---- Netz-Kostuem ...` steht jetzt
`/* === Heldenmodell, Anzug und Einfaerbung === */`. Damit hat game.js **93
statt 92** Abschnitte, und der groesste ist 4.120 statt 4.500 Zeilen lang.
Der Kostuemcode ist ueber die Abschnittssuche auffindbar.

### 8.2 `ohnePylonen` auf die oberste Ebene (S2, ein Fall)

`PYL_X`, `PYL_TOP`, `PYL_LUECKE` und `ohnePylonen` lagen in
`buildRiverAndBridge` (347 Zeilen) und waren damit fuer Tests unerreichbar.
Sie stehen jetzt direkt davor auf oberster Ebene. **Nur deshalb** kann 8.3
die Gelaenderzerlegung wirklich durchrechnen.

Nachweis, dass sich nichts geaendert hat: alle Kollider im Brueckenbereich
(x 170..345, z -40..-10) und das Hoehenprofil `groundY` in 10-cm-Schritten
ueber Fahrbahn und Gehweg, vorher und nachher aufgezeichnet —
**22 Kollider, Hoehensumme 1248,0000, Zeile fuer Zeile identisch.**

Zum Bildvergleich gehoert eine ehrliche Einschraenkung: drei Aufnahmen
(Pylon, Deck, Gehweg) unterschieden sich vorher/nachher in 3,3 bis 6,6 % der
Farbkanaele. Eine **Kontrollmessung derselben Fassung zweimal hintereinander**
ergab 3,1 bis 5,2 %. Verkehr, Passanten und Ladezeitpunkt rauschen also in
derselben Groessenordnung — der Pixelvergleich kann hier **nichts beweisen**,
weder in die eine noch in die andere Richtung. Die Aussage stuetzt sich auf
die Kollider und das Hoehenprofil; die Bilder wurden zusaetzlich angesehen
und zeigen den Handlauf sauber am Pylonbein enden.

### 8.3 `tools/test-bruecke.cjs` prueft jetzt Verhalten (S3)

Von **10 Quelltext-Behauptungen im ganzen Testbestand sind 9 verschwunden**
(uebrig: eine in `test-video-feedback.cjs`). An ihre Stelle traten Aufrufe
der echten Funktionen aus game.js:

| frueher behauptet                         | jetzt gerechnet                                                         |
|-------------------------------------------|-------------------------------------------------------------------------|
| `for (... of ohnePylonen(BR_X0, BR_X1))` steht da | `ohnePylonen` liefert 3 Stuecke, keines beruehrt ein 3 m breites Pylonbein, Gesamtlaenge = Spannweite minus beide Luecken |
| `const bruecke = autoAufBruecke(car)` steht da | `autoAufBruecke` und `setzeAutoGrenzen` auf zwei echten Wagen; Brueckenwagen bekommt `sMax = 339`, Stadtwagen `178`; die Bedingung `drin` wird als Ausdruck aus game.js herausgeschnitten und mit x = 257,5 gerechnet |
| `const zh = onBridge(...) ? bridgeY(...)` steht da | `onBridge`/`bridgeY` liefern auf der Deckmitte 0,3 m, am Rampenfuss 0, in der Stadt 0, und die Rampe steigt ueber 120 Stuetzstellen monoton |
| `t.repeat.set(Math.max(1, Math.round(laenge / 4))` steht da | `brGehTextur` wird mit Stellvertretern fuer Textur und Material aufgerufen; `repeat.x` muss `Math.round(153 / 4) = 38` sein |

Gegenprobe, damit das nicht nur behauptet ist — drei Sabotagen in game.js,
jede einzeln:

| Sabotage                                        | Ergebnis                                       |
|-------------------------------------------------|------------------------------------------------|
| Brueckenausnahme aus `drin` entfernt             | Test 4 faellt (nur Test 4)                     |
| `PYL_LUECKE` von 1,9 auf 0,5 m                   | Test 3 faellt (nur Test 3)                     |
| `t.repeat.set(1, 1)` statt der Laengenrechnung   | Test 6 faellt (nur Test 6)                     |
| `zh` in `zHoehe` umbenannt (reine Umbenennung)   | **alle 7 gruen** — frueher waeren 3 gefallen   |

Die letzte Zeile ist der eigentliche Gewinn: Der Test bricht bei
Verhaltensaenderungen und schweigt bei Umbenennungen. Vorher war es umgekehrt
herum falsch.

Zwei Fehler in der neuen Testfassung fielen beim ersten Lauf auf und waren
beide meine, nicht die des Spiels: der "Stadtwagen" lag mit `lane = -25`
genau auf `BRIDGE_Z` und galt deshalb als Brueckenwagen, und die Rampen-
schleife mit `x += 0.05` verfehlte durch Gleitkomma-Summierung ihr Ende
(0,298 statt 0,300).

### 8.4 Textmarken der Testlaufzeit (S4)

`between()` in `city-test-runtime.cjs` und `animation-test-runtime.cjs` sagte
bisher nur "Factory not found: <Anfang>", auch wenn in Wahrheit die
**End**-Marke fehlte. Jetzt werden beide Faelle getrennt gemeldet, mit der
fehlenden Marke und der Zeilennummer der gefundenen:

    Textmarke nicht in game.js gefunden (Ende): 'function baueDekoMesh('
    - der Anfang 'const SKINS =' steht bei Zeile 2318.

Der Fehlerpfad wurde mit einer kuenstlich umbenannten Marke ausgeloest, nicht
nur hingeschrieben.

**Testbestand nach allen vier Eingriffen: 139 Tests, 139 gruen.**
