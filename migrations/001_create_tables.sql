CREATE TABLE IF NOT EXISTS cloudbeds_transactions (
  transaction_id text PRIMARY KEY,
  property_id text,
  payload jsonb,
  status text default 'received',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS cloudbeds_to_xubio (
  transaction_id text PRIMARY KEY,
  xubio_invoice_id text,
  status text,
  response jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);