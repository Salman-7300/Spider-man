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

Seit Stufe 8B (Abschnitt 6r) waehlt der normale Verkehr an jeder Kreuzung
gewichtet nach Klasse und Bezirk der Zielstrasse (`kreuzungsWahl`); die
Abbiegechance gilt nur noch fuer das Fluchtauto und fuer den Rand.

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
| `tools/pruef/haeuserzeilen.js` | Parzellen und Haeuserzeilen: Plan und Bau getrennt (Stufe 5) |
| `tools/pruef/hybrid.js` | Hybridschwellen vergleichen, mit dem Kamerasatz des Leistungstors |
| `tools/pruef/stufe5-bilder.js` | die sechs festen Aufnahmen der Stufe 5 |
| `tools/pruef/haeuser-rueckfall.js` | fehlende Modelldatei und einzelne fehlgeschlagene Platzierung |
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

## 6c. Stadtteile und Parzellen (Stufe 5, Teil B)

### Die Einteilung kommt jetzt VOR dem Bauen

Bis Stufe 4 wurden die Bezirke nach dem Bauen aus der mittleren
Kollisionshoehe je Block gelesen. Gemessen ueber alle 110 Bloecke lag
der Manhattan-Abstand vom Stadtkern bei den ZENTRUM-Bloecken im Median
bei 300 m, bei den WOHN-Bloecken bei 250 m: die "Innenstadt" lag im
Mittel weiter draussen als die Wohngegend. Der Grund war nicht das
Lesen, sondern das Bauen - `buildBlockBuildings` setzt in 30 Prozent
der Faelle einen einzelnen hohen Turm, und ob ein Block als Zentrum
galt, war damit ein Wuerfelwurf.

Ein Hoehengefaelle hat die Stadt sehr wohl (hoechstes Haus je Block,
nach Abstand vom Kern): 100 m -> 48,4 m, 200 m -> 47,0, 300 m -> 40,3,
400 m -> 37,1, 500 m -> 31,2. Nur gesehen hat es die Einteilung nicht.

Es gibt weiterhin nur EINE Einteilung. `stadtteilArt` vergibt sie beim
Bauen aus Merkmalen, die da schon feststehen - Abstand vom Kern,
Strassenklasse der vier Blockkanten, Park, Wasser -, und
`bezirkeLesen()` liest sie danach und ergaenzt sie um das, was sich
erst hinterher messen laesst.

| Stadtteil | Regel | Bloecke | Anteil |
|-----------|-------|---------|--------|
| PARK | Parkblock | 2 | 2 % |
| UFER | oestlichste Blockspalte | 11 | 10 % |
| ZENTRUM | Manhattan-Abstand <= 150 m | 24 | 22 % |
| GESCHAEFT | Hauptachse UND Avenue an derselben Ecke | 12 | 11 % |
| MISCHUNG | Abstand <= 300 m oder Hauptachse | 37 | 34 % |
| WOHN | alles Uebrige | 24 | 22 % |

Die beiden Schwellen sind nicht gewaehlt, sondern gemessen: mit 150 und
300 ordnet sich die BEREITS GEBAUTE Stadt von selbst richtig ein -
hoechstes Haus im Median ZENTRUM 49,7 > GESCHAEFT 43,0 > UFER 42,9 >
MISCHUNG 38,0 > WOHN 32,6. Die Einteilung stimmt also mit der Stadt
ueberein, noch bevor ein einziges Haus umgestellt wurde.

GESCHAEFT ist bewusst eng: an eine der beiden Hauptachsen grenzen 38 der
110 Bloecke. Waere das schon ein Geschaeftsviertel, waere ein Drittel
der Stadt eines. Der Ladencharakter einer einzelnen AVENUE- oder
BOULEVARD-Kante haengt deshalb an der KANTE (`kantenNutzung`), nicht am
Block.

### Die Bauflucht entscheidet das Gehnetz, nicht der Geschmack

Die 1320 Gehnetz-Knoten in den Bloecken liegen im Median 17,0 m von der
Blockmitte entfernt, der naechste bei 15,9 m. Bei einer Bauflucht von
15,0 m liegt kein Knoten im Haus, bei 16,0 m waeren es vier. 15,0 m ist
damit die Grenze. Innerhalb davon unterscheidet die Strassenklasse den
Vorbereich - die Strasse selbst wird dabei nicht breiter:

| Klasse | Bauflucht | Gehweg davor |
|--------|-----------|--------------|
| LOCAL | 15,0 m | 4,0 m |
| STREET | 14,4 m | 4,6 m |
| AVENUE | 13,6 m | 5,4 m |
| BOULEVARD | 13,0 m | 6,0 m |

### Was ein 38-Meter-Block hergibt

Innen ist ein Block 38 x 38 m, bebaubar 30 x 30 m. Legt man darum einen
Ring 10 m tiefer Haeuser, bleiben in der Mitte 10 x 10 m Hof - und die
beiden QUER liegenden Kanten haben dann nur noch diese 10 m Front. Vier
gleich lange Zeilen passen hier nicht hinein; das ist Geometrie.

Jeder Block hat deshalb eine Hauptachse. Die beiden Kanten darauf
tragen die lange Zeile, die beiden anderen bekommen, was zwischen den
Stirnseiten frei bleibt. Aus demselben Grund ist die Bautiefe 8 bis
11 m: bei 13 m haetten die Querkanten je 1,4 m Front gehabt, also gar
kein Haus.

Die Zeile endet an der Bauflucht der quer liegenden Kanten, also
spaetestens bei 15,0 m - NICHT bei 19 m. Sonst schluckt sie an den vier
Blockecken die Knoten der querlaufenden Gehwege; gemessen waren es 410.
Damit ist die groesste Ausdehnung eines Lots in jeder Richtung 15,0 m
und liegt unter den 15,9 m des naechsten Knotens: kein Knoten KANN mehr
in einem Haus liegen. Die Blockecken bleiben offener Gehweg, und ein
Eckhaus ist ein Merkmal des ersten und letzten Lots einer Zeile, keine
eigene Bauform.

### Lotklassen aus den vorhandenen Modellen

Gemessen sind die drei begehbaren Haeuser 12,46 / 15,06 / 20,64 m breit,
die selbstgebauten Quader reichen von 6,5 bis 26,4 m. Daraus:

| Klasse | Breite | fertiges Modell moeglich |
|--------|--------|--------------------------|
| SCHMAL | 7,0 - 10,5 m | nein, nur Quader |
| MITTEL | 10,5 - 14,0 m | ja |
| BREIT | 14,0 - 24,0 m | ja |

Eine vierte Klasse ueber 18,5 m ("ECK") war vorgesehen und ist wieder
herausgeflogen: eine Blockkante gibt hoechstens 30 m Front her, und
darauf passt kein einzelnes Lot. Eine Klasse, die nie besetzt wird,
gehoert nicht ins Modell.

Wie fein eine Kante geteilt wird, haengt am Stadtteil - das ist der
eigentliche Unterschied zwischen Wohnstrasse und Geschaeftsblock
(gemessen ueber alle 110 Bloecke):

| Stadtteil | Zielbreite | Lots je Block | Lotbreite Median |
|-----------|-----------|---------------|------------------|
| ZENTRUM | 14 - 20 m | 4,1 | 13,6 m |
| GESCHAEFT | 13 - 19 m | 4,2 | 13,0 m |
| UFER | 11 - 16 m | 5,4 | 14,4 m |
| MISCHUNG | 9,5 - 13,5 m | 5,3 | 9,6 m |
| WOHN | 8 - 12 m | 6,2 | 9,1 m |
| PARK | - | 0 | - |

Zusammen 575 Parzellen, davon 554 bebaubar (die uebrigen liegen auf
einem U-Bahn-Treppenschacht). Gegenueber den heutigen 274 Baukoerpern
waere das gut die doppelte Zahl - was das kostet, entscheidet Teil C,
gemessen, nicht geschaetzt.

Teil B aendert am BILD noch nichts: die Parzellen sind Daten. Gebaut
wird auf ihnen ab Teil C.

---

## 6d. Die Haeuserzeile (Stufe 5, Teil C)

Gebaut wird zunaechst nur in den NEUEN Aussenbloecken mit Wohn- oder
Mischcharakter - 49 der 110 Bloecke. Der alte 7x7-Kern und die
Zentrums- und Geschaeftsbloecke bleiben vorerst, wie sie sind; an ihnen
laesst sich ablesen, was die Zeile ueberhaupt veraendert.

Die Geschosszahl kommt aus dem Stadtteil, gerechnet mit 3,2 m je
Geschoss - derselben Zahl, mit der auch die Bestandsaufnahme ihre
Hoehenbaender bildet. Die Naehe zum Kern hebt das Band leicht an, ein
Eckhaus darf ein Geschoss mehr:

| Stadtteil | Geschosse |
|-----------|-----------|
| WOHN | 3 - 6 |
| MISCHUNG | 4 - 10 |
| UFER | 4 - 9 |
| GESCHAEFT | 5 - 12 |
| ZENTRUM | 6 - 14 |

### Die 49 umgebauten Bloecke, vorher gegen nachher

| | vorher | nachher |
|---|--------|---------|
| Gebaeude | 118 | 335 |
| je Block | 2,41 | 6,84 |
| Kantenbelegung (Kanten mit Haus) | 22,1 % | 74,2 % |
| Kantenbelegung Median | 24 % | 75 % |
| Hoehe Median | 28,0 m | 19,7 m |
| LOW / MID / UPPER / HIGH | 0 / 36 / 49 / 14 % | 8 / 67 / 25 / 0 % |

Die 75 Prozent sind nah am geometrischen Anschlag: eine Blockkante ist
38 m lang, bebaut werden davon 30 - die vier Blockecken bleiben fuer die
querlaufenden Gehwege frei. Mehr als 79 Prozent sind hier nicht
erreichbar, ohne das Fussgaengernetz zu zerschneiden.

### Die ganze Stadt

| | vorher | nachher | |
|---|--------|---------|---|
| Gebaeude | 274 | 520 | + 90 % |
| Kantenbelegung Mittel | 19,6 % | 43,3 % | |
| Kantenbelegung Median | 0 % | 51 % | |
| niedrigstes Haus | 14,3 m | 9,9 m | |
| Zeichenaufrufe | 861 | 987 | + 14,6 % |
| Dreiecke | 3,13 Mio | 3,48 Mio | + 11,2 % |
| Kollider | 2888 | 3503 | |
| Szenenobjekte | 16521 | 17522 | |

Das Leistungstor liegt bei + 25 % Zeichenaufrufen und + 35 % Dreiecken -
beides ist eingehalten, bei fast doppelt so vielen Gebaeuden.

### Zwei Funde aus den Bildern

**Das Gesims ragte in den Nachbarn.** `schmueckeHaus` setzte ringsum ein
Gesims, das 45 cm ueber die Wand steht. Solange die Haeuser 2,6 m
auseinander standen, fiel das nicht auf; in der Zeile stossen sie ohne
Luecke aneinander, und das Gesims ragte 45 cm IN den Nachbarn. Auf dem
Bild war das ein Gewirr ineinandersteckender Platten und Saeulen, dazu
ein 90 cm breiter Kollisionsklotz auf Dachhoehe, der ins Nachbarhaus
reichte. Ein Reihenhaus bekommt sein Gesims jetzt nur noch zur Strasse;
weil alle Haeuser einer Zeile dieselbe Bauflucht haben, wird daraus ein
durchgehendes Band.

**72 Schlitze an den Stirnseiten.** Zwischen der langen Zeile und der
kurzen stand ein Sicherheitsabstand von 0,6 m. Gemessen wurden daraus 72
Spalte von 0,59 bis 0,78 m - zu schmal, um hineinzukommen (der Spieler
ist 0,90 m breit), aber breit genug, um als Loch in der Strassenwand
aufzufallen. Die Grenzen werden jetzt SEITENWEISE gerechnet statt
symmetrisch: jede Kante kennt ihre eigene Bauflucht und ihre eigene
Bautiefe, die Zeilen stossen stumpf aneinander. Engster Abstand zwischen
zwei Haeusern eines Blocks danach: 5,86 m - der Hof.

---

## 6e. Geschaeftsstrassen und Downtown-Sockel (Stufe 5, Teil D)

Teil C hat nur die neuen Aussenbloecke mit Wohn- und Mischcharakter
gebaut. Teil D nimmt die uebrigen dazu - und macht dabei EINE
Unterscheidung, die die Innenstadt rettet.

### Warum nicht jeder Kernblock eine Zeile bekommt

Bekaeme jeder Block des alten 7x7-Kerns eine Zeile, waere die Innenstadt
eine gleichmaessige Sockelflaeche und die Tuerme waeren weg. Bliebe
umgekehrt jeder Kernblock, wie er ist, stuende im Zentrum weiter nur der
freistehende Turm auf leerem Gehweg - genau der Befund aus der
Bestandsaufnahme.

Also die Haelfte: welcher Kernblock eine Zeile bekommt, haengt am Ort und
ist damit bei jedem Start dieselbe Auswahl. Die uebrigen behalten ihren
Turm, und dazwischen entsteht der Sockel, den die Innenstadt bisher
nicht hatte. Ausserhalb des Kerns bekommen alle Bloecke eine Zeile,
ausser den beiden Parkbloecken.

### Der hohe Akzent

Eine Zeile aus lauter gleich hohen Haeusern ist eine Mauer. Ein Teil der
Lots bekommt deshalb ein deutlich hoeheres Haus - im Zentrum oft, am Rand
gar nicht. Erst dadurch stehen die Tuerme an der STRASSE statt
freistehend in der Blockmitte:

| Stadtteil | Anteil | Geschosse | Hoehe |
|-----------|--------|-----------|-------|
| ZENTRUM | 20 % | 16 - 30 | 51 - 96 m |
| GESCHAEFT | 12 % | 14 - 22 | 45 - 70 m |
| UFER | 8 % | 12 - 18 | 38 - 58 m |
| MISCHUNG | 5 % | 11 - 15 | 35 - 48 m |
| WOHN | 0 % | - | - |

Die 30 Geschosse im Zentrum sind kein gegriffener Wert: das hoechste Haus
der Stadt war vor Stufe 5 gemessen 97 m hoch, und die Skyline soll ihren
Gipfel behalten. Mit 28 Geschossen kam sie nur noch auf 89 m.

---

## 6f. Hybride Gebaeudedarstellung (Stufe 5, Teil D.1)

### Der Befund

Teil D hat das Leistungstor gerissen: 1024 Zeichenaufrufe gegen 719 nach
Stufe 4.1, also +42,4 Prozent bei einem Tor von +25. Die Dreiecke waren
mit +13,6 Prozent unauffaellig. Die Ursache ist Arithmetik:
`setzeHausModelle` stellte ueber JEDE Kiste eine eigene Modellkopie, und
eine solche Kopie kostet gemessen 0,88 Zeichenaufrufe. 274 -> 622
Gebaeude sind damit rund 300 Aufrufe mehr.

### Der Hebel

Nicht weniger Haeuser, sondern die bereits vorhandene verschmolzene
Fassadenschicht. Sie kostet zwei Zeichenaufrufe JE KACHEL, egal wie viele
Haeuser darin stehen - ein Haus, das prozedural bleibt, ist praktisch
umsonst.

Dafuer gibt es jetzt ZWEI verschmolzene Saetze statt einem:

| Satz | Inhalt | Wer darf ihn ausblenden |
|------|--------|-------------------------|
| `HAUS_FASSADEN_PROD` | Haeuser mit visualMode 'merged' | niemand, bleibt immer sichtbar |
| `HAUS_FASSADEN_FALL` | Haeuser mit visualMode 'model' | nur `setzeHausModelle`, und nur wenn JEDES Modell steht |

Der Modus steht VOR dem Verschmelzen fest (`hausVisual`), sonst laege die
Geometrie im falschen Eimer. Die Regel ist keine Prozentzahl, sondern eine
Eigenschaft:

    immer MODEL   freistehende Baukoerper aus dem alten Weg
    MODEL         ab HYBRID_HOCH = 32 m
    MODEL         Eckhaus ab 16 m - die Enden einer Zeile tragen den Blick
    MODEL         in ZENTRUM und GESCHAEFT schon ab 20 m
    sonst         MERGED

### Warum 32

Sieben Schwellen gemessen, je 300 Aufnahmen an denselben Kamerastellen
wie das Leistungstor:

| Schwelle | MODEL | MERGED | Aufrufe | gegen 4.1 | Dreiecke | Tor |
|----------|-------|--------|---------|-----------|----------|-----|
| 12 | 611 | 11 | 983,5 | +36,8 % | 3,47 Mio | gerissen |
| 15 | 554 | 68 | 973 | +35,3 % | 3,38 Mio | gerissen |
| 18 | 510 | 112 | 974 / 980 | +35,5 / +36,3 % | 3,80 Mio | gerissen |
| 20 | 487 | 135 | 889 / 895,5 / 885,5 | +23,2 bis +24,5 % | 3,28 Mio | knapp ok |
| 26 | 442 | 180 | 879 | +22,3 % | 3,12 Mio | ok |
| **32** | **413** | **209** | **853,5** | **+18,7 %** | **3,10 Mio** | **ok** |
| 39 | 404 | 218 | 846 | +17,7 % | 3,11 Mio | ok |

20 und 18 wurden mehrfach gemessen - der Sprung dazwischen ist echt, kein
Rauschen. 20 haelt das Tor nur mit 4 bis 14 Aufrufen Luft und behebt den
bekannten Flachhaus-Befund trotzdem nicht (das Haus ist 18,6 m hoch). 18
wuerde es beheben und reisst das Tor reproduzierbar. 32 ist damit der
beste Gesamtkompromiss und liegt im Band 820 bis 860, das der Auftrag
nennt.

Nebenbefund: die Dreiecke fallen mit, von 3,50 auf 3,10 Mio. Ein
GLB-Modell hat mehr Dreiecke als ein texturierter Quader.

### Das Leistungstor, mit der produktiven Schwelle

Gemessen mit `tools/pruef/stadt-leistung.js`, 300 Aufnahmen, gegen
`docs/leistung-v2-stufe41.json`:

| | Stufe 4.1 | Stufe 5 | | Tor |
|---|-----------|---------|---|-----|
| Zeichenaufrufe Median | 719 | **861,5** | **+19,8 %** | +25 % |
| Dreiecke Median | 3 081 212 | **3 102 574** | **+0,7 %** | +35 % |
| davon Strasse | 689 | 796,5 | +15,6 % | |
| davon Dach | 690 | 784 | +13,6 % | |
| davon Luft | 778,5 | 899 | +15,5 % | |

Zum Vergleich der Stand VOR dem Hybrid, mit derselben Stadt: 1024
Aufrufe, +42,4 Prozent - klar gerissen. Die Zahl aus `hybrid.js` fuer
Schwelle 32 lautete 853,5; die 861,5 hier sind derselbe Wert im Rahmen
der ueblichen Streuung von rund acht Aufrufen zwischen zwei Laeufen.

### Atomare Platzierung

Wuerde Haus fuer Haus gesetzt und am Ende der Rueckfall ausgeblendet,
fehlte bei einem Fehler auf halber Strecke der Rest der Stadt. Deshalb
wird alles erst vorbereitet und geprueft - Kopien UND Kronen-Kollider -,
und erst wenn jede erwartete Platzierung vorliegt, kommt sie in die Szene
und der Rueckfall verschwindet. Sonst wird das Vorbereitete verworfen und
`__hausFehler` gesetzt.

`tools/pruef/haeuser-rueckfall.js` prueft drei Faelle: normal, fehlende
Datei (404), und eine einzelne ungueltige Platzierung bei geladener
Datei. Im dritten Fall darf KEIN Modell stehen, beide Fassadensaetze
muessen sichtbar sein und die Kolliderzahl muss der des 404-Falls
entsprechen - sonst waere ein vorbereiteter Kronen-Kollider in der Welt
gelandet.

### Was der Bildpunktvergleich NICHT kann

Der Versuch, die optischen Kosten des Hybrids als Prozentsatz
abweichender Bildpunkte zu messen, ist gescheitert und wird nicht
weiterverfolgt. Zwei Laeufe mit IDENTISCHER Schwelle unterscheiden sich
bereits um 3,4 bis 10,3 Prozent der Bildpunkte - Autos und Passanten
stehen in jedem Lauf woanders. Das Rauschen ist damit groesser als der
gesuchte Unterschied.

Die optische Qualitaet dieser Stufe wird deshalb an festen Kameras und
mit menschlichem Blick beurteilt, nicht an einer Prozentzahl. Zahlen aus
frueheren Bildpunktvergleichen sind nicht belastbar.

### Die bekannte Grenze

Einzelne niedrige Haeuser mitten in einer Zeile wirken sichtbar flacher
als ihre MODEL-Nachbarn. Belegt an der Wohnstrasse: das vorderste Haus
links ist 18,6 m hoch, bleibt bei jeder Schwelle prozedural, die das Tor
haelt, und liest sich neben den Modellhaeusern als Textur statt als
Gebaeude. Das ist die Grenze des Hybrid-Ansatzes unter dem Tor, kein
uebersehener Fehler.

---

## 6g. Die fuenf Gehnetz-Knoten (Stufe 5, Teil E, Punkt 0)

Vor Stufe 5 meldete der Pruefstand 1468 Gehnetz-Knoten, danach 1463. Die
Frage war, ob die Haeuserzeilen fuenf Knoten gekostet haben. Sie haben
nicht.

### Das Netz ist innerhalb eines Commits exakt gleich

Zwei Laeufe auf demselben Stand mit demselben Weltkeim liefern dieselben
1463 Knoten, Koordinate fuer Koordinate - 0 Abweichungen. Die Zahl
schwankt also nicht, ein Unterschied ist ein echter Unterschied.

### In der Stadt fehlt kein einziger Knoten

Beim Vergleich mit Stufe 4.1 verschwinden 109 Knoten und 104 kommen
hinzu. Nach Art aufgeschluesselt:

| Art | verschwunden | neu | netto |
|-----|--------------|-----|-------|
| ecke | 9 | 9 | 0 |
| weg | 45 | 45 | 0 |
| ufer | 45 | 42 | -3 |
| bruecke | 10 | 8 | -2 |

`ecke` und `weg` - also alles innerhalb der Stadt - gleichen sich exakt
aus. Die 54 Verschiebungen sind Dezimeterbetraege: (-283,8 | -183) wird
zu (-283,0 | -183). `gehSetzeKnoten` fasst Knoten innerhalb von 1,2 m
zusammen, und wo genau der Knoten landet, haengt an der umgebenden
Geometrie.

### Die fuenf liegen alle ausserhalb der Stadt

Fuer jeden betroffenen Ort wurde geprueft, welcher Kollider im Freiraum
steht:

| Ort | Blockierer |
|-----|------------|
| drei Uferknoten | Gebaeude am GEGENUFER, alle mit x0 >= 341 - jenseits des Flusses, das Raster endet bei x = 175 |
| zwei Brueckenknoten | das Brueckengelaender, x 181..334, z -35,1..-34,6, h 1,9. Der Knoten lag 0,65 m davor, der Freiraum verlangt 0,75 m |

Kein einziger Blockierer ist ein Gebaeude der Stadt. Die Ufergebaeude
und die Brueckenmoebel entstehen aus demselben Zufallsstrom wie die
Stadt; Stufe 5 zieht andere Zahlen, also landen sie anders. An beiden
Orten baut Stufe 5 nichts.

### Der Graph ist nicht schlechter

| | Stufe 4.1 | Stufe 5 |
|---|-----------|---------|
| Knoten | 1468 | 1463 |
| nutzbar | 1444 | 1440 |
| Kanten | 1836 | 1825 |
| Ueberwege | 456 | 450 |
| Inseln | 6 | 7 |
| groesste Insel | 1403 | 1401 |
| wirklich gesperrt | 0 | 0 |

Zusammenhaengend sind 1401 von 1440 nutzbaren Knoten (97,3 %), vorher
1403 von 1444 (97,2 %) - anteilig minimal besser. Die siebte Insel
besteht aus den zwei Knoten, um die die groesste geschrumpft ist, und
liegt im selben Bereich wie der Rest des Deltas.

**Keine Regression. Es wurde nichts repariert.**

---

## 6h. Wiederholung, Hoehenrhythmus und die Zeilennaht (Stufe 5, Teil E)

Teil E baut keine Stadt. Er aendert nur, wie stark sich UNMITTELBARE
Nachbarn voneinander unterscheiden - und er hat einen Fehler beim
Klettern behoben, den ein Mensch im Spiel gefunden hat.

### Die Fassadenbremse wirkte ueber Zeilengrenzen hinweg

Drei Fassadentexturen, unabhaengig gewuerfelt: rund ein Drittel aller
Nachbarpaare teilt sich dieselbe. Deshalb merkt sich eine Zeile, welche
Textur das vorige Haus bekommen hat, und das naechste nimmt eine andere.

Der erste Versuch merkte sich das in EINER Variablen fuer die ganze
Stadt. Gemessen entlang der Baureihenfolge, getrennt nach Uebergaengen
innerhalb einer Zeile und zwischen zwei Zeilen:

| Seed 4711 | innerhalb einer Zeile | zwischen zwei Zeilen |
|---|---|---|
| vorher | 0 von 221 (0,0 %) | 0 von 282 (0,0 %) |
| nachher | 0 von 221 (0,0 %) | 94 von 282 (33,3 %) |
| erwartet ohne Beeinflussung | - | rund 33 % |

0,0 Prozent an den Zeilengrenzen sind der Beweis: das erste Haus einer
Blockkante richtete sich nach dem letzten Haus einer voellig anderen
Kante. Der Zustand haengt jetzt an der Zeilenkennung `info.zeile`.

### Der wichtigste Fund: ein zusaetzlicher Zufallszug aendert die STADT

Die Fassadenbremse wich mit `randi()` aus - ein zusaetzlicher Zug aus
dem gemeinsamen Zufallsstrom, und zwar nur manchmal, naemlich wenn der
Nachbar dieselbe Textur hatte. Damit verschob sie alles, was danach
gewuerfelt wird: Hoehen, Schmuck, welche Lots frei bleiben. Jede Messung
verglich deshalb zwei VERSCHIEDENE Staedte.

Erkennbar war es am fehlenden Vorzeichen. Zeichenaufrufe gegen dieselbe
Fassung ohne die Bremse:

| Weltkeim | "Preis" der Fassadenbremse |
|---|---|
| 4711 | +32,5 |
| 8080 | +50 |
| 1234 | **-15** |

Ein Effekt, der je Stadt das Vorzeichen wechselt, ist kein Effekt der
Bremse.

**Damit sind alle frueheren Leistungsvergleiche aus Teil E ungueltig.**
Insbesondere diese hier berichteten Zahlen sind WIDERLEGT und duerfen
nicht weiterverwendet werden:

| widerlegte Aussage | was wirklich gilt |
|---|---|
| "die Bremsen kosten +35 Aufrufe und +423.000 Dreiecke" | seedabhaengig zwischen +20 und +50 Aufrufen und +100k bis +409k Dreiecken - kein stabiler Effekt |
| "die Modellbremse waehlt teurere Modelle" | sie waehlt nichts Teureres: +3 Meshes, +6.375 Dreiecke |
| "Fassadenwiederholung 20,7 Prozent" | mit geometrischer Gruppierung gemessen, die freistehende Bauten mitzaehlt; nach Zeilenkennung sind es 0 Prozent |
| "lotZuSchmal ist ein Altbefund" | falsch, er wird von der Lotbreitenbremse verursacht |
| "zwei Beete versperren bei Keim 1234 Gehnetz-Kanten" | kein Moebel war beteiligt; der Pruefstand zaehlte einen Kollider in 16 m Hoehe als Bodenhindernis (siehe 6i) |
| Bildpunktvergleich zweier Aufnahmen als Mass fuer optische Aenderung | UNGEEIGNET: zwei Laeufe derselben Fassung unterscheiden sich schon in 3 bis 10 Prozent aller Bildpunkte, weil Verkehr und Passanten laufen. Ersetzt durch menschliche Durchsicht fester Aufnahmen. |
| Gehnetz 1468 gegen 1463 Knoten als Regression von Stufe 5 | KEINE Regression: die fuenf Knoten lagen alle ausserhalb der Stadt, der Graph wurde anteilig sogar besser (siehe 6g). Heute sind es 1481. |
| "zwischen zwei Reihenhaeusern klafft eine Geometrieluecke" | WIDERLEGT: groesste Hindernis-Luecke 0,01 m, ueber fuenf Keime keine einzige zwischen 0,02 und 0,9 m. Der Fehler lag in der Kletterlogik (siehe 6h). |

Das Ausweichen haengt jetzt am ORT und zieht keinen Zufall. Der Beweis,
dass der Strom unberuehrt bleibt: die Haeuserzahl ist mit und ohne die
Bremse identisch - 617/617, 597/597, 599/599 bei 4711, 1234, 8080.
Vorher unterschied sie sich.

**Regel fuer alles Weitere: kein zusaetzlicher Zug aus dem gemeinsamen
Zufallsstrom.** Wer eine neue deterministische Entscheidung braucht,
leitet sie aus Weltkeim, Block, Lot, Zeilenkennung oder Weltposition ab.

### Die drei Bremsen, einzeln schaltbar

`window.__WEBHERO_BREMSEN` nimmt eine Zeichenkette aus A (ungleiche
Lotbreiten), B (Fassade) und C (Modellwahl). Nur zum Messen; im Spiel
sind alle drei an.

C ist die einzige, die sich sauber isolieren laesst: sie zieht keinen
Zufall, also ist AB gegen ABC dieselbe Stadt mit nur anderer
Modellzuordnung. Ergebnis: +3 Meshes, +6.375 Dreiecke, Entropie der
Modellwahl 3,434 gegen 3,437 bit. Ein kostenbewusster Ersatz wurde
deshalb NICHT gebaut - es gibt nichts zu sparen.

### Wiederholung ueber fuenf Weltkeime

Exakt nach Zeilenkennung gruppiert, ALT heisst alle drei Bremsen aus:

| Keim | Modell ALT | NEU | Fassade ALT | NEU | 3 Fassaden ALT | NEU | haeufigste Lotfolge ALT | NEU |
|---|---|---|---|---|---|---|---|---|
| 4711 | 29,3 % | 4,7 % | 30,8 % | 0 % | 6 | 0 | 49 Kanten | 5 |
| 1234 | 29,9 % | 2,1 % | 32,5 % | 0 % | 5 | 0 | 40 | 6 |
| 8080 | 33,7 % | 1,2 % | 32,4 % | 0 % | 5 | 0 | 47 | 6 |
| 20250914 | 33,3 % | 3,7 % | 34,2 % | 0 % | 5 | 0 | 51 | 7 |
| 777 | 28,1 % | 4,7 % | 25,5 % | 0 % | 6 | 0 | 46 | 7 |

Die Hoehenaehnlichkeit (Unterschied unter 1 m) verbessert sich NICHT -
ALT 8,3 bis 13,1 Prozent, NEU 7,7 bis 13,4 Prozent. Das ist erwartbar:
es gibt keine Hoehenbremse. Es wird hier nicht als Gewinn gefuehrt.

### Hoehenrhythmus: gemessen, nicht geglaettet

Median der Differenz zwischen unmittelbaren Nachbarn einer Zeile:

| Keim | WOHN | UFER | MISCHUNG | GESCHAEFT | ZENTRUM |
|---|---|---|---|---|---|
| 4711 | 3,8 | 6,0 | 6,3 | 8,2 | 16,5 |
| 1234 | 3,4 | 8,5 | 6,5 | 12,8 | 27,4 |
| 8080 | 3,2 | 6,5 | 7,3 | 7,1 | 8,0 |
| 20250914 | 3,3 | 4,1 | 5,8 | 8,1 | 18,3 |
| 777 | 3,4 | 7,2 | 6,8 | 10,9 | 17,8 |

Das Gefaelle WOHN unter MISCHUNG unter GESCHAEFT unter ZENTRUM haelt in
vier von fuenf Keimen; bei 8080 liegt GESCHAEFT mit 7,1 m knapp unter
MISCHUNG mit 7,3 m - GESCHAEFT hat dort nur 15 Nachbarpaare, weil dort
breite Lots stehen und je Kante nur zwei Haeuser passen. UFER liegt
nicht auf dieser Achse nach innen und schwankt entsprechend.

Starker Zickzack (vier Haeuser, abwechselnd, jeder Schritt ueber acht
Meter): **null Faelle in allen fuenf Keimen und allen Stadtteilen.**
Laengster Lauf fast gleicher Hoehen: zwei bis drei. Keine wiederkehrende
Hoehenfolge oefter als zweimal, kein exakter Hoehenwert oefter als
zweimal bei ueber 500 Haeusern - bei stetigem Zufall zu erwarten.

**An den Hoehen wurde nichts geaendert.** Glaetten ohne Befund waere
genau das, was der Auftrag ausschliesst.

### Hohe Akzente

Anteil der Haeuser ab 45 m:

| Keim | WOHN | UFER | MISCHUNG | GESCHAEFT | ZENTRUM | hoechstes | Klumpen ausserhalb 300 m |
|---|---|---|---|---|---|---|---|
| 4711 | 0 % | 6,0 % | 3,2 % | 10,9 % | 40,9 % | 95,6 m | 0 |
| 1234 | 0 % | 8,3 % | 0,9 % | 10,9 % | 47,6 % | 95,2 m | 0 |
| 8080 | 0 % | 4,0 % | 1,3 % | 13,6 % | 31,8 % | 85,1 m | 0 |
| 20250914 | 0 % | 5,9 % | 0,9 % | 15,9 % | 52,3 % | 90,8 m | 0 |
| 777 | 0 % | 7,8 % | 1,0 % | 17,4 % | 38,6 % | 85,5 m | 0 |

Die Hierarchie haelt fuenf von fuenf: ZENTRUM ist der Schwerpunkt,
GESCHAEFT liegt darunter, MISCHUNG und UFER sind Mid-Rise mit einzelnen
Akzenten, WOHN hat in jedem Keim kein einziges Hochhaus. Kein Turmklumpen
ausserhalb der Mischung. Es wurde kein einziges Hochhaus hinzugefuegt.

### Leistung ueber fuenf Weltkeime

| Keim | Aufrufe | Strasse | Dach | Luft | Dreiecke |
|---|---|---|---|---|---|
| 4711 | 848,5 | 798 | 803,5 | 905 | 2.965.887 |
| 1234 | 877 | 823,5 | 818,5 | 951,5 | 3.345.123 |
| 8080 | 845,5 | 806,5 | 812 | 900,5 | 3.491.884 |
| 20250914 | 881,5 | 844,5 | 805 | 939,5 | 3.452.163 |
| 777 | 872 | 835 | 805 | 943 | 3.450.773 |

Hartes Tor 899 Aufrufe und rund 4,16 Millionen Dreiecke: kein Keim
reisst es. Das Teil-E-Ziel von hoechstens 875 ist an zwei Keimen
verfehlt (877 und 881,5). Das wird hier so stehen gelassen und nicht als
Durchschnitt schoengerechnet.

Wiederholung einer Messung an derselben Stadt: 885,5 / 887 / 888 - das
Messrauschen betraegt rund 2,5 Aufrufe.

### Der Human-Befund: zwischen zwei Reihenhaeusern

Ein Mensch fand beim Spielen: klettert man an einer Zeilenfassade hoch,
geraet die Figur an der Grenze zum Nachbarhaus zwischen die Gebaeude,
und die Kamera wird in den Spalt gedrueckt.

Zuerst gemessen, was es NICHT ist. Die Geometrie ist in Ordnung:

| Messung | Ergebnis |
|---|---|
| groesste Hindernis-Luecke zwischen direkten Zeilennachbarn | 0,01 m |
| Luecken stadtweit unter 0,2 m | 442 von 443 |
| Luecken im Bereich 0,02 bis 0,9 m, fuenf Weltkeime | **0** |
| Modellbreite gegen Lotbreite, 400 Modelle | kleinster/mittlerer/groesster Anteil 1,000 |

Es gibt also gar keinen Spalt, in den man geraten koennte.

Die Ursache lag in der Eckenwechsel-Regel beim Klettern: sie behandelte
JEDE Kolliderkante als Aussenecke und setzte die Figur um die Kante
herum auf die Querflaeche, `climbGap` = 0,15 m dahinter. Bei einem
Reihenhaus ist diese Querflaeche buendig im Nachbarhaus vergraben.

Alle 221 Nachbarpaare bei Keim 4711 abgefahren:

| | vorher | nachher |
|---|---|---|
| Wand an den Nachbarn uebergeben | 0 | 221 |
| Wandnormale um 90 Grad gedreht | 221 | 0 |
| steckt in einem Hindernis | 221 | 0 |
| Abstand zur Fassadenebene | -3,25 bis -4,12 m | 0,150 m, jeder Fall |
| Kameraabstand zur Figur | 1,36 m | 6,66 bis 6,72 m |
| Kamera im Hindernis | 5 von 6 | 0 von 6 |

Negativer Abstand heisst: drei bis vier Meter HINTER der Fassade, also
mitten im Nachbarhaus.

Die Korrektur sieht vor dem Eckenwechsel nach, ob hinter der Kante Platz
ist. Steht dort ein kletterbares Hindernis, dessen Schauseite in
derselben Ebene liegt (Toleranz 0,5 m), ist es keine Ecke, sondern eine
Naht: die Wand wird an den Nachbarn weitergereicht. Kein Snappen.

Die Gegenprobe gehoert zum Pruefstand: an 150 echten Aussenecken je
Weltkeim - dem letzten Haus einer Zeile - dreht sich die Wand weiterhin
in 150 von 150 Faellen, null davon faelschlich uebergeben. Bestaetigt an
fuenf Keimen.

---

## 6i. Bekannte Grenzen nach Stufe 5

### lotZuSchmal: sieben Parzellen unter dem Klassenminimum

Die Lotklasse SCHMAL beginnt bei 7,0 m. Bei Keim 4711 liegen sieben
Parzellen darunter, zwischen 6,25 und 6,92 m.

Zugeordnet, nicht vermutet:

| Konfiguration | lotZuSchmal |
|---|---|
| alle drei Bremsen | 7 |
| ohne die Lotbreitenbremse | 0 |
| ganz ohne Bremsen | 0 |

Das ist also KEIN Altbefund, sondern eine Folge der ungleichen
Lotbreiten aus Teil E: die ZAHL der Lots je Kante haelt das Minimum ein,
der Anteil einzelner Lots (0,78 bis 1,22) kann eines darunter druecken.

Beispiele mit Weltkoordinaten:

```
Breite 6,40 m  bei (-290,84 / -253,21)  Tiefe 8,89 m  Blockkante O
Breite 6,67 m  bei (-290,84 / -246,67)  Tiefe 8,89 m  Blockkante O
Breite 6,53 m  bei (-296,58 /  191,08)  Tiefe 9,37 m  Blockkante S
Breite 6,92 m  bei (-289,86 /  191,08)  Tiefe 9,37 m  Blockkante S
```

Ohne Auswirkung auf das Spiel: die Haeuser stehen buendig zu ihren
Nachbarn (groesste Luecke 0,01 m), `lotAufGehknoten` und `hausAufStrasse`
sind null, und ein 6,4 m breites Reihenhaus ist ein glaubwuerdiges
schmales Stadthaus. Wird deshalb dokumentiert und nicht repariert - eine
neue Lot-Architektur ist in Teil E ausdruecklich ausgeschlossen.

### Die zwei "versperrten" Gehnetz-Kanten bei Keim 1234 - widerlegt

Hier stand, zwei Beete versperrten bei Keim 1234 je eine Gehnetz-Kante
vollstaendig, und die Lotbreitenbremse sei die Ursache. **Beides ist
falsch.** Nachgemessen wurde das Querprofil an jeder betroffenen Stelle,
ueber die vollen sechs Meter in Schritten von 0,1 m:

```
KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKHHHHHHHHHHHHHHHHHHHHHHH
. frei   H Hoehensprung   K Kollider   M Moebel
```

Kein einziger Punkt war durch ein MOEBEL blockiert - im ganzen Profil
kommt kein M vor. Das Beet war nur das naechstgelegene Objekt und wurde
deshalb vom Pruefstand benannt.

Die Bodenhoehe der Kante betraegt dort 1,25 m statt 0,25 m, `aufGehweg`
meldet false, und der "blockierende" Kollider reicht von y0 = 16,05 bis
17,05 m - er schwebt sechzehn Meter ueber dem Boden.

Die Ursache lag im Pruefstand: er sah nur x, z und die OBERKANTE eines
Kolliders. Damit galt jedes Hindernis als Bodenhindernis, dessen
Oberkante ueber Kopfhoehe liegt - auch ein Vordach oder eine Hochbahn.
Das Spiel selbst macht es richtig: `collideBody` ueberspringt einen
Kollider, sobald die Kopfhoehe unter seiner Unterkante liegt
(`p.y + 1.75 < c.y0`).

Gegenprobe, damit die Pruefung nicht blind wird: ueber alle 1473
Gehknoten wurden 42.000 Kollider geprueft und 13.533 uebersprungen. Das
kleinste y0 darunter ist 2,70 m - knapp einen Meter ueber dem Kopf.

Neue harte Kennzahl `moebelBlockiertGehkante`: bei einer gesperrten
Stelle wird dieselbe Spur ein zweites Mal gemessen, ohne die Moebel.
Wird sie dann frei, ist das Moebel die Ursache.

| Keim | wirklich gesperrt | moebelBlockiertGehkante | kleinste freie Breite |
|---|---|---|---|
| 4711 | 0 | 0 | 1,60 m |
| 1234 | 0 | 0 | 1,20 m |
| 8080 | 0 | 0 | 1,80 m |
| 20250914 | 0 | 0 | 1,20 m |
| 777 | 0 | 0 | 1,20 m |

Noetig sind 0,90 m. Am Spiel wurde nichts geaendert; das Gehnetz bei
Keim 1234 ist vor und nach der Korrektur identisch (1473 Knoten, 1846
Kanten, 3 Inseln, groesste Insel 1444).

Damit ist auch die fruehere Zuordnung an die Lotbreitenbremse widerlegt:
gemessen wurde nur, dass die Bremse eine andere Stadt erzeugt, in der
die fehlerhafte Pruefung zuschlaegt.

### Die flachen MERGED-Haeuser

Haeuser unter 32 m bleiben prozedurale Kisten mit Fassadentextur. Aus
der Ferne und im flachen Winkel wirken sie flach, weil ihnen die
Fensterlaibungen der Modelle fehlen. Das ist die bekannte Grenze des
hybriden Systems aus Teil D.1 und durch Teil E weder besser noch
schlechter geworden - die Gegenseite der langen Haeuserzeile ist in den
Bildern mit und ohne Bremsen gleich.

---

## 6j. Gesamtabnahme Stufe 5 (Teil F)

Teil F hat nichts gebaut. Er misst, was steht - ueber fuenf feste
Weltkeime: 4711, 1234, 8080, 20250914, 777.

### Was Stufe 5 sichtbar veraendert hat

Derselbe Pruefstand vor Stufe 5 und danach, Keim 4711:

| | vorher | nachher |
|---|---|---|
| Gebaeude | 274 | **617** |
| Gebaeude je Block | 2,49 | **5,61** |
| Blockkanten mit Haus | 217 von 440 | **361 von 440** |
| Haeuser je Kante, Median | **0** | **2** |
| Kantenbelegung, Mittel | 19,6 % | **55,3 %** |
| Kantenbelegung, Median | **0 %** | **74 %** |
| niedrigstes Haus | 14,3 m | 9,8 m |
| hoechstes Haus | 97,0 m | 95,6 m |
| Hoehenmedian | 31,6 m | 23,8 m |
| Hausmodelle | 274 | 405 |
| Kollider | 2.884 | 3.664 |
| Gehknoten | 1.468 | 1.481 |

Die eine Zahl, die alles zusammenfasst, ist die Kantenbelegung im
Median: sie stand bei **null Prozent**. Die haelfte aller Blockkanten
hatte gar kein Haus - es gab keine Strassenwand, nur einzeln stehende
Baukoerper. Heute sind es 74 Prozent.

Die Stadt ist dabei nicht hoeher geworden, sondern voller: der
Hoehenmedian faellt von 31,6 auf 23,8 m, weil die neuen Aussenbloecke
Wohnhaeuser sind. Der Gipfel bleibt (97,0 gegen 95,6 m).

### Stadtteile, Keim 4711

| Stadtteil | Bloecke | Gebaeude | je Block | Hoehe Median | Low | Mid | High | Laden | Wandanteil |
|---|---|---|---|---|---|---|---|---|---|
| ZENTRUM | 24 | 76 | 3,17 | 39,4 m | 0 % | 49 % | 51 % | 33 % | 33 % |
| GESCHAEFT | 12 | 56 | 4,67 | 32,6 m | 0 % | 79 % | 21 % | 50 % | 52 % |
| MISCHUNG | 37 | 230 | 6,22 | 25,4 m | 0 % | 94 % | 6 % | 24 % | 66 % |
| UFER | 11 | 55 | 5,00 | 25,0 m | 0 % | 93 % | 7 % | 14 % | 59 % |
| WOHN | 24 | 164 | 6,83 | 15,7 m | 15 % | 85 % | 0 % | 28 % | 65 % |
| PARK | 2 | 0 | 0 | - | - | - | - | - | - |

Kern gegen neue Aussenbloecke: 49 Bloecke mit 194 Gebaeuden (3,96 je
Block, Hoehenmedian 31,3 m) gegen 61 Bloecke mit 387 Gebaeuden (6,34 je
Block, Median 20,5 m). Der Kern ist hoch und locker, aussen ist es
niedrig und dicht - genau das war das Ziel.

### Leistung, fuenf Keime

Median ueber 300 Aufnahmen, offizieller Kamerasatz:

| Keim | Gesamt | Strasse | Dach | Luft | Dreiecke (Median) | Dreiecke (Max) |
|---|---|---|---|---|---|---|
| 4711 | 847,5 | 801 | 807,5 | 911 | 2.975.243 | 3.921.087 |
| 1234 | 875,5 | 824,5 | 817 | 950 | 3.337.415 | 4.339.902 |
| 8080 | 854,5 | 810 | 823 | 908,5 | 3.483.770 | 4.421.399 |
| 20250914 | 859,5 | 831 | 792,5 | 932,5 | 3.442.444 | 4.459.596 |
| 777 | 868,5 | 837 | 806,5 | 938,5 | 3.460.165 | 4.397.911 |

Bester Keim 847,5, Median 859,5, schlechtester **875,5**. Das harte Tor
von 899 haelt auf allen fuenf. Beim Dreieckstor gilt der MEDIAN: 2,98
bis 3,48 Millionen, alle unter 4,16 Millionen. Der MAXIMALWERT einer
einzelnen Kameraposition liegt bei drei Keimen darueber (bis 4,46
Millionen) - das war vor Stufe 5 ebenso, der Bestandswert lag bei
4.148.713 Dreiecken fuer eine einzelne Aufnahme.

### Determinismus

Derselbe Weltkeim baut dieselbe Stadt: vier Neuladungen bei Keim 4711
und drei bei 20250914 liefern denselben Fingerabdruck ueber
Lotpositionen, Hoehen, Modellzuordnung, Fassaden und Stadtteile, in
Baureihenfolge. Dafuer musste die Modelliste nach Namen sortiert werden;
sie kam vorher aus `szene.children`, und diese Reihenfolge ist zwischen
zwei Ladevorgaengen nicht stabil (siehe Commit-Begruendung).

### Traversal ueber die neuen Dachkanten

Je Weltkeim zwanzig Versuche:

| Uebung | Ergebnis |
|---|---|
| Dachlandung aus zwoelf Metern | 20/20 gelandet, 0 unter Dach, 0 im Hindernis, 0 Teleport |
| Wandklettern bis aufs Dach | 20/20 oben angekommen |
| Auf der Dachkante stehen | 10/10, 0 abgerutscht |
| Gehend aufs Nachbardach | 8 von 12, 7 von 13, 6 von 13 anfahrbaren Paaren |

Beim Gehen aufs Nachbardach faellt der Rest herunter, groesstenteils
dort, wo das Nachbardach deutlich tiefer liegt. Ob das ein Fehler ist
oder richtiges Fallen, ist eine Frage an den Spieltest und wird hier
nicht als Befund gefuehrt.

---

## 6k. Human-Playtest problem-1

### Problem 2: Blockmenschen in Fahrzeugen

An fuenf Stellen wurde ein Fahrzeug mit Insassen gebaut, die keine
Figur, sondern eine Kiste sind - Auto, Lastwagen, eigener Bus,
CITY_LOOK-Bus und Rettungswagen. Sie sind jetzt dauerhaft unsichtbar
(jede Stelle traegt `// siehe INSASSEN-REGEL`), und die zwei Stellen,
die sie spaeter wieder eingeblendet haben, sind weg.

Gemessen: 32 sichtbare Blockfiguren vorher, 0 nachher. Die Leistung
wurde dabei besser, nicht schlechter - 821 / 853 / 831 / 842,5 / 843
Zeichenaufrufe ueber die fuenf Keime, schlechtester Wert 853 statt
vorher 875,5.

Die Regel dahinter: **lieber kein sichtbarer Fahrer als ein sichtbarer
Blockmensch.** Echte Fahrerfiguren brauchen geklaerte Modelle; solange
die nicht im Baum liegen, bleibt der Sitz leer.

### Problem 3: der begehbare Schacht zwischen zwei Haeusern

Der Befund: die Figur klettert in einen senkrechten Spalt zwischen zwei
Haeusern, der architektonisch nichts ist.

**Warum die bestehende Pruefung ihn nicht finden konnte.** Die
Spaltpruefung in `tools/pruef/haeuserzeilen.js` suchte Spalte zwischen
0,02 und 0,9 m - also Spalte, die zu schmal sind. Ein Spalt, in den die
Figur HINEINPASST, ist aber definitionsgemaess breiter als ihre 0,9 m
und lag ausserhalb des Suchbereichs. Neu gemessen wird deshalb der
umgekehrte Bereich (`climbableDeadGap`): 0,9 bis 3,5 m breit,
mindestens 1 m lang ist ein Schacht; ueber 3,5 m eine echte Gasse.

**Zwei widerlegte Zwischenstaende, beide von mir.**

| Behauptung | Messung |
|---|---|
| "Die Quelle ist der Mindestabstand 2,6 m in `passt()` am Ufer" | Falsch. Nach der Aenderung blieben bei Keim 4711 genau dieselben fuenf Schaechte stehen. Die Quelle war `buildFarShore`, wo es ueberhaupt keine Abstandspruefung gab. |
| "Der Mindestabstand laesst sich stromneutral aendern, weil Breite und Hoehe vor `setze()` gezogen werden" | Falsch. Ein abgelehntes `setze()` ueberspringt `makeBuildingMesh`, und das zieht selbst einen Wuerfel fuer die Fassade. Die Zahl der Uferhaeuser sprang von 32 auf 44 - eine andere Stadt. Die Aenderung wurde zurueckgenommen. |

**Was wirklich behoben wurde.** In `buildFarShore` standen vier Haeuser
um einen Hof: der Abstand fest (5,5 + 1 m), die Breite unabhaengig davon
gewuerfelt (7 bis 10 m). Der Zwischenraum war 13 minus die halbe
Breitensumme - je nach Wurf 6 m Hof oder 1,4 m Schlitz. Jetzt wird der
Abstand aus der eigenen Breite berechnet, jede Innenwand steht eine
halbe Gassenbreite von der Blockmitte weg. Damit das auf den 22 m
Bauflaeche aufgeht, ohne dass ein Haus ueber den Gehwegsockel ragt, wird
enger gewuerfelt (7 bis 8,8 m).

Dazu der Schritt der Dreierzeile in `buildBlockBuildings`: 12,2 statt
11,5 m. Der loest keine zusaetzliche Ablehnung aus (noetig waeren
8,5 + 2,6 = 11,1 m) und ist damit stromneutral.

| Keim | Totspalte vorher | nachher | echte Gassen | Haeuser vorher/nachher |
|---|---|---|---|---|
| 4711 | 5 | 0 | 89 -> 94 | 617 / 617 |
| 1234 | 8 | 0 | 76 -> 84 | 597 / 597 |
| 8080 | 4 | 0 | 48 -> 52 | 599 / 599 |
| 20250914 | 1 | 0 | 102 -> 103 | 626 / 626 |
| 777 | 3 | 0 | 96 -> 99 | 592 / 592 |

Gleiche Hauszahl und gleiche Uferhauszahl auf allen fuenf Keimen: der
Zufallsstrom ist unveraendert, die Stadt dahinter dieselbe.

**Das Bild.** `tools/pruef/hof-bilder.js` nimmt dieselben fuenf
Uferbloecke mit der echten Spielkamera auf, von der Strasse und von
oben. Vorher verschluckt der Schlitz die Laterne halb und ist unten
schwarz; nachher steht die Laterne frei in einem durchgehenden,
belichteten Durchgang. Von oben sieht ein tiefer Zwischenraum zwischen
zwei 30-m-Tuermen weiterhin nach Schlucht aus - das ist bei 4 m Gasse
normal und gilt fuer die 94 uebrigen Gassen der Stadt genauso.

### Punkt 1: schwebende Ampel - und versunkene Laterne

`moebelOrt()` rechnet JEDE Hoehe am Stadtmoebel von `SLAB_H` aus, der
Gehweghoehe im Raster, fest verdrahtet. Dieselbe Annahme schlaegt in
beide Richtungen fehl:

| Moebel | Befund | Ursache |
|---|---|---|
| Ampel | 31 von 240 Masten 25 cm ueber dem Boden | aeussere Schale, dort liegt kein Block und damit kein Sockel |
| Laterne | 10 von 100 Masten 25 cm IM Boden | Bruecke, deren Gehweg liegt auf 0,50 m |

`ampelMasten()` fragt jetzt `groundY()` und laesst die Stelle aus -
dort ist nicht einmal Stadt (240 -> 209 Masten). `addLamp()` holt die
Fusshoehe aus `groundY()` und gibt den Versatz an Haltepunkt,
Ersatzform und Modell weiter. Keim 4711: **82 -> 0 Beanstandungen.**

### Punkt 4: Reifen im Bordstein

Der Wagen wird buendig an den Asphaltrand gesetzt und DANACH schief
gedreht. Quer zur Strasse wandert eine Ecke dabei um
`halbL * Schiefe` nach aussen - rund acht Zentimeter bei 25 cm
Bordsteinhoehe. **300 von 300 Wagen** hatten eine Ecke darauf.

`parkautos.js` hat es nie gemeldet, weil es den UNGEDREHTEN Kasten
geprueft hat. Genau der Fall aus der Regel *"Test sagt okay, Bild ist
falsch: Test nicht bestanden"*.

Der Wagen rueckt jetzt um diesen Betrag nach innen, plus zwei
Zentimeter Rest - ohne den Rest blieb ein Millimeter, und schon das
Runden der Pruefwerte liess vier Wagen wieder danebenstehen. Weil das
Ruecken von dem Platz abgeht, der einem Bus bleibt (gemessen 0,10 m),
steht die Schiefe jetzt auf 0,020 statt 0,035: sonst waere davon
0,00 m uebrig, also ein sichtbarer Kontakt gegen einen anderen
getauscht.

**Ecken neben der Fahrbahn 300 -> 0**, Bus 0,10 -> 0,03 m, Bauarten
121/152/27 vorher wie nachher (kein Wurf verschoben).

### Punkt 5: Dachaufbauten ohne Hindernis - bestaetigt, nicht behoben

`deko()` und `merkeTeil()` legen NUR Geometrie an, kein Hindernis.
Gemessen ueber eine Stichprobe von 52 Daechern: **289 von 311
Dachaufbauten halten die Figur nicht auf.** Sie laeuft durch jeden
Lueftungskasten, jedes Rohr, jede Antenne und jedes Klimageraet.

Nebenbei behoben: die Rohre standen mit fester Mitte auf `oben + 1,0`,
ihre Hoehe wurde aber gewuerfelt (1,2 bis 2,4 m). Nur ein Rohr von
genau zwei Metern traf das Dach. Steckende Aufbauten 1 -> 0.

Die Aufbauten fest zu machen ist die richtige Behebung, aber keine
kleine: rund 300 neue Hindernisse je Stadt aendern Landen, Hocken und
Laufen auf den Daechern. Das gehoert gegen `dachtraversal.js` gemessen,
nicht einfach eingeschaltet.

### Der Pruefstand hat in die Ladewolke gemessen

`basis.js` hat auf den ERSTEN Turm gewartet und dann 900 ms. Zu diesem
Zeitpunkt laufen `stadtteile.glb` und `stadtmoebel.glb` noch ein und
`setzeHausModelle()` setzt noch.

Bei Keim 777 kamen fuer im Kern denselben Stand **848,5 / 857 / 863 /
936 / 943 / 948** Zeichenaufrufe heraus, die Zahl der Szenenobjekte
schwankte um 170. Ich habe daraus zuerst gelesen, die Behebung von
Punkt 3 koste 93 Aufrufe und reisse das Tor - **das war falsch.** Der
Gegenbeweis war die Halbierung selbst: 848,5 -> 857 -> 943 -> 863. Eine
Aenderung, die 86 Aufrufe hinzufuegt, und die naechste, die sie wieder
wegnimmt, gibt es nicht.

Gewartet wird jetzt, bis die Zahl der Objekte in der Szene vier
Abfragen lang gleich bleibt. Streuung danach ueber vier Laeufe:
**854,5 bis 860,5** statt rund hundert.

**Alle Zeichenaufruf-Zahlen aus Stufe 5 vor `9bdc592` sind an einer
halb geladenen Stadt gemessen und entsprechend weich.** Die zaehlenden
Pruefungen (Spalte, Ecken, Bodenkontakt, Hauszahlen) sind nicht
betroffen - sie lesen ruhenden Zustand.

### Leistung nach problem-1, fuenf Keime

| Keim | Haeuser | Zeichenaufrufe (Median) | Dreiecke (Median) |
|---|---|---|---|
| 4711 | 617 | 862 | 3,50 M |
| 1234 | 597 | 813 | 3,17 M |
| 8080 | 599 | 815 | 3,20 M |
| 20250914 | 626 | 805,5 | 3,10 M |
| 777 | 592 | 852,5 | 3,40 M |

Schlechtester Wert 862 gegen das harte Tor von 899. **Punkt 3 ist damit
auch auf der Leistung durch.**

### Punkt 7: Gleiten mit W

Widerlegt: es mischt sich KEINE Bodenbewegung in die Gleithaltung. Im
ganzen Testfeld laeuft genau eine Bewegung mit Gewicht 1. Der Koerper
steht auch nicht quer zur Flugrichtung (Abweichung 0 Grad ohne Lenken,
10 Grad mit A/D), und die Nickneigung deckt sich mit der Bahn.

Wirklich falsch war die Schwelle. `gleitNase > 0,55` entscheidet, WER
die Glieder fuehrt:

| Quelle | Armspannweite |
|---|---|
| gerechnete Gleithaltung | 1,26 m |
| Bewegungsdatei StraightDive | 0,21 m |

Beim Lenken mit kurzen W-Stoessen pendelt die Nase um diese Schwelle -
gemessen **30 Wechsel in sechs Sekunden**, Gliedersprunge bis 0,288 m
in einem Bild. Mit getrennten Schwellen (hinein ab 0,80, heraus unter
0,30) sind es **0 Wechsel und 0,003 m**. Der stationaere Sturzflug ist
unveraendert.

Zwei Versuche, die nichts gebracht haben und zurueckgenommen sind: eine
gleitende Ueberblendung nach der Nase war dreimal schlechter (0,782 m),
eine langsamere Nase brachte nur 30 auf 26 Wechsel.

### Punkt 2: echte Fahrer

Der Fahrerpool war bereits richtig - acht Plaetze, 46 m Umkreis, Wahl
des Modells nach Poolplatz ohne Zufallszug. Gemessen bei Keim 4711:
fuenf echte Fahrer sichtbar, kein Platzhalter, keiner ausserhalb des
Fahrzeugs, kein Kopf durch das Dach.

Falsch war der Lkw: sein `fahrerSitz` trug noch `scale: 0.78` aus der
Zeit der einfachen Sitzfiguren. Fensterband 1,55 bis 2,25 m, Huefte
1,12 m - der Kopf landete auf 1,78 m statt 1,97 m, also im untersten
Drittel des Fensters.

**Das hat der Pruefstand nicht gemeldet**, weil "im Fahrzeug" erfuellt
war. Gesehen hat es erst das Bild. Die Pruefung misst jetzt auch, WO im
Fahrzeug der Kopf sitzt.

### Leistung nach allen sieben Punkten

| Keim | Zeichenaufrufe | Dreiecke |
|---|---|---|
| 4711 | 826,5 | 3,17 M |
| 1234 | 829,5 | 3,30 M |
| 8080 | 819 | 3,29 M |
| 20250914 | 786 | 2,97 M |
| 777 | 829 | 3,19 M |

Schlechtester Wert 829,5 gegen das harte Tor von 899 - besser als die
862 vor Punkt 5, obwohl rund 3100 neue Hindernisse dazugekommen sind.
Hindernisse sind Rechenzeit, keine Zeichenaufrufe.

### Eigene Messfehler in diesem Durchgang

Der Befund kam mehrfach aus dem Messgeraet, nicht aus dem Spiel. Vier
Faelle, alle korrigiert:

| Was gemessen schien | Was es wirklich war |
|---|---|
| Punkt 3 kostet 93 Zeichenaufrufe | Der Pruefstand mass in die Ladewolke; Streuung rund 100 |
| 436 Deko-Teile faelschlich mit Hindernis, 582 zu grosse Hindernisse | Die Pruefung suchte das Hindernis nach LAGE und fand das des Nachbarn |
| 11,11 m schwebender Dachaufbau | Der Suchquader fing die Aufbauten des hoeheren Nachbarn mit |
| Vier von fuenf Fahrern ausserhalb ihres Fahrzeugs | Fahrzeugkisten aus Weltmatrizen, die seit dem letzten Zeichnen nicht nachgefuehrt waren |

Dazu ein Fehlgriff anderer Art: bei Punkt 6 hatte ich die Kletterprobe
zunaechst so umgestellt, dass ein Haengenbleiben als "Sims" durchgeht.
Damit war die Beanstandung weg, ohne dass sich etwas geaendert haette.
Zurueckgenommen - eine Beanstandung umzudeuten ist keine Behebung.

### Wo die Anhaenge lagen

Die Bilder und Videos zu problem-1 liegen als **Release** unter dem Tag
`problem-1`, nicht als Issue. Das Projekt hat null Issues und kein
solches Label - danach zu suchen war vergeblich. Sechs Bilder und zwei
Videos (55 s und 115 s), alle ausgewertet.

### Offene Punkte

* Im Verkehr war waehrend der Messung **kein Bus** unterwegs, der
  Busfahrer ist damit ungeprueft. Busse haben einen eigenen Sitzpool
  (`BUS_GAST`).
* Beim Gehen auf ein Nachbardach faellt ein Teil der Versuche herunter
  (7 von 20 erreichen das Nachbardach, 3 fallen, 8 sind zu hoch). Das
  ist eine Frage an den Spieltest, kein gemessener Fehler.
* Ein einzelner Wert `wandDurchdringung` von 0,15 m im Wandkriechen.
  Nachgemessen auf dem Stand VOR Punkt 6 - identisch, also aelter.

---

## 6l. Human-Playtest problem-2

Drei Befunde aus dem zweiten Spieltest: (A) der Wechsel von Haus zu Haus
ruckelt, (B) Dachaufbauten sind weiter durchlaessig, (C) die Haltung beim
Gleiten mit W stimmt nicht. Reihenfolge wie bestellt, ein Punkt nach dem
anderen.

Die Regel dieses Durchgangs steht ueber allem: **ein gruener Pruefstand
ueberschreibt den Human-Befund nicht.** Widersprechen sich Video und
Test, wird zuerst gesucht, WAS der Test nicht misst.

### Punkt A: der Ruck beim Wechsel auf das Nachbarhaus

Gemessen wurde Bild fuer Bild ueber den echten Eingabeweg
(`tools/pruef/kletterstetigkeit.js`). Die Figur wurde an einer echten
Aussenecke in EINEM Bild auf die neue Wandebene gesetzt: 0,15 m
Kletterabstand vor der alten Flaeche plus 0,35 m, um die der Klemmwert
sie hinter die neue Kante zieht - zusammen die 0,50 m, die in der
Messung standen.

Statt des Sprungs laeuft die Figur jetzt einen Bogen um die Kante, mit
dem bereits vorhandenen `WAND_ECK_ZEIT` als Dauer und erhaltener
Tangentialgeschwindigkeit.

| Messung | vorher | nachher |
| --- | --- | --- |
| Ortssprung an der Ecke | 0,5042 m | 0,0646 m |
| Ortssprung an der Naht | 0,48 m | 0,0647 m |
| Ortssprung ueber vier Ecken | 1,466 m | 0,274 m |

`zeilenuebergang.js` blieb dabei unveraendert gruen (221 von 221
Uebergaben, 150 von 150 Aussenecken erkannt).

### Punkt A.1: die Kletterkamera klebt an der Figur

Der Human-Befund nach Punkt A: beim Klettern klebt die Kamera an der
Figur und zeigt fast nur noch Wand.

**Was der erste Pruefstand nicht gemessen hat.** `kletterkamera.js`
stellte die Figur an eine freie Fassade, an eine Aussenecke, in eine
enge Gasse und tief an die Wand - in allen vier Lagen blieb der Abstand
bei 6,4 m, kein einziges Bild eingeengt. Die Lage aus dem Video ist eine
fuenfte: dicht unter der Dachkante eines NIEDRIGEN Hauses, dessen
hoeherer Nachbar buendig danebensteht. Dort klemmt es, und zwar in
**90 von 90 Bildern auf 0 m**.

**Die Ursache, nachgerechnet.** Fuer die Sichtpruefung wird jeder
Kollisionskasten um den Kameraradius von 0,30 m aufgeblasen. Beim
Klettern steht die Figur aber nur 0,15 m vor der Fassade, und an der
Naht steht der hoehere Nachbar gemessen 0,195 m neben dem Blickpunkt.
Der Startpunkt des Strahls liegt damit IN der aufgeblasenen Huelle, der
Treffer ist null - und zwar in JEDE Richtung. Die Kamera faellt
vollstaendig auf den Kopf der Figur; `lookAt` bekommt den eigenen
Standort und liefert die Einheitsdrehung, im Protokoll als Blick
`(0,0,-1)` zu erkennen.

`kameraWandAnker` haette den Blickpunkt vor die Wand schieben sollen,
steigt aber aus, sobald der Punkt ueber der Oberkante der bekletterten
Wand liegt (`ankerAus: "ueber der Wand"`) - genau der Fall dicht unter
der Dachkante.

**Der Ausweg.** Fuer einen Kasten, in dessen Huelle der Blickpunkt schon
steht, gilt der Abstand, den der Blickpunkt ohnehin hat, als Radius: die
Kamera darf so dicht heran wie die Figur selbst steht, aber keinen
Zentimeter dichter. In den Kasten hinein kommt sie weiterhin nicht,
`begrenzeKamera()` bleibt in Kraft.

**Zweite Ursache, beim Nachmessen gefunden.** In einer Zeile stehen die
Haeuser buendig. Dreht die Figur um die Aussenecke, zeigt die
Kletternormale auf das Nachbarhaus, und der Schub von `kameraWandAnker`
setzte den Blickpunkt MITTEN in dessen Kollider (Anker bei x = -294,94
im Kasten, der bei x = -295,28 beginnt). Der Schub gilt jetzt nur noch,
solange der Zielpunkt frei ist.

| Messung (Keim 4711) | vorher | nachher |
| --- | --- | --- |
| Naht-Lage: Bilder eingeengt | 90 von 90 | 0 von 90 |
| Naht-Lage: Kameraabstand | 0 m | 6,4 m |
| Kamera klebt, Blickpunkt frei (Kontrolle) | 12 | **0** |
| Kamera klebt, Blickpunkt frei (Uebergang) | 27 | **0** |
| freie Fassade / eng / tief / Ecke | 6,4 m | 6,4 m |
| Bildschirmfoto an der Naht | Wand, keine Figur | Figur und Stadt |

### Zwei eigene Messfehler in Punkt A.1

* Der erste Versuch schob den Ankerpunkt zusaetzlich vor JEDE
  benachbarte Wand. Er hat **nichts** geaendert - Kamerasprung 6,4053 m
  vorher wie nachher, auf die Nachkommastelle gleich. Zurueckgenommen.
* Der zweite Versuch rechnete den Abstand zum Kasten als Luftlinie. Der
  Kasten wird aber achsweise aufgeblasen: 0,15 m in x und 0,20 m in z
  ergeben 0,25 m Luftlinie, der Punkt liegt bei einem Radius von 0,23 m
  aber trotzdem noch in der Huelle. Richtig ist der groesste
  Achsabstand.
* `kamBlock()` meldete den Blockierer des ZULETZT geprueften Strahls zu
  der Weite des ERSTEN - `kameraFreierAnteil` laeuft im selben Bild
  mehrfach, zuletzt fuer die kurze Strecke in `begrenzeKamera()`. Zwei
  angebliche Restfaelle waren nur das. Der Hauptstrahl merkt sich seinen
  Blockierer jetzt selbst.

### Was in Punkt A.1 offen bleibt

In 58 (Kontrolle) und 43 (Uebergang) Bildern steckt der Blickpunkt
wirklich IM Gebaeude - genau die Bilder, in denen auch
`playerInsideBuilding` anschlaegt. Dort steht schon die FIGUR im
Nachbarhaus, weil zwei Haeuser einer Zeile buendig aneinandergrenzen
(Kollider 32 endet bei x = -305,335, Kollider 49 beginnt bei
x = -305,330). Von der Kamera aus ist das nicht zu heilen: ein
Blickpunkt ohne Luft hat keine freie Richtung. Das ist ein eigener
Befund an der Kletterflaeche, nicht an der Kamera, und bleibt notiert.

### Punkt B: durch die Dachaufbauten hindurch

Der Human-Befund: die Figur laeuft weiter durch Dachaufbauten. Der
Pruefstand meldete dazu `playerInsideRoofProp 0`.

**Was er nicht gemessen hat**, drei Dinge auf einmal:

1. Angelaufen wurden nur Aufbauten ab 0,60 m Breite - also genau die,
   die seit problem-1 ein Hindernis haben. Rohre (0,35 m) und Antennen
   (0,22 m) sind absichtlich durchlaessig und kamen in der Stichprobe
   nie vor. Das sind 1518 der 4612 Aufbauten.
2. Geprueft wurde nur die ENDLAGE. Wer hindurchlaeuft, steht am Ende
   dahinter und faellt nicht auf.
3. Geprueft wurde ein PUNKT auf Huefthoehe, kein Koerper.

Gemessen wird jetzt ueber den ganzen Weg, Bild fuer Bild, mit Kapsel
(Radius 0,45 m), Becken und Brust. Gezaehlt wird die Eindringtiefe, nicht
die Beruehrung - wer richtig vor einem Hindernis steht, steht genau einen
Koerperradius davor, und das ist kein Fehler.

**Die Behebung.** Auch duenne Aufbauten werden fest, aber als `klein`
und `keinKlettern`: man laeuft nicht mehr hindurch, kann sich aber auch
nicht an einem 22 cm dicken Mast hochziehen. Genau so sind Laternen,
Ampeln und Poller eingetragen.

**Zweite Ursache.** Die Bewegung `kante` - das Ueberziehen auf das Dach -
interpoliert die Figur von der Wand auf die Dachflaeche und fragt dabei
kein Hindernis; `collideBody` laeuft in diesem Zustand gar nicht. Steht
am Landepunkt ein Aufbau, wandert der Koerper durch ihn hindurch.
Niedriges (bis 0,9 m) wird deshalb zum Absatz, auf dem die Figur
ankommt; bei Hoeherem wandert der Landepunkt bis zu zwei Meter weiter.

| Messung (Keim 4711, 113 Begegnungen) | vorher | nachher |
| --- | --- | --- |
| playerCapsuleInsideRoofProp | 22 | 2 |
| pelvisInsideRoofProp | 16 | **0** |
| torsoInsideRoofProp | 15 | **0** |
| ganz hindurchgelaufen | 22 | 4 |
| Rohr: Koerper im Sichtbaren | 10 von 21 | 0 |
| Antenne: Koerper im Sichtbaren | 9 von 21 | 0 |
| Dachaufbauten ohne Hindernis (52 Daecher) | 99 von 311 | **0** |
| Bild: von oben auf ein Rohr | Rohr durch die Brust | hockt obenauf |

Zurueckgenommen, weil schlechter gemessen: eine schaerfere Fassung des
Landepunkts, die nur ueber der nackten Grundflaeche obenauf ankommt und
sonst bis zu 3,6 m ausweicht - Koerper im Sichtbaren 2 -> 3, Becken
0 -> 1, ganz hindurch 4 -> 6. Wer weit ausweicht, landet im naechsten
Aufbau.

Regression: `node --test` 170 von 170; `dachtraversal` 0 auffaellige
Versuche (aufs Nachbardach 7 -> 8); `dachhohlraum` 0 roofCavity, aufs
Dach 26 -> 27; `zeilenuebergang` 221 von 221 und 150 von 150;
`moebel-boden` 0 Beanstandungen; `wandlauf` 0 von 14 fehlerhaft;
`wandkriechen` unveraendert; `kernsysteme` alle Valid-Zaehler null. Das
Leistungstor ist nicht beruehrt: Hindernisse sind keine Zeichenaufrufe,
und die Sichtbarkeit der Aufbauten aendert sich nicht.

### Was in Punkt B offen bleibt

Zwei der 113 Begegnungen bleiben: ein Dachkasten, den die Figur beim
Haengen an der Dachkante mit der Schulter streift (0,31 m und 0,12 m,
kein Koerperpunkt im Sichtbaren). Das ist dieselbe Bewegung wie oben,
aber am Rand: der Landepunkt ist frei, der WEG dorthin nicht. Ein
vollstaendiger Test des Weges hiesse, die Kante-Bewegung neu zu bauen;
das gehoert gemessen und einzeln entschieden, nicht nebenbei.

### Punkt C: die Haltung im Gleitflug mit W

Der Befund betrifft nicht mehr das Umschalten (das ist problem-1 Punkt 7)
sondern das Aussehen. Das ist keine Zahl, sondern eine Wahl, und sie
gehoert dem Menschen. Vorgelegt wurden drei Haltungen - derselbe Rig,
dieselbe Bewegung, nur andere Zielpunkte fuer Haende, Ellbogen, Fuesse,
Knie und Kopf (CHARACTER LOCK):

* **A** der Stand bis hierher: Arme weit zur Seite, Beine leicht gespreizt
* **B** Deltasegel: Arme nach hinten gepfeilt, Beine geschlossen
* **C** Sturzbereit: Arme dicht am Koerper, Kopf hoeher, Beine gestreckt

**Gewaehlt wurde B.** A und C bleiben im Quelltext stehen, damit der
Vergleich nachvollziehbar bleibt; `tools/pruef/gleit-haltung.js`
fotografiert alle drei aus drei Richtungen.

### Zwei Messfehler beim Bauen dieses Pruefstands

1. Ausgeloest wurde nach 110 Bildern. Da ist die Nase bei 1,0 und der
   Sturzflug laeuft - ein eigener Clip, in dem `poseGleiten` gar nicht
   mehr vorkommt. Alle drei Vorschlaege sahen gleich aus, weil keiner
   von ihnen zu sehen war.
2. Ausgeloest wurde, sobald die Nase 0,55 erreicht - mit W von Anfang an
   ist das nach einer knappen Viertelsekunde. Die Gleithaltung ist dann
   erst zu **0,52** eingeblendet (`gleitMisch`), das Haltungsgewicht
   liegt bei 0,47, und den Rest fuehrt die Bewegungsdatei.

Aus Fehler 2 ist ein **Befund entstanden, der keiner war**: die Haltung
schien schief zu stehen, ein Fuss 0,46 bis 0,62 m tiefer als der andere.
Mit voll eingeblendeter Haltung (`gleitMisch` 0,995) gemessen:

| links gegen rechts | halb eingeblendet | voll eingeblendet |
| --- | --- | --- |
| Fuss, Hoehe (A / B / C) | 0,46 / 0,61 / 0,62 m | **0,03 / 0,06 / 0,06 m** |
| Knie, Hoehe | 0,26 / 0,39 / 0,39 m | **0,12 / 0,12 / 0,13 m** |
| Hand, Hoehe | 0,28 / 0,32 / 0,27 m | **0,01 / 0,01 / 0,02 m** |

Die Haltung steht also symmetrisch; gemessen wurde eine halbe Sekunde zu
frueh. Die Schieflage ist zurueckgezogen. Die Einblendung selbst ist in
Ordnung: `gleitMisch` laeuft mit der Rate 6, nach gut 0,8 s ist sie
durch.

Der Pruefstand laesst jetzt erst den Gleitflug voll einblenden und
drueckt dann W - so, wie man auch wirklich spielt.

### Punkt A.2: vergrabene Kletterflaechen - Spielfehler, aber nicht behoben

Aus Punkt A.1 blieben 58 bzw. 43 Bilder, in denen die Figur laut Messung
im Nachbargebaeude stand. Zuerst war zu klaeren, was der Auftrag
ausdruecklich verlangt: Spielfehler oder Auswahlfehler des Pruefstands?

**Der eigene Messfehler zuerst.** `freieSeite()` hat geprueft, ob vor der
MITTE einer Schauseite Platz ist. Eine Wand kann in der Mitte sechs
Meter frei sein und an ihrem Ende im Nachbarn stecken. Geprueft wird
jetzt an der Stelle, an der die Figur wirklich haengt.

**Der echte Eingabeweg** (`tools/pruef/kletterflaeche.js`): die Figur
steht auf der Strasse, laeuft mit Anlauf in die Fassade, die normale
Anklebe-Logik entscheidet, dann klettert sie und kriecht seitwaerts.
Nichts wird gesetzt, kein Zustand erzwungen, keine vergrabene Wand als
Startflaeche gewaehlt.

Ergebnis: **ja, ein echter Spieler kommt dorthin.** 415 Bilder mit
weniger als 0,60 m Platz vor der Wand (climbGap 0,15 plus Koerperradius
0,45), 576 Bilder im Nachbargebaeude. Beispiel: Kollider 52, Schauseite
nz = -1 bei z = -243,835, davor Kollider 45 bis z = -243,830.

**Wodurch** geraet sie dorthin? Mitgeschrieben wurde jeder Eintritt mit
der Lage davor und danach. Es gibt genau eine Art: **seitwaerts auf
derselben Flaeche**, von 2 m freiem Platz auf 0,1 m. Nicht beim
Ankleben, nicht ueber die Ecke, nicht ueber die Naht.

Zur Einordnung, ueber die ganze Stadt: von 7404 Schauseiten sind 4283
frei, 16 liegen an einer Gasse, 3105 sind vergraben. Das ist normal -
in einer Haeuserzeile stossen die Seitenwaende aneinander. Ein Fehler
ist nur, dass die Figur in einen solchen Abschnitt hineinkriechen kann.

**Fuenf Fassungen wurden gemessen, alle sind zurueckgenommen:**

| Eingriff | Ergebnis |
| --- | --- |
| aus dem Nachbarn herausschieben | Ortssprung **19,795 m** in einem Bild, Flattern 0 -> 18 |
| auf die letzte freie Stelle zurueck | Ortssprung **40,168 m**, im Gebaeude 43 -> 268 |
| den seitlichen Schritt nicht zulassen | im Gebaeude 43 -> **893**, Flattern 0 -> 24 |
| Ecke ohne Platz sperren | Bilder ohne Platz 415 -> **588** |
| auf den freien Abschnitt klemmen | **ohne Wirkung** (415 -> 415) |

Der gemeinsame Grund: die seitliche Klemmung arbeitet mit der Flaeche,
die die Naht-Uebergabe aus Punkt A gerade gesetzt hat. Wer hier
eingreift, greift in die Uebergabe ein - und die ist LOCKED. Der Befund
ist damit **belegt, eingegrenzt und offen**; er gehoert zusammen mit der
Uebergabe entschieden, nicht daneben. Im Quelltext steht er an der
Klemmstelle.

**Nebenbefund, sauber getrennt.** `kletterLage()` meldet jetzt, WAS da
steckt: die eigene Dachkrone oder ein fremdes Haus. Beim Klettern an der
eigenen Fassade schneidet die Dachkrone die Brust (Kollider 741, Band
19,72 bis 20,42 m, 0,25 m vor der Fassade) - das ist ein Vorsprung des
BEKLETTERTEN Hauses, kein Nachbar. Die Vorsprungs-Logik im Kletterzweig
fasst nur Kollider mit `klein`; die Dachkrone ist seit problem-1 Punkt 6
ausdruecklich nicht `klein`. Auch das ist notiert, nicht behoben.

### Punkt B: die Stelle aus dem Video, nachgefahren

`tools/pruef/dachprop-video.js` faehrt dieselbe Dachreihe zweimal ab -
einmal auf dem Stand vor Punkt B, einmal jetzt - mit der echten
Spielkamera, gleicher Weg, gleiches Tempo. Gefunden wird ein Dach auf
15,2 m mit 15 Aufbauten auf einer Linie, davon 3 duenne.

Die beiden Restkontakte aus der Messung sind jetzt klassifiziert
(Punkt B2/B3):

| | Dachkasten 1 | Dachkasten 2 |
| --- | --- | --- |
| Eindringtiefe der Kapsel | 0,31 m | 0,12 m |
| Bilder mit Kontakt | 9 (0,15 s) | 3 (0,05 s) |
| Becken im Kasten | 0 | 0 |
| Torso im Kasten | 0 | 0 |
| **Schulterknochen im Kasten** | **0 Bilder** | **0 Bilder** |

Damit ist die Bedingung aus B3 erfuellt: kein Koerperpunkt im
Sichtbaren, keine Schulter, die mehrere Bilder im Kasten verschwindet,
und hindurchlaufen kann die Figur nicht. Es bleibt ein kurzer
Beruehrungskontakt beim Haengen an der Dachkante.

### Punkt A.2, zweiter Durchgang: Exposed Climb Regions

Der Human-Test hat den ersten Durchgang abgelehnt - die Figur buggt
weiter in Gebaeude. Der Befund war belegt, die Behebung fehlte.

**Das Flaechenmodell war das Problem.** Eine Kolliderseite galt ueber
ihre ganze Laenge als kletterbar. Eine 20 m lange Seitenflaeche kann
aber auf den ersten zwoelf Metern frei sein und auf den letzten acht im
Nachbarhaus stecken. Die Figur klebt bei 5 m richtig an und kriecht bis
17 m weiter.

Gefragt wird deshalb nicht mehr "ist diese Seite kletterbar?", sondern
**"welcher Abschnitt dieser Seite ist von aussen erreichbar?"**
`freieAbschnitte()` spannt vor der Wand einen flachen Quader auf, so
tief wie die Figur braucht (Kletterabstand 0,15 plus Koerperradius 0,45
= 0,60 m). Jeder solide Kollider darin schneidet seinen Laengsbereich
heraus; uebrig bleiben die freien Abschnitte. Die Hoehe geht mit ein -
ueber einem niedrigeren Nachbarn ist dieselbe Stelle wieder frei.

Die Gebaeudekollider bleiben unveraendert. Das betrifft nur die Frage,
wo geklettert werden darf.

**Wo der Riegel sitzt.** Gemessen wurde zuerst, WODURCH die Figur
ueberhaupt auf eine vergrabene Stelle geraet - mit der Lage davor und
danach. Es waren nicht das Ankleben und nicht das Kriechen, sondern
**drei Eckwechsel und eine Naht-Uebergabe**. Genau dort wird jetzt
geprueft, und zwar an der Stelle, an der die Figur NACH dem Wechsel
haengt. Zusaetzlich klemmt die seitliche Bewegung auf den freien
Abschnitt, in dem die Figur vor dem Schritt hing.

| Kennzahl (echter Eingabeweg, Keim 4711) | vorher | nachher |
| --- | --- | --- |
| exposedSurfaceViolation | 415 | **0** |
| playerInsideNeighborWhileClimbing | 576 | **0** |
| buriedSurfaceEntry | 4 | 3 |
| climbOnBuriedFace | 459 | 30 |
| playerInsideBuilding (Stetigkeitsmessung) | 58 / 43 | **0 / 0** |

Die 30 verbliebenen Bilder haben **mehr** als 0,60 m Platz vor der Wand
(exposedSurfaceViolation 0) - sie liegen auf der Grenze zwischen zwei
Abschnitten, wo die Intervallpruefung und die Tiefenmessung um wenige
Zentimeter auseinanderlaufen. Die drei Bilder "im Gebaeude" sind die
EIGENE Dachkrone, ein eigener Befund.

**Was dabei nicht funktioniert hat und zurueckgenommen ist:** die
Pruefung an der Stelle VOR dem Wechsel (Naht 221 -> 0, Aussenecke
150 -> 0 - der Riegel verwirft dann jede Uebergabe, weil die Figur dort
noch 0,2 m vor der Kante des alten Hauses steht), und die Dachkrone in
die Vorsprungs-Schleife des Kletterzweigs aufzunehmen (Bilder im fremden
Gebaeude 3 -> 597, weil die Figur dann 0,40 m vor der Wand steht und
ihren freien Abschnitt verlaesst).

Regression: `node --test` 170/170, Naht 221/221, Aussenecke 150/150,
dachtraversal 20 von 20 aufs Dach und 0 auffaellige Versuche,
dachhohlraum roofCavity 0, wandkriechen 0 fehlerhafte Richtungen,
wandlauf 0 von 14, kernsysteme climbSurfaceGap 0 und wallrunFailed 0.

### Kletterkamera am Dach: die nachziehende Lage

Der Human-Screenshot zeigt ein Bild, das praktisch vollstaendig aus
einer braunen Gebaeudeflaeche besteht. `kletterkamera.js` war in allen
synthetischen Lagen gruen - er misst den Abstand und ob die Kamera in
einem Kollider steckt. Beides kann stimmen, waehrend die Kamera nur eine
Wand filmt.

`tools/pruef/kletterkamera-sicht.js` misst deshalb die SICHT: drei
Strahlen von der Kamera zu Kopf, Brust und Becken, ueber den echten
Eingabeweg (Strasse, Anlauf, ankleben, hochklettern bis aufs Dach).

**Zwei eigene Messfehler zuerst.** Der Stand hielt 2,2 m unter der
Dachkante an und fand nichts - das Bild entsteht aber erst beim
Ueberziehen. Und die Tastpunkte liefen bis an den Knochen heran; der
letzte liegt regelmaessig IN der Wand, an der die Figur haengt. Das ist
Koerperkontakt, keine Verdeckung, und meldete 14 Bilder "ganz verdeckt",
die in Wahrheit frei zu sehen waren. Die letzten 35 cm zaehlen jetzt
nicht mehr mit.

**Der Befund.** Beim Ueberziehen auf das Dach faellt der Kameraabstand
auf 1,35 m - die Kamera steht auf dem Blickpunkt. Dabei ist der
Hauptstrahl frei: `geklemmt 6,4` von `wunsch 6,4`. Die Ursache liegt
hinter der Glaettung: `camPos` zieht nach und haengt waehrend der
schnellen Bewegung noch unter der Dachkante, waehrend die Figur schon
darueber ist. Die Strecke Blickpunkt-camPos schneidet dann das Dach, und
`begrenzeKamera()` holt die Kamera bis auf den Blickpunkt heran.

Dazu kam: waehrend `kante` wird `wallInfo` auf null gesetzt - die Figur
haengt ja nicht mehr. Die Kamera fiel damit auf die normale Luftkamera
zurueck, ohne Ankerpunkt vor der Fassade.

**Behoben.** Die Wand, ueber die gerade gezogen wird, bleibt fuer die
Kamera stehen, bis die Bewegung durch ist. Und ist die GEWUENSCHTE Lage
frei und nur die nachziehende verdeckt, wird schneller nachgefuehrt
statt zusammengefallen. Der Abstand wird nicht erzwungen - er bleibt
der, den die Geometrie hergibt.

| Messung (echter Eingabeweg, Keim 4711) | vorher | nachher |
| --- | --- | --- |
| kleinster Kameraabstand beim Ueberziehen | 1,35 m | **6,42 m** |
| playerFullyOccluded | 1 von 204 | 1 von 204 |
| Bild beim Ueberziehen | Dachflaeche ohne Orientierung | Figur und Stadt |

Die eine verbliebene Verdeckung ist ein Bild, in dem ein Koerperpunkt
waehrend des Ueberziehens die bekletterte Wand beruehrt - dieselbe
Animation, ein eigener kleiner Befund.

Regression: `node --test` 170/170, kletterkamera 0 von 150, 0 von 90 und
0 von 220 Bildern eingeengt, kletterstetigkeit playerInsideBuilding 0,
Naht 221/221, Aussenecke 150/150, innen-kamera 0 Bilder mit der Kamera
in einer Wand, innenraum 0 von 209 Blickpunkten durch eine Wand,
dachtraversal 20 von 20 und 0 auffaellige Versuche.

### Punkt C, zweiter Durchgang: eine gebaute Gleithaltung

Der Human-Test hat B abgelehnt - "sieht praktisch genauso schlecht aus
wie vorher". Das war richtig: A, B und C waren dieselbe Mechanik mit
anderen Zielpunkten. Eine Zweiknochen-Kette loest Ober- und Unterarm so,
dass die HAND am Ziel landet; steht das Ziel 0,45 m seitlich, ist der
Arm fast gestreckt. Daher die Seestern-Silhouette.

**D gibt jedem Knochen seine Richtung vor**, einzeln, im koerpereigenen
System (quer / laengs / hoch). Der Ellbogen ist gebeugt, weil Ober- und
Unterarm verschiedene Richtungen bekommen - nicht, weil ein Polvektor
ihn zufaellig dorthin drueckt. Der Koerper wird weiter an der
Flugrichtung ausgerichtet; daran haengt die Physik und die Netzhaut. Der
Rig bleibt unangetastet.

**Ein Versuch dazwischen, zurueckgenommen:** die Haltung ueber lokale
Eulerwinkel zu setzen und die rechte Seite ueber Vorzeichen zu
spiegeln. Der Pruefstand hat alle acht Vorzeichenkombinationen
durchprobiert - in KEINER stand die Figur symmetrisch, die kleinste
Abweichung an der Hand war 0,30 m. Die Ruheausrichtung des Rigs ist kein
einfaches Spiegelbild. Ueber Richtungen im Koerpersystem gebaut ist die
Haltung von selbst symmetrisch (0,03 m).

**Die Spannweite ist ausgesucht, nicht geraten.** `gleit-bau.js` zeigt
vier Spannweiten nebeneinander in einem Browserstart:

| Kandidat | Handspannweite | Eindruck |
| --- | --- | --- |
| eng | 0,89 m | Arme am Koerper, Netzhaut nicht zu sehen |
| **mittel** | **1,06 m** | **gewaehlt** |
| weit | 1,16 m | wieder fast im T |
| weit/ab | 1,11 m | wie mittel, Arme tiefer |

Cruise und Dive bleiben getrennt: der Sturzflug laeuft weiter ueber
seinen eigenen Clip mit der Hysterese aus problem-1 Punkt 7, die
Ueberblendung haengt an der Zustandszeit und nicht an `gleitNase`.

Regression: `node --test` 170/170; gleitflug 0 Beanstandungen, Wechsel
der Haltungsquelle 0, groesster Gliedersprung 0,002 m je Bild, fremde
Bewegung in der Pose 0, Koerper quer zur Flugrichtung 0;
sprung-gleiten alle vier Boeden ok und die Flugphysik unveraendert
(Gleitzahl 2,75 gerade und 1,66 mit Nase runter, wie vorher).

---

## 6m. Strassenbaeume und Strassenmoebel (Stufe 6A)

**Vorher (339184b, Keim 4711, `tools/pruef/street-details.js`):** ausserhalb
von Park und Promenade kein einziger Baum. Mobiliar fast nur an den
Ecken: an 128 Kanten dasselbe Muster "Poller@12|Poller@14|Poller@15",
413 Kanten teilten ihr Muster mit einer anderen. Die groesste leere
Gehwegstrecke einer Blockkante lag im Mittel bei 29 bis 31 m, im Zentrum
hatten 78 von 96 Kanten eine Luecke von 20 m und mehr.

**Was hinzukommt:** `baueStrassenDetails()` plant einmal, in
`initActors` direkt nach dem Gehnetz und vor dem ersten Passanten, fuer
jede Blockkante Strassenbaeume (createTree, die vier vorhandenen
Varianten, mit Baumscheibe) und Moebelgruppen - nur Modelle, die es schon
gibt: Bank, Pflanzkuebel (`stadtmoebel.glb`), Muelleimer, Kiosk, Uhr
(`bahnhofmoebel.glb`), Poller (`stadtteile.glb`). Alles steht in der
Moeblierungszone am Bordstein (Stamm 0,8 m vom Rand), genutzt wird
|laengs| <= 11,5 m - die Ecken mit Ampel, Eckpollern und Ueberweg
bleiben frei. Nie vor den Fassaden: dort liegen Eingaenge, Arkaden und
Schaufenster. Dazu die Promenade (zweite Baumreihe, Muelleimer an jeder
zweiten Bank, drei Kioske am Wasser) und Baumgruppen im Inneren der
beiden Parks.

Die Dichten stehen an EINER Stelle (`SD_BAUM`, `SD_GRUPPEN`,
`SD_NUTZUNG`, `SD_SICHT`):

| Stadtteil | Baumabstand | an | Gruppen |
| --- | --- | --- | --- |
| WOHN | 10 m | allen Strassen | Bank am Baum, Muelleimer |
| MISCHUNG | 13 m | allen | Bank am Baum (mit Muelleimer), Muelleimer, Kuebel |
| UFER | 11 m | allen, dazu Promenade | Bank/Baum/Muelleimer, Bank+Muelleimer, Kiosk |
| PARK | 7,5 m, innen Gruppen | Parkrand | Bank am Baum, Muelleimer |
| GESCHAEFT | 14 m | Avenue, Boulevard | Muelleimer, Bank+Muelleimer, Kuebel, Poller |
| ZENTRUM | 15 m | Avenue, Boulevard | Kuebel-Bank-Kuebel, Bank+Muelleimer, Kuebelpaar, Poller, Uhr |

Die Zahl der Gruppen je Kante kommt aus der Summe der Raten (abgerundet,
der Rest per Hash), die Art jeder Gruppe nach ihrem Anteil; eine freie
Gruppe geht in die groesste Luecke der Kante. Baumabstand und
Gruppenabstaende streuen (+-1 m, +-10 Prozent, Poller 1,3 bis 2,1 m) - die
neuen Dinge bilden keine einzige gleichmaessige Dreierreihe, und
benachbarte Baeume haben nie dieselbe Variante.

**Freiraum vor Deko - geprueft an jeder Stelle, bevor etwas gesetzt
wird:** Boden auf Gehweghoehe an Ecken und Mitte (keine Fahrbahn, kein
Schacht, keine Hauseingangsstufe), Zebrastreifen (+0,5 m), Haustuer mit
Vorfeld (+0,3), U-Bahn-Abgang (+1,5), Aufzug (3 m), POI-Anker (3 m),
Bestand (Laterne, Ampel, Beet, Poller, lose Gegenstaende +0,4; jedes
Hindernis +0,3; Parkautos duerfen nur nicht geschnitten werden), Gehnetz
(Knoten und Kanten 0,8 m vom Hindernis - Passanten gehen bis 0,42 m
neben der Kante -, Ueberwege 0,5 m), freier Gehweg nach innen 1,8 m.
Baum: 5,5 m zum naechsten Baum (in Parkgruppen 4 m), 4,2 m zur Laterne,
4,5 m zum Ampelmast; die Krone (Kiste je Variante und Drehung, aus der
Geometrie gerechnet) nicht in einer Hauskiste, einem Leuchtenkopf oder
Ampelausleger, unter 2,65 m ueber dem Gehweg nicht ueber der Busspur von
Avenue und Boulevard (Bus 2,70 m hoch, Kronen ab 2,85 m). Was eine Regel
verletzt, rueckt laengs der Kante oder faellt weg.

**Zufall:** kein Aufruf des Stadtzufalls. Jede Entscheidung kommt aus
`sdHash` (Weltkeim, Block, Kante, Art, Platz); das Anlegen der
THREE-Objekte (uuid) laeuft in einem eigenen Strom, danach wird
`ZUFALL_SEED` zurueckgesetzt - wie `lotsBlock`. Neue Hindernisse haben
eigene Nummern ab 9 000 000, `_kollNr` bleibt unberuehrt. Gemessen
(Fingerabdruck nach dem Laden): Haeuser 617, Lots, 300 Parkautos,
45 Wagen, 12 Gegner und 41 POIs bitgleich mit 339184b.

**Zeichnen und Kollision:** zwoelf Instanzfelder ueber
`setzeMoebelFeld` (vier Baumvarianten mit Aesten und Laub in einer
Geometrie, Baum- und Pflanzscheibe, fuenf Moebelarten, Poller), mit
einer Sichtweite je Art (`SD_SICHT`: Baum 185 m, Muelleimer 110 m - das
Modell hat 3480 Dreiecke, mehr als ein Baum). Kein neues LOD, keine neue
Textur. Hindernisse nur fuer Baumstamm (die Stammkiste +-0,34 wie bei
jedem Baum der Stadt), Bank, Muelleimer, Kuebel, Kiosk und Uhrenmast -
innerhalb des Sichtbaren und erst, wenn das Sichtbare steht; Poller und
Scheiben ohne (wie die Eckpoller).

**Ergebnis (Keim 4711):**

| Stadtteil | Baeume vorher -> nachher | je 100 m | Mobiliar je 100 m | Kanten mit Luecke >= 20 m | mittlere groesste Luecke |
| --- | --- | --- | --- | --- | --- |
| ZENTRUM | 0 -> 45 | 1,23 | 6,1 -> 13,8 | 78 -> 18 von 96 | 29,3 -> 16,0 m |
| GESCHAEFT | 0 -> 42 | 2,30 | 5,8 -> 12,3 | 42 -> 10 von 48 | 30,5 -> 15,4 m |
| MISCHUNG | 0 -> 273 | 4,85 | 6,1 -> 8,9 | 133 -> 11 von 148 | 30,6 -> 14,2 m |
| UFER | 49 -> 153 | 6,79 | 5,6 -> 8,8 | 37 -> 1 von 44 | 29,8 -> 14,0 m |
| WOHN | 0 -> 227 | 6,22 | 6,1 -> 7,3 | 82 -> 5 von 96 | 29,9 -> 12,6 m |
| PARK | 24 -> 62 | 20,4 | 9,2 -> 11,5 | 0 -> 0 von 8 | 14,5 -> 8,6 m |

Neu: 729 Baeume, 670 Baumscheiben, 38 Pflanzscheiben, 183 Baenke,
272 Muelleimer, 120 Pflanzkuebel, 86 Poller, 13 Uhren, 3 Kioske;
1320 neue Hindernisse. Kanten mit gleichem Muster 413 -> 60.

Harte Fehler (street-details.js, Soll 0): Fahrbahn/Loch, Haus, Haustuer,
Zebrastreifen, Bestand, untereinander, Baum in Parkauto, an Laterne,
Ampel oder Baum, Gehweg unter 1,8 m, Gehnetzknoten eingeengt, Kante
gesperrt, Knoten abgeschnitten, Hindernis ohne Sichtbares, Massives ohne
Hindernis, Hindernis groesser als das Sichtbare - alle 0. Freigang
(`freigang.js`, jetzt mit Grundriss, Arkaden und Promenade): alle
Flaechen frei, keine neue Bewegungspfad-Beruehrung; der eine
Arkaden-Befund (Laterne bei -18/150) steht so schon in 339184b.

Leistung (`stadt-leistung.js`, 300 Aufnahmen, gegen 339184b):
Zeichenaufrufe Median 826 -> 837 (+1,3 Prozent, Tor 899), Dreiecke
Median 3,15 -> 3,86 Mio. (+22,6 Prozent, Tor +35); Szene +12 Objekte
(die Felder), +1 Material.

**Pruefstand Top-out angepasst:** `topoutlandung.js` beginnt den Anlauf
fuenf Meter vor der Fassade - das ist die Moeblierungszone. Bei
FlatFacade 169 +z f 0,8 stand ein neuer Stamm auf der Anlaufbahn; bei
MO1 Haus 1 -z liegt der Startpunkt in einem Parkauto (Bestand), das die
Figur 1,2 m zur Seite schiebt - genau vor die neue Bank am Baum. Die
Figur kam nicht an die Wand (Ueberziehen 12/12, Kontrolle 6/6).
Derselbe Code mit `ohneSD` (Stadt ohne 6A): 13/13 und 8/8. Der
Pruefstand nimmt jetzt, wie schon Autos, Passanten und Gegner, die
Strassendetails auf der 3 m breiten Anlaufbahn fuer den Lauf aus der
Kollision; gemessen wird weiter nur das Ueberziehen.

**Regression (Keim 4711, Vergleich 339184b im selben Durchgang):**
`node --test` 170/170. Stadtraster unveraendert (Hindernisse 9697 ->
11017, genau die 1320 neuen). Parkautos 300, ohne Befund, gleich.
Kernsysteme: Story 8/8, Seitenfehler 0, npc- und
enemyStaticPenetration 0, Stadtmoebel 7 -> 19 Felder, 781 -> 2895
Stueck. npc-wege A 0, B 0, C 0, D 82 und E 84 von 100 - 339184b im
selben Durchgang A 1, D 79, E 79 (die bekannte Streuung, siehe
PHASE13). Naht 221/221/221, Aussenecke 150/150. Innenklettern
0/0/0/0; Kontrolle aussen 89/92 statt 90/92 - Raum 10 Nord startet
0,26 m neben einer neuen Bank (mit `ohneSD` 90/92). MO1-Kletterproxy
Brust/Becken/Loch/Kiste 0. Top-out 13/13 und 8/8,
postTopOutUnexpectedDisplacement 0,000. Brutal-Halle gehen und rennen
30/30, invisibleCollision 0. Neon-Pflichtbahnen 27: Brust, Becken, Knie,
Schnitt 0. Kletterstetigkeit: playerInsideForeignBuildingWhileClimbing 0.

**Ladezeit** (Pruefstand `starte()` bis die Szene ruht, SwiftShader,
ruhige Maschine, abwechselnd je drei Laeufe): 339184b 33,4 / 35,4 /
38,4 s, mit 6A 41,0 / 41,6 / 42,2 s - im Median +6 s; derselbe Code mit
`ohneSD` 34,8 / 36,0 s. Eigener 6A-Code: 0,54 s Planung (im Profil
gemessen; das Anlegen der Felder unter 0,17 s) und ein zusaetzliches
Shaderprogramm (Lambert,
instanziert, Vertexfarben und Textur: die Baumfelder). Die Stadt ist
mit und ohne 6A gleich schnell fertig - die Objektzahl der Szene steht
nach 25,2 bzw. 26,0 s. Die Mehrzeit liegt danach, in der Ruhe-Wartezeit
des Pruefstands: dort uebersetzt SwiftShader die letzten
Standard-Shader (je 2 bis 3,6 s am Stueck), das CPU-Profil verbucht den
Unterschied auf Programmbau (+3,3 s) und Warten auf den GPU-Prozess
(+3,8 s). Auf echter Grafikhardware ist das hier nicht messbar; offen.

---

## 6n. Street-Detail-Polish und Leistungsreserve (Stufe 6B)

6B fuegt nichts hinzu. Erst angesehen, dann gemessen, dann nur geaendert,
was ein Bild oder eine Zahl belegt.

**Bewertung der 6A-Bilder (zehn feste Orte, drei Luftbilder, das
2:12-Video).** A = sichtbar besser, B = zu leer, C = zu voll, D = Muster,
E = Prop unpassend, F = Baum verdeckt zu viel, G = gut.

| Ort | Wertung | Begruendung |
| --- | --- | --- |
| 01 Zentrum 0/-50 N (Street) | A | Uhr vorn, Bank und Muelleimer hinten; Seitenstrasse bewusst ohne Baeume, Gehweg vorn noch leer (B-Tendenz, gewollt) |
| 02 Geschaeft -150/-100 O (Boulevard) | A | Baumreihe, Arkadenstuetzen frei; zwei Muelleimer 3,5 m auseinander (C-Tendenz) |
| 03 Mischung -200/50 N | A | natuerliche Baumreihe beidseits, Arkade frei |
| 04 Wohnen -250/100 N | A | Baumreihe beidseits |
| 05 Parkrand -200/-150 O | A | Randreihe und Gruppen innen; grosse Krone dicht an der Kamera, parktypisch |
| 06 Park innen | A | Weg und Brunnen frei, Kronen rahmen den Blick (F-Grenzfall, parktypisch) |
| 07 Ufer, Promenade | A | zweite Baumreihe; die Laterne ist nur aus genau diesem Blick hinter dem Baum (steht ueber 4 m daneben) |
| 08 Boulevard 100/0 N | G | Baum, Uhr, Muelleimer, gegenueber Kuebel-Bank-Kuebel |
| 09 Local -300/-250 S | A | Baumreihe einer Wohnstrasse |
| 10 Avenue 0/150 O | A | Gegenseite Baumreihe und Kuebel, eigene Seite ein Muelleimer |
| Luftbilder | A, A, G | Wohnen: Strassenbaumraster; Park dicht und gruen; Zentrum sparsam |

Dichte: die dichteste Kante jedes Stadtteils (Zentrum 8 Teile, Geschaeft
6, Mischung 5, Ufer 5, Wohnen 4, Park 3) aus Fussgaenger- und
Spielkamerahoehe gerendert - keine wirkt ueberfuellt. Park 20,4, Ufer
6,8, Wohnen 6,2 Baeume je 100 m und Zentrum 13,8 Mobiliar je 100 m wirken
im Spiel natuerlich; keine Dichte wurde veraendert. Echte Auffaelligkeiten
gab es nur im Kleinen: drei Muelleimer im 2-m-Takt an einer
Geschaeftskante (x -268,3), zehn Muelleimer-Paare unter 5 m, zwei
Bahnhofsuhren 7,8 m auseinander an derselben Kante und drei Uhrenpaare
ueber Eck einer Kreuzung. Ursache: mehrere freie Gruppen einer Kante
landeten in derselben groessten Luecke.

**Geaendert 1 - Mindestabstand gleicher Arten (`SD_ART_ABSTAND`):** ein
Muelleimer haelt 8 m zum naechsten neuen Muelleimer, eine Uhr 60 m zur
naechsten Uhr; was zu nah kaeme, faellt weg wie jede verworfene Gruppe.
Muelleimer 272 -> 268, Uhren 13 -> 7 (die naechste Uhr jetzt 60 bis
81 m entfernt), eine Bank+Muelleimer-Gruppe weniger. Paare unter 5 m:
10 -> 0. Mobiliar je 100 m im Zentrum 13,8 -> 13,6, sonst gleich.

**Geaendert 2 - Sichtweiten (`SD_SICHT`), mit Bildern statt geschaetzt**
(`tools/pruef/sd-sicht-bilder.js`: je Art dieselbe Spielansicht an vier
Stellen - Boulevard, Avenue, Promenade, Dachkante -, dazu fuenf
Pollerreihen; gezaehlt die Bildpunkte, die sich gegen die alte
Sichtweite aendern, von 921.600):

| Art | vorher | nachher | geaenderte Bildpunkte | Hoehe an der Grenze |
| --- | --- | --- | --- | --- |
| Baum | 185 m | 185 m | - (Silhouette) | 18 Pt. |
| Uhr | 185 m | 185 m | - (Wahrzeichen) | 7 Pt. |
| Kiosk | 185 m | 150 m | auf 170 m hinter Baeumen unsichtbar | 8 Pt. |
| Bank | 150 m | 120 m | 0 bis 25 | 4 Pt. |
| Pflanzkuebel | 150 m | 100 m | 0, vom Dach 73 | 4 Pt. |
| Muelleimer | 110 m | 80 m | 0 bis 17 | 6 Pt. |
| Poller | 150 m | 60 m | 0 bis 21 | 7 x 2 Pt. |
| Baum-/Pflanzscheibe | 110 m | 60 m | vereinzelte Punkte | unter 1 Pt. ab 30 m |

Kein neues LOD: nur der Radius des vorhandenen Feldes
(`updateMoebelSicht`). Ein leeres Feld (count 0) zeichnet three.js r128
schon nicht - eine Leerfeld-Regel braucht es nicht.

**Warum das Luftbild ueber 899 lag** (`tools/pruef/sd-leistung.js`,
gerechnet aus Belegung und Geometrie, an jeder der 300 Stellen gegen ein
echtes Bild mit und ohne die Felder geprueft, Abweichung hoechstens 2):
`stadt-leistung.js` friert das Spiel ein und bewegt nur die Kamera. Die
Instanzfelder bleiben so belegt wie um die Figur am Startpunkt
(25/25, Zentrum) und werden nicht nach Sichtkegel geschnitten - jedes
nicht leere 6A-Feld kostet deshalb in JEDER Aufnahme genau einen
Aufruf, egal wohin die Kamera schaut: vier Baumvarianten, Baumscheibe,
Bank, Muelleimer, Kuebel, Poller, Uhr, Kiosk = 11 (die Pflanzscheibe
ist dort leer). Die Luftansicht lag ohne 6A schon bei 889,5 - plus 11 =
900,5. Spielnah gemessen (Figur an der Kamera, Felder nachgezogen) waren
es 893,5: in 118 m Hoehe sind die kleinen Dinge ausserhalb ihrer
Sichtweite.

Nach 6B sind am Startpunkt Kiosk (176 m) und Poller (64,6 m) ausserhalb
ihrer Sichtweite; 6A kostet dort 9 statt 11 Aufrufe.

**Leistung (`stadt-leistung.js`, 300 Aufnahmen, unveraendertes
Verfahren):**

| Lage | 339184b | a74d256 (6A) | 6B |
| --- | --- | --- | --- |
| Strasse | 790,5 | 801,5 | 799,5 |
| Dach | 802 | 813 | 811 |
| Luftbild | 890 | 900,5 | **898,5** |
| GESAMT | 826 | 837 | **835** |
| Dreiecke Median | 3,15 Mio. | 3,86 Mio. | 3,73 Mio. |

6A und 6B sind Mediane aus vier bzw. drei Laeufen. Derselbe Stand
streut um drei bis vier Aufrufe (a74d256: 833,5 / 837 / 837 / 837) - je
nachdem, wo Wagen, Passanten und Gegner beim Einfrieren gerade stehen;
sie machen 155 bis 200 der Aufrufe aus. Fuer genaue Differenzen gibt es
deshalb `stadt-leistung.js ... ruhig` (die drei ausgeblendet, wie
`street-bilder.js`): 339184b 671 / Luftbild 691,5, a74d256 682 / 702,5,
6B 679,5 / 700 - 6B spart dort 2,5 Aufrufe und 3,9 Prozent Dreiecke.
Die 6A-Felder kosten eingefroren 9 statt 11 Aufrufe, ihre Dreiecke
582.000 statt 712.000; spielnah im Luftbild 6 statt 8 Aufrufe.

Offen gesagt: das Luftbild liegt nur deshalb unter 899, weil am
Startpunkt der Messung jetzt auch das Pollerfeld leer ist (naechster
Poller 64,6 m, Sichtweite 60 m). Die 60 m sind aus den Bildern gewaehlt,
nicht fuer den Pruefstand - aber ohne sie laege das Luftbild bei 899,5.

**Collider (Teil 7):** die 1320 Hindernisse bleiben. `collidersNear`
liefert an den Orten, an denen das Spiel fragt, 11 bis 14 Prozent mehr
Kandidaten (Passanten 93 -> 103, Gegner 79 -> 90, Wagen 70 -> 80 im
Mittel). Die Simulation ohne Bild kostet je Schritt 3,68 ms (a74d256)
gegen 3,72 ms (derselbe Code mit `ohneSD`) und 3,55 ms (339184b), je drei
Laeufe im Wechsel - kein messbarer Anstieg, nichts geaendert.

**Ladezeit, getrennt (`tools/pruef/ladezeit.js`, Zeitmarken nur im
Pruefstand, je drei Laeufe im Wechsel, Median in s):**

| Marke | 339184b | a74d256 | a74d256 + ohneSD | 6B |
| --- | --- | --- | --- | --- |
| T1 letzte Datei geladen | 25,5 | 24,8 | 24,1 | 25,8 |
| T2 Stadtgeometrie fertig | 26,6 | 25,7 | 25,1 | 26,5 |
| T3 Strassendetail-Plan fertig | - | 22,8 | - | 24,2 |
| T4 Instanzfelder fertig | - | 25,7 | - | 26,5 |
| T5 erster vollstaendiger Render | 29,3 | 31,8 | 28,2 | 31,6 |
| T6 Pruefstand: Szene ruhig | 36,4 | 43,6 | 37,6 | 43,2 |

Woher die +6 s kommen:
* Planung: 0,6 s, aber VOR T1 - sie laeuft, waehrend noch Dateien
  laden, und verschiebt nichts.
* Geometrie: T1 und T2 unveraendert.
* Upload: der erste vollstaendige Render nach T2 dauert 5,6 bis 6,2 s
  statt 2,8 bis 3,4 s; darin wartet der Hauptfaden 2,6 bis 3,1 s in
  bufferData statt 1,1 bis 1,5 s - bis der SwiftShader-GPU-Prozess die
  neuen Geometrien und Instanzen uebernommen und die zusaetzlichen
  Dreiecke gerendert hat.
* Shaderbau: ein Programm mehr (Baumfelder), uebersetzt waehrend die
  Dateien noch laden. Der lange Shaderbau nach T5 (1,3 bis 5,2 s am
  Stueck) steckt in allen Staenden.
* Ruhekriterium: T5 bis T6 im Median 11,6 s statt 9,1 s - lange Bilder
  verzoegern die Abfragen.
6B aendert daran wenig (erster Render 4,7 bis 5,2 s): hochgeladen werden
alle Instanzen, die Sichtweite bestimmt nur, wie viele gezeichnet
werden. Keine Spielaenderung wegen SwiftShader allein.

**Top-out-Pruefstand und echter Spielablauf:** die Aenderung aus 6A an
`topoutlandung.js` nimmt Strassendetails NUR im Pruefstand und nur fuer
den einen Lauf (frische Seite je Fall) auf der 3 m breiten Anlaufbahn aus
der Kollision - am Spielcode aendert sie nichts. Gegenprobe im Spiel mit
allen Strassendetails: am FlatFacade-Problemdach (Haus 169, +z, f 0,8)
steht der Baum (-308,52/-131,80) auf der geraden Anlaufbahn. Die Figur
startet auf dem Gehweg 1,4 m daneben, ist nach 0,8 s an der Wand,
klettert, rueckt an der Wand seitlich auf f 0,8 (Kante bei x -308,22) und
zieht sich ueber die Kante: auf dem Dach (y 17,63),
postTopOutUnexpectedDisplacement 0,000. Kein neuer Code noetig.

**Fassaden-Zugang (`tools/pruef/fassaden-zugang.js`):** 20 Fassaden mit
neuen Strassendetails davor, deterministisch aus 803 Kandidaten gewaehlt
(Stadtteile reihum), alle 1,5 m echt angelaufen - vom Bordstein (durch
die Moeblierungszone) und vom Gehweg. completelyBlockedFacadeAccess
0 von 20, Wand erreichbar 20 von 20; vom Gehweg kommt jeder Lauf an, vom
Bordstein sind einzelne Stellen hinter Bank oder Baum zu (jede Fassade
hat 3 bis 9 direkte Zugaenge). Haustueren: kein neues Ding in Durchgang
oder Vorfeld (0 von 27), jeder Lauf vom Gehweg zur Tuer kommt an.
Arkaden und offene Hallen: kein neues Ding im 1,5-m-Streifen (0 von 444
Seiten).

**Muster-Audit:** die 60 Kanten mit gemeinsamem Muster - 10 sind reiner
Bestand (Eckpoller, Kuebel mit Laterne), 46 enthalten neue Dinge, liegen
aber an verschiedenen Strassen oder weit auseinander, 4 liegen paarweise
an derselben Strasse, je 100 m auseinander (ein einzelner Muelleimer;
Baum + Muelleimer) - im Bild nicht als Wiederholung zu erkennen, ein
anderer Block liegt dazwischen. Keine Korrektur.

**Fingerabdruck:** Haeuser 617, Lots, 300 Parkautos, 45 Wagen, 12 Gegner,
41 POIs gleich 339184b und a74d256 - kein neuer Aufruf des Stadtzufalls.

**Regression (Keim 4711):** `node --test` 170/170; street-details harte
Fehler 0 (neu 2103 Dinge, 1309 Hindernisse); freigang alle Flaechen frei
(der Arkaden-Befund an der Laterne -18/150 ist Bestand, davon neue
Strassendetails 0); Stadtraster unveraendert; Parkautos gleich;
Kernsysteme Story 8/8, Seitenfehler 0, npc- und enemyStaticPenetration 0,
Stadtmoebel 19 Felder, 2884 Stueck; Naht 221/221/221, Aussenecke
150/150; Innenklettern 0/0/0/0 (Kontrolle aussen 89/92 wie in 6A); MO1
0/0/0; Kletterstetigkeit Foreign 0; Top-out 13/13 und 8/8,
postTopOutUnexpectedDisplacement 0,000 (zeilengleich mit 6A); Brutal-Halle
gehen und rennen 30/30, invisibleCollision 0; Neon-Pflichtbahnen 27,
Brust/Becken/Knie/Schnitt 0. Zusaetzlich npc-wege: A 1, D 81, E 85 von
100 - der A-Fall ist ein fluechtender Passant auf einer U-Bahn-Route im
Haus (dieselbe Art Fall hat 339184b im selben Durchgang; an dieser
Hauskiste stehen nur zwei Poller ohne Hindernis, wie in 6A).

---

## 6o. Strassenleben: Passanten-Vielfalt und Bevoelkerung je Stadtteil (Stufe 7A)

7A aendert WIE VIELE Passanten es gibt, WO sie unterwegs sind, WELCHES
MODELL und WELCHER LOOK - keine neue Passanten-KI, keine neue Wegsuche,
keine neuen Modelle, kein Sitzen oder Telefonieren (das ist 7B). Held,
Gegner und das Retargeting bleiben unberuehrt. Pruefstand
`tools/pruef/street-life.js`, Bilder `tools/pruef/street-life-bilder.js`.
Alle Laeufe mit Keim 4711; das Spiel haelt im ersten Bild nach dem Laden
an (`basis.js`, Option `frierSofort`) und wird danach in festen Schritten
gerechnet. Ohne das liefen je nach Rechnerlast 30 bis 100 Bilder in
Echtzeit, und zwei Laeufe mit demselben Code zeigten an demselben Ort 0
und 3 Figuren. Waehrend der Messung steht die Figur unverwundbar auf
einem Dach nahe dem Startpunkt: unten auf der Kreuzung bleiben Passanten
im Umkreis von 9 m stehen und gaffen - auch mitten auf dem Ueberweg.

**Bestand 32107ff.** 50 Zivilisten: 22 Strassenpassanten, die frei durch
die ganze Stadt laufen, und 28 Fahrgaeste der U-Bahn, davon 17 im Zug.
Im Mittel (240 s) standen im Zentrum 8,6 Passanten, in der Mischung 6,0,
im Geschaeftsviertel 3,0, im Wohngebiet 2,7, am Ufer 1,4 und in den
beiden Parks zusammen 0,3. Das Modell wurde je Figur gewuerfelt, die
Kleidung reihum vergeben, und jede Figur bekam eigene Materialkopien.
Gezeichnet wurde jede Figur ohne Sichtfeld-Pruefung (`frustumCulled =
false`), also bis 130 m - auch hinter der Kamera und unter der Erde.

**Die fuenf Passantenmodelle:**

| Modell | Kleidung | Knochen | Dreiecke | Teile | Materialien |
| --- | --- | --- | --- | --- | --- |
| civilian | T-Shirt, kurze Cargohose, Turnschuhe | 67 | 35.193 | 7 | 6 - Oberteil, Hose, Schuhe, Haar je eigenes, einzeln toenbar |
| civilian2 | kurzes Oberteil, Jeansshorts | 65 | 53.452 | 6 | 2 - Haar 2048 x 2048, transparent |
| civilian3 | T-Shirt, lange dunkle Hose | 65 | 49.178 | 2 | 2 - beide transparent, Haut und Kleidung in einem: keine Kleidertoenung moeglich |
| civilian4 | gestreifter Pullover, Jeans, Absatzschuhe | 65 | 48.207 | 6 | 2 |
| civilian5 | Pullover, Leggings, Turnschuhe | 65 | 52.118 | 7 | 2 |

Alle sind auf 1,76 m gebracht und haben 53 Clips mit vollstaendig
gebundenen Spuren (civilian3 bis 5 spielen die Clips von civilian). Zum
Vergleich: Held 13.400, Schlaeger 14.800 Dreiecke - eine Passantenfigur
kostet das Drei- bis Vierfache.

**Wie viele - die Kandidaten.** Basis sind die 50 Zivilisten; getestet
+0, +13, +25 und +38 zusaetzliche Strassenpassanten (aktuell, +25, +50,
+75 Prozent). Sicht: im Bild UND ohne Haus dazwischen, Mittel je Sekunde,
Summe ueber die zehn Strassenorte aus Stufe 6. Lauf: 240 s ohne Gangs.
Kosten: spielnah an den zehn Orten (Figur an der Kamera, Mehraufrufe
gegen dieselbe Aufnahme ohne Passanten), CPU am Zentrum-Ort.

| | vorher | +0 | +13 | +25 | +38 |
| --- | --- | --- | --- | --- | --- |
| im Bild bis 50 m | 1,63 | 1,71 | 3,09 | 4,27 | 6,48 |
| im Bild bis 100 m | 3,51 | 3,33 | 6,85 | 8,19 | 12,49 |
| Umkreis 360 Grad bis 50 m | 3,91 | 4,46 | 7,40 | 10,31 | 13,50 |
| Fahrbahn ohne Ueberweg, gehend | 22 | 23 | 37 | 48 | 53 |
| abseits des Netzes > 3 s | 17 | 14 | 31 | 41 | 31 |
| groesste Traube (2 m) | 2 | 1 | 2 | 2 | 4 |
| Mehraufrufe, Median | 37 | 14,5 | 13,5 | 20,5 | 27 |
| Mehrdreiecke, Median | 327k | 97k | 126k | 152k | 234k |
| CPU der Passanten je Schritt | 1,5 ms | 1,6 ms | 2,0 ms | 2,4 ms | 2,9 ms |

Gewaehlt: **+38** (50 -> 88 Zivilisten, auf der Strasse 22 -> 60). Damit
stehen an einem Strassenort im Mittel 0,65 Personen naeher als 50 m im
Bild (+25: 0,43, vorher 0,16; im Endstand 0,60). Die Fehler je Person
steigen nicht (Fahrbahn 1,0 -> 0,9 je Passant), es gibt keine
Stau-Traube, und die Kosten bleiben unter denen von vorher, weil die
Figuren jetzt gegen das Sichtfeld geprueft werden (siehe Leistung). +38
ist der hoechste Kandidat; mehr wurde nicht versucht. Die
Kandidatenbilder an zwei festen Ansichten zeigten in keiner Stufe mehr
als eine ferne Figur - fuer die Wahl zaehlten deshalb die Messwerte
ueber 240 s.

**Wo - Dichte je Stadtteil.** Jeder neue Passant gehoert zu einem
Stadtteil und sucht seine Ziele nur dort (`gehNeuesZiel` zieht aus der
Knotenliste des Stadtteils) - ohne diese Bindung laeuft jede Verteilung
in wenigen Minuten zu dem, was das Netz von selbst ergibt (gemessen: 54
Prozent der freien Passanten im Zentrum). Wie viele je Stadtteil:
begehbare Gehweglaenge (Gehwegkanten ohne Ueberwege und U-Bahn-Koepfe,
jede Kante zur Haelfte fuer beide Enden) mal Dichte, ganze Personen nach
dem groessten Rest. In der Knotenliste zaehlt die Promenade dreifach,
Parkwege und Gehwege an Boulevard und Avenue doppelt - dort, wo man die
Stadt sieht, halten sich mehr Leute auf. Ein Begleiter kommt nur aus
demselben Stadtteil. Die 22 bisherigen Passanten bleiben frei.

| Stadtteil | Netz | Dichte | neu | im Stadtteil, Mittel vorher -> 7A | je km Netz |
| --- | --- | --- | --- | --- | --- |
| Zentrum | 2788 m | 1,0 | 10 | 8,6 -> 18,9 | 6,8 |
| Geschaeft | 1497 m | 0,8 | 4 | 3,0 -> 7,5 | 5,0 |
| Ufer | 3415 m | 0,6 | 7 | 1,4 -> 9,7 | 2,8 (Promenade 7,9) |
| Mischung | 4841 m | 0,45 | 8 | 6,0 -> 15,9 | 3,3 |
| Wohnen | 3004 m | 0,25 | 3 | 2,7 -> 4,9 | 1,6 |
| Park | 530 m | 3,0 | 6 | 0,3 -> 2,9 | 5,5 |

Der Park ist ein Ziel, kein Durchgang: mit Dichte 1,5 kamen drei Leute
auf zwei Parks, und auf den Parkbildern stand niemand; mit 3,0 sind es
sechs. Das Ufer liegt im ganzen Stadtteil unter der Mischung, auf der
Promenade aber mit 7,9 Personen je km dichter als das Zentrum (im Mittel
4,6 Personen auf 580 m, vorher 0,25).

**Die Parkwege im Gehnetz.** Das Wegekreuz der Parks (3,2 m breit, mit
Brunnenplatz) kannte das Gehnetz nicht - Passanten liefen nur aussen
herum. Neu je Arm ein Tor auf der Gehweglinie (17 m von der Mitte,
zwischen die Ringknoten gehaengt), Wegpunkte bei 15, 11,5, 8 und 4,6 m,
um das Becken vier Eckpunkte: 48 Knoten (8 Tore), 64 Kanten. Das Netz
hat damit 1525 statt 1477 Knoten und 1909 statt 1845 Kanten. Die Tore
kosten in der Wegsuche das 25-fache ihrer Laenge (`kante.faktor`): quer
durch einen Block spart man hoechstens rund 40 m, zwei Tore kosten 100 m
- keine Route, auch keine Missionsroute, kuerzt durch einen Park ab. Die
Parkknoten stehen nicht in `GEH.raster`: `gehNaechster` findet sie nicht,
also beginnt und endet keine Mission, Einsatzfahrt oder Rettung auf einem
Parkweg.

**Welches Modell, welcher Look.** Aus einem lokalen Hash
(`sdHash(7000 + Nummer, Versuch, Salz)`), nicht aus dem Stadtstrom:
Modell nach Stadtteil gewichtet, eine der sechs vorhandenen Kleidungen
aus `city-visuals.js`, bei civilian dazu Oberteil, Hose, Schuhe und Haar
aus den vorhandenen Paletten. Kein Passant sieht aus wie sein Begleiter
oder wie ein Passant im Umkreis von 8 m (bis zu acht Versuche). Die
22 bisherigen Passanten bekommen ihren Look ebenso; ihre Figur entsteht
zuerst aber genau wie vorher und wird erst danach ersetzt - jede neue
UUID zieht in three.js vier Zahlen aus `Math.random`, und ohne diese Zuege
an genau dieser Stelle rueckte der Stadtstrom fuer alles Folgende.
Gegenprobe: die 310.054 Zuege eines Ladevorgangs bis `actorsReady` sind
Zug fuer Zug dieselben wie auf 32107ff; Haeuser 617, Lots, 300
Parkautos, 45 Wagen, 12 Gegner (dieselbe Liste), 41 POIs und 2103
Strassendetails haben denselben Fingerabdruck, nur die Passanten nicht
(50 -> 88). Die zusaetzlichen Passanten entstehen nach den Gangs in einem
eigenen Strom.

District Flavor, subtil - nur Gewichte, jedes Modell kommt ueberall vor:
Zentrum und Geschaeft etwas mehr civilian4/5 (lange Hosen, Pullover) und
Pendler-, Stadt- und Abendkleidung, Wohnen und Park etwas mehr civilian
und civilian2 und Alltag, Sport, Freizeit; die Einzelfarben im Zentrum
leicht zu den dunklen, im Wohngebiet zu den hellen Eintraegen der
Paletten. civilian3 steht ueberall zurueck: ohne Toenung hat es nur drei
unterscheidbare Fassungen (Rucksack, Tasche, ohne) - im ersten Lauf mit
gleichen Gewichten stellte es 20 von 60 Passanten.

Verteilung der 60 Strassenpassanten: civilian 10, civilian2 15,
civilian3 13, civilian4 13, civilian5 9; Alltag 8, Pendler 12, Sport 7,
Freizeit 7, Stadt 12, Abend 14; 28 unterscheidbare Looks (vorher 17 von
22). Drei Paare, keines gleich gekleidet. Gleich aussehende naeher als
3 m: 5 Paar-Sekunden in 240 s. Je Stadtteil zum Beispiel: Zentrum Stadt 4,
Abend 3, Pendler 2, Sport 1; Park Sport 3, Alltag 2, Abend 1.

Materialien werden geteilt: die getoenten Farben (`ZIVI_MAT`, 19 fuer alle
Passanten), die Kleidungskopien von `dressCivilian` (nur fuer die neuen
Looks, Option `share`), Handy und Schirm. Niemand veraendert diese
Materialien danach - Einsatzkraefte und sterbende Gegner legen eigene
Kopien an, und `material.dispose` kommt im Spiel nicht vor. Trotz 38
Figuren mehr hat die Szene 2332 statt 2417 Materialien und 3261 statt
3351 Geometrien.

**Startpunkte.** Alle 60 Strassenpassanten vor dem ersten Schritt
geprueft: in einem Ding (Baum, Bank, Muelleimer, Kuebel, Kiosk ...) 0, in
einem Haus 0, auf der Fahrbahn oder einem Ueberweg 0, im Wasser 0, vor
einer Haustuer 0, an einer Arkade 0, mehr als 3 m neben dem Netz 0, auf
demselben Punkt wie ein anderer 0. Beim Setzen haelt jeder 6 m Abstand zu
allen, die schon stehen (nach zehn Versuchen 2 m); ausgelassen 0.

**Lauf ohne Gangs, 240 s:**

| | 32107ff | 7A |
| --- | --- | --- |
| Strassenpassanten | 22 | 60 |
| in einem Ding / Haus laenger als 1 s | 0 / 0 | 0 / 0 |
| Fahrbahn ohne Ueberweg, gehend | 22 (1,0 je Passant) | 57 (0,95 je Passant) |
| abseits des Netzes > 3 s | 17 (0,77) | 42 (0,70) |
| Eingang laenger als 5 s blockiert | 0 | 0 |
| Stau-Trauben (3+ ungewollt still, 10 s) | 0 | 0 |
| groesste Traube (2 m) / dichteste Stelle (andere im 5-m-Umkreis) | 2 / 1 | 3 / 3 |
| enge Stelle 5 s blockiert | 0 | 3 - alle gewollt (zwei Aktivitaeten, ein Gespraech) |
| laengster ungewollter Stillstand | 8 s | 69 s (s. u.) |

Die Fahrbahnfaelle sind Bestand und je Person nicht haeufiger: Passanten
streifen an der Brueckenstrasse und an Ecken den Bordstein. Mit Gangs
(120 s danach): in Ding und Haus 0 / 0 auf beiden Staenden.

Der Stillstand von 69 s: ein freier Passant beim Queren an der
Blockmitte -150 westlich von Block 100 (86,4/-148,3). Dieselbe Stelle hat
32107ff im ersten Messdurchgang (Held noch auf der Kreuzung) mit 69 s
bei 81,3/-150,5, und der Kandidat +38 im zweiten Durchgang mit 75 s bei
82/-148,7. Bestand der Querungslogik, in 7A nicht angefasst.

**Park und Ufer.** Der Ring um einen Park (17 m von der Mitte) liegt seit
jeher im Rasen - einen gepflasterten Gehweg gibt es dort nicht.
Personen im Park, Mittel je Sekunde (beide Parks):

| Zone | 32107ff | 7A |
| --- | --- | --- |
| Ring (Rasenstreifen am Rand) | 0,20 | 1,48 |
| Eingang / Weg / Bank / Platz | 0 / 0 / 0 / 0 | 0,26 / 0,17 / 0,20 / 0,05 |
| Rasen innen | 0 | 0,13 |
| in einem Busch | 0,03 | 0,16 |
| auf einer Pflanzscheibe | 0 | 0,00 (1 Personen-Sekunde) |

Rasen innen heisst: an den Toren schneidet der Passant die Kurve vom Ring
auf den Weg ab, 1 bis 2 m ueber den Rasen. Die Buschfaelle sind Bestand:
die niedrigen Bueschel am Nord- und Suedrand (`createPark`, z = 16,05 und
16,5 m) reichen bis 16,77 m an die Ringlinie (17 m) heran, und schon der
kleine Seitenversatz beim Gehen (0,02 bis 0,42 m) streift sie. Gemessen
an der Zeit auf dem Ring sind es auf 32107ff 15 Prozent, in 7A 11 Prozent
- 7A bringt nur mehr Menschen auf den Ring. Weder die Bueschel noch das Gehnetz
werden in 7A verschoben.

Promenade: im Mittel 4,58 Personen (vorher 0,25), hoechstens 7, an der
dichtesten Stelle 1 andere im 5-m-Umkreis - belebt, nicht voll.

**Sicht an den zehn Orten** (im Bild und frei, Mittel je Sekunde,
25 / 50 / 100 m; frei heisst: keine Hauskiste zwischen Kamera und Figur -
Baeume, Laternen und Wagen zaehlen hier nicht als Sichtsperre):

| Ort | 32107ff | 7A |
| --- | --- | --- |
| 01 Zentrum | 0,18 / 0,41 / 0,75 | 0,52 / 1,16 / 2,27 |
| 02 Geschaeft | 0 / 0,01 / 0,33 | 0 / 0 / 0,65 |
| 03 Mischung | 0,04 / 0,20 / 0,50 | 0,17 / 0,55 / 1,07 |
| 04 Wohnen | 0 / 0,05 / 0,15 | 0,02 / 0,17 / 0,71 |
| 05 Parkrand | 0,06 / 0,32 / 0,61 | 0,44 / 0,95 / 1,54 |
| 06 Park innen | 0,01 / 0,28 / 0,53 | 0,39 / 1,87 / 2,94 |
| 07 Ufer | 0,05 / 0,10 / 0,14 | 0,36 / 0,92 / 1,40 |
| 08 Boulevard | 0,03 / 0,16 / 0,27 | 0,05 / 0,05 / 0,27 |
| 09 Local Street | 0 / 0 / 0 | 0 / 0 / 0 |
| 10 Avenue | 0 / 0,10 / 0,23 | 0,17 / 0,36 / 0,85 |
| Summe | 0,37 / 1,63 / 3,51 | 2,12 / 6,03 / 11,70 |

Im Umkreis von 50 m (360 Grad) sind es 3,91 -> 14,75. Die Local Street
am Stadtrand (-300/-250) sieht auch in 7A niemanden: das Wohngebiet hat
die geringste Dichte, und die Ecke liegt abseits. Am Boulevard-Ort stehen
die Leute in diesem Lauf weiter weg (bis 150 m 0,32 -> 0,59).

**Leistung.** `stadt-leistung.js`, unveraendertes Verfahren, 300
Aufnahmen; 7A drei Laeufe mit identischem Ergebnis:

| Lage | 32107ff | 7A | 7A ohne Sichtfeld-Pruefung (`cullAlt`) |
| --- | --- | --- | --- |
| Strasse | 798,5 | 753,5 | 836,5 |
| Dach | 810 | 768 | 849 |
| Luftbild | 897 | **859,5** | 936 |
| GESAMT | 834 | **794** | 870,5 |
| Dreiecke Median | 3,71 Mio. | 3,40 Mio. | 4,10 Mio. |
| Aufrufe / Dreiecke hoechstens | 2551 / 4,54 Mio. | 2597 / 4,93 Mio. | 2597 / 4,93 Mio. |

Die Ersparnis kommt ganz aus der Sichtfeld-Pruefung: ohne sie laegen
GESAMT 36,5 und das Luftbild 39 Aufrufe ueber 32107ff - das Luftbild bei
936, ueber der Grenze. Gemessen auf 32107ff kosteten die 11 Figuren um den
Startpunkt in jeder der 300 Aufnahmen 60 Aufrufe, egal wohin die Kamera
sah. Jetzt bekommt jedes Teil einer Figur dieselbe Huellkugel (Mitte
0,9 m ueber dem Boden, Halbmesser 1,3 m), und die Figur faellt als Ganzes
aus dem Bild. Nachgemessen ueber alle 53 Clips jedes Passantenmodells an
neun Zeitpunkten, jeder Vertex auf der CPU gehaeutet wie im Shader: jede
Haltung eines Passanten bleibt mindestens 11 cm innerhalb (am knappsten
`jubel` mit erhobenen Armen, `walk` 34 cm, verletzt am Boden `sit`
20 cm); hinaus ragen nur Heldenclips, die kein Passant spielt (`swing`
bis 4,8 cm, `klettern_frei` 0,9 cm). Gegner aus civilian4/5 teilen die
Geometrie, behalten aber `frustumCulled = false` - fuer sie aendert sich
nichts. Die teuerste der 300 Aufnahmen liegt bei 2597 statt 2551
Aufrufen; der Pruefstand speichert keine Werte je Aufnahme, und Wagen und
Figuren stehen beim Einfrieren auf beiden Staenden woanders - der Anteil
der Passanten daran ist nicht getrennt gemessen.

Spielnah an den zehn Orten (Figur an der Kamera): Passanten kosten im
Median 27,5 Aufrufe und 219.000 Dreiecke (vorher 37 und 327.000), am
meisten am Boulevard und im Zentrum (+70 und +65 bei 30 und 34 Figuren im
130-m-Kreis). CPU: 2,9 ms je Schritt fuer alle Passanten (vorher 1,5 ms),
Wegsuche 9 mal in 600 Schritten.

Im `ruhig`-Modus (Wagen, Passanten und Gegner ausgeblendet) misst 7A 675
statt 679,5 (6B). Ursache: ausserhalb der drei Listen bleiben auf beiden
Staenden dieselben fuenf Figuren sichtbar; eine davon (sitzend bei
12,3/12,4) wuerfelt ihr Modell zur Laufzeit und ist in 7A civilian3 mit
2 Teilen statt eines Modells mit 7 - der Laufzeitstrom ist mit mehr
Passanten ein anderer. Am Zeichnen hat 7A dort nichts geaendert.

Sichtweiten unveraendert: gezeichnet und animiert bis `LOD_WEITE` 130 m
(100 und 70 m in den niedrigeren Grafikstufen), Schatten bis 46 m, die
KI rechnet fuer alle (ueber 60 m Manhattan-Abstand nur jedes dritte
Bild). Kein Befund verlangte eine Aenderung.

**Ladezeit.** `hebeSchatten` hebt in three.js r128 nie etwas an: eine
Textur hat dort kein `userData`, die Zeile mit `schonGehoben` wirft, und
der catch-Zweig gibt das Original zurueck. Die Arbeit davor lief trotzdem
fuer jede neue Figur und jede Textur - neue Leinwand, `drawImage`,
`getImageData`, neue CanvasTexture. Im Ladeprofil der 38 neuen Passanten
waren das 1,74 von 1,86 s. Gemerkt wird jetzt nur, was ohnehin
feststeht (das Original): bei einer ganz schwarzen Stichprobe sofort,
wenn das Bild fertig dekodiert ist (dabei entsteht keine Textur, also
kein Zug aus dem Stadtstrom), sonst erst ab `baueStrassenLeben`, damit
die Zuege davor dieselben bleiben. Angehoben wird weiterhin nichts - das
wuerde Held und Gegner veraendern. `baueStrassenLeben` braucht fuer alle 60
Strassenpassanten auf ruhiger Maschine 0,13 s (drei Laeufe 0,127 /
0,131 / 0,144 s; unter der Last der Pruefstaende 0,5 bis 0,9 s). Ladezeit
(`ladezeit.js`, je zwei Laeufe im Wechsel): 7A laedt nicht langsamer -
letzte Datei geladen 12,8 / 13,6 s gegen 16,0 / 15,4 s, Szene ruhig
26,6 / 27,3 s gegen 32,5 / 29,6 s. Der Abstand entsteht aber schon vor
dem Strassendetail-Plan, also bevor der erste Passant gebaut wird; er ist
7A nicht zugeordnet.

**Bilder und Video.** `street-life-bilder.js` nach 120 s Vorlauf: die
zehn Orte aus Stufe 6 vorher und nachher, dazu vier Spielkamera-Ansichten
(Zentrum, Wohnstrasse, Park vom Weg zum Brunnen, Uferpromenade) zu drei
Zeitpunkten im Abstand von 30 s. Eine Stosszeit kennt das Spiel nicht -
die Bevoelkerung haengt nicht von der Uhrzeit ab. Je Bild zaehlt das
Werkzeug, wer wirklich zu sehen ist (Figur ausgeblendet und neu
gezeichnet, mindestens 25 geaenderte Bildpunkte in ihrem Bildrechteck):
in den 22 Bildern bis 50 m vorher 2 Personen, in 7A 17; bis 100 m 4
gegen 29. Im einzelnen Bild bleibt es aber bei 0 bis 2 Menschen bis
50 m, meist als kleine Figuren in 30 bis 50 m Entfernung - die Strassen
wirken belebter, nicht voll. Der Bildkegel allein zaehlt auch Figuren
hinter einer Hauswand: am Zentrum-Ort 3 im Kegel, 2 sichtbar; an der
Promenade zu t2 zwei im Kegel, keine sichtbar - das Bild ist dort
pixelgleich mit 32107ff. Das
Video (2:07 min, 15 Bilder je Sekunde in Echtzeit, normale Spielkamera,
Gehen mit Alt+W, Gangs aus) geht durch Zentrum (Boulevard z=25),
Geschaeft (Avenue z=175), Wohnen (Strasse z=125), Park (Westarm, Brunnen,
Nordarm) und die Uferpromenade. Abschnitt 1 endet, wo die Figur an einem
Bushaeuschen (Bestand) haengen bleibt; der Parkabschnitt ist neu
gerechnet, weil die erste Route in eine Bank fuehrte. Auch im Video sieht
man meist einzelne Passanten, oft 30 bis 60 m entfernt; nahe Begegnungen
gibt es in der Wohnstrasse und auf der Promenade. Der weisse
Promenadenbelag in einem Teil der Bilder ist Bestand - schon im Video
aus 6B in 88 von 330 Bildern.

**Regression (Keim 4711):** `node --test` 170/170; street-details harte
Fehler 0 (2103 Dinge, 1309 Hindernisse, wie 6B); freigang alle Flaechen
frei (der Arkaden-Befund an der Laterne -18/150 ist Bestand; der
Spielzaehler "auf Fahrbahn" steht bei 5 statt 2 - er zaehlt die
Passanten, die gerade regulaer queren); Stadtraster unveraendert;
Parkautos gleich; Kernsysteme Story 8/8, Seitenfehler 0, npc- und
enemyStaticPenetration 0, Stadtmoebel 19 Felder, 2884 Stueck; Naht
221/221/221, Aussenecke 150/150; Innenklettern 0/0/0/0 (Kontrolle aussen
89/92); MO1 0/0/0; Kletterstetigkeit Foreign 0; Top-out 13/13 und 8/8,
postTopOutUnexpectedDisplacement 0,000; Brutal-Halle gehen und rennen
30/30, invisibleCollision 0; Neon-Pflichtbahnen 27, Brust/Becken/Knie/
Schnitt 0. Naht, Innenklettern, MO1, Kletterstetigkeit, Top-out,
Brutal-Halle und Neon-Bahnen sind zeilengleich mit 6B.

Kernsysteme, Boss-Lebenszyklus: im Regressionslauf "im Spiel 2, nach
Abbau 1". Nachgefahren mit der Bossliste vor und nach dem Abschnitt
(scratchpad/ks-probe.js): ein ENFORCER aus einem Ereignis des Abschnitts
davor lebt noch (nachEvent, 130 bis 200 m entfernt), der Test setzt einen
zweiten, besiegt den neuen, und der alte wartet seine Schonzeit ab - der
vorgesehene Ablauf, kein Leck. Ob ein Ereignisboss ueberlebt, haengt vom
Zufall der Echtzeitphase vor dem Einfrieren ab: 32107ff zeigt den Befund
in 2 von 5 Laeufen, 7A in 2 von 4; 339184b hatte ihn im Vergleichslauf zu
6A.

npc-wege, Keim 4711: 32107ff A 1, D 81, E 85 (wie in 6B); 7A A 1, D 85,
E 78. Der A-Fall von 32107ff (fluechtender Passant an der Hauskiste
-9/100) kommt in 7A nicht mehr vor; dafuer laeuft ein verfolgender
Gegner bei 83/-167 fuer 3,3 s durch eine Hauskiste. An Gegnern aendert
7A nichts, der Laufzeitzufall ist ein anderer. Die E-Fehlschlaege haben
auf beiden Staenden dieselbe Form: andere Gegner belegen die Ringplaetze,
keiner kommt auf 3,2 m heran, keiner wird abgebaut. Mit zwei
weiteren Keimen (nur der Gegnerteil, `npc-wege.js ... <keim> nurE`): Keim
1234 32107ff 72, 7A 79; Keim 2026 32107ff 81, 7A 72; A beide Male 0 auf
beiden Staenden. Ueber drei Keime 79,3 gegen 76,3 - die Streuung je Keim
ist groesser als der Unterschied, und jeder Fehlschlag hat dieselbe Form.

---

## 6p. Aufenthalt: Baenke, Gespraeche und sichtbare Beschaeftigung (Stufe 7B)

7B aendert, WAS die Strassenpassanten ausser Gehen tun - sitzen,
telefonieren, warten, sich umschauen, zu zweit reden - und WO: nur an
Plaetzen, die es in der Stadt wirklich gibt und an denen niemand im Weg
steht. Gleich bleiben die 88 Zivilisten (60 Strasse, 28 U-Bahn), ihre
Verteilung je Stadtteil, Modelle, Looks, Materialien, Sichtfeld-Pruefung,
Parkwege, Wegsuche, Stadt, Haeuser, Verkehr, die Stufe-6-Details,
Missionen und Akt 1. Keine neuen Modelle, keine neuen Bewegungsdateien,
keine neue Passanten-KI, kein neues sichtbares Ding. Pruefstand
`tools/pruef/street-life-activities.js`, Bilder
`tools/pruef/street-life-bilder.js` (jetzt mit Zaehlung je Zustand). Alle
Laeufe mit Keim 4711, eingefroren im ersten Bild nach dem Laden und in
festen Schritten gerechnet (wie 7A); die Figur steht unverwundbar auf
einem Dach, Gangs und Vorfaelle sind aus.

**Bestand e92110a (Teil 1).** Ausser Gehen gab es zweierlei. Am
Routenende einen kurzen Halt (`gehZustand 'aktivitaet'`) mit einer
gewuerfelten Haltung aus zwoelf (telefon, warten, umschauen, tippen,
reden, streiten, trinken, ...) - dort, wo die Route endete, oft mitten
auf dem Gehweg. Und Begegnungen (`sozialPartner`): zwei bleiben stehen,
wo sie sich treffen. Gemessen ueber 240 s (neuer Pruefstand, auf
e92110a): im Mittel 3,7 Passanten im kurzen Halt; 4 Gespraeche mit 47
Paar-Sekunden, davon 21, in denen das Paar dem Gehweg die 1,8 m nahm,
und 15, in denen ein Ding zwischen den beiden stand. Gesessen hat auf
der Strasse niemand - Sitzen gab es nur fuer Fahrgaeste in Bus, Zug und
Wagen und fuer die Geisel. Die 212 Baenke (182 aus Stufe 6A, 30 Bestand)
standen leer.

**Clips (Teil 2).** Die zwoelf Ruheclips an je einem echten Passanten
jedes Modells angesehen (vorn, schraeg) und gemessen (Fuesse gegen die
Wurzel an 40 Zeitpunkten, Hand am Kopf). Genommen: `sitzen` (steht still;
dazu poseSitzen mit Fussziel), `tippen` (Handy vor dem Gesicht, Hand
0,34 bis 0,44 m vom Kopf), `idle` und `umschauen` (Warten, Verweilen,
Zuhoeren), `froh` (wer spricht) und `winken` (Gruss). Nicht genommen:
`reden` (eine SITZENDE Bewegung - im Stehen schwebte die Figur),
`streiten` (kein Streit auf offener Strasse), `warten` (die Fuesse
wandern 0,32 bis 0,34 m um die Wurzel), `trinken` und `telefon` (38,8 s
lang, der Arm klebt 0,31 m am Kopf; `tippen` liest sich besser).

**Die Anker (Teil 4 bis 10).** Einmal beim Laden aus dem, was steht
(`baueAufenthalt`, nach dem Strassenleben, ohne Zug aus dem Stadtstrom),
abgelegt nach 12-m-Zellen und nach Zugangsknoten - zur Laufzeit wird nie
die ganze Liste durchsucht.

- **Bank:** jede Bank der Stufe 6A und des Bestands auf Strassenhoehe.
  Die Sitzflaeche ist an den Dreiecken gemessen: Bankmodell Sitz 0,475 m
  hoch, 0,43 m tief, Armlehnen innen bei +-0,655 m - und auf dem Sitz
  liegt ein Kissen von 0,20 bis 0,60 m; nutzbar sind 0,855 m.
  Bestandsbank 0,4675 m hoch, nutzbar 1,67 m. Platz je Sitzendem: die
  breiteste gemessene Sitzhaltung (mit Tasche 0,62 m) plus 20 cm zum
  Nachbarn - das Modell hat damit EINEN Platz, die Bestandsbank ZWEI.
  Je Platz: Lehnenpunkt, Standpunkt vor der Bank (Koerperradius plus
  1 cm vor dem Hindernis), Anlaufweg vom Zugangsknoten (gerade oder um
  ein Bankende herum, alle 0,35 m frei), Bein- und Fussflaeche frei,
  davor 1,8 m Gehweg.
- **Gespraech (paar):** zwei Stellen 1,25 m auseinander, einander
  zugewandt, nichts dazwischen - in Luecken der Moeblierungszone am
  Gehweg, an der Promenade (Gelaenderseite, alle 22 m) und neben den
  Parkwegen (2,35 m neben der Wegachse, also 0,75 m neben dem 3,2 m
  breiten Weg im Rasen).
- **Einzel:** Gehwegkante (Handy, Warten, Umschauen), Gelaender der
  Promenade (alle 7 m), Kiosk. Am Brunnenrand der Parks (16 Stellen) lag
  das Wegenetz um das Becken zu nah; an den sieben Uhren bestand keine
  Stelle die Standpruefung.

Jeder Standplatz muss frei sein: Boden auf Gehweghoehe, nichts auf
Koerperhoehe (0,42 m), 0,5 m zu jedem Strassendetail, kein
Zebrastreifen, keine Tuer und kein Tuervorfeld, kein U-Bahn-Eingang,
3 m zu Aufzuegen und besonderen Orten, nicht unter Arkaden, 2 m zu jedem
Ueberweg, Abstand zum Gehnetz, und von der Innenkante bleiben 1,8 m
Gehweg frei (dieselbe Pruefung wie Stufe 6). Haltestellen mit Wegen gibt
es im Spiel nicht; die Bushaeuschen sind Bestand und Hindernis.

| | Anker | Plaetze |
| --- | --- | --- |
| Bank (Stufe 6A / Bestand) | 199 (171 / 28) | 220 |
| Gespraech (Gehweg / Promenade / Park) | 227 (197 / 24 / 6) | 454 |
| Einzel (Gehweg / Gelaender / Kiosk) | 311 (239 / 70 / 2) | 311 |
| Summe | 737 | 985 |

Plaetze je Stadtteil (Bank / Gespraech / Einzel): Zentrum 50 / 98 / 48,
Geschaeft 18 / 52 / 30, Mischung 57 / 136 / 94, Wohnen 21 / 66 / 37, Ufer
57 / 82 / 99, Park 17 / 20 / 3. Von 212 Baenken bekamen 199 einen Platz;
14 verworfen wegen des Gehwegs vor den Fuessen, 8 ohne freien Anlauf.
Der Bau dauert beim Laden 139 bis 145 ms, einmal 200 ms (drei Laeufe;
das Strassenleben aus 7A in denselben Laeufen 106 bis 160 ms, stark
streuend).

**Ablauf (Teil 11 bis 13).** Ein Aufenthalt beginnt am Routenende (statt
des bisherigen gewuerfelten Halts) oder unterwegs (alle 3,5 bis 5,5 s,
nur an den naechsten zwei Knoten der eigenen Route). Gewaehlt wird nach
dem Stadtteil (Mischung unten) unter den freien Plaetzen im Umkreis von
16 m; der Platz wird belegt (kein Zweiter kann ihn nehmen), dann geht
es ueber das Gehnetz zum Zugangsknoten, genau auf den Knoten, auf dem
geprueften Weg zum Platz, dort drehen, setzen (0,9 s) oder stehen,
bleiben, wieder aufstehen (0,9 s), denselben Weg zurueck auf den Knoten
und weiter. Kein Teleport: die Figur geht jeden Meter. Gibt es keinen
Weg, wird nichts erzwungen; wer zweimal binnen zwei Minuten nicht
ankommt, sperrt den Platz anderthalb Minuten (im Lauf: nie noetig). Der
Begleiter setzt sich mit auf eine Bank mit zwei freien Plaetzen.
Gespraeche entstehen aus der vorhandenen Begegnung - jetzt gehen beide
zu einem freien Gespraechsplatz in der Naehe, sonst gibt es keins; oder
einer wartet an einem Gespraechsplatz 12 bis 24 s, ob jemand
vorbeikommt (bis 22 m, gerade Linie ueber den Gehweg). Im Gespraech:
Gruss (winken 1,1 bis 1,9 s), dann spricht einer (froh), der andere
hoert zu (idle oder umschauen), die Rollen wechseln nach 2 bis 4,5 s -
nie im Gleichtakt.

Dauer (Teil 15) aus `sdHash(Passant, Art, Anker, Durchlauf)`: sitzen 18
bis 50 s, reden 10 bis 24 s, Handy 8 bis 22 s, warten 6 bis 15 s,
umschauen 5 bis 13 s - keine Welle, in der alle zugleich aufstehen.

Vorrang (Teil 14): Flucht, Gefahr, Mission (Geisel, Fahrgast),
Verletzung, Ausweichen vor Autos, Stau auf den letzten Metern und der
Spieler (naeher als 0,75 m) beenden den Aufenthalt sofort; wer sitzt,
steht in 0,35 s auf. Gemessen mit einer Gang 7 m neben der Person:
Sitzender gibt den Platz nach 0,33 bis 0,4 s frei, flieht ab 0,03 bis
0,1 s, bewegt sich ab 0,43 bis 0,5 s; Stehende und Redende nach 0,03
bis 0,1 s. Niemand bleibt neben einem Gegner sitzen oder stehen (0
Passanten-Sekunden im Aufenthalt naeher als 9 m an einem Gegner, nach
0,5 s Reaktionszeit). Danach geht jeder wieder. Der Spieler 0,3 m neben
einer Figur: stehend frei nach einem Bild, sitzend nach 0,37 s; dann
tritt sie einen Schritt (0,84 m, `saPlatzMachen`) vom Spieler weg -
gerade weg, wenn frei, sonst zur Seite, an einer Bank also an der Bank
entlang. Vorher blieb sie im Aufenthalt stehen: das Ausweichen vor dem
Spieler war dort zusammen mit dem Abstand zwischen Passanten
ausgeschaltet, und der Spieler stand 60 Bilder lang 0,3 m neben ihrer
Mitte (nachgestellt). Nur mit dem Abbruch blieb eine Aufgestandene
zwischen Spieler und Bank stecken - das Ausweichen drueckte sie gegen die
Bank, 0,1 bis 0,2 m neben ihm (nachgestellt); mit dem Schritt steht sie
nach 0,8 s 0,7 m und danach 1,1 m entfernt.

**Sitzen.** Gesessen wird mit dem Clip `sitzen` und poseSitzen; das
Hueftgelenk wandert von der Stehlage auf die Sitzflaeche, die Knoechel
stehen 0,46 m vor dem Becken auf dem Boden. Wie tief das Gesaess unter
dem Hueftgelenk liegt und wie weit Ruecken, Rucksack oder Tasche dahinter
reichen, wird einmal gemessen (`saSitzMasse`, jeder Punkt auf der CPU
gehaeutet wie im Shader): Ruecken 0,08 m (civilian4 ohne Tasche) bis
0,30 m (civilian2 mit Rucksack). Der Oberschenkel faellt zum Knie hin ab;
wer mit kurzem Ruecken ganz hinten sitzt, hat das tiefe Stueck noch ueber
der Sitzflaeche - gemessen ueber alle 24 Looks bis 4,4 cm in der
Kante. Deshalb wird die Unterseite in genau der Haltung gemessen, die das
Spiel stellt (je Bankart, deren Sitzhoehe den Kniewinkel macht; mit dem
festen Fussziel der Messung lag das Bein anders, im Spiel tauchte der
Oberschenkel dann bis 1,4 cm tiefer ein als berechnet), und
`saSitzLage` rueckt die Figur bis 12 cm nach vorn (nur so weit, wie der
Gehweg vor den Fuessen es zulaesst); reicht das nicht, hebt sich die
Huefte, bis hoechstens 1 cm eintaucht. Die Haut ist je Modell gleich und
wird nur einmal je Modell gerechnet, je Look nur Rucksack und Tasche
dazu: 24 Looks kosten zusammen rund 100 ms, verteilt auf das erste
Hinsetzen jedes Looks (vorher 125 ms).

Gemessen jeder Look auf jeder Bankart mit der Platzierung des Spiels
(48 Sitzhaltungen, je 1,5 s nach dem Hinsetzen, jeder Vertex): Gesaess
-1,0 bis 0 cm zur Sitzflaeche, in der Sitzplatte (tiefer als 1,2 cm)
nichts, Sohlen -0,1 bis 0 cm ueber dem Boden, Ruecken 0,7 bis 13,6 cm vor
der Lehne, Huefte 12,5 bis 31,9 cm vor der Lehne, angehoben hoechstens
1,1 cm; die Huellkugel der Figur bleibt mindestens 44,6 cm innerhalb. Im
Lauf dazu jede sitzende Figur der Stadt: 38 Messungen, Gesaess -1,0 bis
0 cm, 0 Fehler. Die Nahaufnahmen der vorn sitzenden Looks (civilian4 und
civilian5 auf der Bestandsbank, 11 und 12 cm vorgerueckt) zeigen
aufrechtes Sitzen auf der vorderen Haelfte.

**Anteil und Mischung (Teil 11, 16).** Hoechstens ein Anteil der 60
Strassenpassanten hat zugleich einen Aufenthalt vor (unterwegs dorthin,
dort, beim Aufstehen). Gemessen 20, 35 und 50 Prozent, 240 s, dazu eine
zweite Mischung M2 (Zentrum mehr Handy und Reden, Wohnen und Park mehr
Sitzen) bei 35 Prozent. Sicht wie in 7A: im Bildkegel der zehn
Strassenorte und ohne Haus dazwischen, Mittel je Sekunde, Summe ueber
die Orte; telefon heisst Handyhaltung bis 32 m (so weit zeigt das Spiel
das Handy).

| | e92110a | 20 % | 35 % | 35 % M2 | 50 % |
| --- | --- | --- | --- | --- | --- |
| im Aufenthalt (Mittel) | - | 11,5 | 19,7 | 19,6 | 25,9 |
| davon sitzend/stehend/redend | (kurzer Halt 3,7) | 7,4 | 12,3 | 12,1 | 16,5 |
| Sitzplaetze belegt, Mittel / max | 0 | 3,7 / 8 | 5,2 / 8 | 5,6 / 8 | 7,6 / 12 |
| Gespraeche in 240 s | 4 | 3 | 8 | 7 | 9 |
| gehend (Mittel) | 41,2 | 34,1 | 28,6 | 27,8 | 23,2 |
| sichtbar bis 50 m: gehend | 5,40 | 6,03 | 4,41 | 4,45 | 4,08 |
| sichtbar bis 50 m: sitzend | 0 | 0,46 | 0,90 | 0,70 | 0,92 |
| sichtbar bis 50 m: redend | 0 | 0,13 | 0,37 | 0,05 | 0,16 |
| sichtbar bis 50 m: Telefon / wartend | 0,02 / 0,62 | 0,03 / 0,54 | 0,05 / 0,95 | 0,14 / 0,82 | 0,21 / 0,53 |
| sichtbar bis 50 m: gesamt | 6,03 | 7,19 | 6,67 | 6,17 | 5,92 |
| sichtbar bis 100 m: gesamt | 11,70 | 12,61 | 12,03 | 12,11 | 11,65 |

Gewaehlt: **35 Prozent, Mischung M1**. Damit stehen an den zehn Orten bis
50 m im Mittel 2,27 Personen, die nicht gehen (vorher 0,64), und es
bleiben 4,41 Gehende im Bild. 50 Prozent bringt keine weitere sichtbare
Beschaeftigung (1,82), nimmt aber noch einmal ein Fuenftel der Gehenden
von der Strasse; 20 Prozent halbiert die Beschaeftigung. M2 zeigt weniger
Gespraeche, wo man hinsieht (0,05 statt 0,37). Die Kandidatenbilder (22
je Kandidat nach 120 s Vorlauf, Vergleichsblaetter vorher/20/35/50)
zeigen dasselbe in klein - 0 bis 5 Sichtbare je Bild, nicht gehend bis
100 m: vorher 0, 20 % 5, 35 % 6, 50 % 6; eine Momentaufnahme haengt aber
am Zufall des Augenblicks (vorher kommen 16 der 29 Sichtbaren aus den
vier Parkansichten; gemittelt ist der Park in beiden Staenden gleich,
2,94 und 2,99 bis 100 m).

Mischung M1 (Anteil je Beschaeftigung; Lust: wie gern man ueberhaupt
stehen bleibt):

| Stadtteil | sitzen | reden | Handy | warten | umschauen | Lust |
| --- | --- | --- | --- | --- | --- | --- |
| Zentrum | 0,20 | 0,30 | 0,25 | 0,20 | 0,05 | 0,9 |
| Geschaeft | 0,20 | 0,25 | 0,30 | 0,20 | 0,05 | 0,9 |
| Mischung | 0,30 | 0,20 | 0,20 | 0,15 | 0,15 | 0,8 |
| Wohnen | 0,40 | 0,10 | 0,20 | 0,15 | 0,15 | 0,6 |
| Ufer | 0,35 | 0,20 | 0,10 | 0,05 | 0,30 | 1,0 |
| Park | 0,50 | 0,15 | 0,10 | 0 | 0,25 | 1,2 |

Im Lauf (Mittel je Sekunde; Personen im Stadtteil vorher / 7B, dann in
7B sitzend, stehend mit Handy/warten/umschauen, im Gespraech oder am
Treffpunkt, auf dem Weg zum Platz; kurzer Halt vorher / 7B):

| Stadtteil | Personen | sitzend | stehend | Gespraech | zum Platz | kurzer Halt |
| --- | --- | --- | --- | --- | --- | --- |
| Zentrum | 18,90 / 18,68 | 1,65 | 0,94 | 0,97 | 2,19 | 0,97 / 0,21 |
| Geschaeft | 7,45 / 7,87 | 0,44 | 0,76 | 0,27 | 0,80 | 0,62 / 0,10 |
| Mischung | 15,90 / 16,43 | 1,22 | 1,43 | 0,38 | 1,74 | 0,85 / 0,13 |
| Wohnen | 4,94 / 3,69 | 0,29 | 0,31 | 0,09 | 0,33 | 0,31 / 0,03 |
| Ufer | 9,68 / 9,23 | 0,88 | 0,85 | 0,47 | 1,88 | 0,64 / 0,04 |
| Park | 2,90 / 4,10 | 0,82 | 0,18 | 0,31 | 0,48 | 0,27 / 0,04 |

In 240 s begonnen: 37 Mal sitzen, 44 Handy, 34 reden, 31 umschauen,
18 warten; 8 Gespraeche zu zweit (122 Paar-Sekunden, Abstand 1,04 bis
1,48 m); 73 Mal am Routenende nur kurz umgeschaut (1 bis 2,5 s) - kein
Platz in der Naehe frei, der Anteil voll oder keine Lust. Belegt waren
im Mittel 5,2 der 220 Sitzplaetze, hoechstens 8.

**Im Weg? (Teil 17, 21, 22).** Jeder der 737 Plaetze ist im Pruefstand
noch einmal nachgeprueft - mit allen Hindernissen, auch denen der spaeter
geladenen Moebelmodelle: Standpunkt, Tuer, Abstand zum Gehnetz (0,75 m),
1,8 m Gehweg daneben, Anlaufweg, bei Gespraechsplaetzen Abstand,
Blickrichtung und nichts dazwischen - 0 Fehler. Im Lauf: niemand in
einem Ding oder Haus, niemand abseits seines Anlaufwegs, niemand durch
die Beinflaeche eines Sitzenden (Gehende halten 1,15 m vom Standpunkt
eines Sitzenden statt 0,85 m), keine Doppelbelegung; Gespraeche 0 Mal zu
nah, zu weit, abgewandt, im Hindernis, getrennt oder auf dem Gehweg
(vorher 21 und 15 Sekunden). Keine Stau-Traube, keine Traube aus drei
Aufenthalten, groesste Traube 3 (vorher 3); ohne Weg 0, gesperrt 0,
unerreichbar 0, Stau auf den letzten Metern 0. Laengster ungewollter
Stillstand 3 s (vorher 2 s); gezaehlt nur die Sekunden, in denen jemand
steht und gerade nichts Gewolltes tut - die erste Fassung zaehlte die
Sitzzeit davor mit (41 s Bank, dann 1 s bis zum Losgehen: "43 s"). Die
Geisel einer Mission (stGeisel setzt den naechsten Passanten dorthin)
gilt als gewollt: 71 Passanten-Sekunden, vorher 70. Kreuzung 86/-148:
ein Aufenthalt von mehr als 10 s in 8 m Umkreis, ungewollt 0 s.

`street-life.js` (7A) auf 7B: harte Geometriefehler 0; Fahrbahn ohne
Ueberweg gehend 86 (vorher 87), abseits Netz > 3 s 88 (83 - die Plaetze
liegen bewusst neben dem Netz), enge Stelle blockiert 3 (5). Park: im
Busch 27 Personen-Sekunden (vorher 38), auf Pflanzscheibe 0 (1), Rasen
innen 123 (30) - das sind die Gespraechsplaetze neben den Parkwegen, die
bewusst 0,75 m neben dem Weg im Rasen liegen; im Park sind im Mittel 4,1
statt 2,9 Personen.

**Pruefstand (Teil 18 bis 20).** `street-life-activities.js` misst Anker,
Lauf, Sicht je Zustand, Sitzgeometrie (jede Sitzende und jeder Look auf
jeder Bankart, jeder Vertex), Huellkugel (stehende Haltungen: 8 Figuren,
mindestens 35,7 cm innen; sitzend siehe oben), Gefahr und Spieler.
Endstand: harte Fehler 0. Auf e92110a laeuft er ohne Anker-, Sitz- und
Gefahrteil; dort sind die zwei Gespraechsfehler (21 und 15 Sekunden) die
einzigen harten Fehler.

**Sicht je Ort** (Mittel je Sekunde, vorher / 7B):

| Ort | bis 50 m gesamt | bis 50 m nicht gehend | bis 100 m gesamt |
| --- | --- | --- | --- |
| 01 Zentrum | 1,16 / 1,06 | 0,05 / 0,39 | 2,27 / 2,37 |
| 02 Geschaeft | 0 / 0 | 0 / 0 | 0,65 / 0,96 |
| 03 Mischung | 0,55 / 0,17 | 0,02 / 0,01 | 1,07 / 0,53 |
| 04 Wohnen | 0,17 / 0,24 | 0 / 0 | 0,71 / 0,67 |
| 05 Parkrand | 0,95 / 0,75 | 0,10 / 0,36 | 1,54 / 0,90 |
| 06 Park innen | 1,87 / 2,16 | 0,28 / 0,69 | 2,94 / 2,99 |
| 07 Ufer | 0,92 / 1,77 | 0,09 / 0,73 | 1,40 / 2,33 |
| 08 Boulevard | 0,05 / 0,28 | 0 / 0,09 | 0,27 / 0,59 |
| 09 Local Street | 0 / 0,01 | 0 / 0 | 0 / 0,11 |
| 10 Avenue | 0,36 / 0,23 | 0,10 / 0 | 0,85 / 0,58 |
| Summe | 6,03 / 6,67 | 0,64 / 2,27 | 11,70 / 12,03 |

Bis 50 m je Zustand (Summe): gehend 5,40 -> 4,41, sitzend 0 -> 0,90,
redend 0 -> 0,37, Telefon 0,02 -> 0,05, wartend 0,62 -> 0,95.

**Leistung (Teil 27 bis 29).** Endstand, auf der ruhigen Maschine
nacheinander gemessen. `stadt-leistung.js`, 300 Aufnahmen, drei Laeufe
und e92110a im selben Durchgang: GESAMT-Median 794, Luftbild 859,5,
Strasse 753,5, Dach 768, hoechstens 2597 Aufrufe - zwei Laeufe Aufruf
fuer Aufruf und Dreieck fuer Dreieck wie e92110a, der erste nach dem
Neustart der Maschine 0,5 bis 1 Aufruf darunter (7B fuegt nichts
Sichtbares hinzu). CPU der Passanten (kosten2, 600 Schritte am
Zentrum-Ort mit und ohne Passanten, drei Laeufe je Stand im Wechsel):
2,8 / 2,9 / 2,9 ms je Schritt gegen 3,1 / 3,1 / 3,4 ms auf e92110a -
nicht hoeher (wer sitzt oder steht, braucht kein Ausweichen und keine
Schrittplanung). Wegsuchen 20 statt 9 in 600 Schritten (die Wege zum
Platz), zusammen 0,9 bis 1,4 ms statt 2,4 bis 5 ms (kurze Wege).
Spielnah an den zehn Orten kosten die Passanten im Median 29,5 statt 27,5
Aufrufe: je gezeichnete Figur gleich viele Teile (Zentrum 5,6 und 5,5),
aber am Zentrum-Ort stehen 13 statt 11 im Bildkegel, weil Sitzende und
Stehende laenger im Bild bleiben; 216.000 statt 219.000 Dreiecke.
Ladezeit bis spielbereit 34,5 und 34,0 s gegen 36,2 und 31,8 s (die
Streuung ist groesser als der Ankerbau); Ankerbau beim Laden 139, 145
und 200 ms (im 200-ms-Lauf brauchte auch das Strassenleben aus 7A 160
statt 106 bis 136 ms). Zur Laufzeit gibt es keine Suche ueber alle
Anker: Kandidaten kommen aus der 12-m-Zelle oder vom Knoten der eigenen
Route; je Bild wird nur die Liste der Passanten gezaehlt (88).

**Bilder und Video (Teil 30, 31).** `street-life-bilder.js` nach 120 s
Vorlauf, e92110a und 7B nebeneinander: 22 Vergleichsblaetter VORHER |
NACHHER (die zehn Orte, dazu die vier Spielkamera-Ansichten aus 7A zu
drei Zeitpunkten); die Bilder des Endstands sind bis auf einzelne
Bildpunkte des Renderers (PSNR 80 bis 105 dB) gleich denen der
Kandidatenwahl (35 Prozent, M1). Je Bild zaehlt das Werkzeug, wer
wirklich zu sehen ist und was er tut; wer dem Helden zuschaut, zaehlt
seit der Abnahme getrennt als "gafft" - das Werkzeug stellt den
unsichtbaren Helden fuer jede Aufnahme an die Kamera, und wer naeher als
9 m ist, bleibt stehen und jubelt ihm zu (Bestand seit 7A, kein
Aufenthalt). In den 22 Bildern bis 25 m vorher 3 Personen, in 7B 5
(eine sitzt, eine hat das Handy, einer gafft); bis 50 m 17 gegen 8, bis
100 m 29 gegen 15 - vorher alle gehend, in 7B 6 von 15 nicht gehend: 4
im Aufenthalt (Bank, Gespraechsplatz, Warten, Handyplatz - das Handy
zeigt das Spiel erst unter 32 m), 1 kurzer Halt am Routenende mit Handy,
1 Gaffer (am Ufer-Ort, 4,4 m vor der Kamera, die Arme hoch; nachgestellt:
Passant ohne Aufenthalt, gafft und jubelt). Eine Momentaufnahme haengt am
Zufall des Augenblicks (vorher kommen 16 der 29 aus den vier
Parkansichten); verglichen wird das Mittel ueber 240 s (Tabellen oben).
Nahaufnahmen (scratchpad/nah.js, im Lauf
gesucht, Kamera 3 bis 8,5 m auf Augenhoehe mit freier Sicht): Bank des
Bankmodells mit einer Person, Bestandsbank im Park, Bank im Wohngebiet,
Gespraech am Gehweg, Handy am Gehweg, Park (Treffpunkt neben dem
Parkweg), Ufer (Promenade), Zentrum (Bank am Gehweg). Zwei auf einer Bank
kam in keiner Suche vor (im Mittel sind 5 der 220 Plaetze belegt); dafuer
ein gekennzeichnet GESTELLTES Bild mit dem Pruefaufruf aufenthaltSitzen:
zwei Passanten auf den zwei Plaetzen einer Bestandsbank, Plaetze
0,835 m auseinander, die Huellen 7,7 cm voneinander. Video (normale
Spielkamera, Gehen mit Alt+W, Gangs und Vorfaelle aus, 15 Bilder je
Sekunde in Echtzeit) in zwei Fassungen, jede mit Titeltafel und
Kennzeile in jedem Bild. Fassung A - unveraenderte Rundwege, die festen
Wege wie in 7A (Zentrum Boulevard z=25, Geschaeft Avenue z=175, Wohnen
Strasse z=125, Park zum Brunnen, Uferpromenade; 2:18 min): im
30-m-Umkreis meist 0 bis 1
Person, einen Aufenthalt sieht man nur in der Geschaeftsstrasse (warten)
und am Ufer (Handy) - so duenn sind 60 Passanten auf dieser Stadt.
Fassung B - gezielt ausgewaehlte belebte Stellen, also NICHT
repraesentativ (2:18 min): je Stadtteil nach dem Vorlauf
die Stelle mit den meisten Leuten im Aufenthalt (gibt es keine, wird in
5-s-Schritten bis 60 s weitergerechnet - Wohnen 20 s, Park 5 s), der Weg
ueber das Gehnetz ohne Ueberweg von 25 bis 40 m davor bis 25 bis 40 m
dahinter (im Park ueber den Ringstreifen im Rasen, den auch die Passanten
gehen). Dort zeigt jeder Abschnitt, was die Mittelwerte sagen: meist eine
Person im Aufenthalt in 30 m - im Zentrum, in der Geschaeftsstrasse und
im Wohngebiet je eine Sitzende auf der Bank (im Wohngebiet danach eine,
die sich umschaut), im Park ein Treffpunkt neben dem Parkweg und eine
Sitzende, am Ufer eine Sitzende auf der Promenadenbank, die aufsteht,
waehrend der Held vorbeigeht, und auf ihrem Anlaufweg zum Gehnetz
zurueckgeht. Abnahmemedien (beide Videofassungen, Vergleichsblaetter,
Nahaufnahmen, Plan und Ergebnis des Ueberlappungsvergleichs) liegen in
`docs/abnahme-7b/`.

**Regression (Keim 4711, Endstand):** `node --test` 170/170;
street-details harte Fehler 0 (2103 Dinge, 1309 Hindernisse, Ausgabe
zeilengleich mit 7A); freigang alle Flaechen frei, zeilengleich mit 7A bis
auf die Bauzeit und den Spielzaehler "auf Fahrbahn" (2 statt 5 - er
zaehlt, wer gerade regulaer quert); Stadtraster unveraendert; Parkautos
gleich; Bevoelkerung 88 (60 Strasse, 28 U-Bahn), Heimat, Modelle und
Kleidung wie e92110a, 28 verschiedene Looks; Culling aktiv (Huellkugel:
stehende Haltungen 8 von 8 gemessen, mindestens 35,7 cm innen, sitzend
44,6 cm). Kernsysteme Story 8/8 (8 gestartet, 8 sauber beendet),
Seitenfehler 0, Boss-Lebenszyklus ok, npc- und enemyStaticPenetration 0,
Stadtmoebel 19 Felder, 2884 Stueck. Naht 221/221/221, Aussenecke 150/150,
MO1 0/0/0, Kletterstetigkeit (Foreign 0), Top-out 13/13 und 8/8 mit
postTopOutUnexpectedDisplacement 0,000, Brutal-Halle gehen und rennen
30/30 mit invisibleCollision 0, Neon-Pflichtbahnen 27 mit
Brust/Becken/Knie/Schnitt 0 - alle zeilengleich mit 7A. Innenklettern
0/0/0/0.

Fingerabdruck der Weltgenerierung (`szene.js`): Haeuser, Lots, POIs,
Parkautos, Wagen, Gegner und Strassendetails gleich; im ersten Bild nach
dem Laden auch Szenenobjekte, Meshes und Materialien (18000 / 7902 /
2306). Der Passanten-Eintrag des Werkzeugs haengt an der Reihenfolge der
Kinder im Figurenbaum und wechselt schon zwischen zwei Laeufen desselben
Stands (e92110a 4c26fc39 und de9e7428); ohne Reihenfolge, ueber alle
Meshes (Name, sichtbar, Farbe, Material) sind 7B und e92110a gleich
(d5817994). Spaeter haengen die Zahlen an den Handys und Schirmen, die
das Spiel beim ersten Gebrauch anlegt - nach der Echtzeitphase beide
Staende 20159 Objekte.

Drei Befunde, alle nachgestellt und auf e92110a ebenso vorhanden:

- Innenklettern, Kontrolle aussen: im Regressionslauf 14 von 92
  angeklebt (e92110a 89). Der Held ist dort ab Raum 4 TOT (hp 0,
  "downed"): der Pruefstand laesst die Echtzeit bis zum Einfrieren laufen,
  setzt keine Unverwundbarkeit und schaltet keine Weltereignisse ab; in
  den 1527 s Testzeit starten 14 bis 16 Ueberfaelle und Gangs, deren
  Gegner neben den Testhaeusern stehen. Ob sie ihn erwischen, haengt am
  Zufall der Echtzeitphase - schon ein Zusatz, der erst nach dem Test
  laeuft, macht aus 14 wieder 89. Deterministisch nachgestellt
  (eingefroren im ersten Bild, dann n s gerechnet): ohne Vorlauf 7B 89/92
  (zweimal) und e92110a 89/92; mit 3 s Vorlauf 7B 20/92 und e92110a
  20/92, beide Male der Held tot; mit 6, 10 und 15 s 7B 89/92. Die vier
  Innenwerte sind in allen Laeufen 0. Abnahme: der Pruefstand ist jetzt
  isoliert (Standard: eingefroren nach dem Laden, Weltereignisse, Gegner
  und Wagen in jedem Schritt aus, je Fall ein lebender Held am festen
  Start, nicht unverwundbar) und meldet Tod, Treffer, verfehlten oder
  ungueltigen Start als UNGUELTIGEN Fall - weder Kletterfehler noch
  bestanden (Exit 2); `welt` ist der Integrationslauf mit aktiven
  Weltereignissen und Gefahren, ohne Isolierung. Isoliert: 7B zweimal
  und e92110a zeilengleich - innen 108 gueltig, 0/0/0/0, aussen 89 von
  92 angeklebt, 0 ungueltig; ebenso nach 3 s freiem Vorlauf. Eingebauter
  Tod beim Start und im Lauf: beide als ungueltig gemeldet, die uebrigen
  Faelle starten wieder lebend. welt: 7B ohne Stoerung (bestanden),
  e92110a zwei Treffer durch eine Gang (UNGUELTIG).
- Kernsysteme, playerNpcOverlap: im Endstand 12 Bilder in 5 von 10
  Laeufen, e92110a 0 in 7 Laeufen. Jedes Mal derselbe fliehende Passant
  (vorher im Aufenthalt, jetzt wieder gehend), der bei t = 61,25 s in
  0,18 s durch den stehenden Helden rennt.
  (A) Der Mechanismus ist alt: nachgestellt auf freier Flaeche (Gegner
  4 m hinter dem Passanten, Held 2,5 m davor) auf 7B und e92110a
  identisch kleinster Abstand 0,054 m, 11 Bilder unter 0,45 m - die
  Fluchtsteuerung weicht dem Spieler nicht aus, und der Abstandsschub
  haelt Rennende nicht auf.
  (B) Ob 7B die Haeufigkeit im Ablauf erhoeht, prueft ein gepaarter
  Vergleich mit vorab festgelegtem Plan (`tools/pruef/flucht-ueberlappung.js`,
  Plan und Ergebnis in `docs/abnahme-7b/`): 20 Keime mal zehn
  Strassenorte je Stand, eingefroren im ersten Bild, 120 s Vorlauf, keine
  Weltereignisse; der Held steht 30 s still (Gaffer sammeln sich), dann
  eine Gang 10 m voraus mit auf beiden Staenden gleich gesetztem Zufall,
  10 s Flucht. Koerper aus player.radius/height und c.radius,
  Ueberschneidung = Mittenabstand unter der Radiensumme bei
  ueberlappender Hoehe, zusammenhaengende Bilder als ein Ereignis.
  Ergebnis 7B gegen e92110a (je 200 gueltige Episoden): Ueberschneidungen
  mit Fliehenden 6 gegen 6 (Ratenverhaeltnis 1,00, 95 % 0,27 bis 3,74,
  einseitig p = 0,61), davon tiefer als 0,45 m 1 gegen 2, Dauer 0,13 bis
  0,30 s gegen 0,12 bis 0,33 s, Tiefe 0,10 bis 0,52 m gegen 0,06 bis
  0,74 m; Fluchtbegegnungen unter 2 m 13 gegen 16 (0,81, bis 1,80);
  Spielzaehler 84 gegen 92 Bilder (0,91, 0,67 bis 1,24); je Episode
  gepaart 6-mal mehr, 6-mal weniger, 188-mal gleich. Nach der vorab
  festgelegten Regel ist das Ergebnis UNKLAR: eine Erhoehung ist nicht
  nachweisbar, die seltenen Ueberschneidungen lassen aber bis zum
  3,7-fachen offen. Verschoben hat sich die Herkunft: e92110a 6 von 6 aus
  Gaffern; 7B 3 aus Gaffern und 3 unmittelbar nach einem
  Aufenthalts-Abbruch (zweimal von der Bank aufgesprungen, einmal auf dem
  Weg zur Bank; 0,47 bis 3,65 s nach dem Abbruch). Im 10-m-Kreis standen
  bei Gangbeginn weniger Gaffer (74 gegen 98), dafuer Sitzende (10) und
  Handy (4). Ueberschneidungen ohne Flucht: 7B 7, e92110a 10 (eine in 7B
  dauert 30 s: der Held wurde neben eine Passantin gesetzt, die dann
  stehen bleibt und gafft - Versuchsaufbau). Nicht in 7B repariert: keine
  Flucht- oder Kollisionsaenderung auf Verdacht.
- npc-wege: 7B A 1, B 2, C 0, D 86, E 83 (7A: A 1, B 0, D 85, E 78). Die
  B-Faelle sind Passanten, die 93 bis 107 s vor Gangs fliehen und dabei
  unter die Bodenflaeche geraten (einer am anderen Ufer). e92110a heute im
  selben Ablauf: A 0, B 1, D 84, E 84. Mit eingefrorenem Start beide
  Staende gleich: A 3, B 1, C 0, D 89, E 79 und 78.

Mit Gangs im 7A-Pruefstand (`street-life.js gegner=120`) zaehlte 7B bei
Keim 4711 44 Fahrbahn-Episoden ohne Ueberweg statt 30 (ohne Gangs 42
statt 57). Weitere Keime, beide Staende: 11 23 gegen 26, 12 29 gegen 39,
13 30 gegen 46 - in Summe ueber vier Keime 126 gegen 141 mit Gangs und
286 gegen 367 insgesamt; kein Nachteil durch 7B.

**Grenzen.** Belegt sind im Mittel 5 von 220 Sitzplaetzen - 60
Strassenpassanten auf einer Stadt dieser Groesse; die meisten Baenke im
Bild bleiben leer, und zwei Fremde auf einer Bank kommen kaum vor (nur
die Bestandsbank hat zwei Plaetze). Das Handy zeigt das Spiel wie bisher
nur bis 32 m um den Helden. Das Bankmodell hat wegen des Kissens nur
einen Platz. Bei Regen (Staerke ueber 0,25) setzt sich niemand. Die
Momentaufnahmen an den zehn Orten streuen stark; verglichen wird das
Mittel ueber 240 s. Nicht 7B: der weisse Promenadenbelag in einem Teil
der Bilder, das Bushaeuschen, an dem die Figur im 7A-Video haengen
blieb, und fliehende Passanten, die dem Spieler nicht ausweichen (siehe
Regression).

---

## 6q. Erdgeschosse, Fenster und Bezirksbild (Stufe 8A)

Ziel: beim Durchlaufen eine hochwertige, glaubwuerdige, stilisierte
Grossstadt "aus einem Guss" - die Stadtteile unterscheidbar durch
Material, Fassadenrhythmus, Erdgeschoss, Fenster, Eingaenge und Licht,
nicht durch Schilder, Minimap, Anzeige oder Farbfilter. Fenster duerfen
nicht als leere Kaesten wirken. Bezirkseinteilung, Haeuser, Lots,
Modelle, Hoehen, Strassen, Verkehr, Parkautos, Strassendetails,
Passanten, Aufenthalte, Wege, Klettern, Kamera und Story bleiben, wie sie
sind.

### Ausgangsstand (82607ec, Keim 4711, `tools/pruef/district-identity.js`)

| Stadtteil | Bloecke | Haeuser | Modell / prozedural | Hoehe Med / Max | Ladenkanten | Leuchtschilder | Laternen | Mittelfarbe Fassade |
|---|---|---|---|---|---|---|---|---|
| ZENTRUM | 24 | 76 | 76 / 0 | 39,6 / 95,6 m | 32 von 96 | 116 | 15 | #7a7974 |
| GESCHAEFT | 12 | 56 | 56 / 0 | 32,7 / 66,6 m | 24 von 48 | 118 | 6 | #75716b |
| MISCHUNG | 37 | 230 | 149 / 81 | 25,4 / 47,8 m | 36 von 148 | 429 | 13 | #686460 |
| WOHN | 24 | 164 | 50 / 114 | 15,8 / 24,2 m | 27 von 96 | 126 | 14 | #5d5b59 |
| UFER | 11 | 91 | 74 / 17 | 25,4 / 55,0 m | 6 von 44 | 166 | 50 | #6e6b66 |
| PARK | 2 | 0 | - | - | - | 0 | 2 | - |

Die Fassadenfarbe ist aus den Materialien gerechnet (Materialfarbe mal
mittlere Texturfarbe, nach Fassadenflaeche gewichtet): in jedem Stadtteil
83 bis 93 Prozent Grau. Dieselben Downtown-Modelle stehen ueberall
(Residential_3, ModernOffice_1/2, PublicBuilding_1, Brutal_1), im Zentrum
dazu die Tuerme aus createTower. Leuchtschilder haengen im Wohngebiet so
dicht wie im Geschaeftsviertel (126 auf 164 gegen 118 auf 56 Haeuser).

**Was schon unterschied:** die Hoehe (Tuerme im Zentrum), das Wasser am
Ufer, Rasen und Baeume im Park, Baumreihen in Wohn- und Mischgebiet
(Stufe 6), die Landmarken-POIs Stadtkrone, Nordturm und Bankhaus und 8
der 10 U-Bahn-Eingaenge im Zentrum. **Was fehlte:** auf Strassenhoehe
sahen Geschaeft, Mischung und Wohnen gleich aus - derselbe graue
4-m-Plattenbelag in jedem Stadtteil, die prozeduralen Wohnhaeuser mit
Fensterraster bis zum Boden und ohne einen einzigen Eingang, keine Laeden
an den Ladenkanten, keine Orientierung zu Park, Ufer oder Zentrum. Die
festen Vorher-Bilder (je Stadtteil zwei Strassenaufnahmen mit der
Spielkamera, eine Luftansicht, drei Grenzen, drei Lichtkontrollen) stehen
in `docs/abnahme-8a/`.

### Vorhandene Systeme, auf denen 8A aufsetzt

- `stadtteilArt` / `STADTTEIL` / `stadtteilAn`: die eine Bezirkseinteilung
  (unveraendert 24 / 12 / 37 / 24 / 11 / 2), `kantenNutzung` je
  Blockkante (LADEN an Avenue und Boulevard auch ausserhalb des
  Geschaeftsviertels, BUERO, WOHNEN, GEMISCHT).
- das Gehweg-Mesh aus `buildCity` (ein Mesh, Kachel aus der Weltlage)
- die Fassaden-Tiefenkarte der Kletterhaut (`FASS_GITTER`, gelesen wie
  `hautTiefe`), die Leuchtschilder (`NEON_KISTEN`, `neonZuschnittMin`)
- `createTower` (Lobby, Geschosse, Glas) und das Band ueber der Lobby
- vorhandene Laternen (`LATERNE_STELLEN`), Parks (`parks`), POIs
- die Freiraumpruefungen der Strassendetails (`sdNahe`, `sdNetz`,
  `SD.baumRaster`, `SD.bestand`) und die Aufenthaltsanker (`saAnkerNahe`)

### Neufassung nach der Human-Abnahme

Die erste Fassung (9915ef5) wurde nicht abgenommen: billig, kuenstlich,
flach, zu sehr ueber Textschilder ("Bistro", "Cafe", "Kanzlei",
"Elektro"), teilweise leer und unfertig - durch die Fenster sah man leere
Raeume. Der Bezirk wurde behauptet, nicht gebaut. Diese Fassung ersetzt
sie ganz; der Ansatz ist umgekehrt: Qualitaet aus Material, Fassadenrhythmus,
Tiefe, Eingaengen und kontrolliertem Glas - Text nur noch, wo er hingehoert.

**Audit der ersten Fassung (Strassenhoehe, Keim 4711):**

- *Schilder.* 18 + 48 + 95 + 66 + 10 Ladenschilder (16 Ladenarten),
  57 + 5 Bueroschilder, 42 Wegweiser, 48 Banner, 7 Parkportale - fast
  alles flache Tafeln mit einem Wort. Sie waren das Hauptmittel der
  Bezirke und zugleich das, was billig wirkte.
- *Leere Fenster.* Nur die Tuerme (`createTower`) hatten echtes Glas.
  Dahinter ein drei Meter tiefer, fast leerer Raum ohne Licht, die Lobby
  kahl; aus der Naehe ein Loch. Die Modellhaeuser zeigen Fototextur-Fenster
  (flach, tags hellblau), die prozeduralen Haeuser ein Fensterraster bis
  zum Boden.
- *Schwarze Erdgeschosse.* Arkade (ModernOffice_1), Saeulenreihe
  (PublicBuilding_1), offene Halle (Brutal_1) und Pfeilerreihe
  (Residential_3): dahinter eine fast schwarze Rueckwand - der staerkste
  Eindruck "leer und unfertig" beim Gehen. Die erste Fassung hatte dort
  bewusst nichts gesetzt (keine ebene Flaeche fuer ein Schild).
- *Flach.* Jede Tafel eine Farbe auf der Fassade, ohne Relief, ohne
  Tiefe, ohne Licht.

**Entfernt:** alle Laden- und Bueroschilder, Wegweiser, Banner und
Parkportale - der Text-Atlas schrumpft von 1024 x 2048 auf 1024 x 512.
**Behalten:** die Hausnummern (Emailschild, jetzt neben echten
Hauseingaengen), die Namen der drei Wahrzeichen (Metallbuchstaben ohne
Grund auf dem Lobbyband), die 39 Vorplaetze vor den Hochhaeusern und der
Belag je Stadtteil.

### Das System

**1. Fenster mit Innenraum (`city-visuals.js`, `innenraumPatch`).** Ein
Zusatz fuer Lambert- und Phong-Materialien (`onBeforeCompile`): je
Scheibe ein Raum im Fragment-Shader (Interior Mapping) - Rueckwand,
Seitenwaende, Boden, Decke mit Leuchten, dazu Moebelkarten in festen
Tiefen (Schreibtisch mit Bildschirm, Stuhl, Schrank, Pflanze; Theke;
Regale, Puppen, Staender; Sofa und Lampe; Cafetische), vorn Jalousie
(Buero) oder Vorhang (Wohnung), darueber Fresnel-Spiegelung von Himmel,
Gegenueber und Strasse. Raumarten: Buero, Lobby, Laden, Wohnung, Cafe;
Ladenwaende je Laden warmgrau, dunkel oder hell. Ob Licht brennt,
entscheidet ein ganzzahliger Hash je Scheibe (Quote je Raumart); am Tag
gedaempft gegen draussen, nachts an oder aus, hinten dunkler.
`setzeInnenraumLicht` (aus `updateTagNacht`) liefert Nachtanteil und
Himmelfarbe - ein Uniform-Paar fuer alle Materialien. Modi je Eckpunkt
(`aIrRaum.w`): 0 Flaeche (Material des Sockels), 1 Scheibe mit Raum,
2 Tuernische (Laibung, Tuerblatt mit Glas, Oberlicht, Griff, Downlight),
3 klares Glas (echter Raum dahinter). Oberlichter: dunkel getoentes Glas
mit Schimmer von innen. Keine zusaetzliche Geometrie fuer die Raeume,
keine Textur.

**2. Hochhaeuser (`createTower`).** Die Bueroscheiben zeigen ihre Raeume
(Modus 1) - jede Scheibe ein eigener Raum, Licht an oder aus, Jalousie
oder nicht; das Loch ist weg. Die Lobby bleibt echter Raum hinter klarem
Glas (Modus 3) und ist eingerichtet: beleuchtete Steinwand am Kern,
Lichtbaender unter der Decke, Pflanzen in Toepfen, vorn Empfangstheke
und Portal (dunkle Laibung und Sturz um die Tuer), an den anderen
Seiten Sitzgruppen. Steinsockel (0,45 m) je Turmstil, Pfeiler beginnen
ueber ihm. Raumlicht je Stil (kuehl, warm). Alles in der Kiste: die
Kollision bleibt die geschlossene Huelle, Grundriss und Dach exakt wie
vorher (`tools/test-city-polish.cjs`, `test-realism-polish.cjs`).

**3. Erdgeschosse an jeder Strassenseite (`biSockel`).** Flach auf der
Fassade (1,5 cm davor, exakt geprueft), gebaut aus Spalten von unten
nach oben ohne Ueberdeckung - kein Flimmern. Je Stadtteil und
Kantennutzung ein Programm:

| Programm | Aufbau |
|---|---|
| Buero (Zentrum, Geschaeft) | Pfeiler im Takt der Bucht, Sockelstein, Glasfelder mit Bueros, in der Mitte das Portal: Lobby hinter Glas, Tuer in tiefer Granitnische, Blende |
| Flagship (Zentrum, Ladenkante) | breite Pfeiler, hohe Schaufenster, Metallrahmen in Bronze/Graphit |
| Laden (Geschaeft, Laden-Kanten) | je Laden ein Rahmen in eigener gedeckter Farbe (Graphit, Tannengruen, Ochsenblut, Marine, Bronze, Elfenbein), Sockelbrett, Schaufenster mit Sprosse, Tuer in der Nische, Oberlicht, Blende |
| Gemischt (Mischung) | kleiner Laden, Hauseingang, Fenster mit Buero oder Wohnung - im Wechsel |
| Wohnen (Wohn, Ufer, Mischung) | Sockel (Klinker/Kalk), Putz, Fensterachsen mit Sims und Sturz, Hauseingang in der Nische mit Nummer und Leuchte, Gurtgesims oben |
| Cafe (Ufer) | weite Glasfelder (6 m), helle Rahmen, Cafe-Raeume |

Auf den Downtown-Modellen (dunkle Glas- und Betonfassaden) laufen Putz-
und Kalkprogramme in gedeckten Toenen (gleiches Material, 62 %
Helligkeit) - heller Putz stand dort wie ein vorgestellter Kasten.

**4. Einsaetze in die Oeffnungen der Modelle (`biEinsaetze`).** Die
Tiefenkarte der Kletterhaut (`FASS_GITTER`) kennt die Rueckwaende hinter
Arkade, Saeulen, Halle und Pfeilern. Je Hausseite werden im Erdgeschoss
(bis 5,5 m) Rechtecke gleicher Tiefe gesucht (Spanne 12 cm fuer
Sprossen, mindestens 8 cm hinter der vordersten Ebene, ab Boden;
mindestens 1,0 m breit, zwischen hohen Saeulen 0,5 m; tiefe Hallenwaende
ab 1,8 m Hoehe). In jedes kommt ein Einsatz: Schaufenster, Lobby, Buero,
Cafe oder Wohnung mit Raum dahinter, je nach Stadtteil und Kante, ab
2,8 m Breite mit Tuer in dunkler Laibung; in schmalen Schlitzen ein Flur
(kein Vorhang, der als heller Streifen leuchten wuerde). Rahmen gedeckt
(Graphit, Bronze, Warmgrau). Die exakte Probe gegen die Dreiecke des
Modells entscheidet: liegt etwas bis 15 cm davor (Sprosse, Rahmen), rueckt
der Einsatz vor es; ragen Saeulen weiter vor, wird er an ihnen geteilt.
Faellt ein Sockel in der Probe durch, bekommen die Oeffnungen, die fuer
ihn ausgespart waren, doch noch ihre Einsaetze. Die Pfeiler der Modelle
bleiben, wie sie sind; der Einsatz liegt flach auf der Rueckwand.

**5. Boden, Nummer, Wahrzeichen.** Belag je Stadtteil wie in der ersten
Fassung (Farbe und Plattenmass im vorhandenen Gehweg-Mesh), Geschaeft und
Wohnen etwas gedeckter. Hausnummern laengs der Kante steigend rechts
neben der Tuer, darueber die Leuchte. Die Namen der Wahrzeichen (0,34 m,
unverzerrt 2,55 m breit) nehmen die freie Stelle des Lobbybands, die der
Mitte am naechsten liegt, und weichen Leuchtschildern aus.

### Die Stadtteile

| Stadtteil | Material und Rhythmus | Fenster und Eingang | Licht |
|---|---|---|---|
| ZENTRUM | Granit dunkel, Bronze, Pfeiler 0,4 m, Bucht 3,1 m; Tuerme mit Steinsockel | Bueros mit Jalousie, Portal mit Lobby in der Mitte, tiefe Granitnische; Flagship-Schaufenster an Ladenkanten; Vorplaetze, Namen der Wahrzeichen | kuehl |
| GESCHAEFT | Travertin, Metallrahmen, Bucht 3,0 m, hohe Blende | dichte Ladenzeilen, je Laden eigene Rahmenfarbe, Schaufenster mit Ware und Puppen, Oberlicht | warm |
| MISCHUNG | Beton, Putz, schmale Pfeiler, Bucht 2,6 m | Laden, Hauseingang, Buero oder Wohnung im Wechsel - Alltag, keine Ladenstrasse | neutral |
| WOHN | Klinkersockel, Putz in sechs Toenen, weisse Rahmen, Gurtgesims | Wohnfenster mit Sims, Sturz und Vorhang; Hauseingaenge mit Nummer und Leuchte; Ecklaeden an der Avenue | warm, gelblich |
| UFER | Kalkstein, helle Rahmen, weite Bucht 4,0 m | Wohnfenster, Cafes mit weiten Glasfeldern | hell, warm |
| PARK | - | nichts Neues | - |

### Wie es gebaut ist

- **Ein Zeichenaufruf** fuer alle Erdgeschosse, Einsaetze, Nummern,
  Wahrzeichen und Vorplaetze: eine Geometrie, ein Lambert-Material mit
  `innenraumPatch`, der kleine Atlas. Die Flaechen (Granit, Kalk,
  Travertin, Metall, Putz, Klinker, Holz, Beton, Lack) entstehen im Shader
  aus Weltlage und Farbe (`BI_GLSL_FLAECHE`), mit der Pixelgroesse weich -
  in der Ferne die Mittelfarbe, kein Flimmern. Die Tuerme brauchen keinen
  Aufruf mehr als vorher (das Glas war schon ein Mesh).
- **Flach und exakt.** Sockel nur auf ebener Flaeche (Tiefenkarte, dann
  exakte Probe gegen die Dreiecke des Modells: alle Zellen belegt, Spanne
  hoechstens 2,5 cm, nichts mehr als 1 cm davor). Einsatz auf der
  Rueckwand der Oeffnung (siehe 4). Derselbe Tiefenversatz wie die
  Leuchtschilder (`NEON_VERSATZ`).
- **Kein Hindernis.** Nichts Neues hat eine Kollision; Klettern, Kamera,
  Top-out und Neon-Overlay sehen keine neue Flaeche. Die Raeume sind
  Shader, keine Geometrie.
- **Kein Stadtzufall.** Jede Entscheidung aus `biHash` (Weltkeim, Ort,
  Art), die Hashes im Shader ganzzahlig je Scheibe; gebaut in einem
  eigenen Strom, der Stadtstrom wird danach zurueckgesetzt. Die Tuerme
  bekommen ihren Keim aus der Lage (`createTower(..., seed)`), dieselbe
  Zahl THREE-Objekte wie vorher.
- **Leuchtschilder bleiben.** Sockel kuerzen sich oder gehen unter das
  Schild; ein Einsatz darf hinter einem Schild liegen, das mindestens
  6 cm vor ihm endet (Schild vor zurueckliegendem Schaufenster).
- Pruefschalter `__WEBHERO_OHNE_8A`: Erdgeschosse und Belag wie vor 8A.

### Korrekturrunden der Neufassung (je mit Befund)

1. *Fenster grau, Nischen mit weissen Saeulen* auf dem Erdgeschoss-
   Material: Lambert bekommt das Uniform `cameraPosition` nicht - die
   Blickrichtung war falsch. Befund ueber eine Testfarbe der Strahl-
   richtung; jetzt aus `viewMatrix`.
2. *Pixelrauschen in den Scheiben:* der Hash je Scheibe wurde ueber das
   Dreieck interpoliert (Abweichung 1e-4), `sin` machte daraus je Pixel
   einen anderen Raum. Keime ganzzahlig, im Shader gerundet.
3. *Grundriss-Test rot:* Sockel und Portal des Turms ragten 6 mm aus der
   Kiste. Sockel buendig, Portal 4 mm zurueck.
4. *Einsaetze fehlten* an Residential_3 (Sprossen: 12 cm Spanne), Brutal_1
   (Hallenwand: 1,8 m Hoehe), PublicBuilding_1 (Felder 0,7 m: Mindestbreite
   0,5 m bei hohen Feldern, halbe Zelle Rand) und ModernOffice_1 (Arkade:
   vorruecken und teilen nach der exakten Probe).
5. *ModernOffice_1, Arkade weiter schwarz:* der Sockel derselben Seite
   sparte die Oeffnung aus und fiel danach in der exakten Probe durch -
   beides weg. Jetzt nachgeholt (8 Seiten).
6. *Oberlichter, Ladenraeume, Putz auf Downtown:* helle Bloecke ueber den
   Tueren -> dunkles Glas; Ladenwaende weiss -> je Laden drei Toene; heller
   Putz auf dunklen Modellen -> 62 %; Elfenbein-Rahmen in Modelloeffnungen
   -> nur gedeckte Rahmen; Buerojalousien bis 95 % geschlossen und hell
   -> hoechstens 60 % und gedeckt; Laeden nachts flach hell -> 0,45 und
   hinten dunkler; Oberlichter nachts als Leuchtkaesten -> gedaempfter
   Schein.
7. *Wahrzeichen fehlten (3 x keineSeite):* gesucht wurde bei 3,0 bis
   3,6 m, das Lobbyband liegt bei 3,9 bis 4,5 m. Danach 23 harte Fehler im
   Pruefstand (Schrift ueber einem Leuchtschild, ohne Tiefe) -> Schrift
   weicht aus, traegt ihre Tiefe; 0 Fehler.

Nicht gebaut: Markisen und Nasenschilder (stehen vor der Fassade - die
Figur klettert hindurch), Bezirksfarbe an Modellfassaden (Modellmaterialien
je Bezirk kopieren), freistehende Moebel mit Hindernis.

### Was steht (Keim 4711, `district-identity.js`)

| Stadtteil | Sockel | Einsaetze | Nummern | Wahrzeichen | Vorplaetze | Scheiben | Eingaenge | Laeden | Frontmeter |
|---|---|---|---|---|---|---|---|---|---|
| ZENTRUM | 16 | 90 | 0 | 3 | 39 | 128 | 33 | 16 | 320 |
| GESCHAEFT | 12 | 149 | 0 | 0 | 0 | 175 | 26 | 169 | 336 |
| MISCHUNG | 127 | 555 | 39 | 0 | 0 | 788 | 204 | 507 | 1890 |
| WOHN | 164 | 232 | 134 | 0 | 0 | 568 | 196 | 109 | 1859 |
| UFER | 41 | 231 | 37 | 0 | 0 | 264 | 51 | 40 | 712 |
| PARK | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Sockelprogramme: Zentrum Buero 12 / Flagship 4; Geschaeft Laden 10 /
Buero 2; Mischung gemischt 89 / Laden 30 / Wohnen 8; Wohnen Wohnzeile
114 / Ecklaeden 50; Ufer Wohnen 38 / Cafe 3. Flaeche im Mesh:
10 306 m2 Material, 8 609 m2 Scheibe mit Raum, 310 m2 Oberlicht,
1 381 m2 Tuernische. 78 416 Dreiecke. Die Tuerme (im Zentrum 39) sind
nicht mitgezaehlt - ihre Scheiben gehoeren zu `createTower`.

Verworfen (Bedingung nicht erfuellt): Sockel 423 x keine ebene Front am
Modell (die Einsaetze uebernehmen dort, wo Oeffnungen sind), 3 x
Leuchtschild, 8 x in der exakten Probe uneben; Einsatz 2 x zu klein;
232 Einsaetze wurden nach der exakten Probe vorgerueckt oder geteilt und
neu gesetzt (gezaehlt als `exakt:davor:einsatz:ersetzt`), keiner ging
dabei verloren.

### Pruefstand (`tools/pruef/district-identity.js`)

Bestand je Stadtteil wie in der ersten Fassung, dazu die neuen
Erdgeschosse mit ihren harten Fehlern (Soll 0, gemessen 0): ausserhalb
der Hausfront, ueber einem Leuchtschild, im Nachbarhaus, im Park,
mehrfacher Sockel oder Ueberlappung je Front, schwebend oder steckend
(je Flaeche sieben Strahlen von 1 m davor auf die gezeichnete Geometrie
des eigenen Hauses: 11 550 Strahlen; Sockel bis Flaeche 0,010 bis
0,019 m, Nummer 0,014 bis 0,023 m, Wahrzeichen 0,015 m, Einsatz 0,005 bis
0,184 m - beim Einsatz darf die Oeffnung dahinter tiefer sein, aber
nichts davor liegen), keine Flaeche dahinter; Vorplatz nicht auf dem
Gehweg, auf einem Ueberweg oder ueber einem Schacht. Neue Hindernisse 0.
Kleinste Schrift: Hausnummer 0,19 m, Wahrzeichen 0,34 m.
Welt-Fingerabdruck gegen 82607ec: 26 von 26 gleich.

### Leistung und Ladezeit

`stadt-leistung.js` (Keim 4711, 300 Aufnahmen, Median / Maximum der
Zeichenaufrufe); drei Laeufe der Neufassung Zeile fuer Zeile gleich:

| | Strasse | Dach | Luft | gesamt | Dreiecke (Median gesamt) |
|---|---|---|---|---|---|
| 82607ec | 753,5 / 2597 | 768 / 2593 | 859,5 / 1874 | 794 | 3 401 482 |
| 8A erste Fassung (9915ef5) | 754,5 / 2598 | 769 / 2594 | 860,5 / 1875 | 795 | 3 406 290 |
| 8A Neufassung | 746 / 2596 | 757,5 / 2589 | 861 / 1878 | 792 | 3 470 894 |

Grenze < 899 gehalten, Zeichenaufrufe gleich oder weniger (im Median 3
weniger als die erste Fassung, nicht weiter aufgeschluesselt). Dreiecke
+1,9 % (Erdgeschosse 78 416 statt 4 808 Dreiecke, Lobbymoebel). Szene:
Objekte 20 142, Meshes 8282, Materialien 2347, Texturen 324 - wie die
erste Fassung; Programme 38 -> 39. Ein vierter Lauf, waehrend eine Probe
parallel lief, fand die Szene noch nicht vollstaendig (20 131 Objekte) und
zaehlt nicht.

**Bauzeit** der Erdgeschosse (einmal, im Rueckruf der Hausmodelle):
0,59 bis 0,67 s auf ruhiger Maschine (erste Fassung 0,17 bis 0,23 s).
Je Schritt: Rechtecksuche in den Oeffnungen 0,15 s, exakte Probe
0,19 s, Sockel 0,07 s, Einsatzgeometrie 0,06 s, Anhaengen 0,09 s, Mesh
0,04 s (`bezirksIdentitaet().zeiten`, vom Pruefstand mit ausgegeben).
Zuerst waren es rund 0,75 s; drei Aenderungen ohne Einfluss auf das
Ergebnis - die exakte Probe laeuft nur noch ueber die Dreiecke in der
Hoehe der Ziele (je Geometrie einmal nach Hoehe geordnet), die
Rechtecksuche ueberspringt Schichten mit zu wenigen Zellen und bricht ab,
sobald ein Feld zu niedrig wird, das Anhaengen geht stueckweise. Geprueft
bitgleich: Pruefsumme ueber alle sieben Attribute des Meshes und die
ganze Liste vor und nach jeder Aenderung.

`ladezeit.js`, je drei Laeufe abwechselnd auf ruhiger Maschine (Median):

| Sekunden ab Navigation | T1 letzte Datei | T2 Stadt steht | T5 erstes volles Bild | T6 Szene ruhig |
|---|---|---|---|---|
| 8A erste Fassung (9915ef5) | 14,8 | 15,8 | 21,1 | 33,2 |
| 8A Neufassung | 15,2 | 16,6 | 21,4 | 32,1 |
| Versuch: Neufassung ohne Turm-Innenraum | 15,2 | 16,6 | 21,4 | 32,7 |

T6 unveraendert (Einzellaeufe neu 31,5 bis 33,9 s, 9915ef5 32,5 bis
34,0 s); T1 -> T2 im Mittel 0,4 s laenger - die Bauzeit. Der Versuch
ohne Innenraum-Shader an den Tuermen zeigt: die Raeume im Glas kosten
keine messbare Ladezeit. Eine erste Messung (je zwei Laeufe, direkt nach
dem Parallelbetrieb aller Pruefstaende) hatte T6 um 2 bis 5 s hoeher
gezeigt - auf ruhiger Maschine und abwechselnd wiederholt nicht mehr.

### Determinismus

`district-identity.js vergleich=<82607ec>`: 26 von 26 Werten gleich -
Bezirke, Haeuser und Lots, Modelle und Fassadentexturen, die Menge der
Hindernisse, POIs, Strassendetails, Aufenthaltsanker, Laternen,
Gehnetz, Leuchtschilder, Missionen; nach dem Laden und nach 20 s
Spielzeit Parkautos, fahrende Wagen, Passanten samt Look und Anker,
Gegner. Die Reihenfolge der Hindernisse (`kolliderFolge`) war in diesen
Laeufen gleich; sie haengt weiter am Laden (siehe erste Fassung).

### Regression

Gegen die erste Fassung (9915ef5), Keim 4711:

- `node --test` 170/170. `test-realism-polish.cjs`: Kommentar
  angepasst und zwei Zusicherungen dazu - die Scheiben tragen den
  Innenraum-Shader, die Lobby ist klares Glas (Modus 3), die Bueros Raeume
  (Modus 1); die echte Tiefe hinter der Scheibe bleibt gesichert.
- `stadtraster.js`, `parkautos.js`: Zeile fuer Zeile gleich.
- Problem-2: Naht 221 / 221 / 221, Aussenecke 150 / 150 (die bekannten
  42 Faelle); Innenklettern isoliert 108 Laeufe, 0 angeklebt, 0
  ungueltig; MO1 (`kletterproxy.js`) Brust / Becken / Koerper / Loch 0,
  playerCutsFacade 0; `kletterstetigkeit.js`; FlatFacade-Top-out 13 / 13,
  Kontrolle 8 / 8, postTopOutUnexpectedDisplacement 0,000 m; Brutal-Halle
  gehen 30 / 30, rennen 30 / 30, invisibleCollision 0; Neon-Bahnen (27):
  Brust / Becken / Knie hinter 0, Schnitt 0 - alles Zeile fuer Zeile gleich
  (bis auf Messdauern).
- Innenklettern im Weltlauf (Echtzeit, Ereignisse und Gefahren aktiv):
  unter Volllast 5 ungueltige Faelle ("Treffer im Lauf"); auf ruhiger
  Maschine wiederholt: Neufassung 2 und 0, 9915ef5 2 und 2 - Streuung des
  Echtzeitlaufs. Harte Befunde in keinem Lauf.
- `street-details.js`, `street-life.js`, `street-life-activities.js`:
  Zeile fuer Zeile gleich (bis auf Messdauern).
- `npc-wege.js`: A 2 / B 0 / C 0 / D 87 / E 83 (erste Fassung A 0 / B 1 /
  C 0 / D 79 / E 84, 82607ec A 2 / B 1 / C 1 / D 85 / E 75). Die zwei
  A-Faelle sind fliehende Passanten im Haus - die bekannte Fehlerart;
  8A aendert kein Hindernis.
- `kernsysteme.js`: Zeile fuer Zeile wie 9915ef5 in derselben Stunde
  (Story Akt 1: 8 Missionen, 8 sauber beendet; Seitenfehler 0, npc- und
  enemyStaticPenetration 0, playerNpcOverlap 7).
- `freigang.js`: 572 gestreift, 0 gesperrt, kleinste Gehbreite 1,60 m -
  wie 9915ef5; der Spielzaehler "auf Fahrbahn" 4 (9915ef5 in derselben
  Stunde 3, fruehere Laeufe beider Staende 4).
- `district-identity.js`: harte Fehler 0, Fingerabdruck 26 / 26, neue
  Hindernisse 0.

### Grenzen

- Die Modellfassaden oberhalb des Erdgeschosses bleiben Fototextur;
  Innenraeume gibt es dort nicht (nur Tuerme und Erdgeschosse).
- Ein Teil der Oeffnungen hat keine zur Front parallele Rueckwand
  (schraege Halle am PublicBuilding_1, Saeulenfuesse, Treppen) - dort
  bleibt es dunkel.
- Die Leuchtschilder bleiben, wie sie sind - auch im Wohngebiet.
- Die Raeume sind Shader: aus sehr spitzem Winkel und bei sehr breiten
  Scheiben wiederholen sie sich erkennbar; die Moebel sind Karten.
- Nicht 8A und weiter offen: fliehende Passanten laufen durch den Helden,
  Fliehende kurz unter der Bodenflaeche an der Brueckenroute, der weisse
  Promenadenbelag in einem Teil der Bilder, das Bushaeuschen.

---

## 6r. Durchgestaltete Baukoerper, mehr Verkehr, Parkstreifen (Stufe 8B)

Drei Auftraege nach der Abnahme von 8A: (A) "Das untere Teil ist gut.
Der Rest vom Gebaeude soll dann auch so aussehen" - ein Gebaeude, eine
architektonische Familie; (B) sichtbar mehr fahrende Wagen, nach
Strassenklasse und Bezirk verteilt; (C) eine glaubwuerdige Parklogik mit
erkennbaren Stellplaetzen. Bilder: `docs/abnahme-8b/`.

### A. Ein Gebaeude, eine Familie

**Der Problemfall.** Ueber den neuen Erdgeschossen (Putz, Klinkersockel,
Wohnfenster, Haustuer) lief bei den prozeduralen Haeusern weiter die alte
Rastertextur: Achsen von rund 1 m und "Geschosse" von 0,75 m - ein
Buerogitter ueber einem Wohnhaus, an den Seiten ebenso. Bei den Modellen
umgekehrt: unter Ziegelhaeusern (Brownstone) stand ein Wohnputz-Sockel,
unter Buero- und Betonbauten Wohnfenster mit Hausnummer.

**Prozedurale Haeuser (212).** Jedes bekommt beim Bau eine Familie aus
seinem Bezirk und eine Putzfarbe aus einem eigenen Hash (Weltkeim,
Hausnummer - kein Zug aus dem Stadtzufall):

| Familie | Bezirk | Haeuser | Achse | Erdgeschoss | Geschoss | Fenster | Rahmen / Sims / Sockel |
|---|---|---|---|---|---|---|---|
| Wohnhaus | Wohnen | 114 | 2,3 m | 3,9 m | ~3,0 m | 1,25 x 1,5 m, Sprosse | weiss / Kalk / Klinker |
| Stadthaus | Mischung | 81 | 2,6 m | 4,2 m | ~3,2 m | 1,4 x 1,7 m, ohne Sturz | dunkel / Beton / Beton |
| Uferhaus | Ufer | 17 | 2,8 m | 4,0 m | ~3,1 m | Fenstertuer 1,15 x 2,15 m, Bruestungsstab | hell / hell / Kalk |

Die Fassade zeichnet der Shader der vorhandenen Wandmaterialien
(`HF_GLSL_KOPF`, ueber `CITY_LOOK.innenraumPatch`): Sockelband, das
Erdgeschoss bis zur Familienhoehe, darueber gleich hohe Obergeschosse bis
zur Attika (1,75 m glatter Putz unter der Krone, Gesims mit
Schattenfuge), ein Gurtgesims ueber dem Erdgeschoss. Die Fenster stehen
auf denselben Achsen wie Fenster und Tuer im Erdgeschoss (`hfAchsen`,
Achszahl = Frontbreite / Achsbreite gerundet), mit Sims und Sturz, Rahmen
7 cm und Raum dahinter (Interior Mapping wie die Erdgeschosse, nachts
einzelne Fenster hell). Alle vier Wandseiten tragen die Fassade - auch
die sichtbaren Seiten. Die Krone (`schmueckeHaus`) uebernimmt Sims- und
Putzton. Keine neue Geometrie, kein neuer Zeichenaufruf.

Das Erdgeschoss (`biSockelFamilie`) nimmt Farbe, Hoehe und Achsen der
Familie: die Wohnzeile setzt Fenster und Haustuer auf die Achsen
(`biWohnzeileAchsen`), Laeden fuellen Buchten zu zwei Achsen, deren
Pfeiler auf den Achsgrenzen stehen (`biLadenzeile` mit `grenzen`).
Erdgeschoss-Programme danach: Wohnhaus wohnen 103 / laden 45, Stadthaus
gemischt 52 / laden 21 / wohnen 5, Uferhaus wohnen 16 / cafe 1.

**Modellhaeuser.** Die Obergeschosse der Modelle lassen sich nicht
umbauen - also folgt ihnen das Erdgeschoss (`BI_MODELL_FAMILIE`, im
Wohn-, Misch- und Ufergebiet): unter Ziegelhaeusern (alle Brownstone,
Residential_3; 65 Haeuser) Ziegel in der mittleren Fassadenfarbe des
Modells mit Granitsockel und hellem Werkstein, Laeden mit
Ziegelpfeilern; unter Glas-, Platten- und Betonbauten (ModernOffice,
Brutal, PublicBuilding; 140 Haeuser) Buero- oder Ladenfronten in deren
Toenen statt Wohnputz mit Hausnummer. Zentrum und Geschaeftsviertel
behalten ihre Buero- und Ladenfronten aus 8A.

**Wie aehnliche Faelle gefunden wurden:** nicht von Hand. Jedes
prozedurale Haus im Wohn-, Misch- und Ufergebiet ist eine Familie (212
von 212); jedes Modell wird ueber seinen Namen einer Modellfamilie
zugeordnet (205 Modelle in diesen drei Bezirken, 18 ohne Familie - andere
Modelltypen, unveraendert). Zentrum, Geschaeftsviertel, Tuerme und Park
sind nicht angefasst.

Bilder (gleiche Kamera, Stand aa04428 gegen jetzt): `8b-fassaden-*.jpg`,
erzeugt mit `tools/pruef/fassaden-familien.js` (Hausauswahl einmal
festgehalten, dann in beiden Staenden gerendert).

`district-identity.js`: harte Fehler 0, neue Hindernisse 0; die
Erdgeschosse je Stadtteil bleiben in Zahl und Frontmetern wie in 8A
(Wohnen 164 Sockel, Mischung 127, Ufer 41); Scheiben im Mischgebiet 788 ->
846, Ufer 264 -> 334 (die neuen Programme der Familien und Modelle).

### B. Mehr Verkehr

**Vorher** (aa04428, `verkehr-dichte.js`, 3 x 300 s, Tageszeit 0,33):

| Groesse | vorher (45 Wagen) | nachher (80 Wagen) |
|---|---|---|
| gleichzeitig unterwegs (Tageszeit 0,33) | 45 | 80 |
| sichtbar in 100 m / 150 m | 2 / 7 | 7 / 15 |
| Boulevard / Avenue / Strasse / Nebenstrasse | 5,1 / 10,4 / 32,6 / 53,4 % | 15,0 / 24,5 / 44,3 / 17,9 % |
| Dichte Zentrum / Geschaeft | 0,56 / 0,85 | 1,22 / 1,11 |
| Dichte Mischung / Wohnen | 0,95 / 1,34 | 0,96 / 0,86 |
| Dichte Ufer / Park | 1,67 / 0,18 | 0,97 / 0,75 |
| Brueckendurchfahrten je Minute | 1,6 | 3,0 |
| harte Fehler (neben Fahrbahn, Wasser, Ortssprung, Geisterfahrer) | 0 | 0 |
| langes Stehen (Proben ueber 12 s) / laengstes Stehen | 903 / 61,8 s | 722 / 61 s |
| ineinander < 2,5 m: gesamt / gleiche Spur / kreuzend | 15 / 15 / 0 | 45 / 14 / 29 |

Dichte = Anteil der Wagenproben geteilt durch Anteil der Strassenlaenge
(1 = Mittel), Bruecke und Ostufer ausgenommen. Die Strassenlaenge im
Raster: 12,05 km (Nebenstrasse 1,55, Strasse 7,35, Avenue 2,1, Boulevard
1,05), 30,4 km Fahrspur. "Kreuzend" sind Wagen, die sich auf einer
Kreuzung kurz naeher als 2,5 m kommen - laengstes Paar 1 s (zwei Laeufe
mit einer Paar-Probe: 30 / 40 Proben je 300 s; vorher 7 / 43 Proben,
laengstes Paar 5 s).

Zwei Aenderungen:

1. **Zusatzverkehr** (`spawnZusatzVerkehr`): 35 Wagen mehr im Umlauf (45
   -> 80; am Tag 78 Prozent unterwegs: 35 -> 62). Start nach
   Strassenklasse (wie bisher) und Bezirk (`VERKEHR_BEZIRK`), kein Start
   naeher als 15 m an einem anderen Wagen derselben Spur. Eigener
   Zufallsstrom, als Letztes im Aufbau - direkt nach den 45 Wagen der Welt
   hatte der Wagen-Cache die spaeteren Parkautos veraendert (gemessen).
2. **Kreuzungswahl** (`kreuzungsWahl`): geradeaus, links, rechts gewichtet
   nach Klasse der Zielstrasse mal Bezirk des naechsten halben Blocks;
   Stuecke, die in eine Randstrasse muenden, mal `VERKEHR_RAND` 0,4;
   Querstrassen, die am Rand gleich enden, nie (ausser der Bruecke).
   Vorher bog ein Wagen nach der eigenen Klasse ab und dann zu gleichen
   Teilen links oder rechts - die Randstrassen (13 Prozent der
   Strassenlaenge) sammelten so die Haelfte aller Wagen. Fluchtauto und
   Einsatzwagen fahren wie vorher.

Die Bezirksgewichte sind in vier Kandidaten gemessen (je 3 x 300 s):

| Kandidat | Zentrum | Geschaeft | Mischung | Wohnen | Ufer | Park |
|---|---|---|---|---|---|---|
| Gewichte 1 / 0,95 / 0,75 / 0,4 / 0,6 / 0,5 | 1,07 | 1,02 | 0,93 | 0,99 | (Bruecke mitgezaehlt) | 0,61 |
| Wohnen 0,25, Mischung 0,7, Ufer 0,5 | 1,12 | 1,01 | 1,02 | 0,95 | 1,04 | 0,67 |
| dazu Randdaempfung 0,4 | 1,07 | 1,01 | 1,09 | 0,85 | 0,74 | 0,89 |
| **dazu Mischung 0,55** | **1,36** | **1,25** | **0,94** | **0,73** | **0,94** | **0,60** |

**Zwei alte Fehler, die der dichtere Verkehr sichtbar machte** (beide
mit Probe gefunden, beide im Stand vor 8B schon da):

1. Die Hinderniserkennung der Wagen nahm jede Person unter 2,2 m Hoehe -
   auch die Fahrgaeste auf dem U-Bahnsteig 9 m unter dem Boulevard. Ein
   Wagen hielt dort dauerhaft, die Spur dahinter staute sich (in allen
   drei Keimen derselbe Wagen, 4 m vor dem Bahnsteig). Jetzt zaehlt nur,
   wer zwischen -1,5 und 2,2 m steht.
2. Beim Abbiegen wurde die Zielspur nicht geprueft: ein Pkw landete mitten
   in einem Lkw, der dort fuhr, und weil die Vordermann-Regel einen um
   mehr als 3 m ueberlappenden Wagen fuer "hinten" hielt, fuhren beide 30 s
   ineinander weiter. Jetzt geht es geradeaus, wenn die Stelle belegt ist,
   und der hintere von zwei ueberlappenden Wagen haelt, bis sie getrennt
   sind. Gemessen mit 80
   Wagen (Keim 4711, 300 s): Paar-Proben unter 2,5 m 168 -> 29, laengstes
   Paar 16,5 s (in einem zweiten Lauf 32 s) -> 0,75 s.

**Was man sieht** (`tools/pruef/verkehr-bilder.js`, nach 90 s, 60 Proben je
Ansicht, nur Wagen im Bildkegel bis 150 m und nicht hinter einem Haus;
Mittel, in Klammern Proben ohne einen einzigen Wagen):

| Ansicht | vorher | nachher |
|---|---|---|
| Boulevard z = 25, Mittelstreifen | 0,65 (30) | 4,30 (0) |
| Boulevard aus 14 m | 0,43 (34) | 3,23 (0) |
| Avenue x = 25 aus 14 m | 0,87 (30) | 2,38 (2) |
| Zentrum, Strasse x = -25 | 0,40 (40) | 2,13 (3) |
| Geschaeftsviertel, Boulevard x = -125 | 0,72 (27) | 1,55 (10) |
| Wohnstrasse z = 125 | 0,05 (57) | 0,05 (57) |

Die Wohnstrasse bleibt ruhig, die Hauptachsen und das Zentrum sind es
nicht mehr. Lange Stehzeiten (eine Standzeit-Probe mit dem Ablauf von
verkehr-dichte.js, drei Keime je 300 s, Faelle
ueber 20 / 40 / 80 s): vorher 6 / 3 / 1, nachher 9 / 2 / 0 - Ampeln,
Querverkehr an der Uferstrasse und Unfall-Vorfaelle (der Wagen haelt
absichtlich), kein Stau aus Dichte.

### C. Parkstreifen und Stellplaetze

Vorher: 300 geparkte Wagen "irgendwo am Bordstein", ohne Markierung;
gleichverteilte Wahl der Bauart (an der Sammelstrasse Pkw oder Taxi, an
der Nebenstrasse dazu Polizei) - 121 Pkw, 152 Taxis, 27 Streifenwagen.

- **Stellplaetze:** jede Neben- und Sammelstrasse (LOCAL, STREET) hat
  Parkstreifen im Raster von 7,6 m, 13 m Abstand zur Kreuzung, nicht auf
  Ueberwegen. 962 Plaetze, auf die ein Wagen von 4,6 x 2,0 m passt.
  Markierung dezent hellgrau (`PARK_STRICH`): kurze Querstriche an den
  Platzgrenzen (2,2 m vom Bordstein) und eine Laengslinie zur Fahrspur,
  ein Mesh fuer die ganze Stadt. Avenue und Boulevard haben neben den
  Spuren keinen Platz - dort wird nicht geparkt (wie bisher).
- **Belegung nach Bezirk der Strassenseite** (`PARK_BELEGUNG`, STREET mal
  0,85): Wohnen 72 %, Mischung 55 %, Geschaeft 42 % (Kurzparken), Ufer
  35 %, Zentrum 22 % (geordnet, wenig Strassenparken), am Park 12 %.
  Ergebnis: belegt (mit den 300 alten Wagen, die bleiben) Wohnen 170 von 221
  Plaetzen, Mischung 217 von 339, Geschaeft 38 von 71, Ufer 62 von 118,
  Zentrum 81 von 190, am Park 7 von 23.
- **Bauart nach Bezirk** (`PARK_MIX`): fast nur Pkw, Taxis eher im Zentrum
  und Geschaeftsviertel, ein Streifenwagen die Ausnahme. Gezaehlt: 532
  Pkw, 42 Taxis, 1 Streifenwagen. Die
  300 alten Wagen bleiben auf ihren Plaetzen; ihre Bauart wird nur
  getauscht, wenn die neue nicht groesser ist - Hindernis und Lage bleiben.
- **Neue Wagen:** 275 im eigenen Zufallsstrom (575 geparkt). Jeder hat
  wie die alten einen Kollisionskasten (`parkAuto`), geprueft wie die
  alten (`parkPlatzTauglich`: Fahrbahn, Bordstein, Moebel, Hydrant,
  Ueberweg, Einfahrt).
- **Parkplatz oder Garage:** nicht gebaut. Die Bloecke sind bis zur
  Bauflucht geschlossen bebaut; fuer einen Parkplatz haette ein Haus
  weichen muessen - ein Umbau der Stadt, den der Auftrag ausschliesst.

**Wie gezeichnet wird:** jeder geparkte Wagen waren rund zehn Zeichenaufrufe. Jetzt
wird jedes Bauteil je Kachel von 80 m instanziert; die weisse Karosserie
bekommt den Lack als Instanzfarbe. Zwei Fallen dabei: three r128 baut das
Programm eines Materials nicht neu, wenn ein Teil mit Instanzfarbe und
eines ohne es teilen (Absturz beim ersten Bild - jetzt eigene
Materialkopien); und es schaltet das Wegschneiden fuer `InstancedMesh` ab
Werk aus (jede sichtbare Kachel wurde in jedem Bild gezeichnet - jetzt mit
eigener Huellkugel je Kachel an).

### Leistung, Simulation, Ladezeit

`stadt-leistung.js` (Keim 4711, 300 Aufnahmen, Median / Maximum der
Zeichenaufrufe; zwei Laeufe 8B Zeile fuer Zeile gleich, Referenz in
derselben Stunde):

| | Strasse | Dach | Luft | gesamt | Dreiecke (Median) |
|---|---|---|---|---|---|
| aa04428 | 751,5 / 2601 | 761 / 2608 | 866,5 / 1895 | 799 | 3 461 836 |
| 8B | 795,5 / 2414 | 792,5 / 2428 | 897 / 1651 | 865,5 | 3 713 374 |

Tor < 899 gehalten (+8,3 %), Dreiecke +7,3 %, die Spitzen sind kleiner.
Szene: Objekte 20 111 -> 16 194, Meshes 8264 -> 5692, Materialien 2330 ->
1017 (die 300 Wagengruppen sind Instanzen geworden), Programme 39 -> 43.

Wer kostet was - gepaart, dieselbe Szene mit und ohne (Median):

| | Parkautos | fahrende Wagen |
|---|---|---|
| 300 Stellen von stadt-leistung, aa04428 (300 / 45) | 156,5 | 97 |
| 300 Stellen, 8B (575 / 80) | 106,5 | 224 |
| 36 Blicke auf Strassenhoehe, aa04428 | 258 | 138,5 |
| 36 Blicke auf Strassenhoehe, 8B | 111 | 191,5 |

Die Fassaden kosten keinen Zeichenaufruf (gleiche Meshes, anderer
Shader).

**Simulation** (ein Schritt ohne Zeichnen, 3 x 1800 Schritte nach Vorlauf,
Median aus je sechs Bloecken): aa04428 5,4 ms, 8B 6,7 ms; 8B ohne
Zusatzverkehr 5,1 ms, 8B ohne Parkstreifen 6,7 ms. Die Parkstreifen kosten
also nichts, die 35 Wagen rund 1,6 ms, die neue Abbiegewahl mit den
beiden Fehlerbehebungen nichts Messbares. Laut Profil steckt der
Mehraufwand vor allem in der Pose der echten Fahrer (`zieleKnochen`,
`gliedZiel`, `poseSitzen`): mit dichterem Verkehr sind die hoechstens acht
Fahrerplaetze (`AUTO_FAHRER_MAX`) oefter belegt. `updateCars` selbst: 0,11
-> 0,23 ms.

**Ladezeit** (`ladezeit.js`, Sekunden ab Navigation, Median aus vier
abwechselnden Laeufen, fuer die Zwischenstaende drei):

| | T1 letzte Datei | T2 Stadt steht | T5 erstes volles Bild | T6 Szene ruhig | Programme |
|---|---|---|---|---|---|
| aa04428 | 15,3 | 16,6 | 21,5 | 33,2 | 39 |
| nur Fassaden (Schalter) | 15,6 | 17,1 | 21,9 | 33,8 | 40 |
| Fassaden und Parkstreifen | 16,8 | 18,3 | 23,7 | 36,6 | 43 |
| 8B | 16,3 | 17,7 | 23,1 | 36,8 | 43 |

T6 +3,6 s, davon die Parkstreifen rund 2,8 s: die drei Shaderprogramme
der instanzierten Wagen (Instanzen mit und ohne Instanzfarbe, Sitze), die
SwiftShader beim ersten Bild mit Parkautos uebersetzt. Fassaden und
Zusatzverkehr liegen im Rauschen der Einzellaeufe (Spanne bis 4 s).

### Determinismus

`district-identity.js vergleich=<aa04428>`: 15 von 26 Werten gleich. Die
11 anderen sind die gewollten: Hindernisse (11 006 -> 11 281, genau die
275 neuen Parkwagen), Parkautos nach dem Laden und nach 20 s, Zahl und
Lage der fahrenden Wagen nach dem Laden (45 -> 80), nach 20 s Wagen,
Passanten und Gegner (die Abbiegewahl zieht andere Zufallszahlen als
vorher; die Gegnerzahl schwankt in beiden Staenden gleich - sechs Keime,
nach 40/80/120 s: in fuenf 12, in einem ein Ereignis mit +3 bzw. +5).

Eigens geprueft (eigene Probe, beide Staende): ohne die Parkwagen
dieselben 10 706 Hindernisse, dieselben 300 alten Parkplaetze, dieselben
45 Wagen der Welt (Achse, Spur, Lage, Richtung, Bauart, Tempo) und
dieselben 88 Passanten - Bit fuer Bit gleiche Pruefsummen.

### Regression

Gegen aa04428, Keim 4711:

- `node --test` 170/170. `stadtraster.js`: alles unveraendert.
  `parkautos.js`: 575 Wagen, Ausschlusszonen ohne Befund, engste Stelle
  fuer einen Bus 0,03 m wie vorher.
- Klettern: Naht, `kletterproxy.js` (MO1), `topoutlandung.js`,
  `kletterstetigkeit.js`, Neon-Bahnen (27, Brust / Becken / Knie hinter 0,
  Schnitt 0): Zeile fuer Zeile gleich. `brutal-halle.js teil=anlauf`:
  gehen 30/30, rennen 30/30, invisibleCollision 0, durch Barriere 0, im
  Kern 0 wie vorher; die Stichprobe der Anlauffaelle ist eine andere (die
  Hindernisliste ist um die Parkwagen laenger).
- `innenklettern.js` (isoliert und im Weltlauf): innen 108 Laeufe, 0
  angeklebt, alle vier harten Zahlen 0. Aussenkontrolle 91 statt 92
  Laeufe, 85 statt 89 angeklebt, 1 ungueltig (Startpunkt verfehlt): alle
  neuen Faelle an begehbaren Haeusern, deren Wand direkt am Bordstein
  steht - der Kontrollstart 5 m davor liegt jenseits der Parkspur, und ein
  neuer Parkwagen steht zwischen Start und Wand (2,3 bis 4,5 m vom Start;
  die drei alten Faelle sind dieselbe Art mit alten Parkwagen). Mit
  demselben Code ohne Parkstreifen: 92 / 89 / 0 wie vorher.
- `street-details.js`: gleich. `street-life.js`: harte Geometriefehler 0
  (Laufzahlen schwanken mit dem anderen Laufzeitzufall);
  `street-life-activities.js`: harte Fehler 0.
- `npc-wege.js`: A 0 (vorher 2), B 0, C 0, D 90 (vorher 87), E 83.
- `kernsysteme.js`: Story Akt 1 8 Missionen, 8 sauber; Seitenfehler 0,
  npc- und enemyStaticPenetration 0, playerNpcOverlap 0 (vorher 7).
- `freigang.js`: 572 gestreift, 0 gesperrt, kleinste Gehbreite 1,60 m -
  gleich.
- `district-identity.js`: harte Fehler 0, neue Hindernisse 0.
- `verkehr-dichte.js`: harte Fehler 0 (siehe B).

### Grenzen

- Die Modellfassaden oberhalb des Erdgeschosses bleiben Fototextur; die
  Familie wird dort ueber das Erdgeschoss hergestellt, nicht umgekehrt.
- Die Fassade der prozeduralen Haeuser ist Shader: aus der Naehe flach,
  ohne echte Laibungstiefe; Fenster an sehr schmalen Fronten entfallen
  (unter 0,5 m Fensterbreite je Achse).
- Der Verkehr bleibt eine Irrfahrt: die Bezirksdichte stellt sich im
  Mittel ein, ein einzelner Moment kann anders aussehen.
- Unfall-Vorfaelle halten einen Wagen absichtlich an; die Spur dahinter
  wartet (kein Spurwechsel) - mit mehr Verkehr steht dort oefter eine
  kurze Schlange.
- Ladezeit +3,6 s (T6, SwiftShader), fast ganz die drei Shaderprogramme
  der Parkwagen; Simulation +1,3 ms je Schritt, fast ganz die Fahrerpose.
  Beides waere der naechste Hebel, falls es auf echter Hardware stoert.
- Parkplaetze abseits der Strasse und Parkhaeuser gibt es nicht (siehe C).

## 6s. Qualitaets-Pass nach Stufe 8B (Markierung, Gebaeude, Leuchttafeln)

Keine neue Stufe: drei getrennte Arbeitspakete auf dem Stand 64d4952,
jedes mit eigenem Commit. Abnahmebilder in `docs/abnahme-qp/`.

### Paket 1: Fahrbahnmarkierung

**Die Strasse aus dem Screenshot** (drei gestrichelte Linien weiss -
gelb - weiss) ist eine AVENUE. Avenuen sind die Rasterlinien mit
k % 3 == 0 ausser dem Boulevard: x = -275, x = 25, z = -125, z = 175.
Alle Klassen haben 12 m Asphalt (ROAD_HALF 6); die Spurmitten
(`strasseInfo`, gemessen ueber `d.strassen()`):

| Klasse | Linien | Spurmitten (m von der Achse) | Spuren je Richtung |
|---|---|---|---|
| LOCAL | x = -325, z = -275, z = 275 | +/-2,4 | 1 |
| STREET | alle uebrigen, auch Uferstrasse x = 175 und Brueckenstrasse z = -25 | +/-2,8 | 1 |
| AVENUE | x = -275, x = 25, z = -125, z = 175 | +/-1,6 und +/-4,4 | 2 |
| BOULEVARD | x = -125, z = 25 | +/-1,9 und +/-4,6, Mittelstreifen 1,2 m | 2 |

Die Avenue ist **wirklich vierspurig**: die Wagen fahren auf allen vier
Spuren (180 s, Proben je Spurlage -4,4 / -1,6 / +1,6 / +4,4 m:
1818 / 1146 / 1318 / 2464; Boulevard 824 / 1329 / 1567 / 1730; STREET
und LOCAL nur auf +/-2,8 bzw. +/-2,4 m), und `strassen.js` findet 0
Wagen neben ihrer Spur. Die beiden weissen Linien bei +/-3,0 m sind also die
richtigen Trenner zwischen den zwei Spuren einer Richtung. Nach A3
bleiben Spurzahl und Trenner; falsch war die DARSTELLUNG: Mittellinie und
Trenner waren gleich breite, gleich lange Strichreihen, und in der Sonne
liefen alle drei auf fast reines Weiss - man las drei gleichwertige
Linien und keine Richtungstrennung. Parkstreifen liegen ausserhalb der
Fahrspuren am Bordstein und sind nicht beteiligt.

**Echte Fehler** (`tools/pruef/strassen-markierung.js farben=alt` auf
64d4952, Keim 4711):

- 692 von 1450 Stadtstrichen lagen in einem Zebrastreifen. Gezeichnet
  wurde alle 10 m ein 4-m-Strich, ausgelassen nur im 9-m-Umkreis einer
  Kreuzungsmitte - ein Strich mit Mitte bei 9 m reicht bis 7 m, der
  Zebrastreifen liegt bei 6,3 bis 10,5 m.
- 66 Striche hinter der aeussersten Kreuzung, neben jeder Fahrbahn.
- alle 21 Mittelstreifen-Stuecke lagen quer ueber einem Zebrastreifen.
- anderes Ufer: 74 von 198 Strichen liefen durch die Kreuzungen, 3 in
  die Brueckenauffahrt.
- 0,30 bis 0,35 m breite Striche in 0xe8e8e0 (Gelb 0xd9c979), der
  Mittelstreifen in 0xbfc4c9.

**Licht:** am Tag liegt auf einer Bodenflaeche Sonne (1,25) plus Himmel
(1,08), ohne Tonemapping - gemessen das rund 2,0-fache der Grundfarbe,
im Schatten das 0,9-fache. Alles ueber etwa 0x80 laeuft in der Sonne auf
255 ueber: Linien, Gelb (255, 255, 201) und Mittelstreifen waren
zeichnungslose weisse Balken.

**Geaendert** (nur Deko-Kloetzchen im gemeinsamen Sammel-Mesh, kein
Zeichenaufruf mehr oder weniger):

- `markiereLinie`: EIN Helfer fuer Stadt, Bruecke und anderes Ufer -
  0,15 m breit, 3 m Strich, 5 m Luecke, das Muster mittig im Abschnitt.
- Je Abschnitt zwischen zwei Kreuzungen; jede Linie endet
  `MARK_ENDE` = 11,5 m vor der Kreuzungsmitte, 1 m hinter dem
  Zebrastreifen. Keine Striche hinter der aeussersten Kreuzung.
- Zweispurig (LOCAL, STREET, Ufer, Bruecke): EINE gestrichelte gelbe
  Mittellinie, keine weissen Linien.
- AVENUE: durchgezogene doppelte gelbe Mittellinie (+/-0,13 m),
  gestrichelte weisse Spurtrenner bei +/-3,0 m - genau zwischen den
  Spurmitten 1,6 und 4,4.
- BOULEVARD: Mittelstreifen plus gestrichelte weisse Trenner bei
  +/-3,25 m. Der Mittelstreifen beginnt wie die Linien hinter dem
  Zebrastreifen und ist betongrau (0x5c5e60).
- Farben 0x7a7b77 (weiss) und 0x7d682c (gelb): in der Sonne rund 245
  bzw. (250, 210, 90), im Schatten 110 bzw. (115, 95, 40) - hell auf dem
  Asphalt (Sonne 110, Schatten 50), aber mit Zeichnung.
- Bruecke: gestrichelte gelbe Mitte auf dem Deck (BR_X0 + 4 bis
  BR_X1 - 4). Anderes Ufer: je Abschnitt, 1 m vor der Kreuzungsflaeche,
  in der Brueckenauffahrt frei.

Nicht geaendert: Spurzahl, Spurmitten, Fahrtrichtungen, Abbiegen,
Strassenbreite, Zebrastreifen, Parkmarkierung, Stellplaetze.

**Ergebnis** (`strassen-markierung.js`, harte Fehler, Soll 0):

| | vorher | nachher |
|---|---|---|
| Striche Stadt | 1450 | 1300 |
| Trenner ohne passende Spur | 0 | 0 |
| Mittellinie falsch | 0 | 0 |
| fehlende Mitteltrennung (241 Abschnitte) | 0 | 0 |
| fehlender Spurtrenner (vierspurig) | 0 | 0 |
| im Zebrastreifen | 692 | 0 |
| in der Kreuzung | 0 | 0 |
| ausserhalb der Fahrbahn | 66 | 0 |
| Mittelstreifen im Zebrastreifen | 21 | 0 |
| anderes Ufer in Kreuzung / Brueckenauffahrt | 74 / 3 | 0 / 0 |

Bilder: `qp-strasse-1-zweispurig.jpg` (STREET x = -75, LOCAL x = -325,
Wohnstrasse mit Parkstreifen z = 125), `qp-strasse-2-vierspurig.jpg`
(AVENUE x = 25 und z = -125, BOULEVARD z = 25 und x = -125),
`qp-strasse-3-kreuzung-bruecke-ufer.jpg` (Kreuzung x = 25 / z = 75,
Brueckenstrasse, Uferstrasse) - Spielkamera, Figur auf der Fahrbahn.

**Regression Paket 1:** `node --test` 170/170; Parken vorher wie nachher
962 Stellplaetze, 575 geparkt, 80 fahrend, je Bezirk gleich;
`stadtraster.js` unveraendert; `strassen.js` 0 Wagen neben der Spur,
0 auf der falschen Seite; `parkautos.js` ohne Befund;
`verkehr-dichte.js` harte Fehler 0/0/0/0; `determinismus.js` gleich;
`stadt-leistung.js` (gepaart, dieselbe Stunde) Gesamtmedian 868,5 -> 858
(Strasse 797,5 -> 791,5, Dach 795,5 -> 788,5, Luft 899 -> 893), Dreiecke
3 721 711 -> 3 694 740. `strassen-markierung.js`: harte Fehler 856 -> 0.

---

## 7. Was noch aussteht

Stufe 3 bis 11: Strassenhierarchie, Parzellierung und Strassenwaende,
Hoehenhierarchie, mehr Verkehr und parkende Autos, mehr
Zivilisten-Varianten, Bezirke aus gebauten Eigenschaften, erweiterte
Netze, Einsatzkraefte und Ereignisse, Leistungsarchitektur, Regression.

Nicht Teil von CITY V2: Akt 2, ein neues Heldenrig, neue
Higgsfield-Erzeugungen, und - solange die Lizenzlage nicht geklaert ist -
jedes Modell aus dem BUILD-2-Paket (siehe `docs/BUILD2-ASSET-AUDIT.md`).
