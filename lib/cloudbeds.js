import fetch from 'node-fetch';

export async function fetchTransactionDetailsIfNeeded(txId) {
  if (!txId) return null;
  const key = process.env.CB_API_KEY;
  if (!key) return null;
  const url = `https://hotels.cloudbeds.com/accounting/v1.0/transactions/${txId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }});
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    throw new Error(`Cloudbeds fetch failed ${res.status}: ${txt}`);
  }
  return res.json();
}