/* WEB HERO: eigenstaendige Missions-Innenraeume.

   Geometrie und Kollisionskaesten, sonst nichts. Kein Spielzustand, kein
   Zugriff auf game.js - dieselbe Offline-Bauweise wie city-visuals.js.

   WARUM ES DIESE DATEI GIBT
   Mission 6 spielte zuletzt im normalen Hausinnenraum der Open World. Der
   Human-Playtest hat das verworfen: dort stehen Tische, Stuehle und eine
   Bar, es sitzen unbeteiligte Zivilisten mitten im Kampf, sichtbare Moebel
   hatten teilweise keine Kollision, der Boden flackerte, und die Figur
   stand gelegentlich ploetzlich wieder neben dem Haus. Der Innenraum und
   die Open-World-Geometrie haben gegeneinander gearbeitet.

   Statt weitere Sonderfaelle ueber groundY, Moebel, Hausboden und
   Fassadenkollision zu legen, bekommt die Mission einen eigenen,
   kontrollierten Kampfraum. Er muss geometrisch NICHT in das Aussenhaus
   passen: er stellt denselben Ort spielerisch dar, ist technisch aber ein
   getrennter Bereich.

   KOORDINATEN
   Gebaut wird um einen Ursprung herum, der von aussen uebergeben wird.
   Alle zurueckgegebenen Punkte und Kollisionskaesten stehen in
   WELTkoordinaten - der Aufrufer muss nichts umrechnen.

   EIN BODEN, EINE EBENE
   Der Fussboden liegt exakt auf der Hoehe des Ursprungs. Es gibt genau
   eine sichtbare Bodenflaeche und genau eine physikalische Bodenhoehe.
   Bodenmarkierungen liegen zwei Zentimeter darueber UND benutzen
   polygonOffset - der Playtest hat Flackern gemeldet, und coplanare
   Flaechen sind dessen haeufigste Ursache. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.WEB_HERO_INTERIORS = factory(root.THREE);
})(typeof window === 'object' ? window : this, function (THREE) {
  'use strict';

  /* ---- Masse des Gang-Verstecks ----
     ZWEITER HUMAN-PLAYTEST: "Innen sieht gut aus, ist aber deutlich zu
     klein" und "die Kamera ist an der linken Wand viel zu nah dran".
     Die frueheren 30 x 22 m waren an der Kameradistanz gerechnet
     (INNEN_KAM_DIST = 4,6 m, gemessen in game.js) - das war die
     Untergrenze, nicht ein gutes Mass. Gerechnet wird jetzt anders
     herum:

       Kamera 4,6 m hinter der Figur, und sie soll beim Blick quer durch
       eine Zone NICHT in die Rueckwand geraten. Damit die
       Ausweichsuche (siehe innenKamera in game.js) ueberhaupt
       Alternativen hat, braucht jede Zone in ihrer kurzen Richtung
       mindestens 3 x 4,6 m = 13,8 m.

       Laufwege: der Weg vom Eingang zum Hinterausgang ist jetzt 38 m
       lang und fuehrt durch vier Zonen. Bei 5,5 m/s Laufgeschwindigkeit
       sind das rund 7 s reines Gehen - ohne Kampf. Vorher waren es 26 m
       und 4,7 s.

     42 x 30 m, Deckenhoehe 6,0 m. Das ist keine zweite Stadt: es ist
     eine Lagerhalle mit sechs lesbaren Zonen statt zehn kleinen
     Zimmern. */
  const M = {
    laenge: 42,          // x
    breite: 30,          // z
    hoehe: 6.0,
    wand: 0.6,           // Wandstaerke
    trennwand: 0.5,
  };

  const materialien = () => ({
    /* Sichtbeton, matt. Lambert reicht - der Raum hat kein Sonnenlicht,
       das sich in Lack spiegeln koennte. */
    beton: new THREE.MeshLambertMaterial({ color: 0x4a4b50 }),
    wand: new THREE.MeshLambertMaterial({ color: 0x33343a }),
    stahl: new THREE.MeshPhongMaterial({ color: 0x70757e, shininess: 38, specular: 0x2a2d33 }),
    holz: new THREE.MeshLambertMaterial({ color: 0x6d5137 }),
    /* Zweiter Holzton fuer Paletten - ein einziger Braunton auf Kisten,
       Paletten und Werkbaenken las sich im Bild als eine grosse Flaeche. */
    palette: new THREE.MeshLambertMaterial({ color: 0x8a6a46 }),
    metall: new THREE.MeshLambertMaterial({ color: 0x4c5057 }),
    /* Container: kraeftiger als das uebrige Grau, damit die Lagerzone
       sich von der Haupthalle unterscheidet. */
    container: new THREE.MeshLambertMaterial({ color: 0x3f5d63 }),
    rost: new THREE.MeshLambertMaterial({ color: 0x7a4b33 }),
    /* Kabel, Schlaeuche, Leitungen - reine Deko, nie Kollision. */
    kabel: new THREE.MeshLambertMaterial({ color: 0x24262b }),
    /* Industrieleuchten. Basic, damit sie leuchten, ohne dass dafuer
       zusaetzliche Lichtquellen in die Szene muessen - jede neue Lampe
       liesse alle Materialien neu uebersetzen. */
    lampe: new THREE.MeshBasicMaterial({ color: 0xffe6b4 }),
    /* Bodenmarkierung: eigener Offset, siehe Kopfkommentar. */
    /* Etwas dunkler als im kleinen Raum (vorher 0xb9a441): dort waren
       die Streifen 5 bis 6 m lang, hier bis 13 m - und in der
       Uebersichtsaufnahme war der helle Streifen das auffaelligste
       Objekt im ganzen Bild. */
    farbe: new THREE.MeshLambertMaterial({ color: 0x8e7c33,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    /* Das Seil an den Haenden der Geisel. Hell, damit man auf einen Blick
       sieht, dass sie gefesselt ist - der Playtest hat genau das
       vermisst. */
    seil: new THREE.MeshLambertMaterial({ color: 0xc9b48a }),
  });

  const kastenGeo = new THREE.BoxGeometry(1, 1, 1);
  const flaecheGeo = new THREE.PlaneGeometry(1, 1);
  const rohrGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

  /* Ein Bauhelfer: Kasten setzen, optional als Kollisionskasten melden.
     mittig in x/z, Unterkante bei y. */
  function bau(ziel, mat, x, y, z, bx, by, bz, kollision, klein, keinKlettern) {
    const m = new THREE.Mesh(kastenGeo, mat);
    m.position.set(x, y + by / 2, z);
    m.scale.set(bx, by, bz);
    m.castShadow = false; m.receiveShadow = true;
    ziel.gruppe.add(m);
    ziel.sichtbar++;
    if (kollision) {
      ziel.kollider.push({ x0: x - bx / 2, x1: x + bx / 2,
                           z0: z - bz / 2, z1: z + bz / 2,
                           h: y + by, y0: y, klein: !!klein,
                           keinKlettern: !!keinKlettern, innen: true });
      ziel.massiv++;
    }
    return m;
  }

  /* Deko ohne Kollision. Eigener Helfer, damit im Bauplan auf einen Blick
     steht, was massiv ist und was nicht - und damit der Zaehler stimmt. */
  function deko(ziel, mat, x, y, z, bx, by, bz) {
    const m = new THREE.Mesh(kastenGeo, mat);
    m.position.set(x, y + by / 2, z);
    m.scale.set(bx, by, bz);
    m.castShadow = false; m.receiveShadow = true;
    ziel.gruppe.add(m);
    ziel.sichtbar++; ziel.klein++;
    return m;
  }

  /* Ein Punkt ist frei, wenn kein bereits gebauter Kollisionskasten ihn
     mit dem Platzbedarf einer Figur beruehrt. Damit werden die
     Gegnerplaetze GEPRUEFT und nicht gewuerfelt. */
  function frei(kollider, x, z, r, hoeheAb) {
    const unten = hoeheAb === undefined ? 0.35 : hoeheAb;
    for (const c of kollider) {
      if (c.h <= unten) continue;                 // Stufe, kein Hindernis
      /* Was erst ueber Kopfhoehe anfaengt, laeuft man drunter durch. Ohne
         diese Zeile sperrte der Deckendeckel - er spannt ueber den ganzen
         Raum - jeden einzelnen Gegnerplatz: der erste Testlauf fand null
         statt zwoelf. */
      if (c.y0 !== undefined && c.y0 > unten + 1.75) continue;
      if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return false;
    }
    return true;
  }

  /* Eine Strecke abtasten. Wird beim Bauen benutzt, um die vorgegebenen
     Wege (Geisel, Funker) gegen die eigenen Requisiten zu pruefen -
     nicht erst im Botlauf. */
  function wegFrei(kollider, a, b, r) {
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!frei(kollider, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, r)) return false;
    }
    return true;
  }

  /* =================== Das Gang-Versteck ===================
     Sechs Zonen, vom Eingang zum Hinterausgang. Die Buchstaben sind
     dieselben wie im Auftrag:

       A  Eingang     x -21   .. -15,5   Vorraum, Durchlass in der Mitte
       B  Haupthalle  x -15,5 ..  -3     erste Kampfflaeche (Welle 1)
       C  Lager       x  -3   .. +10,5   zweite Kampfflaeche (Welle 2),
                                         Regale und Container als Deckung
       D  Geisel      x +11   .. +21, z +6 .. +15   abgeschirmte Ecke
       E  Kommando    x +10,5 .. +21, z -15 .. +6   Funktisch
       F  Hinterausgang an der Ostwand, z = -1,5

     opt: { x, y, z } Ursprung in der Welt (Mitte des Raums, y = Fussboden) */
  function createHideout(opt) {
    const o = opt || {};
    const ox = o.x === undefined ? 0 : o.x;
    const oy = o.y === undefined ? 0 : o.y;
    const oz = o.z === undefined ? 0 : o.z;
    const mat = materialien();
    const ziel = { gruppe: new THREE.Group(), kollider: [], sichtbar: 0, massiv: 0, klein: 0 };
    ziel.gruppe.name = 'WEB_HERO_Interior_Hideout';

    const hx = M.laenge / 2, hz = M.breite / 2;      // 21 / 15
    const X = (v) => ox + v, Z = (v) => oz + v;      // lokal -> Welt

    /* Zonengrenzen an EINER Stelle, damit Bauplan, Gegnerplaetze und der
       zurueckgegebene Zonenblock nicht auseinanderlaufen koennen. */
    const GA = -15.5;      // Eingang / Haupthalle
    const GB = -3.0;       // Haupthalle / Lager
    const GC = 10.5;       // Lager / Kommando
    const GD = 6.0;        // Kommando / Geisel (in z)

    /* ---- Fussboden: GENAU EINE Flaeche, genau auf der Ursprungshoehe ---- */
    const boden = new THREE.Mesh(flaecheGeo, mat.beton);
    boden.rotation.x = -Math.PI / 2;
    boden.position.set(X(0), oy, Z(0));
    boden.scale.set(M.laenge, M.breite, 1);
    boden.receiveShadow = true;
    ziel.gruppe.add(boden); ziel.sichtbar++;

    /* ---- Decke ---- */
    /* Die Decke bekommt den helleren Betonton. Mit dem dunklen Wandton
       multipliziert sich zweimal dunkel, und sie las sich als Loch. */
    const decke = new THREE.Mesh(flaecheGeo, mat.beton);
    decke.rotation.x = Math.PI / 2;
    decke.position.set(X(0), oy + M.hoehe, Z(0));
    decke.scale.set(M.laenge, M.breite, 1);
    ziel.gruppe.add(decke); ziel.sichtbar++;

    /* ---- Aussenwaende ----
       Geschlossen, auch dort, wo eine Tuer zu sehen ist. Die Tuer ist ein
       Sichtobjekt; hindurch geht es ueber den Uebergang, nicht ueber ein
       Loch. Ein echtes Loch waere ein Weg in die leere Welt. */
    /* ---- Nicht kletterbar ----
       Die Waende sind gewoehnliche Kollisionskaesten, und das Wandkleben
       des Helden greift an gewoehnlichen Kollisionskaesten. Der erste
       Dauerlauf im Raum endete deshalb auf 11,52 m Hoehe in einem 5,2 m
       hohen Raum: die Figur kletterte innen an der Wand hoch und stand
       ueber der Decke, 149 Bilder lang ausserhalb des Raums.

       keinKlettern ist kein neues Feld - die U-Bahn-Innenwaende benutzen
       es seit Phase 10 aus demselben Grund. Kisten und Werkbaenke bleiben
       ausgenommen: auf die soll man steigen duerfen. */
    const wy = M.hoehe;
    const WAND = [true, false, true];   // kollision, klein, keinKlettern
    bau(ziel, mat.wand, X(-hx - M.wand / 2), oy, Z(0), M.wand, wy, M.breite + M.wand * 2, ...WAND);
    bau(ziel, mat.wand, X(hx + M.wand / 2), oy, Z(0), M.wand, wy, M.breite + M.wand * 2, ...WAND);
    bau(ziel, mat.wand, X(0), oy, Z(-hz - M.wand / 2), M.laenge, wy, M.wand, ...WAND);
    bau(ziel, mat.wand, X(0), oy, Z(hz + M.wand / 2), M.laenge, wy, M.wand, ...WAND);

    /* ---- Deckel gegen das Herausspringen ----
       Ein Kasten mit Unterkante auf Deckenhoehe. collideBody laesst ihn
       liegen, solange der Kopf darunter ist (p.y + 1,75 < y0), und
       begrenzt erst, wenn die Figur wirklich hinaufkommt. Ohne ihn waere
       ein Doppelsprung an der Wand ein Weg nach draussen. */
    ziel.kollider.push({ x0: X(-hx), x1: X(hx), z0: Z(-hz), z1: Z(hz),
                         y0: oy + M.hoehe, h: oy + M.hoehe + 1.4,
                         keinKlettern: true, innen: true });

    /* ---- Tuerblaetter (nur Optik) ---- */
    bau(ziel, mat.stahl, X(-hx + 0.12), oy, Z(0), 0.16, 2.7, 2.2, false);
    bau(ziel, mat.stahl, X(hx - 0.12), oy, Z(-1.5), 0.16, 2.7, 2.4, false);
    /* Ein Leuchtschild ueber dem Hinterausgang - der Weg hinaus muss
       lesbar sein, ohne dass ein Pfeil ins Bild geschrieben wird. */
    bau(ziel, mat.lampe, X(hx - 0.3), oy + 2.85, Z(-1.5), 0.1, 0.34, 1.1, false);

    /* ---- Zone A: Vorraum ----
       Zwei Wandstuecke mit einem Durchlass in der Mitte. Der Eingang ist
       damit ein Flur und nicht die Kante der Halle. */
    bau(ziel, mat.wand, X(GA), oy, Z(-(hz + 2.5) / 2 - 1.25), M.trennwand, 4.4, hz - 2.5, ...WAND);
    bau(ziel, mat.wand, X(GA), oy, Z((hz + 2.5) / 2 + 1.25), M.trennwand, 4.4, hz - 2.5, ...WAND);

    /* ---- Zone B/C: das Hallentor ----
       Kein geschlossener Raumwechsel, sondern eine Engstelle: zwei
       Wandstuecke aussen, 13 m offen in der Mitte. Wer Welle 1 in der
       Haupthalle gewonnen hat, geht hier sichtbar in den naechsten
       Abschnitt - genau der "raeumliche Fortschritt" aus dem Auftrag,
       ohne zehn kleine Zimmer. */
    bau(ziel, mat.wand, X(GB), oy, Z(-(hz + 6.5) / 2 - 3.25), M.trennwand, 3.6, hz - 6.5, ...WAND);
    bau(ziel, mat.wand, X(GB), oy, Z((hz + 6.5) / 2 + 3.25), M.trennwand, 3.6, hz - 6.5, ...WAND);

    /* ---- Stahltraeger unter der Decke ---- */
    for (const tx of [-15.5, -8, 0, 8, 15.5]) {
      bau(ziel, mat.stahl, X(tx), oy + M.hoehe - 0.5, Z(0), 0.4, 0.5, M.breite, false);
    }
    /* ---- Saeulen ----
       Bewusst aus der Mittelachse heraus: der Hauptweg vom Eingang zum
       Hinterausgang bleibt frei. */
    for (const [px, pz] of [[-10, -10], [-10, 10], [3, -10], [3, 10], [16, -11.5]]) {
      bau(ziel, mat.beton, X(px), oy, Z(pz), 0.85, M.hoehe, 0.85, ...WAND);
    }

    /* ---- Industrieleuchten ---- */
    const lampen = [[-18, 0], [-12, -7], [-12, 7], [-6, 0], [0, -8], [0, 8],
                    [6, 0], [13, -9], [13, 2], [16.5, 11]];
    for (const [lx, lz] of lampen) {
      bau(ziel, mat.metall, X(lx), oy + M.hoehe - 0.8, Z(lz), 1.3, 0.22, 0.55, false);
      bau(ziel, mat.lampe, X(lx), oy + M.hoehe - 0.87, Z(lz), 1.15, 0.07, 0.42, false);
    }

    /* ---- Der Raum bringt sein eigenes Licht mit ----
       Der erste Entwurf hatte keines und verliess sich auf die Sonne der
       Aussenwelt. Das Bild war eindeutig: die Decke war PECHSCHWARZ und
       der Boden ausgebrannt hell. Eine gerichtete Sonne von oben trifft
       eine nach unten zeigende Deckenflaeche gar nicht - der Raum las
       sich als graue Kiste mit einem Loch als Deckel.

       Deshalb eigene Lichter, und die Weltlichter werden drinnen
       ausgeblendet. Das Halbkugellicht gibt der Decke ueber die
       Bodenfarbe ueberhaupt erst Helligkeit; die Punktlichter machen
       daraus Lichtinseln statt gleichmaessig grauer Suppe.

       Sie haengen IN der Gruppe: ist die Gruppe unsichtbar, zaehlen sie
       nicht mit, und draussen kostet der Raum kein Licht. */
    /* Die Werte sind am Bild eingestellt, nicht gewaehlt: mit 0,95 und
       einem dunklen Bodenton war der Raum zwar stimmungsvoll, aber der
       Kampf darin nicht mehr zu lesen - Vordergrund fast schwarz.
       Mit der groesseren Halle sind es sechs Punktlichter statt drei -
       eines je Zone, damit keine Zone dunkler ist als die anderen. */
    const himmelLicht = new THREE.HemisphereLight(0x9aa6b6, 0x7a808c, 1.25);
    himmelLicht.position.set(X(0), oy + M.hoehe, Z(0));
    ziel.gruppe.add(himmelLicht);
    for (const [lx, lz] of [[-18, 0], [-12, -7], [-6, 0], [0, 8], [6, 0], [13, -9], [16.5, 11]]) {
      const pl = new THREE.PointLight(0xffe2b0, 0.8, 26, 1.5);
      pl.position.set(X(lx), oy + M.hoehe - 1.1, Z(lz));
      ziel.gruppe.add(pl);
      ziel.lichter = (ziel.lichter || 0) + 1;
    }
    ziel.lichter = (ziel.lichter || 0) + 1;   // das Halbkugellicht

    /* ---- Zone D: der abgeschirmte Geiselbereich ----
       Zwei Wandstuecke, L-foermig, mit EINER Oeffnung im Nordwesten.

       Die Proportionen sind die aus dem letzten Botlauf uebernommenen,
       nur versetzt: der erste Entwurf hatte 6 m Wand und 2 m Durchlass,
       und der Weg zur Geisel fuehrte von jedem Punkt der Halle aus durch
       die Wand - die Phase war nicht zu beenden. Seither: lange
       Abschirmung, breiter Durchlass, und ein vorgegebener Weg.

       Geprueft wird das unten mit wegFrei(), nicht erst im Botlauf. */
    bau(ziel, mat.metall, X((11 + hx) / 2), oy, Z(GD), hx - 11, 2.4, 0.4, ...WAND);
    bau(ziel, mat.metall, X(11), oy, Z((GD + 10.5) / 2), 0.4, 2.4, 10.5 - GD, ...WAND);

    /* ---- Massive Requisiten ----
       Regel aus dem Playtest: was sichtbar massiv ist und groesser als ein
       kleines Dekostueck, hat einen Kollisionskasten oder steht ausserhalb
       der begehbaren Flaeche. Kein Durchlaufen.

       ZWEITER PLAYTEST: "Moebel funktionieren, koennten aber besser
       aussehen." Deshalb mehr Sorten statt mehr Stueck: Paletten,
       Industriekisten, Werkbaenke, Metallregale, Container, eine
       Werkzeugecke, der Kommandotisch, Absperrgitter. Die MITTE jeder
       Kampfzone bleibt frei - Deckung steht an den Raendern. */
    const massiv = [
      /* --- Zone A: Vorraum --- */
      [mat.holz,      -18.5,  9.5,  2.6, 2.2, 2.6],   // Kistenstapel
      [mat.palette,   -18.8, -9.0,  1.4, 0.9, 1.2],   // Palettenstapel
      /* --- Zone B: Haupthalle 1, Welle 1 --- */
      [mat.holz,      -13.5, -13.2, 5.0, 0.95, 1.1],  // Werkbank Suedwand
      [mat.holz,       -7.0, -13.2, 4.0, 0.95, 1.1],  // Werkbank Suedwand
      [mat.metall,    -11.0,  13.6, 5.5, 2.3, 0.8],   // Regal Nordwand
      [mat.holz,      -12.0,   6.5, 2.2, 1.7, 2.2],   // Kistenstapel
      [mat.holz,       -6.5,  -7.5, 1.8, 1.15, 1.8],  // Kistenstapel
      [mat.palette,    -9.0,   2.5, 1.6, 0.55, 1.2],  // Palette mit Sackware
      /* --- Zone C: Lager, Welle 2 --- */
      [mat.metall,      0.5,  -9.5, 6.0, 2.6, 1.0],   // Regalreihe Sued
      [mat.metall,      0.5,   9.5, 6.0, 2.6, 1.0],   // Regalreihe Nord
      [mat.container,   7.5, -11.8, 5.2, 2.5, 2.3],   // Container Sued
      [mat.container,   7.5,   9.2, 5.2, 2.5, 2.3],   // Container Nord
      [mat.holz,       -0.5,   0.5, 2.0, 1.55, 2.0],  // Deckung Mitte
      [mat.holz,        5.5,  -4.2, 2.2, 1.9, 2.2],   // Kistenstapel
      [mat.holz,        5.0,   4.5, 1.8, 1.2, 1.8],   // Kistenstapel
      [mat.palette,     2.5,  -5.8, 1.6, 0.95, 1.2],  // Palette mit Kisten
      /* --- Zone E: Kommando --- */
      [mat.metall,     17.0,  -7.0, 2.6, 0.95, 2.8],  // Funk- und Kommandotisch
      [mat.metall,     19.6, -12.0, 0.9, 2.4, 4.0],   // Regal an der Ostwand
      [mat.holz,       12.6, -10.0, 1.8, 1.3, 1.8],   // Kistenstapel
      [mat.palette,    12.5,   3.0, 2.0, 0.85, 1.5],  // Palettenstapel
      /* --- Zone D: Geisel ---
         Die Kiste, auf der die Geisel sitzt. Ihre Oberkante ist die
         Sitzflaeche; die Mission setzt das Becken mit sitzMasse genau
         darauf. */
      /* 0,62 m breit, nicht 1,1: auf der grossen Kiste sass die Geisel
         in der MITTE und ihre Beine verschwanden im Kasten. Auf der
         schmalen haengen Knie und Fuesse vorn ueber die Kante - die
         Sitzhaltung legt die Knie gemessen 0,43 m vor das Becken. */
      [mat.holz,       15.5,  10.5, 0.62, 0.52, 0.62],  // Sitzkiste
      [mat.holz,       19.0,  13.5, 1.6, 1.4, 1.6],   // Kistenstapel dahinter
    ];
    for (const [mt, px, pz, bx, by, bz] of massiv) {
      bau(ziel, mt, X(px), oy, Z(pz), bx, by, bz, true);
    }
    /* Faesser - rund, aber als Kasten kollidierend. */
    const faesser = [[-9.0, -4.0], [-5.5, 5.0], [-1.5, -6.5], [8.0, 6.5], [19.0, 4.0]];
    for (const [px, pz] of faesser) {
      const f = new THREE.Mesh(rohrGeo, mat.rost);
      f.position.set(X(px), oy + 0.48, Z(pz));
      f.scale.set(0.72, 0.96, 0.72);
      ziel.gruppe.add(f); ziel.sichtbar++;
      ziel.kollider.push({ x0: X(px) - 0.36, x1: X(px) + 0.36,
                           z0: Z(pz) - 0.36, z1: Z(pz) + 0.36,
                           h: oy + 0.96, y0: oy, innen: true });
      ziel.massiv++;
    }
    /* Absperrgitter: schmal, huefthoch, mit Kollision - sie sind das
       einzige Moebel, das mitten in einer Kampfzone stehen darf, weil man
       um sie herum kaempft statt gegen sie zu laufen. Bewusst WENIGE. */
    for (const [px, pz, bx] of [[-8.0, 9.5, 2.4], [3.0, 7.5, 2.6], [11.5, -2.0, 2.2]]) {
      bau(ziel, mat.metall, X(px), oy, Z(pz), bx, 1.05, 0.28, true);
    }

    /* ---- Kleinkram OHNE Kollision ----
       Flaschen, Papier, Werkzeug, Kabel, das Funkgeraet selbst. Eine
       Kollisionswolke aus hundert Kleinteilen waere genau der Fehler, den
       der alte Innenraum hatte. */
    const klein = [
      [mat.metall,   17.0,  -6.4, 0.95, 0.52, 0.3,  0.36],  // Funkgeraet
      [mat.lampe,    16.4,  -7.6, 0.96, 0.44, 0.02, 0.32],  // Karten
      [mat.lampe,    17.7,  -7.2, 0.96, 0.38, 0.02, 0.28],
      [mat.metall,   16.3,  -7.9, 0.95, 0.22, 0.26, 0.18],  // Feldtelefon
      [mat.metall,  -13.5, -13.2, 0.95, 0.52, 0.13, 0.32],  // Werkzeug
      [mat.metall,   -7.2, -13.2, 0.95, 0.44, 0.11, 0.28],
      [mat.rost,    -13.9, -13.2, 0.95, 0.2,  0.2,  0.2],
      [mat.holz,    -12.0,   6.5, 1.7,  0.52, 0.36, 0.52],  // Kiste obenauf
      [mat.metall,  -11.0,  13.6, 2.3,  0.62, 0.21, 0.52],
      [mat.holz,      0.5,  -9.5, 2.6,  0.7,  0.4,  0.6],   // Kisten im Regal
      [mat.holz,      0.5,   9.5, 2.6,  0.7,  0.4,  0.6],
      [mat.palette,   7.5, -11.8, 2.5,  0.8,  0.12, 0.8],
      [mat.rost,     19.0,   4.6, 0.0,  0.3,  0.3,  0.3],   // Eimer
    ];
    for (const [mt, px, pz, py, bx, by, bz] of klein) {
      deko(ziel, mt, X(px), oy + py, Z(pz), bx, by, bz);
    }
    /* Leitungen AN DEN WAENDEN, reine Deko.
       Der erste Entwurf spannte zusaetzlich drei 18 bis 27 m lange
       Kabel frei unter der Decke durch den Raum. Im Bild waren das keine
       Kabel, sondern haarduenne schwarze Striche quer ueber die ganze
       Halle - sie sahen aus wie ein Kratzer im Bild. Sie sind weg;
       was bleibt, liegt dicht an der Wand und ist dicker. */
    const kabelDeko = [
      [-20.5, 2.6,   5, 0.12, 0.12, 14],
      [-20.5, 2.9,   5, 0.10, 0.10, 14],
      [ 20.5, 2.2,  -8, 0.12, 0.12, 11],
      [   -8, 0.35, -14.5, 24, 0.12, 0.12],
    ];
    for (const [px, py, pz, bx, by, bz] of kabelDeko) {
      deko(ziel, mat.kabel, X(px), oy + py, Z(pz), bx, by, bz);
    }

    /* ---- Bodenmarkierungen ----
       Zwei Zentimeter ueber dem Boden UND mit polygonOffset. Eine von
       beiden Massnahmen allein hat in der Stadt schon geflackert. */
    for (const [px, pz, bx, bz] of [[GA, 0, 0.25, 5.0], [GB, 0, 0.25, 9.0],
                                    [GC, -1.5, 0.25, 7.0], [hx - 1.6, -1.5, 1.8, 0.25]]) {
      const m = new THREE.Mesh(flaecheGeo, mat.farbe);
      m.rotation.x = -Math.PI / 2;
      m.position.set(X(px), oy + 0.02, Z(pz));
      m.scale.set(bx, bz, 1);
      ziel.gruppe.add(m); ziel.sichtbar++;
    }

    /* =================== Punkte ===================
       Alles, was die Mission braucht, kommt fertig geprueft heraus. */
    const spielerStart = { x: X(-19.2), y: oy, z: Z(0) };
    /* Die Geisel sitzt auf der Kiste bei (15,5 / 10,5). Ihr Punkt liegt
       in der MITTE der Kiste; die Hoehe der Sitzflaeche steht daneben,
       damit die Mission das Becken darauf setzen kann statt zu raten. */
    const geiselPunkt = { x: X(15.5), y: oy, z: Z(10.5) };
    const geiselSitzY = oy + 0.52;
    /* Der Funker steht VOR seinem Tisch, mit Abstand - der Platz muss
       frei sein, sonst steckt er beim Aufstehen im Kasten. */
    const funkPunkt = { x: X(14.8), y: oy, z: Z(-6.8) };
    const hinterausgang = { x: X(hx - 1.6), y: oy, z: Z(-1.5) };

    /* ---- Gegnerplaetze: abgetastet und geprueft, nicht gewuerfelt ----
       Raster ueber die beiden Kampfzonen, jeder Punkt gegen alle gebauten
       Kollisionskaesten geprueft, mit Abstand zum Spielerstart und
       untereinander. Die Zonenzugehoerigkeit kommt mit heraus: die
       Mission stellt Welle 1 in der Haupthalle auf und Welle 2 im Lager,
       ohne selbst rechnen zu muessen. */
    const geiselZone = { x0: X(11), x1: X(hx), z0: Z(GD), z1: Z(hz) };
    const gegnerPunkte = [];
    for (let px = -14; px <= 18; px += 1.6) {
      for (let pz = -13; pz <= 13; pz += 1.6) {
        const wx = X(px), wz = Z(pz);
        if (!frei(ziel.kollider, wx, wz, 0.75)) continue;
        /* ---- Der Geiselbereich ist kein Kampfplatz ----
           Im ersten Botlauf stand der letzte Gegner IM abgeschirmten
           Bereich, 1,2 m vom Spieler entfernt und durch die Trennwand von
           ihm getrennt: die Phase war nicht mehr zu beenden. Der Kampf
           gehoert in die Hallen. */
        if (wx > geiselZone.x0 && wx < geiselZone.x1 &&
            wz > geiselZone.z0 && wz < geiselZone.z1) continue;
        if (Math.hypot(wx - spielerStart.x, wz - spielerStart.z) < 8) continue;
        if (Math.hypot(wx - geiselPunkt.x, wz - geiselPunkt.z) < 3.0) continue;
        let ok = true;
        for (const q of gegnerPunkte) {
          if (Math.hypot(wx - q.x, wz - q.z) < 3.2) { ok = false; break; }
        }
        if (!ok) continue;
        const zone = px < GA ? 'eingang' : px < GB ? 'halle'
                   : px < GC ? 'lager' : 'kommando';
        gegnerPunkte.push({ x: wx, y: oy, z: wz, zone });
      }
    }

    /* ---- Der Weg des Funkers zum Hinterausgang ----
       Geprueft freie Stationen. Keine Hausnavigation mehr noetig - der
       Raum ist bekannt. */
    const funkWeg = [
      { x: X(14.0), z: Z(-3.5), r: 1.2 },
      { x: X(17.5), z: Z(-1.5), r: 1.2 },
      { x: hinterausgang.x, z: hinterausgang.z, r: 1.4 },
    ];

    /* ---- Der Weg in den Geiselbereich ----
       Er ist hinter einer Trennwand: hineingehen muss man aussen herum.
       Ein Mensch sieht das. Eine Figur, die nur die Luftlinie kennt,
       laeuft gegen die Wand - im Botlauf dreimal, jedes Mal an einer
       anderen Stelle.

       Deshalb kennt der Raum seinen eigenen Weg dorthin, genau wie beim
       Funker: Stationen vor der Oeffnung und in ihr, beim Bauen gegen
       jeden Kollisionskasten geprueft. Das ist keine Botkruecke - es ist
       dieselbe Loesung, die der Funker benutzt, und sie steht dem Spiel
       genauso zur Verfuegung. */
    const geiselWeg = [
      { x: X(6.0), z: Z(12.8), r: 1.3 },
      { x: X(12.8), z: Z(12.8), r: 1.3 },
      { x: geiselPunkt.x, z: Z(12.2), r: 1.3 },
      { x: geiselPunkt.x, z: geiselPunkt.z + 1.3, r: 1.3 },
    ];

    /* ---- Die vorgegebenen Wege werden BEIM BAUEN geprueft ----
       Frueher fand erst der Botlauf, dass ein Weg eine Kiste anschneidet.
       Das ist zu spaet und zu teuer: hier kostet es nichts. Was nicht
       frei ist, kommt als Liste heraus und die Tests schlagen darauf an. */
    const wegFehler = [];
    const pruefeKette = (name, von, kette) => {
      let a = von;
      for (const b of kette) {
        if (!wegFrei(ziel.kollider, a, b, 0.5)) {
          wegFehler.push(name + ': ' + a.x.toFixed(1) + '/' + a.z.toFixed(1) +
                         ' -> ' + b.x.toFixed(1) + '/' + b.z.toFixed(1));
        }
        a = b;
      }
    };
    pruefeKette('funkWeg', funkPunkt, funkWeg);
    /* Der Geiselweg wird ab seiner ERSTEN Station geprueft, nicht ab dem
       Spielerstart: er ist ein Leitweg, den man von ueberall her betritt.
       Die Luftlinie vom Eingang bis zur ersten Station quer durch zwei
       Trennwaende zu pruefen, haette nur den Test selbst rot gemacht. */
    pruefeKette('geiselWeg', geiselWeg[0], geiselWeg.slice(1));

    return {
      id: 'hideout',
      gruppe: ziel.gruppe,
      kollider: ziel.kollider,
      bodenY: oy,
      /* Spielfeldgrenzen im Innenraum: die Innenkante der Waende, minus
         dem Radius einer Figur. */
      grenzen: { x0: X(-hx) + 0.5, x1: X(hx) - 0.5, z0: Z(-hz) + 0.5, z1: Z(hz) - 0.5 },
      kampfFlaeche: { x0: X(GA), x1: X(GC), z0: Z(-hz), z1: Z(hz) },
      spielerStart, spielerBlick: Math.PI / 2,      // nach +x
      geiselPunkt, geiselSitzY, funkPunkt, hinterausgang, funkWeg, geiselWeg,
      gegnerPunkte,
      zonen: {
        eingang: { x0: X(-hx), x1: X(GA), z0: Z(-hz), z1: Z(hz) },
        halle: { x0: X(GA), x1: X(GB), z0: Z(-hz), z1: Z(hz) },
        lager: { x0: X(GB), x1: X(GC), z0: Z(-hz), z1: Z(hz) },
        geisel: geiselZone,
        kommando: { x0: X(GC), x1: X(hx), z0: Z(-hz), z1: Z(GD) },
      },
      masse: { laenge: M.laenge, breite: M.breite, hoehe: M.hoehe },
      wegFehler,
      zahlen: { sichtbar: ziel.sichtbar, massiv: ziel.massiv, klein: ziel.klein,
                kollider: ziel.kollider.length, gegnerPunkte: gegnerPunkte.length,
                lichter: ziel.lichter || 0, wegFehler: wegFehler.length },
    };
  }

  return { createHideout, MASSE: M };
});
