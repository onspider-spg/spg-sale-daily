// Version 2.4.5 | 9 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * api_sd.js — API Client + Session Bridge
 * v2.1 — Phase 11: add alert rules visibility + notification prefs
 * ═══════════════════════════════════════════
 * Reuses Home module session token (passed via URL ?token=xxx)
 * Endpoints: EP-01 to EP-26 (Sprint 1: EP-01 to EP-10, EP-26)
 * ═══════════════════════════════════════════
 */

const API = (() => {
  // ⚠️ CHANGE THIS after deploying: supabase functions deploy sale-daily --no-verify-jwt
  let BASE_URL = localStorage.getItem('spg_sd_api_url') || 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/sale-daily';

  // Session keys
  const SD_SESSION_KEY = 'spg_sd_session';

  // ─── CLIENT CACHE (localStorage + TTL) ──────────────────────
  const _C = {
    get(k) { try { const r = JSON.parse(localStorage.getItem('sd_c_' + k)); return r && Date.now() < r.x ? r.d : null; } catch { return null; } },
    set(k, d, mins) { try { localStorage.setItem('sd_c_' + k, JSON.stringify({ d, x: Date.now() + mins * 60000 })); } catch {} },
  };

  function setBaseUrl(url) {
    BASE_URL = url.replace(/\/$/, '');
    localStorage.setItem('spg_sd_api_url', BASE_URL);
  }

  function getBaseUrl() { return BASE_URL; }

  // ─── HTTP POST ───
  async function post(action, data = {}) {
    if (!BASE_URL) throw new Error('API URL not configured');

    const url = `${BASE_URL}?action=${action}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = await resp.json();

    if (!json.success) {
      const err = new Error(json.error?.message || 'Unknown error');
      err.code = json.error?.code;
      throw err;
    }

    return json.data;
  }

  // ─── PHOTO UPLOAD (multipart) ───
  // ─── IMAGE COMPRESSION ───
  // Auto-compress before upload: max 1200px, JPEG 75%
  // ~8MB phone photo → ~200-400KB
  async function compressImage(file, maxSize = 1200, quality = 0.75) {
    // Skip if not an image
    if (!file.type.startsWith('image/')) return file;
    // Skip if already small (< 500KB)
    if (file.size < 500 * 1024) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width;
          let h = img.height;

          // Scale down if larger than maxSize
          if (w > maxSize || h > maxSize) {
            if (w > h) {
              h = Math.round(h * maxSize / w);
              w = maxSize;
            } else {
              w = Math.round(w * maxSize / h);
              h = maxSize;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          canvas.toBlob(
            (blob) => {
              if (!blob) { resolve(file); return; }
              // Create new File with original name
              const compressed = new File(
                [blob],
                file.name.replace(/\.\w+$/, '.jpg'),
                { type: 'image/jpeg' }
              );
              console.log(`📸 Compressed: ${(file.size/1024).toFixed(0)}KB → ${(compressed.size/1024).toFixed(0)}KB (${Math.round(compressed.size/file.size*100)}%)`);
              resolve(compressed);
            },
            'image/jpeg',
            quality
          );
        } catch (e) { resolve(file); }
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  async function uploadPhoto(file, category = 'sale', store_id = null) {
    const session = getSession();
    if (!session) throw new Error('No session');

    // Auto-compress before upload
    const compressed = await compressImage(file);

    const formData = new FormData();
    formData.append('token', session.token);
    formData.append('file', compressed);
    formData.append('category', category);
    if (store_id) formData.append('store_id', store_id);

    const url = `${BASE_URL}?action=sd_upload_photo`;
    const resp = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const json = await resp.json();
    if (!json.success) {
      const err = new Error(json.error?.message || 'Upload failed');
      err.code = json.error?.code;
      throw err;
    }
    return json.data;
  }

  // ─── SESSION MANAGEMENT ───
  // Token comes from: 1) URL param  2) shared spg_token  3) SD's own session
  function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let token = params.get('token');

    // Fallback: shared token from other modules
    if (!token) token = localStorage.getItem('spg_token');

    if (token) {
      // Store token in both shared + module key
      localStorage.setItem('spg_token', token);
      localStorage.setItem(SD_SESSION_KEY, JSON.stringify({ token }));
      // Clean URL
      if (params.has('token')) {
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      }
      return token;
    }
    return null;
  }

  function saveSession(data) {
    const sessionData = {
      token: data.session_id || data.token,
      account_id: data.account_id,
      user_id: data.user_id,
      display_name: data.display_name,
      full_name: data.full_name,
      tier_id: data.tier_id,
      tier_level: data.tier_level,
      store_id: data.store_id,
      dept_id: data.dept_id,
      store_name: data.store_name,
      brand: data.brand || data.brand_name || '',
      access_level: data.access_level,
      permissions: data.permissions || {},
      branches: data.branches || [],
      accessible_stores: data.accessible_stores || [],
    };
    localStorage.setItem(SD_SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem('spg_token', sessionData.token);
    return sessionData;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SD_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem(SD_SESSION_KEY);
  }

  // Check if user has specific permission
  function hasPermission(functionKey) {
    const s = getSession();
    return s?.permissions?.[functionKey] === true;
  }

  // Is HQ / admin (can see all stores)
  function isHQ() {
    const s = getSession();
    return s?.store_id === 'HQ' || s?.tier_level <= 2;
  }

  // ─── TOKEN HELPER ───
  function tokenBody(extra = {}) {
    const s = getSession();
    return { token: s?.token, ...extra };
  }

  // ─── Store selector state ───
  let _selectedStore = null;
  let _selectedBranch = null;

  function setSelectedStore(store_id) {
    _selectedStore = store_id;
    _selectedBranch = null; // reset branch when store changes
  }

  function getSelectedStore() {
    const s = getSession();
    if (_selectedStore) return _selectedStore;
    return s?.store_id || null;
  }

  function setSelectedBranch(branch_id) {
    _selectedBranch = branch_id;
  }

  function getSelectedBranch() {
    return _selectedBranch;
  }

  // ─── PUBLIC API ───
  return {
    setBaseUrl, getBaseUrl,
    initFromUrl, saveSession, getSession, clearSession,
    hasPermission, isHQ,
    setSelectedStore, getSelectedStore,
    setSelectedBranch, getSelectedBranch,
    uploadPhoto,
    compressImage,
    post,

    // EP-01: Validate Session
    validateSession: () => {
      const s = getSession();
      return post('sd_validate_session', { token: s?.token });
    },

    // INIT BUNDLE: validate_session + dashboard in 1 call
    initBundle: () => {
      const s = getSession();
      return post('sd_init_bundle', { token: s?.token });
    },

    // EP-02: Get Permissions
    getPermissions: () => post('sd_get_permissions', tokenBody()),

    // EP-03: Get Channels (enabled for store) — cached 4h
    getChannels: async (store_id) => {
      const sid = store_id || getSelectedStore();
      const cached = _C.get('ch_' + sid);
      if (cached) return cached;
      const data = await post('sd_get_channels', tokenBody({ store_id: sid }));
      _C.set('ch_' + sid, data, 240);
      return data;
    },

    // EP-04: Get Vendors — cached 30min
    getVendors: async (store_id) => {
      const sid = store_id || getSelectedStore();
      const key = 'vnd_' + sid;
      const cached = _C.get(key);
      if (cached) return cached;
      const data = await post('sd_get_vendors', tokenBody({ store_id: sid }));
      _C.set(key, data, 30);
      return data;
    },

    // EP-25: Get Store Vendor Visibility (all vendors + toggle status)

    // EP-05: Create Vendor
    createVendor: (vendor_name, vendor_group, vendor_type) =>
      post('sd_create_vendor', tokenBody({ vendor_name, vendor_group, vendor_type })),

    // EP-06: Get Categories (cascade) — cached 24h
    getCategories: async (transaction_type) => {
      const key = 'cat_' + (transaction_type || 'all');
      const cached = _C.get(key);
      if (cached) return cached;
      const data = await post('sd_get_categories', tokenBody({ transaction_type }));
      _C.set(key, data, 1440);
      return data;
    },

    // EP-07: Get Store Settings
    getStoreSettings: (store_id) => post('sd_get_store_settings', tokenBody({ store_id: store_id || getSelectedStore() })),

    // EP-08: Get Daily Sale
    getDailySale: (sale_date, store_id) =>
      post('sd_get_daily_sale', tokenBody({ sale_date, store_id: store_id || getSelectedStore() })),

    // EP-09: Save Daily Sale ★
    saveDailySale: (data) =>
      post('sd_save_daily_sale', tokenBody({
        store_id: data.store_id || getSelectedStore(),
        sale_date: data.sale_date,
        channels: data.channels,
        photo_card_url: data.photo_card_url,
        photo_cash_url: data.photo_cash_url,
        difference: data.difference,
        cancel_desc: data.cancel_desc,
        cancel_amount: data.cancel_amount,
        cancel_reason: data.cancel_reason,
        cancel_approved_by: data.cancel_approved_by,
      })),

    // EP-10: Get Dashboard
    getDashboard: (store_id) => post('sd_get_dashboard', tokenBody({ store_id: store_id || getSelectedStore() })),

    // ─── Sprint 2: S2 Expense ───

    // EP-11: Get Expenses
    getExpenses: (date, store_id) =>
      post('sd_get_expenses', tokenBody({ expense_date: date, store_id: store_id || getSelectedStore() })),

    // EP-12: Save Expense + Finance Bridge [Paid]
    saveExpense: (data) =>
      post('sd_save_expense', tokenBody({
        store_id: data.store_id || getSelectedStore(),
        expense_date: data.expense_date,
        doc_number: data.doc_number,
        vendor_name: data.vendor_name,
        main_category: data.main_category,
        sub_category: data.sub_category,
        description: data.description,
        amount_ex_gst: data.amount_ex_gst,
        gst: data.gst,
        payment_method: data.payment_method,
        photo_url: data.photo_url,
        expense_id: data.expense_id || null,
      })),

    // EP-13: Delete Expense
    deleteExpense: (expense_id) =>
      post('sd_delete_expense', tokenBody({ expense_id })),

    // ─── Sprint 2: S3 Invoice ───

    // EP-14: Get Invoices
    getInvoices: (filters) =>
      post('sd_get_invoices', tokenBody({
        store_id: filters.store_id || getSelectedStore(),
        payment_status: filters.payment_status || null,
        date_from: filters.date_from || null,
        date_to: filters.date_to || null,
      })),

    // EP-15: Save Invoice + Finance Bridge [Paid/Unpaid]
    saveInvoice: (data) =>
      post('sd_save_invoice', tokenBody({
        store_id: data.store_id || getSelectedStore(),
        invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
        invoice_no: data.invoice_no,
        vendor_name: data.vendor_name,
        main_category: data.main_category,
        sub_category: data.sub_category,
        description: data.description,
        amount_ex_gst: data.amount_ex_gst,
        gst: data.gst,
        payment_status: data.payment_status,
        payment_method: data.payment_method || null,
        payment_date: data.payment_date || null,
        due_date: data.due_date || null,
        photo_url: data.photo_url,
        invoice_id: data.invoice_id || null,
      })),

    // EP-16: Update Invoice Payment (Unpaid → Paid)
    updateInvoicePayment: (invoice_id, payment_method, payment_date) =>
      post('sd_update_invoice_payment', tokenBody({ invoice_id, payment_method, payment_date })),

    // EP-17: Delete Invoice
    deleteInvoice: (invoice_id) =>
      post('sd_delete_invoice', tokenBody({ invoice_id })),

    // ─── Sprint 3: S4 Cash On Hand ───

    // EP-18: Get Cash On Hand
    getCash: (date, store_id) =>
      post('sd_get_cash', tokenBody({ cash_date: date || new Date().toISOString().split('T')[0], store_id: store_id || getSelectedStore() })),

    // EP-19: Submit Cash Count
    submitCashCount: (data) =>
      post('sd_submit_cash_count', tokenBody({
        store_id: data.store_id || getSelectedStore(),
        cash_date: data.cash_date,
        actual_cash: data.actual_cash,
        photo_url: data.photo_url,
        mismatch_reason: data.mismatch_reason || '',
      })),

    // EP-20: Confirm Handover (3-tier chain)
    confirmHandover: (cash_id) =>
      post('sd_confirm_handover', tokenBody({ cash_id })),

    // ─── Sprint 3: S5-S6 History ───

    // EP-21: Sale History
    getSaleHistory: (month, store_id) =>
      post('sd_get_sale_history', tokenBody({ month, store_id: store_id || getSelectedStore() })),

    // EP-22: Expense History
    getExpenseHistory: (month, store_id) =>
      post('sd_get_expense_history', tokenBody({ month, store_id: store_id || getSelectedStore() })),

    // ─── Sprint 4: S7 Admin ───

    // EP-23: Admin Get Channels (all inc. disabled)
    adminGetChannels: (store_id) =>
      post('sd_admin_get_channels', tokenBody({ store_id: store_id || getSelectedStore() })),

    // EP-24: Admin Update Channel
    adminUpdateChannel: (data) =>
      post('sd_admin_update_channel', tokenBody(data)),

    reorderChannel: (channel_id, direction) =>
      post('sd_reorder_channel', tokenBody({ channel_id, direction })),

    // EP-25: Admin Get Suppliers
    adminGetSuppliers: () =>
      post('sd_admin_get_suppliers', tokenBody()),

    // EP-26b: Admin Update Supplier
    adminUpdateSupplier: (data) =>
      post('sd_admin_update_supplier', tokenBody(data)),

    // EP-27: Admin Get Settings
    adminGetSettings: (store_id) =>
      post('sd_admin_get_settings', tokenBody({ store_id: store_id || getSelectedStore() })),

    // EP-28: Admin Update Settings
    adminUpdateSettings: (data) =>
      post('sd_admin_update_settings', tokenBody({ store_id: getSelectedStore(), ...data })),

    // EP-29: Admin Get Permissions (full matrix)
    adminGetPermissions: () =>
      post('sd_admin_get_permissions', tokenBody()),

    // EP-30: Admin Update Permission Toggle
    adminUpdatePermission: (data) =>
      post('sd_admin_update_permission', tokenBody(data)),

    // EP-31: Admin Get Audit Log
    adminGetAuditLog: (filters) =>
      post('sd_admin_get_audit_log', tokenBody(filters || {})),

    // ─── Phase 1: Vendor Visibility ───

    // EP-32: Toggle Vendor Visibility

    // EP-33: Admin Get Vendor Matrix

    // ─── Phase 3: Channel CRUD + Batch Vendor ───

    // EP-26: Admin Create Channel
    adminCreateChannel: (data) =>
      post('sd_admin_create_channel', tokenBody(data)),

    // EP-27: Batch Vendor Visibility

    // EP-28: Batch Update Permissions
    adminBatchUpdatePermissions: (changes) =>
      post('sd_admin_batch_update_permissions', tokenBody({ changes })),

    // ─── Phase 5: Notifications & Announcements ───

    getNotifications: (limit) =>
      post('sd_get_notifications', tokenBody({ limit })),

    markNotificationRead: (notification_ids) =>
      post('sd_mark_notification_read', tokenBody({ notification_ids })),

    getAnnouncements: (limit) =>
      post('sd_get_announcements', tokenBody({ limit })),

    createAnnouncement: (data) =>
      post('sd_create_announcement', tokenBody(data)),

    dismissAnnouncement: (announcement_id) =>
      post('sd_dismiss_announcement', tokenBody({ announcement_id })),

    // ─── v1.5: Tasks + Daily Report ───

    getTasks: (store_id, status) =>
      post('sd_get_tasks', tokenBody({ store_id, status })),

    createTask: (data) =>
      post('sd_create_task', tokenBody(data)),

    updateTask: (data) =>
      post('sd_update_task', tokenBody(data)),

    getDailyReport: (store_id, report_date) =>
      post('sd_get_daily_report', tokenBody({ store_id, report_date })),

    saveDailyReport: (data) =>
      post('sd_save_daily_report', tokenBody(data)),

    getS8Summary: (store_id, detail_date) =>
      post('sd_get_s8_summary', tokenBody({ store_id, detail_date })),

    syncSale: (store_id, sale_date) =>
      post('sd_sync_sale', tokenBody({ store_id, sale_date })),

    unlockSale: (store_id, sale_date) =>
      post('sd_unlock_sale', tokenBody({ store_id, sale_date })),

    getReportHub: (store_id, month) =>
      post('sd_get_report_hub', tokenBody({ store_id, month })),

    getReportDashboard: (store_id, month) =>
      post('sd_get_report_dashboard', tokenBody({ store_id, month })),

    getAccReview: (store_id, month) =>
      post('sd_get_acc_review', tokenBody({ store_id, month })),

    batchSync: (store_id, dates) =>
      post('sd_batch_sync', tokenBody({ store_id, dates })),

    // ─── Phase 8: Daily Detail ───
    getDailyDetail: (store_id, detail_date) =>
      post('sd_get_daily_detail', tokenBody({ store_id, detail_date })),

    // ─── Phase 10: Categories + Notification Prefs ───
    getCategoryVisibility: (store_id) =>
      post('sd_get_category_visibility', tokenBody({ store_id: store_id || getSelectedStore() })),

    updateCategoryVisibility: (store_id, changes) =>
      post('sd_update_category_visibility', tokenBody({ store_id: store_id || getSelectedStore(), changes })),

    getNotificationPrefs: () =>
      post('sd_get_notification_prefs', tokenBody({})),

    updateNotificationPrefs: (prefs) =>
      post('sd_update_notification_prefs', tokenBody({ prefs })),

    // ─── Phase 11: Alert Rules + Anomalies ───
    getAlertRules: () =>
      post('sd_get_alert_rules', tokenBody({})),

    updateAlertRules: (updates) =>
      post('sd_update_alert_rules', tokenBody({ updates })),

    getAnomalies: (store_id) =>
      post('sd_get_anomalies', tokenBody({ store_id: store_id || getSelectedStore() })),

    // ─── Phase 12: Charts + Store Status ───
    getWeeklyComparison: (store_id) =>
      post('sd_get_weekly_comparison', tokenBody({ store_id: store_id || getSelectedStore() })),

    getCashVarianceHistory: (days) =>
      post('sd_get_cash_variance_history', tokenBody({ days: days || 7 })),

    getStoreStatus: () =>
      post('sd_get_store_status', tokenBody({})),
  };
})();
