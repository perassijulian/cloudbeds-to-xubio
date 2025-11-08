import pRetry from 'p-retry';

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