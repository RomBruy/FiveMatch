import {
  RekognitionClient,
  DetectFacesCommand,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition'

export interface RekognitionResult {
  hasFace: boolean
  isFlagged: boolean
  flagReason?: string
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

      const hasFace = (facesResult.FaceDetails?.length ?? 0) > 0
      const flaggedLabels = moderationResult.ModerationLabels ?? []
      const isFlagged = flaggedLabels.length > 0
      const flagReason = isFlagged
        ? flaggedLabels.map((l) => l.Name).join(', ')
        : undefined

      return { hasFace, isFlagged, flagReason }
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
