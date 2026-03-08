// Version 2.5 | 8 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens4_sd.js — Settings & Admin
 * v2.2 — Phase 11: Categories tab + Notification Settings
 * Tabs: Channels | Vendors | Categories | Config | Permissions | Audit
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
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Settings' })}

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Tab chips -->
          <div class="chip-group" style="margin-bottom:var(--sp-md)">
            <button class="filter-chip active" id="s7-tab-channels" onclick="Screens4.setTab('channels')">Channels</button>
            <button class="filter-chip" id="s7-tab-suppliers" onclick="Screens4.setTab('suppliers')">Vendors</button>
            <button class="filter-chip" id="s7-tab-categories" onclick="Screens4.setTab('categories')">Categories</button>
            <button class="filter-chip" id="s7-tab-settings" onclick="Screens4.setTab('settings')">Config</button>
            <button class="filter-chip" id="s7-tab-alerts" onclick="Screens4.setTab('alerts')">Alert Rules</button>
            <button class="filter-chip" id="s7-tab-permissions" onclick="Screens4.setTab('permissions')">Permissions</button>
            <button class="filter-chip" id="s7-tab-audit" onclick="Screens4.setTab('audit')">Audit Log</button>
          </div>

          <!-- Tab Content -->
          <div id="s7-content">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadSettings(params) {
    const tab = (params && params.tab) || 'channels';
    _currentTab = tab;
    // Update chip active state
    ['channels', 'suppliers', 'categories', 'settings', 'alerts', 'permissions', 'audit'].forEach(t => {
      const btn = document.getElementById(`s7-tab-${t}`);
      if (btn) btn.className = `filter-chip ${t === tab ? 'active' : ''}`;
    });
    await loadTabContent(tab);
  }

  function setTab(tab) {
    _currentTab = tab;
    ['channels', 'suppliers', 'categories', 'settings', 'alerts', 'permissions', 'audit'].forEach(t => {
      const btn = document.getElementById(`s7-tab-${t}`);
      if (btn) btn.className = `filter-chip ${t === tab ? 'active' : ''}`;
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
        case 'categories':  await renderCategoriesTab(el); break;
        case 'settings':    await renderSettingsTab(el); break;
        case 'alerts':      await renderAlertRulesTab(el); break;
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
  // TAB: CATEGORIES VISIBILITY (Phase 10)
  // ════════════════════════════════════════

  let _catTree = null;
  let _catChanges = [];

  async function renderCategoriesTab(el) {
    try {
      const data = await API.getCategoryVisibility();
      _catTree = data.tree || {};
      _catChanges = [];

      const storeId = API.isHQ() ? API.getSelectedStore() : (API.getSession()?.store_id || '');

      let html = `
        <div style="padding:var(--sp-sm);background:var(--blue-bg);border-radius:var(--radius-sm);font-size:var(--fs-sm);color:var(--blue);margin-bottom:var(--sp-sm)">
          💡 ปิด/เปิด Main+Sub category ที่ร้านจะเห็น · ลดรายการที่ยาวเกินจาก DB
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
          <div style="font-size:var(--fs-sm);font-weight:700">Store: ${App.esc(storeId)}</div>
          <button class="btn btn-sm btn-gold" id="cat-save-btn" style="display:none" onclick="Screens4.saveCategoryVisibility()">💾 Save (<span id="cat-change-count">0</span>)</button>
        </div>`;

      // Render tree per transaction_type → main → sub
      for (const [txType, mains] of Object.entries(_catTree)) {
        for (const [mainCat, subs] of Object.entries(mains)) {
          const allVisible = subs.every(s => s.is_visible);
          html += `
            <details style="background:var(--bg);border:1px solid var(--bd2);border-radius:var(--radius-sm);margin-bottom:var(--sp-xs)">
              <summary style="display:flex;justify-content:space-between;align-items:center;padding:var(--sp-sm);cursor:pointer">
                <div style="font-size:var(--fs-body);font-weight:700;color:var(--gold)">▾ ${App.esc(mainCat)}</div>
                <div style="width:36px;height:20px;background:${allVisible ? 'var(--green)' : 'var(--s2)'};border-radius:10px;position:relative;cursor:pointer" onclick="event.stopPropagation();Screens4.toggleMainCategory('${txType}','${mainCat}')">
                  <div style="width:16px;height:16px;background:#fff;border-radius:50%;position:absolute;${allVisible ? 'right:2px' : 'left:2px'};top:2px"></div>
                </div>
              </summary>
              <div style="font-size:var(--fs-sm);display:flex;flex-direction:column;gap:2px;padding:0 var(--sp-sm) var(--sp-sm) 20px">
                ${subs.map(s => {
                  const vis = s.is_visible;
                  return `
                    <div style="display:flex;justify-content:space-between;align-items:center;${!vis ? 'opacity:.5' : ''}">
                      <span>${App.esc(s.sub_category)}</span>
                      <div style="width:30px;height:16px;background:${vis ? 'var(--green)' : 'var(--s2)'};border-radius:8px;position:relative;cursor:pointer" onclick="Screens4.toggleSubCategory('${txType}','${mainCat}','${s.sub_category}')">
                        <div style="width:12px;height:12px;background:#fff;border-radius:50%;position:absolute;${vis ? 'right:2px' : 'left:2px'};top:2px"></div>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </details>`;
        }
      }

      el.innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--tm)">ไม่มี category</div>';
    } catch (err) {
      el.innerHTML = `<div style="color:var(--red);padding:16px">${App.esc(err.message)}</div>`;
    }
  }

  function toggleMainCategory(txType, mainCat) {
    if (!_catTree || !_catTree[txType] || !_catTree[txType][mainCat]) return;
    const subs = _catTree[txType][mainCat];
    const allVis = subs.every(s => s.is_visible);
    const newVal = !allVis;
    subs.forEach(s => {
      s.is_visible = newVal;
      _catChanges.push({ transaction_type: txType, main_category: mainCat, sub_category: s.sub_category, is_visible: newVal });
    });
    updateCatSaveBtn();
    // Re-render categories tab
    const el = document.getElementById('s7-content');
    if (el) renderCategoriesTab(el);
  }

  function toggleSubCategory(txType, mainCat, subCat) {
    if (!_catTree || !_catTree[txType] || !_catTree[txType][mainCat]) return;
    const sub = _catTree[txType][mainCat].find(s => s.sub_category === subCat);
    if (!sub) return;
    sub.is_visible = !sub.is_visible;
    _catChanges.push({ transaction_type: txType, main_category: mainCat, sub_category: subCat, is_visible: sub.is_visible });
    updateCatSaveBtn();
    // Re-render categories tab
    const el = document.getElementById('s7-content');
    if (el) renderCategoriesTab(el);
  }

  function updateCatSaveBtn() {
    const btn = document.getElementById('cat-save-btn');
    const countEl = document.getElementById('cat-change-count');
    if (btn) btn.style.display = _catChanges.length > 0 ? '' : 'none';
    if (countEl) countEl.textContent = _catChanges.length;
  }

  async function saveCategoryVisibility() {
    if (_catChanges.length === 0) return;
    try {
      App.showLoader();
      await API.updateCategoryVisibility(null, _catChanges);
      _catChanges = [];
      App.toast('บันทึก category visibility สำเร็จ ✓', 'success');
      await loadTabContent('categories');
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }


  // ════════════════════════════════════════
  // NOTIFICATION SETTINGS (Phase 10 — standalone screen)
  // ════════════════════════════════════════

  const NOTIF_PREF_ITEMS = [
    { key: 'daily_reminder', label: 'Daily Report Reminder', desc: 'แจ้งเตือนก่อน deadline 30 นาที' },
    { key: 'cash_variance', label: 'Cash Variance Alert', desc: 'แจ้งเมื่อ variance เกิน threshold' },
    { key: 'sales_drop', label: 'Sales Drop Alert', desc: 'แจ้งเมื่อยอดตก > threshold %' },
    { key: 'sync_status', label: 'Sync Status', desc: 'แจ้งเมื่อ ACC sync/lock' },
    { key: 'invoice_due', label: 'Invoice Due Reminder', desc: 'แจ้งก่อน invoice ครบกำหนด 3 วัน' },
    { key: 'daily_summary', label: 'Daily Summary', desc: 'สรุปรายวันส่งให้ admin', isAdmin: true, defaultOff: true },
  ];

  let _notifPrefs = {};

  function renderNotificationSettings() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Notification Settings' })}
        <div class="screen-body">
          <div style="font-size:var(--fs-sm);color:var(--tm);margin-bottom:var(--sp-sm)">กด toggle ON/OFF</div>

          <div style="font-size:var(--fs-body);font-weight:700;color:var(--gold);margin-bottom:var(--sp-xs)">📊 Sale Daily Notifications</div>
          <div id="notif-pref-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadNotificationSettings() {
    const el = document.getElementById('notif-pref-list');
    if (!el) return;
    try {
      App.showLoader();
      const data = await API.getNotificationPrefs();
      _notifPrefs = data.prefs || {};
      renderNotifPrefList(el);
    } catch (err) {
      el.innerHTML = `<div style="color:var(--red);padding:16px">${App.esc(err.message)}</div>`;
    } finally { App.hideLoader(); }
  }

  function renderNotifPrefList(el) {
    const session = API.getSession();
    const isAdmin = session && (session.tier_level <= 2 || session.store_id === 'HQ');

    const items = NOTIF_PREF_ITEMS.filter(item => !item.isAdmin || isAdmin);

    let html = '<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:var(--sp-sm)">';
    let lastIsAdmin = false;

    items.forEach(item => {
      if (item.isAdmin && !lastIsAdmin) {
        html += `</div><div style="font-size:var(--fs-body);font-weight:700;color:var(--gold);margin:var(--sp-sm) 0 var(--sp-xs)">👑 Admin</div><div style="display:flex;flex-direction:column;gap:2px">`;
        lastIsAdmin = true;
      }

      const enabled = _notifPrefs[item.key] !== undefined ? _notifPrefs[item.key] : !item.defaultOff;
      html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--sp-sm) 12px;background:var(--bg);border:1px solid var(--bd2);border-radius:var(--radius-sm)">
          <div>
            <div style="font-size:var(--fs-body);font-weight:600">${App.esc(item.label)}</div>
            <div style="font-size:var(--fs-xs);color:var(--tm)">${App.esc(item.desc)}</div>
          </div>
          <div style="width:36px;height:20px;background:${enabled ? 'var(--green)' : 'var(--s2)'};border-radius:10px;position:relative;cursor:pointer" onclick="Screens4.toggleNotifPref('${item.key}')">
            <div style="width:16px;height:16px;background:#fff;border-radius:50%;position:absolute;${enabled ? 'right:2px' : 'left:2px'};top:2px"></div>
          </div>
        </div>`;
    });

    html += '</div>';
    el.innerHTML = html;
  }

  async function toggleNotifPref(key) {
    const current = _notifPrefs[key] !== undefined ? _notifPrefs[key] : true;
    _notifPrefs[key] = !current;

    try {
      await API.updateNotificationPrefs({ [key]: !current });
      const el = document.getElementById('notif-pref-list');
      if (el) renderNotifPrefList(el);
      App.toast(!current ? '🔔 ON' : '🔕 OFF', 'info');
    } catch (err) { App.toast(err.message, 'error'); }
  }


  // ════════════════════════════════════════
  // TAB: ALERT RULES (Phase 11)
  // ════════════════════════════════════════

  let _alertRules = [];

  async function renderAlertRulesTab(el) {
    try {
      const data = await API.getAlertRules();
      _alertRules = data.rules || [];

      const ruleIcons = { cash_variance: '💰', cash_repeat: '💰', sales_drop: '📉', report_overdue: '⏳', sync_pending: '🔄' };

      let html = `
        <div style="padding:var(--sp-sm);background:var(--blue-bg);border-radius:var(--radius-sm);font-size:var(--fs-sm);color:var(--blue);margin-bottom:var(--sp-sm)">
          💡 5 rules auto-detect anomalies · toggle ON/OFF + ปรับ threshold
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-xs)">`;

      _alertRules.forEach((r, i) => {
        const icon = ruleIcons[r.rule_key] || '⚠️';
        const cfg = r.config_json || {};
        const unit = cfg.unit || '';

        html += `
          <div class="card" style="padding:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
              <div>
                <div style="font-size:var(--fs-body);font-weight:700">${icon} ${App.esc(r.rule_name)}</div>
                <div style="font-size:var(--fs-xs);color:var(--tm)">${App.esc(r.description)}</div>
              </div>
              <div style="width:36px;height:20px;background:${r.is_enabled ? 'var(--green)' : 'var(--s2)'};border-radius:10px;position:relative;cursor:pointer" onclick="Screens4.toggleAlertRule(${i})">
                <div style="width:16px;height:16px;background:#fff;border-radius:50%;position:absolute;${r.is_enabled ? 'right:2px' : 'left:2px'};top:2px"></div>
              </div>
            </div>
            <div style="display:flex;gap:var(--sp-sm);align-items:center">
              <label style="font-size:var(--fs-sm);color:var(--td);font-weight:600;min-width:70px">Threshold:</label>
              <input type="number" step="0.01" class="form-input" style="width:100px;padding:var(--sp-xs) var(--sp-sm);font-size:var(--fs-body);font-weight:700"
                     id="alert-threshold-${i}" value="${r.threshold}" onchange="Screens4.setAlertThreshold(${i})">
              <span style="font-size:var(--fs-sm);color:var(--tm)">${App.esc(unit)}</span>
            </div>
          </div>`;
      });

      html += `</div>
        <button class="btn btn-gold" style="width:100%;margin-top:var(--sp-md)" onclick="Screens4.saveAlertRules()">💾 Save All Rules</button>`;

      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = `<div style="color:var(--red);padding:16px">${App.esc(err.message)}</div>`;
    }
  }

  function toggleAlertRule(idx) {
    if (!_alertRules[idx]) return;
    _alertRules[idx].is_enabled = !_alertRules[idx].is_enabled;
    loadTabContent('alerts');
  }

  function setAlertThreshold(idx) {
    if (!_alertRules[idx]) return;
    const val = parseFloat(document.getElementById('alert-threshold-' + idx)?.value) || 0;
    _alertRules[idx].threshold = val;
  }

  async function saveAlertRules() {
    try {
      App.showLoader();
      const updates = _alertRules.map(r => ({
        rule_key: r.rule_key,
        is_enabled: r.is_enabled,
        threshold: r.threshold,
        config_json: r.config_json,
      }));
      await API.updateAlertRules(updates);
      App.toast('บันทึก Alert Rules สำเร็จ ✓', 'success');
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
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
      create_vendor: 'green', update_channel: 'orange',
      update_permission: 'red', batch_update_permissions: 'purple',
      batch_vendor_visibility: 'blue', update_store_settings: 'green',
    };

    el.innerHTML = `
      <div style="font-size:var(--fs-body);color:var(--tm);margin-bottom:var(--sp-sm)">ล่าสุด ${logs.length} records</div>
      ${logs.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--tm)">ยังไม่มีประวัติ</div>' :
        `<div style="display:flex;flex-direction:column;gap:var(--sp-xs)">
        ${logs.map(log => {
          const color = actionColors[log.action] || 'gray';
          const time = new Date(log.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
          return `
            <div style="padding:var(--sp-sm) 12px;background:var(--bg);border:1px solid var(--bd2);border-radius:var(--radius-sm)">
              <div style="display:flex;justify-content:space-between">
                <span class="tag ${color}" style="font-size:9px">${App.esc(log.action)}</span>
                <span style="font-size:var(--fs-xs);color:var(--tm)">${time}</span>
              </div>
              <div style="font-size:var(--fs-body);font-weight:600;margin-top:2px">
                ${App.esc(log.target_type)}: ${App.esc(log.target_id)}
              </div>
              <div style="font-size:var(--fs-xs);color:var(--tm)">
                by ${App.esc(log.changed_by_name || '—')}${log.store_id ? ' · ' + log.store_id : ''}
              </div>
            </div>`;
        }).join('')}
        </div>`
      }`;
  }


  // ════════════════════════════════════════
  // NOTIFICATIONS SCREEN (Phase 5)
  // ════════════════════════════════════════

  let _notiData = null;

  function renderNotifications() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Notifications' })}
        <div class="screen-body">
          <div style="display:flex;justify-content:flex-end;margin-bottom:var(--sp-sm)">
            <button class="btn btn-sm btn-outline" onclick="Screens4.markAllRead()">อ่านทั้งหมด</button>
          </div>
          <div id="noti-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadNotifications() {
    const el = document.getElementById('noti-list');
    if (!el) return;
    try {
      App.showLoader();
      const data = await API.getNotifications(50);
      _notiData = data;
      renderNotiList(el, data);
    } catch (err) {
      el.innerHTML = '<div style="color:var(--red);padding:16px">' + App.esc(err.message) + '</div>';
    } finally { App.hideLoader(); }
  }

  function renderNotiList(el, data) {
    const announcements = data.announcements || [];
    const notifs = data.notifications || [];
    const unreadAnn = announcements.filter(a => !a.is_read);
    const readAnn = announcements.filter(a => a.is_read);

    let html = '';

    // Unread announcements first
    if (unreadAnn.length > 0) {
      html += '<div class="section-label">📢 ประกาศใหม่</div>';
      unreadAnn.forEach(a => {
        html += `
          <div class="card" style="border-left:3px solid ${a.priority === 'urgent' ? 'var(--red)' : 'var(--gold)'};margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div style="font-weight:600;font-size:14px">${a.priority === 'urgent' ? '🚨' : '📢'} ${App.esc(a.title)}</div>
              <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;flex-shrink:0" onclick="Screens4.dismissAnnouncement('${a.id}')">รับทราบ</button>
            </div>
            <div style="font-size:13px;color:var(--t);white-space:pre-wrap;line-height:1.5">${App.esc(a.body)}</div>
            <div style="font-size:10px;color:var(--tm);margin-top:6px">${new Date(a.created_at).toLocaleString('th-TH')}</div>
          </div>`;
      });
    }

    // Notifications
    if (notifs.length > 0) {
      html += '<div class="section-label">🔔 แจ้งเตือน</div>';
      notifs.forEach(n => {
        const typeIcons = { info: 'ℹ️', warning: '⚠️', success: '✅', error: '❌' };
        html += `
          <div class="card-flat" style="display:flex;gap:10px;align-items:flex-start;opacity:${n.is_read ? '0.6' : '1'};margin-bottom:6px">
            <div style="font-size:16px">${typeIcons[n.type] || 'ℹ️'}</div>
            <div style="flex:1">
              <div style="font-weight:${n.is_read ? '400' : '600'};font-size:13px">${App.esc(n.title)}</div>
              ${n.body ? '<div style="font-size:12px;color:var(--td);margin-top:2px">' + App.esc(n.body) + '</div>' : ''}
              <div style="font-size:10px;color:var(--tm);margin-top:4px">${new Date(n.created_at).toLocaleString('th-TH')}</div>
            </div>
            ${!n.is_read ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:6px"></div>' : ''}
          </div>`;
      });
    }

    // Read announcements
    if (readAnn.length > 0) {
      html += '<div class="section-label" style="opacity:0.5">📢 ประกาศที่อ่านแล้ว</div>';
      readAnn.forEach(a => {
        html += `
          <div class="card-flat" style="opacity:0.5;margin-bottom:6px">
            <div style="font-weight:500;font-size:13px">📢 ${App.esc(a.title)}</div>
            <div style="font-size:10px;color:var(--tm);margin-top:2px">${new Date(a.created_at).toLocaleString('th-TH')}</div>
          </div>`;
      });
    }

    if (!html) {
      html = '<div style="text-align:center;padding:40px 0;color:var(--tm)"><div style="font-size:36px;margin-bottom:8px">🔔</div><div>ไม่มีแจ้งเตือน</div></div>';
    }

    el.innerHTML = html;
  }

  async function markAllRead() {
    try {
      await API.markNotificationRead('all');
      App.toast('อ่านทั้งหมดแล้ว ✓', 'success');
      await loadNotifications();
      await App.refreshNotiBadge();
    } catch (err) { App.toast(err.message, 'error'); }
  }

  async function dismissAnnouncement(announcementId) {
    try {
      await API.dismissAnnouncement(announcementId);
      App.toast('รับทราบแล้ว ✓', 'success');
      await loadNotifications();
      await App.refreshNotiBadge();
    } catch (err) { App.toast(err.message, 'error'); }
  }


  // ════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════
  return {
    renderSettings, loadSettings, setTab,
    // Channels
    toggleChannel, editChannel, saveChannelEdit,
    showAddChannel, saveNewChannel,
    // Vendors (batch matrix)
    filterVendors, toggleVendor, toggleVisibility, toggleAllStores, saveVendorMatrix,
    // Settings
    setSettingToggle, saveSettings,
    // Categories (Phase 10)
    toggleMainCategory, toggleSubCategory, saveCategoryVisibility,
    // Alert Rules (Phase 11)
    toggleAlertRule, setAlertThreshold, saveAlertRules,
    // Permissions (batch)
    togglePermission, toggleGroupAll, toggleGroupNone, savePermissions,
    // Notifications
    renderNotifications, loadNotifications, markAllRead, dismissAnnouncement,
    // Notification Settings (Phase 10)
    renderNotificationSettings, loadNotificationSettings, toggleNotifPref,
  };
})();
