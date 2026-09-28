/* Warum ist der Anfuehrer nach 3,6 Sekunden erledigt?

   Der Auftrag ist ausdruecklich: ERST die Ursache suchen, NICHT als
   Erstes die Lebenspunkte erhoehen. Gemessen wird deshalb der Kampf
   selbst, Schlag fuer Schlag:

     - Lebenspunkte, Deckung, Standfestigkeit beim Erscheinen
     - ist das Elite-Verhalten wirklich an?
     - kommt er beschaedigt an?
     - wie viele Treffer bekommt er, wie stark ist jeder einzelne
     - wie viele Treffer in DEMSELBEN Bild (mehrere Faeuste gleichzeitig)
     - wie oft blockt er, wie oft weicht er aus, wie oft schlaegt er
       selbst zu

   Verglichen wird der Anfuehrer mit einem gewoehnlichen Brecher und
   einem Waechter - sonst weiss man nicht, ob 3,6 s am Anfuehrer liegen
   oder am Kampfsystem.

   Aufruf:  node tools/pruef/anfuehrer.js */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 600, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    d.setzeMissionCd(1e9);

    const faelle = [
      ['Anfuehrer', 'brecher', true],
      ['Brecher', 'brecher', false],
      ['Waechter', 'waechter', false],
      ['Schlaeger', 'schlaeger', false],
    ];
    const R = [];
    for (const [name, art, elite] of faelle) {
      d.enemies.length = 0;
      if (d.gangs) d.gangs.length = 0;
      d.setzePos(40, 0.05, 40);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.dead = false; P.hp = 100;
      const g = d.spawnGang(43, 40, 1, 'story');
      const e = g.enemies[0];
      /* ---- Der Zufall muss hier heraus ----
         spawnGang macht JEDEN Ganoven mit 15 Prozent Wahrscheinlichkeit
         zum Eliten. Im ersten Durchlauf hat das den Vergleichsbrecher
         erwischt, und die Tabelle meldete "Elite: ja" fuer einen
         Gegner, der keiner sein sollte. Der Vergleich wird deshalb
         zurueckgesetzt, bevor die Mission ihre zwei Aufrufe macht. */
      if (e.elite && !elite) {
        e.elite = false;
        if (e.eliteZeichen) { e.visual.root.remove(e.eliteZeichen); e.eliteZeichen = null; }
        e.visual.root.scale.divideScalar(1.04);
      }
      d.stArt(e, art);
      if (elite) { d.machElite(e); e.anfuehrer = true; }
      e.pos.set(43, 0, 40);
      if (e.visual && e.visual.root) e.visual.root.position.copy(e.pos);
      e.state = 'chase'; e.target = 'player';
      for (let i = 0; i < 10; i++) d.schritt(1 / 60);

      const anfang = { hp: e.hp, hpMax: e.hpMax, guard: e.guard, poise: e.poiseRest,
                       elite: !!e.elite, ausweichen: e.typ.ausweichen,
                       blockChance: e.typ.blockChance, kombo: e.typ.kombo,
                       reaktion: +(e.typ.reaktion).toFixed(2) };
      /* Der Spieler schlaegt so schnell, wie das Spiel es zulaesst -
         das ist die Obergrenze, die ein Mensch erreichen kann. */
      let bilder = 0, treffer = 0, versuche = 0, geblockt = 0, ausgewichen = 0;
      let doppel = 0;
      let gegnerAngriffe = 0, spielerSchaden = 0;
      let maxGleich = 0;
      const schaeden = [];
      let vorHp = e.hp, vorGegnerAngriff = false;
      const maxBilder = 60 * 60;                 // eine Minute
      while (!e.dead && bilder < maxBilder) {
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
        const dd = Math.hypot(dx, dz) || 1;
        P.facing = Math.atan2(dx, dz);
        d.setzeKamYaw(P.facing + Math.PI);
        if (dd > 1.8) d.taste('KeyW', true); else d.taste('KeyW', false);
        /* tryAttack() gibt nichts zurueck - im ersten Durchlauf stand
           deshalb in der Spalte "Schlaege" ueberall null. Der zweite
           Versuch zaehlte die Flanke von P.attack, und weil hier in
           JEDEM Bild zugeschlagen wird, laeuft ein Angriff nahtlos in
           den naechsten: die Flanke kam auch nur einmal. Gezaehlt wird
           jetzt der WECHSEL des Angriffsobjekts. */
        if (d.tryAttack) d.tryAttack();
        const vorAngriff = P.attack;
        const hpVorBild = e.hp;
        d.schritt(1 / 60);
        bilder++;
        if (P.attack && P.attack !== vorAngriff) versuche++;
        const weg = hpVorBild - e.hp;
        if (weg > 0.001) {
          treffer++;
          schaeden.push(+weg.toFixed(1));
          spielerSchaden += weg;
          if (weg > maxGleich) maxGleich = weg;
          /* Ein einzelner Schlag richtet nach der Tabelle hoechstens
             rund 20 Schaden an. Mehr in EINEM Bild heisst: zwei Treffer
             gleichzeitig - genau der Fall, nach dem der Auftrag
             fragt. */
          if (weg > 22) doppel++;
        }
        if (e.blockT > 0) geblockt++;
        if (e.attack && !vorGegnerAngriff) gegnerAngriffe++;
        vorGegnerAngriff = !!e.attack;
      }
      d.taste('KeyW', false);
      schaeden.sort((a, b2) => a - b2);
      R.push({ name, anfang,
        sekunden: +(bilder / 60).toFixed(2),
        tot: !!e.dead,
        versuche, treffer,
        schadenGesamt: +spielerSchaden.toFixed(1),
        schadenJeTreffer: treffer ? +(spielerSchaden / treffer).toFixed(1) : 0,
        groessterTreffer: +maxGleich.toFixed(1),
        medianTreffer: schaeden.length ? schaeden[Math.floor(schaeden.length / 2)] : 0,
        blockBilder: geblockt, doppel,
        gegnerAngriffe,
        spielerHpRest: Math.round(P.hp),
        schadenJeSekunde: +(spielerSchaden / (bilder / 60)).toFixed(1) });
      vorHp = vorHp;
      ausgewichen = ausgewichen;
    }
    return R;
  });

  const p = (s) => console.log(s);
  p('');
  p('Der Anfuehrer im Vergleich - je ein Gegner, Spieler schlaegt so schnell er darf');
  p('');
  p('  Gegner       HP  Deck  Stand  Elite  Sek   Schlaege  Treffer  je Treffer  max  Schaden/s  Gegnerangriffe  Spieler-HP');
  for (const r of aus) {
    p('  ' + String(r.name).padEnd(11) +
      String(r.anfang.hpMax).padStart(4) +
      String(r.anfang.guard).padStart(6) +
      String(r.anfang.poise).padStart(7) +
      String(r.anfang.elite ? 'ja' : 'nein').padStart(7) +
      String(r.sekunden).padStart(6) +
      String(r.versuche).padStart(11) +
      String(r.treffer).padStart(9) +
      String(r.schadenJeTreffer).padStart(12) +
      String(r.groessterTreffer).padStart(6) +
      String(r.schadenJeSekunde).padStart(11) +
      String(r.gegnerAngriffe).padStart(16) +
      String(r.spielerHpRest).padStart(12));
  }
  p('');
  for (const r of aus) {
    p('  ' + r.name + ': ausweichen ' + r.anfang.ausweichen +
      ', blockChance ' + r.anfang.blockChance +
      ', kombo ' + r.anfang.kombo + ', reaktion ' + r.anfang.reaktion +
      ', Blockbilder ' + r.blockBilder +
      ', Bilder mit mehr als 22 Schaden auf einmal ' + r.doppel +
      (r.tot ? '' : '  NICHT BESIEGT'));
  }
  await b.close();
})();
