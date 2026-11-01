# Mega-Update 1.0 – Abnahmeunterlagen

Doku: `docs/MEGA-UPDATE-1.0.md`. Alle Bilder aus dem echten Spiel
(Keim 4711), mit den Prüfständen in `tools/pruef/` erzeugt.

| Datei | Paket | Inhalt |
| --- | --- | --- |
| `m2-wand-finisher.jpg` | M2 | Wand-Finisher an zwei Ladenfronten: Spielkamera und Seitenansicht – der Gegner hängt im Kokon an der Fassade |
| `m2-luft-finisher.jpg` | M2 | Luft-Finisher in vier Bildern: Treffer in der Luft, Schmettern, Aufschlag mit Druckwelle |
| `m3-dachkette.jpg` | M3 | Dachparkour in vier Bildern (Spielkamera, HUD): Sprint über Dach A, Netz-Zip über die Straße, Wandlauf an der Fassade von B, auf Dach B mit Flow-Bonus „+44 FLOW ×4“ unter der Minikarte (`tools/pruef/mega-bewegung-bilder.js`) |
| `m3-wandlauf-seite.jpg` | M3 | Dieselbe Kette, Seitenansicht während des Wandlaufs nach dem Zug – die Figur liegt an der sichtbaren Fassade |

## Selbst testen (Human-Abnahme)

**M1 – Ereignisse.** Durch die Stadt schwingen; Ereignisse kommen von
selbst (höchstens ein großes, höchstens zwei zugleich, mit Ruhephasen).
Hinweise: Alarmglocke (Laden), Alarmanlage (Autodieb), „Hilfe!“ (Dach),
Knall und Rauch (Unfall). Zieltext oben, roter Leuchtturm am Ort.
* Laden: Räuber schlagen, dem Flüchtenden mit Q hinterher, Sack aufheben,
  zum Inhaber bringen (Nähe oder C).
* Autodieb: unter 24 m 1,8 s Zeit – Q auf den Dieb verhindert die Jagd.
  Sonst: dem Wagen nach, drei Treffer (Schlag am Wagen, Landung auf dem
  Dach oder Q auf den Wagen), dann den flüchtenden Dieb einspinnen.
* Dach: unter 45 m rutscht die Person ab – 18 s. Mit E zur Kante ziehen,
  hochklettern, C. Mit ihr zur Straße (springen, gleiten), landen.
  Fällt sie, fängt das Netz bis 9 m von selbst.
* Unfall: C beim Verletzten, C am Wagen (Tür auf), C beim Fahrer.

**M2 – Kampf.** Einen Gegner vor einer Hauswand dreimal schlagen, dann Q:
Wand-Finisher. Auf freier Fläche dasselbe: normaler Netzschuss. Haken (R),
Leertaste hinterher, ein Schlag, F: Luft-Finisher mit Druckwelle. In einer
größeren Gruppe auf den Flinken achten: er kommt von hinten, der
Spinnensinn warnt.

**M3 – Bewegungsfluss.**
* Schwung → Zip: schwingen, loslassen, gleich E. Der Arm schießt das Netz
  ohne Ruck nach vorn (vorher sprang die Hand im ersten Bild).
* Zip → Wandlauf: auf eine hohe Fassade zielen, E, W halten – die Figur
  rennt mit dem Schwung des Zugs die Wand hoch und zieht sich an der Kante
  hoch. Ohne Taste bleibt sie an der Wand hängen; mit S lässt sie los.
* Dachkette: auf einem Dach Anlauf nehmen (W + Shift), an der Kante
  springen, E auf die Fassade des höheren Nachbarhauses, W halten.
* Flow: mehrere verschiedene Bewegungen ohne Pause (z. B. Schwung, Zip,
  Wandlauf, Hochziehen, Landung, Sprint). Rechts unter der Minikarte
  steht „×n“ mit der letzten Aktion; beim Stehenbleiben kommt „+P FLOW ×n“.
  Dieselbe Taste immer wieder bringt nichts; ein Treffer reißt die Kette.
