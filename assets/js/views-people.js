/* Views: People, Companies, Meetings, Advance & billing day sheets, Daily review. */
(function () {
  'use strict';
  const { D, T } = Engine;
  const { esc, $, $$, icon, toast } = UI;
  const V = App.views;

  const weekLabel = ws => `${D.nice(ws, { short: true })} to ${D.nice(D.add(ws, 6), { short: true })}`;

  /* ---------------- People ---------------- */
  V.people = {
    title: 'People',
    render(p) {
      const plan = Store.plan, data = App.data, cap = data.stats.cap;
      const person = App.person(p.id) || plan.people[0];
      const s = data.stats.per[person.id];
      const mine = data.gen.occs.filter(o => o.people.includes(person.id));
      const r = plan.responsibilities[person.id] || {};
      const weeks = [...new Set(data.gen.dates.map(D.weekStart))];
      const months = [...new Set(data.gen.dates.map(D.month))];
      const wdIn = (from, to) => data.stats.workingDays.filter(d => d >= from && d <= to).length;
      const typeItems = Object.keys(App.TYPES).map(k => ({ label: App.TYPES[k].label, value: (s.byType[k] || 0) / 60, color: App.TYPES[k].color }));
      const byDay = {}; mine.forEach(o => { (byDay[o.date] = byDay[o.date] || []).push(o); });
      const tabs = plan.people.map(x => `<a href="#/people?id=${encodeURIComponent(x.id)}" class="ptab ${x.id === person.id ? 'on' : ''}" style="--pc:${x.color}" ${x.id === person.id ? 'aria-current="page"' : ''}><span class="avatar" style="--pc:${x.color}">${esc(x.id)}</span>${esc(x.name)}</a>`).join('');
      const compList = g => (r[g] || []).map(c => `<li>${esc(App.cname(c))}</li>`).join('') || '<li class="muted">None</li>';

      return `<section class="person-view" style="--pc:${person.color}">
        <nav class="ptabs" aria-label="Choose a person">${tabs}</nav>
        <header class="person-head">
          <span class="avatar xl" style="--pc:${person.color}">${esc(person.id)}</span>
          <div><h1>${esc(person.name)}${person.fullName ? ` <span class="full">${esc(person.fullName)}</span>` : ''}</h1><p class="lede">${esc(person.role || '')}</p></div>
          <div class="head-actions">
            <button type="button" class="btn btn-ghost" id="p-ics">${icon('calendar')}Add to phone calendar</button>
            <button type="button" class="btn btn-ghost" onclick="window.print()">${icon('print')}Print timetable</button>
          </div></header>
        <div class="kpis">
          <div class="kpi"><b>${T.hrs(s.booked)}</b><span>hours booked</span></div>
          <div class="kpi"><b>${Math.round(s.util * 100)}%</b><span>of office time used</span></div>
          <div class="kpi"><b>${s.daysWorked}</b><span>days with work</span></div>
          <div class="kpi"><b>${s.visits}</b><span>company site days</span></div>
          <div class="kpi"><b>${s.freeDays}</b><span>working days still free</span></div>
        </div>
        <div class="grid-2">
          <article class="panel"><h2>Hours per week</h2>
            ${UI.columns(weeks.map(w => D.nice(w, { short: true })), Object.keys(App.TYPES).map(k => ({ name: App.TYPES[k].label, color: App.TYPES[k].color, values: weeks.map(w => mine.filter(o => o.type === k && D.weekStart(o.date) === w).reduce((a, o) => a + o.mins, 0) / 60) })), { unit: 'h', label: 'Hours per week by kind of work' })}
          </article>
          <article class="panel"><h2>Kind of work</h2>${UI.donut(typeItems, { unit: 'h', center: T.hrs(s.mins), centerSub: 'hours of work' })}</article>
        </div>
        <div class="grid-2">
          <article class="panel"><h2>Time allotment</h2>
            <div class="hscroll"><table class="tbl sortable"><thead><tr><th data-sort="text">Week</th><th data-sort="num">Days</th><th data-sort="num">Hours</th><th data-sort="num">Office time</th><th data-sort="num">Used</th></tr></thead><tbody>
            ${weeks.map(w => { const h = (s.byWeek[w] || 0); const bk = Object.keys(s.byDate).filter(d => D.weekStart(d) === w).reduce((a, d) => a + s.byDate[d], 0); const c = wdIn(w, D.add(w, 6)) * cap; return `<tr><td data-v="${w}">${weekLabel(w)}</td><td>${Object.keys(byDay).filter(d => D.weekStart(d) === w).length}</td><td data-v="${bk}">${T.hrs(bk)}</td><td data-v="${c}">${T.hrs(c)}</td><td data-v="${c ? bk / c : 0}">${c ? Math.round(bk / c * 100) + '%' : '–'}</td></tr>`; }).join('')}
            </tbody><tfoot>${months.map(m => { const bk = Object.keys(s.byDate).filter(d => D.month(d) === m).reduce((a, d) => a + s.byDate[d], 0); const days = data.stats.workingDays.filter(d => D.month(d) === m).length; return `<tr><th>${D.MONTHS[Number(m.slice(5)) - 1]}</th><td>${Object.keys(byDay).filter(d => D.month(d) === m).length}</td><td>${T.hrs(bk)}</td><td>${T.hrs(days * cap)}</td><td>${days ? Math.round(bk / (days * cap) * 100) + '%' : '–'}</td></tr>`; }).join('')}
            <tr class="total"><th>Whole timetable</th><td>${s.daysWorked}</td><td>${T.hrs(s.booked)}</td><td>${T.hrs(s.capacity)}</td><td>${Math.round(s.util * 100)}%</td></tr></tfoot></table></div>
            <p class="muted small">Office time is ${T.hrs(cap)} hours a day (${T.nice(plan.settings.workStart)} to ${T.nice(plan.settings.workEnd)}, less lunch). Early meetings count as booked time, so a week can go above 100%.</p>
          </article>
          <article class="panel"><h2>Companies looked after</h2>
            <div class="resp"><div><h3 class="sub">Main contractors</h3><ul class="plain">${compList('main')}</ul></div>
            <div><h3 class="sub">Outstation</h3><ul class="plain">${compList('outstation')}</ul></div>
            <div><h3 class="sub">Other contractors</h3><ul class="plain">${compList('other')}</ul></div></div>
            ${r.duties ? `<h3 class="sub">Other duties</h3><p class="muted">${esc(r.duties)}</p>` : ''}
            <a class="more" href="#/plan?tab=resp">Change who looks after which company</a></article>
        </div>
        <article class="panel"><h2>Day by day</h2>
          <div class="daylist">${data.gen.dates.map(d => {
            const list = (byDay[d] || []).slice().sort((a, b) => T.m(a.start) - T.m(b.start));
            const hol = data.gen.hol[d];
            if (!list.length && (hol || D.dow(d) === 0)) return `<div class="dl-day off"><div class="dl-date"><b>${D.day(d)}</b><span>${D.DAYS[D.dow(d)].slice(0, 3)}</span></div><div class="muted">${esc(hol || 'Sunday')}</div></div>`;
            return `<div class="dl-day ${data.clashPD.has(person.id + '|' + d) ? 'is-clash' : ''}"><div class="dl-date"><a href="#/today?date=${d}"><b>${D.day(d)}</b><span>${D.DAYS[D.dow(d)].slice(0, 3)} ${D.MONTHS[D.parse(d).getUTCMonth()].slice(0, 3)}</span></a></div>
              <ul>${list.length ? list.map(o => `<li><span class="tnum">${o.start}–${o.end}</span> <button type="button" class="linkish" data-occ="${esc(o.key)}">${esc(App.personLabel(o, person.id))}</button> ${App.typeTag(o.type)}${o.status === 'done' ? ' <span class="done-pill">Done</span>' : ''}${o.note ? ` <span class="muted">${esc(o.note)}</span>` : ''}</li>`).join('') : '<li class="muted">Free <button type="button" class="linkish" data-add-date="' + d + '" data-add-person="' + esc(person.id) + '">Add work</button></li>'}</ul>
              <div class="dl-h">${s.byDate[d] ? T.hrs(s.byDate[d]) + ' h' : ''}</div></div>`;
          }).join('')}</div></article>
      </section>`;
    },
    mount(root, p) {
      const person = App.person(p.id) || Store.plan.people[0];
      $('#p-ics', root).onclick = () => {
        const evs = App.data.gen.occs.filter(o => o.people.includes(person.id)).map(o => ({ uid: o.key.replace(/[^a-z0-9]/gi, '') + person.id, date: o.date, start: o.start, end: o.end, title: App.personLabel(o, person.id), desc: o.details }));
        IO.download(IO.ics(evs, `Timetable ${person.name}`), `timetable-${person.id}.ics`);
        toast(`Calendar file for ${person.name} downloaded. Open it on the phone to add the events.`);
      };
    }
  };

  /* ---------------- Companies ---------------- */
  V.companies = {
    title: 'Companies',
    render(p) {
      const plan = Store.plan, data = App.data, dates = data.gen.dates;
      const grp = p.group || 'all';
      const comps = plan.companies.filter(c => grp === 'all' || c.group === grp);
      const vBy = {}; data.gen.visits.forEach(v => { (vBy[v.company + '|' + v.date] = vBy[v.company + '|' + v.date] || []).push(v); });
      const mark = (c, d) => {
        const vs = vBy[c.id + '|' + d] || [];
        const os = (data.byDate[d] || []).filter(o => !o.siteGroup && o.companies.includes(c.id) && o.type !== 'review');
        let h = vs.map(v => `<button type="button" class="vmark" style="--pc:${App.pcolor(v.person)}" data-visit="${esc(v.key)}" title="Site day: ${esc(c.name)} by ${esc(App.pname(v.person))}. Click to change.">${esc(App.person(v.person) ? App.person(v.person).id : v.person)}</button>`).join('');
        h += os.map(o => `<button type="button" class="omark t-${o.type}" style="--c:${App.TYPES[o.type].color}" data-occ="${esc(o.key)}" title="${esc(o.title)}">${o.type === 'advance' ? 'A' : o.type === 'billing' ? 'B' : o.type === 'meeting' ? 'M' : '•'}</button>`).join('');
        return h;
      };
      const rowsHtml = Object.keys(App.GROUPS).filter(gk => grp === 'all' || gk === grp).map(gk => {
        const list = comps.filter(c => c.group === gk);
        if (!list.length) return '';
        return `<tr class="grp"><th colspan="${dates.length + 2}">${App.GROUPS[gk]}</th></tr>` + list.map(c => {
          const vs = data.gen.visits.filter(v => v.company === c.id);
          const owner = plan.people.find(x => (plan.responsibilities[x.id] && plan.responsibilities[x.id][c.group] || []).includes(c.id));
          return `<tr><th scope="row" class="c-name">${esc(c.name)}<small>${owner ? esc(owner.name) : 'Nobody assigned'}</small></th><td class="c-n" data-v="${vs.length}">${vs.length}</td>${dates.map(d => `<td class="${data.gen.hol[d] ? 'hol' : ''} ${D.dow(d) === 0 ? 'sun' : ''}">${mark(c, d)}</td>`).join('')}</tr>`;
        }).join('');
      }).join('');
      const sameDay = [];
      Object.keys(vBy).forEach(k => { if (vBy[k].length > 1) sameDay.push(k); });
      const crowded = {}; data.gen.visits.forEach(v => { const k = v.person + '|' + v.date; crowded[k] = (crowded[k] || 0) + 1; });
      const crowd = Object.keys(crowded).filter(k => crowded[k] > 1);
      const unvisited = plan.companies.filter(c => !data.gen.visits.some(v => v.company === c.id));
      return `<section><header class="vhead"><h1>Companies</h1>
        <p class="lede">Each company gets its own site day in every measurement run. Letters are the person on site; A, B and M mark advance, billing and meeting days. Click a site day to change the day or the person.</p></header>
        <div class="seg big" role="group" aria-label="Company group">${['all', ...Object.keys(App.GROUPS)].map(k => `<button type="button" data-go="companies?group=${k}" class="${grp === k ? 'on' : ''}">${k === 'all' ? 'All companies' : App.GROUPS[k]}</button>`).join('')}</div>
        <div class="hscroll comp-wrap" tabindex="0" aria-label="Company site days, scroll sideways"><table class="cmatrix"><thead><tr><th class="c-corner">Company</th><th class="c-n" title="Site days">Days</th>${dates.map(d => `<th class="${data.gen.hol[d] ? 'hol' : ''} ${D.dow(d) === 0 ? 'sun' : ''}"><span>${D.DAYS[D.dow(d)].slice(0, 2)}</span><b>${D.day(d)}</b></th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
        <div class="grid-3">
          <article class="panel"><h2>Site days per company</h2>${UI.hbars(plan.companies.filter(c => grp === 'all' || c.group === grp).map(c => ({ label: c.name, segs: plan.people.map(pp => ({ label: pp.name, value: data.gen.visits.filter(v => v.company === c.id && v.person === pp.id).length, color: pp.color })) })).sort((a, b) => b.segs.reduce((s, x) => s + x.value, 0) - a.segs.reduce((s, x) => s + x.value, 0)), { unit: 'days', label: 'Site days per company' })}</article>
          <article class="panel"><h2>Checks</h2><ul class="issue-list">
            ${sameDay.map(k => { const [c, d] = k.split('|'); return `<li class="lvl-warn">${esc(App.cname(c))} has ${vBy[k].length} people on site on ${D.nice(d)}.</li>`; }).join('')}
            ${crowd.map(k => { const [pid, d] = k.split('|'); return `<li class="lvl-warn">${esc(App.pname(pid))} has ${crowded[k]} companies on ${D.nice(d)}.</li>`; }).join('')}
            ${unvisited.map(c => `<li class="lvl-info">${esc(c.name)} has no site day in this timetable.</li>`).join('')}
            ${!sameDay.length && !crowd.length && !unvisited.length ? '<li class="lvl-ok">Every company has its own separate site days.</li>' : ''}</ul></article>
          <article class="panel"><h2>Company dates</h2>
            <label class="field">Company<select id="c-pick">${plan.companies.map(c => `<option value="${esc(c.id)}" ${p.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <div id="c-detail"></div></article>
        </div></section>`;
    },
    mount(root, p) {
      const pick = $('#c-pick', root);
      const show = () => {
        const cid = pick.value, data = App.data;
        const vs = data.gen.visits.filter(v => v.company === cid);
        const os = data.gen.occs.filter(o => !o.siteGroup && o.companies.includes(cid) && o.type !== 'review');
        $('#c-detail', root).innerHTML = `<ul class="upcoming">${vs.map(v => `<li><button type="button" class="linkish" data-visit="${esc(v.key)}">Site day, ${esc(v.cycle)}</button><span class="muted">${D.nice(v.date)}, ${esc(App.pname(v.person))}</span></li>`).join('')}
          ${os.map(o => `<li><button type="button" class="linkish" data-occ="${esc(o.key)}">${esc(o.title)}</button><span class="muted">${D.nice(o.date)}, ${o.start}</span></li>`).join('') || ''}</ul>`;
        $$('#c-detail [data-visit]', root).forEach(b => b.onclick = () => App.editVisit(b.dataset.visit));
        $$('#c-detail [data-occ]', root).forEach(b => b.onclick = () => App.openOcc(b.dataset.occ));
      };
      pick.onchange = show; show();
    }
  };

  /* ---------------- Meetings ---------------- */
  V.meetings = {
    title: 'Meetings',
    render() {
      const plan = Store.plan, data = App.data;
      const tasks = plan.tasks.filter(t => t.type === 'meeting');
      return `<section><header class="vhead"><h1>Meetings</h1>
        <p class="lede">Joint meetings with their agenda. Give every item its minutes; the bar shows whether the agenda fits the meeting slot.</p></header>
        <div class="meet-list">${tasks.map(t => {
          const occs = data.gen.occs.filter(o => o.taskId === t.id);
          const slot = T.m(t.end) - T.m(t.start);
          const ag = t.agenda || [];
          const used = ag.reduce((s, a) => s + (Number(a.minutes) || 0), 0);
          let cur = T.m(t.start);
          return `<article class="panel meet" data-task="${esc(t.id)}">
            <header class="meet-head"><div><h2>${esc(t.title)}</h2>
              <p class="muted">Dates ${(t.days || []).join(', ')} of each month, ${t.start} to ${t.end}. In this timetable: ${occs.map(o => `<button type="button" class="linkish" data-occ="${esc(o.key)}">${D.nice(o.date)}</button>`).join(', ') || 'none'}</p></div>
              <button type="button" class="btn btn-ghost btn-sm" data-edit-task="${esc(t.id)}">${icon('edit')}Time and people</button></header>
            <div class="fit ${used > slot ? 'over' : ''}"><span style="width:${Math.min(100, used / slot * 100)}%"></span></div>
            <p class="fit-t">${used} of ${slot} minutes planned${used > slot ? `, ${used - slot} minutes too many` : used < slot ? `, ${slot - used} minutes spare` : ''}.</p>
            <table class="tbl agenda"><thead><tr><th>Time</th><th>Agenda item</th><th>Minutes</th><th>Leads</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
            ${ag.map((a, i) => { const s = T.s(cur); cur += Number(a.minutes) || 0; return `<tr data-i="${i}"><td class="tnum">${s}</td><td><input data-f="item" value="${esc(a.item)}" aria-label="Agenda item"></td><td><input data-f="minutes" type="number" min="0" max="240" value="${a.minutes}" aria-label="Minutes" class="num"></td>
              <td><select data-f="owner" aria-label="Leads">${plan.people.map(pp => `<option value="${esc(pp.id)}" ${pp.id === a.owner ? 'selected' : ''}>${esc(pp.name)}</option>`).join('')}</select></td>
              <td class="row-acts"><button type="button" class="icon-btn" data-mv="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="icon-btn" data-mv="1" aria-label="Move down" ${i === ag.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="icon-btn" data-rm aria-label="Remove item">${icon('x')}</button></td></tr>`; }).join('')}
            </tbody></table>
            <div class="meet-foot"><button type="button" class="btn btn-ghost btn-sm" data-add-item>${icon('plus')}Add agenda item</button><button type="button" class="btn btn-ghost btn-sm" data-fit>Fit to the slot</button></div>
          </article>`;
        }).join('')}</div></section>`;
    },
    mount(root) {
      $$('.meet', root).forEach(card => {
        const id = card.dataset.task;
        const save = (label, fn) => App.commit(label, p => { const t = p.tasks.find(x => x.id === id); t.agenda = t.agenda || []; fn(t.agenda, t); });
        $$('tr[data-i]', card).forEach(tr => {
          const i = Number(tr.dataset.i);
          $$('[data-f]', tr).forEach(inp => inp.onchange = () => save('Agenda updated', ag => { ag[i][inp.dataset.f] = inp.dataset.f === 'minutes' ? Number(inp.value) : inp.value; }));
          $$('[data-mv]', tr).forEach(b => b.onclick = () => save('Agenda reordered', ag => { const j = i + Number(b.dataset.mv); [ag[i], ag[j]] = [ag[j], ag[i]]; }));
          $('[data-rm]', tr).onclick = () => save('Agenda item removed', ag => ag.splice(i, 1));
        });
        $('[data-add-item]', card).onclick = () => save('Agenda item added', ag => ag.push({ item: 'New item', minutes: 10, owner: 'B' }));
        $('[data-fit]', card).onclick = () => save('Agenda fitted to the slot', (ag, t) => {
          const slot = T.m(t.end) - T.m(t.start); const tot = ag.reduce((s, a) => s + (Number(a.minutes) || 0), 0) || 1;
          // Scale to the slot in 5-minute steps, largest remainders first, at least 5 minutes each
          const raw = ag.map(a => Math.max(0, Number(a.minutes) || 0) / tot * slot);
          const base = raw.map(r => Math.max(5, Math.floor(r / 5) * 5));
          let left = slot - base.reduce((s, x) => s + x, 0);
          const order = raw.map((r, k) => [r - base[k], k]).sort((x, y) => y[0] - x[0]);
          for (let n = 0; left >= 5 && n < 200; n++) { base[order[n % order.length][1]] += 5; left -= 5; }
          for (let k = base.length - 1; left < 0 && k >= 0; k--) { while (left < 0 && base[k] > 5) { base[k] -= 5; left += 5; } }
          ag.forEach((a, k) => { a.minutes = base[k]; });
        });
      });
    }
  };

  /* ---------------- Advance & billing day sheets ---------------- */
  V.paydays = {
    title: 'Advance and billing days',
    render(p) {
      const plan = Store.plan, data = App.data;
      const days = data.gen.occs.filter(o => o.type === 'advance' || o.type === 'billing');
      const sel = p.date ? days.filter(o => o.date === p.date) : [];
      const show = sel.length ? sel : days;
      const checks = plan.reviews.pay || {};
      return `<section><header class="vhead"><h1>Advance and billing days</h1>
        <p class="lede">A time-slotted sheet for every advance payment day and billing day of P1 and B. Each company gets a slot; tick it off when it is done.</p></header>
        <div class="seg big" role="group" aria-label="Choose a day"><button type="button" data-go="paydays" class="${!sel.length ? 'on' : ''}">All days</button>${days.map(o => `<button type="button" data-go="paydays?date=${o.date}" class="${p.date === o.date ? 'on' : ''}">${esc(o.title.split(' ')[0])}, ${D.nice(o.date, { short: true })}</button>`).join('')}</div>
        ${show.map(o => {
          const t = App.task(o.taskId) || {};
          const steps = o.type === 'advance' ? ['Measurement checking', 'Rate check', 'Linking to PO file', 'Advances filling', 'Asset codes checking', 'Emailing'] : ['Bill checking', 'Rate check', 'Formatting', 'Advances', 'Asset codes', 'Tally billing (P1)', 'B checks the billing sheet'];
          const rows = Engine.slotPlan(plan, o, steps);
          const done = rows.filter(r => checks[o.key + '|' + r.company]).length;
          return `<article class="panel sheet">
            <header class="meet-head"><div><h2>${esc(o.title)}: ${D.nice(o.date, { long: true })}</h2>
              <p class="muted">${o.start} to ${o.end}, ${o.people.map(x => esc(App.pname(x))).join(' and ')}. ${done} of ${rows.length} companies done.${o.shifted ? ` Moved from ${D.nice(o.planned)} because of a holiday.` : ''}</p></div>
              <button type="button" class="btn btn-ghost btn-sm" data-occ="${esc(o.key)}">${icon('edit')}Change day or time</button></header>
            <div class="fit"><span style="width:${rows.length ? done / rows.length * 100 : 0}%"></span></div>
            <table class="tbl"><thead><tr><th>Done</th><th>Time</th><th>Company</th><th>Steps</th></tr></thead><tbody>
            ${rows.map(r => `<tr class="${checks[o.key + '|' + r.company] ? 'row-done' : ''}"><td><input type="checkbox" data-pay="${esc(o.key + '|' + r.company)}" ${checks[o.key + '|' + r.company] ? 'checked' : ''} aria-label="Done: ${esc(App.cname(r.company))}"></td><td class="tnum">${r.start}–${r.end}${Engine.T.m(r.start) < Engine.T.m(plan.settings.lunchStart) && Engine.T.m(r.end) > Engine.T.m(plan.settings.lunchEnd) ? '<small class="muted"> with lunch</small>' : ''}</td><td><b>${esc(r.company === 'general' ? 'All works' : App.cname(r.company))}</b></td><td class="muted">${r.steps.join(', ')}</td></tr>`).join('')}
            </tbody></table>
            ${t.details ? `<p class="muted small">${esc(t.details)}</p>` : ''}</article>`;
        }).join('') || '<p class="empty">There are no advance or billing days in this timetable. Add them in the Plan.</p>'}
      </section>`;
    },
    mount(root) {
      $$('[data-pay]', root).forEach(c => c.onchange = () => {
        const pl = Store.plan; pl.reviews.pay = pl.reviews.pay || {};
        if (c.checked) pl.reviews.pay[c.dataset.pay] = true; else delete pl.reviews.pay[c.dataset.pay];
        Store.save(true); App.keepScroll = true; App.render();
      });
    }
  };

  /* ---------------- Daily review for B ---------------- */
  V.review = {
    title: 'Daily review',
    render(p) {
      const plan = Store.plan, st = plan.settings, data = App.data;
      const date = p.date && p.date >= st.start && p.date <= st.end ? p.date : App.defaultDate();
      const occs = (data.byDate[date] || []).filter(o => o.type !== 'review');
      const rv = (plan.reviews.days || {})[date] || {};
      const items = [];
      plan.people.filter(x => x.id !== 'B').concat(plan.people.filter(x => x.id === 'B')).forEach(person => {
        const mine = occs.filter(o => o.people.includes(person.id));
        const list = [];
        mine.forEach(o => {
          const lab = App.personLabel(o, person.id);
          list.push({ id: `${person.id}|${o.key}|done`, text: `${lab}: done as planned (${o.start}–${o.end})` });
          const vs = o.siteGroup ? App.visitsFor(o, person.id) : [];
          vs.forEach(v => list.push({ id: `${person.id}|${v.key}|sheet`, text: `Measurement sheet of ${App.cname(v.company)} received` }));
          if (o.siteGroup && !vs.length) list.push({ id: `${person.id}|${o.key}|cement`, text: 'Sheets prepared and cement calculation updated' });
          if (o.type === 'billing') list.push({ id: `${person.id}|${o.key}|bill`, text: 'Billing sheets checked after P1 and recorded' });
          if (o.type === 'advance') list.push({ id: `${person.id}|${o.key}|adv`, text: 'Advances filled, linked to PO file and emailed' });
          if (o.type === 'meeting') list.push({ id: `${person.id}|${o.key}|mins`, text: 'Action points from the meeting noted' });
        });
        if (person.id === 'B') ['Asset names recorded', 'Status of estimation updated', 'Credit balance sheet updated', 'Payment recommendations sent', 'Timetable updated for tomorrow'].forEach((t, i) => list.push({ id: `B|daily|${i}`, text: t }));
        items.push({ person, list, mine });
      });
      const all = items.flatMap(x => x.list);
      const done = all.filter(i => rv[i.id]).length;
      const tomorrow = data.stats.workingDays.find(d => d > date);
      const tmr = tomorrow ? (data.byDate[tomorrow] || []).filter(o => o.type !== 'review') : [];
      return `<section><header class="vhead row"><div><h1>Daily review</h1>
        <p class="lede">B's quick check of everyone's work at the end of ${D.nice(date, { long: true })}.</p></div>${V._dateNav('review', date)}</header>
        <div class="review-top"><div class="fit big"><span style="width:${all.length ? done / all.length * 100 : 0}%"></span></div><p class="fit-t">${done} of ${all.length} checks done.</p></div>
        <div class="review-grid">${items.map(({ person, list }) => `<article class="panel rv" style="--pc:${person.color}">
          <h2><span class="avatar" style="--pc:${person.color}">${esc(person.id)}</span>${esc(person.name)}</h2>
          ${list.length ? `<ul class="checks">${list.map(i => `<li><label class="check"><input type="checkbox" data-rv="${esc(i.id)}" ${rv[i.id] ? 'checked' : ''}> <span>${esc(i.text)}</span></label></li>`).join('')}</ul>` : '<p class="muted">Nothing booked for this day.</p>'}
        </article>`).join('')}</div>
        <div class="grid-2">
          <article class="panel"><h2>Notes for the day</h2><textarea id="rv-note" rows="4" placeholder="Anything to follow up tomorrow">${esc(rv._note || '')}</textarea></article>
          <article class="panel"><h2>Next working day${tomorrow ? `: ${D.nice(tomorrow)}` : ''}</h2><ul class="upcoming">${tmr.map(o => `<li><button type="button" class="linkish" data-occ="${esc(o.key)}">${esc(o.title)}</button><span class="muted">${o.start}, ${o.people.map(x => esc(App.person(x) ? App.person(x).id : x)).join(', ')}</span></li>`).join('') || '<li class="muted">Nothing planned.</li>'}</ul></article>
        </div></section>`;
    },
    mount(root, p) {
      V._bindDatePick(root);
      const date = (p.date && p.date >= Store.plan.settings.start && p.date <= Store.plan.settings.end) ? p.date : App.defaultDate();
      const bucket = () => { const pl = Store.plan; pl.reviews.days = pl.reviews.days || {}; return (pl.reviews.days[date] = pl.reviews.days[date] || {}); };
      $$('[data-rv]', root).forEach(c => c.onchange = () => { const b = bucket(); if (c.checked) b[c.dataset.rv] = true; else delete b[c.dataset.rv]; Store.save(true); App.keepScroll = true; App.render(); });
      let t; $('#rv-note', root).oninput = e => { clearTimeout(t); t = setTimeout(() => { bucket()._note = e.target.value; Store.save(true); }, 400); };
    }
  };
})();
