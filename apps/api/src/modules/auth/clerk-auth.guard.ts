import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const jwtKey = process.env.CLERK_JWT_KEY;
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!jwtKey && !secretKey) {
      throw new UnauthorizedException('Clerk verification is not configured.');
    }

    try {
      const verifiedToken = await verifyToken(token, {
        jwtKey,
        secretKey,
      });

      if (typeof verifiedToken.sub !== 'string') {
        throw new UnauthorizedException('Invalid Clerk token subject.');
      }

      request.auth = {
        clerkUserId: verifiedToken.sub,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Token not verified.');
    }
  }

  private extractBearerToken(request: AuthenticatedRequest): string | null {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    return authorization.slice('Bearer '.length).trim();
  }
}
