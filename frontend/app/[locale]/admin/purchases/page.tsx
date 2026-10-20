"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Box, Button, Chip, Stack, Tab, TablePagination, Tabs, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { usePurchasesQuery } from "@/backend-api/purchasing/hooks";
import { Purchase } from "@/backend-api/purchasing/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatDateTime, formatMinorMoney } from "@/features/Order/format";
import PurchaseFormDialog from "@/features/Purchasing/PurchaseFormDialog";

/** Goods bought: drafts being entered, and posted purchases with what is still owed on them. */
const PurchasesPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const currency = useCurrency();
  const [status, setStatus] = useState<"draft" | "posted" | "all">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [creating, setCreating] = useState(0);
  const supplierId = params.get("supplier") ?? undefined;

  const { data, isLoading } = usePurchasesQuery({ supplierId, status: status === "all" ? undefined : status, page, limit });

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("purchases") }], breadCrumbBtns: [] }));
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "number",
        header: t("purchase"),
        render: (row: Purchase) => (
          <Stack>
            <Typography variant="body2" fontWeight={700}>
              {t("purchaseNumber", { number: row.purchaseNumber })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(row.date, lang)}
            </Typography>
          </Stack>
        ),
      },
      { id: "supplier", header: t("supplier"), render: (row: Purchase) => (typeof row.supplier === "object" ? row.supplier.name : "—") },
      { id: "invoice", header: t("supplierInvoiceNo"), render: (row: Purchase) => row.supplierInvoiceNo ?? "—" },
      { id: "total", header: t("total"), render: (row: Purchase) => formatMinorMoney(row.totalMinor, currency) },
      {
        id: "owed",
        header: t("owed"),
        render: (row: Purchase) => (row.status === "posted" ? formatMinorMoney(row.totalMinor - row.paidMinor - row.returnedMinor, currency) : "—"),
      },
      {
        id: "status",
        header: t("status"),
        render: (row: Purchase) => <Chip size="small" color={row.status === "posted" ? "success" : "default"} label={t(`purchaseStatus.${row.status}`)} />,
      },
      {
        id: "actions",
        header: "",
        render: (row: Purchase) => (
          <Button size="small" onClick={() => router.push(`/${lang}/admin/purchases/${row._id}`)}>
            {t("view")}
          </Button>
        ),
      },
    ],
    [t, lang, currency, router],
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Tabs value={status} onChange={(_, v) => { setStatus(v); setPage(1); }}>
          <Tab value="all" label={t("all")} />
          <Tab value="draft" label={t("purchaseStatus.draft")} />
          <Tab value="posted" label={t("purchaseStatus.posted")} />
        </Tabs>
        <Button variant="contained" onClick={() => setCreating((n) => n + 1)}>
          {t("newPurchase")}
        </Button>
      </Stack>
      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={data?.data ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>
      <TablePagination
        component="div"
        count={data?.total ?? 0}
        page={page - 1}
        onPageChange={(_, p) => setPage(p + 1)}
        rowsPerPage={limit}
        onRowsPerPageChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
        rowsPerPageOptions={[25, 50, 100]}
      />
      {creating > 0 && (
        <PurchaseFormDialog
          key={creating}
          open
          onClose={() => setCreating(0)}
          onSaved={(saved) => router.push(`/${lang}/admin/purchases/${saved._id}`)}
        />
      )}
    </Stack>
  );
};

export default PurchasesPage;
