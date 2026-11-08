import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { authSlice } from "./slices/auth";
import { tenantSlice } from "./slices/tenant";
import breadCrumbState from "./slices/bread-crumb";
import settingsReducer from "./slices/settings";
import { customerSlice } from "./slices/customer";
import { cartSlice } from "./slices/cart";

const reducer = combineReducers({
    auth: authSlice.reducer,
    tenant: tenantSlice.reducer,
    breadCrumb: breadCrumbState,
    settings: settingsReducer,
    customer: customerSlice.reducer,
    cart: cartSlice.reducer,
});

/**
 * A store, optionally starting with the store's settings. The server makes one
 * per request: a module-level store there would be shared by every request,
 * and so by every tenant.
 */
export const makeStore = (preloadedState?: Partial<ReturnType<typeof reducer>>) =>
    configureStore({
        reducer,
        preloadedState,
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

/** The browser's one store. Server rendering never touches it (see Providers). */
export const store = makeStore();
export type RootState = ReturnType<typeof store.getState>;
export const useAppDispatch: () => typeof store.dispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
