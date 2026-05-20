import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthService } from '../auth/auth.service';
import { Permission } from '../roles/dto/role.dto';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector, private authService: AuthService) { }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request.userId) {
      throw new UnauthorizedException('User Id not found');
    }

    const routePermissions: Permission[] = this.reflector.getAllAndOverride(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )

    try {
      const userPermissions = await this.authService.getUserPermissions(request.userId);
      for (const routePermission of routePermissions) {
        const userPermission = userPermissions?.find(userPermission =>
          userPermission.resource === routePermission.resource);

        if (!userPermission) {
          throw new ForbiddenException();
        }
        const allActionAvailable = routePermission.actions.every(
          (requiredAction) => userPermission.actions.includes(requiredAction),
        )

        if (!allActionAvailable) {
          throw new ForbiddenException();
        }
      }
    } catch (error) {
      throw new ForbiddenException();
    }
    return true;
  }
}