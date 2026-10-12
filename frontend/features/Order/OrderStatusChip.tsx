"use client";

import { Chip, ChipProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import { OrderStatus } from "@/backend-api/orders/types";

const COLORS: Record<OrderStatus, ChipProps["color"]> = {
  pending: "warning",
  confirmed: "info",
  shipped: "primary",
  delivered: "success",
  cancelled: "default",
};

const OrderStatusChip = ({ status, size = "small" }: { status: OrderStatus; size?: ChipProps["size"] }) => {
  const { t } = useTranslation();
  return <Chip label={t(`orderStatus.${status}`)} color={COLORS[status]} size={size} />;
};

export default OrderStatusChip;
