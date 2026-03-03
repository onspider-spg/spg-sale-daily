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
