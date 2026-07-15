import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListOrganizationsPublicQueryKey,
  useListOrganizationsPublic,
  useDeleteOrganization,
  type OrganizationPublic,
} from "@api/organizations";
import {
  getListOrganizationSectorsQueryKey,
  useListOrganizationSectors,
  useCreateOrganizationSector,
  useUpdateOrganizationSector,
  useDeleteOrganizationSector,
  type OrganizationSector,
} from "@api/sectors";
import {
  getListOrganizationPositionsQueryKey,
  useListOrganizationPositions,
  useCreateOrganizationPosition,
  useUpdateOrganizationPosition,
  useDeleteOrganizationPosition,
  type OrganizationPosition,
} from "@api/positions";
import {
  useCreateOrganization,
  useGetMe,
  useListUsers,
  useUpdateOrganization,
  useUpdateUserRole,
  useUpdateMemberSector,
  useUpdateMemberPosition,
  getListUsersQueryKey,
  type UserRole,
  type UserProfileEnriched,
} from "@api/client";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { AddMemberDialog } from "@/components/members/AddMemberDialog";
import { MemberSectorSelect } from "@/components/members/MemberSectorSelect";
import { MemberPositionSelect } from "@/components/members/MemberPositionSelect";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Plus, Users, Pencil, Trash2, Layers, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const organizationTypeLabels = {
  empresa: "Empresa",
  ente_publico: "Ente Público",
} as const;

const gridContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const gridItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

function getOrgAccent(type: OrganizationPublic["type"]) {
  return type === "ente_publico"
    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
    : "bg-primary/10 text-primary";
}

function canManageOrganizationMembers(
  role: UserRole | undefined,
  userOrganizationId: number | null | undefined,
  organizationId: number,
) {
  if (role === "admin") return true;
  if (role === "gestor") return userOrganizationId === organizationId;
  return false;
}

function canManageOrganizationSectors(
  role: UserRole | undefined,
  userOrganizationId: number | null | undefined,
  organizationId: number,
) {
  return canManageOrganizationMembers(role, userOrganizationId, organizationId);
}

function canManageOrganizationPositions(
  role: UserRole | undefined,
  userOrganizationId: number | null | undefined,
  organizationId: number,
) {
  return canManageOrganizationMembers(role, userOrganizationId, organizationId);
}

function getSectorLabel(type: OrganizationPublic["type"]) {
  return type === "ente_publico" ? "Secretaria" : "Setor";
}

function getSectorLabelPlural(type: OrganizationPublic["type"]) {
  return type === "ente_publico" ? "Secretarias" : "Setores";
}

export default function OrganizationsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: orgs, isLoading } = useListOrganizationsPublic();
  const { data: users } = useListUsers();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const updateUserRole = useUpdateUserRole();
  const updateMemberSector = useUpdateMemberSector();
  const updateMemberPosition = useUpdateMemberPosition();
  const createSector = useCreateOrganizationSector();
  const updateSector = useUpdateOrganizationSector();
  const deleteSector = useDeleteOrganizationSector();
  const createPosition = useCreateOrganizationPosition();
  const updatePosition = useUpdateOrganizationPosition();
  const deletePosition = useDeleteOrganizationPosition();

  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationPublic | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"empresa" | "ente_publico">("empresa");
  const [error, setError] = useState<string | null>(null);

  const [membersOrg, setMembersOrg] = useState<OrganizationPublic | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [sectorsOrg, setSectorsOrg] = useState<OrganizationPublic | null>(null);
  const [sectorName, setSectorName] = useState("");
  const [editingSector, setEditingSector] = useState<OrganizationSector | null>(null);
  const [sectorError, setSectorError] = useState<string | null>(null);
  const [deleteSectorTarget, setDeleteSectorTarget] =
    useState<OrganizationSector | null>(null);
  const [positionsOrg, setPositionsOrg] = useState<OrganizationPublic | null>(null);
  const [positionName, setPositionName] = useState("");
  const [editingPosition, setEditingPosition] = useState<OrganizationPosition | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [deletePositionTarget, setDeletePositionTarget] =
    useState<OrganizationPosition | null>(null);

  const { data: sectors } = useListOrganizationSectors(sectorsOrg?.id ?? 0, {
    query: { enabled: Boolean(sectorsOrg?.id) },
  });

  const { data: memberOrgSectors } = useListOrganizationSectors(membersOrg?.id ?? 0, {
    query: { enabled: Boolean(membersOrg?.id) },
  });

  const { data: positions } = useListOrganizationPositions(positionsOrg?.id ?? 0, {
    query: { enabled: Boolean(positionsOrg?.id) },
  });

  const { data: memberOrgPositions } = useListOrganizationPositions(membersOrg?.id ?? 0, {
    query: { enabled: Boolean(membersOrg?.id) },
  });

  const enrichedUsers = users as UserProfileEnriched[] | undefined;

  const filteredOrgs = orgs?.filter((org) =>
    org.name.toLowerCase().includes(filter.toLowerCase()),
  );

  function getOrgMembers(orgId: number) {
    return enrichedUsers?.filter((user) => user.organizationId === orgId) ?? [];
  }

  function resetForm() {
    setName("");
    setType("empresa");
    setError(null);
    setEditingOrg(null);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(org: OrganizationPublic) {
    setEditingOrg(org);
    setName(org.name);
    setType(org.type);
    setError(null);
    setDialogOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) resetForm();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe o nome da organização.");
      return;
    }

    if (editingOrg) {
      updateOrg.mutate(
        { id: editingOrg.id, data: { name: trimmedName, type } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListOrganizationsPublicQueryKey(),
            });
            toast({
              title: "Organização atualizada",
              description: `${trimmedName} foi salva com sucesso.`,
            });
            setDialogOpen(false);
            resetForm();
          },
          onError: (err) => {
            setError(err instanceof Error ? err.message : "Não foi possível atualizar a organização.");
          },
        },
      );
      return;
    }

    createOrg.mutate(
      { data: { name: trimmedName, type } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListOrganizationsPublicQueryKey(),
          });
          toast({
            title: "Organização criada",
            description: `${trimmedName} foi cadastrada com sucesso.`,
          });
          setDialogOpen(false);
          resetForm();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Não foi possível criar a organização.");
        },
      },
    );
  }

  function handleDeleteOrganization() {
    if (!deleteTarget) return;

    deleteOrg.mutate(deleteTarget.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListOrganizationsPublicQueryKey(),
        });
        toast({
          title: "Organização excluída",
          description: `${deleteTarget.name} foi removida.`,
        });
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: err instanceof Error ? err.message : "Não foi possível excluir a organização.",
        });
      },
    });
  }

  function handleRoleChange(userId: number, newRole: UserRole) {
    updateUserRole.mutate(
      { id: userId, data: { role: newRole } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({
            title: "Papel atualizado",
            description: "A função do membro foi alterada.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erro ao atualizar papel",
            description: "Não foi possível alterar a função do membro.",
          });
        },
      },
    );
  }

  function handleSectorChange(userId: number, sectorId: number | null) {
    updateMemberSector.mutate(
      { id: userId, sectorId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({
            title: "Setor atualizado",
            description: "O membro foi vinculado ao setor selecionado.",
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Erro ao atualizar setor",
            description:
              err instanceof Error
                ? err.message
                : "Não foi possível vincular o membro ao setor.",
          });
        },
      },
    );
  }

  function handlePositionChange(userId: number, positionId: number | null) {
    updateMemberPosition.mutate(
      { id: userId, positionId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({
            title: "Cargo atualizado",
            description: "O membro foi vinculado ao cargo selecionado.",
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Erro ao atualizar cargo",
            description:
              err instanceof Error
                ? err.message
                : "Não foi possível vincular o membro ao cargo.",
          });
        },
      },
    );
  }

  function invalidateSectorQueries(organizationId: number) {
    queryClient.invalidateQueries({
      queryKey: getListOrganizationSectorsQueryKey(organizationId),
    });
    queryClient.invalidateQueries({
      queryKey: getListOrganizationsPublicQueryKey(),
    });
  }

  function resetSectorForm() {
    setSectorName("");
    setEditingSector(null);
    setSectorError(null);
  }

  function openSectorsDialog(org: OrganizationPublic) {
    resetSectorForm();
    setSectorsOrg(org);
  }

  function handleSectorSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!sectorsOrg) return;
    setSectorError(null);

    const trimmedName = sectorName.trim();
    if (!trimmedName) {
      setSectorError(`Informe o nome do ${getSectorLabel(sectorsOrg.type).toLowerCase()}.`);
      return;
    }

    if (editingSector) {
      updateSector.mutate(
        { id: editingSector.id, name: trimmedName },
        {
          onSuccess: () => {
            invalidateSectorQueries(sectorsOrg.id);
            toast({
              title: `${getSectorLabel(sectorsOrg.type)} atualizado`,
              description: `${trimmedName} foi salvo.`,
            });
            resetSectorForm();
          },
          onError: (err) => {
            setSectorError(
              err instanceof Error ? err.message : "Não foi possível atualizar.",
            );
          },
        },
      );
      return;
    }

    createSector.mutate(
      { organizationId: sectorsOrg.id, name: trimmedName },
      {
        onSuccess: () => {
          invalidateSectorQueries(sectorsOrg.id);
          toast({
            title: `${getSectorLabel(sectorsOrg.type)} criado`,
            description: `${trimmedName} foi adicionado.`,
          });
          resetSectorForm();
        },
        onError: (err) => {
          setSectorError(
            err instanceof Error ? err.message : "Não foi possível criar.",
          );
        },
      },
    );
  }

  function handleDeleteSector() {
    if (!deleteSectorTarget || !sectorsOrg) return;

    deleteSector.mutate(deleteSectorTarget.id, {
      onSuccess: () => {
        invalidateSectorQueries(sectorsOrg.id);
        toast({
          title: `${getSectorLabel(sectorsOrg.type)} excluído`,
          description: `${deleteSectorTarget.name} foi removido.`,
        });
        setDeleteSectorTarget(null);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: err instanceof Error ? err.message : "Não foi possível excluir.",
        });
      },
    });
  }

  function invalidatePositionQueries(organizationId: number) {
    queryClient.invalidateQueries({
      queryKey: getListOrganizationPositionsQueryKey(organizationId),
    });
    queryClient.invalidateQueries({
      queryKey: getListOrganizationsPublicQueryKey(),
    });
  }

  function resetPositionForm() {
    setPositionName("");
    setEditingPosition(null);
    setPositionError(null);
  }

  function openPositionsDialog(org: OrganizationPublic) {
    resetPositionForm();
    setPositionsOrg(org);
  }

  function handlePositionSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!positionsOrg) return;
    setPositionError(null);

    const trimmedName = positionName.trim();
    if (!trimmedName) {
      setPositionError("Informe o nome do cargo.");
      return;
    }

    if (editingPosition) {
      updatePosition.mutate(
        { id: editingPosition.id, name: trimmedName },
        {
          onSuccess: () => {
            invalidatePositionQueries(positionsOrg.id);
            toast({
              title: "Cargo atualizado",
              description: `${trimmedName} foi salvo.`,
            });
            resetPositionForm();
          },
          onError: (err) => {
            setPositionError(
              err instanceof Error ? err.message : "Não foi possível atualizar.",
            );
          },
        },
      );
      return;
    }

    createPosition.mutate(
      { organizationId: positionsOrg.id, name: trimmedName },
      {
        onSuccess: () => {
          invalidatePositionQueries(positionsOrg.id);
          toast({
            title: "Cargo criado",
            description: `${trimmedName} foi adicionado.`,
          });
          resetPositionForm();
        },
        onError: (err) => {
          setPositionError(
            err instanceof Error ? err.message : "Não foi possível criar.",
          );
        },
      },
    );
  }

  function handleDeletePosition() {
    if (!deletePositionTarget || !positionsOrg) return;

    deletePosition.mutate(deletePositionTarget.id, {
      onSuccess: () => {
        invalidatePositionQueries(positionsOrg.id);
        toast({
          title: "Cargo excluído",
          description: `${deletePositionTarget.name} foi removido.`,
        });
        setDeletePositionTarget(null);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: err instanceof Error ? err.message : "Não foi possível excluir.",
        });
      },
    });
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizações</h1>
          <p className="text-muted-foreground mt-1">
            Diretório público de empresas e entes públicos parceiros. Todos os
            usuários podem ver as organizações e o número de membros.
          </p>
        </div>
        {me?.role === "admin" && (
          <Button onClick={openCreateDialog} className="transition-transform hover:scale-[1.03] active:scale-95">
            <Plus className="mr-2 h-4 w-4" />
            Nova Organização
          </Button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        className="flex items-center gap-2 max-w-sm"
      >
        <Search className="h-4 w-4 text-muted-foreground absolute ml-3" />
        <Input
          placeholder="Buscar organizações..."
          className="pl-9"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
      ) : filteredOrgs?.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-lg bg-card/50">
          <p className="text-muted-foreground">Nenhuma organização encontrada.</p>
          {me?.role === "admin" && (
            <Button variant="link" className="mt-2" onClick={openCreateDialog}>
              Cadastrar a primeira organização
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={gridContainerVariants}
          initial="hidden"
          animate="show"
        >
          {filteredOrgs?.map((org) => {
            const memberCount = org.memberCount;
            const sectorCount = org.sectorCount;
            const positionCount = org.positionCount;
            const canManageMembers = canManageOrganizationMembers(
              me?.role,
              me?.organizationId,
              org.id,
            );
            const canManageSectors = canManageOrganizationSectors(
              me?.role,
              me?.organizationId,
              org.id,
            );
            const canManagePositions = canManageOrganizationPositions(
              me?.role,
              me?.organizationId,
              org.id,
            );
            const sectorLabelPlural = getSectorLabelPlural(org.type);

            return (
              <motion.div
                key={org.id}
                variants={gridItemVariants}
                whileHover={{ y: -5 }}
                className="h-full"
              >
              <Card
                className={`h-full transition-all duration-200 hover:shadow-lg ${
                  me?.organizationId === org.id
                    ? "border-primary/50 shadow-sm ring-1 ring-primary/20"
                    : "hover:border-primary/40"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getOrgAccent(org.type)}`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{org.name}</CardTitle>
                        <CardDescription className="capitalize">
                          {organizationTypeLabels[org.type]}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Cadastrada em</span>
                    <span>{format(new Date(org.createdAt), "dd MMM yyyy", { locale: ptBR })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{memberCount} membro{memberCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers className="h-4 w-4" />
                    <span>
                      {sectorCount} {sectorLabelPlural.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>
                      {positionCount} cargo{positionCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  {me?.organizationId === org.id && (
                    <Badge className="w-full justify-center bg-primary/10 text-primary hover:bg-primary/20" variant="secondary">
                      Sua Organização
                    </Badge>
                  )}
                  {canManageMembers && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setMembersOrg(org)}
                    >
                      Gerenciar membros
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openSectorsDialog(org)}
                  >
                    {canManageSectors
                      ? `Gerenciar ${sectorLabelPlural.toLowerCase()}`
                      : `Ver ${sectorLabelPlural.toLowerCase()}`}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openPositionsDialog(org)}
                  >
                    {canManagePositions ? "Gerenciar cargos" : "Ver cargos"}
                  </Button>
                  {me?.role === "admin" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openEditDialog(org)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(org)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <Dialog open={Boolean(membersOrg)} onOpenChange={(open) => !open && setMembersOrg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Membros — {membersOrg?.name}</DialogTitle>
            <DialogDescription>
              Usuários vinculados a esta organização, com setores e cargos para identificação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {membersOrg && getOrgMembers(membersOrg.id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                Nenhum membro nesta organização ainda.
              </p>
            ) : (
              membersOrg?.id &&
              getOrgMembers(membersOrg.id).map((user) => (
                <div
                  key={user.id}
                  className="space-y-3 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {user.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    {canManageOrganizationMembers(me?.role, me?.organizationId, membersOrg.id) &&
                    user.id !== me?.id &&
                    user.role !== "admin" ? (
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                        disabled={updateUserRole.isPending}
                      >
                        <SelectTrigger className="w-[120px] h-8 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          <SelectItem value="membro">Membro</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="capitalize shrink-0">
                        {user.role}
                      </Badge>
                    )}
                  </div>
                  {canManageOrganizationMembers(me?.role, me?.organizationId, membersOrg.id) &&
                  user.id !== me?.id &&
                  user.role !== "admin" &&
                  memberOrgSectors &&
                  memberOrgSectors.length > 0 ? (
                    <MemberSectorSelect
                      organizationId={membersOrg.id}
                      value={user.sectorId ?? null}
                      onValueChange={(sectorId) => handleSectorChange(user.id, sectorId)}
                      disabled={updateMemberSector.isPending}
                      label={getSectorLabel(membersOrg.type)}
                      sectorLabel={getSectorLabel(membersOrg.type).toLowerCase()}
                    />
                  ) : user.sector?.name ? (
                    <p className="text-xs text-muted-foreground">
                      {getSectorLabel(membersOrg.type)}: {user.sector.name}
                    </p>
                  ) : null}
                  {canManageOrganizationMembers(me?.role, me?.organizationId, membersOrg.id) &&
                  user.id !== me?.id &&
                  user.role !== "admin" &&
                  memberOrgPositions &&
                  memberOrgPositions.length > 0 ? (
                    <MemberPositionSelect
                      organizationId={membersOrg.id}
                      value={user.positionId ?? null}
                      onValueChange={(positionId) => handlePositionChange(user.id, positionId)}
                      disabled={updateMemberPosition.isPending}
                    />
                  ) : user.position?.name ? (
                    <p className="text-xs text-muted-foreground">
                      Cargo: {user.position.name}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersOrg(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setAddMemberOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar membro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        defaultOrganizationId={membersOrg?.id}
        lockOrganization
        organizationName={membersOrg?.name}
        organizationType={membersOrg?.type}
      />

      <Dialog
        open={Boolean(sectorsOrg)}
        onOpenChange={(open) => {
          if (!open) {
            setSectorsOrg(null);
            resetSectorForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {sectorsOrg
                ? `${getSectorLabelPlural(sectorsOrg.type)} — ${sectorsOrg.name}`
                : "Setores"}
            </DialogTitle>
            <DialogDescription>
              {sectorsOrg &&
                (sectorsOrg.type === "ente_publico"
                  ? "Secretarias são opcionais e ajudam a organizar a estrutura do ente público."
                  : "Setores são opcionais e ajudam a organizar a estrutura da empresa.")}
            </DialogDescription>
          </DialogHeader>

          {sectorsOrg && canManageOrganizationSectors(
            me?.role,
            me?.organizationId,
            sectorsOrg.id,
          ) && (
            <form onSubmit={handleSectorSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sector-name">
                  {editingSector
                    ? `Editar ${getSectorLabel(sectorsOrg.type).toLowerCase()}`
                    : `Novo ${getSectorLabel(sectorsOrg.type).toLowerCase()}`}
                </Label>
                <Input
                  id="sector-name"
                  value={sectorName}
                  onChange={(e) => setSectorName(e.target.value)}
                  placeholder={
                    sectorsOrg.type === "ente_publico"
                      ? "Ex.: Secretaria de Obras"
                      : "Ex.: Recursos Humanos"
                  }
                />
              </div>
              {sectorError ? (
                <p className="text-sm text-destructive">{sectorError}</p>
              ) : null}
              <div className="flex gap-2">
                {editingSector && (
                  <Button type="button" variant="outline" onClick={resetSectorForm}>
                    Cancelar edição
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={createSector.isPending || updateSector.isPending}
                >
                  {createSector.isPending || updateSector.isPending
                    ? "Salvando..."
                    : editingSector
                      ? "Salvar alterações"
                      : `Adicionar ${getSectorLabel(sectorsOrg.type).toLowerCase()}`}
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {sectors && sectors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                {sectorsOrg
                  ? `Nenhum ${getSectorLabel(sectorsOrg.type).toLowerCase()} cadastrado ainda.`
                  : "Nenhum setor cadastrado."}
              </p>
            ) : (
              sectors?.map((sector) => (
                <div
                  key={sector.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">{sector.name}</span>
                  {sectorsOrg &&
                    canManageOrganizationSectors(
                      me?.role,
                      me?.organizationId,
                      sectorsOrg.id,
                    ) && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingSector(sector);
                            setSectorName(sector.name);
                            setSectorError(null);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteSectorTarget(sector)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSectorsOrg(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteSectorTarget)}
        onOpenChange={(open) => !open && setDeleteSectorTarget(null)}
        title={
          sectorsOrg
            ? `Excluir ${getSectorLabel(sectorsOrg.type).toLowerCase()}`
            : "Excluir setor"
        }
        description={`Tem certeza que deseja excluir "${deleteSectorTarget?.name}"?`}
        onConfirm={handleDeleteSector}
        isPending={deleteSector.isPending}
      />

      <Dialog
        open={Boolean(positionsOrg)}
        onOpenChange={(open) => {
          if (!open) {
            setPositionsOrg(null);
            resetPositionForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {positionsOrg ? `Cargos — ${positionsOrg.name}` : "Cargos"}
            </DialogTitle>
            <DialogDescription>
              Cargos são opcionais e ajudam a identificar a função de cada membro na organização.
            </DialogDescription>
          </DialogHeader>

          {positionsOrg && canManageOrganizationPositions(
            me?.role,
            me?.organizationId,
            positionsOrg.id,
          ) && (
            <form onSubmit={handlePositionSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="position-name">
                  {editingPosition ? "Editar cargo" : "Novo cargo"}
                </Label>
                <Input
                  id="position-name"
                  value={positionName}
                  onChange={(e) => setPositionName(e.target.value)}
                  placeholder="Ex.: Analista de Projetos"
                />
              </div>
              {positionError ? (
                <p className="text-sm text-destructive">{positionError}</p>
              ) : null}
              <div className="flex gap-2">
                {editingPosition && (
                  <Button type="button" variant="outline" onClick={resetPositionForm}>
                    Cancelar edição
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={createPosition.isPending || updatePosition.isPending}
                >
                  {createPosition.isPending || updatePosition.isPending
                    ? "Salvando..."
                    : editingPosition
                      ? "Salvar alterações"
                      : "Adicionar cargo"}
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {positions && positions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                Nenhum cargo cadastrado ainda.
              </p>
            ) : (
              positions?.map((position) => (
                <div
                  key={position.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">{position.name}</span>
                  {positionsOrg &&
                    canManageOrganizationPositions(
                      me?.role,
                      me?.organizationId,
                      positionsOrg.id,
                    ) && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingPosition(position);
                            setPositionName(position.name);
                            setPositionError(null);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletePositionTarget(position)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPositionsOrg(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deletePositionTarget)}
        onOpenChange={(open) => !open && setDeletePositionTarget(null)}
        title="Excluir cargo"
        description={`Tem certeza que deseja excluir "${deletePositionTarget?.name}"?`}
        onConfirm={handleDeletePosition}
        isPending={deletePosition.isPending}
      />

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrg ? "Editar Organização" : "Nova Organização"}</DialogTitle>
            <DialogDescription>
              {editingOrg
                ? "Atualize os dados da organização."
                : "Cadastre uma empresa contratada ou um ente público parceiro."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nome</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Prefeitura de Exemplo"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-type">Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger id="org-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="ente_publico">Ente Público</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createOrg.isPending || updateOrg.isPending}>
                {createOrg.isPending || updateOrg.isPending
                  ? "Salvando..."
                  : editingOrg
                    ? "Salvar alterações"
                    : "Criar organização"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir organização"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Só é possível excluir organizações sem membros ou projetos vinculados.`}
        onConfirm={handleDeleteOrganization}
        isPending={deleteOrg.isPending}
      />
    </div>
  );
}
