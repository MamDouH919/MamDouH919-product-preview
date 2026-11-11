"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import {
  ACCOUNT_CATEGORIES,
  ACCOUNT_TYPES,
  AccountType,
  CASH_ACCOUNT,
  CASH_FLOW_ACTIVITIES,
  CashFlowActivity,
  CHART_QUERY_KEY,
  ChartAccount,
  createAccount,
  fetchNextCode,
  updateAccount,
  useChartQuery,
} from "@/backend-api/accounting/api";
import { useMoneyAccountsQuery } from "@/backend-api/money-accounts/api";
import { useCurrency } from "@/Hooks/useCurrency";
import TableLoading from "@/components/Table/TableLoading";
import { formatMinorMoney } from "@/features/Order/format";
import { toastError } from "@/features/Purchasing/shared";
import { useLocalName } from "@/features/Accounting/shared";

/**
 * The chart of accounts: every account the books post to, under assets,
 * liabilities, equity, revenue and expenses, with its balance now. Built-in
 * accounts are fixed; the store adds its own beside them.
 */
const ChartOfAccountsPage = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const name = useLocalName();
  const { data, isLoading } = useChartQuery();
  const { data: moneyAccounts } = useMoneyAccountsQuery();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<ChartAccount | "new" | null>(null);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("accounting.chartOfAccounts") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useMutation({
    mutationFn: (a: ChartAccount) => updateAccount({ code: a.code, isActive: !a.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CHART_QUERY_KEY] }),
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter(
      (a) => (showInactive || a.isActive) && (!q || a.code.includes(q) || a.name.en.toLowerCase().includes(q) || a.name.ar.includes(q)),
    );
  }, [data, search, showInactive]);

  const money = (minor: number) => formatMinorMoney(minor, currency);
  const balance = (a: ChartAccount) => (a.balanceMinor === 0 ? money(0) : `${money(a.balanceMinor)} ${t(a.side === "debit" ? "debitSide" : "creditSide")}`);
  const openStatement = (code: string) => router.push(`/${i18n.language}/admin/ledger?account=${code}`);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField size="small" label={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("accounting.searchAccounts")} />
        <FormControlLabel control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label={t("accounting.showInactive")} />
        <Box flex={1} />
        <Button variant="contained" onClick={() => setEditing("new")}>{t("accounting.newAccount")}</Button>
      </Stack>
      <Alert severity="info" icon={false}>
        <Typography variant="body2">{t("accounting.chartHint")}</Typography>
      </Alert>

      {isLoading ? (
        <TableLoading />
      ) : (
        ACCOUNT_CATEGORIES.map((category) => {
          const accounts = visible.filter((a) => a.category === category);
          if (!accounts.length) return null;
          return (
            <Stack key={category} spacing={1}>
              <Typography variant="h6">{t(`accounting.categories.${category}`)}</Typography>
              <Paper variant="outlined" sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, width: 90 }}>{t("accounting.code")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("name")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("accountKind")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("accounting.normalSide")}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>{t("balance")}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accounts.map((a) => (
                      <Fragment key={a.code}>
                        <TableRow hover>
                          <TableCell sx={{ fontFamily: "monospace" }}>{a.code}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                              <Typography variant="body2" color={a.isActive ? "text.primary" : "text.disabled"}>{name(a.name)}</Typography>
                              {!a.isSystem && <Chip size="small" color="primary" variant="outlined" label={t("accounting.custom")} />}
                              {!a.allowsManual && a.isActive && <Chip size="small" variant="outlined" label={t("accounting.automaticOnly")} title={t("accounting.automaticOnlyHint")} />}
                              {!a.isActive && <Chip size="small" label={t("inactive")} />}
                            </Stack>
                            {a.description && <Typography variant="caption" color="text.secondary">{a.description}</Typography>}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" variant="outlined" label={t(`accountTypes.${a.type}`, { defaultValue: a.type })} />
                          </TableCell>
                          <TableCell>{t(a.normalSide === "debit" ? "debit" : "credit")}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color={a.isUnusual ? "warning.main" : undefined}>{balance(a)}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                            <Button size="small" onClick={() => openStatement(a.code)}>{t("accounting.statement")}</Button>
                            {!a.isSystem && (
                              <>
                                <Button size="small" onClick={() => setEditing(a)}>{t("edit")}</Button>
                                <Button size="small" color={a.isActive ? "error" : "primary"} disabled={toggle.isPending} onClick={() => toggle.mutate(a)}>
                                  {a.isActive ? t("deactivate") : t("activate")}
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                        {/* Banks, wallets and cash boxes are the cash account split by where the money is. */}
                        {a.code === CASH_ACCOUNT &&
                          (moneyAccounts ?? []).filter((m) => m.isActive).map((m) => (
                            <TableRow key={m._id}>
                              <TableCell />
                              <TableCell sx={{ ps: 4 }}>
                                <Typography variant="body2" color="text.secondary">↳ {m.name}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">{t(`moneyAccountType.${m.type}`)}</Typography>
                              </TableCell>
                              <TableCell />
                              <TableCell align="right">
                                <Typography variant="body2" color="text.secondary">{money(m.balanceMinor)}</Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Button size="small" onClick={() => router.push(`/${i18n.language}/admin/ledger?account=${CASH_ACCOUNT}&moneyAccount=${m._id}`)}>
                                  {t("accounting.statement")}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Stack>
          );
        })
      )}
      {editing && <AccountDialog key={editing === "new" ? "new" : editing.code} account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
};

/** Cash-flow activity matters for balance-sheet accounts; revenue and expenses are always operating. */
const usesActivity = (type: AccountType) => type === "asset" || type === "liability" || type === "equity";
const defaultActivity = (type: AccountType): CashFlowActivity => (type === "asset" ? "investing" : type === "liability" || type === "equity" ? "financing" : "operating");

const AccountDialog = ({ account, onClose }: { account: ChartAccount | null; onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [type, setType] = useState<AccountType>(account?.type ?? "expense");
  const [code, setCode] = useState(account?.code ?? "");
  const [nameEn, setNameEn] = useState(account?.name.en ?? "");
  const [nameAr, setNameAr] = useState(account?.name.ar ?? "");
  const [activity, setActivity] = useState<CashFlowActivity>(account?.cashFlowActivity ?? defaultActivity("expense"));
  const [description, setDescription] = useState(account?.description ?? "");

  // Suggest the next free code for a new account's type.
  useEffect(() => {
    if (account) return;
    let live = true;
    fetchNextCode(type).then((next) => live && setCode(next)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [type, account]);

  const mutation = useMutation({
    mutationFn: () => {
      const name = { en: nameEn.trim(), ar: nameAr.trim() };
      const cashFlowActivity = usesActivity(type) ? activity : "operating";
      return account
        ? updateAccount({ code: account.code, name, cashFlowActivity, description: description.trim() })
        : createAccount({ code: code.trim(), name, type, cashFlowActivity, description: description.trim() || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHART_QUERY_KEY] });
      toast.success(t("savedSuccessfully"));
      onClose();
    },
    onError: (error) => toastError(error, t("somethingWentWrong")),
  });
  const valid = /^\d{4,6}$/.test(code.trim()) && !!nameEn.trim() && !!nameAr.trim();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{account ? t("accounting.editAccount") : t("accounting.newAccount")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} pt={1}>
          <TextField
            select
            label={t("accountKind")}
            value={type}
            disabled={!!account}
            onChange={(e) => {
              const next = e.target.value as AccountType;
              setType(next);
              setActivity(defaultActivity(next));
            }}
            helperText={t(`accounting.typeHint.${type}`)}
          >
            {ACCOUNT_TYPES.map((x) => (
              <MenuItem key={x} value={x}>{`${t(`accountTypes.${x}`)} — ${t(`accounting.categories.${x === "asset" ? "assets" : x === "liability" ? "liabilities" : x === "equity" ? "equity" : x === "revenue" || x === "contra_revenue" ? "revenue" : "expenses"}`)}`}</MenuItem>
            ))}
          </TextField>
          <TextField
            label={t("accounting.code")}
            value={code}
            disabled={!!account}
            onChange={(e) => setCode(e.target.value.trim())}
            helperText={account ? t("accounting.codeFixed") : t("accounting.codeHint")}
            slotProps={{ htmlInput: { inputMode: "numeric", dir: "ltr", maxLength: 6 } }}
          />
          <TextField label={t("accounting.nameEn")} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
          <TextField label={t("accounting.nameAr")} value={nameAr} onChange={(e) => setNameAr(e.target.value)} required slotProps={{ htmlInput: { dir: "rtl" } }} />
          {usesActivity(type) && (
            <TextField select label={t("accounting.cashFlowActivity")} value={activity} onChange={(e) => setActivity(e.target.value as CashFlowActivity)} helperText={t("accounting.cashFlowActivityHint")}>
              {CASH_FLOW_ACTIVITIES.map((x) => <MenuItem key={x} value={x}>{t(`accounting.activity.${x}`)}</MenuItem>)}
            </TextField>
          )}
          <TextField label={t("description")} value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />
          {!account && type === "asset" && <Alert severity="info" icon={false}><Typography variant="caption">{t("accounting.bankHint")}</Typography></Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("back")}</Button>
        <Button variant="contained" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>{t("save")}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChartOfAccountsPage;
