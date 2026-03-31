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
export async function insertWebhookEvent(event_type, payload, headers = {}) {
  if (!supabase) {
    console.log('[no-db] insertWebhookEvent', event_type, payload);
    return null;
  }

  try {
    // Check if webhook event for this transaction already exists
    const transactionId = payload?.transactionId;
    if (transactionId) {
      const { data: existingEvent, error: checkError } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('payload->>transactionId', transactionId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing webhook event:', checkError);
      }

      if (existingEvent) {
        console.log(`⚠️  Webhook event for transaction ${transactionId} already exists, skipping insertion`);
        return existingEvent;
      }
    }

    const { data, error } = await supabase
      .from('webhook_events')
      .insert([
        {
          event_type,
          payload,
          headers,
          processed: false,
        },
      ])
      .select()
      .single();

    if (error) {
      // If it's a unique constraint violation, fetch the existing record
      if (error.code === '23505' && transactionId) {
        console.log(`⚠️  Duplicate webhook event for transaction ${transactionId}, fetching existing`);
        const { data: existingData } = await supabase
          .from('webhook_events')
          .select('*')
          .eq('payload->>transactionId', transactionId)
          .single();
        return existingData;
      }
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error inserting webhook event:', err);
    return null;
  }
}

/**
 * Check if a transaction has been processed
 */
export async function isTransactionProcessed(transaction_id) {
  if (!supabase) {
    console.log('[no-db] isTransactionProcessed', transaction_id);
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('processed_transactions')
      .select('status')
      .eq('tx_id', transaction_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned, transaction not processed
        return false;
      }
      console.error('isTransactionProcessed error', error);
      return false;
    }

    return data?.status === 'processed';
  } catch (err) {
    console.error('isTransactionProcessed threw', err);
    return false;
  }
}

/**
 * Create a processed transaction record with pending status
 */
export async function createProcessedTransaction(webhook_event_id, tx_id) {
  if (!supabase) {
    console.log('[no-db] createProcessedTransaction', webhook_event_id, tx_id);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('processed_transactions')
      .insert([{
        webhook_event_id,
        tx_id,
        status: 'pending',
        error: null
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Duplicate key - transaction already exists
        console.log('Transaction already exists, treating as duplicate');
        const { data: existingData } = await supabase
          .from('processed_transactions')
          .select('*')
          .eq('tx_id', tx_id)
          .single();
        return existingData;
      }
      console.error('createProcessedTransaction error', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('createProcessedTransaction threw', err);
    throw err;
  }
}

/**
 * Update transaction status to processed
 */
export async function markTransactionProcessed(tx_id) {
  if (!supabase) {
    console.log('[no-db] markTransactionProcessed', tx_id);
    return;
  }

  try {
    const { error } = await supabase
      .from('processed_transactions')
      .update({ 
        status: 'processed',
        error: null,
        updated_at: new Date().toISOString() 
      })
      .eq('tx_id', tx_id);

    if (error) {
      console.error('markTransactionProcessed error', error);
      throw error;
    }
  } catch (err) {
    console.error('markTransactionProcessed threw', err);
    throw err;
  }
}

/**
 * Update transaction status to failed with error message
 */
export async function markTransactionFailed(tx_id, error) {
  if (!supabase) {
    console.log('[no-db] markTransactionFailed', tx_id, error);
    return;
  }

  try {
    const { error: updateError } = await supabase
      .from('processed_transactions')
      .update({ 
        status: 'failed',
        error: error?.message || String(error),
        updated_at: new Date().toISOString() 
      })
      .eq('tx_id', tx_id);

    if (updateError) {
      console.error('markTransactionFailed error', updateError);
      throw updateError;
    }
  } catch (err) {
    console.error('markTransactionFailed threw', err);
    throw err;
  }
}

