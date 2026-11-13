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
  Tooltip,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Visibility from "@mui/icons-material/Visibility";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { ROLES_QUERY_KEY, useRolesQuery } from "@/backend-api/roles/hooks";
import { deleteRole } from "@/backend-api/roles/mutations";
import { Role } from "@/backend-api/roles/types";
import SimpleTable from "@/components/Table/SimpleTable";
import RoleFormDialog from "@/features/Team/RoleFormDialog";

const RolesPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const { data, isLoading } = useRolesQuery();

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("team.roles") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
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
        header: t("team.roleName"),
        render: (row: Role) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight={700}>
              {row.name}
            </Typography>
            {row.builtIn && <Chip size="small" variant="outlined" label={t("team.builtIn")} />}
          </Stack>
        ),
      },
      {
        id: "permissions",
        header: t("team.permissions"),
        render: (row: Role) =>
          t("team.permissionsSummary", {
            areas: row.permissions.filter((p) => p.actions.length > 0).length,
            count: row.permissions.reduce((sum, p) => sum + p.actions.length, 0),
          }),
      },
      {
        id: "users",
        header: t("team.users"),
        render: (row: Role) => row.usersCount,
      },
      {
        id: "actions",
        header: "",
        render: (row: Role) => (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={row.builtIn ? t("team.view") : t("edit")}>
              <IconButton
                size="small"
                onClick={() => {
                  setEditing(row);
                  setFormOpen(true);
                }}
              >
                {row.builtIn ? <Visibility fontSize="small" /> : <Edit fontSize="small" />}
              </IconButton>
            </Tooltip>
            {!row.builtIn && (
              <Tooltip title={row.usersCount > 0 ? t("team.roleInUse") : t("delete")}>
                <span>
                  <IconButton size="small" color="error" disabled={row.usersCount > 0} onClick={() => setDeleting(row)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [t],
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          {t("team.addRole")}
        </Button>
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>

      {formOpen && <RoleFormDialog role={editing} readOnly={editing?.builtIn} onClose={() => setFormOpen(false)} />}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("team.deleteRoleConfirm", { name: deleting?.name })}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("team.deleteRoleHint")}</DialogContentText>
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

export default RolesPage;
