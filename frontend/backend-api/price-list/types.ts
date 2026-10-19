import { LocalizedField } from "../globalTypes";

/** Countries a super admin can pick — mirrors COUNTRY_ZONES on the server. */
export const SUPPORTED_COUNTRIES = ["EG"] as const;

export type NamedRef = { _id: string; name: LocalizedField };

/** A zone with all its subzones, for the admin pickers. */
export type Zone = NamedRef & { code: string; subZones: NamedRef[] };

/** One row of the price list. */
export type DeliveryPrice = {
  _id: string;
  zone: NamedRef;
  subZone: NamedRef;
  price: number;
  isActive: boolean;
  createdAt: string;
};

/** A zone and the subzones the store delivers to, for the storefront pickers. */
export type DeliveryArea = NamedRef & {
  subZones: (NamedRef & { price: number })[];
};

export type DeliveryPriceFilters = {
  zone?: string;
  search?: string;
};
