# Phase 13 — Abschlussbericht

Dreissig Punkte, wie im Auftrag verlangt. Jede Zahl hier ist gemessen und
mit einem Skript im Repo nachrechenbar; wo ein Befund ausblieb, steht das
so da, und wo mein eigenes Messgeraet danebenlag, steht auch das.

---

## PHASE 13 TECHNISCH FREIGEGEBEN

Alles, was sich ohne einen Menschen am Steuer pruefen laesst, ist
gelaufen und gruen. Die Aussage bezieht sich ausdruecklich auf die
**technische** Seite; sie sagt nichts darueber, ob Akt 1 Spass macht.

**Wofuer die Freigabe gilt:**

    node --check (3 Dateien)                sauber
    node --test                             141 von 141
    git diff --check                        sauber
    Test A  30 Minuten aktives Spiel        alle 26 Punkte vorgekommen,
                                            kein Wachstumstrend, 0 JS-Fehler
    Test B  60 Minuten Weltbelastung        kein Wachstumstrend, 0 Lecks
    Test C  Uebergangsmatrix                20 von 20
    Test D  NPC-Hindernisse                 A 0, B 0, C 0
    Test E  Freigaengigkeit der Stadt       alle neun Flaechen frei
    Kernsysteme                             sieben Bereiche, alle ok
    Verkehrsstunde                          14.400 Proben, 0 Geisterfahrer
    Bewegung (7 Einzelpruefstaende)         0 fehlerhafte Anlaeufe

**Der Human Playtest ist inzwischen gemacht.** Der Auftraggeber hat Akt 1
selbst durchgespielt (Abschnitt 24). Er bringt **einen** Befund mit, und
zwar keinen technischen: Mission 6 „Das Versteck" spielte auf einem
offenen Platz statt in einem Gebaeude. Dieser Befund wurde **im Human
Playtest gefunden, anschliessend behoben** — die Mission spielt jetzt im
Innenraum eines der 19 begehbaren Haeuser (`docs/MISSION6-VERSTECK.md`).
Der Human Playtest der neuen Fassung steht noch aus.

**Was die Freigabe NICHT abdeckt:**

1. **Ob Akt 1 Spass macht.** Ein Durchlauf eines Menschen liegt jetzt vor
   und hat einen Befund ergeben; das ersetzt aber keine Aussage darueber,
   ob die Missionskette insgesamt traegt. Der Pruefmodus dafuer bleibt
   eingebaut (`?playtest=1`, siehe `docs/PLAYTEST-AKT1.md`).
2. **Die Namensnennung im Spiel.** Die Herkunft von
   `assets/haeuser.glb` ist geklaert — zwei Saetze von Daniel
   Zhabotinsky auf Sketchfab, **CC Attribution**
   (`docs/MODELL-QUELLEN.md`). Diese Lizenz verlangt, dass Urheber und
   Quelle genannt werden. Im Repository stehen sie; im Spiel gibt es
   dafuer noch keine Stelle.

**Offene, benannte technische Punkte** (keiner davon blockiert, alle in
Abschnitt 30 mit Messwerten): das Fussrutschen von `kriechen` (99 %,
Ursache gemessen, kein Fix ohne neue Animation oder Fuss-IK), die
Verfolgung an langen Hindernissen (Luftlinie mit 3,6 m Vorausschau), und
kein Zuschauerverhalten bei Ereignissen.

Die sieben Higgsfield-Objekte sind vom Auftraggeber freigegeben; die
Fuenfer-Grenze gilt nicht mehr und ist **kein offener Punkt**.

**Akt 2 wird nicht begonnen.**

---

## 1. Ausgangsstand / HEAD

Phase 13 beginnt nach `9826ebf` ("Kulisse: die Stadt hoert nicht mehr am
Kartenrand auf"). Seitdem 46 Commits auf `claude/spider-man-game-dev-8cepen`.

Umfang der Aenderungen: 48 Dateien, +8.253 / −61 Zeilen. Der groesste Teil
davon ist **neuer Pruefstand** (`tools/pruef/`, 26 Skripte) und
Dokumentation (`docs/`). Am Spiel selbst: `game.js` +692/−54,
`city-visuals.js` 13 Zeilen, `index.html` 17 Zeilen.

## 2. Groesste tatsaechlich gefundene sichtbare Probleme

In der Reihenfolge, wie stark sie im Bild auffallen:

1. **Der Wandsprung verliess die Wand nicht** (Test C). Mit gehaltenem W —
   also genau so, wie man die Wand hinauflaeuft — kam der Absprung *nie*
   in die Luft: waagerechtes Hoechsttempo 0,00 m/s, Zustand blieb `climb`,
   die Figur fuhr die Fassade weiter hoch. Behoben.
2. **Ueber die Bruecke fuhr kein einziges Auto** (Teil 20). Die extra
   dafuer gebaute Grenze war durch `AUTO_X_MAX` unerreichbar. Behoben,
   jetzt 1,00 Durchfahrten je Minute.
3. **Der Brueckengehweg brach an beiden Enden als 20–25 cm hohe Kante ab**
   und das Gelaender lief mitten durch beide Pylonbeine (Teil 20). Behoben.
4. **Vorfahrt-Verklemmung an der Uferstrasse** (Teil 17): zwei Autos
   warteten wechselseitig aufeinander. Im Stundenlauf gefunden, behoben.
5. **Die Kantensuche auf dem Dach war abgeschaltet**, weil ein Dachkranz
   als Laterne galt (Teil 9). Behoben.
6. **Ueberwege am Kartenrand fuehrten ins Nichts** (Test E): 22 Streifen
   auf der Promenade und ueber den Kartenrand hinaus, 32 von 256
   Ueberwegsflaechen ausserhalb jeder Fahrbahn. Behoben.
7. **Zwei Knoepfe der Touch-Bedienung waren zu klein** (Teil 23): 42 px
   statt der 44 px, die als Mindestgroesse gelten. Behoben.
8. **Der Weltkeim fiel beim Laden nie auf den Vorgabewert zurueck**
   (Teil 22). Behoben.

## 3. Hero Animation Audit (Teil 2)

94 `hero@*.glb`-Clips einzeln vermessen (`tools/anim-matrix.mjs`, Ergebnis
in `docs/BEWEGUNGS-MATRIX.md`). Drei Abspielklassen unterschieden: laeuft
ab, Haltung mit `timeScale = 0`, gemischt. **Kein Befund** — nichts zu
reparieren.

## 4. Higgsfield Animation Comparison (Teil 3)

**Kein Vergleichsmaterial erzeugt**, aus drei unabhaengigen Gruenden
(`docs/HIGGSFIELD-KLETTERN.md`): der ABSOLUTE HERO-RIG LOCK verbietet, das
Mixamo-Rig zu ersetzen; neue bezahlte Generationen sind ausgeschlossen
(Restguthaben 5,76); und ein Video waere ohnehin nur Referenz, kein
einsetzbarer Clip. Der Punkt ist damit beantwortet, nicht uebersprungen.

## 5. Wall Crawl (Teil 4)

`tools/pruef/wandkriechen.js`. Abstand aller Gliedmassen zur Fassade ueber
1.380 Bilder: Haende 0,005–0,969 m, Fuesse −1,494–0,306 m, Rumpf im Mittel
0,36–0,40 m. **0 Meldungen des Fail-Loggers, 0 fehlerhafte Richtungen.**
Der Fehlermelder selbst war zu streng geeicht (0,30 m) und wurde auf
0,55 m nachgemessen — die Figur war in Ordnung, die Schwelle nicht.

## 6. Wallrun (Teil 5)

`tools/pruef/wandlauf.js`. 51 Anlaeufe mitgeschrieben, 14 greifen, 37
scheitern an zu niedrigen Waenden (richtig so), 0 an Tempo oder
Kleinteilen. Fusssohlen 0,087 m Mittelabstand zur Fassade.
**0 von 14 Anlaeufen fehlerhaft.**

## 7. Swing (Teil 6)

`tools/pruef/schwingen.js`. Anker, Fadenlaenge und Bogen stimmen. Ein
gemeldeter Fehler („Faden nicht an der Hand", 5.925 von 5.925 Bildern) war
**meiner**: Stuetzpunkt 0 des Netzfadens liegt am Anker, die Hand ist der
LETZTE Punkt. Nach der Korrektur: 0,15 m.

## 8. Locomotion / Foot Sliding (Teil 7)

`tools/pruef/fuss-rutschen.js`. Normale Gangarten rutschen wenig; die
**Duckgangarten rutschen mit 44,8 % dreimal so stark**. Der naheliegende
Versuch (`gangKontakt` auch fuer die Hocke einschalten) machte es
**schlechter** (60,5 %) und wurde zurueckgenommen. Ursache benannt: die
Duckclips brauchen eigene Kontaktschwellen. **Offen, bewusst.**

## 9. Jump / Fall / Glide (Teil 8)

`tools/pruef/sprung-gleiten.js`. **Kein Befund.** Zwei gemeldete Fehler
waren meine: „Doppelsprung bringt 2 cm" war in Wahrheit ein beginnender
Netzschwung (in der Luft ist die Leertaste zuerst der Schwung), gemessen
ueber dem Fluss ohne Anker ergibt er −15 → +10,6 m/s; und beim Fall aufs
Dach fiel die Testfigur *innen* durch das Haus, weil `groundY` keine
Daecher kennt.

## 10. Landing / Perch (Teil 9)

`tools/pruef/landung-hocke.js`. **Echter Befund:** die Kantensuche galt als
abgeschaltet, weil ein Dachkranz als Laterne durchging. Die
Groessenpruefung trennt jetzt bei 2,5 m — Ampelmast (0,52 m) und Laterne
(0,65 m) loesen die Masthocke weiter aus, auf dem Dach wird die Kante bei
1,55 m erkannt.

## 11. Combat Visuals (Teil 10)

`tools/pruef/kampf-optik.js`. **Kein Befund.** Die „riesigen weissen
Schlagboegen" des ersten Durchlaufs waren ein Artefakt meiner
Nahaufnahme-Kamera; aus der echten Spielkamera ist alles in Ordnung.

## 12. Civilian AI (Teil 12)

Umhaengegurt lag im Koerper — behoben (`3c1fc35`). Die beiden offenen
Punkte der Liste sind jetzt nachgeholt (`docs/PHASE13-TESTS.md`):
**ride vehicle/train funktioniert** (8 von 8 steigen ein und sitzen mit
0,00–0,63 m Abstand auf dem Sitz, 178 m Fahrt), **watch event gibt es
nicht** — die Rollen sind vollstaendig opfer/verletzt/taeter/fluechtig/
gefasst/boss, ein Zuschauer ist nicht gebaut. Bewusst nicht nachgeruestet.

## 13. Enemy AI

(Test D, siehe Punkt 23.)

## 14. Traffic (Teil 17, Teil 20)

60-Minuten-Lauf (`tools/pruef/verkehr-stunde.js`): die
**Vorfahrt-Verklemmung an der Uferstrasse** gefunden und behoben; die
Entscheidung steckt jetzt in der herausgeloesten Funktion
`querverkehrWarten`, die `tools/test-verkehr.cjs` wirklich durchrechnet.
Brueckenverkehr: von 0 auf **1,00 Durchfahrten je Minute** bei
`BRUECKEN_SOG = 0,2` — der kleinste Wert, der messbar wirkt.

## 15. Camera

Kein eigener Befund in dieser Phase. In Test C ueber alle 20 Uebergaenge
gemessen: **groesste Drehung in einem Bild 21 Grad** (auffaellig waere ab
etwa 60), **groesster Ortssprung 0,11 m**.

## 16. City Placement (Test E)

887 gesetzte Gegenstaende gegen 325 Flaechen und 875 Kanten des Gehnetzes:
**alle neun Flaechen frei.** Ein echter Befund (Ueberwege am Kartenrand,
siehe Punkt 2), vier Gruppen von Fehlmeldungen meines eigenen Pruefstands.

## 17. Glass / Interiors

Kein eigener Pruefteil in dieser Phase. Aus Test E mitgeprueft:
**Haustueren (Durchgang und 1,6 m Vorfeld) sind an allen 19 Baukasten-
Haeusern frei.**

## 18. Subway (Teil 19)

An allen 20 Zugaengen nachgelaufen (`03aecc8`). In Test E zusaetzlich:
**U-Bahn-Abgang und Aufzug frei.** Zugmitfahrt siehe Punkt 12.

## 19. Bridge (Teil 20)

Drei Befunde gefunden und behoben: kein Verkehr, Stufe im Gehweg,
Gelaender im Pylon. Nachgemessen: Gehweg ohne Stufe ueber die ganze Laenge
(groesster Sprung < 0,01 m), Handlauf in drei Stuecken neben den
Pylonbeinen, Gehwegbelag mit 38 Kachelwiederholungen statt einer
gestreckten.

## 20. Higgsfield Static Asset Audit (Teil 24)

`docs/MODELL-QUELLEN.md`: 7 Higgsfield-Objekte (Ampel, Laterne, Beet,
Bank, Muelltonne, Bahnhofsuhr, Kiosk), zusammen 11.625 Dreiecke, **null
Animationen und null Skelette** - sie beruehren den Helden-Rig nirgends.

**Freigabe: 7 von 7.** Der Auftraggeber hat die urspruengliche
Fuenfer-Grenze bei der Finalisierung ausdruecklich aufgehoben und alle
sieben Objekte namentlich freigegeben. **Das ist damit kein offener
Phase-13-Punkt mehr.** In Phase 13 wurde keine einzige neue Generierung
beauftragt; neue Generierungen bleiben gesperrt, und der ABSOLUTE
HERO-RIG LOCK ist davon unberuehrt.

## 21. GPU / FPS

Der Pruefstand rendert per Software (SwiftShader). **FPS-Angaben daraus
waeren wertlos**, deshalb Zeichenaufrufe und Dreiecke:

| Stand | Zeichenaufrufe | Dreiecke |
|---|---|---|
| ohne Entfernungsgrenze | 620 | 2.602.469 |
| mit `MOEBEL_SICHT = 235` | 616 | 2.520.070 (−3,2 %) |

Wichtig: die in Aufgabe #79 genannten 7,5 % waren **falsch** — mein
Pruefstand hatte gemessen, bevor `assets/haeuser.glb` geladen war (die
Datei kommt als letzte von rund 300 und erscheint erst nach etwa 3 s).
Korrigiert in `88504d3`.

## 22. 30-Minuten-Live-Test (Test A)

`tools/pruef/aktivspiel.js`, 108.000 Bilder nach Drehbuch, zwoelf
Abschnitte. **Alle 26 Punkte der Auftragsliste sind vorgekommen.**

| | Zahl | | Zahl |
|---|---|---|---|
| laufen | 39.243 Bilder | Wandlauf | 3.630 Bilder |
| sprinten | 16.787 Bilder | Wandsprung | 37 mal |
| springen | 238 mal | Dachhocke | 8.730 Bilder |
| schwingen | 1.095 Bilder | Kampf (Schlaege) | 62 mal |
| Netz wechseln | 82 mal | Netzschuss | 9 mal |
| Netz-Zip | 608 Bilder | Verbrechen erlebt | 16, davon 3 geloest |
| freier Fall | 3.127 Bilder | zivile Aktivitaet | 4 |
| gleiten | 2.799 Bilder | POI besucht | 7 |
| landen | 478 mal | U-Bahn (unter Tage) | 10.440 Bilder |
| Wandkontakt | 19.184 Bilder | Zugkontakt | 8.964 Bilder |
| klettern hoch | 14.604 Bilder | Fahrzeugkontakt | 1.123 Bilder |
| klettern runter | 2.500 Bilder | Stadtbezirke beruehrt | 16 |
| klettern seitlich | 2.000 Bilder | | |

Fuenfzehn Zeitreihen, 120 Messpunkte, je START/ENDE/MIN/MAX und eine
Regressionsgerade. **Kein Wachstumstrend in keiner Bestandsreihe** —
Szenenobjekte, Gegner, Zivilisten, Fahrzeuge, Ereignisse, Bosse,
Projektile, Netze, Marker, Aktivitaeten, offene Hygienefaelle,
Einsaetze und Lichter bleiben alle in ihrem Band.

JS-Fehler der Seite: 0. Unter dem Boden: 0 Bilder. Gestorben: 0.

### Drei Luecken im Pruefstand, keine im Spiel
* **Netz-Zip kam nie vor.** Einzeln nachgeprueft feuert derselbe Aufruf
  zuverlaessig, sobald die Figur Abstand vor der Fassade hat:
  `zipHaltepunkt` tastet einen Kegel ab, der erst bei 4 m beginnt. Wer
  mit gedruecktem W an der Wand klebt, hat nichts mehr darin.
* **Klettern seitlich und runter** standen auf null, weil die Figur
  EINMAL an die Wand gesetzt wurde und nach dem ersten Absturz unten
  blieb.
* **Kampf und Netzschuss** standen in einem von drei Laeufen auf null,
  weil gerade kein Verbrechen lief.

### Der Fail-Logger: 4.001 Meldungen, davon 97 Prozent richtige Haltungen
4.001 ist der Deckel (`POSE_LOG` nimmt 4.000 Eintraege) — die Reihe
wuchs also nicht, sie lief voll. Aufgeschluesselt nach Art, Zustand,
Clip und Knochen:

    beinZuHoch, Fuss ueber Huefte, Schwelle 0,15 m:
      sturzflug   n=1387   min 0,162   Median 0,743   max 0,744
      wandsprung  n= 124   min 0,194   Median 0,678   max 0,701
      fall        n=  40   min 0,272   Median 0,547   max 0,716

Ein Median beim Fuenffachen der Schwelle, der kaum streut, ist keine
Fehlerverteilung, sondern eine Pose. Nachgesehen im Bild aus der
Spielkamera (`tools/pruef/haltung-bilder.js`): Sturzflug, Wandsprung und
Wandkriechen sehen richtig aus. Drei Korrekturen **am Logger, keine am
Rig**: Ausnahmeliste fuer die Clips, in denen das angezogene Knie die
Bewegung ist; eigene Wandschranke fuer Kopf und Brust im Kriechen (0,95,
gemessen 0,878) bei unveraenderten 0,55 fuer die Huefte; und die
Dachhocke meldet einmal je Hocke statt in jedem Bild.

**Danach 150 Meldungen in 30 Minuten (5,0 je Minute).** Uebrig bleiben
Kopf und Brust in den Wandakrobatik-Clips (Median 0,718 / 0,596); die
Huefte kommt auf 4 Meldungen bei 0,558 bis 0,561 m, liegt also praktisch
immer an der Wand.

## 23. 60-Minuten-Test (Test B) und NPC-Hindernisse (Test D)

**Test B** (`tools/pruef/welt-stunde.js`): 60 Minuten, 120 Messpunkte,
Regressionsgerade je Reihe — kein Wachstumstrend. Steht in
`docs/PHASE13-TESTS.md`.

**Test D** (`tools/pruef/npc-wege.js`): 100 Zivilistenrouten und 100
Gegnerverfolgungen an neun schwierigen Orten, vor jedem Szenario der
Werkszustand der Figur wiederhergestellt (0 Ruecksetzfehler in 100
Szenarien).

| | Frage | Ergebnis |
|---|---|---|
| A | jemand IN einem Gebaeude | **0** |
| B | jemand unter der Bodenflaeche | **0** |
| C | dauerhaft haengengeblieben | **0** |
| D | Zivilist erreicht sein Ziel | 84 und 93 von 100 (zwei Laeufe) |
| E | alarmierter Gegner erreicht Spieler | 80 bis 83 von 100 |
| F | Ampelstopps (kein Fehler) | 50.520 Bilder |
| G | Bilder im Zug (kein Fehler) | 0 |

Laengster Stillstand 1,8 s (vorher 20 s). Verworfen wegen Ortssprung: 0.

Die Reste sind benannt, nicht nur gezaehlt: von den nicht angekommenen
Zivilisten waren 12 von 16 beziehungsweise 6 von 7 **auf der Flucht** —
eine Gang hatte sie von der Route gejagt. Bei den nicht erreichten
Verfolgungen waren in **17 von 17** Faellen weitere Gegner im Spiel;
sind mehrere auf den Spieler angesetzt, verteilt
`verteileAngriffsrechte` Plaetze im Ring, und wer keinen Platz hat, haelt
Abstand (kleinster Abstand im Median 6,0 m). Isoliert nachgefahren
erreicht derselbe Gegner denselben Spieler in 1,9 s.

Die Streuung zwischen den Laeufen (D 84 bis 93) ist echt: das Spiel
benutzt `Math.random`, der Seed steuert nur die Welt.

### Was Test D im Spiel gefunden hat
Genau **einen** Befund, und der ist behoben: das Gehnetz reichte weiter
als das erlaubte Gebiet. 29 der 728 Knoten — der ganze Brueckengehweg,
sechs Uferknoten, zwei Promenadenknoten — lagen im gesperrten Band, und
jede Figur wurde dort in jedem Bild zurueckgeschoben. Zu Fuss kam nie
jemand ueber den Fluss. Nach der Korrektur: 0 von 728 ausserhalb.

### Was Test D am Pruefstand gefunden hat
Vier Dinge, die wie Spielfehler aussahen und keine waren:
* Der Spieler wurde nie geheilt. Ist er tot, wirft `updateEnemies` jeden
  Gegner in jedem Bild zurueck auf `patrol` — ab dem Tod scheiterte jedes
  weitere Szenario. Die alten Zahlen (10, 12 und 41 von 100 bei gleichem
  Aufruf) sagten nur, wann der Spieler starb.
* Der Zustand des Gegners wurde NACH der eigenen Nachalarmierung
  aufgezeichnet — also die eigene Eingabe statt des Spiels.
* Der Ortssprung ueber mehrere hundert Meter war der Geiselauftrag, der
  sich bei einer einelementigen Zivilistenliste immer die Testfigur
  holte.
* Alle Faelle in Frage C standen auf `hurt`: eine Gang hatte sie
  niedergeschlagen, und wer getroffen wird, liegt 40 bis 60 Sekunden.

## 24. Act-1-Human-Playtest (Test F / Teil 21)

**Gemacht.** Der Auftraggeber hat Akt 1 selbst durchgespielt. Genau
dafuer war dieser Punkt vorgesehen: ein Bot kann alle acht Missionen
durchklicken, aber nicht beurteilen, ob das Ziel verstanden wird und ob
die Kette aus Anfahrt, Kampf und Abschluss traegt.

**Rueckmeldung aus dem Durchlauf — ein Punkt, und der sitzt:**

> Mission 6 „Das Versteck" ueberzeugt nicht, weil es **kein richtiges
> Versteck** ist. Erwartet wird, in ein Gebaeude hineinzugehen und dort
> drinnen das Versteck der Gegner vorzufinden.

Das trifft zu. Die Mission waehlt heute ueber `stPoi(...)`
beziehungsweise `stOrt(...)` einen **offenen Platz** in der Stadt und
setzt drei Gangwellen darum herum; ein Innenraum kommt darin nicht vor.
Der Auftragstext verspricht „Das Versteck erreichen" und „Den Innenhof
raeumen" - geliefert wird ein Stueck Strasse.

Was dafuer schon da ist (gemessen, nicht vermutet):

* **19 begehbare Innenraeume** in den Baukasten-Haeusern (`KIT_INNEN`),
  Median 140 m² Grundflaeche, der groesste 19 × 15 m.
* **19 Haustueren** mit echtem Durchgang - die Fassadenkollision hat an
  der Tuer eine Luecke, Test E prueft „Haustuer (Durchgang)" und
  „Haustuer (Vorfeld)" seit dieser Phase auf Freigaengigkeit.
* Die Gegnerwahrnehmung prueft bereits **freie Sicht**
  (`siehtSpieler` → `freieSicht`), eine Wand unterbricht den Blick also
  schon heute.

Die Umsetzung war **nicht** Teil dieses Berichts: sie ist eine
Spielaenderung und war vom Auftraggeber fuer diesen Nachtrag
ausdruecklich ausgeschlossen.

**Nachtrag — inzwischen umgesetzt.** Der Auftraggeber hat die Aenderung
danach ausdruecklich beauftragt. Mission 6 spielt jetzt im Innenraum:
Anfahrt, Eingangswache, durch die echte Haustuer, Innenraumkampf, Geisel,
Funker, Verfolgung, Hinterhalt, Anfuehrer. Kein zweites Missionssystem —
dieselben Storyphasen, dieselbe Gegner-KI, dieselben Kontrollpunkte. Was
gemessen wurde und was dabei gefunden wurde, steht in
`docs/MISSION6-VERSTECK.md`. **Der Human Playtest der neuen Fassung ist
noch nicht gemacht** — diese Zeile bleibt erst dann vollstaendig.

## 25. Save / Progression Regression (Teil 22)

`tools/pruef/spielstand.js`. **Echter Befund:** der Weltkeim fiel beim
Laden nie auf den Vorgabewert zurueck, weil die untere Schranke bei 1 statt
0 lag. Behoben. Alles Uebrige (Punkte, Stufe, besuchte POI, Missionsstand,
Migration alter Staende) haelt.

## 26. UI / Touch (Teil 23)

`tools/pruef/touch-bedienung.js`. **Zwei Knoepfe waren 42 px statt 44 px** —
behoben. Ein zweiter Versuch (die Knopfreihen vom Daumenstick wegwickeln)
verbesserte die Messung, machte das **Bild aber deutlich schlechter**
(Treppenmuster ueber den halben Schirm) und wurde zurueckgenommen. Steht
als Kommentar in `index.html`, damit es niemand noch einmal probiert.

## 26b. Kernsysteme (technische Regression)

`tools/pruef/kernsysteme.js`, sieben Bereiche in einem Lauf:

| | Bereich | Ergebnis |
|---|---|---|
| 1 | Story Akt 1 | 8 Missionen gestartet, 8 sauber beendet, 17 Phasen, 0 haengengeblieben |
| 2 | Ereignisregie | 1 gestartet, 1 geloest, Aufraeumfehler 0, Leck 0, offen nach Aufraeumen 0 |
| 3 | Boss-Lebenszyklus | erzeugt, besiegt, Bossliste leer, Verweis `bossAktiv` geloest |
| 4 | Polizei und Rettung | 2 Einsaetze (1 Polizei, 1 Rettung), beide angekommen und erledigt, 3 gesichert, 1 versorgt, ohne Haltepunkt 0, Leck 0 |
| 5 | Welthygiene | `floatingDowned` 0, `invalidProp` 0, `npcStaticPenetration` 0, `enemyStaticPenetration` 0, `climbSurfaceGap` 0, `wallrunFailed` 0 |
| 6 | Fortschritt | Aktivitaetenleck 0 |
| 7 | Stadtmoebel | 7 Felder, 469 Stueck |

JS-Fehler der Seite: 0.

`bridgePropInvalid` steht auf 4 und ist **kein** Fehler, sondern ein
VERHINDERT-Zaehler: vier Promenadenmoebel waeren in den Brueckenbereich
gefallen und wurden beim Bauen abgelehnt.

### Drei BEFUNDE dieses Pruefstands gehoerten dem Pruefstand
* **Boss.** Der Test rief `d.bossEntfernen()` — die Funktion gibt es im
  Testfenster nicht, im Spiel nimmt sie zwei Argumente. Auch der zweite
  Anlauf (Spieler weit weglaufen lassen) konnte nicht greifen: der
  Abbauzweig verlangt `e.bossNachEvent`, und ein mit `spawnBoss`
  gesetzter Boss ist der AKTIVE — ein aktiver Boss wird nicht abgebaut,
  und das ist richtig so. Alle vier Blockier-Zaehler standen auf null;
  genau daran war es zu sehen. Jetzt wird er besiegt, wie im Spiel.
* **Polizei und Rettung.** Der Test rief `d.respTest()` — gibt es nicht.
  Es wurde nie etwas ausgeloest, und "Aufraeumfehler 0, Leck 0" war eine
  Aussage ueber ein Nichtereignis.
* **Die Zaehler selbst.** `respStatistik()` gab das lebende Objekt
  zurueck. Wer sich den Stand vorher merkt und hinterher die Differenz
  bildet, hielt zweimal dasselbe Objekt in der Hand und mass ueberall
  null. Gibt jetzt eine Kopie zurueck, wie `bossStatistik` seit jeher.

## 27. Bestehende Tests

    node --check game.js city-visuals.js menu.js     sauber
    cd tools && node --test                          141 Tests, 141 gruen
    git diff --check                                 sauber

Neu in dieser Phase: `test-bruecke.cjs` (8), `test-verkehr.cjs` (7) und
`test-testfenster.cjs` (Doppelschluessel im `__dbg`-Objekt), dazu 25
Browser-Pruefstaende unter `tools/pruef/`.

### Vollregression nach der letzten Aenderung
Alle Zahlen sind **neu gelaufen**, nicht aus frueheren Abschnitten
uebernommen.

| Pruefstand | Ergebnis |
|---|---|
| `node --check` game.js / city-visuals.js / menu.js | sauber |
| `cd tools && node --test` | 141 Tests, 141 gruen |
| `git diff --check` | sauber |
| Test A `aktivspiel.js` (30 min) | alle 26 Punkte vorgekommen, kein Wachstumstrend, 0 JS-Fehler, Fail-Logger 150 |
| Test B `welt-stunde.js` (60 min) | kein Wachstumstrend, Lecks 0, Fehler 0, Kollider konstant 1932 |
| Test C `uebergangsmatrix.js` | 20 von 20 Uebergaengen erreicht |
| Test D `npc-wege.js` | A 0, B 0, C 0, D 84–93/100, E 80–83/100 |
| Test E `freigang.js` | alle neun Flaechen frei, 0 Pfade gesperrt, alle 728 Netzknoten im Gebiet |
| `kernsysteme.js` | sieben Bereiche, alle ok, Seitenfehler 0 |
| `verkehr-stunde.js` (60 min) | 14.400 Proben: neben der Fahrbahn 0, im Wasser 0, im Haus 1, Ortssprung 0, Geisterfahrer 0 |
| `bruecke-gehen.js` | 10 Spuren, 0 fehlerhaft |
| `wandlauf.js` | 0 von 14 Anlaeufen fehlerhaft, Fuesse 0,087 m Mittelabstand |
| `wandkriechen.js` | 0 Richtungen fehlerhaft, **0 Meldungen des Fail-Loggers** |
| `landung-hocke.js` | 0 von 7 Landungen fehlerhaft |
| `schwingen.js` | 0 von 6 Fluegen fehlerhaft, 31 Anker, alle an einem Bauwerk |
| `sprung-gleiten.js` | Kette Sprung → Sturzflug → Gleiten → Boden vollstaendig |
| `spielstand.js` | 0 Pruefungen fehlerhaft |
| `touch-bedienung.js` | 0 Pruefungen fehlerhaft |
| `fuss-rutschen.js` | siehe Abschnitt 8 und `docs/DUCKGANG-MESSUNG.md` |

## 28. Verworfenes / bewusst nicht geaendert

| Was | Warum zurueckgenommen |
|---|---|
| `gangKontakt` fuer Duckgangarten | Fussrutschen wurde schlechter: 44,8 % → 60,5 %. Beide Zahlen sind inzwischen als ungueltig erwiesen (siehe unten) |
| `GANG_REF` von `kriechen` anheben | Vier Werte durchgemessen (0,85 / 0,70 / 0,57 / 0,45): **jeder** ist schlechter, im Median UND im groessten Einzelruck |
| `gehBegehbar`-Aenderung | **exakt null** Wirkung, Zahlen bis auf die Stelle gleich |
| Touch-Knopfreihen umbrechen | Messung besser, Bild deutlich schlechter |
| Raeumliche Buendelung der Stadtmoebel | +89 Zeichenaufrufe, 0 Dreiecke gespart |
| Netzreduktion der Modelle | Ampel 3.424 → 2.054 bei 20 % Fehler, Bank unveraendert |
| Aufteilen von `game.js` in Module | Auftrag verbietet es; kein Modulsystem, kein Bauschritt, Tests schneiden per Textmarke, und kein Befund ging auf die Dateigroesse zurueck |
| `__dbg` auslagern | Laeuft im Spiel ohnehin nie (Testschalter); spart Ladezeit, nicht Laufzeit — 42 kB gegen einen zerbrechlicheren Pruefstand |
| Zuschauer bei Ereignissen nachruesten | Phase 13 ist eine Pruefphase; ein neues Zivilistenverhalten waere ein Feature, kein Befund |

## 29. Geaenderte Dateien / Assets

    game.js              +495 / -44 Zeilen (jetzt 32.719)
    city-visuals.js      15 Zeilen
    index.html           18 Zeilen
    docs/                5 neue Notizen (ARCHITEKTUR, BEWEGUNGS-MATRIX,
                         HIGGSFIELD-KLETTERN, MODELL-QUELLEN, PHASE13-TESTS)
    tools/pruef/         22 Pruefskripte + README
    tools/               anim-matrix.mjs, moebel-vereinfachen.mjs,
                         test-bruecke.cjs, test-verkehr.cjs
    Assets               KEINE neuen. Keine Higgsfield-Generierung,
                         keine neuen Modelle, keine neuen Clips.

## 30. Noch offene sichtbare Probleme

1. **Fussrutschen von `kriechen` (99 %)** — gemessen, Ursache benannt,
   kein Fix uebernommen. Die alte Zahl 44,8 % fuer „die Duckgangarten"
   war ungueltig: das Abgrenzungsverfahren sah bei `kriechen` einen
   einzigen Kontakt ueber 3,37 Cliplaengen und rechnete den gesamten Weg
   der Figur als Rutschen. Mit dem zweiten Mass liegen `ducken` (26,3 %)
   und `schleichen` (30,0 %) im Bereich von Sprinten (26,5 %) — sie sind
   **kein Befund**. Uebrig bleibt `kriechen` mit 99 %: der Fuss steht
   ueberhaupt nicht auf. Das laesst sich mit diesem Clip nicht durch eine
   Zahl beheben, sondern nur durch eine andere Animation oder Fuss-IK —
   beides gehoert nicht in eine Pruefphase. `docs/DUCKGANG-MESSUNG.md`.
2. **Mission 6 „Das Versteck" ist kein Versteck** — **im Human Playtest
   gefunden, anschliessend behoben.** Die Mission spielte auf einem
   offenen Platz, obwohl der Auftragstext einen Unterschlupf verspricht.
   Sie spielt jetzt im Innenraum eines der 19 begehbaren Haeuser, mit
   Eingangswache, echter Haustuer, Innenraumkampf, Geisel, Funker,
   Verfolgung und Hinterhalt — in denselben Storyphasen, ohne zweites
   Missionssystem. `docs/MISSION6-VERSTECK.md`, Abschnitt 24.
   **Offen bleibt nur eines:** der Human Playtest der neuen Fassung.
3. **Die Namensnennung fuer `haeuser.glb` ist im Spiel nicht sichtbar** —
   die Herkunft ist geklaert (zwei Saetze von Daniel Zhabotinsky auf
   Sketchfab, CC Attribution, siehe `docs/MODELL-QUELLEN.md`), und CC
   Attribution verlangt die Nennung von Urheber und Quelle. Im Repository
   steht sie; CITY SWING hat aber noch keine Stelle, an der sie fuer die
   Spielenden auftaucht — Titelbild, Menue oder eine Danksagungsseite.
4. **Verfolgung an langen Hindernissen** — ein Gegner verfolgt in
   Luftlinie mit 3,6 m Vorausschau und benutzt das Gehnetz nicht. Am
   Brueckengelaender laeuft er deshalb daneben her statt herum (gemessen:
   Umweg 31,6 bei 28,7 m Luftlinie). Ein Fix hiesse, die Verfolgung auf
   das Gehnetz umzustellen — ein neues System.
5. **Kein Zuschauerverhalten bei Ereignissen** — Luecke, kein Fehler.
6. **Das Repository heisst weiter `Spider-man`** — die URL
   `salman-7300.github.io/Spider-man/` passt nicht zum Titel CITY SWING.
   Umbenennen kann nur der Besitzer (Settings → General → Rename).
7. *(erledigt)* Akt 1 ist durchgespielt — siehe Abschnitt 24. Was dabei
   herauskam, steht als Punkt 2 dieser Liste.
