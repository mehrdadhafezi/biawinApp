import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface SuccessBody<T> {
  success: true;
  data: T;
}

/** Wraps every successful controller return value as `{ success: true, data }`. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  SuccessBody<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessBody<T>> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
