"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import { changeBreadCrumbActions, resetBreadCrumbActions } from "@/Store/slices/bread-crumb";
import { useSuppliersQuery } from "@/backend-api/purchasing/hooks";
import { Supplier } from "@/backend-api/purchasing/types";
import { useCurrency } from "@/Hooks/useCurrency";
import SimpleTable from "@/components/Table/SimpleTable";
import { formatMinorMoney } from "@/features/Order/format";
import SupplierDialog from "@/features/Purchasing/SupplierDialog";
import PaySupplierDialog from "@/features/Purchasing/PaySupplierDialog";

/** Who the store buys from, and what it owes each of them now. */
const SuppliersPage = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const currency = useCurrency();
  const { data: suppliers, isLoading } = useSuppliersQuery();
  // A fresh key per opening, so the dialog starts from the supplier it is given.
  const [editing, setEditing] = useState<{ key: number; supplier?: Supplier } | null>(null);
  const [paying, setPaying] = useState<Supplier | null>(null);

  useEffect(() => {
    dispatch(changeBreadCrumbActions({ breadCrumb: [{ title: t("suppliers") }], breadCrumbBtns: [] }));
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
        render: (row: Supplier) => (
          <Stack>
            <Typography variant="body2" fontWeight={600}>
              {row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {[row.phone, row.email].filter(Boolean).join(" · ")}
            </Typography>
          </Stack>
        ),
      },
      { id: "purchases", header: t("purchases"), render: (row: Supplier) => row.purchases ?? 0 },
      {
        id: "owed",
        header: t("owed"),
        render: (row: Supplier) => (
          <Typography variant="body2" fontWeight={700} color={row.owedMinor > 0 ? "warning.main" : "text.secondary"}>
            {formatMinorMoney(row.owedMinor, currency)}
          </Typography>
        ),
      },
      { id: "status", header: t("status"), render: (row: Supplier) => (row.isActive ? <Chip size="small" color="success" label={t("active")} /> : <Chip size="small" label={t("inactive")} />) },
      {
        id: "actions",
        header: "",
        render: (row: Supplier) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => router.push(`/${i18n.language}/admin/purchases?supplier=${row._id}`)}>
              {t("purchases")}
            </Button>
            <Button size="small" onClick={() => setEditing({ key: Date.now(), supplier: row })}>
              {t("edit")}
            </Button>
            <Button size="small" variant="contained" disabled={row.owedMinor <= 0} onClick={() => setPaying(row)}>
              {t("pay")}
            </Button>
          </Stack>
        ),
      },
    ],
    [t, currency, router, i18n.language],
  );

  return (
    <Stack spacing={2} height="100%">
      <Button variant="contained" sx={{ alignSelf: "flex-start" }} onClick={() => setEditing({ key: Date.now() })}>
        {t("newSupplier")}
      </Button>
      <Box flex={1} minHeight={0}>
        <SimpleTable columns={columns} data={suppliers ?? []} borderRadius={0} height="100%" loading={isLoading} />
      </Box>
      {editing && <SupplierDialog key={editing.key} open supplier={editing.supplier} onClose={() => setEditing(null)} />}
      <PaySupplierDialog key={paying?._id ?? "none"} supplier={paying} onClose={() => setPaying(null)} />
    </Stack>
  );
};

export default SuppliersPage;
