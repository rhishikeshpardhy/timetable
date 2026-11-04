/* Start-up: navigation, top bar, search palette, keyboard shortcuts, theme. */
(function () {
  'use strict';
  const { D } = Engine;
  const { esc, $, $$, icon, toast, modal, closeModal } = UI;

  const NAV = [
    ['today', 'Today', 'today'], ['calendar', 'Calendar', 'calendar'], ['board', 'Board', 'board'],
    ['people', 'People', 'person'], ['companies', 'Companies', 'building'], ['meetings', 'Meetings', 'meeting'],
    ['paydays', 'Advance & billing', 'bill'], ['review', 'Daily review', 'check'],
    ['insights', 'Insights', 'chart'], ['issues', 'Clashes', 'alert'], ['plan', 'Plan', 'plan'], ['settings', 'Settings', 'gear']
  ];

  App.renderChrome = function () {
    const plan = Store.plan, st = plan.settings;
    $('#nav').innerHTML = NAV.map(([v, l, ic]) => `<a href="#/${v}" data-view="${v}">${icon(ic)}<span>${l}</span>${v === 'issues' ? '<b id="issues-badge" class="badge" hidden></b>' : ''}</a>`).join('');
    $('#brand-title').textContent = plan.title || 'Works timetable';
    $('#brand-range').textContent = `${D.nice(st.start, { short: true })} to ${D.nice(st.end, { short: true })} ${st.end.slice(0, 4)}`;
  };

  function applyTheme() {
    const t = Store.prefs.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('#theme').innerHTML = icon(dark ? 'sun' : 'moon'); $('#theme').setAttribute('aria-label', dark ? 'Switch to light colours' : 'Switch to dark colours');
  }

  /* Search palette */
  function palette() {
    const plan = Store.plan;
    const items = [
      ...NAV.map(([v, l, ic]) => ({ label: l, hint: 'Page', ic, run: () => App.go(v) })),
      ...plan.people.map(p => ({ label: p.name + (p.fullName ? ' ' + p.fullName : ''), hint: 'Person', ic: 'person', run: () => App.go('people', { id: p.id }) })),
      ...plan.companies.map(c => ({ label: c.name, hint: 'Company', ic: 'building', run: () => App.go('companies', { id: c.id }) })),
      ...plan.tasks.map(t => ({ label: t.title, hint: 'Edit task', ic: 'edit', run: () => App.editTask(t.id) })),
      ...App.data.gen.dates.map(d => ({ label: D.nice(d, { long: true }), hint: 'Day', ic: 'calendar', run: () => App.go('today', { date: d }) })),
      { label: 'Add work for one day', hint: 'Action', ic: 'plus', run: () => App.addExtra() },
      { label: 'New repeating task', hint: 'Action', ic: 'plus', run: () => App.editTask(null) },
      { label: 'Download Excel', hint: 'Action', ic: 'download', run: () => App.exportExcel() }
    ];
    modal({
      title: 'Go to', body: `<input type="search" id="pal-q" placeholder="Type a person, company, task, page or date" aria-label="Search" autocomplete="off"><ul id="pal-list" class="pal-list" role="listbox"></ul>`,
      onOpen: m => {
        const q = $('#pal-q', m), list = $('#pal-list', m); let sel = 0, shown = [];
        const draw = () => {
          const v = q.value.toLowerCase().trim();
          shown = items.filter(i => !v || i.label.toLowerCase().includes(v) || i.hint.toLowerCase().includes(v)).slice(0, 12);
          sel = Math.min(sel, Math.max(0, shown.length - 1));
          list.innerHTML = shown.map((i, k) => `<li role="option" aria-selected="${k === sel}" class="${k === sel ? 'sel' : ''}" data-k="${k}">${icon(i.ic)}<span>${esc(i.label)}</span><em>${esc(i.hint)}</em></li>`).join('') || '<li class="muted">Nothing matches.</li>';
          $$('li[data-k]', list).forEach(li => li.onclick = () => { closeModal(); shown[+li.dataset.k].run(); });
        };
        q.oninput = () => { sel = 0; draw(); };
        q.onkeydown = e => {
          if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
          else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
          else if (e.key === 'Enter' && shown[sel]) { e.preventDefault(); closeModal(); shown[sel].run(); }
        };
        draw();
      }
    });
  }

  function help() {
    modal({ title: 'How to use this timetable', wide: true, body: `<div class="help">
      <p><b>Today</b> shows where everyone is and what they are doing, hour by hour. <b>Calendar</b> and <b>Board</b> show the whole period.</p>
      <p>To change work: click it to edit the day, time or people; drag it to another day to move it; on the Board or Today, drag it onto another person to hand it over. Every change can be undone.</p>
      <p>To change the pattern itself (for example, billing on other dates), open <b>Plan</b>. The Excel's monthly dates are tasks there.</p>
      <p><b>Clashes</b> lists anyone booked twice, with one-click fixes. <b>Insights</b> shows hours, spread of work, daily load and time per company.</p>
      <p>Changes are kept in this browser. To share them, use <b>Settings, Copy share link</b>, or publish <code>plan.json</code> to the website.</p>
      <h3 class="sub">Keyboard</h3><ul class="plain keys"><li><kbd>Ctrl</kbd> <kbd>K</kbd> or <kbd>/</kbd> Go to anything</li><li><kbd>Ctrl</kbd> <kbd>Z</kbd> Undo, <kbd>Ctrl</kbd> <kbd>Y</kbd> Redo</li><li><kbd>←</kbd> <kbd>→</kbd> Previous or next day on Today and Daily review</li><li><kbd>N</kbd> Add work for one day</li><li><kbd>Esc</kbd> Close a window</li></ul></div>` });
  }

  async function start() {
    await Store.init();
    App.renderChrome();
    applyTheme();
    let pending = false;
    Store.on(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; App.keepScroll = true; App.render(); }); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    $('#theme').onclick = () => { const cur = Store.prefs.theme; const dark = cur === 'dark' || (cur === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); Store.prefs.theme = dark ? 'light' : 'dark'; Store.savePrefs(); applyTheme(); };
    $('#undo').onclick = () => { const l = Store.undo(); if (l) toast(`Undone: ${l}`); };
    $('#redo').onclick = () => { const l = Store.redo(); if (l) toast(`Redone: ${l}`); };
    $('#search').onclick = palette;
    $('#add').onclick = () => App.addExtra(App.route.params.date);
    $('#help').onclick = help;
    $('#menu').onclick = () => document.body.classList.toggle('nav-open');
    $('#nav').addEventListener('click', () => document.body.classList.remove('nav-open'));
    window.addEventListener('hashchange', () => { App.parseHash(); App.render(); window.scrollTo(0, 0); });
    document.addEventListener('keydown', e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (e.key === 'Escape') { closeModal(); document.body.classList.remove('nav-open'); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); return; }
      if (typing || !$('#modal').hidden) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); $('#undo').click(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); $('#redo').click(); }
      else if (e.key === '/') { e.preventDefault(); palette(); }
      else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); App.addExtra(App.route.params.date); }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && ['today', 'review'].includes(App.route.view)) {
        const d = App.route.params.date || App.defaultDate(); const n = D.add(d, e.key === 'ArrowLeft' ? -1 : 1);
        const st = Store.plan.settings; if (n >= st.start && n <= st.end) App.go(App.route.view, { date: n });
      }
    });
    App.parseHash();
    App.render();
    if (Store.sharedLoaded) toast('Loaded the timetable from the shared link. It is now saved in this browser.');
    if (Store.shareError) toast('That share link could not be read. Showing your saved timetable instead.');
    // keep the Today now-line moving
    setInterval(() => { if (App.route.view === 'today' && $('#modal').hidden && !document.body.classList.contains('is-dragging')) { App.keepScroll = true; App.render(); } }, 60000);
  }
  start();
})();
