/**
 * state.js
 * The app's data model and business logic. No DOM code lives here.
 *
 * KEY DESIGN POINT — categories are DATA, not code:
 * There is no fixed list of categories anywhere in this file. A
 * category is just an entry in `state.categories` (id -> {name, icon,
 * color, hidden, order}), and `state.categoryOrder` controls display
 * order. The four categories you start with (Learning, Health, Habits,
 * Food) are only a seed used once in defaultState() — the user can
 * rename, recolor, hide, reorder, or delete every one of them.
 *
 * KEY DESIGN POINT — EVERY editable task property is versioned:
 * A task object is just `{ id, order, versions[] }`. Each entry in
 * `versions[]` is a complete snapshot — name, time, duration,
 * categoryId, icon, notes, repeat, AND active status — tagged with
 * the day it became effective (`fromDay`). `versionAsOf(task, day)`
 * resolves which snapshot applies to a given day, so editing any
 * property "from today" never rewrites what earlier days show —
 * including deactivating/archiving a task, which stops it from being
 * tracked going forward without touching any past day's totals.
 * `pushVersionFrom()` is the one function that writes a new version;
 * every mutation (edit, archive, category move) goes through it.
 */

// ---------- global mutable state ----------
let state = null;

function uid(prefix) {
  return (prefix || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- building a fresh challenge ----------
function defaultState() {
  const now = todayISO();
  const categories = {};
  const categoryOrder = [];
  const tasks = {};

  DEFAULT_CATEGORY_SEED.forEach((seed, i) => {
    const catId = uid('cat_');
    categories[catId] = { id: catId, name: seed.name, icon: seed.icon, color: colorForIndex(i), hidden: false, order: i + 1 };
    categoryOrder.push(catId);
    (DEFAULT_TASK_SEED[seed.name] || []).forEach(([icon, name, time, duration], j) => {
      const taskId = uid('task_');
      tasks[taskId] = {
        id: taskId, order: j + 1,
        versions: [{ fromDay: 1, name, time, duration, categoryId: catId, icon, notes: '', repeat: { type: 'daily', days: [] }, active: true }]
      };
    });
  });

  return {
    schemaVersion: 3,
    startDate: now,
    theme: 'light',
    currentDay: 1,
    pastChallenges: [],
    overview: Object.assign({}, DEFAULT_OVERVIEW),
    categories,
    categoryOrder,
    deletedCategories: {}, // archive of {id: {name,icon,color}} for categories that were deleted, so old task versions can still show a label
    tasks,
    milestones: DEFAULT_MILESTONES.map(m => Object.assign({ id: uid('ms_') }, m)),
    completion: {}
  };
}

async function loadState() {
  const saved = await AppStorage.load();
  if (saved && saved.schemaVersion === 3) {
    state = saved;
  } else {
    // No live migration from schemaVersion 2: that shape stored icon/notes/
    // repeat/active directly on the task (not versioned), which is exactly
    // what this schema bump fixes. A saved v2 challenge starts fresh rather
    // than importing stale, non-versioned data.
    state = defaultState();
    await persist();
  }
}
async function persist() { await AppStorage.save(state); }

// ---------- categories ----------
function listCategories(opts) {
  const includeHidden = opts && opts.includeHidden;
  return state.categoryOrder
    .map(id => state.categories[id])
    .filter(c => c && (includeHidden || !c.hidden))
    .sort((a, b) => a.order - b.order);
}
function resolveCategoryMeta(catId) {
  return state.categories[catId] || state.deletedCategories[catId] || { id: catId, name: 'Deleted Category', icon: '🗑️', color: '#77727D', hidden: true };
}
function nextColorIndex() {
  return Object.keys(state.categories).length + Object.keys(state.deletedCategories).length;
}

function _addCategory(name, icon) {
  const id = uid('cat_');
  const order = state.categoryOrder.length ? Math.max(...state.categoryOrder.map(cid => state.categories[cid].order)) + 1 : 1;
  state.categories[id] = { id, name, icon: icon || '✨', color: colorForIndex(nextColorIndex()), hidden: false, order };
  state.categoryOrder.push(id);
  persist();
  return id;
}
function _updateCategory(catId, data) {
  const c = state.categories[catId];
  if (!c) return;
  if (data.name !== undefined) c.name = data.name;
  if (data.icon !== undefined) c.icon = data.icon;
  if (data.hidden !== undefined) c.hidden = data.hidden;
  persist();
}
function _reorderCategory(catId, dir) {
  const ordered = listCategories({ includeHidden: true });
  const idx = ordered.findIndex(c => c.id === catId);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= ordered.length) return;
  const tmp = ordered[idx].order;
  ordered[idx].order = ordered[swapIdx].order;
  ordered[swapIdx].order = tmp;
  persist();
}
// Tasks currently (as of `day`) assigned to a category — regardless of active/inactive.
function tasksAssignedToCategory(catId, day) {
  return Object.values(state.tasks)
    .filter(t => versionAsOf(t, day).categoryId === catId)
    .sort((a, b) => a.order - b.order);
}
/**
 * Delete a category. `mode` is 'move' | 'archive' | 'delete'.
 * - move: reassigns affected tasks to `targetCatId`, effective from today (past days keep old category)
 * - archive: deactivates affected tasks (keeps them, but they stop appearing in active tracking)
 * - delete: permanently removes the affected tasks
 */
function _deleteCategory(catId, mode, targetCatId) {
  const affected = tasksAssignedToCategory(catId, state.currentDay);
  if (mode === 'move' && targetCatId) {
    affected.forEach(t => pushVersionFrom(t, state.currentDay, { categoryId: targetCatId }));
  } else if (mode === 'archive') {
    affected.forEach(t => pushVersionFrom(t, state.currentDay, { active: false }));
  } else if (mode === 'delete') {
    affected.forEach(t => { delete state.tasks[t.id]; });
  }
  // Archive the category's own metadata so past-day versions still resolve to a name/icon.
  const c = state.categories[catId];
  if (c) state.deletedCategories[catId] = { id: catId, name: c.name, icon: c.icon, color: c.color };
  delete state.categories[catId];
  state.categoryOrder = state.categoryOrder.filter(id => id !== catId);
  persist();
}

// ---------- date / task visibility logic ----------
function dateForDay(n) {
  const start = new Date(state.startDate + 'T00:00:00');
  const d = new Date(start);
  d.setDate(d.getDate() + (n - 1));
  return d;
}
function formatDate(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// Returns the version of a task in effect on `day` — this is what makes
// past days keep showing old time/name/duration/category/icon/notes/
// repeat/active-status after an edit.
function versionAsOf(task, day) {
  let chosen = task.versions[0];
  for (const v of task.versions) { if (v.fromDay <= day) chosen = v; }
  return chosen;
}

/**
 * Write a new version effective from `fromDay`, based on the version
 * that was in effect at that day, with `overrides` applied on top.
 * Any existing version scheduled to start on or after `fromDay` is
 * replaced (not stacked), so re-editing "today" twice doesn't leave
 * stray future versions behind.
 *
 * This is the single mechanism both task edits (FIX 1) and
 * activate/deactivate (FIX 2) use, so every editable property —
 * including `active` — is history-safe the same way.
 */
function pushVersionFrom(task, fromDay, overrides) {
  const base = versionAsOf(task, fromDay);
  const newVersion = Object.assign({}, base, overrides, { fromDay });
  task.versions = task.versions.filter(v => v.fromDay < fromDay);
  task.versions.push(newVersion);
  task.versions.sort((a, b) => a.fromDay - b.fromDay);
}

function taskVisibleOnDay(task, day) {
  const v = versionAsOf(task, day);
  if (!v.active) return false;
  if (task.versions[0].fromDay > day) return false;
  if (v.repeat.type === 'custom' && v.repeat.days.length) {
    const wd = WEEKDAYS[dateForDay(day).getDay()];
    if (!v.repeat.days.includes(wd)) return false;
  }
  return true;
}
function visibleTasksInCategory(catId, day) {
  return Object.values(state.tasks)
    .filter(t => versionAsOf(t, day).categoryId === catId && taskVisibleOnDay(t, day))
    .sort((a, b) => a.order - b.order);
}
function isDone(catId, taskId, day) {
  return !!(state.completion[day] && state.completion[day][catId] && state.completion[day][catId][taskId]);
}
function setDone(catId, taskId, day, val) {
  if (!state.completion[day]) state.completion[day] = {};
  if (!state.completion[day][catId]) state.completion[day][catId] = {};
  state.completion[day][catId][taskId] = val;
}
function catTotals(catId, day) {
  const tasks = visibleTasksInCategory(catId, day);
  const done = tasks.filter(t => isDone(catId, t.id, day)).length;
  return { done, total: tasks.length };
}
function dayTotals(day) {
  // Sum totals from every category a task actually belonged to on `day` —
  // NOT from today's live category list. Otherwise, deleting a category
  // later would silently drop its historical contribution from past days'
  // totals (streaks/percentages), which is exactly what FIX 2 must not do.
  // A category that's merely hidden (still exists, just not shown) keeps
  // its existing, disclosed behavior of being excluded from totals; a
  // category that's been fully deleted still counts for the days before
  // its deletion, since those tasks genuinely existed and were tracked then.
  let done = 0, total = 0;
  const seen = new Set();
  Object.values(state.tasks).forEach(t => {
    const catId = versionAsOf(t, day).categoryId;
    if (seen.has(catId)) return;
    seen.add(catId);
    const cat = state.categories[catId];
    const isDeleted = !cat;
    const isVisibleLive = cat && !cat.hidden;
    if (!isDeleted && !isVisibleLive) return; // hidden-but-still-existing category: excluded, unchanged prior behavior
    const t2 = catTotals(catId, day);
    done += t2.done; total += t2.total;
  });
  return { done, total };
}
function dayStatus(day) {
  const { done, total } = dayTotals(day);
  if (total === 0) return 'notstarted';
  if (done === total) return 'completed';
  if (done > 0) return 'inprogress';
  return 'notstarted';
}
function completedDaysCount() {
  let c = 0; for (let i = 1; i <= 100; i++) { if (dayStatus(i) === 'completed') c++; } return c;
}
function currentStreak() {
  let s = 0; for (let i = 1; i <= 100; i++) { if (dayStatus(i) === 'completed') s++; else break; } return s;
}
function longestStreak() {
  let longest = 0, run = 0;
  for (let i = 1; i <= 100; i++) {
    if (dayStatus(i) === 'completed') { run++; longest = Math.max(longest, run); } else run = 0;
  }
  return longest;
}

// ---------- task mutation actions ----------
function _toggleTask(catId, taskId) {
  const day = state.currentDay;
  setDone(catId, taskId, day, !isDone(catId, taskId, day));
  persist();
}
function _addTask(catId, data) {
  const existing = tasksAssignedToCategory(catId, state.currentDay);
  const order = existing.length ? Math.max(...existing.map(t => t.order)) + 1 : 1;
  const id = uid('task_');
  state.tasks[id] = {
    id, order,
    versions: [{
      fromDay: state.currentDay, name: data.name, time: data.time, duration: data.duration, categoryId: catId,
      icon: data.icon, notes: data.notes, repeat: { type: data.repeatType, days: data.repeatDays }, active: true
    }]
  };
  persist();
}
function _editTask(taskId, data, retroactive) {
  const t = state.tasks[taskId];
  if (!t) return;
  // Full snapshot — every editable property is versioned together (FIX 1),
  // including active status (FIX 2), so "apply to all days" vs "from today"
  // behaves consistently no matter which field(s) changed.
  const snapshot = {
    name: data.name, time: data.time, duration: data.duration, categoryId: data.categoryId,
    icon: data.icon, notes: data.notes, repeat: { type: data.repeatType, days: data.repeatDays },
    active: data.active !== undefined ? data.active : versionAsOf(t, state.currentDay).active
  };
  if (retroactive) {
    // Rewrite history: exactly one version, effective from day 1 — no
    // leftover/unnecessary historical versions.
    t.versions = [Object.assign({ fromDay: 1 }, snapshot)];
  } else {
    pushVersionFrom(t, state.currentDay, snapshot);
  }
  persist();
}
function _deleteTask(taskId) {
  delete state.tasks[taskId];
  persist();
}
function _moveTaskOrder(taskId, dir) {
  const t = state.tasks[taskId];
  if (!t) return;
  const catId = versionAsOf(t, state.currentDay).categoryId;
  const siblings = tasksAssignedToCategory(catId, state.currentDay);
  const idx = siblings.findIndex(x => x.id === taskId);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const tmp = siblings[idx].order;
  siblings[idx].order = siblings[swapIdx].order;
  siblings[swapIdx].order = tmp;
  persist();
}

// ---------- misc actions ----------
function _goToDay(n) { if (n >= 1 && n <= 100) { state.currentDay = n; persist(); } }
function _toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; persist(); }
function _resetToday() { state.completion[state.currentDay] = {}; persist(); }
function _resetChallenge() {
  state.pastChallenges.push({ startDate: state.startDate, completion: state.completion, finishedOn: todayISO(), daysCompleted: completedDaysCount() });
  state.completion = {};
  state.currentDay = 1;
  state.startDate = todayISO();
  persist();
}
function _changeStartDate(newDate) { state.startDate = newDate; persist(); }
function _updateOverview(data) { state.overview = Object.assign({}, state.overview, data); persist(); }
function _resetOverview() { state.overview = Object.assign({}, DEFAULT_OVERVIEW); persist(); }
function _addMilestone(data) { state.milestones.push(Object.assign({ id: uid('ms_') }, data)); state.milestones.sort((a, b) => a.day - b.day); persist(); }
function _updateMilestone(id, data) {
  const m = state.milestones.find(x => x.id === id);
  if (!m) return;
  Object.assign(m, data);
  state.milestones.sort((a, b) => a.day - b.day);
  persist();
}
function _deleteMilestone(id) { state.milestones = state.milestones.filter(m => m.id !== id); persist(); }

// ---------- export / import ----------
function exportStateJSON() { return JSON.stringify(state, null, 2); }
function validateImportedState(obj) {
  return obj && typeof obj === 'object' && obj.schemaVersion === 3 &&
    obj.categories && obj.categoryOrder && obj.tasks && obj.completion && obj.overview && obj.milestones;
}
function _importState(obj) {
  if (!validateImportedState(obj)) return false;
  state = obj;
  persist();
  return true;
}

const Actions = {
  toggleTask: _toggleTask, addTask: _addTask, editTask: _editTask, deleteTask: _deleteTask, moveTaskOrder: _moveTaskOrder,
  addCategory: _addCategory, updateCategory: _updateCategory, reorderCategory: _reorderCategory, deleteCategory: _deleteCategory,
  goToDay: _goToDay, toggleTheme: _toggleTheme, resetToday: _resetToday, resetChallenge: _resetChallenge, changeStartDate: _changeStartDate,
  updateOverview: _updateOverview, resetOverview: _resetOverview,
  addMilestone: _addMilestone, updateMilestone: _updateMilestone, deleteMilestone: _deleteMilestone,
  importState: _importState
};
