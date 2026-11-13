"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import { useAppDispatch, useAppSelector } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { USERS_QUERY_KEY, useUsersQuery } from "@/backend-api/users/hooks";
import { deleteUser } from "@/backend-api/users/mutations";
import { StaffUser } from "@/backend-api/users/types";
import { ROLES_QUERY_KEY } from "@/backend-api/roles/hooks";
import SimpleTable from "@/components/Table/SimpleTable";
import UserFormDialog from "@/features/Team/UserFormDialog";

const UsersPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useUsersQuery(debounced);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("team.users") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
      setDeleting(null);
      toast.success(t("deletedSuccessfully"));
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: t("name"),
        render: (row: StaffUser) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={700}>
              {row.name}
            </Typography>
            {row._id === currentUserId && <Chip size="small" variant="outlined" label={t("team.you")} />}
          </Stack>
        ),
      },
      {
        id: "email",
        header: t("email"),
        render: (row: StaffUser) => (
          <Typography variant="body2" dir="ltr" sx={{ textAlign: "start" }}>
            {row.email}
          </Typography>
        ),
      },
      {
        id: "role",
        header: t("team.role"),
        render: (row: StaffUser) =>
          row.role ? <Chip size="small" label={row.role.name} /> : <Typography color="text.secondary">—</Typography>,
      },
      {
        id: "status",
        header: t("status"),
        render: (row: StaffUser) => (
          <Chip size="small" color={row.isActive ? "success" : "default"} label={row.isActive ? t("active") : t("inactive")} />
        ),
      },
      {
        id: "createdAt",
        header: t("team.addedOn"),
        render: (row: StaffUser) => new Date(row.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB"),
      },
      {
        id: "actions",
        header: "",
        render: (row: StaffUser) => {
          const self = row._id === currentUserId;
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={t("edit")}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setEditing(row);
                    setFormOpen(true);
                  }}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={self ? t("team.cannotDeleteSelf") : t("delete")}>
                <span>
                  <IconButton size="small" color="error" disabled={self} onClick={() => setDeleting(row)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [t, lang, currentUserId],
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
        <TextField
          size="small"
          label={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 240 }}
        />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          {t("team.addUser")}
        </Button>
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>

      {formOpen && (
        <UserFormDialog
          user={editing}
          isSelf={!!editing && editing._id === currentUserId}
          onClose={() => setFormOpen(false)}
        />
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("team.deleteUserConfirm", { name: deleting?.name })}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("team.deleteUserHint")}</DialogContentText>
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

export default UsersPage;
