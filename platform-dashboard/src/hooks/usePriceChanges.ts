import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type PriceChangeQuery } from '../api';

export function usePriceChanges(query: PriceChangeQuery) {
  return useQuery({
    queryKey: ['price-changes', query],
    queryFn: () => api.listPriceChanges(query),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function usePriceChangeSummary(days: number, host?: string) {
  return useQuery({
    queryKey: ['price-change-summary', days, host],
    queryFn: () => api.priceChangeSummary(days, host),
    refetchInterval: 30_000,
  });
}
