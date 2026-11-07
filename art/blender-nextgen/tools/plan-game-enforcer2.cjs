'use strict';
// Echtes Spiel (game.js im Integrations-Worktree): Enforcer v2 als Brecher.
// OUT=<ordner> TAG=<name> node <worktree>/art/blender-nextgen/tools/cdp-capture.cjs <worktree>/art/blender-nextgen/tools/plan-game-enforcer2.cjs
const path = require('node:path');
const fs = require('node:fs');
module.exports = async function (api) {
  const tag = process.env.TAG || 'mit-enforcer';
  const out = path.join(process.env.OUT || path.join(api.root, 'art/blender-nextgen/renders/ingame/enforcer-v2'), tag);
  fs.mkdirSync(out, { recursive: true });
  await api.size(1600, 900);
  await api.goto('index.html', 'window.__WEBHERO_TEST__ = true; window.__WEBHERO_SEED = 4711;',
    '!!(window.__dbg && window.__dbg.actorsReady && window.__dbg.glbModels.thug)', 180000);
  await api.ev(`new Promise((ok) => { let n0 = -1, g = 0; const t = setInterval(() => { let n = 0;
    window.__dbg.szene.traverse(() => n++); if (n === n0) g++; else { n0 = n; g = 0; }
    if (g >= 4) { clearInterval(t); ok(true); } }, 400); setTimeout(() => ok(false), 60000); })`);
  await api.ev(`(() => { const o = document.getElementById('overlay'); if (o) o.style.display = 'none'; return true; })()`);
  const rep = { tag };
  rep.laden = await api.ev(`(() => { const g = window.__dbg.glbModels; return {
    gewuenscht: 'assets/enforcer.glb', geladen: !!g.enforcer, quelle: g.enforcer ? g.enforcer.__quelle : null,
    massstab: g.enforcer ? +g.enforcer.scale.toFixed(4) : null, thugMassstab: +g.thug.scale.toFixed(4),
    thugClips: g.thug.clips.length }; })()`);
  // 1) normale Gangs: wer traegt welchen Koerper?
  rep.gangs = await api.ev(`(() => { const d = window.__dbg; d.frier(true); const p = d.player.pos;
    for (let k = 0; k < 4; k++) d.spawnGang(p.x + 40 + k * 3, p.z + 40, 6, 'test');
    const z = {}; for (const e of d.enemies) { const key = e.typ.art + ':' + e.visual.modell + ':' + (e.visual.hautRolle || '-');
      z[key] = (z[key] || 0) + 1; }
    return z; })()`);
  // 2) Ereignisse (M1): Rollen werden nach dem Bau gesetzt (evSetzeRollen)
  rep.ereignisse = await api.ev(`(() => { const d = window.__dbg; if (d.evRuheAus) d.evRuheAus();
    const liste = []; for (const art of ['ueberfall', 'ueberfall', 'bandenstreit', 'ueberfall']) { try { const ev = d.evStarte(art, 3); if (ev) liste.push(ev); } catch (e) { liste.push({ fehler: String(e) }); } }
    let brecherThug = 0, enfFalsch = 0, brecherEnf = 0, gesamt = 0;
    for (const ev of liste) for (const g of (ev.gegner || [])) { gesamt++;
      if (g.typ.art === 'brecher' && g.visual.modell === 'enforcer') brecherEnf++;
      if (g.typ.art === 'brecher' && g.visual.modell !== 'enforcer') brecherThug++;
      if (g.typ.art !== 'brecher' && g.visual.modell === 'enforcer') enfFalsch++; }
    return { ereignisse: liste.length, gegner: gesamt, brecherMitEnforcer: brecherEnf, brecherMitAnderemKoerper: brecherThug,
             enforcerKoerperInAndererRolle: enfFalsch }; })()`);
  // 3) Kampfszene: ein Brecher und ein Schlaeger frei vor dem Helden, Rest weit weg
  rep.szene = await api.ev(`(() => { const d = window.__dbg; const p = d.player.pos;
    let brecher = null, schl = null;
    for (let k = 0; k < 15 && !(brecher && schl); k++) {
      const g = d.spawnGang(p.x + 4, p.z + 5, 6, 'test');
      brecher = brecher || g.enemies.find((e) => e.typ.art === 'brecher');
      schl = schl || g.enemies.find((e) => e.typ.art === 'schlaeger');
    }
    if (!brecher || !schl) return { fehler: 'keine Brecher/Schlaeger-Gang', brecher: !!brecher, schl: !!schl };
    window.__T = { brecher, schl };
    for (const e of d.enemies) if (e !== brecher && e !== schl) { e.visual.root.visible = false; e.pos.set(p.x + 400, 0, p.z + 400); e.hp = 0; e.dead = true; }
    brecher.pos.set(p.x + 1.4, brecher.pos.y, p.z + 2.6); schl.pos.set(p.x - 1.6, schl.pos.y, p.z + 3.4);
    d.schritt(1 / 60, 2);
        const v = brecher.visual; let tris = 0, meshes = 0, weste = 0;
    v.root.traverse((o) => { if (o.isMesh && o.visible) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }
      if (o.name === 'EnemyRoleGear') weste++; });
    const hp = brecher.hpBar && brecher.hpBar.g ? brecher.hpBar.g.getWorldPosition(new window.THREE.Vector3()) : null;
    // Scheitel ueber Kopfknochen (Box3 rechnet kein Skinning)
    let kopf = null; v.root.traverse((o) => { if (o.isBone && /HeadTop_End$/.test(o.name)) kopf = o.getWorldPosition(new window.THREE.Vector3()); });
    return { brecherModell: v.modell, schlaegerModell: schl.visual.modell, hautBrecher: v.hautRolle || null,
             zweiteWeste: weste, meshes, tris: Math.round(tris), hp: brecher.hp, hpMax: brecher.hpMax, radius: brecher.radius,
             groesse: brecher.typ.groesse, scheitel: kopf ? +kopf.y.toFixed(3) : null, lebensbalken: hp ? +hp.y.toFixed(3) : null,
             abstandBalkenScheitel: hp && kopf ? +(hp.y - kopf.y).toFixed(3) : null }; })()`);
  const cam = (dx, dy, dz, tx, ty, tz) => `(() => { const d = window.__dbg; const p = d.player.pos;
    d.aufnahme(p.x + ${dx}, p.y + ${dy}, p.z + ${dz}, p.x + ${tx}, p.y + ${ty}, p.z + ${tz}); return true; })()`;
  // Kampf laufen lassen (echte KI) und dabei angreifen
  const bilder = [];
  for (let i = 0; i < 8; i++) {
    await api.ev(`(() => { const d = window.__dbg; const T = window.__T; d.schritt(1 / 60, ${i ? 20 : 1});
      if (${i} >= 2 && d.tryAttack) d.tryAttack(); d.schritt(1 / 60, 8); return true; })()`);
    await api.ev(cam(2.6, 2.0, -3.8, 0.3, 1.0, 2.6));
    const f = path.join(out, `kampf_${i}.jpg`); await api.shot(f); bilder.push(path.basename(f));
  }
  rep.nachKampf = await api.ev(`(() => { const T = window.__T; return { brecherHp: T.brecher.hp, brecherTot: !!T.brecher.dead,
    schlaegerHp: T.schl.hp }; })()`);
  // K.o.: Leben auf 1, dann treffen
  rep.ko = await api.ev(`(() => { const d = window.__dbg; const T = window.__T; const p = d.player.pos;
    T.brecher.hp = 1; T.brecher.pos.set(p.x + 0.4, T.brecher.pos.y, p.z + 1.2);
    for (let i = 0; i < 6 && !T.brecher.dead; i++) { d.tryAttack && d.tryAttack(); d.schritt(1 / 60, 15); }
    d.schritt(1 / 60, 40); return { tot: !!T.brecher.dead, hp: T.brecher.hp }; })()`);
  await api.ev(cam(2.2, 1.6, -2.8, 0.4, 0.5, 1.2)); await api.shot(path.join(out, 'ko.jpg'));
  // Nah: vorn, hinten, Nacht
  await api.ev(`(() => { const d = window.__dbg; const T = window.__T; const s = T.schl; s.dead = true; s.visual.root.visible = false;
    const p = d.player.pos; const n = d.spawnGang(p.x + 3, p.z + 3, 10, 'test');
    const b = d.enemies.find((e) => !e.dead && e.typ.art === 'brecher' && e.pos.distanceTo(p) < 12) || null;
    for (const e of d.enemies) if (e !== b) { e.visual.root.visible = false; e.pos.set(p.x + 400, 0, p.z + 400); e.dead = true; }
    if (b) { b.pos.set(p.x + 0.5, b.pos.y, p.z + 3.0); window.__T.nah = b; }
    d.schritt(1 / 60, 3); return !!b; })()`);
  const nah = (dx, dz) => `(() => { const d = window.__dbg; const b = window.__T.nah; if (!b) return false; d.schritt(1 / 60, 2); const e = b.visual.root.position;
    d.aufnahme(e.x + ${dx}, e.y + 1.8, e.z + ${dz}, e.x, e.y + 1.05, e.z); return true; })()`;
  await api.ev(nah(1.3, -3.0)); await api.shot(path.join(out, 'nah_vorn.jpg'));
  await api.ev(nah(-1.0, 3.0)); await api.shot(path.join(out, 'nah_ruecken.jpg'));
  await api.ev(`(() => { window.__setzeZeit && window.__setzeZeit(0.02); window.__dbg.schritt(1 / 60, 30); return true; })()`);
  await api.ev(nah(1.6, -3.4)); await api.shot(path.join(out, 'nacht.jpg'));
  rep.konsoleFehler = api.console.filter((l) => /error|EXCEPTION/i.test(l) && !/X4000/.test(l)).slice(0, 20);
  fs.writeFileSync(path.join(out, 'test.json'), JSON.stringify(rep, null, 1));
  api.log(rep);
};
