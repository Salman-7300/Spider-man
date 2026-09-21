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

---

## 7. Was noch aussteht

Stufe 3 bis 11: Strassenhierarchie, Parzellierung und Strassenwaende,
Hoehenhierarchie, mehr Verkehr und parkende Autos, mehr
Zivilisten-Varianten, Bezirke aus gebauten Eigenschaften, erweiterte
Netze, Einsatzkraefte und Ereignisse, Leistungsarchitektur, Regression.

Nicht Teil von CITY V2: Akt 2, ein neues Heldenrig, neue
Higgsfield-Erzeugungen, und - solange die Lizenzlage nicht geklaert ist -
jedes Modell aus dem BUILD-2-Paket (siehe `docs/BUILD2-ASSET-AUDIT.md`).
