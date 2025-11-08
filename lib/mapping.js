// Simple mapping template: adapt to Xubio's invoice schema
export function mapToXubioPayload(payload, txDetails) {
  const amount = txDetails?.amount || payload.amount || 0;
  const date = (payload.transactionDateTime || payload.serviceDate || new Date().toISOString()).split('T')[0];

  return {
    date,
    customer: {
      name: txDetails?.guest?.name || payload.guestName || 'Unknown',
      vat: txDetails?.guest?.taxId || null,
      email: txDetails?.guest?.email || null
    },
    items: [
      {
        description: `Payment ${payload.transactionId}`,
        quantity: 1,
        unit_price: amount,
        tax: txDetails?.tax || 0
      }
    ],
    total: amount,
    origin: 'cloudbeds',
    origin_transaction_id: payload.transactionId
  };
}