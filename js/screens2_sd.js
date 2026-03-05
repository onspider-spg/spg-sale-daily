/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens2_sd.js — Sprint 2: S2 Expense + S3 Invoice
 * v1.0
 * ═══════════════════════════════════════════
 */

const Screens2 = (() => {

  // ════════════════════════════════════════
  // SHARED: Category Cascade + Vendor Dropdown
  // ════════════════════════════════════════

  let _vendors = [];
  let _categoryCascade = {};
  let _expenseMainCategories = [];

  async function loadLookups() {
    // Load vendors (now filtered by store visibility)
    try {
      const vData = await API.getVendors();
      _vendors = (vData.vendors || []).map(v => ({ id: v.id, name: v.vendor_name }));
    } catch { _vendors = []; }

    // Load categories (Expense type only)
    try {
      const cData = await API.getCategories('Expense');
      _categoryCascade = cData.cascade?.Expense || {};
      _expenseMainCategories = Object.keys(_categoryCascade).sort();
    } catch { _categoryCascade = {}; _expenseMainCategories = []; }
  }

  function renderVendorDropdown(id, value) {
    return `
      <div class="vendor-search-wrap" style="position:relative">
        <div style="display:flex;gap:6px;align-items:center">
          <div style="flex:1;position:relative">
            <input type="text" class="form-input" id="${id}" value="${App.esc(value || '')}"
                   placeholder="🔍 พิมพ์ค้นหา Vendor..."
                   autocomplete="off"
                   onfocus="Screens2.showVendorList('${id}')"
                   oninput="Screens2.filterVendorList('${id}')">
            <div id="${id}-list" class="vendor-dropdown-list" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:var(--bg);border:1px solid var(--border);border-radius:0 0 8px 8px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1)"></div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="App.go('settings')" title="จัดการ Vendor" style="padding:8px;min-width:36px">⚙</button>
        </div>
        <div style="margin-top:4px">
          <button class="btn btn-sm btn-outline" onclick="Screens2.showNewVendorModal('${id}')">+ เพิ่ม Vendor ใหม่</button>
        </div>
      </div>`;
  }

  function showVendorList(id) {
    filterVendorList(id);
    document.getElementById(id + '-list').style.display = 'block';
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function _close(e) {
        if (!e.target.closest('.vendor-search-wrap')) {
          const el = document.getElementById(id + '-list');
          if (el) el.style.display = 'none';
          document.removeEventListener('click', _close);
        }
      });
    }, 50);
  }

  function filterVendorList(id) {
    const input = document.getElementById(id);
    const q = (input?.value || '').toLowerCase();
    const listEl = document.getElementById(id + '-list');
    if (!listEl) return;

    const filtered = _vendors.filter(v => v.name.toLowerCase().includes(q));
    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="padding:10px;color:var(--tm);font-size:12px;text-align:center">ไม่พบ — ลองกด "+ เพิ่ม"</div>';
    } else {
      listEl.innerHTML = filtered.map(v =>
        `<div class="vendor-opt" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
              onmousedown="Screens2.pickVendor('${id}', '${App.esc(v.name)}')">${App.esc(v.name)}</div>`
      ).join('');
    }
    listEl.style.display = 'block';
  }

  function pickVendor(id, name) {
    const input = document.getElementById(id);
    if (input) input.value = name;
    const listEl = document.getElementById(id + '-list');
    if (listEl) listEl.style.display = 'none';
  }

  function onVendorChange(id) {
    // no-op for now
  }

  function renderMainCategoryDropdown(id, value, onchangeFn) {
    const opts = _expenseMainCategories.map(m =>
      `<option value="${App.esc(m)}" ${m === value ? 'selected' : ''}>${App.esc(m)}</option>`
    ).join('');
    return `
      <select class="form-select" id="${id}" onchange="${onchangeFn}">
        <option value="">— เลือก Main —</option>
        ${opts}
      </select>`;
  }

  function renderSubCategoryDropdown(id, mainCategory, value) {
    const subs = _categoryCascade[mainCategory] || [];
    const opts = subs.map(s =>
      `<option value="${App.esc(s)}" ${s === value ? 'selected' : ''}>${App.esc(s)}</option>`
    ).join('');
    return `
      <select class="form-select" id="${id}">
        <option value="">— เลือก Sub —</option>
        ${opts}
      </select>`;
  }

  // Update sub dropdown when main changes
  function onMainCategoryChange(mainId, subId) {
    const mainVal = document.getElementById(mainId)?.value || '';
    const subContainer = document.getElementById(subId + '-wrap');
    if (subContainer) {
      subContainer.innerHTML = renderSubCategoryDropdown(subId, mainVal, '');
    }
  }

  // New Vendor Modal
  function showNewVendorModal(dropdownId) {
    const overlay = document.createElement('div');
    overlay.id = 'vendor-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius);padding:24px;width:90%;max-width:360px;">
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">➕ สร้าง Vendor ใหม่</div>
        <div class="form-group">
          <label class="form-label">ชื่อ Vendor <span class="req">*</span></label>
          <input type="text" class="form-input" id="new-vendor-name" placeholder="เช่น Akipan" autofocus>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-gold" style="flex:1" onclick="Screens2.doCreateVendor('${dropdownId}')">สร้าง</button>
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('vendor-modal')?.remove()">ยกเลิก</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('new-vendor-name')?.focus(), 100);
  }

  async function doCreateVendor(dropdownId) {
    const name = (document.getElementById('new-vendor-name')?.value || '').trim();
    if (!name) { App.toast('กรุณาใส่ชื่อ Vendor', 'error'); return; }

    try {
      App.showLoader();
      const result = await API.createVendor(name);

      // Success — add to local list
      App.toast(`สร้าง "${name}" สำเร็จ ✓`, 'success');
      _vendors.push({ id: result.vendor?.id, name: name });
      _vendors.sort((a, b) => a.name.localeCompare(b.name));

      const input = document.getElementById(dropdownId);
      if (input) input.value = name;

      document.getElementById('vendor-modal')?.remove();
    } catch (err) {
      if (err.code === 'DUPLICATE_VISIBLE') {
        App.toast(`"${err.vendor_name || name}" มีในรายการแล้ว`, 'error');
        const input = document.getElementById(dropdownId);
        if (input) input.value = err.vendor_name || name;
        document.getElementById('vendor-modal')?.remove();
      } else if (err.code === 'DUPLICATE_HIDDEN') {
        // Offer to enable
        if (confirm(`"${err.vendor_name || name}" มีในระบบแต่ปิดอยู่\nต้องการเปิดการมองเห็นไหม?`)) {
          try {
            await API.toggleVendorVisibility(err.vendor_id, API.getSelectedStore(), true);
            App.toast(`เปิด "${err.vendor_name}" สำเร็จ ✓`, 'success');
            _vendors.push({ id: err.vendor_id, name: err.vendor_name });
            _vendors.sort((a, b) => a.name.localeCompare(b.name));
            const input = document.getElementById(dropdownId);
            if (input) input.value = err.vendor_name;
          } catch (e2) { App.toast(e2.message, 'error'); }
        }
        document.getElementById('vendor-modal')?.remove();
      } else {
        App.toast('สร้าง Vendor ไม่สำเร็จ: ' + err.message, 'error');
      }
    } finally {
      App.hideLoader();
    }
  }


  // ════════════════════════════════════════
  // S2: EXPENSE INPUT
  // ════════════════════════════════════════

  let s2 = {
    date: null,
    expenses: [],
    photoUrl: null,
    editId: null,
  };

  function renderExpense(params) {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    // Accept date from params (when coming from history edit)
    if (params && params.date) s2.date = params.date;
    const date = s2.date || App.todayStr();
    s2.date = date;

    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div>
            <div class="header-title">🧾 ค่าใช้จ่าย</div>
            <div class="header-sub">S2 Expense · ${App.esc(session.store_name)}</div>
          </div>
          <div class="header-right">
            <span class="tag gold">→ Finance [Paid]</span>
          </div>
        </div>

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Date bar -->
          <div class="date-bar">
            <button class="date-nav" onclick="Screens2.s2ChangeDate(-1)">‹</button>
            <div class="date-display">
              <span id="s2-date-label">${App.formatDate(date)}</span>
            </div>
            <button class="date-nav" onclick="Screens2.s2ChangeDate(1)">›</button>
            <button class="date-today" onclick="Screens2.s2GoToday()">วันนี้</button>
          </div>

          <!-- Expense List -->
          <div class="section-label">📋 รายจ่ายวันนี้</div>
          <div id="s2-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>

          <!-- Summary -->
          <div id="s2-summary"></div>

          <div class="divider"></div>

          <!-- New Expense Form -->
          <div class="section-label">✏️ เพิ่มรายจ่าย — กรอก 8 fields</div>
          <div class="card" id="s2-form">
            <!-- Auto fields -->
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
              <span class="tag gray">Store: ${App.esc(session.store_name)}</span>
              <span class="tag gray">Date: ${App.formatDate(date)}</span>
              <span class="tag blue">Doc Type: Bill (auto)</span>
            </div>

            <!-- 8 Manual fields -->
            <div class="form-group">
              <label class="form-label">❶ Doc Number <span class="req">*</span></label>
              <input type="text" class="form-input" id="s2-doc-number" placeholder="เลขจากบิล">
            </div>

            <div class="form-group">
              <label class="form-label">❷ Vendor Name <span class="req">*</span></label>
              <div id="s2-vendor-wrap">${renderVendorDropdown('s2-vendor', '')}</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div class="form-group">
                <label class="form-label">❸ Main Category <span class="req">*</span></label>
                <div id="s2-main-wrap">${renderMainCategoryDropdown('s2-main', '', "Screens2.onMainCategoryChange('s2-main','s2-sub')")}</div>
              </div>
              <div class="form-group">
                <label class="form-label">❹ Sub Category <span class="req">*</span></label>
                <div id="s2-sub-wrap">${renderSubCategoryDropdown('s2-sub', '', '')}</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">❺ Description <span class="req">*</span></label>
              <input type="text" class="form-input" id="s2-desc" placeholder="อธิบายสั้นๆ">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              <div class="form-group">
                <label class="form-label">❻ Amount <span class="req">*</span></label>
                <input type="number" step="0.01" class="form-input" id="s2-amount"
                       placeholder="0.00" oninput="Screens2.s2CalcTotal()">
              </div>
              <div class="form-group">
                <label class="form-label">❼ GST <span class="req">*</span></label>
                <input type="number" step="0.01" class="form-input" id="s2-gst"
                       placeholder="0.00" oninput="Screens2.s2CalcTotal()">
              </div>
              <div class="form-group">
                <label class="form-label">Total <span class="auto-tag">AUTO</span></label>
                <input type="text" class="form-input readonly" id="s2-total" value="$0.00" readonly>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">❽ Payment Method <span class="req">*</span></label>
              <div style="display:flex;gap:8px">
                <button class="btn btn-outline btn-sm" id="s2-pay-cash" onclick="Screens2.s2SetPayment('cash')" style="flex:1">💵 Cash</button>
                <button class="btn btn-outline btn-sm" id="s2-pay-card" onclick="Screens2.s2SetPayment('card')" style="flex:1">💳 Card</button>
              </div>
            </div>

            <!-- Photo -->
            <div class="form-group">
              <label class="form-label">📸 ถ่ายใบเสร็จ <span class="req">*</span></label>
              <div class="photo-grid" style="grid-template-columns:1fr">
                <div class="photo-box" id="s2-photo-box" onclick="Screens2.s2PickPhoto()"
                     style="min-height:80px">
                  <div class="photo-icon">📸</div>
                  <div class="photo-label">ถ่ายใบเสร็จ</div>
                  <div class="photo-required">* บังคับ</div>
                </div>
              </div>
              <input type="file" id="s2-file-input" accept="image/*" capture="environment"
                     style="display:none" onchange="Screens2.s2HandlePhoto(event)">
            </div>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="bottom-bar">
          <button class="btn btn-outline" style="flex:0.4" onclick="Screens2.s2ClearForm()">ล้าง</button>
          <button class="btn btn-gold" style="flex:1" id="s2-save-btn" onclick="Screens2.s2Save()">
            💾 บันทึก
          </button>
        </div>
      </div>`;
  }

  async function loadExpense() {
    try {
      App.showLoader();
      await loadLookups();

      // Re-render dropdowns with loaded data
      const vendorWrap = document.getElementById('s2-vendor-wrap');
      if (vendorWrap) vendorWrap.innerHTML = renderVendorDropdown('s2-vendor', '');

      const mainWrap = document.getElementById('s2-main-wrap');
      if (mainWrap) mainWrap.innerHTML = renderMainCategoryDropdown('s2-main', '', "Screens2.onMainCategoryChange('s2-main','s2-sub')");

      // Load expense list
      const data = await API.getExpenses(s2.date);
      s2.expenses = data.expenses || [];
      renderS2List();
      renderS2Summary(data.summary);

    } catch (err) {
      console.error('Load expense error:', err);
      App.toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      App.hideLoader();
    }
  }

  function renderS2List() {
    const el = document.getElementById('s2-list');
    if (!el) return;

    if (s2.expenses.length === 0) {
      el.innerHTML = '<div class="card-flat" style="text-align:center;color:var(--tm)">ยังไม่มีรายจ่ายวันนี้</div>';
      return;
    }

    el.innerHTML = s2.expenses.map(e => `
      <div class="card-flat" style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${App.esc(e.doc_number)} · ${App.esc(e.vendor_name)}</div>
          <div style="font-size:11px;color:var(--td)">${App.esc(e.main_category)} > ${App.esc(e.sub_category)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:14px">${App.formatMoney(e.total_amount)}</div>
          <div style="font-size:10px">${e.payment_method === 'cash' ? '💵' : '💳'} ${e.fin_transaction_id ? '<span class="tag green" style="font-size:9px">synced</span>' : ''}</div>
        </div>
      </div>
    `).join('');
  }

  function renderS2Summary(summary) {
    const el = document.getElementById('s2-summary');
    if (!el || !summary) return;

    el.innerHTML = `
      <div class="total-bar" style="border-color:var(--red);background:var(--red-bg)">
        <div>
          <span class="total-label" style="color:var(--red)">รวมรายจ่าย</span>
          <span style="font-size:11px;color:var(--td);display:block">${summary.count} รายการ · 💵${App.formatMoney(summary.total_cash)} · 💳${App.formatMoney(summary.total_card)}</span>
        </div>
        <span class="total-value" style="color:var(--red)">${App.formatMoney(summary.total_expenses)}</span>
      </div>`;
  }

  let _s2PaymentMethod = '';

  function s2SetPayment(method) {
    _s2PaymentMethod = method;
    const cashBtn = document.getElementById('s2-pay-cash');
    const cardBtn = document.getElementById('s2-pay-card');
    if (cashBtn) cashBtn.className = `btn btn-sm ${method === 'cash' ? 'btn-gold' : 'btn-outline'}`;
    if (cardBtn) cardBtn.className = `btn btn-sm ${method === 'card' ? 'btn-gold' : 'btn-outline'}`;
  }

  function s2CalcTotal() {
    const amt = parseFloat(document.getElementById('s2-amount')?.value) || 0;
    const gst = parseFloat(document.getElementById('s2-gst')?.value) || 0;
    const el = document.getElementById('s2-total');
    if (el) el.value = App.formatMoney(amt + gst);
  }

  function s2PickPhoto() {
    document.getElementById('s2-file-input')?.click();
  }

  async function s2HandlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      App.showLoader();
      const result = await API.uploadPhoto(file, 'expense');
      s2.photoUrl = result.url;

      const box = document.getElementById('s2-photo-box');
      if (box) {
        box.classList.add('has-photo');
        box.innerHTML = `<img src="${result.url}" alt="Receipt"><div class="photo-check">✓</div>`;
      }
      App.toast('อัพโหลดสำเร็จ ✓', 'success');
    } catch (err) {
      App.toast('อัพโหลดไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      event.target.value = '';
    }
  }

  async function s2Save() {
    const doc_number = document.getElementById('s2-doc-number')?.value?.trim();
    const vendor_name = document.getElementById('s2-vendor')?.value;
    const main_category = document.getElementById('s2-main')?.value;
    const sub_category = document.getElementById('s2-sub')?.value;
    const description = document.getElementById('s2-desc')?.value?.trim();
    const amount_ex_gst = parseFloat(document.getElementById('s2-amount')?.value) || 0;
    const gst = parseFloat(document.getElementById('s2-gst')?.value) || 0;

    // Quick validation
    if (!doc_number) return App.toast('กรุณาใส่ Doc Number (❶)', 'error');
    if (!vendor_name) return App.toast('กรุณาเลือก Vendor (❷)', 'error');
    if (!main_category) return App.toast('กรุณาเลือก Main Category (❸)', 'error');
    if (!sub_category) return App.toast('กรุณาเลือก Sub Category (❹)', 'error');
    if (!description) return App.toast('กรุณาใส่ Description (❺)', 'error');
    if (amount_ex_gst <= 0) return App.toast('Amount ต้อง > 0 (❻)', 'error');
    if (!_s2PaymentMethod) return App.toast('กรุณาเลือก Payment Method (❽)', 'error');
    if (!s2.photoUrl) return App.toast('กรุณาถ่ายรูปใบเสร็จ (📸)', 'error');

    try {
      App.showLoader();
      const btn = document.getElementById('s2-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

      const result = await API.saveExpense({
        expense_date: s2.date,
        doc_number, vendor_name, main_category, sub_category,
        description, amount_ex_gst, gst,
        payment_method: _s2PaymentMethod,
        photo_url: s2.photoUrl,
        expense_id: s2.editId,
      });

      App.toast('บันทึกสำเร็จ ✓', 'success');

      // Stay on same page — clear form and reload list
      s2ClearForm();
      const data = await API.getExpenses(s2.date);
      s2.expenses = data.expenses || [];
      renderS2List();
      renderS2Summary(data.summary);

    } catch (err) {
      App.toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      const btn = document.getElementById('s2-save-btn');
      if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก'; }
    }
  }

  function s2ClearForm() {
    ['s2-doc-number', 's2-desc', 's2-amount', 's2-gst'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const vendor = document.getElementById('s2-vendor');
    if (vendor) vendor.value = '';
    const main = document.getElementById('s2-main');
    if (main) main.value = '';
    const subWrap = document.getElementById('s2-sub-wrap');
    if (subWrap) subWrap.innerHTML = renderSubCategoryDropdown('s2-sub', '', '');

    s2.photoUrl = null;
    s2.editId = null;
    _s2PaymentMethod = '';
    s2CalcTotal();
    s2SetPayment('');

    const box = document.getElementById('s2-photo-box');
    if (box) {
      box.classList.remove('has-photo');
      box.innerHTML = '<div class="photo-icon">📸</div><div class="photo-label">ถ่ายใบเสร็จ</div><div class="photo-required">* บังคับ</div>';
    }
  }

  function s2ChangeDate(delta) {
    s2.date = App.addDays(s2.date || App.todayStr(), delta);
    if (s2.date > App.todayStr()) { App.toast('ไม่สามารถเลือกวันในอนาคต', 'warning'); s2.date = App.todayStr(); }
    App.go('expense');
  }

  function s2GoToday() { s2.date = App.todayStr(); App.go('expense'); }


  // ════════════════════════════════════════
  // S3: INVOICE INPUT
  // ════════════════════════════════════════

  let s3 = {
    invoices: [],
    photoUrl: null,
    editId: null,
    paymentStatus: 'unpaid',
  };

  function renderInvoice(params) {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div style="flex:1;min-width:0">
            <div class="header-title">📄 Invoice</div>
            <div class="header-sub">S3 Invoice · ${App.esc(session.store_name)}</div>
          </div>
          <button class="back-btn" onclick="App.toggleSidebar()" style="font-size:16px">☰</button>
        </div>

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Date Range -->
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;font-size:12px">
            <span style="color:var(--td)">📅</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s3-date-from" onchange="Screens2.s3ReloadList()">
            <span style="color:var(--tm)">→</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s3-date-to" onchange="Screens2.s3ReloadList()">
          </div>

          <!-- Tabs -->
          <div class="nav-tabs">
            <button class="nav-tab active" id="s3-tab-all" onclick="Screens2.s3FilterTab('all')">ทั้งหมด</button>
            <button class="nav-tab" id="s3-tab-unpaid" onclick="Screens2.s3FilterTab('unpaid')">🔴 Unpaid</button>
            <button class="nav-tab" id="s3-tab-paid" onclick="Screens2.s3FilterTab('paid')">✅ Paid</button>
          </div>

          <!-- Summary -->
          <div id="s3-summary"></div>

          <!-- Invoice List -->
          <div id="s3-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>

          <!-- Add button -->
          <div style="padding:16px 0">
            <button class="btn btn-gold" style="width:100%" onclick="Screens2.s3GoAdd()">+ เพิ่ม Invoice</button>
          </div>
        </div>
      </div>`;
  }

  function renderInvoiceForm(params) {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    if (params && params.edit_id) s3.editId = params.edit_id;
    const isEdit = !!s3.editId;

    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('invoice')">←</button>
          <div style="flex:1;min-width:0">
            <div class="header-title">${isEdit ? '✏️ แก้ไข Invoice' : '📄 เพิ่ม Invoice'}</div>
            <div class="header-sub">S3 · ${App.esc(session.store_name)}</div>
          </div>
        </div>
        <div class="screen-body">
          <div class="card" id="s3-form">
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
              <span class="tag gray">Store: ${App.esc(session.store_name)}</span>
              <span class="tag blue">Doc Type: Invoice</span>
            </div>
            <div class="form-group">
              <label class="form-label">📅 Issue Date <span class="req">*</span></label>
              <input type="date" class="form-input" id="s3-issue-date" value="${App.todayStr()}">
            </div>
            <div class="form-group">
              <label class="form-label">Invoice No <span class="req">*</span></label>
              <input type="text" class="form-input" id="s3-invoice-no" placeholder="INV-xxxx">
            </div>
            <div class="form-group">
              <label class="form-label">Vendor Name <span class="req">*</span></label>
              <div id="s3-vendor-wrap">${renderVendorDropdown('s3-vendor', '')}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div class="form-group">
                <label class="form-label">Main Category <span class="req">*</span></label>
                <div id="s3-main-wrap">${renderMainCategoryDropdown('s3-main', '', "Screens2.onMainCategoryChange('s3-main','s3-sub')")}</div>
              </div>
              <div class="form-group">
                <label class="form-label">Sub Category <span class="req">*</span></label>
                <div id="s3-sub-wrap">${renderSubCategoryDropdown('s3-sub', '', '')}</div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description <span class="req">*</span></label>
              <input type="text" class="form-input" id="s3-desc" placeholder="อธิบาย">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
              <div class="form-group">
                <label class="form-label">Amount (ex GST) <span class="req">*</span></label>
                <input type="number" step="0.01" class="form-input" id="s3-amount" placeholder="0.00" oninput="Screens2.s3CalcTotal()">
              </div>
              <div class="form-group">
                <label class="form-label">GST <span class="req">*</span></label>
                <input type="number" step="0.01" class="form-input" id="s3-gst" placeholder="0.00" oninput="Screens2.s3CalcTotal()">
              </div>
              <div class="form-group">
                <label class="form-label">Total <span class="auto-tag">AUTO</span></label>
                <input type="text" class="form-input readonly" id="s3-total" value="$0.00" readonly>
              </div>
            </div>
            <div class="divider"></div>
            <div class="section-label" style="color:var(--red);margin-top:0">💳 Payment Status</div>
            <div class="form-group">
              <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-outline" id="s3-status-paid" onclick="Screens2.s3SetStatus('paid')" style="flex:1">✅ Paid</button>
                <button class="btn btn-sm btn-gold" id="s3-status-unpaid" onclick="Screens2.s3SetStatus('unpaid')" style="flex:1">🔴 Unpaid</button>
              </div>
            </div>
            <div id="s3-unpaid-fields">
              <div class="form-group">
                <label class="form-label">Due Date <span class="req">*</span></label>
                <input type="date" class="form-input" id="s3-due-date">
              </div>
            </div>
            <div id="s3-paid-fields" style="display:none">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group">
                  <label class="form-label">Payment Date</label>
                  <input type="date" class="form-input" id="s3-payment-date">
                </div>
                <div class="form-group">
                  <label class="form-label">Payment Method</label>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-outline" id="s3-pay-cash" onclick="Screens2.s3SetPayMethod('cash')" style="flex:1">💵</button>
                    <button class="btn btn-sm btn-outline" id="s3-pay-card" onclick="Screens2.s3SetPayMethod('card')" style="flex:1">💳</button>
                    <button class="btn btn-sm btn-outline" id="s3-pay-transfer" onclick="Screens2.s3SetPayMethod('transfer')" style="flex:1">🏦</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label class="form-label">📸 ถ่ายหน้า Invoice <span class="req">*</span></label>
              <div class="photo-grid" style="grid-template-columns:1fr">
                <div class="photo-box" id="s3-photo-box" onclick="Screens2.s3PickPhoto()" style="min-height:80px">
                  <div class="photo-icon">📸</div>
                  <div class="photo-label">ถ่าย Invoice</div>
                  <div class="photo-required">* บังคับ</div>
                </div>
              </div>
              <input type="file" id="s3-file-input" accept="image/*" capture="environment" style="display:none" onchange="Screens2.s3HandlePhoto(event)">
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px;padding-bottom:20px">
            <button class="btn btn-gold" style="flex:1" id="s3-save-btn" onclick="Screens2.s3Save()">💾 บันทึก</button>
            <button class="btn btn-outline" style="flex:0.4" onclick="App.go('invoice')">ยกเลิก</button>
          </div>
        </div>
      </div>`;
  }

  async function loadInvoice(params) {
    try {
      App.showLoader();
      // Set default date range (this month)
      const now = new Date();
      const fromEl = document.getElementById('s3-date-from');
      const toEl = document.getElementById('s3-date-to');
      if (fromEl && !fromEl.value) fromEl.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      if (toEl && !toEl.value) toEl.value = App.todayStr();
      await s3FetchList();
    } catch (err) {
      App.toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      App.hideLoader();
    }
  }

  async function loadInvoiceForm(params) {
    try {
      App.showLoader();
      await loadLookups();
      // Re-render dropdowns
      const vw = document.getElementById('s3-vendor-wrap');
      if (vw) vw.innerHTML = renderVendorDropdown('s3-vendor', '');
      const mw = document.getElementById('s3-main-wrap');
      if (mw) mw.innerHTML = renderMainCategoryDropdown('s3-main', '', "Screens2.onMainCategoryChange('s3-main','s3-sub')");
      // Auto-fill if editing
      if (s3.editId) {
        const data = await API.getInvoices({});
        s3.invoices = data.invoices || [];
        s3EditInvoice(s3.editId);
      }
    } catch (err) {
      App.toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      App.hideLoader();
    }
  }

  function s3GoAdd() {
    s3ClearForm();
    App.go('invoice-form');
  }

  function s3GoEdit(id) {
    s3.editId = id;
    App.go('invoice-form', { edit_id: id });
  }

  async function s3FetchList() {
    const dateFrom = document.getElementById('s3-date-from')?.value || null;
    const dateTo = document.getElementById('s3-date-to')?.value || null;
    const data = await API.getInvoices({ date_from: dateFrom, date_to: dateTo });
    s3.invoices = data.invoices || [];
    renderS3List(_s3CurrentTab);
    renderS3Summary(data.summary);
  }

  async function s3ReloadList() {
    try {
      App.showLoader();
      await s3FetchList();
    } catch (err) { App.toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
    finally { App.hideLoader(); }
  }

  let _s3CurrentTab = 'all';

  function s3FilterTab(tab) {
    _s3CurrentTab = tab;
    ['all', 'unpaid', 'paid'].forEach(t => {
      const btn = document.getElementById(`s3-tab-${t}`);
      if (btn) btn.className = `nav-tab ${t === tab ? 'active' : ''}`;
    });
    renderS3List(tab);
  }

  function s3EditInvoice(id) {
    const inv = s3.invoices.find(i => i.id === id);
    if (!inv) return;

    // Load into form
    const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
    setVal('s3-issue-date', inv.issue_date || '');
    setVal('s3-invoice-no', inv.invoice_no);
    setVal('s3-vendor', inv.vendor_name);
    setVal('s3-main', inv.main_category);

    // Trigger sub category reload
    const sw = document.getElementById('s3-sub-wrap');
    if (sw) sw.innerHTML = renderSubCategoryDropdown('s3-sub', inv.main_category, inv.sub_category);

    setVal('s3-desc', inv.description);
    setVal('s3-amount', inv.amount_ex_gst);
    setVal('s3-gst', inv.gst);
    s3CalcTotal();

    setVal('s3-due-date', inv.due_date || '');
    setVal('s3-payment-date', inv.payment_date || '');

    s3.paymentStatus = inv.payment_status || 'unpaid';
    _s3PayMethod = inv.payment_method || '';
    s3SetStatus(s3.paymentStatus);

    if (inv.payment_method) {
      ['cash', 'card', 'transfer'].forEach(m => {
        const btn = document.getElementById(`s3-pay-${m}`);
        if (btn) btn.className = `btn btn-sm ${m === inv.payment_method ? 'btn-gold' : 'btn-outline'}`;
      });
    }

    s3.photoUrl = inv.photo_url || null;
    s3.editId = inv.id;

    if (inv.photo_url) {
      const box = document.getElementById('s3-photo-box');
      if (box) { box.classList.add('has-photo'); box.innerHTML = `<img src="${inv.photo_url}" alt="Invoice"><div class="photo-check">✓</div>`; }
    }

    // Scroll to form
    document.getElementById('s3-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    App.toast('✏️ แก้ไข Invoice — กด บันทึก เมื่อเสร็จ', 'info');
  }

  function renderS3List(filter) {
    const el = document.getElementById('s3-list');
    if (!el) return;

    let list = s3.invoices;
    if (filter === 'paid') list = list.filter(i => i.payment_status === 'paid');
    if (filter === 'unpaid') list = list.filter(i => i.payment_status === 'unpaid');

    if (list.length === 0) {
      el.innerHTML = '<div class="card-flat" style="text-align:center;color:var(--tm)">ไม่มี Invoice</div>';
      return;
    }

    el.innerHTML = list.map(inv => {
      const isPaid = inv.payment_status === 'paid';
      const isSynced = inv.fin_synced;
      const statusTag = isPaid
        ? '<span class="tag green">✅ Paid</span>'
        : `<span class="tag red">🔴 Unpaid</span>`;
      const dueText = !isPaid && inv.due_date ? `Due: ${App.formatDateShort(inv.due_date)}` : '';
      const canEdit = !isSynced;
      const click = canEdit ? `onclick="Screens2.s3GoEdit('${inv.id}')"` : '';
      const cursor = canEdit ? 'cursor:pointer' : '';

      return `
        <div class="card-flat" style="display:flex;align-items:center;gap:10px;${cursor}" ${click}>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px">${App.esc(inv.invoice_no)} · ${App.esc(inv.vendor_name)}</div>
            <div style="font-size:11px;color:var(--td)">${App.esc(inv.main_category)} > ${App.esc(inv.sub_category)}${inv.issue_date ? ` · ${App.formatDateShort(inv.issue_date)}` : ''}</div>
            <div style="font-size:10px;margin-top:2px">${statusTag} ${dueText ? `<span style="color:var(--tm);margin-left:4px">${dueText}</span>` : ''} ${isSynced ? '<span style="font-size:10px">🔒</span>' : ''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:14px">${App.formatMoney(inv.total_amount)}</div>
            ${!isPaid && !isSynced ? `<button class="btn btn-sm btn-gold" style="margin-top:4px;font-size:10px;padding:3px 8px" onclick="event.stopPropagation();Screens2.s3MarkPaid('${inv.id}')">จ่ายแล้ว</button>` : ''}
          </div>
          ${canEdit ? '<span style="font-size:12px;color:var(--tm)">✏️</span>' : ''}
        </div>`;
    }).join('');
  }

  function renderS3Summary(summary) {
    const el = document.getElementById('s3-summary');
    if (!el || !summary) return;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div class="kpi-box">
          <div class="kpi-label">🔴 Unpaid</div>
          <div class="kpi-value red">${App.formatMoney(summary.unpaid_total)}</div>
          <div class="kpi-sub">${summary.unpaid_count} รายการ</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">✅ Paid</div>
          <div class="kpi-value green">${App.formatMoney(summary.paid_total)}</div>
          <div class="kpi-sub">${summary.count - summary.unpaid_count} รายการ</div>
        </div>
      </div>`;
  }

  // Payment status toggle
  function s3SetStatus(status) {
    s3.paymentStatus = status;
    const paidBtn = document.getElementById('s3-status-paid');
    const unpaidBtn = document.getElementById('s3-status-unpaid');
    if (paidBtn) paidBtn.className = `btn btn-sm ${status === 'paid' ? 'btn-gold' : 'btn-outline'}`;
    if (unpaidBtn) unpaidBtn.className = `btn btn-sm ${status === 'unpaid' ? 'btn-gold' : 'btn-outline'}`;

    const paidFields = document.getElementById('s3-paid-fields');
    const unpaidFields = document.getElementById('s3-unpaid-fields');
    if (paidFields) paidFields.style.display = status === 'paid' ? 'block' : 'none';
    if (unpaidFields) unpaidFields.style.display = status === 'unpaid' ? 'block' : 'none';
  }

  let _s3PayMethod = '';
  function s3SetPayMethod(method) {
    _s3PayMethod = method;
    ['cash', 'card', 'transfer'].forEach(m => {
      const btn = document.getElementById(`s3-pay-${m}`);
      if (btn) btn.className = `btn btn-sm ${m === method ? 'btn-gold' : 'btn-outline'}`;
    });
  }

  function s3CalcTotal() {
    const amt = parseFloat(document.getElementById('s3-amount')?.value) || 0;
    const gst = parseFloat(document.getElementById('s3-gst')?.value) || 0;
    const el = document.getElementById('s3-total');
    if (el) el.value = App.formatMoney(amt + gst);
  }

  function s3PickPhoto() { document.getElementById('s3-file-input')?.click(); }

  async function s3HandlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      App.showLoader();
      const result = await API.uploadPhoto(file, 'invoice');
      s3.photoUrl = result.url;
      const box = document.getElementById('s3-photo-box');
      if (box) { box.classList.add('has-photo'); box.innerHTML = `<img src="${result.url}"><div class="photo-check">✓</div>`; }
      App.toast('อัพโหลดสำเร็จ ✓', 'success');
    } catch (err) { App.toast('อัพโหลดไม่สำเร็จ', 'error'); }
    finally { App.hideLoader(); event.target.value = ''; }
  }

  async function s3Save() {
    const issue_date = document.getElementById('s3-issue-date')?.value || null;
    const invoice_no = document.getElementById('s3-invoice-no')?.value?.trim();
    const vendor_name = document.getElementById('s3-vendor')?.value;
    const main_category = document.getElementById('s3-main')?.value;
    const sub_category = document.getElementById('s3-sub')?.value;
    const description = document.getElementById('s3-desc')?.value?.trim();
    const amount_ex_gst = parseFloat(document.getElementById('s3-amount')?.value) || 0;
    const gst = parseFloat(document.getElementById('s3-gst')?.value) || 0;
    const due_date = document.getElementById('s3-due-date')?.value || null;
    const payment_date = document.getElementById('s3-payment-date')?.value || null;

    if (!issue_date) return App.toast('กรุณาเลือก Issue Date', 'error');
    if (!invoice_no) return App.toast('กรุณาใส่ Invoice No', 'error');
    if (!vendor_name) return App.toast('กรุณาเลือก Vendor', 'error');
    if (!main_category) return App.toast('กรุณาเลือก Main Category', 'error');
    if (!sub_category) return App.toast('กรุณาเลือก Sub Category', 'error');
    if (!description) return App.toast('กรุณาใส่ Description', 'error');
    if (amount_ex_gst <= 0) return App.toast('Amount ต้อง > 0', 'error');
    if (!s3.photoUrl) return App.toast('กรุณาถ่ายรูป Invoice', 'error');

    if (s3.paymentStatus === 'unpaid' && !due_date) return App.toast('กรุณาใส่ Due Date', 'error');
    if (s3.paymentStatus === 'paid' && !_s3PayMethod) return App.toast('กรุณาเลือก Payment Method', 'error');

    try {
      App.showLoader();
      const btn = document.getElementById('s3-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

      const result = await API.saveInvoice({
        issue_date, invoice_no, vendor_name, main_category, sub_category,
        description, amount_ex_gst, gst,
        payment_status: s3.paymentStatus,
        payment_method: s3.paymentStatus === 'paid' ? _s3PayMethod : null,
        payment_date,
        due_date,
        photo_url: s3.photoUrl,
        invoice_id: s3.editId,
      });

      App.toast('บันทึกสำเร็จ ✓', 'success');
      s3ClearForm();

      // Go back to invoice list
      setTimeout(() => App.go('invoice'), 500);

    } catch (err) {
      App.toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      const btn = document.getElementById('s3-save-btn');
      if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก'; }
    }
  }

  // Mark invoice as paid (quick action from list)
  async function s3MarkPaid(invoiceId) {
    try {
      App.showLoader();
      await API.updateInvoicePayment(invoiceId, 'card', App.todayStr());
      App.toast('เปลี่ยนเป็น Paid สำเร็จ ✓', 'success');

      const data = await API.getInvoices({});
      s3.invoices = data.invoices || [];
      renderS3List(_s3CurrentTab);
      renderS3Summary(data.summary);
    } catch (err) {
      App.toast('อัพเดตไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
    }
  }

  function s3ClearForm() {
    ['s3-issue-date', 's3-invoice-no', 's3-desc', 's3-amount', 's3-gst', 's3-due-date', 's3-payment-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const v = document.getElementById('s3-vendor'); if (v) v.value = '';
    const m = document.getElementById('s3-main'); if (m) m.value = '';
    const sw = document.getElementById('s3-sub-wrap');
    if (sw) sw.innerHTML = renderSubCategoryDropdown('s3-sub', '', '');

    s3.photoUrl = null; s3.editId = null;
    s3.paymentStatus = 'unpaid'; _s3PayMethod = '';
    s3CalcTotal();
    s3SetStatus('unpaid');
    // Reset issue date to today
    const issueDateEl = document.getElementById('s3-issue-date');
    if (issueDateEl) issueDateEl.value = App.todayStr();

    const box = document.getElementById('s3-photo-box');
    if (box) { box.classList.remove('has-photo'); box.innerHTML = '<div class="photo-icon">📸</div><div class="photo-label">ถ่าย Invoice</div><div class="photo-required">* บังคับ</div>'; }
  }


  // ════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════

  return {
    // Shared
    onMainCategoryChange, onVendorChange,
    showNewVendorModal, doCreateVendor,
    showVendorList, filterVendorList, pickVendor,

    // S2 Expense
    renderExpense, loadExpense,
    s2SetPayment, s2CalcTotal, s2PickPhoto, s2HandlePhoto,
    s2Save, s2ClearForm, s2ChangeDate, s2GoToday,

    // S3 Invoice
    renderInvoice, loadInvoice,
    renderInvoiceForm, loadInvoiceForm,
    s3FilterTab, s3ReloadList, s3EditInvoice,
    s3GoAdd, s3GoEdit,
    s3SetStatus, s3SetPayMethod, s3CalcTotal,
    s3PickPhoto, s3HandlePhoto, s3Save, s3ClearForm,
    s3MarkPaid,
  };
})();
