-- ═══════════════════════════════════════════
-- 007_sd_audit_log.sql
-- Sale Daily Admin Audit Trail
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sd_audit_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action        text NOT NULL,           -- e.g. update_channel, update_permission
  target_type   text NOT NULL,           -- e.g. channel_config, vendor_master
  target_id     text NOT NULL,           -- e.g. channel_id, vendor_id
  old_value     jsonb,
  new_value     jsonb,
  changed_by    text,
  changed_by_name text,
  store_id      text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_sd_audit_action ON sd_audit_log(action);
CREATE INDEX idx_sd_audit_target ON sd_audit_log(target_type, target_id);
CREATE INDEX idx_sd_audit_date ON sd_audit_log(created_at DESC);

-- RLS
ALTER TABLE sd_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sd_audit_select" ON sd_audit_log
  FOR SELECT USING (true);

CREATE POLICY "sd_audit_insert" ON sd_audit_log
  FOR INSERT WITH CHECK (true);
