"use client"
import { store } from "@/Store/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from 'react';
import { Provider } from "react-redux";
// import GetUserLogged from "./get-user-logged";

const AppProviders = ({
    children,
    token,
}: {
    children: React.ReactNode
    token?: string
}) => {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 0,
                gcTime: 0,
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
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                {/* <GetUserLogged token={token} > */}
                {children}
                {/* </GetUserLogged> */}
            </Provider>
        </QueryClientProvider>
    )
}

export default AppProviders