import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type {
  Project,
  ProjectInput,
  UserProfile,
  Task,
  Stage,
  StageInput,
  StageUpdate,
} from "./generated/react/api.schemas";

export interface StageWithMembers extends Stage {
  memberIds: number[];
}

export interface ProjectWithOrganizations extends Project {
  empresaOrgIds?: number[];
  entePublicoOrgIds?: number[];
}

export interface TaskWithAssignees extends Task {
  assigneeUserIds?: number[];
}

export type ProjectMemberRole = "gestor" | "membro";

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  role: ProjectMemberRole;
  createdAt: string;
  user: UserProfile;
}

export interface CreateProjectInput extends ProjectInput {
  gestorUserId?: number;
  empresaOrgIds?: number[];
  entePublicoOrgIds?: number[];
}

export async function createProjectWithGestor(
  input: CreateProjectInput,
  options?: RequestInit,
): Promise<Project> {
  return customFetch<Project>("/api/projects", {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(input),
  });
}

export function useCreateProjectWithGestor<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createProjectWithGestor>>,
      TError,
      CreateProjectInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createProjectWithGestor>>,
  TError,
  CreateProjectInput
> {
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProjectWithGestor(input),
    ...options?.mutation,
  });
}

export const getListProjectMembersQueryKey = (projectId: number) =>
  [`/api/projects/${projectId}/members`] as const;

export async function listProjectMembers(
  projectId: number,
  options?: RequestInit,
): Promise<ProjectMember[]> {
  return customFetch<ProjectMember[]>(`/api/projects/${projectId}/members`, {
    ...options,
    method: "GET",
  });
}

export function useListProjectMembers<TError = ErrorType<unknown>>(
  projectId: number,
  options?: {
    query?: Omit<
      UseQueryOptions<ProjectMember[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<ProjectMember[], TError> {
  return useQuery({
    queryKey: getListProjectMembersQueryKey(projectId),
    queryFn: () => listProjectMembers(projectId),
    ...options?.query,
  });
}

export interface AddProjectMemberInput {
  projectId: number;
  userId?: number;
  userIds?: number[];
  role?: ProjectMemberRole;
}

export async function addProjectMember(
  { projectId, userId, userIds, role }: AddProjectMemberInput,
  options?: RequestInit,
): Promise<ProjectMember | ProjectMember[]> {
  return customFetch<ProjectMember | ProjectMember[]>(
    `/api/projects/${projectId}/members`,
    {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: JSON.stringify({ userId, userIds, role }),
    },
  );
}

export function useAddProjectMember<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof addProjectMember>>,
      TError,
      AddProjectMemberInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof addProjectMember>>,
  TError,
  AddProjectMemberInput
> {
  return useMutation({
    mutationFn: (input: AddProjectMemberInput) => addProjectMember(input),
    ...options?.mutation,
  });
}

export interface UpdateProjectMemberInput {
  projectId: number;
  memberId: number;
  role: ProjectMemberRole;
}

export async function updateProjectMember(
  { projectId, memberId, role }: UpdateProjectMemberInput,
  options?: RequestInit,
): Promise<ProjectMember> {
  return customFetch<ProjectMember>(
    `/api/projects/${projectId}/members/${memberId}`,
    {
      ...options,
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: JSON.stringify({ role }),
    },
  );
}

export function useUpdateProjectMember<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateProjectMember>>,
      TError,
      UpdateProjectMemberInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateProjectMember>>,
  TError,
  UpdateProjectMemberInput
> {
  return useMutation({
    mutationFn: (input: UpdateProjectMemberInput) => updateProjectMember(input),
    ...options?.mutation,
  });
}

export interface RemoveProjectMemberInput {
  projectId: number;
  memberId: number;
}

export async function removeProjectMember(
  { projectId, memberId }: RemoveProjectMemberInput,
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>(`/api/projects/${projectId}/members/${memberId}`, {
    ...options,
    method: "DELETE",
  });
}

export function useRemoveProjectMember<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof removeProjectMember>>,
      TError,
      RemoveProjectMemberInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof removeProjectMember>>,
  TError,
  RemoveProjectMemberInput
> {
  return useMutation({
    mutationFn: (input: RemoveProjectMemberInput) => removeProjectMember(input),
    ...options?.mutation,
  });
}

export interface CreateStageWithMembersInput {
  projectId: number;
  data: StageInput & { memberIds: number[] };
}

export async function createStageWithMembers(
  { projectId, data }: CreateStageWithMembersInput,
  options?: RequestInit,
): Promise<StageWithMembers> {
  return customFetch<StageWithMembers>(`/api/projects/${projectId}/stages`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });
}

export function useCreateStageWithMembers<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createStageWithMembers>>,
      TError,
      CreateStageWithMembersInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createStageWithMembers>>,
  TError,
  CreateStageWithMembersInput
> {
  return useMutation({
    mutationFn: (input: CreateStageWithMembersInput) =>
      createStageWithMembers(input),
    ...options?.mutation,
  });
}

export interface UpdateStageWithMembersInput {
  id: number;
  data: StageUpdate & { memberIds?: number[] };
}

export async function updateStageWithMembers(
  { id, data }: UpdateStageWithMembersInput,
  options?: RequestInit,
): Promise<StageWithMembers> {
  return customFetch<StageWithMembers>(`/api/stages/${id}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });
}

export function useUpdateStageWithMembers<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateStageWithMembers>>,
      TError,
      UpdateStageWithMembersInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateStageWithMembers>>,
  TError,
  UpdateStageWithMembersInput
> {
  return useMutation({
    mutationFn: (input: UpdateStageWithMembersInput) =>
      updateStageWithMembers(input),
    ...options?.mutation,
  });
}

export interface ReorderTaskInput {
  id: number;
  order: number;
}

export async function reorderTask(
  { id, order }: ReorderTaskInput,
  options?: RequestInit,
): Promise<Task> {
  return customFetch<Task>(`/api/tasks/${id}/reorder`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ order }),
  });
}

export function useReorderTask<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof reorderTask>>,
      TError,
      ReorderTaskInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof reorderTask>>,
  TError,
  ReorderTaskInput
> {
  return useMutation({
    mutationFn: (input: ReorderTaskInput) => reorderTask(input),
    ...options?.mutation,
  });
}

export interface MoveTaskWithOrderInput {
  id: number;
  stageId: number;
  order?: number;
}

export async function moveTaskWithOrder(
  { id, stageId, order }: MoveTaskWithOrderInput,
  options?: RequestInit,
): Promise<Task> {
  return customFetch<Task>(`/api/tasks/${id}/move`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ stageId, order }),
  });
}

export function useMoveTaskWithOrder<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof moveTaskWithOrder>>,
      TError,
      MoveTaskWithOrderInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof moveTaskWithOrder>>,
  TError,
  MoveTaskWithOrderInput
> {
  return useMutation({
    mutationFn: (input: MoveTaskWithOrderInput) => moveTaskWithOrder(input),
    ...options?.mutation,
  });
}

export interface CreateTaskWithAssigneesInput {
  stageId: number;
  data: {
    title: string;
    description?: string | null;
    dueDate?: string | null;
    assigneeUserIds: number[];
  };
}

export async function createTaskWithAssignees(
  { stageId, data }: CreateTaskWithAssigneesInput,
  options?: RequestInit,
): Promise<TaskWithAssignees> {
  return customFetch<TaskWithAssignees>(`/api/stages/${stageId}/tasks`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });
}

export function useCreateTaskWithAssignees<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createTaskWithAssignees>>,
      TError,
      CreateTaskWithAssigneesInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createTaskWithAssignees>>,
  TError,
  CreateTaskWithAssigneesInput
> {
  return useMutation({
    mutationFn: (input: CreateTaskWithAssigneesInput) => createTaskWithAssignees(input),
    ...options?.mutation,
  });
}

export interface UpdateTaskWithAssigneesInput {
  id: number;
  data: {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    status?: Task["status"];
    priority?: Task["priority"];
    assigneeUserIds?: number[];
  };
}

export async function updateTaskWithAssignees(
  { id, data }: UpdateTaskWithAssigneesInput,
  options?: RequestInit,
): Promise<TaskWithAssignees> {
  return customFetch<TaskWithAssignees>(`/api/tasks/${id}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(data),
  });
}

export function useUpdateTaskWithAssignees<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof updateTaskWithAssignees>>,
      TError,
      UpdateTaskWithAssigneesInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof updateTaskWithAssignees>>,
  TError,
  UpdateTaskWithAssigneesInput
> {
  return useMutation({
    mutationFn: (input: UpdateTaskWithAssigneesInput) => updateTaskWithAssignees(input),
    ...options?.mutation,
  });
}
