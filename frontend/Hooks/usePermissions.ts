import { useMemo } from "react";
import { useAppSelector } from "@/Store/store";
import type { PermissionAction } from "@/backend-api/roles/types";
import { canDo, requiredResource } from "@/lib/permissions";

/** What the signed-in staff member's role lets them do; used to hide what they couldn't use. */
export const usePermissions = () => {
    const permissions = useAppSelector((state) => state.auth.permissions);
    const isSuper = useAppSelector((state) => state.auth.isSuper);

    return useMemo(() => {
        const can = (resource: string, action: PermissionAction = "read") =>
            canDo(permissions ?? {}, isSuper, resource, action);
        return {
            can,
            /** Whether a dashboard route (with or without its locale) may be opened. */
            canOpen: (pathname: string) => {
                const resource = requiredResource(pathname);
                return !resource || can(resource, "read");
            },
        };
    }, [permissions, isSuper]);
};
