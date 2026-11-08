"use client"

import React, { useState } from 'react'
import ThemeRegistry from './ThemeRegistry'
import { Provider } from 'react-redux'
import { makeStore, store } from '@/Store/store'
import { setSettings, toSettingsState } from '@/Store/slices/settings'
import { I18nProvider } from './i18n-provider'
import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";
import rtlPlugin from 'stylis-plugin-rtl'
import { prefixer } from 'stylis'
import config from '@/config.json'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GetUserLogged from '@/components/GetUserLogged'
import GetSettings from '@/components/GetSettings'

const Providers = ({
    children,
    locale,
    initialSettings,
}: {
    children: React.ReactNode,
    locale: string,
    /** The public settings, fetched by the server; null if it couldn't. */
    initialSettings?: any,
}) => {
    // Settings are in the store from the first render, so the server HTML shows
    // the page with the right prices, currency and colours instead of a spinner.
    const [reduxStore] = useState(() => {
        const settings = initialSettings ? toSettingsState(initialSettings) : undefined;
        // A store per request on the server, never the shared one.
        if (typeof window === 'undefined') return makeStore(settings ? { settings } : undefined);
        if (settings) store.dispatch(setSettings(settings));
        return store;
    });

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                gcTime: 5 * 60_000,
                refetchOnWindowFocus: false,
                refetchOnMount: true,
                retryDelay: 3000,
                retry: (failureCount, error: any) => {
                    if (!error?.response) {
                        return failureCount < 3;
                    }

                    const status = error.response?.status;
                    return failureCount < 3 && status !== 400 && status !== 401;
                },
            },
        },
    }));

    const isRtl = config.app.rtlLanguages.includes(locale);

    return (
        // The one emotion cache, RTL or not. It writes styles into <head> as the
        // server streams; a second cache in ThemeRegistry used to leave them
        // inline in <body>, which broke hydration. Keyed by direction so a
        // language switch starts a fresh cache.
        <AppRouterCacheProvider
            key={isRtl ? 'rtl' : 'ltr'}
            options={{
                key: isRtl ? 'mui-rtl' : 'mui',
                stylisPlugins: isRtl ? [prefixer, rtlPlugin] : [],
                // No CSS layer: the site was built with MUI's styles unlayered
                // (the old inner cache never applied this option), so they
                // beat globals.css — layering them now would restyle every page.
            }}
        >
            <I18nProvider language={locale}>
                <Provider store={reduxStore}>
                    <ThemeRegistry locale={locale}>
                        <QueryClientProvider client={queryClient}>
                            <GetSettings preloaded={!!initialSettings}>
                                <GetUserLogged>
                                    {children}
                                </GetUserLogged>
                            </GetSettings>
                        </QueryClientProvider>
                    </ThemeRegistry>
                </Provider>
            </I18nProvider>
        </AppRouterCacheProvider>

    )
}

export default Providers
