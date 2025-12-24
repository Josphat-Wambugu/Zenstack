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

function loadState(){ try{ const s = JSON.parse(localStorage.getItem(STATE_KEY)); if(s) app.state = s; } catch(e){ app.state = {tasks:[],notes:[]}; } }
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(app.state)); }

// Render helpers
function render(){ renderBoard(); renderNotes(); }

// -------- Board --------
function renderBoard(){
  DEFAULT_COLUMNS.forEach(col => {
    const container = qs(`.cards[data-column="${col}"]`);
    container.innerHTML = '';
    const items = app.state.tasks.filter(x=>x.column===col);
    items.forEach(it => {
      const tpl = qs('#task-template').content.cloneNode(true);
      const article = tpl.querySelector('.card');
      article.dataset.id = it.id;
      article.querySelector('[data-role="title"]').textContent = it.title;
      article.querySelector('[data-role="time"]').textContent = new Date(it.created).toLocaleString();
      article.setAttribute('draggable','true');
      article.classList.add('card');
      // add minimal enter animation
      article.dataset.state = 'enter';
      // event delegation will handle buttons
      container.appendChild(article);
    });
  });
}

function addTask(title, column='todo'){ if(!title||!title.trim()) return; const task = { id: uid(), title: title.trim(), column, created: Date.now() }; app.state.tasks.unshift(task); saveState(); renderBoard(); }

// Delegated events for board (delete/edit via event delegation)
function setupBoardInteractions(){
  // form
  const form = t('task-form');
  form.addEventListener('submit', (e)=>{ e.preventDefault(); const title = t('task-title').value; const column = t('task-column').value; addTask(title,column); form.reset(); t('task-title').focus(); });

  // click delegation
  qs('.board-grid').addEventListener('click', (e)=>{
    const del = e.target.closest('.delete');
    const edit = e.target.closest('.edit');
    if(del){ const card = e.target.closest('.card'); const id = card && card.dataset.id; if(id){ app.state.tasks = app.state.tasks.filter(x=>x.id!==id); saveState(); renderBoard(); }}
    if(edit){ const card = e.target.closest('.card'); const id = card && card.dataset.id; if(!id) return; const task = app.state.tasks.find(x=>x.id===id); const next = prompt('Edit task', task.title); if(next!=null){ task.title = next.trim(); saveState(); renderBoard(); }}
  });

  // drag & drop
  qsa('.cards').forEach(col => {
    col.addEventListener('dragover', (e)=>{ e.preventDefault(); col.classList.add('over'); e.dataTransfer.dropEffect='move'; });
    col.addEventListener('dragleave', ()=> col.classList.remove('over'));
    col.addEventListener('drop', (e)=>{
      e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); const task = app.state.tasks.find(x=>x.id===id); if(task){ task.column = col.dataset.column; saveState(); renderBoard(); }
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

// -------- Clock & Weather --------
function startClock(){ const el = t('clock'); function tick(){ el.textContent = new Date().toLocaleTimeString(); } tick(); setInterval(tick,1000); }

async function fetchWeather(lat,lon){ const el = t('weather'); try{ const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`); if(!res.ok) throw new Error('failed'); const data = await res.json(); if(data && data.current_weather){ const cw = data.current_weather; el.textContent = `${cw.temperature}°C • wind ${cw.windspeed} km/h`; } else el.textContent = 'No data'; }catch(e){ el.textContent = 'Unavailable'; } }

function startWeather(){ if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(pos => fetchWeather(pos.coords.latitude,pos.coords.longitude), ()=>{ t('weather').textContent = 'Location denied'; }); } else t('weather').textContent = 'No geolocation'; }

// -------- Theme --------
function applyTheme(them){ const root = document.documentElement; const btn = t('theme-toggle'); if(them==='dark'){ root.setAttribute('data-theme','dark'); btn.setAttribute('aria-pressed','true'); btn.textContent='☀️'; } else { root.setAttribute('data-theme','light'); btn.setAttribute('aria-pressed','false'); btn.textContent='🌙'; } }
function setupTheme(){ const saved = localStorage.getItem('zen_theme'); const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; const initial = saved || (prefers ? 'dark' : 'light'); applyTheme(initial); t('theme-toggle').addEventListener('click', ()=>{ const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; const next = cur === 'dark' ? 'light' : 'dark'; applyTheme(next); localStorage.setItem('zen_theme', next); }); }

// -------- Init --------
function init(){ loadState(); render(); setupBoardInteractions(); setupNotesInteractions(); startClock(); startWeather(); setupTheme(); }

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
