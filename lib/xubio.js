import pRetry from 'p-retry';

const BASE_URL = 'https://xubio.com/API/1.1';
const TOKEN_URL = `${BASE_URL}/TokenEndpoint`;

let cachedToken = null;
let tokenExpiresAt = 0;

function joinUrl(path) {
  try {
    // allow caller to pass either "/facturar" or a full url
    return new URL(path, BASE_URL).toString();
  } catch (e) {
    return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  }
}

export async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.XUBIO_CLIENT_ID;
  const secretId = process.env.XUBIO_SECRET_ID;

  if (!clientId || !secretId) {
    throw new Error('Missing XUBIO_CLIENT_ID or XUBIO_SECRET_ID in environment variables');
  }

  const credentials = Buffer.from(`${clientId}:${secretId}`).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Xubio token: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (parseInt(data.expires_in, 10) * 1000) - 10000; // minus 10s buffer
  console.log('[xubio] New token fetched, expires in', data.expires_in, 'seconds');

  return cachedToken;
}

export async function xubioFetch(endpointOrUrl, options = {}) {
  const token = await getAccessToken();
  const url = endpointOrUrl.startsWith('http') ? endpointOrUrl : joinUrl(endpointOrUrl);
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (res.status === 401) {
    // token likely expired
    cachedToken = null;
    return xubioFetch(endpointOrUrl, options);
  }

  return res;
}

function buildXubioPayload(reservation, tx) {
  // guard
  const guestEntry = reservation?.guestList?.[tx?.customerId] ||
    Object.values(reservation?.guestList || {})[0] || {};
  const guestName = guestEntry.guestName || reservation.guestName || `${guestEntry.guestFirstName || ''} ${guestEntry.guestLastName || ''}`.trim();
  const guestEmail = guestEntry.guestEmail || reservation.guestEmail || null;
  const guestTaxId = guestEntry.taxID || guestEntry.guestDocumentNumber || null;

  // compute amount and itemization: sum dailyRates for the matching room/subReservation if present
  let itemAmount = tx.amount ?? 0;
  // If you want to aggregate the room total:
  const assigned = reservation.assigned && reservation.assigned[0];
  const roomTotal = assigned ? Number(assigned.roomTotal || 0) : null;

  const description = tx.description || `Estadia ${reservation.reservationID} - ${assigned?.roomTypeName || ''}`.trim();

  const date = (tx.transactionDatetime || tx.transactionDatetimePropertyTime || tx.serviceDate || new Date().toISOString()).slice(0, 10);

  const productItem = {
    descripcion: description,
    cantidad: 1,
    precio: roomTotal ?? itemAmount,
    precioconivaincluido: roomTotal ?? itemAmount,
    iva: 0,
    importe: roomTotal ?? itemAmount,
    total: roomTotal ?? itemAmount,
    // add producto metadata if you have product IDs
    producto: { nombre: assigned?.roomTypeName || 'Habitación' }
  };

  const cobranzaItem = {
    transaccionid: tx.id,
    itemId: tx.id,
    cuentaTipo: 'payment',
    cuentaId: null,
    moneda: { nombre: tx.currency || 'Pesos Argentinos' },
    cotizacionMonTransaccion: 1,
    importeMonPrincipal: tx.amount ?? (roomTotal ?? itemAmount),
    importeMonTransaccion: tx.amount ?? (roomTotal ?? itemAmount),
    numeroCheque: null,
    fechaVto: date,
    banco: null,
    descripcion: `Pago Cloudbeds ${tx.id}`
  };

  return {
    circuitoContable: { nombre: 'default' },
    comprobante: 0,
    fecha: date,
    fechaDesde: reservation.startDate || date,
    fechaHasta: reservation.endDate || date,
    externalId: reservation.reservationID || tx.sourceIdentifier || tx.id, // required
    cliente: {
      nombre: guestName || 'Cliente desconocido',
      codigo: guestTaxId || null,
      email: guestEmail || null
    }, // required, ClientBeanSelector
    descripcion: description,
    transaccionProductoItems: [productItem],
    transaccionCobranzaItems: [cobranzaItem],
    importeMonPrincipal: tx.amount ?? (roomTotal ?? itemAmount),
    importetotal: tx.amount ?? (roomTotal ?? itemAmount),
    moneda: { nombre: tx.currency || 'Pesos Argentinos' }
  };
}

export async function createInvoice(payload) {
  const endpoint = process.env.XUBIO_ENDPOINT;
  const key = process.env.XUBIO_API_KEY;
  if (!endpoint || !key) throw new Error('Xubio config missing');

  return pRetry(async () => {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      const err = new Error(`Xubio error ${r.status}: ${JSON.stringify(body)}`);
      if (r.status >= 400 && r.status < 500) err.name = 'AbortError';
      throw err;
    }
    return body;
  }, { retries: 3 });
}

