import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { authSlice } from "./slices/auth";
import { tenantSlice } from "./slices/tenant";
import breadCrumbState from "./slices/bread-crumb";
import settingsReducer from "./slices/settings";

export const store = configureStore({
    reducer: {
        auth: authSlice.reducer,
        tenant: tenantSlice.reducer,
        breadCrumb: breadCrumbState,
        settings: settingsReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: ['websiteData/changeWebsiteData'],
                // Ignore these field paths in all actions
                ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
                // Ignore these paths in the state
                ignoredPaths: ['websiteData.value'],
            },
        }),
});
export type RootState = ReturnType<typeof store.getState>;
export const useAppDispatch: () => typeof store.dispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
