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
    // Rotation stays inside the same session row.
    expect(await db.model('RefreshToken').countDocuments({ userId: user._id })).toBe(1);
    const row = await db.model('RefreshToken').findOne({ userId: user._id });
    expect(claims.sid).toBe(String(row!._id));
  });

  it('keeps one session per login, so a second device does not end the first', async () => {
    const user = await db.model('User').create({ name: 'C', email: 'c@x', password: 'x' });
    const laptop = await auth.generateUserTokens(user._id, 'shop.example');
    const phone = await auth.generateUserTokens(user._id, 'shop.example');

    expect(await db.model('RefreshToken').countDocuments({ userId: user._id })).toBe(2);
    await expect(auth.refreshTokens(laptop.refreshToken, 'shop.example')).resolves.toBeDefined();
    await expect(auth.refreshTokens(phone.refreshToken, 'shop.example')).resolves.toBeDefined();
  });

  it('lets a concurrent caller reuse a just-rotated token and get the current one', async () => {
    const user = await db.model('User').create({ name: 'D', email: 'd@x', password: 'x' });
    const { refreshToken } = await auth.generateUserTokens(user._id, 'shop.example');

    const [first, second] = await Promise.all([
      auth.refreshTokens(refreshToken, 'shop.example'),
      auth.refreshTokens(refreshToken, 'shop.example'),
    ]);
    expect(first.refreshToken).toBe(second.refreshToken);
    expect(first.refreshToken).not.toBe(refreshToken);
  });

  it('refuses a rotated token once the grace window has passed', async () => {
    const user = await db.model('User').create({ name: 'E', email: 'e@x', password: 'x' });
    const { refreshToken } = await auth.generateUserTokens(user._id, 'shop.example');
    await auth.refreshTokens(refreshToken, 'shop.example');
    await db.model('RefreshToken').updateOne(
      { userId: user._id },
      { $set: { previousValidUntil: new Date(Date.now() - 1000) } },
    );
    await expect(auth.refreshTokens(refreshToken, 'shop.example')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout ends only the calling session', async () => {
    const user = await db.model('User').create({ name: 'F', email: 'f@x', password: 'x' });
    const laptop = await auth.generateUserTokens(user._id, 'shop.example');
    const phone = await auth.generateUserTokens(user._id, 'shop.example');

    await auth.logout(String(user._id), jwt.verify(laptop.accessToken).sid);
    await expect(auth.refreshTokens(laptop.refreshToken, 'shop.example')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(auth.refreshTokens(phone.refreshToken, 'shop.example')).resolves.toBeDefined();
  });

  it('refuses a token whose user no longer exists', async () => {
    const user = await db.model('User').create({ name: 'B', email: 'b@x', password: 'x' });
    const { refreshToken } = await auth.generateUserTokens(user._id, 'shop.example');
    await db.model('User').deleteOne({ _id: user._id });
    await expect(auth.refreshTokens(refreshToken, 'shop.example')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
