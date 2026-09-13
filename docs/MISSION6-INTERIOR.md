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

> **Zweiter Human-Playtest:** „Innen sieht gut aus, ist aber deutlich zu
> klein" und „die Mission ist viel zu schnell". Der Raum ist daraufhin
> von 30 × 22 auf **42 × 30 m** gewachsen, die Decke von 5,2 auf 6,0 m,
> und aus vier Zonen sind sechs geworden. Die Zahlen unten sind die
> neuen.

    Maße            42 × 30 × 6,0 m
    Sichtbare Teile 96
    davon massiv    45  (mit Kollisionskasten)
    davon klein     17  (bewusst ohne)
    Kollisionskästen 46  (45 + Deckel gegen das Herausspringen)
    Gegnerplätze    58  (abgetastet und geprüft, mit Zonenvermerk)
    Lichter          8  (1 Halbkugellicht + 7 Punktlichter)
    Start → Hinterausgang  38,6 m  (vorher 26,6)

### Zonen

| | Zone | x (lokal) | Inhalt |
|---|---|---|---|
| A | Eingang | −21 … −15,5 | schmaler Vorraum, Durchlass in der Mitte |
| B | Haupthalle | −15,5 … −3 | erste Kampffläche (Welle 1), Werkbänke, Regal, Kisten |
| C | Lager | −3 … +10,5 | zweite Kampffläche (Welle 2), Regalreihen, Container, Paletten |
| D | Geisel | +11 … +21, z +6 … +15 | abgeschirmte Ecke, L-förmiger Sichtschutz, Sitzkiste |
| E | Kommando | +10,5 … +21, z −15 … +6 | Funktisch, Karten, Gerät, Regal an der Ostwand |
| F | Hinterausgang | Ostwand, z −1,5 | Stahltür mit Leuchtschild |

Zwischen B und C steht ein **Hallentor**: zwei Wandstücke außen, 13 m
offen in der Mitte. Wer Welle 1 gewonnen hat, geht sichtbar in den
nächsten Abschnitt — das ist der räumliche Fortschritt, der die Mission
verlängert, ohne dass ein einziger Lebenspunkt dazukommt.

### Die vorgegebenen Wege werden beim Bauen geprüft

`createHideout` tastet Funkerweg und Geiselweg gegen die eigenen
Requisiten ab und gibt `wegFehler` zurück. Der erste Durchlauf des neuen
Raums meldete sofort zwei echte Blockaden — ein Kistenstapel auf dem
Funkerweg und ein Container auf dem Nordgang. Beide sind versetzt; der
Test besteht darauf, dass die Liste leer bleibt. Früher fand das erst
der Botlauf, und das ist zu spät und zu teuer.

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
Der Abstand ist gemessen; gewählt ist **4,6 m**, deutlich unter dem
Außenwert von 5,6 bis 6,6 m.

### Ausweichen statt heranziehen

> **Zweiter Human-Playtest:** „An der linken Wand ist die Kamera viel zu
> nah dran."

Die Ursache steckte in `kameraFreierAnteil`: steht eine Wand im Weg,
wird der Abstand gekürzt — und weil im Innenraum immer eine Wand in der
Nähe ist, rutschte die Kamera regelmäßig bis auf gut einen Meter an den
Rücken.

Die Reihenfolge ist umgedreht. Bevor der freie Abstand unter **2,3 m**
fällt, werden elf Lagen probiert: etwas nach links, etwas nach rechts,
höher, und die Kombinationen. Nur wenn keine davon frei ist, gilt wieder
die alte Kürzung. Die gefundene Abweichung wird geglättet und fällt von
selbst auf null zurück.

`tools/pruef/innen-kamera.js` misst elf Stellen × acht Blickrichtungen ×
40 Bilder, **beide Zustände in einem Lauf**:

| Stelle | Median ohne | Median mit |
|---|---|---|
| Mitte | 4,51 | 4,53 |
| Westwand | 4,53 | 4,53 |
| Ostwand | 4,53 | 4,53 |
| Südwand | 2,96 | 2,96 |
| Nordwand | 2,95 | 2,95 |
| Ecke SW | 1,94 | 2,53 |
| Ecke NW | 1,94 | 2,53 |
| Ecke SO | 1,23 | 2,48 |
| Ecke NO | 1,94 | 3,72 |
| Hallentor | 4,53 | 4,53 |
| Geiselwand | 1,37 | 3,97 |

    Bilder unter 2,3 m          1760 von 3520  ->  800 von 3520
    Bilder mit Kamera IN Wand      0           ->    0
    größter Drehsprung je Bild   0,00 Grad
    größter Ortssprung je Bild   0,008 m

Es gibt also **keine harten Sprünge**, nur eine geglättete Abweichung von
höchstens 39 Grad seitlich und 21 Grad nach oben. Was bleibt: in einer
echten Ecke, 1,2 m von zwei Wänden entfernt, gibt es für einen
4,6-m-Ausleger keine freie Bahn — dort muss die Kamera nach wie vor
heran. Das betrifft eine bis drei der acht Blickrichtungen je Ecke.

## Die Geisel

Sie ist ein echter Zivilist der Welt, über `c.geisel` stillgestellt.

> **Zweiter Human-Playtest:** „Geisel schwebt sichtbar und ist nicht
> gefesselt."

Beides stimmte. Sie stand in der Warte-Haltung auf Bodenhöhe, ohne
Sitzfläche und ohne Fesseln. Jetzt sitzt sie auf einer Kiste — Becken auf
deren Oberkante, Füße auf dem Boden, beides über `sitzMasse()`
**gemessen** statt abgezogen (dieselbe Rechnung wie bei den Fahrgästen im
U-Bahn-Wagen; ein fester Abzug ließe die einen schweben und die anderen
einsinken). Dazu zwei Bänder um die Handgelenke und eine Schnur
dazwischen, an den Handknochen ausgerichtet. Bei der Befreiung
verschwinden sie, beim Abbruch der Mission auch.

Drei echte Ursachen steckten darin, alle gemessen:

1. Die Höhenführung der Zivilisten zieht jede Figur auf `groundY`. Im
   Innenraum ist das der Fußboden, also fiel sie von der Kiste; danach
   schob `collideBody` sie seitlich heraus. Gemessen: Sollpunkt
   x 1015,50 — tatsächlich 1014,60; y 0 statt 0,52. Für eine sitzende
   Geisel ist jetzt die Sitzfläche der Boden.
2. Die Sitzhaltung stand direkt nach `visual.play()` — und die Feinarbeit
   am Handyarm zog den rechten Arm gleich danach wieder ans Gesicht
   (linke Hand 0,58 m richtig, rechte 1,29 m falsch). Sie steht jetzt am
   Ende der Figurarbeit; Handy und Schirm bekommt die Geisel gar nicht
   mehr in die Hand.
3. Der Bodenausgleich zieht die Füße auf die Höhe unter der Figur. Bei
   einer sitzenden Figur ist das falsch; er läuft für sie nicht mehr.

Und zwei Dinge, die erst das Bild gezeigt hat: die Sitzkiste war 1,1 m
breit, die Geisel saß in ihrer Mitte und die Beine verschwanden im
Kasten (jetzt 0,62 m — die Sitzhaltung legt die Knie gemessen 0,43 m vor
das Becken), und drei bis zu 27 m lange Deko-Kabel unter der Decke waren
im Bild keine Kabel, sondern haardünne schwarze Striche quer über das
ganze Bild.

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

### Die beiden letzten Konsolenmeldungen

Aus dem zweiten Playtest blieben zwei übrig, beide behoben, keine
unterdrückt:

* `favicon.ico 404` — die Seite hatte kein Sinnbild, also fragte jeder
  Browser von sich aus `/favicon.ico` an. Es liegt jetzt als
  Datenadresse (`data:image/svg+xml,…`) im Kopf von `index.html`: keine
  Anfrage mehr, keine zusätzliche Datei.
* `THREE.MeshLambertMaterial: 'flatShading' is not a property of this
  material` — die Warnung war richtig. `MeshLambertMaterial` kennt
  `flatShading` in r128 nicht; die Eigenschaft wurde nie ausgewertet. Sie
  ist entfernt, das Bild ändert sich dadurch nicht. (Wer dort wirklich
  Facetten will, braucht Phong oder Standard und damit ein teureres
  Material — für einen Kokon ist das nicht angemessen.)

Kein Fallback, keine leeren Dummy-Dateien: es wird schlicht nicht mehr
angefragt, was es nicht gibt. Die Figuren bekommen genau dieselben
Animationen wie vorher — der Held 94, die Zivilisten 50 und 42, die
Ganoven 42. `tools/test-animationen.cjs` prüft das in beide Richtungen.

---

## Der Takt des Kampfes

> **Zweiter Human-Playtest:** 56 s für die ganze Mission. Versteck
> sichern 9,4 s, Hinterhalt 9,9 s, Anführer 3,6 s. „Viel zu schnell",
> „Hinterhalt zu leicht".

Die Antwort ist überall dieselbe und sie heißt **nicht** mehr
Lebenspunkte: mehr echte Situationen.

| Phase | vorher | jetzt |
|---|---|---|
| Versteck sichern | 3 + 2–3 Gegner, beide Wellen irgendwo im Raum | Welle 1: 3 **nur in der Haupthalle**, Welle 2: 3–4 **nur im Lager** |
| Hinterhalt | eine Gruppe von 3 bis 5 | Welle A: 3, Welle B: 3–4 aus der entgegengesetzten Richtung |
| Anführer | einer, allein | einer + zwei Leibwächter (Wächter, flink) |

Zwischen Welle 1 und Welle 2 liegt das Hallentor: der Spieler muss den
Raum wechseln. Nie stehen mehr als vier Gegner gleichzeitig im Raum.
Lebenspunkte, Deckung, Standfestigkeit und das Kampfmarkensystem sind
unverändert.

### Warum der Anführer nach 3,6 s lag

Erst gemessen, dann geändert. `tools/pruef/anfuehrer.js` stellt genau den
Gegner auf, den die Mission aufstellt, und lässt den Helden so schnell
schlagen, wie das Spiel es zulässt:

    Gegner      HP  Deck  Stand  Elite  Sek   Schläge  Treffer  je Treffer
    Anführer    62    40     34     ja  2,35        5        6        15,5
    Brecher     62    40     34   nein  1,68        4        4        16,7
    Wächter     44    95     20   nein  0,78        1        2        27,2
    Schläger    34    55     10   nein  0,75        2        2        18,4

Keine der vermuteten Ursachen trifft zu:

* Das Elite-Verhalten **ist** an — blockChance 0,32 statt 0,20, kombo 2
  statt 1, Reaktion 0,53 statt 0,62.
* Beschädigt kommt er **nicht** an; er wird in dieser Phase neu
  aufgestellt, 62 von 62.
* Mehrere gleichzeitige Treffer kommen vor, aber selten: genau ein Bild
  mit mehr als 22 Schaden auf einmal.

Was zählt, ist das Verhältnis Schaden zu Lebenspunkten. Der Held richtet
15,5 Schaden je Treffer und 39,5 je Sekunde an; 62 Lebenspunkte sind vier
bis sechs Treffer. Der Anführer kommt in 2,35 s **einmal** zum Schlagen —
sein besseres Blocken kann sich gar nicht auswirken. Mehr Lebenspunkte
würden daran nichts ändern, sie würden nur länger dauern. Deshalb zwei
Leibwächter.

**Nebenbefund, ein echter Fehler:** `stArt()` setzt `e.typ` auf den
Grundeintrag der Ganoventabelle zurück — und damit auch die Zuschläge,
die `machElite()` in eine Kopie davon geschrieben hatte. `machElite()`
steigt danach sofort wieder aus, weil `e.elite` schon `true` ist. Ein
Gegner, den `spawnGang` mit 15 % Wahrscheinlichkeit zum Eliten macht und
den eine Mission danach umtypt, trug also das Elitezeichen über dem Kopf
und kämpfte wie ein gewöhnlicher Ganove (gemessen blockChance 0,20 statt
0,32). Die Zuschläge liegen jetzt in `eliteWerte()` und werden in
`stArt()` neu gesetzt.

---

## Flucht: Körper und Bewegung zeigen in dieselbe Richtung

> **Zweiter Human-Playtest:** „Gegner bewegen sich vom Spieler weg,
> während Körper, Blick und Laufanimation zu ihm zeigen."

Der Audit trennt zwei Fälle, wie im Auftrag verlangt:

**Rückzug** (`e.rueckzugT > 0`) — das Gesicht *darf* beim Helden bleiben,
aber dann muss die Darstellung rückwärts laufen. Gemessen lief in
**107 von 107** Bildern der Vorwärtslauf ab. Jetzt wird das Skalarprodukt
aus Blickrichtung und Bewegung gerechnet und bei unter −0,35 der
vorhandene Schalter `p.rueckwaerts` gesetzt (derselbe, den das Katapult
benutzt): 107 von 107 Bildern laufen rückwärts.

**Echte Flucht** (`e.flieht`) — der Körper muss sich wegdrehen. Der
Fluchtzweig drehte das Gesicht in die *gewollte* Richtung; danach drehten
`ausweichRichtung()` und der Umweg die Bewegung noch einmal um ein Haus
oder eine Wand herum, und das Gesicht wusste davon nichts. Jetzt zeigt
der Körper bei echter Flucht dorthin, wo er wirklich hinläuft.

`tools/pruef/flucht-facing.js`, Skalarprodukt aus Blickrichtung und
Bewegungsrichtung, Median und Anteil über 0,7:

| Fall | vorher | nachher |
|---|---|---|
| gerade | 0,67 / 48 % | 1,00 / 98 % |
| diagonal | 1,00 / 98 % | 1,00 / 98 % |
| Ecke | 1,00 / 100 % | 1,00 / 100 % |
| Uferseite | 1,00 / 100 % | 1,00 / 100 % |
| **Innenraum** | 0,49 / 40 % | 1,00 / 82 % |
| Rückzug | −1,00 (soll so sein) | −1,00, Clip läuft rückwärts |

Das gemeldete Fehlerbild — vom Helden weg laufen, zum Helden schauen,
dabei den Vorwärtslauf abspielen — kommt in keinem der sechs Fälle mehr
vor (0 von 1330 Bildern).

Die geführte Flucht des Funkers ist davon nicht betroffen: sie läuft über
`e.fluchtWeg` im selben Zweig und profitiert nur davon, dass der Körper
jetzt der tatsächlichen Richtung folgt.

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
