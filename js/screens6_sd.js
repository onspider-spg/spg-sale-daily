// Version 2.0.2 | 8 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens6_sd.js — v2.0.1: Report Hub + Daily Detail + Send to Account
 * Phase 8: Daily Detail page
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
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Report Hub' })}
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
    sessionStorage.setItem('sd_report_date', dateStr);
    App.go('daily-report');
  }

  function rhGoReport(dateStr) {
    // "กรอกรายงานวันนี้" → Daily Report (S8)
    if (typeof Screens5 !== 'undefined' && Screens5._reportDate !== undefined) {
      Screens5._reportDate = dateStr;
    }
    sessionStorage.setItem('sd_report_date', dateStr);
    App.go('daily-report');
  }

  function rhGoToday() {
    rhGoReport(new Date().toISOString().split('T')[0]);
  }


  // ════════════════════════════════════════
  // DAILY DETAIL — Phase 8 (read-only drill-down)
  // ════════════════════════════════════════

  let _ddDate = null;

  function renderDailyDetail(params) {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    _ddDate = params?.date || _ddDate || new Date().toISOString().split('T')[0];

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'report-hub', label: 'Daily Detail' })}
        <div class="screen-body">

          <!-- Date picker -->
          <div style="display:flex;align-items:center;gap:var(--sp-sm);margin-bottom:var(--sp-sm);font-size:var(--fs-body)">
            <span style="color:var(--tm)">📅</span>
            <input type="date" class="form-input" style="flex:1;max-width:160px;padding:var(--sp-xs) var(--sp-sm);font-size:var(--fs-body)" id="dd-date" value="${_ddDate}" onchange="Screens6.ddChangeDate()">
            <button class="btn btn-sm btn-outline" onclick="Screens6.ddChangeDate()">Go</button>
          </div>

          <!-- Header: date + store + status -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
            <div style="font-size:var(--fs-body);font-weight:700" id="dd-title">—</div>
            <span class="status-badge sts-pending" id="dd-status">—</span>
          </div>

          <!-- KPI: Sales / Expense / Net -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-xs);margin-bottom:var(--sp-sm)">
            <div style="padding:var(--sp-sm);background:var(--gold-bg);border-radius:var(--radius-xs);text-align:center">
              <div style="font-size:var(--fs-xs);color:var(--gold)">Sales</div>
              <div style="font-size:var(--fs-body);font-weight:800;color:var(--gold)" id="dd-sales">—</div>
            </div>
            <div style="padding:var(--sp-sm);background:var(--red-bg);border-radius:var(--radius-xs);text-align:center">
              <div style="font-size:var(--fs-xs);color:var(--red)">Expense</div>
              <div style="font-size:var(--fs-body);font-weight:800;color:var(--red)" id="dd-expense">—</div>
            </div>
            <div style="padding:var(--sp-sm);background:var(--green-bg);border-radius:var(--radius-xs);text-align:center">
              <div style="font-size:var(--fs-xs);color:var(--green)">Net</div>
              <div style="font-size:var(--fs-body);font-weight:800;color:var(--green)" id="dd-net">—</div>
            </div>
          </div>

          <!-- Content sections -->
          <div id="dd-content">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadDailyDetail(params) {
    _ddDate = params?.date || _ddDate || new Date().toISOString().split('T')[0];
    const el = document.getElementById('dd-content');
    if (!el) return;

    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      const data = await API.getDailyDetail(storeId, _ddDate);

      // KPIs
      setTextSafe('dd-sales', '$' + (data.total_sales || 0).toLocaleString());
      setTextSafe('dd-expense', '$' + (data.total_expense || 0).toLocaleString());
      setTextSafe('dd-net', '$' + (data.net || 0).toLocaleString());

      // Title
      const titleEl = document.getElementById('dd-title');
      if (titleEl) {
        const d = new Date(_ddDate + 'T00:00:00');
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        titleEl.textContent = `${days[d.getDay()]} ${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()} — ${data.store_id || ''}`;
      }

      // Status
      const statusEl = document.getElementById('dd-status');
      if (statusEl) {
        if (data.is_locked) { statusEl.textContent = '🔒 Locked'; statusEl.className = 'status-badge sts-locked'; }
        else if (data.is_synced) { statusEl.textContent = '✅ Synced'; statusEl.className = 'status-badge sts-synced'; }
        else { statusEl.textContent = 'Pending Sync'; statusEl.className = 'status-badge sts-pending'; }
      }

      // Build detail sections
      let html = '';

      // 💰 Sales channels
      html += `<div class="card" style="margin-bottom:var(--sp-xs)">
        <div style="font-weight:700;color:var(--gold);margin-bottom:var(--sp-xs);font-size:var(--fs-sm)">💰 Sales</div>
        ${data.channels.length > 0 ? data.channels.map(c =>
          `<div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);padding:2px 0"><span>${App.esc(c.name)}</span><span>$${(c.amount||0).toLocaleString()}</span></div>`
        ).join('') : '<div style="font-size:var(--fs-xs);color:var(--tm)">ไม่มีข้อมูล</div>'}
      </div>`;

      // 🧾 Expenses
      html += `<div class="card" style="margin-bottom:var(--sp-xs)">
        <div style="font-weight:700;color:var(--red);margin-bottom:var(--sp-xs);font-size:var(--fs-sm)">🧾 Expenses (${data.expenses.length})</div>
        ${data.expenses.length > 0 ? data.expenses.map(e =>
          `<div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);padding:2px 0"><span>${App.esc(e.description || e.doc_number)}</span><span style="color:var(--red)">-$${(e.total_amount||0).toLocaleString()}</span></div>`
        ).join('') : '<div style="font-size:var(--fs-xs);color:var(--tm)">ไม่มีค่าใช้จ่าย</div>'}
      </div>`;

      // 💵 Cash
      if (data.cash) {
        const c = data.cash;
        const varColor = c.is_matched ? 'var(--green)' : 'var(--red)';
        html += `<div class="card" style="margin-bottom:var(--sp-xs)">
          <div style="font-weight:700;color:var(--green);margin-bottom:var(--sp-xs);font-size:var(--fs-sm)">💵 Cash</div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm)">
            <span>Expected $${(c.expected||0).toLocaleString()} · Actual $${(c.actual||0).toLocaleString()}</span>
            <span style="color:${varColor}">Var ${c.variance >= 0 ? '+' : ''}$${(c.variance||0).toFixed(2)} ${c.is_matched ? '' : '⚠️'}</span>
          </div>
          ${c.reason ? `<div style="font-size:var(--fs-xs);color:var(--tm);margin-top:2px">${App.esc(c.reason)}</div>` : ''}
        </div>`;
      }

      // 📄 Invoices
      if (data.invoices.length > 0) {
        html += `<div class="card" style="margin-bottom:var(--sp-xs)">
          <div style="font-weight:700;color:var(--blue);margin-bottom:var(--sp-xs);font-size:var(--fs-sm)">📄 Invoices (${data.invoices.length})</div>
          ${data.invoices.map(inv => {
            const cn = inv.has_credit_note ? ' <span style="color:var(--green);font-size:var(--fs-xs)">CN</span>' : '';
            return `<div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);padding:2px 0"><span>${App.esc(inv.invoice_no)} ${App.esc(inv.vendor_name)}${cn}</span><span>$${(inv.total_amount||0).toLocaleString()} ${inv.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span></div>`;
          }).join('')}
        </div>`;
      }

      // 📝 Report
      if (data.report) {
        const r = data.report;
        const wMap = { sunny: '☀️ แดด', cloudy: '🌤️ ครึ้ม', rain: '🌧️ ฝน', heavy_rain: '⛈️ ฝนหนัก' };
        const tMap = { above: '📈 ดี', normal: '➡️ ปกติ', below: '📉 ต่ำ' };
        html += `<div class="card" style="margin-bottom:var(--sp-xs)">
          <div style="font-weight:700;color:var(--purple);margin-bottom:var(--sp-xs);font-size:var(--fs-sm)">📝 Report</div>
          <div style="font-size:var(--fs-sm)">${wMap[r.weather]||''} · Traffic ${tMap[r.traffic]||''} · POS ${r.pos_status === 'normal' ? '✅' : '⚠️'}</div>
          ${r.incidents.length > 0 ? `<div style="font-size:var(--fs-sm);margin-top:2px">⚠️ ${r.incidents.map(i => i.incident_type + ' ×' + i.count).join(' · ')}</div>` : ''}
          ${r.tasks.length > 0 ? `<div style="font-size:var(--fs-sm);margin-top:2px">📋 ${r.tasks.map(t => t.title).join(' · ')}</div>` : ''}
          ${r.note ? `<div style="font-size:var(--fs-xs);color:var(--tm);margin-top:2px">📝 ${App.esc(r.note)}</div>` : ''}
        </div>`;
      }

      el.innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--tm)">ไม่มีข้อมูลวันนี้</div>';

    } catch (err) {
      el.innerHTML = `<div style="color:var(--red);padding:16px">${App.esc(err.message)}</div>`;
    } finally {
      App.hideLoader();
    }
  }

  function ddChangeDate() {
    const dateEl = document.getElementById('dd-date');
    if (dateEl) {
      _ddDate = dateEl.value;
      App.go('daily-detail', { date: _ddDate });
    }
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
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Send to Account' })}
        <div class="screen-body" style="text-align:center;padding:40px 16px">
          <div style="font-size:48px;margin-bottom:12px">🔒</div>
          <div style="font-size:var(--fs-h2);font-weight:600">เฉพาะ ACC (T1-T2)</div>
          <div style="font-size:var(--fs-body);color:var(--tm);margin-top:var(--sp-xs)">ต้องเป็น Admin หรือ Account เท่านั้น</div>
        </div>
      </div>`;
    }

    const now = new Date();
    _arMonth = _arMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    _arSelected = new Set();

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Send to Account' })}
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
    rhChangeMonth, rhGoDate, rhGoReport, rhGoToday,
    // Daily Detail (Phase 8)
    renderDailyDetail, loadDailyDetail, ddChangeDate,
    // ACC Review
    renderAccReview, loadAccReview,
    arChangeMonth, arToggle, arToggleAll,
    arBatchSync, arShowDetail, arSyncOne,
  };
})();
