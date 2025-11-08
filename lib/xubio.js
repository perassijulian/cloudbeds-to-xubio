import pRetry from 'p-retry';

const TOKEN_URL = 'https://xubio.com/API/1.1/TokenEndpoint';

let cachedToken = null;
let tokenExpiresAt = 0;

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

export async function xubioFetch(url, options = {}) {
  const token = await getAccessToken();
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
    return xubioFetch(url, options);
  }

  return res;
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
    const body = await r.json().catch(()=>null);
    if (!r.ok) {
      const err = new Error(`Xubio error ${r.status}: ${JSON.stringify(body)}`);
      if (r.status >= 400 && r.status < 500) err.name = 'AbortError';
      throw err;
    }
    return body;
  }, { retries: 3 });
}

