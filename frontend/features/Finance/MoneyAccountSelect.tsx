"use client";

import { useTranslation } from "react-i18next";
import { MenuItem, TextField } from "@mui/material";
import { useMoneyAccountsQuery } from "@/backend-api/money-accounts/api";

/**
 * Which cash box, bank or wallet money moves through. Empty means the store's
 * default, so a store with one account never has to choose; with more, the
 * default is preselected.
 */
const MoneyAccountSelect = ({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) => {
  const { t } = useTranslation();
  const { data: accounts } = useMoneyAccountsQuery();
  const active = (accounts ?? []).filter((a) => a.isActive);
  if (active.length < 2) return null;
  const selected = value || active.find((a) => a.isDefault)?._id || "";
  return (
    <TextField select size="small" label={label ?? t("moneyAccount")} value={selected} onChange={(e) => onChange(e.target.value)}>
      {active.map((a) => (
        <MenuItem key={a._id} value={a._id}>
          {a.name}
        </MenuItem>
      ))}
    </TextField>
  );
};

export default MoneyAccountSelect;
