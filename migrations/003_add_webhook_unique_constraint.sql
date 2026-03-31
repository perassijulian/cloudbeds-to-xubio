CREATE UNIQUE INDEX unique_transaction_webhook
ON webhook_events ((payload->>'transactionId'));