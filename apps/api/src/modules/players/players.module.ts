import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlayersController],
  providers: [ClerkAuthGuard, PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
