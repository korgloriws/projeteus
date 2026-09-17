import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useAcceptProjectInvite,
  useDeclineProjectInvite,
  usePublicInvite,
} from "@api/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjeTeusLogo } from "@/components/brand/ProjeTeusLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDatePtBR } from "@/lib/dates";
import { taskStatusLabel } from "@/lib/task-status";
import { useToast } from "@/components/ui/use-toast";

export default function InvitePage() {
  const params = useParams<{ token?: string }>();
  const token = params.token ?? "";
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const { data, isLoading, error, refetch } = usePublicInvite(token);
  const acceptInvite = useAcceptProjectInvite();
  const declineInvite = useDeclineProjectInvite();

  const invite = data?.invite;
  const project = data?.project;
  const viewerIsMember = Boolean(data?.viewerIsMember);
  const isOpenShare = Boolean(
    invite &&
      invite.channel === "external" &&
      invite.inviteeUserId == null &&
      !(invite.inviteeEmail && invite.inviteeEmail.trim()),
  );

  const nextPath = `/invite/${token}`;
  const signInHref = `/sign-in?next=${encodeURIComponent(nextPath)}`;
  const signUpHref = `/sign-up?next=${encodeURIComponent(nextPath)}${
    invite?.inviteeEmail
      ? `&email=${encodeURIComponent(invite.inviteeEmail)}`
      : ""
  }${
    invite?.inviteeName
      ? `&name=${encodeURIComponent(invite.inviteeName)}`
      : ""
  }`;

  const canAcceptNow = Boolean(user) && invite?.status === "pending";

  const statusLabel = useMemo(() => {
    if (!invite) return "";
    switch (invite.status) {
      case "pending":
        return "Pendente";
      case "accepted":
        return "Aceito";
      case "declined":
        return "Recusado";
      case "revoked":
        return "Revogado";
      case "expired":
        return "Expirado";
      default:
        return invite.status;
    }
  }, [invite]);

  useEffect(() => {
    if (!user || !invite || invite.status !== "pending") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoAccept") !== "1") return;

    void (async () => {
      try {
        const result = await acceptInvite.mutateAsync(token);
        toast({
          title: "Convite aceito",
          description: "Você agora participa deste projeto.",
        });
        setLocation(`/projects/${result.projectId}`);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Não foi possível aceitar o convite.",
        );
      }
    })();
  }, [user, invite, token, acceptInvite, setLocation, toast]);

  async function handleAccept() {
    setActionError(null);
    if (!user) {
      setLocation(signInHref);
      return;
    }
    try {
      const result = await acceptInvite.mutateAsync(token);
      toast({
        title: "Convite aceito",
        description: "Você agora participa deste projeto.",
      });
      setLocation(`/projects/${result.projectId}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Não foi possível aceitar o convite.",
      );
    }
  }

  async function handleDecline() {
    setActionError(null);
    try {
      await declineInvite.mutateAsync(token);
      setDeclined(true);
      void refetch();
      toast({ title: "Convite recusado" });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Não foi possível recusar o convite.",
      );
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <p className="text-muted-foreground">Convite inválido.</p>
      </div>
    );
  }

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-muted-foreground">
        Carregando convite...
      </div>
    );
  }

  if (error || !invite || !project) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive">
          {error instanceof Error
            ? error.message
            : "Convite não encontrado ou indisponível."}
        </p>
        <Button asChild variant="outline">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <ProjeTeusLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2 text-sm">
            {user ? (
              <span className="text-muted-foreground">Olá, {user.name}</span>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link href={signInHref}>Entrar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={signUpHref}>Criar conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Convite para participar</CardTitle>
              <Badge variant="outline">{statusLabel}</Badge>
              <Badge variant="secondary" className="capitalize">
                {invite.role}
              </Badge>
            </div>
            <CardDescription>
              {isOpenShare
                ? invite.invitedByName
                  ? `${invite.invitedByName} compartilhou este projeto`
                  : "Projeto compartilhado por link"
                : invite.invitedByName
                  ? `${invite.invitedByName} convidou ${invite.inviteeEmail}`
                  : `Convite para ${invite.inviteeEmail}`}
              {" · "}
              válido até {formatDatePtBR(invite.expiresAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {viewerIsMember ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Você já participa deste projeto.
                </p>
                <Button asChild>
                  <Link href={`/projects/${project.id}`}>Abrir projeto</Link>
                </Button>
              </div>
            ) : invite.status === "pending" && !declined ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Você pode ver o projeto abaixo em modo somente leitura. Para criar
                  etapas, editar ou comentar, aceite o convite
                  {user ? "." : " (será necessário entrar ou criar conta)."}
                </p>
                <p className="text-base font-medium">
                  Aceita participar do projeto?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleAccept()}
                    disabled={acceptInvite.isPending}
                  >
                    {user
                      ? acceptInvite.isPending
                        ? "Aceitando..."
                        : "Sim, participar"
                      : "Sim — entrar / criar conta"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleDecline()}
                    disabled={declineInvite.isPending}
                  >
                    {declineInvite.isPending ? "Recusando..." : "Não, recusar"}
                  </Button>
                  {!user && !isOpenShare && invite.inviteeEmail ? (
                    <Button asChild variant="ghost">
                      <Link href={signUpHref}>Criar conta com este e-mail</Link>
                    </Button>
                  ) : null}
                </div>
                {!canAcceptNow && user ? null : null}
              </>
            ) : invite.status === "accepted" ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href={`/projects/${project.id}`}>Abrir projeto</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Este convite não está mais disponível para aceite.
              </p>
            )}
            {actionError ? (
              <p className="text-sm text-destructive">{actionError}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{project.title}</CardTitle>
              <Badge variant="outline" className="capitalize">
                {project.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {project.priority} #{project.priorityRank}
              </Badge>
            </div>
            <CardDescription>
              {project.description || "Sem descrição."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Empresas</p>
                <p className="font-medium">
                  {project.empresaOrgs.map((org) => org.name).join(", ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Entes públicos</p>
                <p className="font-medium">
                  {project.entePublicoOrgs.map((org) => org.name).join(", ") ||
                    "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Prazo</p>
                <p className="font-medium">
                  {project.dueDate ? formatDatePtBR(project.dueDate) : "Não definido"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Progresso</p>
                <p className="font-medium">
                  {project.progressPercent}% ({project.completedTasks}/
                  {project.totalTasks} tarefas)
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <p className="font-medium">
                Etapas e tarefas ({project.totalStages} etapas)
              </p>
              {project.stages.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma etapa cadastrada ainda.</p>
              ) : (
                project.stages.map((stage) => (
                  <div key={stage.id} className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="font-medium">{stage.name}</p>
                      <Badge variant="outline" className="capitalize">
                        {stage.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {stage.tasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem tarefas.</p>
                    ) : (
                      <ul className="space-y-1">
                        {stage.tasks.map((task) => (
                          <li
                            key={task.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span>{task.title}</span>
                            <Badge variant="secondary">
                              {taskStatusLabel(task.status)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>

            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Modo somente leitura. Comentários, anexos e alterações ficam
              disponíveis após aceitar o convite e entrar no sistema.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
