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
import { isRtl as isRtlLocale, type StoreLocales } from './locales'
import { StoreLocalesProvider } from './storeLocalesContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GetUserLogged from '@/components/GetUserLogged'
import GetSettings from '@/components/GetSettings'

function makeQueryClient() {
    return new QueryClient({
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
    });
}

let browserQueryClient: QueryClient | undefined;

/**
 * A client per request on the server; one for the whole visit in the browser.
 * The locale is the root layout's segment, so switching language remounts
 * these providers: a client made per mount threw away every cached query and
 * the new page loaded all its data again. Cached data doesn't depend on the
 * language (records carry every translation), so it carries over.
 */
function getQueryClient(): QueryClient {
    if (typeof window === 'undefined') return makeQueryClient();
    return (browserQueryClient ??= makeQueryClient());
}

const Providers = ({
    children,
    locale,
    initialSettings,
    storeLocales,
}: {
    children: React.ReactNode,
    locale: string,
    /** The public settings, fetched by the server; null if it couldn't. */
    initialSettings?: any,
    /** The languages the store's site is published in, resolved by the server. */
    storeLocales: StoreLocales,
}) => {
    // Settings are in the store from the first render, so the server HTML shows
    // the page with the right prices, currency and colours instead of a spinner.
    const [reduxStore] = useState(() => {
        const settings = initialSettings ? toSettingsState(initialSettings) : undefined;
        // A store per request on the server, never the shared one.
        if (typeof window === 'undefined') return makeStore(settings ? { settings } : undefined);
        // Only on the first mount, when nothing reads the store yet. Switching
        // language remounts these providers while the old page is still on
        // screen, and writing to the store mid-render would update it (React's
        // "Cannot update a component while rendering a different component").
        // The store already has the settings then, and GetSettings refreshes them.
        if (settings && Object.keys(store.getState().settings).length === 0) store.dispatch(setSettings(settings));
        return store;
    });

    const [queryClient] = useState(getQueryClient);

    const isRtl = isRtlLocale(locale);

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
            <StoreLocalesProvider value={storeLocales}>
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
            </StoreLocalesProvider>
        </AppRouterCacheProvider>

    )
}

export default Providers
