"use client";

import { Chip, ChipProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import { ReturnStatus } from "@/backend-api/returns/types";

const COLORS: Record<ReturnStatus, ChipProps["color"]> = {
  requested: "warning",
  approved: "info",
  rejected: "default",
  refunded: "success",
};

const ReturnStatusChip = ({ status, size = "small" }: { status: ReturnStatus; size?: ChipProps["size"] }) => {
  const { t } = useTranslation();
  return <Chip label={t(`returnStatus.${status}`)} color={COLORS[status]} size={size} />;
};

export default ReturnStatusChip;
