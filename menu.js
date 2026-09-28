/* Shared desktop/touch menu; independent of WebGL and game state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.WEB_HERO_MENU = factory(document);
})(typeof window === 'object' ? window : this, function (doc) {
  'use strict';
  const ids = ['controls', 'settings', 'fortschritt'];
  const overlay = doc.getElementById('overlay');
  let hooks = {}, previousFocus = null;
  const active = () => ids.find(id => doc.getElementById(id).style.display === 'flex');
  function closeAll() {
    for (const id of ids) doc.getElementById(id).style.display = 'none';
    overlay.inert = false;
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }
  function open(id) {
    if (!ids.includes(id)) return;
    previousFocus = doc.activeElement;
    for (const name of ids) doc.getElementById(name).style.display = name === id ? 'flex' : 'none';
    overlay.inert = true;
    if (hooks.pause) hooks.pause();
    if (id === 'fortschritt' && hooks.progress) hooks.progress();
    const panel = doc.getElementById(id);
    const first = panel.querySelector('button, input, select');
    if (first) first.focus();
  }
  for (const button of doc.querySelectorAll('[data-menu]')) {
    button.addEventListener('click', () => open(button.dataset.menu));
  }
  for (const button of doc.querySelectorAll('[data-close]')) button.addEventListener('click', closeAll);
  const tabs = Array.from(doc.querySelectorAll('[data-tab]'));
  function selectTab(selected) {
    for (const tab of tabs) {
      const on = tab === selected;
      tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1;
      doc.getElementById('panel-' + tab.dataset.tab).hidden = !on;
    }
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      const index = tabs.indexOf(tab);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
        : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[next]); tabs[next].focus();
    });
  }
  if (tabs.length) selectTab(tabs[0]);
  doc.addEventListener('keydown', e => {
    const id = active();
    if (!id) return;
    if (e.code === 'Escape' || (id === 'fortschritt' && e.code === 'KeyP')) {
      e.preventDefault(); e.stopImmediatePropagation(); closeAll(); return;
    }
    if (e.key !== 'Tab') return;
    const elements = Array.from(doc.getElementById(id).querySelectorAll('button, input, select, [tabindex="0"]'))
      .filter(el => !el.disabled && el.tabIndex >= 0 && !el.closest('[hidden]'));
    const first = elements[0], last = elements[elements.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }, true);
  return { open, closeAll, isBlocking: () => !!active(), setHooks: value => { hooks = value; } };
});
