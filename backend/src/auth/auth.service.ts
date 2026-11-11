import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SignupDto } from './dtos/signup.dto';
import { User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dtos/login.dto';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from './schemas/refresh-schema.schema';
import { v4 as uuidv4 } from 'uuid';
import { Otp } from './schemas/otp.schema';
import { MailService } from '../mail/mail.service';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { ResendOtpDto } from './dtos/resend-otp.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ForgotPasswordDto } from './dtos/forget-password.dto';
import { nanoid } from 'nanoid';
import { ResetToken } from './schemas/reset-token.schema';
import { RolesService } from '../roles/roles.service';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';

const ACCESS_TOKEN_TTL = '12h';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** How long a just-rotated refresh token is still accepted (concurrent tabs). */
const REFRESH_GRACE_MS = 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private UserModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    @InjectModel(Otp.name) private OtpModel: Model<Otp>,
    @InjectModel(ResetToken.name)
    private ResetTokenModel: Model<ResetToken>,
    private JwtService: JwtService,
    private mailService: MailService,
    private rolesService: RolesService,
    private tenantConnection: TenantConnectionService,
  ) { }

  async create(createAuthDto: SignupDto) {
    const { email, password, name } = createAuthDto;
    // Check if email is already in use by a verified user
    const existingUser = await this.UserModel.findOne({ email });
    if (existingUser && existingUser.isVerified) {
      throw new BadRequestException('Email already in use');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or update unverified user
    if (existingUser) {
      await this.UserModel.updateOne({ email }, { $set: { name, password: hashedPassword } });
    } else {
      await this.UserModel.create({ email, password: hashedPassword, name });
    }

    // Generate and send OTP
    const otp = this.generateOtp();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 5);

    // Remove any existing OTP for this email
    await this.OtpModel.deleteMany({ email });

    // Store OTP
    await this.OtpModel.create({ email, otp, expiryDate });

    // Send OTP via email
    await this.mailService.sendOtp(email, otp);

    return { message: 'OTP sent to your email' };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const otpRecord = await this.OtpModel.findOne({
      email,
      otp,
      expiryDate: { $gte: new Date() },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark user as verified
    await this.UserModel.updateOne({ email }, { $set: { isVerified: true } });

    // Clean up OTP records
    await this.OtpModel.deleteMany({ email });

    return { message: 'Email verified successfully' };
  }

  async resendOtp(resendOtpDto: ResendOtpDto) {
    const { email } = resendOtpDto;

    // Check if there is a pending OTP record for this email
    const existingOtp = await this.OtpModel.findOne({ email });
    if (!existingOtp) {
      throw new BadRequestException('No pending signup found for this email');
    }

    // Generate new OTP and expiry
    const otp = this.generateOtp();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 5);

    // Update with new OTP
    await this.OtpModel.updateOne({ email }, { $set: { otp, expiryDate } });

    // Send new OTP via email
    await this.mailService.sendOtp(email, otp);

    return { message: 'New OTP sent to your email' };
  }

  async login(createAuthDto: LoginDto, tenant: string) {
    const { email, password } = createAuthDto;
    const user = await this.UserModel.findOne({ email });

    console.log({ email, password });
    
    if (!user) {
      throw new BadRequestException('wrong credentials');
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new BadRequestException('wrong credentials');
    }

    if (!user.isVerified) {
      throw new BadRequestException({
        message: 'Email not verified',
        errorCode: 'EMAIL_NOT_VERIFIED',
      });
    }

    const tokens = await this.generateUserTokens(user._id, tenant);

    return {
      ...tokens,
      user,
    };
  }

  async refreshTokens(refreshToken: string, tenant: string) {
    const now = new Date();
    const session = await this.RefreshTokenModel.findOne({
      expiryDate: { $gte: now },
      $or: [
        { token: refreshToken },
        { previousToken: refreshToken, previousValidUntil: { $gte: now } },
      ],
    });

    if (!session) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    // The token row's own `_id` is not the user — signing with it gave an
    // access token whose every permission lookup failed.
    if (!(await this.UserModel.exists({ _id: session.userId }))) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    if (session.token === refreshToken) {
      // Rotate atomically: only succeeds if nobody rotated it in the meantime.
      const next = uuidv4();
      const rotated = await this.RefreshTokenModel.updateOne(
        { _id: session._id, token: refreshToken },
        {
          $set: {
            token: next,
            expiryDate: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
            previousToken: refreshToken,
            previousValidUntil: new Date(Date.now() + REFRESH_GRACE_MS),
          },
        },
      );
      if (rotated.modifiedCount === 1) {
        return {
          accessToken: this.signAccessToken(session.userId, tenant, session._id),
          refreshToken: next,
        };
      }
    }

    // A concurrent refresh rotated this token first: hand back the current one
    // instead of rotating again, which would strand the other caller.
    const current = await this.RefreshTokenModel.findOne({
      _id: session._id,
      previousToken: refreshToken,
      previousValidUntil: { $gte: new Date() },
    });
    if (!current) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }
    return {
      accessToken: this.signAccessToken(current.userId, tenant, current._id),
      refreshToken: current.token,
    };
  }

  async changePassword(userId, newPassword: string, oldPassword: string) {
    const user = await this.UserModel.findOne({ _id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordCorrect) {
      throw new BadRequestException('Wrong password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return { message: 'Password changed successfully' };
  }

  async forgetPassword(email: string, host: string) {
    const user = await this.UserModel.findOne({ email });
    if (user) {
      const resetToken = nanoid(64);
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      await this.ResetTokenModel.create({
        userId: user._id,
        token: resetToken,
        expiryDate,
      });

      // Build the reset link against the tenant's own frontend so the email
      // points users back to the site they signed up on.
      const frontendUrl = this.tenantConnection.getFrontendUrl(host);
      // Swallow mail failures: an error only for known emails would reveal
      // which addresses have accounts.
      await this.mailService
        .sendResetPasswordLink(email, resetToken, frontendUrl)
        .catch((error: Error) =>
          Logger.warn(`Reset email not sent — ${error.message}`, AuthService.name),
        );
    }

    return { message: 'If the email exists, a password reset link will be sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.ResetTokenModel.findOne({
      token,
      expiryDate: { $gte: new Date() },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.UserModel.updateOne(
      { _id: resetToken.userId },
      { $set: { password: hashedPassword } },
    );

    await this.ResetTokenModel.deleteMany({ userId: resetToken.userId });
    // A password reset signs the user out everywhere.
    await this.RefreshTokenModel.deleteMany({ userId: resetToken.userId });

    return { message: 'Password reset successfully' };
  }

  /** A fresh login: opens a new session (one per device) and issues its tokens. */
  async generateUserTokens(userId, tenant: string) {
    const refreshToken = uuidv4();
    const session = await this.RefreshTokenModel.create({
      token: refreshToken,
      userId,
      expiryDate: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });
    return {
      accessToken: this.signAccessToken(userId, tenant, session._id),
      refreshToken,
    };
  }

  private signAccessToken(userId, tenant: string, sid) {
    return this.JwtService.sign(
      { userId: String(userId), tenant, sid: String(sid) },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** Ends the caller's session only; tokens issued before sessions existed end every session. */
  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.RefreshTokenModel.deleteOne({ _id: sessionId, userId });
    } else {
      await this.RefreshTokenModel.deleteMany({ userId });
    }
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.UserModel.findById(userId).select('-password').exec();
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async getUserPermissions(userId: string) {
    const user = await this.UserModel.findOne({ _id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const role = await this.rolesService.getRoleById(user.roleId.toString());
    return role?.permissions;
  }
}
