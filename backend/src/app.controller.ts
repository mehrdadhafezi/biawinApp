import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { AppService } from './app.service';

/** Infra-only endpoint (Docker healthcheck, load balancer probes) — not versioned, not in Swagger. */
@ApiExcludeController()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  health() {
    return this.appService.getHealth();
  }
}
