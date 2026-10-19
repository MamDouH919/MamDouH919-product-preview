import { CountryZones } from './types';
import { EGYPT } from './egypt';

/** Countries a super admin can pick, keyed by ISO 3166-1 alpha-2 code. */
export const COUNTRY_ZONES: Record<string, CountryZones> = {
  EG: EGYPT,
};

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_ZONES);

/** `EG-KB` + "Obour City" → `EG-KB-obour-city`. Stable as long as the English name is. */
export const subZoneCode = (zoneCode: string, englishName: string) =>
  `${zoneCode}-${englishName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
