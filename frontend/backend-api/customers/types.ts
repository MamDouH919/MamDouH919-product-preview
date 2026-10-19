import { LocalizedField } from "../globalTypes";

export type Address = {
  _id: string;
  label?: string;
  fullName: string;
  phone: string;
  /** Price-list zone and subzone. Missing on addresses saved before the price list. */
  zone?: string;
  subZone?: string;
  zoneName?: LocalizedField;
  subZoneName?: LocalizedField;
  /** Free-text city, only on addresses saved before the price list. */
  city?: string;
  area?: string;
  street: string;
  building?: string;
  notes?: string;
  isDefault: boolean;
};

export type Customer = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isVerified: boolean;
  isActive: boolean;
  /** Created by a guest checkout and not activated yet. */
  isGuest?: boolean;
  addresses: Address[];
  /** Saved product ids. */
  wishlist?: string[];
  createdAt: string;
};

export type CustomerSession = {
  accessToken: string;
  refreshToken: string;
  customer: Customer;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  locale?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
};

/** What saving an address sends; the server fills in the zone from the subzone. */
export type AddressPayload = {
  label?: string;
  fullName: string;
  phone: string;
  subZoneId: string;
  area?: string;
  street: string;
  building?: string;
  notes?: string;
  isDefault?: boolean;
};

export type CustomersResponse = {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
};

export type CustomerFilters = {
  search?: string;
  page?: number;
  limit?: number;
};
