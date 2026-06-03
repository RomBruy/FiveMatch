import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [ClerkAuthGuard],
})
export class AuthModule {}
