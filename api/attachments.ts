import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export interface AttachmentUploader {
  id: number;
  name: string;
  email: string;
}

export interface Attachment {
  id: number;
  projectId: number;
  stageId: number | null;
  taskId: number | null;
  uploadedByUserId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: AttachmentUploader | null;
}

export type AttachmentScope = "project" | "stage" | "task" | "all";

export interface ListAttachmentsParams {
  projectId: number;
  scope?: AttachmentScope;
  stageId?: number;
  taskId?: number;
}

export const getListAttachmentsQueryKey = (params: ListAttachmentsParams) =>
  [
    `/api/projects/${params.projectId}/attachments`,
    {
      scope: params.scope ?? "all",
      stageId: params.stageId ?? null,
      taskId: params.taskId ?? null,
    },
  ] as const;

function buildListUrl(params: ListAttachmentsParams): string {
  const search = new URLSearchParams();
  if (params.scope) search.set("scope", params.scope);
  if (params.stageId != null) search.set("stageId", String(params.stageId));
  if (params.taskId != null) search.set("taskId", String(params.taskId));
  const qs = search.toString();
  return `/api/projects/${params.projectId}/attachments${qs ? `?${qs}` : ""}`;
}

export async function listAttachments(
  params: ListAttachmentsParams,
  options?: RequestInit,
): Promise<Attachment[]> {
  return customFetch<Attachment[]>(buildListUrl(params), {
    ...options,
    method: "GET",
  });
}

export function useListAttachments<TError = ErrorType<unknown>>(
  params: ListAttachmentsParams,
  options?: {
    query?: Omit<
      UseQueryOptions<Attachment[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<Attachment[], TError> {
  return useQuery({
    queryKey: getListAttachmentsQueryKey(params),
    queryFn: () => listAttachments(params),
    enabled: params.projectId > 0 && (options?.query?.enabled ?? true),
    ...options?.query,
  });
}

export interface UploadAttachmentInput {
  projectId: number;
  file: File;
  stageId?: number | null;
  taskId?: number | null;
}

export async function uploadAttachment(
  { projectId, file, stageId, taskId }: UploadAttachmentInput,
): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  if (stageId != null) form.append("stageId", String(stageId));
  if (taskId != null) form.append("taskId", String(taskId));

  return customFetch<Attachment>(`/api/projects/${projectId}/attachments`, {
    method: "POST",
    body: form,
  });
}

export function useUploadAttachment<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<
      Attachment,
      TError,
      UploadAttachmentInput
    >;
  },
): UseMutationResult<Attachment, TError, UploadAttachmentInput> {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options?.mutation ?? {};
  return useMutation({
    mutationFn: uploadAttachment,
    ...rest,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${variables.projectId}/attachments`],
      });
      onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export async function deleteAttachment(
  id: number,
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>(`/api/attachments/${id}`, {
    ...options,
    method: "DELETE",
  });
}

export function useDeleteAttachment<TError = ErrorType<unknown>>(
  options?: {
    mutation?: UseMutationOptions<void, TError, { id: number; projectId: number }>;
  },
): UseMutationResult<void, TError, { id: number; projectId: number }> {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options?.mutation ?? {};
  return useMutation({
    mutationFn: ({ id }) => deleteAttachment(id),
    ...rest,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${variables.projectId}/attachments`],
      });
      onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/** URL relativa para visualizar/baixar o arquivo (com cookie de sessão). */
export function getAttachmentFileUrl(id: number): string {
  return `/api/attachments/${id}/file`;
}

export async function fetchAttachmentBlob(id: number): Promise<Blob> {
  return customFetch<Blob>(getAttachmentFileUrl(id), {
    method: "GET",
    responseType: "blob",
  });
}

export async function uploadPendingFiles(
  projectId: number,
  files: File[],
  links?: { stageId?: number | null; taskId?: number | null },
): Promise<Attachment[]> {
  const results: Attachment[] = [];
  for (const file of files) {
    results.push(
      await uploadAttachment({
        projectId,
        file,
        stageId: links?.stageId,
        taskId: links?.taskId,
      }),
    );
  }
  return results;
}
