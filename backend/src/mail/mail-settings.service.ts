import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import SMTPPool from 'nodemailer/lib/smtp-pool';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { decryptSecret, encryptSecret } from '../common/helpers/secret-box';
import { MailEncryption, MailSetting } from './schemas/mail-setting.schema';
import { UpdateMailSettingDto } from './dto/update-mail-setting.dto';

/** The shape the dashboard sees — the password is reduced to a flag. */
export type PublicMailSetting = Omit<
  ReturnType<MailSetting['toObject']>,
  'password'
> & { hasPassword: boolean };

/** Everything needed to open an SMTP connection, password decrypted. */
export interface ResolvedMailConfig {
  host: string;
  port: number;
  encryption: MailEncryption;
  allowInvalidCertificates: boolean;
  username?: string;
  password?: string;
  fromName?: string;
  fromEmail: string;
}

/**
 * Transports are pooled per tenant database and rebuilt whenever the settings
 * change (keyed by `updatedAt`), so a busy store doesn't reconnect per email.
 */
const transportCache = new Map<string, { stamp: number; transporter: nodemailer.Transporter }>();

@Injectable()
export class MailSettingsService {
  constructor(@InjectModel(MailSetting.name) private model: Model<MailSetting>) {}

  /** The stored document, created with defaults on first access. */
  async getDocument(): Promise<MailSetting> {
    return (
      (await this.model.findOne().exec()) ??
      (await this.model.create({}))
    );
  }

  async getPublic(): Promise<PublicMailSetting> {
    return this.toPublic(await this.getDocument());
  }

  async update(dto: UpdateMailSettingDto): Promise<PublicMailSetting> {
    const current = await this.getDocument();
    const { password, clearPassword, notifications, ...rest } = dto;

    const update: Record<string, unknown> = { ...rest };
    if (password) update.password = encryptSecret(password);
    else if (clearPassword) update.password = null;
    // Merge toggles one by one, so a partial object doesn't reset the others.
    for (const [key, value] of Object.entries(notifications ?? {})) {
      if (value !== undefined) update[`notifications.${key}`] = value;
    }

    const merged = { ...current.toObject(), ...rest };
    if (merged.enabled) this.assertComplete(merged);

    const saved = await this.model
      .findByIdAndUpdate(current._id, { $set: update }, { returnDocument: 'after' })
      .exec();
    return this.toPublic(saved!);
  }

  /**
   * Resolves a config to send with. Pass `draft` to test unsaved form values —
   * any field left out (notably a blank password) falls back to the saved one.
   */
  resolve(doc: MailSetting, draft?: UpdateMailSettingDto): ResolvedMailConfig {
    const merged = { ...doc.toObject(), ...this.definedOnly(draft ?? {}) };
    this.assertComplete(merged);

    let password: string | undefined;
    if (draft?.password) password = draft.password;
    else if (!draft?.clearPassword && doc.password) {
      try {
        password = decryptSecret(doc.password);
      } catch {
        throw new BadRequestException(
          'The saved mail password can no longer be read. Please enter it again.',
        );
      }
    }

    return {
      host: merged.host!,
      port: merged.port,
      encryption: merged.encryption,
      allowInvalidCertificates: !!merged.allowInvalidCertificates,
      username: merged.username || undefined,
      password,
      fromName: merged.fromName || undefined,
      fromEmail: merged.fromEmail!,
    };
  }

  /** A pooled transport for the saved settings of this tenant. */
  transporterFor(doc: MailSetting): nodemailer.Transporter {
    const key = `${this.model.db.host}:${this.model.db.port}/${this.model.db.name}`;
    const stamp = doc.updatedAt?.getTime() ?? 0;
    const cached = transportCache.get(key);
    if (cached && cached.stamp === stamp) return cached.transporter;

    cached?.transporter.close();
    const transporter = this.createTransport(this.resolve(doc), true);
    transportCache.set(key, { stamp, transporter });
    return transporter;
  }

  createTransport(config: ResolvedMailConfig, pool = false): nodemailer.Transporter {
    const options: SMTPTransport.Options = {
      host: config.host,
      port: config.port,
      secure: config.encryption === MailEncryption.SSL,
      requireTLS: config.encryption === MailEncryption.STARTTLS,
      ignoreTLS: config.encryption === MailEncryption.NONE,
      auth: config.username ? { user: config.username, pass: config.password } : undefined,
      tls: config.allowInvalidCertificates ? { rejectUnauthorized: false } : undefined,
      // Fail fast — a dead server shouldn't hang a request for minutes.
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    };
    return pool
      ? nodemailer.createTransport({ ...options, pool: true } as SMTPPool.Options)
      : nodemailer.createTransport(options);
  }

  private assertComplete(config: Partial<MailSetting>): void {
    const missing = [
      !config.host && 'host',
      !config.port && 'port',
      !config.fromEmail && 'fromEmail',
    ].filter(Boolean);
    if (missing.length) {
      throw new BadRequestException(`Mail settings are incomplete: ${missing.join(', ')}`);
    }
  }

  private definedOnly<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''),
    ) as Partial<T>;
  }

  private toPublic(doc: MailSetting): PublicMailSetting {
    const { password, ...rest } = doc.toObject();
    return { ...rest, hasPassword: !!password };
  }
}
