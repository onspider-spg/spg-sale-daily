/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens4_sd.js — Sprint 4: S7 Settings & Admin
 * v1.0
 * Tabs: Channels | Suppliers | Settings | Permissions | Audit
 * ═══════════════════════════════════════════
 */

const Screens4 = (() => {

  let _currentTab = 'channels';

  // ════════════════════════════════════════
  // S7: MAIN LAYOUT
  // ════════════════════════════════════════

  function renderSettings() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div>
            <div class="header-title">⚙️ ตั้งค่า & จัดการ</div>
            <div class="header-sub">S7 Admin · T1-T2 Only</div>
          </div>
        </div>

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Admin Tabs -->
          <div class="nav-tabs" style="flex-wrap:wrap">
            <button class="nav-tab active" id="s7-tab-channels" onclick="Screens4.setTab('channels')">📡 Channels</button>
            <button class="nav-tab" id="s7-tab-suppliers" onclick="Screens4.setTab('suppliers')">🏪 Vendor</button>
            <button class="nav-tab" id="s7-tab-settings" onclick="Screens4.setTab('settings')">⚙️ Settings</button>
            <button class="nav-tab" id="s7-tab-permissions" onclick="Screens4.setTab('permissions')">🔐 Permissions</button>
            <button class="nav-tab" id="s7-tab-audit" onclick="Screens4.setTab('audit')">📋 Audit</button>
          </div>

          <!-- Tab Content -->
          <div id="s7-content">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadSettings() {
    _currentTab = 'channels';
    await loadTabContent('channels');
  }

  function setTab(tab) {
    _currentTab = tab;
    ['channels', 'suppliers', 'settings', 'permissions', 'audit'].forEach(t => {
      const btn = document.getElementById(`s7-tab-${t}`);
      if (btn) btn.className = `nav-tab ${t === tab ? 'active' : ''}`;
    });
    loadTabContent(tab);
  }

  async function loadTabContent(tab) {
    const el = document.getElementById('s7-content');
    if (!el) return;

    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>';

    try {
      App.showLoader();
      switch (tab) {
        case 'channels':    await renderChannelsTab(el); break;
        case 'suppliers':   await renderSuppliersTab(el); break;
        case 'settings':    await renderSettingsTab(el); break;
        case 'permissions': await renderPermissionsTab(el); break;
        case 'audit':       await renderAuditTab(el); break;
      }
    } catch (err) {
      el.innerHTML = `<div class="alert-row danger"><span class="alert-icon">❌</span><span class="alert-text">โหลดไม่สำเร็จ: ${App.esc(err.message)}</span></div>`;
    } finally {
      App.hideLoader();
    }
  }


  // ════════════════════════════════════════
  // TAB 1: CHANNEL CONFIG
  // ════════════════════════════════════════

  let _channels = [];

  async function renderChannelsTab(el) {
    const data = await API.adminGetChannels();
    _channels = data.channels || [];

    const groupIcons = { card_sale: '💳', cash_sale: '💵', delivery_sale: '🛵', other: '📦' };

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-label" style="margin:0">📡 Channel Config — ${App.esc(data.store_id)}</div>
        <button class="btn btn-gold" style="font-size:12px;padding:6px 14px" onclick="Screens4.showAddChannel('${App.esc(data.store_id)}')">+ เพิ่ม Channel</button>
      </div>
      <div style="font-size:11px;color:var(--td);margin-bottom:12px">
        แต่ละ channel map → Finance Sub Category + Dashboard Group
      </div>
      ${_channels.map((ch, i) => `
        <div class="card-flat" style="display:flex;align-items:center;gap:10px" id="ch-row-${ch.id}">
          <div style="font-size:18px">${groupIcons[ch.dashboard_group] || '📦'}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${App.esc(ch.channel_label)}</div>
            <div style="font-size:10px;color:var(--td)">
              <code>${App.esc(ch.channel_key)}</code> → ${App.esc(ch.finance_sub_category)} · ${App.esc(ch.dashboard_group)}
            </div>
          </div>
          <div style="font-size:11px;color:var(--tm)">#${ch.sort_order}</div>
          <button class="btn btn-sm ${ch.is_enabled ? 'btn-gold' : 'btn-outline'}"
                  onclick="Screens4.toggleChannel('${ch.id}', ${!ch.is_enabled})"
                  style="min-width:48px">
            ${ch.is_enabled ? '✅' : '—'}
          </button>
          <button class="btn btn-sm btn-outline" onclick="Screens4.editChannel('${ch.id}')" style="padding:4px 8px">✏️</button>
        </div>
      `).join('')}
      <div style="margin-top:12px;font-size:11px;color:var(--tm)">
        ${_channels.length} channels · ${_channels.filter(c => c.is_enabled).length} enabled
      </div>`;
  }

  async function toggleChannel(channelId, newState) {
    try {
      await API.adminUpdateChannel({ channel_id: channelId, is_enabled: newState });
      App.toast(`${newState ? 'เปิด' : 'ปิด'} channel สำเร็จ`, 'success');
      await loadTabContent('channels');
    } catch (err) { App.toast(err.message, 'error'); }
  }

  function editChannel(channelId) {
    const ch = _channels.find(c => c.id === channelId);
    if (!ch) return;

    const overlay = document.createElement('div');
    overlay.id = 'edit-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius);padding:24px;width:90%;max-width:400px;">
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">✏️ แก้ Channel: ${App.esc(ch.channel_key)}</div>
        <div class="form-group">
          <label class="form-label">Label</label>
          <input type="text" class="form-input" id="edit-ch-label" value="${App.esc(ch.channel_label)}">
        </div>
        <div class="form-group">
          <label class="form-label">Finance Sub Category</label>
          <input type="text" class="form-input" id="edit-ch-finsub" value="${App.esc(ch.finance_sub_category)}">
        </div>
        <div class="form-group">
          <label class="form-label">Dashboard Group</label>
          <select class="form-select" id="edit-ch-group">
            <option value="card_sale" ${ch.dashboard_group === 'card_sale' ? 'selected' : ''}>💳 card_sale</option>
            <option value="cash_sale" ${ch.dashboard_group === 'cash_sale' ? 'selected' : ''}>💵 cash_sale</option>
            <option value="delivery_sale" ${ch.dashboard_group === 'delivery_sale' ? 'selected' : ''}>🛵 delivery_sale</option>
            <option value="other" ${ch.dashboard_group === 'other' ? 'selected' : ''}>📦 other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Sort Order</label>
          <input type="number" class="form-input" id="edit-ch-sort" value="${ch.sort_order}">
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-gold" style="flex:1" onclick="Screens4.saveChannelEdit('${ch.id}')">💾 บันทึก</button>
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('edit-modal')?.remove()">ยกเลิก</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  async function saveChannelEdit(channelId) {
    try {
      App.showLoader();
      await API.adminUpdateChannel({
        channel_id: channelId,
        channel_label: document.getElementById('edit-ch-label')?.value,
        finance_sub_category: document.getElementById('edit-ch-finsub')?.value,
        dashboard_group: document.getElementById('edit-ch-group')?.value,
        sort_order: parseInt(document.getElementById('edit-ch-sort')?.value) || 0,
      });
      document.getElementById('edit-modal')?.remove();
      App.toast('บันทึกสำเร็จ ✓', 'success');
      await loadTabContent('channels');
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }

  // ── Phase 3: Add Channel ──
  function showAddChannel(store_id) {
    const overlay = document.createElement('div');
    overlay.id = 'edit-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius);padding:24px;width:90%;max-width:400px;">
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">➕ เพิ่ม Channel ใหม่</div>
        <div class="form-group">
          <label class="form-label">Channel Key <span style="color:var(--tm);font-size:10px">(ภาษาอังกฤษ ห้ามเว้นวรรค)</span></label>
          <input type="text" class="form-input" id="add-ch-key" placeholder="เช่น uber_eats">
        </div>
        <div class="form-group">
          <label class="form-label">Label (ชื่อแสดง)</label>
          <input type="text" class="form-input" id="add-ch-label" placeholder="เช่น Uber Eats">
        </div>
        <div class="form-group">
          <label class="form-label">Dashboard Group</label>
          <select class="form-select" id="add-ch-group">
            <option value="card_sale">💳 card_sale</option>
            <option value="cash_sale">💵 cash_sale</option>
            <option value="delivery_sale" selected>🛵 delivery_sale</option>
            <option value="other">📦 other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Finance Sub Category</label>
          <input type="text" class="form-input" id="add-ch-finsub" placeholder="เช่น Uber Eats">
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-gold" style="flex:1" onclick="Screens4.saveNewChannel('${App.esc(store_id)}')">➕ สร้าง</button>
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('edit-modal')?.remove()">ยกเลิก</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  async function saveNewChannel(store_id) {
    const key = (document.getElementById('add-ch-key')?.value || '').trim();
    const label = (document.getElementById('add-ch-label')?.value || '').trim();
    if (!key || !label) { App.toast('กรุณากรอก Key และ Label', 'error'); return; }
    try {
      App.showLoader();
      await API.adminCreateChannel({
        store_id: store_id,
        channel_key: key,
        channel_label: label,
        dashboard_group: document.getElementById('add-ch-group')?.value || 'other',
        finance_sub_category: document.getElementById('add-ch-finsub')?.value || label,
      });
      document.getElementById('edit-modal')?.remove();
      App.toast('สร้าง Channel สำเร็จ ✓', 'success');
      await loadTabContent('channels');
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }


  // ════════════════════════════════════════
  // TAB 2: VENDOR VISIBILITY
  // ════════════════════════════════════════

  let _vendors = [];
  let _vendorMatrix = null;

  async function renderSuppliersTab(el) {
    const session = API.getSession();
    const isAdmin = session?.tier_level <= 2;

    if (isAdmin) {
      await renderVendorMatrixView(el);
    } else {
      await renderVendorStoreView(el);
    }
  }

  // ── Staff View: Toggle list for own store ──
  async function renderVendorStoreView(el) {
    try {
      const data = await API.getVendors();
      const allVendors = data.vendors || [];

      el.innerHTML = `
        <div class="section-label">🏪 Vendor ของร้าน — ${allVendors.length} รายการ</div>
        <div class="form-group" style="margin-bottom:12px">
          <input type="text" class="form-input" id="s7-vendor-search" placeholder="🔍 ค้นหา vendor..."
                 oninput="Screens4.filterVendors()">
        </div>
        <div id="s7-vendor-list">
          ${allVendors.length === 0 ? '<div style="text-align:center;padding:12px;color:var(--tm)">ไม่มี vendor</div>' :
            allVendors.map(v => `
              <div class="card-flat vendor-row" style="display:flex;align-items:center;gap:10px" data-name="${(v.vendor_name || '').toLowerCase()}">
                <div style="flex:1">
                  <div style="font-weight:600;font-size:13px">${App.esc(v.vendor_name)}</div>
                  <div style="font-size:10px;color:var(--td)">${App.esc(v.vendor_group || '—')}</div>
                </div>
                <div style="font-size:11px;color:var(--green)">✅ แสดง</div>
              </div>
            `).join('')}
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--tm);text-align:center">
          ต้องการซ่อน vendor? ติดต่อ Admin (T1-T2)
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<div style="color:var(--red);padding:16px">${err.message}</div>`;
    }
  }

  // ── Admin View: Vendor × Store matrix (BATCH SAVE) ──
  let _matrixChanges = {}; // track local changes: { 'vendorId:storeId': newVisible }

  async function renderVendorMatrixView(el) {
    try {
      const data = await API.adminGetVendorMatrix();
      _vendorMatrix = data;
      _matrixChanges = {}; // reset pending changes
      const { stores: matStores, vendors: matVendors } = data;

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="section-label" style="margin:0">🏪 Vendor Visibility — ${matVendors.length} vendors × ${matStores.length} stores</div>
          <button class="btn btn-gold" id="vm-save-btn" style="font-size:12px;padding:6px 14px;display:none"
                  onclick="Screens4.saveVendorMatrix()">💾 บันทึก (<span id="vm-change-count">0</span>)</button>
        </div>

        <div class="form-group" style="margin-bottom:12px">
          <input type="text" class="form-input" id="s7-vendor-search" placeholder="🔍 ค้นหา vendor..."
                 oninput="Screens4.filterVendors()">
        </div>

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px" id="s7-vendor-matrix">
            <thead>
              <tr style="background:var(--s1)">
                <th style="text-align:left;padding:8px;position:sticky;left:0;background:var(--s1);min-width:140px">Vendor</th>
                <th style="text-align:center;padding:8px;min-width:50px;color:var(--gold);font-weight:700">ALL</th>
                ${matStores.map(s => `<th style="text-align:center;padding:8px;min-width:50px">${App.esc(s.store_id)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${matVendors.map((v, vi) => `
                <tr class="vendor-row" data-name="${(v.vendor_name || '').toLowerCase()}" data-vi="${vi}" style="border-bottom:1px solid var(--b1)">
                  <td style="padding:8px;font-weight:500;position:sticky;left:0;background:var(--bg)">${App.esc(v.vendor_name)}</td>
                  <td style="text-align:center;padding:6px">
                    <button class="btn btn-sm btn-outline" style="min-width:36px;padding:4px 8px;font-size:10px"
                            onclick="Screens4.toggleAllStores(${vi})">ALL</button>
                  </td>
                  ${matStores.map((s, si) => {
                    const vis = v.stores[s.store_id] !== false;
                    return `<td style="text-align:center;padding:6px">
                      <button class="btn btn-sm ${vis ? 'btn-gold' : 'btn-outline'}" style="min-width:36px;padding:4px 8px"
                              id="vm-${vi}-${si}"
                              onclick="Screens4.toggleVisibility(${vi}, ${si})">${vis ? '✅' : '—'}</button>
                    </td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      el.innerHTML = `<div style="color:var(--red);padding:16px">${err.message}</div>`;
    }
  }

  function filterVendors() {
    const q = (document.getElementById('s7-vendor-search')?.value || '').toLowerCase();
    document.querySelectorAll('.vendor-row').forEach(row => {
      const name = row.getAttribute('data-name') || '';
      row.style.display = name.includes(q) ? '' : 'none';
    });
  }

  // Local toggle — no API call
  function toggleVisibility(vi, si) {
    if (!_vendorMatrix) return;
    const v = _vendorMatrix.vendors[vi];
    const s = _vendorMatrix.stores[si];
    if (!v || !s) return;

    const current = v.stores[s.store_id] !== false;
    const newVal = !current;
    v.stores[s.store_id] = newVal;

    // Track change
    const key = v.vendor_id + ':' + s.store_id;
    _matrixChanges[key] = { vendor_id: v.vendor_id, store_id: s.store_id, is_visible: newVal };

    // Update button UI
    const btn = document.getElementById('vm-' + vi + '-' + si);
    if (btn) {
      btn.className = 'btn btn-sm ' + (newVal ? 'btn-gold' : 'btn-outline');
      btn.textContent = newVal ? '✅' : '—';
      btn.style.outline = '2px solid var(--gold)'; // highlight changed
    }

    updateSaveButton();
  }

  // Toggle ALL stores for one vendor
  function toggleAllStores(vi) {
    if (!_vendorMatrix) return;
    const v = _vendorMatrix.vendors[vi];
    if (!v) return;

    // If all are visible → set all hidden; otherwise → set all visible
    const allVisible = _vendorMatrix.stores.every(s => v.stores[s.store_id] !== false);
    const newVal = !allVisible;

    _vendorMatrix.stores.forEach((s, si) => {
      v.stores[s.store_id] = newVal;
      const key = v.vendor_id + ':' + s.store_id;
      _matrixChanges[key] = { vendor_id: v.vendor_id, store_id: s.store_id, is_visible: newVal };

      const btn = document.getElementById('vm-' + vi + '-' + si);
      if (btn) {
        btn.className = 'btn btn-sm ' + (newVal ? 'btn-gold' : 'btn-outline');
        btn.textContent = newVal ? '✅' : '—';
        btn.style.outline = '2px solid var(--gold)';
      }
    });

    updateSaveButton();
  }

  function updateSaveButton() {
    const count = Object.keys(_matrixChanges).length;
    const btn = document.getElementById('vm-save-btn');
    const countEl = document.getElementById('vm-change-count');
    if (btn) btn.style.display = count > 0 ? '' : 'none';
    if (countEl) countEl.textContent = count;
  }

  // Batch save all pending changes — group by store
  async function saveVendorMatrix() {
    const changes = Object.values(_matrixChanges);
    if (changes.length === 0) return;

    try {
      App.showLoader();

      // Group changes by store_id
      const byStore = {};
      changes.forEach(c => {
        if (!byStore[c.store_id]) byStore[c.store_id] = [];
        byStore[c.store_id].push({ vendor_id: c.vendor_id, is_visible: c.is_visible });
      });

      // Send one batch per store
      const storeIds = Object.keys(byStore);
      for (let i = 0; i < storeIds.length; i++) {
        await API.batchVendorVisibility(storeIds[i], byStore[storeIds[i]]);
      }

      _matrixChanges = {};
      App.toast('บันทึก ' + changes.length + ' รายการ สำเร็จ ✓', 'success');
      await loadTabContent('suppliers');
    } catch (err) {
      App.toast(err.message, 'error');
    } finally {
      App.hideLoader();
    }
  }

  async function toggleVendor(vendorId, newActive) {
    try {
      await API.adminUpdateSupplier({ vendor_id: vendorId, is_active: newActive });
      App.toast(`${newActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} สำเร็จ`, 'success');
      await loadTabContent('suppliers');
    } catch (err) { App.toast(err.message, 'error'); }
  }


  // ════════════════════════════════════════
  // TAB 3: STORE SETTINGS
  // ════════════════════════════════════════

  let _settings = {};

  async function renderSettingsTab(el) {
    const data = await API.adminGetSettings();
    _settings = data;

    el.innerHTML = `
      <div class="section-label">⚙️ Store Settings — ${App.esc(API.getSelectedStore())}</div>

      <div class="card">
        <div class="form-group">
          <label class="form-label">⏰ Cutoff Time</label>
          <input type="time" class="form-input" id="s7-cutoff" value="${_settings.cutoff_time || '23:59'}">
        </div>

        <div class="form-group">
          <label class="form-label">📅 Backdate Limit (days)</label>
          <input type="number" class="form-input" id="s7-backdate" value="${_settings.backdate_limit_days ?? 2}" min="0" max="30">
          <div class="form-hint">T3-T5 แก้ย้อนหลังได้กี่วัน (T1-T2 override ได้เสมอ)</div>
        </div>

        <div class="form-group">
          <label class="form-label">📸 Require Photos</label>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm ${_settings.require_photos !== false ? 'btn-gold' : 'btn-outline'}" id="s7-photo-on"
                    onclick="Screens4.setSettingToggle('photo', true)" style="flex:1">✅ ON</button>
            <button class="btn btn-sm ${_settings.require_photos === false ? 'btn-gold' : 'btn-outline'}" id="s7-photo-off"
                    onclick="Screens4.setSettingToggle('photo', false)" style="flex:1">— OFF</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">💵 Cash Mismatch Tolerance ($)</label>
          <input type="number" step="0.01" class="form-input" id="s7-tolerance" value="${_settings.cash_mismatch_tolerance ?? 2.00}">
        </div>

        <div class="form-group">
          <label class="form-label">🔗 Auto Finance Push</label>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm ${_settings.auto_finance_push !== false ? 'btn-gold' : 'btn-outline'}" id="s7-autopush-on"
                    onclick="Screens4.setSettingToggle('autopush', true)" style="flex:1">✅ ON</button>
            <button class="btn btn-sm ${_settings.auto_finance_push === false ? 'btn-gold' : 'btn-outline'}" id="s7-autopush-off"
                    onclick="Screens4.setSettingToggle('autopush', false)" style="flex:1">— OFF</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">🏦 Default Bank Account</label>
          <input type="text" class="form-input" id="s7-bank" value="${App.esc(_settings.default_bank_account || '')}">
          <div class="form-hint">e.g. 4410 #PettyCash&Card</div>
        </div>
      </div>

      <button class="btn btn-gold btn-full" style="margin-top:12px" onclick="Screens4.saveSettings()">
        💾 บันทึก Settings
      </button>`;
  }

  let _settingToggles = {};
  function setSettingToggle(key, val) {
    _settingToggles[key] = val;
    if (key === 'photo') {
      document.getElementById('s7-photo-on').className = `btn btn-sm ${val ? 'btn-gold' : 'btn-outline'}`;
      document.getElementById('s7-photo-off').className = `btn btn-sm ${!val ? 'btn-gold' : 'btn-outline'}`;
    }
    if (key === 'autopush') {
      document.getElementById('s7-autopush-on').className = `btn btn-sm ${val ? 'btn-gold' : 'btn-outline'}`;
      document.getElementById('s7-autopush-off').className = `btn btn-sm ${!val ? 'btn-gold' : 'btn-outline'}`;
    }
  }

  async function saveSettings() {
    try {
      App.showLoader();
      await API.adminUpdateSettings({
        cutoff_time: document.getElementById('s7-cutoff')?.value,
        backdate_limit_days: document.getElementById('s7-backdate')?.value,
        require_photos: _settingToggles.photo !== undefined ? _settingToggles.photo : (_settings.require_photos !== false),
        cash_mismatch_tolerance: document.getElementById('s7-tolerance')?.value,
        auto_finance_push: _settingToggles.autopush !== undefined ? _settingToggles.autopush : (_settings.auto_finance_push !== false),
        default_bank_account: document.getElementById('s7-bank')?.value,
      });
      App.toast('บันทึก Settings สำเร็จ ✓', 'success');
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }


  // ════════════════════════════════════════
  // TAB 4: PERMISSIONS MATRIX (BATCH SAVE)
  // ════════════════════════════════════════

  let _permData = null;
  let _permChanges = {}; // 'functionKey:tierId' → newVal

  async function renderPermissionsTab(el) {
    const data = await API.adminGetPermissions();
    _permData = data;
    _permChanges = {};
    const tiers = data.tiers || ['T1','T2','T3','T4','T5','T6','T7'];
    const groups = data.groups || {};

    const groupLabels = {
      sales: '💰 SALES', expenses: '🧾 EXPENSES', invoices: '📄 INVOICES',
      cash: '💵 CASH', reports: '📊 REPORTS', admin: '⚙️ ADMIN',
    };

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="section-label" style="margin:0">🔐 Permission Matrix — ${data.total_functions} functions</div>
        <button class="btn btn-gold" id="perm-save-btn" style="font-size:12px;padding:6px 14px;display:none"
                onclick="Screens4.savePermissions()">💾 บันทึก (<span id="perm-change-count">0</span>)</button>
      </div>
      <div style="font-size:11px;color:var(--td);margin-bottom:8px">กดเพื่อ toggle → กด 💾 บันทึก ครั้งเดียว</div>
      <div style="overflow-x:auto">
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead>
            <tr style="background:var(--s2)">
              <th style="text-align:left;padding:8px;min-width:140px">Function</th>
              ${tiers.map(t => `<th style="padding:8px;width:36px;text-align:center">${t}</th>`).join('')}
            </tr>
          </thead>
          <tbody>`;

    for (const [groupKey, fns] of Object.entries(groups)) {
      html += `<tr>
        <td colspan="${tiers.length + 1}" style="padding:8px 8px 4px;font-weight:700;color:var(--gold-dim);font-size:12px;border-top:1px solid var(--s2)">
          <span>${groupLabels[groupKey] || groupKey}</span>
          <button style="margin-left:8px;font-size:9px;padding:2px 8px;border:1px solid var(--b1);border-radius:4px;background:var(--s1);cursor:pointer;font-family:inherit"
                  onclick="Screens4.toggleGroupAll('${groupKey}')">✅ all</button>
          <button style="font-size:9px;padding:2px 8px;border:1px solid var(--b1);border-radius:4px;background:var(--s1);cursor:pointer;font-family:inherit"
                  onclick="Screens4.toggleGroupNone('${groupKey}')">— none</button>
        </td>
      </tr>`;

      fns.forEach((fn) => {
        html += `<tr data-group="${groupKey}">
          <td style="padding:4px 8px;font-size:11px">${App.esc(fn.function_name)}</td>
          ${tiers.map(t => {
            const allowed = fn.tiers[t] === true;
            return `<td style="text-align:center;padding:4px;cursor:pointer"
                        id="pm-${fn.function_key}-${t}"
                        onclick="Screens4.togglePermission('${fn.function_key}', '${t}')">
              <span style="font-size:12px">${allowed ? '✅' : '—'}</span>
            </td>`;
          }).join('')}
        </tr>`;
      });
    }

    html += `</tbody></table></div>`;
    el.innerHTML = html;
  }

  // Local toggle — no API call
  function togglePermission(functionKey, tierId) {
    if (!_permData) return;
    // Find and flip the value in local data
    for (const fns of Object.values(_permData.groups)) {
      const fn = fns.find(f => f.function_key === functionKey);
      if (fn) {
        const current = fn.tiers[tierId] === true;
        const newVal = !current;
        fn.tiers[tierId] = newVal;

        // Track change
        const key = functionKey + ':' + tierId;
        _permChanges[key] = { function_key: functionKey, tier_id: tierId, is_allowed: newVal };

        // Update UI
        const cell = document.getElementById('pm-' + functionKey + '-' + tierId);
        if (cell) {
          cell.querySelector('span').textContent = newVal ? '✅' : '—';
          cell.style.outline = '2px solid var(--gold)';
        }
        break;
      }
    }
    updatePermSaveButton();
  }

  // Toggle all permissions in a group → ON
  function toggleGroupAll(groupKey) {
    if (!_permData || !_permData.groups[groupKey]) return;
    const tiers = _permData.tiers || ['T1','T2','T3','T4','T5','T6','T7'];
    _permData.groups[groupKey].forEach(fn => {
      tiers.forEach(t => {
        if (fn.tiers[t] !== true) {
          fn.tiers[t] = true;
          const key = fn.function_key + ':' + t;
          _permChanges[key] = { function_key: fn.function_key, tier_id: t, is_allowed: true };
          const cell = document.getElementById('pm-' + fn.function_key + '-' + t);
          if (cell) {
            cell.querySelector('span').textContent = '✅';
            cell.style.outline = '2px solid var(--gold)';
          }
        }
      });
    });
    updatePermSaveButton();
  }

  // Toggle all permissions in a group → OFF
  function toggleGroupNone(groupKey) {
    if (!_permData || !_permData.groups[groupKey]) return;
    const tiers = _permData.tiers || ['T1','T2','T3','T4','T5','T6','T7'];
    _permData.groups[groupKey].forEach(fn => {
      tiers.forEach(t => {
        if (fn.tiers[t] !== false) {
          fn.tiers[t] = false;
          const key = fn.function_key + ':' + t;
          _permChanges[key] = { function_key: fn.function_key, tier_id: t, is_allowed: false };
          const cell = document.getElementById('pm-' + fn.function_key + '-' + t);
          if (cell) {
            cell.querySelector('span').textContent = '—';
            cell.style.outline = '2px solid var(--gold)';
          }
        }
      });
    });
    updatePermSaveButton();
  }

  function updatePermSaveButton() {
    const count = Object.keys(_permChanges).length;
    const btn = document.getElementById('perm-save-btn');
    const countEl = document.getElementById('perm-change-count');
    if (btn) btn.style.display = count > 0 ? '' : 'none';
    if (countEl) countEl.textContent = count;
  }

  async function savePermissions() {
    const changes = Object.values(_permChanges);
    if (changes.length === 0) return;
    try {
      App.showLoader();
      await API.adminBatchUpdatePermissions(changes);
      _permChanges = {};
      App.toast('บันทึก ' + changes.length + ' permissions สำเร็จ ✓', 'success');
      await loadTabContent('permissions');
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }


  // ════════════════════════════════════════
  // TAB 5: AUDIT LOG
  // ════════════════════════════════════════

  async function renderAuditTab(el) {
    const data = await API.adminGetAuditLog({});
    const logs = data.logs || [];

    const actionColors = {
      update_channel: 'blue', update_permission: 'purple',
      update_vendor: 'gold', update_store_settings: 'green',
    };

    el.innerHTML = `
      <div class="section-label">📋 Audit Log — ล่าสุด ${logs.length} records</div>
      ${logs.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--tm)">ยังไม่มีประวัติ</div>' :
        logs.map(log => {
          const color = actionColors[log.action] || 'gray';
          const time = new Date(log.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          return `
            <div class="card-flat" style="padding:8px 12px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="tag ${color}" style="font-size:9px">${App.esc(log.action)}</span>
                <span style="font-size:10px;color:var(--tm)">${time}</span>
              </div>
              <div style="font-size:12px;margin-top:4px">
                <strong>${App.esc(log.target_type)}</strong>: ${App.esc(log.target_id)}
              </div>
              <div style="font-size:10px;color:var(--td);margin-top:2px">
                by ${App.esc(log.changed_by_name || '—')} ${log.store_id ? `· ${log.store_id}` : ''}
              </div>
            </div>`;
        }).join('')
      }`;
  }


  // ════════════════════════════════════════
  // VENDOR STORE (standalone screen from ☰ menu)
  // Phase 2: T3-T4 toggle, T5+ read-only
  // ════════════════════════════════════════

  let _vendorStoreList = [];
  let _vendorStoreCanToggle = false;

  function renderVendorStore() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    const storeName = session.store_name || session.store_id;

    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div>
            <div class="header-title">🏪 Vendor ร้านฉัน</div>
            <div class="header-sub">${App.esc(storeName)} — Vendor Visibility</div>
          </div>
        </div>
        <div class="screen-body">
          ${API.isHQ() ? App.renderStoreSelector() : ''}
          <div class="form-group" style="margin:0 0 12px">
            <input type="text" class="form-input" id="vs-search" placeholder="🔍 ค้นหา vendor..."
                   oninput="Screens4.filterVendorStore()">
          </div>
          <div id="vs-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadVendorStore() {
    const el = document.getElementById('vs-list');
    if (!el) return;
    try {
      App.showLoader();
      const data = await API.getStoreVendorVisibility();
      _vendorStoreList = data.vendors || [];
      _vendorStoreCanToggle = data.can_toggle || false;
      renderVendorStoreList(el);
    } catch (err) {
      el.innerHTML = `<div style="color:var(--red);padding:16px">${App.esc(err.message)}</div>`;
    } finally {
      App.hideLoader();
    }
  }

  function renderVendorStoreList(el) {
    const vendors = _vendorStoreList;
    const canToggle = _vendorStoreCanToggle;

    if (vendors.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tm)">ไม่มี vendor ในระบบ</div>';
      return;
    }

    const visible = vendors.filter(v => v.is_visible).length;
    const hidden = vendors.length - visible;

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tm);margin-bottom:8px">
        <span>ทั้งหมด ${vendors.length} vendors</span>
        <span>✅ แสดง ${visible} · 🚫 ซ่อน ${hidden}</span>
      </div>
      ${vendors.map((v, i) => `
        <div class="card-flat vs-row" style="display:flex;align-items:center;gap:10px" data-name="${(v.vendor_name || '').toLowerCase()}" data-idx="${i}">
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${App.esc(v.vendor_name)}</div>
            <div style="font-size:10px;color:var(--td)">${App.esc(v.vendor_group || '—')} · ${App.esc(v.vendor_type || '')}</div>
          </div>
          ${canToggle ? `
            <button style="padding:6px 12px;border-radius:8px;border:1px solid ${v.is_visible ? 'var(--green)' : 'var(--b1)'};background:${v.is_visible ? 'var(--green-bg)' : 'var(--s1)'};color:${v.is_visible ? 'var(--green)' : 'var(--tm)'};font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s"
                    onclick="Screens4.toggleVendorStore(${i})">
              ${v.is_visible ? '✅ แสดง' : '🚫 ซ่อน'}
            </button>
          ` : `
            <div style="font-size:11px;color:${v.is_visible ? 'var(--green)' : 'var(--tm)'}">
              ${v.is_visible ? '✅ แสดง' : '🚫 ซ่อน'}
            </div>
          `}
        </div>
      `).join('')}
    `;
  }

  async function toggleVendorStore(idx) {
    const v = _vendorStoreList[idx];
    if (!v) return;

    const newVisible = !v.is_visible;
    try {
      await API.toggleVendorVisibility(v.vendor_id, null, newVisible);
      v.is_visible = newVisible;
      const el = document.getElementById('vs-list');
      if (el) renderVendorStoreList(el);
      App.toast(newVisible ? '✅ เปิด "' + v.vendor_name + '"' : '🚫 ซ่อน "' + v.vendor_name + '"', 'success');
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  function filterVendorStore() {
    const q = (document.getElementById('vs-search')?.value || '').toLowerCase();
    document.querySelectorAll('.vs-row').forEach(row => {
      const name = row.getAttribute('data-name') || '';
      row.style.display = name.includes(q) ? '' : 'none';
    });
  }

  // ════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════

  return {
    renderSettings, loadSettings, setTab,
    // Channels
    toggleChannel, editChannel, saveChannelEdit,
    showAddChannel, saveNewChannel,
    // Suppliers / Vendor Visibility (batch)
    filterVendors, toggleVendor, toggleVisibility, toggleAllStores, saveVendorMatrix,
    // Vendor Store (☰ menu — T3-T4)
    renderVendorStore, loadVendorStore, filterVendorStore, toggleVendorStore,
    // Settings
    setSettingToggle, saveSettings,
    // Permissions (batch)
    togglePermission, toggleGroupAll, toggleGroupNone, savePermissions,
  };
})();
