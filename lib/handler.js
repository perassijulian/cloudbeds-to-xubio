import { resolveXubioClientForGuest, postFacturar } from './xubio.js';
import { handleApiError } from './utils/errorHandler.js';
import { buildXubioPayload } from './mapping.js';
import { bancoTierraDelFuego, centroDeCostoGenerico, clienteDelExterior, cuenta, depositoUniversal, listaDePrecioGenerica, monedaPesosArgentinos, productoAlojamiento, provinciaTierraDelFuego, puntoVenta00003, vendedorGenerico } from '../constants/xubio.js';

const token = process.env.CB_API_KEY;
const CLOUDBEDS_API_BASE = 'https://api.cloudbeds.com';
const GENERATE_INVOICE = process.env.GENERATE_INVOICE === 'true';

if (!token) {
  console.warn('Warning: CB_API_KEY environment variable is not set');
}

/**
 * Fetches an accounting transaction from Cloudbeds Accounting API
 * @param {string} transactionId - The transaction ID to fetch
 * @param {string} propertyId - The property ID (optional)
 * @returns {Promise<Object|null>} The transaction details or null if not found
 */
async function fetchAccountingTransaction(transactionId, propertyId) {
  const url = `${CLOUDBEDS_API_BASE}/accounting/v1.0/transactions`;
  
  if (!transactionId) {
    throw createApiError({
      message: 'Transaction ID is required',
      status: 400
    });
  }

  const body = {
    limit: 1,
    filters: {
      operator: 'equals',
      field: 'id',
      value: transactionId
    }
  };

  const res = await fetch(url, {
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
    return handleApiError(res, {
      resourceType: 'transaction',
      resourceId: transactionId
    });
  }

  const { transactions } = await res.json();
  return transactions?.[0] || null;
}

/**
 * Fetches reservation details from Cloudbeds API
 * @param {string} reservationId - The reservation ID
 * @returns {Promise<Object>} Reservation details
 */
async function fetchReservationById(reservationId) {
  if (!reservationId) {
    throw createApiError({
      message: 'Reservation ID is required',
      status: 400
    });
  }
  const url = `${CLOUDBEDS_API_BASE}/api/v1.3/getReservation?reservationID=${encodeURIComponent(reservationId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });

  if (!res.ok) {
    return handleApiError(res, {
      resourceType: 'reservation',
      resourceId: reservationId
    });
  }

  return res.json();
}

/**
 * Fetches guest information by reservation ID
 * @param {string} reservationId - The reservation ID
 * @returns {Promise<Object>} Guest information
 */
export async function fetchGuestByReservationId(reservationId) {
  if (!reservationId) {
    throw createApiError({
      message: 'Reservation ID is required',
      status: 400
    });
  }

  try {

    const url = `${CLOUDBEDS_API_BASE}/api/v1.3/getGuest?reservationID=${reservationId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-api-key': token,
      },
    });

    if (!response.ok) {
      return handleApiError(response, {
      resourceType: 'guest',
      resourceId: reservationId
    });
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('❌ Error fetching guest by reservation ID:', error);
    throw error;
  }
}

/**
 * Processes a reservation transaction and creates an invoice in Xubio
 * @param {Object} transaction - The transaction details
 * @param {string} propertyId - The property ID
 * @returns {Promise<Object>} Processing result
 */
async function processReservationTransaction(transaction, propertyId) {
  const reservationId = transaction.sourceIdentifier;
  console.log(`Processing reservation transaction: ${reservationId}`);

  try {
    const [reservation, guestResponse] = await Promise.all([
      fetchReservationById(reservationId),
      fetchGuestByReservationId(reservationId)
    ]);

    const {grandTotal, paid} = reservation.data?.balanceDetailed

    if (!grandTotal || !paid) {
      return { 
        status: 'skipped',
        note: 'missing-balance-information'
      };
    }

    if (Number(paid) !== Number(grandTotal)) {
      return { 
        status: 'skipped',
        note: 'payment-not-complete',
        paid: paid,
        grandTotal: grandTotal
      };
    }

    const guest = guestResponse?.data;
    const xubioClient = guest ? await resolveXubioClientForGuest(guest) : null;

    const xubioPayload = await buildXubioPayload({
      reservation: reservation.data,
      transaction,
      guest: guest || {},
      client: xubioClient || {},
      config: getXubioConfig()
    });

    console.log('Xubio payload:', JSON.stringify(xubioPayload, null, 2));

    if (!GENERATE_INVOICE) {
      console.log('Invoice generation is disabled, skipping Xubio integration');
      return { 
        status: 'skipped',
        note: 'invoice-generation-disabled'
      };
    }

    const result = await postFacturar(xubioPayload);
    console.log(`✅ Xubio invoice created for reservation ${reservationId}:`, result.id);
    
    return { 
      status: 'processed',
      note: 'invoice-created',
      invoiceId: result.id,
      reservationId
    };

  } catch (error) {
    console.error(`❌ Error processing reservation ${reservationId}:`, error);
    throw error;
  }
}

/**
 * Returns the Xubio configuration
 * @returns {Object} Xubio configuration
 */
function getXubioConfig() {
  return {
    puntoVenta: puntoVenta00003,
    deposito: depositoUniversal,
    moneda: monedaPesosArgentinos,
    provincia: provinciaTierraDelFuego,
    listaDePrecio: listaDePrecioGenerica,
    centroDeCosto: centroDeCostoGenerico,
    banco: bancoTierraDelFuego,
    vendedor: vendedorGenerico,
    producto: productoAlojamiento,
    cliente: clienteDelExterior,
    cuenta: cuenta,
  };
}

/**
 * Main webhook handler
 * @param {Object} payload - The webhook payload
 * @returns {Promise<Object>} Processing result
 */
export async function handleWebhook(payload) {
  try {
    if (!payload) {
      throw createApiError({
        message: 'Webhook payload is missing',
        status: 400
      });
    }

    const txId = payload?.transactionId;
    const propertyId = payload?.propertyId;

    if (!txId) {
      throw createApiError({
        message: 'Missing required field: transactionId',
        status: 400
      });
    }

    console.log(`Processing webhook for transaction ${txId}`, {
      eventType: payload.eventType,
      propertyId,
      timestamp: new Date().toISOString()
    });

    // Fetch and process the transaction
    const txDetails = await fetchAccountingTransaction(txId, propertyId);
    if (!txDetails) {
      console.log(`No transaction found for id=${txId}`);
      return { status: 'processed', note: 'transaction-not-found' };
    }

    // Process reservation transactions
    if (txDetails.sourceKind === 'RESERVATION' && txDetails.sourceIdentifier) {
      return await processReservationTransaction(txDetails, propertyId);
    }

    // For non-reservation transactions
    console.log(`No reservation linked to transaction ${txId}, marking as processed`);
    return { status: 'processed', note: 'no-reservation-linked' };

  } catch (err) {
    console.error('Error in handleWebhook:', err);
    throw err.statusCode ? err : createApiError({
      message: 'Failed to process webhook',
      status: 500,
      details: err.message
    });
  }
}
