"use client";

import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  useMovementTypesQuery,
  useStockMovementsQuery,
} from "@/backend-api/inventory/hooks";
import { StockLevel } from "@/backend-api/inventory/types";

interface ProductMovementsDialogProps {
  row: StockLevel | null;
  onClose: () => void;
}

/**
 * The transaction history for one product — or one variant of it. Reads the
 * same ledger as the Stock Movements page, just scoped to the row the admin
 * clicked, so "why is this number 6?" is answerable without leaving the table.
 */
const ProductMovementsDialog = ({ row, onClose }: ProductMovementsDialogProps) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const { data, isLoading } = useStockMovementsQuery(
    row
      ? { productId: row.productId, variantId: row.variantId, limit: 100 }
      : undefined
  );

  // Movements an admin did not cause directly are worth marking as such — the
  // server says which types those are.
  const { data: movementTypes } = useMovementTypesQuery();
  const isAutomatic = (type: string) =>
    movementTypes?.some((info) => info.type === type && !info.manual) ?? false;

  if (!row) return null;

  const title = row.name[lang] ?? row.name.en ?? row.name.ar ?? "";
  const movements = data?.data ?? [];

  return (
    <Dialog open={!!row} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack>
            <Typography variant="subtitle1" fontWeight={700}>
              {title}
              {row.variantLabel ? ` — ${row.variantLabel}` : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("transactions")}
            </Typography>
          </Stack>
          <Stack alignItems="flex-end">
            <Typography variant="h5" fontWeight={700}>
              {row.trackStock ? row.stock : "∞"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("currentStock")}
            </Typography>
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress />
          </Stack>
        ) : movements.length === 0 ? (
          <Stack alignItems="center" py={6}>
            <Typography variant="body2" color="text.disabled">
              {t("noTransactionsYet")}
            </Typography>
          </Stack>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("date")}</TableCell>
                  <TableCell>{t("movementType")}</TableCell>
                  <TableCell align="center">{t("change")}</TableCell>
                  <TableCell align="center">{t("balanceAfter")}</TableCell>
                  <TableCell>{t("reason")}</TableCell>
                  <TableCell>{t("reference")}</TableCell>
                  <TableCell>{t("by")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement._id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {new Date(movement.createdAt).toLocaleString(
                        lang === "ar" ? "ar-EG" : "en-GB"
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`movement_${movement.type}`)}
                        size="small"
                        variant="outlined"
                        color={isAutomatic(movement.type) ? "info" : "default"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={movement.quantity > 0 ? "success.main" : "error.main"}
                      >
                        {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{movement.balanceAfter}</TableCell>
                    <TableCell>{movement.reason ?? "—"}</TableCell>
                    <TableCell>{movement.reference ?? "—"}</TableCell>
                    <TableCell>{movement.user?.name ?? t("system")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {data && data.total > movements.length && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {t("showingLatestTransactions", { shown: movements.length, total: data.total })}
                </Typography>
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductMovementsDialog;
