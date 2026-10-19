"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { addAddress, updateAddress } from "@/backend-api/customers/mutations";
import { CUSTOMER_ADDRESSES_QUERY_KEY } from "@/backend-api/customers/hooks";
import { Address } from "@/backend-api/customers/types";
import DeliveryAreaFields from "@/features/Checkout/DeliveryAreaFields";

type FormValues = {
  label: string;
  fullName: string;
  phone: string;
  zoneId: string;
  subZoneId: string;
  area: string;
  street: string;
  building: string;
  notes: string;
  isDefault: boolean;
};

const EMPTY: FormValues = {
  label: "",
  fullName: "",
  phone: "",
  zoneId: "",
  subZoneId: "",
  area: "",
  street: "",
  building: "",
  notes: "",
  isDefault: false,
};

interface AddressFormDialogProps {
  open: boolean;
  /** The address being edited, or null when adding a new one. */
  address: Address | null;
  onClose: () => void;
}

const AddressFormDialog = ({ open, address, onClose }: AddressFormDialogProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      address
        ? {
            label: address.label ?? "",
            fullName: address.fullName,
            phone: address.phone,
            // Empty on a legacy address, so editing it asks for an area.
            zoneId: address.zone ?? "",
            subZoneId: address.subZone ?? "",
            area: address.area ?? "",
            street: address.street,
            building: address.building ?? "",
            notes: address.notes ?? "",
            isDefault: address.isDefault,
          }
        : EMPTY
    );
  }, [open, address, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        label: values.label || undefined,
        fullName: values.fullName,
        phone: values.phone,
        subZoneId: values.subZoneId,
        area: values.area || undefined,
        street: values.street,
        building: values.building || undefined,
        notes: values.notes || undefined,
        isDefault: values.isDefault,
      };

      return address
        ? updateAddress({ addressId: address._id, data: payload })
        : addAddress(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMER_ADDRESSES_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      onClose();
    },
    onError: (error: any) =>
      toast.error(
        error?.response?.data?.code === "delivery_unavailable"
          ? t("deliveryUnavailable")
          : error?.response?.data?.message ?? t("somethingWentWrong")
      ),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{address ? t("editAddress") : t("addAddress")}</DialogTitle>

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInputComponent
                name="label"
                label={t("addressLabel")}
                control={control}
                placeholder={t("addressLabelPlaceholder")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInputComponent
                name="fullName"
                label={t("fullName")}
                control={control}
                required
                rules={{ required: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInputComponent
                name="phone"
                label={t("phone")}
                control={control}
                required
                rules={{ required: true }}
              />
            </Grid>
            <DeliveryAreaFields control={control} />
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInputComponent name="area" label={t("area")} control={control} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInputComponent
                name="street"
                label={t("street")}
                control={control}
                required
                rules={{ required: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextInputComponent
                name="building"
                label={t("building")}
                control={control}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextInputComponent
                name="notes"
                label={t("deliveryNotes")}
                control={control}
                multiline
                minRows={2}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={watch("isDefault")}
                    onChange={(e) => setValue("isDefault", e.target.checked)}
                  />
                }
                label={t("setAsDefault")}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="inherit">
            {t("cancel")}
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {t("save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddressFormDialog;
