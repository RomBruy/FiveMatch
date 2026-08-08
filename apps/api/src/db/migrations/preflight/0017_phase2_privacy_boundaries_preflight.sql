-- READ ONLY. This reports shape/count evidence only; it never displays profile values.
-- Run before 0017 against an explicitly approved clone/audit target.

SELECT
  COUNT(*)::int AS user_count,
  COUNT(*) FILTER (WHERE profile_photo_url IS NOT NULL)::int AS populated_profile_photo,
  COUNT(*) FILTER (WHERE current_club IS NOT NULL)::int AS populated_current_club,
  COUNT(*) FILTER (WHERE former_club IS NOT NULL)::int AS populated_former_club,
  COUNT(*) FILTER (WHERE preferred_position IS NOT NULL)::int AS populated_preferred_position,
  COUNT(*) FILTER (WHERE strong_foot IS NOT NULL)::int AS populated_strong_foot,
  COUNT(*) FILTER (WHERE player_style IS NOT NULL)::int AS populated_player_style,
  COUNT(*) FILTER (WHERE special_skill IS NOT NULL)::int AS populated_special_skill,
  COUNT(*) FILTER (WHERE favorite_excuse IS NOT NULL)::int AS populated_favorite_excuse,
  COUNT(*) FILTER (WHERE bad_faith_level IS NOT NULL)::int AS populated_bad_faith_level,
  COUNT(*) FILTER (WHERE locker_room_style IS NOT NULL)::int AS populated_locker_room_style,
  COUNT(*) FILTER (WHERE third_half_profile IS NOT NULL)::int AS populated_third_half_profile
FROM users;

SELECT
  COUNT(*) FILTER (WHERE profile_photo_card_url IS NOT NULL)::int AS populated_generated_card_photo
FROM players;

-- If the column already exists on a partially migrated clone, this reports invalid
-- shapes without returning its values. Zero rows is required before application use.
SELECT COUNT(*)::int AS invalid_visibility_row_count
FROM users
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'users'
    AND column_name = 'profile_field_visibility'
)
AND (
  to_jsonb(users) -> 'profile_field_visibility' IS NULL
  OR jsonb_typeof(to_jsonb(users) -> 'profile_field_visibility') <> 'object'
  OR NOT (to_jsonb(users) -> 'profile_field_visibility') ?& ARRAY[
    'profilePhoto', 'generatedCardPhoto', 'currentClub', 'formerClub',
    'preferredPosition', 'strongFoot', 'playerStyle', 'specialSkill',
    'favoriteExcuse', 'badFaithLevel', 'lockerRoomStyle', 'thirdHalfProfile'
  ]
  OR jsonb_path_exists(
    to_jsonb(users) -> 'profile_field_visibility',
    '$.* ? (@ != "private" && @ != "group" && @ != "participants" && @ != "public")'
  )
);
