import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "./queries";

export const SETTINGS_QUERY_KEY = "settings";

export const useSettingsQuery = () => {
    return useQuery({
        queryKey: [SETTINGS_QUERY_KEY],
        queryFn: fetchSettings,
    });
};
