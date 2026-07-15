import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export type NotificationType =
  | "task_created"
  | "task_assigned"
  | "task_updated"
  | "task_completed"
  | "task_moved"
  | "task_deleted"
  | "stage_created"
  | "stage_assigned"
  | "stage_updated"
  | "stage_completed"
  | "stage_deleted"
  | "comment_created"
  | "project_updated"
  | "project_gestor_assigned"
  | "member_added";

export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  projectId: number | null;
  stageId: number | null;
  taskId: number | null;
  link: string | null;
  actorUserId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface ListNotificationsParams {
  limit?: number;
  unreadOnly?: boolean;
}

function buildQuery(params?: ListNotificationsParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.unreadOnly !== undefined) {
    search.set("unreadOnly", params.unreadOnly ? "true" : "false");
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const getListNotificationsQueryKey = (
  params?: ListNotificationsParams,
) => [`/api/notifications`, params ?? {}] as const;

export async function listNotifications(
  params?: ListNotificationsParams,
  options?: RequestInit,
): Promise<NotificationItem[]> {
  return customFetch<NotificationItem[]>(
    `/api/notifications${buildQuery(params)}`,
    { ...options, method: "GET" },
  );
}

export function useListNotifications<TError = ErrorType<unknown>>(
  params?: ListNotificationsParams,
  options?: {
    query?: Omit<
      UseQueryOptions<NotificationItem[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<NotificationItem[], TError> {
  return useQuery({
    queryKey: getListNotificationsQueryKey(params),
    queryFn: () => listNotifications(params),
    ...options?.query,
  });
}

export const getUnreadNotificationsCountQueryKey = () =>
  ["/api/notifications/unread-count"] as const;

export async function getUnreadNotificationsCount(
  options?: RequestInit,
): Promise<number> {
  const result = await customFetch<{ count: number }>(
    "/api/notifications/unread-count",
    { ...options, method: "GET" },
  );
  return result.count;
}

export function useUnreadNotificationsCount<TError = ErrorType<unknown>>(options?: {
  query?: Omit<UseQueryOptions<number, TError>, "queryKey" | "queryFn">;
}): UseQueryResult<number, TError> {
  return useQuery({
    queryKey: getUnreadNotificationsCountQueryKey(),
    queryFn: () => getUnreadNotificationsCount(),
    ...options?.query,
  });
}

export async function markNotificationRead(
  id: number,
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>(`/api/notifications/${id}/read`, {
    ...options,
    method: "POST",
  });
}

export function useMarkNotificationRead<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof markNotificationRead>>,
    TError,
    number
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof markNotificationRead>>,
  TError,
  number
> {
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    ...options?.mutation,
  });
}

export async function markAllNotificationsRead(
  options?: RequestInit,
): Promise<void> {
  await customFetch<void>("/api/notifications/read-all", {
    ...options,
    method: "POST",
  });
}

export function useMarkAllNotificationsRead<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof markAllNotificationsRead>>,
    TError,
    void
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof markAllNotificationsRead>>,
  TError,
  void
> {
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    ...options?.mutation,
  });
}
