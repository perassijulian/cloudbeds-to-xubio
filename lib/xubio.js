const BASE_URL = 'https://xubio.com:443/API/1.1';
const TOKEN_URL = `${BASE_URL}/TokenEndpoint`;
const DEFAULT_TIMEOUT = 8000;

let cachedToken = null;
let tokenExpiresAt = 0;

export const postSolicitarCAE = async (payload) => {
  const res = await xubioFetch(`/solicitarCAE`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Xubio solicitarCAE failed ${res.status}`);
  return await res.json();
}

export const getLastFacturaNumber = async () => {
  const res = await xubioFetch(`/comprobanteVentaBean`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio comprobanteVentaBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) && arr.length ? arr[0].numeroDocumento : null;
}

export const getBanco = async () => {
  const res = await xubioFetch(`/banco`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio banco failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getCentroDeCosto = async () => {
  const res = await xubioFetch(`/centroDeCostoBean`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio centroDeCostoBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  console.log("centroDeCosto", arr)
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getProductoVenta = async () => {
  const res = await xubioFetch(`/productoVentaBean`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio productoVentaBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  console.log("productoVenta", arr)
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getDepositos = async () => {
  const res = await xubioFetch(`/depositos?activo=1`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio depositos failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  console.log("depositos", arr)
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getVendedor = async () => {
  console.log("[getVendedor]")
  const res = await xubioFetch(`/vendedorBean`, { method: 'GET' });
  console.log("[getVendedor] res:", res)
  if (!res.ok) throw new Error(`Xubio vendedorBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  console.log("vendedor", arr)
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getListaPrecio = async () => {
  const res = await xubioFetch(`/listaPrecioBean`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio listaPrecioBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  console.log("listaPrecio", arr)
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getProvincia = async () => {
  const res = await xubioFetch(`/provinciaBean`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio provinciaBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getMoneda = async () => {
  const res = await xubioFetch(`/monedaBean`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio monedaBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

export const getPuntoDeVenta = async () => {
  const res = await xubioFetch(`/puntoVentaBean`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio puntoVentaBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  return arr;
}

export const postFacturar = async (payload) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);
  
  try {
    console.log(`📤 [${requestId}] Sending to Xubio /facturar...`);
    console.log(`🔗 URL: ${BASE_URL}/facturar`);
    console.log(`📝 Payload (${JSON.stringify(payload).length} bytes):`, JSON.stringify(payload, null, 2));

    // Use xubioFetch instead of raw fetch to handle authentication
    const response = await xubioFetch(`/facturar`, { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️ [${requestId}] Response received in ${responseTime}ms - Status: ${response.status}`);

    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error(`❌ [${requestId}] Failed to parse JSON response:`, responseText);
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
    }

    if (!response.ok) {
      console.error(`❌ [${requestId}] Xubio API Error ${response.status}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData
      });
      throw new Error(`Xubio API Error ${response.status}: ${responseData.message || response.statusText}`);
    }

    console.log(`✅ [${requestId}] Success:`, JSON.stringify(responseData, null, 2));

    return responseData;

  } catch (error) {
    const errorMessage = error.response 
      ? `API Error: ${error.response.status} - ${error.response.statusText}`
      : error.name === 'AbortError' 
        ? 'Request timed out'
        : error.message;

    console.error(`❌ [${requestId}] Error in postFacturar:`, {
      error: errorMessage,
      url: `${BASE_URL}/facturar`,
      method: 'POST',
      duration: `${Date.now() - startTime}ms`,
      stack: error.stack
    });

    throw error;
  }
};

export const postListaPrecio = async (payload) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(2, 9);

  try {
    console.log(`📤 [${requestId}] Sending to Xubio /listaPrecioBean...`);
    console.log(`🔗 URL: ${BASE_URL}/listaPrecioBean`);
    console.log(`📝 Payload (${JSON.stringify(payload).length} bytes):`, JSON.stringify(payload, null, 2));

    // Use xubioFetch instead of raw fetch to handle authentication
    const response = await xubioFetch(`/listaPrecioBean`, { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': requestId
      },
      body: JSON.stringify(payload)
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️ [${requestId}] Response received in ${responseTime}ms - Status: ${response.status}`);

    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error(`❌ [${requestId}] Failed to parse JSON response:`, responseText);
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
    }

    if (!response.ok) {
      console.error(`❌ [${requestId}] Xubio API Error ${response.status}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseData
      });
      throw new Error(`Xubio API Error ${response.status}: ${responseData.message || response.statusText}`);
    }

    console.log(`✅ [${requestId}] Success:`, JSON.stringify(responseData, null, 2));
    return responseData;

  } catch (error) {
    const errorMessage = error.response 
      ? `API Error: ${error.response.status} - ${error.response.statusText}`
      : error.name === 'AbortError' 
        ? 'Request timed out'
        : error.message;

    console.error(`❌ [${requestId}] Error in postListaPrecio:`, {
      error: errorMessage,
      url: `${BASE_URL}/listaPrecioBean`,
      method: 'POST',
      duration: `${Date.now() - startTime}ms`,
      stack: error.stack
    });

    throw error;
  }
};

async function getAccessToken() {
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

  return cachedToken;
}

async function getAccessTokenSafe() {
  try {
    return await getAccessToken();
  } catch (e) {
    console.error("getAccessToken failed:", e);
    throw e;
  }
}

export async function xubioFetch(endpoint, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const signal = controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try{
    const token = await getAccessTokenSafe();

    const headers = {
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      };

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      signal,
      headers,
    });

    // retry token refresh only once
    if (res.status === 401 && !options._retry401) {
      console.warn("xubioFetch: 401 — refreshing token and retrying once");
      cachedToken = null; // si usás cache global
      // avoid infinite loop: pass a flag
      return xubioFetch(endpoint, { ...options, _retry401: true });
    }

    return res;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error("xubioFetch: request aborted (timeout)", endpoint);
      throw err;
    }
    console.error("xubioFetch error:", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// tries to find a Xubio client by tax id (CUIT). Returns client object or null.
export async function findXubioClientByCuit(cuit) {
  if (!cuit) return null;
  // Try a few variants: raw, with/without dashes/spaces
  const cleaned = String(cuit).replace(/[^0-9]/g, '');
  const candidates = [cleaned, cuit];

  for (const q of candidates) {
    // try query by identificacionTributaria or by nombre fallback
    const res = await xubioFetch(`/clienteBean?numeroIdentificacion=${encodeURIComponent(q)}`, { method: 'GET' });
    if (!res.ok) continue;
    const arr = await res.json().catch(() => []);
    if (Array.isArray(arr) && arr.length) return arr[0];
  }
  return null;
}

// fallback to the neutral "Consumidor Final" record
export async function getConsumidorFinalClient() {
  const q = encodeURIComponent('Consumidor Final');
  const res = await xubioFetch(`/clienteBean?nombre=${q}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Xubio clienteBean failed ${res.status}`);
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

/**
 * Main helper: given a guest object (from Cloudbeds) returns the Xubio client object to use.
 * guest example: { guestDocumentNumber: '20312345678', taxID: '20312345678', guestName: '...' }
 */
export async function resolveXubioClientForGuest(guest = {}) {
  // prefer tax fields
  const cuit = guest.taxID || guest.documentNumber;
  if (cuit) {
    try {
      const found = await findXubioClientByCuit(cuit);
      if (found) return found;
    } catch (err) {
      console.warn('Xubio lookup by CUIT failed, falling back', err?.message || err);
    }
  }

  // try searching by exact guest name (optional)
  if (guest.guestName) {
    try {
      const byName = await xubioFetch(`/clienteBean?nombre=${encodeURIComponent(guest.guestName)}`, { method: 'GET' });
      if (byName.ok) {
        const arr = await byName.json().catch(() => []);
        if (Array.isArray(arr) && arr.length) return arr[0];
      }
    } catch (e) {
      // ignore and fallback
    }
  }

  // final fallback: Consumidor Final
  const cf = await getConsumidorFinalClient();
  if (cf) return cf;

  // if all fails, return a minimal object so callers won't crash
  return { cliente_id: null, nombre: 'Consumidor Final', CUIT: '' };
}

