// Version 2.6 | 9 MAR 2026 | Siam Palette Group
/**
 * ═══════════════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens5_sd.js — v2.0
 * Tasks + S8 Daily Report (3 tabs) + Admin Dashboard
 * Phase 5: SPG topbar + wireframe filter chips
 * ═══════════════════════════════════════════════════
 */

const Screens5 = (() => {

  // ════════════════════════════════════════
  // TASKS SCREEN (standalone + embedded tab)
  // ════════════════════════════════════════

  let _tasks = [];
  let _taskFilter = 'pending';

  function renderTasks() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();
    const canCreate = session.tier_level <= 4;

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Follow-up' })}
        <div class="screen-body">
          ${API.isHQ() ? App.renderStoreSelector() : ''}

          <!-- Status chips -->
          <div class="chip-group">
            <button class="filter-chip ${_taskFilter === 'pending' ? 'active' : ''}" onclick="Screens5.filterTasks('pending')">Open</button>
            <button class="filter-chip ${_taskFilter === 'done' ? 'active' : ''}" onclick="Screens5.filterTasks('done')">Done</button>
          </div>

          <!-- Type chips -->
          <div class="chip-group">
            <button class="filter-chip ${_taskFilter === 'all' || _taskFilter === 'pending' || _taskFilter === 'done' ? 'active' : ''}" onclick="Screens5.filterTasks(_taskFilter === 'done' ? 'done' : 'pending')">All</button>
            <button class="filter-chip ${_taskFilter === 'equipment' ? 'active' : ''}" onclick="Screens5.filterTasks('equipment')">🔧 Equipment</button>
            <button class="filter-chip ${_taskFilter === 'follow_up' ? 'active' : ''}" onclick="Screens5.filterTasks('follow_up')">📋 Tasks</button>
            <button class="filter-chip ${_taskFilter === 'suggestion' ? 'active' : ''}" onclick="Screens5.filterTasks('suggestion')">💡 Suggestion</button>
          </div>

          <div id="task-list">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadTasks() {
    const el = document.getElementById('task-list');
    if (!el) return;
    try {
      App.showLoader();
      // Type filters: equipment, follow_up, suggestion → filter client-side
      const isTypeFilter = ['suggestion', 'equipment', 'follow_up'].includes(_taskFilter);
      const status = (_taskFilter === 'all' || _taskFilter === 'done' || _taskFilter === 'pending') ? _taskFilter : undefined;
      const data = await API.getTasks(API.isHQ() ? API.getSelectedStore() : null, status === 'all' ? undefined : status);
      _tasks = data.tasks || [];
      if (isTypeFilter) {
        _tasks = _tasks.filter(t => t.type === _taskFilter);
      }
      renderTaskList(el);
    } catch (err) {
      el.innerHTML = '<div style="color:var(--red);padding:16px">' + App.esc(err.message) + '</div>';
    } finally { App.hideLoader(); }
  }

  function renderTaskList(el) {
    if (_tasks.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--tm)"><div style="font-size:36px;margin-bottom:8px">📋</div><div>ไม่มีรายการ</div></div>';
      return;
    }
    const session = API.getSession();
    const canEdit = session && session.tier_level <= 4;

    el.innerHTML = _tasks.map(t => {
      const isDone = t.status === 'done';
      const isUrgent = t.priority === 'urgent';
      const isSuggestion = t.type === 'suggestion';
      const isEquip = t.type === 'equipment';

      const borderColor = isDone ? 'var(--green)' : isEquip ? 'var(--red)' : isSuggestion ? 'var(--purple)' : isUrgent ? 'var(--red)' : 'var(--orange)';
      const typeLabel = isEquip ? 'Equipment' : isSuggestion ? 'Suggestion' : 'Tasks';

      return `
        <div style="padding:var(--sp-sm) 12px;background:var(--bg);border:1px solid var(--bd2);border-left:4px solid ${borderColor};border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:var(--sp-xs);${isDone ? 'opacity:.6' : ''}">
          <div style="font-size:var(--fs-body);font-weight:700">${App.esc(typeLabel)} : ${App.esc(t.title)}</div>
          <div style="font-size:var(--fs-xs);color:var(--tm);margin-top:2px">
            ${t.note ? App.esc(t.note) + ' · ' : ''}${isUrgent ? '🚨 ด่วนมาก · ' : ''}${t.assigned_to ? '👤 ' + App.esc(t.assigned_to) + ' · ' : ''}${new Date(t.created_at).toLocaleDateString('th-TH')}
          </div>
          <div style="display:flex;gap:var(--sp-xs);margin-top:var(--sp-sm);align-items:center">
            <span class="status-badge ${isDone ? 'sts-synced' : 'sts-pending'}">${isDone ? 'Done' : 'Open'}</span>
            ${canEdit && !isDone ? `<button class="btn btn-sm btn-outline" onclick="Screens5.toggleTask('${t.id}','done')">✏️</button>` : ''}
            ${canEdit && !isDone ? `<span style="font-size:var(--fs-xs);color:var(--green);background:var(--green-bg);padding:2px 8px;border-radius:4px;cursor:pointer" onclick="Screens5.toggleTask('${t.id}','done')">กดเสร็จ ✓</span>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function renderTaskListEmbedded(el, tasks) {
    // Compact task list for S8 tab 3
    if (!tasks || tasks.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--tm)"><div style="font-size:28px;margin-bottom:6px">📋</div><div style="font-size:12px">ไม่มีรายการ</div></div>';
      return;
    }
    const session = API.getSession();
    const canEdit = session && session.tier_level <= 4;

    el.innerHTML = tasks.map(t => {
      const isDone = t.status === 'done';
      const isUrgent = t.priority === 'urgent';
      const icon = isDone ? '✅' : (isUrgent ? '🚨' : '⏳');
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--s2)">
          ${canEdit ? `<span style="font-size:16px;cursor:pointer" onclick="Screens5.toggleTaskFromS8('${t.id}','${isDone ? 'pending' : 'done'}')">${icon}</span>` : `<span style="font-size:16px">${icon}</span>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;${isDone ? 'text-decoration:line-through;opacity:0.5' : ''}">${App.esc(t.title)}</div>
            ${t.assigned_to ? `<div style="font-size:10px;color:var(--tm)">👤 ${App.esc(t.assigned_to)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function filterTasks(status) {
    _taskFilter = status;
    App.go('tasks');
  }

  async function toggleTask(taskId, newStatus) {
    try {
      await API.updateTask({ task_id: taskId, status: newStatus });
      App.toast(newStatus === 'done' ? '✅ เสร็จแล้ว' : '⏳ เปิดใหม่', 'success');
      await loadTasks();
      await App.refreshTaskBadge();
    } catch (err) { App.toast(err.message, 'error'); }
  }

  async function toggleTaskFromS8(taskId, newStatus) {
    try {
      await API.updateTask({ task_id: taskId, status: newStatus });
      App.toast(newStatus === 'done' ? '✅ เสร็จแล้ว' : '⏳ เปิดใหม่', 'success');
      // Reload tasks tab
      const el = document.getElementById('s8-content');
      if (el && _activeTab === 'tasks') {
        const data = await API.getTasks(null);
        _s8Tasks = data.tasks || [];
        renderTasksTab(el);
      }
      await App.refreshTaskBadge();
    } catch (err) { App.toast(err.message, 'error'); }
  }

  function showCreateTask() {
    const overlay = document.createElement('div');
    overlay.id = 'edit-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:var(--bg);border-radius:var(--radius);padding:24px;width:100%;max-width:440px;max-height:85vh;overflow-y:auto">
        <div style="font-size:16px;font-weight:600;margin-bottom:16px">📋 เพิ่มงานติดตาม</div>
        <div class="form-group">
          <label class="form-label">หัวข้อ *</label>
          <input type="text" class="form-input" id="task-title" placeholder="เช่น ช่างซ่อมเครื่องน้ำแข็ง">
        </div>
        <div class="form-group">
          <label class="form-label">ประเภท</label>
          <select class="form-input" id="task-type">
            <option value="follow_up">📋 Follow-up</option>
            <option value="equipment">🔧 Equipment</option>
            <option value="suggestion">💡 Suggestion</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">มอบหมายให้</label>
          <input type="text" class="form-input" id="task-assign" placeholder="เช่น พี่ชวัญ, ทีม QC">
        </div>
        <div class="form-group">
          <label class="form-label">ระดับ</label>
          <select class="form-input" id="task-priority">
            <option value="normal">📋 Normal</option>
            <option value="urgent">🚨 Urgent</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">หมายเหตุ</label>
          <textarea class="form-input" id="task-note" rows="2" placeholder="รายละเอียดเพิ่มเติม..." style="resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-gold" style="flex:1" onclick="Screens5.saveNewTask()">📋 เพิ่ม</button>
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('edit-modal')?.remove()">ยกเลิก</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  async function saveNewTask() {
    const title = (document.getElementById('task-title')?.value || '').trim();
    if (!title) { App.toast('กรุณากรอกหัวข้อ', 'error'); return; }
    try {
      App.showLoader();
      await API.createTask({
        store_id: API.isHQ() ? API.getSelectedStore() : null,
        title,
        type: document.getElementById('task-type')?.value || 'follow_up',
        assigned_to: document.getElementById('task-assign')?.value || '',
        priority: document.getElementById('task-priority')?.value || 'normal',
        note: document.getElementById('task-note')?.value || '',
        report_date: App.todayStr(),
      });
      document.getElementById('edit-modal')?.remove();
      App.toast('เพิ่มงานสำเร็จ ✓', 'success');
      // Refresh if on tasks screen or s8 tasks tab
      if (_activeTab === 'tasks') {
        const el = document.getElementById('s8-content');
        if (el) {
          const data = await API.getTasks(null);
          _s8Tasks = data.tasks || [];
          renderTasksTab(el);
        }
      }
      await loadTasks();
      await App.refreshTaskBadge();
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }


  // ════════════════════════════════════════
  // S8 DAILY REPORT — 3 TABS
  // Tab 1: ภาพรวม (S1/S2 + weather + customers)
  // Tab 2: เหตุการณ์ + Waste/Leftover
  // Tab 3: ติดตาม (tasks embedded)
  // ════════════════════════════════════════

  let _reportDate = null;
  let _reportData = null;
  let _incidentState = {};
  let _leftoverItems = [];
  let _s8Summary = null;
  let _s8Tasks = [];
  let _activeTab = 'overview';

  const INCIDENT_CATS = [
    { key: 'food_quality', icon: '🍽️', name: 'Food Quality', desc: 'รสชาติเปลี่ยน, ไม่อร่อย, texture ผิดปกติ' },
    { key: 'contamination', icon: '🦠', name: 'Contamination', desc: 'ผมในอาหาร, เศษวัตถุ, แมลง' },
    { key: 'service_delay', icon: '⏱️', name: 'Service Delay', desc: 'ออเดอร์ช้า, คิวยาว, ลูกค้ารอนาน' },
    { key: 'wrong_order', icon: '🔄', name: 'Wrong Order', desc: 'เสิร์ฟผิดเมนู, ผิดตัวเลือก' },
    { key: 'complaint', icon: '💢', name: 'Customer Complaint', desc: 'บ่นโดยตรง, ขอคืนเงิน, Review' },
    { key: 'waste', icon: '🗑️', name: 'Waste / เหลือผิดปกติ', desc: 'เมนูเหลือเยอะ, ทิ้งบ่อย' },
    { key: 'staff', icon: '👤', name: 'Staff Issue', desc: 'ขาดคน, ไม่แจ้งออก, พฤติกรรม' },
  ];

  const LEVEL_OPTS = [
    { key: 'little', label: '🟢 นิดหน่อย' },
    { key: 'half', label: '🟡 ครึ่งนึง' },
    { key: 'almost_full', label: '🔴 เกือบหมด' },
    { key: 'full', label: '⚫ ทั้งจาน' },
  ];

  // ─── MAIN RENDER ───

  function renderDailyReport() {
    const session = API.getSession();
    if (!session) return Screens.renderNoAccess();

    // Admin (T1-T2) → dashboard view
    const isAdmin = session.tier_level <= 2 || session.store_id === 'HQ';
    if (isAdmin) return renderAdminDashboard(session);

    // Check if date was set from Report Hub
    const hubDate = sessionStorage.getItem('sd_report_date');
    if (hubDate) {
      _reportDate = hubDate;
      sessionStorage.removeItem('sd_report_date');
    }

    // Store staff → form view
    _reportDate = _reportDate || App.todayStr();

    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'report-hub', label: 'Daily Report' })}
        <div class="screen-body">

          <!-- Date picker -->
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0 12px;font-size:14px;font-weight:600">
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens5.s8ChangeDate(-1)">‹</span>
            <span>📅 ${App.formatDate(_reportDate)}</span>
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens5.s8ChangeDate(1)">›</span>
          </div>

          <!-- 3 Tabs -->
          <div id="s8-tabs" style="display:flex;gap:0;background:var(--s1);border-radius:12px;padding:3px;margin-bottom:12px">
            <button class="tab-pill ${_activeTab === 'overview' ? 'active' : ''}" data-tab="overview" onclick="Screens5.s8Tab('overview')">📊 ภาพรวม</button>
            <button class="tab-pill ${_activeTab === 'incidents' ? 'active' : ''}" data-tab="incidents" onclick="Screens5.s8Tab('incidents')">⚠️ เหตุการณ์</button>
            <button class="tab-pill ${_activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks" onclick="Screens5.s8Tab('tasks')">📋 ติดตาม</button>
          </div>

          <div id="s8-content">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>

          <!-- Bottom mini tabs + save -->
          <div style="margin-top:16px;padding-bottom:20px">
            <div id="s8-bottom-tabs" style="display:flex;justify-content:center;gap:6px;margin-bottom:12px">
              <span class="s8-btab" data-tab="overview" style="font-size:11px;padding:4px 14px;border-radius:20px;cursor:pointer" onclick="Screens5.s8Tab('overview')">📊 ภาพรวม</span>
              <span class="s8-btab" data-tab="incidents" style="font-size:11px;padding:4px 14px;border-radius:20px;cursor:pointer" onclick="Screens5.s8Tab('incidents')">⚠️ เหตุการณ์</span>
              <span class="s8-btab" data-tab="tasks" style="font-size:11px;padding:4px 14px;border-radius:20px;cursor:pointer" onclick="Screens5.s8Tab('tasks')">📋 ติดตาม</span>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-gold" style="flex:1" onclick="Screens5.s8Save(false)">บันทึก</button>
              <button class="btn btn-outline" style="flex:1" onclick="Screens5.s8CopyReport()">📋 Copy</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ─── ADMIN DASHBOARD VIEW (monthly aggregate — wireframe v1.5.1) ───

  let _dashMonth = new Date().toISOString().substring(0, 7);
  const WEATHER_ICONS = { sunny: '☀️', cloudy: '🌤️', rain: '🌧️', heavy_rain: '⛈️', unknown: '❓' };
  const INC_COLORS = { food_quality: 'var(--red)', contamination: 'var(--orange)', service_delay: 'var(--blue)', wrong_order: 'var(--purple)', complaint: '#999', waste_abnormal: 'var(--gold)', staff_issue: '#E44' };

  function renderAdminDashboard(session) {
    var monthLabel = (function() {
      var p = _dashMonth.split('-');
      var months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[parseInt(p[1])] + ' ' + p[0];
    })();
    return `
      <div class="screen">
        ${Screens.renderTopbar({ back: 'dashboard', label: 'Report Dashboard' })}
        <div class="screen-body">
          ${App.renderStoreSelector ? App.renderStoreSelector() : ''}
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0 16px;font-size:15px;font-weight:600">
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens5.dashMonthNav(-1)">‹</span>
            <span>📅 ${monthLabel}</span>
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens5.dashMonthNav(1)">›</span>
          </div>
          <div id="admin-dashboard-content">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  function dashMonthNav(delta) {
    var p = _dashMonth.split('-');
    var d = new Date(parseInt(p[0]), parseInt(p[1]) - 1 + delta, 1);
    _dashMonth = d.toISOString().substring(0, 7);
    App.go('daily-report');
  }

  async function loadAdminDashboard() {
    var el = document.getElementById('admin-dashboard-content');
    if (!el) return;
    try {
      App.showLoader();
      var storeId = API.isHQ() ? API.getSelectedStore() : API.getSession()?.store_id;
      var data = await API.getReportDashboard(storeId, _dashMonth);
      var k = data.kpis;
      var monthLabel = _dashMonth;

      // ═══ 1. KPI OVERVIEW ═══
      var kpiHtml = `
        <div style="font-size:14px;font-weight:700;color:var(--gold-dim);margin-bottom:10px">📈 ภาพรวม — ${monthLabel}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
          <div class="card" style="text-align:center;padding:12px 6px">
            <div style="font-size:10px;color:var(--td)">📝 รีพอร์ต</div>
            <div style="font-size:22px;font-weight:700">${k.reports_submitted}<span style="font-size:12px;color:var(--td)"> / ${data.days_in_month}</span></div>
            <div style="font-size:10px;color:${k.reports_submitted >= data.days_in_month ? 'var(--green)' : 'var(--tm)'}">${k.reports_submitted >= data.days_in_month ? '✅ ครบ' : 'ยังไม่ครบ'}</div>
          </div>
          <div class="card" style="text-align:center;padding:12px 6px">
            <div style="font-size:10px;color:var(--td)">⚠️ เหตุการณ์</div>
            <div style="font-size:22px;font-weight:700;color:var(--red)">${k.total_incidents}</div>
            <div style="font-size:10px;color:var(--tm)">เฉลี่ย ${k.avg_incidents_per_day}/วัน</div>
          </div>
          <div class="card" style="text-align:center;padding:12px 6px">
            <div style="font-size:10px;color:var(--td)">🍞 ของเหลือ</div>
            <div style="font-size:22px;font-weight:700">${k.total_leftovers}</div>
            <div style="font-size:10px;color:var(--tm)">ชิ้น</div>
          </div>
          <div class="card" style="text-align:center;padding:12px 6px">
            <div style="font-size:10px;color:var(--td)">📋 Tasks ค้าง</div>
            <div style="font-size:22px;font-weight:700;color:var(--purple)">${k.pending_tasks}</div>
            <div style="font-size:10px;color:${k.urgent_tasks > 0 ? 'var(--red)' : 'var(--tm)'}">${k.urgent_tasks > 0 ? '🚨 ' + k.urgent_tasks + ' urgent' : '—'}</div>
          </div>
          <div class="card" style="text-align:center;padding:12px 6px;grid-column:span 2">
            <div style="font-size:10px;color:var(--td)">✅ Task Completion</div>
            <div style="font-size:22px;font-weight:700;color:var(--green)">${k.completion_pct}%</div>
            <div style="height:6px;background:var(--s2);border-radius:3px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${k.completion_pct}%;background:var(--green);border-radius:3px"></div></div>
          </div>
        </div>`;

      // ═══ 2. INCIDENT BREAKDOWN ═══
      var cats = data.incident_by_category || [];
      var maxCat = cats.length > 0 ? cats[0].count : 1;
      var catBarsHtml = cats.map(function(c) {
        var cat = INCIDENT_CATS.find(function(ic) { return ic.key === c.category; }) || { icon: '⚠️', name: c.category };
        var pct = Math.max((c.count / maxCat) * 100, 5);
        var color = INC_COLORS[c.category] || 'var(--gold)';
        return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:6px">'
          + '<div style="width:90px;text-align:right;flex-shrink:0;font-weight:500">' + cat.icon + ' ' + cat.name.split(' ')[0] + '</div>'
          + '<div style="flex:1;height:22px;background:var(--s2);border-radius:6px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:6px;display:flex;align-items:center;padding-left:6px;font-size:10px;font-weight:600;color:#fff">' + (pct > 20 ? c.count : '') + '</div></div>'
          + '<div style="width:30px;text-align:right;font-weight:600">' + c.count + '</div></div>';
      }).join('');
      var incBreakdownHtml = cats.length > 0
        ? '<div style="font-size:14px;font-weight:700;color:var(--gold-dim);margin-bottom:10px">⚠️ Incident Breakdown</div><div class="card" style="margin-bottom:16px">' + catBarsHtml + '</div>'
        : '';

      // ═══ 3. INCIDENT TREND 7 DAYS ═══
      var trend = data.incident_trend || [];
      var maxTrend = Math.max.apply(null, trend.map(function(t) { return t.count; }).concat([1]));
      var trendBarsHtml = trend.map(function(t) {
        var h = Math.max((t.count / maxTrend) * 120, 4);
        var dayNum = t.date.substring(8, 10);
        var isToday = t.date === App.todayStr();
        return '<div style="flex:1;text-align:center">'
          + '<div style="background:' + (isToday ? 'var(--gold)' : 'var(--gold-bg2)') + ';height:' + h + 'px;border-radius:4px 4px 0 0;margin:0 auto;width:70%"></div>'
          + '<div style="font-size:10px;color:var(--tm);margin-top:4px">' + dayNum + '</div>'
          + '<div style="font-size:10px;font-weight:600' + (isToday ? ';color:var(--gold)' : '') + '">' + t.count + '</div></div>';
      }).join('');
      var trendHtml = trend.length > 0
        ? '<div style="font-size:14px;font-weight:700;color:var(--gold-dim);margin-bottom:10px">📈 Incident Trend — 7 วัน</div><div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:12px">' + trendBarsHtml + '</div></div>'
        : '';

      // ═══ 4. CROSS-STORE ═══
      var cross = data.cross_store || [];
      var maxCross = cross.length > 0 ? cross[0].count : 1;
      var storeColors = ['var(--gold)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--orange)', 'var(--red)'];
      var crossBarsHtml = cross.map(function(c, i) {
        var pct = Math.max((c.count / maxCross) * 100, 5);
        return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:6px">'
          + '<div style="width:60px;text-align:right;font-weight:600">' + c.store_id + '</div>'
          + '<div style="flex:1;height:22px;background:var(--s2);border-radius:6px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:' + storeColors[i % storeColors.length] + ';border-radius:6px;display:flex;align-items:center;padding-left:6px;font-size:10px;font-weight:600;color:#fff">' + (pct > 20 ? c.count : '') + '</div></div>'
          + '<div style="width:30px;text-align:right;font-weight:600">' + c.count + '</div></div>';
      }).join('');
      var crossHtml = cross.length > 1
        ? '<div style="font-size:14px;font-weight:700;color:var(--gold-dim);margin-bottom:10px">🏢 เปรียบเทียบร้าน — Incidents</div><div class="card" style="margin-bottom:16px">' + crossBarsHtml + '</div>'
        : '';

      // ═══ 5. LEFTOVER PATTERNS ═══
      var topLft = data.top_leftovers || [];
      var lftRowsHtml = topLft.map(function(l, i) {
        return '<tr><td>' + (i + 1) + '</td><td style="font-weight:600">' + App.esc(l.item_name) + '</td><td style="text-align:center">' + l.times + '</td><td style="text-align:center">' + l.total_qty + '</td></tr>';
      }).join('');
      var lftHtml = topLft.length > 0
        ? '<div style="font-size:14px;font-weight:700;color:var(--gold-dim);margin-bottom:10px">🍞 Leftover Patterns</div>'
          + '<div class="card" style="margin-bottom:16px;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
          + '<thead><tr style="border-bottom:2px solid var(--s2)"><th style="padding:6px;text-align:left;font-size:11px;color:var(--td)">#</th><th style="padding:6px;text-align:left;font-size:11px;color:var(--td)">เมนู</th><th style="padding:6px;text-align:center;font-size:11px;color:var(--td)">ครั้ง</th><th style="padding:6px;text-align:center;font-size:11px;color:var(--td)">จำนวนรวม</th></tr></thead>'
          + '<tbody>' + lftRowsHtml + '</tbody></table></div>'
        : '';

      // ═══ 6. WEATHER CORRELATION ═══
      var wCorr = data.weather_correlation || [];
      var wCardsHtml = wCorr.map(function(w) {
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--s2);border-radius:10px;flex:1;min-width:120px">'
          + '<span style="font-size:26px">' + (WEATHER_ICONS[w.weather] || '❓') + '</span>'
          + '<div style="text-align:center;flex:1"><div style="font-size:18px;font-weight:700">' + w.avg + '</div><div style="font-size:10px;color:var(--td)">avg incidents</div><div style="font-size:10px;color:var(--tm)">' + w.days + ' วัน</div></div></div>';
      }).join('');
      var wHtml = wCorr.length > 0
        ? '<div style="font-size:14px;font-weight:700;color:var(--gold-dim);margin-bottom:10px">🌤️ Weather vs Incidents</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' + wCardsHtml + '</div>'
        : '';

      // ═══ 7. TASK COMPLETION ═══
      var ts = data.task_stats;
      var taskHtml = '<div style="font-size:14px;font-weight:700;color:var(--gold-dim);margin-bottom:10px">📋 Task Completion</div>'
        + '<div class="card" style="margin-bottom:16px">'
        + '<div style="display:flex;align-items:center;gap:16px">'
        + '<div style="width:70px;height:70px;border-radius:50%;background:conic-gradient(var(--green) 0% ' + ts.completion_pct + '%, var(--s2) ' + ts.completion_pct + '% 100%);display:flex;align-items:center;justify-content:center">'
        + '<div style="width:50px;height:50px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700">' + ts.completion_pct + '%</div></div>'
        + '<div style="flex:1;font-size:12px"><div style="margin-bottom:4px">✅ เสร็จ: <strong>' + ts.done + '</strong></div><div style="margin-bottom:4px">⏳ ค้าง: <strong>' + ts.pending + '</strong></div><div>📊 รวม: <strong>' + ts.total + '</strong></div></div>'
        + '</div></div>';

      // ═══ ASSEMBLE ═══
      el.innerHTML = kpiHtml + incBreakdownHtml + trendHtml + crossHtml + lftHtml + wHtml + taskHtml;

    } catch (err) {
      el.innerHTML = '<div style="color:var(--red);padding:16px">' + App.esc(err.message) + '</div>';
    } finally { App.hideLoader(); }
  }


  // ─── LOAD DATA ───

  async function loadDailyReport() {
    // Check admin → load dashboard
    const session = API.getSession();
    if (session && (session.tier_level <= 2 || session.store_id === 'HQ')) {
      await loadAdminDashboard();
      return;
    }

    const el = document.getElementById('s8-content');
    if (!el) return;
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;

      // Parallel: report + summary + tasks
      const [reportData, summaryData, taskData] = await Promise.all([
        API.getDailyReport(storeId, _reportDate),
        API.getS8Summary(storeId, _reportDate),
        API.getTasks(storeId),
      ]);

      _reportData = reportData.report;
      _s8Summary = summaryData;
      _s8Tasks = taskData.tasks || [];

      // Init incidents
      _incidentState = {};
      INCIDENT_CATS.forEach(c => { _incidentState[c.key] = { count: 0, note: '' }; });
      (reportData.incidents || []).forEach(i => {
        _incidentState[i.category] = { count: i.count || 0, note: i.note || '' };
      });

      // Init leftovers
      _leftoverItems = (reportData.leftovers || []).map(l => ({
        item_name: l.item_name || '',
        quantity: l.quantity || 1,
        level: l.level || 'half',
      }));

      renderS8Tab(el);

    } catch (err) {
      el.innerHTML = '<div style="color:var(--red);padding:16px">' + App.esc(err.message) + '</div>';
    } finally { App.hideLoader(); }
  }


  // ─── TAB ROUTING ───

  function renderS8Tab(el) {
    // Update top tab highlight
    document.querySelectorAll('#s8-tabs .tab-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === _activeTab);
    });
    // Update bottom mini tab highlight
    document.querySelectorAll('#s8-bottom-tabs .s8-btab').forEach(btn => {
      const isActive = btn.getAttribute('data-tab') === _activeTab;
      btn.style.background = isActive ? 'var(--gold)' : 'var(--s1)';
      btn.style.color = isActive ? '#fff' : 'var(--tm)';
    });

    if (_activeTab === 'overview') renderOverviewTab(el);
    else if (_activeTab === 'incidents') renderIncidentsTab(el);
    else if (_activeTab === 'tasks') renderTasksTab(el);
  }


  // ═══ TAB 1: ภาพรวม ═══

  function renderOverviewTab(el) {
    const r = _reportData || {};
    const s = _s8Summary || {};

    // S1/S2 summary with channel detail
    const sale = s.sale;
    const channels = s.channels || [];
    const channelSum = channels.reduce(function(sum, c) { return sum + (c.amount || 0); }, 0);
    const saleTotal = channelSum;
    const expenses = s.expenses || [];
    const expTotal = expenses.reduce(function(sum, e) { return sum + (e.total_amount || 0); }, 0);
    const expCount = expenses.length;

    // Channel rows
    const chHtml = channels.length > 0 ? channels.map(function(c) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>' + App.esc(c.name) + '</span><span style="font-weight:600">$' + (c.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2}) + '</span></div>';
    }).join('') : '<div style="font-size:11px;color:var(--tm)">ยังไม่มีข้อมูล</div>';

    // Expense rows
    const expHtml = expenses.length > 0 ? expenses.map(function(e) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>' + App.esc(e.vendor_name || e.description || '—') + '</span><span style="font-weight:600;color:var(--red)">-$' + (e.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits:2}) + '</span></div>';
    }).join('') : '<div style="font-size:11px;color:var(--tm)">ไม่มี</div>';

    el.innerHTML = `
      <!-- S1 ยอดขาย (ดึงจาก S1 อัตโนมัติ) -->
      <div class="section-label" style="margin-top:0">💰 ยอดขาย (ดึงจาก S1 อัตโนมัติ)</div>
      <div class="card" style="margin-bottom:8px">
        ${chHtml}
        <div style="display:flex;justify-content:space-between;padding:6px 0 0;border-top:1px solid var(--s2);margin-top:4px;font-weight:700">
          <span>Total</span><span style="color:var(--gold-dim)">$${saleTotal.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
        </div>
      </div>

      <!-- S2 ค่าใช้จ่าย (ดึงจาก S2 อัตโนมัติ) -->
      <div class="section-label">🧾 ค่าใช้จ่าย (ดึงจาก S2 อัตโนมัติ)</div>
      <div class="card" style="margin-bottom:16px">
        ${expHtml}
        ${expCount > 0 ? '<div style="display:flex;justify-content:space-between;padding:6px 0 0;border-top:1px solid var(--s2);margin-top:4px;font-weight:700"><span>รวม ' + expCount + ' รายการ</span><span style="color:var(--red)">-$' + expTotal.toLocaleString(undefined, {minimumFractionDigits:2}) + '</span></div>' : ''}
      </div>`;

    // Cash on Hand
    const cash = s.cash;
    let cashHtml = '';
    if (cash) {
      const matched = cash.is_matched;
      const icon = matched ? '✅' : '🔴';
      const statusText = matched ? 'เงินตรง' : 'เงินไม่ตรง!';
      const statusColor = matched ? 'var(--green)' : 'var(--red)';
      const statusBg = matched ? 'var(--green-bg)' : 'var(--red-bg)';
      cashHtml = `
      <div class="section-label">💵 Cash on Hand (ดึงจาก S4 อัตโนมัติ)</div>
      <div class="card" style="margin-bottom:16px;border-left:3px solid ${statusColor}">
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>Expected</span><span style="font-weight:600">$${(cash.expected || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span>Actual</span><span style="font-weight:600">$${(cash.actual || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0 0;border-top:1px solid var(--s2);margin-top:4px;font-weight:700"><span>Diff</span><span style="color:${statusColor}">$${(cash.variance || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</span></div>
        <div style="margin-top:8px;padding:8px 10px;background:${statusBg};border-radius:8px;text-align:center;font-size:13px;font-weight:600;color:${statusColor}">${icon} ${statusText}</div>
        ${!matched && cash.reason ? '<div style="font-size:11px;color:var(--td);margin-top:6px">📝 ' + App.esc(cash.reason) + '</div>' : ''}
      </div>`;
    } else {
      cashHtml = `
      <div class="section-label">💵 Cash on Hand</div>
      <div class="card" style="margin-bottom:16px"><div style="font-size:11px;color:var(--tm)">ยังไม่ได้นับเงิน</div></div>`;
    }
    el.innerHTML += cashHtml;

    const weathers = [
      { key: 'sunny', label: '☀️ แดด' }, { key: 'cloudy', label: '🌤️ ครึ้ม' },
      { key: 'rain', label: '🌧️ ฝน' }, { key: 'heavy_rain', label: '⛈️ ฝนหนัก' },
    ];
    const traffics = [
      { key: 'above', label: '📈 ดีกว่าปกติ' }, { key: 'normal', label: '➡️ ปกติ' },
      { key: 'below', label: '📉 ต่ำกว่าปกติ' },
    ];
    const posOpts = [
      { key: 'ok', label: '✅ ปกติ' }, { key: 'issue', label: '⚠️ มีปัญหา' },
    ];

    el.innerHTML += `
      <!-- Store Context -->
      <div class="section-label">🌤️ สภาพร้านวันนี้</div>
      <div class="card">
        <div class="form-group" style="margin-bottom:10px">
          <div class="form-label">อากาศ</div>
          <div class="pill-group">
            ${weathers.map(w => `<span class="pill ${r.weather === w.key ? 'active' : ''}" onclick="Screens5.s8Pill(this,'weather','${w.key}')">${w.label}</span>`).join('')}
          </div>
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <div class="form-label">Traffic วันนี้</div>
          <div class="pill-group">
            ${traffics.map(t => `<span class="pill ${r.traffic === t.key ? 'active' : ''}" onclick="Screens5.s8Pill(this,'traffic','${t.key}')">${t.label}</span>`).join('')}
          </div>
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <div class="form-label">ระบบ POS / Printer</div>
          <div class="pill-group">
            ${posOpts.map(p => `<span class="pill ${r.pos_status === p.key ? 'active' : ''}" onclick="Screens5.s8Pill(this,'pos_status','${p.key}')">${p.label}</span>`).join('')}
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <div class="form-label">ภาพรวม / Note</div>
          <textarea class="form-input" id="s8-overview" rows="3" placeholder="เช่น ฝนตกหนักช่วงเย็น...">${App.esc(r.overview_note || '')}</textarea>
        </div>
      </div>

      <!-- Customer Insights -->
      <div class="section-label">🧑‍🤝‍🧑 กลุ่มลูกค้าตามช่วงเวลา</div>
      <div class="card">
        <div class="form-group" style="margin-bottom:10px">
          <div class="form-label">🌅 เช้า (open–11:00)</div>
          <input class="form-input" id="s8-cust-morning" placeholder="เช่น คนทำงาน, ลูกค้าประจำ..." value="${App.esc(r.customer_morning || '')}">
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <div class="form-label">☀️ กลางวัน (11:00–14:00)</div>
          <input class="form-input" id="s8-cust-midday" placeholder="เช่น กลุ่มออฟฟิศ, นักเรียน..." value="${App.esc(r.customer_midday || '')}">
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <div class="form-label">🌤️ บ่าย (14:00–17:00)</div>
          <input class="form-input" id="s8-cust-afternoon" placeholder="เช่น แม่ลูก, ลูกค้าสั่งหวาน..." value="${App.esc(r.customer_afternoon || '')}">
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <div class="form-label">🌆 เย็น (17:00–20:00)</div>
          <input class="form-input" id="s8-cust-evening" placeholder="เช่น ฝรั่งมาคู่, after work..." value="${App.esc(r.customer_evening || '')}">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <div class="form-label">🌙 ค่ำ–ปิด (20:00–close)</div>
          <input class="form-input" id="s8-cust-night" placeholder="เช่น วัยรุ่นเอเชีย, Take away..." value="${App.esc(r.customer_night || '')}">
        </div>
      </div>

      <!-- Waste List Question -->
      <div class="section-label">🍞 Waste List</div>
      <div class="card">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px">ขนมปัง / เค้กที่เหลือ?</div>
        <div style="display:flex;gap:8px" id="s8-waste-btns">
          <button class="btn btn-outline" style="flex:1" id="s8-waste-yes" onclick="Screens5.s8WasteAnswer(true)">✅ Yes</button>
          <button class="btn btn-outline" style="flex:1" id="s8-waste-no" onclick="Screens5.s8WasteAnswer(false)">❌ No</button>
        </div>
        <div id="s8-waste-link" style="display:none;margin-top:12px;padding:12px;background:var(--gold-bg);border-radius:10px">
          <div style="font-size:13px;color:var(--td);margin-bottom:8px">กรุณากรอก Waste List ที่ BC Order</div>
          <a href="#" onclick="event.preventDefault();Screens5.s8OpenWaste()" 
             style="display:block;text-align:center;padding:12px;background:var(--gold);color:white;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none">
            🍞 เปิด Waste List →
          </a>
        </div>
        <div id="s8-waste-no-msg" style="display:none;margin-top:8px;padding:8px 12px;background:var(--s1);border-radius:8px;font-size:12px;color:var(--tm)">
          ✅ ไม่มี waste วันนี้
        </div>
      </div>
    `;
  }


  // ═══ TAB 2: เหตุการณ์ + Waste/Leftover ═══

  function renderIncidentsTab(el) {
    let totalCount = 0;
    const catHtml = INCIDENT_CATS.map(c => {
      const st = _incidentState[c.key] || { count: 0, note: '' };
      const isActive = st.count > 0;
      totalCount += st.count;
      return `
        <div class="card" style="padding:12px;margin-bottom:8px;border-left:3px solid ${isActive ? 'var(--gold)' : 'var(--b1)'}">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">${c.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px">${c.name}</div>
              <div style="font-size:11px;color:var(--td)">${c.desc}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button class="cnt-btn" onclick="Screens5.incAdj('${c.key}',-1)">−</button>
              <span style="font-size:14px;font-weight:700;min-width:20px;text-align:center" id="inc-cnt-${c.key}">${st.count}</span>
              <button class="cnt-btn" onclick="Screens5.incAdj('${c.key}',1)">+</button>
            </div>
          </div>
          <div style="margin-top:8px;${isActive ? '' : 'display:none'}" id="inc-note-wrap-${c.key}">
            <input class="form-input" style="font-size:12px;padding:6px 10px" id="inc-note-${c.key}"
                   placeholder="note: รายละเอียด..." value="${App.esc(st.note)}"
                   oninput="Screens5.incNote('${c.key}',this.value)">
          </div>
        </div>`;
    }).join('');

    // Summary badges
    const badges = INCIDENT_CATS.filter(c => (_incidentState[c.key]?.count || 0) > 0).map(c => {
      const st = _incidentState[c.key];
      return `<span style="background:var(--gold-bg);color:var(--gold-dim);padding:3px 8px;border-radius:6px;font-size:11px">${c.icon} ${c.name.split(' ')[0]} ×${st.count}</span>`;
    }).join('');

    el.innerHTML = `
      <div class="section-label" style="margin-top:0">⚠️ เหตุการณ์ — กดจำนวน + ใส่ note</div>
      ${catHtml}
      <div style="margin-top:12px;padding:12px;background:var(--s1);border-radius:10px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;margin-bottom:6px">📊 สรุปเหตุการณ์วันนี้</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="inc-summary">${badges || '<span style="font-size:11px;color:var(--tm)">ไม่มีเหตุการณ์</span>'}</div>
        <div style="font-size:11px;color:var(--tm);margin-top:6px">รวม <strong id="inc-total">${totalCount}</strong> เหตุการณ์</div>
      </div>

      <!-- Waste / Leftover (moved here from tab 1) -->
      <div class="section-label">🍚 อาหารเหลือ</div>
      <div style="font-size:11px;color:var(--tm);margin-bottom:8px">กรอกรายการอาหารที่เหลือประจำวัน</div>
      <div id="s8-leftover-list"></div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 0;cursor:pointer;color:var(--gold);font-size:13px;font-weight:600" onclick="Screens5.addLeftoverRow()">
        ➕ เพิ่มรายการ
      </div>
    `;

    // Render leftover rows
    renderLeftoverList();
  }


  // ═══ TAB 3: ติดตาม ═══

  function renderTasksTab(el) {
    const session = API.getSession();
    const pending = _s8Tasks.filter(t => t.status === 'pending');
    const equipTasks = _s8Tasks.filter(t => t.type === 'equipment');

    el.innerHTML = `
      <!-- Equipment Repair Report -->
      <div class="section-label" style="margin-top:0">🔧 Equipment Repair Report</div>
      <div class="card" style="margin-bottom:12px">
        <div class="form-group" style="margin-bottom:8px">
          <div class="form-label">ชื่ออุปกรณ์ / เครื่อง</div>
          <input class="form-input" id="s8-eq-name" placeholder="เช่น เครื่องทำน้ำแข็ง, เตาอบ...">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <div class="form-label">อาการ</div>
          <input class="form-input" id="s8-eq-symptom" placeholder="เช่น ไม่ทำความเย็น, มีเสียงดัง...">
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <div class="form-label">ความเร่งด่วน</div>
          <select class="form-input" id="s8-eq-urgency">
            <option value="">— เลือก —</option>
            <option value="critical">🔴 ใช้งานไม่ได้ ต้องซ่อมทันที</option>
            <option value="high">🟠 ควรซ่อมเร็ว</option>
            <option value="low">🟡 ไม่รีบ ซ่อมเมื่อมีเวลา</option>
            <option value="dispose">⚫ ไม่ซ่อม — ทิ้ง</option>
          </select>
        </div>
        <button class="btn btn-gold" style="width:100%" onclick="Screens5.s8AddEquipment()">+ แจ้งซ่อม</button>
      </div>

      ${equipTasks.length > 0 ? `
        <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--td)">🔧 รายการแจ้งซ่อม (${equipTasks.length})</div>
        ${equipTasks.map(t => {
          const uMap = { critical: '🔴', high: '🟠', low: '🟡', dispose: '⚫' };
          const icon = uMap[t.priority] || '🔧';
          return '<div class="card" style="margin-bottom:6px;padding:10px;border-left:3px solid var(--orange)"><div style="font-size:13px;font-weight:500">' + icon + ' ' + App.esc(t.title) + '</div>' + (t.note ? '<div style="font-size:11px;color:var(--td);margin-top:2px">' + App.esc(t.note) + '</div>' : '') + '</div>';
        }).join('')}
      ` : ''}

      <!-- Add Task -->
      <div class="section-label">📋 เพิ่มงานติดตาม</div>
      <div class="card" style="margin-bottom:12px">
        <input class="form-input" id="s8-task-title" placeholder="เช่น โทรสั่ง stock เพิ่ม, นัดประชุมทีม..." style="margin-bottom:8px">
        <div style="display:flex;gap:8px">
          <input class="form-input" id="s8-task-assign" placeholder="มอบหมายให้..." style="flex:1">
          <select class="form-input" id="s8-task-priority" style="width:100px">
            <option value="normal">📋 ปกติ</option>
            <option value="urgent">🚨 ด่วน</option>
          </select>
        </div>
        <button class="btn btn-gold" style="width:100%;margin-top:10px" onclick="Screens5.s8AddTask('follow_up')">+ เพิ่มงาน</button>
      </div>

      <!-- Add Suggestion -->
      <div class="section-label">💡 เพิ่ม Suggestion</div>
      <div class="card" style="margin-bottom:16px">
        <input class="form-input" id="s8-sug-title" placeholder="เช่น ลองเพิ่มเมนูใหม่, ปรับ layout..." style="margin-bottom:8px">
        <button class="btn btn-outline" style="width:100%" onclick="Screens5.s8AddTask('suggestion')">+ เพิ่ม Suggestion</button>
      </div>

      <!-- Pending tasks — click to complete -->
      <div class="section-label">⏳ ค้าง (${pending.length})</div>
      <div id="s8-pending-list"></div>
    `;

    // Render pending list
    const listEl = document.getElementById('s8-pending-list');
    if (listEl) {
      if (pending.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--tm);font-size:12px">ไม่มีงานค้าง</div>';
      } else {
        listEl.innerHTML = pending.map(t => {
          const isSug = t.type === 'suggestion';
          const icon = isSug ? '💡' : (t.priority === 'urgent' ? '🚨' : '⏳');
          return `
            <div class="card" style="margin-bottom:6px;padding:12px;cursor:pointer;border-left:3px solid ${isSug ? 'var(--purple)' : (t.priority === 'urgent' ? 'var(--red)' : 'var(--gold)')}" onclick="Screens5.s8CompleteTask('${t.id}')">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:16px">${icon}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:500">${App.esc(t.title)}</div>
                  ${t.assigned_to ? `<div style="font-size:10px;color:var(--tm)">👤 ${App.esc(t.assigned_to)}</div>` : ''}
                </div>
                <span style="font-size:11px;color:var(--green);font-weight:600">กดเสร็จ ✓</span>
              </div>
            </div>`;
        }).join('');
      }
    }
  }


  // ─── LEFTOVER FUNCTIONS ───

  function renderLeftoverList() {
    const el = document.getElementById('s8-leftover-list');
    if (!el) return;
    if (_leftoverItems.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--tm);font-size:12px">ยังไม่มีรายการ — กด ➕ เพิ่ม</div>';
      return;
    }
    el.innerHTML = _leftoverItems.map((item, idx) => `
      <div class="card" style="padding:12px 16px;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:16px">🍞</span>
          <input class="form-input" style="flex:1;padding:6px 10px;font-size:13px"
                 value="${App.esc(item.item_name)}" placeholder="ชื่ออาหาร..."
                 oninput="Screens5.leftoverName(${idx},this.value)">
          <input type="number" class="form-input" style="width:50px;padding:6px 8px;font-size:13px;text-align:center"
                 value="${item.quantity}" min="0"
                 oninput="Screens5.leftoverQty(${idx},this.value)">
          <button class="cnt-btn" onclick="Screens5.removeLeftoverRow(${idx})" style="color:var(--red);border-color:rgba(220,38,38,0.2);font-size:14px">✕</button>
        </div>
        <div class="pill-group">
          ${LEVEL_OPTS.map(lv => `<span class="pill ${item.level === lv.key ? 'active' : ''}" onclick="Screens5.leftoverLevel(${idx},'${lv.key}',this)">${lv.label}</span>`).join('')}
        </div>
      </div>
    `).join('');
  }

  function addLeftoverRow() {
    _leftoverItems.push({ item_name: '', quantity: 1, level: 'half' });
    renderLeftoverList();
    setTimeout(() => {
      const inputs = document.querySelectorAll('#s8-leftover-list input[type="text"]');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 50);
  }

  function removeLeftoverRow(idx) { _leftoverItems.splice(idx, 1); renderLeftoverList(); }
  function leftoverName(idx, val) { if (_leftoverItems[idx]) _leftoverItems[idx].item_name = val; }
  function leftoverQty(idx, val) { if (_leftoverItems[idx]) _leftoverItems[idx].quantity = parseInt(val) || 0; }
  function leftoverLevel(idx, level, el) {
    if (_leftoverItems[idx]) _leftoverItems[idx].level = level;
    el.parentElement.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
  }


  // ─── S8 Helpers ───

  function s8ChangeDate(delta) {
    _reportDate = App.addDays(_reportDate, delta);
    App.go('daily-report');
  }

  function s8Tab(tab) {
    collectFormState();
    _activeTab = tab;
    const el = document.getElementById('s8-content');
    if (el) renderS8Tab(el);
  }

  async function s8AddEquipment() {
    const name = document.getElementById('s8-eq-name')?.value?.trim();
    const symptom = document.getElementById('s8-eq-symptom')?.value?.trim();
    const urgency = document.getElementById('s8-eq-urgency')?.value;
    if (!name) return App.toast('กรุณาใส่ชื่ออุปกรณ์', 'error');
    if (!symptom) return App.toast('กรุณาใส่อาการ', 'error');
    if (!urgency) return App.toast('กรุณาเลือกความเร่งด่วน', 'error');

    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : (API.getSession()?.store_id || null);
      const priority = urgency === 'critical' ? 'urgent' : 'normal';
      await API.createTask({
        store_id: storeId,
        title: '🔧 ' + name,
        note: symptom + ' [' + urgency + ']',
        type: 'equipment',
        priority: priority,
        report_date: _reportDate,
      });
      App.toast('แจ้งซ่อมสำเร็จ ✓', 'success');
      // Clear inputs
      const nameEl = document.getElementById('s8-eq-name'); if (nameEl) nameEl.value = '';
      const symEl = document.getElementById('s8-eq-symptom'); if (symEl) symEl.value = '';
      const urgEl = document.getElementById('s8-eq-urgency'); if (urgEl) urgEl.value = '';
      // Reload tasks
      const taskData = await API.getTasks(storeId);
      _s8Tasks = taskData.tasks || [];
      const el = document.getElementById('s8-content');
      if (el) renderTasksTab(el);
    } catch (err) { App.toast('แจ้งซ่อมไม่สำเร็จ: ' + err.message, 'error'); console.error('s8AddEquipment error:', err); }
    finally { App.hideLoader(); }
  }

  async function s8AddTask(type) {
    const isTask = type === 'follow_up';
    const titleEl = document.getElementById(isTask ? 's8-task-title' : 's8-sug-title');
    const title = (titleEl?.value || '').trim();
    if (!title) { App.toast('กรุณากรอกหัวข้อ', 'error'); return; }

    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : (API.getSession()?.store_id || null);
      await API.createTask({
        store_id: storeId,
        title,
        type,
        assigned_to: isTask ? (document.getElementById('s8-task-assign')?.value || '') : '',
        priority: isTask ? (document.getElementById('s8-task-priority')?.value || 'normal') : 'normal',
        note: '',
        report_date: _reportDate || App.todayStr(),
      });
      App.toast(isTask ? '📋 เพิ่มงานแล้ว' : '💡 เพิ่ม Suggestion แล้ว', 'success');

      // Clear inputs
      if (titleEl) titleEl.value = '';
      if (isTask) {
        const assignEl = document.getElementById('s8-task-assign');
        if (assignEl) assignEl.value = '';
      }

      // Reload tasks
      const data = await API.getTasks(storeId);
      _s8Tasks = data.tasks || [];
      const el = document.getElementById('s8-content');
      if (el) renderTasksTab(el);
      await App.refreshTaskBadge();
    } catch (err) { App.toast('เพิ่มไม่สำเร็จ: ' + err.message, 'error'); console.error('s8AddTask error:', err); }
    finally { App.hideLoader(); }
  }

  async function s8CompleteTask(taskId) {
    try {
      await API.updateTask({ task_id: taskId, status: 'done' });
      App.toast('✅ เสร็จแล้ว', 'success');
      const data = await API.getTasks(null);
      _s8Tasks = data.tasks || [];
      const el = document.getElementById('s8-content');
      if (el) renderTasksTab(el);
      await App.refreshTaskBadge();
    } catch (err) { App.toast(err.message, 'error'); }
  }

  function s8OpenWaste() {
    const session = API.getSession();
    const token = session?.token || '';
    window.open(`https://onspider-spg.github.io/spg-bc-order/?token=${token}#waste`, '_blank');
  }

  function s8WasteAnswer(isYes) {
    if (!_reportData) _reportData = {};
    _reportData.has_waste = isYes;
    const link = document.getElementById('s8-waste-link');
    const noMsg = document.getElementById('s8-waste-no-msg');
    const yesBtn = document.getElementById('s8-waste-yes');
    const noBtn = document.getElementById('s8-waste-no');
    if (isYes) {
      if (link) link.style.display = '';
      if (noMsg) noMsg.style.display = 'none';
      if (yesBtn) { yesBtn.className = 'btn btn-gold'; yesBtn.style.flex = '1'; }
      if (noBtn) { noBtn.className = 'btn btn-outline'; noBtn.style.flex = '1'; }
    } else {
      if (link) link.style.display = 'none';
      if (noMsg) noMsg.style.display = '';
      if (noBtn) { noBtn.className = 'btn btn-gold'; noBtn.style.flex = '1'; }
      if (yesBtn) { yesBtn.className = 'btn btn-outline'; yesBtn.style.flex = '1'; }
    }
  }

  function s8Pill(el, field, value) {
    el.parentElement.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    if (!_reportData) _reportData = {};
    _reportData[field] = value;
  }

  function incAdj(key, delta) {
    if (!_incidentState[key]) _incidentState[key] = { count: 0, note: '' };
    _incidentState[key].count = Math.max(0, _incidentState[key].count + delta);
    const cntEl = document.getElementById('inc-cnt-' + key);
    if (cntEl) cntEl.textContent = _incidentState[key].count;
    const noteWrap = document.getElementById('inc-note-wrap-' + key);
    if (noteWrap) noteWrap.style.display = _incidentState[key].count > 0 ? '' : 'none';
    updateIncSummary();
  }

  function incNote(key, val) {
    if (!_incidentState[key]) _incidentState[key] = { count: 0, note: '' };
    _incidentState[key].note = val;
  }

  function updateIncSummary() {
    let total = 0;
    const badges = INCIDENT_CATS.filter(c => (_incidentState[c.key]?.count || 0) > 0).map(c => {
      const st = _incidentState[c.key];
      total += st.count;
      return `<span style="background:var(--gold-bg);color:var(--gold-dim);padding:3px 8px;border-radius:6px;font-size:11px">${c.icon} ${c.name.split(' ')[0]} ×${st.count}</span>`;
    }).join('');
    const sumEl = document.getElementById('inc-summary');
    if (sumEl) sumEl.innerHTML = badges || '<span style="font-size:11px;color:var(--tm)">ไม่มีเหตุการณ์</span>';
    const totalEl = document.getElementById('inc-total');
    if (totalEl) totalEl.textContent = total;
  }

  function collectFormState() {
    if (!_reportData) _reportData = {};
    const ov = document.getElementById('s8-overview');
    if (ov) _reportData.overview_note = ov.value;
    const fields = ['morning','midday','afternoon','evening','night'];
    fields.forEach(f => {
      const el = document.getElementById('s8-cust-' + f);
      if (el) _reportData['customer_' + f] = el.value;
    });
    INCIDENT_CATS.forEach(c => {
      const noteEl = document.getElementById('inc-note-' + c.key);
      if (noteEl && _incidentState[c.key]) _incidentState[c.key].note = noteEl.value;
    });
  }

  async function s8Save(isSubmit) {
    collectFormState();
    const r = _reportData || {};

    // Validate: ถ้า incident count > 0 ต้องมี note
    for (const c of INCIDENT_CATS) {
      const st = _incidentState[c.key];
      if (st && st.count > 0) {
        const note = (st.note || '').trim();
        if (!note) {
          App.toast(`⚠️ กรุณาใส่รายละเอียด "${c.name}" (มี ${st.count} รายการ)`, 'error');
          return;
        }
      }
    }

    const incidents = INCIDENT_CATS.map(c => ({
      category: c.key,
      count: _incidentState[c.key]?.count || 0,
      note: _incidentState[c.key]?.note || '',
    })).filter(i => i.count > 0);

    try {
      App.showLoader();
      await API.saveDailyReport({
        store_id: API.isHQ() ? API.getSelectedStore() : undefined,
        report_date: _reportDate,
        weather: r.weather,
        traffic: r.traffic,
        pos_status: r.pos_status || null,
        overview_note: r.overview_note,
        customer_morning: r.customer_morning,
        customer_midday: r.customer_midday,
        customer_afternoon: r.customer_afternoon,
        customer_evening: r.customer_evening,
        customer_night: r.customer_night,
        has_waste: r.has_waste != null ? r.has_waste : null,
        is_submitted: isSubmit,
        incidents,
        leftovers: _leftoverItems.filter(l => (l.item_name || '').trim()),
      });
      App.toast('✅ บันทึกแล้ว', 'success');

      // Go to report hub
      setTimeout(() => App.go('report-hub'), 500);
    } catch (err) { App.toast(err.message, 'error'); }
    finally { App.hideLoader(); }
  }

  async function s8CopyReport() {
    collectFormState();
    const r = _reportData || {};
    const session = API.getSession();
    const storeName = session?.store_name || '';
    // ข้อ 4: ใช้ full_name หรือ display_name จาก user (ไม่ใช่ account)
    const displayName = session?.full_name || session?.display_name || session?.user_id || '';
    const s = _s8Summary || {};
    const channels = s.channels || [];
    const channelSum = channels.reduce(function(sum, c) { return sum + (c.amount || 0); }, 0);
    const saleTotal = channelSum;
    const expenses = s.expenses || [];
    const expTotal = expenses.reduce(function(sum, e) { return sum + (e.total_amount || 0); }, 0);
    const cash = s.cash;

    const wMap = { sunny: '☀️ แดด', cloudy: '🌤️ ครึ้ม', rain: '🌧️ ฝน', heavy_rain: '⛈️ ฝนหนัก' };
    const tMap = { above: '📈 ดีกว่าปกติ', normal: '➡️ ปกติ', below: '📉 ต่ำกว่าปกติ' };
    const pMap = { ok: '✅ ปกติ', issue: '⚠️ มีปัญหา' };

    let text = `📋 Daily Report — ${storeName}\n`;
    text += `📅 ${App.formatDate(_reportDate)}\n`;
    text += `🧑 ผู้รายงาน: ${displayName}\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;

    // S1 channels
    text += `💰 ยอดขาย\n`;
    if (channels.length > 0) {
      channels.forEach(function(c) { text += `  ${c.name}: $${(c.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}\n`; });
      text += `  Total: $${saleTotal.toLocaleString(undefined, {minimumFractionDigits:2})}\n`;
    } else { text += `  ยังไม่มีข้อมูล\n`; }
    text += `\n`;

    // S2 expenses
    text += `🧾 ค่าใช้จ่าย\n`;
    if (expenses.length > 0) {
      expenses.forEach(function(e) { text += `  ${e.vendor_name || e.description || '—'}: -$${(e.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits:2})}\n`; });
      text += `  รวม ${expenses.length} รายการ: -$${expTotal.toLocaleString(undefined, {minimumFractionDigits:2})}\n`;
    } else { text += `  ไม่มี\n`; }
    text += `\n`;

    // Cash on Hand
    text += `💵 Cash on Hand\n`;
    if (cash) {
      text += `  Expected: $${(cash.expected || 0).toLocaleString(undefined, {minimumFractionDigits:2})}\n`;
      text += `  Actual: $${(cash.actual || 0).toLocaleString(undefined, {minimumFractionDigits:2})}\n`;
      text += `  Diff: $${(cash.variance || 0).toFixed(2)}\n`;
      text += cash.is_matched ? `  ✅ เงินตรง\n` : `  🔴 เงินไม่ตรง!${cash.reason ? ' — ' + cash.reason : ''}\n`;
    } else { text += `  ยังไม่ได้นับเงิน\n`; }
    text += `\n`;

    // Weather/Traffic
    text += `🌤️ สภาพร้าน\n`;
    text += `  อากาศ: ${wMap[r.weather] || '—'}\n`;
    text += `  Traffic: ${tMap[r.traffic] || '—'}\n`;
    text += `  POS: ${pMap[r.pos_status] || '—'}\n`;
    if (r.overview_note) text += `  📝 ภาพรวม: ${r.overview_note}\n`;
    text += `\n`;

    // Customer insights
    const custs = [
      ['🌅 เช้า', r.customer_morning], ['☀️ กลางวัน', r.customer_midday],
      ['🌤️ บ่าย', r.customer_afternoon], ['🌆 เย็น', r.customer_evening],
      ['🌙 ค่ำ', r.customer_night],
    ].filter(c => c[1]);
    if (custs.length > 0) {
      text += '🧑‍🤝‍🧑 กลุ่มลูกค้า\n';
      custs.forEach(c => { text += `  ${c[0]}: ${c[1]}\n`; });
      text += '\n';
    }

    // Waste — ข้อ 6: ใช้ state จาก _reportData แทน DOM
    const hasWaste = r.has_waste;
    text += `🍞 Waste: ${hasWaste === true ? '✅ มี waste' : hasWaste === false ? '❌ ไม่มี waste' : '— ยังไม่ตอบ'}\n\n`;

    // Incidents
    const activeInc = INCIDENT_CATS.filter(c => (_incidentState[c.key]?.count || 0) > 0);
    if (activeInc.length > 0) {
      const total = activeInc.reduce((s, c) => s + _incidentState[c.key].count, 0);
      text += `⚠️ เหตุการณ์ (${total} รายการ)\n`;
      activeInc.forEach(c => {
        const st = _incidentState[c.key];
        text += `  ${c.icon} ${c.name} ×${st.count}${st.note ? ' — ' + st.note : ''}\n`;
      });
      text += '\n';
    }

    // Leftovers
    const activeLft = _leftoverItems.filter(l => (l.item_name || '').trim());
    if (activeLft.length > 0) {
      const lvMap = { little: '🟢 นิดหน่อย', half: '🟡 ครึ่งนึง', almost_full: '🔴 เกือบหมด', full: '⚫ ทั้งจาน' };
      text += '🍚 อาหารเหลือ\n';
      activeLft.forEach(l => { text += `  ${l.item_name} ×${l.quantity} (${lvMap[l.level] || l.level})\n`; });
      text += '\n';
    }

    // Equipment repairs
    const equipTasks = _s8Tasks.filter(t => t.type === 'equipment');
    if (equipTasks.length > 0) {
      text += `🔧 แจ้งซ่อม (${equipTasks.length})\n`;
      equipTasks.forEach(t => { text += `  ${t.title}${t.note ? ' — ' + t.note : ''}\n`; });
      text += '\n';
    }

    // Follow-up tasks
    const followTasks = _s8Tasks.filter(t => t.type === 'follow_up' && t.status === 'pending');
    if (followTasks.length > 0) {
      text += `📋 งานติดตาม (${followTasks.length})\n`;
      followTasks.forEach(t => { text += `  ${t.priority === 'urgent' ? '🚨' : '⏳'} ${t.title}${t.assigned_to ? ' → ' + t.assigned_to : ''}\n`; });
      text += '\n';
    }

    // Suggestions
    const sugTasks = _s8Tasks.filter(t => t.type === 'suggestion' && t.status === 'pending');
    if (sugTasks.length > 0) {
      text += `💡 Suggestion (${sugTasks.length})\n`;
      sugTasks.forEach(t => { text += `  ${t.title}\n`; });
      text += '\n';
    }

    // Copy
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }

    // Auto-save (no lock)
    try {
      await s8Save(false);
      App.toast('📋 Copy แล้ว! วางใน LINE ได้เลย', 'success');
    } catch (e) {
      App.toast('📋 Copy แล้ว แต่บันทึกไม่สำเร็จ', 'warning');
    }
  }


  // ════════════════════════════════════════
  // STANDALONE REPORT DASHBOARD (nav menu access)
  // ════════════════════════════════════════

  function renderReportDashboard() {
    return renderAdminDashboard(API.getSession());
  }

  async function loadReportDashboard() {
    await loadAdminDashboard();
  }


  // ════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════
  return {
    // Tasks
    renderTasks, loadTasks, filterTasks, toggleTask, toggleTaskFromS8,
    showCreateTask, saveNewTask,
    // S8 Daily Report
    renderDailyReport, loadDailyReport,
    dashMonthNav,
    s8ChangeDate, s8Tab, s8Pill,
    incAdj, incNote,
    s8Save, s8CopyReport,
    s8WasteAnswer, s8OpenWaste,
    s8AddEquipment, s8AddTask, s8CompleteTask,
    // Leftover
    addLeftoverRow, removeLeftoverRow, leftoverName, leftoverQty, leftoverLevel,
    // Report Dashboard (standalone)
    renderReportDashboard, loadReportDashboard,
  };
})();
