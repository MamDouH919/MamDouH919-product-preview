import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchDashboardReport } from "./queries";
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
