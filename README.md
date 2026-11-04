# Works timetable

A website for the office timetable built from **B_planning_of_works.xlsx** (the "B planning chart").
It shows who does what on which day, lets anyone change the work, and analyses the workload.
It is a plain static site: no server, no login, no build step. It runs on GitHub Pages as it is.

## Put it online with GitHub Pages

1. Create a new repository on GitHub, for example `works-timetable` (public, or private on a plan that allows Pages).
2. Upload everything in this folder (keep the folders: `index.html`, `assets/`, `data/`, `.nojekyll`).
   On github.com: **Add file → Upload files**, drag the contents of the folder in, then **Commit changes**.
3. Open **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and **Save**.
4. After a minute the site is live at `https://<your-user-name>.github.io/works-timetable/`. Share that link with the office.

## How changes are shared

GitHub Pages only serves files, so there is no live shared database. The site works like this:

- **Every change is saved in the browser at once** (your browser only). Undo and redo work for every change.
- **Share link** (Settings → Copy share link): the link contains the whole timetable. Anyone who opens it gets your version, saved in their browser. Good for WhatsApp or email.
- **Office copy** (Settings → Download plan.json): replace `data/plan.json` in the repository with this file (upload it into the `data` folder and commit). From then on, everyone who opens the site starts from it. People who already have changes in their own browser keep them until they press *Discard my changes and use the office copy*.
- **Excel**: Settings → Download Excel gives one workbook with sheets for the schedule, person-wise time allotment, hours per person per week and month, a day grid, company-wise site days, meetings and agendas, advance and billing day slots, tasks, responsibilities and clashes. Every sheet has filters on the header row for sorting.
- **Backup**: save the plan as a `.json` file and load it back later.

## What is in it

| Page | What it does |
| --- | --- |
| Today | Who is where (office, site, outstation), hour by hour, with the current time line, site visits, the meeting agenda and what is coming up. Drag a block onto another person to hand work over. |
| Calendar | The whole period on a month grid. Drag work to another day to move it; click to edit; + to add one-day work. Filters by person, kind of work, company and text. |
| Board | People against days. Drag along a row to move a day, across rows to hand it to someone else. Shows hours per cell and clashes. |
| People | Each person's timetable day by day, time allotment per week and per month, kind of work, companies looked after, and an `.ics` file to add the timetable to a phone calendar. Printable. |
| Companies | Every company against every day: separate site days per company (letters = person on site), advance (A), billing (B) and meeting (M) days. Click a site day to change the day or person. |
| Meetings | Each joint meeting with its agenda: items, minutes, who leads, and whether it fits the slot. "Fit to the slot" rescales the minutes. |
| Advance & billing | A time-slotted sheet for every advance payment day and billing day of P1 and B, one slot per company, with tick boxes. |
| Daily review | B's checklist for checking everyone's work that day, built from the timetable, with notes and tomorrow's work. |
| Insights | Hours per person by kind of work, daily load heat map, weekly trend, day-of-week load, time per company, and statistics (mean, median, standard deviation, variation, Gini). Pick the whole period, a month or a week. |
| Clashes | Everyone booked twice, overloaded days, holiday moves and other warnings, each with quick fixes. |
| Plan | The monthly pattern from the Excel as editable tasks (dates of the month, times, people, companies, holiday rule), who looks after which company, one-day work, and the notes from the sheet. |
| Settings | Period, office hours, lunch, Sunday rule, holidays, people, companies, sharing and backup. |

Keyboard: `Ctrl K` or `/` to find anything, `Ctrl Z` / `Ctrl Y` undo and redo, `N` to add one-day work, `←` `→` to change day on Today and Daily review.

## How the default timetable was made from the Excel

- The monthly date pattern in the sheet (ADV-1 on the 1st, PPV and GST on the 1st and 2nd, site measurements C-1 on the 5th to 11th, and so on) is used for every month inside the period **5 November to 9 December 2026**.
- Office hours 10 am to 7 pm, lunch 1.30 to 2.30. Joint meetings 9.15 to 10.30 (5th, 6th, 7th) and 9.15 to 10.00 (24th, 25th, 26th) as written.
- The sheet gives dates but no clock times, so times were set: full-day work 10.00 to 18.30, half-day work 10.00 or 10.30 to 13.30 or 14.30 to 18.30, and a 30-minute daily review at 18.30 for B to check everyone's work. All of this can be changed in Plan.
- Diwali (8 to 11 November) and Sundays are holidays. Single-day work that falls on a holiday moves to the next working day with the fewest clashes; multi-day runs simply skip the holiday. A Sunday inside a multi-day run is worked ("adjusted for work streak"). Both rules can be changed in Settings and per task.
- Each person's companies (from the top table of the sheet) get separate site days within each measurement run; days left over are for sheet preparation and cement calculation.
- P and P1 are treated as one person, so the sheet's own double bookings of P (for example site measurements and billing on the same days) show up under **Clashes** with one-click fixes.
- S's "PPV works 2 days a week" is placed automatically on S's free working days each week.

## Files

```
index.html            the page
assets/css/app.css    styles (light and dark)
assets/js/defaults.js the plan built from the Excel sheet
assets/js/engine.js   turns the plan into dated work, finds clashes, computes statistics
assets/js/store.js    browser saving, undo, share links, office copy
assets/js/io.js       Excel, calendar and JSON files
assets/js/*.js        the pages
data/plan.json        the office copy everyone starts from
```

No external libraries are needed. The Barlow typeface loads from Google Fonts; without internet it falls back to the system font.
Dragging works with a mouse; on phones and tablets open the work and change its date or people in the dialog.
