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
            if (festT > 0.9 && festX === null) festX = +P.pos.x.toFixed(2);
          } else festT = 0;
          vx = P.pos.x; vy = P.pos.y;
          if (dir > 0 ? P.pos.x > zielX : P.pos.x < zielX) break;
        }
        d.taste('KeyW', false);
        berichte.push({ spur: name, richtung: dir > 0 ? 'Ost' : 'West',
          durch: dir > 0 ? P.pos.x > zielX : P.pos.x < zielX,
          endeX: +P.pos.x.toFixed(1), tiefY: +tiefY.toFixed(2),
          maxStufe: +stufe.toFixed(3), stufeX, driftZ: +driftZ.toFixed(2), driftX,
          festBei: festX });
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
  }
  console.log('Spuren:', aus.length, '| fehlerhaft:', schlimm);
  await b.close();
})();
