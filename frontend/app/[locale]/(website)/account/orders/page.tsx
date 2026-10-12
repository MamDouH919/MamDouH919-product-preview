"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Button,
  CircularProgress,
  Pagination,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import { useMyOrdersQuery } from "@/backend-api/orders/hooks";
import { useCurrency } from "@/Hooks/useCurrency";
import CustomLink from "@/components/CustomLink";
import OrderStatusChip from "@/features/Order/OrderStatusChip";
import { formatDateTime, formatMoney, localized } from "@/features/Order/format";

const PAGE_SIZE = 10;

const MyOrdersPage = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const router = useRouter();
  const fallbackCurrency = useCurrency();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMyOrdersQuery({ page, limit: PAGE_SIZE });

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={700} mb={2.5}>
        {t("myOrders")}
      </Typography>

      {isLoading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : !data?.data.length ? (
        <Stack alignItems="center" spacing={2} py={6} textAlign="center">
          <ReceiptLongOutlined sx={{ fontSize: 56, color: "text.disabled" }} />
          <Typography color="text.secondary">{t("noOrdersYet")}</Typography>
          <CustomLink href="/products">
            <Button variant="contained">{t("browseProducts")}</Button>
          </CustomLink>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {data.data.map((order) => {
            const count = order.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <Paper
                key={order._id}
                variant="outlined"
                onClick={() => router.push(`/${lang}/account/orders/${order._id}`)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  cursor: "pointer",
                  transition: "border-color .2s",
                  "&:hover": { borderColor: "primary.main" },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Stack spacing={0.5}>
                    <Typography fontWeight={700}>
                      {t("orderNumber", { number: order.orderNumber })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(order.createdAt, lang)} · {t("itemsCount", { count })}
                    </Typography>
                  </Stack>
                  <Stack alignItems="flex-end" spacing={0.75}>
                    <OrderStatusChip status={order.status} />
                    <Typography variant="body2" fontWeight={700}>
                      {formatMoney(order.total, localized(order.currency, lang) || fallbackCurrency)}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}

          {data.total > PAGE_SIZE && (
            <Stack alignItems="center" pt={1}>
              <Pagination
                count={Math.ceil(data.total / PAGE_SIZE)}
                page={page}
                onChange={(_, p) => setPage(p)}
              />
            </Stack>
          )}
        </Stack>
      )}
    </Paper>
  );
};

export default MyOrdersPage;
