import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { GroupsModule } from './modules/groups/groups.module';
import { HealthModule } from './modules/health/health.module';
import { PlayersModule } from './modules/players/players.module';

@Module({
  imports: [AuthModule, GroupsModule, HealthModule, PlayersModule],
})
export class AppModule {}
