import { useMemo, useReducer } from "react";
import { DashboardContext, DashboardDrawerContext } from "./Contexts";
import { useMediaQuery, useTheme } from "@mui/material";

export type AppState = {
    open: boolean;
    pageActions: React.ReactNode | null;
    breadcrumbLinks: Links[] | null;
};

type Links = {
    label: string;
    link?: string;
};

export type AppAction =
    | { type: "SET_OPEN"; payload: boolean }
    | { type: "SET_PAGE_ACTIONS"; payload: React.ReactNode | null }
    | { type: "SET_BREADCRUMB_LINKS"; payload: Links[] }
    | { type: "UPDATE_STATE"; payload: Partial<AppState> }
    | { type: "RESET_STATE"; };

const reducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "SET_OPEN":
            if (typeof window !== "undefined") localStorage.setItem("drawer", action.payload.toString());
            return { ...state, open: action.payload };
        case "SET_PAGE_ACTIONS":
            return { ...state, pageActions: action.payload };
        case "SET_BREADCRUMB_LINKS":
            return { ...state, breadcrumbLinks: action.payload };
        case "UPDATE_STATE":
            return { ...state, ...action.payload };
        case "RESET_STATE":
            return { ...state, breadcrumbLinks: [], pageActions: null };
        default:
            throw new Error("Unhandled action type");
    }
};

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const theme = useTheme();
    const isScreenSmall = useMediaQuery(theme.breakpoints.down("xs"));

    const [state, dispatch] = useReducer(reducer, {
        open: isScreenSmall ? false : (typeof window !== "undefined" && localStorage.getItem("drawer") === "false") ? false : true,
        pageActions: null,
        breadcrumbLinks: [],
    });

    // Full context — re-renders on any state change
    const fullValue = useMemo(() => ({ state, dispatch }), [state]);

    // Drawer context — only re-renders when open changes
    const drawerValue = useMemo(() => ({ open: state.open, dispatch }), [state.open]);

    return (
        <DashboardContext.Provider value={fullValue}>
            <DashboardDrawerContext.Provider value={drawerValue}>
                {children}
            </DashboardDrawerContext.Provider>
        </DashboardContext.Provider>
    );
};
