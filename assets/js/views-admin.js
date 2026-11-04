/* Views: Plan editor, Insights, Clashes, Settings & data. Plus Excel export. */
(function () {
  'use strict';
  const { D, T } = Engine;
  const { esc, $, $$, icon, toast, modal, closeModal } = UI;
  const V = App.views;

  function repeatText(t) {
    if (t.mode === 'daily') return 'Every working day';
    if (t.mode === 'weekly') return `${t.perWeek || 1} day${(t.perWeek || 1) > 1 ? 's' : ''} a week`;
    const d = (t.days || []).slice().sort((a, b) => a - b);
    const runs = []; d.forEach(x => { const l = runs[runs.length - 1]; if (l && x === l[1] + 1) l[1] = x; else runs.push([x, x]); });
    return 'Dates ' + runs.map(r => r[0] === r[1] ? r[0] : `${r[0]}–${r[1]}`).join(', ');
  }

  /* ---------------- Plan ---------------- */
  V.plan = {
    title: 'Plan',
    render(p) {
      const plan = Store.plan, data = App.data;
      const tab = p.tab || 'tasks';
      const tabs = [['tasks', 'Tasks'], ['resp', 'Who looks after which company'], ['oneoff', 'One-day work'], ['excel', 'From the Excel sheet']];
      let body = '';
      if (tab === 'tasks') {
        body = `<div class="toolbar"><input type="search" id="task-q" placeholder="Find a task" aria-label="Find a task">
          <button type="button" class="btn btn-primary" id="new-task">${icon('plus')}New task</button></div>
          <div class="hscroll"><table class="tbl sortable tasks" id="task-table"><thead><tr><th data-sort="text">Task</th><th data-sort="text">Kind</th><th data-sort="text">Repeats</th><th data-sort="text">Time</th><th data-sort="num">Hours a day</th><th data-sort="text">People</th><th data-sort="num">Days booked</th><th data-sort="num">Total hours</th></tr></thead><tbody>
          ${plan.tasks.map(t => { const os = data.gen.occs.filter(o => o.taskId === t.id); const mins = os.reduce((s, o) => s + o.mins * o.people.length, 0); return `<tr data-row-task="${esc(t.id)}" tabindex="0">
            <td><b>${esc(t.title)}</b>${t.details ? `<small>${esc(t.details.slice(0, 90))}${t.details.length > 90 ? '…' : ''}</small>` : ''}</td><td data-v="${t.type}">${App.typeTag(t.type)}</td><td data-v="${(t.days || [0])[0]}">${esc(repeatText(t))}</td><td class="tnum">${t.start}–${t.end}</td>
            <td data-v="${Engine.workMins(t.start, t.end, plan.settings)}">${T.hrs(Engine.workMins(t.start, t.end, plan.settings))}</td><td data-v="${Engine.normPeople(plan, t.people).join('')}">${Engine.normPeople(plan, t.people).map(x => App.personTag(x)).join('')}</td><td>${os.length}</td><td data-v="${mins}">${T.hrs(mins)}</td></tr>`; }).join('')}
          </tbody></table></div><p class="muted small">Total hours count each person separately. Click a row to change the task; the timetable updates straight away.</p>`;
      } else if (tab === 'resp') {
        body = `<p class="lede">Pick the person who measures each company. Site days are shared out again automatically.</p>
          <div class="hscroll"><table class="tbl resp-tbl"><thead><tr><th>Company</th>${plan.people.map(x => `<th class="c">${App.personTag(x.id)}</th>`).join('')}<th class="c">Nobody</th></tr></thead><tbody>
          ${Object.keys(App.GROUPS).map(gk => `<tr class="grp"><th colspan="${plan.people.length + 2}">${App.GROUPS[gk]}</th></tr>` + plan.companies.filter(c => c.group === gk).map(c => {
            const owner = plan.people.find(x => ((plan.responsibilities[x.id] || {})[gk] || []).includes(c.id));
            return `<tr><th scope="row">${esc(c.name)}</th>${plan.people.map(x => `<td class="c"><input type="radio" name="r-${esc(c.id)}" value="${esc(x.id)}" data-resp="${esc(c.id)}" ${owner && owner.id === x.id ? 'checked' : ''} aria-label="${esc(x.name)} looks after ${esc(c.name)}"></td>`).join('')}<td class="c"><input type="radio" name="r-${esc(c.id)}" value="" data-resp="${esc(c.id)}" ${!owner ? 'checked' : ''} aria-label="Nobody looks after ${esc(c.name)}"></td></tr>`;
          }).join('')).join('')}</tbody></table></div>
          <h2 class="h2">Other duties</h2><div class="duties">${plan.people.map(x => `<label class="field">${App.personTag(x.id)}<textarea data-duty="${esc(x.id)}" rows="3">${esc((plan.responsibilities[x.id] || {}).duties || '')}</textarea></label>`).join('')}</div>`;
      } else if (tab === 'oneoff') {
        body = `<div class="toolbar"><button type="button" class="btn btn-primary" data-add-date="${App.defaultDate()}">${icon('plus')}Add work for one day</button></div>
          ${plan.extra.length ? `<table class="tbl sortable"><thead><tr><th data-sort="text">Date</th><th data-sort="text">Work</th><th data-sort="text">Time</th><th data-sort="text">People</th></tr></thead><tbody>${plan.extra.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(x => `<tr><td data-v="${x.date}">${D.nice(x.date)}</td><td><button type="button" class="linkish" data-occ="x:${esc(x.id)}">${esc(x.title)}</button></td><td class="tnum">${x.start}–${x.end}</td><td>${(x.people || []).map(pp => App.personTag(pp)).join('')}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">No one-day work yet. Use it for bank visits, extra site checks or leave cover.</p>'}
          <h2 class="h2">Days changed by hand</h2>
          ${Object.keys(plan.overrides).length ? `<table class="tbl"><thead><tr><th>Work</th><th>Planned</th><th>Change</th><th></th></tr></thead><tbody>${Object.keys(plan.overrides).map(k => { const ov = plan.overrides[k]; const t = App.task(k.split('@')[0]); const planned = k.split('@')[1].split('#')[0]; return `<tr><td>${esc(t ? t.title : k)}</td><td>${D.nice(planned)}</td><td>${ov.deleted ? 'Cancelled' : [ov.date ? 'moved to ' + D.nice(ov.date) : '', ov.people ? 'people: ' + ov.people.join(', ') : '', ov.start ? ov.start + '–' + (ov.end || '') : '', ov.title ? 'renamed' : '', ov.note ? 'note' : ''].filter(Boolean).join(', ')}</td><td><button type="button" class="btn btn-ghost btn-sm" data-unov="${esc(k)}">Back to plan</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">No day has been changed by hand.</p>'}`;
      } else {
        body = `<p class="lede">The instructions written in the planning sheet. The default timetable follows them.</p><ol class="excel-notes">${plan.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ol>
          <h2 class="h2">Responsibilities as written</h2><table class="tbl"><thead><tr><th>Person</th><th>Main contractors</th><th>Outstation</th><th>Other contractors</th></tr></thead><tbody>
          ${plan.people.map(x => { const r = plan.responsibilities[x.id] || {}; return `<tr><th>${App.personTag(x.id)}</th>${['main', 'outstation', 'other'].map(gk => `<td>${(r[gk] || []).map(c => esc(App.cname(c))).join(', ') || '<span class="muted">–</span>'}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
      }
      return `<section><header class="vhead"><h1>Plan</h1><p class="lede">The monthly pattern behind the timetable. Change a task here and every day it repeats on changes with it.</p></header>
        <nav class="tabs" aria-label="Plan sections">${tabs.map(([k, l]) => `<a href="#/plan?tab=${k}" class="${tab === k ? 'on' : ''}" ${tab === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>${body}</section>`;
    },
    mount(root) {
      const nt = $('#new-task', root); if (nt) nt.onclick = () => App.editTask(null);
      $$('[data-row-task]', root).forEach(r => { r.onclick = () => App.editTask(r.dataset.rowTask); r.onkeydown = e => { if (e.key === 'Enter') App.editTask(r.dataset.rowTask); }; });
      const q = $('#task-q', root); if (q) q.oninput = () => { const v = q.value.toLowerCase(); $$('#task-table tbody tr', root).forEach(r => { r.hidden = !r.textContent.toLowerCase().includes(v); }); };
      $$('[data-resp]', root).forEach(rd => rd.onchange = () => {
        const cid = rd.dataset.resp; const c = Store.plan.companies.find(x => x.id === cid);
        App.commit(`${c.name} now with ${rd.value ? App.pname(rd.value) : 'nobody'}`, p => {
          Object.values(p.responsibilities).forEach(r => { r[c.group] = (r[c.group] || []).filter(x => x !== cid); });
          if (rd.value) { const r = p.responsibilities[rd.value]; r[c.group] = (r[c.group] || []).concat(cid); }
        });
      });
      $$('[data-duty]', root).forEach(ta => ta.onchange = () => App.commit('Duties saved', p => { p.responsibilities[ta.dataset.duty].duties = ta.value; }));
      $$('[data-unov]', root).forEach(b => b.onclick = () => App.commit('Back to the plan', p => { delete p.overrides[b.dataset.unov]; }));
    }
  };

  /* ---------------- Insights ---------------- */
  V.insights = {
    title: 'Insights',
    render(p) {
      const plan = Store.plan, data = App.data;
      const weeks = [...new Set(data.gen.dates.map(D.weekStart))];
      const months = [...new Set(data.gen.dates.map(D.month))];
      const scope = p.scope || 'all';
      let from = plan.settings.start, to = plan.settings.end;
      if (scope.startsWith('m:')) { const m = scope.slice(2); from = [m + '-01', from].sort()[1]; to = [D.add(m + '-01', D.monthLen(+m.slice(0, 4), +m.slice(5)) - 1), to].sort()[0]; }
      if (scope.startsWith('w:')) { const w = scope.slice(2); from = [w, from].sort()[1]; to = [D.add(w, 6), to].sort()[0]; }
      const gen = Object.assign({}, data.gen, { occs: data.gen.occs.filter(o => o.date >= from && o.date <= to), visits: data.gen.visits.filter(v => v.date >= from && v.date <= to), dates: data.gen.dates.filter(d => d >= from && d <= to) });
      const S = Engine.stats(plan, gen); const cap = S.cap;
      const iss = Engine.issues(plan, gen).filter(i => i.level === 'clash');
      const people = plan.people;
      const per = people.map(x => S.per[x.id]);
      const totalBooked = per.reduce((s, x) => s + x.booked, 0);
      const totalCap = per.reduce((s, x) => s + x.capacity, 0);
      const desc = S.summary;
      const balance = desc.cv < 0.1 ? 'Work is spread evenly.' : desc.cv < 0.2 ? 'Work is spread fairly evenly.' : desc.cv < 0.35 ? 'Some people carry noticeably more work than others.' : 'Work is very unevenly spread.';
      const busiest = per.slice().sort((a, b) => b.booked - a.booked)[0];
      const lightest = per.slice().sort((a, b) => a.booked - b.booked)[0];
      const typeTotals = Object.keys(App.TYPES).map(k => ({ label: App.TYPES[k].label, value: gen.occs.filter(o => o.type === k).reduce((s, o) => s + o.mins * o.people.length, 0) / 60, color: App.TYPES[k].color }));
      const compRows = plan.companies.map(c => ({ label: c.name, segs: people.map(x => ({ label: x.name, value: (S.per[x.id].byCompany[c.id] || 0) / 60, color: x.color })) }))
        .filter(r => r.segs.some(s => s.value > 0)).sort((a, b) => b.segs.reduce((s, x) => s + x.value, 0) - a.segs.reduce((s, x) => s + x.value, 0));
      const wkIn = weeks.filter(w => D.add(w, 6) >= from && w <= to);
      const dows = [1, 2, 3, 4, 5, 6, 0];
      const scopeSel = `<select id="scope" aria-label="Period"><option value="all" ${scope === 'all' ? 'selected' : ''}>Whole timetable</option>${months.map(m => `<option value="m:${m}" ${scope === 'm:' + m ? 'selected' : ''}>${D.MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</option>`).join('')}${weeks.map(w => `<option value="w:${w}" ${scope === 'w:' + w ? 'selected' : ''}>Week of ${D.nice(w, { short: true })}</option>`).join('')}</select>`;
      const heat = `<div class="hscroll"><table class="heat"><thead><tr><th></th>${gen.dates.map(d => `<th class="${gen.hol[d] ? 'hol' : ''} ${D.dow(d) === 0 ? 'sun' : ''}"><span>${D.DAYS[D.dow(d)][0]}</span>${D.day(d)}</th>`).join('')}</tr></thead><tbody>
        ${people.map(x => `<tr><th>${App.personTag(x.id)}</th>${gen.dates.map(d => { const m = S.per[x.id].byDate[d] || 0; const r = Math.min(1.25, m / cap); const cl = data.clashPD.has(x.id + '|' + d); return `<td class="${cl ? 'is-clash' : ''} ${gen.hol[d] ? 'hol' : ''} ${r > 0.62 ? 'hi' : ''}" style="--h:${r};--pc:${x.color}" title="${esc(x.name)}, ${D.nice(d)}: ${T.hrs(m)} h${cl ? ', clash' : ''}"><a href="#/today?date=${d}">${m ? T.hrs(m) : ''}</a></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
      return `<section><header class="vhead row"><div><h1>Insights</h1><p class="lede">Who carries how much work, and where the time goes.</p></div><label class="field inline">Period ${scopeSel}</label></header>
        <div class="kpis">
          <div class="kpi"><b>${T.hrs(totalBooked)}</b><span>hours booked for ${people.length} people</span></div>
          <div class="kpi"><b>${totalCap ? Math.round(totalBooked / totalCap * 100) : 0}%</b><span>of office time used</span></div>
          <div class="kpi"><b>${S.workingDays.length}</b><span>working days</span></div>
          <div class="kpi ${iss.length ? 'bad' : ''}"><b>${iss.length}</b><span>clashes</span></div>
          <div class="kpi"><b>${Math.round(desc.cv * 100)}%</b><span>difference in workload between people</span></div>
        </div>
        <p class="reading">${balance} ${busiest ? `${esc(App.pname(busiest.id))} has the most booked time (${T.hrs(busiest.booked)} h), ${esc(App.pname(lightest.id))} the least (${T.hrs(lightest.booked)} h).` : ''}</p>
        <div class="grid-2">
          <article class="panel"><h2>Hours per person</h2>${UI.hbars(people.map(x => ({ label: x.name, dot: x.color, segs: Object.keys(App.TYPES).map(k => ({ label: App.TYPES[k].label, value: (S.per[x.id].byType[k] || 0) / 60, color: App.TYPES[k].color })) })), { unit: 'h', marker: (S.workingDays.length * cap) / 60, markerLabel: 'Office time available', label: 'Hours per person by kind of work' })}
            <p class="muted small">The thin line is the office time available in this period. Overlapping bookings are counted in full here.</p></article>
          <article class="panel"><h2>Where the time goes</h2>${UI.donut(typeTotals, { unit: 'h', center: T.hrs(typeTotals.reduce((s, x) => s + x.value * 60, 0)), centerSub: 'person-hours' })}</article>
        </div>
        <article class="panel"><h2>Daily load</h2><p class="muted small">Hours booked per person per day. Darker is busier; red outlines are clashes. Click a day to open it.</p>${heat}</article>
        <div class="grid-2">
          <article class="panel"><h2>Hours per week</h2>${UI.lines(wkIn.map(w => D.nice(w, { short: true })), people.map(x => ({ name: x.name, color: x.color, values: wkIn.map(w => Object.keys(S.per[x.id].byDate).filter(d => D.weekStart(d) === w).reduce((s, d) => s + S.per[x.id].byDate[d], 0) / 60) })), { unit: 'h', ref: 6 * cap / 60, refLabel: '6-day week', label: 'Hours per week per person' })}
            <ul class="legend inline">${people.map(x => `<li><span class="dot" style="background:${x.color}"></span>${esc(x.name)}</li>`).join('')}</ul></article>
          <article class="panel"><h2>Busy days of the week</h2>${UI.columns(dows.map(d => D.DAYS[d].slice(0, 3)), people.map(x => ({ name: x.name, color: x.color, values: dows.map(dw => Object.keys(S.per[x.id].byDate).filter(d => D.dow(d) === dw).reduce((s, d) => s + S.per[x.id].byDate[d], 0) / 60) })), { unit: 'h', label: 'Hours by day of the week' })}</article>
        </div>
        <article class="panel"><h2>Time per company</h2><p class="muted small">Site days count towards the company visited; office tasks are split between the companies they cover.</p>${UI.hbars(compRows, { unit: 'h', label: 'Hours per company' })}</article>
        <article class="panel"><h2>Numbers per person</h2><div class="hscroll"><table class="tbl sortable"><thead><tr><th data-sort="text">Person</th><th data-sort="num">Hours booked</th><th data-sort="num">Office time</th><th data-sort="num">Used</th><th data-sort="num">Days with work</th><th data-sort="num">Average day</th><th data-sort="num">Busiest day</th><th data-sort="num">Free days</th><th data-sort="num">Site days</th><th data-sort="num">Tasks</th><th data-sort="num">Done</th></tr></thead><tbody>
          ${per.map(s => `<tr><th>${App.personTag(s.id)}</th><td data-v="${s.booked}">${T.hrs(s.booked)}</td><td data-v="${s.capacity}">${T.hrs(s.capacity)}</td><td data-v="${s.util}">${Math.round(s.util * 100)}%</td><td>${s.daysWorked}</td><td data-v="${s.avgDay}">${T.hrs(s.avgDay)} h</td><td data-v="${s.peak}">${T.hrs(s.peak)} h${s.peakDate ? `, ${D.nice(s.peakDate, { short: true })}` : ''}</td><td>${s.freeDays}</td><td>${s.visits}</td><td>${s.tasks}</td><td data-v="${s.tasks ? s.done / s.tasks : 0}">${s.tasks ? Math.round(s.done / s.tasks * 100) : 0}%</td></tr>`).join('')}
          </tbody></table></div>
          <h3 class="sub">Spread of booked hours across people</h3>
          <dl class="statgrid"><div><dt>Average</dt><dd>${T.hrs(desc.mean)} h</dd></div><div><dt>Median</dt><dd>${T.hrs(desc.median)} h</dd></div><div><dt>Standard deviation</dt><dd>${T.hrs(desc.sd)} h</dd></div><div><dt>Variation (CV)</dt><dd>${Math.round(desc.cv * 100)}%</dd></div><div><dt>Lowest</dt><dd>${T.hrs(desc.min)} h</dd></div><div><dt>Highest</dt><dd>${T.hrs(desc.max)} h</dd></div><div><dt>Gap</dt><dd>${T.hrs(desc.range)} h</dd></div><div><dt>Gini</dt><dd>${desc.gini.toFixed(2)}</dd></div></dl>
        </article></section>`;
    },
    mount(root) { $('#scope', root).onchange = e => App.go('insights', { scope: e.target.value }); }
  };

  /* ---------------- Clashes & warnings ---------------- */
  V.issues = {
    title: 'Clashes',
    render(p) {
      const data = App.data; const lvl = p.level || 'all';
      const groups = { clash: 'Clashes: someone is booked twice', warn: 'Warnings', info: 'Automatic changes' };
      const list = data.iss.filter(i => lvl === 'all' || i.level === lvl);
      const counts = { clash: 0, warn: 0, info: 0 }; data.iss.forEach(i => counts[i.level]++);
      const actions = i => {
        const out = [];
        (i.keys || []).slice(0, 2).forEach(k => {
          const o = data.byKey[k]; if (!o) return;
          if (i.kind === 'overlap') {
            const free = App.nextFreeDay(o, o.date);
            if (free) out.push(`<button type="button" class="btn btn-ghost btn-sm" data-fix="move" data-k="${esc(k)}" data-d="${free}">Move ${esc(o.title)} to ${D.nice(free, { short: true })}</button>`);
            if (o.people.length > 1 && i.person) out.push(`<button type="button" class="btn btn-ghost btn-sm" data-fix="drop" data-k="${esc(k)}" data-p="${esc(i.person)}">Take ${esc(App.pname(i.person))} off ${esc(o.title)}</button>`);
          }
          out.push(`<button type="button" class="btn btn-ghost btn-sm" data-occ="${esc(k)}">Open ${esc(o.title.length > 26 ? o.title.slice(0, 24) + '…' : o.title)}</button>`);
        });
        if (i.kind === 'unplaced' || i.kind === 'maxdays' || i.kind === 'novisit') { const tid = i.taskId || ''; if (tid) out.push(`<button type="button" class="btn btn-ghost btn-sm" data-edit-task="${esc(tid)}">Change the task</button>`); }
        return out.join('');
      };
      return `<section><header class="vhead"><h1>Clashes and warnings</h1>
        <p class="lede">Problems found in the timetable. Most come from P and P1 being the same person. Each item offers a quick fix; every fix can be undone.</p></header>
        <div class="seg big" role="group" aria-label="Show">${[['all', 'Everything', data.iss.length], ['clash', 'Clashes', counts.clash], ['warn', 'Warnings', counts.warn], ['info', 'Automatic changes', counts.info]].map(([k, l, n]) => `<button type="button" data-go="issues?level=${k}" class="${lvl === k ? 'on' : ''}">${l} <b>${n}</b></button>`).join('')}</div>
        ${list.length ? Object.keys(groups).map(gk => { const l = list.filter(i => i.level === gk); if (!l.length) return ''; return `<h2 class="h2">${groups[gk]}</h2><ul class="issue-cards">${l.map(i => `<li class="lvl-${i.level}"><div class="ic-head">${i.date ? `<a href="#/today?date=${i.date}" class="ic-date">${D.nice(i.date)}</a>` : ''}<p>${esc(i.text)}</p></div><div class="ic-acts">${actions(i)}</div></li>`).join('')}</ul>`; }).join('') : '<p class="empty">Nothing to sort out. Every person has one thing at a time.</p>'}
      </section>`;
    },
    mount(root) {
      $$('[data-fix]', root).forEach(b => b.onclick = () => {
        const o = App.data.byKey[b.dataset.k];
        if (b.dataset.fix === 'move') App.moveOcc(b.dataset.k, b.dataset.d);
        else App.setOverride(b.dataset.k, { people: o.people.filter(x => x !== b.dataset.p) }, `${App.pname(b.dataset.p)} taken off ${o.title} on ${D.nice(o.date)}`);
        App.render();
      });
    }
  };

  /* ---------------- Settings & data ---------------- */
  V.settings = {
    title: 'Settings',
    render() {
      const plan = Store.plan, st = plan.settings;
      return `<section><header class="vhead"><h1>Settings and data</h1><p class="lede">Office hours, holidays, people and companies, and how to share the timetable.</p></header>
        <div class="grid-2">
        <article class="panel"><h2>Timetable</h2><form id="set-form" class="form-grid">
          <label class="span">Name of this timetable<input name="title" value="${esc(plan.title || '')}"></label>
          <label>From<input type="date" name="start" value="${st.start}" required></label><label>To<input type="date" name="end" value="${st.end}" required></label>
          <label>Office opens<input type="time" name="workStart" value="${st.workStart}" required></label><label>Office closes<input type="time" name="workEnd" value="${st.workEnd}" required></label>
          <label>Lunch from<input type="time" name="lunchStart" value="${st.lunchStart}"></label><label>Lunch to<input type="time" name="lunchEnd" value="${st.lunchEnd}"></label>
          <label>Warn above (hours a day)<input type="number" name="maxHours" min="4" max="16" step="0.5" value="${st.maxHours || 9}"></label><span></span>
          <label class="check span"><input type="checkbox" name="sundayOff" ${st.sundayOff ? 'checked' : ''}> Sundays are holidays</label>
          <label class="check span"><input type="checkbox" name="sundayStreak" ${st.sundayStreak ? 'checked' : ''}> Work on a Sunday when it falls inside a work streak (like a 7-day measurement run)</label>
          <div class="span"><button type="submit" class="btn btn-primary">Save timetable settings</button></div></form></article>
        <article class="panel"><h2>Holidays</h2><ul class="hol-list">${plan.holidays.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(h => `<li><span>${D.nice(h.date, { long: true })}</span><b>${esc(h.name)}</b><button type="button" class="icon-btn" data-rmhol="${h.date}" aria-label="Remove holiday on ${D.nice(h.date)}">${icon('x')}</button></li>`).join('') || '<li class="muted">No holidays.</li>'}</ul>
          <form id="hol-form" class="form-grid"><label>Date<input type="date" name="date" required></label><label>Name<input name="name" placeholder="Holiday" required></label><div class="span"><button class="btn btn-ghost" type="submit">${icon('plus')}Add holiday</button></div></form></article>
        </div>
        <article class="panel"><h2>People</h2><div class="hscroll"><table class="tbl edit-tbl"><thead><tr><th>Short name</th><th>Shown as</th><th>Full name</th><th>Role</th><th>Also called</th><th>Colour</th><th></th></tr></thead><tbody>
          ${plan.people.map(x => `<tr data-person="${esc(x.id)}"><td><b>${esc(x.id)}</b></td><td><input data-pf="name" value="${esc(x.name)}" aria-label="Shown as"></td><td><input data-pf="fullName" value="${esc(x.fullName || '')}" aria-label="Full name"></td><td><input data-pf="role" value="${esc(x.role || '')}" aria-label="Role"></td><td><input data-pf="aliases" value="${esc((x.aliases || []).join(', '))}" aria-label="Also called"></td><td><input type="color" data-pf="color" value="${x.color}" aria-label="Colour"></td><td><button type="button" class="icon-btn" data-rmperson="${esc(x.id)}" aria-label="Remove ${esc(x.name)}">${icon('trash')}</button></td></tr>`).join('')}
          </tbody></table></div><form id="person-form" class="toolbar"><input name="id" placeholder="Short name, e.g. K" maxlength="4" required aria-label="Short name"><input name="name" placeholder="Shown as" aria-label="Shown as"><button class="btn btn-ghost" type="submit">${icon('plus')}Add person</button></form></article>
        <article class="panel"><h2>Companies</h2><div class="hscroll"><table class="tbl edit-tbl"><thead><tr><th>Name</th><th>Group</th><th></th></tr></thead><tbody>
          ${plan.companies.map(c => `<tr data-company="${esc(c.id)}"><td><input data-cf="name" value="${esc(c.name)}" aria-label="Company name"></td><td><select data-cf="group" aria-label="Group">${Object.keys(App.GROUPS).map(k => `<option value="${k}" ${c.group === k ? 'selected' : ''}>${App.GROUPS[k]}</option>`).join('')}</select></td><td><button type="button" class="icon-btn" data-rmcomp="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">${icon('trash')}</button></td></tr>`).join('')}
          </tbody></table></div><form id="comp-form" class="toolbar"><input name="name" placeholder="Company name" required aria-label="Company name"><select name="group" aria-label="Group">${Object.keys(App.GROUPS).map(k => `<option value="${k}">${App.GROUPS[k]}</option>`).join('')}</select><button class="btn btn-ghost" type="submit">${icon('plus')}Add company</button></form></article>
        <article class="panel data-panel"><h2>Share and back up</h2>
          <p>Changes are saved in this browser straight away. To let everyone in the office see the same timetable:</p>
          <div class="data-acts">
            <div><h3 class="sub">Send a link</h3><p class="muted small">The link holds the whole timetable. Whoever opens it gets your version.</p><button type="button" class="btn btn-primary" id="d-share">${icon('share')}Copy share link</button></div>
            <div><h3 class="sub">Publish the office copy</h3><p class="muted small">Download <code>plan.json</code> and replace <code>data/plan.json</code> in the GitHub repository. Everyone who opens the site then starts from it.</p><button type="button" class="btn btn-ghost" id="d-office">${icon('download')}Download plan.json</button></div>
            <div><h3 class="sub">Excel</h3><p class="muted small">One workbook with person-wise, company-wise, meeting, advance, billing and review sheets, ready to sort and filter.</p><button type="button" class="btn btn-ghost" id="d-xlsx">${icon('download')}Download Excel</button></div>
            <div><h3 class="sub">Backup</h3><p class="muted small">Save a copy or load one back.</p><button type="button" class="btn btn-ghost" id="d-json">${icon('download')}Save backup</button> <label class="btn btn-ghost">${icon('upload')}Load backup<input type="file" id="d-load" accept=".json,application/json" hidden></label></div>
          </div>
          <div class="danger-zone"><button type="button" class="btn btn-ghost" id="d-reset-office">Discard my changes and use the office copy</button><button type="button" class="btn btn-ghost danger" id="d-reset-excel">Start again from the Excel plan</button></div>
        </article></section>`;
    },
    mount(root) {
      $('#set-form', root).onsubmit = e => {
        e.preventDefault(); const fd = new FormData(e.target);
        if (fd.get('end') < fd.get('start')) { toast('The end date must be after the start date.'); return; }
        App.commit('Timetable settings saved', p => { p.title = fd.get('title'); Object.assign(p.settings, { start: fd.get('start'), end: fd.get('end'), workStart: fd.get('workStart'), workEnd: fd.get('workEnd'), lunchStart: fd.get('lunchStart'), lunchEnd: fd.get('lunchEnd'), maxHours: Number(fd.get('maxHours')) || 9, sundayOff: !!fd.get('sundayOff'), sundayStreak: !!fd.get('sundayStreak') }); });
        App.render(); App.renderChrome();
      };
      $('#hol-form', root).onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); App.commit(`Holiday added on ${D.nice(fd.get('date'))}`, p => { p.holidays = p.holidays.filter(h => h.date !== fd.get('date')).concat({ date: fd.get('date'), name: fd.get('name') }); }); App.render(); };
      $$('[data-rmhol]', root).forEach(b => b.onclick = () => { App.commit('Holiday removed', p => { p.holidays = p.holidays.filter(h => h.date !== b.dataset.rmhol); }); App.render(); });
      $$('[data-pf]', root).forEach(inp => inp.onchange = () => { const id = inp.closest('tr').dataset.person; App.commit('Person updated', p => { const x = p.people.find(x => x.id === id); x[inp.dataset.pf] = inp.dataset.pf === 'aliases' ? inp.value.split(',').map(s => s.trim()).filter(Boolean) : inp.value; }); App.render(); });
      $$('[data-rmperson]', root).forEach(b => b.onclick = () => UI.confirmBox('Remove this person?', `${App.pname(b.dataset.rmperson)} will be taken off every task. You can undo this.`, 'Remove person', () => { const id = b.dataset.rmperson; App.commit(`${id} removed`, p => { p.people = p.people.filter(x => x.id !== id); p.tasks.forEach(t => { t.people = (t.people || []).filter(x => x !== id); }); delete p.responsibilities[id]; }); App.render(); }, true));
      $('#person-form', root).onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); const id = fd.get('id').trim().toUpperCase(); if (Store.plan.people.some(x => x.id === id)) { toast(`${id} is already in the list.`); return; } const palette = ['#0e7490', '#9d174d', '#4d7c0f', '#a16207', '#6d28d9', '#be123c']; App.commit(`${id} added`, p => { p.people.push({ id, name: fd.get('name') || id, fullName: '', role: '', color: palette[p.people.length % palette.length], aliases: [] }); p.responsibilities[id] = { main: [], outstation: [], other: [], duties: '' }; }); App.render(); };
      $$('[data-cf]', root).forEach(inp => inp.onchange = () => { const id = inp.closest('tr').dataset.company; App.commit('Company updated', p => { const c = p.companies.find(x => x.id === id); const old = c.group; c[inp.dataset.cf] = inp.value; if (inp.dataset.cf === 'group' && old !== inp.value) Object.values(p.responsibilities).forEach(r => { if ((r[old] || []).includes(id)) { r[old] = r[old].filter(x => x !== id); r[inp.value] = (r[inp.value] || []).concat(id); } }); }); App.render(); });
      $$('[data-rmcomp]', root).forEach(b => b.onclick = () => UI.confirmBox('Remove this company?', `${App.cname(b.dataset.rmcomp)} will be removed from every task and person.`, 'Remove company', () => { const id = b.dataset.rmcomp; App.commit('Company removed', p => { p.companies = p.companies.filter(c => c.id !== id); p.tasks.forEach(t => { t.companies = (t.companies || []).filter(c => c !== id); }); Object.values(p.responsibilities).forEach(r => ['main', 'outstation', 'other'].forEach(gk => { r[gk] = (r[gk] || []).filter(c => c !== id); })); }); App.render(); }, true));
      $('#comp-form', root).onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); const name = fd.get('name').trim(); let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'c'; while (Store.plan.companies.some(c => c.id === id)) id += '-2'; App.commit(`${name} added`, p => p.companies.push({ id, name, group: fd.get('group') })); App.render(); };
      $('#d-share', root).onclick = async () => { const link = await Store.shareLink(); try { await navigator.clipboard.writeText(link); toast('Share link copied. Paste it into WhatsApp or email.'); } catch (e) { modal({ title: 'Share link', body: `<p class="muted">Copy this link:</p><textarea rows="5" readonly class="mono-box">${esc(link)}</textarea>` }); } };
      $('#d-office', root).onclick = () => { const pl = Store.clone(Store.plan); delete pl.savedAt; IO.download(IO.json(pl), 'plan.json'); toast('plan.json downloaded. Upload it to the data folder of the repository.'); };
      $('#d-xlsx', root).onclick = () => App.exportExcel();
      $('#d-json', root).onclick = () => IO.download(IO.json(Store.plan), `timetable-backup-${D.today()}.json`);
      $('#d-load', root).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const p = JSON.parse(await f.text()); if (!p.tasks || !p.people) throw new Error('x'); Store.replace(p, `Loaded ${f.name}`); App.render(); App.renderChrome(); toast(`Loaded ${f.name}.`); } catch (err) { toast('That file is not a timetable backup. Choose a .json file saved from this website.'); } };
      $('#d-reset-office', root).onclick = () => UI.confirmBox('Use the office copy?', 'Your changes in this browser are replaced by the published office copy. You can undo this.', 'Use office copy', () => { Store.resetToOffice(); App.render(); App.renderChrome(); });
      $('#d-reset-excel', root).onclick = () => UI.confirmBox('Start again from the Excel plan?', 'Every change is replaced by the timetable built from the planning sheet. You can undo this.', 'Start again', () => { Store.resetToExcel(); App.render(); App.renderChrome(); }, true);
    }
  };

  /* ---------------- Excel export ---------------- */
  App.exportExcel = function () {
    const plan = Store.plan, data = App.compute();
    const nm = id => App.pname(id), cn = id => App.cname(id);
    const ty = t => (App.TYPES[t] || {}).label || t;
    const sched = [['Date', 'Day', 'Week of', 'Start', 'End', 'Hours', 'Work', 'Kind', 'People', 'Companies', 'Site visits', 'Status', 'Moved', 'Note']];
    data.gen.occs.forEach(o => sched.push([o.date, D.DAYS[D.dow(o.date)], D.weekStart(o.date), o.start, o.end, +(o.mins / 60).toFixed(2), o.title, ty(o.type), o.people.map(nm).join(', '), o.companies.map(cn).join(', '),
      data.gen.visits.filter(v => v.runKey === o.runKey && v.date === o.date).map(v => `${cn(v.company)} (${nm(v.person)})`).join(', '), App.STATUS[o.status], o.shifted ? 'Holiday shift from ' + o.planned : o.moved ? 'By hand from ' + o.planned : '', o.note || '']));
    const pw = [['Person', 'Date', 'Day', 'Week of', 'Month', 'Start', 'End', 'Hours', 'Work', 'Kind', 'Status']];
    data.gen.occs.forEach(o => o.people.forEach(pid => pw.push([nm(pid), o.date, D.DAYS[D.dow(o.date)], D.weekStart(o.date), D.month(o.date), o.start, o.end, +(o.mins / 60).toFixed(2), App.personLabel(o, pid), ty(o.type), App.STATUS[o.status]])));
    const weeks = [...new Set(data.gen.dates.map(D.weekStart))], months = [...new Set(data.gen.dates.map(D.month))];
    const sum = [['Person', ...weeks.map(w => 'Week of ' + w), ...months.map(m => 'Month ' + m), 'Total booked hours', 'Office hours', 'Used %', 'Site days']];
    plan.people.forEach(p => { const s = data.stats.per[p.id]; const bw = w => Object.keys(s.byDate).filter(d => D.weekStart(d) === w).reduce((a, d) => a + s.byDate[d], 0) / 60; const bm = m => Object.keys(s.byDate).filter(d => D.month(d) === m).reduce((a, d) => a + s.byDate[d], 0) / 60;
      sum.push([p.name, ...weeks.map(w => +bw(w).toFixed(2)), ...months.map(m => +bm(m).toFixed(2)), +(s.booked / 60).toFixed(2), +(s.capacity / 60).toFixed(2), Math.round(s.util * 100), s.visits]); });
    const daily = [['Date', 'Day', ...plan.people.map(p => p.name)]];
    data.gen.dates.forEach(d => daily.push([d, data.gen.hol[d] ? data.gen.hol[d] : D.DAYS[D.dow(d)], ...plan.people.map(p => (data.byDate[d] || []).filter(o => o.people.includes(p.id) && o.type !== 'review').map(o => `${o.start}-${o.end} ${App.personLabel(o, p.id)}`).join(' | '))]));
    const comp = [['Company', 'Group', 'Date', 'Day', 'What', 'Person', 'Cycle']];
    data.gen.visits.forEach(v => comp.push([cn(v.company), App.GROUPS[plan.companies.find(c => c.id === v.company)?.group] || '', v.date, D.DAYS[D.dow(v.date)], 'Site day', nm(v.person), v.cycle]));
    data.gen.occs.filter(o => !o.siteGroup && o.type !== 'review').forEach(o => o.companies.forEach(c => comp.push([cn(c), App.GROUPS[plan.companies.find(x => x.id === c)?.group] || '', o.date, D.DAYS[D.dow(o.date)], o.title, o.people.map(nm).join(', '), ''])));
    comp.splice(1, comp.length, ...comp.slice(1).sort((a, b) => a[0] === b[0] ? (a[2] < b[2] ? -1 : 1) : (a[0] < b[0] ? -1 : 1)));
    const meet = [['Date', 'Meeting', 'Item start', 'Agenda item', 'Minutes', 'Leads']];
    data.gen.occs.filter(o => o.type === 'meeting').forEach(o => { let cur = T.m(o.start); ((App.task(o.taskId) || {}).agenda || []).forEach(a => { meet.push([o.date, o.title, T.s(cur), a.item, a.minutes, nm(a.owner)]); cur += Number(a.minutes) || 0; }); });
    const pay = [['Date', 'Day', 'Kind', 'Slot start', 'Slot end', 'Company', 'Steps', 'People', 'Done']];
    data.gen.occs.filter(o => o.type === 'advance' || o.type === 'billing').forEach(o => {
      const steps = o.type === 'advance' ? ['Measurement checking', 'Rate check', 'Linking to PO file', 'Advances filling', 'Asset codes checking', 'Emailing'] : ['Bill checking', 'Rate check', 'Formatting', 'Advances', 'Asset codes', 'Tally billing (P1)', 'B checks the billing sheet'];
      Engine.slotPlan(plan, o, steps).forEach(r => pay.push([o.date, D.DAYS[D.dow(o.date)], o.title, r.start, r.end, r.company === 'general' ? 'All works' : cn(r.company), steps.join(', '), o.people.map(nm).join(', '), ((plan.reviews.pay || {})[o.key + '|' + r.company]) ? 'Yes' : '']));
    });
    const tasks = [['Task', 'Kind', 'Repeats', 'Start', 'End', 'Hours a day', 'People', 'Companies', 'If holiday', 'Details']];
    plan.tasks.forEach(t => tasks.push([t.title, ty(t.type), repeatText(t), t.start, t.end, +(Engine.workMins(t.start, t.end, plan.settings) / 60).toFixed(2), Engine.normPeople(plan, t.people).map(nm).join(', '), (t.companies || []).map(cn).join(', '), t.mode === 'monthly' ? (t.holiday === 'skip' ? 'Skip' : 'Next working day') : '', t.details || '']));
    const resp = [['Company', 'Group', 'Person']];
    plan.companies.forEach(c => { const o = plan.people.find(x => ((plan.responsibilities[x.id] || {})[c.group] || []).includes(c.id)); resp.push([c.name, App.GROUPS[c.group], o ? o.name : '']); });
    const iss = [['Level', 'Date', 'Person', 'Problem']];
    data.iss.forEach(i => iss.push([i.level === 'clash' ? 'Clash' : i.level === 'warn' ? 'Warning' : 'Info', i.date || '', i.person ? nm(i.person) : '', i.text]));
    const blob = IO.xlsx([
      { name: 'Schedule', rows: sched }, { name: 'Person-wise', rows: pw }, { name: 'Hours per person', rows: sum }, { name: 'Day grid', rows: daily },
      { name: 'Company-wise', rows: comp }, { name: 'Meetings', rows: meet }, { name: 'Advance & billing days', rows: pay },
      { name: 'Tasks', rows: tasks }, { name: 'Responsibilities', rows: resp }, { name: 'Clashes', rows: iss }
    ]);
    IO.download(blob, `timetable-${plan.settings.start}-to-${plan.settings.end}.xlsx`);
    toast('Excel workbook downloaded. Every sheet has filters on the header row.');
  };
})();
