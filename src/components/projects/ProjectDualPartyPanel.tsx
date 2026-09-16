import { formatDatePtBR } from "@/lib/dates";
import {
  Building2,
  Calendar,
  Landmark,
  Users,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import type { Organization } from "@api/client";
import type { ProjectMember } from "@api/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PartySide = "empresa" | "ente_publico" | "outro";

type DualPartyPanelProps = {
  empresaOrgIds: number[];
  entePublicoOrgIds: number[];
  organizations: Organization[];
  members: ProjectMember[];
  projectDueDate?: string | null;
  /** Tarefas em revisão — sinal leve de “aguardando validação”. */
  tasksInReview?: number;
  className?: string;
};

export function resolvePartySide(
  organizationId: number | null | undefined,
  empresaOrgIds: Set<number>,
  entePublicoOrgIds: Set<number>,
): PartySide {
  if (organizationId == null) return "outro";
  if (empresaOrgIds.has(organizationId)) return "empresa";
  if (entePublicoOrgIds.has(organizationId)) return "ente_publico";
  return "outro";
}

export function PartySideBadge({ side }: { side: PartySide }) {
  if (side === "empresa") {
    return (
      <Badge
        variant="outline"
        className="border-orange-500/30 bg-orange-500/10 text-[10px] font-medium text-orange-700 dark:text-orange-400"
      >
        Empresa
      </Badge>
    );
  }
  if (side === "ente_publico") {
    return (
      <Badge
        variant="outline"
        className="border-sky-500/30 bg-sky-500/10 text-[10px] font-medium text-sky-700 dark:text-sky-400"
      >
        Ente
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] font-medium">
      Outro
    </Badge>
  );
}

function PartyColumn({
  side,
  orgNames,
  members,
}: {
  side: "empresa" | "ente_publico";
  orgNames: string[];
  members: ProjectMember[];
}) {
  const isEmpresa = side === "empresa";
  const gestors = members.filter((m) => m.role === "gestor").length;
  const Icon = isEmpresa ? Building2 : Landmark;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isEmpresa
          ? "border-orange-500/25 bg-orange-500/[0.04]"
          : "border-sky-500/25 bg-sky-500/[0.04]",
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isEmpresa
              ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
              : "bg-sky-500/15 text-sky-600 dark:text-sky-400",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {isEmpresa ? "Empresa contratada" : "Ente público"}
          </p>
          {orgNames.length > 0 ? (
            <ul className="mt-0.5 space-y-0.5">
              {orgNames.map((name) => (
                <li
                  key={name}
                  className="truncate text-sm font-semibold text-foreground"
                  title={name}
                >
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Organização não encontrada
            </p>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {members.length} membro{members.length === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span>
          {gestors} gestor{gestors === 1 ? "" : "es"}
        </span>
      </div>

      {members.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {members.slice(0, 8).map((member) => (
            <Avatar
              key={member.id}
              className="h-7 w-7 border border-background"
              title={`${member.user.name} (${member.role})`}
            >
              <AvatarFallback
                className={cn(
                  "text-[10px]",
                  isEmpresa
                    ? "bg-orange-500/20 text-orange-800 dark:text-orange-200"
                    : "bg-sky-500/20 text-sky-800 dark:text-sky-200",
                )}
              >
                {member.user.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {members.length > 8 ? (
            <span className="flex h-7 items-center rounded-full bg-muted px-2 text-[10px] text-muted-foreground">
              +{members.length - 8}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-dashed px-2 py-2 text-xs text-muted-foreground">
          Nenhum membro desta parte no projeto ainda.
        </p>
      )}
    </div>
  );
}

export function ProjectDualPartyPanel({
  empresaOrgIds,
  entePublicoOrgIds,
  organizations,
  members,
  projectDueDate,
  tasksInReview = 0,
  className,
}: DualPartyPanelProps) {
  const empresaIdSet = new Set(empresaOrgIds);
  const enteIdSet = new Set(entePublicoOrgIds);

  const orgById = new Map(organizations.map((org) => [org.id, org]));

  const empresaNames = empresaOrgIds
    .map((id) => orgById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  const enteNames = entePublicoOrgIds
    .map((id) => orgById.get(id)?.name)
    .filter((name): name is string => Boolean(name));

  const empresaMembers = members.filter((m) =>
    resolvePartySide(m.user.organizationId, empresaIdSet, enteIdSet) ===
    "empresa",
  );
  const enteMembers = members.filter(
    (m) =>
      resolvePartySide(m.user.organizationId, empresaIdSet, enteIdSet) ===
      "ente_publico",
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Parceria do projeto
          </h2>
          <p className="text-xs text-muted-foreground">
            Empresa contratada e ente público neste mesmo ambiente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <PartyColumn
          side="empresa"
          orgNames={empresaNames}
          members={empresaMembers}
        />

        <div className="hidden items-center justify-center md:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-muted-foreground">
            ×
          </div>
        </div>

        <PartyColumn
          side="ente_publico"
          orgNames={enteNames}
          members={enteMembers}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {projectDueDate ? (
          <Badge variant="secondary" className="gap-1 font-normal">
            <Calendar className="h-3 w-3 text-orange-500" />
            Prazo do projeto: {formatDatePtBR(projectDueDate)}
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 font-normal">
            <Calendar className="h-3 w-3" />
            Sem prazo definido
          </Badge>
        )}

        {tasksInReview > 0 ? (
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/30 bg-amber-500/10 font-normal text-amber-800 dark:text-amber-300"
          >
            <Clock3 className="h-3 w-3" />
            {tasksInReview} aguardando validação do ente
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 font-normal">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            Nenhuma entrega pendente de validação
          </Badge>
        )}
      </div>
    </div>
  );
}
