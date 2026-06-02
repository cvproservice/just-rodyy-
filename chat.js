// ═══════════════════════════════════════════════════════════════════
//  Just Rodyy Forever — Chat Module
// ═══════════════════════════════════════════════════════════════════

import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, ref, uploadBytes, getDownloadURL
} from './firebase.js';

let _db, _storage, _myId, _partnerId, _USERS, _serverTs;
let mediaRecorder = null;
let audioChunks   = [];
let recTimerInt   = null;
let recSeconds    = 0;
let waveAnimId    = null;
let analyser      = null;
let audioStream   = null;
let typingTimeout = null;
let msgsUnsub     = null;
let contextMsgId  = null;
let editingMsgId  = null;
let searchQuery   = '';

export function initChat(db, storage, myId, partnerId, USERS, serverTs) {
  _db = db; _storage = storage; _myId = myId; _partnerId = partnerId;
  _USERS = USERS; _serverTs = serverTs;

  listenMessages();
  bindSend();
  bindVoice();
  bindImage();
  bindSearch();
  bindContextMenu();
  autoResizeTextarea();
}

// ═══════════════════════════════════════════════════════════════════
//  LISTEN MESSAGES
// ═══════════════════════════════════════════════════════════════════
function listenMessages() {
  if (msgsUnsub) msgsUnsub();
  const q = query(collection(_db, 'messages'), orderBy('createdAt', 'asc'));
  msgsUnsub = onSnapshot(q, snap => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMessages(messages);
    markRead(messages);
  });

  // Listen typing from partner
  onSnapshot(doc(_db, 'typing', _partnerId), snap => {
    const data  = snap.data() || {};
    const isTyping = data.isTyping && (Date.now() - (data.ts?.toMillis?.() || 0)) < 4000;
    document.getElementById('chatPartnerStatus').textContent = isTyping ? '✍️ typing…' : '';
  });
}

async function markRead(messages) {
  const unread = messages.filter(m => m.senderId === _partnerId && !m.read);
  for (const m of unread) {
    await updateDoc(doc(_db, 'messages', m.id), { read: true });
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════════════
function renderMessages(messages) {
  const filtered = searchQuery
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const list      = document.getElementById('messagesList');
  const container = document.getElementById('messagesContainer');
  const wasAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 60;

  let html      = '';
  let lastDate  = '';
  let lastSender = '';
  let groupOpen = false;

  filtered.forEach((msg, i) => {
    const ts    = msg.createdAt?.toDate?.() || new Date();
    const dateStr = ts.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const isOwn    = msg.senderId === _myId;
    const senderClass = isOwn ? 'own' : 'other';

    if (dateStr !== lastDate) {
      if (groupOpen) html += '</div>';
      html += `<div class="date-divider">${dateStr}</div>`;
      lastDate   = dateStr;
      lastSender = '';
      groupOpen  = false;
    }

    if (msg.senderId !== lastSender) {
      if (groupOpen) html += '</div>';
      html += `<div class="msg-group ${senderClass}" id="grp_${msg.id}">`;
      groupOpen  = true;
      lastSender = msg.senderId;
    }

    html += buildBubble(msg, timeStr, isOwn);
  });

  if (groupOpen) html += '</div>';
  list.innerHTML = html;

  if (wasAtBottom) container.scrollTop = container.scrollHeight;

  // Badge count (unread from partner)
  const unreadCount = messages.filter(m => m.senderId === _partnerId && !m.read).length;
  document.getElementById('chatBadge').textContent    = unreadCount || '';
  document.getElementById('chatBadgeMob').textContent = unreadCount || '';
}

function buildBubble(msg, timeStr, isOwn) {
  let content = '';

  if (msg.deleted) {
    content = '<span class="msg-bubble deleted">Message deleted</span>';
  } else if (msg.type === 'image') {
    content = `<img class="msg-img" src="${msg.url}" alt="image" data-url="${msg.url}" loading="lazy" />`;
  } else if (msg.type === 'voice') {
    content = `
      <div class="voice-msg msg-bubble">
        <button class="voice-play-btn" data-url="${msg.url}"><i class="fas fa-play"></i></button>
        <div class="voice-bar"><canvas width="120" height="28"></canvas></div>
        <span class="voice-duration">${msg.duration || '0:00'}</span>
      </div>`;
  } else {
    const txt = escHtml(msg.text || '');
    const edited = msg.edited ? '<span class="msg-edited">(edited)</span>' : '';
    content = `<div class="msg-bubble" data-id="${msg.id}">${txt}${edited}</div>`;
  }

  const reactions = msg.reactions ? Object.entries(msg.reactions).filter(([,v]) => v > 0).map(([k,v]) =>
    `<span class="reaction-chip" data-id="${msg.id}" data-emoji="${k}">${k}${v > 1 ? v : ''}</span>`
  ).join('') : '';

  const readIcon = isOwn
    ? `<span class="read-receipt ${msg.read ? '' : 'sent'}">
        <i class="fas fa-${msg.read ? 'check-double' : 'check'}"></i>
       </span>`
    : '';

  return `
    <div class="msg-wrap" data-id="${msg.id}">
      ${content}
      ${reactions ? `<div class="msg-reactions">${reactions}</div>` : ''}
      <div class="msg-meta">
        <span>${timeStr}</span>
        ${readIcon}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
//  SEND TEXT
// ═══════════════════════════════════════════════════════════════════
function bindSend() {
  const sendBtn  = document.getElementById('sendBtn');
  const msgInput = document.getElementById('msgInput');

  sendBtn.addEventListener('click', sendText);
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
  });
  msgInput.addEventListener('input', onTyping);
}

async function sendText() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  if (!text) return;

  if (editingMsgId) {
    await updateDoc(doc(_db, 'messages', editingMsgId), { text, edited: true });
    editingMsgId = null;
    input.value  = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').innerHTML = '<i class="fas fa-paper-plane"></i>';
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  await addDoc(collection(_db, 'messages'), {
    senderId: _myId,
    text,
    type: 'text',
    read: false,
    createdAt: _serverTs(),
  });

  clearTyping();
  pushNotif(_USERS[_partnerId].name, text);
}

async function onTyping() {
  const { doc: _doc, setDoc } = await import('./firebase.js');
  import('./firebase.js').then(fb => {
    fb.setDoc(fb.doc(_db, 'typing', _myId), { isTyping: true, ts: fb.serverTimestamp() }, { merge: true });
  });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(clearTyping, 3000);
}

function clearTyping() {
  import('./firebase.js').then(fb => {
    fb.setDoc(fb.doc(_db, 'typing', _myId), { isTyping: false }, { merge: true });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  IMAGE SEND
// ═══════════════════════════════════════════════════════════════════
function bindImage() {
  document.getElementById('attachBtn').addEventListener('click', () => {
    document.getElementById('imageFileInput').click();
  });
  document.getElementById('imageFileInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    showToast('📤 Sending image…');
    try {
      const r   = ref(_storage, `chat-images/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await addDoc(collection(_db, 'messages'), {
        senderId: _myId, type: 'image', url,
        read: false, createdAt: _serverTs()
      });
      e.target.value = '';
    } catch (err) { showToast('❌ Upload failed'); console.error(err); }
  });

  // Image preview click
  document.getElementById('messagesList').addEventListener('click', e => {
    const img = e.target.closest('.msg-img');
    if (img) {
      document.getElementById('previewImg').src   = img.dataset.url;
      document.getElementById('downloadImg').href = img.dataset.url;
      document.getElementById('imagePreviewModal').classList.remove('hidden');
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
//  VOICE RECORDING
// ═══════════════════════════════════════════════════════════════════
function bindVoice() {
  document.getElementById('voiceBtn').addEventListener('click', startRecording);
  document.getElementById('stopRec').addEventListener('click', stopRecording);
  document.getElementById('cancelRec').addEventListener('click', cancelRecording);

  // Voice playback
  document.getElementById('messagesList').addEventListener('click', e => {
    const btn = e.target.closest('.voice-play-btn');
    if (!btn) return;
    const audio = new Audio(btn.dataset.url);
    const icon  = btn.querySelector('i');
    icon.className = 'fas fa-pause';
    audio.play();
    audio.onended = () => { icon.className = 'fas fa-play'; };
  });
}

async function startRecording() {
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(audioStream);
    audioChunks = [];
    recSeconds  = 0;

    const audioCtx = new AudioContext();
    const src      = audioCtx.createMediaStreamSource(audioStream);
    analyser       = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
    drawWaveform();

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = processVoice;
    mediaRecorder.start(100);

    document.getElementById('voiceRecorder').classList.remove('hidden');
    document.getElementById('chatInputArea')?.classList.add('hidden');
    recTimerInt = setInterval(() => {
      recSeconds++;
      const m = Math.floor(recSeconds / 60);
      const s = String(recSeconds % 60).padStart(2, '0');
      document.getElementById('recTimer').textContent = `${m}:${s}`;
    }, 1000);
  } catch {
    showToast('🎤 Microphone access denied');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  cleanupRecorder();
}

function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  audioChunks = [];
  cleanupRecorder();
}

function cleanupRecorder() {
  clearInterval(recTimerInt);
  cancelAnimationFrame(waveAnimId);
  audioStream?.getTracks().forEach(t => t.stop());
  document.getElementById('voiceRecorder').classList.add('hidden');
}

async function processVoice() {
  if (!audioChunks.length) return;
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const dur  = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, '0')}`;
  showToast('🎤 Sending voice…');

  try {
    const r = ref(_storage, `voice-messages/${Date.now()}.webm`);
    await uploadBytes(r, blob);
    const url = await getDownloadURL(r);
    await addDoc(collection(_db, 'messages'), {
      senderId: _myId, type: 'voice', url, duration: dur,
      read: false, createdAt: _serverTs()
    });
  } catch (err) { showToast('❌ Voice send failed'); console.error(err); }
}

function drawWaveform() {
  const canvas = document.getElementById('waveCanvas');
  const ctx    = canvas.getContext('2d');
  const data   = new Uint8Array(analyser.frequencyBinCount);

  function frame() {
    waveAnimId = requestAnimationFrame(frame);
    analyser.getByteFrequencyData(data);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ff4d8d';
    const barW = canvas.width / data.length;
    data.forEach((v, i) => {
      const h = (v / 255) * canvas.height;
      ctx.fillRect(i * barW, (canvas.height - h) / 2, barW - 1, h);
    });
  }
  frame();
}

// ═══════════════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════════════
function bindSearch() {
  document.getElementById('searchToggle').addEventListener('click', () => {
    document.getElementById('searchBar').classList.toggle('hidden');
  });
  document.getElementById('searchClose').addEventListener('click', () => {
    document.getElementById('searchBar').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    searchQuery = '';
  });
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    // re-fetch will trigger render via onSnapshot, but force a refresh:
    const q = query(collection(_db, 'messages'), orderBy('createdAt', 'asc'));
    import('./firebase.js').then(fb => {
      fb.getDocs(q).then(snap => {
        renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  CONTEXT MENU (Right-click / Long-press)
// ═══════════════════════════════════════════════════════════════════
function bindContextMenu() {
  const ctxMenu = document.getElementById('contextMenu');
  const emojiPicker = document.getElementById('emojiPicker');
  const list = document.getElementById('messagesList');

  list.addEventListener('contextmenu', e => {
    const bubble = e.target.closest('.msg-bubble[data-id]');
    if (!bubble) return;
    e.preventDefault();
    contextMsgId = bubble.dataset.id;
    const isOwn  = bubble.closest('.msg-group.own') !== null;
    document.getElementById('ctxEdit').style.display   = isOwn ? '' : 'none';
    document.getElementById('ctxDelete').style.display = isOwn ? '' : 'none';
    ctxMenu.style.top  = `${e.clientY}px`;
    ctxMenu.style.left = `${e.clientX}px`;
    ctxMenu.classList.remove('hidden');
  });

  document.addEventListener('click', () => {
    ctxMenu.classList.add('hidden');
    emojiPicker.classList.add('hidden');
  });

  document.getElementById('ctxEdit').addEventListener('click', () => {
    if (!contextMsgId) return;
    import('./firebase.js').then(fb => {
      fb.getDoc(fb.doc(_db, 'messages', contextMsgId)).then(snap => {
        document.getElementById('msgInput').value = snap.data()?.text || '';
        editingMsgId = contextMsgId;
        document.getElementById('sendBtn').innerHTML = '<i class="fas fa-check"></i>';
        document.getElementById('msgInput').focus();
      });
    });
  });

  document.getElementById('ctxDelete').addEventListener('click', async () => {
    if (!contextMsgId) return;
    await updateDoc(doc(_db, 'messages', contextMsgId), { deleted: true, text: '' });
    contextMsgId = null;
  });

  document.getElementById('ctxReact').addEventListener('click', e => {
    emojiPicker.style.top  = `${e.clientY - 60}px`;
    emojiPicker.style.left = `${e.clientX}px`;
    emojiPicker.classList.remove('hidden');
  });

  emojiPicker.addEventListener('click', async e => {
    const emoji = e.target.closest('span')?.textContent.trim() || e.target.textContent.trim();
    if (!emoji || !contextMsgId) return;
    import('./firebase.js').then(async fb => {
      const snap = await fb.getDoc(fb.doc(_db, 'messages', contextMsgId));
      const current = snap.data()?.reactions || {};
      current[emoji] = (current[emoji] || 0) + 1;
      await fb.updateDoc(fb.doc(_db, 'messages', contextMsgId), { reactions: current });
    });
    emojiPicker.classList.add('hidden');
  });

  // Build emoji spans
  emojiPicker.innerHTML = '❤️ 😍 😘 🥰 😂 😭 🔥 💯 🌹 ✨'
    .split(' ').map(e => `<span>${e}</span>`).join('');
}

// ═══════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════
function autoResizeTextarea() {
  const ta = document.getElementById('msgInput');
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

// Push notification
function pushNotif(from, body) {
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  new Notification(`💌 ${from}`, { body, icon: '/assets/icons/icon-192.png' });
}
