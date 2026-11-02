'use strict';
// Three.js-Abnahme fuer eine Figur (enemy | hero): Vergleich alt/neu bei gleicher Kamera, Zeit, Licht.
// ASSET=enemy node cdp-capture.cjs plan-character.cjs
const path = require('node:path');
const fs = require('node:fs');
module.exports = async function (api) {
  const asset = process.env.ASSET || 'enemy';
  const cfg = {
    enemy: { clips: [['idle', 0.4], ['walk', 0.3], ['run', 0.25], ['punch', 0.42], ['kick', 0.40], ['block', 0.4], ['hit', 0.3],
      ['fall', 0.5], ['ausweichenL', 0.5], ['uppercut', 0.45], ['proto:threat_taunt', 0.41]],
      video: [['idle', 2], ['walk', 2], ['run', 1.5], ['punch', 1.7], ['hit', 1.3], ['fall', 0.7], ['proto:threat_taunt', 3]] },
    hero: { clips: [['idle', 0.4], ['walk', 0.3], ['run', 0.25], ['sprint', 0.3], ['jump', 0.4], ['land', 0.3], ['roll', 0.4],
      ['fall', 0.5], ['swing', 0.3], ['schwungpose', 0.5], ['zip_zug', 0.5], ['gleiten', 0.5], ['sturzflug', 0.5], ['sturzflug2', 0.5],
      ['klettern', 0.3], ['klettern_seit', 0.5], ['wandlauf', 0.5], ['kante', 0.6], ['punch', 0.42], ['kick', 0.40],
      ['uppercut', 0.45], ['hit', 0.3], ['luftangriff', 0.5], ['proto:landing_pose', 0.35]],
      video: [['idle', 2], ['run', 1.4], ['jump', 0.8], ['swing', 2.2], ['klettern', 2], ['punch', 1.6], ['roll', 1.6], ['proto:landing_pose', 2.6]] },
  }[asset];
  const out = path.join(api.root, 'art/blender-nextgen/renders/threejs', asset);
  fs.mkdirSync(out, { recursive: true });
  const rep = { asset, clips: {} };
  await api.open('?capture=1');
  for (const [clip, frac] of cfg.clips) {
    for (const which of ['compare', 'new']) {
      if (which === 'compare' && clip.startsWith('proto:')) continue;
      await api.ev(`T.setup(${JSON.stringify({ asset, which, mode: 'gameDay', env: 'neutral', clip })})`);
      await api.ev(`T.clip(${JSON.stringify(clip)})`);
      const st = await api.ev('T.stats()');
      const dur = st.per[st.per.length - 1].clipDuration || 1;
      await api.ev(`T.view(${JSON.stringify({ yaw: 28, pitch: 8, dist: (which === 'compare' ? 44 : 36) * (asset === 'hero' ? 1.35 : 1), target: null })})`);
      await api.ev(`T.renderAt(${dur * frac})`);
      const name = clip.replace('proto:', 'proto_');
      await api.shot(path.join(out, `${name}_${which}.jpg`));
      if (which === 'new' || clip.startsWith('proto:')) {
        rep.clips[clip] = { duration: dur, at: +(dur * frac).toFixed(3), stats: await api.ev('T.stats()'), bones: await api.ev('T.boneCheck()') };
      }
    }
  }
  // Rueckansicht und Nachtlicht
  await api.ev(`T.setup(${JSON.stringify({ asset, which: 'compare', mode: 'gameNight', env: 'city', clip: 'idle' })})`);
  await api.ev(`T.view({yaw:200,pitch:8,dist:${asset === 'hero' ? 60 : 44},target:null})`); await api.ev('T.renderAt(1)');
  await api.shot(path.join(out, 'back_night_compare.jpg'));
  await api.ev(`T.setup(${JSON.stringify({ asset, which: 'new', mode: 'studio', env: 'neutral', clip: 'idle' })})`);
  await api.ev(`T.view({yaw:28,pitch:8,dist:${asset === 'hero' ? 46 : 34},target:null})`); await api.ev('T.renderAt(1)');
  await api.shot(path.join(out, 'studio_idle_new.jpg'));
  // Video: Clipfolge im Vergleich, 30 fps
  const frames = path.join(out, 'frames');
  fs.rmSync(frames, { recursive: true, force: true });
  await api.size(1280, 720);
  let f = 0;
  for (const [clip, secs] of cfg.video) {
    const which = clip.startsWith('proto:') ? 'new' : 'compare';
    await api.ev(`T.setup(${JSON.stringify({ asset, which, mode: 'gameDay', env: 'city', clip })})`);
    for (let i = 0; i < Math.round(secs * 30); i++, f++) {
      await api.ev(`T.view({yaw:${20 + f * 0.25},pitch:8,dist:${(which === 'compare' ? 46 : 36) * (asset === 'hero' ? 1.35 : 1)},target:null})`);
      await api.ev(`T.renderAt(${i / 30})`);
      await api.shot(path.join(frames, String(f).padStart(4, '0') + '.jpg'), 86);
    }
  }
  rep.videoFrames = f;
  fs.writeFileSync(path.join(api.root, `art/blender-nextgen/reports/${asset}-threejs.json`), JSON.stringify(rep, null, 1));
  const short = {};
  for (const [k, v] of Object.entries(rep.clips)) short[k] = { tris: v.stats.per.map((p) => p.tris), calls: v.stats.per.map((p) => p.drawCalls),
    missing: v.bones && v.bones.map((b) => b && b.missing.length), tracks: v.bones && v.bones.map((b) => b && b.tracks) };
  api.log({ short, frames: f, load: rep.clips.idle && rep.clips.idle.stats.per.map((p) => p.loadMs) });
};
