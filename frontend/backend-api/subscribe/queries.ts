import api from "@/lib/api";

export type Subscriber = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
};

export const fetchSubscribers = async (): Promise<Subscriber[]> => {
  const response = await api.get("/subscribe");
  return response.data;
};

export const deleteSubscriber = async (id: string): Promise<void> => {
  await api.delete(`/subscribe/${id}`);
};
