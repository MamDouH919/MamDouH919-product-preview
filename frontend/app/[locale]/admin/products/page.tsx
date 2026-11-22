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
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import TableViewOutlined from "@mui/icons-material/TableViewOutlined";
import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import { exportProductsCsv } from "@/backend-api/products/queries";
import PageActions, { PageActionButton } from "@/components/PageActions";
import ProductCsvDialog from "@/features/Product/ProductCsvDialog";
import { datedFilename, downloadFile } from "@/utils/downloadFile";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Image from "next/image";
import {
  useProductsPageQuery,
  PRODUCTS_QUERY_KEY,
} from "@/backend-api/products/hooks";
import { deleteProduct, updateProduct } from "@/backend-api/products/mutations";
import { Product } from "@/backend-api/products/types";
import { getBackendUri } from "@/utils/helperFunctions";
import FilterLayout, { FilterSelect } from "@/components/FilterLayout";
import { useCategoriesQuery } from "@/backend-api/categories/hooks";
import { useSubCategoriesQuery } from "@/backend-api/sub-categories/hooks";
import { ProductListFilters } from "@/backend-api/products/queries";
import SimpleTable from "@/components/Table/SimpleTable";
import Can from "@/components/Can";
import { usePermissions } from "@/Hooks/usePermissions";
import CustomLink from "@/components/CustomLink";
import { useCurrency } from "@/Hooks/useCurrency";
import { useStoreModules } from "@/Hooks/useStoreModules";
import { formatMinorMoney, formatMoney } from "@/features/Order/format";

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
  const takesOrders = has("orders");

  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<ProductListFilters>({});
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });

  const { data: categories } = useCategoriesQuery();
  const { data: subCategories } = useSubCategoriesQuery(filters.categoryId);

  // Typing shouldn't fire a request per key, and any change of filter goes back to page one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        minPrice: priceRange.min === "" ? undefined : Number(priceRange.min),
        maxPrice: priceRange.max === "" ? undefined : Number(priceRange.max),
      }));
      setPage(0);
    }, 450);
    return () => clearTimeout(timer);
  }, [priceRange]);

  const patch = (next: Partial<ProductListFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(0);
  };

  const { data, isLoading } = useProductsPageQuery({
    page: page + 1,
    limit,
    ...filters,
    q: q || undefined,
  });
  const products = data?.data;

  // A delete can empty the last page; step back rather than show "no products".
  const lastPage = Math.max(0, Math.ceil((data?.total ?? 0) / limit) - 1);
  if (data && page > lastPage) setPage(lastPage);

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
      setDeleting(null);
      toast.success(t("saveSuccessfully"));
      queryClient.invalidateQueries({ queryKey: [PRODUCTS_QUERY_KEY] });
    },
    onError: (error: any) => {
      // 409: an unfinished order, or stock still on the shelf. The server says which.
      const message = error?.response?.data?.message;
      toast.error(
        error?.response?.status === 409
          ? typeof message === "string"
            ? message
            : t("productHasHistory")
          : t("somethingWentWrong"),
      );
    },
  });

  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const exportMutation = useMutation({
    mutationFn: exportProductsCsv,
    onSuccess: (blob) => downloadFile(blob, datedFilename("products")),
    onError: () => toast.error(t("somethingWentWrong")),
  });

  useEffect(() => {
    dispatch(
      changeBreadCrumbActions({
        breadCrumb: [{ title: t("products") }],
        breadCrumbBtns: can("products", "create")
          ? [
              {
                title: t("createProduct"),
                icon: "add",
                link: `/${i18n.language}/admin/products/create`,
              },
            ]
          : [],
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
        id: "name",
        header: t("name"),
        render: (row: Product) => {
          const imageUrl = getBackendUri(row.images?.[0]);
          return (
            <Stack direction="row" alignItems="center" gap={1.5} minWidth={0}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: 2,
                  overflow: "hidden",
                  bgcolor: "action.hover",
                  border: 1,
                  borderColor: "divider",
                }}
              >
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={row.name[lang] ?? ""}
                    width={48}
                    height={48}
                    style={{ width: 48, height: 48, objectFit: "cover" }}
                    loading="eager"
                  />
                )}
              </Box>
              <Stack minWidth={0}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {row.name[lang] ?? row.name.en ?? row.name.ar ?? ""}
                </Typography>
                {row.sku && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    dir="ltr"
                    sx={{ textAlign: "start" }}
                  >
                    {row.sku}
                  </Typography>
                )}
              </Stack>
            </Stack>
          );
        },
      },
      {
        id: "category",
        header: t("category"),
        render: (row: Product) => {
          const cat =
            row.category?.name?.[lang] ?? row.category?.name?.en ?? "";
          const sub =
            row.subCategory?.name?.[lang] ?? row.subCategory?.name?.en ?? "";
          return (
            <Stack>
              <Typography variant="body2">{cat || "—"}</Typography>
              {sub && (
                <Typography variant="caption" color="text.secondary">
                  {sub}
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        id: "price",
        header: t("sellingPrice"),
        render: (row: Product) => {
          const prices = row.variants?.length
            ? row.variants
                .map((v) => v.price ?? row.price)
                .filter((n): n is number => n != null)
            : row.price != null
              ? [row.price]
              : [];
          return prices.length ? (
            <Typography variant="body2" fontWeight={600} whiteSpace="nowrap">
              {range(prices, (n) => formatMoney(n, currency))}
            </Typography>
          ) : (
            "—"
          );
        },
      },
      ...(tracksInventory
        ? [
            {
              id: "stock",
              header: t("stock"),
              render: (row: Product) => {
                if (!row.trackStock)
                  return (
                    <Typography variant="caption" color="text.secondary">
                      ∞
                    </Typography>
                  );
                const n = row.totalStock ?? row.stock ?? 0;
                const color =
                  n <= 0
                    ? "error"
                    : n <= (row.lowStockThreshold ?? 0)
                      ? "warning"
                      : "success";
                return (
                  <Chip
                    size="small"
                    color={color}
                    variant="outlined"
                    label={n}
                  />
                );
              },
            },
          ]
        : []),
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
      // WhatsApp is how a catalog-only store gets enquiries; a store taking orders doesn't need it.
      ...(takesOrders
        ? []
        : [
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
          ]),
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
        header: "",
        render: (row: Product) => (
          <Stack direction="row" gap={0.25}>
            <Can resource="products" action="update">
              <Tooltip title={t("edit")}>
                <IconButton
                  size="small"
                  component={CustomLink}
                  href={`/admin/products/${row._id}`}
                >
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            </Can>
            <Can resource="products" action="delete">
              <Tooltip title={t("delete")}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeleting(row)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Can>
          </Stack>
        ),
      },
    ],
    [
      t,
      lang,
      currency,
      tracksInventory,
      takesOrders,
      toggleActiveMutation,
    ],
  );

  const localName = (n?: Partial<Record<string, string>>) =>
    n?.[lang] ?? n?.en ?? n?.ar ?? "";
  const categoryName = localName(
    categories?.find((c) => c._id === filters.categoryId)?.name,
  );
  const subCategoryName = localName(
    subCategories?.find((c) => c._id === filters.subCategoryId)?.name,
  );
  const hasPrice =
    filters.minPrice !== undefined || filters.maxPrice !== undefined;

  const chips = [
    ...(filters.categoryId
      ? [
          {
            key: "cat",
            label: categoryName || t("category"),
            onDelete: () =>
              patch({ categoryId: undefined, subCategoryId: undefined }),
          },
        ]
      : []),
    ...(filters.subCategoryId
      ? [
          {
            key: "sub",
            label: subCategoryName || t("subCategory"),
            onDelete: () => patch({ subCategoryId: undefined }),
          },
        ]
      : []),
    ...(filters.status
      ? [
          {
            key: "status",
            label: t(filters.status),
            onDelete: () => patch({ status: undefined }),
          },
        ]
      : []),
    ...(filters.stock
      ? [
          {
            key: "stock",
            label: t(filters.stock === "in" ? "inStock" : "outOfStock"),
            onDelete: () => patch({ stock: undefined }),
          },
        ]
      : []),
    ...(hasPrice
      ? [
          {
            key: "price",
            label: `${filters.minPrice ?? "…"} – ${filters.maxPrice ?? "…"}`,
            onDelete: () => setPriceRange({ min: "", max: "" }),
          },
        ]
      : []),
    ...(search
      ? [
          {
            key: "search",
            label: `${t("search")}: ${search}`,
            onDelete: () => setSearch(""),
          },
        ]
      : []),
  ];

  const clearAll = () => {
    setSearch("");
    setPriceRange({ min: "", max: "" });
    setFilters({});
    setPage(0);
  };

  return (
    <Stack spacing={2} height="100%">
      <PageActions>
        <PageActionButton
          startIcon={<TableViewOutlined />}
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          {t("exportCsv")}
        </PageActionButton>
        <PageActionButton
          startIcon={<CloudUploadOutlined />}
          onClick={() => setImportOpen(true)}
        >
          {t("importCsv")}
        </PageActionButton>
      </PageActions>
      <FilterLayout
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("productSearchPlaceholder", {
            defaultValue: t("search"),
          }),
        }}
        activeCount={chips.length}
        chips={chips}
        onClear={clearAll}
        filters={
          <>
            <FilterSelect
              label={t("category")}
              value={filters.categoryId}
              onChange={(categoryId) =>
                patch({ categoryId, subCategoryId: undefined })
              }
              options={(categories ?? []).map((c) => ({
                value: c._id,
                label: localName(c.name),
              }))}
            />
            <FilterSelect
              label={t("subCategory")}
              value={filters.subCategoryId}
              onChange={(subCategoryId) => patch({ subCategoryId })}
              options={(subCategories ?? []).map((c) => ({
                value: c._id,
                label: localName(c.name),
              }))}
            />
            <FilterSelect
              label={t("status")}
              value={filters.status}
              onChange={(status) => patch({ status })}
              options={[
                { value: "active", label: t("active") },
                { value: "inactive", label: t("inactive") },
              ]}
            />
            {tracksInventory && (
              <FilterSelect
                label={t("stock")}
                value={filters.stock}
                onChange={(stock) => patch({ stock })}
                options={[
                  { value: "in", label: t("inStock") },
                  { value: "out", label: t("outOfStock") },
                ]}
              />
            )}
            <Stack direction="row" gap={1}>
              <TextField
                size="small"
                type="number"
                label={t("minPrice")}
                value={priceRange.min}
                onChange={(e) =>
                  setPriceRange((p) => ({ ...p, min: e.target.value }))
                }
                slotProps={{ htmlInput: { min: 0 } }}
              />
              <TextField
                size="small"
                type="number"
                label={t("maxPrice")}
                value={priceRange.max}
                onChange={(e) =>
                  setPriceRange((p) => ({ ...p, max: e.target.value }))
                }
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </Stack>
          </>
        }
      >
        <SimpleTable
          columns={columns}
          data={products ?? []}
          height="100%"
          loading={isLoading}
          pagination={{
            count: data?.total ?? 0,
            page,
            rowsPerPage: limit,
            onPageChange: setPage,
            onRowsPerPageChange: (n) => {
              setLimit(n);
              setPage(0);
            },
          }}
        />
      </FilterLayout>
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("delete")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleting?.name[lang] ?? deleting?.name.en ?? deleting?.name.ar}
          </DialogContentText>
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
      <ProductCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </Stack>
  );
};

export default ProductsPage;
