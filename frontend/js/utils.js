/* =============================================
   RUBHI - Utility Functions
   ============================================= */

// ---- Toast notifications ----
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="color:var(--${type === 'info' ? 'blue' : type === 'success' ? 'green' : type === 'error' ? 'red' : 'yellow'})">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ---- Format time ----
// SQLite stores dates as "YYYY-MM-DD HH:MM:SS" without timezone — treat as UTC
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  // If already has timezone info, parse directly
  if (dateStr.includes('Z') || dateStr.includes('+')) return new Date(dateStr);
  // SQLite format: "2024-01-15 14:30:00" — append Z to treat as UTC
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function timeAgo(dateStr) {
  const date = parseDate(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (isNaN(diff) || diff < 0) return 'just now';
  if (diff < 60)       return `${diff}s ago`;
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)   return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000)  return `${Math.floor(diff / 604800)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr) {
  return parseDate(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatNumber(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ---- XSS escape ----
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Verified badge SVG ----
function verifiedBadge(size = '') {
  return `<span class="verified-badge ${size}" title="Verified">
    <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
  </span>`;
}

// ---- Avatar placeholder ----
function avatarHtml(user, sizeClass = 'avatar-md') {
  const src = user?.profile_picture || '';
  const name = user?.full_name || user?.username || '?';
  const initial = name.charAt(0).toUpperCase();
  if (src) {
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(name)}" class="avatar ${sizeClass}" onerror="this.replaceWith(makeAvatarInitial('${escapeHtml(initial)}','${sizeClass}'))">`;
  }
  return `<div class="avatar ${sizeClass}" style="background:var(--surface-3);display:flex;align-items:center;justify-content:center;font-size:${sizeClass.includes('xl') ? '24' : sizeClass.includes('lg') ? '18' : '14'}px;font-weight:600;color:var(--accent)">${initial}</div>`;
}

function makeAvatarInitial(initial, sizeClass) {
  const el = document.createElement('div');
  el.className = `avatar ${sizeClass}`;
  el.style.cssText = 'background:var(--surface-3);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--accent)';
  el.textContent = initial;
  return el;
}

// ---- Modal helpers ----
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m => {
    m.classList.remove('active');
  });
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// ---- Confirm dialog ----
function confirmAction(message, onConfirm, danger = false) {
  const overlay = document.getElementById('confirm-modal-overlay');
  const msgEl = document.getElementById('confirm-modal-msg');
  const confirmBtn = document.getElementById('confirm-modal-confirm');
  if (!overlay) return;

  msgEl.textContent = message;
  confirmBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm`;
  confirmBtn.textContent = 'Confirm';
  overlay.classList.add('active');

  const handler = () => {
    closeModal('confirm-modal-overlay');
    onConfirm();
    confirmBtn.removeEventListener('click', handler);
  };
  confirmBtn.addEventListener('click', handler);
}

// ---- Char counter ----
function setupCharCounter(inputEl, countEl, max) {
  function update() {
    const len = inputEl.value.length;
    countEl.textContent = `${len} / ${max}`;
    countEl.className = 'char-count' + (len >= max ? ' at-limit' : len >= max * 0.85 ? ' near-limit' : '');
  }
  inputEl.addEventListener('input', update);
  update();
}

// ---- Close dropdowns on outside click ----
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown') && !e.target.closest('[data-dropdown-trigger]')) {
    document.querySelectorAll('.dropdown').forEach(d => d.remove());
  }
});

// ---- Debounce ----
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---- Export ----
window.RubhiUtils = {
  showToast, timeAgo, formatFullDate, formatNumber,
  escapeHtml, verifiedBadge, avatarHtml,
  openModal, closeModal, closeAllModals, confirmAction,
  setupCharCounter, debounce, parseDate
};
