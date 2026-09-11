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

**Stand:** offen.

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
Orten.

**Stand:** offen.

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
