// Version 2.6.3 | 8 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens2_sd.js — S2 Expense (popup) + S3 Invoice + Credit Note
 * v2.1 — Phase 13: QA fixes
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
    const perms = API.getSession()?.permissions || {};
    const canAdd = true; // backend handles permission check
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
          <button class="btn btn-sm btn-outline" onclick="App.go('settings',{tab:'suppliers'})" title="จัดการ Vendor" style="padding:8px;min-width:36px">⚙</button>
        </div>
        <div style="margin-top:4px">
          ${canAdd ? `<button class="btn btn-sm btn-outline" onclick="Screens2.showNewVendorModal('${id}')">+ เพิ่ม Vendor ใหม่</button>` : ''}
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
      <select class="form-input" id="${id}" onchange="${onchangeFn}">
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
      <select class="form-input" id="${id}">
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
    extraPhotos: [],
    editId: null,
  };

  function renderExpense(params) {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    if (params && params.date) s2.date = params.date;
    const date = s2.date || App.todayStr();
    s2.date = date;

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Expense' })}

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Auto tags -->
          <div style="display:flex;gap:var(--sp-sm);font-size:var(--fs-xs);color:var(--tm);margin-bottom:var(--sp-sm);flex-wrap:wrap">
            <span class="tag gray">Store: ${App.esc(session.store_name)}</span>
            <span class="tag gray">Date: ${App.formatDate(date)}</span>
            <span class="tag blue">Doc Type: Bill (auto)</span>
          </div>

          <!-- Date bar -->
          <div class="date-bar">
            <button class="date-nav" onclick="Screens2.s2ChangeDate(-1)">‹</button>
            <div class="date-display">
              <span id="s2-date-label">${App.formatDate(date)}</span>
            </div>
            <button class="date-nav" onclick="Screens2.s2ChangeDate(1)">›</button>
            <button class="date-today" onclick="Screens2.s2GoToday()">วันนี้</button>
          </div>

          <!-- Header + Add button -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
            <div class="section-label" style="margin:0">Today (<span id="s2-count">0</span>)</div>
            <button class="btn btn-sm btn-gold" onclick="Screens2.showExpensePopup()">+ Add Expense</button>
          </div>

          <!-- Expense List -->
          <div id="s2-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>

          <!-- Summary -->
          <div id="s2-summary"></div>
        </div>
      </div>

      <!-- Hidden file input moved into popup -->`;
  }

  async function loadExpense() {
    try {
      App.showLoader();
      await loadLookups();

      // Load expense list
      const data = await API.getExpenses(s2.date);
      s2.expenses = data.expenses || [];
      renderS2List();
      renderS2Summary(data.summary);

      // Update count
      const countEl = document.getElementById('s2-count');
      if (countEl) countEl.textContent = s2.expenses.length;

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
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tm)">ยังไม่มีรายจ่ายวันนี้</div>';
      return;
    }

    el.innerHTML = s2.expenses.map(e => {
      const borderColor = 'var(--orange)';
      return `
        <div style="padding:12px;background:var(--bg);border:1px solid var(--bd2);border-left:4px solid ${borderColor};border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:var(--sp-xs)">
          <div style="display:flex;justify-content:space-between">
            <div>
              <div style="font-size:var(--fs-body);font-weight:700">${App.esc(e.description || e.doc_number)}</div>
              <div style="font-size:var(--fs-xs);color:var(--tm);margin-top:2px">${App.esc(e.vendor_name || '—')} · ${e.payment_method === 'cash' ? 'Cash' : 'Card'}</div>
            </div>
            <div style="font-size:var(--fs-body);font-weight:800;color:var(--red)">-${App.formatMoney(e.total_amount)}</div>
          </div>
          <div style="display:flex;gap:var(--sp-xs);margin-top:var(--sp-sm)">
            <button class="btn btn-sm btn-outline" onclick="Screens2.s2EditExpense('${e.id}')">✏️</button>
            <button class="btn btn-sm btn-outline" style="color:var(--red);border-color:var(--red)" onclick="Screens2.s2DeleteExpense('${e.id}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
  }

  function renderS2Summary(summary) {
    const el = document.getElementById('s2-summary');
    if (!el || !summary) return;

    el.innerHTML = `
      <div style="padding:12px;background:var(--red-bg);border:1.5px solid var(--red);border-radius:var(--radius-sm);display:flex;justify-content:space-between;font-weight:700;font-size:var(--fs-sm);margin-top:var(--sp-sm)">
        <span>Total Expense</span>
        <span style="color:var(--red)">-${App.formatMoney(summary.total_expenses)}</span>
      </div>`;
  }

  // ─── EXPENSE POPUP (wireframe: s2-popup) ───

  function showExpensePopup(editData) {
    // Remove existing popup if any
    document.getElementById('s2-popup')?.remove();

    const isEdit = !!editData;
    const title = isEdit ? '✏️ Edit Expense' : '+ Add Expense';

    const overlay = document.createElement('div');
    overlay.id = 's2-popup';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius);padding:16px;width:100%;max-width:440px;max-height:85vh;overflow-y:auto;box-shadow:var(--shadow-md)">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--sp-sm)">
          <div style="font-size:var(--fs-h2);font-weight:700">${title}</div>
          <div style="font-size:18px;cursor:pointer;color:var(--tm);padding:4px" onclick="document.getElementById('s2-popup')?.remove()">✕</div>
        </div>

        <div class="form-group">
          <label class="form-label">Doc Number <span class="req">*</span></label>
          <input type="text" class="form-input" id="s2-doc-number" placeholder="เลขจากบิล" value="${App.esc(editData?.doc_number || '')}">
        </div>

        <div class="form-group">
          <label class="form-label">Vendor Name <span class="req">*</span></label>
          <div id="s2-vendor-wrap">${renderVendorDropdown('s2-vendor', editData?.vendor_name || '')}</div>
        </div>

        <div class="form-group">
          <label class="form-label">Description <span class="req">*</span></label>
          <input type="text" class="form-input" id="s2-desc" placeholder="อธิบายสั้นๆ" value="${App.esc(editData?.description || '')}">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">Amount <span class="req">*</span></label>
            <input type="number" step="0.01" class="form-input" id="s2-amount" placeholder="0.00"
                   oninput="Screens2.s2CalcTotal()" value="${editData?.amount_ex_gst || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">GST <span class="req">*</span></label>
            <input type="number" step="0.01" class="form-input" id="s2-gst" placeholder="0.00"
                   oninput="Screens2.s2CalcTotal()" value="${editData?.gst || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Total <span class="auto-tag">AUTO</span></label>
            <input type="text" class="form-input readonly" id="s2-total" value="$0.00" readonly>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Payment Method <span class="req">*</span></label>
          <div style="display:flex;gap:var(--sp-sm)">
            <button class="btn btn-sm btn-outline" id="s2-pay-cash" onclick="Screens2.s2SetPayment('cash')" style="flex:1">💵 Cash</button>
            <button class="btn btn-sm btn-outline" id="s2-pay-card" onclick="Screens2.s2SetPayment('card')" style="flex:1">💳 Card</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">📸 ถ่ายใบเสร็จ <span class="req">*</span></label>
          <input type="file" id="s2-file-input" accept="image/*" capture="environment" style="display:none" onchange="Screens2.s2HandlePhoto(event)">
          <div class="photo-grid" style="display:flex">
            <div class="photo-box empty" id="s2-photo-box" onclick="Screens2.s2PickPhoto()" style="min-height:70px;width:70px">
              <div class="photo-icon">📸</div>
              <div class="photo-label">ถ่ายใบเสร็จ</div>
            </div>
          </div>
          <div id="s2-extra-photos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
          <button type="button" class="btn btn-sm btn-outline" onclick="Screens2.s2PickPhoto('extra')" style="margin-top:4px;font-size:var(--fs-xs)">+ เพิ่มรูป</button>
        </div>

        <div style="display:flex;gap:var(--sp-sm);margin-top:var(--sp-md)">
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('s2-popup')?.remove()">ยกเลิก</button>
          <button class="btn btn-gold" style="flex:1" id="s2-save-btn" onclick="Screens2.s2Save()">💾 บันทึก</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Set edit state
    s2.editId = editData?.id || null;
    s2.photoUrl = editData?.photo_url || null;
    _s2PaymentMethod = editData?.payment_method || '';

    // Populate payment + photo if editing
    if (_s2PaymentMethod) s2SetPayment(_s2PaymentMethod);
    if (s2.photoUrl) {
      const box = document.getElementById('s2-photo-box');
      if (box) {
        box.classList.remove('empty');
        box.classList.add('filled');
        box.innerHTML = `<img src="${s2.photoUrl}" alt="Receipt" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-xs)">`;
      }
    }

    // Calc total if editing
    if (editData) s2CalcTotal();
  }

  function s2EditExpense(id) {
    const e = s2.expenses.find(x => x.id === id);
    if (!e) return;
    showExpensePopup(e);
  }

  async function s2DeleteExpense(id) {
    if (!confirm('ลบรายจ่ายนี้?')) return;
    try {
      App.showLoader();
      await API.deleteExpense(id);
      App.toast('ลบสำเร็จ ✓', 'success');
      const data = await API.getExpenses(s2.date);
      s2.expenses = data.expenses || [];
      renderS2List();
      renderS2Summary(data.summary);
      const countEl = document.getElementById('s2-count');
      if (countEl) countEl.textContent = s2.expenses.length;
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
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

  let _s2PhotoTarget = 'main';
  function s2PickPhoto(target) {
    _s2PhotoTarget = target || 'main';
    document.getElementById('s2-file-input')?.click();
  }

  async function s2HandlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      App.showLoader();
      const result = await API.uploadPhoto(file, 'expense');

      if (_s2PhotoTarget === 'extra') {
        s2.extraPhotos.push(result.url);
        s2RenderExtraPhotos();
      } else {
        s2.photoUrl = result.url;
        const box = document.getElementById('s2-photo-box');
        if (box) {
          box.classList.add('has-photo');
          box.innerHTML = `<img src="${result.url}" alt="Receipt"><div class="photo-check">✓</div>`;
        }
      }
      App.toast('อัพโหลดสำเร็จ ✓', 'success');
    } catch (err) {
      App.toast('อัพโหลดไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      event.target.value = '';
    }
  }

  function s2RenderExtraPhotos() {
    const el = document.getElementById('s2-extra-photos');
    if (!el) return;
    el.innerHTML = s2.extraPhotos.map((url, i) =>
      `<div style="position:relative;width:50px;height:50px;border-radius:6px;overflow:hidden;border:1px solid var(--bd)">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover">
        <div style="position:absolute;top:0;right:0;background:var(--red);color:#fff;width:14px;height:14px;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="Screens2.s2RemoveExtra(${i})">×</div>
      </div>`
    ).join('');
  }

  function s2RemoveExtra(index) {
    s2.extraPhotos.splice(index, 1);
    s2RenderExtraPhotos();
  }

  async function s2Save() {
    const doc_number = document.getElementById('s2-doc-number')?.value?.trim();
    const vendor_name = document.getElementById('s2-vendor')?.value;
    const description = document.getElementById('s2-desc')?.value?.trim();
    const amount_ex_gst = parseFloat(document.getElementById('s2-amount')?.value) || 0;
    const gst = parseFloat(document.getElementById('s2-gst')?.value) || 0;

    // Quick validation
    if (!doc_number) return App.toast('กรุณาใส่ Doc Number (❶)', 'error');
    if (!vendor_name) return App.toast('กรุณาเลือก Vendor (❷)', 'error');
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
        doc_number, vendor_name,
        description, amount_ex_gst, gst,
        payment_method: _s2PaymentMethod,
        photo_url: s2.photoUrl,
        extra_photos: s2.extraPhotos.length > 0 ? s2.extraPhotos : null,
        expense_id: s2.editId,
      });

      App.toast('บันทึกสำเร็จ ✓', 'success');

      // Close popup + reload list
      document.getElementById('s2-popup')?.remove();
      s2ClearForm();
      const data = await API.getExpenses(s2.date);
      s2.expenses = data.expenses || [];
      renderS2List();
      renderS2Summary(data.summary);
      const countEl = document.getElementById('s2-count');
      if (countEl) countEl.textContent = s2.expenses.length;

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
    extraPhotos: [],
    editId: null,
    paymentStatus: 'unpaid',
  };

  function renderInvoice(params) {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Invoice' })}

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Date Range -->
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;font-size:12px">
            <span style="color:var(--td)">📅</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s3-date-from" onchange="Screens2.s3ReloadList()">
            <span style="color:var(--tm)">→</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s3-date-to" onchange="Screens2.s3ReloadList()">
          </div>

          <!-- Filter Chips -->
          <div class="chip-group">
            <button class="filter-chip active" id="s3-tab-all" onclick="Screens2.s3FilterTab('all')">All</button>
            <button class="filter-chip" id="s3-tab-cn" onclick="Screens2.s3FilterTab('cn')">Has Credit Note</button>
            <button class="filter-chip" id="s3-tab-unpaid" onclick="Screens2.s3FilterTab('unpaid')">Unpaid</button>
            <button class="filter-chip" id="s3-tab-paid" onclick="Screens2.s3FilterTab('paid')">Paid</button>
          </div>

          <!-- Add button -->
          <div style="margin-bottom:var(--sp-sm)">
            <button class="btn btn-gold" style="width:100%;padding:10px" onclick="Screens2.s3GoAdd()">+ New Invoice →</button>
          </div>

          <!-- Summary -->
          <div id="s3-summary"></div>

          <!-- Invoice List -->
          <div id="s3-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  function renderInvoiceForm(params) {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    if (params && params.edit_id) s3.editId = params.edit_id;
    const isEdit = !!s3.editId;
    _s3CRAnswered = false;

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'invoice', label: isEdit ? 'Edit Invoice' : 'New Invoice' })}
        <div class="screen-body">
          <div class="card" id="s3-form">
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
              <span class="tag gray">Store: ${App.esc(session.store_name)}</span>
              <span class="tag blue">Doc Type: Invoice</span>
            </div>
            <div class="form-group">
              <label class="form-label">📅 Issue Date <span class="req">*</span></label>
              <input type="date" class="form-input" id="s3-issue-date" value="${isEdit ? '' : App.todayStr()}">
            </div>
            <div class="form-group">
              <label class="form-label">Invoice No <span class="req">*</span></label>
              <input type="text" class="form-input" id="s3-invoice-no" placeholder="INV-xxxx">
            </div>
            <div class="form-group">
              <label class="form-label">Vendor Name <span class="req">*</span></label>
              <div id="s3-vendor-wrap">${renderVendorDropdown('s3-vendor', '')}</div>
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

            <!-- Credit Note Toggle (Phase 9) -->
            <div style="padding:12px;background:var(--green-bg);border:1.5px solid var(--green);border-radius:var(--radius-sm);margin-bottom:var(--sp-sm)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
                <div style="font-size:var(--fs-body);font-weight:700;color:var(--green)">📝 Credit Note</div>
                <div class="chip-group" style="margin:0">
                  <button class="filter-chip" id="s3-cr-no" onclick="Screens2.s3ToggleCR(false)" style="font-size:var(--fs-xs)">No</button>
                  <button class="filter-chip" id="s3-cr-yes" onclick="Screens2.s3ToggleCR(true)" style="font-size:var(--fs-xs)">Yes</button>
                </div>
              </div>
              <div id="s3-cr-fields" style="display:none">
                <div style="font-size:var(--fs-xs);color:var(--tm);margin-bottom:var(--sp-sm)">CN No. auto = INV-xxxx_CR</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                  <div class="form-group">
                    <label class="form-label">Credit Note No</label>
                    <input type="text" class="form-input readonly" id="s3-cr-no-val" readonly style="background:var(--s1)">
                  </div>
                  <div class="form-group">
                    <label class="form-label">CR Reason <span class="req">*</span></label>
                    <select class="form-input" id="s3-cr-reason">
                      <option value="">-- เลือก --</option>
                      <option value="return">สินค้าคืน (Return)</option>
                      <option value="damaged">ชำรุด (Damaged)</option>
                      <option value="discount">ส่วนลด (Discount)</option>
                      <option value="overcharge">คิดเกิน (Overcharge)</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">CR Description <span class="req">*</span></label>
                  <input type="text" class="form-input" id="s3-cr-desc" placeholder="e.g. เนื้อ 2kg ชำรุด">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                  <div class="form-group">
                    <label class="form-label">CR Amount <span class="req">*</span></label>
                    <input type="number" step="0.01" class="form-input" id="s3-cr-amount" placeholder="0.00" style="color:var(--green);font-weight:700" oninput="Screens2.s3CalcTotal()">
                  </div>
                  <div class="form-group">
                    <label class="form-label">CR GST</label>
                    <input type="number" step="0.01" class="form-input" id="s3-cr-gst" placeholder="0.00" oninput="Screens2.s3CalcTotal()">
                  </div>
                  <div class="form-group">
                    <label class="form-label">CR Total <span class="auto-tag">AUTO</span></label>
                    <input type="text" class="form-input readonly" id="s3-cr-total" value="$0.00" readonly style="color:var(--green);font-weight:700;background:var(--s1)">
                  </div>
                </div>
                <div style="padding:var(--sp-sm);background:var(--bg);border-radius:var(--radius-xs);font-size:var(--fs-sm)">
                  <b>Net Payable:</b> <span id="s3-net-label">$0.00</span>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <!-- Auto Unpaid (no toggle — edit-until-paid deferred to Finance) -->
            <div style="padding:var(--sp-sm);background:var(--red-bg);border-radius:var(--radius-sm);margin-bottom:var(--sp-sm);display:flex;justify-content:space-between">
              <span style="font-size:var(--fs-sm);font-weight:700;color:var(--red)">💳 Payment Status</span>
              <span class="status-badge sts-pending">Unpaid (auto)</span>
            </div>
            <div>
              <div class="form-group">
                <label class="form-label">Due Date <span class="req">*</span></label>
                <input type="date" class="form-input" id="s3-due-date">
              </div>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label class="form-label">📸 ถ่ายหน้า Invoice <span class="req">*</span></label>
              <input type="file" id="s3-file-input" accept="image/*" capture="environment" style="display:none" onchange="Screens2.s3HandlePhoto(event)">
              <label for="s3-file-input" style="cursor:pointer">
                <div class="photo-grid" style="grid-template-columns:1fr">
                  <div class="photo-box" id="s3-photo-box" style="min-height:80px">
                    <div class="photo-icon">📸</div>
                    <div class="photo-label">ถ่าย Invoice</div>
                    <div class="photo-required">* บังคับ</div>
                  </div>
                </div>
              </label>
              <div id="s3-extra-photos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
              <button type="button" class="btn btn-sm btn-outline" onclick="Screens2.s3PickExtraPhoto()" style="margin-top:4px;font-size:var(--fs-xs)">+ เพิ่มรูป</button>
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
    ['all', 'cn', 'unpaid', 'paid'].forEach(t => {
      const btn = document.getElementById(`s3-tab-${t}`);
      if (btn) btn.className = `filter-chip ${t === tab ? 'active' : ''}`;
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

    // Trigger sub category reload

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

    // Credit Note (Phase 9)
    _s3HasCR = inv.has_credit_note || false;
    s3ToggleCR(_s3HasCR);
    if (_s3HasCR) {
      setVal('s3-cr-no-val', inv.cr_no || (inv.invoice_no + '_CR'));
      const crReasonEl = document.getElementById('s3-cr-reason');
      if (crReasonEl) crReasonEl.value = inv.cr_reason || '';
      setVal('s3-cr-desc', inv.cr_description || '');
      setVal('s3-cr-amount', inv.cr_amount_ex_gst || '');
      setVal('s3-cr-gst', inv.cr_gst || '');
      s3CalcTotal();
    }

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
    if (filter === 'cn') list = list.filter(i => i.has_credit_note);

    if (list.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tm)">ไม่มี Invoice</div>';
      return;
    }

    el.innerHTML = list.map(inv => {
      const isPaid = inv.payment_status === 'paid';
      const isSynced = inv.fin_synced;
      const isLocked = isPaid || isSynced;
      const hasCR = inv.has_credit_note;
      const borderColor = isPaid ? 'var(--green)' : hasCR ? 'var(--orange)' : 'var(--red)';
      const rowOpacity = isLocked ? 'opacity:.6' : '';

      const statusHtml = isPaid
        ? '<span class="status-badge sts-synced">Paid ✅</span>'
        : '<span class="status-badge sts-pending">Unpaid</span>';

      const dueText = !isPaid && inv.due_date ? `Due: ${App.formatDateShort(inv.due_date)}` : '';

      // CN badge + amount display
      const cnBadge = hasCR ? ' <span style="padding:1px 5px;background:var(--green-bg);color:var(--green);border-radius:4px;font-size:9px;font-weight:600">CN</span>' : '';
      const displayAmount = hasCR
        ? `<div style="font-size:var(--fs-xs);color:var(--tm);text-decoration:line-through">${App.formatMoney(inv.total_amount)}</div>
           <div style="font-size:var(--fs-body);font-weight:800;color:var(--orange)">${App.formatMoney(inv.net_payable || inv.total_amount)}</div>`
        : `<div style="font-size:var(--fs-body);font-weight:800;color:${isPaid ? 'var(--green)' : 'var(--red)'}">${App.formatMoney(inv.total_amount)}</div>`;

      const crDetail = hasCR ? `<div style="font-size:var(--fs-xs);color:var(--green);margin-top:2px">CR: ${App.esc(inv.cr_no || '')} -${App.formatMoney(inv.cr_total || 0)} (${App.esc(inv.cr_reason || '')})</div>` : '';

      const editHtml = isLocked
        ? `<div style="font-size:var(--fs-xs);color:var(--tm);margin-top:var(--sp-xs)">🔒 ${isPaid ? 'Paid' : 'Synced'} — locked</div>`
        : `<div style="display:flex;gap:var(--sp-xs);margin-top:var(--sp-sm)"><button class="btn btn-sm btn-outline" style="padding:3px 10px;font-size:var(--fs-xs)" onclick="Screens2.s3GoEdit('${inv.id}')">✏️ Edit</button></div>`;

      return `
        <div style="padding:12px;background:var(--bg);border:1px solid var(--bd2);border-left:4px solid ${borderColor};border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:var(--sp-xs);${rowOpacity}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:var(--fs-body);font-weight:700">${App.esc(inv.invoice_no)} — ${App.esc(inv.vendor_name)}${cnBadge}</div>
              <div style="font-size:var(--fs-xs);color:var(--tm);margin-top:2px">${App.formatDateShort(inv.issue_date || '')} · ${dueText ? ` · ${dueText}` : ''}</div>
              ${crDetail}
            </div>
            <div style="text-align:right">
              ${displayAmount}
              ${statusHtml}
            </div>
          </div>
          ${editHtml}
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

  let _s3HasCR = false;
  let _s3CRAnswered = false;

  function s3ToggleCR(hasCR) {
    _s3HasCR = hasCR;
    _s3CRAnswered = true;
    const fields = document.getElementById('s3-cr-fields');
    const yesBtn = document.getElementById('s3-cr-yes');
    const noBtn = document.getElementById('s3-cr-no');
    if (fields) fields.style.display = hasCR ? 'block' : 'none';
    if (yesBtn) yesBtn.className = `filter-chip ${hasCR ? 'active' : ''}`;
    if (noBtn) noBtn.className = `filter-chip ${!hasCR ? 'active' : ''}`;

    // Auto-generate CR No from Invoice No
    if (hasCR) {
      const invNo = document.getElementById('s3-invoice-no')?.value || 'INV-xxxx';
      const crNoEl = document.getElementById('s3-cr-no-val');
      if (crNoEl) crNoEl.value = invNo + '_CR';
    }

    s3CalcTotal();
  }

  function s3CalcTotal() {
    const amt = parseFloat(document.getElementById('s3-amount')?.value) || 0;
    const gst = parseFloat(document.getElementById('s3-gst')?.value) || 0;
    const total = amt + gst;
    const totalEl = document.getElementById('s3-total');
    if (totalEl) totalEl.value = App.formatMoney(total);

    // CR calculation
    if (_s3HasCR) {
      const crAmt = parseFloat(document.getElementById('s3-cr-amount')?.value) || 0;
      const crGst = parseFloat(document.getElementById('s3-cr-gst')?.value) || 0;
      const crTotal = crAmt + crGst;
      const crTotalEl = document.getElementById('s3-cr-total');
      if (crTotalEl) crTotalEl.value = App.formatMoney(crTotal);

      const net = total - crTotal;
      const netEl = document.getElementById('s3-net-label');
      if (netEl) netEl.innerHTML = `Total ${App.formatMoney(total)} − CR ${App.formatMoney(crTotal)} = <b style="color:var(--gold)">${App.formatMoney(net)}</b>`;
    }
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

  function s3PickExtraPhoto() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment'; inp.style.display = 'none';
    inp.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        App.showLoader();
        const result = await API.uploadPhoto(file, 'invoice');
        s3.extraPhotos.push(result.url);
        s3RenderExtraPhotos();
        App.toast('อัพโหลดสำเร็จ ✓', 'success');
      } catch (err) { App.toast('อัพโหลดไม่สำเร็จ', 'error'); }
      finally { App.hideLoader(); inp.remove(); }
    };
    document.body.appendChild(inp);
    inp.click();
  }

  function s3RenderExtraPhotos() {
    const el = document.getElementById('s3-extra-photos');
    if (!el) return;
    el.innerHTML = s3.extraPhotos.map((url, i) =>
      `<div style="position:relative;width:50px;height:50px;border-radius:6px;overflow:hidden;border:1px solid var(--bd)">
        <img src="${url}" style="width:100%;height:100%;object-fit:cover">
        <div style="position:absolute;top:0;right:0;background:var(--red);color:#fff;width:14px;height:14px;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="Screens2.s3RemoveExtra(${i})">×</div>
      </div>`
    ).join('');
  }

  function s3RemoveExtra(index) {
    s3.extraPhotos.splice(index, 1);
    s3RenderExtraPhotos();
  }

  async function s3Save() {
    const issue_date = document.getElementById('s3-issue-date')?.value || null;
    const invoice_no = document.getElementById('s3-invoice-no')?.value?.trim();
    const vendor_name = document.getElementById('s3-vendor')?.value;
    const description = document.getElementById('s3-desc')?.value?.trim();
    const amount_ex_gst = parseFloat(document.getElementById('s3-amount')?.value) || 0;
    const gst = parseFloat(document.getElementById('s3-gst')?.value) || 0;
    const due_date = document.getElementById('s3-due-date')?.value || null;
    const payment_date = document.getElementById('s3-payment-date')?.value || null;

    if (!issue_date) return App.toast('กรุณาเลือก Issue Date', 'error');
    if (!invoice_no) return App.toast('กรุณาใส่ Invoice No', 'error');
    if (!vendor_name) return App.toast('กรุณาเลือก Vendor', 'error');
    if (!description) return App.toast('กรุณาใส่ Description', 'error');
    if (amount_ex_gst <= 0) return App.toast('Amount ต้อง > 0', 'error');
    if (!s3.photoUrl) return App.toast('กรุณาถ่ายรูป Invoice', 'error');

    if (!due_date) return App.toast('กรุณาใส่ Due Date', 'error');

    // Credit Note — must answer Yes or No
    if (!_s3CRAnswered) return App.toast('กรุณาเลือก Credit Note (Yes / No)', 'error');

    // Credit Note validation
    if (_s3HasCR) {
      const crReason = document.getElementById('s3-cr-reason')?.value;
      const crDesc = document.getElementById('s3-cr-desc')?.value?.trim();
      const crAmt = parseFloat(document.getElementById('s3-cr-amount')?.value) || 0;
      if (!crReason) return App.toast('กรุณาเลือก CR Reason', 'error');
      if (!crDesc) return App.toast('กรุณาใส่ CR Description', 'error');
      if (crAmt <= 0) return App.toast('CR Amount ต้อง > 0', 'error');
    }

    try {
      App.showLoader();
      const btn = document.getElementById('s3-save-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

      const result = await API.saveInvoice({
        issue_date, invoice_no, vendor_name,
        description, amount_ex_gst, gst,
        payment_status: 'unpaid',
        payment_method: null,
        payment_date: null,
        due_date,
        photo_url: s3.photoUrl,
        extra_photos: s3.extraPhotos.length > 0 ? s3.extraPhotos : null,
        invoice_id: s3.editId,
        // Credit Note (Phase 9)
        has_credit_note: _s3HasCR,
        cr_no: _s3HasCR ? (document.getElementById('s3-cr-no-val')?.value || '') : null,
        cr_reason: _s3HasCR ? (document.getElementById('s3-cr-reason')?.value || '') : null,
        cr_description: _s3HasCR ? (document.getElementById('s3-cr-desc')?.value || '') : null,
        cr_amount_ex_gst: _s3HasCR ? (parseFloat(document.getElementById('s3-cr-amount')?.value) || 0) : 0,
        cr_gst: _s3HasCR ? (parseFloat(document.getElementById('s3-cr-gst')?.value) || 0) : 0,
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

    s3.photoUrl = null; s3.editId = null;
    s3.paymentStatus = 'unpaid'; _s3PayMethod = '';
    _s3HasCR = false;
    s3CalcTotal();
    s3SetStatus('unpaid');
    s3ToggleCR(false);
    _s3CRAnswered = false; // reset after toggle (toggle sets it true)
    // Clear CR fields
    ['s3-cr-no-val', 's3-cr-desc', 's3-cr-amount', 's3-cr-gst'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const crReasonEl = document.getElementById('s3-cr-reason');
    if (crReasonEl) crReasonEl.value = '';
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
    showExpensePopup, s2EditExpense, s2DeleteExpense,
    s2SetPayment, s2CalcTotal, s2PickPhoto, s2HandlePhoto, s2RemoveExtra,
    s2Save, s2ClearForm, s2ChangeDate, s2GoToday,

    // S3 Invoice
    renderInvoice, loadInvoice,
    renderInvoiceForm, loadInvoiceForm,
    s3FilterTab, s3ReloadList, s3EditInvoice,
    s3GoAdd, s3GoEdit,
    s3SetStatus, s3SetPayMethod, s3CalcTotal, s3ToggleCR,
    s3PickPhoto, s3HandlePhoto, s3PickExtraPhoto, s3RemoveExtra, s3Save, s3ClearForm,
    s3MarkPaid,
  };
})();
