"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "@/Store/store";
import {
  changeBreadCrumbActions,
  resetBreadCrumbActions,
} from "@/Store/slices/bread-crumb";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Button, Chip, IconButton, Stack, Switch } from "@mui/material";
import TableViewOutlined from "@mui/icons-material/TableViewOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import { exportProductsCsv } from "@/backend-api/products/queries";
import ProductCsvDialog from "@/features/Product/ProductCsvDialog";
import { datedFilename, downloadFile } from "@/utils/downloadFile";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Image from "next/image";
import {
  useProductsQuery,
  PRODUCTS_QUERY_KEY,
} from "@/backend-api/products/hooks";
import { deleteProduct, updateProduct } from "@/backend-api/products/mutations";
import { Product } from "@/backend-api/products/types";
import { getBackendUri } from "@/utils/helperFunctions";
import SimpleTable from "@/components/Table/SimpleTable";
import Can from "@/components/Can";
import { usePermissions } from "@/Hooks/usePermissions";
import CustomLink from "@/components/CustomLink";
import { useCurrency } from "@/Hooks/useCurrency";
import { useStoreModules } from "@/Hooks/useStoreModules";
import { formatMinorMoney } from "@/features/Order/format";

type Unit = { price: number; costMinor: number };

/** Sellable units with both a price and a known cost: the variants, or the product itself. */
const costedUnits = (p: Product): Unit[] => {
  const src = p.variants?.length
    ? p.variants.map((v) => ({
        price: v.price ?? p.price,
        cost: v.lastUnitCostMinor,
      }))
    : [{ price: p.price, cost: p.lastUnitCostMinor }];
  return src.flatMap((u) =>
    u.price != null && u.price > 0 && u.cost != null
      ? [{ price: u.price, costMinor: u.cost }]
      : [],
  );
};

/** "12" or "12 – 18" when the units differ. */
const range = (values: number[], fmt: (n: number) => string) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
};

const ProductsPage = () => {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const lang = i18n.language;
  const currency = useCurrency();
  // Cost (and so profit and margin) comes from the inventory ledger.
  const { has } = useStoreModules();
  const tracksInventory = has("inventory");

  const { data: products, isLoading } = useProductsQuery();

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      const formData = new FormData();
      formData.append("isActive", String(isActive));
      return updateProduct({ id, data: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
    },
    onError: () => {
      toast.error(t("somethingWentWrong"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
    },
    onError: (error: any) => {
      // 409: the product has orders or stock history and can only be turned off.
      toast.error(
        t(
          error?.response?.status === 409
            ? "productHasHistory"
            : "somethingWentWrong",
        ),
      );
    },
  });

  const [importOpen, setImportOpen] = useState(false);
  const exportMutation = useMutation({
    mutationFn: exportProductsCsv,
    onSuccess: (blob) => downloadFile(blob, datedFilename("products")),
    onError: () => toast.error(t("somethingWentWrong")),
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("products") }],
        breadCrumbBtns: can("products", "create") ? [
          {
            title: t("createProduct"),
            icon: "add",
            link: `/${i18n.language}/admin/products/create`,
          },
        ] : [],
      }),
    );
    return () => {
      dispatch(resetBreadCrumbActions());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "image",
        header: t("image"),
        render: (row: Product) => {
          const imageUrl = getBackendUri(row.images?.[0]);
          if (!imageUrl) return null;
          return (
            <Stack p={0.5}>
              <Image
                src={imageUrl}
                alt={row.name[lang] ?? ""}
                width={60}
                height={60}
                style={{
                  width: 60,
                  height: 60,
                  objectFit: "cover",
                  borderRadius: 4,
                }}
                loading="eager"
              />
            </Stack>
          );
        },
      },
      {
        id: "name",
        header: t("name"),
        render: (row: Product) =>
          row.name[lang] ?? row.name.en ?? row.name.ar ?? "",
      },
      {
        id: "category",
        header: t("category"),
        render: (row: Product) =>
          row.category?.name?.[lang] ?? row.category?.name?.en ?? "",
      },
      {
        id: "subCategory",
        header: t("subCategory"),
        render: (row: Product) =>
          row.subCategory?.name?.[lang] ?? row.subCategory?.name?.en ?? "—",
      },
      {
        id: "price",
        header: t("sellingPrice"),
        render: (row: Product) => (row.price !== undefined ? row.price : "—"),
      },
      ...(tracksInventory
        ? [
            {
              id: "cost",
              header: t("unitCost"),
              render: (row: Product) => {
                const u = costedUnits(row);
                return u.length
                  ? range(
                      u.map((x) => x.costMinor),
                      (n) => formatMinorMoney(n, currency),
                    )
                  : "—";
              },
            },
            {
              id: "profit",
              header: t("profitPerUnit"),
              render: (row: Product) => {
                const u = costedUnits(row);
                if (!u.length) return "—";
                const profits = u.map(
                  (x) => Math.round(x.price * 100) - x.costMinor,
                );
                return (
                  <Box
                    component="span"
                    color={
                      Math.min(...profits) < 0 ? "error.main" : "success.main"
                    }
                  >
                    {range(profits, (n) => formatMinorMoney(n, currency))}
                  </Box>
                );
              },
            },
            {
              id: "margin",
              header: t("profitMargin"),
              render: (row: Product) => {
                const u = costedUnits(row);
                if (!u.length) return "—";
                const margins = u.map(
                  (x) =>
                    ((x.price * 100 - x.costMinor) / (x.price * 100)) * 100,
                );
                return (
                  <Box
                    component="span"
                    color={
                      Math.min(...margins) < 0 ? "error.main" : "success.main"
                    }
                  >
                    {range(margins, (n) => `${n.toFixed(1)}%`)}
                  </Box>
                );
              },
            },
          ]
        : []),
      {
        id: "images",
        header: t("images"),
        render: (row: Product) => (
          <Chip
            label={row.images?.length ?? 0}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        id: "views",
        header: t("views"),
        render: (row: Product) => (
          <Chip
            label={row.views ?? 0}
            size="small"
            variant="outlined"
            color="info"
          />
        ),
      },
      {
        id: "whatsappClicks",
        header: t("whatsappClicks"),
        render: (row: Product) => (
          <Chip
            label={row.whatsappClicks ?? 0}
            size="small"
            variant="outlined"
            color="success"
          />
        ),
      },
      {
        id: "isActive",
        header: t("active"),
        render: (row: Product) => (
          <Switch
            checked={!!row.isActive}
            onChange={(e) =>
              toggleActiveMutation.mutate({
                id: row._id,
                isActive: e.target.checked,
              })
            }
            disabled={toggleActiveMutation.isPending}
            size="small"
          />
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        render: (row: Product) => (
          <Stack direction="row">
            <Can resource="products" action="update">
              <CustomLink href={`/admin/products/${row._id}`}>
              <IconButton>
                <Edit />
              </IconButton>
            </CustomLink>
            </Can>
            <Can resource="products" action="delete">
              <IconButton
              color="error"
              onClick={() => deleteMutation.mutate(row._id)}
              disabled={deleteMutation.isPending}
            >
              <Delete />
            </IconButton>
            </Can>
          </Stack>
        ),
      },
    ],
    [can, t, lang, currency, tracksInventory, toggleActiveMutation, deleteMutation],
  );

  return (
    <Stack spacing={2} height="100%">
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          size="small"
          startIcon={<TableViewOutlined />}
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          {t("exportCsv")}
        </Button>
        <Button
          size="small"
          startIcon={<CloudUploadOutlined />}
          onClick={() => setImportOpen(true)}
        >
          {t("importCsv")}
        </Button>
      </Stack>
      <Box flex={1} minHeight={0}>
        <SimpleTable
          columns={columns}
          data={products ?? []}
          borderRadius={0}
          height="100%"
          loading={isLoading}
        />
      </Box>
      <ProductCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </Stack>
  );
};

export default ProductsPage;
