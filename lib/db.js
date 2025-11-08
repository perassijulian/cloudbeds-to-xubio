// Safe no-db fallback for dev / temporary testing.
// If DATABASE_URL is set, it will use Postgres. Otherwise it will noop and log.

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL });
} else {
  console.warn('No DATABASE_URL set — running in no-db mode. Transactions will not be persisted.');
}

/**
 * Try to insert a transaction. Returns true if inserted (or assumed inserted in no-db mode).
 * In no-db mode we return true so the handler continues.
 */
export async function upsertTransaction(transaction_id, payload) {
  if (!transaction_id) return false;

  if (!pool) {
    // no-db mode: pretend insert succeeded
    console.log('[no-db] upsertTransaction', transaction_id);
    return true;
  }

  const q = `
    INSERT INTO cloudbeds_transactions (transaction_id, property_id, payload, status)
    VALUES ($1,$2,$3,'received')
    ON CONFLICT (transaction_id) DO NOTHING
    RETURNING transaction_id;
  `;
  const r = await pool.query(q, [transaction_id, payload.propertyId || null, payload]);
  return r.rowCount > 0;
}

/**
 * Record that we sent to Xubio. In no-db mode we just log.
 */
export async function markTransactionSent(transaction_id, result) {
  if (!pool) {
    console.log('[no-db] markTransactionSent', transaction_id, result);
    return;
  }

  await pool.query(
    `INSERT INTO cloudbeds_to_xubio (transaction_id, xubio_invoice_id, status, response)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (transaction_id) DO UPDATE SET xubio_invoice_id = $2, status=$3, response=$4, updated_at=now()`,
    [transaction_id, result?.id || null, 'sent', result || null]
  );

  await pool.query(
    `UPDATE cloudbeds_transactions SET status='sent', updated_at=now() WHERE transaction_id=$1`,
    [transaction_id]
  );
}