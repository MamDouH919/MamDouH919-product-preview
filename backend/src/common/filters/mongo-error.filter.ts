import { ArgumentsHost, BadRequestException, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Error as MongooseError } from 'mongoose';

/**
 * Database errors that are really the client's fault, answered as such
 * instead of a 500:
 * - a malformed id (`/products/bad-id`) → 400
 * - a duplicate unique key (a slug or code already in use) → 409
 * Everything else falls through to Nest's default handling.
 */
@Catch()
export class MongoErrorFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof MongooseError.CastError) {
      return super.catch(new BadRequestException(`Invalid ${exception.path}: "${String(exception.value)}"`), host);
    }
    if (isDuplicateKey(exception)) {
      const field = Object.keys(exception.keyValue ?? exception.keyPattern ?? {})[0];
      const value = field ? exception.keyValue?.[field] : undefined;
      return super.catch(
        new ConflictException(field ? `${field} "${value}" is already in use` : 'This record already exists'),
        host,
      );
    }
    return super.catch(exception, host);
  }
}

function isDuplicateKey(
  error: unknown,
): error is { code: number; keyValue?: Record<string, unknown>; keyPattern?: Record<string, unknown> } {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}
