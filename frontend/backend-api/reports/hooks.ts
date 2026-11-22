import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchCashFlow, fetchDashboardReport } from "./queries";
import { DashboardPeriod } from "./types";

export const DASHBOARD_REPORT_QUERY_KEY = "dashboard-report";

export const useDashboardReportQuery = (days: DashboardPeriod) => {
  return useQuery({
    queryKey: [DASHBOARD_REPORT_QUERY_KEY, days],
    queryFn: () => fetchDashboardReport(days),
    // Keep the old figures on screen while another period loads.
    placeholderData: keepPreviousData,
    // A 403 (no orders permission) won't fix itself — just hide the section.
    retry: false,
  });
};

export const CASH_FLOW_QUERY_KEY = "cash-flow";

export const useCashFlowQuery = (days: DashboardPeriod) => {
  return useQuery({
    queryKey: [CASH_FLOW_QUERY_KEY, days],
    queryFn: () => fetchCashFlow(days),
    placeholderData: keepPreviousData,
    retry: false,
  });
};
