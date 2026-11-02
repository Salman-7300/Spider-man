# 06 – Abnahmebericht Blender Next Gen

Branch `art/blender-nextgen-prototypes`, ausgehend von `e05d424`. Keine Datei außerhalb von
`art/blender-nextgen/` wurde verändert; keine Produktionsdatei überschrieben; nichts gemergt.

## A. Blender-Verbindung
| | |
|---|---|
| Blender MCP | funktioniert (Blender Lab MCP, Add-on im Blender-Prozess) |
| Version | Blender 5.2.1 LTS, Python 3.13.13 |
| Python-Ausführung | bestätigt |
| Export / Re-Import | bestätigt (Testobjekt, alle drei Prototypen, beide Animationen) |
| GitHub-Dateizugriff | gleiches Dateisystem; Blender liest `assets/` und schreibt direkt in den Worktree |

Details: `01-verbindung-und-bestand.md`.

## B–D. Prototypen
| | Sedan | Enforcer | Web Hero |
|---|---|---|---|
| Bericht | `02-fahrzeug-urban-sedan.md` | `03-gegner-armored-enforcer.md` | `04-held-webhero-nextgen.md` |
| GLB | `exports/vehicle-urban-sedan-v1.glb` | `exports/enemy-armored-enforcer-v1.glb` | `exports/webhero-nextgen-v1.glb` |
| .blend | `source/vehicle-urban-sedan-v1.blend` | `source/enemy-armored-enforcer-v1.blend` | `source/webhero-nextgen-v1.blend` |
| Neue Animation | – | `animations/enemy-threat-taunt-v1.glb` | `animations/webhero-landing-pose-v1.glb` |
| Rig | – (4 benannte Räder, 2 Lenkpunkte, Sitzpunkt) | thug-Skelett unverändert (67 Gelenke) | hero-Skelett + Netz bytegleich |
| Animationen | Räder/Lenkung geprüft | 10 Spielclips + Taunt: 0 fehlende Knochen | 23 Spielclips + Landing: 0 fehlende Knochen |

## E. Performance (gemessen; Three.js r128, headless Chrome, WebGL 2)
| Asset | Dreiecke | Aufrufe | Materialien | Texturen (GPU inkl. Mips) | Datei | Ladezeit lokal |
|---|---|---|---|---|---|---|
| Spiel-Auto `createCar` | 1 936 | 9 | 4 | 0 | prozedural | – |
| **Sedan v1** | 17 400 | 16 | 8 | 0 | 0,36 MB | ~55 ms |
| `thug.glb` | 14 808 | 1 | 1 | 3 | 1,11 MB | – |
| **Enforcer v1** | 24 972 | 4 | 4 | 2 (~10,7 MB) | 2,49 MB | ~35–45 ms |
| `hero.glb` | 13 400 | 7 | 7 | 8 (~30,7 MB) | 2,17 MB | ~60 ms |
| **Web Hero v1** | 13 400 | 7 | 7 | 8 (~30,7 MB) | 2,60 MB | ~55–70 ms |

Mehrere Wagen (alle im Bild, isolierte Szene): 80 neue Sedans = 1 628 Aufrufe / 1,82 M Dreiecke / 4,3 ms
Zeichenzeit gegenüber 794 / 174 k / 2,0 ms beim Spiel-Auto. **Nicht flächendeckend freigegeben**;
Empfehlung: nur die nächsten 6–8 Wagen (wie `AUTO_FAHRER_MAX`) oder eine LOD-Stufe.
Animationskosten: unverändert (gleiche Knochenzahl, 22 Rotationsspuren je Clip).

## F. Abnahme
- Galerie aller Bilder und Videos, gekennzeichnet nach Blender / Three.js / gestellt: `preview/gallery.html`
- Interaktiver Viewer (alt/neu/Vergleich, Clipwahl, Lack, Licht Tag/Nacht/Studio, Stadt/neutral, Drehen/Abstand): `preview/index.html`
- Videos: `renders/videos/sedan-threejs-drive.mp4`, `enemy-threejs-compare.mp4`, `hero-threejs-compare.mp4`
- Kompatibilitätstest: `node art/blender-nextgen/tools/compat-test.cjs` → 12/12

Alle Bilder sind Blender-Renderings oder Three.js-Aufnahmen gestellter Testszenen.
**Keine Aufnahme stammt aus dem laufenden Spiel**; die Prototypen sind absichtlich nicht eingebaut.

### Offene Probleme
1. Sedan: Front- und Heckpartie wirken noch rundlich. Er liegt 1 400 Dreiecke über dem Budget. Er ist nicht für 80 Exemplare gleichzeitig geeignet.
2. Enforcer: Beim hohen Tritt wird die Weste an der Hüfte etwas gestaucht. Durch die Mütze skaliert die Spiel-Normierung die Figur um ~3 % kleiner.
3. Web Hero: Es gibt kein neues Körpermesh (bewusst – Kompatibilität per Konstruktion). Proportionen und Grundsilhouette sind die des bisherigen Modells. Die Faust in der Landung erreicht den Boden nicht ganz.
4. Die Animationen sind im Viewer mit nachgebauter Spiel-Behandlung geprüft, nicht im echten `game.js`.

## G. GitHub
Siehe Commit-Liste im Branch (`git log e05d424..`), sechs Commits wie vorgegeben.
Die übliche Commit-Kennung steht in der Abschlussnachricht.
