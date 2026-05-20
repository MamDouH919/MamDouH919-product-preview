"use client";


import { Breadcrumbs } from "@/components/breadcrumbs";
import { DashboardProvider } from "@/context/Dashboard";
import Header from "@/layouts/Dashboard/Header";
import Main from "@/layouts/Dashboard/Main";
import NavDrawer from "@/layouts/Dashboard/NavDrawer";
import { useAppSelector } from "@/Store/store";
import { Box, CircularProgress, Stack } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export const drawerWidth = 250;

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.auth);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      router.replace("/" + i18n.language + "/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isLoggedIn]);

  if (!isInitialized) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: "100dvh" }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  const isAdminDashboard = pathname.split("/").length === 3;

  return (
    <DashboardProvider>
      <Box sx={{ display: "flex", minHeight: "100dvh", overflow: "hidden" }}>
        <Header />
        <NavDrawer />
        <Main>
          {!isAdminDashboard && <Breadcrumbs />}
          <Stack
            p={{ xs: 1, sm: 2 }}
            flexGrow={1}
            height={isAdminDashboard ? "100%" : "calc(100% - 40px)"}
            overflow="auto"
          >
            {children}
          </Stack>
        </Main>
      </Box>
    </DashboardProvider>
  );
};

export default DashboardLayout;
