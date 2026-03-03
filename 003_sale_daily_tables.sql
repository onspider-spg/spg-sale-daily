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
INSERT INTO module_permissions (perm_id, tier_id, module_id, access_level, updated_at)
VALUES
    ('PRM-SD-01', 'T1', 'sale_daily', 'super_admin', now()),
    ('PRM-SD-02', 'T2', 'sale_daily', 'admin',       now()),
    ('PRM-SD-03', 'T3', 'sale_daily', 'edit',         now()),
    ('PRM-SD-04', 'T4', 'sale_daily', 'edit',         now()),
    ('PRM-SD-05', 'T5', 'sale_daily', 'edit',         now()),
    ('PRM-SD-06', 'T6', 'sale_daily', 'view_only',    now()),
    ('PRM-SD-07', 'T7', 'sale_daily', 'view_only',    now())
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
