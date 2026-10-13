export type Address = {
  _id: string;
  label?: string;
  fullName: string;
  phone: string;
  city: string;
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
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
};

/** Everything an address needs except its id, which the server assigns. */
export type AddressPayload = Omit<Address, "_id" | "isDefault"> & {
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
