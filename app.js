// ═══════════════════════════════════════════════════════════════════
//  Just Rodyy Forever — Main App
// ═══════════════════════════════════════════════════════════════════

import {
  auth, db, storage,
  signInAnonymously, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, onSnapshot,
  collection, addDoc, deleteDoc, query, orderBy, getDocs, serverTimestamp,
  ref, uploadBytes, getDownloadURL
} from './firebase.js';

import { initChat }      from './chat.js';
import { initVideoCall } from './video-call.js';

// ── Users Config ─────────────────────────────────────────────────
const USERS = {
  user1: {
    name: 'Rody 💙',
    code: 'rody2024',   // ← Change these secret codes!
    avatar: 'https://api.dicebear.com/8.x/lorelei/svg?seed=rody&backgroundColor=ffb6c1',
    partnerId: 'user2',
  },
  user2: {
    name: 'My Love 💖',
    code: 'love2024',   // ← Change these secret codes!
    avatar: 'https://api.dicebear.com/8.x/lorelei/svg?seed=love&backgroundColor=c8e6c9',
    partnerId: 'user1',
  },
};

// ── State ────────────────────────────────────────────────────────
let currentUserId  = null;
let partnerUserId  = null;
let unsubPresence  = null;
let counterInterval = null;
let activePage     = 'dashboard';
let bgMusicAudio   = null;
let calendarDate   = new Date();
let calendarEvents = [];
let pendingMemFile = null;

// ── DOM Refs ─────────────────────────────────────────────────────
const loginPage   = document.getElementById('loginPage');
const appShell    = document.getElementById('appShell');
const loginBtn    = document.getElementById('loginBtn');
const loginError  = document.getElementById('loginError');
const eyeBtn      = document.getElementById('eyeBtn');
const accessInput = document.getElementById('accessCode');

// ═══════════════════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════════════════
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx    = canvas.getContext('2d');
  let particles = [];
  let hearts    = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Regular particles
  for (let i = 0; i < 70; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      a: Math.random() * 0.5 + 0.1,
    });
  }

  function spawnHeart() {
    hearts.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 20,
      size: Math.random() * 18 + 8,
      dy: -(Math.random() * 1.2 + 0.5),
      dx: (Math.random() - 0.5) * 0.8,
      a: Math.random() * 0.4 + 0.15,
      rot: Math.random() * Math.PI * 2,
      drot: (Math.random() - 0.5) * 0.03,
    });
  }
  setInterval(spawnHeart, 1200);

  function drawHeart(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x, y - size * 0.5, x - size, y - size * 0.5, x - size, y);
    ctx.bezierCurveTo(x - size, y + size * 0.35, x, y + size * 0.8, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.8, x + size, y + size * 0.35, x + size, y);
    ctx.bezierCurveTo(x + size, y - size * 0.5, x, y - size * 0.5, x, y);
    ctx.fill();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 77, 141, ${p.a})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
    });

    hearts = hearts.filter(h => h.y > -40 && h.a > 0);
    hearts.forEach(h => {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.globalAlpha = h.a;
      ctx.fillStyle = `#ff4d8d`;
      drawHeart(ctx, 0, 0, h.size);
      ctx.restore();
      h.y += h.dy; h.x += h.dx; h.rot += h.drot; h.a -= 0.003;
    });

    requestAnimationFrame(animate);
  }
  animate();
}

// ═══════════════════════════════════════════════════════════════════
//  AUTH / LOGIN
// ═══════════════════════════════════════════════════════════════════
function initLogin() {
  // Show password toggle
  eyeBtn.addEventListener('click', () => {
    const type = accessInput.type === 'password' ? 'text' : 'password';
    accessInput.type = type;
    eyeBtn.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  // Remember me
  const remembered = localStorage.getItem('jrf_remember');
  if (remembered) {
    const saved = JSON.parse(remembered);
    document.getElementById('userSelect').value = saved.userId;
    accessInput.value = saved.code;
    document.getElementById('rememberMe').checked = true;
  }

  loginBtn.addEventListener('click', handleLogin);
  accessInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
}

// Helper: get current language from index.html lang system
function getLang() {
  return (typeof currentLang !== 'undefined' ? currentLang : null)
    || localStorage.getItem('lang') || 'en';
}

async function handleLogin() {
  const userId = document.getElementById('userSelect').value;
  const code   = accessInput.value.trim();
  const lang   = getLang();
  loginError.textContent = '';

  if (!userId) {
    loginError.textContent = lang === 'ar' ? 'اختر هويتك أولاً' : 'Please choose who you are.';
    return;
  }
  if (!code) {
    loginError.textContent = lang === 'ar' ? 'أدخل الرمز السري' : 'Please enter your secret code.';
    return;
  }

  const user = USERS[userId];
  if (!user || code !== user.code) {
    loginError.textContent = lang === 'ar' ? 'رمز خاطئ، حاول مجدداً 🔒' : 'Wrong code. Try again! 🔒';
    return;
  }

  loginBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${lang === 'ar' ? 'جارٍ الدخول…' : 'Entering…'}`;
  loginBtn.disabled = true;

  try {
    await signInAnonymously(auth);
    currentUserId = userId;
    partnerUserId = user.partnerId;

    if (document.getElementById('rememberMe').checked) {
      localStorage.setItem('jrf_remember', JSON.stringify({ userId, code }));
    } else {
      localStorage.removeItem('jrf_remember');
    }
    localStorage.setItem('jrf_userId', userId);

    await launchApp();
    // Init local features (calendar, quotes, memories, todos)
    if (typeof window.initLocalFeatures === 'function') {
      window.initLocalFeatures(userId);
    }
  } catch (err) {
    loginError.textContent = lang === 'ar'
      ? 'خطأ في الاتصال. تحقق من إعدادات Firebase.'
      : 'Connection error. Check Firebase config.';
    loginBtn.innerHTML = lang === 'ar'
      ? '<span>ادخل عالمنا</span><i class="fas fa-arrow-left"></i>'
      : '<span>Enter Our World</span><i class="fas fa-arrow-right"></i>';
    loginBtn.disabled = false;
    console.error(err);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  LAUNCH APP
// ═══════════════════════════════════════════════════════════════════
async function launchApp() {
  loginPage.style.display = 'none';
  appShell.style.display  = 'flex';

  const me      = USERS[currentUserId];
  const partner = USERS[partnerUserId];

  // Sidebar
  document.getElementById('sidebarAvatarImg').src = me.avatar;
  document.getElementById('sidebarName').textContent  = me.name;

  // Dashboard
  document.getElementById('dashGreetName').textContent = me.name.split(' ')[0];
  document.getElementById('partnerAvatar').src  = partner.avatar;
  document.getElementById('partnerName').textContent   = partner.name;

  // Chat header
  document.getElementById('chatPartnerAvatar').src = partner.avatar;
  document.getElementById('chatPartnerName').textContent  = partner.name;

  // Settings
  document.getElementById('settingsAvatar').src = me.avatar;
  document.getElementById('displayNameInput').value = me.name;

  // Ensure user doc
  await setDoc(doc(db, 'users', currentUserId), {
    name: me.name, avatar: me.avatar,
    online: true, lastSeen: serverTimestamp(),
  }, { merge: true });

  // Partner presence
  listenPartnerPresence();

  // Relationship counter
  loadAndStartCounter();

  // Love quote
  showRandomQuote();

  // Navigation
  initNavigation();

  // Chat
  initChat(db, storage, currentUserId, partnerUserId, USERS, serverTimestamp);

  // Video call
  initVideoCall(db, currentUserId, partnerUserId, USERS, serverTimestamp);

  // Calendar
  loadCalendar();

  // Todo
  listenTodos();

  // Settings
  initSettings();

  // Quick actions
  document.getElementById('qaChat').addEventListener('click', () => navigate('chat'));
  document.getElementById('qaCall').addEventListener('click', () => document.getElementById('startCallBtn').click());
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.page); });
  });

  // Unload: set offline
  window.addEventListener('beforeunload', () => {
    setDoc(doc(db, 'users', currentUserId), { online: false, lastSeen: serverTimestamp() }, { merge: true });
  });

  // Theme
  const savedTheme = localStorage.getItem('jrf_theme') || 'dark';
  applyTheme(savedTheme);
}

// ═══════════════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════════════
function initNavigation() {
  document.querySelectorAll('.nav-item[data-page], .mnav[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      navigate(el.dataset.page);
    });
  });
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

function navigate(page) {
  activePage = page;

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item, .mnav').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Scroll to top
  document.getElementById('mainContent').scrollTop = 0;
}

async function handleLogout() {
  await setDoc(doc(db, 'users', currentUserId), { online: false }, { merge: true });
  await signOut(auth);
  currentUserId = null;
  localStorage.removeItem('jrf_userId');
  localStorage.removeItem('jrf_remember');
  appShell.classList.remove('active');
  loginPage.classList.add('active');
  if (unsubPresence) unsubPresence();
  if (counterInterval) clearInterval(counterInterval);
}

// ═══════════════════════════════════════════════════════════════════
//  PARTNER PRESENCE
// ═══════════════════════════════════════════════════════════════════
function listenPartnerPresence() {
  if (unsubPresence) unsubPresence();
  unsubPresence = onSnapshot(doc(db, 'users', partnerUserId), snap => {
    const data = snap.data() || {};
    const isOnline = data.online === true;
    const statusEl = document.getElementById('partnerStatus');
    statusEl.innerHTML = isOnline
      ? '<i class="fas fa-circle" style="color:#22c55e;font-size:9px"></i> Online'
      : '<i class="fas fa-circle" style="color:#64748b;font-size:9px"></i> Offline';
    statusEl.className = 'partner-status' + (isOnline ? ' online-status' : '');
  });
}

// ═══════════════════════════════════════════════════════════════════
//  RELATIONSHIP COUNTER
// ═══════════════════════════════════════════════════════════════════
function loadAndStartCounter() {
  const saved = localStorage.getItem('jrf_startDate');
  if (saved) startCounter(new Date(saved));
  else startCounter(new Date('2024-01-01'));

  document.getElementById('editStartDate').addEventListener('click', () => {
    const inp = document.getElementById('startDateInput');
    inp.classList.toggle('hidden');
    if (!inp.classList.contains('hidden')) {
      inp.value = localStorage.getItem('jrf_startDate') || '';
      inp.focus();
    }
  });
  document.getElementById('startDateInput').addEventListener('change', e => {
    localStorage.setItem('jrf_startDate', e.target.value);
    startCounter(new Date(e.target.value));
    e.target.classList.add('hidden');
  });

  // Anniversary date in settings
  const annInput = document.getElementById('anniversaryDate');
  annInput.value = localStorage.getItem('jrf_startDate') || '';
  document.getElementById('saveAnniversary').addEventListener('click', () => {
    const val = annInput.value;
    if (val) {
      localStorage.setItem('jrf_startDate', val);
      startCounter(new Date(val));
      showToast('💕 Anniversary date saved!');
    }
  });
}

function startCounter(start) {
  if (counterInterval) clearInterval(counterInterval);
  function tick() {
    const now   = new Date();
    const diff  = now - start;
    if (diff < 0) { document.getElementById('cYears').textContent = '0'; return; }

    const totalSec = Math.floor(diff / 1000);
    const mins     = Math.floor(totalSec / 60);
    const hours    = Math.floor(mins / 60);
    const days     = Math.floor(hours / 24);

    let years  = 0, months = 0;
    const s = new Date(start);
    const n = new Date(now);
    years  = n.getFullYear() - s.getFullYear();
    months = n.getMonth() - s.getMonth();
    if (months < 0) { years--; months += 12; }
    const baseDays = new Date(s.getFullYear() + years, s.getMonth() + months, s.getDate());
    const remDays  = Math.floor((n - baseDays) / 86400000);

    document.getElementById('cYears').textContent  = years;
    document.getElementById('cMonths').textContent = months;
    document.getElementById('cDays').textContent   = remDays;
    document.getElementById('cHours').textContent  = n.getHours();
    document.getElementById('cMins').textContent   = String(n.getMinutes()).padStart(2, '0');
  }
  tick();
  counterInterval = setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════════════
//  LOVE QUOTES
// ═══════════════════════════════════════════════════════════════════
const QUOTES = [
  "Every love story is beautiful, but ours is my favorite. 💕",
  "You are my today and all of my tomorrows.",
  "In you, I found the love I always dreamed of.",
  "You make ordinary moments extraordinary. 🌹",
  "My favorite place in all the world is next to you.",
  "Forever is not long enough when I'm with you.",
  "You are the best thing that ever happened to me. 💫",
  "I love you more than words can say.",
  "With you, every day feels like a fairytale. 🌸",
  "You are my sunshine, my only sunshine.",
  "I choose you, over and over, every single day.",
  "My heart found its home the day I found you. 🏠",
  "You are the reason I smile even on the hardest days.",
  "Loving you is the easiest thing I've ever done.",
  "Distance means nothing when someone means everything. 💖",
];

function showRandomQuote() {
  const idx = Math.floor(Math.random() * QUOTES.length);
  document.getElementById('quoteText').textContent = QUOTES[idx];
}
document.getElementById('refreshQuote')?.addEventListener('click', showRandomQuote);

// ═══════════════════════════════════════════════════════════════════
//  MEMORIES
// ═══════════════════════════════════════════════════════════════════
let memoriesUnsub = null;

function initMemories() {
  document.getElementById('uploadMemBtn').addEventListener('click', () => {
    document.getElementById('memFileInput').click();
  });
  document.getElementById('memFileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    pendingMemFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('memPreviewImg').src = ev.target.result;
    };
    reader.readAsDataURL(file);
    document.getElementById('memDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('addMemoryModal').classList.remove('hidden');
  });
  document.getElementById('cancelMemBtn').addEventListener('click', () => {
    document.getElementById('addMemoryModal').classList.add('hidden');
    pendingMemFile = null;
  });
  document.getElementById('saveMemBtn').addEventListener('click', saveMemory);

  if (!memoriesUnsub) {
    memoriesUnsub = onSnapshot(
      query(collection(db, 'memories'), orderBy('date', 'desc')),
      snap => renderMemories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }
}

async function saveMemory() {
  if (!pendingMemFile) return;
  const note = document.getElementById('memNote').value.trim();
  const date = document.getElementById('memDate').value;
  showToast('⏳ Uploading memory…');

  try {
    const storageRef = ref(storage, `memories/${Date.now()}_${pendingMemFile.name}`);
    await uploadBytes(storageRef, pendingMemFile);
    const url = await getDownloadURL(storageRef);
    await addDoc(collection(db, 'memories'), {
      url, note, date, uploadedBy: currentUserId,
      createdAt: serverTimestamp(), favorite: false,
    });
    showToast('✅ Memory saved!');
    document.getElementById('addMemoryModal').classList.add('hidden');
    document.getElementById('memNote').value = '';
    pendingMemFile = null;
  } catch (err) {
    showToast('❌ Upload failed');
    console.error(err);
  }
}

function renderMemories(memories) {
  const grid = document.getElementById('memoriesGrid');
  if (!memories.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;grid-column:1/-1">No memories yet. Add your first one! 📷</p>';
    return;
  }
  grid.innerHTML = memories.map(m => `
    <div class="memory-card" data-id="${m.id}" data-url="${m.url}">
      <img src="${m.url}" alt="memory" loading="lazy" />
      <div class="memory-card-body">
        ${m.note ? `<p class="memory-note">${m.note}</p>` : ''}
        ${m.date ? `<p class="memory-date">${m.date}</p>` : ''}
      </div>
      <button class="memory-fav ${m.favorite ? 'active' : ''}" data-id="${m.id}" title="Favorite">
        <i class="fas fa-heart"></i>
      </button>
    </div>
  `).join('');

  grid.querySelectorAll('.memory-card img').forEach(img => {
    img.addEventListener('click', () => openImagePreview(img.src));
  });
  grid.querySelectorAll('.memory-fav').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id  = btn.dataset.id;
      const mem = memories.find(m => m.id === id);
      await updateDoc(doc(db, 'memories', id), { favorite: !mem.favorite });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  IMAGE PREVIEW
// ═══════════════════════════════════════════════════════════════════
function openImagePreview(src) {
  document.getElementById('previewImg').src = src;
  document.getElementById('downloadImg').href = src;
  document.getElementById('imagePreviewModal').classList.remove('hidden');
}
document.getElementById('closePreview').addEventListener('click', () => {
  document.getElementById('imagePreviewModal').classList.add('hidden');
});
document.getElementById('imagePreviewModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});

// ═══════════════════════════════════════════════════════════════════
//  CALENDAR
// ═══════════════════════════════════════════════════════════════════
function loadCalendar() {
  onSnapshot(collection(db, 'calendarEvents'), snap => {
    calendarEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCalendar();
  });

  document.getElementById('prevMonth').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('addEventBtn').addEventListener('click', () => {
    document.getElementById('addEventModal').classList.remove('hidden');
  });
  document.getElementById('cancelEventBtn').addEventListener('click', () => {
    document.getElementById('addEventModal').classList.add('hidden');
  });
  document.getElementById('saveEventBtn').addEventListener('click', saveCalendarEvent);
}

async function saveCalendarEvent() {
  const name  = document.getElementById('eventName').value.trim();
  const date  = document.getElementById('eventDate').value;
  const color = document.getElementById('eventColor').value;
  if (!name || !date) { showToast('Fill in name & date!'); return; }
  await addDoc(collection(db, 'calendarEvents'), { name, date, color, createdBy: currentUserId });
  document.getElementById('addEventModal').classList.add('hidden');
  document.getElementById('eventName').value = '';
  showToast('📅 Event added!');
}

function renderCalendar() {
  const d     = new Date(calendarDate);
  const year  = d.getFullYear();
  const month = d.getMonth();

  document.getElementById('calMonthLabel').textContent =
    d.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  let html = days.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  // Padding
  for (let i = 0; i < firstDay; i++) {
    const prevDays = new Date(year, month, 0).getDate() - firstDay + i + 1;
    html += `<div class="cal-day other-month">${prevDays}</div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday  = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const hasEvent = calendarEvents.some(e => e.date === dateStr);
    html += `<div class="cal-day${isToday ? ' today' : ''}${hasEvent ? ' has-event' : ''}"
      data-date="${dateStr}">${day}</div>`;
  }

  document.getElementById('calGrid').innerHTML = html;

  // Events list
  const sorted = [...calendarEvents].sort((a, b) => a.date.localeCompare(b.date));
  document.getElementById('calEvents').innerHTML = sorted.length ? sorted.map(ev => `
    <div class="cal-event-item">
      <div class="event-dot" style="background:${ev.color || '#ff4d8d'}"></div>
      <span class="event-name">${ev.name}</span>
      <span class="event-date">${ev.date}</span>
    </div>
  `).join('') : '<p style="color:var(--text-muted);font-size:14px">No events yet. Add one! 🗓️</p>';

  // Click on day to add event
  document.querySelectorAll('.cal-day[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('eventDate').value = el.dataset.date;
      document.getElementById('addEventModal').classList.remove('hidden');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  TODO
// ═══════════════════════════════════════════════════════════════════
function listenTodos() {
  onSnapshot(
    query(collection(db, 'todos'), orderBy('createdAt', 'asc')),
    snap => renderTodos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

  document.getElementById('addTodoBtn').addEventListener('click', addTodo);
  document.getElementById('todoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });
}

async function addTodo() {
  const input = document.getElementById('todoInput');
  const text  = input.value.trim();
  if (!text) return;
  await addDoc(collection(db, 'todos'), {
    text, done: false, createdBy: currentUserId, createdAt: serverTimestamp()
  });
  input.value = '';
}

function renderTodos(todos) {
  const list = document.getElementById('todoList');
  if (!todos.length) {
    list.innerHTML = '<li style="color:var(--text-muted);font-size:14px;text-align:center;padding:20px">Nothing to do! 🎉</li>';
    return;
  }
  list.innerHTML = todos.map(t => `
    <li class="todo-item" data-id="${t.id}">
      <div class="todo-check ${t.done ? 'checked' : ''}" data-id="${t.id}">
        ${t.done ? '<i class="fas fa-check"></i>' : ''}
      </div>
      <span class="todo-text ${t.done ? 'done' : ''}">${t.text}</span>
      <button class="todo-del" data-id="${t.id}"><i class="fas fa-trash"></i></button>
    </li>
  `).join('');

  list.querySelectorAll('.todo-check').forEach(btn => {
    btn.addEventListener('click', async () => {
      const todo = todos.find(t => t.id === btn.dataset.id);
      await updateDoc(doc(db, 'todos', btn.dataset.id), { done: !todo.done });
    });
  });
  list.querySelectorAll('.todo-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      await deleteDoc(doc(db, 'todos', btn.dataset.id));
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════
function initSettings() {
  // Avatar upload
  document.getElementById('changeAvatarBtn').addEventListener('click', () => {
    document.getElementById('avatarFileInput').click();
  });
  document.getElementById('avatarFileInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    showToast('⏳ Uploading avatar…');
    const storageRef = ref(storage, `avatars/${currentUserId}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    document.getElementById('settingsAvatar').src = url;
    document.getElementById('sidebarAvatarImg').src = url;
    await updateDoc(doc(db, 'users', currentUserId), { avatar: url });
    showToast('✅ Avatar updated!');
  });

  // Save name
  document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const name = document.getElementById('displayNameInput').value.trim();
    if (!name) return;
    await updateDoc(doc(db, 'users', currentUserId), { name });
    document.getElementById('sidebarName').textContent = name;
    showToast('✅ Profile saved!');
  });

  // Themes
  document.querySelectorAll('.theme-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyTheme(btn.dataset.theme);
    });
  });

  // Background music
  document.getElementById('musicToggle').addEventListener('click', toggleMusic);
  document.getElementById('musicVolume').addEventListener('input', e => {
    if (bgMusicAudio) bgMusicAudio.volume = e.target.value;
  });

  // Push notifications
  document.getElementById('enableNotifBtn').addEventListener('click', requestNotifPermission);
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('jrf_theme', theme);
  document.querySelectorAll('.theme-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}

function toggleMusic() {
  const btn = document.getElementById('musicToggle');
  if (!bgMusicAudio) {
    // Use a royalty-free online ambient track
    bgMusicAudio = new Audio('https://www.bensound.com/bensound-music/bensound-romantic.mp3');
    bgMusicAudio.loop   = true;
    bgMusicAudio.volume = parseFloat(document.getElementById('musicVolume').value);
  }
  if (bgMusicAudio.paused) {
    bgMusicAudio.play().catch(() => showToast('⚠️ Allow audio autoplay'));
    btn.innerHTML = '<i class="fas fa-pause"></i>';
  } else {
    bgMusicAudio.pause();
    btn.innerHTML = '<i class="fas fa-play"></i>';
  }
}

async function requestNotifPermission() {
  if (!('Notification' in window)) { showToast('Notifications not supported'); return; }
  const perm = await Notification.requestPermission();
  showToast(perm === 'granted' ? '🔔 Notifications enabled!' : '❌ Notifications blocked');
}

// ═══════════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════════
let toastTimeout;
window.showToast = function(msg, duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hidden');
  }, duration);
};

// ═══════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════
initParticles();
initLogin();

// Auto-restore session
const savedId = localStorage.getItem('jrf_userId');
if (savedId && USERS[savedId]) {
  const remembered = localStorage.getItem('jrf_remember');
  if (remembered) {
    const saved = JSON.parse(remembered);
    currentUserId = saved.userId;
    partnerUserId = USERS[saved.userId].partnerId;
    signInAnonymously(auth).then(() => {
      return launchApp();
    }).then(() => {
      if (typeof window.initLocalFeatures === 'function') {
        window.initLocalFeatures(currentUserId);
      }
    }).catch(() => {});
  }
}

// Init memories when navigating to that page
document.querySelectorAll('[data-page="memories"]').forEach(el => {
  el.addEventListener('click', () => initMemories());
});
