-- Drop existing tables with wrong schema
DROP TABLE IF EXISTS cloudbeds_to_xubio CASCADE;
DROP TABLE IF EXISTS cloudbeds_transactions CASCADE;

-- Note: webhook_events and processed_transactions will be created by 001_create_tables.sql
-- if they don't exist, or updated if they do exist
