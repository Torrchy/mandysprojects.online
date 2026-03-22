// firebase-sync.js
// Shared Firebase Auth + Firestore sync for mp sanctuary
// Included in pages that need cross-device sync.

(function () {
  'use strict';

  if (typeof FIREBASE_CONFIG === 'undefined' || FIREBASE_CONFIG.apiKey.startsWith('PASTE_')) {
    console.info('[fbSync] Firebase not configured — sync disabled.');
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

  const auth = firebase.auth();
  const db   = firebase.firestore();

  window.fbUser = null;
  const _authCallbacks = [];
  window.onFbAuthChange = (cb) => _authCallbacks.push(cb);

  const _timers = {};
  const _ownWrite     = {};
  const _unsubscribers = {};
  let   _syncTimer    = null;

  // ── Public API ──
  window.fbSignIn = async function () {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        console.error('[fbSync] Sign-in error:', e);
      }
    }
  };

  window.fbSignOut = async function () {
    await auth.signOut();
    window.fbUser = null;
  };

  window.fbSaveDoc = function (docId, data) {
    if (!window.fbUser) return;
    clearTimeout(_timers[docId]);
    _timers[docId] = setTimeout(async () => {
      try {
        _ownWrite[docId] = true;
        await db.doc(`users/${window.fbUser.uid}/modules/${docId}`).set(data, { merge: true });
      } catch (e) {
        console.error('[fbSync] Save error:', e);
        _ownWrite[docId] = false;
      }
    }, 1500);
  };

  window.fbLoadDoc = async function (docId) {
    if (!window.fbUser) return null;
    try {
      const snap = await db.doc(`users/${window.fbUser.uid}/modules/${docId}`).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      console.error('[fbSync] Load error:', e);
      return null;
    }
  };

  // ── localStorage key → Firestore doc mapping ──
  const MODULE_KEYS = {
    sanctuary_safety:      ['sanctuary_safety'],
    sanctuary_anchors:     ['sanctuary_anchors', 'sanctuary_anchors_log'],
    sanctuary_magpie:      ['sanctuary_magpie'],
    sanctuary_studio:      ['sanctuary_studio_entries'],
    sanctuary_pets:        ['sanctuary_pets', 'sanctuary_walks'],
    sanctuary_spiral:      ['sanctuary_spiral_log'],
    sanctuary_north_star:  ['sanctuary_north_star'],
  };

  function _scheduleSyncComplete() {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('fbSyncComplete'));
    }, 200);
  }

  function _startListeners(user) {
    Object.values(_unsubscribers).forEach(fn => fn && fn());

    for (const [docId, keys] of Object.entries(MODULE_KEYS)) {
      const ref = db.doc(`users/${user.uid}/modules/${docId}`);

      _unsubscribers[docId] = ref.onSnapshot(async (snap) => {
        if (snap.metadata.hasPendingWrites) return;

        if (!snap.exists) {
          const upload = {};
          let hasData = false;
          keys.forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw) {
              try { upload[key] = JSON.parse(raw); hasData = true; } catch (_) {}
            }
          });
          if (hasData) {
            _ownWrite[docId] = true;
            await ref.set(upload, { merge: true });
          }
          return;
        }

        const fromSelf = _ownWrite[docId];
        _ownWrite[docId] = false;
        const cloud = snap.data();
        keys.forEach(key => {
          if (cloud[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(cloud[key]));
          }
        });

        if (!fromSelf) {
          _scheduleSyncComplete();
        }
      }, (err) => {
        console.error('[fbSync] Listener error for', docId, ':', err);
      });
    }
  }

  auth.onAuthStateChanged((user) => {
    window.fbUser = user;
    if (user) {
      _startListeners(user);
    } else {
      Object.values(_unsubscribers).forEach(fn => fn && fn());
    }
    _authCallbacks.forEach(cb => cb(user));
  });

})();
