import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  MyInitialPeerRatingsResponse,
  SubmitInitialPeerRatingInput,
  SubmitInitialPeerRatingResponse,
  UpdateInitialPeerRatingInput,
  UpdateInitialPeerRatingResponse,
} from '@fit-five/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { serializeInitialPeerRating } from './initial-peer-rating.presenter';
import { RatingsService } from './ratings.service';

@Controller('groups/:groupId/initial-peer-ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async listMyInitialPeerRatings(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
  ): Promise<MyInitialPeerRatingsResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const ratings = await this.ratingsService.listMyInitialPeerRatings(
      request.auth.clerkUserId,
      groupId,
    );

    return {
      data: {
        ratings: ratings.map(serializeInitialPeerRating),
      },
    };
  }

  @Post()
  @UseGuards(ClerkAuthGuard)
  async submitInitialPeerRating(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() body: SubmitInitialPeerRatingInput,
  ): Promise<SubmitInitialPeerRatingResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const rating = await this.ratingsService.submitInitialPeerRating(
      request.auth.clerkUserId,
      groupId,
      {
        ratedPlayerId: body.ratedPlayerId,
        values: body.values ?? {},
      },
    );

    return {
      data: {
        rating: serializeInitialPeerRating(rating),
      },
    };
  }

  @Put(':ratingId')
  @UseGuards(ClerkAuthGuard)
  async updateInitialPeerRating(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('ratingId') ratingId: string,
    @Body() body: UpdateInitialPeerRatingInput,
  ): Promise<UpdateInitialPeerRatingResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const rating = await this.ratingsService.updateInitialPeerRating(
      request.auth.clerkUserId,
      groupId,
      ratingId,
      {
        values: body.values ?? {},
      },
    );

    return {
      data: {
        rating: serializeInitialPeerRating(rating),
      },
    };
  }
}
