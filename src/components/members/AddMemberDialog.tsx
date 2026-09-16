import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListUsersQueryKey,
  useCreateMember,
  useGetMe,
  type UserRole,
} from "@api/client";
import { getListOrganizationsPublicQueryKey, useListOrganizationsPublic } from "@api/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MemberSectorSelect } from "@/components/members/MemberSectorSelect";
import { MemberPositionSelect } from "@/components/members/MemberPositionSelect";

const roleLabels: Record<"gestor" | "membro", string> = {
  gestor: "Gestor",
  membro: "Membro",
};

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultOrganizationId?: number;
  lockOrganization?: boolean;
  organizationName?: string;
  organizationType?: "empresa" | "ente_publico";
}

export function AddMemberDialog({
  open,
  onOpenChange,
  defaultOrganizationId,
  lockOrganization = false,
  organizationName,
  organizationType = "empresa",
}: AddMemberDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: organizations } = useListOrganizationsPublic({
    query: { enabled: me?.role === "admin" },
  });
  const createMember = useCreateMember();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"gestor" | "membro">("membro");
  const [organizationId, setOrganizationId] = useState("");
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sectorLabel = organizationType === "ente_publico" ? "secretaria" : "setor";
  const sectorLabelTitle =
    organizationType === "ente_publico" ? "Secretaria" : "Setor";

  useEffect(() => {
    if (!open) return;
    const orgId =
      defaultOrganizationId ??
      me?.organizationId ??
      undefined;
    if (orgId) {
      setOrganizationId(String(orgId));
    }
    setSectorId(null);
    setPositionId(null);
  }, [open, defaultOrganizationId, me?.organizationId]);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("membro");
    setOrganizationId(
      defaultOrganizationId
        ? String(defaultOrganizationId)
        : me?.organizationId
          ? String(me.organizationId)
          : "",
    );
    setSectorId(null);
    setPositionId(null);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password) {
      setError("Preencha nome, e-mail e senha.");
      return;
    }

    const resolvedOrgId = lockOrganization
      ? defaultOrganizationId
      : me?.role === "admin"
        ? Number(organizationId)
        : me?.organizationId ?? undefined;

    if (!resolvedOrgId) {
      setError("Selecione a organização do membro.");
      return;
    }

    createMember.mutate(
      {
        name: trimmedName,
        email: trimmedEmail,
        password,
        role,
        organizationId: resolvedOrgId,
        sectorId,
        positionId,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getListOrganizationsPublicQueryKey(),
          });
          toast({
            title: "Membro adicionado",
            description: `${trimmedName} foi cadastrado na organização.`,
          });
          handleOpenChange(false);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Não foi possível adicionar o membro.");
        },
      },
    );
  }

  const showOrgSelect = me?.role === "admin" && !lockOrganization;
  const resolvedOrgIdForSectors = lockOrganization
    ? defaultOrganizationId
    : organizationId
      ? Number(organizationId)
      : me?.organizationId ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Membro</DialogTitle>
          <DialogDescription>
            {lockOrganization && organizationName
              ? `Cadastre um novo usuário em ${organizationName}.`
              : "Cadastre um novo usuário na organização com acesso ao sistema."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {showOrgSelect && (
            <div className="space-y-2">
              <Label htmlFor="member-org">Organização</Label>
              <Select
                value={organizationId}
                onValueChange={(value) => {
                  setOrganizationId(value);
                  setSectorId(null);
                  setPositionId(null);
                }}
              >
                <SelectTrigger id="member-org">
                  <SelectValue placeholder="Selecione a organização" />
                </SelectTrigger>
                <SelectContent>
                  {organizations?.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {lockOrganization && organizationName && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Organização: </span>
              <span className="font-medium">{organizationName}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="member-name">Nome</Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-email">E-mail</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@organizacao.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-password">Senha inicial</Label>
            <Input
              id="member-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-role">Função</Label>
            <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gestor">{roleLabels.gestor}</SelectItem>
                <SelectItem value="membro">{roleLabels.membro}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MemberSectorSelect
            organizationId={resolvedOrgIdForSectors}
            value={sectorId}
            onValueChange={setSectorId}
            label={sectorLabelTitle}
            sectorLabel={sectorLabel}
          />
          <MemberPositionSelect
            organizationId={resolvedOrgIdForSectors}
            value={positionId}
            onValueChange={setPositionId}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMember.isPending}>
              {createMember.isPending ? "Salvando..." : "Adicionar membro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
