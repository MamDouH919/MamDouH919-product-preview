"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
} from "@mui/material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
// import DatePickerComponent from "@/components/MUI/DatePickerComponent";
import { createTeam, updateTeam } from "@/backend-api/teams/mutations";
import { TEAMS_QUERY_KEY } from "@/backend-api/teams/hooks";
import { Team } from "@/backend-api/teams/types";
import { LocalizedField } from "@/backend-api/globalTypes";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";

type TeamFormValues = {
  image: File | string | null;
  name: LocalizedField;
  address: LocalizedField;
  job: LocalizedField;
  special: LocalizedField;
  speaks: LocalizedField;
  education: LocalizedField;
  description: LocalizedField;
  associationAndMembership: LocalizedField;
  email: string;
  registrationNumber: string;
  registerDate: Date | null;
  expiryDate: Date | null;
};

interface TeamFormProps {
  defaultData?: Team;
}

const LOCALIZED_FIELDS = [
  "name",
  "address",
  "job",
  "special",
  "speaks",
  "education",
  "description",
  "associationAndMembership",
] as const;

const TeamForm = ({ defaultData }: TeamFormProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);

  const isEditing = !!defaultData;

  const { control, handleSubmit, formState: { errors } } = useForm<TeamFormValues>({
    defaultValues: {
      image: defaultData?.image ? getBackendUri(defaultData.image) : "",
      name: {
        ar: defaultData?.name?.ar || "",
        en: defaultData?.name?.en || "",
      },
      address: {
        ar: defaultData?.address?.ar || "",
        en: defaultData?.address?.en || "",
      },
      job: {
        ar: defaultData?.job?.ar || "",
        en: defaultData?.job?.en || "",
      },
      special: {
        ar: defaultData?.special?.ar || "",
        en: defaultData?.special?.en || "",
      },
      speaks: {
        ar: defaultData?.speaks?.ar || "",
        en: defaultData?.speaks?.en || "",
      },
      education: {
        ar: defaultData?.education?.ar || "",
        en: defaultData?.education?.en || "",
      },
      description: {
        ar: defaultData?.description?.ar || "",
        en: defaultData?.description?.en || "",
      },
      associationAndMembership: {
        ar: defaultData?.associationAndMembership?.ar || "",
        en: defaultData?.associationAndMembership?.en || "",
      },
      email: defaultData?.email || "",
      // registrationNumber: defaultData?.registrationNumber || "",
      // registerDate: defaultData?.registerDate ? new Date(defaultData.registerDate) : null,
      // expiryDate: defaultData?.expiryDate ? new Date(defaultData.expiryDate) : null,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TeamFormValues) => {
      const formData = new FormData();

      if (data.image instanceof File) {
        const compressed = await handleCompression(data.image);
        if (compressed) formData.append("image", compressed);
      }

      if (data.email) formData.append("email", data.email);
      if (data.registrationNumber) {
        formData.append("registrationNumber", data.registrationNumber);
      }
      if (data.registerDate) {
        formData.append("registerDate", data.registerDate.toISOString());
      }
      if (data.expiryDate) {
        formData.append("expiryDate", data.expiryDate.toISOString());
      }

      LOCALIZED_FIELDS.forEach((field) => {
        const val = data[field];
        if (val.ar) formData.append(`${field}[ar]`, val.ar);
        if (val.en) formData.append(`${field}[en]`, val.en);
      });

      if (isEditing) {
        return updateTeam({ id: defaultData._id, data: formData });
      }
      return createTeam(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [TEAMS_QUERY_KEY] });
      router.back();
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const onSubmit = (data: TeamFormValues) => {
    mutation.mutate(data);
  };

  const tabHasError = (lang: string) =>
    LOCALIZED_FIELDS.some((field) => !!(errors as any)[field]?.[lang]);

  const tabs = [
    { label: t("arabic"), value: 0, lang: "ar" },
    { label: t("english"), value: 1, lang: "en" },
  ];

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={3}>
        {/* General fields always visible on top */}
        <Stack spacing={3}>
          <ImageInput
            name="image"
            control={control as any}
            imagePath={defaultData?.image ? getBackendUri(defaultData.image) : ""}
          />
        </Stack>

        <TextInputComponent
          name="email"
          label="email"
          control={control}
          type="email"
        />

        {/* Language tabs below */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.value}
              label={tab.label}
              iconPosition="end"
              icon={tabHasError(tab.lang) ? (
                <Box
                  component="span"
                  sx={{
                    width: 8, height: 8, borderRadius: "50%",
                    bgcolor: "error.main", display: "inline-block", ml: 0.5,
                  }}
                />
              ) : undefined}
            />
          ))}
        </Tabs>

        {/* Tab 0: Arabic fields */}

        <Stack spacing={2} sx={{ display: activeTab === 0 ? "block" : "none" }}>
          {LOCALIZED_FIELDS.map((field) => (
            <TextInputComponent
              key={field}
              name={`${field}.ar`}
              label={`${field}`}
              control={control}
              required={["name", "job", "speaks", "education"].includes(field)}
              multiline={field === "description"}
              rows={field === "description" ? 4 : undefined}
            />
          ))}
        </Stack>

        {/* Tab 1: English fields */}
        <Stack spacing={2} sx={{ display: activeTab === 1 ? "block" : "none" }}>
          {LOCALIZED_FIELDS.map((field) => (
            <TextInputComponent
              key={field}
              name={`${field}.en`}
              label={`${field}`}
              control={control}
              required={["name", "job", "speaks", "education"].includes(field)}
              multiline={field === "description"}
              rows={field === "description" ? 4 : undefined}
            />
          ))}
        </Stack>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={20} /> : null}
        >
          {t("save")}
        </Button>
      </Stack>
    </Box>
  );
};

export default TeamForm;
