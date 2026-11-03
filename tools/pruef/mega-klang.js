/* Mega-Update 1.0, M6: Klang der Stadt - Pruefstand.
   =========================================================================
   Der Ton wird im Gleichschritt mit der Simulation gerechnet
   (tools/pruef/klang-takt.js): dieselben Knoten wie im Browser, aber
   genau so weit gerechnet, wie das Spiel gekommen ist. Am Ende wird der
   gerechnete Ton je Abschnitt vermessen (Pegel in dBFS, grob in Baendern,
   links/rechts). Gemessen wird also, was wirklich aus dem Lautsprecher
   kaeme - nicht nur, ob eine Funktion aufgerufen wurde.

   Echte Eingaben: der Klick auf "Spielen" (page.click, ein echter
   Nutzerklick), M ueber die Tastatur (page.keyboard), Laufen ueber
   d.taste, Schlagen ueber tryAttack, C ueber d.mega.interagieren (wie in
   den anderen Pruefstaenden). Abgekuerzt wird nur der Weg zwischen den
   Messorten (Versetzen).

   Teile (alle laufen nacheinander in einem Tonlauf):
     freigabe   vor dem Klick kein Klangkontext, kein Knoten, kein Ton;
                nach dem Klick laeuft er, mit genau den Dauerquellen
     schichten  Strasse (Tag) / Dach / Nacht / Regen / Park bei Nacht:
                Pegel der Schichten und des gerechneten Tons
     einsatz    ein Ueberfall in der Naehe: Einsatzwert, Schlaege und
                Hilferufe mit Entfernung und Richtung; nach dem Ende
                blendet alles aus, keine Quelle bleibt haengen
     innen      Kai 7 durch die Tuer betreten: Aussenzweig zu, Raumklang
                an; ein Messton "von draussen" ist drinnen deutlich
                leiser als draussen
     stumm      M schaltet alles ab (kein neuer Knoten, Ton still), M
                wieder an
     dauer      fuenf Minuten gemischtes Spiel: laufende Quellen ohne
                Anstieg, nichts uebersteuert, nach der Ruhe nur noch die
                Dauerquellen

   Aufruf:  node tools/pruef/mega-klang.js [keim=4711] [aus=datei.json] [wav=datei.wav] [dauer=300]
   Exit 1, wenn eine Pruefung fehlschlaegt.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const { klangTaktCode, wavSpeichern } = require('./klang-takt');

const arg = (k, std) => {
  const a = process.argv.find((x) => x.startsWith(k + '='));
  return a ? a.slice(k.length + 1) : std;
};
const KEIM = Number(arg('keim', 4711));
const AUS = arg('aus', null);
const WAV = arg('wav', null);
const DAUER = Number(arg('dauer', 300));
const RATE = 22050;
/* "Offen" heisst: der Tiefpass steht auf 20 kHz - bei dieser Abtastrate
   liest WebAudio das als Nyquist-Grenze (11025 Hz) zurueck. */
const OFFEN = RATE / 2 - 1;

const pruef = [];
const ok = (name, bed, wert) => {
  pruef.push({ name, ok: !!bed, wert });
  console.log('PRUEF ' + (bed ? 'ok    ' : 'FEHLER') + '  ' + name + (wert === undefined ? '' : '  ' + JSON.stringify(wert)));
};

/* ---- Helfer im Browser ---- */
function klangBot() {
  const d = __dbg, P = d.player, K = window.__kt;
  const B = window.__kb = { ton: 0, abschnitte: {} };
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
  B.tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
  B.blick = (x, z, neig) => {
    const dx = x - P.pos.x, dz = z - P.pos.z;
    d.kamStart(Math.atan2(-dx, -dz), neig === undefined ? 0.2 : neig);
  };
  B.setze = (x, z, y) => {
    const gy = y === undefined ? d.groundYAt(x, z, 2) : y;
    P.pos.set(x, gy, z); P.vel.set(0, 0, 0);
    P.state = 'ground'; P.onGround = true;
    B.tasten([]);
  };
  /* sek Sekunden spielen; der Ton rechnet alle zwei Bilder mit. */
  B.lauf = async (sek, eingabe) => {
    const n = Math.round(sek * 60);
    for (let i = 0; i < n; i++) {
      if (eingabe) eingabe(i);
      if (P.hp < 60) P.hp = 100;
      if (P.dead) { P.dead = false; P.hp = 100; }
      d.schritt(1 / 60);
      B.ton += 1 / 60;
      if (i % 2 === 1) await K.bis(B.ton);
    }
    await K.bis(B.ton);
  };
  /* Ein Messabschnitt: erst einschwingen, dann messen. */
  B.abschnitt = async (name, sek, vorlauf, eingabe) => {
    await B.lauf(vorlauf === undefined ? 3 : vorlauf, eingabe);
    const t0 = B.ton, proben = [];
    const n = Math.max(1, Math.round(sek * 4));
    for (let i = 0; i < n; i++) { await B.lauf(0.25, eingabe); proben.push(d.klangStand()); }
    const mittel = (f) => proben.reduce((a, p) => a + f(p), 0) / proben.length;
    const pg = (k) => +mittel((p) => (p.musik.pegel ? p.musik.pegel[k] : 0)).toFixed(3);
    const letzte = proben[proben.length - 1];
    const r = { name, t0: +t0.toFixed(3), t1: +B.ton.toFixed(3),
      pegel: { verkehr: pg('verkehr'), verkehrFilter: Math.round(pg('verkehrFilter')), wind: pg('wind'), hoehenwind: pg('hoehenwind'),
               ferne: pg('ferne'), regen: pg('regen'), raum: pg('raum'), tunnel: pg('tunnel'),
               aussenFilter: Math.round(pg('aussenFilter')), aussen: pg('aussen') },
      lage: letzte.musik.lage, zaehler: letzte.musik.zaehler, statistik: letzte.statistik,
      intensitaet: +mittel((p) => p.musik.intensitaet).toFixed(2), sfx: letzte.sfx,
      laufendMax: Math.max(...proben.map((p) => p.sfx.laufend)),
      pos: { x: +P.pos.x.toFixed(1), y: +P.pos.y.toFixed(1), z: +P.pos.z.toFixed(1) } };
    B.abschnitte[name] = r;
    return r;
  };
  /* Ein Dach in der Naehe: ebene Hausoberkante zwischen 18 und 50 m. */
  B.dach = (x0, z0) => {
    for (let r = 10; r < 160; r += 5) {
      for (let a = 0; a < 24; a++) {
        const x = x0 + Math.cos(a / 24 * Math.PI * 2) * r, z = z0 + Math.sin(a / 24 * Math.PI * 2) * r;
        const o = d.mega.ort(x, z);
        if (!o.haus || o.oben < 18 || o.oben > 50) continue;
        let eben = true;
        for (const [ox, oz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
          const n = d.mega.ort(x + ox, z + oz);
          if (!n.haus || Math.abs(n.oben - o.oben) > 0.05) { eben = false; break; }
        }
        if (eben) return { x, y: o.oben, z };
      }
    }
    return null;
  };
  /* Freier Strassenpunkt neben (x, z): kein Haus, kein Wasser, Strassenhoehe. */
  B.strasseNeben = (x0, z0) => {
    for (let r = 4; r < 80; r += 2) {
      for (let a = 0; a < 24; a++) {
        const x = x0 + Math.cos(a / 24 * Math.PI * 2) * r, z = z0 + Math.sin(a / 24 * Math.PI * 2) * r;
        const o = d.mega.ort(x, z);
        if (!o.haus && !o.wasser && o.y > -0.5 && o.y < 1.5 && o.oben < o.y + 0.5) return { x, z };
      }
    }
    return null;
  };
  /* Musik ueber die Einstellung umschalten (derselbe Weg wie das Menue). */
  B.musik = (wert) => {
    const s = document.getElementById('setMusik');
    s.value = wert; s.dispatchEvent(new Event('change'));
  };
  B.park = () => {
    const t = d.stadtteile().filter((s) => s.art === 'PARK');
    for (const s of t) {
      const o = d.mega.ort(s.x, s.z);
      if (!o.haus && !o.wasser && o.y > -0.5 && o.y < 1.5) return s;
    }
    return null;
  };
}

(async () => {
  const { b, page } = await starte(800, 480, KEIM, { frierSofort: true });
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e)));
  await page.addInitScript(klangTaktCode({ rate: RATE, kanaele: 2, sekunden: DAUER + 200 }));
  await page.reload();
  await page.waitForFunction(() => window.__dbg && window.__dbg.actorsReady, null, { timeout: 240000 });
  await page.evaluate(() => __dbg.frier(true));
  await page.evaluate(klangBot);
  const E = (fn, a) => page.evaluate(fn, a);
  const ergebnis = { keim: KEIM };

  /* ================= freigabe ================= */
  const vor = await E(() => {
    const d = __dbg, P = d.player, B = window.__kb;
    B.setze(25, 25);
    d.evRuheAus();
    for (let i = 0; i < 900; i++) {           // 15 s spielen, ohne geklickt zu haben
      B.tasten(i % 240 < 160 ? ['KeyW'] : []);
      if (i % 30 === 0) d.tryAttack('punch');
      if (i % 90 === 45) d.tryJump();
      if (i === 300) d.evStarte('ueberfall');
      if (P.hp < 60) P.hp = 100;
      d.schritt(1 / 60);
    }
    B.tasten([]);
    const K = window.__kt;
    return { erstellt: K.erstellt, erzeugt: Object.keys(K.erzeugt).length, sfx: d.klangStand().sfx, musik: d.klangStand().musik.an };
  });
  ok('freigabe: vor dem Klick kein Klangkontext und kein einziger Knoten (15 s Spiel mit Schlaegen und Ereignis)',
     vor.erstellt === 0 && vor.erzeugt === 0 && vor.sfx.freigegeben === false && vor.sfx.gespielt === 0 && !vor.musik, vor);
  await E(() => { const o = document.getElementById('overlay'); o.style.display = 'flex'; });
  await page.click('#clickmsg');
  await E(() => { __dbg.frier(true); document.getElementById('overlay').style.display = 'none'; });
  await E(() => window.__kb.lauf(1.0));
  const nach = await E(() => {
    const K = window.__kt, k = __dbg.klangStand();
    return { erstellt: K.erstellt, aktivierung: K.aktivierung, musik: k.musik.an, freigegeben: k.sfx.freigegeben,
             gestartet: K.gestartet, laufend: K.gestartet - K.beendet, erzeugt: K.erzeugt };
  });
  ok('freigabe: der Klick legt genau einen Kontext an, nach echter Nutzeraktivierung, Musik und Stadtklang laufen',
     nach.erstellt >= 1 && nach.aktivierung === true && nach.musik && nach.freigegeben, nach);
  ergebnis.freigabe = { vor, nach };

  /* ================= schichten ================= */
  const S = await E(async () => {
    const d = __dbg, B = window.__kb, raus = {};
    d.evAlleBeenden(); d.mega.blockiere(true);
    /* Gemessen wird der Stadtklang - die Musik wuerde ihn ueberdecken. */
    B.musik('stadt');
    window.__setzeZeit(0.5); d.setzeRegen(0);
    /* Dach und Strasse direkt daneben: dieselbe Umgebung, einmal oben,
       einmal unten. */
    const dach = B.dach(25, 25);
    raus.dachOrt = dach;
    const str = dach ? B.strasseNeben(dach.x, dach.z) : { x: 25, z: 25 };
    raus.strasseOrt = str;
    B.setze(str.x, str.z); B.blick(str.x + 50, str.z, 0.1);
    raus.strasse = await B.abschnitt('strasse', 5, 4);
    if (dach) { B.setze(dach.x, dach.z, dach.y); raus.dach = await B.abschnitt('dach', 5, 4); }
    B.setze(str.x, str.z); window.__setzeZeit(0.0);
    raus.nacht = await B.abschnitt('nacht', 5, 4);
    window.__setzeZeit(0.5); d.setzeRegen(1);
    raus.regen = await B.abschnitt('regen', 5, 4);
    d.setzeRegen(0);
    const park = B.park();
    raus.parkOrt = park;
    if (park) {
      B.setze(park.x, park.z);
      window.__setzeZeit(0.5);
      raus.parkTag = await B.abschnitt('parkTag', 8, 3);
      d.setzeRegen(1);
      raus.parkRegen = await B.abschnitt('parkRegen', 5, 4);
      d.setzeRegen(0);
      window.__setzeZeit(0.0);
      raus.parkNacht = await B.abschnitt('parkNacht', 8, 3);
      window.__setzeZeit(0.5);
    }
    return raus;
  });
  ergebnis.schichten = S;
  console.log('SCHICHTEN', JSON.stringify({ strasse: S.strasse.pegel, dach: S.dach && S.dach.pegel, nacht: S.nacht.pegel,
                                            regen: S.regen.pegel, dachOrt: S.dachOrt }));
  ok('schichten: Dach gefunden', !!S.dach, S.dachOrt);
  if (S.dach) {
    ok('schichten: Dach hat deutlich mehr Wind als die Strasse (Wind mindestens das Dreifache, Hoehenwind an)',
       S.dach.pegel.wind >= 3 * Math.max(0.01, S.strasse.pegel.wind) && S.dach.pegel.hoehenwind > 0.04 && S.strasse.pegel.hoehenwind < 0.005,
       { strasse: [S.strasse.pegel.wind, S.strasse.pegel.hoehenwind], dach: [S.dach.pegel.wind, S.dach.pegel.hoehenwind] });
    ok('schichten: Dach hat weniger Strassenverkehr (hoechstens 75 %, dunkler gefiltert)',
       S.dach.pegel.verkehr <= 0.75 * S.strasse.pegel.verkehr && S.dach.pegel.verkehrFilter < S.strasse.pegel.verkehrFilter,
       { strasse: [S.strasse.pegel.verkehr, S.strasse.pegel.verkehrFilter], dach: [S.dach.pegel.verkehr, S.dach.pegel.verkehrFilter] });
  }
  ok('schichten: nachts ist der Verkehr leiser als am Tag (gleicher Ort, hoechstens 80 %)',
     S.nacht.pegel.verkehr <= 0.8 * S.strasse.pegel.verkehr, { tag: S.strasse.pegel.verkehr, nacht: S.nacht.pegel.verkehr });
  ok('schichten: Regen ist zu hoeren (Regenschicht an), ohne Regen still',
     S.regen.pegel.regen > 0.2 && S.strasse.pegel.regen < 0.01, { ohne: S.strasse.pegel.regen, mit: S.regen.pegel.regen });
  ok('schichten: Strasse, Dach, Nacht und Regen haben den Raumklang aus und den Aussenzweig offen',
     [S.strasse, S.dach, S.nacht, S.regen].filter(Boolean).every((a) => a.pegel.raum < 0.01 && a.pegel.aussenFilter >= OFFEN),
     [S.strasse, S.dach, S.nacht, S.regen].filter(Boolean).map((a) => [a.name, a.pegel.raum, a.pegel.aussenFilter]));
  if (S.parkNacht) {
    const gTag = S.parkTag.zaehler.grillen, gNacht = S.parkNacht.zaehler.grillen - S.parkTag.zaehler.grillen;
    ok('schichten: Grillen nur nachts im Park', gNacht >= 2 && gTag === 0, { tag: gTag, nacht: gNacht, park: S.parkOrt });
  }

  /* ================= einsatz ================= */
  const EIN = await E(async () => {
    const d = __dbg, P = d.player, B = window.__kb, raus = {};
    d.mega.blockiere(false);
    d.evAlleBeenden();
    B.setze(25, 25);
    const vorher = d.klangStand();
    raus.vorher = { treffer: vorher.statistik.treffer, rufe: vorher.statistik.rufe, laufend: vorher.sfx.laufend };
    const e = d.evStarte('ueberfall');
    raus.gestartet = !!e;
    let ev = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
    raus.ort = ev ? ev.ort : null;
    if (!ev) return raus;
    /* hinlaufen bis 30 m, dabei messen, ab wann man es hoert */
    raus.weg = [];
    for (let s = 0; s < 40; s++) {
      ev = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
      if (!ev) break;
      const dist = Math.hypot(ev.ort.x - P.pos.x, ev.ort.z - P.pos.z);
      const k = d.klangStand();
      raus.weg.push([+dist.toFixed(0), k.statistik.treffer, k.umgebung.einsatz, ev.entdeckt]);
      if (dist < 30) break;
      await B.lauf(0.5);
      /* gerade Linie hin: versetzen in 10-m-Schritten, die Messung soll die
         Entfernung abbilden, nicht den Weg durch die Haeuser */
      const r = Math.max(0, dist - 10) / dist;
      B.setze(ev.ort.x + (P.pos.x - ev.ort.x) * r, ev.ort.z + (P.pos.z - ev.ort.z) * r);
    }
    raus.nah = await B.abschnitt('einsatz', 4, 1, () => {
      const v = d.mega.ereignisse().find((x) => x.art === 'ueberfall');
      if (v) B.blick(v.ort.x, v.ort.z, 0.15);
    });
    /* Ende: alle Ereignisse werden beendet (wie nach der Aufloesung) */
    d.evAlleBeenden(); d.mega.blockiere(true);
    raus.direktNach = d.klangStand().musik.lage.einsatz;
    raus.aus = await B.abschnitt('nachEinsatz', 3, 6);
    raus.ausZiel = d.klangStand().umgebung.einsatz;
    /* Streifenwagen, die noch mit Sirene unterwegs sind, halten den Wert
       (das ist gewollt: Sirene in der Naehe). Warten, bis keiner mehr
       faehrt - hoechstens 120 s -, dann muss alles ausgeklungen sein. */
    let t = 0;
    while (t < 120) {
      const k = d.klangStand();
      if (k.umgebung.einsatz < 0.001 && k.musik.lage.einsatz < 0.05) break;
      await B.lauf(1); t++;
    }
    raus.wartenSirenen = t;
    raus.ganzAus = d.klangStand().musik.lage.einsatz;
    raus.resp = d.mega.resp().liste;
    return raus;
  });
  ergebnis.einsatz = EIN;
  console.log('EINSATZ', JSON.stringify({ ort: EIN.ort, weg: EIN.weg, nah: EIN.nah && { lage: EIN.nah.lage, stat: EIN.nah.statistik,
    intensitaet: EIN.nah.intensitaet }, aus: EIN.aus && { lage: EIN.aus.lage, laufend: EIN.aus.sfx.laufend } }));
  ok('einsatz: Ueberfall gestartet', EIN.gestartet && !!EIN.ort, EIN.ort);
  if (EIN.nah) {
    ok('einsatz: nahe dem Ueberfall steigt der Einsatzwert und die Musik zieht an',
       EIN.nah.lage.einsatz > 0.3 && EIN.nah.intensitaet >= 0.2, { einsatz: EIN.nah.lage.einsatz, intensitaet: EIN.nah.intensitaet });
    ok('einsatz: nach dem Ende blendet der Einsatzklang aus (kein Schnitt): direkt danach noch an, nach 9 s auf dem Rest der Sirenen',
       EIN.direktNach > 0.5 && EIN.aus.lage.einsatz <= EIN.ausZiel + 0.05,
       { direkt: EIN.direktNach, nach9s: EIN.aus.lage.einsatz, restSirenen: EIN.ausZiel });
    ok('einsatz: ist auch die letzte Sirene weg, ist der Einsatzklang ganz aus (unter 0,05)',
       EIN.ganzAus < 0.05, { wartenS: EIN.wartenSirenen, wert: EIN.ganzAus, resp: EIN.resp });
    ok('einsatz: nach dem Ende keine haengenden Einzelklaenge', EIN.aus.sfx.laufend <= 3, EIN.aus.sfx);
  }

  /* ================= rauferei (Schlag auf einen Passanten: Entfernung, Richtung) =================
     Ausgeloest ueber hurtCivilian - dieselbe Funktion, die ein Ganove beim
     Treffer auf einen Passanten aufruft (dass Ganoven Passanten schlagen,
     ist vorhandenes Verhalten; ein Versuch mit echter KI scheiterte daran,
     dass der Passant wegrennt - das zaehlt der Dauerlauf mit). Ein echter
     Passant steht 54 m rechts, dann 54 m links, dann 125 m weit weg; die
     Kamera schaut nach Norden (-z), rechts ist +x. */
  const RAU = await E(async () => {
    const d = __dbg, P = d.player, B = window.__kb, raus = { faelle: [] };
    d.evAlleBeenden(); d.mega.blockiere(true);
    const x0 = 25, z0 = 25;
    B.setze(x0, z0);
    await B.lauf(0.3, () => d.kamStart(0, 0.15));
    const civ = d.civilians.find((c) => c.state !== 'hurt' && !c.eventId && c.visual && c.visual.root.visible);
    if (!civ) return { fehler: 'kein Passant' };
    for (const [name, dx] of [['rechts', 54], ['links', -54], ['weit', 125]]) {
      civ.pos.set(x0 + dx, d.groundYAt(x0 + dx, z0, 2), z0);
      civ.hp = 100; civ.state = 'walk';
      d.kamStart(0, 0.15);
      await B.lauf(0.1, () => d.kamStart(0, 0.15));
      const vor = d.klangStand();
      const g0 = vor.sfx.gespielt;
      d.hurtCivilian(civ, null);
      await B.lauf(0.6, () => d.kamStart(0, 0.15));
      const k = d.klangStand();
      raus.faelle.push({ name, dx, treffer: k.statistik.treffer - vor.statistik.treffer, letzter: k.statistik.letzter,
                         klaenge: k.sfx.gespielt - g0 });
    }
    civ.hp = 100; civ.state = 'walk';
    return raus;
  });
  ergebnis.rauferei = RAU;
  console.log('RAUFEREI', JSON.stringify(RAU));
  if (RAU.faelle) {
    const [re, li, we] = RAU.faelle;
    const erw = (L) => Math.pow(Math.max(0, 1 - L.d / 110), 2);
    ok('rauferei: Schlag auf einen Passanten in 54 m ist zu hoeren, Lautstaerke (1 - d/110)^2',
       re.treffer === 1 && re.letzter && Math.abs(re.letzter.v - erw(re.letzter)) < 0.002 && re.klaenge > 0,
       { letzter: re.letzter, erwartet: re.letzter ? +erw(re.letzter).toFixed(4) : null, klaenge: re.klaenge });
    ok('rauferei: rechts klingt rechts, links klingt links', re.letzter && re.letzter.pan > 0.3 && li.letzter && li.letzter.pan < -0.3,
       { rechts: re.letzter && re.letzter.pan, links: li.letzter && li.letzter.pan });
    ok('rauferei: in 125 m ist nichts mehr zu hoeren (kein Schlag, kein Ruf erzeugt)', we.treffer === 0, we);
  }

  /* ================= innen ================= */
  const IN = await E(async () => {
    const d = __dbg, P = d.player, B = window.__kb, raus = {};
    d.evAlleBeenden(); d.mega.blockiere(true);
    window.__setzeZeit(0.5);
    const T = d.mega.orteTueren().buero;
    if (!T) return raus;
    B.setze(T.ex + T.nx * 0.6, T.ez + T.nz * 0.6);
    P.facing = Math.atan2(-T.nx, -T.nz);
    raus.draussen = await B.abschnitt('vorTuer', 3, 3);
    /* Messton draussen: eine Sirene ueber den Aussenzweig */
    const K = window.__kt;
    raus.tonDraussen = K.zeit();
    d.klangMesston();
    await B.lauf(1.0);
    await B.lauf(0.2);
    raus.hinweis = d.mega.prompt();
    d.mega.interagieren();
    for (let i = 0; i < 120 && !(d.innen.active && !d.innen.phase); i++) await B.lauf(1 / 60);
    raus.drin = !!d.innen.active && d.innen.id === 'buero';
    raus.innen = await B.abschnitt('innen', 4, 2);
    raus.tonDrinnen = K.zeit();
    d.klangMesston();
    await B.lauf(1.0);
    /* wieder hinaus */
    const a = d.innen.raum && d.innen.raum.ausgang;
    if (a) {
      for (let i = 0; i < 600; i++) {
        const dist = Math.hypot(a.x - P.pos.x, a.z - P.pos.z);
        if (dist < 0.8) break;
        await B.lauf(1 / 60, () => { B.blick(a.x, a.z); B.tasten(['KeyW']); });
      }
      B.tasten([]);
      await B.lauf(0.15);
      d.mega.interagieren();
      for (let i = 0; i < 120 && (d.innen.active || d.innen.phase); i++) await B.lauf(1 / 60);
    }
    raus.wiederDraussen = !d.innen.active;
    raus.danach = await B.abschnitt('nachInnen', 3, 2);
    return raus;
  });
  ergebnis.innen = IN;
  console.log('INNEN', JSON.stringify({ hinweis: IN.hinweis, drin: IN.drin, draussen: IN.draussen && IN.draussen.pegel,
    innen: IN.innen && IN.innen.pegel, sfxInnen: IN.innen && IN.innen.sfx, danach: IN.danach && IN.danach.pegel }));
  ok('innen: der Kai 7 wird durch die Tuer betreten (C)', IN.drin, IN.hinweis);
  if (IN.innen) {
    ok('innen: Aussenzweig zu (Tiefpass unter 1 kHz, leiser), Effekt-Aussenzweig ebenso',
       IN.innen.pegel.aussenFilter < 1000 && IN.innen.pegel.aussen < 0.6 && IN.innen.sfx.aussenFrequenz < 1000 && IN.innen.sfx.innen > 0.9,
       { musik: [IN.innen.pegel.aussenFilter, IN.innen.pegel.aussen], sfx: [IN.innen.sfx.aussenFrequenz, IN.innen.sfx.innen] });
    ok('innen: eigener Raumklang (Lueftung) an, Raumhall statt Tunnelhall',
       IN.innen.pegel.raum > 0.15 && IN.innen.sfx.raum === 'innen', { raum: IN.innen.pegel.raum, hall: IN.innen.sfx.raum });
    ok('innen: nach dem Verlassen ist alles wieder offen',
       IN.wiederDraussen && IN.danach.pegel.aussenFilter >= OFFEN && IN.danach.pegel.raum < 0.02,
       { draussen: IN.wiederDraussen, filter: IN.danach.pegel.aussenFilter, raum: IN.danach.pegel.raum });
  }

  /* ================= stumm (echte Taste M) ================= */
  await E(() => window.__kb.lauf(0.5));
  await page.keyboard.press('KeyM');
  const ST = await E(async () => {
    const d = __dbg, B = window.__kb, K = window.__kt;
    const raus = { stumm: d.klangStand().sfx };
    const g0 = d.klangStand().sfx.gespielt;
    raus.t0 = B.ton;
    await B.lauf(3, (i) => { if (i % 20 === 0) d.tryAttack('punch'); if (i % 70 === 35) d.tryJump(); B.tasten(['KeyW']); });
    B.tasten([]);
    raus.t1 = B.ton;
    raus.neu = d.klangStand().sfx.gespielt - g0;
    raus.bus = d.klangStand().musik.bus;
    return raus;
  });
  await page.keyboard.press('KeyM');
  const ST2 = await E(async () => {
    const d = __dbg, B = window.__kb;
    const g0 = d.klangStand().sfx.gespielt;
    await B.lauf(3, (i) => { if (i % 20 === 0) d.tryAttack('punch'); if (i % 70 === 35) d.tryJump(); B.tasten(['KeyW']); });
    B.tasten([]);
    return { neu: d.klangStand().sfx.gespielt - g0, bus: d.klangStand().musik.bus, t1: B.ton };
  });
  ergebnis.stumm = { ST, ST2 };
  ok('stumm: M (Tastatur) schaltet aus - keine neuen Einzelklaenge, Stadtbus auf 0', ST.neu === 0 && ST.bus === 0,
     { neu: ST.neu, bus: ST.bus });
  ok('stumm: M wieder - Schlaege klingen, Bus wieder offen', ST2.neu > 0 && ST2.bus > 0, ST2);

  /* ================= dauer ================= */
  const DA = await E(async (dauer) => {
    const d = __dbg, P = d.player, B = window.__kb, K = window.__kt;
    B.musik('an');
    d.mega.blockiere(false); d.evRuheAus();
    const ziele = [[25, 25], [-120, 80], [-200, -150], [60, -180], [130, 40], [-60, 150], [-260, 20]];
    let zi = 0;
    const kurve = [];
    const fenster = 30;
    let naechste = B.ton + fenster;
    const ende = B.ton + dauer;
    const t0 = B.ton;
    while (B.ton < ende) {
      await B.lauf(1, (i) => {
        const z = ziele[zi % ziele.length];
        const dx = z[0] - P.pos.x, dz = z[1] - P.pos.z;
        if (Math.hypot(dx, dz) < 8) zi++;
        if (i % 2 === 0) B.blick(z[0], z[1]);
        B.tasten(['KeyW', 'ShiftLeft']);
        if (i % 45 === 0) d.tryAttack('punch');
        if (i % 50 === 25 && P.state === 'climb') d.tryJump();
      });
      if (Math.round(B.ton) % 20 === 0 && P.state !== 'ground') B.setze(P.pos.x, P.pos.z);
      if (B.ton >= naechste) {
        naechste += fenster;
        const k = d.klangStand();
        kurve.push({ t: Math.round(B.ton - t0), laufend: K.gestartet - K.beendet, sfx: k.sfx.laufend,
                     ausgelassen: k.sfx.ausgelassen, gespielt: k.sfx.gespielt, ev: d.mega.ereignisse().length });
        d.evRuheAus();
      }
    }
    B.tasten([]);
    d.mega.blockiere(true); d.evAlleBeenden();
    const tRuhe = B.ton;
    await B.lauf(6);
    return { kurve, tStart: t0, tRuhe, tEnde: B.ton, laufendRuhe: K.gestartet - K.beendet, maxLaufend: K.maxLaufend,
             erzeugt: K.erzeugt, sfx: d.klangStand().sfx, statistik: d.klangStand().statistik };
  }, DAUER);
  ergebnis.dauer = DA;
  console.log('DAUER', JSON.stringify({ kurve: DA.kurve, laufendRuhe: DA.laufendRuhe, max: DA.maxLaufend, sfx: DA.sfx, stat: DA.statistik }));
  const k = DA.kurve;
  const halb = Math.floor(k.length / 2);
  const mittelA = k.slice(0, halb).reduce((a, x) => a + x.laufend, 0) / Math.max(1, halb);
  const mittelB = k.slice(halb).reduce((a, x) => a + x.laufend, 0) / Math.max(1, k.length - halb);
  ok('dauer: laufende Quellen steigen nicht an (zweite Haelfte hoechstens 1,5-fach + 4)',
     mittelB <= mittelA * 1.5 + 4, { ersteHaelfte: +mittelA.toFixed(1), zweiteHaelfte: +mittelB.toFixed(1) });
  ok('dauer: nie mehr als 60 Quellen zugleich (Dauerquellen + Grenze 48)', DA.maxLaufend <= 60, DA.maxLaufend);
  ok('dauer: nach 6 s Ruhe so wenige Quellen wie direkt nach dem Klick (Dauerquellen + Musikstimmen, hoechstens +4)',
     DA.laufendRuhe <= nach.laufend + 4, { nachKlick: nach.laufend, ruhe: DA.laufendRuhe });

  /* ================= Ton vermessen ================= */
  await E(() => window.__kt.ende());
  const M = await E((a) => {
    const K = window.__kt, B = window.__kb, r = {};
    for (const [name, s] of Object.entries(B.abschnitte)) r[name] = K.pegel(s.t0, s.t1);
    r.vorKlickBisStart = null;
    r.stumm = K.pegel(a.ST.t0 + 0.3, a.ST.t1);
    r.messtonDraussen = K.ueber(a.IN.tonDraussen, a.IN.tonDraussen + 0.6, 0.6);
    r.messtonDrinnen = K.ueber(a.IN.tonDrinnen, a.IN.tonDrinnen + 0.6, 0.6);
    r.dauer = K.pegel(a.DA.tStart, a.DA.tRuhe);
    r.spektren = {};
    for (const [name, s] of Object.entries(B.abschnitte)) r.spektren[name] = K.spektrum(s.t0, s.t1);
    r.ganz = K.pegel(0, a.DA.tEnde);
    return r;
  }, { ST, IN, DA });
  ergebnis.messung = M;
  console.log('MESSUNG', JSON.stringify(M));
  ok('messung: Strasse ist hoerbar (gesamt ueber -50 dBFS)', M.strasse && M.strasse.gesamt > -50, M.strasse);
  if (M.dach) {
    ok('messung: auf dem Dach weniger Strasse (Tiefen mindestens 3 dB unter der Strasse darunter)',
       M.dach.tief <= M.strasse.tief - 3, { strasse: M.strasse.tief, dach: M.dach.tief });
    ok('messung: auf dem Dach mehr Wind (Mitte gegenueber Tiefe mindestens 3 dB heller als unten)',
       (M.dach.mitte - M.dach.tief) >= (M.strasse.mitte - M.strasse.tief) + 3,
       { strasse: +(M.strasse.mitte - M.strasse.tief).toFixed(1), dach: +(M.dach.mitte - M.dach.tief).toFixed(1) });
  }
  ok('messung: Regen hebt die Hoehen an (Strasse +6 dB)', M.regen.hoch >= M.strasse.hoch + 6,
     { strasse: M.strasse.hoch, regen: M.regen.hoch });
  if (M.parkRegen) ok('messung: Regen im ruhigen Park: Hoehen mindestens +15 dB', M.parkRegen.hoch >= M.parkTag.hoch + 15,
                      { park: M.parkTag.hoch, parkRegen: M.parkRegen.hoch });
  if (M.innen) ok('messung: drinnen ist die Stadt leiser und dunkler (Mitte mindestens 6 dB unter vor der Tuer)',
                  M.innen.mitte <= M.vorTuer.mitte - 6, { vorTuer: M.vorTuer, innen: M.innen });
  ok('messung: eine Sirene von draussen ist drinnen mindestens 10 dB leiser (Ton ueber dem Hintergrund, Band 250 Hz - 2,5 kHz)',
     M.messtonDrinnen.mitte <= M.messtonDraussen.mitte - 10,
     { draussen: [M.messtonDraussen.mitte, M.messtonDraussen.hoch], drinnen: [M.messtonDrinnen.mitte, M.messtonDrinnen.hoch] });
  ok('messung: stumm ist still (unter -70 dBFS)', M.stumm.gesamt < -70, M.stumm);
  ok('messung: nirgends uebersteuert, Spitze unter -1 dBFS', M.ganz.uebersteuert === 0 && M.ganz.spitze < -1, M.ganz);
  if (WAV) { const n = await wavSpeichern(page, WAV); console.log('WAV ' + WAV + ' ' + n + ' Bytes'); }

  console.log('\nSeitenfehler: ' + seitenFehler.length + (seitenFehler.length ? ' ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  ok('keine Seitenfehler', seitenFehler.length === 0, seitenFehler.slice(0, 3));
  ergebnis.pruef = pruef;
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(ergebnis, null, 1));
  await b.close();
  const fehler = pruef.filter((p) => !p.ok).length;
  console.log('\nERGEBNIS ' + (pruef.length - fehler) + '/' + pruef.length);
  process.exit(fehler ? 1 : 0);
})();
