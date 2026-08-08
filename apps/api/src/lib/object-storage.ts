import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'

/**
 * Generated-photo storage.
 *
 * Deletion lives here rather than inline in the generation job because erasure
 * has two callers that are nothing to do with generating: consent withdrawal
 * and GDPR purge. Before Phase 5 there was no delete path at all — purging a
 * user removed their job rows and left the images in the bucket indefinitely,
 * which is the kind of leftover an erasure request is specifically about.
 */

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<string>
  /** Best-effort; returns how many keys the provider accepted. */
  deleteMany(keys: string[]): Promise<number>
  publicUrl(key: string): string
}

export function createObjectStorage(config: {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl: string
}): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return {
    publicUrl: (key) => `${config.publicUrl}/${key}`,

    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }))
      return `${config.publicUrl}/${key}`
    },

    async deleteMany(keys) {
      if (keys.length === 0) return 0
      // 1000 is the provider's per-request ceiling.
      let deleted = 0
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000)
        await client.send(new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }))
        deleted += batch.length
      }
      return deleted
    },
  }
}

export function createObjectStorageFromEnv(): ObjectStorage {
  const endpoint = process.env.B2_ENDPOINT
  const bucket = process.env.B2_BUCKET_NAME
  const accessKeyId = process.env.B2_KEY_ID
  const secretAccessKey = process.env.B2_APP_KEY
  const publicUrl = process.env.B2_PUBLIC_URL

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error('Object storage environment is not fully configured')
  }

  return createObjectStorage({ endpoint, bucket, accessKeyId, secretAccessKey, publicUrl })
}

/** The single place that decides where a generated photo lives. */
export function cardPhotoKey(jobId: string): string {
  return `card-photos/${jobId}.png`
}
