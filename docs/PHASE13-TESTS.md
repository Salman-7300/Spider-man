# Phase 13 — Tests A bis F

Die sechs abschliessenden Tests aus dem Auftrag, hier festgehalten, damit sie
nicht im Gespraechsverlauf verloren gehen. Ergebnisse werden je Test unter
"Stand" nachgetragen.

## Test A — 30 Minuten aktives Spiel
Kein Kreis-Bot. Ein Spieler, der wirklich schwingt, klettert, laeuft,
Verbrechen erledigt, Aktivitaeten besucht, U-Bahn faehrt, kaempft und
Polizei/Rettung erlebt.

**Stand:** offen.

## Test B — 60 Minuten Weltbelastung
Gezaehlt werden ueber die ganze Stunde: Szenenobjekte, Gegner, Bosse,
Zivilisten, Autos, Ereignisse, Einsatzkraefte, Lichter, temporaere
Verweise, Fehler. Bedingung: **kein Wachstumstrend**.

Pruefstand: `tools/pruef/welt-stunde.js`. 60 Minuten Spielzeit am Stueck,
**120 Messpunkte im Abstand von 30 s**. Der Spieler wandert ueber zehn
Orte der Karte - stehenbleiben laesst die halbe Welt einschlafen und
beweist nichts. Je Reihe wird eine Regressionsgerade durch alle 120
Punkte gelegt; ein Trend zaehlt erst ab 5 % des Mittelwerts und
mindestens 2 Stueck.

**Stand: kein Wachstumstrend.**

| Reihe | Anfang | Ende | Mittel | Hoechst | je Stunde |
|---|---|---|---|---|---|
| Szenenobjekte | 10.121 | 10.679 | 10.721,6 | 11.604 | −194,9 |
| Lichter | 3 | 3 | 3,0 | 3 | 0 |
| Gegner | 10 | 14 | 14,3 | 20 | −1,7 |
| Bosse | 0 | 0 | 0,0 | 0 | 0 |
| Zivilisten | 55 | 55 | 55,0 | 55 | 0 |
| Autos | 26 | 26 | 26,1 | 28 | −0,4 |
| Einsaetze | 0 | 0 | 0,1 | 2 | −0,4 |
| Einsatzwagen | 0 | 0 | 0,1 | 2 | −0,4 |
| Aktivitaeten | 0 | 0 | 0,4 | 1 | −0,1 |
| Vogelschwaerme | 0 | 4 | 1,6 | 4 | −0,5 |
| Kollider | 1.932 | 1.932 | 1.932,0 | 1.932 | 0 |
| **Lecks** | 0 | 0 | **0,0** | **0** | 0 |
| **Fehler** | 0 | 0 | **0,0** | **0** | 0 |

Wegsuche ueber die Stunde: 1.007 Suchen, 0,116 ms je Suche.
Hygiene: 1 vorgemerkt, 1 abgebaut, 0 zurueckgeholt, 0 Blockaden.

**Zwei Einschraenkungen, die dazugehoeren.** Erstens war die Welt in
diesem Lauf **ruhig**: null Bosse, hoechstens zwei Einsaetze, hoechstens
eine Aktivitaet gleichzeitig. Ein Lecktest unter geringer Last ist
schwaecher, als die Tabelle aussehen laesst - die belebte Seite deckt
Test A ab. Zweitens stand die Reihe "Ereignisse" die ganze Stunde auf
`undefined`, und das war ein echter Fund, siehe unten.

### Gefunden: `evStand` war im Testfenster zweimal vergeben

`window.__dbg` ist ein einziges Objektliteral mit 327 Eintraegen. Zwei
Eintraege hiessen `evStand`: einer liefert die **Liste** der laufenden
Ereignisse, einer eine **Zusammenfassung** `{bekannt, still}`. JavaScript
nimmt bei doppelten Schluesseln stillschweigend den letzten - die Liste
war also seit ihrer Entstehung unerreichbar.

Das ist dieselbe Falle, die im Code schon einmal dokumentiert ist
(`ubahnen` gab es ebenfalls doppelt). Deshalb nicht nur der Einzelfall
behoben - die Zusammenfassung heisst jetzt `evUebersicht` -, sondern ein
Waechter dazu: `tools/test-testfenster.cjs` schneidet den `__dbg`-Block
ueber die Klammerbilanz heraus, sammelt alle Schluessel der obersten
Ebene ein und schlaegt bei jedem doppelten an.

Der Waechter hat beim ersten Lauf gleich noch eine Doppelung gefunden,
und die war **meine**: `hausStellen` gab es schon als `hausStellen:
HAUS_STELLEN` in einer Sammelzeile, und ich hatte in Test E eine zweite
Fassung als Funktion daneben gestellt. Entfernt.

Der Waechter selbst brauchte drei Anlaeufe: zeilenweise fand er 274 von
327 Schluesseln (mehrere Eintraege teilen sich eine Zeile), mit
Klammerzaehlung 136 (ein `(` beendet einen Methodennamen UND oeffnet die
Argumentliste - die Reihenfolge der Pruefungen entschied), und ohne
Ueberspringen des Wertes nach einem `:` waren es 357 (er zaehlte
`HAUS_STELLEN` als eigenen Schluessel). Gegenprobe: ein kuenstlich
eingebauter zweiter `fogFern` wird gefunden und beim Namen genannt.

## Test C — Uebergangsmatrix der Spielfigur
Mindestens diese 20 Uebergaenge:

    idle -> walk          walk -> run           run -> sprint
    run -> jump           jump -> fall          fall -> glide
    glide -> swing        swing -> release      release -> fall
    fall -> land          land -> run           run -> wallrun
    wallrun -> jump       air -> wall attach    wall crawl -> corner
    wall crawl -> ledge   ledge -> roof         perch -> jump
    combat -> air         zip -> air

Pruefstand: `tools/pruef/uebergangsmatrix.js`. Jeder Fall wird EINZELN
aufgebaut (Verkehr, Passanten und Gegner werden vorher geleert), dann wird
eine Spur je Bild mitgeschrieben und daraus gemessen: kam der Zielzustand
zustande, wie lange dauerte es, gab es einen Ortssprung (mehr Weg in einem
Bild, als die Geschwindigkeit hergibt) oder eine Drehung ueber 60 Grad, und
welche Bewegungsdatei lief vorher und nachher.

**Stand: 20 von 20 erreicht.** Groesster Ortssprung ueber alle Faelle
0,11 m, groesste Drehung 21 Grad - beides unauffaellig. Gangtempo
gemessen: Gehen 2,80 m/s, Laufen 6,98 m/s, Sprint 10,99 m/s.

Beim ersten Durchlauf waren es 14 von 20. Davon waren **drei ein Fehler im
Pruefstand** (der Sprung haengt am Tastendruck: keydown 'Space' ruft
tryJump() direkt auf - `keys['Space']` zu setzen springt nie; richtig ist
`d.tippeSprung()`), **zwei eine unvollstaendige Lage** (der Aufwaertshaken
braucht Stufe 1 und einen Gegner in 2,8 m; der Netz-Zug braucht eine
Fassade im Kegel) - und **einer ein echter Fehler im Spiel**, siehe unten.

### Gefunden: der Wandsprung verliess die Wand nicht

Mit gehaltenem W - also genau so, wie man die Wand hinauflaeuft - kam der
Wandsprung **nie** in die Luft:

| Eingabe beim Sprung        | in der Luft nach | waagerechtes Hoechsttempo | Endzustand |
|----------------------------|------------------|---------------------------|------------|
| W weiter gehalten          | nie              | **0,00 m/s**              | climb, y 17,9 |
| W beim Sprung losgelassen  | 1 Bild           | 14,73 m/s                 | air, y 10,9  |

Ursache: `tryJump` setzt beim Wandsprung korrekt `state = 'air'` und
7,5 m/s Abstossen - aber der Anklebe-Block sieht im selben Bild "Eingabe
zeigt in die Wand", klebt wieder an und setzt `vel` auf null. Der Sprung
war damit restlos geloescht; die Figur fuhr die Fassade weiter hoch.

Behoben mit `WAND_SPERRE = 0.22` s: nach einem Wandsprung klebt die Figur
nicht mehr von selbst an, die ausdrueckliche Halte-Taste wirkt weiter
sofort. Danach: in der Luft nach 1 Bild, Abstossen messbar (x wandert von
-157,69 auf -171,05). Kein Rueckschritt in Teil 4 und 5 (Wandkriechen
0 Meldungen, Wandlauf 0 von 14 Anlaeufen fehlerhaft).

## Test D — NPC-Hindernisse
Mindestens 100 Zivilistenrouten und 100 Gegnerverfolgungen an schwierigen
Orten. Der Pruefstand ist `tools/pruef/npc-wege.js`, ein einzelner Fall
laesst sich mit `tools/pruef/npc-einzelfall.js` (Zivilist) beziehungsweise
`tools/pruef/gegner-einzelfall.js` (Gegner) nachfahren.

### Die sieben Fragen einzeln, nicht als eine Zahl
Lauf 6 (Werkszustand vor jedem Szenario zurueckgesetzt, 0 Ruecksetzfehler
in 100 Szenarien):

| | Frage | Ergebnis |
|---|---|---|
| A | jemand IN einem Gebaeude | 0 Faelle |
| B | jemand unter der Bodenflaeche | 0 Faelle |
| C | dauerhaft haengengeblieben | 13 Faelle |
| D | Zivilist erreicht sein Ziel | 78/100 |
| E | alarmierter Gegner erreicht Spieler | 1/90 |
| F | Ampelstopps (kein Fehler) | 53 929 Bilder |
| G | Bilder im Zug (kein Fehler) | 0 Bilder |

A und B sind die beiden Fragen, bei denen ein Treffer ein echter Fehler
waere. Beide sind null.

### Frage E: erst messen, dann urteilen
1 von 90 sieht nach einem kaputten Verfolgungsverhalten aus. Die Regel
aus dem Auftrag lautet: kein Eingriff ins Spiel ohne Reproduktion. Also
wurden fuenf gemeldete Faelle einzeln nachgefahren
(`tools/pruef/gegner-einzelfall.js`, je eine frische Seite):

| Fall | Luftlinie | im Massentest | einzeln nachgefahren |
|---|---|---|---|
| Uferpromenade 186,5/−92 → 186,5/−78 | 14 m | nicht erreicht | erreicht nach 1,8 s, Umweg 0,83 |
| U-Bahn-Abgang −166/13,2 → −134/36,8 | 39,8 m | nicht erreicht | erreicht nach 8,0 s, Umweg 1,26 |
| anderes Ufer 342,5/−134,5 → 373,4/−165,4 | 43,7 m | nicht erreicht | erreicht nach 27,2 s, Umweg 1,50 |
| Kreuzungsecke −67/117 → −82,2/133 | 22,1 m | nicht erreicht | erreicht nach 4,0 s, Umweg 0,90 |
| Bruecke 334,75/−45,05 → 327/−17,4 | 28,7 m | nicht erreicht | **auch einzeln nicht erreicht** |

Vier von fuenf sind damit ein TESTFEHLER: der Massentest laesst hundert
Szenarien in derselben Seite nacheinander laufen, und was dabei liegen
bleibt, verfaelscht die spaeteren. Der fuenfte reproduziert — und der
fuehrt zu einem echten Befund.

### Gefunden: das Gehnetz reichte weiter als das erlaubte Gebiet
Der Brueckenfall blieb mit 2878 Nachalarmierungen in 90 Sekunden haengen:
der Gegner wechselte in nahezu jedem Bild von `chase` zurueck nach
`patrol`. Ursache ist `haltenImGebiet` (game.js) — eine Leine, die
verhindern soll, dass Gangs auf die nackte Grundflaeche ausserhalb des
Rasters ziehen. Sie erlaubte zwei Baender: `x ≤ 189` und `x ≥ 333`.
Dazwischen liegt der Fluss — **und die Bruecke**.

Gemessen mit `d.imGebiet` gegen die Knotenliste des Gehnetzes:

    728 Knoten, davon ausserhalb des erlaubten Gebiets: 29
    21 "bruecke", 6 "ufer", 2 "prom"

Das Gehnetz baut also seit Phase 9 einen Brueckengehweg mit 21 Knoten und
30 Kanten, den die Leine derselben Figur in jedem Bild wieder wegnimmt.
Wer dorthin geroutet wurde, wurde zurueckgeschoben und verlor sein Ziel
(`c.waypoint = null`, beim Gegner zusaetzlich `state = 'patrol'`). Zu
Fuss kam so nie jemand ueber den Fluss — weder Passant noch Ganove.

Das ist kein Testartefakt: die Leine steht in `updateCivilians`
(Zeile 23617) und `updateEnemies` (Zeile 26340), also im normalen
Spielablauf.

**Geaendert** (game.js, `imGebiet` / `haltenImGebiet`):
* Das Brueckendeck ist ausdruecklich erlaubt, samt beider Brueckenkoepfe
  (`BRIDGE_HW + 6`, weil die Umgehungspunkte am Kopf 12,5 bis 16 m neben
  der Achse liegen). Das Wasser bleibt gesperrt — darueber entscheidet
  weiterhin `inWater`, das ausserhalb der Bruecke den ganzen Fluss haelt.
* Die z-Grenze geht von `STADT_RAND + 6` (181) auf 192, damit die
  Promenaden- und Uferknoten bis |z| = 190 drin liegen.

Nachgemessen mit demselben Pruefstand: **0 von 728 Knoten ausserhalb.**

Der Zivilistenweg ueber die Bruecke (Knoten 704 → 613), der im Massentest
nach 84,6 s nicht angekommen war, laeuft danach bis kurz vors Ziel durch
(Bild 480: 325,0/−18,6 bei Wegpunkt 3 von 4).

### Was der Brueckenfall NICHT loest
Der Gegner kommt mit der Aenderung bis an den oestlichen Brueckenkopf,
aber nicht auf den Gehweg der Gegenseite: er verfolgt in Luftlinie mit
3,6 m Vorausschau (`AUSWEICH_SICHT`) und laeuft damit am Gelaender
entlang statt um es herum (Umweg 31,6). Das Gehnetz benutzt er nicht.
Das ist eine bekannte Grenze der Verfolgung an langen Hindernissen und
keine Folge dieser Aenderung — vorher kam er ueberhaupt nicht bis dahin.
Nicht repariert, weil dafuer die Verfolgung auf das Gehnetz umgestellt
werden muesste: das ist ein neues System und gehoert nicht in eine
Finalisierung. **Offen und hier festgehalten.**

## Test E — Funktionale Freigaengigkeit der Stadt
Alle gesetzten Gegenstaende gegen: Fahrbahn, Zebrastreifen, Treppen,
Aufzug, U-Bahn-Eingang, Brueckenuebergang, Tueren, POI-Anker,
Bewegungspfade.

Pruefstand: `tools/pruef/freigang.js`. Geprueft werden **887 gesetzte
Gegenstaende** (112 Ampeln, 62 Laternen, 63 Beete, 339 Poller, 58 Baenke,
174 Klimageraete, 63 Pflanzkuebel, 16 Kanaldeckel) gegen 325 Flaechen und
**875 Kanten des Gehnetzes**.

**Stand: alle neun Flaechen frei.**

| Flaeche               | Befund |
|-----------------------|--------|
| Fahrbahn              | frei   |
| Zebrastreifen         | frei   |
| U-Bahn-Abgang         | frei   |
| Aufzug                | frei   |
| Brueckenuebergang     | frei   |
| Haustuer (Durchgang)  | frei   |
| Haustuer (Vorfeld)    | frei   |
| POI-Anker             | frei   |
| Bewegungspfade        | frei   |

Bei den Bewegungspfaden wird die Ideallinie 262 mal gestreift (Mittel
0,378 m, groesster Wert 1,55 m) - **daneben bleibt aber ueberall eine
Luecke von mindestens 0,9 m**, also der Breite eines Passanten. Eine
Ampel am Bordstein beruehrt die gedachte Mittellinie; im Weg steht sie
deshalb nicht.

### Vier Fehler im Pruefstand, einer im Spiel

Der erste Durchlauf meldete 79 Befunde. Davon waren vier Gruppen mein
Messgeraet:

1. **41 "auf der Fahrbahn"** - das Strassenraster war unbegrenzt nach
   Osten verlaengert. Es endet aber bei x = 181; dahinter liegen
   Promenade, Fluss und ein eigenes Raster am anderen Ufer. Ausserdem
   waren die meisten Gemeldeten **Klimageraete in 19 bis 30 m Hoehe auf
   Daechern** - eine Flaeche am Boden kann nur blockieren, was am Boden
   steht.
2. **30 "U-Bahn-Abgang"** - der z-Versatz `dz` der Stationen fehlte,
   deshalb wurde jeder Fund doppelt und an der falschen Stelle gemeldet;
   und die Zone war um 1,6 m aufgeblasen, sodass Poller NEBEN dem Abgang
   als Hindernis galten.
3. **3 "POI-Anker"** - ohne Hoehenvergleich. Ein Dach-POI auf 39 m und
   eine Laterne auf der Strasse sind sich nicht im Weg.
4. **"Bewegungspfade frei"** - eine Falschmeldung in die andere Richtung:
   der Kantenschluessel heisst `zu`, ich hatte `ziel` geraten. Es wurden
   **null** Kanten geprueft und trotzdem "frei" gemeldet.

Dazu 16 Kanaldeckel "auf der Fahrbahn" - richtig gemessen, aber dort
gehoeren sie hin; sie liegen flach.

### Gefunden: Ueberwege am Kartenrand ins Nichts

Jede Kreuzung bekommt vier Ueberwege, 8,4 m neben der Kreuzungsmitte. An
der **aeussersten** Rasterlinie gibt es dort aber keine Gegenseite mehr:

| Ort                              | vorher | nachher |
|----------------------------------|--------|---------|
| Streifen auf der Uferpromenade (x 181..186) | 11 | 0 |
| Streifen westlich des Kartenrands (x -186..-181) | 11 | 0 |
| Ueberwegsflaechen ausserhalb jeder Fahrbahn | 32 von 256 | 0 von 224 |

Die Streifen auf der Promenade lagen bei y = 0,025, der Promenadenboden
aber bei 0,25 - sie steckten also unsichtbar im Belag. Schlimmer als die
verschwendete Geometrie war die Wirkung auf `aufZebra()`: das Spiel
unterdrueckt ueber Ueberwegen Bordsteine, und tat das an 32 Stellen, an
denen gar kein Ueberweg ist. Genau daher kamen auch die fuenf Laternen,
die "im Zebrastreifen" zu stehen schienen.

Behoben: am Kartenrand entfaellt der nach aussen zeigende Ueberweg. Im
Bild hat die Uferstrasse jetzt einen statt zwei Ueberwege nebeneinander;
die Kreuzungen im Inneren sind unveraendert.

## Test F — Akt 1
Alle acht Missionen. **Braucht einen Menschen am Steuer** — das kann der
Pruefstand nicht ersetzen und soll es auch nicht.

**Stand:** offen, liegt beim Spieler.

---

## Entscheidungsregel (gilt fuer alle Aenderungen)

    sichtbar besser?
    messbar mindestens nicht schlechter?
    Regression gruen?

Nur wenn alle drei erfuellt sind: behalten.

---

## Nachtrag Teil 12: die beiden offenen Zivilisten-Verhalten

Aus der Liste in Teil 12 waren zwei Punkte in keinem Testfenster
aufgetreten und deshalb nie geprueft worden: **"watch event"** und
**"ride vehicle/train"**. Beide wurden jetzt gezielt ausgeloest.

### ride vehicle/train — funktioniert

Pruefstand: `tools/pruef/zug-mitfahrt.js`. Ein haltender Zug wird
abgewartet, acht Zivilisten werden daneben gestellt, dann wird gemessen,
was beim Einsteigen und auf der Fahrt wirklich passiert.

| Gemessen | Wert |
|---|---|
| eingestiegen und mit Sitzplatz | 8 von 8 |
| Zeit bis zum ersten Sitz | 2,7 s |
| Abstand zum Sitz im Ruhezustand | 0,00 bis 0,63 m |
| Bilder unsichtbar (Spieler im Wagen) | 0 von 2.057 |
| gefahrene Strecke des Zuges | 178 m, Fahrgaeste bleiben auf dem Sitz |

Ein Detail, das beim Messen fast ein Fehlbefund geworden waere: **ohne
den Spieler im Wagen sind 32 % der Bilder "unsichtbar"** — das ist aber
nur die Entfernungsabblendung, nicht ein fehlender Fahrgast. Mit dem
Spieler an Bord sind es null. Ebenso der "groesste Sitzabstand 40 m" aus
dem ersten Durchlauf: der galt fuer weggeblendete Figuren. Sichtbar
bleiben 7 von 2.057 Bildern (0,34 %) mit mehr als 1 m Abstand, direkt
beim Einsteigen, groesster Wert 4,83 m. Im Bild ist davon nichts zu
sehen; **nicht geaendert**, weil es dafuer keinen sichtbaren Anlass gibt.

### watch event — gibt es nicht

Die Rollen, die ein Zivilist bei einem Ereignis annehmen kann, sind im
Code vollstaendig aufzaehlbar:

    opfer   verletzt   taeter   fluechtig   gefasst   boss

Alles **Beteiligte**. Einen Zuschauer gibt es nicht: kein `gehZustand`
fuer Zuschauen, keine Rolle dafuer, keine Stelle, an der ein
Unbeteiligter stehen bleibt und hinsieht. Der Punkt liess sich also
nicht "gezielt ausloesen" — er ist nicht gebaut.

Nicht nachgeruestet, und zwar bewusst: Phase 13 ist eine Pruefphase, und
ein neues Verhalten fuer alle Zivilisten waere ein Feature, kein Befund.
Es steht hier, damit es nicht als geprueft gilt, was nie da war.
