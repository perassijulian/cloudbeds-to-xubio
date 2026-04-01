CREATE OR REPLACE FUNCTION claim_tx(p_tx_id TEXT)
RETURNS SETOF processed_transactions
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_row processed_transactions;
BEGIN
  -- 1) Try insert and capture it
  INSERT INTO processed_transactions
    (tx_id, processing_status, status, created_at, updated_at)
  VALUES
    (p_tx_id, 'processing', 'pending', NOW(), NOW())
  ON CONFLICT (tx_id) DO NOTHING
  RETURNING * INTO inserted_row;

  -- ✅ If we inserted → we own the lock
  IF inserted_row IS NOT NULL THEN
    RETURN NEXT inserted_row;
    RETURN;
  END IF;

  -- 2) Otherwise try to claim existing row
  RETURN QUERY
  UPDATE processed_transactions
  SET processing_status = 'processing',
      updated_at = NOW()
  WHERE tx_id = p_tx_id
    AND processing_status IN ('pending', 'failed')
  RETURNING *;

END;
$$;