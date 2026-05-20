"use client"

import React, { useState } from 'react'
import ThemeRegistry from './ThemeRegistry'
import { Provider } from 'react-redux'
import { store } from '@/Store/store'
import { I18nProvider } from './i18n-provider'
import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GetUserLogged from '@/components/GetUserLogged'
import GetSettings from '@/components/GetSettings'

const Providers = ({
    children,
    locale,
}: {
    children: React.ReactNode,
    locale: string,
}) => {
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

    return (
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
            <I18nProvider language={locale}>
                <Provider store={store}>
                    <ThemeRegistry locale={locale}>
                        <QueryClientProvider client={queryClient}>
                            <GetSettings>
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
