-- Multi-currency pricing for recurring matches.
--
-- Fully additive: one column with the same default the matches table already
-- carries. No DROP, no DELETE, no backfill needed — existing rows take 'EUR',
-- which is exactly what they meant when the column did not exist.
--
-- `matches.currency` has been in the schema since it was written, but nothing
-- could ever set it: creation never sent a currency, so every match anywhere
-- priced in euros. Now that creation can, a recurring series has to carry the
-- choice too — occurrences are materialised from the series row, so without
-- this column every occurrence of a non-euro series would silently revert.

ALTER TABLE "match_series" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;
