import api from "@/lib/api";

export const createSubCategory = async (data: FormData): Promise<any> => {
  const response = await api.post("/sub-categories", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const updateSubCategory = async ({ id, data }: { id: string; data: FormData }): Promise<any> => {
  const response = await api.patch(`/sub-categories/${id}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteSubCategory = async (id: string): Promise<any> => {
  const response = await api.delete(`/sub-categories/${id}`);
  return response.data;
};
