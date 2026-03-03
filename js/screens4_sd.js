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
      <div class="section-label">📡 Channel Config — ${App.esc(data.store_id)}</div>
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

  // ── Admin View: Vendor × Store matrix ──
  async function renderVendorMatrixView(el) {
    try {
      const data = await API.adminGetVendorMatrix();
      _vendorMatrix = data;
      const { stores: matStores, vendors: matVendors } = data;

      el.innerHTML = `
        <div class="section-label">🏪 Vendor Visibility — ${matVendors.length} vendors × ${matStores.length} stores</div>

        <div class="form-group" style="margin-bottom:12px">
          <input type="text" class="form-input" id="s7-vendor-search" placeholder="🔍 ค้นหา vendor..."
                 oninput="Screens4.filterVendors()">
        </div>

        <!-- Header row -->
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px" id="s7-vendor-matrix">
            <thead>
              <tr style="background:var(--surface)">
                <th style="text-align:left;padding:8px;position:sticky;left:0;background:var(--surface);min-width:140px">Vendor</th>
                ${matStores.map(s => `<th style="text-align:center;padding:8px;min-width:50px">${App.esc(s.store_id)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${matVendors.map(v => `
                <tr class="vendor-row" data-name="${(v.vendor_name || '').toLowerCase()}" style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px;font-weight:500;position:sticky;left:0;background:var(--bg)">${App.esc(v.vendor_name)}</td>
                  ${matStores.map(s => {
                    const vis = v.stores[s.store_id] !== false;
                    return `<td style="text-align:center;padding:6px">
                      <button class="btn btn-sm ${vis ? 'btn-gold' : 'btn-outline'}" style="min-width:36px;padding:4px 8px"
                              onclick="Screens4.toggleVisibility('${v.vendor_id}', '${s.store_id}', ${!vis})">${vis ? '✅' : '—'}</button>
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

  async function toggleVisibility(vendorId, storeId, newVisible) {
    try {
      await API.toggleVendorVisibility(vendorId, storeId, newVisible);
      App.toast(`${newVisible ? 'เปิด' : 'ปิด'}การมองเห็น สำเร็จ`, 'success');
      await loadTabContent('suppliers');
    } catch (err) { App.toast(err.message, 'error'); }
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
  // TAB 4: PERMISSIONS MATRIX
  // ════════════════════════════════════════

  let _permData = null;

  async function renderPermissionsTab(el) {
    const data = await API.adminGetPermissions();
    _permData = data;
    const tiers = data.tiers || ['T1','T2','T3','T4','T5','T6','T7'];
    const groups = data.groups || {};

    const groupLabels = {
      sales: '💰 SALES', expenses: '🧾 EXPENSES', invoices: '📄 INVOICES',
      cash: '💵 CASH', reports: '📊 REPORTS', admin: '⚙️ ADMIN',
    };

    let html = `
      <div class="section-label">🔐 Function × Tier Matrix — ${data.total_functions} functions</div>
      <div style="font-size:11px;color:var(--td);margin-bottom:8px">กด ✅/— เพื่อ toggle permission</div>
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
      html += `<tr><td colspan="${tiers.length + 1}" style="padding:8px 8px 4px;font-weight:700;color:var(--gold-dim);font-size:12px;border-top:1px solid var(--s2)">${groupLabels[groupKey] || groupKey}</td></tr>`;

      (fns as any[]).forEach((fn: any) => {
        html += `<tr>
          <td style="padding:4px 8px;font-size:11px">${App.esc(fn.function_name)}</td>
          ${tiers.map(t => {
            const allowed = fn.tiers[t] === true;
            return `<td style="text-align:center;padding:4px;cursor:pointer"
                        onclick="Screens4.togglePermission('${fn.function_key}', '${t}', ${!allowed})">
              <span style="font-size:12px">${allowed ? '✅' : '—'}</span>
            </td>`;
          }).join('')}
        </tr>`;
      });
    }

    html += `</tbody></table></div>`;
    el.innerHTML = html;
  }

  async function togglePermission(functionKey, tierId, newVal) {
    try {
      await API.adminUpdatePermission({ function_key: functionKey, tier_id: tierId, is_allowed: newVal });
      App.toast(`${functionKey} × ${tierId} → ${newVal ? '✅' : '—'}`, 'success');
      await loadTabContent('permissions');
    } catch (err) { App.toast(err.message, 'error'); }
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
  // EXPORTS
  // ════════════════════════════════════════

  return {
    renderSettings, loadSettings, setTab,
    // Channels
    toggleChannel, editChannel, saveChannelEdit,
    // Suppliers / Vendor Visibility
    filterVendors, toggleVendor, toggleVisibility,
    // Settings
    setSettingToggle, saveSettings,
    // Permissions
    togglePermission,
  };
})();
