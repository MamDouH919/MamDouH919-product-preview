"use client";

import { useTranslation } from "react-i18next";
import { Stack, Typography } from "@mui/material";
import { ShippingAddress } from "@/backend-api/orders/types";
import { formatAddress } from "./format";

const ShippingAddressBlock = ({ address }: { address: ShippingAddress }) => {
  const { i18n } = useTranslation();
  return (
  <Stack spacing={0.25}>
    <Typography variant="body2" fontWeight={600}>
      {address.fullName}
    </Typography>
    <Typography variant="body2" color="text.secondary" dir="ltr" sx={{ textAlign: "start" }}>
      {address.phone}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {formatAddress(address, i18n.language)}
    </Typography>
    {address.notes && (
      <Typography variant="caption" color="text.secondary">
        {address.notes}
      </Typography>
    )}
  </Stack>
  );
};

export default ShippingAddressBlock;
