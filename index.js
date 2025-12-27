/* index.js - ZenStack (Phase 3) */

const STATE_KEY = 'zen_state_v2';
const DEFAULT_COLUMNS = ['todo','in-progress','done'];
const PRIORITY_ORDER = ['High','Medium','Low'];

const app = {
  state: { tasks: [], notes: [] }
};

// Utilities
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));
const t = id => document.getElementById(id);

function loadState(){ try{ const s = JSON.parse(localStorage.getItem(STATE_KEY)); if(s) app.state = s; } catch(e){ app.state = {tasks:[],notes:[],statsHistory:[],selectedCategory:null}; } finally { app.state.tasks = app.state.tasks || []; app.state.notes = app.state.notes || []; app.state.statsHistory = app.state.statsHistory || []; app.state.selectedCategory = app.state.selectedCategory || null;
    // migrate older tasks that used `column` as category/status into {category,status}
    app.state.tasks = app.state.tasks.map(t => {
      const copy = Object.assign({}, t);
      if(!copy.status){
        // if column looks like a status, treat as status, else treat as category
        if(['todo','in-progress','done'].includes(copy.column)){
          copy.status = copy.column;
          copy.category = copy.category || null;
        } else {
          copy.category = copy.column || copy.category || null;
          copy.status = copy.done ? 'done' : (copy.status || 'todo');
        }
      }
      // ensure defaults
      copy.status = copy.status || 'todo';
      copy.category = copy.category || null;
      copy.done = !!copy.done;
      copy.priority = copy.priority || 'Medium';
      // remove legacy `column` to avoid confusion
      delete copy.column;
      return copy;
    });
  } }
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(app.state)); }

// Render helpers
function render(){ renderCategoryBar(); renderCategoryTasks(); renderBoard(); renderNotes(); renderStats(); }

// -------- Clock & Weather --------
function startClock(){ const el = t('clock'); function tick(){ el.textContent = new Date().toLocaleTimeString(); } tick(); setInterval(tick,1000); }

// -------- Board --------
function renderBoard(){
  const sel = app.state.selectedCategory || null;
  DEFAULT_COLUMNS.forEach(col => {
    const columnEl = qs(`.column[data-column="${col}"]`);
    const container = qs(`.cards[data-column="${col}"]`);
    if(!columnEl || !container) return;
    columnEl.style.display = '';
    container.innerHTML = '';
    const items = app.state.tasks.filter(x=>x.status===col);
    items.forEach(it => {
      const tpl = qs('#task-template').content.cloneNode(true);
      const article = tpl.querySelector('.card');
      article.dataset.id = it.id;
      // title & time
      article.querySelector('[data-role="title"]').textContent = it.title;
      article.querySelector('[data-role="time"]').textContent = new Date(it.created).toLocaleString();
      // category badge
      const badge = article.querySelector('[data-role="category"]');
      badge.textContent = it.category ? (it.category.replace(/-/g,' ')) : '';
      // priority badge
      const pEl = article.querySelector('[data-role="priority"]');
      if(pEl){ pEl.textContent = it.priority || 'Medium';
        pEl.classList.remove('priority-high','priority-medium','priority-low');
        pEl.classList.add('priority-' + ((it.priority||'Medium').toLowerCase()));
      }
      // completion checkbox
      const cb = article.querySelector('.done-toggle');
      if(cb) cb.checked = !!it.done;
      if(it.done) article.classList.add('completed'); else article.classList.remove('completed');
      article.setAttribute('draggable','true');
      article.classList.add('card');
      // add minimal enter animation
      article.dataset.state = 'enter';
      // event delegation will handle buttons and checkbox
      container.appendChild(article);
    });
  });
}

function addTask(title, category='work', priority='Medium'){ if(!title||!title.trim()) return; const task = { id: uid(), title: title.trim(), category, status: 'todo', created: Date.now(), done: false, priority: priority || 'Medium' }; app.state.tasks.unshift(task); recordStatsSnapshot(true); saveState(); render(); }

// Delegated events for board (delete/edit via event delegation)
function setupBoardInteractions(){
  // form
  const form = t('task-form');
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const title = t('task-title').value; const category = t('task-column').value; const prBtn = t('task-priority-btn'); const priority = prBtn && prBtn.dataset.priority ? prBtn.dataset.priority : 'Medium'; addTask(title,category,priority); form.reset(); // reset priority button to default
    if(t('task-priority-btn')){ t('task-priority-btn').dataset.priority = 'Medium'; t('task-priority-btn').textContent = 'Priority: Medium'; t('task-priority-btn').setAttribute('aria-pressed','false'); }
    t('task-title').focus(); });

  // click delegation (delete/edit handled here)
  qs('.board-grid').addEventListener('click', (e)=>{
    const del = e.target.closest('.delete');
    const edit = e.target.closest('.edit');
    if(del){ const card = e.target.closest('.card'); const id = card && card.dataset.id; if(id){ app.state.tasks = app.state.tasks.filter(x=>x.id!==id); recordStatsSnapshot(); saveState(); render(); }}
    if(edit){ const card = e.target.closest('.card'); const id = card && card.dataset.id; if(!id) return; const task = app.state.tasks.find(x=>x.id===id); const next = prompt('Edit task', task.title); if(next!=null){ task.title = next.trim(); saveState(); renderBoard(); }}
    // priority badge click -> cycle priority
    const p = e.target.closest('.priority-badge');
    if(p){ const card = e.target.closest('.card'); if(!card) return; const id = card.dataset.id; if(!id) return; const task = app.state.tasks.find(x=>x.id===id); if(!task) return; task.priority = cyclePriority(task.priority || 'Medium'); saveState(); render(); }
  });
  // completion toggle (delegated)
  qs('.board-grid').addEventListener('change', (e)=>{
    const cb = e.target.closest('.done-toggle');
    if(cb){ const card = e.target.closest('.card'); const id = card && card.dataset.id; if(!id) return; const task = app.state.tasks.find(x=>x.id===id); task.done = !!cb.checked; task.status = task.done ? 'done' : 'todo'; recordStatsSnapshot(true); saveState(); render(); }
  });

  // drag & drop (update task status on drop)
  qsa('.cards').forEach(col => {
    col.addEventListener('dragover', (e)=>{ e.preventDefault(); col.classList.add('over'); e.dataTransfer.dropEffect='move'; });
    col.addEventListener('dragleave', ()=> col.classList.remove('over'));
    col.addEventListener('drop', (e)=>{
      e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); const task = app.state.tasks.find(x=>x.id===id); if(task){ task.status = col.dataset.column; task.done = task.status === 'done'; recordStatsSnapshot(true); saveState(); render(); }
    });
  });

  // enable dragging on created elements (event delegation for dragstart)
  qs('.board-grid').addEventListener('dragstart', (e)=>{ const card = e.target.closest('.card'); if(!card) return; e.dataTransfer.setData('text/plain', card.dataset.id); setTimeout(()=>card.classList.add('dragging'),0); });
  qs('.board-grid').addEventListener('dragend', (e)=>{ const card = e.target.closest('.card'); if(card) card.classList.remove('dragging'); });
}

function cyclePriority(cur){ const idx = PRIORITY_ORDER.indexOf(cur); const next = (idx === -1) ? 0 : (idx + 1) % PRIORITY_ORDER.length; return PRIORITY_ORDER[next]; }

// -------- Notes --------
function renderNotes(){
  const list = t('notes-list');
  list.innerHTML = '';
  app.state.notes.forEach(n=>{
    const tpl = qs('#note-template').content.cloneNode(true);
    const li = tpl.querySelector('.note-card');
    li.dataset.id = n.id;
    li.querySelector('[data-role="title"]').textContent = n.title||'Untitled';
    li.querySelector('[data-role="meta"]').textContent = new Date(n.updated||n.created).toLocaleString();
    // add edit button only for notes that have content (considered saved)
    if((n.title && n.title.trim()) || (n.body && n.body.trim())){
      const btn = document.createElement('button');
      btn.className = 'note-edit';
      btn.textContent = 'Edit';
      btn.type = 'button';
      btn.dataset.id = n.id;
      li.appendChild(btn);
    }
    list.appendChild(li);
  });
  // hide the editor if no note is selected
  const editor = t('note-editor');
  const titleInput = t('note-title');
  if(editor){ if(!(titleInput && titleInput.dataset && titleInput.dataset.id)) editor.hidden = true; }
}
function createNoteEditor(){
  if(t('note-editor')) return t('note-editor');
  const area = qs('.notes-area');
  if(!area) return null;
  const editor = document.createElement('div');
  editor.className = 'note-editor';
  editor.id = 'note-editor';
  editor.innerHTML = `
    <label for="note-title">Title</label>
    <input id="note-title" />
    <label for="note-body">Body</label>
    <textarea id="note-body" rows="6"></textarea>
    <div class="note-actions">
      <button id="save-note" class="save-note-btn">Save</button>
      <button id="delete-note" class="delete-note">Delete</button>
      <button id="editor-edit" class="editor-edit" type="button">Edit</button>
    </div>`;
  area.appendChild(editor);
  // wire actions for the dynamic editor and enforce title requirement
  const titleEl = editor.querySelector('#note-title');
  const bodyEl = editor.querySelector('#note-body');
  const saveBtn = editor.querySelector('#save-note');
  const deleteBtn = editor.querySelector('#delete-note');
  const editBtn = editor.querySelector('#editor-edit');

  // disable save until a non-empty title is present
  saveBtn.disabled = true;
  titleEl.addEventListener('input', ()=>{ saveBtn.disabled = titleEl.value.trim() === ''; });

  saveBtn.addEventListener('click', saveNoteFromEditor);
  deleteBtn.addEventListener('click', deleteNoteFromEditor);

  // Edit inside the editor toggles inputs to editable and enables save when title present
  editBtn.addEventListener('click', ()=>{
    if(titleEl.hasAttribute('disabled')){
      titleEl.removeAttribute('disabled');
      bodyEl.removeAttribute('disabled');
      saveBtn.disabled = titleEl.value.trim() === '';
      titleEl.focus();
    } else {
      titleEl.setAttribute('disabled','');
      bodyEl.setAttribute('disabled','');
      saveBtn.disabled = true;
    }
  });

  return editor;
}

function newNote(){ const n = { id: uid(), title:'', body:'', created:Date.now(), updated:Date.now() }; app.state.notes.unshift(n); saveState(); renderNotes(); const editor = createNoteEditor(); if(editor){ const titleEl = t('note-title'); const bodyEl = t('note-body'); const saveBtn = t('save-note'); titleEl.value = ''; bodyEl.value = ''; titleEl.dataset.id = n.id; titleEl.removeAttribute('disabled'); bodyEl.removeAttribute('disabled'); saveBtn.disabled = true; titleEl.focus(); } }

function openNote(id, edit){ const n = app.state.notes.find(x=>x.id===id); if(!n) return; const editor = createNoteEditor(); if(!editor) return; const titleEl = t('note-title'); const bodyEl = t('note-body'); const saveBtn = t('save-note'); titleEl.value = n.title||''; bodyEl.value = n.body||''; titleEl.dataset.id = id; if(edit){ titleEl.removeAttribute('disabled'); bodyEl.removeAttribute('disabled'); saveBtn.disabled = titleEl.value.trim() === ''; titleEl.focus(); } else { titleEl.setAttribute('disabled',''); bodyEl.setAttribute('disabled',''); saveBtn.disabled = true; }
}

function saveNoteFromEditor(){ const editor = t('note-editor'); if(!editor) return; const id = t('note-title').dataset.id; if(!id) return; const titleVal = t('note-title').value.trim(); if(!titleVal){ const titleEl = t('note-title'); if(titleEl){ titleEl.focus(); } alert('Please enter a title before saving.'); return; } const n = app.state.notes.find(x=>x.id===id); n.title = titleVal; n.body = t('note-body').value; n.updated = Date.now(); saveState(); renderNotes(); // remove editor after save
  editor.remove(); }

function deleteNoteFromEditor(){ const editor = t('note-editor'); if(!editor) return; const id = t('note-title').dataset.id; if(!id) return; app.state.notes = app.state.notes.filter(x=>x.id!==id); if(t('note-title')){ t('note-title').value=''; t('note-body').value=''; delete t('note-title').dataset.id; } saveState(); renderNotes(); editor.remove(); }

function setupNotesInteractions(){
  t('add-note').addEventListener('click', newNote);

  t('search-note').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase(); const list = t('notes-list'); list.innerHTML = '';
    app.state.notes.filter(n => (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q)).forEach(n=>{ const tpl = qs('#note-template').content.cloneNode(true); const li = tpl.querySelector('.note-card'); li.dataset.id = n.id; li.querySelector('[data-role="title"]').textContent = n.title||'Untitled'; li.querySelector('[data-role="meta"]').textContent = new Date(n.updated||n.created).toLocaleString(); // edit button
      if((n.title && n.title.trim()) || (n.body && n.body.trim())){ const btn = document.createElement('button'); btn.className = 'note-edit'; btn.textContent = 'Edit'; btn.type = 'button'; btn.dataset.id = n.id; li.appendChild(btn); }
      list.appendChild(li); });
  });

  // clicking a note opens it (view mode); clicking its Edit button opens in edit mode
  t('notes-list').addEventListener('click', (e)=>{
    const editBtn = e.target.closest('.note-edit');
    if(editBtn){ const id = editBtn.dataset.id; if(id) openNote(id, true); return; }
    const li = e.target.closest('.note-card'); if(!li) return; openNote(li.dataset.id, false);
  });
}
// Stats helpers
function computeStats(){
  const total = app.state.tasks.length;
  const done = app.state.tasks.filter(t=>t.done).length;
  const percent = total ? Math.round((done/total)*100) : 0;
  const history = app.state.statsHistory || [];
  return { total, done, percent, history };
}

function recordStatsSnapshot(force=false){
  app.state.statsHistory = app.state.statsHistory || [];
  const done = app.state.tasks.filter(t=>t.done).length;
  const last = app.state.statsHistory[app.state.statsHistory.length-1];
  if(!force && last && last.done === done) return;
  app.state.statsHistory.push({t: Date.now(), done});
  if(app.state.statsHistory.length > 20) app.state.statsHistory.splice(0, app.state.statsHistory.length - 20);
  saveState();
}

function renderStats(){
  // compute counts by status
  const total = app.state.tasks.length;
  const counts = { todo:0, 'in-progress':0, done:0 };
  app.state.tasks.forEach(tk => { const s = tk.status || 'todo'; counts[s] = (counts[s]||0) + 1; });
  const done = counts.done;
  const percent = total ? Math.round((done/total)*100) : 0;
  if(t('stat-total')) t('stat-total').textContent = total;
  if(t('stat-done')) t('stat-done').textContent = done;
  if(t('stat-todo-count')) t('stat-todo-count').textContent = counts.todo;
  if(t('stat-inprogress-count')) t('stat-inprogress-count').textContent = counts['in-progress'];
  if(t('stat-progress')) t('stat-progress').textContent = percent + '%';
  if(t('stat-progress-fill')) t('stat-progress-fill').style.width = percent + '%';
  const svg = t('stat-sparkline');
  if(!svg) return;
  const data = app.state.statsHistory.map(h=>h.done);
  if(!data.length){ svg.innerHTML = ''; return; }
  // compute sizes from the SVG element (fallback to defaults)
  const w = parseInt(svg.getAttribute('width')) || svg.clientWidth || 180;
  const h = parseInt(svg.getAttribute('height')) || svg.clientHeight || 48;
  const pad = 6;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const step = (w - pad*2) / Math.max(1, data.length - 1);
  const points = data.map((v,i) => {
    const x = pad + i*step;
    const y = pad + (1 - (v - min)/range) * (h - pad*2);
    return `${x},${y}`;
  }).join(' ');
  svg.innerHTML = `<polyline points="${points}" stroke="var(--accent)" stroke-width="2" fill="none" />`;
}

function renderCategoryBar(){
  const bar = t('category-bar'); if(!bar) return;
  const sel = app.state.selectedCategory || null;
  qsa('.category-btn', bar).forEach(b => {
    const val = b.dataset.col || 'all';
    if((!sel && val==='all') || (sel && val===sel)){
      b.classList.add('active'); b.setAttribute('aria-pressed','true');
    } else { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); }
  });
}

function renderCategoryTasks(){
  const list = t('category-list'); if(!list) return;
  const sel = app.state.selectedCategory || null;
  list.innerHTML = '';
  if(!sel){ list.hidden = true; return; }
  list.hidden = false;
  // show tasks in this category (all statuses)
  const items = app.state.tasks.filter(x => x.category === sel);
  if(!items.length){ list.innerHTML = '<div class="category-empty">No tasks in this category</div>'; return; }
  items.forEach(it=>{
    const div = document.createElement('div'); div.className = 'category-task'; div.dataset.id = it.id;
    const left = document.createElement('div'); left.className = 'ct-left';
    const title = document.createElement('div'); title.className = 'ct-title'; title.textContent = it.title;
    const meta = document.createElement('div'); meta.className = 'ct-meta'; meta.textContent = new Date(it.created).toLocaleDateString() + ' • ' + (it.status || 'todo');
    left.appendChild(title); left.appendChild(meta);
    const badge = document.createElement('div'); badge.className = 'status-badge'; badge.textContent = (it.status || 'todo').replace(/-/g,' ');
    div.appendChild(left); div.appendChild(badge);
    list.appendChild(div);
  });
}

function setupCategoryBarInteractions(){
  const bar = t('category-bar'); if(!bar) return;
  bar.addEventListener('click', (e)=>{
    const btn = e.target.closest('.category-btn'); if(!btn) return;
    const col = btn.dataset.col;
    const val = col === 'all' ? null : col;
    // toggle: if already selected, deselect
    app.state.selectedCategory = (app.state.selectedCategory === val) ? null : val;
    saveState(); render();
  });
}

function setupCategoryListInteractions(){
  const list = t('category-list'); if(!list) return;
  list.addEventListener('click', (e)=>{
    const item = e.target.closest('.category-task'); if(!item) return;
    const id = item.dataset.id; if(!id) return;
    // find card in board and scroll to it, highlight briefly
    const card = qs(`.card[data-id="${id}"]`);
    if(card){ card.scrollIntoView({behavior:'smooth',block:'center'}); card.classList.add('outlined'); setTimeout(()=>card.classList.remove('outlined'),2200); }
  });
}

// initialize priority toggle button in the form
function setupPrioritySelector(){ const btn = t('task-priority-btn'); if(!btn) return; btn.addEventListener('click', ()=>{ const cur = btn.dataset.priority || 'Medium'; const next = cyclePriority(cur); btn.dataset.priority = next; btn.textContent = 'Priority: ' + next; btn.setAttribute('aria-pressed', next === 'High' ? 'true' : 'false'); }); }

// -------- Clock & Weather --------
function startClock(){ const el = t('clock'); function tick(){ el.textContent = new Date().toLocaleTimeString(); } tick(); setInterval(tick,1000); }

async function fetchWeather(lat,lon){ const el = t('weather'); try{ const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`); if(!res.ok) throw new Error('failed'); const data = await res.json(); if(data && data.current_weather){ const cw = data.current_weather; el.textContent = `${cw.temperature}°C • wind ${cw.windspeed} km/h`; } else el.textContent = 'No data'; }catch(e){ el.textContent = 'Unavailable'; } }

function startWeather(){ if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(pos => fetchWeather(pos.coords.latitude,pos.coords.longitude), ()=>{ t('weather').textContent = 'Location denied'; }); } else t('weather').textContent = 'No geolocation'; }

// -------- Theme --------
function applyTheme(them){ const root = document.documentElement; const btn = t('theme-toggle'); if(them==='dark'){ root.setAttribute('data-theme','dark'); btn.setAttribute('aria-pressed','true'); btn.textContent='☀️'; } else { root.setAttribute('data-theme','light'); btn.setAttribute('aria-pressed','false'); btn.textContent='🌙'; } }
function setupTheme(){ const saved = localStorage.getItem('zen_theme'); const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; const initial = saved || (prefers ? 'dark' : 'light'); applyTheme(initial); t('theme-toggle').addEventListener('click', ()=>{ const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); localStorage.setItem('zen_theme', next); }); }

// -------- Init --------
function init(){ loadState(); recordStatsSnapshot(true); render(); setupBoardInteractions(); setupNotesInteractions(); setupCategoryBarInteractions(); setupCategoryListInteractions(); startClock(); startWeather(); setupTheme(); setupPrioritySelector(); }

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
