import { Stack, Typography } from "@mui/material";
import { ShippingAddress } from "@/backend-api/orders/types";

const ShippingAddressBlock = ({ address }: { address: ShippingAddress }) => (
  <Stack spacing={0.25}>
    <Typography variant="body2" fontWeight={600}>
      {address.fullName}
    </Typography>
    <Typography variant="body2" color="text.secondary" dir="ltr" sx={{ textAlign: "start" }}>
      {address.phone}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {[address.street, address.building, address.area, address.city].filter(Boolean).join(", ")}
    </Typography>
    {address.notes && (
      <Typography variant="caption" color="text.secondary">
        {address.notes}
      </Typography>
    )}
  </Stack>
);

export default ShippingAddressBlock;
