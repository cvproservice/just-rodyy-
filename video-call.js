// ═══════════════════════════════════════════════════════════════════
//  Just Rodyy Forever — WebRTC Video Call Module
// ═══════════════════════════════════════════════════════════════════

let _db, _myId, _partnerId, _USERS, _serverTs;

// WebRTC
let peerConn    = null;
let localStream = null;
let screenStream = null;
let callTimerInt = null;
let callSeconds  = 0;
let isMuted      = false;
let isCamOff     = false;
let isScreenSharing = false;
let callRoomId   = null;
let signalUnsub  = null;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN servers for production:
    // { urls: 'turn:your.turn.server', username: 'user', credential: 'pass' }
  ]
};

export function initVideoCall(db, myId, partnerId, USERS, serverTs) {
  _db = db; _myId = myId; _partnerId = partnerId;
  _USERS = USERS; _serverTs = serverTs;

  bindCallButtons();
  listenIncomingCall();
}

// ═══════════════════════════════════════════════════════════════════
//  BIND UI
// ═══════════════════════════════════════════════════════════════════
function bindCallButtons() {
  // Start call buttons
  document.getElementById('startCallBtn').addEventListener('click', initiateCall);
  document.getElementById('chatCallBtn')?.addEventListener('click', initiateCall);

  // In-call controls
  document.getElementById('toggleMute').addEventListener('click', toggleMute);
  document.getElementById('toggleCam').addEventListener('click',  toggleCam);
  document.getElementById('toggleScreen').addEventListener('click', toggleScreen);
  document.getElementById('endCallBtn').addEventListener('click', endCall);

  // Accept / reject
  document.getElementById('acceptCallBtn').addEventListener('click', acceptCall);
  document.getElementById('rejectCallBtn').addEventListener('click', rejectCall);
}

// ═══════════════════════════════════════════════════════════════════
//  LISTEN FOR INCOMING CALLS
// ═══════════════════════════════════════════════════════════════════
function listenIncomingCall() {
  import('./firebase.js').then(fb => {
    fb.onSnapshot(fb.doc(_db, 'calls', _myId), snap => {
      const data = snap.data();
      if (!data || data.status !== 'ringing') return;

      // Show incoming call modal
      const callerInfo = _USERS[data.callerId] || {};
      document.getElementById('incomingAvatar').src = callerInfo.avatar || '';
      document.getElementById('incomingName').textContent = callerInfo.name || 'Unknown';
      document.getElementById('incomingCallModal').classList.remove('hidden');

      callRoomId = data.roomId;
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  INITIATE CALL (Caller)
// ═══════════════════════════════════════════════════════════════════
async function initiateCall() {
  callRoomId = `call_${Date.now()}`;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    showToast('🎥 Camera/Mic access denied'); return;
  }

  showCallOverlay();
  document.getElementById('localVideo').srcObject  = localStream;
  document.getElementById('callStatus').textContent = 'Calling… 💕';
  document.getElementById('callStatus').style.display = 'flex';

  // Notify partner
  import('./firebase.js').then(async fb => {
    await fb.setDoc(fb.doc(_db, 'calls', _partnerId), {
      status: 'ringing',
      callerId: _myId,
      roomId: callRoomId,
      createdAt: fb.serverTimestamp(),
    });

    // Create peer connection
    peerConn = createPeerConnection();

    localStream.getTracks().forEach(track => peerConn.addTrack(track, localStream));

    const offer = await peerConn.createOffer();
    await peerConn.setLocalDescription(offer);

    await fb.setDoc(fb.doc(_db, 'rooms', callRoomId), {
      offer: { sdp: offer.sdp, type: offer.type },
      createdAt: fb.serverTimestamp(),
    });

    // Listen for answer
    listenForAnswer(fb);
  });
}

function listenForAnswer(fb) {
  if (signalUnsub) signalUnsub();
  signalUnsub = fb.onSnapshot(fb.doc(_db, 'rooms', callRoomId), async snap => {
    const data = snap.data();
    if (!data || !data.answer || peerConn.currentRemoteDescription) return;

    const answer = new RTCSessionDescription(data.answer);
    await peerConn.setRemoteDescription(answer);

    document.getElementById('callStatus').style.display = 'none';
    startCallTimer();
  });

  // Listen ICE candidates from partner
  fb.onSnapshot(fb.collection(_db, `rooms/${callRoomId}/partnerCandidates`), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        peerConn.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  ACCEPT CALL (Callee)
// ═══════════════════════════════════════════════════════════════════
async function acceptCall() {
  document.getElementById('incomingCallModal').classList.add('hidden');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    showToast('🎥 Camera/Mic access denied'); return;
  }

  showCallOverlay();
  document.getElementById('localVideo').srcObject  = localStream;
  document.getElementById('callStatus').textContent = 'Connecting…';

  import('./firebase.js').then(async fb => {
    peerConn = createPeerConnection();
    localStream.getTracks().forEach(track => peerConn.addTrack(track, localStream));

    // Get offer
    const roomSnap = await fb.getDoc(fb.doc(_db, 'rooms', callRoomId));
    const offer    = roomSnap.data()?.offer;
    if (!offer) return;

    await peerConn.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConn.createAnswer();
    await peerConn.setLocalDescription(answer);

    await fb.updateDoc(fb.doc(_db, 'rooms', callRoomId), {
      answer: { sdp: answer.sdp, type: answer.type }
    });

    // Listen caller ICE candidates
    fb.onSnapshot(fb.collection(_db, `rooms/${callRoomId}/callerCandidates`), snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          peerConn.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

    // Update call doc
    await fb.updateDoc(fb.doc(_db, 'calls', _myId), { status: 'accepted' });

    document.getElementById('callStatus').style.display = 'none';
    startCallTimer();
  });
}

function rejectCall() {
  document.getElementById('incomingCallModal').classList.add('hidden');
  import('./firebase.js').then(fb => {
    fb.updateDoc(fb.doc(_db, 'calls', _myId), { status: 'rejected' });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  PEER CONNECTION
// ═══════════════════════════════════════════════════════════════════
function createPeerConnection() {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.ontrack = e => {
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
    }
  };

  pc.onicecandidate = e => {
    if (!e.candidate) return;
    import('./firebase.js').then(fb => {
      const role = localStream ? 'callerCandidates' : 'partnerCandidates';
      fb.addDoc(fb.collection(_db, `rooms/${callRoomId}/${role}`), e.candidate.toJSON());
    });
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      endCall();
    }
  };

  return pc;
}

// ═══════════════════════════════════════════════════════════════════
//  CONTROLS
// ═══════════════════════════════════════════════════════════════════
function toggleMute() {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  const btn = document.getElementById('toggleMute');
  btn.classList.toggle('active', isMuted);
  btn.innerHTML = `<i class="fas fa-microphone${isMuted ? '-slash' : ''}"></i>`;
}

function toggleCam() {
  if (!localStream) return;
  isCamOff = !isCamOff;
  localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
  const btn = document.getElementById('toggleCam');
  btn.classList.toggle('active', isCamOff);
  btn.innerHTML = `<i class="fas fa-video${isCamOff ? '-slash' : ''}"></i>`;
}

async function toggleScreen() {
  if (!peerConn) return;

  if (!isScreenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack  = screenStream.getVideoTracks()[0];
      const senders      = peerConn.getSenders();
      const videoSender  = senders.find(s => s.track?.kind === 'video');
      if (videoSender) videoSender.replaceTrack(screenTrack);

      // Replace local video preview too
      const localVid = document.getElementById('localVideo');
      const mixed    = new MediaStream([screenTrack, ...localStream.getAudioTracks()]);
      localVid.srcObject = mixed;

      screenTrack.onended = () => { isScreenSharing = false; toggleScreen(); };
      isScreenSharing = true;
      document.getElementById('toggleScreen').classList.add('active');
    } catch { showToast('Screen sharing not supported'); }
  } else {
    const videoTrack  = localStream.getVideoTracks()[0];
    const senders     = peerConn.getSenders();
    const videoSender = senders.find(s => s.track?.kind === 'video');
    if (videoSender && videoTrack) videoSender.replaceTrack(videoTrack);
    document.getElementById('localVideo').srcObject = localStream;
    screenStream?.getTracks().forEach(t => t.stop());
    isScreenSharing = false;
    document.getElementById('toggleScreen').classList.remove('active');
  }
}

function endCall() {
  // Stop streams
  localStream?.getTracks().forEach(t => t.stop());
  screenStream?.getTracks().forEach(t => t.stop());
  localStream   = null;
  screenStream  = null;

  // Close peer
  if (peerConn) { peerConn.close(); peerConn = null; }

  // Stop timer
  clearInterval(callTimerInt);
  callSeconds = 0;

  // Hide overlay
  document.getElementById('videoCallOverlay').classList.add('hidden');
  document.getElementById('callTimerBar').classList.add('hidden');

  // Reset video elements
  document.getElementById('localVideo').srcObject  = null;
  document.getElementById('remoteVideo').srcObject = null;

  // Clean up Firestore
  import('./firebase.js').then(async fb => {
    if (callRoomId) {
      try { await fb.deleteDoc(fb.doc(_db, 'rooms', callRoomId)); } catch {}
      try { await fb.deleteDoc(fb.doc(_db, 'calls', _myId)); } catch {}
      try { await fb.deleteDoc(fb.doc(_db, 'calls', _partnerId)); } catch {}
    }
  });

  if (signalUnsub) { signalUnsub(); signalUnsub = null; }
  callRoomId = null;
  isMuted = false; isCamOff = false; isScreenSharing = false;

  // Reset button states
  document.getElementById('toggleMute').innerHTML   = '<i class="fas fa-microphone"></i>';
  document.getElementById('toggleCam').innerHTML    = '<i class="fas fa-video"></i>';
  document.getElementById('toggleScreen').innerHTML = '<i class="fas fa-display"></i>';
}

// ═══════════════════════════════════════════════════════════════════
//  TIMER & OVERLAY
// ═══════════════════════════════════════════════════════════════════
function showCallOverlay() {
  document.getElementById('videoCallOverlay').classList.remove('hidden');
  document.getElementById('callTimerBar').classList.add('hidden');
}

function startCallTimer() {
  callSeconds = 0;
  document.getElementById('callTimerBar').classList.remove('hidden');
  callTimerInt = setInterval(() => {
    callSeconds++;
    const m = Math.floor(callSeconds / 60);
    const s = String(callSeconds % 60).padStart(2, '0');
    document.getElementById('callTimer').textContent = `${m}:${s}`;
  }, 1000);
}
