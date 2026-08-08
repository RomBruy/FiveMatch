import { db } from '../db'
import { cardPhotoJobs, players } from '../db/schema'
import { eq } from 'drizzle-orm'
import * as Sentry from '@sentry/node'
import { createRekognitionClientFromEnv } from '../lib/rekognition'
import { createGeminiClientFromEnv } from '../lib/gemini'
import { cardPhotoKey, createObjectStorageFromEnv } from '../lib/object-storage'
import { fetchSourceImage, ImageFetchError } from '../lib/image-fetch'
import { buildCardCutout } from '../lib/image-cutout'
import { photoConsentService } from '../services/cards/photo-consent.service'

async function transitionJob(
  jobId: string,
  state: 'processing' | 'complete' | 'failed',
  extras?: { photoUrl?: string; errorMessage?: string; storageKey?: string }
) {
  await db
    .update(cardPhotoJobs)
    .set({ state, ...extras, updatedAt: new Date() })
    .where(eq(cardPhotoJobs.id, jobId))
}

export async function processCardGenerationJob(jobId: string): Promise<void> {
  // Transition: pending → processing
  await transitionJob(jobId, 'processing')

  const job = await db
    .select()
    .from(cardPhotoJobs)
    .where(eq(cardPhotoJobs.id, jobId))
    .limit(1)
    .then((rows) => rows[0])

  if (!job) return

  // Consent is re-checked here, not only at the route. A job can sit queued
  // across a withdrawal, and processing a face after the player said stop is
  // exactly what withdrawal is meant to prevent (rule 35).
  const consent = await photoConsentService.getState(job.playerId)
  if (!consent.current) {
    await transitionJob(jobId, 'failed', { errorMessage: 'CONSENT_REQUIRED' })
    return
  }

  const player = await db
    .select({ profilePhotoSourceUrl: players.profilePhotoSourceUrl })
    .from(players)
    .where(eq(players.id, job.playerId))
    .limit(1)
    .then((rows) => rows[0])

  // The source photo, never the generated one. These used to be the same
  // column, so a second generation restyled the already-stylized output.
  const inputPhotoUrl = player?.profilePhotoSourceUrl
  if (!inputPhotoUrl) {
    await transitionJob(jobId, 'failed', { errorMessage: 'NO_INPUT_PHOTO' })
    Sentry.captureMessage('Card generation failed: no input photo', {
      extra: { jobId, playerId: job.playerId, step: 'rekognition' },
    })
    return
  }

  // Fetch input photo bytes under explicit type, size, redirect and timeout
  // limits (rule 40).
  let inputBytes: Buffer
  let inputMimeType: string
  try {
    const fetched = await fetchSourceImage(inputPhotoUrl)
    inputBytes = fetched.bytes
    inputMimeType = fetched.mimeType
  } catch (err) {
    const code = err instanceof ImageFetchError ? err.code : 'FETCH_INPUT_FAILED'
    await transitionJob(jobId, 'failed', { errorMessage: code })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'fetch' } })
    return
  }

  // Step 1: Rekognition — face detection + content moderation
  try {
    const rekognition = createRekognitionClientFromEnv()
    const result = await rekognition.checkImage(inputBytes)
    if (!result.hasFace) {
      await transitionJob(jobId, 'failed', { errorMessage: 'NO_FACE_DETECTED' })
      Sentry.captureMessage('Card generation failed: no face detected', {
        extra: { jobId, playerId: job.playerId, step: 'rekognition' },
      })
      return
    }
    if (result.isFlagged) {
      await transitionJob(jobId, 'failed', { errorMessage: `CONTENT_FLAGGED:${result.flagReason}` })
      Sentry.captureMessage('Card generation failed: content flagged', {
        extra: { jobId, playerId: job.playerId, step: 'rekognition', flagReason: result.flagReason },
      })
      return
    }
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'REKOGNITION_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'rekognition' } })
    return
  }

  // Step 2: Gemini Flash — generate stylized card photo
  let generatedBytes: Buffer
  try {
    const gemini = createGeminiClientFromEnv()
    generatedBytes = await gemini.generateCardPhoto(
      inputBytes.toString('base64'),
      inputMimeType,
    )
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'GEMINI_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'gemini' } })
    return
  }

  // Step 3: moderate the OUTPUT before it is ever stored (rule 40), and take the
  // face box from the same pass.
  //
  // Moderating only the input assumes a generator cannot produce something the
  // source did not contain, which is not a safe assumption about an image model.
  // The box must be measured on the generated image, not the source: the model
  // returns a new rendering whose geometry has nothing to do with the original.
  let generatedFaceBox: { left: number; top: number; width: number; height: number } | undefined
  try {
    const rekognition = createRekognitionClientFromEnv()
    const outputCheck = await rekognition.checkImage(generatedBytes)
    if (outputCheck.isFlagged) {
      await transitionJob(jobId, 'failed', { errorMessage: `OUTPUT_FLAGGED:${outputCheck.flagReason}` })
      Sentry.captureMessage('Card generation failed: generated output flagged', {
        extra: { jobId, playerId: job.playerId, step: 'output-moderation', flagReason: outputCheck.flagReason },
      })
      return
    }
    // A vintage sticker style pulls toward caricature. A portrait with no
    // detectable face is not worth putting on someone's card.
    if (!outputCheck.hasFace) {
      await transitionJob(jobId, 'failed', { errorMessage: 'OUTPUT_NO_FACE' })
      Sentry.captureMessage('Card generation failed: no face in generated output', {
        extra: { jobId, playerId: job.playerId, step: 'output-moderation' },
      })
      return
    }
    generatedFaceBox = outputCheck.faceBox
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'OUTPUT_MODERATION_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'output-moderation' } })
    return
  }

  // Step 4: crop to head and shoulders and knock out the key colour, so what is
  // stored is the cutout the card renders rather than a rectangle with a
  // background behind it.
  let cutoutBytes: Buffer
  try {
    cutoutBytes = await buildCardCutout(generatedBytes, generatedFaceBox)
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'CUTOUT_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'cutout' } })
    return
  }

  // Step 5: Upload to object storage
  const storageKey = cardPhotoKey(jobId)
  let photoUrl: string
  try {
    const storage = createObjectStorageFromEnv()
    photoUrl = await storage.put(storageKey, cutoutBytes, 'image/png')
  } catch (err) {
    await transitionJob(jobId, 'failed', { errorMessage: 'UPLOAD_ERROR' })
    Sentry.captureException(err, { extra: { jobId, playerId: job.playerId, step: 'upload' } })
    return
  }

  // All steps passed — record the key alongside the URL so erasure never has to
  // parse a URL to find the object.
  await db.transaction(async (tx) => {
    await tx.update(cardPhotoJobs)
      .set({ state: 'complete', photoUrl, storageKey, updatedAt: new Date() })
      .where(eq(cardPhotoJobs.id, jobId))
    await tx.update(players)
      .set({ profilePhotoCardUrl: photoUrl })
      .where(eq(players.id, job.playerId))
  })
}
