# Discovery latency at scale

First measurement, 2026-08-13. Phase 7's exit criterion asks whether discovery meets a p95 target "at representative load" — a question nobody could answer, because every database this code had run against held a handful of rows.

## Targets

Proposed and agreed, since none existed:

| Surface | p95 |
|---|---|
| Discovery / guest discovery | 400ms |
| Match detail | 300ms |
| App-launch calls | 500ms |

400ms is roughly where a list stops feeling instant on a phone but still feels responsive.

## Method

`scripts/seed-load-test.ts` seeds matches weighted across five French cities — most in Paris and Lyon, so density is realistic rather than uniform — with partly-filled attendance sheets, since those are what the per-row subqueries count. `scripts/measure-latency.ts` takes 60 samples after 10 warmup runs.

Measured at the service layer, not over HTTP: that is where the database time is, and it isolates what can be optimised. Express, JSON and TLS add a roughly constant few milliseconds, so these are a floor for the real numbers rather than a substitute.

Both scripts are guarded by the same check the integration suite uses and cannot be pointed at a development or production database.

## Results

| Surface | 20k matches | 100k matches | Target | |
|---|---|---|---|---|
| guest discovery (city) | p95 8.6ms | p95 10.4ms | 400ms | PASS |
| guest discovery (geo 15km) | p95 18.1ms | p95 9.2ms | 400ms | PASS |
| guest discovery (geo 100km) | p95 27.5ms | p95 25.9ms | 400ms | PASS |
| authenticated discovery (geo) | p95 102.3ms | p95 **177.7ms** | 400ms | PASS |

Everything passes today, at five times the seeded load.

## The finding: the two paths scale differently

Guest discovery is **flat** across a fivefold increase in data. Authenticated discovery **grows with it** — p50 tripled (34.7 → 100.6ms) and p95 nearly doubled.

The query plans explain it exactly.

**Guest discovery orders by `scheduled_at`**, which is indexed, so Postgres walks the index and stops as soon as it has a page:

```
Index Scan using matches_discovery_idx
  Rows Removed by Filter: 39      ← work bounded by the page size
```

**Authenticated discovery orders by distance**, which no index can supply. Every row in the bounding box must have its haversine computed before anything can be sorted:

```
Bitmap Heap Scan on matches   rows=32054   ← every row in the box
Sort  Sort Key: (6371 * acos(...))
Execution Time: 1033 ms                     ← cold, 100k dataset
```

That is O(rows in the box), not O(page size). It is fine in a sparse area and grows with density — precisely where the product wants to work best.

## What this means

It passes now and will keep passing for a long time. The concern is the shape of the curve, not today's number: in a city dense enough to hold hundreds of thousands of live matches, distance ordering would cross 400ms while the guest path stayed flat.

**ADR-012 anticipated this**, saying to keep numeric latitude/longitude and adopt grid, geohash or PostGIS "only when measured city density and query plans justify it". This is the first measurement against that condition. It does not yet justify the change — but it identifies the exact query that will, and the trigger to watch.

Three options when it does, cheapest first:

1. **Order authenticated discovery by time**, like the guest path, and treat distance as a filter only. Free, and arguably better product behaviour — soonest-first is more useful to scroll than nearest-first.
2. **Tighten the bounding box** before sorting, so fewer rows reach the distance computation.
3. **PostGIS or a geohash grid**, which makes distance ordering indexable. The real fix, and the largest change.

## Reproducing

```sh
TEST_DATABASE_URL=... pnpm --filter @fivematch/api seed:load        # LOAD_MATCHES / LOAD_PLAYERS to vary
TEST_DATABASE_URL=... pnpm --filter @fivematch/api measure:latency
LOAD_PURGE=1 TEST_DATABASE_URL=... pnpm --filter @fivematch/api seed:load   # clean up
```

The purge matters: the test database is shared with the integration suite, and leaving 100k rows behind slows every run.

## Not covered

Concurrent load. These are sequential samples against an idle database, so they measure query cost, not contention or connection-pool saturation. A real p95 under concurrent traffic will be higher, and that measurement needs a load generator this project does not have.
