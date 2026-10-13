import api from "@/lib/api";

export const createProduct = async (data: FormData): Promise<any> => {
  const response = await api.post("/products", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const updateProduct = async ({ id, data }: { id: string; data: FormData }): Promise<any> => {
  const response = await api.patch(`/products/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteProduct = async (id: string): Promise<any> => {
  const response = await api.delete(`/products/${id}`);
  return response.data;
};

export const incrementProductView = async (slug: string): Promise<any> => {
  const response = await api.post(`/products/slug/${slug}/view`);
  return response.data;
};

export const incrementProductWhatsappClick = async (slug: string): Promise<any> => {
  const response = await api.post(`/products/slug/${slug}/whatsapp-click`);
  return response.data;
};
