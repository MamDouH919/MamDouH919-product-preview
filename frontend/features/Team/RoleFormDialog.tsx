"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ROLES_QUERY_KEY } from "@/backend-api/roles/hooks";
import { createRole, updateRole } from "@/backend-api/roles/mutations";
import { PermissionAction, Role } from "@/backend-api/roles/types";
import { useStoreModules } from "@/Hooks/useStoreModules";
import { PERMISSION_GROUPS } from "./permissionCatalog";
import { ROLE_TEMPLATES } from "./roleTemplates";

type Grants = Record<string, PermissionAction[]>;

const RoleFormDialog = ({
  role,
  readOnly,
  onClose,
}: {
  /** The role being edited, or null to add one. Mounted fresh each time it opens. */
  role: Role | null;
  /** The built-in admin role: shown, never changed. */
  readOnly?: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { has } = useStoreModules();
  const [name, setName] = useState(role?.name ?? "");
  // Keyed by resource. Resources the editor doesn't show (a plan without that
  // area) are kept as they are, so saving never strips them.
  const [grants, setGrants] = useState<Grants>(() =>
    Object.fromEntries((role?.permissions ?? []).map((p) => [p.resource, [...p.actions]])),
  );
  const [submitted, setSubmitted] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);

  const groups = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        ...group,
        resources: group.resources.filter((r) => (r.modules ?? []).every(has)),
      })).filter((group) => group.resources.length > 0),
    [has],
  );

  const applyTemplate = (id: string) => {
    const template = ROLE_TEMPLATES.find((tpl) => tpl.id === id);
    if (!template) return;
    // Only what this store's plan offers; the rest of the role is replaced.
    const offered = new Set(groups.flatMap((g) => g.resources.map((r) => r.slug)));
    setName(t(`team.templates.${id}.name`));
    setNameTaken(false);
    setGrants(Object.fromEntries(Object.entries(template.grants).filter(([slug]) => offered.has(slug))));
  };

  const toggle = (slug: string, action: PermissionAction, on: boolean) =>
    setGrants((prev) => {
      const current = prev[slug] ?? [];
      return { ...prev, [slug]: on ? [...new Set([...current, action])] : current.filter((a) => a !== action) };
    });

  const toggleAll = (slug: string, actions: PermissionAction[], on: boolean) =>
    setGrants((prev) => ({ ...prev, [slug]: on ? [...actions] : [] }));

  const permissions = Object.entries(grants)
    .filter(([, actions]) => actions.length > 0)
    .map(([resource, actions]) => ({ resource, actions }));

  const mutation = useMutation({
    mutationFn: () => {
      const data = { name: name.trim(), permissions };
      return role ? updateRole({ id: role._id, data }) : createRole(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ROLES_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
      onClose();
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) return setNameTaken(true);
      const message = error?.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) ?? t("somethingWentWrong"));
    },
  });

  const nameError = !name.trim() ? t("required") : nameTaken ? t("team.roleNameTaken") : "";
  const permissionsError = permissions.length === 0 ? t("team.pickPermission") : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (nameError || permissionsError) return;
    mutation.mutate();
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={submit} noValidate>
        <DialogTitle>{readOnly ? role?.name : role ? t("team.editRole") : t("team.addRole")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {readOnly ? (
              <Typography color="text.secondary">{t("team.builtInHint")}</Typography>
            ) : (
              <TextField
                size="small"
                label={t("team.roleName")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTaken(false);
                }}
                error={!!(submitted || nameTaken) && !!nameError}
                helperText={submitted || nameTaken ? nameError : ""}
                autoFocus
              />
            )}

            {!role && (
              <Box>
                <Typography variant="overline" color="text.secondary" fontWeight={700}>
                  {t("team.startFromTemplate")}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {ROLE_TEMPLATES.map((tpl) => (
                    <Chip
                      key={tpl.id}
                      label={t(`team.templates.${tpl.id}.name`)}
                      title={t(`team.templates.${tpl.id}.description`)}
                      variant="outlined"
                      onClick={() => applyTemplate(tpl.id)}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            {groups.map((group) => (
              <Box key={group.id}>
                <Typography variant="overline" color="text.secondary" fontWeight={700}>
                  {t(`team.groups.${group.id}`)}
                </Typography>
                <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />} sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                  {group.resources.map((resource) => {
                    const held = grants[resource.slug] ?? [];
                    const all = held.length === resource.actions.length;
                    return (
                      <Stack
                        key={resource.slug}
                        direction={{ xs: "column", sm: "row" }}
                        alignItems={{ sm: "center" }}
                        spacing={{ xs: 0, sm: 2 }}
                        sx={{ px: 1.5, py: 0.5 }}
                      >
                        <FormControlLabel
                          sx={{ minWidth: 200, m: 0 }}
                          label={<Typography variant="body2" fontWeight={600}>{t(`team.resources.${resource.slug}`)}</Typography>}
                          control={
                            <Checkbox
                              size="small"
                              disabled={readOnly}
                              checked={all}
                              indeterminate={held.length > 0 && !all}
                              onChange={(e) => toggleAll(resource.slug, resource.actions, e.target.checked)}
                            />
                          }
                        />
                        <Stack direction="row" flexWrap="wrap" columnGap={1.5}>
                          {resource.actions.map((action) => (
                            <FormControlLabel
                              key={action}
                              sx={{ m: 0 }}
                              label={<Typography variant="body2">{t(`team.actions.${action}`)}</Typography>}
                              control={
                                <Checkbox
                                  size="small"
                                  disabled={readOnly}
                                  checked={held.includes(action)}
                                  onChange={(e) => toggle(resource.slug, action, e.target.checked)}
                                />
                              }
                            />
                          ))}
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            ))}
            {submitted && permissionsError && (
              <Typography variant="caption" color="error">
                {permissionsError}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{readOnly ? t("close") : t("cancel")}</Button>
          {!readOnly && (
            <Button type="submit" variant="contained" disabled={mutation.isPending}>
              {t("save")}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RoleFormDialog;
