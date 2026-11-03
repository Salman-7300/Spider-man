/* Klang im Gleichschritt mit der Simulation (fuer Pruefstaende und Videos).
   =========================================================================
   Die Pruefstaende rechnen das Spiel in festen Schritten (d.schritt), viel
   schneller oder langsamer als die Uhr. Ein echter AudioContext liefe
   daneben in Echtzeit - Einzelklaenge wuerden zu frueh oder zu spaet
   enden, und was man aufnimmt, passt nicht zum Bild.

   Dieses Init-Skript ersetzt deshalb window.AudioContext durch EINEN
   OfflineAudioContext, der nur so weit rechnet, wie die Simulation
   gekommen ist: nach jedem Schritt K.bis(spielzeit). Das Spiel selbst
   merkt davon nichts - es baut dieselben Knoten wie im Browser. Am Ende
   liefert K.ende() den gerechneten Ton (AudioBuffer).

   Dazu zaehlt es mit: wie oft das Spiel einen Kontext anlegen wollte
   (vor dem ersten Klick muss das 0 sein), welche Knoten es erzeugt, wie
   viele Quellen gestartet und beendet wurden (laufend = Differenz).

   Einhaengen:  await page.addInitScript(klangTaktCode({ rate, kanaele, sekunden }));
                await page.reload();
   ========================================================================= */
function klangTaktInit(opt) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const K = window.__kt = { ctx: null, erstellt: 0, aktivierung: null, erzeugt: {}, gestartet: 0, beendet: 0,
                            maxLaufend: 0, rate: opt.rate, kanaele: opt.kanaele, laenge: opt.sekunden,
                            marken: [], fehler: [] };
  if (!OAC) { K.fehler.push('kein OfflineAudioContext'); return; }
  const B = window.BaseAudioContext || OAC;
  const P = B.prototype;
  for (const name of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter',
                      'createDelay', 'createStereoPanner', 'createBuffer', 'createDynamicsCompressor']) {
    const alt = P[name]; if (!alt) continue;
    P[name] = function () {
      K.erzeugt[name] = (K.erzeugt[name] || 0) + 1;
      const n = alt.apply(this, arguments);
      if (name === 'createOscillator' || name === 'createBufferSource') {
        const st = n.start;
        n.start = function () {
          K.gestartet++;
          const l = K.gestartet - K.beendet; if (l > K.maxLaufend) K.maxLaufend = l;
          n.addEventListener('ended', () => { K.beendet++; });
          return st.apply(n, arguments);
        };
      }
      return n;
    };
  }
  const Q = 128;
  window.AudioContext = function () {
    K.erstellt++;
    if (K.ctx) return K.ctx;
    const c = new OAC(opt.kanaele, Math.ceil(opt.rate * opt.sekunden), opt.rate);
    K.echtWeiter = OAC.prototype.resume.bind(c);
    /* Das Spiel ruft resume() bei jedem Ton - hier entscheidet nur K.bis. */
    c.resume = () => Promise.resolve();
    K.ctx = c;
    K.aktivierung = navigator.userActivation ? navigator.userActivation.hasBeenActive : null;
    K.bild = Q;
    K.halt = c.suspend(Q / opt.rate);
    K.fertig = c.startRendering();
    return c;
  };
  window.webkitAudioContext = undefined;
  /* Bis zur Spielzeit t (Sekunden Tonzeit) weiterrechnen. */
  K.bis = async (t) => {
    if (!K.ctx || K.zu) return;
    await K.halt;
    const ende = Math.ceil(opt.rate * opt.sekunden);
    let f = Math.ceil((t * opt.rate) / Q) * Q;
    if (f <= K.bild) return;
    if (f >= ende - Q) { K.zu = true; return; }
    K.bild = f;
    K.halt = K.ctx.suspend(f / opt.rate);
    K.echtWeiter();
    await K.halt;
  };
  K.zeit = () => (K.ctx ? K.bild / opt.rate : 0);
  K.marke = (name) => { K.marken.push([name, K.zeit()]); };
  /* Fertig rechnen und den Puffer liefern. */
  K.ende = async () => {
    if (!K.ctx) return null;
    await K.halt;
    K.zu = true;
    K.echtWeiter();
    K.puffer = await K.fertig;
    return K.puffer;
  };
  /* Pegel eines Abschnitts [t0, t1) in dBFS: gesamt, drei Baender
     (Butterworth 4. Ordnung: tief < 250 Hz, mitte 250 Hz - 2,5 kHz,
     hoch > 2,5 kHz), links/rechts und Spitze. */
  const biquad = (typ, f, sr) => {
    const w = 2 * Math.PI * f / sr, cs = Math.cos(w), a = Math.sin(w) / (2 * Math.SQRT1_2);
    let b0, b1, b2;
    if (typ === 'tp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    const a0 = 1 + a, a1 = -2 * cs, a2 = 1 - a;
    const k = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = k[0] * x + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  };
  const kette = (...f) => (x) => { for (const g of f) x = g(x); return x; };
  K.pegel = (t0, t1) => {
    const b = K.puffer; if (!b) return null;
    const sr = b.sampleRate;
    const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(b.length, Math.floor(t1 * sr));
    const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L;
    const tief = kette(biquad('tp', 250, sr), biquad('tp', 250, sr));
    const mitte = kette(biquad('hp', 250, sr), biquad('hp', 250, sr), biquad('tp', 2500, sr), biquad('tp', 2500, sr));
    const hoch = kette(biquad('hp', 2500, sr), biquad('hp', 2500, sr));
    /* Die Filter einschwingen lassen (50 ms vor dem Abschnitt). */
    for (let i = Math.max(0, i0 - Math.floor(sr * 0.05)); i < i0; i++) { const x = (L[i] + R[i]) * 0.5; tief(x); mitte(x); hoch(x); }
    let sG = 0, sT = 0, sM = 0, sH = 0, sL = 0, sR = 0, spitze = 0, voll = 0;
    for (let i = i0; i < i1; i++) {
      const x = (L[i] + R[i]) * 0.5;
      const t = tief(x), m = mitte(x), h = hoch(x);
      sG += x * x; sT += t * t; sM += m * m; sH += h * h;
      sL += L[i] * L[i]; sR += R[i] * R[i];
      const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
      if (a > spitze) spitze = a;
      if (a >= 0.999) voll++;
    }
    const n = Math.max(1, i1 - i0);
    const db = (s) => +(10 * Math.log10(s / n + 1e-12)).toFixed(1);
    return { gesamt: db(sG), tief: db(sT), mitte: db(sM), hoch: db(sH), links: db(sL), rechts: db(sR),
             spitze: +(20 * Math.log10(spitze + 1e-12)).toFixed(1), uebersteuert: voll };
  };
  /* Oktavbaender 63 Hz - 8 kHz in dBFS (Bandpass je Oktave) - zur Diagnose. */
  K.spektrum = (t0, t1) => {
    const b = K.puffer; if (!b) return null;
    const sr = b.sampleRate;
    const i0 = Math.max(0, Math.floor(t0 * sr)), i1 = Math.min(b.length, Math.floor(t1 * sr));
    const L = b.getChannelData(0), R = b.numberOfChannels > 1 ? b.getChannelData(1) : L;
    const r = {};
    for (const f of [63, 125, 250, 500, 1000, 2000, 4000, 8000]) {
      if (f > sr / 2.2) continue;
      const w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * 1.414), cs = Math.cos(w);
      const a0 = 1 + al, k = [al / a0, 0, -al / a0, -2 * cs / a0, (1 - al) / a0];
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, s = 0;
      for (let i = i0; i < i1; i++) {
        const x = (L[i] + R[i]) * 0.5;
        const y = k[0] * x + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y; s += y * y;
      }
      r[f] = +(10 * Math.log10(s / Math.max(1, i1 - i0) + 1e-12)).toFixed(1);
    }
    return r;
  };
  /* Pegel eines Tons ueber dem Hintergrund: Leistung im Abschnitt minus
     Leistung davor (gleiche Laenge), je Band. */
  K.ueber = (t0, t1, vorher) => {
    const a = K.pegel(t0, t1), h = K.pegel(t0 - vorher, t0);
    const sub = (x, y) => { const p = Math.pow(10, x / 10) - Math.pow(10, y / 10); return p > 0 ? +(10 * Math.log10(p)).toFixed(1) : -120; };
    return { gesamt: sub(a.gesamt, h.gesamt), mitte: sub(a.mitte, h.mitte), hoch: sub(a.hoch, h.hoch), roh: a, hinter: h };
  };
  /* Den Puffer als 16-bit-WAV in Stuecken (base64) holen. */
  K.wav = () => {
    const b = K.puffer; if (!b) return 0;
    const n = b.length, k = b.numberOfChannels;
    const daten = new DataView(new ArrayBuffer(44 + n * k * 2));
    const s = (o, t) => { for (let i = 0; i < t.length; i++) daten.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); daten.setUint32(4, 36 + n * k * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
    daten.setUint32(16, 16, true); daten.setUint16(20, 1, true); daten.setUint16(22, k, true);
    daten.setUint32(24, b.sampleRate, true); daten.setUint32(28, b.sampleRate * k * 2, true);
    daten.setUint16(32, k * 2, true); daten.setUint16(34, 16, true); s(36, 'data'); daten.setUint32(40, n * k * 2, true);
    const ch = []; for (let c = 0; c < k; c++) ch.push(b.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) {
      const v = Math.max(-1, Math.min(1, ch[c][i]));
      daten.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
    }
    K.wavDaten = new Uint8Array(daten.buffer);
    return K.wavDaten.length;
  };
  K.wavStueck = (von, bis) => {
    const u = K.wavDaten.subarray(von, bis);
    let t = '';
    for (let i = 0; i < u.length; i += 0x8000) t += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(t);
  };
}

function klangTaktCode(opt) {
  return '(' + klangTaktInit.toString() + ')(' + JSON.stringify(opt) + ');';
}

/* Den gerechneten Ton als WAV-Datei speichern (nach K.ende()). */
async function wavSpeichern(page, datei) {
  const fs = require('node:fs');
  const n = await page.evaluate(() => window.__kt.wav());
  const fd = fs.openSync(datei, 'w');
  const STUECK = 3 * 1024 * 1024;
  for (let von = 0; von < n; von += STUECK) {
    const b64 = await page.evaluate(([a, z]) => window.__kt.wavStueck(a, z), [von, Math.min(n, von + STUECK)]);
    fs.writeSync(fd, Buffer.from(b64, 'base64'));
  }
  fs.closeSync(fd);
  return n;
}

module.exports = { klangTaktCode, wavSpeichern };
