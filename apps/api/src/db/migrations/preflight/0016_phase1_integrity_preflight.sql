-- READ ONLY. Run only against an explicitly approved audit/clone target.
-- Any non-empty result blocks the corresponding real-data constraint/backfill.

-- Duplicate post-match rating identities.
SELECT
  match_id,
  rater_player_id,
  rated_player_id,
  COUNT(*)::int AS duplicate_count,
  ARRAY_AGG(id ORDER BY created_at, id) AS rating_ids
FROM ratings
WHERE match_id IS NOT NULL AND rater_player_id IS NOT NULL
GROUP BY match_id, rater_player_id, rated_player_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, match_id;

-- Duplicate final participant identities that would collapse to one eligibility row.
SELECT
  match_id,
  player_id,
  COUNT(*)::int AS duplicate_count,
  ARRAY_AGG(id ORDER BY created_at, id) AS participant_ids
FROM match_participants
WHERE player_id IS NOT NULL
GROUP BY match_id, player_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, match_id;

-- Historical MATCH_UPDATE rows whose JSON points at the same match/player.
SELECT
  breakdown ->> 'matchId' AS match_id,
  player_id,
  event_type,
  COUNT(*)::int AS duplicate_count,
  ARRAY_AGG(id ORDER BY created_at, id) AS event_ids
FROM rating_events
WHERE event_type = 'MATCH_UPDATE'
  AND breakdown ->> 'matchId' IS NOT NULL
GROUP BY breakdown ->> 'matchId', player_id, event_type
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, match_id;

-- Ineligible historical post-match rating shapes. Classify; do not repair here.
SELECT
  r.id AS rating_id,
  r.match_id,
  r.rater_player_id,
  r.rated_player_id,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN r.rater_player_id IS NULL THEN 'missing_rater' END,
    CASE WHEN r.rater_player_id = r.rated_player_id THEN 'self_rating' END,
    CASE WHEN rater.id IS NULL THEN 'rater_not_participant' END,
    CASE WHEN target.id IS NULL THEN 'target_not_participant' END,
    CASE WHEN rater.id IS NOT NULL AND target.id IS NOT NULL AND rater.team_side = target.team_side THEN 'same_team' END,
    CASE WHEN m.status <> 'completed' THEN 'match_not_completed' END,
    CASE WHEN m.score_a IS NULL OR m.score_b IS NULL THEN 'incomplete_result' END
  ], NULL) AS reasons
FROM ratings r
JOIN matches m ON m.id = r.match_id
LEFT JOIN match_participants rater
  ON rater.match_id = r.match_id AND rater.player_id = r.rater_player_id
LEFT JOIN match_participants target
  ON target.match_id = r.match_id AND target.player_id = r.rated_player_id
WHERE r.match_id IS NOT NULL
  AND (
    r.rater_player_id IS NULL
    OR r.rater_player_id = r.rated_player_id
    OR rater.id IS NULL
    OR target.id IS NULL
    OR rater.team_side = target.team_side
    OR m.status <> 'completed'
    OR m.score_a IS NULL
    OR m.score_b IS NULL
  )
ORDER BY r.created_at, r.id;
