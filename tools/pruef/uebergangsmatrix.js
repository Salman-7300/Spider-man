/* Test C - Uebergangsmatrix der Spielfigur.
   Die zwanzig geforderten Uebergaenge werden EINZELN und gezielt
   ausgeloest, nicht aus einem Dauerlauf herausgefischt. Je Uebergang
   wird eine Spur mitgeschrieben (Zustand, Bewegungsname, Clip, Ort,
   Geschwindigkeit, Blickrichtung) und daraus gemessen:

     erreicht      kam der Zielzustand ueberhaupt zustande
     dauer         Sekunden vom Auslöser bis zum Zielzustand
     ortSprung     groesster Ortssprung in einem Bild ueber dem, was die
                   Geschwindigkeit hergibt (das ist ein Teleport)
     drehSprung    groesste Drehung in einem Bild (ueber 60 Grad faellt auf)
     clipVor/Nach  welche Bewegungsdatei vorher und nachher lief

   Jede Lage wird frisch aufgebaut; zwischen den Faellen wird die Welt
   geleert, damit kein Auto und kein Gegner dazwischenfunkt. */
const { starte } = require('./basis');
const fs = require('fs');

const AUS = process.argv[2] || null;      // Ordner fuer Bilder, optional

(async () => {
  const { b, page } = await starte(900, 540, 4711);
  const ergebnis = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true);
    /* Verkehr, Passanten und Gegner raus - sie haben in frueheren
       Messungen die Figur ueberfahren und den Zustand verfaelscht. */
    for (const arr of [d.cars, d.civilians, d.enemies]) if (arr) arr.length = 0;

    const ALLE_TASTEN = ['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft',
                         'AltLeft','KeyZ','KeyX','KeyQ','KeyE','KeyF','KeyR'];
    const frei = () => { for (const t of ALLE_TASTEN) d.taste(t, false); };

    /* Eine Spur ueber n Bilder aufzeichnen. tun(i) darf Tasten setzen. */
    function spur(bilder, dt, tun) {
      const s = [];
      for (let i = 0; i < bilder; i++) {
        if (tun) tun(i);
        d.schritt(dt);
        s.push({
          t: +(i * dt).toFixed(3),
          state: P.state, anim: P.anim,
          clip: d.animClipJetzt || null,
          gleiten: !!P.gleiten, wandModus: P.wandModus || null,
          hocke: +(P.hockeT || 0).toFixed(2),
          x: P.pos.x, y: P.pos.y, z: P.pos.z,
          vx: P.vel.x, vy: P.vel.y, vz: P.vel.z,
          yaw: P.facing, onGround: !!P.onGround,
        });
      }
      return s;
    }

    /* Aus einer Spur die Kennzahlen ziehen. trifft(e) sagt, ob ein
       Eintrag schon der Zielzustand ist. */
    function werte(s, trifft, abIndex) {
      const ab = abIndex || 0;
      let idx = -1;
      for (let i = ab; i < s.length; i++) if (trifft(s[i], i)) { idx = i; break; }
      let ortSprung = 0, drehSprung = 0;
      for (let i = Math.max(1, ab); i < s.length; i++) {
        const a = s[i - 1], c = s[i];
        const dt = c.t - a.t;
        const dpos = Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z);
        const v = Math.max(Math.hypot(a.vx, a.vy, a.vz), Math.hypot(c.vx, c.vy, c.vz));
        const ueber = dpos - (v * dt + 0.35);
        if (ueber > ortSprung) ortSprung = ueber;
        let dy = Math.abs(c.yaw - a.yaw) % (Math.PI * 2);
        if (dy > Math.PI) dy = Math.PI * 2 - dy;
        if (dy > drehSprung) drehSprung = dy;
      }
      return {
        erreicht: idx >= 0,
        dauer: idx >= 0 ? +(s[idx].t - s[ab].t).toFixed(3) : null,
        clipVor: s[ab] ? s[ab].clip : null,
        clipNach: idx >= 0 ? s[idx].clip : null,
        animVor: s[ab] ? s[ab].anim : null,
        animNach: idx >= 0 ? s[idx].anim : null,
        ortSprung: +ortSprung.toFixed(3),
        drehSprung: +(drehSprung * 180 / Math.PI).toFixed(1),
        letzter: s[s.length - 1] ? { state: s[s.length - 1].state, anim: s[s.length - 1].anim,
                                     y: +s[s.length - 1].y.toFixed(2) } : null,
      };
    }

    /* Auf eine freie Strasse stellen, Blick nach Osten. */
    function aufStrasse(x, z) {
      frei();
      d.setzePos(x || 0, 1, z || 0);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.facing = Math.PI / 2;
      d.setzeKamYaw(P.facing + Math.PI);
      d.schritt(1 / 60, 10);
    }

    const R = {};
    const DT = 1 / 60;

    /* ---- 1 idle -> walk ---- */
    aufStrasse(0, 0);
    let s = spur(90, DT, (i) => { if (i === 10) { d.taste('AltLeft', true); d.taste('KeyW', true); } });
    R['idle->walk'] = werte(s, (e) => e.state === 'ground' && Math.hypot(e.vx, e.vz) > 1.0, 10);

    /* ---- 2 walk -> run ---- */
    s = spur(120, DT, (i) => {
      if (i === 0) { d.taste('AltLeft', true); d.taste('KeyW', true); }
      if (i === 60) d.taste('AltLeft', false);
    });
    const vGeh = Math.hypot(s[55].vx, s[55].vz);
    R['walk->run'] = werte(s, (e) => Math.hypot(e.vx, e.vz) > vGeh + 1.5, 60);
    R['walk->run'].tempoGehen = +vGeh.toFixed(2);
    R['walk->run'].tempoLaufen = +Math.hypot(s[119].vx, s[119].vz).toFixed(2);

    /* ---- 3 run -> sprint ---- */
    s = spur(150, DT, (i) => {
      if (i === 0) d.taste('KeyW', true);
      if (i === 75) d.taste('ShiftLeft', true);
    });
    const vLauf = Math.hypot(s[70].vx, s[70].vz);
    R['run->sprint'] = werte(s, (e) => Math.hypot(e.vx, e.vz) > vLauf + 1.0, 75);
    R['run->sprint'].tempoLaufen = +vLauf.toFixed(2);
    R['run->sprint'].tempoSprint = +Math.hypot(s[149].vx, s[149].vz).toFixed(2);

    /* ---- 4 run -> jump  und  5 jump -> fall ----
       WICHTIG: der Sprung haengt am Tastendruck, nicht am gehaltenen
       Zustand - im Spiel loest keydown 'Space' direkt tryJump() aus.
       keys['Space'] zu setzen springt deshalb NIE. Der erste Durchlauf
       dieses Tests hat genau daran drei Uebergaenge verloren; d.tippeSprung()
       ist der richtige Weg. */
    aufStrasse(0, 0);
    s = spur(200, DT, (i) => {
      if (i === 0) d.taste('KeyW', true);
      if (i === 40) d.tippeSprung();
    });
    R['run->jump'] = werte(s, (e) => e.state === 'air' && e.vy > 0, 40);
    const iAb = s.findIndex((e, i) => i >= 40 && e.state === 'air' && e.vy > 0);
    R['jump->fall'] = werte(s, (e) => e.state === 'air' && e.vy < 0, iAb < 0 ? 40 : iAb);
    /* ---- 10 fall -> land  und  11 land -> run ---- */
    const iFall = s.findIndex((e, i) => i > (iAb < 0 ? 40 : iAb) && e.state === 'air' && e.vy < 0);
    R['fall->land'] = werte(s, (e) => e.onGround, iFall < 0 ? 60 : iFall);
    const iLand = s.findIndex((e, i) => i > (iFall < 0 ? 60 : iFall) && e.onGround);
    R['land->run'] = werte(s, (e) => e.onGround && Math.hypot(e.vx, e.vz) > 4,
                           iLand < 0 ? 100 : iLand);

    /* ---- 6 fall -> glide ----
       Vom Dach fallen lassen, dann Shift halten. Der Gleitflug braucht
       mehr als 8 m Hoehe und vy unter 2. */
    frei();
    d.setzePos(0, 60, 0);
    P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
    s = spur(150, DT, (i) => { if (i === 30) d.taste('ShiftLeft', true); });
    R['fall->glide'] = werte(s, (e) => e.gleiten, 30);

    /* ---- 7 glide -> swing ---- */
    frei();
    d.setzePos(0, 60, 0);
    P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
    s = spur(260, DT, (i) => {
      if (i === 20) { d.taste('ShiftLeft', true); d.taste('KeyW', true); }
      if (i === 120) d.taste('Space', true);
    });
    R['glide->swing'] = werte(s, (e) => e.state === 'swing', 120);

    /* ---- 8 swing -> release  und  9 release -> fall ---- */
    const iSw = s.findIndex((e) => e.state === 'swing');
    if (iSw >= 0) {
      const s2 = spur(120, DT, (i) => { if (i === 20) d.taste('Space', false); });
      R['swing->release'] = werte(s2, (e) => e.state !== 'swing', 20);
      const iRel = s2.findIndex((e, i) => i >= 20 && e.state !== 'swing');
      R['release->fall'] = werte(s2, (e) => e.state === 'air' && e.vy < 0,
                                 iRel < 0 ? 20 : iRel);
    } else {
      R['swing->release'] = { erreicht: false, grund: 'kein Schwung zustande gekommen' };
      R['release->fall'] = { erreicht: false, grund: 'kein Schwung zustande gekommen' };
    }

    /* ---- 12 run -> wallrun  und  13 wallrun -> jump ----
       Eine Hauswand suchen und mit Anlauf dagegen rennen. */
    const wand = (() => {
      for (const c of d.colliders) {
        if (c.klein) continue;
        if ((c.h || 0) < 20) continue;
        if (Math.abs(c.x0) > 160 || Math.abs(c.z0) > 160) continue;
        return c;
      }
      return null;
    })();
    if (wand) {
      const zm = (wand.z0 + wand.z1) / 2;
      frei();
      d.setzePos(wand.x0 - 14, 1, zm);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      d.schritt(DT, 5);
      s = spur(200, DT, (i) => {
        if (i === 0) { d.taste('KeyW', true); d.taste('ShiftLeft', true); }
        if (i === 120) d.tippeSprung();
      });
      R['run->wallrun'] = werte(s, (e) => e.state === 'climb' && e.wandModus === 'lauf', 0);
      const iWr = s.findIndex((e) => e.state === 'climb');
      R['wallrun->jump'] = iWr >= 0
        ? werte(s, (e, i) => i > 120 && e.state === 'air' && e.vy > 0, 120)
        : { erreicht: false, grund: 'kein Wandlauf zustande gekommen' };
      R['run->wallrun'].wandBei = [Math.round(wand.x0), Math.round(zm), Math.round(wand.h)];

      /* ---- 14 air -> wall attach ---- */
      frei();
      d.setzePos(wand.x0 - 1.2, 14, zm);
      P.state = 'air'; P.onGround = false; P.vel.set(2, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      s = spur(120, DT, (i) => { if (i >= 5) d.taste('KeyZ', true); });
      R['air->wall attach'] = werte(s, (e) => e.state === 'climb', 5);

      /* ---- 15 wall crawl -> corner ----
         An der Wand seitwaerts bis zur Hauskante kriechen. */
      frei();
      d.setzePos(wand.x0 - 0.9, 14, wand.z0 + 3);
      P.state = 'climb'; P.onGround = false; P.vel.set(0, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      d.taste('KeyZ', true);
      d.schritt(DT, 10);
      const zStart = P.pos.z;
      s = spur(260, DT, (i) => { d.taste('KeyZ', true); if (i >= 5) d.taste('KeyA', true); });
      R['wall crawl->corner'] = werte(s, (e) => Math.abs(e.z - zStart) > 2.5, 5);
      R['wall crawl->corner'].eckeErreicht = +(Math.abs(s[s.length - 1].z - wand.z0)).toFixed(2);
      R['wall crawl->corner'].nochAnWand = s[s.length - 1].state === 'climb';

      /* ---- 16 wall crawl -> ledge  und  17 ledge -> roof ---- */
      frei();
      d.setzePos(wand.x0 - 0.9, Math.max(2, (wand.h || 20) - 8), zm);
      P.state = 'climb'; P.onGround = false; P.vel.set(0, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      d.taste('KeyZ', true);
      d.schritt(DT, 10);
      s = spur(420, DT, () => { d.taste('KeyZ', true); d.taste('KeyW', true); });
      R['wall crawl->ledge'] = werte(s, (e) => e.state === 'kante', 0);
      const iK = s.findIndex((e) => e.state === 'kante');
      R['ledge->roof'] = iK >= 0
        ? werte(s, (e, i) => i > iK && e.onGround && e.state === 'ground', iK)
        : { erreicht: false, grund: 'keine Kante erreicht',
            hoeheEnde: +s[s.length - 1].y.toFixed(2), dachHoehe: +(wand.h || 0).toFixed(2) };

      /* ---- 18 perch -> jump ----
         Auf dem Dach hocken und abspringen. */
      frei();
      d.setzePos(wand.x0 + 3, (wand.h || 20) + 1, zm);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      d.schritt(DT, 90);                  // stehen lassen, bis die Hocke greift
      const hockeVor = +(P.hockeT || 0).toFixed(2);
      s = spur(90, DT, (i) => { if (i === 10) d.tippeSprung(); });
      R['perch->jump'] = werte(s, (e) => e.state === 'air' && e.vy > 0, 10);
      R['perch->jump'].hockeVorher = hockeVor;
    } else {
      for (const k of ['run->wallrun','wallrun->jump','air->wall attach',
                       'wall crawl->corner','wall crawl->ledge','ledge->roof','perch->jump']) {
        R[k] = { erreicht: false, grund: 'keine geeignete Hauswand gefunden' };
      }
    }

    /* ---- 19 combat -> air ----
       Der Aufwaertshaken hebt nur mit einem Gegner in Reichweite ab
       (nearestEnemy(2.8) -> starteLuftkombo) und erst ab Stufe 1. Beides
       wird hier ausdruecklich hergestellt, statt zu hoffen. */
    aufStrasse(0, 0);
    let stufeJetzt = d.gibPunkte ? d.gibPunkte(30000) : null;
    if (d.spawnGangAwayFromPlayer) { try { d.spawnGangAwayFromPlayer(); } catch (e) {} }
    d.schritt(DT, 30);
    const gegner = (d.enemies || [])[0] || null;
    if (gegner) {
      /* Direkt vor die Figur setzen - zwei Meter, in Blickrichtung. */
      gegner.pos.set(P.pos.x + Math.sin(P.facing) * 2.0, P.pos.y,
                     P.pos.z + Math.cos(P.facing) * 2.0);
      if (gegner.visual && gegner.visual.root) gegner.visual.root.position.copy(gegner.pos);
      d.schritt(DT, 5);
    }
    s = spur(180, DT, (i) => {
      if (i === 10) d.tryAttack && d.tryAttack();
      if (i === 50) d.uppercut && d.uppercut();
    });
    R['combat->air'] = werte(s, (e) => e.state === 'air', 50);
    R['combat->air'].gegnerAbstand = gegner
      ? +Math.hypot(gegner.pos.x - s[0].x, gegner.pos.z - s[0].z).toFixed(2) : null;
    R['combat->air'].stufe = stufeJetzt;

    /* ---- 20 zip -> air ----
       zipHaltepunkt sucht im Kegel vor der Figur nach einer Fassade. Auf
       der leeren Kreuzung gibt es keine - deshalb wird hier vor eine
       bekannte Hauswand gestellt. */
    if (wand) {
      const zmz = (wand.z0 + wand.z1) / 2;
      frei();
      d.setzePos(wand.x0 - 25, 1, zmz);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      d.schritt(DT, 10);
    } else {
      aufStrasse(0, 0);
    }
    s = spur(240, DT, (i) => { if (i === 10) d.webZip && d.webZip(); });
    const iZip = s.findIndex((e) => e.state === 'zip');
    R['zip->air'] = iZip >= 0
      ? werte(s, (e, i) => i > iZip && e.state === 'air', iZip)
      : { erreicht: false, grund: 'kein Netz-Zug zustande gekommen (kein Anker in Reichweite)' };
    R['zip->air'].zipBegann = iZip >= 0 ? +(iZip * DT).toFixed(3) : null;

    return { R, posen: d.poseFehler ? d.poseFehler() : null };
  });

  const R = ergebnis.R;
  const reihen = [
    'idle->walk','walk->run','run->sprint','run->jump','jump->fall',
    'fall->glide','glide->swing','swing->release','release->fall',
    'fall->land','land->run','run->wallrun','wallrun->jump',
    'air->wall attach','wall crawl->corner','wall crawl->ledge','ledge->roof',
    'perch->jump','combat->air','zip->air',
  ];
  console.log('');
  console.log('Uebergang'.padEnd(22), 'erreicht', 'dauer'.padStart(7),
              'ortSpr'.padStart(7), 'drehSpr'.padStart(8), '  Clip vor -> nach');
  console.log('-'.repeat(100));
  let offen = 0;
  for (const k of reihen) {
    const r = R[k] || { erreicht: false, grund: 'nicht gemessen' };
    if (!r.erreicht) offen++;
    console.log(
      k.padEnd(22),
      (r.erreicht ? 'ja  ' : 'NEIN').padEnd(8),
      (r.dauer == null ? '-' : r.dauer.toFixed(3) + 's').padStart(7),
      (r.ortSprung == null ? '-' : r.ortSprung.toFixed(2)).padStart(7),
      (r.drehSprung == null ? '-' : r.drehSprung.toFixed(0) + '°').padStart(8),
      '  ' + (r.clipVor || '-') + ' -> ' + (r.clipNach || '-') +
      (r.grund ? '   [' + r.grund + ']' : ''));
  }
  console.log('-'.repeat(100));
  console.log(reihen.length - offen + ' von ' + reihen.length + ' Uebergaengen erreicht.');
  console.log('');
  console.log('Zusatzzahlen:', JSON.stringify({
    tempoGehen: R['walk->run'] && R['walk->run'].tempoGehen,
    tempoLaufen: R['walk->run'] && R['walk->run'].tempoLaufen,
    tempoSprint: R['run->sprint'] && R['run->sprint'].tempoSprint,
    hockeVorSprung: R['perch->jump'] && R['perch->jump'].hockeVorher,
    wandBei: R['run->wallrun'] && R['run->wallrun'].wandBei,
  }));
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(R, null, 2));
  await b.close();
})();
