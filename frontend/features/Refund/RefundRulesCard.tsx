"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { REFUND_RULES_QUERY_KEY, useRefundRulesQuery } from "@/backend-api/refunds/hooks";
import { updateRefundRules } from "@/backend-api/refunds/mutations";
import { DeliveryFeeRefundPolicy } from "@/backend-api/refunds/types";
import { formatDateTime, minorToInput } from "@/features/Order/format";

const POLICIES: DeliveryFeeRefundPolicy[] = ["store_fault_full_return", "full_return", "manual", "never"];
const AMOUNT = /^\d+(\.\d{1,2})?$/;

/**
 * The store's refund rules: what is approved as it is asked for, when a
 * second person must approve, and when the delivery fee goes back. Saved on
 * its own (not with the settings form), by this store's super admin only;
 * every change is kept with what it was before.
 */
const RefundRulesCard = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: rules } = useRefundRulesQuery();
  const [auto, setAuto] = useState<string | null>(null);
  const [single, setSingle] = useState<string | null>(null);
  const [policy, setPolicy] = useState<DeliveryFeeRefundPolicy | null>(null);

  const mutation = useMutation({
    mutationFn: updateRefundRules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REFUND_RULES_QUERY_KEY] });
      setAuto(null);
      setSingle(null);
      setPolicy(null);
      toast.success(t("saveSuccessfully"));
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      toast.error((Array.isArray(message) ? message[0] : message) ?? t("somethingWentWrong"));
    },
  });

  if (!rules) return null;
  const autoValue = auto ?? minorToInput(rules.autoApproveUpToMinor);
  const singleValue = single ?? minorToInput(rules.singleApproverUpToMinor);
  const policyValue = policy ?? rules.deliveryFeeRefund;
  const valid = AMOUNT.test(autoValue) && AMOUNT.test(singleValue) && Number(autoValue) <= Number(singleValue);
  const changed = auto !== null || single !== null || policy !== null;

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {t("refundRules")}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t("refundRulesHint")}
      </Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={2} maxWidth={420}>
        <TextField
          size="small"
          label={t("autoApproveUpTo")}
          value={autoValue}
          onChange={(e) => setAuto(e.target.value.trim())}
          error={!AMOUNT.test(autoValue)}
          slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
        />
        <TextField
          size="small"
          label={t("singleApproverUpTo")}
          value={singleValue}
          onChange={(e) => setSingle(e.target.value.trim())}
          error={!valid}
          helperText={t("singleApproverHint")}
          slotProps={{ htmlInput: { inputMode: "decimal", dir: "ltr" } }}
        />
        <TextField select size="small" label={t("deliveryFeeRefund")} value={policyValue} onChange={(e) => setPolicy(e.target.value as DeliveryFeeRefundPolicy)}>
          {POLICIES.map((p) => (
            <MenuItem key={p} value={p}>
              {t(`deliveryFeePolicy.${p}`)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          sx={{ alignSelf: "flex-start" }}
          disabled={!changed || !valid || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              ...(auto !== null ? { autoApproveUpTo: autoValue } : {}),
              ...(single !== null ? { singleApproverUpTo: singleValue } : {}),
              ...(policy !== null ? { deliveryFeeRefund: policyValue } : {}),
            })
          }
        >
          {t("save")}
        </Button>
        {!!rules.history?.length && (
          <Typography variant="caption" color="text.secondary">
            {t("lastChanged", { date: formatDateTime(rules.history[rules.history.length - 1].at, i18n.language) })}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
};

export default RefundRulesCard;
