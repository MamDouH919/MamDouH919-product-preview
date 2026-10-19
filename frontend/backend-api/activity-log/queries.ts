import api from "@/lib/api";
import { ActivityLogFacets, ActivityLogFilters, ActivityLogResponse } from "./types";

export const fetchActivityLog = async (filters?: ActivityLogFilters): Promise<ActivityLogResponse> => {
  const response = await api.get("/activity-log", { params: filters });
  return response.data;
};

export const fetchActivityLogFacets = async (): Promise<ActivityLogFacets> => {
  const response = await api.get("/activity-log/facets");
  return response.data;
};
