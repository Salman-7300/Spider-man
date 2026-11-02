# Mega-Update 1.0 – Abnahmeunterlagen

Doku: `docs/MEGA-UPDATE-1.0.md`. Alle Bilder aus dem echten Spiel
(Keim 4711), mit den Prüfständen in `tools/pruef/` erzeugt.

| Datei | Paket | Inhalt |
| --- | --- | --- |
| `m2-wand-finisher.jpg` | M2 | Wand-Finisher an zwei Ladenfronten: Spielkamera und Seitenansicht – der Gegner hängt im Kokon an der Fassade |
| `m2-luft-finisher.jpg` | M2 | Luft-Finisher in vier Bildern: Treffer in der Luft, Schmettern, Aufschlag mit Druckwelle |
| `m3-dachkette.jpg` | M3 | Dachparkour in vier Bildern (Spielkamera, HUD): Sprint über Dach A, Netz-Zip über die Straße, Wandlauf an der Fassade von B, auf Dach B mit Flow-Bonus „+44 FLOW ×4“ unter der Minikarte (`tools/pruef/mega-bewegung-bilder.js`) |
| `m3-wandlauf-seite.jpg` | M3 | Dieselbe Kette, Seitenansicht während des Wandlaufs nach dem Zug – die Figur liegt an der sichtbaren Fassade |
| `m4-laden.jpg` | M4 | Eckmarkt in vier Bildern (Spielkamera, HUD): Tür mit Lampe und Hinweis „C Eckmarkt betreten“, Laden nach dem Betreten („Hinausgehen“), Inhaber an der Theke („Mit dem Inhaber sprechen“), Regalgang mit Kühlregalen |
| `m4-buero.jpg` | M4 | Kai 7 Bürohaus: Tür mit Lampe und Hinweis, Empfang, Wartebereich mit sitzendem Besucher, Arbeitsplätze mit sitzender Mitarbeiterin |
| `m5-schatten-reihe.jpg` | M5 | Nebenreihe „Die Schatten der Stadt“ (Spielkamera, HUD): am Empfang im Kai 7 „Auftrag annehmen: Schatten I“, Spurenmarke mit „Spur untersuchen“, der Beobachter mit blauem Leuchtturm (Seitenkamera), der Koffer im Hof mit „Koffer sichern“ (`tools/pruef/mega-neben-bilder.js`) |
| `m5-schatten-boss.jpg` | M5 | Mini-Boss SCHATTEN: Ansatz zum Rauchsprung im dunklen Qualm mit Warnpfeil (Seitenkamera), Auftauchen hinter dem Helden (Spinnensinn), eingesponnen nach dem Netz („Aus dem Rauch gerissen“), P-Ansicht mit dem Abschnitt der Nebenreihe |

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

**M4 – Begehbare Orte.** Auf der Minikarte nach dem kleinen Türsymbol
suchen (Eckmarkt im Wohngebiet im Westen, Kai 7 im Mischgebiet), über der
Tür brennt eine warme Lampe. Davor stehen bleiben, C drücken.
* Drinnen frei umherlaufen: nichts sollte durch Regale, Theke, Tische
  oder Wände gehen, die Kamera bleibt im Raum.
* Eckmarkt: mit wenig Gesundheit zum Inhaber an die Theke, C – Gesundheit
  voll (danach 2 Minuten Pause).
* Kai 7: C am Empfang.
* An der Tür C – „Hinausgehen“: man steht wieder auf dem Gehweg, die
  Stadt läuft weiter, wo sie war.

**M5 – Nebenreihe „Die Schatten der Stadt“.** Ins Kai 7 gehen (Tür mit
Lampe, Türsymbol auf der Karte), am Empfang C: „Auftrag annehmen:
Schatten I“. Hinausgehen und dem **blauen** Leuchtturm folgen.
* I: am Ort drei Spurenmarken (Ring mit Raute) – davor C. Danach steht
  ein Mann im Eingang: näher als 14 m, und er rennt – Q fängt ihn, er
  ergibt sich. Seine zwei Leute abwehren.
* II (wieder am Empfang annehmen): Torwache ausschalten (ohne Treffer gibt
  es einen Bonus), in den Hof, fünf Mann (einer Elite), den Koffer mit C
  sichern.
* III: drei Leibwächter, dann SCHATTEN. Achten auf den dunklen Qualm mit
  Warnpfeil: kurz danach verschwindet er und taucht **hinter** dir auf.
  Genau dann Q – „Aus dem Rauch gerissen“, er hängt 2,6 s im Netz. Wer ihn
  mit Schlägen bedrängt, dem entwindet er sich ebenso.
* Scheitern ausprobieren: den Beobachter entkommen lassen, K.o. gehen oder
  weit weglaufen – danach bietet der Empfang „Weitermachen“ ab genau
  diesem Abschnitt an. Zweimal J bricht ab.
* Speichern: mitten in einem Auftrag neu laden – der Kontrollpunkt bleibt
  (er wird wie bei Akt 1 spätestens nach 30 s geschrieben), ein
  Abschluss sofort. P zeigt den Stand der Reihe.
* Akt 1 bleibt unberührt: läuft eine Storymission, lässt die Tür des
  Kai 7 niemanden hinein; läuft ein Nebenauftrag, bietet Akt 1 nichts an.
