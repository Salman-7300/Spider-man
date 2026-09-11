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

**Stand:** offen.

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
