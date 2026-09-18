/**
 * ui.js
 * All DOM rendering plus the global onclick-facing wrapper functions.
 * Wrappers call the matching Actions.* function from state.js, then
 * re-render (and show a toast where useful).
 */

// ---------- UI-only state ----------
let activeTab = 'home';       // 'home' | 'categories' | 'calendar' | 'settings'
let subPage = null;           // when activeTab==='categories': a category id, or null for the list
let viewingDayDetail = null;
let toastTimer = null;
let modalCtx = null;
let pendingCategoryDelete = null; // { catId, step: 'choose'|'movePicker' }

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============================================================
// Action wrappers (called from onclick="" in rendered HTML)
// ============================================================
function toggleTask(catId, taskId) { Actions.toggleTask(catId, taskId); render(); }
function deleteTask(taskId) { Actions.deleteTask(taskId); render(); showToast('Task deleted'); }
function moveTaskOrder(taskId, dir) { Actions.moveTaskOrder(taskId, dir); render(); }
function goToDay(n) { Actions.goToDay(n); render(); }
function switchTab(tab) { activeTab = tab; subPage = null; render(); }
function openCategoryPage(catId) { subPage = catId; render(); }
function backToCategories() { subPage = null; viewingDayDetail = null; render(); }
function toggleTheme() { Actions.toggleTheme(); applyTheme(); render(); }
function resetToday() {
  if (!confirm("Reset today's progress? This clears all completions for today only.")) return;
  Actions.resetToday(); render(); showToast("Today's progress reset");
}
function resetChallenge() {
  if (!confirm('Start a new 100-day challenge? Your current progress will be archived, not deleted.')) return;
  Actions.resetChallenge(); render(); showToast('New challenge started 🌱');
}
function changeStartDate(v) { Actions.changeStartDate(v); render(); }
function toggleCategoryHidden(catId) {
  const c = state.categories[catId];
  Actions.updateCategory(catId, { hidden: !c.hidden });
  render();
}
function reorderCategory(catId, dir) { Actions.reorderCategory(catId, dir); render(); }

// ============================================================
// Task modal (add / edit)
// ============================================================
function openTaskModal(catId, taskId) {
  const isEdit = !!taskId;
  const task = isEdit ? state.tasks[taskId] : null;
  const v = task ? versionAsOf(task, state.currentDay) : { name: '', time: '', duration: '', categoryId: catId, icon: ICON_CHOICES[0], notes: '', repeat: { type: 'daily', days: [] }, active: true };
  modalCtx = {
    taskId,
    icon: v.icon,
    repeatType: v.repeat.type,
    repeatDays: v.repeat.days.slice(),
    categoryId: v.categoryId || catId
  };
  const cats = listCategories({ includeHidden: true });
  document.getElementById('modalRoot').innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <h3>${isEdit ? 'Edit' : 'Add'} Task</h3>
        <div class="field"><label>Task Name</label><input type="text" id="f_name" value="${escapeHtml(v.name || '')}" placeholder="e.g. Morning Walk"></div>
        <div class="field"><label>Category</label>
          <select id="f_category" class="select-input" onchange="modalCtx.categoryId=this.value">
            ${cats.map(c => `<option value="${c.id}" ${c.id === modalCtx.categoryId ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="two-col">
          <div class="field"><label>Time</label><input type="text" id="f_time" value="${escapeHtml(v.time || '')}" placeholder="e.g. 7:30 AM"></div>
          <div class="field"><label>Duration</label><input type="text" id="f_duration" value="${escapeHtml(v.duration || '')}" placeholder="e.g. 30 min"></div>
        </div>
        <div class="field"><label>Icon</label>
          <div class="icon-choices" id="iconChoices">
            ${ICON_CHOICES.map(ic => `<button type="button" class="${ic === modalCtx.icon ? 'sel' : ''}" onclick="pickIcon('${ic}')">${ic}</button>`).join('')}
          </div>
        </div>
        <div class="field"><label>Repeat</label>
          <div class="repeat-choices">
            <button type="button" id="rep_daily" class="${modalCtx.repeatType === 'daily' ? 'sel' : ''}" onclick="setRepeatType('daily')">Every day</button>
            <button type="button" id="rep_custom" class="${modalCtx.repeatType === 'custom' ? 'sel' : ''}" onclick="setRepeatType('custom')">Specific days</button>
          </div>
          <div class="weekday-row" id="weekdayRow" style="display:${modalCtx.repeatType === 'custom' ? 'flex' : 'none'}">
            ${WEEKDAYS.map(w => `<button type="button" class="${modalCtx.repeatDays.includes(w) ? 'sel' : ''}" onclick="toggleWeekday('${w}')">${w}</button>`).join('')}
          </div>
        </div>
        <div class="field"><label>Notes (optional)</label><textarea id="f_notes">${escapeHtml(v.notes || '')}</textarea></div>
        ${isEdit ? `
        <div class="toggle-row">
          <span style="font-size:0.8rem;">Active</span>
          <div class="switch ${v.active ? 'on' : ''}" onclick="this.classList.toggle('on')" id="f_active"><div class="knob"></div></div>
        </div>
        <label class="checkbox-line"><input type="checkbox" id="f_retro"> Apply this change to all days (rewrite history)</label>
        ` : ''}
        <div class="modal-actions">
          ${isEdit ? `<button class="btn btn-danger" onclick="confirmDeleteTask('${taskId}')">Delete</button>` : ''}
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitTaskModal()">Save</button>
        </div>
      </div>
    </div>`;
}
function pickIcon(ic) {
  modalCtx.icon = ic;
  document.querySelectorAll('#iconChoices button').forEach(b => b.classList.toggle('sel', b.textContent === ic));
}
function setRepeatType(type) {
  modalCtx.repeatType = type;
  document.getElementById('rep_daily').classList.toggle('sel', type === 'daily');
  document.getElementById('rep_custom').classList.toggle('sel', type === 'custom');
  document.getElementById('weekdayRow').style.display = type === 'custom' ? 'flex' : 'none';
}
function toggleWeekday(w) {
  const idx = modalCtx.repeatDays.indexOf(w);
  if (idx > -1) modalCtx.repeatDays.splice(idx, 1); else modalCtx.repeatDays.push(w);
  document.querySelectorAll('#weekdayRow button').forEach(b => b.classList.toggle('sel', modalCtx.repeatDays.includes(b.textContent)));
}
function submitTaskModal() {
  const name = document.getElementById('f_name').value.trim();
  if (!name) { alert('Please enter a task name.'); return; }
  const time = document.getElementById('f_time').value.trim();
  const duration = document.getElementById('f_duration').value.trim();
  const notes = document.getElementById('f_notes').value.trim();
  const categoryId = document.getElementById('f_category').value;
  const data = { name, time, duration, notes, icon: modalCtx.icon, repeatType: modalCtx.repeatType, repeatDays: modalCtx.repeatDays, categoryId };
  if (modalCtx.taskId) {
    const retro = document.getElementById('f_retro').checked;
    const willBeActive = document.getElementById('f_active').classList.contains('on');
    data.active = willBeActive;
    Actions.editTask(modalCtx.taskId, data, retro);
    closeModal(); render(); showToast('Task updated');
  } else {
    Actions.addTask(categoryId, data);
    closeModal(); render(); showToast('Task added');
  }
}
function confirmDeleteTask(taskId) {
  if (confirm('Delete this task? This cannot be undone. (Tip: use "Active" off instead to keep its history.)')) {
    deleteTask(taskId);
    closeModal();
  }
}
function closeModal() { document.getElementById('modalRoot').innerHTML = ''; modalCtx = null; }

// ============================================================
// Category modals: add / edit / delete-safety
// ============================================================
function openCategoryModal(catId) {
  const isEdit = !!catId;
  const cat = isEdit ? state.categories[catId] : null;
  modalCtx = { catId, icon: cat ? cat.icon : CATEGORY_ICON_CHOICES[0] };
  document.getElementById('modalRoot').innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <h3>${isEdit ? 'Edit' : 'Add'} Category</h3>
        <div class="field"><label>Category Name</label><input type="text" id="c_name" value="${escapeHtml(cat ? cat.name : '')}" placeholder="e.g. Career, Fitness, Finance"></div>
        <div class="field"><label>Icon</label>
          <div class="icon-choices" id="catIconChoices">
            ${CATEGORY_ICON_CHOICES.map(ic => `<button type="button" class="${ic === modalCtx.icon ? 'sel' : ''}" onclick="pickCategoryIcon('${ic}')">${ic}</button>`).join('')}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitCategoryModal()">Save</button>
        </div>
      </div>
    </div>`;
}
function pickCategoryIcon(ic) {
  modalCtx.icon = ic;
  document.querySelectorAll('#catIconChoices button').forEach(b => b.classList.toggle('sel', b.textContent === ic));
}
function submitCategoryModal() {
  const name = document.getElementById('c_name').value.trim();
  if (!name) { alert('Please enter a category name.'); return; }
  if (modalCtx.catId) {
    Actions.updateCategory(modalCtx.catId, { name, icon: modalCtx.icon });
    showToast('Category updated');
  } else {
    Actions.addCategory(name, modalCtx.icon);
    showToast('Category added');
  }
  closeModal(); render();
}

function startDeleteCategory(catId) {
  const affected = tasksAssignedToCategory(catId, state.currentDay);
  if (affected.length === 0) {
    if (confirm('Delete this category? It has no tasks in it.')) {
      Actions.deleteCategory(catId, 'delete', null);
      if (subPage === catId) subPage = null;
      render(); showToast('Category deleted');
    }
    return;
  }
  pendingCategoryDelete = { catId, count: affected.length };
  renderCategoryDeleteModal();
}
function renderCategoryDeleteModal() {
  const { catId, count } = pendingCategoryDelete;
  const cat = state.categories[catId];
  const others = listCategories({ includeHidden: true }).filter(c => c.id !== catId);
  document.getElementById('modalRoot').innerHTML = `
    <div class="overlay" onclick="if(event.target===this) cancelDeleteCategory()">
      <div class="modal">
        <h3>Delete "${escapeHtml(cat.name)}"?</h3>
        <p style="font-size:0.82rem; color:var(--ink-soft); margin-top:-6px;">This category contains ${count} task${count === 1 ? '' : 's'}. What would you like to do with ${count === 1 ? 'it' : 'them'}?</p>
        <div class="modal-actions" style="flex-direction:column; gap:8px;">
          ${others.length ? `<button class="btn btn-secondary" style="width:100%;" onclick="showMoveTaskPicker()">Move tasks to another category</button>` : ''}
          <button class="btn btn-secondary" style="width:100%;" onclick="finishDeleteCategory('archive')">Archive tasks (keep history, pause tracking)</button>
          <button class="btn btn-danger" style="width:100%;" onclick="finishDeleteCategory('delete')">Delete tasks permanently</button>
          <button class="btn btn-secondary" style="width:100%;" onclick="cancelDeleteCategory()">Cancel</button>
        </div>
        <div id="movePickerArea"></div>
      </div>
    </div>`;
}
function showMoveTaskPicker() {
  const others = listCategories({ includeHidden: true }).filter(c => c.id !== pendingCategoryDelete.catId);
  document.getElementById('movePickerArea').innerHTML = `
    <div class="field" style="margin-top:10px;"><label>Move to</label>
      <select id="movePickerSelect" class="select-input">
        ${others.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="finishDeleteCategory('move')">Confirm Move &amp; Delete Category</button>
  `;
}
function finishDeleteCategory(mode) {
  const { catId } = pendingCategoryDelete;
  const targetCatId = mode === 'move' ? document.getElementById('movePickerSelect').value : null;
  Actions.deleteCategory(catId, mode, targetCatId);
  pendingCategoryDelete = null;
  if (subPage === catId) subPage = null;
  closeModal(); render();
  showToast(mode === 'move' ? 'Tasks moved, category deleted' : mode === 'archive' ? 'Tasks archived, category deleted' : 'Category and tasks deleted');
}
function cancelDeleteCategory() { pendingCategoryDelete = null; closeModal(); }

// ============================================================
// Overview & Milestone customization modals
// ============================================================
function openOverviewModal() {
  const o = state.overview;
  document.getElementById('modalRoot').innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <h3>Customize Overview</h3>
        <div class="field"><label>Title</label><input type="text" id="ov_title" value="${escapeHtml(o.title)}"></div>
        <div class="field"><label>Subtitle</label><input type="text" id="ov_subtitle" value="${escapeHtml(o.subtitle)}"></div>
        <div class="field"><label>Your 100-Day Goal (optional)</label><textarea id="ov_goal" placeholder="e.g. Become job-ready in 100 days">${escapeHtml(o.goal)}</textarea></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="resetOverview()">Reset to Default</button>
          <button class="btn btn-primary" onclick="submitOverviewModal()">Save</button>
        </div>
      </div>
    </div>`;
}
function submitOverviewModal() {
  const title = document.getElementById('ov_title').value.trim() || DEFAULT_OVERVIEW.title;
  const subtitle = document.getElementById('ov_subtitle').value.trim();
  const goal = document.getElementById('ov_goal').value.trim();
  Actions.updateOverview({ title, subtitle, goal });
  closeModal(); render(); showToast('Overview updated');
}
function resetOverview() { Actions.resetOverview(); closeModal(); render(); showToast('Overview reset'); }

function openMilestoneModal(msId) {
  const isEdit = !!msId;
  const m = isEdit ? state.milestones.find(x => x.id === msId) : { day: 50, icon: '🏆', label: '' };
  modalCtx = { msId, icon: m.icon };
  document.getElementById('modalRoot').innerHTML = `
    <div class="overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal">
        <h3>${isEdit ? 'Edit' : 'Add'} Milestone</h3>
        <div class="two-col">
          <div class="field"><label>Day</label><input type="text" id="ms_day" value="${m.day}" inputmode="numeric"></div>
          <div class="field"><label>Icon</label><input type="text" id="ms_icon" value="${escapeHtml(m.icon)}"></div>
        </div>
        <div class="field"><label>Label</label><input type="text" id="ms_label" value="${escapeHtml(m.label)}" placeholder="e.g. 30-Day Consistency"></div>
        <div class="modal-actions">
          ${isEdit ? `<button class="btn btn-danger" onclick="deleteMilestone('${msId}')">Delete</button>` : ''}
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitMilestoneModal()">Save</button>
        </div>
      </div>
    </div>`;
}
function submitMilestoneModal() {
  const day = Math.max(1, Math.min(100, parseInt(document.getElementById('ms_day').value, 10) || 1));
  const icon = document.getElementById('ms_icon').value.trim() || '🏁';
  const label = document.getElementById('ms_label').value.trim() || `Day ${day}`;
  if (modalCtx.msId) Actions.updateMilestone(modalCtx.msId, { day, icon, label });
  else Actions.addMilestone({ day, icon, label });
  closeModal(); render(); showToast('Milestone saved');
}
function deleteMilestone(msId) {
  if (confirm('Delete this milestone?')) { Actions.deleteMilestone(msId); closeModal(); render(); showToast('Milestone deleted'); }
}

// ============================================================
// Import / Export
// ============================================================
function exportData() {
  const json = exportStateJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `100-days-challenge-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}
function triggerImport() { document.getElementById('importFileInput').click(); }
function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!confirm('Import this file? It will replace your current data (your current data is not automatically backed up).')) return;
      const ok = Actions.importState(obj);
      if (ok) { render(); showToast('Data imported'); }
      else alert('This file doesn\'t look like a valid backup for this app.');
    } catch (e) {
      alert('Could not read that file — make sure it\'s a JSON backup exported from this app.');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// ============================================================
// Page rendering
// ============================================================
function render() {
  const app = document.getElementById('app');
  let body;
  if (activeTab === 'home') body = renderHome();
  else if (activeTab === 'categories') body = subPage ? renderCategoryTaskPage(subPage) : renderCategoriesList();
  else if (activeTab === 'calendar') body = renderCalendar();
  else if (activeTab === 'settings') body = renderSettings();

  app.innerHTML = `
    <header class="top">
      <div class="row-between" style="max-width:100%;">
        <div>
          <h1>${escapeHtml(state.overview.title)}</h1>
          <div class="sub">${escapeHtml(state.overview.subtitle)}</div>
        </div>
        <button class="edit-overview-btn" onclick="openOverviewModal()" title="Customize Overview">✏️</button>
      </div>
    </header>
    ${body}
    <div id="toast" class="toast"></div>
    <input type="file" id="importFileInput" accept="application/json" style="display:none" onchange="handleImportFile(this)">
    <nav class="bottom">
      <button class="${activeTab === 'home' ? 'active' : ''}" onclick="switchTab('home')"><span class="ic">🏠</span>Home</button>
      <button class="${activeTab === 'categories' ? 'active' : ''}" onclick="switchTab('categories')"><span class="ic">🗂️</span>Categories</button>
      <button class="${activeTab === 'calendar' ? 'active' : ''}" onclick="switchTab('calendar')"><span class="ic">📅</span>Calendar</button>
      <button class="${activeTab === 'settings' ? 'active' : ''}" onclick="switchTab('settings')"><span class="ic">⚙️</span>Settings</button>
    </nav>
  `;
  document.getElementById('modalRoot') || (() => { const d = document.createElement('div'); d.id = 'modalRoot'; document.body.appendChild(d); })();
}

function renderHome() {
  const day = state.currentDay;
  const { done, total } = dayTotals(day);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const overallPct = Math.round((completedDaysCount() / 100) * 100);
  const streak = currentStreak();
  const longest = longestStreak();
  const ringDeg = Math.round(pct * 3.6);
  const finished = completedDaysCount() >= 100;
  const cats = listCategories();

  const catCards = cats.length ? cats.map(c => {
    const t = catTotals(c.id, day);
    const p = t.total ? Math.round((t.done / t.total) * 100) : 0;
    return `<div class="cat-card" style="background:${hexToRgba(c.color, 0.10)}; border-color:${hexToRgba(c.color, 0.35)};" onclick="switchTab('categories'); openCategoryPage('${c.id}')">
      <div class="ic">${c.icon}</div>
      <div class="nm">${escapeHtml(c.name)}</div>
      <div class="cnt">${t.done} / ${t.total} completed</div>
      <div class="mini-bar"><div class="mini-fill" style="width:${p}%; background:${c.color};"></div></div>
    </div>`;
  }).join('') : `<div class="empty-note">No categories yet.<br><button class="add-btn" style="margin-top:10px;" onclick="switchTab('categories')">＋ Create Category</button></div>`;

  const milestonesHtml = state.milestones.slice().sort((a, b) => a.day - b.day).map(m => {
    const unlocked = completedDaysCount() >= m.day;
    return `<div class="milestone ${unlocked ? 'unlocked' : ''}"><div class="mi">${m.icon}</div><div class="ml">Day ${m.day}<br>${escapeHtml(m.label)}</div></div>`;
  }).join('');

  return `
    <div class="screen">
      ${finished ? `
      <div class="card complete-banner">
        🎉 100 DAYS COMPLETE!
        <div class="msg">You completed ${completedDaysCount()} days with a longest streak of ${longest}. Incredible consistency.</div>
        <div class="modal-actions" style="margin-top:12px;">
          <button class="btn btn-primary" style="background:var(--bg); color:var(--accent);" onclick="resetChallenge()">Start New 100 Days Challenge</button>
        </div>
      </div>` : ''}

      ${state.overview.goal ? `<div class="card" style="text-align:center;"><div style="font-size:0.7rem; color:var(--ink-soft); font-weight:700; letter-spacing:0.4px; text-transform:uppercase;">Your Goal</div><div style="font-size:0.92rem; font-weight:600; margin-top:4px;">${escapeHtml(state.overview.goal)}</div></div>` : ''}

      <div class="card">
        <div class="nav-arrows">
          <button class="arrow-btn" onclick="goToDay(${day - 1})" ${day <= 1 ? 'disabled' : ''}>‹</button>
          <div class="day-badge">Day ${day} / 100</div>
          <button class="arrow-btn" onclick="goToDay(${day + 1})" ${day >= 100 ? 'disabled' : ''}>›</button>
        </div>
        <div class="ring-wrap">
          <div class="ring" style="background:conic-gradient(var(--accent) ${ringDeg}deg, var(--line) 0deg);">
            <div class="ring-inner"><div class="ring-pct">${pct}%</div><div class="ring-cap">Today</div></div>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-num">🔥 ${streak}</div><div class="stat-cap">Current Streak</div></div>
          <div class="stat-box"><div class="stat-num">🏆 ${longest}</div><div class="stat-cap">Longest Streak</div></div>
          <div class="stat-box"><div class="stat-num">${overallPct}%</div><div class="stat-cap">Overall</div></div>
        </div>
      </div>

      <div class="section-title">Today's Overview</div>
      <div class="cat-grid">${catCards}</div>

      <div class="section-title" style="margin-top:16px;">Milestones</div>
      <div class="card"><div class="milestone-strip">${milestonesHtml}</div></div>
    </div>
  `;
}

function renderCategoriesList() {
  const cats = listCategories({ includeHidden: true });
  const day = state.currentDay;
  const rows = cats.map(c => {
    const t = catTotals(c.id, day);
    return `
      <div class="cat-manage-row" style="${c.hidden ? 'opacity:0.5;' : ''}">
        <div class="cat-manage-main" onclick="openCategoryPage('${c.id}')">
          <span class="cat-manage-icon" style="background:${hexToRgba(c.color, 0.15)};">${c.icon}</span>
          <div>
            <div class="cat-manage-name">${escapeHtml(c.name)} ${c.hidden ? '<span class="inactive-tag">Hidden</span>' : ''}</div>
            <div class="cat-manage-meta">${t.done}/${t.total} today</div>
          </div>
        </div>
        <div class="t-order"><button onclick="reorderCategory('${c.id}',-1)">▲</button><button onclick="reorderCategory('${c.id}',1)">▼</button></div>
        <div class="t-actions">
          <button onclick="toggleCategoryHidden('${c.id}')">${c.hidden ? '👁️' : '🙈'}</button>
          <button onclick="openCategoryModal('${c.id}')">✏️</button>
          <button onclick="startDeleteCategory('${c.id}')">🗑️</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="screen">
      <div class="section-title" style="font-size:1.05rem;">🗂️ Categories</div>
      ${cats.length ? rows : `<div class="empty-note">No categories yet.</div>`}
      <button class="add-btn" onclick="openCategoryModal(null)">＋ Add Category</button>
    </div>
  `;
}

function renderCategoryTaskPage(catId) {
  const cat = resolveCategoryMeta(catId);
  const day = state.currentDay;
  const visible = visibleTasksInCategory(catId, day);
  const { done, total } = catTotals(catId, day);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allInCat = tasksAssignedToCategory(catId, day);
  const visibleIds = new Set(visible.map(t => t.id));

  const rows = allInCat.map(t => {
    const v = versionAsOf(t, day);
    const taskDone = isDone(catId, t.id, day);
    const isVisible = visibleIds.has(t.id);
    return `
      <div class="task-item ${taskDone ? 'done' : ''}" style="${isVisible ? '' : 'opacity:0.55;'}">
        <div class="chk" onclick="${isVisible ? `toggleTask('${catId}','${t.id}')` : ''}">${taskDone ? '✅' : ''}</div>
        <div class="t-icon">${v.icon}</div>
        <div class="t-body">
          <div class="t-name">${escapeHtml(v.name)} ${!v.active ? '<span class="inactive-tag">Inactive</span>' : ''}</div>
          <div class="t-meta">${v.time ? escapeHtml(v.time) : ''}${v.duration ? ' · ' + escapeHtml(v.duration) : ''}${v.repeat.type === 'custom' ? ' · ' + v.repeat.days.join(', ') : ''}</div>
          ${v.notes ? `<div class="t-notes">${escapeHtml(v.notes)}</div>` : ''}
        </div>
        <div class="t-order"><button onclick="moveTaskOrder('${t.id}',-1)">▲</button><button onclick="moveTaskOrder('${t.id}',1)">▼</button></div>
        <div class="t-actions"><button onclick="openTaskModal('${catId}','${t.id}')">✏️</button></div>
      </div>`;
  }).join('');

  return `
    <div class="screen">
      <div class="back-row" onclick="backToCategories()"><span class="arrow-ic">←</span><span class="lb">${cat.icon} ${escapeHtml(cat.name)}</span></div>
      <div class="card">
        <div class="row-between" style="margin-bottom:8px;"><span style="font-size:0.8rem; color:var(--ink-soft);">Today's Progress</span><span style="font-weight:700; font-size:0.85rem;">${done}/${total} · ${pct}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${cat.color};"></div></div>
      </div>
      ${allInCat.length ? rows : `<div class="empty-note">No tasks in this category yet.</div>`}
      <button class="add-btn" onclick="openTaskModal('${catId}', null)">＋ Add Task</button>
    </div>
  `;
}

function renderCalendar() {
  if (viewingDayDetail) {
    const d = viewingDayDetail;
    const cats = listCategories();
    const rows = cats.map(c => {
      const t = catTotals(c.id, d);
      const p = t.total ? Math.round((t.done / t.total) * 100) : 0;
      return `<div class="day-detail-cat"><span>${c.icon} ${escapeHtml(c.name)}</span><span style="font-weight:700; color:${c.color};">${t.done}/${t.total} · ${p}%</span></div>`;
    }).join('');
    const overall = dayTotals(d);
    const overallPct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0;
    return `
      <div class="screen">
        <div class="back-row" onclick="viewingDayDetail=null; render();"><span class="arrow-ic">←</span><span class="lb">Day ${d}</span></div>
        <div class="card">
          <div class="date-line" style="margin-bottom:8px;">${formatDate(dateForDay(d))}</div>
          <div class="row-between" style="margin-bottom:8px;"><span style="font-size:0.8rem;color:var(--ink-soft);">Overall</span><span style="font-weight:800;">${overallPct}%</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${overallPct}%; background:var(--accent);"></div></div>
          <div style="margin-top:12px;">${rows || '<div class="empty-note">No categories to show.</div>'}</div>
        </div>
        <button class="add-btn" onclick="goToDay(${d}); switchTab('home');">Open Day ${d}</button>
      </div>
    `;
  }
  let cells = '';
  for (let i = 1; i <= 100; i++) {
    const status = dayStatus(i);
    const dot = status === 'completed' ? '🟢' : status === 'inprogress' ? '🟡' : '⚪';
    cells += `<div class="cal-day ${status} ${i === state.currentDay ? 'current' : ''}" onclick="viewingDayDetail=${i}; render();"><div class="n">${i}</div><div>${dot}</div></div>`;
  }
  return `
    <div class="screen">
      <div class="section-title" style="font-size:1.05rem;">📅 100 Days Calendar</div>
      <div class="card"><div class="cal-grid">${cells}</div>
        <div class="legend"><span>⚪ Not started</span><span>🟡 In progress</span><span>🟢 Completed</span></div>
      </div>
    </div>
  `;
}

function renderSettings() {
  const msRows = state.milestones.slice().sort((a, b) => a.day - b.day).map(m => `
    <div class="cat-manage-row">
      <div class="cat-manage-main" onclick="openMilestoneModal('${m.id}')">
        <span class="cat-manage-icon">${m.icon}</span>
        <div><div class="cat-manage-name">Day ${m.day} — ${escapeHtml(m.label)}</div></div>
      </div>
    </div>`).join('');

  return `
    <div class="screen">
      <div class="section-title" style="font-size:1.05rem;">⚙️ Settings</div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">Appearance</div>
        <div class="toggle-row">
          <span style="font-size:0.85rem;">🌙 Dark Mode</span>
          <div class="switch ${state.theme === 'dark' ? 'on' : ''}" onclick="toggleTheme()"><div class="knob"></div></div>
        </div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">Overview</div>
        <button class="btn btn-secondary" style="width:100%;" onclick="openOverviewModal()">✏️ Customize Overview</button>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">Challenge</div>
        <div class="field"><label>Challenge Start Date</label>
          <input type="text" value="${state.startDate}" onchange="changeStartDate(this.value)" placeholder="YYYY-MM-DD">
        </div>
        <div style="font-size:0.7rem; color:var(--ink-soft); margin-top:-4px;">Format: YYYY-MM-DD. Affects which weekday each day falls on for "specific day" tasks.</div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">Milestones</div>
        ${msRows || '<div class="empty-note">No milestones yet.</div>'}
        <button class="add-btn" onclick="openMilestoneModal(null)">＋ Add Milestone</button>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">Categories</div>
        <button class="btn btn-secondary" style="width:100%;" onclick="switchTab('categories')">🗂️ Manage Categories</button>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top:0;">Data</div>
        <button class="btn btn-secondary" style="width:100%; margin-bottom:8px;" onclick="exportData()">⬇️ Export Backup (.json)</button>
        <button class="btn btn-secondary" style="width:100%; margin-bottom:8px;" onclick="triggerImport()">⬆️ Import Backup</button>
        <button class="btn btn-secondary" style="width:100%; margin-bottom:8px;" onclick="showExport()">View / Copy Raw JSON</button>
        <div id="exportArea"></div>
        <button class="btn btn-secondary" style="width:100%; margin-bottom:8px;" onclick="resetToday()">Reset Today's Progress</button>
        <button class="btn btn-danger" style="width:100%;" onclick="resetChallenge()">Reset Challenge (Start New)</button>
      </div>
    </div>
  `;
}
function showExport() {
  const area = document.getElementById('exportArea');
  area.innerHTML = `<textarea id="exportBox" readonly>${escapeHtml(exportStateJSON())}</textarea>
    <button class="btn btn-secondary" style="width:100%; margin:8px 0;" onclick="copyExport()">Copy to Clipboard</button>`;
}
function copyExport() {
  const box = document.getElementById('exportBox');
  box.select();
  try { navigator.clipboard.writeText(box.value).then(() => showToast('Copied!')).catch(() => fallbackCopy(box)); }
  catch (e) { fallbackCopy(box); }
}
function fallbackCopy(box) {
  try { document.execCommand('copy'); showToast('Copied!'); } catch (e) { showToast('Copy manually — select the text above'); }
}
