// ═══════════════════════════════════════════════════
// mp — sanctuary (shared JS)
// safety bar, navigation, data utilities
// ═══════════════════════════════════════════════════

(function () {
  'use strict';

  // ── localStorage keys ────────────────────────────
  window.S_KEYS = {
    safety:      'sanctuary_safety',
    anchors:     'sanctuary_anchors',
    anchorsLog:  'sanctuary_anchors_log',
    magpie:      'sanctuary_magpie',
    studioPin:   'sanctuary_studio_pin',
    studioEntries: 'sanctuary_studio_entries',
    pets:        'sanctuary_pets',
    walks:       'sanctuary_walks',
    spiralLog:   'sanctuary_spiral_log',
    northStar:   'sanctuary_north_star',
  };

  // ── Data helpers ─────────────────────────────────
  window.sLoad = function (key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  };
  window.sSave = function (key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    // Firebase sync if available
    if (window.fbSaveDoc) {
      var docMap = {};
      docMap[key] = data;
      var docId = key.replace('sanctuary_', '');
      window.fbSaveDoc('sanctuary_' + docId, docMap);
    }
  };
  window.sId = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  // ── Date helpers ─────────────────────────────────
  window.sToday = function () {
    return new Date().toISOString().slice(0, 10);
  };
  window.sTimeAgo = function (iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    var days = Math.floor(diff / 86400);
    if (days === 1) return 'yesterday';
    if (days < 7) return days + 'd ago';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  window.sFormatDate = function (iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  };
  window.sEsc = function (s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  };

  // ── Safety bar ───────────────────────────────────
  function renderSafetyBar() {
    var bar = document.getElementById('safetyBar');
    if (!bar) return;

    var data = sLoad(S_KEYS.safety, null);
    if (!data || !data.configured) {
      bar.classList.add('unconfigured');
      bar.innerHTML = '<div class="safety-dot"></div>'
        + '<span class="safety-text">Tap here to set up your safety status</span>';
      bar.style.cursor = 'pointer';
      bar.onclick = function () { window.location.href = 'north-star.html#safety-setup'; };
      return;
    }

    bar.classList.remove('unconfigured');
    bar.style.cursor = 'default';
    bar.onclick = null;

    var parts = [];
    parts.push('You are <strong>safe</strong> right now.');
    if (data.monthsCovered) {
      parts.push('<strong>' + sEsc(data.monthsCovered) + '</strong> months covered.');
    }
    if (data.caseStatus) {
      parts.push(sEsc(data.caseStatus) + '.');
    }

    bar.innerHTML = '<div class="safety-dot"></div>'
      + '<span class="safety-text">' + parts.join(' ') + '</span>';
  }

  // ── Dock navigation ──────────────────────────────
  function highlightDock() {
    var path = window.location.pathname;
    var page = path.split('/').pop() || 'index.html';
    document.querySelectorAll('.dock-item').forEach(function (item) {
      var href = item.getAttribute('href');
      if (href === page || (page === '' && href === 'index.html')) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // ── Toast ────────────────────────────────────────
  var _toast = null, _toastTimer = null;
  window.sToast = function (msg) {
    if (!_toast) {
      _toast = document.createElement('div');
      _toast.className = 'toast';
      document.body.appendChild(_toast);
    }
    _toast.textContent = msg;
    clearTimeout(_toastTimer);
    _toast.classList.add('show');
    _toastTimer = setTimeout(function () { _toast.classList.remove('show'); }, 2400);
  };

  // ── Service Worker ───────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(function () {});
  }

  // ── Init ─────────────────────────────────────────
  function boot() {
    renderSafetyBar();
    highlightDock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Re-render safety bar if data changes from another tab
  window.addEventListener('storage', function (e) {
    if (e.key === S_KEYS.safety) renderSafetyBar();
  });

})();
