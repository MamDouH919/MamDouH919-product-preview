import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SeedUser, type TenantInput, type TenantPatch } from '../api';

const KEY = ['tenants'];

export function useTenants() {
  return useQuery({ queryKey: KEY, queryFn: api.listTenants });
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: api.me, staleTime: Infinity });
}

/** Mutations that change the registry refresh the list when they settle. */
function useRegistryMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export const useCreateTenant = () => useRegistryMutation((input: TenantInput) => api.createTenant(input));
export const useUpdateTenant = () =>
  useRegistryMutation(({ host, patch }: { host: string; patch: TenantPatch }) => api.updateTenant(host, patch));
export const useDeleteTenant = () => useRegistryMutation((host: string) => api.deleteTenant(host));

export const useCheckTenant = () => useMutation({ mutationFn: (host: string) => api.checkTenant(host) });
export const useSeedTenant = () =>
  useMutation({
    mutationFn: ({ host, admin, superAdmin }: { host: string; admin: SeedUser; superAdmin?: SeedUser }) =>
      api.seedTenant(host, { admin, superAdmin }),
  });

const backupsKey = (host: string) => ['backups', host];

export function useBackups(host: string) {
  return useQuery({ queryKey: backupsKey(host), queryFn: () => api.listBackups(host) });
}

export function useCreateBackup(host: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.createBackup(host),
    onSettled: () => queryClient.invalidateQueries({ queryKey: backupsKey(host) }),
  });
}

/** Dry runs and real restores; a real one adds a pre-restore backup, so the list is refreshed. */
export function useRestoreBackup(host: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dryRun, confirm }: { id: string; dryRun: boolean; confirm?: string }) =>
      api.restoreBackup(host, id, { dryRun, confirm }),
    onSettled: (_data, _error, vars) => {
      if (!vars.dryRun) void queryClient.invalidateQueries({ queryKey: backupsKey(host) });
    },
  });
}
