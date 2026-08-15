"use client";

import { Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { StockStatus } from "@/backend-api/inventory/types";

const COLOR: Record<StockStatus, "success" | "warning" | "error" | "default"> = {
  in_stock: "success",
  low: "warning",
  out: "error",
  untracked: "default",
};

const StockStatusChip = ({ status }: { status: StockStatus }) => {
  const { t } = useTranslation();

  return (
    <Chip
      label={t(`stockStatus_${status}`)}
      color={COLOR[status]}
      size="small"
      variant={status === "untracked" ? "outlined" : "filled"}
    />
  );
};

export default StockStatusChip;
