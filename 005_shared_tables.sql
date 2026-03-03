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
