import type { Task } from "@api/client";

export type TaskStatusValue = Task["status"];

const LABELS: Record<TaskStatusValue, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  em_revisao: "Aguardando validação",
  concluida: "Aprovada",
};

const COLORS: Record<TaskStatusValue, string> = {
  a_fazer: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  em_andamento: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  em_revisao:
    "bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-300",
  concluida: "bg-green-500/10 text-green-700 dark:text-green-400",
};

export function taskStatusLabel(status: string): string {
  return LABELS[status as TaskStatusValue] ?? status.replace(/_/g, " ");
}

export function taskStatusColor(status: string): string {
  return (
    COLORS[status as TaskStatusValue] ??
    "bg-gray-500/10 text-gray-700 dark:text-gray-300"
  );
}

export function isAwaitingValidation(status: string): boolean {
  return status === "em_revisao";
}

export function isApprovedDelivery(status: string): boolean {
  return status === "concluida";
}
