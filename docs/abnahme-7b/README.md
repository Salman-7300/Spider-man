# CITY V2 Stufe 7B - Abnahme

Spielcode: Stand e1fac97 (seither unveraendert). Pruefstaende und Doku:
siehe `docs/CITY-V2-DESIGN.md`, Abschnitt 6p. Alles mit Keim 4711, wenn
nicht anders angegeben.

## Videos (je 2:18 min)

Normale Spielkamera, Gehen mit Alt+W, Gangs und Vorfaelle aus, Echtzeit
(15 Bilder je Sekunde). Jede Fassung beginnt mit einer Titeltafel und
traegt ihre Kennzeile in jedem Bild.

| Datei | Fassung |
| --- | --- |
| `7b-video-A-unveraenderte-rundwege.mp4` | **A - unveraenderte Rundwege**: die festen Wege des 7A-Videos (Zentrum, Geschaeft, Wohnen, Park, Ufer), nicht nach Aufenthalten ausgewaehlt. So duenn ist es im normalen Gang: im 30-m-Umkreis meist 0 bis 1 Person. |
| `7b-video-B-gezielt-belebte-stellen.mp4` | **B - gezielt ausgewaehlte belebte Stellen**: je Stadtteil nach dem Vorlauf die Stelle mit den meisten Aufenthalten, der Weg fuehrt daran vorbei. NICHT repraesentativ - zeigt die Aufenthalte aus der Naehe. |

## Vergleichsbilder VORHER (e92110a) | NACHHER (7B)

`7b-vorher-nachher-orte-01-05.jpg`, `-06-10.jpg`: die zehn Strassenorte.
`7b-vorher-nachher-spielkamera-t1/t2/t3.jpg`: die vier Spielkamera-
Ansichten zu drei Zeitpunkten. Kopfzeile: wirklich sichtbar bis 50 m je
Zustand. **gafft** = schaut dem Helden zu, den das Bildwerkzeug
unsichtbar an die Kamera stellt - das ist KEIN Aufenthalt (am Ufer-Ort
der Mann mit erhobenen Armen). In den 22 NACHHER-Bildern bis 100 m: 15
Personen, 9 gehend, 4 im Aufenthalt (Bank, Gespraechsplatz, Warten,
Handyplatz), 1 kurzer Halt am Routenende mit Handy, 1 Gaffer; vorher 29,
alle gehend. Einzelbilder streuen stark - verglichen wird das Mittel
ueber 240 s (Doku 6p).

## Nahaufnahmen

`7b-nah-baenke.jpg`: Bilder 1, 2 und 8 im Lauf gefunden. **2b ist
GESTELLT** (roter Rahmen): zwei Passanten per Pruefaufruf
`aufenthaltSitzen` auf die zwei Plaetze einer Bestandsbank gesetzt - zwei
auf einer Bank kam in keiner Suche im Lauf vor.
`7b-nah-orte.jpg`: Gespraech, Handy, Park, Ufer, Zentrum - im Lauf
gefunden.

## Ueberlappung fliehender Passanten mit dem Helden

`plan-ueberlappung.txt` (vor den Hauptlaeufen festgelegt) und
`ergebnis-ueberlappung.txt` (Auswertung). Werkzeuge:
`tools/pruef/flucht-ueberlappung.js` und `-auswertung.js`.

- A) alter Mechanismus bestaetigt: auf e92110a und 7B identisch.
- B) Haeufigkeit durch 7B erhoeht: **unklar** nach der festgelegten Regel
  (6 gegen 6 Ueberschneidungen in je 200 Episoden, Ratenverhaeltnis 1,00,
  95 % 0,27 bis 3,74). In 7B kommen 3 der 6 unmittelbar nach einem
  Aufenthalts-Abbruch (Bank).

## Bekannte offene Fehler (mit Reproduktion)

1. **Fliehende Passanten laufen durch den stehenden Helden** (Bestand,
   auf e92110a gleich). Reproduktion: eingefroren nach dem Laden, freie
   Flaeche, ein Passant im Zustand walk, ein Gegner 4 m hinter ihm, der
   Held 2,5 m vor ihm in Fluchtrichtung, 150 Bilder zu 1/60 s ->
   kleinster Abstand 0,054 m, 11 Bilder unter 0,45 m. Im Kernsystem-Lauf
   (`tools/pruef/kernsysteme.js`, bei t = 61,25 s Spielzeit) als
   playerNpcOverlap 12 in 5 von 10 Laeufen auf 7B, 0 in 7 auf e92110a.
2. **npc-wege B: Fliehende unter der Bodenflaeche** (Bestand). Mit
   eingefrorenem Start auf beiden Staenden derselbe Fall: Route
   Bruecke 215/-32,6 -> 166/36,8, 1953 Bilder auf der Flucht, 3 Bilder
   unter dem Boden.
3. Nicht 7B, aus 7A bekannt: weisser Promenadenbelag in einem Teil der
   Bilder; Haengenbleiben am Bushaeuschen (7A-Video).

Nicht mehr offen: der Innenklettern-Pruefstand sammelte nach dem Tod des
Helden weiter Fehlversuche. Er ist jetzt isoliert und meldet Tod oder
ungueltigen Start als ungueltigen Fall; `welt` bleibt der
Integrationslauf mit aktiven Weltereignissen.
