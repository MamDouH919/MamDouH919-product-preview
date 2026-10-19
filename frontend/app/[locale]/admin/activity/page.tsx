"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, ChipProps, MenuItem, Stack, TablePagination, TextField, Tooltip, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useActivityLogFacetsQuery, useActivityLogQuery } from "@/backend-api/activity-log/hooks";
import { ActivityAction, ActivityLogEntry, ActivityLogFilters } from "@/backend-api/activity-log/types";
import SimpleTable from "@/components/Table/SimpleTable";
import CustomLink from "@/components/CustomLink";
import { formatDateTime } from "@/features/Order/format";

const ACTIONS: ActivityAction[] = ["create", "update", "delete"];
const ACTION_COLORS: Record<ActivityAction, ChipProps["color"]> = { create: "success", update: "info", delete: "error" };
/** Path segments that have a detail page in the dashboard, so an entry can link to its record. */
const LINKABLE = new Set(["banners", "categories", "contact", "orders", "pages", "products", "returns", "sections", "sub-categories"]);

const recordLink = (row: ActivityLogEntry): string | undefined => {
  if (!row.entityId || row.action === "delete") return undefined;
  const segment = row.path.split("/").filter(Boolean)[0];
  return segment && LINKABLE.has(segment) && /^[0-9a-f]{24}$/.test(row.entityId) ? `/admin/${segment}/${row.entityId}` : undefined;
};

const ActivityLogPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const [filters, setFilters] = useState<ActivityLogFilters>({ page: 1, limit: 50 });
  const { data, isLoading } = useActivityLogQuery(filters);
  const { data: facets } = useActivityLogFacetsQuery();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("activityLog") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<ActivityLogFilters>) => setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  // Falls back to the raw name for resources without a translation.
  const resourceLabel = (resource: string) => t(`resourceName.${resource}`, { defaultValue: resource });

  const columns = useMemo(
    () => [
      {
        id: "when",
        header: t("date"),
        render: (row: ActivityLogEntry) => (
          <Typography variant="body2" whiteSpace="nowrap">
            {formatDateTime(row.createdAt, lang)}
          </Typography>
        ),
      },
      {
        id: "who",
        header: t("by"),
        render: (row: ActivityLogEntry) => (
          <Stack>
            <Typography variant="body2" fontWeight={600}>
              {row.userName ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.userEmail}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "what",
        header: t("action"),
        render: (row: ActivityLogEntry) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" color={ACTION_COLORS[row.action]} label={t(`activityAction.${row.action}`)} />
            <Typography variant="body2">{resourceLabel(row.resource)}</Typography>
          </Stack>
        ),
      },
      {
        id: "record",
        header: t("record"),
        render: (row: ActivityLogEntry) => {
          const label = row.entityLabel ?? row.entityId?.slice(-6) ?? "—";
          const link = recordLink(row);
          return (
            <Tooltip title={`${row.method} ${row.path}`}>
              {link ? (
                <span>
                  <CustomLink href={link}>
                    <Typography variant="body2" color="primary" fontWeight={600}>
                      {label}
                    </Typography>
                  </CustomLink>
                </span>
              ) : (
                <Typography variant="body2">{label}</Typography>
              )}
            </Tooltip>
          );
        },
      },
      {
        id: "fields",
        header: t("fieldsChanged"),
        render: (row: ActivityLogEntry) => (
          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280, display: "block" }}>
            {row.fields.length ? row.fields.join(", ") : "—"}
          </Typography>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, lang]
  );

  return (
    <Stack spacing={2} height="100%">
      <Typography variant="body2" color="text.secondary">
        {t("activityLogHint")}
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField select size="small" label={t("by")} value={filters.userId ?? ""} onChange={(e) => set({ userId: e.target.value || undefined })} sx={{ minWidth: 200 }}>
          <MenuItem value="">{t("all")}</MenuItem>
          {(facets?.users ?? []).map((u) => (
            <MenuItem key={u._id} value={u._id}>
              {u.name ?? u.email ?? u._id}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label={t("section")} value={filters.resource ?? ""} onChange={(e) => set({ resource: e.target.value || undefined })} sx={{ minWidth: 180 }}>
          <MenuItem value="">{t("all")}</MenuItem>
          {(facets?.resources ?? []).map((r) => (
            <MenuItem key={r} value={r}>
              {resourceLabel(r)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("action")}
          value={filters.action ?? ""}
          onChange={(e) => set({ action: (e.target.value || undefined) as ActivityAction | undefined })}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">{t("all")}</MenuItem>
          {ACTIONS.map((a) => (
            <MenuItem key={a} value={a}>
              {t(`activityAction.${a}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label={t("from")}
          value={filters.from ?? ""}
          onChange={(e) => set({ from: e.target.value || undefined })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="date"
          size="small"
          label={t("to")}
          value={filters.to ?? ""}
          onChange={(e) => set({ to: e.target.value || undefined })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data?.data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>

      <TablePagination
        component="div"
        count={data?.total ?? 0}
        page={(filters.page ?? 1) - 1}
        onPageChange={(_, page) => setFilters((prev) => ({ ...prev, page: page + 1 }))}
        rowsPerPage={filters.limit ?? 50}
        onRowsPerPageChange={(e) => setFilters((prev) => ({ ...prev, limit: parseInt(e.target.value, 10), page: 1 }))}
        rowsPerPageOptions={[50, 100]}
      />
    </Stack>
  );
};

export default ActivityLogPage;
