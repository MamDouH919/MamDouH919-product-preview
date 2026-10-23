"use client";
import { useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/Store/store";
import { setSettings } from "@/Store/slices/settings";
import { fetchSettings } from "@/backend-api/settings/queries";
import { CircularProgress, Stack } from "@mui/material";

const GetSettings = ({ children }: { children: React.ReactNode }) => {
    const dispatch = useAppDispatch();
    const initialized = useRef(false);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        fetchSettings()
            .then((settings) => {
                dispatch(setSettings({
                    siteTitle: settings.siteTitle as any,
                    siteDescription: settings.siteDescription as any,
                    logo: settings.logo,
                    favicon: settings.favicon,
                    primaryColor: settings.primaryColor,
                    currency: settings.currency as any,
                    phone: settings.phone,
                    whatsapp: settings.whatsapp,
                    landLine: settings.landLine,
                    email: settings.email,
                    address: settings.address,
                    socialMedia: settings.socialMedia as any,
                    showPrices: settings.showPrices,
                    modules: settings.modules,
                }));
            })
            .catch(() => null)
            .finally(() => setReady(true));
    }, [dispatch]);

    // The page renders underneath the spinner rather than in its place, so the
    // server HTML carries the real content and structured data for crawlers.
    // Visibility is toggled on one wrapper, never by swapping trees, so nothing
    // remounts when settings arrive.
    return (
        <>
            {!ready && (
                <Stack alignItems="center" justifyContent="center" height="100dvh">
                    <CircularProgress size={40} />
                </Stack>
            )}
            <div style={{ display: ready ? "contents" : "none" }}>{children}</div>
        </>
    );
};

export default GetSettings;
