import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Every error response, from every module, has this exact shape. Frontend
 * clients (web/mobile) can rely on `error.code` for programmatic handling
 * instead of parsing message strings.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : null;

    const body: ErrorBody = {
      success: false,
      error: {
        code: isHttp ? (HttpStatus[status] ?? 'HTTP_ERROR') : 'INTERNAL_ERROR',
        message:
          extractMessage(payload) ??
          (exception instanceof Error ? exception.message : 'Unexpected error'),
        details:
          isHttp && typeof payload === 'object'
            ? (payload as Record<string, unknown>)['details']
            : undefined,
      },
    };

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json(body);
  }
}

function extractMessage(payload: unknown): string | undefined {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = payload.message;
    return Array.isArray(message) ? message.join('; ') : String(message);
  }
  return undefined;
}
