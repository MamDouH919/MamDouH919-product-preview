"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { COURIERS_QUERY_KEY, saveCourier, useCouriersQuery } from "@/backend-api/couriers/api";
import { Courier, CourierType } from "@/backend-api/couriers/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatMinorMoney } from "@/features/Order/format";
import { toastError } from "@/features/Purchasing/shared";
import SettleCourierDialog from "@/features/Finance/SettleCourierDialog";

/** Who delivers, and the COD cash each of them holds until they settle. */
const CouriersPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { data: couriers, isLoading } = useCouriersQuery();
  const [editing, setEditing] = useState<{ key: number; courier?: Courier } | null>(null);
  const [settling, setSettling] = useState<string | null>(null);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("couriers") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: t("name"),
        render: (row: Courier) => (
          <Stack>
            <Typography variant="body2" fontWeight={600}>{row.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t(`courierType.${row.type}`)}
              {row.phone ? ` · ${row.phone}` : ""}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "held",
        header: t("cashHeld"),
        render: (row: Courier) => (
          <Typography variant="body2" fontWeight={700} color={row.heldMinor > 0 ? "warning.main" : "text.secondary"}>
            {formatMinorMoney(row.heldMinor, currency)}
          </Typography>
        ),
      },
      { id: "collections", header: t("unsettledCollections"), render: (row: Courier) => row.collections },
      { id: "status", header: t("status"), render: (row: Courier) => <Chip size="small" color={row.isActive ? "success" : "default"} label={t(row.isActive ? "active" : "inactive")} /> },
      {
        id: "actions",
        header: "",
        render: (row: Courier) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setEditing({ key: Date.now(), courier: row })}>{t("edit")}</Button>
            <Button size="small" variant="contained" disabled={row.collections === 0 && row.heldMinor === 0} onClick={() => setSettling(row._id)}>
              {t("settle")}
            </Button>
          </Stack>
        ),
      },
    ],
    [t, currency],
  );

  return (
    <Stack spacing={2} height="100%">
      <Button variant="contained" sx={{ alignSelf: "flex-start" }} onClick={() => setEditing({ key: Date.now() })}>
        {t("newCourier")}
      </Button>
      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={couriers ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>
      {editing && (
        <CourierDialog
          key={editing.key}
          courier={editing.courier}
          onClose={() => setEditing(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: [COURIERS_QUERY_KEY] });
            setEditing(null);
          }}
        />
      )}
      <SettleCourierDialog key={settling ?? "none"} courierId={settling} onClose={() => setSettling(null)} />
    </Stack>
  );
};

const CourierDialog = ({ courier, onClose, onSaved }: { courier?: Courier; onClose: () => void; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(courier?.name ?? "");
  const [type, setType] = useState<CourierType>(courier?.type ?? "in_house");
  const [phone, setPhone] = useState(courier?.phone ?? "");
  const [isActive, setIsActive] = useState(courier?.isActive ?? true);
  const mutation = useMutation({
    mutationFn: () => saveCourier({ id: courier?._id, name: name.trim(), type, phone: phone.trim() || undefined, isActive }),
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      onSaved();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t(courier ? "editCourier" : "newCourier")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <TextField label={t("name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          <TextField select label={t("type")} value={type} onChange={(e) => setType(e.target.value as CourierType)}>
            <MenuItem value="in_house">{t("courierType.in_house")}</MenuItem>
            <MenuItem value="company">{t("courierType.company")}</MenuItem>
          </TextField>
          <TextField label={t("phone")} value={phone} onChange={(e) => setPhone(e.target.value)} slotProps={{ htmlInput: { dir: "ltr" } }} />
          {courier && <FormControlLabel control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />} label={t("active")} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{t("save")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CouriersPage;
