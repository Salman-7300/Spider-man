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
     Laenge und Breite sind an der Spielerkamera gemessen, nicht gewaehlt:
     die Kamera steht im Innenraum 5,2 m hinter der Figur (siehe
     INNEN_KAMERA in game.js). Damit sie beim Blick quer durch die Halle
     nicht in der Rueckwand steht, braucht die Halle mehr als das Doppelte
     dieses Abstands in beiden Richtungen. 30 x 22 m erfuellt das mit
     Reserve und traegt 4 bis 6 Gegner, ohne dass sie sich stapeln. */
  const M = {
    laenge: 30,          // x
    breite: 22,          // z
    hoehe: 5.2,
    wand: 0.6,           // Wandstaerke
    trennwand: 0.5,
  };

  const materialien = () => ({
    /* Sichtbeton, matt. Lambert reicht - der Raum hat kein Sonnenlicht,
       das sich in Lack spiegeln koennte. */
    beton: new THREE.MeshLambertMaterial({ color: 0x55565b }),
    wand: new THREE.MeshLambertMaterial({ color: 0x3c3d43 }),
    stahl: new THREE.MeshPhongMaterial({ color: 0x70757e, shininess: 38, specular: 0x2a2d33 }),
    holz: new THREE.MeshLambertMaterial({ color: 0x6d5137 }),
    metall: new THREE.MeshLambertMaterial({ color: 0x4c5057 }),
    /* Industrieleuchten. Basic, damit sie leuchten, ohne dass dafuer
       zusaetzliche Lichtquellen in die Szene muessen - jede neue Lampe
       liesse alle Materialien neu uebersetzen. */
    lampe: new THREE.MeshBasicMaterial({ color: 0xffe6b4 }),
    /* Bodenmarkierung: eigener Offset, siehe Kopfkommentar. */
    farbe: new THREE.MeshLambertMaterial({ color: 0xb9a441,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  });

  const kastenGeo = new THREE.BoxGeometry(1, 1, 1);
  const flaecheGeo = new THREE.PlaneGeometry(1, 1);
  const rohrGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);

  /* Ein Bauhelfer: Kasten setzen, optional als Kollisionskasten melden.
     mittig in x/z, Unterkante bei y. */
  function bau(ziel, mat, x, y, z, bx, by, bz, kollision, klein) {
    const m = new THREE.Mesh(kastenGeo, mat);
    m.position.set(x, y + by / 2, z);
    m.scale.set(bx, by, bz);
    m.castShadow = false; m.receiveShadow = true;
    ziel.gruppe.add(m);
    ziel.sichtbar++;
    if (kollision) {
      ziel.kollider.push({ x0: x - bx / 2, x1: x + bx / 2,
                           z0: z - bz / 2, z1: z + bz / 2,
                           h: y + by, y0: y, klein: !!klein, innen: true });
      ziel.massiv++;
    }
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

  /* =================== Das Gang-Versteck ===================
     Zonen, vom Eingang zum Hinterausgang:

       A  Eingang    x -15 .. -9    schmaler Vorraum, Durchlass in der Mitte
       B  Haupthalle x  -9 .. +9    Kampfflaeche
       C  Geisel     x  +1 .. +9, z +5,5 .. +11   abgeschirmte Ecke
       D  Funker     x  +9 .. +15   Kommandopunkt mit Funktisch
       Hinterausgang an der Ostwand

     opt: { x, y, z } Ursprung in der Welt (Mitte des Raums, y = Fussboden) */
  function createHideout(opt) {
    const o = opt || {};
    const ox = o.x === undefined ? 0 : o.x;
    const oy = o.y === undefined ? 0 : o.y;
    const oz = o.z === undefined ? 0 : o.z;
    const mat = materialien();
    const ziel = { gruppe: new THREE.Group(), kollider: [], sichtbar: 0, massiv: 0, klein: 0 };
    ziel.gruppe.name = 'WEB_HERO_Interior_Hideout';

    const hx = M.laenge / 2, hz = M.breite / 2;      // 15 / 11
    const X = (v) => ox + v, Z = (v) => oz + v;      // lokal -> Welt

    /* ---- Fussboden: GENAU EINE Flaeche, genau auf der Ursprungshoehe ---- */
    const boden = new THREE.Mesh(flaecheGeo, mat.beton);
    boden.rotation.x = -Math.PI / 2;
    boden.position.set(X(0), oy, Z(0));
    boden.scale.set(M.laenge, M.breite, 1);
    boden.receiveShadow = true;
    ziel.gruppe.add(boden); ziel.sichtbar++;

    /* ---- Decke ---- */
    const decke = new THREE.Mesh(flaecheGeo, mat.wand);
    decke.rotation.x = Math.PI / 2;
    decke.position.set(X(0), oy + M.hoehe, Z(0));
    decke.scale.set(M.laenge, M.breite, 1);
    ziel.gruppe.add(decke); ziel.sichtbar++;

    /* ---- Aussenwaende ----
       Geschlossen, auch dort, wo eine Tuer zu sehen ist. Die Tuer ist ein
       Sichtobjekt; hindurch geht es ueber den Uebergang, nicht ueber ein
       Loch. Ein echtes Loch waere ein Weg in die leere Welt. */
    const wy = M.hoehe;
    bau(ziel, mat.wand, X(-hx - M.wand / 2), oy, Z(0), M.wand, wy, M.breite + M.wand * 2, true);
    bau(ziel, mat.wand, X(hx + M.wand / 2), oy, Z(0), M.wand, wy, M.breite + M.wand * 2, true);
    bau(ziel, mat.wand, X(0), oy, Z(-hz - M.wand / 2), M.laenge, wy, M.wand, true);
    bau(ziel, mat.wand, X(0), oy, Z(hz + M.wand / 2), M.laenge, wy, M.wand, true);

    /* ---- Deckel gegen das Herausspringen ----
       Ein Kasten mit Unterkante auf Deckenhoehe. collideBody laesst ihn
       liegen, solange der Kopf darunter ist (p.y + 1,75 < y0), und
       begrenzt erst, wenn die Figur wirklich hinaufkommt. Ohne ihn waere
       ein Doppelsprung an der Wand ein Weg nach draussen. */
    ziel.kollider.push({ x0: X(-hx), x1: X(hx), z0: Z(-hz), z1: Z(hz),
                         y0: oy + M.hoehe, h: oy + M.hoehe + 1.4, innen: true });

    /* ---- Tuerblaetter (nur Optik) ---- */
    bau(ziel, mat.stahl, X(-hx + 0.12), oy, Z(0), 0.16, 2.7, 2.2, false);
    bau(ziel, mat.stahl, X(hx - 0.12), oy, Z(0), 0.16, 2.7, 2.4, false);
    /* Ein Leuchtschild ueber dem Hinterausgang - der Weg hinaus muss
       lesbar sein, ohne dass ein Pfeil ins Bild geschrieben wird. */
    bau(ziel, mat.lampe, X(hx - 0.3), oy + 2.85, Z(0), 0.1, 0.34, 1.1, false);

    /* ---- Zone A: Vorraum ----
       Zwei Wandstuecke mit einem Durchlass in der Mitte. Der Eingang ist
       damit ein Flur und nicht die Kante der Halle. */
    bau(ziel, mat.wand, X(-9), oy, Z(-hz / 2 - 1.75), M.trennwand, 4.0, hz - 3.5, true);
    bau(ziel, mat.wand, X(-9), oy, Z(hz / 2 + 1.75), M.trennwand, 4.0, hz - 3.5, true);

    /* ---- Stahltraeger unter der Decke ---- */
    for (const tx of [-9, -3, 3, 9]) {
      bau(ziel, mat.stahl, X(tx), oy + M.hoehe - 0.45, Z(0), 0.35, 0.45, M.breite, false);
    }
    /* ---- Saeulen ----
       Bewusst aus der Mittelachse heraus: der Hauptweg vom Eingang zum
       Hinterausgang bleibt frei. */
    for (const [px, pz] of [[-3, -6.5], [-3, 6.5], [5.5, -6.5], [5.5, 6.5]]) {
      bau(ziel, mat.beton, X(px), oy, Z(pz), 0.8, M.hoehe, 0.8, true);
    }

    /* ---- Industrieleuchten ---- */
    for (const [lx, lz] of [[-11, 0], [-4, -5], [-4, 5], [4, 0], [11, -4], [11, 4]]) {
      bau(ziel, mat.metall, X(lx), oy + M.hoehe - 0.75, Z(lz), 1.3, 0.22, 0.55, false);
      bau(ziel, mat.lampe, X(lx), oy + M.hoehe - 0.82, Z(lz), 1.15, 0.07, 0.42, false);
    }

    /* ---- Zone C: der abgeschirmte Geiselbereich ----
       Niedrige Trennwand, damit man von der Halle aus hinueber sieht -
       der Spieler soll wissen, dass dort jemand ist, bevor er hingeht. */
    bau(ziel, mat.metall, X(4), oy, Z(5.5), 6.0, 2.4, 0.4, true);
    bau(ziel, mat.metall, X(1.05), oy, Z(8.2), 0.4, 2.4, 5.0, true);

    /* ---- Massive Requisiten ----
       Regel aus dem Playtest: was sichtbar massiv ist und groesser als ein
       kleines Dekostueck, hat einen Kollisionskasten oder steht ausserhalb
       der begehbaren Flaeche. Kein Durchlaufen. */
    const massiv = [
      /* Werkbaenke */
      [mat.holz, -5.5, -9.4, 5.0, 0.95, 1.1],
      [mat.holz, 3.0, -9.4, 4.0, 0.95, 1.1],
      /* Regal an der Suedwand */
      [mat.metall, 11.0, -9.7, 5.5, 2.3, 0.8],
      /* Kistenstapel in der Halle */
      [mat.holz, -6.0, 3.6, 2.2, 1.7, 2.2],
      [mat.holz, 0.5, -4.2, 1.8, 1.15, 1.8],
      [mat.holz, 5.0, 2.6, 2.0, 1.55, 2.0],
      /* Palette mit Ausruestung bei den Kommandopunkt */
      [mat.holz, 10.5, 6.0, 2.4, 0.9, 1.6],
      /* Grosse Kiste im Vorraum */
      [mat.holz, -12.0, 7.2, 2.6, 2.2, 2.6],
      /* Funk- und Kommandotisch - an der Nordwand, NICHT in der Achse
         zum Hinterausgang. Der erste Entwurf stellte ihn genau dorthin,
         wo der Funker hinauslaufen soll; der Test hat das gefunden. */
      [mat.metall, 12.4, -4.2, 2.4, 0.95, 2.6],
    ];
    for (const [mt, px, pz, bx, by, bz] of massiv) {
      bau(ziel, mt, X(px), oy, Z(pz), bx, by, bz, true);
    }
    /* Zwei Faesser - rund, aber als Kasten kollidierend. */
    for (const [px, pz] of [[-8.0, -5.0], [8.5, -6.5]]) {
      const f = new THREE.Mesh(rohrGeo, mat.metall);
      f.position.set(X(px), oy + 0.48, Z(pz));
      f.scale.set(0.72, 0.96, 0.72);
      ziel.gruppe.add(f); ziel.sichtbar++;
      ziel.kollider.push({ x0: X(px) - 0.36, x1: X(px) + 0.36,
                           z0: Z(pz) - 0.36, z1: Z(pz) + 0.36,
                           h: oy + 0.96, y0: oy, innen: true });
      ziel.massiv++;
    }

    /* ---- Kleinkram OHNE Kollision ----
       Flaschen, Papier, Werkzeug, das Funkgeraet selbst. Eine
       Kollisionswolke aus hundert Kleinteilen waere genau der Fehler, den
       der alte Innenraum hatte. */
    const klein = [
      [mat.metall, 12.4, -3.8, 0.95, 0.5, 0.28, 0.34],  // Funkgeraet auf dem Tisch
      [mat.lampe, 12.0, -4.8, 0.96, 0.42, 0.02, 0.3],   // Karten/Papiere
      [mat.lampe, 12.9, -4.1, 0.96, 0.36, 0.02, 0.26],
      [mat.metall, -5.5, -9.4, 0.95, 0.5, 0.12, 0.3],   // Werkzeug
      [mat.metall, 3.2, -9.4, 0.95, 0.42, 0.1, 0.26],
      [mat.holz, -6.0, 3.6, 1.7, 0.5, 0.35, 0.5],       // Kiste obenauf
      [mat.metall, 11.0, -9.7, 2.3, 0.6, 0.2, 0.5],
    ];
    for (const [mt, px, pz, py, bx, by, bz] of klein) {
      const m = new THREE.Mesh(kastenGeo, mt);
      m.position.set(X(px), oy + py + by / 2, Z(pz));
      m.scale.set(bx, by, bz);
      ziel.gruppe.add(m); ziel.sichtbar++; ziel.klein++;
    }

    /* ---- Bodenmarkierungen ----
       Zwei Zentimeter ueber dem Boden UND mit polygonOffset. Eine von
       beiden Massnahmen allein hat in der Stadt schon geflackert. */
    for (const [px, pz, bx, bz] of [[-9, 0, 0.25, 6.0], [9, 0, 0.25, 5.0]]) {
      const m = new THREE.Mesh(flaecheGeo, mat.farbe);
      m.rotation.x = -Math.PI / 2;
      m.position.set(X(px), oy + 0.02, Z(pz));
      m.scale.set(bx, bz, 1);
      ziel.gruppe.add(m); ziel.sichtbar++;
    }

    /* =================== Punkte ===================
       Alles, was die Mission braucht, kommt fertig geprueft heraus. */
    const spielerStart = { x: X(-13.2), y: oy, z: Z(0) };
    const geiselPunkt = { x: X(5.0), y: oy, z: Z(8.6) };
    /* Der Funker steht VOR seinem Tisch, mit Abstand - der Platz muss
       frei sein, sonst steckt er beim Aufstehen im Kasten. */
    const funkPunkt = { x: X(11.2), y: oy, z: Z(-1.4) };
    const hinterausgang = { x: X(hx - 1.6), y: oy, z: Z(0) };

    /* ---- Gegnerplaetze: abgetastet und geprueft, nicht gewuerfelt ----
       Raster ueber die Haupthalle, jeder Punkt gegen alle gebauten
       Kollisionskaesten geprueft, mit Abstand zum Spielerstart und
       untereinander. */
    const gegnerPunkte = [];
    for (let px = -7; px <= 8; px += 1.5) {
      for (let pz = -8.5; pz <= 8.5; pz += 1.5) {
        const wx = X(px), wz = Z(pz);
        if (!frei(ziel.kollider, wx, wz, 0.75)) continue;
        if (Math.hypot(wx - spielerStart.x, wz - spielerStart.z) < 7) continue;
        if (Math.hypot(wx - geiselPunkt.x, wz - geiselPunkt.z) < 2.5) continue;
        let ok = true;
        for (const q of gegnerPunkte) {
          if (Math.hypot(wx - q.x, wz - q.z) < 3.0) { ok = false; break; }
        }
        if (ok) gegnerPunkte.push({ x: wx, y: oy, z: wz });
      }
    }

    /* ---- Der Weg des Funkers zum Hinterausgang ----
       Drei geprueft freie Stationen. Keine Hausnavigation mehr noetig -
       der Raum ist bekannt. */
    const funkWeg = [
      { x: X(9.0), z: Z(2.4), r: 1.2 },
      { x: X(12.5), z: Z(3.2), r: 1.2 },
      { x: hinterausgang.x, z: hinterausgang.z, r: 1.4 },
    ];

    return {
      id: 'hideout',
      gruppe: ziel.gruppe,
      kollider: ziel.kollider,
      bodenY: oy,
      /* Spielfeldgrenzen im Innenraum: die Innenkante der Waende, minus
         dem Radius einer Figur. */
      grenzen: { x0: X(-hx) + 0.5, x1: X(hx) - 0.5, z0: Z(-hz) + 0.5, z1: Z(hz) - 0.5 },
      kampfFlaeche: { x0: X(-9), x1: X(9), z0: Z(-hz), z1: Z(hz) },
      spielerStart, spielerBlick: Math.PI / 2,      // nach +x
      geiselPunkt, funkPunkt, hinterausgang, funkWeg,
      gegnerPunkte,
      zonen: {
        eingang: { x0: X(-hx), x1: X(-9), z0: Z(-hz), z1: Z(hz) },
        halle: { x0: X(-9), x1: X(9), z0: Z(-hz), z1: Z(hz) },
        geisel: { x0: X(1), x1: X(9), z0: Z(5.5), z1: Z(hz) },
        funk: { x0: X(9), x1: X(hx), z0: Z(-hz), z1: Z(hz) },
      },
      masse: { laenge: M.laenge, breite: M.breite, hoehe: M.hoehe },
      zahlen: { sichtbar: ziel.sichtbar, massiv: ziel.massiv, klein: ziel.klein,
                kollider: ziel.kollider.length, gegnerPunkte: gegnerPunkte.length },
    };
  }

  return { createHideout, MASSE: M };
});
