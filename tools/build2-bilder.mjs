/* Bilder von BUILD-2-Modellen, ohne sie ins Spiel zu holen.

   Zahlen allein reichen fuer eine Empfehlung nicht. "Zehn Haeuser mit
   je 250 Dreiecken" kann ein brauchbares Stadtviertel sein oder zehn
   texturierte Kisten - das entscheidet das Auge. Diese Seite laedt ein
   GLB in einer leeren Szene, faehrt die Kamera einmal herum und legt
   Bilder ab. Sie ruehrt das Spiel NICHT an: eigene HTML-Datei, eigener
   Renderer, nichts wird nach assets/ kopiert.

   Aufruf:  node tools/build2-bilder.mjs <datei.glb> <zielordner> [name]
*/
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const datei = process.argv[2];
const ziel = process.argv[3] || '/tmp/build2-bilder';
const name = process.argv[4] || path.basename(datei, path.extname(datei));
if (!datei) { console.log('Aufruf: node tools/build2-bilder.mjs <datei.glb> <zielordner> [name]'); process.exit(1); }
fs.mkdirSync(ziel, { recursive: true });

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SEITE = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#7c8796;overflow:hidden}canvas{display:block}
</style></head><body>
<script src="/lib/three.min.js"></script>
<script src="/lib/GLTFLoader.js"></script>
<script>
const szene = new THREE.Scene();
szene.background = new THREE.Color(0x7c8796);
const kam = new THREE.PerspectiveCamera(45, 1200/800, 0.1, 4000);
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(1200, 800); document.body.appendChild(r.domElement);
szene.add(new THREE.HemisphereLight(0xdfe8f5, 0x6b6f76, 1.15));
const sonne = new THREE.DirectionalLight(0xfff3e0, 1.5);
sonne.position.set(60, 100, 40); szene.add(sonne);
/* Ein Boden, damit man sieht, wo unten ist und ob die Modelle darauf
   stehen oder schweben. */
const boden = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000),
  new THREE.MeshLambertMaterial({ color: 0x5c646e }));
boden.rotation.x = -Math.PI/2; boden.position.y = -0.01; szene.add(boden);
window.__fertig = false; window.__info = null;
new THREE.GLTFLoader().load('/modell.glb', (g) => {
  szene.add(g.scene);
  const box = new THREE.Box3().setFromObject(g.scene);
  const gr = box.getSize(new THREE.Vector3());
  const mi = box.getCenter(new THREE.Vector3());
  window.__info = { masse: [gr.x, gr.y, gr.z], mitte: [mi.x, mi.y, mi.z], unten: box.min.y };
  window.__blick = (winkel, hoehe, weite) => {
    const rad = Math.max(gr.x, gr.z, gr.y) * (weite || 1.1);
    kam.position.set(mi.x + Math.sin(winkel) * rad, box.min.y + gr.y * (hoehe || 0.55),
                     mi.z + Math.cos(winkel) * rad);
    kam.lookAt(mi.x, box.min.y + gr.y * 0.45, mi.z);
    r.render(szene, kam);
  };
  window.__fertig = true;
}, undefined, (e) => { window.__fehler = String(e); window.__fertig = true; });
</script></body></html>`;

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(SEITE); return; }
  const f = p === '/modell.glb' ? datei : path.join(WURZEL, p.replace(/^\/+/, ''));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const typ = f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': typ });
  fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const start = { args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
if (process.env.PLAYWRIGHT_CHROMIUM) start.executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const b = await chromium.launch(start);
const seite = await b.newPage({ viewport: { width: 1200, height: 800 } });
await seite.goto('http://127.0.0.1:' + port + '/');
await seite.waitForFunction('window.__fertig === true', null, { timeout: 180000 });
const fehler = await seite.evaluate(() => window.__fehler || null);
if (fehler) { console.log('FEHLER beim Laden: ' + fehler); await b.close(); server.close(); process.exit(1); }
const info = await seite.evaluate(() => window.__info);
console.log(name + ': Masse ' + info.masse.map((v) => v.toFixed(2)).join(' x ') +
            '   Unterkante y=' + info.unten.toFixed(3));
const blicke = [['vorn', 0, 0.55, 1.1], ['schraeg', 0.9, 0.75, 1.2],
                ['seite', 1.57, 0.5, 1.1], ['oben', 2.4, 1.4, 1.3]];
for (const [wie, w, h, weit] of blicke) {
  await seite.evaluate(([a, b2, c]) => window.__blick(a, b2, c), [w, h, weit]);
  /* Zweimal zeichnen und ein Bild abwarten: SwiftShader liefert sonst
     einen halb fertigen Puffer - derselbe Fehler wie im
     Innenraum-Pruefstand. */
  await seite.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
  await seite.evaluate(([a, b2, c]) => window.__blick(a, b2, c), [w, h, weit]);
  const p = path.join(ziel, name + '-' + wie + '.png');
  await seite.screenshot({ path: p });
  console.log('  ' + p);
}
await b.close();
server.close();
