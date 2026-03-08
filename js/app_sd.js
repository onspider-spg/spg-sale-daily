// Version 2.4 | 8 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * app_sd.js — Router + Screen Manager + Utilities
 * v2.0 — Phase 1 UI Overhaul
 * ═══════════════════════════════════════════
 *
 * Route Map:
 *   loading          → Init / Session validation
 *   no-access        → No permission screen
 *   dashboard        → S0 Home Dashboard
 *   daily-sale       → S1 Daily Sale Input
 *   expense          → S2 Expense
 *   invoice          → S3 Invoice List
 *   invoice-form     → S3 Invoice Form
 *   cash             → S4 Cash On Hand
 *   sale-history     → S5 Sale History
 *   expense-history  → S6 Expense History
 *   settings         → S7 Settings & Admin
 *   profile          → Profile
 *   notifications    → Notifications
 *   tasks            → Tasks / Follow-up
 *   daily-report     → S8 Daily Report
 *   report-hub       → Report Hub
 *   acc-review       → Send to Account (ACC Review)
 * ═══════════════════════════════════════════
 */

const App = (() => {
  const appEl = () => document.getElementById('app');
  let currentRoute = '';
  let currentParams = {};

  // Store list for HQ selector
  let stores = []; // populated from initBundle API

  // Fallback if API doesn't return stores
  const _defaultStores = [
    { store_id: 'MNG', label: 'Mango Coco', short: 'MNG' },
    { store_id: 'ISH', label: 'Issho Cafe', short: 'ISH' },
    { store_id: 'GB',  label: 'Golden Brown', short: 'GB' },
    { store_id: 'RW',  label: 'Red Wok', short: 'RW' },
    { store_id: 'TMC', label: 'Melting Cheese', short: 'TMC' },
    { store_id: 'SPG', label: 'Siam Palette Group', short: 'SPG' },
  ];

  // ─── ROUTES ───
  const ROUTES = {
    'loading':          { render: () => Screens.renderLoading(),     onLoad: null },
    'no-access':        { render: () => Screens.renderNoAccess(),    onLoad: null },
    'dashboard':        { render: () => Screens.renderDashboard(),   onLoad: () => Screens.loadDashboard() },
    'daily-sale':       { render: (p) => Screens.renderDailySale(p), onLoad: (p) => Screens.loadDailySale(p) },
    // Sprint 2
    'expense':          { render: (p) => Screens2.renderExpense(p),  onLoad: (p) => Screens2.loadExpense(p) },
    'invoice':          { render: (p) => Screens2.renderInvoice(p),      onLoad: (p) => Screens2.loadInvoice(p) },
    'invoice-form':     { render: (p) => Screens2.renderInvoiceForm(p),  onLoad: (p) => Screens2.loadInvoiceForm(p) },
    // Sprint 3
    'cash':             { render: () => Screens3.renderCash(),            onLoad: () => Screens3.loadCash() },
    'sale-history':     { render: () => Screens3.renderSaleHistory(),     onLoad: () => Screens3.loadSaleHistory() },
    'expense-history':  { render: () => Screens3.renderExpenseHistory(),  onLoad: () => Screens3.loadExpenseHistory() },
    // Sprint 4
    'settings':         { render: () => Screens4.renderSettings(),   onLoad: (p) => Screens4.loadSettings(p) },
    // Menu screens
    'profile':          { render: () => Screens.renderProfile(),     onLoad: null },
    'notifications':    { render: () => Screens4.renderNotifications(), onLoad: () => Screens4.loadNotifications() },
    'notification-settings': { render: () => Screens4.renderNotificationSettings(), onLoad: () => Screens4.loadNotificationSettings() },
    // Tasks + Daily Report
    'tasks':            { render: () => Screens5.renderTasks(),       onLoad: () => Screens5.loadTasks() },
    'daily-report':     { render: () => Screens5.renderDailyReport(), onLoad: () => Screens5.loadDailyReport() },
    // Hub screens
    'report-hub':       { render: () => Screens6.renderReportHub(),   onLoad: () => Screens6.loadReportHub() },
    'acc-review':       { render: () => Screens6.renderAccReview(),   onLoad: () => Screens6.loadAccReview() },
    // Phase 8
    'daily-detail':     { render: (p) => Screens6.renderDailyDetail(p), onLoad: (p) => Screens6.loadDailyDetail(p) },
  };

  // ─── INIT ───
  async function init() {
    go('loading');

    // Try to get token from URL (launched from Home module)
    const urlToken = API.initFromUrl();
    const session = API.getSession();

    if (!session?.token) {
      go('no-access');
      return;
    }

    try {
      showLoader();
      const data = await API.initBundle();
      API.saveSession({ token: session.token, ...data });

      // Populate stores from API (dynamic — not hardcoded)
      if (data.all_stores && data.all_stores.length > 0) {
        stores = data.all_stores;
      } else {
        stores = _defaultStores;
      }

      // Store dashboard data for loadDashboard to use without API call
      window._sdDashboardCache = data._dashboard;

      // Populate store branches from API data
      if (data.accessible_stores && data.accessible_stores.length > 0) {
        data.accessible_stores.forEach(as => {
          const s = stores.find(st => st.store_id === as.store_id);
          if (s && as.branches && as.branches.length > 0) {
            s.branches = as.branches;
          }
        });
      } else if (data.branches && data.branches.length > 0) {
        const own = stores.find(st => st.store_id === data.store_id);
        if (own) own.branches = data.branches;
      }

      // Set default store
      if (!API.isHQ()) {
        API.setSelectedStore(data.store_id);
      } else {
        API.setSelectedStore(stores[0].store_id);
      }

      go('dashboard');

      // Fetch noti + task counts (no announcement popup — L1 removed)
      refreshNotiBadge();
      refreshTaskBadge();
    } catch (err) {
      console.error('Session validation failed:', err);
      if (err.code === 'NO_ACCESS') {
        go('no-access');
      } else {
        toast('เชื่อมต่อไม่ได้ กรุณาลองใหม่', 'error');
        go('no-access');
      }
    } finally {
      hideLoader();
    }
  }

  // ─── NAVIGATE ───
  function go(route, params = {}) {
    const def = ROUTES[route];
    if (!def) {
      console.warn('Unknown route:', route);
      return go('dashboard');
    }

    // Auth guard
    const publicRoutes = ['loading', 'no-access'];
    if (!publicRoutes.includes(route)) {
      const session = API.getSession();
      if (!session?.token || !session?.tier_id) {
        return go('no-access');
      }
    }

    const container = appEl();
    try {
      const html = def.render(params);
      currentRoute = route;
      currentParams = params;
      container.innerHTML = html;
    } catch (err) {
      console.error(`[go] render failed for "${route}":`, err);
      if (route !== 'dashboard') return go('dashboard');
      return;
    }

    if (def.onLoad) {
      setTimeout(() => def.onLoad(params), 50);
    }

    window.scrollTo(0, 0);
    history.pushState({ route, params }, '', `#${route}`);

    // Update sidebar active state
    updateSidebarActive(route);
  }

  // ─── TOAST ───
  let toastTimer = null;
  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.className = `toast ${type}`;
    requestAnimationFrame(() => el.classList.add('show'));
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ─── LOADER ───
  function showLoader() {
    const el = document.getElementById('loader');
    if (el) el.classList.remove('hidden');
  }
  function hideLoader() {
    const el = document.getElementById('loader');
    if (el) el.classList.add('hidden');
  }

  // ═══════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function formatMoney(num) {
    const n = parseFloat(num) || 0;
    return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatMoneyShort(num) {
    const n = parseFloat(num) || 0;
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
    return '$' + n.toFixed(0);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ═══════════════════════════════════════════
  // STORE SELECTOR
  // ═══════════════════════════════════════════

  function renderStoreSelector() {
    if (!API.isHQ()) return '';
    const selected = API.getSelectedStore();
    const selectedBranch = API.getSelectedBranch();

    return `
      <div class="store-selector">
        <button class="store-pill ${!selected || selected === 'ALL' ? 'active' : ''}"
                onclick="App.selectStore('ALL')">ทุกร้าน</button>
        ${stores.map(s => {
          const isActive = s.store_id === selected;
          if (s.branches && s.branches.length > 0) {
            return `
              <div style="position:relative;display:inline-block">
                <button class="store-pill ${isActive ? 'active' : ''}"
                        onclick="App.selectStore('${s.store_id}')">${s.short} ▾</button>
                ${isActive ? `
                  <div class="branch-dropdown" style="position:absolute;top:100%;left:0;z-index:50;background:var(--bg);border:1px solid var(--bd);border-radius:8px;box-shadow:var(--shadow-md);margin-top:4px;min-width:140px;overflow:hidden">
                    <button class="branch-item ${!selectedBranch ? 'active' : ''}" style="display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:${!selectedBranch ? 'var(--gold-bg)' : 'transparent'};cursor:pointer"
                            onclick="App.selectBranch(null)">📊 ${s.short} (รวม)</button>
                    ${s.branches.map(b => `
                      <button class="branch-item ${selectedBranch === b.branch_id ? 'active' : ''}" style="display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:${selectedBranch === b.branch_id ? 'var(--gold-bg)' : 'transparent'};cursor:pointer"
                              onclick="App.selectBranch('${b.branch_id}')">${esc(b.branch_name)}</button>
                    `).join('')}
                  </div>
                ` : ''}
              </div>`;
          }
          return `
            <button class="store-pill ${isActive ? 'active' : ''}"
                    onclick="App.selectStore('${s.store_id}')">${s.short}</button>`;
        }).join('')}
      </div>
    `;
  }

  function selectStore(store_id) {
    API.setSelectedStore(store_id);
    API.setSelectedBranch(null);
    go(currentRoute, currentParams);
  }

  function selectBranch(branch_id) {
    API.setSelectedBranch(branch_id);
    go(currentRoute, currentParams);
  }

  // ═══════════════════════════════════════════
  // SIDEBAR — Slide-out left (Home module pattern)
  // HTML shell lives in index.html — we populate it here
  // ═══════════════════════════════════════════

  let _sidebarBuilt = false;

  function initSidebar() {
    const s = API.getSession();
    if (!s) return;

    const initial = (s.display_name || '?').charAt(0).toUpperCase();
    const tierLevel = s.tier_level || parseInt((s.tier_id || 'T9').replace('T', ''));
    const isAdmin = tierLevel <= 2 || s.store_id === 'HQ';
    const isManager = tierLevel <= 3;

    // ─── Header: profile ───
    const headerEl = document.getElementById('sidebarHeader');
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="sidebar-profile">
          <div class="sidebar-avatar">${esc(initial)}</div>
          <div>
            <div class="sidebar-name">${esc(s.display_name)}</div>
            <div class="sidebar-meta">${esc(s.tier_id)} — ${esc(s.store_name || s.store_id || 'HQ')}</div>
          </div>
        </div>`;
    }

    // ─── Body: navigation sections (tier-based) ───
    const bodyEl = document.getElementById('sidebarBody');
    if (bodyEl) {
      let body = '';

      if (isAdmin) {
        // T1-T2: Admin layout
        body += sidebarSection('Dashboard', [
          sbItem('Dashboard', 'dashboard'),
        ], true);

        body += '<div class="sidebar-divider"></div>';

        body += sidebarSection('History', [
          sbItem('Sale History', 'sale-history'),
          sbItem('Expense History', 'expense-history'),
        ], true);

        body += '<div class="sidebar-divider"></div>';

        body += sidebarSection('Report', [
          sbItem('Daily Report', 'daily-report'),
          sbItem('Tasks', 'tasks'),
          sbItem('Report Hub', 'report-hub'),
          sbItem('Daily Detail', 'daily-detail'),
          sbItem('Follow-up', 'tasks'),
        ], true);

        body += '<div class="sidebar-divider"></div>';

        body += sidebarSection('Settings', [
          sbItem('Send to Account', 'acc-review'),
          sbItem('Channels', 'settings', { tab: 'channels' }),
          sbItem('Vendors', 'settings', { tab: 'suppliers' }),
          sbItem('Categories', 'settings', { tab: 'categories' }),
          sbItem('Permissions', 'settings', { tab: 'permissions' }),
          sbItem('Audit Log', 'settings', { tab: 'audit' }),
          sbItem('Notification Settings', 'notification-settings'),
        ], false);

      } else {
        // T3+ Store-level layout
        body += sidebarSection('Input', [
          sbItem('Dashboard', 'dashboard'),
          sbItem('Daily Sale', 'daily-sale'),
          sbItem('Expense', 'expense'),
          sbItem('Invoice', 'invoice'),
          sbItem('Cash On Hand', 'cash'),
        ], true);

        body += '<div class="sidebar-divider"></div>';

        body += sidebarSection('History', [
          sbItem('Sale History', 'sale-history'),
          sbItem('Expense History', 'expense-history'),
        ], true);

        body += '<div class="sidebar-divider"></div>';

        body += sidebarSection('Report', [
          sbItem('Daily Report', 'daily-report'),
          sbItem('Follow-up', 'tasks'),
          sbItem('Report Hub', 'report-hub'),
        ], false);
      }

      bodyEl.innerHTML = body;
    }

    // ─── Footer ───
    const footerEl = document.getElementById('sidebarFooter');
    if (footerEl) {
      footerEl.innerHTML = `
        <div class="sidebar-divider" style="margin:8px 0"></div>
        <div class="sidebar-footer-item" style="padding:12px 14px" onclick="location.href='https://onspider-spg.github.io/spg-home/#dashboard'">Home</div>
        <div class="sidebar-footer-item danger" style="padding:12px 14px" onclick="location.href='https://onspider-spg.github.io/spg-home/#logout'">Logout</div>`;
    }

    _sidebarBuilt = true;
  }

  // Helper: build collapsible section
  function sidebarSection(title, items, open) {
    return `
      <details class="sidebar-section"${open ? ' open' : ''}>
        <summary>${esc(title)}</summary>
        <div>${items.join('')}</div>
      </details>`;
  }

  // Helper: build sidebar item (no icon — text only per wireframe)
  function sbItem(label, route, params) {
    const isActive = route === currentRoute;
    const paramsStr = params ? encodeURIComponent(JSON.stringify(params)) : '';
    return `<div class="sidebar-item${isActive ? ' active' : ''}" data-route="${route}" onclick="App.goSidebar('${route}','${paramsStr}')">${esc(label)}</div>`;
  }

  function openSidebar() {
    if (!_sidebarBuilt) initSidebar();
    updateSidebarActive(currentRoute);
    document.getElementById('sidebarOverlay')?.classList.add('open');
    document.getElementById('sidebarPanel')?.classList.add('open');
  }

  function closeSidebar() {
    document.getElementById('sidebarOverlay')?.classList.remove('open');
    document.getElementById('sidebarPanel')?.classList.remove('open');
  }

  // Alias for backward compat (screens call App.toggleSidebar())
  function toggleSidebar() { openSidebar(); }

  function goSidebar(route, paramsStr) {
    closeSidebar();
    let params = {};
    if (paramsStr) { try { params = JSON.parse(decodeURIComponent(paramsStr)); } catch(e) {} }
    go(route, params);
  }

  // Alias for backward compat (screens call App.goMenu())
  function goMenu(route) { goSidebar(route); }

  function updateSidebarActive(route) {
    document.querySelectorAll('.sidebar-item').forEach(el => {
      const r = el.getAttribute('data-route');
      if (r === route) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // ═══════════════════════════════════════════
  // NOTIFICATION + TASK BADGES
  // ═══════════════════════════════════════════

  async function refreshNotiBadge() {
    try {
      const data = await API.getNotifications(1);
      const count = data.unread_count || 0;
      // Update bell dot in topbar (if present)
      const dot = document.querySelector('.g-tb-bell-dot');
      if (dot) dot.style.display = count > 0 ? '' : 'none';
      return data;
    } catch (e) { /* silent */ }
    return null;
  }

  async function refreshTaskBadge() {
    try {
      const data = await API.getTasks(null, 'pending');
      const count = data.pending || 0;
      // Update task badge in sidebar (if present)
      const badge = document.getElementById('sb-task-badge');
      if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = count > 0 ? '' : 'none';
      }
    } catch (e) { /* silent */ }
  }

  // ─── LOGOUT ───
  function logout() {
    closeSidebar();
    API.clearSession();
    goHome();
  }

  // ─── BACK TO HOME MODULE ───
  function goHome() {
    const homeUrl = localStorage.getItem('spg_home_url') || 'https://onspider-spg.github.io/spg-home/';
    window.location.href = homeUrl;
  }

  // ─── POPSTATE (browser back/forward) ───
  window.addEventListener('popstate', (e) => {
    if (e.state?.route) {
      go(e.state.route, e.state.params || {});
    } else {
      // Fallback: read route from hash
      const hash = location.hash.replace('#', '') || 'dashboard';
      if (ROUTES[hash]) go(hash);
    }
  });

  return {
    init, go, toast, showLoader, hideLoader,
    esc, formatMoney, formatMoneyShort, formatDate, formatDateShort,
    todayStr, addDays,
    renderStoreSelector, selectStore, selectBranch,
    // Sidebar
    openSidebar, closeSidebar, toggleSidebar, goSidebar, goMenu,
    // Actions
    goHome, logout,
    refreshNotiBadge, refreshTaskBadge,
    // State
    getStores: () => stores,
    getCurrentRoute: () => currentRoute,
  };
})();

// Auto-init on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  App.init();
}
