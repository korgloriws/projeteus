import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export type ProjectInviteRole = "gestor" | "membro";
export type ProjectInviteChannel = "internal" | "external";
export type ProjectInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

export interface ProjectInviteItem {
  id: number;
  token: string;
  projectId: number;
  invitedByUserId: number;
  inviteeUserId: number | null;
  inviteeEmail: string;
  inviteeName: string | null;
  role: ProjectInviteRole;
  channel: ProjectInviteChannel;
  status: ProjectInviteStatus;
  expiresAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  link: string;
  /** URL absoluta do produto (para e-mail / compartilhar). */
  url: string;
  projectTitle?: string;
  invitedByName?: string;
  inviteeNameResolved?: string | null;
}

export interface InviteCandidateUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface InviteCandidateSector {
  id: number | null;
  name: string;
  users: InviteCandidateUser[];
}

export interface InviteCandidateOrganization {
  id: number;
  name: string;
  type: "empresa" | "ente_publico";
  sectors: InviteCandidateSector[];
}

export interface InviteCandidatesResponse {
  organizations: InviteCandidateOrganization[];
}

export interface PublicInviteTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  order: number;
}

export interface PublicInviteStage {
  id: number;
  name: string;
  order: number;
  status: string;
  dueDate: string | null;
  tasks: PublicInviteTask[];
}

export interface PublicInviteProject {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  priorityRank: number;
  dueDate: string | null;
  createdAt: string;
  empresaOrgs: Array<{ id: number; name: string; type: string }>;
  entePublicoOrgs: Array<{ id: number; name: string; type: string }>;
  progressPercent: number;
  totalStages: number;
  totalTasks: number;
  completedTasks: number;
  stages: PublicInviteStage[];
}

export interface PublicInviteResponse {
  invite: ProjectInviteItem;
  project: PublicInviteProject;
  /** Presente se o visitante estiver autenticado. */
  viewerIsMember?: boolean;
}

export interface CreateProjectInvitesInput {
  projectId: number;
  channel: ProjectInviteChannel;
  role: ProjectInviteRole;
  userIds?: number[];
  emails?: Array<{ email: string; name?: string }>;
}

export interface CreateProjectInvitesResult {
  invites: ProjectInviteItem[];
  errors: string[];
}

export const getListProjectInvitesQueryKey = (projectId: number) =>
  [`/api/projects/${projectId}/invites`] as const;

export const getInviteCandidatesQueryKey = (projectId: number) =>
  [`/api/projects/${projectId}/invite-candidates`] as const;

export const getPublicInviteQueryKey = (token: string) =>
  [`/api/invites/${token}`] as const;

export async function listProjectInvites(
  projectId: number,
  options?: RequestInit,
): Promise<ProjectInviteItem[]> {
  return customFetch<ProjectInviteItem[]>(
    `/api/projects/${projectId}/invites`,
    { ...options, method: "GET" },
  );
}

export function useListProjectInvites<TError = ErrorType<unknown>>(
  projectId: number,
  options?: {
    query?: Omit<
      UseQueryOptions<ProjectInviteItem[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<ProjectInviteItem[], TError> {
  return useQuery({
    queryKey: getListProjectInvitesQueryKey(projectId),
    queryFn: () => listProjectInvites(projectId),
    enabled: projectId > 0,
    ...options?.query,
  });
}

export async function listInviteCandidates(
  projectId: number,
  options?: RequestInit,
): Promise<InviteCandidatesResponse> {
  return customFetch<InviteCandidatesResponse>(
    `/api/projects/${projectId}/invite-candidates`,
    { ...options, method: "GET" },
  );
}

export function useListInviteCandidates<TError = ErrorType<unknown>>(
  projectId: number,
  options?: {
    query?: Omit<
      UseQueryOptions<InviteCandidatesResponse, TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<InviteCandidatesResponse, TError> {
  return useQuery({
    queryKey: getInviteCandidatesQueryKey(projectId),
    queryFn: () => listInviteCandidates(projectId),
    enabled: projectId > 0,
    ...options?.query,
  });
}

export async function createProjectInvites(
  input: CreateProjectInvitesInput,
  options?: RequestInit,
): Promise<CreateProjectInvitesResult> {
  const { projectId, ...body } = input;
  return customFetch<CreateProjectInvitesResult>(
    `/api/projects/${projectId}/invites`,
    {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: JSON.stringify(body),
    },
  );
}

export function useCreateProjectInvites<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      CreateProjectInvitesResult,
      TError,
      CreateProjectInvitesInput
    >;
  },
): UseMutationResult<CreateProjectInvitesResult, TError, CreateProjectInvitesInput> {
  return useMutation({
    mutationFn: (input: CreateProjectInvitesInput) => createProjectInvites(input),
    ...options?.mutation,
  });
}

export async function revokeProjectInvite(
  projectId: number,
  inviteId: number,
  options?: RequestInit,
): Promise<ProjectInviteItem> {
  return customFetch<ProjectInviteItem>(
    `/api/projects/${projectId}/invites/${inviteId}/revoke`,
    { ...options, method: "POST" },
  );
}

export function useRevokeProjectInvite<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      ProjectInviteItem,
      TError,
      { projectId: number; inviteId: number }
    >;
  },
): UseMutationResult<
  ProjectInviteItem,
  TError,
  { projectId: number; inviteId: number }
> {
  return useMutation({
    mutationFn: ({ projectId, inviteId }) =>
      revokeProjectInvite(projectId, inviteId),
    ...options?.mutation,
  });
}

export async function getPublicInvite(
  token: string,
  options?: RequestInit,
): Promise<PublicInviteResponse> {
  return customFetch<PublicInviteResponse>(`/api/invites/${token}`, {
    ...options,
    method: "GET",
  });
}

export function usePublicInvite<TError = ErrorType<unknown>>(
  token: string,
  options?: {
    query?: Omit<
      UseQueryOptions<PublicInviteResponse, TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<PublicInviteResponse, TError> {
  return useQuery({
    queryKey: getPublicInviteQueryKey(token),
    queryFn: () => getPublicInvite(token),
    enabled: Boolean(token),
    ...options?.query,
  });
}

export async function acceptProjectInvite(
  token: string,
  options?: RequestInit,
): Promise<{ invite: ProjectInviteItem; projectId: number }> {
  return customFetch<{ invite: ProjectInviteItem; projectId: number }>(
    `/api/invites/${token}/accept`,
    { ...options, method: "POST" },
  );
}

export function useAcceptProjectInvite<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      { invite: ProjectInviteItem; projectId: number },
      TError,
      string
    >;
  },
): UseMutationResult<
  { invite: ProjectInviteItem; projectId: number },
  TError,
  string
> {
  return useMutation({
    mutationFn: (token: string) => acceptProjectInvite(token),
    ...options?.mutation,
  });
}

export async function declineProjectInvite(
  token: string,
  options?: RequestInit,
): Promise<ProjectInviteItem> {
  return customFetch<ProjectInviteItem>(`/api/invites/${token}/decline`, {
    ...options,
    method: "POST",
  });
}

export function useDeclineProjectInvite<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<ProjectInviteItem, TError, string>;
  },
): UseMutationResult<ProjectInviteItem, TError, string> {
  return useMutation({
    mutationFn: (token: string) => declineProjectInvite(token),
    ...options?.mutation,
  });
}
