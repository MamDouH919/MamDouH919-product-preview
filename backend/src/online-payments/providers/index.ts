import { BadRequestException } from '@nestjs/common';
import { GatewayId, PaymentProvider } from './payment-provider';
import { PaymobProvider } from './paymob.provider';

/**
 * Every gateway the system knows. To add one (Stripe…): write a class that
 * implements `PaymentProvider`, add its id to `GatewayId`, and list it here.
 */
export const PROVIDER_CLASSES = [PaymobProvider];

const instances = new Map<string, PaymentProvider>(
  PROVIDER_CLASSES.map((Provider) => {
    const provider = new Provider();
    return [provider.id, provider];
  }),
);

export function getProvider(id: string | undefined): PaymentProvider {
  const provider = id ? instances.get(id) : undefined;
  if (!provider) throw new BadRequestException(`Unknown payment gateway "${id}"`);
  return provider;
}

export const listProviders = (): PaymentProvider[] => [...instances.values()];
