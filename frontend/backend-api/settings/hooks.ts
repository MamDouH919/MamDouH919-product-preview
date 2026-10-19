import { useQuery } from "@tanstack/react-query";
import { fetchMailSettings, fetchSettings } from "./queries";

export const SETTINGS_QUERY_KEY = "settings";
export const MAIL_SETTINGS_QUERY_KEY = "mail-settings";

export const useSettingsQuery = () => {
    return useQuery({
        queryKey: [SETTINGS_QUERY_KEY],
        queryFn: fetchSettings,
    });
};

export const useMailSettingsQuery = () => {
    return useQuery({
        queryKey: [MAIL_SETTINGS_QUERY_KEY],
        queryFn: fetchMailSettings,
    });
};
