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

## 7. Was noch aussteht

Stufe 3 bis 11: Strassenhierarchie, Parzellierung und Strassenwaende,
Hoehenhierarchie, mehr Verkehr und parkende Autos, mehr
Zivilisten-Varianten, Bezirke aus gebauten Eigenschaften, erweiterte
Netze, Einsatzkraefte und Ereignisse, Leistungsarchitektur, Regression.

Nicht Teil von CITY V2: Akt 2, ein neues Heldenrig, neue
Higgsfield-Erzeugungen, und - solange die Lizenzlage nicht geklaert ist -
jedes Modell aus dem BUILD-2-Paket (siehe `docs/BUILD2-ASSET-AUDIT.md`).
