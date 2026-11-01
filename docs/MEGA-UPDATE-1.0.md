# CITY SWING – Mega-Update 1.0: Living City & Superhero Experience

Ausgangsstand: `e05d424` (Branch `claude/spider-man-game-dev-8cepen`).
Dieses Dokument hält fest, was in den sechs Paketen gebaut wurde, wie es
geprüft ist und was ausdrücklich offen bleibt. Abnahmeunterlagen
(Videos, Bilder, Messungen, Testanleitung): `docs/abnahme-mega-1.0/`.

---

## 0. Grundsätze

* **Kein zweites System.** Die neuen Abläufe hängen in den vorhandenen
  Systemen: Ereignisregisseur (`EV`), Einsatzkräfte (`RESP`),
  Kampf, Fortschritt (`PROG`), Missionsinnenraum, Klang (`SFX`/`MUSIK`).
* **Gesperrt** bleiben Held (Rig, Skinning, Basisanimationen, Gleiten,
  Klettern samt Überhang-Fix, Naht, Außenecke, Top-out, Kletterkamera,
  Kamera-Fade), Stadt (110 Blöcke, Straßen, Gebäude, Bezirke, Markierungen,
  Fassaden, 962 Stellplätze, 575 Parkautos, 80 Verkehrsfahrzeuge,
  88 Passanten, Street-Details) und Story (Akt 1, acht Missionen,
  Mission-6-Innenraum, Checkpoints). Kein Akt 2.
* **Eigener Zufallsstrom.** `Math.random` ist der Stadtstrom; an ihm hängt
  der Fingerabdruck der Welt. Alles Neue würfelt mit `MEGA_ZUFALL`
  (xorshift, Keim = Weltkeim XOR `0x6d656761`). Wo vorhandene Bausteine
  selbst würfeln (`spawnGang`, three.js-UUIDs, Wegwahl der Passanten), läuft
  der Aufruf in `MEGA_ZUFALL.klammer(...)`, die `Math.random` solange auf den
  eigenen Strom umstellt. Gemessen: Weltfingerabdruck nach jedem Paket
  identisch mit `e05d424` (Häuser/Hindernisse, Parkautos, erste 45 Wagen,
  88 Passanten).
* **Bekannte Fehler bleiben getrennt**: Kletterkontakte an
  Modellüberhängen, Brutal_1-Kernkante, ModernOffice_1-Nachbarspalt,
  schneller Wandgriff, Dachkronen-Griff, fliehende Passanten im Helden,
  Brücken-Flucht, bestehende Stadtfehler. Wo ein Prüfbot an einem davon
  hängen blieb, ist das als Bot-Grenze vermerkt, nicht korrigiert.

---

## 1. M1 – Dynamische Verbrechen und lebendige Stadtereignisse

### 1.1 Aufbau

Vier Abläufe im vorhandenen Regisseur: drei neue Arten in `EV_ARTEN`
(`laden`, `autodieb`, `dachrettung`) und der erweiterte Verkehrsunfall.
Jeder Ablauf führt eine Phase (`e.phase`) und protokolliert jeden Wechsel
mit Zeit in `e.phasen`:

| Phase | Bedeutung |
| --- | --- |
| `verborgen` | angelegt, der Spieler weiß noch nichts |
| `entdeckt` | gehört (Alarm, Hilferuf, Knall) oder gesehen – Regeln wie bisher (`evPruefeEntdeckung`) |
| `annaeherung` | der Spieler ist unterwegs |
| `intervention` | der Spieler ist da und greift ein |
| `eskalation` | die Lage kippt: Flucht, Abrutschen, Rauch |
| `hauptziel` | das eigentliche Ziel ist erreichbar |
| `abschluss` | Ziel erreicht, `evEnde` |
| `nachphase` | Polizei, Rettungsdienst, Dank – dann `evAufraeumen` |

Nicht jede Phase kommt in jedem Lauf vor: wer den Autodieb vor dem
Einsteigen stoppt, erlebt keine Verfolgungsjagd; wer die Person auf dem Dach
vor dem Abrutschen erreicht, keine Eskalation.

Die **Ereignisbremse** gilt unverändert: höchstens ein großes Ereignis
(Laden und Autodieb sind Schwere 2), höchstens zwei gleichzeitig,
Taktbremse `EV_ZIEL_AKTIV`, Ruhephasen nach jedem Ende. Bei vollen Straßen
(`EV_GEGNER_MAX`) kommen nur noch Ereignisse ohne zusätzliche Gegner
(Unfall, Dachrettung). Ein Autodiebstahl entsteht nicht neben dem
Fluchtauto-Auftrag, nicht während einer Storymission und nicht, solange
ein anderer Wagen flieht; umgekehrt würfelt der Auftrag kein zweites
Fluchtauto, solange einer flieht.

**Taste C** war „erste Hilfe“. Sie bleibt die eine Taste für alles, was man
mit der Hand tut (`interagieren()`): Person sichern, Tür aufreißen, Beute
abgeben – erst wenn nichts davon in Reichweite ist, erste Hilfe wie bisher.
Unten in der Mitte erscheint ein Hinweis („C Person sichern“), sobald etwas
geht (auch für erste Hilfe). Gamepad-Taste 8 und der Touch-Knopf rufen
dieselbe Funktion.

### 1.2 Die Abläufe

**A – Geschäftsüberfall (`laden`).** Ort: eine Ladentür aus den
Erdgeschossen von Stufe 8A (`BI.liste`, Programm Laden/Café/Flagship/
gemischt; 2,6 m vor der Tür muss freier Gehweg sein). Drei Räuber
(`spawnGang`, Rollen flink/Schläger/Werfer): zwei bewachen den Inhaber in
der Tür (ein Passant aus der Nähe, mit `geisel`), einer steht Schmiere zur
Straße; die Alarmglocke läutet (bis 95 m hörbar). Greift der Spieler ein
(unter 22 m), wehren sich die Bewacher; sobald einer am Boden ist, der
Beuteträger getroffen wird oder 8 s vergehen, rennt der Träger mit dem
Beutesack los (vorhandene Flucht: Moral, `eventFlucht`, Polizei kommt nach
3 s). Gestoppt (Netz, k.o., gefasst) fällt der Sack; wer ihn aufhebt und dem
Inhaber zurückbringt (Nähe oder C), schließt ab: +150 und Ruf +4 zusätzlich
zur Ereignisbelohnung, der Inhaber jubelt. Kommt niemand, gehen die Räuber
nach 65 s mit der Beute.

**B – Autodiebstahl und Verfolgungsjagd (`autodieb`).** Ein Wagen im
Verkehr bleibt auf seiner Spur stehen (nicht vor einer Kreuzung), ein Dieb
macht sich an der Bordsteintür zu schaffen, ein zweiter steht Schmiere, die
Alarmanlage heult. Kommt der Spieler auf 24 m heran, hat er 1,8 s: wer den
Dieb in dieser Zeit mit Netz oder Schlag erwischt, verhindert die Jagd.
Sonst steigt er ein (er ist dann aus `enemies` herausgenommen und
unsichtbar – am Steuer sitzt die vorhandene Fahrerfigur) und fährt mit der
vorhandenen Fluchtwagen-Logik (`car.flucht`) los; die vorhandene Autojagd der
Polizei hängt sich selbst an. Drei Treffer stoppen den Wagen: Schlag am
Wagen oder Landung auf dem Dach (Regel des Fluchtauto-Auftrags) oder ein
Netzschuss (Q) auf den Wagen. Dann springt der Dieb heraus und flieht zu
Fuß. Entkommt der Wagen (85 s Jagd oder 6 s weiter als 230 m), scheitert
das Ereignis; der Wagen fährt danach normal weiter.

**C – Dachrettung (`dachrettung`).** Jemand steht an der Kante eines
Dachs (14–46 m, Auswahl wie die vorhandene Aktivität „Jemand kommt nicht
weiter“, aber an der Kante, mit freiem Fallraum bis zur Straße davor und
ohne Dachaufbau am Standplatz) und ruft um Hilfe. Die Person ist einer der
88 Passanten, für die Dauer der Rettung versetzt. Kommt der Spieler auf
45 m heran (oder nach 30 s), rutscht sie ab und hängt an der Kante: 18 s
Halt. Wer hinkommt (Netz-Zug zur Kante, klettern, Dach), sichert sie mit C
und trägt sie am Netz (sichtbarer Faden, die Person hängt darunter) auf die
Straße – abgesetzt wird nur auf Straßenhöhe. Wer zu spät ist, kann sie im
Fall noch fangen (bis 9 m fängt das Netz von selbst, +120). Schlägt sie
unten auf, ist sie verletzt – dann gilt die vorhandene erste Hilfe oder der
Rettungsdienst. Nach der Rettung schaut der Rettungsdienst nach ihr
(Nachkontrolle). Bleibt sie auf dem Dach, geht sie heim, sobald niemand
hinsieht.

**D – Unfall mit eingeklemmtem Fahrer (`unfall`, erweitert).** Der
vorhandene Unfall (Wagen steht, ein Verletzter, Rettungsdienst nach 6 s)
bekommt einen zweiten Teil: im Wagen sitzt der Fahrer fest (ein Passant,
unsichtbar im Wagen; keine sichtbare Fahrerfigur), der Motor qualmt
(Rauchwolken, wiederverwendet). Am Wagen reißt C die Tür auf; der Fahrer
liegt dann verletzt daneben und braucht erste Hilfe (steht der
Rettungswagen schon da, nimmt er ihn mit auf die Liste). Wer zu lange
braucht, sieht den Rauch dicker werden (Eskalation, 30 s), danach befreit
ihn der Rettungsdienst. Abschluss, wenn beide versorgt sind.

### 1.3 Polizei und Bevölkerung

Alles über vorhandene Wege: Polizei bei Flucht (`respPruefeFlucht`) und für
gesicherte Täter (`respAnfordern`), Autojagd mit Sirene, Rettungsdienst bei
Verletzten (`respPruefeVerletzte`) und als Nachkontrolle bei der
Dachrettung, Zuschauer an Einsatzstellen (`respZuschauer`), Flucht der
Passanten vor Kämpfen (vorhandene Gefahrenerkennung), Jubel von Inhaber und
Geretteten. Es werden keine Passanten erzeugt: Inhaber, Person auf dem Dach
und Fahrer sind vorhandene Passanten, die vorher weder Rolle noch Begleiter
haben und vom Spieler nicht gesehen werden, wenn sie versetzt werden.

### 1.4 Prüfstand und Ergebnisse

`tools/pruef/mega-ereignisse.js` (Bot in `tools/pruef/mega-bot.js`) spielt
jeden Ablauf mit echten Eingaben – W/A/D/Shift über `d.taste`, Linksklick =
`tryAttack('punch')`, Q = `webShot`, E = `webZip`, Leertaste = `tryJump`,
C = `interagieren`. Abgekürzt werden nur die Anreise (Start 30–40 m vor dem
Ort, auf der Straße) und bei der Verfolgung das Mithalten (der Held wird
dem Wagen 10 m hinterher nachgeführt; die Treffer fallen echt). Alle 0,5 s
werden die sechs harten Fehler gezählt (`__dbg.mega.hart()`).

Lauf auf Keim 4711 (`fall=alle`, Endstand):

| Fall | Ausgang | Dauer | Phasen |
| --- | --- | --- | --- |
| Ladenüberfall | gelöst | 29,7 s | verborgen › entdeckt › annäherung › intervention 2,0 › eskalation 5,4 › hauptziel 5,7 › abschluss 6,5 › nachphase 27,9 |
| Autodieb mit Jagd | gelöst | 10,0 s | … › intervention 2,9 › eskalation 5,0 (Jagd 3,1 s, Netztreffer) › hauptziel 8,0 › abschluss 9,5 |
| Autodieb direkt gestoppt | gelöst | 5,1 s | … › intervention 2,9 › hauptziel 3,2 (keine Jagd) › abschluss 4,8 |
| Dachrettung | gelöst | 4,2 s | … › eskalation 0,8 › intervention 1,5 (Netz-Zug zur Kante, C) › hauptziel 1,5 › abschluss 4,0 (vom Dach gesprungen, abgesetzt) |
| Unfall mit Fahrer | gelöst | 30,6 s | … › intervention 3,4 › eskalation 16,5 (Rauch) › hauptziel 27,7 (Tür auf) › abschluss 30,4 (beide versorgt) |

Harte Fehler in allen Fällen 0: hängengebliebenes Ereignis, doppelte
Figuren (zwei Ereignisse, doppelt in einer Liste, versteckt und sichtbar),
blockiertes Fahrzeug (Ereignisrest oder Fluchtwagen ohne Besitzer), Marker
ohne Ereignis (Leuchtturm, Zielanzeige, Beutesack, Netzfaden, Rauch),
Gegner/Passanten nach dem Aufräumen noch gebunden, Fahrzeuge in Häusern.
Nach jedem Fall: 88 Passanten, keiner mit Rolle; kein Wagen mit Rolle;
Polizei und Rettung angefordert, angekommen, erledigt.

Freier Lauf (`fall=dauer`, 15 min, Regisseur und Aufträge frei, der Held
läuft nur herum): siehe Abschnitt 1.5.

### 1.5 Leistung, Regression

| Messung | `e05d424` | nach M1 |
| --- | --- | --- |
| Zeichenaufrufe, Median über 300 Stellen (`stadt-leistung.js`) | 861 / 860,5 (zwei Läufe) | 863,5 – Straße 792,5, Dach 790,5, Luft 894 (vorher 793 / 790 / 894,5); Tor < 899 gehalten |
| Zeichenaufrufe Maximum | 2414 | 2413 |
| CPU je Simulationsschritt, freier Regisseur, 6 min, beide Stände gleichzeitig (`m1/cpu.js`) | 6,78 ms (Median 6,60, p90 8,20) | 6,41 ms (Median 6,42, p90 7,29) |
| Weltfingerabdruck (Hindernisse, Parkautos, 45 Wagen, 88 Passanten) | 910b52f4 / 46a47dc7 / d96ebb1b / 2edb351f | identisch |
| `kernsysteme.js` (Story Akt 1, Ereignisregie, Boss, Polizei/Rettung, Hygiene) | 8/8, alles ok | 8/8, alles ok; Valid-Zähler kritisch 0 |
| `node --test` | 170/170 | 170/170 |

Die Zeichenaufrufe ändern sich nicht: M1 baut nichts Festes in die Szene.
Beutesack, Netzfaden und Rauch entstehen erst beim ersten Gebrauch und
werden danach nur ein- und ausgeblendet. Der Unterschied im Gesamtmedian
(+2,5) liegt in der Streuung eines Laufs mit Wagen und Passanten (±3–4
laut Prüfstand) – je Lage sind die Werte gleich. Die CPU-Zeit liegt
gleichauf (der Ereignismix unterscheidet sich; im Referenzlauf liefen mehr
Ganoven herum).

### 1.6 Grenzen und offene Punkte

* Bot-Grenzen (keine Spielfehler, im Prüfstand gezählt): der Bot läuft
  geradeaus und weicht nur einfach aus; er geht nicht in U-Bahn-Abgänge
  (fällt er hinein, wird er zurückgesetzt); bei der Verfolgung schwingt er
  nicht, sondern wird nachgeführt. Für die Dachrettung werden fremde
  Straßenganoven in 90 m Umkreis entfernt, weil der Netz-Zug (E) zuerst
  einen Gegner im Kegel nimmt; an Fassaden mit Vordach bleibt der Bot beim
  Klettern hängen (bekannter Kletterrandfall) und zieht dann erneut.
* Die erste Hilfe (vorhanden) prüft keine Höhe: man kann aus einem
  U-Bahn-Abgang heraus helfen. Unverändert gelassen.
* Bei der Dachrettung hängt die Person in der Jubel-Haltung (Arme hoch) an
  der Kante; eine eigene Hängebewegung für Passanten gibt es nicht.
