import { useEffect, useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListProjectsQueryKey,
  useCreateProjectWithGestor,
  useDeleteProject,
  useGetMe,
  useListOrganizations,
  useListProjects,
  useListUsers,
  useUpdateProject,
  useListAttachments,
  useDeleteAttachment,
  uploadPendingFiles,
  type Project,
} from "@api/client";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { AssignmentChecklist } from "@/components/AssignmentChecklist";
import {
  AttachmentsField,
  type PendingFile,
} from "@/components/attachments/AttachmentsField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

function pickDefaultGestorUserId(
  eligibleGestors: Array<{ id: number }>,
  currentUserId: number | undefined,
  currentSelection: string,
): string {
  if (
    currentSelection &&
    eligibleGestors.some((user) => String(user.id) === currentSelection)
  ) {
    return currentSelection;
  }
  if (
    currentUserId &&
    eligibleGestors.some((user) => user.id === currentUserId)
  ) {
    return String(currentUserId);
  }
  if (eligibleGestors.length === 1) {
    return String(eligibleGestors[0]!.id);
  }
  return "";
}

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

export default function ProjectsList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [empresaOrgIds, setEmpresaOrgIds] = useState<number[]>([]);
  const [entePublicoOrgIds, setEntePublicoOrgIds] = useState<number[]>([]);
  const [gestorUserId, setGestorUserId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<Project["status"]>("planejamento");
  const [priority, setPriority] = useState<Project["priority"]>("media");
  const [error, setError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<number | null>(null);

  const { data: projects, isLoading } = useListProjects();
  const { data: orgs } = useListOrganizations();
  const { data: users } = useListUsers();
  const { data: me } = useGetMe();
  const createProject = useCreateProjectWithGestor();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const deleteAttachment = useDeleteAttachment();

  const { data: editingAttachments = [], refetch: refetchEditingAttachments } =
    useListAttachments(
      {
        projectId: editingProject?.id ?? 0,
        scope: "project",
      },
      { query: { enabled: Boolean(editingProject?.id) } },
    );

  const canCreate = me?.role === "admin" || me?.role === "gestor";
  const canEdit = canCreate;
  const canDelete = me?.role === "admin";
  const empresaOrgs = orgs?.filter((org) => org.type === "empresa") ?? [];
  const entePublicoOrgs = orgs?.filter((org) => org.type === "ente_publico") ?? [];
  const canSubmitProject = empresaOrgs.length > 0 && entePublicoOrgs.length > 0;

  const eligibleGestors = useMemo(() => {
    const selectedOrgIds = new Set([...empresaOrgIds, ...entePublicoOrgIds]);
    const hasOrgSelection =
      empresaOrgIds.length > 0 && entePublicoOrgIds.length > 0;

    const fromUsers =
      users?.filter((user) => {
        if (user.role !== "gestor" && user.role !== "admin") return false;
        if (user.role === "admin") return true;
        if (!hasOrgSelection) return false;
        return (
          user.organizationId != null && selectedOrgIds.has(user.organizationId)
        );
      }) ?? [];

    const byId = new Map(fromUsers.map((user) => [user.id, user]));

    if (me && hasOrgSelection) {
      const meIsEligible =
        me.role === "admin" ||
        (me.role === "gestor" &&
          me.organizationId != null &&
          selectedOrgIds.has(me.organizationId));

      if (meIsEligible) {
        byId.set(me.id, me);
      }
    }

    return Array.from(byId.values());
  }, [users, me, empresaOrgIds, entePublicoOrgIds]);

  useEffect(() => {
    if (editingProject) return;
    if (empresaOrgIds.length === 0 || entePublicoOrgIds.length === 0) {
      setGestorUserId("");
      return;
    }
    setGestorUserId((current) =>
      pickDefaultGestorUserId(eligibleGestors, me?.id, current),
    );
  }, [editingProject, empresaOrgIds, entePublicoOrgIds, eligibleGestors, me?.id]);

  const filteredProjects = projects?.filter((p) =>
    p.title.toLowerCase().includes(filter.toLowerCase()),
  );

  function resetForm() {
    setTitle("");
    setDescription("");
    setEmpresaOrgIds([]);
    setEntePublicoOrgIds([]);
    setGestorUserId("");
    setDueDate("");
    setStatus("planejamento");
    setPriority("media");
    setError(null);
    setEditingProject(null);
    setPendingAttachments([]);
    setUploadingAttachments(false);
    setRemovingAttachmentId(null);
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(project: Project) {
    setEditingProject(project);
    setTitle(project.title);
    setDescription(project.description ?? "");
    setDueDate(project.dueDate ? project.dueDate.slice(0, 10) : "");
    setStatus(project.status);
    setPriority(project.priority);
    setPendingAttachments([]);
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

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Informe o título do projeto.");
      return;
    }

    if (editingProject) {
      updateProject.mutate(
        {
          id: editingProject.id,
          data: {
            title: trimmedTitle,
            description: description.trim() || null,
            status,
            priority,
            dueDate: dueDate || null,
          },
        },
        {
          onSuccess: async (project) => {
            try {
              if (pendingAttachments.length > 0) {
                setUploadingAttachments(true);
                await uploadPendingFiles(
                  project.id,
                  pendingAttachments.map((item) => item.file),
                );
              }
              queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
              toast({
                title: "Projeto atualizado",
                description: `${project.title} foi salvo com sucesso.`,
              });
              setDialogOpen(false);
              resetForm();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Projeto salvo, mas falhou o envio de anexos.",
              );
            } finally {
              setUploadingAttachments(false);
            }
          },
          onError: (err) => {
            setError(err instanceof Error ? err.message : "Não foi possível atualizar o projeto.");
          },
        },
      );
      return;
    }

    if (empresaOrgIds.length === 0 || entePublicoOrgIds.length === 0) {
      setError("Selecione ao menos uma empresa e um ente público.");
      return;
    }

    const resolvedGestorUserId =
      gestorUserId ||
      (me && eligibleGestors.some((user) => user.id === me.id)
        ? String(me.id)
        : "");

    if (!resolvedGestorUserId) {
      setError("Selecione o gestor responsável pelo projeto.");
      return;
    }

    createProject.mutate(
      {
        title: trimmedTitle,
        description: description.trim() || undefined,
        empresaOrgId: empresaOrgIds[0]!,
        entePublicoOrgId: entePublicoOrgIds[0]!,
        empresaOrgIds,
        entePublicoOrgIds,
        gestorUserId: Number(resolvedGestorUserId),
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: async (project) => {
          try {
            if (pendingAttachments.length > 0) {
              setUploadingAttachments(true);
              await uploadPendingFiles(
                project.id,
                pendingAttachments.map((item) => item.file),
              );
            }
            queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
            toast({
              title: "Projeto criado",
              description: `${project.title} foi iniciado com sucesso.`,
            });
            setDialogOpen(false);
            resetForm();
            setLocation(`/projects/${project.id}`);
          } catch (err) {
            toast({
              variant: "destructive",
              title: "Projeto criado, mas anexos falharam",
              description:
                err instanceof Error
                  ? err.message
                  : "Abra o projeto e tente anexar novamente.",
            });
            setDialogOpen(false);
            resetForm();
            setLocation(`/projects/${project.id}`);
          } finally {
            setUploadingAttachments(false);
          }
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Não foi possível criar o projeto.");
        },
      },
    );
  }

  function handleDeleteProject() {
    if (!deleteTarget) return;

    deleteProject.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({
            title: "Projeto excluído",
            description: `${deleteTarget.title} foi removido.`,
          });
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Erro ao excluir",
            description: err instanceof Error ? err.message : "Não foi possível excluir o projeto.",
          });
        },
      },
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido":
        return "bg-green-500/10 text-green-700 border-green-200 dark:border-green-800";
      case "em_andamento":
        return "bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-800";
      case "pausado":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:border-yellow-800";
      case "cancelado":
        return "bg-red-500/10 text-red-700 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200 dark:border-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgente":
        return "text-red-500 bg-red-500/10";
      case "alta":
        return "text-orange-500 bg-orange-500/10";
      case "media":
        return "text-blue-500 bg-blue-500/10";
      default:
        return "text-gray-500 bg-gray-500/10";
    }
  };

  const getPriorityBar = (priority: string) => {
    switch (priority) {
      case "urgente":
        return "bg-red-500";
      case "alta":
        return "bg-orange-500";
      case "media":
        return "bg-blue-500";
      default:
        return "bg-gray-300 dark:bg-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
          <p className="text-muted-foreground mt-1">Gerencie os projetos em andamento.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreateDialog} className="transition-transform hover:scale-[1.03] active:scale-95">
            <Plus className="mr-2 h-4 w-4" />
            Novo Projeto
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
          placeholder="Buscar projetos..."
          className="pl-9"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50 rounded-t-lg" />
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : filteredProjects?.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-lg bg-card/50">
          <p className="text-muted-foreground">Nenhum projeto encontrado.</p>
          {canCreate && (
            <Button variant="link" className="mt-2" onClick={openCreateDialog}>
              Começar um novo projeto
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
          {filteredProjects?.map((project) => (
            <motion.div
              key={project.id}
              variants={gridItemVariants}
              whileHover={{ y: -5 }}
              className="h-full"
            >
            <Card className="relative h-full overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary/50 flex flex-col">
              <span
                className={`absolute inset-x-0 top-0 h-1 ${getPriorityBar(project.priority)}`}
                aria-hidden="true"
              />
              <Link href={`/projects/${project.id}`} className="block group flex-1">
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {project.title}
                    </CardTitle>
                    <Badge variant="outline" className={`capitalize shrink-0 ${getStatusColor(project.status)}`}>
                      {project.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 mt-2 h-10">
                    {project.description || "Sem descrição."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Prazo</span>
                      <span className={!project.dueDate ? "italic" : "font-medium text-foreground"}>
                        {project.dueDate
                          ? format(new Date(project.dueDate), "dd/MM/yyyy", { locale: ptBR })
                          : "Não definido"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Prioridade</span>
                      <Badge variant="secondary" className={`capitalize border-none ${getPriorityColor(project.priority)}`}>
                        {project.priority}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Link>
              {(canEdit || canDelete) && (
                <div className="flex gap-2 px-6 pb-4 pt-0 border-t mt-auto">
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEditDialog(project)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(project)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Atualize as informações do projeto."
                : "Vincule uma empresa contratada e um ente público para iniciar o projeto."}
            </DialogDescription>
          </DialogHeader>

          {editingProject ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-title">Título</Label>
                <Input
                  id="project-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Descrição</Label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="project-status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as Project["status"])}>
                    <SelectTrigger id="project-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planejamento">Planejamento</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="pausado">Pausado</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-priority">Prioridade</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as Project["priority"])}>
                    <SelectTrigger id="project-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-due-date">Prazo (opcional)</Label>
                <Input
                  id="project-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <AttachmentsField
                existing={editingAttachments}
                pending={pendingAttachments}
                onPendingChange={setPendingAttachments}
                canEdit={canEdit}
                uploading={uploadingAttachments}
                removingId={removingAttachmentId}
                onUploadFiles={async (files) => {
                  if (!editingProject) return;
                  setUploadingAttachments(true);
                  try {
                    await uploadPendingFiles(editingProject.id, files);
                    await refetchEditingAttachments();
                    toast({
                      title: "Anexo enviado",
                      description: files.length === 1
                        ? `${files[0]!.name} foi anexado.`
                        : `${files.length} arquivos anexados.`,
                    });
                  } catch (err) {
                    toast({
                      variant: "destructive",
                      title: "Erro no upload",
                      description:
                        err instanceof Error
                          ? err.message
                          : "Não foi possível enviar o arquivo.",
                    });
                  } finally {
                    setUploadingAttachments(false);
                  }
                }}
                onRemoveExisting={(attachment) => {
                  setRemovingAttachmentId(attachment.id);
                  deleteAttachment.mutate(
                    { id: attachment.id, projectId: attachment.projectId },
                    {
                      onSuccess: () => {
                        void refetchEditingAttachments();
                        toast({
                          title: "Anexo removido",
                          description: attachment.originalName,
                        });
                      },
                      onError: (err) => {
                        toast({
                          variant: "destructive",
                          title: "Erro ao remover",
                          description:
                            err instanceof Error
                              ? err.message
                              : "Não foi possível remover o anexo.",
                        });
                      },
                      onSettled: () => setRemovingAttachmentId(null),
                    },
                  );
                }}
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateProject.isPending || uploadingAttachments}
                >
                  {updateProject.isPending || uploadingAttachments
                    ? "Salvando..."
                    : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          ) : !canSubmitProject ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Para criar um projeto, cadastre ao menos uma organização do tipo{" "}
                <strong>Empresa</strong> e uma do tipo <strong>Ente Público</strong>.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Fechar
                </Button>
                <Button asChild>
                  <Link href="/organizations">Ir para Organizações</Link>
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-title">Título</Label>
                <Input
                  id="project-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Modernização do portal da transparência"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Descrição</Label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objetivo e escopo do projeto (opcional)"
                  rows={3}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AssignmentChecklist
                  label="Empresas"
                  description="Selecione uma ou mais empresas contratadas."
                  options={empresaOrgs.map((org) => ({
                    id: org.id,
                    label: org.name,
                  }))}
                  selectedIds={empresaOrgIds}
                  onChange={(ids) => {
                    setEmpresaOrgIds(ids);
                  }}
                  emptyMessage="Cadastre empresas em Organizações."
                />
                <AssignmentChecklist
                  label="Entes públicos"
                  description="Selecione um ou mais entes parceiros."
                  options={entePublicoOrgs.map((org) => ({
                    id: org.id,
                    label: org.name,
                  }))}
                  selectedIds={entePublicoOrgIds}
                  onChange={(ids) => {
                    setEntePublicoOrgIds(ids);
                  }}
                  emptyMessage="Cadastre entes públicos em Organizações."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-gestor">Gestor do projeto</Label>
                {empresaOrgIds.length > 0 && entePublicoOrgIds.length > 0 ? (
                  eligibleGestors.length > 0 ? (
                    <>
                      <Select value={gestorUserId} onValueChange={setGestorUserId}>
                        <SelectTrigger id="project-gestor">
                          <SelectValue placeholder="Selecione o gestor responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleGestors.map((user) => (
                            <SelectItem key={user.id} value={String(user.id)}>
                              {user.name}
                              {user.organization?.name ? ` — ${user.organization.name}` : ""}
                              {user.id === me?.id ? " (você)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {me &&
                      eligibleGestors.some((user) => user.id === me.id) &&
                      gestorUserId === String(me.id) ? (
                        <p className="text-xs text-muted-foreground">
                          Você será o gestor responsável por este projeto.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                      Cadastre um gestor em uma das organizações do projeto antes de continuar.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                    Selecione a empresa e o ente público para escolher o gestor.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-due-date">Prazo (opcional)</Label>
                <Input
                  id="project-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <AttachmentsField
                pending={pendingAttachments}
                onPendingChange={setPendingAttachments}
                canEdit
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createProject.isPending ||
                    uploadingAttachments ||
                    eligibleGestors.length === 0 ||
                    !(
                      gestorUserId ||
                      (me && eligibleGestors.some((user) => user.id === me.id))
                    )
                  }
                >
                  {createProject.isPending || uploadingAttachments
                    ? "Criando..."
                    : "Criar projeto"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir projeto"
        description={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteProject}
        isPending={deleteProject.isPending}
      />
    </div>
  );
}
