import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { UserProfile, UserRole } from "./generated/react/api.schemas";
import type { OrganizationSector } from "./sectors";
import type { OrganizationPosition } from "./positions";

export interface UserSectorSummary
  extends Pick<OrganizationSector, "id" | "name" | "organizationId"> {}

export interface UserPositionSummary
  extends Pick<OrganizationPosition, "id" | "name" | "organizationId"> {}

export interface UserProfileEnriched extends UserProfile {
  sectorId?: number | null;
  sector?: UserSectorSummary | null;
  positionId?: number | null;
  position?: UserPositionSummary | null;
}

export interface CreateMemberInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  organizationId?: number;
  sectorId?: number | null;
  positionId?: number | null;
}

export async function createMember(
  input: CreateMemberInput,
  options?: RequestInit,
): Promise<UserProfileEnriched> {
  return customFetch<UserProfileEnriched>("/api/users", {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(input),
  });
}

export function useCreateMember<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createMember>>,
      TError,
      CreateMemberInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createMember>>,
  TError,
  CreateMemberInput
> {
  return useMutation({
    mutationFn: (input: CreateMemberInput) => createMember(input),
    ...options?.mutation,
  });
}

export interface UpdateMemberOrganizationInput {
  id: number;
  organizationId: number;
}

export async function updateMemberOrganization(
  { id, organizationId }: UpdateMemberOrganizationInput,
  options?: RequestInit,
): Promise<UserProfileEnriched> {
  return customFetch<UserProfileEnriched>(`/api/users/${id}/organization`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ organizationId }),
  });
}

export function useUpdateMemberOrganization<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateMemberOrganization>>,
      TError,
      UpdateMemberOrganizationInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateMemberOrganization>>,
  TError,
  UpdateMemberOrganizationInput
> {
  return useMutation({
    mutationFn: (input: UpdateMemberOrganizationInput) =>
      updateMemberOrganization(input),
    ...options?.mutation,
  });
}

export interface UpdateMemberSectorInput {
  id: number;
  sectorId: number | null;
}

export async function updateMemberSector(
  { id, sectorId }: UpdateMemberSectorInput,
  options?: RequestInit,
): Promise<UserProfileEnriched> {
  return customFetch<UserProfileEnriched>(`/api/users/${id}/sector`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ sectorId }),
  });
}

export function useUpdateMemberSector<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateMemberSector>>,
      TError,
      UpdateMemberSectorInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateMemberSector>>,
  TError,
  UpdateMemberSectorInput
> {
  return useMutation({
    mutationFn: (input: UpdateMemberSectorInput) => updateMemberSector(input),
    ...options?.mutation,
  });
}

export interface UpdateMemberPositionInput {
  id: number;
  positionId: number | null;
}

export async function updateMemberPosition(
  { id, positionId }: UpdateMemberPositionInput,
  options?: RequestInit,
): Promise<UserProfileEnriched> {
  return customFetch<UserProfileEnriched>(`/api/users/${id}/position`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ positionId }),
  });
}

export function useUpdateMemberPosition<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateMemberPosition>>,
      TError,
      UpdateMemberPositionInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateMemberPosition>>,
  TError,
  UpdateMemberPositionInput
> {
  return useMutation({
    mutationFn: (input: UpdateMemberPositionInput) => updateMemberPosition(input),
    ...options?.mutation,
  });
}

export interface UpdateMyAccountInput {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export async function updateMyAccount(
  input: UpdateMyAccountInput,
  options?: RequestInit,
): Promise<UserProfileEnriched> {
  return customFetch<UserProfileEnriched>("/api/users/me", {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(input),
  });
}

export function useUpdateMyAccount<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateMyAccount>>,
      TError,
      UpdateMyAccountInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateMyAccount>>,
  TError,
  UpdateMyAccountInput
> {
  return useMutation({
    mutationFn: (input: UpdateMyAccountInput) => updateMyAccount(input),
    ...options?.mutation,
  });
}

export interface AdminUpdateUserInput {
  id: number;
  name?: string;
  email?: string;
  password?: string;
}

export async function adminUpdateUser(
  { id, ...body }: AdminUpdateUserInput,
  options?: RequestInit,
): Promise<UserProfileEnriched> {
  return customFetch<UserProfileEnriched>(`/api/users/${id}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
}

export function useAdminUpdateUser<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof adminUpdateUser>>,
      TError,
      AdminUpdateUserInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof adminUpdateUser>>,
  TError,
  AdminUpdateUserInput
> {
  return useMutation({
    mutationFn: (input: AdminUpdateUserInput) => adminUpdateUser(input),
    ...options?.mutation,
  });
}

export async function deleteMember(
  id: number,
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>(`/api/users/${id}`, {
    ...options,
    method: "DELETE",
  });
}

export function useDeleteMember<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof deleteMember>>,
      TError,
      number
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof deleteMember>>,
  TError,
  number
> {
  return useMutation({
    mutationFn: (id: number) => deleteMember(id),
    ...options?.mutation,
  });
}
