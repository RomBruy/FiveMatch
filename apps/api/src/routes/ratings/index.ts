import { Router } from 'express'
import { ErrorCode } from '@fivematch/types'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'

const router = Router({ mergeParams: true })

// Initial crew ratings are intentionally disabled in Phase 1. Existing rows are
// retained for audit history, but no new group-scoped identity signal may enter
// the global player profile or OVR inputs.
router.post(
  '/initial',
  requireGroupMember,
  asyncHandler(async (_req, res) => res.status(410).json({
    error: {
      code: ErrorCode.INITIAL_RATINGS_DISABLED,
      message: 'Initial crew ratings are disabled',
      statusCode: 410,
    },
  })),
)

// Keep the legacy read endpoint non-blocking while old mobile clients age out.
router.get(
  '/initial/pending',
  requireGroupMember,
  asyncHandler(async (_req, res) => res.json({
    data: { items: [], total: 0, rated: 0, disabled: true },
  })),
)

export default router
