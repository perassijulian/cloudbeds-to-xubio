import { handleWebhook } from '../lib/handler.js';

export default async function (req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    await handleWebhook(req.body, req.headers);
    return res.status(200).send('ok');
  } catch (err) {
    console.error('webhook error', err);
    // return 200 on known duplicate to avoid retries; otherwise 500
    if (err && err.code === 409) return res.status(200).send('duplicate');
    return res.status(500).send('error');
  }
}