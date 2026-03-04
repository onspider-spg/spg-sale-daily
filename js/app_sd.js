/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * app_sd.js — Router + Screen Manager + Utilities
 * v1.0 — Sprint 1
 * ═══════════════════════════════════════════
 *
 * Route Map:
 *   loading          → Init / Session validation
 *   no-access        → No permission screen
 *   dashboard        → S0 Home Dashboard
 *   daily-sale       → S1 Daily Sale Input ★
 *   expense          → S2 Expense (Sprint 2)
 *   invoice          → S3 Invoice (Sprint 2)
 *   cash             → S4 Cash On Hand (Sprint 3)
 *   sale-history     → S5 Sale History (Sprint 3)
 *   expense-history  → S6 Expense History (Sprint 3)
 *   settings         → S7 Settings & Admin (Sprint 4)
 * ═══════════════════════════════════════════
 */

const App = (() => {
  const appEl = () => document.getElementById('app');
  let currentRoute = '';
  let currentParams = {};

  // Store list for HQ selector
  let stores = [
    { store_id: 'MNG', label: 'Mango Coco', short: 'MNG' },
    { store_id: 'ISH', label: 'Issho Cafe', short: 'ISH' },
    { store_id: 'GB',  label: 'Golden Brown', short: 'GB' },
    { store_id: 'RW',  label: 'Red Wok', short: 'RW', branches: [] },
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
    'expense':          { render: () => Screens2.renderExpense(),    onLoad: () => Screens2.loadExpense() },
    'invoice':          { render: () => Screens2.renderInvoice(),    onLoad: () => Screens2.loadInvoice() },
    // Sprint 3
    'cash':             { render: () => Screens3.renderCash(),            onLoad: () => Screens3.loadCash() },
    'sale-history':     { render: () => Screens3.renderSaleHistory(),     onLoad: () => Screens3.loadSaleHistory() },
    'expense-history':  { render: () => Screens3.renderExpenseHistory(),  onLoad: () => Screens3.loadExpenseHistory() },
    // Sprint 4
    'settings':         { render: () => Screens4.renderSettings(),   onLoad: () => Screens4.loadSettings() },
    // Phase 1: ☰ Menu screens
    'profile':          { render: () => Screens.renderProfile(),     onLoad: null },
    'vendor-store':     { render: () => Screens4.renderVendorStore(), onLoad: () => Screens4.loadVendorStore() },
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
      const data = await API.validateSession();
      API.saveSession({ token: session.token, ...data });

      // Populate store branches from API data
      if (data.accessible_stores && data.accessible_stores.length > 0) {
        data.accessible_stores.forEach(as => {
          const s = stores.find(st => st.store_id === as.store_id);
          if (s && as.branches && as.branches.length > 0) {
            s.branches = as.branches;
          }
        });
      } else if (data.branches && data.branches.length > 0) {
        // For non-admin: attach own branches
        const own = stores.find(st => st.store_id === data.store_id);
        if (own) own.branches = data.branches;
      }

      // Set default store
      if (!API.isHQ()) {
        API.setSelectedStore(data.store_id);
      } else {
        // HQ defaults to first store
        API.setSelectedStore(stores[0].store_id);
      }

      go('dashboard');
      initSidebar(); // ★ v1.4: inject sidebar after session ready
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
      // ★ v1.3: set currentRoute AFTER render succeeds (prevent cascade crash)
      currentRoute = route;
      currentParams = params;
      container.innerHTML = html;
    } catch (err) {
      console.error(`[go] render failed for "${route}":`, err);
      // ถ้า render พัง → กลับ dashboard (ไม่ให้ route ติดค้าง)
      if (route !== 'dashboard') {
        return go('dashboard');
      }
      return;
    }

    if (def.onLoad) {
      setTimeout(() => def.onLoad(params), 50);
    }

    window.scrollTo(0, 0);
    history.replaceState({ route, params }, '', `#${route}`);
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

  // ─── UTILITIES ───
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

  // ─── STORE SELECTOR HTML ───
  function renderStoreSelector() {
    if (!API.isHQ()) return '';
    const selected = API.getSelectedStore();
    const selectedBranch = API.getSelectedBranch();

    return `
      <div class="store-selector">
        ${stores.map(s => {
          const isActive = s.store_id === selected;
          // If store has branches, show a dropdown pill
          if (s.branches && s.branches.length > 0) {
            return `
              <div class="store-pill-wrap" style="position:relative;display:inline-block">
                <button class="store-pill ${isActive ? 'active' : ''}"
                        onclick="App.selectStore('${s.store_id}')">${s.short} ▾</button>
                ${isActive ? `
                  <div class="branch-dropdown" style="position:absolute;top:100%;left:0;z-index:50;background:var(--bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);margin-top:4px;min-width:140px;overflow:hidden">
                    <button class="branch-opt ${!selectedBranch ? 'active' : ''}" style="display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:${!selectedBranch ? 'var(--gold-bg)' : 'transparent'};font-size:12px;cursor:pointer"
                            onclick="App.selectBranch(null)">📊 ${s.short} (รวม)</button>
                    ${s.branches.map(b => `
                      <button class="branch-opt ${selectedBranch === b.branch_id ? 'active' : ''}" style="display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:${selectedBranch === b.branch_id ? 'var(--gold-bg)' : 'transparent'};font-size:12px;cursor:pointer"
                              onclick="App.selectBranch('${b.branch_id}')">${App.esc(b.branch_name)}</button>
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

  // ─── SIDEBAR / ☰ MENU ───
  function initSidebar() {
    // Inject sidebar HTML into body (outside #app)
    if (document.getElementById('sidebar-overlay')) return; // already injected
    const s = API.getSession();
    if (!s) return;

    const initial = (s.display_name || '?').charAt(0).toUpperCase();
    const isManager = s.tier_level <= 4;
    const isAdmin = s.tier_level <= 2 || s.store_id === 'HQ';

    const html = `
      <div id="sidebar-overlay" class="sidebar-overlay" onclick="App.closeSidebar()"></div>
      <div id="sidebar" class="sidebar">
        <div class="sidebar-profile">
          <div class="sidebar-avatar">${esc(initial)}</div>
          <div>
            <div class="sidebar-name">${esc(s.display_name)}</div>
            <div class="sidebar-info">${esc(s.store_name)} · <span style="background:var(--gold-bg2);color:var(--gold-dim);padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">${esc(s.tier_id)}</span></div>
          </div>
        </div>
        <div class="sidebar-menu">
          <div class="sidebar-item" onclick="App.goMenu('profile')">👤 โปรไฟล์</div>
          <div class="sidebar-item" onclick="App.goMenu('noti')" style="opacity:0.4;pointer-events:none">🔔 แจ้งเตือน <span style="font-size:11px;color:var(--tm)">(เร็วๆ นี้)</span></div>
          ${(isManager && !isAdmin) ? `<div class="sidebar-item" onclick="App.goMenu('vendor-store')">🏪 Vendor ร้านฉัน</div>` : ''}
          ${isAdmin ? `<div class="sidebar-item" onclick="App.goMenu('settings')">⚙️ ตั้งค่า & จัดการ</div>` : ''}
          <div style="height:1px;background:var(--s2);margin:8px 20px"></div>
          <div class="sidebar-item sidebar-logout" onclick="App.logout()">🚪 ออกจากระบบ</div>
        </div>
        <div class="sidebar-footer">SPG Sale Daily v1.4</div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function toggleSidebar() {
    initSidebar(); // ensure injected
    const overlay = document.getElementById('sidebar-overlay');
    const panel = document.getElementById('sidebar');
    if (!overlay || !panel) return;
    const isOpen = panel.classList.contains('open');
    overlay.classList.toggle('open', !isOpen);
    panel.classList.toggle('open', !isOpen);
  }

  function closeSidebar() {
    const overlay = document.getElementById('sidebar-overlay');
    const panel = document.getElementById('sidebar');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  function goMenu(route) {
    closeSidebar();
    go(route);
  }

  function logout() {
    closeSidebar();
    API.clearSession();
    goHome();
  }

  // ─── BACK TO HOME ───
  function goHome() {
    // Navigate back to Home module
    const homeUrl = localStorage.getItem('spg_home_url') || 'https://onspider-spg.github.io/spg-home/';
    window.location.href = homeUrl;
  }

  // ─── POPSTATE ───
  window.addEventListener('popstate', (e) => {
    if (e.state?.route) {
      go(e.state.route, e.state.params || {});
    }
  });

  return {
    init, go, toast, showLoader, hideLoader,
    esc, formatMoney, formatMoneyShort, formatDate, formatDateShort,
    todayStr, addDays,
    renderStoreSelector, selectStore, selectBranch,
    goHome, toggleSidebar, closeSidebar, goMenu, logout,
    getStores: () => stores,
    getCurrentRoute: () => currentRoute,
  };
})();

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => App.init());
