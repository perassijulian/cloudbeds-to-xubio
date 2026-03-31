/**
 * Build a Xubio /facturar payload from Cloudbeds reservation + accounting transaction.
 *
 * - reservation: object returned by getReservation (your sample shape)
 * - tx: accounting transaction object (your sample shape)
 * - client: optional Xubio client object previously resolved (if available)
 *
 * The function provides sensible defaults for required fields so the payload is valid
 * even when some Cloudbeds fields are missing. Adjust defaults to match your Xubio setup.
 */
import { fetchCurrencyRate } from './cloudbeds.js';

  // Extract last numbers from document number (e.g., B-00003-00000151 -> 151)
  const extractDocumentNumbers = (doc) => {
    if (!doc) return '';
    const parts = doc.split('-');
    return Number(parts[parts.length - 1] || doc);
  };

  // Extract guest information from reservation and guest data
  const extractGuestInfo = (reservation, guest) => {
    return {
      name: reservation.guestName || 'Consumidor Final',
      email: reservation.guestEmail || guest.email || "-",
      taxId: guest.taxID || guest.companyTaxID || "-"
    };
  };

export async function buildXubioPayload({
  reservation = {},
  transaction = {},
  guest = {},
  client = {},
  config = {}
}) {
  // Use the data from the handler
  const { puntoVenta, moneda, provincia, listaDePrecio, deposito, centroDeCosto, banco, vendedor, cliente, producto, cuenta, numeroDocumento } = config;

  const cantComprobantesEmitidos = extractDocumentNumbers(numeroDocumento)

  // ---- helpers ----
  const today = () => new Date().toISOString().split('T')[0];
  const safeNum = (v) => (v == null ? 0 : Number(v));
  


  // Currency conversion helper
  const convertCurrency = async (amount) => {
    if (!amount) return amount;
    
    try {
      const rate = await fetchCurrencyRate();
      return rate ? amount / rate : amount;
    } catch (error) {
      console.error('Currency conversion failed:', error);
      return amount;
    }
  };

  const transaccionId = transaction?.id ?? null;

  const guestInfo = extractGuestInfo(reservation, guest);

  // Dates
  const fecha = today();
  const fechaVto = fecha;

  // External id & name/description
  const externalId = reservation.reservationID;
  const descripcion = `${guestInfo.name}. Estadia para reserva ${externalId}. CUIT: ${guestInfo.taxId}. El día ${fecha}`;

  // Money - Use transaction amount instead of reservation balance
  const transactionAmount = safeNum(transaction.amount);
  console.log(`💰 Transaction details for ${externalId}: Transaction Amount=${transactionAmount}`);
  
  // For payment transactions, the amount is negative (money received)
  // We need to invoice the absolute value
  const amountToInvoice = Math.abs(transactionAmount);
  
  console.log(`💰 Invoice calculation for reservation ${externalId}: Transaction Amount=${transactionAmount}, Amount to Invoice=${amountToInvoice}`);
  
  if (amountToInvoice <= 0) {
    console.log(`⚠️  No amount to invoice for reservation ${externalId} (transaction amount: ${transactionAmount})`);
    // Return a special payload indicating no amount to invoice
    return {
      fullyPaid: true,
      remainingBalance: 0,
      message: `No amount to invoice - transaction has no amount`
    };
  }
  
  const amountConverted = await convertCurrency(amountToInvoice);
  const amount = safeNum(amountConverted);

  // ---- Build product items: aggregate dailyRates per assigned room if present ----
  const assigned = Array.isArray(reservation.assigned) && reservation.assigned.length ? reservation.assigned[0] : null;

  let transaccionProductoItems = [];
  // if (assigned && Array.isArray(assigned.dailyRates) && assigned.dailyRates.length) {
  if (false) {
    // Option A: create one line per night
    transaccionProductoItems = assigned.dailyRates.map((d) => {
      const rate = safeNum(d.rate);
      const cantidad = 1;
      const importe = rate * cantidad;
      
      return {
        transaccionId,
        producto,
        centroDeCosto,
        deposito,
        descripcion,
        cantidad,
        precio: rate,
        precioconivaincluido: rate,
        iva: 0,
        importe,
        total: importe,
        montoExento: 0,
        porcentajeDescuento: 0
      };
    });
  } else {
    // Fallback: single aggregated line using the calculated amount to invoice
    const importe = amount * 1; // cantidad is 1
    transaccionProductoItems = [
      {
        transaccionId,
        producto,
        centroDeCosto,
        deposito,
        descripcion,
        cantidad: 1,
        precio: amount,
        precioconivaincluido: amount,
        iva: 0,
        importe,
        total: importe,
        montoExento: 0,
        porcentajeDescuento: 0
      }
    ];
  }

  // Calculate total amount from product items
  const totalProductos = transaccionProductoItems.reduce((sum, item) => sum + (item.importe || 0), 0);
  const totalAmount = totalProductos;

  // ---- Cobranza items (payments) ----
  const transaccionCobranzaItems = [
    {
      transaccionId: Number(transaccionId),
      itemId: 0,
      cuentaTipo: cuenta.codigo,
      cuentaId: cuenta.id,
      moneda,
      cotizacionMonTransaccion: 1,
      importeMonPrincipal: totalProductos,
      importeMonTransaccion: totalProductos,
      numeroCheque: "",
      fechaVto,
      banco,
      descripcion,
    }
  ];

  // ---- Provincia: try to use guest country/state or reservation origin (best-effort) ----
  // provincia FALLBACK
  // const provincia = reservation?.province || guestEntry?.guestState || { provincia_id: 0, codigo: '', nombre: '', pais: '' };

  // ---- Final payload following requested fields ----
  // Build base payload
  const payload = {
    externalId: reservation.reservationIdentifier || transaction.transactionId,
    cliente: cliente,
    tipo: 6, // 1 factura, 6 recibo
    nombre: guestInfo.name,
    fecha: today(),
    fechaVto: today(),
    puntoVenta,
    ...(puntoVenta.modoNumeracion !== 'automatico' && { numeroDocumento: cantComprobantesEmitidos }),
    condicionDePago: 2, // contado
    deposito,
    cantComprobantesEmitidos: puntoVenta.modoNumeracion === 'automatico' ? 0 : cantComprobantesEmitidos,
    cantComprobantesCancelados: 0,
    cotizacion: 1,
    moneda,
    provincia,
    cotizacionListaDePrecio: 0,
    listaDePrecio,
    vendedor,
    porcentajeComision: 0,
    mailEstado: guestInfo.email,
    descripcion: `${guestInfo.name}. Estadia para reserva ${externalId}. CUIT: ${guestInfo.taxId}. El día ${fecha}`,
    cbuinformada: false,
    facturaNoExportacion: true,
    transaccionProductoItems,
    transaccionCobranzaItems,
  };

  return payload;
}