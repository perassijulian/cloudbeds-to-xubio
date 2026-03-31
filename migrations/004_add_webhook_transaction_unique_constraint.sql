-- Add unique constraint to prevent duplicate processed transactions for the same webhook
CREATE UNIQUE INDEX unique_webhook_transaction_pair 
ON processed_transactions (webhook_event_id, tx_id);

-- This prevents the same webhook from creating duplicate processed transactions
-- while still allowing different webhooks for the same transaction (retries)
-- and multiple payments for the same reservation (different tx_ids)
