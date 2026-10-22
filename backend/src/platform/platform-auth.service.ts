import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PLATFORM_TOKEN_TYPE } from '../guards/platform-auth.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';

/** Compared against when the email is wrong, so both failures take as long. */
const DUMMY_HASH = '$2b$12$y3MA4xA.R8EnpR7SXLZJsetojWPU0YI.8so32dIZrj6fkk1pF0cEK';

/**
 * The platform admin is one account set in the environment: PLATFORM_ADMIN_EMAIL
 * and PLATFORM_ADMIN_PASSWORD_HASH (bcrypt). It belongs to no store.
 */
@Injectable()
export class PlatformAuthService {
  constructor(private jwtService: JwtService) {}

  async login({ email, password }: PlatformLoginDto) {
    const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
    const adminHash = process.env.PLATFORM_ADMIN_PASSWORD_HASH?.trim();
    if (!adminEmail || !adminHash) {
      throw new ServiceUnavailableException('Platform admin is not configured');
    }

    const emailMatches = email.trim().toLowerCase() === adminEmail;
    const passwordMatches = await bcrypt.compare(password, emailMatches ? adminHash : DUMMY_HASH);
    if (!emailMatches || !passwordMatches) {
      throw new UnauthorizedException('Wrong credentials');
    }

    return {
      accessToken: this.jwtService.sign({ type: PLATFORM_TOKEN_TYPE, sub: adminEmail }, { expiresIn: '8h' }),
      email: adminEmail,
    };
  }
}
