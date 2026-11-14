import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { decryptSecret, encryptSecret } from '../common/helpers/secret-box';
import { Setting } from '../settings/schemas/setting.schema';
import { DEFAULT_CURRENCY } from '../common/money/money';
import { PaymentGatewaySetting } from './schemas/payment-gateway-setting.schema';
import { CredentialField, Credentials, PaymentProvider } from './providers/payment-provider';
import { getProvider, listProviders } from './providers';
import { UpdateGatewaySettingsDto } from './dto/gateway-settings.dto';

/** What the dashboard sees: plain fields as stored, secrets reduced to "is it set". */
export interface PublicGatewaySettings {
  enabled: boolean;
  provider: string | null;
  providers: {
    id: string;
    name: string;
    fields: readonly CredentialField[];
    values: Record<string, string>;
    /** Keys of the secret fields that have a saved value. */
    secretsSet: string[];
    complete: boolean;
  }[];
}

@Injectable()
export class GatewaySettingsService {
  constructor(
    @InjectModel(PaymentGatewaySetting.name) private model: Model<PaymentGatewaySetting>,
    @InjectModel(Setting.name) private settingModel: Model<Setting>,
  ) {}

  private async document(): Promise<PaymentGatewaySetting> {
    return (await this.model.findOne().exec()) ?? (await this.model.create({}));
  }

  async getPublic(): Promise<PublicGatewaySettings> {
    return this.toPublic(await this.document());
  }

  async update(dto: UpdateGatewaySettingsDto): Promise<PublicGatewaySettings> {
    const doc = await this.document();
    const providerId = dto.provider ?? doc.provider;
    const provider = providerId ? getProvider(providerId) : undefined;

    const credentials = { ...(doc.credentials ?? {}) };
    if (provider && dto.credentials) {
      credentials[provider.id] = this.merge(provider, credentials[provider.id] ?? {}, dto.credentials);
    }

    const enabled = dto.enabled ?? doc.enabled;
    if (enabled) {
      if (!provider) throw new BadRequestException('Choose a payment gateway first');
      provider.assertCredentials(this.decrypt(provider, credentials[provider.id] ?? {}));
    }

    doc.set({ enabled, provider: provider?.id, credentials });
    doc.markModified('credentials');
    await doc.save();
    return this.toPublic(doc);
  }

  /**
   * The gateway to charge through, with its credentials ready to use. Throws
   * when online payment isn't switched on or is half set up.
   */
  async active(): Promise<{ provider: PaymentProvider; credentials: Credentials }> {
    const doc = await this.model.findOne().exec();
    if (!doc?.enabled || !doc.provider) throw new BadRequestException('Online payment is not available in this store');
    return this.resolve(doc, doc.provider);
  }

  /** Whether checkout may offer online payment: switched on and complete. */
  async isAvailable(): Promise<boolean> {
    try {
      await this.active();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * A gateway's credentials whether or not the store still has it switched
   * on: a payment started earlier must still be confirmed when its webhook arrives.
   */
  async forWebhook(providerId: string): Promise<{ provider: PaymentProvider; credentials: Credentials } | null> {
    const doc = await this.model.findOne().exec();
    if (!doc?.credentials?.[providerId]) return null;
    return this.resolve(doc, providerId);
  }

  /** Credentials from a form that may be unsaved: any blank secret falls back to the saved one. */
  async draft(providerId: string | undefined, entered: Record<string, string> | undefined) {
    const doc = await this.document();
    const provider = getProvider(providerId ?? doc.provider ?? undefined);
    const merged = this.merge(provider, doc.credentials?.[provider.id] ?? {}, entered ?? {});
    return { provider, credentials: this.decrypt(provider, merged) };
  }

  async currencyCode(): Promise<string> {
    const setting = await this.settingModel.findOne().select('currencyCode').lean().exec();
    return setting?.currencyCode ?? DEFAULT_CURRENCY;
  }

  private resolve(doc: PaymentGatewaySetting, providerId: string) {
    const provider = getProvider(providerId);
    let credentials: Credentials;
    try {
      credentials = this.decrypt(provider, doc.credentials?.[provider.id] ?? {});
    } catch {
      throw new BadRequestException('The saved payment keys can no longer be read. Please enter them again.');
    }
    provider.assertCredentials(credentials);
    return { provider, credentials };
  }

  /** Stored → plain. Secrets are decrypted; anything else is as typed. */
  private decrypt(provider: PaymentProvider, stored: Record<string, string>): Credentials {
    const out: Credentials = {};
    for (const field of provider.fields) {
      const value = stored[field.key];
      if (!value) continue;
      out[field.key] = field.secret ? decryptSecret(value) : value;
    }
    return out;
  }

  /** Entered over saved, as stored (secrets encrypted). Unknown keys are refused. */
  private merge(provider: PaymentProvider, saved: Record<string, string>, entered: Record<string, string>) {
    const known = new Set(provider.fields.map((f) => f.key));
    const unknown = Object.keys(entered).filter((key) => !known.has(key));
    if (unknown.length) throw new BadRequestException(`${provider.name} has no field ${unknown.join(', ')}`);

    const next: Record<string, string> = { ...saved };
    for (const field of provider.fields) {
      const value = entered[field.key];
      if (value === undefined) continue;
      if (typeof value !== 'string') throw new BadRequestException(`${field.key} must be text`);
      const trimmed = value.trim();
      if (field.secret) {
        // A blank secret means "leave it as it is" — the form never has the saved one to send back.
        if (trimmed) next[field.key] = encryptSecret(trimmed);
      } else if (trimmed) next[field.key] = trimmed;
      else delete next[field.key];
    }
    return next;
  }

  private toPublic(doc: PaymentGatewaySetting): PublicGatewaySettings {
    return {
      enabled: doc.enabled,
      provider: doc.provider ?? null,
      providers: listProviders().map((provider) => {
        const stored = doc.credentials?.[provider.id] ?? {};
        let complete = true;
        try {
          provider.assertCredentials(this.decrypt(provider, stored));
        } catch {
          complete = false;
        }
        return {
          id: provider.id,
          name: provider.name,
          fields: provider.fields,
          values: Object.fromEntries(provider.fields.filter((f) => !f.secret && stored[f.key]).map((f) => [f.key, stored[f.key]])),
          secretsSet: provider.fields.filter((f) => f.secret && stored[f.key]).map((f) => f.key),
          complete,
        };
      }),
    };
  }
}
