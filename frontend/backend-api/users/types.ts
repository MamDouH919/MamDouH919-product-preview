export type StaffUser = {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  isVerified: boolean;
  role: { _id: string; name: string } | null;
  createdAt: string;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  roleId: string;
};

/** Left-out fields stay as they are; a blank password is never sent. */
export type UpdateUserPayload = Partial<CreateUserPayload> & { isActive?: boolean };
