// ============================================================
// AUTH UTILITIES
// ============================================================
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('ctms_token');
}

function getUser() {
  const user = localStorage.getItem('ctms_user');
  return user ? JSON.parse(user) : null;
}

function setAuth(token, user) {
  localStorage.setItem('ctms_token', token);
  localStorage.setItem('ctms_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('ctms_token');
  localStorage.removeItem('ctms_user');
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

function logout() {
  clearAuth();
  window.location.href = '/index.html';
}

// ============================================================
// API HELPER
// ============================================================
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    
    if (response.status === 401 || response.status === 403) {
      clearAuth();
      window.location.href = '/index.html';
      return;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    if (!response.ok) throw new Error('Request failed');
    return response;
  } catch (err) {
    throw err;
  }
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
let toastContainer = null;

function initToasts() {
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
}

function showToast(type, title, message = '', duration = 3500) {
  if (!toastContainer) initToasts();
  
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ============================================================
// THEME MANAGEMENT
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('ctms_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ctms_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ============================================================
// SIDEBAR MANAGEMENT
// ============================================================
function initSidebar() {
  const toggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    });
  }
  
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
  
  // Set active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes(currentPage.replace('.html', ''))) {
      link.classList.add('active');
    }
  });
}

// ============================================================
// USER INFO
// ============================================================
function populateUserInfo() {
  const user = getUser();
  if (!user) return;
  
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  const avatarEl = document.getElementById('userAvatar');
  const headerUserEl = document.getElementById('headerUser');
  
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
  if (headerUserEl) headerUserEl.textContent = user.name;
}

// ============================================================
// CONFIRMATION DIALOG
// ============================================================
function showConfirm(title, message, onConfirm, type = 'danger') {
  let modal = document.getElementById('confirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-header">
          <span class="modal-title" id="confirmTitle"></span>
          <button class="modal-close" onclick="closeConfirm()">✕</button>
        </div>
        <div class="modal-body">
          <p id="confirmMessage" style="color:var(--text-secondary);font-size:14px;line-height:1.6;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeConfirm()">Cancel</button>
          <button class="btn" id="confirmBtn">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  const btn = document.getElementById('confirmBtn');
  btn.className = `btn btn-${type}`;
  btn.textContent = type === 'danger' ? '🗑️ Delete' : 'Confirm';
  btn.onclick = () => { closeConfirm(); onConfirm(); };
  
  modal.classList.add('open');
  modal.onclick = (e) => { if (e.target === modal) closeConfirm(); };
}

function closeConfirm() {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('open');
}

// ============================================================
// FORMATTING UTILITIES
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatWeight(weight) {
  return `${parseFloat(weight).toFixed(2)} T`;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getMaterialBadgeClass(material) {
  const map = {
    'Sand': 'badge-sand',
    'Gravel': 'badge-gravel',
    'Cement': 'badge-cement',
    'Steel': 'badge-steel',
    'Bricks': 'badge-bricks',
    'Aggregate': 'badge-aggregate',
    'Concrete Mix': 'badge-default'
  };
  return map[material] || 'badge-default';
}

function getMaterialColor(material) {
  const colors = {
    'Sand': '#f59e0b',
    'Gravel': '#6b7280',
    'Cement': '#6366f1',
    'Steel': '#3b82f6',
    'Bricks': '#ef4444',
    'Aggregate': '#10b981',
    'Concrete Mix': '#f97316'
  };
  return colors[material] || '#94a3b8';
}

// ============================================================
// EXPORT HELPER
// ============================================================
function buildExportUrl(endpoint, filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val) params.append(key, val);
  });
  const token = getToken();
  params.append('_token', token); // We'll handle this differently
  return `/api/export/${endpoint}?${params.toString()}`;
}

async function exportData(format, filters = {}) {
  const token = getToken();
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => { if (val) params.append(key, val); });
  
  try {
    const response = await fetch(`/api/export/${format}?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truck_entries_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Export Successful', `Data exported as ${format.toUpperCase()}`);
  } catch (err) {
    showToast('error', 'Export Failed', err.message);
  }
}

// ============================================================
// INIT COMMON
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initToasts();
  
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  
  const logoutBtns = document.querySelectorAll('[data-action="logout"]');
  logoutBtns.forEach(btn => btn.addEventListener('click', () => {
    showConfirm('Logout', 'Are you sure you want to logout?', logout, 'secondary');
  }));
  
  initSidebar();
  populateUserInfo();
});
