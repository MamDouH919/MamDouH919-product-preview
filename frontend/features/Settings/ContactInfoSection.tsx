import { Control, UseFormRegister } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Stack, TextField } from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import SettingsSection from "./SettingsSection";
import type { SettingsFormValues } from "./types";

type Props = {
  control: Control<SettingsFormValues>;
  register: UseFormRegister<SettingsFormValues>;
};

const ContactInfoSection = ({ control, register }: Props) => {
  const { t } = useTranslation();
  return (
    <SettingsSection title={t("contactInfo")}>
      <Stack spacing={2}>
        <TextField size="small" label={t("phone")} placeholder="+966 55 000 0000" {...register("phone")} />
        <TextField size="small" label={t("whatsapp")} placeholder="+966 55 000 0000" {...register("whatsapp")} />
        <TextField size="small" label={t("landLine")} placeholder="+966 1 000 0000" {...register("landLine")} />
        <TextInputComponent name="email" label={t("email")} control={control} />
        <TextInputComponent name="address" label={t("address")} control={control} multiline rows={2} />
      </Stack>
    </SettingsSection>
  );
};

export default ContactInfoSection;
