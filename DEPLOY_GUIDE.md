# SPG Sale Daily Module — Deploy Guide

**Module ID:** `sale_daily` | **Date:** March 2026 | **Version:** v1.3

---

## 📋 Pre-Deploy Checklist

- [ ] Supabase project: `ahvzblrfzhtrjhvbzdhg`
- [ ] GitHub Pages repo ready (e.g. `spg-sale-daily`)
- [ ] Home module running + accessible
- [ ] BC Order module reference (same deploy pattern)

---

## 🔧 Step 1: Database — Run SQL Migrations

**ที่ไหน:** Supabase Dashboard → SQL Editor

**Run ทีละไฟล์ ตามลำดับ:**

| # | File | ทำอะไร | ขนาด |
|---|---|---|---|
| 1 | `003_sale_daily_tables.sql` | สร้าง 9 tables + RLS + indexes | ~700 lines |
| 2 | `004_sale_daily_seed.sql` | Seed: channels 6 ร้าน + settings + 30×7 permissions | ~280 lines |
| 3 | `005_shared_tables.sql` | สร้าง category_master + vendor_master + paying_entities + seed | ~600 lines |
| 4 | `006_sd_finance_bridge.sql` | Finance bridge table (25 columns) | 74 lines |
| 5 | `007_sd_audit_log.sql` | Admin audit trail | 30 lines |
| 6 | `008_register_sale_daily_module.sql` | ลงทะเบียนใน Home module + permissions + bridges | 50 lines |

**ตรวจสอบหลัง run:**

```sql
-- ตรวจ tables ครบ
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'sd_%'
ORDER BY table_name;
-- ต้องได้: sd_audit_log, sd_cash_on_hand, sd_channel_config, sd_daily_sales,
--          sd_expenses, sd_finance_bridge, sd_function_permissions, sd_invoices,
--          sd_sale_channels, sd_store_settings, sd_suppliers

-- ตรวจ seed data
SELECT store_id, COUNT(*) as channels FROM sd_channel_config GROUP BY store_id;
-- ต้องได้ 6 ร้าน × ~10 channels

SELECT COUNT(*) as perms FROM sd_function_permissions;
-- ต้องได้ 210 (30 functions × 7 tiers)

-- ตรวจ module registration
SELECT * FROM modules WHERE module_id = 'sale_daily';
-- ต้องได้ 1 row, status = 'active'
```

---

## 🚀 Step 2: Deploy Edge Function

**ที่ไหน:** Terminal ที่มี Supabase CLI

```bash
# 1. สร้าง function directory
mkdir -p supabase/functions/sale-daily

# 2. Copy Edge Function
cp deploy/edge-function/index.ts supabase/functions/sale-daily/index.ts

# 3. Deploy
supabase functions deploy sale-daily --no-verify-jwt

# 4. Test
curl -X POST \
  'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/sale-daily?action=sd_get_channels' \
  -H 'Content-Type: application/json' \
  -d '{"token":"TEST_TOKEN_HERE","store_id":"MNG"}'
```

**Expected:** ได้ JSON กลับมา (อาจ error เรื่อง token ก็ได้ — แค่ไม่ใช่ 404 ก็ OK)

---

## 🌐 Step 3: Deploy Frontend → GitHub Pages

**ที่ไหน:** GitHub repo `spg-sale-daily` (หรือชื่ออื่นตามที่ตั้ง)

```
repo/
├── index.html          ← rename จาก index_sd.html
├── css/
│   └── styles_sd.css
└── js/
    ├── api_sd.js
    ├── app_sd.js
    ├── screens_sd.js
    ├── screens2_sd.js
    ├── screens3_sd.js
    └── screens4_sd.js
```

**⚠️ ก่อน push — แก้ 1 จุดสำคัญ:**

**`js/api_sd.js` บรรทัด ~14** — ตรวจ BASE_URL:
```javascript
let BASE_URL = localStorage.getItem('spg_sd_api_url') 
  || 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/sale-daily';
```
→ URL นี้ควรถูกแล้ว (project ref เดียวกับ Home module)

**Deploy:**
```bash
git add .
git commit -m "Sale Daily v1.3 - full deploy"
git push origin main
```

**GitHub Pages Settings:**
- Settings → Pages → Source: Deploy from branch → `main` → `/ (root)`
- URL จะเป็น: `https://<org>.github.io/spg-sale-daily/`

---

## 🔗 Step 4: Update Home Module Bridge

**⚠️ สำคัญ:** แก้ `app_url` ใน SQL ให้ตรงกับ GitHub Pages URL จริง

**ถ้ายัง run 008 ไม่ได้:** ไป Supabase SQL Editor แก้:
```sql
UPDATE modules 
SET app_url = 'https://<org>.github.io/spg-sale-daily/'
WHERE module_id = 'sale_daily';
```

**หรือ** ถ้า Home module ใช้ domain เอง:
```sql
UPDATE modules 
SET app_url = 'https://sale-daily.spgapp.com.au'
WHERE module_id = 'sale_daily';
```

**ตรวจสอบ:** เปิด Home module → Dashboard → ต้องเห็น 💰 ยอดขายรายวัน card

---

## ✅ Step 5: Smoke Test

### 5.1 เปิดจาก Home Module
1. Login Home → Dashboard
2. กด 💰 Sale Daily → ต้องเปิดหน้าใหม่ + ผ่าน auth
3. เห็น S0 Dashboard

### 5.2 Test S1 Daily Sale
1. กด "ยอดขาย" → S1
2. กรอก channel 1-2 ตัว (เช่น Eftpos $100, Cash $50)
3. ถ่ายรูป 2 รูป (card + cash)
4. กด "บันทึก + Push Finance"
5. ✅ Toast สำเร็จ + แสดง Finance record count
6. ตรวจ: `SELECT * FROM sd_finance_bridge ORDER BY created_at DESC LIMIT 5;`

### 5.3 Test S2 Expense
1. กด "ค่าใช้จ่าย" → S2
2. กรอก 8 fields + ถ่ายรูป
3. กด "บันทึก + Push Finance"
4. ✅ Finance bridge record type = 'Bill', status = 'Paid'

### 5.4 Test S3 Invoice
1. กด "Invoice" → S3
2. กรอก form + เลือก Unpaid + ใส่ Due Date
3. กด "บันทึก"
4. ✅ Finance bridge record type = 'Invoice', status = 'Unpaid'
5. กด "จ่ายแล้ว" ใน list → เปลี่ยนเป็น Paid

### 5.5 Test S4 Cash On Hand
1. กด "เงินสด" → S4
2. ✅ Auto-calc: Cash Sale − Cash Expend = Expected
3. ใส่ Actual Cash ตรงกับ Expected → ✅ เขียว
4. ใส่ Actual Cash ต่างเกิน $2 → 🔴 + บังคับใส่เหตุผล
5. ถ่ายรูป + Submit → ✅ Handover chain เริ่ม

### 5.6 Test S5-S6 History
1. กด "ประวัติยอดขาย" → S5 → เห็น KPIs + chart
2. กด "ประวัติรายจ่าย" → S6 → เห็น by Category / Vendor / List

### 5.7 Test S7 Admin (T1-T2 เท่านั้น)
1. กด "ตั้งค่า" → S7
2. Tab Channels → toggle enable/disable
3. Tab Suppliers → ค้นหา + toggle
4. Tab Settings → แก้ค่า + บันทึก
5. Tab Permissions → toggle matrix ✅/—
6. Tab Audit → เห็น log ที่เพิ่งทำ

---

## 🔐 Step 6: RLS Verification

```sql
-- Test as store user (not service_role)
-- Should only see own store data
SET role authenticated;
SET request.jwt.claims = '{"sub":"test-uuid"}';

SELECT COUNT(*) FROM sd_daily_sales;  -- should be filtered by RLS
SELECT COUNT(*) FROM sd_expenses;     -- should be filtered
SELECT COUNT(*) FROM sd_finance_bridge; -- SELECT allowed for all
```

---

## 📱 Step 7: Roll Out Plan

| Phase | ร้าน | Timeline | ทำอะไร |
|---|---|---|---|
| **Phase 1** | MNG (Mango Coco) | Week 1 | T3-T5 ทดลองกรอก + พี่อร monitor |
| **Phase 2** | ISH, GB | Week 2 | ขยายอีก 2 ร้าน |
| **Phase 3** | RW, TMC, BC | Week 3 | ครบทุกร้าน |
| **Phase 4** | ปิด Google Sheets | Week 4+ | ย้ายข้อมูลเก่า (ถ้าต้องการ) |

**Roll out checklist per store:**
- [ ] ตรวจ channel config ถูกต้อง (S7 Channels)
- [ ] ตรวจ store settings (tolerance, bank account)
- [ ] สร้าง account ใน Home module (ถ้ายังไม่มี)
- [ ] สอนพนักงาน: S1 กรอกยอดขาย + ถ่ายรูป
- [ ] สอนพนักงาน: S2 กรอกค่าใช้จ่าย + ถ่ายรูป
- [ ] สอนพนักงาน: S4 นับเงินสด
- [ ] วัน launch: พี่อร monitor ผ่าน S0 Dashboard

---

## 📁 File Inventory

```
deploy/
├── sql/
│   ├── 003_sale_daily_tables.sql      — Core 9 tables
│   ├── 004_sale_daily_seed.sql        — Channel/Settings/Permissions seed
│   ├── 005_shared_tables.sql          — Category/Vendor/Entity + seed
│   ├── 006_sd_finance_bridge.sql      — Finance bridge table
│   ├── 007_sd_audit_log.sql           — Audit trail
│   ├── 008_register_sale_daily_module.sql — Register in Home module
│   └── 000_combined_migration.sql     — All-in-one (003-007)
├── edge-function/
│   └── index.ts                       — Supabase Edge Function (32 endpoints)
└── frontend/
    ├── index_sd.html                  — HTML shell (rename to index.html)
    ├── css/
    │   └── styles_sd.css              — Theme + 40+ components
    └── js/
        ├── api_sd.js                  — API client (31 methods)
        ├── app_sd.js                  — Router + auth guard
        ├── screens_sd.js              — S0 Dashboard + S1 Daily Sale
        ├── screens2_sd.js             — S2 Expense + S3 Invoice
        ├── screens3_sd.js             — S4 Cash + S5-S6 History
        └── screens4_sd.js             — S7 Admin (5 tabs)
```

**Total: 17 files | ~8,200 lines**

---

## ⚠️ Known Issues / Notes

1. **Storage bucket**: ต้องสร้าง `sd-photos` bucket ใน Supabase Storage ก่อนใช้ photo upload
   ```sql
   -- In Supabase Dashboard → Storage → Create bucket
   -- Name: sd-photos
   -- Public: false
   -- File size limit: 5MB
   -- Allowed MIME types: image/jpeg, image/png, image/webp
   ```

2. **CORS**: Edge Function ตั้ง CORS headers แล้ว แต่ถ้า GitHub Pages domain ต่างจากที่เคยใช้ อาจต้องเพิ่มใน Edge Function

3. **Finance module**: ยังเป็น `coming_soon` — ข้อมูลจะถูกเก็บใน `sd_finance_bridge` รอ Finance module อ่าน

4. **Backdate**: Default 2 วัน สำหรับ T3-T5, T1-T2 override ได้เสมอ — แก้ได้ที่ S7 Settings

5. **Channel config**: Seed data มี 10 channels ต่อร้าน — ตรวจให้ตรงกับร้านจริงก่อน launch
