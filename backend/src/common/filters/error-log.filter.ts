import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';
import { Error as MongooseError } from 'mongoose';
import { TenantConnectionService } from '../helpers/dynamic-connection';
import { MongoErrorFilter } from './mongo-error.filter';

/**
 * Records server errors (5xx) and conflicts (409) for the platform dashboard's error page, then
 * answers exactly as MongoErrorFilter does. Logging is best effort: a failure
 * to log never changes or delays the response.
 */
@Catch()
export class ErrorLogFilter extends MongoErrorFilter {
  private readonly logger = new Logger(ErrorLogFilter.name);

  constructor(
    httpAdapter: AbstractHttpAdapter,
    private readonly tenants: TenantConnectionService,
  ) {
    super(httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') this.record(exception, host);
    return super.catch(exception, host);
  }

  private record(exception: unknown, host: ArgumentsHost): void {
    try {
      const statusCode = statusOf(exception);
      if (statusCode < 500 && statusCode !== 409) return;
      const registry = this.tenants.findRegistry();
      if (!registry) return;

      const req = host.switchToHttp().getRequest();
      const path: string = (req.originalUrl ?? req.url ?? '').split('?')[0];
      const error = exception instanceof Error ? exception : new Error(String(exception));
      void registry.errors
        .record({
          host: path.startsWith('/platform') ? 'platform' : String(req.tenant ?? req.hostname ?? 'unknown'),
          method: req.method,
          route: maskIds(path),
          statusCode,
          name: error.name,
          message: error.message || 'Unknown error',
          stack: error.stack,
        })
        .catch((e: Error) => this.logger.warn(`Could not log error: ${e.message}`));
    } catch (e) {
      this.logger.warn(`Could not log error: ${(e as Error).message}`);
    }
  }
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (exception instanceof MongooseError.CastError) return 400;
  if (typeof exception === 'object' && exception !== null && (exception as { code?: unknown }).code === 11000) return 409;
  return 500;
}

/** `/orders/65f0…` → `/orders/:id`, so every order's failure is one group. */
function maskIds(path: string): string {
  return path
    .split('/')
    .map((seg) => (/^[0-9a-f]{24}$/i.test(seg) || /^\d+$/.test(seg) || /^[0-9a-f-]{36}$/i.test(seg) ? ':id' : seg))
    .join('/');
}
