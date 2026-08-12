# Outstanding verification

Things that are **built and tested but have never run against the real thing**. Each entry says what is unproven, why it matters, and how to check it.

Last reviewed: 2026-08-08

This file exists because "the tests pass" and "it works" are different claims, and the gap between them is easy to lose track of across phases. Nothing here is a known bug — it is a list of things nobody has yet seen work.

---

## 1. Card photo generation has probably never produced an image

**Severity: high — the feature does not work today.**

Until 2026-08-08 the generation client called `gemini-1.5-flash`, which takes images as input and returns *text*. The code then looked for image bytes in the response and threw `Gemini returned no image data` when it found none. Every job would have failed with `GEMINI_ERROR`.

It is now written against `gemini-2.5-flash-image` with `responseModalities: ['IMAGE']`, using the current `@google/genai` SDK — but **from documentation, not from a successful call**. The model name and the response shape are both unverified.

**Needed:** `GEMINI_API_KEY` in `apps/api/.env` (optionally `GEMINI_IMAGE_MODEL` to override the model).

**How to check:** with the key set, run one generation and confirm bytes come back. This can be tested in isolation — it needs neither Rekognition nor object storage. If the model name is wrong, the error will say so and only the env var needs changing.

---

## 2. Rekognition is not configured

**Severity: high — blocks generation end to end.**

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` are all unset. Rekognition does three jobs in the pipeline:

- moderates the **input** photo and confirms it contains a face;
- moderates the **generated output** before it is ever stored;
- returns the **face box** the cutout crops to.

Without it the job fails at the moderation step, after paying for a generation.

---

## 3. Object storage is not configured, and erasure has never been proven

**Severity: high — this one is on the legal critical path.**

The five `B2_*` variables are unset. Beyond storing generated photos, this is what GDPR erasure and consent withdrawal delete *from*.

Deletion is covered by integration tests, but **against a mock**. It has never run against Backblaze. Before relying on it:

1. Generate a photo so a real object exists.
2. Withdraw consent through the app.
3. Confirm in the Backblaze console that the object is actually gone.
4. Repeat for a GDPR purge.

Until step 3 has been seen, "erasure deletes the file" is an untested claim about someone's personal data.

---

## 4. Cutout framing is tuned against a synthetic

**Severity: low — cosmetic.**

`CARD_FACE_BOX_HEADROOM` (0.65) and `CARD_FACE_BOX_SHOULDERS` (0.85) in `packages/types/src/photo-constants.ts` decide how far a face box grows into head-and-shoulders. They were set against a drawn test image, not a real generation.

The key-out and edge handling are verified visually and are sound. Only the framing numbers want a real photo. They are two constants; no code change.

---

## 4b. A malformed bearer token returns 500, not 401

**Severity: medium — observability, and possibly session recovery.**

Verified 2026-08-12 against the running API: a request carrying an `Authorization: Bearer` header whose signature segment is not valid base64 produces **500 INTERNAL_ERROR**, from a `SyntaxError` thrown inside Clerk's JWT decoder and caught by the generic error handler. It is logged as "Unhandled error", so this pollutes Sentry with what is really a client-side problem.

**What is NOT established:** what a genuinely *expired* Clerk token returns. An expired token is well-formed base64 and would fail verification rather than parsing, so it may well produce a clean 401. This was tested with a deliberately malformed token, which is not the same thing.

Why it matters if expired tokens do not return 401: `apps/mobile/lib/api-client.ts` force-refreshes the token and retries **only on 401**. If an expired session produces anything else, that recovery never fires and the user sees a generic error instead of a silent refresh.

**How to check:** leave a device signed in until the session token expires, then use the app. This is exactly what a device pass is for, and it cannot be established from the test suite — the integration tests mock Clerk, so they assert the behaviour of the mock.

## 5. No Expo Go device pass on anything from Phase 3 onward

**Severity: medium.**

Every screen since Phase 3 — attendance finalization, behaviour reporting, owner trust detail, the Pronos tab, the card photo screen — is verified by typecheck, lint, tests and a successful `expo export`. None has been seen running on a phone.

Before a device pass, check the Mac's LAN IP against `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`; it changes between sessions.

---

## 6. `RELIABLE_CHECK_MIN_SCORE` was chosen, not decided

**Severity: low.**

ADR-019 specifies the 8-match minimum for the public check mark but not the score threshold. `85` in `trust-constants.ts` is an engineering choice: it tolerates a couple of excused absences and a late arrival, but not a no-show. Worth revisiting once there is real attendance data.

---

## 7. Migration `0015_match_first_pivot` has no rehearsal record

**Severity: high if it is ever run against real data.**

Every other migration is additive. `0015` is destructive — it drops `players.group_id`, deletes merged player rows and dedupes four tables. Per ADR-015 a destructive migration needs a restored clone, a preflight report, a backup, validation queries and a tested rollback. None of that exists.

It has only ever run against disposable local databases. It must not touch real data until that record does exist.
