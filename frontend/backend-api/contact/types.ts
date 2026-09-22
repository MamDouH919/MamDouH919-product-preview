export type CreateContactPayload = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
};

export type Contact = CreateContactPayload & {
  _id: string;
  isRead: boolean;
  createdAt: string;
};
