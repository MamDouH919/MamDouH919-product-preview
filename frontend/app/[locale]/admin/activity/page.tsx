"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Chip,
  ChipProps,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  useActivityLogFacetsQuery,
  useActivityLogQuery,
} from "@/backend-api/activity-log/hooks";
import {
  ActivityAction,
  ActivityLogEntry,
  ActivityLogFilters,
} from "@/backend-api/activity-log/types";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import SimpleTable from "@/components/Table/SimpleTable";
import CustomLink from "@/components/CustomLink";
import { formatDateTime } from "@/features/Order/format";

const ACTIONS: ActivityAction[] = ["create", "update", "delete"];
const ACTION_COLORS: Record<ActivityAction, ChipProps["color"]> = {
  create: "success",
  update: "info",
  delete: "error",
};
/** Path segments that have a detail page in the dashboard, so an entry can link to its record. */
const LINKABLE = new Set([
  "banners",
  "categories",
  "contact",
  "orders",
  "pages",
  "products",
  "returns",
  "sections",
  "sub-categories",
]);

const recordLink = (row: ActivityLogEntry): string | undefined => {
  if (!row.entityId || row.action === "delete") return undefined;
  const segment = row.path.split("/").filter(Boolean)[0];
  return segment && LINKABLE.has(segment) && /^[0-9a-f]{24}$/.test(row.entityId)
    ? `/admin/${segment}/${row.entityId}`
    : undefined;
};

const ActivityLogPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const [filters, setFilters] = useState<ActivityLogFilters>({
    page: 1,
    limit: 50,
  });
  const { data, isLoading } = useActivityLogQuery(filters);
  const { data: facets } = useActivityLogFacetsQuery();

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("activityLog") }],
        breadCrumbBtns: [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<ActivityLogFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  // Falls back to the raw name for resources without a translation.
  const resourceLabel = (resource: string) =>
    t(`resourceName.${resource}`, { defaultValue: resource });

  const chips = [
    ...(filters.userId
      ? [
          {
            key: "user",
            label: (() => {
              const u = facets?.users.find((x) => x._id === filters.userId);
              return u?.name ?? u?.email ?? t("by");
            })(),
            onDelete: () => set({ userId: undefined }),
          },
        ]
      : []),
    ...(filters.resource
      ? [
          {
            key: "resource",
            label: resourceLabel(filters.resource),
            onDelete: () => set({ resource: undefined }),
          },
        ]
      : []),
    ...(filters.action
      ? [
          {
            key: "action",
            label: t(`activityAction.${filters.action}`),
            onDelete: () => set({ action: undefined }),
          },
        ]
      : []),
    ...(filters.from || filters.to
      ? [
          {
            key: "date",
            label: `${filters.from ?? "…"} → ${filters.to ?? "…"}`,
            onDelete: () => set({ from: undefined, to: undefined }),
          },
        ]
      : []),
  ];

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
            <Chip
              size="small"
              color={ACTION_COLORS[row.action]}
              label={t(`activityAction.${row.action}`)}
            />
            <Typography variant="body2">
              {resourceLabel(row.resource)}
            </Typography>
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
                    <Typography
                      variant="body2"
                      color="primary"
                      fontWeight={600}
                    >
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
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ maxWidth: 280, display: "block" }}
          >
            {row.fields.length ? row.fields.join(", ") : "—"}
          </Typography>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, lang],
  );

  return (
    <Stack spacing={2} height="100%">
      <Typography variant="body2" color="text.secondary">
        {t("activityLogHint")}
      </Typography>
      <FilterLayout
        activeCount={chips.length}
        chips={chips}
        onClear={() => setFilters((prev) => ({ page: 1, limit: prev.limit }))}
        filters={
          <>
            <FilterSelect
              label={t("by")}
              value={filters.userId}
              onChange={(userId) => set({ userId })}
              options={(facets?.users ?? []).map((u) => ({
                value: u._id,
                label: u.name ?? u.email ?? u._id,
              }))}
            />
            <FilterSelect
              label={t("section")}
              value={filters.resource}
              onChange={(resource) => set({ resource })}
              options={(facets?.resources ?? []).map((r) => ({
                value: r,
                label: resourceLabel(r),
              }))}
            />
            <FilterSelect
              label={t("action")}
              value={filters.action}
              onChange={(action) => set({ action })}
              options={ACTIONS.map((a) => ({
                value: a,
                label: t(`activityAction.${a}`),
              }))}
            />
            <Stack direction="row" gap={1}>
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
          </>
        }
      >
        <SimpleTable
          columns={columns}
          data={data?.data ?? []}
          height="100%"
          loading={isLoading}
          pagination={{
            count: data?.total ?? 0,
            page: (filters.page ?? 1) - 1,
            rowsPerPage: filters.limit ?? 50,
            onPageChange: (page) =>
              setFilters((prev) => ({ ...prev, page: page + 1 })),
            onRowsPerPageChange: (limit) =>
              setFilters((prev) => ({ ...prev, limit, page: 1 })),
            rowsPerPageOptions: [50, 100],
          }}
        />
      </FilterLayout>
    </Stack>
  );
};

export default ActivityLogPage;
