import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import { ConfigService } from '@nestjs/config';
import { Customer } from '../customers/schemas/customer.schema';
import {
  CustomerRefreshToken,
  CustomerResetToken,
} from './schemas/customer-token.schema';
import {
  CustomerChangePasswordDto,
  CustomerLoginDto,
  CustomerRegisterDto,
} from './dto/customer-auth.dto';
import { MailService } from '../mail/mail.service';
import { TenantConnectionService } from '../common/helpers/dynamic-connection';
import { CUSTOMER_TOKEN_TYPE } from '../guards/customer-auth.guard';

/** How long a guest's "activate your account" link stays usable. */
const ACTIVATION_DAYS = 7;

const ACTIVATION_COPY = {
  en: {
    subject: 'Activate your account',
    title: 'Your account is almost ready',
    body: 'Set a password to track your orders and check out faster next time.',
    button: 'Activate account',
    expiry: `This link expires in ${ACTIVATION_DAYS} days.`,
  },
  ar: {
    subject: 'فعّل حسابك',
    title: 'حسابك جاهز تقريبًا',
    body: 'عيّن كلمة مرور لمتابعة طلباتك وإتمام الشراء أسرع في المرة القادمة.',
    button: 'تفعيل الحساب',
    expiry: `تنتهي صلاحية هذا الرابط خلال ${ACTIVATION_DAYS} أيام.`,
  },
};

@Injectable()
export class CustomerAuthService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(CustomerRefreshToken.name)
    private refreshTokenModel: Model<CustomerRefreshToken>,
    @InjectModel(CustomerResetToken.name)
    private resetTokenModel: Model<CustomerResetToken>,
    private jwtService: JwtService,
    private mailService: MailService,
    private tenantConnection: TenantConnectionService,
    private configService: ConfigService,
  ) {}

  async register(dto: CustomerRegisterDto, tenant: string) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.customerModel.findOne({ email }).exec();
    if (existing?.isGuest) {
      // A guest checkout already made this record. Setting a password here
      // would hand its orders and addresses to whoever typed the email, so the
      // owner has to prove it through their inbox instead.
      await this.sendActivationEmail(existing, tenant, dto.locale);
      throw new ConflictException({
        message:
          "You've ordered with this email before. We sent you a link to activate your account.",
        code: 'activation_sent',
      });
    }
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const customer = await this.customerModel.create({
      name: dto.name,
      email,
      phone: dto.phone,
      password: await bcrypt.hash(dto.password, 10),
    });

    // Signing in straight away — email verification is not required to order.
    const tokens = await this.generateTokens(customer._id as Types.ObjectId, tenant);
    return { ...tokens, customer: this.sanitize(customer) };
  }

  async login(dto: CustomerLoginDto, tenant: string) {
    const customer = await this.customerModel
      .findOne({ email: dto.email.toLowerCase().trim() })
      .exec();

    // Same message either way, so the response cannot be used to discover
    // which email addresses are registered.
    // A guest has no password, so it fails the same way as a wrong one.
    if (
      !customer?.password ||
      !(await bcrypt.compare(dto.password, customer.password))
    ) {
      throw new BadRequestException('wrong credentials');
    }

    if (!customer.isActive) {
      throw new UnauthorizedException('This account has been disabled');
    }

    const tokens = await this.generateTokens(customer._id as Types.ObjectId, tenant);
    return { ...tokens, customer: this.sanitize(customer) };
  }

  async refreshTokens(refreshToken: string, tenant: string) {
    const stored = await this.refreshTokenModel
      .findOne({ token: refreshToken, expiryDate: { $gte: new Date() } })
      .exec();

    if (!stored) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    const customer = await this.customerModel.findById(stored.customerId).exec();
    if (!customer || !customer.isActive) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    return this.generateTokens(stored.customerId, tenant);
  }

  async logout(customerId: string) {
    await this.refreshTokenModel.deleteMany({ customerId }).exec();
    return { message: 'Logged out successfully' };
  }

  async changePassword(customerId: string, dto: CustomerChangePasswordDto) {
    const customer = await this.customerModel.findById(customerId).exec();
    if (!customer) throw new BadRequestException('Customer not found');

    if (
      !customer.password ||
      !(await bcrypt.compare(dto.oldPassword, customer.password))
    ) {
      throw new BadRequestException('Wrong password');
    }

    customer.password = await bcrypt.hash(dto.newPassword, 10);
    await customer.save();

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string, host: string) {
    const customer = await this.customerModel
      .findOne({ email: email.toLowerCase().trim() })
      .exec();

    if (customer) {
      const token = nanoid(64);
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      await this.resetTokenModel.create({
        customerId: customer._id,
        token,
        expiryDate,
      });

      // Point the link at the tenant's own storefront, so a reset requested on
      // one shop can never land the customer on another.
      const frontendUrl = this.tenantConnection.getFrontendUrl(host);
      // Swallow mail failures: an error only for known emails would reveal
      // which addresses have accounts.
      await this.mailService
        .sendResetPasswordLink(customer.email, token, frontendUrl, 'account/reset-password')
        .catch((error: Error) =>
          Logger.warn(`Reset email not sent — ${error.message}`, CustomerAuthService.name),
        );
    }

    // Always the same response — see login.
    return { message: 'If the email exists, a password reset link will be sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.resetTokenModel
      .findOne({ token, expiryDate: { $gte: new Date() } })
      .exec();

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.customerModel
      .updateOne(
        { _id: resetToken.customerId },
        {
          $set: {
            password: await bcrypt.hash(newPassword, 10),
            // Following an emailed link proves the inbox, which is all a guest
            // record was waiting for.
            isGuest: false,
            isVerified: true,
          },
        },
      )
      .exec();

    await this.resetTokenModel.deleteMany({ customerId: resetToken.customerId }).exec();
    // A password change invalidates existing sessions.
    await this.refreshTokenModel.deleteMany({ customerId: resetToken.customerId }).exec();

    return { message: 'Password reset successfully' };
  }

  async getMe(customerId: string) {
    const customer = await this.customerModel
      .findById(customerId)
      .select('-password')
      .exec();
    if (!customer) throw new BadRequestException('Customer not found');
    return customer;
  }

  /** Signs a customer in — for flows outside this service, like checkout. */
  async createSession(customer: Customer, tenant: string) {
    const tokens = await this.generateTokens(customer._id as Types.ObjectId, tenant);
    return { ...tokens, customer: this.sanitize(customer) };
  }

  /**
   * A one-use link that lets a guest set their password. It is a reset token
   * underneath, so the reset-password page redeems it.
   */
  async createActivationLink(
    customerId: Types.ObjectId,
    host: string,
    locale?: string,
  ): Promise<string> {
    const token = nanoid(64);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + ACTIVATION_DAYS);
    await this.resetTokenModel.create({ customerId, token, expiryDate });

    const base = (
      this.tenantConnection.getFrontendUrl(host) ??
      this.configService.get<string>('frontendUrl') ??
      ''
    ).replace(/\/+$/, '');
    const lang = locale === 'en' ? 'en' : 'ar';
    return `${base}/${lang}/account/reset-password?token=${token}&activate=1`;
  }

  async sendActivationEmail(customer: Customer, host: string, locale?: string) {
    const lang = locale === 'en' ? 'en' : 'ar';
    const copy = ACTIVATION_COPY[lang];
    const link = await this.createActivationLink(
      customer._id as Types.ObjectId,
      host,
      lang,
    );
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    await this.mailService.send({
      to: customer.email,
      subject: copy.subject,
      html: `
        <div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;line-height:1.6">
          <h2>${copy.title}</h2>
          <p>${copy.body}</p>
          <p><a href="${link}">${copy.button}</a></p>
          <p style="color:#888">${copy.expiry}</p>
        </div>
      `,
    });
  }

  private async generateTokens(customerId: Types.ObjectId, tenant: string) {
    const refreshToken = uuidv4();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    await this.refreshTokenModel
      .updateOne(
        { customerId },
        { $set: { token: refreshToken, expiryDate } },
        { upsert: true },
      )
      .exec();

    return {
      accessToken: this.jwtService.sign(
        { customerId, tenant, type: CUSTOMER_TOKEN_TYPE },
        { expiresIn: '12h' },
      ),
      refreshToken,
    };
  }

  private sanitize(customer: Customer) {
    const { password, ...rest } = customer.toObject();
    return rest;
  }
}
