/**
 * ═══════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens_sd.js — All Screen Renderers
 * v1.0 — Sprint 1: S0 Dashboard + S1 Daily Sale
 * ═══════════════════════════════════════════
 */

const Screens = (() => {

  // ════════════════════════════════════════
  // LOADING / NO ACCESS / COMING SOON
  // ════════════════════════════════════════

  function renderLoading() {
    return `
      <div class="screen">
        <div class="screen-body" style="display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center">
            <div class="loader-spinner" style="margin:0 auto 16px"></div>
            <div style="color:var(--td);font-size:14px">กำลังโหลด Sale Daily...</div>
          </div>
        </div>
      </div>`;
  }

  function renderNoAccess() {
    return `
      <div class="screen">
        <div class="screen-body" style="display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;padding:40px">
            <div style="font-size:48px;margin-bottom:12px">🔒</div>
            <div style="font-size:18px;font-weight:600;margin-bottom:8px">ไม่สามารถเข้าถึงได้</div>
            <div style="font-size:13px;color:var(--td);margin-bottom:20px">
              กรุณาเข้าผ่าน SPG Home Module<br>
              หรือ session หมดอายุ กรุณา login ใหม่
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
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div>
            <div class="header-title">${App.esc(title)}</div>
            <div class="header-sub">${code} — ${App.esc(session?.store_name || '')}</div>
          </div>
        </div>
        <div class="screen-body">
          <div class="empty-state">
            <div class="empty-icon">🚧</div>
            <div class="empty-text">Coming Soon</div>
            <div class="empty-sub">อยู่ระหว่างพัฒนา — Sprint 2-4</div>
          </div>
        </div>
      </div>`;
  }


  // ════════════════════════════════════════
  // S0: DASHBOARD
  // ════════════════════════════════════════

  function renderDashboard() {
    const s = API.getSession();
    if (!s) return renderNoAccess();

    return `
      <div class="screen">
        <!-- Header -->
        <div class="header-bar">
          <button class="back-btn" onclick="App.goHome()">←</button>
          <div>
            <div class="header-title">💰 Sale Daily</div>
            <div class="header-sub">${App.esc(s.display_name)} · ${App.esc(s.store_name)}</div>
          </div>
          <div class="header-right">
            <span class="tag gray">${App.esc(s.tier_id)}</span>
          </div>
        </div>

        <div class="screen-body">
          <!-- Store Selector (HQ only) -->
          ${App.renderStoreSelector()}

          <!-- KPIs -->
          <div id="kpi-area">
            <div class="kpi-grid">
              <div class="kpi-box highlight" id="kpi-today">
                <div class="kpi-label">📊 ยอดวันนี้</div>
                <div class="kpi-value gold" id="kpi-today-value">—</div>
                <div class="kpi-sub" id="kpi-today-sub">กำลังโหลด...</div>
              </div>
              <div class="kpi-box" id="kpi-month">
                <div class="kpi-label">📅 ยอดเดือนนี้</div>
                <div class="kpi-value" id="kpi-month-value">—</div>
                <div class="kpi-sub" id="kpi-month-sub">—</div>
              </div>
              <div class="kpi-box" id="kpi-avg">
                <div class="kpi-label">📈 เฉลี่ย/วัน</div>
                <div class="kpi-value" id="kpi-avg-value">—</div>
                <div class="kpi-sub" id="kpi-avg-sub">—</div>
              </div>
              <div class="kpi-box" id="kpi-yesterday">
                <div class="kpi-label">📉 เมื่อวาน</div>
                <div class="kpi-value" id="kpi-yesterday-value">—</div>
                <div class="kpi-sub" id="kpi-yesterday-sub">—</div>
              </div>
            </div>
          </div>

          <!-- Mini Chart (last 7 days) -->
          <div class="section-label">ยอดขาย 7 วันล่าสุด</div>
          <div class="card">
            <div class="mini-chart" id="mini-chart">
              ${Array(7).fill('<div class="mini-bar" style="height:20%"></div>').join('')}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--tm);margin-top:4px">
              <span id="chart-label-start">—</span>
              <span id="chart-label-end">วันนี้</span>
            </div>
          </div>

          <!-- Alerts -->
          <div id="alerts-area"></div>

          <!-- Quick Actions -->
          <div class="section-label">เมนูหลัก</div>
          <div class="quick-grid">
            <div class="quick-btn" onclick="App.go('daily-sale')">
              <div class="q-icon" style="background:var(--gold-bg);color:var(--gold)">💰</div>
              <div>
                <div class="q-label">กรอกยอดขาย</div>
                <div class="q-sub">S1 Daily Sale</div>
              </div>
            </div>
            <div class="quick-btn" onclick="App.go('expense')">
              <div class="q-icon" style="background:var(--red-bg);color:var(--red)">🧾</div>
              <div>
                <div class="q-label">ค่าใช้จ่าย</div>
                <div class="q-sub">S2 Expense</div>
              </div>
            </div>
            <div class="quick-btn" onclick="App.go('invoice')">
              <div class="q-icon" style="background:var(--blue-bg);color:var(--blue)">📄</div>
              <div>
                <div class="q-label">Invoice</div>
                <div class="q-sub">S3 Invoice</div>
              </div>
            </div>
            <div class="quick-btn" onclick="App.go('cash')">
              <div class="q-icon" style="background:var(--green-bg);color:var(--green)">💵</div>
              <div>
                <div class="q-label">เงินสดส่งมอบ</div>
                <div class="q-sub">S4 Cash On Hand</div>
              </div>
            </div>
          </div>

          <!-- History & Admin -->
          <div class="quick-grid">
            <div class="quick-btn" onclick="App.go('sale-history')">
              <div class="q-icon" style="background:var(--s2);color:var(--td)">📊</div>
              <div>
                <div class="q-label">ประวัติขาย</div>
                <div class="q-sub">S5 History</div>
              </div>
            </div>
            <div class="quick-btn" onclick="App.go('expense-history')">
              <div class="q-icon" style="background:var(--s2);color:var(--td)">📋</div>
              <div>
                <div class="q-label">ประวัติจ่าย</div>
                <div class="q-sub">S6 History</div>
              </div>
            </div>
          </div>

          ${(API.isHQ() || API.hasPermission('manage_config')) ? `
            <div class="quick-grid" style="grid-template-columns:1fr">
              <div class="quick-btn" onclick="App.go('settings')">
                <div class="q-icon" style="background:var(--s2);color:var(--td)">⚙️</div>
                <div>
                  <div class="q-label">ตั้งค่า & จัดการ</div>
                  <div class="q-sub">S7 Admin — Channel, Vendor, Permissions</div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>`;
  }

  async function loadDashboard() {
    try {
      const data = await API.getDashboard();

      // KPI: Today
      const todayEl = document.getElementById('kpi-today-value');
      const todaySub = document.getElementById('kpi-today-sub');
      if (todayEl) {
        if (data.today.is_recorded) {
          todayEl.textContent = App.formatMoney(data.today.total_sales);
          todayEl.className = 'kpi-value gold';
          const syncIcon = data.today.fin_synced ? '✅ Finance synced' : '⏳ Pending sync';
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
        monthEl.textContent = App.formatMoney(data.month.total);
        monthSub.textContent = `${data.month.days_recorded} วันที่บันทึก`;
      }

      // KPI: Average
      const avgEl = document.getElementById('kpi-avg-value');
      const avgSub = document.getElementById('kpi-avg-sub');
      if (avgEl) {
        avgEl.textContent = App.formatMoney(data.month.daily_average);
        avgSub.textContent = 'เฉลี่ยเดือนนี้';
      }

      // KPI: Yesterday
      const yestEl = document.getElementById('kpi-yesterday-value');
      const yestSub = document.getElementById('kpi-yesterday-sub');
      if (yestEl) {
        if (data.yesterday.total_sales > 0) {
          yestEl.textContent = App.formatMoney(data.yesterday.total_sales);
          // Compare with today
          if (data.today.is_recorded && data.today.total_sales > 0) {
            const diff = data.today.total_sales - data.yesterday.total_sales;
            const pct = ((diff / data.yesterday.total_sales) * 100).toFixed(0);
            yestSub.innerHTML = diff >= 0
              ? `<span style="color:var(--green)">↑ ${pct}% vs วันนี้</span>`
              : `<span style="color:var(--red)">↓ ${Math.abs(pct)}% vs วันนี้</span>`;
          } else {
            yestSub.textContent = data.yesterday.date;
          }
        } else {
          yestEl.textContent = '—';
          yestSub.textContent = 'ไม่มีข้อมูล';
        }
      }

      // Mini Chart
      const chartEl = document.getElementById('mini-chart');
      const breakdown = data.month.daily_breakdown || [];
      if (chartEl && breakdown.length > 0) {
        const maxSale = Math.max(...breakdown.map(d => d.total_sales || 0), 1);
        const bars = breakdown.slice(0, 7).reverse();
        chartEl.innerHTML = bars.map((d, i) => {
          const pct = Math.max(((d.total_sales || 0) / maxSale) * 100, 4);
          const isToday = d.sale_date === App.todayStr();
          return `<div class="mini-bar ${isToday ? 'today' : ''}" style="height:${pct}%"
                       title="${App.formatDateShort(d.sale_date)}: ${App.formatMoney(d.total_sales)}"></div>`;
        }).join('');

        const startLabel = document.getElementById('chart-label-start');
        if (startLabel && bars.length > 0) startLabel.textContent = App.formatDateShort(bars[0].sale_date);
      }

      // Alerts
      const alertsEl = document.getElementById('alerts-area');
      if (alertsEl) {
        let alertsHtml = '';

        if (!data.today.is_recorded) {
          alertsHtml += `
            <div class="alert-row warn" onclick="App.go('daily-sale')">
              <span class="alert-icon">⚠️</span>
              <span class="alert-text">ยังไม่ได้กรอกยอดขายวันนี้ — กดเพื่อกรอก</span>
            </div>`;
        }

        if (data.alerts.missing_days > 0) {
          alertsHtml += `
            <div class="alert-row info">
              <span class="alert-icon">📅</span>
              <span class="alert-text">ขาดข้อมูล ${data.alerts.missing_days} วันในเดือนนี้</span>
            </div>`;
        }

        if (data.alerts.unpaid_invoices > 0) {
          alertsHtml += `
            <div class="alert-row danger" onclick="App.go('invoice')">
              <span class="alert-icon">🧾</span>
              <span class="alert-text">${data.alerts.unpaid_invoices} Invoice ค้างจ่าย</span>
            </div>`;
        }

        if ((data.alerts.cash_mismatches || []).length > 0) {
          alertsHtml += `
            <div class="alert-row danger" onclick="App.go('cash')">
              <span class="alert-icon">💵</span>
              <span class="alert-text">${data.alerts.cash_mismatches.length} วันเงินสดไม่ตรง</span>
            </div>`;
        }

        if (alertsHtml) {
          alertsEl.innerHTML = `<div class="section-label">🔔 แจ้งเตือน</div>${alertsHtml}`;
        }
      }

    } catch (err) {
      console.error('Dashboard load error:', err);
      App.toast('โหลด Dashboard ไม่สำเร็จ', 'error');
    }
  }


  // ════════════════════════════════════════
  // S1: DAILY SALE INPUT ★
  // ════════════════════════════════════════

  // State
  let s1 = {
    date: null,
    channels: [],
    amounts: {},
    photoCardUrl: null,
    photoCashUrl: null,
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
        <!-- Header -->
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div>
            <div class="header-title">💰 กรอกยอดขาย</div>
            <div class="header-sub">S1 Daily Sale · ${App.esc(session.store_name)}</div>
          </div>
          <div class="header-right">
            <span class="tag gold" id="s1-finance-tag" style="display:none">🔗 Finance</span>
          </div>
        </div>

        <div class="screen-body">
          <!-- Store Selector -->
          ${App.renderStoreSelector()}

          <!-- Date Navigation -->
          <div class="date-bar">
            <button class="date-nav" onclick="Screens.s1ChangeDate(-1)">‹</button>
            <div class="date-display">
              <span id="s1-date-label">${App.formatDate(date)}</span>
              <span class="date-sub" id="s1-date-sub"></span>
            </div>
            <button class="date-nav" onclick="Screens.s1ChangeDate(1)">›</button>
            <button class="date-today" onclick="Screens.s1GoToday()">วันนี้</button>
          </div>

          <!-- Status Bar -->
          <div id="s1-status"></div>

          <!-- Channel Inputs -->
          <div class="section-label">💳 ช่องทางขาย</div>
          <div class="card" id="s1-channels">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด channels...</div>
          </div>

          <!-- Total -->
          <div class="total-bar">
            <span class="total-label">ยอดรวมทั้งหมด</span>
            <span class="total-value" id="s1-total">$0.00</span>
          </div>

          <!-- Cancel / Difference Section -->
          <details class="card" style="cursor:pointer">
            <summary style="font-size:13px;font-weight:600;color:var(--td)">
              📝 Cancel / ผลต่าง (ถ้ามี)
            </summary>
            <div style="margin-top:12px">
              <div class="form-group">
                <label class="form-label">ผลต่าง (Difference)</label>
                <input type="number" step="0.01" class="form-input" id="s1-difference"
                       placeholder="0.00" oninput="Screens.s1RecalcTotal()">
              </div>
              <div class="form-group">
                <label class="form-label">Cancel Amount</label>
                <input type="number" step="0.01" class="form-input" id="s1-cancel-amount"
                       placeholder="0.00">
              </div>
              <div class="form-group">
                <label class="form-label">Cancel Description</label>
                <input type="text" class="form-input" id="s1-cancel-desc"
                       placeholder="รายละเอียด cancel">
              </div>
              <div class="form-group">
                <label class="form-label">Cancel Reason</label>
                <input type="text" class="form-input" id="s1-cancel-reason"
                       placeholder="เหตุผล">
              </div>
            </div>
          </details>

          <!-- Photo Upload -->
          <div class="section-label">📸 ถ่ายรูป (บังคับ 2 รูป)</div>
          <div class="photo-grid">
            <div class="photo-box" id="s1-photo-card" onclick="Screens.s1PickPhoto('card')">
              <div class="photo-icon">💳</div>
              <div class="photo-label">Card Summary</div>
              <div class="photo-required">* บังคับ</div>
            </div>
            <div class="photo-box" id="s1-photo-cash" onclick="Screens.s1PickPhoto('cash')">
              <div class="photo-icon">💵</div>
              <div class="photo-label">Cash Count</div>
              <div class="photo-required">* บังคับ</div>
            </div>
          </div>
          <input type="file" id="s1-file-input" accept="image/*" capture="environment" style="display:none"
                 onchange="Screens.s1HandlePhoto(event)">
        </div>

        <!-- Bottom Action Bar -->
        <div class="bottom-bar">
          <button class="btn btn-outline" style="flex:0.4" onclick="App.go('dashboard')">ยกเลิก</button>
          <button class="btn btn-gold" style="flex:1" id="s1-save-btn" onclick="Screens.s1Save()">
            💾 บันทึก + Push Finance
          </button>
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

      // Populate channel amounts if existing
      s1.amounts = {};
      if (data.sale?.sd_sale_channels) {
        data.sale.sd_sale_channels.forEach(ch => {
          s1.amounts[ch.channel_key] = ch.amount;
        });
      }

      // Set photos
      s1.photoCardUrl = data.sale?.photo_card_url || null;
      s1.photoCashUrl = data.sale?.photo_cash_url || null;

      renderS1Channels();
      renderS1Status(data);
      renderS1Photos();
      s1RecalcTotal();

      // Fill cancel fields
      if (data.sale) {
        setVal('s1-difference', data.sale.difference);
        setVal('s1-cancel-amount', data.sale.cancel_amount);
        setVal('s1-cancel-desc', data.sale.cancel_desc);
        setVal('s1-cancel-reason', data.sale.cancel_reason);
      }

      // Update date label
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
      'card_sale': { icon: '💳', cls: 'card_sale' },
      'cash_sale': { icon: '💵', cls: 'cash_sale' },
      'delivery_sale': { icon: '🛵', cls: 'delivery_sale' },
      'other': { icon: '📦', cls: 'other' },
    };

    container.innerHTML = s1.channels.map(ch => {
      const group = iconMap[ch.dashboard_group] || iconMap['other'];
      const amount = s1.amounts[ch.channel_key] || '';
      const hasVal = parseFloat(amount) > 0;

      return `
        <div class="channel-row">
          <div class="channel-icon ${group.cls}">${group.icon}</div>
          <div class="channel-label">
            ${App.esc(ch.channel_label)}
            <span class="ch-sub">${App.esc(ch.finance_sub_category)}</span>
          </div>
          <input type="number" step="0.01" min="0"
                 class="channel-input ${hasVal ? 'has-value' : ''}"
                 id="ch-${ch.channel_key}"
                 value="${amount}"
                 placeholder="0.00"
                 oninput="Screens.s1OnChannelInput('${ch.channel_key}', this)"
                 ${s1.isLocked ? 'disabled' : ''}>
        </div>`;
    }).join('');
  }

  function renderS1Status(data) {
    const el = document.getElementById('s1-status');
    if (!el) return;

    if (data.is_new) {
      el.innerHTML = '<div class="status-bar new">🆕 ยังไม่มีข้อมูลวันนี้ — กรอกใหม่</div>';
    } else if (data.sale?.is_locked) {
      el.innerHTML = '<div class="status-bar locked">🔒 ล็อคแล้ว — ต้อง T1-T2 ปลดล็อค</div>';
    } else {
      const syncText = data.sale?.fin_synced
        ? '✅ Finance synced'
        : '⏳ Finance pending';
      el.innerHTML = `<div class="status-bar saved">📝 มีข้อมูลแล้ว — แก้ไขได้ · ${syncText}</div>`;
    }

    // Finance tag
    const finTag = document.getElementById('s1-finance-tag');
    if (finTag) {
      finTag.style.display = data.sale?.fin_synced ? 'inline-flex' : 'none';
    }
  }

  function renderS1Photos() {
    // Card photo
    const cardBox = document.getElementById('s1-photo-card');
    if (cardBox && s1.photoCardUrl) {
      cardBox.classList.add('has-photo');
      cardBox.innerHTML = `
        <img src="${s1.photoCardUrl}" alt="Card Summary">
        <div class="photo-check">✓</div>`;
    }

    // Cash photo
    const cashBox = document.getElementById('s1-photo-cash');
    if (cashBox && s1.photoCashUrl) {
      cashBox.classList.add('has-photo');
      cashBox.innerHTML = `
        <img src="${s1.photoCashUrl}" alt="Cash Count">
        <div class="photo-check">✓</div>`;
    }
  }

  // Channel input handler
  function s1OnChannelInput(channelKey, inputEl) {
    const val = parseFloat(inputEl.value) || 0;
    s1.amounts[channelKey] = val;

    // Toggle has-value class
    if (val > 0) inputEl.classList.add('has-value');
    else inputEl.classList.remove('has-value');

    s1RecalcTotal();
  }

  // Recalculate total
  function s1RecalcTotal() {
    const total = Object.values(s1.amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    const totalEl = document.getElementById('s1-total');
    if (totalEl) totalEl.textContent = App.formatMoney(total);
  }

  // Date navigation
  function s1ChangeDate(delta) {
    const newDate = App.addDays(s1.date, delta);
    // Don't allow future dates
    if (newDate > App.todayStr()) {
      App.toast('ไม่สามารถกรอกวันในอนาคต', 'warning');
      return;
    }
    s1.date = newDate;
    App.go('daily-sale', { date: newDate });
  }

  function s1GoToday() {
    s1.date = App.todayStr();
    App.go('daily-sale', { date: App.todayStr() });
  }

  // Photo handling
  let _photoTarget = null;

  function s1PickPhoto(target) {
    if (s1.isLocked) {
      App.toast('ล็อคอยู่ — ไม่สามารถแก้ไข', 'warning');
      return;
    }
    _photoTarget = target;
    document.getElementById('s1-file-input')?.click();
  }

  async function s1HandlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      App.showLoader();
      const result = await API.uploadPhoto(file, 'sale');

      if (_photoTarget === 'card') {
        s1.photoCardUrl = result.url;
      } else {
        s1.photoCashUrl = result.url;
      }

      renderS1Photos();
      App.toast('อัพโหลดรูปสำเร็จ ✓', 'success');
    } catch (err) {
      console.error('Photo upload error:', err);
      App.toast('อัพโหลดรูปไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      // Reset file input
      event.target.value = '';
    }
  }

  // ─── SAVE ───
  async function s1Save() {
    // Validation
    if (!s1.photoCardUrl) {
      App.toast('กรุณาถ่ายรูป Card Summary', 'error');
      return;
    }
    if (!s1.photoCashUrl) {
      App.toast('กรุณาถ่ายรูป Cash Count', 'error');
      return;
    }

    const totalAmount = Object.values(s1.amounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    if (totalAmount <= 0) {
      App.toast('ยอดขายรวมต้องมากกว่า 0', 'error');
      return;
    }

    // Build channels object
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
        photo_cash_url: s1.photoCashUrl,
        difference: getVal('s1-difference'),
        cancel_desc: getVal('s1-cancel-desc'),
        cancel_amount: getVal('s1-cancel-amount'),
        cancel_reason: getVal('s1-cancel-reason'),
      });

      const isUpdate = result.is_update ? 'อัพเดต' : 'บันทึก';
      App.toast(`${isUpdate}สำเร็จ ✓ Finance ${result.finance_records_created} records`, 'success');

      // Reload to show updated status
      setTimeout(() => loadDailySale({ date: s1.date }), 500);

    } catch (err) {
      console.error('Save error:', err);
      App.toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      App.hideLoader();
      const saveBtn = document.getElementById('s1-save-btn');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 บันทึก + Push Finance'; }
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
  // EXPORTS
  // ════════════════════════════════════════

  return {
    // Init screens
    renderLoading, renderNoAccess, renderComingSoon,

    // S0 Dashboard
    renderDashboard, loadDashboard,

    // S1 Daily Sale
    renderDailySale, loadDailySale,
    s1ChangeDate, s1GoToday,
    s1OnChannelInput, s1RecalcTotal,
    s1PickPhoto, s1HandlePhoto,
    s1Save,
  };
})();
