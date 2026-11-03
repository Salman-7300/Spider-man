# Teil 3: Lohnt sich Higgsfield für das Wandklettern?

Phase 13, Teil 3. Die Frage war, ob die Kletterbewegungen des Spiels
durch Material aus dem Higgsfield/Meshy-Katalog besser würden. Antwort:
**nein – und zwar aus drei unabhängigen Gründen, von denen jeder allein
schon reicht.**

## 1. Das Guthaben reicht nicht für einen einzigen Clip

Abgefragt, nicht geschätzt:

    Guthaben:  5,76 Credits      Plan: plus

Ein geriggter Clip kostet laut der Vorabprüfung in
`experiments/animation-pilot/README.md` **8 Credits**. Es ist also nicht
knapp, sondern schlicht nicht bezahlbar – auch nicht einmal.

## 2. Der Katalog hat weniger, nicht mehr

Der Katalog ist lesbar, ohne dass etwas kostet. Suche nach „climb":
**25 Treffer.** Davon sind für eine Hausfassade brauchbar:

| Aktion | was es ist |
|---|---|
| `climbing_up_wall` (444) | Wand hinauf |
| `climbing_down_wall` (497) | Wand hinunter |
| `Climb_Left_with_Both_Limbs` (439/619) | seitwärts links |
| `Climb_Right_with_Both_Limbs` (440/620) | seitwärts rechts |
| `diagonal_wall_run` (445) | Wandlauf schräg |
| `Jump_and_Grab_Wall` (448) | Ansprung an die Wand |
| `Quad_Climb_Right` (475) | auf allen vieren |

Der große Rest ist Leiter, Treppe, Seil und „Climb_Attempt_and_Fall".

Das Spiel hat dagegen **26 eigene Wand- und Kletterbewegungen**:

    klettern  klettern_frei  klettern_seit  climb  wandruhe
    wandkriech_v  wandkriech_h  wandkriech_l  wandkriech_r
    wandkriech_vl wandkriech_vr wandkriech_hl wandkriech_hr
    wandlauf  wandsprung  kante  haengen  haengen_frei

Allein das Wandkriechen deckt **acht Richtungen** ab – der Katalog kennt
in dieser Kategorie zwei. Es gibt dort also nichts, was hier fehlt.

## 3. Der Weg dahin ist lang und endet am Rig-Lock

Meshy riggt mit **seinem eigenen** Skelett, nicht mit `mixamorig`.
Brauchbar wäre nur die Bewegung, und die müsste über
`tools/retarget-ue4.mjs` umgerechnet werden – derselbe Weg wie bei den
UE4-Bewegungen, bei dem laut `ANIMATION-QUELLEN.md` genau die verbogenen
Beine entstehen. Und der ABSOLUTE HERO-RIG LOCK verbietet ohnehin, das
Skelett des Helden anzurühren.

## Und wie gut ist das Vorhandene?

Gemessen in Teil 4 und 5 dieser Phase, nicht behauptet:

- **Wandkriechen:** alle acht Richtungen tragen (5,35 bis 9,19 m in
  2,5 s), keine bleibt hängen, Hände liegen im Mittel 0,11 m vor der
  Fassade, Füße 0,20 m, kein Glied steckt im Haus.
- **Wandlauf:** 14 von 14 Anläufen greifen, 25 bis 38 m Höhe, die
  Fußsohlen stehen im Mittel 0,087 m vor der Wand.

Es gibt also auch keinen Mangel, den man beheben müsste.

## Ergebnis

Kein Auftrag, kein Credit ausgegeben, nichts geändert. Falls später
einmal Guthaben da ist: die vier Aktionen 444, 497, 439 und 440 wären die
einzigen, bei denen sich ein Blick lohnt – und auch dann erst nach einem
Vergleich mit `tools/anim-vergleich.mjs` gegen die vorhandenen Dateien,
so wie in `ANIMATION-QUELLEN.md` beschrieben.
