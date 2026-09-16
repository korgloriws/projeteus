import type { Project, User } from "@db";
import {
  getProjectOrganizationsByType,
} from "./project-organizations";
import { isProjectMember } from "./project-members";

export type TaskValidationAction = "submit" | "approve" | "return";

export async function userBelongsToProjectEnte(
  user: User,
  projectId: number,
): Promise<boolean> {
  if (!user.organizationId) return false;
  const { entePublicoOrgIds } = await getProjectOrganizationsByType(projectId);
  return entePublicoOrgIds.includes(user.organizationId);
}

export async function userBelongsToProjectEmpresa(
  user: User,
  projectId: number,
): Promise<boolean> {
  if (!user.organizationId) return false;
  const { empresaOrgIds } = await getProjectOrganizationsByType(projectId);
  return empresaOrgIds.includes(user.organizationId);
}

/** Ente (ou admin) pode aprovar/devolver entregas. */
export async function canValidateTaskDelivery(
  user: User,
  project: Project,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (!(await isProjectMember(user.id, project.id))) return false;
  return userBelongsToProjectEnte(user, project.id);
}

/**
 * Regras do fluxo empresa → ente:
 * - entregas da empresa precisam ir a em_revisao antes de aprovadas
 * - o próprio ente (e admin) pode concluir direto, sem auto-validação
 * - aprovar/devolver em_revisao exige papel do ente (ou admin)
 */
export async function assertTaskStatusTransition(params: {
  actor: User;
  project: Project;
  previousStatus: string;
  nextStatus: string;
  canManageTasks: boolean;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { actor, project, previousStatus, nextStatus, canManageTasks } = params;

  if (previousStatus === nextStatus) {
    return { ok: true };
  }

  const isAdmin = actor.role === "admin";
  const canValidate = await canValidateTaskDelivery(actor, project);

  // Enviar para validação do ente
  if (nextStatus === "em_revisao") {
    if (!canManageTasks && !isAdmin) {
      return {
        ok: false,
        status: 403,
        error: "Apenas gestores do projeto podem enviar a tarefa para validação.",
      };
    }
    if (previousStatus === "concluida" && !isAdmin) {
      return {
        ok: false,
        status: 400,
        error: "Tarefa já aprovada. Reabra pelo fluxo de edição com um administrador, se necessário.",
      };
    }
    return { ok: true };
  }

  // Concluir / aprovar entrega
  if (nextStatus === "concluida") {
    if (isAdmin) return { ok: true };

    // Ente concluindo o próprio trabalho (ou aprovando fila) — sem auto-validação
    if (canValidate) {
      if (!canManageTasks && previousStatus !== "em_revisao") {
        return {
          ok: false,
          status: 403,
          error:
            "Membros do ente só podem aprovar entregas que estão aguardando validação.",
        };
      }
      return { ok: true };
    }

    // Empresa: só conclui depois da validação do ente
    if (previousStatus !== "em_revisao") {
      return {
        ok: false,
        status: 400,
        error:
          "Envie a tarefa para validação do ente (status “aguardando validação”) antes de concluir.",
      };
    }

    return {
      ok: false,
      status: 403,
      error: "Apenas o ente público do projeto pode aprovar a entrega.",
    };
  }

  // Devolver: sai de em_revisao para em_andamento / a_fazer
  if (
    previousStatus === "em_revisao" &&
    (nextStatus === "em_andamento" || nextStatus === "a_fazer")
  ) {
    if (!canValidate && !isAdmin) {
      return {
        ok: false,
        status: 403,
        error: "Apenas o ente público do projeto pode devolver a entrega.",
      };
    }
    return { ok: true };
  }

  // Demais transições: gestores (fluxo normal de execução)
  if (!canManageTasks && !isAdmin) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
    };
  }

  return { ok: true };
}
