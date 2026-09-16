import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { Organization } from "./generated/react/api.schemas";

export interface OrganizationPublic extends Organization {
  memberCount: number;
  sectorCount: number;
  positionCount: number;
}

export const getListOrganizationsPublicQueryKey = () =>
  ["/api/organizations"] as const;

export async function listOrganizationsPublic(
  options?: RequestInit,
): Promise<OrganizationPublic[]> {
  return customFetch<OrganizationPublic[]>("/api/organizations", {
    ...options,
    method: "GET",
  });
}

export function useListOrganizationsPublic<TError = ErrorType<unknown>>(
  options?: {
    query?: Omit<
      UseQueryOptions<OrganizationPublic[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<OrganizationPublic[], TError> {
  return useQuery({
    queryKey: getListOrganizationsPublicQueryKey(),
    queryFn: () => listOrganizationsPublic(),
    ...options?.query,
  });
}

export async function deleteOrganization(
  id: number,
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>(`/api/organizations/${id}`, {
    ...options,
    method: "DELETE",
  });
}

export function useDeleteOrganization<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteOrganization>>,
      TError,
      number
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof deleteOrganization>>,
  TError,
  number
> {
  return useMutation({
    mutationFn: (id: number) => deleteOrganization(id),
    ...options?.mutation,
  });
}
