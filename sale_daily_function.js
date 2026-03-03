// ═══════════════════════════════════════════════════════════════
// SPG Sale Daily Module — Supabase Edge Function
// sale_daily_function.js — Pure JavaScript (no TypeScript)
// Version: 2.0 | March 2026
//
// 32 actions across 4 sprints:
//   Sprint 1: Auth + Lookup + S1 Daily Sale + Finance Bridge
//   Sprint 2: S2 Expense + S3 Invoice
//   Sprint 3: S4 Cash + S5-S6 History
//   Sprint 4: S7 Admin (9 endpoints)
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    let body = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      body = { formData };
    } else {
      body = await req.json().catch(() => ({}));
    }

    let result;

    switch (action) {
      // Sprint 1
      case 'sd_validate_session':     result = await sdValidateSession(supabase, body); break;
      case 'sd_get_permissions':      result = await sdGetPermissions(supabase, body); break;
      case 'sd_get_channels':         result = await sdGetChannels(supabase, body); break;
      case 'sd_get_vendors':          result = await sdGetVendors(supabase, body); break;
      case 'sd_create_vendor':        result = await sdCreateVendor(supabase, body); break;
      case 'sd_get_categories':       result = await sdGetCategories(supabase, body); break;
      case 'sd_get_store_settings':   result = await sdGetStoreSettings(supabase, body); break;
      case 'sd_get_daily_sale':       result = await sdGetDailySale(supabase, body); break;
      case 'sd_save_daily_sale':      result = await sdSaveDailySale(supabase, body); break;
      case 'sd_get_dashboard':        result = await sdGetDashboard(supabase, body); break;
      case 'sd_upload_photo':         result = await sdUploadPhoto(supabase, body); break;
      // Sprint 2
      case 'sd_get_expenses':         result = await sdGetExpenses(supabase, body); break;
      case 'sd_save_expense':         result = await sdSaveExpense(supabase, body); break;
      case 'sd_delete_expense':       result = await sdDeleteExpense(supabase, body); break;
      case 'sd_get_invoices':         result = await sdGetInvoices(supabase, body); break;
      case 'sd_save_invoice':         result = await sdSaveInvoice(supabase, body); break;
      case 'sd_update_invoice_payment': result = await sdUpdateInvoicePayment(supabase, body); break;
      case 'sd_delete_invoice':       result = await sdDeleteInvoice(supabase, body); break;
      // Sprint 3
      case 'sd_get_cash':             result = await sdGetCash(supabase, body); break;
      case 'sd_submit_cash_count':    result = await sdSubmitCashCount(supabase, body); break;
      case 'sd_confirm_handover':     result = await sdConfirmHandover(supabase, body); break;
      case 'sd_get_sale_history':     result = await sdGetSaleHistory(supabase, body); break;
      case 'sd_get_expense_history':  result = await sdGetExpenseHistory(supabase, body); break;
      // Sprint 4
      case 'sd_admin_get_channels':       result = await sdAdminGetChannels(supabase, body); break;
      case 'sd_admin_update_channel':     result = await sdAdminUpdateChannel(supabase, body); break;
      case 'sd_admin_get_suppliers':      result = await sdAdminGetSuppliers(supabase, body); break;
      case 'sd_admin_update_supplier':    result = await sdAdminUpdateSupplier(supabase, body); break;
      case 'sd_admin_get_settings':       result = await sdAdminGetSettings(supabase, body); break;
      case 'sd_admin_update_settings':    result = await sdAdminUpdateSettings(supabase, body); break;
      case 'sd_admin_get_permissions':    result = await sdAdminGetPermissions(supabase, body); break;
      case 'sd_admin_update_permission':  result = await sdAdminUpdatePermission(supabase, body); break;
      case 'sd_admin_get_audit_log':      result = await sdAdminGetAuditLog(supabase, body); break;
      default:
        result = { success: false, error: { code: 'INVALID_ACTION', message: 'Unknown action: ' + action } };
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
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function getSessionContext(supabase, token) {
  if (!token) throw { code: 'NO_TOKEN', message: 'Token required' };

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

  var acc = session.accounts;
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

async function checkPermission(supabase, tier_id, function_key) {
  var { data } = await supabase
    .from('sd_function_permissions')
    .select('is_allowed')
    .eq('tier_id', tier_id)
    .eq('function_key', function_key)
    .single();
  return data && data.is_allowed === true;
}

function getStoreFilter(ctx, requested_store_id) {
  if (ctx.store_id === 'HQ' || ctx.tier_level <= 2) {
    return requested_store_id || null;
  }
  return ctx.store_id;
}

function isAdminTier(ctx) {
  return (ctx.tier_level || 99) <= 2;
}

async function logSdAudit(supabase, ctx, action, target_type, target_id, old_value, new_value) {
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
// EP-01: sd_validate_session
// ═══════════════════════════════════════════════════════════════

async function sdValidateSession(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    var { data: moduleAccess } = await supabase
      .from('module_permissions')
      .select('access_level')
      .eq('module_id', 'sale_daily')
      .eq('tier_id', ctx.tier_id)
      .single();

    if (!moduleAccess || moduleAccess.access_level === 'none') {
      return { success: false, error: { code: 'NO_ACCESS', message: 'No access to Sale Daily module' } };
    }

    var { data: perms } = await supabase
      .from('sd_function_permissions')
      .select('function_key, is_allowed')
      .eq('tier_id', ctx.tier_id);

    var permissions = {};
    (perms || []).forEach(function(p) { permissions[p.function_key] = p.is_allowed; });

    var { data: store } = await supabase
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
        store_name: store ? store.store_name : ctx.store_id,
        brand_name: store ? store.brand_name : '',
        access_level: moduleAccess.access_level,
        permissions: permissions,
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
    var ctx = await getSessionContext(supabase, body.token);

    var { data, error } = await supabase
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
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var { data, error } = await supabase
      .from('sd_channel_config')
      .select('*')
      .eq('store_id', store_id)
      .eq('is_enabled', true)
      .order('sort_order');

    if (error) throw error;

    return { success: true, data: { store_id: store_id, channels: data } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-04: sd_get_vendors
// ═══════════════════════════════════════════════════════════════

async function sdGetVendors(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var { data, error } = await supabase
      .from('vendor_master')
      .select('id, vendor_name, vendor_type, vendor_group, default_payment_method')
      .eq('is_active', true)
      .order('vendor_name');

    if (error) throw error;

    var { data: suppliers } = await supabase
      .from('sd_suppliers')
      .select('id, supplier_name, payment_methods, is_special_track')
      .or('store_id.eq.ALL,store_id.eq.' + store_id)
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
// EP-05: sd_create_vendor
// ═══════════════════════════════════════════════════════════════

async function sdCreateVendor(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    if (ctx.tier_level > 5) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'T6-T7 cannot create vendors' } };
    }

    var vendor_name = (body.vendor_name || '').trim();
    if (!vendor_name) {
      return { success: false, error: { code: 'VALIDATION', message: 'Vendor name is required' } };
    }

    var { data: existing } = await supabase
      .from('vendor_master')
      .select('id, vendor_name')
      .ilike('vendor_name', vendor_name)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: { code: 'DUPLICATE', message: 'Vendor "' + existing[0].vendor_name + '" already exists' } };
    }

    var { data, error } = await supabase
      .from('vendor_master')
      .insert({
        vendor_name: vendor_name,
        vendor_group: body.vendor_group || null,
        vendor_type: body.vendor_type || null,
        is_active: true,
        created_by: ctx.account_id,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: { vendor: data, message: 'Vendor "' + vendor_name + '" created' } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-06: sd_get_categories
// ═══════════════════════════════════════════════════════════════

async function sdGetCategories(supabase, body) {
  try {
    await getSessionContext(supabase, body.token);

    var query = supabase
      .from('category_master')
      .select('transaction_type, main_category, sub_category, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    if (body.transaction_type) {
      query = query.eq('transaction_type', body.transaction_type);
    }

    var { data, error } = await query;
    if (error) throw error;

    var cascade = {};
    (data || []).forEach(function(row) {
      if (!cascade[row.transaction_type]) cascade[row.transaction_type] = {};
      if (!cascade[row.transaction_type][row.main_category]) cascade[row.transaction_type][row.main_category] = [];
      cascade[row.transaction_type][row.main_category].push(row.sub_category);
    });

    return { success: true, data: { categories: data, cascade: cascade } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-07: sd_get_store_settings
// ═══════════════════════════════════════════════════════════════

async function sdGetStoreSettings(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var { data, error } = await supabase
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
// EP-08: sd_get_daily_sale
// ═══════════════════════════════════════════════════════════════

async function sdGetDailySale(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;
    var sale_date = body.sale_date;

    if (!sale_date) {
      return { success: false, error: { code: 'VALIDATION', message: 'sale_date is required' } };
    }

    var { data: sale } = await supabase
      .from('sd_daily_sales')
      .select('*, sd_sale_channels ( id, channel_key, amount, fin_transaction_id )')
      .eq('store_id', store_id)
      .eq('sale_date', sale_date)
      .single();

    var { data: channels } = await supabase
      .from('sd_channel_config')
      .select('channel_key, channel_label, finance_sub_category, dashboard_group, sort_order')
      .eq('store_id', store_id)
      .eq('is_enabled', true)
      .order('sort_order');

    return {
      success: true,
      data: {
        store_id: store_id,
        sale_date: sale_date,
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

async function sdSaveDailySale(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    var canCreate = await checkPermission(supabase, ctx.tier_id, 'create_daily_sales');
    var canEdit = await checkPermission(supabase, ctx.tier_id, 'edit_daily_sales');

    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;
    var sale_date = body.sale_date;
    var channel_amounts = body.channels;
    var photo_card_url = body.photo_card_url;
    var photo_cash_url = body.photo_cash_url;

    if (!sale_date) return { success: false, error: { code: 'VALIDATION', message: 'sale_date required' } };
    if (!channel_amounts || typeof channel_amounts !== 'object') {
      return { success: false, error: { code: 'VALIDATION', message: 'channels required' } };
    }
    if (!photo_card_url || !photo_cash_url) {
      return { success: false, error: { code: 'VALIDATION', message: 'Both card photo and cash photo required' } };
    }

    var { data: existing } = await supabase
      .from('sd_daily_sales')
      .select('id, is_locked, fin_synced')
      .eq('store_id', store_id)
      .eq('sale_date', sale_date)
      .single();

    var isUpdate = !!existing;

    if (isUpdate) {
      if (!canEdit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No edit permission' } };
      if (existing.is_locked) {
        var canOverride = await checkPermission(supabase, ctx.tier_id, 'edit_locked_sales');
        if (!canOverride) return { success: false, error: { code: 'LOCKED', message: 'Record is locked. T1-T2 required to override.' } };
      }
    } else {
      if (!canCreate) return { success: false, error: { code: 'NO_PERMISSION', message: 'No create permission' } };
    }

    // Backdate check
    var today = new Date();
    var saleDay = new Date(sale_date);
    var diffDays = Math.floor((today.getTime() - saleDay.getTime()) / (1000 * 60 * 60 * 24));

    var { data: settings } = await supabase
      .from('sd_store_settings')
      .select('backdate_limit_days')
      .eq('store_id', store_id)
      .single();

    var backdateLimit = settings ? settings.backdate_limit_days : 2;
    if (diffDays > backdateLimit) {
      var canBackdate = await checkPermission(supabase, ctx.tier_id, 'edit_sales_backdate');
      if (!canBackdate) {
        return { success: false, error: { code: 'BACKDATE', message: 'Cannot edit beyond ' + backdateLimit + ' days. T1-T2 required.' } };
      }
    }

    var totalSales = Object.values(channel_amounts).reduce(function(sum, amt) { return sum + (parseFloat(amt) || 0); }, 0);

    // UPSERT daily_sales
    var daily_sale_id;

    if (isUpdate) {
      var { error } = await supabase
        .from('sd_daily_sales')
        .update({
          total_sales: totalSales,
          photo_card_url: photo_card_url,
          photo_cash_url: photo_cash_url,
          difference: body.difference || null,
          cancel_desc: body.cancel_desc || null,
          cancel_amount: body.cancel_amount || null,
          cancel_reason: body.cancel_reason || null,
          cancel_approved_by: body.cancel_approved_by || null,
          fin_synced: false,
          updated_by: ctx.account_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
      daily_sale_id = existing.id;

      await supabase
        .from('sd_sale_channels')
        .delete()
        .eq('daily_sale_id', daily_sale_id);

    } else {
      var { data: newSale, error: insErr } = await supabase
        .from('sd_daily_sales')
        .insert({
          store_id: store_id,
          sale_date: sale_date,
          total_sales: totalSales,
          photo_card_url: photo_card_url,
          photo_cash_url: photo_cash_url,
          difference: body.difference || null,
          cancel_desc: body.cancel_desc || null,
          cancel_amount: body.cancel_amount || null,
          fin_synced: false,
          is_locked: false,
          created_by: ctx.account_id,
        })
        .select('id')
        .single();

      if (insErr) throw insErr;
      daily_sale_id = newSale.id;
    }

    // INSERT channels
    var channelRows = Object.entries(channel_amounts)
      .filter(function(entry) { return parseFloat(entry[1]) >= 0; })
      .map(function(entry) {
        return {
          daily_sale_id: daily_sale_id,
          channel_key: entry[0],
          amount: parseFloat(entry[1]) || 0,
        };
      });

    if (channelRows.length > 0) {
      var { error: chErr } = await supabase.from('sd_sale_channels').insert(channelRows);
      if (chErr) throw chErr;
    }

    // FINANCE BRIDGE
    var financeResults = await createFinanceIncomeRecords(
      supabase, store_id, sale_date, daily_sale_id, channel_amounts, photo_card_url, ctx.account_id
    );

    await supabase
      .from('sd_daily_sales')
      .update({ fin_synced: true })
      .eq('id', daily_sale_id);

    return {
      success: true,
      data: {
        daily_sale_id: daily_sale_id,
        store_id: store_id,
        sale_date: sale_date,
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
// FINANCE BRIDGE: Create Income records from S1
// ═══════════════════════════════════════════════════════════════

async function createFinanceIncomeRecords(supabase, store_id, sale_date, daily_sale_id, channel_amounts, photo_url, created_by) {
  var { data: configs } = await supabase
    .from('sd_channel_config')
    .select('channel_key, channel_label, finance_sub_category')
    .eq('store_id', store_id)
    .eq('is_enabled', true);

  var configMap = {};
  (configs || []).forEach(function(c) { configMap[c.channel_key] = c; });

  var { data: entity } = await supabase
    .from('paying_entities')
    .select('entity_id, entity_name')
    .eq('store_id', store_id)
    .single();

  var { data: storeSettings } = await supabase
    .from('sd_store_settings')
    .select('default_bank_account')
    .eq('store_id', store_id)
    .single();

  var created = 0;
  var finRecordIds = {};

  var entries = Object.entries(channel_amounts);
  for (var i = 0; i < entries.length; i++) {
    var channelKey = entries[i][0];
    var amount = entries[i][1];
    var amt = parseFloat(String(amount)) || 0;
    if (amt <= 0) continue;

    var config = configMap[channelKey];
    if (!config) continue;

    var docNumber = 'SD-' + store_id + '-' + sale_date + '-' + channelKey;
    var description = 'Daily ' + config.channel_label + ' - ' + store_id + ' - ' + sale_date;
    var accrualMonth = sale_date.substring(0, 7) + '-01';

    // NOTE: total_amount is GENERATED in sd_finance_bridge — do NOT include
    var finRecord = {
      source_module: 'sale_daily',
      source_id: daily_sale_id,
      doc_type: 'None',
      doc_number: docNumber,
      doc_file: photo_url,
      issue_date: sale_date,
      accrual_month: accrualMonth,
      vendor_name: null,
      transaction_type: 'Income',
      main_category: 'Revenue',
      sub_category: config.finance_sub_category,
      description: description,
      amount_ex_gst: amt,
      gst: 0,
      payment_status: 'Pending',
      payment_date: null,
      paying_entity: entity ? entity.entity_name : store_id,
      bank_account: storeSettings ? storeSettings.default_bank_account : null,
      payment_method: null,
      allocation_type: 'Self',
      cost_owner_entity: null,
      allocation_amount: null,
      notes: 'Auto-generated from Sale Daily S1',
      created_by: created_by,
    };

    var { data: fin, error: finErr } = await supabase
      .from('sd_finance_bridge')
      .upsert(finRecord, { onConflict: 'doc_number' })
      .select('id')
      .single();

    if (!finErr && fin) {
      finRecordIds[channelKey] = fin.id;
      created++;

      await supabase
        .from('sd_sale_channels')
        .update({ fin_transaction_id: fin.id })
        .eq('daily_sale_id', daily_sale_id)
        .eq('channel_key', channelKey);
    }
  }

  return { created: created, records: finRecordIds };
}


// ═══════════════════════════════════════════════════════════════
// EP-10: sd_get_dashboard
// ═══════════════════════════════════════════════════════════════

async function sdGetDashboard(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var today = new Date().toISOString().split('T')[0];
    var monthStart = today.substring(0, 7) + '-01';

    var { data: todaySale } = await supabase
      .from('sd_daily_sales')
      .select('total_sales, fin_synced, is_locked')
      .eq('store_id', store_id)
      .eq('sale_date', today)
      .single();

    var { data: monthSales } = await supabase
      .from('sd_daily_sales')
      .select('sale_date, total_sales')
      .eq('store_id', store_id)
      .gte('sale_date', monthStart)
      .lte('sale_date', today)
      .order('sale_date', { ascending: false });

    var monthTotal = (monthSales || []).reduce(function(sum, s) { return sum + (s.total_sales || 0); }, 0);
    var daysRecorded = (monthSales || []).length;

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = yesterday.toISOString().split('T')[0];

    var { data: yesterdaySale } = await supabase
      .from('sd_daily_sales')
      .select('total_sales')
      .eq('store_id', store_id)
      .eq('sale_date', yesterdayStr)
      .single();

    var expectedDays = new Date().getDate();
    var missingDays = expectedDays - daysRecorded;

    var { data: cashAlerts } = await supabase
      .from('sd_cash_on_hand')
      .select('cash_date, difference, is_matched')
      .eq('store_id', store_id)
      .eq('is_matched', false)
      .gte('cash_date', monthStart)
      .order('cash_date', { ascending: false })
      .limit(5);

    var { count: unpaidCount } = await supabase
      .from('sd_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store_id)
      .eq('payment_status', 'unpaid');

    return {
      success: true,
      data: {
        store_id: store_id,
        today: {
          date: today,
          total_sales: todaySale ? todaySale.total_sales : 0,
          is_recorded: !!todaySale,
          fin_synced: todaySale ? todaySale.fin_synced : false,
        },
        yesterday: {
          date: yesterdayStr,
          total_sales: yesterdaySale ? yesterdaySale.total_sales : 0,
        },
        month: {
          total: monthTotal,
          days_recorded: daysRecorded,
          daily_average: daysRecorded > 0 ? Math.round(monthTotal / daysRecorded) : 0,
          daily_breakdown: (monthSales || []).slice(0, 7),
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
    var formData = body.formData;
    if (!formData) {
      return { success: false, error: { code: 'VALIDATION', message: 'No file uploaded' } };
    }

    var token = formData.get('token');
    var ctx = await getSessionContext(supabase, token);

    var file = formData.get('file');
    if (!file) {
      return { success: false, error: { code: 'VALIDATION', message: 'No file in form data' } };
    }

    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Only jpg, png, webp allowed' } };
    }

    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: { code: 'VALIDATION', message: 'File too large (max 5MB)' } };
    }

    var store_id = formData.get('store_id') || ctx.store_id;
    var category = formData.get('category') || 'sale';
    var ext = file.name.split('.').pop() || 'jpg';
    var timestamp = Date.now();
    var path = store_id + '/' + category + '/' + timestamp + '.' + ext;

    var { data, error } = await supabase.storage
      .from('sd-photos')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) throw error;

    var { data: urlData } = supabase.storage
      .from('sd-photos')
      .getPublicUrl(path);

    return {
      success: true,
      data: {
        path: path,
        url: urlData.publicUrl,
        size: file.size,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'UPLOAD_ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-11: sd_get_expenses
// ═══════════════════════════════════════════════════════════════

async function sdGetExpenses(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var query = supabase
      .from('sd_expenses')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false });

    if (body.expense_date) {
      query = query.eq('expense_date', body.expense_date);
    }
    if (body.date_from) query = query.gte('expense_date', body.date_from);
    if (body.date_to) query = query.lte('expense_date', body.date_to);

    var limit = body.limit || 50;
    var offset = body.offset || 0;
    query = query.range(offset, offset + limit - 1);

    var { data, error } = await query;
    if (error) throw error;

    var daySummary = null;
    if (body.expense_date) {
      var expenses = data || [];
      var totalCash = expenses.filter(function(e) { return e.payment_method === 'cash'; })
        .reduce(function(sum, e) { return sum + (e.total_amount || 0); }, 0);
      var totalCard = expenses.filter(function(e) { return e.payment_method === 'card'; })
        .reduce(function(sum, e) { return sum + (e.total_amount || 0); }, 0);
      daySummary = {
        total_expenses: expenses.reduce(function(sum, e) { return sum + (e.total_amount || 0); }, 0),
        total_cash: totalCash,
        total_card: totalCard,
        count: expenses.length,
      };
    }

    return {
      success: true,
      data: {
        store_id: store_id,
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

async function sdSaveExpense(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var isUpdate = !!body.expense_id;
    if (isUpdate) {
      var canEdit = await checkPermission(supabase, ctx.tier_id, 'edit_expense');
      if (!canEdit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No edit permission' } };
    } else {
      var canCreate = await checkPermission(supabase, ctx.tier_id, 'create_expense');
      if (!canCreate) return { success: false, error: { code: 'NO_PERMISSION', message: 'No create permission' } };
    }

    var doc_number = (body.doc_number || '').trim();
    var vendor_name = (body.vendor_name || '').trim();
    var main_category = (body.main_category || '').trim();
    var sub_category = (body.sub_category || '').trim();
    var description = (body.description || '').trim();
    var amount_ex_gst = parseFloat(body.amount_ex_gst) || 0;
    var gst = parseFloat(body.gst) || 0;
    var payment_method = (body.payment_method || '').trim();
    var photo_url = (body.photo_url || '').trim();
    var expense_date = body.expense_date || new Date().toISOString().split('T')[0];

    if (!doc_number) return { success: false, error: { code: 'VALIDATION', message: 'Doc Number required' } };
    if (!vendor_name) return { success: false, error: { code: 'VALIDATION', message: 'Vendor Name required' } };
    if (!main_category) return { success: false, error: { code: 'VALIDATION', message: 'Main Category required' } };
    if (!sub_category) return { success: false, error: { code: 'VALIDATION', message: 'Sub Category required' } };
    if (!description) return { success: false, error: { code: 'VALIDATION', message: 'Description required' } };
    if (amount_ex_gst < 0) return { success: false, error: { code: 'VALIDATION', message: 'Amount must be >= 0' } };
    if (gst < 0) return { success: false, error: { code: 'VALIDATION', message: 'GST must be >= 0' } };
    if (!payment_method || !['cash', 'card'].includes(payment_method)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Payment Method must be cash or card' } };
    }
    if (!photo_url) return { success: false, error: { code: 'VALIDATION', message: 'Photo required' } };

    var { data: catCheck } = await supabase
      .from('category_master')
      .select('id')
      .eq('transaction_type', 'Expense')
      .eq('main_category', main_category)
      .eq('sub_category', sub_category)
      .eq('is_active', true)
      .single();

    if (!catCheck) {
      return { success: false, error: { code: 'VALIDATION', message: 'Invalid category: ' + main_category + ' > ' + sub_category } };
    }

    var total_amount = amount_ex_gst + gst;
    var accrual_month = expense_date.substring(0, 7) + '-01';

    // NOTE: sd_expenses.total_amount is GENERATED — do NOT include in insert/update
    var expenseRow = {
      store_id: store_id,
      expense_date: expense_date,
      doc_number: doc_number,
      vendor_name: vendor_name,
      main_category: main_category,
      sub_category: sub_category,
      description: description,
      amount_ex_gst: amount_ex_gst,
      gst: gst,
      payment_method: payment_method,
      accrual_month: accrual_month,
      photo_url: photo_url,
      updated_by: ctx.account_id,
      updated_at: new Date().toISOString(),
    };

    var expense_id;

    if (isUpdate) {
      var { error } = await supabase.from('sd_expenses').update(expenseRow).eq('id', body.expense_id);
      if (error) throw error;
      expense_id = body.expense_id;
    } else {
      expenseRow.created_by = ctx.account_id;
      var { data: newExp, error: insErr } = await supabase.from('sd_expenses').insert(expenseRow).select('id').single();
      if (insErr) throw insErr;
      expense_id = newExp.id;
    }

    // FINANCE BRIDGE
    var finResult = await createFinanceExpenseRecord(
      supabase, store_id, expense_id,
      {
        doc_type: 'Bill',
        doc_number: doc_number,
        doc_file: photo_url,
        issue_date: expense_date,
        accrual_month: accrual_month,
        vendor_name: vendor_name,
        main_category: main_category,
        sub_category: sub_category,
        description: description,
        amount_ex_gst: amount_ex_gst,
        gst: gst,
        payment_status: 'Paid',
        payment_date: expense_date,
        payment_method: payment_method,
      },
      ctx.account_id
    );

    if (finResult.id) {
      await supabase.from('sd_expenses').update({ fin_transaction_id: finResult.id }).eq('id', expense_id);
    }

    return {
      success: true,
      data: {
        expense_id: expense_id,
        store_id: store_id,
        expense_date: expense_date,
        total_amount: total_amount,
        finance_synced: !!finResult.id,
        is_update: isUpdate,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-13: sd_delete_expense
// ═══════════════════════════════════════════════════════════════

async function sdDeleteExpense(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    var canDelete = await checkPermission(supabase, ctx.tier_id, 'delete_expense');
    if (!canDelete) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'No delete permission' } };
    }

    if (!body.expense_id) {
      return { success: false, error: { code: 'VALIDATION', message: 'expense_id required' } };
    }

    var { data: expense } = await supabase
      .from('sd_expenses')
      .select('id, fin_transaction_id, doc_number')
      .eq('id', body.expense_id)
      .single();

    if (!expense) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Expense not found' } };
    }

    if (expense.fin_transaction_id) {
      await supabase.from('sd_finance_bridge').delete().eq('id', expense.fin_transaction_id);
    }

    var { error } = await supabase.from('sd_expenses').delete().eq('id', body.expense_id);
    if (error) throw error;

    return { success: true, data: { deleted: true, expense_id: body.expense_id } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-14: sd_get_invoices
// ═══════════════════════════════════════════════════════════════

async function sdGetInvoices(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var query = supabase
      .from('sd_invoices')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false });

    if (body.payment_status) query = query.eq('payment_status', body.payment_status);
    if (body.date_from) query = query.gte('invoice_date', body.date_from);
    if (body.date_to) query = query.lte('invoice_date', body.date_to);

    var limit = body.limit || 50;
    var offset = body.offset || 0;
    query = query.range(offset, offset + limit - 1);

    var { data, error } = await query;
    if (error) throw error;

    var invoices = data || [];
    var summary = {
      total: invoices.reduce(function(sum, inv) { return sum + (inv.total_amount || 0); }, 0),
      paid_total: invoices.filter(function(inv) { return inv.payment_status === 'paid'; })
        .reduce(function(sum, inv) { return sum + (inv.total_amount || 0); }, 0),
      unpaid_total: invoices.filter(function(inv) { return inv.payment_status === 'unpaid'; })
        .reduce(function(sum, inv) { return sum + (inv.total_amount || 0); }, 0),
      count: invoices.length,
      unpaid_count: invoices.filter(function(inv) { return inv.payment_status === 'unpaid'; }).length,
    };

    return { success: true, data: { store_id: store_id, invoices: invoices, summary: summary } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-15: sd_save_invoice — Save + Finance Bridge ★
// ═══════════════════════════════════════════════════════════════

async function sdSaveInvoice(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var isUpdate = !!body.invoice_id;
    if (isUpdate) {
      var canEdit = await checkPermission(supabase, ctx.tier_id, 'edit_invoice');
      if (!canEdit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No edit permission' } };
    } else {
      var canCreate = await checkPermission(supabase, ctx.tier_id, 'create_invoice');
      if (!canCreate) return { success: false, error: { code: 'NO_PERMISSION', message: 'No create permission' } };
    }

    var invoice_no = (body.invoice_no || '').trim();
    var vendor_name = (body.vendor_name || '').trim();
    var main_category = (body.main_category || '').trim();
    var sub_category = (body.sub_category || '').trim();
    var description = (body.description || '').trim();
    var amount_ex_gst = parseFloat(body.amount_ex_gst) || 0;
    var gst = parseFloat(body.gst) || 0;
    var payment_status = (body.payment_status || '').trim().toLowerCase();
    var payment_method = (body.payment_method || '').trim();
    var payment_date = body.payment_date || null;
    var due_date = body.due_date || null;
    var photo_url = (body.photo_url || '').trim();
    var invoice_date = body.invoice_date || new Date().toISOString().split('T')[0];

    if (!invoice_no) return { success: false, error: { code: 'VALIDATION', message: 'Invoice No required' } };
    if (!vendor_name) return { success: false, error: { code: 'VALIDATION', message: 'Vendor Name required' } };
    if (!main_category) return { success: false, error: { code: 'VALIDATION', message: 'Main Category required' } };
    if (!sub_category) return { success: false, error: { code: 'VALIDATION', message: 'Sub Category required' } };
    if (!description) return { success: false, error: { code: 'VALIDATION', message: 'Description required' } };
    if (amount_ex_gst < 0) return { success: false, error: { code: 'VALIDATION', message: 'Amount must be >= 0' } };
    if (!['paid', 'unpaid'].includes(payment_status)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Payment Status must be paid or unpaid' } };
    }
    if (!photo_url) return { success: false, error: { code: 'VALIDATION', message: 'Photo required' } };

    if (payment_status === 'unpaid' && !due_date) {
      return { success: false, error: { code: 'VALIDATION', message: 'Due Date required when Unpaid' } };
    }
    if (payment_status === 'paid') {
      if (!payment_method || !['cash', 'card', 'transfer'].includes(payment_method)) {
        return { success: false, error: { code: 'VALIDATION', message: 'Payment Method required when Paid' } };
      }
    }

    var { data: catCheck } = await supabase
      .from('category_master')
      .select('id')
      .eq('transaction_type', 'Expense')
      .eq('main_category', main_category)
      .eq('sub_category', sub_category)
      .eq('is_active', true)
      .single();

    if (!catCheck) {
      return { success: false, error: { code: 'VALIDATION', message: 'Invalid category: ' + main_category + ' > ' + sub_category } };
    }

    if (!isUpdate) {
      var { data: dup } = await supabase
        .from('sd_invoices')
        .select('id')
        .eq('store_id', store_id)
        .eq('invoice_no', invoice_no)
        .limit(1);

      if (dup && dup.length > 0) {
        return { success: false, error: { code: 'DUPLICATE', message: 'Invoice ' + invoice_no + ' already exists' } };
      }
    }

    var total_amount = amount_ex_gst + gst;
    var accrual_month = invoice_date.substring(0, 7) + '-01';

    // NOTE: sd_invoices.total_amount is GENERATED — do NOT include
    var invoiceRow = {
      store_id: store_id,
      invoice_date: invoice_date,
      invoice_no: invoice_no,
      vendor_name: vendor_name,
      main_category: main_category,
      sub_category: sub_category,
      description: description,
      amount_ex_gst: amount_ex_gst,
      gst: gst,
      payment_status: payment_status,
      payment_method: payment_status === 'paid' ? payment_method : null,
      payment_date: payment_status === 'paid' ? (payment_date || invoice_date) : null,
      due_date: payment_status === 'unpaid' ? due_date : null,
      accrual_month: accrual_month,
      photo_url: photo_url,
      note: body.note || null,
      updated_by: ctx.account_id,
      updated_at: new Date().toISOString(),
    };

    var invoice_id;

    if (isUpdate) {
      var { error } = await supabase.from('sd_invoices').update(invoiceRow).eq('id', body.invoice_id);
      if (error) throw error;
      invoice_id = body.invoice_id;
    } else {
      invoiceRow.created_by = ctx.account_id;
      var { data: newInv, error: insErr } = await supabase.from('sd_invoices').insert(invoiceRow).select('id').single();
      if (insErr) throw insErr;
      invoice_id = newInv.id;
    }

    var finStatus = payment_status === 'paid' ? 'Paid' : 'Unpaid';
    var finResult = await createFinanceExpenseRecord(
      supabase, store_id, invoice_id,
      {
        doc_type: 'Invoice',
        doc_number: invoice_no,
        doc_file: photo_url,
        issue_date: invoice_date,
        accrual_month: accrual_month,
        vendor_name: vendor_name,
        main_category: main_category,
        sub_category: sub_category,
        description: description,
        amount_ex_gst: amount_ex_gst,
        gst: gst,
        payment_status: finStatus,
        payment_date: payment_status === 'paid' ? (payment_date || invoice_date) : null,
        payment_method: payment_status === 'paid' ? payment_method : null,
        due_date: payment_status === 'unpaid' ? due_date : null,
      },
      ctx.account_id
    );

    if (finResult.id) {
      await supabase.from('sd_invoices').update({ fin_transaction_id: finResult.id }).eq('id', invoice_id);
    }

    return {
      success: true,
      data: {
        invoice_id: invoice_id,
        store_id: store_id,
        invoice_no: invoice_no,
        total_amount: total_amount,
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
// SHARED: Create Finance Expense/Invoice record
// ═══════════════════════════════════════════════════════════════

async function createFinanceExpenseRecord(supabase, store_id, source_id, fields, created_by) {
  var { data: entity } = await supabase
    .from('paying_entities')
    .select('entity_name')
    .eq('store_id', store_id)
    .single();

  var { data: storeSettings } = await supabase
    .from('sd_store_settings')
    .select('default_bank_account')
    .eq('store_id', store_id)
    .single();

  // NOTE: total_amount is GENERATED — do NOT include
  var finRecord = {
    source_module: 'sale_daily',
    source_id: source_id,
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
    paying_entity: entity ? entity.entity_name : store_id,
    bank_account: storeSettings ? storeSettings.default_bank_account : null,
    allocation_type: 'Self',
    notes: 'Auto from Sale Daily ' + fields.doc_type,
    created_by: created_by,
  };

  var { data: fin, error } = await supabase
    .from('sd_finance_bridge')
    .upsert(finRecord, { onConflict: 'doc_number' })
    .select('id')
    .single();

  return { id: fin ? fin.id : null, error: error };
}


// ═══════════════════════════════════════════════════════════════
// EP-16: sd_update_invoice_payment
// ═══════════════════════════════════════════════════════════════

async function sdUpdateInvoicePayment(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    var canUpdate = await checkPermission(supabase, ctx.tier_id, 'update_payment_status');
    if (!canUpdate) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'No permission to update payment' } };
    }

    if (!body.invoice_id) return { success: false, error: { code: 'VALIDATION', message: 'invoice_id required' } };

    var payment_method = (body.payment_method || '').trim();
    var payment_date = body.payment_date || new Date().toISOString().split('T')[0];

    if (!payment_method || !['cash', 'card', 'transfer'].includes(payment_method)) {
      return { success: false, error: { code: 'VALIDATION', message: 'Payment Method required (cash/card/transfer)' } };
    }

    var { data: updated, error } = await supabase
      .from('sd_invoices')
      .update({
        payment_status: 'paid',
        payment_method: payment_method,
        payment_date: payment_date,
        due_date: null,
        updated_by: ctx.account_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.invoice_id)
      .select('fin_transaction_id')
      .single();

    if (error) throw error;

    if (updated && updated.fin_transaction_id) {
      await supabase
        .from('sd_finance_bridge')
        .update({
          payment_status: 'Paid',
          payment_method: payment_method,
          payment_date: payment_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updated.fin_transaction_id);
    }

    return {
      success: true,
      data: { invoice_id: body.invoice_id, payment_status: 'paid', payment_date: payment_date, payment_method: payment_method },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-17: sd_delete_invoice
// ═══════════════════════════════════════════════════════════════

async function sdDeleteInvoice(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    var canDelete = await checkPermission(supabase, ctx.tier_id, 'delete_invoice');
    if (!canDelete) {
      return { success: false, error: { code: 'NO_PERMISSION', message: 'No delete permission' } };
    }

    if (!body.invoice_id) return { success: false, error: { code: 'VALIDATION', message: 'invoice_id required' } };

    var { data: invoice } = await supabase
      .from('sd_invoices')
      .select('id, fin_transaction_id, invoice_no')
      .eq('id', body.invoice_id)
      .single();

    if (!invoice) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } };
    }

    if (invoice.fin_transaction_id) {
      await supabase.from('sd_finance_bridge').delete().eq('id', invoice.fin_transaction_id);
    }

    var { error } = await supabase.from('sd_invoices').delete().eq('id', body.invoice_id);
    if (error) throw error;

    return { success: true, data: { deleted: true, invoice_id: body.invoice_id } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-18: sd_get_cash
// ═══════════════════════════════════════════════════════════════

async function sdGetCash(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;
    var cash_date = body.cash_date || new Date().toISOString().split('T')[0];

    var { data: dailySale } = await supabase
      .from('sd_daily_sales')
      .select('id')
      .eq('store_id', store_id)
      .eq('sale_date', cash_date)
      .single();

    var cashSale = 0;
    if (dailySale) {
      var { data: cashChannels } = await supabase
        .from('sd_sale_channels')
        .select('amount, channel_key')
        .eq('daily_sale_id', dailySale.id);

      var { data: cashConfigs } = await supabase
        .from('sd_channel_config')
        .select('channel_key, dashboard_group')
        .eq('store_id', store_id)
        .eq('dashboard_group', 'cash_sale');

      var cashKeys = new Set((cashConfigs || []).map(function(c) { return c.channel_key; }));
      cashSale = (cashChannels || [])
        .filter(function(ch) { return cashKeys.has(ch.channel_key); })
        .reduce(function(sum, ch) { return sum + (ch.amount || 0); }, 0);
    }

    var { data: cashExpenses } = await supabase
      .from('sd_expenses')
      .select('total_amount')
      .eq('store_id', store_id)
      .eq('expense_date', cash_date)
      .eq('payment_method', 'cash');

    var cashExpend = (cashExpenses || []).reduce(function(sum, e) { return sum + (e.total_amount || 0); }, 0);
    var expectedCash = cashSale - cashExpend;

    var { data: existingCash } = await supabase
      .from('sd_cash_on_hand')
      .select('*')
      .eq('store_id', store_id)
      .eq('cash_date', cash_date)
      .single();

    var { data: cashSettings } = await supabase
      .from('sd_store_settings')
      .select('cash_mismatch_tolerance')
      .eq('store_id', store_id)
      .single();

    var tolerance = cashSettings ? cashSettings.cash_mismatch_tolerance : 2.00;

    return {
      success: true,
      data: {
        store_id: store_id,
        cash_date: cash_date,
        cash_sale: cashSale,
        cash_expend: cashExpend,
        expected_cash: expectedCash,
        tolerance: tolerance,
        existing: existingCash || null,
        has_sale_data: !!dailySale,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-19: sd_submit_cash_count
// ═══════════════════════════════════════════════════════════════

async function sdSubmitCashCount(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var canSubmit = await checkPermission(supabase, ctx.tier_id, 'submit_cashier_count');
    if (!canSubmit) return { success: false, error: { code: 'NO_PERMISSION', message: 'No permission' } };

    var cash_date = body.cash_date;
    var actual_cash = parseFloat(body.actual_cash);
    var photo_url = (body.photo_url || '').trim();

    if (!cash_date) return { success: false, error: { code: 'VALIDATION', message: 'cash_date required' } };
    if (isNaN(actual_cash) || actual_cash < 0) return { success: false, error: { code: 'VALIDATION', message: 'actual_cash required' } };
    if (!photo_url) return { success: false, error: { code: 'VALIDATION', message: 'Photo required' } };

    var cashData = await sdGetCash(supabase, { token: body.token, store_id: store_id, cash_date: cash_date });
    if (!cashData.success) return cashData;

    var cash_sale = cashData.data.cash_sale;
    var cash_expend = cashData.data.cash_expend;
    var expected_cash = cashData.data.expected_cash;
    var tolerance = cashData.data.tolerance;
    var difference = actual_cash - expected_cash;
    var is_matched = Math.abs(difference) <= tolerance;

    if (!is_matched && !(body.mismatch_reason || '').trim()) {
      return { success: false, error: { code: 'VALIDATION', message: 'Cash mismatch (' + (difference >= 0 ? '+' : '') + '$' + difference.toFixed(2) + ') — reason required' } };
    }

    // NOTE: expected_cash and difference are GENERATED — do NOT include
    var row = {
      store_id: store_id,
      cash_date: cash_date,
      cash_sale: cash_sale,
      cash_expend: cash_expend,
      actual_cash: actual_cash,
      is_matched: is_matched,
      mismatch_reason: is_matched ? null : (body.mismatch_reason || '').trim(),
      cashier_photo_url: photo_url,
      handover_status: 'with_cashier',
      cashier_confirmed_by: ctx.account_id,
      cashier_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    var { data: existingRow } = await supabase
      .from('sd_cash_on_hand')
      .select('id')
      .eq('store_id', store_id)
      .eq('cash_date', cash_date)
      .single();

    var cash_id;
    if (existingRow) {
      var { error } = await supabase.from('sd_cash_on_hand').update(row).eq('id', existingRow.id);
      if (error) throw error;
      cash_id = existingRow.id;
    } else {
      row.created_by = ctx.account_id;
      var { data: newRow, error: insErr } = await supabase.from('sd_cash_on_hand').insert(row).select('id').single();
      if (insErr) throw insErr;
      cash_id = newRow.id;
    }

    return {
      success: true,
      data: {
        cash_id: cash_id,
        cash_date: cash_date,
        expected_cash: expected_cash,
        actual_cash: actual_cash,
        difference: difference,
        is_matched: is_matched,
        handover_status: 'with_cashier',
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-20: sd_confirm_handover — 3-tier chain
// SQL CHECK: 'with_cashier', 'manager', 'owner', 'deposited'
// ═══════════════════════════════════════════════════════════════

async function sdConfirmHandover(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    if (!body.cash_id) return { success: false, error: { code: 'VALIDATION', message: 'cash_id required' } };

    var { data: cash, error: fetchErr } = await supabase
      .from('sd_cash_on_hand')
      .select('*')
      .eq('id', body.cash_id)
      .single();

    if (fetchErr || !cash) return { success: false, error: { code: 'NOT_FOUND', message: 'Cash record not found' } };

    var currentStatus = cash.handover_status;
    var nextStatus;
    var updateFields = {};

    if (currentStatus === 'with_cashier') {
      var canConfirm = await checkPermission(supabase, ctx.tier_id, 'confirm_manager');
      if (!canConfirm) return { success: false, error: { code: 'NO_PERMISSION', message: 'Need Manager (T1-T3) to confirm' } };

      nextStatus = 'manager';
      updateFields = {
        handover_status: nextStatus,
        manager_confirmed_by: ctx.account_id,
        manager_confirmed_at: new Date().toISOString(),
      };

    } else if (currentStatus === 'manager') {
      var canConfirm2 = await checkPermission(supabase, ctx.tier_id, 'confirm_owner');
      if (!canConfirm2) return { success: false, error: { code: 'NO_PERMISSION', message: 'Need Owner (T1-T2) to confirm' } };

      nextStatus = 'owner';
      updateFields = {
        handover_status: nextStatus,
        owner_confirmed_by: ctx.account_id,
        owner_confirmed_at: new Date().toISOString(),
      };

    } else if (currentStatus === 'owner') {
      var canConfirm3 = await checkPermission(supabase, ctx.tier_id, 'confirm_owner');
      if (!canConfirm3) return { success: false, error: { code: 'NO_PERMISSION', message: 'Need Owner (T1-T2)' } };

      nextStatus = 'deposited';
      updateFields = { handover_status: nextStatus };

    } else {
      return { success: false, error: { code: 'INVALID_STATE', message: 'Cannot advance from: ' + currentStatus } };
    }

    updateFields.updated_at = new Date().toISOString();

    var { error } = await supabase.from('sd_cash_on_hand').update(updateFields).eq('id', body.cash_id);
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
// EP-21: sd_get_sale_history
// ═══════════════════════════════════════════════════════════════

async function sdGetSaleHistory(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var month = body.month || new Date().toISOString().substring(0, 7);
    var monthStart = month + '-01';
    var parts = month.split('-');
    var y = parseInt(parts[0]);
    var m = parseInt(parts[1]);
    var lastDay = new Date(y, m, 0).getDate();
    var monthEnd = month + '-' + String(lastDay).padStart(2, '0');

    var { data: sales } = await supabase
      .from('sd_daily_sales')
      .select('id, sale_date, total_sales, fin_synced, is_locked, sd_sale_channels ( channel_key, amount )')
      .eq('store_id', store_id)
      .gte('sale_date', monthStart)
      .lte('sale_date', monthEnd)
      .order('sale_date', { ascending: true });

    var records = sales || [];

    var totalSales = records.reduce(function(s, r) { return s + (r.total_sales || 0); }, 0);
    var daysRecorded = records.length;
    var dailyAvg = daysRecorded > 0 ? totalSales / daysRecorded : 0;

    var channelTotals = {};
    records.forEach(function(r) {
      (r.sd_sale_channels || []).forEach(function(ch) {
        channelTotals[ch.channel_key] = (channelTotals[ch.channel_key] || 0) + (ch.amount || 0);
      });
    });

    var { data: configs } = await supabase
      .from('sd_channel_config')
      .select('channel_key, channel_label, dashboard_group')
      .eq('store_id', store_id)
      .eq('is_enabled', true)
      .order('sort_order');

    var channelBreakdown = (configs || []).map(function(c) {
      return {
        channel_key: c.channel_key,
        label: c.channel_label,
        group: c.dashboard_group,
        total: channelTotals[c.channel_key] || 0,
        pct: totalSales > 0 ? ((channelTotals[c.channel_key] || 0) / totalSales * 100).toFixed(1) : '0.0',
      };
    });

    var groupTotals = {};
    channelBreakdown.forEach(function(ch) {
      groupTotals[ch.group] = (groupTotals[ch.group] || 0) + ch.total;
    });

    var bestDay = null;
    var worstDay = null;
    if (records.length > 0) {
      bestDay = records.reduce(function(a, b) { return a.total_sales > b.total_sales ? a : b; });
      worstDay = records.reduce(function(a, b) { return a.total_sales < b.total_sales ? a : b; });
    }

    var prevMonth = m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');
    var prevStart = prevMonth + '-01';
    var prevLastDay = new Date(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 0).getDate();
    var prevEnd = prevMonth + '-' + String(prevLastDay).padStart(2, '0');

    var { data: prevSales } = await supabase
      .from('sd_daily_sales')
      .select('total_sales')
      .eq('store_id', store_id)
      .gte('sale_date', prevStart)
      .lte('sale_date', prevEnd);

    var prevTotal = (prevSales || []).reduce(function(s, r) { return s + (r.total_sales || 0); }, 0);
    var momChange = prevTotal > 0 ? ((totalSales - prevTotal) / prevTotal * 100).toFixed(1) : null;

    return {
      success: true,
      data: {
        store_id: store_id,
        month: month,
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
        daily_breakdown: records.map(function(r) {
          return { date: r.sale_date, total: r.total_sales, synced: r.fin_synced, locked: r.is_locked };
        }),
        channel_breakdown: channelBreakdown,
        group_totals: groupTotals,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}


// ═══════════════════════════════════════════════════════════════
// EP-22: sd_get_expense_history
// ═══════════════════════════════════════════════════════════════

async function sdGetExpenseHistory(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    var store_id = getStoreFilter(ctx, body.store_id) || ctx.store_id;

    var month = body.month || new Date().toISOString().substring(0, 7);
    var monthStart = month + '-01';
    var parts = month.split('-');
    var y = parseInt(parts[0]);
    var m = parseInt(parts[1]);
    var lastDay = new Date(y, m, 0).getDate();
    var monthEnd = month + '-' + String(lastDay).padStart(2, '0');

    var { data: expenses } = await supabase
      .from('sd_expenses')
      .select('*')
      .eq('store_id', store_id)
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd)
      .order('expense_date', { ascending: false });

    var { data: invoices } = await supabase
      .from('sd_invoices')
      .select('*')
      .eq('store_id', store_id)
      .gte('invoice_date', monthStart)
      .lte('invoice_date', monthEnd)
      .order('invoice_date', { ascending: false });

    var allExpenses = expenses || [];
    var allInvoices = invoices || [];

    var expTotal = allExpenses.reduce(function(s, e) { return s + (e.total_amount || 0); }, 0);
    var invTotal = allInvoices.reduce(function(s, inv) { return s + (inv.total_amount || 0); }, 0);
    var unpaidTotal = allInvoices
      .filter(function(inv) { return inv.payment_status === 'unpaid'; })
      .reduce(function(s, inv) { return s + (inv.total_amount || 0); }, 0);

    var byVendor = {};
    var allItems = allExpenses.concat(allInvoices);
    allItems.forEach(function(item) {
      var v = item.vendor_name || 'Unknown';
      if (!byVendor[v]) byVendor[v] = { total: 0, count: 0 };
      byVendor[v].total += item.total_amount || 0;
      byVendor[v].count++;
    });

    var byCategory = {};
    allItems.forEach(function(item) {
      var cat = item.main_category || 'Unknown';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
      byCategory[cat].total += item.total_amount || 0;
      byCategory[cat].count++;
    });

    var vendorRanking = Object.entries(byVendor)
      .map(function(entry) { return { name: entry[0], total: entry[1].total, count: entry[1].count }; })
      .sort(function(a, b) { return b.total - a.total; });

    var categoryRanking = Object.entries(byCategory)
      .map(function(entry) { return { name: entry[0], total: entry[1].total, count: entry[1].count }; })
      .sort(function(a, b) { return b.total - a.total; });

    return {
      success: true,
      data: {
        store_id: store_id,
        month: month,
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


// ═══════════════════════════════════════════════════════════════
// ADMIN: EP-23 to EP-31
// ═══════════════════════════════════════════════════════════════

async function sdAdminGetChannels(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var store_id = body.store_id || ctx.store_id;

    var { data, error } = await supabase
      .from('sd_channel_config')
      .select('*')
      .eq('store_id', store_id)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return { success: true, data: { store_id: store_id, channels: data || [] } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}

async function sdAdminUpdateChannel(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var channel_id = body.channel_id;
    if (!channel_id) return { success: false, error: { code: 'VALIDATION', message: 'channel_id required' } };

    var { data: current } = await supabase
      .from('sd_channel_config')
      .select('*')
      .eq('id', channel_id)
      .single();

    if (!current) return { success: false, error: { code: 'NOT_FOUND', message: 'Channel not found' } };

    var updates = {};
    if (body.channel_label !== undefined) updates.channel_label = body.channel_label;
    if (body.finance_sub_category !== undefined) updates.finance_sub_category = body.finance_sub_category;
    if (body.dashboard_group !== undefined) updates.dashboard_group = body.dashboard_group;
    if (body.is_enabled !== undefined) updates.is_enabled = body.is_enabled;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    var { error } = await supabase.from('sd_channel_config').update(updates).eq('id', channel_id);
    if (error) throw error;

    await logSdAudit(supabase, ctx, 'update_channel', 'channel_config', channel_id, current, Object.assign({}, current, updates));

    return { success: true, data: { channel_id: channel_id, updates: updates } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}

async function sdAdminGetSuppliers(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);

    var canManage = await checkPermission(supabase, ctx.tier_id, 'manage_suppliers');
    if (!canManage) return { success: false, error: { code: 'NO_PERMISSION', message: 'No permission' } };

    var { data: vendors } = await supabase.from('vendor_master').select('*').order('vendor_name');

    var { data: suppliers } = await supabase.from('sd_suppliers').select('*').order('supplier_name');

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

async function sdAdminUpdateSupplier(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var vendor_id = body.vendor_id;
    if (!vendor_id) return { success: false, error: { code: 'VALIDATION', message: 'vendor_id required' } };

    var { data: current } = await supabase.from('vendor_master').select('*').eq('id', vendor_id).single();

    if (!current) return { success: false, error: { code: 'NOT_FOUND', message: 'Vendor not found' } };

    var updates = {};
    if (body.vendor_name !== undefined) updates.vendor_name = body.vendor_name;
    if (body.vendor_group !== undefined) updates.vendor_group = body.vendor_group;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    var { error } = await supabase.from('vendor_master').update(updates).eq('id', vendor_id);
    if (error) throw error;

    await logSdAudit(supabase, ctx, 'update_vendor', 'vendor_master', vendor_id, current, Object.assign({}, current, updates));

    return { success: true, data: { vendor_id: vendor_id, updates: updates } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}

async function sdAdminGetSettings(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var store_id = body.store_id || ctx.store_id;

    var { data } = await supabase.from('sd_store_settings').select('*').eq('store_id', store_id).single();

    return { success: true, data: data || { store_id: store_id, message: 'No settings — using defaults' } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}

async function sdAdminUpdateSettings(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var store_id = body.store_id || ctx.store_id;

    var { data: current } = await supabase.from('sd_store_settings').select('*').eq('store_id', store_id).single();

    var updates = {};
    if (body.cutoff_time !== undefined) updates.cutoff_time = body.cutoff_time;
    if (body.backdate_limit_days !== undefined) updates.backdate_limit_days = parseInt(body.backdate_limit_days);
    if (body.require_photos !== undefined) updates.require_photos = body.require_photos;
    if (body.cash_mismatch_tolerance !== undefined) updates.cash_mismatch_tolerance = parseFloat(body.cash_mismatch_tolerance);
    if (body.auto_finance_push !== undefined) updates.auto_finance_push = body.auto_finance_push;
    if (body.default_bank_account !== undefined) updates.default_bank_account = body.default_bank_account;

    if (current) {
      var { error } = await supabase.from('sd_store_settings').update(updates).eq('store_id', store_id);
      if (error) throw error;
    } else {
      updates.store_id = store_id;
      var { error: insErr } = await supabase.from('sd_store_settings').insert(updates);
      if (insErr) throw insErr;
    }

    await logSdAudit(supabase, ctx, 'update_store_settings', 'store_settings', store_id, current, Object.assign({}, current, updates));

    return { success: true, data: { store_id: store_id, updates: updates } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}

async function sdAdminGetPermissions(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var { data: permissions } = await supabase
      .from('sd_function_permissions')
      .select('*')
      .order('function_group')
      .order('function_key');

    var functions = {};
    var tiers = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    (permissions || []).forEach(function(p) {
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

    var groups = {};
    Object.values(functions).forEach(function(fn) {
      var g = fn.function_group || 'other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(fn);
    });

    return {
      success: true,
      data: {
        tiers: tiers,
        groups: groups,
        total_functions: Object.keys(functions).length,
      },
    };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}

async function sdAdminUpdatePermission(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var function_key = body.function_key;
    var tier_id = body.tier_id;
    var is_allowed = body.is_allowed;
    if (!function_key || !tier_id) return { success: false, error: { code: 'VALIDATION', message: 'function_key + tier_id required' } };

    var { data: current } = await supabase
      .from('sd_function_permissions')
      .select('id, is_allowed')
      .eq('function_key', function_key)
      .eq('tier_id', tier_id)
      .single();

    if (!current) return { success: false, error: { code: 'NOT_FOUND', message: 'Permission not found: ' + function_key + ' x ' + tier_id } };

    var newVal = !!is_allowed;
    var { error } = await supabase
      .from('sd_function_permissions')
      .update({ is_allowed: newVal, updated_by: ctx.account_id, updated_at: new Date().toISOString() })
      .eq('id', current.id);

    if (error) throw error;

    await logSdAudit(supabase, ctx, 'update_permission', 'function_permissions', function_key + ':' + tier_id,
      { is_allowed: current.is_allowed }, { is_allowed: newVal });

    return { success: true, data: { function_key: function_key, tier_id: tier_id, is_allowed: newVal } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}

async function sdAdminGetAuditLog(supabase, body) {
  try {
    var ctx = await getSessionContext(supabase, body.token);
    if (!isAdminTier(ctx)) return { success: false, error: { code: 'ADMIN_ONLY', message: 'T1-T2 only' } };

    var query = supabase
      .from('sd_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(body.limit || 50);

    if (body.action) query = query.eq('action', body.action);
    if (body.target_type) query = query.eq('target_type', body.target_type);
    if (body.store_id) query = query.eq('store_id', body.store_id);

    var { data, error } = await query;
    if (error) throw error;

    return { success: true, data: { logs: data || [] } };
  } catch (err) {
    return { success: false, error: { code: err.code || 'ERROR', message: err.message } };
  }
}
