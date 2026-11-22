import api from "@/lib/api";
import { CashFlowReport, DashboardPeriod, DashboardReport } from "./types";

export const fetchDashboardReport = async (days: DashboardPeriod): Promise<DashboardReport> => {
  // The browser's zone, so "today" on the dashboard matches the owner's clock.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await api.get("/reports/dashboard", { params: { days, tz } });
  return response.data;
};

export const fetchCashFlow = async (days: DashboardPeriod): Promise<CashFlowReport> => {
  const response = await api.get("/reports/cash-flow", { params: { days } });
  return response.data;
};
