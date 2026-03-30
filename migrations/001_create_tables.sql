CREATE TABLE IF NOT EXISTS webhook_events (
  id serial PRIMARY KEY,
  event_type text,
  payload jsonb,
  headers jsonb,
  processed boolean default false,
  created_at timestamptz default now()
);

CREATE TABLE IF NOT EXISTS processed_transactions (
  id serial PRIMARY KEY,
  webhook_event_id integer,
  tx_id text,
  status text,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);