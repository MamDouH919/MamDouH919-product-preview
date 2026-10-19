import api from "@/lib/api";
import { MailSetting, Setting, UpdateMailSettingInput } from "./types";

export const updateSettings = async (data: FormData): Promise<Setting> => {
    const response = await api.patch('/settings', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const updateMailSettings = async (data: UpdateMailSettingInput): Promise<MailSetting> => {
    const response = await api.patch('/settings/mail', data);
    return response.data;
};

/** Tries the given (possibly unsaved) values and sends a test email. */
export const testMailSettings = async (
    data: UpdateMailSettingInput & { to?: string },
): Promise<{ ok: true; to: string }> => {
    const response = await api.post('/settings/mail/test', data);
    return response.data;
};
