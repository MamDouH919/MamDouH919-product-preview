import api from "@/lib/api";

export const createCategory = async (data: FormData): Promise<any> => {
  const response = await api.post("/categories", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const updateCategory = async ({ id, data }: { id: string; data: FormData }): Promise<any> => {
  const response = await api.patch(`/categories/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteCategory = async (id: string): Promise<any> => {
  const response = await api.delete(`/categories/${id}`);
  return response.data;
};
