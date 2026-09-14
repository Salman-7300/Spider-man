# Pilot: Bewegungen ueber Meshy (Higgsfield) beziehen

Zweck dieses Ordners: pruefen, ob sich fertige Bewegungsclips aus der
Meshy-Bibliothek (678 Aktionen, ueber das Higgsfield-Werkzeug
`animation_actions` durchsuchbar) auf das Skelett dieses Spiels bringen
lassen.

## Was gemessen ist

- Das Modell `3d_rigging` nimmt eine oeffentlich erreichbare GLB-URL,
  riggt sie selbst und legt optional einen Clip darauf
  (`enable_animation` + `animation_action_id`).
- Kosten laut Vorabpruefung: **8 Credits je Clip.**
- Die Dateien dieses Projekts sind ueber raw.githubusercontent.com
  erreichbar (HTTP 200 geprueft).
- **Mit `assets/hero.glb` schlaegt der Auftrag fehl.** Die Datei bringt
  bereits ein Skelett mit; ein Auto-Rigger erwartet ein statisches Netz.

## hero-ohne-skelett.glb

Deshalb liegt hier dieselbe Figur ohne Skelett: `tools/entrigge.mjs`
entfernt die JOINTS/WEIGHTS-Attribute, die Skins und die Animationen.
Die Geometrie steht bereits in der Bindepose, es faellt also nur die
Zuordnung zum Skelett weg - die Form bleibt unveraendert.

## Was danach noch fehlt

Meshy riggt mit SEINEM Skelett, nicht mit unserem (mixamorig). Nutzbar
ist deshalb nur die BEWEGUNG, und die muss ueber `tools/retarget-ue4.mjs`
auf unser Skelett umgerechnet werden - dasselbe Verfahren wie bei den
UE4-Bewegungen. Ob das traegt, entscheidet sich an den Knochennamen und
der Ruhehaltung des Meshy-Skeletts.
