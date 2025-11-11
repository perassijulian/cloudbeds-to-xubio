// lib/db.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // use Service Role key for server-side writes

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('SUPABASE_URL or SUPABASE_KEY not set — DB operations will be skipped.');
}

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

/**
 * Insert raw webhook event for auditing and replay.
 * Returns the inserted row (or null if supabase not configured).
 */
export async function insertWebhookEvent(eventType, payload, headers = {}) {
  if (!supabase) {
    console.log('[no-db] insertWebhookEvent', eventType, payload);
    return null;
  }

  const { data, error } = await supabase
    .from('webhook_events')
    .insert([{
      event_type: eventType,
      payload,
      headers,
      processed: false
    }])
    .select()
    .single();

  if (error) {
    console.error('insertWebhookEvent error', error);
    throw error;
  }
  return data;
}

/**
 * Upsert a transaction row in cloudbeds_transactions.
 * Returns true if inserted or updated (or assumed true in no-db mode).
 */
export async function upsertTransaction(transaction_id, payload) {
  if (!transaction_id) return false;

  if (!supabase) {
    console.log('[no-db] upsertTransaction', transaction_id);
    return true;
  }

  // We will attempt to insert; if exists, do nothing (or you can use upsert)
  // Using upsert with onConflict to avoid duplicates
  const row = {
    transaction_id,
    property_id: payload?.propertyId ?? null,
    payload,
    status: 'received'
  };

  const { data, error } = await supabase
    .from('cloudbeds_transactions')
    .upsert([row], { onConflict: 'transaction_id' })
    .select()
    .single()
    .catch(e => ({ data: null, error: e }));

  if (error) {
    // If there's a constraint violation or other failure, log and rethrow
    console.error('upsertTransaction error', error);
    throw error;
  }

  // If upsert returned a row, return true
  return !!data;
}

/**
 * Mark transaction as sent to Xubio and store response.
 * Upserts into cloudbeds_to_xubio and updates cloudbeds_transactions.status
 */
export async function markTransactionSent(transaction_id, result) {
  if (!supabase) {
    console.log('[no-db] markTransactionSent', transaction_id, result);
    return;
  }

  // write to cloudbeds_to_xubio
  const toXubioRow = {
    transaction_id,
    xubio_invoice_id: result?.id ?? null,
    status: result ? 'sent' : 'failed',
    response: result ?? null
  };

  const { error: upsertErr } = await supabase
    .from('cloudbeds_to_xubio')
    .upsert([toXubioRow], { onConflict: 'transaction_id' });

  if (upsertErr) {
    console.error('markTransactionSent upsert error', upsertErr);
    // don't throw — try to continue to update transaction status
  }

  // update cloudbeds_transactions.status
  const { error: updateErr } = await supabase
    .from('cloudbeds_transactions')
    .update({ status: 'sent' })
    .eq('transaction_id', transaction_id);

  if (updateErr) {
    console.error('markTransactionSent update error', updateErr);
  }
}