"use client";

import { useTranslation } from "react-i18next";
import { FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import { useSettingsQuery } from "@/backend-api/settings/hooks";
import { formatMinorMoney } from "@/features/Order/format";
import { useCurrency } from "@/Hooks/useCurrency";

/**
 * Under a unit-cost input: a switch for each of 5% and 15% that the store's
 * super admin turned on. The percentages switched on here are each taken of
 * the typed cost and added together (200 → 5%: 210, 15%: 230, both: 240).
 * The form keeps the switched-on rates (`value`) and sends
 * `addCostPercentages(cost, value)` as the unit cost.
 */
const CostPercentages = ({
  cost,
  value,
  onChange,
}: {
  cost: string;
  value: number[];
  onChange: (rates: number[]) => void;
}) => {
  const { t } = useTranslation();
  const currency = useCurrency();
  const { data: settings } = useSettingsQuery();

  const rates = [
    settings?.costPlus5Percent ? 5 : null,
    settings?.costPlus15Percent ? 15 : null,
  ].filter((r): r is number => r !== null);
  if (!rates.length) return null;

  const on = value.filter((r) => rates.includes(r));
  const minor = Math.round(Number(cost) * 100);
  const showTotal = on.length > 0 && cost.trim() !== "" && Number.isFinite(minor) && minor > 0;
  const added = Math.round((minor * on.reduce((s, r) => s + r, 0)) / 100);

  return (
    <Stack sx={{ mt: 0.5, px: 0.5 }}>
      <Stack direction="row" flexWrap="wrap" columnGap={1}>
        {rates.map((rate) => (
          <FormControlLabel
            key={rate}
            sx={{ m: 0 }}
            control={
              <Switch
                size="small"
                checked={on.includes(rate)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...on, rate] : on.filter((r) => r !== rate))
                }
              />
            }
            label={<Typography variant="caption">+{rate}%</Typography>}
          />
        ))}
      </Stack>
      {showTotal && (
        <Typography variant="caption" color="text.secondary">
          {t("costWithPercent", {
            rate: on.reduce((s, r) => s + r, 0),
            added: formatMinorMoney(added, currency),
            total: formatMinorMoney(minor + added, currency),
          })}
        </Typography>
      )}
    </Stack>
  );
};

/** The cost to send: the typed cost with each rate taken of it and added, to the cent. */
export function addCostPercentages(cost: string, rates: number[]): string {
  const minor = Math.round(Number(cost) * 100);
  if (!rates.length || cost.trim() === "" || !Number.isFinite(minor)) return cost;
  const sum = rates.reduce((s, r) => s + r, 0);
  return ((minor + Math.round((minor * sum) / 100)) / 100).toFixed(2);
}

export default CostPercentages;
