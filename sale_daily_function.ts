// ═══════════════════════════════════════════════════════════════
// SPG Sale Daily Module — Supabase Edge Function
// sale_daily_function.ts — Sprint 1: Auth + Lookup + S1 + Finance Bridge
// Version: 1.0 | March 2026
//
// Endpoints (Sprint 1):
//   EP-01 sd_validate_session   — Validate token + get store/tier/permissions
//   EP-02 sd_get_permissions    — Get 30 function permissions for user's tier
//   EP-03 sd_get_channels       — Get enabled channels for store
//   EP-04 sd_get_vendors        — Get vendor list (ALL + store-specific)
//   EP-05 sd_create_vendor      — Create new vendor instantly (T1-T5)
//   EP-06 sd_get_categories     — Get category cascade (type→main→sub)
//   EP-07 sd_get_store_settings — Get store settings
//   EP-08 sd_get_daily_sale     — Get sale data for a specific date
//   EP-09 sd_save_daily_sale    — Save channels + photos + Finance bridge
//   EP-10 sd_get_dashboard      — Dashboard KPIs + alerts
//   EP-26 sd_upload_photo       — Upload photo to sd-photos bucket
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Photo upload
      const formData = await req.formData();
      body = { formData };
    } else {
      body = await req.json().catch(() => ({}));
    }

    let result;

    switch (action) {
      case 'sd_validate_session':
        result = await sdValidateSession(supabase, body);
        break;
      case 'sd_get_permissions':
        result = await sdGetPermissions(supabase, body);
        break;
      case 'sd_get_channels':
        result = await sdGetChannels(supabase, body);
        break;
      case 'sd_get_vendors':
        result = await sdGetVendors(supabase, body);
        break;
      case 'sd_create_vendor':
        result = await sdCreateVendor(supabase, body);
        break;
      case 'sd_get_categories':
        result = await sdGetCategories(supabase, body);
        break;
      case 'sd_get_store_settings':
        result = await sdGetStoreSettings(supabase, body);
        break;
      case 'sd_get_daily_sale':
        result = await sdGetDailySale(supabase, body);
        break;
      case 'sd_save_daily_sale':
        result = await sdSaveDailySale(supabase, body);
        break;
      case 'sd_get_dashboard':
        result = await sdGetDashboard(supabase, body);
        break;
      case 'sd_upload_photo':
        result = await sdUploadPhoto(supabase, body);
        break;
      // Sprint 2: S2 Expense + S3 Invoice
      case 'sd_get_expenses':
        result = await sdGetExpenses(supabase, body);
        break;
      case 'sd_save_expense':
        result = await sdSaveExpense(supabase, body);
        break;
      case 'sd_delete_expense':
        result = await sdDeleteExpense(supabase, body);
        break;
      case 'sd_get_invoices':
        result = await sdGetInvoices(supabase, body);
        break;
      case 'sd_save_invoice':
        result = await sdSaveInvoice(supabase, body);
        break;
      case 'sd_update_invoice_payment':
        result = await sdUpdateInvoicePayment(supabase, body);
        break;
      case 'sd_delete_invoice':
        result = await sdDeleteInvoice(supabase, body);
        break;
      // Sprint 3: S4 Cash + S5-S6 History
      case 'sd_get_cash':
        result = await sdGetCash(supabase, body);
        break;
      case 'sd_submit_cash_count':
        result = await sdSubmitCashCount(supabase, body);
        break;
      case 'sd_confirm_handover':
        result = await sdConfirmHandover(supabase, body);
        break;
      case 'sd_get_sale_history':
        result = await sdGetSaleHistory(supabase, body);
        break;
      case 'sd_get_expense_history':
        result = await sdGetExpenseHistory(supabase, body);
        break;
      // Sprint 4: S7 Admin
      case 'sd_admin_get_channels':
        result = await sdAdminGetChannels(supabase, body);
        break;
      case 'sd_admin_update_channel':
        result = await sdAdminUpdateChannel(supabase, body);
        break;
      case 'sd_admin_get_suppliers':
        result = await sdAdminGetSuppliers(supabase, body);
        break;
      case 'sd_admin_update_supplier':
        result = await sdAdminUpdateSupplier(supabase, body);
        break;
      case 'sd_admin_get_settings':
        result = await sdAdminGetSettings(supabase, body);
        break;
      case 'sd_admin_update_settings':
        result = await sdAdminUpdateSettings(supabase, body);
        break;
      case 'sd_admin_get_permissions':
        result = await sdAdminGetPermissions(supabase, body);
        break;
      case 'sd_admin_update_permission':
        result = await sdAdminUpdatePermission(supabase, body);
        break;
      case 'sd_admin_get_audit_log':
        result = await sdAdminGetAuditLog(supabase, body);
        break;
      default:
        result = { success: false, error: { code: 'INVALID_ACTION', message: `Unknown action: ${action}` } };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'SERVER_ERROR', message: err.message } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});


// ═══════════════════════════════════════════════════════════════
// HELPER: Validate token → return session context
// ═══════════════════════════════════════════════════════════════

// SessionContext: session_id, account_id, tier_id, tier_level, store_id, dept_id, display_name

async function getSessionContext(supabase, token) {
  if (!token) throw { code: 'NO_TOKEN', message: 'Token required' };

  // Join sessions → accounts → access_tiers to get tier_level
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      session_id, account_id, expires_at,
      accounts!inner (
        account_id, display_label, tier_id, store_id, dept_id, is_active,
        access_tiers!inner ( tier_level )
      )
    `)
    .eq('session_id', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !session) throw { code: 'INVALID_SESSION', message: 'Session expired or invalid' };
  if (!session.accounts.is_active) throw { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' };

  const acc = session.accounts;
  return {
    session_id: session.session_id,
    account_id: acc.account_id,
    tier_id: acc.tier_id,
    tier_level: acc.access_tiers.tier_level,
    store_id: acc.store_id,
    dept_id: acc.dept_id,
    display_name: acc.display_label,
  };
}


// Helper: check specific permission
async function checkPermission(supabase, tier_id, function_key) {
  const { data } = await supabase
    .from('sd_function_permissions')
    .select('is_allowed')
    .eq('tier_id', tier_id)
    .eq('function_key', function_key)
    .single();
  return data?.is_allowed === true;
}


// Helper: get store_id for query (HQ sees all, Store sees own)
function getStoreFilter(ctx, requested_store_id) {
  // HQ (tier_level <=2 or store_id = 'HQ') can see all stores
  if (ctx.store_id === 'HQ' || ctx.tier_level <= 2) {
    return requested_store_id || null; // null = all stores
  }
  // Store users see own store only
  return ctx.store_id;
}


// ═══════════════════════════════════════════════════════════════
// EP-01: sd_validate_session
// ═══════════════════════════════════════════════════════════════

async function sdValidateSession(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    // Get module access
    const { data: moduleAccess } = await supabase
      .from('module_permissions')
      .select('access_level')
      .eq('module_id', 'sale_daily')
      .eq('tier_id', ctx.tier_id)
      .single();

    if (!moduleAccess || moduleAccess.access_level === 'none') {
      return { success: false, error: { code: 'NO_ACCESS', message: 'No access to Sale Daily module' } };
    }

    // Get permissions summary
    const { data: perms } = await supabase
      .from('sd_function_permissions')
      .select('function_key, is_allowed')
      .eq('tier_id', ctx.tier_id);

    const permissions = {};
    (perms || []).forEach((p) => { permissions[p.function_key] = p.is_allowed; });

    // Get store info
    const { data: store } = await supabase
      .from('stores')
      .select('store_id, store_name, brand_name')
      .eq('store_id', ctx.store_id)
      .single();

    return {
      success: true,
      data: {
        session_id: ctx.session_id,
        account_id: ctx.account_id,
        display_name: ctx.display_name,
        tier_id: ctx.tier_id,
        tier_level: ctx.tier_level,
        store_id: ctx.store_id,
        dept_id: ctx.dept_id,
        store_name: store?.store_name || ctx.store_id,
        brand_name: store?.brand_name || '',
        access_level: moduleAccess.access_level,
        permissions,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'AUTH_ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-02: sd_get_permissions
// ═══════════════════════════════════════════════════════════════

async function sdGetPermissions(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    const { data, error } = await supabase
      .from('sd_function_permissions')
      .select('function_key, function_name, function_group, is_allowed')
      .eq('tier_id', ctx.tier_id)
      .order('function_group')
      .order('function_key');

    if (error) throw error;

    return { success: true, data: { tier_id: ctx.tier_id, permissions: data } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-03: sd_get_channels
// ═══════════════════════════════════════════════════════════════

async function sdGetChannels(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    const { data, error } = await supabase
      .from('sd_channel_config')
      .select('*')
      .eq('store_id', store_id)
      .eq('is_enabled', true)
      .order('sort_order');

    if (error) throw error;

    return { success: true, data: { store_id, channels: data } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-04: sd_get_vendors
// ═══════════════════════════════════════════════════════════════

async function sdGetVendors(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    // Get vendors: ALL (shared) + store-specific
    const { data, error } = await supabase
      .from('vendor_master')
      .select('id, vendor_name, vendor_type, vendor_group, default_payment_method')
      .eq('is_active', true)
      .order('vendor_name');

    if (error) throw error;

    // Also get store-specific suppliers (sd_suppliers)
    const { data: suppliers } = await supabase
      .from('sd_suppliers')
      .select('id, supplier_name, payment_methods, is_special_track')
      .or(`store_id.eq.ALL,store_id.eq.${store_id}`)
      .eq('is_active', true)
      .order('sort_order');

    return {
      success: true,
      data: {
        vendors: data || [],
        suppliers: suppliers || [],
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-05: sd_create_vendor — Anyone T1-T5 can create
// ═══════════════════════════════════════════════════════════════

async function sdCreateVendor(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    if (ctx.tier_level > 5) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'T6-T7 cannot create vendors' } };
    }

    const vendor_name = (body.vendor_name || '').trim();
    if (!vendor_name) {
      return { success: false, error: { code: 'VALIDATION', message: 'Vendor name is required' } };
    }

    // Check duplicate (case-insensitive)
    const { data: existing } = await supabase
      .from('vendor_master')
      .select('id, vendor_name')
      .ilike('vendor_name', vendor_name)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: { code: 'DUPLICATE', message: `Vendor "${existing[0].vendor_name}" already exists` } };
    }

    const { data, error } = await supabase
      .from('vendor_master')
      .insert({
        vendor_name,
        vendor_group: body.vendor_group || null,
        vendor_type: body.vendor_type || null,
        is_active: true,
        created_by: ctx.account_id,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: { vendor: data, message: `Vendor "${vendor_name}" created` } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-06: sd_get_categories — Cascade dropdown data
// ═══════════════════════════════════════════════════════════════

async function sdGetCategories(supabase, body) {
  try {
    await getSessionContext(supabase, body.token);

    const query = supabase
      .from('category_master')
      .select('transaction_type, main_category, sub_category, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    // Optional filter by transaction_type
    if (body.transaction_type) {
      query.eq('transaction_type', body.transaction_type);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Group into cascade structure
    const cascade = {};
    (data || []).forEach((row) => {
      if (!cascade[row.transaction_type]) cascade[row.transaction_type] = {};
      if (!cascade[row.transaction_type][row.main_category]) cascade[row.transaction_type][row.main_category] = [];
      cascade[row.transaction_type][row.main_category].push(row.sub_category);
    });

    return { success: true, data: { categories: data, cascade } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-07: sd_get_store_settings
// ═══════════════════════════════════════════════════════════════

async function sdGetStoreSettings(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    const { data, error } = await supabase
      .from('sd_store_settings')
      .select('*')
      .eq('store_id', store_id)
      .single();

    if (error) throw error;

    return { success: true, data: { settings: data } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-08: sd_get_daily_sale — Get sale for specific date
// ═══════════════════════════════════════════════════════════════

async function sdGetDailySale(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;
    const sale_date = body.sale_date; // YYYY-MM-DD

    if (!sale_date) {
      return { success: false, error: { code: 'VALIDATION', message: 'sale_date is required' } };
    }

    // Get daily sale with channels
    const { data: sale } = await supabase
      .from('sd_daily_sales')
      .select(`
        *,
        sd_sale_channels (
          id, channel_key, amount, fin_transaction_id
        )
      `)
      .eq('store_id', store_id)
      .eq('sale_date', sale_date)
      .single();

    // Get enabled channels for reference
    const { data: channels } = await supabase
      .from('sd_channel_config')
      .select('channel_key, channel_label, finance_sub_category, dashboard_group, sort_order')
      .eq('store_id', store_id)
      .eq('is_enabled', true)
      .order('sort_order');

    return {
      success: true,
      data: {
        store_id,
        sale_date,
        sale: sale || null,
        channels: channels || [],
        is_new: !sale,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-09: sd_save_daily_sale — Save + Finance Bridge ★
// ═══════════════════════════════════════════════════════════════
// This is the core "กรอก 1 ครั้ง = 2 ที่" logic
// 1. Save/update sd_daily_sales + sd_sale_channels
// 2. Auto-create Income records in Finance (Pending) for each channel > $0

async function sdSaveDailySale(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    // Permission check
    const canCreate = await checkPermission(supabase, ctx.tier_id, 'create_daily_sales');
    const canEdit = await checkPermission(supabase, ctx.tier_id, 'edit_daily_sales');

    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;
    const sale_date = body.sale_date;
    const channel_amounts = body.channels; // { channel_key: amount }
    const photo_card_url = body.photo_card_url;
    const photo_cash_url = body.photo_cash_url;

    // Validation
    if (!sale_date) return { success: false, error: { code: 'VALIDATION', message: 'sale_date required' } };
    if (!channel_amounts || typeof channel_amounts !== 'object') {
      return { success: false, error: { code: 'VALIDATION', message: 'channels required' } };
    }
    if (!photo_card_url || !photo_cash_url) {
      return { success: false, error: { code: 'VALIDATION', message: 'Both card photo and cash photo required' } };
    }

    // Check if record exists
    const { data: existing } = await supabase
      .from('sd_daily_sales')
      .select('id, is_locked, fin_synced')
      .eq('store_id', store_id)
      .eq('sale_date', sale_date)
      .single();

    const isUpdate = !!existing;

    if (isUpdate) {
      if (!canEdit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No edit permission' } };
      if (existing.is_locked) {
        const canOverride = await checkPermission(supabase, ctx.tier_id, 'edit_locked_sales');
        if (!canOverride) return { success: false, error: { code: 'LOCKED', message: 'Record is locked. T1-T2 required to override.' } };
      }
    } else {
      if (!canCreate) return { success: false, error: { code: 'NO_PERMISSION', message: 'No create permission' } };
    }

    // Backdate check
    const today = new Date();
    const saleDay = new Date(sale_date);
    const diffDays = Math.floor((today.getTime() - saleDay.getTime()) / (1000 * 60 * 60 * 24));

    const { data: settings } = await supabase
      .from('sd_store_settings')
      .select('backdate_limit_days')
      .eq('store_id', store_id)
      .single();

    const backdateLimit = settings?.backdate_limit_days || 2;
    if (diffDays > backdateLimit) {
      const canBackdate = await checkPermission(supabase, ctx.tier_id, 'edit_sales_backdate');
      if (!canBackdate) {
        return { success: false, error: { code: 'BACKDATE', message: `Cannot edit beyond ${backdateLimit} days. T1-T2 required.` } };
      }
    }

    // Calculate total
    const totalSales = Object.values(channel_amounts).reduce((sum, amt) => sum + (parseFloat(amt) || 0), 0);

    // === UPSERT daily_sales ===
    let daily_sale_id;

    if (isUpdate) {
      const { error } = await supabase
        .from('sd_daily_sales')
        .update({
          total_sales: totalSales,
          photo_card_url,
          photo_cash_url,
          difference: body.difference || null,
          cancel_desc: body.cancel_desc || null,
          cancel_amount: body.cancel_amount || null,
          cancel_reason: body.cancel_reason || null,
          cancel_approved_by: body.cancel_approved_by || null,
          fin_synced: false, // Mark for re-sync
          updated_by: ctx.account_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
      daily_sale_id = existing.id;

      // Delete old channels (will re-insert)
      await supabase
        .from('sd_sale_channels')
        .delete()
        .eq('daily_sale_id', daily_sale_id);

    } else {
      const { data: newSale, error } = await supabase
        .from('sd_daily_sales')
        .insert({
          store_id,
          sale_date,
          total_sales: totalSales,
          photo_card_url,
          photo_cash_url,
          difference: body.difference || null,
          cancel_desc: body.cancel_desc || null,
          cancel_amount: body.cancel_amount || null,
          fin_synced: false,
          is_locked: false,
          created_by: ctx.account_id,
        })
        .select('id')
        .single();

      if (error) throw error;
      daily_sale_id = newSale.id;
    }

    // === INSERT channels ===
    const channelRows = Object.entries(channel_amounts)
      .filter(([, amt]) => parseFloat(amt) >= 0)
      .map(([key, amt]) => ({
        daily_sale_id,
        channel_key: key,
        amount: parseFloat(amt) || 0,
      }));

    if (channelRows.length > 0) {
      const { error: chErr } = await supabase
        .from('sd_sale_channels')
        .insert(channelRows);
      if (chErr) throw chErr;
    }

    // === FINANCE BRIDGE: Auto-create Income records ===
    const financeResults = await createFinanceIncomeRecords(
      supabase, store_id, sale_date, daily_sale_id, channel_amounts, photo_card_url, ctx.account_id
    );

    // Mark as synced
    await supabase
      .from('sd_daily_sales')
      .update({ fin_synced: true })
      .eq('id', daily_sale_id);

    return {
      success: true,
      data: {
        daily_sale_id,
        store_id,
        sale_date,
        total_sales: totalSales,
        channels_saved: channelRows.length,
        finance_records_created: financeResults.created,
        is_update: isUpdate,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// FINANCE BRIDGE: Create Income records from S1 Daily Sale
// ═══════════════════════════════════════════════════════════════
// For each channel with amount > $0:
//   → 1 Finance Income record [Pending]
//   → Doc Number: SD-{store}-{date}-{channel}
//   → Sub Category: from channel_config.finance_sub_category
//   → Payment Status: Pending

async function createFinanceIncomeRecords(
  supabase,
  store_id,
  sale_date,
  daily_sale_id,
  channel_amounts,
  photo_url,
  created_by
) {
  // Get channel config for finance mapping
  const { data: configs } = await supabase
    .from('sd_channel_config')
    .select('channel_key, channel_label, finance_sub_category')
    .eq('store_id', store_id)
    .eq('is_enabled', true);

  const configMap = {};
  (configs || []).forEach((c) => { configMap[c.channel_key] = c; });

  // Get store → entity mapping for Paying Entity
  const { data: entity } = await supabase
    .from('paying_entities')
    .select('entity_id, entity_name')
    .eq('store_id', store_id)
    .single();

  // Get default bank account
  const { data: settings } = await supabase
    .from('sd_store_settings')
    .select('default_bank_account')
    .eq('store_id', store_id)
    .single();

  // Delete old finance records for this sale (if re-saving)
  // Use doc_number pattern to find related records
  const docPrefix = `SD-${store_id}-${sale_date}`;
  // We store fin_transaction_id in sd_sale_channels, so we can also clean up

  let created = 0;
  const finRecordIds = {};

  for (const [channelKey, amount] of Object.entries(channel_amounts)) {
    const amt = parseFloat(String(amount)) || 0;
    if (amt <= 0) continue;

    const config = configMap[channelKey];
    if (!config) continue;

    const docNumber = `SD-${store_id}-${sale_date}-${channelKey}`;
    const description = `Daily ${config.channel_label} - ${store_id} - ${sale_date}`;
    const accrualMonth = sale_date.substring(0, 7) + '-01'; // First day of month

    // Upsert finance record (using doc_number as unique identifier)
    // NOTE: This writes to a finance_transactions table if it exists
    // For now, we store the mapping in sd_sale_channels.fin_transaction_id
    // The actual Finance module will read from sd_sale_channels

    // Store the finance bridge data as a structured record
    // that the Finance module can consume
    const finRecord = {
      source_module: 'sale_daily',
      source_id: daily_sale_id,
      doc_type: 'None',
      doc_number: docNumber,
      doc_file: photo_url,
      issue_date: sale_date,
      accrual_month: accrualMonth,
      vendor_name: null, // Income has no vendor
      transaction_type: 'Income',
      main_category: 'Revenue',
      sub_category: config.finance_sub_category,
      description,
      amount_ex_gst: amt,
      gst: 0,
      total_amount: amt,
      payment_status: 'Pending',
      payment_date: null,
      paying_entity: entity?.entity_name || store_id,
      bank_account: settings?.default_bank_account || null,
      payment_method: null,
      allocation_type: 'Self',
      cost_owner_entity: null,
      allocation_amount: null,
      notes: `Auto-generated from Sale Daily S1`,
      created_by,
    };

    // Try upsert to finance_bridge table
    const { data: fin, error: finErr } = await supabase
      .from('sd_finance_bridge')
      .upsert(finRecord, { onConflict: 'doc_number' })
      .select('id')
      .single();

    if (!finErr && fin) {
      finRecordIds[channelKey] = fin.id;
      created++;

      // Update channel with fin_transaction_id
      await supabase
        .from('sd_sale_channels')
        .update({ fin_transaction_id: fin.id })
        .eq('daily_sale_id', daily_sale_id)
        .eq('channel_key', channelKey);
    }
  }

  return { created, records: finRecordIds };
}


// ═══════════════════════════════════════════════════════════════
// EP-10: sd_get_dashboard — KPIs + Alerts
// ═══════════════════════════════════════════════════════════════

async function sdGetDashboard(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    // Today's sale
    const { data: todaySale } = await supabase
      .from('sd_daily_sales')
      .select('total_sales, fin_synced, is_locked')
      .eq('store_id', store_id)
      .eq('sale_date', today)
      .single();

    // Month total
    const { data: monthSales } = await supabase
      .from('sd_daily_sales')
      .select('sale_date, total_sales')
      .eq('store_id', store_id)
      .gte('sale_date', monthStart)
      .lte('sale_date', today)
      .order('sale_date', { ascending: false });

    const monthTotal = (monthSales || []).reduce((sum, s) => sum + (s.total_sales || 0), 0);
    const daysRecorded = (monthSales || []).length;

    // Yesterday comparison
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdaySale } = await supabase
      .from('sd_daily_sales')
      .select('total_sales')
      .eq('store_id', store_id)
      .eq('sale_date', yesterdayStr)
      .single();

    // Alerts: missing days this month
    const expectedDays = new Date().getDate(); // days so far this month
    const missingDays = expectedDays - daysRecorded;

    // Cash mismatch alerts
    const { data: cashAlerts } = await supabase
      .from('sd_cash_on_hand')
      .select('cash_date, difference, is_matched')
      .eq('store_id', store_id)
      .eq('is_matched', false)
      .gte('cash_date', monthStart)
      .order('cash_date', { ascending: false })
      .limit(5);

    // Pending invoices count
    const { count: unpaidCount } = await supabase
      .from('sd_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store_id)
      .eq('payment_status', 'unpaid');

    return {
      success: true,
      data: {
        store_id,
        today: {
          date: today,
          total_sales: todaySale?.total_sales || 0,
          is_recorded: !!todaySale,
          fin_synced: todaySale?.fin_synced || false,
        },
        yesterday: {
          date: yesterdayStr,
          total_sales: yesterdaySale?.total_sales || 0,
        },
        month: {
          total: monthTotal,
          days_recorded: daysRecorded,
          daily_average: daysRecorded > 0 ? Math.round(monthTotal / daysRecorded) : 0,
          daily_breakdown: (monthSales || []).slice(0, 7), // Last 7 days
        },
        alerts: {
          missing_days: missingDays > 0 ? missingDays : 0,
          cash_mismatches: cashAlerts || [],
          unpaid_invoices: unpaidCount || 0,
        },
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-26: sd_upload_photo
// ═══════════════════════════════════════════════════════════════

async function sdUploadPhoto(supabase, body) {
  try {
    const formData = body.formData;
    if (!formData) {
      return { success: false, error: { code: 'VALIDATION', message: 'No file uploaded' } };
    }

    const token = formData.get('token') as string;
    const ctx = await getSessionContext(supabase, token);

    const file = formData.get('file') as File;
    if (!file) {
      return { success: false, error: { code: 'VALIDATION', message: 'No file in form data' } };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Only jpg, png, webp allowed' } };
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: { code: 'VALIDATION', message: 'File too large (max 5MB)' } };
    }

    const store_id = formData.get('store_id') || ctx.store_id;
    const category = formData.get('category') || 'sale'; // sale, expense, invoice, cash
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const path = `${store_id}/${category}/${timestamp}.${ext}`;

    const { data, error } = await supabase.storage
      .from('sd-photos')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('sd-photos')
      .getPublicUrl(path);

    return {
      success: true,
      data: {
        path,
        url: urlData.publicUrl,
        size: file.size,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'UPLOAD_ERROR', message: err.message } };
  }
}

    let query = supabase
      .from('sd_expenses')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false });

    // Filter by date (optional)
    if (body.expense_date) {
      query = query.eq('expense_date', body.expense_date);
    }

    // Filter by date range (optional)
    if (body.date_from) query = query.gte('expense_date', body.date_from);
    if (body.date_to) query = query.lte('expense_date', body.date_to);

    // Pagination
    const limit = body.limit || 50;
    const offset = body.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // Summary totals for the date
    let daySummary = null;
    if (body.expense_date) {
      const expenses = data || [];
      const totalCash = expenses.filter((e) => e.payment_method === 'cash')
        .reduce((sum, e) => sum + (e.total_amount || 0), 0);
      const totalCard = expenses.filter((e) => e.payment_method === 'card')
        .reduce((sum, e) => sum + (e.total_amount || 0), 0);
      daySummary = {
        total_expenses: expenses.reduce((sum, e) => sum + (e.total_amount || 0), 0),
        total_cash: totalCash,
        total_card: totalCard,
        count: expenses.length,
      };
    }

    return {
      success: true,
      data: {
        store_id,
        expenses: data || [],
        summary: daySummary,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-12: sd_save_expense — Save + Finance Bridge [Paid] ★
// ═══════════════════════════════════════════════════════════════
// หน้าร้านกรอก 8 fields + 1 photo → Finance ได้ครบ 25 columns
// Finance bridge: Doc Type = Bill, Payment Status = Paid, Transaction Type = Expense

async function sdSaveExpense(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    // Permission check
    const isUpdate = !!body.expense_id;
    if (isUpdate) {
      const canEdit = await checkPermission(supabase, ctx.tier_id, 'edit_expenses');
      if (!canEdit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No edit permission' } };
    } else {
      const canCreate = await checkPermission(supabase, ctx.tier_id, 'create_expenses');
      if (!canCreate) return { success: false, error: { code: 'NO_PERMISSION', message: 'No create permission' } };
    }

    // === VALIDATION: 8 mandatory fields + 1 photo ===
    const doc_number     = (body.doc_number || '').trim();
    const vendor_name    = (body.vendor_name || '').trim();
    const main_category  = (body.main_category || '').trim();
    const sub_category   = (body.sub_category || '').trim();
    const description    = (body.description || '').trim();
    const amount_ex_gst  = parseFloat(body.amount_ex_gst) || 0;
    const gst            = parseFloat(body.gst) || 0;
    const payment_method = (body.payment_method || '').trim();
    const photo_url      = (body.photo_url || '').trim();
    const expense_date   = body.expense_date || new Date().toISOString().split('T')[0];

    if (!doc_number)     return { success: false, error: { code: 'VALIDATION', message: 'Doc Number required (❶)' } };
    if (!vendor_name)    return { success: false, error: { code: 'VALIDATION', message: 'Vendor Name required (❷)' } };
    if (!main_category)  return { success: false, error: { code: 'VALIDATION', message: 'Main Category required (❸)' } };
    if (!sub_category)   return { success: false, error: { code: 'VALIDATION', message: 'Sub Category required (❹)' } };
    if (!description)    return { success: false, error: { code: 'VALIDATION', message: 'Description required (❺)' } };
    if (amount_ex_gst < 0) return { success: false, error: { code: 'VALIDATION', message: 'Amount must be ≥ 0 (❻)' } };
    if (gst < 0)         return { success: false, error: { code: 'VALIDATION', message: 'GST must be ≥ 0 (❼)' } };
    if (!payment_method || !['cash', 'card'].includes(payment_method)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Payment Method must be cash or card (❽)' } };
    }
    if (!photo_url)      return { success: false, error: { code: 'VALIDATION', message: 'Photo required (📸)' } };

    // Validate category cascade
    const { data: catCheck } = await supabase
      .from('category_master')
      .select('id')
      .eq('transaction_type', 'Expense')
      .eq('main_category', main_category)
      .eq('sub_category', sub_category)
      .eq('is_active', true)
      .single();

    if (!catCheck) {
      return { success: false, error: { code: 'VALIDATION', message: `Invalid category: ${main_category} > ${sub_category}` } };
    }

    const total_amount = amount_ex_gst + gst;
    const accrual_month = expense_date.substring(0, 7) + '-01';

    // === UPSERT expense ===
    const expenseRow = {
      store_id,
      expense_date,
      doc_number,
      vendor_name,
      main_category,
      sub_category,
      description,
      amount_ex_gst,
      gst,
      total_amount,
      payment_method,
      accrual_month,
      photo_url,
      updated_by: ctx.account_id,
      updated_at: new Date().toISOString(),
    };

    let expense_id;

    if (isUpdate) {
      const { error } = await supabase
        .from('sd_expenses')
        .update(expenseRow)
        .eq('id', body.expense_id);
      if (error) throw error;
      expense_id = body.expense_id;
    } else {
      const { data: newExp, error } = await supabase
        .from('sd_expenses')
        .insert({ ...expenseRow, created_by: ctx.account_id })
        .select('id')
        .single();
      if (error) throw error;
      expense_id = newExp.id;
    }

    // === FINANCE BRIDGE: Create Expense record [Paid] ===
    const finResult = await createFinanceExpenseRecord(
      supabase, store_id, expense_id, {
        doc_type: 'Bill',
        doc_number,
        doc_file: photo_url,
        issue_date: expense_date,
        accrual_month,
        vendor_name,
        main_category,
        sub_category,
        description,
        amount_ex_gst,
        gst,
        payment_status: 'Paid',
        payment_date: expense_date, // Paid = same day
        payment_method,
      },
      ctx.account_id
    );

    // Update expense with fin_transaction_id
    if (finResult.id) {
      await supabase
        .from('sd_expenses')
        .update({ fin_transaction_id: finResult.id })
        .eq('id', expense_id);
    }

    return {
      success: true,
      data: {
        expense_id,
        store_id,
        expense_date,
        total_amount,
        finance_synced: !!finResult.id,
        is_update: isUpdate,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-13: sd_delete_expense — Delete (T1-T3)
// ═══════════════════════════════════════════════════════════════

async function sdDeleteExpense(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    const canDelete = await checkPermission(supabase, ctx.tier_id, 'delete_expenses');
    if (!canDelete) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'No delete permission' } };
    }

    if (!body.expense_id) {
      return { success: false, error: { code: 'VALIDATION', message: 'expense_id required' } };
    }

    // Get expense for finance cleanup
    const { data: expense } = await supabase
      .from('sd_expenses')
      .select('id, fin_transaction_id, doc_number')
      .eq('id', body.expense_id)
      .single();

    if (!expense) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } };
    }

    // Delete finance bridge record
    if (expense.fin_transaction_id) {
      await supabase.from('sd_finance_bridge').delete().eq('id', expense.fin_transaction_id);
    }

    // Delete expense
    const { error } = await supabase.from('sd_expenses').delete().eq('id', body.expense_id);
    if (error) throw error;

    return { success: true, data: { deleted: true, expense_id: body.expense_id } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-14: sd_get_invoices — List invoices for store
// ═══════════════════════════════════════════════════════════════

async function sdGetInvoices(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    let query = supabase
      .from('sd_invoices')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false });

    // Optional filters
    if (body.payment_status) query = query.eq('payment_status', body.payment_status);
    if (body.date_from) query = query.gte('invoice_date', body.date_from);
    if (body.date_to) query = query.lte('invoice_date', body.date_to);

    const limit = body.limit || 50;
    const offset = body.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    // Summary
    const invoices = data || [];
    const summary = {
      total: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
      paid_total: invoices.filter((i) => i.payment_status === 'paid')
        .reduce((sum, i) => sum + (i.total_amount || 0), 0),
      unpaid_total: invoices.filter((i) => i.payment_status === 'unpaid')
        .reduce((sum, i) => sum + (i.total_amount || 0), 0),
      count: invoices.length,
      unpaid_count: invoices.filter((i) => i.payment_status === 'unpaid').length,
    };

    return { success: true, data: { store_id, invoices, summary } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-15: sd_save_invoice — Save + Finance Bridge [Paid/Unpaid] ★
// ═══════════════════════════════════════════════════════════════
// เหมือน Expense แต่:
// - Doc Type = 'Invoice'
// - Payment Status เลือกได้ (paid / unpaid)
// - ถ้า unpaid → ต้องมี due_date
// - ถ้า paid → ต้องมี payment_date + payment_method

async function sdSaveInvoice(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    // Permission check
    const isUpdate = !!body.invoice_id;
    if (isUpdate) {
      const canEdit = await checkPermission(supabase, ctx.tier_id, 'edit_invoices');
      if (!canEdit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No edit permission' } };
    } else {
      const canCreate = await checkPermission(supabase, ctx.tier_id, 'create_invoices');
      if (!canCreate) return { success: false, error: { code: 'NO_PERMISSION', message: 'No create permission' } };
    }

    // === VALIDATION ===
    const invoice_no     = (body.invoice_no || '').trim();
    const vendor_name    = (body.vendor_name || '').trim();
    const main_category  = (body.main_category || '').trim();
    const sub_category   = (body.sub_category || '').trim();
    const description    = (body.description || '').trim();
    const amount_ex_gst  = parseFloat(body.amount_ex_gst) || 0;
    const gst            = parseFloat(body.gst) || 0;
    const payment_status = (body.payment_status || '').trim().toLowerCase();
    const payment_method = (body.payment_method || '').trim();
    const payment_date   = body.payment_date || null;
    const due_date       = body.due_date || null;
    const photo_url      = (body.photo_url || '').trim();
    const invoice_date   = body.invoice_date || new Date().toISOString().split('T')[0];

    if (!invoice_no)     return { success: false, error: { code: 'VALIDATION', message: 'Invoice No required' } };
    if (!vendor_name)    return { success: false, error: { code: 'VALIDATION', message: 'Vendor Name required' } };
    if (!main_category)  return { success: false, error: { code: 'VALIDATION', message: 'Main Category required' } };
    if (!sub_category)   return { success: false, error: { code: 'VALIDATION', message: 'Sub Category required' } };
    if (!description)    return { success: false, error: { code: 'VALIDATION', message: 'Description required' } };
    if (amount_ex_gst < 0) return { success: false, error: { code: 'VALIDATION', message: 'Amount must be ≥ 0' } };
    if (!['paid', 'unpaid'].includes(payment_status)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Payment Status must be paid or unpaid' } };
    }
    if (!photo_url)      return { success: false, error: { code: 'VALIDATION', message: 'Photo required' } };

    // Conditional validation
    if (payment_status === 'unpaid' && !due_date) {
      return { success: false, error: { code: 'VALIDATION', message: 'Due Date required when Unpaid' } };
    }
    if (payment_status === 'paid') {
      if (!payment_method || !['cash', 'card', 'transfer'].includes(payment_method)) {
        return { success: false, error: { code: 'VALIDATION', message: 'Payment Method required when Paid' } };
      }
    }

    // Validate category cascade
    const { data: catCheck } = await supabase
      .from('category_master')
      .select('id')
      .eq('transaction_type', 'Expense')
      .eq('main_category', main_category)
      .eq('sub_category', sub_category)
      .eq('is_active', true)
      .single();

    if (!catCheck) {
      return { success: false, error: { code: 'VALIDATION', message: `Invalid category: ${main_category} > ${sub_category}` } };
    }

    // Check duplicate invoice_no (for new inserts)
    if (!isUpdate) {
      const { data: dup } = await supabase
        .from('sd_invoices')
        .select('id')
        .eq('store_id', store_id)
        .eq('invoice_no', invoice_no)
        .limit(1);

      if (dup && dup.length > 0) {
        return { success: false, error: { code: 'DUPLICATE', message: `Invoice ${invoice_no} already exists` } };
      }
    }

    const total_amount = amount_ex_gst + gst;
    const accrual_month = invoice_date.substring(0, 7) + '-01';

    // === UPSERT invoice ===
    const invoiceRow = {
      store_id,
      invoice_date,
      invoice_no,
      vendor_name,
      main_category,
      sub_category,
      description,
      amount_ex_gst,
      gst,
      total_amount,
      payment_status,
      payment_method: payment_status === 'paid' ? payment_method : null,
      payment_date: payment_status === 'paid' ? (payment_date || invoice_date) : null,
      due_date: payment_status === 'unpaid' ? due_date : null,
      accrual_month,
      photo_url,
      updated_by: ctx.account_id,
      updated_at: new Date().toISOString(),
    };

    let invoice_id;

    if (isUpdate) {
      const { error } = await supabase
        .from('sd_invoices')
        .update(invoiceRow)
        .eq('id', body.invoice_id);
      if (error) throw error;
      invoice_id = body.invoice_id;
    } else {
      const { data: newInv, error } = await supabase
        .from('sd_invoices')
        .insert({ ...invoiceRow, created_by: ctx.account_id })
        .select('id')
        .single();
      if (error) throw error;
      invoice_id = newInv.id;
    }

    // === FINANCE BRIDGE: Expense record [Paid or Unpaid] ===
    const finStatus = payment_status === 'paid' ? 'Paid' : 'Unpaid';
    const finResult = await createFinanceExpenseRecord(
      supabase, store_id, invoice_id, {
        doc_type: 'Invoice',
        doc_number: invoice_no,
        doc_file: photo_url,
        issue_date: invoice_date,
        accrual_month,
        vendor_name,
        main_category,
        sub_category,
        description,
        amount_ex_gst,
        gst,
        payment_status: finStatus,
        payment_date: payment_status === 'paid' ? (payment_date || invoice_date) : null,
        payment_method: payment_status === 'paid' ? payment_method : null,
        due_date: payment_status === 'unpaid' ? due_date : null,
      },
      ctx.account_id
    );

    // Update invoice with fin_transaction_id
    if (finResult.id) {
      await supabase
        .from('sd_invoices')
        .update({ fin_transaction_id: finResult.id })
        .eq('id', invoice_id);
    }

    return {
      success: true,
      data: {
        invoice_id,
        store_id,
        invoice_no,
        total_amount,
        payment_status: finStatus,
        finance_synced: !!finResult.id,
        is_update: isUpdate,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-16: sd_update_invoice_payment — Change Unpaid → Paid
// ═══════════════════════════════════════════════════════════════

async function sdUpdateInvoicePayment(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    const canUpdate = await checkPermission(supabase, ctx.tier_id, 'update_invoice_payment');
    if (!canUpdate) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'No permission to update payment' } };
    }

    if (!body.invoice_id) return { success: false, error: { code: 'VALIDATION', message: 'invoice_id required' } };

    const payment_method = (body.payment_method || '').trim();
    const payment_date = body.payment_date || new Date().toISOString().split('T')[0];

    if (!payment_method || !['cash', 'card', 'transfer'].includes(payment_method)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Payment Method required (cash/card/transfer)' } };
    }

    // Update invoice
    const { data: updated, error } = await supabase
      .from('sd_invoices')
      .update({
        payment_status: 'paid',
        payment_method,
        payment_date,
        due_date: null,
        updated_by: ctx.account_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.invoice_id)
      .select('fin_transaction_id')
      .single();

    if (error) throw error;

    // Update finance bridge record too
    if (updated?.fin_transaction_id) {
      await supabase
        .from('sd_finance_bridge')
        .update({
          payment_status: 'Paid',
          payment_method,
          payment_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updated.fin_transaction_id);
    }

    return {
      success: true,
      data: { invoice_id: body.invoice_id, payment_status: 'paid', payment_date, payment_method },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-17: sd_delete_invoice — Delete (T1-T3)
// ═══════════════════════════════════════════════════════════════

async function sdDeleteInvoice(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    const canDelete = await checkPermission(supabase, ctx.tier_id, 'delete_invoices');
    if (!canDelete) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'No delete permission' } };
    }

    if (!body.invoice_id) return { success: false, error: { code: 'VALIDATION', message: 'invoice_id required' } };

    // Get invoice for finance cleanup
    const { data: invoice } = await supabase
      .from('sd_invoices')
      .select('id, fin_transaction_id, invoice_no')
      .eq('id', body.invoice_id)
      .single();

    if (!invoice) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } };
    }

    // Delete finance bridge record
    if (invoice.fin_transaction_id) {
      await supabase.from('sd_finance_bridge').delete().eq('id', invoice.fin_transaction_id);
    }

    // Delete invoice
    const { error } = await supabase.from('sd_invoices').delete().eq('id', body.invoice_id);
    if (error) throw error;

    return { success: true, data: { deleted: true, invoice_id: body.invoice_id } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// SHARED: Create Finance Expense/Invoice record in bridge table
// ═══════════════════════════════════════════════════════════════
// Used by both EP-12 (Expense) and EP-15 (Invoice)

async function createFinanceExpenseRecord(
  supabase,
  store_id,
  source_id,
  fields,
  created_by
) {
  // Get entity mapping
  const { data: entity } = await supabase
    .from('paying_entities')
    .select('entity_name')
    .eq('store_id', store_id)
    .single();

  // Get default bank account
  const { data: settings } = await supabase
    .from('sd_store_settings')
    .select('default_bank_account')
    .eq('store_id', store_id)
    .single();

  const finRecord = {
    source_module: 'sale_daily',
    source_id,
    doc_type: fields.doc_type,
    doc_number: fields.doc_number,
    doc_file: fields.doc_file,
    issue_date: fields.issue_date,
    accrual_month: fields.accrual_month,
    vendor_name: fields.vendor_name,
    transaction_type: 'Expense',
    main_category: fields.main_category,
    sub_category: fields.sub_category,
    description: fields.description,
    amount_ex_gst: fields.amount_ex_gst,
    gst: fields.gst,
    payment_status: fields.payment_status,
    payment_date: fields.payment_date || null,
    payment_method: fields.payment_method || null,
    paying_entity: entity?.entity_name || store_id,
    bank_account: settings?.default_bank_account || null,
    allocation_type: 'Self',
    notes: `Auto from Sale Daily ${fields.doc_type}`,
    created_by,
  };

  const { data: fin, error } = await supabase
    .from('sd_finance_bridge')
    .upsert(finRecord, { onConflict: 'doc_number' })
    .select('id')
    .single();

  return { id: fin?.id || null, error };
}


// ═══════════════════════════════════════════════════════════════
// EP-18: sd_get_cash — Get cash on hand data for date
// ═══════════════════════════════════════════════════════════════
// Auto-calculates: cash_sale (from S1) − cash_expend (from S2) = expected

async function sdGetCash(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;
    const cash_date = body.cash_date || new Date().toISOString().split('T')[0];

    // ① Auto: Cash Sale from S1 channels (channel_key containing 'cash')
    const { data: dailySale } = await supabase
      .from('sd_daily_sales')
      .select('id')
      .eq('store_id', store_id)
      .eq('sale_date', cash_date)
      .single();

    let cashSale = 0;
    if (dailySale) {
      const { data: cashChannels } = await supabase
        .from('sd_sale_channels')
        .select('amount, channel_key')
        .eq('daily_sale_id', dailySale.id);

      // Get channel config to find which channels are cash
      const { data: configs } = await supabase
        .from('sd_channel_config')
        .select('channel_key, dashboard_group')
        .eq('store_id', store_id)
        .eq('dashboard_group', 'cash_sale');

      const cashKeys = new Set((configs || []).map((c) => c.channel_key));
      cashSale = (cashChannels || [])
        .filter((ch) => cashKeys.has(ch.channel_key))
        .reduce((sum, ch) => sum + (ch.amount || 0), 0);
    }

    // ② Auto: Cash Expend from S2 (payment_method = 'cash')
    const { data: cashExpenses } = await supabase
      .from('sd_expenses')
      .select('total_amount')
      .eq('store_id', store_id)
      .eq('expense_date', cash_date)
      .eq('payment_method', 'cash');

    const cashExpend = (cashExpenses || []).reduce((sum, e) => sum + (e.total_amount || 0), 0);

    // ③ Expected = cash_sale − cash_expend
    const expectedCash = cashSale - cashExpend;

    // Get existing cash record
    const { data: existing } = await supabase
      .from('sd_cash_on_hand')
      .select('*')
      .eq('store_id', store_id)
      .eq('cash_date', cash_date)
      .single();

    // Get tolerance setting
    const { data: settings } = await supabase
      .from('sd_store_settings')
      .select('cash_mismatch_tolerance')
      .eq('store_id', store_id)
      .single();

    const tolerance = settings?.cash_mismatch_tolerance || 2.00;

    return {
      success: true,
      data: {
        store_id,
        cash_date,
        cash_sale: cashSale,
        cash_expend: cashExpend,
        expected_cash: expectedCash,
        tolerance,
        existing: existing || null,
        has_sale_data: !!dailySale,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-19: sd_submit_cash_count — Submit actual cash + validate
// ═══════════════════════════════════════════════════════════════

async function sdSubmitCashCount(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    const canSubmit = await checkPermission(supabase, ctx.tier_id, 'submit_cash_count');
    if (!canSubmit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No permission' } };

    const cash_date = body.cash_date;
    const actual_cash = parseFloat(body.actual_cash);
    const photo_url = (body.photo_url || '').trim();

    if (!cash_date) return { success: false, error: { code: 'VALIDATION', message: 'cash_date required' } };
    if (isNaN(actual_cash) || actual_cash < 0) return { success: false, error: { code: 'VALIDATION', message: 'actual_cash required' } };
    if (!photo_url) return { success: false, error: { code: 'VALIDATION', message: 'Photo required' } };

    // Get auto-calculated values
    const cashData = await sdGetCash(supabase, { token: body.token, store_id, cash_date });
    if (!cashData.success) return cashData;

    const { cash_sale, cash_expend, expected_cash, tolerance } = cashData.data;
    const difference = actual_cash - expected_cash;
    const is_matched = Math.abs(difference) <= tolerance;

    // If mismatch > tolerance, require reason
    if (!is_matched && !(body.mismatch_reason || '').trim()) {
      return { success: false, error: { code: 'VALIDATION', message: `เงินไม่ตรง (${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}) — กรุณาใส่เหตุผล` } };
    }

    // Upsert
    const row = {
      store_id,
      cash_date,
      cash_sale,
      cash_expend,
      expected_cash,
      actual_cash,
      difference,
      is_matched,
      mismatch_reason: is_matched ? null : (body.mismatch_reason || '').trim(),
      cashier_photo_url: photo_url,
      handover_status: 'with_cashier',
      cashier_confirmed_by: ctx.account_id,
      cashier_confirmed_at: new Date().toISOString(),
      updated_by: ctx.account_id,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('sd_cash_on_hand')
      .select('id')
      .eq('store_id', store_id)
      .eq('cash_date', cash_date)
      .single();

    let cash_id;
    if (existing) {
      const { error } = await supabase.from('sd_cash_on_hand').update(row).eq('id', existing.id);
      if (error) throw error;
      cash_id = existing.id;
    } else {
      const { data: newRow, error } = await supabase
        .from('sd_cash_on_hand')
        .insert({ ...row, created_by: ctx.account_id })
        .select('id')
        .single();
      if (error) throw error;
      cash_id = newRow.id;
    }

    return {
      success: true,
      data: {
        cash_id,
        cash_date,
        expected_cash,
        actual_cash,
        difference,
        is_matched,
        handover_status: 'with_cashier',
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-20: sd_confirm_handover — 3-tier chain
// ═══════════════════════════════════════════════════════════════
// with_cashier → manager_confirmed → owner_confirmed → deposited

async function sdConfirmHandover(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    if (!body.cash_id) return { success: false, error: { code: 'VALIDATION', message: 'cash_id required' } };

    const { data: cash, error: fetchErr } = await supabase
      .from('sd_cash_on_hand')
      .select('*')
      .eq('id', body.cash_id)
      .single();

    if (fetchErr || !cash) return { success: false, error: { code: 'NOT_FOUND', message: 'Cash record not found' } };

    const currentStatus = cash.handover_status;
    let nextStatus;
    let updateFields = {};

    if (currentStatus === 'with_cashier') {
      // Manager confirms
      const canConfirm = await checkPermission(supabase, ctx.tier_id, 'confirm_manager_handover');
      if (!canConfirm) return { success: false, error: { code: 'NO_PERMISSION', message: 'Need Manager (T1-T3) to confirm' } };

      nextStatus = 'manager_confirmed';
      updateFields = {
        handover_status: nextStatus,
        manager_confirmed_by: ctx.account_id,
        manager_confirmed_at: new Date().toISOString(),
      };

    } else if (currentStatus === 'manager_confirmed') {
      // Owner confirms
      const canConfirm = await checkPermission(supabase, ctx.tier_id, 'confirm_owner_handover');
      if (!canConfirm) return { success: false, error: { code: 'NO_PERMISSION', message: 'Need Owner (T1-T2) to confirm' } };

      nextStatus = 'owner_confirmed';
      updateFields = {
        handover_status: nextStatus,
        owner_confirmed_by: ctx.account_id,
        owner_confirmed_at: new Date().toISOString(),
      };

    } else if (currentStatus === 'owner_confirmed') {
      // Mark deposited
      const canConfirm = await checkPermission(supabase, ctx.tier_id, 'confirm_owner_handover');
      if (!canConfirm) return { success: false, error: { code: 'NO_PERMISSION', message: 'Need Owner (T1-T2)' } };

      nextStatus = 'deposited';
      updateFields = { handover_status: nextStatus };

    } else {
      return { success: false, error: { code: 'INVALID_STATE', message: `Cannot advance from: ${currentStatus}` } };
    }

    updateFields.updated_by = ctx.account_id;
    updateFields.updated_at = new Date().toISOString();

    const { error } = await supabase.from('sd_cash_on_hand').update(updateFields).eq('id', body.cash_id);
    if (error) throw error;

    return {
      success: true,
      data: {
        cash_id: body.cash_id,
        previous_status: currentStatus,
        new_status: nextStatus,
        confirmed_by: ctx.display_name,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-21: sd_get_sale_history — Monthly sale KPIs + daily breakdown
// ═══════════════════════════════════════════════════════════════

async function sdGetSaleHistory(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    // month format: YYYY-MM
    const month = body.month || new Date().toISOString().substring(0, 7);
    const monthStart = `${month}-01`;
    // Calculate last day of month
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Get all daily sales for the month
    const { data: sales } = await supabase
      .from('sd_daily_sales')
      .select(`
        id, sale_date, total_sales, fin_synced, is_locked,
        sd_sale_channels ( channel_key, amount )
      `)
      .eq('store_id', store_id)
      .gte('sale_date', monthStart)
      .lte('sale_date', monthEnd)
      .order('sale_date', { ascending: true });

    const records = sales || [];

    // KPIs
    const totalSales = records.reduce((s, r) => s + (r.total_sales || 0), 0);
    const daysRecorded = records.length;
    const dailyAvg = daysRecorded > 0 ? totalSales / daysRecorded : 0;

    // Channel breakdown (aggregate)
    const channelTotals = {};
    records.forEach((r) => {
      (r.sd_sale_channels || []).forEach((ch) => {
        channelTotals[ch.channel_key] = (channelTotals[ch.channel_key] || 0) + (ch.amount || 0);
      });
    });

    // Get channel labels
    const { data: configs } = await supabase
      .from('sd_channel_config')
      .select('channel_key, channel_label, dashboard_group')
      .eq('store_id', store_id)
      .eq('is_enabled', true)
      .order('sort_order');

    const channelBreakdown = (configs || []).map((c) => ({
      channel_key: c.channel_key,
      label: c.channel_label,
      group: c.dashboard_group,
      total: channelTotals[c.channel_key] || 0,
      pct: totalSales > 0 ? ((channelTotals[c.channel_key] || 0) / totalSales * 100).toFixed(1) : '0.0',
    }));

    // Dashboard groups
    const groupTotals = {};
    channelBreakdown.forEach((ch) => {
      groupTotals[ch.group] = (groupTotals[ch.group] || 0) + ch.total;
    });

    // Best / worst day
    let bestDay = null;
    let worstDay = null;
    if (records.length > 0) {
      bestDay = records.reduce((a, b) => a.total_sales > b.total_sales ? a : b);
      worstDay = records.reduce((a, b) => a.total_sales < b.total_sales ? a : b);
    }

    // Previous month comparison
    const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    const prevStart = `${prevMonth}-01`;
    const prevLastDay = new Date(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 0).getDate();
    const prevEnd = `${prevMonth}-${String(prevLastDay).padStart(2, '0')}`;

    const { data: prevSales } = await supabase
      .from('sd_daily_sales')
      .select('total_sales')
      .eq('store_id', store_id)
      .gte('sale_date', prevStart)
      .lte('sale_date', prevEnd);

    const prevTotal = (prevSales || []).reduce((s, r) => s + (r.total_sales || 0), 0);
    const momChange = prevTotal > 0 ? ((totalSales - prevTotal) / prevTotal * 100).toFixed(1) : null;

    return {
      success: true,
      data: {
        store_id,
        month,
        kpis: {
          total_sales: totalSales,
          days_recorded: daysRecorded,
          days_in_month: lastDay,
          daily_average: Math.round(dailyAvg),
          best_day: bestDay ? { date: bestDay.sale_date, amount: bestDay.total_sales } : null,
          worst_day: worstDay ? { date: worstDay.sale_date, amount: worstDay.total_sales } : null,
          prev_month_total: prevTotal,
          mom_change: momChange,
        },
        daily_breakdown: records.map((r) => ({
          date: r.sale_date,
          total: r.total_sales,
          synced: r.fin_synced,
          locked: r.is_locked,
        })),
        channel_breakdown: channelBreakdown,
        group_totals: groupTotals,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-22: sd_get_expense_history — Expense history with filters
// ═══════════════════════════════════════════════════════════════

async function sdGetExpenseHistory(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    const store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    const month = body.month || new Date().toISOString().substring(0, 7);
    const monthStart = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Expenses for month
    let expQuery = supabase
      .from('sd_expenses')
      .select('*')
      .eq('store_id', store_id)
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd)
      .order('expense_date', { ascending: false });

    const { data: expenses } = await expQuery;

    // Invoices for month
    let invQuery = supabase
      .from('sd_invoices')
      .select('*')
      .eq('store_id', store_id)
      .gte('invoice_date', monthStart)
      .lte('invoice_date', monthEnd)
      .order('invoice_date', { ascending: false });

    const { data: invoices } = await invQuery;

    const allExpenses = expenses || [];
    const allInvoices = invoices || [];

    // KPIs
    const expTotal = allExpenses.reduce((s, e) => s + (e.total_amount || 0), 0);
    const invTotal = allInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);
    const unpaidTotal = allInvoices
      .filter((i) => i.payment_status === 'unpaid')
      .reduce((s, i) => s + (i.total_amount || 0), 0);

    // By vendor
    const byVendor = {};
    [...allExpenses, ...allInvoices].forEach((item) => {
      const v = item.vendor_name || 'Unknown';
      if (!byVendor[v]) byVendor[v] = { total: 0, count: 0 };
      byVendor[v].total += item.total_amount || 0;
      byVendor[v].count++;
    });

    // By category
    const byCategory = {};
    [...allExpenses, ...allInvoices].forEach((item) => {
      const cat = item.main_category || 'Unknown';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
      byCategory[cat].total += item.total_amount || 0;
      byCategory[cat].count++;
    });

    // Sort by total descending
    const vendorRanking = Object.entries(byVendor)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    const categoryRanking = Object.entries(byCategory)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    return {
      success: true,
      data: {
        store_id,
        month,
        kpis: {
          expense_total: expTotal,
          invoice_total: invTotal,
          combined_total: expTotal + invTotal,
          unpaid_total: unpaidTotal,
          expense_count: allExpenses.length,
          invoice_count: allInvoices.length,
        },
        expenses: allExpenses,
        invoices: allInvoices,
        by_vendor: vendorRanking.slice(0, 10),
        by_category: categoryRanking,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════
// SHARED: Admin guard + Audit logger
// ═══════════════════════════════════════

function isAdminTier(ctx) {
  return (ctx.tier_level || 99) <= 2;
}

async function logSdAudit(
  supabase,
  ctx,
  action,
  target_type,
  target_id,
  old_value,
  new_value
) {
  try {
    await supabase.from('sd_audit_log').insert({
      action,
      target_type,
      target_id,
      old_value: old_value ? JSON.stringify(old_value) : null,
      new_value: new_value ? JSON.stringify(new_value) : null,
      changed_by: ctx.account_id,
      changed_by_name: ctx.display_name,
      store_id: ctx.store_id,
    });
  } catch (e) { console.error('Audit log failed:', e); }
}


// ═══════════════════════════════════════════════════════════════
// EP-23: sd_admin_get_channels — All channels (inc. disabled)
// ═══════════════════════════════════════════════════════════════

async function sdAdminGetChannels(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    const store_id = body.store_id || ctx.store_id;

    const { data, error } = await supabase
      .from('sd_channel_config')
      .select('*')
      .eq('store_id', store_id)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return { success: true, data: { store_id, channels: data || [] } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-24: sd_admin_update_channel — Toggle/edit channel
// ═══════════════════════════════════════════════════════════════

async function sdAdminUpdateChannel(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    const { channel_id } = body;
    if (!channel_id) return { success: false, error: { code: 'VALIDATION', message: 'channel_id required' } };

    // Get current
    const { data: current } = await supabase
      .from('sd_channel_config')
      .select('*')
      .eq('id', channel_id)
      .single();

    if (!current) return { success: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } };

    const updates = {};
    if (body.channel_label !== undefined) updates.channel_label = body.channel_label;
    if (body.finance_sub_category !== undefined) updates.finance_sub_category = body.finance_sub_category;
    if (body.dashboard_group !== undefined) updates.dashboard_group = body.dashboard_group;
    if (body.is_enabled !== undefined) updates.is_enabled = body.is_enabled;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    const { error } = await supabase
      .from('sd_channel_config')
      .update(updates)
      .eq('id', channel_id);

    if (error) throw error;

    await logSdAudit(supabase, ctx, 'update_channel', 'channel_config', channel_id, current, { ...current, ...updates });

    return { success: true, data: { channel_id, updates } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-25: sd_admin_get_suppliers — All suppliers
// ═══════════════════════════════════════════════════════════════

async function sdAdminGetSuppliers(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);

    // T1-T3 can manage suppliers
    const canManage = await checkPermission(supabase, ctx.tier_id, 'manage_suppliers');
    if (!canManage) return { success: false, error: { code: 'NO_PERMISSION', message: 'No permission' } };

    // Vendor Master (shared)
    const { data: vendors } = await supabase
      .from('vendor_master')
      .select('*')
      .order('vendor_name');

    // Store-specific suppliers
    const { data: suppliers } = await supabase
      .from('sd_suppliers')
      .select('*')
      .order('supplier_name');

    return {
      success: true,
      data: {
        vendors: vendors || [],
        suppliers: suppliers || [],
        vendor_count: (vendors || []).length,
        supplier_count: (suppliers || []).length,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-26b: sd_admin_update_supplier — Edit/deactivate vendor
// ═══════════════════════════════════════════════════════════════

async function sdAdminUpdateSupplier(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    const { vendor_id } = body;
    if (!vendor_id) return { success: false, error: { code: 'VALIDATION', message: 'vendor_id required' } };

    const { data: current } = await supabase
      .from('vendor_master')
      .select('*')
      .eq('id', vendor_id)
      .single();

    if (!current) return { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } };

    const updates = {};
    if (body.vendor_name !== undefined) updates.vendor_name = body.vendor_name;
    if (body.vendor_group !== undefined) updates.vendor_group = body.vendor_group;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { error } = await supabase
      .from('vendor_master')
      .update(updates)
      .eq('id', vendor_id);

    if (error) throw error;

    await logSdAudit(supabase, ctx, 'update_vendor', 'vendor_master', vendor_id, current, { ...current, ...updates });

    return { success: true, data: { vendor_id, updates } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-27: sd_admin_get_settings — Full store settings
// ═══════════════════════════════════════════════════════════════

async function sdAdminGetSettings(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    const store_id = body.store_id || ctx.store_id;

    const { data } = await supabase
      .from('sd_store_settings')
      .select('*')
      .eq('store_id', store_id)
      .single();

    return { success: true, data: data || { store_id, message: 'No settings — using defaults' } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-28: sd_admin_update_settings — Update store settings
// ═══════════════════════════════════════════════════════════════

async function sdAdminUpdateSettings(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    const store_id = body.store_id || ctx.store_id;

    const { data: current } = await supabase
      .from('sd_store_settings')
      .select('*')
      .eq('store_id', store_id)
      .single();

    const updates = {};
    if (body.cutoff_time !== undefined) updates.cutoff_time = body.cutoff_time;
    if (body.backdate_limit_days !== undefined) updates.backdate_limit_days = parseInt(body.backdate_limit_days);
    if (body.require_photos !== undefined) updates.require_photos = body.require_photos;
    if (body.cash_mismatch_tolerance !== undefined) updates.cash_mismatch_tolerance = parseFloat(body.cash_mismatch_tolerance);
    if (body.auto_finance_push !== undefined) updates.auto_finance_push = body.auto_finance_push;
    if (body.default_bank_account !== undefined) updates.default_bank_account = body.default_bank_account;

    if (current) {
      const { error } = await supabase
        .from('sd_store_settings')
        .update(updates)
        .eq('store_id', store_id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('sd_store_settings')
        .insert({ store_id, ...updates });
      if (error) throw error;
    }

    await logSdAudit(supabase, ctx, 'update_store_settings', 'store_settings', store_id, current, { ...current, ...updates });

    return { success: true, data: { store_id, updates } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-29: sd_admin_get_permissions — Full Function × Tier matrix
// ═══════════════════════════════════════════════════════════════

async function sdAdminGetPermissions(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    const { data: permissions } = await supabase
      .from('sd_function_permissions')
      .select('*')
      .order('function_group')
      .order('function_key');

    // Build matrix: { function_key: { info: {...}, tiers: { T1: true, T2: false, ... } } }
    const functions = {};
    const tiers = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    (permissions || []).forEach((p) => {
      if (!functions[p.function_key]) {
        functions[p.function_key] = {
          function_key: p.function_key,
          function_name: p.function_name,
          function_group: p.function_group,
          tiers: {},
        };
      }
      functions[p.function_key].tiers[p.tier_id] = p.is_allowed;
    });

    // Group by function_group
    const groups = {};
    Object.values(functions).forEach((fn) => {
      const g = fn.function_group || 'other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(fn);
    });

    return {
      success: true,
      data: {
        tiers,
        groups,
        total_functions: Object.keys(functions).length,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-30: sd_admin_update_permission — Toggle single permission
// ═══════════════════════════════════════════════════════════════

async function sdAdminUpdatePermission(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    const { function_key, tier_id, is_allowed } = body;
    if (!function_key || !tier_id) return { success: false, error: { code: 'VALIDATION', message: 'function_key + tier_id required' } };

    // Get current
    const { data: current } = await supabase
      .from('sd_function_permissions')
      .select('id, is_allowed')
      .eq('function_key', function_key)
      .eq('tier_id', tier_id)
      .single();

    if (!current) return { success: false, error: { code: 'NOT_FOUND', message: `Permission not found: ${function_key} × ${tier_id}` } };

    const newVal = !!is_allowed;
    const { error } = await supabase
      .from('sd_function_permissions')
      .update({ is_allowed: newVal, updated_by: ctx.account_id, updated_at: new Date().toISOString() })
      .eq('id', current.id);

    if (error) throw error;

    await logSdAudit(supabase, ctx, 'update_permission', 'function_permissions', `${function_key}:${tier_id}`,
      { is_allowed: current.is_allowed }, { is_allowed: newVal });

    return { success: true, data: { function_key, tier_id, is_allowed: newVal } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-31: sd_admin_get_audit_log — Audit trail
// ═══════════════════════════════════════════════════════════════

async function sdAdminGetAuditLog(supabase, body) {
  try {
    const ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    let query = supabase
      .from('sd_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(body.limit || 50);

    if (body.action) query = query.eq('action', body.action);
    if (body.target_type) query = query.eq('target_type', body.target_type);
    if (body.store_id) query = query.eq('store_id', body.store_id);

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: { logs: data || [] } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}
