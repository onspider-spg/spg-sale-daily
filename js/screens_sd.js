// Version 2.5 | 8 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens_sd.js — S0 Dashboard + S1 Daily Sale + Profile
 * v2.0 — Phase 11: Dashboard anomaly T1/T4 + SPG Topbar
 * ═══════════════════════════════════════════
 */

const Screens = (() => {

  // ════════════════════════════════════════
  // TOPBAR HELPER — SPG Standard
  // ════════════════════════════════════════

  /**
   * renderTopbar({ back, label })
   *   back  = null → ☰ hamburger (dashboard)
   *   back  = 'dashboard' → ← back to dashboard
   *   label = optional sub-label after title e.g. "Daily Sale"
   */
  function renderTopbar(opts = {}) {
    const s = API.getSession();
    const initial = s ? (s.display_name || '?').charAt(0).toUpperCase() : '?';
    const hasNoti = false; // will be updated by loadDashboard

    const leftBtn = opts.back
      ? `<button class="g-tb-back" onclick="App.go('${App.esc(opts.back)}')">←</button>`
      : `<button class="g-tb-ham" onclick="App.openSidebar()"><div class="g-tb-ham-lines"><span></span><span></span><span></span></div></button>`;

    const titleText = opts.label
      ? `ยอดขายรายวัน : ${App.esc(opts.label)}`
      : 'ยอดขายรายวัน';

    return `
      <div class="g-tb">
        ${leftBtn}
        <div class="g-tb-logo" onclick="location.href='/spg-home/#dashboard'" style="cursor:pointer">SPG</div>
        <div class="g-tb-title">${titleText}<div class="g-tb-sub">Sale Daily</div></div>
        <div class="g-tb-bell" onclick="App.go('notifications')">🔔<span class="g-tb-bell-dot" id="tb-bell-dot" style="display:none"></span></div>
        <div class="g-tb-avatar" onclick="Screens.showProfilePopup()" style="cursor:pointer">${App.esc(initial)}</div>
      </div>`;
  }

  // ════════════════════════════════════════
  // LOADING / NO ACCESS / COMING SOON
  // ════════════════════════════════════════

  function renderLoading() {
    return `
      <div class="screen">
        <div class="screen-body" style="display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center">
            <div class="loader-spinner" style="margin:0 auto 16px"></div>
            <div style="color:var(--td);font-size:var(--fs-body)">กำลังโหลด Sale Daily...</div>
          </div>
        </div>
      </div>`;
  }

  function renderNoAccess() {
    return `
      <div class="screen">
        <div class="screen-body" style="display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:var(--sp-sm)">🔒</div>
            <div style="font-size:var(--fs-h1);font-weight:700;color:var(--red);margin-bottom:var(--sp-sm)">No Access</div>
            <div style="font-size:var(--fs-body);color:var(--tm);margin-bottom:var(--sp-md)">
              คุณไม่มีสิทธิ์เข้าถึง module นี้<br>กรุณาติดต่อ Admin เพื่อขอสิทธิ์
            </div>
            <button class="btn btn-gold" onclick="App.goHome()">← กลับ Home</button>
          </div>
        </div>
      </div>`;
  }

  function renderComingSoon(title, code) {
    const session = API.getSession();
    return `
      <div class="screen">
        ${renderTopbar({ back: 'dashboard', label: title })}
        <div class="screen-body">
          <div class="empty-state">
            <div class="empty-icon">🚧</div>
            <div class="empty-text">Coming Soon</div>
            <div class="empty-sub">อยู่ระหว่างพัฒนา</div>
          </div>
        </div>
      </div>`;
  }


  // ════════════════════════════════════════
  // S0: DASHBOARD — Routes to T1 or T4
  // ════════════════════════════════════════

  function renderDashboard() {
    const s = API.getSession();
    if (!s) return renderNoAccess();

    const tierLevel = s.tier_level || parseInt((s.tier_id || 'T9').replace('T', ''));
    const isAdmin = tierLevel <= 2 || s.store_id === 'HQ';

    return isAdmin ? renderDashboardT1(s) : renderDashboardT4(s);
  }

  // ─── T1 Admin Dashboard (wireframe: s0-dash) ───
  function renderDashboardT1(s) {
    return `
      <div class="screen">
        ${renderTopbar()}
        <div class="screen-body">

          <!-- Tier badge -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
            <div style="font-size:var(--fs-sm);font-weight:700">📊 Dashboard</div>
            <span class="tag gold">T1 — ${App.esc(s.display_name)} · HQ</span>
          </div>

          <!-- Store selector -->
          ${App.renderStoreSelector()}

          <!-- KPI Row: 2fr + 1fr + 1fr + 1fr -->
          <div id="kpi-area">
            <div class="kpi-grid kpi-grid-t1">
              <div class="kpi-box highlight" id="kpi-today" style="border-left:4px solid var(--gold)">
                <div class="kpi-label"><span class="live"></span>Total Today</div>
                <div class="kpi-value gold" id="kpi-today-value" style="font-size:24px">—</div>
                <div class="kpi-sub" id="kpi-today-sub">กำลังโหลด...</div>
              </div>
              <div class="kpi-box" id="kpi-month">
                <div class="kpi-label">เดือนนี้</div>
                <div class="kpi-value" id="kpi-month-value" style="font-size:18px">—</div>
                <div class="kpi-sub" id="kpi-month-sub">—</div>
              </div>
              <div class="kpi-box" id="kpi-avg">
                <div class="kpi-label">เฉลี่ย/วัน</div>
                <div class="kpi-value" id="kpi-avg-value" style="font-size:18px">—</div>
                <div class="kpi-sub" id="kpi-avg-sub">—</div>
              </div>
              <div class="kpi-box" id="kpi-yesterday">
                <div class="kpi-label">Pending Sync</div>
                <div class="kpi-value" id="kpi-yesterday-value" style="font-size:18px;color:var(--orange)">—</div>
                <div class="kpi-sub" id="kpi-yesterday-sub">days</div>
              </div>
            </div>
          </div>

          <!-- Charts (Phase 12: F6) -->
          <div id="chart-area" class="dash-2col">
            <div class="card" style="padding:12px">
              <div style="font-size:var(--fs-sm);font-weight:700;color:var(--tm);text-transform:uppercase;margin-bottom:var(--sp-sm)">📈 This Week vs Last Week</div>
              <div id="chart-weekly" style="height:100px">
                <div style="text-align:center;padding:30px 0;color:var(--tm);font-size:var(--fs-xs)">กำลังโหลด...</div>
              </div>
              <div style="display:flex;gap:12px;margin-top:var(--sp-xs);font-size:var(--fs-xs)">
                <span><span style="color:var(--gold)">━━</span> สัปดาห์นี้</span>
                <span><span style="color:var(--tm)">╌╌</span> สัปดาห์ก่อน</span>
              </div>
            </div>
            <div class="card" style="padding:12px">
              <div style="font-size:var(--fs-sm);font-weight:700;color:var(--tm);text-transform:uppercase;margin-bottom:var(--sp-sm)">💰 Cash Variance (7 วัน)</div>
              <div id="chart-cash-var" style="font-size:var(--fs-sm);line-height:2">
                <div style="text-align:center;padding:30px 0;color:var(--tm);font-size:var(--fs-xs)">กำลังโหลด...</div>
              </div>
            </div>
          </div>

          <!-- Anomaly auto-detect (Phase 11: F7) -->
          <div id="anomaly-area" class="card" style="margin-bottom:var(--sp-sm)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
              <div style="font-size:var(--fs-sm);font-weight:700;color:var(--red);text-transform:uppercase">🔍 ต้องตรวจสอบ (Auto-detect)</div>
              <div style="font-size:var(--fs-xs);color:var(--tm);cursor:pointer" onclick="App.go('settings')">⚙️ ตั้งค่า Rules →</div>
            </div>
            <div id="anomaly-list" style="font-size:var(--fs-xs);color:var(--tm);text-align:center;padding:var(--sp-sm) 0">กำลังตรวจ...</div>
          </div>

          <!-- Store Status (Phase 12: F8) -->
          <div id="store-status-area" class="card" style="margin-bottom:var(--sp-sm)">
            <div style="font-size:var(--fs-sm);font-weight:700;color:var(--tm);text-transform:uppercase;margin-bottom:var(--sp-sm)">🏪 Store Status วันนี้</div>
            <div id="store-status-list" style="font-size:var(--fs-xs);color:var(--tm);text-align:center;padding:var(--sp-sm) 0">กำลังโหลด...</div>
          </div>

          <!-- History -->
          <div class="section-label">📊 History</div>
          <div class="quick-grid">
            <div class="quick-btn" onclick="App.go('sale-history')">
              <div class="q-icon" style="background:var(--gold-bg);color:var(--gold)">📊</div>
              <div><div class="q-label">Sale History</div><div class="q-sub">ประวัติขาย</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('expense-history')">
              <div class="q-icon" style="background:var(--red-bg);color:var(--red)">📋</div>
              <div><div class="q-label">Expense History</div><div class="q-sub">ประวัติจ่าย</div></div>
              <div class="q-arrow">→</div>
            </div>
          </div>

          <!-- Report -->
          <div class="section-label">📝 Report</div>
          <div class="quick-grid">
            <div class="quick-btn" onclick="App.go('daily-report')">
              <div class="q-icon" style="background:var(--orange-bg);color:var(--orange)">📝</div>
              <div><div class="q-label">Daily Report</div><div class="q-sub">สรุปรายงาน</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('tasks')">
              <div class="q-icon" style="background:var(--purple-bg);color:var(--purple)">📋</div>
              <div><div class="q-label">Follow-up</div><div class="q-sub">Tasks</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('report-hub')">
              <div class="q-icon" style="background:var(--blue-bg);color:var(--blue)">📊</div>
              <div><div class="q-label">Report Hub</div><div class="q-sub">สรุปรายเดือน</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('daily-detail')">
              <div class="q-icon" style="background:var(--s2);color:var(--td)">🔍</div>
              <div><div class="q-label">Daily Detail</div><div class="q-sub">รายละเอียดวัน</div></div>
              <div class="q-arrow">→</div>
            </div>
          </div>

          <!-- Settings -->
          <div class="section-label">⚙️ Settings</div>
          <div class="quick-grid">
            <div class="quick-btn" onclick="App.go('acc-review')" style="border-left-color:var(--green)">
              <div class="q-icon" style="background:var(--green-bg);color:var(--green)">📤</div>
              <div><div class="q-label">Send to Account</div><div class="q-sub">Sync → Finance</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('settings',{tab:'channels'})">
              <div class="q-icon" style="background:var(--gold-bg);color:var(--gold)">📡</div>
              <div><div class="q-label">Channels</div><div class="q-sub">ช่องทางขาย</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('settings',{tab:'suppliers'})">
              <div class="q-icon" style="background:var(--blue-bg);color:var(--blue)">🏪</div>
              <div><div class="q-label">Vendors</div><div class="q-sub">รายชื่อ supplier</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('settings',{tab:'categories'})">
              <div class="q-icon" style="background:var(--orange-bg);color:var(--orange)">🏷️</div>
              <div><div class="q-label">Categories</div><div class="q-sub">หมวดหมู่</div></div>
              <div class="q-arrow">→</div>
            </div>
          </div>

        </div>
      </div>`;
  }

  // ─── T4 Store Dashboard (wireframe: s0-t4) ───
  function renderDashboardT4(s) {
    return `
      <div class="screen">
        ${renderTopbar()}
        <div class="screen-body">

          <!-- Tier badge -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm)">
            <div style="font-size:var(--fs-sm);font-weight:700">📊 Dashboard</div>
            <span class="tag blue">${App.esc(s.tier_id)} — ${App.esc(s.display_name)} · ${App.esc(s.store_id)}</span>
          </div>

          <!-- KPI (my store only) -->
          <div id="kpi-area">
            <div class="kpi-grid kpi-grid-4">
              <div class="kpi-box highlight" id="kpi-today" style="border-left:4px solid var(--gold)">
                <div class="kpi-label">📊 ยอดวันนี้</div>
                <div class="kpi-value gold" id="kpi-today-value">—</div>
                <div class="kpi-sub" id="kpi-today-sub">กำลังโหลด...</div>
              </div>
              <div class="kpi-box" id="kpi-month">
                <div class="kpi-label">📅 เดือนนี้</div>
                <div class="kpi-value" id="kpi-month-value" style="font-size:18px">—</div>
                <div class="kpi-sub" id="kpi-month-sub">—</div>
              </div>
              <div class="kpi-box" id="kpi-avg">
                <div class="kpi-label">📈 เฉลี่ย</div>
                <div class="kpi-value" id="kpi-avg-value" style="font-size:18px">—</div>
                <div class="kpi-sub" id="kpi-avg-sub">—</div>
              </div>
              <div class="kpi-box" id="kpi-yesterday">
                <div class="kpi-label">📉 เมื่อวาน</div>
                <div class="kpi-value" id="kpi-yesterday-value" style="font-size:18px">—</div>
                <div class="kpi-sub" id="kpi-yesterday-sub">—</div>
              </div>
            </div>
          </div>

          <!-- 7-day bar chart -->
          <div class="section-label">ยอดขาย 7 วัน</div>
          <div class="card">
            <div class="mini-chart" id="mini-chart">
              ${Array(7).fill('<div class="mini-bar" style="height:20%"></div>').join('')}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--tm);margin-top:var(--sp-xs)">
              <span id="chart-label-start">—</span>
              <span id="chart-label-end">วันนี้</span>
            </div>
          </div>

          <!-- กรอกข้อมูล -->
          <div class="section-label">กรอกข้อมูล</div>
          <div class="quick-grid">
            <div class="quick-btn" onclick="App.go('daily-sale')" style="border-left-color:var(--gold)">
              <div class="q-icon" style="background:var(--gold-bg);color:var(--gold)">💰</div>
              <div><div class="q-label">กรอกยอดขาย</div><div class="q-sub">S1 Daily Sale</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('expense')">
              <div class="q-icon" style="background:var(--red-bg);color:var(--red)">🧾</div>
              <div><div class="q-label">ค่าใช้จ่าย</div><div class="q-sub">S2 Expense</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('invoice')">
              <div class="q-icon" style="background:var(--blue-bg);color:var(--blue)">📄</div>
              <div><div class="q-label">Invoice</div><div class="q-sub">S3 Invoice</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('cash')">
              <div class="q-icon" style="background:var(--green-bg);color:var(--green)">💵</div>
              <div><div class="q-label">เงินสดส่งมอบ</div><div class="q-sub">S4 Cash</div></div>
              <div class="q-arrow">→</div>
            </div>
          </div>

          <!-- History & Report -->
          <div class="section-label">History & Report</div>
          <div class="quick-grid">
            <div class="quick-btn" onclick="App.go('sale-history')">
              <div class="q-icon" style="background:var(--s2);color:var(--td)">📊</div>
              <div><div class="q-label">ประวัติขาย</div><div class="q-sub">S5</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('expense-history')">
              <div class="q-icon" style="background:var(--s2);color:var(--td)">📋</div>
              <div><div class="q-label">ประวัติจ่าย</div><div class="q-sub">S6</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('daily-report')">
              <div class="q-icon" style="background:var(--orange-bg);color:var(--orange)">📝</div>
              <div><div class="q-label">สรุปรายงาน</div><div class="q-sub">S8 Daily Report</div></div>
              <div class="q-arrow">→</div>
            </div>
            <div class="quick-btn" onclick="App.go('tasks')">
              <div class="q-icon" style="background:var(--purple-bg);color:var(--purple)">📋</div>
              <div><div class="q-label">Follow-up</div><div class="q-sub">Tasks</div></div>
              <div class="q-arrow">→</div>
            </div>
          </div>

        </div>
      </div>`;
  }


  // ════════════════════════════════════════
  // S0: LOAD DASHBOARD (shared T1 + T4)
  // ════════════════════════════════════════

  async function loadDashboard() {
    try {
      let data;
      if (window._sdDashboardCache) {
        data = window._sdDashboardCache;
        window._sdDashboardCache = null;
      } else {
        data = await API.getDashboard();
      }

      // KPI: Today
      const todayEl = document.getElementById('kpi-today-value');
      const todaySub = document.getElementById('kpi-today-sub');
      if (todayEl) {
        if (data.today.is_recorded) {
          todayEl.textContent = App.formatMoney(data.today.total_sales);
          todayEl.className = 'kpi-value gold';
          const syncIcon = data.today.fin_synced ? '✅ synced' : '⏳ Pending';
          todaySub.textContent = syncIcon;
        } else {
          todayEl.textContent = '—';
          todaySub.innerHTML = '<span style="color:var(--red)">⚠️ ยังไม่ได้กรอก</span>';
        }
      }

      // KPI: Month
      const monthEl = document.getElementById('kpi-month-value');
      const monthSub = document.getElementById('kpi-month-sub');
      if (monthEl) {
        monthEl.textContent = App.formatMoneyShort(data.month.total);
        monthSub.textContent = `${data.month.days_recorded} วัน`;
      }

      // KPI: Average
      const avgEl = document.getElementById('kpi-avg-value');
      const avgSub = document.getElementById('kpi-avg-sub');
      if (avgEl) {
        avgEl.textContent = App.formatMoney(data.month.daily_average);
        avgSub.textContent = App.esc(API.getSession()?.store_id || '');
      }

      // KPI: Yesterday (T4) / Pending Sync (T1)
      const yestEl = document.getElementById('kpi-yesterday-value');
      const yestSub = document.getElementById('kpi-yesterday-sub');
      if (yestEl) {
        const s = API.getSession();
        const isAdmin = (s?.tier_level || 9) <= 2 || s?.store_id === 'HQ';

        if (isAdmin) {
          // T1: show pending sync count
          const pending = data.alerts?.pending_sync || 0;
          yestEl.textContent = pending;
          yestEl.style.color = pending > 0 ? 'var(--orange)' : 'var(--green)';
          yestSub.textContent = 'days';
        } else {
          // T4: show yesterday's sales
          if (data.yesterday.total_sales > 0) {
            yestEl.textContent = App.formatMoney(data.yesterday.total_sales);
            yestEl.style.color = '';
            if (data.today.is_recorded && data.today.total_sales > 0) {
              const diff = data.today.total_sales - data.yesterday.total_sales;
              const pct = ((diff / data.yesterday.total_sales) * 100).toFixed(0);
              yestSub.innerHTML = diff >= 0
                ? `<span style="color:var(--green)">▲ ${pct}%</span>`
                : `<span style="color:var(--red)">▼ ${Math.abs(pct)}%</span>`;
            } else {
              yestSub.textContent = data.yesterday.date || '';
            }
          } else {
            yestEl.textContent = '—';
            yestSub.textContent = 'ไม่มีข้อมูล';
          }
        }
      }

      // Mini Chart (T4 only — check if element exists)
      const chartEl = document.getElementById('mini-chart');
      const breakdown = data.month.daily_breakdown || [];
      if (chartEl && breakdown.length > 0) {
        const maxSale = Math.max(...breakdown.map(d => d.total_sales || 0), 1);
        const bars = breakdown.slice(0, 7).reverse();
        chartEl.innerHTML = bars.map((d) => {
          const pct = Math.max(((d.total_sales || 0) / maxSale) * 100, 4);
          const isToday = d.sale_date === App.todayStr();
          return `<div class="mini-bar ${isToday ? 'today' : ''}" style="height:${pct}%"
                       title="${App.formatDateShort(d.sale_date)}: ${App.formatMoney(d.total_sales)}"></div>`;
        }).join('');

        const startLabel = document.getElementById('chart-label-start');
        if (startLabel && bars.length > 0) startLabel.textContent = App.formatDateShort(bars[0].sale_date);
      }

      // Update noti bell dot
      App.refreshNotiBadge();

      // Load T1 admin sections in PARALLEL (anomalies + chart + cash + store status)
      const session = API.getSession();
      const isAdmin = (session?.tier_level || 9) <= 2 || session?.store_id === 'HQ';
      if (isAdmin) {
        const [aRes, wRes, cvRes, ssRes] = await Promise.allSettled([
          API.getAnomalies(),
          API.getWeeklyComparison(),
          API.getCashVarianceHistory(7),
          API.getStoreStatus(),
        ]);

        // ── Anomalies ──
        const anomalyEl = document.getElementById('anomaly-list');
        if (anomalyEl) {
          if (aRes.status === 'fulfilled') {
            const anomalies = aRes.value.anomalies || [];
            if (anomalies.length === 0) {
              anomalyEl.innerHTML = '<div style="text-align:center;padding:var(--sp-sm);color:var(--green);font-size:var(--fs-sm)">✅ ไม่มีสิ่งผิดปกติ</div>';
            } else {
              anomalyEl.innerHTML = anomalies.map(a => {
                const sevIcon = a.severity === 'danger' ? '🔴' : a.severity === 'warn' ? '🟡' : '🔵';
                return `<div class="anomaly-card ${a.severity === 'danger' ? 'danger' : a.severity === 'warn' ? 'warn' : 'info'}">
                  <div style="flex:1">
                    <div style="font-weight:700">${sevIcon} ${App.esc(a.message)}</div>
                    <div style="font-size:var(--fs-xs);color:var(--tm);margin-top:2px">${App.esc(a.detail)} · ${App.esc(a.store_id)}</div>
                  </div>
                  <button class="btn btn-sm btn-outline" style="padding:2px 8px;font-size:var(--fs-xs)" onclick="App.go('daily-detail',{date:'${a.date}'})">Review</button>
                </div>`;
              }).join('');
            }
          } else { anomalyEl.innerHTML = '<div style="font-size:var(--fs-xs);color:var(--tm)">—</div>'; }
        }

        // ── Weekly chart (line) ──
        const chartEl2 = document.getElementById('chart-weekly');
        if (chartEl2 && wRes.status === 'fulfilled') {
          try {
            const tw = wRes.value.this_week || [];
            const lw = wRes.value.last_week || [];
            const labels = wRes.value.labels || [];
            const maxVal = Math.max(...tw, ...lw, 1);
            const W = 240, H = 90, pad = 4;
            const stepX = (W - pad * 2) / Math.max(labels.length - 1, 1);
            const twPts = labels.map((_, i) => `${pad + i * stepX},${H - pad - (maxVal > 0 ? (tw[i] / maxVal) * (H - pad * 2) : 0)}`).join(' ');
            const lwPts = labels.map((_, i) => `${pad + i * stepX},${H - pad - (maxVal > 0 ? (lw[i] / maxVal) * (H - pad * 2) : 0)}`).join(' ');
            let svg = `<svg width="100%" height="${H + 16}" viewBox="0 0 ${W} ${H + 16}" preserveAspectRatio="xMidYMid meet">`;
            for (let g = 0; g <= 3; g++) { const gy = pad + g * ((H - pad * 2) / 3); svg += `<line x1="${pad}" y1="${gy}" x2="${W - pad}" y2="${gy}" stroke="var(--bd2)" stroke-width="0.5"/>`; }
            svg += `<polyline points="${lwPts}" fill="none" stroke="var(--s2)" stroke-width="2" stroke-dasharray="4,3"/>`;
            svg += `<polyline points="${twPts}" fill="none" stroke="var(--gold)" stroke-width="2.5"/>`;
            labels.forEach((_, i) => { if (tw[i] > 0) { svg += `<circle cx="${pad + i * stepX}" cy="${H - pad - (tw[i] / maxVal) * (H - pad * 2)}" r="3" fill="var(--gold)"/>`; } });
            labels.forEach((l, i) => { svg += `<text x="${pad + i * stepX}" y="${H + 12}" text-anchor="middle" fill="var(--tm)" style="font-size:8px">${l}</text>`; });
            svg += `</svg>`;
            chartEl2.innerHTML = svg;
          } catch (e) { chartEl2.innerHTML = '<div style="font-size:var(--fs-xs);color:var(--tm)">—</div>'; }
        }

        // ── Cash variance ──
        const cashChartEl = document.getElementById('chart-cash-var');
        if (cashChartEl && cvRes.status === 'fulfilled') {
          const items = cvRes.value.items || [];
          if (items.length === 0) { cashChartEl.innerHTML = '<div style="text-align:center;color:var(--tm)">ไม่มีข้อมูล</div>'; }
          else { cashChartEl.innerHTML = items.slice(0, 7).map(c => `<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs)"><span>${c.store_id} · ${c.date.slice(5)}</span><span style="color:${c.is_matched ? 'var(--green)' : 'var(--red)'}">${c.is_matched ? '✅' : '🔴'} ${c.variance >= 0 ? '+' : ''}$${(c.variance||0).toFixed(2)}</span></div>`).join(''); }
        }

        // ── Store status ──
        const storeStatusEl = document.getElementById('store-status-list');
        if (storeStatusEl && ssRes.status === 'fulfilled') {
          const stores = ssRes.value.stores || [];
          if (stores.length === 0) { storeStatusEl.innerHTML = '<div style="text-align:center;color:var(--tm)">ไม่มีข้อมูล</div>'; }
          else {
            const statusMap = { locked: '🔒 Locked', synced: '✅ Synced', recorded: '📝 Recorded', not_recorded: '⚪ ยังไม่กรอก' };
            const statusColor = { locked: 'var(--tm)', synced: 'var(--green)', recorded: 'var(--gold)', not_recorded: 'var(--red)' };
            storeStatusEl.innerHTML = `<div style="overflow-x:auto"><table><thead><tr><th>Store</th><th>Sales</th><th>Cash</th><th>Status</th></tr></thead><tbody>` +
              stores.map(st => `<tr style="color:${statusColor[st.status] || 'var(--tm)'}"><td style="font-weight:600">${App.esc(st.store_name || st.store_id)}</td><td>${st.total_sales !== null ? '$' + (st.total_sales||0).toLocaleString() : '—'}</td><td>${st.cash_matched === true ? '✅' : st.cash_matched === false ? '🔴' : '—'}${st.cash_variance !== null ? ' $' + (st.cash_variance||0).toFixed(2) : ''}</td><td>${statusMap[st.status] || st.status}</td></tr>`).join('') +
              `</tbody></table></div>`;
          }
        }
      }

    } catch (err) {
      console.error('Dashboard load error:', err);
      App.toast('โหลด Dashboard ไม่สำเร็จ', 'error');
    }
  }


  // ════════════════════════════════════════
  // S1: DAILY SALE INPUT
  // ════════════════════════════════════════

  let s1 = {
    date: null,
    channels: [],
    amounts: {},
    photoCardUrl: null,
    photoCashUrl: null,
    extraPhotos: [],
    existingSale: null,
    isLocked: false,
  };

  function renderDailySale(params) {
    const session = API.getSession();
    if (!session) return renderNoAccess();

    const date = params?.date || App.todayStr();
    s1.date = date;

    return `
      <div class="screen">
        ${renderTopbar({ back: 'dashboard', label: 'Daily Sale' })}

        <div class="screen-body">
          ${App.renderStoreSelector()}

          <!-- Date Navigation -->
          <div class="date-bar">
            <button class="date-nav" onclick="Screens.s1ChangeDate(-1)">‹</button>
            <div class="date-display">
              <span id="s1-date-label">${App.formatDate(date)}</span>
              <span style="font-size:var(--fs-xs);color:var(--tm)" id="s1-date-sub"></span>
            </div>
            <button class="date-nav" onclick="Screens.s1ChangeDate(1)">›</button>
            <button class="date-today" onclick="Screens.s1GoToday()">วันนี้</button>
          </div>

          <!-- Status -->
          <div id="s1-status"></div>

          <!-- Channel Inputs -->
          <div class="section-label">ช่องทางขาย</div>
          <div id="s1-channels">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด channels...</div>
          </div>

          <!-- Total -->
          <div style="padding:12px var(--sp-md);background:var(--gold-bg);border:1.5px solid var(--gold);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center;margin:var(--sp-sm) 0">
            <span style="font-size:var(--fs-sm);font-weight:700;color:var(--gold)">ยอดรวมทั้งหมด</span>
            <span style="font-size:22px;font-weight:800;color:var(--gold)" id="s1-total">$0.00</span>
          </div>

          <!-- Cancel / ผลต่าง -->
          <details style="margin-bottom:var(--sp-sm);border:1px solid var(--bd2);border-radius:var(--radius-sm);padding:var(--sp-sm)">
            <summary style="font-size:var(--fs-body);font-weight:600;color:var(--td);cursor:pointer">▸ Cancel / ผลต่าง (ถ้ามี)</summary>
            <div style="padding-top:var(--sp-sm)">
              <div class="form-group">
                <label class="form-label">Cancel Amount</label>
                <input type="number" step="0.01" class="form-input" id="s1-cancel-amount" placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Reason</label>
                <input type="text" class="form-input" id="s1-cancel-reason" placeholder="เหตุผล">
              </div>
              <div class="form-group">
                <label class="form-label">ผลต่าง (Difference)</label>
                <input type="number" step="0.01" class="form-input" id="s1-difference" placeholder="0.00" oninput="Screens.s1RecalcTotal()">
              </div>
              <div class="form-group">
                <label class="form-label">Cancel Description</label>
                <input type="text" class="form-input" id="s1-cancel-desc" placeholder="รายละเอียด">
              </div>
            </div>
          </details>

          <!-- Photo Upload -->
          <div class="section-label">📸 Photo (mandatory)</div>
          <div class="photo-grid">
            <div class="photo-box empty" id="s1-photo-card" onclick="Screens.s1PickPhoto('card')">
              <div class="photo-icon">📸</div>
              <div class="photo-label">Card Summary</div>
              <div class="photo-required">* บังคับ</div>
            </div>
            <div style="flex:1;font-size:var(--fs-xs);color:var(--tm);display:flex;align-items:center">auto compress</div>
          </div>
          <div id="s1-extra-photos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
          <button type="button" class="btn btn-sm btn-outline" onclick="Screens.s1PickPhoto('extra')" style="margin-top:4px;font-size:var(--fs-xs)">+ เพิ่มรูป</button>
          <input type="file" id="s1-file-input" accept="image/*" capture="environment" style="display:none"
                 onchange="Screens.s1HandlePhoto(event)">
        </div>

        <!-- Bottom Save -->
        <div class="bottom-bar">
          <button class="btn btn-gold" style="flex:1" id="s1-save-btn" onclick="Screens.s1Save()">💾 Save</button>
        </div>
      </div>`;
  }

  async function loadDailySale(params) {
    const date = params?.date || s1.date || App.todayStr();
    s1.date = date;

    try {
      App.showLoader();
      const data = await API.getDailySale(date);

      s1.channels = data.channels || [];
      s1.existingSale = data.sale || null;
      s1.isLocked = data.sale?.is_locked || false;

      s1.amounts = {};
      if (data.sale?.sd_sale_channels) {
        data.sale.sd_sale_channels.forEach(ch => {
          s1.amounts[ch.channel_key] = ch.amount;
        });
      }

      s1.photoCardUrl = data.sale?.photo_card_url || null;
      s1.photoCashUrl = data.sale?.photo_cash_url || null;

      renderS1Channels();
      renderS1Status(data);
      renderS1Photos();
      s1RecalcTotal();

      if (data.sale) {
        setVal('s1-difference', data.sale.difference);
        setVal('s1-cancel-amount', data.sale.cancel_amount);
        setVal('s1-cancel-desc', data.sale.cancel_desc);
        setVal('s1-cancel-reason', data.sale.cancel_reason);
      }

      const label = document.getElementById('s1-date-label');
      if (label) label.textContent = App.formatDate(date);

      const sub = document.getElementById('s1-date-sub');
      if (sub) {
        if (date === App.todayStr()) sub.textContent = '(วันนี้)';
        else if (date === App.addDays(App.todayStr(), -1)) sub.textContent = '(เมื่อวาน)';
        else sub.textContent = '';
      }

    } catch (err) {
      console.error('Load daily sale error:', err);
      App.toast('โหลดข้อมูลไม่สำเร็จ', 'error');
    } finally {
      App.hideLoader();
    }
  }

  function renderS1Channels() {
    const container = document.getElementById('s1-channels');
    if (!container || !s1.channels.length) {
      if (container) container.innerHTML = '<div class="empty-state"><div class="empty-text">ไม่มี channel config</div></div>';
      return;
    }

    const iconMap = {
      'card_sale': '💳',
      'cash_sale': '💵',
      'delivery_sale': '🛵',
      'other': '📦',
    };

    container.innerHTML = s1.channels.map(ch => {
      const icon = iconMap[ch.dashboard_group] || '📦';
      const amount = s1.amounts[ch.channel_key] || '';
      const hasVal = parseFloat(amount) > 0;

      return `
        <div style="display:flex;align-items:center;gap:var(--sp-sm);padding:var(--sp-sm) 12px;background:var(--bg);border:1px solid var(--bd2);border-radius:var(--radius-sm);margin-bottom:var(--sp-xs)">
          <div style="font-size:var(--fs-body)">${icon}</div>
          <div style="flex:1">
            <div style="font-size:var(--fs-body);font-weight:600">${App.esc(ch.channel_label)}</div>
            ${ch.finance_sub_category ? `<div style="font-size:var(--fs-xs);color:var(--tm)">${App.esc(ch.finance_sub_category)}</div>` : ''}
          </div>
          <input type="number" step="0.01" min="0"
                 class="form-input" style="width:90px;font-size:var(--fs-body);font-weight:700;text-align:right;padding:var(--sp-xs) var(--sp-sm)"
                 id="ch-${ch.channel_key}"
                 value="${amount}"
                 placeholder="0"
                 oninput="Screens.s1OnChannelInput('${ch.channel_key}', this)"
                 ${s1.isLocked ? 'disabled' : ''}>
        </div>`;
    }).join('');
  }

  function renderS1Status(data) {
    const el = document.getElementById('s1-status');
    if (!el) return;

    const session = API.getSession();
    const canSync = session && (session.tier_level <= 2 || session.store_id === 'HQ');
    const canUnlock = session && (session.tier_level <= 3 || session.store_id === 'HQ');

    if (data.is_new) {
      el.innerHTML = '<div class="alert-row info"><span class="alert-icon">🆕</span><span class="alert-text">ยังไม่มีข้อมูลวันนี้ — กรอกใหม่</span></div>';
    } else if (data.sale?.is_locked) {
      el.innerHTML = `
        <div class="alert-row danger">
          <span class="alert-icon">🔒</span>
          <span class="alert-text" style="flex:1">Synced & ล็อคแล้ว</span>
          ${canUnlock ? `<button class="btn btn-sm btn-outline" onclick="Screens.unlockSale()">🔓 ปลดล็อค</button>` : ''}
        </div>`;
    } else {
      const syncText = data.sale?.fin_synced ? '✅ synced' : '⏳ Pending';
      el.innerHTML = `
        <div class="alert-row" style="background:var(--green-bg);color:var(--green);display:flex;align-items:center;gap:var(--sp-sm)">
          <span class="alert-icon">📝</span>
          <span class="alert-text" style="flex:1">มีข้อมูลแล้ว · ${syncText}</span>
          ${canSync && !data.sale?.fin_synced ? `<button class="btn btn-sm btn-gold" onclick="Screens.syncSale()">🔒 Sync</button>` : ''}
        </div>`;
    }
  }

  function renderS1Photos() {
    const cardBox = document.getElementById('s1-photo-card');
    if (cardBox && s1.photoCardUrl) {
      cardBox.classList.remove('empty');
      cardBox.classList.add('filled');
      cardBox.innerHTML = `<img src="${s1.photoCardUrl}" alt="Card" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-xs)"><div style="position:absolute;bottom:2px;right:2px;background:var(--green);color:#fff;width:16px;height:16px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center">✓</div>`;
    }
  }

  function s1OnChannelInput(channelKey, inputEl) {
    const val = parseFloat(inputEl.value) || 0;
    s1.amounts[channelKey] = val;
    s1RecalcTotal();
  }

  function s1RecalcTotal() {
    const total = Object.values(s1.amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    const totalEl = document.getElementById('s1-total');
    if (totalEl) totalEl.textContent = App.formatMoney(total);
  }

  function s1ChangeDate(delta) {
    const newDate = App.addDays(s1.date, delta);
    if (newDate > App.todayStr()) {
      App.toast('ไม่สามารถกรอกวันในอนาคต', 'warn');
      return;
    }
    s1.date = newDate;
    App.go('daily-sale', { date: newDate });
  }

  function s1GoToday() {
    s1.date = App.todayStr();
    App.go('daily-sale', { date: App.todayStr() });
  }

  let _photoTarget = null;

  function s1PickPhoto(target) {
    if (s1.isLocked) {
      App.toast('ล็อคอยู่ — ไม่สามารถแก้ไข', 'warn');
      return;
    }
    _photoTarget = target;
    document.getElementById('s1-file-input')?.click();
  }

  async function syncSale() {
    if (!confirm('🔒 Sync & ล็อคยอดขายวันนี้?\n\nหลังจาก Sync จะไม่สามารถแก้ไขได้')) return;
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      await API.syncSale(storeId, s1.date);
      App.toast('🔒 Sync สำเร็จ', 'success');
      App.go('daily-sale', { date: s1.date });
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }

  async function unlockSale() {
    if (!confirm('🔓 ปลดล็อคยอดขายวันนี้?')) return;
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      await API.unlockSale(storeId, s1.date);
      App.toast('🔓 ปลดล็อคแล้ว', 'success');
      App.go('daily-sale', { date: s1.date });
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }

  async function s1HandlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      App.showLoader();
      const result = await API.uploadPhoto(file, 'sale');

      if (_photoTarget === 'card') {
        s1.photoCardUrl = result.url;
      } else if (_photoTarget === 'extra') {
        s1.extraPhotos.push(result.url);
      }

      renderS1Photos();
      // Render extra thumbnails
      const extraEl = document.getElementById('s1-extra-photos');
      if (extraEl) {
        extraEl.innerHTML = s1.extraPhotos.map((url, i) =>
          `<div style="position:relative;width:60px;height:60px;border-radius:6px;overflow:hidden;border:1px solid var(--bd)">
            <img src="${url}" style="width:100%;height:100%;object-fit:cover">
            <div style="position:absolute;top:0;right:0;background:var(--red);color:#fff;width:16px;height:16px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="Screens.s1RemoveExtra(${i})">×</div>
          </div>`
        ).join('');
      }
      App.toast('อัพโหลดสำเร็จ ✓', 'success');
    } catch (err) {
      console.error('Photo upload error:', err);
      App.toast('อัพโหลดไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      event.target.value = '';
    }
  }

  function s1RemoveExtra(index) {
    s1.extraPhotos.splice(index, 1);
    const extraEl = document.getElementById('s1-extra-photos');
    if (extraEl) {
      extraEl.innerHTML = s1.extraPhotos.map((url, i) =>
        `<div style="position:relative;width:60px;height:60px;border-radius:6px;overflow:hidden;border:1px solid var(--bd)">
          <img src="${url}" style="width:100%;height:100%;object-fit:cover">
          <div style="position:absolute;top:0;right:0;background:var(--red);color:#fff;width:16px;height:16px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="Screens.s1RemoveExtra(${i})">×</div>
        </div>`
      ).join('');
    }
  }

  async function s1Save() {
    if (!s1.photoCardUrl) { App.toast('กรุณาถ่ายรูป Card Summary', 'error'); return; }

    const totalAmount = Object.values(s1.amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    if (totalAmount <= 0) { App.toast('ยอดขายรวมต้องมากกว่า 0', 'error'); return; }

    const channels = {};
    s1.channels.forEach(ch => {
      channels[ch.channel_key] = parseFloat(s1.amounts[ch.channel_key]) || 0;
    });

    try {
      App.showLoader();
      const saveBtn = document.getElementById('s1-save-btn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ กำลังบันทึก...'; }

      const result = await API.saveDailySale({
        sale_date: s1.date,
        channels,
        photo_card_url: s1.photoCardUrl,
        photo_cash_url: null,
        extra_photos: s1.extraPhotos.length > 0 ? s1.extraPhotos : null,
        difference: getVal('s1-difference'),
        cancel_desc: getVal('s1-cancel-desc'),
        cancel_amount: getVal('s1-cancel-amount'),
        cancel_reason: getVal('s1-cancel-reason'),
      });

      const isUpdate = result.is_update ? 'อัพเดต' : 'บันทึก';
      App.toast(`${isUpdate}สำเร็จ ✓`, 'success');
      setTimeout(() => App.go('dashboard'), 500);

    } catch (err) {
      console.error('Save error:', err);
      App.toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      const saveBtn = document.getElementById('s1-save-btn');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save'; }
    }
  }


  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : null;
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val != null) el.value = val;
  }


  // ════════════════════════════════════════
  // PROFILE
  // ════════════════════════════════════════

  function showProfilePopup() {
    const s = API.getSession();
    if (!s) return;
    // Remove existing popup
    const exist = document.getElementById('profile-popup-overlay');
    if (exist) { exist.remove(); return; }

    const initial = (s.display_name || '?').charAt(0).toUpperCase();
    const tierNames = { 'T1': 'Super Admin', 'T2': 'Admin', 'T3': 'Senior Manager', 'T4': 'Manager', 'T5': 'Senior Staff', 'T6': 'Junior Staff', 'T7': 'Viewer' };
    const tierName = tierNames[s.tier_id] || s.tier_id;

    const overlay = document.createElement('div');
    overlay.id = 'profile-popup-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.3)';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="position:absolute;top:60px;right:12px;width:280px;background:var(--bg);border-radius:var(--radius);box-shadow:var(--shadow-md);padding:16px;animation:fadeIn .15s">
        <div style="text-align:center;margin-bottom:12px">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--gold-bg2),#f9e8c0);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:var(--gold);margin:0 auto">${App.esc(initial)}</div>
          <div style="font-size:var(--fs-body);font-weight:700;margin-top:6px">${App.esc(s.display_name)}</div>
          <div style="font-size:var(--fs-xs);color:var(--tm)">${App.esc(s.tier_id)} — ${App.esc(tierName)}</div>
        </div>
        <div style="font-size:var(--fs-sm);border-top:1px solid var(--bd2);padding-top:10px">
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--tm)">Store</span><span style="font-weight:500">${App.esc(s.store_name || s.store_id)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--tm)">Access</span><span class="tag ${s.access_level === 'super_admin' || s.access_level === 'admin' ? 'gold' : 'gray'}">${App.esc(s.access_level)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:var(--tm)">Account</span><span style="font-size:var(--fs-xs)">${App.esc(s.account_id)}</span></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }


  // ════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════

  return {
    renderLoading, renderNoAccess, renderComingSoon,
    renderTopbar,

    // S0 Dashboard
    renderDashboard, loadDashboard,

    // Profile
    showProfilePopup,

    // S1 Daily Sale
    renderDailySale, loadDailySale,
    s1ChangeDate, s1GoToday,
    s1OnChannelInput, s1RecalcTotal,
    s1PickPhoto, s1HandlePhoto, s1RemoveExtra,
    syncSale, unlockSale,
    s1Save,
  };
})();
