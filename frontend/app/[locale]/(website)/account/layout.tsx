"use client";

import { useEffect } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Box,
  CircularProgress,
  Container,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  alpha,
} from "@mui/material";
import PersonOutline from "@mui/icons-material/PersonOutline";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { resetCustomer } from "@/Store/slices/customer";
import { logoutCustomer } from "@/backend-api/customers/mutations";
import { handleCustomerLogout } from "@/actions/cookies";
import { setCustomerAuthToken } from "@/lib/customerApi";

/** Pages under /account that a guest may still open. */
const PUBLIC_ACCOUNT_PATHS = ["/account/login", "/account/register", "/account/forgot-password", "/account/reset-password"];

const navItemSx: SxProps<Theme> = {
  borderRadius: 2,
  color: "text.secondary",
  "& .MuiListItemIcon-root": { color: "inherit" },
  "&:hover": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
    color: "text.primary",
  },
  "&.Mui-selected": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
    color: "primary.main",
  },
  "&.Mui-selected:hover": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
  },
};

const AccountLayout = ({ children }: { children: React.ReactNode }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { isLoggedIn, isInitialized } = useAppSelector((state) => state.customer);

  const isPublicPage = PUBLIC_ACCOUNT_PATHS.some((p) => pathname.includes(p));

  // The proxy already blocks these routes without a cookie; this second check
  // covers a cookie that exists but no longer authenticates.
  useEffect(() => {
    if (isInitialized && !isLoggedIn && !isPublicPage) {
      router.replace(`/${i18n.language}/account/login?from=${encodeURIComponent(pathname)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isLoggedIn, isPublicPage, pathname]);

  const logoutMutation = useMutation({
    mutationFn: logoutCustomer,
    // Whether or not the server call succeeds, the local session goes away —
    // a failed logout must never leave someone appearing signed in.
    onSettled: async () => {
      setCustomerAuthToken(null);
      await handleCustomerLogout();
      dispatch(resetCustomer());
      toast.success(t("signedOut"));
      router.replace(`/${i18n.language}`);
    },
  });

  if (isPublicPage) return <>{children}</>;

  if (!isInitialized || !isLoggedIn) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="60vh">
        <CircularProgress />
      </Stack>
    );
  }

  const navItems = [
    { href: "/account", label: t("myProfile"), icon: PersonOutline, exact: true },
    { href: "/account/orders", label: t("myOrders"), icon: ReceiptLongOutlined },
    { href: "/account/wishlist", label: t("wishlist"), icon: FavoriteBorder },
    { href: "/account/addresses", label: t("addresses"), icon: LocationOnOutlined },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start">
        <Paper
          variant="outlined"
          sx={{ borderRadius: 3, width: { xs: "100%", md: 260 }, flexShrink: 0 }}
        >
          <List sx={{ p: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const localised = `/${i18n.language}${href}`;
              const selected = exact ? pathname === localised : pathname.startsWith(localised);

              return (
                <ListItemButton
                  key={href}
                  selected={selected}
                  onClick={() => router.push(localised)}
                  sx={navItemSx}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Icon />
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    slotProps={{ primary: { fontWeight: selected ? 700 : 500 } }}
                  />
                </ListItemButton>
              );
            })}

            <ListItemButton
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              sx={{
                ...navItemSx,
                "&:hover": {
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <LogoutOutlined color="error" />
              </ListItemIcon>
              <ListItemText
                primary={t("signOut")}
                sx={{ color: "error.main" }}
                slotProps={{ primary: { fontWeight: 500 } }}
              />
            </ListItemButton>
          </List>
        </Paper>

        <Box flex={1} width="100%">
          {children}
        </Box>
      </Stack>
    </Container>
  );
};

export default AccountLayout;
