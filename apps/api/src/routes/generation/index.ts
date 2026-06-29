import { Router } from 'express'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'
import { teamGeneratorService } from '../../services/matches/team-generator.service'

const router = Router({ mergeParams: true })

router.get(
  '/status',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }
    const status = await teamGeneratorService.getStatus(groupId)
    return res.json({ data: status })
  }),
)

export default router
