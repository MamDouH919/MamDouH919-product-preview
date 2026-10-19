"use client";

import { useTranslation } from "react-i18next";
import { Control } from "react-hook-form";
import { Paper, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import CustomLink from "@/components/CustomLink";

export type GuestDetailsValues = {
  email: string;
  fullName: string;
  phone: string;
  city: string;
  area: string;
  street: string;
  building: string;
  notes: string;
};

export const EMPTY_GUEST_DETAILS: GuestDetailsValues = {
  email: "",
  fullName: "",
  phone: "",
  city: "",
  area: "",
  street: "",
  building: "",
  notes: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * What a shopper who isn't signed in fills in at checkout. The email is what
 * ties the order to a customer — the server creates one from these details, or
 * adds the order to the history of the one that already has this email.
 */
const GuestDetails = ({ control }: { control: Control<GuestDetailsValues> }) => {
  const { t, i18n } = useTranslation();
  const from = encodeURIComponent(`/${i18n.language}/checkout`);

  return (
    <>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} spacing={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t("contactInformation")}
          </Typography>
          <CustomLink href={`/account/login?from=${from}`}>
            <Typography variant="body2" color="primary" fontWeight={600}>
              {t("signIn")}
            </Typography>
          </CustomLink>
        </Stack>
        <TextInputComponent
          name="email"
          label={t("email")}
          control={control}
          type="email"
          required
          rules={{
            required: true,
            pattern: { value: EMAIL_PATTERN, message: t("invalidEmail") },
          }}
        />
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          {t("guestEmailHint")}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>
          {t("deliveryAddress")}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="fullName" label={t("fullName")} control={control} required rules={{ required: true }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="phone" label={t("phone")} control={control} required rules={{ required: true }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="city" label={t("city")} control={control} required rules={{ required: true }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="area" label={t("area")} control={control} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="street" label={t("street")} control={control} required rules={{ required: true }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextInputComponent name="building" label={t("building")} control={control} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextInputComponent name="notes" label={t("deliveryNotes")} control={control} multiline minRows={2} />
          </Grid>
        </Grid>
      </Paper>
    </>
  );
};

export default GuestDetails;
