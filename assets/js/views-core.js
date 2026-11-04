/* Views: Today (who is where), Calendar, Timetable board. */
(function () {
  'use strict';
  const { D, T } = Engine;
  const { esc, $, $$, icon } = UI;
  const V = App.views;

  function dateNav(view, date, extra) {
    const st = Store.plan.settings;
    const prev = D.add(date, -1), next = D.add(date, 1);
    return `<div class="datenav">
      <button type="button" class="icon-btn" data-go="${view}?date=${prev}" aria-label="Previous day" ${prev < st.start ? 'disabled' : ''}>${icon('left')}</button>
      <input type="date" value="${date}" min="${st.start}" max="${st.end}" data-datepick="${view}" aria-label="Pick a date">
      <button type="button" class="icon-btn" data-go="${view}?date=${next}" aria-label="Next day" ${next > st.end ? 'disabled' : ''}>${icon('right')}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-go="${view}?date=${App.defaultDate()}">Today</button>${extra || ''}</div>`;
  }
  function bindDatePick(root) {
    $$('[data-datepick]', root).forEach(i => i.onchange = () => { if (i.value) App.go(i.dataset.datepick, { date: i.value }); });
  }
  V._dateNav = dateNav; V._bindDatePick = bindDatePick;

  function where(occs, pid) {
    const mine = occs.filter(o => o.people.includes(pid) && o.type !== 'review' && o.type !== 'meeting');
    if (!mine.length) return { k: 'free', label: 'No fixed work' };
    if (mine.some(o => o.type === 'outstation')) return { k: 'out', label: 'Outstation' };
    if (mine.some(o => o.type === 'site')) return { k: 'site', label: 'On site' };
    return { k: 'office', label: 'In office' };
  }

  /* ---------------- Today ---------------- */
  V.today = {
    title: 'Today',
    render(p) {
      const plan = Store.plan, st = plan.settings, data = App.data;
      const date = p.date && p.date >= st.start && p.date <= st.end ? p.date : App.defaultDate();
      const occs = data.byDate[date] || [];
      const hol = data.gen.hol[date];
      const dt = D.parse(date);
      const wd = data.stats.workingDays; const idx = wd.indexOf(date);
      const isToday = date === D.today();
      // Time axis
      let from = Math.min(T.m('09:00'), ...occs.map(o => T.m(o.start))), to = Math.max(T.m(st.workEnd) + 30, ...occs.map(o => T.m(o.end)));
      from = Math.floor(from / 60) * 60; to = Math.ceil(to / 60) * 60;
      const pct = m => ((m - from) / (to - from)) * 100;
      const hours = []; for (let m = from; m <= to; m += 60) hours.push(m);
      const nowM = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
      const lunchL = pct(T.m(st.lunchStart)), lunchW = pct(T.m(st.lunchEnd)) - lunchL;
      const offL = pct(T.m(st.workStart)), offR = pct(T.m(st.workEnd));

      const rows = plan.people.map(person => {
        const mine = occs.filter(o => o.people.includes(person.id));
        const w = hol ? { k: 'off', label: hol } : where(occs, person.id);
        const mins = App.data.stats.per[person.id].byDate[date] || 0;
        const clash = data.clashPD.has(person.id + '|' + date);
        // stack overlapping blocks into lanes
        const lanes = [];
        const blocks = mine.slice().sort((a, b) => T.m(a.start) - T.m(b.start)).map(o => {
          let lane = lanes.findIndex(end => end <= T.m(o.start)); if (lane < 0) { lane = lanes.length; lanes.push(0); } lanes[lane] = T.m(o.end);
          return { o, lane };
        });
        const nL = Math.max(1, lanes.length);
        return `<div class="muster-row ${clash ? 'has-clash' : ''} ${nL > 1 ? 'multi' : ''}" style="--pc:${person.color};--lanes:${nL}">
          <div class="muster-who">
            <span class="avatar" style="--pc:${person.color}">${esc(person.id)}</span>
            <div><a href="#/people?id=${encodeURIComponent(person.id)}" class="who-name">${esc(person.name)}</a>
            <span class="where where-${w.k}">${esc(w.label)}</span></div></div>
          <div class="muster-track" data-drop-date="${date}" data-drop-person="${esc(person.id)}" data-add-date="${date}" data-add-person="${esc(person.id)}" title="Click an empty part to add work for ${esc(person.name)}">
            ${blocks.map(({ o, lane }) => {
              const ty = App.TYPES[o.type] || App.TYPES.office;
              const c = Store.prefs.colorBy === 'person' ? person.color : ty.color;
              const left = pct(T.m(o.start)), width = Math.max(1.2, pct(T.m(o.end)) - left);
              return `<button type="button" class="mblock ${data.clashKeys.has(o.key) ? 'is-clash' : ''} ${o.status === 'done' ? 'is-done' : ''}" draggable="true" data-occ="${esc(o.key)}" data-from-person="${esc(person.id)}"
                style="left:${left}%;width:${width}%;--c:${c};--lane:${lane}"
                title="${esc(App.personLabel(o, person.id))} ${o.start}–${o.end}">
                <span class="mb-title">${esc(App.personLabel(o, person.id))}</span><span class="mb-time">${o.start}–${o.end}</span></button>`;
            }).join('')}
          </div>
          <div class="muster-hrs">${mins ? `<b>${T.hrs(mins)}</b> h` : '<span class="muted">–</span>'}</div></div>`;
      }).join('');

      const visits = data.gen.visits.filter(v => v.date === date);
      const meetings = occs.filter(o => o.type === 'meeting');
      const watch = data.iss.filter(i => i.date === date && i.level !== 'info');
      const upcoming = data.gen.occs.filter(o => o.date > date && ['meeting', 'advance', 'billing'].includes(o.type)).slice(0, 6);
      const keyDays = occs.filter(o => ['advance', 'billing'].includes(o.type));

      return `<section class="today">
        <header class="today-head">
          <div class="bigdate"><span class="bd-day">${D.DAYS[dt.getUTCDay()]}</span><span class="bd-num">${dt.getUTCDate()}</span><span class="bd-month">${D.MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}</span></div>
          <div class="today-side">
            ${dateNav('today', date)}
            <p class="today-sum">${hol ? `Holiday: ${esc(hol)}. The office is closed.` : idx >= 0 ? `Working day ${idx + 1} of ${wd.length} in this timetable.` : 'Sunday. Nothing is planned unless a work streak runs through it.'}
            ${watch.length ? ` <a href="#/issues" class="warn-link">${watch.length} thing${watch.length > 1 ? 's' : ''} to sort out</a>` : ''}</p>
          </div>
        </header>
        <div class="muster" aria-label="Who does what on ${D.nice(date, { long: true })}">
          <div class="muster-axis"><div></div><div class="axis-track">${hours.map(m => `<span style="left:${pct(m)}%">${T.nice(T.s(m))}</span>`).join('')}</div><div></div></div>
          <div class="muster-body" style="--lunch-l:${lunchL}%;--lunch-w:${lunchW}%;--off-l:${offL}%;--off-r:${offR}%">
            ${rows}
            ${isToday && nowM >= from && nowM <= to ? `<div class="nowline" style="--x:${pct(nowM)}%"><span>${T.s(nowM)}</span></div>` : ''}
          </div>
          <p class="muster-foot"><span class="swatch lunch"></span>Lunch ${T.nice(st.lunchStart)} to ${T.nice(st.lunchEnd)} <span class="swatch offhours"></span>Outside office hours. Drag a block onto another person to hand the work over; click a block to change it.</p>
        </div>
        <div class="today-grid">
          <article class="panel">
            <h2>Site visits</h2>
            ${visits.length ? `<ul class="visits">${visits.map(v => `<li><button type="button" class="linkish" data-visit="${esc(v.key)}">${esc(App.cname(v.company))}</button>${App.personTag(v.person)}<span class="muted">${esc(v.cycle)}</span></li>`).join('')}</ul>` : '<p class="muted">No company is visited on site today.</p>'}
          </article>
          <article class="panel">
            <h2>${meetings.length ? esc(meetings[0].title) : 'Meeting'}</h2>
            ${meetings.length ? meetings.map(m => { const t = App.task(m.taskId); const ag = (t && t.agenda) || []; let cur = T.m(m.start);
              return `<p class="muted">${m.start} to ${m.end}, everyone</p><ol class="agenda-mini">${ag.map(a => { const s = T.s(cur); cur += a.minutes; return `<li><span><b class="tnum">${s}</b> ${esc(a.item)}</span>${App.personTag(a.owner)}</li>`; }).join('')}</ol><a href="#/meetings" class="more">Edit agenda</a>`; }).join('') : '<p class="muted">No joint meeting today.</p>'}
            ${keyDays.length ? `<h3 class="sub">${keyDays.map(o => esc(o.title)).join(', ')}</h3><a class="more" href="#/paydays?date=${date}">Open the day sheet</a>` : ''}
          </article>
          <article class="panel">
            <h2>Coming up</h2>
            <ul class="upcoming">${upcoming.map(o => `<li><button type="button" class="linkish" data-occ="${esc(o.key)}">${esc(o.title)}</button><span class="muted">${D.nice(o.date)}, ${o.start}</span></li>`).join('') || '<li class="muted">Nothing else in this timetable.</li>'}</ul>
            <a href="#/review?date=${date}" class="btn btn-ghost btn-sm">${icon('check')}Daily review for this day</a>
          </article>
        </div>
        ${watch.length ? `<article class="panel watch"><h2>Clashes and warnings on this day</h2><ul class="issue-list">${watch.map(i => `<li class="lvl-${i.level}">${esc(i.text)}</li>`).join('')}</ul></article>` : ''}
      </section>`;
    },
    mount(root) { bindDatePick(root); }
  };

  /* ---------------- Calendar ---------------- */
  V.calendar = {
    title: 'Calendar',
    render() {
      const plan = Store.plan, st = plan.settings, data = App.data;
      const first = D.weekStart(st.start); let last = D.add(D.weekStart(st.end), 6);
      const days = D.range(first, last);
      const today = D.today();
      const occs = App.filtered(data.gen.occs);
      const by = {}; occs.forEach(o => { (by[o.date] = by[o.date] || []).push(o); });
      const head = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => `<div class="cal-dow"><span class="long">${d}</span><span class="short">${d.slice(0, 3)}</span></div>`).join('');
      let curMonth = '';
      const cells = days.map(d => {
        const inWin = d >= st.start && d <= st.end; const hol = data.gen.hol[d];
        const list = by[d] || [];
        const m = D.month(d); const showM = m !== curMonth || d === first; curMonth = m;
        const dn = D.day(d);
        return `<div class="cal-cell ${inWin ? '' : 'out'} ${hol ? 'hol' : ''} ${D.dow(d) === 0 ? 'sun' : ''} ${d === today ? 'is-today' : ''}" ${inWin ? `data-drop-date="${d}"` : ''}>
          <div class="cal-dn"><a href="#/today?date=${d}" class="dnum" aria-label="Open ${D.nice(d, { long: true })}">${dn}${showM || dn === 1 ? ` <span class="mon">${D.MONTHS[D.parse(d).getUTCMonth()].slice(0, 3)}</span>` : ''}</a>
            ${inWin ? `<button type="button" class="add" data-add-date="${d}" aria-label="Add work on ${D.nice(d)}">${icon('plus')}</button>` : ''}</div>
          ${hol ? `<div class="hol-name">${esc(hol)}</div>` : ''}
          <div class="cal-chips">${list.map(o => App.chip(o, { compact: true })).join('')}</div></div>`;
      }).join('');
      return `<section><header class="vhead"><h1>Calendar</h1>
          <p class="lede">The whole timetable from ${D.nice(st.start, { long: true })} to ${D.nice(st.end, { long: true })}. Drag any work to another day to reschedule it.</p></header>
        ${App.filterBar()}
        <div class="cal">${head}${cells}</div>
        ${legend()}</section>`;
    }
  };

  function legend() {
    return `<ul class="legend inline">${Object.keys(App.TYPES).map(k => `<li><span class="dot" style="background:${App.TYPES[k].color}"></span>${App.TYPES[k].label}</li>`).join('')}
      <li><span class="dot clash"></span>Clash</li><li>↷ moved from its planned date</li></ul>`;
  }
  V._legend = legend;

  /* ---------------- Board (person x date) ---------------- */
  V.board = {
    title: 'Timetable board',
    render(p) {
      const plan = Store.plan, st = plan.settings, data = App.data;
      const dates = data.gen.dates;
      const occs = App.filtered(data.gen.occs);
      const people = (Store.prefs.filters.people && Store.prefs.filters.people.length) ? plan.people.filter(x => Store.prefs.filters.people.includes(x.id)) : plan.people;
      const today = D.today();
      const head = dates.map(d => `<th scope="col" class="${data.gen.hol[d] ? 'hol' : ''} ${D.dow(d) === 0 ? 'sun' : ''} ${d === today ? 'is-today' : ''}"><a href="#/today?date=${d}"><span>${D.DAYS[D.dow(d)].slice(0, 2)}</span><b>${D.day(d)}</b></a>${data.gen.hol[d] ? `<em title="${esc(data.gen.hol[d])}">${esc(data.gen.hol[d].slice(0, 6))}</em>` : ''}</th>`).join('');
      const rows = people.map(person => {
        const s = data.stats.per[person.id];
        return `<tr><th scope="row" class="b-who"><span class="avatar" style="--pc:${person.color}">${esc(person.id)}</span><span class="b-name">${esc(person.name)}<small>${T.hrs(s.booked)} h booked</small></span></th>` +
          dates.map(d => {
            const mine = occs.filter(o => o.date === d && o.people.includes(person.id));
            const mins = s.byDate[d] || 0;
            const load = Math.min(1, mins / data.stats.cap);
            const clash = data.clashPD.has(person.id + '|' + d);
            return `<td class="${data.gen.hol[d] ? 'hol' : ''} ${D.dow(d) === 0 ? 'sun' : ''} ${clash ? 'is-clash' : ''}" data-drop-date="${d}" data-drop-person="${esc(person.id)}" style="--load:${load}">
              ${mine.map(o => App.chip(o, { compact: true, person: person.id, noPeople: true })).join('')}
              ${mins ? `<span class="cell-h">${T.hrs(mins)}h</span>` : ''}</td>`;
          }).join('') + '</tr>';
      }).join('');
      return `<section><header class="vhead"><h1>Timetable board</h1>
        <p class="lede">Every person against every day. Drag work along a row to move it to another day, or up and down to hand it to someone else on the same day.</p></header>
        ${App.filterBar()}
        <div class="hscroll board-wrap" tabindex="0" aria-label="Timetable board, scroll sideways"><table class="board"><thead><tr><th class="b-corner">Person</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
        ${legend()}</section>`;
    }
  };
})();
