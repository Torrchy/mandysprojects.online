// firebase-sync.js
// Shared Firebase Auth + Firestore sync for Mandy's Projects PWA
// Included in every page after firebase-config.js and the Firebase SDK scripts.

(function () {
  'use strict';

  if (typeof FIREBASE_CONFIG === 'undefined' || FIREBASE_CONFIG.apiKey.startsWith('PASTE_')) {
    console.info('[fbSync] Firebase not configured — sync disabled. Fill in firebase-config.js to enable.');
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

  const auth = firebase.auth();
  const db   = firebase.firestore();

  // ── Public state ──────────────────────────────────────────────────────────
  window.fbUser = null;
  const _authCallbacks = [];
  window.onFbAuthChange = (cb) => _authCallbacks.push(cb);

  // ── Debounce timers (one per docId) ───────────────────────────────────────
  const _timers = {};

  // ── Public API ────────────────────────────────────────────────────────────
  window.fbSignIn = async function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        console.error('[fbSync] Sign-in error:', e);
        _showToast('⚠ Sign-in failed', true);
      }
    }
  };

  window.fbSignOut = async function () {
    await auth.signOut();
    window.fbUser = null;
    _updateSidebarUI(null);
    _showToast('Signed out');
  };

  // Debounced write to Firestore (1.5 s)
  window.fbSaveDoc = function (docId, data) {
    if (!window.fbUser) return;
    clearTimeout(_timers[docId]);
    _timers[docId] = setTimeout(async () => {
      try {
        await db.doc(`users/${window.fbUser.uid}/${docId}`).set(data, { merge: true });
        _showToast('☁ Synced');
      } catch (e) {
        console.error('[fbSync] Save error:', e);
      }
    }, 1500);
  };

  window.fbLoadDoc = async function (docId) {
    if (!window.fbUser) return null;
    try {
      const snap = await db.doc(`users/${window.fbUser.uid}/${docId}`).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.error('[fbSync] Load error:', e);
      return null;
    }
  };

  // ── localStorage key → Firestore doc mapping ─────────────────────────────
  const MODULE_KEYS = {
    habits:   ['mc_habits', 'mc_habits_log', 'mc_habits_missed'],
    journal:  ['jie_entries'],
    feelings: ['mc_feeling_checkin', 'mc_feeling_history'],
    finance:  ['missionControl'],
  };

  async function _syncAll(user) {
    for (const [docId, keys] of Object.entries(MODULE_KEYS)) {
      try {
        const snap = await db.doc(`users/${user.uid}/${docId}`).get();
        if (snap.exists) {
          // Cloud wins → hydrate localStorage
          const cloud = snap.data();
          keys.forEach(key => {
            if (cloud[key] !== undefined) {
              localStorage.setItem(key, JSON.stringify(cloud[key]));
            }
          });
        } else {
          // First-ever sign-in on this account → push local data up
          const upload = {};
          let hasData = false;
          keys.forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw) {
              try { upload[key] = JSON.parse(raw); hasData = true; } catch (_) {}
            }
          });
          if (hasData) {
            await db.doc(`users/${user.uid}/${docId}`).set(upload, { merge: true });
          }
        }
      } catch (e) {
        console.error('[fbSync] Sync error for', docId, ':', e);
      }
    }
    // Tell each page to reload its data from localStorage
    window.dispatchEvent(new CustomEvent('fbSyncComplete'));
  }

  // ── Auth state listener ───────────────────────────────────────────────────
  auth.onAuthStateChanged(async (user) => {
    window.fbUser = user;
    _updateSidebarUI(user);
    if (user) await _syncAll(user);
    _authCallbacks.forEach(cb => cb(user));
  });

  // ── Visibility-based sync (re-pull when tab comes back into focus) ────────
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && window.fbUser) {
      await _syncAll(window.fbUser);
    }
  });

  // ── Sidebar auth UI ───────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('fb-sync-css')) return;
    const s = document.createElement('style');
    s.id = 'fb-sync-css';
    s.textContent = `
      #fb-auth-signed-out { padding-top: 0.1rem; }
      .fb-signin-btn {
        display: flex; align-items: center; gap: 0.6rem;
        width: 100%; padding: 0.55rem 0.75rem;
        background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.28);
        border-radius: 10px; color: #c4b5fd;
        font-family: inherit; font-size: 0.8rem; font-weight: 600;
        cursor: pointer; transition: background 0.2s, border-color 0.2s;
        text-align: left;
      }
      .fb-signin-btn:hover { background: rgba(139,92,246,0.18); border-color: rgba(139,92,246,0.5); }
      .fb-signin-btn svg { width:16px; height:16px; flex-shrink:0; }
      .fb-user-chip { display:flex; align-items:center; gap:0.6rem; padding:0.2rem 0; }
      .fb-avatar {
        width:28px; height:28px; border-radius:50%;
        border:2px solid rgba(139,92,246,0.4); flex-shrink:0; object-fit:cover;
      }
      .fb-avatar-placeholder {
        width:28px; height:28px; border-radius:50%;
        background:rgba(139,92,246,0.2); border:2px solid rgba(139,92,246,0.4);
        display:flex; align-items:center; justify-content:center;
        font-size:0.85rem; flex-shrink:0;
      }
      .fb-user-info { flex:1; min-width:0; }
      .fb-username {
        font-size:0.8rem; font-weight:600; color:#e8e8f0;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .fb-signout-btn {
        background:none; border:none; padding:0;
        font-size:0.7rem; color:#7070a0; cursor:pointer;
        font-family:inherit; transition:color 0.2s;
      }
      .fb-signout-btn:hover { color:#ef4444; }
      .fb-sync-toast {
        position:fixed; bottom:1rem; left:50%;
        transform:translateX(-50%) translateY(0.5rem);
        background:#131320; border:1px solid #1e1e35;
        color:#8b5cf6; font-size:0.73rem; font-weight:600;
        padding:0.4rem 1rem; border-radius:100px;
        z-index:99999; opacity:0; transition:opacity 0.25s, transform 0.25s;
        white-space:nowrap; pointer-events:none;
      }
      .fb-sync-toast.error { border-color:rgba(239,68,68,0.5); color:#ef4444; }
      .fb-sync-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(s);
  }

  function _injectSidebarFooter() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    footer.innerHTML = `
      <div id="fb-auth-signed-out">
        <button class="fb-signin-btn" onclick="fbSignIn()">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>
      </div>
      <div id="fb-auth-signed-in" style="display:none">
        <div class="fb-user-chip">
          <div id="fb-avatar-wrap"></div>
          <div class="fb-user-info">
            <div id="fb-username" class="fb-username"></div>
            <button class="fb-signout-btn" onclick="fbSignOut()">Sign out</button>
          </div>
        </div>
      </div>
    `;
  }

  function _updateSidebarUI(user) {
    const out = document.getElementById('fb-auth-signed-out');
    const inn = document.getElementById('fb-auth-signed-in');
    if (!out || !inn) return;
    if (user) {
      out.style.display = 'none';
      inn.style.display = 'block';
      const wrap = document.getElementById('fb-avatar-wrap');
      wrap.innerHTML = user.photoURL
        ? `<img class="fb-avatar" src="${user.photoURL}" referrerpolicy="no-referrer">`
        : `<div class="fb-avatar-placeholder">👤</div>`;
      document.getElementById('fb-username').textContent =
        (user.displayName || user.email || 'You').split(' ')[0];
    } else {
      out.style.display = 'block';
      inn.style.display = 'none';
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  let _toast = null, _toastTimer = null;
  function _showToast(msg, isError) {
    if (!_toast) {
      _toast = document.createElement('div');
      _toast.className = 'fb-sync-toast';
      document.body.appendChild(_toast);
    }
    _toast.textContent = msg;
    _toast.classList.toggle('error', !!isError);
    clearTimeout(_toastTimer);
    _toast.classList.add('show');
    _toastTimer = setTimeout(() => _toast.classList.remove('show'), 2200);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { _injectStyles(); _injectSidebarFooter(); });
  } else {
    _injectStyles();
    _injectSidebarFooter();
  }

})();
