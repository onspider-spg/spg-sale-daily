-- ═══════════════════════════════════════════════════════════════
-- 008_register_sale_daily_module.sql
-- Register Sale Daily in Home module system
-- Run AFTER all Sale Daily tables are created (003-007)
-- ═══════════════════════════════════════════════════════════════

-- ① Register Module
-- ⚠️ แก้ app_url ให้ตรงกับ GitHub Pages URL จริง
INSERT INTO modules (module_id, module_name, module_name_en, description, icon, app_url, is_standalone, status, sort_order, created_at, updated_at)
VALUES (
  'sale_daily',
  'ยอดขายรายวัน',
  'Sale Daily',
  'Daily Sales + Expense + Invoice + Cash → auto-push Finance',
  '💰',
  'https://sale-daily.spgapp.com.au',  -- ⚠️ CHANGE to actual GitHub Pages URL
  TRUE,
  'active',
  2,
  now(), now()
)
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  app_url = EXCLUDED.app_url,
  status = EXCLUDED.status,
  updated_at = now();

-- ② Module Permissions (all 7 tiers)
-- T1-T2: super_admin/admin, T3-T5: edit, T6-T7: view
INSERT INTO module_permissions (perm_id, tier_id, module_id, access_level, updated_at) VALUES
  ('PRM-SD-01', 'T1', 'sale_daily', 'super_admin', now()),
  ('PRM-SD-02', 'T2', 'sale_daily', 'admin',       now()),
  ('PRM-SD-03', 'T3', 'sale_daily', 'edit',        now()),
  ('PRM-SD-04', 'T4', 'sale_daily', 'edit',        now()),
  ('PRM-SD-05', 'T5', 'sale_daily', 'edit',        now()),
  ('PRM-SD-06', 'T6', 'sale_daily', 'view_only',   now()),
  ('PRM-SD-07', 'T7', 'sale_daily', 'view_only',   now())
ON CONFLICT (perm_id) DO NOTHING;

-- ③ Data Bridge Config (Sale Daily → Finance)
INSERT INTO data_bridge_config (bridge_id, source_module, data_type, target_module, is_enabled, description)
VALUES
  ('BRG-SD-01', 'sale_daily', 'daily_income',   'finance', TRUE,  'Daily sale channels → Finance Income [Pending]'),
  ('BRG-SD-02', 'sale_daily', 'daily_expense',  'finance', TRUE,  'Daily expenses → Finance Expense [Paid]'),
  ('BRG-SD-03', 'sale_daily', 'invoice',        'finance', TRUE,  'Invoices → Finance Expense [Paid/Unpaid]'),
  ('BRG-SD-04', 'sale_daily', 'cash_on_hand',   'finance', FALSE, 'Cash count → Finance cross-check (read-only)')
ON CONFLICT (bridge_id) DO NOTHING;

-- ④ Verify
SELECT 'Module' as check_type, module_id, status FROM modules WHERE module_id = 'sale_daily'
UNION ALL
SELECT 'Permissions', tier_id || ' → ' || access_level, module_id FROM module_permissions WHERE module_id = 'sale_daily'
UNION ALL
SELECT 'Bridge', bridge_id, source_module || ' → ' || target_module FROM data_bridge_config WHERE source_module = 'sale_daily';
