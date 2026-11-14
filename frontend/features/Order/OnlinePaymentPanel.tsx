"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, Button, CircularProgress, Stack, Typography } from "@mui/material";
import type { Order } from "@/backend-api/orders/types";

const POLL_MS = 3000;
const POLL_TRIES = 20;
/** Polls before the page asks the gateway itself. */
const SYNC_AFTER = 2;

type Props = {
  order: Pick<Order, "paymentMethod" | "paymentStatus" | "status">;
  /** True on the page the gateway sends the customer back to. */
  returning: boolean;
  /** Opens a fresh payment for this order and says where to pay. */
  pay: () => Promise<{ paymentUrl: string }>;
  /** Asks the server to check with the gateway, in case its confirmation is late or lost. */
  sync?: () => Promise<unknown>;
  /** Reads the order again — the gateway's confirmation reaches the server on its own, a moment after the customer returns. */
  refresh: () => unknown;
};

/**
 * What an online order shows about its payment. The page address after paying
 * proves nothing (anyone can type it), so on return this waits for the server
 * to report the order paid rather than believing the URL.
 */
const OnlinePaymentPanel = ({ order, returning, pay, sync, refresh }: Props) => {
  const { t } = useTranslation();
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded" || order.paymentStatus === "refunded";
  const [gaveUp, setGaveUp] = useState(false);
  const tries = useRef(0);

  useEffect(() => {
    if (!returning || paid || order.status === "cancelled") return;
    const timer = setInterval(() => {
      if (++tries.current > POLL_TRIES) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      // The gateway's own notice normally lands first; after a few seconds ask it directly.
      if (sync && tries.current >= SYNC_AFTER) void sync().catch(() => undefined).then(() => refresh());
      else refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [returning, paid, order.status, refresh, sync]);

  const payMutation = useMutation({
    mutationFn: pay,
    onSuccess: ({ paymentUrl }) => {
      window.location.href = paymentUrl;
    },
    onError: (error: any) => toast.error(error?.response?.data?.message ?? t("somethingWentWrong")),
  });

  if (order.paymentMethod !== "online" || order.status === "cancelled") return null;

  if (paid) {
    return (
      <Alert severity="success" sx={{ borderRadius: 3 }}>
        {returning ? t("paymentConfirmed") : t("paymentPaid")}
      </Alert>
    );
  }

  const waiting = returning && !gaveUp;
  return (
    <Alert
      severity={returning && gaveUp ? "warning" : "info"}
      sx={{ borderRadius: 3 }}
      icon={waiting ? <CircularProgress size={20} /> : undefined}
      action={
        !waiting && (
          <Button color="inherit" size="small" disabled={payMutation.isPending} onClick={() => payMutation.mutate()}>
            {t("payNow")}
          </Button>
        )
      }
    >
      <Stack>
        <Typography variant="body2" fontWeight={700}>
          {waiting ? t("paymentChecking") : t("paymentAwaiting")}
        </Typography>
        <Typography variant="body2">{returning && gaveUp ? t("paymentNotConfirmed") : waiting ? "" : t("paymentAwaitingBody")}</Typography>
      </Stack>
    </Alert>
  );
};

export default OnlinePaymentPanel;
