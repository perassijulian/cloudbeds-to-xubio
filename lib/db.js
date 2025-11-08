import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function upsertTransaction(transaction_id, payload) {
  if (!transaction_id) return false;
  // Try insert; if conflict, treat as duplicate
  const q = `
    INSERT INTO cloudbeds_transactions (transaction_id, property_id, payload, status)
    VALUES ($1,$2,$3,'received')
    ON CONFLICT (transaction_id) DO NOTHING
    RETURNING transaction_id;
  `;
  const r = await pool.query(q, [transaction_id, payload.propertyId || null, payload]);
  return r.rowCount > 0;
}

export async function markTransactionSent(transaction_id, result) {
  await pool.query(
    `INSERT INTO cloudbeds_to_xubio (transaction_id, xubio_invoice_id, status, response)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (transaction_id) DO UPDATE SET xubio_invoice_id = $2, status=$3, response=$4, updated_at=now()`,
    [transaction_id, result?.id || null, 'sent', result || null]
  );
  await pool.query(`UPDATE cloudbeds_transactions SET status='sent', updated_at=now() WHERE transaction_id=$1`, [transaction_id]);
}