-- ═══════════════════════════════════════════════════════════════
-- SPG Sale Daily Module — Combined SQL Migration
-- Run in Supabase SQL Editor
-- Order: 003 → 004 → 005 → 006 → 007
-- ═══════════════════════════════════════════════════════════════
-- ⚠️ แนะนำ: Run ทีละ section (copy-paste ระหว่าง dividers)
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- SECTION 1/5: 003_sale_daily_tables.sql
-- Core tables + RLS + Indexes
-- ═══════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════
-- SPG Sale Daily Module — Migration Phase 1
-- File: supabase/migrations/003_sale_daily_tables.sql
-- Version: 1.3 — March 2026
-- 
-- Creates: 9 tables + RLS policies + indexes + storage bucket
-- Depends on: 001_home_tables.sql (stores, accounts, access_tiers)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 0. PRE-FLIGHT: Register module + helper function
-- ─────────────────────────────────────────────

-- Register sale_daily in modules table (if not exists)
INSERT INTO modules (module_id, module_name, module_name_en, description, icon, app_url, is_standalone, status, sort_order, created_at, updated_at)
VALUES ('sale_daily', 'ยอดขายรายวัน', 'Sale Daily', 'Daily sales, expenses, invoices & cash reconciliation', '📊', 'https://sale-daily.spgapp.com.au', TRUE, 'active', 5, now(), now())
ON CONFLICT (module_id) DO UPDATE SET status = 'active', updated_at = now();

-- Helper: get tier_level from session (used in RLS)
CREATE OR REPLACE FUNCTION sd_get_tier_level()
RETURNS int AS $$
  SELECT COALESCE(
    (SELECT at.tier_level 
     FROM accounts a 
     JOIN access_tiers at ON at.tier_id = a.tier_id
     WHERE a.account_id = current_setting('app.account_id', true)),
    99
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get store_id from session
CREATE OR REPLACE FUNCTION sd_get_store_id()
RETURNS text AS $$
  SELECT COALESCE(
    (SELECT store_id FROM accounts 
     WHERE account_id = current_setting('app.account_id', true)),
    ''
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get dept_id from session
CREATE OR REPLACE FUNCTION sd_get_dept_id()
RETURNS text AS $$
  SELECT COALESCE(
    (SELECT dept_id FROM accounts 
     WHERE account_id = current_setting('app.account_id', true)),
    ''
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════
-- 1. sd_channel_config — Sales channel configuration per store
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_channel_config (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        text NOT NULL REFERENCES stores(store_id),
    channel_key     text NOT NULL,
    channel_label   text NOT NULL,
    finance_sub_category text NOT NULL,
    dashboard_group text NOT NULL CHECK (dashboard_group IN ('card_sale', 'cash_sale', 'delivery_sale', 'other')),
    is_enabled      boolean NOT NULL DEFAULT true,
    sort_order      int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      text,

    UNIQUE (store_id, channel_key)
);

COMMENT ON TABLE sd_channel_config IS 'Sales channel configuration per store — maps to Finance Sub Category + Dashboard Group';


-- ═══════════════════════════════════════════════════════════════════
-- 2. sd_store_settings — Per-store operational settings
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_store_settings (
    store_id                text PRIMARY KEY REFERENCES stores(store_id),
    cutoff_time             time NOT NULL DEFAULT '23:59:00',
    backdate_limit_days     int NOT NULL DEFAULT 2,
    require_photos          boolean NOT NULL DEFAULT true,
    cash_mismatch_tolerance numeric(8,2) NOT NULL DEFAULT 2.00,
    auto_finance_push       boolean NOT NULL DEFAULT true,
    default_bank_account    text NOT NULL DEFAULT '4410 #PettyCash&Card',
    updated_by              text,
    updated_at              timestamptz DEFAULT now()
);

COMMENT ON TABLE sd_store_settings IS 'Per-store settings: cutoff, backdate limit, photo requirements, cash tolerance, finance auto-push';


-- ═══════════════════════════════════════════════════════════════════
-- 3. sd_suppliers — Vendor/supplier list per store
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_suppliers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        text NOT NULL REFERENCES stores(store_id),
    supplier_name   text NOT NULL,
    vendor_master_id uuid,                          -- FK → future vendor_master table
    payment_methods text[] NOT NULL DEFAULT '{cash,card}',
    is_special_track boolean NOT NULL DEFAULT false,
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      text
);

COMMENT ON TABLE sd_suppliers IS 'Supplier list per store — staff can create new vendors instantly (no approval needed)';

-- Index for quick lookup
CREATE INDEX idx_sd_suppliers_store ON sd_suppliers (store_id, is_active);


-- ═══════════════════════════════════════════════════════════════════
-- 4. sd_function_permissions — 30 functions × 7 tiers
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_function_permissions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    function_key    text NOT NULL,
    function_name   text NOT NULL,
    function_group  text NOT NULL CHECK (function_group IN ('sales', 'expenses', 'invoices', 'cash', 'reports', 'admin')),
    tier_id         text NOT NULL REFERENCES access_tiers(tier_id),
    is_allowed      boolean NOT NULL DEFAULT false,
    updated_by      text,
    updated_at      timestamptz DEFAULT now(),

    UNIQUE (function_key, tier_id)
);

COMMENT ON TABLE sd_function_permissions IS 'Function-level permissions: 30 functions × 7 tiers, toggle by T1-T2 admin';

-- Index for permission checks
CREATE INDEX idx_sd_func_perm_tier ON sd_function_permissions (tier_id, is_allowed);


-- ═══════════════════════════════════════════════════════════════════
-- 5. sd_daily_sales ★ — Daily sales header (1 row = 1 store × 1 day)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_daily_sales (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id            text NOT NULL REFERENCES stores(store_id),
    sale_date           date NOT NULL,
    total_sales         numeric(12,2) NOT NULL DEFAULT 0,
    difference          numeric(12,2),
    cancel_desc         text,
    cancel_amount       numeric(12,2),
    cancel_reason       text,
    cancel_approved_by  text,
    photo_card_url      text NOT NULL,              -- 📸 Card summary (mandatory)
    photo_cash_url      text NOT NULL,              -- 📸 Cash count (mandatory)
    fin_synced          boolean NOT NULL DEFAULT false,
    is_locked           boolean NOT NULL DEFAULT false,
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          text,
    updated_at          timestamptz DEFAULT now(),

    UNIQUE (store_id, sale_date)
);

COMMENT ON TABLE sd_daily_sales IS 'Daily sales header — 1 row per store per day, channels in sd_sale_channels';

-- Performance index
CREATE INDEX idx_sd_daily_sales_date ON sd_daily_sales (store_id, sale_date DESC);


-- ═══════════════════════════════════════════════════════════════════
-- 6. sd_sale_channels ★ — Normalized channel amounts per day
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_sale_channels (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_sale_id       uuid NOT NULL REFERENCES sd_daily_sales(id) ON DELETE CASCADE,
    channel_key         text NOT NULL,
    amount              numeric(12,2) NOT NULL CHECK (amount >= 0),
    fin_transaction_id  uuid,                       -- FK → Finance record (auto-created)

    UNIQUE (daily_sale_id, channel_key)
);

COMMENT ON TABLE sd_sale_channels IS 'Normalized sales per channel per day — replaces fixed ch_eftpos1, ch_cash columns';

-- Performance index for finance lookup
CREATE INDEX idx_sd_sale_channels_fin ON sd_sale_channels (fin_transaction_id) WHERE fin_transaction_id IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- 7. sd_expenses — Daily expenses + Finance bridge fields
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_expenses (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id            text NOT NULL REFERENCES stores(store_id),
    expense_date        date NOT NULL,
    doc_number          text NOT NULL,              -- Bill number (staff enters)
    vendor_name         text NOT NULL,              -- From Vendor DB
    main_category       text NOT NULL,              -- Cascade: COGs, Utilities, etc.
    sub_category        text NOT NULL,              -- Filtered by main: Food, Beverage, etc.
    description         text NOT NULL,
    amount_ex_gst       numeric(12,2) NOT NULL,
    gst                 numeric(12,2) NOT NULL DEFAULT 0,
    total_amount        numeric(12,2) NOT NULL GENERATED ALWAYS AS (amount_ex_gst + gst) STORED,
    payment_method      text NOT NULL CHECK (payment_method IN ('cash', 'card')),
    accrual_month       date NOT NULL,              -- First of month (auto, editable)
    photo_url           text NOT NULL,              -- 📸 Receipt (mandatory)
    fin_transaction_id  uuid,                       -- FK → Finance record
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          text,
    updated_at          timestamptz DEFAULT now()
);

COMMENT ON TABLE sd_expenses IS 'Daily expenses — staff enters 8 fields, Finance gets full 25 columns via bridge';

-- Indexes
CREATE INDEX idx_sd_expenses_store_date ON sd_expenses (store_id, expense_date DESC);
CREATE INDEX idx_sd_expenses_fin ON sd_expenses (fin_transaction_id) WHERE fin_transaction_id IS NOT NULL;
CREATE INDEX idx_sd_expenses_vendor ON sd_expenses (store_id, vendor_name);


-- ═══════════════════════════════════════════════════════════════════
-- 8. sd_invoices — Invoices + Finance bridge fields
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_invoices (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id            text NOT NULL REFERENCES stores(store_id),
    invoice_date        date NOT NULL,
    invoice_no          text NOT NULL,
    vendor_name         text NOT NULL,
    main_category       text NOT NULL,
    sub_category        text NOT NULL,
    description         text NOT NULL,
    amount_ex_gst       numeric(12,2) NOT NULL,
    gst                 numeric(12,2) NOT NULL DEFAULT 0,
    total_amount        numeric(12,2) NOT NULL GENERATED ALWAYS AS (amount_ex_gst + gst) STORED,
    issue_amount        numeric(12,2) NOT NULL DEFAULT 0,
    payment_status      text NOT NULL CHECK (payment_status IN ('paid', 'unpaid')),
    payment_date        date,                       -- Required if paid
    due_date            date,                       -- Required if unpaid
    payment_method      text,                       -- Required if paid: cash / card
    accrual_month       date NOT NULL,
    photo_url           text NOT NULL,              -- 📸 Invoice (mandatory)
    note                text,
    fin_transaction_id  uuid,                       -- FK → Finance record
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          text,
    updated_at          timestamptz DEFAULT now(),

    UNIQUE (store_id, invoice_no),

    -- Conditional validation
    CONSTRAINT chk_paid_fields CHECK (
        (payment_status = 'paid' AND payment_date IS NOT NULL) OR
        (payment_status = 'unpaid' AND due_date IS NOT NULL) OR
        (payment_status IS NULL)
    )
);

COMMENT ON TABLE sd_invoices IS 'Invoices — like expenses but with selectable payment status (Paid/Unpaid) + due date';

-- Indexes
CREATE INDEX idx_sd_invoices_store_date ON sd_invoices (store_id, invoice_date DESC);
CREATE INDEX idx_sd_invoices_fin ON sd_invoices (fin_transaction_id) WHERE fin_transaction_id IS NOT NULL;
CREATE INDEX idx_sd_invoices_unpaid ON sd_invoices (store_id, payment_status) WHERE payment_status = 'unpaid';


-- ═══════════════════════════════════════════════════════════════════
-- 9. sd_cash_on_hand — Cash validation with auto-calculation
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE sd_cash_on_hand (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id            text NOT NULL REFERENCES stores(store_id),
    cash_date           date NOT NULL,
    cash_sale           numeric(12,2) NOT NULL DEFAULT 0,  -- Auto from S1 cash channel
    cash_expend         numeric(12,2) NOT NULL DEFAULT 0,  -- Auto from S2 cash expenses
    expected_cash       numeric(12,2) NOT NULL GENERATED ALWAYS AS (cash_sale - cash_expend) STORED,
    actual_cash         numeric(12,2),                      -- Manual count by staff
    difference          numeric(12,2) GENERATED ALWAYS AS (actual_cash - (cash_sale - cash_expend)) STORED,
    is_matched          boolean NOT NULL DEFAULT false,
    mismatch_reason     text,                               -- Required if |diff| > $2
    handover_status     text NOT NULL DEFAULT 'with_cashier' 
                        CHECK (handover_status IN ('with_cashier', 'manager', 'owner', 'deposited')),
    cashier_photo_url   text,                               -- 📸 Cash photo (mandatory on submit)
    cashier_confirmed_by  text,
    cashier_confirmed_at  timestamptz,
    manager_confirmed_by  text,
    manager_confirmed_at  timestamptz,
    owner_confirmed_by    text,
    owner_confirmed_at    timestamptz,
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),

    UNIQUE (store_id, cash_date)
);

COMMENT ON TABLE sd_cash_on_hand IS 'Cash reconciliation — auto-validate ±$2 tolerance with 3-tier handover chain';

-- Indexes
CREATE INDEX idx_sd_cash_mismatch ON sd_cash_on_hand (is_matched) WHERE is_matched = false;


-- ═══════════════════════════════════════════════════════════════════
-- 10. ROW-LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE sd_channel_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_store_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_function_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_daily_sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_sale_channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_cash_on_hand         ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- SELECT policies: HQ sees all, Store+front sees own store
-- ─────────────────────────────────────────────

-- Config/settings tables: all authenticated users can read
CREATE POLICY "sd_channel_config_select" ON sd_channel_config
    FOR SELECT USING (
        sd_get_store_id() = 'HQ'
        OR store_id = sd_get_store_id()
    );

CREATE POLICY "sd_store_settings_select" ON sd_store_settings
    FOR SELECT USING (
        sd_get_store_id() = 'HQ'
        OR store_id = sd_get_store_id()
    );

CREATE POLICY "sd_suppliers_select" ON sd_suppliers
    FOR SELECT USING (
        sd_get_store_id() = 'HQ'
        OR store_id = sd_get_store_id()
        OR store_id = 'ALL'
    );

CREATE POLICY "sd_function_permissions_select" ON sd_function_permissions
    FOR SELECT USING (true);  -- Everyone can read permissions

-- Operational tables: HQ=all, Store+front=own store, others=no access
CREATE POLICY "sd_daily_sales_select" ON sd_daily_sales
    FOR SELECT USING (
        sd_get_store_id() = 'HQ'
        OR (store_id = sd_get_store_id() AND sd_get_dept_id() = 'front')
    );

CREATE POLICY "sd_sale_channels_select" ON sd_sale_channels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sd_daily_sales ds
            WHERE ds.id = sd_sale_channels.daily_sale_id
            AND (sd_get_store_id() = 'HQ' 
                 OR (ds.store_id = sd_get_store_id() AND sd_get_dept_id() = 'front'))
        )
    );

CREATE POLICY "sd_expenses_select" ON sd_expenses
    FOR SELECT USING (
        sd_get_store_id() = 'HQ'
        OR (store_id = sd_get_store_id() AND sd_get_dept_id() = 'front')
    );

CREATE POLICY "sd_invoices_select" ON sd_invoices
    FOR SELECT USING (
        sd_get_store_id() = 'HQ'
        OR (store_id = sd_get_store_id() AND sd_get_dept_id() = 'front')
    );

CREATE POLICY "sd_cash_on_hand_select" ON sd_cash_on_hand
    FOR SELECT USING (
        sd_get_store_id() = 'HQ'
        OR (store_id = sd_get_store_id() AND sd_get_dept_id() = 'front')
    );

-- ─────────────────────────────────────────────
-- INSERT policies: SELECT policy + tier_level <= 5
-- ─────────────────────────────────────────────

CREATE POLICY "sd_daily_sales_insert" ON sd_daily_sales
    FOR INSERT WITH CHECK (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

CREATE POLICY "sd_sale_channels_insert" ON sd_sale_channels
    FOR INSERT WITH CHECK (
        sd_get_tier_level() <= 5
    );

CREATE POLICY "sd_expenses_insert" ON sd_expenses
    FOR INSERT WITH CHECK (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

CREATE POLICY "sd_invoices_insert" ON sd_invoices
    FOR INSERT WITH CHECK (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

CREATE POLICY "sd_cash_on_hand_insert" ON sd_cash_on_hand
    FOR INSERT WITH CHECK (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

-- Suppliers: T1-T5 can create (T3-T5 = instant vendor creation)
CREATE POLICY "sd_suppliers_insert" ON sd_suppliers
    FOR INSERT WITH CHECK (
        sd_get_tier_level() <= 5
    );

-- ─────────────────────────────────────────────
-- UPDATE policies: same as INSERT
-- ─────────────────────────────────────────────

CREATE POLICY "sd_daily_sales_update" ON sd_daily_sales
    FOR UPDATE USING (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

CREATE POLICY "sd_sale_channels_update" ON sd_sale_channels
    FOR UPDATE USING (
        sd_get_tier_level() <= 5
    );

CREATE POLICY "sd_expenses_update" ON sd_expenses
    FOR UPDATE USING (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

CREATE POLICY "sd_invoices_update" ON sd_invoices
    FOR UPDATE USING (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

CREATE POLICY "sd_cash_on_hand_update" ON sd_cash_on_hand
    FOR UPDATE USING (
        sd_get_tier_level() <= 5
        AND (sd_get_store_id() = 'HQ' OR store_id = sd_get_store_id())
    );

-- ─────────────────────────────────────────────
-- DELETE policies: tier_level <= 2 only (T1-T2)
-- ─────────────────────────────────────────────

CREATE POLICY "sd_daily_sales_delete" ON sd_daily_sales
    FOR DELETE USING (sd_get_tier_level() <= 2);

CREATE POLICY "sd_sale_channels_delete" ON sd_sale_channels
    FOR DELETE USING (sd_get_tier_level() <= 2);

CREATE POLICY "sd_expenses_delete" ON sd_expenses
    FOR DELETE USING (sd_get_tier_level() <= 2);

CREATE POLICY "sd_invoices_delete" ON sd_invoices
    FOR DELETE USING (sd_get_tier_level() <= 2);

CREATE POLICY "sd_cash_on_hand_delete" ON sd_cash_on_hand
    FOR DELETE USING (sd_get_tier_level() <= 2);

-- Admin tables: T1-T2 manage config/settings/permissions
CREATE POLICY "sd_channel_config_manage" ON sd_channel_config
    FOR ALL USING (sd_get_tier_level() <= 2);

CREATE POLICY "sd_store_settings_manage" ON sd_store_settings
    FOR ALL USING (sd_get_tier_level() <= 2);

CREATE POLICY "sd_function_permissions_manage" ON sd_function_permissions
    FOR ALL USING (sd_get_tier_level() <= 2);

CREATE POLICY "sd_suppliers_manage" ON sd_suppliers
    FOR UPDATE USING (sd_get_tier_level() <= 3);  -- T1-T3 can edit suppliers

CREATE POLICY "sd_suppliers_delete" ON sd_suppliers
    FOR DELETE USING (sd_get_tier_level() <= 2);


-- ═══════════════════════════════════════════════════════════════════
-- 11. STORAGE BUCKET for photos
-- ═══════════════════════════════════════════════════════════════════

-- Create storage bucket (Supabase Storage API)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'sd-photos',
    'sd-photos',
    false,
    5242880,  -- 5MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload to their store's folder
-- Path pattern: sd-photos/{store_id}/{table}/{date}/{uuid}.jpg
CREATE POLICY "sd_photos_upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'sd-photos'
        AND sd_get_tier_level() <= 5
    );

CREATE POLICY "sd_photos_read" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'sd-photos'
        AND (
            sd_get_store_id() = 'HQ'
            OR (storage.foldername(name))[1] = sd_get_store_id()
        )
    );

CREATE POLICY "sd_photos_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'sd-photos'
        AND sd_get_tier_level() <= 2
    );


-- ═══════════════════════════════════════════════════════════════════
-- 12. HELPER FUNCTIONS for business logic
-- ═══════════════════════════════════════════════════════════════════

-- Auto-update total_sales when channels change
CREATE OR REPLACE FUNCTION sd_update_total_sales()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sd_daily_sales
    SET total_sales = (
        SELECT COALESCE(SUM(amount), 0)
        FROM sd_sale_channels
        WHERE daily_sale_id = COALESCE(NEW.daily_sale_id, OLD.daily_sale_id)
    ),
    updated_at = now()
    WHERE id = COALESCE(NEW.daily_sale_id, OLD.daily_sale_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sd_update_total_sales
    AFTER INSERT OR UPDATE OR DELETE ON sd_sale_channels
    FOR EACH ROW EXECUTE FUNCTION sd_update_total_sales();

-- Auto-update cash_on_hand when sales/expenses change
CREATE OR REPLACE FUNCTION sd_update_cash_on_hand()
RETURNS TRIGGER AS $$
DECLARE
    v_store_id text;
    v_date date;
    v_cash_sale numeric(12,2);
    v_cash_expend numeric(12,2);
BEGIN
    -- Determine store and date from the triggering table
    IF TG_TABLE_NAME = 'sd_sale_channels' THEN
        SELECT ds.store_id, ds.sale_date INTO v_store_id, v_date
        FROM sd_daily_sales ds WHERE ds.id = NEW.daily_sale_id;
        
        -- Only process if this is the 'cash' channel
        IF NEW.channel_key != 'cash' THEN RETURN NEW; END IF;
    ELSIF TG_TABLE_NAME = 'sd_expenses' THEN
        v_store_id := NEW.store_id;
        v_date := NEW.expense_date;
        
        -- Only process if cash payment
        IF NEW.payment_method != 'cash' THEN RETURN NEW; END IF;
    ELSE
        RETURN NEW;
    END IF;

    -- Calculate cash sale from channels
    SELECT COALESCE(SUM(sc.amount), 0) INTO v_cash_sale
    FROM sd_sale_channels sc
    JOIN sd_daily_sales ds ON ds.id = sc.daily_sale_id
    WHERE ds.store_id = v_store_id 
      AND ds.sale_date = v_date 
      AND sc.channel_key = 'cash';

    -- Calculate cash expenses
    SELECT COALESCE(SUM(e.total_amount), 0) INTO v_cash_expend
    FROM sd_expenses e
    WHERE e.store_id = v_store_id 
      AND e.expense_date = v_date 
      AND e.payment_method = 'cash';

    -- Upsert cash_on_hand
    INSERT INTO sd_cash_on_hand (store_id, cash_date, cash_sale, cash_expend, created_by)
    VALUES (v_store_id, v_date, v_cash_sale, v_cash_expend, COALESCE(current_setting('app.account_id', true), 'system'))
    ON CONFLICT (store_id, cash_date) DO UPDATE SET
        cash_sale = v_cash_sale,
        cash_expend = v_cash_expend,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sd_cash_from_sales
    AFTER INSERT OR UPDATE ON sd_sale_channels
    FOR EACH ROW EXECUTE FUNCTION sd_update_cash_on_hand();

CREATE TRIGGER trg_sd_cash_from_expenses
    AFTER INSERT OR UPDATE ON sd_expenses
    FOR EACH ROW EXECUTE FUNCTION sd_update_cash_on_hand();

-- Auto-update is_matched when actual_cash changes
CREATE OR REPLACE FUNCTION sd_validate_cash()
RETURNS TRIGGER AS $$
DECLARE
    v_tolerance numeric(8,2);
BEGIN
    -- Get store tolerance
    SELECT COALESCE(cash_mismatch_tolerance, 2.00) INTO v_tolerance
    FROM sd_store_settings WHERE store_id = NEW.store_id;

    -- Default tolerance if no settings
    IF v_tolerance IS NULL THEN v_tolerance := 2.00; END IF;

    -- Validate
    IF NEW.actual_cash IS NOT NULL THEN
        NEW.is_matched := ABS(NEW.actual_cash - NEW.expected_cash) <= v_tolerance;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sd_validate_cash
    BEFORE INSERT OR UPDATE ON sd_cash_on_hand
    FOR EACH ROW EXECUTE FUNCTION sd_validate_cash();


-- ═══════════════════════════════════════════════════════════════════
-- 13. MODULE PERMISSIONS (for Home module access control)
-- ═══════════════════════════════════════════════════════════════════

-- Register sale_daily module permissions for all tiers
INSERT INTO module_permissions (perm_id, tier_id, module_id, access_level, updated_by, updated_at)
VALUES
    ('PRM-SD-01', 'T1', 'sale_daily', 'super_admin', 'system', now()),
    ('PRM-SD-02', 'T2', 'sale_daily', 'admin',       'system', now()),
    ('PRM-SD-03', 'T3', 'sale_daily', 'edit',         'system', now()),
    ('PRM-SD-04', 'T4', 'sale_daily', 'edit',         'system', now()),
    ('PRM-SD-05', 'T5', 'sale_daily', 'edit',         'system', now()),
    ('PRM-SD-06', 'T6', 'sale_daily', 'view_only',    'system', now()),
    ('PRM-SD-07', 'T7', 'sale_daily', 'view_only',    'system', now())
ON CONFLICT (perm_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- ✅ MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════
-- 
-- Summary:
--   Tables created:     9
--   RLS policies:       25
--   Indexes:            11 (including unique constraints)
--   Triggers:           4
--   Helper functions:   6
--   Storage bucket:     1 (sd-photos, 5MB max)
--   Module registered:  sale_daily → modules + module_permissions
--
-- Next: Run 004_sale_daily_seed.sql for Phase 2 seed data
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- SECTION 2/5: 004_sale_daily_seed.sql
-- Seed data: channels, settings, permissions (30×7)
-- ═══════════════════════════════════════════════════════════════
-- =================================================================
-- SPG Sale Daily Module - Phase 2: Seed Data
-- File: supabase/migrations/004_sale_daily_seed.sql
-- Version: 1.3 | March 2026
-- Depends on: 003_sale_daily_tables.sql
-- =================================================================


-- -----------------------------------------
-- 1. sd_channel_config (10 ch x 6 stores = 60 rows)
-- -----------------------------------------
-- Stores: MNG, ISH, GB, RW, TMC, BC
-- eftpos2: ISH, GB only | panda: MNG, ISH only

DO $$
DECLARE
    v_stores text[] := ARRAY['MNG','ISH','GB','RW','TMC','BC'];
    v_store text;
BEGIN
    FOREACH v_store IN ARRAY v_stores LOOP
        -- 8 channels enabled for ALL stores
        INSERT INTO sd_channel_config
            (store_id, channel_key, channel_label, finance_sub_category, dashboard_group, is_enabled, sort_order)
        VALUES
            (v_store,'eftpos1','Card Eftpos 1','Eftpos1','card_sale',true,1),
            (v_store,'union_pay','Union Pay','Union Pay','card_sale',true,3),
            (v_store,'card_prepaid','Card (prepaid)','Card Prepaid','card_sale',true,4),
            (v_store,'voucher','Voucher','Voucher','card_sale',true,5),
            (v_store,'cash','Cash','Cash','cash_sale',true,6),
            (v_store,'other','Other','Other','other',true,7),
            (v_store,'easi','Delivery Easi','Easi','delivery_sale',true,8),
            (v_store,'uber_eats','Delivery Uber Eats','UberEats','delivery_sale',true,9)
        ON CONFLICT (store_id, channel_key) DO NOTHING;

        -- eftpos2: enabled for ISH, GB only
        INSERT INTO sd_channel_config
            (store_id, channel_key, channel_label, finance_sub_category, dashboard_group, is_enabled, sort_order)
        VALUES (v_store,'eftpos2','Card Eftpos 2','Eftpos2','card_sale',
            CASE WHEN v_store IN ('ISH','GB') THEN true ELSE false END, 2)
        ON CONFLICT (store_id, channel_key) DO NOTHING;

        -- panda: enabled for MNG, ISH only
        INSERT INTO sd_channel_config
            (store_id, channel_key, channel_label, finance_sub_category, dashboard_group, is_enabled, sort_order)
        VALUES (v_store,'panda','Delivery Panda','Panda','delivery_sale',
            CASE WHEN v_store IN ('MNG','ISH') THEN true ELSE false END, 10)
        ON CONFLICT (store_id, channel_key) DO NOTHING;
    END LOOP;
END $$;


-- -----------------------------------------
-- 2. sd_store_settings (6 stores)
-- -----------------------------------------

INSERT INTO sd_store_settings
    (store_id, cutoff_time, backdate_limit_days, require_photos,
     cash_mismatch_tolerance, auto_finance_push, default_bank_account)
VALUES
    ('MNG','23:59',2,true,2.00,true,'4410 #PettyCash&Card'),
    ('ISH','23:59',2,true,2.00,true,'4410 #PettyCash&Card'),
    ('GB', '23:59',2,true,2.00,true,'4410 #PettyCash&Card'),
    ('RW', '23:59',2,true,2.00,true,'4410 #PettyCash&Card'),
    ('TMC','23:59',2,true,2.00,true,'4410 #PettyCash&Card'),
    ('BC', '23:59',2,true,2.00,true,'4410 #PettyCash&Card')
ON CONFLICT (store_id) DO NOTHING;


-- -----------------------------------------
-- 3. sd_function_permissions (30 fn x 7 tiers = 210 rows)
-- -----------------------------------------
-- Source: Data Structure v1.3 Section 6

DO $$
DECLARE
    v_funcs text[][] := ARRAY[
        -- SALES (6)
        ['view_daily_sales_own','View daily sales (own store)','sales','T','T','T','T','T','T','T'],
        ['view_daily_sales_all','View daily sales (all stores)','sales','T','T','F','F','F','F','T'],
        ['create_daily_sales','Create daily sales','sales','T','T','T','T','T','F','F'],
        ['edit_daily_sales','Edit daily sales (today/yesterday)','sales','T','T','T','T','T','F','F'],
        ['edit_sales_backdate','Edit sales (backdate >2d)','sales','T','T','F','F','F','F','F'],
        ['edit_locked_sales','Edit locked sales (override)','sales','T','T','F','F','F','F','F'],
        -- EXPENSES (5)
        ['view_expenses_own','View expenses (own store)','expenses','T','T','T','T','T','T','T'],
        ['view_expenses_all','View expenses (all stores)','expenses','T','T','F','F','F','F','T'],
        ['create_expense','Create expense','expenses','T','T','T','T','T','F','F'],
        ['edit_expense','Edit expense','expenses','T','T','T','T','T','F','F'],
        ['delete_expense','Delete expense','expenses','T','T','F','F','F','F','F'],
        -- INVOICES (6)
        ['view_invoices_own','View invoices (own store)','invoices','T','T','T','T','T','T','T'],
        ['view_invoices_all','View invoices (all stores)','invoices','T','T','F','F','F','F','T'],
        ['create_invoice','Create invoice','invoices','T','T','T','T','T','F','F'],
        ['edit_invoice','Edit invoice','invoices','T','T','T','T','T','F','F'],
        ['delete_invoice','Delete invoice','invoices','T','T','F','F','F','F','F'],
        ['update_payment_status','Update payment status','invoices','T','T','T','T','F','F','F'],
        -- CASH (5)
        ['view_cash_own','View cash on hand (own store)','cash','T','T','T','T','T','T','T'],
        ['view_cash_all','View cash on hand (all stores)','cash','T','T','F','F','F','F','T'],
        ['submit_cashier_count','Submit cashier count','cash','T','T','T','T','T','F','F'],
        ['confirm_manager','Confirm manager handover','cash','T','T','T','F','F','F','F'],
        ['confirm_owner','Confirm owner handover','cash','T','T','F','F','F','F','F'],
        -- REPORTS (3)
        ['view_sale_history','View sale history','reports','T','T','T','T','T','T','T'],
        ['view_expense_history','View expense history','reports','T','T','T','T','T','T','T'],
        ['export_data','Export data','reports','T','T','T','F','F','F','F'],
        -- ADMIN (5)
        ['manage_channel_config','Manage channel config','admin','T','T','F','F','F','F','F'],
        ['manage_suppliers','Manage suppliers','admin','T','T','T','F','F','F','F'],
        ['manage_store_settings','Manage store settings','admin','T','T','F','F','F','F','F'],
        ['manage_permissions','Manage permissions','admin','T','T','F','F','F','F','F'],
        ['view_audit_log','View audit log','admin','T','T','F','F','F','F','F']
    ];
    v_tiers text[] := ARRAY['T1','T2','T3','T4','T5','T6','T7'];
    v_func text[];
    v_tier text;
    v_idx int;
BEGIN
    FOREACH v_func SLICE 1 IN ARRAY v_funcs LOOP
        FOREACH v_tier IN ARRAY v_tiers LOOP
            v_idx := CAST(REPLACE(v_tier,'T','') AS int);
            INSERT INTO sd_function_permissions
                (function_key, function_name, function_group, tier_id, is_allowed, updated_by)
            VALUES (v_func[1], v_func[2], v_func[3], v_tier, v_func[3+v_idx]='T', 'system')
            ON CONFLICT (function_key, tier_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;


-- -----------------------------------------
-- 4. sd_suppliers (~43 rows)
-- -----------------------------------------
-- store_id = 'ALL' = shared across all stores

-- 4a. Shared suppliers (27 vendors)
INSERT INTO sd_suppliers
    (store_id, supplier_name, payment_methods, is_special_track, is_active, sort_order, created_by)
VALUES
    -- Supermarkets
    ('ALL','Coles','{cash,card}',false,true,1,'system'),
    ('ALL','Woolworths','{cash,card}',false,true,2,'system'),
    ('ALL','Aldi','{cash,card}',false,true,3,'system'),
    ('ALL','Costco','{card}',false,true,4,'system'),
    -- Thai / Asian
    ('ALL','Mae Chang','{cash,card}',false,true,10,'system'),
    ('ALL','Jarern Chai','{cash,card}',true,true,11,'system'),
    ('ALL','Thai Kee IGA','{cash,card}',false,true,12,'system'),
    ('ALL','TKL Trading','{cash,card}',false,true,13,'system'),
    -- Packaging
    ('ALL','Pro Bros','{invoice}',false,true,20,'system'),
    ('ALL','Packaging House','{invoice}',false,true,21,'system'),
    ('ALL','Biome','{invoice}',false,true,22,'system'),
    -- Dairy / Bakery ingredients
    ('ALL','Foodlink','{invoice}',false,true,30,'system'),
    ('ALL','Riviera Farms','{invoice}',false,true,31,'system'),
    ('ALL','Anchor (Fonterra)','{invoice}',false,true,32,'system'),
    -- Beverages
    ('ALL','Boncafe','{invoice}',false,true,40,'system'),
    ('ALL','Coca-Cola Amatil','{invoice}',false,true,41,'system'),
    -- Utilities
    ('ALL','Origin Energy','{invoice}',false,true,50,'system'),
    ('ALL','Optus','{invoice}',false,true,51,'system'),
    ('ALL','Telstra','{invoice}',false,true,52,'system'),
    -- Office / Cleaning
    ('ALL','Bunnings','{cash,card}',false,true,60,'system'),
    ('ALL','Officeworks','{cash,card}',false,true,61,'system'),
    -- Delivery platforms (commission/fee invoices)
    ('ALL','Uber Eats','{invoice}',false,true,70,'system'),
    ('ALL','DoorDash (Easi)','{invoice}',false,true,71,'system'),
    ('ALL','Panda','{invoice}',false,true,72,'system'),
    -- General
    ('ALL','Petty Cash','{cash}',false,true,80,'system'),
    ('ALL','Cash and Carry','{cash}',false,true,81,'system'),
    ('ALL','Other','{cash,card}',false,true,99,'system')
ON CONFLICT DO NOTHING;

-- 4b. MNG (Mango Coco) - dessert specialty
INSERT INTO sd_suppliers (store_id,supplier_name,payment_methods,is_special_track,is_active,sort_order,created_by) VALUES
    ('MNG','Mango Magic Supply','{cash}',false,true,100,'system'),
    ('MNG','Fresh Fruit Market','{cash}',false,true,101,'system'),
    ('MNG','Coconut King','{cash,card}',false,true,102,'system')
ON CONFLICT DO NOTHING;

-- 4c. ISH (Issho Cafe) - Japanese brunch
INSERT INTO sd_suppliers (store_id,supplier_name,payment_methods,is_special_track,is_active,sort_order,created_by) VALUES
    ('ISH','JFC (Japanese Food)','{invoice}',false,true,100,'system'),
    ('ISH','Nippon Food Supply','{invoice}',false,true,101,'system'),
    ('ISH','Sydney Fish Market','{cash,card}',true,true,102,'system')
ON CONFLICT DO NOTHING;

-- 4d. GB (Golden Brown) - pancake & bakery
INSERT INTO sd_suppliers (store_id,supplier_name,payment_methods,is_special_track,is_active,sort_order,created_by) VALUES
    ('GB','Laucke Flour','{invoice}',false,true,100,'system'),
    ('GB','Callebaut Chocolate','{invoice}',false,true,101,'system')
ON CONFLICT DO NOTHING;

-- 4e. RW (Red Wok) - food court
INSERT INTO sd_suppliers (store_id,supplier_name,payment_methods,is_special_track,is_active,sort_order,created_by) VALUES
    ('RW','Chinatown Grocer','{cash}',false,true,100,'system'),
    ('RW','Wok Supply Co','{cash,card}',false,true,101,'system')
ON CONFLICT DO NOTHING;

-- 4f. TMC (The Melting Cheese) - cheese dine-in
INSERT INTO sd_suppliers (store_id,supplier_name,payment_methods,is_special_track,is_active,sort_order,created_by) VALUES
    ('TMC','Cheese Culture','{invoice}',true,true,100,'system'),
    ('TMC','La Formaggeria','{invoice}',false,true,101,'system')
ON CONFLICT DO NOTHING;

-- 4g. BC (Bakery Centre) - production
INSERT INTO sd_suppliers (store_id,supplier_name,payment_methods,is_special_track,is_active,sort_order,created_by) VALUES
    ('BC','Bakels','{invoice}',false,true,100,'system'),
    ('BC','Dawn Foods','{invoice}',false,true,101,'system'),
    ('BC','Manildra (Flour)','{invoice}',false,true,102,'system')
ON CONFLICT DO NOTHING;


-- =================================================================
-- SEED COMPLETE
-- =================================================================
--
-- sd_channel_config:        60 rows (10 ch x 6 stores)
--   MNG: 9 enabled (+ panda)  | ISH: 10 (all)
--   GB:  9 (+ eftpos2)        | RW/TMC/BC: 8 (base)
--
-- sd_store_settings:         6 rows (all defaults)
--   cutoff 23:59 | backdate 2d | photos on
--   tolerance $2 | auto-push on | bank 4410 #PettyCash&Card
--
-- sd_function_permissions: 210 rows (30 fn x 7 tiers)
--   SALES 6 | EXPENSES 5 | INVOICES 6
--   CASH  5 | REPORTS  3 | ADMIN    5
--
-- sd_suppliers:             ~43 rows
--   27 shared (ALL) + 16 store-specific
--   3 special tracking: Jarern Chai, Sydney Fish Market, Cheese Culture
--
-- Verification queries:
--   SELECT store_id, count(*) total,
--     count(*) FILTER (WHERE is_enabled) enabled
--   FROM sd_channel_config GROUP BY store_id ORDER BY store_id;
--
--   SELECT function_group, count(*) total,
--     count(*) FILTER (WHERE is_allowed) allowed
--   FROM sd_function_permissions GROUP BY function_group;
--
--   SELECT store_id, count(*) FROM sd_suppliers
--   GROUP BY store_id ORDER BY store_id;
--
-- Next: Phase 3 - Link Vendor Master + Category Master
-- =================================================================

-- ═══════════════════════════════════════════════════════════════
-- SECTION 3/5: 005_shared_tables.sql
-- Shared: category_master, vendor_master, paying_entities
-- ═══════════════════════════════════════════════════════════════
-- =================================================================
-- SPG Shared Tables - Phase 3: Vendor, Category, Bank Account
-- File: supabase/migrations/005_shared_tables.sql
-- Version: 1.0 | March 2026
--
-- RLS Rules (per On):
--   vendor_master:  T1-T5 can INSERT (anyone can add), all can SELECT
--   category_master + bank_accounts: T1-T2 admin only manage, all read
--
-- Depends on: 001_home_tables.sql (stores, accounts, access_tiers)
-- Used by: Sale Daily, Finance Module, Master Log
-- =================================================================


-- =================================================================
-- 1. vendor_master - Central vendor database (shared all stores)
-- =================================================================
-- Anyone (T1-T5) can add vendors instantly
-- All stores pull from the same database
-- T1-T2 manage: edit, merge, deactivate

CREATE TABLE vendor_master (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name     text NOT NULL,
    vendor_type     text,
    vendor_group    text,
    contact_name    text,
    phone           text,
    email           text,
    address         text,
    abn             text,
    payment_terms   text,
    default_payment_method text CHECK (default_payment_method IS NULL OR default_payment_method IN ('cash','card','invoice','transfer')),
    notes           text,
    is_active       boolean NOT NULL DEFAULT true,
    created_by      text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      text,
    updated_at      timestamptz DEFAULT now()
);

-- Prevent duplicate vendor names (case-insensitive)
CREATE UNIQUE INDEX idx_vendor_master_name ON vendor_master (LOWER(TRIM(vendor_name)));

COMMENT ON TABLE vendor_master IS 'Central vendor DB shared across all stores - anyone T1-T5 can add, T1-T2 manage';


-- =================================================================
-- 2. category_master - Transaction Type > Main > Sub cascade
-- =================================================================
-- ~120 rows covering all SPG financial categories
-- T1-T2 admin only can manage

CREATE TABLE category_master (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type    text NOT NULL CHECK (transaction_type IN ('Income','Expense','Asset Purchase','Transfer','Loan')),
    main_category       text NOT NULL,
    sub_category        text NOT NULL,
    sort_order          int NOT NULL DEFAULT 0,
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),

    UNIQUE (transaction_type, main_category, sub_category)
);

COMMENT ON TABLE category_master IS 'Category cascade: Transaction Type > Main > Sub - T1-T2 admin only';

-- Index for cascade dropdown queries
CREATE INDEX idx_category_cascade ON category_master (transaction_type, main_category) WHERE is_active = true;


-- =================================================================
-- 3. paying_entities - The 6 SPG entities
-- =================================================================

CREATE TABLE paying_entities (
    entity_id       text PRIMARY KEY,
    entity_name     text NOT NULL,
    store_id        text REFERENCES stores(store_id),
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE paying_entities IS '6 SPG entities for financial allocation';


-- =================================================================
-- 4. bank_accounts - Bank accounts per entity
-- =================================================================
-- T1-T2 admin only can manage

CREATE TABLE bank_accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       text NOT NULL REFERENCES paying_entities(entity_id),
    account_label   text NOT NULL,
    account_number  text,
    bank_name       text,
    account_type    text NOT NULL DEFAULT 'operating' CHECK (account_type IN ('operating','petty_cash','savings','credit_card','term_deposit')),
    is_default      boolean NOT NULL DEFAULT false,
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      int NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (entity_id, account_label)
);

COMMENT ON TABLE bank_accounts IS 'Bank accounts per entity - T1-T2 admin only, filtered by Paying Entity';

-- Index for dropdown queries
CREATE INDEX idx_bank_accounts_entity ON bank_accounts (entity_id, is_active);


-- =================================================================
-- 5. payment_status_master - Valid statuses per transaction type
-- =================================================================

CREATE TABLE payment_status_master (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type    text NOT NULL CHECK (transaction_type IN ('Income','Expense','Asset Purchase','Transfer','Loan')),
    status_value        text NOT NULL,
    sort_order          int NOT NULL DEFAULT 0,
    is_active           boolean NOT NULL DEFAULT true,

    UNIQUE (transaction_type, status_value)
);

COMMENT ON TABLE payment_status_master IS 'Valid payment statuses per transaction type';


-- =================================================================
-- 6. ROW-LEVEL SECURITY
-- =================================================================

ALTER TABLE vendor_master         ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_master       ENABLE ROW LEVEL SECURITY;
ALTER TABLE paying_entities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_status_master ENABLE ROW LEVEL SECURITY;

-- ----- vendor_master: everyone reads, T1-T5 can add -----

CREATE POLICY "vendor_master_select" ON vendor_master
    FOR SELECT USING (true);

-- T1-T5 can INSERT (anyone can add new vendors instantly)
CREATE POLICY "vendor_master_insert" ON vendor_master
    FOR INSERT WITH CHECK (sd_get_tier_level() <= 5);

-- T1-T2 only can UPDATE (edit, merge, deactivate)
CREATE POLICY "vendor_master_update" ON vendor_master
    FOR UPDATE USING (sd_get_tier_level() <= 2);

-- T1-T2 only can DELETE
CREATE POLICY "vendor_master_delete" ON vendor_master
    FOR DELETE USING (sd_get_tier_level() <= 2);

-- ----- category_master: everyone reads, T1-T2 admin only manage -----

CREATE POLICY "category_master_select" ON category_master
    FOR SELECT USING (true);

CREATE POLICY "category_master_manage" ON category_master
    FOR ALL USING (sd_get_tier_level() <= 2);

-- ----- paying_entities: everyone reads, T1-T2 admin only manage -----

CREATE POLICY "paying_entities_select" ON paying_entities
    FOR SELECT USING (true);

CREATE POLICY "paying_entities_manage" ON paying_entities
    FOR ALL USING (sd_get_tier_level() <= 2);

-- ----- bank_accounts: everyone reads, T1-T2 admin only manage -----

CREATE POLICY "bank_accounts_select" ON bank_accounts
    FOR SELECT USING (true);

CREATE POLICY "bank_accounts_manage" ON bank_accounts
    FOR ALL USING (sd_get_tier_level() <= 2);

-- ----- payment_status_master: everyone reads, T1-T2 admin only -----

CREATE POLICY "payment_status_select" ON payment_status_master
    FOR SELECT USING (true);

CREATE POLICY "payment_status_manage" ON payment_status_master
    FOR ALL USING (sd_get_tier_level() <= 2);


-- =================================================================
-- 7. SEED DATA - Paying Entities
-- =================================================================

INSERT INTO paying_entities (entity_id, entity_name, store_id, sort_order) VALUES
    ('mango_coco',       'Mango Coco',         'MNG', 1),
    ('red_wok',          'Red Wok',            'RW',  2),
    ('siam_palette',     'Siam Palette',       'HQ',  3),
    ('the_melting_cheese','The Melting Cheese', 'TMC', 4),
    ('golden_brown',     'Golden Brown',       'GB',  5),
    ('issho_cafe',       'Issho Cafe',         'ISH', 6)
ON CONFLICT (entity_id) DO NOTHING;


-- =================================================================
-- 8. SEED DATA - Bank Accounts (all 6 entities)
-- =================================================================

-- Mango Coco (10 accounts)
INSERT INTO bank_accounts (entity_id, account_label, bank_name, account_type, is_default, sort_order) VALUES
    ('mango_coco', '7134 #Westpac',       'Westpac', 'operating',     true,  1),
    ('mango_coco', '4410 #PettyCash&Card', NULL,      'petty_cash',    false, 2),
    ('mango_coco', '2022 #Saving',         'Westpac', 'savings',       false, 3),
    ('mango_coco', '9963 #CreditCard',     NULL,      'credit_card',   false, 4),
    ('mango_coco', '8399 #TermDeposit',    NULL,      'term_deposit',  false, 5),
    ('mango_coco', '5391 #TermDeposit',    NULL,      'term_deposit',  false, 6),
    ('mango_coco', '5015 #TermDeposit',    NULL,      'term_deposit',  false, 7),
    ('mango_coco', '5420 #TermDeposit',    NULL,      'term_deposit',  false, 8),
    ('mango_coco', '5512 #TermDeposit',    NULL,      'term_deposit',  false, 9),
    ('mango_coco', '3002 #TermDeposit',    NULL,      'term_deposit',  false, 10)
ON CONFLICT (entity_id, account_label) DO NOTHING;

-- Red Wok (5 accounts)
INSERT INTO bank_accounts (entity_id, account_label, bank_name, account_type, is_default, sort_order) VALUES
    ('red_wok', '4849 #Myer',          'Myer',      'operating',    true,  1),
    ('red_wok', '8145 #Macquarie',     'Macquarie', 'operating',    false, 2),
    ('red_wok', '9392 #PettyCash&Card', NULL,        'petty_cash',   false, 3),
    ('red_wok', '9312 #TermDeposit',    NULL,        'term_deposit', false, 4),
    ('red_wok', '4857 #TermDeposit',    NULL,        'term_deposit', false, 5)
ON CONFLICT (entity_id, account_label) DO NOTHING;

-- Siam Palette (2 accounts)
INSERT INTO bank_accounts (entity_id, account_label, bank_name, account_type, is_default, sort_order) VALUES
    ('siam_palette', '3846 #Westpac',       'Westpac', 'operating',  true,  1),
    ('siam_palette', '3854 #PettyCash&Card', NULL,      'petty_cash', false, 2)
ON CONFLICT (entity_id, account_label) DO NOTHING;

-- The Melting Cheese (4 accounts)
INSERT INTO bank_accounts (entity_id, account_label, bank_name, account_type, is_default, sort_order) VALUES
    ('the_melting_cheese', '2560 #Westpac',       'Westpac', 'operating',    true,  1),
    ('the_melting_cheese', '2550 #PettyCash&Card', NULL,      'petty_cash',   false, 2),
    ('the_melting_cheese', '2030 #Saving',         'Westpac', 'savings',      false, 3),
    ('the_melting_cheese', '5276 #TermDeposit',    NULL,      'term_deposit', false, 4)
ON CONFLICT (entity_id, account_label) DO NOTHING;

-- Golden Brown (3 accounts)
INSERT INTO bank_accounts (entity_id, account_label, bank_name, account_type, is_default, sort_order) VALUES
    ('golden_brown', '4429 #Westpac',       'Westpac', 'operating',    true,  1),
    ('golden_brown', '1997 #PettyCash&Card', NULL,      'petty_cash',   false, 2),
    ('golden_brown', '2009 #TermDeposit',    NULL,      'term_deposit', false, 3)
ON CONFLICT (entity_id, account_label) DO NOTHING;

-- Issho Cafe (3 accounts)
INSERT INTO bank_accounts (entity_id, account_label, bank_name, account_type, is_default, sort_order) VALUES
    ('issho_cafe', '5976 #Westpac',       'Westpac', 'operating',    true,  1),
    ('issho_cafe', '5941 #PettyCash&Card', NULL,      'petty_cash',   false, 2),
    ('issho_cafe', '5984 #TermDeposit',    NULL,      'term_deposit', false, 3)
ON CONFLICT (entity_id, account_label) DO NOTHING;


-- =================================================================
-- 9. SEED DATA - Category Master (~120 rows)
-- =================================================================
-- Source: Master Log Manual - Category Cascade table

-- ----- INCOME -----
INSERT INTO category_master (transaction_type, main_category, sub_category, sort_order) VALUES
    -- Revenue
    ('Income', 'Revenue', 'Card Prepaid',     1),
    ('Income', 'Revenue', 'Cash',             2),
    ('Income', 'Revenue', 'Easi',             3),
    ('Income', 'Revenue', 'Eftpos1',          4),
    ('Income', 'Revenue', 'Eftpos2',          5),
    ('Income', 'Revenue', 'UberEats',         6),
    ('Income', 'Revenue', 'Union Pay',        7),
    -- Other Income
    ('Income', 'Other Income', 'Different Sale',    10),
    ('Income', 'Other Income', 'Interest',           11),
    ('Income', 'Other Income', 'Other Income',       12),
    ('Income', 'Other Income', 'Supplier Refund',    13)
ON CONFLICT (transaction_type, main_category, sub_category) DO NOTHING;

-- ----- EXPENSE -----
INSERT INTO category_master (transaction_type, main_category, sub_category, sort_order) VALUES
    -- COGs
    ('Expense', 'COGs', 'Food',       100),
    ('Expense', 'COGs', 'Beverage',   101),
    ('Expense', 'COGs', 'Packaging',  102),
    ('Expense', 'COGs', 'Supplies',   103),
    ('Expense', 'COGs', 'Delivery',   104),
    -- Commission & Fee
    ('Expense', 'Commission & Fee', 'GP-Uber',              110),
    ('Expense', 'Commission & Fee', 'GP-Easi/Panda',        111),
    ('Expense', 'Commission & Fee', 'GP-Card Prepaid',      112),
    ('Expense', 'Commission & Fee', 'GP-Merchant (Eftpos)', 113),
    ('Expense', 'Commission & Fee', 'GP-Union Pay',         114),
    -- Payroll
    ('Expense', 'Payroll', 'Restaurant Wage',       120),
    ('Expense', 'Payroll', 'Cleaning Wage',         121),
    ('Expense', 'Payroll', 'Operation Wage',        122),
    ('Expense', 'Payroll', 'Superannuation',        123),
    ('Expense', 'Payroll', 'WorkCover Insurance',   124),
    ('Expense', 'Payroll', 'Staff Meals',           125),
    ('Expense', 'Payroll', 'Staff Training',        126),
    ('Expense', 'Payroll', 'Other Payroll',         127),
    -- Rent & Occupancy
    ('Expense', 'Rent & Occupancy', 'Rent',                130),
    ('Expense', 'Rent & Occupancy', 'Hire of Equipment',   131),
    ('Expense', 'Rent & Occupancy', 'Council Rate',        132),
    ('Expense', 'Rent & Occupancy', 'Strata',              133),
    ('Expense', 'Rent & Occupancy', 'Office',              134),
    ('Expense', 'Rent & Occupancy', 'Warehouse / Storage', 135),
    ('Expense', 'Rent & Occupancy', 'Parking',             136),
    ('Expense', 'Rent & Occupancy', 'Land Tax',            137),
    ('Expense', 'Rent & Occupancy', 'Other Rent',          138),
    -- Utilities
    ('Expense', 'Utilities', 'Electricity',        140),
    ('Expense', 'Utilities', 'Water',              141),
    ('Expense', 'Utilities', 'Phone / Internet',   142),
    ('Expense', 'Utilities', 'Gas',                143),
    ('Expense', 'Utilities', 'Other Utilities',    144),
    -- Marketing
    ('Expense', 'Marketing', 'Meta Ads',             150),
    ('Expense', 'Marketing', 'Influencer / KOL',     151),
    ('Expense', 'Marketing', 'Marketing Agency',     152),
    ('Expense', 'Marketing', 'Production / Design',  153),
    ('Expense', 'Marketing', 'Voucher',              154),
    ('Expense', 'Marketing', 'Other Marketing',      155),
    -- Subscription
    ('Expense', 'Subscription', 'MYOB',              160),
    ('Expense', 'Subscription', 'Adobe',             161),
    ('Expense', 'Subscription', 'Ai Assistant',      162),
    ('Expense', 'Subscription', 'Google/Youtube',    163),
    ('Expense', 'Subscription', 'Spotify',           164),
    ('Expense', 'Subscription', 'POS Service Fee',   165),
    ('Expense', 'Subscription', 'Other Subscription',166),
    -- Travelling
    ('Expense', 'Travelling', 'Travel & Transportation', 170),
    ('Expense', 'Travelling', 'Fuel',                     171),
    -- Maintenance
    ('Expense', 'Maintenance', 'Motor Vehicle Service',    180),
    ('Expense', 'Maintenance', 'Cooling System Repair',    181),
    ('Expense', 'Maintenance', 'Electric & Gas Repair',    182),
    ('Expense', 'Maintenance', 'Other Repair',             183),
    -- Waste
    ('Expense', 'Waste', 'General Waste',    190),
    ('Expense', 'Waste', 'Cardboard Waste',  191),
    ('Expense', 'Waste', 'Pest Control',     192),
    -- Admin & Office
    ('Expense', 'Admin & Office', 'Training',         200),
    ('Expense', 'Admin & Office', 'Welfare',          201),
    ('Expense', 'Admin & Office', 'Stationery',       202),
    ('Expense', 'Admin & Office', 'Cleaning',         203),
    ('Expense', 'Admin & Office', 'Office Equipment', 204),
    ('Expense', 'Admin & Office', 'Fine / Penalty',   205),
    ('Expense', 'Admin & Office', 'Other Admin',      206),
    -- Professional Fee
    ('Expense', 'Professional Fee', 'Accounting',       210),
    ('Expense', 'Professional Fee', 'Consulting',       211),
    ('Expense', 'Professional Fee', 'Legal Documents',  212),
    ('Expense', 'Professional Fee', 'Other Services',   213),
    -- Bank Charges
    ('Expense', 'Bank Charges', 'Bank Fee',              220),
    ('Expense', 'Bank Charges', 'Bank Merchant Fee',     221),
    ('Expense', 'Bank Charges', 'Bank Merchant Fee UPI', 222),
    ('Expense', 'Bank Charges', 'Loan Interest',         223),
    -- License & Permit
    ('Expense', 'License & Permit', 'Food Handling License',    230),
    ('Expense', 'License & Permit', 'Council Permit',           231),
    ('Expense', 'License & Permit', 'Fire Safety Inspection',   232),
    -- Tax
    ('Expense', 'Tax', 'ATO Corporate Tax', 240),
    -- Depreciation
    ('Expense', 'Depreciation', 'Kitchen Equipment',       250),
    ('Expense', 'Depreciation', 'Office Equipment',        251),
    ('Expense', 'Depreciation', 'Vehicle',                 252),
    ('Expense', 'Depreciation', 'Leasehold Improvement',   253),
    ('Expense', 'Depreciation', 'POS System',              254),
    ('Expense', 'Depreciation', 'Furniture',               255),
    -- Other Expense
    ('Expense', 'Other Expense', 'Donation',      260),
    ('Expense', 'Other Expense', 'Miscellaneous', 261)
ON CONFLICT (transaction_type, main_category, sub_category) DO NOTHING;

-- ----- ASSET PURCHASE -----
INSERT INTO category_master (transaction_type, main_category, sub_category, sort_order) VALUES
    ('Asset Purchase', 'Equipment',              'Kitchen Equipment',  300),
    ('Asset Purchase', 'Equipment',              'POS System',         301),
    ('Asset Purchase', 'Equipment',              'Furniture',          302),
    ('Asset Purchase', 'Equipment',              'Office Equipment',   303),
    ('Asset Purchase', 'Equipment',              'Signage',            304),
    ('Asset Purchase', 'Vehicle',                'Car',                310),
    ('Asset Purchase', 'Leasehold Improvement',  'Renovation',         320),
    ('Asset Purchase', 'Leasehold Improvement',  'Fit-out',            321),
    ('Asset Purchase', 'Inventory',              'Food & Packaging',   330)
ON CONFLICT (transaction_type, main_category, sub_category) DO NOTHING;

-- ----- TRANSFER -----
INSERT INTO category_master (transaction_type, main_category, sub_category, sort_order) VALUES
    ('Transfer', 'Internal Transfer', 'Between Accounts',       400),
    ('Transfer', 'Internal Transfer', 'Between Cash and Bank',  401),
    ('Transfer', 'Owner Drawing',     'Dividend Payment',       410),
    ('Transfer', 'Owner Drawing',     'Withdrawal',             411),
    ('Transfer', 'Intercompany',      'Red Wok',                420),
    ('Transfer', 'Intercompany',      'Siam Palette',           421),
    ('Transfer', 'Intercompany',      'Mango Coco',             422),
    ('Transfer', 'Intercompany',      'Golden Brown',           423),
    ('Transfer', 'Intercompany',      'The Melting Cheese',     424),
    ('Transfer', 'Intercompany',      'Issho Cafe',             425)
ON CONFLICT (transaction_type, main_category, sub_category) DO NOTHING;

-- ----- LOAN -----
INSERT INTO category_master (transaction_type, main_category, sub_category, sort_order) VALUES
    ('Loan', 'Loan Received',  'Director Loan',       500),
    ('Loan', 'Loan Received',  'Bank Loan',           501),
    ('Loan', 'Loan Received',  'Related Party Loan',  502),
    ('Loan', 'Loan Repayment', 'Director Loan',       510),
    ('Loan', 'Loan Repayment', 'Bank Loan',           511),
    ('Loan', 'Loan Repayment', 'Related Party',       512)
ON CONFLICT (transaction_type, main_category, sub_category) DO NOTHING;


-- =================================================================
-- 10. SEED DATA - Payment Status Master
-- =================================================================

INSERT INTO payment_status_master (transaction_type, status_value, sort_order) VALUES
    -- Income
    ('Income', 'Pending',    1),
    ('Income', 'Received',   2),
    ('Income', 'Cancelled',  3),
    -- Expense
    ('Expense', 'Unpaid',                1),
    ('Expense', 'Paid',                  2),
    ('Expense', 'Partially Paid',        3),
    ('Expense', 'Waiting for Approval',  4),
    ('Expense', 'Cancelled',             5),
    -- Asset Purchase
    ('Asset Purchase', 'Unpaid',          1),
    ('Asset Purchase', 'Paid',            2),
    ('Asset Purchase', 'Partially Paid',  3),
    -- Transfer
    ('Transfer', 'Completed',  1),
    ('Transfer', 'Cancelled',  2),
    -- Loan
    ('Loan', 'Pending',   1),
    ('Loan', 'Received',  2),
    ('Loan', 'Paid',      3)
ON CONFLICT (transaction_type, status_value) DO NOTHING;


-- =================================================================
-- 11. SEED DATA - Vendor Master (43+ vendors)
-- =================================================================

INSERT INTO vendor_master (vendor_name, vendor_group, vendor_type, is_active, created_by) VALUES
    -- Supply - Food & Beverage
    ('Akipan',           'Supply', 'Food & Beverage Supplier', true, 'system'),
    ('Mae Chang',        'Supply', 'Food & Beverage Supplier', true, 'system'),
    ('Jarern Chai',      'Supply', 'Food & Beverage Supplier', true, 'system'),
    ('Thai Kee IGA',     'Supply', 'Food & Beverage Supplier', true, 'system'),
    ('TKL Trading',      'Supply', 'Food & Beverage Supplier', true, 'system'),
    ('Foodlink',         'Supply', 'Food & Beverage Supplier', true, 'system'),
    ('Riviera Farms',    'Supply', 'Food & Beverage Supplier', true, 'system'),
    ('Anchor (Fonterra)','Supply', 'Food & Beverage Supplier', true, 'system'),
    ('Boncafe',          'Supply', 'Beverage Supplier',        true, 'system'),
    ('Coca-Cola Amatil', 'Supply', 'Beverage Supplier',        true, 'system'),
    -- Supply - Supermarket
    ('Coles',            'Supply', 'Supermarket',              true, 'system'),
    ('Woolworths',       'Supply', 'Supermarket',              true, 'system'),
    ('Aldi',             'Supply', 'Supermarket',              true, 'system'),
    ('Costco',           'Supply', 'Supermarket',              true, 'system'),
    -- Supply - Packaging
    ('Pro Bros',         'Supply', 'Packaging Supplier',       true, 'system'),
    ('Packaging House',  'Supply', 'Packaging Supplier',       true, 'system'),
    ('Biome',            'Supply', 'Packaging Supplier',       true, 'system'),
    -- Supply - Bakery
    ('Bakels',           'Supply', 'Bakery Ingredient Supplier', true, 'system'),
    ('Dawn Foods',       'Supply', 'Bakery Ingredient Supplier', true, 'system'),
    ('Manildra',         'Supply', 'Bakery Ingredient Supplier', true, 'system'),
    ('Laucke Flour',     'Supply', 'Bakery Ingredient Supplier', true, 'system'),
    ('Callebaut Chocolate','Supply','Bakery Ingredient Supplier', true, 'system'),
    -- Supply - Japanese
    ('JFC',              'Supply', 'Japanese Food Supplier',   true, 'system'),
    ('Nippon Food Supply','Supply','Japanese Food Supplier',   true, 'system'),
    ('Sydney Fish Market','Supply','Seafood Supplier',         true, 'system'),
    -- Supply - Specialty
    ('Cheese Culture',   'Supply', 'Cheese Supplier',          true, 'system'),
    ('La Formaggeria',   'Supply', 'Cheese Supplier',          true, 'system'),
    -- Service - Utilities
    ('Origin Energy',    'Service', 'Utility Provider',        true, 'system'),
    ('Optus',            'Service', 'Telecom Provider',        true, 'system'),
    ('Telstra',          'Service', 'Telecom Provider',        true, 'system'),
    ('Waterlogic',       'Service', 'Water Provider',          true, 'system'),
    ('WaterModa',        'Service', 'Water Provider',          true, 'system'),
    -- Service - Professional
    ('Sydney CBD Realty', 'Service', 'Property Management',    true, 'system'),
    ('Sydney Realty Group','Service','Property Management',    true, 'system'),
    ('Victoria Basement', 'Service', 'Equipment Supplier',    true, 'system'),
    ('Tiger Coffee',      'Service', 'Equipment Supplier',    true, 'system'),
    -- Platform - Delivery
    ('Uber Eats',        'Platform', 'Delivery Platform',     true, 'system'),
    ('DoorDash (Easi)',  'Platform', 'Delivery Platform',     true, 'system'),
    ('Panda',            'Platform', 'Delivery Platform',     true, 'system'),
    -- Office
    ('Bunnings',         'Supply', 'Hardware & Cleaning',     true, 'system'),
    ('Officeworks',      'Supply', 'Office Supplies',         true, 'system'),
    -- General
    ('Petty Cash',       'Internal', 'Internal',              true, 'system'),
    ('Cash and Carry',   'Supply',   'General Supplier',      true, 'system')
ON CONFLICT DO NOTHING;


-- =================================================================
-- PHASE 3 COMPLETE
-- =================================================================
--
-- Tables created:      5
--   vendor_master:          ~43 vendors seeded
--   category_master:        ~120 rows (5 transaction types, 28 main categories)
--   paying_entities:        6 entities
--   bank_accounts:          27 accounts across 6 entities
--   payment_status_master:  15 status rules
--
-- RLS Summary:
--   vendor_master:  SELECT=all | INSERT=T1-T5 | UPDATE/DELETE=T1-T2
--   category_master, bank_accounts, paying_entities, payment_status:
--     SELECT=all | INSERT/UPDATE/DELETE=T1-T2 only
--
-- Category breakdown:
--   Income:         2 main, 11 sub
--   Expense:       17 main, 81 sub
--   Asset Purchase: 4 main, 9 sub
--   Transfer:       3 main, 10 sub
--   Loan:           2 main, 6 sub
--   TOTAL:         28 main, ~117 sub
--
-- Bank accounts per entity:
--   Mango Coco: 10 | Red Wok: 5 | Siam Palette: 2
--   The Melting Cheese: 4 | Golden Brown: 3 | Issho Cafe: 3
--
-- Next: Phase 4 (optional) - Import historical data
-- =================================================================

-- ═══════════════════════════════════════════════════════════════
-- SECTION 4/5: 006_sd_finance_bridge.sql
-- Finance Bridge table (25 columns matching Master Log)
-- ═══════════════════════════════════════════════════════════════
-- =================================================================
-- SPG Sale Daily — Finance Bridge Table
-- File: supabase/migrations/006_sd_finance_bridge.sql
-- Version: 1.0 | March 2026
-- 
-- This table stores auto-generated Finance records from Sale Daily.
-- When store saves S1/S2/S3, records are created here automatically.
-- Finance module reads from this table for reconciliation.
-- =================================================================

CREATE TABLE sd_finance_bridge (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_module       text NOT NULL DEFAULT 'sale_daily',
    source_id           uuid,
    doc_type            text,
    doc_number          text NOT NULL,
    doc_file            text,
    issue_date          date NOT NULL,
    accrual_month       date,
    vendor_name         text,
    transaction_type    text NOT NULL,
    main_category       text NOT NULL,
    sub_category        text NOT NULL,
    description         text,
    amount_ex_gst       numeric(12,2) NOT NULL DEFAULT 0,
    gst                 numeric(12,2) NOT NULL DEFAULT 0,
    total_amount        numeric(12,2) GENERATED ALWAYS AS (amount_ex_gst + gst) STORED,
    payment_status      text NOT NULL DEFAULT 'Pending',
    payment_date        date,
    paying_entity       text,
    bank_account        text,
    payment_method      text,
    allocation_type     text DEFAULT 'Self',
    cost_owner_entity   text,
    allocation_amount   numeric(12,2),
    notes               text,
    is_reconciled       boolean NOT NULL DEFAULT false,
    reconciled_by       text,
    reconciled_at       timestamptz,
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),

    UNIQUE (doc_number)
);

-- Indexes
CREATE INDEX idx_fin_bridge_source ON sd_finance_bridge (source_module, source_id);
CREATE INDEX idx_fin_bridge_date ON sd_finance_bridge (issue_date, paying_entity);
CREATE INDEX idx_fin_bridge_status ON sd_finance_bridge (payment_status) WHERE payment_status = 'Pending';
CREATE INDEX idx_fin_bridge_reconcile ON sd_finance_bridge (is_reconciled) WHERE is_reconciled = false;

-- RLS
ALTER TABLE sd_finance_bridge ENABLE ROW LEVEL SECURITY;

-- Everyone can read (for dashboard / reports)
CREATE POLICY "fin_bridge_select" ON sd_finance_bridge
    FOR SELECT USING (true);

-- System / Edge Function can insert/update (service_role bypasses RLS)
-- T1-T2 can also manage
CREATE POLICY "fin_bridge_manage" ON sd_finance_bridge
    FOR ALL USING (sd_get_tier_level() <= 2);

COMMENT ON TABLE sd_finance_bridge IS 'Auto-created Finance records from Sale Daily (S1 Income, S2 Expense, S3 Invoice)';


-- =================================================================
-- DONE — sd_finance_bridge
-- =================================================================
-- Maps 1:1 to Master Log 25-column structure
-- doc_number is unique key for upsert (SD-{store}-{date}-{channel})
-- Finance module reads this table to show pending/reconciled records
-- =================================================================

-- ═══════════════════════════════════════════════════════════════
-- SECTION 5/5: 007_sd_audit_log.sql
-- Admin audit trail
-- ═══════════════════════════════════════════════════════════════
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
  changed_by    uuid REFERENCES accounts(id),
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

-- ═══════════════════════════════════════════════════════════════
-- ✅ DONE — All Sale Daily tables created + seeded
-- ═══════════════════════════════════════════════════════════════
