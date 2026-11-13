"use client";

import type { PermissionAction } from "@/backend-api/roles/types";
import { usePermissions } from "@/Hooks/usePermissions";

/** Renders its children only when the signed-in role holds `action` on `resource`. */
const Can = ({
    resource,
    action,
    children,
}: {
    resource: string;
    action: PermissionAction;
    children: React.ReactNode;
}) => {
    const { can } = usePermissions();
    return can(resource, action) ? <>{children}</> : null;
};

export default Can;
