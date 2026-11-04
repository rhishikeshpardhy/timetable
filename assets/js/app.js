/* App core: computed data, routing, shared rendering pieces, editing dialogs, drag & drop. */
(function (g) {
  'use strict';
  const { D, T } = Engine;
  const { esc, $, $$, icon, toast, modal, closeModal } = UI;

  const TYPES = {
    meeting: { label: 'Joint meeting', color: '#5a5c9c' },
    site: { label: 'Site measurement', color: '#2c7a6e' },
    outstation: { label: 'Outstation', color: '#9a6428' },
    billing: { label: 'Billing', color: '#b03a4b' },
    advance: { label: 'Advances', color: '#2f68a3' },
    office: { label: 'Office work', color: '#5f7a2e' },
    review: { label: 'Daily review', color: '#7c8784' }
  };
  const GROUPS = { main: 'Main contractors', outstation: 'Outstation', other: 'Other contractors' };
  const STATUS = { planned: 'Planned', progress: 'In progress', done: 'Done' };

  const App = {
    TYPES, GROUPS, STATUS, views: {}, data: null, route: { view: 'today', params: {} },

    compute() {
      const plan = Store.plan;
      const gen = Engine.generate(plan);
      const iss = Engine.issues(plan, gen);
      const stats = Engine.stats(plan, gen);
      const byKey = {}, byDate = {}, visitsBy = {};
      gen.occs.forEach(o => { byKey[o.key] = o; (byDate[o.date] = byDate[o.date] || []).push(o); });
      gen.visits.forEach(v => { visitsBy[v.runKey + '|' + v.person + '|' + v.date] = (visitsBy[v.runKey + '|' + v.person + '|' + v.date] || []).concat(v); });
      const clashKeys = new Set(); const clashPD = new Set();
      iss.filter(i => i.level === 'clash').forEach(i => { (i.keys || []).forEach(k => clashKeys.add(k)); clashPD.add(i.person + '|' + i.date); });
      this.data = { plan, gen, iss, stats, byKey, byDate, visitsBy, clashKeys, clashPD };
      return this.data;
    },

    /* ---------- lookups ---------- */
    person(id) { return Engine.personOf(Store.plan, id); },
    pname(id) { const p = this.person(id); return p ? p.name : id; },
    pcolor(id) { const p = this.person(id); return p ? p.color : '#888'; },
    cname(id) { return Engine.companyName(Store.plan, id); },
    task(id) { return Store.plan.tasks.find(t => t.id === id); },
    isHoliday(d) { return this.data.gen.hol[d]; },
    isWorking(d) { return !this.data.gen.hol[d] && !(D.dow(d) === 0 && Store.plan.settings.sundayOff); },
    visitsFor(o, pid) { return this.data.visitsBy[o.runKey + '|' + pid + '|' + o.date] || []; },
    /* What a person actually does in an occurrence (site runs name the company) */
    personLabel(o, pid) {
      if (o.siteGroup) {
        const v = this.visitsFor(o, pid);
        if (v.length) return (o.siteGroup === 'outstation' ? 'Outstation site: ' : 'Site: ') + v.map(x => this.cname(x.company)).join(', ');
        return o.siteGroup === 'outstation' ? 'Outstation: sheets & cement calculation' : 'Sheet preparation & cement calculation';
      }
      return o.title;
    },
    defaultDate() {
      const st = Store.plan.settings; const t = D.today();
      return (t >= st.start && t <= st.end) ? t : st.start;
    },
    filtered(occs) {
      const f = Store.prefs.filters || {};
      return occs.filter(o => {
        if (f.people && f.people.length && !o.people.some(p => f.people.includes(p))) return false;
        if (f.types && f.types.length && !f.types.includes(o.type)) return false;
        if (!f.showReview && o.type === 'review' && !(f.types && f.types.includes('review'))) return false;
        if (f.company && !(o.companies.includes(f.company) || this.data.gen.visits.some(v => v.runKey === o.runKey && v.date === o.date && v.company === f.company))) return false;
        if (f.q) { const q = f.q.toLowerCase(); const hay = (o.title + ' ' + o.details + ' ' + o.people.map(p => this.pname(p)).join(' ') + ' ' + o.companies.map(c => this.cname(c)).join(' ')).toLowerCase(); if (!hay.includes(q)) return false; }
        return true;
      });
    },

    /* ---------- shared pieces ---------- */
    chip(o, opts) {
      opts = opts || {};
      const ty = TYPES[o.type] || TYPES.office;
      const byPerson = Store.prefs.colorBy === 'person' && o.people.length === 1;
      const c = byPerson ? this.pcolor(o.people[0]) : ty.color;
      const clash = this.data.clashKeys.has(o.key);
      const pid = opts.person;
      const title = pid ? this.personLabel(o, pid) : o.title;
      const tip = `${o.title}\n${D.nice(o.date, { long: true })}, ${o.start}–${o.end} (${T.hrs(o.mins)} h)\n${o.people.map(p => this.pname(p)).join(', ')}${o.shifted ? '\nMoved from ' + D.nice(o.planned) + ' (holiday)' : ''}${o.moved ? '\nRescheduled by hand' : ''}${clash ? '\nClash: someone is booked twice' : ''}`;
      return `<button type="button" class="chip ${clash ? 'is-clash' : ''} ${o.status === 'done' ? 'is-done' : ''} ${opts.compact ? 'compact' : ''}" style="--c:${c}" data-occ="${esc(o.key)}" ${opts.drag === false ? '' : 'draggable="true"'} ${pid ? `data-from-person="${esc(pid)}"` : ''} title="${esc(tip)}">
        <span class="chip-time">${o.start}</span><span class="chip-title">${esc(title)}</span>
        ${opts.noPeople ? '' : `<span class="chip-people">${o.people.map(p => `<i style="--pc:${this.pcolor(p)}">${esc(this.person(p) ? this.person(p).id : p)}</i>`).join('')}</span>`}
        ${o.status === 'done' ? `<span class="chip-flag" aria-label="Done">${icon('check')}</span>` : ''}${o.shifted || o.moved ? '<span class="chip-moved" aria-label="Moved">↷</span>' : ''}</button>`;
    },
    personTag(id, extra) { const p = this.person(id); if (!p) return esc(id); return `<span class="ptag" style="--pc:${p.color}" ${extra || ''}><i>${esc(p.id)}</i>${esc(p.name !== p.id ? p.name.replace(p.id, '').replace(/^\s*\/\s*/, '') || '' : '')}</span>`; },
    typeTag(t) { const ty = TYPES[t] || TYPES.office; return `<span class="ttag" style="--c:${ty.color}">${esc(ty.label)}</span>`; },

    filterBar(opts) {
      opts = opts || {};
      const f = Store.prefs.filters || {};
      const plan = Store.plan;
      return `<div class="filterbar" role="group" aria-label="Filters">
        <div class="fgroup"><span class="flabel">People</span>${plan.people.map(p => `<button type="button" class="fchip ${f.people && f.people.includes(p.id) ? 'on' : ''}" style="--pc:${p.color}" data-fperson="${esc(p.id)}" aria-pressed="${!!(f.people && f.people.includes(p.id))}">${esc(p.id)}</button>`).join('')}</div>
        <div class="fgroup"><span class="flabel">Work</span>${Object.keys(TYPES).map(t => `<button type="button" class="fchip type ${f.types && f.types.includes(t) ? 'on' : ''}" style="--c:${TYPES[t].color}" data-ftype="${t}" aria-pressed="${!!(f.types && f.types.includes(t))}">${esc(TYPES[t].label)}</button>`).join('')}</div>
        <div class="fgroup grow">
          <select data-fcompany aria-label="Company"><option value="">All companies</option>${Object.keys(GROUPS).map(gk => `<optgroup label="${GROUPS[gk]}">${plan.companies.filter(c => c.group === gk).map(c => `<option value="${esc(c.id)}" ${f.company === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('')}</select>
          <input type="search" data-fq placeholder="Search work" value="${esc(f.q || '')}" aria-label="Search work">
          ${opts.review !== false ? `<label class="check"><input type="checkbox" data-freview ${f.showReview ? 'checked' : ''}> Show daily review</label>` : ''}
          <div class="seg" role="group" aria-label="Colour by"><button type="button" data-colorby="type" class="${Store.prefs.colorBy !== 'person' ? 'on' : ''}">Colour by work</button><button type="button" data-colorby="person" class="${Store.prefs.colorBy === 'person' ? 'on' : ''}">by person</button></div>
          ${(f.people && f.people.length) || (f.types && f.types.length) || f.company || f.q ? '<button type="button" class="btn btn-ghost btn-sm" data-fclear>Clear filters</button>' : ''}
        </div></div>`;
    },
    bindFilters(root) {
      const f = Store.prefs.filters = Store.prefs.filters || {};
      const upd = () => { Store.savePrefs(); App.render(); };
      $$('[data-fperson]', root).forEach(b => b.onclick = () => { f.people = toggle(f.people, b.dataset.fperson); upd(); });
      $$('[data-ftype]', root).forEach(b => b.onclick = () => { f.types = toggle(f.types, b.dataset.ftype); upd(); });
      $$('[data-fcompany]', root).forEach(s => s.onchange = () => { f.company = s.value || null; upd(); });
      $$('[data-fq]', root).forEach(i => { let t; i.oninput = () => { clearTimeout(t); t = setTimeout(() => { f.q = i.value; Store.savePrefs(); App.render(); const n = $('[data-fq]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); }; });
      $$('[data-freview]', root).forEach(c => c.onchange = () => { f.showReview = c.checked; upd(); });
      $$('[data-colorby]', root).forEach(b => b.onclick = () => { Store.prefs.colorBy = b.dataset.colorby; upd(); });
      $$('[data-fclear]', root).forEach(b => b.onclick = () => { Store.prefs.filters = { showReview: f.showReview }; upd(); });
    },

    /* ---------- routing ---------- */
    go(view, params) {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      location.hash = '#/' + view + q;
    },
    parseHash() {
      const h = location.hash.replace(/^#\/?/, '');
      const [v, q] = h.split('?');
      this.route = { view: this.views[v] ? v : 'today', params: Object.fromEntries(new URLSearchParams(q || '')) };
    },
    render() {
      this.compute();
      const v = this.views[this.route.view];
      const root = $('#view');
      const scroll = { y: window.scrollY, x: ($('.hscroll', root) || {}).scrollLeft || 0 };
      root.innerHTML = v.render(this.route.params);
      if (v.mount) v.mount(root, this.route.params);
      bindCommon(root);
      $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.view === this.route.view));
      $$('#nav a').forEach(a => a.setAttribute('aria-current', a.dataset.view === this.route.view ? 'page' : 'false'));
      const cnt = this.data.iss.filter(i => i.level === 'clash').length;
      const badge = $('#issues-badge'); if (badge) { badge.textContent = cnt || ''; badge.hidden = !cnt; }
      $('#undo').disabled = !Store.undoStack.length; $('#redo').disabled = !Store.redoStack.length;
      $('#local-flag').hidden = !Store.differsFromOffice();
      document.title = `${v.title || 'Timetable'} – ${Store.plan.title || 'Works timetable'}`;
      if (scroll.x && $('.hscroll', root)) $('.hscroll', root).scrollLeft = scroll.x;
      if (this.keepScroll) { window.scrollTo(0, scroll.y); this.keepScroll = false; }
    },

    /* ---------- edits ---------- */
    commit(label, fn) {
      App.keepScroll = true;
      Store.change(label, fn);
      toast(label, { label: 'Undo', run: () => { Store.undo(); App.keepScroll = true; App.render(); } });
    },
    setOverride(key, patch, label) {
      App.commit(label || 'Updated', p => { p.overrides[key] = Object.assign({}, p.overrides[key] || {}, patch); });
    },
    moveOcc(key, date) {
      const o = this.data.byKey[key]; if (!o || o.date === date) return;
      if (key.startsWith('x:')) return App.commit(`Moved ${o.title} to ${D.nice(date)}`, p => { const x = p.extra.find(x => 'x:' + x.id === key); if (x) x.date = date; });
      this.setOverride(key, { date }, `Moved ${o.title} to ${D.nice(date)}`);
    },
    reassign(key, from, to) {
      const o = this.data.byKey[key]; if (!o || from === to) return;
      let ppl = o.people.filter(p => p !== from); if (!ppl.includes(to)) ppl.push(to);
      if (key.startsWith('x:')) return App.commit(`${this.pname(to)} now does ${o.title}`, p => { const x = p.extra.find(x => 'x:' + x.id === key); if (x) x.people = ppl; });
      const visits = o.siteGroup ? this.visitsFor(o, from) : [];
      App.commit(`${this.pname(to)} takes over ${this.personLabel(o, from)} on ${D.nice(o.date)}`, p => {
        p.overrides[key] = Object.assign({}, p.overrides[key] || {}, { people: ppl });
        visits.forEach(v => { p.visitOverrides[v.key] = { date: v.date, person: to }; });   // the site visit goes with the work
      });
    },
    nextFreeDay(o, fromDate, onlyPerson) {
      const st = Store.plan.settings; const ppl = onlyPerson ? [onlyPerson] : o.people;
      for (let d = D.add(fromDate || o.date, 1); d <= st.end; d = D.add(d, 1)) {
        if (!this.isWorking(d)) continue;
        const busy = (this.data.byDate[d] || []).some(x => x.key !== o.key && x.people.some(p => ppl.includes(p)) && Engine.overlapMins(x, o) > 0);
        if (!busy) return d;
      }
      return null;
    },

    openOcc(key) {
      const o = this.data.byKey[key]; if (!o) return;
      const plan = Store.plan; const isExtra = key.startsWith('x:');
      const t = isExtra ? null : this.task(o.taskId);
      const ppl = plan.people.map(p => `<label class="pick" style="--pc:${p.color}"><input type="checkbox" name="pp" value="${esc(p.id)}" ${o.people.includes(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('');
      const visits = o.siteGroup ? o.people.map(pid => `<li>${this.personTag(pid)} ${esc(this.personLabel(o, pid))}</li>`).join('') : '';
      const agenda = t && t.agenda ? `<h3 class="sub">Agenda</h3><ol class="agenda-mini">${t.agenda.map(a => `<li><span>${esc(a.item)}</span><b>${a.minutes} min</b></li>`).join('')}</ol>` : '';
      const clashes = this.data.iss.filter(i => i.level === 'clash' && (i.keys || []).includes(key));
      modal({
        title: o.title, wide: true,
        body: `<div class="occ-meta">${this.typeTag(o.type)} <span>${esc(D.nice(o.date, { long: true }))}</span>
            ${o.shifted ? `<span class="note-pill">Moved from ${D.nice(o.planned)} (holiday)</span>` : ''}${o.moved ? `<span class="note-pill">Planned for ${D.nice(o.planned)}</span>` : ''}</div>
          ${clashes.length ? `<div class="callout clash">${clashes.map(c => `<p>${esc(c.text)}</p>`).join('')}</div>` : ''}
          <form id="occ-form" class="form-grid">
            <label>Date<input type="date" name="date" value="${o.date}" min="${plan.settings.start}" max="${plan.settings.end}" required></label>
            <label>Starts<input type="time" name="start" value="${o.start}" step="300" required></label>
            <label>Ends<input type="time" name="end" value="${o.end}" step="300" required></label>
            <label>Status<select name="status">${Object.keys(STATUS).map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select></label>
            <fieldset class="span"><legend>Who does it</legend><div class="picks">${ppl}</div></fieldset>
            <label class="span">Title<input name="title" value="${esc(o.title)}"></label>
            <label class="span">Note for this day<textarea name="note" rows="2" placeholder="Anything specific for this day">${esc(o.note || '')}</textarea></label>
          </form>
          ${o.details ? `<h3 class="sub">What to do</h3><p class="muted">${esc(o.details)}</p>` : ''}
          ${visits ? `<h3 class="sub">Site days in this run</h3><ul class="plain">${visits}</ul>` : ''}
          ${o.companies.length ? `<h3 class="sub">Companies</h3><p class="muted">${o.companies.map(c => esc(this.cname(c))).join(', ')}</p>` : ''}
          ${agenda}`,
        foot: `${!isExtra ? `<button type="button" class="btn btn-ghost" id="occ-task">${icon('edit')}Edit the whole task</button>` : ''}
          ${!isExtra && plan.overrides[key] ? `<button type="button" class="btn btn-ghost" id="occ-reset">Back to plan</button>` : ''}
          <button type="button" class="btn btn-ghost danger" id="occ-del">${icon('trash')}${isExtra ? 'Delete' : 'Cancel this day'}</button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Close</button>
          <button type="submit" form="occ-form" class="btn btn-primary">Save changes</button>`,
        onOpen: m => {
          $('#occ-form', m).onsubmit = e => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const people = fd.getAll('pp');
            const patch = { date: fd.get('date'), start: fd.get('start'), end: fd.get('end'), title: fd.get('title'), note: fd.get('note'), people };
            if (T.m(patch.end) <= T.m(patch.start)) { toast('The end time must be after the start time.'); return; }
            closeModal();
            if (isExtra) {
              App.commit(`Saved ${patch.title}`, p => { const x = p.extra.find(x => 'x:' + x.id === key); Object.assign(x, patch); p.status[key] = fd.get('status'); });
            } else {
              const clean = {}; Object.keys(patch).forEach(k => { const same = k === 'people' ? JSON.stringify(patch.people) === JSON.stringify(Engine.normPeople(plan, t.people)) : (k === 'date' ? patch.date === o.planned : patch[k] === (t[k] || '')); if (!same) clean[k] = patch[k]; });
              App.commit(`Saved ${patch.title} on ${D.nice(patch.date)}`, p => {
                if (Object.keys(clean).length) p.overrides[key] = Object.assign({}, p.overrides[key] || {}, clean); else delete p.overrides[key];
                if (fd.get('status') === 'planned') delete p.status[key]; else p.status[key] = fd.get('status');
              });
            }
          };
          const tb = $('#occ-task', m); if (tb) tb.onclick = () => { closeModal(); App.editTask(o.taskId); };
          const rb = $('#occ-reset', m); if (rb) rb.onclick = () => { closeModal(); App.commit(`${o.title} is back to the plan`, p => { delete p.overrides[key]; }); };
          $('#occ-del', m).onclick = () => { closeModal(); if (isExtra) App.commit(`Deleted ${o.title}`, p => { p.extra = p.extra.filter(x => 'x:' + x.id !== key); }); else App.setOverride(key, { deleted: true }, `Cancelled ${o.title} on ${D.nice(o.date)}`); };
        }
      });
    },

    addExtra(date, personId) {
      const plan = Store.plan;
      modal({
        title: 'Add work for one day',
        body: `<form id="x-form" class="form-grid">
          <label class="span">What<input name="title" required placeholder="For example: Bank visit for KIPL payment"></label>
          <label>Date<input type="date" name="date" value="${date || this.defaultDate()}" min="${plan.settings.start}" max="${plan.settings.end}" required></label>
          <label>Starts<input type="time" name="start" value="10:00" step="300" required></label>
          <label>Ends<input type="time" name="end" value="13:30" step="300" required></label>
          <label>Kind of work<select name="type">${Object.keys(TYPES).map(k => `<option value="${k}" ${k === 'office' ? 'selected' : ''}>${TYPES[k].label}</option>`).join('')}</select></label>
          <fieldset class="span"><legend>Who does it</legend><div class="picks">${plan.people.map(p => `<label class="pick" style="--pc:${p.color}"><input type="checkbox" name="pp" value="${esc(p.id)}" ${p.id === personId ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('')}</div></fieldset>
          <label class="span">Company<select name="company"><option value="">None</option>${plan.companies.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label>
          <label class="span">Details<textarea name="details" rows="2"></textarea></label></form>`,
        foot: `<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="x-form" class="btn btn-primary">Add work</button>`,
        onOpen: m => {
          $('#x-form', m).onsubmit = e => {
            e.preventDefault(); const fd = new FormData(e.target);
            if (T.m(fd.get('end')) <= T.m(fd.get('start'))) { toast('The end time must be after the start time.'); return; }
            const x = { id: 'e' + Date.now().toString(36), title: fd.get('title'), date: fd.get('date'), start: fd.get('start'), end: fd.get('end'), type: fd.get('type'), people: fd.getAll('pp'), companies: fd.get('company') ? [fd.get('company')] : [], details: fd.get('details') };
            closeModal(); App.commit(`Added ${x.title} on ${D.nice(x.date)}`, p => p.extra.push(x));
          };
        }
      });
    },

    editTask(id) {
      const plan = Store.plan; const isNew = !id;
      const t = isNew ? { id: 't' + Date.now().toString(36), title: '', type: 'office', mode: 'monthly', days: [], people: [], start: '10:00', end: '18:30', companies: [], details: '', holiday: 'shift' } : Store.clone(this.task(id));
      const dayBtns = Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<label class="daypick"><input type="checkbox" name="days" value="${d}" ${(t.days || []).includes(d) ? 'checked' : ''}><span>${d}</span></label>`).join('');
      modal({
        title: isNew ? 'New task' : `Edit task: ${t.title}`, wide: true,
        body: `<form id="t-form" class="form-grid">
          <label class="span">Task name<input name="title" value="${esc(t.title)}" required></label>
          <label>Kind of work<select name="type">${Object.keys(TYPES).map(k => `<option value="${k}" ${t.type === k ? 'selected' : ''}>${TYPES[k].label}</option>`).join('')}</select></label>
          <label>Repeats<select name="mode" id="t-mode">
            <option value="monthly" ${t.mode === 'monthly' || !t.mode ? 'selected' : ''}>On dates of every month</option>
            <option value="daily" ${t.mode === 'daily' ? 'selected' : ''}>Every working day</option>
            <option value="weekly" ${t.mode === 'weekly' ? 'selected' : ''}>Some days each week, on free days</option></select></label>
          <label>Starts<input type="time" name="start" value="${t.start}" step="300" required></label>
          <label>Ends<input type="time" name="end" value="${t.end}" step="300" required></label>
          <fieldset class="span" data-for="monthly"><legend>Dates of the month</legend><div class="daygrid">${dayBtns}</div></fieldset>
          <label data-for="weekly">Days per week<input type="number" name="perWeek" min="1" max="6" value="${t.perWeek || 2}"></label>
          <label data-for="monthly">If a date is a holiday<select name="holiday">
            <option value="shift" ${t.holiday !== 'skip' ? 'selected' : ''}>Move to the next working day</option>
            <option value="skip" ${t.holiday === 'skip' ? 'selected' : ''}>Skip that day</option></select></label>
          <fieldset class="span"><legend>Who does it</legend><div class="picks">${plan.people.map(p => `<label class="pick" style="--pc:${p.color}"><input type="checkbox" name="pp" value="${esc(p.id)}" ${Engine.normPeople(plan, t.people).includes(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('')}</div></fieldset>
          <label>Site visits from<select name="siteGroup"><option value="">Not a site run</option>${Object.keys(GROUPS).map(k => `<option value="${k}" ${t.siteGroup === k ? 'selected' : ''}>Each person's ${GROUPS[k].toLowerCase()}</option>`).join('')}</select></label>
          <label>Cycle name<input name="cycle" value="${esc(t.cycle || '')}" placeholder="C-1"></label>
          <label>Most days per person<input type="number" name="maxDays" min="0" max="31" value="${t.maxDays || ''}" placeholder="No limit"></label>
          <fieldset class="span"><legend>Companies covered</legend><div class="cgrid">${Object.keys(GROUPS).map(gk => `<div><b>${GROUPS[gk]}</b>${plan.companies.filter(c => c.group === gk).map(c => `<label class="check"><input type="checkbox" name="comp" value="${esc(c.id)}" ${(t.companies || []).includes(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div>`).join('')}</div></fieldset>
          <label class="span">Details<textarea name="details" rows="3">${esc(t.details || '')}</textarea></label></form>`,
        foot: `${!isNew ? `<button type="button" class="btn btn-ghost" id="t-dup">${icon('copy')}Duplicate</button><button type="button" class="btn btn-ghost danger" id="t-del">${icon('trash')}Delete task</button>` : ''}<span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="t-form" class="btn btn-primary">${isNew ? 'Add task' : 'Save task'}</button>`,
        onOpen: m => {
          const sync = () => { const mode = $('#t-mode', m).value; $$('[data-for]', m).forEach(el => el.hidden = el.dataset.for !== mode); };
          $('#t-mode', m).onchange = sync; sync();
          $('#t-form', m).onsubmit = e => {
            e.preventDefault(); const fd = new FormData(e.target);
            if (T.m(fd.get('end')) <= T.m(fd.get('start'))) { toast('The end time must be after the start time.'); return; }
            const nt = Object.assign(t, {
              title: fd.get('title'), type: fd.get('type'), mode: fd.get('mode'), start: fd.get('start'), end: fd.get('end'),
              days: fd.getAll('days').map(Number), perWeek: Number(fd.get('perWeek')) || 2, holiday: fd.get('holiday'),
              people: fd.getAll('pp'), siteGroup: fd.get('siteGroup') || undefined, cycle: fd.get('cycle') || undefined,
              maxDays: Number(fd.get('maxDays')) || undefined, companies: fd.getAll('comp'), details: fd.get('details')
            });
            if (nt.mode === 'monthly' && !nt.days.length) { toast('Pick at least one date of the month.'); return; }
            closeModal();
            App.commit(isNew ? `Added task ${nt.title}` : `Saved task ${nt.title}`, p => { const i = p.tasks.findIndex(x => x.id === nt.id); if (i >= 0) p.tasks[i] = nt; else p.tasks.push(nt); });
          };
          const dup = $('#t-dup', m); if (dup) dup.onclick = () => { closeModal(); const c = Store.clone(t); c.id = 't' + Date.now().toString(36); c.title += ' (copy)'; App.commit(`Duplicated ${t.title}`, p => p.tasks.push(c)); App.editTask(c.id); };
          const del = $('#t-del', m); if (del) del.onclick = () => UI.confirmBox('Delete this task?', `“${t.title}” and all its days will be removed from the timetable. You can undo this.`, 'Delete task', () => App.commit(`Deleted task ${t.title}`, p => { p.tasks = p.tasks.filter(x => x.id !== t.id); }), true);
        }
      });
    },

    editVisit(vkey) {
      const v = this.data.gen.visits.find(x => x.key === vkey); if (!v) return;
      const plan = Store.plan; const run = this.data.gen.occs.filter(o => o.runKey === v.runKey);
      modal({
        title: `Site day: ${this.cname(v.company)}`,
        body: `<p class="muted">${esc(this.task(v.taskId).title)}, run of ${esc(v.runKey.split('@')[1])}. Pick the day and the person who measures this company.</p>
          <form id="v-form" class="form-grid">
          <label>Day<select name="date">${run.map(o => `<option value="${o.date}" ${o.date === v.date ? 'selected' : ''}>${D.nice(o.date)}</option>`).join('')}</select></label>
          <label>Person<select name="person">${plan.people.map(p => `<option value="${esc(p.id)}" ${p.id === v.person ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></form>`,
        foot: `${plan.visitOverrides[vkey] ? '<button type="button" class="btn btn-ghost" id="v-reset">Back to automatic</button>' : ''}<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="v-form" class="btn btn-primary">Save site day</button>`,
        onOpen: m => {
          $('#v-form', m).onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); closeModal(); App.commit(`${this.cname(v.company)} site day set to ${D.nice(fd.get('date'))}`, p => { p.visitOverrides[vkey] = { date: fd.get('date'), person: fd.get('person') }; }); };
          const r = $('#v-reset', m); if (r) r.onclick = () => { closeModal(); App.commit('Site day back to automatic', p => { delete p.visitOverrides[vkey]; }); };
        }
      });
    }
  };

  function toggle(arr, v) { arr = (arr || []).slice(); const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); return arr; }

  /* Click, drag and sort handlers shared by every view */
  function bindCommon(root) {
    $$('[data-occ]', root).forEach(el => {
      el.addEventListener('click', e => { e.stopPropagation(); App.openOcc(el.dataset.occ); });
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ key: el.dataset.occ, from: el.dataset.fromPerson || null }));
        e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); document.body.classList.add('is-dragging');
      });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); document.body.classList.remove('is-dragging'); });
    });
    $$('[data-drop-date]', root).forEach(cell => {
      cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drop-on'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drop-on'));
      cell.addEventListener('drop', e => {
        e.preventDefault(); cell.classList.remove('drop-on');
        let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; }
        const date = cell.dataset.dropDate, to = cell.dataset.dropPerson;
        const o = App.data.byKey[d.key]; if (!o) return;
        if (to && d.from && to !== d.from) {
          if (date !== o.date) { toast('Drag across people within the same day to hand work over.'); return; }
          App.reassign(d.key, d.from, to);
        } else App.moveOcc(d.key, date);
      });
    });
    $$('[data-add-date]', root).forEach(b => b.addEventListener('click', e => { if (e.target.closest('[data-occ]')) return; App.addExtra(b.dataset.addDate, b.dataset.addPerson); }));
    $$('[data-go]', root).forEach(a => a.addEventListener('click', e => { e.preventDefault(); const [v, q] = a.dataset.go.split('?'); App.go(v, q ? Object.fromEntries(new URLSearchParams(q)) : null); }));
    $$('[data-edit-task]', root).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); App.editTask(b.dataset.editTask); }));
    $$('[data-visit]', root).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); App.editVisit(b.dataset.visit); }));
    $$('table.sortable', root).forEach(makeSortable);
    if ($('.filterbar', root)) App.bindFilters(root);
  }
  function makeSortable(table) {
    $$('th[data-sort]', table).forEach((th, idx) => {
      th.tabIndex = 0; th.setAttribute('role', 'button');
      const go = () => {
        const tb = table.tBodies[0]; const col = Array.from(th.parentNode.children).indexOf(th);
        const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
        $$('th', table).forEach(x => { delete x.dataset.dir; x.removeAttribute('aria-sort'); }); th.dataset.dir = dir; th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
        const rows = Array.from(tb.rows);
        const val = r => { const c = r.cells[col]; const v = c.dataset.v != null ? c.dataset.v : c.textContent.trim(); const n = parseFloat(v); return th.dataset.sort === 'num' ? (isNaN(n) ? -Infinity : n) : v.toLowerCase(); };
        rows.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'asc' ? 1 : -1); });
        rows.forEach(r => tb.appendChild(r));
      };
      th.onclick = go; th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    });
  }

  g.App = App;
})(window);
