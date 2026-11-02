# CITY SWING – Blender Next Gen (Prototypen)

Drei Prototypen, getrennt vom Spiel. Nichts davon ist in `game.js` eingebunden, und keine
Datei in `assets/` wurde verändert. Übernahme nur nach Freigabe, einzeln.

| Asset | Export | Bericht |
|---|---|---|
| Urban Premium Sedan | `exports/vehicle-urban-sedan-v1.glb` | `reports/02-fahrzeug-urban-sedan.md` |
| Armored Street Enforcer | `exports/enemy-armored-enforcer-v1.glb` + `animations/enemy-threat-taunt-v1.glb` | `reports/03-gegner-armored-enforcer.md` |
| Web Hero Next-Gen | `exports/webhero-nextgen-v1.glb` + `animations/webhero-landing-pose-v1.glb` | `reports/04-held-webhero-nextgen.md` |

Gesamtergebnis: `reports/06-abnahmebericht.md`.

## Ansehen

Der Viewer braucht einen lokalen Webserver, weil GLB-Dateien nicht über `file://` laden. Dafür im Repo-Wurzelordner starten:

```bash
python -m http.server 8000
```

Dann `http://localhost:8000/art/blender-nextgen/preview/index.html` (Viewer) oder
`.../preview/gallery.html` (alle Bilder und Videos) öffnen.

## Ordner

- `source/` – Blender-Dateien (`*.blend`) und alle Erzeugungsskripte (reproduzierbar, per `exec` in Blender 5.2)
- `exports/` – GLB-Prototypen
- `animations/` – neue Animationsprototypen (nur Rotationen, 30 fps)
- `renders/` – Blender-Renderings (`sedan/`, `enforcer/`, `hero/`), Three.js-Aufnahmen (`threejs/`), Videos (`videos/`)
- `reports/` – Berichte und Messdaten (JSON)
- `preview/` – isolierter Three.js-r128-Viewer und Galerie
- `tools/` – Rig-Audit, Kompatibilitätstest, headless-Aufnahme (`cdp-capture.cjs` + `plan-*.cjs`)
- `_conntest/` – Verbindungstest (Würfel `.blend`/GLB)

## Neu erzeugen

| Schritt | Wo | Befehl |
|---|---|---|
| Sedan | Blender | `exec(open(r"...\source\accept_sedan.py").read())` |
| Enforcer-Textur | System-Python mit Pillow | `python art/blender-nextgen/source/enforcer_texture.py` |
| Enforcer | Blender | `accept_enforcer.py` |
| Held (Textur + GLB) | System-Python mit numpy und Pillow | `python art/blender-nextgen/source/hero_suit.py` |
| Held (Abnahme) | Blender | `accept_hero.py` |
| Browser-Aufnahmen | Node 24 und Chrome | `node art/blender-nextgen/tools/cdp-capture.cjs art/blender-nextgen/tools/plan-sedan.cjs`, `ASSET=enemy` bzw. `ASSET=hero` mit `plan-character.cjs` |
| Kompatibilität | Node | `node art/blender-nextgen/tools/compat-test.cjs` |

Für die Browser-Aufnahmen kommen die Videos aus `source/make_video.py` (Blender-Sequenzer). Bildfolgen werden nicht eingecheckt.
