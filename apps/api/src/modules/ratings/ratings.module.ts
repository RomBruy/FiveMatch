import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [PrismaModule],
  controllers: [RatingsController],
  providers: [RatingsService, ClerkAuthGuard],
})
export class RatingsModule {}
