# Mega-Update 1.0 – Abnahmeunterlagen

Doku: `docs/MEGA-UPDATE-1.0.md`. Alle Bilder und Videos aus dem echten
Spiel (Keim 4711), mit den Prüfständen in `tools/pruef/` erzeugt. Die
Bilder sind nicht nachbearbeitet; die Videos sind nur beschriftet und an
gelb markierten Stellen gekürzt. **Gestellt** heißt hier: die Ausgangslage ist gesetzt
(Held versetzt, Ereignis oder Auftrag gestartet, Tageszeit und Wetter
gesetzt); was danach passiert, sind echte Eingaben oder die Prüfbots aus
`tools/pruef/` – mit Spielkamera und HUD, wie ein Spieler es sieht. Wie
die Abläufe regulär entstehen (Regisseur, Türen, Empfang), prüfen die
Prüfstände.

## Videos

Alle drei Videos sind aus dem echten Spiel mit der normalen Spielkamera und
dem HUD aufgenommen (960 × 540, 15 Bilder/s, abgespielt in
Spielgeschwindigkeit). **Gestellt** ist jeweils nur der Anfang eines
Abschnitts – das steht dauerhaft unten im
Bild. Der Ton der beiden M6-Videos stammt aus demselben Lauf: das Spiel
rechnet seinen Klang in einem `OfflineAudioContext`, der im Gleichschritt
mit den Bildern läuft (`tools/pruef/klang-takt.js`); nichts ist
nachträglich unterlegt, es gibt keine fremde Musik.

Aufgenommen wird Bild für Bild, langsamer als Echtzeit (SwiftShader).
Kurze Einblendungen, die im Spiel nach der Uhr des Browsers verschwinden
(Funksprüche „📻 …“, schwebende Punkte, „Hilfe!“ über Passanten, je
knapp 1 s), sind deshalb in den Videos kaum oder gar nicht zu sehen – im
Spiel sind sie da. Zieltext, Hinweiszeile, Leuchttürme, Kombo und
Punktestand laufen mit der Spieluhr und sind zu sehen. Ein Schnitt nimmt
Bilder und den zugehörigen Ton gemeinsam heraus (2 940 Abtastwerte je
Bild) und ist gelb im Bild markiert. Kodiert mit ffmpeg (H.264, CRF 30,
AAC 96 kbit/s), Beschriftung mit `drawtext`.

| Datei | Länge | Inhalt |
| --- | --- | --- |
| `m6-atmosphaere.mp4` | 1:23, mit Ton | **M6 – Atmosphäre bei Tag und Nacht, Stadtklang, Einsatzklang** (`mega-m6-video.js film=atmo`). 0:00 Straße am Tag: Verkehr, Hupen, ferne Stadt, Musik auf „Nur Stadtklang“ (der Held läuft geradeaus gegen ein Parkauto und bleibt dort stehen). 0:08 Dach in 28 m: der Verkehr leiser und dumpfer, Höhenwind in Böen. 0:15 im Kai 7: Stadt wie durch eine Tür, Lüftung, Zimmerhall. 0:26 Nacht mit Regen. 0:34 Park bei Nacht mit Grillen. 0:41 Ladenüberfall mit dem Prüfbot: Kampf, Hilferufe, Musik „An“ zieht an; ab 0:57 Nachphase – der Held wartet, Streifenwagen und Rettungswagen kommen mit Sirene. Die letzten 3,7 s der Aufnahme sind abgeschnitten (der Rettungswagen fuhr durch die Kamera, das Bild war weiß). |
| `m6-zusammenhang.mp4` | 1:01, mit Ton | **Zusammenhängender Ablauf mit Neuerungen aus allen Paketen** (`mega-m6-video.js film=lang`). 0:00 M3: Schwung, Loslassen, Netz-Zug, Wandlauf, aufs Dach, Flow-Anzeige. 0:09 M1/M6: Ladenüberfall mit dem Prüfbot – Zieltext, Kampf (Erste-Hilfe-Hinweis bei einem Verletzten), der Flüchtige, Beute zurück; Einsatzklang mit Schlägen, Hilferufen und Sirenen, Musik „An“; 0:30 Rettungswagen, 0:32 **Schnitt** (17 s Warten ausgelassen), danach der Streifenwagen. 0:37 M2: Luft-Finisher – Aufwärtshaken, hinterher, Schlag, Druckwelle (vorher werden Punkte gutgeschrieben, damit die Stufe für den Haken erreicht ist – daher springt die Punktzahl auf über 70 000). 0:43 M4/M5: Kai 7 – Tür, Empfang mit Empfangskraft und Besucher, „Auftrag annehmen: Schatten I“, „… ruht, solange du drinnen bist“, hinaus; der Prüfbot ist schnell, der Abschnitt dauert nur gut 3 s (zum Anhalten; länger im Atmosphäre-Video ab 0:15). 0:46 M5: Schatten I – zum Ort (Anreise auf 35 m abgekürzt), drei Spuren mit C, den Beobachter stellen, seine Leute abwehren; 0:58 Abschluss – Punkte und Ruf steigen, die Auftragszeile verschwindet. Die geplante Nachtszene am Ende ist weggelassen: der Held stand dort 9 s fast unsichtbar im Dunkeln fest; die Nacht zeigt `m6-atmosphaere.mp4`. |
| `m1-ereignisse.mp4` | 0:54, ohne Ton | **M1 – Stadtereignisse vom Entdecken bis zur Auflösung, Endstand** (`mega-video.js`, Prüfbot aus `mega-bot.js`, dieselben Eingaben wie `mega-ereignisse.js`). 0:00 Dachrettung: Hilferuf, „Er rutscht ab – schnell hin! (C)“ mit Uhr, Netz-Zug aufs Dach, Person sichern, mit ihr hinunter, Landung mit Flow-Bonus; 0:18 **Schnitt** (19 s Warten ausgelassen), der Rettungswagen kommt. 0:23 Unfall: zum Verletzten, erste Hilfe; 0:28 **Schnitt** (10 s ausgelassen – der Prüfbot wartet absichtlich, bis der Wagen raucht), „Fahrer befreien (C am Wagen) 30 s“, Tür auf, gelöst. 0:32 Autodieb mit Jagd: „Dieb stoppen, bevor er einsteigt!“ – er kommt weg, „Fluchtwagen stoppen“ mit drei Treffern und Netz-Zug hinterher, dann „Autodieb schnappen“. 0:47 Autodieb direkt gestoppt: der Dieb wird vor dem Einsteigen überwältigt, keine Jagd. Den Ladenüberfall zeigen beide M6-Videos im Endstand. Die −40 Punkte („Zivilist verletzt“) zwischendurch kommen von Straßenganoven an anderer Stelle (vorhandene Regel). |

## Bilder

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
| `m6-hud.jpg` | M6 | HUD in vier Bildern, **gestellt** (Held und Lage gesetzt, Ereignis bzw. Mission gestartet; Spielkamera und HUD echt, `tools/pruef/mega-m6-bilder.js`): Ereignis ohne Auftrag – Zieltext, roter Leuchtturm, Kombo unter der Minikarte; Storymission und Ereignis zugleich – der Zieltext mit Entfernung gehört dem Auftrag („Unruhige Nacht · Zum gemeldeten Überfall · 340 m“); Abschluss mit Belohnung im Hinweis („✅ Situation entschärft +88 Punkte“); Straße bei Nacht |
| `m6-fortschritt.jpg` | M6 | P-Ansicht (gestellter Stand): oben „Als Nächstes“ (Geschichte, Nebenauftrag, nächster Meilenstein) und Akt 1; weiter unten „Besondere Einsätze“ und die Fertigkeiten mit den neuen Texten von Schwungkunst und Sauberer Abschluss |
| `m6-tag-nacht.jpg` | M6 | dieselbe Kreuzung am Tag und in der Nacht (gleiche Stelle, gleiche Kamera) |

## Messwerte

Endstand gegen den Ausgangsstand `e05d424` (Einzelheiten und alle
Prüfstände: `docs/MEGA-UPDATE-1.0.md`, Abschnitt 6.7):

| Messwert | `e05d424` | Endstand |
| --- | --- | --- |
| Zeichenaufrufe, Median über 300 Stellen (Grenze 899) | 864,5 | 870 |
| Zeichenaufrufe Straße / Dach / Luft | 794,5 / 791,5 / 896 | 799,5 / 796,5 / 904 |
| Dreiecke, Median | 3,69 Mio. | 3,69 Mio. |
| CPU je Schritt, freier Regisseur, Ton an (gepaart) | Median 7,47 ms · Mittel 7,42 | Median 7,72 ms (+3 %) · Mittel 8,23 (+11 %) – andere Ereignisfolge, mehr Gegner |
| CPU je Schritt ohne Ereignisse, Ton an (gepaart) | Median 5,62 ms · Mittel 5,66 | Median 5,81 ms (+3 %) · Mittel 6,14 (+8 %) |
| CPU je Schritt, gleicher Abschnitt ohne Ereignisse und Ton (Blockanalyse; Profil) | 5,18 ms | 5,54 ms (+7 %); Profil +4,2 %, kein einzelner neuer Brennpunkt (6.7) |
| Ladezeit bis zur ruhigen Szene (SwiftShader, Median aus 3) | 57,7 s | 59,4 s (M5: 61,0 s; Streuung je Stand bis 6,5 s) |
| JS-Speicher nach dem Laden / nach 3 min mit Ton | 63,7 / 68,6 MB | 63,9 / 68,2 MB |
| 30 Minuten mit Ton (`mega-last.js` b5) | – | 13/13: keine wachsenden Gegner, Ereignisse, Quellen, Objekte oder Speicher |
| Weltfingerabdruck (Häuser, 575 Parkautos, 45 Wagen, 88 Passanten) | `910b52f4` … | identisch |
| Story Akt 1 (`kernsysteme.js`) | 8/8 | 8/8 |
| Naht / Außenecke / Innenklettern / Foreign / Top-out / Brutal-Halle | 221/221/221 · 150/150 · 0/0/0/0 · 0 · 13/13 · 30/30 | gleich (zeilengleich) |
| Klang (`mega-klang.js`) | – | 36/36 |
| Integrationsbeispiele 1–5 (`mega-last.js`, `mega-fortschritt.js`) | – | 35/35, 30/30 |

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

**M6 – Klang, Fortschritt, HUD.** Mit Kopfhörern spielen (Richtung!).
Einstellung „Musik“: „Nur Stadtklang“ hört die Schichten am deutlichsten.
* Erst „Spielen“ klicken – vorher ist es still, danach Stadtklang.
* Straße: Verkehr, ab und zu eine Hupe; ein Wagen, der hinter einem
  Passanten bremst, hupt hörbar nur in der Nähe – und von links oder rechts.
* Auf ein Dach (25–30 m): der Verkehr wird leiser und dumpfer, ein heller
  Wind in Böen kommt dazu. Ganz oben (45 m+) noch mehr.
* Kai 7 oder Eckmarkt betreten: die Stadt draußen klingt wie durch eine
  geschlossene Tür, dazu Lüftung und leises Brummen; die eigenen Schritte
  und Schläge haben einen kurzen Zimmerhall.
* Nacht (die Tageszeit läuft, 15 min je Tag): ruhiger, seltener gehupt;
  im Park zirpen Grillen. Bei Regen: helles Rauschen, drinnen gedämpft.
* Einsatz: in der Nähe eines Überfalls hört man Schläge und Hilferufe
  (von der Seite, auf der es passiert), die Musik zieht leicht an. Nach
  dem Ende blendet das aus; Streifenwagen kommen mit Sirene.
* M stellt alles stumm und wieder an.
* P: oben „Als Nächstes“ (freie Punkte, nächster Auftrag, Nebenauftrag,
  nächster Meilenstein), weiter unten „Besondere Einsätze“ und die neuen
  Meilensteine. Fertigkeiten: „Sauberer Abschluss“ wirkt jetzt auch auf
  Wand- und Luft-Finisher, „Schwungkunst“ auf Bewegungsketten.
* HUD: läuft eine Mission und gleichzeitig ein Ereignis, zeigen Zieltext
  UND Leuchtturm (orange) die Mission. Ohne Mission: Ereignis mit
  Entfernung („· 120 m“) und rotem Leuchtturm. Nach einem gelösten
  Ereignis steht die Belohnung im Hinweis. Die Kombo steht unter der
  Minikarte, nicht mehr darauf.
* Während eines Nebenauftrags (Schatten I–III) lassen die Türen jetzt
  hinein; drinnen ruht der Auftrag („… ruht, solange du drinnen bist“),
  draußen geht es an der Tür weiter.
