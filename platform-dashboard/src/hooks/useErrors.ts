import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ErrorQuery, type ErrorStatus } from '../api';

export function useErrors(query: ErrorQuery) {
  return useQuery({
    queryKey: ['errors', query],
    queryFn: () => api.listErrors(query),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useErrorStats(days: number) {
  return useQuery({ queryKey: ['error-stats', days], queryFn: () => api.errorStats(days), refetchInterval: 30_000 });
}

function useErrorMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['errors'] });
      void queryClient.invalidateQueries({ queryKey: ['error-stats'] });
    },
  });
}

export const useUpdateError = () =>
  useErrorMutation(({ id, ...patch }: { id: string; status?: ErrorStatus; note?: string }) =>
    api.updateError(id, patch),
  );
export const useDeleteError = () => useErrorMutation((id: string) => api.deleteError(id));
