# Mission 6 „Das Versteck" — Umbau nach dem Human Playtest

Der menschliche Durchlauf von Akt 1 hat genau einen Designbefund
zurückgemeldet, und der saß:

> Die Mission mit dem Versteck der Feinde hat nicht überzeugt, weil es
> **kein richtiges Versteck** war. Erwartet wird: in ein Gebäude
> hineingehen, und drinnen ist das Versteck.

Diese Notiz hält fest, was vorher war, was jetzt ist, wie das Haus
ausgewählt wird, was gemessen wurde und wo die Grenzen liegen.

---

## Vorher

    Phase 1  Das Versteck erreichen   stPoi(['LANDMARK','ROOFTOP','TRANSIT'], 60)
                                      oder stOrt(80)  → irgendein offener Platz
    Phase 2  Die Wache ausschalten    stGang(ort + 6, 3)
    Phase 3  Den Innenhof räumen      stGang(ort - 8, 4) + stGang(ort + 4, 3)
    Phase 4  Den Anführer stellen     stGang(ort, 4), Chef mit 1,5-facher Energie

Vier Phasen, drei Gangwellen um einen Punkt herum. Der Auftragstext
versprach „Das Versteck erreichen" und „Den Innenhof räumen"; geliefert
wurde ein Stück Straße. Ein Innenraum kam nicht vor.

## Nachher

Neun Phasen, alle auf dem **vorhandenen** Story-System
(`MISSION.art = 'story'`, `STORY_DEF`, `storyTakt`, `stGang`, `stFunk`,
Beacon, Kontrollpunkt je Phase). Kein zweites Missionsframework, kein
zweiter Event-Regisseur, kein zweites Gegnersystem.

| | Ziel | Inhalt |
|---|---|---|
| 0 | Das Versteck erreichen | Leuchtturm **vor der Tür**, nicht über der Hausmitte |
| 1 | Die Eingangswache ausschalten | 2–3 Gegner, gemischte Archetypen, neben dem Durchgang |
| 2 | Ins Versteck eindringen | endet erst, wenn die Spielerposition **wirklich im Innenraum** liegt |
| 3 | Das Erdgeschoss sichern | 2–4 Gegner, Zahl aus der freien Fläche; Geisel tief im Raum |
| 4 | Die Geisel in Sicherheit bringen | hingehen genügt — keine Eskorte |
| 5 | Den Funker stellen | flieht über die **echte Tür** nach draußen |
| 6 | Den Funker verfolgen / Zum Treffpunkt | zwei gültige Wege |
| 7 | Den Hinterhalt überstehen | 3–5 Gegner um den Treffpunkt verteilt |
| 8 | Den Anführer stellen | `machElite` — besseres Verhalten, keine aufgeblasene Leiste |

Funk: eine Startmeldung, zwei Zwischenmeldungen, eine Abschlussmeldung.
Beim frühen Fang kommt eine kurze zusätzliche Meldung, damit klar ist,
woher der Treffpunkt bekannt ist. Die Ziele erklären den Rest.

---

## Wie das Haus ausgewählt wird

Die Stadt hat **19 begehbare Innenräume** (`KIT_INNEN`): vier
Wandscheiben mit einer Türlücke, eigener Fußboden, Dachplatte
(`kitHindernis`). Nichts davon ist neu — neu ist, dass die Mission sie
benutzt.

`versteckListe()` leitet die Kandidaten aus der gebauten Stadt ab:

* **Tür in der eigenen Wand.** Nicht die nächstgelegene: bei den 19 m
  breiten Häusern liegt die Tür des Nachbarhauses der Raummitte
  manchmal näher als die eigene.
* **Gültige Standpunkte** im 1,5-m-Raster (`versteckPunkte`), geprüft
  gegen Wand, Möbel, Boden und Türdurchgang.
* **Freies Vorfeld.** Ist der Zugang verstellt, fällt das Haus ganz
  heraus — gemessen trifft das genau eines der neunzehn.
* **Hof in Reichweite** für den Schluss (`freieFlaeche`).

`versteckWert()` bewertet messbar: Standpunkte, Fläche (gedeckelt),
freies Vorfeld, Hof. Ausdrücklich **nicht** „das größte gewinnt".
`stVersteck()` würfelt unter den drei besten, damit nicht jede Partie
dasselbe Haus sieht — aber nie ein schlechtes.

Keine handgeschriebene Weltkoordinate.

## Spawnvalidierung im Innenraum

Ein Standpunkt gilt, wenn er im Raum mit Wandabstand liegt, der
Fußboden darunter der Raumboden ist, der Türdurchgang frei bleibt und
kein Kollider im Weg ist — **einschließlich der kleinen**. Die kleinen
sind hier die Möbel: Regal, Theke, Tisch und Stühle kommen über
`kitMoebel()` als `addCollider({… klein: true})` in die Welt.
`inGebaeude()` lässt sie bewusst aus (sie sind kein Gebäude), für einen
Standpunkt sind sie genau das Hindernis, um das es geht.

## Geisel

Ein **echter Zivilist** aus der Welt, gebunden über das vorhandene
`c.geisel`. Das ist kein neues Feld: Route, Gespräch, Aktivität,
Bahnsteig und Sozialpartner fragen alle danach, und Zivilisten werden
nie abgebaut (es gibt kein `civilians.splice`) — die Welt-Hygiene kann
sie also nicht wegräumen. Beim Aufräumen wird die Bindung gelöst.

Keine Eskorte: Bereich gesichert, hingehen, gerettet.

## Funker

Er flieht über die echte Tür. Möglich wird das dadurch, dass eine
Mission dem **vorhandenen** Fluchtzweig in `updateEnemies` einen Weg
vorgeben darf (`e.fluchtWeg`). Der Grund: `fluchtRichtung()` läuft vom
SPIELER weg — steht der zwischen Funker und Tür, rennt der Funker in die
Rückwand. Drinnen führt der Weg, draußen wieder die Angst.

Die Punkte: hinter der Tür → Türmitte → vor der Tür → **Gehnetz**
(`gehRoute`) zum Treffpunkt. Das Gehnetz ist die geprüfte freie
Navigation der Stadt (Test E). Teleportiert wird nirgends.

### Zwei gültige Wege

* **Er entkommt aus dem Haus** → echte Verfolgung.
* **Der Spieler fängt ihn sehr früh** (Netz, K.o., Abkürzung) → der
  Treffpunkt wird über sein Funkgerät bekannt, und die Mission läuft
  weiter. Gut gespielt wird belohnt, nicht bestraft.

Keine künstliche Unverwundbarkeit: der Funker hält 1,25-fache Energie
aus, mehr nicht.

## Treffpunkt

`stTreffpunkt()` sucht einen wirklich freien Platz und misst dabei den
**gelaufenen Weg** über das Gehnetz, nicht die Luftlinie — Zielband 120
bis 250 m. Der erste Entwurf nahm einfach den nächsten freien Platz; aus
95 m Luftlinie wurden im Botlauf 1331 gelaufene Meter in 336 Sekunden.

Wenn kein echter Innenhof existiert, wird auch keiner behauptet: der
Auftragstext heißt „Den Hinterhalt überstehen".

## Aufräumen

Bei Abschluss, Abbruch, Tod und Story-Wechsel räumt `storyAufraeumen()`
Storygegner, Beacon und Missionsdaten weg — dazu jetzt die
Geiselbindung und den Funkerzustand. Zwei Sonderfälle:

* **Entkommener Funker** wird aus der Welt genommen
  (`stEntferneGegner`), nicht totgestellt. Er ist nicht besiegt.
* **Geflohene Storygegner** weiter als 50 m vom Treffpunkt gelten als
  aus dem Kampf (`stGeflohenAufraeumen`). Bricht der Mut eines Gegners,
  rennt er davon — und eine „Bereich räumen"-Phase wartete sonst ewig.

## Kontrollpunkte, Speichern und Neustart

Jede Phase ist ein Kontrollpunkt — das macht `storyPhaseAuf()` seit
jeher. Gespeichert wird nur, **welche** Phase; die Welt wird beim
Wiedereinstieg neu aufgebaut. Kein neues Speicherformat.

Damit das trägt, zieht jede Phase das Versteck bei Bedarf nach
(`stVersteckSichern`): beim Wiedereinstieg läuft nur die aktuelle Phase
auf, die vorherigen sind übersprungen.

---

## Messwerte

`tools/pruef/mission6.js`

### Test 1 — Haus-Auswahl (alle 18 tauglichen Häuser)

    betretbar (außen → innen)        18/18
    verlassbar (innen → außen)       18/18
    Hof in Reichweite                18/18
    Innenfläche                      141 bis 286 m²
    freie Fläche                     47 bis 182 m²
    gültige Standpunkte              21 bis 81

### Test 2 — Spawnvalidierung

    geprüfte Standpunkte             360
    ungültig (Wand, Boden, Möbel,
    außerhalb, zu nah aneinander)    0

### Test 3 — Sicht

    durch eine Wand sichtbar         0 von 216
    durch die offene Tür sichtbar    15 von 18   (soll so sein)

### Test 4+5 — Funker-Exit und Verfolgung (50 Läufe)

    aus dem Haus gekommen            50/50
    dabei die Tür benutzt            50/50
    Treffpunkt erreicht              47/50
    Weglänge                         min 27 m, Median 118 m, max 215 m
    im Kollider                      0 Bilder
    unter dem Boden                  0 Bilder
    Ortssprünge / Teleports          0
    längster Stillstand              1,5 s

### Test 8 — Geisel

    Abweichung vom Platz             0 m
    Zug / Bahnsteig                  0
    Aktivität übernommen             0
    Gespräch begonnen                0
    Bindung verloren                 0
    Bodenfehler                      0
    noch in der Zivilistenliste      ja

### Test 9 — Kontrollpunkte

Wiedereinstieg in jede der neun Phasen: alle neun bauen sich auf,
stehen auf der richtigen Phase, mit höchstens einer Geisel und ohne
doppelte Gegner.

### Test 10 — kompletter Missionslauf

    Variante A (Funker flieht)       9 Phasen, abgeschlossen, Mission 7 frei
    Variante B (früh gefangen)       9 Phasen, abgeschlossen, Mission 7 frei
    danach je Lauf                   0 Storygegner, 0 gebundene Geiseln

---

## Was der Umbau im Spiel gefunden hat

Drei echte Fehler, alle behoben, alle außerhalb von Mission 6 wirksam:

1. **`freieSicht` hat den Sichtstrahl abgetastet statt geschnitten.**
   Höchstens 26 Punkte auf 26 m — über zwei Meter Abstand, bei 0,8 m
   dicken Wänden. Der Strahl sprang über Wände hinweg, und Ganoven sahen
   hindurch. Gemessen: 2 von 133 Wandrichtungen waren frei. Jetzt eine
   echte Strecken-Kasten-Prüfung: 0 von 216.
2. **`t.dreh` wurde bei den Türen zweimal addiert.** `merkeHaus()`
   speichert die Drehung schon inklusive. Betroffen: `Building_Small_1`
   (11 Häuser) — ihr Durchgang lag quer mitten im Raum. Test E hat mit
   diesen Rechtecken geprüft, ob vor einer Haustür etwas im Weg steht,
   und für elf von neunzehn eine Fläche im Zimmer als „frei" gemeldet.
3. **Die Türnormale war `(-sin, cos)` statt `(sin, cos)`.** Fiel nie
   auf, weil bei ry = 0 und π der Sinus null ist. Gemessen, „drei Meter
   in Normalenrichtung": mit dem Minus landeten neun von neunzehn im
   Haus, ohne keine.

## Bekannte Grenzen

* **3 von 18 Häusern** lassen den Blick nicht geradewegs durch die
  offene Tür (Test 3). Gemessen, nicht erklärt — die Richtung ist die
  unkritische: es heißt, dass eine Wache im Zweifel *weniger* sieht.
* **3 von 50 Verfolgungen** erreichen den Treffpunkt nicht innerhalb
  des Zeitfensters. Der Funker bleibt dabei im Freien, auf gültigem
  Boden, ohne Wanddurchdringung — er ist nur langsamer als das Fenster.
  Die Mission fängt das ab: nach Ablauf gilt sie als weicher Ausgang,
  und der Treffpunkt steht trotzdem.
* **Die Missionsdauer** ist mit einem Bot gemessen, nicht mit einem
  Menschen. Die Zielspanne von 8 bis 15 Minuten ist eine Absicht, keine
  Messung.
* **Keine Mission-Requisiten.** Der Treffpunkt wird nicht mit Kisten
  oder einem Van ausstaffiert. Das wäre möglich (nur vorhandene
  Assets), kostet aber ein Aufräumen mehr, das schiefgehen kann — und
  der Auftrag nennt es ausdrücklich optional.
