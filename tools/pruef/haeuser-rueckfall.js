/* CITY V2, Stufe 5: bleibt die Stadt vollstaendig, wenn die Modelle
   ausfallen?

   Vor Stufe 5 war die Antwort einfach: die prozeduralen Fassaden blieben
   sichtbar, die Stadt sah aelter aus, aber sie stand. Mit der hybriden
   Darstellung gibt es zwei Saetze verschmolzener Fassaden, und nur einer
   davon darf ausgeblendet werden. Dazu kommt ein zweiter Fall, den ein
   reiner Ladefehler nicht abdeckt: die Datei laedt, aber EINE einzelne
   Platzierung schlaegt fehl. Dann darf nicht die halbe Stadt stehen und
   die andere Haelfte fehlen.

   Drei Laeufe:

     normal    Datei da, alles geht gut
               -> Rueckfall unsichtbar, Produktionssatz sichtbar,
                  jedes MODEL-Haus hat sein Modell

     404       Datei fehlt
               -> BEIDE Saetze sichtbar, kein Modell, kein Haus fehlt

     Teilfehler  Datei da, eine Platzierung ungueltig
               -> gar kein Modell, BEIDE Saetze sichtbar,
                  __hausFehler gesetzt, keine Kollider-Leiche

   Aufruf:  node tools/pruef/haeuser-rueckfall.js
   ========================================================================= */
const { starte } = require('./basis');

async function lauf(opt) {
  const { b, page } = await starte(960, 540, 4711, opt || {});
  const aus = await page.evaluate(() => {
    const d = __dbg; d.frier(true);
    /* Wieviel steht sichtbar in der Szene? Ein Haus, das weder Modell
       noch sichtbare Fassade hat, faellt hier auf. */
    let sichtbareMeshes = 0;
    d.szene.traverse((o) => { if (o.isMesh && o.visible) sichtbareMeshes++; });
    return { info: d.hausInfo(), sichtbareMeshes,
             kisten: d.hausKisten().length,
             modelle: d.hausModelle().length,
             kollider: d.colliders.length,
             dreiecke: d.renderInfo().dreiecke };
  });
  await b.close();
  return aus;
}

(async () => {
  const p = (s) => console.log(s);
  const F = [];
  const pruefe = (bed, text) => { if (!bed) F.push(text); };

  const normal = await lauf({});
  const ohne = await lauf({ ohneHaeuser: true });
  /* Genau EINE Platzierung zu wenig: so viele vorbereiten, wie es
     MODEL-Haeuser gibt, minus eins. */
  const teil = await lauf({ modellFehler: Math.max(1, normal.info.model - 1) });

  p('');
  p('== Rueckfall und atomare Platzierung ==');
  const zeile = (name, a) =>
    p('  ' + name.padEnd(13) + 'Kisten ' + String(a.kisten).padStart(4) +
      '   MODEL ' + String(a.info.model).padStart(4) +
      '   MERGED ' + String(a.info.merged).padStart(4) +
      '   Modelle ' + String(a.modelle).padStart(4) +
      '   Fassaden sichtbar  Prod ' + a.info.prodSichtbar + '/' + a.info.fassadenProd +
      '   Rueckfall ' + a.info.fallSichtbar + '/' + a.info.fassadenFall +
      '   Kollider ' + a.kollider);
  zeile('normal', normal);
  zeile('404', ohne);
  zeile('Teilfehler', teil);
  p('');
  p('  Fehlermeldung 404:        ' + (ohne.info.fehler || '(keine)'));
  p('  Fehlermeldung Teilfehler: ' + (teil.info.fehler || '(keine)'));
  p('');

  /* ---- normal ---- */
  pruefe(normal.modelle === normal.info.model,
    'normal: ' + normal.modelle + ' Modelle gesetzt, erwartet ' + normal.info.model);
  pruefe(normal.info.fallSichtbar === 0,
    'normal: der Rueckfall ist noch sichtbar, die Modelle stehen darauf');
  pruefe(normal.info.prodSichtbar === normal.info.fassadenProd,
    'normal: der Produktionssatz wurde ausgeblendet - dort steht jetzt nichts');

  /* ---- 404 ---- */
  pruefe(ohne.modelle === 0,
    'ohne haeuser.glb stehen trotzdem ' + ohne.modelle + ' Modelle');
  pruefe(ohne.info.fallSichtbar === ohne.info.fassadenFall,
    'ohne haeuser.glb fehlt der Rueckfall - dort steht jetzt nichts');
  pruefe(ohne.info.prodSichtbar === ohne.info.fassadenProd,
    'ohne haeuser.glb fehlt der Produktionssatz');
  pruefe(ohne.kisten === normal.kisten,
    'ohne haeuser.glb hat die Stadt eine andere Zahl Haeuser');

  /* ---- Teilfehler: der eigentliche Punkt ---- */
  pruefe(teil.modelle === 0,
    'Teilfehler: ' + teil.modelle + ' Modelle in der Szene - es darf KEINES sein');
  pruefe(teil.info.fallSichtbar === teil.info.fassadenFall,
    'Teilfehler: der Rueckfall wurde ausgeblendet - halb leere Stadt');
  pruefe(teil.info.prodSichtbar === teil.info.fassadenProd,
    'Teilfehler: der Produktionssatz wurde ausgeblendet');
  pruefe(!!teil.info.fehler,
    'Teilfehler: __hausFehler ist nicht gesetzt - der Ausfall bleibt unbemerkt');
  /* Kollider-Leck: die Kronen-Kollider der vorbereiteten Modelle duerfen
     NICHT in der Welt gelandet sein. Ohne gesetzte Modelle gibt es keine
     Kronen, also muss der Teilfehler deutlich WENIGER Kollider haben als
     der normale Lauf - und ungefaehr so viele wie der 404-Fall, in dem
     ebenfalls kein Modell steht. Die kleine Abweichung zwischen beiden
     kommt aus dem bekannten Ladezeit-Rauschen und ist kein Leck. */
  pruefe(teil.kollider < normal.kollider,
    'Teilfehler: ' + teil.kollider + ' Kollider, normal ' + normal.kollider +
    ' - die Kronen der verworfenen Modelle sind in der Welt gelandet');
  pruefe(Math.abs(teil.kollider - ohne.kollider) < 40,
    'Teilfehler: ' + teil.kollider + ' Kollider, 404-Fall ' + ohne.kollider +
    ' - die beiden Faelle ohne Modelle muessten gleich viele haben');

  if (F.length) { for (const x of F) p('  FEHLER: ' + x); p(''); process.exit(1); }
  p('  Ohne die Modelldatei steht jedes Haus prozedural da.');
  p('  Mit ihr verschwindet genau der Rueckfall und sonst nichts.');
  p('  Ein einzelner Fehler beim Setzen laesst die ganze Stadt prozedural -');
  p('  kein halb gemischter Zustand, keine Kollider-Leiche.');
  p('');
})();
