'use strict';
// Ingame-Test des Enforcers im ECHTEN Spiel (game.js + index.html), nur in einem Wegwerf-Worktree
// mit angewendetem adoption/enforcer-game.patch und assets/enforcer.glb.
// node art/blender-nextgen/tools/cdp-capture.cjs art/blender-nextgen/tools/plan-game-enforcer.cjs
const path = require('node:path');
const fs = require('node:fs');
module.exports = async function (api) {
  const out = process.env.OUT || path.join(api.root, 'art/blender-nextgen/renders/ingame/enforcer');
  fs.mkdirSync(out, { recursive: true });
  await api.size(1600, 900);
  await api.goto('index.html', 'window.__WEBHERO_TEST__ = true; window.__WEBHERO_SEED = 4711;',
    '!!(window.__dbg && window.__dbg.actorsReady && window.__dbg.glbModels.thug)', 180000);
  // wie tools/pruef/basis.js: Szene zur Ruhe kommen lassen, Startmenue ausblenden
  await api.ev(`new Promise((ok) => { let n0 = -1, gleich = 0; const t = setInterval(() => { let n = 0;
    window.__dbg.szene.traverse(() => n++); if (n === n0) gleich++; else { n0 = n; gleich = 0; }
    if (gleich >= 4) { clearInterval(t); ok(true); } }, 400); setTimeout(() => ok(false), 60000); })`);
  await api.ev(`(() => { const o = document.getElementById('overlay'); if (o) o.style.display = 'none'; return true; })()`);
  const rep = {};
  rep.load = await api.ev(`(() => { const g = window.__dbg.glbModels;
    return { slots: Object.keys(g), enforcer: !!g.enforcer, enforcerScale: g.enforcer && g.enforcer.scale,
             thugClips: g.thug.clips.length }; })()`);
  // Mehrere Gangs neben dem Spieler, bis mindestens zwei Enforcer dabei sind (Rollenwahl ist zufaellig)
  rep.spawn = await api.ev(`(() => { const d = window.__dbg; d.frier(true);
    const p = d.player.pos; let n = 0, tries = 0;
    while (n < 2 && tries < 12) { const g = d.spawnGang(p.x + 6, p.z + 6, 6, 'test'); tries++;
      n = d.enemies.filter((e) => e.visual && e.visual.modell === 'enforcer').length; }
    return { tries, enforcer: n, gesamt: d.enemies.length,
      arten: d.enemies.map((e) => e.typ.art + ':' + e.visual.modell) }; })()`);
  // Einen Enforcer und einen Schlaeger nebeneinander frei vor die Kamera stellen
  rep.figuren = await api.ev(`(() => { const d = window.__dbg; const p = d.player.pos;
    const enf = d.enemies.find((e) => e.visual.modell === 'enforcer');
    const thug = d.enemies.find((e) => e.visual.modell === 'thug' && e.typ.art === 'schlaeger') || d.enemies.find((e) => e.visual.modell === 'thug');
    window.__T = { enf, thug };
    for (const e of d.enemies) if (e !== enf && e !== thug) { e.visual.root.visible = false; e.pos.set(p.x + 300, 0, p.z + 300); }
    const gear = []; enf.visual.root.traverse((o) => { if (o.name === 'EnemyRoleGear') gear.push(o.name); });
    let tris = 0, calls = 0; enf.visual.root.traverse((o) => { if (o.isMesh && o.visible) { calls++;
      tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    return { enfArt: enf.typ.art, enfHp: enf.hp, thugArt: thug.typ.art, rolleGear: gear.length,
             cityGearIstPlatzhalter: !!enf.visual.cityGear && !enf.visual.cityGear.isObject3D,
             hautRolle: enf.visual.hautRolle || null, meshes: calls, tris: Math.round(tris) }; })()`);
  // Kampf laufen lassen: echte Spiel-KI, echte Clips. Bilder aus fester Kamera.
  const frames = [];
  for (let i = 0; i < 6; i++) {
    await api.ev(`(() => { const d = window.__dbg; const p = d.player.pos;
      d.schritt(1 / 60, ${i === 0 ? 1 : 45});
      const T = window.__T;
      T.enf.pos.set(p.x + 2.2, T.enf.pos.y, p.z + 3.2); T.thug.pos.set(p.x - 1.4, T.thug.pos.y, p.z + 3.6);
      d.schritt(1 / 60, 1);
      d.aufnahme(p.x + 0.4, p.y + 2.1, p.z - 4.2, p.x + 0.5, p.y + 1.0, p.z + 3.2); return true; })()`);
    const f = path.join(out, `kampf_${i}.jpg`); await api.shot(f); frames.push(f);
  }
  // Nahaufnahmen: vorn, Ruecken, Nacht
  await api.ev(`(() => { const d = window.__dbg; const T = window.__T; const e = T.enf.visual.root.position;
    d.aufnahme(e.x + 1.2, e.y + 1.9, e.z - 3.2, e.x, e.y + 1.1, e.z); return true; })()`);
  await api.shot(path.join(out, 'nah_vorn.jpg'));
  await api.ev(`(() => { const d = window.__dbg; const T = window.__T; const e = T.enf.visual.root.position;
    d.aufnahme(e.x - 1.0, e.y + 1.9, e.z + 3.2, e.x, e.y + 1.1, e.z); return true; })()`);
  await api.shot(path.join(out, 'nah_ruecken.jpg'));
  await api.ev(`(() => { window.__setzeZeit && window.__setzeZeit(0.02); const d = window.__dbg; d.schritt(1 / 60, 30);
    const T = window.__T; const e = T.enf.visual.root.position;
    d.aufnahme(e.x + 1.6, e.y + 2.0, e.z - 3.6, e.x, e.y + 1.1, e.z); return true; })()`);
  await api.shot(path.join(out, 'nacht.jpg'));
  rep.konsole = api.console.filter((l) => /error|fehler|EXCEPTION/i.test(l)).slice(0, 20);
  rep.bilder = fs.readdirSync(out);
  fs.writeFileSync(path.join(out, 'ingame-test.json'), JSON.stringify(rep, null, 1));
  api.log(rep);
};
