ALTER TABLE "users"
ADD COLUMN "profile_field_visibility" jsonb NOT NULL DEFAULT '{
  "profilePhoto":"private",
  "generatedCardPhoto":"private",
  "currentClub":"private",
  "formerClub":"private",
  "preferredPosition":"private",
  "strongFoot":"private",
  "playerStyle":"private",
  "specialSkill":"private",
  "favoriteExcuse":"private",
  "badFaithLevel":"private",
  "lockerRoomStyle":"private",
  "thirdHalfProfile":"private"
}'::jsonb;
--> statement-breakpoint
ALTER TABLE "users"
ADD CONSTRAINT "users_profile_field_visibility_valid" CHECK (
  jsonb_typeof("profile_field_visibility") = 'object'
  AND "profile_field_visibility" ?& ARRAY[
    'profilePhoto', 'generatedCardPhoto', 'currentClub', 'formerClub',
    'preferredPosition', 'strongFoot', 'playerStyle', 'specialSkill',
    'favoriteExcuse', 'badFaithLevel', 'lockerRoomStyle', 'thirdHalfProfile'
  ]
  AND NOT jsonb_path_exists(
    "profile_field_visibility",
    '$.* ? (@ != "private" && @ != "group" && @ != "participants" && @ != "public")'
  )
);

