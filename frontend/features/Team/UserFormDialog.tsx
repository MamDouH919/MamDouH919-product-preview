"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { USERS_QUERY_KEY } from "@/backend-api/users/hooks";
import { createUser, updateUser } from "@/backend-api/users/mutations";
import { StaffUser } from "@/backend-api/users/types";
import { ROLES_QUERY_KEY, useRolesQuery } from "@/backend-api/roles/hooks";

type FormState = { name: string; email: string; password: string; roleId: string; isActive: boolean };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UserFormDialog = ({
  user,
  isSelf,
  onClose,
}: {
  /** The account being edited, or null to add one. Mounted fresh each time it opens. */
  user: StaffUser | null;
  /** Editing your own account: you can't switch yourself off or change your own role. */
  isSelf: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: roles = [] } = useRolesQuery();
  const [form, setForm] = useState<FormState>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    roleId: user?.role?._id ?? "",
    isActive: user?.isActive ?? true,
  });
  const [submitted, setSubmitted] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "email") setEmailTaken(false);
  };

  const mutation = useMutation({
    mutationFn: () => {
      const base = { name: form.name.trim(), email: form.email.trim(), roleId: form.roleId };
      return user
        ? updateUser({
            id: user._id,
            data: { ...base, isActive: form.isActive, ...(form.password ? { password: form.password } : {}) },
          })
        : createUser({ ...base, password: form.password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      // Role headcounts change with every account.
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      onClose();
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) return setEmailTaken(true);
      const message = error?.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) ?? t("somethingWentWrong"));
    },
  });

  const passwordRequired = !user || form.password.length > 0;
  const errors = {
    name: !form.name.trim() ? t("required") : "",
    email: !EMAIL.test(form.email.trim()) ? t("team.emailInvalid") : emailTaken ? t("team.emailTaken") : "",
    roleId: !form.roleId ? t("required") : "",
    password:
      passwordRequired && (form.password.length < 8 || !/\d/.test(form.password)) ? t("team.passwordHint") : "",
  };
  const show = (key: keyof typeof errors) => (submitted || (key === "email" && emailTaken) ? errors[key] : "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    mutation.mutate();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{user ? t("team.editUser") : t("team.addUser")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              size="small"
              label={t("name")}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              error={!!show("name")}
              helperText={show("name")}
              autoFocus
            />
            <TextField
              size="small"
              type="email"
              label={t("email")}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              error={!!show("email")}
              helperText={show("email")}
              slotProps={{ htmlInput: { dir: "ltr" } }}
            />
            <TextField
              select
              size="small"
              label={t("team.role")}
              value={form.roleId}
              onChange={(e) => set("roleId", e.target.value)}
              disabled={isSelf}
              error={!!show("roleId")}
              helperText={show("roleId") || (isSelf ? t("team.ownRoleHint") : "")}
            >
              {roles.map((role) => (
                <MenuItem key={role._id} value={role._id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              type="password"
              label={user ? t("team.newPassword") : t("password")}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              error={!!show("password")}
              helperText={show("password") || (user ? t("team.passwordKeepHint") : t("team.passwordHint"))}
              slotProps={{ htmlInput: { dir: "ltr" } }}
            />
            {user && (
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    disabled={isSelf}
                    onChange={(e) => set("isActive", e.target.checked)}
                  />
                }
                label={form.isActive ? t("active") : t("inactive")}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {t("save")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserFormDialog;
