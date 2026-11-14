import { useQuery } from "@tanstack/react-query";
import { fetchGatewayPayouts, fetchGatewaySettings, fetchOnlinePaymentAvailable } from "./queries";

export const GATEWAY_SETTINGS_QUERY_KEY = "gateway-settings";
export const ONLINE_AVAILABLE_QUERY_KEY = "online-payment-available";

export const useGatewaySettingsQuery = () =>
  useQuery({ queryKey: [GATEWAY_SETTINGS_QUERY_KEY], queryFn: fetchGatewaySettings });

export const useOnlinePaymentAvailableQuery = () =>
  useQuery({ queryKey: [ONLINE_AVAILABLE_QUERY_KEY], queryFn: fetchOnlinePaymentAvailable, staleTime: 60_000 });

export const GATEWAY_PAYOUTS_QUERY_KEY = "gateway-payouts";

export const useGatewayPayoutsQuery = (enabled = true) =>
  useQuery({ queryKey: [GATEWAY_PAYOUTS_QUERY_KEY], queryFn: fetchGatewayPayouts, enabled });
