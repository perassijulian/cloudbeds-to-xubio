import {
  resolveXubioClientForGuest,
  postFacturar,
  getLastFacturaNumber,
  postSolicitarCAE,
} from "./xubio.js";
import { handleApiError, createApiError } from "./utils/errorHandler.js";
import { buildXubioPayload } from "./mapping.js";
import {
  insertWebhookEvent,
  isTransactionProcessed,
  createProcessedTransaction,
  markTransactionCompleted,
  markTransactionFailed,
  isWebhookTransactionProcessed,
  claimTransactionForProcessing,
} from "./db.js";
import {
  bancoTierraDelFuego,
  centroDeCostoGenerico,
  clienteDelExterior,
  cuenta,
  depositoUniversal,
  listaDePrecioGenerica,
  monedaPesosArgentinos,
  productoAlojamiento,
  provinciaTierraDelFuego,
  puntoVenta00003,
  vendedorGenerico,
} from "../constants/xubio.js";

const token = process.env.CB_API_KEY;
const CLOUDBEDS_API_BASE = "https://api.cloudbeds.com";
// const GENERATE_INVOICE = process.env.GENERATE_INVOICE === "true";
const GENERATE_INVOICE = false;

console.log(`🔧 Invoice generation: ${GENERATE_INVOICE ? 'ENABLED' : 'DISABLED'} (GENERATE_INVOICE=${process.env.GENERATE_INVOICE})`);

if (!token) {
  console.warn("Warning: CB_API_KEY environment variable is not set");
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
      message: "Transaction ID is required",
      status: 400,
    });
  }

  const body = {
    limit: 1,
    filters: {
      operator: "equals",
      field: "id",
      value: transactionId,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Property-ID": propertyId || "",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return handleApiError(res, {
      resourceType: "transaction",
      resourceId: transactionId,
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
      message: "Reservation ID is required",
      status: 400,
    });
  }
  const url = `${CLOUDBEDS_API_BASE}/api/v1.3/getReservation?reservationID=${encodeURIComponent(reservationId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return handleApiError(res, {
      resourceType: "reservation",
      resourceId: reservationId,
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
      message: "Reservation ID is required",
      status: 400,
    });
  }

  try {
    const url = `${CLOUDBEDS_API_BASE}/api/v1.3/getGuest?reservationID=${reservationId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": token,
      },
    });

    if (!response.ok) {
      return handleApiError(response, {
        resourceType: "guest",
        resourceId: reservationId,
      });
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error("❌ Error fetching guest by reservation ID:", error);
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
  const txId = transaction.id;
  console.log(
    `🚀 Processing reservation transaction: ${reservationId} (tx: ${txId})`,
  );

  try {
    const [reservation, guestResponse] = await Promise.all([
      fetchReservationById(reservationId),
      fetchGuestByReservationId(reservationId),
    ]);

    const { grandTotal, paid } = reservation.data?.balanceDetailed;

    if (!grandTotal || !paid) {
      console.log(`❌ Skipping ${txId}: Missing balance information (grandTotal: ${grandTotal}, paid: ${paid})`);
      await markTransactionFailed(
        txId,
        new Error("Missing balance information"),
      );
      return {
        status: "skipped",
        note: "missing-balance-information",
      };
    }

    console.log(`💰 Payment status for ${txId}: paid=${paid}, grandTotal=${grandTotal}`);

    const guest = guestResponse?.data;
    const xubioClient = guest ? await resolveXubioClientForGuest(guest) : null;

    console.log(`👤 Guest info for ${txId}:`, JSON.stringify(guest, null, 2));

    const xubioPayload = await buildXubioPayload({
      reservation: reservation.data,
      transaction,
      guest: guest || {},
      client: xubioClient || {},
      config: await getXubioConfig(),
    });

    console.log(`📋 Xubio payload for ${txId}:`, JSON.stringify(xubioPayload, null, 2));

    if (!xubioPayload) {
      console.log(`⚠️  No invoice payload generated for reservation ${reservationId}`);
      await markTransactionCompleted(txId);
      return {
        status: "processed",
        note: xubioPayload?.message || "no-invoice-needed",
      };
    }

    // Check if reservation is fully paid
    if (xubioPayload.fullyPaid) {
      console.log(`✅ Reservation ${reservationId} is fully paid, marking transaction as completed`);
      await markTransactionCompleted(txId);
      return {
        status: "processed",
        note: "fully-paid-no-invoice",
        reservationId,
        remainingBalance: 0,
      };
    }

    if (!GENERATE_INVOICE) {
      console.log("Invoice generation is disabled, skipping Xubio integration");
      await markTransactionCompleted(txId);
      return {
        status: "skipped",
        note: "invoice-generation-disabled",
      };
    }

    console.log(`📈 About to create invoice for ${txId} with payload:`, JSON.stringify(xubioPayload, null, 2));
    
    // CRITICAL DEBUG: Track exact moment before invoice creation
    console.log(`🔥 INVOICE CREATION ATTEMPT - TX: ${txId} - TIME: ${new Date().toISOString()}`);
    console.log(`🔥 INVOICE CREATION ATTEMPT - TX: ${txId} - RESERVATION: ${reservationId}`);
    console.log(`🔥 INVOICE CREATION ATTEMPT - TX: ${txId} - AMOUNT: ${xubioPayload.importeTotal}`);
    
    const result = await postFacturar(xubioPayload);
    
    // CRITICAL DEBUG: Track successful invoice creation
    console.log(`🎉 INVOICE CREATED SUCCESSFULLY - TX: ${txId} - INVOICE: ${result.numeroDocumento}`);
    console.log(
      `✅ Xubio invoice created for reservation ${reservationId}:`,
      result.numeroDocumento,
    );

    // If we get here, the API call was successful (postFacturar throws on error)
    // Mark transaction as completed
    await markTransactionCompleted(txId);
    console.log(`✅ Transaction ${txId} marked as completed`);

    // WE NEED TO GENERATE A CAE AND LINK IT WITH THE INVOICE
    // TODO: Uncomment after verifying invoice data is correct
    /*
    const caeResult = await postSolicitarCAE({
      externalId: result.transaccionid?.toString() || txId,
      transaccionId: result.transaccionid || 0,
      CAE: "", // This will be generated by Xubio
      CAEFechaVto: "", // This will be generated by Xubio
      detalle: result.descripcion || `Invoice for reservation ${reservationId}`,
    });
    console.log(`✅ CAE generated for invoice ${result.numeroDocumento}:`, caeResult);
    */

    return {
      status: "processed",
      note: "invoice-created",
      invoiceId: result.id,
      reservationId,
    };
  } catch (error) {
    console.error(`❌ Error processing reservation ${reservationId}:`, error);
    await markTransactionFailed(txId, error);
    throw error;
  }
}

/**
 * Returns the Xubio configuration
 * @returns {Object} Xubio configuration
 */
async function getXubioConfig() {
  const lastFacturaNumber = await getLastFacturaNumber();
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
    numeroDocumento: lastFacturaNumber,
  };
}

/**
 * Main webhook handler
 * @param {Object} payload - The webhook payload
 * @returns {Promise<Object>} Processing result
 */
export async function handleWebhook(payload) {
  const startTime = Date.now();
  const txId = payload?.transactionId;
  
  console.log(`🚀 === WEBHOOK START === Transaction: ${txId}`, {
    eventType: payload?.eventType,
    propertyId: payload?.propertyId,
    timestamp: new Date().toISOString(),
  });

  try {
    if (!payload) {
      throw createApiError({
        message: "Webhook payload is missing",
        status: 400,
      });
    }

    const propertyId = payload?.propertyId;

    if (!txId) {
      throw createApiError({
        message: "Missing required field: transactionId",
        status: 400,
      });
    }

    // Insert webhook event for auditing
    const webhookEvent = await insertWebhookEvent(
      payload.eventType || "accounting/transaction",
      payload,
    );

    // ATOMIC CLAIM: Let database handle race conditions
    const claimResult = await claimTransactionForProcessing(txId);

    if (!claimResult.claimed) {
      const existing = claimResult.existing;
      console.log(`⚠️  Transaction ${txId} already claimed (status: ${existing?.processing_status}), skipping`);
      
      return {
        status: "skipped",
        note: `duplicate-transaction-${existing?.processing_status}`,
        transactionId: txId,
      };
    }

    console.log(`✅ Successfully claimed transaction ${txId} for processing`);

    // Fetch and process the transaction
    const txDetails = await fetchAccountingTransaction(txId, propertyId);
    if (!txDetails) {
      console.log(`⚠️  No transaction found for id=${txId} in Cloudbeds API`);
      await markTransactionFailed(txId, new Error("Transaction not found"));
      return { status: "processed", note: "transaction-not-found" };
    }

    // Process reservation transactions
    if (txDetails.sourceKind === "RESERVATION" && txDetails.sourceIdentifier) {
      return await processReservationTransaction(txDetails, propertyId);
    }

    // For non-reservation transactions
    console.log(
      `No reservation linked to transaction ${txId}, marking as processed`,
    );
    return { status: "processed", note: "no-reservation-linked" };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ === WEBHOOK ERROR === Transaction: ${txId} (${duration}ms)`, err);
    throw err.statusCode
      ? err
      : createApiError({
          message: "Failed to process webhook",
          status: 500,
          details: err.message,
        });
  } finally {
    const duration = Date.now() - startTime;
    console.log(`🏁 === WEBHOOK END === Transaction: ${txId} (${duration}ms)`);
  }
}
