"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Box,
  Chip,
  Stack,
  Switch,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import {
  CUSTOMERS_QUERY_KEY,
  useCustomersQuery,
} from "@/backend-api/customers/hooks";
import { setCustomerActive } from "@/backend-api/customers/mutations";
import { Customer, CustomerFilters } from "@/backend-api/customers/types";
import SimpleTable from "@/components/Table/SimpleTable";

const CustomersPage = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;

  const [filters, setFilters] = useState<CustomerFilters>({ page: 1, limit: 25 });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(
      () => setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 })),
      350
    );
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCustomersQuery(filters);

  const activeMutation = useMutation({
    mutationFn: setCustomerActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
      toast.success(t("saveSuccessfully"));
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("customers") }],
        breadCrumbBtns: [],
      })
    );
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
        render: (row: Customer) => (
          <Stack>
            <Typography variant="body2">{row.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.email}
            </Typography>
          </Stack>
        ),
      },
      {
        id: "phone",
        header: t("phone"),
        render: (row: Customer) => row.phone ?? "—",
      },
      {
        id: "addresses",
        header: t("addresses"),
        render: (row: Customer) => (
          <Chip label={row.addresses?.length ?? 0} size="small" variant="outlined" />
        ),
      },
      {
        id: "createdAt",
        header: t("registeredOn"),
        render: (row: Customer) =>
          row.createdAt
            ? new Date(row.createdAt).toLocaleDateString(
                lang === "ar" ? "ar-EG" : "en-GB"
              )
            : "—",
      },
      {
        id: "isActive",
        header: t("active"),
        render: (row: Customer) => (
          // Blocking an account keeps its history — it only stops new sign-ins.
          <Tooltip title={row.isActive ? t("blockCustomer") : t("unblockCustomer")}>
            <Switch
              checked={row.isActive}
              onChange={(e) =>
                activeMutation.mutate({ id: row._id, isActive: e.target.checked })
              }
              disabled={activeMutation.isPending}
              size="small"
            />
          </Tooltip>
        ),
      },
    ],
    [t, lang, activeMutation]
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={2}>
        <TextField
          size="small"
          label={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
        />
      </Stack>

      <Box flex={1} minHeight={0}>
        <SimpleTable
          columns={columns}
          data={data?.data ?? []}
          borderRadius={0}
          height="100%"
          loading={isLoading}
        />
      </Box>

      <TablePagination
        component="div"
        count={data?.total ?? 0}
        page={(filters.page ?? 1) - 1}
        onPageChange={(_, page) => setFilters((prev) => ({ ...prev, page: page + 1 }))}
        rowsPerPage={filters.limit ?? 25}
        onRowsPerPageChange={(e) =>
          setFilters((prev) => ({ ...prev, limit: parseInt(e.target.value, 10), page: 1 }))
        }
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Stack>
  );
};

export default CustomersPage;
