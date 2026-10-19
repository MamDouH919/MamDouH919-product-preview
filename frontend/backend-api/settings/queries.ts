import api from "@/lib/api";
import { MailSetting, Setting } from "./types";

export const fetchSettings = async (): Promise<Setting> => {
    const response = await api.get('/settings');
    return response.data;
};

export const fetchMailSettings = async (): Promise<MailSetting> => {
    const response = await api.get('/settings/mail');
    return response.data;
};
