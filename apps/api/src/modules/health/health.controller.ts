import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@fit-five/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      data: {
        status: 'ok',
      },
    };
  }
}
