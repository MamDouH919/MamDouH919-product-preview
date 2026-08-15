import api from "@/lib/api";
import customerApi from "@/lib/customerApi";
import {
  Address,
  AddressPayload,
  Customer,
  CustomerSession,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "./types";

// ── Customer auth ─────────────────────────────────────────────────────────────

export const registerCustomer = async (
  data: RegisterPayload
): Promise<CustomerSession> => {
  const response = await customerApi.post("/customer-auth/register", data);
  return response.data;
};

export const loginCustomer = async (
  data: LoginPayload
): Promise<CustomerSession> => {
  const response = await customerApi.post("/customer-auth/login", data);
  return response.data;
};

export const logoutCustomer = async (): Promise<{ message: string }> => {
  const response = await customerApi.delete("/customer-auth/logout");
  return response.data;
};

export const customerForgotPassword = async (
  email: string
): Promise<{ message: string }> => {
  const response = await customerApi.post("/customer-auth/forgot-password", { email });
  return response.data;
};

export const customerResetPassword = async (data: {
  token: string;
  newPassword: string;
}): Promise<{ message: string }> => {
  const response = await customerApi.post("/customer-auth/reset-password", data);
  return response.data;
};

export const customerChangePassword = async (data: {
  oldPassword: string;
  newPassword: string;
}): Promise<{ message: string }> => {
  const response = await customerApi.put("/customer-auth/change-password", data);
  return response.data;
};

// ── Profile ───────────────────────────────────────────────────────────────────

export const updateCustomerProfile = async (
  data: UpdateProfilePayload
): Promise<Customer> => {
  const response = await customerApi.patch("/customers/me", data);
  return response.data;
};

// ── Addresses ─────────────────────────────────────────────────────────────────
// Each of these returns the customer's full address list, so the cache can be
// replaced outright instead of patched.

export const addAddress = async (data: AddressPayload): Promise<Address[]> => {
  const response = await customerApi.post("/customers/me/addresses", data);
  return response.data;
};

export const updateAddress = async ({
  addressId,
  data,
}: {
  addressId: string;
  data: AddressPayload;
}): Promise<Address[]> => {
  const response = await customerApi.patch(`/customers/me/addresses/${addressId}`, data);
  return response.data;
};

export const setDefaultAddress = async (addressId: string): Promise<Address[]> => {
  const response = await customerApi.put(`/customers/me/addresses/${addressId}/default`);
  return response.data;
};

export const deleteAddress = async (addressId: string): Promise<Address[]> => {
  const response = await customerApi.delete(`/customers/me/addresses/${addressId}`);
  return response.data;
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const setCustomerActive = async ({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}): Promise<Customer> => {
  const response = await api.patch(`/customers/${id}/active`, { isActive });
  return response.data;
};
