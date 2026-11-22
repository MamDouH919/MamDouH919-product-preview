"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DragAndDropTable from "@/components/Table/DragAndDropTable";
import { useBannersQuery } from "@/backend-api/banners/hooks";
import {
  deleteBanner,
  toggleBannerActive,
  updateBannerWeight,
} from "@/backend-api/banners/mutations";
import { Banner } from "@/backend-api/banners/types";
import Thumb from "@/components/Table/Thumb";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getBackendUri } from "@/utils/helperFunctions";
import {
  Box,
  IconButton,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Can from "@/components/Can";
import { usePermissions } from "@/Hooks/usePermissions";
import CustomLink from "@/components/CustomLink";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useAppDispatch } from "@/Store/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BANNERS_QUERY_KEY } from "@/backend-api/banners/hooks";
import { toast } from "sonner";
import {
  SETTINGS_QUERY_KEY,
  useSettingsQuery,
} from "@/backend-api/settings/hooks";
import { updateSettings } from "@/backend-api/settings/mutations";
import { BANNER_STYLES, BannerStyle } from "@/backend-api/settings/types";

const getNestedValue = (obj: any, path: string) => {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
};

const BannersList = () => {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: banners, isLoading } = useBannersQuery();
  const { data: settings } = useSettingsQuery();
  const bannerStyle = settings?.bannerStyle ?? "peek";

  const bannerStyleMutation = useMutation({
    mutationFn: (style: BannerStyle) => {
      const formData = new FormData();
      formData.append("bannerStyle", style);
      return updateSettings(formData);
    },
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const bannersData = useMemo(
    () =>
      banners?.map((banner: Banner) => ({ ...banner, id: banner._id })) ?? [],
    [banners],
  );

  const toggleActiveMutation = useMutation({
    mutationFn: toggleBannerActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BANNERS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [BANNERS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const handleReorder = useCallback(
    async (reordered: any[], draggedId: string) => {
      const draggedItem = reordered.find((item) => item.id === draggedId);
      if (draggedItem) {
        const newIndex = reordered.indexOf(draggedItem);
        await updateBannerWeight({ id: draggedItem._id, weight: newIndex + 1 });
      }
    },
    [],
  );

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("banners") }],
        breadCrumbBtns: can("banners", "create")
          ? [
              {
                title: t("createBanner"),
                icon: "add",
                link: `/${i18n.language}/admin/banners/create`,
              },
            ]
          : [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "title",
        header: t("title"),
        render: (row: any) => (
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Thumb
              src={getBackendUri(getNestedValue(row, "image"))}
              alt={getNestedValue(row, `title.${lang}`) || ""}
              width={96}
              height={54}
            />
            <Typography variant="body2" fontWeight={600} noWrap>
              {getNestedValue(row, `title.${lang}`) ||
                getNestedValue(row, "title.en") ||
                ""}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "active",
        header: t("active"),
        render: (row: any) => (
          <Switch
            checked={!!row.active}
            onChange={(e) =>
              toggleActiveMutation.mutate({
                id: row._id,
                active: e.target.checked,
              })
            }
            disabled={toggleActiveMutation.isPending}
            size="small"
          />
        ),
      },
      {
        id: "actions",
        header: "",
        render: (row: any) => (
          <Stack direction="row" gap={0.25}>
            <Can resource="banners" action="update">
              <Tooltip title={t("edit")}>
                <IconButton
                  size="small"
                  component={CustomLink}
                  href={`/admin/banners/${row._id}`}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            </Can>
            <Can resource="banners" action="delete">
              <Tooltip title={t("delete")}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeleting(row)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Can>
          </Stack>
        ),
      },
    ],
    [t, lang, toggleActiveMutation],
  );

  return (
    <Stack spacing={1.5} height="100%">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        flexWrap="wrap"
      >
        <Typography variant="body2" color="text.secondary">
          {t("dragToReorder")}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography variant="body2" fontWeight={600}>
            {t("bannerStyle")}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={bannerStyle}
            disabled={!settings || bannerStyleMutation.isPending}
            onChange={(_, style: BannerStyle | null) =>
              style &&
              style !== bannerStyle &&
              bannerStyleMutation.mutate(style)
            }
            sx={{
              bgcolor: "background.paper",
              "& .MuiToggleButton-root": {
                borderRadius: 2,
                px: 1.5,
                textTransform: "none",
              },
            }}
          >
            {BANNER_STYLES.map((style) => (
              <ToggleButton key={style} value={style}>
                {t(`bannerStyles.${style}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Stack>
      <Box flex={1} minHeight={0}>
        <DragAndDropTable
          columns={columns}
          data={bannersData}
          onReorder={handleReorder}
          height="100%"
          loading={isLoading}
        />
      </Box>
      <ConfirmDialog
        title={deleting ? t("delete") : null}
        message={
          deleting
            ? getNestedValue(deleting, `title.${lang}`) ||
              getNestedValue(deleting, "title.en") ||
              ""
            : undefined
        }
        loading={deleteMutation.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          deleteMutation.mutate(deleting._id, {
            onSuccess: () => setDeleting(null),
          })
        }
      />
    </Stack>
  );
};

export default BannersList;
