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
                }));
            })
            .catch(() => null)
            .finally(() => setReady(true));
    }, [dispatch]);

    if (!ready) return <Stack alignItems="center" justifyContent="center" height="100dvh">
        <CircularProgress size={40} />
    </Stack>;

    return <>{children}</>;
};

export default GetSettings;
