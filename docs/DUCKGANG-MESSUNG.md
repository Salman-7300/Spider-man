# Teil 7: Warum die Duckgangarten rutschen

Bekannter Wert bis hierher: **44,8 % Fußrutschen** bei den Duckgangarten,
dreimal so viel wie bei den normalen. Der Versuch, `gangKontakt`
einzuschalten, hatte es verschlechtert (44,8 → 60,5 %) und war
zurückgenommen worden.

Phase 13 verlangte, vor jedem weiteren Fix **die Ursache zu messen**.
Prüfstand: `tools/pruef/duckgang.js`.

## Erstes Ergebnis: die 44,8 % waren nie eine gültige Zahl

Das bisherige Verfahren grenzt Stützphasen ab: es sucht die Bilder, in
denen ein Fuß unten ist, und rechnet je Abschnitt den Weg des Fußes in
der Welt gegen den Weg der Figur. Gemessen wurde jetzt, wie lang so ein
„Kontakt" eigentlich dauert:

| Gangart | Kontaktdauer | davon an der Cliplänge |
|---|---|---|
| **kriechen** | **7,98 s** | **3,37 Cliplängen** |
| ducken | 0,42 s | 0,77 |
| schleichen | 0,95 s | 0,40 |
| gehen | 0,18 s | 0,34 |
| laufen (walk) | 0,12 s | 0,14 |
| sprinten (run) | 0,08 s | 0,20 |

Bei `kriechen` dauert ein einzelner „Bodenkontakt" **mehr als drei
Cliplängen**. Der Fuß hebt im Kriechen nie weit genug ab, um das
Messfenster zu verlassen — das Verfahren sieht einen einzigen,
endlosen Kontakt und rechnet den gesamten Weg der Figur als Rutschen.
**Jede Rutschzahl der Duckgangarten aus diesem Verfahren ist wertlos.**

## Zweites Maß, ohne Abgrenzung

Deshalb ein zweites Verfahren (**D3**): von allen Bildern werden die
genommen, in denen der Fuß im **unteren Drittel seines eigenen
Höhenbereichs** liegt — das ist die Stützphase, ohne sie abgrenzen zu
müssen. Verglichen wird Bild für Bild der Weg des Fußes in der Welt
gegen den Weg der Figur.

| Gangart | GANG_REF | Eigentempo bei timeScale 1 | **D3-Median** |
|---|---|---|---|
| kriechen | 0,85 | **0,57** | **99,0 %** |
| ducken | 1,15 | 1,29 | 26,3 % |
| schleichen | 2,00 | 1,64 | 30,0 % |
| gehen | 1,55 | 1,50 | 13,2 % |
| laufen | — | — | 12,4 % |
| sprinten | — | — | 26,5 % |

**Das ändert den Befund.** `ducken` (26,3 %) und `schleichen` (30,0 %)
liegen im selben Bereich wie **Sprinten (26,5 %)** — sie rutschen nicht
dreimal so stark, sondern etwa gleich viel. Die alte Zahl kam aus dem
kaputten Verfahren.

Übrig bleibt ein echter Ausreißer: **`kriechen` mit 99 %.** Der Fuß legt
genau so viel Weg zurück wie die Figur — er steht also überhaupt nicht
auf, sondern wird mitgeschleift.

## Der eine getestete Fix — und warum er nicht übernommen wurde

`kriechen` ist auf `GANG_REF = 0,85` eingestellt, trägt gemessen aber
nur **0,57 m/s**. Das ist eine echte Abweichung von einem Drittel. Der
naheliegende Fix: die Referenz auf das gemessene Eigentempo setzen, damit
der Clip schneller läuft und den Weg trägt.

Durchgemessen über `d.setzeGangRef`, ohne `game.js` anzufassen:

| GANG_REF | timeScale | Eigentempo | D3-Median | D3-Max |
|---|---|---|---|---|
| **0,85** (eingebaut) | 1,00 | 0,57 | **99,0 %** | **200,2 %** |
| 0,70 | 1,21 | 0,70 | 101,1 % | 222,0 % |
| 0,57 | 1,49 | 0,87 | 103,3 % | 252,1 % |
| 0,45 | 1,89 | 1,10 | 105,1 % | 293,6 % |

**Jeder Wert ist schlechter — im Median UND im größten Einzelruck.** Die
Annahmebedingung („Median sinkt, größter Ruck steigt nicht") wird von
keinem erfüllt.

Der Grund ist jetzt klar: Bei 99 % gibt es **keine Stützphase, die man
beschleunigen könnte**. Der Low-Crawl-Clip ist eine armgetriebene
Bewegung, bei der die Beine nachgezogen werden. Den Clip schneller
laufen zu lassen, zieht die Beine nur schneller nach.

**Ergebnis: nichts geändert.** Eine Zwangslösung hätte das Bild
verschlechtert.

## Übergänge

| Übergang | Clip | Wechsel | Tempo | größter Fußruck |
|---|---|---|---|---|
| Duckstand → Duckgang | `ducken` → `ducken` | kein Clipwechsel nötig | 0 → 2,2 m/s | 0,104 m |
| Duckgang → Laufen | `ducken` → `sprint_lang` | nach 1 Bild | 2,2 → 7,0 m/s | 0,084 m |

Beide Übergänge sind unauffällig: der Clipwechsel greift sofort, und der
größte Ruck liegt unter zehn Zentimetern.

## Was offen bleibt

Das Rutschen von `kriechen` lässt sich **mit diesem Clip nicht durch eine
Zahl beheben**. Möglich wären nur größere Eingriffe, die in einer
Prüfphase nichts zu suchen haben: eine andere Kriechanimation, oder
Fuß-IK, die die Füße während der Stützphase am Boden festhält.

Bis dahin gilt: gemessen, benannt, offen gelassen.
