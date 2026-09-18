# 100 Days Challenge — Fully Customizable Edition

A standalone, dependency-free web app for a personal 100-day challenge.
Categories, tasks, milestones, and the overview text are **entirely
user-defined** — nothing is hardcoded to "Learning / Health / Habits /
Food". Those four just ship as a starter seed you can rename, recolor,
reorder, hide, or delete like anything else.

No React, no build step, no npm install required to run it. Plain
HTML, CSS, and JavaScript, loaded as ordinary `<script>` tags.

## Project structure

```
index.html          → page shell, loads css + js in order
css/styles.css       → all visual styling
js/config.js         → static config: color palette, icon choices, default seed data
js/storage.js        → persistence adapter (localStorage today; see ARCHITECTURE.md)
js/state.js          → data model + business logic (categories, tasks, versions, streaks)
js/ui.js             → rendering + modals + onclick-facing action wrappers
js/main.js           → boots the app
package.json         → metadata only (no dependencies)
vercel.json          → zero-config static deploy settings
ARCHITECTURE.md       → how to add auth / a real database / payments later
```

## How to run it locally

Just open `index.html` in a browser — double-click it. These are
classic scripts (not ES modules), so there's no dev-server requirement
even for local testing.

## How to host it

It's a static site — 6 small files, no server-side code required.

- **Vercel**: push this folder to a GitHub repo, then "Import Project"
  in Vercel and pick the repo. `vercel.json` is already there; no
  build command needed (leave it as a static site).
- **GitHub Pages**: push to a repo, enable Pages in repo Settings,
  point it at the root of the `main` branch.
- **Netlify**: drag and drop this folder, or connect the GitHub repo.
- **Any static host / cPanel**: upload the files as-is.

## What's fully dynamic now

- **Categories**: add/rename/recolor icon/hide/reorder/delete, from
  the Categories tab. Deleting a category that still has tasks asks
  you to move them elsewhere, archive them, or delete them — it never
  silently destroys data.
- **Tasks**: every field (name, time, duration, category, icon, notes,
  repeat schedule, active/inactive) is editable at any time. Edits
  default to "from today onward" — past days keep showing the old
  values — with an "apply to all days" checkbox when you want to
  rewrite history on purpose.
- **Category history**: if you move a task to a different category,
  past days still show it under its old category. If you delete a
  category entirely, its name/icon are kept in an internal archive so
  old days can still label it correctly.
- **Overview**: title, subtitle, and a free-text 100-day goal are
  editable from the ✏️ button next to the app title (or Settings).
- **Milestones**: add, edit, or delete your own milestone days/labels
  from Settings — the default 6 (Day 1/10/25/50/75/100) are just a
  starting point.
- **Data**: export a `.json` backup, import it back in (with basic
  validation), or view/copy the raw JSON. Everything persists in the
  browser's `localStorage` between visits.

## What's intentionally simpler than a full custom dashboard builder

- Reordering is done with ▲▼ buttons (categories and tasks), not
  drag-and-drop — more reliable on mobile without extra libraries.
- The Overview page's *layout* (ring, stat row, category cards,
  milestones) is fixed; what's customizable is its *content* (title,
  subtitle, goal, which categories/milestones appear and in what
  order via category reordering). Free drag-and-drop rearrangement of
  the dashboard widgets themselves isn't implemented — flag this if
  you want it added next.
- Hiding a category pauses it from progress calculations entirely
  (past and present) rather than tracking "hidden as of which day" —
  simpler and predictable, but worth knowing if you hide/unhide a
  category mid-challenge.

## Editing

No build step — edit any file and refresh the browser. `js/state.js`
is where task/category/streak logic lives; `js/ui.js` is where the
screens are drawn; `css/styles.css` is colors and layout.
