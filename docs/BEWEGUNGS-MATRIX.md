# Qualitätsmatrix der Heldenbewegungen

Phase 13, Teil 2. Es gibt 94 Dateien `assets/hero@*.glb`. Diese Notiz
hält fest, wie sie gemessen werden, was dabei herauskam – und warum am
Ende **nichts repariert wurde**.

## Zwei Messungen, nicht eine

**Aus der Datei** (`node tools/anim-matrix.mjs`, wenige Sekunden, ohne
Browser): Dauer, Stützstellen, wieviele Knochen sich überhaupt bewegen,
mittlerer größter Ausschlag, und der Winkelunterschied zwischen letztem
und erstem Bild („Naht").

**Aus dem laufenden Spiel**: der Held wird durch Stehen, Gehen, Laufen,
Sprinten, Ducken, Springen, Fallen, Gleiten, Landen, Schwingen,
Wandkleben und eine Schlagfolge geschickt, und jedes Bild werden
`laufStand()` und `angriffStand()` abgefragt. Nur so lässt sich
feststellen, **wie** ein Clip abgespielt wird.

Die zweite Messung ist der Grund, warum die erste allein in die Irre
führt.

## Drei Arten von Clip – gemessen, nicht gelesen

| Art | Woran man sie erkennt | Beispiele (gemessen) |
|---|---|---|
| **läuft ab** | `timeScale` ≠ 0, Zeit läuft weiter | idle, walk, run, sprint, sprint_lang, fall, gleiten |
| **Haltung** | `timeScale` = 0, die Zeit wird gesetzt | schwungbogen (t = 0…0,978 folgt der Lage im Bogen), ducken (feste Stelle) |
| **gemischt** | beides, je nach Eingabe | kriechen, run an der Wand (still = Haltung, in Bewegung = Ablauf) |

Damit ist die Spalte **Naht** nur für die erste Art überhaupt
aussagekräftig. Bei einer Haltung ist der Unterschied zwischen erstem und
letztem Bild genau das, was man haben will.

## Die zehn auffälligen Dateien – und was davon übrig bleibt

| Datei | Messwert | Befund |
|---|---|---|
| `schwungbogen` | 1 s, **2 Stützstellen**, 20 Knochen, 55,8° | Kein Fehler. Gemessen im Spiel: `timeScale` 0, Zeit 0…0,978 aus der Lage im Bogen. Zwei Flughaltungen, dazwischen wird geblendet – genau so gebaut. |
| `sturzflug`, `sturzflug2` | 0,03 s, 2 Stellen, **0 bewegte Knochen** | Reine Haltungen, Ersatz fürs Gleiten. Unsichtbar, kein Anlass. |
| `wandruhe` | 2 s, 60 Stellen, **0 bewegte Knochen** | 60-mal dasselbe Bild. Verschwendet ein paar Kilobyte, sonst nichts. |
| `gleiten` | 3 s, 8 Knochen, **3,6°** | Läuft im Spiel mit Faktor 1 ab. Fast eine Haltung – so von `tools/create-glide-animation.cjs` gebaut. |
| `swing`, `schwunghang`, `haengen_frei` | 3,3 bis 3,9° Ausschlag | Ruhige Flughaltungen, kein Fehler. |
| `zip_dreh` | **3 bewegte Knochen**, 80,5° | Nur der Oberkörper dreht sich – genau das ist die Bewegung. |
| `netzwurf` | 0,41 s, 12 Stellen, 7 Knochen | Kurze Armbewegung, vollständig. |

## Abspielgeschwindigkeit: gemessen, alles schon begründet

Im Spiel angetroffen wurden 26 Clips. Die schnellsten:

    flip_h        3,20-fach
    kriechen      3,50-fach   (Anschlag KLETTER_MAX)
    run (Wand)    3,50-fach   (Anschlag KLETTER_MAX)
    kante         2,82-fach
    sturzland     2,40-fach
    punch3        2,17-fach
    fallrolle     2,25-fach
    sprint_lang   1,65-fach   (eigener Anschlag)

Alles über 2,5-fach sah zunächst nach Zeitraffer aus. Nachgesehen: jeder
dieser Anschläge ist im Code bereits mit einer eigenen Messreihe
begründet – `KLETTER_MAX` mit einer Tabelle über Hand- und Fußrutschen
von 2,5 bis 4,2, `kante` mit dem gemessenen Kernfenster (8–75 % des
Clips, vorher 4,2-fach). **Kein neuer Befund.**

## Was hier NICHT gemessen ist

- Von 94 Bewegungen habe ich 26 im laufenden Spiel angetroffen. Für die
  übrigen 68 steht nur die Dateimessung da, nicht die Abspielart.
- Fußrutschen ist hier nicht gemessen; das steht in
  `ANIMATION-QUELLEN.md` für die Gangarten und gehört zu Teil 7.
- Doppelte Bewegungen sucht `tools/anim-vergleich.mjs`, nicht dieses
  Werkzeug.

## Ergebnis

Teil 2 hat nichts repariert. Das ist kein Versäumnis: jede Auffälligkeit
der Dateimessung hat sich in der Spielmessung als Absicht erwiesen, und
für jeden schnellen Anschlag lag schon eine Messreihe vor. Was bleibt,
ist das Werkzeug – die Matrix ist jetzt in Sekunden wiederholbar, statt
dass jemand 94 Dateien einzeln ansehen muss.
