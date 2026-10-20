"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import {
  createMoneyAccount,
  MONEY_ACCOUNTS_QUERY_KEY,
  MoneyAccount,
  MoneyAccountType,
  transferMoney,
  updateMoneyAccount,
  useMoneyAccountsQuery,
} from "@/backend-api/money-accounts/api";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatMinorMoney } from "@/features/Order/format";
import { AMOUNT, inputToMinor, toastError } from "@/features/Purchasing/shared";

const TYPES: MoneyAccountType[] = ["cash", "bank", "wallet"];

/** Where the store's money is: each cash box, bank and wallet with its balance from the books. */
const MoneyAccountsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const { data, isLoading } = useMoneyAccountsQuery();
  const [editing, setEditing] = useState<MoneyAccount | "new" | null>(null);
  const [transferring, setTransferring] = useState(0);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("moneyAccounts") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useMutation({
    mutationFn: updateMoneyAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MONEY_ACCOUNTS_QUERY_KEY] }),
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: t("name"),
        render: (row: MoneyAccount) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color={row.isActive ? "text.primary" : "text.disabled"}>{row.name}</Typography>
            {row.isDefault && <Chip size="small" color="primary" label={t("default")} />}
            {!row.isActive && <Chip size="small" label={t("inactive")} />}
          </Stack>
        ),
      },
      { id: "type", header: t("type"), render: (row: MoneyAccount) => t(`moneyAccountType.${row.type}`) },
      { id: "balance", header: t("balance"), render: (row: MoneyAccount) => formatMinorMoney(row.balanceMinor, currency) },
      {
        id: "actions",
        header: "",
        render: (row: MoneyAccount) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setEditing(row)}>{t("edit")}</Button>
            {!row.isDefault && row.isActive && (
              <Button size="small" disabled={update.isPending} onClick={() => update.mutate({ id: row._id, isDefault: true })}>{t("makeDefault")}</Button>
            )}
            {!row.isDefault && (
              <Button size="small" color={row.isActive ? "error" : "primary"} disabled={update.isPending} onClick={() => update.mutate({ id: row._id, isActive: !row.isActive })}>
                {row.isActive ? t("deactivate") : t("activate")}
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [t, currency, update],
  );

  const total = (data ?? []).reduce((sum, a) => sum + a.balanceMinor, 0);
  const active = (data ?? []).filter((a) => a.isActive);
  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <Typography variant="body2" color="text.secondary">{t("moneyAccountsHint")}</Typography>
        <Box flex={1} />
        <Chip variant="outlined" label={`${t("total")}: ${formatMinorMoney(total, currency)}`} />
        <Button variant="outlined" disabled={active.length < 2} onClick={() => setTransferring((n) => n + 1)}>{t("transferMoney")}</Button>
        <Button variant="contained" onClick={() => setEditing("new")}>{t("newMoneyAccount")}</Button>
      </Stack>
      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>
      {editing && <AccountDialog key={editing === "new" ? "new" : editing._id} account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {transferring > 0 && <TransferDialog key={transferring} accounts={active} onClose={() => setTransferring(0)} />}
    </Stack>
  );
};

const AccountDialog = ({ account, onClose }: { account: MoneyAccount | null; onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<MoneyAccountType>(account?.type ?? "bank");
  const mutation = useMutation({
    mutationFn: () => (account ? updateMoneyAccount({ id: account._id, name: name.trim() }) : createMoneyAccount({ name: name.trim(), type })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MONEY_ACCOUNTS_QUERY_KEY] });
      toast.success(t("savedSuccessfully"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{account ? t("editMoneyAccount") : t("newMoneyAccount")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <TextField label={t("name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          {/* The type is fixed once money has moved through the account. */}
          <TextField select label={t("type")} value={type} onChange={(e) => setType(e.target.value as MoneyAccountType)} disabled={!!account}>
            {TYPES.map((x) => <MenuItem key={x} value={x}>{t(`moneyAccountType.${x}`)}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{t("save")}</Button>
      </DialogActions>
    </Dialog>
  );
};

const TransferDialog = ({ accounts, onClose }: { accounts: MoneyAccount[]; onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const [fromId, setFromId] = useState(accounts.find((a) => a.isDefault)?._id ?? accounts[0]?._id ?? "");
  const [toId, setToId] = useState(accounts.find((a) => a._id !== fromId)?._id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const from = accounts.find((a) => a._id === fromId);
  const mutation = useMutation({
    mutationFn: () => transferMoney({ fromId, toId, amount, note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MONEY_ACCOUNTS_QUERY_KEY] });
      toast.success(t("moneyTransferred"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });
  const valid = AMOUNT.test(amount) && Number(amount) > 0 && !!fromId && !!toId && fromId !== toId;
  const tooMuch = valid && !!from && inputToMinor(amount) > from.balanceMinor;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("transferMoney")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <TextField
            select
            label={t("from")}
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value);
              if (e.target.value === toId) setToId(accounts.find((a) => a._id !== e.target.value)?._id ?? "");
            }}
          >
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>{`${a.name} (${formatMinorMoney(a.balanceMinor, currency)})`}</MenuItem>
            ))}
          </TextField>
          <TextField select label={t("to")} value={toId} onChange={(e) => setToId(e.target.value)}>
            {accounts.filter((a) => a._id !== fromId).map((a) => <MenuItem key={a._id} value={a._id}>{a.name}</MenuItem>)}
          </TextField>
          <TextField
            label={t("amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value.trim())}
            error={(!!amount && !AMOUNT.test(amount)) || tooMuch}
            helperText={tooMuch ? t("transferMoreThanHeld") : undefined}
            slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
          />
          <TextField label={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!valid || tooMuch || mutation.isPending} onClick={() => mutation.mutate()}>{t("transfer")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MoneyAccountsPage;
