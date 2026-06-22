\pset format aligned
\pset tuples_only off

WITH expected AS (
  SELECT
    generate_series(1, 1000) AS index,
    'E2E-FINAL-1000-' || lpad(generate_series(1, 1000)::text, 6, '0') AS sequence_id
),
records AS (
  SELECT
    "id",
    "sessionId",
    "measuredAt",
    "depthMd",
    "gatewaySequence"
  FROM "MWD_Data"
  WHERE "gatewaySequence" LIKE 'E2E-FINAL-1000-%'
),
duplicate_sequences AS (
  SELECT
    "gatewaySequence",
    count(*) AS duplicate_count
  FROM records
  WHERE "gatewaySequence" IS NOT NULL
  GROUP BY "gatewaySequence"
  HAVING count(*) > 1
),
missing_sequences AS (
  SELECT expected.sequence_id
  FROM expected
  LEFT JOIN records
    ON records."gatewaySequence" = expected.sequence_id
  WHERE records."gatewaySequence" IS NULL
)
SELECT 'total_stored_records' AS metric, count(*)::text AS value FROM records
UNION ALL
SELECT 'unique_sequences', count(DISTINCT "gatewaySequence")::text FROM records
UNION ALL
SELECT 'duplicate_records', coalesce(sum(duplicate_count - 1), 0)::text FROM duplicate_sequences
UNION ALL
SELECT 'null_sequence_id', count(*)::text FROM records WHERE "gatewaySequence" IS NULL
UNION ALL
SELECT 'null_measured_timestamp', count(*)::text FROM records WHERE "measuredAt" IS NULL
UNION ALL
SELECT 'invalid_required_fields', count(*)::text FROM records WHERE "sessionId" IS NULL OR "depthMd" IS NULL
UNION ALL
SELECT 'session_mismatch', count(*)::text FROM records WHERE "sessionId" <> 1
UNION ALL
SELECT 'missing_sequence', count(*)::text FROM missing_sequences;

SELECT
  "gatewaySequence" AS duplicate_sequence,
  duplicate_count
FROM duplicate_sequences
ORDER BY "gatewaySequence";

SELECT
  sequence_id AS missing_sequence_id
FROM missing_sequences
ORDER BY sequence_id
LIMIT 1000;
