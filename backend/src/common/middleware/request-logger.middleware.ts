import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Minimal structured request logger — the seed for a real observability
 * stack (see docs/01-architecture.md "Logging & Monitoring" and
 * docs/07-security.md). Swapping `Logger` for `nestjs-pino` (JSON logs) and
 * adding a Sentry/OpenTelemetry exporter later does not require touching
 * call sites, only this file and main.ts.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`,
      );
    });
    next();
  }
}
