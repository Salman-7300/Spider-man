# Phase 13 — Tests A bis F

Die sechs abschliessenden Tests aus dem Auftrag, hier festgehalten, damit sie
nicht im Gespraechsverlauf verloren gehen. Ergebnisse werden je Test unter
"Stand" nachgetragen.

## Test A — 30 Minuten aktives Spiel
Kein Kreis-Bot. Ein Spieler, der wirklich schwingt, klettert, laeuft,
Verbrechen erledigt, Aktivitaeten besucht, U-Bahn faehrt, kaempft und
Polizei/Rettung erlebt. `tools/pruef/aktivspiel.js`, 108.000 Bilder,
zwoelf Abschnitte nach Drehbuch.

**Stand: alle 26 Punkte der Auftragsliste sind vorgekommen.** Die Zahlen
stehen in `docs/PHASE13-ABSCHLUSS.md`, Abschnitt 22.

Fuenfzehn Zeitreihen mit je 120 Messpunkten, START/ENDE/MIN/MAX und einer
Regressionsgeraden: **kein Wachstumstrend in keiner Bestandsreihe.**
JS-Fehler 0, unter dem Boden 0 Bilder.

### Drei Punkte fehlten - jedes Mal am Pruefstand
* **Netz-Zip:** 0 Bilder. Einzeln nachgeprueft feuert derselbe Aufruf
  zuverlaessig, sobald die Figur Abstand vor der Fassade hat -
  `zipHaltepunkt` tastet einen Kegel ab, der erst bei 4 m beginnt. Wer
  mit gedruecktem W an der Wand klebt, hat nichts mehr darin.
* **Klettern seitlich und runter:** 0 Bilder, weil die Figur EINMAL an
  die Wand gesetzt wurde und nach dem ersten Absturz unten blieb.
* **Kampf und Netzschuss:** 0 in einem von drei Laeufen, weil gerade kein
  Verbrechen lief.

### Gefunden: der Fail-Logger meldete zu 97 Prozent richtige Haltungen
4.001 Meldungen - und 4.001 ist der DECKEL (`POSE_LOG` nimmt 4.000
Eintraege). Die Reihe wuchs also nicht, sie lief voll. Aufgeschluesselt:

    beinZuHoch, Fuss ueber Huefte, Schwelle 0,15 m:
      sturzflug   n=1387   min 0,162   Median 0,743   max 0,744
      wandsprung  n= 124   min 0,194   Median 0,678   max 0,701
      fall        n=  40   min 0,272   Median 0,547   max 0,716

Ein Median beim Fuenffachen der Schwelle, der kaum streut, ist keine
Fehlerverteilung, sondern eine Pose. Nachgesehen im Bild aus der
Spielkamera (`tools/pruef/haltung-bilder.js`): Sturzflug, Wandsprung und
Wandkriechen sehen richtig aus.

Drei Korrekturen **am Logger, keine am Rig**:
* `BEIN_HOCH_CLIPS` - in Sturzflug, Wandsprung, Fall, Front-/Backflip und
  Fallrolle IST das angezogene Knie die Bewegung.
* `WAND_KONTAKT_MAX_KRIECH` 0,95 fuer Kopf und Brust im Kriechen
  (gemessener Hoechstwert 0,878). Die HUEFTE behaelt 0,55 - damit bleibt
  genau die Pruefung scharf, die "Klettern zu weit von der Fassade"
  gefunden hat.
* Die Dachhocke meldet einmal je Hocke statt in jedem Bild. Eine einzige
  lange Hocke hatte 3.948 Eintraege erzeugt.

**Danach 150 Meldungen in 30 Minuten (5,0 je Minute)** statt 4.001 am
Deckel. Uebrig bleiben Kopf und Brust in den Wandakrobatik-Clips (Median
0,718 / 0,596); die Huefte kommt auf 4 Meldungen bei 0,558 bis 0,561 m,
liegt also praktisch immer an der Wand.

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
Endstand (Werkszustand vor jedem Szenario zurueckgesetzt, 0
Ruecksetzfehler in 100 Szenarien):

| | Frage | Ergebnis |
|---|---|---|
| A | jemand IN einem Gebaeude | **0** |
| B | jemand unter der Bodenflaeche | **0** |
| C | dauerhaft haengengeblieben | **0** |
| D | Zivilist erreicht sein Ziel | 84 und 93 von 100 (zwei Laeufe) |
| E | alarmierter Gegner erreicht Spieler | 80 bis 83 von 100 |
| F | Ampelstopps (kein Fehler) | 50 520 Bilder |
| G | Bilder im Zug (kein Fehler) | 0 Bilder |

Laengster Stillstand 1,8 s (vorher 20 s). Verworfen wegen Ortssprung: 0.
Getrennt gezaehlt, weil es keine Fehler sind: Fahrgast geworden, und von
einer Gang niedergeschlagen.

A, B und C sind die drei Fragen, bei denen ein Treffer ein echter Fehler
waere. Alle drei sind null.

### Der Weg dahin: vier Fehler im Pruefstand, einer im Spiel
Die Zwischenstaende waren A 0, B 0, C 13, D 78/100, E 1/90. Jede
Verbesserung kam aus einer Korrektur am Messgeraet - bis auf eine:

1. **Der Spieler wurde nie geheilt.** Er steht hundertmal mitten in einer
   frischen Gang. Ist er tot, wirft `updateEnemies` jeden Gegner in jedem
   Bild zurueck auf `patrol`:

        if (e.target === 'player' && (player.dead || dp > 40 || dpy > 12))
          { e.state = 'patrol'; e.target = null; }

   Ab dem Tod des Spielers scheiterte JEDES weitere Szenario. Drei Laeufe
   mit identischem Aufruf ergaben 10, 12 und 41 von 100 - diese Zahlen
   sagten nur, wann der Spieler starb.
2. **Der Zustand wurde an der falschen Stelle gemessen**, naemlich NACH
   der eigenen Nachalarmierung. Der Bericht zeichnete die eigene Eingabe
   auf. An der richtigen Stelle stand der Gegner 1419 von 1420 Bildern
   auf `patrol`.
3. **Der Ortssprung** ueber mehrere hundert Meter, immer beim selben Bild
   (531/532) und in etwa der Haelfte der Seitenladungen, war der
   Geiselauftrag. `missionCd` steht auf 18 Sekunden; faellt die Wahl auf
   `geisel`, sucht er den Zivilisten, der dem Unterschlupf einer Gang am
   naechsten ist, und setzt ihn dorthin. Der Pruefstand kuerzt die
   Zivilistenliste auf EINE Figur - also traf es immer die Testfigur.
   Gefunden mit einem Stolperdraht auf die Position (ein Proxy, der bei
   jedem Schreibzugriff ueber 20 m den Aufrufstapel mitschreibt); die
   frueheren Stolperdraehte lagen auf `pos.set` und `pos.copy`, und
   geschrieben wird direkt auf `.x` und `.z`.
4. **Frage C stand komplett auf `hurt`.** Eine Gang hatte die Figur
   niedergeschlagen; wer getroffen wird, liegt 40 bis 60 Sekunden
   (`hurtT`) und wartet gegebenenfalls auf den Rettungsdienst. Im
   Datensatz sah das wie Haengenbleiben aus: die letzte
   Fluchtgeschwindigkeit 5,2 stand noch im `vel`, die Steckstufe blieb 0,
   und weit und breit war weder ein Nachbar noch ein Auto noch ein
   Gegner.

Der eine echte Befund steht unten: das Gehnetz reichte weiter als das
erlaubte Gebiet.

### Die Reste sind benannt, nicht nur gezaehlt
* **D, nicht angekommen:** 12 von 16 beziehungsweise 6 von 7 waren
  ueberwiegend auf der FLUCHT - eine Gang hatte sie von der Route gejagt.
* **E, nicht erreicht:** bei **17 von 17** waren weitere Gegner im Spiel.
  Sind mehrere auf den Spieler angesetzt, verteilt
  `verteileAngriffsrechte` Plaetze im Ring, und wer keinen Platz hat,
  haelt Abstand (kleinster Abstand im Median 6,0 m). Isoliert
  nachgefahren erreicht derselbe Gegner denselben Spieler in 1,9 s.
* Die Streuung zwischen den Laeufen (D 84 bis 93) ist echt: das Spiel
  benutzt `Math.random`, der Seed steuert nur die Welt.

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
