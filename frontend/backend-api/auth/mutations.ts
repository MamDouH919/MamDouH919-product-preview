import api from "@/lib/api";
import { LoginResponse } from "./types";

export const loginRequest = async (data: { email: string; password: string }): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
};

export const logoutRequest = async (): Promise<void> => {
    await api.delete('/auth/logout');
};

export const changePasswordRequest = async (data: { oldPassword: string; newPassword: string }): Promise<{ message: string }> => {
    const response = await api.put('/auth/change-password', data);
    return response.data;
};

export const forgotPasswordRequest = async (data: { email: string }): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
};

export const resetPasswordRequest = async (data: { token: string; newPassword: string }): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
};
