"use client";

import { useTranslation } from "react-i18next";
import { Autocomplete, TextField } from "@mui/material";
import { ChartAccount, useChartQuery } from "@/backend-api/accounting/api";
import { useLocalName } from "./shared";

/**
 * Picks an account from the chart by code or name, grouped by category.
 * With `manualOnly`, only accounts a manual entry may post to are offered.
 */
const AccountSelect = ({
  value,
  onChange,
  manualOnly,
  label,
  size = "small",
  error,
}: {
  value: string;
  onChange: (code: string) => void;
  manualOnly?: boolean;
  label?: string;
  size?: "small" | "medium";
  error?: boolean;
}) => {
  const { t } = useTranslation();
  const name = useLocalName();
  const { data, isLoading } = useChartQuery();
  const options = (data ?? []).filter((a) => !manualOnly || a.allowsManual);
  const selected = (data ?? []).find((a) => a.code === value) ?? null;
  return (
    <Autocomplete<ChartAccount>
      size={size}
      loading={isLoading}
      options={options}
      value={selected}
      onChange={(_, a) => onChange(a?.code ?? "")}
      groupBy={(a) => t(`accounting.categories.${a.category}`)}
      getOptionLabel={(a) => `${a.code} · ${name(a.name)}`}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      renderInput={(params) => <TextField {...params} label={label ?? t("account")} error={error} />}
      sx={{ minWidth: 220 }}
    />
  );
};

export default AccountSelect;
