# Prüfstand: Messungen im laufenden Spiel

Die Werkzeuge eine Ebene höher (`tools/*.mjs`, `tools/*.cjs`) lesen
Dateien. Damit lässt sich nicht beantworten, ob ein Wagen über die Brücke
fährt, ob ein Fuß beim Gehen rutscht oder ob ein Passant stecken bleibt.
Dafür muss das Spiel laufen.

Diese Skripte starten das echte `index.html` in einem kopflosen Chromium,
frieren die Bildschleife ein und rechnen die Simulation Schritt für
Schritt weiter. Gemessen wird über `window.__dbg`.

## Einrichten

    cd tools
    npm install                       # die normalen Werkzeuge
    npm i -D playwright three@0.128.0 # nur für den Prüfstand
    npx playwright install chromium

Die Version von `three` ist kein Zufall: das Spiel lädt `three@0.128.0`
vom CDN, und der Prüfstand biegt genau diese Anfrage auf die lokale Kopie
um. Neuere Fassungen liefern kein `build/three.min.js` mehr.

`playwright` steht bewusst **nicht** in `tools/package.json`: es lädt
einen ganzen Browser nach, und die meisten Werkzeuge brauchen ihn nicht.
Liegt Chromium schon irgendwo, hilft `PLAYWRIGHT_CHROMIUM=/pfad/zu/chromium`.

## Die drei Fallen

1. `d.frier(true)` hält `animate()` an. `d.schritt(dt)` rechnet einen
   Schritt **ohne zu zeichnen**. Ein Bildschirmfoto ohne `d.zeichne()`
   oder `d.aufnahme(...)` zeigt das Bild von vor dem Einfrieren.
2. Wer auf der Fahrbahn misst, misst irgendwann einen überfahrenen
   Helden. `d.cars.length = 0` vorher, wenn der Verkehr nicht zur Sache
   gehört.
3. Der erste Renderdurchgang nach einem Kamerawechsel unterscheidet sich
   stark von den folgenden (gemessen 425 gegen 605 Zeichenaufrufe bei
   identischer Szene). Für Zeichenaufruf-Vergleiche mehrere Durchgänge
   nehmen und den ersten wegwerfen.

## Was hier liegt

| Skript | Was es misst |
|---|---|
| `bruecke-gehen.js` | Läuft die Brücke in fünf Spuren ab, hin und zurück: Stufen, unsichtbare Wände, Abdrift |
| `verkehr-stunde.js` | Eine Stunde Verkehr: festhängende Wagen, Wagen neben der Fahrbahn, im Wasser, in Häusern, Geisterfahrer |
| `fuss-rutschen.js` | Wie weit der tragende Fuß während des Bodenkontakts wandert, je Gangart. Erstes Argument ist das Bodenfenster in Metern (Vorgabe 0,12) |
| `anim-klassen.js` | Welcher Heldenclip läuft ab, welcher wird als Haltung an einer gesetzten Stelle gehalten |
| `anim-eigentempo.js` | Eigengeschwindigkeit der Gangclips im Animationslabor |

Aufruf jeweils aus diesem Ordner, z. B.

    node fuss-rutschen.js 0.03

Die Laufzeiten reichen von einer Minute (`bruecke-gehen`) bis zu einer
knappen halben Stunde (`verkehr-stunde`).

## Was diese Messungen NICHT sind

Sie laufen in einem software-gerenderten Browser. **Bildraten daraus sind
wertlos.** Aussagekräftig sind Zeichenaufrufe und Dreiecke
(`renderer.info.render`) sowie alles, was aus der Simulation kommt –
Positionen, Zustände, Zähler.
