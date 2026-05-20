import { createContext } from "react";
import type { AppAction, AppState } from "./Dashboard";

// Full context (for dispatch + all state)
export const DashboardContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);

// Lightweight context — only open state + dispatch
// Used by Header and NavDrawer to avoid re-renders from pageActions/breadcrumbs changes
export const DashboardDrawerContext = createContext<{
    open: boolean;
    dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);
