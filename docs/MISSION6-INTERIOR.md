# Mission 6 — Der Missions-Innenraum

Der zweite Human-Playtest hat den vorherigen Umbau zur Hälfte bestätigt
und zur Hälfte verworfen.

**Was getragen hat:** das echte Versteck-Gebäude wurde gut gefunden, und
die Gegner vor der Tür machen den Eingang verständlich.

**Was nicht getragen hat:** der physische Hausinnenraum der Open World ist
kein guter Kampfraum.

> Dort stehen Tische, Stühle und eine Bar. Zivilisten sitzen unbeeindruckt
> während des Kampfes herum. Sichtbare Möbel haben teilweise keine
> Kollision — man läuft hindurch. Der Boden flackert. Der Spieler landet
> stellenweise plötzlich wieder außerhalb des Hauses.

Der Befund ist strukturell und nicht durch weitere Sonderfälle zu
beheben: Open-World-Geometrie und Innenraumlogik arbeiten gegeneinander.
Jeder weitere Sonderfall über `groundY`, Möbel, Hausboden und
Fassadenkollision hätte die nächste Ecke verschoben.

**Deshalb bekommt Mission 6 einen eigenen instanzierten Innenraum.** Er
muss geometrisch *nicht* in das Außenhaus passen: er stellt denselben Ort
spielerisch dar und ist technisch ein getrennter Bereich.

---

## Warum der alte Ansatz nicht nachgebessert wurde

Der physische Hausinnenraum bleibt im Spiel — die 19 begehbaren Räume
sind Teil der Stadt und werden weiter betreten, beklettert und
durchquert. Nur *Mission 6* spielt nicht mehr darin.

Das ist kein Rückbau: die Außenphasen (Anfahrt, Versteckauswahl,
Eingangswache, echte Haustür) sind unverändert und stammen aus demselben
Umbau. Ersetzt ist ausschließlich der Kampfraum dahinter.

---

## Wo der Raum liegt — gemessen, nicht gewählt

`tools/pruef/weltgrenzen.js`:

    Kollider der Welt      1932 Stück, x -181,6 .. 395,6   z -188,1 .. 189,8
    Spielerklemme          x [-193, 395], z [-193, 193]   (updatePlayer)
    Kandidat (1000, 1000)  groundY 0, Wasser false, nächster Kollider 1020,9 m

Daraus folgt das Wichtigste an dieser Lösung: bei (1000, 1000) liefert
`groundY` bereits **exakt 0**. Ein Fußboden auf y = 0 braucht deshalb

* **keinen** Sonderfall in `groundY`,
* **keinen** Sonderfall in `collideBody`.

Die Innenwände sind gewöhnliche Kollisionskästen im vorhandenen Raster.
Geändert werden musste allein die Spielfeldklemme in `updatePlayer`.

---

## Der Raum

`mission-interiors.js` — eigene Datei, gleiche Offline-Bauweise wie
`city-visuals.js`, kein Spielzustand, kein Zugriff auf `game.js`.

    Maße            30 × 22 × 5,2 m
    Sichtbare Teile 53
    davon massiv    23  (mit Kollisionskasten)
    davon klein     7   (bewusst ohne)
    Kollisionskästen 24  (23 + Deckel gegen das Herausspringen)
    Gegnerplätze    25  (abgetastet und geprüft)

### Zonen

| | Zone | Inhalt |
|---|---|---|
| A | Eingang | schmaler Vorraum, Durchlass in der Mitte |
| B | Haupthalle | Kampffläche, Säulen, Kisten, Werkbänke |
| C | Geisel | abgeschirmte Ecke hinter einer niedrigen Trennwand |
| D | Funker | Kommandopunkt mit Funktisch, Karten, Gerät |
| | Hinterausgang | Stahltür mit Leuchtschild an der Ostwand |

### Kein Bodenflackern

Der Playtest meldete flackernden Boden. Die häufigste Ursache sind zwei
Flächen auf derselben Höhe. Im neuen Raum gilt:

* **genau eine** waagerechte Fläche auf Bodenhöhe,
* **genau eine** physikalische Bodenhöhe (`groundY` = 0),
* Bodenmarkierungen liegen zwei Zentimeter höher **und** haben
  `polygonOffset` — eine der beiden Maßnahmen allein hat in der Stadt
  schon geflackert.

`tools/test-interior.cjs` prüft alle drei Punkte.

### Möbel sind massiv

Regel aus dem Playtest: was sichtbar massiv und größer als ein
Dekostück ist, hat einen Kollisionskasten oder steht außerhalb der
begehbaren Fläche. Kleinkram (Flaschen, Papiere, Werkzeug, das Funkgerät)
hat bewusst keinen — eine Kollisionswolke aus hundert Kleinteilen war
genau der Fehler des alten Raums.

Der Test prüft die Umkehrung: jeder sichtbare Kasten über Kniehöhe und
größer als 0,7 × 0,7 × 0,5 m muss von einem Kollisionskasten gedeckt
sein. Ergebnis: alle.

### Keine Ambient-Zivilisten

Im Innenraum gibt es genau **eine** zivile Person: die Missions-Geisel.
`updateCivilians` überspringt drinnen jeden Zivilisten ohne `c.geisel`.
Die Geisel selbst läuft weiter — ein völliger Stopp ließe sie mitten in
ihrer Animation einfrieren.

---

## Weltpause

Gemessen, je 120 Bilder, größte Bewegung einer Figur:

    draußen   Autos 11,654 m   Zivilisten 6,397 m   Ambient-Gegner 8,489 m
    DRINNEN   Autos  0,000 m   Zivilisten 0,001 m   Ambient-Gegner 0,001 m
    danach    Autos 20,880 m
    Bestand unverändert: 26 Autos, 55 Zivilisten

**Pausieren heißt nicht abbauen.** Kein Auto wird gelöscht, kein Zivilist
dupliziert, kein Ereignis verworfen. Beim Verlassen machen alle Systeme
dort weiter, wo sie aufgehört haben.

**Läuft weiter:** Spieler, Heldenanimation, Kamera, Mission und Story,
Storygegner, Kampf, Geisel, Effekte, Klang, HUD, alle Messungen.

**Pausiert:** Verkehr, Ambient-Zivilisten, Ambient-Gegner, Event-Regisseur,
Polizei und Rettung, Zug, U-Bahn, Aufzüge, Helikopter, Wetter, Tageszeit,
Vögel, Stadtmöbel-Sicht, Flecken, Dampf, Spritzer, Gegner-Hygiene,
Boss-Lebenszyklus, Gegner-Nachschub.

Wetter und Tageszeit frieren **bewusst** ein: sonst wären nach einem
kurzen Besuch drinnen draußen Stunden vergangen.

---

## Sichtbarkeit und Renderlast

Gemessen im echten Bild (`renderer.info.render`):

| | Zeichenaufrufe | Dreiecke | sichtbare Szenenobjekte |
|---|---|---|---|
| A außen davor | 406 | 2 812 341 | 121 |
| B im Innenraum | **59** | **14 056** | 5 |
| C außen danach | 364 | 2 797 930 | **121** |

6,9-mal weniger Zeichenaufrufe, 200-mal weniger Dreiecke. Die
Sichtbarkeit kehrt exakt auf 121 zurück.

Ausgeblendet wird über die Kinder der Szene, nicht über einzelne Objekte:
gemerkt wird genau, *was wir* unsichtbar gemacht haben, und beim
Verlassen wird genau das wieder gezeigt. **Lichter bleiben sichtbar** —
ein unsichtbares Licht leuchtet in three.js nicht mehr, und der Raum wäre
schwarz.

---

## Ein- und Austritt

    hinein   0,267 s   (16 Bilder)
    hinaus   0,267 s   (16 Bilder)
    größter Ortssprung bei OFFENEM Bild: 0,05 m

Der Wechsel läuft ausschließlich im schwarzen Bild. Während des
Übergangs nimmt das Spiel keine Eingabe an. Es wird nichts geladen —
alles ist bereits im Speicher.

Die Türzone ist an der **Türachse** gemessen, nicht an der Hausmitte:
quer höchstens 1,6 m von der Achse, längs von 1,2 m davor bis 3,5 m
dahinter. Wer seitlich an der Fassade steht, löst nichts aus.

### Der Rückkehrpunkt

Das Außenhaus hat **keine** Hintertür und bekommt auch keine. Der kurze
Schwarzfilm vermittelt, dass der Spieler das Gebäude hinten verlässt;
innen und außen sind bewusst getrennte Darstellungen desselben Ortes.

Der Punkt selbst ist trotzdem nicht erfunden: `stAussenHinterHaus()`
sucht auf der der Tür abgewandten Seite mit `freieFlaeche` — derselben
Prüfung, die auch den Treffpunkt findet (Gehweg statt Fahrbahn, kein
Wasser, im Gebiet, wirklich freier Radius). Findet sie dort nichts, wird
der Ring größer; als letztes bleibt das Vorfeld der Tür.

---

## Kamera

Kein zweites Kamerasystem, nur eine andere Einstellung derselben Kamera.
Der Abstand ist gemessen, 72 Proben je Wert (neun Standorte × acht
Blickrichtungen):

    Abstand  außerhalb des Raums  unter 2 m  min   Median  max
     3,2             0               24      0,08   2,36   3,15
     3,6             0               22      0,08   2,37   3,54
     4,0             0               22      0,08   2,42   3,93
     4,6             0               22      0,08   2,78   4,52
     5,2             0               22      0,08   2,90   5,11

Zwei Dinge stehen damit fest. Die Kamera **verlässt den Raum bei keinem
Wert** — das erledigt die vorhandene Wandprüfung, weil die Innenwände
gewöhnliche Kollider sind. Und die Fälle, in denen sie ganz an die Figur
herangezogen wird, hängen **nicht** am Abstand: es sind immer dieselben
22 von 72, nämlich Standorte anderthalb Meter vor einer Wand mit Blick
genau in diese Wand. Das ist dasselbe Verhalten wie draußen vor einer
Fassade.

Gewählt ist **4,6** — der beste gemessene Median, der noch deutlich unter
dem Außenwert von 5,6 bis 6,6 m liegt.

## Netzschwung und Wandkleben drinnen

* **Netzschwung ist im Innenraum abgeschaltet.** 30 × 22 m sind keine
  Schwungstrecke, und es gibt keinen sinnvollen Anker. Dieselbe Regel wie
  unter Tage, und aus demselben Grund. Springen, Ausweichen, Rollen und
  Kampf bleiben unverändert.
* **Wände, Säulen und Trennwände sind nicht kletterbar** (`keinKlettern`).
  Kein neues Feld — die U-Bahn-Innenwände benutzen es seit Phase 10 aus
  demselben Grund. Kisten und Werkbänke bleiben ausgenommen: auf die soll
  man steigen dürfen.

---

## Die Phasen

| | Ziel | Ort |
|---|---|---|
| 0 | Das Versteck erreichen | außen, Leuchtturm vor der Tür |
| 1 | Die Eingangswache ausschalten | außen, 2–3 Gegner neben dem Durchgang |
| 2 | Ins Versteck eindringen | Türzone → Blende |
| 3 | Das Versteck sichern | **innen**, 3 + 2–3 Gegner in zwei Wellen |
| 4 | Die Geisel befreien | **innen**, hingehen genügt |
| 5 | Den Funker stellen | **innen**, Kommandopunkt → Hinterausgang |
| 6 | Den Funker verfolgen / Zum Treffpunkt | Blende → außen, Verfolgung |
| 7 | Den Hinterhalt überstehen | außen, 3–5 Gegner |
| 8 | Den Anführer stellen | außen, `machElite` |

Funk: eine Startmeldung, zwei Zwischenmeldungen, eine Abschlussmeldung.
Die Meldung der Eingangswache ist gestrichen — zwei Wächter vor einer Tür
erklären sich selbst.

### Zwei gültige Wege

* **Der Funker erreicht den Hinterausgang** → Verfolgung draußen.
* **Der Spieler fängt ihn drinnen** → sein Funkgerät nennt den
  Treffpunkt, die Mission läuft weiter. Marke `funkerFrueh`.

---

## Tod, Abbruch, Kontrollpunkt

Gespeichert wird weiterhin **nur die Missionsphase**. Kein neues
Speicherformat. Der Raum entsteht jedes Mal gleich.

* **Tod im Innenraum:** die Figur kommt heraus, und die Mission setzt auf
  ihrem Kontrollpunkt neu auf. Ohne das stünde der Spieler draußen vor
  einem Auftrag, den nur der Innenraum erfüllen kann.
* **Wiedereinstieg am Kontrollpunkt in eine Innenraumphase:** der Raum
  wird betreten und der Aufbau im ersten Bild danach nachgeholt
  (`innenPhase` / `innenPhaseTakt`).
* **Abbruch, Storywechsel, Neustart:** der Raum wird sofort und ohne
  Blende zurückgenommen. Kein Zustand darf dauerhaft auf `active` bleiben.

Gemessen:

    Tod im Innenraum   vorher {innen: true, Phase 3}
                       danach {innen: true, Phase 3, Story aktiv, Spieler im Raum, 1 Geisel}
    Abbruch            danach {innen: false, Übergang null, Story aus,
                               0 Storygegner, 0 Geiseln}

---

## 50 × hinein und hinaus

    vor:   Szene 287  Kollider 1932  Zivilisten 55  Autos 26  Geiseln 0  Innenräume 0
    nach:  Szene 295  Kollider 1956  Zivilisten 55  Autos 26  Geiseln 0  Innenräume 1

**Ein** Innenraum nach fünfzig Zyklen, **ein** Satz Kollisionskästen
(+24, einmalig). Die acht zusätzlichen Szenenobjekte sind sieben
Ambient-Gegner, die zwischen den Zyklen draußen nachgewachsen sind, plus
die Innenraumgruppe.

---

## Boden- und Kollisions-Stresstest

3 600 Bilder Dauerlauf drinnen: laufen, sprinten, springen, gegen jede
Wand, um jedes große Requisit, in 24 Richtungen.

    vorher (mit Wandkleben)   Höhe 0 .. 11,52 m   149 Bilder außerhalb des Raums
    nachher                   Höhe 0 ..  3,45 m     0 Bilder außerhalb des Raums
    unter dem Boden 0    in einem Requisit steckend 0

Die 11,52 m in einem 5,2 m hohen Raum waren das Wandkleben an den
Innenwänden — gefunden vom Test, nicht im Spiel.

---

## Die 404-Anfragen

Nicht Teil des Innenraums, aber im selben Playtest gemeldet: die Konsole
war voll mit `thug@wandsprung.glb`, `thug@netzwurf.glb`,
`thug@sturzflug.glb` und weiteren.

Gezählt sind es nicht zehn, sondern **hundert bei jedem Seitenaufruf**:
33 Bewegungen, die es nur für den Helden gibt, standen in
`GLB_ANIM_PARTS` — der Liste *für alle* Slots. Mal drei Slots (thug,
civilian, civilian2) sind das 99 vergebliche Anfragen, dazu `attack`,
das es für keinen einzigen Slot gibt.

Die Trennung ist kein neuer Mechanismus: `HELD_ANIM_PARTS` gibt es seit
Phase 8 genau dafür, und der Kommentar dort sagt es wörtlich — „sonst
suchten Zivilisten und Gegner eine Datei, die es für sie nicht gibt".
Die Namen standen nur auf der falschen Seite.

    vorher   100 vermeidbare 404-Anfragen je Seitenaufruf
    nachher    0

Kein Fallback, keine leeren Dummy-Dateien: es wird schlicht nicht mehr
angefragt, was es nicht gibt. Die Figuren bekommen genau dieselben
Animationen wie vorher — der Held 94, die Zivilisten 50 und 42, die
Ganoven 42. `tools/test-animationen.cjs` prüft das in beide Richtungen.

---

## Wiederholungslauf

`playtest.replay('m6')` — nur mit `?playtest=1`.

Die Mission wird **nur im Speicher** aus der Erledigt-Liste genommen, und
solange der Wiederholungslauf läuft, schreibt das Spiel **keinen**
Spielstand. Nach einem Neuladen ist alles wie vorher — es wurde nie einer
angefasst. `playtest.replayEnde()` schaltet das Speichern wieder ein.

---

## Der vollständige Missionslauf

Beide gültigen Wege, im Botlauf gemessen:

| | Phasen | Mission 7 | Verfolgung | Dauer | danach |
|---|---|---|---|---|---|
| A — Funker flieht | 9 | frei | **160 m in 18,2 s** | 41,1 s | 0 Storygegner, 0 Geiseln |
| B — früh gefangen | 9 | frei | — (`funkerFrueh`) | 106,8 s | 0 Storygegner, 0 Geiseln |

Kein Tod, kein Neustart, 0 s ohne Fortschritt in beiden Läufen.

Die 160 m liegen im angestrebten Band von etwa 100 bis 220 m. Davor waren
es 35 m — nicht weil die Verfolgung zu kurz gebaut war, sondern weil
`stTreffpunkt` den Weg noch vom **Vorfeld der Haustür** aus maß, während
Spieler und Funker längst hinten herauskommen. Gemessen wird jetzt ab dem
Rückkehrpunkt. Verlängert wurde nichts.

---

## Regression

Alles neu gelaufen, nichts aus früheren Berichten zitiert.

    node --check game.js / city-visuals.js / menu.js / mission-interiors.js   ok
    node --test (tools/)                                        157 von 157
    git diff --check                                            sauber
    Kernsysteme (sieben Bereiche)                               alle ok
    Test C Übergangsmatrix                                      20 von 20
    Test E Freigängigkeit                                       alle neun Flächen frei,
                                                                0 wirklich gesperrt
    Test D NPC-Wege                                             A 0, B 0, C 0
    Test A 30 Minuten aktives Spiel                             alle 26 Punkte vorgekommen,
                                                                0 JS-Fehler, 0 Tode,
                                                                0 Bilder unter dem Boden,
                                                                kein Wachstumstrend
    50 × hinein und hinaus                                      ein Raum, ein Kollidersatz

**Offen, unverändert seit der Phase davor:** Test D meldet D 84/100 und
E 77/100 als Befund. Das ist die Richtung, die die `freieSicht`-Korrektur
vorhersagt — ein Gegner, der hinter einer Wand die Sicht verliert, sucht
jetzt, statt weiter zu verfolgen, und ein Zivilist, der flieht, erreicht
sein Ziel seltener. Es ist **ein Lauf je Messpunkt**, und dieser
Prüfstand schwankt; als Zahl ist er nicht belastbar. Der Innenraum ist
während Test D nicht aktiv.

---

## Bekannte Grenzen

* **Die Missionsdauer ist mit einem Bot gemessen**, nicht mit einem
  Menschen: 41 und 107 Sekunden. Der Bot reist gesetzt an, zögert nie und
  sucht nichts. Die Zielspanne von 8 bis 15 Minuten ist eine Absicht,
  keine Messung — sie kann erst der Human-Playtest bestätigen.
* **Der Bot ist ein Geradeausläufer.** Er kann nicht ausweichen. Im
  Innenraum steht Mobiliar, und er ist dort fünfmal hängengeblieben —
  jedes Mal an einer anderen Stelle, und jeder handgebaute Wegpunkt hat
  den nächsten Fall erzeugt. Gelöst ist es dadurch, dass der **Raum
  seinen eigenen Weg kennt** (`geiselWeg`, wie `funkWeg` beim Funker),
  dazu ein allgemeiner Seitenschritt als letzte Rettung. Ein Mensch hat
  dieses Problem nicht.
* **Die Kamera wird in 22 von 72 Proben näher als zwei Meter an die Figur
  gezogen.** Das sind Standorte anderthalb Meter vor einer Wand mit Blick
  genau in diese Wand, und es ist dasselbe Verhalten wie draußen vor
  einer Fassade. Der Kameraabstand ändert daran nichts (gemessen über
  fünf Werte), nur den Median.
* **Der Innenraum ist ein Raum, kein Gebäude.** Es gibt keine zweite
  Etage, keine Treppe und kein Dach zum Betreten. Netzschwingen ist
  drinnen abgeschaltet, Wände sind nicht kletterbar.
* **Keine Missions-Requisiten am Treffpunkt.** Der Hinterhalt findet auf
  einem geprüft freien Platz statt, der nicht mit Kisten oder einem Van
  ausstaffiert wird.
* **Die Zahl „Gegner höchstens N m vom Versteck" in der Phasentabelle ist
  für Innenraumphasen ohne Aussage**: sie misst gegen das Haus in der
  Stadt, während die Figuren im Raum bei x = 1000 stehen. Sie steht dort
  für die Außenphasen; für drinnen ist sie zu ignorieren.
