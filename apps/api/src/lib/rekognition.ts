import {
  RekognitionClient,
  DetectFacesCommand,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition'

export interface RekognitionResult {
  hasFace: boolean
  isFlagged: boolean
  flagReason?: string
  /**
   * The largest detected face, as fractions of image width/height.
   *
   * Returned so the cutout can crop to the subject. It must come from whichever
   * image is being cropped: a box measured on the source photo does not map onto
   * a freshly generated portrait, which is a different rendering entirely.
   */
  faceBox?: { left: number; top: number; width: number; height: number }
}

export interface RekognitionChecker {
  checkImage(imageBytes: Buffer): Promise<RekognitionResult>
}

export function createRekognitionClient(region: string, credentials: {
  accessKeyId: string
  secretAccessKey: string
}): RekognitionChecker {
  const client = new RekognitionClient({ region, credentials })

  return {
    async checkImage(imageBytes: Buffer): Promise<RekognitionResult> {
      const image = { Bytes: imageBytes }

      const [facesResult, moderationResult] = await Promise.all([
        client.send(new DetectFacesCommand({ Image: image })),
        client.send(new DetectModerationLabelsCommand({ Image: image, MinConfidence: 75 })),
      ])

      const faces = facesResult.FaceDetails ?? []
      const hasFace = faces.length > 0
      const flaggedLabels = moderationResult.ModerationLabels ?? []
      const isFlagged = flaggedLabels.length > 0
      const flagReason = isFlagged
        ? flaggedLabels.map((l) => l.Name).join(', ')
        : undefined

      // Largest face wins — a bystander in the background should not decide the
      // crop when the subject is the person in front.
      const largest = faces
        .map((face) => face.BoundingBox)
        .filter((box): box is NonNullable<typeof box> => Boolean(box))
        .sort((a, b) => ((b.Width ?? 0) * (b.Height ?? 0)) - ((a.Width ?? 0) * (a.Height ?? 0)))[0]

      const faceBox = largest && largest.Left != null && largest.Top != null
        && largest.Width != null && largest.Height != null
        ? { left: largest.Left, top: largest.Top, width: largest.Width, height: largest.Height }
        : undefined

      return { hasFace, isFlagged, flagReason, faceBox }
    },
  }
}

export function createRekognitionClientFromEnv(): RekognitionChecker {
  const region = process.env.AWS_REGION ?? 'eu-west-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) throw new Error('AWS credentials not set')
  return createRekognitionClient(region, { accessKeyId, secretAccessKey })
}
