import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { GroupsModule } from './modules/groups/groups.module';
import { HealthModule } from './modules/health/health.module';
import { PlayersModule } from './modules/players/players.module';
import { RatingsModule } from './modules/ratings/ratings.module';

@Module({
  imports: [
    AuthModule,
    GroupsModule,
    HealthModule,
    PlayersModule,
    RatingsModule,
  ],
})
export class AppModule {}
