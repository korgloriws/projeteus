import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface OrganizationPosition {
  id: number;
  organizationId: number;
  name: string;
  createdAt: string;
}

export const getListOrganizationPositionsQueryKey = (organizationId: number) =>
  [`/api/organizations/${organizationId}/positions`] as const;

export async function listOrganizationPositions(
  organizationId: number,
  options?: RequestInit,
): Promise<OrganizationPosition[]> {
  return customFetch<OrganizationPosition[]>(
    `/api/organizations/${organizationId}/positions`,
    { ...options, method: "GET" },
  );
}

export function useListOrganizationPositions<TError = ErrorType<unknown>>(
  organizationId: number,
  options?: {
    query?: Omit<
      UseQueryOptions<OrganizationPosition[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<OrganizationPosition[], TError> {
  return useQuery({
    queryKey: getListOrganizationPositionsQueryKey(organizationId),
    queryFn: () => listOrganizationPositions(organizationId),
    ...options?.query,
  });
}

export interface CreateOrganizationPositionInput {
  organizationId: number;
  name: string;
}

export async function createOrganizationPosition(
  { organizationId, name }: CreateOrganizationPositionInput,
  options?: RequestInit,
): Promise<OrganizationPosition> {
  return customFetch<OrganizationPosition>(
    `/api/organizations/${organizationId}/positions`,
    {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: JSON.stringify({ name }),
    },
  );
}

export function useCreateOrganizationPosition<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createOrganizationPosition>>,
      TError,
      CreateOrganizationPositionInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createOrganizationPosition>>,
  TError,
  CreateOrganizationPositionInput
> {
  return useMutation({
    mutationFn: (input: CreateOrganizationPositionInput) =>
      createOrganizationPosition(input),
    ...options?.mutation,
  });
}

export interface UpdateOrganizationPositionInput {
  id: number;
  name: string;
}

export async function updateOrganizationPosition(
  { id, name }: UpdateOrganizationPositionInput,
  options?: RequestInit,
): Promise<OrganizationPosition> {
  return customFetch<OrganizationPosition>(`/api/positions/${id}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ name }),
  });
}

export function useUpdateOrganizationPosition<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateOrganizationPosition>>,
      TError,
      UpdateOrganizationPositionInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateOrganizationPosition>>,
  TError,
  UpdateOrganizationPositionInput
> {
  return useMutation({
    mutationFn: (input: UpdateOrganizationPositionInput) =>
      updateOrganizationPosition(input),
    ...options?.mutation,
  });
}

export async function deleteOrganizationPosition(
  id: number,
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>(`/api/positions/${id}`, {
    ...options,
    method: "DELETE",
  });
}

export function useDeleteOrganizationPosition<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteOrganizationPosition>>,
      TError,
      number
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof deleteOrganizationPosition>>,
  TError,
  number
> {
  return useMutation({
    mutationFn: (id: number) => deleteOrganizationPosition(id),
    ...options?.mutation,
  });
}
