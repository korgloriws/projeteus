import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface OrganizationSector {
  id: number;
  organizationId: number;
  name: string;
  createdAt: string;
}

export const getListOrganizationSectorsQueryKey = (organizationId: number) =>
  [`/api/organizations/${organizationId}/sectors`] as const;

export async function listOrganizationSectors(
  organizationId: number,
  options?: RequestInit,
): Promise<OrganizationSector[]> {
  return customFetch<OrganizationSector[]>(
    `/api/organizations/${organizationId}/sectors`,
    { ...options, method: "GET" },
  );
}

export function useListOrganizationSectors<TError = ErrorType<unknown>>(
  organizationId: number,
  options?: {
    query?: Omit<
      UseQueryOptions<OrganizationSector[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<OrganizationSector[], TError> {
  return useQuery({
    queryKey: getListOrganizationSectorsQueryKey(organizationId),
    queryFn: () => listOrganizationSectors(organizationId),
    ...options?.query,
  });
}

export interface CreateOrganizationSectorInput {
  organizationId: number;
  name: string;
}

export async function createOrganizationSector(
  { organizationId, name }: CreateOrganizationSectorInput,
  options?: RequestInit,
): Promise<OrganizationSector> {
  return customFetch<OrganizationSector>(
    `/api/organizations/${organizationId}/sectors`,
    {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: JSON.stringify({ name }),
    },
  );
}

export function useCreateOrganizationSector<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createOrganizationSector>>,
      TError,
      CreateOrganizationSectorInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createOrganizationSector>>,
  TError,
  CreateOrganizationSectorInput
> {
  return useMutation({
    mutationFn: (input: CreateOrganizationSectorInput) =>
      createOrganizationSector(input),
    ...options?.mutation,
  });
}

export interface UpdateOrganizationSectorInput {
  id: number;
  name: string;
}

export async function updateOrganizationSector(
  { id, name }: UpdateOrganizationSectorInput,
  options?: RequestInit,
): Promise<OrganizationSector> {
  return customFetch<OrganizationSector>(`/api/sectors/${id}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ name }),
  });
}

export function useUpdateOrganizationSector<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateOrganizationSector>>,
      TError,
      UpdateOrganizationSectorInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateOrganizationSector>>,
  TError,
  UpdateOrganizationSectorInput
> {
  return useMutation({
    mutationFn: (input: UpdateOrganizationSectorInput) =>
      updateOrganizationSector(input),
    ...options?.mutation,
  });
}

export async function deleteOrganizationSector(
  id: number,
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>(`/api/sectors/${id}`, {
    ...options,
    method: "DELETE",
  });
}

export function useDeleteOrganizationSector<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteOrganizationSector>>,
      TError,
      number
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof deleteOrganizationSector>>,
  TError,
  number
> {
  return useMutation({
    mutationFn: (id: number) => deleteOrganizationSector(id),
    ...options?.mutation,
  });
}
