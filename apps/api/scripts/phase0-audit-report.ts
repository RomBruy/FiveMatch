import { Client, type QueryResultRow } from 'pg'

type AuditSection = {
  total: number
  samples: QueryResultRow[]
}

const rawUrl = process.env.AUDIT_DATABASE_URL
if (!rawUrl) {
  throw new Error('AUDIT_DATABASE_URL is required. This report never falls back to DATABASE_URL.')
}

let target: URL
try {
  target = new URL(rawUrl)
} catch {
  throw new Error('AUDIT_DATABASE_URL must be a valid PostgreSQL URL.')
}
if (target.protocol !== 'postgres:' && target.protocol !== 'postgresql:') {
  throw new Error('AUDIT_DATABASE_URL must use the postgres or postgresql protocol.')
}

const client = new Client({
  connectionString: rawUrl,
  application_name: 'fivematch_phase0_read_only_audit',
  options: '-c default_transaction_read_only=on -c statement_timeout=30000',
})

async function section(sql: string): Promise<AuditSection> {
  const result = await client.query(sql)
  const total = Number(result.rows[0]?.audit_total ?? 0)
  return {
    total,
    samples: result.rows.map(({ audit_total: _auditTotal, ...row }) => row),
  }
}

async function main() {
  await client.connect()

  try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  await client.query("SET LOCAL statement_timeout = '30s'")

  const duplicatePlayerIdentities = await section(`
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      user_id,
      COUNT(*)::int AS total_profiles,
      COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active_profiles,
      COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted_profiles,
      ARRAY_AGG(id ORDER BY created_at, id) AS player_ids
    FROM players
    GROUP BY user_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, user_id
    LIMIT 100
  `)

  const matchCountDrift = await section(`
    WITH actual AS (
      SELECT
        mp.player_id,
        COUNT(DISTINCT mp.match_id)::int AS completed_result_participations
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.player_id IS NOT NULL
        AND m.status = 'completed'
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
      GROUP BY mp.player_id
    )
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      p.id AS player_id,
      p.match_count AS stored_match_count,
      COALESCE(a.completed_result_participations, 0) AS completed_result_participations,
      p.match_count - COALESCE(a.completed_result_participations, 0) AS delta
    FROM players p
    LEFT JOIN actual a ON a.player_id = p.id
    WHERE p.match_count <> COALESCE(a.completed_result_participations, 0)
    ORDER BY ABS(p.match_count - COALESCE(a.completed_result_participations, 0)) DESC, p.id
    LIMIT 100
  `)

  const provisionalCardEligibility = await section(`
    WITH candidate AS (
      SELECT
        mp.player_id,
        COUNT(DISTINCT mp.match_id)::int AS candidate_count
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.player_id IS NOT NULL
        AND m.status = 'completed'
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
      GROUP BY mp.player_id
    )
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      p.id AS player_id,
      p.match_count AS stored_match_count,
      p.card_state,
      COALESCE(c.candidate_count, 0) AS provisional_candidate_count,
      (COALESCE(c.candidate_count, 0) >= 4) AS would_clear_four_match_threshold
    FROM players p
    LEFT JOIN candidate c ON c.player_id = p.id
    WHERE p.match_count <> COALESCE(c.candidate_count, 0)
       OR (p.card_state = 'unlocked') <> (COALESCE(c.candidate_count, 0) >= 4)
    ORDER BY COALESCE(c.candidate_count, 0) DESC, p.id
    LIMIT 100
  `)

  const duplicateRatings = await section(`
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      match_id,
      rater_player_id,
      rated_player_id,
      COUNT(*)::int AS duplicate_count,
      ARRAY_AGG(id ORDER BY created_at, id) AS rating_ids
    FROM ratings
    WHERE match_id IS NOT NULL AND rater_player_id IS NOT NULL
    GROUP BY match_id, rater_player_id, rated_player_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, match_id
    LIMIT 100
  `)

  const suspiciousRatings = await section(`
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      r.id AS rating_id,
      r.match_id,
      r.rater_player_id,
      r.rated_player_id,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN r.rater_player_id = r.rated_player_id THEN 'self_rating' END,
        CASE WHEN r.rater_player_id IS NULL THEN 'missing_rater' END,
        CASE WHEN r.match_id IS NOT NULL AND rater_side.id IS NULL THEN 'rater_not_participant' END,
        CASE WHEN r.match_id IS NOT NULL AND rated_side.id IS NULL THEN 'rated_not_participant' END,
        CASE WHEN rater_side.id IS NOT NULL AND rated_side.id IS NOT NULL
               AND rater_side.team_side = rated_side.team_side THEN 'same_team' END,
        CASE WHEN m.id IS NOT NULL AND m.status <> 'completed' THEN 'match_not_completed' END,
        CASE WHEN m.id IS NOT NULL AND (m.score_a IS NULL OR m.score_b IS NULL) THEN 'incomplete_result' END
      ], NULL) AS reasons
    FROM ratings r
    LEFT JOIN matches m ON m.id = r.match_id
    LEFT JOIN match_participants rater_side
      ON rater_side.match_id = r.match_id AND rater_side.player_id = r.rater_player_id
    LEFT JOIN match_participants rated_side
      ON rated_side.match_id = r.match_id AND rated_side.player_id = r.rated_player_id
    WHERE r.match_id IS NOT NULL
      AND (
        r.rater_player_id IS NULL
        OR r.rater_player_id = r.rated_player_id
        OR rater_side.id IS NULL
        OR rated_side.id IS NULL
        OR rater_side.team_side = rated_side.team_side
        OR m.status <> 'completed'
        OR m.score_a IS NULL
        OR m.score_b IS NULL
      )
    ORDER BY r.created_at, r.id
    LIMIT 100
  `)

  const legacyRatingsWithoutMatch = await section(`
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      id AS rating_id,
      group_id,
      rated_player_id,
      is_initial,
      created_at
    FROM ratings
    WHERE match_id IS NULL
    ORDER BY created_at, id
    LIMIT 100
  `)

  const attendanceMergeCollisions = await section(`
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY user_id
          ORDER BY match_count DESC, created_at ASC, id ASC
        ) AS survivor_id
      FROM players
      WHERE deleted_at IS NULL
    ), merge_map AS (
      SELECT id AS old_id, survivor_id AS new_id FROM ranked WHERE id <> survivor_id
    ), normalized AS (
      SELECT a.id, a.match_id, COALESCE(mm.new_id, a.player_id) AS player_id
      FROM match_attendances a
      LEFT JOIN merge_map mm ON mm.old_id = a.player_id
      WHERE a.player_id IS NOT NULL
    )
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      match_id,
      player_id AS survivor_player_id,
      COUNT(*)::int AS rows_after_merge,
      ARRAY_AGG(id ORDER BY id) AS row_ids
    FROM normalized
    GROUP BY match_id, player_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, match_id
    LIMIT 100
  `)

  const participantMergeCollisions = await section(`
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY user_id
          ORDER BY match_count DESC, created_at ASC, id ASC
        ) AS survivor_id
      FROM players
      WHERE deleted_at IS NULL
    ), merge_map AS (
      SELECT id AS old_id, survivor_id AS new_id FROM ranked WHERE id <> survivor_id
    ), normalized AS (
      SELECT p.id, p.match_id, COALESCE(mm.new_id, p.player_id) AS player_id
      FROM match_participants p
      LEFT JOIN merge_map mm ON mm.old_id = p.player_id
      WHERE p.player_id IS NOT NULL
    )
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      match_id,
      player_id AS survivor_player_id,
      COUNT(*)::int AS rows_after_merge,
      ARRAY_AGG(id ORDER BY id) AS row_ids
    FROM normalized
    GROUP BY match_id, player_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, match_id
    LIMIT 100
  `)

  const ratingMergeCollisions = await section(`
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY user_id
          ORDER BY match_count DESC, created_at ASC, id ASC
        ) AS survivor_id
      FROM players
      WHERE deleted_at IS NULL
    ), merge_map AS (
      SELECT id AS old_id, survivor_id AS new_id FROM ranked WHERE id <> survivor_id
    ), normalized AS (
      SELECT
        r.id,
        r.match_id,
        COALESCE(rater_map.new_id, r.rater_player_id) AS rater_player_id,
        COALESCE(rated_map.new_id, r.rated_player_id) AS rated_player_id
      FROM ratings r
      LEFT JOIN merge_map rater_map ON rater_map.old_id = r.rater_player_id
      LEFT JOIN merge_map rated_map ON rated_map.old_id = r.rated_player_id
      WHERE r.match_id IS NOT NULL AND r.rater_player_id IS NOT NULL
    )
    SELECT
      COUNT(*) OVER()::text AS audit_total,
      match_id,
      rater_player_id,
      rated_player_id,
      COUNT(*)::int AS rows_after_merge,
      ARRAY_AGG(id ORDER BY id) AS row_ids
    FROM normalized
    GROUP BY match_id, rater_player_id, rated_player_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, match_id
    LIMIT 100
  `)

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      mode: 'repeatable-read transaction with default_transaction_read_only=on',
      sampleLimitPerSection: 100,
      target: {
        host: target.hostname,
        port: target.port || '5432',
        database: decodeURIComponent(target.pathname.replace(/^\/+/, '')),
      },
      warnings: [
        'The provisional card count proves completed match + result + participant snapshot only.',
        'Final attended outcome and voided-match state do not exist yet, so this report must not be used as an automatic card backfill.',
        'Opaque IDs are included for review; store the report as a restricted artifact.',
      ],
    },
    globalPlayerIdentity: { duplicatePlayerIdentities },
    countsAndCard: { matchCountDrift, provisionalCardEligibility },
    ratings: { duplicateRatings, suspiciousRatings, legacyRatingsWithoutMatch },
    migration0015Readiness: {
      softDeletedAndActiveIdentityCollisions: duplicatePlayerIdentities,
      attendanceMergeCollisions,
      participantMergeCollisions,
      ratingMergeCollisions,
    },
  }

    console.log(JSON.stringify(report, null, 2))
    await client.query('ROLLBACK')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
