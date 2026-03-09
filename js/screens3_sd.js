// Version 2.0.3 | 8 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens3_sd.js — S4 Cash + S5 Sale History + S6 Expense History
 * v2.0.1 — Phase 4: S5 table + S6 filter chips
 * ═══════════════════════════════════════════
 */

const Screens3 = (() => {

  // ════════════════════════════════════════
  // S4: CASH ON HAND
  // ════════════════════════════════════════

  let s4 = {
    date: null,
    cashSale: 0,
    cashExpend: 0,
    expected: 0,
    tolerance: 2,
    existing: null,
    photoUrl: null,
  };

  function renderCash() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    const date = s4.date || App.todayStr();
    s4.date = date;

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Cash On Hand' })}

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Date -->
          <div class="date-bar">
            <button class="date-nav" onclick="Screens3.s4ChangeDate(-1)">‹</button>
            <div class="date-display">
              <span id="s4-date-label">${App.formatDate(date)}</span>
            </div>
            <button class="date-nav" onclick="Screens3.s4ChangeDate(1)">›</button>
            <button class="date-today" onclick="Screens3.s4GoToday()">วันนี้</button>
          </div>

          <!-- Auto Calculation -->
          <div class="section-label">🧮 Auto-Calculation</div>
          <div class="card" style="border-color:var(--gold);background:var(--gold-bg)">
            <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center">
              <div style="text-align:center">
                <div style="font-size:11px;color:var(--td)">① Cash Sale</div>
                <div style="font-size:11px;color:var(--blue)">AUTO จาก S1</div>
                <div style="font-size:20px;font-weight:700;color:var(--green)" id="s4-cash-sale">$0.00</div>
              </div>
              <div style="font-size:24px;color:var(--td)">−</div>
              <div style="text-align:center">
                <div style="font-size:11px;color:var(--td)">② Cash Expend</div>
                <div style="font-size:11px;color:var(--blue)">AUTO จาก S2</div>
                <div style="font-size:20px;font-weight:700;color:var(--red)" id="s4-cash-expend">$0.00</div>
              </div>
            </div>
            <div style="text-align:center;margin:12px 0;font-size:20px;color:var(--td)">=</div>
            <div style="text-align:center">
              <div style="font-size:12px;color:var(--td)">③ Expected Cash</div>
              <div style="font-size:28px;font-weight:700;color:var(--gold-dim)" id="s4-expected">$0.00</div>
            </div>
          </div>

          <!-- No sale data warning -->
          <div id="s4-no-data-warn" style="display:none">
            <div class="alert-row warn">
              <span class="alert-icon">⚠️</span>
              <span class="alert-text">ยังไม่มียอดขายวันนี้ — กรุณากรอก S1 ก่อน</span>
            </div>
          </div>

          <!-- Manual Input -->
          <div class="section-label">✍️ นับเงินสดจริง</div>
          <div class="card">
            <div class="form-group">
              <label class="form-label">④ Actual Cash (นับจริง) <span class="req">*</span></label>
              <input type="number" step="0.01" class="form-input lg" id="s4-actual"
                     placeholder="0.00" oninput="Screens3.s4Validate()">
            </div>
          </div>

          <!-- Validation Result -->
          <div id="s4-result" style="display:none"></div>

          <!-- Mismatch Reason (shown when >tolerance) -->
          <div id="s4-reason-wrap" style="display:none">
            <div class="form-group">
              <label class="form-label" style="color:var(--red)">เหตุผลที่เงินไม่ตรง <span class="req">*</span></label>
              <input type="text" class="form-input" id="s4-reason" placeholder="กรุณาระบุเหตุผล...">
            </div>
          </div>

          <!-- Photo -->
          <div class="section-label">📸 ถ่ายรูปเงินสด (บังคับ)</div>
          <div class="photo-grid" style="grid-template-columns:1fr">
            <div class="photo-box" id="s4-photo-box" onclick="Screens3.s4PickPhoto()" style="min-height:80px">
              <div class="photo-icon">💵</div>
              <div class="photo-label">ถ่ายรูปเงินสดก่อนส่ง Manager</div>
              <div class="photo-required">* บังคับ</div>
            </div>
          </div>
          <input type="file" id="s4-file-input" accept="image/*"
                 style="display:none" onchange="Screens3.s4HandlePhoto(event)">

          <!-- Handover Chain (shown when record exists) -->
          <div id="s4-handover" style="display:none"></div>
        </div>

        <!-- Bottom Bar -->
        <div class="bottom-bar">
          <button class="btn btn-gold btn-full" id="s4-submit-btn" onclick="Screens3.s4Submit()">
            💾 Submit Cash Count
          </button>
        </div>
      </div>`;
  }

  async function loadCash() {
    try {
      App.showLoader();
      const data = await API.getCash(s4.date);

      s4.cashSale = data.cash_sale || 0;
      s4.cashExpend = data.cash_expend || 0;
      s4.expected = data.expected_cash || 0;
      s4.tolerance = data.tolerance || 2;
      s4.existing = data.existing || null;

      // Populate auto fields
      document.getElementById('s4-cash-sale').textContent = App.formatMoney(s4.cashSale);
      document.getElementById('s4-cash-expend').textContent = App.formatMoney(s4.cashExpend);
      document.getElementById('s4-expected').textContent = App.formatMoney(s4.expected);

      // No sale data warning
      const warnEl = document.getElementById('s4-no-data-warn');
      if (warnEl) warnEl.style.display = data.has_sale_data ? 'none' : 'block';

      // Populate if existing
      if (s4.existing) {
        const actualEl = document.getElementById('s4-actual');
        if (actualEl) actualEl.value = s4.existing.actual_cash;
        s4.photoUrl = s4.existing.cashier_photo_url;
        s4Validate();
        renderS4Photo();
        renderS4Handover(s4.existing);

        const tag = document.getElementById('s4-status-tag');
        if (tag) { tag.textContent = s4.existing.handover_status; tag.className = 'tag purple'; }
      }

    } catch (err) {
      App.toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      App.hideLoader();
    }
  }

  function s4Validate() {
    const actual = parseFloat(document.getElementById('s4-actual')?.value) || 0;
    const diff = actual - s4.expected;
    const matched = Math.abs(diff) <= s4.tolerance;

    const resultEl = document.getElementById('s4-result');
    const reasonEl = document.getElementById('s4-reason-wrap');
    if (!resultEl) return;

    resultEl.style.display = 'block';

    if (matched) {
      resultEl.innerHTML = `
        <div class="card" style="border-color:var(--green);background:var(--green-bg);text-align:center">
          <div style="font-size:32px">✅</div>
          <div style="font-size:14px;font-weight:700;color:var(--green)">เงินตรง!</div>
          <div style="font-size:12px;color:var(--td)">Diff: ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)} (tolerance ≤ $${s4.tolerance.toFixed(2)})</div>
        </div>`;
      if (reasonEl) reasonEl.style.display = 'none';
    } else {
      resultEl.innerHTML = `
        <div class="card" style="border-color:var(--red);background:var(--red-bg);text-align:center">
          <div style="font-size:32px">🔴</div>
          <div style="font-size:14px;font-weight:700;color:var(--red)">เงินไม่ตรง!</div>
          <div style="font-size:12px;color:var(--td)">Diff: ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)} (เกิน tolerance $${s4.tolerance.toFixed(2)})</div>
        </div>`;
      if (reasonEl) reasonEl.style.display = 'block';
    }
  }

  function renderS4Photo() {
    const box = document.getElementById('s4-photo-box');
    if (box && s4.photoUrl) {
      box.classList.add('has-photo');
      box.innerHTML = `<img src="${s4.photoUrl}"><div class="photo-check">✓</div>`;
    }
  }

  function renderS4Handover(cash) {
    const el = document.getElementById('s4-handover');
    if (!el) return;

    const statuses = ['with_cashier', 'manager', 'owner', 'deposited'];
    const idx = statuses.indexOf(cash.handover_status);

    const steps = [
      { icon: '👤', label: 'Cashier', by: cash.cashier_confirmed_by, at: cash.cashier_confirmed_at },
      { icon: '👔', label: 'Manager', by: cash.manager_confirmed_by, at: cash.manager_confirmed_at },
      { icon: '👑', label: 'Owner', by: cash.owner_confirmed_by, at: cash.owner_confirmed_at },
    ];

    el.style.display = 'block';
    el.innerHTML = `
      <div class="section-label">🔄 Handover Chain (3-tier)</div>
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center">
          ${steps.map((step, i) => {
            const done = i < idx || (i === 0 && idx >= 0);
            const current = i === idx;
            return `
              <div style="padding:10px">
                <div style="font-size:24px">${step.icon}</div>
                <div style="font-size:11px;font-weight:600">${step.label}</div>
                ${done ? `<div style="font-size:9px;color:var(--green)">✅ Confirmed</div>` :
                  current ? `<div style="font-size:9px;color:var(--orange)">⏳ Pending</div>
                    <button class="btn btn-sm btn-gold" style="margin-top:4px;font-size:9px;padding:3px 8px"
                            onclick="Screens3.s4Confirm('${cash.id}')">Confirm</button>` :
                  `<div style="font-size:9px;color:var(--tm)">— Waiting</div>`}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function s4PickPhoto() { document.getElementById('s4-file-input')?.click(); }

  async function s4HandlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      App.showLoader();
      const result = await API.uploadPhoto(file, 'cash');
      s4.photoUrl = result.url;
      renderS4Photo();
      App.toast('อัพโหลดสำเร็จ ✓', 'success');
    } catch (err) { App.toast('อัพโหลดไม่สำเร็จ', 'error'); }
    finally { App.hideLoader(); event.target.value = ''; }
  }

  async function s4Submit() {
    const actual = parseFloat(document.getElementById('s4-actual')?.value);
    if (isNaN(actual) || actual < 0) return App.toast('กรุณาใส่จำนวนเงินจริง', 'error');
    if (!s4.photoUrl) return App.toast('กรุณาถ่ายรูปเงินสด', 'error');

    const diff = actual - s4.expected;
    const matched = Math.abs(diff) <= s4.tolerance;
    const reason = document.getElementById('s4-reason')?.value?.trim();
    if (!matched && !reason) return App.toast('เงินไม่ตรง — กรุณาใส่เหตุผล', 'error');

    try {
      App.showLoader();
      const btn = document.getElementById('s4-submit-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

      const result = await API.submitCashCount({
        cash_date: s4.date,
        actual_cash: actual,
        photo_url: s4.photoUrl,
        mismatch_reason: reason || '',
      });

      const icon = result.is_matched ? '✅ เงินตรง' : `🔴 ไม่ตรง ($${result.difference.toFixed(2)})`;
      App.toast(`บันทึกสำเร็จ — ${icon}`, result.is_matched ? 'success' : 'warning');

      // Reload
      await loadCash();
    } catch (err) {
      App.toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      const btn = document.getElementById('s4-submit-btn');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Submit Cash Count'; }
    }
  }

  async function s4Confirm(cashId) {
    try {
      App.showLoader();
      const result = await API.confirmHandover(cashId);
      App.toast(`${result.new_status} ✓ by ${result.confirmed_by}`, 'success');
      await loadCash();
    } catch (err) {
      App.toast(err.message, 'error');
    } finally { App.hideLoader(); }
  }

  function s4ChangeDate(delta) {
    s4.date = App.addDays(s4.date || App.todayStr(), delta);
    if (s4.date > App.todayStr()) { s4.date = App.todayStr(); App.toast('ไม่สามารถเลือกวันในอนาคต', 'warning'); }
    App.go('cash');
  }

  function s4GoToday() { s4.date = App.todayStr(); App.go('cash'); }


  // ════════════════════════════════════════
  // S5: SALE HISTORY
  // ════════════════════════════════════════

  let s5 = { month: null, dateFrom: null, dateTo: null };

  function renderSaleHistory() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    const now = new Date();
    s5.month = s5.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Default date range = full month
    const [y, m] = s5.month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    if (!s5.dateFrom) s5.dateFrom = `${s5.month}-01`;
    if (!s5.dateTo) s5.dateTo = `${s5.month}-${String(daysInMonth).padStart(2, '0')}`;

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Sale History' })}

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Month selector -->
          <div class="date-bar">
            <button class="date-nav" onclick="Screens3.s5ChangeMonth(-1)">‹</button>
            <div class="date-display">
              <span id="s5-month-label">${formatMonthLabel(s5.month)}</span>
            </div>
            <button class="date-nav" onclick="Screens3.s5ChangeMonth(1)">›</button>
          </div>

          <!-- Date range -->
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:12px">
            <span style="color:var(--td)">📅</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s5-from" value="${s5.dateFrom}" onchange="Screens3.s5DateRange()">
            <span style="color:var(--tm)">→</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s5-to" value="${s5.dateTo}" onchange="Screens3.s5DateRange()">
          </div>

          <!-- KPIs -->
          <div class="kpi-grid" id="s5-kpis">
            <div class="kpi-box highlight">
              <div class="kpi-label">💰 ยอดรวม</div>
              <div class="kpi-value gold" id="s5-total">—</div>
              <div class="kpi-sub" id="s5-total-sub">—</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">📈 เฉลี่ย/วัน</div>
              <div class="kpi-value" id="s5-avg">—</div>
              <div class="kpi-sub" id="s5-avg-sub">—</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">🏆 วันดีสุด</div>
              <div class="kpi-value green" id="s5-best">—</div>
              <div class="kpi-sub" id="s5-best-sub">—</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">📉 วันต่ำสุด</div>
              <div class="kpi-value red" id="s5-worst">—</div>
              <div class="kpi-sub" id="s5-worst-sub">—</div>
            </div>
          </div>

          <!-- Cash Mismatch Alert -->
          <div id="s5-cash-alert"></div>

          <!-- Bar Chart -->
          <div class="section-label">📊 ยอดขายรายวัน</div>
          <div class="card">
            <div class="mini-chart" id="s5-chart" style="height:100px"></div>
          </div>

          <!-- Channel Breakdown -->
          <div class="section-label">💳 แยกตามช่องทาง</div>
          <div id="s5-channels"></div>

          <!-- Daily Table -->
          <div class="section-label">📋 รายวัน <span style="font-size:11px;color:var(--tm);font-weight:400">— กดเพื่อแก้ไข</span></div>
          <div id="s5-daily-table"></div>
        </div>
      </div>`;
  }

  let _s5AllDays = []; // store full month data for filtering

  async function loadSaleHistory() {
    try {
      App.showLoader();
      const data = await API.getSaleHistory(s5.month);
      _s5AllDays = data.daily_breakdown || [];
      const k = data.kpis;

      // KPIs
      setText('s5-total', App.formatMoney(k.total_sales));
      setText('s5-total-sub', `${k.days_recorded}/${k.days_in_month} วัน${k.mom_change ? ` · ${k.mom_change > 0 ? '↑' : '↓'}${Math.abs(k.mom_change)}% vs เดือนก่อน` : ''}`);
      setText('s5-avg', App.formatMoney(k.daily_average));
      setText('s5-avg-sub', `${k.days_recorded} วันที่บันทึก`);

      if (k.best_day) {
        setText('s5-best', App.formatMoney(k.best_day.amount));
        setText('s5-best-sub', App.formatDateShort(k.best_day.date));
      }
      if (k.worst_day) {
        setText('s5-worst', App.formatMoney(k.worst_day.amount));
        setText('s5-worst-sub', App.formatDateShort(k.worst_day.date));
      }

      // Channel breakdown
      const chEl = document.getElementById('s5-channels');
      if (chEl) {
        const channels = data.channel_breakdown || [];
        chEl.innerHTML = channels.filter(c => c.total > 0).map(c => `
          <div class="card-flat" style="display:flex;align-items:center;gap:10px">
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px">${App.esc(c.label)}</div>
              <div style="font-size:11px;color:var(--td)">${c.group}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700">${App.formatMoney(c.total)}</div>
              <div style="font-size:10px;color:var(--tm)">${c.pct}%</div>
            </div>
          </div>`).join('');
      }

      // Cash mismatch alert
      const cashAlertEl = document.getElementById('s5-cash-alert');
      const mismatches = data.cash_mismatches || [];
      if (cashAlertEl && mismatches.length > 0) {
        const totalDiff = mismatches.reduce(function(s, c) { return s + (c.diff || 0); }, 0);
        cashAlertEl.innerHTML = `
          <div style="background:var(--red-bg);border:1px solid var(--red);border-radius:var(--radius-sm);padding:14px;margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:22px">🔴</span>
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--red)">Cash Mismatch — ${mismatches.length} วัน</div>
                <div style="font-size:12px;color:var(--td)">ผลต่างรวม: <strong style="color:var(--red)">$${totalDiff.toFixed(2)}</strong></div>
              </div>
            </div>
            ${mismatches.map(function(c) {
              return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-top:1px solid rgba(217,79,79,0.2)">'
                + '<span>' + App.formatDateShort(c.date) + '</span>'
                + '<span style="font-weight:600;color:var(--red)">$' + (c.diff || 0).toFixed(2) + '</span>'
                + (c.reason ? '<span style="font-size:10px;color:var(--td);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + App.esc(c.reason) + '</span>' : '')
                + '</div>';
            }).join('')}
          </div>`;
      } else if (cashAlertEl) {
        cashAlertEl.innerHTML = '';
      }

      // Render filtered daily table
      s5RenderDaily();

    } catch (err) {
      App.toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally { App.hideLoader(); }
  }

  function s5RenderDaily() {
    const tableEl = document.getElementById('s5-daily-table');
    const chartEl = document.getElementById('s5-chart');
    if (!tableEl) return;

    // Filter by date range
    const from = s5.dateFrom || '';
    const to = s5.dateTo || '';
    const days = _s5AllDays.filter(d => {
      if (from && d.date < from) return false;
      if (to && d.date > to) return false;
      return true;
    });

    // Bar chart
    if (chartEl && days.length > 0) {
      const maxVal = Math.max(...days.map(d => d.total || 0), 1);
      chartEl.innerHTML = days.map(d => {
        const pct = Math.max(((d.total || 0) / maxVal) * 100, 3);
        const isToday = d.date === App.todayStr();
        return `<div class="mini-bar ${isToday ? 'today' : ''}" style="height:${pct}%"
                     title="${App.formatDateShort(d.date)}: ${App.formatMoney(d.total)}"></div>`;
      }).join('');
    }

    // Daily table — wireframe style
    if (days.length === 0) {
      tableEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tm)">ไม่มีข้อมูลในช่วงนี้</div>';
      return;
    }

    tableEl.innerHTML = `
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th class="hide-m">Cash</th>
              <th class="hide-m">Card</th>
              <th class="hide-m">Delivery</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${days.map(d => {
              const isLocked = d.locked;
              const isSynced = d.synced;
              const rowStyle = isLocked ? 'opacity:.6' : '';
              const statusHtml = isLocked
                ? '<span class="status-badge sts-locked">🔒 Locked</span>'
                : isSynced
                  ? '<span class="status-badge sts-synced">✅ Synced</span>'
                  : '<span class="status-badge sts-pending">Pending</span>';
              const editHtml = isLocked
                ? '<span style="font-size:var(--fs-xs);color:var(--tm)">locked</span>'
                : `<button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:var(--fs-xs)" onclick="Screens3.s5GoEdit('${d.date}')">✏️ Edit</button>`;

              return `
                <tr style="${rowStyle}">
                  <td style="font-weight:600">${App.formatDateShort(d.date)}</td>
                  <td class="hide-m">${App.formatMoney(d.cash_total || 0)}</td>
                  <td class="hide-m">${App.formatMoney(d.card_total || 0)}</td>
                  <td class="hide-m">${App.formatMoney(d.delivery_total || 0)}</td>
                  <td style="font-weight:700;color:var(--gold)">${App.formatMoney(d.total)}</td>
                  <td>${statusHtml}</td>
                  <td>${editHtml}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function s5DateRange() {
    s5.dateFrom = document.getElementById('s5-from')?.value || '';
    s5.dateTo = document.getElementById('s5-to')?.value || '';
    s5RenderDaily();
  }

  function s5GoEdit(date) {
    App.go('daily-sale', { date: date });
  }

  function s5ChangeMonth(delta) {
    const [y, m] = s5.month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    s5.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    s5.dateFrom = `${s5.month}-01`;
    s5.dateTo = `${s5.month}-${String(daysInMonth).padStart(2, '0')}`;
    App.go('sale-history');
  }


  // ════════════════════════════════════════
  // S6: EXPENSE HISTORY
  // ════════════════════════════════════════

  let s6 = { month: null, view: 'list', dateFrom: null, dateTo: null };

  function renderExpenseHistory() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    const now = new Date();
    s6.month = s6.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [y, m] = s6.month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    if (!s6.dateFrom) s6.dateFrom = `${s6.month}-01`;
    if (!s6.dateTo) s6.dateTo = `${s6.month}-${String(daysInMonth).padStart(2, '0')}`;

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Expense History' })}

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Month selector -->
          <div class="date-bar">
            <button class="date-nav" onclick="Screens3.s6ChangeMonth(-1)">‹</button>
            <div class="date-display">
              <span id="s6-month-label">${formatMonthLabel(s6.month)}</span>
            </div>
            <button class="date-nav" onclick="Screens3.s6ChangeMonth(1)">›</button>
          </div>

          <!-- Date range -->
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:12px">
            <span style="color:var(--td)">📅</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s6-from" value="${s6.dateFrom}" onchange="Screens3.s6DateRange()">
            <span style="color:var(--tm)">→</span>
            <input type="date" class="form-input" style="flex:1;padding:8px 10px;font-size:13px" id="s6-to" value="${s6.dateTo}" onchange="Screens3.s6DateRange()">
          </div>

          <!-- KPIs -->
          <div class="kpi-grid">
            <div class="kpi-box">
              <div class="kpi-label">🧾 Expense</div>
              <div class="kpi-value red" id="s6-exp-total">—</div>
              <div class="kpi-sub" id="s6-exp-count">—</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">📄 Invoice</div>
              <div class="kpi-value" id="s6-inv-total">—</div>
              <div class="kpi-sub" id="s6-inv-count">—</div>
            </div>
            <div class="kpi-box highlight">
              <div class="kpi-label">💸 รวมทั้งหมด</div>
              <div class="kpi-value red" id="s6-combined">—</div>
            </div>
            <div class="kpi-box">
              <div class="kpi-label">🔴 ค้างจ่าย</div>
              <div class="kpi-value" style="color:var(--orange)" id="s6-unpaid">—</div>
            </div>
          </div>

          <!-- Filter Chips -->
          <div class="chip-group">
            <button class="filter-chip active" id="s6-chip-all" onclick="Screens3.s6SetFilter('all')">All</button>
            <button class="filter-chip" id="s6-chip-COGS" onclick="Screens3.s6SetFilter('COGS')">COGS</button>
            <button class="filter-chip" id="s6-chip-OpEx" onclick="Screens3.s6SetFilter('OpEx')">OpEx</button>
            <button class="filter-chip" id="s6-chip-cash" onclick="Screens3.s6SetFilter('cash')">Cash</button>
            <button class="filter-chip" id="s6-chip-card" onclick="Screens3.s6SetFilter('card')">Transfer</button>
          </div>

          <!-- Content -->
          <div id="s6-content"></div>
        </div>
      </div>`;
  }

  let _s6Data = null;

  async function loadExpenseHistory() {
    try {
      App.showLoader();
      const data = await API.getExpenseHistory(s6.month);
      _s6Data = data;
      const k = data.kpis;

      setText('s6-exp-total', App.formatMoney(k.expense_total));
      setText('s6-exp-count', `${k.expense_count} รายการ`);
      setText('s6-inv-total', App.formatMoney(k.invoice_total));
      setText('s6-inv-count', `${k.invoice_count} รายการ`);
      setText('s6-combined', App.formatMoney(k.combined_total));
      setText('s6-unpaid', App.formatMoney(k.unpaid_total));

      s6RenderView();
    } catch (err) {
      App.toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally { App.hideLoader(); }
  }

  function s6DateRange() {
    s6.dateFrom = document.getElementById('s6-from')?.value || '';
    s6.dateTo = document.getElementById('s6-to')?.value || '';
    s6RenderView();
  }

  function s6FilterByRange(items, dateField) {
    return items.filter(item => {
      const d = item[dateField];
      if (!d) return true;
      if (s6.dateFrom && d < s6.dateFrom) return false;
      if (s6.dateTo && d > s6.dateTo) return false;
      return true;
    });
  }

  let _s6Filter = 'all';

  function s6SetFilter(filter) {
    _s6Filter = filter;
    ['all', 'COGS', 'OpEx', 'cash', 'card'].forEach(f => {
      const btn = document.getElementById(`s6-chip-${f}`);
      if (btn) btn.className = `filter-chip ${f === filter ? 'active' : ''}`;
    });
    s6RenderView();
  }

  function s6RenderView() {
    const el = document.getElementById('s6-content');
    if (!el || !_s6Data) return;

    // Merge expenses + invoices, filter by date range
    const expenses = s6FilterByRange(_s6Data.expenses || [], 'expense_date');
    const invoices = s6FilterByRange(_s6Data.invoices || [], 'invoice_date');

    let all = [
      ...expenses.map(e => ({ ...e, type: 'expense', date: e.expense_date })),
      ...invoices.map(i => ({ ...i, type: 'invoice', date: i.invoice_date })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    // Apply filter
    if (_s6Filter === 'COGS' || _s6Filter === 'OpEx') {
      all = all.filter(i => i.main_category === _s6Filter);
    } else if (_s6Filter === 'cash') {
      all = all.filter(i => i.payment_method === 'cash');
    } else if (_s6Filter === 'card') {
      all = all.filter(i => i.payment_method === 'card' || i.payment_method === 'transfer');
    }

    if (all.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tm)">ไม่มีข้อมูลในช่วงนี้</div>';
      return;
    }

    el.innerHTML = `
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              <th class="hide-m">Category</th>
              <th class="hide-m">Vendor</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${all.map(item => {
              const isLocked = item.fin_synced || item.is_locked;
              const rowStyle = isLocked ? 'opacity:.6' : '';
              const statusHtml = isLocked
                ? '<span class="status-badge sts-locked">🔒 Locked</span>'
                : '<span class="status-badge sts-pending">Pending</span>';
              const canEdit = !isLocked;
              const editClick = canEdit
                ? (item.type === 'expense'
                  ? `onclick="Screens3.s6GoEditExpense('${item.date}')"`
                  : `onclick="Screens3.s6GoEditInvoice('${item.id}')"`)
                : '';
              const editHtml = canEdit
                ? `<button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:var(--fs-xs)" ${editClick}>✏️ Edit</button>`
                : '<span style="font-size:var(--fs-xs);color:var(--tm)">locked</span>';

              return `
                <tr style="${rowStyle}">
                  <td>${App.formatDateShort(item.date)}</td>
                  <td style="font-weight:600">${App.esc(item.description || item.doc_number || item.invoice_no || '—')}</td>
                  <td class="hide-m">${App.esc(item.main_category || '—')}</td>
                  <td class="hide-m">${App.esc(item.vendor_name || '—')}</td>
                  <td style="color:var(--red);font-weight:700">-${App.formatMoney(item.total_amount)}</td>
                  <td>${statusHtml}</td>
                  <td>${editHtml}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function s6GoEditExpense(date) {
    App.go('expense', { date: date });
  }

  function s6GoEditInvoice(id) {
    App.go('invoice-form', { edit_id: id });
  }

  function s6ChangeMonth(delta) {
    const [y, m] = s6.month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    s6.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    s6.dateFrom = `${s6.month}-01`;
    s6.dateTo = `${s6.month}-${String(daysInMonth).padStart(2, '0')}`;
    App.go('expense-history');
  }


  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatMonthLabel(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[m - 1]} ${y}`;
  }


  // ════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════

  return {
    // S4 Cash
    renderCash, loadCash,
    s4Validate, s4PickPhoto, s4HandlePhoto,
    s4Submit, s4Confirm,
    s4ChangeDate, s4GoToday,

    // S5 Sale History
    renderSaleHistory, loadSaleHistory,
    s5ChangeMonth, s5DateRange, s5GoEdit,

    // S6 Expense History
    renderExpenseHistory, loadExpenseHistory,
    s6SetFilter, s6ChangeMonth, s6DateRange,
    s6GoEditExpense, s6GoEditInvoice,
  };
})();
