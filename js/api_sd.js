/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * api_sd.js — API Client + Session Bridge
 * v1.0 — Supabase Edge Function
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

  function setBaseUrl(url) {
    BASE_URL = url.replace(/\/$/, '');
    localStorage.setItem('spg_sd_api_url', BASE_URL);
  }

  function getBaseUrl() { return BASE_URL; }

  // ─── HTTP POST ───
  async function post(action, data = {}) {
    if (!BASE_URL) throw new Error('API URL not configured');

    const url = `${BASE_URL}?action=${action}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await resp.json();

    if (!json.success) {
      const err = new Error(json.error?.message || 'Unknown error');
      err.code = json.error?.code;
      throw err;
    }

    return json.data;
  }

  // ─── PHOTO UPLOAD (multipart) ───
  async function uploadPhoto(file, category = 'sale', store_id = null) {
    const session = getSession();
    if (!session) throw new Error('No session');

    const formData = new FormData();
    formData.append('token', session.token);
    formData.append('file', file);
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
  // Token comes from Home module via URL: ?token=xxx
  function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      // Store token, will validate with EP-01
      localStorage.setItem(SD_SESSION_KEY, JSON.stringify({ token }));
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
      return token;
    }
    return null;
  }

  function saveSession(data) {
    const sessionData = {
      token: data.session_id || data.token,
      account_id: data.account_id,
      display_name: data.display_name,
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

    // EP-01: Validate Session
    validateSession: () => {
      const s = getSession();
      return post('sd_validate_session', { token: s?.token });
    },

    // EP-02: Get Permissions
    getPermissions: () => post('sd_get_permissions', tokenBody()),

    // EP-03: Get Channels (enabled for store)
    getChannels: (store_id) => post('sd_get_channels', tokenBody({ store_id: store_id || getSelectedStore() })),

    // EP-04: Get Vendors
    getVendors: (store_id) => post('sd_get_vendors', tokenBody({ store_id: store_id || getSelectedStore() })),

    // EP-25: Get Store Vendor Visibility (all vendors + toggle status)
    getStoreVendorVisibility: (store_id) => post('sd_get_store_vendor_visibility', tokenBody({ store_id: store_id || getSelectedStore() })),

    // EP-05: Create Vendor
    createVendor: (vendor_name, vendor_group, vendor_type) =>
      post('sd_create_vendor', tokenBody({ vendor_name, vendor_group, vendor_type })),

    // EP-06: Get Categories (cascade)
    getCategories: (transaction_type) => post('sd_get_categories', tokenBody({ transaction_type })),

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
    toggleVendorVisibility: (vendor_id, store_id, is_visible) =>
      post('sd_toggle_vendor_visibility', tokenBody({ vendor_id, store_id, is_visible })),

    // EP-33: Admin Get Vendor Matrix
    adminGetVendorMatrix: () =>
      post('sd_admin_get_vendor_matrix', tokenBody()),

    // ─── Phase 3: Channel CRUD + Batch Vendor ───

    // EP-26: Admin Create Channel
    adminCreateChannel: (data) =>
      post('sd_admin_create_channel', tokenBody(data)),

    // EP-27: Batch Vendor Visibility
    batchVendorVisibility: (store_id, changes) =>
      post('sd_batch_vendor_visibility', tokenBody({ store_id, changes })),

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
  };
})();
