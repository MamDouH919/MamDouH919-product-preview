import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchActivityLog, fetchActivityLogFacets } from "./queries";
import { ActivityLogFilters } from "./types";

export const ACTIVITY_LOG_QUERY_KEY = "activity-log";

export const useActivityLogQuery = (filters?: ActivityLogFilters) => {
  return useQuery({
    queryKey: [ACTIVITY_LOG_QUERY_KEY, filters],
    queryFn: () => fetchActivityLog(filters),
    placeholderData: keepPreviousData,
  });
};

export const useActivityLogFacetsQuery = () => {
  return useQuery({
    queryKey: [ACTIVITY_LOG_QUERY_KEY, "facets"],
    queryFn: fetchActivityLogFacets,
  });
};
