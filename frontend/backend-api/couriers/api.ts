import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Courier, CourierDetail, CourierType, Settlement } from "./types";

export const COURIERS_QUERY_KEY = "couriers";

export const fetchCouriers = async (): Promise<Courier[]> => (await api.get("/finance/couriers")).data;
export const fetchCourier = async (id: string): Promise<CourierDetail> => (await api.get(`/finance/couriers/${id}`)).data;

export const saveCourier = async ({ id, ...data }: { id?: string; name: string; type?: CourierType; phone?: string; isActive?: boolean }): Promise<Courier> =>
  (id ? await api.patch(`/finance/couriers/${id}`, data) : await api.post("/finance/couriers", data)).data;

/** The courier hands over the cash they hold. Amounts are decimal strings. */
export const settleCourier = async (data: { courierId: string; fees?: string; received: string; differenceReason?: string; moneyAccountId?: string; note?: string }): Promise<Settlement> =>
  (await api.post("/finance/settlements", data)).data;

/** `enabled: false` where only some admins may see couriers; a 403 then just means an empty list. */
export const useCouriersQuery = (enabled = true) =>
  useQuery({ queryKey: [COURIERS_QUERY_KEY], queryFn: fetchCouriers, enabled, retry: false });
export const useCourierQuery = (id: string | null) =>
  useQuery({ queryKey: [COURIERS_QUERY_KEY, id], queryFn: () => fetchCourier(id!), enabled: !!id });
