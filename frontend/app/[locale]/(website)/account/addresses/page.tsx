"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import StarBorder from "@mui/icons-material/StarBorder";
import {
  CUSTOMER_ADDRESSES_QUERY_KEY,
  useCustomerAddressesQuery,
} from "@/backend-api/customers/hooks";
import { deleteAddress, setDefaultAddress } from "@/backend-api/customers/mutations";
import { Address } from "@/backend-api/customers/types";
import AddressFormDialog from "@/features/Customer/AddressFormDialog";

const AddressesPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const { data: addresses, isLoading } = useCustomerAddressesQuery();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [CUSTOMER_ADDRESSES_QUERY_KEY] });

  const deleteMutation = useMutation({
    mutationFn: deleteAddress,
    onSuccess: () => {
      invalidate();
      toast.success(t("addressDeleted"));
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultAddress,
    onSuccess: () => {
      invalidate();
      toast.success(t("defaultAddressUpdated"));
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (address: Address) => {
    setEditing(address);
    setDialogOpen(true);
  };

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={0.5}
        >
          <Typography variant="h6" fontWeight={700}>
            {t("addresses")}
          </Typography>
          <Button variant="outlined" startIcon={<Add />} onClick={openNew}>
            {t("addAddress")}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={3}>
          {t("addressesSubtitle")}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {isLoading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress />
          </Stack>
        ) : !addresses?.length ? (
          <Stack alignItems="center" py={5} spacing={2}>
            <Typography variant="body2" color="text.disabled">
              {t("noAddressesYet")}
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={openNew}>
              {t("addAddress")}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {addresses.map((address) => (
              <Paper
                key={address._id}
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  borderColor: address.isDefault ? "primary.main" : undefined,
                  borderWidth: address.isDefault ? 2 : 1,
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Stack spacing={0.5} flex={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle2" fontWeight={700}>
                        {address.label || address.city}
                      </Typography>
                      {address.isDefault && (
                        <Chip label={t("default")} size="small" color="primary" />
                      )}
                    </Stack>

                    <Typography variant="body2">{address.fullName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {[address.street, address.building, address.area, address.city]
                        .filter(Boolean)
                        .join("، ")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {address.phone}
                    </Typography>
                    {address.notes && (
                      <Typography variant="caption" color="text.disabled">
                        {address.notes}
                      </Typography>
                    )}
                  </Stack>

                  <Stack direction="row" alignItems="flex-start">
                    {!address.isDefault && (
                      <Tooltip title={t("setAsDefault")}>
                        <span>
                          <IconButton
                            onClick={() => defaultMutation.mutate(address._id)}
                            disabled={defaultMutation.isPending}
                          >
                            <StarBorder />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip title={t("edit")}>
                      <IconButton onClick={() => openEdit(address)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("delete")}>
                      <span>
                        <IconButton
                          color="error"
                          onClick={() => deleteMutation.mutate(address._id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Delete />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <AddressFormDialog
        open={dialogOpen}
        address={editing}
        onClose={() => setDialogOpen(false)}
      />
    </Stack>
  );
};

export default AddressesPage;
