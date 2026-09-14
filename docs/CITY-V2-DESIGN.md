# CITY V2 – Entwurf und Bautagebuch

Die Stadt von CITY SWING war ein Quadrat aus 7 x 7 Bloecken, 350 x 350 m.
CITY V2 macht daraus eine grosse Stadt, ohne den gewachsenen Kern
anzufassen. Dieses Dokument haelt fest, wie sie gebaut ist, was in jeder
Stufe wirklich gemessen wurde und was ausdruecklich NICHT gemacht wurde.

Stand: Stufe 0 bis 2 abgeschlossen.

---

## 1. Die feste Zusage: LOCKED CORE

Der alte 7x7-Kern bleibt an seinem Platz. Nicht ungefaehr, sondern auf den
Millimeter: dieselben Rasterlinien, dieselben Kreuzungen, dieselben
Blockmitten, dieselben Storyorte.

Das ist keine Absichtserklaerung, sondern ein Pruefstand:
`tools/pruef/stadtraster.js` misst bei jedem Lauf

* die acht Rasterlinien des alten Kerns (-175, -125, -75, -25, 25, 75,
  125, 175) in beiden Richtungen,
* den Boden an allen 8 x 8 = 64 Kernkreuzungen (muss 0 sein, also
  Fahrbahn),
* den Boden in allen 7 x 7 = 49 alten Blockmitten (muss 0,25 sein, also
  Gehwegsockel),
* acht feste Masse, die sich NIE aendern duerfen: Rasterabstand,
  Flussufer, Kaimauer, Promenadenkante, die oestliche Autogrenze und die
  Uferstrasse,
* vierzehn abgeleitete Grenzen - nicht als feste Zahl, sondern als
  ABSTAND zur aeussersten Rasterlinie. Sie wachsen mit der Stadt mit,
  ihr Abstand darf sich nicht aendern.

Ein einziger Befund laesst den Pruefstand mit Rueckgabewert 1 enden.

---

## 2. Warum die Stadt nicht quadratisch wachsen kann

Im Osten liegt bei x = 192 der Fluss. Die Uferstrasse auf der Rasterlinie
x = 175 ist der Anker, an dem Bruecke, Uferpromenade und Kaimauer haengen.
Nach Osten ist also Schluss.

Nach Westen, Norden und Sueden ist Platz. Die Stadt hat deshalb seit
Stufe 1 zwei getrennte Rasterachsen:

```
BLOCKS_X = 10      ORIGIN_X = 175 - BLOCKS_X * PITCH = -325
BLOCKS_Z = 11      ORIGIN_Z = -(BLOCKS_Z * PITCH) / 2 = -275
PITCH    = 50
```

Der Westrand ergibt sich rueckwaerts aus der festen Uferstrasse, nicht
umgekehrt. In z waechst die Stadt um ihre Mitte, nach Norden und Sueden
gleich weit. Dadurch liegt jede alte Rasterlinie noch genau dort, wo sie
lag: aus Block (bi, bj) wird (bi + 3, bj + 2) an derselben Weltstelle.

Ergebnis: 10 x 11 = 110 Bloecke, 500 x 550 m.

### Der Kollisions-Hash haengt NICHT an der Stadtgroesse

`collidersNear` rechnet aus einer Weltstelle einen Schluesselnamen fuer
eine Map. Negative Felder sind dort genauso gut wie positive. Der
Ursprung dieses Hashs ist deshalb eine eigene Konstante (`HASH_O`) und
bleibt ueber alle Ausbaustufen fest - so bleiben die Hashfelder
vergleichbar.

---

## 3. Achsen: was 'x' heisst

Bei einem quadratischen Raster war es egal, welche Achse gemeint ist.
Jetzt nicht mehr. Die Regel:

* `rasterO(a)` / `rasterE(a)` - erste und letzte Rasterlinie der Achse a
* `rasterN(a)` - Zahl der Bloecke auf der Achse a
* `querAchse(a)` - die jeweils andere
* `rasterLinien(a)` - alle Linien der Achse a
* `rasterLinieNah(v, a)` - die naechstgelegene Linie der Achse a
* `imRaster(x, z)` - liegt der Punkt im Strassenraster?

Beim Verkehr gilt: **`car.axis` ist die Achse, ENTLANG der ein Wagen
faehrt** (also die von `car.s`); seine Spur `car.lane` liegt auf der
jeweils anderen. Ebenso bei den Einsatzwagen: `halt.achse`/`halt.s` gegen
`halt.lane`.

---

## 4. Was beim Umbau gefunden wurde

Alle folgenden Stellen waren im quadratischen Raster unsichtbar, weil
ueberall dasselbe herauskam. Jede einzelne ist gemessen, nicht vermutet.

### Stufe 2a - sechs Achsenverwechslungen

| # | Stelle | Was falsch war |
|---|--------|----------------|
| 1 | Fahrbahnmarkierungen | Ein Durchlauf zeichnete BEIDE Strichsorten: Linienliste aus der z-Achse, Laengslage aus der x-Achse |
| 2 | `imGebiet`/`haltenImGebiet` | Westgrenze stand als `-STADT_RAND - 6`, also als gespiegelte Ostgrenze |
| 3 | Halteplaetze der Einsatzwagen | `Math.abs(px) > PROM_Z1` - die z-Grenze, auf x angewendet |
| 4 | Anfahrt und Startpunkt auf der Spur | dieselbe Verwechslung bei `pz` |
| 5 | Abbiegen der Einsatzwagen | dieselbe Verwechslung bei `neuesX` |
| 6 | Hubschrauberrunde | ein einziges `LUFT_RAND` fuer beide Achsen |

### Stufe 2b - vier feste Weltgrenzen, die stehen blieben

| # | Stelle | Befund |
|---|--------|--------|
| 7 | `groundY`, aeussere Schale | `x <= -195 \|\| Math.abs(z) >= 195` - die Spielergrenze der alten Stadt. In den neuen Randbloecken gab es dadurch keinen Gehweg: **40 von 110 Bloecken hatten keinen einzigen Gehnetz-Knoten**. Nach der Behebung: 0 leere Bloecke, 1468 statt 809 Knoten, 12 Knoten je Block - dieselbe Dichte wie im alten Kern (11,6) |
| 8 | `poiPlatzFrei` | `Math.abs(x) > 195` - die neuen Bezirke haetten keinen POI bekommen |
| 9 | `fluchtRichtung` | dieselbe Grenze bei der Fluchtrichtung der Gegner |
| 10 | `evOrtTauglich` | `Math.abs(x) > 190` lag nach dem Wachsen mitten in der Stadt |
| 11 | Kulisse | Sie begann 330 m vom URSPRUNG. Nach dem Wachsen stuende die Westkulisse 5 m hinter der letzten Strasse. Jetzt zaehlt der Abstand (137 m) ab der Spielgrenze JEDER SEITE |
| 12 | Minikarte | Ein Quadrat von -210 bis 210 in beiden Richtungen. Das Ufer drueben (bis x = 400) lag schon vorher nicht auf der Karte; der neue Westen waere ganz herausgefallen. Jetzt je Achse ein eigener Ausschnitt, 2 Bildpunkte je Meter wie zuvor |

Ausserdem aus dem Raster abgeleitet statt fest: Asphaltboden
(`BODEN_X0/X1`), Wasser, Kaimauer, Promenade und das Loch in der Kulisse
(`WELT_Z0/Z1`, `WELT_TIEFE`, `WELT_X0`).

### Ausdruecklich NICHT geaendert

In `evOrtTauglich` gibt es weiterhin keine z-Grenze. Eine waere
symmetrisch huebsch, aber es gibt keinen gemessenen Befund dafuer - und
ohne Befund wird hier nichts repariert.

---

## 4b. Die Strassenhierarchie (Stufe 3)

Bis Stufe 2 war jede Strasse gleich: 12 m Asphalt, zwei Spuren auf
+/-3 m, Tempo 8 bis 13. Bei 49 Bloecken faellt das nicht auf. Bei 110
sieht die Stadt aus wie Millimeterpapier - es gibt keine Hauptstrasse, an
der man sich orientieren koennte, und keine ruhige Nebenstrasse.

### Keine breiteren Strassen

Ein globales `ROAD_WIDTH * 1,8` haette jeden Block schmaler gemacht und
damit den gesamten Kern verschoben. Es war auch nicht noetig: 12 m
Asphalt fuer zwei Spuren sind 6 m je Spur, wo 3 bis 3,5 m ueblich sind.
Vier Spuren zu 2,8 m passen ohne einen einzigen Meter mehr hinein.

`tools/pruef/strassen.js` misst genau das nach: der aeusserste Spurrand
liegt bei **5,90 m**, der Asphalt endet bei 6,00 m. Der engste Abstand
zwischen zwei Spurmitten betraegt 2,70 m.

### Die vier Klassen

| Klasse | Spuren | Spurbreite | Spurmitten | Tempo |
|--------|--------|-----------|------------|-------|
| LOCAL | 2 | 3,2 m | +/-2,4 | 6,5 - 9,5 |
| STREET | 2 | 3,6 m | +/-2,8 (*) | 8 - 13 |
| AVENUE | 4 | 2,8 m | +/-1,6, +/-4,4 | 10 - 15 |
| BOULEVARD | 4 | 2,6 m | +/-1,9, +/-4,6 | 12 - 17 |

(*) STREET trug in Stufe 3 genau die alten Werte, +/-3,0. Stufe 4.1 hat
die Spurmitte auf **+/-2,8** gerueckt, damit ein Bus an einem parkenden
Wagen vorbeikommt - siehe Abschnitt 4c, "Stufe 4.1". Alles andere an
dieser Tabelle gilt unveraendert; LOCAL, AVENUE und BOULEVARD sind nie
angefasst worden.

### Wer welche Klasse bekommt

Abgeleitet, nicht aufgezaehlt. Alle Rasterlinien liegen auf 25 + k * 50;
jede dritte (k durch 3 teilbar) wird zur Avenue, der Rest zur Strasse.
Darueber liegen vier Ausnahmen:

* die aeussersten Linien sind Randstrassen: **LOCAL**
* `x = -125` und `z = 25` sind die beiden Hauptachsen: **BOULEVARD**
* die **Uferstrasse** (`x = 175`) bleibt **STREET**: oestlich davon
  beginnt bei 181 die Promenade, und `AUTO_X_MAX` haelt die Wagen bei
  179 - eine vierte Spur auf 179,4 laege hinter dieser Grenze
* die **Brueckenstrasse** (`z = -25`) bleibt **STREET**: das Deck ist
  15 m breit, der Gehweg beginnt 5,6 m neben der Achse - eine Spur auf
  4,6 waere mit halber Wagenbreite schon im Bordstein

Gemessen ueber alle 23 Linien: 3 LOCAL, 14 STREET, 4 AVENUE,
2 BOULEVARD.

```
x  -325:L2  -275:A4  -225:S2  -175:S2  -125:B4  -75:S2  -25:S2
    25:A4   75:S2   125:S2   175:S2
z  -275:L2  -225:S2  -175:S2  -125:A4  -75:S2  -25:S2   25:B4
    75:S2  125:S2  175:A4  225:S2  275:L2
```

### Was daran haengt

* **Verkehr**: Startspur, Tempo, Abbiegen, Umkehren am Strassenende und
  das Sicherheitsnetz gegen Geisterfahrer holen ihre Spuren jetzt aus
  `spurMitten(achse, linie, richtung)` statt aus einer festen 3.
* **Einsatzwagen**: Halteplatz und Anfahrt nehmen die AEUSSERE Spur
  ihrer Richtung - ein Rettungswagen haelt nicht auf der Ueberholspur.
* **Markierungen**: die Strichversaetze werden aus den Spurmitten
  GERECHNET (ein Spurtrenner liegt genau zwischen zwei Spurmitten
  derselben Richtung), nicht von Hand eingetragen. Ein Boulevard bekommt
  statt der Mittellinie einen durchgehenden Mittelstreifen, an jeder
  Kreuzung unterbrochen - sonst laege er quer ueber dem Zebrastreifen.

### Eine Achsenfalle beim Abbiegen

`linie` in `autoKreuzung` und `respLenke` ist eine Linie auf der
**bisherigen** Fahrachse, und genau dort liegt nach dem Abbiegen die
neue Spur. Der erste Anlauf nahm `querAchse(car.axis)` - im
quadratischen Raster faellt so etwas nie auf, hier waeren die Wagen auf
Linien gelandet, die es auf dieser Achse gar nicht gibt.

---

## 4c. Verkehrsdichte und parkende Autos (Stufe 4)

### Wieviel Verkehr auf welcher Strasse

Zwei Zahlen je Klasse steuern das. Die zweite ist die wichtigere: auf
einem Boulevard faehrt man durch, in einer Wohnstrasse biegt man staendig
ab. Daraus entsteht Durchgangsverkehr auf den Hauptachsen, ohne dass
irgendwo ein Wagen kuenstlich hingesetzt wird.

| Klasse | Startgewicht | Abbiegechance |
|--------|--------------|---------------|
| LOCAL | 0,5 | 0,30 |
| STREET | 1,0 | 0,16 |
| AVENUE | 2,6 | 0,09 |
| BOULEVARD | 3,4 | 0,05 |

Anteil aller Wagenproben je Klasse, gemessen bei 26 Fahrzeugen:

| Klasse | vorher | nachher |
|--------|--------|---------|
| BOULEVARD | 4,7 % | 9,1 % |
| AVENUE | 13,8 % | 19,7 % |
| STREET | 55,3 % | 45,7 % |
| LOCAL | 26,2 % | 25,6 % |

### Wie viele Fahrzeuge

Vier Kandidaten, je drei Laeufe ueber 240 s, feste Tageszeit, dieselben
acht Kamerastellen:

| Groesse | 35 | **45** | 55 | 65 |
|---------|----|----|----|----|
| sichtbar in 50 m | 0 | 1 | 0 | 1 |
| sichtbar in 100 m | 2 | **4** | 5 | 5 |
| sichtbar in 150 m | 6 | 8 | 10 | 10 |
| Zeichenaufrufe | 599 | **636,5** | 678 | 744,5 |
| ms je Schritt | 3,54 | 3,77 | 3,61 | 4,03 |
| Brueckendurchfahrten/min | 1,0 | 2,0 | 1,75 | 2,0 |

45 verdoppelt die sichtbaren Wagen in 100 m gegenueber 35 und kostet
dabei sechs Prozent mehr Zeichenaufrufe. 55 bringt EINEN Wagen mehr fuer
weitere sechseinhalb Prozent, 65 zwei fuer siebzehn. Gewaehlt ist die
niedrigste Zahl, bei der die Stadt sichtbar belebt wirkt: **45**.

Die Bruecke ist damit ohne jede Sonderregel zurueck - 2,0 Durchfahrten je
Minute gegen 1,00 im Stand vor CITY V2. `BRUECKEN_SOG` ist nicht
angefasst.

### Parkende Autos

Modell und Kollisionskasten, sonst nichts: kein Eintrag in `cars`, also
kein Fahrer, keine Verkehrs-KI, kein Mixer, keine Bodenpruefung je Bild.
Nur ein Sichtbarkeitstest viermal je Sekunde bei 150 m.

Wo geparkt wird, ist Geometrie: ein Wagen ist bis 2,0 m breit, der
Asphalt endet bei 6,0 m, also darf die aeusserste Fahrspur hoechstens auf
3,0 liegen.

| Klasse | aeussere Spur | Platz bis zur Kante | parken |
|--------|---------------|---------------------|--------|
| LOCAL | 2,4 | 1,65 m | ja, dicht |
| STREET | 3,0 | 1,05 m | ja, mittel |
| AVENUE | 4,4 | -0,35 m | kein Platz |
| BOULEVARD | 4,6 | -0,55 m | kein Platz |

Die Zahl kostet nichts: gemessen ueber 0, 30, 50, 70, 120, 200 und 300
parkende Wagen liegen die Zeichenaufrufe zwischen 532 und 584, die
Einzelwerte zwischen 530 und 610 - das ist Rauschen zwischen den Laeufen,
kein Effekt. Das Wegschneiden bei 150 m und das Sichtfeld deckeln,
wieviele ueberhaupt gezeichnet werden.

Die Obergrenze ist deshalb das AUSSEHEN, nicht die Leistung. Auf einem
Bild von der Fahrbahnmitte war bei 70 Wagen KEIN einziger zu sehen, bei
200 einer, bei 300 mehrere. Gewaehlt: **300**, also ein Wagen je 57 m
Bordstein. Dichter geht es mit Einzelmodellen nicht - dafuer braucht es
Instancing, und das ist Stufe 10.

### Der ungeloeste Konflikt: Bus und Parkstreifen

(Alle Zahlen dieses Abschnitts beschreiben den Stand VOR Stufe 4.1, also
mit der Spurmitte auf 3,0 m.)

Auf einer STREET liegt die Fahrspur bei 3,0 m. Ein Bus ist 2,4 m breit
und reicht damit bis 4,2 m. Der parkende Wagen liegt buendig am
Asphaltrand und beginnt bei 4,05 m. **Zehn Zentimeter fehlen.**

Rechnerisch: der parkende Wagen braucht seine Mitte bei mindestens
3,0 + 1,2 + 0,95 = 5,15 m und hoechstens bei 6,0 - 0,95 = 5,05 m. Es gibt
keine Loesung, solange die Spur auf 3,0 liegt und das schmalste Fahrzeug
1,9 m breit ist.

Gemessen ueber 2.400 Proben: 344 Faelle, in denen ein fahrender Wagen
einen parkenden ueberdeckte - **alle 344 waren Busse oder Lkw**, kein
einziger Pkw, kein einziger in der Kurve.

Zwei Versuche, das ohne Aenderung der Spurlage zu entschaerfen, wurden
gemessen und wieder ZURUECKGENOMMEN:

1. Breite Fahrzeuge starten auf den Hauptstrassen: 344 -> 282 (-18 %).
2. Zusaetzlich: breite Fahrzeuge biegen nicht in enge Strassen ab:
   344 -> 220 (-36 %). Die Regel wirkt sogar gegen sich selbst - ein Bus,
   der schon auf einer Nebenstrasse faehrt, darf dann auch nicht mehr
   herunter und bleibt laenger dort.

### Stufe 4.1: geloest durch 20 Zentimeter

Der Konflikt ist behoben, und zwar mit der kleinsten Verschiebung, die
nachweislich reicht. Vier Kandidaten, je zehn Minuten:

| Spurmitte | `parkStreift` | kleinster Querabstand |
|-----------|---------------|-----------------------|
| 3,0 (alt) | 374 | -0,10 m |
| 2,9 | 21 | 0,00 m |
| **2,8** | **0** | **+0,10 m** |
| 2,7 | 0 | +0,20 m |

2,9 reicht nicht: einundzwanzig Restfaelle und exakt null Abstand, also
Beruehrung. 2,8 ist die kleinste ausreichende Aenderung; 2,7 braeuchte es
nicht. LOCAL, AVENUE und BOULEVARD bleiben unveraendert, die
Asphaltbreite ebenfalls.

**Kein neuer Nachteil.** Drei Laeufe je Kandidat, Mediane:

| | 3,0 | 2,8 |
|---|---|---|
| `ineinander` | 18 | 11 |
| `langStand` | 1083 | 248 |
| `maxStand` | 97,8 s | 61 s |
| harte Zaehler | alle 0 | alle 0 |

Ein einzelner 30-Minuten-Lauf hatte bei 2,8 einmal 2753 gemeldet und sah
nach einer Verschlechterung aus. Der Dreierlauf zeigt, dass das derselbe
Ausreisser-Effekt war, der in Abschnitt 5b steht - aus einem Einzellauf
dieses Pruefstands wird nichts abgeleitet.

Die Fahrbahnmarkierungen haengen bei einer zweispurigen Strasse nicht an
der Spurmitte: `strichVersaetze` zeichnet dort nur die Mittellinie auf
Versatz 0. Es war also nichts nachzuziehen - auf den Bildern der
Kreuzungen STREET/STREET und STREET/AVENUE bestaetigt.

Die beiden frueher versuchten Routing-Sonderregeln fuer Bus und Lkw
bleiben verworfen.

---

## 5. Leistung

Gemessen wird mit `tools/pruef/stadt-leistung.js` an 300 festen
Kamerastellen: Strassenhoehe, Dachhoehe und Luftbild, je vier
Blickrichtungen, die Orte aus dem Raster des Spiels abgeleitet.

**Keine Bildraten.** Gerendert wird im Pruefstand mit SwiftShader auf der
CPU; eine Bildrate daraus waere eine Zahl ueber diesen Rechner, nicht
ueber das Spiel. Zeichenaufrufe und sichtbare Dreiecke dagegen sind
dieselben wie auf einer echten Grafikkarte.

| Stand | Bloecke | Aufrufe (Median) | Dreiecke (Median) |
|-------|---------|------------------|-------------------|
| vor CITY V2 (7 x 7) | 49 | 504 | 2.870.640 |
| Stufe 2b, 10 x 11 | 110 | 538,5 (+6,8 %) | 3.069.752 (+6,9 %) |

Das Leistungstor lautet: Median der Aufrufe hoechstens +25 Prozent,
Median der Dreiecke hoechstens +35 Prozent. Bei 2,24-facher Stadtgroesse
liegen beide Werte bei rund +7 Prozent - die Stadt waechst, das Bild
kostet fast nichts mehr, weil das Sichtfeld gleich gross bleibt und der
Nebel und das Wegschneiden den Rest erledigen.

Zwischenmessung: direkt nach dem Vergroessern, aber noch VOR der
Kulissen-Korrektur, lagen die Werte bei +13,4 % und +23,0 %. Die weit
nach aussen geruecke Kulisse hat also nicht nur besser ausgesehen,
sondern auch Dreiecke gespart.

---

## 5b. Was der Verkehrspruefstand NICHT beantworten kann

Nach Stufe 3 sah der 60-Minuten-Lauf nach einer Verschlechterung aus: 960
Wagenpaare unter 2,5 m gegen 254 im Stand vor CITY V2. Die
Aufschluesselung (neu eingebaut) zeigte, dass es fast ausschliesslich
Wagen in DERSELBEN Spur sind, nicht nebeneinander fahrende auf einer
Avenue - meine erste Vermutung war damit widerlegt.

Die zweite Vermutung klang schluessig: der Blick nach vorn steht fest auf
9 m. Bei 8 bis 13 m/s sind das mindestens 0,7 s Vorwarnzeit, bei den 17
m/s eines Boulevards nur noch 0,53 s. Ein Umbau (Blick waechst mit dem
Tempo, Stillstand schon bei 1,2 m statt erst bei Beruehrung) war schnell
gebaut.

Er wurde WIEDER ZURUECKGENOMMEN, weil sich nicht zeigen liess, dass er
etwas verbessert. Der Grund liegt im Messgeraet, nicht im Verkehr:

**Derselbe Code, mehrfach gemessen, ergibt voellig verschiedene Zahlen.**

    alte Regel (3 x 15 min)    42    96    16      Median 42
    neue Regel (3 x 15 min)    23   738     7      Median 23

Der Median spricht schwach fuer die neue Regel, aber ihr schlechtester
Lauf ist schlechter als jeder Lauf der alten. Bei drei Messungen und
dieser Streuung ist das kein Ergebnis, sondern Rauschen.

Ursache: das Laden der Modelle laeuft asynchron. Je nachdem, welche
Rueckrufe vor `frier(true)` fertig waren, sind unterschiedlich viele
Zufallszahlen verbraucht - jeder Lauf beginnt an einer anderen Stelle des
Zufallsstroms, und die Wagen stehen beim Einfrieren woanders. Das Spiel
hat dafuer jetzt einen Testhaken (`__dbg.zufallKeim`), der den Strom
zuruecksetzt; er allein reicht aber nicht, weil der WELTZUSTAND beim
Einfrieren schon auseinanderlaeuft.

Betroffen sind alle Zaehler dieses Pruefstands, die von seltenen
Ereignissen leben. Gemessene Streubreiten ueber identischen Code:

| Zaehler | beobachtete Spanne |
|---|---|
| `ineinander` | 2 bis 739 |
| `maxStand` | 17,3 bis 120,5 s |
| `imHaus` | 0 bis 14 |
| `bruecke` | 0 bis 809 |

Belastbar sind dagegen die Zaehler, die in JEDEM Lauf null waren: neben
der Fahrbahn, im Wasser, Ortssprung, Geisterfahrer. Sie sind die
eigentliche Aussage des Prueflaufs - und sie sind nach Stufe 3 sauber.

**Regel fuer die weiteren Stufen:** aus einem einzelnen Lauf dieses
Pruefstands wird keine Reparatur abgeleitet. Entweder der Zaehler ist in
allen Laeufen null, oder es braucht mehrere Laeufe und einen Median - und
selbst dann nur, wenn die Spannen sich nicht ueberlappen.

---

## 6. Pruefstaende

| Pruefstand | Was er misst |
|------------|--------------|
| `tools/pruef/stadtraster.js` | LOCKED CORE, Rastermasse, alle Weltgrenzen |
| `tools/pruef/stadt-leistung.js` | Zeichenaufrufe und Dreiecke, Leistungstor |
| `tools/pruef/stadt-bilder.js` | zehn feste Aufnahmen zum Vergleich zweier Ausbaustufen |
| `tools/pruef/freigang.js` | Fahrbahn, Zebrastreifen, Tueren, POIs, Gehnetz |
| `tools/pruef/kernsysteme.js` | Story Akt 1, Ereignisse, Boss, Einsatzwagen, Welthygiene |
| `tools/pruef/parkautos.js` | parkende Autos: Sperrflaechen, Dichte je Klasse, engste Busluecke |
| `tools/pruef/verkehr-dichte.js` | Verkehrsdichte: sichtbare Wagen, harte Fehlerzaehler |
| `tools/pruef/verkehr-stunde.js` | Langlauf des Verkehrs mit allen Zaehlern (siehe 5b) |
| `tools/pruef/stadtbestand.js` | Bestandsaufnahme der Bebauung, Block fuer Block (Stufe 5) |
| `cd tools && node --test` | 162 Offline-Tests |

Wichtig: `freigang.js` und `verkehr-stunde.js` lesen die Rastermasse
inzwischen aus `__dbg.raster()` statt aus einer eigenen Kopie.
Abgeschrieben haetten sie nach der Erweiterung stillschweigend die alte,
kleine Stadt vermessen und trotzdem "gruen" gemeldet.

---

## 6b. Die Bestandsaufnahme vor Stufe 5

`tools/pruef/stadtbestand.js` liest die gebaute Stadt aus dem laufenden
Spiel und schreibt `docs/STUFE5-STADT-BESTAND.md` samt
`docs/stufe5-bestand.json`. Aufruf:

    node tools/pruef/stadtbestand.js docs/stufe5-bestand.json docs/STUFE5-STADT-BESTAND.md

Je Block stehen dort Index, Weltposition, Zugehoerigkeit zum alten Kern,
Gebaeudezahl und -hoehen, bebaute Flaeche, die Strassenklasse an allen
vier Kanten, wieviel laufender Meter jeder Kante bebaut ist, Bezirk,
POIs, Haustueren, Aufzuege, parkende Autos und U-Bahn-Schaechte.

Die wichtigste Zahl daraus: von 440 Blockkanten hat keine einzige eine
geschlossene Strassenwand. Die Kantenbelegung liegt im Median bei 0 %,
im Mittel bei knapp 20 %, hoechstens bei 69 % - die Haeuser stehen frei
in der Blockmitte, weil `buildBlockBuildings` nur die inneren 30 von 38
Metern bebaut. Und es gibt kein Haus unter 14,3 m: eine zwei- bis
viergeschossige Bebauung existiert in dieser Stadt nicht.

---

## 7. Was noch aussteht

Stufe 3 bis 11: Strassenhierarchie, Parzellierung und Strassenwaende,
Hoehenhierarchie, mehr Verkehr und parkende Autos, mehr
Zivilisten-Varianten, Bezirke aus gebauten Eigenschaften, erweiterte
Netze, Einsatzkraefte und Ereignisse, Leistungsarchitektur, Regression.

Nicht Teil von CITY V2: Akt 2, ein neues Heldenrig, neue
Higgsfield-Erzeugungen, und - solange die Lizenzlage nicht geklaert ist -
jedes Modell aus dem BUILD-2-Paket (siehe `docs/BUILD2-ASSET-AUDIT.md`).
