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
