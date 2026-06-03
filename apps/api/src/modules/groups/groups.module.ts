import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { InvitationsController } from './invitations.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GroupsController, InvitationsController],
  providers: [ClerkAuthGuard, GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
