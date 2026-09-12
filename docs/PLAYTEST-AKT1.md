# Akt 1 selbst spielen — und hinterher Zahlen haben

Test F kann kein Bot ersetzen. Ob eine Mission verständlich ist, ob die
Kette aus Anfahrt, Kampf und Abschluss trägt, ob es Spaß macht — das
sieht nur ein Mensch. Damit aus dem Durchlauf trotzdem etwas Messbares
wird, gibt es einen Prüfmodus.

**Am Spiel ändert er nichts.** Keine Mission wird vereinfacht, nichts
eingeblendet, keine Hilfe gegeben. Gemessen wird nur, was ohnehin im
Spielzustand steht.

## Einschalten

Die Seite mit `?playtest=1` aufrufen:

    https://salman-7300.github.io/Spider-man/?playtest=1

In der Konsole (F12 → Console) erscheint dann ein roter Hinweis
`PRUEFMODUS AKTIV`.

Alternativ jederzeit während des Spielens in der Konsole:

    playtest.start()

## Spielen

Akt 1 ganz normal durchspielen, alle acht Missionen. Neustarts, Tode und
Abbrüche sind **erwünschte Daten** — sie werden mitgezählt, nicht
bestraft.

## Auslesen

Nach dem letzten Auftrag in der Konsole:

    playtest.bericht()

Das gibt eine Tabelle, eine Zeile je Mission:

| Spalte | Bedeutung |
|---|---|
| Mission | Titel des Auftrags |
| Dauer | Sekunden von Annahme bis Abschluss |
| Ausgang | `erfolg`, `weich` (weicher Fehlschlag) oder `abbruch` |
| Tode | wie oft der Held gestorben ist |
| Neustarts | wie oft die Mission neu begonnen wurde |
| ohne Fortschritt | Sekunden, in denen es nicht weiterging |
| längste Phase | die längste einzelne solche Strecke |
| **Ziel dabei** | **welcher Auftragstext dabei anstand** |
| bis Ziel verstanden | Sekunden bis zur ersten echten Annäherung ans Ziel |

Darunter die Anteile über alle Missionen: Kampf, Traversal, Erkundung,
Jagd, Warten.

Die Spalte **„Ziel dabei"** ist die wichtigste. Die bloße Dauer sagt nur,
*dass* es hakte; der Zieltext sagt, *woran*.

## Weitergeben

Für die vollständigen Daten:

    copy(playtest.roh())

legt alles als JSON in die Zwischenablage.

## Beenden

    playtest.stop()

## Was NICHT gemessen wird

Spaß, Schwierigkeit, Verständlichkeit der Texte, ob eine Mission zu lang
ist. Das steht in keinem Zustand und muss aus dem Spielen kommen.
