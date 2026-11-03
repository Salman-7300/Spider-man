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
    for (const [px, pz] of [[-10, -10], [-10, 10], [1.5, -6.5], [1.5, 6.5], [16, -11.5]]) {
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
      [mat.metall,     -1.0,   9.5, 6.0, 2.6, 1.0],   // Regalreihe Nord
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
    for (const [px, pz, bx] of [[-8.0, 9.5, 2.4], [-5.0, 7.5, 2.6], [11.5, -2.0, 2.2]]) {
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
    /* Die Stationen liegen in zwei Gassen, die im Bauplan absichtlich
       frei bleiben:
         - eine Nord-Sued-Gasse bei x = 3,9 zwischen der Regalreihe Nord
           (endet bei x = 2) und dem Nordcontainer (beginnt bei x = 4,9),
         - ein Nordgang bei z = 12,5, noerdlich von Regal und Container.
       Der erste Entwurf fuehrte bei x = 6 nach Norden - mitten durch den
       Nordcontainer. Der Botlauf blieb daraufhin bei (6 | 7,6) haengen
       und beendete die Phase "Die Geisel befreien" nicht. */
    const geiselWeg = [
      { x: X(3.9), z: Z(6.5), r: 1.2 },
      { x: X(3.9), z: Z(12.5), r: 1.2 },
      { x: X(12.8), z: Z(12.5), r: 1.3 },
      { x: geiselPunkt.x, z: Z(11.9), r: 1.2 },
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


  /* ======================================================================
     Mega-Update 1.0, M4: zwei begehbare Orte nach demselben Prinzip
     ======================================================================
     Ein eigener, getrennter Raum je Ort, gebaut um einen Ursprung weit
     ausserhalb der Stadt - wie das Versteck. Ein Boden auf Ursprungshoehe,
     geschlossene Waende (nicht kletterbar), ein Deckel gegen das
     Herausspringen, Moebel als Kollisionskaesten. Was zum Raum gehoert,
     kommt als Liste heraus: Spielerstart, Ausgang, Personenplaetze und
     Handlungspunkte. Figuren baut game.js - hier gibt es nur Plaetze.

     Licht: ein Halbkugellicht und sieben Punktlichter, genau wie im
     Versteck. Drinnen sind die Weltlichter aus; mit derselben Zahl und Art
     Lichter teilen sich die Raeume die schon uebersetzten Shader, und das
     erste Betreten ruckelt nicht noch einmal. */

  /* ---- Viele kleine Dinge, ein Zeichenaufruf ----
     Waren im Regal, Flaschen im Kuehlregal, Bildschirme: einzeln gesetzt
     waeren es hunderte Zeichenaufrufe. Gesammelt in EINE Geometrie mit
     Eckfarben - ein Mesh je Raum und Material. */
  function sammler() {
    const pos = [], nor = [], col = [], idx = [];
    const c = new THREE.Color();
    const quad = (a, b, cc, d, n) => {
      const s = pos.length / 3;
      for (const v of [a, b, cc, d]) { pos.push(v[0], v[1], v[2]); nor.push(n[0], n[1], n[2]); col.push(c.r, c.g, c.b); }
      idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
    };
    return {
      /* Kasten mit Unterkante bei y; ohne Boden (liegt immer auf etwas). */
      kasten(x, y, z, bx, by, bz, farbe) {
        c.set(farbe);
        const x0 = x - bx / 2, x1 = x + bx / 2, y0 = y, y1 = y + by, z0 = z - bz / 2, z1 = z + bz / 2;
        quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
        quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]);
        quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
        quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
        quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
      },
      /* Stehender Zylinder (Dose, Flasche, Topf), n Seiten, mit Deckel. */
      walze(x, y, z, r, h, farbe, n) {
        c.set(farbe);
        const k = n || 8;
        for (let i = 0; i < k; i++) {
          const a0 = i / k * Math.PI * 2, a1 = (i + 1) / k * Math.PI * 2, am = (a0 + a1) / 2;
          const p0 = [x + Math.sin(a0) * r, z + Math.cos(a0) * r], p1 = [x + Math.sin(a1) * r, z + Math.cos(a1) * r];
          quad([p0[0], y, p0[1]], [p1[0], y, p1[1]], [p1[0], y + h, p1[1]], [p0[0], y + h, p0[1]],
               [Math.sin(am), 0, Math.cos(am)]);
          const s = pos.length / 3;
          for (const v of [[x, y + h, z], [p0[0], y + h, p0[1]], [p1[0], y + h, p1[1]]]) {
            pos.push(v[0], v[1], v[2]); nor.push(0, 1, 0); col.push(c.r, c.g, c.b);
          }
          idx.push(s, s + 1, s + 2);
        }
      },
      /* Die Eckpunkte stehen in RAUMkoordinaten (x/z relativ zum
         Ursprung, y schon mit Bodenhoehe); das Mesh wird an den Ursprung
         gestellt. Der erste Entwurf liess das weg - in der Vorschau lag der
         Ursprung bei 0/0, im Spiel standen die Waren dadurch 1,5 km neben
         dem Raum mitten in der Stadt, und die Regale waren leer. */
      fertig(ziel, material, ursprung) {
        if (!pos.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, material);
        if (ursprung) m.position.set(ursprung.x, 0, ursprung.z);
        m.receiveShadow = true;
        ziel.gruppe.add(m); ziel.sichtbar++;
        return m;
      },
    };
  }

  /* Eine kleine Leinwand als Textur (Fliesen, Schriftzug). In node (Tests)
     gibt es kein document - dann bleibt es bei der Grundfarbe. */
  function leinwand(w, h, malen) {
    if (typeof document === 'undefined' || !THREE.CanvasTexture) return null;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (!g) return null;
    malen(g, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return t;
  }

  /* Huelle eines Raums: Boden (genau eine Flaeche), Decke, vier Waende,
     Deckel. Gibt die Umrechnung lokal -> Welt zurueck. */
  function huelle(ziel, o, L, B, H, mats) {
    const X = (v) => o.x + v, Z = (v) => o.z + v, oy = o.y;
    const hx = L / 2, hz = B / 2, w = 0.4;
    const boden = new THREE.Mesh(flaecheGeo, mats.boden);
    boden.rotation.x = -Math.PI / 2;
    boden.position.set(X(0), oy, Z(0));
    boden.scale.set(L, B, 1);
    boden.receiveShadow = true;
    ziel.gruppe.add(boden); ziel.sichtbar++;
    const decke = new THREE.Mesh(flaecheGeo, mats.decke);
    decke.rotation.x = Math.PI / 2;
    decke.position.set(X(0), oy + H, Z(0));
    decke.scale.set(L, B, 1);
    ziel.gruppe.add(decke); ziel.sichtbar++;
    const WAND = [true, false, true];
    bau(ziel, mats.wand, X(-hx - w / 2), oy, Z(0), w, H, B + w * 2, ...WAND);
    bau(ziel, mats.wand, X(hx + w / 2), oy, Z(0), w, H, B + w * 2, ...WAND);
    bau(ziel, mats.wand, X(0), oy, Z(-hz - w / 2), L, H, w, ...WAND);
    bau(ziel, mats.wand, X(0), oy, Z(hz + w / 2), L, H, w, ...WAND);
    ziel.kollider.push({ x0: X(-hx), x1: X(hx), z0: Z(-hz), z1: Z(hz),
                         y0: oy + H, h: oy + H + 1.4, keinKlettern: true, innen: true });
    return { X, Z, oy, hx, hz };
  }

  /* Ein Halbkugellicht und sieben Punktlichter (siehe Kopf dieses Teils). */
  function raumLicht(ziel, X, Z, oy, H, himmel, boden, staerke, farbe, punkte) {
    const hl = new THREE.HemisphereLight(himmel, boden, staerke);
    hl.position.set(X(0), oy + H, Z(0));
    ziel.gruppe.add(hl);
    for (const [lx, lz, st] of punkte) {
      const pl = new THREE.PointLight(farbe, st, 16, 1.6);
      pl.position.set(X(lx), oy + H - 0.4, Z(lz));
      ziel.gruppe.add(pl);
      ziel.lichter = (ziel.lichter || 0) + 1;
    }
    ziel.lichter = (ziel.lichter || 0) + 1;
  }

  /* Leuchtfeld an der Decke (Basic: leuchtet ohne eigene Lichtquelle). */
  function deckenFeld(ziel, mat, x, y, z, bx, bz) {
    const m = new THREE.Mesh(kastenGeo, mat);
    m.position.set(x, y - 0.03, z);
    m.scale.set(bx, 0.05, bz);
    ziel.gruppe.add(m); ziel.sichtbar++; ziel.klein++;
  }

  /* ---- Ein offenes Regal ----
     Kollision ist der ganze Grundriss (man laeuft nicht hindurch),
     sichtbar sind Rueckwand bzw. Mittelwand, Seitenteile, Sockel und
     Boeden - die Waren stehen davor und sind zu sehen. Der erste Entwurf
     hatte massive Kaesten, und die Waren steckten unsichtbar darin.
       achse 'z': Regal laeuft in z, Tiefe in x; 'x' umgekehrt
       seiten:   [+1] Waren auf der +Seite (Rueckwand auf der -Seite),
                 [-1] umgekehrt, [-1, +1] doppelseitig (Gondel)
     fuellen(seite, ebene, von, bis, mitteQuer) setzt die Waren. */
  function regalOffen(ziel, mats, X, Z, oy, cx, cz, laenge, tiefe, hoehe, achse, seiten, ebenen, fuellen) {
    const ax = achse === 'z';
    const bx = ax ? tiefe : laenge, bz = ax ? laenge : tiefe;
    ziel.kollider.push({ x0: X(cx - bx / 2), x1: X(cx + bx / 2), z0: Z(cz - bz / 2), z1: Z(cz + bz / 2),
                         h: oy + hoehe, y0: oy, klein: true, keinKlettern: true, innen: true });
    ziel.massiv++;
    const doppelt = seiten.length > 1;
    /* Rueck- bzw. Mittelwand */
    const wandQ = doppelt ? 0 : -seiten[0] * (tiefe / 2 - 0.03);
    if (ax) deko(ziel, mats.regal, X(cx + wandQ), oy, Z(cz), 0.06, hoehe, laenge);
    else deko(ziel, mats.regal, X(cx), oy, Z(cz + wandQ), laenge, hoehe, 0.06);
    /* Seitenteile an beiden Enden */
    for (const e of [-1, 1]) {
      if (ax) deko(ziel, mats.regal, X(cx), oy, Z(cz + e * (laenge / 2 - 0.02)), tiefe, hoehe, 0.04);
      else deko(ziel, mats.regal, X(cx + e * (laenge / 2 - 0.02)), oy, Z(cz), 0.04, hoehe, tiefe);
    }
    /* Sockel und Boeden je Seite */
    for (const sd of seiten) {
      const q0 = doppelt ? 0.03 : -tiefe / 2 + 0.06, q1 = tiefe / 2;
      const qm = sd * (q0 + q1) / 2, qb = q1 - q0;
      if (ax) deko(ziel, mats.sockel, X(cx + qm), oy, Z(cz), qb, 0.12, laenge - 0.06);
      else deko(ziel, mats.sockel, X(cx), oy, Z(cz + qm), laenge - 0.06, 0.12, qb);
      for (let lev = 0; lev < ebenen; lev++) {
        const y = oy + 0.12 + lev * ((hoehe - 0.25) / ebenen);
        if (lev > 0) {
          if (ax) deko(ziel, mats.regal, X(cx + qm), y - 0.03, Z(cz), qb, 0.03, laenge - 0.06);
          else deko(ziel, mats.regal, X(cx), y - 0.03, Z(cz + qm), laenge - 0.06, 0.03, qb);
        }
        /* Preisleiste an der Vorderkante */
        if (ax) deko(ziel, mats.regalKante, X(cx + sd * (q1 - 0.01)), y - 0.06, Z(cz), 0.02, 0.05, laenge - 0.06);
        else deko(ziel, mats.regalKante, X(cx), y - 0.06, Z(cz + sd * (q1 - 0.01)), laenge - 0.06, 0.05, 0.02);
        if (fuellen) fuellen(sd, lev, y, -laenge / 2 + 0.12, laenge / 2 - 0.12, sd * (q0 + q1) / 2);
      }
    }
  }

  /* Wege beim Bauen pruefen (wie im Versteck). */
  function wegePruefen(ziel, wege) {
    const fehler = [];
    for (const [name, kette] of wege) {
      for (let i = 1; i < kette.length; i++) {
        const a = kette[i - 1], b = kette[i];
        if (!wegFrei(ziel.kollider, a, b, 0.5)) {
          fehler.push(name + ': ' + a.x.toFixed(1) + '/' + a.z.toFixed(1) + ' -> ' + b.x.toFixed(1) + '/' + b.z.toFixed(1));
        }
      }
    }
    return fehler;
  }

  /* =================== Ort A: der kleine Laden ===================
     16 x 14 m, Decke 3,8 m. Eingang in der Suedwand (+z) links, Theke
     rechts vorn, zwei Regalreihen und ein Wandregal, Kuehlregale an der
     Rueckwand. Die Gaenge sind 2,4 bis 4,0 m breit - genug fuer die
     Innenkamera (4,6 m hinter der Figur, sie schaut ueber 1,7-m-Regale). */
  const LADEN = { laenge: 16, breite: 14, hoehe: 3.8 };
  function createLaden(opt) {
    const o = { x: (opt && opt.x) || 0, y: (opt && opt.y) || 0, z: (opt && opt.z) || 0 };
    const ziel = { gruppe: new THREE.Group(), kollider: [], sichtbar: 0, massiv: 0, klein: 0 };
    ziel.gruppe.name = 'WEB_HERO_Interior_Laden';
    const fliesen = leinwand(256, 256, (g, w, h) => {
      g.fillStyle = '#b9b2a4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#aaa294'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
      g.strokeStyle = 'rgba(70,60,50,0.35)'; g.lineWidth = 3;
      g.strokeRect(0, 0, w / 2, h / 2); g.strokeRect(w / 2, 0, w / 2, h / 2);
      g.strokeRect(0, h / 2, w / 2, h / 2); g.strokeRect(w / 2, h / 2, w / 2, h / 2);
    });
    if (fliesen) { fliesen.wrapS = fliesen.wrapT = THREE.RepeatWrapping; fliesen.repeat.set(LADEN.laenge / 1.2, LADEN.breite / 1.2); }
    const mats = {
      boden: new THREE.MeshLambertMaterial(fliesen ? { map: fliesen } : { color: 0xcbc4b6 }),
      decke: new THREE.MeshLambertMaterial({ color: 0xf2efe8 }),
      wand: new THREE.MeshLambertMaterial({ color: 0xd2c6b0 }),
      sockel: new THREE.MeshLambertMaterial({ color: 0x5a4d40 }),
      regal: new THREE.MeshLambertMaterial({ color: 0xcfcbc3 }),
      regalKante: new THREE.MeshLambertMaterial({ color: 0x2f5d8a }),
      theke: new THREE.MeshLambertMaterial({ color: 0x7b5a3c }),
      platte: new THREE.MeshPhongMaterial({ color: 0x3b3e44, shininess: 40, specular: 0x333333 }),
      kuehl: new THREE.MeshLambertMaterial({ color: 0xd9dde2 }),
      kuehlLicht: new THREE.MeshBasicMaterial({ color: 0xe9f3ff }),
      glas: new THREE.MeshPhongMaterial({ color: 0xbfd6e6, transparent: true, opacity: 0.22, shininess: 90,
                                          specular: 0xffffff, depthWrite: false }),
      fenster: new THREE.MeshBasicMaterial({ color: 0xdde8ef }),
      rahmen: new THREE.MeshLambertMaterial({ color: 0x3a3d42 }),
      lampe: new THREE.MeshBasicMaterial({ color: 0xfff6e2 }),
      ware: new THREE.MeshLambertMaterial({ vertexColors: true }),
      schirm: new THREE.MeshBasicMaterial({ color: 0x163a52 }),
    };
    const H = LADEN.hoehe;
    const { X, Z, oy, hx, hz } = huelle(ziel, o, LADEN.laenge, LADEN.breite, H, mats);
    const M = [true, true, true];      // Moebel: Kollision, klein, nicht kletterbar
    const W = sammler();

    /* Sockelleiste rundum, dunkel - die Wand steht sonst ohne Kante auf dem Boden. */
    deko(ziel, mats.sockel, X(0), oy, Z(-hz + 0.03), LADEN.laenge, 0.12, 0.06);
    deko(ziel, mats.sockel, X(-hx + 0.03), oy, Z(0), 0.06, 0.12, LADEN.breite);
    deko(ziel, mats.sockel, X(hx - 0.03), oy, Z(0), 0.06, 0.12, LADEN.breite);

    /* ---- Front (Suedwand): Tuer links, Schaufenster aus Milchglas ----
       Hinter Milchglas muss keine Strasse zu sehen sein; das helle Feld
       liest sich als Tageslicht. */
    const tuerX = -5.0;
    const fz = hz - 0.04;
    deko(ziel, mats.rahmen, X(tuerX), oy, Z(fz), 2.0, 2.45, 0.08);
    deko(ziel, mats.fenster, X(tuerX), oy + 0.05, Z(fz - 0.05), 1.7, 2.3, 0.02);
    deko(ziel, mats.rahmen, X(tuerX + 0.55), oy + 1.0, Z(fz - 0.09), 0.06, 0.32, 0.05);   // Griff
    for (const [fx, fb] of [[-1.2, 4.6], [4.4, 6.4]]) {
      deko(ziel, mats.rahmen, X(fx), oy + 0.7, Z(fz), fb + 0.16, 2.1, 0.08);
      deko(ziel, mats.fenster, X(fx), oy + 0.78, Z(fz - 0.05), fb, 1.94, 0.02);
      for (let s = -fb / 2 + fb / 3; s < fb / 2 - 0.1; s += fb / 3) deko(ziel, mats.rahmen, X(fx + s), oy + 0.78, Z(fz - 0.07), 0.05, 1.94, 0.03);
    }

    /* ---- Theke rechts vorn, L-foermig, dahinter der Inhaber ---- */
    bau(ziel, mats.theke, X(4.9), oy, Z(4.1), 1.0, 1.0, 3.6, ...M);
    bau(ziel, mats.theke, X(6.6), oy, Z(2.55), 2.4, 1.0, 0.8, ...M);
    deko(ziel, mats.platte, X(4.9), oy + 1.0, Z(4.1), 1.1, 0.05, 3.7);
    deko(ziel, mats.platte, X(6.6), oy + 1.0, Z(2.55), 2.5, 0.05, 0.9);
    /* Kasse: Gehaeuse, Bildschirm, Kartenleser */
    deko(ziel, mats.rahmen, X(4.85), oy + 1.05, Z(3.4), 0.42, 0.14, 0.36);
    deko(ziel, mats.rahmen, X(4.95), oy + 1.19, Z(3.4), 0.06, 0.28, 0.34);
    deko(ziel, mats.schirm, X(4.91), oy + 1.22, Z(3.4), 0.02, 0.22, 0.28);
    deko(ziel, mats.rahmen, X(4.7), oy + 1.05, Z(3.95), 0.12, 0.06, 0.2);
    /* Suessigkeiten am Thekenrand */
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) W.kasten(4.55, oy + 1.05 + j * 0.09, 4.5 + i * 0.32, 0.22, 0.08, 0.26,
        [0xc0392b, 0xe6b422, 0x2a7ab0, 0x7b3fa0][(i + j) % 4]);
    }
    /* Rueckregal hinter dem Inhaber (Ostwand), offen nach Westen */
    regalOffen(ziel, mats, X, Z, oy, 7.7, 4.6, 3.6, 0.6, 2.2, 'z', [-1], 5, (sd, lev, y, von, bis, q) => {
      let k = 0;
      for (let z = von; z < bis; z += 0.24, k++) W.kasten(7.7 + q, y, 4.6 + z, 0.18, 0.26 - (k % 3) * 0.03, 0.2,
        [0xe8e4da, 0xb13a2f, 0x2b4f86, 0xd9b44a, 0x3f7f5a, 0xefefef][(k * 7 + lev) % 6]);
    });

    /* ---- Zwei Regalreihen (Gondeln), laengs in z ----
       Vier Boeden je Seite, Waren in festen Reihen und Familien - keine
       Wuerfel durcheinander: je Boden eine Warengruppe mit gleicher Groesse. */
    const FAMILIEN = [
      { w: 0.22, h: 0.30, t: 0.08, farben: [0xd94f2b, 0xf0c33c, 0x4a7fc1, 0x5aa05a] },   // Muesli
      { r: 0.045, h: 0.12, farben: [0xb8352e, 0x2e6fb8, 0xe8c547, 0x9aa1a8] },           // Dosen
      { w: 0.12, h: 0.18, t: 0.12, farben: [0xe8e2d4, 0xc9a46a, 0x6f8f3a] },              // Packungen
      { r: 0.04, h: 0.27, farben: [0x2f7d4a, 0xa83232, 0xf2f2f2, 0x2c4a7a] },             // Flaschen
    ];
    const gondel = (gx, z0, z1) => {
      const len = z1 - z0, zm = (z0 + z1) / 2;
      regalOffen(ziel, mats, X, Z, oy, gx, zm, len, 1.2, 1.7, 'z', [-1, 1], 4, (sd, lev, y, von, bis, q) => {
        const f = FAMILIEN[(lev + (sd > 0 ? 1 : 0) + Math.round(gx)) & 3];
        const schritt = f.r ? f.r * 2.4 : f.w + 0.02;
        let i = 0;
        for (let z = von; z < bis; z += schritt, i++) {
          const farbe = f.farben[Math.floor(i / 3) % f.farben.length];
          if (f.r) W.walze(gx + q, y, zm + z, f.r, f.h, farbe, 8);
          else W.kasten(gx + q, y, zm + z, f.t * 2.2, f.h, f.w, farbe);
        }
      });
      /* Kopfregal zur Tuer hin: Angebotsstapel */
      bau(ziel, mats.regal, X(gx), oy, Z(z1 + 0.35), 1.2, 0.9, 0.7, ...M);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++)
        W.kasten(gx - 0.42 + b * 0.28, oy + 0.9, z1 + 0.15 + a * 0.2, 0.24, 0.18, 0.16, a % 2 ? 0xe2532d : 0xf4d23e);
    };
    gondel(-3.6, -4.4, 1.6);
    gondel(0.0, -4.4, 1.6);

    /* ---- Wandregal (Westwand), offen nach Osten ---- */
    regalOffen(ziel, mats, X, Z, oy, -hx + 0.3, -0.4, 8.4, 0.6, 2.0, 'z', [1], 5, (sd, lev, y, von, bis, q) => {
      const f = FAMILIEN[(lev + 2) & 3];
      let i = 0;
      for (let z = von; z < bis; z += f.r ? f.r * 2.4 : f.w + 0.02, i++) {
        const farbe = f.farben[Math.floor(i / 4) % f.farben.length];
        if (f.r) W.walze(-hx + 0.3 + q, y, -0.4 + z, f.r, f.h, farbe, 8);
        else W.kasten(-hx + 0.3 + q, y, -0.4 + z, f.t * 2.2, f.h, f.w, farbe);
      }
    });

    /* ---- Kuehlregale an der Rueckwand (Nord), Glastueren ----
       Offener Schrank: leuchtende Rueckwand, Flaschenreihen, vorn Glas.
       Kollision ist der ganze Schrank bis zur Glasfront. */
    const k0 = -6.2, k1 = 5.4, kt = 0.85, kz = -hz + kt / 2;
    ziel.kollider.push({ x0: X(k0), x1: X(k1), z0: Z(-hz), z1: Z(-hz + kt + 0.02),
                         h: oy + 2.15, y0: oy, klein: true, keinKlettern: true, innen: true });
    ziel.massiv++;
    deko(ziel, mats.kuehlLicht, X((k0 + k1) / 2), oy + 0.15, Z(-hz + 0.05), k1 - k0 - 0.1, 1.85, 0.02);
    deko(ziel, mats.kuehl, X((k0 + k1) / 2), oy, Z(kz), k1 - k0, 0.14, kt);                   // Sockel
    deko(ziel, mats.kuehl, X((k0 + k1) / 2), oy + 2.0, Z(kz), k1 - k0, 0.15, kt);             // Kopf
    deko(ziel, mats.kuehlLicht, X((k0 + k1) / 2), oy + 2.03, Z(-hz + kt + 0.005), k1 - k0 - 0.3, 0.06, 0.01);
    for (const sx of [k0, k1]) deko(ziel, mats.kuehl, X(sx), oy, Z(kz), 0.06, 2.15, kt);
    for (let lev = 0; lev < 4; lev++) {
      const y = oy + 0.14 + lev * 0.46;
      if (lev > 0) deko(ziel, mats.kuehl, X((k0 + k1) / 2), y - 0.02, Z(kz - 0.05), k1 - k0 - 0.12, 0.02, kt - 0.15);
      let i = 0;
      for (let x = k0 + 0.2; x < k1 - 0.15; x += 0.13, i++) {
        const fam = Math.floor((x - k0) / 2.9);
        const farbe = [[0x2a8c4a, 0x37a65a], [0xd6402f, 0xe9573f], [0xf0b429, 0xf6cc54], [0x2d6db5, 0x4a8ad0]][fam & 3][i & 1];
        for (let r = 0; r < 2; r++) W.walze(x, y, -hz + 0.3 + r * 0.16, 0.045, lev % 2 ? 0.26 : 0.17, farbe, 8);
      }
    }
    for (let x = k0 + 1.45; x < k1; x += 2.9) {
      deko(ziel, mats.glas, X(x), oy + 0.14, Z(-hz + kt), 2.8, 1.86, 0.02);
      deko(ziel, mats.rahmen, X(x - 1.42), oy + 0.14, Z(-hz + kt + 0.01), 0.05, 1.86, 0.05);
      deko(ziel, mats.rahmen, X(x + 1.2), oy + 0.85, Z(-hz + kt + 0.04), 0.03, 0.5, 0.05);   // Griff
    }

    /* ---- Schriftzug ueber dem Rueckregal, Fussmatte am Eingang ---- */
    const ladenSchild = leinwand(512, 128, (g, w, h) => {
      g.fillStyle = '#7a2a22'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f3e3c3'; g.font = 'bold 62px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ECKMARKT', w / 2, h / 2 + 3);
    });
    const schildMat = new THREE.MeshBasicMaterial(ladenSchild ? { map: ladenSchild } : { color: 0x7a2a22 });
    const sm = new THREE.Mesh(kastenGeo, schildMat);
    sm.position.set(X(hx - 0.05), oy + 2.85, Z(4.6)); sm.scale.set(0.04, 0.55, 2.2);
    sm.rotation.y = 0;
    ziel.gruppe.add(sm); ziel.sichtbar++; ziel.klein++;
    deko(ziel, mats.sockel, X(tuerX), oy + 0.005, Z(hz - 1.0), 1.6, 0.012, 1.0);

    /* ---- Zeitungsstaender neben der Tuer ---- */
    bau(ziel, mats.rahmen, X(-7.2), oy, Z(5.6), 0.8, 1.1, 0.5, ...M);
    for (let i = 0; i < 4; i++) W.kasten(-7.2, oy + 1.1, 5.42 + i * 0.12, 0.6, 0.02 + i * 0.004, 0.09, [0xf2efe6, 0xe0d8c4, 0xd94f2b, 0x3a3a3a][i]);

    /* ---- Licht: Leuchtfelder an der Decke, sieben Punktlichter ---- */
    for (const [lx, lz] of [[-5.5, -3], [-1.8, -3], [2, -3], [-5.5, 2.5], [-1.8, 2.5], [2, 2.5], [6, 4.2]]) deckenFeld(ziel, mats.lampe, X(lx), oy + H, Z(lz), 1.2, 0.6);
    raumLicht(ziel, X, Z, oy, H, 0xe9e4da, 0x6f675c, 0.62, 0xffecc8,
      [[-5.5, -3, 0.42], [-1.8, -3, 0.42], [2, -3, 0.42], [-5.5, 2.5, 0.38], [-1.8, 2.5, 0.38], [2, 2.5, 0.38], [6, 4.2, 0.45]]);

    W.fertig(ziel, mats.ware, o);

    /* ---- Plaetze und Wege ---- */
    const P = (x, z) => ({ x: X(x), y: oy, z: Z(z) });
    const spielerStart = P(tuerX, hz - 1.4);
    const ausgang = { x: X(tuerX), z: Z(hz - 0.6), r: 1.6, text: 'Hinausgehen' };
    const personen = [
      { rolle: 'inhaber', x: X(6.6), z: Z(4.3), ry: -Math.PI / 2, clip: 'idle' },
      { rolle: 'kunde', x: X(-1.8), z: Z(-1.4), ry: Math.PI / 2, clip: 'idle' },
      { rolle: 'kunde', x: X(2.6), z: Z(-5.2), ry: Math.PI, clip: 'idle' },
    ];
    const aktionen = [
      { id: 'inhaber', x: X(3.9), z: Z(4.1), r: 1.8, text: 'Mit dem Inhaber sprechen' },
    ];
    const wegFehler = wegePruefen(ziel, [
      ['zurTheke', [spielerStart, P(-1.8, 4.0), P(3.9, 4.1)]],
      ['gangMitte', [P(-1.8, 4.0), P(-1.8, -1.4), P(-1.8, -5.3)]],
      ['zumKuehlregal', [P(-1.8, -5.3), P(2.6, -5.3)]],
      ['gangOst', [P(3.0, 3.6), P(2.6, -5.3)]],
      ['gangWest', [P(-6.0, 4.0), P(-6.0, -5.3)]],
      ['zurTuer', [P(3.9, 4.1), spielerStart]],
    ]);
    return {
      id: 'laden', gruppe: ziel.gruppe, kollider: ziel.kollider, bodenY: oy,
      grenzen: { x0: X(-hx) + 0.5, x1: X(hx) - 0.5, z0: Z(-hz) + 0.5, z1: Z(hz) - 0.5 },
      spielerStart, spielerBlick: Math.PI, ausgang, personen, aktionen,
      masse: { laenge: LADEN.laenge, breite: LADEN.breite, hoehe: H },
      wegFehler,
      zahlen: { sichtbar: ziel.sichtbar, massiv: ziel.massiv, klein: ziel.klein,
                kollider: ziel.kollider.length, lichter: ziel.lichter || 0, wegFehler: wegFehler.length,
                personen: personen.length },
    };
  }

  /* =================== Ort B: Buero-Lobby ===================
     22 x 16 m, Decke 4,2 m. Doppeltuer mittig in der Suedwand, Empfang
     gegenueber, links ein Wartebereich mit Sofas und Pflanzen, rechts vier
     Arbeitsplaetze mit Trennwaenden, hinten die Aufzuege. */
  const BUERO = { laenge: 22, breite: 16, hoehe: 4.2 };
  function createBuero(opt) {
    const o = { x: (opt && opt.x) || 0, y: (opt && opt.y) || 0, z: (opt && opt.z) || 0 };
    const ziel = { gruppe: new THREE.Group(), kollider: [], sichtbar: 0, massiv: 0, klein: 0 };
    ziel.gruppe.name = 'WEB_HERO_Interior_Buero';
    const stein = leinwand(256, 256, (g, w, h) => {
      g.fillStyle = '#a7a49d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9e9b94'; g.fillRect(0, 0, w, h / 2);
      g.strokeStyle = 'rgba(60,60,60,0.22)'; g.lineWidth = 2;
      g.strokeRect(0, 0, w, h / 2); g.strokeRect(0, h / 2, w, h / 2);
    });
    if (stein) { stein.wrapS = stein.wrapT = THREE.RepeatWrapping; stein.repeat.set(BUERO.laenge / 1.6, BUERO.breite / 1.6); }
    const schild = leinwand(512, 128, (g, w, h) => {
      g.fillStyle = '#20262e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d8c7a0'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('KAI 7  ·  BÜROHAUS', w / 2, h / 2 + 2);
    });
    const mats = {
      boden: new THREE.MeshLambertMaterial(stein ? { map: stein } : { color: 0xb6b3ac }),
      decke: new THREE.MeshLambertMaterial({ color: 0xeeeeea }),
      wand: new THREE.MeshLambertMaterial({ color: 0xc9c4b9 }),
      holz: new THREE.MeshLambertMaterial({ color: 0x7a5a3e }),
      hell: new THREE.MeshLambertMaterial({ color: 0xe9e6df }),
      dunkel: new THREE.MeshLambertMaterial({ color: 0x2e3238 }),
      stoff: new THREE.MeshLambertMaterial({ color: 0x4d6273 }),
      teppich: new THREE.MeshLambertMaterial({ color: 0x55606b, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      trenn: new THREE.MeshLambertMaterial({ color: 0x7f8c8a }),
      metall: new THREE.MeshPhongMaterial({ color: 0x9aa0a6, shininess: 60, specular: 0x666666 }),
      fenster: new THREE.MeshBasicMaterial({ color: 0xdde7ee }),
      glas: new THREE.MeshPhongMaterial({ color: 0xbfd6e6, transparent: true, opacity: 0.25, shininess: 90,
                                          specular: 0xffffff, depthWrite: false }),
      lampe: new THREE.MeshBasicMaterial({ color: 0xf7f9ff }),
      schild: new THREE.MeshBasicMaterial(schild ? { map: schild } : { color: 0x20262e }),
      teile: new THREE.MeshLambertMaterial({ vertexColors: true }),
      schirm: new THREE.MeshBasicMaterial({ color: 0x1f4c6e }),
      blatt: new THREE.MeshLambertMaterial({ color: 0x3f7f3e, flatShading: true }),
    };
    const H = BUERO.hoehe;
    const { X, Z, oy, hx, hz } = huelle(ziel, o, BUERO.laenge, BUERO.breite, H, mats);
    const M = [true, true, true];
    const T = sammler();

    /* ---- Front: Doppeltuer aus Glas, Fensterband aus Milchglas ---- */
    const fz = hz - 0.04;
    deko(ziel, mats.dunkel, X(0), oy, Z(fz), 3.0, 2.8, 0.08);
    deko(ziel, mats.fenster, X(0), oy + 0.05, Z(fz - 0.05), 2.7, 2.65, 0.02);
    deko(ziel, mats.dunkel, X(0), oy + 0.05, Z(fz - 0.08), 0.06, 2.65, 0.04);
    for (const fx of [-6.5, 6.5]) {
      deko(ziel, mats.dunkel, X(fx), oy + 0.5, Z(fz), 7.2, 3.0, 0.08);
      deko(ziel, mats.fenster, X(fx), oy + 0.58, Z(fz - 0.05), 7.0, 2.84, 0.02);
      for (let s = -3.5 + 1.4; s < 3.4; s += 1.4) deko(ziel, mats.dunkel, X(fx + s), oy + 0.58, Z(fz - 0.07), 0.05, 2.84, 0.03);
    }

    /* ---- Empfang: Tresen mit erhoehter Ablage, Schriftwand dahinter ---- */
    bau(ziel, mats.holz, X(0), oy, Z(1.4), 4.6, 1.1, 0.9, ...M);
    deko(ziel, mats.hell, X(0), oy + 1.1, Z(1.62), 4.7, 0.05, 0.5);
    bau(ziel, mats.holz, X(-2.75), oy, Z(0.75), 0.9, 1.1, 2.2, ...M);
    deko(ziel, mats.hell, X(-2.75), oy + 1.1, Z(0.75), 1.0, 0.05, 2.3);
    deko(ziel, mats.dunkel, X(0.8), oy + 1.1, Z(1.25), 0.5, 0.32, 0.04);      // Bildschirm am Empfang
    deko(ziel, mats.schirm, X(0.8), oy + 1.12, Z(1.225), 0.44, 0.27, 0.01);
    bau(ziel, mats.wand, X(0), oy, Z(-1.4), 7.0, 3.1, 0.4, ...M);
    deko(ziel, mats.schild, X(0), oy + 1.8, Z(-1.18), 3.6, 0.9, 0.03);

    /* ---- Wartebereich links: zwei Sofas, Tisch, Pflanzen, Teppich ---- */
    deko(ziel, mats.teppich, X(-7.4), oy, Z(3.6), 5.6, 0.02, 4.2);
    const sofa = (sx, sz, quer) => {
      const bx = quer ? 0.9 : 2.4, bz = quer ? 2.4 : 0.9;
      bau(ziel, mats.stoff, X(sx), oy, Z(sz), bx, 0.45, bz, ...M);
      const rx = quer ? sx - 0.35 : sx, rz = quer ? sz : sz - 0.35;
      bau(ziel, mats.stoff, X(rx), oy + 0.45, Z(rz), quer ? 0.2 : 2.4, 0.45, quer ? 2.4 : 0.2, ...M);
    };
    sofa(-7.4, 1.7, false);           // Lehne nach Norden, Blick nach Sueden
    sofa(-9.9, 3.9, true);            // Lehne nach Westen, Blick nach Osten
    bau(ziel, mats.holz, X(-7.4), oy, Z(3.7), 1.4, 0.4, 0.8, ...M);
    T.kasten(-7.65, oy + 0.4, 3.6, 0.3, 0.015, 0.22, 0xe7e1d2);
    T.kasten(-7.2, oy + 0.4, 3.85, 0.26, 0.012, 0.2, 0xc8402f);
    /* Pflanze: runder Topf und drei niedrigpolige Blattbuesche (flach
       schattiert). Wuerfelstapel lasen sich im ersten Bild als Kisten. */
    const blattGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const pflanze = (px, pz, gross) => {
      const s = gross ? 1.0 : 0.75;
      ziel.kollider.push({ x0: X(px - 0.32 * s), x1: X(px + 0.32 * s), z0: Z(pz - 0.32 * s), z1: Z(pz + 0.32 * s),
                           h: oy + 0.6 * s, y0: oy, klein: true, keinKlettern: true, innen: true });
      ziel.massiv++;
      T.walze(px, oy, pz, 0.3 * s, 0.55 * s, 0x3a3e44, 10);
      T.walze(px, oy + 0.5 * s, pz, 0.27 * s, 0.03, 0x4a3a2c, 10);
      for (const [bx, by, bz, br] of [[0, 1.05, 0, 0.46], [0.16, 0.8, 0.1, 0.34], [-0.14, 0.86, -0.12, 0.36]]) {
        const m = new THREE.Mesh(blattGeo, mats.blatt);
        m.position.set(X(px + bx * s), oy + by * s, Z(pz + bz * s));
        m.scale.setScalar(br * 2 * s);
        m.rotation.set(bx * 3, by * 2, bz * 3);
        ziel.gruppe.add(m); ziel.sichtbar++; ziel.klein++;
      }
    };
    pflanze(-10.3, 0.6, true); pflanze(-4.6, 6.9, true); pflanze(10.3, -7.2, false); pflanze(10.3, 6.9, true);

    /* ---- Arbeitsplaetze rechts: vier Tische, Trennwaende, Stuehle ---- */
    deko(ziel, mats.teppich, X(7.6), oy, Z(-3.4), 6.0, 0.02, 6.6);
    const tisch = (tx, tz, blick) => {
      bau(ziel, mats.hell, X(tx), oy, Z(tz), 1.6, 0.75, 0.8, ...M);
      const mz = tz + blick * 0.22;
      deko(ziel, mats.dunkel, X(tx), oy + 0.75, Z(mz), 0.56, 0.36, 0.04);
      deko(ziel, mats.schirm, X(tx), oy + 0.78, Z(mz - blick * 0.025), 0.5, 0.3, 0.01);
      T.kasten(tx, oy + 0.75, tz - blick * 0.12, 0.42, 0.02, 0.14, 0x2a2d31);   // Tastatur
      /* Stuhl: Sitz, Lehne, Saeule - eine Kollision fuer den Sitz */
      const sz = tz - blick * 0.75;
      bau(ziel, mats.dunkel, X(tx), oy, Z(sz), 0.55, 0.48, 0.55, ...M);
      deko(ziel, mats.dunkel, X(tx), oy + 0.48, Z(sz - blick * 0.26), 0.5, 0.55, 0.06);
      return { x: tx, z: sz };
    };
    const platz1 = tisch(6.0, -1.6, -1);    // Blick nach Norden (Bildschirm im Norden)
    tisch(9.0, -1.6, -1);
    tisch(6.0, -5.2, 1);                    // Blick nach Sueden
    tisch(9.0, -5.2, 1);
    bau(ziel, mats.trenn, X(7.5), oy, Z(-3.4), 3.4, 1.25, 0.08, ...M);
    bau(ziel, mats.trenn, X(7.5), oy, Z(-3.4), 0.08, 1.25, 4.4, ...M);
    /* Drucker und Wasserspender an der Ostwand */
    bau(ziel, mats.hell, X(10.4), oy, Z(1.6), 0.8, 0.9, 0.6, ...M);
    deko(ziel, mats.dunkel, X(10.4), oy + 0.9, Z(1.6), 0.6, 0.18, 0.45);
    bau(ziel, mats.hell, X(10.55), oy, Z(3.2), 0.4, 1.05, 0.4, ...M);
    T.walze(10.55, oy + 1.05, 3.2, 0.14, 0.42, 0x9cc8e6, 10);

    /* ---- Aufzuege an der Rueckwand (Nord) ---- */
    for (const ax of [-6.0, -3.2]) {
      deko(ziel, mats.dunkel, X(ax), oy, Z(-hz + 0.04), 1.6, 2.6, 0.08);
      deko(ziel, mats.metall, X(ax - 0.4), oy + 0.02, Z(-hz + 0.1), 0.78, 2.45, 0.03);
      deko(ziel, mats.metall, X(ax + 0.4), oy + 0.02, Z(-hz + 0.1), 0.78, 2.45, 0.03);
      deko(ziel, mats.lampe, X(ax), oy + 2.75, Z(-hz + 0.08), 0.5, 0.12, 0.03);
    }
    deko(ziel, mats.metall, X(-4.6), oy + 1.1, Z(-hz + 0.06), 0.12, 0.3, 0.03);   // Rufknopf

    /* ---- Licht ---- */
    for (const [lx, lz] of [[-7.5, 3.5], [0, 3.8], [0, -4.5], [-5, -4.5], [6, -1.6], [9, -1.6], [6, -5.2], [9, -5.2]])
      deckenFeld(ziel, mats.lampe, X(lx), oy + H, Z(lz), 1.4, 0.7);
    raumLicht(ziel, X, Z, oy, H, 0xe8edf4, 0x6f6a62, 0.62, 0xf3efe6,
      [[-7.5, 3.5, 0.42], [0, 3.8, 0.42], [0, -4.5, 0.36], [-5, -4.5, 0.36], [6, -1.6, 0.4], [9, -5.2, 0.4], [9, 3.2, 0.34]]);

    T.fertig(ziel, mats.teile, o);

    /* ---- Plaetze und Wege ---- */
    const P = (x, z) => ({ x: X(x), y: oy, z: Z(z) });
    const spielerStart = P(0, hz - 1.6);
    const ausgang = { x: X(0), z: Z(hz - 0.7), r: 1.8, text: 'Hinausgehen' };
    const personen = [
      { rolle: 'empfang', x: X(0), z: Z(0.55), ry: 0, clip: 'idle' },
      { rolle: 'mitarbeiter', x: X(platz1.x), z: Z(platz1.z), ry: Math.PI, clip: 'sitzen', sitz: oy + 0.48 },
      { rolle: 'besucher', x: X(-7.4), z: Z(1.85), ry: 0, clip: 'sitzen', sitz: oy + 0.45 },
    ];
    const aktionen = [
      { id: 'empfang', x: X(0), z: Z(2.6), r: 1.8, text: 'Am Empfang fragen' },
    ];
    const wegFehler = wegePruefen(ziel, [
      ['zumEmpfang', [spielerStart, P(0, 2.6)]],
      ['zumWarten', [spielerStart, P(-4.0, 5.6), P(-7.4, 5.6)]],
      ['zumBuero', [spielerStart, P(4.0, 5.0), P(4.0, -6.6)]],
      ['zuAufzug', [P(4.0, -6.6), P(-4.6, -6.6)]],
      ['zurTuer', [P(0, 2.6), spielerStart]],
    ]);
    return {
      id: 'buero', gruppe: ziel.gruppe, kollider: ziel.kollider, bodenY: oy,
      grenzen: { x0: X(-hx) + 0.5, x1: X(hx) - 0.5, z0: Z(-hz) + 0.5, z1: Z(hz) - 0.5 },
      spielerStart, spielerBlick: Math.PI, ausgang, personen, aktionen,
      masse: { laenge: BUERO.laenge, breite: BUERO.breite, hoehe: H },
      wegFehler,
      zahlen: { sichtbar: ziel.sichtbar, massiv: ziel.massiv, klein: ziel.klein,
                kollider: ziel.kollider.length, lichter: ziel.lichter || 0, wegFehler: wegFehler.length,
                personen: personen.length },
    };
  }

  return { createHideout, createLaden, createBuero, MASSE: M, LADEN, BUERO };
});
