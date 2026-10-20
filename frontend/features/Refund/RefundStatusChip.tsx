"use client";

import { Chip, ChipProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import { RefundStatus } from "@/backend-api/refunds/types";

const COLORS: Record<RefundStatus, ChipProps["color"]> = {
  requested: "warning",
  approved: "info",
  rejected: "default",
  executed: "success",
  reversed: "default",
};

const RefundStatusChip = ({ status, size = "small" }: { status: RefundStatus; size?: ChipProps["size"] }) => {
  const { t } = useTranslation();
  return <Chip label={t(`refundStatus.${status}`)} color={COLORS[status]} size={size} />;
};

export default RefundStatusChip;
