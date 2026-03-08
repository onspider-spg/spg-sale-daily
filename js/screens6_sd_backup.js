/**
 * ═══════════════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens6_sd.js — v1.5.2: Report Hub + ACC Review
 * ═══════════════════════════════════════════════════
 */

const Screens6 = (() => {

  // ════════════════════════════════════════
  // REPORT HUB — S8 Daily Report History
  // ════════════════════════════════════════

  let _rhMonth = null;
  let _rhReports = [];

  function renderReportHub() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();
    const now = new Date();
    _rhMonth = _rhMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div style="flex:1;min-width:0">
            <div class="header-title">📝 รายงานประจำวัน</div>
            <div class="header-sub">Report Hub · ${App.esc(session.store_name)}</div>
          </div>
          <button class="back-btn" onclick="App.toggleSidebar()" style="font-size:16px">☰</button>
        </div>
        <div class="screen-body">
          ${API.isHQ() ? App.renderStoreSelector() : ''}

          <!-- Month selector -->
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0 16px;font-size:14px;font-weight:600">
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens6.rhChangeMonth(-1)">‹</span>
            <span id="rh-month-label">${formatMonth(_rhMonth)}</span>
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens6.rhChangeMonth(1)">›</span>
          </div>

          <!-- KPI summary -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px" id="rh-kpis">
            <div class="card" style="text-align:center;padding:12px 8px">
              <div style="font-size:10px;color:var(--td)">📝 รายงาน</div>
              <div style="font-size:18px;font-weight:700" id="rh-total">—</div>
            </div>
            <div class="card" style="text-align:center;padding:12px 8px">
              <div style="font-size:10px;color:var(--td)">✅ บันทึกแล้ว</div>
              <div style="font-size:18px;font-weight:700;color:var(--green)" id="rh-submitted">—</div>
            </div>
            <div class="card" style="text-align:center;padding:12px 8px">
              <div style="font-size:10px;color:var(--td)">⚪ ยังไม่กรอก</div>
              <div style="font-size:18px;font-weight:700;color:var(--tm)" id="rh-missing">—</div>
            </div>
          </div>

          <!-- Report list -->
          <div class="section-label">📋 รายวัน</div>
          <div id="rh-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>

          <!-- Quick add today -->
          <div style="padding:16px 0">
            <button class="btn btn-gold" style="width:100%" onclick="Screens6.rhGoToday()">📝 กรอกรายงานวันนี้</button>
          </div>
        </div>
      </div>`;
  }

  async function loadReportHub() {
    const el = document.getElementById('rh-list');
    if (!el) return;
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      const data = await API.getReportHub(storeId, _rhMonth);
      _rhReports = data.reports || [];

      // KPIs
      const submitted = _rhReports.filter(r => r.is_submitted).length;
      const draft = _rhReports.filter(r => !r.is_submitted).length;
      const daysInMonth = new Date(_rhMonth.split('-')[0], _rhMonth.split('-')[1], 0).getDate();
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const maxDays = _rhMonth === currentMonth ? today.getDate() : daysInMonth;
      const missing = maxDays - _rhReports.length;

      setTextSafe('rh-total', _rhReports.length);
      setTextSafe('rh-submitted', submitted);
      setTextSafe('rh-missing', Math.max(0, missing));

      // Build list — show all days in month up to today
      const year = parseInt(_rhMonth.split('-')[0]);
      const month = parseInt(_rhMonth.split('-')[1]);
      const reportMap = {};
      _rhReports.forEach(r => { reportMap[r.report_date] = r; });

      let html = '';
      for (let d = maxDays; d >= 1; d--) {
        const dateStr = `${_rhMonth}-${String(d).padStart(2, '0')}`;
        const r = reportMap[dateStr];
        const dayName = new Date(year, month - 1, d).toLocaleDateString('th-TH', { weekday: 'short' });

        if (r) {
          const status = r.is_submitted
            ? '<span style="color:var(--green);font-weight:600">✅ บันทึกแล้ว</span>'
            : '<span style="color:var(--gold);font-weight:600">📝 Draft</span>';
          const inc = r.incident_count || 0;
          const incBadge = inc > 0 ? `<span style="background:var(--red-bg);color:var(--red);padding:1px 6px;border-radius:4px;font-size:10px">⚠️ ${inc}</span>` : '';

          html += `
            <div class="card" style="margin-bottom:6px;cursor:pointer;padding:14px 16px" onclick="Screens6.rhGoDate('${dateStr}')">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="min-width:50px;text-align:center">
                  <div style="font-size:18px;font-weight:700">${d}</div>
                  <div style="font-size:10px;color:var(--tm)">${dayName}</div>
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px">${status} ${incBadge}</div>
                  <div style="font-size:11px;color:var(--tm);margin-top:2px">
                    ${r.weather ? weatherIcon(r.weather) : ''} ${r.traffic ? trafficLabel(r.traffic) : ''}
                  </div>
                </div>
                <span style="font-size:16px;color:var(--tm)">›</span>
              </div>
            </div>`;
        } else {
          html += `
            <div class="card" style="margin-bottom:6px;cursor:pointer;padding:14px 16px;opacity:0.5" onclick="Screens6.rhGoDate('${dateStr}')">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="min-width:50px;text-align:center">
                  <div style="font-size:18px;font-weight:700">${d}</div>
                  <div style="font-size:10px;color:var(--tm)">${dayName}</div>
                </div>
                <div style="flex:1"><span style="font-size:12px;color:var(--tm)">⚪ ยังไม่ได้กรอก</span></div>
                <span style="font-size:16px;color:var(--tm)">›</span>
              </div>
            </div>`;
        }
      }
      el.innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--tm)">ไม่มีข้อมูล</div>';

    } catch (err) {
      el.innerHTML = '<div style="color:var(--red);padding:16px">' + App.esc(err.message) + '</div>';
    } finally { App.hideLoader(); }
  }

  function rhChangeMonth(delta) {
    const [y, m] = _rhMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    _rhMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    App.go('report-hub');
  }

  function rhGoDate(dateStr) {
    // Set date in Screens5 and navigate
    if (typeof Screens5 !== 'undefined' && Screens5._reportDate !== undefined) {
      Screens5._reportDate = dateStr;
    }
    // Store in sessionStorage for cross-module
    sessionStorage.setItem('sd_report_date', dateStr);
    App.go('daily-report');
  }

  function rhGoToday() {
    rhGoDate(new Date().toISOString().split('T')[0]);
  }


  // ════════════════════════════════════════
  // ACC REVIEW — Finance Sync Hub (T1-T2)
  // ════════════════════════════════════════

  let _arMonth = null;
  let _arDays = [];
  let _arSelected = new Set();

  function renderAccReview() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    // T1-T2 only
    if (session.tier_level > 2 && session.store_id !== 'HQ') {
      return `<div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div><div class="header-title">🔍 ACC Review</div></div>
        </div>
        <div class="screen-body" style="text-align:center;padding:40px 16px">
          <div style="font-size:48px;margin-bottom:12px">🔒</div>
          <div style="font-size:16px;font-weight:600">เฉพาะ ACC (T1-T2)</div>
          <div style="font-size:13px;color:var(--tm);margin-top:4px">ต้องเป็น Admin หรือ Account เท่านั้น</div>
        </div>
      </div>`;
    }

    const now = new Date();
    _arMonth = _arMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    _arSelected = new Set();

    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div style="flex:1;min-width:0">
            <div class="header-title">🔍 ACC Review</div>
            <div class="header-sub">ตรวจสอบ & Sync → Finance</div>
          </div>
          <button class="back-btn" onclick="App.toggleSidebar()" style="font-size:16px">☰</button>
        </div>
        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Month -->
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0 16px;font-size:14px;font-weight:600">
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens6.arChangeMonth(-1)">‹</span>
            <span id="ar-month-label">${formatMonth(_arMonth)}</span>
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens6.arChangeMonth(1)">›</span>
          </div>

          <!-- KPIs -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
            <div class="card" style="text-align:center;padding:12px 8px">
              <div style="font-size:10px;color:var(--td)">💰 ยอดขายรวม</div>
              <div style="font-size:16px;font-weight:700;color:var(--gold-dim)" id="ar-total-sale">—</div>
            </div>
            <div class="card" style="text-align:center;padding:12px 8px">
              <div style="font-size:10px;color:var(--td)">🧾 ค่าใช้จ่ายรวม</div>
              <div style="font-size:16px;font-weight:700;color:var(--red)" id="ar-total-exp">—</div>
            </div>
            <div class="card" style="text-align:center;padding:12px 8px">
              <div style="font-size:10px;color:var(--td)">🔒 Synced</div>
              <div style="font-size:16px;font-weight:700;color:var(--green)" id="ar-synced">—</div>
            </div>
          </div>

          <!-- Select all / batch -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <label style="font-size:12px;color:var(--td);display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="ar-select-all" onchange="Screens6.arToggleAll(this.checked)">
              เลือกทั้งหมดที่รอ Sync
            </label>
            <span style="font-size:11px;color:var(--tm)" id="ar-selected-count"></span>
          </div>

          <!-- Day list -->
          <div id="ar-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>

          <!-- Batch sync button -->
          <div style="padding:16px 0" id="ar-batch-wrap" style="display:none">
            <button class="btn btn-gold" style="width:100%" id="ar-batch-btn" onclick="Screens6.arBatchSync()">
              🔒 Sync ที่เลือก
            </button>
          </div>
        </div>
      </div>`;
  }

  async function loadAccReview() {
    const el = document.getElementById('ar-list');
    if (!el) return;
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      const data = await API.getAccReview(storeId, _arMonth);
      _arDays = data.days || [];
      _arSelected = new Set();

      // KPIs
      let totalSale = 0, totalExp = 0, syncedCount = 0;
      _arDays.forEach(d => {
        totalSale += d.total_sales || 0;
        totalExp += d.expense_total || 0;
        if (d.fin_synced) syncedCount++;
      });
      setTextSafe('ar-total-sale', '$' + totalSale.toLocaleString());
      setTextSafe('ar-total-exp', '$' + totalExp.toLocaleString());
      setTextSafe('ar-synced', `${syncedCount}/${_arDays.length}`);

      renderAccList(el);
      updateBatchBtn();
    } catch (err) {
      el.innerHTML = '<div style="color:var(--red);padding:16px">' + App.esc(err.message) + '</div>';
    } finally { App.hideLoader(); }
  }

  function renderAccList(el) {
    if (_arDays.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tm)">ไม่มีข้อมูลเดือนนี้</div>';
      return;
    }

    // Sort desc (newest first)
    const sorted = [..._arDays].sort((a, b) => b.sale_date.localeCompare(a.sale_date));

    el.innerHTML = sorted.map(d => {
      const date = new Date(d.sale_date);
      const day = date.getDate();
      const dayName = date.toLocaleDateString('th-TH', { weekday: 'short' });
      const isSynced = d.fin_synced;
      const isChecked = _arSelected.has(d.sale_date);

      const saleStr = d.total_sales > 0 ? '$' + d.total_sales.toLocaleString() : '—';
      const expStr = d.expense_total > 0 ? '$' + d.expense_total.toLocaleString() : '—';
      const expCount = d.expense_count || 0;

      return `
        <div class="card" style="margin-bottom:6px;padding:14px 16px;border-left:3px solid ${isSynced ? 'var(--green)' : 'var(--gold)'}">
          <div style="display:flex;align-items:center;gap:10px">
            ${isSynced
              ? `<span style="font-size:16px">🔒</span>`
              : `<input type="checkbox" ${isChecked ? 'checked' : ''} onchange="Screens6.arToggle('${d.sale_date}', this.checked)" style="width:18px;height:18px;accent-color:var(--gold)">`
            }
            <div style="min-width:40px;text-align:center">
              <div style="font-size:16px;font-weight:700">${day}</div>
              <div style="font-size:10px;color:var(--tm)">${dayName}</div>
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;gap:12px;font-size:13px">
                <span style="color:var(--gold-dim)">💰 ${saleStr}</span>
                <span style="color:var(--red)">🧾 ${expStr}</span>
                ${expCount > 0 ? `<span style="font-size:10px;color:var(--tm)">(${expCount} รายการ)</span>` : ''}
              </div>
              <div style="font-size:11px;margin-top:2px">
                ${isSynced
                  ? '<span style="color:var(--green)">🔒 Synced & ล็อค</span>'
                  : '<span style="color:var(--gold)">⏳ รอตรวจ</span>'
                }
              </div>
            </div>
            <span style="font-size:14px;color:var(--tm);cursor:pointer" onclick="Screens6.arShowDetail('${d.sale_date}')">👁️</span>
          </div>
        </div>`;
    }).join('');
  }

  function arToggle(dateStr, checked) {
    if (checked) _arSelected.add(dateStr);
    else _arSelected.delete(dateStr);
    updateBatchBtn();
  }

  function arToggleAll(checked) {
    _arSelected = new Set();
    if (checked) {
      _arDays.filter(d => !d.fin_synced).forEach(d => _arSelected.add(d.sale_date));
    }
    // Re-render checkboxes
    const el = document.getElementById('ar-list');
    if (el) renderAccList(el);
    updateBatchBtn();
  }

  function updateBatchBtn() {
    const count = _arSelected.size;
    const countEl = document.getElementById('ar-selected-count');
    if (countEl) countEl.textContent = count > 0 ? `เลือก ${count} วัน` : '';
    const btn = document.getElementById('ar-batch-btn');
    if (btn) {
      btn.textContent = count > 0 ? `🔒 Sync ที่เลือก (${count} วัน)` : '🔒 Sync ที่เลือก';
      btn.disabled = count === 0;
      btn.style.opacity = count === 0 ? '0.5' : '1';
    }
  }

  async function arBatchSync() {
    const dates = Array.from(_arSelected);
    if (dates.length === 0) { App.toast('กรุณาเลือกวันที่', 'warning'); return; }

    const msg = dates.length === 1
      ? `🔒 Sync & ล็อค วันที่ ${dates[0]}?`
      : `🔒 Sync & ล็อค ${dates.length} วัน?\n\n${dates.join('\n')}`;

    if (!confirm(msg + '\n\nหลังจาก Sync จะไม่สามารถแก้ไขได้')) return;

    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      const result = await API.batchSync(storeId, dates);
      App.toast(`🔒 Sync สำเร็จ ${result.synced_count} วัน`, 'success');
      _arSelected = new Set();
      document.getElementById('ar-select-all').checked = false;
      await loadAccReview();
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }

  async function arShowDetail(dateStr) {
    // Show detail popup
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      const data = await API.getS8Summary(storeId, dateStr);
      App.hideLoader();

      const sale = data.sale;
      const expenses = data.expenses || [];
      const expTotal = data.expense_total || 0;

      // Build channel breakdown from sale
      let channelHtml = '';
      if (sale) {
        const channels = [];
        for (let i = 1; i <= 10; i++) {
          const name = sale[`ch${i}_name`];
          const amt = sale[`ch${i}_amount`] || 0;
          if (name && amt > 0) channels.push({ name, amt });
        }
        channelHtml = channels.map(c =>
          `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
            <span>${App.esc(c.name)}</span>
            <span style="font-weight:600">$${c.amt.toLocaleString()}</span>
          </div>`
        ).join('') || '<div style="font-size:12px;color:var(--tm)">ไม่มีข้อมูลยอดขาย</div>';
      } else {
        channelHtml = '<div style="font-size:12px;color:var(--tm)">ยังไม่ได้กรอกยอดขาย</div>';
      }

      // Expense breakdown
      let expHtml = '';
      if (expenses.length > 0) {
        expHtml = expenses.map(e =>
          `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px solid var(--s2)">
            <span>${App.esc(e.description || e.vendor_name || 'ไม่มีรายละเอียด')}</span>
            <span style="font-weight:600;color:var(--red)">$${(e.total_amount || 0).toLocaleString()}</span>
          </div>`
        ).join('');
      } else {
        expHtml = '<div style="font-size:12px;color:var(--tm)">ไม่มีค่าใช้จ่าย</div>';
      }

      const overlay = document.createElement('div');
      overlay.id = 'edit-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = `
        <div style="background:var(--bg);border-radius:var(--radius);padding:24px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="font-size:16px;font-weight:600">📅 ${dateStr}</div>
            <button onclick="document.getElementById('edit-modal')?.remove()" style="background:none;border:none;font-size:20px;cursor:pointer">✕</button>
          </div>

          <!-- S1 -->
          <div class="section-label" style="margin-top:0">💰 S1 ยอดขาย — $${sale ? (sale.total_sales || 0).toLocaleString() : '—'}</div>
          <div class="card" style="margin-bottom:12px">${channelHtml}</div>

          <!-- S2 -->
          <div class="section-label">🧾 S2 ค่าใช้จ่าย — $${expTotal.toLocaleString()}</div>
          <div class="card" style="margin-bottom:16px">${expHtml}</div>

          <!-- Sync button -->
          ${!_arDays.find(d => d.sale_date === dateStr)?.fin_synced ? `
            <button class="btn btn-gold" style="width:100%" onclick="Screens6.arSyncOne('${dateStr}')">🔒 Sync & Lock วันนี้</button>
          ` : `
            <div style="text-align:center;padding:12px;color:var(--green);font-weight:600">🔒 Synced แล้ว</div>
          `}
        </div>`;
      document.body.appendChild(overlay);

    } catch (err) {
      App.hideLoader();
      App.toast(err.message, 'error');
    }
  }

  async function arSyncOne(dateStr) {
    if (!confirm(`🔒 Sync & ล็อค วันที่ ${dateStr}?`)) return;
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      await API.batchSync(storeId, [dateStr]);
      document.getElementById('edit-modal')?.remove();
      App.toast('🔒 Sync สำเร็จ', 'success');
      await loadAccReview();
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }

  function arChangeMonth(delta) {
    const [y, m] = _arMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    _arMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    App.go('acc-review');
  }


  // ─── HELPERS ───

  function formatMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${months[m - 1]} ${y}`;
  }

  function weatherIcon(w) {
    const m = { sunny: '☀️', cloudy: '🌤️', rain: '🌧️', heavy_rain: '⛈️' };
    return m[w] || '';
  }

  function trafficLabel(t) {
    const m = { above: '📈', normal: '➡️', below: '📉' };
    return m[t] || '';
  }

  function setTextSafe(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }


  // ════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════
  return {
    // Report Hub
    renderReportHub, loadReportHub,
    rhChangeMonth, rhGoDate, rhGoToday,
    // ACC Review
    renderAccReview, loadAccReview,
    arChangeMonth, arToggle, arToggleAll,
    arBatchSync, arShowDetail, arSyncOne,
  };
})();
