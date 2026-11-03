/* Mega-Update 1.0, M6: Abnahmevideos MIT Spielton.
   =========================================================================
   Bild und Ton kommen aus demselben Lauf: der Ton wird im Gleichschritt
   mit der Simulation gerechnet (tools/pruef/klang-takt.js) - dieselben
   WebAudio-Knoten wie im Browser -, jedes Videobild ist ein echtes Bild
   der Spielkamera mit HUD. 15 Bilder/s, je Bild vier Simulationsschritte
   (1/60 s) - wie die M1-Videos.
   ffmpeg legt Bilder und Ton zusammen (siehe docs/abnahme-mega-1.0/README.md).

   GESTELLT: die Szenen beginnen mit einem Schnitt (Held versetzt, Tageszeit
   und Wetter gesetzt, ein Ereignis oder ein Auftrag gestartet). Was in der
   Szene passiert, sind echte Eingaben (Laufen, Netz, Schlaege, C) bzw. die
   Pruef-Bots aus tools/pruef/mega-bot.js und mega-neben-bot.js.

   film=atmo   Atmosphaere: Strasse am Tag, Dach, Innenraum (Kai 7), Nacht
               mit Regen, Park bei Nacht, Einsatz mit Sirenen
               (Musik: "Nur Stadtklang", beim Einsatz "An")
   film=lang   zusammenhaengender Ablauf: Schwung -> Netz-Zug -> Wandlauf,
               Ladenueberfall mit Kampf und Polizei, Luft-Finisher, Kai 7
               mit Auftrag am Empfang, Nebenauftrag (Spuren), Nacht

   Aufruf:  node tools/pruef/mega-m6-video.js <ordner> film=atmo|lang [kurz=1]
   Im Ordner: bilder/0000.jpg ... und ton.wav
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const { klangTaktCode, wavSpeichern } = require('./klang-takt');
const { botCode: ereignisBot } = require('./mega-bot');
const { botCode: nebenBot } = require('./mega-neben-bot');

const ZIEL = process.argv[2];
const arg = (k, std) => { const a = process.argv.find((x) => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : std; };
const FILM = arg('film', 'atmo');
const KURZ = arg('kurz', null) === '1';
const FPS = 15;          // wie die M1-Videos: 15 Bilder/s, je Bild vier Simulationsschritte
if (!ZIEL) { console.log('Aufruf: node tools/pruef/mega-m6-video.js <ordner> film=atmo|lang'); process.exit(1); }

/* ---------------- im Browser: Regie ---------------- */
function regieCode(film) {
  const d = __dbg, P = d.player, K = window.__kt;
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'KeyE'];
  const tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
  const blick = (x, z, neig) => { const dx = x - P.pos.x, dz = z - P.pos.z; d.kamStart(Math.atan2(-dx, -dz), neig === undefined ? 0.2 : neig); };
  const setze = (x, z, y) => {
    const gy = y === undefined ? d.groundYAt(x, z, 2) : y;
    P.pos.set(x, gy, z); P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true; tasten([]);
  };
  const musik = (wert) => { const s = document.getElementById('setMusik'); s.value = wert; s.dispatchEvent(new Event('change')); };
  const dach = (x0, z0) => {
    for (let r = 10; r < 160; r += 5) for (let a = 0; a < 24; a++) {
      const x = x0 + Math.cos(a / 24 * Math.PI * 2) * r, z = z0 + Math.sin(a / 24 * Math.PI * 2) * r;
      const o = d.mega.ort(x, z);
      if (!o.haus || o.oben < 18 || o.oben > 50) continue;
      let eben = true;
      for (const [ox, oz] of [[7, 0], [-7, 0], [0, 7], [0, -7], [5, 5], [-5, -5], [5, -5], [-5, 5]]) {
        const n = d.mega.ort(x + ox, z + oz);
        if (!n.haus || Math.abs(n.oben - o.oben) > 0.05) { eben = false; break; }
      }
      if (eben) return { x, y: o.oben, z };
    }
    return null;
  };
  const strasseNeben = (x0, z0) => {
    for (let r = 4; r < 80; r += 2) for (let a = 0; a < 24; a++) {
      const x = x0 + Math.cos(a / 24 * Math.PI * 2) * r, z = z0 + Math.sin(a / 24 * Math.PI * 2) * r;
      const o = d.mega.ort(x, z);
      if (!o.haus && !o.wasser && o.y > -0.5 && o.y < 1.5 && o.oben < o.y + 0.5) return { x, z };
    }
    return null;
  };
  /* freie gerade Strecke von (x, z) in Richtung (dx, dz) */
  const frei = (x, z, dx, dz, l) => {
    for (let s = 0; s <= l; s += 1.5) { const o = d.mega.ort(x + dx * s, z + dz * s); if (o.haus || o.wasser || o.y < -0.5 || o.y > 1.5) return false; }
    return true;
  };
  const richtung = (x, z) => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (frei(x, z, dx, dz, 30)) return [dx, dz];
    return [1, 0];
  };
  const R = window.__regie = { film, t: 0, ton: 0, szene: null, log: [] };
  const D = dach(25, 25) || { x: 25, y: 0, z: 25 };
  const S = strasseNeben(D.x, D.z) || { x: 25, z: 25 };
  const szenen = {
    strasse: { dauer: 8, auf() {
      musik('stadt'); window.__setzeZeit(0.5); d.setzeRegen(0); d.evAlleBeenden(); d.mega.blockiere(true);
      setze(S.x, S.z); const r = richtung(S.x, S.z); this.r = r; P.facing = Math.atan2(r[0], r[1]); blick(S.x + r[0] * 20, S.z + r[1] * 20, 0.15);
    }, takt() { blick(P.pos.x + this.r[0] * 20, P.pos.z + this.r[1] * 20, 0.15); tasten(['KeyW']); } },
    dach: { dauer: 7, auf() { setze(D.x, D.z, D.y); this.w = 0; }, takt(t) { tasten([]); this.w += 0.004; d.kamStart(this.w * 6, 0.12); } },
    innen: { dauer: 11, auf() {
      const T = d.mega.orteTueren().buero; this.T = T;
      setze(T.ex + T.nx * 2.5, T.ez + T.nz * 2.5); P.facing = Math.atan2(-T.nx, -T.nz); blick(T.ex, T.ez, 0.15); this.b = 0;
    }, takt() {
      this.b++;
      const T = this.T;
      if (!d.innen.active && !d.innen.phase) {
        if (Math.hypot(P.pos.x - (T.ex + T.nx * 0.6), P.pos.z - (T.ez + T.nz * 0.6)) > 0.5 && this.b < 60) { blick(T.ex, T.ez, 0.15); tasten(['KeyW']); }
        else { tasten([]); if (this.b % 10 === 0) d.mega.interagieren(); }
      } else if (d.innen.active && !d.innen.phase) {
        const h = d.innen.raum.aktionen.find((a) => a.id === 'empfang');
        if (h && Math.hypot(h.x - P.pos.x, h.z - P.pos.z) > 1.5) { blick(h.x, h.z, 0.1); tasten(['KeyW']); } else tasten([]);
      }
    }, ab() { if (d.innen.active) d.innenSofortRaus(); } },
    nachtRegen: { dauer: 8, auf() {
      window.__setzeZeit(0.02); d.setzeRegen(1); setze(S.x, S.z); const r = richtung(S.x, S.z); this.r = r;
      P.facing = Math.atan2(r[0], r[1]); blick(S.x + r[0] * 20, S.z + r[1] * 20, 0.15);
    }, takt() { blick(P.pos.x + this.r[0] * 20, P.pos.z + this.r[1] * 20, 0.15); tasten(['KeyW']); } },
    parkNacht: { dauer: 7, auf() {
      d.setzeRegen(0);
      const p = d.stadtteile().filter((s) => s.art === 'PARK').find((s) => { const o = d.mega.ort(s.x, s.z); return !o.haus && !o.wasser && o.y > -0.5 && o.y < 1.5; });
      if (p) setze(p.x, p.z); this.w = 0;
    }, takt() { tasten([]); this.w += 0.003; d.kamStart(1 + this.w * 6, 0.1); } },
    einsatz: { dauer: 45, bot: true, auf() {
      musik('an'); window.__setzeZeit(0.5); d.setzeRegen(0);
      this.st = window.__mb.start('laden'); this.nach = null;
    }, takt(t) {
      const z = window.__mb.takt(1);
      if (z.phase === 'nach' && this.nach === null) this.nach = t;
      this.ende = z.phase === 'fertig' || (this.nach !== null && t - this.nach > 7);
    }, fertig() { return this.ende; } },
    /* ---- langer Film ---- */
    kette: { dauer: 9, auf() {
      musik('an'); window.__setzeZeit(0.45); d.setzeRegen(0); d.evAlleBeenden(); d.mega.blockiere(true);
      const hausVon = (c) => c && !c.klein && !c.parkAuto && !c.innen;
      const w = d.colliders.filter((c) => hausVon(c) && (c.h || 0) >= 22 && Math.abs(c.x0) < 240 && Math.abs(c.z0) < 240 && (c.z1 - c.z0) > 10)
        .filter((c, i) => i % 5 === 0)[0];
      const zm = (w.z0 + w.z1) / 2;
      d.setzePos(w.x0 - 55, 24, zm); P.state = 'air'; P.onGround = false; P.vel.set(17, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.22);
      this.i = 0; this.iRel = -1; this.zip = false;
    }, takt() {
      const i = this.i++;
      if (i === 2) d.taste('Space', true);
      if (i === 50) d.taste('Space', false);
      if (P.state !== 'swing' && i > 50 && this.iRel < 0) this.iRel = i;
      if (this.iRel >= 0 && !this.zip && i === this.iRel + 8) { this.zip = true; d.taste('KeyW', true); d.webZip(); }
    }, ab() { tasten([]); } },
    finisher: { dauer: 6, auf() {
      d.evAlleBeenden(); d.mega.blockiere(true);
      if (d.stufe < 3) d.addScore(60000);
      for (const g of d.enemies) if (!g.dead) { g.dead = true; g.deadT = 0.01; g.liegt = true; }
      const x = 25, z = 25;
      setze(x - 1.6, z); P.facing = Math.atan2(1.6, 0); d.kamStart(Math.atan2(-1.6, 0), 0.2);
      for (let k = 0; k < 40; k++) d.kamSchritt(1 / 60);
      const mk = (gx, gz) => {
        const g = d.spawnGang(gx, gz, 1, 'event').enemies[0];
        g.pos.set(gx, d.groundYAt(gx, gz, 2), gz);
        const typ = d.mega.ganoven().find((t) => t.art === 'schlaeger'); if (typ) g.typ = typ;
        g.hp = g.hpMax = 400; g.state = 'chase'; g.target = 'player'; g.anfuehrer = false;
        g.blockT = 0; g.blockCd = 99; g.paradeCd = 99; g.ausweichCd = 99;
        return g;
      };
      this.a = mk(x, z); this.b2 = mk(x + 2.4, z + 0.6); this.b2.state = 'patrol'; this.b2.target = null;
      this.i = 0; this.plan = [[10, () => d.uppercut()], [22, () => d.tryJump()], [38, () => d.tryAttack('punch')], [50, () => d.tryAttack('kick')]];
    }, takt() {
      const i = this.i++;
      for (const [b, f] of this.plan) if (i === b) f();
      if (P.hp < 60) P.hp = 100;
    }, ab() { for (const g of [this.a, this.b2]) if (g) { g.dead = true; g.deadT = 0.01; } } },
    kai7: { dauer: 22, auf() {
      d.evAlleBeenden(); d.mega.blockiere(true);
      const T = d.mega.orteTueren().buero; this.T = T; this.zustand = 'tuer'; this.b = 0;
      setze(T.ex + T.nx * 2.5, T.ez + T.nz * 2.5); P.facing = Math.atan2(-T.nx, -T.nz); blick(T.ex, T.ez, 0.15);
    }, takt() {
      this.b++;
      const T = this.T, I = d.innen;
      if (this.zustand === 'tuer') {
        if (Math.hypot(P.pos.x - (T.ex + T.nx * 0.6), P.pos.z - (T.ez + T.nz * 0.6)) > 0.5 && this.b < 60) { blick(T.ex, T.ez, 0.15); tasten(['KeyW']); }
        else { tasten([]); if (this.b % 10 === 0) d.mega.interagieren(); if (I.active && !I.phase) this.zustand = 'empfang'; }
      } else if (this.zustand === 'empfang') {
        const h = I.raum.aktionen.find((a) => a.id === 'empfang');
        if (Math.hypot(h.x - P.pos.x, h.z - P.pos.z) > 0.9) { blick(h.x, h.z, 0.1); tasten(['KeyW']); }
        else { tasten([]); d.mega.interagieren(); this.zustand = 'warten'; this.w = 0; }
      } else if (this.zustand === 'warten') {
        if (++this.w > 40) this.zustand = 'raus';
      } else if (this.zustand === 'raus') {
        const a = I.raum && I.raum.ausgang;
        if (!a || !I.active) { this.zustand = 'fertig'; return; }
        if (Math.hypot(a.x - P.pos.x, a.z - P.pos.z) > 0.8) { blick(a.x, a.z, 0.1); tasten(['KeyW']); }
        else { tasten([]); if (this.b % 10 === 0) d.mega.interagieren(); }
        if (!I.active && !I.phase) this.zustand = 'fertig';
      }
    }, fertig() { return this.zustand === 'fertig' && !d.innen.active && !d.innen.phase; } },
    neben: { dauer: 24, auf() {
      d.mega.blockiere(true);
      const N = d.neben, info = N.daten();
      /* Anreise abgekuerzt: 35 m vor den Einsatzort */
      if (info && info.zielPos) { const s = window.__nb.vorOrt(info.zielPos.x, info.zielPos.z, 35); window.__nb.setze(s.x, s.z); }
    }, takt() {
      const N = d.neben, B = window.__nb, info = N.daten();
      if (!info) { tasten([]); return; }
      const k = N.kandidat();
      if (k === 'Spur untersuchen' || k === 'Koffer sichern') { B.stopp(); d.mega.interagieren(); return; }
      const g = B.gegner();
      if (g && g.d < 30) B.kaempfe(g);
      else if (info.zielPos) B.hin(info.zielPos.x, info.zielPos.z, true, 1.0);
      else B.stopp();
      if (P.hp < 60) P.hp = 100;
    }, ab() { tasten([]); } },
    nacht: { dauer: 9, auf() {
      if (d.storyStand().aktiv) { d.storyEnde('abbruch'); }
      d.evAlleBeenden(); d.mega.blockiere(true);
      window.__setzeZeit(0.03); setze(S.x, S.z); const r = richtung(S.x, S.z); this.r = r;
      P.facing = Math.atan2(r[0], r[1]); blick(S.x + r[0] * 20, S.z + r[1] * 20, 0.15);
    }, takt() { blick(P.pos.x + this.r[0] * 20, P.pos.z + this.r[1] * 20, 0.15); tasten(['KeyW', 'ShiftLeft']); } },
  };
  R.folge = film === 'lang' ? ['kette', 'einsatz', 'finisher', 'kai7', 'neben', 'nacht']
                            : ['strasse', 'dach', 'innen', 'nachtRegen', 'parkNacht', 'einsatz'];
  R.starteSzene = (name) => {
    if (R.szene && R.szene.ab) R.szene.ab();
    R.szene = szenen[name]; R.szene.name = name; R.t0 = R.t;
    R.szene.auf();
    R.log.push([name, +R.ton.toFixed(2)]);
  };
  /* ein Videobild: zwei Simulationsschritte, Bild, Ton bis hierher */
  R.schuld = 0;
  R.bild = async (dtBild) => {
    const s = R.szene;
    if (s.bot) {
      /* Der Ereignis-Bot rechnet selbst, je Aufruf 1/60 s - so viele
         Aufrufe, dass das Video in Echtzeit bleibt. */
      R.schuld += dtBild * 60;
      while (R.schuld >= 1) { s.takt(R.t - R.t0); R.t += 1 / 60; R.schuld -= 1; }
    } else {
      const n = Math.max(1, Math.round(dtBild * 60));
      for (let k = 0; k < n; k++) {
        const t = R.t - R.t0;
        s.takt(t); if (P.hp < 60) P.hp = 100;
        if (window.__nb) window.__nb.bild++;
        d.schritt(dtBild / n);
        R.t += dtBild / n;
      }
    }
    d.zeichne();
    R.ton += dtBild;
    await K.bis(R.ton);
    const t = R.t - R.t0;
    return { fertig: t >= s.dauer || (s.fertig && s.fertig(t)), t: +t.toFixed(2), szene: s.name,
             ziel: document.getElementById('objective').textContent };
  };
}

(async () => {
  fs.mkdirSync(path.join(ZIEL, 'bilder'), { recursive: true });
  const { b, page } = await starte(960, 540, 4711, { frierSofort: true });
  page.on('pageerror', (e) => console.log('SEITENFEHLER', String(e)));
  await page.addInitScript(klangTaktCode({ rate: 44100, kanaele: 2, sekunden: KURZ ? 60 : 240 }));
  await page.reload();
  await page.waitForFunction(() => window.__dbg && window.__dbg.actorsReady, null, { timeout: 240000 });
  await page.evaluate(() => { __dbg.frier(true); document.getElementById('overlay').style.display = 'flex'; });
  await page.click('#clickmsg');
  await page.evaluate(() => { __dbg.frier(true); document.getElementById('overlay').style.display = 'none';
                              document.getElementById('hud').style.display = 'block'; });
  await page.evaluate(ereignisBot);
  await page.evaluate(nebenBot);
  await page.evaluate(regieCode, FILM);
  const folge = await page.evaluate(() => window.__regie.folge);
  let nr = 0;
  for (const name of folge) {
    await page.evaluate((n) => window.__regie.starteSzene(n), name);
    let z = null, n = 0;
    const max = (KURZ ? 3 : 60) * FPS;
    do {
      z = await page.evaluate((dt) => window.__regie.bild(dt), 1 / FPS);
      fs.writeFileSync(path.join(ZIEL, 'bilder', String(nr++).padStart(5, '0') + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 82 }));
      n++;
      if (KURZ && n >= 3 * FPS) break;
    } while (!z.fertig && n < max);
    console.log('Szene ' + name + ': ' + n + ' Bilder, Ziel "' + z.ziel + '"');
  }
  const log = await page.evaluate(() => window.__regie.log);
  await page.evaluate(() => window.__kt.ende());
  /* Ton auf die Bildlaenge kuerzen: ffmpeg nimmt -shortest */
  const n = await wavSpeichern(page, path.join(ZIEL, 'ton.wav'));
  fs.writeFileSync(path.join(ZIEL, 'szenen.json'), JSON.stringify({ film: FILM, fps: FPS, bilder: nr, szenen: log }, null, 1));
  console.log('Bilder ' + nr + ', Ton ' + n + ' Bytes, Szenen ' + JSON.stringify(log));
  await b.close();
})();
