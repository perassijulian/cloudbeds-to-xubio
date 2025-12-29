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

export async function buildXubioPayload({
  reservation = {},
  transaction = {},
  guest = {},
  client = {},
  config = {}
}) {
  // Use the data from the handler
  const { puntoVenta, moneda, provincia, listaDePrecio, deposito, centroDeCosto, banco, vendedor, cliente, producto, cuenta } = config;

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

  const guestName = reservation.guestName || 'Consumidor Final';
  const guestEmail = reservation.guestEmail || guest.email || "-";
  const guestTaxId = guest.taxID || guest.companyTaxID || "-";

  // Dates
  const fecha = today();
  const fechaVto = fecha;

  // External id & name/description
  const externalId = reservation.reservationID;
  const descripcion = `Estadia para reserva ${externalId}. ${reservation.guestName} CUIT: ${guestTaxId}. El día ${fecha}`;

  // Money
  const { paid } = reservation.balanceDetailed;
  const amountConverted = await convertCurrency(paid);
  const amount = safeNum(amountConverted)

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
    // Fallback: single aggregated line using tx.amount or assigned.roomTotal
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
  return {
    externalId,
    cliente,
    tipo: 6,
    // tipo
    // 1 = Factura
    // 2 = Nota de Débito
    // 3 = Nota de Crédito
    // 4 = Informe Diario de Cierre Z
    // 6 = Recibo
    nombre: guestName,
    fecha,
    fechaVto,
    puntoVenta,
    numeroDocumento: guest.documentNumber || guestTaxId || '',
    condicionDePago: 2,
    // 1 = Cuenta Corriente
    // 2 = Al Contado
    deposito,
    cantComprobantesEmitidos: 0,
    cantComprobantesCancelados: 0,
    cotizacion: 1,
    moneda,
    provincia,
    cotizacionListaDePrecio: 0,
    listaDePrecio,
    vendedor,
    porcentajeComision: 0,
    mailEstado: guestEmail,
    descripcion,
    cbuinformada: false,
    facturaNoExportacion: true,
    transaccionProductoItems,
    transaccionCobranzaItems
  };
}