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
* **Der Ton würfelt nicht im Stadtstrom (seit M6).** Bis M5 füllte jeder
  Rauscheffekt seinen Puffer aus `Math.random`, und schon der erste Effekt
  legte den Klangkontext an – auch ohne Klick. Seit M6 würfelt der Ton mit
  einem eigenen Generator (`KLANG_ZUFALL`) und beginnt erst mit dem Klick
  auf „Spielen“. Die Ausgangswelt ändert das nicht (Fingerabdruck
  identisch). In Prüfläufen ohne Klick verlaufen Kämpfe und Wege aber ab
  dem ersten Effekt anders als bis M5; Vergleiche „vorher/nachher“ laufen
  deshalb gegen M5 mit ebenso isoliertem Klangzufall (Arbeitsbaum „M5k“,
  nur diese eine Änderung) – siehe 6.7.
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

Nachtrag nach dem Commit: `schwingen.js`, `topoutlandung.js` und
`gleitflug.js` sind ebenfalls **bitgleich** zum M2-Stand. Die
CPU-Wiederholung auf ruhiger Maschine steht in 4.4: M3 und M4 zusammen
kosten gegenüber M2 keine messbare Zeit.

---

## 4. M4 – Begehbare Orte

Zwei optionale Orte nach dem Prinzip des Missionsinnenraums aus
Mission 6: ein eigener Raum weit außerhalb der Stadt, kontrollierter
Ein- und Austritt mit derselben Blende (2 × 0,13 s), die Außenwelt pausiert
unverändert (`MISSION_INTERIOR.active`), dieselbe Kamera, dieselbe
Kollision. **Kein zweites Innenraumsystem**: der Missionsinnenraum kennt
jetzt mehrere Räume (`innenRaum(id)`); das Versteck aus Mission 6 bleibt
Raum `hideout` und wird genau wie vorher gebaut (ohne Klammer um den
Zufall, Mission 6 würfelt danach weiter wie bisher). Beginnt eine
Innenraumphase von Mission 6, während der Held in einem M4-Ort steht, geht
es zuerst hinaus.

### 4.1 Die Orte

| | Eckmarkt (Laden) | Kai 7 Bürohaus (Lobby) |
| --- | --- | --- |
| Raum | 16 × 14 m, Decke 3,8 m, Ursprung (1100, 0, 1000) | 22 × 16 m, Decke 4,2 m, Ursprung (1200, 0, 1000) |
| Einrichtung | L-förmige Theke mit Kasse und Kartenleser, Rückregal, zwei offene Regalreihen mit Kopfregalen, Wandregal, Kühlregale mit Glastüren und Flaschenreihen, Zeitungsständer, Fußmatte, Schriftzug „ECKMARKT“, Milchglasfront | Empfangstresen mit Bildschirm und Schriftwand „KAI 7 · BÜROHAUS“, Wartebereich (zwei Sofas, Tisch, Zeitschriften, Teppich), vier Arbeitsplätze mit Bildschirmen, Stühlen und Trennwänden, Drucker, Wasserspender, zwei Aufzüge, Pflanzen, Fensterband |
| Personen | Inhaber hinter der Theke, zwei Kunden (Regal, Kühlregal) | Empfang, Mitarbeiterin am Schreibtisch (sitzend), Besucher im Wartebereich (sitzend) |
| Handlung | **Inhaber ansprechen**: volle Gesundheit (alle 2 Minuten), sonst ein Satz | Empfang ansprechen (in M5 Start der Nebenreihe) |
| Zeichenaufrufe drinnen | 91–92 | 71–73 |

Waren, Flaschen, Bildschirme und Blätter sind je Raum EINE Geometrie mit
Eckfarben (ein Zeichenaufruf). Die Waren stehen in festen Reihen und
Familien (eine Warengruppe je Regalboden, gleiche Größe, Farbwechsel in
Dreiergruppen) – keine zufälligen Würfel. Licht: ein Halbkugellicht und
sieben Punktlichter wie im Versteck; drinnen sind die Weltlichter aus,
die Räume teilen sich damit die schon übersetzten Shader.

### 4.2 Eingang, Ausgang, Personen

* **Eingang**: eine echte Tür der Stadt. Türen gibt es nur an den
  prozeduralen Häusern (Erdgeschosse aus Stufe 8A; gemessen 65
  Büro-Erdgeschosse, keines mit Tür). Der Eckmarkt liegt hinter einer
  Ladentür, die Lobby hinter der Tür eines Hauses mit gemischter Nutzung.
  Gewählt wird fest (die geeignete Tür nächst der Stadtmitte, die
  Bürotür mindestens 40 m entfernt), mit freiem Gehweg davor. Über der
  Tür eine kleine warme Lampe, auf der Minikarte ein Türsymbol. Betreten
  nur zu Fuß davor mit **C** („Eckmarkt betreten“), nicht im
  Vorbeilaufen, nicht während einer Storymission, nicht mit Gegnern in
  15 m Umkreis. Die Ladentür ist vom M1-Überfall ausgenommen.
* **Ausgang**: im Raum an der Tür mit **C** („Hinausgehen“). Der
  Austrittspunkt wird erst beim Hinausgehen geprüft – gegen genau den
  Zustand von draußen: kein Haus, kein Wasser, kein Hindernis (auch kein
  Parkauto), kein Wagen im Umkreis von 3,2 m; sonst wird längs der
  Fassade ausgewichen (bis 4,8 m).
* **Personen**: echte Zivilistenmodelle mit festem Aussehen (`ziviLook`,
  Nummern außerhalb der Straßenpassanten), Bewegungen `idle` und
  `sitzen` (Becken auf Sitzhöhe über `sitzMasse`). Sie hängen in der
  Raumgruppe, entstehen beim ersten Betreten im eigenen Zufallsstrom und
  werden nur aktualisiert, solange der Raum aktiv ist. Die 88
  Straßenpassanten bleiben unberührt.
* Der Hinweis unten in der Mitte wird im Raum aus dem Orts-Takt
  aufgefrischt (draußen hängt er am Ereignistakt, der drinnen pausiert).

### 4.3 Prüfung

* `tools/test-orte.cjs` (node --test, 17 Tests): Felder, genau eine
  Bodenfläche, geschlossene nicht kletterbare Wände und Deckel, Start/
  Ausgang/Handlungspunkte frei, Wege frei, stehende Figuren frei und
  sitzende auf einem Möbel in Sitzhöhe, jedes sichtbare Teil im Raum,
  Lichtaufbau wie im Versteck, keine Überlappung mit Versteck und Stadt.
* `tools/pruef/mega-innen.js` (30 Prüfungen, echte Eingaben W und C):

| Teil | Ergebnis |
| --- | --- |
| Türen | Eckmarkt (−189,2 / 186,4, Wohngebiet), Kai 7 (−85,6 / 100,9, Mischgebiet), Gehweg frei, Lampen |
| Besuch je Ort | Hinweis an der Tür, Blende 0,27 s, Start frei und auf dem Boden, Kamera im Raum und unter der Decke, 3/3 Figuren sichtbar, Handlungspunkt erreicht (Inhaber: Gesundheit 40 → 100), Hinweis am Ausgang, draußen frei (kein Haus, kein Hindernis, kein Wagen) |
| Außenwelt | drinnen angehalten (Wagen, Passanten, Ereignisse identisch), danach läuft sie weiter |
| 20 Besuche im Wechsel | 0 Fehler; Räume, Kollider, Figuren, Geometrien, Texturen unverändert |
| Sperren | Storymission: kein Hinweis; Gegner in der Nähe: Betreten abgelehnt; Wagen vor der Tür: Austritt 4,8 m versetzt |
| 40 s Bot je Raum | nie außerhalb, nie im Möbel, nie unter dem Boden, Kamera nie hinter einer Wand oder über der Decke |

Bilder (Spielkamera mit HUD): `docs/abnahme-mega-1.0/m4-laden.jpg`
(Tür mit Lampe und Hinweis, Laden nach dem Betreten, Inhaber an der Theke,
Regalgang), `m4-buero.jpg` (Tür, Empfang, Wartebereich, Arbeitsplätze);
erzeugt mit `tools/pruef/mega-innen-bilder.js`.

Erster Spielbefund und Korrektur: im Spiel waren die Regale zunächst
leer – die gebündelte Warengeometrie stand in Raumkoordinaten ohne
Verschiebung an den Ursprung (in der Vorschau lag der Ursprung bei 0/0).
Korrigiert und mit einem eigenen Test abgesichert.

### 4.4 Regression und Leistung

**Befund und Korrektur im eigenen Zufallsstrom.** Der Szenengraph-
Vergleich mit M2 und M3 (gleicher Keim, je zweimal, je Stand
reproduzierbar) zeigte nach 30 Bildern 14 von 88 Passanten an anderen
Stellen. Ursache: three.js vergibt jedem Material, jeder Geometrie und
jedem Objekt beim Anlegen eine Kennung aus `Math.random`
(`generateUUID`). Zwei Lampenmaterialien wurden außerhalb von
`MEGA_ZUFALL.klammer` angelegt und haben den Stadtstrom um acht Züge
verschoben – genau das, was die Regel „keine globalen Zufallszüge“
verhindern soll. Korrigiert (alles in der Klammer); danach sind alle 88
Passanten nach 30 Bildern identisch zu M3, der nächste Zufallswert ist
gleich, und im Szenengraph unterscheiden sich nur die zwei Türlampen
(2 Gruppen, 4 Meshes). Gegenprobe: eine um 20 kB größere `game.js` bzw.
`mission-interiors.js` ändert nichts – es war kein Ladezeiteffekt.

| Prüfung | Ergebnis |
| --- | --- |
| Weltfingerabdruck | identisch (Hindernisse, Parkautos, 45 Wagen, 88 Passanten) |
| `tools/pruef/mega-innen.js` | 30/30 (nach der Korrektur wiederholt) |
| `node --test` | 187/187 (170 + 17 neue in `test-orte.cjs`) |
| `mission6.js` (Teile 1–3) | 26/26 betretbar und verlassbar, Sicht durch Wände 0 von 312, Spawns 520 gültig. Zwei Läufe je Stand: auch M2 schwankt (einmal 25/26, einmal 26/26) und die Hof-Spalte wechselt von Lauf zu Lauf – Bot-Streuung, keine Abweichung durch M4 |
| `interior.js` (Versteck) | alles wie M2: Ein-/Austritt 0,27 s, Weltpause, 3600 Bilder Dauerlauf ohne Fehler, Kamera, 50 Zyklen, Kontrollpunkt/Tod/Abbruch, Geisel; einzig „sichtbare Szenenobjekte draußen“ +2 (die Lampen) |
| `kernsysteme.js` | alles ok (Story 8/8, Ereignisse, Boss, Polizei/Rettung, Hygiene, Fortschritt) |
| Zeichenaufrufe, 300 Stellen, `stadt-leistung.js ruhig` | Median 610 gegen 612 (M2), Maximum 1677 gegen 1675 – die Lampen kosten nur dort zwei bis vier Aufrufe, wo man sie sieht |
| CPU je Schritt, freier Regisseur, 4 min, beide Stände gleichzeitig auf ruhiger Maschine (`m1/cpu.js`) | Median 6,02 ms (M3+M4) gegen 6,08 ms (M2), Mittel 5,93 gegen 6,18 ms, bei derselben Ereignisfolge (ENFORCER, Dachrettung, Überfall) |

Vor der Korrektur lief die CPU-Messung mit einer anderen Ereignisfolge
(der verschobene Strom) und ergab Median 6,16 gegen 5,94 ms – ein
Vergleich zweier verschiedener Spielabläufe, kein Mehraufwand.

Außerdem: Die Hilfe und die Kurzzeile nennen für C jetzt „Handeln“
(Verletzten helfen, Tür mit Lampe betreten oder verlassen, Person
ansprechen); die Touch-Taste heißt „Handeln“ statt „1. Hilfe“.

### 4.5 Grenzen

* Beide Türen liegen am Rand der Innenstadt (Wohn- und Mischgebiet), weil
  nur die prozeduralen Häuser Türen haben. Lampe und Kartensymbol helfen
  beim Finden.
* Die Innenwelt passt nicht geometrisch in das Außenhaus (wie beim
  Versteck gewollt).
* Draußen vor der Ladentür stehen oft Parkautos am Bordstein; man geht
  vom Gehweg aus hinein.

---

## 5. M5 – Nebenreihe „Die Schatten der Stadt“

Drei verbundene Nebenaufträge um eine Bande, die Lieferungen am Kai
abfängt und Zeugen einschüchtert. Sie beginnen am **Empfang im Kai 7**
(der begehbare Ort aus M4): dort „Auftrag annehmen“, nach einer
Unterbrechung „Weitermachen“. Akt 1 bleibt unberührt, Akt 2 bleibt zu.

**Kein zweites Missionssystem.** Die Aufträge laufen im Storyläufer
(`storyStarte`, `storyPhaseAuf`, `storyTakt`, `storyEnde`,
`storyAufraeumen`) mit demselben Phasenformat, denselben Helfern
(`stGang`, `stFunk`, `stNah`, `stAlleGangsTot`, `stGeflohenAufraeumen`),
denselben Kontrollpunkten und demselben Auftragsslot
(`MISSION.art = 'story'`). Damit gilt alles, was Akt 1 schon schützt,
auch hier: im Kampf keine neuen Weltereignisse, keine Hygiene an
Auftragsgegnern, kein Innenraum ohne Ausgang. Getrennt ist nur die
Ablage (`PROG.neben` statt `PROG.story`) und die Zählung
(`NEBEN.statistik` statt `STORY.statistik`).

### 5.1 Die drei Aufträge

| | I · Die Spur | II · Der Zugriff | III · Der Anführer |
| --- | --- | --- | --- |
| Frei | sofort | nach I | nach II |
| Ort | Geschäftsviertel | Lagerhof am Kai (Ufer) | Platz im Park |
| Phasen | Ort erreichen · drei Spuren mit C untersuchen (Marken, Leuchtturm zur nächsten) · den Beobachter finden (steht im Eingang, Leuchtturm, Funkbeschreibung) – ab 14 m flieht er, Netz (Q) oder Niederringen stellt ihn, er ergibt sich · seine zwei Leute abwehren | Lagerhof erreichen · Torwache ausschalten (ohne einen Treffer: +60) · in den Hof vordringen · Bande aus fünf Mann besiegen, einer davon Elite · Koffer sichern (C) | Treffpunkt erreichen · drei Leibwächter · Mini-Boss SCHATTEN |
| Scheitern | K.o. · mehr als 140 m vom Einsatz weg · der Beobachter entkommt (70 s oder 95 m) | K.o. · Hof verlassen | K.o. · Treffpunkt verlassen |
| Belohnung | 300 Punkte, Ruf +4 | 450 Punkte, Ruf +6 | 800 Punkte, Ruf +9 (dazu 400 für den Boss) |
| Hinweis danach | „Ein Lagerhof am Kai …“ | „Frachtpläne und ein Name – SCHATTEN“ | „Die Leitstelle übernimmt …“ |

Jede Phase hat ein Ziel in der Auftragszeile und einen **blauen**
Leuchtturm (Akt 1 bleibt orange) auf dem Ort, der Spur, dem Beobachter
bzw. dem nächsten Gegner; dazu kurze Funksprüche. Gescheitert heißt:
alles wird aufgeräumt, der Kontrollpunkt bleibt auf genau der Phase,
und am Empfang geht es dort weiter. Abbrechen (zweimal J) räumt auf und
löscht den Kontrollpunkt.

### 5.2 Mini-Boss SCHATTEN

SCHATTEN ist ein Boss im vorhandenen Gerüst – `machBoss`, `updateBoss`,
Angriffsbuch mit Vorwarnung, Phasen an der Lebensleiste, Bossleiste,
Parade, Netzbalken, Spinnensinn und Konter. Neu ist nur ein **Profil**
(`BOSS_PROFILE.schatten`); der ENFORCER ist jetzt das Standardprofil und
liest dieselben Tabellen wie vorher.

* **Rolle:** der Anführer, der nie dort steht, wo man ihn erwartet.
  Schmaler und schneller als der ENFORCER (Größe 1,14, Tempo 5,0), 360
  statt 520 Leben, weicht öfter aus (40 %), blockt seltener.
* **Eigene Kombination:** Stich, Doppelschlag, Fegetritt (schwer, lange
  Vorwarnung, danach 0,9 s offen); ab Phase 2 Sprungangriff, ab Phase 3
  Wirbel (drei Schläge). Vorwarnzeit in keiner Phase unter dem
  1,0-Fachen.
* **Besondere Mechanik – der Rauchsprung:** Vorwarnung 0,85 s (× Phase):
  er duckt sich, Rauch steigt auf, ein Zischen; beim ersten Mal ein
  Hinweis. Dann ist er 0,55 s im Rauch – nicht zu sehen, nicht zu
  treffen, das Netz geht ins Leere – und taucht 2,4 m **hinter** dem
  Helden auf (nur auf freiem Boden auf Heldenhöhe, nie im Haus; sonst
  schräg dahinter oder seitlich; ohne Platz kein Sprung) mit einem Stich,
  der wieder vorgewarnt wird: der Spinnensinn zeigt die Richtung,
  rechtzeitiges Ausweichen kontert. Abklingzeit 5,5 / 4,5 / 3,5 s je
  Phase, ab Phase 2 häufiger. Wer ihn **bedrängt** (drei Treffer in
  1,6 s), dem entwindet er sich genauso – sobald die Abklingzeit es
  erlaubt; aus dem Netz heraus nie.
* **Schwäche:** in den 0,8 s nach dem Auftauchen bringt ein Netz (Q) ihn
  aus dem Tritt – „Aus dem Rauch gerissen“: 2,6 s eingesponnen und
  taumelnd, Deckung und Standfestigkeit auf null, Treffer zählen
  1,4-fach (die vorhandene Netzregel). Das ist das Erholungsfenster; der
  Hinweis „Jetzt – Netz (Q)!“ erscheint bei den ersten beiden
  Auftritten.
* **Sieg:** Lebensleiste leer → er liegt wie jeder Gegner, die
  Bossleiste verschwindet, der Auftrag endet sauber. Er zählt **nicht**
  als ENFORCER (Statistik und Meilensteine bleiben).
* **Aussehen:** dasselbe Ganovenmodell, größer, mit der vorhandenen
  Ausrüstung der Duellanten; der Qualm ist ein eigener kleiner Vorrat
  (vierzehn Sprites, ein gezeichneter dunkler Farbverlauf) – der helle
  Unfallrauch aus M1 hob sich auf grauem Asphalt kaum ab und bleibt, wie
  er war. Nichts geladen, keine fremden Modelle.
* **Leuchtturm:** im Kampf mit SCHATTEN wird er ausgeblendet, sobald man
  näher als 20 m ist – der halbtransparente Zylinder verdeckte sonst
  alles Transparente in seinem Inneren, also gerade den Qualm der
  Vorwarnung.

### 5.3 Einbindung

* **Konflikte:** ein Auftragsslot – während eine Storymission läuft,
  lässt die Tür des Kai 7 niemanden hinein und der Empfang nimmt nichts
  an; während ein Nebenauftrag läuft, bietet Akt 1 nichts an und J fragt
  nur nach dem Abbruch. J nimmt weiter zuerst die Geschichte an; ein
  unterbrochener Nebenauftrag wird mit J nur fortgesetzt, wenn Akt 1
  gerade nichts anbietet. Keine Nebenmission schreibt in `PROG.story`,
  keine setzt ein Storyflag. Ein umherlaufender ENFORCER wird beim
  Auftritt von SCHATTEN dem Lebenszyklus übergeben (nie zwei Bosse).
* **Orte:** je Auftrag ein fester Ort aus Weltkeim und Kennung (eigener
  kleiner Zufallsgenerator), mindestens 80 m vom Kai 7, in den
  gewünschten Stadtteilen, rundum frei für den Kampf. Derselbe Stand
  findet ihn nach dem Neuladen wieder.
* **Aufbau bei Ankunft:** Kampfphasen stellen ihre Gruppe erst auf, wenn
  der Held 45 m heran ist – nach einem Wiedereinstieg am Empfang steht er
  ja noch im Kai 7. Bis dahin zeigt der Leuchtturm auf den Ort.
* **Sichtbar und erreichbar:** der Hof liegt „hinter dem Tor“ mit freier
  gerader Strecke dorthin, der Beobachter steht mit freier Sicht vom
  Spurenort aus – man soll ihn sehen und direkt hinkommen (Befund aus dem
  Prüfstand: ein Hof hinter einem Haus war nur über einen Umweg
  erreichbar).
* **Der Kampf bleibt am Kampfort:** die Ganoven-KI jagt Passanten, sobald
  der Held außer Sicht ist – im Prüfstand lief ein Elite-Wächter der
  Hofbande 400 m weit und die Phase wartete auf ihn. Wer sich mehr als
  22 m vom Kampfort entfernt, ohne zu fliehen, kommt zurück auf den
  Helden; wer über 60 m weg ist, ist aus dem Kampf (dieselbe Regel wie
  `stGeflohenAufraeumen` für Flüchtende). SCHATTEN selbst bleibt immer am
  Helden.
* **Zufall:** alle Gruppen, der Boss, Rauch, Marken und Koffer entstehen
  in `MEGA_ZUFALL.klammer` – auch die three.js-Objekte (die Lehre aus M4).
* **Ergeben:** der gestellte Beobachter und die ausgeschaltete Torwache
  ergeben sich (die vorhandene Ergebung `policeCustody` aus
  `stInnenAufgeben`) – sonst stünden sie nach dem Netz wieder auf und
  zählten in der nächsten Phase als Gegner (Befund des ersten
  Prüfstandslaufs).
* **P-Ansicht:** unter der Geschichte ein Abschnitt „Nebenaufträge · Die
  Schatten der Stadt“ (erledigt, läuft, unterbrochen, offen, gesperrt).
  Am Kai 7 kommt einmal je Sitzung ein Funkhinweis auf den Empfang.

### 5.4 Speicherstand

`SAVE_VERSION` 3 → 4. Neu ist `neben: { fertig, checkpointId,
checkpointPhase, flags }` und der Zähler `statistik.nebenAuftraege`.
Ein alter Stand wird gehoben, ohne etwas zu verlieren (Punkte, Ruf,
Fertigkeiten, Geschichte samt Kontrollpunkt, Statistik); die Nebenreihe
beginnt dann offen. Beim Laden wird bereinigt: nur bekannte Kennungen,
keine Dubletten, ein Kontrollpunkt nur für einen offenen Auftrag und nur
mit einer Phase, die es gibt. Der Abschluss wird sofort geschrieben, ein
Kontrollpunkt im normalen Takt (höchstens 30 s) – wie bei Akt 1.

### 5.5 Prüfung

`tools/pruef/mega-neben.js` – 72 Prüfungen mit echten Eingaben (Tasten,
Schläge, Q, C, J, Enter). Abgekürzt wird nur die Anreise zu einem
Einsatzort (der Bot startet 35 m davor); wie in den M1-Prüfständen wird
der Bot unter 60 % geheilt – getestet wird der Ablauf, nicht wie lange
ein Bot durchhält (außer im K.o.-Teil). Letzter Lauf: **72/72**.

| Teil | Ergebnis |
| --- | --- |
| Orte | I Geschäftsviertel (−232,8 / 67,5), II Ufer (137,5 / 126,0), III Park (−191,7 / −129,7) – gültig, 153–255 m vom Kai 7 |
| Reihe I → II → III | je Auftrag Tür, Empfang („Auftrag annehmen“) und Ausgang mit echten Eingaben; I in vier Phasen (drei Spuren mit C, Marken sichtbar, Beobachter flieht und wird mit Q gestellt), II in fünf (Koffer gezeigt und mit C gesichert), III in drei; Belohnung gutgeschrieben, Kontrollpunkt gelöscht, nichts bleibt stehen; `PROG.story` und die Story-Statistik unverändert; danach drei Nebenaufträge gezählt und der Empfang bietet nichts mehr an |
| SCHATTEN | zwei Rauchsprünge (einer bei Bedrängnis), im Rauch 0 Bilder sichtbar und 0 Treffer, Auftauchen je 2,4 m neben dem Helden, nie in einem Haus; beide Male mit dem Netz aus dem Rauch gerissen; alle drei Bossphasen; Bossleiste; zählt nicht als ENFORCER |
| Scheitern | Beobachter entkommt → gescheitert, Kontrollpunkt „Beobachter“, aufgeräumt, der Empfang bietet „Weitermachen“ und steigt genau dort ein, danach abgeschlossen; K.o. in II durch echte Treffer der Bande → gescheitert nach dem Aufstehen, Kontrollpunkt Phase 3, die Bande steht erst bei Ankunft, danach abgeschlossen; Wegrennen in III → gescheitert, Kontrollpunkt Phase 1 |
| Abbruch | einmal J fragt nur, zweimal J bricht ab; Kontrollpunkt gelöscht, Auftrag bleibt offen, nichts bleibt stehen, Story-Statistik unberührt |
| Konflikt mit Akt 1 | läuft eine Storymission, nimmt die Tür des Kai 7 niemanden auf und der Empfang bietet nichts an; läuft ein Nebenauftrag, kommt kein Storyangebot und J startet nichts; `PROG.story` unverändert; Akt 1 danach normal startbar |
| Speichern | Version 4; ein Stand der Version 3 behält Punkte, Ruf, Fertigkeitspunkte, Geschichte samt Kontrollpunkt und Statistik, die Reihe beginnt offen; Dubletten, unbekannte Kennungen, der Kontrollpunkt eines erledigten Auftrags und eine zu große Phase werden bereinigt; echtes Neuladen mitten in II: Kontrollpunkt Phase 2, derselbe Einsatzort, Punkte erhalten, der Empfang setzt dort fort; der Abschluss steht sofort im Speicher |

**Befunde aus den Prüfläufen und was sie geändert haben** (jeweils im
Spiel behoben, nicht im Prüfstand umgangen):

1. Der gestellte Beobachter und die ausgeschaltete Torwache blieben
   eingesponnen am Leben und zählten in der nächsten Phase als Gegner –
   die Phase hing. Sie ergeben sich jetzt.
2. Ein Elite-Wächter der Hofbande jagte einen Passanten 400 m weit –
   `nebenKampfHalten` holt Abtrünnige zurück bzw. nimmt sie aus dem Kampf.
3. Ein Hof lag hinter einem Haus – Hof und Beobachter brauchen jetzt eine
   freie gerade Strecke.
4. Der Rauchsprung kam unter Dauerdruck nie zum Zug (nur ab 2,4 m
   wählbar) – jetzt aus jeder Nähe mit Abklingzeit, dazu das Abtauchen bei
   Bedrängnis.
5. Im Rauch war SCHATTEN in 47 Bildern sichtbar (Taumel-Zweig der
   Gegnerlogik) – beim Abtauchen lösen sich Taumeln und Netz, die
   Unsichtbarkeit wird auch im Bosstakt gesetzt.
6. Der Qualm war im Bild nicht zu sehen (heller Rauch, Leuchtturm-
   Zylinder) – eigener dunkler Qualm, Leuchtturm nahe SCHATTEN aus.
7. Ein letzter Gegner blieb in einem Gesamtlauf unerreichbar – das
   Sicherheitsnetz (30 s, über 10 m) setzt ihn ab.

Grenzen des Bots (kein Spielfehler, im Bot gelöst): geradeaus gegen eine
Fassade gelaufen, klettert die Figur – der Bot startet daher nur von
Punkten mit freier Strecke und springt bei ungewolltem Klettern ab; der
Hinweis unten wird alle 0,1 s aufgefrischt, der Bot wartet dafür 8 Bilder.

Bilder: `docs/abnahme-mega-1.0/m5-schatten-reihe.jpg` und
`m5-schatten-boss.jpg` (`tools/pruef/mega-neben-bilder.js`).

### 5.6 Regression und Leistung

| Prüfung | Ergebnis |
| --- | --- |
| `kernsysteme.js` | alles ok – Story Akt 1 8/8 gestartet und sauber beendet, Ereignisse, Boss-Lebenszyklus, Polizei/Rettung, Hygiene (mit dem Endstand wiederholt) |
| ENFORCER, fester Kampfablauf, gleicher Keim (`m5/enforcer.js`) | **bitgleich** zu M4: Lebenskurve, Phasenwechsel bei Bild 383 und 636, Angriffe, Heldenpositionen, nächster Zufallswert – das Boss-Profil ändert am ENFORCER nichts |
| `mega-kampf.js` | Wand- und Luft-Finisher ok; Rollentaktik mit exakt denselben Werten wie beim M2-Commit |
| `mission6.js` | 26/26 betretbar und verlassbar, Spawns 520 gültig, Sicht durch Wände 0 |
| `interior.js` | alles wie bisher (Ein-/Austritt, Weltpause, Dauerlauf, Kamera, Kontrollpunkt/Tod/Abbruch, Geisel) |
| `mega-innen.js` | 30/30. Seit M5 beginnt am Empfang die Reihe; der Prüfstand setzt sie zu Beginn auf „erledigt“, damit C am Empfang nur spricht und kein Auftrag die Türen sperrt – die Reihe selbst prüft `mega-neben.js` |
| Weltfingerabdruck | identisch (Hindernisse, Parkautos, 45 Wagen, 88 Passanten) |
| Stadtzufallsstrom (die Lehre aus M4) | alle 88 Passanten nach 30 Bildern identisch zu M4, nächster Zufallswert gleich – M5 zieht keinen globalen Zufall |
| `node --test` | 187/187 |
| Zeichenaufrufe, 300 Stellen, `stadt-leistung.js ruhig` | Median 611 (M4: 610), Maximum 1676 (M4: 1677) – M5 baut nichts in die Szene, solange kein Auftrag läuft (Marken, Koffer und Qualm entstehen beim ersten Gebrauch) |
| CPU je Schritt, freier Regisseur, 4 min, M5 und M4 gleichzeitig auf ruhiger Maschine | Median 5,03 ms (M5) gegen 5,11 ms (M4), Mittel 5,00 gegen 5,10 ms, bei derselben Ereignisfolge (ENFORCER, Dachrettung, Überfall) |

### 5.7 Grenzen

* Der Bot trifft immer und wird geheilt: er besiegt SCHATTEN in rund
  zehn Sekunden. Wie schwer der Kampf für einen Menschen ist (360 Leben,
  Rauchsprung alle 5,5 / 4,5 / 3,5 s), muss die Human-Abnahme zeigen.
* Die drei Einsatzorte hängen am Weltkeim – im selben Stand immer
  dieselben Plätze (gewollt: Wiedereinstieg am selben Ort).
* Der Lagerhof ist ein freier Platz hinter dem Tor, kein eigenes
  Gelände – es wird nichts in die Stadt gebaut.
* Der gestellte Beobachter bleibt bis zum Ende des Auftrags stehen und
  wird dann mit aufgeräumt; die Polizei holt ihn nicht eigens ab.
* SCHATTEN trägt das Ganovenmodell mit der Ausrüstung der Duellanten –
  ein eigenes Modell gibt es nicht (keine fremden Modelle, keine neuen
  Assets).
* Ein Kontrollpunkt wird wie bei Akt 1 im Takt gespeichert (höchstens
  30 s); wer genau in diesen Sekunden das Spiel schließt, steigt eine
  Phase früher wieder ein.

---

## 6. M6 – Atmosphäre, Klang, Fortschritt, HUD, Abschluss

M6 bindet die fünf Pakete zusammen: die Stadt klingt nach dem Ort, an dem
man gerade ist, die P-Ansicht zeigt die neuen Inhalte, das HUD hat eine
klare Rangfolge, und die Integrationsfälle des Auftrags laufen als
Prüfstand. Kein neues Menü, kein neues Fortschrittssystem, keine neue
Datei außer Prüfwerkzeugen – alles hängt an `SFX`, `MUSIK`, `PROG`,
`MEILEN`, `SKILLS`, dem Storyläufer und den M4-Orten.

### 6.1 Klang der Stadt

**Vorher:** `SFX` (Einzelklänge aus Oszillatoren und Rauschen) und `MUSIK`
(Musikschleife plus Stadtklang: Verkehrsrauschen, Wind ab 18 m, gelegentlich
Hupe oder ferne Sirene, Tunnelgrollen). Befund am Stand M5 (Messlauf im
Browser, Knoten und Zufallszüge gezählt):

* Der erste Effekt legte den Klangkontext an – auch ohne Klick. Ein Browser
  hält so einen Kontext an; was in der Zeit „gespielt“ wurde, wartet und
  kommt beim ersten Klick auf einmal heraus.
* Jeder Rauscheffekt füllte einen neuen Puffer aus `Math.random` – dem
  Stadtzufallsstrom. Jeder Schritt und Schlag verschob damit, was danach in
  der Stadt passierte.
* Ein blockierter Wagen hupte **überall in der Stadt in voller Lautstärke**
  (`SFX.hupe()` ohne Entfernung), ein umgeworfener Passant ebenso (`SFX.hurt`).
* Überfall, Bandenstreit und ENFORCER galten als „hörbar“ (Entdeckung bis
  95 m, `EV_HOER`) – es war aber gar nichts zu hören.
* Kein Unterschied zwischen drinnen und draußen; Dach erst ab 18 m (auf
  einem normalen Dach von 25–30 m klang es fast wie unten).

**Jetzt** (alles in `SFX`/`MUSIK`, gesteuert von `klangUmgebung()`):

| Lage | Was man hört |
| --- | --- |
| Straße | Verkehr nach Dichte (fahrende Wagen im Umkreis von 80 m, alle 0,5 s gemessen), Hupen nach Verkehr, ferne Stadt als leises, langsam atmendes Murmeln; echte Hupen blockierter Wagen nur bis 90 m, mit Richtung |
| Dach (ab 10 m, voll ab 45 m) | Verkehr leiser und dunkler (bis −60 %), eigener heller Höhenwind in Böen, ferne Stadt etwas präsenter |
| Einsatz in der Nähe | Sirenen der Streifenwagen mit Entfernung **und Richtung** (Stereo); Schläge auf Passanten und Hilferufe (abstrakte Zweisilber aus dem Oszillator) mit `(1 − d/110)²`; Alarmglocke, Autoalarm, Motor, Unfall mit Richtung; die Musik zieht leicht an, der Verkehr tritt zurück („Einsatzklang“), am Ende blendet das in rund zwei Sekunden aus |
| Innenraum (M4, Mission 6, Baukastenhäuser) | Außenzweig zu: Stadt, Sirenen, Hupen hinter einem Tiefpass (650 Hz) und um 70 % leiser; eigener Raumklang (Lüftung, leises Brummen); kurzer Zimmerhall statt Tunnelhall für die eigenen Schläge und Schritte |
| Nacht | Verkehr ruhiger (−35 %, dazu fahren nachts ohnehin weniger), Hupen seltener, ferne Stadt tiefer und leiser; im Park und am Ufer zirpen Grillen |
| Regen | helles Regenrauschen (oben etwas lauter, drinnen gedämpft, unter der Erde nicht), Reifen zischen heller, mehr Wind |

**Regeln** (8.2): Ton erst nach dem Klick auf „Spielen“ – vorher gibt es
weder Kontext noch Knoten. Stumm (M) wirkt auf alles. Ein weicher Begrenzer
vor dem Lautsprecher fängt Häufungen ab (drei Sirenen, Alarm und Kampf
zugleich). Höchstens 48 Einzelklänge zugleich; jeder endet von selbst. Alle
Pegel werden aus begrenzten Größen neu gesetzt, nicht aufaddiert. Der Ton
würfelt mit einem eigenen kleinen Generator, nie mit dem Stadtstrom.
Keine Datei, keine Musik von außen, kein Dienst.

**Prüfstand `tools/pruef/mega-klang.js`** – der Ton wird im Gleichschritt
mit der Simulation gerechnet (`tools/pruef/klang-takt.js`: ein
`OfflineAudioContext`, der genau so weit rechnet, wie das Spiel gekommen
ist) und am Ende **im gerechneten Signal** vermessen. Ergebnis 36/36:

| Prüfung (im gerechneten Signal bzw. an den Knoten) | Ergebnis | Schwelle |
| --- | --- | --- |
| Vor dem Klick: 15 s Spiel mit Schlägen und Ereignis | kein Klangkontext, **0 Knoten** | 0 |
| Klick auf „Spielen“ | genau **1** Kontext, nach echter Nutzeraktivierung; Musik und Stadtklang laufen | 1 |
| Straße hörbar | −28,2 dBFS | über −50 |
| Dach (28 m) gegen Straße darunter: Tiefen (Verkehr) | −33,8 gegen −29,3 dB (**−4,5 dB**); Verkehrsschicht 0,55 → 0,33, Filter 316 → 207 Hz | ≥ 3 dB weniger |
| Dach heller (Mitte gegenüber Tiefe) | −4,6 gegen −7,8 dB (**+3,2 dB**); Wind 0 → 0,18, Höhenwind 0 → 0,16 | ≥ 3 dB |
| Nacht gegen Tag (gleicher Ort) | Verkehrsschicht 0,55 → 0,34; gesamt −28,2 → −32,4 dBFS, Höhen −60,9 → −80,9 dB | ≤ 80 % |
| Regen: Höhen auf der Straße / im Park | −60,9 → −26,4 dB (**+34 dB**) / −52,8 → −26,4 dB (**+26 dB**) | +6 / +15 dB |
| Grillen im Park | Tag 0, Nacht 6 Zirpfolgen | nur nachts |
| Drinnen (Kai 7) gegen vor der Tür | Mitte −41,6 → −48,4 dB (**−6,8 dB**), Höhen −78,2 → −100 dB; Außenzweig 650 Hz und 30 %, Raumklang an, Zimmerhall | ≥ 6 dB |
| Messton (Sirenenlage) draußen → drinnen, über dem Hintergrund | −29,1 → −44,3 dB (**−15,2 dB**) | ≥ 10 dB |
| Schlag auf einen Passanten in 54 m, rechts / links / 125 m | Pegel 0,2582 (Formel 0,2582), Stereo +0,78 / −0,80; in 125 m wird nichts erzeugt | Formel, Seite |
| Einsatz in der Nähe, danach | Einsatzwert 0,95, Musik zieht an (0,97); nach 9 s 0,02, keine hängenden Einzelklänge | < 0,05 |
| Stumm (M) | −120 dBFS, keine neuen Einzelklänge; M wieder: 21 neue, Bus offen | unter −70 |
| 5 min Spiel mit Kampf und Ereignissen | höchstens 33 Quellen zugleich, 0 ausgelassen, erste/zweite Hälfte 17,0/15,8 im Mittel, nach 6 s Ruhe 9 (nach dem Klick 19) | ≤ 60, kein Anstieg |
| Spitze über den ganzen Lauf | −3,1 dBFS, 0 übersteuerte Abtastwerte | unter −1 dBFS |
| Seitenfehler | 0 | 0 |

Die Pegel hängen vom Augenblick ab (wie viel Verkehr gerade fährt, wo das
Ereignis entsteht): ein Lauf am Vortag mit einem Zwischenstand ergab
z. B. Dach −4,3 dB, Messton −14,4 dB, Spitze −1,5 dBFS – alle Prüfungen
halten in beiden Läufen.

### 6.2 Fortschritt (P-Ansicht), Meilensteine, Fertigkeiten

* **Als Nächstes** (oben in der P-Ansicht, höchstens vier Zeilen): freie
  Fertigkeitspunkte, die laufende oder nächste Mission (J), der
  Nebenauftrag (Kai 7, auch „weitermachen“), der nächstgelegene
  Meilenstein mit Anteil.
* **Besondere Einsätze**: gelöste Ladenüberfälle, gestoppte Autodiebe,
  Dachrettungen, versorgte Unfälle, Überfälle, Bandenstreits, ENFORCER,
  SCHATTEN – aus neuen Zählern im Speicherstand (`evLaden`, `evAutodieb`,
  `evDach`, `evUnfall`, `evUeberfall`, `evGang`), gezählt in `evEnde`.
* **Statistik**: dazu Nebenaufträge, Wand- und Luft-Finisher,
  Bewegungsketten (mit bester Kette).
* **Acht neue Meilensteine** in der vorhandenen Mechanik (genau einmal,
  alle zwei Sekunden geprüft, sofort gespeichert): Die Stadt kennt dich
  (10 besondere Einsätze), Kein Entkommen (3 Autodiebe), Sicherer Griff
  (3 Dachrettungen), An die Wand (5 Wand-Finisher), Aus der Luft (5
  Luft-Finisher), Im Fluss (10 Bewegungsketten), Hinter den Fassaden (beide
  begehbaren Orte besucht), Die Schatten der Stadt (alle drei
  Nebenaufträge). Zusammen 1 600 Punkte und 33 Ruf – bei 52 000 Punkten bis
  zur höchsten Stufe verschiebt das die Kurve kaum.
* **Fertigkeiten – Entscheidung: die neun bleiben.** Zehn Stufen geben
  neun Punkte; zwei zusätzliche kaufbare Upgrades wären ohne neue Stufen
  oder Punktequellen nie für alle erreichbar gewesen (8.4). Statt dessen
  wirken zwei vorhandene Fertigkeiten jetzt auch auf die neuen Aktionen –
  gemessen, nicht nur behauptet:
  * **Sauberer Abschluss** (Abschlussschläge +15 %) gilt für Wand- und
    Luft-Finisher: Schaden des Luft-Finishers 30 → 34,5
    (`mega-kampf.js teil=luft`, ohne/mit `skill=abschluss`).
  * **Schwungkunst** (Punkte ×1,5) gilt für saubere Bewegungsketten:
    dieselbe Kette (4 Glieder) 44 → 66 Punkte
    (`mega-bewegung.js teil=fluss`, ohne/mit `skill=schwungkunst`).
  Die Texte der beiden Fertigkeiten sagen das. Gekaufte Fertigkeiten
  alter Stände bleiben (siehe 6.5).

### 6.3 HUD und Rangfolge

* **Zieltext und Leuchtturm gehören immer EINEM Auftrag**, Rangfolge:
  Geschichte/Nebenauftrag/Mission vor dem wichtigsten Ereignis vor den
  freiwilligen Angeboten. Befund vorher: das Ereignis wurde nach Mission
  und Geschichte gerechnet und setzte den Leuchtturm trotzdem – der Text
  zeigte den Auftrag, der Leuchtturm das Ereignis (`mega-fortschritt.js`,
  Teil hud: jetzt orange beim Auftrag, rot beim Ereignis ohne Auftrag).
* **Keine Streckenangebote während eines Auftrags** (der Taktgeber gilt
  dann als besetzt) – vorher konnte mitten in einer Mission ein Streckenring
  mit eigener Uhr auftauchen.
* **Entfernung im Zieltext** ab 25 m („Überfall stoppen · 120 m“), über
  100 m auf zehn Meter gerundet; bei Geschichte und Nebenreihe genauso.
* **Belohnung sichtbar:** der Abschluss eines Ereignisses nennt Punkte und
  Ruf („✅ Ladenüberfall vereitelt +163 Punkte · Ruf +4“) – vorher stieg nur
  oben links die Zahl. Auch ein Ende ohne eigenen Text nennt sie.
* **Kombo-Anzeige unter der Minikarte** (in den ersten M6-Prüfbildern
  stand sie bei `top:90px` mitten in der Karte, gerade im Kampf; jetzt
  darunter, siehe `m6-hud.jpg`); die Bewegungsketten-Anzeige rückt
  darunter.
* Visuelles Feintuning darüber hinaus: keines nötig (geprüft an den
  Bildern `m6-hud.jpg`, `m6-fortschritt.jpg`, `m6-tag-nacht.jpg`); keine
  Fassaden, keine Leuchttafeln.

### 6.4 Nebenauftrag und Innenraum (Integrationsfall 2)

Bis M5 sperrte jeder Storyläufer-Auftrag die Türen. Der Auftrag verlangt
ausdrücklich „mitten in einer Nebenmission einen Innenraum betreten“. Die
Räume liegen am Kartenrand (x 1100/1200) – ohne Vorkehrung hätte die
Entfernungsregel des Auftrags („mehr als 140 m weg“) sofort zugeschlagen,
und seine Gegner wären dem Helden nachgelaufen. Jetzt: während eines
**Nebenauftrags** bieten die Türen den Eintritt an (Akt 1 sperrt weiter),
und drinnen **ruht** der Auftrag (`nebenDrinnen()`): keine Phasenprüfung,
seine Gegner frieren ein wie die übrige Welt, Kontrollpunkte unverändert,
Zieltext „… ruht, solange du drinnen bist“. Draußen geht es an der Tür
genau dort weiter (`mega-last.js` b2).

### 6.5 Speicherstand

Keine neue Version (bleibt 4): die neuen Zähler fehlen in alten Ständen
und starten bei 0 (wie die Zähler von M3), die Prüfung beim Laden geht
über die Schlüssel des Musters. Geprüft mit **echten** alten Ständen
(`tools/pruef/daten/`): einer mit dem Code vor dem Mega-Update (`e05d424`,
Version 3) gespielt und gespeichert, einer mit M5 (Version 4) –
`mega-fortschritt.js` Teil altstand:

| Prüfung (Beispiel 4 des Auftrags) | v3 (vor dem Mega-Update) | v4 (M5) |
| --- | --- | --- |
| Punkte und Bestwert | 19 688 / 19 688 – unverändert | ebenso |
| Stufe | Stufe 6 · Ikone (aus dem Bestwert), so im HUD | ebenso |
| Fertigkeiten | Weiter Schwung, Sauberer Abschluss, Helferhand gekauft, 2 freie Punkte – bleiben und wirken (Faktoren 1,15 / 1,15) | ebenso |
| Akt 1 | Mission 1 und 2 fertig, Kontrollpunkt Mission 3, Phase 2 | ebenso |
| Bezirk, Meilensteine, Statistik | Bezirk B2-3 gemeistert (3 Orte, 2 Marken, 1 Herausforderung, 5 Verbrechen), Meilensteine crime10, rett5, boss1, bezirk1, 23 Verbrechen – bleiben | ebenso |
| Neue Zähler, Nebenreihe | acht neue Zähler 0, Nebenreihe im Anfangszustand, Version 4 | ebenso |
| P-Ansicht | zeigt Stufe, freie Punkte, Fertigkeiten, Geschichte, Nebenreihe, Einsätze | ebenso |
| Speichern und Neuladen | derselbe Stand | ebenso |

Dazu: „Kein Entkommen“ (3 Autodiebe) wird genau einmal vergeben (200
Punkte, mit dem Ruf-Faktor des Stands +250; sofort gespeichert), nach
dem Neuladen keine zweite Belohnung; kein anderer neuer Meilenstein ohne
Grund; „Hinter den Fassaden“ erst nach echten Besuchen von Eckmarkt und
Kai 7.

### 6.6 Integrationsfälle und Langlauf (`tools/pruef/mega-last.js`)

Die fünf Beispiele aus dem Auftrag laufen als Prüfstand im echten Spiel
(Keim 4711). Beispiel 4 (alter Speicherstand) steht in 6.5.

**Beispiel 1 – Schwung, Ladenüberfall, Flucht, Polizei (b1).** Echter
Netzschwung mit der Leertaste (146 Bilder am Seil); danach setzt der
Prüfbot aus M1 den Ladenüberfall an (die Anreise ist abgekürzt), entdeckt
ihn und kämpft; ein Täter flieht und wird gestellt.

| Erwartung | Ergebnis |
| --- | --- |
| keine doppelten Gegner | keine, höchstens 3 zugleich |
| kein verlorener Leuchtturm | 1 023 Bilder entdeckt und laufend, in keinem fehlt er |
| korrekte Belohnung | genau eine, im Hinweis: „✅ Ladenüberfall vereitelt +163 Punkte · Ruf +4“ |
| Polizei fährt ab | 2 Wagen kamen, alle wieder weg |
| Straße wieder frei | keine Ereignisrollen und keine Einsatzwagen übrig, der Verkehr rollt |
| harte Fehler des Ablaufs | 0 (hängt, doppelt, Wagen blockiert, Marker ohne Ereignis, Gegner nach dem Aufräumen, Wagen im Haus) |

**Beispiel 2 – Nebenauftrag und Innenraum (b2).** Schatten I läuft
(Phase 2, Kontrollpunkt geschrieben), der Held betritt den Eckmarkt.

| Erwartung | Ergebnis |
| --- | --- |
| Auftrag bleibt korrekt aktiv | drinnen derselbe Auftrag in derselben Phase, Zieltext „… ruht, solange du drinnen bist“ |
| kein neues Weltereignis in der Innenphase | 30 s drinnen, kein Ereignis gestartet |
| draußen nichts gelöscht | 12 Gegner, 80 Wagen, 88 Passanten vorher und nachher |
| Rückkehrpunkt | an der Tür (0,7 m), der Auftrag läuft weiter und lässt sich regulär beenden |
| Kontrollpunkte | Nebenreihe und Akt 1 unverändert |

Vor der Korrektur in M6 ging das nicht: die Tür bot während eines
Auftrags keinen Eintritt an (siehe 6.4).

**Beispiel 3 – Luft-Finisher an einer Fassade (b3).** An drei Ladenfronten
(Läden 21, 35, 46) wird der Gegner direkt vor der Wand in die Luft
gezogen und mit dem Luft-Finisher geschmettert.

| Erwartung | Ergebnis |
| --- | --- |
| Gegner nicht in der Wand | nie; Abstand zur Wand danach 5,7 / 7,2 / 2,8 m |
| Held nicht im Kletterzustand | nie |
| Kamera lesbar | nie im Haus, höchstens 6,8 m vom Helden |
| danach normale Bewegung | 1 s W: 4,4 / 6,1 / 6,1 m |

**Beispiel 5 – 30 Minuten Spielzeit mit Ton (b5).** Freier Regisseur,
Tag und Nacht. Ein einfacher Bot läuft und sprintet zwischen sieben
Wegpunkten (klettert, wo er hängen bleibt), kämpft gegen Angreifer, geht
zu entdeckten Ereignissen in der Nähe und betritt alle gut fünf Minuten
abwechselnd Eckmarkt und Kai 7 (an die Tür versetzt, 15 s drinnen); bei
wenig Leben wird er geheilt. Der Ton läuft im Gleichschritt mit
(`klang-takt.js`). 31 Stichproben.

| Erwartung | Ergebnis |
| --- | --- |
| keine steigende Zahl verwaister Gegner | 0 am Anfang, 0 am Schluss |
| keine Leichen ohne Ende | Gegnerliste im Mittel 15,2 → 14,6, Gewahrsam wird abgeholt (0 / 0) |
| lebende Gegner begrenzt | höchstens 18 |
| keine endlos aktiven Ereignisse | höchstens 2 zugleich, keins länger als seine Höchstdauer + 90 s |
| keine dauerhaft belegten Innenräume | 6 Besuche (Eckmarkt, Kai 7 im Wechsel), jeder endet draußen |
| keine zunehmende Zahl von Klangknoten | laufende Quellen 19,1 → 17,6 im Mittel, höchstens 37, 0 ausgelassen; nach der Ruhe 9 |
| keine endlosen Effekte | Objekte in der Szene 17 070 → 17 394 (je nach Lage, kein Anstieg), höchstens 1 Hinweis zugleich |
| keine doppelten Belohnungen | 4 gelöste Ereignisse = 4 gezählte; 3 davon entdeckt = 3 Belohnungshinweise |
| Lecks am Ende | 0 Ereignisrollen, 0 Einsatzwagen, 0 Aktivitäten |
| Speicher ohne Anstieg | JS-Heap im ersten Drittel 343 MB, im letzten 320 MB (zwischen 272 und 460 MB) |
| Zeichenaufrufe unter Last | Median der zehn Stichproben unter 899 (546 … 1 137) |
| Seitenfehler | 0 |

Ergebnis 35/35. CPU je Schritt im 30-Minuten-Lauf (unter Volllast der
Maschine, nur als Größenordnung): Median 6,6 ms, 90 % unter 10,8 ms.

### 6.7 Regression und Leistung

Endregression mit dem Endstand, gleicher Keim (4711), alle Prüfstände
frisch gelaufen. „zeilengleich“ heißt: die Ausgabe ist Zeile für Zeile
dieselbe wie beim Lauf mit dem M3-Stand (der seinerseits bitgleich zu M2
war).

| Prüfstand | Endstand M6 | Referenz |
| --- | --- | --- |
| `node --test` | 187/187 | 187/187 |
| `kernsysteme.js` | Story Akt 1: 8 gestartet, 8 sauber beendet, 24 Phasen, 0 hängen; Ereignisregie ohne Leck; Boss-Lebenszyklus; Polizei/Rettung ohne Aufräumfehler; Welthygiene; Fortschritt; Seitenfehler 0 | Story 8/8 |
| `mission6.js` | 520 Spawns gültig, 0 ungültig; durch eine Wand sichtbar 0 von 312 | 520 / 0 |
| `interior.js` | alles ok; drinnen 94 Zeichenaufrufe (draußen 985 / 789) | gleich |
| `spielstand.js` | 0 fehlerhafte Prüfungen | 0 |
| `zeilenuebergang.js` | Naht 221/221/221, Außenecke 150/150 – **zeilengleich** | 221/221/221, 150/150 |
| `innenklettern.js` | innen 108 Läufe 0/0/0/0; außen 91 / 85 / 85, ein ungültiger Start (Startpunkt verfehlt) – wie in der Referenz | 0/0/0/0 |
| `kletterproxy.js` (MO1 und 15 weitere Typen) | MO1 0/0/0 – **zeilengleich** | MO1 0/0/0 |
| `kletterstetigkeit.js` | Foreign 0 (auch im Eckbogen) – **zeilengleich** | 0 |
| `topoutlandung.js` | Problemfälle 13/13, Kontrolle 8/8, Versatz 0,000 m – **zeilengleich** | 13/13, 8/8 |
| `brutal-halle.js` | gehen 30/30, rennen 30/30, unsichtbare Kollision 0 | 30/30 |
| `schwingen.js`, `gleitflug.js`, `wandlauf.js` | Schwingen und Wandlauf **zeilengleich**; Gleitflug zeilengleich zu M5 (gegenüber dem M3-Lauf ein Wert 0,002 → 0,003 m Gliedersprung, schon in M5 so), 0 Beanstandungen | bitgleich |
| Weltfingerabdruck | identisch zu `e05d424`: Hindernisse `910b52f4` (10 706), 575 Parkautos `46a47dc7`, 45 Wagen `d96ebb1b`, 88 Passanten `2edb351f` | `e05d424` |
| `street-details.js` | bestanden, 0 harte Fehler; Gehweg neben den Details mindestens 1,85 m; Gehnetz unverändert (30 Inseln) | 0 harte Fehler |
| `street-life.js`, `street-life-activities.js` | harte Geometriefehler 0; Aktivitäten: harte Fehler 0, 48 Sitzproben, nichts schwebt | 0 harte Fehler |
| `freigang.js` | 572 Ideallinien gestreift, 0 gesperrt, kleinste Gehbreite 1,60 m | 0 gesperrt |
| `npc-wege.js` | A 0, B 0, C 0, D 92/100, E 86/100 (Befund E wie bisher, frühere Läufe 78–85) | A/B/C 0 |
| `parkautos.js` | 575 parkend (STREET 482, LOCAL 93), Ausschlusszonen ohne Befund | 575 |
| `strassen-markierung.js`, `stadtraster.js`, `determinismus.js` | Markierung 0 harte Fehler (1 300 Striche, 482 Zebraflächen); Raster unverändert; derselbe Keim baut dieselbe Stadt (617 Häuser, 11 281 Kollider, alle Prüfsummen gleich) | 0 · unverändert · gleich |
| `verkehr-dichte.js` | 80 Fahrzeuge gleichzeitig aktiv in allen drei Läufen, 0 Geisterfahrer | 80 |
| `mega-ereignisse.js` | 5/5 gelöst (Laden 15,8 s, Autodieb 9,2, direkt 5,9, Dach 37, Unfall 19,2), harte Fehler 0 | 5/5 |
| `mega-kampf.js` | Wand-Finisher 6/6, Rückfall ohne Wand, Luft-Finisher (Schaden 30); Rollentaktik Keim 4711 ok, **Keim 2024 rot** (siehe unten) | M2: alles ok |
| `mega-bewegung.js` | 20/21 – **Arm-Ruck rot** (siehe unten) | 21/21 bei M3 |
| `mega-innen.js` | 30/30 | 30/30 |
| `mega-neben.js` | 71/72 – **Rauchsprünge rot** (siehe unten) | 72/72 bei M5 |
| `mega-klang.js` | 36/36 | neu |
| `mega-fortschritt.js` | 30/30 (nach zwei Korrekturen am Prüfbot, siehe unten) | neu |
| `mega-last.js` | 35/35 (Beispiele 1, 2, 3 und 5) | neu |

**Drei rote Prüfpunkte – alle in Prüfständen älterer Pakete, keiner durch
eine Verhaltensänderung in M6.** Gemeinsame Ursache: der Zufallsablauf
eines Prüflaufs ist seit M6 ein anderer (der Ton zieht ohne Klick keine
Stadtzufallszahlen mehr, siehe 6.1). Drei Prüfpunkte waren an genau
einem Ablauf geeicht und kippen mit dem neuen. Sie bleiben, wie sie sind
– rot, mit Beleg:

1. **`mega-kampf.js`, Rollentaktik, Keim 2024: „Wächter vorn ≥ 45 %“** –
   gemessen 32 % (ohne Rollentaktik 16 %). Gegenprobe mit M5, an dem nur
   der Klangzufall isoliert ist (Arbeitsbaum „M5k“): **exakt dieselben
   Werte** (Keim 4711: Flinker hinten 0,81, Wächter vorn 0,57, 27/23
   Angriffe; Keim 2024: 0,74 / 0,32, 21/20). Der unveränderte M5-Stand
   liefert weiter die Werte aus M2 (0,87 / 0,52; 0,70 / 0,65). Die
   Rollentaktik selbst ist also unverändert; sie verdoppelt den Anteil
   „Wächter vorn“ gegenüber ohne Taktik, erreicht die Schwelle aber nicht
   in jedem Ablauf.
2. **`mega-bewegung.js`, Kette: „kein neuer Arm-Ruck > 0,35 m“** – ein
   Fall mit 0,62 m. Der **unveränderte M5-Stand fällt ebenso** (zwei
   Fälle, 0,52 und 0,43 m), M5k besteht, und zwei Läufe desselben
   M6-Codes zeigen verschiedene Fälle (0,62 bzw. 0,54 m) – der Prüfstand
   ist unter Last nicht bitgenau wiederholbar. Betroffen ist immer
   dieselbe Wand (1590): beim Zugbeginn läuft ein Salto (dort greift der
   Arm seit M3 absichtlich ohne Blende), und der kurze Zug geht noch im
   Messfenster in den Wandlauf über. Offener Randfall aus M3.
3. **`mega-neben.js`, SCHATTEN: „springt mindestens zweimal in den
   Rauch“** – einmal. Der Bot trifft immer und wird geheilt; er besiegt
   SCHATTEN in rund zehn Sekunden, bevor der zweite Sprung fällig ist.
   Alles andere am Rauchsprung hält (im Rauch unsichtbar und nicht zu
   treffen, Auftauchen 2,4 m neben dem Helden, das Netz reißt ihn heraus,
   alle drei Phasen erreicht; 71/72). Gegenprobe mit Keim 7 (Teil
   „reihe“): SCHATTEN springt in M6 zweimal (40/40), in M5 ebenfalls
   zweimal – die Zahl hängt am Ablauf, nicht am Stand.

Was **nicht** rot ist, obwohl sich die Abläufe ändern: alle Ausgänge
(gelöst, gescheitert, Belohnungen, Aufräumen, Kontrollpunkte), die
Weltgleichheit und alle Kletter-, Straßen- und Stadtprüfungen.

**Zwei Korrekturen am eigenen M6-Prüfstand `mega-fortschritt.js`** (am
Prüfbot, nicht an den Prüfungen): Im ersten Endlauf ging der Held aus
25 m zum Überfall, stieg unterwegs in die Hochbahn („Mitfahren“) und kam
nie an – die Prüfung „Abschluss nennt die Belohnung“ war rot, ohne dass
ein Abschluss stattfand. Jetzt wird er dicht an den Täter gestellt (den
Weg prüft `mega-last.js` b1 mit echtem Ablauf). Im zweiten Lauf fehlten
nach einem Neuladen die Türen der begehbaren Orte noch, weil der
Prüfstand nicht auf die asynchron geladenen Hausmodelle wartete. Lauf 3:
30/30.

**Leistung** (Endstand gegen den Ausgangsstand `e05d424`, gleicher Keim,
gleiche Maschine, dieselbe Sitzung; SwiftShader – Zeichenaufrufe und
Dreiecke sind dieselben wie auf einer Grafikkarte, Bildraten werden nicht
gewertet):

| Messung | `e05d424` | Endstand M6 |
| --- | --- | --- |
| Zeichenaufrufe, Median über 300 Stellen (`stadt-leistung.js`) | 864,5 | **870** (Grenze 899) |
| – Straße / Dach / Luft | 794,5 / 791,5 / 896 | 799,5 / 796,5 / 904 |
| – Maximum | 2 427 | 2 436 |
| Dreiecke, Median / Maximum | 3 692 592 / 5 402 007 | 3 688 458 / 5 398 560 |
| Zeichenaufrufe „ruhig“ (ohne Wagen, Passanten, Gegner) | 605 (M2 609, M5 615) | 616 |
| Szenenobjekte | 16 193 | 16 200 |
| JS-Speicher nach dem Laden (nach Müllsammlung) | 63,7 MB | 63,9 MB |
| JS-Speicher nach 3 min mit Ton | 68,6 MB | 68,2 MB (M5k 68,0) |
| CPU je Schritt, freier Regisseur, Ton an (gepaart, 4 min Spielzeit) | Median 7,47 ms · Mittel 7,42 · p90 8,36 | Median 7,72 ms (+3 %) · Mittel 8,23 (+11 %) · p90 10,53 (+26 %) |
| CPU je Schritt ohne Ereignisse (Regisseur ruht), Ton an (gepaart) | Median 5,62 ms · Mittel 5,66 · p90 6,39 | Median 5,81 ms (+3 %) · Mittel 6,14 (+8 %) · p90 7,58 (+19 %) |
| CPU je Schritt ohne Ereignisse, ohne Klick (gepaart) | Median 5,39 ms · Mittel 5,46 · p90 6,03 | Median 5,80 ms (+8 %) · Mittel 6,26 (+15 %) · p90 8,73 (+45 %) |
| Ladezeit (Median aus 3 Läufen nacheinander): alle Dateien / erste volle Szene / Szene ruhig | 24,0 / 36,0 / 57,7 s | 26,3 / 37,6 / 59,4 s (M5: 27,7 / 38,9 / 61,0) |
| 30 min mit Ton (`mega-last.js` b5) | – | Heap 343 → 320 MB, Quellen 19 → 18, Objekte ohne Anstieg, Zeichenaufrufe unter Last Median unter 899 |

Die Standardmessung streut je Lauf um drei bis vier Aufrufe (Wagen und
Passanten stehen beim Einfrieren jedes Mal woanders). Die ruhige Messung
zeigt, woher der Rest kommt: M1 und M2 zusammen +4, M3 bis M5 +6 (u. a.
die beiden Türlampen aus M4), **M6 +1**. Die Luftansicht, die schon vorher
nahe an der Grenze lag, steigt mit dem ganzen Mega-Update um 8 Aufrufe
(+0,9 %); die Grenze gilt für den Gesamtmedian und hält mit 29 Aufrufen
Abstand.

**CPU.** Gemessen wird die Zeit je Simulationsschritt (ohne Zeichnen): der
Held läuft eine feste Runde durch sieben Orte der Stadt, 14 400 Schritte
(4 min Spielzeit), beide Stände gleichzeitig auf derselben Maschine, nach
dem Klick auf „Spielen“ – also mit Ton. Mit freiem Regisseur liegt der
Endstand gegen `e05d424` bei Median +3 %, Mittel +11 %, p90 +26 %. Die
Ereignisfolgen sind dabei **nicht** gleich: `e05d424` startete Enforcer,
Unfall und Überfall (13 Gegner am Ende), der Endstand Unfall, zwei
Überfälle und einen Ladenüberfall (17 Gegner) – den Ladenüberfall gibt es
erst seit M1, und mehr Gegner kosten mehr Zeit. Gegen M5k (M5 mit
isoliertem Klangzufall): mit Ton Median +10 %, Mittel +11 %; ohne Klick
Median +5 %, Mittel +9 % – auch dort mit anderer Ereignisfolge (M5k:
Laden, Überfall, Autodieb, Gang, Dachrettung bzw. Unfall, Gang, zwei
Überfälle). Derselbe Endstand mit und ohne Klick (gleiche Ereignisfolge,
zeitversetzt gemessen): der Ton kostet Median +2 bis +9 %, Mittel +5 bis
+7 %. Ohne Ereignisse (der Regisseur ruht, sonst derselbe Ablauf;
gemessen in Kopien beider Stände mit einem zusätzlichen Prüfhaken
`evRuheLang`, der nicht im Spiel steht): mit Ton Median +3 %, Mittel
+8 %; ohne Klick Median +8 %, Mittel +15 %, p90 +45 %. Woher die Spitzen
kommen, zeigt eine Blockanalyse – derselbe Aufbau ohne Klick noch einmal
gemessen (Endstand p90 7,91 gegen 5,69 ms), dazu je 10 s Spielzeit
Rechenzeit, Gegner im Kampf, fliehende Passanten, Ort und Zustand des
Helden: In beiden Ständen
steckt der Held zunächst in einer Prügelei mit 8–12 Straßenganoven fest.
Im Ausgangsstand bleibt er die ganzen 4 Minuten dort, im Endstand löst er
sich nach 160 s, klettert eine 57 m hohe Fassade hinauf und läuft weiter
– genau diese Blöcke (Klettern, neue Straßen) sind die langsamsten
(9,5 / 9,7 / 6,9 / 7,9 ms). Auf dem vergleichbaren Abschnitt (die ersten
16 Blöcke, beide in derselben Prügelei) braucht der Endstand 5,54 gegen
5,18 ms (+7 %). Ein Profil der ersten zwei Minuten (Chrome-Profiler,
Takt 0,25 ms) ergibt +4,2 % Gesamtzeit, verteilt auf Passanten (Eigenzeit
+8,6 %), Gegner, Animation und Müllsammlung – kein einzelner neuer
Brennpunkt; die M6-Teile fallen nicht ins Gewicht (`updateHUD` −14 %).
Bei vergleichbarer Last kostet das ganze Mega-Update damit etwa +4 bis
+7 %, mit Ton und Ereignissen im Mittel rund +11 % – im Rahmen von
+10–15 %, eine Optimierung ist nicht nötig. Die p90-Werte der gepaarten
Läufe vergleichen verschiedene Wege und sind deshalb kein Maß für den
Mehraufwand. Bildraten werden nicht gewertet (SwiftShader).

**Ladezeit.** Dieselben 247 Dateien; `game.js` ist um 0,2 MB größer
(2,33 → 2,53 MB). Die Mediane liegen 1,6–2,3 s über `e05d424` und unter
M5; die Läufe desselben Stands streuen um bis zu 6,5 s (`e05d424`: Szene
ruhig nach 55,8 / 57,7 / 62,4 s). Gemessen mit SwiftShader, wo das
Übersetzen der Shader den größten Teil ausmacht.

### 6.8 Grenzen

* Der Ton ist synthetisch (Oszillatoren, Rauschen) – Sirenen, Hupen,
  Hilferufe sind erkennbar, aber keine Aufnahmen. So verlangt (keine
  fremden Klänge, keine Dienste).
* Richtung gibt es links/rechts (Stereo), kein Vorne/Hinten.
* Drinnen steht die Welt still (schon seit M4) – Sirenen sind dort
  deshalb nicht leiser, sondern gar nicht zu hören; der Messton des
  Prüfstands zeigt, wie stark der Außenzweig dämpft.
* Die Prüfstände rechnen den Ton im Gleichschritt; im Browser läuft er in
  Echtzeit. Das Verhalten der Knoten ist dasselbe, die Pegel auch – ob es
  gut klingt, kann nur ein Mensch beurteilen (Abnahmevideos mit Ton).
* Der Ton zieht keinen Stadtzufall mehr. Prüfläufe ohne Klick zogen
  vorher bei jedem Effekt Zufallszahlen; deshalb weichen Kampf- und
  Laufabläufe in Prüfläufen ab dem ersten Ton von M5 ab (nicht die
  Ausgangswelt – siehe 6.7).

### 6.9 Abnahmeunterlagen

In `docs/abnahme-mega-1.0/` (Übersicht und Testanleitung in der README
dort):

* `m6-atmosphaere.mp4` (1:23, mit Spielton) – Straße, Dach, Kai 7, Nacht
  mit Regen, Park bei Nacht, Ladenüberfall mit Einsatzklang.
* `m6-zusammenhang.mp4` (1:01, mit Spielton) – Schwung-Kette (M3),
  Ladenüberfall (M1/M6), Luft-Finisher (M2), Kai 7 und Schatten I (M4/M5).
* `m1-ereignisse.mp4` (0:54, ohne Ton) – Dachrettung, Unfall,
  Autodieb mit Jagd und direkt gestoppt, alles im Endstand.
* Bilder `m6-hud.jpg`, `m6-fortschritt.jpg`, `m6-tag-nacht.jpg` (gestellt,
  im Bild vermerkt) und die Bilder aus M2–M5.

Gestellt ist jeweils der Anfang eines Abschnitts (Ort, Zeit, Ereignis
oder Auftrag gesetzt); was danach geschieht, sind echte Eingaben bzw. die
Prüfbots. Das steht dauerhaft unten im Bild.

---

## 7. Abschluss: offene Punkte und bekannte Restfehler

Stand nach M6. Nichts davon ist mit einer unsichtbaren Fläche, einer
abgeschalteten Prüfung oder einem gestellten Bild verdeckt.

**Aus der Endregression (siehe 6.7)**

* **Drei rote Prüfpunkte in Prüfständen älterer Pakete** (Einzelheiten
  und Belege in 6.7): Rollentaktik „Wächter vorn ≥ 45 %“ bei Keim 2024
  (32 %; M5 mit isoliertem Klangzufall liefert exakt dieselben Werte),
  Arm-Ruck beim Netz-Zug im Salto an Wand 1590 (0,54–0,62 m; fällt auch
  im unveränderten M5), SCHATTEN springt im Bot-Kampf nur einmal in den
  Rauch (mit Keim 7 zweimal, in M5 wie in M6). Alle drei hängen am
  Zufallsablauf des Prüflaufs, der sich mit M6 ändert; keiner an einer
  Verhaltensänderung. Sie sind nicht abgeschaltet und nicht umgeeicht.
* **Zwei Prüfbot-Fehler im eigenen M6-Prüfstand behoben** (nicht die
  Prüfungen): `mega-fortschritt.js` ließ den Helden zum Überfall laufen –
  er stieg unterwegs in die Hochbahn; und nach einem Neuladen wartete er
  nicht auf die asynchron geladenen Hausmodelle (Türen fehlten noch).
* `npc-wege.js` meldet wie bisher den Befund E (alarmierte Gegner
  erreichen den Helden an U-Bahn-Abgängen und an der Brücke nicht immer:
  86/100) – bekannte Fehlerart, nicht angefasst.
* `mega-bewegung.js` ist nicht bitgenau wiederholbar: zwei Läufe desselben
  M6-Codes zeigten verschiedene Einzelfälle (Ursache nicht weiter
  verfolgt). Kletter-, Naht- und Top-out-Prüfstände sind zeilengleich zu
  M3, die Stadtprüfungen gleich.

**Grenzen der neuen Inhalte (Einzelheiten in den Abschnitten)**

* M1: Prüfbot-Grenzen (läuft geradeaus, schwingt bei Verfolgungen nicht);
  die vorhandene erste Hilfe prüft keine Höhe; die Person bei der
  Dachrettung hängt in der Jubelhaltung an der Kante.
* M2: an Arkaden und Ladenfronten mit zurückgesetztem Erdgeschoss hängt
  der Gegner vor der Flucht der oberen Fassade.
* M3: vorbestehend Fußruck bis 0,58 m beim Zug aus der Landung,
  Handsprung im Clip `zip_zug`, Haltungswechsel beim Angreifen an der Wand.
* M4: beide Türen am Rand der Innenstadt; die Innenwelt passt nicht
  geometrisch in das Außenhaus; Parkautos stehen oft vor der Ladentür.
* M5: wie schwer SCHATTEN für einen Menschen ist, kann nur die
  Human-Abnahme zeigen (der Bot trifft immer); Einsatzorte hängen am
  Weltkeim; ein Kontrollpunkt wird höchstens 30 s spät geschrieben.
* M6: Ton synthetisch, nur links/rechts; drinnen steht die Welt still;
  ob es gut klingt, beurteilt ein Mensch (Videos mit Ton).

**Vorbestehend und ausdrücklich nicht angefasst (Auftrag)**

Kletterkontakte an Modellüberhängen, Brutal_1-Kernkante,
ModernOffice_1-Nachbarspalt, schneller Wandgriff, Dachkronen-Griff,
fliehende Passanten im Helden (`kernsysteme.js`: `playerNpcOverlap`),
Brücken-Flucht, bestehende visuelle Stadtfehler; aus PROBLEM-2 die
Restbefunde an Brutal_1 und der ModernOffice_1-Rückseite sowie einzelne
Becken- und Schulterbilder. Die dokumentierten Kletter-Randfälle bleiben
offen.

**Nicht gebaut (so beauftragt):** keine neue Hauptstory, kein Akt 2.

**Commits des Mega-Updates** (Branch `claude/spider-man-game-dev-8cepen`,
Ausgangsstand `e05d424`): M1 `8bef1da`, M2 `f0f92ee`, M3 `063ef57`,
M4 `689126a`, M5 `49dba92`, M6 `ce08e4e` und `1e67096` (Zwischenstände)
sowie der Abschluss-Commit „mega-1.0 m6: atmosphere progression and
release polish“ mit Endregression, Leistung, Videos und dieser Doku.
