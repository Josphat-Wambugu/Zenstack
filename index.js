

function escapeHtml(s) {
  return s.replace(/[&\"'<>]/g, (c) => ({'&':'&amp;','\"':'&quot;','\'':'&#39;',"<":'&lt;',">":'&gt;'})[c]);
}

// initialize on DOM ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { setupBoard(); setupClockWeather(); setupNotes(); }); else { setupBoard(); setupClockWeather(); setupNotes(); }

/* ----------------- Task Board ----------------- */
const BOARD_KEY = 'zen_board_v1';
let board = [];

function loadBoard() {
  try { board = JSON.parse(localStorage.getItem(BOARD_KEY)) || []; } catch(e){ board = []; }
}
function saveBoard(){ localStorage.setItem(BOARD_KEY, JSON.stringify(board)); }

function renderBoard(){
  const cols = ['todo','in-progress','done'];
  cols.forEach(col => {
    const container = document.querySelector(`.cards[data-column="${col}"]`);
    container.innerHTML = '';
    board.filter(c => c.column === col).forEach(card => {
      const el = document.createElement('div');
      el.className = 'card';
      el.draggable = true;
      el.dataset.id = card.id;
      el.innerHTML = `<div class="title">${escapeHtml(card.title)}</div><div class="actions"><button class="edit">✏️</button><button class="del">🗑️</button></div>`;

      el.querySelector('.del').addEventListener('click', () => { board = board.filter(x => x.id !== card.id); saveBoard(); renderBoard(); });
      el.querySelector('.edit').addEventListener('click', () => {
        const newT = prompt('Edit card title', card.title); if (newT!=null){ card.title = newT.trim(); saveBoard(); renderBoard(); }
      });

      el.addEventListener('dragstart', (e) => { el.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.id); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));

      container.appendChild(el);
    });
  });
}

function addCard(title){ if(!title||!title.trim()) return; board.unshift({ id: Date.now().toString(), title: title.trim(), column: 'todo' }); saveBoard(); renderBoard(); }

function setupBoard(){
  loadBoard(); renderBoard();
  document.getElementById('add-card').addEventListener('click', () => { const v = document.getElementById('new-card'); addCard(v.value); v.value = ''; });
  document.getElementById('new-card').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ addCard(e.target.value); e.target.value=''; }});

  // columns: allow drop
  document.querySelectorAll('.cards').forEach(col => {
    col.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; col.classList.add('over'); });
    col.addEventListener('dragleave', ()=> col.classList.remove('over'));
    col.addEventListener('drop', (e)=>{
      e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); const c = board.find(x=>x.id===id); if(c){ c.column = col.dataset.column; saveBoard(); renderBoard(); }
    });
  });
}

/* ----------------- Clock & Weather ----------------- */
function setupClockWeather(){
  // Clock
  const clockEl = document.getElementById('clock');
  function tick(){ const d = new Date(); clockEl.textContent = d.toLocaleTimeString(); }
  tick(); setInterval(tick,1000);

  // Weather via Open-Meteo (no API key)
  const weatherEl = document.getElementById('weather');
  async function fetchWeather(lat,lon){
    try{
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
      if(!res.ok) throw new Error('Weather fetch failed');
      const data = await res.json();
      if(data && data.current_weather){
        const cw = data.current_weather;
        weatherEl.textContent = `${cw.temperature}°C • wind ${cw.windspeed} km/h • ${cw.weathercode ?? ''}`;
      } else weatherEl.textContent = 'No weather data';
    }catch(e){ weatherEl.textContent = 'Weather unavailable'; }
  }

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos => fetchWeather(pos.coords.latitude,pos.coords.longitude), (err)=>{ weatherEl.textContent='Location denied'; });
  } else {
    weatherEl.textContent = 'Geolocation not supported';
  }
}

/* ----------------- Notes ----------------- */
const NOTES_KEY = 'zen_notes_v1';
let notes = [];
let activeNoteId = null;

function loadNotes(){ try{ notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch(e){ notes = []; } }
function saveNotes(){ localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }

function renderNotes(){ const list = document.getElementById('notes-list'); list.innerHTML=''; notes.forEach(n=>{
  const el = document.createElement('div'); el.className='note-card'; el.dataset.id = n.id; el.innerHTML = `<strong>${escapeHtml(n.title||'Untitled')}</strong><div style="font-size:.85rem;color:var(--muted)">${new Date(n.updated||n.created).toLocaleString()}</div>`;
  el.addEventListener('click', ()=> { openNote(n.id); });
  list.appendChild(el);
}); }

function openNote(id){ const n = notes.find(x=>x.id===id); if(!n) return; activeNoteId = id; document.getElementById('note-title').value = n.title; document.getElementById('note-body').value = n.body; }
function newNote(){ const n = { id: Date.now().toString(), title:'', body:'', created:Date.now(), updated:Date.now() }; notes.unshift(n); saveNotes(); renderNotes(); openNote(n.id); }
function saveActiveNote(){ if(!activeNoteId) return; const n = notes.find(x=>x.id===activeNoteId); if(!n) return; n.title = document.getElementById('note-title').value; n.body = document.getElementById('note-body').value; n.updated = Date.now(); saveNotes(); renderNotes(); }
function deleteActiveNote(){ if(!activeNoteId) return; notes = notes.filter(x=>x.id!==activeNoteId); activeNoteId = null; document.getElementById('note-title').value=''; document.getElementById('note-body').value=''; saveNotes(); renderNotes(); }

function setupNotes(){ loadNotes(); renderNotes();
  document.getElementById('add-note').addEventListener('click', newNote);
  document.getElementById('save-note').addEventListener('click', saveActiveNote);
  document.getElementById('delete-note').addEventListener('click', deleteActiveNote);
  document.getElementById('search-note').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase(); const filtered = notes.filter(n => (n.title||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q));
    const list = document.getElementById('notes-list'); list.innerHTML = '';
    filtered.forEach(n=>{ const el = document.createElement('div'); el.className='note-card'; el.dataset.id=n.id; el.innerHTML=`<strong>${escapeHtml(n.title||'Untitled')}</strong><div style="font-size:.85rem;color:var(--muted)">${new Date(n.updated||n.created).toLocaleString()}</div>`; el.addEventListener('click', ()=>openNote(n.id)); list.appendChild(el); });
  });

  // autosave on edit (debounced)
  let timer = null; ['note-title','note-body'].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('input', ()=>{
      if(timer) clearTimeout(timer); timer = setTimeout(()=>{ saveActiveNote(); }, 700);
    });
  });
}
