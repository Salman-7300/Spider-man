/* Teil 20 Bruecke: in fuenf Spuren einmal ueber die Bruecke laufen -
   hin und zurueck. Gemessen wird, wo der Spieler stecken bleibt, wo es
   eine Stufe gibt und ob er ins Wasser faellt. */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const BZ = -25;
    const spuren = [
      ['Gehweg Nord aussen', BZ - 8.6],
      ['Gehweg Nord innen',  BZ - 6.4],
      ['Fahrbahn Mitte',     BZ],
      ['Gehweg Sued innen',  BZ + 6.4],
      ['Gehweg Sued aussen', BZ + 8.6],
    ];
    const X0 = 181, X1 = 334;
    const berichte = [];
    for (const [name, z] of spuren) {
      for (const dir of [1, -1]) {
        const startX = dir > 0 ? X0 - 12 : X1 + 12;
        const zielX  = dir > 0 ? X1 + 12 : X0 - 12;
        d.setzePos(startX, 0.3, z);
        P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft']) d.taste(t, false);
        P.facing = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        d.setzeKamYaw(P.facing + Math.PI);
        d.taste('KeyW', true);
        let festX = null, festT = 0, vx = P.pos.x, vy = P.pos.y;
        let festUmfeld = null, festOrt = null;
        let stufe = 0, stufeX = null, tiefY = P.pos.y, driftZ = 0, driftX = null;
        for (let i = 0; i < 60 * 90; i++) {
          d.schritt(1 / 60);
          const dy = P.pos.y - vy;
          if (P.onGround && Math.abs(dy) > stufe) { stufe = Math.abs(dy); stufeX = +P.pos.x.toFixed(1); }
          tiefY = Math.min(tiefY, P.pos.y);
          if (Math.abs(P.pos.z - z) > driftZ) { driftZ = Math.abs(P.pos.z - z); driftX = +P.pos.x.toFixed(1); }
          const weg = Math.hypot(P.pos.x - vx, P.pos.y - vy);
          if (weg < 0.004) {
            festT += 1 / 60;
            if (festT > 0.9 && festX === null) {
              festX = +P.pos.x.toFixed(2);
              /* ---- Warum steht er? ----
                 Die blosse Meldung "FEST bei x=180,55" hat mich vier
                 Laeufe lang raten lassen. Hier wird im Augenblick des
                 Stehenbleibens aufgeschrieben, WAS in der Naehe ist:
                 bewegliche Dinge (Auto, Zivilist, Gegner) und der
                 naechste statische Kollider. */
              const nah = [];
              for (const c of d.cars || []) {
                const p3 = c.pos || (c.mesh && c.mesh.position);
                if (!p3) continue;
                const dd2 = Math.hypot(p3.x - P.pos.x, p3.z - P.pos.z);
                if (dd2 < 6) nah.push('Auto ' + dd2.toFixed(1) + ' m');
              }
              for (const c of d.civilians || []) {
                const dd2 = Math.hypot(c.pos.x - P.pos.x, c.pos.z - P.pos.z);
                if (dd2 < 4) nah.push('Zivilist ' + dd2.toFixed(1) + ' m (' + c.state + ')');
              }
              for (const e of d.enemies || []) {
                const dd2 = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
                if (dd2 < 4) nah.push('Gegner ' + dd2.toFixed(1) + ' m');
              }
              let best = null;
              for (const c of d.colliders || []) {
                if (!c.box) continue;
                const bx = Math.max(c.box.min.x - P.pos.x, 0, P.pos.x - c.box.max.x);
                const bz = Math.max(c.box.min.z - P.pos.z, 0, P.pos.z - c.box.max.z);
                const dd2 = Math.hypot(bx, bz);
                if (!best || dd2 < best.d) best = { d: dd2, c };
              }
              if (best && best.d < 3) {
                nah.push('Kollider ' + best.d.toFixed(2) + ' m ' +
                  (best.c.art || best.c.typ || best.c.name || '?') +
                  ' y ' + best.c.box.min.y.toFixed(1) + '..' + best.c.box.max.y.toFixed(1) +
                  (best.c.klein ? ' klein' : ''));
              }
              festUmfeld = nah.join(' | ') || 'nichts in Reichweite';
              festOrt = [+P.pos.x.toFixed(1), +P.pos.y.toFixed(2), +P.pos.z.toFixed(1)];
            }
          } else festT = 0;
          vx = P.pos.x; vy = P.pos.y;
          if (dir > 0 ? P.pos.x > zielX : P.pos.x < zielX) break;
        }
        d.taste('KeyW', false);
        berichte.push({ spur: name, richtung: dir > 0 ? 'Ost' : 'West',
          durch: dir > 0 ? P.pos.x > zielX : P.pos.x < zielX,
          endeX: +P.pos.x.toFixed(1), tiefY: +tiefY.toFixed(2),
          maxStufe: +stufe.toFixed(3), stufeX, driftZ: +driftZ.toFixed(2), driftX,
          festBei: festX, festUmfeld, festOrt });
      }
    }
    return berichte;
  });
  let schlimm = 0;
  for (const r of aus) {
    const ok = r.durch && r.tiefY > -0.5 && r.festBei === null;
    if (!ok) schlimm++;
    console.log((ok ? 'ok   ' : 'FEHL ') + r.spur.padEnd(20) + r.richtung.padEnd(6) +
      'Ende x=' + r.endeX + ' tiefstes y=' + r.tiefY +
      ' groesste Stufe=' + r.maxStufe + (r.stufeX !== null ? '@x' + r.stufeX : '') +
      ' Abdrift z=' + r.driftZ + '@x' + r.driftX + (r.festBei !== null ? ' FEST bei x=' + r.festBei : ''));
    if (r.festBei !== null)
      console.log('       steht bei ' + JSON.stringify(r.festOrt) + ': ' + r.festUmfeld);
  }
  console.log('Spuren:', aus.length, '| fehlerhaft:', schlimm);
  await b.close();
})();
