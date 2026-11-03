/* Misst lose Texturdateien: Format, Aufloesung, Bytes.
   Fuer die BUILD-2-Pakete, die ihre Texturen neben dem Modell liefern.
   Es wird nur der Dateikopf gelesen, nichts dekodiert.
   Aufruf:  node tools/build2-texturen.mjs <ordner> */
import fs from 'node:fs';
import path from 'node:path';
import { bildMasse } from './build2-inspect.mjs';

const ordner = process.argv[2];
const treffer = [];
const geh = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) geh(p);
    else if (/\.(png|jpe?g|webp|tga|bmp|ktx2?)$/i.test(e.name)) treffer.push(p);
  }
};
geh(ordner);
let bytes = 0, pixel = 0;
const zeilen = [];
for (const p of treffer.sort()) {
  const st = fs.statSync(p);
  const m = bildMasse(fs.readFileSync(p, { start: 0 }));
  bytes += st.size;
  if (m && m.b) pixel += m.b * m.h;
  zeilen.push({ name: path.relative(ordner, p), typ: m ? m.typ : '?',
                b: m ? m.b : null, h: m ? m.h : null, kb: Math.round(st.size / 1024) });
}
zeilen.sort((a, b) => (b.b || 0) * (b.h || 0) - (a.b || 0) * (a.h || 0));
console.log('Texturen: ' + treffer.length + '   ' + (bytes / 1048576).toFixed(2) + ' MB   ' +
            (pixel / 1e6).toFixed(1) + ' Megapixel');
for (const z of zeilen) {
  console.log('  ' + String(z.b + 'x' + z.h).padStart(11) + '  ' + String(z.kb + ' kB').padStart(9) +
              '  ' + z.typ.padEnd(5) + '  ' + z.name);
}
const gross = zeilen.filter((z) => (z.b || 0) > 1024 || (z.h || 0) > 1024);
console.log('  groesser als 1024: ' + gross.length + ' von ' + zeilen.length);
