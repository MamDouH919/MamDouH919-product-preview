import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import { Observable, tap } from 'rxjs';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission } from '../roles/dto/role.dto';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { User } from '../auth/schemas/user.schema';
import { ActivityLog } from './schemas/activity-log.schema';
import { ACTIVITY_LOG_KEY, ActivityLogOptions } from './activity-log.decorator';

const WRITE_METHODS: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };
/** Never listed, even by name — a field called "password" is still telling. */
const SENSITIVE = /pass|token|secret|otp|key/i;
/** How long an admin's name is reused before it's looked up again. */
const NAME_CACHE_MS = 5 * 60 * 1000;

type AdminRequest = Request & { userId?: string; tenant?: string };

/**
 * Records every successful change an admin makes. Global and after the
 * guards, so `req.userId` is already the verified admin; customer and public
 * routes never set it and are never logged. Writing is fire-and-forget — the
 * log must never slow down or fail the action it describes.
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);
  private readonly names = new Map<string, { name?: string; email?: string; at: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly tenants: TenantConnectionService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const action = WRITE_METHODS[req.method];
    if (!action) return next.handle();

    const targets = [context.getHandler(), context.getClass()];
    const options = this.reflector.getAllAndOverride<ActivityLogOptions | undefined>(ACTIVITY_LOG_KEY, targets);
    const permissions = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets);

    return next.handle().pipe(
      tap((result) => {
        if (!req.userId || options?.skip || (options?.when && !options.when(req))) return;
        void this.write(req, result, {
          resource: permissions?.[0]?.resource ?? this.resourceFromPath(req),
          action,
        });
      }),
    );
  }

  private async write(req: AdminRequest, result: unknown, what: { resource: string; action: string }) {
    try {
      const host = req.tenant ?? req.hostname;
      const conn = await this.tenants.getConnection(host);
      const user = await this.userInfo(host, req.userId!, conn.model<User>(User.name));
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;

      await conn.model<ActivityLog>(ActivityLog.name).create({
        user: req.userId,
        userName: user.name,
        userEmail: user.email,
        resource: what.resource,
        action: what.action,
        method: req.method,
        path: `${req.baseUrl ?? ''}${req.route?.path ?? req.path}`,
        entityId: this.entityId(req, result),
        entityLabel: this.entityLabel(result),
        fields: Object.keys(body).filter((k) => !SENSITIVE.test(k)).slice(0, 30),
        ip: req.ip,
      });
    } catch (error) {
      this.logger.warn(`Activity not logged for ${req.method} ${req.path}: ${(error as Error).message}`);
    }
  }

  private async userInfo(host: string, userId: string, model: Model<User>) {
    const key = `${host}:${userId}`;
    const cached = this.names.get(key);
    if (cached && Date.now() - cached.at < NAME_CACHE_MS) return cached;
    const user = await model.findById(userId).select('name email').lean().exec();
    const info = { name: user?.name, email: user?.email, at: Date.now() };
    this.names.set(key, info);
    return info;
  }

  private resourceFromPath(req: Request): string {
    return (req.route?.path ?? req.path).split('/').filter(Boolean)[0] ?? 'unknown';
  }

  private entityId(req: Request, result: unknown): string | undefined {
    const param = req.params?.id ?? Object.values(req.params ?? {})[0];
    if (param) return String(param);
    const id = (result as { _id?: unknown } | null)?._id;
    return id ? String(id) : undefined;
  }

  /** The most human handle the response offers. */
  private entityLabel(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const r = result as Record<string, any>;
    const localized = (f: any) => (f && typeof f === 'object' ? f.en || f.ar : typeof f === 'string' ? f : undefined);
    const label =
      (r.returnNumber && `Return #${r.returnNumber}`) ||
      (r.orderNumber && `#${r.orderNumber}`) ||
      r.code ||
      localized(r.name) ||
      localized(r.title) ||
      localized(r.sectionName) ||
      r.email ||
      r.slug;
    return label ? String(label).slice(0, 200) : undefined;
  }
}
