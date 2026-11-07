# Übernahme: Armored Street Enforcer → Mega-Update

Stand: vorbereitet und im echten Spiel getestet, **nicht** in den Mega-Update-Branch eingespielt.
Die Übernahme erfolgt erst nach Freigabe, aus der Mega-Update-Sitzung heraus.

## Was übernommen wird

| Datei | Aktion |
|---|---|
| `art/blender-nextgen/exports/enemy-armored-enforcer-v1.glb` | kopieren nach **`assets/enforcer.glb`** (neue Datei, nichts wird überschrieben). SHA-256 `f4e5d6014a5b58f11dbb87fc4430e3f66be7a396077acf2e070fa99ff26c2a0f` |
| `art/blender-nextgen/adoption/enforcer-game.patch` | auf `game.js` anwenden: 8 Zeilen dazu, 1 Zeile geändert |

```bash
cp art/blender-nextgen/exports/enemy-armored-enforcer-v1.glb assets/enforcer.glb
```

```bash
git apply art/blender-nextgen/adoption/enforcer-game.patch
```

Am 7.11. auf dem Mega-Update-Stand **`f4f2b2b`** (`mega-1.0 m6`) mit `git apply --check`
geprüft: alle drei Teile passen (versetzt um 293/393 Zeilen). An dem Branch wurde nichts verändert.

## Was der Patch tut

1. `GLB_SLOTS.enforcer = 'assets/enforcer.glb'`: Das Modell wird beim Start mitgeladen.
2. Die Rolle **`brecher`** (schwerer Gegner: HP 62, Größe 1,22, standfest) bekommt `model: 'enforcer'`.
   Das ist derselbe Weg, den `duellant` (civilian4) und `stuermer` (civilian5) schon gehen:
   Körper aus dem eigenen Modell, Bewegungen aus `thug` (`makeCharacterVisual`, `cfg.model`).
3. `dressEnemy` hängt beim Enforcer **keine** zweite Rollenausrüstung an den Brustknochen,
   denn die Ausrüstung steckt im Modell. Umgesetzt ist das über einen Platzhalter `v.cityGear = { geometry: null }`;
   `city-visuals.js` bleibt unverändert.

Keine Änderung an KI, Kampfwerten, Missionen oder anderen Rollen.

## Ingame-Test (echtes `game.js`, Wegwerf-Worktree, headless Chrome)

`tools/plan-game-enforcer.cjs`, Ergebnis in `renders/ingame/enforcer/ingame-test.json`:

| Prüfung | Ergebnis |
|---|---|
| Modell geladen | `glbModels.enforcer` vorhanden, Spielmaßstab 0,972 |
| Zuordnung | Alle `brecher` sind Enforcer: 3 von 18 Gegnern in einer Gang-Runde; alle anderen Rollen unverändert |
| Bewegungen | `thug`-Clips (44) laufen über die Spiel-KI; Bilder `kampf_*.jpg` zeigen Laufen/Angriff auf den Helden |
| Doppelte Ausrüstung | keine (`EnemyRoleGear` = 0) |
| Fremde Haut | keine (`setzeGegnerHaut` lässt das Enforcer-Material in Ruhe) |
| Konsole | keine Fehler; nur die bekannten Shader-Warnungen der Stadt |
| Kosten je Enforcer | 25 004 Dreiecke, 7 sichtbare Meshes inkl. Lebensbalken und Zeichen |

Die Bilder sind **echte Spielbilder aus einer Testsituation**: Gangs wurden per `__dbg.spawnGang` neben den Helden gesetzt,
die Kamera stammt aus `__dbg.aufnahme`. Bei Nacht erscheinen der Enforcer und der Held halbtransparent
hinter dem Haltestellendach. Das ist die vorhandene Verdeckungs-Silhouette des Spiels, kein Modellfehler.

## Bekannte Punkte

- **Rollenwechsel nach dem Bau** (`evSetzeRollen`, `stArt`): Der Körper bleibt, wie er gebaut wurde.
  Ein als `brecher` gebauter Enforcer, der später zu `flink` wird, behält die Enforcer-Optik,
  bekommt aber die kleinere Größe. Umgekehrt bleibt ein thug, der später `brecher` wird, ein thug
  (mit der bisherigen rostbraunen Haut). Das gilt heute schon genauso für `duellant` und `stuermer`.
- **Ladekosten:** +2,49 MB beim Start (eine Datei). Texturspeicher je Modell ~10,7 MB, für alle Enforcer geteilt.
- **Fehlt die Datei**, fällt das Spiel auf den thug zurück (Bedingung `glbModels[cfg.model]`).
  Dann fehlt allerdings auch die rostbraune Brecher-Haut, weil `v.modell` = `enforcer` bleibt.
- **Größe:** Wegen der Mütze normiert das Spiel den Enforcer ~3 % kleiner als den thug.
- **Threat Taunt** (`animations/enemy-threat-taunt-v1.glb`) ist bewusst **nicht** Teil dieser Übernahme.
  Er bräuchte einen eigenen Clipnamen und einen Auslöser in der Gegner-KI. Das wäre ein eigener, kleiner Schritt.

## Rückbau

Patch rückwärts anwenden (`git apply -R …`) und `assets/enforcer.glb` löschen.
