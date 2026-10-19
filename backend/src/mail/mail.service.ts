import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { escapeHtml } from '../common/helpers/escape-html';
import { Setting } from '../settings/schemas/setting.schema';
import { MailSettingsService } from './mail-settings.service';
import { MailNotification, MailSetting } from './schemas/mail-setting.schema';
import { TestMailDto } from './dto/update-mail-setting.dto';

export interface OutgoingMail {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/** Thrown when the store hasn't set up (or has switched off) outgoing email. */
export class MailNotConfiguredException extends ServiceUnavailableException {
  constructor() {
    super('Email is not configured for this store');
  }
}

/**
 * Sends email through the current tenant's own mail server, as configured in
 * the dashboard (Settings → Email). Request-scoped via the tenant models.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailSettings: MailSettingsService,
    @InjectModel(Setting.name) private readonly settingModel: Model<Setting>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sends to a customer. With a `notification`, the email is silently skipped
   * when the store has switched that kind of email off.
   */
  async send(message: OutgoingMail, notification?: MailNotification): Promise<void> {
    const settings = await this.activeSettings();
    if (notification && settings.notifications?.[notification] === false) return;
    await this.deliver(settings, message, { bcc: settings.bccEmails });
  }

  /** Sends an alert to the store's own team. */
  async sendToStore(
    message: Omit<OutgoingMail, 'to'>,
    notification?: MailNotification,
  ): Promise<void> {
    const settings = await this.activeSettings();
    if (notification && settings.notifications?.[notification] === false) return;

    const to = await this.storeRecipients(settings);
    if (!to.length) {
      this.logger.warn(`No recipient for store alert "${message.subject}"`);
      return;
    }
    await this.deliver(settings, { ...message, to });
  }

  /** Checks the connection and sends a test email, using unsaved values if given. */
  async sendTest(dto: TestMailDto): Promise<{ ok: true; to: string }> {
    const doc = await this.mailSettings.getDocument();
    const config = this.mailSettings.resolve(doc, dto);
    const transporter = this.mailSettings.createTransport(config);
    const to = dto.to || config.fromEmail;
    try {
      await transporter.verify();
      await transporter.sendMail({
        from: { name: config.fromName || config.fromEmail, address: config.fromEmail },
        to,
        subject: 'Test email',
        html: `
          <h2>Your email settings work</h2>
          <p>This is a test message sent from your store dashboard via
          <strong>${escapeHtml(config.host)}:${config.port}</strong>.</p>
        `,
      });
      return { ok: true, to };
    } catch (error) {
      throw new ServiceUnavailableException(`Test failed: ${(error as Error).message}`);
    } finally {
      transporter.close();
    }
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your OTP Code',
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 5 minutes.</p>
      `,
    });
  }

  async sendContactNotification(data: {
    name: string;
    email: string;
    phone?: string;
    subject?: string;
    message: string;
  }): Promise<void> {
    await this.sendToStore(
      {
        replyTo: data.email,
        // Subject is plain text, but strip line breaks so it can't add headers.
        subject: `New Contact Message${data.subject ? `: ${data.subject.replace(/[\r\n]+/g, ' ')}` : ''}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
          ${data.phone ? `<p><strong>Phone:</strong> ${escapeHtml(data.phone)}</p>` : ''}
          ${data.subject ? `<p><strong>Subject:</strong> ${escapeHtml(data.subject)}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(data.message).replace(/\n/g, '<br/>')}</p>
        `,
      },
      'contactForm',
    );
  }

  async sendResetPasswordLink(
    to: string,
    token: string,
    frontendUrl?: string,
    // Admins and storefront customers reset their passwords on different pages.
    path = 'reset-password',
  ): Promise<void> {
    // Prefer the tenant's frontend origin; fall back to the global env value.
    const baseUrl = frontendUrl ?? this.configService.get<string>('frontendUrl');
    const resetLink = `${baseUrl}/${path}?token=${token}`;
    await this.send({
      to,
      subject: 'Reset Your Password',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async activeSettings(): Promise<MailSetting> {
    const settings = await this.mailSettings.getDocument();
    if (!settings.enabled) throw new MailNotConfiguredException();
    return settings;
  }

  /** Configured alert addresses, else the store's public email, else the sender. */
  private async storeRecipients(settings: MailSetting): Promise<string[]> {
    if (settings.notificationEmails?.length) return settings.notificationEmails;
    const store = await this.settingModel.findOne().select('email').lean().exec();
    const fallback = store?.email || settings.fromEmail;
    return fallback ? [fallback] : [];
  }

  private async deliver(
    settings: MailSetting,
    message: OutgoingMail,
    extra: { bcc?: string[] } = {},
  ): Promise<void> {
    const config = this.mailSettings.resolve(settings);
    await this.mailSettings.transporterFor(settings).sendMail({
      from: { name: config.fromName || config.fromEmail, address: config.fromEmail },
      replyTo: message.replyTo || settings.replyTo || undefined,
      bcc: extra.bcc?.length ? extra.bcc : undefined,
      ...message,
    });
  }
}
