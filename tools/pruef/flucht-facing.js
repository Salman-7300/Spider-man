/* Zeigt ein Gegner dorthin, wo er hinlaeuft?

   Human-Playtest: "Gegner laufen teilweise VOM Spieler weg, aber Koerper
   und Laufanimation zeigen ZUM Spieler. Es sieht aus, als wuerden sie
   vorwaerts auf Spider-Man zurennen, waehrend ihre Weltposition
   rueckwaerts davonlaeuft."

   Gemessen wird genau das, was der Auftrag nennt: das Skalarprodukt aus
   Blickrichtung und tatsaechlicher Bewegungsrichtung.

     +1  laeuft genau dorthin, wohin er schaut   (normaler Lauf)
      0  laeuft seitwaerts
     -1  laeuft genau rueckwaerts

   Zwei Faelle sind ausdruecklich verschieden:

     ECHTE FLUCHT (e.flieht)  - er soll sich wegdrehen und weglaufen.
                                Erwartet wird ueberwiegend deutlich
                                positiv, im stabilen Lauf ueber 0,7.
     RUECKZUG                 - er DARF den Helden ansehen und Abstand
                                vergroessern. Dann muss die Darstellung
                                aber rueckwaerts laufen, nicht vorwaerts.

   Aufruf:  node tools/pruef/flucht-facing.js */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 600, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    d.setzeMissionCd(1e9);

    const schritte = (n) => { for (let i = 0; i < n; i++) d.schritt(1 / 60); };
    /* Genau EIN Gegner, an einem bekannten Ort. */
    const einer = (x, z, px, pz) => {
      d.enemies.length = 0;
      if (d.gangs) d.gangs.length = 0;
      d.setzePos(px, 0.05, pz);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.dead = false; P.hp = 100;
      const g = d.spawnGang(x, z, 1, 'test');
      const e = g.enemies[0];
      const gy = d.groundYAt(x, z, 2);
      e.pos.set(x, gy === null || gy === undefined ? 0 : gy, z);
      if (e.visual && e.visual.root) e.visual.root.position.copy(e.pos);
      e.state = 'chase'; e.target = 'player';
      schritte(10);
      return e;
    };
    /* Eine Bewegung ueber n Bilder abtasten: Skalarprodukt, Tempo,
       Rueckwaertskennzeichnung und der gespielte Clip. */
    const messe = (e, bilder) => {
      const punkte = [];
      let rueck = 0, vor = 0, seit = 0, clipRueck = 0;
      let fliehtBilder = 0, abkehrBlick = 0, abkehrLauf = 0, schlimm = 0;
      const echt = [];
      for (let i = 0; i < bilder; i++) {
        const vx0 = e.pos.x, vz0 = e.pos.z;
        d.schritt(1 / 60);
        const v = Math.hypot(e.vel.x, e.vel.z);
        if (v < 1.2) continue;                 // steht praktisch
        const p = e.laufPunkt === undefined ? 1 : e.laufPunkt;
        /* Zweite, ehrlichere Messung: nicht die GEWOLLTE Geschwindigkeit,
           sondern der wirklich zurueckgelegte Weg. Nur so sieht man, ob
           die Wand die Bewegung zur Seite schiebt. */
        {
          const sx = e.pos.x - vx0, sz = e.pos.z - vz0;
          const sl = Math.hypot(sx, sz);
          if (sl > 0.004) {
            const bx2 = Math.sin(e.facing), bz2 = Math.cos(e.facing);
            echt.push(+((bx2 * sx + bz2 * sz) / sl).toFixed(3));
          }
        }
        if (e.flieht) fliehtBilder++;
        /* Zusaetzlich getrennt messen, was der Mensch beschrieben hat:
           Laeuft die Weltposition vom Helden weg (abkehrLauf), waehrend
           der Koerper zum Helden schaut (abkehrBlick falsch)? */
        const wx = e.pos.x - P.pos.x, wz = e.pos.z - P.pos.z;
        const wl = Math.hypot(wx, wz) || 1;
        const bx = Math.sin(e.facing), bz = Math.cos(e.facing);
        const blickWeg = (bx * wx + bz * wz) / wl;
        const laufWeg = (e.vel.x * wx + e.vel.z * wz) / (wl * v);
        if (blickWeg > 0.5) abkehrBlick++;
        if (laufWeg > 0.5) abkehrLauf++;
        /* Der gemeldete Fehler in Reinform: weg vom Helden laufen, zum
           Helden schauen, und dabei den Vorwaertslauf abspielen. */
        const li0 = e.visual && e.visual.laufInfo ? e.visual.laufInfo() : null;
        if (laufWeg > 0.5 && blickWeg < -0.5 && (!li0 || li0.faktor > 0)) schlimm++;
        punkte.push(+p.toFixed(3));
        if (p > 0.35) vor++; else if (p < -0.35) { rueck++; } else seit++;
        /* Nicht nach einem Merker fragen, den es nicht gibt, sondern nach
           dem, was wirklich am Clip steht: laufInfo() gibt den zuletzt
           gesetzten Abspielfaktor zurueck, und der ist bei rueckwaerts
           negativ. */
        const li = e.visual && e.visual.laufInfo ? e.visual.laufInfo() : null;
        if (li && li.faktor < 0) clipRueck++;
      }
      punkte.sort((a, b2) => a - b2);
      const echtS = echt.slice().sort((a, b2) => a - b2);
      return {
        proben: punkte.length,
        min: punkte.length ? punkte[0] : null,
        median: punkte.length ? punkte[Math.floor(punkte.length / 2)] : null,
        max: punkte.length ? punkte[punkte.length - 1] : null,
        vor, seit, rueck, clipRueck,
        fliehtBilder, abkehrBlick, abkehrLauf, schlimm,
        echtMedian: echtS.length ? echtS[Math.floor(echtS.length / 2)] : null,
        echtMin: echtS.length ? echtS[0] : null,
        echtProben: echtS.length,
        anteilUeber07: punkte.length
          ? +(punkte.filter((q) => q > 0.7).length / punkte.length).toFixed(3) : null,
      };
    };

    const R = { flucht: [], rueckzug: null, innenRaum: null };

    /* ---- Fall B: echte Flucht ---- */
    const faelle = [
      ['gerade',   [40, 40], [30, 40]],
      ['diagonal', [40, 40], [32, 32]],
      ['Ecke',     [-170, -170], [-160, -160]],
      ['Uferseite',[360, 40], [350, 40]],
    ];
    for (const [name, [ex, ez], [px, pz]] of faelle) {
      const e = einer(ex, ez, px, pz);
      /* Mut brechen - dieselbe Bedingung wie im Spiel. */
      e.mut = 0; e.hp = Math.max(1, Math.round(e.hpMax * 0.15));
      schritte(20);
      const m = messe(e, 240);
      R.flucht.push({ name, flieht: !!e.flieht, ...m });
    }

    /* ---- Fall B2: dieselbe Flucht INNEN, im Missionsversteck ----
       Der Auftrag verlangt ausdruecklich Indoor UND Outdoor. Drinnen ist
       es ein anderer Fall: enge Waende, kein Fluchtpunkt am Stadtrand,
       und updateEnemies laesst drinnen nur Storygegner laufen. */
    {
      d.innenBetreten({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0, z: 0 }, 0);
      for (let i = 0; i < 60 && !d.innenAktiv; i++) d.schritt(1 / 60);
      if (d.innenAktiv) {
        const raum = d.innen.raum;
        R.innenRaum = raum ? {
          x0: +raum.grenzen.x0.toFixed(1), x1: +raum.grenzen.x1.toFixed(1),
          z0: +raum.grenzen.z0.toFixed(1), z1: +raum.grenzen.z1.toFixed(1),
        } : null;
        /* Beide stehen in der Haupthalle, der Held zwischen Tuer und
           Gegner - der Gegner muss also nach hinten fliehen. */
        const e = einer(994, 1000, 989.5, 1000);
        e.storyGegner = true;                 // sonst ueberspringt ihn die Schleife
        e.mut = 0; e.hp = Math.max(1, Math.round(e.hpMax * 0.15));
        schritte(20);
        const m = messe(e, 240);
        R.flucht.push({ name: 'Innen', innen: true, flieht: !!e.flieht,
          endeX: +e.pos.x.toFixed(1), endeZ: +e.pos.z.toFixed(1), ...m });
        d.innenSofortRaus({ x: 0, y: 0, z: 0 }, 0);
        d.schritt(1 / 60);
      } else {
        R.flucht.push({ name: 'Innen', fehler: 'Innenraum nicht aktiv' });
      }
    }

    /* ---- Fall A: Rueckzug, Blick bleibt beim Helden ---- */
    {
      const e = einer(40, 40, 36, 40);
      e.mut = 0.8;
      e.rueckzugT = 4.0;                 // dasselbe Feld, das das Spiel setzt
      const m = messe(e, 180);
      R.rueckzug = { ...m, rueckzugRest: +(e.rueckzugT || 0).toFixed(2) };
    }
    return R;
  });

  const p = (s) => console.log(s);
  const zeile = (n, m) => '  ' + String(n).padEnd(12) +
    String(m.proben).padStart(7) + String(m.min).padStart(8) +
    String(m.median).padStart(8) + String(m.max).padStart(8) +
    String(m.vor).padStart(7) + String(m.seit).padStart(7) + String(m.rueck).padStart(8) +
    String(m.anteilUeber07).padStart(9) + String(m.clipRueck).padStart(11);
  p('');
  p('Skalarprodukt aus Blickrichtung und Bewegungsrichtung');
  p('  Fall         Proben     min  Median     max    vor   seit  rueck  Anteil>0,7  Clip rueck');
  p('  -- ECHTE FLUCHT: soll deutlich positiv sein --');
  for (const f of aus.flucht) {
    if (f.fehler) { p('  ' + String(f.name).padEnd(12) + ' ' + f.fehler); continue; }
    p(zeile(f.name, f));
  }
  p('');
  p('  Fall           Bilder  flieht  Blick weg  Lauf weg  FEHLERBILD  Weg-Median  Weg-min');
  const z2 = (f) => '  ' + String(f.name).padEnd(12) + String(f.proben).padStart(8) +
    String(f.fliehtBilder).padStart(8) + String(f.abkehrBlick).padStart(11) +
    String(f.abkehrLauf).padStart(10) + String(f.schlimm).padStart(12) +
    String(f.echtMedian).padStart(12) + String(f.echtMin).padStart(9);
  for (const f of aus.flucht) { if (!f.fehler) p(z2(f)); }
  if (aus.rueckzug) p(z2({ name: 'Rueckzug', ...aus.rueckzug }));
  p('');
  if (aus.innenRaum) p('  Innenraum: x ' + aus.innenRaum.x0 + '...' + aus.innenRaum.x1 +
    '  z ' + aus.innenRaum.z0 + '...' + aus.innenRaum.z1);
  p('  -- RUECKZUG: darf negativ sein, muss dann rueckwaerts dargestellt werden --');
  if (aus.rueckzug) p(zeile('Rueckzug', aus.rueckzug));
  await b.close();
})();
