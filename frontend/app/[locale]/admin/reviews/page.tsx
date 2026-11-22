"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Chip,
  ChipProps,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Rating,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import HighlightOff from "@mui/icons-material/HighlightOff";
import ReplyOutlined from "@mui/icons-material/ReplyOutlined";
import Delete from "@mui/icons-material/Delete";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  REVIEWS_QUERY_KEY,
  useReviewsQuery,
} from "@/backend-api/reviews/hooks";
import {
  deleteReview,
  replyToReview,
  setReviewStatus,
} from "@/backend-api/reviews/mutations";
import {
  AdminReview,
  REVIEW_STATUSES,
  ReviewFilters,
  ReviewStatus,
} from "@/backend-api/reviews/types";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatDateTime, localized } from "@/features/Order/format";
import { getBackendUri } from "@/utils/helperFunctions";

const STATUS_COLORS: Record<ReviewStatus, ChipProps["color"]> = {
  pending: "warning",
  approved: "success",
  rejected: "default",
};

const errorMessage = (error: any, fallback: string): string => {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join(", ") : (message ?? fallback);
};

const ReviewsPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  // Pending first: that's the queue someone opens this page to work through.
  const [filters, setFilters] = useState<ReviewFilters>({
    status: "pending",
    page: 1,
    limit: 25,
  });
  const [search, setSearch] = useState("");
  const [replying, setReplying] = useState<AdminReview | null>(null);
  const [replyText, setReplyText] = useState("");
  const [deleting, setDeleting] = useState<AdminReview | null>(null);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((prev) => ({
          ...prev,
          search: search || undefined,
          page: 1,
        })),
      350,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useReviewsQuery(filters);

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("reviews") }],
        breadCrumbBtns: [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onError = (error: unknown) =>
    toast.error(errorMessage(error, t("somethingWentWrong")));
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY] });

  const statusMutation = useMutation({
    mutationFn: setReviewStatus,
    onSuccess: (_, { status }) => {
      refresh();
      toast.success(
        t(status === "approved" ? "reviewApproved" : "reviewRejected"),
      );
    },
    onError,
  });

  const replyMutation = useMutation({
    mutationFn: replyToReview,
    onSuccess: () => {
      refresh();
      setReplying(null);
      toast.success(t("saveSuccessfully"));
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      refresh();
      setDeleting(null);
      toast.success(t("deletedSuccessfully"));
    },
    onError,
  });

  const columns = useMemo(
    () => [
      {
        id: "product",
        header: t("product"),
        render: (row: AdminReview) => (
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            minWidth={180}
          >
            <Avatar
              variant="rounded"
              src={
                row.product?.images?.[0]
                  ? getBackendUri(row.product.images[0])
                  : undefined
              }
              sx={{ width: 40, height: 40 }}
            />
            <Typography variant="body2" fontWeight={600}>
              {row.product
                ? localized(row.product.name, lang)
                : t("deletedProduct")}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "customer",
        header: t("customer"),
        render: (row: AdminReview) => (
          <Stack>
            <Typography variant="body2">
              {row.customer?.name ?? row.authorName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.customer?.email}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "review",
        header: t("review"),
        render: (row: AdminReview) => (
          <Stack spacing={0.5} maxWidth={420}>
            <Rating value={row.rating} readOnly size="small" />
            {row.comment && (
              <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                {row.comment}
              </Typography>
            )}
            {row.reply && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ borderInlineStart: 2, borderColor: "divider", ps: 1 }}
              >
                {t("storeReply")}: {row.reply}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(row.createdAt, lang)}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "status",
        header: t("status"),
        render: (row: AdminReview) => (
          <Chip
            size="small"
            color={STATUS_COLORS[row.status]}
            label={t(`reviewStatus.${row.status}`)}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        render: (row: AdminReview) => (
          <Stack direction="row" spacing={0.5}>
            {row.status !== "approved" && (
              <Tooltip title={t("approve")}>
                <IconButton
                  size="small"
                  color="success"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: row._id, status: "approved" })
                  }
                >
                  <CheckCircleOutline fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {row.status !== "rejected" && (
              <Tooltip title={t("reject")}>
                <IconButton
                  size="small"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: row._id, status: "rejected" })
                  }
                >
                  <HighlightOff fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={t("reply")}>
              <IconButton
                size="small"
                onClick={() => {
                  setReplying(row);
                  setReplyText(row.reply ?? "");
                }}
              >
                <ReplyOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t("delete")}>
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleting(row)}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [t, lang, statusMutation],
  );

  const chips = [
    ...(filters.status
      ? [
          {
            key: "status",
            label: t(`reviewStatus.${filters.status}`),
            onDelete: () =>
              setFilters((p) => ({ ...p, status: undefined, page: 1 })),
          },
        ]
      : []),
    ...(filters.rating
      ? [
          {
            key: "rating",
            label: "★".repeat(filters.rating),
            onDelete: () =>
              setFilters((p) => ({ ...p, rating: undefined, page: 1 })),
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: "search",
            label: `${t("search")}: ${search}`,
            onDelete: () => setSearch(""),
          },
        ]
      : []),
  ];

  return (
    <Stack spacing={2} height="100%">
      <FilterLayout
        search={{ value: search, onChange: setSearch }}
        activeCount={chips.length}
        chips={chips}
        onClear={() => {
          setSearch("");
          setFilters((prev) => ({ page: 1, limit: prev.limit }));
        }}
        filters={
          <>
            <FilterSelect
              label={t("status")}
              value={filters.status}
              onChange={(status) =>
                setFilters((prev) => ({ ...prev, status, page: 1 }))
              }
              options={REVIEW_STATUSES.map((st) => ({
                value: st,
                label: `${t(`reviewStatus.${st}`)}${data ? ` (${data.statusCounts[st]})` : ""}`,
              }))}
            />
            <FilterSelect
              label={t("rating")}
              value={filters.rating ? String(filters.rating) : undefined}
              onChange={(r) =>
                setFilters((prev) => ({
                  ...prev,
                  rating: r ? Number(r) : undefined,
                  page: 1,
                }))
              }
              options={[5, 4, 3, 2, 1].map((n) => ({
                value: String(n),
                label: "★".repeat(n),
              }))}
            />
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
            rowsPerPage: filters.limit ?? 25,
            onPageChange: (page) =>
              setFilters((prev) => ({ ...prev, page: page + 1 })),
            onRowsPerPageChange: (limit) =>
              setFilters((prev) => ({ ...prev, limit, page: 1 })),
          }}
        />
      </FilterLayout>

      <Dialog
        open={!!replying}
        onClose={() => setReplying(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t("replyToReview")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            {replying?.comment && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ whiteSpace: "pre-line" }}
              >
                “{replying.comment}”
              </Typography>
            )}
            <TextField
              multiline
              minRows={3}
              fullWidth
              label={t("reply")}
              helperText={t("replyHint")}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplying(null)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            disabled={replyMutation.isPending}
            onClick={() =>
              replying &&
              replyMutation.mutate({
                id: replying._id,
                reply: replyText.trim(),
              })
            }
          >
            {t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)}>
        <DialogTitle>{t("deleteReviewConfirm")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t("deleteReviewHint")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>{t("cancel")}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting._id)}
          >
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default ReviewsPage;
