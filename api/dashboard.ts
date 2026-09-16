import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";
import type { ActivityType } from "./generated/react/api.schemas";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  projectId: number;
  projectTitle: string;
  stageId: number | null;
  stageTitle: string | null;
  taskId: number | null;
  taskTitle: string | null;
  actorUserId: number;
  assigneeUserId: number | null;
  summary: string;
  createdAt: string;
}

export interface GetDashboardActivityParams {
  limit?: number;
  fromDate?: string;
  toDate?: string;
  projectId?: number;
  assigneeUserId?: number;
  taskId?: number;
  stageId?: number;
}

export interface ActivityFilterOptions {
  projects: { id: number; title: string }[];
  stages: { id: number; name: string; projectId: number }[];
  tasks: {
    id: number;
    title: string;
    projectId: number;
    stageId: number;
    assigneeUserId: number | null;
  }[];
  assignees: { id: number; name: string }[];
}

function buildActivityQuery(params?: GetDashboardActivityParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);
  if (params.projectId !== undefined) {
    search.set("projectId", String(params.projectId));
  }
  if (params.assigneeUserId !== undefined) {
    search.set("assigneeUserId", String(params.assigneeUserId));
  }
  if (params.taskId !== undefined) search.set("taskId", String(params.taskId));
  if (params.stageId !== undefined) search.set("stageId", String(params.stageId));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const getGetDashboardActivityQueryKey = (
  params?: GetDashboardActivityParams,
) => [`/api/dashboard/activity`, params ?? {}] as const;

export async function getDashboardActivity(
  params?: GetDashboardActivityParams,
  options?: RequestInit,
): Promise<ActivityItem[]> {
  return customFetch<ActivityItem[]>(
    `/api/dashboard/activity${buildActivityQuery(params)}`,
    { ...options, method: "GET" },
  );
}

export function useGetDashboardActivity<TError = ErrorType<unknown>>(
  params?: GetDashboardActivityParams,
  options?: {
    query?: Omit<
      UseQueryOptions<ActivityItem[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<ActivityItem[], TError> {
  return useQuery({
    queryKey: getGetDashboardActivityQueryKey(params),
    queryFn: () => getDashboardActivity(params),
    ...options?.query,
  });
}

export const getGetActivityFilterOptionsQueryKey = () =>
  ["/api/dashboard/activity/filters"] as const;

export async function getActivityFilterOptions(
  options?: RequestInit,
): Promise<ActivityFilterOptions> {
  return customFetch<ActivityFilterOptions>("/api/dashboard/activity/filters", {
    ...options,
    method: "GET",
  });
}

export function useGetActivityFilterOptions<TError = ErrorType<unknown>>(
  options?: {
    query?: Omit<
      UseQueryOptions<ActivityFilterOptions, TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<ActivityFilterOptions, TError> {
  return useQuery({
    queryKey: getGetActivityFilterOptionsQueryKey(),
    queryFn: () => getActivityFilterOptions(),
    ...options?.query,
  });
}

export type MyTaskStatus =
  | "a_fazer"
  | "em_andamento"
  | "em_revisao"
  | "concluida";

export interface MyTaskItem {
  id: number;
  stageId: number;
  projectId: number;
  title: string;
  description: string | null;
  status: MyTaskStatus;
  priority: string;
  assigneeUserId: number | null;
  dueDate: string | null;
  order: number;
  createdAt: string;
  projectTitle: string;
  stageTitle: string;
}

export interface GetMyTasksParams {
  status?: MyTaskStatus;
  projectId?: number;
  stageId?: number;
  dueFrom?: string;
  dueTo?: string;
}

export interface MyTasksFilterOptions {
  projects: { id: number; title: string }[];
  stages: { id: number; name: string; projectId: number }[];
  statuses: readonly MyTaskStatus[];
}

function buildMyTasksQuery(params?: GetMyTasksParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.projectId !== undefined) {
    search.set("projectId", String(params.projectId));
  }
  if (params.stageId !== undefined) search.set("stageId", String(params.stageId));
  if (params.dueFrom) search.set("dueFrom", params.dueFrom);
  if (params.dueTo) search.set("dueTo", params.dueTo);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const getGetMyTasksQueryKey = (params?: GetMyTasksParams) =>
  [`/api/dashboard/my-tasks`, params ?? {}] as const;

export async function getMyTasks(
  params?: GetMyTasksParams,
  options?: RequestInit,
): Promise<MyTaskItem[]> {
  return customFetch<MyTaskItem[]>(
    `/api/dashboard/my-tasks${buildMyTasksQuery(params)}`,
    { ...options, method: "GET" },
  );
}

export function useGetMyTasks<TError = ErrorType<unknown>>(
  params?: GetMyTasksParams,
  options?: {
    query?: Omit<
      UseQueryOptions<MyTaskItem[], TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<MyTaskItem[], TError> {
  return useQuery({
    queryKey: getGetMyTasksQueryKey(params),
    queryFn: () => getMyTasks(params),
    ...options?.query,
  });
}

export const getGetMyTasksFilterOptionsQueryKey = () =>
  ["/api/dashboard/my-tasks/filters"] as const;

export async function getMyTasksFilterOptions(
  options?: RequestInit,
): Promise<MyTasksFilterOptions> {
  return customFetch<MyTasksFilterOptions>("/api/dashboard/my-tasks/filters", {
    ...options,
    method: "GET",
  });
}

export function useGetMyTasksFilterOptions<TError = ErrorType<unknown>>(
  options?: {
    query?: Omit<
      UseQueryOptions<MyTasksFilterOptions, TError>,
      "queryKey" | "queryFn"
    >;
  },
): UseQueryResult<MyTasksFilterOptions, TError> {
  return useQuery({
    queryKey: getGetMyTasksFilterOptionsQueryKey(),
    queryFn: () => getMyTasksFilterOptions(),
    ...options?.query,
  });
}
