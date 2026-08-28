/* =========================================================================
   WEB HERO – Open-World-Netzschwung-Spiel im Browser (Three.js)
   Ein Fan-Projekt: eigener Netz-Held im klassischen Rot-Blau-Look.
   ========================================================================= */
(function () {
'use strict';
if (typeof THREE === 'undefined') return;

/* ======================= Konfiguration ======================= */
const CFG = {
  gravity: 30,
  swingGravity: 24,
  duckSpeed: 2.2, kriechSpeed: 0.85, schleichSpeed: 1.4,
  walkSpeed: 2.8, symSpeed: 1.2,
  runSpeed: 7,
  sprintSpeed: 11,
  /* Von 10 auf 26: mit 10 m/s^2 braucht ein Richtungswechsel in der Luft
     mehrere Sekunden, und genau so fuehlte es sich an - man konnte in der
     Luft praktisch nicht steuern. */
  airAccel: 26,
  jumpVel: 11.5,
  /* Von 4,5 auf 2,6. Bei 4,5 m/s muesste die Kriechbewegung siebenfach
     laufen, und so schnell rudert kein Mensch mit Armen und Beinen.
     Mit 2,6 sind es rund 4,2 - schnell, aber noch lesbar, und die
     greifende Hand bleibt dabei an der Fassade stehen. Ein Haus von 28 m
     dauert damit elf Sekunden statt sechs. */
  climbSpeed: 2.6,
  /* Seitwaerts geht es schneller als hinauf. Hinauf zieht man sich Hand
     ueber Hand hoch, quer haengelt man - und mit demselben Tempo wie beim
     Steigen fuehlte sich das Ausweichen an der Fassade zaeh an. */
  climbSpeedSeit: 4.4,
  /* Abstand der Körpermitte zur Wand beim Klettern. Vorher wurde der volle
     Kollisionsradius (0,45 m) benutzt – dadurch schwebte die Figur sichtbar
     vor dem Haus, statt daran zu kleben. */
  climbGap: 0.15,
  ropeMin: 7,
  playerHP: 100,
  enemyHP: 34,
  civCount: 22,
  carCount: 26,
  heliCount: 2,
  maxEnemies: 14,
  rollDauer: 0.45,
};
/* Abstand, auf den der Held im Nahkampf herangeht: halber Körper (0,45) +
   halber Gegner (0,4) + ein Stück Arm. So berühren sich die Figuren beim
   Schlag wirklich. */
const NAHKAMPF = 1.05;

const BLOCKS = 7;           // 7x7 Häuserblöcke
const PITCH = 50;           // Rasterabstand (Block + Straße)
const ORIGIN = -175;        // Rasterursprung (Straßenlinien bei -175..175)
const ROAD_HALF = 6;        // halbe Asphaltbreite
const SLAB_H = 0.25;        // Gehweg-/Blocksockelhöhe
const RIVER_X0 = 192, RIVER_X1 = 330;   // Fluss
/* Aeusserste Rasterlinie der Stadt: die Uferstrasse. */
const RASTER_X1 = ORIGIN + BLOCKS * PITCH;    // 175
/* Die Uferpromenade zwischen der Uferstrasse und der Kaimauer.
   Sie liegt als Gehweg auf SLAB_H - der Bodenhoehe war das aber nie
   bekannt: dort galt weiter das Strassenraster, und in den Fahrbahnbaendern
   kam 0 heraus. Die Figur sank deshalb 25 cm in die Promenade ein.
   Sie beginnt am RAND der Uferstrasse. Vorher stand PROM_X0 auf der
   Rasterlinie x = 175, also auf der Strassenmitte: die oestliche Fahrspur
   (x = 178) lag damit unter dem erhoehten Gehweg, und die Autos dieser
   Spur fuhren und parkten sichtbar auf der Promenade. Damit die Promenade
   dabei nicht schmaler wird, ist die Kaimauer um dieselben 6 m nach
   Osten gerueckt (RIVER_X0). */
const PROM_X0 = RASTER_X1 + ROAD_HALF;        // 181
/* Weiter oestlich faehrt kein Auto - dahinter liegen Promenade und Fluss.
   Die beiden Spuren der Uferstrasse liegen bei 172 und 178. */
const AUTO_X_MAX = RASTER_X1 + 4;
const SHORE_X0 = 330, SHORE_X1 = 400;   // gegenüberliegendes Ufer
const BRIDGE_Z = -25, BRIDGE_HW = 7.5;  // Brücke entlang der Straße z=-25
/* Die Bruecke setzt genau an der Bordsteinkante der Uferstrasse an und
   endet drueben am Ufer. Die Fahrbahn liegt 30 cm ueber der Strasse; an
   beiden Enden fuehrt eine Rampe hinauf, damit dort keine Stufe steht. */
const BR_X0 = PROM_X0, BR_X1 = RIVER_X1 + 4, BR_RAMPE = 6, BR_HOCH = 0.3;
/* Eigenes, etwas engeres Raster für den Stadtteil am anderen Ufer.
   Vorher standen dort nur 16 nackte Quader auf einer leeren Platte –
   deshalb wirkte die andere Seite leer und unfertig. */
const SHORE_PITCH = 32, SHORE_ROAD = 5;
const SHORE_OX = 336, SHORE_OZ = -192;
const SHORE_NX = 2, SHORE_NZ = 12;
/* Die Brücke mündet bei z = BRIDGE_Z – dieser Streifen bleibt Straße. */
function uferBlockFrei(cx, cz) {
  return !(Math.abs(cz - BRIDGE_Z) < SHORE_PITCH * 0.7 && cx < SHORE_OX + SHORE_PITCH);
}
const WATER_Y = -2.6;

/* ======================= Hilfsfunktionen ======================= */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();

function dampAngle(cur, target, k) {
  let d = target - cur;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return cur + d * k;
}

/* ======================= Audio (WebAudio, winzig) ======================= */
const SFX = (() => {
  let ctx = null, muted = false, lautstaerke = 0.7;
  /* Ausgang aller Effekte. Frueher haben sie einzeln auf den Lautsprecher
     gezeigt - dadurch klangen sie unter der Erde genau wie oben auf der
     Strasse: trocken, hell, ohne jeden Raum. Jetzt laufen alle ueber einen
     gemeinsamen Ausgang mit Tiefpass und einer kurzen Verzoegerung. Im
     Tunnel macht der Tiefpass zu und die Verzoegerung auf: dumpf mit Hall,
     wie in einer Roehre. */
  let aus = null, dumpf = null, hallG = null;
  function ausgang() {
    const c = ac(); if (!c) return null;
    if (aus) return aus;
    aus = c.createGain();
    dumpf = c.createBiquadFilter();
    dumpf.type = 'lowpass'; dumpf.frequency.value = 20000;
    aus.connect(dumpf); dumpf.connect(c.destination);
    const verz = c.createDelay(0.5); verz.delayTime.value = 0.135;
    const rueck = c.createGain(); rueck.gain.value = 0.33;
    hallG = c.createGain(); hallG.gain.value = 0;
    aus.connect(verz); verz.connect(rueck); rueck.connect(verz);
    verz.connect(hallG); hallG.connect(c.destination);
    return aus;
  }
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slide) {
    const c = ac(); if (!c || muted) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), c.currentTime + dur);
    g.gain.value = Math.max(0.0001, (vol || 0.15) * lautstaerke);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(ausgang() || c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol, hp) {
    const c = ac(); if (!c || muted) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = c.createGain(); g.gain.value = Math.max(0.0001, (vol || 0.12) * lautstaerke);
    s.connect(f); f.connect(g); g.connect(ausgang() || c.destination); s.start();
  }
  return {
    init: ac,
    /* Für die Musik: laufender Kontext und die aktuelle Lautstärke. */
    kontext: ac,
    pegel() { return muted ? 0 : lautstaerke; },
    /* 0 = draussen, 1 = tief im Tunnel. */
    raum(v) {
      if (!ausgang()) return;
      const t = clamp(v, 0, 1);
      dumpf.frequency.value = 20000 - t * 17200;
      hallG.gain.value = t * 0.32;
    },
    setLautstaerke(v) { lautstaerke = clamp(v, 0, 1); },
    toggleMute() { muted = !muted; return muted; },
    /* Ein Netzschuss ist ein Zischen mit einem Klick am Anfang, nicht ein
       Rechteckton. */
    thwip() {
      noise(0.05, 0.13, 2600);
      noise(0.16, 0.07, 1100);
      tone(1500, 0.1, 'sine', 0.05, 0.35);
    },
    /* Schlaege waren ein nackter Sinuston. Ein Treffer besteht aus drei
       Schichten: der tiefe Stoss im Bauch, der Koerper des Schlags und ein
       kurzer Knall obendrauf. Erst zusammen klingt es nach Aufprall. */
    punch() {
      tone(150, 0.08, 'sine', 0.26, 0.45);
      tone(320, 0.05, 'triangle', 0.12, 0.5);
      noise(0.05, 0.16, 900);
    },
    kick() {
      tone(95, 0.14, 'sine', 0.32, 0.42);
      tone(240, 0.07, 'triangle', 0.13, 0.5);
      noise(0.08, 0.17, 500);
    },
    hurt() { tone(210, 0.16, 'sawtooth', 0.1, 0.55); noise(0.06, 0.06, 600); },
    swoosh() { noise(0.25, 0.05, 400); },
    /* ---- Schritte ----
       Es gab bisher gar keine. Die Figur lief voellig lautlos durch die
       Stadt, und genau das laesst alles nach Kulisse klingen. Ein Schritt
       ist ein sehr kurzer, tief gefilterter Rauschstoss; hart heisst
       Rennen, weich heisst Schleichen. */
    schritt(wucht, tief) {
      const v = clamp(wucht === undefined ? 0.6 : wucht, 0, 1);
      noise(0.05 + v * 0.03, 0.05 + v * 0.09, tief ? 220 : 420);
      tone(70 + Math.random() * 25, 0.05, 'sine', 0.03 + v * 0.05, 0.6);
    },
    /* Aufkommen nach einem Sprung oder Fall. */
    landung(wucht) {
      const v = clamp(wucht === undefined ? 0.5 : wucht, 0, 1);
      tone(60, 0.16 + v * 0.1, 'sine', 0.1 + v * 0.22, 0.45);
      noise(0.1 + v * 0.12, 0.08 + v * 0.16, 260);
      if (v > 0.6) noise(0.3, 0.05 * v, 900);
    },
    ko() { tone(300, 0.3, 'square', 0.1, 0.25); },
    web() { noise(0.15, 0.09, 1200); tone(1400, 0.18, 'sine', 0.05, 0.2); },
    score() { tone(660, 0.09, 'sine', 0.12); setTimeout(() => tone(880, 0.12, 'sine', 0.12), 90); },
    zip() { tone(500, 0.22, 'sine', 0.08, 2.2); },
    splash() { noise(0.4, 0.2, 200); },
    hupe() { tone(430, 0.28, 'square', 0.07); setTimeout(() => tone(360, 0.22, 'square', 0.06), 60); },
    /* U-Bahn: dumpfes Rollen, das mit der Naehe lauter wird. */
    zug(nah) {
      const v = clamp(nah, 0, 1);
      noise(0.7, 0.16 * v, 180);
      tone(70, 0.6, 'sawtooth', 0.09 * v, 0.6);
    },
    /* Spinnensinn: ein feines, schnell aufsteigendes Kribbeln. */
    sinn() {
      tone(1750, 0.07, 'sine', 0.05, 1.5);
      setTimeout(() => tone(2300, 0.06, 'sine', 0.045, 1.4), 55);
      setTimeout(() => tone(2900, 0.05, 'sine', 0.035, 1.3), 105);
    },
  };
})();

/* ======================= Musik & Stadtklang =======================
   Alles wird im Browser erzeugt – das Spiel soll ohne Downloads offline
   laufen, deshalb keine MP3-Dateien. Zwei Schichten:
   1. Stadtklang: dumpfes Verkehrsrauschen unten, Wind weit oben, dazu
      gelegentlich eine Hupe oder eine ferne Sirene.
   2. Musik: eine ruhige Schleife beim Streifzug, die im Kampf auf eine
      schnellere Variante mit Schlagzeug umschaltet. */
const MUSIK = (() => {
  let c = null, bus = null, musikBus = null, musikFilter = null, stadtBus = null;
  let melodieBus = null;
  let rausch = null, rauschFilter = null, wind = null, windFilter = null;
  let tunnel = null, tunnelG = null;
  let naechsterTakt = 0, takt = 0, an = false;
  let intensitaetZiel = 0, intensitaet = 0;
  let ereignisCd = 6, tunnelCd = 4;
  let untenAnteil = 0;

  /* ---- Was hier vorher stand und warum es weg musste ----
     Die Melodie kam aus (takt*3 + (takt>>3)) % SKALA.length. Das ist keine
     Melodie, das ist eine Zahlenfolge: die Toene sprangen wahllos durch die
     Tonleiter, ohne Anfang, ohne Schluss, ohne Wiedererkennung. Dazu lag auf
     JEDEM Achtel ein Sägezahn-Akkord. Nach einer Minute klang das wie ein
     haengengebliebener Automat.
     Jetzt: eine feste Akkordfolge (a-Moll - F - C - G, acht Takte lang),
     ein Bass, der ihr folgt, ein weicher Flaechenklang und eine
     GESCHRIEBENE Melodie aus zwei Haelften, die sich wiederholen. Dazu ein
     Filter ueber der ganzen Musik, das beim Kampf aufmacht. */

  /* Halbtonabstaende ueber A2 (110 Hz). */
  const HT = (n) => 110 * Math.pow(2, n / 12);
  /* Akkordfolge: Am - F - C - G. Je zwei Takte, dann von vorn.
     grund = Halbton des Grundtons, terz/quinte relativ dazu. */
  const FOLGE = [
    { grund: 0,  dur: false },   // a-Moll
    { grund: -4, dur: true  },   // F-Dur
    { grund: 3,  dur: true  },   // C-Dur
    { grund: -2, dur: true  },   // G-Dur
  ];
  /* Melodie in Stufen der a-Moll-Tonleiter (0 = a). null = Pause.
     Zwei Haelften zu je 16 Achteln - die zweite antwortet der ersten. */
  const MELODIE = [
    0, null, 2, null, 4, null, 2, null,
    4, null, 5, 4, 2, null, null, null,
    0, null, 2, null, 4, 5, 7, null,
    5, null, 4, 2, 0, null, null, null,
  ];
  const LEITER = [0, 2, 3, 5, 7, 8, 10, 12];   // natuerliches Moll

  function dauerRauschen(sekunden) {
    const n = Math.floor(c.sampleRate * sekunden);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    let letzter = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      letzter = (letzter + 0.02 * w) / 1.02;   // braunes Rauschen: tiefer, weicher
      d[i] = letzter * 3.5;
    }
    return buf;
  }

  function starte() {
    c = SFX.kontext(); if (!c || an) return;
    bus = c.createGain(); bus.gain.value = 0; bus.connect(c.destination);
    /* Tiefpass ueber der ganzen Musik: beim Streifzug gedaempft und weit
       weg, im Kampf offen und direkt. Das ist der Unterschied zwischen
       Hintergrund und Vordergrund - vorher war beides gleich schrill. */
    musikFilter = c.createBiquadFilter();
    musikFilter.type = 'lowpass'; musikFilter.frequency.value = 900;
    musikFilter.Q.value = 0.4;
    musikBus = c.createGain(); musikBus.gain.value = 0.55;
    musikBus.connect(musikFilter); musikFilter.connect(bus);
    /* Kurzes Echo nur fuer die Melodie. Ein nackter Oszillator klingt wie
       ein Signalton; mit ein wenig Nachhall klingt er nach Instrument. */
    melodieBus = c.createGain(); melodieBus.gain.value = 1;
    melodieBus.connect(musikBus);
    const verz = c.createDelay(1.0); verz.delayTime.value = 0.27;
    const rueck = c.createGain(); rueck.gain.value = 0.32;
    const hall = c.createGain(); hall.gain.value = 0.38;
    melodieBus.connect(verz); verz.connect(rueck); rueck.connect(verz);
    verz.connect(hall); hall.connect(musikBus);
    stadtBus = c.createGain(); stadtBus.gain.value = 0.0; stadtBus.connect(bus);

    const buf = dauerRauschen(4);
    rausch = c.createBufferSource(); rausch.buffer = buf; rausch.loop = true;
    rauschFilter = c.createBiquadFilter();
    rauschFilter.type = 'lowpass'; rauschFilter.frequency.value = 320;
    const rg = c.createGain(); rg.gain.value = 0.9;
    rausch.connect(rauschFilter); rauschFilter.connect(rg); rg.connect(stadtBus);
    rausch.start();
    rausch.__g = rg;

    wind = c.createBufferSource(); wind.buffer = buf; wind.loop = true;
    windFilter = c.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
    const wg = c.createGain(); wg.gain.value = 0.0; wg.connect(stadtBus);
    wind.connect(windFilter); windFilter.connect(wg);
    wind.start();
    wind.__g = wg;

    /* Eigene Spur fuer unter der Erde: ein sehr tiefes Grollen. Vorher lief
       unten derselbe Strassenlaerm weiter, samt Hupen und Sirenen - genau
       das klang im Tunnel so falsch. */
    tunnel = c.createBufferSource(); tunnel.buffer = buf; tunnel.loop = true;
    const tf = c.createBiquadFilter();
    tf.type = 'lowpass'; tf.frequency.value = 110; tf.Q.value = 0.7;
    tunnelG = c.createGain(); tunnelG.gain.value = 0;
    tunnel.connect(tf); tf.connect(tunnelG); tunnelG.connect(stadtBus);
    tunnel.start();

    naechsterTakt = c.currentTime + 0.1;
    an = true;
  }

  /* Ein Ton mit weichem Ein- und Ausschwingen. Zwei leicht verstimmte
     Oszillatoren geben ihm Breite - ein einzelner klang nackt. */
  function note(freq, zeit, dauer, typ, vol, ziel, breit) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, zeit);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), zeit + 0.03);
    g.gain.setValueAtTime(Math.max(0.0002, vol), zeit + dauer * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, zeit + dauer);
    g.connect(ziel || musikBus);
    const stimmen = breit ? [-4, 4] : [0];
    for (const cent of stimmen) {
      const o = c.createOscillator();
      o.type = typ; o.frequency.value = freq * Math.pow(2, cent / 1200);
      o.connect(g);
      o.start(zeit); o.stop(zeit + dauer + 0.03);
    }
  }

  function schlag(zeit, hp, vol, dauer) {
    const n = Math.floor(c.sampleRate * dauer);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(musikBus);
    s.start(zeit);
  }

  /* Ein Achtel je Aufruf. 32 Achtel = ein Durchgang der Akkordfolge. */
  function planeTakt(t) {
    const stufe = intensitaet;
    const pos = takt % 32;                 // Stelle im Durchgang
    const akk = FOLGE[Math.floor(pos / 8) % FOLGE.length];
    const s8 = pos % 8;

    /* Bass: Grundton auf der Eins, Quinte auf der Fuenf. Ein Ton je halbem
       Takt reicht - alles dichter macht den Klang matschig. */
    if (s8 === 0) note(HT(akk.grund - 12), t, 1.15, 'triangle', 0.20 + stufe * 0.05, null, false);
    if (s8 === 4) note(HT(akk.grund - 5), t, 0.55, 'triangle', 0.12 + stufe * 0.04, null, false);

    /* Flaeche: der Dreiklang, nur auf der Eins, lang und leise. Er traegt
       die Harmonie, ohne im Weg zu stehen. */
    if (s8 === 0) {
      const terz = akk.dur ? 4 : 3;
      for (const ht of [0, terz, 7]) {
        note(HT(akk.grund + 12 + ht), t, 1.9, 'sine', 0.035 + stufe * 0.015, null, true);
      }
    }

    /* Melodie: die geschriebene Folge. Beim Streifzug eine Oktave tiefer
       und leiser, im Kampf oben und deutlich. */
    const stufeM = MELODIE[takt % MELODIE.length];
    if (stufeM !== null && (stufe > 0.3 || (takt >> 1) % 2 === 0)) {
      const okt = stufe > 0.4 ? 24 : 12;
      /* Die Melodie bleibt in a-Moll stehen, sie wandert NICHT mit dem
         Akkord mit. Mitgewandert waere sie eine reine Parallelverschiebung
         - alle vier Takte klaenge das nach einem Tonartwechsel. */
      note(HT(okt + LEITER[stufeM]),
           t, 0.30, 'triangle', 0.055 + stufe * 0.03, melodieBus, true);
    }

    /* Schlagwerk. Frueher gab es beim Streifzug ueberhaupt keins - die
       Musik war dort ein reiner Klangteppich ohne Puls, und genau deshalb
       klang sie wie ein haengengebliebener Automat. Jetzt laeuft auch beim
       Streifzug ein leiser Grundschlag mit; im Kampf kommt das volle
       Schlagzeug darueber. */
    const puls = 0.22 + stufe * 0.78;
    if (s8 === 0 || s8 === 4) schlag(t, 90, 0.20 * puls, 0.16);          // Bass
    if (s8 % 2 === 1) schlag(t, 7000, 0.035 * puls, 0.045);              // Shaker
    if (stufe > 0.25) {
      if (s8 === 2 || s8 === 6) schlag(t, 900, 0.14 * stufe, 0.12);      // Snare
      if (stufe > 0.6 && s8 % 4 === 3) schlag(t, 4200, 0.06 * stufe, 0.06);
    }
    takt++;
  }

  let modus = 'an';   // 'an' | 'stadt' | 'aus'
  return {
    starte,
    /* 0 = Streifzug, 1 = Kampf. */
    setIntensitaet(v) { intensitaetZiel = clamp(v, 0, 1); },
    setModus(v) { modus = v || 'an'; },
    status() { return { an, modus, intensitaet: +intensitaet.toFixed(2), takt,
      bus: bus ? +bus.gain.value.toFixed(3) : null,
      stadt: stadtBus ? +stadtBus.gain.value.toFixed(3) : null,
      unten: +untenAnteil.toFixed(2) }; },
    update(dt, hoehe, tempo01, regen) {
      if (!an || !c) return;
      intensitaet += (intensitaetZiel - intensitaet) * Math.min(1, dt * 1.2);

      const p = modus === 'aus' ? 0 : SFX.pegel();
      bus.gain.value = p * 0.85;
      musikBus.gain.value = modus === 'an' ? 0.55 : 0;
      /* Beim Streifzug gedaempft, im Kampf offen. */
      musikFilter.frequency.value = 850 + intensitaet * 3600;

      /* Wie weit ist die Figur unter der Strasse? */
      untenAnteil = clamp((-1.0 - hoehe) / 4.0, 0, 1);

      /* Stadtklang: unten Verkehr, oben Wind. Unter der Erde faellt beides
         weg und es bleibt das Grollen im Tunnel. */
      const obenAnteil = clamp((hoehe - 18) / 45, 0, 1);
      stadtBus.gain.value = 0.55;
      rauschFilter.frequency.value = (320 - obenAnteil * 200) * (1 - untenAnteil * 0.75);
      rausch.__g.gain.value = 0.9 * (1 - untenAnteil * 0.8);
      windFilter.frequency.value = 620 + tempo01 * 900;
      wind.__g.gain.value = (obenAnteil * 0.35 + tempo01 * 0.3 + (regen ? 0.12 : 0)) *
                            (1 - untenAnteil);
      tunnelG.gain.value = untenAnteil * 0.55;
      /* Auch die Effekte bekommen den Raum: unten dumpf und mit Hall. */
      if (SFX.raum) SFX.raum(untenAnteil);

      /* Ferne Geraeusche der Stadt - ueber der Erde Hupen und Sirenen,
         unten stattdessen ein vorbeifahrender Zug in der Ferne. */
      ereignisCd -= dt;
      if (ereignisCd <= 0 && untenAnteil < 0.5) {
        ereignisCd = rand(7, 20);
        const t = c.currentTime;
        if (Math.random() < 0.55) {
          note(330 + rand(-30, 30), t, 0.3, 'square', 0.02 * (1 - obenAnteil), stadtBus);
        } else {
          /* Sirene: zwei abwechselnde Toene */
          for (let i = 0; i < 6; i++) {
            note(i % 2 ? 760 : 620, t + i * 0.45, 0.4, 'sine', 0.012 * (1 - obenAnteil), stadtBus);
          }
        }
      }
      tunnelCd -= dt;
      if (tunnelCd <= 0) {
        tunnelCd = rand(9, 22);
        if (untenAnteil > 0.5) {
          /* Anschwellendes Grollen: ein Zug im Nachbartunnel. */
          const t = c.currentTime;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.09, t + 1.6);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
          g.connect(stadtBus);
          const o = c.createOscillator();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(38, t);
          o.frequency.linearRampToValueAtTime(52, t + 1.6);
          o.frequency.linearRampToValueAtTime(30, t + 4.2);
          const f = c.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 190;
          o.connect(f); f.connect(g);
          o.start(t); o.stop(t + 4.3);
        }
      }

      /* Musikschleife im Voraus planen - nur wenn sie auch hoerbar ist. */
      if (modus !== 'an') { naechsterTakt = c.currentTime + 0.1; return; }
      const schrittDauer = intensitaet > 0.35 ? 0.26 : 0.36;
      let schutz = 0;
      while (naechsterTakt < c.currentTime + 0.25 && schutz++ < 16) {
        if (naechsterTakt < c.currentTime) naechsterTakt = c.currentTime + 0.02;
        planeTakt(naechsterTakt);
        naechsterTakt += schrittDauer;
      }
    },
  };
})();

/* ======================= Renderer / Szene ======================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = 0x9fc4e8;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(0xb6cde6, 140, 520);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 900);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* Licht */

const sun = new THREE.DirectionalLight(0xfff2dd, 1.15);
sun.castShadow = true;
/* 2048er Schattenkarte war bei einem Ausschnitt von 180 m Kantenlänge
   deutlich feiner, als man je sieht – kostet aber viermal so viele Pixel
   wie 1024. 1536 trifft die Mitte. */
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = true;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.bias = -0.0004;
scene.add(sun); scene.add(sun.target);
const himmel = new THREE.HemisphereLight(0xcfe4ff, 0x51452e, 0.85);
/* ---- Licht unter der Erde ----
   Unten kommt weder Sonne noch Himmelslicht hin: Spieler und Zivilisten
   waren dort pechschwarze Silhouetten. Diese Lampe haengt ueber der Figur,
   sobald sie unter der Strasse ist, und geht darueber wieder aus. */
const untenLicht = new THREE.PointLight(0xfff0d0, 0, 26, 1.6);
untenLicht.position.set(0, -8, 0);
scene.add(untenLicht);

/* ======================= Tag und Nacht =======================
   Ein voller Umlauf dauert acht Minuten: Morgen, Mittag, Abend, Nacht.
   Sonnenstand, Farben, Nebel und Himmel wandern mit. Nachts leuchten die
   Fenster, Ampeln und der Suchscheinwerfer erst richtig. */
scene.add(himmel);
const TAG = { dauer: 900, zeit: 0.42 };   // 0 = Mitternacht, 0.5 = Mittag
/* Ein voller Tag dauert jetzt 15 statt 8 Minuten – vorher stand man
   gefühlt ständig im Dunkeln. */
const SONNE_RICHTUNG = new THREE.Vector3(0.5, 0.8, 0.3);
const _mischFarbe = new THREE.Color();
const _tagA = new THREE.Color(), _tagB = new THREE.Color();

function mischen(ziel, farbeA, farbeB, t) {
  _tagA.setHex(farbeA); _tagB.setHex(farbeB);
  ziel.copy(_tagA).lerp(_tagB, t);
  return ziel;
}

if (typeof window !== "undefined") window.__setzeZeit = (t) => { TAG.zeit = t; };
/* ======================= Wetter =======================
   Regen zieht ab und zu über die Stadt. Die Tropfen sind ein einziges
   Punktobjekt, das um die Kamera herum mitwandert – dadurch kostet der
   ganze Regen nur einen Zeichenaufruf. */
const REGEN = { an: false, staerke: 0, naechsterWechsel: 70, erlaubt: true };
/* Material der Fahrbahn – bei Regen wird der Asphalt dunkler und wirkt nass. */
let strassenMat = null;
/* Gullis, aus denen Dampf steigt – wird beim Stadtbau gefüllt. */
const DAMPF_STELLEN = [];
/* Ab welcher Entfernung Figuren nicht mehr animiert werden – hängt an der
   Grafikstufe in den Einstellungen. */
let LOD_WEITE = 130;
let regenPunkte = null, regenGeschw = null;
const REGEN_ANZAHL = 3200, REGEN_BOX = 55;

function baueRegen() {
  /* Jeder Tropfen ist ein kurzer Strich statt eines Punktes – erst dadurch
     sieht es nach Regen aus und nicht nach Schneeflocken. */
  const pos = new Float32Array(REGEN_ANZAHL * 6);
  regenGeschw = new Float32Array(REGEN_ANZAHL);
  for (let i = 0; i < REGEN_ANZAHL; i++) {
    const x = rand(-REGEN_BOX, REGEN_BOX), y = rand(0, 48), z = rand(-REGEN_BOX, REGEN_BOX);
    pos[i * 6] = x;     pos[i * 6 + 1] = y;        pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x; pos[i * 6 + 4] = y - 0.7;  pos[i * 6 + 5] = z;
    regenGeschw[i] = rand(30, 48);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  regenPunkte = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color: 0xc6d8ea, transparent: true, opacity: 0, depthWrite: false }));
  regenPunkte.frustumCulled = false;
  scene.add(regenPunkte);
}

function updateWetter(dt) {
  if (!regenPunkte) baueRegen();
  REGEN.naechsterWechsel -= dt;
  if (REGEN.naechsterWechsel <= 0) {
    REGEN.an = !REGEN.an;
    REGEN.naechsterWechsel = REGEN.an ? rand(50, 110) : rand(120, 240);
  }
  const ziel = (REGEN.an && REGEN.erlaubt) ? 1 : 0;
  REGEN.staerke += clamp(ziel - REGEN.staerke, -dt * 0.25, dt * 0.25);
  regenPunkte.material.opacity = REGEN.staerke * 0.42;
  regenPunkte.visible = REGEN.staerke > 0.02;
  if (!regenPunkte.visible) return;

  /* Tropfen fallen; wer unten ankommt, wird oben neu eingesetzt.
     Das ganze Feld folgt der Kamera, damit es nie ausgeht. */
  const pos = regenPunkte.geometry.attributes.position;
  const a = pos.array;
  const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y;
  for (let i = 0; i < REGEN_ANZAHL; i++) {
    const o = i * 6;
    let x = a[o] + 5 * dt;
    let y = a[o + 1] - regenGeschw[i] * dt;
    let z = a[o + 2];
    if (y < cy - 28) { y = cy + 28; x = cx + rand(-REGEN_BOX, REGEN_BOX); z = cz + rand(-REGEN_BOX, REGEN_BOX); }
    if (Math.abs(x - cx) > REGEN_BOX) x = cx - Math.sign(x - cx) * REGEN_BOX;
    if (Math.abs(z - cz) > REGEN_BOX) z = cz - Math.sign(z - cz) * REGEN_BOX;
    a[o] = x;     a[o + 1] = y;        a[o + 2] = z;
    a[o + 3] = x - 0.09; a[o + 4] = y - 0.8; a[o + 5] = z;
  }
  pos.needsUpdate = true;
}

if (typeof window !== "undefined") {
  window.__regenAn = () => { REGEN.an = true; REGEN.staerke = 1; REGEN.naechsterWechsel = 999; };
  window.__regenInfo = () => ({ an: REGEN.an, staerke: +REGEN.staerke.toFixed(2), sichtbar: regenPunkte ? regenPunkte.visible : null });
}
function updateTagNacht(dt) {
  TAG.zeit = (TAG.zeit + dt / TAG.dauer) % 1;
  const w = TAG.zeit * Math.PI * 2;
  /* Sonnenhöhe: -1 (tiefe Nacht) bis +1 (Mittag) */
  const hoch = -Math.cos(w);
  const tagAnteil = clamp((hoch + 0.25) / 1.1, 0, 1);
  /* Dämmerung: kurz vor Sonnenauf- und -untergang am stärksten */
  const daemmer = clamp(1 - Math.abs(hoch) * 3.2, 0, 1);

  /* Nur die RICHTUNG merken – die Position setzt die Kamera, damit der
     Schattenausschnitt dem Spieler folgt. */
  SONNE_RICHTUNG.set(Math.sin(w) * 0.8, Math.max(0.12, hoch), Math.cos(w * 0.6) * 0.6 + 0.35).normalize();
  sun.intensity = 0.4 + tagAnteil * 0.85;
  mischen(sun.color, 0xff9a55, 0xfff2dd, 1 - daemmer);
  /* Nachts deutlich heller als vorher: bei Nacht UND Regen war das Bild
     fast schwarz, man konnte weder Gegner noch die eigene Figur erkennen.
     Eine Großstadt bei Nacht ist durch Straßen- und Fensterlicht ohnehin
     nie wirklich dunkel. */
  himmel.intensity = 0.72 + tagAnteil * 0.36;
  /* Auch INNEN in einem Baukasten-Haus braucht es Licht: der Innenraum ist
     rundum geschlossen, Sonne und Himmel kommen nicht hinein, und ohne
     Lampe stuende man in einer schwarzen Kiste. */
  /* Unter Tage die Lampe hoch- und das Himmelslicht anheben. Ohne das ist
     unten alles schwarz, weil dort weder Sonne noch Himmel hinkommt. */
  const unten = clamp((-1.0 - player.pos.y) / 3.5, 0, 1);
  const drin = imKitHaus(player.pos) ? 1 : 0;
  const lampe = Math.max(unten, drin * 0.85);
  untenLicht.intensity = lampe * 2.2;
  untenLicht.position.set(player.pos.x, player.pos.y + 3.0, player.pos.z);
  himmel.intensity += unten * 0.9;
  sun.intensity *= 1 - unten * 0.7;

  const himmelFarbe = daemmer > 0.35
    ? mischen(_mischFarbe, 0x121a2e, 0xe0794a, daemmer)
    : mischen(_mischFarbe, 0x1b2740, 0x9fc4e8, tagAnteil);
  scene.background.copy(himmelFarbe);
  scene.fog.color.copy(himmelFarbe).lerp(_tagB.setHex(0xffffff), 0.12 * tagAnteil);

  /* Nachts wird die Sicht kürzer – das gibt Tiefe und spart Rechenzeit. */
  scene.fog.near = 110 + tagAnteil * 60;
  scene.fog.far = 300 + tagAnteil * 240;
  if (REGEN.staerke > 0.02) {
    /* Bei Regen wird alles grauer und die Sicht kürzer. */
    scene.background.lerp(_tagB.setHex(0x5a6472), REGEN.staerke * 0.55);
    scene.fog.color.lerp(_tagB.setHex(0x5a6472), REGEN.staerke * 0.55);
    scene.fog.far *= 1 - REGEN.staerke * 0.3;
    /* Regen dämpft nur noch leicht – zusammen mit der Nacht war es sonst
       zappenduster. */
    sun.intensity *= 1 - REGEN.staerke * 0.25;
  }
  window.__nacht = tagAnteil < 0.35;
}

/* ======================= Canvas-Texturen ======================= */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* Fensterfassaden (3 Varianten).
   Statt flacher Rechtecke gibt es jetzt richtige Fenster: Rahmen mit
   Sprosse, ein Raum dahinter mit Boden, Möbelschatten und in manchen
   erleuchteten Fenstern eine Person am Fenster. Beim Klettern klebt man
   direkt davor – dort fällt das am meisten auf. */
const facadeTexes = [
  ['#3d4657', '#20262f', '#ffe6a6'],
  ['#5d5348', '#332e28', '#ffd98a'],
  ['#6b7683', '#3b434c', '#fff0c4'],
].map(([wand, raumDunkel, licht]) => canvasTex(256, 512, (g) => {
  g.fillStyle = wand; g.fillRect(0, 0, 256, 512);
  /* Feiner Putz: leichte Körnung, damit die Wand nicht wie Papier wirkt */
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
    g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2);
  }
  const SP_X = 32, SP_Y = 32;          // Fensterraster
  const FW = 21, FH = 20;              // Fenstergröße
  for (let y = 6; y < 500; y += SP_Y) {
    // Geschossband
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y + FH + 3, 256, 3);
    g.fillStyle = 'rgba(0,0,0,0.20)'; g.fillRect(0, y + FH + 6, 256, 2);
    for (let x = 6; x < 246; x += SP_X) {
      const hell = Math.random() < 0.17;
      // Laibung: Fenster liegt in der Wand zurück
      g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(x - 2, y - 2, FW + 4, FH + 4);
      // Raum dahinter
      if (hell) {
        const gr = g.createLinearGradient(x, y, x, y + FH);
        gr.addColorStop(0, licht);
        gr.addColorStop(1, 'rgba(120,80,30,1)');
        g.fillStyle = gr;
      } else {
        g.fillStyle = raumDunkel;
      }
      g.fillRect(x, y, FW, FH);
      if (hell) {
        // Zimmerboden und ein Möbelstück als Schatten
        g.fillStyle = 'rgba(60,35,10,0.55)'; g.fillRect(x, y + FH - 5, FW, 5);
        if (Math.random() < 0.6) {
          const mw = 4 + Math.random() * 7;
          g.fillStyle = 'rgba(40,24,8,0.6)';
          g.fillRect(x + Math.random() * (FW - mw), y + FH - 10, mw, 6);
        }
        // Person am Fenster
        if (Math.random() < 0.3) {
          const px = x + 3 + Math.random() * (FW - 9);
          g.fillStyle = 'rgba(28,18,10,0.82)';
          g.fillRect(px + 1, y + FH - 13, 4, 9);          // Rumpf
          g.beginPath();
          g.arc(px + 3, y + FH - 15, 2.2, 0, Math.PI * 2);
          g.fill();                                        // Kopf
        }
      } else {
        // Spiegelung des Himmels im dunklen Glas
        const gr = g.createLinearGradient(x, y, x, y + FH);
        gr.addColorStop(0, 'rgba(175,205,238,0.5)');
        gr.addColorStop(0.55, 'rgba(120,150,185,0.16)');
        gr.addColorStop(1, 'rgba(20,26,34,0.25)');
        g.fillStyle = gr; g.fillRect(x, y, FW, FH);
      }
      // Rahmen und Sprosse
      g.strokeStyle = 'rgba(232,238,245,0.55)'; g.lineWidth = 1.4;
      g.strokeRect(x + 0.7, y + 0.7, FW - 1.4, FH - 1.4);
      g.fillStyle = 'rgba(232,238,245,0.4)';
      g.fillRect(x + FW / 2 - 0.7, y, 1.4, FH);
      // Sims unter dem Fenster
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x - 2, y + FH + 1, FW + 4, 2);
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x - 2, y + FH + 3, FW + 4, 1);
    }
  }
}));

const roofTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#4a4f56'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#41454b';
  for (let i = 0; i < 40; i++) g.fillRect(rand(0, 60), rand(0, 60), rand(2, 6), rand(2, 6));
});

const asphaltTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#33363c'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2e3137';
  for (let i = 0; i < 160; i++) g.fillRect(rand(0, 126), rand(0, 126), 2, 2);
});
asphaltTex.repeat.set(60, 60);

/* Gehweg. Frueher #9aa0a6 - viel zu hell: die Platten liegen waagerecht,
   bekommen also Sonne UND das volle Himmelslicht (zusammen gut das
   Doppelte). Mit dem hellen Grundton lief das ins Weiss, der Gehweg sah
   aus wie eine leuchtende Flaeche ohne Struktur. Jetzt dunkler, dazu
   Koernung und Fugen, damit man das Material sieht. */
const sidewalkTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#575c62'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#60656b' : '#4e5359';
    g.fillRect(rand(0, 63), rand(0, 63), rand(1, 3), rand(1, 3));
  }
  g.strokeStyle = '#474c52'; g.lineWidth = 2;
  g.strokeRect(1, 1, 62, 62);
});

/* Rasen: ungleichmäßige Grüntöne plus einzelne Halme. Eine glatte grüne
   Fläche sah aus wie Filz. */
const rasenTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#16290f'; g.fillRect(0, 0, 128, 128);
  /* Nur leichte Flecken – zu viel Kontrast sah aus wie Tarnmuster. */
  for (let i = 0; i < 200; i++) {
    const t = Math.random();
    g.fillStyle = t < 0.5 ? '#1a3012' : '#12230d';
    const w = rand(6, 20), h = rand(6, 20);
    g.globalAlpha = rand(0.12, 0.32);
    g.fillRect(rand(0, 128 - w), rand(0, 128 - h), w, h);
  }
  g.globalAlpha = 1;
  g.lineCap = 'round';
  for (let i = 0; i < 420; i++) {              // einzelne Halme
    const x = rand(0, 128), y = rand(0, 128), l = rand(2, 4.5);
    g.strokeStyle = Math.random() < 0.45 ? 'rgba(58,92,44,0.45)' : 'rgba(14,30,12,0.5)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-1.2, 1.2), y - l); g.stroke();
  }
});
rasenTex.repeat.set(14, 14);

/* Kiesweg für den Park. */
const wegTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#5d5342'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#6b6049' : '#4e4536';
    g.fillRect(rand(0, 62), rand(0, 62), rand(1, 3), rand(1, 3));
  }
});
wegTex.repeat.set(6, 6);

/* (Die Ladentextur ist entfallen - es gibt keine selbstgebauten
   Schaufenster mehr, siehe schmueckeHaus.) */

const waterTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#20537c'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(255,255,255,${rand(0.03, 0.1)})`;
    g.lineWidth = rand(0.5, 1.5);
    const y = rand(0, 128); g.beginPath();
    g.moveTo(rand(0, 60), y); g.lineTo(rand(60, 128), y + rand(-3, 3)); g.stroke();
  }
});
waterTex.repeat.set(10, 10);

/* Netz-Muster für den Heldenanzug */
const suitTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(20,0,0,0.85)'; g.lineWidth = 1.6;
  for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 14) {
    g.beginPath();
    for (let x = 0; x <= 128; x += 8) {
      const yy = y + Math.sin((x / 16) * Math.PI) * 4;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
});
suitTex.repeat.set(2, 2);

/* Die drei fertigen Haeuser aus dem Baukasten, mit ihren gemessenen
   Massen - daraus entsteht das Hindernis, das Modell selbst bringt keins
   mit. Sie sind niedrig (17 bis 28 m) und ersetzen deshalb nicht die
   Tuerme, sondern bilden ein paar Blocks Altbaugegend. */
/* dreh richtet die SCHAUSEITE nach +z. Die Haeuser sind Reihenhaus-
   Bausteine: eine Seite hat Fenster, Gesims und Freitreppe, die anderen
   sind glatte Brandwaende. Abgezaehlt, wie viele Eckpunkte dicht an
   jeder der vier Seiten liegen - die Front hat ein Vielfaches:
   Small_1 +x 2740 gegen +z 296, Medium +z 11058 gegen -z 1393,
   Large +z 19173 gegen +x 2531. Frei in den Block gestellt zeigte
   deshalb regelmaessig eine kahle Wand zur Strasse. */
/* Die Masse sind ABGEMESSEN, und zwar als Von-Bis: die Modelle sind NICHT
   auf ihren Ursprung zentriert. Building_Large_2 liegt in z zwischen
   -16,32 und +0,32, seine Mitte also acht Meter neben dem Setzpunkt. Mit
   einem mittig gesetzten Hindernis stand rings um das Haus eine
   unsichtbare Wand, und auf dem Dach fehlte der Boden - man fiel hinein.
   Genau das war der Fehler. */
/* tuer = die Tueroeffnung im EIGENEN System des Modells, immer auf der
   +z-Seite (das ist bei allen dreien die Schauseite).
   Abgetastet mit Strahlen von aussen nach innen, auf drei Hoehen:
     Small_1  x -0,45 .. 0,52  (0,97 m, erst ab 1,2 m Hoehe - davor eine Stufe)
     Medium   x -0,42 .. 0,50  (0,92 m)
     Large_2  x -0,49 .. 0,54  (1,03 m)
   Der Durchgang im Hindernis wird etwas weiter gefasst (1,40 m): der
   Kollisionszylinder der Figur ist 90 cm breit, sonst passt sie nicht
   hindurch. Sichtbar streift dabei nichts - die Schulter kommt rechnerisch
   auf 50 cm neben die Mitte, die Tuerkante liegt bei 52 cm. */
const KIT_HAEUSER = [
  /* hoch = Hochparterre: bei Small_1 liegt der Fussboden des Modells
     gemessen 1,00 m ueber dem Gehweg (Rueckwaerts geprueft: Strahl von
     oben trifft innen bei y = 1,25, Gehweg liegt bei 0,25). Ohne diesen
     Wert stuende man bis zur Huefte im Boden. Davor kommt eine Treppe. */
  { name: 'Building_Small_1',      x0: -7.23, x1: 5.23, z0: -12.23, z1: 2.31,
    h: 17.0, dreh: -Math.PI / 2, tuer: { x0: -0.70, x1: 0.75 }, hoch: 1.00 },
  { name: 'Building_Medium_2_001', x0: -7.53, x1: 7.53, z0: -12.49, z1: 0.57,
    h: 25.0, dreh: 0, tuer: { x0: -0.70, x1: 0.75 } },
  { name: 'Building_Large_2',      x0: -9.32, x1: 11.32, z0: -16.32, z1: 0.32,
    h: 28.0, dreh: 0, tuer: { x0: -0.70, x1: 0.75 } },
];
/* Lichte Hoehe der Tuer und Dicke der Wandscheiben. */
const KIT_TUER_HOCH = 2.45;
const KIT_WAND = 0.8;
/* Die Modelle haben oben eine schmale Attika: das begehbare Dach liegt
   gemessene 20 cm unter der Oberkante des Umrisses. Ohne diesen Abzug
   steht die Figur 20 cm ueber dem Dach in der Luft. */
const KIT_ATTIKA = 0.20;
/* Das gedrehte Rechteck eines Hauses in Weltkoordinaten. Die Drehung ist
   immer ein Vielfaches von 90 Grad, deshalb reicht es, die vier Ecken zu
   drehen und Kleinstes und Groesstes zu nehmen. */
/* Ein Rechteck aus dem EIGENEN System des Modells in Weltkoordinaten.
   Die Drehung ist immer ein Vielfaches von 90 Grad, deshalb bleibt aus
   einem achsenparallelen Rechteck wieder eines. */
function kitRechteck(x, z, ry, lx0, lx1, lz0, lz1) {
  const c = Math.cos(ry), si = Math.sin(ry);
  let ax0 = Infinity, ax1 = -Infinity, az0 = Infinity, az1 = -Infinity;
  for (const [lx, lz] of [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]]) {
    const wx = lx * c + lz * si, wz = -lx * si + lz * c;
    ax0 = Math.min(ax0, wx); ax1 = Math.max(ax1, wx);
    az0 = Math.min(az0, wz); az1 = Math.max(az1, wz);
  }
  return { x0: x + ax0, x1: x + ax1, z0: z + az0, z1: z + az1 };
}

/* ---- Hindernis fuer ein Baukasten-Haus ----
   Bis hierher war das EIN massiver Quader ueber die ganze Grundflaeche -
   deshalb liess sich kein Haus betreten. Jetzt sind es vier Wandscheiben
   mit einer Luecke in der Tuer, dazu ein Sturz darueber und eine
   Dachplatte. Die Dachplatte ist wichtig: ohne sie faellt man in der Mitte
   des Daches ins Haus.
   Alle Kaesten kommen aus den GEMESSENEN Grenzen des Modells, nicht aus
   Breite und Tiefe um den Setzpunkt herum. */
const KIT_INNEN = [];              // {x0,x1,z0,z1,decke,boden} - fuers Innenlicht
/* Nur die Haeuser mit Hochparterre - sie bestimmen den Boden im Haus.
   Eine eigene Liste, weil groundY sie in jedem Bild durchgeht. */
const KIT_HOCH = [];
/* Die Tritte vor deren Tueren - ebenfalls Boden, nicht Sperre. */
const KIT_STUFEN = [];
/* Umschliessendes Rechteck ueber beide Listen. groundY laeuft in jedem
   Bild fuer jede Figur und jedes Fahrzeug; ohne diese Vorpruefung wuerde
   es fuer die ganze Stadt ein Dutzend Rechtecke abklappern, obwohl die
   Hochparterres auf einer Handvoll Blocks stehen. */
const KIT_BOX = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
function kitBoxDazu(r) {
  KIT_BOX.x0 = Math.min(KIT_BOX.x0, r.x0); KIT_BOX.x1 = Math.max(KIT_BOX.x1, r.x1);
  KIT_BOX.z0 = Math.min(KIT_BOX.z0, r.z0); KIT_BOX.z1 = Math.max(KIT_BOX.z1, r.z1);
}
/* Plaetze fuer Leute in Innenraeumen. Die Liste entsteht beim Bauen, die
   Figuren kommen erst spaeter dazu (updateInnenLeute).
   boden = Standflaeche, sitz = Hoehe der Sitzflaeche (fehlt beim Stehen). */
const INNEN_PLAETZE = [];
function merkeInnenPlatz(x, boden, z, ry, sitz) {
  INNEN_PLAETZE.push({ x, boden, z, ry, sitz });
}
function kitHindernis(t, x, z, ry, kasten) {
  const oben = SLAB_H + t.h;
  const W = KIT_WAND;
  const bodenY = SLAB_H + (t.hoch || 0);      // Hoehe des Fussbodens im Haus
  const scheibe = (lx0, lx1, lz0, lz1, y0, h) => {
    if (lx1 - lx0 < 0.05 || lz1 - lz0 < 0.05) return;
    const r = kitRechteck(x, z, ry, lx0, lx1, lz0, lz1);
    addCollider({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, h, y0 });
  };
  if (!t.tuer) {
    addCollider({ x0: kasten.x0, x1: kasten.x1, z0: kasten.z0, z1: kasten.z1,
                  h: oben, y0: -1.0 });
    return;
  }
  /* Rueckwand und die beiden Seitenwaende ueber die volle Hoehe. */
  scheibe(t.x0, t.x1, t.z0, t.z0 + W, -1.0, oben);            // hinten
  scheibe(t.x0, t.x0 + W, t.z0, t.z1, -1.0, oben);            // links
  scheibe(t.x1 - W, t.x1, t.z0, t.z1, -1.0, oben);            // rechts
  /* Front links und rechts der Tuer, dazu der Sturz darueber. */
  scheibe(t.x0, t.tuer.x0, t.z1 - W, t.z1, -1.0, oben);
  scheibe(t.tuer.x1, t.x1, t.z1 - W, t.z1, -1.0, oben);
  scheibe(t.tuer.x0, t.tuer.x1, t.z1 - W, t.z1, bodenY + KIT_TUER_HOCH, oben);
  /* Dachplatte ueber die ganze Grundflaeche - sonst faellt man von oben
     hinein. 1,2 m dick, damit sie beim Klettern von innen nicht
     uebersprungen wird. */
  addCollider({ x0: kasten.x0, x1: kasten.x1, z0: kasten.z0, z1: kasten.z1,
                h: oben - KIT_ATTIKA, y0: oben - 1.2 });
  /* Fuer das Innenlicht merken: der begehbare Innenraum. */
  const innen = kitRechteck(x, z, ry, t.x0 + W, t.x1 - W, t.z0 + W, t.z1 - W);
  innen.decke = oben - 1.2;
  innen.boden = bodenY;
  KIT_INNEN.push(innen);
  if (t.hoch) {
    KIT_HOCH.push(innen);
    kitBoxDazu(innen);
    /* Treppe vor der Tuer: drei Tritte vom Gehweg auf das Hochparterre.
       Sie sind BODEN, keine Sperren. Eine Sperre waere fuer die Figur eine
       Wand: sie laeuft dagegen und beginnt zu klettern, statt hinaufzu-
       steigen (gemessen: y 0,25 -> 7,17 an der Fassade hoch). Wie beim
       U-Bahn-Abgang liefert deshalb groundY die Stufenhoehe.
       Der oberste Tritt reicht bis unter die Tuerlaibung, sonst faellt man
       auf der Schwelle einen Meter tief. */
    const n = 3, sh = t.hoch / n;
    for (let i = 0; i < n; i++) {
      const y = SLAB_H + sh * (i + 1);
      const a = i === n - 1 ? t.z1 - W - 0.05 : t.z1 + (n - 1 - i) * 0.34;
      const b2 = t.z1 + (n - i) * 0.34;
      const r2 = kitRechteck(x, z, ry, t.tuer.x0 - 0.35, t.tuer.x1 + 0.35, a, b2);
      deko(r2.x1 - r2.x0, sh + 0.12, r2.z1 - r2.z0,
           (r2.x0 + r2.x1) / 2, y - sh / 2 - 0.06, (r2.z0 + r2.z1) / 2, 0x6f6a62);
      KIT_STUFEN.push({ x0: r2.x0, x1: r2.x1, z0: r2.z0, z1: r2.z1, y });
      kitBoxDazu(r2);
    }
  }
  kitMoebel(t, x, z, ry, bodenY);
}

/* ---- Einrichtung eines begehbaren Hauses ----
   Die Haeuser waren begehbar, aber innen leere Kaesten. Hier entsteht ein
   Ladenlokal: Regalwand an der Rueckwand, Verkaufstheke quer davor, zwei
   Tische mit Stuehlen, Pflanzen in den Ecken, Plakate an den Seitenwaenden
   und eine Haengelampe.
   Gerechnet wird im EIGENEN System des Modells (lx nach rechts, lz nach
   hinten); ort() rechnet einen solchen Punkt in Weltkoordinaten um, und
   die Kisten bekommen dieselbe Drehung mitgegeben. Die Tuer liegt bei
   lz = t.z1, gearbeitet wird also von der Rueckwand (t.z0) nach vorn. */
const KIT_WARE = [0xd9c99c, 0xa8514a, 0x4a6ea0, 0x5f8f5f, 0xd6d2c6, 0xc09248];
function kitMoebel(t, x, z, ry, bodenY) {
  const W = KIT_WAND, B = bodenY;
  const co = Math.cos(ry), si = Math.sin(ry);
  const ort = (lx, lz) => ({ x: x + lx * co + lz * si, z: z - lx * si + lz * co });
  /* Kiste an einem Punkt des Modellsystems. */
  const kiste = (bw, bh, bd, lx, by, lz, farbe) => {
    const o = ort(lx, lz);
    deko(bw, bh, bd, o.x, by, o.z, farbe, ry);
  };
  /* Kiste MIT Sperre - fuer alles, wogegen man laufen kann. */
  const moebel = (bw, bh, bd, lx, by, lz, farbe) => {
    kiste(bw, bh, bd, lx, by, lz, farbe);
    const r = kitRechteck(x, z, ry, lx - bw / 2, lx + bw / 2, lz - bd / 2, lz + bd / 2);
    addCollider({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1,
                  h: by + bh / 2, y0: B - 0.1, klein: true });
  };
  const ix0 = t.x0 + W, ix1 = t.x1 - W;          // lichte Breite
  const iz0 = t.z0 + W, iz1 = t.z1 - W;          // hinten .. vorn (Tuer)
  const mitte = (ix0 + ix1) / 2;
  const breit = ix1 - ix0, tief2 = iz1 - iz0;
  if (breit < 3 || tief2 < 3) return;

  /* Einen eigenen Fussboden braucht es nicht - das Modell bringt seinen
     eigenen mit (bei Small_1 als Hochparterre). Nur ein Teppich. */
  kiste(Math.min(4.2, breit - 1.2), 0.05, 2.6, mitte, B + 0.02, iz0 + tief2 * 0.62, 0x7a4a3e);

  /* ---- Regalwand an der Rueckwand ---- */
  const rb = Math.min(breit - 1.0, 7.0);
  kiste(rb, 2.60, 0.34, mitte, B + 1.30, iz0 + 0.20, 0x6a5342);
  for (const hy of [0.55, 1.10, 1.65, 2.20]) {
    kiste(rb - 0.12, 0.07, 0.42, mitte, B + hy, iz0 + 0.30, 0x8a6f56);
    const n = Math.max(3, Math.round(rb / 0.7));
    for (let k = 0; k < n; k++) {
      const wx = mitte + (k - (n - 1) / 2) * ((rb - 0.5) / n);
      kiste(0.24, 0.28, 0.26, wx, B + hy + 0.18, iz0 + 0.30,
            KIT_WARE[(k + Math.round(hy * 2)) % KIT_WARE.length]);
    }
  }

  /* ---- Verkaufstheke ---- */
  const tb = Math.min(breit - 2.2, 5.0);
  const tz = iz0 + 1.75;
  moebel(tb, 0.95, 0.70, mitte, B + 0.475, tz, 0xb9a07c);
  kiste(tb + 0.12, 0.07, 0.86, mitte, B + 0.98, tz, 0x4a4038);
  kiste(0.34, 0.26, 0.30, mitte + tb / 2 - 0.6, B + 1.14, tz, 0x2b3038);   // Kasse

  /* ---- Verkaufsinseln in der Raummitte ----
     Die Raeume sind gross (bis 19 x 15 m). Nur Theke und Regal an der
     Rueckwand liessen die Mitte leer wirken. */
  for (const s2 of [-1, 1]) {
    const cx2 = mitte + s2 * Math.min(breit / 4 + 0.6, 3.0);
    const cz2 = iz0 + tief2 * 0.45;
    moebel(2.40, 0.90, 1.10, cx2, B + 0.45, cz2, 0x7b6a55);
    kiste(2.52, 0.07, 1.22, cx2, B + 0.93, cz2, 0x4a4038);
    for (let k = 0; k < 4; k++) {
      const wx = cx2 + (k - 1.5) * 0.56;
      kiste(0.24, 0.26, 0.24, wx, B + 1.09, cz2, KIT_WARE[(k + (s2 > 0 ? 2 : 0)) % KIT_WARE.length]);
    }
  }

  /* ---- Tische mit Stuehlen im vorderen Teil ---- */
  for (const s2 of [-1, 1]) for (const reihe of [0.70, 0.88]) {
    const cx2 = mitte + s2 * Math.min(breit / 2 - 1.4, 3.4);
    const cz2 = iz0 + tief2 * reihe;
    if (Math.abs(cx2 - mitte) < 1.0) continue;
    moebel(1.20, 0.06, 1.20, cx2, B + 0.75, cz2, 0xa8845c);              // Platte
    kiste(0.16, 0.72, 0.16, cx2, B + 0.36, cz2, 0x5a4a3a);               // Fuss
    kiste(0.60, 0.06, 0.60, cx2, B + 0.03, cz2, 0x5a4a3a);
    for (const s3 of [-1, 1]) {
      const sx3 = cx2 + s3 * 0.95;
      kiste(0.46, 0.06, 0.46, sx3, B + 0.45, cz2, 0x6b5a46);             // Sitz
      kiste(0.46, 0.55, 0.08, sx3, B + 0.74, cz2 + s3 * 0.20, 0x6b5a46); // Lehne
      for (const [ax2, az2] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]])
        kiste(0.06, 0.42, 0.06, sx3 + ax2, B + 0.21, cz2 + az2, 0x4a3d30);
    }
  }

  /* ---- Pflanzen in den hinteren Ecken ---- */
  for (const s2 of [-1, 1]) {
    const px = mitte + s2 * (breit / 2 - 0.6);
    const pz = iz0 + 0.75;
    kiste(0.46, 0.44, 0.46, px, B + 0.22, pz, 0x8a5a3e);
    kiste(0.16, 0.70, 0.16, px, B + 0.79, pz, 0x4a6a3a);
    kiste(0.80, 0.55, 0.80, px, B + 1.30, pz, 0x3f7a44);
  }

  /* ---- Plakate an den Seitenwaenden ---- */
  for (const s2 of [-1, 1]) {
    const px = s2 < 0 ? ix0 + 0.06 : ix1 - 0.06;
    for (const f of [0.45, 0.72]) {
      const pz = iz0 + tief2 * f;
      kiste(0.10, 1.40, 1.00, px, B + 1.70, pz, 0x2a2f36);
      kiste(0.06, 1.22, 0.84, px + s2 * 0.05, B + 1.70, pz, 0xe8e0cc);
    }
  }

  /* ---- Haengelampen ---- */
  for (const f of [0.35, 0.75]) {
    const pz = iz0 + tief2 * f;
    kiste(0.05, 0.90, 0.05, mitte, B + 3.55, pz, 0x3a3f46);
    kiste(1.10, 0.16, 1.10, mitte, B + 3.02, pz, 0x3a3f46);
    kiste(0.95, 0.08, 0.95, mitte, B + 2.92, pz, 0xf6f2e2);
  }

  /* ---- Leute: hinter der Theke und an einem Tisch ---- */
  {
    const o = ort(mitte, tz - 0.75);
    merkeInnenPlatz(o.x, B, o.z, ry + Math.PI);
  }
  for (const s2 of [-1, 1]) {
    const cx2 = mitte + s2 * Math.min(breit / 2 - 1.4, 3.4);
    if (Math.abs(cx2 - mitte) < 1.0) continue;
    const cz2 = iz0 + tief2 * 0.70;
    const o = ort(cx2 - s2 * 0.95, cz2);
    merkeInnenPlatz(o.x, B, o.z, ry + (s2 < 0 ? Math.PI / 2 : -Math.PI / 2), B + 0.48);
  }
}

/* Steht die Figur in einem der begehbaren Haeuser? */
function imKitHaus(pos) {
  for (const r of KIT_INNEN) {
    if (pos.x > r.x0 && pos.x < r.x1 && pos.z > r.z0 && pos.z < r.z1 &&
        pos.y < r.decke && pos.y > r.boden - 2.2) return true;
  }
  return false;
}

function kitKasten(t, x, z, ry) {
  const c = Math.cos(ry), si = Math.sin(ry);
  let ax0 = Infinity, ax1 = -Infinity, az0 = Infinity, az1 = -Infinity;
  for (const [lx, lz] of [[t.x0, t.z0], [t.x1, t.z0], [t.x1, t.z1], [t.x0, t.z1]]) {
    const wx = lx * c + lz * si, wz = -lx * si + lz * c;
    ax0 = Math.min(ax0, wx); ax1 = Math.max(ax1, wx);
    az0 = Math.min(az0, wz); az1 = Math.max(az1, wz);
  }
  return { x0: x + ax0, x1: x + ax1, z0: z + az0, z1: z + az1 };
}
/* Welche Blocks bekommen Altbauten? Sie liegen bewusst AM RAND: zur
   Stadtmitte hin baut das Spiel die hoechsten Tuerme, und die sollen
   bleiben - die fertigen Haeuser sind nur 17 bis 28 m hoch und koennten
   eine Skyline gar nicht tragen. Aussen entsteht so ein Altbauguertel um
   das Hochhausviertel herum. */
const KIT_BLOCKS = [
  [0, 1], [0, 4], [1, 6], [2, 0],
  [4, 6], [5, 0], [6, 2], [6, 5],
];

/* Stellen fuer Bauteile aus dem Baukasten. Die Liste muss VOR dem
   Stadtbau stehen: gesammelt wird beim Bauen, gesetzt erst, wenn die
   Datei geladen ist (siehe ladeStadtteile weiter unten). */
const TEIL_STELLEN = {};       // teilname -> [{x,y,z,ry,s}]
function merkeTeil(name, x, y, z, ry, s) {
  if (!TEIL_STELLEN[name]) TEIL_STELLEN[name] = [];
  TEIL_STELLEN[name].push({ x, y, z, ry: ry || 0, s: s === undefined ? 1 : s });
}
/* Ganze Haeuser stehen in einer eigenen Liste - sie werden kopiert, nicht
   als Instanzen gezeichnet. */
const HAUS_STELLEN = [];
/* Die fertigen Kopien. Jedes Haus besteht aus rund einem Dutzend
   Teilmeshes; ueber die ganze Stadt verteilt sind das schnell ein paar
   hundert Zeichenaufrufe - gemessen 417 bis 490 statt 257 bis 402. Weit
   entfernte werden deshalb ganz abgeschaltet. Bei 170 m ist ein 25-m-Haus
   im Bild so klein und steht so sicher hinter den Tuermen, dass man das
   Verschwinden nicht bemerkt. */
const KIT_KOPIEN = [];
const KIT_SICHT = 170;
let kitTakt = 0;
function updateKitHaeuser(dt) {
  if (!KIT_KOPIEN.length) return;
  /* Nur viermal je Sekunde pruefen - oefter braucht es bei 220 m nicht. */
  kitTakt -= dt;
  if (kitTakt > 0) return;
  kitTakt = 0.25;
  const g2 = KIT_SICHT * KIT_SICHT;
  for (const k of KIT_KOPIEN) {
    const dx = k.position.x - player.pos.x, dz = k.position.z - player.pos.z;
    k.visible = dx * dx + dz * dz < g2;
  }
}
function merkeHaus(name, x, y, z, ry) { HAUS_STELLEN.push({ name, x, y, z, ry: ry || 0 }); }

/* ======================= Stadt bauen ======================= */
const colliders = [];          // {x0,x1,z0,z1,h} – Gebäude & Pylonen
const colliderGrid = new Map(); // "ci,cj" -> [collider,...]

function addCollider(c) {
  colliders.push(c);
  const ci0 = Math.floor((c.x0 - 1 - ORIGIN) / PITCH), ci1 = Math.floor((c.x1 + 1 - ORIGIN) / PITCH);
  const cj0 = Math.floor((c.z0 - 1 - ORIGIN) / PITCH), cj1 = Math.floor((c.z1 + 1 - ORIGIN) / PITCH);
  for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) {
    const k = i + ',' + j;
    if (!colliderGrid.has(k)) colliderGrid.set(k, []);
    colliderGrid.get(k).push(c);
  }
}
function collidersNear(x, z) {
  const k = Math.floor((x - ORIGIN) / PITCH) + ',' + Math.floor((z - ORIGIN) / PITCH);
  return colliderGrid.get(k) || [];
}

function onBridge(x, z) {
  return Math.abs(z - BRIDGE_Z) < BRIDGE_HW &&
         x > BR_X0 - BR_RAMPE && x < BR_X1 + BR_RAMPE;
}
/* Hoehe der Brueckenfahrbahn. Frueher war das eine feste 0,3 und die
   Bruecke begann mitten auf der Uferstrasse - man fuhr gegen eine 30 cm
   hohe Kante, und der erhoehte Gehweg der Promenade lag als Buckel quer
   ueber der Auffahrt. Jetzt laeuft sie an beiden Enden ueber eine Rampe
   auf Strassenhoehe aus. */
function bridgeY(x) {
  if (x < BR_X0) return BR_HOCH * clamp((x - (BR_X0 - BR_RAMPE)) / BR_RAMPE, 0, 1);
  if (x > BR_X1) return BR_HOCH * clamp((BR_X1 + BR_RAMPE - x) / BR_RAMPE, 0, 1);
  return BR_HOCH;
}
function inWater(x, z) {
  return x > RIVER_X0 && x < RIVER_X1 && !onBridge(x, z);
}
/* Eine ordentliche Bank: zwei gusseiserne Wangen, drei Sitzlatten, eine
   geneigte Rückenlehne auf zwei Stützen. Die frühen "Bänke" waren eine
   einzelne Kiste und sahen aus wie ein hingelegter Balken.
   richtung: 0 = Bank steht quer zur x-Achse (Sitzfläche lang in x),
             1 = lang in z. */
function baueBank(x, y, z, laengsZ, holz, rueck) {
  /* rueck = +1 dreht die Lehne auf die andere Seite. Auf dem Bahnsteig
     standen die Baenke sonst mit der Lehne zum Gleis und dem Gesicht zur
     Wand - genau das sah verkehrt herum aus. */
  const rs = rueck === undefined ? -1 : (rueck >= 0 ? 1 : -1);
  const H = holz === undefined ? 0x6b4a2c : holz;
  const L = 2.2;                                  // Länge
  const lx = laengsZ ? 0.62 : L, lz = laengsZ ? L : 0.62;
  const sitzY = y + 0.44;
  /* Wangen */
  for (const s2 of [-1, 1]) {
    const ox = laengsZ ? 0 : s2 * (L / 2 - 0.22);
    const oz = laengsZ ? s2 * (L / 2 - 0.22) : 0;
    deko(laengsZ ? 0.56 : 0.1, 0.44, laengsZ ? 0.1 : 0.56,
         x + ox, y + 0.22, z + oz, 0x33383e);
    /* Fuß am Boden, damit sie nicht schwebt */
    deko(laengsZ ? 0.62 : 0.16, 0.06, laengsZ ? 0.16 : 0.62,
         x + ox, y + 0.03, z + oz, 0x2a2e33);
  }
  /* Sitzlatten */
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * 0.2;
    deko(laengsZ ? 0.17 : lx, 0.055, laengsZ ? lz : 0.17,
         x + (laengsZ ? o : 0), sitzY, z + (laengsZ ? 0 : o), H);
  }
  /* Lehne: zwei Latten, leicht nach hinten versetzt */
  for (let i = 0; i < 2; i++) {
    const hy = sitzY + 0.26 + i * 0.2;
    const back = rs * (0.24 + i * 0.05);
    deko(laengsZ ? 0.14 : lx, 0.14, laengsZ ? lz : 0.14,
         x + (laengsZ ? back : 0), hy, z + (laengsZ ? 0 : back), H);
  }
  /* Lehnenstützen */
  for (const s2 of [-1, 1]) {
    const ox = laengsZ ? rs * 0.26 : s2 * (L / 2 - 0.22);
    const oz = laengsZ ? s2 * (L / 2 - 0.22) : rs * 0.26;
    deko(0.09, 0.62, 0.09, x + ox, sitzY + 0.3, z + oz, 0x33383e);
  }
  addCollider({ x0: x - lx / 2, x1: x + lx / 2, z0: z - lz / 2, z1: z + lz / 2,
                h: sitzY + 0.03, klein: true });
}

/* ---- U-Bahn-Stationen ----
   Jeder Eingang gehört zu einem echten begehbaren Schacht: Treppe nach
   unten, darunter ein Bahnsteig mit Gleis. Damit man wirklich hinunterlaufen
   kann, muss die Bodenhöhe innerhalb des Schachts bekannt sein – deshalb
   fragt groundY hier zuerst nach. */
/* ======================= U-Bahn =======================
   Eine durchgehende Linie in x-Richtung unter der Strasse bei z = UB_Z.
   Vier Stationen, dazwischen offene Tunnel, durch die man wirklich laufen
   kann - vorher war der Tunnelmund nur ein dunkles Loch, das einen zur
   naechsten Station versetzt hat. Auf dem Gleis fahren zwei Zuege, einer
   je Richtung. */
const UBAHNEN = [];                       // gebaute Stationen, { x }
/* Von -12,0 auf -9,0 angehoben. Der Grund ist die Laenge des Abgangs:
   der Gehweg neben dem Schacht ist nachgemessen nur 17 m lang (von +2 bis
   +19 vom Stationsmittelpunkt aus, dann kommt die Querstrasse). Bei 12,25 m
   Gefaelle passte da keine Treppe hinein, die nicht steiler als 45 Grad
   ist - der Schacht ragte deshalb sieben Meter in die Fahrbahn. Mit 9,25 m
   Gefaelle passen zwei Laeufe von je 6 m mit 37 Grad auf den Gehweg. */
const UB_TIEF = -9.0;                     // Bahnsteighoehe unter der Strasse
const UB_GLEIS_TIEF = UB_TIEF - 1.2;      // Sohle des Gleistrogs
const UB_Z = 25;                          // die Linie folgt dieser Strassenachse
const UB_STAT_X = [-150, -50, 50, 150];   // Stationen (Blockmitten)
const UB_HALLE_X = 30;                    // Laenge einer Bahnsteighalle

/* ---- Mehrere Linien ----
   Eine einzige Strecke unter EINER Strasse liess drei Viertel der Stadt
   ohne Anschluss. Es gibt deshalb mehrere Linien, alle in Ost-West-
   Richtung unter je einer Querstrasse des Rasters.
   Der Bauplan ist fuer alle derselbe - er wird nur um dz in z-Richtung
   versetzt. Deshalb genuegt es, beim Bauen einen Versatz zu setzen
   (UB_DZ) und ihn in ubDeko()/ubCollider() aufzuschlagen; der ganze
   uebrige Bauteil bleibt unveraendert.
   dz = -100 liegt unter der Strasse z = -75, dz = +100 unter z = 125.
   Die Stationen sitzen auf Blockmitten, sonst laege ein Treppenschacht
   auf der Fahrbahn statt auf dem Gehweg. */
const UB_LINIEN = [
  { dz: 0,    statX: [-150, -50, 50, 150] },
  { dz: -100, statX: [-100, 0, 100] },
  { dz: 100,  statX: [-100, 0, 100] },
];
for (const l of UB_LINIEN) {
  l.x0 = l.statX[0] - UB_HALLE_X / 2;
  l.x1 = l.statX[l.statX.length - 1] + UB_HALLE_X / 2;
}
/* Versatz der Linie, die GERADE GEBAUT wird. Zur Laufzeit ist er null -
   dort steht der Versatz an jeder Station (UBAHNEN) und an jedem Zug. */
let UB_DZ = 0;
/* Deko und Hindernis mit dem Linienversatz. Alles, was zu einer U-Bahn
   gehoert, geht durch diese beiden - dadurch laesst sich derselbe Bauplan
   mehrfach an verschiedenen Strassen aufstellen. */
/* ---- Eigenes Mesh fuer alles unter der Erde ----
   Die ganze Stadtdeko liegt in EINEM Mesh. Es wird immer gezeichnet, denn
   seine Huellkugel umspannt die halbe Karte. Mit drei U-Bahn-Linien waren
   darin fast eine halbe Million Dreiecke, die man von der Strasse aus nie
   zu sehen bekommt - gemessen stiegen die Dreiecke ueber Tage von 0,86 auf
   1,33 Millionen. Die U-Bahn bekommt deshalb ihr eigenes Mesh, das nur
   sichtbar ist, wenn man wirklich unten ist. */
const ubDekoTeile = [];
function ubDeko(w, h, d, x, y, z, farbe, ry, rz) {
  const t = { w, h, d, x, y, z: z + UB_DZ, farbe, ry: ry || 0, rz: rz || 0 };
  ubDekoTeile.push(t); DEKO_KOPIE.push(t);
}
let ubahnMesh = null;
function baueUBahnMesh() {
  if (!ubDekoTeile.length) return;
  ubahnMesh = new THREE.Mesh(verschmelzeBoxen(ubDekoTeile),
                             new THREE.MeshLambertMaterial({ vertexColors: true }));
  ubahnMesh.receiveShadow = true;
  ubahnMesh.frustumCulled = false;
  cityGroup.add(ubahnMesh);
  ubDekoTeile.length = 0;
}
function ubCollider(c) {
  return addCollider(Object.assign({}, c, { z0: c.z0 + UB_DZ, z1: c.z1 + UB_DZ }));
}
/* Die Schachtloecher stehen in WELTkoordinaten. Wer sie in einer Flaeche
   aussparen will, die ueber ubDeko gebaut wird, braucht sie im
   Koordinatensystem der Linie - also um den Versatz zurueckgerechnet. */
function ubLoecherLokal(art) {
  return ubahnLoecher(art).map((l) => ({ x0: l.x0, x1: l.x1,
                                         z0: l.z0 - UB_DZ, z1: l.z1 - UB_DZ }));
}

/* ---- Querschnitt (z-Grenzen), fuer Halle und Tunnel gleich ----
   Zwei Gleise, und an JEDEM Gleis ein eigener Bahnsteig - so wie in einer
   echten Station. Vorher gab es nur einen, obwohl zwei Zuege in
   entgegengesetzte Richtungen fuhren; auf der anderen Seite waere niemand
   ausgestiegen. */
const UB_STEIG2_Z0 = 15.5, UB_STEIG2_Z1 = 22.0;  // Bahnsteig Sued (Gleis Richtung +x)
/* Der Trog muss beide Zuege NEBENEINANDER fassen: bei 4,8 m Breite lagen
   die Gleisachsen nur 2,3 m auseinander, die 2,6 m breiten Zuege steckten
   also ineinander. */
const UB_GLEIS_Z0 = 22.0, UB_GLEIS_Z1 = 28.4;    // Gleistrog
const UB_GLEIS_A = UB_GLEIS_Z0 + 1.55;           // Gleis Richtung +x, haelt am Sued-Steig
const UB_GLEIS_B = UB_GLEIS_Z1 - 1.55;           // Gleis Richtung -x, haelt am Nord-Steig
const UB_STEIG_Z0 = 28.4, UB_STEIG_Z1 = 34.5;    // Bahnsteig Nord
const UB_QUER_Z0 = UB_STEIG2_Z0, UB_QUER_Z1 = UB_STEIG_Z1;   // gesamte Roehre
const UB_DECKE = UB_TIEF + 5.0;

/* ---- Treppenschaechte ----
   Einer je Bahnsteig, jeweils im Randstreifen des Gehwegs, wo keine Haeuser
   stehen (noerdlicher Block z 31..35, suedlicher Block z 15..19). Die beiden
   Eingaenge liegen an entgegengesetzten Enden der Station. */
/* ---- Der Abgang ----
   Bisher war das EINE Treppe von der Strasse bis auf den Bahnsteig: 13 m
   Lauf auf 12,25 m Hoehe, also 43 Grad. So steil ist keine Treppe, und
   eine echte Station sieht auch anders aus - man geht eine Treppe hinab,
   steht in einer Schalterhalle und geht von dort die zweite Treppe zum
   Bahnsteig.
   Der Abgang ist deshalb dreigeteilt und laenger:
     obere Treppe   9 m Lauf,  6,15 m Gefaelle  ->  34 Grad
     Zwischenebene  6 m eben
     untere Treppe  9 m Lauf,  6,10 m Gefaelle  ->  34 Grad
   xKopf wandert dafuer von 15 auf 26 m; xFuss bleibt, wo er war. */
const UB_MITTE = -4.2;                    // Hoehe der Zwischenebene
const UB_TR_OBEN = 6.0;                   // Lauf der oberen Treppe (36,6 Grad)
const UB_HALLE_LANG = 4.0;                // Laenge der Zwischenebene
const UB_TR_UNTEN = 6.0;                  // Lauf der unteren Treppe (38,7 Grad)
const UB_ABGANG = UB_TR_OBEN + UB_HALLE_LANG + UB_TR_UNTEN;   // 24
const UB_STUFEN_OBEN = 26, UB_STUFEN_UNTEN = 26;
const UB_SCHAECHTE = [
  { z0: 31.8, z1: 34.4, xFuss: 2.0, xKopf: 18.0, steig: 'nord' },
  { z0: 15.6, z1: 18.2, xFuss: -2.0, xKopf: -18.0, steig: 'sued' },
];
const UB_TREPPE = UB_ABGANG;
const UB_STUFEN = UB_STUFEN_OBEN + UB_STUFEN_UNTEN;

/* ---- B-Ebene ----
   Die Zwischenebene im Schacht war nur ein Treppenabsatz: 2,6 m breit,
   5 m lang, zwei Lampen. Eine echte Station hat dort eine ganze Ebene -
   in Frankfurt die B-Ebene: man kommt die Treppe herunter, steht in
   einer Halle mit Laeden und Fahrkartenautomaten, laeuft darin herum
   und geht erst dann die zweite Treppe zum Bahnsteig.
   Die Halle liegt seitlich NEBEN dem Schacht, und zwar auf der Seite,
   die von der Bahnsteigroehre wegzeigt. Dort ist unter dem Gehweg Platz:
   die Roehre reicht bis z 34,5 (Nord) beziehungsweise 15,5 (Sued), die
   Halle beginnt erst dahinter. Ueberschneidungen mit Roehre, Hallendecke
   oder Aussenwand gibt es deshalb keine.
   In x endet sie 60 cm vor den Schachtenden, damit sie nicht in die
   Aussenwand der Bahnsteighalle laeuft. */
/* Die Halle war 10 x 15 m bei 3 m Hoehe - fuer eine B-Ebene mit Laeden zu
   klein, man stand nach zwei Schritten wieder an der Wand. Jetzt 15 m
   tief, 3,6 m hoch und bis dicht an die Schachtenden. */
const UB_BE_TIEF = 15.0;                  // Tiefe der Halle neben dem Schacht
const UB_BE_HOCH = 3.6;                   // lichte Hoehe
const UB_BE_RAND = 0.3;                   // Abstand zu den Schachtenden
function ubBEbene(sx, sch, dz) {
  const v = dz || 0;
  const weg = sch.steig === 'nord' ? 1 : -1;      // Richtung weg von der Roehre
  return { x0: sx + Math.min(sch.xFuss, sch.xKopf) + UB_BE_RAND,
           x1: sx + Math.max(sch.xFuss, sch.xKopf) - UB_BE_RAND,
           z0: v + (weg > 0 ? sch.z1 : sch.z0 - UB_BE_TIEF),
           z1: v + (weg > 0 ? sch.z1 + UB_BE_TIEF : sch.z0),
           weg };
}
/* Der Durchgang zwischen Schacht und Halle - genau ueber der ebenen
   Zwischenebene, sonst stuende man vor einer Treppe in der Wand. */
function ubDurchgang(sx, sch) {
  const richtung = sch.xKopf > sch.xFuss ? -1 : 1;
  /* Die Oeffnung reicht ueber die ebene Strecke HINAUS, ein Stueck in
     beide Treppenlaeufe hinein. Vorher war es eine 5 m breite Tuer in
     einer sonst geschlossenen Wand: wer die Treppe herunterkam, sah von
     den Laeden nichts, weil er erst um die Ecke treten musste. Jetzt ist
     die Seite zur Halle hin offen, die Halle liegt beim Hinuntergehen
     schon im Blick. */
  const a = sx + sch.xKopf + richtung * (UB_TR_OBEN - 2.6);
  const b = sx + sch.xKopf + richtung * (UB_TR_OBEN + UB_HALLE_LANG + 2.6);
  return { x0: Math.min(a, b), x1: Math.max(a, b) };
}

/* ---- Aufzug ----
   Zu jeder Station gehoert neben der Treppe ein Aufzug, der vom Gehweg
   geradewegs auf den Bahnsteig faehrt - wie in einer echten Station. Er
   steht ein Stueck HINTER dem Treppenfuss, im selben Streifen des
   Gehwegs; dort ist unter der Strasse der Bahnsteig, und Loch und Kabine
   passen ohne Umweg uebereinander.
   Der Schacht bekommt Loecher im Gehweg, in der Hallendecke und im
   Erdblock (siehe ubahnLoecher). */
const AUF_B = 2.4;                        // lichte Weite der Kabine
/* Vier Meter hinter dem Treppenfuss. Bei 1,4 m stand der Aufzug oben wie
   unten direkt an der Treppe - man kam kaum dazwischen. */
const AUF_ABST = 4.0;                     // Abstand hinter dem Treppenfuss
function ubAufzug(sx, sch, dz) {
  const richtung = sch.xKopf > sch.xFuss ? -1 : 1;
  const a = sx + sch.xFuss + richtung * AUF_ABST;
  const b = a + richtung * AUF_B;
  const zM = (sch.z0 + sch.z1) / 2 + (dz || 0);
  return { x0: Math.min(a, b), x1: Math.max(a, b),
           z0: zM - AUF_B / 2, z1: zM + AUF_B / 2,
           /* Seite, auf der man ein- und aussteigt: zum Treppenfuss hin. */
           tuerX: sx + sch.xFuss + richtung * AUF_ABST, richtung };
}

/* Hoehe an einer Stelle des Abgangs. s = Weg vom Treppenmund aus,
   gemessen laengs des Schachts. */
function abgangHoehe(s) {
  if (s <= UB_TR_OBEN) {
    const t = clamp(s / UB_TR_OBEN, 0, 1);
    const stufe = Math.floor(t * UB_STUFEN_OBEN) / UB_STUFEN_OBEN;
    return lerp(SLAB_H, UB_MITTE, stufe);
  }
  if (s <= UB_TR_OBEN + UB_HALLE_LANG) return UB_MITTE;
  const t = clamp((s - UB_TR_OBEN - UB_HALLE_LANG) / UB_TR_UNTEN, 0, 1);
  const stufe = Math.floor(t * UB_STUFEN_UNTEN) / UB_STUFEN_UNTEN;
  return lerp(UB_MITTE, UB_TIEF, stufe);
}

const UB_X0 = UB_STAT_X[0] - UB_HALLE_X / 2;                       // Linienanfang
const UB_X1 = UB_STAT_X[UB_STAT_X.length - 1] + UB_HALLE_X / 2;    // Linienende

/* Alle Schachtoeffnungen der Linie als Rechtecke.
   art:
     'voll'  - der ganze Abgang. Fuer den Haeuserbau: dort darf nichts
               stehen, auch nicht ueber der Zwischenebene.
     'oben'  - nur die obere Treppe. Das ist das Loch im GEHWEG; ueber der
               Zwischenebene und der unteren Treppe liegt eine Decke, dort
               bleibt der Gehweg geschlossen.
     'unten' - nur die untere Treppe. Das ist das Loch in der HALLENDECKE
               der Station. */
function ubahnLoecher(art) {
  const out = [];
  for (const linie of UB_LINIEN) {
  const dz = linie.dz;
  for (const sx of linie.statX) {
    for (const s0 of UB_SCHAECHTE) {
      /* Der Schacht der Linie, also mit ihrem Versatz. */
      const s = { z0: s0.z0 + dz, z1: s0.z1 + dz,
                  xFuss: s0.xFuss, xKopf: s0.xKopf, steig: s0.steig };
      const dir = s.xFuss < s.xKopf ? -1 : 1;
      const kopf = sx + s.xKopf;
      let a, b;
      if (art === 'oben') { a = kopf; b = kopf + dir * (UB_TR_OBEN + 0.6); }
      else if (art === 'unten') { a = kopf + dir * (UB_TR_OBEN - 0.6);
                                  b = sx + s.xFuss; }
      else { a = kopf; b = sx + s.xFuss; }
      out.push({ x0: Math.min(a, b), x1: Math.max(a, b), z0: s.z0, z1: s.z1 });
      /* Der Aufzugsschacht braucht in JEDER Decke dasselbe Loch:
         Gehweg, Hallendecke und Erdblock. */
      {
        const auf = ubAufzug(sx, s0, dz);
        out.push({ x0: auf.x0 - 0.1, x1: auf.x1 + 0.1,
                   z0: auf.z0 - 0.1, z1: auf.z1 + 0.1 });
      }
      /* 'erde' nimmt zusaetzlich die B-Ebene heraus. Der Erdblock zwischen
         Tunneldecke und Strasse reicht 80 cm ueber die Roehre hinaus und
         stand damit als 90 cm dicke, erdbraune Scheibe genau in der
         Oeffnung zur Halle - gemessen ein Brett von 331 m Laenge bei
         z 34,4..35,3. Man stand in der Zwischenebene und sah statt der
         Laeden eine braune Wand. */
      if (art === 'erde') {
        const be = ubBEbene(sx, s0, dz);
        out.push({ x0: be.x0 - 0.5, x1: be.x1 + 0.5, z0: be.z0, z1: be.z1 });
        /* Auch die Schachtwaende aussparen. Sie sind 50 cm dick und
           standen bisher MITTEN im Erdblock: Wandflaeche und Erdflaeche
           lagen auf derselben Ebene (gemessen 61 m2 je Schacht), und
           genau solche Paare flackern beim Zeichnen. */
        out.push({ x0: Math.min(a, b) - 0.75, x1: Math.max(a, b) + 0.75,
                   z0: s.z0 - 0.75, z1: s.z1 + 0.75 });
      }
    }
  }
  }
  return out;
}

/* Eine Rechteckflaeche so zerlegen, dass die angegebenen Loecher frei
   bleiben. Die erste Fassung ging davon aus, dass alle Loecher im selben
   z-Band liegen - mit einem zweiten Eingang je Station stimmt das nicht
   mehr. Jetzt wird jedes Loch der Reihe nach aus den vorhandenen Streifen
   herausgeschnitten. */
function flaecheMitLoechern(x0, x1, z0, z1, loecher) {
  let teile = [{ x0, x1, z0, z1 }];
  for (const l of (loecher || [])) {
    const neu = [];
    for (const t of teile) {
      if (l.x1 <= t.x0 || l.x0 >= t.x1 || l.z1 <= t.z0 || l.z0 >= t.z1) { neu.push(t); continue; }
      const lx0 = Math.max(t.x0, l.x0), lx1 = Math.min(t.x1, l.x1);
      const lz0 = Math.max(t.z0, l.z0), lz1 = Math.min(t.z1, l.z1);
      if (lz0 > t.z0) neu.push({ x0: t.x0, x1: t.x1, z0: t.z0, z1: lz0 });
      if (lz1 < t.z1) neu.push({ x0: t.x0, x1: t.x1, z0: lz1, z1: t.z1 });
      if (lx0 > t.x0) neu.push({ x0: t.x0, x1: lx0, z0: lz0, z1: lz1 });
      if (lx1 < t.x1) neu.push({ x0: lx1, x1: t.x1, z0: lz0, z1: lz1 });
    }
    teile = neu;
  }
  return teile.filter((t) => t.x1 - t.x0 > 0.05 && t.z1 - t.z0 > 0.05)
              .map((t) => ({ x: (t.x0 + t.x1) / 2, z: (t.z0 + t.z1) / 2,
                             w: t.x1 - t.x0, d: t.z1 - t.z0 }));
}

/* Hat dieser Block einen U-Bahn-Eingang? Dann bekommt der Gehwegsockel ein
   Loch - sonst sieht man von oben nur eine geschlossene Flaeche. */
function ubahnLoecherFuerBlock(cx, cz) {
  const halb = (PITCH - ROAD_HALF * 2) / 2;
  return ubahnLoecher().filter((l) =>
    l.x1 > cx - halb && l.x0 < cx + halb && l.z1 > cz - halb && l.z0 < cz + halb);
}

/* Boden im fahrenden Wagen. Wird von groundY zuerst gefragt, damit man im
   Zug auf dem Wagenboden steht und nicht durch ihn hindurch im Gleisbett.
   ZUEGE entsteht spaeter im Ablauf, deshalb die Existenzpruefung. */
function zugBoden(x, z, yRef) {
  if (typeof ZUEGE === 'undefined' || !ZUEGE.length) return null;
  if (yRef === undefined || yRef > UB_TIEF + 3.0 || yRef < UB_TIEF - 1.4) return null;
  for (const t of ZUEGE) {
    if (Math.abs(x - t.x) < ZUG_LANG / 2 - 0.3 &&
        Math.abs(z - t.z) < ZUG_BREIT / 2 - 0.15) return UB_TIEF;
  }
  return null;
}

/* Bodenhoehe im Schacht, in der Halle oder im Tunnel - sonst null.
   yRef ist die Hoehe dessen, der fragt. Ohne diese Angabe zaehlt die
   Oberflaeche: sonst faellt jeder, der ueber der Station auf der Strasse
   steht, durch die Fahrbahn in den Bahnsteig. Genau das ist passiert. */
function ubahnBoden(x, z, yRef) {
  if (!UBAHNEN.length) return null;
  /* Jede Station kennt den Versatz IHRER Linie. Statt fester z-Grenzen
     wird deshalb die Frage in das Koordinatensystem der jeweiligen Linie
     umgerechnet: zz = z - dz. */
  /* Die Treppenschaechte sind nach oben offen und gelten immer. */
  for (const u of UBAHNEN) {
    const zz = z - u.dz;
    for (const s of UB_SCHAECHTE) {
      if (zz <= s.z0 || zz >= s.z1) continue;
      const a = u.x + Math.min(s.xFuss, s.xKopf), b = u.x + Math.max(s.xFuss, s.xKopf);
      if (x <= a || x >= b) continue;
      /* In Stufen statt als Rampe - man soll Tritte sehen und spueren.
         Dazwischen liegt die ebene Zwischenebene. */
      return abgangHoehe(Math.abs(u.x + s.xKopf - x));
    }
  }
  /* Der Aufzugsschacht ist ebenso nach oben offen. Sein Boden liegt auf
     Bahnsteighoehe - wer hineintritt, waehrend die Kabine oben ist,
     faellt bis nach unten. Auf der Kabine selbst steht man ueber
     collidePlayerAufzug, das laeuft nach dieser Abfrage. */
  for (const u of UBAHNEN) {
    for (const s of UB_SCHAECHTE) {
      const a2 = ubAufzug(u.x, s, u.dz);
      if (x > a2.x0 && x < a2.x1 && z > a2.z0 && z < a2.z1) return UB_TIEF;
    }
  }
  /* Halle und Tunnel liegen unter der Fahrbahn. Nur wer schon unten ist,
     steht darauf. Die Grenze liegt deutlich unter der Strasse (Fahrbahn 0,
     Gehweg 0,25) und weit ueber der Hallendecke bei UB_DECKE. */
  if (yRef === undefined || yRef > -1.5) return null;
  /* B-Ebene: die Halle neben dem Schacht. */
  for (const u of UBAHNEN) {
    for (const s of UB_SCHAECHTE) {
      const r = ubBEbene(u.x, s, u.dz);
      if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return UB_MITTE;
    }
  }
  for (const l of UB_LINIEN) {
    if (x < l.x0 || x > l.x1) continue;
    const zz = z - l.dz;
    if (zz > UB_STEIG_Z0 && zz < UB_STEIG_Z1) return UB_TIEF;
    if (zz > UB_STEIG2_Z0 && zz < UB_STEIG2_Z1) return UB_TIEF;
    if (zz > UB_GLEIS_Z0 && zz < UB_GLEIS_Z1) return UB_GLEIS_TIEF;
  }
  return null;
}

function groundY(x, z, yRef) {
  /* Hochparterre: in diesen Haeusern liegt der Fussboden ueber dem Gehweg. */
  if (x > KIT_BOX.x0 && x < KIT_BOX.x1 && z > KIT_BOX.z0 && z < KIT_BOX.z1) {
  for (const st of KIT_STUFEN) {
    if (x > st.x0 && x < st.x1 && z > st.z0 && z < st.z1) return st.y;
  }
  for (const r of KIT_HOCH) {
    if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 &&
        (yRef === undefined || yRef < r.decke)) return r.boden;
  }
  }
  /* Im Wagen steht man auf dem Zugboden, nicht im Schotter. */
  const zb = zugBoden(x, z, yRef);
  if (zb !== null) return zb;
  const ub = ubahnBoden(x, z, yRef);
  if (ub !== null) return ub;
  /* Uferpromenade: durchgehend Gehweghoehe, kein Strassenraster. */
  if (x >= PROM_X0 && x <= RIVER_X0 && Math.abs(z) < 198 && !onBridge(x, z)) return SLAB_H;
  if (x >= SHORE_X1 || x <= -195 || Math.abs(z) >= 195) return 0;
  if (onBridge(x, z)) return bridgeY(x);
  if (x > RIVER_X0) {
    if (x < SHORE_X0) return WATER_Y;
    /* Auch drüben gibt es Gehwege – sonst steckten die Füße im Sockel. */
    const bi = Math.floor((x - SHORE_OX) / SHORE_PITCH);
    const bj = Math.floor((z - SHORE_OZ) / SHORE_PITCH);
    if (bi < 0 || bi >= SHORE_NX || bj < 0 || bj >= SHORE_NZ) return 0;
    const cx = SHORE_OX + bi * SHORE_PITCH + SHORE_PITCH / 2;
    const cz = SHORE_OZ + bj * SHORE_PITCH + SHORE_PITCH / 2;
    if (!uferBlockFrei(cx, cz)) return 0;
    const u = x - (cx - SHORE_PITCH / 2), v = z - (cz - SHORE_PITCH / 2);
    if (u > SHORE_ROAD && u < SHORE_PITCH - SHORE_ROAD &&
        v > SHORE_ROAD && v < SHORE_PITCH - SHORE_ROAD) return SLAB_H;
    return 0;
  }
  const GRID_END = ORIGIN + BLOCKS * PITCH;
  if (x < ORIGIN || x > GRID_END || z < ORIGIN || z > GRID_END) return 0;
  // Stadtraster: Gehweg-/Blocksockel
  const u = ((x - ORIGIN) % PITCH + PITCH) % PITCH;
  const v = ((z - ORIGIN) % PITCH + PITCH) % PITCH;
  if (u > ROAD_HALF && u < PITCH - ROAD_HALF && v > ROAD_HALF && v < PITCH - ROAD_HALF) return SLAB_H;
  return 0;
}

const cityGroup = new THREE.Group();
scene.add(cityGroup);

/* ---------- Stadt-Details ----------
   Gesimse, Ladenzeilen, Feuerleitern, Dachaufbauten: Das sind pro Haus
   schnell zwanzig Kisten – bei über hundert Häusern wären das tausende
   einzelne Objekte und damit tausende Zeichenaufrufe pro Bild.
   Deshalb werden alle Details gesammelt und am Ende zu EINER Geometrie
   verschmolzen. Die Farbe steckt dann in den Eckpunkten. */
const dekoTeile = [];
/* Nur fuers Messen: eine Kopie aller gesetzten Kisten. */
const DEKO_KOPIE = [];
/* rz kippt die Kiste um die Z-Achse - gebraucht fuer schraege Teile wie
   einen Treppenhandlauf. Ohne das musste ein Gefaelle als Kistenhoehe
   nachgebildet werden, und aus dem Handlauf wurde eine mannshohe Platte. */
function deko(w, h, d, x, y, z, farbe, ry, rz) {
  const t = { w, h, d, x, y, z, farbe, ry: ry || 0, rz: rz || 0 };
  dekoTeile.push(t); DEKO_KOPIE.push(t);
}

/* Eine Liste von Kisten {w,h,d,x,y,z,farbe,ry} zu EINER Geometrie
   verschmelzen. Die Farbe steckt danach in den Eckpunkten, deshalb reicht
   ein einziges Material und ein einziger Zeichenaufruf. */
function verschmelzeBoxen(teile) {
  const basis = new THREE.BoxGeometry(1, 1, 1);
  const bp = basis.attributes.position, bn = basis.attributes.normal, bi = basis.index;
  const anzahl = teile.length;
  const positionen = new Float32Array(anzahl * bp.count * 3);
  const normalen = new Float32Array(anzahl * bp.count * 3);
  const farben = new Float32Array(anzahl * bp.count * 3);
  const indizes = new Uint32Array(anzahl * bi.count);
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3();
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
  const skal = new THREE.Vector3(), eul = new THREE.Euler();
  const v = new THREE.Vector3(), farbe = new THREE.Color();
  let vo = 0, io = 0;
  for (const t of teile) {
    eul.set(0, t.ry || 0, t.rz || 0);
    m.compose(pos.set(t.x, t.y, t.z), quat.setFromEuler(eul), skal.set(t.w, t.h, t.d));
    nm.getNormalMatrix(m);
    farbe.set(t.farbe);
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i).applyMatrix4(m);
      positionen[(vo + i) * 3] = v.x; positionen[(vo + i) * 3 + 1] = v.y; positionen[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(bn, i).applyMatrix3(nm).normalize();
      normalen[(vo + i) * 3] = v.x; normalen[(vo + i) * 3 + 1] = v.y; normalen[(vo + i) * 3 + 2] = v.z;
      farben[(vo + i) * 3] = farbe.r; farben[(vo + i) * 3 + 1] = farbe.g; farben[(vo + i) * 3 + 2] = farbe.b;
    }
    for (let i = 0; i < bi.count; i++) indizes[io + i] = bi.getX(i) + vo;
    vo += bp.count; io += bi.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positionen, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normalen, 3));
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  g.setIndex(new THREE.BufferAttribute(indizes, 1));
  g.computeBoundingSphere();
  return g;
}

/* Farbpaletten fuer Menschen. Stehen hier oben, weil schon die Stadt beim
   Aufbau sitzende Figuren in Zuege und Fahrzeuge setzt. */
const SKINS = ['#e8b48c', '#d29b6e', '#a86e4b', '#7c4f33', '#f0c9a0'];
const SHIRTS = ['#c0554e', '#4d7dc4', '#58a15c', '#c9a23f', '#8e5fae', '#d97c33', '#4ea9a5', '#c45a8c', '#e6e2d8'];
const PANTS = ['#2f3b52', '#4a4a4a', '#5b4632', '#31543c', '#233042', '#6b6560'];
const HAIRS = ['#2a2119', '#4d3521', '#7a5a35', '#1b1b1e', '#8a8a8a', '#b06c34'];

/* Beliebige Teile zu EINER Geometrie verschmelzen. Anders als
   verschmelzeBoxen darf jedes Teil eine eigene Grundform haben - so lassen
   sich Kisten, Zylinder und Kugeln mischen und trotzdem in einem einzigen
   Zeichenaufruf darstellen. Teil: { geo, x,y,z, rx,ry,rz, sx,sy,sz, farbe } */
function verschmelzeTeile(teile) {
  const roh = teile.map((t) => {
    const g = t.geo.index ? t.geo.toNonIndexed() : t.geo;
    return { t, g, n: g.attributes.position.count };
  });
  const gesamt = roh.reduce((a, r) => a + r.n, 0);
  const positionen = new Float32Array(gesamt * 3);
  const normalen = new Float32Array(gesamt * 3);
  const farben = new Float32Array(gesamt * 3);
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3();
  const eul = new THREE.Euler(), q = new THREE.Quaternion();
  const pos = new THREE.Vector3(), skal = new THREE.Vector3();
  const v = new THREE.Vector3(), farbe = new THREE.Color();
  let o = 0;
  for (const { t, g, n } of roh) {
    eul.set(t.rx || 0, t.ry || 0, t.rz || 0);
    m.compose(pos.set(t.x || 0, t.y || 0, t.z || 0), q.setFromEuler(eul),
              skal.set(t.sx === undefined ? 1 : t.sx,
                       t.sy === undefined ? 1 : t.sy,
                       t.sz === undefined ? 1 : t.sz));
    nm.getNormalMatrix(m);
    farbe.set(t.farbe);
    const bp = g.attributes.position, bn = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(bp, i).applyMatrix4(m);
      positionen[(o + i) * 3] = v.x; positionen[(o + i) * 3 + 1] = v.y; positionen[(o + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(bn, i).applyMatrix3(nm).normalize();
      normalen[(o + i) * 3] = v.x; normalen[(o + i) * 3 + 1] = v.y; normalen[(o + i) * 3 + 2] = v.z;
      farben[(o + i) * 3] = farbe.r; farben[(o + i) * 3 + 1] = farbe.g; farben[(o + i) * 3 + 2] = farbe.b;
    }
    o += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positionen, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normalen, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  geo.computeBoundingSphere();
  return geo;
}

/* ---- Sitzender Mensch ----
   Bisher sassen in Autos, Bussen und Zuegen zwei Kisten: eine fuer die
   Schultern, eine fuer den Kopf. Das sah aus wie Fracht, nicht wie
   Fahrgaeste. Hier entsteht eine richtige Figur - Kopf, Haare, Rumpf, Arme,
   Ober- und Unterschenkel, Schuhe - in denselben Farben wie die Zivilisten
   auf der Strasse. Rueckgabe sind Teile fuer verschmelzeTeile, damit ein
   ganzer Wagen voller Leute trotzdem ein einziger Zeichenaufruf bleibt.
   Blickrichtung +Z, Ursprung auf der Sitzflaeche. */
const _sitzGeo = {};
function sitzForm(art, a, b, c) {
  const key = art + a + '_' + b + '_' + c;
  if (_sitzGeo[key]) return _sitzGeo[key];
  const g = art === 'box' ? new THREE.BoxGeometry(a, b, c)
          : art === 'zyl' ? new THREE.CylinderGeometry(a, b, c, 7)
                          : new THREE.SphereGeometry(a, 9, 7);
  _sitzGeo[key] = g;
  return g;
}
function sitzMensch(x, y, z, ry, groesse, seed) {
  const g = groesse === undefined ? 1 : groesse;
  const haut = pick(SKINS), hemd = pick(SHIRTS), hose = pick(PANTS), haar = pick(HAIRS);
  const teile = [];
  const cos = Math.cos(ry || 0), sin = Math.sin(ry || 0);
  const setze = (geo, lx, ly, lz, farbe, rx) => {
    teile.push({ geo, farbe, rx: rx || 0, ry: ry || 0,
                 x: x + (lx * cos + lz * sin) * g,
                 y: y + ly * g,
                 z: z + (-lx * sin + lz * cos) * g,
                 sx: g, sy: g, sz: g });
  };
  /* Becken und Rumpf */
  setze(sitzForm('box', 0.34, 0.20, 0.28), 0, 0.10, -0.02, hose);
  setze(sitzForm('box', 0.42, 0.50, 0.26), 0, 0.45, -0.04, hemd);
  /* Hals, Kopf, Haare. Der Kopf ist leicht abgeflacht und bekommt ein
     dunkles Band auf Augenhoehe - eine glatte Kugel las sich als Ball. */
  setze(sitzForm('zyl', 0.055, 0.055, 0.09), 0, 0.74, -0.02, haut);
  setze(sitzForm('kugel', 0.145, 0, 0), 0, 0.88, 0, haut);
  setze(sitzForm('box', 0.20, 0.045, 0.10), 0, 0.885, 0.10, 0x2a2118);   // Augenpartie
  setze(sitzForm('kugel', 0.152, 0, 0), 0, 0.925, -0.02, haar);
  /* Schultern rund statt eckig. */
  for (const s2 of [-1, 1]) setze(sitzForm('kugel', 0.075, 0, 0), s2 * 0.20, 0.63, -0.03, hemd);
  /* Arme: Oberarm haengt, Unterarm liegt auf dem Schoss, dazu eine Hand */
  for (const s2 of [-1, 1]) {
    setze(sitzForm('zyl', 0.055, 0.05, 0.30), s2 * 0.245, 0.50, -0.03, hemd);
    setze(sitzForm('zyl', 0.05, 0.045, 0.28), s2 * 0.235, 0.30, 0.10, haut, Math.PI / 2.2);
    setze(sitzForm('kugel', 0.055, 0, 0), s2 * 0.235, 0.29, 0.245, haut);
  }
  /* Beine: Oberschenkel waagerecht, Unterschenkel senkrecht */
  for (const s2 of [-1, 1]) {
    setze(sitzForm('zyl', 0.085, 0.075, 0.44), s2 * 0.115, 0.06, 0.19, hose, Math.PI / 2);
    setze(sitzForm('zyl', 0.07, 0.055, 0.42), s2 * 0.115, -0.19, 0.38, hose);
    setze(sitzForm('box', 0.11, 0.09, 0.25), s2 * 0.115, -0.42, 0.44, 0x26262a);
  }
  return teile;
}

function baueDekoMesh() {
  if (!dekoTeile.length) return;
  const mesh = new THREE.Mesh(verschmelzeBoxen(dekoTeile),
                              new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  cityGroup.add(mesh);
  dekoTeile.length = 0;
}

/* Gesims, Feuerleiter und Dachaufbauten für ein Haus. */
/* frei = Grundflaeche des Staffelturms, der spaeter aus diesem Dach
   waechst (oder null). Alles, was aufs Dach kommt, muss aussen herum. */
function schmueckeHaus(w, h, d, x, z, frei) {
  const unten = SLAB_H, oben = SLAB_H + h;

  /* ---- Kein selbstgebautes Erdgeschoss mehr ----
     Sockel, Namensband, Markise, Ladenschilder, Tueren und Schaufenster
     sind weg. Sie stammen aus der Zeit, als die Haeuser einfache Quader
     mit einer aufgemalten Fassade waren. Die echten Gebaeudemodelle
     bringen ihr eigenes Erdgeschoss mit; das selbstgebaute lag als bunter
     Streifen davor und passte weder zur Farbe noch zur Fensterteilung.
     Nebenbei fallen damit rund sechshundert Tuerrahmen, ebenso viele
     Tueren und zwoelfhundert Schaufenster aus der Stadt - das ist auch
     fuer die Bildrate keine schlechte Nachricht. */

  /* Gesims am Dachrand – gibt dem Haus oben einen Abschluss. Es steht
     45 cm über die Wand hinaus; ohne Kollision stand man mit den Beinen
     mitten darin. */
  deko(w + 0.9, 0.55, d + 0.9, x, oben - 0.28, z, 0x8b9099);
  addCollider({ x0: x - (w + 0.9) / 2, x1: x + (w + 0.9) / 2,
                z0: z - (d + 0.9) / 2, z1: z + (d + 0.9) / 2,
                h: oben, y0: oben - 0.9, klein: true });
  deko(w + 0.5, 0.7, d + 0.5, x, oben - 1.1, z, 0x6f757e);

  /* ---- Keine Feuerleitern mehr ----
     Die Balkone hingen als dunkle Blechkaesten vor den echten
     Gebaeudemodellen und passten weder zur Fassade noch zum Massstab.
     Ausserdem standen ihre Podeste bis zu anderthalb Meter VOR der Wand:
     beim Wandlauf lief man in sie hinein, statt an der Fassade
     hochzurennen. Beides ist damit erledigt. */

  /* Dachaufbauten: Lüftungskästen, Rohre, Antenne, manchmal Reklame. */
  const anzahl = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < anzahl; i++) {
    const kw = rand(1.2, 2.6), kh = rand(0.7, 1.8), kd = rand(1.2, 2.6);
    deko(kw, kh, kd, x + rand(-w / 2 + 1.5, w / 2 - 1.5), oben + kh / 2,
         z + rand(-d / 2 + 1.5, d / 2 - 1.5), pick([0x767c85, 0x646a72, 0x878d96]));
  }
  for (let i = 0; i < 2; i++) {
    deko(0.35, rand(1.2, 2.4), 0.35, x + rand(-w / 3, w / 3), oben + 1.0,
         z + rand(-d / 3, d / 3), 0x555b63);
  }
  /* Freien Platz auf dem Dach suchen: nicht unter dem Staffelturm. */
  const dachFrei = (px, pz, halbW, halbD) => !frei ||
    Math.abs(px - x) > frei.w / 2 + halbW || Math.abs(pz - z) > frei.d / 2 + halbD;
  if (Math.random() < 0.45) {                       // Antennenmast
    const ah = rand(4, 9);
    const ax = x + rand(-w / 4, w / 4), az = z + rand(-d / 4, d / 4);
    if (dachFrei(ax, az, 0.3, 0.3)) deko(0.22, ah, 0.22, ax, oben + ah / 2, az, 0x484d55);
  }
  /* Die Reklametafeln auf den Daechern sind weg - sie waren einfarbige
     Platten ohne Aufschrift und standen zwischen den echten Gebaeude-
     modellen wie ein Fremdkoerper. */
}

function buildCity() {
  /* Boden (Asphalt) – Stadtseite.
     Nicht als eine geschlossene Platte: ueber jedem U-Bahn-Schacht bleibt
     ein Loch. Vorher war der Gehwegsockel zwar ausgespart, darunter lag
     aber weiterhin diese 400x400-Platte - von oben sah man deshalb Asphalt
     statt der Treppe. */
  const bodenMat = new THREE.MeshLambertMaterial({ map: asphaltTex });
  {
    /* Alle Streifen in EINE Geometrie. Einzeln gezeichnet waren es mit acht
       Schachtloechern rund zwanzig Zeichenaufrufe, und weil jede Platte ihre
       UV von 0 bis 1 hat, war die Asphaltkachelung je nach Streifengroesse
       unterschiedlich fein. Die UV werden deshalb aus den Weltkoordinaten
       gerechnet. */
    /* Nur die OBERE Treppe durchbricht den Gehweg - ueber der
       Zwischenebene und der unteren Treppe liegt eine Decke. */
    const teile = flaecheMitLoechern(-207, 193, -200, 200, ubahnLoecher('oben'));
    const pos = new Float32Array(teile.length * 18);
    const nor = new Float32Array(teile.length * 18);
    const uv = new Float32Array(teile.length * 12);
    const KACHEL = 400 / 60;                       // wie beim alten 400er Boden
    let o = 0;
    for (const t of teile) {
      const x0 = t.x - t.w / 2, x1 = t.x + t.w / 2;
      const z0 = t.z - t.d / 2, z1 = t.z + t.d / 2;
      /* Reihenfolge gegen den Uhrzeigersinn VON OBEN gesehen. Vorher war
         sie herum: die Normalen im Attribut zeigten zwar nach oben (das
         Licht stimmte), die Dreiecke selbst aber nach unten. Damit wurde
         die ganze Fahrbahn von oben weggeschnitten - man sah durch die
         Strasse hindurch, Markierungen und Autos schwebten, und die Fuesse
         steckten scheinbar im Boden. */
      const ecken = [[x0, z0], [x1, z1], [x1, z0], [x0, z0], [x0, z1], [x1, z1]];
      for (let i = 0; i < 6; i++) {
        const [px, pz] = ecken[i];
        pos[(o + i) * 3] = px; pos[(o + i) * 3 + 1] = 0; pos[(o + i) * 3 + 2] = pz;
        nor[(o + i) * 3] = 0; nor[(o + i) * 3 + 1] = 1; nor[(o + i) * 3 + 2] = 0;
        uv[(o + i) * 2] = px / KACHEL; uv[(o + i) * 2 + 1] = -pz / KACHEL;
      }
      o += 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    const boden = new THREE.Mesh(geo, bodenMat);
    boden.receiveShadow = true;
    cityGroup.add(boden);
  }
  asphaltTex.repeat.set(1, 1);
  strassenMat = bodenMat;

  /* Fahrbahnmarkierungen. Sie gehen ins gemeinsame Sammel-Mesh: einzeln
     gezeichnet waren das über 500 Zeichenaufrufe allein für die Striche –
     der mit Abstand größte Posten der ganzen Stadt. */
  const nearCrossing = (s) => {
    const u = ((s - ORIGIN) % PITCH + PITCH) % PITCH;
    return u < ROAD_HALF + 3 || u > PITCH - ROAD_HALF - 3;
  };
  for (let i = 0; i <= BLOCKS; i++) {
    const L = ORIGIN + i * PITCH;
    for (let s = -186; s < 186; s += 10) {
      if (nearCrossing(s)) continue;
      deko(0.35, 0.04, 4, L, 0.02, s, 0xd9c979);
      deko(4, 0.04, 0.35, s, 0.02, L, 0xd9c979);
    }
  }

  /* Zebrastreifen an jeder Kreuzung – vorher hörten die Fahrbahnlinien
     einfach auf und die Kreuzungen waren leere graue Flächen. */
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j <= BLOCKS; j++) {
      const cx = ORIGIN + i * PITCH, cz = ORIGIN + j * PITCH;
      for (const seite of [-1, 1]) {
        /* Streifen quer zur x-Straße (nördlich und südlich der Kreuzung) */
        for (let k = -5; k <= 5; k++) {
          deko(0.55, 0.03, 4.2, cx + k * 1.05, 0.025, cz + seite * (ROAD_HALF + 2.4), 0xe8e8e0);
          deko(4.2, 0.03, 0.55, cx + seite * (ROAD_HALF + 2.4), 0.025, cz + k * 1.05, 0xe8e8e0);
        }
      }
    }
  }

  // Blöcke: Gehwegsockel + Gebäude
  const sockelStreifen = [];
  /* Ein Blocksockel, zerlegt in Streifen, damit ein rechteckiges Loch
     ausgespart bleibt (Treppenschacht der U-Bahn). Ohne Loch bleibt es bei
     einer einzigen Platte. */
  function sockelTeile(cx, cz, size, loecher) {
    return flaecheMitLoechern(cx - size / 2, cx + size / 2,
                              cz - size / 2, cz + size / 2, loecher);
  }
  const slabMat = new THREE.MeshLambertMaterial({ map: sidewalkTex });
  for (let bi = 0; bi < BLOCKS; bi++) {
    for (let bj = 0; bj < BLOCKS; bj++) {
      const cx = ORIGIN + bi * PITCH + PITCH / 2;
      const cz = ORIGIN + bj * PITCH + PITCH / 2;
      const size = PITCH - ROAD_HALF * 2; // 38
      /* Liegt hier ein U-Bahn-Eingang, bekommt der Sockel ein echtes Loch.
         Vorher lag der Gehweg als geschlossene Platte über dem Treppen-
         schacht: die Kollision kannte die Treppe, das Auge sah nur Boden. */
      const loecher = ubahnLoecherFuerBlock(cx, cz);
      /* Die Streifen wandern in eine gemeinsame Sammlung: mit acht
         Schachtloechern waeren es sonst rund vierzig eigene Platten. */
      for (const t of sockelTeile(cx, cz, size, loecher)) sockelStreifen.push(t);
      /* Zwei Blöcke werden zum Park statt zur Baustelle – die Stadt war
         bisher lückenlos zugebaut. */
      /* Kein Park auf einem Block mit U-Bahn-Eingang: der Rasen liegt als
         geschlossene Flaeche ueber dem Treppenloch. */
      if (!loecher.length && ((bi === 2 && bj === 2) || (bi === 5 && bj === 1))) bauePark(cx, cz, size);
      else if (!loecher.length && KIT_BLOCKS.some(([a3, b3]) => a3 === bi && b3 === bj)) {
        baueAltbauBlock(cx, cz, size);
      } else buildBlockBuildings(cx, cz, loecher);
      // Straßenlampen an jeder zweiten Ecke
      if ((bi + bj) % 2 === 0) addLamp(cx - size / 2 + 1, cz - size / 2 + 1);
      /* Poller und Pflanzkuebel am Bordstein. Sie stehen genau dort, wo
         man laeuft und kaempft, und geben dem Gehweg Massstab. */
      for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px0 = cx + ex * (size / 2 - 1.0), pz0 = cz + ez * (size / 2 - 1.0);
        if (loecher.some((l) => px0 > l.x0 - 2.5 && px0 < l.x1 + 2.5 &&
                                pz0 > l.z0 - 2.5 && pz0 < l.z1 + 2.5)) continue;
        if ((bi * 3 + bj + ex + ez) % 3 === 0) {
          merkeTeil('Prop_Planter_Single', px0 - ex * 0.6, SLAB_H, pz0 - ez * 0.6, 0, 0.8);
        } else {
          for (let k = -1; k <= 1; k++) {
            merkeTeil('Prop_Bollard', px0 + (ex ? 0 : k * 1.6), SLAB_H,
                      pz0 + (ex ? k * 1.6 : 0), 0);
          }
        }
      }
      /* Die Station gehoert zum noerdlichen Block; der suedliche bekommt
         nur das Loch fuer den zweiten Eingang. Das gilt fuer jede Linie
         auf ihrer eigenen Strasse. */
      for (const linie of UB_LINIEN) {
        if (Math.abs(cz - (50 + linie.dz)) > 1) continue;
        for (const sx of linie.statX) {
          if (Math.abs(sx - cx) > 1) continue;
          UB_DZ = linie.dz;
          baueUBahn(sx);
          UB_DZ = 0;
        }
      }
    }
  }

  /* Gullis auswählen und ihre Deckel setzen – der Dampf selbst entsteht
     später, wenn alle Hilfsmittel geladen sind. */
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j <= BLOCKS; j++) {
      if ((i * 5 + j) % 4 !== 0) continue;
      const gx = ORIGIN + i * PITCH + rand(-2.5, 2.5);
      const gz = ORIGIN + j * PITCH + rand(-2.5, 2.5);
      DAMPF_STELLEN.push({ x: gx, z: gz, y: 0 });
      /* Echter Gullideckel aus dem Baukasten statt einer flachen Platte. */
      merkeTeil('Prop_ManholeCover', gx, 0.015, gz, rand(0, TAU));
    }
  }

  /* Alle Gehwegsockel als EIN Mesh, mit Kachelung nach Weltkoordinaten -
     sonst haette jeder Streifen seine eigene Kachelgroesse. */
  {
    const teile = sockelStreifen.map((t) => ({
      geo: new THREE.BoxGeometry(t.w, SLAB_H * 2, t.d),
      x: t.x, y: 0, z: t.z, farbe: 0xffffff,
    }));
    if (teile.length) {
      const geo = verschmelzeTeile(teile);
      /* UV aus der Weltlage: gleiche Kachelung ueber alle Streifen. */
      const p = geo.attributes.position;
      const uv = new Float32Array(p.count * 2);
      const KACHEL = 4.0;
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = p.getX(i) / KACHEL;
        uv[i * 2 + 1] = -p.getZ(i) / KACHEL;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: sidewalkTex }));
      mesh.receiveShadow = true;
      cityGroup.add(mesh);
    }
  }

  /* Die Tunnel entstehen erst, wenn alle Stationen stehen - je Linie
     einer. */
  if (UBAHNEN.length) {
    for (const linie of UB_LINIEN) {
      UB_DZ = linie.dz;
      baueUBahnLinie(linie);
      UB_DZ = 0;
    }
  }

  buildRiverAndBridge();
  buildFarShore();
  baueAmpeln();
  baueHausMeshes();
  baueWassertuerme();
  baueDekoMesh();
  baueUBahnMesh();
  baueZuege();
}

/* ---- Park ----
   Rasen, ein Wegkreuz, Bäume, Bänke und ein Brunnen. Alles bis auf die
   Baumkronen geht ins gemeinsame Deko-Mesh. */
const parks = [];
function bauePark(cx, cz, size) {
  const halb = size / 2;
  parks.push({ x: cx, z: cz, s: size });
  /* Rasen und Wege liegen BÜNDIG mit dem Gehweg. Vorher standen sie 6 cm
     darüber und die Füße steckten sichtbar im Gras. */
  const rasen = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ map: rasenTex }));
  rasen.rotation.x = -Math.PI / 2;
  rasen.position.set(cx, SLAB_H + 0.006, cz);
  rasen.receiveShadow = true;
  cityGroup.add(rasen);

  const wegMat = new THREE.MeshLambertMaterial({ map: wegTex });
  for (const [ww, dd] of [[size, 3.2], [3.2, size]]) {
    const weg = new THREE.Mesh(new THREE.PlaneGeometry(ww, dd), wegMat);
    weg.rotation.x = -Math.PI / 2;
    weg.position.set(cx, SLAB_H + 0.012, cz);
    weg.receiveShadow = true;
    cityGroup.add(weg);
  }

  /* Grasbüschel: kleine Kegel, die den flachen Boden aufbrechen. */
  const buschMat = new THREE.MeshLambertMaterial({ color: 0x1c3517 });
  const buschGeo = new THREE.ConeGeometry(0.3, 0.34, 6);
  const buschAnz = 60;
  const buschel = new THREE.InstancedMesh(buschGeo, buschMat, buschAnz);
  const bm = new THREE.Matrix4(), bq = new THREE.Quaternion();
  const bp = new THREE.Vector3(), bs = new THREE.Vector3(), be = new THREE.Euler();
  let gesetztB = 0;
  for (let i = 0; i < buschAnz * 3 && gesetztB < buschAnz; i++) {
    const bx = cx + rand(-halb + 1, halb - 1), bz = cz + rand(-halb + 1, halb - 1);
    if (Math.abs(bx - cx) < 2.2 || Math.abs(bz - cz) < 2.2) continue;   // nicht auf den Weg
    if (Math.hypot(bx - cx, bz - cz) < 4.2) continue;                    // nicht in den Brunnen
    be.set(0, rand(0, TAU), 0);
    const gr = rand(0.5, 1.05);
    bm.compose(bp.set(bx, SLAB_H + 0.15 * gr, bz), bq.setFromEuler(be),
               bs.set(gr * rand(0.8, 1.3), gr, gr * rand(0.8, 1.3)));
    buschel.setMatrixAt(gesetztB++, bm);
  }
  buschel.count = gesetztB;
  buschel.instanceMatrix.needsUpdate = true;
  buschel.castShadow = true;
  cityGroup.add(buschel);

  /* Brunnen in der Mitte. */
  const becken = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.7, 20),
    new THREE.MeshLambertMaterial({ color: 0x9aa2ad }));
  becken.position.set(cx, SLAB_H + 0.35, cz);
  becken.receiveShadow = true; cityGroup.add(becken);
  const wasser = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.1, 20),
    new THREE.MeshLambertMaterial({ color: 0x3d86b8 }));
  wasser.position.set(cx, SLAB_H + 0.68, cz);
  cityGroup.add(wasser);
  deko(0.5, 1.8, 0.5, cx, SLAB_H + 1.3, cz, 0x9aa2ad);
  addCollider({ x0: cx - 3.4, x1: cx + 3.4, z0: cz - 3.4, z1: cz + 3.4,
                h: SLAB_H + 0.7, klein: true });

  /* Bäume am Rand. */
  const kroneMat = new THREE.MeshLambertMaterial({ color: 0x2f6b38 });
  for (let i = 0; i < 12; i++) {
    const w = (i / 12) * TAU + 0.3;
    const r = halb - rand(3, 7);
    const bx = cx + Math.cos(w) * r, bz = cz + Math.sin(w) * r;
    if (Math.abs(bx - cx) < 2.4 || Math.abs(bz - cz) < 2.4) continue;
    deko(0.5, 3.4, 0.5, bx, SLAB_H + 1.7, bz, 0x5a4028);
    const krone = new THREE.Mesh(new THREE.SphereGeometry(rand(1.8, 2.6), 7, 6), kroneMat);
    krone.position.set(bx, SLAB_H + rand(4.0, 4.8), bz);
    krone.castShadow = true;
    cityGroup.add(krone);
    addCollider({ x0: bx - 0.4, x1: bx + 0.4, z0: bz - 0.4, z1: bz + 0.4,
                  h: SLAB_H + 3.4, klein: true });
  }

  /* Bänke entlang der Wege. */
  for (const [bx, bz, laengs] of [[cx - 7, cz + 2.4, false], [cx + 7, cz + 2.4, false],
                                  [cx + 2.4, cz - 7, true], [cx + 2.4, cz + 7, true]]) {
    baueBank(bx, SLAB_H, bz, laengs);
  }
}


/* ---- Die B-Ebene bauen ----
   Boden, Decke, Aussenwand und Stirnwaende - die Wand zum Schacht hin ist
   die Schachtwand selbst, dort sitzt der Durchgang. Dazu das, was so eine
   Ebene erst zu einer macht: eine Reihe Laeden hinter Theken,
   Fahrkartenautomaten, Saeulen, Baenke, Werbetafeln und ein Wegweiser. */
const UB_LADEN_WAND = [0xb8863c, 0x2f6ea8, 0x3f8a52, 0xa8443c];
const UB_LADEN_SCHILD = [0xffe2a6, 0xc0dcf6, 0xcaeecb, 0xf8ccc4];
function baueBEbene(sx, sch) {
  const r = ubBEbene(sx, sch, 0);
  const u0 = UB_MITTE, u1 = UB_MITTE + UB_BE_HOCH;
  const mx = (r.x0 + r.x1) / 2, mz = (r.z0 + r.z1) / 2;
  const lx = r.x1 - r.x0, lz = r.z1 - r.z0;
  const weg = r.weg;
  const zIn = weg > 0 ? r.z0 : r.z1;        // Kante am Treppenschacht
  const zAus = weg > 0 ? r.z1 : r.z0;       // gegenueberliegende Wand
  /* Punkte in der Halle: d = Abstand von der Schachtkante nach innen. */
  const tief = (d) => zIn + weg * d;
  const vorn = (d) => zAus - weg * d;       // Abstand von der Aussenwand

  /* ---- Huelle ---- */
  /* Zur Schachtseite hin KEIN Ueberstand: dort liegt schon der Boden der
     Zwischenebene, und zwei Boeden auf derselben Hoehe flackern. */
  const bz0 = weg > 0 ? r.z0 : r.z0 - 0.45;
  const bz1 = weg > 0 ? r.z1 + 0.45 : r.z1;
  const bzM = (bz0 + bz1) / 2, bzT = bz1 - bz0;
  ubDeko(lx + 0.9, 0.30, bzT, mx, u0 - 0.15, bzM, 0x5b626c);            // Boden
  /* Die Decke ist hell: unter Tage faellt auf eine nach unten zeigende
     Flaeche nur der Bodenanteil des Himmelslichts, ein dunkler Farbton
     waere dort schlicht schwarz. */
  ubDeko(lx + 0.9, 0.35, bzT, mx, u1 + 0.17, bzM, 0x99a1ab);            // Decke
  {
    const cz0 = Math.min(tief(0.2), vorn(-0.45)), cz1 = Math.max(tief(0.2), vorn(-0.45));
    ubCollider({ x0: r.x0 - 0.45, x1: r.x1 + 0.45, z0: cz0, z1: cz1,
                  h: u1 + 0.35, y0: u1 - 0.05, keinKlettern: true });
  }
  const wand = (w, d, px, pz, farbe) => {
    ubDeko(w, UB_BE_HOCH, d, px, u0 + UB_BE_HOCH / 2, pz, farbe);
    ubCollider({ x0: px - w / 2, x1: px + w / 2, z0: pz - d / 2, z1: pz + d / 2,
                  h: u1, y0: u0 - 0.3, keinKlettern: true });
  };
  wand(lx + 0.9, 0.4, mx, vorn(-0.2), 0x77818e);                      // Aussenwand
  wand(0.4, lz + 0.5, r.x0 - 0.2, mz, 0x77818e);                      // Stirnwaende
  wand(0.4, lz + 0.5, r.x1 + 0.2, mz, 0x77818e);
  /* Heller Laufstreifen im Boden - er zeigt, wo es langgeht. */
  ubDeko(lx - 0.6, 0.06, 1.6, mx, u0 - 0.02, tief(lz * 0.55), 0x6f7783);

  /* ---- Schachtwand von der Halle aus ----
     Sie ist die vierte Wand der Halle. Roh ist sie ein dunkles Feld,
     deshalb bekommt sie eine helle Verkleidung, einen Sockel und einen
     Rahmen um den Durchgang - erst dadurch sieht man ueberhaupt, dass
     dort eine Tuer ist. */
  const dgA = ubDurchgang(sx, sch);
  for (const [a, b] of [[r.x0 - 0.4, dgA.x0], [dgA.x1, r.x1 + 0.4]]) {
    if (b - a < 0.3) continue;
    ubDeko(b - a, 2.30, 0.12, (a + b) / 2, u0 + 1.35, tief(0.10), 0xb9c2cc);
    ubDeko(b - a, 0.30, 0.14, (a + b) / 2, u0 + 0.15, tief(0.10), 0x4d545c);
  }
  /* Nur zwei schmale Kanten als Laibung - kein Sturz. Ein Sturz haette
     die Oeffnung wieder auf Tuerhoehe gebracht; sie soll bis unter die
     Decke offen sein. */
  for (const px of [dgA.x0, dgA.x1])
    ubDeko(0.20, UB_BE_HOCH, 0.5, px, u0 + UB_BE_HOCH / 2, tief(0.25), 0xb9c2cc);

  /* ---- Laeden an der Aussenwand ---- */
  const nL = 4, bw = (lx - 0.6) / nL;
  for (let i = 0; i < nL; i++) {
    const cx = r.x0 + 0.3 + bw * (i + 0.5);
    ubDeko(bw - 0.30, 2.30, 0.14, cx, u0 + 1.15, vorn(0.26), UB_LADEN_WAND[i]);
    ubDeko(bw - 0.30, 0.50, 0.16, cx, u0 + 2.62, vorn(0.32), UB_LADEN_SCHILD[i]);
    /* Zwei Regalboeden mit Ware. */
    for (const [hy, n] of [[1.00, 5], [1.55, 4]]) {
      ubDeko(bw - 0.80, 0.07, 0.34, cx, u0 + hy, vorn(0.48), 0xd9d2c2);
      for (let k = 0; k < n; k++) {
        const wx = cx + (k - (n - 1) / 2) * ((bw - 1.0) / n);
        const f = [0xe8d9a8, 0xc85a4a, 0x4a7fc8, 0x6bb06b, 0xe0e0e0][(i + k) % 5];
        ubDeko(0.20, 0.24, 0.20, wx, u0 + hy + 0.16, vorn(0.48), f);
      }
    }
    /* Theke davor - man sieht ueber sie hinweg in den Laden. */
    const tz = vorn(1.70);
    ubDeko(bw - 0.90, 0.95, 0.60, cx, u0 + 0.475, tz, 0xe2ddd0);
    ubDeko(bw - 0.80, 0.08, 0.70, cx, u0 + 0.98, tz, 0x3b4048);
    ubCollider({ x0: cx - (bw - 0.90) / 2, x1: cx + (bw - 0.90) / 2,
                  z0: Math.min(tz - 0.3, tz + 0.3), z1: Math.max(tz - 0.3, tz + 0.3),
                  h: u0 + 1.0, y0: u0 - 0.1, klein: true });
    /* Hinter der Theke steht jemand - mit Blick in die Halle. */
    merkeInnenPlatz(cx, u0, vorn(1.05), weg > 0 ? Math.PI : 0);
  }
  /* Pfeiler zwischen den Laeden - sie trennen die Fronten. */
  for (let i = 0; i <= nL; i++) {
    const px = r.x0 + 0.3 + bw * i;
    ubDeko(0.28, UB_BE_HOCH, 0.9, px, u0 + UB_BE_HOCH / 2, vorn(0.5), 0x8f99a5);
  }

  /* ---- Fahrkartenautomaten an der Schachtwand ---- */
  const dg = dgA;
  const linksPlatz = dg.x0 - r.x0, rechtsPlatz = r.x1 - dg.x1;
  const start = linksPlatz > rechtsPlatz ? dg.x0 - 1.1 : dg.x1 + 1.1;
  const schritt = linksPlatz > rechtsPlatz ? -1.15 : 1.15;
  for (let i = 0; i < 3; i++) {
    const ax = start + schritt * i;
    if (ax < r.x0 + 0.8 || ax > r.x1 - 0.8) continue;
    const az = tief(0.55);
    ubDeko(0.88, 1.75, 0.55, ax, u0 + 0.875, az, 0x2b3038);
    ubDeko(0.62, 0.46, 0.10, ax, u0 + 1.34, tief(0.26), 0x9fe8ff);      // Bildschirm
    ubDeko(0.62, 0.14, 0.10, ax, u0 + 0.94, tief(0.26), 0xd8c26a);      // Ausgabeschale
    ubDeko(0.88, 0.12, 0.60, ax, u0 + 1.80, az, 0x1b1f25);
    ubCollider({ x0: ax - 0.44, x1: ax + 0.44,
                  z0: Math.min(az, tief(0.26)) - 0.14, z1: Math.max(az, tief(0.26)) + 0.14,
                  h: u0 + 1.75, y0: u0 - 0.1, klein: true });
    /* Vor dem mittleren Automaten loest jemand eine Fahrkarte. */
    if (i === 1) merkeInnenPlatz(ax, u0, tief(1.25), weg > 0 ? Math.PI : 0);
  }

  /* ---- Saeulen in der Halle ---- */
  for (let i = 0; i < 4; i++) {
    const px = lerp(r.x0 + 1.8, r.x1 - 1.8, i / 3);
    const pz = vorn(3.0);
    ubDeko(0.55, UB_BE_HOCH, 0.55, px, u0 + UB_BE_HOCH / 2, pz, 0x9aa4b0);
    ubDeko(0.78, 0.18, 0.78, px, u1 - 0.09, pz, 0x7d8794);
    ubCollider({ x0: px - 0.3, x1: px + 0.3, z0: pz - 0.3, z1: pz + 0.3,
                  h: u1, y0: u0 - 0.1 });
  }

  /* ---- Baenke ---- */
  for (const f of [0.28, 0.72]) {
    const px = lerp(r.x0 + 1.8, r.x1 - 1.8, f);
    const pz = tief(2.1);
    ubDeko(1.80, 0.12, 0.50, px, u0 + 0.45, pz, 0x8a6a44);
    ubDeko(1.80, 0.50, 0.10, px, u0 + 0.72, tief(1.86), 0x8a6a44);
    for (const s2 of [-0.76, 0.76])
      ubDeko(0.12, 0.44, 0.46, px + s2, u0 + 0.22, pz, 0x4a4f57);
    /* Auf jeder Bank sitzt jemand und schaut in die Halle. */
    merkeInnenPlatz(px + 0.45, u0, pz, weg > 0 ? 0 : Math.PI, u0 + 0.51);
  }

  /* ---- Werbetafeln an den Stirnwaenden ---- */
  for (const px of [r.x0 + 0.06, r.x1 - 0.06]) {
    const nach = px < mx ? 1 : -1;
    ubDeko(0.12, 2.10, 1.70, px + nach * 0.06, u0 + 1.45, tief(lz * 0.45), 0x1d2128);
    ubDeko(0.06, 1.86, 1.46, px + nach * 0.16, u0 + 1.45, tief(lz * 0.45), 0xf2e9d8);
  }

  /* ---- Wegweiser ueber dem Durchgang ---- */
  {
    const wx = (dg.x0 + dg.x1) / 2, wz = tief(1.7);
    /* Blau wie die Linie, mit Namensband und Pfeil zur Treppe. Das
       durchgehend gruene Feld sah aus wie eine aufgehaengte Plane. */
    ubDeko(2.60, 0.50, 0.14, wx, u1 - 0.58, wz, 0x1b3fa0);
    ubDeko(1.80, 0.12, 0.12, wx + 0.25, u1 - 0.58, tief(1.62), 0xf2f4f8);
    ubDeko(0.26, 0.26, 0.12, wx - 0.92, u1 - 0.58, tief(1.62), 0xf2f4f8);
    ubDeko(0.14, 0.14, 0.12, wx - 1.08, u1 - 0.58, tief(1.62), 0xf2f4f8);
    for (const s2 of [-1.1, 1.1])
      ubDeko(0.06, 0.33, 0.06, wx + s2, u1 - 0.16, wz, 0x8d99a6);
  }

  /* ---- Deckenleuchten ---- */
  for (const d of [1.6, lz - 1.6]) {
    const pz = tief(d);
    ubDeko(lx - 1.0, 0.20, 0.50, mx, u1 - 0.12, pz, 0x363b42);
    ubDeko(lx - 1.3, 0.10, 0.34, mx, u1 - 0.27, pz, 0xf6f4e8);
  }
}

/* ---- U-Bahn-Eingang ----
   Treppenschacht mit Geländer und beleuchtetem Schild. */
/* ---- Aufzug: Schacht und Kabine ----
   Der Schacht ist ein Geruest aus vier Ecksaeulen mit Glasfeldern
   dazwischen; zum Treppenfuss hin bleibt er offen, dort steigt man ein.
   Die Kabine faehrt zwischen Bahnsteig und Gehweg und traegt dabei jeden
   mit, der auf ihr steht (siehe collidePlayerAufzug). */
const AUFZUEGE = [];
const AUF_TEMPO = 1.5;                    // m/s
const AUF_HALT = 2.6;                     // Sekunden Aufenthalt oben/unten
function baueAufzug(sx, sch) {
  /* Achtung: alles, was ueber ubDeko/ubCollider gebaut wird, rechnet im
     Koordinatensystem der LINIE - der Versatz kommt dort erst dazu. Nur
     die Kabine und der Eintrag in AUFZUEGE stehen in Weltkoordinaten,
     die brauchen ihn deshalb von Hand. */
  const a = ubAufzug(sx, sch, 0);
  const mx = (a.x0 + a.x1) / 2, mz = (a.z0 + a.z1) / 2;
  const mzWelt = mz + UB_DZ;
  const unten = UB_TIEF, oben = SLAB_H;
  /* ---- Oben nur eine Bruestung, kein Haeuschen ----
     Zuerst stand hier ein glaesernes Haeuschen mit Dach auf dem Gehweg.
     Das war ein Fremdkoerper auf dem Buergersteig und hat zu jedem
     Aufzug ein gutes Dutzend Zeichenaufrufe gekostet. Jetzt ist oben nur
     die Oeffnung mit einer Bruestung ringsum - zum Treppenfuss hin offen,
     dort steigt man ein. Der Schacht selbst steckt in der Wand. */
  const tuerSeite = a.richtung > 0 ? a.x0 : a.x1;
  const rueckSeite = a.richtung > 0 ? a.x1 : a.x0;
  const bh = 1.05;
  const bruestung = (bx, bz, px, pz) => {
    const laengs = bx > bz, lang = laengs ? bx : bz;
    ubDeko(bx, 0.07, bz, px, SLAB_H + bh, pz, 0x9aa2ad);
    ubDeko(bx, 0.05, bz, px, SLAB_H + bh * 0.48, pz, 0x8b939c);
    const n = Math.max(2, Math.round(lang / 1.0));
    for (let i = 0; i <= n; i++) {
      const t2 = -lang / 2 + (i / n) * lang;
      ubDeko(0.06, bh, 0.06, px + (laengs ? t2 : 0), SLAB_H + bh / 2,
           pz + (laengs ? 0 : t2), 0x8b939c);
    }
    ubCollider({ x0: px - bx / 2, x1: px + bx / 2, z0: pz - bz / 2, z1: pz + bz / 2,
                  h: SLAB_H + bh, y0: SLAB_H - 0.05, klein: true });
  };
  bruestung(a.x1 - a.x0 + 0.3, 0.12, mx, a.z0 - 0.15);
  bruestung(a.x1 - a.x0 + 0.3, 0.12, mx, a.z1 + 0.15);
  bruestung(0.12, a.z1 - a.z0, rueckSeite + (a.richtung > 0 ? 0.15 : -0.15), mz);
  /* Ein blaues U auf einem Pfosten neben dem Eingang. */
  ubDeko(0.09, 2.2, 0.09, tuerSeite - a.richtung * 0.2, SLAB_H + 1.1, a.z0 - 0.3, 0x6f7681);
  ubDeko(0.6, 0.6, 0.09, tuerSeite - a.richtung * 0.2, SLAB_H + 2.1, a.z0 - 0.3, 0x1b3fa0);
  ubDeko(0.24, 0.24, 0.11, tuerSeite - a.richtung * 0.2, SLAB_H + 2.1, a.z0 - 0.3, 0xf2f4f8);
  /* ---- Der Schacht unter der Strasse ----
     Drei geschlossene Waende, die vierte ist der Ausstieg. */
  const wandH = SLAB_H - unten;
  const schachtWand = (w, d, px, pz) => {
    ubDeko(w, wandH, d, px, unten + wandH / 2, pz, 0x6d757f);
    ubCollider({ x0: px - Math.max(w, 0.14) / 2, x1: px + Math.max(w, 0.14) / 2,
                  z0: pz - Math.max(d, 0.14) / 2, z1: pz + Math.max(d, 0.14) / 2,
                  h: SLAB_H, y0: unten, keinKlettern: true });
  };
  schachtWand(a.x1 - a.x0 + 0.3, 0.14, mx, a.z0 - 0.07);
  schachtWand(a.x1 - a.x0 + 0.3, 0.14, mx, a.z1 + 0.07);
  schachtWand(0.14, a.z1 - a.z0 + 0.3, rueckSeite + (a.richtung > 0 ? 0.07 : -0.07), mz);
  /* Boden unten im Schacht, damit man nicht ins Leere sieht. */
  ubDeko(a.x1 - a.x0, 0.2, a.z1 - a.z0, mx, unten - 0.1, mz, 0x3e454e);

  /* ---- Die Kabine ----
     Eigene Meshes, denn sie bewegt sich; die Deko wird zu EINER festen
     Geometrie verschmolzen. */
  const g = new THREE.Group();
  const w = a.x1 - a.x0 - 0.24, d = a.z1 - a.z0 - 0.24, h = 2.3;
  /* ---- Die Kabine als EIN Mesh ----
     Boden, Decke und drei Waende waren fuenf einzelne Zeichenaufrufe je
     Kabine. Mit zehn Stationen und zwei Aufzuegen je Station waeren das
     hundert - nur fuer Fahrstuhlkabinen. Sie werden deshalb zu einer
     Geometrie verschmolzen; die Farbe steckt danach in den Eckpunkten.
     Nur das Leuchtfeld bleibt eigen, es braucht ein anderes Material. */
  const teile = [
    { geo: new THREE.BoxGeometry(w, 0.16, d), x: 0, y: -0.08, z: 0, farbe: 0x59616b },
    { geo: new THREE.BoxGeometry(w, 0.12, d), x: 0, y: h, z: 0, farbe: 0x7f8b98 },
    { geo: new THREE.BoxGeometry(w, h * 0.92, 0.06), x: 0, y: h * 0.46, z: -d / 2, farbe: 0x7f8b98 },
    { geo: new THREE.BoxGeometry(w, h * 0.92, 0.06), x: 0, y: h * 0.46, z: d / 2, farbe: 0x7f8b98 },
    { geo: new THREE.BoxGeometry(0.06, h * 0.92, d),
      x: (a.richtung > 0 ? 1 : -1) * w / 2, y: h * 0.46, z: 0, farbe: 0x7f8b98 },
  ];
  const kabine = new THREE.Mesh(verschmelzeTeile(teile),
    new THREE.MeshLambertMaterial({ vertexColors: true }));
  kabine.receiveShadow = true; g.add(kabine);
  const la = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.06, d * 0.5),
    new THREE.MeshBasicMaterial({ color: 0xf6f3e4 }));
  la.position.y = h - 0.1; g.add(la);
  g.position.set(mx, unten, mzWelt);
  scene.add(g);
  AUFZUEGE.push({ mesh: g, x: mx, z: mzWelt, w, d,
                  unten, oben, y: unten, ziel: oben, warten: AUF_HALT });
}

/* Kabinen bewegen: hoch, warten, runter, warten. */
function updateAufzuege(dt) {
  for (const a of AUFZUEGE) {
    /* Weit entfernte Kabinen gar nicht zeichnen - acht Stueck in der
       Stadt sind sonst rund vierzig Zeichenaufrufe fuer etwas, das man
       nur an der Station sieht. */
    const dx = a.x - player.pos.x, dz = a.z - player.pos.z;
    a.mesh.visible = dx * dx + dz * dz < 90 * 90;
    if (a.warten > 0) { a.warten -= dt; a.mesh.position.y = a.y; continue; }
    const weg = a.ziel - a.y;
    const schritt = AUF_TEMPO * dt;
    if (Math.abs(weg) <= schritt) {
      a.y = a.ziel;
      a.ziel = a.ziel === a.oben ? a.unten : a.oben;
      a.warten = AUF_HALT;
      a.vy = 0;
    } else {
      a.vy = Math.sign(weg) * AUF_TEMPO;
      a.y += a.vy * dt;
    }
    a.mesh.position.y = a.y;
  }
}

/* Auf der Kabine stehen und mitfahren. Gleiche Rechnung wie beim
   Hubschrauber, nur dass hier auch die HOEHE mitgenommen wird. */
function collidePlayerAufzug(prevY) {
  const p = player.pos, r = player.radius;
  for (const a of AUFZUEGE) {
    if (Math.abs(p.x - a.x) > a.w / 2 + r || Math.abs(p.z - a.z) > a.d / 2 + r) continue;
    const top = a.y;
    if (p.y < top + 0.25 && prevY >= top - 0.45 && player.vel.y <= 0.05) {
      p.y = top;
      player.vel.y = 0;
      player.onGround = true;
      player.platform = a;
      a.vx = 0; a.vz = 0;
    }
  }
}

/* ---- Eine Station ----
   Bahnsteig, Gleistrog, Decke, Waende, dazu die Treppe im Randstreifen des
   Gehwegs. Der Tunnel selbst entsteht spaeter in baueUBahnLinie(). */
function baueUBahn(x) {
  UBAHNEN.push({ x, dz: UB_DZ });
  const hx = UB_HALLE_X;

  /* ---- Treppenschaechte, einer je Bahnsteig ---- */
  for (const sch of UB_SCHAECHTE) {
    const zM = (sch.z0 + sch.z1) / 2, zT = sch.z1 - sch.z0;
    const richtung = sch.xKopf > sch.xFuss ? -1 : 1;   // Laufrichtung beim Hinabsteigen
    const weg = sch.steig === 'nord' ? 1 : -1;         // Seite, auf der die B-Ebene liegt
    /* ---- Zwei Treppenlaeufe mit Zwischenebene ----
       Die Stufen entstehen aus derselben Funktion, die auch die Hoehe
       liefert (abgangHoehe) - dadurch stimmen Bild und Boden immer
       ueberein. Vorher war es ein einziger Lauf von 43 Grad. */
    const stufen = (vonS, bisS, anzahl) => {
      const laenge = bisS - vonS;
      const tT = laenge / anzahl;
      for (let i = 0; i < anzahl; i++) {
        const y0 = abgangHoehe(vonS + i * tT);
        const y1 = abgangHoehe(vonS + (i + 1) * tT);
        const xx = x + sch.xKopf + richtung * (vonS + (i + 0.5) * tT);
        ubDeko(tT, 0.1, zT, xx, y1 + 0.05, zM, 0x6a7078);                 // Trittflaeche
        if (y0 > y1) ubDeko(0.08, y0 - y1, zT, xx - richtung * tT / 2, (y0 + y1) / 2, zM, 0x3c4249);
        /* Helle Nase auf jeder Stufe - erst dadurch liest sich der Abgang
           als Treppe und nicht als schiefe Ebene. */
        ubDeko(0.10, 0.12, zT, xx + richtung * tT / 2, y1 + 0.06, zM, 0xc4cad2);
      }
      /* ---- Handlaeufe ----
         Links und rechts ein Lauf auf 95 cm ueber den Stufen, getragen von
         Pfosten. Ohne sie war der Abgang ein nackter Betontrog. */
      const HL = 0.95;
      const nP = Math.max(2, Math.round(laenge / 1.5));
      for (const s3 of [-1, 1]) {
        const hz = zM + s3 * (zT / 2 - 0.18);
        for (let k = 0; k <= nP; k++) {
          const sp = vonS + (k / nP) * laenge;
          const hy = abgangHoehe(sp);
          const hx2 = x + sch.xKopf + richtung * sp;
          ubDeko(0.07, HL, 0.07, hx2, hy + HL / 2, hz, 0x8d99a6);
        }
        /* Der Lauf selbst: EIN schraeges Stueck ueber den ganzen Flug.
           Der Schacht liegt laengs der x-Achse, deshalb genuegt eine
           Neigung um die Z-Achse. */
        {
          const ax = x + sch.xKopf + richtung * vonS, ay = abgangHoehe(vonS) + HL;
          const bx2 = x + sch.xKopf + richtung * bisS, by = abgangHoehe(bisS) + HL;
          const lg = Math.hypot(bx2 - ax, by - ay);
          ubDeko(lg + 0.12, 0.09, 0.09, (ax + bx2) / 2, (ay + by) / 2, hz, 0xb4bcc6,
               0, Math.atan2(by - ay, bx2 - ax));
        }
      }
    };
    stufen(0, UB_TR_OBEN, UB_STUFEN_OBEN);
    stufen(UB_TR_OBEN + UB_HALLE_LANG, UB_ABGANG, UB_STUFEN_UNTEN);
    /* ---- Zwischenebene: Boden, Decke, Waende ----
       Hier steht man nach der ersten Treppe. Sie ist so breit wie der
       Schacht und drei Meter hoch - genug, um sich umzusehen, bevor es
       weiter hinuntergeht. */
    {
      /* Dieselbe lichte Hoehe wie in der Halle nebenan - sonst reicht der
         Durchgang zur Halle ueber die Decke der Zwischenebene hinaus. */
      const hM = UB_BE_HOCH;
      const sA = UB_TR_OBEN - 0.5, sB = UB_TR_OBEN + UB_HALLE_LANG + 0.5;
      const mx = x + sch.xKopf + richtung * (sA + sB) / 2;
      const ml = sB - sA;
      /* Boden und Decke ragen nur auf der GESCHLOSSENEN Seite ueber den
         Schacht hinaus. Zur B-Ebene hin enden sie genau an der
         Schachtkante - dort schliesst der Hallenboden an. Vorher lagen
         beide Boeden auf derselben Hoehe und ueberlappten sich 90 cm
         weit: genau das war der flackernde Boden unter den Fuessen. */
      const uz0 = weg > 0 ? sch.z0 - 0.45 : sch.z0;
      const uz1 = weg > 0 ? sch.z1 : sch.z1 + 0.45;
      const uzM = (uz0 + uz1) / 2, uzT = uz1 - uz0;
      ubDeko(ml, 0.30, uzT, mx, UB_MITTE - 0.15, uzM, 0x3e454e);           // Boden
      ubDeko(ml, 0.35, uzT + 0.5, mx, UB_MITTE + hM, uzM + (weg > 0 ? -0.25 : 0.25),
           0x454c55);                                                    // Decke
      /* Wandverkleidung an beiden Laengsseiten - ohne sie sieht man in
         den Erdblock. */
      for (const s3 of [-1, 1]) {
        /* Zur B-Ebene hin bleibt die Seite offen - dort geht man hinueber. */
        if (s3 === weg) continue;
        const wz = s3 < 0 ? sch.z0 - 0.22 : sch.z1 + 0.22;
        ubDeko(ml, hM, 0.16, mx, UB_MITTE + hM / 2, wz, 0x8d99a6);
        /* Ein durchgehendes gruenes Band ueber fuenf Meter Wand sah aus
           wie eine Plane. Jetzt zwei kurze Wegweiser im Blau der Linie. */
        const bz = wz + (s3 < 0 ? 0.12 : -0.12);
        for (const f of [0.3, 0.7]) {
          const bx = mx - ml / 2 + ml * f;
          ubDeko(1.40, 0.42, 0.12, bx, UB_MITTE + 2.05, bz, 0x1b3fa0);
          ubDeko(1.16, 0.10, 0.14, bx, UB_MITTE + 2.05, bz, 0xf2f4f8);
        }
      }
      /* Zwei Deckenleuchten wie unten auf dem Bahnsteig. */
      for (const f of [-0.28, 0.28]) {
        const lx = x + sch.xKopf + richtung * lerp(sA, sB, 0.5 + f);
        ubDeko(1.7, 0.2, 0.44, lx, UB_MITTE + hM - 0.26, zM, 0x363b42);
        ubDeko(1.5, 0.1, 0.30, lx, UB_MITTE + hM - 0.4, zM, 0xf4f2e6);
      }
      /* Sperren gegen den Erdblock: die Decke traegt, die Waende halten. */
      ubCollider({ x0: Math.min(mx - ml / 2, mx + ml / 2), x1: Math.max(mx - ml / 2, mx + ml / 2),
                    z0: zM - zT / 2 - (weg < 0 ? 0 : 0.8), z1: zM + zT / 2 + (weg > 0 ? 0 : 0.8),
                    h: UB_MITTE + hM + 0.2, y0: UB_MITTE + hM - 0.2, keinKlettern: true });
    }
    /* Schachtwaende. Oberkante 4 cm UNTER dem Gehweg, sonst kaempfen
       Wandoberseite und Gehwegflaeche um dieselbe Ebene. */
    const wandOben = SLAB_H - 0.04, wandUnten = UB_TIEF - 0.6;
    const dg = ubDurchgang(x, sch);
    const wa0 = x + Math.min(sch.xFuss, sch.xKopf) - 0.45;
    const wa1 = x + Math.max(sch.xFuss, sch.xKopf) + 0.45;
    for (const s2 of [-1, 1]) {
      /* 3 cm in den Schacht hinein statt buendig: buendig lag die
         Innenflaeche der Wand genau auf der Kante der Hallendecke, und
         zwei Flaechen auf derselben Ebene flackern. */
      const wz = s2 < 0 ? sch.z0 - 0.22 : sch.z1 + 0.22;
      /* Ein Stueck Schachtwand. Auf der Seite der B-Ebene bleibt ueber der
         Zwischenebene ein Durchgang frei - sonst kaeme man nicht hinein. */
      const stueck = (b0, b1, y0, y1) => {
        if (b1 - b0 < 0.06 || y1 - y0 < 0.06) return;
        ubDeko(b1 - b0, y1 - y0, 0.5, (b0 + b1) / 2, (y0 + y1) / 2, wz, 0x4e565f);
        /* Sperrt nur UNTER dem Gehweg: wer oben laeuft, wird nicht gebremst. */
        ubCollider({ x0: b0, x1: b1, z0: wz - 0.25, z1: wz + 0.25,
                      h: Math.min(y1, SLAB_H - 0.03), y0, keinKlettern: true });
      };
      if (s2 !== weg) {
        stueck(wa0, wa1, wandUnten, wandOben);
      } else {
        stueck(wa0, dg.x0, wandUnten, wandOben);
        stueck(dg.x1, wa1, wandUnten, wandOben);
        stueck(dg.x0, dg.x1, wandUnten, UB_MITTE - 0.05);
        stueck(dg.x0, dg.x1, UB_MITTE + UB_BE_HOCH, wandOben);
      }
      /* Hier hingen Lampen an der Schachtwand. Sie sind ersatzlos weg:
         als fast weisse Platten von 1,3 m Laenge waren sie im engen Schacht
         riesige leuchtende Bloecke, und mehr als Licht sah man von ihnen
         nicht. Die Beleuchtung unter der Erde kommt ohnehin von der Lampe,
         die der Figur folgt (untenLicht). */
    }
    /* ---- Bruestung rings um die Oeffnung ----
       Der Schacht war an DREI Seiten offen: nur die beiden Laengswaende
       reichten bis unter den Gehweg, oben gab es nichts. Wer laengs des
       Gehwegs auf das tiefe Ende zulief, trat gemessen bei x = -48 ins
       Leere und fiel elf Meter. Genau das war das "ich laufe die Treppe
       nicht richtig runter": man fiel hinein, statt hinabzusteigen.
       Jetzt steht rings um das Loch ein Gelaender - offen bleibt nur der
       Treppenmund am oberen Ende. So kommt man nur ueber die Stufen
       hinunter, wie an einer echten Station. */
    const gh = 1.05;                       // Gelaenderhoehe
    const gx0 = x + Math.min(sch.xFuss, sch.xKopf) - 0.3;
    const gx1 = x + Math.max(sch.xFuss, sch.xKopf) + 0.3;
    const gz0 = sch.z0 - 0.32, gz1 = sch.z1 + 0.32;
    /* Ein Gelaender, kein Sichtschutz. Die Fuellung war EINE Platte ueber
       35 % der Laenge - bei 16,6 m Schacht also ein massiver Block von
       5,81 m Laenge und 1,05 m Hoehe mitten auf dem Gehweg. Genau das war
       "die Wand auf der Strasse". Jetzt Handlauf, Knieholm und einzelne
       Staebe: man sieht hindurch, und der Schacht bleibt trotzdem zu. */
    const gelaender = (bx, bz, px, pz) => {
      const laengs = bx > bz;                         // laeuft in x oder in z?
      const lang = laengs ? bx : bz;
      ubDeko(bx, 0.07, bz, px, SLAB_H + gh, pz, 0x9aa2ad);           // Handlauf
      ubDeko(bx, 0.05, bz, px, SLAB_H + gh * 0.48, pz, 0x8b939c);    // Knieholm
      const n = Math.max(2, Math.round(lang / 1.1));
      for (let i = 0; i <= n; i++) {
        const t = -lang / 2 + (i / n) * lang;
        ubDeko(0.06, gh, 0.06, px + (laengs ? t : 0), SLAB_H + gh / 2,
             pz + (laengs ? 0 : t), 0x8b939c);
      }
      ubCollider({ x0: px - bx / 2, x1: px + bx / 2, z0: pz - bz / 2, z1: pz + bz / 2,
                    h: SLAB_H + gh, y0: SLAB_H - 0.05, klein: true });
    };
    /* Die beiden Laengsseiten. */
    for (const gz of [gz0, gz1]) gelaender(gx1 - gx0, 0.18, (gx0 + gx1) / 2, gz);
    /* Nur das TIEFE Ende zumachen - am Treppenmund geht man hinein. */
    const zuX = sch.xFuss < sch.xKopf ? gx0 : gx1;
    gelaender(0.18, gz1 - gz0, zuX, (gz0 + gz1) / 2);

    /* ---- B-Ebene neben dem Schacht ---- */
    baueBEbene(x, sch);
    /* ---- Aufzug ---- */
    baueAufzug(x, sch);
  }

  /* ---- Halle: Boeden, Decke, Waende ---- */
  const steigA = (UB_STEIG_Z0 + UB_STEIG_Z1) / 2, steigAT = UB_STEIG_Z1 - UB_STEIG_Z0;
  const steigB = (UB_STEIG2_Z0 + UB_STEIG2_Z1) / 2, steigBT = UB_STEIG2_Z1 - UB_STEIG2_Z0;
  const gleisM = (UB_GLEIS_Z0 + UB_GLEIS_Z1) / 2, gleisT = UB_GLEIS_Z1 - UB_GLEIS_Z0;
  ubDeko(hx, 0.4, steigAT, x, UB_TIEF - 0.2, steigA, 0x4a5058);
  ubDeko(hx, 0.4, steigBT, x, UB_TIEF - 0.2, steigB, 0x4a5058);
  ubDeko(hx, 0.4, gleisT, x, UB_GLEIS_TIEF - 0.2, gleisM, 0x1a1d21);
  /* Decke mit Aussparungen fuer beide Treppenschaechte. */
  for (const t of flaecheMitLoechern(x - hx / 2, x + hx / 2, UB_QUER_Z0, UB_QUER_Z1,
                                     ubLoecherLokal('unten'))) {
    ubDeko(t.w, 0.4, t.d, t.x, UB_DECKE, t.z, 0x454c55);
  }
  /* Aussenwaende laengs, mit Loch fuer die Treppen. */
  for (const [wz, sch] of [[UB_STEIG_Z1 + 0.25, UB_SCHAECHTE[0]],
                           [UB_STEIG2_Z0 - 0.25, UB_SCHAECHTE[1]]]) {
    for (const seite of [-1, 1]) {
      const kante = seite < 0 ? Math.min(sch.xFuss, sch.xKopf) : Math.max(sch.xFuss, sch.xKopf);
      const bw = seite < 0 ? (hx / 2 + kante) : (hx / 2 - kante);
      if (bw < 0.5) continue;
      const bx = seite < 0 ? (x - hx / 2 + bw / 2) : (x + hx / 2 - bw / 2);
      ubDeko(bw, 5.0, 0.5, bx, UB_TIEF + 2.5, wz, 0x66707c);
      ubDeko(bw, 1.4, 0.12, bx, UB_TIEF + 2.0, wz + (wz > UB_Z ? -0.3 : 0.3), 0xa8b6c2);
      ubCollider({ x0: bx - bw / 2, x1: bx + bw / 2, z0: wz - 0.25, z1: wz + 0.25,
                    h: -0.12, y0: UB_TIEF - 0.4, keinKlettern: true });
    }
  }
  /* Bahnsteigkanten mit Warnstreifen, beidseitig.
     Die Kante steht 4 cm ins Gleis hinein. Buendig lag ihre Aussenflaeche
     genau auf der Kante des Bahnsteigbodens - zwei Flaechen auf derselben
     Ebene, und die flackerten gegeneinander (gemessen 28 m2 je Kante). */
  for (const [zk, vor] of [[UB_STEIG_Z0, 1], [UB_STEIG2_Z1, -1]]) {
    ubDeko(hx, 1.3, 0.4, x, UB_TIEF - 0.45, zk + vor * 0.16, 0x4a5058);
    ubDeko(hx, 0.12, 0.5, x, UB_TIEF + 0.06, zk + vor * 0.3, 0xd8c24a);
  }

  /* Beleuchtung, Schilder, Baenke - auf beiden Bahnsteigen. */
  for (const [zm, zw, rueck] of [[steigA, UB_STEIG_Z1, 1], [steigB, UB_STEIG2_Z0, -1]]) {
    /* Hier lagen drei durchgehende, reinweisse Baender von 24 m Laenge und
       60 cm Breite je Bahnsteig - zusammen mit dem warmen Licht unter Tage
       sahen sie aus wie beige Landebahnen quer ueber die ganze Decke.
       Genau das war "was soll dieses Licht?".
       Jetzt eine Reihe einzelner Lampen: alle 4,5 m ein 1,7 m langes Feld
       in einem dunklen Gehaeuse, wie in einer echten Station. */
    const lampen = Math.max(3, Math.round((hx - 6) / 4.5));
    for (let i = 0; i < lampen; i++) {
      const lx = x - (hx - 6) / 2 + (i + 0.5) * ((hx - 6) / lampen);
      ubDeko(1.9, 0.22, 0.5, lx, UB_DECKE - 0.24, zm, 0x363b42);      // Gehaeuse
      ubDeko(1.7, 0.1, 0.34, lx, UB_DECKE - 0.4, zm, 0xf4f2e6);       // Leuchtfeld
    }
    /* Stationsschild. Vorher ein 3,4 x 1,1 m grosses, giftgruenes Feld mit
       einem weissen Loch darin - aus zwei Metern Entfernung fuellte es
       die halbe Wand. Jetzt eine flache Namenstafel im selben Blau wie
       oben am Eingang, mit U-Zeichen davor. */
    const sz = zw - rueck * 0.35;
    ubDeko(2.60, 0.62, 0.12, x, UB_TIEF + 2.65, sz, 0x1b3fa0);
    ubDeko(2.40, 0.44, 0.14, x, UB_TIEF + 2.65, sz, 0xf2f4f8);
    ubDeko(0.60, 0.60, 0.16, x - 1.00, UB_TIEF + 2.65, sz, 0x1b3fa0);
    for (const s4 of [-1, 1])
      ubDeko(0.09, 0.34, 0.18, x - 1.00 + s4 * 0.14, UB_TIEF + 2.70, sz, 0xf4f8ff);
    ubDeko(0.37, 0.09, 0.18, x - 1.00, UB_TIEF + 2.52, sz, 0xf4f8ff);
    ubDeko(1.30, 0.09, 0.16, x + 0.35, UB_TIEF + 2.65, sz, 0x39404a);
    for (const s2 of [-1, 1])
      baueBank(x + s2 * 8, UB_TIEF, zw - rueck * 1.5, false, undefined, rueck);
  }
  /* Ueber dem GLEIS haengen keine Deckenleuchten mehr. Dort faehrt der
     Zug; in einer echten Station ist ueber dem Gleistrog nichts ausser
     der Decke. Die Reihe leuchtender Felder mitten ueber den Schienen
     war das, was von oben nicht hingehoerte. */

  /* ---- Oben: Mast und Schild neben jedem Loch ---- */
  for (const sch of UB_SCHAECHTE) {
    /* Der Mast stand 1,6 m HINTER dem Treppenmund - mit dem laengeren
       Abgang lag das mitten auf der Fahrbahn. Jetzt steht er neben dem
       Mund auf dem Gehweg, ein Stueck seitlich versetzt, damit er nicht
       im Durchgang steht. */
    const zur = sch.xFuss < sch.xKopf ? -1 : 1;      // Richtung nach unten
    /* Das Schild steht VOR dem Vordach an der Gehwegkante - dahinter
       verschwand es hinter der Dachplatte. */
    const mx = x + sch.xKopf - zur * 0.8;
    const mz = sch.z1 + 1.7;
    baueUSchild(mx, mz, zur);
    /* ---- Vordach ueber dem Treppenmund ----
       Bisher war der Eingang ein blankes Loch im Gehweg mit einem Brett
       daneben. Ein Eingang hat ein Dach: zwei Stuetzen links und rechts
       des Mundes, darauf eine flache Platte mit hellem Rand und der
       Stationsname an der Stirnseite. Man erkennt ihn dadurch schon von
       weitem als Eingang und nicht als Baugrube. */
    {
      const dx = x + sch.xKopf + zur * 0.9;          // Mitte des Vordachs
      const dz = (sch.z0 + sch.z1) / 2;
      const bt = sch.z1 - sch.z0 + 1.5;              // Tiefe des Dachs
      const H = SLAB_H + 2.85;
      for (const s2 of [-1, 1]) {
        const pz = dz + s2 * (bt / 2 - 0.16);
        ubDeko(0.24, H - SLAB_H, 0.24, dx, (SLAB_H + H) / 2, pz, 0x3a4048);
        ubCollider({ x0: dx - 0.12, x1: dx + 0.12, z0: pz - 0.12, z1: pz + 0.12,
                      h: H, klein: true });
      }
      ubDeko(2.5, 0.24, bt, dx, H + 0.12, dz, 0x2e343b);              // Dachplatte
      /* Nur eine schmale helle Kante rings um die Platte - eine zweite
         volle Platte darueber sah aus wie ein weisser Tisch, der den
         halben Gehweg einnimmt. */
      for (const s3 of [-1, 1]) {
        ubDeko(2.62, 0.09, 0.12, dx, H + 0.29, dz + s3 * (bt / 2), 0x8b939c);
        ubDeko(0.12, 0.09, bt + 0.12, dx + s3 * 1.31, H + 0.29, dz, 0x8b939c);
      }
      /* Beschriftete Stirnseite - von der Strasse aus lesbar. */
      ubDeko(0.12, 0.42, bt - 0.5, dx - zur * 1.26, H - 0.28, dz, 0x1b3fa0);
      ubDeko(0.14, 0.24, bt - 1.1, dx - zur * 1.30, H - 0.28, dz, 0xf2f6ff);
      ubCollider({ x0: dx - 1.25, x1: dx + 1.25, z0: dz - bt / 2, z1: dz + bt / 2,
                    h: H + 0.35, y0: H - 0.1, keinKlettern: true });
    }
  }
}

/* ---- U-Bahn-Schild ----
   Das gruene Brett auf einem Stiel sah nach Bauschild aus. Jetzt steht
   dort ein richtiges Schild: blaue Tafel mit weissem U, darunter ein
   helles Namensband, beides beidseitig. Das U entsteht aus drei Kaesten -
   zwei Schenkeln und dem Boden. */
function baueUSchild(mx, mz, zur) {
  ubDeko(0.16, 3.1, 0.16, mx, SLAB_H + 1.55, mz, 0x2e3238);            // Mast
  const H = SLAB_H + 2.95;
  /* Blaue Tafel, quadratisch - das ist das eigentliche U-Zeichen. */
  ubDeko(1.05, 1.05, 0.14, mx, H, mz, 0x1b3fa0);
  ubDeko(0.95, 0.95, 0.16, mx, H, mz, 0x2a5ad0);
  /* Das U: zwei senkrechte Schenkel und ein Boden. */
  for (const s2 of [-1, 1])
    ubDeko(0.13, 0.62, 0.18, mx + s2 * 0.26, H + 0.09, mz, 0xf4f8ff);
  ubDeko(0.65, 0.13, 0.18, mx, H - 0.29, mz, 0xf4f8ff);
  /* Namensband darunter. */
  ubDeko(1.55, 0.34, 0.12, mx, H - 0.86, mz, 0xf2f4f8);
  ubDeko(1.30, 0.12, 0.14, mx, H - 0.86, mz, 0x39404a);
  ubCollider({ x0: mx - 0.1, x1: mx + 0.1, z0: mz - 0.1, z1: mz + 0.1,
                h: SLAB_H + 3.0, klein: true });
}

/* ---- Die Tunnel zwischen den Stationen ----
   Offen und begehbar: Bahnsteighoher Gehweg neben dem Gleis, Decke darueber,
   Waende links und rechts, alle 12 m eine Lampe. */
function baueUBahnLinie(linie) {
  const statX = linie.statX, UB_X0 = linie.x0, UB_X1 = linie.x1;
  const steigA = (UB_STEIG_Z0 + UB_STEIG_Z1) / 2, steigAT = UB_STEIG_Z1 - UB_STEIG_Z0;
  const steigB = (UB_STEIG2_Z0 + UB_STEIG2_Z1) / 2, steigBT = UB_STEIG2_Z1 - UB_STEIG2_Z0;
  const gleisM = (UB_GLEIS_Z0 + UB_GLEIS_Z1) / 2, gleisT = UB_GLEIS_Z1 - UB_GLEIS_Z0;

  const abschnitte = [];
  for (let i = 0; i + 1 < statX.length; i++) {
    abschnitte.push([statX[i] + UB_HALLE_X / 2, statX[i + 1] - UB_HALLE_X / 2]);
  }
  for (const [a, b] of abschnitte) {
    const laenge = b - a, mitte = (a + b) / 2;
    /* Beide Gehwege durchgehend - an jedem Gleis einer. */
    ubDeko(laenge, 0.4, steigAT, mitte, UB_TIEF - 0.2, steigA, 0x2b2f34);
    ubDeko(laenge, 0.4, steigBT, mitte, UB_TIEF - 0.2, steigB, 0x2b2f34);
    ubDeko(laenge, 0.4, gleisT, mitte, UB_GLEIS_TIEF - 0.2, gleisM, 0x16191d);
    ubDeko(laenge, 0.4, UB_QUER_Z1 - UB_QUER_Z0 + 1.6, mitte, UB_DECKE,
         (UB_QUER_Z0 + UB_QUER_Z1) / 2, 0x3d434b);                            // Decke
    for (const [wz, innen] of [[UB_STEIG_Z1 + 0.25, -1], [UB_STEIG2_Z0 - 0.25, 1]]) {
      ubDeko(laenge, 5.6, 0.5, mitte, UB_TIEF + 2.8, wz, 0x555c66);
      ubDeko(laenge, 1.2, 0.12, mitte, UB_TIEF + 2.0, wz + innen * 0.3, 0x8fa0ae);
      ubCollider({ x0: a, x1: b, z0: wz - 0.25, z1: wz + 0.25,
                    h: -0.12, y0: UB_TIEF - 0.4, keinKlettern: true });
    }
    /* Bahnsteigkanten. */
    for (const [zk, vor] of [[UB_STEIG_Z0, 1], [UB_STEIG2_Z1, -1]]) {
      ubDeko(laenge, 1.3, 0.4, mitte, UB_TIEF - 0.45, zk + vor * 0.16, 0x3e444b);
    }
    const n = Math.max(3, Math.round(laenge / 7));
    for (let i = 0; i < n; i++) {
      const lx = a + (i + 0.5) * (laenge / n);
      /* Nur ueber den beiden Gehwegen - ueber dem Gleis nicht. */
      for (const lz of [steigA, steigB]) {
        ubDeko(1.6, 0.2, 0.44, lx, UB_DECKE - 0.26, lz, 0x363b42);   // Gehaeuse
        ubDeko(1.4, 0.1, 0.3, lx, UB_DECKE - 0.4, lz, 0xf4f2e6);     // Leuchtfeld
      }
      if (i % 2 === 0) {
        ubDeko(0.28, 5.4, 0.28, lx, UB_TIEF + 2.7, UB_STEIG_Z1 - 0.6, 0x3c434c);
        ubDeko(0.28, 5.4, 0.28, lx, UB_TIEF + 2.7, UB_STEIG2_Z0 + 0.6, 0x3c434c);
      }
    }
  }
  /* Zwei Gleise ueber die ganze Linie - eins je Fahrtrichtung -, dazu
     Schwellen. */
  for (const gz of [UB_GLEIS_A, UB_GLEIS_B]) {
    for (const s2 of [-1, 1]) {
      ubDeko(UB_X1 - UB_X0, 0.14, 0.16, (UB_X0 + UB_X1) / 2, UB_GLEIS_TIEF + 0.07,
           gz + s2 * 0.72, 0x8a8f96);
    }
    for (let sx = UB_X0 + 1; sx < UB_X1; sx += 2.4) {
      ubDeko(0.3, 0.1, 2.0, sx, UB_GLEIS_TIEF + 0.02, gz, 0x3a3128);
    }
  }

  /* ---- Erdreich zwischen Tunneldecke und Strasse ----
     Von unten sah man an den Raendern der Decke vorbei bis in den Himmel.
     Ausgespart nur dort, wo ein Treppenschacht durchstoesst. */
  /* Unterkante UEBER die Tunneldecke legen, nicht hinein. Vorher lag sie
     30 cm tiefer als die Deckenplatte - beide teilten sich damit Flaechen
     und flackerten gegeneinander. */
  const erdeUnten = UB_DECKE + 0.22, erdeOben = -0.5;
  const erdeH = erdeOben - erdeUnten;
  if (erdeH > 0.2) {
    /* An den Enden ein Stueck weiter als die Stationswaende. Endeten Erde
       und Stirnwand auf derselben Ebene, kaempften auch die beiden
       Flaechen (gemessen 49 m2). Jetzt steckt die Wand ganz in der Erde. */
    /* Auch seitlich weiter als die Roehrenwaende (die sind 50 cm dick):
       endete die Erde genau auf deren Aussenflaeche, flackerten beide. */
    for (const t of flaecheMitLoechern(UB_X0 - 1.6, UB_X1 + 1.6,
                                       UB_QUER_Z0 - 1.6, UB_QUER_Z1 + 1.6,
                                       ubLoecherLokal('erde'))) {
      ubDeko(t.w, erdeH, t.d, t.x, (erdeOben + erdeUnten) / 2, t.z, 0x2a2620);
    }
  }

  /* ---- Enden der Linie zumauern ----
     Die Stirnwand war 12 m hoch und sass auf UB_GLEIS_TIEF + 6,0 - sie
     reichte damit von -10,2 bis +1,8, also fast zwei Meter AUS DER
     STRASSE HERAUS. Am Ende jeder Linie stand deshalb ein schwarzer
     Riegel quer ueber der Fahrbahn; genau das war die "Wand" auf der
     Uferstrasse.
     Jetzt endet sie knapp ueber der Tunneldecke (UB_DECKE = -4,0), wo sie
     hingehoert: von 30 cm unter der Gleissohle bis 30 cm ueber die
     Decke. */
  const stirnU = UB_GLEIS_TIEF - 0.3, stirnO = UB_DECKE + 0.3;
  for (const ex of [UB_X0 - 0.25, UB_X1 + 0.25]) {
    ubDeko(0.5, stirnO - stirnU, UB_QUER_Z1 - UB_QUER_Z0 + 1, ex,
         (stirnU + stirnO) / 2,
         (UB_QUER_Z0 + UB_QUER_Z1) / 2, 0x2a2f36);
    /* Das Hindernis muss GENAU so hoch sein wie die sichtbare Wand.
       Vorher reichte es von -10,6 bis -0,12, die Wand aber nur bis -3,7 -
       darueber standen 3,6 m unsichtbare Sperre. Und genau dort laeuft an
       den beiden aeussersten Stationen der Treppenschacht durch: man kam
       zwei Stufen weit und stiess gegen nichts. */
    ubCollider({ x0: ex - 0.25, x1: ex + 0.25, z0: UB_QUER_Z0 - 0.5,
                  z1: UB_QUER_Z1 + 0.5, h: stirnO, y0: stirnU,
                  keinKlettern: true });
  }
}

const ZUEGE = [];
const ZUG_WAGEN = 3;                        // Wagen je Zug
const ZUG_WLANG = 17.5, ZUG_LUECKE = 0.9;   // Laenge eines Wagens, Abstand
const ZUG_LANG = ZUG_WAGEN * ZUG_WLANG + (ZUG_WAGEN - 1) * ZUG_LUECKE;   // 53,3 m
const ZUG_BREIT = 2.6, ZUG_HOCH = 3.5;
/* Wagenboden auf Bahnsteighoehe - so steigt man eben ein, statt einen
   Dreivierteilmeter hinunterzuklettern. Gemessen vom Gleisbett aus. */
const ZUG_BODEN = UB_TIEF - UB_GLEIS_TIEF;   // 1,2 m ueber der Schiene
/* Sitzhoehe der Baenke. 48 cm waeren normal, aber dann haengen die Fuesse
   der Figuren 14 cm durch den Wagenboden - ihre Beine sind fuer eine so
   niedrige Bank zu lang. 58 cm ist der Wert, bei dem beides passt. */
const ZUG_BANK = 0.58;
const ZUG_HALT = 6.0;                        // Sekunden Aufenthalt je Station
const ZUG_TUER_X = [-4.6, 4.6];              // Tuerpaare je Wagen
const ZUG_TUER_B = 1.35;                     // Breite eines Tuerfluegels
/* Zwei Gleise nebeneinander im gemeinsamen Trog. */
const ZUG_Z = [UB_GLEIS_A, UB_GLEIS_B];

/* Ein Zug aus mehreren Wagen. Wagenkasten, Fenster, Boden und die
   sitzenden Fahrgaeste werden zu einer Geometrie verschmolzen; nur die
   Tuerfluegel bleiben beweglich (zwei Meshes je Zug, eins je
   Schieberichtung). */
function baueZug(farbe) {
  const fest = [];
  const frei = [];      // leere Sitzplaetze fuer echte Zivilisten
  const tuerL = [], tuerR = [];
  const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const kiste = (liste, w, h, d, x, y, z, f) =>
    liste.push({ geo: boxG(w, h, d), x, y, z, farbe: f });

  for (let w = 0; w < ZUG_WAGEN; w++) {
    const wx = (w - (ZUG_WAGEN - 1) / 2) * (ZUG_WLANG + ZUG_LUECKE);
    /* Wagenkasten: Boden, Dach, Stirnwaende, Seitenwaende ueber und unter
       dem Fensterband. Der Kasten ist HOHL - vorher war es ein voller
       Block, deshalb sah man beim Mitfahren durch den Boden auf die
       Schienen. */
    kiste(fest, ZUG_WLANG, 0.22, ZUG_BREIT, wx, ZUG_BODEN - 0.11, 0, 0x3a3f46);   // Boden
    kiste(fest, ZUG_WLANG, 0.2, ZUG_BREIT + 0.12, wx, ZUG_BODEN + ZUG_HOCH - 0.1, 0, 0x3a3f46);
    /* Deckenlicht: ohne das war der Innenraum eine schwarze Roehre. */
    kiste(fest, ZUG_WLANG - 1.2, 0.1, 0.55, wx, ZUG_BODEN + ZUG_HOCH - 0.24, 0, 0xfdfbf0);
    kiste(fest, ZUG_WLANG - 1.2, 0.16, 1.7, wx, ZUG_BODEN + ZUG_HOCH - 0.3, 0, 0xd8dde4);
    for (const s2 of [-1, 1]) {
      const zs = s2 * (ZUG_BREIT / 2 - 0.05);
      kiste(fest, ZUG_WLANG, 0.95, 0.1, wx, ZUG_BODEN + 0.48, zs, farbe);          // Bruestung
      kiste(fest, ZUG_WLANG, 0.85, 0.1, wx, ZUG_BODEN + ZUG_HOCH - 0.62, zs, farbe); // ueber dem Fenster
      kiste(fest, ZUG_WLANG - 2.4, 1.2, 0.06, wx, ZUG_BODEN + 1.55, zs, 0xcfe4f4);  // Fensterband
      /* Tuerrahmen und -fluegel */
      for (const tx of ZUG_TUER_X) {
        kiste(fest, 0.14, 2.35, 0.14, wx + tx - ZUG_TUER_B, ZUG_BODEN + 1.18, zs, 0x8fa6bc);
        kiste(fest, 0.14, 2.35, 0.14, wx + tx + ZUG_TUER_B, ZUG_BODEN + 1.18, zs, 0x8fa6bc);
        kiste(tuerL, ZUG_TUER_B, 2.3, 0.09, wx + tx - ZUG_TUER_B / 2, ZUG_BODEN + 1.18, zs, 0x2b3a48);
        kiste(tuerR, ZUG_TUER_B, 2.3, 0.09, wx + tx + ZUG_TUER_B / 2, ZUG_BODEN + 1.18, zs, 0x2b3a48);
      }
      /* Stirnwaende NUR ganz vorn und ganz hinten. Dazwischen bleibt der
         Zug offen und wird von einem Faltenbalg verbunden - vorher klaffte
         zwischen den Waggons eine Luecke, durch die man ins Freie sah. */
      if (w === 0 || w === ZUG_WAGEN - 1) {
        const sx = w === 0 ? -1 : 1;
        kiste(fest, 0.16, ZUG_HOCH, ZUG_BREIT, wx + sx * (ZUG_WLANG / 2 - 0.08),
              ZUG_BODEN + ZUG_HOCH / 2, 0, farbe);
        kiste(fest, 0.1, 1.0, ZUG_BREIT - 0.7, wx + sx * (ZUG_WLANG / 2 + 0.02),
              ZUG_BODEN + 2.2, 0, 0x0f1620);                                   // Frontscheibe
        kiste(fest, 0.1, 0.34, 1.5, wx + sx * (ZUG_WLANG / 2 + 0.02),
              ZUG_BODEN + 0.7, 0, 0xfff3c4);                                   // Scheinwerfer
      }
    }
    /* Drehgestelle. */
    for (const s2 of [-1, 1]) {
      kiste(fest, 2.8, 0.7, ZUG_BREIT - 0.5, wx + s2 * (ZUG_WLANG / 2 - 2.4),
            ZUG_BODEN - 0.55, 0, 0x1d2126);
    }
    /* Sitzbaenke laengs an den Waenden. Ein Teil der Plaetze wird mit
       einfachen Sitzfiguren aufgefuellt, die zum Wagen gehoeren; die
       uebrigen bleiben LEER und werden fuer echte Zivilisten gemerkt, die
       an einer Station einsteigen. Nur so sitzen im Zug wirklich dieselben
       Leute, die vorher am Bahnsteig gewartet haben. */
    for (const s2 of [-1, 1]) {
      const zs = s2 * (ZUG_BREIT / 2 - 0.34);
      kiste(fest, ZUG_WLANG - 3.2, 0.12, 0.5, wx, ZUG_BODEN + ZUG_BANK - 0.06, zs, 0x37414d);
      /* Hier wurden 45 % der Plaetze mit einfachen Sitzfiguren aufgefuellt.
         Im Wagen sass dadurch eine Mischung aus echten Zivilisten und
         Kloetzchenmenschen nebeneinander - und genau das faellt auf.
         Jetzt bleiben ALLE Plaetze frei; besetzt werden sie von echten
         Zivilisten: von denen, die an einer Station einsteigen, und von
         einer kleinen Mannschaft, die immer im naechstgelegenen Wagen
         mitfaehrt (siehe updateZugFahrgaeste). */
      for (let p = 0; p < 5; p++) {
        const px = wx - (ZUG_WLANG - 5.0) / 2 + p * ((ZUG_WLANG - 5.0) / 4);
        const ry = s2 < 0 ? 0 : Math.PI;          // Blick zur Wagenmitte
        frei.push({ dx: px, dz: zs, ry });
      }
    }
  }
  /* ---- Uebergaenge zwischen den Wagen ----
     Faltenbalg aussen, durchgehender Boden innen und ein Rahmen wie eine
     Tuer: so haengt der Zug zusammen wie ein echter. */
  for (let w = 0; w + 1 < ZUG_WAGEN; w++) {
    const gx = ((w - (ZUG_WAGEN - 1) / 2) + 0.5) * (ZUG_WLANG + ZUG_LUECKE);
    /* Der Balg war ein VOLLER Kasten quer durch den Zug: 1,3 x 3,0 x 2,25 m
       schwarz, mitten im Gang. Wer im Wagen stand, sah nur noch diesen
       Block und sich selbst gar nicht mehr. Jetzt ist er das, was er sein
       soll - eine Roehre: zwei Seitenwaende, ein Dach, der Boden liegt
       schon darunter. Durch die Mitte kann man gehen und sehen. */
    const balgH = ZUG_HOCH - 0.5;
    for (const s3 of [-1, 1]) {
      kiste(fest, ZUG_LUECKE + 0.4, balgH, 0.16, gx,
            ZUG_BODEN + balgH / 2, s3 * (ZUG_BREIT / 2 - 0.26), 0x22262b);
    }
    kiste(fest, ZUG_LUECKE + 0.4, 0.16, ZUG_BREIT - 0.35, gx,
          ZUG_BODEN + balgH - 0.08, 0, 0x22262b);
    /* Tuerrahmen an beiden Enden des Uebergangs, wie im echten Zug. */
    for (const s3 of [-1, 1]) {
      const rx = gx + s3 * (ZUG_LUECKE / 2 + 0.18);
      for (const s4 of [-1, 1]) {
        kiste(fest, 0.12, balgH - 0.3, 0.5, rx,
              ZUG_BODEN + (balgH - 0.3) / 2, s4 * (ZUG_BREIT / 2 - 0.45), 0x8fa6bc);
      }
      kiste(fest, 0.12, 0.14, ZUG_BREIT - 1.1, rx, ZUG_BODEN + balgH - 0.3, 0, 0x8fa6bc);
    }
    kiste(fest, ZUG_LUECKE + 0.5, 0.22, ZUG_BREIT - 0.5, gx, ZUG_BODEN - 0.11, 0, 0x3a3f46);
    for (const s2 of [-1, 1]) {
      kiste(fest, ZUG_LUECKE + 0.5, 0.12, 0.12, gx,
            ZUG_BODEN + ZUG_HOCH - 0.6, s2 * (ZUG_BREIT / 2 - 0.22), 0x8fa6bc);
    }
  }

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const g = new THREE.Group();
  g.userData.freieSitze = frei;
  const kasten = new THREE.Mesh(verschmelzeTeile(fest), mat);
  const links = new THREE.Mesh(verschmelzeTeile(tuerL), mat);
  const rechts = new THREE.Mesh(verschmelzeTeile(tuerR), mat);
  g.add(kasten); g.add(links); g.add(rechts);
  g.userData.tuerL = links;
  g.userData.tuerR = rechts;
  g.visible = false;
  scene.add(g);
  return g;
}

function baueZuege() {
  if (!UBAHNEN.length || ZUEGE.length) return;
  /* Je Linie zwei Zuege, einer in jede Richtung. */
  for (const linie of UB_LINIEN) {
    for (let i = 0; i < 2; i++) {
      ZUEGE.push({
        mesh: baueZug(i === 0 ? 0xb8352f : 0x2f5fb8),
        z: ZUG_Z[i] + linie.dz,
        x: i === 0 ? linie.statX[0] : linie.statX[linie.statX.length - 1],
        linie,
        richtung: i === 0 ? 1 : -1,
        tempo: 19 + i * 3,
        warten: 2 + i * 5 + linie.dz * 0.01,
        haltCd: 0,
        haelt: true,
        tuer: 0,          // 0 = zu, 1 = ganz offen
      });
    }
  }
}

/* Alles unter der Erde nur zeichnen, wenn man auch unten ist. Von der
   Strasse aus ist davon nichts zu sehen; es kostete trotzdem jedes Bild
   eine halbe Million Dreiecke und ein paar Dutzend Zeichenaufrufe. */
function updateUnterwelt() {
  const unten = player.pos.y < SLAB_H + 3;
  if (ubahnMesh && ubahnMesh.visible !== unten) ubahnMesh.visible = unten;
  for (const a of AUFZUEGE) {
    if (a.mesh.visible !== unten) a.mesh.visible = unten;
  }
}

let zugKlangCd = 0;
function updateZug(dt) {
  if (!ZUEGE.length) return;
  /* Unter Tage sichtbar, darueber nicht - spart Zeichenaufrufe. */
  const untenDrin = player.pos.y < SLAB_H;
  let naehe = 0;
  for (const t of ZUEGE) {
    /* Sichtbarkeit haengt NUR daran, ob man unter Tage ist. In der ersten
       Fassung wurde der Zug waehrend des Halts unsichtbar geschaltet - er
       verschwand also genau dann vor der Nase, wenn er im Bahnhof stand. */
    /* Nur der Zug der Linie, unter der man gerade steht - die anderen
       sind ohnehin hinter einer Tunnelwand. */
    t.mesh.visible = untenDrin && Math.abs(player.pos.z - (UB_Z + t.linie.dz)) < 70;
    if (t.warten > 0) {
      t.warten -= dt;
      t.haelt = true;
      if (t.warten <= 0) t.haelt = false;
    } else {
      t.x += t.richtung * t.tempo * dt;
      /* Halt an jeder Station - so kann man wirklich einsteigen. */
      if (t.haltCd > 0) t.haltCd -= dt;
      else for (const sx of t.linie.statX) {
        if (Math.abs(t.x - sx) < t.tempo * dt + 0.2) {
          t.x = sx; t.warten = ZUG_HALT; t.haltCd = 3.0; break;
        }
      }
      /* Am Ende der Linie umkehren. */
      if (t.x > t.linie.x1 - ZUG_LANG / 2) { t.x = t.linie.x1 - ZUG_LANG / 2; t.richtung = -1; t.warten = 4; }
      if (t.x < t.linie.x0 + ZUG_LANG / 2) { t.x = t.linie.x0 + ZUG_LANG / 2; t.richtung = 1; t.warten = 4; }
    }
    t.mesh.position.set(t.x, UB_GLEIS_TIEF, t.z);
    /* Tueren: im Halt gehen sie auf, vor der Abfahrt wieder zu. Die
       Fluegel schieben sich dabei auseinander. */
    const tuerZiel = t.haelt && t.warten > 0.9 ? 1 : 0;
    t.tuer = lerp(t.tuer, tuerZiel, Math.min(1, dt * 3.5));
    if (t.mesh.userData.tuerL) {
      const weg = t.tuer * (ZUG_TUER_B - 0.16);
      t.mesh.userData.tuerL.position.x = -weg;
      t.mesh.userData.tuerR.position.x = weg;
    }
    /* Wer am Bahnsteig wartet, steigt bei offener Tuer ein. */
    if (t.haelt && t.tuer > 0.7) {
      for (const c of civilians) {
        if (c.bahnsteig === undefined || c.eingestiegen > 0) continue;
        if (c.pos.y > UB_TIEF + 1) continue;               // gerade auf der Treppe
        if (Math.abs(c.pos.x - t.x) > ZUG_LANG / 2) continue;
        if (Math.abs(c.pos.z - t.z) > 4.5) continue;
        if (Math.random() > dt * 0.9) continue;        // nach und nach
        c.eingestiegen = rand(14, 30);
        /* Einen freien Platz im Wagen suchen. Gibt es keinen, faehrt die
           Figur wie bisher unsichtbar mit - stehen im Gang waere zwar
           realistisch, aber die Figuren haben dafuer keine Haltung. */
        const plaetze = t.mesh.userData.freieSitze || [];
        if (!t.besetzt) t.besetzt = new Set();
        let idx = -1;
        for (let v = 0; v < 8 && idx < 0; v++) {
          const k = randi(0, plaetze.length - 1);
          if (plaetze.length && !t.besetzt.has(k)) idx = k;
        }
        if (idx >= 0) {
          t.besetzt.add(idx);
          c.zugFahrt = t; c.sitzIdx = idx;
          c.visual.root.visible = true;
        } else {
          c.zugFahrt = null; c.sitzIdx = -1;
          c.visual.root.visible = false;
        }
      }
    }
    if (!untenDrin) continue;

    const dx = Math.abs(player.pos.x - t.x);
    naehe = Math.max(naehe, clamp(1 - (dx - ZUG_LANG / 2) / 45, 0, 1));
    /* Mitfahren: wer beim Losfahren im Wagen steht, faehrt mit. */
    const imWagen = dx < ZUG_LANG / 2 - 0.4 &&
                    Math.abs(player.pos.z - t.z) < ZUG_BREIT / 2 &&
                    player.pos.y > UB_TIEF - 0.5 && player.pos.y < UB_TIEF + 3.2;
    if (imWagen && player.zug !== t) {
      player.zug = t;
      popupScreen('🚇 Mitfahren – springen zum Aussteigen');
    }
    /* Treffer nur, wenn man neben dem Zug im Trog steht. */
    const imTrog = player.pos.z > UB_GLEIS_Z0 && player.pos.z < UB_GLEIS_Z1 &&
                   player.pos.y < UB_TIEF - 0.2 && player.pos.y > UB_GLEIS_TIEF - 1;
    if (!t.haelt && player.zug !== t && imTrog && dx < ZUG_LANG / 2 + 0.8 &&
        Math.abs(player.pos.z - t.z) < ZUG_BREIT / 2 + 0.6) {
      /* Auf den Bahnsteig schieben statt zu ueberfahren. */
      player.pos.z = UB_STEIG_Z0 + 1.4;
      player.pos.y = UB_TIEF + 0.1;
      player.vel.set(t.richtung * 6, 4, 3);
      damagePlayer(8, null);
      camShake = Math.max(camShake, 0.3);
      popupScreen('🚇 Weg vom Gleis!');
    }
  }
  /* Mitfahrt: die Figur haengt am Wagen, bis sie springt oder aussteigt. */
  if (player.zug) {
    const t = player.zug;
    const raus = !untenDrin || player.dead || !player.onGround ||
                 Math.abs(player.pos.x - t.x) > ZUG_LANG / 2 ||
                 Math.abs(player.pos.z - t.z) > ZUG_BREIT / 2 + 0.6;
    if (raus) player.zug = null;
    else if (!t.haelt) player.pos.x += t.richtung * t.tempo * dt;
  }
  if (untenDrin && naehe > 0.05) {
    zugKlangCd -= dt;
    if (zugKlangCd <= 0) { zugKlangCd = 0.55; SFX.zug(naehe); }
  }
}

/* ---- Häuser als Sammel-Mesh ----
   Vorher bekam jedes Haus eine eigene Kopie der Fassadentextur und zwei
   eigene Materialien. Bei rund 200 Häusern waren das über 200 Texturen im
   Grafikspeicher und ebenso viele Zeichenaufrufe. Jetzt wird die Kachelung
   direkt in die UV-Koordinaten gerechnet; dadurch reichen drei Texturen und
   alle Wände einer Textur landen in einem einzigen Mesh. */
/* Zusätzlich nach Kacheln von 110 m sortiert: so bleibt die Sichtprüfung
   der Grafikkarte wirksam und es wird nie die ganze Stadt gezeichnet. */
const HAUS_KACHEL = 200;
const hausWaende = new Map();   // "texIdx|kx|kz" -> Geometrien
const hausDaecher = new Map();  // "kx|kz"        -> Geometrien
function kachelSchluessel(x, z) {
  return Math.floor(x / HAUS_KACHEL) + '|' + Math.floor(z / HAUS_KACHEL);
}
function inEimer(map, schluessel, geo) {
  let l = map.get(schluessel);
  if (!l) { l = []; map.set(schluessel, l); }
  l.push(geo);
}

function sammleHausBox(w, h, d, x, y, z, texIdx) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const uv = g.attributes.uv;
  /* Kachelung pro Seite: waagerecht nach der tatsächlichen Breite der
     Seite, senkrecht nach der Höhe. So werden schmale Seiten nicht mehr
     gestreckt wie früher. */
  const kx = Math.max(1, Math.round(w / 8)), kz = Math.max(1, Math.round(d / 8));
  const ky = Math.max(1, Math.round(h / 12));
  const proGruppe = 6;
  const skal = [
    [kz, ky], [kz, ky],   // +x / -x  (Breite = Tiefe)
    [1, 1], [1, 1],       // Dach / Boden
    [kx, ky], [kx, ky],   // +z / -z
  ];
  for (let f = 0; f < 6; f++) {
    const [sx, sy] = skal[f];
    for (let i = f * proGruppe; i < (f + 1) * proGruppe; i++) {
      uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
    }
  }
  g.translate(x, y, z);
  /* Wände (Seiten) und Dachflächen trennen. */
  const wand = new THREE.BufferGeometry();
  const dach = new THREE.BufferGeometry();
  const teile = (indizes) => {
    const p = [], n = [], u = [];
    const gp = g.attributes.position, gn = g.attributes.normal;
    for (const f of indizes) {
      for (let i = f * proGruppe; i < (f + 1) * proGruppe; i++) {
        p.push(gp.getX(i), gp.getY(i), gp.getZ(i));
        n.push(gn.getX(i), gn.getY(i), gn.getZ(i));
        u.push(uv.getX(i), uv.getY(i));
      }
    }
    return { p, n, u };
  };
  const tw = teile([0, 1, 4, 5]), td = teile([2, 3]);
  wand.setAttribute('position', new THREE.Float32BufferAttribute(tw.p, 3));
  wand.setAttribute('normal', new THREE.Float32BufferAttribute(tw.n, 3));
  wand.setAttribute('uv', new THREE.Float32BufferAttribute(tw.u, 2));
  dach.setAttribute('position', new THREE.Float32BufferAttribute(td.p, 3));
  dach.setAttribute('normal', new THREE.Float32BufferAttribute(td.n, 3));
  dach.setAttribute('uv', new THREE.Float32BufferAttribute(td.u, 2));
  const k = kachelSchluessel(x, z);
  inEimer(hausWaende, texIdx + '|' + k, wand);
  inEimer(hausDaecher, k, dach);
  g.dispose();
}

function fasseGeometrien(liste) {
  let n = 0;
  for (const g of liste) n += g.attributes.position.count;
  const p = new Float32Array(n * 3), nn = new Float32Array(n * 3), u = new Float32Array(n * 2);
  let o = 0;
  for (const g of liste) {
    p.set(g.attributes.position.array, o * 3);
    nn.set(g.attributes.normal.array, o * 3);
    u.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(u, 2));
  out.computeBoundingSphere();
  return out;
}

function baueHausMeshes() {
  /* Ein Material je Fassadentextur – alle Kacheln teilen es sich. */
  const wandMats = facadeTexes.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const dachMat = new THREE.MeshLambertMaterial({ map: roofTex });
  for (const [schluessel, liste] of hausWaende) {
    if (!liste.length) continue;
    const m = new THREE.Mesh(fasseGeometrien(liste), wandMats[+schluessel.split('|')[0]]);
    m.castShadow = true; m.receiveShadow = true;
    cityGroup.add(m);
    HAUS_FASSADEN.push(m);
  }
  for (const [, liste] of hausDaecher) {
    if (!liste.length) continue;
    const m = new THREE.Mesh(fasseGeometrien(liste), dachMat);
    m.castShadow = true; m.receiveShadow = true;
    cityGroup.add(m);
    /* Die Dachplatten gehoeren zur selbstgebauten Kiste und muessen mit
       ihr verschwinden, sobald echte Gebaeudemodelle stehen. Vorher blieben
       sie sichtbar: das Modell bringt sein eigenes Dach mit, die alte
       Platte lag genau darauf und flimmerte dagegen an. */
    HAUS_FASSADEN.push(m);
  }
  hausWaende.clear(); hausDaecher.clear();
}

/* Jedes Haus wird gemerkt: Grundriss, Hoehe, Ort. Sobald der Haeusersatz
   geladen ist, wird ueber jede dieser Kisten ein echtes Gebaeudemodell
   gestellt (siehe setzeHausModelle). Die KOLLISION bleibt die Kiste - sie
   ist es, an der geklettert, geschwungen und angestossen wird. Deshalb
   aendert sich am Spielgefuehl nichts, nur am Bild. */
const HAUS_KISTEN = [];
const HAUS_FASSADEN = [];        // die selbstgebauten Fassadenmeshes
function makeBuildingMesh(w, h, d, x, z) {
  const texIdx = randi(0, facadeTexes.length - 1);
  HAUS_KISTEN.push({ w, h, d, x, z });
  sammleHausBox(w, h, d, x, SLAB_H + h / 2, z, texIdx);
  /* Die Häuserkollision endet einen Meter unter der Straße. Ohne diese
     Untergrenze reicht sie beliebig tief ins Erdreich – in der U-Bahn-
     Station stand man dadurch an einer unsichtbaren Hauswand und kletterte
     daran wieder ans Tageslicht. */
  addCollider({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2,
                h: SLAB_H + h, y0: -1.0 });
  /* Hohe Häuser bekommen Staffelgeschosse: Der Turm wird nach oben
     schmaler, statt als glatter Quader zu enden. Jede Stufe ist ein
     eigenes Hindernis, an dem man auch klettern kann.
     WICHTIG: die Masse werden VOR dem Schmuecken bestimmt. Vorher setzte
     schmueckeHaus() Reklametafel, Antenne und Klimageraete in die Mitte
     des Daches - und genau dort wuchs anschliessend der Staffelturm aus
     dem Dach. Gemessen steckten 10 von 34 Tafeln im eigenen Turm; auf dem
     Bild ragte eine gruene Tafel mitten durch die Fassade. Jetzt kennt
     das Schmuecken die Grundflaeche des Turms und laesst sie frei. */
  /* ---- Keine Staffeltuerme mehr ----
     Sie stammen aus der Zeit der selbstgebauten Quader. Das echte
     Gebaeudemodell wird auf die GRUNDKISTE skaliert und hoert an ihrer
     Oberkante auf; der Staffelturm darueber wurde beim Umstellen
     unsichtbar - sein Hindernis und sein Gesims blieben aber stehen.
     Auf dem Bild schwebten dadurch graue Dachplatten in der Luft, und
     ueber jedem hohen Haus stand eine unsichtbare Wand. Beides ist damit
     weg; die Silhouette bringt jetzt das Modell selbst mit. */
  schmueckeHaus(w, h, d, x, z, null);
  /* Das ganze Dach ist frei - es steht nichts mehr darauf, was Platz
     braeuchte. */
  const dachPlatz = (rand2) => ({
    px: x + rand(-w / 2 + rand2, w / 2 - rand2),
    pz: z + rand(-d / 2 + rand2, d / 2 - rand2),
  });
  // Dachaufbauten – gehen ins gemeinsame Deko-Mesh
  if (Math.random() < 0.6) {
    const bh = rand(1, 2);
    const pl = dachPlatz(2.0, 1.6);
    if (pl) deko(rand(1.5, 3), bh, rand(1.5, 3), pl.px, SLAB_H + h + bh / 2, pl.pz, 0x777d84);
  }
  /* Ein paar echte Klimageraete auf dem Dach - beim Schwingen sieht man
     jedes Dach von oben, dort stand bisher nur ein Kasten. */
  if (Math.random() < 0.7) {
    const n = randi(1, 3);
    for (let i = 0; i < n; i++) {
      const pl = dachPlatz(1.0, 0.8);
      if (pl) merkeTeil('Prop_ACUnit', pl.px, SLAB_H + h, pl.pz, rand(0, TAU));
    }
  }
  if (h > 55 && Math.random() < 0.5) {
    /* Wasserturm: alle Türme teilen sich eine Geometrie und werden als
       Instanzen gezeichnet – das kostet zusammen einen Zeichenaufruf. */
    const pl = dachPlatz(2.2, 1.5);
    if (pl) wassertuerme.push({ x: pl.px, y: SLAB_H + h, z: pl.pz });
  }
}

/* ---- Wassertürme als Instanzen ---- */
const wassertuerme = [];
/* (Die Schaufenster im Erdgeschoss sind entfallen - siehe schmueckeHaus.) */

function baueWassertuerme() {
  if (!wassertuerme.length) return;
  const teile = [];
  const nimm = (geo, farbe, dy, dx, dz) => {
    const g = geo.toNonIndexed();
    g.translate(dx || 0, dy, dz || 0);
    const n = g.attributes.position.count;
    const f = new Float32Array(n * 3);
    const c = new THREE.Color(farbe);
    for (let i = 0; i < n; i++) { f[i * 3] = c.r; f[i * 3 + 1] = c.g; f[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(f, 3));
    teile.push(g);
    geo.dispose();
  };
  nimm(new THREE.CylinderGeometry(1.4, 1.6, 2.6, 10), 0x7a5a3a, 2.6);
  nimm(new THREE.ConeGeometry(1.7, 1, 10), 0x5d452f, 4.4);
  for (let i = 0; i < 4; i++) {
    nimm(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 5), 0x3a3a3a, 0.8,
      Math.cos(i * Math.PI / 2 + 0.8) * 1.1, Math.sin(i * Math.PI / 2 + 0.8) * 1.1);
  }
  let n = 0;
  for (const g of teile) n += g.attributes.position.count;
  const p = new Float32Array(n * 3), nn = new Float32Array(n * 3), cc = new Float32Array(n * 3);
  let o = 0;
  for (const g of teile) {
    p.set(g.attributes.position.array, o * 3);
    nn.set(g.attributes.normal.array, o * 3);
    cc.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  geo.computeBoundingSphere();
  const mesh = new THREE.InstancedMesh(geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }), wassertuerme.length);
  const m = new THREE.Matrix4();
  wassertuerme.forEach((t, i) => { m.makeTranslation(t.x, t.y, t.z); mesh.setMatrixAt(i, m); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  cityGroup.add(mesh);
}

/* Ein Block aus fertigen Haeusern des Baukastens. Sie werden nicht aus
   Wandstuecken zusammengesetzt - das waere um ein Vielfaches teurer als
   die selbstgebauten Quader (gemessen: eine Fassade aus Fensterstuecken
   kostet rund 45.000 Dreiecke je Haus, ein selbstgebautes ein paar
   tausend). Die drei fertigen Haeuser sind mit 18.000 bis 45.000
   Dreiecken der guenstige Weg zu echter Bauform. */
function baueAltbauBlock(cx, cz, size) {
  const halb = size / 2;
  const gesetzt = [];
  /* An den vier Blockkanten aufgereiht, Schauseite zur Strasse - so sind
     diese Bausteine gedacht, und so verschwinden die Brandwaende dorthin,
     wo sie hingehoeren: an den Nachbarn. */
  const kanten = [
    { nx: 0, nz: -1, ry: Math.PI },      // Sued
    { nx: 0, nz: 1, ry: 0 },             // Nord
    { nx: -1, nz: 0, ry: -Math.PI / 2 }, // West
    { nx: 1, nz: 0, ry: Math.PI / 2 },   // Ost
  ];
  for (let versuch = 0; versuch < 40 && gesetzt.length < 5; versuch++) {
    const t = pick(KIT_HAEUSER);
    const k = kanten[versuch % kanten.length];
    const ry = k.ry + t.dreh;
    /* Erst den gedrehten Kasten um den Ursprung bestimmen, dann so
       verschieben, dass er innen an der Blockkante sitzt. */
    const roh = kitKasten(t, 0, 0, ry);
    const bw = roh.x1 - roh.x0, bd = roh.z1 - roh.z0;
    const laengs = rand(-halb + Math.max(bw, bd) / 2, halb - Math.max(bw, bd) / 2);
    /* nx/nz zeigt nach aussen: die Aussenkante des Hauses soll dort liegen. */
    const x = k.nx ? cx + k.nx * (halb - 0.4) - (k.nx > 0 ? roh.x1 : roh.x0)
                   : cx + laengs - (roh.x0 + roh.x1) / 2;
    const z = k.nz ? cz + k.nz * (halb - 0.4) - (k.nz > 0 ? roh.z1 : roh.z0)
                   : cz + laengs - (roh.z0 + roh.z1) / 2;
    const kasten = kitKasten(t, x, z, ry);
    if (gesetzt.some((r) => kasten.x1 > r.x0 - 1.2 && kasten.x0 < r.x1 + 1.2 &&
                            kasten.z1 > r.z0 - 1.2 && kasten.z0 < r.z1 + 1.2)) continue;
    gesetzt.push(kasten);
    merkeHaus(t.name, x, SLAB_H, z, ry);
    /* Das Modell bringt kein Hindernis mit - es wird hier gebaut, mit
       einem Durchgang in der Tuer. */
    kitHindernis(t, x, z, ry, kasten);
    /* Dachaufbauten wie bei den anderen Haeusern. */
    if (Math.random() < 0.6) {
      merkeTeil('Prop_ACUnit', rand(kasten.x0 + 1.5, kasten.x1 - 1.5), SLAB_H + t.h,
                rand(kasten.z0 + 1.5, kasten.z1 - 1.5), rand(0, TAU));
    }
  }
}

function buildBlockBuildings(cx, cz, loecher) {
  // Höher Richtung Stadtmitte
  const centerBias = 1 - Math.min(1, (Math.abs(cx) + Math.abs(cz)) / 300);
  const style = Math.random();
  const inner = PITCH - ROAD_HALF * 2 - 8; // bebaubare Fläche (30)

  /* Häuser standen teils fast aneinander – zwischen Erdgeschoss-Sockel und
     Vordach (beide über die Fassade hinaus) blieb dann gar kein Spalt mehr.
     Jeder Bauplatz wird deshalb gegen die schon gesetzten geprüft und nur
     mit genug Luft bebaut. */
  const gesetzt = [];
  /* Ein Treppenschacht ist ein besetzter Bauplatz. Vorher wusste der
     Haeuserbau nichts davon: das Bauband endet auf cz +/- 15, der Schacht
     beginnt auf 15,6 - zusammen mit dem 53 cm vorstehenden Vordach stand
     der Laden also praktisch auf der obersten Stufe. Der Schacht wird
     deshalb mit 1,6 m Zuschlag als belegt eingetragen; mit den 2,6 m
     Mindestabstand bleiben ueber vier Meter Gehweg vor dem Eingang. */
  for (const l of (loecher || [])) {
    gesetzt.push({ x: (l.x0 + l.x1) / 2, z: (l.z0 + l.z1) / 2,
                   w: l.x1 - l.x0 + 3.2, d: l.z1 - l.z0 + 3.2 });
  }
  const passt = (w, d, x, z) => {
    const luft = 2.6;
    for (const r of gesetzt) {
      if (Math.abs(x - r.x) < (w + r.w) / 2 + luft &&
          Math.abs(z - r.z) < (d + r.d) / 2 + luft) return false;
    }
    return true;
  };
  const setze = (w, h, d, x, z) => {
    if (!passt(w, d, x, z)) return false;
    gesetzt.push({ w, d, x, z });
    makeBuildingMesh(w, h, d, x, z);
    return true;
  };

  if (style < 0.3) {
    // Ein großer Turm
    const w = rand(inner * 0.6, inner * 0.88), d = rand(inner * 0.6, inner * 0.88);
    const h = rand(35, 60) + centerBias * rand(20, 55);
    setze(w, h, d, cx + rand(-2, 2), cz + rand(-2, 2));
  } else if (style < 0.75) {
    // 2x2 Gebäude
    const off = inner / 4 + 2.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (Math.random() < 0.12) continue; // kleine Plaza
      const w = rand(8, 11), d = rand(8, 11);
      const h = rand(16, 40) + centerBias * rand(5, 45);
      setze(w, h, d, cx + sx * off + rand(-0.8, 0.8), cz + sz * off + rand(-0.8, 0.8));
    }
  } else {
    // Zeile aus 3 Gebäuden
    const vert = Math.random() < 0.5;
    for (let k = -1; k <= 1; k++) {
      const w = vert ? rand(9, 12) : rand(6.5, 8.5);
      const d = vert ? rand(6.5, 8.5) : rand(9, 12);
      const h = rand(14, 34) + centerBias * rand(0, 30);
      setze(w, h, d, cx + (vert ? rand(-2, 2) : k * 11.5), cz + (vert ? k * 11.5 : rand(-2, 2)));
    }
  }
}

/* ---- Feste Punkte, an denen sich der Netz-Zug festhaelt ----
   Laternen und Ampelmasten stehen fest im Boden. Sie kommen nicht zur
   Figur, die Figur kommt zu IHNEN - genau wie beim Netz-Zip, samt dem
   Absprung im richtigen Moment. Lose Sachen wie Muelltonnen liegen in
   ZIEH und werden umgekehrt behandelt. */
const ZIEH_FEST = [];
/* Oben auf jedem dieser Punkte laesst sich stehen. Ohne diese kleine
   Standflaeche zog einen das Netz zwar hin, aber es gab dort nichts, worauf
   man landen konnte - man flog daran vorbei und fiel weiter. */
function ziehFestPunkt(x, y, z) {
  ZIEH_FEST.push(V3(x, y, z));
  addCollider({ x0: x - 0.34, x1: x + 0.34, z0: z - 0.34, z1: z + 0.34,
                h: y, y0: y - 0.5, klein: true, keinKlettern: true });
}
function addLamp(x, z) {
  ziehFestPunkt(x, SLAB_H + 4.0, z);
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x2c2f33 }));
  pole.position.y = 2.2; g.add(pole);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
  head.position.y = 4.4; g.add(head);
  g.position.set(x, SLAB_H, z);
  cityGroup.add(g);
}

let waterMesh = null;
function buildRiverAndBridge() {
  // Wasser
  waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(RIVER_X1 - RIVER_X0 + 10, 400),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.93 })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set((RIVER_X0 + RIVER_X1) / 2, WATER_Y + 0.1, 0);
  cityGroup.add(waterMesh);

  // Uferkante (Kaimauer)
  const quayMat = new THREE.MeshLambertMaterial({ color: 0x6b6f75 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 400), quayMat);
  quay.position.set(RIVER_X0 - 2, -2, 0);
  cityGroup.add(quay);
  const quay2 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 400), quayMat);
  quay2.position.set(SHORE_X0 + 2, -2, 0);
  cityGroup.add(quay2);

  /* ---- Uferpromenade ----
     Zwischen der letzten Querstraße (x = 175) und der Kaimauer lag eine
     rund elf Meter breite, völlig leere helle Fläche. Aus der Ferne sah
     das aus wie ein Fehler in der Karte. Jetzt liegt dort eine Promenade:
     dunkleres Pflaster, ein Bordstein zur Straße, Bäume, Bänke und
     Laternen entlang des Wassers. */
  const PROM_X1 = RIVER_X0;
  const prom = new THREE.Mesh(
    new THREE.PlaneGeometry(PROM_X1 - PROM_X0, 400),
    new THREE.MeshLambertMaterial({ map: wegTex }));
  prom.rotation.x = -Math.PI / 2;
  prom.position.set((PROM_X0 + PROM_X1) / 2, SLAB_H + 0.008, 0);
  prom.receiveShadow = true;
  cityGroup.add(prom);
  /* Sockel, damit die Promenade wie ein Gehweg über der Straße liegt. */
  deko(PROM_X1 - PROM_X0, SLAB_H * 2, 400, (PROM_X0 + PROM_X1) / 2, 0, 0, 0x9aa0a6);
  /* Bordstein zur Straße hin - aber NICHT vor der Bruecke. Dort faehrt
     man auf die Bruecke, und ein 38 cm hoher Bordstein quer ueber der
     Auffahrt waere genau die Kante, die es zu vermeiden gilt. */
  for (const [a, b] of [[-200, BRIDGE_Z - BRIDGE_HW], [BRIDGE_Z + BRIDGE_HW, 200]]) {
    deko(0.4, 0.34, b - a, PROM_X0, SLAB_H - 0.04, (a + b) / 2, 0x7c8288);
  }

  const kroneMatU = new THREE.MeshLambertMaterial({ color: 0x2f6b38 });
  for (let z = -190; z < 190; z += 8) {
    if (Math.abs(z - BRIDGE_Z) < BRIDGE_HW + 3) continue;
    /* Frueher stand hier ein durchgehender dunkler Riegel als "Gelaender".
       Massiv und mannshoch sah er nicht wie ein Gelaender aus, sondern wie
       eine Mauer quer ueber die Uferstrasse - und er verstellte den Blick
       aufs Wasser. Die Kante bleibt jetzt offen. */
    /* Alle 24 m ein Baum mit Bank, dazwischen eine Laterne. */
    const takt = Math.round((z + 190) / 8) % 3;
    if (takt === 0) {
      const bx = PROM_X0 + 4.5, bz = z + 3.5;
      deko(0.5, 3.2, 0.5, bx, SLAB_H + 1.6, bz, 0x5a4028);
      const krone = new THREE.Mesh(new THREE.SphereGeometry(rand(1.7, 2.3), 7, 6), kroneMatU);
      krone.position.set(bx, SLAB_H + rand(3.8, 4.4), bz);
      krone.castShadow = true;
      cityGroup.add(krone);
      addCollider({ x0: bx - 0.4, x1: bx + 0.4, z0: bz - 0.4, z1: bz + 0.4,
                    h: SLAB_H + 3.2, klein: true });
    } else if (takt === 1) {
      baueBank(PROM_X1 - 3.2, SLAB_H, z + 3.5, true);      // Blick aufs Wasser
    } else {
      addLamp(PROM_X0 + 2.0, z + 3.5);
    }
  }

  /* Brücke. Fahrbahn und Geländer beginnen erst dort, wo die Brücke
     wirklich anfängt (x = BR_X0). Vorher ragten die knallroten Geländer
     bis weit in die Stadtstraße hinein und standen als große rote Keile
     mitten auf der Fahrbahn – genau das war der Fehler vor der Brücke. */
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BR_X1 - BR_X0, 0.6, BRIDGE_HW * 2),
    new THREE.MeshLambertMaterial({ map: asphaltTex }));
  deck.position.set((BR_X0 + BR_X1) / 2, 0, BRIDGE_Z);
  deck.receiveShadow = true; deck.castShadow = true;
  cityGroup.add(deck);
  // Mittelstreifen, damit die Brücke als Straße lesbar bleibt
  for (let x = BR_X0 + 5; x < BR_X1 - 5; x += 9) {
    deko(3.6, 0.04, 0.35, x, BR_HOCH + 0.02, BRIDGE_Z, 0xd9c979);
  }
  /* Sanfte Auffahrt an beiden Enden. Sie liegt VOR der Bruecke, auf der
     Strasse - genau in dem Stueck, das bridgeY() ansteigen laesst.
     Frueher war sie um 0,05 in die FALSCHE Richtung gekippt (das hohe
     Ende zeigte zur Strasse), und die westliche lag ausserdem unter dem
     erhoehten Gehweg der Promenade. */
  for (const [xm, dir] of [[BR_X0 - BR_RAMPE / 2, -1], [BR_X1 + BR_RAMPE / 2, 1]]) {
    const rampe = new THREE.Mesh(new THREE.BoxGeometry(BR_RAMPE, 0.6, BRIDGE_HW * 2),
      new THREE.MeshLambertMaterial({ map: asphaltTex }));
    rampe.position.set(xm, BR_HOCH / 2 - 0.3, BRIDGE_Z);
    rampe.rotation.z = -dir * (BR_HOCH / BR_RAMPE);
    rampe.receiveShadow = true;
    cityGroup.add(rampe);
  }
  for (const s of [-1, 1]) {
    const zr = BRIDGE_Z + s * (BRIDGE_HW - 0.25);
    // schlanker Handlauf statt massiver Wand
    for (const hy of [1.05, 0.62]) {
      deko(BR_X1 - BR_X0, 0.14, 0.16, (BR_X0 + BR_X1) / 2, hy + BR_HOCH, zr, 0x9a3a3a);
    }
    for (let x = BR_X0 + 2; x < BR_X1; x += 4.5) {
      deko(0.16, 1.15, 0.16, x, 0.85 + BR_HOCH, zr, 0x6f2b2b);
    }
    /* Unsichtbare Brüstung: man fällt nicht mehr einfach seitlich von der
       Brücke ins Wasser, sondern stößt am Geländer an. */
    addCollider({ x0: BR_X0, x1: BR_X1, z0: zr - 0.25, z1: zr + 0.25, h: 1.4 + BR_HOCH });
  }
  /* ---- Seilebene ----
     Die Tragseile laufen ueber die Pylonen, also ein Stueck AUSSERHALB
     der Fahrbahn. Damit die Haenger nicht ueber dem Wasser enden, traegt
     die Bruecke dort einen Randtraeger - so wie eine echte Haengebruecke,
     bei der die Querträger unter der Fahrbahn bis zur Seilebene reichen. */
  const SEIL_Z = BRIDGE_HW + 0.5;
  for (const s of [-1, 1]) {
    deko(BR_X1 - BR_X0, 0.34, 2.4, (BR_X0 + BR_X1) / 2, BR_HOCH - 0.17,
         BRIDGE_Z + s * (BRIDGE_HW + 0.2), 0x7a3232);
  }
  // Pylonen
  const pylMat = new THREE.MeshLambertMaterial({ color: 0x8e3b3b });
  const PYL_X = [225, 285], PYL_TOP = 44;
  for (const px of PYL_X) {
    for (const s of [-1, 1]) {
      const py = new THREE.Mesh(new THREE.BoxGeometry(3, 46, 3), pylMat);
      py.position.set(px, PYL_TOP - 23, BRIDGE_Z + s * SEIL_Z);
      py.castShadow = true;
      cityGroup.add(py);
      addCollider({ x0: px - 1.5, x1: px + 1.5, z0: py.position.z - 1.5,
                    z1: py.position.z + 1.5, h: PYL_TOP });
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(3, 3, SEIL_Z * 2 + 3), pylMat);
    cross.position.set(px, 40, BRIDGE_Z);
    cityGroup.add(cross);
  }
  /* ---- Tragseile ----
     Die alte Formel rechnete zwischen den Pylonen
       y = 40 + ((x-255)/30)^2 * 22 + 18
     und lieferte damit 58 m in der Mitte und 80 m an den Pylonen - das
     Seil schwebte also weit UEBER den 44 m hohen Pylonen und beruehrte
     die Bruecke nirgends. Genau das waren die "Seile in der Luft".
     Jetzt haengt es, wie es soll: von der Fahrbahn am Brueckenanfang
     hinauf auf die Pylonspitze, dazwischen in einer Parabel durch, und
     Haenger verbinden es mit dem Randtraeger. */
  const SEIL_TOP = 39, SEIL_DURCH = 11;
  const seilY = (x) => {
    if (x <= PYL_X[0]) return lerp(BR_HOCH + 0.9, SEIL_TOP,
                                   clamp((x - BR_X0) / (PYL_X[0] - BR_X0), 0, 1));
    if (x >= PYL_X[1]) return lerp(SEIL_TOP, BR_HOCH + 0.9,
                                   clamp((x - PYL_X[1]) / (BR_X1 - PYL_X[1]), 0, 1));
    const m = (PYL_X[0] + PYL_X[1]) / 2, hw = (PYL_X[1] - PYL_X[0]) / 2;
    const t = (x - m) / hw;
    return SEIL_DURCH + (SEIL_TOP - SEIL_DURCH) * t * t;
  };
  for (const s of [-1, 1]) {
    const zc = BRIDGE_Z + s * SEIL_Z;
    let px = BR_X0, py = seilY(BR_X0);
    for (let x = BR_X0 + 2.5; x <= BR_X1 + 0.01; x += 2.5) {
      const xx = Math.min(x, BR_X1), yy = seilY(xx);
      const dx = xx - px, dy = yy - py;
      deko(Math.hypot(dx, dy), 0.24, 0.24, (px + xx) / 2, (py + yy) / 2, zc,
           0x23262b, 0, Math.atan2(dy, dx));
      px = xx; py = yy;
    }
    /* Haenger. Nur dort, wo das Seil hoch genug ueber der Fahrbahn
       laeuft - sonst stuenden an den Enden lauter Stummel. */
    for (let x = BR_X0 + 5; x < BR_X1 - 3; x += 5) {
      const y = seilY(x);
      if (y < BR_HOCH + 2.2) continue;
      deko(0.16, y - BR_HOCH, 0.16, x, (BR_HOCH + y) / 2, zc, 0x2c3038);
    }
  }
}

function buildFarShore() {
  /* Asphalt statt einer nackten grauen Platte – das andere Ufer ist jetzt
     ein eigener Stadtteil mit Straßenraster, Gehwegen, Häusern, Laternen
     und einer Uferpromenade. */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SHORE_X1 - SHORE_X0 + 60, 420),
    new THREE.MeshLambertMaterial({ map: asphaltTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((SHORE_X0 + SHORE_X1) / 2 + 14, 0, 0);
  ground.receiveShadow = true;
  cityGroup.add(ground);

  /* Fahrbahnmarkierungen auf den Uferstraßen. Sie wandern ins gemeinsame
     Sammel-Mesh, sonst kämen allein hier über 150 einzelne Zeichenaufrufe
     zusammen und die Bildrate würde spürbar einbrechen. */
  for (let bi = 0; bi <= SHORE_NX; bi++) {
    const L = SHORE_OX + bi * SHORE_PITCH;
    for (let z = SHORE_OZ + 6; z < SHORE_OZ + SHORE_NZ * SHORE_PITCH - 6; z += 9) {
      if (Math.abs(z - BRIDGE_Z) < 10) continue;
      deko(0.35, 0.04, 3.6, L, 0.02, z, 0xd9c979);
    }
  }
  for (let bj = 0; bj <= SHORE_NZ; bj++) {
    const L = SHORE_OZ + bj * SHORE_PITCH;
    for (let x = SHORE_OX + 6; x < SHORE_OX + SHORE_NX * SHORE_PITCH - 6; x += 9) {
      deko(3.6, 0.04, 0.35, x, 0.02, L, 0xd9c979);
    }
  }

  // Blöcke: Gehwegsockel + Häuser (dieselben Bausteine wie in der Stadt)
  const slabGeo = new THREE.BoxGeometry(1, SLAB_H * 2, 1);
  const slabMat = new THREE.MeshLambertMaterial({ map: sidewalkTex });
  const innen = SHORE_PITCH - SHORE_ROAD * 2;          // bebaubare Fläche (22)
  for (let bi = 0; bi < SHORE_NX; bi++) {
    for (let bj = 0; bj < SHORE_NZ; bj++) {
      const cx = SHORE_OX + bi * SHORE_PITCH + SHORE_PITCH / 2;
      const cz = SHORE_OZ + bj * SHORE_PITCH + SHORE_PITCH / 2;
      if (!uferBlockFrei(cx, cz)) continue;
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.scale.set(innen, 1, innen);
      slab.position.set(cx, 0, cz);
      slab.receiveShadow = true;
      cityGroup.add(slab);

      /* Am Wasser stehen niedrigere Häuser, dahinter wächst die Skyline –
         so bekommt die andere Seite Tiefe statt einer flachen Reihe. */
      const hoch = bi === 0 ? rand(0.55, 0.85) : rand(0.9, 1.35);
      const stil = Math.random();
      if (stil < 0.18) {
        // Kleiner Park mit Bäumen statt eines Hauses
        for (let i = 0; i < 5; i++) {
          const bx = cx + rand(-innen / 2 + 2, innen / 2 - 2);
          const bz = cz + rand(-innen / 2 + 2, innen / 2 - 2);
          const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 6),
            new THREE.MeshLambertMaterial({ color: 0x5a4530 }));
          stamm.position.set(bx, SLAB_H + 1.3, bz);
          cityGroup.add(stamm);
          const krone = new THREE.Mesh(new THREE.SphereGeometry(rand(1.5, 2.3), 7, 6),
            new THREE.MeshLambertMaterial({ color: 0x2f6b38 }));
          krone.position.set(bx, SLAB_H + rand(3.4, 4.2), bz);
          krone.castShadow = true;
          cityGroup.add(krone);
        }
      } else if (stil < 0.55) {
        // Ein Turm auf dem ganzen Block
        const w = rand(innen * 0.55, innen * 0.85), d = rand(innen * 0.55, innen * 0.85);
        const h = rand(26, 52) * hoch;
        makeBuildingMesh(w, h, d, cx + rand(-1.5, 1.5), cz + rand(-1.5, 1.5));
      } else {
        const off = innen / 4 + 1;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          if (Math.random() < 0.2) continue;
          makeBuildingMesh(rand(7, 10), rand(14, 34) * hoch, rand(7, 10),
            cx + sx * off + rand(-0.8, 0.8), cz + sz * off + rand(-0.8, 0.8));
        }
      }
      if ((bi + bj) % 2 === 0) addLamp(cx - innen / 2 + 1, cz - innen / 2 + 1);
    }
  }

  /* Auf dieser Seite stand derselbe massive Riegel als "Gelaender" - aus
     demselben Grund wie drueben ist er weg. */
}

buildCity();

/* ======================= GLB-Charaktermodelle (optional) =======================
   Eigene Modelle einfach in den Ordner assets/ legen – z. B. von Mixamo
   (FBX mit Blender zu GLB konvertieren), Ready Player Me oder Sketchfab.
   Slots: hero.glb, civilian.glb (+ civilian2/3.glb für Vielfalt), thug.glb.
   Fehlt eine Datei, wird automatisch die eingebaute Figur verwendet.
   Hinweis: GLB-Laden funktioniert nur über http(s) – also auf der Webseite
   oder mit lokalem Server, nicht bei Doppelklick auf die Datei (file://). */
const GLB_SLOTS = {
  hero: 'assets/hero.glb',
  civilian: 'assets/civilian.glb',
  civilian2: 'assets/civilian2.glb',
  /* civilian3..5 sind reine T-Pose-Modelle ohne eigene Bewegungsdateien.
     Sie bekommen die Bewegungen von civilian (verteileZiviBewegungen) -
     alle Mixamo-Figuren teilen sich dasselbe Skelett, und 55 zusaetzliche
     Dateien je Modell waeren nur Ladezeit fuer nichts. */
  civilian3: 'assets/civilian3.glb',
  civilian4: 'assets/civilian4.glb',
  civilian5: 'assets/civilian5.glb',

  thug: 'assets/thug.glb',
};
/* Alle Zivilistenmodelle - fuer die Auswahl beim Erzeugen und fuer die
   Weitergabe der Bewegungen. */
const ZIVI_SLOTS = ['civilian', 'civilian2', 'civilian3', 'civilian4', 'civilian5'];
/* Nur diese Slots haben eigene <slot>@<teil>.glb-Dateien. */
const GLB_ANIM_SLOTS = ['hero', 'civilian', 'civilian2', 'thug'];
const glbModels = {}; // Slot -> {scene, clips, scale, yOffset, yaw}

/* Blickrichtungs-Korrektur pro Modell: Das Spiel erwartet Blick nach +Z.
   Läuft ein Modell rückwärts, hier Math.PI eintragen (Standard: 0). */
const GLB_YAW = {};

/* Zusätzliche Animations-Dateien pro Modell: assets/<slot>@<teil>.glb
   (entstehen automatisch aus Mixamo-Downloads „Without Skin“, siehe tools/) */
/* ---- Bezugstempo der Gangarten ----
   Wie schnell sich die Figur in der jeweiligen Mixamo-Datei bei
   Abspielgeschwindigkeit 1 fortbewegt. Daraus wird die Abspielgeschwindig-
   keit berechnet, damit der aufgesetzte Fuss wirklich stehen bleibt statt
   ueber den Asphalt zu rutschen. Die Werte sind gemessen, nicht geschaetzt
   (siehe Fussrutsch-Messung). */
const GANG_REF = {
  /* "Low Crawl": auf allen vieren, Bauch dicht am Boden. Wie die anderen
     Gangarten abgetastet: bei 0,8 m/s bleibt die Hand praktisch stehen
     (0,045 m/s Restbewegung), bei 1,2 sind es schon 0,43. 0,85 ist die
     Grenze, an der es noch sauber aussieht - Kriechen darf langsam sein. */
  kriechen: 0.85,
  schleichen: 2.0,
  ducken: 1.15,
  walk: 1.45,
  run: 4.2,
  sprint: 5.0,
  /* "Bully Walking", der Gang im Symbiontenanzug. Wie die anderen
     Gangarten abgetastet: bei 1,0 m/s steht der Fuss praktisch still
     (0,006 m/s Restbewegung), bei 1,2 sind es 0,09 - so viel wie beim
     Laufen. 1,2 ist der Kompromiss zwischen Standfestigkeit und einem
     Tempo, mit dem man noch vorankommt. */
  symgang: 1.2,
};
const GANG_CLIPS = Object.keys(GANG_REF);
/* Stelle im Duck-Clip, an der die Figur im Stand angehalten wird.
   Abgetastet: dort ist der Hoehenunterschied zwischen den Fuessen am
   kleinsten und beide stehen am tiefsten. */
let DUCK_STAND_T = 0.42;

const GLB_ANIM_PARTS = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'punch',
  'attack', 'kick', 'hit', 'roll', 'sit', 'swing', 'climb',
  /* mixamo-5: freies Klettern, seitliches Hangeln, Ausweichschritt
     nach links und rechts. */
  'klettern_frei', 'klettern_seit', 'ausweichenL', 'ausweichenR',
  /* mixamo-6: über eine Kante ziehen, am Sims hängen. */
  'kante', 'haengen',
  /* mixamo-7: Wandlauf, Aufwärtshaken, Wurf, Landerolle, Zivilisten-Posen. */
  'fallrolle', 'wandlauf', 'uppercut', 'wurf', 'telefon', 'warten', 'umschauen',
  'hook', 'punch3', 'luftangriff', 'knie', 'block', 'taunt', 'jubel',
  /* mixamo-8: Sprint, Ducklauf, Schleichen, zweites Klettern, freies
     Haengen am Faden. */
  'sprint', 'ducken', 'schleichen', 'klettern', 'haengen_frei',
  /* mixamo-9: Haltungen fuer den Netzschwung, Landehocke, Salti. */
  'schwungpose', 'sturzland', 'frontflip', 'backflip',
  /* animation-1: echte Netzschwung-Bewegungen aus einem fertigen Modell
     (siehe tools/extract-anims.mjs). Endlich ein richtiger Schwung statt
     einer festgehaltenen Haltung. */
  'schwung', 'schwungland', 'schwunghang',
  /* animation-1, aus dem Symbiontenmodell: der schwere Gang und der
     fliegende Kniestoss fuer den Symbiontenmodus. "Grab and Slam" und
     "Low Crawl" sind zwar auch brauchbar, haben aber noch keinen Platz im
     Spiel - sie werden erst geladen, wenn sie auch benutzt werden. */
  'symgang', 'symkombo',
  /* "Grab and Slam" als Wurfgriff und "Low Crawl" als Kriechen. */
  'wurfgriff', 'kriechen',
  /* hero-3: Seil ziehen (Haltung beim Spannen des Katapults) und
     Aufstampfen (der Tritt im Symbiontenanzug). */
  'ziehen', 'stampfen',
  /* Aus dem Unreal-Projekt in hero-3, ueber tools/uasset-zu-glb.mjs und
     tools/retarget-ue4.mjs geholt: seitliches Kriechen nach links und
     rechts (fuer die Hauswand) und die Hocke auf der Dachkante. */
  /* Netzschwung, Wandlauf, Netz-Zug und Landung - alle aus demselben
     Projekt und fuer genau diese Bewegungen gemacht. */
  /* Seitliches Kriechen an der Wand und die Hocke auf der Dachkante -
     beide aus dem Unreal-Projekt, beide auf die Ausgangslage des Spiels
     gedreht (siehe tools/anim-ausrichten.mjs). */
  /* Absprung von der Wand, der Netzwurf beim Anschwingen und die Drehung
     im Netzzug. */
  'wandsprung', 'netzwurf', 'zip_dreh',
  'schwung2', 'flip_v', 'flip_h',
  /* Zwei echte Luftakrobatiken aus demselben Projekt ("NewCrazyFlip" und
     "CrazyFlip_Right"). Sie sind der Spass am Netzschwung: beim Loslassen
     und zwischen zwei Boegen dreht sich die Figur um die eigene Achse
     oder ueberschlaegt sich seitlich. Reine Schau - die Flugbahn bleibt
     unveraendert. */
  'kunst_a', 'kunst_b',
  'sturzflug', 'sturzflug2',
  'zip_ab', 'zip_zug'];

/* Alltagsbewegungen der Zivilisten. Sie liegen NUR unter civilian@... und
   werden danach an alle Zivilistenmodelle weitergereicht - Held und Gegner
   brauchen sie nicht, und zwei weitere Kopien je Modell waeren nur
   Ladezeit. */
const ZIVI_ANIM_PARTS = ['sitzen', 'reden', 'streiten', 'tippen', 'trinken',
                         'gelangweilt', 'froh', 'winken'];

/* Ausweichen und Rollen in ACHT Richtungen, dazu zwei Drehausweicher.
   Sie stammen aus einem Unreal-Projekt und liegen deshalb auf dem
   UE4-Mannequin; tools/retarget-ue4.mjs rechnet sie auf das
   Mixamo-Skelett um. Nur der Held braucht sie. */
const RICHT_8 = ['v', 'vr', 'r', 'hr', 'h', 'hl', 'l', 'vl'];
const HELD_ANIM_PARTS = RICHT_8.map((r) => 'ausw_' + r)
  .concat(RICHT_8.map((r) => 'rolle_' + r))
  .concat(['spin_l', 'spin_r']);

/* Höhe eines Modells bestimmen.
   Bei geskinnten Modellen taugt die Mesh-Box oft nichts: Manche Exporte
   (z. B. aus Sketchfab) hängen das Netz unter Knoten mit winziger Skalierung,
   die beim Skinning gar nicht wirkt – die Box wird dann fast null groß.
   Deshalb in so einem Fall über die Knochen messen. */
function messeModell(scene) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  let h = box.max.y - box.min.y;
  /* Auch die WAAGERECHTE Mitte messen. Manche Rigs haben die Huefte weit
     vom Ursprung der Figur weg (im Heldenmodell steht sie auf
     z = -13889 Modelleinheiten) - die Figur stand dadurch fast einen Meter
     neben ihrem eigenen Kollisionspunkt. Sichtbar wurde das erst mit dem
     Kontaktschatten: der Fleck lag neben den Fuessen. */
  if (h > 0.05) return { minY: box.min.y, maxY: box.max.y, quelle: 'netz',
                         mitteX: (box.min.x + box.max.x) / 2,
                         mitteZ: (box.min.z + box.max.z) / 2 };

  const p = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  scene.traverse((o) => {
    if (!o.isBone) return;
    o.getWorldPosition(p);
    if (p.y < lo) lo = p.y;
    if (p.y > hi) hi = p.y;
  });
  h = hi - lo;
  if (!isFinite(h) || h <= 0.05) return { minY: 0, maxY: 0, quelle: 'unbrauchbar' };
  /* Knochen enden im Fuß bzw. im Scheitelknochen – Sohle und Kopfoberkante
     liegen etwas außerhalb. Ein kleiner Zuschlag gleicht das aus. */
  const rand = h * 0.03;
  let sx = 0, sz = 0, n = 0;
  scene.traverse((o) => {
    if (!o.isBone) return;
    o.getWorldPosition(p); sx += p.x; sz += p.z; n++;
  });
  return { minY: lo - rand, maxY: hi + rand, quelle: 'knochen',
           mitteX: n ? sx / n : 0, mitteZ: n ? sz / n : 0 };
}

/* Ladefortschritt fürs Startbild: vorher hing das Bild ohne Rückmeldung,
   bis alle rund 130 Dateien da waren. */
let ladeGesamt = 1, ladeFertig = 0;
function ladeSchritt() {
  ladeFertig++;
  const bar = document.getElementById('ladebar');
  const txt = document.getElementById('ladetext');
  const p = Math.min(100, Math.round((ladeFertig / ladeGesamt) * 100));
  if (bar) bar.style.width = p + '%';
  if (txt) txt.textContent = p < 100 ? `Figuren und Bewegungen … ${p}%` : 'Bereit!';
}
function ladeFertigMelden() {
  const w = document.getElementById('ladewrap');
  const t = document.getElementById('ladetext');
  const c = document.getElementById('clickmsg');
  if (w) w.style.display = 'none';
  if (t) t.style.display = 'none';
  if (c) c.style.display = 'block';
}

function loadGlbAssets(done) {
  if (typeof THREE.GLTFLoader !== 'function' || location.protocol === 'file:') { ladeFertigMelden(); done(); return; }
  const loader = new THREE.GLTFLoader();
  const slots = Object.keys(GLB_SLOTS);
  let pending = slots.length;
  ladeGesamt = slots.length + slots.length * GLB_ANIM_PARTS.length;
  const finish = () => { ladeSchritt(); if (--pending === 0) loadCompanionClips(); };
  for (const slot of slots) {
    loader.load(GLB_SLOTS[slot], (gltf) => {
      try {
        /* Manche Modelle bringen durchnummerierte Knochennamen mit
           ("mixamorig:Hips_98"). Die Bewegungsdateien sprechen aber die
           reinen Mixamo-Namen an – deshalb hier die Nummern entfernen,
           sonst greift keine Animation. */
        gltf.scene.traverse((o) => {
          if (o.isBone) o.name = knochenName(o.name);
        });
        bindeSteuerteileAnSkelett(gltf.scene);
        const mass = messeModell(gltf.scene);
        const h = mass.maxY - mass.minY;
        glbModels[slot] = {
          scene: gltf.scene,
          ruhe: ruheKarte(gltf.scene),
          /* Auch die im Modell selbst mitgelieferten Bewegungen bekommen
             die vereinheitlichten Knochennamen. */
          clips: (gltf.animations || []).map((c) => {
            for (const t of c.tracks) t.name = knochenName(t.name);
            return c;
          }),
          scale: h > 0.01 ? 1.76 / h : 1,
          yOffset: -mass.minY,
          xOffset: -(mass.mitteX || 0),
          zOffset: -(mass.mitteZ || 0),
          yaw: GLB_YAW[slot] || 0,
          /* Nicht mehr nur der Held: die Gegner tragen eine dunkle
             Panzerung, und die kam unter Sonne plus Himmelslicht als
             schwarze Silhouette heraus - in der Haeuserschlucht sah man
             sie gar nicht mehr ("Gegner sind weiterhin unsichtbar").
             Gemessen an einem Gegner: 42 Netze, davon eines sichtbar - das
             Modell war also da, es war nur zu dunkel. Die Kurve hebt
             dunkle Stellen deutlich und helle kaum, Zivilisten mit
             hellen Hemden veraendern sich daher fast nicht. */
          aufhellen: true,
        };
      } catch (e) { /* unbrauchbares Modell -> eingebaute Figur */ }
      finish();
    }, undefined, finish);
  }
  function loadCompanionClips() {
    const jobs = [];
    for (const slot of slots) {
      if (!glbModels[slot]) continue;
      if (GLB_ANIM_SLOTS.indexOf(slot) < 0) continue;
      for (const part of GLB_ANIM_PARTS) jobs.push([slot, part]);
    }
    if (glbModels.civilian) {
      for (const part of ZIVI_ANIM_PARTS) jobs.push(['civilian', part]);
    }
    if (glbModels.hero) {
      for (const part of HELD_ANIM_PARTS) jobs.push(['hero', part]);
    }
    if (!jobs.length) { ladeFertigMelden(); verteileZiviBewegungen();
                        teileBewegungen(); ergaenzeSpiegelungen(); done(); return; }
    ladeGesamt = slots.length + jobs.length;
    let pending2 = jobs.length;
    const finish2 = () => {
      ladeSchritt();
      if (--pending2 === 0) {
        ladeFertigMelden(); verteileZiviBewegungen();
        teileBewegungen(); ergaenzeSpiegelungen();
        ladeStadtteile(loader);
        ladeHaeuser(loader);
        done();
      }
    };
    for (const [slot, part] of jobs) {
      loader.load(`assets/${slot}@${part}.glb`, (gltf) => {
        try {
          const clip = (gltf.animations || [])[0];
          if (clip) {
            clip.name = part; // Clip nach dem Dateinamens-Teil benennen
            for (const t of clip.tracks) t.name = knochenName(t.name);
            glbModels[slot].clips.push(entferneFinger(entferneVersatz(clip)));
          }
        } catch (e) { /* ignorieren */ }
        finish2();
      }, undefined, finish2);
    }
  }
}

/* ======================= Bauteile aus dem Baukasten =======================
   Requisiten auf Strassenhoehe aus dem "Downtown City MegaKit" von
   Quaternius (CC0). Das Spiel baut die Stadt selbst; hier kommen nur die
   Kleinteile dazu, die auf Augenhoehe stehen und wo man kaempft - dort
   faellt der Unterschied zwischen Kiste und Modell am meisten auf.

   Jede Teilesorte wird als InstancedMesh gezeichnet: alle Gullideckel der
   Stadt zusammen kosten damit EINEN Zeichenaufruf, alle Poller einen
   weiteren, und so fort. Die Stellen sammelt der Stadtbau schon beim
   Bauen ein - die Datei kommt erst spaeter an. */
/* ---- Echte Gebaeudemodelle ueber die Kisten stellen ----
   Aus zwei Modellsaetzen ("Brownstone Building Set", "Downtown Buildings
   Set") kommen 18 fertige Haeuser, ueber tools/convert-haeuser.mjs auf
   einen EINHEITSWUERFEL normiert: Grundriss -0,5..0,5, Hoehe 0..1. Ein
   Modell passt damit auf jede Kiste, indem man es einfach auf deren Masse
   skaliert.
   Ausgewaehlt wird nach der HOEHE - ein Modell, das fuer 100 m gebaut ist,
   auf 15 m gestaucht, verliert seine Geschosseinteilung. Innerhalb der
   passenden Hoehenklasse entscheidet der Ort, damit dasselbe Haus an
   derselben Stelle immer gleich aussieht. */
const HAUS_MODELLE = [];
function ladeHaeuser(loader) {
  if (!HAUS_KISTEN.length) return;
  loader.load('assets/haeuser.glb', (gltf) => {
    try { setzeHausModelle(gltf.scene); }
    catch (e) { window.__hausFehler = String(e && e.message || e); }
  }, undefined, (e) => { window.__hausFehler = 'laden: ' + String(e && e.message || e); });
}

function setzeHausModelle(szene) {
  const bau = [];
  szene.children.slice().forEach((o) => {
    let hatMesh = false;
    o.traverse((k) => { if (k.isMesh) hatMesh = true; });
    if (hatMesh) bau.push(o);
  });
  if (!bau.length) return;
  /* Eigenhoehe je Modell merken - sie steht im Namen nicht drin, also
     wird sie einmal aus dem Satz gelesen, bevor normiert skaliert wird.
     Da alle Modelle auf den Einheitswuerfel normiert sind, steckt die
     urspruengliche Hoehe in der Reihenfolge: der Satz ist nach Hoehe
     sortiert erzeugt worden, deshalb wird hier nach dem NAMEN gruppiert. */
  const klasse = (n) => /ModernOffice_5$|ModernOffice_4$/.test(n) ? 3
                      : /ModernOffice_1_B$|ModernOffice_5_B$|ArtDeco|ClassicOffice/.test(n) ? 2
                      : /Downtown_/.test(n) ? 1 : 0;
  const nachKlasse = [[], [], [], []];
  for (const o of bau) nachKlasse[klasse(o.name)].push(o);
  for (let i = 0; i < 4; i++) if (!nachKlasse[i].length) nachKlasse[i] = bau;
  /* Materialien einmal auf die Zeichenart des Spiels bringen. */
  const gesehen = new Set();
  for (const o of bau) {
    o.traverse((k) => {
      if (!k.isMesh || !k.material || gesehen.has(k.material)) return;
      gesehen.add(k.material);
      if (k.material.metalness !== undefined) k.material.metalness = 0;
      if (k.material.roughness !== undefined) k.material.roughness = 0.85;
      k.material.side = THREE.FrontSide;
    });
  }
  /* ---- Wo hoert das Haus auf und wo faengt der Zierabschluss an? ----
     Die Modelle sind auf den Einheitswuerfel normiert - aber ihre HOEHE
     misst den ganzen Umriss, samt Turmspitze, Mast und Dachkrone. Das
     begehbare Dach liegt darunter: gemessen zwischen 78 und 100 Prozent
     der Modellhoehe.
     Skaliert man ein solches Modell einfach auf die Haushoehe, sitzt sein
     Dach entsprechend tiefer als das Hindernis. Auf dem Bild schwebten
     dadurch Dachgesimse, Wassertuerme und Klimageraete meterhoch ueber dem
     Haus in der Luft, und beim Klettern griff man ins Leere, weil die Wand
     erst hinter dem Hindernis anfing.
     Deshalb wird je Modell EINMAL gemessen, auf welcher Hoehe der Baukoerper
     endet, und danach so skaliert, dass GENAU DIESES DACH auf der
     Haushoehe liegt. Was darueber steht - Krone, Mast, Spitze - ragt wie im
     Vorbild ueber die Dachkante hinaus und bekommt ein eigenes Hindernis. */
  const _dv = new THREE.Vector3(), _dm = new THREE.Matrix4(), _di = new THREE.Matrix4();
  function vermessen(o) {
    if (o.userData.dachAnteil) return o.userData;
    o.updateMatrixWorld(true);
    _di.copy(o.matrixWorld).invert();
    const N = 40;
    const sx0 = [], sx1 = [], sz0 = [], sz1 = [];
    for (let i = 0; i < N; i++) { sx0.push(1e9); sx1.push(-1e9); sz0.push(1e9); sz1.push(-1e9); }
    let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9, Y0 = 1e9, Y1 = -1e9;
    const alle = [];
    o.traverse((k) => {
      if (!k.isMesh || !k.geometry || !k.geometry.attributes.position) return;
      _dm.multiplyMatrices(_di, k.matrixWorld);
      const p = k.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        _dv.fromBufferAttribute(p, i).applyMatrix4(_dm);
        alle.push(_dv.x, _dv.y, _dv.z);
        if (_dv.x < X0) X0 = _dv.x; if (_dv.x > X1) X1 = _dv.x;
        if (_dv.y < Y0) Y0 = _dv.y; if (_dv.y > Y1) Y1 = _dv.y;
        if (_dv.z < Z0) Z0 = _dv.z; if (_dv.z > Z1) Z1 = _dv.z;
      }
    });
    const H = Y1 - Y0, W = X1 - X0, D = Z1 - Z0;
    if (!(H > 0) || !(W > 0) || !(D > 0)) {
      o.userData.dachAnteil = 1; o.userData.krone = null; return o.userData;
    }
    for (let i = 0; i < alle.length; i += 3) {
      const k = clamp(Math.floor((alle[i + 1] - Y0) / H * N), 0, N - 1);
      if (alle[i] < sx0[k]) sx0[k] = alle[i];
      if (alle[i] > sx1[k]) sx1[k] = alle[i];
      if (alle[i + 2] < sz0[k]) sz0[k] = alle[i + 2];
      if (alle[i + 2] > sz1[k]) sz1[k] = alle[i + 2];
    }
    /* Von oben nach unten die erste Schicht suchen, die noch fast den
       ganzen Grundriss ausfuellt - dort endet der Baukoerper. */
    let dach = N;
    for (let k = N - 1; k >= 0; k--) {
      if (sx1[k] < sx0[k]) continue;
      if ((sx1[k] - sx0[k]) / W > 0.6 && (sz1[k] - sz0[k]) / D > 0.6) { dach = k + 1; break; }
    }
    const anteil = clamp(dach / N, 0.5, 1);
    /* Grundriss dessen, was oben herausragt - als Anteil der Hausbreite. */
    let kx0 = 1e9, kx1 = -1e9, kz0 = 1e9, kz1 = -1e9;
    const yK = Y0 + H * anteil;
    for (let i = 0; i < alle.length; i += 3) {
      if (alle[i + 1] < yK + H * 0.005) continue;
      if (alle[i] < kx0) kx0 = alle[i]; if (alle[i] > kx1) kx1 = alle[i];
      if (alle[i + 2] < kz0) kz0 = alle[i + 2]; if (alle[i + 2] > kz1) kz1 = alle[i + 2];
    }
    o.userData.dachAnteil = anteil;
    o.userData.krone = (anteil < 0.995 && kx1 > kx0) ? {
      x0: (kx0 - X0) / W - 0.5, x1: (kx1 - X0) / W - 0.5,
      z0: (kz0 - Z0) / D - 0.5, z1: (kz1 - Z0) / D - 0.5,
      hoch: (1 - anteil) / anteil,           // in Haushoehen ueber dem Dach
    } : null;
    return o.userData;
  }

  let gesetzt = 0;
  for (const e of HAUS_KISTEN) {
    const kl = e.h > 62 ? 3 : e.h > 38 ? 2 : e.h > 19 ? 1 : 0;
    const liste = nachKlasse[kl];
    /* Ortsabhaengige Wahl: gleiches Haus, gleiches Modell - auch nach
       einem Neustart. */
    const i = Math.abs(Math.round(e.x * 7.3 + e.z * 3.1)) % liste.length;
    const mass = vermessen(liste[i]);
    const kopie = liste[i].clone(true);
    kopie.position.set(e.x, SLAB_H, e.z);
    kopie.scale.set(e.w, e.h / mass.dachAnteil, e.d);
    if (mass.krone) {
      const k = mass.krone;
      addCollider({ x0: e.x + k.x0 * e.w, x1: e.x + k.x1 * e.w,
                    z0: e.z + k.z0 * e.d, z1: e.z + k.z1 * e.d,
                    h: SLAB_H + e.h + k.hoch * e.h, y0: SLAB_H + e.h - 0.2,
                    klein: true });
    }
    kopie.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    cityGroup.add(kopie);
    HAUS_MODELLE.push(kopie);
    gesetzt++;
  }
  /* Erst wenn wirklich Modelle stehen, verschwinden die alten Fassaden. */
  if (gesetzt) for (const m of HAUS_FASSADEN) m.visible = false;
}

function ladeStadtteile(loader) {
  const stellen = Object.keys(TEIL_STELLEN).filter((k) => TEIL_STELLEN[k].length);
  if (!stellen.length && !HAUS_STELLEN.length) return;
  loader.load('assets/stadtteile.glb', (gltf) => {
    try { setzeStadtteile(gltf.scene); } catch (e) { /* ohne Requisiten weiter */ }
  }, undefined, () => { /* fehlt die Datei, bleibt die Stadt wie sie ist */ });
}

function setzeStadtteile(szene) {
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  /* Die fertigen Haeuser werden KOPIERT statt als Instanzen gezeichnet.
     Jedes besteht aus rund einem Dutzend Teilmeshes; als Instanzen ueber
     die ganze Stadt verteilt liessen sie sich nicht mehr wegschneiden und
     alle zwoelf Teile wurden immer gezeichnet (gemessen bis zu 404
     Zeichenaufrufe). Als einzelne Kopien greift das normale Wegschneiden
     und es kostet nur, was gerade im Bild ist. */
  for (const e of HAUS_STELLEN) {
    const quelle = szene.getObjectByName(e.name);
    if (!quelle) continue;
    const kopie = quelle.clone(true);
    kopie.position.set(e.x, e.y, e.z);
    kopie.rotation.y = e.ry;
    kopie.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    cityGroup.add(kopie);
    KIT_KOPIEN.push(kopie);
  }
  for (const [name, liste] of Object.entries(TEIL_STELLEN)) {
    if (!liste.length) continue;
    const quelle = szene.getObjectByName(name);
    if (!quelle) continue;
    /* Ein Teil kann aus mehreren Untermeshes bestehen (Rahmen, Glas ...).
       Jedes bekommt sein eigenes InstancedMesh. */
    const teile = [];
    quelle.traverse((o) => { if (o.isMesh) teile.push(o); });
    for (const t of teile) {
      const inst = new THREE.InstancedMesh(t.geometry, t.material, liste.length);
      inst.castShadow = true; inst.receiveShadow = true;
      /* Die Teile stehen ueber die ganze Stadt verteilt - ein gemeinsamer
         Umkreis waere riesig und wuerde nie weggeschnitten. */
      inst.frustumCulled = false;
      for (let i = 0; i < liste.length; i++) {
        const e = liste[i];
        _p.set(e.x, e.y, e.z);
        _q.setFromEuler(new THREE.Euler(0, e.ry, 0));
        _s.set(e.s, e.s, e.s);
        _m.compose(_p, _q, _s);
        inst.setMatrixAt(i, _m);
      }
      inst.instanceMatrix.needsUpdate = true;
      cityGroup.add(inst);
    }
  }
}

/* Name eines Knotens so schreiben, wie ihn die Animationsspuren ansprechen. */
function spurName(name) {
  return THREE.PropertyBinding && THREE.PropertyBinding.sanitizeNodeName
    ? THREE.PropertyBinding.sanitizeNodeName(name) : name;
}

/* Ruhehaltung (Rest-Pose) eines Modells oder einer Bewegungsdatei einsammeln:
   die Grunddrehung jedes Knochens, bevor irgendeine Bewegung läuft. */
function ruheKarte(scene) {
  const karte = new Map();
  scene.traverse((o) => {
    const n = spurName(o.name || '');
    if (n && !karte.has(n)) karte.set(n, o.quaternion.clone());
  });
  return karte;
}


/* Mixamo-Bewegungen stammen oft von einem anderen Charakter als das Modell.
   Ihre Hüft-Positionsspur ist dann in fremden Maßen und würde die Figur in
   den Boden ziehen oder schweben lassen. Deshalb bleiben nur die Drehungen
   erhalten – die passen bei jedem Mixamo-Skelett. */
/* ---- Knochennamen vereinheitlichen ----
   Mixamo vergibt das Praefix nicht immer gleich: manche Downloads heissen
   "mixamorig:Hips", andere "mixamorig6:Hips", manche Modelle haengen eine
   laufende Nummer an ("mixamorig:Hips_98"). Eine Bewegungsspur findet
   ihren Knochen nur bei EXAKT gleichem Namen. Gemessen: die Modelle
   civilian3..5 bringen "mixamorig4Hips", "mixamorig1Hips" und
   "mixamorig6Hips" mit, die 44 vorhandenen Bewegungen sprechen
   "mixamorigHips" an, die acht neuen aus civilian-3 "mixamorig6Hips" -
   ohne Normalisierung waeren die drei neuen Figuren also komplett
   bewegungslos in der Bindehaltung stehengeblieben und die acht neuen
   Bewegungen haetten auf keiner Figur gegriffen. (Den Doppelpunkt aus
   "mixamorig:Hips" entfernt three.js beim Laden bereits selbst.)
   Deshalb gehen Knochen UND Spuren durch dieselbe Normalisierung. */
function knochenName(n) {
  return n.replace(/^mixamorig\d*:?/i, 'mixamorig').replace(/_\d+(?=\.|$)/, '');
}

function entferneVersatz(clip) {
  clip.tracks = clip.tracks.filter((t) => !/\.position$/.test(t.name));
  return clip;
}

/* Eine Bewegung spiegeln: aus einem rechten Schlag wird ein linker.
   Dazu werden die Links/Rechts-Knochen getauscht und jede Drehung an der
   Körpermittelebene gespiegelt (y und z umkehren). Mixamo-Skelette sind
   symmetrisch aufgebaut, deshalb passt das exakt.
   So wechselt die Schlagkombo sichtbar den Arm, ohne zweite Datei. */
function spiegeleClip(clip, name) {
  const spuren = [];
  for (const t of clip.tracks) {
    const neu = t.clone();
    neu.name = t.name.replace(/Left/g, '\u0000').replace(/Right/g, 'Left').replace(/\u0000/g, 'Right');
    if (/\.quaternion$/.test(neu.name)) {
      const v = neu.values;
      for (let i = 0; i + 3 < v.length; i += 4) { v[i + 1] = -v[i + 1]; v[i + 2] = -v[i + 2]; }
    }
    spuren.push(neu);
  }
  return new THREE.AnimationClip(name, clip.duration, spuren);
}

/* Für jede Figur eine gespiegelte Schlagfassung ergänzen. */
function ergaenzeSpiegelungen() {
  /* Aus jedem Schlag entsteht zusätzlich die seitenverkehrte Fassung.
     Damit ergeben zwei Dateien vier sichtbar verschiedene Schläge. */
  const paare = [['punch', 'punch2'], ['hook', 'hook2']];
  for (const slot of Object.keys(glbModels)) {
    const m = glbModels[slot];
    if (!m) continue;
    for (const [quelle, ziel] of paare) {
      if (m.clips.some((c) => c.name === ziel)) continue;
      const c = m.clips.find((x) => x.name === quelle);
      if (c) m.clips.push(spiegeleClip(c, ziel));
    }
  }
}

/* Fingerknochen aus einer Bewegung entfernen.
   Die Fingerhaltung der Bewegungsdateien passt bis zu 26° nicht zur
   Ruhehaltung unseres Modells – die Hände sahen dadurch verkrampft und
   klauenartig aus. Ohne diese Spuren behalten die Hände die schön
   modellierte Grundhaltung des Anzugs. */
function entferneFinger(clip) {
  clip.tracks = clip.tracks.filter(
    (t) => !/hand(thumb|index|middle|ring|pinky)\d/i.test(t.name));
  return clip;
}

/* Manche Modelle bringen neben dem Skelett noch ein zweites Steuer-Rig mit
   (Ctrl_Head, Ctrl_Spine ...). Teile, die dort hängen – bei diesem Modell die
   Augenlinsen –, folgen den Bewegungen nicht und bleiben im Gesicht stehen
   bzw. schweben daneben. Hier werden sie an den passenden echten Knochen
   umgehängt, ohne ihre Lage zu verändern. */
function bindeSteuerteileAnSkelett(scene) {
  const knochen = {};
  scene.traverse((o) => { if (o.isBone) knochen[knochenSchluessel(o.name)] = o; });
  const steuer = [];
  scene.traverse((o) => { if (!o.isBone && /^ctrl_/i.test(o.name || '')) steuer.push(o); });
  if (!steuer.length) return;
  scene.updateMatrixWorld(true);
  for (const c of steuer) {
    const schluessel = c.name.replace(/^ctrl_/i, '').replace(/_\d+$/, '')
                             .replace(/\s+/g, '').toLowerCase();
    const ziel = knochen[schluessel];
    if (!ziel) continue;
    for (const kind of c.children.slice()) {
      let hatMesh = false;
      kind.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) hatMesh = true; });
      if (!hatMesh) continue;
      /* Die örtliche Lage relativ zum Steuerknochen bleibt erhalten. Die
         Ruhepose beider Skelette unterscheidet sich; würde man stattdessen
         die Weltlage einfrieren, säßen die Teile schief. */
      ziel.add(kind);
    }
  }
}

/* Modelle ohne eigene Bewegungen bekommen die eines anderen Modells.
   Alle Figuren nutzen dasselbe Mixamo-Skelett, deshalb passen die Clips
   überall – so braucht ein mitgebrachtes Heldenmodell keine eigenen
   Animationsdateien. */
/* Die Bewegungen von civilian an die uebrigen Zivilistenmodelle
   weitergeben. Muss VOR teileBewegungen laufen: danach haben sie genug
   Clips und werden dort uebersprungen. */
function verteileZiviBewegungen() {
  const quelle = glbModels.civilian || glbModels.civilian2;
  if (!quelle || !quelle.clips.length) return;
  for (const slot of ZIVI_SLOTS) {
    const m = glbModels[slot];
    if (!m || m === quelle) continue;
    /* Nach NAMEN vergleichen, nicht nach Objekt: civilian2 bringt eigene
       Dateien mit, und zwei Clips gleichen Namens im selben Modell wuerden
       sich bei findClip gegenseitig ausstechen. */
    const haben = new Set(m.clips.map((c) => c.name));
    for (const c of quelle.clips) if (!haben.has(c.name)) m.clips.push(c);
  }
}

function teileBewegungen() {
  const echte = (m) => m.clips.filter((c) => !/t-?pose|mixamo\.com/i.test(c.name));
  const alle = Object.keys(glbModels).map((k) => glbModels[k]).filter(Boolean);
  const spender = alle.find((m) => echte(m).length >= 2);
  if (!spender) return;
  for (const m of alle) {
    if (m === spender || echte(m).length >= 2) continue;
    for (const c of echte(spender)) if (m.clips.indexOf(c) < 0) m.clips.push(c);
  }
}

/* Animations-Zuordnung: Spielzustand -> Clip-Name (per Muster) */
/* ---- Masse der Hocke auf der Dachkante ----
   Eingestellt und im Spiel nachgemessen (scratchpad/hocke2.js): Fuesse auf
   der Kante, Haende davor auf der Kante, Knie hoch, Ruecken rund, Kopf
   oben. Alle Laengen in Metern. */
/* Wie stark sich die Finger zur Faust kruemmen. Gemessen eingestellt:
   Fingerspitze zum Handgelenk unter 6 cm. */
const FAUST_KRUEMM = -1.35, FAUST_DAUMEN = -0.55;
const BLEND_ROLLE = 0.012;   // praktisch harter Schnitt, siehe rolleOneShot
/* Kunststuecke in der Luft (Doppelsprung, Ueberschlag zwischen zwei
   Boegen) blenden weich ein. Mit dem harten Schnitt sprangen Knie und
   Schultern in einem einzigen Bild um mehr als 100 Grad - das war der
   sichtbare Ruck beim Abspringen und Anschwingen. */
const BLEND_KUNST = 0.14;
/* Bis hierher greift die Figur nach der Fassade, und ueber diese Strecke
   blendet der Griff aus (siehe wandGriff). */
const WAND_GRIFF_WEIT = 0.45;
const WAND_GRIFF_BAND = 0.20;

/* ---- Blenden, die beim WIRKLICHEN Gewicht anfangen ----
   three.js setzt fadeOut() immer bei Gewicht 1 an und fadeIn() immer bei 0
   - unabhaengig davon, wo die Bewegung gerade tatsaechlich steht. Wird
   eine Bewegung ausgeblendet, waehrend sie noch einblendet, springt ihr
   Gewicht dadurch in einem einzigen Bild auf 1.
   Genau das war der Ruck beim Anschwingen: der Ueberschlag aus dem
   Doppelsprung lief mit 12 Prozent Gewicht, der Netzwurf blendete ihn im
   selben Bild aus - und damit stand er schlagartig auf 92 Prozent.
   Gemessen sprangen Knie und Schultern um ueber 100 Grad, die Hand um
   87 Zentimeter. Hier wird der Startwert der Blende auf das aktuelle
   Gewicht gesetzt, dann bleibt der Uebergang stetig. */
/* Das aktuelle Gewicht einer Bewegung - null, wenn sie gar nicht laeuft.
   getEffectiveWeight() allein reicht nicht: der Wert stammt aus dem
   letzten Mischerdurchlauf. Wurde die Blende erst in DIESEM Bild
   eingerichtet - etwa weil Doppelsprung und Netzwurf im selben Bild
   ausgeloest wurden - steht dort noch der alte Wert, bei einer frisch
   angelegten Bewegung sogar die volle Eins. Deshalb wird die Blendenkurve
   direkt an der aktuellen Mischerzeit ausgewertet. */
function gewichtVon(a) {
  if (!a || !a.isRunning || !a.isRunning()) return 0;
  const iv = a._weightInterpolant;
  const mx = a._mixer;
  if (iv && mx && iv.parameterPositions && iv.sampleValues) {
    const p = iv.parameterPositions, v = iv.sampleValues, t = mx.time;
    const grund = a.weight === undefined ? 1 : a.weight;
    let anteil;
    if (!(p[1] > p[0])) anteil = v[1];
    else if (t <= p[0]) anteil = v[0];
    else if (t >= p[1]) anteil = v[1];
    else anteil = v[0] + (v[1] - v[0]) * (t - p[0]) / (p[1] - p[0]);
    return clamp(grund * anteil, 0, 1);
  }
  return clamp(a.getEffectiveWeight(), 0, 1);
}
function blendeAus(a, dauer) {
  if (!a) return;
  if (a._scheduleFading) a._scheduleFading(dauer, gewichtVon(a), 0);
  else a.fadeOut(dauer);
}
function blendeEin(a, dauer, vonGewicht) {
  if (!a) return;
  const w = clamp(vonGewicht === undefined ? 0 : vonGewicht, 0, 1);
  /* Vorsicht: getEffectiveWeight() liefert auch fuer eine Bewegung, die
     noch nie lief, den vollen Wert 1. Der Startwert darf deshalb nur von
     einer WIRKLICH laufenden Bewegung kommen - das prueft der Aufrufer
     mit gewichtVon(). */
  if (a._scheduleFading) a._scheduleFading(dauer, w, 1);
  else a.fadeIn(dauer);
}
/* ---- Masse der Dachhocke ----
   Alle Masse stehen in EINEM Objekt, damit sie sich im Testlauf ueber
   __dbg.kau verstellen und dann nachmessen lassen.
   Nachgemessen ueber dem Dach (0 = Dachflaeche):
     Zehenballen 0,00   Fingerspitzen 0,01   Knoechel 0,06
     Huefte 0,30   Knie 0,44   Schulter 0,61   Kopf 0,63
   Vorher hing die Figur mit den Knoecheln 13 cm IM Dach, die Zehen und
   die Fingerspitzen 5 bis 6 cm - der Koerper war zu einem Ball
   zusammengefaltet (Huefte nur 13 cm, Kopf 46 cm ueber dem Dach) und der
   Fuss zeigte 13 cm nach HINTEN. Jetzt sitzt sie wie im Vorbild:
   Zehenballen und Fingerspitzen tragen, die Fersen sind angehoben, die
   Knie stehen ueber der Huefte, der Kopf schaut ueber die Stadt. */
const KAU = {
  r1: 0.58, r2: 0.58, r3: 0.34,      // Rumpf nach vorn
  nacken: -1.0, kopf: -0.86,         // Kopf hoch, Blick ueber die Stadt
  knieV: 0.30, knieQ: 0.155, knieH: 0.11,
  fussV: 0.34, fussQ: 0.185, fussH: -0.62,
  fussDreh: 0.16, zehTief: 0.05,
  armV: 0.55, armQ: 0.25, armRest: 0.42,
  handV: 0.85, handQ: 0.20, handHoch: 0.21,
};
/* Wie weit die Sohle unter dem Knoechel liegt (fuer die Stuetzebene der
   Haende). KAU.handHoch sagt, wie hoch das Handgelenk ueber dieser Ebene
   gezielt wird: die Fingerspitzen haengen darunter, und nur sie sollen
   das Dach beruehren. */
const KAU_SOHLE = 0.095;

const GLB_CLIP_PATTERNS = {
  idle: [/idle/i, /stand/i, /breath/i],
  walk: [/walk/i],
  /* Exakter Name zuerst: seit es eine eigene Sprint-Datei gibt, wuerde
     /sprint/ sonst beim Laufen zuschlagen. */
  run: [/^run$/i, /run/i, /jog/i],
  sprint: [/^sprint$/i, /sprint/i],
  symgang: [/^symgang$/i], symkombo: [/^symkombo$/i],
  wurfgriff: [/^wurfgriff$/i], kriechen: [/^kriechen$/i],
  schwung: [/^schwung$/i], schwungland: [/^schwungland$/i],
  schwunghang: [/^schwunghang$/i],
  schwungpose: [/^schwungpose$/i],
  sturzland: [/^sturzland$/i],
  frontflip: [/^frontflip$/i],
  backflip: [/^backflip$/i],
  ducken: [/^ducken$/i, /crouch/i],
  schleichen: [/^schleichen$/i, /sneak/i],
  klettern: [/^klettern$/i],
  /* Steigen und Fallen sind zwei verschiedene Bewegungen – erst die
     passende suchen, sonst rudert die Figur beim Fallen mit den Beinen. */
  jump: [/jump/i, /leap/i],
  /* Der EXAKTE Name zuerst. Locker gesucht passt /fall/ auch auf
     "fallrolle" - welche der beiden Dateien gewann, hing dann an der
     Ladereihenfolge, und die aendert sich mit jeder neuen Bewegung. Der
     freie Fall lief dadurch plotzlich mit der Landerolle. */
  air: [/^fall$/i, /^air$/i, /fall/i, /air/i, /jump/i],
  land: [/land/i, /landing/i],
  swing: [/swing/i, /hang/i, /fly/i, /brachiat/i],
  climb: [/^climb$/i, /climb/i, /crawl/i, /ladder/i],
  kante: [/kante/i],
  haengen: [/^haengen$/i, /haengen/i],
  haengen_frei: [/haengen_frei/i],
  fallrolle: [/fallrolle/i],
  wandlauf: [/wandlauf/i],
  uppercut: [/uppercut/i],
  wurf: [/wurf/i],
  telefon: [/telefon/i],
  warten: [/warten/i],
  umschauen: [/umschauen/i],
  sitzen: [/^sitzen$/i], reden: [/^reden$/i], streiten: [/^streiten$/i],
  tippen: [/^tippen$/i], trinken: [/^trinken$/i],
  gelangweilt: [/^gelangweilt$/i], froh: [/^froh$/i], winken: [/^winken$/i],
  ziehen: [/^ziehen$/i], stampfen: [/^stampfen$/i],
  schwung2: [/^schwung2$/], flip_v: [/^flip_v$/], flip_h: [/^flip_h$/],
  sturzflug: [/^sturzflug$/], sturzflug2: [/^sturzflug2$/],
  wandsprung: [/^wandsprung$/], netzwurf: [/^netzwurf$/],
  zip_dreh: [/^zip_dreh$/],
  zip_ab: [/^zip_ab$/], zip_zug: [/^zip_zug$/],
  ausw_v: [/^ausw_v$/], ausw_vr: [/^ausw_vr$/], ausw_r: [/^ausw_r$/],
  ausw_hr: [/^ausw_hr$/], ausw_h: [/^ausw_h$/], ausw_hl: [/^ausw_hl$/],
  ausw_l: [/^ausw_l$/], ausw_vl: [/^ausw_vl$/],
  rolle_v: [/^rolle_v$/], rolle_vr: [/^rolle_vr$/], rolle_r: [/^rolle_r$/],
  rolle_hr: [/^rolle_hr$/], rolle_h: [/^rolle_h$/], rolle_hl: [/^rolle_hl$/],
  rolle_l: [/^rolle_l$/], rolle_vl: [/^rolle_vl$/],
  spin_l: [/^spin_l$/], spin_r: [/^spin_r$/],
  kunst_a: [/^kunst_a$/], kunst_b: [/^kunst_b$/],
  klettern_frei: [/klettern_frei/i],
  klettern_seit: [/klettern_seit/i],
  ausweichenL: [/ausweichenL/],
  ausweichenR: [/ausweichenR/],
  roll: [/roll/i, /dodge/i, /dive/i, /evade/i],
  hit: [/hit/i, /impact/i, /react/i, /stagger/i],
  punch: [/punch/i, /jab/i, /hook/i, /elbow/i, /boxing/i],
  punch2: [/punch2/i],
  punch3: [/punch3/i],
  hook: [/^hook$/i],
  hook2: [/hook2/i],
  luftangriff: [/luftangriff/i],
  knie: [/knie/i],
  block: [/block/i],
  taunt: [/taunt/i],
  jubel: [/jubel/i],
  kick: [/kick/i],
  /* "sit" ist die Haltung eines Verletzten am Boden. Seit es eine echte
     Sitzbewegung namens "sitzen" gibt, darf das Muster nicht mehr locker
     auf /sit/ passen - sonst gewinnt sie hier und K.-o.-Gegner sitzen
     plotzlich auf einem unsichtbaren Stuhl. */
  sit: [/^sit$/i, /hurt/i, /crouch/i, /dying/i, /death/i],
  webbed: [/idle/i],
  downed: [/dying/i, /death/i, /sit/i, /idle/i],
  attack: [/punch/i, /attack/i, /kick/i, /melee/i, /combat/i],
};
const GLB_FALLBACK = {
  walk: ['run', 'idle'], run: ['walk', 'idle'],
  jump: ['air', 'run', 'idle'], air: ['jump', 'run', 'idle'],
  land: ['idle'], roll: ['run', 'idle'], hit: ['idle'],
  punch: ['attack'], punch2: ['punch', 'attack'], punch3: ['punch', 'attack'],
  hook: ['punch', 'attack'], hook2: ['hook', 'punch', 'attack'],
  luftangriff: ['kick', 'attack'], knie: ['kick', 'attack'],
  block: ['idle'], taunt: ['idle'], jubel: ['idle'],
  kick: ['attack'],
  swing: ['air', 'run', 'idle'], climb: ['walk', 'idle'],
  klettern_frei: ['climb'], klettern_seit: ['climb'],
  kante: ['climb', 'jump'], haengen: ['climb', 'idle'],
  fallrolle: ['roll', 'land'], wandlauf: ['run'], uppercut: ['punch', 'attack'],
  wurf: ['punch', 'attack'], telefon: ['idle'], warten: ['idle'], umschauen: ['idle'],
  sitzen: ['sit', 'idle'], reden: ['idle'], streiten: ['idle'], tippen: ['telefon', 'idle'],
  trinken: ['idle'], gelangweilt: ['idle'], froh: ['idle'], winken: ['jubel', 'idle'],
  ziehen: ['idle'], stampfen: ['kick', 'attack'],
  schwung2: ['schwung', 'swing'], flip_v: ['frontflip', 'roll'], flip_h: ['backflip', 'roll'],
  /* Fuer den Gleitflug gibt es keine eigene Datei. Ersatz war bisher die
     RUHEHALTUNG - deshalb stand die Figur im Gleitflug kerzengerade in der
     Luft und nur die Arme waren zur Seite gelegt. Der Sturzflug ("Straight
     Dive") liegt dagegen flach auf dem Bauch, Kopf voran: genau die
     Grundhaltung, die ein Gleitflug braucht. */
  gleiten: ['sturzflug', 'sturzflug2', 'air'],
  sturzflug: ['sturzflug2', 'air'], sturzflug2: ['sturzflug', 'air'],
  wandsprung: ['jump', 'air'], netzwurf: ['schwung2', 'swing'],
  zip_dreh: ['zip_zug', 'air'],
  zip_ab: ['jump', 'air'], zip_zug: ['air'],
  ausw_v: ['roll'], ausw_vr: ['ausweichenR', 'roll'], ausw_r: ['ausweichenR', 'roll'],
  ausw_hr: ['ausweichenR', 'roll'], ausw_h: ['roll'], ausw_hl: ['ausweichenL', 'roll'],
  ausw_l: ['ausweichenL', 'roll'], ausw_vl: ['ausweichenL', 'roll'],
  rolle_v: ['roll'], rolle_vr: ['roll'], rolle_r: ['roll'], rolle_hr: ['roll'],
  rolle_h: ['roll'], rolle_hl: ['roll'], rolle_l: ['roll'], rolle_vl: ['roll'],
  spin_l: ['ausweichenL', 'roll'], spin_r: ['ausweichenR', 'roll'],
  ausweichenL: ['roll'], ausweichenR: ['roll'],
  sit: ['idle'], webbed: ['idle'], downed: ['sit', 'idle'], attack: [],
};

function findClip(clips, key) {
  for (const re of GLB_CLIP_PATTERNS[key] || []) {
    const c = clips.find((cl) => re.test(cl.name) && !/t-?pose/i.test(cl.name));
    if (c) return c;
  }
  return null;
}

/* ---- Netz-Kostüm: färbt ein Menschmodell zum Helden um ----
   Rot am Oberkörper, Blau an Beinen und Oberarmen, dunkle Netzlinien –
   alles über Vertexfarben, damit es ohne passende Textur funktioniert. */
/* Dreieckwelle 0..1 aus einer Zahl. WICHTIG: JavaScript liefert bei
   negativen Zahlen einen negativen Rest - "(-2.3) % 1" ist -0.3, nicht
   0.7. Der Speichenwinkel laeuft aber von -PI bis +PI, und dadurch kam
   auf der einen Koerperhaelfte ein Wert bis 3 heraus statt bis 1: jede
   Schwelle war dort erfuellt, die halbe Figur war deshalb flaechig hell
   statt fein genetzt. Genau so sah der Symbiontenanzug aus. */
function welle(v) {
  const f = v - Math.floor(v);
  return Math.abs(f - 0.5) * 2;
}

const SUIT_ROT = new THREE.Color(0xc8102e);
const SUIT_BLAU = new THREE.Color(0x1b3fa0);
const SUIT_NETZ = new THREE.Color(0x2a0409);
/* Symbiontenanzug: fast schwarz mit hellem Netz. */
const SYM_SCHWARZ = new THREE.Color(0x0c0c11);
const SYM_NETZ = new THREE.Color(0xd8dae4);

/* Welche Körperpartie gehört zu welchem Knochen?
   So sitzen die Farbgrenzen exakt an Schulter, Hüfte und Handgelenk –
   unabhängig davon, welche Kleidung das Ausgangsmodell trägt. */
function partieFuerKnochen(name) {
  const n = name.replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();
  if (/toe|foot/.test(n)) return 'rot';        // Stiefel
  if (/leg/.test(n)) return 'blau';            // Beine
  if (/hand|thumb|index|middle|ring|pinky/.test(n)) return 'rot';   // Handschuhe
  if (/forearm|arm$/.test(n) && /left|right/.test(n)) return 'blau';// Arme
  return 'rot';                                // Rumpf, Kopf, Schultern
}

/* ---- Dunkle Stellen einer Textur anheben ----
   out = in^0,62 auf 0..1 gerechnet. Ein dunkles Blau von 30 wird damit zu
   82, ein kraeftiges Rot von 200 nur zu 213 - die Zeichnung bleibt also
   erhalten, aber die Beine verschwinden nicht mehr im Schwarz.
   Das Ergebnis wird je Quelltextur gemerkt: alle sieben Teilnetze des
   Helden benutzen dieselbe Datei. */
const _hellCache = new WeakMap();
function hebeSchatten(tex) {
  if (!tex || !tex.image) return tex;
  /* WICHTIG: eine schon angehobene Textur darf NICHT noch einmal durch die
     Kurve. Ein Modell besteht aus vielen Netzen, die sich Materialien
     teilen; beim zweiten Netz stand in mat.map schon das Ergebnis vom
     ersten, und ohne diese Sperre wurde bei 42 Netzen 42-mal angehoben -
     die Gegner kamen danach schneeweiss heraus. */
  if (tex.userData && tex.userData.schonGehoben) return tex;
  const fertig = _hellCache.get(tex);
  if (fertig) return fertig;
  try {
    const bild = tex.image;
    const bw = bild.width || bild.videoWidth, bh = bild.height || bild.videoHeight;
    if (!bw || !bh) return tex;
    /* ---- Warum das Bild verkleinert wird ----
       Die Anzugtextur ist 4096 x 4096. Ein Canvas dieser Groesse belegt
       67 MB, und getImageData verlangt die gleiche Menge noch einmal.
       Auf dem iPad gibt Safari dafuer stillschweigend eine LEERE Flaeche
       zurueck - kein Fehler, keine Ausnahme, einfach Nullen. Die
       angehobene Textur war dort also durchgehend schwarz, und weil jede
       Figur durch diese Funktion geht, waren ALLE Figuren schwarz.
       Auf 2048 gerechnet sind es 16 MB; das haelt jedes Geraet aus, und
       an einer Figur sieht man den Unterschied nicht. */
    const HOECHST = 2048;
    const f = Math.min(1, HOECHST / Math.max(bw, bh));
    const w = Math.max(1, Math.round(bw * f)), h = Math.max(1, Math.round(bh * f));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bild, 0, 0, bw, bh, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    const a = d.data;
    /* Ist wirklich etwas angekommen? Eine leere Flaeche waere schwarz -
       dann lieber die Originaltextur behalten als eine schwarze Figur. */
    let summe = 0;
    for (let i = 0; i < a.length; i += Math.max(4, (a.length >> 10) & ~3)) {
      summe += a[i] + a[i + 1] + a[i + 2];
    }
    if (summe < 8) return tex;
    /* Kurve einmal als Tabelle - 256 Werte statt Millionen Potenzen. */
    const tab = new Uint8Array(256);
    for (let i = 0; i < 256; i++) tab[i] = Math.round(255 * Math.pow(i / 255, 0.62));
    for (let i = 0; i < a.length; i += 4) {
      a[i] = tab[a[i]]; a[i + 1] = tab[a[i + 1]]; a[i + 2] = tab[a[i + 2]];
    }
    g.putImageData(d, 0, 0);
    const neu = new THREE.CanvasTexture(c);
    neu.flipY = tex.flipY;
    neu.wrapS = tex.wrapS; neu.wrapT = tex.wrapT;
    neu.encoding = tex.encoding;
    neu.anisotropy = tex.anisotropy;
    neu.needsUpdate = true;
    neu.userData.schonGehoben = true;
    _hellCache.set(tex, neu);
    return neu;
  } catch (e) {
    /* Laesst sich die Datei nicht lesen, bleibt es beim Original. */
    return tex;
  }
}

/* ---- Symbiontentextur aus der Anzugtextur ----
   Der erste Versuch hat das Netz als Eckpunktfarben gerechnet. Auf einem
   Modell mit ein paar tausend Punkten wird daraus kein feines Netz,
   sondern ein Muster aus hellen Flecken - "was sind das fuer weisse
   Punkte", und mit Spider-Man hatte das nichts mehr zu tun.
   Richtig ist, die vorhandene Anzugtextur zu benutzen: sie hat das echte
   Netz, die Spinne und die Naehte schon drin. Gesucht sind darin genau
   die Netzlinien - und die sind DUNKLER als ihre Umgebung.
   Also: die Textur einmal stark weichzeichnen, und jeden Bildpunkt mit
   seiner Umgebung vergleichen. Ist er deutlich dunkler, war es eine
   Netzlinie und wird hell; sonst wird er fast schwarz. Das Ergebnis ist
   derselbe Anzug in Schwarz-Weiss - mit demselben Netz, derselben Spinne,
   denselben Kanten. */
const _symTexCache = new WeakMap();
function symbiontTextur(tex) {
  if (!tex || !tex.image) return null;
  const fertig = _symTexCache.get(tex);
  if (fertig) return fertig;
  try {
    const bild = tex.image;
    const bw = bild.width || bild.videoWidth, bh = bild.height || bild.videoHeight;
    if (!bw || !bh) return null;
    /* Gleiche Deckelung wie in hebeSchatten: ein Canvas von 4096 x 4096
       liefert auf dem iPad nur Nullen, und der Anzug waere schwarz. */
    const HOECHST = 2048;
    const f = Math.min(1, HOECHST / Math.max(bw, bh));
    const w = Math.max(1, Math.round(bw * f)), h = Math.max(1, Math.round(bh * f));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bild, 0, 0, bw, bh, 0, 0, w, h);
    const scharf = g.getImageData(0, 0, w, h).data;
    /* Weichzeichnen ueber Verkleinern und wieder Vergroessern - das macht
       die Grafikkarte und kostet nichts. Der Faktor 10 entspricht bei
       1024 px rund 50 px Umkreis: breiter als jede Netzlinie, schmaler
       als die roten und blauen Felder. */
    const kw = Math.max(4, Math.round(w / 10)), kh = Math.max(4, Math.round(h / 10));
    const k = document.createElement('canvas');
    k.width = kw; k.height = kh;
    k.getContext('2d').drawImage(c, 0, 0, kw, kh);
    g.clearRect(0, 0, w, h);
    g.drawImage(k, 0, 0, w, h);
    const weich = g.getImageData(0, 0, w, h).data;
    const out = g.createImageData(w, h);
    const o = out.data;
    const hell = [232, 235, 242], dunkel = [12, 12, 16];
    for (let i = 0; i < o.length; i += 4) {
      const L  = 0.299 * scharf[i] + 0.587 * scharf[i + 1] + 0.114 * scharf[i + 2];
      const Lb = 0.299 * weich[i]  + 0.587 * weich[i + 1]  + 0.114 * weich[i + 2];
      /* Wie viel dunkler als die Umgebung? Die Netzlinien dieses Anzugs
         sind nur wenig dunkler als das Rot - mit der ersten Schwelle (4
         bis 24) blieb fast alles schwarz und man sah kein Netz mehr.
         Gemessen am Bild: ab 1 faengt es an, ab 9 ist es eine volle
         Linie. */
      let t = (Lb - L - 1) / 8;
      /* Auch deutlich HELLERE Stellen bleiben hell: die Augenlinsen der
         Maske und die weissen Kanten. */
      const heller = (L - Lb - 10) / 20;
      t = Math.max(t, heller);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      t = t * t * (3 - 2 * t);                    // weiche Kante
      o[i]     = dunkel[0] + (hell[0] - dunkel[0]) * t;
      o[i + 1] = dunkel[1] + (hell[1] - dunkel[1]) * t;
      o[i + 2] = dunkel[2] + (hell[2] - dunkel[2]) * t;
      o[i + 3] = scharf[i + 3];
    }
    g.putImageData(out, 0, 0);
    const neu = new THREE.CanvasTexture(c);
    neu.flipY = tex.flipY;
    neu.wrapS = tex.wrapS; neu.wrapT = tex.wrapT;
    neu.encoding = tex.encoding;
    neu.anisotropy = tex.anisotropy;
    neu.needsUpdate = true;
    _symTexCache.set(tex, neu);
    return neu;
  } catch (e) { return null; }
}

/* ---- Symbiontenanzug fuer ein fertiges, texturiertes Modell ----
   Das Muster wird in der RUHEPOSE gerechnet: die Ringe liegen dann fest
   auf dem Koerper und wandern beim Bewegen mit, statt im Raum zu stehen.
   Als Bezug dient die Huelle ALLER Netze der Figur zusammen - sonst
   bekaeme jedes Teilnetz eigene Ringe und sie passten nicht aneinander. */
const _symHuelle = new WeakMap();
function symHuelleVon(mesh) {
  /* Die Wurzel der Figur suchen und ihre Gesamthuelle einmal messen. */
  let root = mesh;
  while (root.parent && !root.parent.isScene) root = root.parent;
  let h = _symHuelle.get(root);
  if (h) return h;
  const box = new THREE.Box3();
  let leer = true;
  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (!o.geometry || !o.geometry.attributes.position) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox);
    leer = false;
  });
  if (leer) return null;
  h = { minY: box.min.y, hoehe: (box.max.y - box.min.y) || 1,
        mitteX: (box.max.x + box.min.x) / 2, mitteZ: (box.max.z + box.min.z) / 2 };
  _symHuelle.set(root, h);
  return h;
}

function baueSymbiontFuerModell(o) {
  const geo = o.geometry;
  const pos = geo && geo.attributes.position;
  if (!pos || !pos.count) return;
  /* Weg 1 (der gute): das Modell hat eine Anzugtextur. Dann wird sie
     schwarzweiss umgerechnet und einfach eingehaengt - derselbe Anzug,
     dasselbe Netz, dieselbe Spinne, nur in Symbiontenfarben. */
  const mat0 = Array.isArray(o.material) ? o.material[0] : o.material;
  if (mat0 && mat0.map) {
    const symTex = symbiontTextur(mat0.map);
    if (symTex) {
      o.userData.normalMat = o.material;
      const sm = mat0.clone();
      sm.map = symTex;
      sm.color = new THREE.Color(0xffffff);
      if (sm.emissive) sm.emissive.setHex(0x101014);
      if (sm.roughness !== undefined) sm.roughness = 0.35;
      if (sm.metalness !== undefined) sm.metalness = 0.15;
      if (sm.shininess !== undefined) sm.shininess = 80;
      if (sm.specular) sm.specular.setHex(0x8a90a0);
      o.userData.symMat = sm;
      return;
    }
  }
  /* Weg 2: kein Bild da - dann bleibt nur das gerechnete Netz. */
  const h = symHuelleVon(o);
  if (!h) return;
  const farben = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = (y - h.minY) / h.hoehe;
    const winkel = Math.atan2(x - h.mitteX, z - h.mitteZ);
    /* Eckpunktfarben koennen nur so fein sein wie das Netz selbst. Mit 26
       Ringen und Schwelle 0,90 lagen gemessen 59 % aller Punkte auf einer
       Linie - der Anzug waere hell statt schwarz gewesen. Weniger Ringe,
       engere Schwelle: rund ein Sechstel der Flaeche. */
    const ring = welle(t * 15);
    const speiche = welle((winkel / Math.PI) * 7);
    c.copy(SYM_SCHWARZ);
    if (ring > 0.955 || speiche > 0.955) c.lerp(SYM_NETZ, 0.85);
    /* Die grosse helle Spinne vorn auf der Brust. */
    if (z > h.mitteZ) {
      const dy = t - 0.74, dx = (x - h.mitteX) / h.hoehe;
      if ((Math.abs(dx) < 0.030 && dy > -0.090 && dy < 0.032) ||
          (Math.abs(dy + 0.032) < 0.014 && Math.abs(dx) < 0.090)) c.setHex(0xe8eaf2);
    }
    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  o.userData.normalMat = o.material;
  o.userData.symMat = new THREE.MeshPhongMaterial({
    vertexColors: true, skinning: !!o.isSkinnedMesh,
    shininess: 85, specular: 0x9aa0b0,
  });
}

function faerbeAlsKostuem(mesh, bbox) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos) return;
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  const knochenNamen = (mesh.skeleton && mesh.skeleton.bones)
    ? mesh.skeleton.bones.map((b) => partieFuerKnochen(b.name)) : null;
  const hoehe = bbox.max.y - bbox.min.y || 1;
  const mitteX = (bbox.max.x + bbox.min.x) / 2;
  const mitteZ = (bbox.max.z + bbox.min.z) / 2;
  const farben = new Float32Array(pos.count * 3);
  const symFarben = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), cs = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let rot = true;
    if (knochenNamen && skinIndex && skinWeight) {
      // Der Knochen mit dem größten Gewicht bestimmt die Partie
      let bestIdx = skinIndex.getX(i), bestW = skinWeight.getX(i);
      const paare = [[skinIndex.getY(i), skinWeight.getY(i)],
                     [skinIndex.getZ(i), skinWeight.getZ(i)],
                     [skinIndex.getW(i), skinWeight.getW(i)]];
      for (const [idx, w] of paare) if (w > bestW) { bestW = w; bestIdx = idx; }
      rot = knochenNamen[bestIdx] !== 'blau';
    } else {
      rot = (pos.getY(i) - bbox.min.y) / hoehe > 0.52;   // Notfall ohne Skelett
    }
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = (y - bbox.min.y) / hoehe;
    const winkel = Math.atan2(x - mitteX, z - mitteZ);
    const ring = welle(t * 20);
    const speiche = welle((winkel / Math.PI) * 7);
    const imNetz = ring > 0.92 || speiche > 0.94;

    c.copy(rot ? SUIT_ROT : SUIT_BLAU);
    /* Feines Netzmuster nur auf Rot – Ringe und Speichen um die Körperachse */
    if (rot && imNetz) c.lerp(SUIT_NETZ, 0.55);
    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;

    /* ---- Zweite Farbreihe: der Symbiontenanzug ----
       Bisher lag sie nur beim selbstgebauten Anzug bereit. Der Held traegt
       aber ein fertiges Modell, und fuer das blieb nur "Materialfarbe auf
       fast schwarz setzen" - deshalb war die Figur mit T einfach eine
       schwarze Silhouette ohne jedes Netz. Genau das war die Beschwerde.
       Jetzt entsteht die Symbiontenfaerbung hier gleich mit: schwarz, das
       Netz hell UND auf dem ganzen Koerper (nicht nur auf Rot), dazu die
       grosse helle Spinne ueber der Brust. */
    cs.copy(SYM_SCHWARZ);
    if (imNetz) cs.lerp(SYM_NETZ, 0.8);
    /* Spinne: senkrechter Leib plus ausgestellte Beine, vorn auf der
       Brust. Die Masse sind Bruchteile der Koerperhoehe, damit sie zu
       jedem Modell passen. */
    if (z > mitteZ) {
      const dy = t - 0.74, dx = (x - mitteX) / hoehe;
      const leib = Math.abs(dx) < 0.028 && dy > -0.085 && dy < 0.030;
      const beine = Math.abs(dy + 0.030) < 0.013 && Math.abs(dx) < 0.085;
      if (leib || beine) cs.setHex(0xe8eaf2);
    }
    symFarben[i * 3] = cs.r; symFarben[i * 3 + 1] = cs.g; symFarben[i * 3 + 2] = cs.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  /* Beide Reihen bleiben liegen - der Wechsel ist dann nur ein Kopieren. */
  geo.userData.anzugFarben = farben;
  geo.userData.symbiontFarben = symFarben;
  /* Leicht glänzend, damit es nach Anzugstoff aussieht und nicht nach Hemd.
     skinning muss in Three.js r128 ausdrücklich an sein. */
  mesh.material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    skinning: !!mesh.isSkinnedMesh,
    shininess: 22,
    specular: 0x222226,
  });
}

/* ---- Anliegender Anzugkörper ----
   Die Mixamo-Alltagsmodelle tragen T-Shirt und Shorts – umfärben allein
   ergibt keinen Superhelden. Deshalb wird hier ein eigener, schlanker
   Körper direkt auf das vorhandene Skelett gebaut: für jeden Knochen ein
   sich verjüngendes Rohr plus Kugeln an den Gelenken. Das Ergebnis ist
   hauteng, bewegt sich mit den geladenen Animationen und sieht nach Anzug
   aus statt nach Freizeitkleidung. */

/* ---- Anzugkörper ----
   Der Körper wird als durchgehende Hülle um die Knochenketten gelegt:
   entlang jeder Kette (Rumpf, Arme, Beine) laufen Ringe, deren Radius weich
   überblendet und deren Gewichte zwischen zwei Nachbarknochen verteilt sind.
   Dadurch gibt es keine sichtbaren Segmentkanten und keine Kugelgelenke
   mehr – die Figur wirkt wie ein Mensch im hautengen Anzug. */

/* Ketten mit Radien in Metern, bezogen auf eine 1,76 m große Figur */
const KOERPER_KETTEN = [
  { knochen: ['hips', 'spine', 'spine1', 'spine2', 'neck', 'head'],
    radien: [0.150, 0.122, 0.142, 0.168, 0.064, 0.072],
    breit: 1.18, tief: 0.82, kappeAnfang: true },
  { knochen: ['leftshoulder', 'leftarm', 'leftforearm', 'lefthand'],
    radien: [0.082, 0.072, 0.052, 0.044], breit: 1, tief: 1, kappeEnde: true },
  { knochen: ['rightshoulder', 'rightarm', 'rightforearm', 'righthand'],
    radien: [0.082, 0.072, 0.052, 0.044], breit: 1, tief: 1, kappeEnde: true },
  { knochen: ['leftupleg', 'leftleg', 'leftfoot', 'lefttoebase'],
    radien: [0.108, 0.072, 0.055, 0.042], breit: 1, tief: 1, kappeEnde: true },
  { knochen: ['rightupleg', 'rightleg', 'rightfoot', 'righttoebase'],
    radien: [0.108, 0.072, 0.055, 0.042], breit: 1, tief: 1, kappeEnde: true },
];
const RING_ECKEN = 14;      // Auflösung rund um den Körper
const RING_PRO_TEIL = 5;    // Zwischenringe je Knochenabschnitt

function knochenSchluessel(name) {
  return name.replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();
}

function baueAnzugKoerper(quelle, einheit) {
  const skeleton = quelle.skeleton;
  if (!skeleton || !skeleton.bones.length) return null;
  const index = {};
  skeleton.bones.forEach((b, i) => { const k = knochenSchluessel(b.name); if (!(k in index)) index[k] = i; });
  if (index.hips === undefined || index.head === undefined) return null;

  /* Bindepose: Lage jedes Knochens im Geometrieraum */
  const bindInv = new THREE.Matrix4().copy(quelle.bindMatrix).invert();
  const knochenPos = skeleton.bones.map((b, i) => new THREE.Vector3().setFromMatrixPosition(
    new THREE.Matrix4().copy(bindInv).multiply(
      new THREE.Matrix4().copy(skeleton.boneInverses[i]).invert())));

  let minY = Infinity, maxY = -Infinity;
  for (const p of knochenPos) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const hoehe = Math.max(0.001, maxY - minY);
  const brust = knochenPos[index.spine2 !== undefined ? index.spine2 : index.spine1];

  const pos = [], farb = [], symFarb = [], sIdx = [], sGew = [], idx = [];

  /* Die Farben stecken als Eckpunktfarben in der Geometrie, nicht in einer
     Textur - ein Anzugwechsel laesst sich deshalb nicht durch Austauschen
     eines Bildes machen. Stattdessen wird die zweite Farbreihe beim Bauen
     gleich mit berechnet und spaeter nur noch eingehaengt. Das kostet
     einmalig etwas Speicher und beim Wechsel gar nichts.
     sym = true liefert den Symbionten: schwarzer Anzug, weisses Netz,
     grosse weisse Spinne. */
  function farbeFuer(bone, punkt, sym) {
    const partie = partieFuerKnochen(skeleton.bones[bone].name);
    const c = sym ? new THREE.Color(SYM_SCHWARZ)
                  : new THREE.Color(partie === 'blau' ? SUIT_BLAU : SUIT_ROT);
    if (sym || partie !== 'blau') {
      const t = (punkt.y - minY) / hoehe;
      const winkel = Math.atan2(punkt.x, punkt.z);
      const ring = welle(t * 30);
      const speiche = welle((winkel / Math.PI) * 9);
      if (ring > 0.9 || speiche > 0.92) c.lerp(sym ? SYM_NETZ : SUIT_NETZ, sym ? 0.85 : 0.65);
    }
    if (brust && punkt.z > brust.z) {   // Spinnenzeichen auf der Brust
      const dy = (punkt.y - brust.y) / einheit, dx = (punkt.x - brust.x) / einheit;
      /* Die Spinne des Symbionten ist deutlich groesser und hell - beim
         Vorbild zieht sie sich ueber die ganze Brust. */
      const gr = sym ? 2.6 : 1;
      if ((Math.abs(dx) < 0.026 * gr && dy > -0.10 * gr && dy < 0.015 * gr) ||
          (Math.abs(dy + 0.042 * gr) < 0.011 * gr && Math.abs(dx) < 0.07 * gr)) {
        c.setHex(sym ? 0xe6e8f0 : 0x140609);
      }
    }
    return c;
  }

  function punktAnhaengen(p, bone, gewicht2, bone2) {
    pos.push(p.x, p.y, p.z);
    const b3 = gewicht2 > 0.5 && bone2 !== undefined ? bone2 : bone;
    const c = farbeFuer(b3, p, false);
    farb.push(c.r, c.g, c.b);
    const cs = farbeFuer(b3, p, true);
    symFarb.push(cs.r, cs.g, cs.b);
    sIdx.push(bone, bone2 === undefined ? 0 : bone2, 0, 0);
    sGew.push(1 - gewicht2, gewicht2, 0, 0);
    return pos.length / 3 - 1;
  }

  const hoch = new THREE.Vector3(0, 1, 0);
  const vorne = new THREE.Vector3(0, 0, 1);

  for (const kette of KOERPER_KETTEN) {
    const bones = kette.knochen.map((k) => index[k]);
    if (bones.some((b) => b === undefined)) continue;
    const punkte = bones.map((b) => knochenPos[b]);

    /* Stationen entlang der Kette aufbauen */
    const stationen = [];
    for (let i = 0; i < punkte.length - 1; i++) {
      const teile = RING_PRO_TEIL;
      for (let j = 0; j < teile; j++) {
        const t = j / teile;
        const glatt = t * t * (3 - 2 * t);          // weicher Übergang
        stationen.push({
          p: new THREE.Vector3().lerpVectors(punkte[i], punkte[i + 1], t),
          r: lerp(kette.radien[i], kette.radien[i + 1], glatt) * einheit,
          b1: bones[i], b2: bones[i + 1], w: t,
        });
      }
    }
    const letzte = punkte.length - 1;
    stationen.push({ p: punkte[letzte].clone(), r: kette.radien[letzte] * einheit,
                     b1: bones[letzte], b2: bones[letzte], w: 0 });

    /* Ringe mit mitgeführter Normale erzeugen (verhindert Verdrehen) */
    let normale = null;
    const ringe = [];
    for (let i = 0; i < stationen.length; i++) {
      const st = stationen[i];
      const vor = stationen[Math.min(i + 1, stationen.length - 1)].p;
      const zurueck = stationen[Math.max(i - 1, 0)].p;
      const richtung = new THREE.Vector3().subVectors(vor, zurueck);
      if (richtung.lengthSq() < 1e-10) richtung.copy(hoch);
      richtung.normalize();
      if (!normale) {
        normale = Math.abs(richtung.dot(vorne)) < 0.9
          ? new THREE.Vector3().crossVectors(richtung, vorne).normalize()
          : new THREE.Vector3().crossVectors(richtung, hoch).normalize();
      } else {
        normale.addScaledVector(richtung, -normale.dot(richtung));
        if (normale.lengthSq() < 1e-8) normale.crossVectors(richtung, hoch);
        normale.normalize();
      }
      const binormale = new THREE.Vector3().crossVectors(richtung, normale).normalize();
      const ring = [];
      for (let k = 0; k < RING_ECKEN; k++) {
        const a = (k / RING_ECKEN) * TAU;
        const p = st.p.clone()
          .addScaledVector(normale, Math.cos(a) * st.r * (kette.tief || 1))
          .addScaledVector(binormale, Math.sin(a) * st.r * (kette.breit || 1));
        ring.push(punktAnhaengen(p, st.b1, st.w, st.b2));
      }
      ringe.push({ ecken: ring, st });
    }

    for (let i = 0; i < ringe.length - 1; i++) {
      const a = ringe[i].ecken, b = ringe[i + 1].ecken;
      for (let k = 0; k < RING_ECKEN; k++) {
        const k2 = (k + 1) % RING_ECKEN;
        idx.push(a[k], b[k], b[k2]);
        idx.push(a[k], b[k2], a[k2]);
      }
    }
    /* Enden schließen */
    if (kette.kappeEnde) {
      const r = ringe[ringe.length - 1];
      const m = punktAnhaengen(r.st.p, r.st.b1, r.st.w, r.st.b2);
      for (let k = 0; k < RING_ECKEN; k++) idx.push(r.ecken[k], m, r.ecken[(k + 1) % RING_ECKEN]);
    }
    if (kette.kappeAnfang) {
      const r = ringe[0];
      const m = punktAnhaengen(r.st.p, r.st.b1, r.st.w, r.st.b2);
      for (let k = 0; k < RING_ECKEN; k++) idx.push(r.ecken[(k + 1) % RING_ECKEN], m, r.ecken[k]);
    }
  }

  /* Kopf als eigene Kugel (der Kopfknochen sitzt am Halsansatz) */
  if (index.head !== undefined) {
    const kp = knochenPos[index.head];
    const auf = index.neck !== undefined
      ? new THREE.Vector3().subVectors(kp, knochenPos[index.neck]).normalize() : hoch.clone();
    const geo = new THREE.SphereGeometry(0.115 * einheit, 18, 14);
    geo.scale(0.92, 1.12, 1.02);
    geo.translate(kp.x + auf.x * 0.09 * einheit, kp.y + auf.y * 0.09 * einheit, kp.z + auf.z * 0.09 * einheit);
    const gp = geo.attributes.position, basis = pos.length / 3;
    const v = new THREE.Vector3();
    for (let i = 0; i < gp.count; i++) {
      v.set(gp.getX(i), gp.getY(i), gp.getZ(i));
      punktAnhaengen(v, index.head, 0, index.head);
    }
    for (let i = 0; i < geo.index.count; i++) idx.push(basis + geo.index.getX(i));
    geo.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(farb, 3));
  /* Beide Farbreihen aufheben - der Wechsel kopiert nur noch. */
  geometry.userData.anzugFarben = new Float32Array(farb);
  geometry.userData.symbiontFarben = new Float32Array(symFarb);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sGew, 4));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();

  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshPhongMaterial({
    vertexColors: true, skinning: true, shininess: 40, specular: 0x33333a,
  }));
  mesh.position.copy(quelle.position);
  mesh.quaternion.copy(quelle.quaternion);
  mesh.scale.copy(quelle.scale);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(skeleton, quelle.bindMatrix);
  return mesh;
}

/* Augenlinsen sauber auf die Maske setzen.
   Die mitgelieferten Augen dieses Modells hängen an einem eigenen Steuer-Rig
   und sitzen schon in der Ruhepose neben dem Gesicht. Sie werden deshalb
   ausgeblendet und durch zwei Linsen ersetzt, die fest am Kopfknochen sitzen. */
function setzeMaskenAugen(inner) {
  let kopf = null;
  inner.traverse((o) => { if (!kopf && o.isBone && /head$/i.test(o.name)) kopf = o; });
  if (!kopf) return;
  // vorhandene Augen des Modells ausblenden
  inner.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && /eye|auge/i.test(m.name || ''))) o.visible = false;
  });
  /* Die lokalen Achsen eines Kopfknochens zeigen je nach Modell in beliebige
     Richtungen. Deshalb werden Lage und Ausrichtung in Weltkoordinaten
     bestimmt (Modell schaut nach +Z) und danach in den Knochenraum
     umgerechnet – so sitzen die Linsen bei jedem Rig im Gesicht. */
  inner.updateMatrixWorld(true);
  const kopfInv = new THREE.Matrix4().copy(kopf.matrixWorld).invert();
  /* Den echten Schädel ausmessen: alle Vertices, deren stärkster Knochen der
     Kopf ist. Daraus ergibt sich, wo vorne, oben und seitlich wirklich ist –
     unabhängig davon, wie das Rig aufgebaut ist. */
  const schaedel = new THREE.Box3();
  schaedel.makeEmpty();
  const _pv = new THREE.Vector3();
  inner.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry.attributes.skinIndex) return;
    const kopfNr = o.skeleton.bones.indexOf(kopf);
    if (kopfNr < 0) return;
    const pos = o.geometry.attributes.position;
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
    for (let i = 0; i < pos.count; i++) {
      let bi = si.getX(i), bw = sw.getX(i);
      if (sw.getY(i) > bw) { bw = sw.getY(i); bi = si.getY(i); }
      if (sw.getZ(i) > bw) { bw = sw.getZ(i); bi = si.getZ(i); }
      if (sw.getW(i) > bw) { bw = sw.getW(i); bi = si.getW(i); }
      if (bi !== kopfNr) continue;
      _pv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      schaedel.expandByPoint(_pv);
    }
  });
  const kopfMitte = new THREE.Vector3().setFromMatrixPosition(kopf.matrixWorld);
  let breite = 0.16, augenY = kopfMitte.y + 0.075, augenZ = kopfMitte.z + 0.079;
  if (!schaedel.isEmpty()) {
    const mitte = schaedel.getCenter(new THREE.Vector3());
    const groesse = schaedel.getSize(new THREE.Vector3());
    breite = groesse.x;
    kopfMitte.x = mitte.x;
    augenY = mitte.y + groesse.y * 0.09;
    augenZ = schaedel.max.z - groesse.z * 0.13;
  }
  const kopfDreh = new THREE.Quaternion();
  kopf.getWorldQuaternion(kopfDreh);
  const drehInv = kopfDreh.clone().invert();
  const skal = new THREE.Vector3();
  kopf.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), skal);
  const sk = skal.x || 1;
  const weiss = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  const rand = new THREE.MeshBasicMaterial({ color: 0x08080a });
  for (const seite of [-1, 1]) {
    const stelle = new THREE.Vector3(kopfMitte.x + seite * breite * 0.23, augenY, augenZ);
    const dreh = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.1, seite * 0.33, seite * -0.30));
    const auge = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), weiss);
    auge.position.copy(stelle.clone().applyMatrix4(kopfInv));
    auge.quaternion.copy(drehInv.clone().multiply(dreh));
    const gr = (breite / 0.16);
    auge.scale.set(1.3 * gr / sk, 1.75 * gr / sk, 0.34 * gr / sk);
    kopf.add(auge);
    const umriss = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 10), rand);
    umriss.position.copy(auge.position);
    umriss.quaternion.copy(auge.quaternion);
    umriss.scale.set(1.3 * gr / sk, 1.75 * gr / sk, 0.30 * gr / sk);
    kopf.add(umriss);
  }
}

/* Weiße Augenlinsen an den Kopfknochen hängen (alte Fassung) */
function setzeAugen(inner) {
  let kopf = null;
  inner.traverse((o) => { if (!kopf && o.isBone && /head$/i.test(o.name)) kopf = o; });
  if (!kopf) return;
  inner.updateMatrixWorld(true);
  const skal = new THREE.Vector3();
  kopf.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), skal);
  const gruppe = new THREE.Group();
  gruppe.scale.setScalar(1 / (skal.x || 1));    // ab hier in Metern rechnen
  kopf.add(gruppe);
  const weiss = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rand = new THREE.MeshBasicMaterial({ color: 0x14060a });
  for (const seite of [-1, 1]) {
    const auge = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), weiss);
    auge.scale.set(1.3, 1.7, 0.5);
    auge.position.set(seite * 0.05, 0.095, 0.088);
    auge.rotation.set(0.1, seite * 0.34, seite * -0.36);
    gruppe.add(auge);
    const umriss = new THREE.Mesh(new THREE.SphereGeometry(0.051, 10, 8), rand);
    umriss.scale.set(1.3, 1.7, 0.46);
    umriss.position.copy(auge.position).multiplyScalar(0.985);
    umriss.rotation.copy(auge.rotation);
    gruppe.add(umriss);
  }
}

function makeGlbVisual(m) {
  const root = new THREE.Group();
  /* Drehreihenfolge Y-X-Z: Erst die Blickrichtung, dann die Vorlage um die
     KÖRPEREIGENE Querachse, dann die Kurvenlage um die Flugachse. In der
     Standardreihenfolge X-Y-Z kippt rotation.x um die WELT-X-Achse – beim
     Schwingen nach Osten legte sich die Figur dadurch seitlich, statt sich
     nach vorn zu neigen. */
  root.rotation.order = 'YXZ';
  const inner = THREE.SkeletonUtils.clone(m.scene);
  inner.scale.setScalar(m.scale);
  inner.position.y = m.yOffset * m.scale;
  /* Reihenfolge Z-X-Y, also R = Rz . Rx . Ry:
       Ry  richtet das Modell aus (jede Datei schaut anders herum),
       Rx  kippt die Figur an die Wand (siehe wandKriechen),
       Rz  rollt sie danach um die WANDNORMALE - damit zeigt der Kopf in
           die Richtung, in die sie an der Fassade unterwegs ist.
     Mit der Standardreihenfolge XYZ waere Rz die INNERSTE Drehung
     gewesen, also eine Drehung um die eigene Laengsachse - die Figur
     haette sich um sich selbst geschraubt, statt sich an der Wand zu
     drehen. Solange rotation.z null ist, sind beide Reihenfolgen
     identisch. */
  inner.rotation.order = 'ZXY';
  inner.rotation.y = m.yaw;
  /* Die Figur waagerecht ueber ihren Punkt schieben. Der Versatz wird
     mitgedreht, weil inner selbst um yaw gedreht ist. */
  const gvSin = Math.sin(m.yaw || 0), gvCos = Math.cos(m.yaw || 0);
  const gvX = (m.xOffset || 0) * m.scale, gvZ = (m.zOffset || 0) * m.scale;
  const grundX = gvX * gvCos + gvZ * gvSin;
  const grundZ = -gvX * gvSin + gvZ * gvCos;
  inner.position.x = grundX;
  inner.position.z = grundZ;
  const bbox = new THREE.Box3().setFromObject(m.scene);
  const originale = [];
  inner.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true; o.frustumCulled = false;
      originale.push(o);
      /* ---- Metallanteil zuruecknehmen ----
         Ein voll metallisches Material hat KEINE eigene Farbe: es zeigt
         nur die Spiegelung seiner Umgebung. Eine Umgebungskarte gibt es
         hier nicht, also bleibt so ein Teil schwarz - egal wie hell die
         Sonne scheint.
         Gemessen bringt das Heldenmodell fuer den groessten Teil des
         Anzugs metalness = 1 mit (Object_3), die Zivilisten und Gegner
         0,4. Genau das war "alle Charaktere sind schwarz": nicht das
         Licht war zu dunkel, sondern die Haut hat gar keine Farbe
         zurueckgegeben. */
      for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!mat || mat.metalness === undefined) continue;
        if (mat.metalness > 0.08) mat.metalness = 0.08;
        if (mat.roughness !== undefined) mat.roughness = clamp(mat.roughness, 0.35, 0.9);
      }
      /* Sehr dunkle Anzüge verschwinden im Schatten der Häuserschluchten –
         ein Hauch Eigenleuchten hält die Silhouette sichtbar. */
      if (m.aufhellen) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat && mat.emissive) mat.emissive.setHex(0x14141a);
          /* Das reichte nicht: die Beine des Anzugs sind dunkelblau, und
             unter Sonne plus Himmelslicht kamen sie als schwarze Flaeche
             heraus - man sah unterhalb der Huefte gar keine Form mehr.
             Ein gleichmaessiger Aufschlag auf die Materialfarbe wuerde das
             Rot mit aufhellen und ausbleichen. Stattdessen wird die
             TEXTUR mit einer Kurve angehoben: dunkle Stellen deutlich,
             helle kaum. */
          if (mat && mat.map) mat.map = hebeSchatten(mat.map);
        }
      }
    }
  });
  if (m.suit) {
    /* Zuerst versuchen, einen anliegenden Anzugkörper zu bauen. Klappt das,
       verschwindet die Alltagskleidung des Ausgangsmodells komplett. */
    let ersetzt = false;
    /* Modelle bestehen oft aus mehreren Teilen (Körper, Haare, Schuhe) mit
       jeweils eigenem Teilskelett. Für den Anzug wird das Teil mit den
       meisten Knochen gebraucht – nur das kennt Arme UND Beine. */
    const kandidaten = originale
      .filter((o) => o.isSkinnedMesh && o.skeleton && o.skeleton.bones.length)
      .sort((a, b) => b.skeleton.bones.length - a.skeleton.bones.length);
    if (kandidaten.length) {
      const anzug = baueAnzugKoerper(kandidaten[0], 1 / (m.scale || 1));
      if (anzug) { kandidaten[0].parent.add(anzug); ersetzt = true; }
    }
    if (ersetzt) {
      for (const o of originale) o.visible = false;
    } else {
      // Notfall: wenigstens einfärben
      for (const o of originale) { o.geometry = o.geometry.clone(); faerbeAlsKostuem(o, bbox); }
    }
    setzeAugen(inner);
  }
  root.add(inner);
  /* Fußknochen merken – damit die Figur nie im Boden versinkt */
  const fuesse = [];
  inner.traverse((o) => {
    if (o.isBone && /(left|right) ?foot$/i.test(o.name.replace(/mixamorig:?/i, ''))) fuesse.push(o);
  });
  /* Die Punkte, mit denen die Figur in der Dachhocke wirklich aufliegt:
     Zehenballen und Fingerspitzen. Der Knöchel taugt dafür nicht - er
     steht in der Hocke schräg über dem abgewinkelten Fuß. */
  const auflagen = [];
  inner.traverse((o) => {
    if (!o.isBone) return;
    const n = o.name.replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();
    if (/^(left|right)toebase$/.test(n) || /^(left|right)handmiddle4$/.test(n)) auflagen.push(o);
  });
  /* Alle Knochen merken – beim Umfallen wird daran der tiefste Punkt
     gesucht, denn die Füße sind dann nicht mehr das Unterste. */
  const alleKnochen = [];
  inner.traverse((o) => { if (o.isBone) alleKnochen.push(o); });
  const basisY = inner.position.y;
  /* Kippung der inneren Gruppe (Wandkriechen), immer <= 0. */
  let innerKipp = 0;
  let fussRuhe = null, bodenKorrektur = 0, schattenAn = true;
  /* Höhe des Knöchels über der Sohle. */
  const KNOECHEL_HOCH = 0.095;
  /* Ruhehöhe der Füße JETZT aus der Bindehaltung messen – noch bevor
     irgendeine Bewegung läuft. Früher wurde sie beim ersten Bildaufbau
     genommen; fiel die Figur da gerade (angezogene Beine), merkte sich der
     Ausgleich eine viel zu hohe Ruhelage und hob die Figur dauerhaft
     mehrere Handbreit über den Boden. */
  if (fuesse.length) {
    inner.updateMatrixWorld(true);
    let tiefster = Infinity;
    const _mess = new THREE.Vector3();
    for (const f of fuesse) { f.getWorldPosition(_mess); tiefster = Math.min(tiefster, _mess.y); }
    if (isFinite(tiefster)) fussRuhe = tiefster - root.position.y;
  }

  /* Handknochen merken – daran hängt später der Netzfaden */
  const haende = { L: null, R: null };
  inner.traverse((o) => {
    if (!o.isBone) return;
    if (!haende.R && /right ?hand$/i.test(o.name.replace(/mixamorig:?/i, ''))) haende.R = o;
    if (!haende.L && /left ?hand$/i.test(o.name.replace(/mixamorig:?/i, ''))) haende.L = o;
  });
  const mixer = new THREE.AnimationMixer(inner);
  const actions = {};
  function actionFor(key) {
    if (key in actions) return actions[key];
    let clip = findClip(m.clips, key);
    if (!clip) {
      for (const fb of (GLB_FALLBACK[key] || [])) {
        clip = findClip(m.clips, fb);
        if (clip) break;
      }
    }
    actions[key] = clip ? mixer.clipAction(clip) : null;
    return actions[key];
  }
  /* Knochen für die Pose-Korrekturen merken */
  const knochen = {};
  inner.traverse((o) => {
    if (!o.isBone) return;
    const n = o.name.replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();
    if (!knochen[n]) knochen[n] = o;
  });
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _va = new THREE.Vector3(), _vb = new THREE.Vector3();
  /* Ruhelage jedes Knochens JETZT sichern – vor der ersten Bewegung.
     Beim Mixamo-Skelett liegt die Ruhedrehung der Oberschenkel bei rund
     ±π um Z. Wer diese Winkel als Eulerwerte gegen 0 zieht, dreht das Bein
     um 180° – und die Figur steht im Spagat. Genau das war der Grund für
     die gespreizten Beine am Netz. Mit der gesicherten Ruhelage lässt sich
     stattdessen sauber dorthin zurückblenden. */
  const ruheDrehung = new Map();
  inner.traverse((o) => { if (o.isBone) ruheDrehung.set(o, o.quaternion.clone()); });
  const _qd = new THREE.Quaternion(), _ed = new THREE.Euler();
  const _qz = new THREE.Quaternion();
  const _vw1 = new THREE.Vector3(), _vw2 = new THREE.Vector3();
  const _vw3 = new THREE.Vector3(), _vw4 = new THREE.Vector3();
  const _hf = new THREE.Vector3(), _hs = new THREE.Vector3(), _hp = new THREE.Vector3();
  const _hp2 = new THREE.Vector3();
  const _fh = new THREE.Vector3();
  const _mA = new THREE.Matrix4(), _mB = new THREE.Matrix4();

  /* Eigenachsen der Hände aus der Bindehaltung ablesen: wohin zeigen die
     Finger, wohin die Handfläche? Ohne das lässt sich die Hand nicht
     gezielt auf eine Wand legen – die Ziel-Kinematik dreht den Unterarm
     zwar zur Wand, die Drehung UM den Arm bleibt dabei aber frei. Genau
     deshalb zeigten beim Klettern beide Handflächen nach außen. */
  const handBasis = {};
  (() => {
    inner.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    for (const seite of ['left', 'right']) {
      const hand = knochen[seite + 'hand'];
      const mitte = knochen[seite + 'handmiddle1'];
      const zeige = knochen[seite + 'handindex1'];
      const klein = knochen[seite + 'handpinky1'];
      if (!hand || !mitte || !zeige || !klein) continue;
      const finger = mitte.position.clone().normalize();
      const spreiz = klein.position.clone().sub(zeige.position).normalize();
      const flaeche = new THREE.Vector3().crossVectors(finger, spreiz).normalize();
      /* In der Bindehaltung zeigen die Handflächen nach unten – daran
         lässt sich das Vorzeichen festmachen. */
      hand.getWorldQuaternion(q);
      if (flaeche.clone().applyQuaternion(q).y > 0) flaeche.negate();
      const quer = new THREE.Vector3().crossVectors(flaeche, finger).normalize();
      handBasis[seite] = { finger, quer, flaeche };
    }
  })();

  /* Dasselbe für die Füße: Richtung der Zehen und Richtung der Sohle in
     der Bindehaltung. Ohne diese Basis lässt sich der Fuß nur ausrichten,
     nicht abrollen – die Sohle zeigte dann irgendwohin und der Fuß wirkte,
     als hinge er ohne Knochen am Bein. */
  const fussBasis = {};
  (() => {
    inner.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    for (const seite of ['left', 'right']) {
      const fuss = knochen[seite + 'foot'];
      const zeh = knochen[seite + 'toebase'];
      if (!fuss || !zeh) continue;
      const zehen = zeh.position.clone().normalize();
      /* Die Sohle zeigt in der Bindehaltung nach unten. */
      fuss.getWorldQuaternion(q);
      const runter = new THREE.Vector3(0, -1, 0).applyQuaternion(q.clone().invert());
      /* Nur den Anteil senkrecht zur Zehenrichtung behalten. */
      const sohle = runter.addScaledVector(zehen, -runter.dot(zehen));
      if (sohle.lengthSq() < 1e-6) continue;
      sohle.normalize();
      const quer = new THREE.Vector3().crossVectors(sohle, zehen).normalize();
      fussBasis[seite] = { zehen, quer, sohle };
    }
  })();

  /* Fuß so drehen, dass die Zehen in zehenWelt zeigen und die Sohle auf
     sohleWelt liegt (also flach an der Wand). */
  function setzeFuss(seite, zehenWelt, sohleWelt, k) {
    const fb = fussBasis[seite];
    const fuss = knochen[seite + 'foot'];
    if (!fb || !fuss) return;
    fuss.updateMatrixWorld(true);
    _hp.copy(sohleWelt).normalize();
    _hf.copy(zehenWelt).addScaledVector(_hp, -_hf.dot(_hp));
    if (_hf.lengthSq() < 1e-6) return;
    _hf.normalize();
    _hs.crossVectors(_hp, _hf).normalize();
    _mA.makeBasis(fb.zehen, fb.quer, fb.sohle).transpose();
    _mB.makeBasis(_hf, _hs, _hp).multiply(_mA);
    _q.setFromRotationMatrix(_mB);
    /* Vom Weltraum in den Raum des Unterschenkels. */
    fuss.parent.getWorldQuaternion(_q2);
    _q.premultiply(_q2.invert());
    fuss.quaternion.slerp(_q, k === undefined ? 1 : k);
    fuss.updateMatrixWorld(true);
  }

  /* Finger leicht einkrallen – die Bewegungsdateien enthalten keine
     Fingerspuren, deshalb standen die Hände beim Klettern mit gespreizten,
     kerzengeraden Fingern an der Wand wie ein Seestern. */
  function krallen(seite, staerke) {
    for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      for (let g = 1; g <= 3; g++) {
        const b = knochen[seite + 'hand' + f + g];
        if (!b) continue;
        const s = staerke * (f === 'thumb' ? 0.45 : 1) * (g === 1 ? 0.65 : 1);
        drehZuRuhe(b, s, 0, 0, 0.85);
      }
    }
  }

  /* ---- Ruhende Hand ----
     Die Bewegungsdateien bringen keine Fingerspuren mit (entferneFinger),
     also steht die Hand in der RUHEHALTUNG des Modells - und die ist bei
     diesen Rigs eine flach ausgestreckte Hand mit weit abgespreiztem
     Daumen. Im Spiel sah das aus wie ein Seestern am Arm; genau das war
     "was soll das mit dem Daumen".
     Eine haengende Hand ist nie flach: die Finger sind leicht gekruemmt,
     das Mittelglied am staerksten, und der Daumen liegt neben dem
     Zeigefinger statt quer abzustehen.
     Wird die Hand gebraucht (Klettern, Faust, Netzschuss), setzen die
     dortigen Funktionen ihre eigenen Werte - sie rechnen alle gegen die
     Ruhehaltung und ueberschreiben diese hier einfach. */
  function ruheHand(seite, k) {
    const kk = k === undefined ? 1 : k;
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      for (let g = 1; g <= 3; g++) {
        const b = knochen[seite + 'hand' + f + g];
        if (!b) continue;
        /* Kleiner Finger etwas staerker als Zeigefinger - so faellt eine
           Hand wirklich zu. */
        const rand = f === 'pinky' ? 1.18 : f === 'ring' ? 1.10 : f === 'middle' ? 1.0 : 0.9;
        /* Seit drehZuRuhe richtig mischt, ist k ein echtes Gewicht - mit
           0,55 blieben die Finger halb offen stehen. */
        drehZuRuhe(b, (g === 1 ? 0.30 : g === 2 ? 0.46 : 0.36) * rand * kk, 0, 0, 0.85);
      }
    }
    /* ---- Daumen ----
       Hier wurden Winkel gesetzt, die aus der Faust abgeleitet waren. Das
       war falsch: nachgemessen liegt die Daumenspitze in der RUHEHALTUNG
       des Modells nur 5,7 cm neben dem Mittelglied des Zeigefingers - der
       Daumen ist dort also schon natuerlich angelegt. Die gesetzten Werte
       haben ihn erst abgespreizt.
       Ein Abtasten ueber alle drei Achsen (100 Kombinationen) fand als
       engste Haltung 3,9 cm. Genommen wird ein Drittel davon: etwas
       angelegter als die Ruhe, ohne die Modellierung zu verbiegen. */
    for (let g = 1; g <= 3; g++) {
      const b = knochen[seite + 'handthumb' + g];
      if (!b) continue;
      drehZuRuhe(b, 0.20 * kk * (g === 1 ? 1 : 0.7),
                 g === 1 ? -0.30 * kk : 0,
                 (g === 1 ? 0.30 : 0.20) * kk, 0.8);
    }
  }

  /* Faust um einen Gegenstand: Finger fest eingerollt, der Daumen legt
     sich quer darüber. Die Fingerspuren sind aus den Bewegungsdateien
     entfernt, deshalb bleiben die Finger sonst offen stehen – Handy und
     Regenschirm schwebten dadurch in einer flachen Hand. */
  function faust(seite, staerke) {
    const k = staerke === undefined ? 1 : staerke;
    for (const f of ['index', 'middle', 'ring', 'pinky']) {
      for (let g = 1; g <= 3; g++) {
        const b = knochen[seite + 'hand' + f + g];
        if (!b) continue;
        /* Das erste Glied klappt am weitesten, die Spitzen legen sich an. */
        drehZuRuhe(b, (g === 1 ? 1.15 : g === 2 ? 1.35 : 1.0) * k, 0, 0, 0.9);
      }
    }
    for (let g = 1; g <= 3; g++) {
      const b = knochen[seite + 'handthumb' + g];
      if (!b) continue;
      /* Der Daumen liegt quer über den Fingern, nicht in derselben Achse. */
      drehZuRuhe(b, 0.35 * k, g === 1 ? -0.5 * k : 0, (g === 1 ? 0.55 : 0.75) * k, 0.9);
    }
  }

  /* Hand so drehen, dass die Finger in fingerWelt zeigen und die
     Handfläche in flaecheWelt (also flach auf der Wand liegt). */
  function setzeHand(seite, fingerWelt, flaecheWelt, k) {
    const hb = handBasis[seite];
    const hand = knochen[seite + 'hand'];
    if (!hb || !hand) return;
    hand.updateMatrixWorld(true);
    _hp.copy(flaecheWelt).normalize();
    _hf.copy(fingerWelt).addScaledVector(_hp, -_hf.dot(_hp));
    if (_hf.lengthSq() < 1e-6) return;
    _hf.normalize();
    _hs.crossVectors(_hp, _hf).normalize();
    _mA.makeBasis(hb.finger, hb.quer, hb.flaeche).transpose();
    _mB.makeBasis(_hf, _hs, _hp).multiply(_mA);
    _q.setFromRotationMatrix(_mB);
    hand.parent.getWorldQuaternion(_q2);
    _q2.invert().multiply(_q);
    hand.quaternion.slerp(_q2, clamp(k, 0, 1));
  }
  /* Knochen zur Ruhelage ziehen und von dort um kleine Winkel auslenken. */
  /* Einen Knochen auf "Ruhehaltung plus feste Winkel" ziehen.
     Hier stand vorher:
         bone.quaternion.slerp(ruhe, k);
         bone.quaternion.multiply(euler);
     Das ist etwas ganz anderes: k bestimmte nur, wie weit die LAUFENDE
     Haltung zur Ruhe zurueckgeholt wird - die Zielwinkel kamen danach
     jedes Mal in voller Groesse obendrauf. Solange eine Bewegungsdatei
     den Knochen in jedem Bild neu setzt, faellt das nicht auf. Sobald
     sie das nicht tut - und beim Netzschwung steht der Clip still -,
     summiert sich der Winkel Bild fuer Bild auf und der Knochen dreht
     sich durch.
     Gemessen am linken Fuss im Schwung: mit der Schwunghaltung 14,5 cm
     je Bild, ohne sie 1,3 cm. Das war das Rudern mit den Beinen.
     Richtig ist: erst die Zielhaltung ausrechnen, dann anteilig dorthin
     drehen. Damit ist k ein echtes Gewicht und nichts kann aufsummieren. */
  function drehZuRuhe(bone, ax, ay, az, k) {
    if (!bone) return;
    const ruhe = ruheDrehung.get(bone);
    if (!ruhe) return;
    _ed.set(ax || 0, ay || 0, az || 0);
    _qz.copy(ruhe).multiply(_qd.setFromEuler(_ed));
    bone.quaternion.slerp(_qz, clamp(k, 0, 1));
  }

  /* Einen Knochen auf einen Weltpunkt ausrichten (einfache Ziel-Kinematik).
     Die Knochenachse ergibt sich aus der Lage des Kindknochens. */
  function zieleKnochen(bone, child, zielWelt, staerke) {
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    _va.copy(child.position).normalize();                       // Knochenachse (lokal)
    _vb.setFromMatrixPosition(bone.matrixWorld);
    _vb.subVectors(zielWelt, _vb).normalize();                  // Zielrichtung (Welt)
    bone.parent.getWorldQuaternion(_q2);
    _vb.applyQuaternion(_q2.invert());                          // in Elternraum
    _q.setFromUnitVectors(_va, _vb);
    bone.quaternion.slerp(_q, staerke === undefined ? 1 : staerke);
    bone.updateMatrixWorld(true);
  }

  /* ---- Ein Glied ZUM ZIEL NACHDREHEN, ohne die Haltung zu verwerfen ----
     zieleKnochen() setzt eine ABSOLUTE Ausrichtung: der Knochen zeigt
     danach zum Ziel, seine gesamte animierte Verdrehung ist weg. Fuer den
     Griff an der Fassade ist das falsch. Dort greift die Korrektur nur,
     solange das Glied nahe an der Wand ist - geht es im Kletterschritt aus
     der Reichweite heraus, fiel die Haltung schlagartig auf die reine
     Bewegungsdatei zurueck. Gemessen sprang die Fussspitze dabei 86
     Zentimeter in EINEM Bild, und zwar in jedem Kletterschritt aufs Neue.
     Hier wird stattdessen nur die DIFFERENZ gedreht: um genau den Winkel
     zwischen der jetzigen und der gewuenschten Richtung. Ist die Korrektur
     klein, ist auch die Drehung klein - und die animierte Verdrehung des
     Beins bleibt erhalten (deshalb stehen die Fuesse jetzt auch richtig
     herum an der Wand). */
  const _gp0 = new THREE.Vector3(), _gp1 = new THREE.Vector3();
  const _gu = new THREE.Vector3(), _gv = new THREE.Vector3(), _gax = new THREE.Vector3();
  function griffKnochen(bone, child, zielWelt, staerke, maxWinkel) {
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    _gp0.setFromMatrixPosition(bone.matrixWorld);
    child.getWorldPosition(_gp1);
    _gu.subVectors(_gp1, _gp0);
    _gv.subVectors(zielWelt, _gp0);
    if (_gu.lengthSq() < 1e-8 || _gv.lengthSq() < 1e-8) return;
    _gu.normalize(); _gv.normalize();
    const winkel = Math.acos(clamp(_gu.dot(_gv), -1, 1));
    if (winkel < 0.0015) return;
    _gax.crossVectors(_gu, _gv);
    if (_gax.lengthSq() < 1e-8) return;
    _gax.normalize();
    const grenze = maxWinkel === undefined ? 0.5 : maxWinkel;
    drehKnochenWelt(bone, _gax, Math.min(winkel * clamp(staerke, 0, 1), grenze), 1);
    bone.updateMatrixWorld(true);
  }

  /* Einen Knochen um eine WELTACHSE weiterdrehen, ohne seine bisherige
     Haltung zu verwerfen. Object3D.rotateOnWorldAxis rechnet bei gedrehtem
     Elternknochen falsch, deshalb hier von Hand. */
  const _ikH = new THREE.Vector3(), _ikK = new THREE.Vector3();
  const _ikA = new THREE.Vector3(), _ikT = new THREE.Vector3();
  const _ikU = new THREE.Vector3(), _ikV = new THREE.Vector3();
  const _ikAx = new THREE.Vector3();
  const _ikQ = new THREE.Quaternion(), _ikQ2 = new THREE.Quaternion();
  const _ikQ3 = new THREE.Quaternion();
  function drehKnochenWelt(bone, achseWelt, winkel, k) {
    if (!bone || !winkel) return;
    _ikQ.setFromAxisAngle(achseWelt, winkel);
    bone.getWorldQuaternion(_ikQ2);
    _ikQ2.premultiply(_ikQ);                       // Zieldrehung in der Welt
    bone.parent.getWorldQuaternion(_ikQ3);
    _ikQ2.premultiply(_ikQ3.invert());             // in den Elternraum
    bone.quaternion.slerp(_ikQ2, k === undefined ? 1 : k);
  }

  function drehe(bone, x, y, z, k) {
    if (!bone) return;
    bone.rotation.x = lerp(bone.rotation.x, x, k);
    bone.rotation.y = lerp(bone.rotation.y, y || 0, k);
    bone.rotation.z = lerp(bone.rotation.z, z || 0, k);
  }

  let current = null;
  let lodAcc = 0, lodFrame = 0;
  let vGlatt = 0, geht = true;
  let letzterTakt = null;
  /* Geglaettete Lage im Netzbogen und der zuletzt gespielte Zustand. */
  let bogenGlatt = 0, letzterKey = null;
  let angriff = null, angriffT = 0;
  return {
    root, procedural: false, mixer,
    /* Nur fuer Messungen im Test: die Knochen des Rigs. */
    knochen,
    /* Schwung-Pose: Arm zum Netzanker strecken, Beine anziehen, Rumpf neigen.
       Die Beine werden vollständig gesetzt (nicht angenähert) – sonst kämpft
       die laufende Geh-Animation dagegen an und die Beine zappeln. */
    poseSchwung(zielWelt, seite, t, bogen, neigung, beide, staerke) {
      const _sk = staerke === undefined ? 1 : clamp(staerke, 0, 1);
      if (_sk <= 0.001) return;
      const gross = seite === 'L' ? 'leftarm' : 'rightarm';
      const klein = seite === 'L' ? 'leftforearm' : 'rightforearm';
      const hand = seite === 'L' ? 'lefthand' : 'righthand';
      const andere = seite === 'L' ? 'rightarm' : 'leftarm';
      const andereK = seite === 'L' ? 'rightforearm' : 'leftforearm';
      const andereH = seite === 'L' ? 'righthand' : 'lefthand';
      /* Nur der Netzarm wird geführt. Die Beine überlässt der Schwung der
         laufenden Animation – eigene Beinposen haben gegen sie gearbeitet
         und zu zuckenden Beinen geführt. */
      /* Der Oberarm zeigt zum Anker, der Unterarm bleibt leicht gebeugt.
         Beide Glieder auf den Anker zu richten streckt den Arm vollständig
         durch – bei waagerechtem Körper landet er dann HINTER dem Kopf,
         und die Figur sah verrenkt aus. */
      zieleKnochen(knochen[gross], knochen[klein], zielWelt, _sk);
      drehe(knochen[klein], -0.14, 0, 0, _sk);
      const wiegen = Math.sin((t || 0) * 1.6) * 0.1;
      drehe(knochen[andere], -0.3 + wiegen, 0, seite === 'L' ? -0.7 : 0.7, 0.5 * _sk);
      drehe(knochen[andereK], -0.5, 0, 0, 0.5 * _sk);
      /* Die geladene Hänge-Bewegung steht fast still – am Netz sah das aus
         wie eine eingefrorene Puppe. Ein ruhiger Beintakt im Rhythmus des
         Pendels bringt Leben hinein, ohne der Bewegung ins Handwerk zu
         pfuschen (halbes Gewicht, kleine Ausschläge). */
      const takt = Math.sin((t || 0) * 2.3);
      /* Gibt es die echte Schwunghaltung, fuehrt sie die Beine. Die
         selbstgesetzten Winkel legen sich dann nur noch leicht darueber
         (0,35 statt 0,9) und bringen den Pendeltakt hinein - vorher haben
         sie die Bewegungsdatei vollstaendig ueberschrieben. */
      const k = (findClip(m.clips, 'schwung') ? 0.15
              : findClip(m.clips, 'schwungpose') ? 0.35 : 0.9) * _sk;
      /* lage: -1 = es geht abwärts in den Bogen hinein, +1 = es geht wieder
         hinauf. Am tiefsten Punkt zieht man die Beine an, oben streckt man
         sie nach vorn – erst dadurch wirkt der Schwung gelöst statt wie
         eine an einem Faden hängende Puppe. */
      const lage = clamp(bogen === undefined ? 0 : bogen, -1, 1);
      const anziehen = 1 - Math.abs(lage);          // 1 am Tiefpunkt
      const strecken = Math.max(0, lage);           // 1 im Aufstieg
      /* Am Netz hing die Figur bisher kerzengerade – das wirkte steif wie
         eine Puppe. Jetzt sind die Beine deutlich angewinkelt und laufen
         nach hinten aus, die Knie schwingen gegenläufig mit dem Pendel und
         der Rumpf legt sich nach vorn in den Bogen. */
      /* Der Körper liegt jetzt flach in Flugrichtung. Die Beine sollen
         dabei hinterherziehen, nicht nach vorn geklappt werden – also
         kaum Hüftbeugung, dafür angewinkelte Knie. Am Tiefpunkt zieht er
         sie an, im Aufstieg streckt er sie aus. */
      const hueft = 0.04 + anziehen * 0.18 - strecken * 0.16;
      const knie = 0.45 + anziehen * 0.75 - strecken * 0.32;
      /* Die Beine wirkten wie ein Stück Stoff: beide Gelenke folgten
         demselben Sinus, die Knöchel wurden gar nicht geführt und alles
         bewegte sich in einer Ebene. Drei Dinge machen daraus ein Bein
         mit Knochen:
         1. das Knie läuft dem Oberschenkel nach (Phasenversatz),
         2. der Knöchel folgt dem Knie noch später und streckt den Spann,
         3. die Beine scheren leicht seitlich, statt parallel zu pendeln. */
      const takt2 = Math.sin((t || 0) * 2.3 - 0.55);       // Knie hinkt nach
      const takt3 = Math.sin((t || 0) * 2.3 - 1.05);       // Knöchel noch später
      const schere = 0.10 + Math.sin((t || 0) * 1.15) * 0.16;   // Beine nie parallel

      drehZuRuhe(knochen.leftupleg,  hueft + takt * 0.34, 0, schere, k);
      drehZuRuhe(knochen.rightupleg, hueft + 0.06 - takt * 0.34, 0, -schere, k);

      /* Das Knie beugt nur in eine Richtung – ein negativer Wert würde das
         Bein nach vorn überstrecken. */
      /* Auch das Knie hat eine Grenze: rund 140° (2,4 rad) sind das
         Äußerste, davor liegt die Ferse am Gesäß. */
      const knieL = clamp(knie + 0.22 - takt2 * 0.46, 0.12, 2.2);
      const knieR = clamp(knie - 0.24 + takt2 * 0.46, 0.12, 2.2);
      drehZuRuhe(knochen.leftleg,  knieL, 0, 0, k);
      drehZuRuhe(knochen.rightleg, knieR, 0, 0, k);

      /* Knöchel: je stärker das Knie gebeugt ist, desto mehr zeigt der Fuß
         nach hinten weg – aber nur so weit, wie ein Fuß das kann.
         Vorher wurde die Kniebeugung ungebremst aufaddiert; bei stark
         angezogenen Beinen kam der Knöchel auf über 90° und der Fuß knickte
         Richtung Schienbein. Ein Fuß streckt sich rund 50° (Spann) und
         beugt sich rund 20° zurück. */
      const KNOECHEL_MAX = 0.85, KNOECHEL_MIN = -0.3;
      if (knochen.leftfoot) {
        drehZuRuhe(knochen.leftfoot,
          clamp(0.2 + knieL * 0.3 + takt3 * 0.16, KNOECHEL_MIN, KNOECHEL_MAX), 0, 0, k * 0.9);
      }
      if (knochen.rightfoot) {
        drehZuRuhe(knochen.rightfoot,
          clamp(0.2 + knieR * 0.3 - takt3 * 0.16, KNOECHEL_MIN, KNOECHEL_MAX), 0, 0, k * 0.9);
      }
      if (knochen.lefttoebase) drehZuRuhe(knochen.lefttoebase, 0.22, 0, 0, k * 0.7);
      if (knochen.righttoebase) drehZuRuhe(knochen.righttoebase, 0.22, 0, 0, k * 0.7);
      /* Rumpf: am Tiefpunkt eingerollt, im Aufstieg aufgerichtet, dazu
         eine leichte Drehung zum Netzarm hin. */
      drehe(knochen.spine1, -0.06 + anziehen * 0.16 - strecken * 0.12,
            (seite === 'L' ? 0.12 : -0.12) + takt * 0.05, 0, 0.5 * _sk);
      drehe(knochen.spine, -0.04 + anziehen * 0.08, seite === 'L' ? 0.08 : -0.08, 0, 0.4 * _sk);
      /* Beide Hände am Netz oder nur eine?
         Im Vorbild hängt Spider-Man meist an EINER Hand; mit beiden greift
         er zu, wenn er sich kräftig hochzieht. Genau so ist es hier: beim
         Pumpen (W) fasst die zweite Hand an denselben Faden, sonst zieht
         der freie Arm gestreckt nach hinten – vorher stand er wie
         vergessen in der Luft. */
      if (beide) {
        /* Die zweite Hand greift NEBEN die erste an denselben Faden. Sie
           zielt deshalb nicht auf den Anker – das streckte den Arm hinter
           den Kopf –, sondern auf einen Punkt kurz über der Netzhand. */
        knochen[hand].getWorldPosition(_vw1);
        _vw2.copy(zielWelt).sub(_vw1).normalize();
        _vw3.copy(_vw1).addScaledVector(_vw2, 0.42);
        zieleKnochen(knochen[andere], knochen[andereK], _vw3, 0.95 * _sk);
        drehe(knochen[andereK], -0.2, 0, 0, 0.95 * _sk);
        faust(seite === 'L' ? 'right' : 'left', _sk);
      } else {
        /* Nach hinten ausgestreckt in Flugrichtung – wie ein Ruder. */
        drehe(knochen[andere], -0.15 + wiegen * 1.4 - strecken * 0.25, 0,
              seite === 'L' ? -0.55 : 0.55, 0.75 * _sk);
        drehe(knochen[andereK], -0.12 - anziehen * 0.25, 0, 0, 0.75 * _sk);
        faust(seite === 'L' ? 'right' : 'left', 0.55 * _sk);
      }
      /* Die Netzhand ist eine feste Faust um den Faden. */
      faust(seite === 'L' ? 'left' : 'right', _sk);
      /* Der Kopf hält gegen die Vorlage, damit der Blick nach vorn geht
         und nicht auf den Asphalt. */
      /* Bei 66° Vorlage muss der Blick um denselben Betrag zurückgenommen
         werden, sonst schaut die Figur senkrecht auf die Straße. Die
         Gegendrehung verteilt sich auf Kopf, Hals und obere Wirbelsäule –
         auf einen Knochen allein sähe sie verrenkt aus. */
      const gegen = -(neigung || 0);
      drehZuRuhe(knochen.head, gegen * 0.55, 0, 0, 0.85 * _sk);
      drehZuRuhe(knochen.neck, gegen * 0.3, 0, 0, 0.8 * _sk);
      drehe(knochen.spine2, gegen * 0.22, 0, 0, 0.55 * _sk);
    },
    /* Schlagbewegung: Ausholen, Durchziehen, Zurücknehmen.
       Jeder Treffer der Kette sieht anders aus – Jab, Haken, Tritt und
       Abschluss-Schlag – statt immer derselben Animation. */
    poseSchlag(t, art, arm, stufe) {
      const links = arm === 'L';
      const sh = links ? 'leftarm' : 'rightarm';
      const el = links ? 'leftforearm' : 'rightforearm';
      const shA = links ? 'rightarm' : 'leftarm';
      const elA = links ? 'rightforearm' : 'leftforearm';
      const seite = links ? 1 : -1;
      const aus = clamp(t / 0.3, 0, 1);            // Ausholen
      const zieh = clamp((t - 0.28) / 0.22, 0, 1); // Durchziehen
      const zurueck = clamp((t - 0.58) / 0.42, 0, 1);
      const stoss = zieh - zurueck;                // 0..1..0

      if (art === 'kick') {
        const bein = links ? 'leftupleg' : 'rightupleg';
        const knie = links ? 'leftleg' : 'rightleg';
        drehe(knochen[bein], lerp(0.45 * aus, -1.75, stoss), 0, 0, 1);
        drehe(knochen[knie], lerp(1.7 * aus, 0.12, stoss), 0, 0, 1);
        drehe(knochen.spine1, -0.3 * stoss, 0, 0, 1);
        drehe(knochen[sh], -0.5, 0, seite * -0.7, 1);
        drehe(knochen[shA], -0.5, 0, seite * 0.7, 1);
        return;
      }
      /* Faustschlag: Schulter dreht mit, Arm streckt sich beim Treffer */
      const haken = stufe % 2 === 1;               // abwechselnd gerade / Haken
      drehe(knochen[sh], lerp(0.5 * aus, -1.55, stoss), haken ? seite * -0.5 * stoss : 0,
            seite * (haken ? -0.5 : -0.12) * stoss, 1);
      drehe(knochen[el], lerp(-1.9 * aus, -0.06, stoss), 0, 0, 1);
      drehe(knochen[shA], -0.45 + 0.3 * stoss, 0, seite * 0.55, 1);
      drehe(knochen[elA], -1.1, 0, 0, 1);
      drehe(knochen.spine1, 0.12 * stoss, seite * 0.42 * stoss, 0, 1);
      drehe(knochen.spine2, 0, seite * 0.3 * stoss, 0, 1);
      drehe(knochen.head, 0, seite * -0.2 * stoss, 0, 1);
    },
    /* Getroffen: kurzes Zurückzucken */
    poseTreffer(t) {
      const z = Math.sin(clamp(t, 0, 1) * Math.PI);
      drehe(knochen.spine1, -0.45 * z, 0, 0, 1);
      drehe(knochen.spine2, -0.3 * z, 0, 0, 1);
      drehe(knochen.head, -0.35 * z, 0, 0, 1);
      drehe(knochen.leftarm, -0.4 * z, 0, 0.6 * z, 1);
      drehe(knochen.rightarm, -0.4 * z, 0, -0.6 * z, 1);
    },
    /* Kletter-Pose: flach an der Wand, Arme und Beine greifen abwechselnd */
    poseKlettern(phase) {
      const g = Math.sin(phase);          // Greifzyklus
      drehe(knochen.spine, 0.22, 0, 0, 1);
      drehe(knochen.spine1, 0.16, 0, 0, 1);
      drehe(knochen.head, -0.75, 0, 0, 1);        // Kopf schaut nach oben
      // Arme über Kopf, wechselseitig weiter greifend
      drehe(knochen.leftarm, -2.5 - g * 0.45, 0, 0.55, 1);
      drehe(knochen.rightarm, -2.5 + g * 0.45, 0, -0.55, 1);
      drehe(knochen.leftforearm, -0.55 + g * 0.3, 0, 0, 1);
      drehe(knochen.rightforearm, -0.55 - g * 0.3, 0, 0, 1);
      // Beine angewinkelt wie beim Krabbeln
      drehe(knochen.leftupleg, -1.15 + g * 0.5, 0, 0.4, 1);
      drehe(knochen.rightupleg, -1.15 - g * 0.5, 0, -0.4, 1);
      drehe(knochen.leftleg, 1.5 - g * 0.35, 0, 0, 1);
      drehe(knochen.rightleg, 1.5 + g * 0.35, 0, 0, 1);
      drehe(knochen.leftfoot, 0.5, 0, 0, 1);
      drehe(knochen.rightfoot, 0.5, 0, 0, 1);
    },
    /* Wandkriechen: Die geladene Kletter-Bewegung stammt von einer Leiter –
       die Figur greift dort vor der Brust und steht aufrecht. An einer
       Hauswand sieht das falsch aus. Hier werden Hände und Füße deshalb
       auf echte Punkte AN DER WAND gezielt: Arme weit oben und außen,
       Knie seitlich abgespreizt. Das ergibt die typische Spinnenhaltung,
       ohne dass eine neue Bewegungsdatei nötig wäre. */
    poseWandkriechen(nx, nz, phase, k) {
      root.updateMatrixWorld(true);
      const rechts = _vw1.set(nz, 0, -nx);        // seitlich an der Wand
      const rein = _vw2.set(-nx, 0, -nz);         // Richtung Wand
      /* Die Leiter-Bewegung schiebt das Becken fast einen Meter nach
         hinten – deshalb schwebte die Figur sichtbar VOR dem Haus, statt
         daran zu kleben. Dieser Versatz wird hier weggerechnet: das Becken
         steht wieder senkrecht über dem Anfasspunkt an der Wand.
         Achsen von root: lokal +Z zeigt zur Wand, lokal +X nach links. */
      if (knochen.hips) {
        knochen.hips.getWorldPosition(_vw3);
        const dx = _vw3.x - root.position.x, dz = _vw3.z - root.position.z;
        const tiefe = dx * rein.x + dz * rein.z;
        const quer = dx * rechts.x + dz * rechts.z;
        /* Der Fehler wird auf den bestehenden Versatz AUFADDIERT. Vorher
           wurde er als absoluter Zielwert gesetzt – dadurch pendelte die
           Korrektur zwischen zwei Werten hin und her und das Becken blieb
           einen halben Meter von der Wand entfernt. */
        /* Zielabstand so gewählt, dass Brust und Bauch die Wand streifen
           und Hände und Füße genau auf der Fassade liegen – nicht darin. */
        /* Die Nachfuehrung wird mit der Staerke der Pose skaliert. Sonst
           zieht sie den Koerper mit vollem Gewicht zur Wand, waehrend
           wandFreiraum() ihn gleichzeitig herausschiebt - zwei Regler auf
           dieselbe Groesse, und der Koerper pendelt zwischen ihnen. */
        const kk = clamp(k === undefined ? 1 : k, 0, 1);
        /* Der Zielabstand des Beckens war -0,24. Gemessen stand das Becken
           damit 45 bis 56 cm vor der Fassade und alle Glieder hingen mit
           in der Luft - naeher gesetzte Ziele fuer Haende und Fuesse
           schoben nur das Becken weiter heraus, weil diese Nachfuehrung
           dagegenhielt. Mit -0,10 kommt der ganze Koerper an die Wand. */
        inner.position.z = clamp(inner.position.z + (-0.10 - tiefe) * 0.35 * kk, -1.2, 1.2);
        /* Achtung beim Vorzeichen: die lokale X-Achse der Wurzel zeigt nach
           LINKS, also entgegen "rechts". Mit dem falschen Vorzeichen war es
           eine Mitkopplung – der Körper wanderte bis an den Anschlag von
           0,8 m zur Seite und stand deshalb schief an der Wand. */
        inner.position.x = clamp(inner.position.x + quer * 0.35 * kk, -0.5, 0.5);
        root.updateMatrixWorld(true);
      }
      const m = root.position;
      const g = Math.sin(phase);
      const punkt = (out, seite, hoehe, tiefe) => out
        .copy(m).addScaledVector(rechts, seite).addScaledVector(rein, tiefe)
        .setY(m.y + hoehe);

      /* Nur das OBERE Glied zielt auf einen Punkt an der Wand; Ellbogen
         und Knie werden anschließend schlicht gebeugt. Wurden beide
         Glieder gezielt, verdrehte die kürzeste Drehung die Unterarme und
         Unterschenkel – das waren die schief stehenden Arme und Beine. */
      /* Oberarm zielt auf den Ellbogen, Unterarm auf die Hand. Beide Ziele
         liegen auf der Fassade, dadurch stehen die Ellbogen nach außen wie
         bei einer Spinne und die Hände liegen wirklich an der Wand. */
      /* Alle Zielpunkte liegen 12 cm WEITER VON DER WAND als vorher.
         Gemessen steckten linker Fuß (-2 cm), linke Zehe (-4 cm) und
         linkes Knie (-5 cm) in der Fassade – man sah dort nur ein
         abgeschnittenes Stück Fuß und dachte, er sei vom Bein gelöst.
         Die Haut ist rund 5 cm dick, deshalb braucht jedes Glied etwas
         Luft. (tiefe wird Richtung Wand gemessen: kleiner = weiter weg.) */
      /* Nachgemessen am Collider der Hauswand: Haende lagen im Mittel 16
         bis 25 cm, Fuesse 17 bis 29 cm VOR der Fassade. Die Figur klebte
         also nicht, sie schwebte davor - genau der Eindruck "das Klettern
         ist verbuggt". Die Zielpunkte liegen deshalb 12 cm naeher an der
         Wand als zuvor; kein Glied kam dabei in die Fassade hinein. */
      punkt(_vw3, -0.52, 1.50 + g * 0.10, 0.08);          // linker Ellbogen
      zieleKnochen(knochen.leftarm, knochen.leftforearm, _vw3, k);
      punkt(_vw3, -0.27, 2.14 + g * 0.34, 0.14);          // linke Hand
      zieleKnochen(knochen.leftforearm, knochen.lefthand, _vw3, k);
      punkt(_vw4, 0.52, 1.50 - g * 0.10, 0.08);
      zieleKnochen(knochen.rightarm, knochen.rightforearm, _vw4, k);
      punkt(_vw4, 0.27, 2.14 - g * 0.34, 0.14);
      zieleKnochen(knochen.rightforearm, knochen.righthand, _vw4, k);

      /* ---- Beine ----
         Die Knie standen 0,79 m auseinander und die Füße 0,73 m: das ist
         kein Kriechen mehr, das ist ein Spagat an der Wand. Ein Mensch hat
         rund 0,3 m zwischen den Hüftgelenken – etwas breiter als das darf
         eine Spinnenhaltung sein, aber nicht doppelt so breit.
         Zusätzlich hingen die Füße direkt unter den Knien, die Beine waren
         also stark zusammengefaltet. Gemessen: Knie 0,79 m und Füße 0,73 m
         auseinander. Mit den Werten unten sind es 0,48 m und 0,31 m – etwas
         breiter als die Hüfte (0,14 m), wie es sich für eine Spinnen-
         haltung gehört, aber kein Spagat mehr. */
      punkt(_vw3, -0.14, 0.80 - g * 0.10, -0.02);
      zieleKnochen(knochen.leftupleg, knochen.leftleg, _vw3, k);
      punkt(_vw3, -0.09, 0.04 - g * 0.16, 0.11);
      zieleKnochen(knochen.leftleg, knochen.leftfoot, _vw3, k);
      punkt(_vw4, 0.14, 0.80 + g * 0.10, -0.02);
      zieleKnochen(knochen.rightupleg, knochen.rightleg, _vw4, k);
      punkt(_vw4, 0.09, 0.04 + g * 0.16, 0.11);
      zieleKnochen(knochen.rightleg, knochen.rightfoot, _vw4, k);
      /* ---- Füße ----
         Der Knöchel wurde gar nicht geführt: die Sohlen zeigten dorthin,
         wohin die Leiter-Bewegung sie zufällig stellte, meist schräg von
         der Wand weg. Die Zehen zielen jetzt auf einen Punkt AUF der
         Fassade, schräg nach außen – damit liegt die Sohle an der Wand. */
      /* ---- Zehen ----
         Der Zehenpunkt wird vom TATSÄCHLICHEN Fuß aus gerechnet, nicht von
         der Wurzel. Der Unterschenkel erreicht seinen Zielpunkt nie ganz –
         ein fester Höhenversatz zur Wurzel landete deshalb mal über und mal
         unter dem Knöchel, und dann zeigten die Zehen senkrecht nach unten.
         Der Fuß sah dadurch aus, als hinge er ohne Knochen am Bein.
         Jetzt zeigen die Zehen zuverlässig schräg nach oben-außen an der
         Wand – dieselbe Haltung wie bei den Händen. */
      /* Die Sohlen liegen flach auf der Fassade, die Zehen zeigen nach
         unten-außen – das ist eine natürliche Streckung im Sprunggelenk.
         Der frühere Versuch, die Zehen nach OBEN zu richten, verlangte
         über 90 Grad Beugung: da riss die Haut vom Bein ab.
         Die Sohle wird über eine eigene Fußbasis gesetzt (wie bei den
         Händen); nur die Richtung zu zielen reicht nicht, weil sich der
         Fuß dabei um seine Längsachse frei verdrehen kann. */
      _vw3.copy(rein).negate();                    // Sohle zeigt zur Wand
      _fh.set(0, -1, 0).addScaledVector(rechts, -0.45);
      setzeFuss('left', _fh, _vw3, k * 0.95);
      _fh.set(0, -1, 0).addScaledVector(rechts, 0.45);
      setzeFuss('right', _fh, _vw3, k * 0.95);
      /* Handflächen flach auf die Fassade, Finger nach oben-außen. */
      _vw3.copy(rein);
      setzeHand('left', _fh.set(0, 1, 0).addScaledVector(rechts, -0.26), _vw3, 0.9);
      setzeHand('right', _fh.set(0, 1, 0).addScaledVector(rechts, 0.26), _vw3, 0.9);
      krallen('left', 0.34);
      krallen('right', 0.34);
      // Kopf hebt sich, der Blick geht nach oben
      drehZuRuhe(knochen.head, -0.35, 0, 0, k * 0.8);
    },
    /* ---- Wandlauf ----
       Aufrecht an der Fassade, aber mit Laufrhythmus statt Kriechen:
       lange Schritte die Wand hinauf, die Arme greifen abwechselnd nach
       oben, der Koerper lehnt in die Wand. Haende und Fuesse liegen dabei
       wirklich auf der Fassade - nicht daneben und nicht darin. */
    poseWandlauf(nx, nz, phase, k) {
      root.updateMatrixWorld(true);
      const rechts = _vw1.set(nz, 0, -nx);
      const rein = _vw2.set(-nx, 0, -nz);
      /* Becken wieder ueber den Anfasspunkt ziehen - dieselbe Korrektur
         wie beim Kriechen, sonst schwebt die Figur vor dem Haus. */
      if (knochen.hips) {
        knochen.hips.getWorldPosition(_vw3);
        const dx = _vw3.x - root.position.x, dz = _vw3.z - root.position.z;
        const tiefe = dx * rein.x + dz * rein.z;
        const quer = dx * rechts.x + dz * rechts.z;
        inner.position.z = clamp(inner.position.z + (-0.30 - tiefe) * 0.35, -1.2, 1.2);
        inner.position.x = clamp(inner.position.x + quer * 0.35, -0.5, 0.5);
        root.updateMatrixWorld(true);
      }
      const m = root.position;
      const g = Math.sin(phase);
      const punkt = (out, seite, hoehe, tiefe) => out
        .copy(m).addScaledVector(rechts, seite).addScaledVector(rein, tiefe)
        .setY(m.y + hoehe);

      /* ---- Arme: Laufschwung VOR der Brust, nicht an der Wand ----
         Hier griffen beide Haende flach an die Fassade, mit Krallen. Damit
         sah der Wandlauf aus wie schnelles Klettern mit Haenden und
         Fuessen - genau das war die Beschwerde. Beim Hochrennen tragen die
         Beine, die Arme pendeln wie beim Laufen: Ellbogen angewinkelt,
         Haende vor dem Koerper, abwechselnd hoch und runter.
         Negative Tiefe heisst WEG von der Wand. */
      punkt(_vw3, -0.26, 1.30 + g * 0.14, -0.16);            // linker Ellbogen
      zieleKnochen(knochen.leftarm, knochen.leftforearm, _vw3, k);
      punkt(_vw3, -0.20, 1.62 + g * 0.34, -0.36);            // linke Hand
      zieleKnochen(knochen.leftforearm, knochen.lefthand, _vw3, k);
      punkt(_vw4, 0.26, 1.30 - g * 0.14, -0.16);
      zieleKnochen(knochen.rightarm, knochen.rightforearm, _vw4, k);
      punkt(_vw4, 0.20, 1.62 - g * 0.34, -0.36);
      zieleKnochen(knochen.rightforearm, knochen.righthand, _vw4, k);

      /* ---- Beine: lange Schritte ----
         Der Schritt geht ueber gut einen halben Meter Hoehenunterschied -
         beim Kriechen sind es 0,16 m. Genau daran erkennt man von aussen,
         dass die Figur rennt. */
      punkt(_vw3, -0.16, 0.86 - g * 0.24, -0.20);            // linkes Knie
      zieleKnochen(knochen.leftupleg, knochen.leftleg, _vw3, k);
      punkt(_vw3, -0.13, 0.16 - g * 0.54, -0.01);            // linker Fuss
      zieleKnochen(knochen.leftleg, knochen.leftfoot, _vw3, k);
      punkt(_vw4, 0.16, 0.86 + g * 0.24, -0.20);
      zieleKnochen(knochen.rightupleg, knochen.rightleg, _vw4, k);
      punkt(_vw4, 0.13, 0.16 + g * 0.54, -0.01);
      zieleKnochen(knochen.rightleg, knochen.rightfoot, _vw4, k);

      /* Sohlen flach an der Wand, Zehen nach oben in Laufrichtung. */
      _vw3.copy(rein).negate();
      _fh.set(0, 1, 0).addScaledVector(rechts, -0.18);
      setzeFuss('left', _fh, _vw3, k * 0.95);
      _fh.set(0, 1, 0).addScaledVector(rechts, 0.18);
      setzeFuss('right', _fh, _vw3, k * 0.95);
      /* Die Haende fassen NICHTS an - sie sind locker zur Faust geballt,
         wie beim Laufen. Frueher lagen sie flach mit Krallen an der Wand. */
      krallen('left', 0.55);
      krallen('right', 0.55);
      /* Blick nach oben, dorthin, wo es hingeht. */
      drehZuRuhe(knochen.head, -0.42, 0, 0, k * 0.8);
    },
    /* ---- Wandlauf: die Sohlen auf die Fassade legen ----
       Der Koerper steht beim Wandlauf senkrecht auf der Wand und rennt sie
       hinauf - die Laufbewegung liefert den Rhythmus. Ohne Nacharbeit
       zeigten die Sohlen dorthin, wohin die Bewegung sie zufaellig stellte,
       und der hintere Fuss verschwand in der Fassade (gemessen: rechte Zehe
       12 cm drin). Jede Sohle wird jetzt flach an die Wand gelegt, und zwar
       um so staerker, je naeher der Fuss der Wand schon ist - der
       schwingende Fuss behaelt so seine Laufbewegung. */
    poseWandlaufFuesse(nx, nz, flaeche, k) {
      root.updateMatrixWorld(true);
      const sohle = _vw1.set(nx, 0, nz);
      for (const seite of ['left', 'right']) {
        const f = knochen[seite + 'foot'];
        if (!f) continue;
        f.getWorldPosition(_vw3);
        const d = nx !== 0 ? (_vw3.x - flaeche) * nx : (_vw3.z - flaeche) * nz;
        const nah = 1 - clamp((d - 0.05) / 0.35, 0, 1);
        if (nah < 0.02) continue;
        _fh.set(0, 1, 0);                 // Zehen zeigen die Wand hinauf
        setzeFuss(seite, _fh, sohle, clamp(k * nah, 0, 1));
      }
    },
    /* Nach dem Klettern den Wandversatz wieder abbauen. */
    /* ---- An der Wand kriechen ----
       Der Wunsch: die Kriechbewegung, die am Boden so gut aussieht, EINS
       ZU EINS an der Hauswand. Physikalisch ist das dasselbe - nur steht
       der "Boden" senkrecht.
       Dafuer wird die Figur um ihre EIGENE Querachse gekippt. Das geht
       nicht ueber root.rotation.x: Three.js dreht bei der Reihenfolge XYZ
       um die WELTachse x, also quer zur Blickrichtung der Figur. Die
       innere Gruppe sitzt dagegen schon hinter der Drehung um die
       Hochachse - eine Drehung dort ist eine Drehung um die Querachse der
       Figur.
       -90 Grad bilden ab: Koerper-vorn -> Wand hinauf, Koerper-oben ->
       von der Wand weg. Genau die Haltung eines Kletterers.
       tiefe = wie weit der Setzpunkt von der Wand weg liegt. */
    /* roll = Drehung um die Wandnormale. 0 heisst Kopf nach oben, +-PI/2
       heisst quer zur Fassade. Damit passt die Bewegung endlich zur
       Richtung: seitwaerts lief bisher die AUFWAERTS-Bewegung ab, die
       Beine stiegen also nach oben, waehrend die Figur zur Seite glitt.
       Gedreht wird ueber den kuerzesten Weg, sonst nimmt die Figur beim
       Wechsel von links nach rechts den ganzen Kreis. */
    wandKriechen(k, tiefe, roll) {
      const kk = clamp(k === undefined ? 1 : k, 0, 1);
      innerKipp = lerp(innerKipp, -Math.PI / 2 * kk, 0.28);
      inner.rotation.x = innerKipp;
      const zZ = (roll || 0) * kk;
      let dz = zZ - inner.rotation.z;
      while (dz > Math.PI) dz -= Math.PI * 2;
      while (dz < -Math.PI) dz += Math.PI * 2;
      inner.rotation.z += dz * 0.14;
      /* Solange gekippt wird, liegt "unter der Figur" die Wand. Die
         Bodenkorrektur (inner.position.y) wuerde sie an der Wand
         entlangschieben - sie wird deshalb ausgeblendet. */
      inner.position.y = lerp(inner.position.y, basisY, 0.2 * kk + 0.02);
      const zZiel = grundZ + (tiefe === undefined ? 0.30 : tiefe) * kk;
      inner.position.z = lerp(inner.position.z, zZiel, 0.25);
      inner.position.x = lerp(inner.position.x, grundX, 0.25);
    },
    /* Ist die Figur gerade an die Wand gekippt? */
    get wandGekippt() { return innerKipp < -0.02; },
    versatzAus(k) {
      /* Die Kippung immer mit zuruecknehmen - sonst bliebe die Figur nach
         dem Loslassen waagerecht in der Luft liegen. */
      if (innerKipp < -0.0005) {
        innerKipp = lerp(innerKipp, 0, Math.max(k, 0.12));
        inner.rotation.x = innerKipp;
      } else if (inner.rotation.x !== 0) { innerKipp = 0; inner.rotation.x = 0; }
      /* Die Rolle um die Wandnormale genauso zuruecknehmen - sonst haengt
         die Figur nach dem Loslassen quer in der Luft. */
      if (Math.abs(inner.rotation.z) > 0.0005) {
        inner.rotation.z = lerp(inner.rotation.z, 0, Math.max(k, 0.12));
      } else inner.rotation.z = 0;
      /* Zurueck auf den GRUNDVERSATZ, nicht auf null: der haelt die Figur
         ueber ihrem Punkt. Frueher lief er auf null und schob die Figur
         wieder zurueck neben sich selbst. */
      if (Math.abs(inner.position.x - grundX) < 0.001 &&
          Math.abs(inner.position.z - grundZ) < 0.001) return;
      inner.position.x = lerp(inner.position.x, grundX, k);
      inner.position.z = lerp(inner.position.z, grundZ, k);
    },
    /* Netzschuss-Pose: Arm nach vorn strecken */
    poseSchuss(zielWelt, seite, k) {
      const gross = seite === 'L' ? 'leftarm' : 'rightarm';
      const klein = seite === 'L' ? 'leftforearm' : 'rightforearm';
      zieleKnochen(knochen[gross], knochen[klein], zielWelt, k);
      drehe(knochen[klein], 0, 0, 0, k);
    },
    /* Arm mit ANGEWINKELTEM Ellbogen: Oberarm zeigt auf den Ellbogenpunkt,
       Unterarm auf den Handpunkt. poseSchuss streckt den Arm dagegen ganz
       durch - damit sah jeder, der ein Handy hielt, aus, als zeige er mit
       ausgestrecktem Arm darauf. */
    poseGreifen(ellbogenWelt, handWelt, seite, k) {
      const gross = seite === 'L' ? 'leftarm' : 'rightarm';
      const klein = seite === 'L' ? 'leftforearm' : 'rightforearm';
      const hand = seite === 'L' ? 'lefthand' : 'righthand';
      zieleKnochen(knochen[gross], knochen[klein], ellbogenWelt, k);
      zieleKnochen(knochen[klein], knochen[hand], handWelt, k);
    },
    /* Etwas in eine Hand geben (Handy, später auch anderes). Das Objekt
       hängt danach am Handknochen und macht jede Bewegung mit. */
    inDieHand(seite, obj, versatz, drehung) {
      const bone = haende[seite] || haende.R || haende.L;
      if (!bone) return false;
      if (obj.parent !== bone) bone.add(obj);
      /* Die Knochen sind mit dem Modellmaßstab skaliert – der Versatz muss
         das ausgleichen, sonst klebt das Handy im Handgelenk oder schwebt
         einen halben Meter daneben. */
      bone.updateWorldMatrix(true, false);
      const s = _va.setFromMatrixScale(bone.matrixWorld);
      const f = s.x > 0.0001 ? 1 / s.x : 1;
      obj.position.set(versatz.x * f, versatz.y * f, versatz.z * f);
      obj.scale.setScalar(f);
      if (drehung) obj.rotation.set(drehung.x, drehung.y, drehung.z);
      return true;
    },
    /* Gleitpose: Arme seitlich weit ausgebreitet, Beine gespreizt und
       leicht angewinkelt. Zwischen Armen und Rumpf spannt sich später die
       Netzhaut – dafür müssen die Arme wirklich weg vom Körper stehen. */
    poseGleiten(nase, kurve, t, k) {
      const w = k === undefined ? 0.9 : k;
      const flattern = Math.sin((t || 0) * 2.4) * 0.03;
      /* Arme: fast waagerecht zur Seite, minimal nach vorn. Die Kurve
         senkt den inneren und hebt den äußeren Arm. */
      const roll = (kurve || 0) * 0.3;
      /* Die Arme werden im WELTRAUM ausgerichtet, nicht über Eulerwinkel.
         Beim Mixamo-Skelett liegt die Ruhedrehung der Oberarme so, dass
         eine Drehung um die lokale Z-Achse den Arm nach vorn statt zur
         Seite führt – die Netzhaut blieb dadurch auf zehn Zentimeter
         zusammengefaltet. Mit einem Zielpunkt weit seitlich stimmt es
         unabhängig von der Ruhelage. */
      root.updateMatrixWorld(true);
      _vw1.setFromMatrixColumn(root.matrixWorld, 0).setY(0).normalize();  // rechts
      _vw2.setFromMatrixColumn(root.matrixWorld, 2).setY(0).normalize();  // vorn
      for (const seite of ['left', 'right']) {
        /* Achtung: Das Skelett ist gespiegelt benannt – der Knochen
           "leftarm" liegt auf der rechten Körperseite (+X, während die
           Figur nach +Z schaut). Mit der naheliegenden Zuordnung kreuzten
           die Arme vor dem Körper, statt sich zu spreizen. */
        const vz = seite === 'left' ? 1 : -1;
        const arm = knochen[seite + 'arm'], unter = knochen[seite + 'forearm'];
        const hand = knochen[seite + 'hand'];
        if (!arm || !unter) continue;
        arm.getWorldPosition(_vw3);
        /* Ziel: weit zur Seite, ein Stück nach hinten und leicht nach
           unten – die typische Haltung mit gespannter Netzhaut. */
        const hoch = -0.16 + roll * vz * 0.8 + flattern * vz * 2;
        _vw4.copy(_vw3)
          .addScaledVector(_vw1, vz * 3.0)
          .addScaledVector(_vw2, -0.55)
          .addScaledVector(_fh.set(0, 1, 0), hoch * 3);
        zieleKnochen(arm, unter, _vw4, w);
        if (hand) {
          /* Der Unterarm zeigt in dieselbe Richtung weiter – der Ellbogen
             bleibt fast gestreckt, sonst knickt die Haut ein. */
          unter.getWorldPosition(_vw3);
          _vw4.copy(_vw3)
            .addScaledVector(_vw1, vz * 3.0)
            .addScaledVector(_vw2, -0.4)
            .addScaledVector(_fh.set(0, 1, 0), hoch * 2.4);
          zieleKnochen(unter, hand, _vw4, w * 0.95);
        }
      }
      /* Beine fast geschlossen und nur leicht angewinkelt. Vorher standen
         sie mit 0,34 rad weit auseinander und waren stark gebeugt - die
         Silhouette wurde dadurch zum Seestern, und die Netzhaut zwischen
         Arm und Rumpf ging in der Luecke unter. Enge Beine geben die
         Deltaform, die den Gleitflug lesbar macht. */
      const beinAn = 0.16 - (nase || 0) * 0.14;
      drehZuRuhe(knochen.leftupleg,  beinAn, 0,  0.13 + roll * 0.4, w);
      drehZuRuhe(knochen.rightupleg, beinAn, 0, -0.13 + roll * 0.4, w);
      drehZuRuhe(knochen.leftleg,  0.22 + flattern * 2, 0, 0, w);
      drehZuRuhe(knochen.rightleg, 0.22 - flattern * 2, 0, 0, w);
      /* Fussspitzen gestreckt nach hinten - wie beim Springen vom Brett. */
      if (knochen.leftfoot)  drehZuRuhe(knochen.leftfoot,  -0.30, 0, 0, w * 0.8);
      if (knochen.rightfoot) drehZuRuhe(knochen.rightfoot, -0.30, 0, 0, w * 0.8);
      /* Rumpf: bei gedrückter Nase mehr Vorlage, dazu Kurvenlage. */
      drehe(knochen.spine1, -0.1 + (nase || 0) * 0.1, (kurve || 0) * 0.16, 0, 0.5);
      drehe(knochen.spine,  -0.06, (kurve || 0) * 0.1, 0, 0.4);
      /* Der Blick geht nach vorn, nicht auf den Asphalt. */
      drehZuRuhe(knochen.head, -0.30, (kurve || 0) * 0.2, 0, 0.8);
      drehZuRuhe(knochen.neck, -0.18, 0, 0, 0.75);
    },
    /* Den freien Arm hängen lassen. Beim Schirmhalten stand der zweite Arm
       mit offener Hand ebenfalls in der Luft – das sah aus, als würde die
       Figur jubeln, statt sich vor dem Regen zu schützen. */
    armRuhe(seite, k) {
      const p = seite === 'L' ? 'left' : 'right';
      const w = k === undefined ? 0.5 : k;
      drehZuRuhe(knochen[p + 'arm'], 0, 0, 0, w);
      drehZuRuhe(knochen[p + 'forearm'], 0.12, 0, 0, w);
      if (knochen[p + 'shoulder']) drehZuRuhe(knochen[p + 'shoulder'], 0, 0, 0, w * 0.6);
    },
    /* Faust schließen – für Gegenstände, die gehalten werden. */
    faust(seite, k) { faust(seite === 'L' ? 'left' : 'right', k); },
    /* Weltpositionen der Knochen, die die Netzhaut aufspannen. */
    fluegelPunkte(seite, out) {
      const p = seite === 'L' ? 'left' : 'right';
      const b = [knochen[p + 'hand'], knochen[p + 'forearm'], knochen[p + 'arm'],
                 knochen[p + 'upleg'], knochen[p + 'leg']];
      for (let i = 0; i < 5; i++) if (!b[i]) return false;
      root.updateMatrixWorld(true);
      for (let i = 0; i < 5; i++) b[i].getWorldPosition(out[i]);
      return true;
    },
    /* Ein gehaltenes Objekt senkrecht stellen. Der Schirm hängt am
       Handknochen und würde sonst waagerecht am Unterarm liegen. */
    haltAufrecht(obj, neigung) {
      if (!obj.parent) return;
      obj.parent.updateWorldMatrix(true, false);
      _q2.setFromRotationMatrix(_mA.extractRotation(obj.parent.matrixWorld));
      obj.quaternion.copy(_q2.invert());
      if (neigung) obj.rotateX(neigung);
    },
    /* Wie haltAufrecht, aber zusätzlich um die Hochachse gedreht: der
       Gegenstand steht senkrecht UND zeigt in eine bestimmte Richtung –
       etwa das Handy mit dem Bildschirm zum Gesicht. */
    haltAusgerichtet(obj, gier, neigung, versatzWelt) {
      if (!obj.parent) return;
      obj.parent.updateWorldMatrix(true, false);
      _q2.setFromRotationMatrix(_mA.extractRotation(obj.parent.matrixWorld));
      _q2.invert();
      /* Die gewünschte WELTdrehung wird direkt berechnet und dann in den
         Knochenraum umgerechnet. Object3D.rotateOnWorldAxis setzt einen
         nicht gedrehten Elternknoten voraus – am stark gedrehten
         Handknochen kippte das Handy dadurch quer. */
      _ed.set(neigung || 0, gier || 0, 0, 'YXZ');
      _qd.setFromEuler(_ed);
      obj.quaternion.copy(_q2).multiply(_qd);
      /* Der Versatz wird in WELTKOORDINATEN angegeben (z. B. "neun
         Zentimeter über der Faust"). In Knochenkoordinaten hing er von der
         gerade laufenden Bewegung ab – das Handy steckte deshalb mal in
         der Hand und mal daneben. */
      if (versatzWelt) {
        _va.setFromMatrixScale(obj.parent.matrixWorld);
        const f = _va.x > 1e-4 ? 1 / _va.x : 1;
        obj.position.copy(versatzWelt).applyQuaternion(_q2).multiplyScalar(f);
      }
    },
    /* Drei-Punkt-Landung: tief in die Hocke, eine Faust am Boden, der
       andere Arm nach hinten ausgestreckt. Die klassische Pose, mit der
       Spider-Man aus großer Höhe aufkommt. */
    /* ---- Kauern auf der Dachkante ----
       Die Haltung, in der Spider-Man ueber der Stadt hockt: tief in der
       Hocke, beide Fuesse nebeneinander, Knie hoch, beide Haende vor den
       Fuessen auf der Kante, Ruecken rund, Kopf aber oben - er schaut ja
       auf die Strasse.
       Warum von Hand und nicht als Datei: keine Bewegung aus dem Paket
       gibt diese Haltung her. "Crouching_Idle" ist ein Stand mit
       abgespreiztem Bein, die Duckbewegung ist ein Schleichschritt. Eine
       gesetzte Pose trifft es genau und kann nicht verrutschen. */
    /* Masse der Hocke, alle in Metern und relativ zur Huefte bzw. zur
       Schulter. Sie sind hier als Konstanten herausgezogen, weil sie
       gemessen eingestellt wurden: Fusshoehe, Handhoehe und Kopfhoehe
       ueber der Kante lassen sich im Spiel nachrechnen. */
    /* ---- Ruhig an der Fassade kleben ----
       Beide Haende ueber dem Kopf an der Wand, Knie weit zur Seite
       abgespreizt, Fuesse fest an der Fassade - die Spinnenhaltung.
       Warum von Hand und nicht als Datei: die Kriechbewegung des Pakets
       friert an einer beliebigen Stelle ein (mal mit angehobenem Bein),
       und die Steh-Bewegung aus dem Paket ist eine Haengebewegung am
       Faden, also aufrecht gebaut - damit STAND die Figur an der
       Hauswand, statt daran zu kleben.
       Gezielt wird ueber RICHTUNGEN, nicht ueber Punkte: zieleKnochen
       dreht nur die Achse eines Knochens, seine Laenge bleibt. Ein fester
       Zielpunkt haette also je nach Koerpergroesse danebengelegen.
         hoch = die Wand hinauf, quer = an der Wand entlang,
         raus = von der Wand weg.                                        */
    poseWandhalt(nx, nz, k) {
      const w = clamp(k === undefined ? 1 : k, 0, 1);
      const hueft = knochen.hips;
      if (!hueft) return;
      root.updateMatrixWorld(true);
      const rx = -nz, rz = nx;                    // Tangente laengs der Wand
      /* ---- Zielpunkte relativ zur HUEFTE, nicht zum jeweiligen Knochen ----
         Vorher lag jedes Ziel relativ zu dem Knochen, der gedreht werden
         sollte. Das ist gefaehrlich, weil das Skelett gespiegelt benannt
         ist und die beiden Seiten dadurch unterschiedlich weit ausschlugen:
         gemessen stand die eine Hand 19 cm neben der Koerpermitte, die
         andere 45 cm - eine Hand hing vor dem Gesicht, die andere weit
         draussen. Ausserdem standen die Ellbogen 20 bis 25 cm und die
         Knie bis zu 40 cm VON DER WAND WEG; das sah nach Boxdeckung aus,
         nicht nach Kleben.
         Von der Huefte aus gemessen sind beide Seiten sauber gespiegelt
         und die Abstaende zur Fassade stimmen.
           hoch = die Wand hinauf, quer = an der Wand entlang,
           raus = von der Wand weg. */
      /* Rumpf gerade an die Wand. Die Kriechbewegung darunter legt den
         Oberkoerper zur Seite - gemessen stand der Kopf 18 cm neben der
         Huefte, und weil die Schultern mitwandern, standen auch die Haende
         schief (eine 31 cm links, die andere 47 cm rechts der Mitte). */
      for (const n of ['spine', 'spine1', 'spine2']) {
        if (knochen[n]) drehZuRuhe(knochen[n], 0, 0, 0, w * 0.85);
      }
      root.updateMatrixWorld(true);
      hueft.getWorldPosition(_hp);
      const ziel = (hoch, quer, raus) => _vw4.set(
        _hp.x + rx * quer + nx * raus, _hp.y + hoch, _hp.z + rz * quer + nz * raus);
      for (const p of ['left', 'right']) {
        const vz = p === 'left' ? 1 : -1;   // Skelett ist gespiegelt benannt
        const arm = knochen[p + 'arm'], varm = knochen[p + 'forearm'];
        const hand = knochen[p + 'hand'];
        if (arm && varm) {
          /* Ellbogen leicht nach aussen, Hand darueber flach an der Wand. */
          zieleKnochen(arm, varm, ziel(0.74, vz * 0.34, 0.14), w);
          if (hand) zieleKnochen(varm, hand, ziel(1.28, vz * 0.24, 0.03), w);
        }
        const ober = knochen[p + 'upleg'], unter = knochen[p + 'leg'];
        const fuss = knochen[p + 'foot'];
        if (ober && unter) {
          /* Knie zur Seite und ein Stueck von der Wand weg - so entsteht
             die angehockte Spinnenhaltung, ohne dass die Beine abspreizen. */
          zieleKnochen(ober, unter, ziel(-0.10, vz * 0.42, 0.26), w);
          if (fuss) {
            zieleKnochen(unter, fuss, ziel(-0.62, vz * 0.30, 0.05), w);
            drehZuRuhe(fuss, 0.35, 0, 0, w * 0.7);
          }
        }
      }
      /* Kopf leicht angehoben - der Blick geht die Wand hinauf. */
      drehZuRuhe(knochen.neck, -0.22, 0, 0, w * 0.8);
      drehZuRuhe(knochen.head, -0.20, 0, 0, w * 0.8);
    },
    /* ---- Haende und Fuesse einzeln an die Fassade legen ----
       wandFreiraum() schiebt den GANZEN Koerper so weit heraus, dass der
       tiefste Knochen gerade nicht mehr in der Wand steckt. Damit beruehrt
       genau EIN Glied die Fassade, alle anderen schweben davor - beim
       ruhigen Kleben sah man das an den Haenden und Fuessen sofort.
       Hier wird deshalb jedes der vier Glieder noch einmal einzeln
       nachgezogen: der Elternknochen (Unterarm bzw. Unterschenkel) dreht
       so weit, dass seine Spitze auf der Wandebene landet. Gedreht wird
       nur - die Gliedlaenge bleibt, es kann also nichts ausleiern. */
    wandGriff(nx, nz, flaeche, k) {
      const w = clamp(k === undefined ? 1 : k, 0, 1);
      root.updateMatrixWorld(true);
      /* Zwei Durchgaenge: erst das obere Gelenk (Oberarm, Oberschenkel),
         dann das untere. Mit dem unteren allein blieb die Hand auf einer
         Kugel um den Ellbogen - lag die Wand weiter weg als der Radius,
         kam sie nie ganz heran (gemessen 11 bis 16 cm statt 7). */
      /* Das obere Gelenk zielt NICHT bis auf die Wand, sondern laesst
         einen Rest von zwoelf Zentimetern stehen - den holt das untere
         Gelenk danach. Zielten beide auf dieselbe Ebene, schob der zweite
         Durchgang die Hand hinter die Fassade (gemessen -10 cm). */
      const paare = [['leftarm', 'leftforearm', 0.12], ['rightarm', 'rightforearm', 0.12],
                     ['leftupleg', 'leftleg', 0.12], ['rightupleg', 'rightleg', 0.12],
                     ['leftforearm', 'lefthand', 0], ['rightforearm', 'righthand', 0],
                     ['leftleg', 'leftfoot', 0], ['rightleg', 'rightfoot', 0]];
      for (const [eltern, spitze, rest] of paare) {
        const a = knochen[eltern], b = knochen[spitze];
        if (!a || !b) continue;
        b.getWorldPosition(_vw3);
        /* Abstand zur Fassade, positiv heisst davor. */
        const d = nx !== 0 ? (_vw3.x - flaeche) * nx : (_vw3.z - flaeche) * nz;
        const ziel = WAND_LUFT + rest;
        /* Ab 45 cm Abstand liess der Griff das Glied frueher SCHLAGARTIG
           los - das Schwungbein im Kletterschritt geht durch diese Marke,
           und die Fussspitze sprang dabei in einem Bild um 86 Zentimeter.
           Jetzt blendet der Griff ueber die letzten zwanzig Zentimeter aus:
           bei 25 cm haelt er ganz, bei 45 gar nicht mehr. */
        const nah = clamp((WAND_GRIFF_WEIT - d) / WAND_GRIFF_BAND, 0, 1);
        /* In BEIDE Richtungen: der Griff hat frueher nur herangezogen, nie
           herausgeschoben. Gemessen steckten die Fuesse dabei bis zu 52 cm
           IN der Fassade - genau die Fuesse, die im Haus verschwanden. */
        if (Math.abs(d - ziel) < 0.005 || nah <= 0.001) continue;  // sitzt schon oder zu weit weg
        _vw4.copy(_vw3);
        if (nx !== 0) _vw4.x -= nx * (d - ziel);
        else _vw4.z -= nz * (d - ziel);
        griffKnochen(a, b, _vw4, w * nah * nah * (3 - 2 * nah), 0.45);
      }
    },
    /* Faust: die vier Finger und der Daumen werden eingerollt. Beim
       Katapult haelt die Figur zwei Netze - mit flacher Hand sah das aus,
       als winke sie damit. */
    faust(seite, k) {
      const w = clamp(k === undefined ? 1 : k, 0, 1);
      const p = seite === 'L' ? 'left' : 'right';
      for (const f of ['index', 'middle', 'ring', 'pinky']) {
        for (let g = 1; g <= 3; g++) {
          const b = knochen[p + 'hand' + f + g];
          if (b) drehZuRuhe(b, 0, 0, FAUST_KRUEMM * (g === 1 ? 0.9 : 1), w);
        }
      }
      for (let g = 1; g <= 3; g++) {
        const b = knochen[p + 'handthumb' + g];
        if (b) drehZuRuhe(b, 0, FAUST_DAUMEN, FAUST_KRUEMM * 0.5, w);
      }
    },
    poseKauern(k) {
      const w = clamp(k === undefined ? 1 : k, 0, 1);
      const hueft = knochen.hips;
      if (!hueft) return;
      /* Erst der Rumpf: rund nach vorn, Kopf dagegen wieder hoch. Er wird
         VOR den Gliedmassen gesetzt, weil Arme und Beine gleich auf
         Weltpunkte gezielt werden - und die haengen an der Lage von
         Huefte und Schultern. */
      /* drehZuRuhe statt drehe: drehe setzt den Eulerwinkel ABSOLUT, und
         die Mixamo-Wirbel stehen in Ruhe nicht auf null - aus einer
         gewuenschten Beuge von 69 Grad wurden dadurch gemessene 42, und
         die Schultern blieben 20 cm zu hoch, sodass die Haende die Kante
         nicht erreichten. drehZuRuhe legt die Drehung an die RUHELAGE an,
         der Winkel stimmt dann wirklich. */
      drehZuRuhe(knochen.spine, KAU.r1, 0, 0, w);
      drehZuRuhe(knochen.spine1, KAU.r2, 0, 0, w);
      drehZuRuhe(knochen.spine2, KAU.r3, 0, 0, w);
      drehZuRuhe(knochen.neck, KAU.nacken, 0, 0, w * 0.9);
      drehZuRuhe(knochen.head, KAU.kopf, 0, 0, w * 0.9);
      root.updateMatrixWorld(true);
      _vw1.setFromMatrixColumn(root.matrixWorld, 0).setY(0).normalize();   // rechts
      _vw2.setFromMatrixColumn(root.matrixWorld, 2).setY(0).normalize();   // vorn
      hueft.getWorldPosition(_hp);
      /* Alle Ziele liegen als WELTPUNKTE relativ zur Huefte fest. Der
         erste Anlauf hat die Beine ueber feste Eulerwinkel gedreht
         (drehZuRuhe) - dabei kippten die Oberschenkel nach HINTEN, die
         Knie zeigten nach unten weg und die Figur kniete eher, als dass
         sie hockte. Genau das war "die Beine sind falschherum".
         Mit Zielpunkten kann das nicht passieren: das Knie liegt vorn
         oben, der Fuss darunter am Boden, und der Winkel dazwischen
         ergibt sich von selbst.
         Masse aus dem Vorbild: Fuesse flach nebeneinander, Knie fast auf
         Schulterhoehe, beide Haende VOR den Fuessen auf der Kante. */
      const ziel = (vorn, quer, hoch) => _vw4.copy(_hp)
        .addScaledVector(_vw2, vorn)
        .addScaledVector(_vw1, quer)
        .addScaledVector(_fh.set(0, 1, 0), hoch);
      for (const p of ['left', 'right']) {
        const vz = p === 'left' ? 1 : -1;    // Skelett ist gespiegelt benannt
        const ober = knochen[p + 'upleg'], unter = knochen[p + 'leg'];
        const fuss = knochen[p + 'foot'];
        if (ober && unter) {
          /* Knie nach VORN OBEN - das macht die Hocke aus. */
          zieleKnochen(ober, unter, ziel(KAU.knieV, vz * KAU.knieQ, KAU.knieH), w);
          if (fuss) {
            /* Unterschenkel wieder nach hinten unten auf den Boden. */
            zieleKnochen(unter, fuss, ziel(KAU.fussV, vz * KAU.fussQ, KAU.fussH), w);
            /* Fussohle flach und die Zehen NACH VORN.
               Vorher stand hier nur eine feste Nachdrehung des Fusses.
               Das reichte nicht: zieleKnochen richtet den Unterschenkel
               ABSOLUT aus und wirft dabei seine Verdrehung weg - der Fuss
               haengt daran und zeigte gemessen 13 cm nach HINTEN statt
               nach vorn. Deshalb wird der Fuss jetzt selbst gezielt: vom
               Knoechel aus nach vorn, die Spitze ein Stueck tiefer. */
            const zehe = knochen[p + 'toebase'];
            if (zehe) {
              fuss.getWorldPosition(_vw3);
              zieleKnochen(fuss, zehe, _vw4.copy(_vw3)
                .addScaledVector(_vw2, 0.16)
                .addScaledVector(_fh.set(0, 1, 0), -KAU.zehTief), w * 0.95);
            } else {
              drehZuRuhe(fuss, KAU.fussDreh, 0, 0, w * 0.85);
            }
          }
        }
      }
      /* ---- Die Haende AUF die Flaeche, nicht hinein ----
         Vorher zeigten die Arme einfach senkrecht nach unten. Der Arm ist
         aber laenger als der Abstand von der Schulter zum Dach, und weil
         zieleKnochen nur die RICHTUNG dreht, landete die Hand entsprechend
         tiefer: gemessen steckten die Fingerspitzen 29 Zentimeter im Dach.
         Jetzt wird zuerst die Sohlenebene bestimmt (aus dem tiefsten Fuss)
         und der Zielpunkt dann so gewaehlt, dass die Hand GENAU auf dieser
         Ebene ankommt - was an Weg uebrig bleibt, geht nach vorn. Das ist
         auch die Haltung aus dem Vorbild: die Haende stuetzen VOR den
         Fuessen auf der Kante. */
      root.updateMatrixWorld(true);
      let sohle = Infinity;
      for (const p of ['left', 'right']) {
        const f = knochen[p + 'foot'];
        if (!f) continue;
        f.getWorldPosition(_vw3);
        sohle = Math.min(sohle, _vw3.y - KAU_SOHLE);
      }
      for (const p of ['left', 'right']) {
        const vz = p === 'left' ? 1 : -1;
        const arm = knochen[p + 'arm'], varm = knochen[p + 'forearm'];
        const hand = knochen[p + 'hand'];
        if (!arm || !varm || !hand) continue;
        /* Zielpunkt auf der Sohlenebene, im richtigen Abstand vom Gelenk:
           liegt die Ebene naeher als das Glied lang ist, muss der Rest
           nach vorn gehen, sonst zeigt das Glied unter die Ebene. */
        const aufEbene = (gelenk, spitze, vorn, quer, rest) => {
          gelenk.getWorldPosition(_vw3);
          spitze.getWorldPosition(_hp2);
          const laenge = _vw3.distanceTo(_hp2);
          const hoch = _vw3.y - (isFinite(sohle) ? sohle + rest : _vw3.y - laenge);
          const waag = Math.sqrt(Math.max(0.0004, laenge * laenge - hoch * hoch));
          return _vw4.copy(_vw3)
            .addScaledVector(_vw2, vorn * waag)
            .addScaledVector(_vw1, vz * quer * waag)
            .setY(_vw3.y - Math.min(hoch, laenge));
        };
        zieleKnochen(arm, varm, aufEbene(arm, varm, KAU.armV, KAU.armQ, KAU.armRest), w);
        varm.updateMatrixWorld(true);
        zieleKnochen(varm, hand, aufEbene(varm, hand, KAU.handV, KAU.handQ, KAU.handHoch), w);
      }
    },
    poseDreiPunkt(k, seite) {
      const w = clamp(k === undefined ? 1 : k, 0, 1);
      const p = seite === 'L' ? 'left' : 'right';
      const q = seite === 'L' ? 'right' : 'left';
      /* Tief in die Hocke: ein Knie vorn, das andere abgestützt. */
      drehZuRuhe(knochen[p + 'upleg'], 1.15, 0, 0.16, w);
      drehZuRuhe(knochen[p + 'leg'], 1.55, 0, 0, w);
      drehZuRuhe(knochen[q + 'upleg'], 0.55, 0, -0.34, w);
      drehZuRuhe(knochen[q + 'leg'], 1.9, 0, 0, w);
      if (knochen[p + 'foot']) drehZuRuhe(knochen[p + 'foot'], 0.3, 0, 0, w * 0.9);
      if (knochen[q + 'foot']) drehZuRuhe(knochen[q + 'foot'], 0.55, 0, 0, w * 0.9);
      /* Rumpf nach vorn eingerollt. */
      drehe(knochen.spine1, 0.42 * w, 0, 0, w * 0.8);
      drehe(knochen.spine, 0.2 * w, 0, 0, w * 0.7);
      /* Die stützende Faust geht zum Boden zwischen die Füße. */
      root.updateMatrixWorld(true);
      _vw1.setFromMatrixColumn(root.matrixWorld, 0).setY(0).normalize();   // rechts
      _vw2.setFromMatrixColumn(root.matrixWorld, 2).setY(0).normalize();   // vorn
      const arm = knochen[p + 'arm'], unter = knochen[p + 'forearm'];
      if (arm && unter) {
        arm.getWorldPosition(_vw3);
        _vw4.copy(_vw3).addScaledVector(_vw2, 0.5)
            .addScaledVector(_fh.set(0, 1, 0), -2.4);
        zieleKnochen(arm, unter, _vw4, w);
        const hand = knochen[p + 'hand'];
        if (hand) {
          unter.getWorldPosition(_vw3);
          _vw4.copy(_vw3).addScaledVector(_vw2, 0.25)
              .addScaledVector(_fh.set(0, 1, 0), -2.4);
          zieleKnochen(unter, hand, _vw4, w);
        }
        faust(p, w);
      }
      /* Der freie Arm streckt nach hinten aus – das hält die Pose im
         Gleichgewicht und macht die Silhouette lesbar. */
      const arm2 = knochen[q + 'arm'], unter2 = knochen[q + 'forearm'];
      if (arm2 && unter2) {
        arm2.getWorldPosition(_vw3);
        const vz = q === 'left' ? 1 : -1;   // Skelett ist gespiegelt benannt
        _vw4.copy(_vw3).addScaledVector(_vw2, -1.8)
            .addScaledVector(_vw1, vz * 1.4)
            .addScaledVector(_fh.set(0, 1, 0), 0.5);
        zieleKnochen(arm2, unter2, _vw4, w);
        drehe(unter2, -0.15, 0, 0, w);
        faust(q, w * 0.8);
      }
      /* Der Blick geht nach vorn, nicht auf den Asphalt. */
      drehZuRuhe(knochen.head, -0.5 * w, 0, 0, w * 0.85);
      drehZuRuhe(knochen.neck, -0.22 * w, 0, 0, w * 0.8);
    },
    /* Nur für Messungen: passt die Schrittweite zum echten Tempo? */
    laufInfo() { return letzterTakt; },
    /* Weltposition des Kopfes – für den Spinnensinn. */
    kopfPos(out) {
      const b = knochen.head || knochen.neck;
      if (!b) return null;
      root.updateMatrixWorld(true);
      return b.getWorldPosition(out);
    },
    /* Weltposition einer Hand – für den Netzfaden */
    handPos(seite, out) {
      const bone = haende[seite] || haende.R || haende.L;
      if (!bone) return null;
      root.updateMatrixWorld(true);
      return bone.getWorldPosition(out);
    },
    /* Fremde Animationen stammen von anders proportionierten Figuren.
       Ohne Ausgleich stechen die Füße in den Boden (z. B. beim Schlagen).
       Hier wird der tiefste Fuß gemessen und der Körper so weit angehoben,
       dass er auf dem Boden bleibt. */
    bodenAusgleich(k) {
      if (!fuesse.length) return;
      root.updateMatrixWorld(true);
      let tiefster = Infinity;
      for (const f of fuesse) { f.getWorldPosition(_vb); tiefster = Math.min(tiefster, _vb.y); }
      const relativ = tiefster - root.position.y;
      if (fussRuhe === null) { fussRuhe = relativ; return; }   // Ruhehöhe merken
      /* relativ enthält bereits die bisherige Korrektur – der Fehler wird
         deshalb auf sie aufaddiert, sonst pendelt sich der Fuß zu tief ein. */
      /* Zielhöhe der Füße = Bindehaltung. Der frühere Abzug von 7 cm war
         wirkungslos, solange nur gehoben werden konnte – jetzt würde er
         die Figur dauerhaft in den Asphalt drücken. */
      const fehler = (fussRuhe - 0.015) - relativ;
      /* Der Ausgleich darf die Figur auch ABSENKEN. Vorher konnte er nur
         heben; in der Landebewegung stehen die Füße rund 25 cm über der
         Ruhelage, und die Figur schwebte für einen Moment sichtbar über
         der Straße. */
      /* Die Untergrenze war -0,3. Die Kriechbewegung setzt den Koerper
         deutlich hoeher ueber die Wurzel als der Stand - gemessen schwebte
         der tiefste Fuss beim Kriechen 40,7 cm ueber dem Gehweg, und der
         Ausgleich lief in genau diesen Anschlag. Mit -0,7 reicht er aus. */
      /* Die Untergrenze lag bei -0,7. In der Dachhocke zieht die Haltung
         die Fuesse so weit an, dass der Ausgleich weiter musste - er lief
         in den Anschlag, und die ganze Figur stand gemessen 13 cm zu tief
         im Dach (die Fingerspitzen 24). Mit -1,1 reicht er. */
      const ziel = clamp(bodenKorrektur + fehler, -1.1, 0.35);
      /* Der Ausgleich wird in BEIDE Richtungen gleich weich nachgeführt.
         Früher sprang er nach oben sofort – beim Laufen wandert der tiefste
         Fuß aber in jedem Schritt auf und ab, dadurch hüpfte der ganze
         Körper im Schritttakt. Genau das hat das Laufen unruhig gemacht. */
      bodenKorrektur = lerp(bodenKorrektur, ziel, clamp(k === undefined ? 0.12 : k, 0, 0.35));
      inner.position.y = basisY + bodenKorrektur;
    },
    /* Dachhocke: Hände und Füße sollen wirklich AUFLIEGEN.
       Der allgemeine bodenAusgleich zielt auf den Knöchel in Bindehöhe.
       In der Hocke stimmt dieses Ziel nicht: der Fuß ist abgewinkelt, die
       Zehen tragen, und die Hände stützen mit. Gemessen sass die Figur
       deshalb mit den Knöcheln 13 cm im Dach, den Zehenballen 6 cm und den
       Fingerspitzen ebenfalls 6 cm - und der Ausgleich lief zusätzlich in
       seinen unteren Anschlag.
       Hier wird stattdessen der tiefste ECHTE Auflagepunkt gesucht und
       genau auf die Dachfläche (root.position.y) gelegt. Weil inner ein
       starres Kind von root ist, verschiebt das alle Knochen gemeinsam -
       die Haltung bleibt, sie sitzt nur richtig auf. */
    hockeAusgleich(k) {
      const punkte = auflagen.length ? auflagen : fuesse;
      if (!punkte.length) return;
      root.updateMatrixWorld(true);
      let tiefster = Infinity;
      for (const b of punkte) { b.getWorldPosition(_vb); tiefster = Math.min(tiefster, _vb.y); }
      const ziel = clamp(bodenKorrektur + (root.position.y - tiefster), -1.1, 0.9);
      bodenKorrektur = lerp(bodenKorrektur, ziel, clamp(k === undefined ? 0.12 : k, 0, 0.5));
      inner.position.y = basisY + bodenKorrektur;
    },
    /* Ducken: tief in die Knie, Rumpf nach vorn, Arme angelegt. Die
       Laufbewegung liefert weiter den Takt, diese Pose legt sich darüber –
       so braucht es keine eigene Bewegungsdatei. */
    poseDucken(k, tempo01) {
      const w = clamp(k === undefined ? 1 : k, 0, 1);
      const tief = 0.55 + (1 - clamp(tempo01 || 0, 0, 1)) * 0.2;
      for (const p of ['left', 'right']) {
        drehZuRuhe(knochen[p + 'upleg'], 0.62 * w * tief, 0, 0.1 * w, w * 0.8);
        drehZuRuhe(knochen[p + 'leg'], 0.95 * w * tief, 0, 0, w * 0.8);
        if (knochen[p + 'foot']) drehZuRuhe(knochen[p + 'foot'], 0.12 * w, 0, 0, w * 0.6);
      }
      drehe(knochen.spine1, 0.3 * w, 0, 0, w * 0.7);
      drehe(knochen.spine, 0.16 * w, 0, 0, w * 0.6);
      drehZuRuhe(knochen.head, -0.35 * w, 0, 0, w * 0.7);
      /* Absenken, damit die Fuesse auf dem Boden bleiben. Frueher stand
         hier ein fester Abzug von 34 cm - geraten und zu klein: gemessen
         hebt die Hocke den tiefsten Fuss um gut 67 cm an, die Figur
         schwebte also 34 cm ueber der Strasse. Jetzt wird der Fussstand
         nach den Drehungen gemessen und genau der Fehler ausgeglichen.
         Weil inner ein Kind von root ist, verschiebt der Zuschlag alle
         Knochen starr mit - der gemessene Fehler stimmt danach exakt. */
      if (fuesse.length && fussRuhe !== null) {
        root.updateMatrixWorld(true);
        let tiefster = Infinity;
        for (const f of fuesse) { f.getWorldPosition(_vb); tiefster = Math.min(tiefster, _vb.y); }
        inner.position.y += (fussRuhe - 0.015) - (tiefster - root.position.y);
      } else {
        inner.position.y = basisY + bodenKorrektur - 0.34 * w;
      }
    },
    /* ---- Auf einer Bank sitzen ----
       Es gibt keine Bewegungsdatei dafuer: "sit" ist die Haltung eines
       Verletzten AM BODEN und wurde im Zug prompt zum auf dem Gang
       liegenden Fahrgast. Die Haltung wird deshalb gesetzt - Huefte und
       Knie je rund 85 Grad, Rumpf aufrecht, Arme locker.
       bankY ist die Welthoehe der Sitzflaeche: die Figur wird so
       verschoben, dass das Becken genau darauf zu liegen kommt. */
    poseSitzen(k, bankY) {
      const w = clamp(k === undefined ? 1 : k, 0, 1);
      for (const p of ['left', 'right']) {
        drehZuRuhe(knochen[p + 'upleg'], 1.38 * w, 0, 0.05 * w, w);
        drehZuRuhe(knochen[p + 'leg'], -1.55 * w, 0, 0, w);
        if (knochen[p + 'foot']) drehZuRuhe(knochen[p + 'foot'], 0.16 * w, 0, 0, w * 0.7);
        if (knochen[p + 'arm']) drehZuRuhe(knochen[p + 'arm'], 0.3 * w, 0, 0, w * 0.55);
        if (knochen[p + 'forearm']) drehZuRuhe(knochen[p + 'forearm'], 0.55 * w, 0, 0, w * 0.55);
      }
      if (knochen.spine1) drehe(knochen.spine1, 0.05 * w, 0, 0, w * 0.4);
    },
    /* Welthoehe des Beckens und des tiefsten Fusspunktes - damit der
       Aufrufer eine sitzende Figur genau auf die Sitzflaeche setzen kann,
       ohne dass die Fuesse durch den Boden gehen. */
    sitzMasse() {
      if (!knochen.hips) return null;
      root.updateMatrixWorld(true);
      knochen.hips.getWorldPosition(_vb);
      const huefte = _vb.y;
      let tiefster = Infinity;
      for (const n of ['lefttoebase', 'righttoebase', 'leftfoot', 'rightfoot']) {
        if (!knochen[n]) continue;
        knochen[n].getWorldPosition(_vb);
        tiefster = Math.min(tiefster, _vb.y);
      }
      return { huefte, fuss: tiefster === Infinity ? huefte : tiefster };
    },
    /* Kopf ruhig halten: Beim Laufen nickt der ganze Körper mit, und mit
       der neuen Vorlage schaut die Figur sonst auf den Asphalt. Kopf und
       Hals nehmen die Neigung des Körpers zum Teil zurück, dadurch bleibt
       der Blick auf der Straße vor ihr. */
    kopfStabil(koerperNeigung, k) {
      const w = clamp(k === undefined ? 0.5 : k, 0, 1);
      drehZuRuhe(knochen.head, -koerperNeigung * 0.75, 0, 0, w);
      if (knochen.neck) drehZuRuhe(knochen.neck, -koerperNeigung * 0.3, 0, 0, w * 0.8);
    },
    /* ---- Fuß-IK auf die echte Bodenhöhe ----
       Der Gesamtausgleich oben hebt oder senkt den ganzen Körper nach dem
       TIEFSTEN Fuß. Auf ebener Straße reicht das; sobald aber ein Fuß auf
       dem Bordstein und der andere auf der Fahrbahn steht – oder auf einer
       Treppe, einem Autodach, dem Brunnenrand – stimmt immer nur einer von
       beiden. Der andere schwebte oder steckte im Boden.
       Hier wird jedes Bein einzeln nachgeführt: Zweigelenk-IK aus Hüfte,
       Knie und Knöchel, Ziel ist der Boden unter genau diesem Fuß.
       hoeheFn(x, z) liefert die Bodenhöhe, k die Stärke. */
    fussIK(hoeheFn, k, blickX, blickZ) {
      if (k <= 0.001) return;
      root.updateMatrixWorld(true);
      _vw1.set(blickX || 0, 0, blickZ === undefined ? 1 : blickZ);
      if (_vw1.lengthSq() < 1e-6) _vw1.set(0, 0, 1);
      _vw1.normalize();
      for (const seite of ['left', 'right']) {
        const hueft = knochen[seite + 'upleg'];
        const knie = knochen[seite + 'leg'];
        const fuss = knochen[seite + 'foot'];
        if (!hueft || !knie || !fuss) continue;
        hueft.getWorldPosition(_ikH);
        knie.getWorldPosition(_ikK);
        fuss.getWorldPosition(_ikA);
        const a = _ikH.distanceTo(_ikK);
        const bl = _ikK.distanceTo(_ikA);
        if (a < 0.05 || bl < 0.05) continue;

        const boden = hoeheFn(_ikA.x, _ikA.z);
        const fehler = (boden + KNOECHEL_HOCH) - _ikA.y;
        /* Nur Füße nahe am Boden nachführen – das Schwungbein bleibt frei. */
        const naehe = 1 - clamp(Math.abs(fehler) / 0.32, 0, 1);
        const w = k * naehe;
        if (w < 0.02 || Math.abs(fehler) < 0.002) continue;
        _ikT.copy(_ikA); _ikT.y += fehler * w;

        /* ---- 1. Kniewinkel anpassen ----
           Der Abstand Hüfte–Knöchel muss zur neuen Zielhöhe passen. Statt
           die Knochen neu auszurichten, wird der vorhandene Kniewinkel um
           die Differenz weitergedreht – dadurch bleibt die Verdrehung des
           Beins um seine Längsachse erhalten. Genau die ging beim
           vollständigen Neuausrichten verloren, und die Füße standen
           verkehrt herum. */
        const dIst = clamp(_ikH.distanceTo(_ikA), 0.02, a + bl - 0.01);
        const dSoll = clamp(_ikH.distanceTo(_ikT), Math.abs(a - bl) + 0.03, a + bl - 0.02);
        const gIst = Math.acos(clamp((a * a + bl * bl - dIst * dIst) / (2 * a * bl), -1, 1));
        const gSoll = Math.acos(clamp((a * a + bl * bl - dSoll * dSoll) / (2 * a * bl), -1, 1));
        const dGamma = clamp(gSoll - gIst, -0.45, 0.45);
        if (Math.abs(dGamma) > 0.0015) {
          /* Beugeachse aus der aktuellen Beinstellung. */
          _ikU.subVectors(_ikK, _ikH).normalize();
          _ikV.subVectors(_ikA, _ikK).normalize();
          _ikAx.crossVectors(_ikU, _ikV);
          if (_ikAx.lengthSq() < 1e-5) _ikAx.crossVectors(_ikU, _vw1);
          if (_ikAx.lengthSq() < 1e-5) { _ikAx.set(1, 0, 0); }
          _ikAx.normalize();
          drehKnochenWelt(knie, _ikAx, -dGamma, 1);
          knie.updateMatrixWorld(true);
          fuss.getWorldPosition(_ikA);
        }

        /* ---- 2. Bein als Ganzes zum Ziel drehen ----
           Wieder als Differenzdrehung auf die bestehende Haltung. */
        _ikU.subVectors(_ikA, _ikH);
        _ikV.subVectors(_ikT, _ikH);
        if (_ikU.lengthSq() < 1e-6 || _ikV.lengthSq() < 1e-6) continue;
        _ikU.normalize(); _ikV.normalize();
        const winkel = Math.acos(clamp(_ikU.dot(_ikV), -1, 1));
        if (winkel > 0.0015) {
          _ikAx.crossVectors(_ikU, _ikV);
          if (_ikAx.lengthSq() < 1e-6) continue;
          _ikAx.normalize();
          const w2 = Math.min(winkel, 0.4);
          drehKnochenWelt(hueft, _ikAx, w2, 1);
          /* Der Fuß behält seine Ausrichtung zur Welt – sonst kippt die
             Sohle mit dem Bein mit. */
          drehKnochenWelt(fuss, _ikAx, -w2, 0.8);
          hueft.updateMatrixWorld(true);
        }
      }
    },
    /* Hinlegen: Die Umfall-Bewegung dreht den Körper zwar waagerecht, lässt
       die Hüfte dabei aber auf Stehhöhe – die Figur lag deshalb rund einen
       Meter über dem Boden in der Luft. Hier wird der ganze Körper so weit
       abgesenkt, dass der tiefste Knochen wirklich aufliegt. */
    legeHin(k) {
      root.updateMatrixWorld(true);
      let tiefster = Infinity;
      for (const bn of alleKnochen) { bn.getWorldPosition(_vb); tiefster = Math.min(tiefster, _vb.y); }
      if (!isFinite(tiefster)) return;
      /* Der tiefste Knochen liegt bei einem liegenden Körper mitten im
         Rumpf bzw. Oberarm – die Haut reicht rund fünf Zentimeter tiefer.
         Mit den früheren elf Zentimetern schwebte die Figur sichtbar über
         der Straße. */
      const ueber = tiefster - root.position.y - 0.05;      // Restluft
      const ziel = clamp(bodenKorrektur - ueber, -1.6, 0.35);
      bodenKorrektur = lerp(bodenKorrektur, ziel, clamp(k === undefined ? 0.25 : k, 0, 1));
      inner.position.y = basisY + bodenKorrektur;
    },
    /* Gibt es für diesen Zustand eine echte geladene Bewegung?
       Wenn ja, hat sie Vorrang vor allen selbstgebauten Posen. */
    hatClip(key) { return !!findClip(m.clips, key); },
    play(key, p, dt) {
      /* Detailstufe nach Entfernung: Skelett-Animation ist teuer, deshalb
         weit entfernte Figuren ausblenden bzw. seltener animieren. */
      const dist2 = root.position.distanceToSquared(player.pos);
      if (dist2 > LOD_WEITE * LOD_WEITE) { root.visible = false; return; }
      root.visible = true;
      /* Jede schattenwerfende Figur wird ein zweites Mal gezeichnet, für
         die Schattenkarte. Weit entfernte Figuren sind auf dem Bild ein
         paar Pixel groß – dort lohnt der zweite Durchgang nicht. */
      const willSchatten = dist2 < 46 * 46;
      if (willSchatten !== schattenAn) {
        schattenAn = willSchatten;
        for (const o of originale) o.castShadow = willSchatten;
      }
      /* Läuft gerade ein Angriff, hat der Vorrang vor Laufen/Stehen */
      if (angriff) {
        angriffT -= dt;
        if (angriffT > 0) { mixer.update(dt); return; }
        /* Gleiche Blenddauer wie beim Einblenden der Grundanimation – sonst
           sinkt die Gesamtgewichtung kurz unter 1 und das Modell rutscht
           sichtbar in die T-Pose zurück. */
        blendeAus(angriff, 0.22); angriff = null; current = null;
      }
      if (dist2 > 45 * 45) {
        lodAcc += dt;
        if (++lodFrame % 3) return;      // nur jedes dritte Bild animieren
        dt = lodAcc; lodAcc = 0;
      }
      /* Solange es für Schwingen und Klettern keine eigene Bewegungsdatei
         gab, diente die ruhige Steh-Animation als Grundlage für die
         selbstgebauten Posen. Liegt eine echte Bewegung vor, führt die –
         sonst sah Klettern aus wie Die-Wand-hoch-Laufen. */
      let want = key;
      /* Fuer den Netzschwung gibt es seit mixamo-9 echte Haltungen aus
         "Swing To Land": angezogene Knie am Tiefpunkt, Beine nach vorn im
         Aufstieg. Der Clip laeuft dabei nicht ab, sondern wird an der zur
         Lage im Bogen passenden Stelle festgehalten. */
      /* Seit animation-1 gibt es eine echte Schwungbewegung. Sie hat
         Vorrang vor der festgehaltenen Haltung aus mixamo-9. */
      /* Seit hero-3 gibt es die Schwungbewegung aus dem Unreal-Projekt
         ("ApexTwist"): eine Hand am Faden ueber dem Kopf, der Koerper
         pendelt darunter. Sie ist fuer genau diesen Bogen gemacht und hat
         deshalb Vorrang. */
      if (key === 'swing') {
        if (findClip(m.clips, 'schwung2')) want = 'schwung2';
        else if (findClip(m.clips, 'schwung')) want = 'schwung';
        else if (findClip(m.clips, 'schwungpose')) want = 'schwungpose';
      }
      /* An der Hauswand laeuft die KRIECHBEWEGUNG. Sie ist dieselbe wie am
         Boden - nur steht der Boden dort senkrecht, und die Figur wird
         dafuer um ihre Querachse gekippt (siehe wandKriechen). Am Boden
         sieht diese Bewegung gut aus, an der Wand ist es genau die
         Haltung, die ein Kletterer haette. */
      /* An der Wand laufen echte Wandbewegungen aus hero-3: hinauf,
         hinunter, seitwaerts und das ruhige Kleben. Vorher lief oben der
         normale Laufschritt - der ist fuer den Boden gemacht, an der
         Fassade fehlte ihm der Griff.
         Alle diese Dateien sind auf DIESELBE Ausgangslage gedreht (flach
         auf dem Bauch, Kopf in Bewegungsrichtung, siehe
         tools/anim-ausrichten.mjs). In Unreal bringt jede ihre eigene
         Wanddrehung mit; ungedreht klebte die Figur mit dem Ruecken an der
         Fassade oder lag quer. */
      /* Die Wand HINAUFRENNEN bleibt der aufrechte Laufschritt. Der
         Versuch, dafuer die Wandbewegung aus hero-3 zu nehmen, war ein
         Rueckschritt: das ist ein flaches Kriechen, und aus dem Rennen die
         Wand hoch wurde damit ein Wuehlen. */
      if (p.wandModus === 'lauf') {
        if (findClip(m.clips, 'run')) want = 'run';
      } else if (p.wandModus === 'kriechen') {
        /* An der Wand fuehrt die Kriechbewegung - die, mit der die
           Wandkippung gebaut wurde.
           AUSGENOMMEN das seitliche Hangeln: dafuer gibt es eine eigene
           Bewegung, und diese Zeile hat sie immer ueberschrieben.
           Seitwaerts sah deshalb genauso aus wie hinauf - das Hangeln war
           im Spiel praktisch nicht vorhanden. */
        if (findClip(m.clips, 'kriechen')) want = 'kriechen';
      }
      if (key === 'haengen_frei' && findClip(m.clips, 'schwunghang')) want = 'schwunghang';
      if (key === 'duckstand') want = findClip(m.clips, 'ducken') ? 'ducken' : 'idle';

      if ((key === 'swing' || key === 'climb' || key === 'klettern_frei' ||
           key === 'klettern_seit') && !findClip(m.clips, key)) {
        want = findClip(m.clips, 'climb') ? 'climb' : 'idle';
        if (key === 'swing') want = 'idle';
      }
      /* Umschalten nach echtem Tempo, nicht nach einem Anteil der
         Höchstgeschwindigkeit: sonst wurde beim Anlaufen ein stark
         beschleunigter Gehschritt gezeigt. */
      const vRoh = p.speed === undefined ? (p.speed01 || 0) * CFG.sprintSpeed : p.speed;
      /* Das Tempo wird geglättet. Roh schwankt es von Bild zu Bild (Stöße,
         Kollisionen, Richtungswechsel) und die Schrittfrequenz zappelte
         entsprechend mit. */
      vGlatt += (vRoh - vGlatt) * Math.min(1, dt * 9);
      const vBoden = vGlatt;
      /* Hysterese am Übergang Gehen/Laufen: mit einer einzigen Schwelle
         sprang die Figur bei knapp drei Metern je Sekunde ständig zwischen
         beiden Bewegungen hin und her. */
      /* ---- Fuenf Gangarten, jede mit eigener Bewegungsdatei ----
         Schleichen, Ducklauf, Gehen, Laufen, Sprinten. Vorher gab es nur
         Gehen und Laufen; Ducken war eine selbstgebaute Haltung ueber dem
         Gehschritt und Sprinten war derselbe Laufschritt, nur schneller
         abgespielt. Umgeschaltet wird nach echtem Tempo, nicht nach einem
         Anteil der Hoechstgeschwindigkeit. */
      if (key === 'run') {
        /* Das Spiel weiss selbst, welche Gangart es befohlen hat - danach
           wird umgeschaltet. Frueher entschied allein die gemessene
           Geschwindigkeit; die Gehstufe lag dabei genau in der Hysterese
           und blieb am Laufschritt haengen. */
        /* Im Symbiontenanzug geht die Figur breitbeinig und schwer -
           "Bully Walking" aus animation-1. Nur beim normalen Gehen, im
           Sprint und geduckt bleiben die gewohnten Bewegungen. */
        /* Im Symbiontenanzug ein schwerer, breitbeiniger Gang statt des
           normalen Schritts ("Bully Walking" aus animation-1). */
        if (p.symbiont && p.gang === 'walk' && findClip(m.clips, 'symgang')) want = 'symgang';
        else if (p.gang && findClip(m.clips, p.gang)) want = p.gang;
        else if (findClip(m.clips, 'walk')) {
          if (geht && vBoden > 3.2) geht = false;
          else if (!geht && vBoden < 2.5) geht = true;
          if (geht) want = 'walk';
        }
      }
      const a = actionFor(want) || actionFor('idle');
      if (a && a !== current) {
        /* Beim Wechsel zwischen Gehen und Laufen die Schrittphase
           mitnehmen: sonst fängt der neue Takt bei null an und die Beine
           machen mitten im Schritt einen Satz. */
          /* Beim Wechsel zwischen zwei Gangarten die Schrittphase mitnehmen. */
        const beideLauf = GANG_REF[want] !== undefined && current &&
                          GANG_CLIPS.some((k) => current === actions[k]);
        let phase = 0;
        if (beideLauf) {
          const cd = current.getClip().duration || 1;
          phase = (current.time % cd) / cd;
        }
        const wAlt = gewichtVon(a);
        blendeAus(current, 0.22);
        /* Umfallen und Liegenbleiben laufen genau einmal und bleiben im
           letzten Bild stehen – sonst fällt die Figur endlos immer wieder. */
        const einmal = want === 'downed' || want === 'sit' || want === 'taunt';
        a.setLoop(einmal ? THREE.LoopOnce : THREE.LoopRepeat, einmal ? 1 : Infinity);
        a.clampWhenFinished = einmal;
        /* reset() setzt die Abspielstelle auf null. Fuer eine Bewegung,
           die schon laeuft, ist das ein Sprung mitten im Takt: nach einem
           Kunststueck in der Luft wird current geleert, die Fallbewegung
           gilt danach als "neu" - und wurde mit fast vollem Gewicht auf
           ihr erstes Bild zurueckgesetzt. Gemessen sprang die Fussspitze
           dabei um 79 Zentimeter, obwohl der Mischer nur 15 hergab.
           Eine laufende Schleife behaelt deshalb ihre Stelle. */
        if (!einmal && a.isRunning()) { a.enabled = true; a.paused = false; }
        else a.reset();
        blendeEin(a, 0.22, wAlt); a.play();
        if (beideLauf) a.time = phase * (a.getClip().duration || 1);
        current = a;
      }
      /* Schrittlänge an das echte Tempo koppeln: die Mixamo-Läufe legen bei
         Geschwindigkeit 1 rund 1,45 m/s (Gehen) bzw. 4,2 m/s (Rennen)
         zurück. Wird die Abspielgeschwindigkeit daraus berechnet, bleiben
         die Füße am Boden stehen, statt zu rutschen – genau das hat das
         Laufen bisher unruhig wirken lassen. */
      /* An der Wand NICHT ueber die Gangart-Tabelle: die rechnet mit dem
         waagerechten Tempo, und das ist beim Klettern null - der Clip lief
         dadurch mit 0,45 statt mit dem gesetzten Klettertempo. Genau das
         war "die Animation ist langsam, aber er ist schon halb oben". */
      if (current && GANG_REF[want] !== undefined && !p.wandKriechen) {
        const ref = GANG_REF[want];
        /* Unten weiter aufgemacht (0,45 statt 0,7): wer langsam schleicht,
           bewegte die Beine sonst schneller als er vorankam – genau das
           war das Rutschen über den Asphalt. */
        /* Obergrenze so hoch, dass auch der volle Sprint noch passt:
           bei 11 m/s braucht der Lauf-Clip (4,2 m/s) Faktor 2,6. Mit der
           früheren Deckelung auf 2,4 rutschte die Figur im Sprint. */
        current.timeScale = clamp(vGlatt / ref, 0.45, 3.0) * (p.rueckwaerts ? -1 : 1);
        letzterTakt = { was: want, faktor: current.timeScale, ref, v: vGlatt };
      } else if (current && key === 'duckstand' && want === 'ducken') {
        /* Angehalten statt abgespielt: sonst liefe die Figur im Stand auf
           der Stelle. Die Stelle ist gemessen - dort stehen beide Fuesse
           gleich tief auf dem Boden. */
        current.timeScale = 0;
        current.time = DUCK_STAND_T;
      } else if (current && (want === 'schwung' || want === 'schwungpose')) {
        /* Der Clip laeuft nicht von selbst ab, seine Stelle folgt dem
           Pendel: unten im Bogen liegt die Figur lang gestreckt (Ende des
           Clips), im Aufstieg zieht sie sich zusammen und greift nach oben
           (Mitte des Clips). Dadurch bewegt sich der Koerper MIT dem
           Schwung, statt eine Haltung zu halten.
           ACHTUNG: die Lage kommt aus der Steiggeschwindigkeit, und die
           kippt am Tiefpunkt des Bogens innerhalb weniger Bilder von -1
           auf +1. Ungeglaettet sprang die Stelle im Clip dabei mit - der
           Fuss legte gemessen im Mittel 15,5 cm JE BILD zurueck (9,3 m/s
           um die Huefte), Spitze 100 cm. Genau das sind die Beine, die
           "wie ein Hubschrauber" aussehen.
           Mit einer Zeitkonstante von rund 0,38 s folgt die Haltung dem
           Bogen, ohne ihm jede Zuckung nachzumachen. */
        current.timeScale = 0;
        const roh = clamp(p.bogen === undefined ? 0 : p.bogen, 0, 1);
        if (want !== letzterKey) bogenGlatt = roh;    // frisch eingestiegen
        bogenGlatt = lerp(bogenGlatt, roh, Math.min(1, dt * 2.6));
        current.time = want === 'schwung' ? lerp(1.95, 1.02, bogenGlatt)
                                          : lerp(0.01, 0.15, bogenGlatt);
      } else if (current && p.wandKriechen && (p.tempo === 0 || p.tempo === undefined)) {
        /* Still an der Wand: der Clip stand vorher einfach dort, wo er
           gerade war - mal mit einem Bein in der Luft, mal halb im
           Ausfallschritt. Das war das "komische Stehen an der Wand".
           Jetzt wandert er zu einer festen Stelle, an der beide Haende und
           beide Fuesse an der Fassade liegen. */
        current.timeScale = 0;
        const dauer = current.getClip().duration || 1;
        const ruhe = WAND_RUHE_T * dauer;
        let t2 = current.time;
        /* Auf dem kuerzeren Weg dorthin, damit es nicht rueckwaerts durch
           den ganzen Clip laeuft. */
        let ab = ruhe - t2;
        if (ab > dauer / 2) ab -= dauer;
        if (ab < -dauer / 2) ab += dauer;
        t2 += ab * Math.min(1, dt * 4);
        current.time = ((t2 % dauer) + dauer) % dauer;
      } else if (current && (want === 'climb' || want === 'klettern' ||
                            want === 'klettern_frei' || want === 'klettern_seit' ||
                            want === 'haengen' || p.wandKriechen)) {
        /* An der Wand nur klettern, wenn auch gedrückt wird – sonst
           kraxelte die Figur auf der Stelle weiter.
           Das Haengen gehoert dazu: "Braced Hang" ist keine ruhige
           Haltung, sondern eine Bewegung. Ungebremst ruderte die Figur
           damit an der Fassade herum - gemessen sprang der Fuss 6,5 cm je
           Bild. Ohne Eingabe steht sie jetzt wirklich still. */
        current.timeScale = p.tempo === undefined ? 1 : p.tempo;
      } else if (current) {
        current.timeScale = 1;
      }
      letzterKey = want;
      mixer.update(dt);
      /* Nach dem Mischer, vor allen Haltungen: so hat jede Figur eine
         natuerliche Hand, solange nichts anderes damit vorhat. */
      ruheHand('left', 1);
      ruheHand('right', 1);
    },
    /* art: 'punch' oder 'kick' – damit ein Tritt auch wie ein Tritt
       aussieht und nicht wie derselbe Schlag. Fehlt die passende Datei,
       greift automatisch die allgemeine Angriffsbewegung. */
    /* zielDauer: wie lange der Schlag im Spiel dauern SOLL. Die Mixamo-
       Dateien sind zwischen 1,7 s und 3,8 s lang – ungekürzt abgespielt
       hing die Figur nach jedem Schlag sekundenlang im Nachschwingen und
       eine Kombo war nicht mehr möglich. Die Bewegung wird deshalb
       beschleunigt und der ausklingende Rest weggeblendet. */
    attackOneShot(tempo, art, zielDauer, verkette) {
      const a = actionFor(art || 'attack') || actionFor('attack');
      if (!a) return 0;
      const d = a.getClip().duration;
      /* Die Untergrenze lag bei 1,3 und die Obergrenze bei 3,4. Der
         Tritt-Clip ist 2,5 s lang und hatte 0,55 s als Ziel - er lief also
         im Anschlag mit 3,4-facher Geschwindigkeit. So schnell schlaegt
         niemand, und genau das sah nicht gut aus.
         Jetzt darf eine Bewegung auch in ihrem eigenen Takt laufen, und
         nach oben ist bei 2,4 Schluss. */
      const v = zielDauer ? clamp(d / zielDauer, 1.0, 2.4) : (tempo || 1.7);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      /* Beim Verketten weich überblenden. Nur wenn dieselbe Bewegung
         direkt noch einmal kommt, muss sie zurückgesetzt werden – sonst
         sprang die Figur bei jedem Klick zurück auf das erste Bild und der
         Schlag sah abgehackt aus. */
      const gleiche = angriff === a;
      /* ---- Verketten in der Schlagfolge ----
         Jede Schlagdatei faengt in der Ruhehaltung an und holt erst aus.
         Beim schnellen Klicken sah man deshalb, wie der Arm ZURUECKGEHT,
         bevor der naechste Schlag beginnt - die Kombo zerfiel sichtbar in
         Einzelteile. Beim Verketten wird die Ausholphase deshalb
         uebersprungen: der naechste Schlag setzt dort an, wo der Arm
         ohnehin schon ist, und die Blende ist kurz. Damit lesen sich die
         Schlaege als EINE Bewegung. */
      /* verkette: 0 = gewoehnlich, 1 = Schlagfolge (harter Schnitt UND
         Ausholphase ueberspringen), 2 = nur harter Schnitt.
         Der harte Schnitt ist noetig, wo die Ausgangshaltung weit von der
         Zielhaltung entfernt liegt: beim Ueberblenden nimmt die Drehung
         der Schulter den kuerzesten Weg, und der fuehrt dann ueber den
         Kopf. Gemessen sprang die Hand beim Netzwurf im ersten Bild um
         85 Zentimeter. */
      const blende = verkette === 1 ? 0.05 : verkette === 2 ? 0.012
                   : verkette === 3 ? 0.22 : 0.09;
      const wAlt = gewichtVon(a);
      if (angriff && !gleiche) blendeAus(angriff, blende);
      else if (current && !angriff) blendeAus(current, blende);
      if (gleiche) a.reset();
      else { a.reset(); blendeEin(a, blende, wAlt); }
      const ab = verkette === 1 ? d * 0.18 : 0;
      a.time = ab;
      a.timeScale = v; a.play();
      angriff = a;
      const rest = (d - ab) / v;
      angriffT = zielDauer ? Math.min(zielDauer, rest) : rest;
      return angriffT;
    },
    /* Eine laufende Einmal-Bewegung sofort abbrechen. Nötig, wenn die
       Figur mitten in der Landerolle wieder den Boden verlässt – sonst
       rollt sie frei schwebend in der Luft weiter. */
    brichOneShot(blende) {
      if (!angriff) return false;
      blendeAus(angriff, blende === undefined ? 0.14 : blende);
      angriff = null; angriffT = 0; current = null;
      return true;
    },
    get einmalLaeuft() { return !!angriff; },
    /* Welche Bewegungsdatei laeuft gerade wirklich? Nur zur Kontrolle -
       der Wunschname und der gefundene Clip koennen auseinandergehen. */
    get aktuellerClip() {
      const a = angriff || current;
      return a ? a.getClip().name : null;
    },
    /* Ausweichrolle: die Datei ist 2,4 s lang, im Spiel darf das Ausweichen
       aber nur einen knappen Satz dauern. Sie wird deshalb beschleunigt
       abgespielt, damit die Rolle wirklich zu Ende geht, statt mittendrin
       in den Stand zu springen. */
    /* Wie attackOneShot, faengt aber an einer BESTIMMTEN Stelle des Clips
       an. Gebraucht fuer das Aufrichten aus der Hocke: die Duckbewegung
       wird ab der Hockstelle nach vorn abgespielt, statt von vorn. */
    abOneShot(art, vonZeit, zielDauer) {
      const a = actionFor(art);
      if (!a) return 0;
      const d = a.getClip().duration;
      const rest = Math.max(0.05, d - vonZeit);
      const v = clamp(rest / zielDauer, 0.6, 3.0);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      const wAlt = gewichtVon(a);
      if (angriff && angriff !== a) blendeAus(angriff, 0.09);
      else if (current && !angriff) blendeAus(current, 0.09);
      a.reset(); blendeEin(a, 0.09, wAlt);
      a.time = vonZeit;
      a.timeScale = v; a.play();
      angriff = a;
      angriffT = Math.min(zielDauer, rest / v);
      return angriffT;
    },
    /* Kantenzug: einmalige Bewegung mit fester Spieldauer. */
    kanteOneShot(zielDauer) {
      const a = actionFor('kante');
      if (!a) return 0;
      const d = a.getClip().duration;
      const v = clamp(d / zielDauer, 1, 4.5);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      const wAlt = gewichtVon(a);
      blendeAus(current, 0.1);
      a.reset(); blendeEin(a, 0.1, wAlt); a.timeScale = v; a.play();
      angriff = a;
      angriffT = Math.min(zielDauer, d / v);
      return angriffT;
    },
    rolleOneShot(zielDauer, welche, blende) {
      const a = actionFor(welche || 'roll') || actionFor('roll');
      if (!a) return 0;
      const d = a.getClip().duration;
      const v = clamp(d / zielDauer, 1, 3.2);
      /* Der harte Schnitt gilt fuer die AUSWEICHROLLE am Boden (siehe
         unten). Kunststuecke in der Luft brauchen ihn nicht - dort liegen
         Ausgangs- und Zielhaltung nicht so weit auseinander, dass die
         Schulter ueber den Kopf laeuft, und der harte Schnitt war genau
         der Ruck beim Anschwingen: gemessen sprang die Hand im ersten Bild
         um 87 Zentimeter. Wer eine Blende mitgibt, bekommt sie. */
      const bl = blende === undefined ? BLEND_ROLLE : blende;
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      /* Eine noch laufende Einmal-Bewegung muss mit weg. Vorher blieb sie
         mit vollem Gewicht stehen, und ihre festgehaltene Endhaltung
         mischte sich in die Rolle. */
      const wAlt = gewichtVon(a);
      if (angriff && angriff !== a) blendeAus(angriff, blende === undefined ? 0.05 : bl);
      else if (current) blendeAus(current, bl);
      /* HART umschalten, nicht ueberblenden. Beim Ueberblenden vom Lauf in
         die Rolle liegen die Schulterdrehungen so weit auseinander, dass
         der kuerzeste Weg zwischen ihnen UEBER DEN KOPF fuehrt: gemessen
         schoss die linke Hand fuer drei Bilder auf 1,73 m hoch, obwohl
         weder der Lauf (1,09 m) noch die Rolle (0,95 m) den Arm dort hat.
         Genau das war der Arm, der nach dem Ausweichen hochgeht. Eine
         kuerzere Blende macht den Ausschlag nicht kleiner, nur kuerzer -
         der Ausschlag steckt in der Mischung selbst, nicht in ihrer
         Dauer. Ein Ausweichsatz darf ruhig hart einsetzen; er ist schnell
         und soll knackig wirken. */
      a.reset(); blendeEin(a, bl, wAlt); a.timeScale = v; a.play();
      angriff = a;
      angriffT = Math.min(zielDauer, d / v);
      return angriffT;
    },
    /* Anzug wechseln: nur die Eckpunktfarben werden ausgetauscht, die
       Geometrie bleibt. Kostet einen Kopiervorgang, kein Neuaufbau. */
    setzeSymbiont(an) {
      root.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        /* Weg 1: selbstgebauter Anzug mit Eckpunktfarben. Dann liegen
           beide Farbreihen schon bereit und es wird nur umgehaengt. */
        const u = o.geometry && o.geometry.userData;
        const attr = o.geometry && o.geometry.attributes.color;
        if (u && u.anzugFarben && u.symbiontFarben && attr) {
          attr.array.set(an ? u.symbiontFarben : u.anzugFarben);
          attr.needsUpdate = true;
          return;
        }
        /* Weg 2: fertiges Modell mit eigenen Texturen.
           Hier stand vorher nur "Materialfarbe auf 0x14141b setzen". Die
           Textur wird damit multipliziert - und weil die Netzlinien des
           roten Anzugs DUNKLER sind als die Flaeche, verschwanden sie
           dabei vollstaendig. Ergebnis: eine gleichmaessig schwarze
           Silhouette ohne jedes Muster. Genau so sah es im Spiel aus.
           Jetzt bekommt das Modell beim ersten Zuschalten eine eigene
           Farbreihe auf die Eckpunkte gerechnet - schwarzer Grund, helle
           Netzringe und -speichen, grosse helle Spinne auf der Brust - und
           das Material wird gegen eines OHNE Textur getauscht. Der
           Rechenaufwand faellt genau einmal an. */
        if (!o.userData.symMat) baueSymbiontFuerModell(o);
        if (o.userData.symMat) {
          o.material = an ? o.userData.symMat : o.userData.normalMat;
          return;
        }
        /* Notnagel, falls die Geometrie keine Punkte hergibt. */
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m2 of mats) {
          if (!m2 || !m2.color) continue;
          if (m2.userData.grundFarbe === undefined) {
            m2.userData.grundFarbe = m2.color.getHex();
            m2.userData.grundGlanz = m2.shininess === undefined ? null : m2.shininess;
          }
          m2.color.setHex(an ? 0x14141b : m2.userData.grundFarbe);
          if (m2.shininess !== undefined) {
            m2.shininess = an ? 90 : (m2.userData.grundGlanz === null ? m2.shininess
                                                                     : m2.userData.grundGlanz);
          }
          if (m2.specular) m2.specular.setHex(an ? 0x9aa0b0 : 0x33333a);
        }
      });
    },
    /* Nur fuer Messungen: eine Stelle im laufenden Clip setzen (0..1). */
    /* Nur fuer Messungen: Daumenwinkel von aussen setzen. */
    daumenProbe(seite, ax, ay, az, k) {
      for (let g = 1; g <= 3; g++) {
        const b = knochen[seite + 'handthumb' + g];
        if (!b) continue;
        drehZuRuhe(b, ax * (g === 1 ? 1 : 0.7), g === 1 ? ay : 0,
                   g === 1 ? az : az * 0.7, k);
      }
    },
    setzeClipZeit(t01) {
      if (!current) return;
      current.timeScale = 0;
      current.time = clamp(t01, 0, 0.999) * (current.getClip().duration || 1);
    },
    /* Nur fuer Messungen: welcher Clip laeuft gerade, wie schnell? */
    laufStand() {
      return current ? { clip: current.getClip().name, ts: +current.timeScale.toFixed(2),
                         t: +current.time.toFixed(3), gewicht: +current.getEffectiveWeight().toFixed(2),
                         laeuft: current.isRunning() } : null;
    },
    /* Wie lange dauert eine geladene Bewegung? Damit lässt sich die
       Spielmechanik auf die Bewegungsdatei abstimmen, statt umgekehrt. */
    clipDauer(key) {
      const c = findClip(m.clips, key);
      return c ? c.duration : 0;
    },
  };
}

function makeProceduralVisual(cfg) {
  const human = makeHuman(cfg);
  return {
    root: human.root, procedural: true, human,
    play(key, p, dt) { poseHuman(human, key, p, dt); },
    attackOneShot() {},
    brichOneShot() { return false; },
    abOneShot() { return 0; },
    get einmalLaeuft() { return false; },
    rolleOneShot() { return 0; },
    clipDauer() { return 0; },
    legeHin() {},
  };
}

/** Erzeugt die Optik einer Figur: GLB-Modell falls geladen, sonst eingebaute Figur. */
function makeCharacterVisual(kind, cfg) {
  let m = null;
  if (kind === 'civilian') {
    const variants = ZIVI_SLOTS.filter((s) => glbModels[s]);
    if (variants.length) m = glbModels[pick(variants)];
  } else if (glbModels[kind]) {
    m = glbModels[kind];
  }
  const v = m ? makeGlbVisual(m) : makeProceduralVisual(cfg);
  if (kind === 'civilian' && m) faerbeKleidung(v);
  scene.add(v.root);
  return v;
}

/* ---- Kleidung einfaerben ----
   Es gibt genau zwei Zivilistenmodelle. Ungefaerbt laufen deshalb ueberall
   dieselben zwei Personen herum, und wo drei nebeneinander stehen, faellt
   genau das auf. Die Modelle haben eigene Materialien fuer Oberteil, Hose,
   Schuhe und Haar - die werden je Figur kopiert und mit einer eigenen
   Farbe multipliziert. Haut, Augen und Wimpern bleiben unangetastet.
   Weiss heisst "Textur unveraendert lassen". */
const ZIVI_OBEN = [0xffffff, 0xffffff, 0xc0554e, 0x4d7dc4, 0x58a15c, 0xc9a23f,
                   0x8e5fae, 0xd97c33, 0x4ea9a5, 0xc45a8c, 0xe6e2d8, 0x3a3f47];
const ZIVI_UNTEN = [0xffffff, 0xffffff, 0x3a4250, 0x2b3038, 0x6b6152, 0x8a8f96,
                    0x4a5a70, 0x6a4a3a];
const ZIVI_SCHUH = [0xffffff, 0x2a2e36, 0xd8d4cc, 0x8a5a3e, 0x4a5a70];
const ZIVI_HAAR = [0xffffff, 0x2a2018, 0x4a3524, 0x6b4a2a, 0x8a6a40, 0xb09060, 0x50504e];
function faerbeKleidung(v) {
  const wunsch = { Topmat: pick(ZIVI_OBEN), Bottommat: pick(ZIVI_UNTEN),
                   Shoesmat: pick(ZIVI_SCHUH), Hairmat: pick(ZIVI_HAAR) };
  const kopien = new Map();
  v.root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const n = o.material.name;
    if (!(n in wunsch) || wunsch[n] === 0xffffff) return;
    let mat = kopien.get(n);
    if (!mat) {
      /* Kopieren ist Pflicht: die geklonten Figuren teilen sich sonst ihre
         Materialien, und eine Farbe wuerde alle auf einmal umfaerben. */
      mat = o.material.clone();
      mat.color = new THREE.Color(wunsch[n]);
      kopien.set(n, mat);
    }
    o.material = mat;
  });
}

/* ======================= Menschen-Baukasten ======================= */

function limb(mat, r0, r1, len) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 7), mat);
  m.position.y = -len / 2;
  m.castShadow = true;
  g.add(m);
  return g;
}

/**
 * Baut eine Menschfigur (~1,78 m). Blickrichtung: +Z.
 * cfg.hero = true → Netz-Held im Rot-Blau-Anzug.
 */
function makeHuman(cfg) {
  cfg = cfg || {};
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  let suitMat = null, blueMat = null, skinMat, shirtMat, pantsMat, shoeMat, headMat;

  if (cfg.hero) {
    suitMat = new THREE.MeshLambertMaterial({ map: suitTex });
    blueMat = new THREE.MeshLambertMaterial({ color: 0x1b3fa0 });
    skinMat = suitMat; shirtMat = suitMat; pantsMat = blueMat;
    shoeMat = suitMat; headMat = suitMat;
  } else {
    skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin || pick(SKINS) });
    shirtMat = new THREE.MeshLambertMaterial({ color: cfg.shirt || pick(SHIRTS) });
    pantsMat = new THREE.MeshLambertMaterial({ color: cfg.pants || pick(PANTS) });
    shoeMat = new THREE.MeshLambertMaterial({ color: 0x26262a });
    headMat = skinMat;
  }

  // Becken
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), pantsMat);
  pelvis.position.y = 1.0; pelvis.castShadow = true;
  root.add(pelvis);

  // Brustkorb (Pivot an der Hüfte)
  const chest = new THREE.Group();
  chest.position.y = 1.08;
  root.add(chest);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.24), shirtMat);
  torso.position.y = 0.28; torso.castShadow = true;
  chest.add(torso);

  // Kopf
  const headG = new THREE.Group();
  headG.position.y = 0.56;
  chest.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), headMat);
  head.position.y = 0.14; head.scale.set(0.92, 1.05, 0.98); head.castShadow = true;
  headG.add(head);
  if (cfg.hero) {
    // Große weiße Augenlinsen
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMat);
      eye.scale.set(1.15, 1.5, 0.5);
      eye.position.set(s * 0.062, 0.16, 0.125);
      eye.rotation.y = s * 0.35; eye.rotation.z = s * -0.35;
      headG.add(eye);
    }
  } else if (!cfg.thug) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshLambertMaterial({ color: cfg.hair || pick(HAIRS) }));
    hair.scale.set(0.95, 0.75, 0.95);
    hair.position.y = 0.21; hair.position.z = -0.02;
    headG.add(hair);
  } else {
    // Sturmhaube
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x1d1f26 }));
    mask.scale.set(0.95, 1.02, 0.95);
    mask.position.y = 0.15; mask.position.z = -0.02;
    headG.add(mask);
  }

  // Arme
  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.27, 0.5, 0);
    chest.add(sh);
    const upper = limb(cfg.hero ? suitMat : shirtMat, 0.062, 0.055, 0.3);
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.3;
    sh.add(el);
    const fore = limb(cfg.hero ? suitMat : skinMat, 0.052, 0.045, 0.28);
    el.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), cfg.hero ? suitMat : skinMat);
    hand.position.y = -0.31; hand.castShadow = true;
    el.add(hand);
    return { sh, el, hand };
  }
  const armL = makeArm(-1), armR = makeArm(1);

  // Waffe für Ganoven
  let weapon = null;
  if (cfg.thug) {
    weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
    weapon.position.y = -0.55; weapon.rotation.x = 0.3;
    armR.el.add(weapon);
  }

  // Beine
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, 1.0, 0);
    root.add(hip);
    const thigh = limb(pantsMat, 0.085, 0.07, 0.46);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);
    const calf = limb(pantsMat, 0.065, 0.05, 0.44);
    knee.add(calf);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.26), cfg.hero ? blueMat : shoeMat);
    foot.position.set(0, -0.48, 0.06); foot.castShadow = true;
    knee.add(foot);
    return { hip, knee };
  }
  const legL = makeLeg(-1), legR = makeLeg(1);

  return {
    root, chest, headG,
    shL: armL.sh, elL: armL.el, shR: armR.sh, elR: armR.el,
    handR: armR.hand, handL: armL.hand,
    hipL: legL.hip, kneeL: legL.knee, hipR: legR.hip, kneeR: legR.knee,
    weapon,
  };
}

/* Pose-System: Zielwinkel weich anfahren */
function setRot(part, x, y, z, k) {
  part.rotation.x = lerp(part.rotation.x, x, k);
  part.rotation.y = lerp(part.rotation.y, y || 0, k);
  part.rotation.z = lerp(part.rotation.z, z || 0, k);
}

/**
 * anim: 'idle' | 'run' | 'air' | 'swing' | 'climb' | 'downed' | 'webbed' | 'sit'
 * p: {phase, speed01, t (Zeit), lean}
 */
function poseHuman(h, anim, p, dt) {
  const k = Math.min(1, dt * 14);
  const ph = p.phase || 0, sp = p.speed01 || 0, t = p.t || 0;
  switch (anim) {
    case 'run': {
      const a = 0.95 * sp;
      setRot(h.hipL, Math.sin(ph) * a, 0, 0, k);
      setRot(h.hipR, Math.sin(ph + Math.PI) * a, 0, 0, k);
      setRot(h.kneeL, Math.max(0, Math.sin(ph - 1.9)) * 1.5 * sp, 0, 0, k);
      setRot(h.kneeR, Math.max(0, Math.sin(ph + Math.PI - 1.9)) * 1.5 * sp, 0, 0, k);
      setRot(h.shL, Math.sin(ph + Math.PI) * 0.75 * sp, 0, 0.1, k);
      setRot(h.shR, Math.sin(ph) * 0.75 * sp, 0, -0.1, k);
      setRot(h.elL, -0.5 - 0.3 * sp, 0, 0, k);
      setRot(h.elR, -0.5 - 0.3 * sp, 0, 0, k);
      setRot(h.chest, 0.18 * sp + (p.lean || 0), Math.sin(ph) * 0.06, 0, k);
      setRot(h.headG, -0.12 * sp, 0, 0, k);
      break;
    }
    case 'air':
      setRot(h.hipL, -0.55, 0, 0, k); setRot(h.kneeL, 1.0, 0, 0, k);
      setRot(h.hipR, 0.35, 0, 0, k); setRot(h.kneeR, 0.4, 0, 0, k);
      setRot(h.shL, -0.6, 0, 0.55, k); setRot(h.shR, -0.6, 0, -0.55, k);
      setRot(h.elL, -0.5, 0, 0, k); setRot(h.elR, -0.5, 0, 0, k);
      setRot(h.chest, 0.12, 0, 0, k);
      break;
    case 'swing': {
      /* Die Schwunghand wechselt – die Pose spiegelt sich entsprechend. */
      const links = p.hand === 'L';
      const zug = links ? h.shL : h.shR;      // Arm am Seil
      const zugE = links ? h.elL : h.elR;
      const frei = links ? h.shR : h.shL;     // freier Arm
      const freiE = links ? h.elR : h.elL;
      setRot(zug, Math.PI - 0.2, 0, links ? 0.14 : -0.14, k);
      setRot(zugE, -0.12, 0, 0, k);
      // freier Arm deutlich vom Körper weg, sonst steckt er im Rumpf
      setRot(frei, -0.55, 0, links ? -1.15 : 1.15, k);
      setRot(freiE, -0.65, 0, 0, k);
      setRot(h.hipL, -0.85, 0, 0.1, k); setRot(h.kneeL, 1.25, 0, 0, k);
      setRot(h.hipR, -0.3, 0, -0.1, k); setRot(h.kneeR, 0.7, 0, 0, k);
      setRot(h.chest, -0.28, links ? 0.12 : -0.12, 0, k);
      setRot(h.headG, 0.25, 0, 0, k);
      break;
    }
    case 'climb': {
      const c = Math.sin(ph);
      setRot(h.shL, Math.PI - 0.6 + c * 0.45, 0, 0.25, k);
      setRot(h.shR, Math.PI - 0.6 - c * 0.45, 0, -0.25, k);
      setRot(h.elL, -0.4, 0, 0, k); setRot(h.elR, -0.4, 0, 0, k);
      setRot(h.hipL, -0.7 - c * 0.3, 0, 0.15, k);
      setRot(h.hipR, -0.7 + c * 0.3, 0, -0.15, k);
      setRot(h.kneeL, 1.1, 0, 0, k); setRot(h.kneeR, 1.1, 0, 0, k);
      setRot(h.chest, 0.35, 0, 0, k);
      setRot(h.headG, -0.5, 0, 0, k);
      break;
    }
    case 'downed':
      setRot(h.hipL, 0.3, 0, 0.2, k); setRot(h.hipR, 0.15, 0, -0.25, k);
      setRot(h.kneeL, 0.4, 0, 0, k); setRot(h.kneeR, 0.2, 0, 0, k);
      setRot(h.shL, 0.4, 0, 0.9, k); setRot(h.shR, 0.3, 0, -1.1, k);
      setRot(h.chest, 0, 0, 0, k);
      break;
    case 'webbed':
      setRot(h.shL, 0, 0, 0.12, k); setRot(h.shR, 0, 0, -0.12, k);
      setRot(h.elL, -0.9, 0, 0, k); setRot(h.elR, -0.9, 0, 0, k);
      setRot(h.hipL, 0, 0, 0.05, k); setRot(h.hipR, 0, 0, -0.05, k);
      setRot(h.kneeL, 0.1, 0, 0, k); setRot(h.kneeR, 0.1, 0, 0, k);
      break;
    case 'sit':
      setRot(h.hipL, -1.5, 0, 0.1, k); setRot(h.hipR, -1.5, 0, -0.1, k);
      setRot(h.kneeL, 1.5, 0, 0, k); setRot(h.kneeR, 1.5, 0, 0, k);
      setRot(h.shL, -0.9, 0, 0.2, k); setRot(h.shR, -0.9, 0, -0.2, k);
      setRot(h.elL, -1.2, 0, 0, k); setRot(h.elR, -1.2, 0, 0, k);
      setRot(h.chest, 0.35, 0, 0, k);
      break;
    default: // idle
      setRot(h.hipL, 0, 0, 0.02, k); setRot(h.hipR, 0, 0, -0.02, k);
      setRot(h.kneeL, 0.06, 0, 0, k); setRot(h.kneeR, 0.06, 0, 0, k);
      setRot(h.shL, Math.sin(t * 1.7) * 0.04, 0, 0.09, k);
      setRot(h.shR, Math.sin(t * 1.7 + 1) * 0.04, 0, -0.09, k);
      setRot(h.elL, -0.25, 0, 0, k); setRot(h.elR, -0.25, 0, 0, k);
      setRot(h.chest, 0.02 + Math.sin(t * 1.7) * 0.015, 0, 0, k);
      setRot(h.headG, 0, Math.sin(t * 0.6) * 0.25, 0, k);
  }
}

/* Angriffs-Animation überlagern (Held & Ganoven) */
function overlayAttack(h, atk, k) {
  if (!atk) return;
  const t = atk.t; // 0..1
  const wind = Math.min(1, t / 0.3);
  const strike = clamp((t - 0.3) / 0.25, 0, 1);
  const rec = clamp((t - 0.65) / 0.35, 0, 1);
  if (atk.type === 'punch') {
    const arm = atk.arm === 'L' ? { sh: h.shL, el: h.elL } : { sh: h.shR, el: h.elR };
    const shx = lerp(lerp(0.35, -1.65, strike), -0.2, rec);
    const elx = lerp(lerp(-1.8, -0.05, strike), -0.4, rec);
    arm.sh.rotation.x = shx * wind + arm.sh.rotation.x * (1 - wind);
    arm.el.rotation.x = elx * wind + arm.el.rotation.x * (1 - wind);
    h.chest.rotation.y = (atk.arm === 'L' ? 0.45 : -0.45) * (strike - rec);
  } else if (atk.type === 'kick') {
    const leg = { hip: h.hipR, knee: h.kneeR };
    leg.hip.rotation.x = lerp(lerp(0.5, -1.8, strike), 0, rec);
    leg.knee.rotation.x = lerp(lerp(1.8, 0.15, strike), 0.1, rec);
    h.chest.rotation.x = -0.35 * (strike - rec);
  } else if (atk.type === 'web') {
    h.shR.rotation.x = lerp(-1.55, -0.3, rec);
    h.elR.rotation.x = lerp(-0.05, -0.4, rec);
  } else if (atk.type === 'thugSwing') {
    h.shR.rotation.x = lerp(lerp(-2.5, -0.4, strike), -0.3, rec);
    h.elR.rotation.x = -0.3;
  }
}

/* ======================= Netz-Visuals ======================= */
/* ======================= Netzfaden =======================
   Ein Netzfaden ist kein glattes weißes Rohr, sondern ein Bündel feiner
   Fäden, das an der Hand dicker ist als am Anker und unter dem eigenen
   Gewicht leicht durchhängt. Genau das hat vorher gefehlt. */
const fadenTex = canvasTex(64, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  /* Mehrere feine Stränge längs, dazu ein paar Querverbindungen –
     um den Zylinder gewickelt ergibt das ein gedrehtes Seil. */
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 13 + rand(-2, 2);
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.95)' : 'rgba(226,234,242,0.8)';
    g.lineWidth = i % 2 ? 2.4 : 1.5;
    g.beginPath();
    for (let y = 0; y <= h; y += 8) g.lineTo(x + Math.sin(y * 0.09 + i) * 2.2, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const y = rand(0, h);
    g.beginPath(); g.moveTo(rand(0, w * 0.6), y); g.lineTo(rand(w * 0.4, w), y + rand(-6, 6)); g.stroke();
  }
});
fadenTex.wrapS = fadenTex.wrapT = THREE.RepeatWrapping;

/* Grundgitter: offener Zylinder, dessen Punkte jedes Bild neu gesetzt
   werden. Ein starrer Zylinder kann sich nicht durchbiegen. */
const FADEN_RING = 6, FADEN_LANG = 14;
const fadenBasis = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, FADEN_RING, FADEN_LANG, true);
  const p = g.attributes.position;
  const roh = new Float32Array(p.count * 3);
  roh.set(p.array);
  return { geo: g, roh };
})();

function makeWebStrand() {
  const geo = fadenBasis.geo.clone();
  const mat = new THREE.MeshBasicMaterial({
    map: fadenTex.clone(), transparent: true, alphaTest: 0.12,
    depthWrite: false, side: THREE.DoubleSide, color: 0xffffff,
  });
  mat.map.needsUpdate = true;
  mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.visible = false;
  m.renderOrder = 3;
  scene.add(m);
  return m;
}
const swingStrand = makeWebStrand();
const shotStrands = [makeWebStrand(), makeWebStrand(), makeWebStrand()];
let shotIdx = 0;
const activeShots = []; // {mesh, life, from, to}

/* Wie schnell die Luftsteuerung den Kurs dreht (Bogenmass je Sekunde). */
const LUFT_DREH = 2.4;
const _vSeil = new THREE.Vector3(), _vVorWand = new THREE.Vector3();
const _vHalt = new THREE.Vector3();
/* Was ein stehender Zivilist gerade tut. 'idle' steht mehrfach drin, damit
   ruhiges Stehen haeufiger vorkommt als jede einzelne Beschaeftigung. */
const RUHE_POSEN = ['idle', 'idle', 'telefon', 'warten', 'umschauen', 'tippen',
                    'reden', 'streiten', 'trinken', 'gelangweilt', 'froh', 'winken'];
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fc = new THREE.Vector3();
const _fd = new THREE.Vector3(), _fe = new THREE.Vector3();

/* from = Hand, to = Anker. durchhang: 0 = straff gespannt.
   dicke: Faktor auf den Fadenquerschnitt (1 = normal).
   WICHTIG: die Eckpunkte werden hier in WELTKOORDINATEN geschrieben. Wer
   den Faden dicker haben will, muss deshalb hierher - ein
   mesh.scale.setScalar() skaliert die Weltpunkte um den Nullpunkt und
   zieht den Faden als riesige Flaeche quer ueber die Stadt. Genau das war
   das Netz, das beim Katapult im Nichts hing. */
function placeStrand(mesh, from, to, durchhang, dicke) {
  _fa.subVectors(to, from);
  const len = _fa.length();
  if (len < 0.05) { mesh.visible = false; return; }
  mesh.visible = true;
  _fa.multiplyScalar(1 / len);                       // Richtung
  /* Zwei Querachsen zur Fadenrichtung aufspannen. */
  _fb.set(0, 1, 0);
  if (Math.abs(_fa.y) > 0.94) _fb.set(1, 0, 0);
  _fc.crossVectors(_fa, _fb).normalize();            // quer
  _fd.crossVectors(_fc, _fa).normalize();            // hoch
  const sag = durchhang === undefined ? 0.012 : durchhang;
  const tiefe = Math.min(1.1, len * sag);

  const p = mesh.geometry.attributes.position;
  const roh = fadenBasis.roh;
  for (let i = 0; i < p.count; i++) {
    const bx = roh[i * 3], by = roh[i * 3 + 1], bz = roh[i * 3 + 2];
    const t = by + 0.5;                              // 0 an der Hand, 1 am Anker
    // Radius: an der Hand kräftig, zum Anker hin dünner
    const r = (0.036 - 0.021 * t) * (dicke === undefined ? 1 : dicke);
    const durch = tiefe * 4 * t * (1 - t);           // Parabel-Durchhang
    _fe.copy(from)
       .addScaledVector(_fa, len * t)
       .addScaledVector(_fd, -durch)
       .addScaledVector(_fc, bx * r)
       .addScaledVector(_fd, bz * r);
    p.setXYZ(i, _fe.x, _fe.y, _fe.z);
  }
  p.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
  // Muster mit der Länge mitwachsen lassen, sonst wird es lang gezogen
  mesh.material.map.repeat.set(1, Math.max(1, Math.round(len * 0.6)));
}

/* Kurzer Netzklatscher: ein aufblitzendes Netzmuster am Einschlagpunkt. */
const klatscherPool = [];
const klatscherAktiv = [];
function netzKlatscher(pos) {
  let m = klatscherPool.pop();
  if (!m) {
    m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fleckMat.clone());
    m.material.depthTest = false;
    m.renderOrder = 4;
    scene.add(m);
  }
  m.position.copy(pos);
  m.visible = true;
  m.material.opacity = 0.95;
  m.scale.setScalar(0.2);
  klatscherAktiv.push({ m, t: 0 });
}
function updateKlatscher(dt) {
  for (let i = klatscherAktiv.length - 1; i >= 0; i--) {
    const k = klatscherAktiv[i];
    k.t += dt;
    k.m.quaternion.copy(camera.quaternion);
    k.m.scale.setScalar(0.2 + Math.min(1, k.t / 0.16) * 0.75);
    k.m.material.opacity = clamp(1 - k.t / 0.42, 0, 1) * 0.95;
    if (k.t > 0.42) { k.m.visible = false; klatscherPool.push(k.m); klatscherAktiv.splice(i, 1); }
  }
}

function flashWebShot(from, to) {
  const mesh = shotStrands[shotIdx = (shotIdx + 1) % shotStrands.length];
  /* Der Faden schießt sichtbar heraus, statt sofort in voller Länge da
     zu sein – das gibt dem Schuss Richtung und Tempo. */
  activeShots.push({ mesh, life: 0.24, t: 0, from: from.clone(), to: to.clone() });
  placeStrand(mesh, from, from, 0);
  mesh.material.opacity = 1;
}

/* ======================= Treffer-Effekte ======================= */
/* Kleine Sammlung wiederverwendbarer Effekte: ein aufblitzender Ring und
   ein paar Funken. Das gibt Schlägen spürbares Gewicht. */
const effektRinge = [];
const effektFunken = [];
const ringGeo = new THREE.RingGeometry(0.25, 0.42, 14);
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  }));
  m.visible = false; scene.add(m);
  effektRinge.push({ mesh: m, t: 0 });
}
const funkenGeo = new THREE.SphereGeometry(0.07, 5, 4);
for (let i = 0; i < 30; i++) {
  const m = new THREE.Mesh(funkenGeo, new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false,
  }));
  m.visible = false; scene.add(m);
  effektFunken.push({ mesh: m, t: 0, vel: V3(0, 0, 0) });
}

function treffEffekt(pos, staerke, farbe) {
  const ring = effektRinge.find((r) => r.t <= 0) || effektRinge[0];
  ring.t = 0.26;
  ring.mesh.visible = true;
  ring.mesh.position.copy(pos);
  ring.mesh.lookAt(camera.position);
  ring.mesh.scale.setScalar(0.5 * staerke);
  ring.mesh.material.color.setHex(farbe || 0xffffff);
  ring.mesh.material.opacity = 0.95;
  let n = 0;
  for (const f of effektFunken) {
    if (f.t > 0) continue;
    f.t = rand(0.22, 0.4);
    f.mesh.visible = true;
    f.mesh.position.copy(pos);
    f.mesh.material.color.setHex(farbe || 0xffe9a8);
    f.vel.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 9) * staerke);
    if (++n >= 6 + Math.round(staerke * 3)) break;
  }
}

/* ---- Staubwolke: flacher Ring am Boden plus ein paar Krümel.
   Gibt harten Landungen Gewicht. ---- */
const staubRinge = [];
const staubGeo = new THREE.RingGeometry(0.3, 1.0, 18);
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(staubGeo, new THREE.MeshBasicMaterial({
    color: 0xbfc3c8, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.visible = false; scene.add(m);
  staubRinge.push({ mesh: m, t: 0, dauer: 0.5 });
}
function staubWolke(pos, groesse) {
  const r = staubRinge.find((x) => x.t <= 0) || staubRinge[0];
  r.t = r.dauer;
  r.mesh.visible = true;
  r.mesh.position.set(pos.x, groundY(pos.x, pos.z) + 0.06, pos.z);
  r.mesh.scale.setScalar(0.4 * (groesse || 1));
  r.mesh.material.opacity = 0.55;
  let n = 0;
  for (const f of effektFunken) {
    if (f.t > 0) continue;
    f.t = rand(0.3, 0.55);
    f.mesh.visible = true;
    f.mesh.position.set(pos.x, groundY(pos.x, pos.z) + 0.12, pos.z);
    f.mesh.material.color.setHex(0xc9ced4);
    f.vel.set(rand(-1, 1), rand(0.1, 0.5), rand(-1, 1)).normalize().multiplyScalar(rand(2.5, 5) * (groesse || 1));
    if (++n >= 8) break;
  }
}

/* ======================= Netz-Zug an Objekten =======================
   Spider-Man reisst mit dem Netz Dinge von der Strasse an sich und
   schleudert sie weiter. Dafuer stehen an den Gehwegen lose Gegenstaende
   herum - Muelltonnen, Hydranten, Briefkaesten. Sie sind KEINE
   Hindernisse: man laeuft durch sie hindurch, sie sind nur Munition.

   Ablauf mit Q, wenn kein Gegner im Kegel steht:
     1. der naechste lose Gegenstand im Blickkegel bekommt einen Faden,
     2. er fliegt zur Figur (Zustand "zu"),
     3. sobald er da ist, wird er in Blickrichtung weitergeschleudert
        (Zustand "weg") und nimmt Gegner mit, die im Weg stehen.
   Ein Wurf in einem Zug also, ohne Tragen - das haelt die Steuerung
   einfach und sieht aus wie im Vorbild.                                */
const ZIEH = [];
const ZIEH_TEMPO_HIN = 34, ZIEH_TEMPO_WEG = 40;
function baueZiehObjekte() {
  if (ZIEH.length || typeof scene === 'undefined') return;
  const arten = [
    { w: 0.62, h: 0.95, d: 0.62, f: 0x2f6b3a, m: 26 },   // Muelltonne
    { w: 0.34, h: 0.78, d: 0.34, f: 0xc23b30, m: 34 },   // Hydrant
    { w: 0.46, h: 1.10, d: 0.42, f: 0x2b4f8a, m: 24 },   // Briefkasten
  ];
  const geo = new Map();
  for (let i = 0; i < 46; i++) {
    const a = arten[i % arten.length];
    const schl = a.w + '|' + a.h + '|' + a.d;
    if (!geo.has(schl)) geo.set(schl, new THREE.BoxGeometry(a.w, a.h, a.d));
    const mesh = new THREE.Mesh(geo.get(schl),
      new THREE.MeshLambertMaterial({ color: a.f }));
    mesh.castShadow = true;
    /* An den Gehwegkanten entlang verteilen. */
    const ax = (i % 2) === 0;
    const gasse = (Math.floor(i / 2) % 4 - 1.5) * 100;
    const laengs = ((i * 37) % 180) - 90 + Math.floor(i / 8) * 12;
    const px = ax ? laengs : gasse + (i % 3 - 1) * 9.5;
    const pz = ax ? gasse + (i % 3 - 1) * 9.5 : laengs;
    const boden = groundY(px, pz, 40);
    mesh.position.set(px, boden + a.h / 2, pz);
    scene.add(mesh);
    ZIEH.push({ mesh, hoehe: a.h, wucht: a.m, zustand: 'ruht',
                vel: new THREE.Vector3(), heim: mesh.position.clone(), t: 0 });
  }
}

/* Den nächstliegenden losen Gegenstand im Blickkegel suchen. */
function ziehZiel(weite, minDot) {
  const f = camForward();
  let best = null, bestW = weite;
  for (const o of ZIEH) {
    if (o.zustand !== 'ruht') continue;
    const dx = o.mesh.position.x - player.pos.x, dz = o.mesh.position.z - player.pos.z;
    const dy = o.mesh.position.y - (player.pos.y + 1.2);
    const w = Math.hypot(dx, dy, dz);
    if (w > bestW || w < 1.2) continue;
    if ((dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1) < minDot) continue;
    best = o; bestW = w;
  }
  return best;
}

/* Den gehaltenen Gegenstand werfen. gezielt = auf den anvisierten Gegner,
   sonst einfach in Blickrichtung; ohne Schwung faellt er nur herunter. */
function ziehWirf(o, gezielt) {
  if (!o || o.zustand !== 'halt') return;
  o.zustand = 'weg'; o.t = 0; o.getroffen = null;
  if (player.haeltObjekt === o) player.haeltObjekt = null;
  player.fadenZiel = null;
  if (!gezielt) {
    /* Losgelassen: faellt einfach zu Boden. */
    o.vel.set(player.vel.x * 0.3, 0, player.vel.z * 0.3);
    return;
  }
  const e = coneTargetEnemy(30, 0.35);
  if (e) {
    /* Auf den Gegner zielen, mit etwas Vorhalt fuer die Wurfzeit. */
    _v1.set(e.pos.x - o.mesh.position.x, e.pos.y + 0.9 - o.mesh.position.y,
            e.pos.z - o.mesh.position.z);
    const w = _v1.length() || 1;
    _v1.multiplyScalar(ZIEH_TEMPO_WEG / w);
    _v1.y += w * 0.18;                    // Bogen, damit er nicht flach durchschiesst
    o.vel.copy(_v1);
    popupWorld('Wurf!', o.mesh.position, '#bfe8ff');
  } else {
    const f = camForward();
    o.vel.set(f.x * ZIEH_TEMPO_WEG, 3.2 + clamp(camPitch, -0.3, 0.8) * 16,
              f.z * ZIEH_TEMPO_WEG);
  }
  camShake = Math.max(camShake, 0.12);
  SFX.swoosh();
}

/* Den naechsten FESTEN Zugpunkt im Blickkegel suchen (Laterne, Ampel). */
function ziehFestZiel(weite, minDot) {
  const f = camForward();
  let best = null, bestW = weite;
  for (const p of ZIEH_FEST) {
    const dx = p.x - player.pos.x, dz = p.z - player.pos.z;
    const dy = p.y - (player.pos.y + 1.2);
    const w = Math.hypot(dx, dy, dz);
    if (w > bestW || w < 3.0) continue;
    if ((dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1) < minDot) continue;
    best = p; bestW = w;
  }
  return best;
}

function updateZiehObjekte(dt) {
  if (!ZIEH.length) return;
  for (const o of ZIEH) {
    if (o.zustand === 'ruht') continue;
    o.t += dt;
    const p = o.mesh.position;
    if (o.zustand === 'zu') {
      /* Zur Figur ziehen. Das Netz bleibt sichtbar am Gegenstand. */
      _v1.set(player.pos.x - p.x, player.pos.y + 1.25 - p.y, player.pos.z - p.z);
      const w = _v1.length();
      player.fadenZiel = p; player.fadenHand = o.hand;
      if (w < 1.6 || o.t > 1.6) {
        /* ---- Angekommen: der Gegenstand bleibt am Netz ----
           Vorher flog er im selben Moment weiter, in die Richtung, in die
           man gerade zufaellig schaute. Zielen war unmoeglich.
           Jetzt haengt er am Faden vor der Figur, bis man ihn wirft - so
           wie Spider-Man eine Muelltonne heranreisst, sie kurz haelt und
           dann auf jemanden wirft. */
        o.zustand = 'halt'; o.t = 0;
        player.haeltObjekt = o;
        popupScreen('Q = werfen');
        SFX.web();
      } else {
        _v1.multiplyScalar(ZIEH_TEMPO_HIN / (w || 1));
        p.addScaledVector(_v1, dt);
      }
    } else if (o.zustand === 'halt') {
      /* Am Faden vor der Figur mitfuehren, leicht schwebend. */
      const f = _v2.set(Math.sin(player.facing), 0, Math.cos(player.facing));
      _v1.set(player.pos.x + f.x * 1.05, player.pos.y + 1.35 + Math.sin(elapsed * 2.4) * 0.05,
              player.pos.z + f.z * 1.05);
      p.lerp(_v1, Math.min(1, dt * 12));
      player.fadenZiel = p; player.fadenHand = o.hand;
      /* Nach acht Sekunden faellt er von allein herunter - sonst laeuft
         man den Rest des Spiels mit einer Muelltonne herum. */
      if (o.t > 8 || player.dead || player.state === 'swing' || player.state === 'climb') {
        ziehWirf(o, false);
      }
    } else if (o.zustand === 'weg') {
      o.vel.y -= CFG.gravity * dt;
      p.addScaledVector(o.vel, dt);
      /* Gegner umwerfen, die im Weg stehen. */
      for (const e of enemies) {
        if (e.dead || o.getroffen === e) continue;
        if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) > 1.4) continue;
        if (Math.abs(e.pos.y + 0.9 - p.y) > 1.6) continue;
        o.getroffen = e;
        damageEnemy(e, o.wucht, 'wurf');
        treffEffekt(p.clone(), 0.8, 0xdff0ff);
        o.vel.multiplyScalar(0.35);
      }
      const boden = groundY(p.x, p.z, p.y) + o.hoehe / 2;
      if (p.y <= boden || o.t > 4) {
        p.y = Math.max(p.y, boden);
        o.zustand = 'ruht'; o.getroffen = null; o.t = 0;
        staubWolke(p, 0.5);
      }
    }
    o.mesh.rotation.x += dt * (o.zustand === 'weg' ? 7 : 2);
    o.mesh.rotation.z += dt * (o.zustand === 'weg' ? 5 : 1.4);
  }
}

function updateEffekte(dt) {
  for (const r of staubRinge) {
    if (r.t <= 0) continue;
    r.t -= dt;
    const f = 1 - r.t / r.dauer;
    r.mesh.scale.setScalar(0.4 * (1 + f * 3.4));
    r.mesh.material.opacity = 0.55 * (1 - f);
    if (r.t <= 0) r.mesh.visible = false;
  }
  for (const r of effektRinge) {
    if (r.t <= 0) continue;
    r.t -= dt;
    const f = clamp(1 - r.t / 0.26, 0, 1);
    r.mesh.scale.setScalar(0.5 + f * 2.6);
    r.mesh.material.opacity = 0.95 * (1 - f);
    if (r.t <= 0) r.mesh.visible = false;
  }
  for (const f of effektFunken) {
    if (f.t <= 0) continue;
    f.t -= dt;
    f.vel.y -= 22 * dt;
    f.mesh.position.addScaledVector(f.vel, dt);
    f.mesh.material.opacity = clamp(f.t * 4, 0, 1);
    if (f.t <= 0) f.mesh.visible = false;
  }
}

/* ======================= Spieler ======================= */
let heroVisual = null; // wird nach dem Laden der GLB-Assets erzeugt

const player = {
  pos: V3(25, 0.05, 25),
  vel: V3(0, 0, 0),
  radius: 0.45,
  height: 1.75,
  hp: CFG.playerHP,
  facing: 0,
  state: 'ground',        // ground | air | swing | climb | zip | kante
  kante: null,
  onGround: true,
  jumps: 0,
  phase: 0,
  wall: null,             // {col, nx, nz}
  swing: null,            // {anchor, len}
  zip: null,              // {target, t, enemy}
  attack: null,           // {type, t, arm, hitDone}
  attackBuffer: null,     // gepufferte Eingabe für flüssige Ketten
  fadenZiel: null, fadenHand: 'R',   // wohin der Netzfaden zeigt
  combo: 0, comboTimer: 0, stufe: 0, klettertempo: 0, ziel: null, keinHaltCd: 0,
  hartLandung: 0, saltoCd: 0, luftSalto: 0, warSchwung: 0, schrittT: 0,
  eckT: 0, eckSperre: 0, sichtPos: null, wandStill: false, wandRuhe: 0,
  /* ---- Symbiont ----
     Kaempfen fuellt den Balken. Ist er voll, laesst sich der schwarze
     Anzug zuschalten: haerter, schneller, aber nur fuer eine Weile. */
  symEnergie: 0, symZeit: 0, symAn: false, symBlitz: 0,
  luftKombo: 0, konterT: 0, konterZiel: null,
  anlaufZiel: null, anlaufT: 0, anlaufSatz: false, gleiten: false, gleitMisch: 0, gleitAus: 0,
  kurveGlatt: 0, dreiPunktT: 0, dreiPunktSeite: 'R', beideAmFaden: false,
  altVelX: 0, altVelZ: 0, neigVor: 0, neigSeit: 0, wandSchwung: 0, wandBoostCd: 0, katFlug: 0, zug: null,
  haltenT: 0, duckt: false, duckMisch: 0,
  gleitNase: 0, gleitKurve: 0, gleitT: 0,
  attackCd: 0,
  dodgeT: 0, iFrames: 0, rollT: 0, landT: 0, hitT: 0,
  schussT: 0, schussZiel: V3(0, 0, 0), wurfT: 0, freiFallMisch: 0,
  haeltObjekt: null,
  hurtCd: 0, regenCd: 0,
  platform: null,
  lastDamageFrom: null,
  dead: false,
  score: 0,
  anim: 'idle',
};

/* Welche Hand gerade schießt – wechselt bei jedem Netzeinsatz */
let netzHand = 'R';
function wechsleNetzHand() { netzHand = netzHand === 'R' ? 'L' : 'R'; return netzHand; }

function heroHandPos(out, seite) {
  const s = seite || netzHand;
  if (heroVisual && heroVisual.procedural) {
    heroVisual.human.root.updateMatrixWorld(true);
    const hand = s === 'L' ? heroVisual.human.handL : heroVisual.human.handR;
    return hand.getWorldPosition(out);
  }
  if (heroVisual && heroVisual.handPos) {
    const p = heroVisual.handPos(s, out);
    if (p) return p;
  }
  // Notfall-Näherung
  const seitlich = s === 'L' ? -0.28 : 0.28;
  return out.set(
    player.pos.x + Math.cos(player.facing) * seitlich + Math.sin(player.facing) * 0.15,
    player.pos.y + 1.45,
    player.pos.z - Math.sin(player.facing) * seitlich + Math.cos(player.facing) * 0.15
  );
}

/* ======================= Eingabe ======================= */
const keys = {};
let mouseDX = 0, mouseDY = 0;
let pointerLocked = false;
let swingHeld = false; // rechte Maustaste

// Testmodus: erlaubt automatisierte Läufe ohne Pointer-Lock
function isActive() { return pointerLocked || touchAktiv || window.__WEBHERO_TEST__ === true; }

const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const helpBox = document.getElementById('help');

overlay.addEventListener('click', () => {
  SFX.init();
  /* Musik darf erst nach einer Nutzeraktion starten (Browser-Regel). */
  MUSIK.starte();
  if (istTouch) {
    /* Auf dem Handy gibt es keine Zeigersperre – dort startet das Spiel
       direkt und die Bildschirmsteuerung übernimmt. */
    touchAktiv = true;
    overlay.style.display = 'none';
    hud.style.display = 'block';
    baueTouch();
    /* Beim ersten Mal einmal zeigen, wo was liegt – vorher musste man die
       Knöpfe raten, weil die Tastaturhilfe auf dem Handy ausgeblendet ist. */
    try {
      if (!localStorage.getItem('webhero_touchhilfe')) {
        zeigeTouchHilfe(true);
        localStorage.setItem('webhero_touchhilfe', '1');
      }
    } catch (e) {}
    /* Vollbild: sonst frisst die Adressleiste ein Fünftel des Bildes und
       ein Wisch nach oben wirft einen aus dem Spiel. */
    const el = document.documentElement;
    const voll = el.requestFullscreen || el.webkitRequestFullscreen;
    if (voll) { try { voll.call(el).catch(() => {}); } catch (e) {} }
    if (screen.orientation && screen.orientation.lock) {
      try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    }
    /* Bildschirm nicht abdunkeln lassen. */
    if (navigator.wakeLock && navigator.wakeLock.request) {
      try { navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
    }
    return;
  }
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  overlay.style.display = pointerLocked ? 'none' : 'flex';
  hud.style.display = pointerLocked ? 'block' : 'none';
  if (pointerLocked) document.getElementById('clickmsg').textContent = '▶ Klicken zum Fortsetzen';
});
document.addEventListener('mousemove', (e) => {
  if (!isActive()) return;
  mouseDX += e.movementX; mouseDY += e.movementY;
});
document.addEventListener('mousedown', (e) => {
  if (!isActive()) return;
  if (e.button === 0) tryAttack('punch');
  if (e.button === 2) swingHeld = true;
});
document.addEventListener('mouseup', (e) => { if (e.button === 2) swingHeld = false; });
/* Verlässt das Fenster den Fokus oder springt die Mauszeigersperre auf,
   kommt kein mouseup mehr an – die rechte Taste bliebe sonst "gedrückt"
   und der Netzschwung ließe sich nicht mehr beenden. */
window.addEventListener('blur', () => { swingHeld = false; });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) swingHeld = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.code === 'F5' || (e.ctrlKey && e.code === 'KeyR')) return;
  keys[e.code] = true;
  if (!isActive()) return;
  if (e.repeat) return;
  switch (e.code) {
    case 'Space': tryJump(); break;
    case 'KeyF': tryAttack('kick'); break;
    case 'KeyQ': webShot(); break;
    case 'KeyE': webZip(); break;
    case 'ControlLeft': case 'ControlRight': dodge(); e.preventDefault(); break;
    case 'KeyH': helpBox.style.display = helpBox.style.display === 'block' ? 'none' : 'block'; break;
    case 'KeyM': { const m = SFX.toggleMute(); popupScreen(m ? '🔇 Ton aus' : '🔊 Ton an'); break; }
    case 'Escape': zeigeEinstellungen(settingsEl.style.display !== 'flex'); break;
    case 'KeyR': uppercut(); break;
    case 'KeyG': packenUndWerfen(); break;
    case 'KeyV': katapultStart(); break;
    case 'KeyC': if (!ersteHilfe()) popupScreen('Niemand in der Nähe, dem du helfen könntest'); break;
    case 'KeyT': symbiontStart(); break;
    case 'Enter': if (player.dead) respawn(); break;
  }
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyV') katapultLos();
});

/* Bewegung kann von drei Quellen kommen: Tastatur, Gamepad-Stick und
   dem Daumenknüppel auf dem Handy. Alle schreiben in dieselbe Achse. */
const stick = { x: 0, z: 0 };

function inputDir() {
  // Bewegungsrichtung relativ zur Kamera (Bodenebene)
  let fx = 0, fz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) fz += 1;
  if (keys['KeyS'] || keys['ArrowDown']) fz -= 1;
  if (keys['KeyA'] || keys['ArrowLeft']) fx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) fx += 1;
  if (!fx && !fz) { fx = stick.x; fz = stick.z; }
  if (!fx && !fz) return null;
  /* Immer auf Länge 1 bringen – auch bei halb ausgelenktem Knüppel.
     Vorher ging die Auslenkung direkt ins Tempo: bei 30 % Ausschlag lief
     die Figur mit 0,8 m/s statt der 2,8 m/s einer Gehstufe, und keine der
     vier Gangarten war auf dem Handy sauber erreichbar. Wie weit man
     drückt, wählt jetzt die Gangart (siehe gangTempo), nicht das Tempo. */
  const len = Math.hypot(fx, fz);
  if (len > 0.0001) { fx /= len; fz /= len; }
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  return { x: fz * -sin + fx * cos, z: fz * -cos - fx * sin };
}

/* ======================= Gamepad =======================
   Standard-Belegung ("standard mapping"), funktioniert mit Xbox- und
   PlayStation-Pads gleichermaßen. Die Tasten lösen genau dieselben
   Funktionen aus wie die Tastatur. */
const PAD_TASTEN = {
  0: () => tryJump(),
  1: () => dodge(),
  2: () => tryAttack('punch'),
  3: () => katapultStart(),
  4: () => webShot(),
  5: () => webZip(),
  6: () => uppercut(),
  8: () => { if (!ersteHilfe()) popupScreen('Niemand in der Nähe, dem du helfen könntest'); },
  9: () => zeigeEinstellungen(settingsEl.style.display !== 'flex'),
  11: () => packenUndWerfen(),
};
const padVorher = {};
let padAktiv = false;

function updateGamepad() {
  if (!navigator.getGamepads) return;
  let gp = null;
  const liste = navigator.getGamepads();
  for (let i = 0; i < liste.length; i++) if (liste[i] && liste[i].connected) { gp = liste[i]; break; }
  if (!gp) { padAktiv = false; return; }
  padAktiv = true;
  const tot = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);

  const lx = tot(gp.axes[0] || 0), ly = tot(gp.axes[1] || 0);
  if (lx || ly) { stick.x = lx; stick.z = -ly; }
  else if (!zeigerStick) { stick.x = 0; stick.z = 0; }

  /* Rechter Stick blickt um – wie die Maus, nur mit fester Rate. */
  const rx = tot(gp.axes[2] || 0), ry = tot(gp.axes[3] || 0);
  mouseDX += rx * 26; mouseDY += ry * 20;

  const gedrueckt = (i) => {
    const b = gp.buttons[i];
    return !!b && (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5);
  };
  for (const i in PAD_TASTEN) {
    const jetzt = gedrueckt(i);
    if (jetzt && !padVorher[i] && isActive()) PAD_TASTEN[i]();
    padVorher[i] = jetzt;
  }
  /* Gehaltene Tasten: RT = Netzschwung, L3 = Sprint. */
  if (!gedrueckt(3) && KAT.aktiv) katapultLos();
  swingHeld = swingHeld || gedrueckt(7);
  if (!gedrueckt(7) && padSchwang) swingHeld = false;
  padSchwang = gedrueckt(7);
  padSprint = gedrueckt(10) || Math.hypot(lx, ly) > 0.92;
}
let padSchwang = false, padSprint = false;

/* ======================= Touch-Steuerung (Handy/Tablet) =======================
   Links ein Daumenknüppel zum Laufen, rechts wischt man für die Kamera,
   dazu ein Kranz aus Knöpfen. Auf dem Handy gibt es keine Zeigersperre,
   deshalb startet das Spiel dort ohne pointerLock. */
const istTouch = (typeof window !== 'undefined') &&
  (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 1) &&
  window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
let touchSprint = false, touchAktiv = false, touchKleben = false, touchGleiten = false;
let touchDucken = false, touchSprintKnopf = false;
const touchKnoepfe = [];      // { a, el, erlaubt } je Knopf, für die Zustandsanzeige
let zeigerStick = false;   // wahr, solange ein Finger den Knüppel hält

function baueTouch() {
  const wrap = document.getElementById('touch');
  if (!wrap || !istTouch) return;
  wrap.style.display = 'block';
  document.body.classList.add('touch');

  /* --- Knüppel links --- */
  const pad = document.getElementById('tstick');
  const knopf = document.getElementById('tstickKnopf');
  let stickId = null, mx = 0, my = 0, r = 55;
  function stickStart(t) {
    const b = pad.getBoundingClientRect();
    mx = b.left + b.width / 2; my = b.top + b.height / 2; r = b.width / 2;
    stickId = t.identifier; zeigerStick = true; stickBewegen(t);
  }
  function stickBewegen(t) {
    let dx = (t.clientX - mx) / r, dy = (t.clientY - my) / r;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    stick.x = dx; stick.z = -dy;
    touchSprint = l > 0.85;
    knopf.style.transform = `translate(${dx * r * 0.55}px, ${dy * r * 0.55}px)`;
  }
  function stickEnde() {
    stickId = null; zeigerStick = false; touchSprint = false;
    stick.x = 0; stick.z = 0; knopf.style.transform = 'translate(0,0)';
  }

  /* --- Kamera: Wischen auf der rechten Bildhälfte --- */
  let kamId = null, kx = 0, ky = 0;

  wrap.addEventListener('touchstart', (ev) => {
    for (const t of ev.changedTouches) {
      if (t.target.closest && t.target.closest('#tknoepfe, #toben')) continue;
      if (stickId === null && t.clientX < window.innerWidth * 0.45) { stickStart(t); continue; }
      if (kamId === null) { kamId = t.identifier; kx = t.clientX; ky = t.clientY; }
    }
    ev.preventDefault();
  }, { passive: false });

  wrap.addEventListener('touchmove', (ev) => {
    for (const t of ev.changedTouches) {
      if (t.identifier === stickId) stickBewegen(t);
      else if (t.identifier === kamId) {
        /* Die Empfindlichkeit steckt schon in updateCamera – hier nur der
           feste Faktor für den Wisch. Vorher ging der Regler doppelt ein und
           wirkte auf dem Handy quadratisch. */
        mouseDX += (t.clientX - kx) * 1.5; mouseDY += (t.clientY - ky) * 1.5;
        kx = t.clientX; ky = t.clientY;
      }
    }
    ev.preventDefault();
  }, { passive: false });

  const ende = (ev) => {
    for (const t of ev.changedTouches) {
      if (t.identifier === stickId) stickEnde();
      if (t.identifier === kamId) kamId = null;
    }
  };
  wrap.addEventListener('touchend', ende);
  wrap.addEventListener('touchcancel', ende);

  /* ======================= Knöpfe =======================
     Alle Fähigkeiten stehen in einer einzigen Liste. Daraus baut sich das
     Knopffeld, daraus baut sich die Hilfe, und daraus prüft jedes Bild, was
     gerade benutzbar ist. Eine neue Fähigkeit braucht damit genau einen
     Eintrag – und liegt sofort auch auf Handy und Tablet.

     art:  'tipp'   – einmal antippen
           'halten' – solange der Finger liegt (tun/los)
     reihe: 0 = obere Ecke (Menü, Hilfe), 1..3 = Kränze von oben nach unten
     kann():  false -> Knopf wird blass, löst aber trotzdem aus. Das ist der
              Zustand des Spiels ("gerade nicht in der Luft") – ihn zu sperren
              würde einen Druck verschlucken, der einen Sekundenbruchteil zu
              früh kommt, und genau das fühlt sich auf dem Handy kaputt an.
     frei():  false -> Knopf ist wirklich gesperrt (Fähigkeit noch nicht
              freigespielt) und sagt beim Antippen, woran es liegt.
     zeig():  false -> Knopf wird ausgeblendet (nur für Sonderfälle) */
  const TOUCH_AKTIONEN = [
    { id: 'tMenue', sym: '☰', bez: 'Menü', reihe: 0, klein: true, art: 'tipp',
      hilfe: 'Einstellungen, Lautstärke, Grafik, Kamera',
      tun: () => zeigeEinstellungen(settingsEl.style.display !== 'flex') },
    { id: 'tFrage', sym: '?', bez: 'Hilfe', reihe: 0, klein: true, art: 'tipp',
      hilfe: 'Diese Übersicht', tun: () => zeigeTouchHilfe(true) },

    { id: 'tSprint', sym: '»', bez: 'Sprint', reihe: 1, art: 'halten',
      hilfe: 'Halten: rennen (11 m/s). Am Boden gegen eine Hauswand rennen = Wandlauf. In der Luft = Gleitflug.',
      tun: () => { touchSprintKnopf = true; }, los: () => { touchSprintKnopf = false; } },
    { id: 'tGleiten', sym: '🪂', bez: 'Gleiten', reihe: 1, art: 'halten',
      hilfe: 'In der Luft halten: Netzflügel tragen dich weit',
      kann: () => !player.onGround,
      tun: () => { touchGleiten = true; }, los: () => { touchGleiten = false; } },
    { id: 'tKatapult', sym: '⇈', bez: 'Katapult', reihe: 1, art: 'halten',
      hilfe: 'Auf einem Dach halten: zwei Netze spannen, loslassen = Riesensprung',
      kann: () => player.onGround && !player.dead,
      tun: () => katapultStart(), los: () => katapultLos() },
    { id: 'tDucken', sym: '🦵', bez: 'Ducken', reihe: 1, art: 'halten',
      hilfe: 'Halten: ducken (2,2 m/s). Mit leicht ausgelenktem Knüppel: schleichen (1,4 m/s). ' +
             'Zusammen mit dem Sprint-Knopf: auf allen vieren kriechen (0,85 m/s).',
      kann: () => player.onGround,
      tun: () => { touchDucken = true; }, los: () => { touchDucken = false; } },
    { id: 'tKlettern', sym: '🧗', bez: 'Halten', reihe: 1, art: 'halten',
      hilfe: 'An einer Wand halten: kleben bleiben statt abzurutschen',
      kann: () => !player.onGround,
      tun: () => { touchKleben = true; }, los: () => { touchKleben = false; } },

    { id: 'tNetz', sym: '🕸', bez: 'Netz', reihe: 2, art: 'tipp',
      hilfe: 'Netzschuss – wickelt einen Gegner ein', tun: () => webShot() },
    { id: 'tZip', sym: '➤', bez: 'Zip', reihe: 2, art: 'tipp',
      hilfe: 'Netz-Zip nach vorn oder zu einem Gegner', tun: () => webZip() },
    { id: 'tHaken', sym: '↑✊', bez: 'Haken', reihe: 2, art: 'tipp',
      hilfe: 'Aufwärtshaken – schleudert Gegner hoch (ab Stufe 2)',
      frei: () => stufeFrei('uppercut'), gesperrtText: 'Aufwärtshaken gibt es ab Stufe 2',
      tun: () => uppercut() },
    { id: 'tWurf', sym: '✊➜', bez: 'Wurf', reihe: 2, art: 'tipp',
      hilfe: 'Packen, heranziehen und schleudern (ab Stufe 3)',
      frei: () => stufeFrei('wurf'), gesperrtText: 'Packen und Werfen gibt es ab Stufe 3',
      tun: () => packenUndWerfen() },
    { id: 'tRolle', sym: '↻', bez: 'Rolle', reihe: 2, art: 'tipp',
      hilfe: 'Ausweichrolle – im richtigen Moment gibt es einen Konter', tun: () => dodge() },
    { id: 'tHilfeC', sym: '✚', bez: '1. Hilfe', reihe: 2, art: 'tipp',
      hilfe: 'Verletzten am roten Kreuz helfen',
      tun: () => { if (!ersteHilfe()) popupScreen('Niemand in der Nähe, dem du helfen könntest'); } },
    { id: 'tSymbiont', sym: '🕷', bez: 'Symbiont', reihe: 2, art: 'tipp',
      hilfe: 'Schwarzer Anzug: 22 Sekunden lang deutlich mehr Wucht. ' +
             'Der Balken fuellt sich beim Kaempfen; erst wenn er voll ist, geht es.',
      zeig: () => player.symEnergie > 0.001 || player.symAn,
      tun: () => symbiontStart() },

    { id: 'tTritt', sym: '🦶', bez: 'Tritt', reihe: 3, gross: true, art: 'tipp',
      hilfe: 'Tritt – mehr Schaden als der Schlag', tun: () => tryAttack('kick') },
    { id: 'tSchlag', sym: '👊', bez: 'Schlag', reihe: 3, gross: true, art: 'tipp',
      hilfe: 'Schlag-Kombo', tun: () => tryAttack('punch') },
    { id: 'tSprung', sym: '⤒', bez: 'Sprung', reihe: 3, gross: true, art: 'tipp',
      hilfe: 'Springen, in der Luft noch einmal für den Doppelsprung',
      tun: () => tryJump() },
    { id: 'tSchwung', sym: '🕷', bez: 'Schwung', reihe: 3, gross: true, art: 'halten',
      hilfe: 'In der Luft halten: Netzschwung. Kurz tippen bleibt ein Sprung.',
      tun: () => { swingHeld = true; }, los: () => { swingHeld = false; } },
    { id: 'tNeu', sym: '↺', bez: 'Weiter', reihe: 3, gross: true, art: 'tipp',
      hilfe: 'Nach einem K.o. zurück zum Startpunkt',
      zeig: () => player.dead, tun: () => respawn() },
  ];

  const oben = document.getElementById('toben');
  const unten = document.getElementById('tknoepfe');
  touchKnoepfe.length = 0;
  const reihen = {};
  for (const a of TOUCH_AKTIONEN) {
    if (!reihen[a.reihe]) {
      const d = document.createElement('div');
      d.className = 'treihe r' + a.reihe;
      (a.reihe === 0 ? oben : unten).appendChild(d);
      reihen[a.reihe] = d;
    }
    const el = document.createElement('button');
    el.id = a.id;
    el.className = a.klein ? 'tklein' : (a.gross ? 'tgross' : '');
    el.innerHTML = `<span>${a.sym}</span>` +
                   (a.klein ? '' : `<span class="tbez">${a.bez}</span>`);
    reihen[a.reihe].appendChild(el);

    /* Gesperrt ist nur, was noch nicht freigespielt ist – dann sagt der
       Knopf auch, woran es liegt. Alles andere löst immer aus, selbst wenn
       es blass ist: sonst verschluckt ein Druck kurz vor dem Absprung die
       Eingabe, und das fühlt sich kaputt an. */
    const erlaubt = () => (!a.frei || a.frei()) && (!a.zeig || a.zeig());
    const runter = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (!erlaubt()) {
        popupScreen(a.gesperrtText || (a.bez + ' geht gerade nicht'));
        return;
      }
      el.classList.add('tan');
      a.tun();
    };
    const hoch = (ev) => {
      if (ev) ev.stopPropagation();
      el.classList.remove('tan');
      if (a.los) a.los();
    };
    el.addEventListener('touchstart', runter, { passive: false });
    el.addEventListener('touchend', hoch);
    el.addEventListener('touchcancel', hoch);
    /* Wandert der Finger vom Knopf herunter, gilt das ebenfalls als
       Loslassen – sonst bliebe zum Beispiel der Schwung hängen. */
    if (a.art === 'halten') el.addEventListener('touchmove', (ev) => {
      const t = ev.changedTouches[0];
      if (!t) return;
      const b = el.getBoundingClientRect();
      if (t.clientX < b.left - 24 || t.clientX > b.right + 24 ||
          t.clientY < b.top - 24 || t.clientY > b.bottom + 24) hoch(ev);
    }, { passive: false });

    touchKnoepfe.push({ a, el, erlaubt });
  }

  /* --- Hilfeblatt aus derselben Liste --- */
  const liste = document.getElementById('thilfeListe');
  if (liste) {
    let html = '<div class="z"><div class="s">◉</div><div class="t">' +
               '<b>Knüppel links</b><span>Laufen, klettern. Leicht auslenken = gehen, ' +
               'ganz auslenken = sprinten.</span></div></div>' +
               '<div class="z"><div class="s">✋</div><div class="t">' +
               '<b>Rechte Bildhälfte wischen</b><span>Kamera drehen. Sie zieht auch von ' +
               'allein mit – im Menü unter „Kamera folgt" einstellbar.</span></div></div>';
    for (const a of TOUCH_AKTIONEN) {
      if (a.reihe === 0) continue;
      html += `<div class="z"><div class="s">${a.sym}</div><div class="t">` +
              `<b>${a.bez}</b><span>${a.hilfe}</span></div></div>`;
    }
    liste.innerHTML = html;
  }
  const zu = document.getElementById('thilfeZu');
  if (zu) zu.addEventListener('click', () => zeigeTouchHilfe(false));

  aktualisiereTouchKnoepfe();
}

/* Blende die Knöpfe nach Lage: was gerade nicht geht, wird blass. */
function aktualisiereTouchKnoepfe() {
  if (!touchKnoepfe.length) return;
  for (const k of touchKnoepfe) {
    const zeigen = !k.a.zeig || k.a.zeig();
    k.el.classList.toggle('tweg', !zeigen);
    const nutzbar = (!k.a.kann || k.a.kann()) && (!k.a.frei || k.a.frei());
    k.el.classList.toggle('taus', zeigen && !nutzbar);
  }
}

function zeigeTouchHilfe(an) {
  const el = document.getElementById('thilfe');
  if (el) el.style.display = an ? 'flex' : 'none';
}

/* Sprint kommt von Shift, vom Gamepad oder vom Sprintknopf am Bildschirm. */
function sprintAn() { return !!(keys['ShiftLeft'] || keys['ShiftRight'] || padSprint || touchSprint || touchSprintKnopf); }
/* Gleiten startet nur auf ausdrücklichen Druck.
   Der Daumenknüppel zählt hier NICHT mit: zum Laufen lenkt man ihn ohnehin
   voll aus, und auf dem iPad breitete die Figur deshalb schon bei jedem
   Sprung die Flügel aus. Sprinten und Gleiten teilen sich am Rechner die
   Taste, auf dem Handy sind es zwei Knöpfe – beide bewusst gedrückt. */
/* Flügel einklappen und die Haltung sofort mit ausblenden. Ohne das lief
   die Gleitpose an der Wand weiter und die Figur klebte breitbeinig da. */
function beendeGleiten() {
  if (!player.gleiten && (player.gleitMisch || 0) < 0.01) return;
  player.gleiten = false;
  player.gleitAus = 0;
  player.gleitMisch = 0;
  player.gleitNase = 0;
  player.gleitKurve = 0;
}
function gleitTaste() {
  return !!(keys['ShiftLeft'] || keys['ShiftRight'] || padSprint ||
            touchGleiten || touchSprintKnopf);
}

/* ---- Vier Gangarten ----
   Vorher gab es nur zwei Geschwindigkeiten und beide sahen gleich aus.
   Jetzt sieht man auf einen Blick, was die Figur gerade tut:
     ducken   (X)      2,2 m/s  – tief in den Knien, Schleichschritt
     gehen    (Alt)    2,8 m/s  – Gehbewegung
     laufen   (nichts) 7,0 m/s  – Laufbewegung
     sprinten (Shift) 11,0 m/s  – Laufbewegung, lange Schritte
   Am Gamepad und auf dem Handy entscheidet zusätzlich der Ausschlag des
   Sticks: leicht gedrückt heißt gehen. */
function geheAn() { return !!(keys['AltLeft'] || keys['AltRight']); }
function duckenAn() {
  return !!(keys['KeyX'] || touchDucken) && player.onGround &&
         player.state !== 'climb' && player.rollT <= 0 && !player.attack;
}
/* Wie weit ist der Daumenknüppel bzw. der Gamepad-Stick ausgelenkt?
   -1 heißt: die Richtung kommt von der Tastatur, dort gibt es nur ganz
   oder gar nicht. */
function stickStaerke() {
  if (keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] ||
      keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']) return -1;
  return clamp(Math.hypot(stick.x, stick.z), 0, 1);
}
/* Vier Gangarten, auf jedem Gerät dieselben Geschwindigkeiten.
   Tastatur: X ducken, Alt gehen, nichts laufen, Shift sprinten.
   Knüppel/Stick: bis 55 % gehen, bis 85 % laufen, darüber sprinten. */
/* Welche Gangart ist gerade befohlen? Die Optik braucht den Namen, nicht
   nur das Tempo: beim Umschalten nach gemessener Geschwindigkeit lag die
   Gehstufe (2,8 m/s) mitten in der Hysterese zwischen Gehen und Laufen und
   blieb deshalb beim Laufschritt haengen. */
function gangArt() {
  if (duckenAn()) {
    const s = stickStaerke();
    /* Geduckt UND Sprinttaste: kriechen. Die Sprinttaste ist beim Ducken
       ohnehin unbenutzt - so kommt die dritte Stufe ohne eine neue Taste
       aus, auf dem Handy einfach beide Knoepfe halten. */
    if (sprintAn() && heroVisual && heroVisual.hatClip &&
        heroVisual.hatClip('kriechen')) return 'kriechen';
    return (geheAn() || (s > 0.05 && s < 0.55)) ? 'schleichen' : 'ducken';
  }
  const s = stickStaerke();
  if (sprintAn() || s > 0.85) return 'sprint';
  if (geheAn() || (s > 0.05 && s < 0.55)) return 'walk';
  return 'run';
}
function gangTempo() {
  /* Geduckt und dazu die Gehtaste: schleichen. Damit hat auch die
     Schleichbewegung eine eigene Geschwindigkeit statt nur eine Datei zu
     sein, die nie zu sehen ist. */
  if (duckenAn()) {
    const s = stickStaerke();
    if (sprintAn() && heroVisual && heroVisual.hatClip &&
        heroVisual.hatClip('kriechen')) return CFG.kriechSpeed;
    return (geheAn() || (s > 0.05 && s < 0.55)) ? CFG.schleichSpeed : CFG.duckSpeed;
  }
  const s = stickStaerke();
  if (sprintAn() || s > 0.85) return CFG.sprintSpeed;
  /* Der Symbiontengang ist schwer und langsam. Er wird genau so schnell
     gegangen, wie die Bewegung es hergibt - sonst schleifen die Fuesse. */
  if (geheAn() || (s > 0.05 && s < 0.55)) {
    return player.symAn ? CFG.symSpeed : CFG.walkSpeed;
  }
  return CFG.runSpeed;
}

/* ======================= Kamera ======================= */
let camYaw = Math.PI * 0.85, camPitch = 0.22, camDist = 5.6, camShake = 0;
const camPos = V3(0, 8, 20);

function camForward() {
  return _v3.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)).normalize().clone();
}

let camRoll = 0;
let mausRuhe = 0;
let flugGlatt = 0;   // geglättete Flugrichtung für die mitziehende Kamera
let kamZwang = 0;    // nur für Tests: feste Kameraentfernung
function updateCamera(dt) {
  const emp = 0.0023 * (EINST.maus / 100);
  const mausAktiv = Math.abs(mouseDX) > 0.5 || Math.abs(mouseDY) > 0.5;
  camYaw -= mouseDX * emp;
  camPitch = clamp(camPitch + mouseDY * emp, -1.15, 1.25);
  mouseDX = 0; mouseDY = 0;
  mausRuhe = mausAktiv ? 0 : mausRuhe + dt;

  const speed = player.vel.length();

  /* ---- Kamera zieht in der Kurve nach ----
     Beim Schwingen dreht sich die Flugrichtung ständig; die Kamera stand
     bisher starr da, wo die Maus sie zuletzt hingelegt hatte. Sobald man
     die Maus einen Moment ruhen lässt, wandert sie sanft hinter die
     Flugrichtung – man sieht, wohin es geht, ohne dauernd nachziehen zu
     müssen. Jede Mausbewegung übernimmt sofort wieder das Kommando. */
  /* Wie weit die Kamera von allein mitzieht, hängt an der Einstellung
     "Kamera folgt". Auf dem Handy hat man beim Schwingen keinen Daumen frei
     zum Wischen, dort steht sie deshalb ab Werk auf "immer". Am Rechner
     bleibt es bei "nur beim Gleiten": beim Schwingen fühlte es sich sonst
     an, als lenke das Spiel selbst. Jede Wisch- oder Mausbewegung übernimmt
     sofort wieder das Kommando. */
  const AUTOKAM_STUFE = { aus: 0, gleiten: 1, schwung: 2, an: 3 };
  const autoStufe = AUTOKAM_STUFE[EINST.autokam] !== undefined
    ? AUTOKAM_STUFE[EINST.autokam] : 1;
  let autoKraft = 0, autoRuhe = 0.35;
  if (autoStufe >= 1 && player.gleiten && speed > 6) autoKraft = 1.5;
  else if (autoStufe >= 2 && speed > 6 &&
           (player.state === 'swing' || player.state === 'zip' || KAT.aktiv ||
            (!player.onGround && player.katFlug > 0))) autoKraft = touchAktiv ? 1.5 : 1.0;
  else if (autoStufe >= 3 && player.onGround && speed > 3.2 && !player.attack) {
    /* Am Boden schwächer und träger – sonst dreht sich die Kamera schon
       bei jedem kleinen Richtungswechsel um die eigene Achse. */
    autoKraft = 0.55; autoRuhe = 0.8;
  }
  /* Die Kamera folgt nicht der Momentanrichtung, sondern einer geglätteten:
     beim Schwingen pendelt die Flugrichtung im Bogen hin und her, und eine
     Kamera, die das mitmacht, macht seekrank. Geglättet zeigt sie ruhig
     dorthin, wo es insgesamt hingeht. */
  const flugRoh = Math.atan2(player.vel.x, player.vel.z);
  if (speed > 2) flugGlatt = dampAngle(flugGlatt, flugRoh, Math.min(0.4, dt * 2.2));
  if (autoKraft > 0 && mausRuhe > autoRuhe) {
    /* camYaw ist die Richtung, aus der die Kamera schaut – also gegenüber. */
    const zielYaw = flugGlatt + Math.PI;
    const staerke = clamp((mausRuhe - autoRuhe) * 1.2, 0, 1) * autoKraft;
    camYaw = dampAngle(camYaw, zielYaw, Math.min(0.3, dt * 1.5 * staerke));
    /* Der Blickwinkel wandert dabei in eine bequeme Höhe zurück: beim
       Schwingen schaut man leicht von oben mit, statt in den Himmel oder
       in den Asphalt zu starren. */
    const zielPitch = player.onGround ? 0.2 : 0.12;
    camPitch = lerp(camPitch, zielPitch, Math.min(0.25, dt * 0.9 * staerke));
  }

  /* Am Tiefpunkt des Bogens geht die Kamera weiter auf: dort ist man am
     schnellsten und braucht am meisten Übersicht. */
  let schwungWeit = 0;
  if (player.state === 'swing' && player.swing) {
    const tief = clamp((player.swing.anchor.y - player.pos.y) / Math.max(4, player.swing.len), 0, 1);
    schwungWeit = tief * 2.6;
  }
  const targetDist = kamZwang > 0 ? kamZwang
                   : (player.state === 'swing' ? 8.0 + schwungWeit
                                              : lerp(6.3, 7.8, clamp(speed / 25, 0, 1)));
  camDist = lerp(camDist, targetDist, dt * 3);
  const targetFov = lerp(70, 84, clamp(speed / 30, 0, 1));
  camera.fov = lerp(camera.fov, targetFov, dt * 4);
  camera.updateProjectionMatrix();

  const target = _v1.copy(player.pos); target.y += 1.7;
  const dir = _v2.set(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)
  );
  // Kamerakollision mit Gebäuden (abtasten)
  /* Zehn Schritte auf bis zu 10,6 m sind Schritte von ueber einem Meter -
     eine Hausecke passt bequem dazwischen. Sechzehn sind rund 65 cm. */
  let d = camDist;
  for (let i = 1; i <= 16; i++) {
    const t = (camDist * i) / 16;
    const px = target.x + dir.x * t, py = target.y + dir.y * t, pz = target.z + dir.z * t;
    let blocked = py < groundY(px, pz, py) + 0.3;
    /* Steht die Figur auf einem Dach und man schaut nach unten, rutschte
       die Kamera an der Dachkante vorbei unter das Dach – man sah dann von
       unten in das Gesims hinein. Solange man festen Boden unter den Füßen
       hat, darf die Kamera nicht nennenswert darunter. */
    if (!blocked && player.onGround && py < player.pos.y + 0.35) blocked = true;
    if (!blocked) {
      const cols = collidersNear(px, pz);
      for (const c of cols) {
        /* Auch Vorsprünge (Gesimse, Feuerleitern) blockieren – aber nur in
           ihrer eigenen Höhe. */
        if (c.y0 !== undefined && py < c.y0 - 0.3) continue;
        if (px > c.x0 - 0.3 && px < c.x1 + 0.3 && pz > c.z0 - 0.3 && pz < c.z1 + 0.3 && py < c.h + 0.2) { blocked = true; break; }
      }
    }
    /* Hier stand Math.max(1.2, t - 0.5). Blockte etwas schon bei 1,0 m,
       kam 1,2 heraus - die Kamera wurde also HINTER das Hindernis gesetzt
       und stand mitten in der Fassade. Beim Schwingen dicht an Haeusern
       vorbei fuellte dann eine dunkle Wand das ganze Bild.
       Jetzt wird nie weiter gerueckt als bis kurz vor den Treffer. */
    if (blocked) { d = Math.max(0.55, t - 0.55); break; }
  }
  const desired = _v3.copy(target).addScaledVector(dir, d);
  camPos.lerp(desired, Math.min(1, dt * 12));
  camera.position.copy(camPos);
  if (camShake > 0) {
    camera.position.x += rand(-1, 1) * camShake;
    camera.position.y += rand(-1, 1) * camShake;
    camShake = Math.max(0, camShake - dt * 1.6);
  }
  camera.lookAt(target);

  /* Kameraneigung: Beim Schwingen legt sich das Bild in die Kurve, beim
     schnellen Fallen kippt es leicht mit. Das ist der Unterschied zwischen
     "Figur pendelt" und "ich schwinge da durch". */
  let rollZiel = 0;
  if (player.state === 'swing' && player.swing) {
    /* Seitliche Beschleunigung: Geschwindigkeit quer zur Blickrichtung. */
    const f = _v1.set(Math.sin(camYaw), 0, Math.cos(camYaw));
    const quer = player.vel.x * f.z - player.vel.z * f.x;
    rollZiel = clamp(-quer / 26, -0.42, 0.42);
    /* Zusätzlich in die Richtung des Netzarms kippen. */
    rollZiel += (player.swing.hand === 'L' ? 0.07 : -0.07);
  } else if (!player.onGround) {
    rollZiel = clamp(-player.vel.y / 160, -0.09, 0.09);
  }
  camRoll = lerp(camRoll, rollZiel, Math.min(1, dt * 3.5));
  if (Math.abs(camRoll) > 0.001) camera.rotateZ(camRoll);

  // Sonne folgt dem Spieler (Schattenausschnitt)
  sun.position.copy(player.pos).addScaledVector(SONNE_RICHTUNG, 150);
  sun.target.position.copy(player.pos);
}

/* Bodenhöhe unter einem einzelnen Fuß – inklusive Dächern, Vorsprüngen und
   Autodächern, auf denen man gerade steht. groundY allein kennt nur Straße
   und Gehweg; auf einem Dach stünde der Fuß sonst in der Luft. */
function bodenHoeheFuerFuss(x, z) {
  let h = groundY(x, z, player.pos.y);
  /* Steht die Figur auf einer Plattform (Dach, Vorsprung, Autodach), gilt
     deren Oberkante – aber nur dicht darunter, damit ein Bein nicht auf ein
     zwanzig Meter tieferes Dach gezogen wird. */
  const oben = player.pos.y;
  for (const c of collidersNear(x, z)) {
    if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    if (c.h > h && c.h <= oben + 0.6) h = c.h;
  }
  if (player.platform && player.platform.mesh) {
    const b = carAABB(player.platform);
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.top > h) h = b.top;
  }
  /* Steht man auf einer Kante und ragt ein Fuß darüber hinaus, darf er
     nicht auf die Straße zwei Stufen tiefer gezogen werden. */
  if (player.onGround) h = Math.max(h, player.pos.y - 0.5);
  return h;
}

/* ======================= Kollision Figur <-> Welt ======================= */
/* Zusätzlicher Abstand zur Wand, solange die Figur schnell durch die Luft
   fliegt. Der Kollisionsradius von 45 cm passt zu einer stehenden Figur;
   beim Anfliegen eines Hauses sind Arme und Schultern aber weit
   ausgestreckt und steckten sichtbar in der Fassade. Am Boden bleibt es
   beim alten Wert, sonst käme man nicht mehr dicht an Wände heran. */
function wandPuffer() {
  if (player.onGround || player.state === 'climb' || player.state === 'kante') return 0;
  const v = Math.hypot(player.vel.x, player.vel.z);
  /* Beim Schwingen und Gleiten liegt der Körper waagerecht: Kopf und Arme
     reichen dann rund 80 cm vor den Mittelpunkt, um den die Kollision
     rechnet. Mit dem alten Puffer steckte der Oberkörper weiter in der
     Fassade, obwohl der Mittelpunkt sauber davor lag. */
  const flach = player.state === 'swing' || player.gleiten;
  return clamp((v - 4) / 16, 0, 1) * (flach ? 0.55 : 0.25);
}

/* Die Lage VOR dem Schritt merken. collideBody entscheidet damit, auf
   welcher Seite eines Klotzes die Figur wieder herauskommt. */
function merkeVorPos(body) {
  if (!body.vorPos) body.vorPos = new THREE.Vector3();
  body.vorPos.copy(body.pos);
}

function collideBody(body, prevY, radiusExtra) {
  // body: {pos, vel, radius, onGround, wall, platform}
  const p = body.pos, r = body.radius + (radiusExtra || 0);
  body.wall = null;
  const cols = collidersNear(p.x, p.z);
  for (const c of cols) {
    /* Vorsprünge wie Feuerleiter-Podeste haben eine Unterkante (y0). Sie
       sind nur in ihrer eigenen Höhe im Weg – sonst würde man schon unten
       auf der Straße gegen eine unsichtbare Wand laufen. */
    if (c.y0 !== undefined && p.y + 1.75 < c.y0) continue;
    if (p.x > c.x0 - r && p.x < c.x1 + r && p.z > c.z0 - r && p.z < c.z1 + r && p.y < c.h - 0.001) {
      // Auf dem Dach landen?
      if (prevY !== undefined && prevY >= c.h - 0.05 && body.vel.y <= 0.01) {
        p.y = c.h; body.vel.y = 0; body.onGround = true; body.groundTop = c.h;
        continue;
      }
      /* ---- Mit dem Kopf anstossen ----
         Vorsprünge mit Unterkante (y0) wurden bisher IMMER waagerecht
         weggedrueckt. Steht man unter einem Tuersturz oder in einem
         begehbaren Haus und springt, schiebt einen das seitlich aus dem
         Gebaeude heraus - man wird also aus der Wand teleportiert.
         Richtig ist: solange die FUESSE noch unter der Unterkante sind und
         nur der Kopf dagegen kommt, ist es eine Decke. Dann wird die Hoehe
         begrenzt und der Aufwaertsschwung genommen, sonst nichts. */
      if (c.y0 !== undefined && p.y + 0.25 < c.y0 && p.y + 1.75 > c.y0) {
        if (body.vel.y > 0) body.vel.y = 0;
        p.y = Math.min(p.y, c.y0 - 1.75);
        continue;
      }
      /* ---- Horizontal herausdruecken ----
         Der naheliegende Weg ist die KUERZESTE Strecke nach draussen. Der
         ist aber falsch, sobald die Figur ein Stueck weit im Klotz steckt:
         hat sie die Mitte ueberschritten, liegt die kuerzeste Strecke auf
         der GEGENUEBERLIEGENDEN Seite - und die Figur wird durch das Haus
         hindurchgeschoben, statt davor. Genau das war das
         "Ins-Haus-Buggen" bei hohem Tempo.
         Deshalb wird zuerst gefragt, von WELCHER Seite sie gekommen ist:
         war sie vor dem Schritt links des Klotzes, kann sie nur links
         wieder heraus. Nur wenn das nicht zu klaeren ist (etwa weil sie
         schon vorher drin stand), entscheidet wieder die kuerzeste
         Strecke. */
      const dxL = p.x - (c.x0 - r), dxR = (c.x1 + r) - p.x;
      const dzL = p.z - (c.z0 - r), dzR = (c.z1 + r) - p.z;
      const vor = body.vorPos;
      const seiten = [];
      if (vor) {
        if (vor.x <= c.x0 - r) seiten.push(0);
        if (vor.x >= c.x1 + r) seiten.push(1);
        if (vor.z <= c.z0 - r) seiten.push(2);
        if (vor.z >= c.z1 + r) seiten.push(3);
      }
      if (!seiten.length) { seiten.push(0, 1, 2, 3); }
      const weiten = [dxL, dxR, dzL, dzR];
      let wahl = seiten[0];
      for (const k of seiten) if (weiten[k] < weiten[wahl]) wahl = k;
      let nx = 0, nz = 0;
      if (wahl === 0) { p.x = c.x0 - r; nx = -1; }
      else if (wahl === 1) { p.x = c.x1 + r; nx = 1; }
      else if (wahl === 2) { p.z = c.z0 - r; nz = -1; }
      else { p.z = c.z1 + r; nz = 1; }
      const into = body.vel.x * -nx + body.vel.z * -nz;
      if (into > 0) { body.vel.x += nx * into; body.vel.z += nz * into; }
      /* An manchen Wänden gibt es nichts zu klettern – etwa an den
         Innenwänden der U-Bahn-Station. Sonst zieht sich die Figur daran
         aus dem Untergeschoss ans Tageslicht. */
      if (!c.keinKlettern) body.wall = { col: c, nx, nz };
    }
  }
  // Boden
  /* Die eigene Höhe entscheidet mit: über der U-Bahn zählt die Fahrbahn,
     unten der Bahnsteig. */
  const gy = groundY(p.x, p.z, p.y);
  if (p.y <= gy + 0.001 && body.vel.y <= 0.01 && !inWater(p.x, p.z)) {
    p.y = gy; body.vel.y = 0; body.onGround = true;
  }
}

/* ======================= Netzschwung & Netz-Aktionen ======================= */
/* Läuft der Faden frei zum Anker, oder steckt ein Haus dazwischen?
   Ohne diese Prüfung schoss das Netz gern durch die Nachbarfassade. */
function freieSicht(ax, ay, az, bx, by, bz, ziel) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  const schritte = Math.min(26, Math.max(4, Math.round(len / 2.5)));
  for (let i = 1; i < schritte; i++) {
    const t = i / schritte;
    const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
    for (const c of collidersNear(x, z)) {
      if (c === ziel || c.klein) continue;
      if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y < c.h) return false;
    }
  }
  return true;
}

function findAnchor() {
  /* Guter Ankerpunkt: möglichst weit VOR dem Spieler und deutlich über ihm –
     dann entsteht ein weiter Bogen statt eines abrupten Rucks.
     Die Flugrichtung zählt mit, damit der Schwung nicht bei jedem Kameraruck
     die Richtung wechselt. */
  const f = camForward();
  const vh = Math.hypot(player.vel.x, player.vel.z);
  let rx = f.x, rz = f.z;
  if (vh > 4) {                       // Flugrichtung einmischen
    rx = f.x * 0.55 + (player.vel.x / vh) * 0.45;
    rz = f.z * 0.55 + (player.vel.z / vh) * 0.45;
    const l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l;
  }
  const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
  const wunschWeite = clamp(12 + vh * 1.1, 14, 34);   // schneller = weiter greifen
  const boden = groundY(px, pz, py);

  /* Ein Netz muss an einem echten Bauwerk hängen. Früher gab es als
     Rückfall einen "Himmelsanker" – dann hing der Faden sichtbar im
     Nichts, und genau das sah unecht aus. Stattdessen wird jetzt in zwei
     Durchgängen gesucht: erst mit strengen Ansprüchen an den Bogen, dann
     mit lockeren. Findet sich gar nichts, wird kein Netz geschossen. */
  function suche(minDot, minHoehe, maxDist, hoheKante, pendelPruefen) {
    let best = null, bestScore = -1e9;
    for (const c of colliders) {
      if (c.klein) continue;                      // Feuerleitern taugen nicht
      if (c.h < py + hoheKante) continue;
      let cx = px + rx * wunschWeite, cz = pz + rz * wunschWeite;
      if (cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1) {
        /* Der Wunschpunkt liegt MITTEN im Haus. Dann wird bis zur dem
           Spieler zugewandten Dachkante zurückgegangen – sonst hing der
           Anker im Inneren und das Netz verlief durch die Fassade. */
        const sx = rx > 1e-6 ? (cx - c.x0) / rx : (rx < -1e-6 ? (cx - c.x1) / rx : Infinity);
        const sz = rz > 1e-6 ? (cz - c.z0) / rz : (rz < -1e-6 ? (cz - c.z1) / rz : Infinity);
        const sm = Math.min(sx, sz);
        if (isFinite(sm)) { cx -= rx * sm; cz -= rz * sm; }
      } else {
        cx = clamp(cx, c.x0, c.x1);
        cz = clamp(cz, c.z0, c.z1);
      }
      const dx = cx - px, dz = cz - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > maxDist || dist < 3) continue;
      const dot = (dx * rx + dz * rz) / (dist || 1);
      if (dot < minDot) continue;
      /* Nur noch DACHKANTEN. Vorher durfte der Anker mitten auf einer
         Fassade liegen – dann verlief das Netz sichtbar durch die Wand
         und das Seil zog die Figur in das Haus hinein. */
      const anchorY = c.h - 0.35;
      if (anchorY < py + minHoehe) continue;
      /* Der tiefste Punkt des Pendels muss über der Straße bleiben. Sonst
         hängt man am Seil und schleift sofort über den Boden. */
      if (pendelPruefen) {
        const seil = Math.max(CFG.ropeMin, Math.hypot(dist, anchorY - py));
        if (anchorY - seil < boden + 2.5) continue;
      }
      const hoehe = anchorY - py;
      /* Nicht mehr "je höher desto besser": ein Anker 60 m über einem
         ergibt ein schlaffes, langes Seil und der erste Bogen passiert
         fast nichts – das ist das Unflüssige beim Anschwingen vom Boden.
         Bevorzugt wird eine Kante rund 20 m über dem Spieler. */
      const score = dot * 3
                  - Math.abs(dist - wunschWeite) / 18   // Wunschweite bevorzugen
                  - Math.abs(hoehe - 20) / 26;
      if (score > bestScore && freieSicht(px, py + 1.3, pz, cx, anchorY, cz, c)) {
        bestScore = score; best = V3(cx, anchorY, cz);
      }
    }
    return best;
  }
  return suche(0.3, 6, 60, 7, true)     // schöner Bogen nach vorn
      || suche(-0.15, 3, 95, 3, false)   // notfalls auch schräg und weiter weg
      || null;
}

/* Steht die Figur unter der Erde (U-Bahn-Schacht, Tunnel, Bahnsteig)?
   Dort gibt es nichts, woran ein Netz haengen koennte: die Anker sitzen
   auf den Dachkanten der Haeuser, also zwanzig Meter ueber der Decke.
   Ein Netz dorthin zog die Figur durch die Tunneldecke - und die Seil-
   zwangsbedingung setzt die Lage direkt, an jeder Kollision vorbei. Genau
   das war das Durchbuggen durch die Waende. */
function unterTage() {
  return player.pos.y < SLAB_H - 1.5;
}

function startSwing() {
  if (unterTage()) {
    popupScreen('Hier ist nichts, woran ein Netz halten koennte');
    return false;
  }
  const anchor = findAnchor();
  if (!anchor) return false;                  // nichts zum Festmachen in Reichweite
  const abstand = anchor.distanceTo(player.pos);
  /* Das Netz wird beim Festmachen so weit eingeholt, dass der tiefste
     Punkt des Bogens über der Straße bleibt. Vorher wurden solche Anker
     einfach verworfen – tief über der Stadt fand man dann gar keinen mehr
     und der Schwung ging nicht los. Jetzt zieht das Netz stattdessen an,
     genau wie im Vorbild. */
  const boden = groundY(player.pos.x, player.pos.z, player.pos.y);
  const maxLen = Math.max(CFG.ropeMin, anchor.y - boden - 2.2);
  /* Zusätzliche Obergrenze: ein 40-m-Seil schwingt kaum, es fällt nur.
     Mit höchstens 32 m bleiben die Bögen zügig und man merkt den Zug. */
  const grenze = Math.min(Math.max(maxLen, abstand * 0.55), 32);
  const zielLen = clamp(abstand, CFG.ropeMin, grenze);
  const hand = wechsleNetzHand();             // Hände wechseln sich ab
  /* Das Seil beginnt genau so lang, wie die Figur gerade entfernt ist, und
     wird dann eingeholt. Wurde es sofort auf die Wunschlänge gesetzt, hat
     die harte Seilbedingung die Figur im selben Bild an den Anker
     herangerissen – das war der Sprung nach oben beim Anschwingen. */
  player.swing = { anchor, hand, len: Math.max(abstand, zielLen), zielLen, t: 0 };
  player.state = 'swing';
  /* Der Wurf selbst ist eine eigene kurze Bewegung: der Arm holt aus und
     schiesst den Faden. Vorher hing die Figur im ersten Bild einfach schon
     am Netz - man sah nie, wie das Netz losging. */
  if (heroVisual.hatClip && heroVisual.hatClip('netzwurf') && heroVisual.attackOneShot) {
    /* Der Wurf lief mit 1,4-fachem Tempo (0,41-s-Datei in 0,3 s gepresst).
       Die Arme peitschten dadurch, und die Beine bekamen im selben Moment
       noch die Flughaltung mit - genau das war das Zappeln am Anfang des
       Bogens. Jetzt laeuft er in seinem EIGENEN Takt und blendet lang ein. */
    player.wurfT = heroVisual.attackOneShot(0, 'netzwurf', 0.46, 3) || 0.46;
  }
  SFX.thwip();
  return true;
}

/* ---- Kunststuecke im Netzschwung ---------------------------------------
   Spider-Man fliegt nicht nur geradeaus durch die Stadt. Er dreht sich um
   die eigene Achse, ueberschlaegt sich seitlich, kommt kopfueber aus dem
   Bogen heraus - genau das war der "Spass", der hier gefehlt hat. Der
   Bogen selbst war richtig gerechnet, sah aber leer aus.

   Alles hier ist REINE SCHAU: es wird eine Bewegungsdatei einmal
   abgespielt, sonst nichts. Geschwindigkeit, Schwerkraft und Flugbahn
   bleiben unangetastet, deshalb kann ein Kunststueck nie dazu fuehren,
   dass man einen Anker verfehlt oder woanders landet als ohne.

   Drei Sperren halten es sauber:
     - genug Luft nach unten (ein Salto, der im Boden endet, sieht kaputt
       aus),
     - die Dauer richtet sich nach der verbleibenden FALLZEIT, damit das
       Kunststueck fertig ist, bevor der Boden kommt, und
     - eine Pause danach, damit nicht ein Ueberschlag in den naechsten
       faellt.                                                            */
const KUNST_GROSS = ['kunst_a', 'kunst_b', 'flip_v', 'flip_h',
                     'frontflip', 'backflip'];
function schwungKunst(mindestHoehe) {
  if (player.dead || player.onGround || player.state === 'climb') return 0;
  if (player.attack || player.rollT > 0 || player.gleiten) return 0;
  if (player.luftSalto > 0 || player.saltoCd > 0) return 0;
  if (!heroVisual.rolleOneShot) return 0;
  const hoch = player.pos.y - groundY(player.pos.x, player.pos.z, player.pos.y);
  const mind = mindestHoehe === undefined ? 14 : mindestHoehe;
  if (hoch < mind) return 0;
  const hat = heroVisual.hatClip || (() => false);
  /* Wie lange bleibt noch Luft? y(t) = y0 + vy·t - g/2·t². */
  const g = Math.max(1, CFG.gravity);
  const vy = player.vel.y;
  const fallZeit = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * hoch))) / g;
  /* Genommen wird nur, was in der LUFT stimmt. spin_l und spin_r standen
     hier zuerst mit drin, weil sie "Drehung" heissen - gerendert sind es
     aber Ausweichschritte MIT BODENKONTAKT: die Figur machte im freien
     Flug einen Seitwaertsschritt auf nichts. Deshalb bleiben sie draussen. */
  const moeglich = KUNST_GROSS.filter((k) => hat(k));
  if (!moeglich.length) return 0;
  /* Nicht zweimal dasselbe hintereinander - sonst faellt die Wiederholung
     mehr auf als das Kunststueck selbst. */
  const ohneLetztes = moeglich.length > 1
    ? moeglich.filter((k) => k !== player.kunstArt) : moeglich;
  const art = ohneLetztes[(Math.random() * ohneLetztes.length) | 0];
  /* Das Tempo, mit dem abgespielt wird, muss zur Bewegung passen. Die
     Dateien sind zwischen 1,7 und 4,1 Sekunden lang; eine feste Zieldauer
     haette den kurzen Ueberschlag gedehnt und den langen mit dreifachem
     Tempo durchgehetzt. Deshalb wird die Zieldauer aus der EIGENEN Laenge
     der Datei bestimmt (rund doppeltes Tempo) und nur noch von der
     Fallzeit gedeckelt. */
  const eigen = heroVisual.clipDauer ? heroVisual.clipDauer(art) : 0;
  /* Doppeltes Tempo war zu schnell: gemessen legte die Fussspitze dabei
     54 Zentimeter je Bild zurueck, der Ueberschlag wurde zum Wisch. In
     seinem eigenen Takt sind es 28. Mit dem Faktor 1,6 bleibt es zuegig,
     aber lesbar. */
  const ziel = clamp((eigen > 0 ? eigen / 1.6 : 0.8),
                     0.42, Math.max(0.42, Math.min(1.45, fallZeit * 0.6)));
  const dauer = heroVisual.rolleOneShot(ziel, art, BLEND_KUNST);
  if (!dauer) return 0;
  player.luftSalto = dauer;
  player.saltoCd = dauer + rand(0.5, 1.3);
  player.kunstArt = art;
  return dauer;
}

function stopSwing(boost) {
  if (player.state !== 'swing') return;
  player.swing = null;
  player.state = 'air';
  if (boost) {
    /* Am tiefsten Punkt loslassen gibt den größten Schub – wie beim
       echten Pendel wird die Drehbewegung in Weite umgesetzt. */
    const vh = Math.hypot(player.vel.x, player.vel.z);
    if (player.vel.y > -2) player.vel.y += 1.7;
    else player.vel.y += 0.8;
    if (vh > 6) { player.vel.x *= 1.03; player.vel.z *= 1.03; }
    /* Wer mit Tempo aus dem Bogen geht, dreht ein Kunststueck. Vorher
       verlangte das hier vh > 13 UND hoch > 14 UND drei Sekunden Pause -
       gemessen kam es dadurch fast nie vor, und wenn, dann immer derselbe
       Ueberschlag. Jetzt reicht ordentliches Tempo, und welche Bewegung
       kommt, entscheidet die Lenkung. */
    if (vh > 9) schwungKunst(12);
  }
  /* Wer eben noch am Faden hing, landet mit der Abrollbewegung aus
     animation-1 statt mit der allgemeinen Sturzlandung. */
  player.warSchwung = 2.2;
  swingStrand.visible = false;
  SFX.swoosh();
}

function coneTargetEnemy(maxDist, minDot) {
  /* Es gewinnt der Gegner, auf den am genauesten gezielt wird – nicht
     einfach der nächste. So landen mehrere Netzschüsse auch wirklich auf
     demselben Gegner und wickeln ihn Stück für Stück ein. */
  const f = camForward();
  let best = null, bestScore = -1e9;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.pos.x - player.pos.x, dy = (e.pos.y + 1) - (player.pos.y + 1.4), dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxDist) continue;
    const dot = (dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1);
    if (dot < minDot) continue;
    const score = dot * 3 - d / maxDist;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function webShot() {
  if (!heroVisual || player.dead || player.attackCd > 0.05) return;
  /* Haelt man schon etwas am Netz, wirft derselbe Knopf es. */
  if (player.haeltObjekt) {
    const o = player.haeltObjekt;
    const hand = wechsleNetzHand();
    if (heroVisual.attackOneShot && heroVisual.hatClip && heroVisual.hatClip('wurf')) {
      player.attack = { type: 'web', t: 0, hitDone: true };
      player.attackCd = 0.4;
      heroVisual.attackOneShot(0, 'wurf', 0.45);
    }
    ziehWirf(o, true);
    return;
  }
  player.attack = { type: 'web', t: 0, hitDone: true };
  player.attackCd = 0.34;
  const hand = wechsleNetzHand();
  const target = coneTargetEnemy(26, 0.55);
  const ziel = target
    ? V3(target.pos.x, target.pos.y + 1.1, target.pos.z)
    : (() => { const f = camForward();
               return V3(player.pos.x + f.x * 22, player.pos.y + 3.5, player.pos.z + f.z * 22); })();
  // Arm zeigt ab sofort kurz auf das Ziel
  player.schussZiel.copy(ziel);
  player.schussT = 0.3;
  if (heroVisual.poseSchuss) heroVisual.poseSchuss(ziel, hand, 1);
  flashWebShot(heroHandPos(_v1, hand).clone(), ziel);
  SFX.web();
  /* ---- Kein Gegner im Kegel? Dann zieht das Netz an einem Gegenstand ----
     Und zwar in BEIDE Richtungen, je nachdem, was da steht:
       fest im Boden (Laterne, Ampelmast) -> die Figur zieht sich HIN,
         und wer im richtigen Moment die Leertaste drueckt, nimmt den Zug
         als Schub mit (siehe tryJump),
       lose (Muelltonne, Hydrant, Briefkasten) -> der Gegenstand kommt zur
         Figur und wird gleich weitergeschleudert - auf Gegner, die im Weg
         stehen.
     Bisher gab es nur den zweiten Fall; an einer Laterne passierte gar
     nichts. */
  if (!target) {
    const obj = ziehZiel(24, 0.55);
    const fest = ziehFestZiel(26, 0.6);
    const wObj = obj ? Math.hypot(obj.mesh.position.x - player.pos.x,
                                  obj.mesh.position.z - player.pos.z) : 1e9;
    const wFest = fest ? Math.hypot(fest.x - player.pos.x, fest.z - player.pos.z) : 1e9;
    /* Was naeher dran ist, gewinnt. Der lose Gegenstand bekommt einen
       kleinen Bonus: er ist die Munition, und wer danach zielt, will
       werfen, nicht umziehen. */
    if (obj && wObj * 0.8 <= wFest) {
      obj.zustand = 'zu'; obj.t = 0; obj.hand = hand; obj.getroffen = null;
      player.schussZiel.copy(obj.mesh.position);
      if (heroVisual.poseSchuss) heroVisual.poseSchuss(obj.mesh.position, hand, 1);
      popupWorld('Netz-Zug!', obj.mesh.position, '#bfe8ff');
    } else if (fest) {
      player.schussZiel.copy(fest);
      if (heroVisual.poseSchuss) heroVisual.poseSchuss(fest, hand, 1);
      zipZuPunkt(fest.clone(), hand, null, true);
      popupWorld('Ranziehen!', fest, '#bfe8ff');
    }
  }
  if (target) {
    applyWeb(target);
    treffEffekt(ziel, 0.6, 0xdff0ff);
    /* Zusätzlich ein kurzer Netzklatscher am Einschlag – ein paar Fäden,
       die sternförmig auseinanderspritzen. */
    netzKlatscher(ziel);
    popupWorld('Eingewickelt!', target.pos, '#bfe8ff');
  }
}

/* Sucht entlang der Blickrichtung die erste Hauskante, an der das Netz
   wirklich Halt findet. Ohne diese Prüfung endete der Netz-Zip an einem
   Punkt im leeren Himmel – der Faden hing sichtbar im Nichts. */
function zipHaltepunkt() {
  const f = camForward();
  const rx = -f.z, rz = f.x;                       // seitlich zur Blickrichtung
  const steig = Math.tan(clamp(camPitch, -0.2, 1.1));
  /* Kein reiner Strahl, sondern ein schmaler Kegel: mitten auf der Straße
     liegt genau geradeaus oft gar kein Haus, die Fassaden links und rechts
     aber schon. Ohne die Seitenproben ließ sich der Netz-Zip auf der
     Straße praktisch nie auslösen. */
  for (let s = 4; s <= 60; s += 1.5) {
    const y = player.pos.y + 1.4 + s * steig;
    for (const seit of [0, s * 0.14, -s * 0.14, s * 0.27, -s * 0.27, s * 0.38, -s * 0.38]) {
      const x = player.pos.x + f.x * s + rx * seit;
      const z = player.pos.z + f.z * s + rz * seit;
      for (const c of collidersNear(x, z)) {
        if (c.klein) continue;
        if (x > c.x0 - 0.4 && x < c.x1 + 0.4 && z > c.z0 - 0.4 && z < c.z1 + 0.4) {
          // Dachkante, wenn der Strahl oben ankommt – sonst die Wand selbst
          return V3(x, Math.min(c.h - 0.3, Math.max(y, player.pos.y + 2)), z);
        }
      }
    }
  }
  return null;
}

function webZip() {
  if (player.dead) return;
  /* E ist der Zug ZUM GEGNER. Der Kegel war mit 0,5 nur 60 Grad breit -
     schon ein halber Schritt daneben, und statt des Gegners gewann der
     Rueckfall auf irgendeinen Haltepunkt an einer Hauswand. Genau das war
     "es zieht mich ueberall hin". Jetzt zaehlt fast der ganze vordere
     Halbraum, und wer dicht daneben steht, wird auch ohne Blickkontakt
     genommen. */
  const enemy = coneTargetEnemy(34, 0.0) || nearestEnemy(10, -1);
  const target = enemy
    ? V3(enemy.pos.x, enemy.pos.y + 1.1, enemy.pos.z)
    : zipHaltepunkt();
  if (!target) {
    if (player.keinHaltCd <= 0) { popupScreen('Kein Halt in Reichweite'); player.keinHaltCd = 1.4; }
    return;
  }
  /* Unter Tage darf der Zug nicht an ein Ziel ueber der Strasse gehen -
     sonst zieht er die Figur durch die Tunneldecke. */
  if (unterTage() && target.y > SLAB_H - 1.0) {
    if (player.keinHaltCd <= 0) { popupScreen('Kein Halt in Reichweite'); player.keinHaltCd = 1.4; }
    return;
  }
  zipZuPunkt(target, wechsleNetzHand(), enemy || null);
}

/* Den Zug wirklich starten. Ausgelagert, weil ihn zwei Wege ausloesen:
   E zieht zum Gegner oder an eine Hauskante, Q an einen festen Gegenstand
   (Laterne, Ampel). Beide sollen sich gleich anfuehlen - samt dem
   Absprung im richtigen Moment. */
function zipZuPunkt(target, hand, enemy, fest) {
  stopSwing(false);
  player.state = 'zip';
  /* Kein harter Geschwindigkeitsstoss mehr. Vorher wurde die
     Geschwindigkeit in EINEM Bild auf 27 m/s in Zielrichtung gesetzt -
     das ist kein Zug, das ist ein Schubs, und wenn der Gegner sich
     bewegte, flog man an der Stelle vorbei, wo er beim Tastendruck stand.
     Jetzt zieht das Netz an: das Tempo steigt an, die Richtung wird jedes
     Bild auf den Gegner nachgefuehrt. */
  /* Die Zugzeit richtet sich nach der Entfernung. Fest 1,5 s reichten
     gemessen nur fuer 14 m - bei 20 m Abstand brach der Zug auf halber
     Strecke ab, und der Angriff kam nie zustande. */
  const weg = Math.hypot(target.x - player.pos.x, target.y - player.pos.y - 1.1,
                         target.z - player.pos.z);
  /* Die Zugzeit richtet sich IMMER nach der Entfernung. Feste 0,9 s ohne
     Gegner reichten nur fuer knapp zehn Meter: bei einer Laterne in
     sechzehn Metern brach der Zug auf halber Strecke ab, man flog daran
     vorbei - und weil der Zug da schon vorbei war, gab die Leertaste auch
     keinen Schub mehr. */
  player.zip = { target, enemy: enemy || null, hand, weit: weg > 16,
                 fest: !!fest,
                 t: clamp(weg / 13 + 0.7, 0.9, 3.2),
                 tempo: Math.max(16, Math.hypot(player.vel.x, player.vel.z)) };
  /* Kein zusätzlicher Blitz-Faden: der Zip zieht den Faden ohnehin die
     ganze Zeit mit. Beide zusammen sahen aus wie zwei Netze. */
  /* Der Abschuss ist eine eigene Bewegung: Arm nach vorn, Koerper folgt.
     Danach uebernimmt die Zugbewegung (siehe player.anim). */
  if (heroVisual.hatClip && heroVisual.hatClip('zip_ab') && heroVisual.attackOneShot) {
    heroVisual.attackOneShot(0, 'zip_ab', 0.2);
  }
  SFX.zip();
}

/* Ankunft am Gegner. Bisher stand hier nur damageEnemy(): man beruehrte
   ihn, er verlor Leben, aber eine Bewegung war nie zu sehen. Jetzt laeuft
   der Kniestoss aus der Bewegungsdatei ab, und der Treffer kommt ueber
   dieselbe Auswertung wie jeder andere Schlag (resolveAttackHit). */
function zipAngriff(e) {
  player.ziel = e;
  const art = heroVisual.hatClip && heroVisual.hatClip('knie') ? 'knie' : 'luftangriff';
  const dauer = heroVisual.attackOneShot(0, art, 0.62) || 0.5;
  player.attack = { type: 'kick', t: 0, arm: 'R', art,
                    hitDone: false, finisher: false, stufe: 0, dauer };
  player.attackCd = dauer * 0.7;
  player.combo++; player.comboTimer = 3;
  /* Der Schwung des Zuges geht in den Stoss: die Figur bleibt am Gegner
     stehen, statt an ihm vorbeizuschiessen. */
  player.vel.multiplyScalar(0.16);
  player.vel.y = 3.4;
  player.facing = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
  camShake = Math.max(camShake, 0.2);
  hitstop(0.05);
  popupWorld('Netz-Angriff!', e.pos, '#bfe8ff');
  SFX.swoosh();
}

/* ======================= Spieler-Aktionen ======================= */
function tryJump() {
  if (player.dead) return;
  /* ---- Absprung aus dem Netz-Zug ----
     Wer sich an einen Punkt heranziehen laesst und im RICHTIGEN MOMENT
     abspringt, nimmt den ganzen Zug als Schub mit und schiesst nach vorn.
     Das Fenster ist die letzte Handbreit vor dem Ziel: zwischen drei und
     neun Metern. Zu frueh gedrueckt gibt es nur einen gewoehnlichen
     Absprung - das Fenster zu treffen ist die Belohnung. */
  if (player.state === 'zip' && player.zip) {
    const z = player.zip;
    const weg = Math.hypot(z.target.x - player.pos.x, z.target.y - player.pos.y,
                           z.target.z - player.pos.z);
    const perfekt = weg > 2.5 && weg < 9.0;
    const vh = Math.hypot(player.vel.x, player.vel.z);
    const richt = vh > 0.001
      ? _v1.set(player.vel.x / vh, 0, player.vel.z / vh)
      : _v1.set(Math.sin(player.facing), 0, Math.cos(player.facing));
    /* Der Schub geht in die FLUGRICHTUNG, nicht senkrecht nach oben -
       sonst bremst der Absprung den Zug aus, statt ihn zu verlaengern. */
    const schub = perfekt ? Math.max(26, vh * 1.45) : Math.max(11, vh * 0.6);
    player.vel.x = richt.x * schub;
    player.vel.z = richt.z * schub;
    player.vel.y = perfekt ? 11.5 : 6.0;
    player.zip = null;
    player.state = 'air';
    player.jumps = 1;
    swingStrand.visible = false;
    if (perfekt) {
      /* Ein Kunststueck obendrauf - der perfekte Absprung soll sich auch
         ansehen lassen. */
      if (typeof schwungKunst === 'function') schwungKunst(16);
      camShake = Math.max(camShake, 0.24);
      popupScreen('Perfekter Absprung!');
      addScore(30, '', player.pos);
      SFX.zip();
    }
    SFX.swoosh();
    return;
  }
  if (player.state === 'climb') {
    // Wandabsprung
    const w = player.wallInfo;
    player.state = 'air';
    player.jumps = 1;
    const dir = inputDir();
    player.vel.set(w.nx * 7.5, 9.5, w.nz * 7.5);
    if (dir) { player.vel.x += dir.x * 3; player.vel.z += dir.z * 3; }
    player.wallInfo = null;
    /* Der Absprung von der Wand ist eine eigene Bewegung: abstossen,
       einmal ueberschlagen, dann in den Fall. Vorher schaltete die Figur
       im selben Bild von der Kletterhaltung auf freien Fall um. */
    if (heroVisual.hatClip && heroVisual.hatClip('wandsprung') && heroVisual.attackOneShot) {
      player.luftSalto = heroVisual.attackOneShot(0, 'wandsprung', 0.75) || 0;
    }
    SFX.swoosh();
    return;
  }
  if (player.state === 'swing') { stopSwing(true); return; }
  if (player.onGround) {
    player.vel.y = CFG.jumpVel;
    player.onGround = false;
    player.state = 'air';
    player.jumps = 1;
    /* Die Sperre bleibt zunächst bestehen. Wurde sie hier sofort gelöst,
       war ein einzelner Tastendruck Sprung UND Schwung im selben Bild –
       man kam gar nicht mehr zum Springen. Wer die Taste GEDRÜCKT HÄLT,
       geht nach einem Moment trotzdem in den Schwung über. */
    player.swingLock = true;
    player.haltenT = 0;
  } else if (player.jumps < 2) {
    /* ---- In der Luft ist die Sprungtaste zuerst der NETZSCHWUNG ----
       Der Doppelsprung ist nur der Rueckfall, wenn kein Haus in Reichweite
       ist. Vorher lief beides im SELBEN Bild: der Ueberschlag begann, und
       der Netzwurf blendete ihn sofort wieder weg. Gemessen sprangen Knie
       und Schultern dabei um ueber hundert Grad und die Hand um 87
       Zentimeter - genau das Gezappel von Armen und Beinen beim
       Anschwingen. */
    const hoehe = player.pos.y - groundY(player.pos.x, player.pos.z, player.pos.y);
    if (!player.swingLock && (hoehe > 0.8 || player.vel.y < 0) && startSwing()) return;
    player.vel.y = CFG.jumpVel * 0.92;
    player.jumps = 2;
    /* Der zweite Sprung hatte bisher gar keine eigene Bewegung: die Figur
       stieg noch einmal, zeigte dabei aber weiter die Absprunghaltung mit
       dem einen Arm ueber dem Kopf. Jetzt dreht sie sich dabei - so, wie
       man einen Doppelsprung erwartet. Nur Schau, die Flughoehe bleibt.
       Eine kurze Zieldauer, damit der Ueberschlag noch im Steigen fertig
       wird und nicht in die Landung hineinlaeuft. */
    if (heroVisual.rolleOneShot) {
      const hat = heroVisual.hatClip || (() => false);
      const art = hat('kunst_a') ? 'kunst_a' : hat('frontflip') ? 'frontflip' : null;
      /* 0,58 s pressten die 1,9-s-Datei mit dem Hoechsttempo 3,2 zusammen -
         davon war nichts mehr zu erkennen. Der Ueberschlag laeuft jetzt
         etwas laenger und damit auch noch im Sinken weiter; das sieht
         einem Doppelsprung aehnlicher als ein Zucken im Steigen. */
      if (art) player.luftSalto = heroVisual.rolleOneShot(0.75, art, BLEND_KUNST) || 0;
    }
    /* Dieselbe Sperre wie beim Absprung vom Boden. Ohne sie loesten
       Doppelsprung UND Netzwurf im SELBEN Bild aus: der Ueberschlag
       begann und wurde von der Wurfbewegung sofort wieder ueberblendet -
       gemessen sprangen Knie und Schultern dabei um ueber 100 Grad. Jetzt
       laeuft erst der Ueberschlag, und wer die Taste haelt, geht danach in
       den Bogen. */
    player.swingLock = true;
    player.haltenT = 0;
    SFX.swoosh();
  }
}

/* ---- Spinnensinn-Konter: Weicht man genau dann aus, wenn ein Gegner
   ausholt, geht die Zeit in Zeitlupe und der nächste Schlag auf ihn ist
   ein Konter mit doppeltem Schaden. ---- */
function konterVersuch() {
  let ziel = null, bestD = 3.6;
  for (const e of enemies) {
    if (e.dead || e.warnT <= 0 || e.warnT > 0.42) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    if (d < bestD) { bestD = d; ziel = e; }
  }
  if (!ziel) return false;
  ziel.warnT = 0;
  if (ziel.warn) ziel.warn.visible = false;
  ziel.attack = null;
  ziel.attackCd = rand(1.8, 2.6);
  /* Nicht zurückstoßen – sonst taumelt der Gegner aus der Reichweite und
     man kommt gar nicht zum Gegenschlag. Er ist nur kurz aus dem Tritt. */
  ziel.betaeubtT = 1.0;
  zeitlupe = 0.85;
  player.konterZiel = ziel;
  player.konterT = 2.2;
  player.iFrames = Math.max(player.iFrames, 0.7);
  camShake = Math.max(camShake, 0.08);
  popupScreen('⚡ Spinnensinn – Konter frei!');
  addScore(30, '', player.pos);
  SFX.swoosh();
  return true;
}

function dodge() {
  if (!heroVisual || player.dead || player.dodgeT > 0 || player.state === 'climb') return;
  const konter = konterVersuch();
  const dir = inputDir() || { x: -Math.sin(player.facing), z: -Math.cos(player.facing) };
  /* Die Dauer kommt aus der Rollen-Bewegung selbst. Vorher war sie mit
     0,45 s fest verdrahtet, die Bewegungsdatei ist aber gut doppelt so
     lang – die Rolle wurde deshalb mitten im Abrollen abgeschnitten und
     ging in den Stand über. Genau das sah kaputt aus. */
  /* Vorwärts/rückwärts wird gerollt, zur Seite gibt es seit mixamo-5 einen
     echten Ausweichschritt. Beim Schritt zur Seite bleibt die Blickrichtung
     erhalten – man weicht aus, ohne den Gegner aus den Augen zu verlieren. */
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  const vor = dir.x * fx + dir.z * fz;
  const seit = dir.x * -fz + dir.z * fx;
  const zurSeite = Math.abs(seit) > Math.abs(vor);
  /* ---- Acht Richtungen ----
     Vorher gab es drei Bewegungen: Rolle vorwaerts, Schritt links, Schritt
     rechts. Wer schraeg auswich, bekam trotzdem eine davon zu sehen. Aus
     dem Unreal-Projekt kommen Ausweichschritt und Rolle in je acht
     Richtungen; gewaehlt wird nach dem Winkel zwischen Blick- und
     Ausweichrichtung. */
  const acht = RICHT_8[Math.round(Math.atan2(seit, vor) / (Math.PI / 4)) & 7];
  const wunsch = (zurSeite ? 'ausw_' : 'rolle_') + acht;
  let welche = heroVisual.hatClip && heroVisual.hatClip(wunsch) ? wunsch
             : (zurSeite && heroVisual.hatClip && heroVisual.hatClip(seit > 0 ? 'ausweichenR' : 'ausweichenL')
                 ? (seit > 0 ? 'ausweichenR' : 'ausweichenL') : 'roll');
  /* Beim reinen Schritt zur Seite hin und wieder der Drehausweicher. */
  if ((welche === 'ausw_l' || welche === 'ausw_r') && Math.random() < 0.3) {
    const dreh = welche === 'ausw_l' ? 'spin_l' : 'spin_r';
    if (heroVisual.hatClip && heroVisual.hatClip(dreh)) welche = dreh;
  }
  /* In der Luft wird NICHT gerollt. Die Rollbewegung gehört auf den Boden –
     in der Luft sah es aus, als würde man frei schwebend einen Purzelbaum
     schlagen. Dort gibt es nur einen kurzen Ausweichsatz, die Figur behält
     ihre Flughaltung. */
  const dauer = player.onGround
    ? ((heroVisual.rolleOneShot ? heroVisual.rolleOneShot(zurSeite ? 0.5 : 0.72, welche) : 0)
       || CFG.rollDauer)
    : 0.34;
  /* Tempo so wählen, dass die Strecke zur Bewegung passt: rund vier Meter
     in einem Satz. 19 m/s haben die Figur früher neun Meter weit aus dem
     Bild geschossen, die Kamera kam nicht hinterher. */
  /* Beim Konter nur ein kurzer Schritt zur Seite – mit dem vollen Satz war
     man anschließend vier Meter weg und kam gar nicht zum Gegenschlag. */
  const tempo = konter ? 4.2 : (zurSeite ? 8.5 : (player.onGround ? 10.5 : 9));
  player.vel.x = dir.x * tempo;
  player.vel.z = dir.z * tempo;
  if (!zurSeite) player.facing = Math.atan2(dir.x, dir.z);
  /* Beim Konter bleibt der Blick auf dem Gegner. Ohne das drehte sich die
     Figur beim Ausweichen weg und der Gegenschlag fand kein Ziel mehr. */
  if (konter && player.konterZiel) {
    player.facing = Math.atan2(player.konterZiel.pos.x - player.pos.x,
                               player.konterZiel.pos.z - player.pos.z);
  }
  player.dodgeT = dauer;
  player.rollT = player.onGround ? dauer : 0;
  player.rollGesamt = dauer;
  player.iFrames = dauer * 0.9;
  player.attack = null;                          // Angriff sauber abbrechen
  player.attackCd = Math.min(player.attackCd, 0.12);
  camShake = Math.max(camShake, 0.03);
  SFX.swoosh();
}

/* Schlagkombo: jede Stufe sieht anders aus. Der gespiegelte Schlag
   ("punch2") kommt aus derselben Datei, nur seitenverkehrt – dadurch
   wechselt die Figur sichtbar den Arm. Die letzte Stufe ist der Abschluss. */
const KOMBO = [
  { art: 'punch',  ziel: 0.42, arm: 'R' },   // gerader Stoß
  { art: 'hook',   ziel: 0.46, arm: 'L' },   // Haken
  { art: 'punch2', ziel: 0.44, arm: 'L' },   // gespiegelter Stoß
  { art: 'punch3', ziel: 0.52, arm: 'R' },   // Kombischlag
  { art: 'hook2',  ziel: 0.48, arm: 'R' },   // gespiegelter Haken
  { art: 'kick',   ziel: 0.62, arm: 'R', finisher: true },
];

/* ---- Aufwärtshaken: schleudert den Gegner in die Luft und eröffnet die
   Luftkombo. Danach bleibt der Gegner oben, solange man weiter trifft. ---- */
function uppercut() {
  if (!heroVisual || player.dead || player.state === 'climb' || player.rollT > 0) return;
  if (!stufeFrei('uppercut')) { popupScreen('🔒 Aufwärtshaken ab Stufe 2'); return; }
  if (player.attackCd > 0.05) return;
  const ziel = nearestEnemy(2.8, 0.0);
  const dauer = heroVisual.attackOneShot(0, 'uppercut', 0.6) || 0.6;
  player.attack = { type: 'punch', t: 0, arm: 'R', art: 'uppercut',
                    hitDone: false, finisher: false, stufe: 0, dauer, hebt: true };
  player.attackCd = dauer * 0.8;
  if (ziel) {
    const dx = ziel.pos.x - player.pos.x, dz = ziel.pos.z - player.pos.z;
    player.facing = Math.atan2(dx, dz);
    player.ziel = ziel;
  }
  SFX.swoosh();
}

/* ---- Packen und werfen: einen nahen Gegner greifen und in Blickrichtung
   schleudern. Trifft er dabei eine Wand oder ein Auto, tut das extra weh. ---- */
function packenUndWerfen() {
  if (!heroVisual || player.dead || player.state === 'climb') return;
  if (!stufeFrei('wurf')) { popupScreen('🔒 Packen & Werfen ab Stufe 3'); return; }
  if (player.attackCd > 0.05) return;
  const e = nearestEnemy(2.6, -0.2);
  if (!e) { popupScreen('Niemand zum Packen in Reichweite'); return; }
  /* "Grab and Slam" aus animation-1: zupacken, heranziehen, niederschlagen.
     Das ist genau der Ablauf, den diese Taste seit jeher beschreibt - die
     alte Bewegung war nur ein Schwung mit dem Arm. Die Datei ist 4,3 s
     lang; auf 0,95 s gerafft bleibt der Griff lesbar, ohne dass man
     sekundenlang festhaengt. */
  const griff = heroVisual.hatClip && heroVisual.hatClip('wurfgriff');
  const dauer = heroVisual.attackOneShot(0, griff ? 'wurfgriff' : 'wurf',
                                         griff ? 0.95 : 0.75) || 0.75;
  player.attackCd = dauer * 0.8;
  player.attack = { type: 'punch', t: 0, arm: 'R', art: griff ? 'wurfgriff' : 'wurf',
                    hitDone: true, finisher: false, stufe: 0, dauer };
  const f = camForward();
  player.facing = Math.atan2(f.x, f.z);
  /* Der Gegner fliegt in Blickrichtung davon und ist dabei ein Geschoss. */
  e.vel.set(f.x * 26, 7.5, f.z * 26);
  e.staggerT = Math.max(e.staggerT, 1.1);
  e.geworfen = 1.2;
  damageEnemy(e, 10, 'kick');
  hitstop(0.08);
  camShake = Math.max(camShake, 0.12);
  treffEffekt(_v1.set(e.pos.x, e.pos.y + 1.1, e.pos.z), 1.3, 0xffd23c);
  SFX.kick();
  popupWorld('Geworfen!', e.pos, '#ffd23c');
}

function tryAttack(type) {
  if (!heroVisual || player.dead || player.state === 'climb') return;
  /* Während der Ausweichrolle wird der Klick gemerkt statt verworfen –
     sonst geht direkt nach einem Konter der Gegenschlag verloren. */
  if (player.rollT > 0) {
    player.attackBuffer = { type, t: Math.max(0.5, player.rollT + 0.25) };
    return;
  }
  /* Zu früh gedrückt? Eingabe kurz merken und automatisch nachziehen –
     dadurch fühlt sich die Schlagfolge zusammenhängend an. */
  if (player.attackCd > 0) {
    /* JEDER Klick während der laufenden Bewegung wird gemerkt und direkt
       danach ausgeführt. Vorher zählte er nur in den letzten 0,4 s – bei
       einer 0,9-s-Bewegung lag die Sperre aber bei ~0,5 s, also verfiel
       schnelles Klicken komplett. Deshalb war von der Kombo nichts zu
       sehen: Stufe 2 wurde nie erreicht. */
    player.attackBuffer = { type, t: Math.max(0.5, player.attackCd + 0.25) };
    return;
  }
  player.attackBuffer = null;
  if (player.comboTimer <= 0) { player.combo = 0; player.stufe = 0; }
  /* Die Schlagfolge richtet sich nach der Zahl der AUSGEFÜHRTEN Schläge,
     nicht nach den Treffern. Vorher zählte nur ein Treffer weiter – wer
     ins Leere schlug oder danebenstand, sah immer wieder denselben
     ersten Schlag. Genau deshalb war die Kombo nicht zu erkennen. */
  const stufe = player.stufe || 0;
  /* In der Luft gibt es einen eigenen Sprungangriff – am Boden die Kombo. */
  /* Im Symbiontenanzug ersetzt der fliegende Kniestoss aus animation-1
     den Tritt. Er dauert laenger und trifft haerter - das ist der
     spuerbare Unterschied zum normalen Anzug, nicht nur die Farbe. */
  /* Im Symbiontenanzug wird aus dem Tritt ein Aufstampfen ("Stomping"):
     ein Schlag auf den Boden, dessen Druckwelle alles im Umkreis umwirft.
     Das passt zur Flaechenwirkung, die der Treffer ohnehin hat. Fehlt die
     Datei, bleibt es beim fliegenden Kniestoss. */
  const symArt = heroVisual.hatClip && heroVisual.hatClip('stampfen') ? 'stampfen'
               : (heroVisual.hatClip && heroVisual.hatClip('symkombo') ? 'symkombo' : null);
  const symTritt = player.symAn && type === 'kick' && player.onGround && symArt;
  const k = !player.onGround
    ? { art: 'luftangriff', ziel: 0.5, arm: 'R' }
    : symTritt
      ? { art: symArt, ziel: symArt === 'stampfen' ? 1.25 : 1.70, arm: 'R', wucht: true }
      : type === 'kick'
        ? { art: 'kick', ziel: 1.10, arm: 'R' }
        : KOMBO[stufe % KOMBO.length];
  const finisher = !!k.finisher;
  const arm = k.arm;
  /* Die Dauer kommt aus der Bewegungsdatei selbst. Vorher war sie fest
     verdrahtet und viel kürzer als der Clip – deshalb startete die
     Animation bei schnellem Klicken immer wieder von vorn. */
  /* Zweiter Schlag und weiter: verkettet abspielen (ohne Ausholphase). */
  const verkette = player.onGround && stufe > 0 && player.comboTimer > 0;
  const dauer = heroVisual.attackOneShot(0, k.art, k.ziel, verkette) || k.ziel || 0.42;
  /* Flinke Gegner reagieren auf das Ausholen, nicht erst auf den Treffer. */
  versucheAusweichen();
  const wieTritt = k.art === 'kick' || k.art === 'luftangriff' || k.art === 'knie' ||
                   k.art === 'symkombo' || k.art === 'stampfen';
  player.attack = { type: wieTritt ? 'kick' : 'punch', t: 0, arm, art: k.art,
                    hitDone: false, finisher, stufe, dauer, wucht: !!k.wucht };
  if (player.onGround && type !== 'kick') {
    player.stufe = (stufe + 1) % KOMBO.length;
    player.comboTimer = Math.max(player.comboTimer, 1.6);
  }
  /* Der nächste Schlag darf schon starten, während der aktuelle noch
     ausklingt – so entsteht überhaupt erst eine flüssige Kette. */
  player.attackCd = dauer * 0.72;

  /* Zielbindung: Solange die Kombo läuft, bleibt derselbe Gegner das Ziel.
     Vorher wurde bei JEDEM Schlag neu der nächstgelegene gesucht – mitten
     in der Kombo sprang die Figur deshalb zu einem anderen Gegner, drehte
     sich weg und rutschte quer durch die Gruppe. */
  if (player.ziel && (player.ziel.dead ||
      Math.hypot(player.ziel.pos.x - player.pos.x, player.ziel.pos.z - player.pos.z) > 5.5 ||
      Math.abs(player.ziel.pos.y - player.pos.y) > 2.5)) {
    player.ziel = null;
  }
  if (!player.ziel || player.comboTimer <= 0) {
    const neu = nearestEnemy(4.2, 0.2);
    if (neu) player.ziel = neu;
  }
  const target = player.ziel;
  if (target) {
    const dx = target.pos.x - player.pos.x, dz = target.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    /* Genau so weit heranziehen, dass der Schlag sitzt – nicht weiter.
       Der frühere Stoß mit bis zu 9 m/s hat die Figur am Gegner
       vorbeigeschoben, das war das Rutschen. */
    /* Schlagabstand: Arm plus zwei halbe Körper sind rund 1,1 m. Vorher
       wurde nur bis 1,7 m herangezogen – auf die Entfernung berührt man
       sich beim Schlagen überhaupt nicht, der Treffer war reine Zahlen-
       sache. Jetzt geht die Figur so weit ran, dass die Faust ankommt. */
    /* Kein Sofort-Stoß mehr. Früher wurde player.vel in EINEM Bild auf bis
       zu 14 m/s gesetzt – beim Wechsel auf den nächsten Gegner sah das aus,
       als würde die Figur hinüberspringen und dabei hängenbleiben. Jetzt
       läuft ein Anlauf über die erste Hälfte der Schlagbewegung, der Tempo
       und Blickrichtung weich nachführt. */
    player.anlaufZiel = target;
    player.anlaufT = dauer * 0.55;
    /* Über zweieinhalb Meter wird der Anlauf zu einem echten Satz. */
    if (d > 2.6 && player.onGround) {
      player.vel.y = 4.6;
      player.onGround = false;
      player.state = 'air';
      player.anlaufSatz = true;
    }
  }
}

/* Anlauf zum gebundenen Gegner – weich beschleunigt statt gesetzt. */
function updateAnlauf(dt) {
  if (!(player.anlaufT > 0)) { player.anlaufSatz = false; return; }
  const z = player.anlaufZiel;
  player.anlaufT -= dt;
  if (!z || z.dead || player.dead || player.state === 'climb' || player.state === 'swing') {
    player.anlaufT = 0; player.anlaufSatz = false; return;
  }
  const dx = z.pos.x - player.pos.x, dz = z.pos.z - player.pos.z;
  const d = Math.hypot(dx, dz);
  player.facing = dampAngle(player.facing, Math.atan2(dx, dz), Math.min(1, dt * 11));
  if (d > NAHKAMPF) {
    /* So schnell, dass der Weg in der verbleibenden Zeit reicht – aber
       gedeckelt und weich angefahren. */
    const wunsch = clamp((d - NAHKAMPF * 0.9) / Math.max(0.1, player.anlaufT), 0, 12);
    const k = Math.min(1, dt * 16);
    player.vel.x = lerp(player.vel.x, (dx / d) * wunsch, k);
    player.vel.z = lerp(player.vel.z, (dz / d) * wunsch, k);
  } else {
    /* Angekommen: abbremsen und den Satz beenden. */
    const b = Math.max(0, 1 - dt * 12);
    player.vel.x *= b; player.vel.z *= b;
    player.anlaufT = 0; player.anlaufSatz = false;
  }
}

function nearestEnemy(maxDist, minDot) {
  let best = null, bestD = maxDist;
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || Math.abs(e.pos.y - player.pos.y) > 2.5) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (d > 1 && dot < minDot) continue;
    best = e; bestD = d;
  }
  return best;
}

/* Der flinke Ganove springt zur Seite, wenn der Held ausholt. Er muss dazu
   nah genug stehen, darf nicht gerade selbst zuschlagen und braucht eine
   Pause zwischen zwei Sprüngen – sonst tänzelt er unerreichbar herum. */
function versucheAusweichen() {
  for (const e of enemies) {
    if (e.dead || !e.typ || !e.typ.ausweichen) continue;
    if (e.staggerT > 0 || e.betaeubtT > 0 || e.attack || e.webStufe > 0) continue;
    if ((e.ausweichCd || 0) > 0) continue;
    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 3.4 || Math.abs(e.pos.y - player.pos.y) > 2) continue;
    /* Nur wer vor dem Helden steht, sieht den Schlag kommen. */
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    if ((dx * fx + dz * fz) / (d || 1) < 0.2) continue;
    if (Math.random() > e.typ.ausweichen) { e.ausweichCd = 0.8; continue; }
    /* Quer zur Schlagrichtung wegspringen. */
    const seite = Math.random() < 0.5 ? 1 : -1;
    const qx = -fz * seite, qz = fx * seite;
    e.vel.x += qx * 7.5; e.vel.z += qz * 7.5;
    e.ausweichCd = rand(1.6, 2.6);
    e.staggerT = Math.max(e.staggerT, 0.28);   // kurz aus dem Takt, nicht getroffen
    e.iFrames = 0.26;
    if (e.visual.attackOneShot) {
      e.visual.attackOneShot(0, seite > 0 ? 'ausweichenR' : 'ausweichenL', 0.45);
    }
    popupWorld('Ausgewichen!', e.pos, '#bfe8ff');
  }
}

function resolveAttackHit() {
  const a = player.attack;
  /* Reichweite passend zum neuen, engen Schlagabstand. */
  const range = a.type === 'kick' ? 2.7 : 2.4;
  /* Zuerst das gebundene Ziel prüfen – sonst zählt mitten in der Kombo
     plötzlich ein anderer Gegner als Treffer. */
  let e = null;
  if (player.ziel && !player.ziel.dead) {
    const zd = Math.hypot(player.ziel.pos.x - player.pos.x, player.ziel.pos.z - player.pos.z);
    if (zd <= range + 0.4 && Math.abs(player.ziel.pos.y - player.pos.y) <= 2.5) e = player.ziel;
  }
  if (!e) e = nearestEnemy(range, 0.05);
  if (!e) {
    /* Ein Schlag ins Leere setzt die Kette nicht mehr auf null zurück –
       sonst kam man ohne Gegner nie über Stufe 1 hinaus und die Kombo
       war praktisch unsichtbar. Sie läuft jetzt nur schneller ab. */
    player.combo = Math.max(0, player.combo - 1);
    player.comboTimer = Math.min(player.comboTimer, 1.2);
    updateHUD();
    return;
  }
  /* Zum Treffer wird der Rest der Lücke geschlossen. Der Heranzug über die
     Geschwindigkeit allein war zu langsam: gemessen standen die Figuren im
     Moment des Treffers noch 1,70 m auseinander, da berührt sich nichts.
     Der Nachzug ist auf 0,8 m begrenzt und sieht wie ein Ausfallschritt aus. */
  {
    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > NAHKAMPF + 0.12) {
      const zieh = Math.min(0.8, d - NAHKAMPF);
      player.pos.x += (dx / d) * zieh;
      player.pos.z += (dz / d) * zieh;
      player.facing = Math.atan2(dx, dz);
    }
  }
  const konter = player.konterT > 0 && player.konterZiel === e;
  const wucht = konter ? 2.4 : (a.finisher ? 1.9 : (a.type === 'kick' ? 1.5 : 1));
  let dmg = (a.type === 'kick' ? 16 : 11) * (a.finisher ? 1.5 : 1) * STUFEN[stufe].wucht;
  if (konter) {
    dmg *= 2.2;
    player.konterT = 0; player.konterZiel = null;
    zeitlupe = 0;
    e.staggerT = Math.max(e.staggerT, 0.7);
    e.vel.x += (e.pos.x - player.pos.x) * 3; e.vel.z += (e.pos.z - player.pos.z) * 3; e.vel.y += 4;
    popupWorld('KONTER!', e.pos, '#ffd23c');
    addScore(60, '', e.pos);
    hitstop(0.1);
  }
  if (e.webT > 0) dmg *= 2;           // eingewickelte Gegner sind wehrlos
  dmg *= 1 + Math.min(player.combo, 6) * 0.06;   // Kombo steigert den Schaden

  /* Deckung: Schläge prallen weitgehend ab, ein Tritt bricht sie auf.
     Dadurch lohnt es sich, zwischen Schlag und Tritt zu wechseln. */
  let geblockt = false;
  if (e.blockT > 0) {
    if (a.type === 'kick' || a.finisher) {
      e.blockT = 0; e.blockCd = rand(2.5, 5); e.staggerT = Math.max(e.staggerT, 0.5);
      popupWorld('Deckung gebrochen!', e.pos, '#8fd4ff');
    } else {
      dmg *= 0.2; geblockt = true;
      player.combo = Math.max(0, player.combo - 1);
    }
  }

  const treffer = _v1.set(
    (player.pos.x + e.pos.x) / 2,
    Math.max(player.pos.y, e.pos.y) + 1.15,
    (player.pos.z + e.pos.z) / 2
  );
  treffEffekt(treffer, geblockt ? wucht * 0.5 : wucht, geblockt ? 0x4da3ff : (a.finisher ? 0xffd23c : 0xffffff));

  /* Aufwärtshaken: Gegner geht in die Luft, der Held springt hinterher.
     Danach halten weitere Treffer ihn oben – das ist die Luftkombo. */
  if (a.hebt) {
    e.vel.set(e.vel.x * 0.3, 11.5, e.vel.z * 0.3);
    e.staggerT = Math.max(e.staggerT, 1.7);
    e.inDerLuft = 1.7;
    if (player.onGround) { player.vel.y = 9.5; player.onGround = false; player.state = 'air'; }
    player.luftKombo = 2.2;
    treffEffekt(_v1.set(e.pos.x, e.pos.y + 1.4, e.pos.z), 1.6, 0xfff0b0);
    popupWorld('Aufwärtshaken!', e.pos, '#ffe9a8');
  } else if (!player.onGround && e.inDerLuft > 0) {
    /* Luftkombo: jeder Treffer hält den Gegner oben. */
    e.vel.y = Math.max(e.vel.y, 3.4);
    e.staggerT = Math.max(e.staggerT, 0.8);
    e.inDerLuft = Math.max(e.inDerLuft, 0.9);
    player.vel.y = Math.max(player.vel.y, 1.6);
    player.luftKombo = 1.6;
    dmg *= 1.35;
  }

  /* ---- Der Tritt im Symbiontenanzug ----
     Er sah aus wie jeder andere Tritt, nur schwarz. Ein Anzug, der so
     lange laedt, muss sich auch anders anfuehlen: der Einschlag wirft
     ALLE in einem Umkreis von 3,2 m um, nicht nur den Getroffenen, und
     der Getroffene selbst nimmt das Doppelte. */
  if (a.wucht) {
    dmg *= 2.0;
    const wx = e.pos.x, wz = e.pos.z;
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const dx = o.pos.x - wx, dz = o.pos.z - wz;
      const d2 = Math.hypot(dx, dz);
      if (d2 > 3.2) continue;
      const f = 1 - d2 / 3.2;
      damageEnemy(o, dmg * 0.55 * f, 'kick');
      o.vel.x += (dx / (d2 || 1)) * (7 + 6 * f);
      o.vel.z += (dz / (d2 || 1)) * (7 + 6 * f);
      o.vel.y += 4.5 * f;
      o.staggerT = Math.max(o.staggerT, 0.9);
    }
    e.vel.y += 5.5;
    staubWolke(e.pos, 1.8);
    treffEffekt(_v1.set(e.pos.x, e.pos.y + 0.4, e.pos.z), 3.0, 0xb08cff);
    popupWorld('Symbiont!', e.pos, '#c8b0ff');
  }
  damageEnemy(e, dmg, a.type);
  player.combo++;
  player.comboTimer = 3;
  hitstop(a.wucht ? 0.16 : (a.finisher ? 0.11 : (a.type === 'kick' ? 0.075 : 0.05)));
  camShake = Math.max(camShake, (a.wucht ? 0.30 : 0.05) + wucht * 0.035);
  (a.type === 'kick' ? SFX.kick : SFX.punch)();

  // Rückstoß – Finisher schleudert den Gegner richtig weg
  const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  /* Der Brecher steht wie ein Baum: Rückstoß und Taumeln fallen bei ihm
     fast weg. Erst ein Tritt, ein Finisher oder ein Konter bringt ihn
     wirklich aus dem Tritt – vorher fühlten sich alle Gegner gleich an. */
  const fest = (e.typ && e.typ.standfest) || 0;
  const bricht = a.type === 'kick' || a.finisher || konter;
  const daempfer = bricht ? 1 - fest * 0.5 : 1 - fest;
  const kb = (a.type === 'kick' ? 9 : 5.5) * wucht * daempfer;
  e.vel.x += (dx / d) * kb; e.vel.z += (dz / d) * kb;
  e.vel.y += (a.type === 'kick' ? 4 : 2) * wucht * daempfer;
  e.staggerT = Math.max(e.staggerT, (a.finisher ? 0.9 : 0.5) * (bricht ? 1 : 1 - fest));
  if (e.visual && e.visual.attackOneShot && !e.dead) e.visual.attackOneShot(2.2);

  /* Leichter Vorwärtsschub des Helden: die Schläge "greifen" dadurch */
  player.vel.x += (dx / d) * 2.2;
  player.vel.z += (dz / d) * 2.2;
}

function damagePlayer(dmg, srcPos) {
  if (player.iFrames > 0 || player.dead) return;
  player.hp -= dmg;
  player.hurtCd = 0.4; player.regenCd = 5;
  /* Treffer sichtbar machen – vorher steckte die Figur alles regungslos ein. */
  if (player.onGround) player.hitT = 0.32;
  camShake = Math.max(camShake, 0.09);
  SFX.hurt();
  vignette(0.7);
  if (srcPos) {
    const dx = player.pos.x - srcPos.x, dz = player.pos.z - srcPos.z;
    const d = Math.hypot(dx, dz) || 1;
    player.vel.x += (dx / d) * 6; player.vel.z += (dz / d) * 6; player.vel.y += 2.5;
  }
  if (player.hp <= 0) {
    player.hp = 0; player.dead = true;
    document.getElementById('msg').style.display = 'flex';
    /* Auf dem Handy gibt es keine Eingabetaste – dort steht der Knopf
       "Weiter" unten rechts im Knopffeld. */
    const mt = document.getElementById('msgText');
    if (mt && touchAktiv) mt.innerHTML = 'Tippe unten rechts auf <b>↺ Weiter</b>.';
    SFX.ko();
  }
  updateHUD();
}

function respawn() {
  player.pos.set(25, 0.05, 25);
  player.vel.set(0, 0, 0);
  player.hp = CFG.playerHP;
  player.dead = false;
  player.state = 'ground';
  stopSwing(false);
  player.zip = null;
  document.getElementById('msg').style.display = 'none';
  updateHUD();
}

/* ======================= Fortschritt =======================
   Punkte sind zugleich Erfahrung. Mit jeder Stufe gibt es dauerhaft mehr
   Lebensenergie und Schlagkraft, und die Spezialbewegungen werden nach
   und nach freigeschaltet – vorher konnte man von Anfang an alles und
   hatte keinen Grund weiterzuspielen. */
const STUFEN = [
  { punkte: 0,    text: 'Neuling',      hp: 100, wucht: 1.00, frei: null },
  { punkte: 600,  text: 'Straßenheld',  hp: 115, wucht: 1.10, frei: 'Aufwärtshaken (R)' },
  { punkte: 1600, text: 'Netzschwinger', hp: 130, wucht: 1.20, frei: 'Packen & Werfen (G)' },
  { punkte: 3200, text: 'Beschützer',   hp: 145, wucht: 1.32, frei: 'Wandlauf (Shift an der Wand)' },
  { punkte: 5600, text: 'Stadtlegende', hp: 165, wucht: 1.45, frei: 'Netz-Zip trifft doppelt' },
  { punkte: 9000, text: 'Ikone',        hp: 190, wucht: 1.6,  frei: 'Kombo ohne Ende' },
];
let stufe = 0;
function stufeFuer(p) {
  let i = 0;
  for (let k = 0; k < STUFEN.length; k++) if (p >= STUFEN[k].punkte) i = k;
  return i;
}
function wendeStufeAn(neu, mitMeldung) {
  const alt = stufe;
  stufe = neu;
  const s = STUFEN[stufe];
  const anteil = player.hp / CFG.playerHP;
  CFG.playerHP = s.hp;
  player.hp = Math.min(s.hp, Math.max(player.hp, s.hp * anteil));
  if (mitMeldung && neu > alt) {
    popupScreen(`⭐ Stufe ${neu + 1}: ${s.text}` + (s.frei ? ` – ${s.frei} freigeschaltet!` : ''));
    SFX.score();
    player.hp = CFG.playerHP;                 // Aufstieg heilt
  }
  updateHUD();
}
function stufeFrei(name) {
  /* Welche Spezialbewegung ist schon verfügbar? */
  if (name === 'uppercut') return stufe >= 1;
  if (name === 'wurf') return stufe >= 2;
  /* Der Wandlauf war frueher an Stufe 3 gebunden. Das passte nicht zusammen:
     wer mit Anlauf gegen die Fassade rennt, laeuft sie ohnehin von Anfang an
     ein Stueck hinauf - nur weiterlaufen durfte er dann nicht und rutschte
     ins langsame Klettern. Genau das kam als "er rennt nicht die Wand hoch,
     er klettert nur schnell" an. Jetzt von Anfang an frei. */
  if (name === 'wandlauf') return true;
  return true;
}

/* ======================= Ruf der Stadt =======================
   Zivilisten waren bisher folgenlos: sie fielen um, standen wieder auf,
   nichts passierte. Jetzt hat die Stadt ein Vertrauensmaß. Wer Passanten
   schützt und Verletzte aufhilft, bekommt mehr Punkte; wer sie liegen
   lässt, verliert Ansehen – und die Leute jubeln nicht mehr. */
let ruf = 100;
let rufMeldungCd = 0;

/* boden: Abzüge aus dieser Quelle wirken nur, solange der Ruf darüber
   liegt. Ohne diese Grenze zieht eine unbeaufsichtigte Stadt den Ruf
   binnen weniger Minuten auf null und er kommt nie wieder hoch. */
function setzeRuf(delta, text, pos, boden) {
  if (delta < 0 && boden !== undefined && ruf <= boden) return;
  const vorher = ruf;
  ruf = clamp(ruf + delta, 0, 100);
  if (Math.round(vorher) === Math.round(ruf)) return;
  if (text && rufMeldungCd <= 0) {
    popupWorld(text, pos || player.pos, delta > 0 ? '#8ef0a0' : '#ff9b9b');
    rufMeldungCd = 0.8;
  }
  try { localStorage.setItem('webhero_ruf', String(Math.round(ruf))); } catch (e) {}
  updateHUD();
}

/* Punktezuschlag: bei bestem Ruf 1,25×, bei ruiniertem Ruf 0,6×. */
function rufFaktor() { return 0.6 + (ruf / 100) * 0.65; }

function addScore(n, label, worldPos) {
  if (n > 0) n = Math.round(n * rufFaktor());
  /* Der Punktestand kann durch Abzüge sinken, aber nicht ins Minus. */
  player.score = Math.max(0, player.score + n);
  const neu = stufeFuer(player.score);
  if (neu !== stufe) wendeStufeAn(neu, true);
  if (label) popupWorld(`${label} ${n >= 0 ? '+' : ''}${n}`, worldPos || player.pos,
    n >= 0 ? '#ffd23c' : '#ff9b9b');
  if (player.score > bestScore) {
    bestScore = player.score;
    try { localStorage.setItem('webhero_best', String(bestScore)); } catch (e) {}
  }
  try {
    localStorage.setItem('webhero_stand', JSON.stringify({ punkte: player.score, stufe }));
  } catch (e) {
  }
  SFX.score();
  updateHUD();
}

/* ======================= Spieler-Update ======================= */
let onWallTimer = 0;

function updatePlayer(dt) {
  if (!heroVisual) return;
  if (player.dead) {
    /* Auch im K.o. wirkt Schwerkraft – vorher blieb die Figur dort in der
       Luft stehen, wo sie getroffen wurde. */
    const boden = groundY(player.pos.x, player.pos.z, player.pos.y);
    if (player.pos.y > boden) {
      player.vel.y -= CFG.gravity * dt;
      player.pos.y += player.vel.y * dt;
      if (player.pos.y <= boden) { player.pos.y = boden; player.vel.y = 0; }
    }
    player.vel.x *= Math.max(0, 1 - dt * 3);
    player.vel.z *= Math.max(0, 1 - dt * 3);
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.z * dt;
    /* Nur EIN Aufruf pro Bild – vorher schaltete der zweite Aufruf sofort
       wieder auf Stehen zurück, dadurch fing das Umfallen endlos neu an. */
    player.anim = 'downed';
    updateHeroVisual(dt);
    return;
  }

  const dir = inputDir();
  const wantSwing = (keys['Space'] || swingHeld);

  /* ---- Über die Kante ziehen ---- */
  if (player.state === 'kante' && player.kante) {
    const k = player.kante;
    k.t += dt / k.dauer;
    const f = clamp(k.t, 0, 1);
    /* Erst hochziehen, dann nach vorn aufs Dach – das entspricht dem
       Ablauf der Bewegung. */
    const hoch = clamp(f / 0.62, 0, 1);
    const vor = clamp((f - 0.45) / 0.55, 0, 1);
    player.pos.y = lerp(k.von.y, k.nach.y, hoch * hoch * (3 - 2 * hoch));
    player.pos.x = lerp(k.von.x, k.nach.x, vor * vor * (3 - 2 * vor));
    player.pos.z = lerp(k.von.z, k.nach.z, vor * vor * (3 - 2 * vor));
    player.anim = 'kante';
    if (f >= 1) {
      player.kante = null;
      player.state = 'ground';
      player.onGround = true;
      player.jumps = 0;
      player.vel.set(0, 0, 0);
    }
    updateHeroVisual(dt);
    return;
  }

  /* ---- Klettern ---- */
  if (player.state === 'climb') {
    const w = player.wallInfo;
    const c = w.col;
    // an der Wand halten
    if (w.nx !== 0) player.pos.x = (w.nx > 0 ? c.x1 : c.x0) + w.nx * CFG.climbGap;
    else player.pos.z = (w.nz > 0 ? c.z1 : c.z0) + w.nz * CFG.climbGap;
    // Bewegung an der Wand: W=hoch, S=runter, A/D=seitlich
    let up = 0, side = 0;
    if (keys['KeyW'] || keys['ArrowUp']) up += 1;
    if (keys['KeyS'] || keys['ArrowDown']) up -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) side += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) side -= 1;
    /* An der Wand zählte bisher nur die Tastatur. Auf dem Handy und mit
       Gamepad klebte man dadurch bewegungsunfähig an der Fassade fest. */
    if (!up && !side && (stick.x || stick.z)) { up = stick.z; side = stick.x; }
    /* Tangente „nach rechts" aus Sicht der Figur. Die Figur schaut in
       Richtung (-nx, -nz); rechts davon liegt (-f.z, f.x) = (nz, -nx).
       Vorher stand hier genau das Gegenteil – deshalb liefen A und D
       an der Wand verkehrt herum. */
    const tx = w.nz, tz = -w.nx;
    /* Wandlauf: mit Shift geht es die Fassade richtig hinauf statt zu
       kriechen – dafür gibt es seit mixamo-7 eine eigene Bewegung. */
    /* ---- Wandlauf: rennen, langsamer werden, klettern ----
       Frueher hielt gedrueckter Sprint den Wandlauf UNBEGRENZT: man rannte
       die Fassade beliebig weit hinauf, immer gleich schnell. Jetzt traegt
       nur der Schwung, und der laeuft aus. Sprint verzoegert das nur.
       Aus 13 m/s Anlauf werden so knapp drei Sekunden Wandlauf und rund
       zwanzig Meter, danach klettert die Figur ganz normal weiter. */
    /* ---- Shift AN DER WAND: ein Satz nach oben ----
       In der Hilfe steht "Shift = Wandlauf", ausgeloest wurde er aber nur
       durch den Anlauf am Boden. Wer an der Fassade hing und Shift
       drueckte, bei dem passierte gar nichts - genau das war "auf den
       Haeusern kann ich keinen Wandlauf machen".
       Jetzt gibt es an der Wand alle gut zwei Sekunden einen neuen Satz.
       Er traegt rund sechs Meter; danach klettert man weiter oder setzt
       neu an. Dauerlauf die Fassade hinauf wird es dadurch nicht. */
    if (player.wandBoostCd > 0) player.wandBoostCd -= dt;
    if (sprintAn() && up > 0.05 && player.wandSchwung < 2.0 &&
        (player.wandBoostCd || 0) <= 0) {
      player.wandSchwung = 9.5;
      player.wandBoostCd = 2.2;
      SFX.swoosh();
    }
    if (player.wandSchwung > 0) {
      /* Die Bremse stand auf 11 je Sekunde. Aus dem normalen Lauf (7 m/s)
         ergab das einen Schwung von 6,3 - also 0,57 s und ganze DREI Meter
         Wandlauf, danach sofort Klettern mit Haenden und Fuessen. Genau so
         sah es aus: "ich klettere hoch statt zu rennen".
         Gemessen ist die Steighoehe v0^2/(2a). Mit 3,2 werden aus dem Lauf
         rund 10 m in 2,5 s, aus dem Sprint (12,7) rund 37 m in 5,8 s - man
         rennt sichtbar hoch, wird langsamer und klettert dann weiter. */
      /* 2,2 / 3,2 ergaben gemessen 20,8 m ohne und rund 37 m mit Sprint -
         mit Sprint also fast ein ganzes Hochhaus. Mit 7,5 / 7,0 sind es
         gemessen 12 m mit und 7,5 m ohne Sprint: ein kraeftiger Anlauf,
         aber kein halbes Haus mehr. */
      player.wandSchwung -= dt * (sprintAn() && up > 0 ? 7.5 : 7.0);
      if (player.wandSchwung < 0) player.wandSchwung = 0;
    }
    const kTempo = CFG.climbSpeed;
    const sTempo = CFG.climbSpeedSeit || kTempo;
    const hoch = up * kTempo + Math.max(0, player.wandSchwung);
    /* Ohne Eingabe ist es kein Lauf mehr. Vorher blieb die waagerechte
       Laufhaltung stehen, solange noch Schwung da war - man klebte quer
       an der Fassade, obwohl man stand. */
    player.wandlauf = player.wandSchwung > 1.5 && (Math.abs(up) + Math.abs(side)) > 0.05;
    player.vel.set(tx * side * sTempo, hoch, tz * side * sTempo);
    player.pos.addScaledVector(player.vel, dt);
    /* Vorsprünge beim Klettern: Gesims, Vordach oder Feuerleiter ragen aus
       der Fassade heraus. Vorher steckte die Figur mit dem Oberkörper darin
       fest. Ist der Vorsprung in Griffhöhe und man klettert aufwärts, zieht
       sie sich darüber; sonst wird sie davor geschoben. */
    for (const lc of collidersNear(player.pos.x, player.pos.z)) {
      if (!lc.klein || lc.y0 === undefined) continue;
      const kopf = player.pos.y + 1.85;
      if (lc.h < player.pos.y + 0.1 || lc.y0 > kopf) continue;
      if (player.pos.x < lc.x0 - player.radius || player.pos.x > lc.x1 + player.radius) continue;
      if (player.pos.z < lc.z0 - player.radius || player.pos.z > lc.z1 + player.radius) continue;
      if (up > 0 && lc.h - player.pos.y < 2.6 && !lc.keinHalt) {
        const dauer = heroVisual.kanteOneShot ? heroVisual.kanteOneShot(0.95) : 0;
        const ziel = V3(
          player.pos.x - w.nx * (player.radius + 0.75),
          lc.h,
          player.pos.z - w.nz * (player.radius + 0.75),
        );
        if (dauer > 0.2) {
          player.state = 'kante';
          player.kante = { t: 0, dauer, von: player.pos.clone(), nach: ziel, hoch: lc.h };
        } else {
          player.pos.copy(ziel); player.state = 'air'; player.vel.set(0, 4, 0);
        }
        player.wallInfo = null;
        player.vel.set(0, 0, 0);
        updateHeroVisual(dt);
        return;
      }
      // Vor den Vorsprung schieben, statt darin zu stecken
      if (w.nx !== 0) player.pos.x = (w.nx > 0 ? lc.x1 : lc.x0) + w.nx * CFG.climbGap;
      else player.pos.z = (w.nz > 0 ? lc.z1 : lc.z0) + w.nz * CFG.climbGap;
      break;
    }

    /* Am Rand der Wand um die Ecke wechseln. Vorher wurde die Figur dort
       einfach festgehalten – an jeder Hauskante war Schluss. */
    if (player.eckSperre > 0) player.eckSperre -= dt;
    if (side !== 0 && player.eckSperre <= 0) {
      const rand = 0.25;
      let neuNx = 0, neuNz = 0;
      if (w.nx !== 0) {
        if (player.pos.z < c.z0 + rand) neuNz = -1;
        else if (player.pos.z > c.z1 - rand) neuNz = 1;
      } else {
        if (player.pos.x < c.x0 + rand) neuNx = -1;
        else if (player.pos.x > c.x1 - rand) neuNx = 1;
      }
      if (neuNx !== 0 || neuNz !== 0) {
        /* Der Wechsel um die Ecke sah aus wie ein Sprung: die Figur wurde
           in EINEM Bild um gut einen halben Meter versetzt (gemessen 0,57 m
           - 0,35 m davon allein durch den Sicherheitsabstand, mit dem sie
           hinter die Kante gesetzt wurde), und dazu klappte die
           Blickrichtung um 90 Grad.
           Zwei Aenderungen: der Versatz wird auf das Noetige verkleinert
           (nur der Kletterabstand), und was uebrig bleibt, wandert in
           einen VISUELLEN Versatz, der ueber etwa eine Fuenftelsekunde
           auf null laeuft. Die Physik springt also weiterhin sauber um
           die Ecke, das Bild folgt aber weich - man klettert um die Ecke,
           statt hinueberzuspringen. */
        player.wallInfo = player.wall = { nx: neuNx, nz: neuNz, col: c };
        /* Der Sicherheitsabstand hinter der Kante MUSS groesser sein als
           das Suchband (rand), sonst steht die Figur auf der neuen Seite
           sofort wieder im Suchband und wechselt im naechsten Bild
           zurueck. Ein Versuch mit knappem Abstand hat genau das erzeugt:
           gemessen 200 Eckenwechsel in acht Sekunden, hin und her. */
        const hinter = rand + 0.10;
        if (neuNx !== 0) player.pos.x = (neuNx > 0 ? c.x1 : c.x0) + neuNx * CFG.climbGap;
        else player.pos.z = (neuNz > 0 ? c.z1 : c.z0) + neuNz * CFG.climbGap;
        if (neuNx !== 0) player.pos.z = clamp(player.pos.z, c.z0 + hinter, c.z1 - hinter);
        else player.pos.x = clamp(player.pos.x, c.x0 + hinter, c.x1 - hinter);
        player.eckT = 0.45;
        player.eckSperre = 0.45;
      }
    }
    // seitlich begrenzen
    if (w.nx !== 0) player.pos.z = clamp(player.pos.z, c.z0 + 0.2, c.z1 - 0.2);
    else player.pos.x = clamp(player.pos.x, c.x0 + 0.2, c.x1 - 0.2);
    /* Der Takt lief mit 1 rad/s WEITER, auch wenn man bewegungslos an der
       Wand hing. Die Wandpose setzt Arme und Beine nach sin(Takt) - die
       Glieder pendelten also dauernd hin und her, obwohl die Figur stand.
       Genau das war das Zappeln der Beine an der Fassade. Jetzt laeuft der
       Takt nur, solange auch gedrueckt wird. */
    player.phase += dt * (Math.abs(up) + Math.abs(side)) * 7;
    /* Klettertempo für die Animation: hoch = vorwärts, runter = rückwärts,
       ohne Eingabe hängt die Figur still an der Wand. */
    const bewegt = Math.abs(up) + Math.abs(side);
    /* Die Abspielgeschwindigkeit muss zum WIRKLICHEN Steigen passen.
       Sie stand fest auf 1, waehrend die Figur mit 4,5 m/s die Wand
       hochfuhr - die Kriechbewegung legt bei 1 aber nur 0,85 m/s zurueck.
       Der Arm bewegte sich also einmal, waehrend die Figur fuenf Meter
       hochgeklettert war: genau der Eindruck "er klettert langsam, ist
       aber schon halb oben".
       Gleiche Rechnung wie bei den Gangarten am Boden: Tempo geteilt durch
       die Eigengeschwindigkeit der Bewegung - dann bleibt die Hand an der
       Fassade stehen, statt zu rutschen. */
    if (bewegt === 0 && !player.wandlauf) player.klettertempo = 0;
    else {
      const vSteig = Math.abs(hoch);
      /* Beim Rennen die Eigengeschwindigkeit des Laufs, beim Klettern die
         der Kriechbewegung an der Wand. */
      const eigen = player.wandlauf ? (GANG_REF.run || 4.2) : KLETTER_REF;
      player.klettertempo = clamp(vSteig / eigen, 0.5, 5.0) * (up < 0 ? -1 : 1);
    }
    /* Oben angekommen → über die Kante ziehen. Vorher wurde die Figur
       einfach aufs Dach versetzt und nach oben geschleudert; jetzt läuft
       dafür eine eigene Bewegung ab und der Körper wandert währenddessen
       auf die Dachfläche. */
    if (player.pos.y + 1.75 > c.h && up > 0) {
      const dauer = heroVisual.kanteOneShot ? heroVisual.kanteOneShot(0.95) : 0;
      const ziel = V3(
        player.pos.x - w.nx * (player.radius + 0.75),
        c.h,
        player.pos.z - w.nz * (player.radius + 0.75),
      );
      if (dauer > 0.2) {
        player.state = 'kante';
        player.kante = { t: 0, dauer, von: player.pos.clone(), nach: ziel, hoch: c.h };
        player.vel.set(0, 0, 0);
      } else {
        player.pos.copy(ziel);
        player.vel.set(-w.nx * 3, 5, -w.nz * 3);
        player.state = 'air';
      }
      player.wallInfo = null;
    } else if (player.pos.y <= groundY(player.pos.x, player.pos.z, player.pos.y) + 0.05 && up <= 0) {
      player.state = 'ground';
      player.wallInfo = null;
    } else if (wantSwing && !keys['Space']) {
      // RMT: von der Wand in den Schwung
      player.state = 'air';
      player.wallInfo = null;
    }
    player.facing = dampAngle(player.facing, Math.atan2(-w.nx, -w.nz), dt * 14);
    /* Seitliches Hangeln hat seit mixamo-5 eine eigene Bewegung; senkrecht
       geht es mit dem freien Klettern nach oben. Die Wandpose legt sich in
       beiden Fällen darüber. */
    const seitlich = Math.abs(side) > Math.abs(up);
    /* mixamo-8 bringt mit "Climbing" eine durchgehende Kletterschleife -
       Hand ueber Hand, Koerper an der Wand. Sie passt fuer das
       Wandkriechen deutlich besser als "Climbing Up Wall", das eher ein
       einmaliges Hochziehen ist. */
    /* Seitwaerts an der Wand laeuft DIESELBE Kriechbewegung wie hinauf.
       Zwei Anlaeufe mit eigenen Seitwaerts-Dateien aus dem Paket sind
       gescheitert: einmal lag die Figur laengs an der Fassade, einmal
       ruderte sie mit dem Bein ueber dem Kopf. Der Koerper steht so
       richtig an der Wand, und man bewegt sich sichtbar zur Seite. */
    /* Vier Richtungen an der Wand, jede mit eigener Bewegung: hinauf,
       hinunter, links, rechts. Rueckwaerts abgespielt sieht Klettern
       falsch aus - hinunter greifen die Haende anders herum. */
    player.wandAb = !seitlich && up < 0;
    const hatK = heroVisual.hatClip || (() => false);
    const senkrecht = hatK('klettern') ? 'klettern' : 'climb';
    /* Stillstand an der Wand: dieselbe Kriechbewegung als Unterlage, die
       Haltung selbst wird GESETZT (poseWandhalt). Zwei Anlaeufe davor sind
       gescheitert: die Haengebewegung am Faden ist aufrecht gebaut - damit
       STAND die Figur an der Hauswand -, und die Kriechruhe aus dem Paket
       fror an einer beliebigen Stelle ein, mal mit angehobenem Bein und
       Arm auf derselben Seite. */
    player.wandStill = bewegt === 0;
    player.anim = player.wandlauf ? 'wandlauf'        // die Wand hochlaufen
                : senkrecht;                          // hoch, runter, quer
    updateHeroVisual(dt);
    return;
  }

  /* ---- Zip ---- */
  if (player.state === 'zip' && player.zip) {
    const z = player.zip;
    z.t -= dt;
    /* Beim Gegner wandert das Ziel mit. Vorher stand der Punkt fest, an
       dem er beim Tastendruck war - lief er weiter, zog das Netz ins
       Leere daneben. */
    if (z.enemy && !z.enemy.dead) z.target.set(z.enemy.pos.x, z.enemy.pos.y + 1.1, z.enemy.pos.z);
    const t = z.target;
    const d = _v1.set(t.x - player.pos.x, t.y - player.pos.y, t.z - player.pos.z);
    const dist = d.length();
    player.fadenZiel = t; player.fadenHand = z.hand;
    const ende = dist < (z.enemy ? 2.3 : z.fest ? 1.4 : 2.0) || z.t <= 0 ||
                 (z.enemy && z.enemy.dead);
    if (ende) {
      swingStrand.visible = false;
      if (z.enemy && !z.enemy.dead && dist < 4.2) zipAngriff(z.enemy);
      else if (z.fest && dist < 2.2) {
        /* ---- Oben auf der Laterne ankommen ----
           Vorher flog man einfach daran vorbei. Jetzt setzt man sich
           obendrauf: Fuesse auf die Spitze, Schwung raus, und die Figur
           geht in dieselbe Hocke wie auf einer Dachkante. */
        player.pos.set(t.x, t.y + 0.02, t.z);
        player.vel.set(0, 0, 0);
        player.onGround = true;
        player.hockeT = 1.0;
        popupWorld('Aufgesessen', t, '#bfe8ff');
      }
      else player.vel.multiplyScalar(0.45);
      player.zip = null;
      player.state = player.onGround ? 'ground' : 'air';
    } else {
      /* Ziehen statt schieben: das Tempo steigt ueber die Zugstrecke an,
         und die vorhandene Geschwindigkeit wird auf die Fadenrichtung
         GEDREHT statt hart ersetzt. Dadurch fliegt man einen Bogen zum
         Ziel - wer aus dem Lauf zieht, behaelt seinen Schwung. */
      z.tempo = Math.min(40, z.tempo + 80 * dt);
      _v2.copy(d).multiplyScalar(z.tempo / (dist || 1));
      player.vel.lerp(_v2, Math.min(1, dt * 16));
      player.pos.addScaledVector(player.vel, dt);
      const prevY = player.pos.y;
      player.onGround = false;
      collideBody(player, prevY);
      /* An einer Wand haengenbleiben beendet den Zug - ausser der Gegner
         steht dahinter dicht davor, dann waere es ein Abbruch kurz vor
         dem Treffer. */
      if (player.wall) {
        if (z.enemy && !z.enemy.dead && dist < 4.2) zipAngriff(z.enemy);
        player.zip = null; player.state = 'air'; swingStrand.visible = false;
      }
      /* Waehrend des Zugs zieht der Faden die Figur nach vorn. Die Haltung
         wird hier gesetzt, nicht in der allgemeinen Auswahl weiter unten -
         der Zug kehrt vorher zurueck. Genau deshalb lief bisher der freie
         Fall, obwohl unten eine Zip-Haltung stand. */
      /* Auf langer Strecke dreht sich die Figur im Zug einmal um die
         eigene Achse ("HorizontalSwirl") - kurze Zuege bleiben ruhig. */
      const hatDreh = !z.enemy && z.weit &&
                      heroVisual.hatClip && heroVisual.hatClip('zip_dreh');
      const hatZug = heroVisual.hatClip && heroVisual.hatClip('zip_zug');
      player.anim = hatDreh ? 'zip_dreh'
                  : hatZug ? 'zip_zug' : (z.enemy ? 'knie' : 'air');
      updateHeroVisual(dt);
      return;
    }
  }

  /* ---- Schwingen starten/stoppen ---- */
  if (player.state === 'swing') {
    if (!wantSwing) stopSwing(true);
  } else if (wantSwing && player.state === 'air' && !player.swingLock) {
    /* Direkt über dem Boden gibt es keinen brauchbaren Bogen – erst ab etwas
       Höhe oder im Fallen greift das Netz. Startet man tief, gibt es einen
       kräftigen Satz nach oben, damit der Schwung Platz hat. */
    const hoehe = player.pos.y - groundY(player.pos.x, player.pos.z, player.pos.y);
    /* Kein künstlicher Satz nach oben mehr. Vorher wurde die Figur beim
       Anschwingen dicht über dem Boden schlagartig auf 5,5 m/s nach oben
       geschossen – das sah aus, als würde sie aus dem Nichts fünf Meter
       hochspringen. Stattdessen holt das Netz selbst ein, bis der Bogen
       über der Straße bleibt (siehe startSwing). Dadurch fängt der Schwung
       tief an und steigt mit jedem Bogen weiter. */
    if (hoehe > 0.8 || player.vel.y < 0) {
      const vy = player.vel.y;
      if (!startSwing()) {
        /* Kein Haus in Reichweite (z. B. über dem Fluss oder hoch über
           allen Dächern): kein Netz ins Leere schießen. Die Taste bleibt
           aber scharf – sobald ein Haus in Reichweite kommt, greift das
           Netz von selbst, ohne dass man neu drücken muss. */
        player.vel.y = vy;
        if (player.keinHaltCd <= 0) {
          popupScreen('Kein Halt in Reichweite');
          player.keinHaltCd = 1.6;
        }
      }
    }
  }
  /* Gehaltene Sprungtaste: nach einem kurzen Moment in der Luft gibt sie
     den Schwung frei. Losgelassen wird die Sperre sofort aufgehoben. */
  if (!keys['Space'] && !swingHeld) { player.swingLock = false; player.haltenT = 0; }
  else if (player.swingLock && !player.onGround) {
    player.haltenT = (player.haltenT || 0) + dt;
    if (player.haltenT > 0.26) player.swingLock = false;
  }

  /* ---- Gleiten mit den Netzflügeln ----
     Zwischen Armen und Rumpf spannt sich eine Netzhaut. Hoch über der
     Skyline findet der Netzanker nichts mehr – dort war das Spiel bisher
     ein reiner Sturzflug. Mit den Flügeln wird daraus ein Gleitflug:
     langsames Sinken, dafür Tempo nach vorn, das man gegen Höhe eintauschen
     kann. Ausgelöst wird es mit derselben Taste wie Sprinten. */
  const hoeheUeberGrund = player.pos.y - groundY(player.pos.x, player.pos.z, player.pos.y);
  /* Erst ab acht Metern Höhe und frühestens am Scheitelpunkt des Sprungs –
     sonst breitet die Figur schon bei jedem Sprung die Flügel aus.
     Einmal in der Luft darf der Flug auch tiefer weitergehen; nur der
     Start braucht die Höhe. */
  const gleitHoehe = player.gleiten ? 2.5 : 8;
  const willGleiten = gleitTaste() && !player.onGround &&
                      player.state === 'air' && !player.zip && player.rollT <= 0 &&
                      hoeheUeberGrund > gleitHoehe && (player.gleiten || player.vel.y < 2);
  if (willGleiten && !player.gleiten) {
    player.gleiten = true;
    player.gleitT = 0;
    SFX.web();
  } else if (!willGleiten && player.gleiten) {
    player.gleiten = false;
    /* Nachlauf: die Haltung wird ausgeblendet statt hart umzuschalten.
       Der Wechsel vom Gleiten in den Netzschwung sah sonst aus, als würde
       die Figur in einem einzigen Bild die Pose tauschen. */
    player.gleitAus = 0.4;
  }
  if (player.gleiten) player.gleitT += dt;
  if (player.gleitAus > 0) player.gleitAus -= dt;
  /* Weich einblenden: in einer Viertelsekunde von der Fallhaltung in die
     ausgebreitete Gleithaltung. */
  const gleitZiel = player.gleiten ? 1 : 0;
  player.gleitMisch = lerp(player.gleitMisch || 0, gleitZiel,
                           Math.min(1, dt * (gleitZiel ? 6 : 4)));

  /* ---- Physik ---- */
  let grav = player.state === 'swing' ? CFG.swingGravity : CFG.gravity;
  if (player.gleiten) {
    /* ---- Sturzflug ----
       Nase ganz nach unten (W halten) heisst nicht mehr nur "etwas
       steiler": die Figur legt sich kopfvoran in den Sturz, die Traglast
       faellt weg und die gewonnene Hoehe wird in Tempo umgesetzt. Genau
       damit holt man sich vor dem naechsten Netz Schwung. */
    player.sturzflug = (player.gleitNase || 0) > 0.55 &&
                       heroVisual.hatClip && heroVisual.hatClip('sturzflug');
    if (player.sturzflug) {
      grav *= 0.62;                          // fast freier Fall
      /* Fallhoehe wird zu Vortrieb: je schneller es abwaerts geht, desto
         mehr Tempo nach vorn. */
      const vor = _v1.set(Math.sin(player.facing), 0, Math.cos(player.facing));
      const zug = Math.min(28, -player.vel.y) * 0.55 * dt;
      if (zug > 0) { player.vel.x += vor.x * zug; player.vel.z += vor.z * zug; }
    } else {
      /* Der Faktor stand auf 0,24. Gemessen pendelte sich das Sinken damit
         bei 13,8 m/s ein, bei 26 m/s nach vorn - also nur zwei Meter Strecke
         je Meter Hoehe. So ist der Gleitflug vorbei, bevor er anfaengt.
         Mit 0,12 und einer Sinkbremse von 7 m/s sind es rund vier Meter je
         Meter Hoehe: man kommt weit und hat Zeit, es zu geniessen. */
      grav *= 0.12;                          // die Flügel tragen
      if (player.vel.y < -7) player.vel.y = lerp(player.vel.y, -7, Math.min(1, dt * 3));
    }
  } else player.sturzflug = false;
  player.vel.y -= grav * dt;

  if (player.onGround && player.state !== 'swing') {
    const speed = gangTempo();
    if (player.dodgeT > 0) {
      player.dodgeT -= dt;
      /* Die Rolle läuft aus, statt mit vollem Tempo abzubrechen. */
      const b = Math.max(0, 1 - dt * 2.6);
      player.vel.x *= b; player.vel.z *= b;
    } else if (player.attack && player.attack.type !== 'web') {
      /* Gebremst wird erst NACH dem Treffer. Vorher hat die Bremse schon
         den Ausfallschritt zum Gegner abgewürgt – die Figur kam gar nicht
         in Reichweite und schlug ins Leere. */
      const b = Math.max(0, 1 - dt * (player.attack.hitDone ? 9 : 1.2));
      player.vel.x *= b; player.vel.z *= b;
      if (dir) player.facing = dampAngle(player.facing, Math.atan2(dir.x, dir.z), Math.min(1, dt * 3));
    } else if (dir) {
      /* ---- Anlauf ----
         Aus dem Stand ging es bisher in einer Zehntelsekunde auf volles
         Tempo – die Figur schoss los, als würde sie geschoben. Jetzt
         braucht sie rund eine halbe Sekunde, und aus dem Stand heraus ist
         der erste Schub kräftiger als das letzte Stück zur Höchst-
         geschwindigkeit (so läuft man wirklich an).
         Ein Richtungswechsel bremst zusätzlich: quer zur Laufrichtung
         bekommt man keinen Halt. */
      const hs = Math.hypot(player.vel.x, player.vel.z);
      const anteil = clamp(hs / Math.max(1, speed), 0, 1);
      const rate = lerp(9.5, 4.5, anteil);
      player.vel.x = lerp(player.vel.x, dir.x * speed, Math.min(1, dt * rate));
      player.vel.z = lerp(player.vel.z, dir.z * speed, Math.min(1, dt * rate));
      /* Schnelle Figuren drehen träger – sonst wirkt jede Kurve wie ein
         Sprung auf der Stelle. */
      const drehRate = lerp(14, 6.5, clamp(hs / CFG.sprintSpeed, 0, 1));
      /* Beim Spannen des Katapults schaut die Figur zu den Netzen, nicht
         in die Laufrichtung - sie geht ja rueckwaerts.
         Das MUSS hier stehen: updateHeroVisual liest player.facing noch in
         diesem Bild aus. Wurde die Blickrichtung erst spaeter in
         updateKatapult gesetzt, hat sie die Laufrichtung im selben Bild
         schon wieder ueberschrieben - die Figur schaute nie zu den
         Netzen. */
      const zumNetz = KAT.aktiv && (KAT.rx || KAT.rz);
      player.facing = dampAngle(player.facing,
                                zumNetz ? Math.atan2(KAT.rx, KAT.rz)
                                        : Math.atan2(dir.x, dir.z),
                                Math.min(1, dt * (zumNetz ? 10 : drehRate)));
    } else {
      /* ---- Auslauf ----
         Vorher stand die Figur nach 0,05 s still und der Rest wurde hart
         auf null gesetzt: aus vollem Sprint in den Stand, ohne Übergang.
         Jetzt läuft sie aus – schnell genug, dass die Steuerung knackig
         bleibt, aber sichtbar. */
      const hs = Math.hypot(player.vel.x, player.vel.z);
      const bremse = hs > 6 ? 7 : 13;      // aus vollem Lauf länger
      player.vel.x = lerp(player.vel.x, 0, Math.min(1, dt * bremse));
      player.vel.z = lerp(player.vel.z, 0, Math.min(1, dt * bremse));
      if (hs < 0.12) { player.vel.x = 0; player.vel.z = 0; }
    }
  } else if (player.gleiten) {
    /* ---- Gleitflug ----
       Sinken wird gedämpft, die Sinkgeschwindigkeit in Vortrieb umgesetzt.
       W drückt die Nase herunter: schneller, aber man verliert Höhe.
       S zieht sie hoch: man bremst und steigt kurz, verliert dann Tempo.
       A/D legen die Figur in die Kurve. */
    if (player.dodgeT > 0) player.dodgeT -= dt;
    const nase = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
                 (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) +
                 (stick.z || 0);
    const kurve = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
                  (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) +
                  (stick.x || 0);
    /* Steuerung deutlich wacher als vorher: die Eingabe war mit dt*4
       geglättet und die Drehrate lag bei 1,5 rad/s – eine Kehrtwende
       dauerte über zwei Sekunden und man konnte einem Haus nicht mehr
       ausweichen. */
    /* Die Nase darf nur begrenzt nach OBEN. Ganz nach oben gezogen wurde
       die Figur aufrecht gestellt - und genau in dieser Haltung stieg sie
       auch noch (siehe sinkMax). Beides zusammen war der Gleitflug, der
       nach oben statt nach unten ging. */
    player.gleitNase = lerp(player.gleitNase || 0, clamp(nase, -0.55, 1),
                            Math.min(1, dt * 6.5));
    player.gleitKurve = lerp(player.gleitKurve || 0, clamp(kurve, -1, 1), Math.min(1, dt * 8));

    /* Sinkgeschwindigkeit begrenzen - das ist der eigentliche Fluegel.
       WICHTIG: die Grenze muss NEGATIV bleiben. Mit der Nase nach oben
       ergab die alte Rechnung -(4,2 - 7,5) = +3,3 - also eine Grenze
       OBERHALB von null. Die Zeile darunter zieht die Figur an diese
       Grenze heran, und aus der Sinkbremse wurde damit ein Aufzug: die
       Figur stieg mit gut drei Metern je Sekunde, ohne jeden Antrieb.
       Ein Gleiter kann aus dem Nichts keine Hoehe gewinnen; mit der Nase
       oben sinkt er nur LANGSAMER (1,6 m/s). */
    const sinkMax = -Math.max(1.6, 4.2 + player.gleitNase * 7.5);   // -1,6 … -11,7
    if (player.vel.y < sinkMax) player.vel.y = lerp(player.vel.y, sinkMax, Math.min(1, dt * 3.2));

    /* Kurve: die Blickrichtung dreht, das Tempo folgt der Nase. */
    player.facing -= player.gleitKurve * dt * 2.9;
    const f = _v1.set(Math.sin(player.facing), 0, Math.cos(player.facing));
    /* Aus Sinken wird Vortrieb: je steiler, desto schneller. */
    const zielTempo = 15 + player.gleitNase * 11;         // 4 … 26 m/s
    /* Der ganze Geschwindigkeitsvektor wird weich auf sein Ziel gezogen –
       eine einzige Zeitkonstante für Tempo UND Richtung. Vorher wurde die
       Richtung in jedem Bild hart auf die Blickrichtung gesetzt; das war
       das Ruckeln in der Kurve. */
    const k = Math.min(1, dt * 3.4);
    player.vel.x = lerp(player.vel.x, f.x * zielTempo, k);
    player.vel.z = lerp(player.vel.z, f.z * zielTempo, k);
  } else {
    // Luftsteuerung
    if (player.dodgeT > 0) player.dodgeT -= dt;
    /* Beim Schwingen übernimmt die Kurvensteuerung – die grobe
       Luftsteuerung würde sonst dagegenarbeiten. */
    if (dir && player.state !== 'swing') {
      const vorher = Math.hypot(player.vel.x, player.vel.z);
      if (vorher > 6) {
        /* ---- Schnell in der Luft: die Eingabe DREHT den Kurs ----
           Vorher wurde einfach eine Kraft in Eingaberichtung addiert. Wer
           bei 28 m/s zur Seite steuerte, drueckte damit zwangslaeufig auch
           gegen die eigene Flugrichtung: gemessen blieben von 28 m/s noch
           12,8 uebrig. Jede Kurve war also eine Vollbremsung, und genau
           deshalb liess sich in der Luft "nichts machen".
           Jetzt wird der Querteil der Eingabe zu einer Kursaenderung - der
           Betrag bleibt - und nur der Laengsteil beschleunigt oder bremst,
           und der deutlich schwaecher als frueher. */
        const fx = player.vel.x / vorher, fz = player.vel.z / vorher;
        const laengs = dir.x * fx + dir.z * fz;
        const quer = dir.x * fz - dir.z * fx;
        const w = quer * LUFT_DREH * dt;
        const cw = Math.cos(w), sw = Math.sin(w);
        const vx = player.vel.x, vz = player.vel.z;
        player.vel.x = vx * cw + vz * sw;
        player.vel.z = -vx * sw + vz * cw;
        const neuTempo = clamp(vorher + laengs * CFG.airAccel * 0.45 * dt,
                               5, Math.max(30, vorher));
        const f2 = neuTempo / vorher;
        player.vel.x *= f2; player.vel.z *= f2;
      } else {
        /* Langsam oder aus dem Stand: hier braucht es echten Schub, sonst
           kommt man in der Luft gar nicht in Fahrt. */
        player.vel.x += dir.x * CFG.airAccel * dt;
        player.vel.z += dir.z * CFG.airAccel * dt;
        const hs = Math.hypot(player.vel.x, player.vel.z);
        const maxH = Math.max(30, vorher);
        if (hs > maxH) { player.vel.x *= maxH / hs; player.vel.z *= maxH / hs; }
      }
    }
  }

  /* Der Anlauf überschreibt die normale Steuerung – er ist eine geführte
     Bewegung, kein Ergebnis der Eingabe. */
  updateAnlauf(dt);

  // Plattform (Autodach) mitbewegen
  if (player.platform && player.onGround) {
    player.pos.x += player.platform.vx * dt;
    player.pos.z += player.platform.vz * dt;
  }

  const prevY = player.pos.y;
  /* Zustand VOR der Bewegung sichern. Die Teilschritte unten rufen selbst
     collideBody auf und setzen dabei onGround und vel.y – wer das erst
     danach abfragt, sieht die Landung nie und bekommt deshalb weder
     Landeanimation noch Abrollen. Genau daran lag das kurze Einsinken
     beim Aufkommen auf einem Dach. */
  const wasOnGround = player.onGround;
  const fallTempo = -player.vel.y;
  /* Geschwindigkeit VOR der Kollision merken. collideBody nimmt den Anteil
     in die Wand heraus; wer danach abprallen will, findet sonst nichts
     mehr vor, womit er rechnen koennte. */
  _vVorWand.copy(player.vel);
  /* Ab hier gilt "in der Luft", bis irgendeine Kollisionsprüfung dieses
     Bildes etwas anderes sagt – auch eine aus den Teilschritten. Vorher
     wurde das Ergebnis der Teilschritte gleich wieder verworfen: die
     Landung fiel dadurch ein Bild später auf, und da war die
     Fallgeschwindigkeit längst weg. Deshalb blieb die Landeanimation aus
     und die Beine schnappten einfach nach unten. */
  player.onGround = false;
  /* ---- Bewegung in Teilschritten ----
     Bei 30 m/s legt die Figur in einem Bild einen halben Meter zurück. Sie
     stand damit schon tief in der Fassade, bevor die Kollision überhaupt
     geprüft wurde – das war das Hineinbuggen beim Anfliegen eines Hauses.
     Bei hohem Tempo wird der Weg deshalb in mehrere Teilschritte zerlegt
     und nach jedem geprüft. */
  /* Die Schrittweite muss KLEINER als der Koerperradius bleiben, sonst
     springt die Figur in einem Teilschritt ganz durch eine Wand. Der
     Deckel lag bei sechs Schritten; bei einem Bildhaenger (dt = 0,1 s)
     und 40 m/s waren das 0,67 m je Schritt - fast das Doppelte des
     Radius. Jetzt sind bis zu 16 Schritte erlaubt. */
  const wegProBild = player.vel.length() * dt;
  const teile = wegProBild > 0.30 ? Math.min(16, Math.ceil(wegProBild / 0.25)) : 1;
  if (teile > 1) {
    /* Zusätzlicher Puffer: der sichtbare Körper ist breiter als der
       Kollisionsradius – Schultern und Arme steckten sonst in der Wand. */
    const puffer = wandPuffer();
    const tdt = dt / teile;
    for (let i = 0; i < teile - 1; i++) {
      const vy = player.pos.y;
      merkeVorPos(player);
      player.pos.addScaledVector(player.vel, tdt);
      collideBody(player, vy, puffer);
      if (player.wall) break;      // angekommen – der Rest wird oben erledigt
    }
    merkeVorPos(player);
    player.pos.addScaledVector(player.vel, tdt);
  } else {
    merkeVorPos(player);
    player.pos.addScaledVector(player.vel, dt);
  }

  /* ---- Seil ----
     Das Seil wird in mehreren Teilschritten gelöst. Ein einziger Schritt pro
     Bild lässt das Pendel bei hohem Tempo hart anschlagen – genau das hat den
     Schwung ruckeln lassen. */
  if (player.state === 'swing' && player.swing) {
    const s = player.swing;
    s.t += dt;
    /* Lenkeingabe für die Kurve – Tastatur, Gamepad-Stick oder Daumenknüppel. */
    const kurveRoh = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
                     (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) + (stick.x || 0);
    /* Weich anlegen, damit die Kurve nicht schlagartig einsetzt. */
    player.kurveGlatt = lerp(player.kurveGlatt || 0, clamp(kurveRoh, -1, 1),
                             Math.min(1, dt * 6));
    const kurveEin = Math.abs(player.kurveGlatt) > 0.02 ? player.kurveGlatt : 0;
    /* ---- Von allein geradeaus ----
       Ein freies Pendel dreht seine Ebene ständig: der Schwung zog immer
       von selbst nach links oder rechts, obwohl man gar nichts gedrückt
       hat. Ohne Lenkeingabe wird die Flugrichtung deshalb sanft auf die
       Blickrichtung zurückgeführt – gedrückt man A oder D, hat die Lenkung
       Vorrang. */
    let geradeAus = 0;
    if (!kurveEin) {
      /* Nur waehrend es VORWAERTS geht. Im Rueckschwung zeigt die
         Flugrichtung naturgemaess nach hinten; die Rueckfuehrung hat dort
         gegen das Pendel gearbeitet und ihm die Bewegung genommen. */
      const vor = player.vel.x * -Math.sin(camYaw) + player.vel.z * -Math.cos(camYaw);
      if (vor > 0.5) {
        const flug = Math.atan2(player.vel.x, player.vel.z);
        let ab = flug - (camYaw + Math.PI);
        while (ab > Math.PI) ab -= TAU;
        while (ab < -Math.PI) ab += TAU;
        geradeAus = clamp(-ab * 0.45, -0.45, 0.45);
      }
    }
    /* Seil sanft auf die Wunschlänge bringen statt ruckartig einzuholen */
    const tief = player.pos.y < s.anchor.y - s.zielLen * 0.72;   // nahe dem Tiefpunkt?
    if (keys['KeyW'] || keys['ArrowUp']) {
      // Pumpen: unten einholen, oben nachgeben – so schaukelt man sich hoch
      s.zielLen += (tief ? -6 : 4) * dt;
    } else {
      s.zielLen -= 0.8 * dt;
    }
    s.zielLen = clamp(s.zielLen, CFG.ropeMin, 46);
    /* Das Seil wird mit begrenztem Tempo eingeholt. Ein Anteilsschritt hat
       bei großem Unterschied über 30 m/s Zugkraft ergeben – die Figur
       schoss dabei nach oben. Acht Meter je Sekunde fühlt sich nach Zug an,
       ohne zu katapultieren. */
    const spann = 8 * dt;
    s.len = s.len > s.zielLen ? Math.max(s.zielLen, s.len - spann)
                              : Math.min(s.zielLen, s.len + spann);

    const schritte = 4;
    const hdt = dt / schritte;
    for (let i = 0; i < schritte; i++) {
      const d = _v1.copy(player.pos).sub(s.anchor);
      const dist = d.length() || 0.001;
      if (dist > s.len) {
        const n = d.multiplyScalar(1 / dist);
        player.pos.copy(s.anchor).addScaledVector(n, s.len);
        const vn = player.vel.dot(n);
        if (vn > 0) player.vel.addScaledVector(n, -vn * 0.98);   // weich abfangen
        /* Tangentialer Antrieb in Blickrichtung: fühlt sich an wie Schwung
           holen, ohne das Pendel zu verzerren. */
        if (keys['KeyW'] || keys['ArrowUp']) {
          const f = camForward();
          _v2.copy(f).addScaledVector(n, -f.dot(n)).normalize();
          player.vel.addScaledVector(_v2, 16 * hdt);
        }
      }
      /* ---- Kurve fliegen ----
         A/D drehen die Schwungebene. Der Schubvektor steht senkrecht auf
         Flugbahn UND Seil – dadurch ändert sich nur die Richtung, nicht das
         Tempo, und das Pendel wird nicht verzerrt.
         Wichtig: das gilt auch bei LOCKEREM Seil. Solange die Lenkung nur
         im straffen Seil wirkte, kam über einen ganzen Bogen kaum ein
         Dutzend Grad zusammen – man musste zum Abbiegen loslassen, sich
         drehen und neu anschießen. */
      /* ---- Lenken ----
         Hier wurde eine KRAFT quer zur Flugbahn addiert. Das dreht zwar,
         aber die Seilzwangsbedingung nimmt den Zuwachs gleich wieder weg -
         gemessen kam beim Halten von D nur 3,4 m Versatz zur Seite heraus,
         waehrend der Weg nach VORN von 21 m auf 4,4 m einbrach. Es fuehlte
         sich deshalb an, als drehe sich die Figur nur, statt zu fliegen.
         Jetzt wird stattdessen der KURS gedreht: die waagerechte
         Geschwindigkeit wird um die Hochachse gedreht, ihr Betrag bleibt
         gleich. Damit kostet Lenken kein Tempo. */
      /* ---- Und um WELCHE Achse? ----
         Bisher um die Welt-Hochachse. Das kippt die Geschwindigkeit aus
         der Tangentialebene des Seils heraus, und die Seilbedingung
         streicht diesen Anteil im naechsten Bild ersatzlos. Der Schwung
         hat dadurch in jedem Bild Energie verloren - gemessen aus dem
         Stand: nach 2 s 16,6 m/s, nach 6 s noch 2,7 m/s, in zehn Sekunden
         ganze 42 m Weg. Man hing am Faden statt zu schwingen.
         Gedreht wird deshalb um die SEILACHSE. Dabei bleibt die
         Geschwindigkeit tangential, ihr Betrag bleibt erhalten, und die
         Schwungebene dreht sich - genau das ist eine Kurve am Netz. */
      /* ---- Vorzeichen ----
         Die Seilachse zeigt vom Anker zur Figur, also nach UNTEN. Eine
         Drehung um sie mit dem Winkel w2 aendert den Kurswinkel
         atan2(vx, vz) um MINUS w2. Rechts (D) soll den Kurs verkleinern -
         von +Z nach -X. Also gehoert die Lenkung mit PLUS hierher.
         Vorher stand ein Minus davor: A und D waren vertauscht, man flog
         beim Druecken von D nach links.
         Die Rueckfuehrung auf die Blickrichtung braucht das umgekehrte
         Vorzeichen, denn geradeAus ist bereits als -0,45 * Abweichung
         gerechnet. */
      const lenkung = kurveEin || geradeAus;
      if (lenkung) {
        const w2 = (kurveEin * 2.0 - geradeAus * 0.5) * hdt;
        _vSeil.copy(player.pos).sub(s.anchor);
        const sl = _vSeil.length();
        if (sl > 0.2) { _vSeil.multiplyScalar(1 / sl); player.vel.applyAxisAngle(_vSeil, w2); }
      }
    }
    player.vel.multiplyScalar(1 - 0.02 * dt);
    const maxV = 40;
    if (player.vel.length() > maxV) player.vel.setLength(maxV);
    if (player.vel.length() > 2) {
      player.facing = dampAngle(player.facing, Math.atan2(player.vel.x, player.vel.z), dt * 8);
    }
    player.fadenZiel = s.anchor; player.fadenHand = s.hand;
    if (Math.random() < dt * 1.2) SFX.swoosh();
  }

  /* ---- Kollisionen ---- */
  player.platform = null;
  collideBody(player, prevY, wandPuffer());
  collidePlayerCars(prevY);
  collidePlayerHelis(prevY);
  collidePlayerAufzug(prevY);

  /* ---- Im Bogen gegen eine Wand ----
     Der Anker sitzt auf einer Dachkante, und das Pendel traegt die Figur
     anschliessend genau in die Fassade darunter. Gemessen brach das Tempo
     dabei von 14,4 auf 1,1 m/s ein, und danach hing sie bewegungslos am
     Faden - vier Sekunden lang, ohne dass irgendetwas passierte.
     Jetzt loest sich das Netz und die Figur rutscht mit dem Rest ihres
     Schwungs an der Wand entlang weiter. Wer will, klettert von dort
     hoch oder schiesst ein neues Netz. */
  if (player.state === 'swing' && player.wall) {
    const w = player.wall;
    const rein = _vVorWand.x * w.nx + _vVorWand.z * w.nz;
    stopSwing(true);
    if (rein < 0) {
      /* Der Anteil laengs der Wand bleibt erhalten, der Anteil in die Wand
         wird zu einem Abstoss davon weg. So gleitet die Figur an der
         Fassade entlang weiter, statt daran stehenzubleiben. */
      player.vel.x = _vVorWand.x - w.nx * rein * 1.6;
      player.vel.z = _vVorWand.z - w.nz * rein * 1.6;
      player.vel.y = Math.max(player.vel.y, _vVorWand.y * 0.7 + 1.5);
      SFX.swoosh();
    }
  }

  /* ---- Treppen und Bordsteine: nicht abheben ----
     Der Boden faellt unter den Fuessen weg, sobald es abwaerts geht. Bei
     der Treppe in die U-Bahn sind das gemessen 43 Grad Neigung; wer dort
     mit 7 m/s hinunterlaeuft, verliert 6,6 m/s Hoehe je Sekunde - mehr,
     als die Schwerkraft im ersten Moment hergibt. Die Figur hob deshalb
     bei jeder Stufe ab, fiel, landete, hob wieder ab: genau das
     Huepfen die Treppe hinunter.
     Wer im letzten Bild noch stand und dessen Boden hoechstens eine
     Stufenhoehe tiefer liegt, wird deshalb nachgezogen statt in den freien
     Fall entlassen. */
  const STUFE_MAX = 0.75;
  if (wasOnGround && !player.onGround && player.state !== 'swing' &&
      player.state !== 'zip' && player.state !== 'climb' && !player.gleiten &&
      player.vel.y <= 0.6 && player.rollT <= 0) {
    const gy = bodenHoeheFuerFuss(player.pos.x, player.pos.z);
    if (player.pos.y - gy > 0 && player.pos.y - gy <= STUFE_MAX) {
      player.pos.y = gy;
      player.vel.y = 0;
      player.onGround = true;
    }
  }

  if (player.onGround) {
    const kamVomSchwung = player.state === 'swing' || player.gleiten || player.gleitAus > 0;
    if (player.state === 'swing') stopSwing(false);
    if (!wasOnGround && player.vel.length() < 4) SFX.swoosh();
    /* Aufkommen war lautlos. Die Wucht richtet sich nach der Fallhoehe. */
    if (!wasOnGround && SFX.landung) SFX.landung(clamp(fallTempo / 22, 0.15, 1));
    /* ---- Ankommen aus Schwung oder Gleitflug ----
       Vorher endete beides einfach im Stand: man kam mit 20 m/s an und
       stand im nächsten Bild still. Jetzt gibt es zwei Ausgänge – wer
       flach und schnell ankommt, rollt die Wucht nach vorn ab; wer eher
       von oben kommt, setzt die Drei-Punkt-Landung. */
    const waagerecht = Math.hypot(player.vel.x, player.vel.z);
    if (!wasOnGround && kamVomSchwung && (waagerecht > 9 || fallTempo > 9)) {
      if (waagerecht > fallTempo * 1.15 && heroVisual.attackOneShot) {
        /* Flach und schnell: abrollen und dabei Tempo mitnehmen. */
        player.landT = heroVisual.attackOneShot(0, 'fallrolle', 0.8) || 0.8;
        player.hartLandung = player.landT;
        const f = _v1.set(player.vel.x, 0, player.vel.z).normalize();
        const rest = Math.min(11, waagerecht * 0.55);
        player.vel.x = f.x * rest; player.vel.z = f.z * rest;
        player.facing = Math.atan2(f.x, f.z);
      } else if (player.warSchwung > 0 && heroVisual.hatClip &&
                 heroVisual.hatClip('schwungland') && heroVisual.attackOneShot) {
        /* Loslassen, abrollen, in der Hocke aufkommen - die passende
           Bewegung zum Netzschwung. */
        player.landT = heroVisual.attackOneShot(0, 'schwungland', 1.0) || 1.0;
        player.hartLandung = player.landT;
        player.vel.x *= 0.25; player.vel.z *= 0.25;
        player.warSchwung = 0;
      } else if (heroVisual.hatClip && heroVisual.hatClip('sturzland') &&
                 heroVisual.attackOneShot) {
        /* Von oben: die tiefe Landehocke aus "Jumping Down" - beide Haende
           am Boden. Von zwei Varianten hat diese die deutlich bessere
           Haltung; die andere war ein zaghafter Schritt von der Kante. */
        player.landT = heroVisual.attackOneShot(0, 'sturzland', 0.75) || 0.75;
        player.hartLandung = player.landT;
        player.vel.x *= 0.1; player.vel.z *= 0.1;
      } else {
        /* Ohne die Datei bleibt die selbstgebaute Drei-Punkt-Landung. */
        player.dreiPunktT = 0.62;
        player.dreiPunktSeite = Math.random() < 0.5 ? 'L' : 'R';
        player.vel.x *= 0.12; player.vel.z *= 0.12;
      }
      camShake = Math.max(camShake, 0.2);
      staubWolke(player.pos, 1.7);
      SFX.kick();
    } else if (!wasOnGround && fallTempo > 6) {
      player.landT = clamp(fallTempo / 26, 0.18, 0.42);
      /* Aus großer Höhe wird abgerollt statt in die Knie zu federn. */
      if (fallTempo > 17 && heroVisual.attackOneShot) {
        /* Zwei verschiedene Landungen aus grosser Hoehe: wer im Fallen
           noch nach vorn unterwegs ist, rollt die Wucht ab; wer senkrecht
           herunterkommt, faengt sie in der Hocke ab. Vorher rollte die
           Figur auch aus dem freien Fall nach vorn weg - aus dem Stand
           heraus sah das aus, als stolpere sie beim Aufkommen. */
        const vorwaerts = Math.hypot(player.vel.x, player.vel.z) > 4.5;
        const hockeClip = heroVisual.hatClip && heroVisual.hatClip('sturzland')
                            ? 'sturzland' : null;
        if (!vorwaerts && hockeClip) {
          player.landT = heroVisual.attackOneShot(0, hockeClip, 0.7) || 0.7;
          player.hartLandung = player.landT;
          player.vel.x *= 0.1; player.vel.z *= 0.1;
        } else {
          player.landT = heroVisual.attackOneShot(0, 'fallrolle', 0.85) || 0.85;
          player.hartLandung = player.landT;
          const f = _v1.set(Math.sin(player.facing), 0, Math.cos(player.facing));
          player.vel.x = f.x * 7; player.vel.z = f.z * 7;
        }
        camShake = Math.max(camShake, 0.16);
        staubWolke(player.pos, 1.4);
        SFX.swoosh();
      }
    }
    /* Hoch ueber der Strasse gelandet? Dann gleich in die Hocke, ohne
       erst eine Sekunde still stehen zu muessen - so kommt man aus dem
       Flug direkt auf die Dachkante. */
    if (!wasOnGround && player.pos.y - SLAB_H > 12) player.hockeT = 1.0;
    player.state = 'ground';
    player.jumps = 0;
    player.swingLock = keys['Space'] || swingHeld; // Space am Boden gedrückt → erst loslassen
  } else if (player.state === 'ground') {
    player.state = 'air';
    if (player.jumps === 0) player.jumps = 1;
  }

  /* ---- automatisches Klettern ---- */
  /* ---- Mit Anlauf die Wand hoch ----
     Bisher musste man springen, die Wand berühren und dann Shift halten.
     Wer im Sprint gegen eine Fassade lief, blieb einfach stehen.
     Jetzt trägt der Schwung: wer mit Tempo dagegen rennt, läuft ein Stück
     die Wand hinauf, wird dabei immer langsamer und geht danach ins
     normale Klettern über – so wie es aussehen soll. */
  if (player.wall && player.onGround && player.state !== 'swing' &&
      player.state !== 'zip' && player.rollT <= 0) {
    const w = player.wall;
    const tempoRein = -(player.altVelX * w.nx + player.altVelZ * w.nz);
    const rein = dir && (dir.x * -w.nx + dir.z * -w.nz) > 0.35;
    /* Nur an richtigen Hauswänden – nicht an Brüstungen, Bänken oder den
       Wänden der U-Bahn-Station. Sonst trägt der Anlauf die Figur an einer
       viereinhalb Meter hohen Mauer wieder aus der Station heraus. */
    const hochGenug = w.col && (w.col.h - player.pos.y) > 6 && !w.col.klein;
    /* 5,5 war zu streng: wer leicht schraeg auf die Wand zulaeuft, kommt
       mit dem Anteil senkrecht zur Wand kaum darueber und blieb einfach
       stehen. Gehtempo (2,8) loest weiterhin nichts aus. */
    /* 4,5 und ein Kegel von 60 Grad waren zu streng: auf dem Gehweg hat
       man selten mehr als ein paar Meter Anlauf, und schon eine leichte
       Schraege liess den Anteil senkrecht zur Wand darunter fallen. Der
       normale Lauf (7 m/s) traegt jetzt auch leicht schraeg. */
    if (rein && hochGenug && tempoRein > 3.8) {
      player.state = 'climb';
      player.wallInfo = w;
      player.onGround = false;
      /* Der waagerechte Schwung wird in Höhe umgesetzt. */
      player.wandSchwung = clamp(tempoRein * 1.15, 8, 14);
      player.wandlauf = true;
      player.jumps = 0;
      beendeGleiten();
      SFX.swoosh();
    }
  }

  if (player.wall && !player.onGround && player.state !== 'swing' && player.state !== 'zip') {
    const w = player.wall;
    const movingIn = dir && (dir.x * -w.nx + dir.z * -w.nz) > 0.3;
    /* ---- Eigene Taste zum Ankleben ----
       Sie lag zusammen mit dem Ducken auf X. Das ging schief, sobald beide
       Bedeutungen im selben Moment gelten konnten: an der Wand hat man
       gedrueckt, um zu kleben, und im Bild darauf am Boden geduckt - oder
       umgekehrt. Jetzt duckt X am Boden und die Taste LINKS DANEBEN haelt
       an der Wand. Der Tastencode KeyZ meint die physische Taste links von
       X; auf einer deutschen Tastatur steht darauf ein Y. */
    const kleben = keys['KeyZ'] || touchKleben;
    /* Im Gleitflug klebt man nicht sofort an jeder Fassade, an der man
       vorbeistreift: mit 25 m/s in die Wand zu greifen sah aus wie ein
       Fehler. Erst ein kurzer Moment Kontakt (oder die Halte-Taste) lässt
       greifen – und dann werden die Flügel sauber eingeklappt, statt dass
       die Gleithaltung an der Wand weiterläuft. */
    const noetig = player.gleiten ? 0.12 : 0;
    onWallTimer = movingIn || kleben ? onWallTimer + dt : 0;
    if ((movingIn || kleben) && onWallTimer >= noetig) {
      player.state = 'climb';
      player.wallInfo = w;
      player.vel.set(0, 0, 0);
      player.jumps = 0;
      beendeGleiten();
    }
  } else onWallTimer = 0;

  /* ---- Wasser ---- */
  if (player.pos.y < WATER_Y + 1 && inWater(player.pos.x, player.pos.z)) {
    SFX.splash();
    popupScreen('💦 Platsch! Zurück ans Ufer...');
    player.pos.set(RIVER_X0 - 6, 0.1, clamp(player.pos.z, -180, 180));
    player.vel.set(0, 0, 0);
    player.hp = Math.max(1, player.hp - 5);
    player.state = 'ground';
    updateHUD();
  }
  // Spielfeldgrenzen
  player.pos.x = clamp(player.pos.x, -193, SHORE_X1 - 5);
  player.pos.z = clamp(player.pos.z, -193, 193);

  /* ---- Timer ---- */
  if (player.keinHaltCd > 0) player.keinHaltCd -= dt;
  if (player.luftKombo > 0) player.luftKombo -= dt;
  if (player.konterT > 0) {
    player.konterT -= dt;
    if (player.konterZiel && !player.konterZiel.dead && player.rollT <= 0) {
      player.facing = dampAngle(player.facing,
        Math.atan2(player.konterZiel.pos.x - player.pos.x,
                   player.konterZiel.pos.z - player.pos.z), Math.min(1, dt * 10));
    }
    if (player.konterT <= 0) player.konterZiel = null;
  }
  if (player.attackCd > 0) player.attackCd -= dt;
  if (player.attackBuffer) {
    player.attackBuffer.t -= dt;
    if (player.attackCd <= 0 && player.rollT <= 0) {
      const b = player.attackBuffer; player.attackBuffer = null; tryAttack(b.type);
    }
    else if (player.attackBuffer.t <= 0) player.attackBuffer = null;
  }
  if (player.iFrames > 0) player.iFrames -= dt;
  if (player.hurtCd > 0) player.hurtCd -= dt;
  if (player.comboTimer > 0) {
    player.comboTimer -= dt;
    if (player.comboTimer <= 0) { player.combo = 0; player.stufe = 0; player.ziel = null; updateHUD(); }
  }
  if (player.regenCd > 0) player.regenCd -= dt;
  else if (player.hp < CFG.playerHP) { player.hp = Math.min(CFG.playerHP, player.hp + dt * 4); updateHUD(); }

  /* ---- Angriff auswerten ---- */
  if (player.attack) {
    const a = player.attack;
    a.t += dt / (a.dauer || 0.34);
    /* Der Sprungangriff traf erst nach einem Drittel des langen Clips –
       da stand die Figur längst wieder am Boden. Er trifft jetzt sehr
       früh, die übrigen Schläge wie gehabt in der Mitte der Ausholphase. */
    const treffPunkt = a.art === 'luftangriff' ? 0.3 : (a.type === 'kick' ? 0.3 : 0.33);
    if (!a.hitDone && a.t > treffPunkt) { a.hitDone = true; resolveAttackHit(); }
    if (a.t >= 1) player.attack = null;
  }

  /* ---- Animation wählen ---- */
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  /* Geduckt: weich ein- und ausblenden, damit es nicht umspringt. */
  player.duckt = duckenAn();
  player.gang = gangArt();
  player.duckMisch = lerp(player.duckMisch || 0, player.duckt ? 1 : 0,
                          Math.min(1, dt * 9));
  if (player.landT > 0) player.landT -= dt;
  if (player.hartLandung > 0) player.hartLandung -= dt;
  if (player.saltoCd > 0) player.saltoCd -= dt;
  if (player.luftSalto > 0) player.luftSalto -= dt;
  if (player.warSchwung > 0) player.warSchwung -= dt;
  /* Zwischen zwei Boegen: wer schnell und hoch durch die Stadt fliegt und
     gerade KEIN neues Netz haelt, dreht ab und zu ein Kunststueck. Die
     Wahrscheinlichkeit ist auf die Sekunde gerechnet, nicht auf das Bild -
     sonst kaeme es auf einem Geraet mit 120 Bildern doppelt so oft wie auf
     einem mit 60. Ueber Kopf muss genug Platz sein, deshalb die Hoehe. */
  if (player.state === 'air' && !keys['Space'] && !swingHeld &&
      Math.hypot(player.vel.x, player.vel.z) > 15 &&
      Math.random() < 1.6 * clamp(dt, 0, 0.1)) {
    schwungKunst(24);
  }
  if (player.dreiPunktT > 0) {
    player.dreiPunktT -= dt;
    /* Bewegt man sich, bricht die Pose sofort ab – sonst klebt man fest. */
    if (Math.hypot(player.vel.x, player.vel.z) > 3.5) player.dreiPunktT = 0;
  }
  /* Rollen gehören auf den Boden. Verlässt die Figur ihn mitten in der
     Landerolle wieder – über eine Dachkante, von einem Autodach, durch
     einen Treffer –, lief die Bewegung frei schwebend weiter und sah aus
     wie ein Purzelbaum in der Luft. */
  if (!player.onGround && (player.hartLandung > 0 || player.landT > 0 || player.rollT > 0)) {
    player.hartLandung = 0; player.landT = 0; player.rollT = 0;
    if (heroVisual.brichOneShot) heroVisual.brichOneShot(0.16);
  }
  if (player.hitT > 0) player.hitT -= dt;
  /* Verliert man mitten in der Rolle den Boden (Bordstein, Kante), wird
     sie abgebrochen – sonst rollt die Figur im Fallen weiter. */
  if (player.rollT > 0 && !player.onGround && player.vel.y < -1) player.rollT = 0;
  /* Beim Spannen des Katapults stemmt sich die Figur gegen den Zug
     ("Pulling A Rope"). Vorher rannte sie dabei einfach rueckwaerts. */
  /* Beim Spannen des Katapults schaut die Figur zu den Netzen und geht
     RUECKWAERTS. Vorher lief hier eine eigene Zieh-Bewegung ("Pulling A
     Rope") ueber einer Vorwaertsbewegung - die Fuesse liefen in die
     falsche Richtung, und es sah aus, als werde die Figur einfach
     geschoben. Jetzt laeuft der normale Gang rueckwaerts ab, mit dem
     gewohnten Abgleich zwischen Schrittlaenge und echtem Tempo. */
  /* Steht die Figur beim Spannen still, soll sie auch stehen - der
     Laufschritt wuerde sonst auf der Stelle weiterlaufen. */
  /* Zaehler fuer die Hocke: still, am Boden, hoch ueber der Strasse. */
  {
    /* Hoch ueber der Strasse ODER auf einem fahrenden Dach. Auf dem Auto
       mitzufahren ist genau der Moment, in dem Spider-Man in die Hocke
       geht - vorher stand die Figur dort kerzengerade. */
    const aufFahrzeug = !!(player.platform && player.platform.mesh &&
                           Math.hypot(player.platform.vx || 0, player.platform.vz || 0) > 0.8);
    const hoch = player.pos.y - SLAB_H > 12 || aufFahrzeug;
    /* Auf dem Fahrzeug zaehlt die EIGENE Bewegung. Die des Wagens steckt
       gar nicht in player.vel - die Plattform verschiebt die Figur direkt -,
       deshalb genuegt hier das gewohnte Tempo. */
    const ruhig = player.onGround && !dir && hSpeed < 0.6 && !player.attack &&
                  player.rollT <= 0 && player.hitT <= 0 && !player.duckt &&
                  !KAT.aktiv && player.state !== 'climb' && player.state !== 'swing';
    const warHocke = (player.hockeT || 0) > 0.9;
    /* Auf dem Fahrzeug schneller in die Hocke - man faehrt ja mit. */
    player.hockeT = (hoch && ruhig)
      ? (player.hockeT || 0) + dt * (aufFahrzeug ? 3.5 : 1) : 0;
    /* Aufrichten: die Duckbewegung ab der Hockstelle nach vorn abspielen.
       Vorher wechselte die Figur in einem Bild von der Hocke in den
       Stand. */
    if (warHocke && player.hockeT === 0 && heroVisual.abOneShot &&
        heroVisual.hatClip && heroVisual.hatClip('ducken')) {
      player.aufrichtT = heroVisual.abOneShot('ducken', DUCK_STAND_T, 0.42) || 0;
    }
    if (player.aufrichtT > 0) player.aufrichtT -= dt;
  }
  /* Wer lange faellt und dabei nichts tut, breitet die Arme aus. Die
     Haltung wird GESETZT (siehe unten, poseGleiten ohne Netzhaut) - die
     Bewegung aus dem Paket zog dabei ein Bein bis vor den Kopf.
     WICHTIG: Diese Zeile muss VOR der Kette stehen und in JEDEM Bild
     laufen. Vorher stand sie im Zweig "nicht am Boden"; beim Aufsetzen
     wurde der Zweig nicht mehr betreten, das Merkmal blieb auf wahr
     stehen - und die Figur lief mit weit ausgebreiteten Armen und
     gespreizten Beinen ueber die Strasse. Genau das war der Fehler nach
     dem Doppelsprung. */
  /* Die Fallhaltung wird EIN- UND AUSGEBLENDET, nicht hart gesetzt -
     sonst verschwaende sie in dem Bild, in dem der Netzschwung beginnt,
     und die weit ausgebreiteten Arme spraengen in die Wurfhaltung.
     (Nachtrag: der grosse Ruck beim Anschwingen - 87 cm Handweg in einem
     Bild - kam NICHT von hier. Nachgemessen mit abgeschalteter
     Fallhaltung blieb er unveraendert; seine Ursache lag im Mischer,
     siehe blendeAus/blendeEin.)
     Herein kommt sie mit 3,5 je Sekunde, also in knapp drei Zehnteln. Mit
     6 war es zu schnell: direkt nach einem Kunststueck legte sie sich so
     zuegig ueber die noch auslaufende Bewegung, dass die Fussspitze in
     einem Bild um 79 Zentimeter sprang. */
  player.freiFallMisch = clamp((player.freiFallMisch || 0) +
    dt * (player.freiFall ? 3.5 : -7), 0, 1);
  player.freiFall = !player.onGround && player.state === 'air' &&
                    player.vel.y < -14 && player.luftSalto <= 0 &&
                    !player.attack && player.rollT <= 0 && !player.gleiten;

  if (KAT.aktiv) player.anim = hSpeed > 0.5 ? 'run' : 'idle';
  else if (player.rollT > 0) player.anim = 'roll';
  else if (player.hitT > 0 && player.onGround && !player.attack) player.anim = 'hit';
  else if (player.state === 'swing') {
    /* Haengt man fast bewegungslos am Faden, passt die ruhige Haenge-
       bewegung besser als der volle Schwung. */
    player.anim = (hSpeed < 2.2 && heroVisual.hatClip && heroVisual.hatClip('haengen_frei'))
      ? 'haengen_frei' : 'swing';
  }
  /* Beim Netz-Zip auf einen Gegner fliegt der Held mit dem Knie voran. */
  /* Der Zug selbst setzt seine Haltung schon oben (er kehrt vorher
     zurueck); hier bleibt nur der Rest eines abgebrochenen Zugs. */
  else if (player.state === 'zip') player.anim = 'air';
  /* Steigen und Fallen sind zwei verschiedene Bewegungen – solange es nach
     oben geht, läuft der Absprung, danach erst der freie Fall. */
  else if (player.gleiten) player.anim = player.sturzflug ? 'sturzflug' : 'gleiten';
  else if (!player.onGround) {
    player.anim = player.vel.y > 1.5 ? 'jump' : 'air';
  }
  else if (player.dreiPunktT > 0) player.anim = 'land';
  else if (player.hartLandung > 0) player.anim = 'fallrolle';
  else if (player.landT > 0) player.anim = 'land';
  /* Geduckt im Stand. Frueher lief hier die Ruhebewegung und darueber die
     selbstgebaute Hocke - und die war falsch: gemessen hob sie den
     tiefsten Fuss um gut 67 cm, die Figur sass sichtbar in der Luft, mit
     den Beinen nach vorn. Seit es die echte Duckbewegung gibt, wird die
     genommen und an einer Stelle angehalten, an der beide Fuesse stehen. */
  else if (player.duckMisch > 0.3 && hSpeed <= 0.4) {
    player.anim = (heroVisual.hatClip && heroVisual.hatClip('ducken')) ? 'duckstand' : 'idle';
  }
  /* ---- Hocke auf der Dachkante ----
     Wer hoch ueber der Strasse still steht, geht in die Hocke - die
     Haltung, in der Spider-Man ueber der Stadt sitzt. Unten in der Stadt
     bleibt es beim normalen Stehen, sonst kauerte die Figur an jeder
     Ampel. */
  else if (player.hockeT > 0.9) {
    /* Die Haltung selbst wird gesetzt (poseKauern); als Unterlage genuegt
       die ruhige Stehbewegung. */
    player.anim = 'idle';
  }
  else if (dir && hSpeed > 0.4) {
    /* Nur laufen, wenn auch wirklich eine Richtungstaste gedrückt ist –
       sonst „läuft" die Figur beim Ausrollen weiter, obwohl man steht. */
    player.anim = 'run';
    player.phase += dt * (5 + hSpeed * 1.15);
    /* Schritte im Takt der BEWEGUNGSDATEI. Die laeuft mit
       timeScale = Tempo / GANG_REF, also muss der Schrittklang genauso
       skalieren - sonst laufen Bild und Ton auseinander, und das faellt
       staerker auf als ein fehlender Schritt. 2,4 Schritte je Sekunde ist
       die Trittfrequenz der Clips bei ihrem natuerlichen Tempo. */
    const ref = GANG_REF[player.gang] || GANG_REF.run;
    player.schrittT -= dt * clamp(hSpeed / ref, 0.4, 3.0) * 2.4;
    if (player.schrittT <= 0) {
      player.schrittT = 1;
      const leise = player.duckt || player.gang === 'schleichen';
      SFX.schritt && SFX.schritt(leise ? 0.18 : clamp(hSpeed / CFG.sprintSpeed, 0.3, 1),
                                 leise);
    }
  } else player.anim = 'idle';

  if (player.anim !== 'run' && player.anim !== 'idle' && player.vel.lengthSq() > 4 && player.state !== 'climb') {
    player.facing = dampAngle(player.facing, Math.atan2(player.vel.x, player.vel.z), dt * 6);
  }

  updateHeroVisual(dt);
}

/* ======================= Ueberblendung der Sonderhaltungen =============
   Schwung, Gleitflug und Wandhaltung wurden bisher HART umgeschaltet: in
   einem Bild lag die Haltung mit vollem Gewicht auf den Knochen, im
   naechsten gar nicht mehr - die Glieder sprangen dann in einem einzigen
   Bild auf die Stelle der Bewegungsdatei zurueck.
   Gemessen (Weltlage der Knochen gegenueber der Wurzel, je Bild):
     Schwung  rechter Fuss 158 cm, linke Hand 119 cm, Kopf 28 cm
     Gleitflug linke Hand   43 cm, Fuesse      37 cm
     Klettern  linke Hand   35 cm
   158 cm in einem Sechzigstel sind 94 m/s - das ist das Zucken, das man
   sieht.
   Jetzt hat jede Haltung ein eigenes Gewicht, das ein- und ausgeblendet
   wird. Waehrend des Uebergangs werden BEIDE gerechnet: erst die
   abklingende, dann die aufkommende. Weil jede Haltung ihre Knochen nur
   anteilig verdreht (slerp mit k), ergibt das eine echte Ueberblendung.
   Die Werte der letzten Anwendung werden gemerkt, damit die abklingende
   Haltung weiterrechnen kann, obwohl der Zustand schon gewechselt hat. */
const MISCH = {
  wunsch: null,
  schwung: 0, gleiten: 0, wand: 0, wandlauf: 0,
  schwungArg: null, gleitArg: null, wandArg: null, wandlaufArg: null,
};
const MISCH_NAMEN = ['schwung', 'gleiten', 'wand', 'wandlauf'];
/* Wie weit der Setzpunkt der Figur beim Wandkriechen von der Wand weg
   liegt. Wird unten nachgemessen. */
const KRIECH_TIEFE = 0.30;
/* Eigengeschwindigkeit der Kriechbewegung AN DER WAND. Am Boden sind es
   0,85 m/s (GANG_REF), an der Fassade weniger: dort greift die Hand nach
   oben und der Koerper zieht nach, die Hand legt also je Takt weniger
   Weg zurueck. Abgetastet an der Weltgeschwindigkeit der Haende - bei
   diesem Wert steht die greifende Hand am ruhigsten. */
const KLETTER_REF = 0.62;
/* Stelle im Kriechclip (0..1), an der die Figur an der Wand ruht.
   Abgetastet: dort liegen beide Haende und beide Fuesse am dichtesten an
   der Fassade. */
const WAND_RUHE_T = 0.0;
/* 0,16 s auf, 0,22 s ab: das Aufkommen darf zuegig sein (sonst haengt die
   Haltung der Bewegung hinterher), das Abklingen braucht laenger, weil
   dort das Zucken sass. */
function mischeHaltungen(dt) {
  for (const n of MISCH_NAMEN) {
    const ziel = MISCH.wunsch === n ? 1 : 0;
    const tempo = ziel > MISCH[n] ? dt / 0.16 : dt / 0.22;
    MISCH[n] = ziel > MISCH[n] ? Math.min(ziel, MISCH[n] + tempo)
                               : Math.max(ziel, MISCH[n] - tempo);
  }
  /* Abklingende zuerst, aufkommende zuletzt - so gewinnt am Ende die
     neue Haltung, ohne dass zwischendurch etwas springt. */
  const reihe = MISCH_NAMEN.filter((n) => MISCH[n] > 0.002)
    .sort((a, b) => (a === MISCH.wunsch ? 1 : 0) - (b === MISCH.wunsch ? 1 : 0));
  for (const n of reihe) {
    const g = MISCH[n];
    if (n === 'schwung' && MISCH.schwungArg) {
      const a = MISCH.schwungArg;
      heroVisual.poseSchwung(a[0], a[1], a[2], a[3], a[4], a[5], g);
    } else if (n === 'gleiten' && MISCH.gleitArg && heroVisual.poseGleiten) {
      const a = MISCH.gleitArg;
      heroVisual.poseGleiten(a[0], a[1], a[2], a[3] * g);
    } else if (n === 'wand' && MISCH.wandArg && heroVisual.poseWandkriechen) {
      const a = MISCH.wandArg;
      heroVisual.poseWandkriechen(a[0], a[1], a[2], a[3] * g);
    } else if (n === 'wandlauf' && MISCH.wandlaufArg && heroVisual.poseWandlauf) {
      const a = MISCH.wandlaufArg;
      heroVisual.poseWandlauf(a[0], a[1], a[2], a[3] * g);
    }
  }
}

function updateHeroVisual(dt) {
  if (!heroVisual) return;
  const r = heroVisual.root;
  r.position.copy(player.pos);
  /* Die Blickrichtung wurde HART gesetzt. Im Schwung dreht sie sich mit
     der Flugrichtung, und die springt am Anker- und Zustandswechsel -
     gemessen 24,2 Grad in einem einzigen Bild. Jetzt wird nachgezogen:
     am Boden fast sofort (das Lenken soll knackig bleiben), in der Luft
     und am Netz gedaempft. */
  {
    /* Am Eck herum darf sich die Figur ruhig Zeit lassen - 30 je Sekunde
       liessen die 90 Grad in zwei Bildern umklappen. */
    const schnell = player.eckT > 0 ? 7
                  : player.onGround || player.state === 'climb' ? 30 : 11;
    r.rotation.y = dampAngle(r.rotation.y, player.facing, Math.min(1, dt * schnell));
  }
  /* ---- In die Kurve legen ----
     Am Netz und im Gleitflug legt sich die Figur in die Kurve, so wie ein
     Radfahrer. Ohne das dreht sie sich in der Kurve wie eine Statue auf
     einem Drehteller - die Bewegung war nicht abzulesen. Gerollt wird um
     die eigene Laengsachse; bei der Reihenfolge XYZ steht rotation.z im
     Modellsystem, wird also VOR der Blickrichtung angewandt. */
  {
    const kurve = player.state === 'swing' ? (player.kurveGlatt || 0)
                : player.gleiten ? (player.gleitKurve || 0) : 0;
    const ziel = clamp(kurve, -1, 1) * (player.gleiten ? 0.62 : 0.48);
    player.neigung = lerp(player.neigung || 0, ziel, Math.min(1, dt * 5));
    r.rotation.z = Math.abs(player.neigung) < 0.004 ? 0 : player.neigung;
  }
  /* Die Lage im Netzbogen kommt aus der Steiggeschwindigkeit und kippt am
     Tiefpunkt binnen weniger Bilder von -1 auf +1. Sie wird EINMAL
     geglaettet und dann ueberall benutzt - sowohl fuer die Stelle im Clip
     als auch fuer die Beinhaltung. Vorher bekam die Beinhaltung den rohen
     Wert und die Knie sprangen im Takt der Zuckungen. */
  {
    const roh = clamp(player.vel.y * 0.09, -1, 1);
    if (player.state !== 'swing') player.bogenGlatt = roh;
    else player.bogenGlatt = lerp(player.bogenGlatt === undefined ? roh : player.bogenGlatt,
                                  roh, Math.min(1, dt * 2.6));
  }
  MISCH.wunsch = null;

  /* Beim Klettern lehnt der Körper leicht zur Wand – das liest sich sofort
     als Kleben statt als Hochlaufen. */
  if (player.state === 'climb') {
    /* ---- Wandlauf ----
       Der zweite Versuch, den Koerper waagerecht an die Fassade zu kippen,
       war ein Fehlgriff: gemessen stand der Kopf danach fast einen Meter
       von der Wand ab, Kopf und Fuesse lagen auf derselben Hoehe, und der
       rechte Fuss steckte in der Fassade. Aus der Seitenansicht sah das aus
       wie ein Hechtsprung ins Haus.
       Jetzt bleibt der Koerper aufrecht an der Wand - wie beim Klettern -
       und der Unterschied steckt in der Bewegung: lange Schritte die Wand
       hinauf, Arme greifen abwechselnd hoch. Das liest sich als Rennen,
       nicht als Kriechen. */
    /* Beim Wandkriechen steckt die ganze Neigung in der Kippung der
       inneren Gruppe - der Wurzelknoten bleibt aufrecht, sonst kaeme die
       Weltdrehung um x noch einmal obendrauf. */
    const zielX = player.wandKriechen ? 0 : player.wandlauf ? 0.05 : 0.13;
    r.rotation.x = lerp(r.rotation.x, zielX, Math.min(1, dt * (player.wandlauf ? 8 : 10)));
    /* Die Seitenneigung MUSS hier zurueckgenommen werden. Sie fehlte, und
       genau das war das schiefe Kleben an der Fassade: aus dem Gleitflug
       (bis 0,5 rad Kurvenlage) oder aus dem Netzschwung kam die Figur mit
       stehengebliebener Rollung an die Wand und klebte dort um bis zu
       30 Grad verdreht - sah aus wie ein Fehler in der Kollision, war aber
       nur eine nie geloeschte Drehung. */
    r.rotation.z = lerp(r.rotation.z, 0, Math.min(1, dt * 9));
  } else
  /* Ausweichen: schneller Satz mit Vorlage – bewusst OHNE Überschlag.
     Die frühere Rolle drehte den Körper um die Füße, dadurch verschwand die
     Figur im Boden und tauchte anschließend von oben wieder auf. */
  if (player.rollT > 0) {
    player.rollT -= dt;
    /* Die Ausweichrolle kommt jetzt aus der Animation. Eine zusätzliche
       Drehung der ganzen Figur hat sie früher unter den Boden gezogen. */
    r.rotation.x = lerp(r.rotation.x, 0, Math.min(1, dt * 18));
  } else {
    // Körperneigung beim Schwingen/Fallen
    let tilt = 0;
    if (player.state === 'swing' && player.swing) {
      /* Beim Schwingen hing die Figur senkrecht unter dem Netz und lehnte
         sich sogar leicht nach HINTEN – die Beine liefen also voraus. Im
         Vorbild fliegt der Kopf voran und die Beine hängen hinterher, je
         schneller desto flacher. Genau das ist der Unterschied zwischen
         "hängt an einem Faden" und "schwingt". */
      const hs = Math.hypot(player.vel.x, player.vel.z);
      /* Deutlich flacher als vorher: im Vorbild fliegt Spider-Man am Netz
         nahezu waagerecht, Kopf voran. Mit 0,3 als Untergrenze hing er
         auch im schnellen Bogen noch fast senkrecht am Faden. */
      tilt = clamp(0.62 + hs * 0.042, 0.62, 1.32);
      /* Ankerwechsel: der Netzarm zielt auf den neuen Anker, und der liegt
         beim naechsten Netz ganz woanders - gemessen sprang die Hand dabei
         bis zu 1,1 m in EINEM Bild. Die Haltung auszublenden hilft nicht
         (dann springt sie beim Wiederaufbau), also wandert stattdessen ein
         gemerkter Zielpunkt in 0,25 s zum neuen Anker hinueber. */
      if (!MISCH.ankerGlatt) MISCH.ankerGlatt = player.swing.anchor.clone();
      if (MISCH.letzterAnker !== player.swing) {
        MISCH.letzterAnker = player.swing;
        /* Beim allerersten Netz sofort setzen, sonst zeigt der Arm noch
           dorthin, wo gar kein Anker mehr ist. */
        if (MISCH.schwung < 0.05) MISCH.ankerGlatt.copy(player.swing.anchor);
      }
      MISCH.ankerGlatt.lerp(player.swing.anchor, Math.min(1, dt * 4));
      // Kurvenlage: seitlich in den Bogen legen
      const a = player.swing.anchor;
      const rx = Math.cos(player.facing), rz = -Math.sin(player.facing);
      const seit = (a.x - player.pos.x) * rx + (a.z - player.pos.z) * rz;
      r.rotation.z = lerp(r.rotation.z, clamp(-seit * 0.07, -0.5, 0.5), Math.min(1, dt * 5));
    } else if (player.gleiten) {
      if (player.sturzflug) {
        /* Der Sturzflug-Clip ("StraightDive") liegt schon flach auf dem
           Bauch, Kopf voraus - die Drehung steckt in der Bewegungsdatei.
           Hier kommt nur noch der Anstellwinkel dazu: wie steil es
           tatsaechlich nach unten geht. Die 0,62 aus dem Gleitflug
           obendrauf haetten die Figur um 35 Grad ueberdreht. */
        const hs = Math.hypot(player.vel.x, player.vel.z);
        tilt = clamp(Math.atan2(Math.max(0, -player.vel.y), Math.max(2, hs)), 0, 1.15);
      } else
      /* Im Gleitflug liegt der Körper flach in der Luft, Kopf voran – wie
         im Wingsuit.
         0,62 rad sind aber nur 35 Grad: die Figur hing schraeg im Raum,
         mehr stehend als liegend, und genau so sah es aus - "wie ein Stock
         in der Luft". Der Rumpf gehoert bei neutraler Nase auf gut 70 Grad
         und legt sich mit gedrueckter Nase noch weiter nach vorn.
         Nach oben gezogen richtet er sich auf, so wie ein Gleiter, der
         abfaengt. */
      tilt = (1.24 + (player.gleitNase || 0) * 0.30) * clamp(player.gleitMisch || 0, 0, 1);
      r.rotation.z = lerp(r.rotation.z, clamp(-(player.gleitKurve || 0) * 0.5, -0.5, 0.5),
                          Math.min(1, dt * 5));
    } else if (player.onGround) {
      /* ---- Laufgefühl ----
         Die Figur lief bisher kerzengerade und ohne jede Reaktion auf
         Beschleunigen, Bremsen oder Kurven – das war der Hauptgrund, warum
         das Laufen wie Abspielen aussah statt wie Bewegung.
         Jetzt lehnt sie sich beim Anlaufen nach vorn, richtet sich beim
         Bremsen auf und legt sich in die Kurve wie ein Radfahrer. */
      const hs = Math.hypot(player.vel.x, player.vel.z);
      const vor = _v1.set(Math.sin(player.facing), 0, Math.cos(player.facing));
      const quer = _v2.set(vor.z, 0, -vor.x);
      const bx = (player.vel.x - (player.altVelX || 0)) / Math.max(0.0001, dt);
      const bz = (player.vel.z - (player.altVelZ || 0)) / Math.max(0.0001, dt);
      /* Beschleunigung in Lauf- und Querrichtung. */
      const laengs = clamp((bx * vor.x + bz * vor.z) / 30, -1, 1);
      const seitlich = clamp((bx * quer.x + bz * quer.z) / 30, -1, 1);
      player.neigVor = lerp(player.neigVor || 0, laengs, Math.min(1, dt * 5));
      player.neigSeit = lerp(player.neigSeit || 0, seitlich, Math.min(1, dt * 5));
      /* Grundvorlage nach Tempo, dazu der Anteil aus der Beschleunigung. */
      tilt = clamp(hs * 0.016 + player.neigVor * 0.22, -0.12, 0.34);
      r.rotation.z = lerp(r.rotation.z, clamp(-player.neigSeit * 0.3, -0.3, 0.3),
                          Math.min(1, dt * 6));
    } else {
      /* Im Salto dreht die Bewegungsdatei den ganzen Koerper. Die
         Flugneigung wuerde sich dann dazuaddieren und den Ueberschlag
         schief kippen - deshalb hier neutral. */
      if (player.state === 'air' && player.luftSalto <= 0) {
        tilt = clamp(-player.vel.y * 0.015, -0.25, 0.3);
      }
      if (r.rotation.z !== 0) r.rotation.z = lerp(r.rotation.z, 0, Math.min(1, dt * 8));
    }
    /* Im Salto zaeher Uebergang gemessen: aus dem Schwung heraus stand die
       Figur noch bei fast einem Radiant Vorlage, und die ersten 0,4 s des
       Ueberschlags drehten sich schief mit. Deshalb wird die Neigung hier
       deutlich schneller auf null gezogen. */
    const wieSchnell = player.luftSalto > 0 ? 26 : 8;
    r.rotation.x = lerp(r.rotation.x, tilt, Math.min(1, dt * wieSchnell));
    if (player.luftSalto > 0 && r.rotation.z !== 0) {
      r.rotation.z = lerp(r.rotation.z, 0, Math.min(1, dt * wieSchnell));
    }
  }

  if (player.state !== 'climb' && heroVisual.versatzAus) {
    heroVisual.versatzAus(Math.min(1, dt * 8));
  }
  /* Wandkriechen: an einer echten Hauswand, nicht beim Wandlauf und nicht
     beim ruhigen Haengen. Braucht die Kriechbewegung. */
  /* An der Wand gibt es zwei Bewegungen, und beide werden mit DERSELBEN
     Kippung gefahren - genau wie am Boden Laufen und Kriechen dieselbe
     Schwerkraft haben:
       'kriechen' - das normale Hochklettern,
       'lauf'     - der Anlauf mit Schwung, also Rennen die Wand hinauf.
     Vorher hatte der Wandlauf eine von Hand gesetzte Haltung
     (poseWandlauf). Die sah nach Klettern aus, nicht nach Rennen. */
  const anWand = player.state === 'climb' && !!player.wallInfo &&
                 player.anim !== 'haengen' && !!heroVisual.wandKriechen;
  player.wandModus = !anWand ? null
    : player.wandlauf && heroVisual.hatClip && heroVisual.hatClip('run') ? 'lauf'
    : heroVisual.hatClip && heroVisual.hatClip('kriechen') ? 'kriechen' : null;
  player.wandKriechen = !!player.wandModus;
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  heroVisual.play(player.anim, {
    wandKriechen: player.wandKriechen,
    /* Geht die Figur rueckwaerts (Katapult spannen)? Dann laeuft die
       Gangart rueckwaerts ab - sonst rudern die Beine vorwaerts, waehrend
       der Koerper nach hinten faehrt. */
    rueckwaerts: !!KAT.aktiv,
    wandModus: player.wandModus,
    /* Geht es die Wand hinunter? Dafuer gibt es eine eigene Bewegung -
       kopfueber die Fassade herablaufen sieht anders aus als hinauf. */
    wandAb: player.wandAb,
    phase: player.phase,
    speed01: clamp(hSpeed / CFG.sprintSpeed, 0, 1),
    speed: hSpeed,
    tempo: player.klettertempo,
    t: elapsed,
    hand: player.swing ? player.swing.hand : netzHand,
    ducken: player.duckt,
    gang: player.gang,
    symbiont: player.symAn,
    /* Lage im Bogen: 0 = Tiefpunkt, 1 = Aufstieg. Steuert, an welcher
       Stelle die Schwunghaltung festgehalten wird. Schon geglaettet. */
    bogen: player.bogenGlatt === undefined ? 0 : player.bogenGlatt,
  }, dt);

  if (heroVisual.procedural) {
    overlayAttack(heroVisual.human, player.attack, dt);
  } else {
    /* Pose-Korrekturen für das Menschmodell (nach der Animation) */
    if (player.attack && player.attack.type !== 'web') {
      /* Die geladene Schlag-Animation führt allein – eigene Knochenposen
         haben hier wiederholt für schiefe Haltungen gesorgt. */
      heroVisual.bodenAusgleich(1);
    } else if (player.state === 'swing' && player.swing) {
      /* Beim Pumpen greift die zweite Hand mit an den Faden. */
      /* Beide Hände beim Pumpen UND im Absinken – dort zieht man sich am
         Faden hoch, genau wie im Vorbild. Vorher nur beim Pumpen, deshalb
         sah man die zweite Hand im normalen Schwung fast nie. */
      const beideHaende = !!(keys['KeyW'] || keys['ArrowUp'] || (stick.z || 0) > 0.4 ||
                             player.vel.y < -2);
      player.beideAmFaden = beideHaende;
      /* Kommt man aus dem freien Fall in den Bogen, laeuft die Fallhaltung
         hier noch kurz aus - sonst springt sie in einem Bild weg. */
      if (player.freiFallMisch > 0.02 && heroVisual.poseGleiten) {
        heroVisual.poseGleiten(0, 0, elapsed, 0.85 * player.freiFallMisch);
      }
      /* ---- Der Start des Bogens ----
         In den ersten Zehnteln laeuft der Netzwurf: der Arm holt aus und
         schiesst den Faden. Gleichzeitig legte sich bisher schon die
         Schwunghaltung darueber und griff nach denselben Armen - und die
         Beine bekamen aus der Laufbewegung, dem Wurf UND der Schwunghaltung
         drei verschiedene Vorgaben auf einmal. Genau das war das Zappeln
         beim Anschwingen.
         Solange der Wurf laeuft, fuehrt er allein; die Schwunghaltung
         blendet sich danach ueber ihre eigene Blende ein. */
      if (player.wurfT > 0) { player.wurfT -= dt; }
      else MISCH.wunsch = 'schwung';
      MISCH.schwungArg = [(MISCH.ankerGlatt || player.swing.anchor).clone(),
                          player.swing.hand, elapsed,
                          player.bogenGlatt, r.rotation.x, beideHaende];
    } else if (player.hockeT > 0.9 && heroVisual.poseKauern) {
      /* Auf der Dachkante wird die Hocke GESETZT, nicht abgespielt. Keine
         Bewegung aus dem Paket gibt diese Haltung her. */
      heroVisual.poseKauern(clamp((player.hockeT - 0.9) * 4, 0, 1));
      if (heroVisual.hockeAusgleich) heroVisual.hockeAusgleich(Math.min(1, dt * 14));
      else heroVisual.bodenAusgleich(Math.min(1, dt * 14));
    } else if (player.dreiPunktT > 0) {
      /* Ein- und wieder ausblenden, damit die Pose nicht umspringt. */
      const p = player.dreiPunktT / 0.62;
      heroVisual.poseDreiPunkt(clamp(Math.min(1, (1 - p) * 6) * Math.min(1, p * 3.2), 0, 1),
                               player.dreiPunktSeite || 'R');
      /* Kräftig nachführen, damit Fuß und Faust wirklich aufsetzen. */
      heroVisual.bodenAusgleich(Math.min(1, dt * 16));
    } else if (player.freiFallMisch > 0.02 && heroVisual.poseGleiten) {
      /* Arme weit zur Seite, Beine leicht gespreizt - dieselbe Haltung wie
         im Gleitflug, nur ohne Netzhaut (die haengt an player.gleiten). */
      heroVisual.poseGleiten(0, 0, elapsed, 0.85 * player.freiFallMisch);
    } else if (player.gleiten && player.luftSalto <= 0 && !player.sturzflug) {
      /* Im Sturzflug fuehrt die Bewegungsdatei allein - die Gleithaltung
         wuerde ihr die Arme wieder zur Seite reissen. */
      MISCH.wunsch = 'gleiten';
      MISCH.gleitArg = [player.gleitNase || 0, player.gleitKurve || 0, elapsed,
                        0.9 * clamp(player.gleitMisch || 0, 0, 1)];
    } else if (player.state === 'kante') {
      /* Der Kantenzug führt allein – hier keine eigene Pose dazwischen. */
    } else if (player.state === 'climb') {
      /* Die geladene Bewegung liefert den Rhythmus, die Wandpose setzt
         Hände und Füße wirklich an die Wand. */
      const w = player.wallInfo;
      /* Beim Wandlauf führt die Bewegung allein – die Spinnenpose würde
         die laufenden Beine überschreiben. */
      if (w && player.wandKriechen && heroVisual.wandKriechen) {
        /* Die Bewegungsdatei fuehrt allein - keine gesetzten Gliedmassen
           mehr. wandFreiraum() haelt am Ende alles aus der Fassade.
           Fuer beide Bewegungen derselbe Abstand: ein groesserer Wert fuer
           den Lauf hat die Figur ins Haus geschoben (gemessen 95 cm hinter
           der Fassade), und herausgedrueckt wird sie ohnehin von
           wandFreiraum(). */
        /* Wohin geht es an der Fassade? Die Geschwindigkeit wird in die
           beiden Richtungen der Wandebene zerlegt:
             hoch   = nach oben (Welt-Y),
             quer   = an der Wand entlang (senkrecht zur Normalen).
           Daraus ergibt sich der Winkel, um den die Figur um die
           Wandnormale gerollt werden muss, damit ihr Kopf in die
           Laufrichtung zeigt. Steht sie still, geht die Rolle sanft auf
           null zurueck - dann haengt sie wieder aufrecht.
           Hergeleitet: der Koerper zeigt nach der Kippung um -90 Grad in
           Richtung (sin(phi)*nz, cos(phi), -sin(phi)*nx). Sein Anteil
           laengs der Wand ist -sin(phi), der nach oben cos(phi) - also
           phi = atan2(-quer, hoch). */
        const vq = -player.vel.x * w.nz + player.vel.z * w.nx;
        const vh = player.vel.y;
        const tempo = Math.hypot(vq, vh);
        /* Erst ab einem spuerbaren Tempo drehen. Sonst zappelt die Figur
           im Stand um jede kleine Restbewegung. */
        const wunsch = tempo > 0.9 ? Math.atan2(-vq, vh) : 0;
        player.wandRoll = wunsch;
        heroVisual.wandKriechen(1, KRIECH_TIEFE, wunsch);
        /* Im Stillstand die Klebehaltung darueberlegen. Sie blendet ein
           und aus, damit der Uebergang zur Kriechbewegung weich ist. */
        player.wandRuhe = clamp((player.wandRuhe || 0) +
          dt * (player.wandStill ? 5 : -8), 0, 1);
        if (player.wandRuhe > 0.02 && heroVisual.poseWandhalt) {
          heroVisual.poseWandhalt(w.nx, w.nz, player.wandRuhe);
        }
      } else if (w && heroVisual.poseWandkriechen && !player.wandlauf) {
        MISCH.wunsch = 'wand';
        MISCH.wandArg = [w.nx, w.nz, player.phase, player.anim === 'haengen' ? 0.2 : 0.72];
      } else if (w && player.wandlauf && heroVisual.poseWandlauf) {
        MISCH.wunsch = 'wandlauf';
        MISCH.wandlaufArg = [w.nx, w.nz, player.phase, 0.9];
      }
      else if (!heroVisual.hatClip('climb')) heroVisual.poseKlettern(player.phase);
    } else if (player.state === 'zip' && player.zip) {
      heroVisual.poseSchuss(player.zip.target, player.zip.hand, 1);
    } else if (player.schussT > 0) {
      player.schussT -= dt;
      heroVisual.poseSchuss(player.schussZiel, netzHand, 1);
    } else if (player.dead) {
      heroVisual.legeHin(Math.min(1, dt * 6));
    } else if (player.onGround) {
      /* Beim Laufen darf der Ausgleich nur ganz sacht nachziehen, sonst
         hüpft der Körper im Schritttakt mit. Im Stand darf er zügiger sein. */
      /* Beim Laufen ganz sacht (sonst hüpft der Körper im Schritttakt),
         beim Landen zügig, damit die Füße sofort aufsetzen. */
      /* Beim Kriechen zuegig nachfuehren: dort ist der Unterschied zur
         Ruhehaltung gross, und mit 0,6 je Sekunde braeuchte der Ausgleich
         mehrere Sekunden - so lange schwebt die Figur sichtbar. */
      const zaeh = (player.gang === 'kriechen' || player.duckt) ? 9
                 : (player.anim === 'run' || player.anim === 'walk') ? 0.6
                 : (player.anim === 'land' || player.anim === 'roll') ? 12 : 5;
      heroVisual.bodenAusgleich(Math.min(0.35, dt * zaeh));
      /* Danach jedes Bein einzeln auf den Boden UNTER DIESEM FUSS setzen –
         Bordstein, Treppe, Autodach. Beim Angriff und in der Rolle nicht,
         dort führt die Bewegung. */
      if (heroVisual.fussIK && !player.attack && player.rollT <= 0 &&
          player.dreiPunktT <= 0 && !window.__IK_AUS) {
        heroVisual.fussIK(bodenHoeheFuerFuss, 0.85,
                          Math.sin(player.facing), Math.cos(player.facing));
      }
      if (heroVisual.kopfStabil) heroVisual.kopfStabil(r.rotation.x, 0.55);
      /* Geduckt zum Schluss: die Pose muss über der Laufbewegung liegen.
         Seit es echte Duck- und Schleichbewegungen gibt, wird sie nur noch
         im STAND gebraucht - beim Gehen fuehrt die Datei, und die
         selbstgebaute Haltung wuerde nur dagegen arbeiten. */
      /* Mit echter Duckbewegung wird die selbstgebaute Hocke gar nicht
         mehr gebraucht - im Gehen fuehrt der Duckgang, im Stand die
         angehaltene Duckbewegung. Sie bleibt nur als Rueckfall, wenn die
         Datei fehlt. */
      const duckClip = heroVisual.hatClip && heroVisual.hatClip('ducken');
      const duckStaerke = duckClip ? 0 : 1;
      if (player.duckMisch > 0.02 && duckStaerke > 0.02 && heroVisual.poseDucken) {
        heroVisual.poseDucken(clamp(player.duckMisch, 0, 1) * duckStaerke,
                              clamp(hSpeed / CFG.duckSpeed, 0, 1));
      }
    }
  }

  /* Sonderhaltungen ueberblenden. Das ersetzt das frueher harte
     Umschalten UND das gesonderte Nachgleiten - der Mischer laesst jede
     Haltung von allein ausklingen, auch die Gleithaltung. */
  if (!heroVisual.procedural) mischeHaltungen(dt);

  /* Für die Neigung im nächsten Bild. */
  player.altVelX = player.vel.x; player.altVelZ = player.vel.z;

  updateNetzFluegel(dt);

  /* Netzfaden ganz zum Schluss setzen – erst jetzt steht die Hand wirklich
     dort, wo sie im Bild zu sehen ist. Vorher hing der Faden ein Bild
     hinterher und schnitt durch den Körper. */
  if (player.fadenZiel) {
    heroVisual.root.updateMatrixWorld(true);
    heroHandPos(_v3, player.fadenHand);
    /* Greifen beide Hände zu, beginnt der Faden zwischen ihnen. Die freie
       Hand zielt zwar zum Anker, kommt bei Armlänge aber nicht exakt auf
       die Linie – der Faden lief deshalb sichtbar an ihr vorbei und es sah
       weiter nach einer Hand am Netz aus. */
    if (player.beideAmFaden) {
      const frei = heroHandPos(_v2, player.fadenHand === 'L' ? 'R' : 'L');
      if (frei) _v3.lerp(frei, 0.5);
    }
    /* Beim Schwingen hängt das Seil unter Last leicht durch, beim Netz-Zip
       ist es straff gespannt. */
    placeStrand(swingStrand, _v3, player.fadenZiel,
                player.state === 'swing' ? 0.014 : 0.004);
    player.fadenZiel = null;
  }

  /* Ganz zum Schluss: nachmessen, ob etwas in der Fassade steckt. */
  wandFreiraum(dt);

  /* ---- Weicher Eckenwechsel an der Hauswand ----
     Beim Wechsel um eine Hausecke aendert sich in EINEM Bild alles auf
     einmal: die Wandnormale klappt um 90 Grad, die Figur wird auf die
     neue Seite gesetzt, und wandFreiraum() rechnet die Figur - die noch
     zur alten Wand steht - als tief in der neuen Fassade steckend und
     schiebt sie weit heraus. Gemessen sprang das Bild dabei um 2,4 Meter,
     waehrend die Physik nur 0,5 Meter weiterging. Das war das
     "Hinueberspringen".
     Statt jede einzelne Quelle zu entschaerfen, wird hier die FERTIGE
     Bildlage nachgezogen: waehrend der Ecke folgt der Koerper seiner
     Sollstelle gedaempft, danach sitzt er wieder genau darauf. Die Physik
     bleibt unangetastet - man kann also weiterhin nichts verfehlen. */
  if (!player.sichtPos) player.sichtPos = new THREE.Vector3().copy(r.position);
  if (player.eckT > 0) player.eckT -= dt;
  /* Reisst der Abstand doch einmal weit auf (Sturz, Umsetzen, Wiederbeleben),
     lieber hart nachsetzen als hinterherschweben. */
  if (player.sichtPos.distanceToSquared(r.position) > 9) {
    player.sichtPos.copy(r.position);
  } else {
    /* Waehrend der Ecke gedaempft, sonst praktisch sofort. Ein harter
       Schnitt am Ende der Ecke hat den Rest in einem Bild nachgeholt -
       gemessen noch einmal 47 cm. Deshalb laeuft die Daempfung durch und
       wird nur schneller. */
    const rate = player.eckT > 0 ? 7 : 45;
    player.sichtPos.lerp(r.position, Math.min(1, dt * rate));
    /* Der gedaempfte Punkt darf NIE im Haus liegen. Eine gerade Strecke
       zwischen zwei Punkten an zwei verschiedenen Seiten eines Hauses
       fuehrt durch die Ecke hindurch - man lief also sichtbar durch die
       Wand, statt aussen herumzuklettern. Deshalb wird der Punkt hier auf
       die naechstgelegene Aussenseite geschoben; damit folgt er der
       Fassade um die Ecke. */
    const hk = player.wallInfo && player.wallInfo.col;
    if (hk) {
      const m = CFG.climbGap;
      const p2 = player.sichtPos;
      if (p2.x > hk.x0 - m && p2.x < hk.x1 + m &&
          p2.z > hk.z0 - m && p2.z < hk.z1 + m) {
        const dx0 = p2.x - (hk.x0 - m), dx1 = (hk.x1 + m) - p2.x;
        const dz0 = p2.z - (hk.z0 - m), dz1 = (hk.z1 + m) - p2.z;
        const kl = Math.min(dx0, dx1, dz0, dz1);
        if (kl === dx0) p2.x = hk.x0 - m;
        else if (kl === dx1) p2.x = hk.x1 + m;
        else if (kl === dz0) p2.z = hk.z0 - m;
        else p2.z = hk.z1 + m;
      }
    }
    r.position.copy(player.sichtPos);
    r.updateMatrixWorld(true);
  }
}

/* ---- Nichts darf in der Wand stecken ----
   Beim Wandlauf schwingt das hintere Bein durch die Fassade: gemessen
   steckte der rechte Fuss 2,6 cm und die rechte Zehe 12 cm tief drin, und
   genau das sah aus, als waere der Fuss abgeschnitten. Statt jede Pose
   einzeln nachzujustieren wird hier am Ende gemessen und die ganze Figur so
   weit herausgeschoben, dass ueberall Luft bleibt. Wirkt fuer Klettern und
   Wandlauf gleichermassen. */
const WAND_KNOCHEN = ['leftfoot', 'rightfoot', 'lefttoebase', 'righttoebase',
                      'leftleg', 'rightleg', 'lefthand', 'righthand',
                      'leftforearm', 'rightforearm', 'head', 'hips'];
const WAND_LUFT = 0.07;          // Haut ist rund 5 cm dick
const _wk = V3(0, 0, 0);
const _wl = new THREE.Vector3();
let dtWand = 1 / 60;
function wandFreiraum(dt) {
  dtWand = dt === undefined ? 1 / 60 : dt;
  /* Nicht an der Wand: die Korrektur sanft ausblenden, damit sie beim
     Loslassen nicht als Ruck stehen bleibt. */
  if (player.state !== 'climb' || !player.wallInfo) {
    if (player.wandLuft && player.wandLuft.lengthSq() > 1e-8) {
      player.wandLuft.multiplyScalar(Math.pow(0.02, clamp(dtWand, 0, 0.1) / 0.15));
    }
    return;
  }
  const kn = heroVisual && heroVisual.knochen;
  if (!kn) return;
  const w = player.wallInfo, c = w.col;
  if (!c) return;
  const r = heroVisual.root;
  r.updateMatrixWorld(true);
  const flaeche = w.nx !== 0 ? (w.nx > 0 ? c.x1 : c.x0)
                             : (w.nz > 0 ? c.z1 : c.z0);
  let min = Infinity;
  for (const n of WAND_KNOCHEN) {
    const b = kn[n];
    if (!b) continue;
    b.getWorldPosition(_wk);
    const d = w.nx !== 0 ? (_wk.x - flaeche) * w.nx : (_wk.z - flaeche) * w.nz;
    if (d < min) min = d;
  }
  /* Sehr grosse Abweichungen ignorieren: dann steht die Figur gar nicht an
     dieser Wand und das Verschieben waere ein Sprung.
     Die Grenze lag bei -1,5 m. Beim Wandlauf mit der gekippten
     Laufbewegung steckte die Figur gemessen 0,5 bis 1,8 m in der Fassade -
     die Korrektur stieg dann aus und man sah gar nichts mehr. Mit -3,0
     greift sie auch dort; weiter entfernt ist es wirklich eine andere
     Wand. */
  /* Die Korrektur wird WEICH nachgezogen, nicht hart gesetzt. Grund: am
     Eck wechselt die Wandnormale in einem Bild um 90 Grad. Der Koerper
     steht in diesem Bild aber noch zur alten Wand (die Blickrichtung
     zieht ueber mehrere Bilder nach), also steckt er nach der neuen
     Rechnung tief in der Fassade - und wurde entsprechend weit
     herausgeschoben. Gemessen sprang das Bild dabei um 2,4 bis 2,6 Meter,
     waehrend die Physik nur 0,5 Meter weiterging. Genau das sah aus, als
     "springe" die Figur um die Ecke, statt herumzuklettern. */
  const ziel = (min >= WAND_LUFT || min < -3.0) ? 0 : (WAND_LUFT - min);
  if (!player.wandLuft) player.wandLuft = new THREE.Vector3();
  _wl.set(w.nx * ziel, 0, w.nz * ziel);
  player.wandLuft.lerp(_wl, Math.min(1, dtWand * 14));
  if (player.wandLuft.lengthSq() < 1e-8) player.wandLuft.set(0, 0, 0);
  r.position.add(player.wandLuft);
  r.updateMatrixWorld(true);
  /* Und jetzt jedes Glied einzeln auf die Fassade. Waehrend eines
     Eckenwechsels nicht - dort stimmt die Wandebene fuer ein paar Bilder
     noch gar nicht zum Koerper. */
  if (heroVisual.wandGriff && player.eckT <= 0) {
    heroVisual.wandGriff(w.nx, w.nz, flaeche, 0.9);
    r.updateMatrixWorld(true);
  }
}

/* ======================= Netz-Katapult =======================
   Zwei Netze nach hinten, spannen, loslassen – und die Figur wird wie aus
   einer Schleuder nach vorn geschossen. Auf einem Dach ist das der schnelle
   Weg zum nächsten Häuserblock, ohne erst einen Bogen aufbauen zu müssen.
   Taste V (Gamepad: Y), gedrückt halten zum Spannen. */
const KAT = { aktiv: false, ladung: 0, anker: [null, null], strang: [null, null],
  seite: ['R', 'L'],
              zeichen: [null, null], start: null, rx: 0, rz: 0 };
/* Gespannt wird nicht mehr ueber die Zeit, sondern ueber den WEG: die
   beiden Netze kleben vor der Figur, und je weiter man rueckwaerts geht,
   desto straffer werden sie - wie bei einer Schleuder, in die man sich
   hineinlehnt. Vorher lief einfach eine Sekunde ab, egal was man tat;
   deshalb hatte das Spannen ueberhaupt kein Gefuehl. */
const KAT_ZUG = 5.0;              // Meter Rueckweg bis zur vollen Spannung

function katapultStrang(i) {
  if (!KAT.strang[i]) {
    KAT.strang[i] = makeWebStrand();
    KAT.strang[i].visible = false;
  }
  return KAT.strang[i];
}

/* Sichtbarer Klebepunkt an der Fassade - ohne ihn sieht man nicht, WORAN
   das Netz haengt, und das Katapult wirkt wie Zauberei. */
function katapultZeichen(i) {
  if (!KAT.zeichen[i]) {
    const g = new THREE.SphereGeometry(0.34, 10, 8);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0xdfefff, transparent: true, opacity: 0.85, depthWrite: false }));
    m.renderOrder = 4;
    m.visible = false;
    scene.add(m);
    KAT.zeichen[i] = m;
  }
  return KAT.zeichen[i];
}

/* Zwei Ankerpunkte schräg VOR der Figur suchen - dorthin geht auch der
   Flug. Frueher klebten die Netze hinter dem Ruecken; man wurde dann in
   die Gegenrichtung geschleudert und sah beim Spannen nichts davon. */
function katapultAnker() {
  /* Gesucht wird in BLICKRICHTUNG, nicht in Laufrichtung: wohin man
     schaut, dorthin fliegt man auch. Beim Zurueckgehen dreht sich die
     Figur naemlich um - mit player.facing haetten die Netze mitten im
     Spannen die Seite gewechselt. */
  const f = camForward();
  const hinten = _v1.set(f.x, 0, f.z);
  const rechts = _v2.set(hinten.z, 0, -hinten.x);
  const gefunden = [null, null];
  /* Das Netz soll wirklich an ZWEI Dingen haengen. Ohne diese Sperre
     konnten beide Faeden am selben Haus kleben - dann zog nichts
     gegeneinander und es sah aus wie ein einzelner Faden. */
  let schonBenutzt = null;
  for (let seite = 0; seite < 2; seite++) {
    const vz = seite === 0 ? -1 : 1;
    let best = null, bestWert = -1e9, bestCol = null;
    for (const c of colliders) {
      /* Der Anker darf auch tiefer liegen als die Figur – vom Hochhausdach
         aus gibt es sonst fast nie zwei Häuser, die noch höher sind. */
      if (c.klein || c.h < player.pos.y - 8) continue;
      if (c === schonBenutzt) continue;
      const cx = clamp(player.pos.x, c.x0, c.x1);
      const cz = clamp(player.pos.z, c.z0, c.z1);
      const dx = cx - player.pos.x, dz = cz - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4 || d > 60) continue;
      const nachHinten = (dx * hinten.x + dz * hinten.z) / d;
      const nachSeite = (dx * rechts.x + dz * rechts.z) / d * vz;
      if (nachHinten < 0.05 || nachSeite < 0.1) continue;
      /* Möglichst hoch und möglichst weit vorn. */
      const wert = nachHinten * 2 + nachSeite - d * 0.02 + Math.min(c.h, 90) * 0.02;
      if (wert > bestWert) {
        bestWert = wert;
        bestCol = c;
        best = V3(cx, Math.min(c.h - 0.4, player.pos.y + rand(4, 12)), cz);
      }
    }
    gefunden[seite] = best;
    schonBenutzt = bestCol;
  }
  return gefunden;
}

function katapultStart() {
  if (player.dead || player.state === 'swing' || player.state === 'climb') return;
  if (!player.onGround) { popupScreen('Katapult geht nur vom Boden'); return; }
  const anker = katapultAnker();
  if (!anker[0] || !anker[1]) { popupScreen('Keine zwei Ankerpunkte in Reichweite'); return; }
  KAT.aktiv = true; KAT.ladung = 0;
  KAT.anker[0] = anker[0]; KAT.anker[1] = anker[1];
  KAT.start = { x: player.pos.x, z: player.pos.z };
  /* Flugrichtung: zur Mitte der beiden Anker. Sie steht beim Anschiessen
     fest und dreht sich nicht mehr mit, auch wenn man sich beim
     Zurueckgehen umschaut. */
  const mx = (anker[0].x + anker[1].x) / 2 - player.pos.x;
  const mz = (anker[0].z + anker[1].z) / 2 - player.pos.z;
  const L = Math.hypot(mx, mz) || 1;
  KAT.rx = mx / L; KAT.rz = mz / L;
  /* ---- Welcher Faden gehoert in welche Faust? ----
     Das Skelett ist gespiegelt benannt: der Knochen "leftarm" sitzt auf
     der RECHTEN Koerperseite. Die Zuordnung war deshalb schon zweimal
     vertauscht, einmal in jede Richtung. Sie wird jetzt nicht mehr
     geraten, sondern EINMAL BEIM ANSCHIESSEN GEMESSEN: der Anker, der
     weiter rechts liegt, gehoert an die Hand, die weiter rechts liegt.
     Gemessen wird vor dem ersten Stellen der Arme - danach zeigen die
     Haende ohnehin schon zu ihren Ankern und die Messung waere
     selbstbestaetigend. */
  const qrx = KAT.rz, qrz = -KAT.rx;                 // rechts zur Flugrichtung
  const quer = (p) => (p.x - player.pos.x) * qrx + (p.z - player.pos.z) * qrz;
  const hL = heroHandPos(_v1, 'L'), qL = hL ? quer(hL) : -1;
  const hR = heroHandPos(_v2, 'R'), qR = hR ? quer(hR) : 1;
  const rechteHand = qR >= qL ? 'R' : 'L';
  const linkeHand = rechteHand === 'R' ? 'L' : 'R';
  KAT.seite = quer(anker[0]) >= quer(anker[1]) ? [rechteHand, linkeHand]
                                               : [linkeHand, rechteHand];
  popupScreen('Rueckwaerts gehen zum Spannen');
  SFX.thwip(); SFX.web();
}

function katapultLos() {
  if (!KAT.aktiv) return;
  KAT.lehne = 0;
  if (heroVisual.root) heroVisual.root.rotation.x = 0;
  const t = clamp(KAT.ladung / KAT_ZUG, 0, 1);
  KAT.aktiv = false;
  KAT.strang[0].visible = false;
  KAT.strang[1].visible = false;
  if (KAT.zeichen[0]) KAT.zeichen[0].visible = false;
  if (KAT.zeichen[1]) KAT.zeichen[1].visible = false;
  /* Unter einem Drittel Spannung passiert nichts – so kann man abbrechen. */
  if (t < 0.3) { popupScreen('Zu wenig Spannung - weiter zurueck'); return; }
  const tempo = lerp(16, 34, t);
  player.vel.x = KAT.rx * tempo;
  player.vel.z = KAT.rz * tempo;
  player.facing = Math.atan2(KAT.rx, KAT.rz);
  player.vel.y = lerp(7, 15, t);
  player.onGround = false;
  player.state = 'air';
  player.jumps = 1;
  /* Merker für die Kamera: solange der Katapultflug läuft, darf sie hinter
     die Flugrichtung ziehen, ohne dass man wischen muss. */
  player.katFlug = 2.2;
  camShake = Math.max(camShake, 0.22 * t);
  staubWolke(player.pos, 1.2 + t);
  SFX.zip(); SFX.swoosh();
  popupWorld('Katapult!', player.pos, '#bfe8ff');
  addScore(Math.round(20 * t), '', player.pos);
}

function updateKatapult(dt) {
  if (player.katFlug > 0) player.katFlug = player.onGround ? 0 : player.katFlug - dt;
  if (!KAT.aktiv) return;
  /* Loslassen oder Zustandswechsel beendet die Spannung. */
  if (player.dead || !player.onGround || player.state === 'swing') { katapultLos(); return; }
  /* Spannung aus dem WEG gegen die Flugrichtung. Wer wieder nach vorn
     geht, laesst nach - das Netz ist keine Ratsche. */
  const zug = -((player.pos.x - KAT.start.x) * KAT.rx +
                (player.pos.z - KAT.start.z) * KAT.rz);
  KAT.ladung = clamp(zug, 0, KAT_ZUG);
  const t = clamp(KAT.ladung / KAT_ZUG, 0, 1);
  /* Je straffer, desto schwerer kommt man weiter zurueck - das Netz zieht
     zurueck.
     WICHTIG: die Bremse muss auf die Zeit gerechnet werden, nicht auf das
     BILD. Vorher stand hier ein fester Faktor je Bild. Auf einem Geraet
     mit 120 Bildern je Sekunde wirkte er doppelt so oft wie auf einem mit
     60 - die Figur kam dort ueberhaupt nicht mehr von der Stelle, das
     Katapult liess sich nicht spannen und alles fuehlte sich an, als
     haenge das Spiel. Genau das war der Fehler auf dem iPad. */
  const halt = Math.pow(1 - 0.40 * t, clamp(dt, 0, 0.1) * 60);
  player.vel.x *= halt; player.vel.z *= halt;
  /* Sich in die Spannung legen: je straffer, desto weiter nach hinten. */
  KAT.lehne = lerp(KAT.lehne || 0, t * 0.30, Math.min(1, dt * 8));
  if (heroVisual.root) heroVisual.root.rotation.x = -(KAT.lehne || 0);

  /* ---- ERST die Haende stellen, DANN die Faeden legen ----
     Vorher lief es andersherum: die Faeden wurden an die Handpunkte des
     VORIGEN Bildes gehaengt und die Arme erst danach neu ausgerichtet.
     Beim Zurueckgehen wandern die Arme in jedem Bild ein Stueck - der
     Faden setzte deshalb sichtbar neben der Faust an, und zwar umso
     weiter, je schneller man ging. Jetzt steht die Haltung fest, bevor
     der Faden gemessen wird. */
  if (heroVisual.poseSchuss) {
    /* Die Seiten stehen seit dem Anschiessen fest, siehe katapultStart. */
    const seite = KAT.seite || ['R', 'L'];
    heroVisual.poseSchuss(KAT.anker[0], seite[0], 0.85);
    heroVisual.poseSchuss(KAT.anker[1], seite[1], 0.85);
    /* Wer zwei Netze haelt, macht dabei die Faust zu. Mit flacher Hand sah
       es aus, als winke die Figur mit den Faeden. */
    if (heroVisual.faust) { heroVisual.faust('L', 1); heroVisual.faust('R', 1); }
  }
  heroVisual.root.updateMatrixWorld(true);

  for (let i = 0; i < 2; i++) {
    const m = katapultStrang(i);
    /* Dieselbe Zuordnung wie beim Stellen der Arme. */
    const hand = heroHandPos(_v3, (KAT.seite || ['R', 'L'])[i]);
    /* Ohne Hand keine Linie - dann lieber die Schulter nehmen als gar
       nichts zu zeigen. */
    /* ---- Wo genau faengt der Faden an? ----
       Am HANDGELENK, und von dort laeuft er ueber den Handruecken nach
       aussen - so, wie Spider-Man ihn aus dem Werfer am Unterarm schiesst
       und mit der Faust festhaelt. Der Mixamo-Handknochen SITZT im
       Handgelenk; die 11 cm nach aussen legen den Ansatzpunkt genau auf
       die geschlossene Faust. */
    let von = hand || _v3.set(player.pos.x, player.pos.y + 1.4, player.pos.z);
    if (hand) {
      _v4.copy(KAT.anker[i]).sub(von);
      if (_v4.lengthSq() > 1e-6) von.addScaledVector(_v4.normalize(), 0.11);
    }
    /* Beim Spannen wird der Faden straffer, dicker und heller - man soll
       sehen, wie die Spannung steigt. Die Dicke geht in placeStrand hinein;
       ein mesh.scale haette die Weltpunkte des Fadens verschoben. */
    placeStrand(m, von, KAT.anker[i], 0.03 * (1 - t) + 0.002, 1 + t * 1.6);
    if (m.material && m.material.color) {
      const hell = 0.75 + t * 0.25;
      m.material.color.setRGB(hell, hell, 1);
    }
    m.visible = true;
    /* Punkt an der Fassade, wo das Netz klebt. */
    const z = katapultZeichen(i);
    z.position.copy(KAT.anker[i]);
    z.scale.setScalar(0.5 + t * 0.5);
    z.visible = true;
  }
}

/* ======================= Ankerzeichen =======================
   Man sah nie, woran das Netz greifen würde – der Schwung fühlte sich
   deshalb wie Glückssache an. Ein kleines Fadenkreuz am nächsten
   Ankerpunkt macht das Anschießen lesbar. */
let ankerZeichen = null, ankerSicht = 0;

function baueAnkerZeichen() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
    opacity: 0, depthTest: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 20), mat);
  g.add(ring);
  /* Vier kurze Striche als Fadenkreuz – erkennt man auch vor unruhigem
     Hintergrund noch. */
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.075), mat);
    const w = i * Math.PI / 2;
    s.position.set(Math.cos(w) * 0.92, Math.sin(w) * 0.92, 0);
    s.rotation.z = w;
    g.add(s);
  }
  g.renderOrder = 26;
  g.visible = false;
  scene.add(g);
  ankerZeichen = g;
  ankerZeichen.__mat = mat;
}

function updateAnkerZeichen(dt) {
  if (!ankerZeichen) baueAnkerZeichen();
  /* Nur zeigen, wenn ein Schwung überhaupt in Frage kommt. */
  const moeglich = !player.dead && !player.onGround && player.state === 'air' &&
                   !player.zip && !player.gleiten;
  let ziel = null;
  if (moeglich) {
    /* Die Suche ist nicht gratis – zweimal je Sekunde reicht völlig, das
       Zeichen wandert ohnehin weich hinterher. */
    player.ankerCd = (player.ankerCd || 0) - dt;
    if (player.ankerCd <= 0) {
      player.ankerCd = 0.12;
      player.ankerMerk = findAnchor();
    }
    ziel = player.ankerMerk;
  } else player.ankerMerk = null;

  ankerSicht = lerp(ankerSicht, ziel ? 1 : 0, Math.min(1, dt * (ziel ? 12 : 8)));
  if (ankerSicht < 0.03 || !ziel) { ankerZeichen.visible = false; return; }
  ankerZeichen.visible = true;
  ankerZeichen.position.lerp(ziel, Math.min(1, dt * 14));
  ankerZeichen.quaternion.copy(camera.quaternion);
  /* Gleich groß am Bildschirm, egal wie weit weg. */
  const dist = ankerZeichen.position.distanceTo(camera.position);
  const sk = clamp(dist * 0.035, 0.5, 3.4);
  ankerZeichen.scale.setScalar(sk);
  ankerZeichen.__mat.opacity = ankerSicht * 0.55;
}

/* ======================= Spinnensinn =======================
   Das Kribbeln im Nacken: kündigt Gefahr an, BEVOR sie eintrifft – auch
   aus dem Rücken, wo man den Gegner gar nicht sieht. Drei Teile:
   die Bögen über dem Kopf, ein Zeiger am Bildrand in Richtung der Gefahr
   und ein kurzer Ton. Leuchtet er weiß, ist das Konterfenster offen. */
let sinnStaerke = 0, sinnKonter = 0, sinnTonCd = 0, sinnArt = 'gegner';
const sinnRichtung = new THREE.Vector3();
let sinnBoegen = null, sinnZeigerEl = null;

function baueSinnBoegen() {
  sinnBoegen = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    /* Klein und dicht am Kopf – größere Bögen sahen aus wie ein Heiligen-
       schein statt wie das Kribbeln im Nacken. */
    const r = 0.17 + i * 0.10;
    const g = new THREE.RingGeometry(r, r + 0.022, 16, 1, Math.PI * 0.2, Math.PI * 0.55);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0xdff3ff, transparent: true, opacity: 0, depthTest: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.renderOrder = 30;
    sinnBoegen.add(m);
    /* Gespiegelt auf die andere Seite – zusammen ergibt das die typischen
       Wellen links und rechts des Kopfes. */
    const m2 = m.clone();
    m2.material = m.material;
    m2.scale.x = -1;
    sinnBoegen.add(m2);
  }
  sinnBoegen.visible = false;
  scene.add(sinnBoegen);
}

/* Stärkste Gefahr suchen: ausholende Gegner und schnelle Autos. */
function findeGefahr() {
  let best = 0, wo = null, konter = 0, art = 'gegner';
  for (const e of enemies) {
    if (e.dead || e.warnT <= 0) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    if (d > 13 || Math.abs(e.pos.y - player.pos.y) > 4) continue;
    /* Je näher der Schlag, desto stärker das Kribbeln. */
    const s = clamp(1 - e.warnT / 0.95, 0.25, 1) * clamp(1 - (d - 2) / 12, 0.35, 1);
    if (s > best) { best = s; wo = e.pos; art = 'gegner'; }
    if (e.warnT <= 0.42 && d < 3.6) konter = 1;
  }
  for (const car of cars) {
    if (car.aus) continue;
    const p = car.mesh.position;
    const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    if (d > 14 || Math.abs(p.y - player.pos.y) > 3) continue;
    /* Nur wenn das Auto auch auf einen zufährt. */
    const zu = ((player.pos.x - p.x) * car.vx + (player.pos.z - p.z) * car.vz);
    const tempo = Math.hypot(car.vx, car.vz);
    if (zu <= 0 || tempo < 7) continue;
    const s = clamp(1 - (d - 3) / 11, 0, 1) * 0.85;
    if (s > best) { best = s; wo = p; art = 'verkehr'; }
  }
  if (wo) sinnRichtung.copy(wo);
  return { staerke: best, konter, art };
}

function updateSpinnenSinn(dt) {
  if (!sinnBoegen) baueSinnBoegen();
  if (!sinnZeigerEl) sinnZeigerEl = document.getElementById('sinn');
  const g = player.dead ? { staerke: 0, konter: 0, art: 'gegner' } : findeGefahr();
  /* Woher kommt die Gefahr? Der Sinn schlaegt auch bei heranfahrenden Autos
     an, nicht nur bei Gegnern - ohne Unterschied im Bild sah das aus wie
     ein unsichtbarer Gegner. Verkehr ist jetzt bernsteinfarben, ein
     ausholender Gegner bleibt blauweiss. */
  if (g.staerke > 0.05) sinnArt = g.art;
  const vorher = sinnStaerke;
  sinnStaerke = lerp(sinnStaerke, g.staerke, Math.min(1, dt * (g.staerke > sinnStaerke ? 16 : 7)));
  sinnKonter = lerp(sinnKonter, g.konter, Math.min(1, dt * 12));

  /* Ton nur beim Anspringen, nicht dauerhaft. */
  if (sinnTonCd > 0) sinnTonCd -= dt;
  if (g.staerke > 0.3 && vorher < 0.12 && sinnTonCd <= 0) {
    sinnTonCd = 0.7;
    SFX.sinn && SFX.sinn();
  }

  if (sinnStaerke < 0.03) {
    sinnBoegen.visible = false;
    if (sinnZeigerEl) sinnZeigerEl.style.opacity = 0;
    return;
  }

  /* Bögen über dem Kopf, immer zur Kamera gedreht. */
  sinnBoegen.visible = true;
  const kopf = heroVisual && heroVisual.kopfPos ? heroVisual.kopfPos(_v1) : null;
  if (kopf) sinnBoegen.position.copy(kopf).setY(kopf.y + 0.18);
  else sinnBoegen.position.set(player.pos.x, player.pos.y + 1.75, player.pos.z);
  sinnBoegen.quaternion.copy(camera.quaternion);
  const puls = 0.6 + 0.4 * Math.sin(elapsed * 22);
  for (let i = 0; i < sinnBoegen.children.length; i += 2) {
    const m = sinnBoegen.children[i].material;
    /* Die Bögen laufen versetzt nach außen – das ergibt das Wandern. */
    const phase = (elapsed * 3.2 + i * 0.33) % 1;
    m.opacity = sinnStaerke * puls * (1 - phase) * 1.1;
    m.color.setHex(sinnKonter > 0.5 ? 0xffffff
                 : sinnArt === 'verkehr' ? 0xffc766 : 0xa8e4ff);
    const sk = 1 + phase * 0.35;
    sinnBoegen.children[i].scale.set(sk, sk, sk);
    sinnBoegen.children[i + 1].scale.set(-sk, sk, sk);
  }

  /* Zeiger am Bildrand: in welche Richtung liegt die Gefahr? */
  if (sinnZeigerEl) {
    const dx = sinnRichtung.x - player.pos.x, dz = sinnRichtung.z - player.pos.z;
    /* Winkel relativ zur Blickrichtung der Kamera, 0 = geradeaus. */
    const welt = Math.atan2(dx, dz);
    let rel = welt - camYaw + Math.PI;
    while (rel > Math.PI) rel -= TAU;
    while (rel < -Math.PI) rel += TAU;
    sinnZeigerEl.style.opacity = (sinnStaerke * 0.85).toFixed(2);
    sinnZeigerEl.style.transform = `rotate(${(-rel * 180 / Math.PI).toFixed(1)}deg)`;
    sinnZeigerEl.style.setProperty('--sinnfarbe', sinnKonter > 0.5 ? '#ffffff'
      : sinnArt === 'verkehr' ? '#ffc766' : '#7fd4ff');
  }
}

/* ======================= Echte Fahrer in den Autos =======================
   In jedem Wagen sassen einfache Sitzfiguren aus Zylindern und Kugeln.
   Aus der Naehe - und genau da faehrt man vorbei - sah man sofort, dass
   das keine Menschen sind.
   Alle Autos mit echten Figuren zu besetzen waere zu teuer: jede ist ein
   eigenes Skelett. Deshalb gibt es eine kleine Mannschaft, die immer in
   den naechstgelegenen Wagen sitzt. Faehrt der Wagen weg, steigt sie in
   den naechsten um; im Wagen selbst werden solange die einfachen Figuren
   ausgeblendet. Weiter weg bleibt es bei den einfachen - dort sieht man
   den Unterschied ohnehin nicht. */
const AUTO_FAHRER = [];
/* Von fuenf auf acht erhoeht und die Reichweite von 34 auf 46 m: mit
   fuenf blieb im Bild regelmaessig ein Wagen uebrig, in dem nur die
   einfachen Sitzfiguren sassen - und genau der faellt auf. */
const AUTO_FAHRER_MAX = 8;
const AUTO_FAHRER_WEITE = 46;      // so nah muss ein Wagen sein
const _afP = new THREE.Vector3();

function baueAutoFahrer() {
  if (AUTO_FAHRER.length || !actorsReady) return;
  for (let i = 0; i < AUTO_FAHRER_MAX; i++) {
    const visual = makeCharacterVisual('civilian', {});
    if (!visual || visual.procedural) return;    // ohne Modelle bleibt alles wie es war
    visual.root.visible = false;
    scene.add(visual.root);
    AUTO_FAHRER.push({ visual, auto: null });
  }
}

function updateAutoFahrer(dt) {
  if (!AUTO_FAHRER.length) { baueAutoFahrer(); if (!AUTO_FAHRER.length) return; }
  /* Die naechsten Wagen suchen. Nur Personenwagen - Bus und LKW haben
     ihre eigenen, passend gebauten Insassen. */
  const nah = [];
  for (const c of cars) {
    if (c.aus || !c.mesh || !c.mesh.userData.fahrerSitz) continue;
    const p = c.mesh.position;
    const d2 = (p.x - player.pos.x) * (p.x - player.pos.x) +
               (p.z - player.pos.z) * (p.z - player.pos.z);
    if (d2 > AUTO_FAHRER_WEITE * AUTO_FAHRER_WEITE) continue;
    nah.push({ c, d2 });
  }
  nah.sort((a, b) => a.d2 - b.d2);
  for (let i = 0; i < AUTO_FAHRER.length; i++) {
    const f = AUTO_FAHRER[i];
    const ziel = nah[i] ? nah[i].c : null;
    if (f.auto !== ziel) {
      /* Beim Umsteigen die einfachen Figuren im alten Wagen wieder zeigen. */
      if (f.auto && f.auto.mesh && f.auto.mesh.userData.insassen) {
        f.auto.mesh.userData.insassen.visible = true;
      }
      f.auto = ziel;
    }
    if (!ziel) { f.visual.root.visible = false; continue; }
    if (ziel.mesh.userData.insassen) ziel.mesh.userData.insassen.visible = false;
    const sitz = ziel.mesh.userData.fahrerSitz;
    const ry = ziel.mesh.rotation.y;
    const co = Math.cos(ry), si = Math.sin(ry);
    _afP.set(ziel.mesh.position.x + sitz.x * co + sitz.z * si,
             ziel.mesh.position.y,
             ziel.mesh.position.z - sitz.x * si + sitz.z * co);
    f.visual.root.visible = true;
    f.visual.root.position.copy(_afP);
    f.visual.root.rotation.y = ry;
    f.visual.play('idle', { t: elapsed }, dt);
    if (f.visual.poseSitzen) {
      f.visual.poseSitzen(1);
      const m = f.visual.sitzMasse ? f.visual.sitzMasse() : null;
      /* Becken auf die Sitzflaeche des Wagens. */
      if (m) f.visual.root.position.y += (ziel.mesh.position.y + sitz.y) - m.huefte;
    }
  }
}

/* ======================= Fahrgaeste im Bus =======================
   Wie bei den Autos: eine kleine Mannschaft echter Zivilisten setzt sich
   auf die Plaetze des naechstgelegenen Busses. Die einfachen Sitzfiguren
   dieses Busses werden solange ausgeblendet, sonst sitzen zwei
   uebereinander. Weiter weg bleibt es bei den einfachen. */
const BUS_GAST = [];
const BUS_GAST_MAX = 6;
const BUS_GAST_WEITE = 30;
const _bgP = new THREE.Vector3();

function baueBusGaeste() {
  if (BUS_GAST.length || !actorsReady) return;
  for (let i = 0; i < BUS_GAST_MAX; i++) {
    const visual = makeCharacterVisual('civilian', {});
    if (!visual || visual.procedural) return;
    visual.root.visible = false;
    scene.add(visual.root);
    BUS_GAST.push({ visual });
  }
}

let busGastBus = null;
function updateBusGaeste(dt) {
  if (!BUS_GAST.length) { baueBusGaeste(); if (!BUS_GAST.length) return; }
  /* Den naechsten Bus suchen. */
  let bester = null, bd = BUS_GAST_WEITE * BUS_GAST_WEITE;
  for (const c of cars) {
    if (c.aus || !c.mesh || !c.mesh.userData.sitzplaetze) continue;
    const p = c.mesh.position;
    const d2 = (p.x - player.pos.x) * (p.x - player.pos.x) +
               (p.z - player.pos.z) * (p.z - player.pos.z);
    if (d2 < bd) { bd = d2; bester = c; }
  }
  if (busGastBus !== bester) {
    if (busGastBus && busGastBus.mesh && busGastBus.mesh.userData.insassen) {
      busGastBus.mesh.userData.insassen.visible = true;
    }
    busGastBus = bester;
  }
  if (!bester) { for (const g of BUS_GAST) g.visual.root.visible = false; return; }
  if (bester.mesh.userData.insassen) bester.mesh.userData.insassen.visible = false;
  const plaetze = bester.mesh.userData.sitzplaetze;
  const ry = bester.mesh.rotation.y;
  const co = Math.cos(ry), si = Math.sin(ry);
  for (let i = 0; i < BUS_GAST.length; i++) {
    const g = BUS_GAST[i], pl = plaetze[i];
    if (!pl) { g.visual.root.visible = false; continue; }
    _bgP.set(bester.mesh.position.x + pl.x * co + pl.z * si,
             bester.mesh.position.y,
             bester.mesh.position.z - pl.x * si + pl.z * co);
    g.visual.root.visible = true;
    g.visual.root.position.copy(_bgP);
    g.visual.root.rotation.y = ry + pl.ry;
    const echtesSitzen = g.visual.hatClip && g.visual.hatClip('sitzen');
    g.visual.play(echtesSitzen ? 'sitzen' : 'idle', { t: elapsed }, dt);
    {
      if (!echtesSitzen && g.visual.poseSitzen) g.visual.poseSitzen(1);
      const m = g.visual.sitzMasse ? g.visual.sitzMasse() : null;
      if (m) g.visual.root.position.y += (bester.mesh.position.y + pl.y) - m.huefte;
    }
  }
}

/* ======================= Fahrgaeste im Zug =======================
   Im Zug sassen bisher zum Teil einfache Sitzfiguren und zum Teil echte
   Zivilisten (die an einer Station eingestiegen sind) - nebeneinander auf
   derselben Bank. Die einfachen sind raus; damit der Wagen trotzdem nicht
   leer ist, faehrt eine kleine Mannschaft echter Leute mit. Sie setzt sich
   immer auf die naechstgelegenen freien Plaetze des naechsten Zuges.
   Ein Sitzplatz weiter weg als 30 m ist im Bild ohnehin nicht zu sehen. */
const ZUG_GAST = [];
const ZUG_GAST_MAX = 7;
const ZUG_GAST_WEITE = 30;
const _zgP = new THREE.Vector3();

function baueZugGaeste() {
  if (ZUG_GAST.length || !actorsReady) return;
  for (let i = 0; i < ZUG_GAST_MAX; i++) {
    const visual = makeCharacterVisual('civilian', {});
    if (!visual || visual.procedural) return;
    visual.root.visible = false;
    scene.add(visual.root);
    ZUG_GAST.push({ visual });
  }
}

function updateZugGaeste(dt) {
  if (!ZUG_GAST.length) { baueZugGaeste(); if (!ZUG_GAST.length) return; }
  /* Alle freien Plaetze aller sichtbaren Zuege einsammeln, nach Abstand
     zur Figur sortieren. */
  const plaetze = [];
  for (const t of ZUEGE) {
    if (!t.mesh || !t.mesh.visible) continue;
    const sitze = t.mesh.userData.freieSitze;
    if (!sitze || !sitze.length) continue;
    for (let k = 0; k < sitze.length; k++) {
      /* Plaetze, auf denen schon ein eingestiegener Zivilist sitzt,
         bleiben frei fuer ihn. */
      if (t.besetzt && t.besetzt.has(k)) continue;
      const pl = sitze[k];
      /* Genau wie beim Einsteigen gerechnet: der Zug faehrt laengs der
         x-Achse, die Platzangaben sind schon Weltversaetze. */
      const wx = t.x + pl.dx, wz = t.z + pl.dz;
      const d2 = (wx - player.pos.x) * (wx - player.pos.x) +
                 (wz - player.pos.z) * (wz - player.pos.z);
      if (d2 > ZUG_GAST_WEITE * ZUG_GAST_WEITE) continue;
      plaetze.push({ x: wx, z: wz, ry: pl.ry, d2 });
    }
  }
  plaetze.sort((a, b) => a.d2 - b.d2);
  for (let i = 0; i < ZUG_GAST.length; i++) {
    const g = ZUG_GAST[i], pl = plaetze[i];
    if (!pl) { g.visual.root.visible = false; continue; }
    g.visual.root.visible = true;
    g.visual.root.position.set(pl.x, UB_TIEF, pl.z);
    g.visual.root.rotation.y = pl.ry;
    const echtesSitzen = g.visual.hatClip && g.visual.hatClip('sitzen');
    g.visual.play(echtesSitzen ? 'sitzen' : 'idle', { t: elapsed }, dt);
    {
      if (!echtesSitzen && g.visual.poseSitzen) g.visual.poseSitzen(1);
      /* Zwei Bedingungen, es gilt die staerkere: das Becken sitzt auf der
         Bank UND die Fuesse duerfen nicht durch den Wagenboden. Nur die
         erste zu nehmen liess die Figuren 44 cm ueber dem Boden schweben -
         gemessen am tiefsten Fussknochen. */
      const m = g.visual.sitzMasse ? g.visual.sitzMasse() : null;
      if (m) g.visual.root.position.y +=
        Math.max((UB_TIEF + ZUG_BANK) - m.huefte, UB_TIEF - m.fuss);
    }
  }
}

/* ======================= Leute in Innenraeumen =======================
   B-Ebene, Laeden, begehbare Haeuser: gebaut waren sie, bewohnt nicht.
   Nach demselben Muster wie im Bus und im Zug faehrt eine kleine
   Mannschaft echter Zivilisten mit und stellt beziehungsweise setzt sich
   auf die naechstgelegenen gemerkten Plaetze. Weiter weg als 24 m sieht
   man ohnehin keinen - dort bleibt der Platz leer und kostet nichts.
   Ein Platz merkt sich den Boden (darauf stehen die Fuesse) und
   wahlweise eine Sitzhoehe (darauf kommt das Becken). */
const INNEN_LEUTE = [];
/* Vier Figuren, nicht mehr: eine Zivilistin kostet gemessen 7 Zeichen-
   aufrufe und 35.000 Dreiecke, und anders als auf der Strasse stehen die
   Leute im Innenraum alle gleichzeitig im Bild. */
const INNEN_LEUTE_MAX = 4;
const INNEN_WEITE = 20;

function baueInnenLeute() {
  if (INNEN_LEUTE.length || !actorsReady) return;
  for (let i = 0; i < INNEN_LEUTE_MAX; i++) {
    const visual = makeCharacterVisual('civilian', {});
    if (!visual || visual.procedural) return;
    visual.root.visible = false;
    scene.add(visual.root);
    INNEN_LEUTE.push({ visual });
  }
}

const _innenNah = [];
function updateInnenLeute(dt) {
  if (!INNEN_PLAETZE.length) return;
  if (!INNEN_LEUTE.length) { baueInnenLeute(); if (!INNEN_LEUTE.length) return; }
  _innenNah.length = 0;
  for (const p of INNEN_PLAETZE) {
    const dx = p.x - player.pos.x, dz = p.z - player.pos.z, dy = p.boden - player.pos.y;
    if (Math.abs(dy) > 14) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 > INNEN_WEITE * INNEN_WEITE) continue;
    _innenNah.push({ p, d2 });
  }
  _innenNah.sort((a, b) => a.d2 - b.d2);
  for (let i = 0; i < INNEN_LEUTE.length; i++) {
    const g = INNEN_LEUTE[i], e = _innenNah[i];
    if (!e) { g.visual.root.visible = false; continue; }
    const p = e.p;
    /* ---- Nur Plaetze, die es wirklich noch gibt ----
       Die Sitzplaetze werden beim Bauen gemerkt. Faellt der Raum darum
       spaeter weg oder liegt der Boden dort ganz woanders, sass die Figur
       anschliessend frei in der Luft ueber der Strasse. Stimmt der
       gemerkte Boden nicht mit dem echten ueberein, bleibt der Platz
       leer. */
    const echterBoden = groundY(p.x, p.z, p.boden + 0.6);
    if (echterBoden === null || echterBoden === undefined ||
        Math.abs(echterBoden - p.boden) > 0.6) {
      g.visual.root.visible = false; continue;
    }
    g.visual.root.visible = true;
    g.visual.root.position.set(p.x, p.boden, p.z);
    g.visual.root.rotation.y = p.ry;
    /* Der Zeitversatz sorgt dafuer, dass nicht alle im Gleichschritt
       atmen - sonst sieht man sofort, dass es dieselbe Figur ist. */
    /* Seit civilian-3 gibt es eine echte Sitzbewegung ("Sitting Idle").
       Die selbstgebaute Haltung war nur der Notbehelf, solange keine da
       war - sie bleibt als Rueckfall stehen. */
    const sitzt = p.sitz !== undefined;
    const echtesSitzen = sitzt && g.visual.hatClip && g.visual.hatClip('sitzen');
    g.visual.play(echtesSitzen ? 'sitzen' : 'idle', { t: elapsed + i * 2.3 }, dt);
    if (sitzt) {
      if (!echtesSitzen && g.visual.poseSitzen) g.visual.poseSitzen(1);
      const m = g.visual.sitzMasse ? g.visual.sitzMasse() : null;
      if (m) g.visual.root.position.y +=
        Math.max(p.sitz - m.huefte, p.boden - m.fuss);
    }
  }
}

/* ======================= Kontaktschatten =======================
   Auf den Grafikstufen "mittel" und "niedrig" ist die Schattenkarte aus -
   dann wirft keine Figur mehr einen Schatten, und ohne Schatten unter den
   Fuessen sieht JEDE Figur aus, als schwebte sie ueber der Strasse. Genau
   das war der Eindruck, und gemessen stimmte er nicht: der tiefste Fuss
   stand hoechstens 9 cm ueber dem Boden.
   Der Fleck hier ist kein echter Schatten, sondern eine dunkle Scheibe am
   Boden unter der Figur. Alle Figuren zusammen kosten EINEN Zeichenaufruf,
   und er verblasst mit der Hoehe ueber dem Boden - dadurch sieht man beim
   Springen und Schwingen auch, wie hoch man ist. */
let fleckMesh = null;
const FLECK_MAX = 48;             // so viele Figuren bekommen einen Fleck
const _flM = new THREE.Matrix4(), _flP = new THREE.Vector3();
const _flQ = new THREE.Quaternion(), _flS = new THREE.Vector3();

function baueFlecken() {
  const tex = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.72)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.42)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  fleckMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, opacity: 1,
  }), FLECK_MAX);
  fleckMesh.renderOrder = 2;
  fleckMesh.frustumCulled = false;
  fleckMesh.count = 0;
  scene.add(fleckMesh);
}

function updateFlecken() {
  if (!fleckMesh) baueFlecken();
  /* Bei voller Grafik gibt es echte Schatten - dann waere der Fleck
     doppelt gemoppelt und wuerde unter der Figur dunkel durchschlagen. */
  if (renderer.shadowMap.enabled) { fleckMesh.count = 0; return; }
  let n = 0;
  const setze = (pos, breite) => {
    if (n >= FLECK_MAX) return;
    const boden = groundY(pos.x, pos.z, pos.y);
    const hoch = pos.y - boden;
    if (hoch < -0.5 || hoch > 12) return;          // zu tief oder zu hoch
    /* Je hoeher, desto groesser und blasser - wie ein echter Schatten. */
    const t = clamp(hoch / 12, 0, 1);
    const gr = breite * (1 + t * 1.6);
    _flP.set(pos.x, boden + 0.03, pos.z);
    _flQ.set(0, 0, 0, 1);
    _flS.set(gr, 1, gr * 0.78);
    _flM.compose(_flP, _flQ, _flS);
    fleckMesh.setMatrixAt(n, _flM);
    n++;
  };
  /* Die Stelle kommt aus der FIGUR, nicht aus dem Spielerpunkt: die
     Darstellung sitzt nicht immer genau darauf (Wandpose, Versatz beim
     Angriff), und ein Fleck neben den Fuessen ist schlimmer als keiner. */
  setze(heroVisual && heroVisual.root ? heroVisual.root.position : player.pos, 1.15);
  for (const e of enemies) {
    if (e.dead) continue;
    if (Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.z - player.pos.z) > 55) continue;
    setze(e.visual && e.visual.root ? e.visual.root.position : e.pos, 1.05);
  }
  for (const c of civilians) {
    if (c.eingestiegen > 0) continue;
    if (Math.abs(c.pos.x - player.pos.x) + Math.abs(c.pos.z - player.pos.z) > 45) continue;
    setze(c.visual && c.visual.root ? c.visual.root.position : c.pos, 0.95);
  }
  fleckMesh.count = n;
  fleckMesh.instanceMatrix.needsUpdate = true;
}

/* ======================= Netzflügel =======================
   Die Häute zwischen Arm und Rumpf. Sie sind keine starre Geometrie,
   sondern werden in jedem Bild aus den Weltpositionen von Hand, Ellbogen,
   Schulter und Hüfte aufgespannt – dadurch sitzen sie immer richtig,
   egal welche Animation gerade läuft. */
let fluegelL = null, fluegelR = null, fluegelMat = null, fluegelSicht = 0;
const _fp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
             new THREE.Vector3(), new THREE.Vector3()];

function macheFluegelTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    /* Fächer aus Fäden vom Handgelenk (oben) zur Hüfte (unten links). */
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineCap = 'round';
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(t * w, 0);
      g.lineTo(w * 0.06, h * (0.15 + t * 0.8));
      g.stroke();
    }
    /* Querfäden als leicht durchhängende Bögen. */
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    for (let r = 1; r <= 7; r++) {
      const t = r / 8;
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const x = lerp(u * w, w * 0.06, 1 - t) * 1;
        const x2 = lerp(w * 0.06, u * w, t);
        const y = lerp(0, h * (0.15 + u * 0.8), t) + Math.sin(u * Math.PI) * 4;
        i ? g.lineTo(x2, y) : g.moveTo(x2, y);
      }
      g.stroke();
    }
  });
}

function baueNetzFluegel() {
  fluegelMat = new THREE.MeshLambertMaterial({
    map: macheFluegelTex(), color: 0xe8eef5, transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthWrite: false });
  const mache = () => {
    const geo = new THREE.BufferGeometry();
    /* Drei Dreiecke: vom Handgelenk über die Achsel bis zum Knie. */
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      1, 1,     0.55, 1,    0.06, 0.42,
      0.55, 1,  0.12, 1,    0.06, 0.42,
      1, 1,     0.06, 0.42, 0.5, 0.02,
    ]), 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(27), 3));
    const m = new THREE.Mesh(geo, fluegelMat);
    m.frustumCulled = false;
    m.renderOrder = 8;
    m.visible = false;
    scene.add(m);
    return m;
  };
  fluegelL = mache(); fluegelR = mache();
}

function setzeFluegel(mesh, seite) {
  if (!heroVisual.fluegelPunkte || !heroVisual.fluegelPunkte(seite, _fp)) return false;
  const [hand, ell, schulter, huefte, knie] = _fp;
  /* Die Haut hängt zwischen Hand und Hüfte leicht durch – ein gerader
     Zuschnitt sähe aus wie ein Brett. */
  const mitte = _v1.copy(hand).add(huefte).multiplyScalar(0.5);
  /* Der Bauschpunkt wird leicht von der Körpermitte weggezogen – dadurch
     wirkt die Haut gespannt statt eingefallen. */
  const durch = _v2.copy(ell).lerp(mitte, 0.28);
  _v3.copy(ell).sub(huefte).setY(0);
  if (_v3.lengthSq() > 0.0001) durch.addScaledVector(_v3.normalize(), 0.1);
  const p = mesh.geometry.attributes.position.array;
  const setz = (i, v) => { p[i * 3] = v.x; p[i * 3 + 1] = v.y; p[i * 3 + 2] = v.z; };
  setz(0, hand);  setz(1, durch);    setz(2, huefte);
  setz(3, durch); setz(4, schulter); setz(5, huefte);
  /* Untere Bahn bis zum Knie – nur bis zur Hüfte sah die Haut aus wie ein
     Stück Stoff unter der Achsel, nicht wie ein Flügel. */
  setz(6, hand);  setz(7, huefte);   setz(8, knie);
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  return true;
}

function updateNetzFluegel(dt) {
  if (heroVisual.procedural) return;
  if (!fluegelL) baueNetzFluegel();
  /* Ein- und Ausblenden, damit die Häute nicht schlagartig erscheinen. */
  const ziel = player.gleiten ? 1 : 0;
  fluegelSicht = lerp(fluegelSicht, ziel, Math.min(1, dt * (ziel > 0 ? 10 : 4)));
  if (fluegelSicht < 0.02) {
    fluegelL.visible = fluegelR.visible = false;
    return;
  }
  fluegelMat.opacity = fluegelSicht * 0.72;
  fluegelL.visible = setzeFluegel(fluegelL, 'L');
  fluegelR.visible = setzeFluegel(fluegelR, 'R');
}

/* ======================= Autos / Verkehr ======================= */
const cars = [];
const CAR_COLORS = [0xc23b30, 0x3059b5, 0xd8d8d8, 0x2c2c30, 0xd5a021, 0x3b7a3f, 0x8446a8, 0x9fa8b5];

/* Fahrzeugtypen. Vorher gab es nur acht Farben derselben Karosserie –
   eine Straße wirkt erst lebendig, wenn Größe und Form sich unterscheiden. */
const FAHRZEUGE = [
  { art: 'pkw',    laenge: 4.4, breite: 1.9, hoehe: 0.6, gewicht: 46 },
  { art: 'taxi',   laenge: 4.5, breite: 1.9, hoehe: 0.6, gewicht: 16 },
  { art: 'bus',    laenge: 9.5, breite: 2.4, hoehe: 2.4, gewicht: 10 },
  { art: 'lkw',    laenge: 8.0, breite: 2.3, hoehe: 2.0, gewicht: 14 },
  { art: 'polizei',laenge: 4.6, breite: 2.0, hoehe: 0.65, gewicht: 6 },
];
function waehleFahrzeug() {
  const summe = FAHRZEUGE.reduce((a, f) => a + f.gewicht, 0);
  let r = Math.random() * summe;
  for (const f of FAHRZEUGE) { r -= f.gewicht; if (r <= 0) return f; }
  return FAHRZEUGE[0];
}

function makeCarMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  /* Das Auto ist gewachsen. Vorher endete das Dach auf 1,57 m - in so eine
     Zelle passt kein Mensch von 1,76 m, deshalb sassen dort nur auf 0,66
     geschrumpfte Sitzfiguren. Jetzt reicht die Zelle bis 1,92 m, und ein
     echter Zivilist sitzt hinein, ohne mit dem Kopf durchs Dach zu gehen. */
  /* ---- Karosserie ----
     Ein einziger Kasten von 0,30 bis 1,02 m ging bis in die
     Fahrgastzelle hinein. Die Sitzflaeche liegt bei 0,76 m, das Becken bei
     0,94 - alles darunter steckte im Blech, und durch die Scheibe sah man
     vor allem eine gruene Flaeche. Genau das war "das innere Gruene muss
     weg".
     Jetzt ist die Zelle offen: unten die Wanne bis 0,78 m, darueber nur
     noch Tuerbruestungen an den Seiten und Motorhaube und Kofferraum vorn
     und hinten. Dazwischen sieht man hinein. */
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.48, 4.6), bodyMat);
  body.position.y = 0.54; body.castShadow = true;
  g.add(body);
  for (const sx of [-1, 1]) {                       // Tuerbruestung
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 2.6), bodyMat);
    br.position.set(sx * 0.91, 0.95, -0.2); br.castShadow = true;
    g.add(br);
  }
  for (const [zz, ll] of [[1.68, 1.24], [-1.72, 1.16]]) {   // Haube und Heck
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.34, ll), bodyMat);
    h2.position.set(0, 0.95, zz); h2.castShadow = true;
    g.add(h2);
  }
  /* ---- Fahrgastzelle als Glaskasten ----
     Vorher war das Dach ein undurchsichtiger Klotz mit einer einzigen
     Frontscheibe - in den Autos sass niemand und man sah auch nirgendwo
     hinein. Jetzt ist die Zelle rundum verglast, darauf ein Dachblech in
     Wagenfarbe, und drinnen sitzen Fahrer und Beifahrer. */
  /* Dunkler und weniger deckend als der erste Versuch: mit hellem Blau bei
     0,42 verschwanden die Insassen im Glanz der Scheibe. */
  const glasMat = new THREE.MeshLambertMaterial({
    color: 0x5c7f96, transparent: true, opacity: 0.34, depthWrite: false });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.86, 2.4), glasMat);
  cab.position.set(0, 1.45, -0.2);
  g.add(cab);
  const dach = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.1, 2.46), bodyMat);
  dach.position.set(0, 1.93, -0.2); dach.castShadow = true;
  g.add(dach);
  /* Dachholme, damit die Zelle nicht wie eine Schneekugel wirkt. */
  const holmMat = new THREE.MeshLambertMaterial({ color: 0x2a2e34 });
  for (const sx of [-1, 1]) {
    for (const sz of [1.02, -1.42]) {
      const holm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.86, 0.09), holmMat);
      holm.position.set(sx * 0.86, 1.45, sz);
      g.add(holm);
    }
  }
  /* ---- Sitze ----
     Im Wagen gab es ueberhaupt keine Sitze: die Insassen schwebten auf
     einer gedachten Hoehe im leeren Kasten. Jetzt stehen zwei Vordersitze
     und eine Rueckbank drin - Sitzflaeche, Lehne, Kopfstuetze -, alle in
     EINER Geometrie zusammen mit den Insassen, damit es beim
     Zeichenaufwand bleibt wie bisher. */
  const leute = [];
  /* Die Sitze kommen in ein EIGENES Netz: die Insassen werden ausgeblendet,
     sobald ein echter Zivilist einsteigt - die Sitze muessen bleiben. */
  const sitze = [];
  const sitzFarbe = 0x24272c, lehnFarbe = 0x2c3036;
  const sitzTeil = (bx, by, bz, px, py, pz, farbe) =>
    sitze.push({ geo: sitzForm('box', bx, by, bz), farbe, x: px, y: py, z: pz });
  for (const sx of [-1, 1]) {
    /* Sitzflaeche auf 0,76 m - genau darauf sitzt das Becken (0,92 m). */
    sitzTeil(0.52, 0.12, 0.50, sx * 0.44, 0.80, 0.06, sitzFarbe);
    sitzTeil(0.50, 0.62, 0.11, sx * 0.44, 1.12, -0.20, lehnFarbe);   // Lehne
    sitzTeil(0.30, 0.16, 0.10, sx * 0.44, 1.50, -0.22, lehnFarbe);   // Kopfstuetze
  }
  /* Rueckbank ueber die ganze Breite. */
  sitzTeil(1.44, 0.12, 0.48, 0, 0.80, -1.10, sitzFarbe);
  sitzTeil(1.42, 0.60, 0.11, 0, 1.10, -1.36, lehnFarbe);
  /* ---- Der Rest des Innenraums ----
     Sitze allein sind noch kein Wagen: durch die Rundumverglasung sieht
     man vor allem nach VORN, und dort war bisher gar nichts. Jetzt gibt es
     Bodenwanne, Armaturenbrett mit Instrumententafel, Lenkrad auf der
     Fahrerseite, Mittelkonsole und Tuerverkleidungen. */
  const bodenFarbe = 0x1b1d21, brettFarbe = 0x282c31;
  sitzTeil(1.70, 0.06, 3.00, 0, 0.72, -0.30, bodenFarbe);        // Bodenwanne
  sitzTeil(1.66, 0.30, 0.42, 0, 1.10, 0.86, brettFarbe);         // Armaturenbrett
  sitzTeil(0.74, 0.16, 0.06, -0.44, 1.16, 0.66, 0x3b4048);       // Instrumente
  sitzTeil(0.34, 0.10, 0.32, 0, 0.86, -0.30, brettFarbe);        // Mittelkonsole
  for (const sx of [-1, 1]) {                                    // Tuerverkleidung
    sitzTeil(0.07, 0.34, 2.10, sx * 0.84, 1.00, -0.20, brettFarbe);
    sitzTeil(0.09, 0.07, 0.42, sx * 0.80, 1.12, 0.10, 0x4a5058);  // Griff
  }
  /* Lenkrad: ein flacher Ring, leicht geneigt wie im echten Wagen. */
  {
    const ring = new THREE.TorusGeometry(0.17, 0.028, 6, 14);
    ring.rotateX(Math.PI / 2 - 0.35);
    sitze.push({ geo: ring, farbe: 0x15171a, x: -0.44, y: 1.14, z: 0.60 });
    sitzTeil(0.06, 0.06, 0.22, -0.44, 1.10, 0.70, 0x15171a);      // Lenksaeule
  }
  g.add(new THREE.Mesh(verschmelzeTeile(sitze),
                       new THREE.MeshLambertMaterial({ vertexColors: true })));
  for (const sx of [-1, 1]) {
    if (sx > 0 && Math.random() < 0.35) continue;        // mal faehrt jemand allein
    for (const t of sitzMensch(sx * 0.44, 0.96, 0.12, 0, 0.9)) leute.push(t);
  }
  if (Math.random() < 0.3) {                             // manchmal jemand hinten
    for (const t of sitzMensch(rand(-0.4, 0.4), 0.96, -1.05, 0, 0.9)) leute.push(t);
  }
  if (leute.length) {
    const im = new THREE.Mesh(verschmelzeTeile(leute),
                              new THREE.MeshLambertMaterial({ vertexColors: true }));
    g.add(im);
    /* Merken: sitzt ein ECHTER Zivilist in diesem Wagen, werden die
       einfachen Sitzfiguren ausgeblendet, sonst sitzen zwei uebereinander. */
    g.userData.insassen = im;
  }
  /* Wo der Fahrer sitzt, in Wagenkoordinaten. */
  g.userData.fahrerSitz = { x: -0.44, y: 0.96, z: 0.12 };
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
  for (const [sx, sz] of [[-1, 1.35], [1, 1.35], [-1, -1.35], [1, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 0.95, 0.34, sz);
    g.add(w);
  }
  /* Stossfaenger vorn und hinten. */
  const stossMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  for (const sz of [1, -1]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.18, 0.16), stossMat);
    st.position.set(0, 0.45, sz * 2.22);
    g.add(st);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.08), lightMat);
    l.position.set(sx * 0.6, 0.7, 2.2);
    g.add(l);
  }
  /* Rueckleuchten. */
  const rotMat = new THREE.MeshBasicMaterial({ color: 0xd83a2a });
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), rotMat);
    l.position.set(sx * 0.62, 0.74, -2.22);
    g.add(l);
  }
  scene.add(g);
  return g;
}

/* ======================= Helikopter ======================= */
const helis = [];
const _hOben = new THREE.Vector3(0, 1, 0);
const _hAchse = new THREE.Vector3();

function makeHeliMesh() {
  const g = new THREE.Group();
  const lack = new THREE.MeshLambertMaterial({ color: 0x2b3550 });
  const dunkel = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const glas = new THREE.MeshLambertMaterial({ color: 0x9fd2e8 });

  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 4.2), lack);
  rumpf.position.y = 0.2; rumpf.castShadow = true;
  g.add(rumpf);
  const kanzel = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), glas);
  kanzel.scale.set(0.95, 0.8, 1.1);
  kanzel.position.set(0, 0.25, 2.1);
  g.add(kanzel);
  /* Pilot und Beobachter in der Kanzel - vorher flogen die Hubschrauber
     unbemannt ueber die Stadt. Das Glas wird dafuer halbdurchsichtig. */
  glas.transparent = true; glas.opacity = 0.45; glas.depthWrite = false;
  const besatzung = [];
  for (const sx of [-1, 1])
    for (const t of sitzMensch(sx * 0.42, -0.28, 1.85, 0, 0.8)) besatzung.push(t);
  g.add(new THREE.Mesh(verschmelzeTeile(besatzung),
                       new THREE.MeshLambertMaterial({ vertexColors: true })));
  const heck = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 3.6), lack);
  heck.position.set(0, 0.55, -3.4); heck.castShadow = true;
  g.add(heck);
  const finne = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.8), lack);
  finne.position.set(0, 1.1, -4.9);
  g.add(finne);

  // Kufen
  for (const sx of [-1, 1]) {
    const kufe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3.4), dunkel);
    kufe.position.set(sx * 0.85, -0.85, 0.2);
    g.add(kufe);
    for (const sz of [1.1, -1.1]) {
      const strebe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), dunkel);
      strebe.position.set(sx * 0.85, -0.45, sz);
      g.add(strebe);
    }
  }

  /* Rotor: vier Blätter plus eine fast durchsichtige Scheibe – im Flug
     verschmilzt beides zum typischen Rotorkreis. */
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), dunkel);
  mast.position.y = 1.35;
  g.add(mast);
  const rotor = new THREE.Group();
  /* Rotor deutlich über dem Rumpf – sonst steht man beim Landen mitten
     zwischen den Blättern. */
  rotor.position.y = 1.95;
  const blattGeo = new THREE.BoxGeometry(0.26, 0.06, 7.2);
  /* Zwei Balken ergeben vier Blätter (jeder Balken reicht nach beiden Seiten). */
  for (let i = 0; i < 2; i++) {
    const blatt = new THREE.Mesh(blattGeo, dunkel);
    blatt.rotation.y = i * Math.PI / 2;
    rotor.add(blatt);
  }
  const scheibe = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24),
    new THREE.MeshBasicMaterial({ color: 0x9aa3b5, transparent: true, opacity: 0.16,
                                 side: THREE.DoubleSide, depthWrite: false }));
  scheibe.rotation.x = -Math.PI / 2;
  rotor.add(scheibe);
  g.add(rotor);

  const heckRotor = new THREE.Group();
  heckRotor.position.set(0.28, 1.1, -4.9);
  for (let i = 0; i < 3; i++) {
    const blatt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.06), dunkel);
    blatt.rotation.z = i * Math.PI / 3;
    heckRotor.add(blatt);
  }
  g.add(heckRotor);

  const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  lampe.position.set(0, -0.7, -1.6);
  g.add(lampe);

  /* Suchscheinwerfer: ein offener Kegel als Lichtstrahl. Er hängt nicht am
     Rumpf, sondern in der Szene – so kann er unabhängig von der Kurvenlage
     senkrecht nach unten auf die Straße zeigen. */
  /* Breites Ende oben in der Geometrie – nach dem Ausrichten zeigt es
     zum Boden, das schmale zum Hubschrauber. */
  const strahlGeo = new THREE.CylinderGeometry(6.5, 0.5, 1, 14, 1, true);
  const strahl = new THREE.Mesh(strahlGeo, new THREE.MeshBasicMaterial({
    color: 0xfff0c0, transparent: true, opacity: 0.13,
    side: THREE.DoubleSide, depthWrite: false }));
  scene.add(strahl);
  const fleck = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true,
                                  opacity: 0.16, depthWrite: false }));
  fleck.rotation.x = -Math.PI / 2;
  scene.add(fleck);

  /* Ein echter Polizeihubschrauber ist rund 15 m lang. In dieser Größe
     passt der Held aufrecht zwischen Dach und Rotor. */
  g.scale.setScalar(1.9);
  g.userData.heli = true;
  scene.add(g);
  return { mesh: g, rotor, heckRotor, lampe, strahl, fleck };
}

/* Höchstes Haus entlang einer Flugrunde suchen.
   Der Hubschrauber muss darüber bleiben, sonst fliegt er durch die Häuser. */
function hoechstesHausAufRunde(mx, mz, radius) {
  let hoch = 0;
  for (let i = 0; i < 72; i++) {
    const w = (i / 72) * Math.PI * 2;
    const x = mx + Math.cos(w) * radius;
    const z = mz + Math.sin(w) * radius;
    for (const c of colliders) {
      /* Etwas Puffer um das Haus herum – der Rotor ist breiter als der Rumpf. */
      if (x > c.x0 - 9 && x < c.x1 + 9 && z > c.z0 - 9 && z < c.z1 + 9) {
        if (c.h > hoch) hoch = c.h;
      }
    }
  }
  return hoch;
}

function spawnHelis() {
  for (let i = 0; i < CFG.heliCount; i++) {
    const teile = makeHeliMesh();
    helis.push({
      ...teile,
      /* Jeder Hubschrauber zieht seine eigene weite Runde über der Stadt. */
      mx: rand(-70, 70), mz: rand(-70, 70),
      radius: rand(60, 130),
      winkel: rand(0, Math.PI * 2),
      tempo: rand(0.045, 0.085) * (Math.random() < 0.5 ? 1 : -1),
      hoehe: 0,      // wird gleich aus den Hausdächern bestimmt
      wanken: rand(0, Math.PI * 2),
    });
    const h = helis[helis.length - 1];
    /* Reiseflughöhe: sicher über dem höchsten Dach der eigenen Runde. */
    h.hoehe = hoechstesHausAufRunde(h.mx, h.mz, h.radius) + rand(16, 26);
  }
}

/* Deckfläche eines Hubschraubers – darauf kann man landen und mitfliegen. */
function heliAABB(h) {
  const p = h.mesh.position;
  return { x0: p.x - 2.9, x1: p.x + 2.9, z0: p.z - 4.2, z1: p.z + 4.2, top: p.y + 1.9 };
}

function updateHelis(dt) {
  for (const h of helis) {
    const vorherX = h.mesh.position.x, vorherZ = h.mesh.position.z;
    h.winkel += h.tempo * dt;
    h.wanken += dt * 0.7;
    const x = h.mx + Math.cos(h.winkel) * h.radius;
    const z = h.mz + Math.sin(h.winkel) * h.radius;
    const y = h.hoehe + Math.sin(h.wanken) * 1.4;
    h.mesh.position.set(x, y, z);
    /* Nase in Flugrichtung, dazu leichte Kurvenlage – ohne das wirkt der
       Flug wie ein Modell an der Schnur. */
    const dx = x - vorherX, dz = z - vorherZ;
    if (dx * dx + dz * dz > 1e-6) h.mesh.rotation.y = Math.atan2(dx, dz);
    h.mesh.rotation.z = lerp(h.mesh.rotation.z, h.tempo > 0 ? -0.18 : 0.18, Math.min(1, dt * 2));
    h.mesh.rotation.x = -0.06;
    h.rotor.rotation.y += dt * 26;
    h.heckRotor.rotation.x += dt * 34;
    h.lampe.visible = (elapsed % 1.1) < 0.55;

    /* Bei einem Überfall zieht ein Hubschrauber über den Tatort und kreist
       enger – wie eine echte Polizeistaffel. */
    if (h.zielMitte) {
      h.mx = lerp(h.mx, h.zielMitte.x, Math.min(1, dt * 0.25));
      h.mz = lerp(h.mz, h.zielMitte.z, Math.min(1, dt * 0.25));
      h.radius = lerp(h.radius, 34, Math.min(1, dt * 0.25));
    }

    /* Suchscheinwerfer: wandert langsam über den Boden. */
    const zx = h.sucheX !== undefined ? h.sucheX : x;
    const zz = h.sucheZ !== undefined ? h.sucheZ : z;
    h.sucheWinkel = (h.sucheWinkel || 0) + dt * 0.5;
    const zielX = (h.zielMitte ? h.zielMitte.x : x) + Math.cos(h.sucheWinkel) * 14;
    const zielZ = (h.zielMitte ? h.zielMitte.z : z) + Math.sin(h.sucheWinkel * 0.7) * 14;
    h.sucheX = lerp(zx, zielX, Math.min(1, dt * 1.2));
    h.sucheZ = lerp(zz, zielZ, Math.min(1, dt * 1.2));
    const boden = groundY(h.sucheX, h.sucheZ);
    const laenge = Math.max(4, y - boden);
    h.strahl.position.set((x + h.sucheX) / 2, boden + laenge / 2, (z + h.sucheZ) / 2);
    h.strahl.scale.set(1, laenge, 1);
    /* Kegel entlang der Verbindung Hubschrauber -> Bodenpunkt drehen. */
    const rx = h.sucheX - x, ry = boden - y, rz = h.sucheZ - z;
    const len = Math.hypot(rx, ry, rz) || 1;
    _hAchse.set(rx / len, ry / len, rz / len);
    h.strahl.quaternion.setFromUnitVectors(_hOben, _hAchse);
    h.fleck.position.set(h.sucheX, boden + 0.06, h.sucheZ);
    h.vx = dt > 0 ? dx / dt : 0;
    h.vz = dt > 0 ? dz / dt : 0;
  }
}

function collidePlayerHelis(prevY) {
  const p = player.pos, r = player.radius;
  for (const h of helis) {
    const b = heliAABB(h);
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r &&
        p.y < b.top && prevY >= b.top - 0.4 && player.vel.y <= 0.01) {
      p.y = b.top;
      player.vel.y = 0;
      player.onGround = true;
      player.platform = h;
      // mit dem Hubschrauber mitfliegen
      p.x += (h.vx || 0) * 0.016;
      p.z += (h.vz || 0) * 0.016;
    }
  }
}

/* Baut ein Fahrzeug nach Typ. Alles aus Kisten, damit es zum Stil passt. */
function makeFahrzeugMesh(typ, farbe) {
  if (typ.art === 'pkw') return makeCarMesh(farbe);
  const g = new THREE.Group();
  const L = typ.laenge, B = typ.breite;
  const lack = new THREE.MeshLambertMaterial({ color: farbe });
  const dunkel = new THREE.MeshLambertMaterial({ color: 0x17181c });
  /* Halbdurchsichtig: sonst sieht man die Fahrgaeste dahinter nicht. */
  const glas = new THREE.MeshLambertMaterial({
    color: 0x5c7f96, transparent: true, opacity: 0.34, depthWrite: false });

  if (typ.art === 'taxi') {
    const auto = makeCarMesh(0xf2c12e);
    const schild = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0 }));
    schild.position.set(0, 1.56, -0.2);
    auto.add(schild);
    for (const sz of [1, -1]) {                       // Schachbrettstreifen
      const streifen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 2.6),
        new THREE.MeshLambertMaterial({ color: 0x1b1b1f }));
      streifen.position.set(sz * 0.97, 0.75, 0);
      auto.add(streifen);
    }
    return auto;
  }
  if (typ.art === 'polizei') {
    const auto = makeCarMesh(0xf0f0f2);
    for (const sz of [1, -1]) {
      const tuer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x1c3f8c }));
      tuer.position.set(sz * 0.97, 0.62, 0);
      auto.add(tuer);
    }
    const balken = new THREE.Group();
    for (const [sx, col] of [[-0.28, 0x2f6fff], [0.28, 0xff3020]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
        new THREE.MeshBasicMaterial({ color: col }));
      l.position.set(sx, 0, 0);
      balken.add(l);
    }
    balken.position.set(0, 1.5, -0.2);
    auto.add(balken);
    auto.userData.blaulicht = balken;
    return auto;
  }
  // Bus und LKW
  const raeder = (positionen) => {
    const geo = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 10);
    for (const [sx, sz] of positionen) {
      const w = new THREE.Mesh(geo, dunkel);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * (B / 2 - 0.1), 0.46, sz);
      g.add(w);
    }
  };
  if (typ.art === 'bus') {
    /* Frueher war der Bus EIN voller Kasten, und die Scheiben klebten
       aussen darauf. Die Fahrgaeste sassen also in massivem Blech - man
       hat nie jemanden gesehen. Jetzt bleibt das Fensterband offen: unten
       Blech, oben Blech, dazwischen nur Glas und schmale Pfosten. */
    const fUnten = 1.45, fOben = 2.35;   // Fensterband
    const unten = new THREE.Mesh(new THREE.BoxGeometry(B, fUnten - 0.35, L), lack);
    unten.position.y = (fUnten + 0.35) / 2; unten.castShadow = true; g.add(unten);
    const dach = new THREE.Mesh(new THREE.BoxGeometry(B, 2.35 + 0.35 - fOben, L), lack);
    dach.position.y = (fOben + 2.35 + 0.35) / 2; dach.castShadow = true; g.add(dach);
    /* Rueckwand und Pfosten halten das Dach optisch. */
    const rueck = new THREE.Mesh(new THREE.BoxGeometry(B, fOben - fUnten, 0.12), lack);
    rueck.position.set(0, (fUnten + fOben) / 2, -L / 2 + 0.06); g.add(rueck);
    for (const sx of [-1, 1]) for (let i = -2; i <= 2; i++) {
      const pf = new THREE.Mesh(new THREE.BoxGeometry(0.1, fOben - fUnten, 0.12), lack);
      pf.position.set(sx * (B / 2 - 0.05), (fUnten + fOben) / 2, i * (L / 5.2)); g.add(pf);
    }
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, fOben - fUnten, L - 0.3), glas);
      f.position.set(sx * (B / 2 - 0.03), (fUnten + fOben) / 2, 0); g.add(f);
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(B - 0.15, fOben - fUnten, 0.06), glas);
    front.position.set(0, (fUnten + fOben) / 2, L / 2 - 0.03); g.add(front);
    /* ---- Innenraum ----
       Bisher schwebten hier nur ein paar geschrumpfte Sitzfiguren (Groesse
       0,8, also 1,40 m) in einem leeren Kasten. Jetzt gibt es einen Boden,
       Sitzreihen mit Lehnen zu beiden Seiten des Ganges, Haltestangen,
       eine Deckenleuchte und einen Fahrerplatz mit Lenkrad. */
    const BUS_BODEN = 1.03, BUS_BANK = 1.45;
    const innen = [];
    const iTeil = (bx, by, bz, px, py, pz, farbe) =>
      innen.push({ geo: sitzForm('box', bx, by, bz), farbe, x: px, y: py, z: pz });
    iTeil(B - 0.2, 0.08, L - 0.3, 0, BUS_BODEN, 0, 0x2b2f35);        // Boden
    iTeil(B - 0.5, 0.10, L - 3.0, 0, 2.30, -0.6, 0xf2f0e4);          // Deckenlicht
    /* Sitzplaetze: vier Reihen je Seite, Bank und Lehne. */
    const busPlaetze = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const pz = -L / 2 + 2.6 + i * ((L - 5.2) / 3);
        const px = sx * (B / 2 - 0.52);
        iTeil(0.86, 0.10, 0.52, px, BUS_BANK - 0.05, pz + 0.04, 0x2e4a63);
        iTeil(0.84, 0.56, 0.10, px, BUS_BANK + 0.30, pz - 0.26, 0x35566f);
        busPlaetze.push({ x: px, y: BUS_BANK, z: pz, ry: 0 });
      }
      /* Haltestange laengs unter der Decke. */
      iTeil(0.05, 0.05, L - 3.4, sx * (B / 2 - 0.55), 2.12, -0.4, 0x8b929c);
    }
    /* Fahrerplatz: Sitz, Lenkrad, Trennwand. */
    const fz = L / 2 - 1.3, fx = -(B / 2 - 0.55);
    iTeil(0.56, 0.10, 0.52, fx, BUS_BANK - 0.05, fz, 0x24272c);
    iTeil(0.54, 0.60, 0.10, fx, BUS_BANK + 0.32, fz - 0.28, 0x24272c);
    iTeil(B - 0.3, 0.34, 0.30, 0, BUS_BANK + 0.42, L / 2 - 0.55, 0x282c31);
    {
      const ring = new THREE.TorusGeometry(0.21, 0.032, 6, 14);
      ring.rotateX(Math.PI / 2 - 0.30);
      innen.push({ geo: ring, farbe: 0x15171a, x: fx, y: BUS_BANK + 0.30, z: fz + 0.52 });
    }
    g.add(new THREE.Mesh(verschmelzeTeile(innen),
                         new THREE.MeshLambertMaterial({ vertexColors: true })));
    /* Die einfachen Sitzfiguren bleiben als Rueckfall fuer weit entfernte
       Busse - in der Naehe werden sie durch echte Zivilisten ersetzt. */
    const leute = [];
    for (const pl of busPlaetze) {
      if (Math.random() < 0.35) continue;
      for (const t of sitzMensch(pl.x, pl.y, pl.z, 0, 0.92)) leute.push(t);
    }
    for (const t of sitzMensch(fx, BUS_BANK, fz, 0, 0.92)) leute.push(t);
    if (leute.length) {
      const im = new THREE.Mesh(verschmelzeTeile(leute),
                                new THREE.MeshLambertMaterial({ vertexColors: true }));
      g.add(im);
      g.userData.insassen = im;
    }
    /* Fuer die echten Fahrgaeste: alle Plaetze samt Fahrerplatz. */
    g.userData.sitzplaetze = busPlaetze.concat([{ x: fx, y: BUS_BANK, z: fz, ry: 0 }]);
    raeder([[-1, L / 2 - 1.3], [1, L / 2 - 1.3], [-1, -L / 2 + 1.6], [1, -L / 2 + 1.6]]);
  } else {                                            // LKW
    /* Die Kabine war ein voller Kasten mit aufgeklebten Scheiben - der
       Fahrer sass mitten im Blech und war nie zu sehen. Jetzt ist sie
       hohl: Unterbau bis Fensterhoehe, Dach darueber, dazwischen nur
       Pfosten und Glas. */
    const kz = L / 2 - 1.15;
    const fUnten = 1.55, fOben = 2.25;
    const unten = new THREE.Mesh(new THREE.BoxGeometry(B, fUnten - 0.4, 2.3), lack);
    unten.position.set(0, (fUnten + 0.4) / 2, kz); unten.castShadow = true; g.add(unten);
    const dach = new THREE.Mesh(new THREE.BoxGeometry(B, 0.18, 2.3), lack);
    dach.position.set(0, fOben + 0.09, kz); dach.castShadow = true; g.add(dach);
    const rueck = new THREE.Mesh(new THREE.BoxGeometry(B, fOben - fUnten, 0.12), lack);
    rueck.position.set(0, (fUnten + fOben) / 2, kz - 1.09); g.add(rueck);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pf = new THREE.Mesh(new THREE.BoxGeometry(0.11, fOben - fUnten, 0.11), lack);
      pf.position.set(sx * (B / 2 - 0.055), (fUnten + fOben) / 2, kz + sz * 1.09); g.add(pf);
    }
    const scheibe = new THREE.Mesh(new THREE.BoxGeometry(B - 0.22, fOben - fUnten, 0.05), glas);
    scheibe.position.set(0, (fUnten + fOben) / 2, L / 2 - 0.05); g.add(scheibe);
    for (const sx of [-1, 1]) {
      const seite = new THREE.Mesh(new THREE.BoxGeometry(0.05, fOben - fUnten, 2.0), glas);
      seite.position.set(sx * (B / 2 - 0.03), (fUnten + fOben) / 2, kz); g.add(seite);
    }
    /* Fahrer und manchmal ein Beifahrer - sitzen jetzt so hoch, dass Kopf
       und Schultern im Fensterband stehen. */
    const leute = [];
    for (const t of sitzMensch(-(B / 2 - 0.6), 1.12, kz - 0.15, 0, 0.78)) leute.push(t);
    if (Math.random() < 0.5)
      for (const t of sitzMensch((B / 2 - 0.6), 1.12, kz - 0.15, 0, 0.78)) leute.push(t);
    g.add(new THREE.Mesh(verschmelzeTeile(leute),
                         new THREE.MeshLambertMaterial({ vertexColors: true })));
    const kasten = new THREE.Mesh(new THREE.BoxGeometry(B + 0.1, 2.3, L - 2.6),
      new THREE.MeshLambertMaterial({ color: 0xd9dbe0 }));
    kasten.position.set(0, 1.6, -1.3); kasten.castShadow = true; g.add(kasten);
    raeder([[-1, L / 2 - 1.2], [1, L / 2 - 1.2], [-1, -L / 2 + 1.4], [1, -L / 2 + 1.4]]);
  }
  const licht = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), licht);
    l.position.set(sx * (B / 2 - 0.4), 0.75, L / 2 + 0.02);
    g.add(l);
  }
  scene.add(g);
  return g;
}

/* ======================= Ampeln =======================
   Eine gemeinsame Schaltung für die ganze Stadt: erst haben die
   Ost-West-Straßen Grün, dann die Nord-Süd-Straßen. Dazwischen Gelb.
   Die Lampenköpfe liegen in zwei InstancedMesh – dadurch kosten alle
   Ampeln zusammen nur zwei Zeichenaufrufe statt hunderte. */
/* var, weil die Stadt weiter oben gebaut wird als diese Zeile steht. */
var AMPEL = { phase: 0, t: 0, gruenDauer: 9, gelbDauer: 2 };
var ampelX = null, ampelZ = null;

function baueAmpeln() {
  const stellen = [];
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j <= BLOCKS; j++) {
      const x = ORIGIN + i * PITCH, z = ORIGIN + j * PITCH;
      if (x > RIVER_X0 - 20) continue;                 // nicht im Fluss
      for (const [sx, sz] of [[1, 1], [-1, -1]]) {
        const px = x + sx * (ROAD_HALF + 1.2), pz = z + sz * (ROAD_HALF + 1.2);
        stellen.push([px, pz]);
        ziehFestPunkt(px, SLAB_H + 4.6, pz);           // Mast als Zugpunkt
        deko(0.22, 5.2, 0.22, px, SLAB_H + 2.6, pz, 0x2c3037);          // Mast
        /* Zwei getrennte Signalköpfe: einer für die Ost-West-Richtung,
           einer für Nord-Süd. Vorher saßen beide an derselben Stelle und
           es sah aus, als leuchte eine Ampel gleichzeitig rot und grün. */
        deko(0.46, 1.2, 0.46, px + 0.45, SLAB_H + 5.6, pz, 0x23262b);
        deko(0.46, 1.2, 0.46, px, SLAB_H + 4.2, pz + 0.45, 0x23262b);
      }
    }
  }
  const geo = new THREE.SphereGeometry(0.17, 8, 6);
  ampelX = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x22c55e }), stellen.length);
  ampelZ = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xef4444 }), stellen.length);
  const m = new THREE.Matrix4();
  stellen.forEach(([px, pz], i) => {
    m.makeTranslation(px + 0.45, SLAB_H + 5.6, pz + 0.26);
    ampelX.setMatrixAt(i, m);
    m.makeTranslation(px + 0.26, SLAB_H + 4.2, pz + 0.45);
    ampelZ.setMatrixAt(i, m);
  });
  ampelX.instanceMatrix.needsUpdate = true;
  ampelZ.instanceMatrix.needsUpdate = true;
  cityGroup.add(ampelX); cityGroup.add(ampelZ);
}

/* Farbe der Ampel für eine Fahrtrichtung: 'gruen' | 'gelb' | 'rot' */
function ampelFuer(axis) {
  const meins = (axis === 'x') === (AMPEL.phase === 0);
  if (!meins) return 'rot';
  return AMPEL.t > AMPEL.gruenDauer ? 'gelb' : 'gruen';
}

function updateAmpeln(dt) {
  AMPEL.t += dt;
  if (window.__WEBHERO_TEST__ !== undefined) { window.__ampelPhase = AMPEL.phase; window.__ampelX = ampelFuer('x'); window.__ampelZ = ampelFuer('z'); }
  if (AMPEL.t > AMPEL.gruenDauer + AMPEL.gelbDauer) { AMPEL.t = 0; AMPEL.phase = 1 - AMPEL.phase; }
  if (!ampelX) return;
  const farbe = (axis) => {
    const z = ampelFuer(axis);
    return z === 'gruen' ? 0x22c55e : z === 'gelb' ? 0xeab308 : 0xef4444;
  };
  ampelX.material.color.setHex(farbe('x'));
  ampelZ.material.color.setHex(farbe('z'));
}

/* Nächste Kreuzung vor dem Fahrzeug (Abstand entlang der Fahrtrichtung). */
function abstandZurKreuzung(car) {
  let best = Infinity;
  for (let i = 0; i <= BLOCKS; i++) {
    const linie = ORIGIN + i * PITCH;
    const d = (linie - car.s) * car.dir;
    if (d > 0 && d < best) best = d;
  }
  return best;
}

function spawnCars() {
  const lines = [];
  for (let i = 0; i <= BLOCKS; i++) lines.push(ORIGIN + i * PITCH);
  for (let n = 0; n < CFG.carCount; n++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const line = pick(lines);
    const laneSign = Math.random() < 0.5 ? 1 : -1;
    const lane = line + laneSign * 3;
    const isBridgeRoad = axis === 'x' && line === BRIDGE_Z;
    const typ = waehleFahrzeug();
    /* ---- Die Brueckenstrasse endet an der Kaimauer drueben ----
       Sie reichte bis SHORE_X1 - 10, also mitten in den Stadtteil am
       anderen Ufer. Dort liegt aber ein EIGENES Strassenraster (SHORE_*),
       und die Wagen fuhren stur auf ihrer Spur weiter - quer durch die
       Haeuser. Genau das war der Bus, der im Gebaeude steckte.
       Jetzt ist an der Kaimauer Schluss; dort wenden sie und fahren
       zurueck ueber die Bruecke. */
    const sMin = -186, sMax = isBridgeRoad ? SHORE_X0 - 5 : 186;
    cars.push({
      axis, lane, dir: laneSign, // Rechtsverkehr angenähert
      /* Startpunkt INNERHALB des Strassenrasters. Ein Auto, das zwischen
         der aeussersten Kreuzung und dem Kartenrand startet, erreicht nie
         eine Kreuzung - es fuhr geradewegs aus der Karte und wurde auf die
         andere Seite gesetzt. Auf der Brueckenstrasse darf es weiter
         draussen anfangen, dort geht es ja ueber den Fluss. */
      s: isBridgeRoad ? rand(sMin, sMax)
                      : rand(ORIGIN, ORIGIN + BLOCKS * PITCH), sMin, sMax,
      speed: rand(8, 13) * (typ.art === 'bus' || typ.art === 'lkw' ? 0.72 : 1),
      tempoJetzt: 0, hupCd: 0,
      typ,
      mesh: makeFahrzeugMesh(typ, typ.art === 'bus' ? pick([0x2f6fc8, 0x3b7a3f, 0xc23b30])
                                 : typ.art === 'lkw' ? pick([0x4a5058, 0x2f4f7a]) : pick(CAR_COLORS)),
      vx: 0, vz: 0,
      hitCd: 0, kurve: 0, kreuzung: null,
    });
  }
}
spawnCars();
spawnHelis();
/* Die losen Gegenstaende erst HIER aufstellen, nicht in buildCity: die
   Liste ZIEH wird weiter unten im Modul angelegt, und buildCity laeuft
   frueher - ein Aufruf von dort traf auf eine noch nicht angelegte
   Konstante ("Cannot access before initialization"). */
baueZiehObjekte();

/* Verkehrsdichte nach Tageszeit: morgens und am späten Nachmittag ist
   Berufsverkehr, nachts ist die Stadt fast leer. Autos werden dazu nicht
   erzeugt oder gelöscht, sondern nur ausgeblendet und stillgelegt –
   das kostet nichts und flackert nicht. */
function verkehrsAnteil() {
  const t = TAG.zeit;                       // 0 = Mitternacht, 0.5 = Mittag
  if (t < 0.20) return 0.28;                // tiefe Nacht
  if (t < 0.30) return 0.55 + (t - 0.20) * 4.5;   // Morgen: es füllt sich
  if (t < 0.36) return 1.0;                 // Berufsverkehr
  if (t < 0.66) return 0.78;                // Tag
  if (t < 0.76) return 1.0;                 // Feierabend
  if (t < 0.88) return 0.7;                 // Abend
  return 0.4;
}

/* ---- An Kreuzungen abbiegen ----
   Frueher fuhr jedes Auto stur geradeaus bis zum Kartenrand und wurde
   dort auf die andere Seite gesetzt: es war weg und tauchte am
   gegenueberliegenden Stadtrand wieder auf. Beim Fluchtauto hiess das,
   dass man es genau dann verlor, wenn man es fast hatte.

   Jetzt wird an jeder Kreuzung entschieden. Ist dahinter noch eine
   Kreuzung, biegt das Auto nur manchmal ab; ist der Rand erreicht, biegt
   es immer ab und bleibt damit in der Stadt.

   Koordinaten: bei axis 'x' ist s die x- und lane die z-Koordinate, bei
   axis 'z' andersherum. Beim Abbiegen tauschen die beiden ihre Rolle -
   die bisherige Querlage wird zur neuen Laengslage. */
function autoKreuzung(car, linie) {
  const weiter = linie + car.dir * PITCH;
  const drin = weiter > car.sMin + 6 && weiter < car.sMax - 6 &&
               !(car.axis === 'x' && weiter > AUTO_X_MAX);
  if (drin && Math.random() > (car.flucht ? 0.30 : 0.14)) return false;
  /* Am Rand geht es in die Stadt hinein, sonst nach Lust und Laune. */
  const nd = !drin ? (car.lane > 0 ? -1 : 1) : (Math.random() < 0.5 ? 1 : -1);
  const neueLane = linie + nd * 3;
  const neuesS = car.lane;
  /* Nicht ins Wasser und nicht aus der Karte abbiegen.
     Welche der beiden Zahlen eine x-Koordinate ist, haengt von der
     BISHERIGEN Achse ab: faehrt das Auto in x, wird die neue Spur zur
     x-Koordinate; faehrt es in z, wird die neue Laengslage zur
     x-Koordinate. Der Fluss beginnt bei RIVER_X0. */
  const neuesX = car.axis === 'x' ? neueLane : neuesS;
  if (neuesX > AUTO_X_MAX) return false;
  if (neuesS < car.sMin + 4 || neuesS > car.sMax - 4) return false;
  car.axis = car.axis === 'x' ? 'z' : 'x';
  car.lane = neueLane;
  car.s = neuesS;
  car.dir = nd;
  car.kreuzung = null;
  /* In der Kurve wird abgebremst - sonst rutscht das Auto quer ueber die
     Kreuzung. Und das Bild zieht ueber ein paar Zehntel weich nach, statt
     die drei Meter Fahrbahnwechsel in einem Bild zu springen. */
  car.tempoJetzt *= 0.55;
  car.kurve = 0.55;
  return true;
}

function updateCars(dt) {
  updateAmpeln(dt);
  const anteil = verkehrsAnteil();
  const aktiv = Math.round(cars.length * anteil);
  for (const car of cars) {
    /* Jedes Auto hat eine feste Nummer; nur die ersten n sind unterwegs.
       So bleibt dasselbe Auto den ganzen Tag über sichtbar. */
    if (car.nr === undefined) car.nr = cars.indexOf(car);
    const fahren = car.nr < aktiv || car.flucht;
    if (car.mesh.visible !== fahren) car.mesh.visible = fahren;
    car.aus = !fahren;
    if (!fahren) { car.tempoJetzt = 0; continue; }
    let ziel = car.speed;
    const eigenLaenge = (car.typ ? car.typ.laenge : 4.4);
    /* Ein Fluchtauto hält weder an Ampeln noch hinter Vordermännern –
       sonst steht es beim ersten Rot und die Verfolgung ist vorbei. */
    if (!car.flucht) {
      /* Vordermann: Abstand hängt jetzt von der Fahrzeuglänge ab. */
      for (const o of cars) {
        if (o === car || o.aus || o.axis !== car.axis || Math.abs(o.lane - car.lane) > 0.5) continue;
        const gap = (o.s - car.s) * car.dir - (eigenLaenge + (o.typ ? o.typ.laenge : 4.4)) / 2;
        if (gap > 0 && gap < 9) ziel = Math.min(ziel, (o.tempoJetzt || 0) * 0.85);
        if (gap <= 0 && gap > -3) ziel = 0;
      }

      /* Ampel: vor der Haltelinie stehenbleiben, wenn nicht Grün. */
      const zustand = ampelFuer(car.axis);
      if (zustand !== 'gruen') {
        const d = abstandZurKreuzung(car) - (ROAD_HALF + eigenLaenge / 2 + 0.6);
        const bremsweg = (car.tempoJetzt * car.tempoJetzt) / 16 + 2;
        if (d > -1.5 && d < bremsweg) ziel = Math.min(ziel, Math.max(0, d * 1.6));
      }
    }

    /* ---- Hält jemand auf der Fahrbahn? Bremsen und hupen ----
       Das galt bisher nur fuer den Helden: Passanten wurden ueberfahren,
       ohne dass ein Auto auch nur langsamer wurde. Jetzt zaehlt jeder, der
       vor dem Wagen auf der Strasse steht. */
    const px = car.axis === 'x' ? car.s : car.lane;
    const pz = car.axis === 'x' ? car.lane : car.s;
    let hindernis = 0;                 // Abstand nach vorn, 0 = keins
    const pruefe = (ox, oz, oy) => {
      if (oy > 2.2) return;
      const dx2 = ox - px, dz2 = oz - pz;
      const vorne2 = car.axis === 'x' ? dx2 * car.dir : dz2 * car.dir;
      const seit2 = Math.abs(car.axis === 'x' ? dz2 : dx2);
      if (vorne2 <= 0 || vorne2 > 14 || seit2 > 2.4) return;
      if (!hindernis || vorne2 < hindernis) hindernis = vorne2;
    };
    if (!car.flucht) {
      /* Wer auf dem eigenen Dach steht, ist kein Hindernis - sonst bremst
         der Wagen sich selbst aus, sobald jemand mitfaehrt. */
      if (player.platform !== car) pruefe(player.pos.x, player.pos.z, player.pos.y);
      /* Nur die Passanten in der Naehe pruefen - alle waeren bei
         zweiundzwanzig Leuten und achtzig Autos ueber tausend Vergleiche
         je Bild, ohne dass es besser wuerde. */
      for (const c of civilians) {
        if (c.state === 'hurt') continue;
        if (Math.abs(c.pos.x - px) > 16 || Math.abs(c.pos.z - pz) > 16) continue;
        pruefe(c.pos.x, c.pos.z, c.pos.y);
      }
    }
    if (hindernis) {
      ziel = Math.min(ziel, Math.max(0, (hindernis - 4) * 1.2));
      car.hupCd -= dt;
      if (car.hupCd <= 0) { SFX.hupe(); car.hupCd = rand(1.4, 3); }
    } else if (car.hupCd > 0) car.hupCd -= dt;

    /* Weich beschleunigen und bremsen statt sprunghaft. */
    const rampe = ziel < car.tempoJetzt ? 14 : 4.5;
    car.tempoJetzt = car.tempoJetzt + clamp(ziel - car.tempoJetzt, -rampe * dt, rampe * dt);
    const speed = car.tempoJetzt;
    car.s += car.dir * speed * dt;
    /* Auf einer Kreuzung? Dann wird ueber das Abbiegen entschieden. */
    const kIdx = Math.round((car.s - ORIGIN) / PITCH);
    if (car.kreuzung !== kIdx && Math.abs(car.s - (ORIGIN + kIdx * PITCH)) < 1.4) {
      car.kreuzung = kIdx;
      autoKreuzung(car, ORIGIN + kIdx * PITCH);
    }
    /* Rueckfall: die Brueckenstrasse fuehrt ueber den Fluss zum anderen
       Ufer und hat dort keine Kreuzung mehr - dort bleibt es beim alten
       Umsetzen. Alle anderen kehren an der aeussersten Kreuzung um, statt
       quer durch die Stadt versetzt zu werden. */
    if (car.s > car.sMax || car.s < car.sMin) {
      /* Umkehren statt versetzen - auch auf der Bruecke. Die Spur wird
         dabei gespiegelt (aus L+3 wird L-3), also die Gegenspur. */
      const bruecke = car.axis === 'x' && Math.abs(car.lane - BRIDGE_Z) < 6;
      car.s = clamp(car.s, bruecke ? car.sMin + 2 : ORIGIN,
                    bruecke ? car.sMax - 2 : ORIGIN + BLOCKS * PITCH);
      car.dir = -car.dir;
      car.lane += car.dir * 6;                 // auf die Gegenspur
      car.tempoJetzt *= 0.4;
      car.kurve = 0.7;                         // Bild zieht weich nach
      car.kreuzung = null;
    }
    if (car.kurve > 0) car.kurve -= dt;
    if (car.hitCd > 0) car.hitCd -= dt;

    /* Sollstellung und Sollrichtung. In der Kurve zieht das Bild weich
       nach, sonst steht es sofort dort. */
    let zx, zz, zy;
    if (car.axis === 'x') {
      zx = car.s; zz = car.lane; zy = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.vx = car.dir * speed; car.vz = 0;
    } else {
      zx = car.lane; zz = car.s; zy = car.dir > 0 ? 0 : Math.PI;
      car.vx = 0; car.vz = car.dir * speed;
    }
    if (car.kurve > 0) {
      const k = Math.min(1, dt * 7);
      car.mesh.position.x = lerp(car.mesh.position.x, zx, k);
      car.mesh.position.z = lerp(car.mesh.position.z, zz, k);
      let dw = zy - car.mesh.rotation.y;
      while (dw > Math.PI) dw -= Math.PI * 2;
      while (dw < -Math.PI) dw += Math.PI * 2;
      car.mesh.rotation.y += dw * k;
    } else {
      car.mesh.position.set(zx, 0, zz);
      car.mesh.rotation.y = zy;
    }
    const bl = car.mesh.userData && car.mesh.userData.blaulicht;
    if (bl) {
      const an = (elapsed * 6) % 2 < 1;
      bl.children[0].visible = an;
      bl.children[1].visible = !an;
    }
  }
}

function carAABB(car) {
  /* Box passt jetzt zum Fahrzeug – auf einen Bus konnte man vorher nicht
     richtig steigen, weil die Box die eines PKW war. */
  const t = car.typ || { laenge: 4.4, breite: 1.9, art: 'pkw' };
  const halbL = t.laenge / 2 + 0.1, halbB = t.breite / 2 + 0.1;
  const hx = car.axis === 'x' ? halbL : halbB;
  const hz = car.axis === 'x' ? halbB : halbL;
  const cx = car.mesh.position.x, cz = car.mesh.position.z;
  const dach = t.art === 'bus' ? 2.6 : t.art === 'lkw' ? 2.8 : 1.32;
  return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, top: dach };
}

function collidePlayerCars(prevY) {
  const p = player.pos, r = player.radius;
  for (const car of cars) {
    if (car.aus) continue;
    const b = carAABB(car);
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r && p.y < b.top) {
      if (prevY >= b.top - 0.15 && player.vel.y <= 0.01) {
        p.y = b.top;
        player.vel.y = 0;
        player.onGround = true;
        player.platform = car;
      } else if (p.y < b.top - 0.3) {
        /* ---- Seitlicher Rempler ----
           Erst HERAUSSCHIEBEN, dann wegstossen. Vorher gab es nur einen
           Stoss auf die Geschwindigkeit - aus einem Kasten, der einen in
           jedem Bild wieder einholt, kommt man damit nicht heraus, und man
           steckte im Auto fest. Herausgeschoben wird ueber die naechste
           Seitenflaeche. */
        const wegX0 = p.x - (b.x0 - r), wegX1 = (b.x1 + r) - p.x;
        const wegZ0 = p.z - (b.z0 - r), wegZ1 = (b.z1 + r) - p.z;
        const kleinste = Math.min(wegX0, wegX1, wegZ0, wegZ1);
        if (kleinste === wegX0) p.x = b.x0 - r;
        else if (kleinste === wegX1) p.x = b.x1 + r;
        else if (kleinste === wegZ0) p.z = b.z0 - r;
        else p.z = b.z1 + r;
        const dx = p.x - car.mesh.position.x, dz = p.z - car.mesh.position.z;
        const d = Math.hypot(dx, dz) || 1;
        player.vel.x += (dx / d) * 7 + car.vx * 0.6;
        player.vel.z += (dz / d) * 7 + car.vz * 0.6;
        player.vel.y = Math.max(player.vel.y, 4);
        if (car.hitCd <= 0 && Math.hypot(car.vx, car.vz) > 5) {
          car.hitCd = 1;
          damagePlayer(3, car.mesh.position);
        }
      }
    }
  }
}

/* ======================= Zivilisten ======================= */
const civilians = [];

function sidewalkLoop(bi, bj) {
  // Rechteckiger Gehwegpfad um Block (bi,bj)
  const x0 = ORIGIN + bi * PITCH + ROAD_HALF + 2, x1 = ORIGIN + (bi + 1) * PITCH - ROAD_HALF - 2;
  const z0 = ORIGIN + bj * PITCH + ROAD_HALF + 2, z1 = ORIGIN + (bj + 1) * PITCH - ROAD_HALF - 2;
  return [V3(x0, 0, z0), V3(x1, 0, z0), V3(x1, 0, z1), V3(x0, 0, z1)];
}

function spawnCivilian() {
  const bi = randi(0, BLOCKS - 1), bj = randi(0, BLOCKS - 1);
  const loop = sidewalkLoop(bi, bj);
  const wp = randi(0, 3);
  const visual = makeCharacterVisual('civilian', {});
  const start = loop[wp];
  civilians.push({
    visual, loop, wp,
    pos: V3(start.x + rand(-1, 1), 0, start.z + rand(-1, 1)),
    vel: V3(0, 0, 0),
    radius: 0.35,
    facing: rand(0, TAU),
    phase: rand(0, TAU),
    speed: rand(1.6, 2.6),
    state: 'walk',       // walk | flee | hurt
    fleeT: 0, hurtT: 0, hp: 20,
    savedCd: 0,
    onGround: true, wall: null,
  });
}

/* ---- Wartende am Bahnsteig ----
   Sie laufen denselben Weg-Punkt-Kreis wie alle anderen, nur liegt der auf
   dem Bahnsteig. Dadurch gilt fuer sie die gesamte vorhandene Logik -
   Stehenbleiben, Umschauen, Handy - ohne Sonderfall. */
/* Einen vorhandenen Zivilisten zum Fahrgast einer Station machen: er
   bekommt den Rundweg ueber Bahnsteig und Treppe. */
function machZuFahrgast(c, sx, seite, dz) {
  const vz = dz || 0;
  const sch = UB_SCHAECHTE[seite];
  const schZ = (sch.z0 + sch.z1) / 2 + vz;
  const zSteig = seite === 0 ? [UB_STEIG_Z0 + 1.8 + vz, UB_STEIG_Z1 - 2.4 + vz]
                             : [UB_STEIG2_Z0 + 2.4 + vz, UB_STEIG2_Z1 - 1.8 + vz];
  const a = sx + rand(-10, 4);
  c.bahnsteig = sx;
  c.steigSeite = seite;
  c.loop = [
    V3(sx + sch.xKopf + (sch.xKopf > 0 ? 2.5 : -2.5), SLAB_H, schZ),
    V3(sx + sch.xFuss, UB_TIEF, schZ),
    V3(a, UB_TIEF, rand(zSteig[0], zSteig[1])),
    V3(a + rand(4, 9), UB_TIEF, rand(zSteig[0], zSteig[1])),
  ];
  c.wp = 2;
  c.festT = 0; c.letzteDist = null;
}

function spawnBahnsteigZivi(sx, seite, dz) {
  const vz = dz || 0;
  /* Der Rundweg fuehrt ueber die Treppe bis auf den Gehweg und wieder
     hinunter. Dadurch kommen die Leute sichtbar von oben herein und
     verschwinden auch wieder dorthin - vorher standen sie einfach da. */
  const sch = UB_SCHAECHTE[seite];
  const schZ = (sch.z0 + sch.z1) / 2 + vz;
  const zSteig = seite === 0 ? [UB_STEIG_Z0 + 1.8 + vz, UB_STEIG_Z1 - 2.4 + vz]
                             : [UB_STEIG2_Z0 + 2.4 + vz, UB_STEIG2_Z1 - 1.8 + vz];
  const a = sx + rand(-10, 4);
  const loop = [
    V3(sx + sch.xKopf + (sch.xKopf > 0 ? 2.5 : -2.5), SLAB_H, schZ),  // oben auf dem Gehweg
    V3(sx + sch.xFuss, UB_TIEF, schZ),                                // Fuss der Treppe
    V3(a, UB_TIEF, rand(zSteig[0], zSteig[1])),                       // Bahnsteig
    V3(a + rand(4, 9), UB_TIEF, rand(zSteig[0], zSteig[1])),
  ];
  const visual = makeCharacterVisual('civilian', {});
  const start = loop[randi(1, 3)];
  civilians.push({
    visual, loop, wp: randi(0, 3), bahnsteig: sx, steigSeite: seite,
    pos: V3(start.x, start.y, start.z),
    vel: V3(0, 0, 0),
    radius: 0.35,
    facing: rand(0, TAU),
    phase: rand(0, TAU),
    speed: rand(1.1, 1.9),
    state: 'walk',
    fleeT: 0, hurtT: 0, hp: 20,
    savedCd: 0,
    onGround: true, wall: null,
    /* Ein Teil ist zu Beginn "unterwegs" und kommt erst mit einem Zug. */
    eingestiegen: Math.random() < 0.45 ? rand(4, 45) : 0,
    zugFahrt: null, sitzIdx: -1,
  });
  const c = civilians[civilians.length - 1];
  if (c.eingestiegen > 0) c.visual.root.visible = false;
}

function nearestThreatTo(pos, maxDist) {
  let best = null, bestD = maxDist;
  for (const e of enemies) {
    if (e.dead || e.webT > 0) continue;
    const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/* Kleines Handy in der Hand – wird nur eingeblendet, wenn jemand filmt. */
function makeHandy() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x2a2e36 }));
  const glas = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x9fd2e8 }));
  glas.position.z = 0.015; m.add(glas);
  m.visible = false;
  return m;
}

/* Regenschirm – bei Regen hält ihn jeder zweite Passant hoch. Er hängt
   wie das Handy am Handknochen. */
const SCHIRM_FARBEN = [0x2a2e36, 0x2c5a8c, 0x9c2a2a, 0x3f7a44, 0x6b4a9c, 0xb8912a, 0xc4c8cc];
function makeSchirm(farbe) {
  const g = new THREE.Group();
  const dach = new THREE.Mesh(
    new THREE.ConeGeometry(0.78, 0.36, 10, 1, true),
    new THREE.MeshLambertMaterial({ color: farbe, side: THREE.DoubleSide }));
  dach.position.y = 0.52;
  g.add(dach);
  const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.78, 5),
    new THREE.MeshLambertMaterial({ color: 0x6b5335 }));
  stock.position.y = 0.24;
  g.add(stock);
  g.visible = false;
  return g;
}

const RUFE = ['Spider-Man!', 'Da ist er!', 'Danke!', 'Wahnsinn!', '📸'];

/* ======================= Vögel =======================
   Ein Schwarm zieht seine Runden über der Stadt. Alle Vögel stecken in
   einem InstancedMesh und kosten zusammen einen Zeichenaufruf. */
const VOEGEL_ANZ = 34;
let voegel = null;
const voegelDaten = [];
function baueVoegel() {
  /* Ein Vogel = zwei schmale Dreiecke als Flügel. */
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,  -0.42, 0.10, -0.16,  -0.34, 0.0, 0.20,
    0, 0, 0,   0.34, 0.0, 0.20,     0.42, 0.10, -0.16,
  ], 3));
  geo.computeVertexNormals();
  voegel = new THREE.InstancedMesh(geo,
    new THREE.MeshLambertMaterial({ color: 0x2b2f36, side: THREE.DoubleSide }),
    VOEGEL_ANZ);
  voegel.frustumCulled = false;
  scene.add(voegel);
  for (let i = 0; i < VOEGEL_ANZ; i++) {
    voegelDaten.push({
      mx: rand(-140, 140), mz: rand(-140, 140),      // Mittelpunkt der Runde
      r: rand(14, 46), h: rand(38, 96),
      w: rand(0, TAU), tempo: rand(0.12, 0.3) * (Math.random() < 0.5 ? -1 : 1),
      schlag: rand(0, TAU), schlagTempo: rand(7, 12),
    });
  }
}
function updateVoegel(dt) {
  if (!voegel) { baueVoegel(); return; }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const p = new THREE.Vector3(), sk = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < VOEGEL_ANZ; i++) {
    const v = voegelDaten[i];
    v.w += v.tempo * dt;
    v.schlag += v.schlagTempo * dt;
    const x = v.mx + Math.cos(v.w) * v.r;
    const z = v.mz + Math.sin(v.w) * v.r;
    const y = v.h + Math.sin(v.w * 2.3) * 2.5;
    /* Flügelschlag als Auf-/Abstauchen – aus der Entfernung genügt das. */
    const s = 1 + Math.sin(v.schlag) * 0.35;
    e.set(Math.sin(v.schlag) * 0.5, v.w + Math.PI / 2 * (v.tempo > 0 ? 1 : -1), 0, 'YXZ');
    m.compose(p.set(x, y, z), q.setFromEuler(e), sk.set(1, s, 1));
    voegel.setMatrixAt(i, m);
  }
  voegel.instanceMatrix.needsUpdate = true;
}

/* ---- Gestaffelte Aktualisierung ----
   Zivilisten und Ganoven waren zusammen fast die gesamte Rechenzeit der
   Simulation (1,6 von 1,8 ms). Der Großteil steht dabei irgendwo am
   anderen Ende der Stadt. Weit entfernte Figuren werden deshalb nur noch
   in jedem dritten Bild gerechnet – dafür mit dreifachem Zeitschritt, so
   dass sie genauso weit laufen wie vorher. */
let taktBild = 0;
const FERN = 60;

function updateCivilians(dtBild) {
  taktBild++;
  if (rufMeldungCd > 0) rufMeldungCd -= dtBild;
  /* Wie viele Verletzte gerade unversorgt herumliegen – davon hängt ab,
     ob der Ruf sinkt oder sich langsam wieder erholt. */
  let liegen = 0;
  for (let ci = 0; ci < civilians.length; ci++) {
    const c = civilians[ci];
    /* Der Zähler muss FEST an der Figur hängen. Ein mitlaufender Zähler,
       der nur bei manchen Figuren hochgezählt wird, verteilt die Bilder
       ungleich – einzelne Zivilisten kamen dann kaum noch dran und
       standen scheinbar still. */
    /* Eingestiegen: waehrend der Fahrt unsichtbar, danach wieder am
       Bahnsteig. So fuellt und leert sich die Station wirklich. */
    if (c.eingestiegen > 0) {
      c.eingestiegen -= dtBild;
      /* Wer einen Sitzplatz bekommen hat, faehrt SICHTBAR mit: die Figur
         wird auf ihren Platz im fahrenden Wagen gesetzt und sitzt dort.
         Vorher verschwand sie fuer die ganze Fahrt - im Zug sassen nur
         die einfachen Sitzfiguren aus dem Wagenbau. */
      if (c.zugFahrt && c.sitzIdx >= 0) {
        const t = c.zugFahrt;
        const p = (t.mesh.userData.freieSitze || [])[c.sitzIdx];
        if (p) {
          c.pos.set(t.x + p.dx, UB_TIEF, t.z + p.dz);
          c.facing = p.ry;
          /* Die Sitzbewegung setzt den Koerper 51 cm ueber die Wurzel -
             gemessen am Fussknochen. Damit die Fuesse auf dem Wagenboden
             stehen und das Becken auf der Bank sitzt, wird die Wurzel um
             eben so viel abgesenkt. */
          c.visual.root.position.set(c.pos.x, UB_TIEF, c.pos.z);
          c.visual.root.rotation.y = p.ry;
          c.visual.play('idle', { t: elapsed }, dtBild);
          if (c.visual.poseSitzen) {
            c.visual.poseSitzen(1);
            /* Becken genau auf die Sitzflaeche (Wagenboden + 48 cm)
               setzen. Gemessen statt geschaetzt: die Figuren sind
               unterschiedlich gross, ein fester Abzug wuerde die einen
               schweben und die anderen einsinken lassen. */
            /* Zwei Bedingungen, und es gilt die staerkere: das Becken soll
               auf der Bank sitzen UND die Fuesse duerfen nicht durch den
               Wagenboden. Die Figuren sind verschieden gross - mit einem
               festen Abzug schweben die einen und versinken die anderen. */
            const m = c.visual.sitzMasse ? c.visual.sitzMasse() : null;
            if (m) {
              c.visual.root.position.y +=
                Math.max((UB_TIEF + ZUG_BANK) - m.huefte, UB_TIEF - m.fuss);
            }
          }
        }
      }
      if (c.eingestiegen <= 0) {
        /* Aussteigen an der Bahnsteigkante, nicht irgendwo im Nichts. */
        if (c.zugFahrt && c.zugFahrt.besetzt) c.zugFahrt.besetzt.delete(c.sitzIdx);
        c.zugFahrt = null; c.sitzIdx = -1;
        c.visual.root.visible = true;
        c.visual.root.rotation.y = 0;
        c.wp = 2;
        const kante = c.steigSeite === 0 ? UB_STEIG_Z0 + 1.2 : UB_STEIG2_Z1 - 1.2;
        c.pos.set(c.bahnsteig + rand(-12, 12), UB_TIEF, kante);
      }
      continue;
    }
    const fern = Math.abs(c.pos.x - player.pos.x) + Math.abs(c.pos.z - player.pos.z) > FERN;
    if (fern && ((taktBild + ci) % 3)) {
      if (c.state === 'hurt' && c.hilfeBar) liegen++;
      continue;
    }
    const dt = fern ? dtBild * 3 : dtBild;
    if (c.savedCd > 0) c.savedCd -= dt;
    if (c.state === 'hurt') {
      /* Wer am Boden liegt, filmt nicht und hält keinen Schirm. Vorher
         blieben beide sichtbar und hingen neben der liegenden Figur. */
      if (c.handy) c.handy.visible = false;
      if (c.schirm) c.schirm.visible = false;
      c.gafft = false; c.filmt = false;
      c.hurtT -= dt;
      c.visual.root.position.copy(c.pos);
      c.visual.play('sit', { t: elapsed }, dt);
      /* Ein Verletzter, dem niemand hilft, kostet weiter Ansehen – aber
         nur mäßig und nicht pro Person aufaddiert, sonst ist der Ruf nach
         einer einzigen verpatzten Schlägerei dauerhaft ruiniert. */
      if (c.hilfeBar) {
        liegen++;
        if (liegen === 1) setzeRuf(-0.22 * dt, null, null, 30);
        if (!c.kreuz) { c.kreuz = makeHilfeKreuz(); scene.add(c.kreuz); }
        c.kreuz.visible = true;
        c.kreuz.position.set(c.pos.x, c.pos.y + 1.9 + Math.sin(elapsed * 3) * 0.08, c.pos.z);
      }
      if (c.hurtT <= 0) { c.state = 'walk'; c.hp = 20; c.hilfeBar = false; }
      if (!c.hilfeBar && c.kreuz) c.kreuz.visible = false;
      continue;
    }
    const threat = nearestThreatTo(c.pos, 13);
    if (threat && c.state !== 'flee') { c.state = 'flee'; c.fleeT = 3.5; }

    /* ---- Vor einem Auto von der Fahrbahn ----
       Passanten liefen bisher stur ueber die Strasse, auch wenn ein Wagen
       heranfuhr. Wer ein Auto in Fahrtrichtung dicht vor sich hat, springt
       quer zur Fahrbahn zur Seite - dorthin, wo der naechste Gehweg ist. */
    if (c.state !== 'hurt' && c.pos.y < 2.5 && (c.autoWeg || 0) <= 0) {
      for (const car of cars) {
        if (car.aus || (car.tempoJetzt || 0) < 3) continue;
        const cx = car.mesh.position.x, cz = car.mesh.position.z;
        if (Math.abs(cx - c.pos.x) > 22 || Math.abs(cz - c.pos.z) > 22) continue;
        const dx = c.pos.x - cx, dz = c.pos.z - cz;
        const vorne = car.axis === 'x' ? dx * car.dir : dz * car.dir;
        /* dx/dz sind schon die Abstaende ZUM AUTO - die Spur darf hier
           nicht noch einmal abgezogen werden, sonst kam als Querabstand
           die doppelte Spurlage heraus und niemand wich je aus. */
        const seit = car.axis === 'x' ? dz : dx;
        if (vorne < 1 || vorne > 13 || Math.abs(seit) > 2.6) continue;
        /* Zur Seite, auf der man ohnehin schon steht - der kuerzere Weg. */
        c.autoWeg = 1.1;
        c.autoWegX = car.axis === 'x' ? 0 : (seit >= 0 ? 1 : -1);
        c.autoWegZ = car.axis === 'x' ? (seit >= 0 ? 1 : -1) : 0;
        break;
      }
    }
    if (c.autoWeg > 0) c.autoWeg -= dt;

    /* Reaktion auf den Helden: stehenbleiben, hinschauen, filmen, rufen.
       Nur wenn gerade keine Gefahr in der Nähe ist. */
    if (!c.handy) { c.handy = makeHandy(); c.visual.root.add(c.handy); }
    /* Das Handy hing bisher an einem festen Punkt vor dem Körper und
       schwebte dadurch neben der Hand in der Luft. Jetzt sitzt es am
       Handknochen und wird wirklich gehalten. */
    if (!c.handyInHand && c.visual.inDieHand) {
      c.handyInHand = c.visual.inDieHand('R', c.handy,
        _v3.set(0.02, 0.11, 0.015), { x: -0.5, y: 0, z: 1.5 });
    }
    /* Bei Regen spannt jeder zweite Passant einen Schirm auf. */
    if (c.schirmTyp === undefined) c.schirmTyp = Math.random() < 0.55 ? pick(SCHIRM_FARBEN) : null;
    if (c.schirmTyp !== null) {
      if (!c.schirm) { c.schirm = makeSchirm(c.schirmTyp); c.visual.root.add(c.schirm); }
      if (!c.schirmInHand && c.visual.inDieHand) {
        c.schirmInHand = c.visual.inDieHand('L', c.schirm,
          _v3.set(0, 0.06, 0), { x: 0, y: 0, z: 0 });
      }
      c.schirm.visible = REGEN.staerke > 0.25 && !c.handy.visible;
    }
    const dHeld = Math.hypot(player.pos.x - c.pos.x, player.pos.z - c.pos.z);
    const sichtbar = dHeld < 9 && Math.abs(player.pos.y - c.pos.y) < 6;
    if (!threat && c.state !== 'flee' && c.state !== 'hurt' && sichtbar) {
      if (c.staunT === undefined || c.staunT <= 0) {
        c.staunT = rand(1.6, 3.4);
        c.filmt = Math.random() < 0.45;
        if (Math.random() < 0.25) popupWorld(pick(RUFE), c.pos, '#ffe9a8');
      }
      c.staunT -= dt;
      c.gafft = true;
    } else {
      c.gafft = false; c.filmt = false; c.staunT = 0;
    }
    /* Ein Teil der Leute laeuft auch ohne den Helden mit dem Handy
       herum - genau das machen Leute auf der Strasse. */
    if (c.handyLaeufer === undefined) c.handyLaeufer = Math.random() < 0.18;
    c.handy.visible = !!((c.gafft && c.filmt) ||
      (c.handyLaeufer && !c.geisel && c.state === 'walk' &&
       !(c.schirm && c.schirm.visible)));

    let dirX = 0, dirZ = 0, speed = c.speed;
    if (c.autoWeg > 0) {
      /* Ausweichen hat Vorrang vor allem anderen - auch vor der Flucht
         vor Ganoven. Ein Auto ist schneller da. */
      dirX = c.autoWegX; dirZ = c.autoWegZ;
      speed = 5.6;
    } else if (c.state === 'flee') {
      c.fleeT -= dt;
      const t = threat || nearestThreatTo(c.pos, 25);
      if (t) {
        const dx = c.pos.x - t.pos.x, dz = c.pos.z - t.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        dirX = dx / d; dirZ = dz / d;
        c.fleeT = Math.max(c.fleeT, 0.5);
      } else {
        const wpT = c.loop[c.wp];
        const dx = wpT.x - c.pos.x, dz = wpT.z - c.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        dirX = dx / d; dirZ = dz / d;
      }
      speed = 5.2;
      if (c.fleeT <= 0) c.state = 'walk';
    } else {
      const wpT = c.loop[c.wp];
      const dx = wpT.x - c.pos.x, dz = wpT.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) { c.wp = (c.wp + 1) % 4; c.festT = 0; c.letzteDist = null; }
      else { dirX = dx / d; dirZ = dz / d; }
      /* Steckt jemand an einer Hauskante fest, kommt er dem Ziel nicht mehr
         näher und läuft auf der Stelle. Dann einfach das nächste Ziel
         ansteuern statt ewig gegen die Wand zu rennen. */
      if (c.letzteDist !== null && c.letzteDist !== undefined && d > c.letzteDist - 0.25 * dt * 10) {
        c.festT = (c.festT || 0) + dt;
        if (c.festT > 1.5) { c.wp = (c.wp + 1) % 4; c.festT = 0; }
      } else c.festT = 0;
      c.letzteDist = d;
      if (Math.random() < dt * 0.02) speed = 0; // kurz stehenbleiben
    }

    /* Als Geisel festgehalten: kein Weglaufen, nur ängstliches Warten. */
    if (c.geisel) {
      speed = 0; dirX = 0; dirZ = 0;
      c.waypoint = null;
      c.ruhePose = 'warten';
    }

    /* Beim Stehenbleiben ab und zu die Beschäftigung wechseln. */
    if (speed <= 0.1) {
      c.poseT = (c.poseT || 0) - dt;
      if (c.poseT <= 0) {
        c.poseT = rand(4, 11);
        /* civilian-3: acht Alltagsbewegungen dazu. Vorher gab es vier
           Haltungen fuer die ganze Stadt, jetzt zwoelf. */
        c.ruhePose = pick(RUHE_POSEN);
      }
    } else c.poseT = 0;

    /* Wer tippt oder telefoniert, hat das Geraet auch in der Hand. */
    if (!c.gafft && speed <= 0.1 && (c.ruhePose === 'tippen' || c.ruhePose === 'telefon'))
      c.handy.visible = !(c.schirm && c.schirm.visible);
    if (c.gafft) {
      speed = 0; dirX = 0; dirZ = 0;
      c.facing = dampAngle(c.facing, Math.atan2(player.pos.x - c.pos.x, player.pos.z - c.pos.z), dt * 6);
      /* Nicht alle jubeln. Bei hohem Ruf riss frueher JEDER Zuschauer
         beide Arme hoch - drei Leute nebeneinander standen dann in
         derselben T-Haltung, und mehr als diese eine Pose bekam man kaum
         zu sehen. Jetzt jubelt ein knappes Drittel, der Rest staunt,
         winkt oder redet - jeder in seiner eigenen Haltung. */
      if (c.jubelt === undefined) c.jubelt = Math.random() < 0.3;
      if (!c.gaffPose) c.gaffPose = pick(['umschauen', 'warten', 'froh', 'winken', 'reden']);
      if (!c.filmt && !(ruf > 45 && c.jubelt)) c.ruhePose = c.gaffPose;
    } else c.gaffPose = null;
    c.vel.x = dirX * speed; c.vel.z = dirZ * speed;
    c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt;
    collideBody(c);
    /* Die eigene Hoehe zaehlt mit: sonst zieht es die Wartenden auf dem
       Bahnsteig durch die Decke auf die Strasse. */
    const cGrund = groundY(c.pos.x, c.pos.z, c.pos.y);
    c.pos.y = lerp(c.pos.y, cGrund, Math.min(1, dt * 12));
    c.pos.y = Math.max(c.pos.y, cGrund - 0.02);
    /* Wer von der Strasse in einen Treppenschacht laeuft, landet unten -
       und haette dort keinen Wegpunkt mehr, an dem er sich orientiert.
       Statt ihn zurueckzusetzen wird er zum Fahrgast dieser Station: sein
       Rundweg fuehrt ab jetzt ueber den Bahnsteig und die Treppe. */
    if (c.bahnsteig === undefined && c.pos.y < -3 && UBAHNEN.length) {
      let beste = null, bestD = 1e9;
      for (const u of UBAHNEN) {
        const d2 = Math.abs(u.x - c.pos.x);
        if (d2 < bestD) { bestD = d2; beste = u; }
      }
      if (beste) {
        const seite = c.pos.z > UB_Z + beste.dz ? 0 : 1;
        machZuFahrgast(c, beste.x, seite, beste.dz);
      }
    }
    if (speed > 0.1) {
      c.facing = dampAngle(c.facing, Math.atan2(dirX, dirZ), dt * 8);
      c.phase += dt * (4 + speed * 1.6);
    }

    // von Autos erwischt? → weggestoßen
    for (const car of cars) {
      if (car.aus) continue;
      const b = carAABB(car);
      if (c.pos.x > b.x0 && c.pos.x < b.x1 && c.pos.z > b.z0 && c.pos.z < b.z1) {
        c.pos.x += (c.pos.x - car.mesh.position.x) * 0.5;
        c.pos.z += (c.pos.z - car.mesh.position.z) * 0.5;
        c.state = 'flee'; c.fleeT = 2;
      }
    }

    c.visual.root.position.copy(c.pos);
    c.visual.root.rotation.y = c.facing;
    /* Im Stand hat jeder Zivilist seine eigene Beschäftigung – telefonieren,
       warten, sich umsehen. Vorher standen 22 Figuren in derselben Pose. */
    let zAnim;
    if (c.gafft && !c.filmt && ruf > 45 && c.jubelt &&
        c.visual.hatClip && c.visual.hatClip('jubel')) zAnim = 'jubel';
    else if (speed > 0.1) zAnim = 'run';
    else zAnim = c.ruhePose || 'idle';
    c.visual.play(zAnim,
      { phase: c.phase, speed01: clamp(speed / 5.2, 0, 1), speed,
        t: elapsed + c.phase }, dt);
    /* Beim Filmen wird der Arm mit dem Handy zum Helden gestreckt –
       vorher hing der Arm herunter und das Handy schwebte davor. */
    /* Die Feinarbeit an Handy und Schirm (Arm ausrichten, Faust schließen,
       Gegenstand ausrichten) kostet je Figur rund zwanzig Knochendrehungen.
       Auf 30 m Entfernung sieht man davon nichts mehr. */
    const nah = dHeld < 30 && Math.abs(player.pos.y - c.pos.y) < 14;
    if (nah && c.handy.visible && c.visual.poseGreifen) {
      /* Wer filmt, haelt das Geraet vor das GESICHT und schaut darauf -
         Ellbogen angewinkelt, Oberarm dicht am Koerper. Vorher zeigte der
         ganze Arm ausgestreckt auf den Helden, und das Handy klebte am
         Handgelenk statt in den Fingern zu stecken. */
      const co = Math.cos(c.facing), si = Math.sin(c.facing);
      const vx = si, vz = co;                    // Blickrichtung
      const rx = co, rz = -si;                   // rechts von der Figur
      _v3.set(c.pos.x + rx * 0.26 + vx * 0.06, c.pos.y + 1.14,
              c.pos.z + rz * 0.26 + vz * 0.06);                 // Ellbogen
      _v2.set(c.pos.x + rx * 0.13 + vx * 0.36, c.pos.y + 1.47,
              c.pos.z + rz * 0.13 + vz * 0.36);                 // Hand
      c.visual.poseGreifen(_v3, _v2, 'R', 0.9);
      /* Die Finger schließen sich um das Gerät. Ohne das lag das Handy in
         einer flachen, offenen Hand und sah aus, als würde es schweben. */
      if (c.visual.faust) c.visual.faust('R', 0.75);
      /* Das Geraet steht senkrecht in der Faust, Bildschirm zum Gesicht.
         Der kleine Versatz nach vorn holt es aus dem Handgelenk in die
         Finger. */
      if (c.visual.haltAusgerichtet) {
        _vHalt.set(vx * 0.05, 0.045, vz * 0.05);
        c.visual.haltAusgerichtet(c.handy, c.facing + Math.PI, 0.20, _vHalt);
      }
    }
    /* Der Schirm wird über den Kopf gehalten, nicht am Bein baumeln lassen.
       Der Stock bleibt dabei senkrecht, egal wie die Hand steht. */
    if (nah && c.schirm && c.schirm.visible && c.visual.poseSchuss) {
      _v3.set(c.pos.x, c.pos.y + 3.4, c.pos.z);
      c.visual.poseSchuss(_v3, 'L', 0.9);
      /* Um den Griff schließt sich eine richtige Faust. */
      if (c.visual.faust) c.visual.faust('L', 1);
      if (c.visual.armRuhe) c.visual.armRuhe('R', 0.55);
      /* Der Stock steht senkrecht und läuft mitten durch die Faust. */
      if (c.visual.haltAusgerichtet) {
        c.visual.haltAusgerichtet(c.schirm, c.facing, 0.1, _v2.set(0, 0, 0));
      } else if (c.visual.haltAufrecht) c.visual.haltAufrecht(c.schirm, 0.12);
    }
    if (haltenImGebiet(c.pos)) c.waypoint = null;
    if (c.visual.bodenAusgleich) c.visual.bodenAusgleich(Math.min(1, dt * 12));
  }

  /* Liegt niemand mehr verletzt herum und läuft kein Auftrag ins Leere,
     erholt sich der Ruf langsam von selbst – bis 65 %. Alles darüber muss
     man sich mit Rettungen und erledigten Aufträgen verdienen. */
  /* Erholung läuft auch dann weiter, wenn jemand liegt – nur langsamer.
     Sonst bleibt der Ruf in einer belebten Stadt dauerhaft am Boden. */
  if (ruf < 65) setzeRuf(Math.min(0.9, 65 - ruf) * dtBild * (liegen === 0 ? 0.25 : 0.06));
}

function hurtCivilian(c, attacker) {
  c.hp -= 10;
  popupWorld('Hilfe!', c.pos, '#ff9b9b');
  if (c.hp <= 0) {
    c.state = 'hurt';
    /* Verletzte stehen nicht mehr von allein auf – sie warten auf Hilfe.
       Erst nach einer langen Weile rappelt sich jemand selbst hoch. */
    c.hurtT = 40;
    c.hilfeBar = true;
    setzeRuf(-6, 'Ruf −6', c.pos, 25);
    addScore(-40, 'Zivilist verletzt', c.pos);
    SFX.hurt && SFX.hurt();
  } else {
    c.state = 'flee'; c.fleeT = 4;
    setzeRuf(-1, null, null, 40);
  }
}

/* Ein rotes Kreuz über Verletzten – sonst findet man sie in der Stadt nicht. */
let kreuzMat = null;
function makeHilfeKreuz() {
  if (!kreuzMat) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e0202c'; g.fillRect(26, 10, 12, 44); g.fillRect(10, 26, 44, 12);
    const t = new THREE.CanvasTexture(cv);
    kreuzMat = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false });
  }
  const s = new THREE.Sprite(kreuzMat);
  s.scale.set(0.55, 0.55, 0.55);
  s.renderOrder = 20;
  return s;
}

/* Erste Hilfe: nahe an einem Verletzten die Taste C drücken. */
function ersteHilfe() {
  let ziel = null, best = 3.2;
  for (const c of civilians) {
    if (c.state !== 'hurt' || !c.hilfeBar) continue;
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (d < best) { best = d; ziel = c; }
  }
  if (!ziel) return false;
  ziel.state = 'walk'; ziel.hurtT = 0; ziel.hp = 20;
  ziel.hilfeBar = false; ziel.savedCd = 12;
  if (ziel.kreuz) ziel.kreuz.visible = false;
  ziel.ruhePose = 'jubel'; ziel.poseT = 2.5;
  setzeRuf(+9, 'Ruf +9', ziel.pos);
  addScore(120, 'Erste Hilfe geleistet!', ziel.pos);
  return true;
}

/* ======================= Gegner (Gangs) ======================= */
const enemies = [];
const gangs = [];
let crimeGang = null, crimeTimer = 20;

/* ---- Netzkokon ----
   Statt einer glatten Kugel ein unregelmäßig umwickeltes Bündel: leicht
   verbeulter Körper plus quer laufende Netzbänder und ein paar Fäden. */
/* Zwei Netz-Muster: eines deckend für den fertigen Kokon (man sieht die
   Wicklungen), eines mit durchsichtigem Hintergrund für Fäden und
   Netzflecken auf dem Körper. Die früheren glatten weißen Ringe sahen aus
   wie Plastikreifen, nicht wie Netz. */
const wickelTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#f2f5f8'; g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = i % 3 ? 'rgba(203,213,225,0.85)' : 'rgba(255,255,255,0.9)';
    g.lineWidth = i % 3 ? 1.4 : 2.6;
    const y = rand(0, h);
    g.beginPath(); g.moveTo(-4, y); 
    for (let x = 0; x <= w + 4; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + i) * 3.5);
    g.stroke();
  }
  g.strokeStyle = 'rgba(176,190,208,0.8)'; g.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    g.beginPath(); g.moveTo(rand(0, w), 0); g.lineTo(rand(0, w), h); g.stroke();
  }
});
/* Muster mehrfach über den Kokon legen – sonst sieht man die Wicklungen
   auf der kleinen Fläche kaum. */
wickelTex.wrapS = wickelTex.wrapT = THREE.RepeatWrapping;
wickelTex.repeat.set(2, 3);
const fleckTex = canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineCap = 'round';
  const cx = w / 2, cy = h / 2;
  // Speichen
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(-0.15, 0.15);
    g.lineWidth = rand(1.6, 3);
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * cy * rand(0.75, 1.05), cy + Math.sin(a) * cy * rand(0.75, 1.05));
    g.stroke();
  }
  // Spiralringe
  for (let r = 10; r < cy; r += rand(8, 14)) {
    g.lineWidth = rand(1, 2);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = r * (1 + Math.sin(a * 3 + r) * 0.09);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
});
/* Äußere Fadenlage: durchsichtiger Überzug mit kreuz und quer laufenden
   Strängen. Erst dadurch liest sich der Kokon als GEWICKELT – eine glatte
   weiße Hülle allein sieht aus wie Kunststoff. */
const huelleTex = canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const schraeg = i % 2 ? 1 : -1;
    g.strokeStyle = i % 4 === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(236,243,250,0.7)';
    g.lineWidth = i % 4 === 0 ? 2.2 : 1.2;
    const y0 = rand(-20, h + 20);
    g.beginPath();
    for (let x = -6; x <= w + 6; x += 12) {
      g.lineTo(x, y0 + x * 0.42 * schraeg + Math.sin(x * 0.11 + i) * 3);
    }
    g.stroke();
  }
});
huelleTex.wrapS = huelleTex.wrapT = THREE.RepeatWrapping;
huelleTex.repeat.set(2, 3);
const huelleMat = new THREE.MeshBasicMaterial({
  map: huelleTex, transparent: true, alphaTest: 0.06, depthWrite: false,
  side: THREE.DoubleSide, opacity: 0.85,
});
const cocoonMat = new THREE.MeshLambertMaterial({
  map: wickelTex, transparent: true, opacity: 0.88, flatShading: true,
  color: 0xdfe6ee,
});
const bandMat = new THREE.MeshLambertMaterial({ color: 0xf4f8fc });
const fleckMat = new THREE.MeshBasicMaterial({
  map: fleckTex, transparent: true, alphaTest: 0.08, depthWrite: false,
  side: THREE.DoubleSide, opacity: 0.92,
});

const cocoonKoerperGeo = (() => {
  const g = new THREE.SphereGeometry(0.42, 16, 14);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = y / 0.42;                       // -1 (unten) .. +1 (oben)
    /* Menschliche Silhouette statt Vase: breite Schultern, schmalere
       Hüfte, oben der eingewickelte Kopf, unten die Füße. */
    let breite = 0.86 + 0.30 * Math.exp(-Math.pow((t - 0.45) / 0.30, 2))  // Schultern
               - 0.22 * Math.exp(-Math.pow((t - 0.95) / 0.16, 2))         // Hals
               - 0.34 * Math.max(0, -t - 0.30);                           // Beine unten
    /* Der Beinterm hat vorher ALLES oberhalb von t = -0,72 verschmälert –
       auch den Kopf. Der Kokon lief deshalb oben spitz zu wie ein Zipfel. */
    /* Deutlichere Beulen: ein von Hand gewickeltes Bündel ist nie glatt. */
    breite *= 1 + Math.sin(y * 26) * 0.075 + Math.sin(x * 19 + z * 15) * 0.06
            + Math.sin(y * 41 + x * 9) * 0.035;
    pos.setXYZ(i, x * breite * 1.02, y * 2.3, z * breite * 0.80);
  }
  g.computeVertexNormals();
  return g;
})();
/* Statt Ringen echte WICKLUNGEN: ein dünner Faden, der spiralig um den
   Körper läuft. Ringe schweben immer wie Reifen um die Figur – eine
   Spirale liest sich sofort als umwickelt. */
function wickelGeo(windungen, phase, hoch, weite) {
  const punkte = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = -hoch + t * hoch * 2;
    const a = phase + t * Math.PI * 2 * windungen;
    /* Der Radius folgt grob der Körperform: an den Schultern weiter,
       an Hüfte und Beinen enger. */
    const tt = y / hoch;
    const r = weite * (0.78 + 0.26 * Math.exp(-Math.pow((tt - 0.4) / 0.45, 2))
                            - 0.3 * Math.max(0, -tt - 0.35));
    punkte.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.72));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(punkte), 90, 0.0055, 3, false);
}
/* Viele feine Windungen statt weniger dicker Schläuche – bei 1,7 cm
   Fadenstärke sahen die Wicklungen aus wie Schwimmnudeln. */
const bandGeos = [
  wickelGeo(9, 0, 0.80, 0.235),
  wickelGeo(13, 2.1, 0.76, 0.225),
  wickelGeo(6.5, 4.0, 0.70, 0.245),
  wickelGeo(11, 1.0, 0.62, 0.215),
];
const fadenGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.34, 3);
const fleckGeo = new THREE.PlaneGeometry(0.55, 0.55);

/* Der Kokon wächst mit der Anzahl der Treffer:
   Stufe 1 = ein paar Fäden quer über den Körper,
   Stufe 2 = deutlich mehr Wicklungen,
   Stufe 3 = komplett eingesponnen. Ein einzelner Schuss wickelt also
   niemanden mehr vollständig ein. */
function makeCocoon() {
  const g = new THREE.Group();
  const koerper = new THREE.Mesh(cocoonKoerperGeo, cocoonMat);
  koerper.castShadow = true;
  koerper.visible = false;                // erst ab Stufe 3
  g.add(koerper);
  // Zweite, leicht größere Schale mit den sichtbaren Fäden darüber
  const huelle = new THREE.Mesh(cocoonKoerperGeo, huelleMat);
  huelle.scale.set(1.05, 1.02, 1.06);
  huelle.rotation.y = rand(0, Math.PI);
  huelle.visible = false;
  huelle.renderOrder = 2;
  g.add(huelle);

  /* Netzflecken: dort, wo das Netz auftrifft, klebt ein Stück Spinnennetz
     am Körper. Das ist der erste sichtbare Treffer – vorher schwebten
     stattdessen sofort weiße Reifen um die Beine. */
  const flecken = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(fleckGeo, fleckMat);
    const a = rand(0, Math.PI * 2);
    const y = rand(-0.30, 0.52);          // Rumpf, nicht der Kopf
    f.position.set(Math.cos(a) * 0.26, y, Math.sin(a) * 0.20);
    f.lookAt(Math.cos(a) * 3, y, Math.sin(a) * 3);
    f.rotation.z = rand(0, Math.PI);
    f.scale.setScalar(rand(0.75, 1.15));
    f.visible = false;
    g.add(f); flecken.push(f);
  }

  /* Wicklungen: spiralig um den Körper laufende Fäden. */
  const baender = [];
  for (let i = 0; i < bandGeos.length; i++) {
    const b = new THREE.Mesh(bandGeos[i], bandMat);
    b.position.y = rand(-0.04, 0.04);
    b.rotation.y = rand(0, Math.PI * 2);
    b.rotation.z = rand(-0.09, 0.09);
    b.visible = false;
    g.add(b); baender.push(b);
  }

  /* Fäden, die AM Körper anliegen. Vorher standen sie in zufälligen
     Richtungen ab und sahen aus wie weiße Nadeln, die durch die Figur
     gestochen sind. Jetzt liegen sie tangential auf der Körperoberfläche
     und laufen schräg darüber. */
  const faeden = [];
  for (let i = 0; i < 22; i++) {
    const f = new THREE.Mesh(fadenGeo, bandMat);
    const a = rand(0, Math.PI * 2);
    const y = rand(-0.7, 0.8);
    f.position.set(Math.cos(a) * 0.22, y, Math.sin(a) * 0.17);
    f.rotation.y = -a;                       // Achse tangential zur Hülle
    f.rotation.z = Math.PI / 2 + rand(-0.65, 0.65);
    f.scale.set(1, rand(0.7, 1.5), 1);
    f.visible = false;
    g.add(f); faeden.push(f);
  }

  /* Wird der Gegner an eine Wand geheftet, spannen ein paar Fäden vom
     Kokon nach hinten zur Fassade. */
  const wandFaeden = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(fadenGeo, bandMat);
    const y = rand(-0.55, 0.7), sx = rand(-0.24, 0.24);
    f.position.set(sx * 0.6, y, -0.32);
    f.rotation.x = Math.PI / 2 + rand(-0.25, 0.25);
    f.rotation.z = rand(-0.4, 0.4);
    f.scale.set(1, rand(0.7, 1.1), 1);
    f.visible = false;
    g.add(f); wandFaeden.push(f);
  }
  g.userData.setzeWand = (an) => { wandFaeden.forEach((f) => { f.visible = an; }); };
  g.userData.setzeStufe = (stufe) => {
    /* Stufe 1: ein Netzfleck und ein paar Fäden – der Gegner kann noch
       laufen. Stufe 2: erste Wicklungen. Stufe 3: komplett eingesponnen. */
    const fl = stufe >= 3 ? 4 : (stufe === 2 ? 3 : 2);
    flecken.forEach((f, i) => { f.visible = i < fl; });
    /* Bei Stufe 3 trägt der Kokon selbst das Wickelmuster. Alle neun Ringe
       zusätzlich anzuzeigen sah aus, als schwebten Reifen um das Bündel –
       es bleiben ein paar wenige, die stramm anliegen. */
    baender.forEach((b, i) => { b.visible = stufe >= 3 || (stufe === 2 && i < 2); });
    const fAnzahl = stufe >= 3 ? 18 : (stufe === 2 ? 11 : 5);
    faeden.forEach((f, i) => { f.visible = i < fAnzahl; });
    /* Der komplette Kokon ist nur noch das Ergebnis, wenn jemand an eine
       Wand geheftet wird. Mitten auf der Straße wird ein Gegner kräftig
       eingewickelt und ist bewegungsunfähig – aber kein Bündel. So kämpft
       das Vorbild auch. */
    koerper.visible = false;
    huelle.visible = false;
  };
  g.userData.setzeKokon = (an) => {
    koerper.visible = an;
    huelle.visible = an;
    if (an) { baender.forEach((b, i) => { b.visible = true; b.scale.setScalar(1.06); }); }
  };
  return g;
}

function makeHPBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x330a0a }));
  bg.scale.set(1.1, 0.12, 1);
  g.add(bg);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x59d95c }));
  fg.center.set(0, 0.5);
  fg.position.x = -0.55;
  fg.scale.set(1.1, 0.12, 1);
  g.add(fg);
  g.position.y = 2.15;
  return { g, fg };
}

/* Gegnertypen – ohne neue Modelle, allein über Größe, Farbton und Werte.
   Damit fühlt sich nicht mehr jeder Gegner gleich an. */
const GANOVEN = [
  /* standfest: nimmt kaum Rückstoß und taumelt nur kurz.
     ausweichen: Wahrscheinlichkeit, einem Schlag zur Seite auszuweichen. */
  { art: 'schlaeger', groesse: 1.00, hp: 34, schaden: 8,  tempo: 5.0, blockChance: 0.18,
    standfest: 0.0, ausweichen: 0.0,  farbe: 0x000000, gewicht: 55 },
  { art: 'brecher',   groesse: 1.22, hp: 62, schaden: 14, tempo: 3.9, blockChance: 0.34,
    standfest: 0.85, ausweichen: 0.0, farbe: 0x2a1410, gewicht: 22 },
  { art: 'flink',     groesse: 0.88, hp: 22, schaden: 6,  tempo: 6.6, blockChance: 0.08,
    standfest: 0.0, ausweichen: 0.42, farbe: 0x101c28, gewicht: 23 },
];
function waehleGanov() {
  const summe = GANOVEN.reduce((a, g) => a + g.gewicht, 0);
  let r = Math.random() * summe;
  for (const g of GANOVEN) { r -= g.gewicht; if (r <= 0) return g; }
  return GANOVEN[0];
}

/* Die Schläge der Ganoven. Vorher hatten alle genau eine Bewegung mit
   fester Dauer – das wirkte, als könnten sie nichts. */
const GANOVEN_SCHLAEGE = [
  { art: 'punch',  dauer: 0.55, treff: 0.42, reichweite: 1.9, wucht: 1.0 },
  { art: 'hook',   dauer: 0.62, treff: 0.46, reichweite: 1.9, wucht: 1.2 },
  { art: 'kick',   dauer: 0.72, treff: 0.48, reichweite: 2.3, wucht: 1.4 },
  { art: 'knie',   dauer: 0.6,  treff: 0.45, reichweite: 1.6, wucht: 1.3 },
  { art: 'punch3', dauer: 0.66, treff: 0.44, reichweite: 2.0, wucht: 1.1 },
];

/* ---- Klingenhieb ----
   Die Ganoven tragen ihre Klinge am Gürtel, benutzt hat sie bisher keiner.
   Der Hieb holt lange aus, geht weit und tut weh – dafür ist er deutlich
   angekündigt und damit die beste Gelegenheit für einen Konter (Strg). */
const KLINGENHIEB = { art: 'hook', dauer: 0.95, treff: 0.6, reichweite: 3.0,
                      wucht: 2.1, klinge: true };

/* Ein leuchtender Bogen zeichnet die Bahn der Klinge nach. */
let klingenBogen = null;
function zeigeKlingenBogen(e, t01) {
  if (!klingenBogen) {
    const g = new THREE.RingGeometry(1.6, 3.0, 22, 1, 0, Math.PI * 0.85);
    g.rotateX(-Math.PI / 2);
    /* Schräg gestellt: der Hieb geht von oben rechts nach unten links
       durch die Luft und liegt nicht flach auf der Straße. */
    g.rotateZ(0.75);
    klingenBogen = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0xfff2ec, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    klingenBogen.renderOrder = 12;
    scene.add(klingenBogen);
  }
  klingenBogen.visible = true;
  klingenBogen.position.set(e.pos.x, e.pos.y + 1.15, e.pos.z);
  /* Der Bogen wandert von rechts nach links vor dem Gegner durch die Luft.
     Die Mitte des Kreisausschnitts zeigt bei facing+PI nach vorn. */
  klingenBogen.rotation.y = e.facing + Math.PI - 1.2 + clamp(t01, 0, 1) * 2.4;
  klingenBogen.material.opacity = Math.sin(clamp(t01, 0, 1) * Math.PI) * 0.6;
}

/* Warnzeichen über dem Kopf: Ausrufezeichen vor einem Schlag,
   Schild beim Blocken. Beides nur zwei kleine Kisten. */
function makeWarnzeichen() {
  const g = new THREE.Group();
  const rot = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const balken = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), rot);
  balken.position.y = 0.3; g.add(balken);
  const punkt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), rot);
  punkt.position.y = 0.02; g.add(punkt);
  g.position.y = 2.15;
  g.visible = false;
  return g;
}
function makeBlockzeichen() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.75 }));
  m.position.y = 1.25;
  m.visible = false;
  return m;
}

/* Grenzen des bespielbaren Gebiets: Stadtraster diesseits des Flusses und
   der Stadtteil am anderen Ufer. Alles andere ist nackte Grundfläche –
   dort hat weder eine Gang noch ein Zivilist etwas verloren. */
const STADT_RAND = ORIGIN + BLOCKS * PITCH;      // 175
function imGebiet(x, z) {
  if (Math.abs(z) > STADT_RAND + 6) return false;
  if (x >= -STADT_RAND - 6 && x <= RIVER_X0 - 3) return true;
  if (x >= SHORE_X0 + 3 && x <= SHORE_X1 - 3) return true;
  return false;
}
function haltenImGebiet(pos) {
  if (imGebiet(pos.x, pos.z)) return false;
  pos.z = clamp(pos.z, -STADT_RAND - 6, STADT_RAND + 6);
  /* Zur nächstgelegenen erlaubten Zone zurückschieben. */
  if (pos.x > (RIVER_X0 + SHORE_X0) / 2) pos.x = clamp(pos.x, SHORE_X0 + 3, SHORE_X1 - 3);
  else pos.x = clamp(pos.x, -STADT_RAND - 6, RIVER_X0 - 3);
  return true;
}

/* Liegt der Punkt in einem Gebäude? Wegpunkte dort drin lassen die
   Ganoven dauerhaft gegen die Fassade laufen. */
function inGebaeude(x, z) {
  for (const c of collidersNear(x, z)) {
    if (c.klein) continue;
    if (x > c.x0 - 0.6 && x < c.x1 + 0.6 && z > c.z0 - 0.6 && z < c.z1 + 0.6) return true;
  }
  return false;
}
function freierPunkt(cx, cz, r) {
  for (let i = 0; i < 12; i++) {
    const x = cx + rand(-r, r), z = cz + rand(-r, r);
    if (!inGebaeude(x, z) && imGebiet(x, z)) return V3(x, 0, z);
  }
  return null;
}

function spawnGang(cx, cz, n) {
  const gang = { enemies: [], home: V3(cx, 0, cz), cleared: false };
  for (let i = 0; i < n; i++) {
    const visual = makeCharacterVisual('thug', {
      thug: true,
      shirt: pick(['#3a3f4a', '#54303a', '#2e4038', '#463a2e']),
      pants: pick(['#26262e', '#3a3630', '#2e3440']),
    });
    const typ = waehleGanov();
    visual.root.scale.setScalar(typ.groesse);
    const hpBar = makeHPBar();
    visual.root.add(hpBar.g);
    const warn = makeWarnzeichen(); visual.root.add(warn);
    const blockZ = makeBlockzeichen(); visual.root.add(blockZ);
    const cocoon = makeCocoon();
    cocoon.position.y = 0.98;
    cocoon.visible = false;
    visual.root.add(cocoon);
    const e = {
      visual, hpBar, cocoon,
      pos: V3(cx + rand(-4, 4), 0, cz + rand(-4, 4)),
      vel: V3(0, 0, 0),
      radius: 0.4 * typ.groesse,
      facing: rand(0, TAU),
      phase: rand(0, TAU),
      typ, warn, blockZ,
      umwegT: 0, umwegSeite: 1, blockiertT: 0,
      inDerLuft: 0, geworfen: 0, betaeubtT: 0, dieb: false, bewacht: null,
      ausweichCd: 0, iFrames: 0,
      hp: typ.hp, hpMax: typ.hp,
      blockT: 0, blockCd: rand(1, 4), warnT: 0,
      state: 'patrol',
      target: null,        // 'player' | Zivilist
      waypoint: null, waitT: rand(0, 2),
      attackT: 0, attackCd: 0, attack: null,
      staggerT: 0, webT: 0, webStufe: 0,
      dead: false, deadT: 0,
      gang,
      onGround: true, wall: null, liegt: false, blendMats: null,
    };
    gang.enemies.push(e);
    enemies.push(e);
  }
  gangs.push(gang);
  return gang;
}

function gangSpawnSpots() {
  const spots = [];
  for (let bi = 0; bi < BLOCKS; bi++) for (let bj = 0; bj < BLOCKS; bj++) {
    spots.push([ORIGIN + bi * PITCH + PITCH / 2, ORIGIN + bj * PITCH + ROAD_HALF + 3]);
    spots.push([ORIGIN + bi * PITCH + ROAD_HALF + 3, ORIGIN + bj * PITCH + PITCH / 2]);
  }
  return spots;
}
const SPOTS = gangSpawnSpots();

function spawnGangAwayFromPlayer() {
  for (let tries = 0; tries < 20; tries++) {
    const [x, z] = pick(SPOTS);
    const d = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (d > 55 && d < 220) return spawnGang(x, z, randi(3, 5));
  }
  const [x, z] = pick(SPOTS);
  return spawnGang(x, z, randi(3, 4));
}


/* Nächste Hauswand in Reichweite finden: Fläche, Normale und Abstand. */
function naheWand(pos, maxAbstand) {
  let best = null, bestD = maxAbstand;
  for (const c of collidersNear(pos.x, pos.z)) {
    if (c.klein || c.h < pos.y + 1.4) continue;
    // Nur außerhalb stehende Gegner ankleben
    const innen = pos.x > c.x0 && pos.x < c.x1 && pos.z > c.z0 && pos.z < c.z1;
    if (innen) continue;
    const kx = clamp(pos.x, c.x0, c.x1), kz = clamp(pos.z, c.z0, c.z1);
    const dx = pos.x - kx, dz = pos.z - kz;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 0.01) continue;
    // Normale = Richtung von der Wand weg
    let nx = 0, nz = 0;
    if (Math.abs(dx) >= Math.abs(dz)) nx = Math.sign(dx); else nz = Math.sign(dz);
    bestD = d;
    best = { x: kx, z: kz, nx, nz, col: c };
  }
  return best;
}

function applyWeb(e) {
  if (e.dead) return;
  /* Jeder weitere Treffer wickelt fester ein. Erst ab Stufe 3 ist der
     Gegner vollständig bewegungsunfähig. */
  e.webStufe = Math.min(3, (e.webStufe || 0) + 1);
  e.webT = Math.max(e.webT, 1.6 + e.webStufe * 1.6);
  if (e.cocoon && e.cocoon.userData.setzeStufe) e.cocoon.userData.setzeStufe(e.webStufe);
  if (e.webStufe >= 3) {
    e.vel.set(0, 0, 0); e.attack = null;
    /* Steht der Gegner dicht an einer Hauswand, klebt das dritte Netz ihn
       dort fest – er hängt anschließend an der Fassade statt auf der
       Straße zu liegen. */
    const w = naheWand(e.pos, 2.6);   // etwas großzügiger: der Gegner bewegt sich ja
    if (e.cocoon && e.cocoon.userData.setzeWand) e.cocoon.userData.setzeWand(!!w);
    if (e.cocoon && e.cocoon.userData.setzeKokon) e.cocoon.userData.setzeKokon(!!w);
    if (w) {
      e.pos.x = w.x + w.nx * 0.42;
      e.pos.z = w.z + w.nz * 0.42;
      e.pos.y = groundY(e.pos.x, e.pos.z) + rand(0.6, 1.1);
      e.facing = Math.atan2(w.nx, w.nz);       // Rücken zur Wand
      e.anWand = true;
      popupWorld('An die Wand geheftet!', e.pos, '#bfe8ff');
    }
  }
  else { e.vel.multiplyScalar(0.3); e.staggerT = Math.max(e.staggerT, 0.35); }
}

/* Die ganze Gang in der Nähe auf den Helden umschalten – unabhängig davon,
   was sie gerade tut. Vorher wurden nur patrouillierende Kumpels alarmiert;
   wer hinter einem Zivilisten her war, machte einfach weiter, und man musste
   jeden Ganoven einzeln anschlagen. */
function alarmiereGang(e, umkreis) {
  if (!e.gang) return;
  for (const o of e.gang.enemies) {
    if (o.dead || o === e || o.target === 'player') continue;
    /* Bewacher einer Geisel und fliehende Diebe behalten ihre Aufgabe. */
    if (o.bewacht || o.dieb) continue;
    if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) > umkreis) continue;
    o.state = 'chase'; o.target = 'player';
  }
}

function damageEnemy(e, dmg, kind) {
  if (e.dead) return;
  /* Im Symbiontenanzug schlaegt es deutlich haerter zu. */
  if (player.symAn) dmg *= 1.7;
  /* Wer gerade zur Seite gesprungen ist, ist für einen Moment nicht zu
     treffen – sonst wäre das Ausweichen reine Kosmetik. */
  if (e.iFrames > 0) return;
  e.hp -= dmg;
  /* Jeder Treffer fuellt den Symbiontenbalken. Voll wird er nach rund
     zwanzig sauberen Schlaegen - lange genug, dass es sich verdient
     anfuehlt, kurz genug fuer eine Gang. */
  /* Halbiert: der Symbiont soll etwas Besonderes sein und nicht nach
     zwei Gegnern bereitstehen. */
  if (!player.symAn) player.symEnergie = clamp(player.symEnergie + dmg * 0.0028, 0, 1);
  e.target = 'player';
  e.state = 'chase';
  alarmiereGang(e, 20);
  if (e.hp <= 0) {
    e.dead = true; e.deadT = 2.5;
    e.webT = 0; e.cocoon.visible = false;
    e.hpBar.g.visible = false;
    if (!player.symAn) player.symEnergie = clamp(player.symEnergie + 0.055, 0, 1);
    addScore(50, 'K.O.!', e.pos);
    checkGangCleared(e.gang);
    checkCivilianSaved(e);
  } else {
    e.hpBar.fg.scale.x = 1.1 * clamp(e.hp / (e.hpMax || CFG.enemyHP), 0, 1);
    e.hpBar.g.visible = true;
  }
}

/* ======================= Symbiont =======================
   Kaempfen fuellt einen Balken. Ist er voll, laesst sich der schwarze
   Anzug zuschalten (Taste T): mehr Wucht, mehr Tempo, eigene Gangart -
   aber nur fuer eine begrenzte Zeit, danach ist der Balken leer.
   Der Anzugwechsel selbst ist nur ein Austausch der Eckpunktfarben, das
   76-MB-Modell aus animation-1 waere fuer den Browser viel zu gross. Seine
   Bewegungen stecken dagegen im Spiel. */
const SYM_DAUER = 22;

function symbiontStart() {
  if (player.dead) return false;
  if (player.symAn) { symbiontEnde(); return true; }
  if (player.symEnergie < 0.999) {
    popupScreen(`Symbiont noch nicht bereit (${Math.round(player.symEnergie * 100)} %)`);
    return false;
  }
  player.symAn = true;
  player.symZeit = SYM_DAUER;
  player.symBlitz = 0.6;
  if (heroVisual.setzeSymbiont) heroVisual.setzeSymbiont(true);
  popupScreen('🕷 Symbiont aktiv');
  SFX.ko();
  return true;
}

function symbiontEnde() {
  if (!player.symAn) return;
  player.symAn = false;
  player.symZeit = 0;
  player.symEnergie = 0;
  player.symBlitz = 0.4;
  if (heroVisual.setzeSymbiont) heroVisual.setzeSymbiont(false);
  popupScreen('Symbiont abgestossen');
}

let symHudT = 0;
function updateSymbiont(dt) {
  if (player.symBlitz > 0) player.symBlitz -= dt;
  /* Die Anzeige nur viermal je Sekunde neu schreiben - jedes Bild waere
     unnoetige Arbeit am DOM. */
  symHudT -= dt;
  if (!player.symAn) {
    if (player.symEnergie > 0.001 && symHudT <= 0) { symHudT = 0.25; updateHUD(); }
    return;
  }
  player.symZeit -= dt;
  player.symEnergie = clamp(player.symZeit / SYM_DAUER, 0, 1);
  if (symHudT <= 0) { symHudT = 0.25; updateHUD(); }
  if (player.symZeit <= 0 || player.dead) symbiontEnde();
}

function checkGangCleared(gang) {
  if (gang.cleared) return;
  if (gang.enemies.every((e) => e.dead)) {
    gang.cleared = true;
    addScore(200, 'Gang besiegt!', player.pos);
    if (crimeGang === gang) {
      for (const h of helis) h.zielMitte = null;   // Hubschrauber zieht weiter
      /* Den Auftrag beendet der Auftragsverwalter – hier nur die Gang
         abhaken, sonst verschwindet die Anzeige zu früh. */
    }
  }
}

function checkCivilianSaved(deadEnemy) {
  for (const c of civilians) {
    if (c.savedCd > 0) continue;
    const d = Math.hypot(c.pos.x - deadEnemy.pos.x, c.pos.z - deadEnemy.pos.z);
    if (d < 12 && (c.state === 'flee' || c.state === 'hurt')) {
      if (!nearestThreatTo(c.pos, 12)) {
        c.savedCd = 20;
        setzeRuf(+3, null, c.pos);
        addScore(100, 'Zivilist gerettet!', c.pos);
      }
    }
  }
}

/* ---- Wie viele duerfen gleichzeitig auf den Helden losgehen? ----
   Vorher holten alle zugleich aus: wer von vier Ganoven umringt war,
   bekam vier Schlaege im selben Moment und konnte nur noch ausweichen
   oder sterben. Und zu sehen war davon nichts, weil alles gleichzeitig
   passierte. Jetzt schlagen hoechstens zwei, die uebrigen umkreisen -
   so liest sich der Kampf, und man kann auf einen Angriff nach dem
   anderen reagieren. */
const KAMPF_GLEICHZEITIG = 2;
/* Wer gerade angreifen darf. Die Auswahl wird EINMAL je Bild getroffen und
   nicht von jedem Gegner einzeln erwuerfelt: die naechsten zwei bekommen
   das Recht, wer schon ausholt behaelt es. Alle anderen halten Abstand -
   sie gehen auf einen weiteren Ring, statt sich an die Figur zu draengen.
   Vorher standen alle vier auf demselben Ring von 1,15 m; auch ohne
   Angriffsrecht sah das aus, als stuermten alle gleichzeitig. */
const KAMPF_RECHT = new Set();
function verteileAngriffsrechte() {
  KAMPF_RECHT.clear();
  const anwaerter = [];
  for (const e of enemies) {
    if (e.dead || e.target !== 'player') continue;
    if (e.betaeubtT > 0 || e.rueckzugT > 0 || e.webT > 0) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    /* Wer schon ausholt oder zuschlaegt, behaelt sein Recht - sonst
       bricht ein Angriff mitten in der Bewegung ab. */
    anwaerter.push({ e, rang: (e.attack || e.warnT > 0 ? -1000 : 0) + d });
  }
  anwaerter.sort((a, b) => a.rang - b.rang);
  for (let i = 0; i < anwaerter.length && i < KAMPF_GLEICHZEITIG; i++) {
    KAMPF_RECHT.add(anwaerter[i].e);
  }
}

function updateEnemies(dtBild) {
  /* Der Klingenbogen gehört immer nur zum gerade laufenden Hieb. */
  if (klingenBogen) klingenBogen.visible = false;
  verteileAngriffsrechte();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    /* Ganoven weit weg vom Helden ebenfalls nur jedes dritte Bild. Wer
       gerade ausholt oder zuschlägt, wird immer gerechnet – sonst
       verschiebt sich die Vorwarnzeit und der Konter passt nicht mehr. */
    const fern = Math.abs(e.pos.x - player.pos.x) + Math.abs(e.pos.z - player.pos.z) > FERN
                 && !e.attack && e.warnT <= 0;
    if (fern && ((taktBild + i) % 3)) continue;
    const dt = fern ? dtBild * 3 : dtBild;
    if (e.dead) {
      /* ---- Der Körper fällt zu Ende ----
         Vorher wurde e.pos beim Tod nicht mehr angefasst: wer in der Luft
         starb – vom Aufwärtshaken, geworfen, im Sprung – blieb dort
         schweben und verschwand nach zweieinhalb Sekunden aus der Luft.
         Jetzt wirkt die Schwerkraft weiter, bis er wirklich liegt, und
         die Uhr läuft erst dann richtig los. */
      if (!e.liegt) {
        e.vel.y -= CFG.gravity * dt;
        e.pos.x += e.vel.x * dt;
        e.pos.y += e.vel.y * dt;
        e.pos.z += e.vel.z * dt;
        const bremse = Math.max(0, 1 - dt * 2.5);
        e.vel.x *= bremse; e.vel.z *= bremse;
        const gy = groundY(e.pos.x, e.pos.z);
        if (e.pos.y <= gy) {
          e.pos.y = gy;
          e.vel.set(0, 0, 0);
          e.liegt = true;
          staubWolke(e.pos, 0.8);
        }
        /* Sicherheitsnetz: falls er über dem Wasser oder außerhalb der
           Karte stirbt, nicht endlos fallen lassen. */
        if (e.pos.y < -30) { e.liegt = true; e.deadT = Math.min(e.deadT, 0.3); }
      }
      e.deadT -= e.liegt ? dt : dt * 0.3;
      /* Zum Schluss ausblenden statt einfach verschwinden. */
      if (e.deadT < 0.6) {
        const a = clamp(e.deadT / 0.6, 0, 1);
        if (!e.blendMats) {
          e.blendMats = [];
          /* Die Materialien werden zwischen allen Gegnern GETEILT - das
             Modell wird geklont, three.js hängt dabei dieselben Materialien
             an alle Kopien. Wer hier einfach transparent setzt, macht
             deshalb JEDEN Gegner durchsichtig, und weil die Deckung nach
             dem Ausblenden auf null stehen bleibt, bleiben auch alle
             spaeter erscheinenden unsichtbar. Genau das war "man sieht die
             Gegner nicht mehr".
             Deshalb bekommt der sterbende Gegner hier eigene Kopien. */
          e.visual.root.traverse((o) => {
            if (!o.isMesh && !o.isSkinnedMesh) return;
            const war = Array.isArray(o.material) ? o.material : [o.material];
            const neu2 = [];
            for (const m of war) {
              if (!m) { neu2.push(m); continue; }
              const k = m.clone();
              k.transparent = true;
              neu2.push(k);
              e.blendMats.push(k);
            }
            o.material = Array.isArray(o.material) ? neu2 : neu2[0];
          });
        }
        for (const m of e.blendMats) m.opacity = a;
      }
      /* Die Umfall-Bewegung legt die Figur selbst waagerecht hin. Die
         zusätzliche Vierteldrehung der ganzen Figur hat sie zusätzlich
         gekippt – die Füße steckten dadurch bis zu 30 cm im Asphalt.
         Stattdessen wird der Körper wie beim Helden so weit abgesenkt,
         dass der tiefste Knochen wirklich aufliegt. */
      e.visual.root.position.copy(e.pos);
      e.visual.root.rotation.x = lerp(e.visual.root.rotation.x, 0, Math.min(1, dt * 8));
      /* Warn- und Deckungszeichen gehören zu einem Gegner, der noch kämpft. */
      if (e.warn) e.warn.visible = false;
      if (e.blockZ) e.blockZ.visible = false;
      e.visual.play('downed', { t: elapsed }, dt);
      if (e.visual.legeHin) e.visual.legeHin(Math.min(1, dt * 6));
      if (e.deadT <= 0) {
        scene.remove(e.visual.root);
        enemies.splice(i, 1);
      }
      continue;
    }

    if (e.webT > 0) {
      e.webT -= dt;
      e.cocoon.visible = true;
      if (e.webT <= 0) { e.cocoon.visible = false; e.webStufe = 0; }
      /* Nur voll eingesponnene Gegner stehen still – teilweise eingewickelte
         zappeln weiter und können sich langsam bewegen. */
      if (e.webStufe >= 3) {
        e.visual.root.position.copy(e.pos);
        e.visual.root.rotation.y = e.facing;
        e.visual.play('webbed', { t: elapsed }, dt);
        continue;
      }
      /* Löst sich das Netz wieder, fällt ein angeklebter Gegner herunter. */
      if (e.anWand) {
        e.anWand = false;
        e.vel.set(0, 0, 0);
        if (e.cocoon.userData.setzeWand) e.cocoon.userData.setzeWand(false);
        if (e.cocoon.userData.setzeKokon) e.cocoon.userData.setzeKokon(false);
      }
    }

    if (e.inDerLuft > 0) e.inDerLuft -= dt;
    if (e.geworfen > 0) e.geworfen -= dt;
    if (e.staggerT > 0) {
      e.staggerT -= dt;
      /* Rückstoß ausklingen lassen. Ein Wurf soll dagegen weit tragen –
         mit der normalen Dämpfung kam der Gegner keine drei Meter weit. */
      const bremse = e.geworfen > 0 ? 1.1 : 6;
      e.vel.x = lerp(e.vel.x, 0, dt * bremse);
      e.vel.z = lerp(e.vel.z, 0, dt * bremse);
      e.vel.y -= CFG.gravity * dt;
      e.pos.addScaledVector(e.vel, dt);
      const gy = groundY(e.pos.x, e.pos.z);
      if (e.pos.y < gy) { e.pos.y = gy; e.vel.y = 0; }
      collideBody(e);
      /* Wer geworfen wurde und dabei gegen eine Wand knallt, kassiert
         zusätzlich – die Umgebung ist eine Waffe. */
      /* Der Aufprall zählt erst, wenn der Wurf wirklich unterwegs war –
         sonst löst schon der Startpunkt am Boden den Treffer aus und der
         Gegner fliegt gar nicht erst los. */
      const gelandet = e.pos.y <= gy + 0.02 && e.geworfen < 0.95;
      if (e.geworfen > 0 && (e.wall || gelandet)) {
        e.geworfen = 0;
        const wucht = Math.hypot(e.vel.x, e.vel.z);
        if (wucht > 6 || e.wall) {
          damageEnemy(e, e.wall ? 26 : 14, 'kick');
          treffEffekt(_v1.set(e.pos.x, e.pos.y + 1.0, e.pos.z), 1.8, 0xffd23c);
          staubWolke(e.pos, 1.1);
          camShake = Math.max(camShake, 0.14);
          hitstop(0.07);
          if (e.wall) {
            popupWorld('Gegen die Wand!', e.pos, '#ffd23c');
            addScore(40, '', e.pos);
            e.vel.multiplyScalar(0.15);
          } else {
            e.vel.x *= 0.45; e.vel.z *= 0.45;   // rutscht noch ein Stück
          }
        }
      }
      e.visual.root.position.copy(e.pos);
      e.visual.play('air', { t: elapsed }, dt);
      // Pose erst nach der Animation setzen, sonst überschreibt der Mixer sie
      if (e.visual.poseTreffer) e.visual.poseTreffer(1 - e.staggerT / 0.9);
      continue;
    }

    const dp = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
    const dpy = Math.abs(player.pos.y - e.pos.y);

    /* Wer den Helden direkt neben sich hat, lässt den Zivilisten los.
       Vorher galt das nur beim Patrouillieren: Ganoven, die hinter einem
       Passanten herliefen, rannten an einem danebenstehenden Spider-Man
       vorbei, bis man sie einzeln anschlug. */
    if (!player.dead && e.target !== 'player' && !e.bewacht && !e.dieb &&
        dp < 9 && dpy < 3 && e.betaeubtT <= 0) {
      e.state = 'chase'; e.target = 'player';
      alarmiereGang(e, 14);
    }

    /* Zielwahl */
    if (e.state === 'patrol') {
      if (dp < 11 && dpy < 3 && !player.dead) { e.state = 'chase'; e.target = 'player'; }
      else {
        /* Weiter Umkreis: bei 22 Zivilisten auf der ganzen Karte kam sonst
           nie einer nah genug vorbei, und die Gang stand nur herum. */
        let civ = null, civD = 38;
        for (const c of civilians) {
          if (c.state === 'hurt') continue;
          const d = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
          if (d < civD) { civ = c; civD = d; }
        }
        /* Deutlich häufiger auf Zivilisten losgehen – dadurch gibt es
           überhaupt etwas zu retten, statt dass die Gang nur herumsteht
           oder gegen Häuser läuft. */
        if (civ && Math.random() < dt * 3) { e.state = 'chase'; e.target = civ; }
      }
    }
    if (e.target === 'player' && (player.dead || (dp > 40 || dpy > 12))) {
      e.state = 'patrol'; e.target = null;
    }
    /* Ist der Spieler auf einem Dach oder an einer Wand, kommt ein Ganove
       nicht hinterher. Er rannte dann dauerhaft gegen die Hauswand –
       das sah aus, als liefe er ins Haus hinein. Nach ein paar Sekunden
       ohne Fortschritt gibt er auf und patrouilliert weiter. */
    if (e.target === 'player' && dpy > 3.5) {
      e.vergeblichT = (e.vergeblichT || 0) + dt;
      if (e.vergeblichT > 3) {
        e.state = 'patrol'; e.target = null; e.vergeblichT = 0;
        /* Statt weiter gegen das Haus zu laufen: nächsten Zivilisten
           suchen und den angreifen. */
        let civ = null, civD = 26;
        for (const c of civilians) {
          if (c.state === 'hurt') continue;
          const dd = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
          if (dd < civD) { civ = c; civD = dd; }
        }
        if (civ) { e.state = 'chase'; e.target = civ; }
      }
    } else e.vergeblichT = 0;

    let moveX = 0, moveZ = 0, speed = 0, anim = 'idle';
    /* Kurz benommen nach einem Konter: steht still und wehrt sich nicht. */
    if (e.betaeubtT > 0) e.betaeubtT -= dt;

    /* ---- Angeschlagen? Dann erst einmal Abstand ----
       Vorher kaempfte jeder Ganove bis zum Umfallen weiter, egal wie
       schwer getroffen. Wer unter ein Viertel seiner Kraft faellt, geht
       jetzt ein paar Sekunden auf Abstand, sammelt sich und kommt dann
       wieder. Wer allein uebrig ist und fast am Ende, laeuft ganz weg -
       einen letzten Schlag von jemandem einzustecken, der eigentlich
       schon aufgegeben hat, ist kein guter Kampf. */
    if (e.rueckzugT === undefined) { e.rueckzugT = 0; e.rueckzugCd = 0; }
    if (e.rueckzugT > 0) e.rueckzugT -= dt;
    if (e.rueckzugCd > 0) e.rueckzugCd -= dt;
    const angeschlagen = e.hp < (e.hpMax || CFG.enemyHP) * 0.26;
    if (angeschlagen && e.rueckzugT <= 0 && e.rueckzugCd <= 0 &&
        e.target === 'player' && dp < 7 && !e.dieb && e.betaeubtT <= 0) {
      /* 1,4 bis 2,6 s und 6,5 m waren zu wenig: der Ganove war sofort
         wieder da, es sah nach einem Schritt zurueck aus statt nach
         Rueckzug. Jetzt drei bis viereinhalb Sekunden und elf Meter. */
      e.rueckzugT = rand(3.0, 4.5);
      e.rueckzugCd = e.rueckzugT + rand(5.0, 8.0);
      if (Math.random() < 0.4) popupWorld('Rueckzug!', e.pos, '#ffd0a8');
    }

    /* Der Dieb rennt vom Helden weg statt auf ihn zu. */
    if (e.dieb) {
      const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
      const dd = Math.hypot(dx, dz) || 1;
      moveX = dx / dd; moveZ = dz / dd;
      speed = (e.typ ? e.typ.tempo : 5) * 1.5;
      anim = 'run';
      e.facing = dampAngle(e.facing, Math.atan2(moveX, moveZ), dt * 8);
      e.state = 'patrol'; e.target = null;
    } else if (e.rueckzugT > 0) {
      /* Rueckwaerts aus der Reichweite - das Gesicht bleibt zum Helden,
         sonst sieht es wie Weglaufen aus statt wie Deckung suchen. */
      const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
      const dd = Math.hypot(dx, dz) || 1;
      if (dd < 11.0) { moveX = dx / dd; moveZ = dz / dd; speed = (e.typ ? e.typ.tempo : 5) * 0.9; }
      anim = speed > 0.2 ? 'run' : 'idle';
      e.facing = dampAngle(e.facing, Math.atan2(-moveX, -moveZ), dt * 6);
    } else if (e.state === 'chase') {
      const tp = e.target === 'player' ? player.pos : (e.target ? e.target.pos : null);
      if (!tp || (e.target !== 'player' && e.target.state === 'hurt')) {
        e.state = 'patrol'; e.target = null;
      } else {
        const dx = tp.x - e.pos.x, dz = tp.z - e.pos.z;
        const d = Math.hypot(dx, dz);
        const dy = Math.abs(tp.y - e.pos.y);
        e.facing = dampAngle(e.facing, Math.atan2(dx, dz), dt * 8);
        /* Der Ring, auf dem die Ganoven Aufstellung nehmen, hat 1,9 m
           Radius – die Schlagfreigabe lag aber bei 1,7 m. Dadurch stand
           der Gegner dauerhaft knapp außerhalb seiner eigenen Reichweite
           und rannte nur noch auf der Stelle, ohne je zuzuschlagen.
           Die Freigabe liegt jetzt sicher außerhalb des Rings. */
        /* Ohne Angriffsrecht wird nicht herangelaufen: dann steht der
           Platz auf einem weiteren Ring, gut zweieinhalb Meter vom Helden
           entfernt. So sieht man, wer gerade dran ist. */
        const darfAngreifen = e.target !== 'player' || KAMPF_RECHT.has(e);
        const ringR = darfAngreifen ? 1.15 : 3.0;
        if (!darfAngreifen) {
          /* ---- Wer nicht dran ist, haelt Abstand ----
             Und zwar IMMER, nicht nur wenn er gerade schlagbereit waere.
             Vorher fiel ein Gegner mit laufender Schlagpause (attackCd)
             durch alle Zweige und blieb reglos stehen, wo er gerade war -
             oft mitten im Nahkampf. Deshalb standen trotz Angriffsrecht
             im Schnitt zweieinhalb Ganoven direkt am Helden.
             Jetzt geht er auf seinen Platz auf dem weiteren Ring und
             wandert dort seitlich weiter. */
          e.ringWinkel = (e.ringWinkel || 0) + dt * (e.ringDreh || 0.9);
          if (Math.random() < dt * 0.35) e.ringDreh = -(e.ringDreh || 0.9);
          const zx = tp.x + Math.sin(e.ringWinkel) * ringR - e.pos.x;
          const zz = tp.z + Math.cos(e.ringWinkel) * ringR - e.pos.z;
          const zd = Math.hypot(zx, zz) || 1;
          if (zd > 0.3) {
            moveX = zx / zd; moveZ = zz / zd;
            const raus = d < ringR - 0.7;          // zu dicht dran
            speed = (e.typ ? e.typ.tempo : 5) * (raus ? 0.9 : 0.5);
            anim = raus ? 'run' : 'walk';
          }
        } else if (d > 1.25 || dy > 1.6) {
          /* Nicht alle auf denselben Punkt zulaufen – sonst stapeln sich
             die Ganoven zu einem einzigen Klumpen. Jeder steuert seinen
             eigenen Platz auf einem Ring um das Ziel an. */
          if (e.ringWinkel === undefined) e.ringWinkel = Math.random() * Math.PI * 2;
          const zx = tp.x + Math.sin(e.ringWinkel) * ringR - e.pos.x;
          const zz = tp.z + Math.cos(e.ringWinkel) * ringR - e.pos.z;
          const zd = Math.hypot(zx, zz) || 1;
          moveX = zx / zd; moveZ = zz / zd;
          speed = (e.target === 'player' ? 1 : 0.85) * (e.typ ? e.typ.tempo : 5);
          anim = 'run';
          if (e.target === 'player' && dy > 3 && d < 4) { anim = 'idle'; speed = 0; } // kommt nicht hoch
        } else if (e.attackCd <= 0 && !e.attack && e.warnT <= 0 && e.blockT <= 0 &&
                   e.betaeubtT <= 0 && e.rueckzugT <= 0) {
          /* Wer in Deckung steht, holt nicht gleichzeitig aus. */
          /* Erst ausholen und warnen, dann schlagen. Vorher kam der Treffer
             ohne Vorankündigung – ausweichen war reine Glückssache. */
          /* Jeder vierte Angriff ist ein Klingenhieb – mit doppelt so
             langer Vorwarnung, damit man ihn kontern kann. */
          e.klingeGeplant = Math.random() < 0.26;
          e.warnT = e.klingeGeplant ? 0.95 : 0.55;
        }
      }
    } else if (e.bewacht) {
      /* Bewacher bleiben dicht bei der Geisel und gehen nur auf den
         Helden los, wenn er nah genug kommt. */
      const g = e.bewacht;
      const dx = g.pos.x - e.pos.x + Math.sin(e.ringWinkel || 0) * 1.6;
      const dz = g.pos.z - e.pos.z + Math.cos(e.ringWinkel || 0) * 1.6;
      const dd = Math.hypot(dx, dz);
      if (dd > 1.2) { moveX = dx / dd; moveZ = dz / dd; speed = 3.4; anim = 'run'; }
      if (dp < 9) { e.state = 'chase'; e.target = 'player'; }
      e.facing = dampAngle(e.facing, Math.atan2(player.pos.x - e.pos.x, player.pos.z - e.pos.z), dt * 5);
    } else {
      // Patrouille rund ums Revier
      if (!e.waypoint || Math.hypot(e.waypoint.x - e.pos.x, e.waypoint.z - e.pos.z) < 1) {
        e.waitT -= dt;
        if (e.waitT <= 0) {
          /* Nur Wegpunkte im Freien. Vorher konnte der Punkt mitten in
             einem Haus liegen – der Ganove rannte dann bis zum nächsten
             Wechsel gegen die Wand, und von außen sah es aus, als liefe er
             ins Haus hinein. */
          e.waypoint = freierPunkt(e.gang.home.x, e.gang.home.z, 12)
                    || freierPunkt(e.pos.x, e.pos.z, 8);
          e.waitT = rand(1, 3.5);
        }
      } else {
        const dx = e.waypoint.x - e.pos.x, dz = e.waypoint.z - e.pos.z;
        const d = Math.hypot(dx, dz);
        moveX = dx / d; moveZ = dz / d;
        speed = 1.8; anim = 'run';
        e.facing = dampAngle(e.facing, Math.atan2(dx, dz), dt * 6);
      }
    }

    /* Angriff ausführen. Jeder Ganove hat mehrere Schläge statt immer
       desselben: gerader Stoß, Haken, Tritt, Knie. Sie unterscheiden sich
       in Dauer, Reichweite und Wucht. */
    if (e.attack) {
      const a = e.attack;
      a.t += dt / a.dauer;
      anim = 'idle'; speed = 0;
      /* Ausfallschritt: der Gegner geht in den Schlag hinein, statt aus der
         Distanz in die Luft zu hauen. */
      if (a.t < 0.6 && e.target === 'player' && dp > 1.0) {
        const zx = (player.pos.x - e.pos.x) / (dp || 1), zz = (player.pos.z - e.pos.z) / (dp || 1);
        e.pos.x += zx * Math.min(2.6, (dp - 0.95)) * dt * 3.2;
        e.pos.z += zz * Math.min(2.6, (dp - 0.95)) * dt * 3.2;
      }
      if (a.klinge) zeigeKlingenBogen(e, (a.t - a.treff + 0.22) / 0.42);
      if (!a.hitDone && a.t > a.treff) {
        a.hitDone = true;
        const reich = a.reichweite;
        if (e.target === 'player') {
          if (dp < reich && dpy < 2) damagePlayer((e.typ ? e.typ.schaden : 8) * a.wucht, e.pos);
        } else if (e.target && Math.hypot(e.target.pos.x - e.pos.x, e.target.pos.z - e.pos.z) < reich) {
          hurtCivilian(e.target, e);
        }
      }
      if (a.t >= 1) e.attack = null;
    }
    if (e.attackCd > 0) e.attackCd -= dt;
    if (e.ausweichCd > 0) e.ausweichCd -= dt;
    if (e.iFrames > 0) e.iFrames -= dt;

    /* Vorwarnung: Ausrufezeichen blinkt, danach folgt der Schlag. */
    if (e.warnT > 0) {
      e.warnT -= dt;
      e.warn.visible = ((elapsed * 9) % 2) < 1;
      if (e.warnT <= 0) {
        e.warn.visible = false;
        /* Nach längerer Vorwarnung folgt der Klingenhieb. */
        const m = e.klingeGeplant ? KLINGENHIEB : pick(GANOVEN_SCHLAEGE);
        e.klingeGeplant = false;
        e.attack = { type: 'thugSwing', t: 0, hitDone: false, klinge: !!m.klinge,
                     dauer: m.dauer, treff: m.treff, reichweite: m.reichweite, wucht: m.wucht };
        if (m.klinge) SFX.swoosh();
        /* Enger Abstand heißt auch: es trifft öfter. Die Pause zwischen
           zwei Schlägen wird dafür wieder etwas länger, sonst nimmt ein
           einzelner Ganove in zehn Sekunden fast die ganze Lebensleiste. */
        e.attackCd = rand(1.3, 2.1);
        if (e.visual.attackOneShot) e.visual.attackOneShot(0, m.art, m.dauer * 0.85);
      }
    } else if (e.warn) e.warn.visible = false;

    /* Blocken: Gegner geht kurz in Deckung. Treffer richten dann wenig aus –
       ein Tritt bricht die Deckung trotzdem. */
    if (e.blockT > 0) {
      e.blockT -= dt;
      if (e.blockT <= 0) e.blockCd = rand(1.6, 4.5);
    } else {
      e.blockCd -= dt;
      /* Deckung ist eine REAKTION, kein Dauerzustand. Vorher ging der
         Gegner in Deckung, sobald der Nachladebalken leer war – er stand
         damit fast ein Drittel der Zeit blockend herum und kam nie zum
         Schlagen. Jetzt blockt er nur, wenn der Spieler wirklich gerade
         angreift und nah genug ist. */
      const nah = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 3.2;
      const spielerSchlaegt = !!player.attack && player.attack.type !== 'web';
      if (e.blockCd <= 0 && nah && spielerSchlaegt && !e.attack && e.warnT <= 0 &&
          e.webT <= 0 && Math.random() < e.typ.blockChance) {
        e.blockT = rand(0.5, 0.9);
      }
    }
    if (e.blockZ) e.blockZ.visible = e.blockT > 0 &&
      !(e.visual.hatClip && e.visual.hatClip('block'));

    /* Abstand zu ALLEN Ganoven halten – vorher galt das nur innerhalb
       der eigenen Gang, deshalb liefen zwei Gangs ineinander. */
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.05 && d > 0.01) {
        const schub = (1.05 - d) * 0.5;
        e.pos.x += (dx / d) * schub;
        e.pos.z += (dz / d) * schub;
      }
    }

    /* Auch zum Helden Abstand halten – aber nur so viel, dass man sich
       beim Schlag noch berührt. */
    {
      const dxp = e.pos.x - player.pos.x, dzp = e.pos.z - player.pos.z;
      const dpp = Math.hypot(dxp, dzp);
      if (dpp < 0.78 && dpp > 0.01 && Math.abs(e.pos.y - player.pos.y) < 1.8) {
        const schub = (0.78 - dpp) * 0.55;
        e.pos.x += (dxp / dpp) * schub;
        e.pos.z += (dzp / dpp) * schub;
      }
    }

    if (e.webT > 0) speed *= 0.35;      // im Netz zappelnd, kaum vorwärts
    /* Blockiert eine Hauswand den direkten Weg, wird eine Weile seitlich
       daran entlanggelaufen. Vorher rannten die Ganoven stur gegen die
       Fassade – von außen sah es aus, als liefen sie ins Haus hinein. */
    if (e.umwegT > 0) {
      e.umwegT -= dt;
      const qx = -moveZ * e.umwegSeite, qz = moveX * e.umwegSeite;
      moveX = moveX * 0.35 + qx * 0.95;
      moveZ = moveZ * 0.35 + qz * 0.95;
      const l = Math.hypot(moveX, moveZ) || 1;
      moveX /= l; moveZ /= l;
    }
    e.vel.x = moveX * speed; e.vel.z = moveZ * speed;
    const vorX = e.pos.x, vorZ = e.pos.z;
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    collideBody(e);
    if (speed > 0.5 && e.umwegT <= 0) {
      const gewollt = speed * dt;
      const echt = Math.hypot(e.pos.x - vorX, e.pos.z - vorZ);
      e.blockiertT = echt < gewollt * 0.45 ? (e.blockiertT || 0) + dt : 0;
      if (e.blockiertT > 0.35) {
        e.umwegT = rand(1.2, 2.2);
        e.umwegSeite = Math.random() < 0.5 ? 1 : -1;
        e.blockiertT = 0;
      }
    }
    /* Höhe weich nachführen: bei Bordsteinkanten sonst sichtbares Springen,
       und niemals unter den Boden. */
    /* Nicht aus der Stadt hinauslaufen. Durch den weiten Zivilisten-Radius
       konnten Gangs sonst bis auf die nackte Grundfläche außerhalb des
       Rasters ziehen. */
    if (haltenImGebiet(e.pos)) { e.waypoint = null; e.target = null; e.state = 'patrol'; }
    e.pos.y = lerp(e.pos.y, groundY(e.pos.x, e.pos.z), Math.min(1, dt * 12));
    e.pos.y = Math.max(e.pos.y, groundY(e.pos.x, e.pos.z) - 0.02);
    if (speed > 0.1) e.phase += dt * (4 + speed * 1.7);

    e.visual.root.position.copy(e.pos);
    e.visual.root.rotation.x = lerp(e.visual.root.rotation.x, 0, dt * 8);
    e.visual.root.rotation.y = e.facing;
    /* Deckung und Ausholen sind eigene Bewegungen, sobald die Dateien da
       sind – sonst bleibt es bei Stehen plus Symbol über dem Kopf. */
    let ganovAnim = anim === 'run' ? 'run' : 'idle';
    if (e.blockT > 0 && e.visual.hatClip && e.visual.hatClip('block')) ganovAnim = 'block';
    else if (e.warnT > 0 && e.visual.hatClip && e.visual.hatClip('taunt')) ganovAnim = 'taunt';
    e.visual.play(ganovAnim,
      { phase: e.phase, speed01: clamp(speed / 5, 0, 1), speed,
        t: elapsed + e.phase }, dt);
    if (e.visual.procedural) overlayAttack(e.visual.human, e.attack, dt);
    else if (e.visual.bodenAusgleich) e.visual.bodenAusgleich(Math.min(1, dt * 12));
    // HP-Balken zur Kamera & ausblenden wenn voll
    e.hpBar.g.visible = e.hp < (e.hpMax || CFG.enemyHP);
  }

  /* Nachschub */
  const alive = enemies.filter((e) => !e.dead).length;
  gangRespawnT -= dtBild;
  if (alive < CFG.maxEnemies - 3 && gangRespawnT <= 0) {
    spawnGangAwayFromPlayer();
    gangRespawnT = 12;
  }

  updateMission(dtBild);
}

let gangRespawnT = 8;

/* Roter Lichtstrahl über der Verbrechens-Gang */
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.6, 1.4, 60, 10, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
);
beacon.visible = false;
scene.add(beacon);

function setzeBeacon(pos, farbe) {
  if (!pos) { beacon.visible = false; return; }
  beacon.visible = true;
  beacon.position.set(pos.x, pos.y + 30, pos.z);
  beacon.material.color.setHex(farbe === undefined ? 0xff2233 : farbe);
  beacon.material.opacity = 0.22 + Math.sin(elapsed * 5) * 0.08;
}
function updateCrimeBeacon() {
  const alive = crimeGang ? crimeGang.enemies.filter((e) => !e.dead) : [];
  setzeBeacon(alive.length ? alive[0].pos : null);
}

/* ======================= Aufträge =======================
   Vorher gab es genau eine Aufgabe ("Schalte die Gang aus"), alle 45
   Sekunden dieselbe. Jetzt wechseln fünf Arten mit eigener Uhr, eigenem
   Ziel und eigener Belohnung. */
/* Von 3,4 auf 5,0 m Radius. Mit dem alten Ring und einem Trefferkreis von
   4 m musste man ihn fast mittig durchfliegen - im Gleitflug oder am Netz
   ist das kaum zu steuern. */
const ringGeoM = new THREE.TorusGeometry(5.0, 0.30, 8, 24);
const ringMatM = new THREE.MeshBasicMaterial({ color: 0x4fd2ff, transparent: true, opacity: 0.85 });
const rennRinge = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(ringGeoM, ringMatM.clone());
  m.visible = false; scene.add(m); rennRinge.push(m);
}

const MISSION = { art: null, zeit: 0, daten: null, text: '' };
let missionCd = 18;

function missionZiel() {
  const d = MISSION.daten;
  if (!d) return null;
  switch (MISSION.art) {
    case 'gang': { const a = d.gang.enemies.filter((e) => !e.dead); return a.length ? a[0].pos : null; }
    case 'flucht': return d.car ? d.car.mesh.position : null;
    case 'geisel': return d.civ ? d.civ.pos : null;
    case 'dieb': return d.dieb && !d.dieb.dead ? d.dieb.pos : null;
    case 'rennen': return d.rest.length ? d.rest[0].pos : null;
    default: return null;
  }
}

function missionEnde(erfolg, text, punkte) {
  const d = MISSION.daten;
  if (d) {
    if (d.civ) d.civ.geisel = false;
    if (d.car) { d.car.flucht = false; d.car.speed = d.car.altSpeed; }
    if (d.dieb) d.dieb.dieb = false;
    if (d.wachen) for (const e of d.wachen) e.bewacht = null;
  }
  for (const r of rennRinge) r.visible = false;
  MISSION.art = null; MISSION.daten = null;
  crimeGang = null;
  setzeBeacon(null);
  hideObjective();
  popupScreen(text);
  /* Ein erledigter Auftrag hebt das Ansehen, ein liegengebliebener senkt es. */
  setzeRuf(erfolg ? +5 : -4);
  if (erfolg && punkte) addScore(punkte, '', player.pos);
  missionCd = erfolg ? 14 : 22;
}

function starteMission() {
  const moeglich = [];
  const gangKandidaten = gangs.filter((g) => !g.cleared && g.enemies.some((e) => !e.dead));
  if (gangKandidaten.length) { moeglich.push('gang', 'geisel', 'dieb'); }
  if (cars.length) moeglich.push('flucht');
  moeglich.push('rennen');
  const art = pick(moeglich);

  if (art === 'gang') {
    const g = pick(gangKandidaten);
    for (const e of g.enemies) if (!e.dead) { e.state = 'chase'; e.target = 'player'; }
    crimeGang = g;
    /* Auch der Ueberfall hat eine Frist – sonst bleibt ein Auftrag, den
       man nicht annimmt, für immer offen und es kommt nie ein neuer. */
    MISSION.art = 'gang'; MISSION.zeit = 90; MISSION.daten = { gang: g };
    MISSION.text = '🚨 Überfall! Schalte die markierte Gang aus';
    if (helis.length) helis[0].zielMitte = { x: g.home.x, z: g.home.z };

  } else if (art === 'flucht') {
    const car = pick(cars);
    car.altSpeed = car.speed;
    car.speed = 22;
    car.flucht = true;
    MISSION.art = 'flucht'; MISSION.zeit = 55;
    MISSION.daten = { car, treffer: 0, noetig: 3 };
    MISSION.text = '🚗 Fluchtauto! Stoppe es mit drei Treffern';

  } else if (art === 'geisel') {
    const g = pick(gangKandidaten);
    const lebende = g.enemies.filter((e) => !e.dead);
    let civ = null, best = 1e9;
    for (const c of civilians) {
      if (c.state === 'hurt' || c.geisel) continue;
      const dd = Math.hypot(c.pos.x - g.home.x, c.pos.z - g.home.z);
      if (dd < best) { best = dd; civ = c; }
    }
    if (!civ) { missionCd = 8; return; }
    civ.geisel = true;
    civ.pos.x = g.home.x + rand(-3, 3);
    civ.pos.z = g.home.z + rand(-3, 3);
    const wachen = lebende.slice(0, 2);
    for (const e of wachen) { e.bewacht = civ; e.state = 'chase'; e.target = 'player'; }
    MISSION.art = 'geisel'; MISSION.zeit = 70;
    MISSION.daten = { civ, wachen };
    MISSION.text = '🆘 Geisel! Schalte die Bewacher aus';

  } else if (art === 'dieb') {
    const g = pick(gangKandidaten);
    const dieb = pick(g.enemies.filter((e) => !e.dead));
    dieb.dieb = true;
    dieb.state = 'patrol'; dieb.target = null;
    MISSION.art = 'dieb'; MISSION.zeit = 50;
    MISSION.daten = { dieb };
    MISSION.text = '💰 Dieb auf der Flucht! Schnapp ihn dir';

  } else {
    /* Zeitrennen: eine Kette Ringe durch die Häuserschluchten. */
    const rest = [];
    let x = player.pos.x, z = player.pos.z;
    for (let i = 0; i < 6; i++) {
      let px, pz, tries = 0;
      do {
        /* Kuerzere Abstaende: 38 bis 62 m waren im Bogen kaum zu treffen. */
        const a = rand(0, Math.PI * 2), r = rand(26, 44);
        px = clamp(x + Math.cos(a) * r, -160, 160);
        pz = clamp(z + Math.sin(a) * r, -160, 160);
      } while (inGebaeude(px, pz) && ++tries < 14);
      /* Etwas tiefer: auf 46 m kommt man im Gleitflug kaum wieder hoch. */
      const p = V3(px, rand(20, 38), pz);
      rest.push({ pos: p });
      x = px; z = pz;
    }
    rest.forEach((r, i) => {
      const m = rennRinge[i];
      m.visible = true;
      m.position.copy(r.pos);
      m.rotation.set(0, rand(0, Math.PI), Math.PI / 2);
      r.mesh = m;
    });
    MISSION.art = 'rennen'; MISSION.zeit = 85;
    MISSION.daten = { rest, gesamt: rest.length };
    MISSION.text = '🏁 Zeitrennen! Flieg durch alle Ringe';
  }
  showObjective(MISSION.text);
  SFX.score();
}

function updateMission(dt) {
  if (!MISSION.art) {
    missionCd -= dt;
    if (missionCd <= 0) starteMission();
    return;
  }
  const d = MISSION.daten;
  if (MISSION.zeit > 0) {
    MISSION.zeit -= dt;
    if (MISSION.zeit <= 0) { missionEnde(false, '⏱️ Zeit abgelaufen'); return; }
  }

  switch (MISSION.art) {
    case 'gang':
      if (!d.gang.enemies.some((e) => !e.dead)) missionEnde(true, '✅ Gang ausgeschaltet!', 200);
      break;

    case 'flucht': {
      const c = d.car;
      const p = c.mesh.position;
      const dist = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      /* Treffer zählt, wenn man das Auto im Angriff erwischt oder darauf
         landet. */
      if (d.cd > 0) d.cd -= dt;
      const trifft = dist < 3.4 && Math.abs(player.pos.y - p.y) < 3.2 &&
                     ((player.attack && !player.attack.hitDone) || player.platform === c);
      if (trifft && !(d.cd > 0)) {
        d.treffer++; d.cd = 1.0;
        treffEffekt(_v1.set(p.x, p.y + 1.2, p.z), 1.6, 0xffd23c);
        hitstop(0.07); camShake = Math.max(camShake, 0.14);
        c.speed = Math.max(6, c.speed - 6);
        popupWorld(`Treffer ${d.treffer}/${d.noetig}`, p, '#ffd23c');
        showObjective(`${MISSION.text}  (${d.treffer}/${d.noetig})`);
        if (d.treffer >= d.noetig) { missionEnde(true, '✅ Fluchtauto gestoppt!', 250); return; }
      }
      break;
    }

    case 'geisel': {
      if (!d.civ || d.civ.state === 'hurt') { missionEnde(false, '❌ Die Geisel wurde verletzt'); return; }
      if (!d.wachen.some((e) => !e.dead)) missionEnde(true, '✅ Geisel befreit!', 260);
      break;
    }

    case 'dieb':
      if (!d.dieb || d.dieb.dead) missionEnde(true, '✅ Dieb geschnappt!', 220);
      break;

    case 'rennen': {
      const r = d.rest[0];
      if (r) {
        const dx = player.pos.x - r.pos.x, dy = player.pos.y - r.pos.y, dz = player.pos.z - r.pos.z;
        if (Math.hypot(dx, dy, dz) < 5.6) {
          r.mesh.visible = false;
          d.rest.shift();
          treffEffekt(r.pos, 2.2, 0x4fd2ff);
          SFX.score();
          addScore(40, '', r.pos);
          MISSION.zeit += 9;                    // Zeitbonus pro Ring
          showObjective(`${MISSION.text}  (${d.gesamt - d.rest.length}/${d.gesamt})`);
        }
      }
      /* Der nächste Ring leuchtet, die folgenden bleiben blass. */
      d.rest.forEach((x, i) => {
        if (!x.mesh) return;
        x.mesh.material.opacity = i === 0 ? 0.9 : 0.32;
        x.mesh.material.color.setHex(i === 0 ? 0x4fd2ff : 0x9fb6c4);
        x.mesh.rotation.y += dt * (i === 0 ? 0.8 : 0.2);
      });
      if (!d.rest.length) { missionEnde(true, '🏁 Rennen geschafft!', 300); return; }
      break;
    }
  }

  setzeBeacon(missionZiel(), MISSION.art === 'rennen' ? 0x4fd2ff : 0xff2233);
  if (MISSION.zeit > 0) {
    objectiveEl.textContent = `${MISSION.text}${MISSION.art === 'flucht' && d.treffer !== undefined
      ? `  (${d.treffer}/${d.noetig})` : ''}   ⏱ ${Math.ceil(MISSION.zeit)}s`;
  }
}

/* ======================= Einstellungen =======================
   Mausempfindlichkeit, Lautstärke und Grafikstufe waren fest verdrahtet.
   Alles ist jetzt über Esc erreichbar und wird im Browser gespeichert. */
const EINST = { maus: 100, ton: 70, grafik: 'hoch', musik: 'an', karte: 'an', autokam: 'gleiten' };
try {
  const g = JSON.parse(localStorage.getItem('webhero_einst') || 'null');
  if (g) Object.assign(EINST, g);
  /* Handys und Tablets starten mit mittlerer Grafik – Schatten kosten dort
     am meisten. Wer es anders will, stellt es einmal um; die Wahl bleibt
     dann gespeichert. */
  else if (istTouch) EINST.grafik = 'mittel';
  /* Auf dem Handy hat man beim Schwingen keine Hand frei, um die Kamera zu
     wischen. Dort zieht sie deshalb von sich aus mit, sobald der Daumen
     einen Moment ruht. Am Rechner bleibt es bei "nur beim Schwingen und
     Gleiten", weil die Maus dort ohnehin immer greifbar ist. */
  if (!g && istTouch) EINST.autokam = 'an';
} catch (e) {}

const settingsEl = document.getElementById('settings');
function einstSpeichern() {
  try { localStorage.setItem('webhero_einst', JSON.stringify(EINST)); } catch (e) {}
}
function wendeKarteAn() {
  karteAn = EINST.karte === 'an';
  const el = document.getElementById('minimap');
  if (el) el.style.display = karteAn ? 'block' : 'none';
}
function wendeGrafikAn() {
  const stufeG = EINST.grafik;
  renderer.shadowMap.enabled = stufeG === 'hoch';
  if (sun) sun.castShadow = stufeG === 'hoch';
  REGEN.erlaubt = stufeG !== 'niedrig';
  if (stufeG === 'niedrig' && REGEN.staerke > 0) REGEN.staerke = 0;
  scene.fog.far = stufeG === 'niedrig' ? 260 : (stufeG === 'mittel' ? 380 : 520);
  /* Weit entfernte Figuren werden bei niedriger Stufe früher ausgeblendet. */
  LOD_WEITE = stufeG === 'niedrig' ? 70 : (stufeG === 'mittel' ? 100 : 130);
  if (regenPunkte) regenPunkte.visible = REGEN.erlaubt && REGEN.staerke > 0.02;
}
function wendeTonAn() {
  if (SFX.setLautstaerke) SFX.setLautstaerke(EINST.ton / 100);
  MUSIK.setModus(EINST.musik);
}

function zeigeEinstellungen(an) {
  settingsEl.style.display = an ? 'flex' : 'none';
  if (an && document.pointerLockElement) document.exitPointerLock();
}
(function baueEinstellungen() {
  const maus = document.getElementById('setMaus');
  const ton = document.getElementById('setTon');
  const graf = document.getElementById('setGrafik');
  const mus = document.getElementById('setMusik');
  const kar = document.getElementById('setKarte');
  const akam = document.getElementById('setAutokam');
  const wMaus = document.getElementById('wMaus');
  const wTon = document.getElementById('wTon');
  if (!maus) return;
  maus.value = EINST.maus; ton.value = EINST.ton; graf.value = EINST.grafik;
  if (mus) mus.value = EINST.musik;
  if (kar) kar.value = EINST.karte;
  if (akam) akam.value = EINST.autokam;
  /* Auf dem Handy heißt der Regler nach dem, was man dort tut. */
  const lbl = document.getElementById('lblMaus');
  if (lbl && istTouch) lbl.textContent = 'Wischempfindlichkeit';
  const zeige = () => { wMaus.textContent = EINST.maus + '%'; wTon.textContent = EINST.ton + '%'; };
  zeige();
  maus.addEventListener('input', () => { EINST.maus = +maus.value; zeige(); einstSpeichern(); });
  ton.addEventListener('input', () => { EINST.ton = +ton.value; zeige(); wendeTonAn(); einstSpeichern(); });
  graf.addEventListener('change', () => { EINST.grafik = graf.value; wendeGrafikAn(); einstSpeichern(); });
  if (mus) mus.addEventListener('change', () => { EINST.musik = mus.value; wendeTonAn(); einstSpeichern(); });
  if (kar) kar.addEventListener('change', () => { EINST.karte = kar.value; wendeKarteAn(); einstSpeichern(); });
  if (akam) akam.addEventListener('change', () => { EINST.autokam = akam.value; einstSpeichern(); });
  document.getElementById('setZu').addEventListener('click', () => zeigeEinstellungen(false));
  document.getElementById('setReset').addEventListener('click', () => {
    try { localStorage.removeItem('webhero_stand'); localStorage.removeItem('webhero_best'); } catch (e) {}
    try { localStorage.removeItem('webhero_ruf'); } catch (e) {}
    player.score = 0; bestScore = 0; ruf = 100; wendeStufeAn(0, false);
    popupScreen('Fortschritt zurückgesetzt');
    updateHUD();
  });
})();

/* ======================= Dampf aus den Gullis =======================
   Nichts sagt "Großstadt" so schnell wie eine dampfende Kanalöffnung.
   Alle Wolken hängen in einem einzigen Punktobjekt – das kostet einen
   Zeichenaufruf für die ganze Stadt. */
let dampfPunkte = null, dampfDaten = null, dampfTex = null;
const DAMPF_JE = 26;

function baueDampf() {
  dampfTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.5, 'rgba(230,235,240,0.35)');
    gr.addColorStop(1, 'rgba(220,228,236,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const n = DAMPF_STELLEN.length * DAMPF_JE;
  if (!n) return;
  const pos = new Float32Array(n * 3);
  dampfDaten = new Float32Array(n * 3);           // t, tempo, seite
  for (let i = 0; i < n; i++) {
    dampfDaten[i * 3] = Math.random();            // Fortschritt 0..1
    dampfDaten[i * 3 + 1] = rand(0.07, 0.18);     // Steiggeschwindigkeit
    dampfDaten[i * 3 + 2] = rand(0, TAU);         // Drift-Richtung
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  /* Die Groesse stand auf 4,4 - das ist die Breite eines Kleinwagens JE
     Teilchen, und 26 davon je Gully ergaben eine weisse Wolke, die beim
     Schwingen ueber die halbe Strasse lag und wie ein Fehler aussah.
     Gemessen an einer Kanaloeffnung von 60 cm sind 1,3 m das Richtige. */
  dampfPunkte = new THREE.Points(geo, new THREE.PointsMaterial({
    map: dampfTex, size: 1.3, transparent: true, opacity: 0.34,
    depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending }));
  dampfPunkte.frustumCulled = false;
  scene.add(dampfPunkte);
}

function updateDampf(dt) {
  if (!dampfPunkte) {
    if (!dampfDaten && DAMPF_STELLEN.length) baueDampf();
    if (!dampfPunkte) return;
  }
  if (!REGEN.erlaubt) { dampfPunkte.visible = false; return; }   // niedrige Grafikstufe
  dampfPunkte.visible = true;
  const p = dampfPunkte.geometry.attributes.position.array;
  let k = 0;
  for (const s of DAMPF_STELLEN) {
    const nah = Math.abs(s.x - player.pos.x) < 110 && Math.abs(s.z - player.pos.z) < 110;
    for (let i = 0; i < DAMPF_JE; i++, k++) {
      if (!nah) { p[k * 3 + 1] = -999; continue; }
      let t = dampfDaten[k * 3] + dampfDaten[k * 3 + 1] * dt;
      if (t > 1) t -= 1;
      dampfDaten[k * 3] = t;
      const w = dampfDaten[k * 3 + 2];
      /* Die Wolke steigt, wird breiter und driftet mit dem Wind. */
      p[k * 3]     = s.x + Math.cos(w) * t * 2.2 + Math.sin(elapsed * 0.5 + w) * t * 0.8;
      p[k * 3 + 1] = s.y + 0.1 + t * 5.2;
      p[k * 3 + 2] = s.z + Math.sin(w) * t * 2.2;
    }
  }
  dampfPunkte.geometry.attributes.position.needsUpdate = true;
  /* Nachts und bei Regen dampft es stärker. */
  const kalt = (TAG.zeit < 0.28 || TAG.zeit > 0.78) ? 1 : 0.55;
  dampfPunkte.material.opacity = 0.5 * kalt + REGEN.staerke * 0.22;
}

/* ======================= Regenspritzer auf dem Boden =======================
   Regen ohne Aufschlag wirkt wie ein Bildschirmfilter. Die Ringe zeigen,
   dass die Tropfen wirklich irgendwo ankommen. */
const SPRITZER_ANZ = 26;
let spritzer = null;
function baueSpritzer() {
  const geo = new THREE.RingGeometry(0.05, 0.13, 10);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xcfe4f2, transparent: true,
    opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  spritzer = [];
  for (let i = 0; i < SPRITZER_ANZ; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false; m.renderOrder = 6;
    scene.add(m);
    spritzer.push({ mesh: m, t: 1 });
  }
}
function updateSpritzer(dt) {
  /* Nasser Asphalt: dunkler und leicht bläulich, solange es regnet. */
  if (strassenMat) {
    const n = REGEN.staerke;
    strassenMat.color.setRGB(1 - n * 0.45, 1 - n * 0.44, 1 - n * 0.36);
  }
  if (!spritzer) { if (REGEN.staerke > 0.1) baueSpritzer(); return; }
  if (!REGEN.erlaubt) return;
  const stark = REGEN.staerke;
  for (const s of spritzer) {
    if (s.t >= 1) {
      if (stark < 0.15 || Math.random() > stark * dt * 26) { s.mesh.visible = false; continue; }
      /* Neuer Aufschlag in der Nähe des Helden, auf der Höhe des Bodens. */
      const x = player.pos.x + rand(-11, 11), z = player.pos.z + rand(-11, 11);
      const y = groundY(x, z);
      if (player.pos.y - y > 14) { s.mesh.visible = false; continue; }
      s.mesh.position.set(x, y + 0.02, z);
      s.t = 0; s.mesh.visible = true;
    }
    s.t += dt * 3.4;
    const w = clamp(s.t, 0, 1);
    s.mesh.scale.setScalar(0.4 + w * 2.6);
    s.mesh.material.opacity = (1 - w) * 0.45;
    if (s.t >= 1) s.mesh.visible = false;
  }
}

/* ======================= Minikarte =======================
   Die Stadt ist ein Raster – ohne Übersicht verliert man beim Schwingen
   sofort die Orientierung. Der Untergrund (Straßen, Blöcke, Fluss, Parks)
   wird einmal in eine Bildkarte gezeichnet; pro Bild wird nur noch der
   Ausschnitt um den Helden herausgeschnitten und die Punkte darübergelegt.
   Norden ist oben, der Pfeil dreht sich. */
const KARTE_WELT = 420;          // abgedeckter Bereich in Metern (−210 … 210)
const KARTE_PX = 840;            // Auflösung der Bildkarte
const KARTE_SICHT = 150;         // Radius, den die Minikarte zeigt
let karteBasis = null, karteCtx = null, karteEl = null, karteAn = true;

function w2k(v) { return (v + KARTE_WELT / 2) / KARTE_WELT * KARTE_PX; }

function baueKarte() {
  karteBasis = document.createElement('canvas');
  karteBasis.width = karteBasis.height = KARTE_PX;
  const g = karteBasis.getContext('2d');
  const m = KARTE_PX / KARTE_WELT;

  g.fillStyle = '#1c2129'; g.fillRect(0, 0, KARTE_PX, KARTE_PX);   // Asphalt

  /* Häuserblöcke der Stadtseite. */
  g.fillStyle = '#39414d';
  const bs = (PITCH - ROAD_HALF * 2) * m;
  for (let bi = 0; bi < BLOCKS; bi++) {
    for (let bj = 0; bj < BLOCKS; bj++) {
      const cx = ORIGIN + bi * PITCH + PITCH / 2, cz = ORIGIN + bj * PITCH + PITCH / 2;
      g.fillRect(w2k(cx) - bs / 2, w2k(cz) - bs / 2, bs, bs);
    }
  }
  /* Parks grün einfärben. */
  g.fillStyle = '#2f5a34';
  for (const p of parks) g.fillRect(w2k(p.x) - p.s * m / 2, w2k(p.z) - p.s * m / 2, p.s * m, p.s * m);

  /* Fluss und gegenüberliegendes Ufer. */
  g.fillStyle = '#14324d';
  g.fillRect(w2k(RIVER_X0), 0, (SHORE_X0 - RIVER_X0) * m, KARTE_PX);
  g.fillStyle = '#1c2129';
  g.fillRect(w2k(SHORE_X0), 0, KARTE_PX - w2k(SHORE_X0), KARTE_PX);
  g.fillStyle = '#39414d';
  const ss = (SHORE_PITCH - SHORE_ROAD * 2) * m;
  for (let bi = 0; bi < SHORE_NX; bi++) {
    for (let bj = 0; bj < SHORE_NZ; bj++) {
      const cx = SHORE_OX + bi * SHORE_PITCH + SHORE_PITCH / 2;
      const cz = SHORE_OZ + bj * SHORE_PITCH + SHORE_PITCH / 2;
      g.fillRect(w2k(cx) - ss / 2, w2k(cz) - ss / 2, ss, ss);
    }
  }
  /* Brücke. */
  g.fillStyle = '#4a5361';
  g.fillRect(w2k(RIVER_X0), w2k(BRIDGE_Z - BRIDGE_HW),
             (SHORE_X0 - RIVER_X0) * m, BRIDGE_HW * 2 * m);
}

function zeichnePunkt(g, cx, cy, wx, wz, mp, farbe, r) {
  const px = cx + (wx - player.pos.x) * mp;
  const py = cy + (wz - player.pos.z) * mp;
  if (Math.hypot(px - cx, py - cy) > cx - 3) return;
  g.fillStyle = farbe;
  g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
}

function updateKarte() {
  if (!karteEl) return;
  if (!karteAn) return;
  if (!karteBasis) baueKarte();
  const g = karteCtx;
  const W = karteEl.width, cx = W / 2, cy = W / 2;
  g.clearRect(0, 0, W, W);
  g.save();
  g.beginPath(); g.arc(cx, cy, cx, 0, TAU); g.clip();

  /* Ausschnitt der Bildkarte um den Helden. */
  const m = KARTE_PX / KARTE_WELT;
  const halb = KARTE_SICHT * m;
  g.imageSmoothingEnabled = true;
  g.drawImage(karteBasis, w2k(player.pos.x) - halb, w2k(player.pos.z) - halb,
              halb * 2, halb * 2, 0, 0, W, W);

  /* Maßstab Bildschirm-Pixel je Meter. */
  const mp = W / (KARTE_SICHT * 2);

  /* Gegner rot, Verletzte weiß-rot, Auftragsziel gelb. */
  for (const e of enemies) {
    if (e.dead) continue;
    zeichnePunkt(g, cx, cy, e.pos.x, e.pos.z, mp, '#ff4b3e', 3);
  }
  for (const c of civilians) {
    if (c.state === 'hurt' && c.hilfeBar) zeichnePunkt(g, cx, cy, c.pos.x, c.pos.z, mp, '#ffffff', 3);
  }
  const mz = MISSION.art ? missionZiel() : null;
  if (mz) {
    const px = cx + (mz.x - player.pos.x) * mp, py = cy + (mz.z - player.pos.z) * mp;
    const l = Math.hypot(px - cx, py - cy);
    const k = l > cx - 8 ? (cx - 8) / l : 1;         // am Rand festhalten
    const ax = cx + (px - cx) * k, ay = cy + (py - cy) * k;
    g.strokeStyle = '#ffd23c'; g.lineWidth = 3;
    g.beginPath(); g.arc(ax, ay, 6 + Math.sin(elapsed * 5) * 1.5, 0, TAU); g.stroke();
  }

  /* Der Held: Pfeil in Blickrichtung. Auf der Karte ist +z nach unten. */
  g.translate(cx, cy);
  g.rotate(Math.PI - player.facing);
  g.fillStyle = '#4fd2ff';
  g.beginPath();
  g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(0, 3.5); g.lineTo(-6, 7);
  g.closePath(); g.fill();
  g.restore();
}

/* ======================= HUD & Popups ======================= */
const hpbarEl = document.getElementById('hpbar');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const comboNEl = document.getElementById('comboN');
const objectiveEl = document.getElementById('objective');
const rufEl = document.getElementById('ruf');
const symbEl = document.getElementById('symb');
karteEl = document.getElementById('minimapC');
if (karteEl) karteCtx = karteEl.getContext('2d');
const vignetteEl = document.getElementById('vignette');

let bestScore = 0;
try { bestScore = parseInt(localStorage.getItem('webhero_best') || '0', 10) || 0; } catch (e) {}
/* Fortschritt aus der letzten Sitzung übernehmen. */
try {
  const st = JSON.parse(localStorage.getItem('webhero_stand') || 'null');
  if (st && typeof st.punkte === 'number') {
    player.score = st.punkte;
    wendeStufeAn(stufeFuer(player.score), false);
    player.hp = CFG.playerHP;
  }
} catch (e) {}
try {
  const r = parseFloat(localStorage.getItem('webhero_ruf'));
  if (isFinite(r)) ruf = clamp(r, 0, 100);
} catch (e) {}

function updateHUD() {
  hpbarEl.style.width = `${clamp(player.hp / CFG.playerHP * 100, 0, 100)}%`;
  const s = STUFEN[stufe];
  const naechste = STUFEN[stufe + 1];
  scoreEl.textContent = `Punkte: ${player.score}`;
  bestEl.innerHTML = `Stufe ${stufe + 1} · ${s.text}` +
    (naechste ? ` <small style="opacity:.7">(${naechste.punkte - player.score} bis Stufe ${stufe + 2})</small>` : '') +
    (bestScore > 0 ? `<br>Rekord: ${bestScore}` : '');
  const rr = Math.round(ruf);
  const rufFarbe = rr >= 70 ? '#8ef0a0' : (rr >= 40 ? '#ffd23c' : '#ff7b7b');
  rufEl.innerHTML = `Ruf der Stadt <b style="color:${rufFarbe}">${rr}%</b>` +
    `<span class="rufbalken"><i style="width:${rr}%;background:${rufFarbe}"></i></span>`;
  if (player.combo >= 2) {
    comboEl.style.opacity = 1;
    comboNEl.textContent = `${player.combo}×`;
  } else if (player.stufe > 0 && player.comboTimer > 0) {
    /* Auch die laufende Schlagfolge anzeigen, wenn noch kein Treffer
       gezählt wurde – sonst merkt man von der Kombo überhaupt nichts. */
    comboEl.style.opacity = 0.75;
    comboNEl.textContent = `${player.stufe}/${KOMBO.length}`;
  } else comboEl.style.opacity = 0;

  /* Symbiontenbalken. Er taucht erst auf, wenn ueberhaupt etwas drin ist -
     vor dem ersten Kampf waere er nur ein leeres Feld. */
  if (symbEl) {
    const e = clamp(player.symEnergie, 0, 1);
    if (e < 0.01 && !player.symAn) symbEl.style.opacity = 0;
    else {
      symbEl.style.opacity = 1;
      const voll = e >= 0.999 && !player.symAn;
      symbEl.className = voll ? 'bereit' : '';
      const farbe = player.symAn ? '#c9ccd8' : (voll ? '#e8e8f2' : '#8b7bd8');
      symbEl.innerHTML = (player.symAn
          ? `<b style="color:${farbe}">Symbiont ${Math.ceil(player.symZeit)} s</b>`
          : `Symbiont <b style="color:${farbe}">${Math.round(e * 100)}%</b>` +
            (voll ? ' <small style="opacity:.8">(T)</small>' : '')) +
        `<span class="sbalken"><i style="width:${e * 100}%;background:${farbe}"></i></span>`;
    }
  }
}
updateHUD();

function vignette(strength) {
  vignetteEl.style.boxShadow = `inset 0 0 140px rgba(227,33,45,${strength})`;
  setTimeout(() => { vignetteEl.style.boxShadow = 'inset 0 0 140px rgba(227,33,45,0)'; }, 220);
}

function popupWorld(text, worldPos, color) {
  const v = _v1.set(worldPos.x, worldPos.y + 2.2, worldPos.z).project(camera);
  if (v.z > 1) return;
  const x = (v.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  spawnPopup(text, x, y, color);
}
function popupScreen(text) {
  spawnPopup(text, window.innerWidth / 2, window.innerHeight * 0.32, '#fff');
}
function spawnPopup(text, x, y, color) {
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.color = color || '#ffd23c';
  hud.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = 0; el.style.marginTop = '-46px'; });
  setTimeout(() => el.remove(), 950);
}

function showObjective(text) {
  objectiveEl.textContent = text;
  objectiveEl.style.display = 'block';
}
function hideObjective() {
  objectiveEl.style.display = 'none';
  beacon.visible = false;
}

/* ======================= Hitstop / Zeit ======================= */
let hitstopT = 0;
function hitstop(sec) {
  hitstopT = Math.max(hitstopT, sec);
  /* Auf dem Handy ersetzt ein kurzer Rüttler das fehlende Tastengefühl. */
  if (touchAktiv && navigator.vibrate) {
    try { navigator.vibrate(Math.round(clamp(sec, 0.03, 0.12) * 220)); } catch (e) {}
  }
}

/* ======================= Startaufbau der Figuren ======================= */
let actorsReady = false;
function initActors() {
  heroVisual = makeCharacterVisual('hero', { hero: true });
  for (let i = 0; i < CFG.civCount; i++) spawnCivilian();
  /* Zwei bis vier Wartende je U-Bahn-Station. */
  for (const u of UBAHNEN) {
    for (let seite = 0; seite < 2; seite++)
      /* Mit zehn Stationen waeren zwei bis drei je Bahnsteigseite rund
         fuenfzig Figuren allein unter der Erde - jede mit eigenem Modell
         und eigenen Zeichenaufrufen. Einer bis zwei reichen; leer wirkt
         der Bahnsteig damit nicht. */
      for (let i = 0; i < randi(1, 2); i++) spawnBahnsteigZivi(u.x, seite, u.dz);
  }
  // Startgangs (auf Gehwegen, mit Abstand zum Startpunkt)
  spawnGangAwayFromPlayer();
  spawnGangAwayFromPlayer();
  spawnGangAwayFromPlayer();
  actorsReady = true;
}
wendeGrafikAn();
wendeTonAn();
wendeKarteAn();
loadGlbAssets(initActors);

/* ======================= Hauptschleife ======================= */
const clock = new THREE.Clock();
let elapsed = 0;

let karteCd = 0;
/* ---- Bildrate halten ----
   Die Schattenkarte ist mit Abstand der teuerste Posten: sie zeichnet in
   jedem Bild die halbe Stadt ein zweites Mal. Sie wird deshalb nur noch
   jedes zweite Bild neu berechnet – bewegte Schatten hinken dadurch
   höchstens ein Bild hinterher, was man nicht sieht.
   Zusätzlich regelt sich die Auflösung selbst herunter, wenn es klemmt:
   auf einem hochauflösenden Bildschirm ist das der wirksamste Hebel. */
let schattenBild = 0;
let bildZeit = 16.7, letzteMessung = 0, pixelStufe = 1, regelCd = 90;

function regleQualitaet(msJetzt) {
  if (letzteMessung) {
    const roh = msJetzt - letzteMessung;
    /* Gleitender Mittelwert – einzelne Ausreißer sollen nichts umstellen. */
    if (roh > 0 && roh < 200) bildZeit = bildZeit * 0.9 + roh * 0.1;
  }
  letzteMessung = msJetzt;
  if (--regelCd > 0) return;
  regelCd = 90;
  const max = Math.min(window.devicePixelRatio || 1, 2);
  let neu = pixelStufe;
  if (bildZeit > 23 && pixelStufe > 0.65) neu = Math.max(0.65, pixelStufe - 0.2);
  else if (bildZeit < 13.5 && pixelStufe < 1) neu = Math.min(1, pixelStufe + 0.1);
  if (neu !== pixelStufe) {
    pixelStufe = neu;
    renderer.setPixelRatio(max * pixelStufe);
  }
}

let knopfCd = 0;
/* Nur fuer Tests: haelt die Bildschleife an, damit eine gesetzte Kamera
   stehen bleibt und nicht sofort wieder ueberschrieben wird. */
let gefroren = false;
function animate() {
  requestAnimationFrame(animate);
  if (gefroren) return;
  let dt = Math.min(clock.getDelta(), 0.05);
  if (!isActive() || !actorsReady) { renderer.render(scene, camera); return; }
  simuliere(dt);
  if (sun && sun.shadow && !sun.shadow.autoUpdate) {
    sun.shadow.needsUpdate = (++schattenBild & 1) === 0;
  }
  renderer.render(scene, camera);
  regleQualitaet(performance.now());
  /* Die Minikarte braucht keine 60 Bilder je Sekunde. */
  karteCd -= dt;
  if (karteCd <= 0) { karteCd = 0.05; updateKarte(); }
}

/* Ein Simulationsschritt ohne Bild. So lässt sich das Spiel in Tests mit
   festen kleinen Zeitschritten durchrechnen – im Testbrowser läuft die
   Darstellung sonst mit wenigen Bildern pro Sekunde und jede Messung, die
   von der Zeit abhängt, wird unbrauchbar. */
let zeitlupe = 0;
/* Musikstimmung: sobald Gegner den Helden verfolgen, wird es lauter und
   schneller; nach dem Kampf beruhigt sich alles wieder von allein. */
function updateKlang(dt) {
  let kampf = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    if (d < 26 && (e.target === 'player' || e.state === 'chase' || e.state === 'attack')) {
      kampf = Math.max(kampf, d < 12 ? 1 : 0.6);
    }
  }
  if (MISSION.art && kampf < 0.45) kampf = Math.max(kampf, 0.4);
  MUSIK.setIntensitaet(kampf);
  const tempo = Math.hypot(player.vel.x, player.vel.z, player.vel.y);
  MUSIK.update(dt, player.pos.y, clamp((tempo - 12) / 26, 0, 1), REGEN.staerke > 0.3);
}

function simuliere(dt) {
  updateGamepad();
  if (hitstopT > 0) { hitstopT -= dt; dt *= 0.12; }
  /* Zeitlupe nach einem geglückten Konter – der Moment soll sich groß
     anfühlen und man bekommt Zeit für den Gegenschlag. */
  if (zeitlupe > 0) { zeitlupe -= dt; dt *= 0.34; }
  elapsed += dt;

  updatePlayer(dt);
  updateWetter(dt);
  updateTagNacht(dt);
  updateCars(dt);
  updateHelis(dt);
  updateCivilians(dt);
  updateEnemies(dt);
  updateCamera(dt);
  updateEffekte(dt);
  updateZiehObjekte(dt);
  updateKlatscher(dt);
  updateUnterwelt();
  updateZug(dt);
  updateAufzuege(dt);
  updateKatapult(dt);
  updateAnkerZeichen(dt);
  updateSpinnenSinn(dt);
  updateSymbiont(dt);
  updateAutoFahrer(dt);
  updateZugGaeste(dt);
  updateBusGaeste(dt);
  updateInnenLeute(dt);
  updateKitHaeuser(dt);
  updateFlecken();
  updateKlang(dt);
  updateDampf(dt);
  updateSpritzer(dt);
  /* Die Touch-Knöpfe zeigen an, was gerade geht. Das ändert sich nicht von
     Bild zu Bild – fünfmal je Sekunde reicht und kostet nichts. */
  if (touchAktiv) {
    knopfCd -= dt;
    if (knopfCd <= 0) { knopfCd = 0.2; aktualisiereTouchKnoepfe(); }
  }
  updateVoegel(dt);

  // Wasser-Animation
  if (waterMesh) waterTex.offset.x = elapsed * 0.015;

  // Netzschuss-Blitze ausblenden
  for (let i = activeShots.length - 1; i >= 0; i--) {
    const s = activeShots[i];
    s.life -= dt; s.t += dt;
    /* Erst herausschießen (6 Hundertstel), dann verblassen. */
    const auszug = clamp(s.t / 0.06, 0, 1);
    _v1.copy(s.from).lerp(s.to, auszug);
    placeStrand(s.mesh, s.from, _v1, 0.004);
    s.mesh.material.opacity = clamp(s.life / 0.14, 0, 1);
    if (s.life <= 0) { s.mesh.visible = false; activeShots.splice(i, 1); }
  }
  if (player.state !== 'swing' && player.state !== 'zip') swingStrand.visible = false;

  /* Tempogefühl kommt jetzt allein aus Sichtfeld und Windgeräusch. Die
     Linien über dem ganzen Bild haben mehr verdeckt als sie beigetragen
     haben – gerade beim Schwingen, wo man die Häuser sehen muss. */
  const tempo = player.vel.length();
  if (tempo > 20 && !player.dead) {
    windCd -= dt;
    if (windCd <= 0) { SFX.swoosh(); windCd = rand(0.5, 0.9); }
  }
  updateHUD();
}
let windCd = 0;
animate();

// Nur für automatisierte Tests sichtbar
if (window.__WEBHERO_TEST__ === true) {
  window.__dbg = {
    player, enemies, civilians, cars, glbModels, camera, gangs, szene: scene,
    get actorsReady() { return actorsReady; },
    get heroVisual() { return heroVisual; },
    colliders,
    kau: KAU,
    get ziehFest() { return ZIEH_FEST; },
    get ziehLose() { return ZIEH; },
    // Kamera auf einen Punkt ausrichten (nur für automatisierte Aufnahmen)
    setzeKamYaw(v) { camYaw = v; },
    lookAt(x, z) { camYaw = Math.atan2(-(x - player.pos.x), -(z - player.pos.z)); },
    schritt(dt, n) { for (let i = 0; i < (n || 1); i++) simuliere(dt || 1 / 60); },
    /* Nur die Kamera rechnen – so lässt sich das Mitziehen an einem
       vorgegebenen Flug messen, ohne dass die Spielphysik dazwischenfunkt. */
    kamSchritt(dt) { updateCamera(dt || 1 / 60); },
    get mission() { return MISSION; },
    get stufe() { return stufe; },
    get ruf() { return ruf; },
    addScore, hurtCivilian, ersteHilfe, damageEnemy, damagePlayer, respawn,
    musikStart() { MUSIK.starte(); },
    get istTouch() { return istTouch; },
    get touchAktiv() { return touchAktiv; },
    get swingHeld() { return swingHeld; },
    sprintAn, geheAn, duckenAn, gangTempo,
    setzePos(x, y, z) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
    get camYaw() { return camYaw; },
    get camPitch() { return camPitch; },
    touchKnopf(id, phase) {
      const el = document.getElementById(id);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const t = new Touch({ identifier: 91, target: el,
                            clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
      el.dispatchEvent(new TouchEvent(phase, { bubbles: true, cancelable: true,
        touches: phase === 'touchend' ? [] : [t], changedTouches: [t],
        targetTouches: phase === 'touchend' ? [] : [t] }));
      return true;
    },
    stick,
    DAMPF_STELLEN,
    fluegelSicht() { return +fluegelSicht.toFixed(2); },
    groundYAt: groundY,
    ubahnen() { return UBAHNEN; },
    gangRef() { return GANG_REF; },
    flaeche(a,b,c,d) { return flaecheMitLoechern(a,b,c,d, ubahnLoecher()); },
    ubLoecher() { return ubahnLoecher(); },
    zuege() { return ZUEGE.map(t => ({ x: +t.x.toFixed(1), z: t.z, r: t.richtung,
                                       haelt: t.haelt, sichtbar: t.mesh.visible })); },
    zuegeRoh() { return ZUEGE; },
    katStand() {
      return { aktiv: KAT.aktiv, ladung: KAT.ladung,
        anker: KAT.anker.map((a) => a ? [+a.x.toFixed(1), +a.y.toFixed(1), +a.z.toFixed(1)] : null),
        rx: KAT.rx, rz: KAT.rz, seite: KAT.seite,
        /* Wo faengt der sichtbare Faden an? Erster Eckpunkt der Geometrie
           in Weltkoordinaten - damit laesst sich messen, ob er wirklich an
           der Faust sitzt. */
        strangAnfang: KAT.strang.map((m) => {
          if (!m || !m.visible || !m.geometry.attributes.position) return null;
          m.updateMatrixWorld(true);
          const p = m.geometry.attributes.position;
          const v = new THREE.Vector3(p.getX(0), p.getY(0), p.getZ(0));
          v.applyMatrix4(m.matrixWorld);
          return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
        }),
        straenge: KAT.strang.map((m) => m ? { sicht: m.visible, s: +m.scale.x.toFixed(2),
          r: m.geometry.boundingSphere ? +m.geometry.boundingSphere.radius.toFixed(1) : null } : null) };
    },
    bodenFuss: bodenHoeheFuerFuss,
    sinnStand() { return { staerke: sinnStaerke, konter: sinnKonter }; },
    sinnObj() { return sinnBoegen; },
    ankerObj() { return ankerZeichen; },
    profil(n) {
      const teile = { updatePlayer, updateWetter, updateTagNacht, updateCars, updateHelis,
                      updateCivilians, updateEnemies, updateCamera, updateEffekte,
                      updateKlatscher, updateSpinnenSinn, updateKlang, updateVoegel, updateMission };
      const out = {};
      for (const name in teile) {
        const f = teile[name];
        if (typeof f !== 'function') continue;
        const t0 = performance.now();
        for (let i = 0; i < n; i++) f(1 / 60);
        out[name] = +((performance.now() - t0) / n).toFixed(4);
      }
      return out;
    },
    setzeRegen(v) { REGEN.an = v > 0; REGEN.staerke = v; REGEN.naechsterWechsel = 9999; },
    regenStaerke() { return +REGEN.staerke.toFixed(2); },
    zeichne() { renderer.render(scene, camera); },
    frier(an) { gefroren = !!an; },
    kamNah(d) { kamZwang = d || 0; },
    /* Freie Kameraaufnahme fuer Tests: Position und Blickziel setzen und
       sofort zeichnen, bevor updateCamera wieder uebernimmt. */
    aufnahme(px, py, pz, zx, zy, zz) {
      camera.position.set(px, py, pz);
      camera.up.set(0, 1, 0);
      camera.lookAt(zx, zy, zz);
      camera.updateMatrixWorld(true);
      renderer.render(scene, camera);
    },
    setSchatten(an) { renderer.shadowMap.enabled = an; if (sun) sun.castShadow = an; },
    fluegelObj() { return fluegelL ? { L: fluegelL, R: fluegelR } : null; },
    voegelDa() { return voegel ? voegel.count : 0; },
    dampfDa() { return dampfPunkte; },
    regenAn() { REGEN.an = true; REGEN.staerke = 1; REGEN.naechsterWechsel = 999; },
    tippeSprung() { tryJump(); },
    kitKopien() { return KIT_KOPIEN; },
    kitInnen() { return KIT_INNEN; },
    dekoBei(x, y, z) {
      return DEKO_KOPIE.filter((t) =>
        Math.abs(t.x - x) <= t.w / 2 + 0.05 && Math.abs(t.y - y) <= t.h / 2 + 0.05 &&
        Math.abs(t.z - z) <= t.d / 2 + 0.05)
        .map((t) => [t.w, t.h, t.d, +t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2),
                     '#' + t.farbe.toString(16)]);
    },
    /* Flaechen, die auf derselben Ebene liegen und sich ueberlappen -
       genau die flackern beim Zeichnen (Z-Kampf). Sucht im angegebenen
       Quader nach solchen Paaren. */
    dekoDoppelt(x0, x1, y0, y1, z0, z1, eps) {
      const e = eps === undefined ? 0.004 : eps;
      const drin = DEKO_KOPIE.filter((t) => !t.ry && !t.rz &&
        t.x + t.w / 2 > x0 && t.x - t.w / 2 < x1 &&
        t.y + t.h / 2 > y0 && t.y - t.h / 2 < y1 &&
        t.z + t.d / 2 > z0 && t.z - t.d / 2 < z1);
      const paare = [];
      const spanne = (t, a) => a === 'x' ? [t.x - t.w / 2, t.x + t.w / 2]
                             : a === 'y' ? [t.y - t.h / 2, t.y + t.h / 2]
                             : [t.z - t.d / 2, t.z + t.d / 2];
      const ueber = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
      for (let i = 0; i < drin.length; i++) {
        for (let j = i + 1; j < drin.length; j++) {
          const A = drin[i], B = drin[j];
          for (const achse of ['x', 'y', 'z']) {
            const sa = spanne(A, achse), sb = spanne(B, achse);
            const andere = ['x', 'y', 'z'].filter((k) => k !== achse);
            const u1 = ueber(spanne(A, andere[0]), spanne(B, andere[0]));
            const u2 = ueber(spanne(A, andere[1]), spanne(B, andere[1]));
            if (u1 < 0.15 || u2 < 0.15) continue;
            /* Nur echte Durchdringungen melden. Zwei Kloetze, die sich
               nur BERUEHREN, haben zwar auch eine gemeinsame Ebene - dort
               zeigt aber je eine Flaeche nach aussen und die andere nach
               innen, und die innere wird gar nicht gezeichnet. Flackern
               gibt es erst, wenn sich die Koerper ueberlappen. */
            if (ueber(sa, sb) <= 0.001) continue;
            for (const va of sa) for (const vb of sb) {
              if (Math.abs(va - vb) < e) {
                paare.push({ achse, wert: +va.toFixed(3),
                             flaeche: +(u1 * u2).toFixed(2),
                             a: [A.w, A.h, A.d, +A.x.toFixed(2), +A.y.toFixed(2), +A.z.toFixed(2)],
                             b: [B.w, B.h, B.d, +B.x.toFixed(2), +B.y.toFixed(2), +B.z.toFixed(2)] });
              }
            }
          }
        }
      }
      return paare;
    },
    hausInfo() {
      return { kisten: HAUS_KISTEN.length, modelle: HAUS_MODELLE.length,
               fassaden: HAUS_FASSADEN.length,
               fassadeSichtbar: HAUS_FASSADEN.some((m) => m.visible),
               fehler: window.__hausFehler || null };
    },
    aufzuege() {
      return AUFZUEGE.map((z) => ({ x: +z.x.toFixed(1), z: +z.z.toFixed(1),
        y: +z.y.toFixed(2), unten: z.unten, oben: z.oben, ziel: z.ziel }));
    },
    /* Alle Deko-Kloetze in einem Quader - zum Aufspueren von Geometrie,
       die dort steht, wo sie nicht hingehoert. */
    dekoIm(x0, x1, y0, y1, z0, z1, minLang) {
      const L = minLang === undefined ? 0 : minLang;
      return DEKO_KOPIE.filter((t) =>
        t.x + t.w / 2 > x0 && t.x - t.w / 2 < x1 &&
        t.y + t.h / 2 > y0 && t.y - t.h / 2 < y1 &&
        t.z + t.d / 2 > z0 && t.z - t.d / 2 < z1 &&
        Math.max(t.w, t.d) >= L)
        .map((t) => [t.w, t.h, t.d, +t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1),
                     '#' + t.farbe.toString(16)]);
    },
    /* Welcher Bewegungsname landet auf welcher Datei? Findet Doppelungen:
       zwei Namen auf derselben Datei, eine Datei die auf mehrere Namen
       passt, und Namen ohne jede Datei. */
    clipKarte() {
      const m = glbModels.hero;
      if (!m || !m.clips) return null;
      const namen = m.clips.map((c) => c.name);
      const karte = {};
      /* Alle Namen, die das Spiel ueberhaupt aufloesen kann. */
      for (const key of Object.keys(GLB_CLIP_PATTERNS)) {
        const c = findClip(m.clips, key);
        karte[key] = c ? c.name : null;
      }
      /* Welche Datei passt auf MEHRERE Namen? */
      const proClip = {};
      for (const [key, cl] of Object.entries(karte)) {
        if (!cl) continue;
        (proClip[cl] = proClip[cl] || []).push(key);
      }
      /* Welcher Name steht in einer der Ladelisten, hat aber gar kein
         Muster - der kann nie gefunden werden. */
      const geladen = [].concat(GLB_ANIM_PARTS,
        typeof HELD_ANIM_PARTS !== 'undefined' ? HELD_ANIM_PARTS : [],
        typeof ZIVI_ANIM_PARTS !== 'undefined' ? ZIVI_ANIM_PARTS : []);
      const ohneMuster = geladen.filter((k) => !GLB_CLIP_PATTERNS[k]);
      return { anzahlClips: namen.length, karte, proClip, ohneMuster,
               ohneDatei: Object.keys(karte).filter((k) => !karte[k]),
               nieBenutzt: namen.filter((n) => !proClip[n]) };
    },
    ubStand() {
      return UB_SCHAECHTE.map((sch) => ({
        steig: sch.steig, z0: sch.z0, z1: sch.z1,
        dg: ubDurchgang(-50, sch), be: ubBEbene(-50, sch) }));
    },
    zugGaeste() { return ZUG_GAST; },
    busGaeste() { return BUS_GAST; },
    innenLeute() { return INNEN_LEUTE; },
    innenPlaetze() { return INNEN_PLAETZE; },
    autoFahrer() { return AUTO_FAHRER; },
    imKitHaus,
    renderInfo() { return { calls: renderer.info.render.calls,
      dreiecke: renderer.info.render.triangles,
      programme: renderer.info.programs ? renderer.info.programs.length : -1,
      texturen: renderer.info.memory.textures, geometrien: renderer.info.memory.geometries }; },
    musikStatus() { return MUSIK.status(); },
    klang: SFX,
    /* Nur fuer Messungen: Stelle im Duck-Clip, an der im Stand angehalten wird. */
    duckStandT(v) { if (v !== undefined) DUCK_STAND_T = v; return DUCK_STAND_T; },
    /* Nur fuer Messungen: natuerliches Tempo einer Gangart setzen. */
    setzeGangRef(name, v) { GANG_REF[name] = v; },
    setzeTempo(name, v) { CFG[name] = v; },
    /* Nur fuer Messungen: Punkte gutschreiben, damit sich Stufen pruefen
       lassen, ohne erst eine halbe Stadt zu befreien. */
    gibPunkte(n) { addScore(n || 1000, '', player.pos); return stufe; },
    get kamPos() { return camera.position.clone(); },
    starteMission,
  };
}

})();
