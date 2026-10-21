import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { RefreshToken } from './schemas/refresh-schema.schema';
import { Otp } from './schemas/otp.schema';
import { ResetToken } from './schemas/reset-token.schema';
import { MailService } from '../mail/mail.service';
import { RolesService } from '../roles/roles.service';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ...[User, RefreshToken, Otp, ResetToken].map((schema) => ({
          provide: getModelToken(schema.name),
          useValue: {},
        })),
        { provide: JwtService, useValue: {} },
        { provide: MailService, useValue: {} },
        { provide: RolesService, useValue: {} },
        { provide: TenantConnectionService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
