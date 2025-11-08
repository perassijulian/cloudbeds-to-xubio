import { upsertTransaction, markTransactionSent } from './db.js';
import { fetchTransactionDetailsIfNeeded } from './cloudbeds.js';
import { createInvoice } from './xubio.js';
import { mapToXubioPayload } from './mapping.js';

export async function handleWebhook(payload, headers) {
  console.log({ payload })
  console.log({ headers })

  // basic secret check
  if (process.env.WEBHOOK_SECRET && headers['x-cloudbeds-secret'] !== process.env.WEBHOOK_SECRET) {
    const e = new Error('invalid secret'); e.code = 401; throw e;
  }

  const txId = payload.transactionId;
  const inserted = await upsertTransaction(txId || `noid-${Date.now()}`, payload);
  if (!inserted) {
    const e = new Error('duplicate'); e.code = 409; throw e;
  }

  const txDetails = await fetchTransactionDetailsIfNeeded(txId);
  const xubioPayload = mapToXubioPayload(payload, txDetails);
  const result = await createInvoice(xubioPayload);

  await markTransactionSent(txId, result);
}