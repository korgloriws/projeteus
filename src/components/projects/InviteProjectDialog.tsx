import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getInviteCandidatesQueryKey,
  getListProjectInvitesQueryKey,
  useCreateProjectInvites,
  useListInviteCandidates,
  useListProjectInvites,
  useRevokeProjectInvite,
  type ProjectInviteChannel,
  type ProjectInviteItem,
  type ProjectInviteRole,
} from "@api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Link2, Mail, MessageCircle, Share2, UserPlus } from "lucide-react";

type InviteProjectDialogProps = {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function absoluteInviteUrl(invite: { link: string; url?: string }): string {
  // Preferir a origem atual do navegador (ex.: http://srv….hstgr.cloud:3020).
  // Se usarmos WEB_ORIGIN sem a porta :3020, o link cai na porta 80 — onde a
  // Hostinger costuma ter outro processo Vite e aparece o erro allowedHosts.
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${invite.link}`;
  }
  if (invite.url && /^https?:\/\//i.test(invite.url)) {
    return invite.url;
  }
  return invite.link;
}

function shareMessage(invite: ProjectInviteItem, projectTitle?: string): string {
  const url = absoluteInviteUrl(invite);
  const title = projectTitle || invite.projectTitle || "um projeto no ProjeTeus";
  return [
    `Olá! Compartilho o projeto "${title}" no ProjeTeus.`,
    "Abra o link para ver (somente leitura) e, se quiser, participar:",
    url,
  ].join("\n\n");
}

function mailtoShareHref(invite: ProjectInviteItem, projectTitle?: string): string {
  const subject = encodeURIComponent(
    projectTitle || invite.projectTitle
      ? `Projeto: ${projectTitle || invite.projectTitle}`
      : "Projeto no ProjeTeus",
  );
  const body = encodeURIComponent(shareMessage(invite, projectTitle));
  return `mailto:?subject=${subject}&body=${body}`;
}

function whatsappShareHref(invite: ProjectInviteItem, projectTitle?: string): string {
  return `https://wa.me/?text=${encodeURIComponent(
    shareMessage(invite, projectTitle),
  )}`;
}

function inviteDisplayName(invite: ProjectInviteItem): string {
  if (!invite.inviteeEmail?.trim()) {
    return invite.inviteeNameResolved || "Link compartilhável";
  }
  return invite.inviteeNameResolved || invite.inviteeEmail;
}

function ShareActions({
  invite,
  projectTitle,
  onCopy,
}: {
  invite: ProjectInviteItem;
  projectTitle?: string;
  onCopy: (invite: ProjectInviteItem) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onCopy(invite)}
      >
        <Copy className="mr-1 h-3 w-3" />
        Copiar link
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <a
          href={whatsappShareHref(invite, projectTitle)}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="mr-1 h-3 w-3" />
          WhatsApp
        </a>
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <a href={mailtoShareHref(invite, projectTitle)}>
          <Mail className="mr-1 h-3 w-3" />
          E-mail
        </a>
      </Button>
      <Button type="button" size="sm" variant="secondary" asChild>
        <a href={absoluteInviteUrl(invite)} target="_blank" rel="noreferrer">
          <Link2 className="mr-1 h-3 w-3" />
          Abrir
        </a>
      </Button>
    </div>
  );
}

export function InviteProjectDialog({
  projectId,
  open,
  onOpenChange,
}: InviteProjectDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<ProjectInviteChannel>("internal");
  const [role, setRole] = useState<ProjectInviteRole>("membro");
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [lastShareInvite, setLastShareInvite] = useState<ProjectInviteItem | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const { data: candidates, isLoading: loadingCandidates } =
    useListInviteCandidates(projectId, {
      query: { enabled: open && channel === "internal" },
    });
  const { data: invites = [], refetch: refetchInvites } = useListProjectInvites(
    projectId,
    { query: { enabled: open } },
  );
  const createInvites = useCreateProjectInvites();
  const revokeInvite = useRevokeProjectInvite();

  const filteredOrgs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const orgs = candidates?.organizations ?? [];
    if (!q) return orgs;
    return orgs
      .map((org) => ({
        ...org,
        sectors: org.sectors
          .map((sector) => ({
            ...sector,
            users: sector.users.filter(
              (user) =>
                user.name.toLowerCase().includes(q) ||
                user.email.toLowerCase().includes(q),
            ),
          }))
          .filter((sector) => sector.users.length > 0),
      }))
      .filter((org) => org.sectors.length > 0);
  }, [candidates, search]);

  function toggleUser(userId: number) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      if (channel === "internal") {
        if (selectedUserIds.length === 0) {
          setError("Selecione ao menos um usuário.");
          return;
        }
        const result = await createInvites.mutateAsync({
          projectId,
          channel: "internal",
          role,
          userIds: selectedUserIds,
        });
        queryClient.invalidateQueries({
          queryKey: getListProjectInvitesQueryKey(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: getInviteCandidatesQueryKey(projectId),
        });
        setSelectedUserIds([]);
        toast({
          title: "Convites enviados",
          description:
            result.errors.length > 0
              ? `${result.invites.length} enviado(s). Alguns falharam.`
              : `${result.invites.length} convite(s) interno(s) criado(s).`,
        });
        if (result.errors.length > 0) {
          setError(result.errors.join(" "));
        }
      } else {
        const result = await createInvites.mutateAsync({
          projectId,
          channel: "external",
          role,
        });
        const invite = result.invites[0] ?? null;
        setLastShareInvite(invite);
        void refetchInvites();
        toast({
          title: "Link gerado",
          description: "Compartilhe por WhatsApp, e-mail ou copiando o link.",
        });
        if (result.errors.length > 0) {
          setError(result.errors.join(" "));
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível criar o convite.",
      );
    }
  }

  async function handleCopy(invite: ProjectInviteItem) {
    try {
      await navigator.clipboard.writeText(absoluteInviteUrl(invite));
      toast({ title: "Link copiado" });
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível copiar",
        description: absoluteInviteUrl(invite),
      });
    }
  }

  async function handleRevoke(inviteId: number) {
    try {
      await revokeInvite.mutateAsync({ projectId, inviteId });
      if (lastShareInvite?.id === inviteId) {
        setLastShareInvite(null);
      }
      void refetchInvites();
      toast({ title: "Convite revogado" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao revogar",
        description:
          err instanceof Error ? err.message : "Não foi possível revogar.",
      });
    }
  }

  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const projectTitle = lastShareInvite?.projectTitle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convidar / compartilhar</DialogTitle>
          <DialogDescription>
            Interno: escolha pessoas da equipe. Externo: gere um link e compartilhe
            como um documento (WhatsApp, e-mail ou copiar).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select
                value={channel}
                onValueChange={(value) => {
                  setChannel(value as ProjectInviteChannel);
                  setError(null);
                  setLastShareInvite(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interno</SelectItem>
                  <SelectItem value="external">Externo (compartilhar link)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Privilégio no projeto</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as ProjectInviteRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membro">Membro</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {channel === "internal" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="invite-search">Buscar na equipe / organizações</Label>
                <Input
                  id="invite-search"
                  placeholder="Nome ou e-mail..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                {loadingCandidates ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : filteredOrgs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum usuário elegível encontrado.
                  </p>
                ) : (
                  filteredOrgs.map((org) => (
                    <div key={org.id} className="space-y-2">
                      <p className="text-sm font-medium">
                        {org.name}{" "}
                        <span className="text-muted-foreground capitalize">
                          ({org.type.replace(/_/g, " ")})
                        </span>
                      </p>
                      {org.sectors.map((sector) => (
                        <div key={`${org.id}-${sector.id ?? "none"}`} className="pl-2">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {sector.name}
                          </p>
                          <div className="space-y-1">
                            {sector.users.map((user) => {
                              const checked = selectedUserIds.includes(user.id);
                              return (
                                <label
                                  key={user.id}
                                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleUser(user.id)}
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {user.name}
                                    <span className="text-muted-foreground">
                                      {" "}
                                      — {user.email}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Não precisa informar e-mail. Gere o link e compartilhe com quem
                quiser — a pessoa abre, vê o projeto e pode participar depois.
              </p>
              {lastShareInvite && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-medium">Compartilhar</p>
                  <code className="block truncate rounded bg-background px-2 py-1.5 text-xs">
                    {absoluteInviteUrl(lastShareInvite)}
                  </code>
                  <ShareActions
                    invite={lastShareInvite}
                    projectTitle={projectTitle}
                    onCopy={(invite) => void handleCopy(invite)}
                  />
                </div>
              )}
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
            <Button type="submit" disabled={createInvites.isPending}>
              {createInvites.isPending ? (
                "Gerando..."
              ) : channel === "internal" ? (
                <>
                  <UserPlus className="mr-1 h-4 w-4" />
                  Enviar convites
                </>
              ) : (
                <>
                  <Share2 className="mr-1 h-4 w-4" />
                  Gerar link
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        {pendingInvites.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Convites / links pendentes</p>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 rounded-md border p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium">
                        {inviteDisplayName(invite)}
                      </p>
                      {invite.inviteeEmail?.trim() ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {invite.inviteeEmail}
                        </p>
                      ) : (
                        <p className="truncate text-xs text-muted-foreground">
                          {absoluteInviteUrl(invite)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="capitalize">
                          {invite.channel === "internal" ? "interno" : "externo"}
                        </Badge>
                        <Badge variant="secondary" className="capitalize">
                          {invite.role}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={revokeInvite.isPending}
                      onClick={() => void handleRevoke(invite.id)}
                    >
                      Revogar
                    </Button>
                  </div>
                  {invite.channel === "external" && (
                    <ShareActions
                      invite={invite}
                      projectTitle={invite.projectTitle}
                      onCopy={(item) => void handleCopy(item)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
