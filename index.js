/* index.js - ZenStack (Phase 3) */

const STATE_KEY = 'zen_state_v2';
const DEFAULT_COLUMNS = ['todo','in-progress','done'];

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
      // remove legacy `column` to avoid confusion
      delete copy.column;
      return copy;
    });
  } }
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(app.state)); }

// Render helpers
function render(){ renderCategoryBar(); renderBoard(); renderNotes(); renderStats(); }

// -------- Board --------
function renderBoard(){
  const sel = app.state.selectedCategory || null;
  DEFAULT_COLUMNS.forEach(col => {
    const columnEl = qs(`.column[data-column="${col}"]`);
    const container = qs(`.cards[data-column="${col}"]`);
    if(!columnEl || !container) return;
    // when a category is selected, still show the 3 columns but hide items not matching category
    columnEl.style.display = '';
    container.innerHTML = '';
    const items = app.state.tasks.filter(x=>x.status===col && (!sel || x.category === sel));
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

function addTask(title, category='work'){ if(!title||!title.trim()) return; const task = { id: uid(), title: title.trim(), category, status: 'todo', created: Date.now(), done: false }; app.state.tasks.unshift(task); recordStatsSnapshot(true); saveState(); render(); }

// Delegated events for board (delete/edit via event delegation)
function setupBoardInteractions(){
  // form
  const form = t('task-form');
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const title = t('task-title').value; const category = t('task-column').value; addTask(title,category); form.reset(); t('task-title').focus(); });

  // click delegation
  qs('.board-grid').addEventListener('click', (e)=>{
    const del = e.target.closest('.delete');
    const edit = e.target.closest('.edit');
    if(del){ const card = e.target.closest('.card'); const id = card && card.dataset.id; if(id){ app.state.tasks = app.state.tasks.filter(x=>x.id!==id); recordStatsSnapshot(); saveState(); render(); }}
    if(edit){ const card = e.target.closest('.card'); const id = card && card.dataset.id; if(!id) return; const task = app.state.tasks.find(x=>x.id===id); const next = prompt('Edit task', task.title); if(next!=null){ task.title = next.trim(); saveState(); renderBoard(); }}
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

// -------- Notes --------
function renderNotes(){ const list = t('notes-list'); list.innerHTML = ''; app.state.notes.forEach(n=>{ const tpl = qs('#note-template').content.cloneNode(true); const li = tpl.querySelector('.note-card'); li.dataset.id = n.id; li.querySelector('[data-role="title"]').textContent = n.title||'Untitled'; li.querySelector('[data-role="meta"]').textContent = new Date(n.updated||n.created).toLocaleString(); list.appendChild(li); }); }

function newNote(){ const n = { id: uid(), title:'', body:'', created:Date.now(), updated:Date.now() }; app.state.notes.unshift(n); saveState(); renderNotes(); openNote(n.id); }
function openNote(id){ const n = app.state.notes.find(x=>x.id===id); if(!n) return; t('note-title').value = n.title; t('note-body').value = n.body; t('note-title').dataset.id = id; }
function saveNoteFromEditor(){ const id = t('note-title').dataset.id; if(!id) return; const n = app.state.notes.find(x=>x.id===id); n.title = t('note-title').value; n.body = t('note-body').value; n.updated = Date.now(); saveState(); renderNotes(); }
function deleteNoteFromEditor(){ const id = t('note-title').dataset.id; if(!id) return; app.state.notes = app.state.notes.filter(x=>x.id!==id); t('note-title').value=''; t('note-body').value=''; delete t('note-title').dataset.id; saveState(); renderNotes(); }

function setupNotesInteractions(){
  t('add-note').addEventListener('click', newNote);
  t('save-note').addEventListener('click', saveNoteFromEditor);
  t('delete-note').addEventListener('click', deleteNoteFromEditor);

  t('search-note').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase(); const list = t('notes-list'); list.innerHTML = '';
    app.state.notes.filter(n => (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q)).forEach(n=>{ const tpl = qs('#note-template').content.cloneNode(true); const li = tpl.querySelector('.note-card'); li.dataset.id = n.id; li.querySelector('[data-role="title"]').textContent = n.title||'Untitled'; li.querySelector('[data-role="meta"]').textContent = new Date(n.updated||n.created).toLocaleString(); list.appendChild(li); });
  });

  t('notes-list').addEventListener('click', (e)=>{ const li = e.target.closest('.note-card'); if(!li) return; openNote(li.dataset.id); });

  // autosave (debounced)
  let timer = null; ['note-title','note-body'].forEach(id => {
    t(id).addEventListener('input', ()=>{ if(timer) clearTimeout(timer); timer = setTimeout(saveNoteFromEditor, 700); });
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
  const s = computeStats();
  if(t('stat-total')) t('stat-total').textContent = s.total;
  if(t('stat-done')) t('stat-done').textContent = s.done;
  if(t('stat-progress')) t('stat-progress').textContent = s.percent + '%';
  if(t('stat-progress-fill')) t('stat-progress-fill').style.width = s.percent + '%';
  const svg = t('stat-sparkline');
  if(!svg) return;
  const data = s.history.map(h=>h.done);
  if(!data.length){ svg.innerHTML = ''; return; }
  const w = 120, h = 36, pad = 4;
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

function setupCategoryBarInteractions(){
  const bar = t('category-bar'); if(!bar) return;
  bar.addEventListener('click', (e)=>{
    const btn = e.target.closest('.category-btn'); if(!btn) return;
    const col = btn.dataset.col;
    app.state.selectedCategory = col === 'all' ? null : col;
    saveState(); render();
  });
}

// -------- Clock & Weather --------
function startClock(){ const el = t('clock'); function tick(){ el.textContent = new Date().toLocaleTimeString(); } tick(); setInterval(tick,1000); }

async function fetchWeather(lat,lon){ const el = t('weather'); try{ const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`); if(!res.ok) throw new Error('failed'); const data = await res.json(); if(data && data.current_weather){ const cw = data.current_weather; el.textContent = `${cw.temperature}°C • wind ${cw.windspeed} km/h`; } else el.textContent = 'No data'; }catch(e){ el.textContent = 'Unavailable'; } }

function startWeather(){ if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(pos => fetchWeather(pos.coords.latitude,pos.coords.longitude), ()=>{ t('weather').textContent = 'Location denied'; }); } else t('weather').textContent = 'No geolocation'; }

// -------- Theme --------
function applyTheme(them){ const root = document.documentElement; const btn = t('theme-toggle'); if(them==='dark'){ root.setAttribute('data-theme','dark'); btn.setAttribute('aria-pressed','true'); btn.textContent='☀️'; } else { root.setAttribute('data-theme','light'); btn.setAttribute('aria-pressed','false'); btn.textContent='🌙'; } }
function setupTheme(){ const saved = localStorage.getItem('zen_theme'); const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; const initial = saved || (prefers ? 'dark' : 'light'); applyTheme(initial); t('theme-toggle').addEventListener('click', ()=>{ const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); localStorage.setItem('zen_theme', next); }); }

// -------- Init --------
function init(){ loadState(); render(); setupBoardInteractions(); setupNotesInteractions(); setupCategoryBarInteractions(); startClock(); startWeather(); setupTheme(); }

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
