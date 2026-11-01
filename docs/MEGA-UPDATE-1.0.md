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

---

## 2. M2 – Combat 2.0

Alles im vorhandenen Kampf: Treffer über `damageEnemy`, Flug über
`geworfen`, Einspinnen und Haften über `applyWeb`/`naheWand`, Bewegungen des
Helden nur aus seinem Bestand (`kick`, `luftangriff`). Am Rig, an der Haut,
an den Clips und an der Kletter- und Kamerasteuerung ändert sich nichts.
Für den Vergleich schaltet `window.__WEBHERO_KAMPF_ALT` (Prüfstand:
`kampfAlt`) alle M2-Teile aus.

### 2.1 Wand-Finisher (Web Wall Finish)

Q am Boden, ein angeschlagener Gegner direkt vor dem Helden (taumelt, drei
Treffer in Folge oder unter 40 % Leben) und hinter ihm innerhalb von 6,5 m
eine **echte, feste Wand**: das Netz reißt ihn hinüber (Tritt-Bewegung des
Helden, Netzfaden), er schlägt ein und wird mit dem dritten Netz dort
festgeheftet – über die vorhandene Wandhaftung von `applyWeb`, die die Wand
selbst noch einmal prüft. Einschlag: 30 Schaden, Hitstop 0,13 s,
Kamerawackeln, leichter Kameraimpuls, Netzspritzer, Staub, Mutverlust in
der Nähe, +150 (+10 je Kombotreffer).

„Echt“ heißt: vom Gegner aus in Schlagrichtung (alle 0,3 m) ein Gebäudeteil,
mindestens 3 m hoch über seinen Füßen und breiter als ein Mast. Steht
vorher etwas Kleines im Weg (Bank, Kiosk, Laterne, Parkauto, Vordach unten),
gibt es **keinen** Wandabschluss – dann ist Q der normale Netzschuss
(Rückfall). Kommt der Gegner unterwegs nicht an (abgelenkt, gebremst), zählt
der normale Aufprall.

### 2.2 Luft-Finisher (Aerial Finisher)

Nach dem Aufwärtshaken in der Luft: F (Tritt) mit einem Gegner in der Luft
daneben (bis 3,8 m) und laufender Luftkombo schmettert ihn schräg nach unten
(`luftangriff`, 30 Schaden, Hitstop 0,12 s, Kameraimpuls, +140 und mehr je
Luftkombo). Beim Aufschlag läuft eine Druckwelle durch die Umstehenden
(3,5 m: Schaden, Taumeln, Rückstoß, Angriffe brechen ab). Der Held federt
kurz nach oben und bleibt in der Bewegung. Ohne Luftkombo bleibt F der
normale Sprungtritt.

### 2.3 Rollentaktik im Kampfregisseur

Die Plätze auf dem Ring um den Helden verteilte `verteileAngriffsrechte`
schon gleichmäßig. Jetzt bekommt jede Rolle ihren Platz zur Blickrichtung
des Helden: der **Flinke flankiert von hinten** (und bekommt dort beim
Angriffsrecht Vorrang – der vorhandene Spinnensinn warnt), der **Wächter
stellt sich vorn auf** (er deckt die anderen), der Brecher kommt schräg von
vorn, Schläger füllen die Seiten, der Werfer bleibt auf Abstand. Gezogen
wird weiter auf dem Ring.

Beim Messen fiel ein vorhandener Fehler der Kampfleitung auf: es schlugen
gelegentlich drei Nahkämpfer gleichzeitig zu, obwohl höchstens zwei dürfen
(`KAMPF_GLEICHZEITIG`). Drei Ursachen, alle an der Kampfleitung behoben
(mit `KAMPF_ALT` wie vorher):
1. Die Flankenregel übersprang einen Gegner, der gerade schon zuschlug,
   wenn er neben dem ersten Angreifer stand – sein Platz ging an einen
   Dritten. Laufende Angriffe behalten jetzt ihr Recht.
2. Wer mitten im Angriff aus der Anwärterliste fiel (Mut weg, Rückzug,
   Netz), belegte seinen Platz nicht mehr. Er zählt jetzt mit.
3. Konter nach einer Parade und Fortsetzung einer Kombo starteten ohne
   Blick auf die Zahl der Angreifer. Sie warten jetzt, wenn schon zwei
   zuschlagen.

### 2.4 Rückmeldung

Hitstop und Kamerawackeln wie bisher (`hitstop`, `camShake`), dazu ein
leichter Kameraimpuls: höchstens 2,6° Bildwinkel für 0,3 s. Er wird vor
`updateCamera` abgezogen und danach neu gesetzt, damit er sich nicht im
Nachziehen des Bildwinkels aufsummiert.

Nicht gebaut: der optionale **Web Pull Counter**. E zieht schon heute zum
Gegner (Zip-Angriff); ein zweites Verhalten auf derselben Taste wäre ohne
eigene Bewegung des Helden nicht sauber zu lesen.

### 2.5 Prüfstand und Ergebnisse

`tools/pruef/mega-kampf.js` – echte Eingaben, gestellte Ausgangslage:

| Teil | Ergebnis |
| --- | --- |
| Wand-Finisher an 6 Ladenfronten (drei Schläge, dann Q) | 6/6 an die Wand geheftet, Netzstufe 3, 0,4–0,9 m vor der Front, 0,6–1,1 m über dem Boden, Kameraimpuls 0,99 |
| Freie Kreuzung, keine Wand dahinter | Rückfall: normaler Netzschuss (Netzstufe 1), kein Wandabschluss |
| Luft-Finisher (Haken R, Leertaste hinterher, Schlag, F) | ausgelöst, Druckwelle trifft den zweiten Gegner, Held landet |
| Rollentaktik, 4 Runden à 30 s je Keim, fünf Rollen, Held schaut fest nach vorn | Keim 4711: Flinker im Kampf hinten 87 % (ohne 36 %), Wächter vorn 52 % (ohne 28 %), Flinker 20 Angriffe, davon 17 von hinten (ohne 23/8); Keim 2024: 70 % (ohne 28 %), 65 % (ohne 33 %), 19/15 (ohne 13/5); Bilder mit drei Nahkämpfern im Angriff 0 (vor der Korrektur 0,6 %) |
| CPU je Schritt im Kampf | 6,0–7,6 ms mit, 6,2–7,4 ms ohne (Streuung, kein Mehraufwand) |

Bilder: `docs/abnahme-mega-1.0/m2-wand-finisher.jpg` (zwei Fronten,
Spielkamera und Seitenansicht – der Gegner hängt im Kokon an der Fassade),
`m2-luft-finisher.jpg` (Ablauf in vier Bildern).

Regression nach M2: `mega-ereignisse.js` 5/5 gelöst, harte Fehler 0;
`kernsysteme.js` alles ok (Story 8/8, Boss, Polizei/Rettung, Hygiene);
`node --test` 170/170; Weltfingerabdruck identisch. Zeichenaufrufe
unverändert (M2 baut nichts in die Szene).

### 2.6 Grenzen

* Die Wandhaftung setzt den Gegner (wie schon die vorhandene) vor die
  Kollisionsfläche. Wo ein Erdgeschoss tiefer liegt als die Fassade darüber
  (Arkaden, Ladenfront), hängt er vor der Flucht der oberen Fassade.
* Im Prüfstand werden die Gegner mit viel Leben gestellt (400), damit der
  Abschluss geprüft wird und nicht, wie schnell der Gegner fällt.

---

## 3. M3 – Cinematic Movement & Parkour Flow

Neue Bewegungsqualität nur an den **Übergängen** zwischen vorhandenen
Bewegungen. Schwingen, Springen, Klettern und Gleiten rechnen wie vorher;
gemessen ist ein Ablauf ohne Zip-an-die-Wand (Sprint, Sprung, Schwung,
Loslassen, Landung, 420 Bilder) mit und ohne M3 **bitgleich**, mit
identisch vielen Zufallszügen. Code: Block „M3: Bewegungsfluss“ in
`game.js` plus Ein-Zeilen-Haken in `zipZuPunkt`, Zug-Ende, Zug-Wandkontakt,
`stopSwing`, perfektem Absprung, Wandsprung, Wandlauf vom Boden und im
Anklettern aus der Luft. Schalter für Vorher/Nachher im Prüfstand:
`window.__WEBHERO_FLUSS_ALT` (`starte(..., { flussAlt: true })`).

Unberührt: Gleitpose und Gleitphysik, Kletterhaut, Überhang-Fix,
Kamera-Fade, Hochziehen (Top-out), Eckbogen, Naht, Wandkollision.

### 3.1 Schwung → Netz-Zip → Weiterbewegung

Geprüft wurden alle sechs Punkte aus dem Auftrag; gemessen mit
`tools/pruef/mega-bewegung.js teil=kette` (8 Fassaden × 3 Verzögerungen
nach dem Loslassen, Leertaste halten → loslassen → E, W gehalten):

| Punkt | Befund vorher | M3 |
| --- | --- | --- |
| Geschwindigkeit | Zug startet mit `max(16, Tempo)` und zieht auf bis 40 m/s – trägt den Schwung | unverändert (keine Beschleunigung ohne Aktion) |
| Animationsblend | **Handruck 0,85 m in einem Bild** beim Zugbeginn: die Schusshaltung (`poseSchuss`) griff im ersten Zugbild mit voller Stärke, die Clipgewichte waren stetig | Schusshaltung blendet über 0,08 s ein: Arm-Ruck Median 0,64 → 0,13 m, kein Fall schlechter als vorher |
| Kamera | Winkeländerung beim Übergang 2–6° je Bild (Kletterkamera beim Angreifen) | unverändert |
| Zielwahl | Ziel immer an einem echten Haus (24/24), mindestens 2 m über der Figur | unverändert |
| Netzanbindung | Faden an der Hand, straff | unverändert |
| Landung / neu schwingen | nach dem Absprung im Fenster sofort wieder Schwung möglich (6/6, 0,03 s) | unverändert, perfekter Absprung zählt jetzt für den Fluss |

Abstimmung der Blende (zweite und letzte Korrekturrunde für diesen
Befund): 0,05 / 0,08 / 0,12 s lagen gleichauf, 0,18 s war schlechter
(0,75 m). **Während eines Saltos** greift der Arm weiter sofort: dort dreht
sich der ganze Körper, und die Blende war in 32 Stichproben schlechter als
der harte Wechsel (Median 0,36 statt 0,28 m) – deshalb dort abgeschaltet
(`megaZipArm`, im Prüfstand nachgewiesen: 5/5 Züge im Salto ohne Blende).

Vorbestehend und **nicht** verändert (alt und neu identisch):
Fußruck bis 0,58 m, wenn der Zug direkt aus einer Landung beginnt (der
Bodenausgleich fällt beim Abheben weg); ein Sprung der linken Hand
(0,85 m) im Clip `zip_zug` selbst; der Haltungswechsel beim Angreifen an
der Wand (0,37 m, wie beim gewöhnlichen Anklettern aus der Luft).

### 3.2 Netz-Zip → Wandlauf

Vorher: Endete ein Zug an einer Fassade, griff die Figur nur mit
gehaltenem W und dann **mit Tempo 0** – der Schwung war weg, sie kroch
die Wand hoch. Ohne Taste fiel sie herunter.

Jetzt: Endet ein Zug (ohne Gegner, nicht an einer Laterne) an genau dem
Haus, auf das er zielte, greift die Figur dort an – über **denselben
Einstieg** wie beim Anklettern aus der Luft (`wandTraegt`,
`ankletternVonAussen`, `kletterOwnerSetzen`, Kletterhaut zurücksetzen).
Gegriffen wird nur, wo die Kollision die Figur ohnehin an die Wand gelegt
hat; keine unsichtbare Fläche, keine eigene Wandsuche. Der Schwung des
Zugs wird Wandlauf – mit der Formel des Anlaufs vom Boden
(Tempo zur Wand × 1,15, 8 bis 14). Liegt die Dachkante schon in
Griffweite (≤ 2,5 m), übernimmt sofort das vorhandene Hochziehen.
Wer mit S von der Wand weg lenkt, wird nicht festgehalten.

| Messung (`teil=wand`, Zug von der Straße 18/26/34 m) | vorher | M3 |
| --- | --- | --- |
| mit W: angegriffen / Wandlauf / Hochziehen | 8 / 3 / 4 | 7 / 6 / 6 |
| mit W: Median Zeit bis aufs Dach | 4,9 s | **2,2 s** |
| ohne Taste: angegriffen | 0 | 2 (beide mit Wandlauf) |
| Abstand zur echten Kollisionsfläche beim Angreifen | ≤ 0,65 m | ≤ 0,65 m |
| mit S: Angreifen am Haus des Zugziels | 0 | 0 |
| nach Schwung (`teil=kette`): Zug → Wand mit > 2,5 m Wand darüber | 0 Wandlauf | 2/2 Wandlauf, 6 Fälle direkt Hochziehen |

### 3.3 Dachparkour

Eine Vault-Animation gibt es nicht; deshalb wird nichts überklettert, was
keine Bewegung dafür hat. Die neue, getestete Kette nutzt nur vorhandene
Bewegungen und den Übergang aus 3.2:

**Sprint über Dach A → Absprung an der Kante → Netz-Zip an die Fassade des
höheren Hauses B → Wandlauf → Hochziehen → auf Dach B weiter.**

`teil=dach` sucht selbst Paare (Dach A, Straße 7–24 m, Haus B 3–18 m
höher, nichts dazwischen) und läuft sie mit echten Tasten
(W + Shift, Leertaste 1,7 m vor der Kante – viele Dächer haben dort eine
0,2 m hohe Brüstung –, E acht Bilder später, W gehalten):

| | vorher | M3 |
| --- | --- | --- |
| Dach B erreicht | 3/6 | 3/6 |
| Median Zeit Absprung → Dach B | 5,0 s | **2,2 s** |
| Ablauf | Zug, Griff mit Tempo 0, Kriechen, Hochziehen | Zug, Wandlauf (37–38 Bilder), Hochziehen |

Die drei anderen Paare enden auch vorher nicht auf Dach B (Hochziehen auf
einen anderen Teil des Hauses bzw. Hängenbleiben unter der Dachkrone –
bekannter Kletterrandfall „Dachkronen-Griff“, nicht verändert).

### 3.4 Flow-Belohnung

Verschiedene Bewegungen ohne Pause hintereinander ergeben am Ende der
Kette einen kleinen Punktebonus über das vorhandene Punktesystem
(`addScore` → Punkte, Stufen, Fertigkeitspunkte) und zählen im
Fortschritt (`PROG.statistik.flowKetten`, `besterFlow`; alte Spielstände
bekommen 0).

* **Aktionen**: Schwung (ab 0,5 s am Faden), Netz-Zip, perfekter Absprung,
  Wandlauf, Wandsprung, Hochziehen, Landung (nach mehr als 0,7 s Luft),
  Sprint (0,6 s), Dachsprung (Dach zu anderem Dach, > 5 m), Gleiten (1 s).
* **Nur echte, verschiedene Aktionen**: jede Art zählt einmal je Kette;
  dieselbe Taste noch einmal hält die Kette nur am Leben.
* **Ende**: 2,5 s ohne flüssige Bewegung, 0,8 s Stillstand, 40 s
  Höchstdauer oder alle zehn Arten. Ein Treffer reißt die Kette ohne Punkte.
* **Bonus** ab drei Arten: 20 / 35 / 50 / 70 / 90 / 110 Punkte (×
  Ruf-Faktor). Danach 8 s Sperre. Zum Vergleich: Erste Hilfe 120.
* **Anzeige**: klein rechts unter der Minikarte – während der Kette ab
  zwei Aktionen „×n · letzte Aktion“, nach der Gutschrift 2,6 s „+P FLOW
  ×n“. Keine Einblendung in der Bildmitte, kein Text in der Welt; das DOM
  wird nur bei Änderung angefasst.
* **Kein Einfluss auf die Physik**: der Takt liest Zustand und Tempo nur;
  der Ton und die Gutschrift laufen über `MEGA_ZUFALL.klammer`, damit auch
  der Rauschpuffer des Tons den Stadtstrom nicht verschiebt.

| Prüfung (`teil=fluss`) | Ergebnis |
| --- | --- |
| echte Kette (Schwung, Zug, Wand, Hochziehen, Landung …) | genau eine Gutschrift, 41 Punkte, Anzeige „+41“ |
| zehnmal Schwung/Loslassen | Kette höchstens 2, keine Punkte |
| zweite Kette direkt nach einer Gutschrift | gesperrt, keine zweite Gutschrift |
| Treffer während der Kette | gerissen, 0 Punkte |
| Physik ohne Zip→Wand alt/neu | bitgleich |
| Schalter alt | zahlt nie |

### 3.5 Prüfstand, Bilder

* `tools/pruef/mega-bewegung.js [teil=alle|kette|trick|neuschwung|wand|abweisen|dach|fluss]`
  – je Teil zwei frische Browser (alt/neu), 21 Prüfungen, Exit 1 bei
  Fehler. Letzter Lauf: 21/21.
* `tools/pruef/mega-bewegung-bilder.js <ordner>` – vier Momente der
  Dachkette mit Spielkamera und HUD plus Seitenansicht des Wandlaufs.
* `docs/abnahme-mega-1.0/m3-dachkette.jpg`,
  `docs/abnahme-mega-1.0/m3-wandlauf-seite.jpg`.

### 3.6 Regression und Leistung

Verglichen mit dem M2-Stand `f0f92ee` (eigener Arbeitsbaum, gleiche
Prüfstände, gleicher Keim):

| Prüfstand | Ergebnis |
| --- | --- |
| `kletterproxy.js`, `kletterstetigkeit.js`, `zeilenuebergang.js` (Naht), `wandlauf.js` | Ausgaben **bitgleich** zu M2 (Klettern, Haut, Naht, Wandlauf ohne Zip) |
| `uebergangsmatrix.js` | bricht auf M2 und M3 identisch ab (der alte Prüfstand setzt einen Kletterzustand ohne Wand) – keine Abweichung |
| `kernsysteme.js` | alles ok (Story 8/8, Ereignisse, Boss, Polizei/Rettung, Welthygiene, Fortschritt) |
| `mega-ereignisse.js` | 5/5 gelöst, harte Fehler 0 |
| `mega-kampf.js` | Wand-Finisher 6/6, Rückfall, Luft-Finisher ok; Rollentaktik mit exakt denselben Werten wie beim M2-Commit |
| `node --test` | 170/170 |
| Weltfingerabdruck | identisch (Hindernisse, Parkautos, Wagen, 88 Passanten) |
| Szenengraph | identisch zu M2 (1169 Objekte, 5329 Meshes, 3 Lichter) – M3 baut nichts in die Szene, die Zeichenaufrufe sind damit unverändert |

CPU je Simulationsschritt (gepaart, beide Stände gleichzeitig, aber unter
Volllast durch parallel laufende Prüfstände und Videoaufnahme): Median
8,70 ms (M3) gegen 8,18 ms (M2), bei derselben Ereignisfolge. Das ist bei
dieser Last nicht belastbar; der M3-Takt liest nur Zustand und Tempo
(eine Kolliderabfrage je Bild, nur auf Dächern). Eine Wiederholung auf
ruhiger Maschine steht im M4-Abschnitt.

Noch nicht wiederholt (laufen beim Commit noch): `schwingen.js`,
`topoutlandung.js`, `gleitflug.js` – Ergebnis im M4-Abschnitt.
