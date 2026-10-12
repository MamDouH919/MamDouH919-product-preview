"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Avatar,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import PersonOutline from "@mui/icons-material/PersonOutline";
import LocationOnOutlined from "@mui/icons-material/LocationOnOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import LoginOutlined from "@mui/icons-material/LoginOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { resetCustomer } from "@/Store/slices/customer";
import { logoutCustomer } from "@/backend-api/customers/mutations";
import { handleCustomerLogout } from "@/actions/cookies";
import { setCustomerAuthToken } from "@/lib/customerApi";

/** Storefront account entry point: sign in, or the signed-in customer's menu. */
const AccountMenu = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoggedIn, customer } = useAppSelector((state) => state.customer);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const go = (path: string) => {
    setAnchorEl(null);
    router.push(`/${i18n.language}${path}`);
  };

  const logoutMutation = useMutation({
    mutationFn: logoutCustomer,
    onSettled: async () => {
      setCustomerAuthToken(null);
      await handleCustomerLogout();
      dispatch(resetCustomer());
      setAnchorEl(null);
      toast.success(t("signedOut"));
      router.push(`/${i18n.language}`);
    },
  });

  if (!isLoggedIn) {
    return (
      <Tooltip title={t("signIn")}>
        <IconButton onClick={() => go("/account/login")} aria-label={t("signIn")}>
          <LoginOutlined />
        </IconButton>
      </Tooltip>
    );
  }

  const initial = customer?.name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <>
      <Tooltip title={customer?.name ?? t("myAccount")}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label={t("myAccount")}
        >
          <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 15 }}>
            {initial}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { minWidth: 210, borderRadius: 2 } } }}
      >
        <MenuItem disabled sx={{ opacity: "1 !important" }}>
          <Typography variant="body2" fontWeight={700} noWrap>
            {customer?.name}
          </Typography>
        </MenuItem>
        <Divider />

        <MenuItem onClick={() => go("/account")}>
          <ListItemIcon>
            <PersonOutline fontSize="small" />
          </ListItemIcon>
          {t("myProfile")}
        </MenuItem>

        <MenuItem onClick={() => go("/account/orders")}>
          <ListItemIcon>
            <ReceiptLongOutlined fontSize="small" />
          </ListItemIcon>
          {t("myOrders")}
        </MenuItem>

        <MenuItem onClick={() => go("/account/addresses")}>
          <ListItemIcon>
            <LocationOnOutlined fontSize="small" />
          </ListItemIcon>
          {t("addresses")}
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <LogoutOutlined fontSize="small" color="error" />
          </ListItemIcon>
          {t("signOut")}
        </MenuItem>
      </Menu>
    </>
  );
};

export default AccountMenu;
