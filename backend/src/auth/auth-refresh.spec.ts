import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { startReplSet, tenantConnection } from '../../test/helpers/replset';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { RefreshToken } from './schemas/refresh-schema.schema';
import { Otp } from './schemas/otp.schema';
import { ResetToken } from './schemas/reset-token.schema';

jest.setTimeout(120_000);

describe('AuthService.refreshTokens', () => {
  let replSet: MongoMemoryReplSet;
  let db: Connection;
  let auth: AuthService;
  const jwt = new JwtService({ secret: 'test-secret' });

  beforeAll(async () => {
    replSet = await startReplSet();
    db = await tenantConnection(replSet, 'shop');
    auth = new AuthService(
      db.model<User>(User.name),
      db.model<RefreshToken>(RefreshToken.name),
      db.model<Otp>(Otp.name),
      db.model<ResetToken>(ResetToken.name),
      jwt,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  afterAll(async () => {
    await db?.close();
    await replSet?.stop();
  });

  it('signs the new access token for the user, not the token row', async () => {
    const user = await db.model('User').create({ name: 'A', email: 'a@x', password: 'x' });
    const { refreshToken } = await auth.generateUserTokens(user._id, 'shop.example');

    const { accessToken } = await auth.refreshTokens(refreshToken, 'shop.example');
    const claims = jwt.verify(accessToken);
    expect(claims.userId).toBe(String(user._id));
    expect(claims.tenant).toBe('shop.example');
    // The rotated token still belongs to the same user, and only one row exists.
    expect(await db.model('RefreshToken').countDocuments({ userId: user._id })).toBe(1);
  });

  it('refuses a token whose user no longer exists', async () => {
    const user = await db.model('User').create({ name: 'B', email: 'b@x', password: 'x' });
    const { refreshToken } = await auth.generateUserTokens(user._id, 'shop.example');
    await db.model('User').deleteOne({ _id: user._id });
    await expect(auth.refreshTokens(refreshToken, 'shop.example')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
