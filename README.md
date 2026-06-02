# 💕 Just Rodyy Forever

A private romantic communication platform for two — built with Firebase + WebRTC.

---

## ✨ Features

| Feature | Details |
|---|---|
| 💬 Real-time Chat | Firestore live messages, read receipts, typing indicator |
| 🎤 Voice Messages | Record, send & play audio — waveform animation |
| 🖼️ Image Sharing | Upload & preview photos full-screen |
| 📹 Video Calls | WebRTC HD calls, mute, camera off, screen share |
| 🧠 Memories | Upload photos with notes & dates — timeline gallery |
| 📅 Shared Calendar | Add & view shared events |
| ✅ Shared To-Do | Collaborative checklist |
| 💞 Relationship Counter | Live years / months / days / hours / minutes |
| 💬 Love Quotes | Refreshable romantic quote generator |
| 🌙 Themes | Dark, Light, Rose |
| 📲 PWA | Installable on Android/iPhone |
| 🔔 Push Notifications | Browser notification on new message |

---

## 🚀 Quick Start

### 1. Create a Firebase Project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication → Anonymous**
4. Enable **Firestore Database** (start in test mode)
5. Enable **Storage** (start in test mode)
6. Go to **Project Settings → Your apps → Web** → copy the `firebaseConfig`

### 2. Configure the App
Open `js/firebase.js` and replace the `firebaseConfig` object:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

### 3. Set Secret Codes
In `js/app.js`, find the `USERS` object and change the codes:

```js
const USERS = {
  user1: { name: 'Rody 💙',    code: 'your_secret_code_1', … },
  user2: { name: 'My Love 💖', code: 'your_secret_code_2', … },
};
```

### 4. Apply Security Rules
- Copy `firestore.rules` content → Firebase Console → Firestore → Rules → Publish
- Copy `storage.rules` content → Firebase Console → Storage → Rules → Publish

### 5. Deploy

#### Option A: GitHub Pages
```bash
git init
git add .
git commit -m "💕 Just Rodyy Forever"
git remote add origin https://github.com/YOUR_USER/just-rodyy-forever.git
git push -u origin main
```
Then enable GitHub Pages in repo Settings → Pages → main branch.

#### Option B: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## 📁 File Structure

```
/
├── index.html          ← Main app (all pages)
├── manifest.json       ← PWA manifest
├── firestore.rules     ← Firestore security rules
├── storage.rules       ← Storage security rules
├── css/
│   └── style.css       ← All styles (glassmorphism 3D)
├── js/
│   ├── firebase.js     ← Firebase init & exports
│   ├── app.js          ← Core app: auth, nav, dashboard, calendar…
│   ├── chat.js         ← Real-time chat, voice, images
│   └── video-call.js   ← WebRTC video calling
└── assets/
    ├── images/
    └── icons/
        ├── icon-192.png   ← PWA icon (add your own)
        └── icon-512.png   ← PWA icon (add your own)
```

---

## 🔒 Security Notes

- Uses **Firebase Anonymous Auth** — no email/password needed, just your secret codes
- All data is private to your Firebase project
- Change the secret codes in `app.js` before deploying!
- For production, tighten Firestore rules to only allow your specific user IDs

---

## 📱 Video Calls — Production Tips

For WebRTC calls to work on mobile networks (4G/5G), you need a **TURN server**.
Free options:
- [Metered.ca](https://www.metered.ca/tools/openrelay/) — free TURN servers
- [Twilio](https://www.twilio.com/stun-turn) — reliable paid option

Add to `video-call.js` in `ICE_SERVERS`:
```js
{ urls: 'turn:relay.metered.ca:80', username: 'YOUR_USER', credential: 'YOUR_CRED' }
```

---

Made with 💕 — Just for two.
