"use client";

import { Control, FieldValues, Path, useController } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, Grid, MenuItem, TextField } from "@mui/material";
import { useDeliveryAreasQuery } from "@/backend-api/price-list/hooks";
import { useCurrency } from "@/Hooks/useCurrency";
import { formatMoney, localized } from "@/features/Order/format";

/** The form fields this picker writes; any form that has them can use it. */
export type DeliveryAreaValues = { zoneId: string; subZoneId: string };

/**
 * Zone → subzone pickers, offering only the places on the store's price list
 * and showing what delivery to each costs. Changing the zone clears the subzone.
 */
const DeliveryAreaFields = <T extends DeliveryAreaValues & FieldValues>({
  control,
}: {
  control: Control<T>;
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = useCurrency();
  const { data: areas, isLoading } = useDeliveryAreasQuery();

  const zone = useController({ control, name: "zoneId" as Path<T>, rules: { required: true } });
  const subZone = useController({ control, name: "subZoneId" as Path<T>, rules: { required: true } });

  const subZones = areas?.find((a) => a._id === zone.field.value)?.subZones ?? [];

  if (!isLoading && !areas?.length) {
    return (
      <Grid size={{ xs: 12 }}>
        <Alert severity="warning">{t("noDeliveryAreas")}</Alert>
      </Grid>
    );
  }

  return (
    <>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          select
          fullWidth
          size="small"
          required
          label={t("zone")}
          value={areas?.some((a) => a._id === zone.field.value) ? zone.field.value : ""}
          onChange={(e) => {
            zone.field.onChange(e.target.value);
            subZone.field.onChange("");
          }}
          onBlur={zone.field.onBlur}
          error={!!zone.fieldState.error}
          disabled={isLoading}
        >
          {(areas ?? []).map((area) => (
            <MenuItem key={area._id} value={area._id}>
              {localized(area.name, lang)}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField
          select
          fullWidth
          size="small"
          required
          label={t("subZone")}
          value={subZones.some((s) => s._id === subZone.field.value) ? subZone.field.value : ""}
          onChange={(e) => subZone.field.onChange(e.target.value)}
          onBlur={subZone.field.onBlur}
          error={!!subZone.fieldState.error}
          disabled={!subZones.length}
          helperText={!zone.field.value ? t("chooseZoneFirst") : undefined}
        >
          {subZones.map((s) => (
            <MenuItem key={s._id} value={s._id}>
              {localized(s.name, lang)} — {s.price > 0 ? formatMoney(s.price, currency) : t("free")}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
    </>
  );
};

export default DeliveryAreaFields;
