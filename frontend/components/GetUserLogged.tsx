"use client";
import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/Store/store";
import { changeAuthData } from "@/Store/slices/auth";
import { fetchMe } from "@/backend-api/auth/queries";
import { setAuthToken } from "@/lib/api";
import { getTokenFromCookie } from "@/actions/cookies";

const GetUserLogged = ({ children }: { children: React.ReactNode }) => {
    const dispatch = useAppDispatch();
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        (async () => {
            const token = await getTokenFromCookie();

            if (!token) {
                dispatch(changeAuthData({ isInitialized: true }));
                return;
            }

            try {
                setAuthToken(token);
                const user = await fetchMe(token);
                dispatch(changeAuthData({
                    isLoggedIn: true,
                    isInitialized: true,
                    user: { id: user._id, name: user.name, email: user.email },
                    role: user.roleId ?? "",
                    isSuper: user.isSuper ?? false,
                }));
            } catch {
                dispatch(changeAuthData({ isInitialized: true }));
            }
        })();
    }, [dispatch]);

    return <>{children}</>;
};

export default GetUserLogged;
