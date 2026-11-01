'use strict';
// Headless-Chrome-Aufnahme fuer den Next-Gen-Viewer (Three.js r128, echtes WebGL).
// Startet einen statischen Server auf dem Repo, oeffnet preview/index.html und fuehrt
// einen Ablaufplan aus:   node art/blender-nextgen/tools/cdp-capture.cjs <plan.cjs>
// Der Plan exportiert async function(api) mit api.ev(expr), api.shot(datei), api.size(w,h), api.log(obj).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const PORT = 8765, DBG = 9333;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg' };

function server() {
  return http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  }).listen(PORT, '127.0.0.1');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const planFile = path.resolve(process.argv[2]);
  const plan = require(planFile);
  const srv = server();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
    '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--window-size=1600,1000', 'about:blank'],
    { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch (e) { /* noch nicht bereit */ }
  }
  if (!target) throw new Error('Chrome nicht erreichbar');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); const consoleLines = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled') consoleLines.push(msg.params.args.map((a) => a.value).join(' '));
    if (msg.method === 'Runtime.exceptionThrown') consoleLines.push('EXCEPTION ' + JSON.stringify(msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description));
  });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const api = {
    async size(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
    async ev(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600));
      return r.result && r.result.result ? r.result.result.value : undefined;
    },
    async shot(file, quality = 90) {
      const r = await send('Page.captureScreenshot', { format: file.endsWith('.png') ? 'png' : 'jpeg', quality });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return file;
    },
    async open(query = '') {
      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/art/blender-nextgen/preview/index.html${query}` });
      for (let i = 0; i < 200; i++) { await sleep(100); if (await api.ev('!!(window.T && window.T.ready)')) return true; }
      throw new Error('Viewer nicht bereit: ' + consoleLines.join(' | '));
    },
    console: consoleLines,
    root,
    log(o) { process.stdout.write(JSON.stringify(o) + '\n'); },
  };
  try {
    await api.size(1600, 1000);
    await plan(api);
  } finally {
    if (consoleLines.length) process.stderr.write('console:\n' + consoleLines.slice(-40).join('\n') + '\n');
    ws.close(); chrome.kill(); srv.close();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome haelt Dateien noch */ }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
