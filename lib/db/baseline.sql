-- Run only after backing up and verifying the existing schema matches 0000_baseline.sql.
-- This records the existing schema; it does not create or alter application tables.
BEGIN;
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations) THEN
    RAISE EXCEPTION 'Migration history already exists; do not baseline this database';
  END IF;
  IF to_regclass('public.users') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.users'; END IF;
  IF to_regclass('public.locations') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.locations'; END IF;
  IF to_regclass('public.farm_profiles') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.farm_profiles'; END IF;
  IF to_regclass('public.field_notes') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.field_notes'; END IF;
  IF to_regclass('public.yield_records') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.yield_records'; END IF;
  IF to_regclass('public.input_costs') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.input_costs'; END IF;
  IF to_regclass('public.push_tokens') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.push_tokens'; END IF;
  IF to_regclass('public.alerts') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.alerts'; END IF;
  IF to_regclass('public.alert_preferences') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.alert_preferences'; END IF;
  IF to_regclass('public.subscriptions') IS NULL THEN RAISE EXCEPTION 'Missing baseline table: public.subscriptions'; END IF;
END $$;
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('91cc7459deaac70d8eb87e10f3fac2f4808d2ec90079cf75fc112c63c01c7d8e', 1792077110951);
COMMIT;
