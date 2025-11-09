import { upsertTransaction, markTransactionSent } from './db.js';
import { getAccessToken, xubioFetch } from './xubio.js'; // keep if you use xubioFetch elsewhere
import { mapToXubioPayload } from './mapping.js';

/**
 * Fetch an accounting transaction from Cloudbeds Accounting API
 * using the transaction id delivered in the webhook payload.
 */
async function fetchAccountingTransaction(transactionId, propertyId) {
  if (!transactionId) return null;
  const accountingUrl = 'https://api.cloudbeds.com/accounting/v1.0/transactions';
  const token = process.env.CB_API_KEY; // Bearer token for Cloudbeds
  if (!token) throw new Error('Missing Cloudbeds API key in CB_API_KEY');

  const body = {
    limit: 1,
    filters: {
      operator: 'equals',
      field: 'id',
      value: transactionId
    }
  };

  const res = await fetch(accountingUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Property-ID': propertyId || '',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(`Accounting API error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  console.log({json})
  const tx = Array.isArray(json.transactions) && json.transactions.length ? json.transactions[0] : null;
  return tx;
}

/**
 * Fetch reservation using standard PMS endpoint (v1.3 getReservation)
 */
async function fetchReservationById(reservationId) {
  if (!reservationId) return null;
  const cbUrl = `https://hotels.cloudbeds.com/api/v1.3/getReservation?reservationID=${encodeURIComponent(reservationId)}`;
  const token = process.env.CB_API_KEY;
  if (!token) throw new Error('Missing Cloudbeds API key in CB_API_KEY');

  const res = await fetch(cbUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      // sometimes helpful; optional
      // 'X-Property-ID': propertyId || ''
    }
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(`getReservation error ${res.status}: ${txt}`);
  }

  return res.json();
}

/**
 * Main webhook handler
 */
export async function handleWebhook(payload, headers) {
  console.log({ payload });
  console.log({ headers });

  // Basic secret check (unchanged)
  if (process.env.WEBHOOK_SECRET && headers['x-cloudbeds-secret'] !== process.env.WEBHOOK_SECRET) {
    const e = new Error('invalid secret'); e.code = 401; throw e;
  }

  const txId = payload?.transactionId;
  const propertyId = payload?.propertyId;

  // Idempotency / upsert (no-db mode will just return true)
  const inserted = await upsertTransaction(txId || `noid-${Date.now()}`, payload);
  if (!inserted) {
    const e = new Error('duplicate'); e.code = 409; throw e;
  }

  // Fetch accounting transaction details from the Accounting API
  let txDetails = null;
  try {
    txDetails = await fetchAccountingTransaction(txId, propertyId);
    if (!txDetails) {
      console.log(`[handleWebhook] No transaction found for id=${txId}. Will exit gracefully.`);
      // you may want to retry later instead of exit; for now we stop processing
      await markTransactionSent(txId, { message: 'no-transaction-found' });
      return;
    }
    console.log('[handleWebhook] fetched accounting transaction:', txDetails);
  } catch (err) {
    console.error('[handleWebhook] error fetching accounting transaction:', err);
    // mark as failed for manual inspection (or rethrow to let Cloudbeds retry)
    await markTransactionSent(txId, { error: err.message });
    throw err;
  }

  // If the transaction references a reservation, fetch the reservation details
  if (txDetails.sourceKind === 'RESERVATION' && txDetails.sourceId) {
    try {
      const reservation = await fetchReservationById(txDetails.sourceId);
      console.log('[handleWebhook] found reservation for transaction:', reservation);
      // At this point you have both txDetails and reservation — you can map to Xubio payload:
      // const xubioPayload = mapToXubioPayload(reservation, txDetails);
      // const result = await createInvoice(xubioPayload); // createInvoice uses xubioFetch inside lib/xubio.js
      // await markTransactionSent(txId, result);

      // For now, just persist that we fetched both and return
      await markTransactionSent(txId, { txDetails, reservation, note: 'fetched-reservation' });
      return;
    } catch (err) {
      console.error('[handleWebhook] error fetching reservation:', err);
      await markTransactionSent(txId, { error: err.message });
      throw err;
    }
  }

  // If no reservation link, you can still map the transaction itself to an invoice or further lookup customerId
  // Example: if txDetails.customerId is present, you could fetch guest/customer via Guest endpoints
  if (txDetails.customerId) {
    console.log('[handleWebhook] transaction has customerId:', txDetails.customerId);
    // optional: fetch guest details and proceed...
  }

  // fallback: persist transaction details and finish
  // await markTransactionSent(txId, { txDetails, note: 'no-reservation-linked' });

    const res = await xubioFetch('https://xubio.com/API/1.1/clienteBean');
  const data = await res.json();
  console.log('✅ Xubio API test response:', data);
}
