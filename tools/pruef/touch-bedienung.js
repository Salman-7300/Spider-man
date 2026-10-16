/* Teil 23: die Bedienung auf dem Handy.
   Gemessen wird im Browser mit eingeschalteter Beruehrung, in zwei
   Bildschirmgroessen. Geprueft wird, was man am Geraet nicht sieht,
   solange man mit der Maus spielt: ob jeder Knopf gross genug ist, ob
   sich zwei Knoepfe ueberlappen, ob einer aus dem Bild ragt und ob die
   Minikarte im Weg liegt.

   Aufruf:  node touch-bedienung.js
   ========================================================================= */
const { starte } = require('./basis');

/* Apple nennt 44x44 Punkte als Mindestmass fuer eine Beruehrflaeche,
   Google 48x48. Geprueft wird gegen die kleinere der beiden Zahlen. */
const MINDEST = 44;

const GERAETE = [
  ['Handy klein (360x640)', 360, 640],
  ['Handy gross (414x896)', 414, 896],
  ['Tablet quer (1024x768)', 1024, 768],
];

(async () => {
  let schlecht = 0;
  for (const [name, br, ho] of GERAETE) {
    const { b, page } = await starte(br, ho, 4711, { touch: true });
    /* Die Bildschirmsteuerung entsteht erst beim Start - baueTouch() haengt
       am Klick auf die Startmeldung. Ohne diesen Klick misst man eine
       leere Ebene. */
    await page.evaluate(() => {
      const m = document.getElementById('clickmsg');
      if (m) m.click();
      const zu = document.getElementById('thilfeZu');
      if (zu) zu.click();
    });
    await page.waitForTimeout(600);
    const aus = await page.evaluate(() => {
      const d = __dbg;
      const lage = document.getElementById('touch');
      const sicht = lage ? getComputedStyle(lage).display !== 'none' : false;
      const knoepfe = [];
      for (const el of document.querySelectorAll('#touch button')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;      // ausgeblendet
        knoepfe.push({ id: el.id || el.textContent.trim().slice(0, 12),
          x: +r.x.toFixed(1), y: +r.y.toFixed(1),
          w: +r.width.toFixed(1), h: +r.height.toFixed(1),
          weg: getComputedStyle(el).display === 'none' });
      }
      const stick = document.getElementById('tstick');
      const sr = stick ? stick.getBoundingClientRect() : null;
      const karte = document.getElementById('minimap');
      const kr = karte && getComputedStyle(karte).display !== 'none'
                 ? karte.getBoundingClientRect() : null;
      return { istTouch: d.istTouch, sicht, knoepfe,
               stick: sr ? { x: +sr.x.toFixed(1), y: +sr.y.toFixed(1),
                             w: +sr.width.toFixed(1), h: +sr.height.toFixed(1) } : null,
               karte: kr ? { x: +kr.x.toFixed(1), y: +kr.y.toFixed(1),
                             w: +kr.width.toFixed(1), h: +kr.height.toFixed(1) } : null,
               breite: window.innerWidth, hoehe: window.innerHeight };
    });

    console.log('\n=== ' + name + '   Beruehrung erkannt: ' + aus.istTouch +
                ' | Bedienung sichtbar: ' + aus.sicht +
                ' | Knoepfe: ' + aus.knoepfe.length);
    const melde = (t) => { console.log('   FEHL ' + t); schlecht++; };

    if (!aus.istTouch) melde('Das Spiel erkennt die Beruehrung nicht');
    if (!aus.sicht) melde('Die Touch-Bedienung wird nicht angezeigt');
    if (!aus.knoepfe.length) melde('Es wurde kein einziger Knopf gebaut');

    /* 1. Gross genug? */
    const klein = aus.knoepfe.filter((k) => k.w < MINDEST || k.h < MINDEST);
    if (klein.length) {
      console.log('   ' + klein.length + ' von ' + aus.knoepfe.length +
                  ' Knoepfen unter ' + MINDEST + ' px:');
      for (const k of klein.slice(0, 8))
        console.log('      ' + k.id.padEnd(14) + k.w + ' x ' + k.h);
      schlecht++;
    } else console.log('   ok   alle Knoepfe mindestens ' + MINDEST + ' px');

    /* 2. Ueberlappen? */
    let ueber = 0, beispiel = null;
    for (let i = 0; i < aus.knoepfe.length; i++) {
      for (let j = i + 1; j < aus.knoepfe.length; j++) {
        const a = aus.knoepfe[i], c = aus.knoepfe[j];
        const dx = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
        const dz = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (dx > 1 && dz > 1) { ueber++; if (!beispiel) beispiel = a.id + ' / ' + c.id; }
      }
    }
    if (ueber) { melde(ueber + ' Knopfpaare ueberlappen, z. B. ' + beispiel); }
    else console.log('   ok   kein Knopf liegt auf einem anderen');

    /* 3. Alles im Bild? */
    const raus = aus.knoepfe.filter((k) => k.x < 0 || k.y < 0 ||
      k.x + k.w > aus.breite + 0.5 || k.y + k.h > aus.hoehe + 0.5);
    if (raus.length) {
      melde(raus.length + ' Knoepfe ragen aus dem Bild, z. B. ' + raus[0].id +
            ' bei ' + raus[0].x + '/' + raus[0].y);
    } else console.log('   ok   alle Knoepfe im Bild');

    /* 4. Minikarte frei? */
    if (aus.karte) {
      const drauf = aus.knoepfe.filter((k) => {
        const dx = Math.min(k.x + k.w, aus.karte.x + aus.karte.w) - Math.max(k.x, aus.karte.x);
        const dz = Math.min(k.y + k.h, aus.karte.y + aus.karte.h) - Math.max(k.y, aus.karte.y);
        return dx > 1 && dz > 1;
      });
      if (drauf.length) melde(drauf.length + ' Knoepfe liegen auf der Minikarte');
      else console.log('   ok   die Minikarte bleibt frei');
    }

    /* 5. Der Daumenknueppel */
    if (!aus.stick || aus.stick.w < 80) melde('Der Daumenknueppel fehlt oder ist winzig');
    else console.log('   ok   Daumenknueppel ' + aus.stick.w + ' x ' + aus.stick.h);

    /* 6. Liegt ein Knopf im Griffbereich des Knueppels? Der Daumen zieht
       dort hin und her - ein Knopf darunter wird beim Lenken getroffen. */
    if (aus.stick) {
      const s = aus.stick;
      const drin = aus.knoepfe.filter((k) => {
        const dx = Math.min(k.x + k.w, s.x + s.w) - Math.max(k.x, s.x);
        const dz = Math.min(k.y + k.h, s.y + s.h) - Math.max(k.y, s.y);
        return dx > 1 && dz > 1;
      });
      /* Kein Fehler, nur eine Zahl: der Beruehrungscode laesst einen
         Druck auf einen Knopf gar nicht erst an den Knueppel, und der
         Knueppel greift auf der ganzen linken Bildhaelfte. Den Block
         umbrechen zu lassen macht die Zahl null und das Bild schlechter
         (siehe Kommentar in index.html). Deshalb wird hier nur
         berichtet. */
      if (drin.length) {
        console.log('   Hinweis: ' + drin.length + ' Knoepfe liegen im Griffbereich ' +
                    'des Daumenknueppels (kein Fehler, siehe index.html):');
        for (const k of drin)
          console.log('        ' + k.id.padEnd(14) + 'x ' + k.x + '..' + (k.x + k.w).toFixed(1) +
                      '   Knueppel x ' + s.x + '..' + (s.x + s.w).toFixed(1));
      } else console.log('   ok   der Griffbereich des Knueppels ist frei');
    }

    await b.close();
  }
  console.log('\nPruefungen fehlerhaft: ' + schlecht);
  process.exit(schlecht ? 1 : 0);
})();
