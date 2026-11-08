"use client";
import { useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/Store/store";
import { setSettings, toSettingsState } from "@/Store/slices/settings";
import { fetchSettings } from "@/backend-api/settings/queries";
import { CircularProgress, Stack } from "@mui/material";

/**
 * Keeps the store's settings fresh. Normally the server has already put them
 * in the store (`preloaded`), so the page shows at once and only refreshes
 * them here; if the server couldn't, the page waits under a spinner.
 */
const GetSettings = ({ children, preloaded = false }: { children: React.ReactNode; preloaded?: boolean }) => {
    const dispatch = useAppDispatch();
    const initialized = useRef(false);
    const [ready, setReady] = useState(preloaded);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        fetchSettings()
            .then((settings) => {
                dispatch(setSettings(toSettingsState(settings)));
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
