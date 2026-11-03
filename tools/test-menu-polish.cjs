'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const createMenu = require('../menu.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
function fixture() {
  const { document, window } = parseHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  // Linkedom supplies DOM/events but not browser focus management.
  Object.defineProperty(document, 'activeElement', { writable: true, value: document.body });
  for (const element of document.querySelectorAll('button,input,select')) {
    element.focus = () => { document.activeElement = element; };
  }
  const menu = createMenu(document), key = (code, key = code) => {
    const e = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.assign(e, { code, key }); document.dispatchEvent(e); return e;
  };
  return { document, window, menu, key };
}
test('Desktop menu exposes settings directly, pauses once, and Escape returns to the menu', () => {
  const { document: d, menu, key } = fixture(); let pauses = 0;
  menu.setHooks({ pause: () => pauses++ });
  d.querySelector('[data-menu="settings"]').click();
  assert.equal(pauses, 1); assert.ok(menu.isBlocking());
  assert.equal(d.getElementById('settings').style.display, 'flex');
  assert.ok(d.getElementById('overlay').inert);
  assert.equal(d.querySelector('label[for="setAutokam"]').textContent, 'Kamera folgt');
  assert.ok(d.getElementById('setGrafik').querySelector('option[value="niedrig"]'));
  key('Escape'); assert.equal(menu.isBlocking(), false); assert.equal(d.getElementById('overlay').inert, false);
});
test('Every control tab shows its own keys and keyboard navigation wraps', () => {
  const { document: d, window } = fixture();
  d.querySelector('[data-menu="controls"]').click();
  for (const tab of d.querySelectorAll('[data-tab]')) {
    tab.click();
    for (const section of d.querySelectorAll('[role="tabpanel"]')) {
      assert.equal(section.hidden, section.id !== 'panel-' + tab.dataset.tab);
    }
  }
  const last = d.getElementById('tab-pad');
  const e = new window.Event('keydown', { bubbles: true, cancelable: true });
  Object.assign(e, { key: 'ArrowRight' }); last.dispatchEvent(e);
  assert.equal(d.getElementById('tab-move').getAttribute('aria-selected'), 'true');
});
test('Panel navigation does not start the game and P closes progress while paused', () => {
  const { document: d, menu, key } = fixture(); let starts = 0, progress = 0;
  d.getElementById('clickmsg').addEventListener('click', () => starts++);
  menu.setHooks({ progress: () => progress++ });
  for (const id of ['controls', 'settings', 'fortschritt']) d.querySelector('[data-menu="' + id + '"]').click();
  assert.equal(starts, 0); assert.equal(progress, 1);
  assert.equal(d.getElementById('settings').style.display, 'none');
  key('KeyP'); assert.equal(menu.isBlocking(), false);
});
test('Settings and progress panels pause touch simulation as well as pointer-lock play', () => {
  const { menu, window } = fixture();
  window.WEB_HERO_MENU = menu;
  const context = vm.createContext({ window, pointerLocked: false, touchAktiv: true });
  vm.runInContext(source.slice(source.indexOf('function isActive()'), source.indexOf('\nconst overlay =', source.indexOf('function isActive()'))), context);
  assert.equal(context.isActive(), true);
  menu.open('settings'); assert.equal(context.isActive(), false);
  menu.closeAll(); assert.equal(context.isActive(), true);
  context.pointerLocked = true; context.touchAktiv = false;
  menu.open('controls'); assert.equal(context.isActive(), false);
});
test('Settings changes persist and drive the existing graphics and camera values', () => {
  const { document: d, window } = fixture(), saved = new Map(); let graphics = 0;
  const context = vm.createContext({ document: d, window, istTouch: false,
    localStorage: { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) },
    wendeGrafikAn: () => graphics++, wendeTonAn: () => {}, wendeKarteAn: () => {}, zeigeEinstellungen: () => {} });
  const init = source.slice(source.indexOf('const EINST ='), source.indexOf('const settingsEl ='));
  const save = source.slice(source.indexOf('function einstSpeichern()'), source.indexOf('function wendeKarteAn()'));
  const a = source.indexOf('(function baueEinstellungen()'), b = source.indexOf('\n})();', a) + 6;
  // Linkedom's select.value getter is read-only; native browser controls are writable.
  for (const el of d.querySelectorAll('select')) Object.defineProperty(el, 'value', { value: '', writable: true });
  vm.runInContext(init + save + source.slice(a, b), context);
  const auto = d.getElementById('setAutokam'), gfx = d.getElementById('setGrafik');
  auto.value = 'an'; auto.dispatchEvent(new window.Event('change'));
  gfx.value = 'mittel'; gfx.dispatchEvent(new window.Event('change'));
  assert.equal(graphics, 1);
  const state = JSON.parse(saved.get('webhero_einst'));
  assert.equal(state.autokam, 'an'); assert.equal(state.grafik, 'mittel');
});
test('Page contains unique element IDs and every local script exists', () => {
  const { document: d } = fixture(), ids = Array.from(d.querySelectorAll('[id]'), e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of d.querySelectorAll('script[src]')) {
    const src = s.getAttribute('src'); if (!/^https?:/.test(src)) assert.ok(fs.existsSync(path.join(root, src)), src);
  }
});
