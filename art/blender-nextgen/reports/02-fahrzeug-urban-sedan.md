# 02 – Urban Premium Sedan v1

Quellen: `source/build_sedan.py` (prozedural, reproduzierbar), `source/accept_sedan.py`
(Gates, Renderings, Export), Messdaten `sedan-blender.json`, `sedan-threejs.json`.

## Design

Eigenständige viertürige Limousine: lange Haube, Windlauf, schwarze A-Säulen,
lackierte breite C-Säule (Fastback-Ansatz), Kotflügelschultern über beiden Achsen,
vier Türen mit Fugen, bündige Türgriffe, Außenspiegel, schmale LED-Scheinwerfer,
breiter Lamellengrill mit Chromleiste, Lufteinlass, leere Kennzeichenflächen,
Rückleuchten plus Lichtband, Diffusorblende, Seitenschweller.
Innen: zwei Einzelsitze mit Kopfstützen, Rückbank, Mittelkonsole, Armaturenbrett,
Instrumententräger, Mittelbildschirm, Lenkrad mit Säule.

## Maße (gemessen, exportiertes Modell)

| | Neu | bisheriges `createCar` (Spiel) |
|---|---|---|
| Länge | 4,74 m | 4,58 m (Lichter bei z ±2,29) |
| Breite Karosserie / mit Spiegeln | 1,87 m / 2,07 m | ~1,91 m |
| Höhe | 1,50 m | 1,98 m (Dach für aufrecht sitzenden Fahrer) |
| Radstand / Spur (Radmitte) | 2,82 m / 1,59 m | 2,72 m / 1,86 m |
| Radradius | 0,335 m | 0,35 m |
| Kollisionshülle (Extras) | halfWidth 0,94, halfLength 2,37, roof 1,50 | 1,09 / 2,32 / 1,98 |

Die Längen-/Breitenwerte passen in die bestehenden Spuren (`FAHRZEUGE`: pkw 4,4 × 1,9,
polizei 4,6 × 2,0). Für eine Übernahme müsste `typ.laenge` dieses Modells 4,74 betragen.

## Räder

Hierarchie: `UrbanSedan_v1` → `Steer_FL|FR|RL|RR` (Leer-Objekt in der Nabe) → `Wheel_*` (Mesh, Ursprung = Nabe).
Gleiche Konvention wie `city-visuals.js updateCar`: Rollen = `Wheel_*.rotation.x`, Lenken = `Steer_F*.rotation.y`.
Links und rechts eigene Mesh-Daten (gespiegelt, nicht negativ skaliert); Felge zeigt jeweils nach außen.

Three.js-Prüfung (`T.wheelCheck`, exportiertes GLB):

| Fall | Ergebnis |
|---|---|
| Stillstand | rollX 0, Lenkung 0 |
| Vorwärts (8 m/s) | alle vier rollX +, Rollachse Welt (1,0,0) – keine Seit- oder Fehlachse |
| Rückwärts | rollX negativ |
| Links / rechts | nur Vorderräder: steerY ±0,42 rad, Rollachse dreht mit (0,913 / 0 / ∓0,408); Hinterräder bleiben 0 |

## Fahrerposition

`DriverSeat`-Punkt (Hüfte): x −0,44 (Spielkonvention), y 0,45, z −0,06.
Echte Spielfigur (`civilian.glb` + `civilian@sit`, Positions- und Fingerspuren
entfernt wie im Spiel) im Three.js-Viewer auf den Sitz gesetzt und gemessen:

| | Neu | bisher |
|---|---|---|
| Scheitel der Figur | 1,424 m | 1,934 m |
| Dach über dem Kopf | 1,474 m | 1,980 m |
| Kopffreiheit | **5,0 cm** | 4,6 cm |

Erster Export hatte die Hüfte auf 0,56 m – der Kopf ragte 4,7 cm durchs Dach.
Korrigiert durch tiefere Sitze/Boden und Dach +1,5 cm. Die Sitzpose des Spiels ist
aufrecht (~0,98 m Hüfte–Scheitel); deshalb sitzt die Hüfte tiefer als bei einem
realen Auto. Hinweis: Mit `civilian@sit` hebt die Figur in der Clip-Mitte einen Arm –
im Spiel setzt `poseSitzen` die Arme; das ist nicht Teil dieses Prototyps.

## Materialien und Varianten

8 Materialien, **keine Texturen** (0 MB Texturspeicher): Lack, Schwarz glänzend,
Dunkel matt (Reifen/Unterboden), Metall, Glas (transparent, doppelseitig),
Scheinwerfer (emissiv), Rückleuchten (emissiv, eigenes Material = Bremslicht schaltbar), Innenraum.

Lackvarianten ohne Modellkopie: nur `Sedan_Paint.color` wird gesetzt
(graphit, weiß, schwarz, silber, dunkelblau, gedecktes rot – Werte in den
GLB-Extras `citySwing.paintVariants`; Bilder `renders/threejs/sedan/paint_*.jpg`).

**Befund aus dem Browser-Test:** Der erste Export (Lack Metallic 0,55, Felgen
Metallic 1,0) war unter Spiel-Licht fast schwarz – das Spiel hat keine
Umgebungskarte. Korrigiert auf Lack Metallic 0,12 + Klarlack, Metall 0,45.

## Kosten

| | Neu | bisher |
|---|---|---|
| Dreiecke | 17 400 (Karosserie 10 744 + 4 × 1 664 Rad) | 1 936 |
| Zeichenaufrufe je Wagen | 16 (Karosserie 8 Primitive + 4 × 2) | 9 |
| Materialien / Texturen | 8 / 0 | 4 / 0 |
| GLB | 361 KB | – (prozedural) |
| Ladezeit GLB (lokal) | ~55 ms | – |

Budget 8 000–16 000: knapp überschritten (+1 400). Die Räder sind sichtbar
(Doppelspeichen, Reifenflanke) und machen 38 % aus; eine LOD-Stufe ohne Bremsscheibe
und mit 16 Segmenten wäre der erste Hebel.

### Mehrfach-Szene (isolierter Test, headless Chrome, WebGL 2, alle Wagen im Bild)

| Exemplare | bisher: Aufrufe / Dreiecke / Median | neu: Aufrufe / Dreiecke / Median |
|---|---|---|
| 1 | 10 / 1,9 k / 0,2 ms | 17 / 17,4 k / 0,2 ms |
| 20 | 181 / 39 k / 0,7 ms | 321 / 348 k / 1,2 ms |
| 80 | 794 / 174 k / 2,0 ms | 1 628 / 1,82 M / 4,3 ms |

Die Zeiten sind reine Zeichenzeit dieses Rechners (Desktop-GPU) und kein
Spielbeweis. **80 neue Wagen gleichzeitig sind nicht freigegeben:** doppelte
Aufrufe, zehnfache Dreiecke. Empfehlung: neues Modell nur für die nächsten
~6–8 Wagen (wie die Fahrer-Regel `AUTO_FAHRER_MAX = 8`), weiter weg das bisherige
Modell oder eine zusammengeführte LOD-Version.

## Gates

Blender: keine NaN-Ecken, keine negative Skalierung, keine Nullflächen,
`mesh.validate()` ohne Fehler. Offene Kanten sind beabsichtigt (aufgesetzte
Fugen, Leuchten, Grillflächen, Reifeninnenseite) – kein geschlossener Körper
wird dadurch undicht. Export/Re-Import: 11 Objekte, Positionen aller Räder,
Lenkpunkte und des Sitzpunkts identisch (Abweichung 0).

## Bilder / Video

- Blender (EEVEE, gestellte Studioszene): `renders/sedan/01…11`
- Three.js r128 (exportiertes GLB, gestellte Testszene, Spiel-Licht): `renders/threejs/sedan/*`
- Video (Three.js, Fahrt mit Lenkwechsel und Rückwärtsrollen): `renders/videos/sedan-threejs-drive.mp4`

## Offene Punkte

- Front- und Heckpartie sind die schwächste Stelle: die Superellipsen-Enden wirken
  rundlich („Seifenstück“). Ein Versuch, Front/Heck nach oben zurückzuneigen, erzeugte
  Dellen und wurde zurückgenommen (zweite Korrekturrunde erreicht).
- Kein Ingame-Test: das Modell ist nicht ins Spiel eingebaut (bewusst).
