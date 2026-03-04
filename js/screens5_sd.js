/**
 * ═══════════════════════════════════════════════════
 * SPG Sale Daily Module — Frontend
 * screens5_sd.js — v1.5.2
 * Tasks + S8 Daily Report (3 tabs) + Admin Dashboard
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
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('dashboard')">←</button>
          <div style="flex:1;min-width:0">
            <div class="header-title">📋 งานติดตาม</div>
            <div class="header-sub">Tasks & Follow-up · ${App.esc(session.store_name)}</div>
          </div>
          ${canCreate ? `<div class="header-right">
            <button class="btn btn-gold" style="font-size:12px;padding:6px 14px" onclick="Screens5.showCreateTask()">+ เพิ่ม</button>
          </div>` : ''}
        </div>
        <div class="screen-body">
          ${API.isHQ() ? App.renderStoreSelector() : ''}
          <div style="display:flex;gap:0;background:var(--s1);border-radius:12px;padding:3px;margin-bottom:12px">
            <button class="tab-pill ${_taskFilter === 'pending' ? 'active' : ''}" onclick="Screens5.filterTasks('pending')">⏳ ค้าง</button>
            <button class="tab-pill ${_taskFilter === 'done' ? 'active' : ''}" onclick="Screens5.filterTasks('done')">✅ เสร็จ</button>
            <button class="tab-pill ${_taskFilter === 'all' ? 'active' : ''}" onclick="Screens5.filterTasks('all')">📋 ทั้งหมด</button>
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
      const status = _taskFilter === 'all' ? undefined : _taskFilter;
      const data = await API.getTasks(API.isHQ() ? API.getSelectedStore() : null, status);
      _tasks = data.tasks || [];
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
      const icon = isSuggestion ? '💡' : (isDone ? '✅' : (isUrgent ? '🚨' : '⏳'));
      const borderColor = isDone ? 'var(--green)' : (isUrgent ? 'var(--red)' : (isSuggestion ? 'var(--purple)' : 'var(--gold)'));

      return `
        <div class="card" style="margin-bottom:8px;border-left:3px solid ${borderColor};${isDone ? 'opacity:0.6' : ''}">
          <div style="display:flex;align-items:flex-start;gap:10px">
            ${canEdit ? `<div style="font-size:18px;cursor:pointer;padding-top:2px" onclick="Screens5.toggleTask('${t.id}', '${isDone ? 'pending' : 'done'}')">${icon}</div>` : `<div style="font-size:18px;padding-top:2px">${icon}</div>`}
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px;${isDone ? 'text-decoration:line-through' : ''}">${App.esc(t.title)}</div>
              ${t.note ? `<div style="font-size:12px;color:var(--td);margin-top:2px">${App.esc(t.note)}</div>` : ''}
              <div style="font-size:10px;color:var(--tm);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap">
                ${t.assigned_to ? `<span>👤 ${App.esc(t.assigned_to)}</span>` : ''}
                ${isSuggestion ? '<span style="background:var(--purple-bg);color:var(--purple);font-size:9px;padding:1px 6px;border-radius:4px">💡 Suggestion</span>' : ''}
                <span>${new Date(t.created_at).toLocaleDateString('th-TH')}</span>
                ${isDone && t.completed_at ? `<span style="color:var(--green)">เสร็จ ${new Date(t.completed_at).toLocaleDateString('th-TH')}</span>` : ''}
              </div>
            </div>
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
          <select class="form-select" id="task-type">
            <option value="follow_up">📋 Follow-up</option>
            <option value="suggestion">💡 Suggestion</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">มอบหมายให้</label>
          <input type="text" class="form-input" id="task-assign" placeholder="เช่น พี่ชวัญ, ทีม QC">
        </div>
        <div class="form-group">
          <label class="form-label">ระดับ</label>
          <select class="form-select" id="task-priority">
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
    { key: 'equipment', icon: '🔧', name: 'Equipment / อุปกรณ์', desc: 'เครื่องเสีย, printer, เครื่องทำน้ำแข็ง' },
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
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('report-hub')">←</button>
          <div style="flex:1;min-width:0">
            <div class="header-title">📝 Daily Report</div>
            <div class="header-sub">S8 สรุปรายงาน · ${App.esc(session.store_name)}</div>
          </div>
          <button class="back-btn" onclick="App.toggleSidebar()" style="font-size:16px">☰</button>
        </div>
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

          <!-- Bottom: single save button -->
          <div style="display:flex;gap:8px;margin-top:16px;padding-bottom:20px">
            <button class="btn btn-gold" style="flex:1" onclick="Screens5.s8Save(false)">บันทึก</button>
            <button class="btn btn-outline" style="flex:1" onclick="Screens5.s8CopyReport()">📋 Copy Report</button>
          </div>
        </div>
      </div>`;
  }

  // ─── ADMIN DASHBOARD VIEW ───

  function renderAdminDashboard(session) {
    _reportDate = _reportDate || App.todayStr();
    return `
      <div class="screen">
        <div class="header-bar">
          <button class="back-btn" onclick="App.go('report-hub')">←</button>
          <div style="flex:1;min-width:0">
            <div class="header-title">📊 S8 Report Dashboard</div>
            <div class="header-sub">ภาพรวมเหตุการณ์ · ${App.esc(session.store_name)}</div>
          </div>
          <button class="back-btn" onclick="App.toggleSidebar()" style="font-size:16px">☰</button>
        </div>
        <div class="screen-body">
          ${App.renderStoreSelector ? App.renderStoreSelector() : ''}

          <!-- Date range -->
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0 12px;font-size:14px;font-weight:600">
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens5.s8ChangeDate(-1)">‹</span>
            <span>📅 ${App.formatDate(_reportDate)}</span>
            <span style="cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;background:var(--s1)" onclick="Screens5.s8ChangeDate(1)">›</span>
          </div>

          <div id="admin-dashboard-content">
            <div style="text-align:center;padding:20px;color:var(--tm)">กำลังโหลด...</div>
          </div>
        </div>
      </div>`;
  }

  async function loadAdminDashboard() {
    const el = document.getElementById('admin-dashboard-content');
    if (!el) return;
    try {
      App.showLoader();
      const storeId = API.isHQ() ? API.getSelectedStore() : null;
      const [reportData, summaryData, taskData] = await Promise.all([
        API.getDailyReport(storeId, _reportDate),
        API.getS8Summary(storeId, _reportDate),
        API.getTasks(storeId),
      ]);

      const r = reportData.report;
      const s = summaryData;
      const incidents = reportData.incidents || [];
      const leftovers = reportData.leftovers || [];
      const tasks = taskData.tasks || [];
      const pendingTasks = tasks.filter(t => t.status === 'pending');

      const wMap = { sunny: '☀️ แดด', cloudy: '🌤️ ครึ้ม', rain: '🌧️ ฝน', heavy_rain: '⛈️ ฝนหนัก' };
      const tMap = { above: '📈 ดี', normal: '➡️ ปกติ', below: '📉 ต่ำ' };

      // KPI Cards
      const totalInc = incidents.reduce((s, i) => s + (i.count || 0), 0);
      const saleTotal = s.sale ? (s.sale.total_sales || 0) : 0;
      const expTotal = s.expense_total || 0;

      // Incident breakdown
      const incHtml = incidents.filter(i => i.count > 0).map(i => {
        const cat = INCIDENT_CATS.find(c => c.key === i.category) || {};
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--s2)">
          <span style="font-size:16px">${cat.icon || '⚠️'}</span>
          <span style="flex:1;font-size:13px;font-weight:500">${cat.name || i.category}</span>
          <span style="font-weight:700;font-size:14px;color:var(--gold-dim)">×${i.count}</span>
        </div>`;
      }).join('') || '<div style="text-align:center;color:var(--tm);padding:12px;font-size:12px">ไม่มีเหตุการณ์</div>';

      // Leftover summary
      const lvMap = { little: '🟢', half: '🟡', almost_full: '🔴', full: '⚫' };
      const lftHtml = leftovers.map(l =>
        `<span style="background:var(--s1);padding:3px 8px;border-radius:6px;font-size:11px">${lvMap[l.level] || '🟡'} ${App.esc(l.item_name)} ×${l.quantity}</span>`
      ).join(' ') || '<span style="font-size:12px;color:var(--tm)">ไม่มีรายการ</span>';

      el.innerHTML = `
        <!-- KPI -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
          <div class="card" style="text-align:center;padding:14px 8px">
            <div style="font-size:10px;color:var(--td)">💰 ยอดขาย</div>
            <div style="font-size:18px;font-weight:700;color:var(--gold-dim)">${saleTotal > 0 ? '$' + saleTotal.toLocaleString() : '—'}</div>
          </div>
          <div class="card" style="text-align:center;padding:14px 8px">
            <div style="font-size:10px;color:var(--td)">🧾 ค่าใช้จ่าย</div>
            <div style="font-size:18px;font-weight:700;color:var(--red)">${expTotal > 0 ? '$' + expTotal.toLocaleString() : '—'}</div>
          </div>
          <div class="card" style="text-align:center;padding:14px 8px">
            <div style="font-size:10px;color:var(--td)">⚠️ เหตุการณ์</div>
            <div style="font-size:18px;font-weight:700;color:${totalInc > 0 ? 'var(--orange)' : 'var(--green)'}">${totalInc}</div>
          </div>
        </div>

        <!-- Store Context -->
        ${r ? `<div class="card" style="margin-bottom:12px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px">
            <span style="background:var(--s1);padding:4px 10px;border-radius:6px">${wMap[r.weather] || '—'}</span>
            <span style="background:var(--s1);padding:4px 10px;border-radius:6px">Traffic: ${tMap[r.traffic] || '—'}</span>
            <span style="background:var(--s1);padding:4px 10px;border-radius:6px">POS: ${r.pos_status === 'ok' ? '✅' : '⚠️'}</span>
          </div>
          ${r.overview_note ? `<div style="font-size:12px;color:var(--td);margin-top:8px">📝 ${App.esc(r.overview_note)}</div>` : ''}
        </div>` : '<div style="padding:16px;text-align:center;color:var(--tm);font-size:12px;background:var(--s1);border-radius:10px;margin-bottom:12px">ยังไม่มีรีพอร์ตวันนี้</div>'}

        <!-- Incidents -->
        <div class="section-label">⚠️ เหตุการณ์</div>
        <div class="card" style="margin-bottom:12px">${incHtml}</div>

        <!-- Leftovers -->
        <div class="section-label">🍞 ของเหลือ</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${lftHtml}</div>

        <!-- Tasks -->
        <div class="section-label">📋 งานค้าง (${pendingTasks.length})</div>
        <div class="card">
          <div id="admin-task-list"></div>
        </div>
      `;

      // Render embedded task list
      const taskEl = document.getElementById('admin-task-list');
      if (taskEl) renderTaskListEmbedded(taskEl, pendingTasks.slice(0, 10));

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
    // Update tab highlight
    document.querySelectorAll('#s8-tabs .tab-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === _activeTab);
    });

    if (_activeTab === 'overview') renderOverviewTab(el);
    else if (_activeTab === 'incidents') renderIncidentsTab(el);
    else if (_activeTab === 'tasks') renderTasksTab(el);
  }


  // ═══ TAB 1: ภาพรวม ═══

  function renderOverviewTab(el) {
    const r = _reportData || {};
    const s = _s8Summary || {};

    // S1/S2 summary
    const sale = s.sale;
    const saleTotal = sale ? (sale.total_sales || 0) : 0;
    const expTotal = s.expense_total || 0;
    const expCount = (s.expenses || []).length;

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

    el.innerHTML = `
      <!-- S1/S2 Auto-pull -->
      <div class="section-label" style="margin-top:0">💰 ยอดขาย / ค่าใช้จ่ายวันนี้</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div class="card" style="text-align:center;padding:14px;border-left:3px solid var(--gold)">
          <div style="font-size:11px;color:var(--td)">💰 S1 ยอดขาย</div>
          <div style="font-size:20px;font-weight:700;color:var(--gold-dim);margin:4px 0">${saleTotal > 0 ? '$' + saleTotal.toLocaleString() : '—'}</div>
          <div style="font-size:10px;color:var(--tm)">${sale ? (sale.fin_synced ? '✅ synced' : '📝 draft') : 'ยังไม่ได้กรอก'}</div>
        </div>
        <div class="card" style="text-align:center;padding:14px;border-left:3px solid var(--red)">
          <div style="font-size:11px;color:var(--td)">🧾 S2 ค่าใช้จ่าย</div>
          <div style="font-size:20px;font-weight:700;color:var(--red);margin:4px 0">${expTotal > 0 ? '$' + expTotal.toLocaleString() : '—'}</div>
          <div style="font-size:10px;color:var(--tm)">${expCount > 0 ? expCount + ' รายการ' : 'ยังไม่มี'}</div>
        </div>
      </div>

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
            ${posOpts.map(p => `<span class="pill ${(r.pos_status || 'ok') === p.key ? 'active' : ''}" onclick="Screens5.s8Pill(this,'pos_status','${p.key}')">${p.label}</span>`).join('')}
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
      <div class="section-label">🍞 Waste List — ขนมปัง / เค้กที่เหลือ</div>
      <div style="font-size:11px;color:var(--tm);margin-bottom:8px">กรอกรายการที่เหลือ → save เก็บเข้า waste database</div>
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
    const canCreate = session && session.tier_level <= 4;
    const pending = _s8Tasks.filter(t => t.status === 'pending');
    const done = _s8Tasks.filter(t => t.status === 'done');

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="section-label" style="margin:0">📋 งานติดตาม</div>
        ${canCreate ? `<button class="btn btn-gold" style="font-size:11px;padding:5px 12px" onclick="Screens5.showCreateTask()">+ เพิ่ม</button>` : ''}
      </div>

      <!-- Pending -->
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;color:var(--td);margin-bottom:6px">⏳ ค้าง (${pending.length})</div>
        <div class="card" id="s8-tasks-pending">
          <div style="text-align:center;padding:12px;color:var(--tm);font-size:12px">กำลังโหลด...</div>
        </div>
      </div>

      <!-- Done -->
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--td);margin-bottom:6px">✅ เสร็จ (${done.length})</div>
        <div class="card" id="s8-tasks-done">
          <div style="text-align:center;padding:12px;color:var(--tm);font-size:12px">กำลังโหลด...</div>
        </div>
      </div>
    `;

    const pendEl = document.getElementById('s8-tasks-pending');
    const doneEl = document.getElementById('s8-tasks-done');
    if (pendEl) renderTaskListEmbedded(pendEl, pending);
    if (doneEl) renderTaskListEmbedded(doneEl, done.slice(0, 10));
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
                 value="${App.esc(item.item_name)}" placeholder="ชื่อขนมปัง/เค้ก..."
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
        pos_status: r.pos_status || 'ok',
        overview_note: r.overview_note,
        customer_morning: r.customer_morning,
        customer_midday: r.customer_midday,
        customer_afternoon: r.customer_afternoon,
        customer_evening: r.customer_evening,
        customer_night: r.customer_night,
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

  function s8CopyReport() {
    collectFormState();
    const r = _reportData || {};
    const session = API.getSession();
    const storeName = session?.store_name || '';
    const displayName = session?.display_name || '';
    const s = _s8Summary || {};
    const saleTotal = s.sale ? (s.sale.total_sales || 0) : 0;
    const expTotal = s.expense_total || 0;

    const wMap = { sunny: '☀️ แดด', cloudy: '🌤️ ครึ้ม', rain: '🌧️ ฝน', heavy_rain: '⛈️ ฝนหนัก' };
    const tMap = { above: '📈 ดีกว่าปกติ', normal: '➡️ ปกติ', below: '📉 ต่ำกว่าปกติ' };
    const pMap = { ok: '✅ ปกติ', issue: '⚠️ มีปัญหา' };

    let text = `🗓️ Daily Report — ${storeName}\n`;
    text += `📅 ${App.formatDate(_reportDate)}\n`;
    text += `🧑 คนเขียน: ${displayName}\n\n`;

    // S1/S2
    if (saleTotal > 0 || expTotal > 0) {
      text += `💰 ยอดขาย: $${saleTotal.toLocaleString()} | 🧾 ค่าใช้จ่าย: $${expTotal.toLocaleString()}\n\n`;
    }

    text += `🌤️ อากาศ: ${wMap[r.weather] || '—'} | Traffic: ${tMap[r.traffic] || '—'} | POS: ${pMap[r.pos_status] || '—'}\n\n`;

    if (r.overview_note) text += `📝 ภาพรวม: ${r.overview_note}\n\n`;

    // Customer insights
    const custs = [
      ['🌅 เช้า', r.customer_morning],
      ['☀️ กลางวัน', r.customer_midday],
      ['🌤️ บ่าย', r.customer_afternoon],
      ['🌆 เย็น', r.customer_evening],
      ['🌙 ค่ำ', r.customer_night],
    ].filter(c => c[1]);
    if (custs.length > 0) {
      text += '🧑‍🤝‍🧑 กลุ่มลูกค้า:\n';
      custs.forEach(c => { text += `${c[0]}: ${c[1]}\n`; });
      text += '\n';
    }

    // Incidents
    const activeInc = INCIDENT_CATS.filter(c => (_incidentState[c.key]?.count || 0) > 0);
    if (activeInc.length > 0) {
      const total = activeInc.reduce((s, c) => s + _incidentState[c.key].count, 0);
      text += `⚠️ เหตุการณ์ (${total} รายการ)\n`;
      activeInc.forEach(c => {
        const st = _incidentState[c.key];
        text += `${c.icon} ${c.name} ×${st.count}`;
        if (st.note) text += ` — ${st.note}`;
        text += '\n';
      });
      text += '\n';
    }

    // Leftovers
    const activeLft = _leftoverItems.filter(l => (l.item_name || '').trim());
    if (activeLft.length > 0) {
      const lvMap = { little: '🟢 นิดหน่อย', half: '🟡 ครึ่งนึง', almost_full: '🔴 เกือบหมด', full: '⚫ ทั้งจาน' };
      text += '🍞 Waste List:\n';
      activeLft.forEach(l => {
        text += `${l.item_name} ×${l.quantity} (${lvMap[l.level] || l.level})\n`;
      });
      text += '\n';
    }

    // Pending tasks
    const pendingTasks = _s8Tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length > 0) {
      text += `📋 งานค้าง (${pendingTasks.length})\n`;
      pendingTasks.slice(0, 5).forEach(t => {
        text += `${t.priority === 'urgent' ? '🚨' : '⏳'} ${t.title}`;
        if (t.assigned_to) text += ` → ${t.assigned_to}`;
        text += '\n';
      });
    }

    // Copy
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        App.toast('📋 Copy แล้ว! วางใน LINE ได้เลย', 'success');
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      App.toast('📋 Copy แล้ว!', 'success');
    }

    // Also save
    s8Save(false);
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
    s8ChangeDate, s8Tab, s8Pill,
    incAdj, incNote,
    s8Save, s8CopyReport,
    // Leftover
    addLeftoverRow, removeLeftoverRow, leftoverName, leftoverQty, leftoverLevel,
  };
})();
