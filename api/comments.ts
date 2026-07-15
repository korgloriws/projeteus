import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { UserRole } from "./generated/react/api.schemas";

export interface CommentAuthor {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface ProjectComment {
  id: number;
  projectId: number | null;
  taskId: number | null;
  authorUserId: number;
  content: string;
  createdAt: string;
  author: CommentAuthor;
}

export const getListProjectCommentsQueryKey = (projectId: number) =>
  [`/api/projects/${projectId}/comments`] as const;

export async function listProjectComments(
  projectId: number,
  options?: RequestInit,
): Promise<ProjectComment[]> {
  return customFetch<ProjectComment[]>(`/api/projects/${projectId}/comments`, {
    ...options,
    method: "GET",
  });
}

export function useListProjectComments<TError = ErrorType<unknown>>(
  projectId: number,
  options?: {
    query?: Omit<
      UseQueryOptions<ProjectComment[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<ProjectComment[], TError> {
  return useQuery({
    queryKey: getListProjectCommentsQueryKey(projectId),
    queryFn: () => listProjectComments(projectId),
    ...options?.query,
  });
}

export interface CreateProjectCommentInput {
  projectId: number;
  content: string;
}

export async function createProjectComment(
  { projectId, content }: CreateProjectCommentInput,
  options?: RequestInit,
): Promise<ProjectComment> {
  return customFetch<ProjectComment>(`/api/projects/${projectId}/comments`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ content }),
  });
}

export function useCreateProjectComment<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Awaited<ReturnType<typeof createProjectComment>>,
      TError,
      CreateProjectCommentInput
    >;
  },
): UseMutationResult<
  Awaited<ReturnType<typeof createProjectComment>>,
  TError,
  CreateProjectCommentInput
> {
  return useMutation({
    mutationFn: (input: CreateProjectCommentInput) =>
      createProjectComment(input),
    ...options?.mutation,
  });
}
