import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchRefundPreview, fetchRefundRules, fetchRefunds } from "./queries";
import { RefundBasis, RefundFilters } from "./types";

export const REFUNDS_QUERY_KEY = "refunds";
export const REFUND_RULES_QUERY_KEY = "refund-rules";

export const useRefundsQuery = (filters: RefundFilters, enabled = true) =>
  useQuery({
    queryKey: [REFUNDS_QUERY_KEY, filters],
    queryFn: () => fetchRefunds(filters),
    placeholderData: keepPreviousData,
    enabled,
  });

/** What the rules suggest for a refund; refetches as the lines or reason change. */
export const useRefundPreviewQuery = (basis: RefundBasis | null) =>
  useQuery({
    queryKey: [REFUNDS_QUERY_KEY, "preview", basis],
    queryFn: () => fetchRefundPreview(basis!),
    enabled: !!basis,
    placeholderData: keepPreviousData,
  });

export const useRefundRulesQuery = (enabled = true) =>
  useQuery({ queryKey: [REFUND_RULES_QUERY_KEY], queryFn: fetchRefundRules, enabled });
