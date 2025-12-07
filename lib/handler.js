import { insertWebhookEvent } from './db.js';
import { resolveXubioClientForGuest, xubioFetch, getPuntoDeVenta, getMoneda, getProvincia, getListaPrecio, getVendedor, getDepositos, getProductoVenta, getCentroDeCosto, getBanco, postFacturar, postListaPrecio } from './xubio.js';
import { buildXubioPayload } from './mapping.js';
import { bancoTierraDelFuego, centroDeCostoGenerico, depositoUniversal, listaDePrecioGenerica, monedaPesosArgentinos, provinciaTierraDelFuego, puntoVenta00003, vendedorGenerico } from '../constants/xubio.js';

const token = process.env.CB_API_KEY;
const BASE_URL = 'https://xubio.com:443/API/1.1';

/**
 * Fetch an accounting transaction from Cloudbeds Accounting API
 * using the transaction id delivered in the webhook payload.
 */
async function fetchAccountingTransaction(transactionId, propertyId) {
  if (!transactionId) return null;
  const accountingUrl = 'https://api.cloudbeds.com/accounting/v1.0/transactions';
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
  const tx = Array.isArray(json.transactions) && json.transactions.length ? json.transactions[0] : null;
  return tx;
}

/**
 * Fetch reservation using standard PMS endpoint (v1.3 getReservation)
 */
async function fetchReservationById(reservationId) {
  if (!reservationId) return null;
  const cbUrl = `https://hotels.cloudbeds.com/api/v1.3/getReservation?reservationID=${encodeURIComponent(reservationId)}`;
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

export async function fetchGuestByReservationId(reservationId) {
  try {
    const url = `https://api.cloudbeds.com/api/v1.3/getGuest?reservationID=${reservationId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-api-key': process.env.CB_API_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ Cloudbeds API error:', text);
      throw new Error(`Cloudbeds API request failed with status ${response.status}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('❌ Error fetching guest by reservation ID:', error);
    throw error;
  }
}

/**
 * Main webhook handler
 */
export async function handleWebhook(payload, headers) {
  const txId = payload?.transactionId;
  const propertyId = payload?.propertyId;

  // Fetch accounting transaction details from the Accounting API
  let txDetails = null;
  try {
    txDetails = await fetchAccountingTransaction(txId, propertyId);
    if (!txDetails) {
      console.log(`[handleWebhook] No transaction found for id=${txId}. Will exit gracefully.`);
      // you may want to retry later instead of exit; for now we stop processing
      return;
    }
  } catch (err) {
    console.error('[handleWebhook] error fetching accounting transaction:', err);
    throw err;
  }

  // If the transaction references a reservation, fetch the reservation details
  if (txDetails.sourceKind === 'RESERVATION' && txDetails.sourceIdentifier) {
    try {
      // 1. Fetch all required data first
      const reservation = await fetchReservationById(txDetails.sourceIdentifier);
      const { data: guest } = await fetchGuestByReservationId(txDetails.sourceIdentifier);
      const xubioClient = guest ? await resolveXubioClientForGuest(guest) : null;

      // 2. Get all Xubio configuration
      const xubioConfig = {
        puntoVenta: puntoVenta00003,
        deposito: depositoUniversal,
        moneda: monedaPesosArgentinos,
        provincia: provinciaTierraDelFuego,
        listaDePrecio: listaDePrecioGenerica,
        centroDeCosto: centroDeCostoGenerico,
        banco: bancoTierraDelFuego,
        vendedor: vendedorGenerico,
      };

      // 3. Prepare the data for mapping
      const mappingInput = {
        reservation: reservation.data,
        transaction: txDetails,
        guest: guest || {},
        client: xubioClient || {},
        config: xubioConfig
      };

      // 4. Call the mapping function
      const xubioPayload = buildXubioPayload(mappingInput);

      const res = await postFacturar(xubioPayload);
      console.log('✅ Xubio invoice created:', res);
      return { status: 'processed', note: 'reservation-linked' };
    } catch (err) {
      console.error('[handleWebhook] error fetching reservation:', err);
      throw err;
    }
  }

  // For transactions without a reservation, we'll just log and mark as processed
  console.log('[handleWebhook] No reservation linked to transaction, marking as processed', txId);
  return { status: 'processed', note: 'no-reservation-linked' };
}
