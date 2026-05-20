import { useEffect, useMemo } from "react";
import useDashboard from "./useDashboard";

type UsePageStateProps = {
    actions?: () => React.ReactNode;
    breadcrumbs?: Array<{ label: string; link?: string }>;
};

export const usePageState = ({ actions, breadcrumbs = [] }: UsePageStateProps) => {
    const context = useDashboard();

    const memoizedActions = useMemo(() => actions?.() ?? null, [actions]);

    const breadcrumbsKey = breadcrumbs.map((b) => `${b.label}:${b.link ?? ""}`).join("|");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedBreadcrumbs = useMemo(() => breadcrumbs, [breadcrumbsKey]);

    useEffect(() => {
        context?.dispatch({
            type: "UPDATE_STATE",
            payload: {
                pageActions: memoizedActions,
                breadcrumbLinks: memoizedBreadcrumbs,
            },
        });

        return () => {
            context?.dispatch({ type: "RESET_STATE" });
        };
    }, [memoizedActions, memoizedBreadcrumbs]);
};
