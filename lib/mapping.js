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
export function buildXubioPayload({ 
    reservation = {}, 
    transaction = {}, 
    guest = {}, 
    client = {}, 
    config = {}
  }) {
      // Use the data from the handler
  const { puntoVenta, moneda, provincia, listaDePrecio, deposito, centroDeCosto, banco, vendedor } = config;

  // ---- helpers ----
  const today = () => new Date().toISOString().split('T')[0];
  const safeNum = (v) => (v == null ? 0 : Number(v));

  const transaccionId = transaction?.id ?? null;

  const guestName = reservation.guestName || 'Consumidor Final';
  const guestEmail = reservation.guestEmail || guest.email || null;
  const guestTaxId = guest.taxID || guest.companyTaxID || "-";

  // Dates
  const fecha = today();
  const fechaVto = fecha;

  // External id & name/description
  const externalId = reservation.reservationID;
  const descripcion = `Estadia para reserva ${externalId}. ${reservation.guestName} CUIT: ${guestTaxId}. El día ${fecha}`;

  // Money
  const {total: rawTotal} = reservation; // total is the total amount of the reservation
  const {amount: rawAmount} = transaction; // amount is the amount that's being paid

  const total = safeNum(rawTotal)
  const amount = safeNum(rawAmount)
  // ---- Build product items: aggregate dailyRates per assigned room if present ----
  const assigned = Array.isArray(reservation.assigned) && reservation.assigned.length ? reservation.assigned[0] : null;

  let transaccionProductoItems = [];
  if (assigned && Array.isArray(assigned.dailyRates) && assigned.dailyRates.length) {
    // Option A: create one line per night
    transaccionProductoItems = assigned.dailyRates.map((d, idx) => {
      const rate = safeNum(d.rate);
      return {
        transaccionId,
        producto: { ID: 0, nombre: assigned.roomTypeName || 'Habitación', codigo: '', id: 0 },
        centroDeCosto,
        deposito,
        descripcion,
        cantidad: 1,
        precio: rate,
        iva: 0,
        importe: rate,
        total,
        montoExento: 0,
        porcentajeDescuento: 0
      };
    });
  } else {
    // Fallback: single aggregated line using tx.amount or assigned.roomTotal
    transaccionProductoItems = [
      {
        transaccionId,
        producto: { ID: 0, nombre: assigned?.roomTypeName || 'Habitación', codigo: '', id: 0 },
        centroDeCosto,
        deposito,
        descripcion,
        cantidad: 1,
        precio: amount,
        iva: 0,
        importe: amount,
        total,
        montoExento: 0,
        porcentajeDescuento: 0
      }
    ];
  }

  const transaccionPercepcionItems = [{
    transaccionId,
    centroDeCosto,
    descripcion,
    importe: amount,
  }]

  // ---- Cobranza items (payments) ----
  const transaccionCobranzaItems = [
    {
      transaccionId,
      moneda,
      banco,
      descripcion,
      fechaVto,
    }
  ];

  // ---- Provincia: try to use guest country/state or reservation origin (best-effort) ----
  // provincia FALLBACK
  // const provincia = reservation?.province || guestEntry?.guestState || { provincia_id: 0, codigo: '', nombre: '', pais: '' };

  // ---- Final payload following requested fields ----
  return {
    externalId,
    cliente: {
      ID: guest?.guestID ?? null,
      nombre: guestName,
      codigo: guest?.CUIT ?? guest?.cuit 
    },
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
    transaccionPercepcionItems,
    transaccionCobranzaItems
  };
}