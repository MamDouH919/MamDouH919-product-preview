import { useMemo } from "react";
import { useAppSelector } from "@/Store/store";
import { ALL_MODULES, requiredModules, StoreModule } from "@/lib/storeModules";

/** What the store's plan lets it offer, from the settings loaded at start-up. */
export const useStoreModules = () => {
    const modules = useAppSelector((state) => state.settings.modules) ?? ALL_MODULES;
    const showPricesSetting = useAppSelector((state) => state.settings.showPrices);

    return useMemo(() => {
        const has = (module: StoreModule) => modules.includes(module);
        return {
            has,
            /** Whether a route (with or without its locale) is part of this store. */
            allows: (pathname: string) => requiredModules(pathname).every(has),
            // A store that takes orders always shows what they cost.
            showPrices: has("orders") || showPricesSetting !== false,
        };
    }, [modules, showPricesSetting]);
};
