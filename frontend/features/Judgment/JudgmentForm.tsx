"use client";

import { useFieldArray, useForm, Controller, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { Close, Delete, Link as LinkIcon, PersonAdd, PersonSearch } from "@mui/icons-material";
import TextInputComponent from "@/components/MUI/ControlMUItextField";
import { ImageInput } from "@/components/MUI/ImageInput";
import Editor from "@/components/TextEditor";
import { createJudgment, updateJudgment } from "@/backend-api/judgments/mutations";
import { JUDGMENTS_QUERY_KEY } from "@/backend-api/judgments/hooks";
import { Judgment } from "@/backend-api/judgments/types";
import { Team } from "@/backend-api/teams/types";
import { getBackendUri, handleCompression } from "@/utils/helperFunctions";
import { LocalizedField } from "@/backend-api/globalTypes";
import { useState } from "react";
import { fetchTeams } from "@/backend-api/teams/queries";
import { TEAMS_QUERY_KEY } from "@/backend-api/teams/hooks";

// ─── Types ────────────────────────────────────────────────────────────────────
type AuthorFormValue =
  | { mode: "team"; teamId: string }
  | { mode: "custom"; image: File | string | null; name: LocalizedField; job: LocalizedField; email: string };

type JudgmentFormValues = {
  title: LocalizedField;
  type: string;
  description: LocalizedField;
  image: File | string | null;
  writtenBy: AuthorFormValue[];
};

interface JudgmentFormProps {
  defaultData?: Judgment;
}

const JUDGMENT_TYPES = ["judgment", "general"] as const;

// ─── LinkedAuthorCard (team reference) ────────────────────────────────────────
const LinkedAuthorCard = ({
  index,
  teamId,
  teams,
  remove,
}: {
  index: number;
  teamId: string;
  teams: Team[];
  remove: (i: number) => void;
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const team = teams.find((m) => m._id === teamId);

  return (
    <Card variant="outlined" sx={{ borderColor: "primary.light" }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={1.5} flex={1} minWidth={0}>
            <Avatar
              src={team?.image ? getBackendUri(team.image) : undefined}
              sx={{ width: 40, height: 40, flexShrink: 0 }}
            />
            <Box minWidth={0}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography fontWeight={600} fontSize="0.88rem" noWrap>
                  {team?.name?.[lang] || team?.name?.en || teamId}
                </Typography>
                <Chip
                  icon={<LinkIcon sx={{ fontSize: "12px !important" }} />}
                  label={t("teamMember")}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              </Stack>
              {team?.job && (
                <Typography color="text.secondary" fontSize="0.75rem" noWrap>
                  {team.job[lang] || team.job.en}
                </Typography>
              )}
              {team?.email && (
                <Typography color="text.disabled" fontSize="0.7rem">{team.email}</Typography>
              )}
            </Box>
          </Stack>
          <IconButton size="small" color="error" onClick={() => remove(index)}>
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── CustomAuthorCard (embedded data) ─────────────────────────────────────────
const CustomAuthorCard = ({
  index,
  control,
  remove,
}: {
  index: number;
  control: any;
  remove: (i: number) => void;
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  const imageValue = useWatch({ control, name: `writtenBy.${index}.image` });
  const imagePath = typeof imageValue === "string" && imageValue
    ? getBackendUri(imageValue)
    : undefined;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              {t("author")} #{index + 1}
            </Typography>
            <IconButton size="small" color="error" onClick={() => remove(index)}>
              <Delete fontSize="small" />
            </IconButton>
          </Stack>

          <ImageInput name={`writtenBy.${index}.image`} control={control as any} imagePath={imagePath} />

          <TextInputComponent name={`writtenBy.${index}.email`} label="email" control={control} type="email" />

          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
            <Tab label={t("arabic")} />
            <Tab label={t("english")} />
          </Tabs>

          <Stack spacing={2} sx={{ display: tab === 0 ? "flex" : "none" }}>
            <TextInputComponent name={`writtenBy.${index}.name.ar`} label="name" control={control} />
            <TextInputComponent name={`writtenBy.${index}.job.ar`}  label="job"  control={control} />
          </Stack>
          <Stack spacing={2} sx={{ display: tab === 1 ? "flex" : "none" }}>
            <TextInputComponent name={`writtenBy.${index}.name.en`} label="name" control={control} />
            <TextInputComponent name={`writtenBy.${index}.job.en`}  label="job"  control={control} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─── AuthorCard dispatcher ────────────────────────────────────────────────────
const AuthorCard = ({
  index,
  control,
  remove,
  teams,
}: {
  index: number;
  control: any;
  remove: (i: number) => void;
  teams: Team[];
}) => {
  const mode   = useWatch({ control, name: `writtenBy.${index}.mode` });
  const teamId = useWatch({ control, name: `writtenBy.${index}.teamId` });

  if (mode === "team") {
    return <LinkedAuthorCard index={index} teamId={teamId} teams={teams} remove={remove} />;
  }
  return <CustomAuthorCard index={index} control={control} remove={remove} />;
};

// ─── JudgmentForm ─────────────────────────────────────────────────────────────
const JudgmentForm = ({ defaultData }: JudgmentFormProps) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!defaultData;

  const [mainTab, setMainTab]         = useState(0);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: [TEAMS_QUERY_KEY],
    queryFn: () => fetchTeams(),
  });

  // Build default writtenBy — team refs stay as team, custom stays as custom
  const buildDefaultAuthors = (): AuthorFormValue[] =>
    (defaultData?.writtenBy || []).map((a) => {
      const tid = a.teamId;
      if (tid) {
        const id = typeof tid === "object" ? (tid as any)._id : tid;
        return { mode: "team" as const, teamId: id };
      }
      return {
        mode: "custom" as const,
        image: a.image || null,
        name:  { ar: a.name?.ar || "", en: a.name?.en || "" },
        job:   { ar: a.job?.ar  || "", en: a.job?.en  || "" },
        email: a.email || "",
      };
    });

  const { control, handleSubmit } = useForm<JudgmentFormValues>({
    defaultValues: {
      title:       { ar: defaultData?.title?.ar || "", en: defaultData?.title?.en || "" },
      type:        defaultData?.type || "",
      description: { ar: defaultData?.description?.ar || "", en: defaultData?.description?.en || "" },
      image:       defaultData?.image || null,
      writtenBy:   buildDefaultAuthors(),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "writtenBy" });

  const coverImageValue = useWatch({ control, name: "image" });
  const coverImagePath = typeof coverImageValue === "string" && coverImageValue
    ? getBackendUri(coverImageValue)
    : undefined;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (values: JudgmentFormValues) => {
      const fd = new FormData();
      if (values.title.ar)       fd.append("title[ar]",       values.title.ar);
      if (values.title.en)       fd.append("title[en]",       values.title.en);
      if (values.type)           fd.append("type",            values.type);
      if (values.description.ar) fd.append("description[ar]", values.description.ar);
      if (values.description.en) fd.append("description[en]", values.description.en);

      if (values.image instanceof File) {
        const compressed = await handleCompression(values.image);
        if (compressed) fd.append("image", compressed);
      } else if (typeof values.image === "string" && values.image) {
        fd.append("image", values.image);
      }

      const authorsPayload = await Promise.all(
        values.writtenBy.map(async (author, i) => {
          // Team reference — store id only
          if (author.mode === "team") {
            return { teamId: author.teamId };
          }

          // Custom author — handle image upload
          let imageRef: string | undefined;
          if (author.image instanceof File) {
            const compressed = await handleCompression(author.image);
            if (compressed) fd.append(`authorImage_${i}`, compressed);
          } else if (typeof author.image === "string" && author.image) {
            imageRef = author.image;
          }

          return {
            image: imageRef,
            name:  author.name,
            job:   author.job,
            email: author.email || undefined,
          };
        })
      );

      fd.append("writtenBy", JSON.stringify(authorsPayload));

      return isEditing
        ? updateJudgment({ id: defaultData!._id, data: fd })
        : createJudgment(fd);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [JUDGMENTS_QUERY_KEY] });
      router.back();
    },
    onError: () => toast.error(t("somethingWentWrong")),
  });

  // ── Author helpers ─────────────────────────────────────────────────────────
  const addFromTeam = (team: Team) => {
    append({ mode: "team", teamId: team._id } as any);
    setTeamPickerOpen(false);
  };

  const addCustomAuthor = () =>
    append({ mode: "custom", image: null, name: { ar: "", en: "" }, job: { ar: "", en: "" }, email: "" } as any);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box component="form" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      <Stack spacing={3} maxWidth={700}>

        {/* Cover image */}
        <ImageInput name="image" control={control as any} imagePath={coverImagePath} />

        {/* Type */}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <FormControl size="small" fullWidth>
              <InputLabel>{t("type")}</InputLabel>
              <Select {...field} label={t("type")}>
                <MenuItem value=""><em>{t("none")}</em></MenuItem>
                {JUDGMENT_TYPES.map((tp) => (
                  <MenuItem key={tp} value={tp}>
                    <Chip label={t(tp)} size="small" variant="outlined" />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        {/* Title + Description AR/EN */}
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} variant="fullWidth">
          <Tab label={t("arabic")} />
          <Tab label={t("english")} />
        </Tabs>

        <Stack spacing={2} sx={{ display: mainTab === 0 ? "flex" : "none" }}>
          <TextInputComponent name="title.ar" label="title" control={control} required />
          <Typography variant="subtitle2" color="text.secondary">{t("description")}</Typography>
          <Controller
            name="description.ar"
            control={control}
            render={({ field }) => <Editor value={field.value} onChange={field.onChange} />}
          />
        </Stack>
        <Stack spacing={2} sx={{ display: mainTab === 1 ? "flex" : "none" }}>
          <TextInputComponent name="title.en" label="title" control={control} />
          <Typography variant="subtitle2" color="text.secondary">{t("description")}</Typography>
          <Controller
            name="description.en"
            control={control}
            render={({ field }) => <Editor value={field.value} onChange={field.onChange} />}
          />
        </Stack>

        <Divider />

        {/* Written by */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography variant="subtitle1" fontWeight={700}>{t("writtenBy")}</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<PersonSearch />} onClick={() => setTeamPickerOpen(true)}>
              {t("addFromTeam")}
            </Button>
            <Button size="small" variant="outlined" startIcon={<PersonAdd />} onClick={addCustomAuthor}>
              {t("addCustom")}
            </Button>
          </Stack>
        </Stack>

        {fields.length === 0 && (
          <Box sx={{ textAlign: "center", py: 3, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
            <Typography color="text.disabled" fontSize="0.85rem">{t("noAuthors")}</Typography>
          </Box>
        )}

        {fields.map((field, index) => (
          <AuthorCard key={field.id} index={index} control={control} remove={remove} teams={teams} />
        ))}

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={mutation.isPending}
          startIcon={mutation.isPending ? <CircularProgress size={18} /> : null}
        >
          {t("save")}
        </Button>
      </Stack>

      {/* Team picker dialog */}
      <Dialog open={teamPickerOpen} onClose={() => setTeamPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {t("selectTeamMember")}
          <IconButton size="small" onClick={() => setTeamPickerOpen(false)}><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} pt={1}>
            {teams.map((team) => (
              <Box
                key={team._id}
                onClick={() => addFromTeam(team)}
                sx={{
                  display: "flex", alignItems: "center", gap: 2,
                  p: 1.5, borderRadius: 2,
                  border: "1px solid", borderColor: "divider", cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                  transition: "all 0.2s ease",
                }}
              >
                <Avatar src={team.image ? getBackendUri(team.image) : undefined} sx={{ width: 44, height: 44 }} />
                <Box>
                  <Typography fontWeight={600} fontSize="0.9rem">
                    {team.name?.[lang] || team.name?.en || "—"}
                  </Typography>
                  <Typography color="text.secondary" fontSize="0.78rem">
                    {team.job?.[lang] || team.job?.en || ""}
                  </Typography>
                  {team.email && (
                    <Typography color="text.disabled" fontSize="0.72rem">{team.email}</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default JudgmentForm;
