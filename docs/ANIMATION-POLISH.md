# Animationen und Kamera – erster Verbesserungsdurchgang

Grundlage: `ae7297c0d83b42e78f75b6dda574f5c7a5f9c65a` auf
`claude/spider-man-game-dev-8cepen` (enthaelt bereits den Phase-12.1-Commit).

Die Aufnahme zeigt stehendes Ausrutschen, eine starre Flughaltung und
Kamera-Verdeckung an Fassaden. Dieser Durchgang bearbeitet die Darstellung.
Missionen, Story-Speicherformat, Checkpoints, Gegner, Boss, Progression,
Police/EMS, World Hygiene und die Bewegungsphysik werden nicht umgebaut.

## Was sich aendert

- Beim Auslaufen bleibt die passende Schrittbewegung aktiv. Zwei
  Geschwindigkeitsschwellen verhindern Flattern zwischen Lauf und Stand.
- Auch angehaltene Posen blenden von ihrem sichtbaren Gewicht aus.
  Das betrifft etwa Wandstillstand, Duckstand und gehaltene Endposen.
- Der Duckstand erreicht jetzt seine eigene Abspielregel. Zuvor hatte
  die allgemeine Gangregel Vorrang und spielte den Duckclip weiter ab.
- Der Held bekommt einen eigenen dreisekuendigen Gleitclip. Er ist aus
  der vorhandenen StraightDive-Pose abgeleitet und besitzt kleine,
  periodische Ausgleichsbewegungen auf dem vorhandenen Skelett.
- Die zusaetzliche Gleithaltung reagiert auf Tempo und Kurven. Auch
  Kopf und Rumpf beachten jetzt das Blendgewicht bis hinunter zu null.
- Die Kamera bleibt naeher an der Figur, zoomt weniger weit heraus und
  neigt sich im Schwung schwaecher. Gebaeude werden ueber einen exakten
  Streckentest gegen erweiterte Kollisionskaesten geprueft. Auch der
  Blickpunkt, die geglaettete Kameraposition und Kamera-Shake werden begrenzt.

Die vorhandene Kriechbewegung an der Wand wird in diesem Durchgang
beibehalten. Die Projektkommentare dokumentieren bereits misslungene
Versuche mit anderen Clips; ein Dateitausch ohne Sichtvergleich waere
kein belegter Fortschritt. Der korrigierte Posenuebergang gilt auch hier.

## Reproduzieren und pruefen

Voraussetzung: Node.js (keine neuen npm-Abhaengigkeiten).

```sh
node tools/create-glide-animation.cjs
node --check game.js
node --test tools/test-animation-polish.cjs
```

15 gezielte Tests bestanden. Die Tests laden die betroffenen Funktionen
direkt aus `game.js`, verwenden die mitgelieferte Three.js-Version r128
und fuer Figurenpruefungen die Knochenhierarchie aus `hero.glb` sowie
die echten Animationsspuren. Grafik, Texturen und Skinning werden dabei
nicht gerendert. Es handelt sich um Funktions- und Skelettpruefungen.

Geprueft: sichtbare Gewichte bei laufenden, pausierten und gehaltenen
Posen; ungestartete/gestoppte/deaktivierte/zukuenftige Aktionen;
Auslaufen; Duckstand und Weiterlaufen; reproduzierbarer Gleitclip mit
identischen Anfangs-/Endwerten und normierten Quaternionen;
ausgeblendete Gleitkorrekturen; Reaktion auf Kurven; schmale Hindernisse,
Rastergrenzen, Glaettung, Shake, Boden und Dach-Untergrenze der Kamera.

## Sichtpruefung vor Uebernahme

Mit einem lokalen HTTP-Server starten, beispielsweise:

```sh
python3 -m http.server 8080
```

Dann `http://localhost:8080` in einem Browser mit funktionierendem WebGL
oeffnen. Den bisherigen und den neuen Branch mit derselben kurzen
Strecke vergleichen:

1. Gehen, Laufen, Sprinten, jeweils die Richtungstaste loslassen.
   Schritte sollen mit dem verbleibenden Tempo auslaufen.
2. Geduckt stillstehen, loslaufen, wieder anhalten.
   Kein Weiterlaufen des Clips im Duckstand.
3. Gleiten: geradeaus, beide Kurvenrichtungen, Nase senken/heben,
   dann loslassen und anschwingen. Kopf und Schultern sollen weich folgen.
4. An der Wand stillhalten, weiterklettern und abspringen.
   Die gehaltene Pose soll beim Wechsel weich verschwinden.
5. Dicht an Fassaden, um Ecken und unter Vorspruengen schwingen.
   Die Kamera soll vor Hindernissen bleiben und danach ruhig herausfahren.
6. Auf einem Dach landen und die Kamera nach unten schwenken.
   Keine Kamera unter der Dach-Untergrenze.

Offen: vollstaendiger visueller Spieltest, GPU/FPS-Messung und der von
Phase 12.1 geforderte menschliche Act-1-Durchlauf. Der bisherige
Testbrowser konnte keinen WebGL-Kontext erzeugen. Die 15 Tests ersetzen
weder die Kampagnenregression noch deren Human-Play-Gate. Es wird keine
Aussage ueber die passende Kampagnenlaenge getroffen.

Der separate Branch wird vom bestehenden Pages-Workflow nicht automatisch
veroeffentlicht. Erst die gepruefte Uebernahme in den Spielbranch macht
diese Aenderungen im normalen Spiellink sichtbar.
