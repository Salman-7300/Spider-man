# 🕸️ WEB HERO – Die Stadt braucht dich!

Ein Open-World-Action-Spiel im Browser, inspiriert von den großen
Netzschwinger-Spielen: Schwinge dich durch die Straßenschluchten einer
Großstadt, klettere an Wolkenkratzern hoch, stoppe Gangs und rette Zivilisten.

Komplett in **JavaScript + Three.js** – keine Installation nötig.

![Genre](https://img.shields.io/badge/Genre-Open--World--Action-red)
![Engine](https://img.shields.io/badge/Engine-Three.js-blue)
![Sprache](https://img.shields.io/badge/Sprache-Deutsch-yellow)

## ▶️ Spiel starten (kein Python, keine Installation nötig)

1. Auf GitHub oben den grünen Button **„Code“ → „Download ZIP“** klicken
   (dabei oben links den richtigen Branch auswählen, falls das Spiel noch
   nicht auf `main` liegt)
2. Die ZIP-Datei **komplett entpacken** (Rechtsklick → „Alle extrahieren…“)
3. Im entpackten Ordner **`index.html` doppelklicken** – das Spiel öffnet
   sich im Browser. Fertig! 🎉

Das Spiel läuft **komplett offline** – die 3D-Bibliothek Three.js liegt im
Ordner `lib/` bei. Wichtig ist nur, dass `index.html`, `game.js` und der
`lib`-Ordner zusammen in einem Ordner bleiben.

Empfohlen: Chrome, Edge oder Firefox am Desktop (Maus + Tastatur nötig).
Im Startbildschirm einmal klicken, damit das Spiel die Maus übernehmen darf.

## 🌐 Online spielen (GitHub Pages)

Das Spiel wird bei jedem Push **automatisch** über GitHub Actions auf
GitHub Pages veröffentlicht (Workflow: `.github/workflows/deploy-pages.yml`).

**▶️ Spiel-Link: https://salman-7300.github.io/Spider-man/**

Auf der Webseite werden zusätzlich die 3D-Menschenmodelle aus dem
`assets/`-Ordner geladen (siehe unten).

## 🧍 Echte 3D-Menschen-Charaktere (GLB-Modelle)

Das Spiel unterstützt geriggte 3D-Menschenmodelle im **GLB-Format** – ein
animiertes Beispielmodell für die Gegner (`assets/thug.glb`, Mixamo-Charakter
aus den offiziellen Three.js-Beispielen) liegt schon bei.

**Mixamo-Dateien sind zu groß für GitHub (>25 MB)?** Kein Problem: Hänge
einfach **alle** FBX-Dateien an ein **GitHub-Release** an (erlaubt bis 2 GB) –
ohne Sortieren, ohne Umbenennen. Der Workflow `convert-models.yml` erkennt
selbst, welche Datei ein Modell und welche eine Animation ist, wandelt alles
in kleine GLB-Dateien um und veröffentlicht sie aufs Spiel. Die komplette
Anleitung steht in [`assets/README.md`](assets/README.md).

Umwandeln geht auch lokal:

```bash
npm install --prefix tools
node tools/convert-mixamo.mjs tools/input assets
```

Fehlt ein Modell, verwendet das Spiel automatisch die eingebauten Figuren.
Hinweis: GLB-Modelle laden nur über http(s) (Webseite oder lokaler Server) –
beim Offline-Start per Doppelklick erscheinen die eingebauten Figuren.

## 🎮 Steuerung

| Taste | Aktion |
|---|---|
| **W A S D** | Laufen / an der Wand klettern |
| **Maus** | Kamera |
| **Shift** | Sprinten |
| **Leertaste** | Springen (2× drücken = Doppelsprung) |
| **Leertaste halten** (in der Luft) | 🕸️ **Netzschwung** |
| **Rechte Maustaste halten** | Netzschwung (alternativ) |
| **Linksklick** | Schlag-Kombo (jeder 4. Treffer ist ein Finisher) |
| **F** | Tritt (mehr Schaden, mehr Rückstoß) |
| **Q** | **Netzschuss** – wickelt einen Gegner ein (doppelter Schaden auf eingewickelte Gegner!) |
| **E** | **Netz-Zip** – zieht dich nach vorn/oben; zielt ein Gegner im Fadenkreuz: fliegender **Netz-Angriff** |
| **Strg** | Ausweichrolle (kurz unverwundbar) |
| **Wand berühren** (in der Luft) | automatisch klettern · Leertaste = Wandabsprung · oben angekommen: aufs Dach ziehen |
| **H** | Hilfe ein/aus |
| **M** | Ton ein/aus |
| **R** | zurück zum Startpunkt |
| **Esc** | Pause |

**Tipp für flüssiges Schwingen:** Beim Schwingen `W` gedrückt halten, um
Schwung aufzubauen, und am tiefsten Punkt die Leertaste loslassen – das gibt
einen Geschwindigkeits-Boost. Mit `E` (Netz-Zip) kommst du schnell wieder
nach oben.

## 🌆 Was steckt drin?

- **Flüssiges Kampfsystem**: Schlag-Kombos mit Kombozähler, Tritte, Finisher,
  Zielmagnetismus, Ausweichrolle mit Unverwundbarkeits-Fenster, Hitstop und
  Kameraeffekte
- **Netzschwung** mit echter Pendelphysik (Seil-Constraint), Netz-Zip und
  Netzschuss zum Einwickeln von Gegnern
- **Klettern** an jedem Gebäude – bis aufs Dach, mit Wandabsprung
- **Gegner-Gangs**, die durch die Stadt ziehen, Zivilisten überfallen und sich
  gegenseitig zur Hilfe rufen – regelmäßige 🚨 **Überfall-Events** mit
  Leuchtmarkierung und Bonuspunkten
- **Zivilisten**, die auf den Gehwegen unterwegs sind, vor Gefahr fliehen und
  gerettet werden können (Punkte!)
- **Fahrender Verkehr** – und ja: du kannst **auf den Autos mitfahren**
- **Großstadt** mit 49 Häuserblöcken, Wolkenkratzern, Wassertürmen,
  Straßenlampen, **Fluss samt Hängebrücke** und Skyline am anderen Ufer
- Punkte, Rekord (wird lokal gespeichert), Lebensanzeige mit Regeneration,
  Soundeffekte (WebAudio)

## 🛠️ Technik

- [Three.js](https://threejs.org/) (r128) für 3D-Rendering, Schatten, Nebel
- Eigene Spielphysik: Schwerkraft, Kollision mit Gebäuden/Dächern/Autos,
  Seil-Pendel für den Netzschwung
- Prozedural generierte Stadt und Charaktere (keine externen Assets,
  Texturen werden zur Laufzeit auf Canvas gezeichnet)
- Alles in zwei Dateien: `index.html` (UI) und `game.js` (Spiel)

## ⚖️ Hinweis

Dies ist ein nicht-kommerzielles Fan-Projekt mit einem **eigenen Netz-Helden**
im klassischen Rot-Blau-Look. Es werden keine offiziellen Namen, Logos oder
Assets von Marvel/Sony verwendet.
