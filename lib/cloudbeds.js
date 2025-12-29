const PROPERTY_ID = process.env.PROPERTY_ID;
const token = process.env.CB_API_KEY;

export async function fetchCurrencyRate() {
  if (!PROPERTY_ID) return null;
  if (!token) return null;
  const url = `https://api.cloudbeds.com/api/v1.3/getCurrencySettings?propertyID=${PROPERTY_ID}`;
    const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Property-ID': PROPERTY_ID || '',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cloudbeds currency fetch failed ${res.status}: ${text}`);
  }
  const data = JSON.parse(text);
  return data.data?.rates?.fixed?.[0]?.rate || null;
}