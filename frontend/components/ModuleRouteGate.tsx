"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button, Stack, Typography } from "@mui/material";
import CustomLink from "@/components/CustomLink";
import { useStoreModules } from "@/Hooks/useStoreModules";

/**
 * Stands in for a page the store's plan leaves out. Visitors see an ordinary
 * "not found", as the API answers; the dashboard says why, so an admin who
 * follows an old link isn't left guessing.
 */
const ModuleRouteGate = ({ area, children }: { area: "website" | "admin"; children: React.ReactNode }) => {
    const pathname = usePathname();
    const { t } = useTranslation();
    const { allows } = useStoreModules();

    if (allows(pathname)) return <>{children}</>;

    const admin = area === "admin";
    return (
        <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 12, px: 2, textAlign: "center" }}>
            <Typography variant="h5" fontWeight={800}>
                {t(admin ? "notInPlan" : "pageNotFound")}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 440 }}>
                {t(admin ? "notInPlanHint" : "pageNotFoundHint")}
            </Typography>
            <CustomLink href={admin ? "/admin" : "/"}>
                <Button variant="contained" sx={{ mt: 1 }}>
                    {t(admin ? "dashboard" : "backToHome")}
                </Button>
            </CustomLink>
        </Stack>
    );
};

export default ModuleRouteGate;
