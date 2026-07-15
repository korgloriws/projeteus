import { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  useGetMe,
  useUpdateUserRole,
  useUpdateMemberOrganization,
  useUpdateMemberSector,
  useUpdateMemberPosition,
  useDeleteMember,
  getListUsersQueryKey,
  type UserRole,
  type UserProfileEnriched,
} from "@api/client";
import { useListOrganizationsPublic } from "@api/organizations";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { AddMemberDialog } from "@/components/members/AddMemberDialog";
import { EditUserDialog } from "@/components/members/EditUserDialog";
import { MemberSectorSelect } from "@/components/members/MemberSectorSelect";
import { MemberPositionSelect } from "@/components/members/MemberPositionSelect";
import { StatCard } from "@/components/dashboard/StatCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  Trash2,
  Pencil,
  Building2,
  Users,
  Briefcase,
  Layers,
  Calendar,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

const gridContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const gridItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

export default function TeamList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users, isLoading } = useListUsers();
  const { data: me } = useGetMe();
  const { data: organizations } = useListOrganizationsPublic();
  const updateUserRole = useUpdateUserRole();
  const updateMemberOrganization = useUpdateMemberOrganization();
  const updateMemberSector = useUpdateMemberSector();
  const updateMemberPosition = useUpdateMemberPosition();
  const deleteMember = useDeleteMember();

  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfileEnriched | null>(null);
  const [editTarget, setEditTarget] = useState<UserProfileEnriched | null>(null);
  const [manageId, setManageId] = useState<number | null>(null);

  const canManageTeam = me?.role === "admin" || me?.role === "gestor";
  const canAddMember =
    canManageTeam && (me?.role === "admin" || Boolean(me?.organizationId));
  const totalOrganizations = organizations?.length ?? 0;
  const totalMembers =
    organizations?.reduce((sum, org) => sum + org.memberCount, 0) ?? 0;

  const filteredUsers = users?.filter(
    (user) =>
      user.name.toLowerCase().includes(filter.toLowerCase()) ||
      user.email.toLowerCase().includes(filter.toLowerCase()),
  );

  function canEditUser(user: { id: number; role: UserRole }) {
    if (!canManageTeam || user.id === me?.id) return false;
    if (me?.role === "admin") return user.role !== "admin";
    return user.role !== "admin";
  }

  function canEditUserRole(user: {
    id: number;
    role: UserRole;
    organizationId: number | null;
  }) {
    if (!canEditUser(user)) return false;
    if (me?.role === "gestor") {
      return (
        user.organizationId !== null &&
        user.organizationId === me.organizationId
      );
    }
    return true;
  }

  function canEditUserOrganization(user: { id: number; role: UserRole }) {
    return me?.role === "admin" && canEditUser(user);
  }

  function handleRoleChange(userId: number, newRole: UserRole) {
    updateUserRole.mutate(
      { id: userId, data: { role: newRole } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({
            title: "Papel atualizado",
            description: "As permissões do membro foram alteradas.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Erro ao atualizar papel",
            description: "Não foi possível alterar a função deste membro.",
          });
        },
      },
    );
  }

  function canEditUserSector(user: {
    id: number;
    role: UserRole;
    organizationId: number | null;
  }) {
    if (!canEditUser(user)) return false;
    if (!user.organizationId) return false;
    if (me?.role === "gestor") {
      return user.organizationId === me.organizationId;
    }
    return me?.role === "admin";
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

  function canEditUserPosition(user: {
    id: number;
    role: UserRole;
    organizationId: number | null;
  }) {
    return canEditUserSector(user);
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

  function handleOrganizationChange(userId: number, organizationId: number) {
    updateMemberOrganization.mutate(
      { id: userId, organizationId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({
            title: "Organização atualizada",
            description: "O membro foi vinculado à organização.",
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Erro ao atualizar organização",
            description:
              err instanceof Error
                ? err.message
                : "Não foi possível vincular o membro à organização.",
          });
        },
      },
    );
  }

  function canDeleteUser(user: { id: number; role: UserRole }) {
    return me?.role === "admin" && canEditUser(user);
  }

  function canAdminEditUser(user: { id: number }) {
    return me?.role === "admin" && user.id !== me?.id;
  }

  function handleDeleteUser() {
    if (!deleteTarget) return;

    deleteMember.mutate(deleteTarget.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({
          title: "Membro excluído",
          description: `${deleteTarget.name} foi removido da equipe.`,
        });
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: err instanceof Error ? err.message : "Não foi possível excluir o membro.",
        });
      },
    });
  }

  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case "admin":
        return <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20">Admin</Badge>;
      case "gestor":
        return <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20">Gestor</Badge>;
      default:
        return <Badge variant="secondary">Membro</Badge>;
    }
  };

  const enrichedUsers = filteredUsers as UserProfileEnriched[] | undefined;
  const allEnrichedUsers = users as UserProfileEnriched[] | undefined;
  const manageUser =
    manageId !== null
      ? (allEnrichedUsers?.find((user) => user.id === manageId) ?? null)
      : null;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground mt-1">
            {canManageTeam
              ? "Gerencie os membros da sua organização. Clique em um membro para ver e editar os detalhes."
              : "Você pode ver os colegas da sua organização. Clique em um membro para ver os detalhes."}
          </p>
        </div>
        {canAddMember && (
          <Button
            onClick={() => setDialogOpen(true)}
            className="transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Membro
          </Button>
        )}
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <StatCard
          title="Organizações cadastradas"
          value={totalOrganizations}
          icon={Building2}
          accent="blue"
          index={0}
        />
        <StatCard
          title="Membros cadastrados"
          value={totalMembers}
          icon={Users}
          accent="primary"
          index={1}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        className="flex items-center gap-2 max-w-sm"
      >
        <Search className="h-4 w-4 text-muted-foreground absolute ml-3" />
        <Input
          placeholder="Buscar por nome ou email..."
          className="pl-9"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
      ) : enrichedUsers?.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-lg bg-card/50">
          <p className="text-muted-foreground">Nenhum membro encontrado.</p>
        </div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={gridContainerVariants}
          initial="hidden"
          animate="show"
        >
          {enrichedUsers?.map((user) => (
            <motion.div
              key={user.id}
              variants={gridItemVariants}
              whileHover={{ y: -4 }}
            >
              <button
                type="button"
                onClick={() => setManageId(user.id)}
                className="w-full text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card
                  className={`h-full p-5 transition-all duration-200 hover:shadow-lg hover:border-primary/40 ${
                    me?.id === user.id ? "border-primary/50 ring-1 ring-primary/20" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {user.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{user.name}</p>
                        {me?.id === user.id && (
                          <span className="shrink-0 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {getRoleBadge(user.role)}
                    {user.organization?.name ? (
                      <Badge variant="outline" className="gap-1 font-normal max-w-full">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{user.organization.name}</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        Sem organização
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    {user.sector?.name && (
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{user.sector.name}</span>
                      </div>
                    )}
                    {user.position?.name && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{user.position.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Desde{" "}
                        {format(new Date(user.createdAt), "dd MMM yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                  </div>
                </Card>
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog
        open={manageId !== null}
        onOpenChange={(open) => !open && setManageId(null)}
      >
        <DialogContent className="max-w-md">
          {manageUser ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {manageUser.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{manageUser.name}</DialogTitle>
                    <DialogDescription className="truncate flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      {manageUser.email}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Papel</Label>
                  {canEditUserRole(manageUser) ? (
                    <Select
                      value={manageUser.role}
                      onValueChange={(value) =>
                        handleRoleChange(manageUser.id, value as UserRole)
                      }
                      disabled={updateUserRole.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="membro">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div>{getRoleBadge(manageUser.role)}</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Organização</Label>
                  {canEditUserOrganization(manageUser) ? (
                    <Select
                      value={
                        manageUser.organizationId
                          ? String(manageUser.organizationId)
                          : undefined
                      }
                      onValueChange={(value) =>
                        handleOrganizationChange(manageUser.id, Number(value))
                      }
                      disabled={updateMemberOrganization.isPending}
                    >
                      <SelectTrigger>
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
                  ) : (
                    <p className="text-sm">
                      {manageUser.organization?.name || (
                        <span className="text-muted-foreground italic">
                          Não atribuída
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Setor / Secretaria</Label>
                  {canEditUserSector(manageUser) ? (
                    <MemberSectorSelect
                      organizationId={manageUser.organizationId}
                      value={manageUser.sectorId ?? null}
                      onValueChange={(sectorId) =>
                        handleSectorChange(manageUser.id, sectorId)
                      }
                      disabled={updateMemberSector.isPending}
                      hideLabel
                    />
                  ) : (
                    <p className="text-sm">
                      {manageUser.sector?.name || (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Cargo</Label>
                  {canEditUserPosition(manageUser) ? (
                    <MemberPositionSelect
                      organizationId={manageUser.organizationId}
                      value={manageUser.positionId ?? null}
                      onValueChange={(positionId) =>
                        handlePositionChange(manageUser.id, positionId)
                      }
                      disabled={updateMemberPosition.isPending}
                      hideLabel
                    />
                  ) : (
                    <p className="text-sm">
                      {manageUser.position?.name || (
                        <span className="text-muted-foreground italic">—</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-muted-foreground">Membro desde</span>
                  <span>
                    {format(new Date(manageUser.createdAt), "dd MMM yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex gap-2">
                  {canAdminEditUser(manageUser) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const target = manageUser;
                        setManageId(null);
                        setEditTarget(target);
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Editar dados
                    </Button>
                  )}
                  {canDeleteUser(manageUser) && (
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        const target = manageUser;
                        setManageId(null);
                        setDeleteTarget(target);
                      }}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  )}
                </div>
                <Button variant="ghost" onClick={() => setManageId(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AddMemberDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <EditUserDialog
        user={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir membro"
        description={`Tem certeza que deseja excluir ${deleteTarget?.name}? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteUser}
        isPending={deleteMember.isPending}
      />
    </div>
  );
}
