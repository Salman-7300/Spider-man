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

## 🌐 Online spielen (GitHub Pages, kostenlos)

Das Spiel kann direkt über GitHub gehostet werden – dann reicht ein Link:

1. Auf GitHub im Repository auf **Settings → Pages** gehen
2. Bei **Source**: „Deploy from a branch“ wählen
3. Als Branch den Spiel-Branch (oder `main`) und Ordner **`/ (root)`** wählen → **Save**
4. Nach 1–2 Minuten ist das Spiel erreichbar unter:
   `https://salman-7300.github.io/Spider-man/`

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
