"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Badge, IconButton, Tooltip } from "@mui/material";
import ShoppingCartOutlined from "@mui/icons-material/ShoppingCartOutlined";
import { useAppSelector } from "@/Store/store";
import { selectCartCount } from "@/Store/slices/cart";

const CartButton = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const count = useAppSelector(selectCartCount);

  return (
    <Tooltip title={t("cart")}>
      <IconButton onClick={() => router.push(`/${i18n.language}/cart`)} aria-label={t("cart")}>
        <Badge badgeContent={count} color="primary" max={99}>
          <ShoppingCartOutlined />
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default CartButton;
