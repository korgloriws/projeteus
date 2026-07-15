import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  useGetProject,
  useGetProjectSummary,
  useCreateStageWithMembers,
  useUpdateStageWithMembers,
  useGetMe,
  useListUsers,
  useListProjectMembers,
  useAddProjectMember,
  useUpdateProjectMember,
  useRemoveProjectMember,
  useCreateTaskWithAssignees,
  useUpdateTaskWithAssignees,
  useUpdateProject,
  useDeleteProject,
  useUpdateStage,
  useDeleteStage,
  useUpdateTask,
  useDeleteTask,
  useDeleteComment,
  useReorderStage,
  useReorderTask,
  useMoveTaskWithOrder,
  getGetProjectQueryKey,
  getGetProjectSummaryQueryKey,
  getListProjectMembersQueryKey,
  getListProjectsQueryKey,
  type Project,
  type Stage,
  type StageWithMembers,
  type Task,
  type TaskWithAssignees,
  type ProjectWithOrganizations,
  type ProjectMemberRole,
} from "@api/client";
import {
  useListProjectComments,
  useCreateProjectComment,
  getListProjectCommentsQueryKey,
} from "@api/comments";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, AlertCircle, MessageSquare, Send, AlertTriangle, Plus, Users, Pencil, Trash2, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { AssignmentChecklist } from "@/components/AssignmentChecklist";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DndContext,
  SortableContext,
  SortableStageItem,
  SortableTaskItem,
  StageTaskDropZone,
  closestCenter,
  useProjectBoardDnd,
  verticalListSortingStrategy,
} from "@/components/projects/sortable-board";
import { taskDndId } from "@/lib/board-order";

function stopDragPointer(event: React.PointerEvent) {
  event.stopPropagation();
}

function getPriorityMeta(priority: string) {
  switch (priority) {
    case "urgente":
      return {
        label: "Urgente",
        className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        bar: "bg-red-500",
      };
    case "alta":
      return {
        label: "Alta",
        className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
        bar: "bg-orange-500",
      };
    case "media":
      return {
        label: "Média",
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        bar: "bg-blue-500",
      };
    default:
      return {
        label: "Baixa",
        className: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
        bar: "bg-gray-400",
      };
  }
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projectDetail, isLoading, isError } = useGetProject(projectId);
  const { data: summary } = useGetProjectSummary(projectId);
  const { data: comments } = useListProjectComments(projectId);
  const { data: members } = useListProjectMembers(projectId);
  const { data: users } = useListUsers();
  const { data: me } = useGetMe();

  const createComment = useCreateProjectComment();
  const createStage = useCreateStageWithMembers();
  const updateStageMembers = useUpdateStageWithMembers();
  const addProjectMember = useAddProjectMember();
  const createTask = useCreateTaskWithAssignees();
  const updateTaskWithAssignees = useUpdateTaskWithAssignees();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteComment = useDeleteComment();
  const updateProjectMember = useUpdateProjectMember();
  const removeProjectMember = useRemoveProjectMember();
  const reorderStageMutation = useReorderStage();
  const reorderTaskMutation = useReorderTask();
  const moveTaskWithOrderMutation = useMoveTaskWithOrder();

  const isProjectGestorForBoard = members?.some(
    (member) => member.userId === me?.id && member.role === "gestor",
  );
  const canReorderBoard =
    me?.role === "admin" || Boolean(isProjectGestorForBoard);

  const boardDnd = useProjectBoardDnd({
    stages: projectDetail?.stages ?? [],
    tasks: projectDetail?.tasks ?? [],
    canReorder: canReorderBoard,
    onPersistStages: async (orderedStages) => {
      await Promise.all(
        orderedStages.map((stage, index) =>
          reorderStageMutation.mutateAsync({ id: stage.id, data: { order: index } }),
        ),
      );
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
    },
    onPersistTasks: async (updates) => {
      const currentTasks = projectDetail?.tasks ?? [];
      for (const update of updates) {
        const current = currentTasks.find((task) => task.id === update.id);
        if (!current) continue;

        const currentOrder = (current as Task & { order?: number }).order ?? 0;
        if (current.stageId !== update.stageId) {
          await moveTaskWithOrderMutation.mutateAsync({
            id: update.id,
            stageId: update.stageId,
            order: update.order,
          });
        } else if (currentOrder !== update.order) {
          await reorderTaskMutation.mutateAsync({
            id: update.id,
            order: update.order,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
    },
  });

  const [commentText, setCommentText] = useState("");
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberUserIds, setMemberUserIds] = useState<number[]>([]);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskStageId, setTaskStageId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<number[]>([]);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskError, setTaskError] = useState<string | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [stageName, setStageName] = useState("");
  const [stageStatus, setStageStatus] = useState<"planejamento" | "em_andamento" | "pausado" | "concluido" | "cancelado">("planejamento");
  const [stageDueDate, setStageDueDate] = useState("");
  const [stageMemberIds, setStageMemberIds] = useState<number[]>([]);
  const [stageError, setStageError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskStatus, setTaskStatus] = useState<"a_fazer" | "em_andamento" | "em_revisao" | "concluida">("a_fazer");
  const [taskPriority, setTaskPriority] = useState<"baixa" | "media" | "alta" | "urgente">("media");
  const [projectEditOpen, setProjectEditOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState<Project["status"]>("planejamento");
  const [projectPriority, setProjectPriority] = useState<Project["priority"]>("media");
  const [projectDueDate, setProjectDueDate] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "project"; name: string }
    | { type: "stage"; id: number; name: string }
    | { type: "task"; id: number; name: string }
    | { type: "comment"; id: number }
    | { type: "member"; memberId: number; name: string }
    | null
  >(null);
  const [stageCompleteAlertId, setStageCompleteAlertId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />
            <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />
          </div>
          <div className="space-y-6">
            <div className="h-48 animate-pulse rounded-xl border bg-muted/40" />
            <div className="h-72 animate-pulse rounded-xl border bg-muted/40" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        Não foi possível carregar este projeto. Verifique se você tem acesso a ele.
      </div>
    );
  }

  if (!projectDetail) {
    return <div className="text-center py-20">Projeto não encontrado.</div>;
  }

  const { project, tasks } = projectDetail;
  const stages = projectDetail.stages as StageWithMembers[];
  const projectWithOrgs = project as ProjectWithOrganizations;
  const projectOrgIds = new Set([
    ...(projectWithOrgs.empresaOrgIds ?? [project.empresaOrgId]),
    ...(projectWithOrgs.entePublicoOrgIds ?? [project.entePublicoOrgId]),
  ]);

  function getTaskAssigneeIds(task: Task): number[] {
    const enriched = task as TaskWithAssignees;
    if (enriched.assigneeUserIds?.length) return enriched.assigneeUserIds;
    return task.assigneeUserId ? [task.assigneeUserId] : [];
  }

  const stageMemberIdsById = new Map<number, number[]>();
  for (const stage of stages) {
    stageMemberIdsById.set(stage.id, stage.memberIds ?? []);
  }

  const isProjectGestor = members?.some(
    (member) => member.userId === me?.id && member.role === "gestor",
  );
  const canManageProjectTeam = me?.role === "admin" || Boolean(isProjectGestor);
  const canManageTasks = me?.role === "admin" || Boolean(isProjectGestor);
  const canManageStages = canManageTasks;
  const canDeleteProject = me?.role === "admin";

  function invalidateProjectQueries() {
    queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    queryClient.invalidateQueries({ queryKey: getGetProjectSummaryQueryKey(projectId) });
  }

  const assigneeById = new Map<number, string>();
  for (const member of members ?? []) {
    assigneeById.set(member.userId, member.user.name);
  }
  for (const user of users ?? []) {
    if (!assigneeById.has(user.id)) {
      assigneeById.set(user.id, user.name);
    }
  }

  const taskAssigneeOptions =
    members?.map((member) => ({
      id: member.userId,
      name: member.user.name,
      organization: member.user.organization?.name,
    })) ?? [];

  function getStageStatusColor(status: string) {
    switch (status) {
      case "concluido":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "em_andamento":
        return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "pausado":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200";
      case "cancelado":
        return "bg-red-500/10 text-red-700 border-red-200";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200";
    }
  }

  function getTaskStatusColor(status: string) {
    switch (status) {
      case "concluida":
        return "bg-green-500/10 text-green-700";
      case "em_andamento":
        return "bg-blue-500/10 text-blue-700";
      case "em_revisao":
        return "bg-orange-500/10 text-orange-700";
      default:
        return "bg-gray-500/10 text-gray-700";
    }
  }

  function getStageAccentBar(status: string) {
    switch (status) {
      case "concluido":
        return "bg-green-500";
      case "em_andamento":
        return "bg-blue-500";
      case "pausado":
        return "bg-yellow-500";
      case "cancelado":
        return "bg-red-500";
      default:
        return "bg-gray-300 dark:bg-gray-600";
    }
  }

  function openTaskDialog(stageId: number, task?: Task) {
    setTaskStageId(stageId);
    if (task) {
      setEditingTask(task);
      setTaskTitle(task.title);
      setTaskDescription(task.description ?? "");
      setTaskAssigneeIds(getTaskAssigneeIds(task));
      setTaskDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
      setTaskStatus(task.status);
      setTaskPriority(task.priority);
    } else {
      setEditingTask(null);
      resetTaskForm();
    }
    setTaskDialogOpen(true);
  }

  function resetTaskForm() {
    setTaskTitle("");
    setTaskDescription("");
    setTaskAssigneeIds([]);
    setTaskDueDate("");
    setTaskError(null);
  }

  function handleTaskDialogChange(open: boolean) {
    setTaskDialogOpen(open);
    if (!open) {
      setTaskStageId(null);
      setEditingTask(null);
      resetTaskForm();
    }
  }

  function handleCreateTask(event: React.FormEvent) {
    event.preventDefault();
    setTaskError(null);

    if (!taskStageId) return;

    const trimmedTitle = taskTitle.trim();
    if (!trimmedTitle) {
      setTaskError("Informe o título da tarefa.");
      return;
    }

    if (taskAssigneeIds.length === 0) {
      setTaskError("Selecione ao menos um responsável pela tarefa.");
      return;
    }

    if (editingTask) {
      updateTaskWithAssignees.mutate(
        {
          id: editingTask.id,
          data: {
            title: trimmedTitle,
            description: taskDescription.trim() || null,
            assigneeUserIds: taskAssigneeIds,
            dueDate: taskDueDate || null,
            status: taskStatus,
            priority: taskPriority,
          },
        },
        {
          onSuccess: () => {
            invalidateProjectQueries();
            toast({ title: "Tarefa atualizada", description: `${trimmedTitle} foi salva.` });
            handleTaskDialogChange(false);
          },
          onError: (err) => {
            setTaskError(err instanceof Error ? err.message : "Não foi possível atualizar a tarefa.");
          },
        },
      );
      return;
    }

    createTask.mutate(
      {
        stageId: taskStageId,
        data: {
          title: trimmedTitle,
          description: taskDescription.trim() || undefined,
          assigneeUserIds: taskAssigneeIds,
          dueDate: taskDueDate || undefined,
        },
      },
      {
        onSuccess: () => {
          invalidateProjectQueries();
          toast({
            title: "Tarefa criada",
            description: `${trimmedTitle} foi adicionada à etapa.`,
          });
          handleTaskDialogChange(false);
        },
        onError: (err) => {
          setTaskError(err instanceof Error ? err.message : "Não foi possível criar a tarefa.");
        },
      },
    );
  }

  const existingMemberUserIds = new Set(members?.map((member) => member.userId) ?? []);
  const eligibleMembers =
    users?.filter((user) => {
      if (existingMemberUserIds.has(user.id)) return false;
      if (user.role === "admin") return true;
      if (!user.organizationId) return false;
      return (
        user.organizationId != null && projectOrgIds.has(user.organizationId)
      );
    }) ?? [];

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    createComment.mutate(
      { projectId, content: commentText.trim() },
      {
        onSuccess: () => {
          setCommentText("");
          queryClient.invalidateQueries({
            queryKey: getListProjectCommentsQueryKey(projectId),
          });
        },
      },
    );
  };

  function getStageCompletionState(stageTasks: Task[]) {
    const pendingTasks = stageTasks.filter((task) => task.status !== "concluida");
    return {
      pendingTasks,
      hasTasks: stageTasks.length > 0,
      allTasksComplete: stageTasks.length > 0 && pendingTasks.length === 0,
      canCompleteStage: stageTasks.length > 0 && pendingTasks.length === 0,
    };
  }

  function handleCompleteTask(task: Task) {
    updateTask.mutate(
      { id: task.id, data: { status: "concluida" } },
      {
        onSuccess: () => {
          invalidateProjectQueries();
          toast({
            title: "Tarefa concluída",
            description: `${task.title} foi marcada como concluída.`,
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Erro ao concluir tarefa",
            description: err instanceof Error ? err.message : "Não foi possível concluir a tarefa.",
          });
        },
      },
    );
  }

  function handleCompleteStage(stage: Stage, stageTasks: Task[]) {
    const { canCompleteStage } = getStageCompletionState(stageTasks);

    if (!canCompleteStage) {
      setStageCompleteAlertId(stage.id);
      return;
    }

    updateStage.mutate(
      { id: stage.id, data: { status: "concluido" } },
      {
        onSuccess: () => {
          invalidateProjectQueries();
          setStageCompleteAlertId(null);
          toast({
            title: "Etapa concluída",
            description: `${stage.name} foi finalizada com sucesso.`,
          });
        },
        onError: (err) => {
          setStageCompleteAlertId(stage.id);
          toast({
            variant: "destructive",
            title: "Não foi possível concluir a etapa",
            description: err instanceof Error ? err.message : "Verifique se todas as tarefas foram concluídas.",
          });
        },
      },
    );
  }

  function openStageDialog(stage?: StageWithMembers) {
    if (stage) {
      setEditingStage(stage);
      setStageName(stage.name);
      setStageStatus(stage.status);
      setStageDueDate(stage.dueDate ? stage.dueDate.slice(0, 10) : "");
      setStageMemberIds(stage.memberIds ?? []);
    } else {
      setEditingStage(null);
      resetStageForm();
    }
    setStageError(null);
    setStageDialogOpen(true);
  }

  function resetStageForm() {
    setStageName("");
    setStageStatus("planejamento");
    setStageDueDate("");
    setStageMemberIds([]);
    setStageError(null);
    setEditingStage(null);
  }

  function toggleStageMember(userId: number) {
    setStageMemberIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function handleStageDialogChange(open: boolean) {
    setStageDialogOpen(open);
    if (!open) resetStageForm();
  }

  function handleCreateStage(event: React.FormEvent) {
    event.preventDefault();
    setStageError(null);

    const trimmedName = stageName.trim();
    if (!trimmedName) {
      setStageError("Informe o nome da etapa.");
      return;
    }

    if (stageMemberIds.length === 0) {
      setStageError("Atribua no mínimo um membro à etapa.");
      return;
    }

    if (editingStage && stageStatus === "concluido") {
      const stageTasks = tasks.filter((task) => task.stageId === editingStage.id);
      const { canCompleteStage, pendingTasks } = getStageCompletionState(stageTasks);
      if (!canCompleteStage) {
        const message = stageTasks.length === 0
          ? "Adicione tarefas à etapa antes de marcá-la como concluída."
          : `Conclua todas as tarefas antes de finalizar a etapa. ${pendingTasks.length} tarefa(s) pendente(s).`;
        setStageError(message);
        setStageCompleteAlertId(editingStage.id);
        return;
      }
    }

    if (editingStage) {
      updateStageMembers.mutate(
        {
          id: editingStage.id,
          data: {
            name: trimmedName,
            status: stageStatus,
            dueDate: stageDueDate || null,
            memberIds: stageMemberIds,
          },
        },
        {
          onSuccess: () => {
            invalidateProjectQueries();
            toast({ title: "Etapa atualizada", description: `${trimmedName} foi salva.` });
            setStageDialogOpen(false);
            resetStageForm();
          },
          onError: (err) => {
            setStageError(err instanceof Error ? err.message : "Não foi possível atualizar a etapa.");
          },
        },
      );
      return;
    }

    const nextOrder =
      stages.length === 0
        ? 0
        : Math.max(...stages.map((stage) => stage.order)) + 1;

    createStage.mutate(
      {
        projectId,
        data: {
          name: trimmedName,
          order: nextOrder,
          status: stageStatus,
          dueDate: stageDueDate || undefined,
          memberIds: stageMemberIds,
        },
      },
      {
        onSuccess: () => {
          invalidateProjectQueries();
          toast({
            title: "Etapa criada",
            description: `${trimmedName} foi adicionada ao projeto.`,
          });
          setStageDialogOpen(false);
          resetStageForm();
        },
        onError: (err) => {
          setStageError(err instanceof Error ? err.message : "Não foi possível criar a etapa.");
        },
      },
    );
  }

  function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    setMemberError(null);

    if (memberUserIds.length === 0) {
      setMemberError("Selecione ao menos um membro para adicionar ao projeto.");
      return;
    }

    addProjectMember.mutate(
      { projectId, userIds: memberUserIds, role: "membro" },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({
            title: "Membros adicionados",
            description: "Os usuários selecionados foram incluídos na equipe do projeto.",
          });
          setMemberDialogOpen(false);
          setMemberUserIds([]);
          setMemberError(null);
        },
        onError: (err) => {
          setMemberError(
            err instanceof Error ? err.message : "Não foi possível adicionar o membro.",
          );
        },
      },
    );
  }

  function openProjectEdit() {
    setProjectTitle(project.title);
    setProjectDescription(project.description ?? "");
    setProjectStatus(project.status);
    setProjectPriority(project.priority);
    setProjectDueDate(project.dueDate ? project.dueDate.slice(0, 10) : "");
    setProjectError(null);
    setProjectEditOpen(true);
  }

  function handleUpdateProject(event: React.FormEvent) {
    event.preventDefault();
    setProjectError(null);

    const trimmedTitle = projectTitle.trim();
    if (!trimmedTitle) {
      setProjectError("Informe o título do projeto.");
      return;
    }

    updateProject.mutate(
      {
        id: projectId,
        data: {
          title: trimmedTitle,
          description: projectDescription.trim() || null,
          status: projectStatus,
          priority: projectPriority,
          dueDate: projectDueDate || null,
        },
      },
      {
        onSuccess: () => {
          invalidateProjectQueries();
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          toast({ title: "Projeto atualizado", description: "As alterações foram salvas." });
          setProjectEditOpen(false);
        },
        onError: (err) => {
          setProjectError(err instanceof Error ? err.message : "Não foi possível atualizar o projeto.");
        },
      },
    );
  }

  function handleMemberRoleChange(memberId: number, role: ProjectMemberRole) {
    updateProjectMember.mutate(
      { projectId, memberId, role },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          toast({ title: "Função atualizada", description: "O papel do membro foi alterado." });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Erro",
            description: err instanceof Error ? err.message : "Não foi possível alterar a função.",
          });
        },
      },
    );
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.type === "project") {
      deleteProject.mutate(
        { id: projectId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
            toast({ title: "Projeto excluído" });
            setDeleteTarget(null);
            setLocation("/projects");
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
      return;
    }

    if (deleteTarget.type === "stage") {
      deleteStage.mutate(
        { id: deleteTarget.id },
        {
          onSuccess: () => {
            invalidateProjectQueries();
            toast({ title: "Etapa excluída", description: `${deleteTarget.name} foi removida.` });
            setDeleteTarget(null);
          },
          onError: (err) => {
            toast({
              variant: "destructive",
              title: "Erro ao excluir",
              description: err instanceof Error ? err.message : "Não foi possível excluir a etapa.",
            });
          },
        },
      );
      return;
    }

    if (deleteTarget.type === "task") {
      deleteTask.mutate(
        { id: deleteTarget.id },
        {
          onSuccess: () => {
            invalidateProjectQueries();
            toast({ title: "Tarefa excluída", description: `${deleteTarget.name} foi removida.` });
            setDeleteTarget(null);
          },
          onError: (err) => {
            toast({
              variant: "destructive",
              title: "Erro ao excluir",
              description: err instanceof Error ? err.message : "Não foi possível excluir a tarefa.",
            });
          },
        },
      );
      return;
    }

    if (deleteTarget.type === "comment") {
      deleteComment.mutate(
        { id: deleteTarget.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListProjectCommentsQueryKey(projectId),
            });
            toast({ title: "Comentário excluído" });
            setDeleteTarget(null);
          },
          onError: () => {
            toast({ variant: "destructive", title: "Erro ao excluir comentário" });
          },
        },
      );
      return;
    }

    if (deleteTarget.type === "member") {
      removeProjectMember.mutate(
        { projectId, memberId: deleteTarget.memberId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProjectMembersQueryKey(projectId) });
            queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
            toast({ title: "Membro removido", description: `${deleteTarget.name} saiu da equipe.` });
            setDeleteTarget(null);
          },
          onError: (err) => {
            toast({
              variant: "destructive",
              title: "Erro ao remover",
              description: err instanceof Error ? err.message : "Não foi possível remover o membro.",
            });
          },
        },
      );
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'concluido': return 'bg-green-500/10 text-green-700 border-green-200';
      case 'em_andamento': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const priorityMeta = getPriorityMeta(project.priority);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative flex flex-col gap-4 bg-card p-6 rounded-xl border shadow-sm overflow-hidden"
      >
        <span
          className={`absolute inset-x-0 top-0 h-1 ${priorityMeta.bar}`}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
              <Badge variant="outline" className={`capitalize ${getStatusColor(project.status)}`}>
                {project.status.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline" className={`capitalize ${priorityMeta.className}`}>
                {priorityMeta.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground sm:items-end shrink-0">
            {canManageTasks && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openProjectEdit}
                  className="transition-transform hover:scale-[1.03] active:scale-95"
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                {canDeleteProject && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget({ type: "project", name: project.title })}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Excluir
                  </Button>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Criado em: {format(new Date(project.createdAt), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            {project.dueDate && (
              <div className="flex items-center gap-2 text-foreground font-medium">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Prazo: {format(new Date(project.dueDate), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {summary && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">Progresso Geral</span>
              <span className="font-bold">{summary.progressPercent}%</span>
            </div>
            <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400"
                initial={{ width: 0 }}
                animate={{ width: `${summary.progressPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="secondary" className="font-normal gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {summary.completedTasks} / {summary.totalTasks} tarefas concluídas
              </Badge>
              <Badge variant="secondary" className="font-normal">
                {summary.totalStages} etapa{summary.totalStages === 1 ? "" : "s"}
              </Badge>
            </div>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Board / Stages */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="flex items-center justify-between"
          >
            <div>
              <h2 className="text-lg font-bold">Etapas e Tarefas</h2>
              {canManageTasks && (
                <p className="text-xs text-muted-foreground mt-1">
                  Arraste pelo ícone <span className="inline-block align-middle">⋮⋮</span> para reorganizar etapas e tarefas.
                </p>
              )}
            </div>
            {canManageStages && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openStageDialog()}
                className="transition-transform hover:scale-[1.03] active:scale-95"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Etapa
              </Button>
            )}
          </motion.div>

          <DndContext
            sensors={boardDnd.sensors}
            collisionDetection={closestCenter}
            onDragEnd={async (event) => {
              try {
                await boardDnd.handleDragEnd(event);
              } catch (err) {
                toast({
                  variant: "destructive",
                  title: "Erro ao reorganizar",
                  description:
                    err instanceof Error ? err.message : "Não foi possível salvar a nova ordem.",
                });
              }
            }}
          >
          <div className="space-y-6">
            {stages.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-lg bg-card/50">
                <p className="text-muted-foreground text-sm">Este projeto ainda não possui etapas.</p>
                {canManageStages && (
                  <Button size="sm" className="mt-4" onClick={() => openStageDialog()}>
                    Criar Primeira Etapa
                  </Button>
                )}
              </div>
            ) : (
              <SortableContext
                items={boardDnd.stageSortableIds}
                strategy={verticalListSortingStrategy}
              >
              {boardDnd.sortedStages.map((stage) => {
                const stageTasks = boardDnd.getStageTasks(stage.id);
                const isCompletedStage = stage.status === "concluido";
                const { pendingTasks, hasTasks, allTasksComplete, canCompleteStage } =
                  getStageCompletionState(stageTasks);
                const showStageCompletionAlert =
                  !isCompletedStage &&
                  canManageTasks &&
                  ((hasTasks && pendingTasks.length > 0) ||
                    (!hasTasks && stageCompleteAlertId === stage.id));
                return (
                  <SortableStageItem
                    key={stage.id}
                    stageId={stage.id}
                    disabled={!canManageTasks}
                  >
                    {(stageDragHandle) => (
                  <Card
                    className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${
                      isCompletedStage
                        ? "border-green-500/30 bg-green-500/[0.03]"
                        : "hover:border-primary/30"
                    }`}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 w-1 ${getStageAccentBar(stage.status)}`}
                      aria-hidden="true"
                    />
                    <CardHeader className="bg-secondary/50 py-3 px-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {stageDragHandle}
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <CardTitle className="text-base font-semibold">{stage.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize shrink-0 ${getStageStatusColor(stage.status)}`}
                        >
                          {stage.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {stageTasks.length} tarefa{stageTasks.length === 1 ? "" : "s"}
                        </Badge>
                        {(stageMemberIdsById.get(stage.id) ?? []).length > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <div className="flex flex-wrap gap-1">
                              {(stageMemberIdsById.get(stage.id) ?? []).map((userId) => (
                                <Badge
                                  key={userId}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {assigneeById.get(userId) ?? `Usuário ${userId}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                      {canManageTasks && (
                        <div className="flex flex-wrap items-center gap-1 shrink-0">
                          {!isCompletedStage && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-green-700 border-green-200 hover:bg-green-50"
                            onClick={() => handleCompleteStage(stage, stageTasks)}
                            onPointerDown={stopDragPointer}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Concluir etapa
                          </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => openTaskDialog(stage.id)}
                            onPointerDown={stopDragPointer}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Tarefa
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onPointerDown={stopDragPointer}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  openStageDialog({
                                    ...stage,
                                    memberIds: stageMemberIdsById.get(stage.id) ?? [],
                                  })
                                }
                              >
                                <Pencil className="mr-2 h-3 w-3" />
                                Editar etapa
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setDeleteTarget({ type: "stage", id: stage.id, name: stage.name })
                                }
                              >
                                <Trash2 className="mr-2 h-3 w-3" />
                                Excluir etapa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </CardHeader>
                    {showStageCompletionAlert && (
                      <div className="px-4 pt-3">
                        <Alert variant="destructive" className="bg-destructive/5">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Não é possível concluir esta etapa</AlertTitle>
                          <AlertDescription>
                            {!hasTasks ? (
                              <p>Adicione tarefas a esta etapa e conclua-as antes de finalizá-la.</p>
                            ) : (
                              <div className="space-y-1">
                                <p>
                                  Conclua todas as tarefas antes de finalizar a etapa.{" "}
                                  <strong>{pendingTasks.length}</strong> tarefa
                                  {pendingTasks.length === 1 ? "" : "s"} pendente
                                  {pendingTasks.length === 1 ? "" : "s"}:
                                </p>
                                <ul className="list-disc pl-4 text-xs">
                                  {pendingTasks.map((task) => (
                                    <li key={task.id}>{task.title}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                    {canManageTasks && !isCompletedStage && hasTasks && allTasksComplete && (
                      <div className="px-4 pt-3">
                        <Alert className="border-green-200 bg-green-50 text-green-900">
                          <CheckCircle2 className="h-4 w-4 text-green-700" />
                          <AlertTitle className="text-green-900">Etapa pronta para conclusão</AlertTitle>
                          <AlertDescription className="text-green-800">
                            Todas as tarefas desta etapa foram concluídas. Clique em &quot;Concluir etapa&quot; para finalizá-la.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                    <CardContent className="p-0">
                      <StageTaskDropZone stageId={stage.id} disabled={!canManageTasks}>
                      {stageTasks.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center italic">
                          Sem tarefas nesta etapa.
                        </div>
                      ) : (
                        <SortableContext
                          items={stageTasks.map((task) => taskDndId(task.id))}
                          strategy={verticalListSortingStrategy}
                        >
                        <div className="divide-y divide-border">
                          {stageTasks.map((task) => {
                            const assigneeIds = getTaskAssigneeIds(task);
                            const assigneeNames = assigneeIds.map(
                              (id) => assigneeById.get(id) ?? `Usuário ${id}`,
                            );
                            const assigneeLabel =
                              assigneeNames.length > 0
                                ? assigneeNames.join(", ")
                                : "Sem responsável";
                            const assigneeInitials = (assigneeNames[0] ?? "?")
                              .substring(0, 2)
                              .toUpperCase();
                            const isMyTask = me?.id != null && assigneeIds.includes(me.id);

                            return (
                              <SortableTaskItem
                                key={task.id}
                                taskId={task.id}
                                disabled={!canManageTasks}
                              >
                                {(taskDragHandle) => (
                              <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between hover:bg-muted/30 transition-colors">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                {taskDragHandle}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="font-medium text-sm">{task.title}</div>
                                    {!canManageTasks && isMyTask && (
                                      <Badge variant="secondary" className="text-[10px]">
                                        Você é responsável
                                      </Badge>
                                    )}
                                  </div>
                                  {task.description && (
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {task.description}
                                    </div>
                                  )}
                                  {task.dueDate && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Prazo: {format(new Date(task.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                                    </div>
                                  )}
                                </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:shrink-0">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] capitalize ${getTaskStatusColor(task.status)}`}
                                  >
                                    {task.status.replace(/_/g, " ")}
                                  </Badge>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-[10px]">
                                        {assigneeInitials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-muted-foreground max-w-[160px] truncate hidden sm:inline">
                                      {assigneeLabel}
                                    </span>
                                  </div>
                                  {canManageTasks && task.status !== "concluida" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                      onClick={() => handleCompleteTask(task)}
                                      onPointerDown={stopDragPointer}
                                      disabled={updateTask.isPending}
                                    >
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      Concluir
                                    </Button>
                                  )}
                                  {canManageTasks && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          onPointerDown={stopDragPointer}
                                        >
                                          <MoreHorizontal className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openTaskDialog(stage.id, task)}>
                                          <Pencil className="mr-2 h-3 w-3" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onClick={() =>
                                            setDeleteTarget({
                                              type: "task",
                                              id: task.id,
                                              name: task.title,
                                            })
                                          }
                                        >
                                          <Trash2 className="mr-2 h-3 w-3" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                                )}
                              </SortableTaskItem>
                            );
                          })}
                        </div>
                        </SortableContext>
                      )}
                      </StageTaskDropZone>
                    </CardContent>
                  </Card>
                    )}
                  </SortableStageItem>
                );
              })}
              </SortableContext>
            )}
          </div>
          </DndContext>
        </div>

        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          className="space-y-6"
        >
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </span>
                Equipe do Projeto
              </CardTitle>
              {canManageProjectTeam && (
                <Button size="sm" variant="outline" onClick={() => setMemberDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {members && members.length > 0 ? (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {member.user.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.user.organization?.name || "Sem organização"}
                        </p>
                      </div>
                    </div>
                    {canManageProjectTeam ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            handleMemberRoleChange(member.id, value as ProjectMemberRole)
                          }
                          disabled={updateProjectMember.isPending}
                        >
                          <SelectTrigger className="w-[100px] h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gestor">Gestor</SelectItem>
                            <SelectItem value="membro">Membro</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              type: "member",
                              memberId: member.id,
                              name: member.user.name,
                            })
                          }
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="capitalize shrink-0">
                        {member.role}
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  Nenhum membro atribuído ao projeto.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col h-[600px] bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </span>
              Comunicações do projeto
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Canal exclusivo deste projeto. Cada mensagem identifica quem enviou.
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments?.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground mt-10">
                Nenhuma mensagem ainda. Inicie a conversa deste projeto.
              </div>
            ) : (
              comments?.map((comment) => {
                const isOwnMessage = comment.authorUserId === me?.id;
                const canDeleteComment =
                  comment.authorUserId === me?.id || me?.role === "admin";

                return (
                <div
                  key={comment.id}
                  className={`flex gap-3 text-sm ${isOwnMessage ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>
                      {comment.author.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`p-3 rounded-lg w-full max-w-[85%] ${
                      isOwnMessage
                        ? "bg-primary/10 rounded-tr-none"
                        : "bg-muted/50 rounded-tl-none"
                    }`}
                  >
                    <div className={`flex justify-between items-start gap-2 mb-1 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                      <div className={`flex flex-col gap-0.5 ${isOwnMessage ? "items-end" : ""}`}>
                        <span className="font-semibold text-xs">
                          {comment.author.name}
                          {isOwnMessage ? " (você)" : ""}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {comment.author.email}
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {comment.author.role}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(comment.createdAt), "dd/MM HH:mm")}
                        </span>
                        {canDeleteComment && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ type: "comment", id: comment.id })}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className={`text-foreground ${isOwnMessage ? "text-right" : ""}`}>
                      {comment.content}
                    </p>
                  </div>
                </div>
              );
              })
            )}
          </div>

          <div className="p-4 border-t space-y-2">
            {me && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {me.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>
                  Enviando como <strong className="text-foreground">{me.name}</strong>
                </span>
              </div>
            )}
            <form onSubmit={handleSendComment} className="flex gap-2">
              <Input 
                placeholder="Escreva uma mensagem neste projeto..." 
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                className="flex-1"
                disabled={createComment.isPending}
              />
              <Button type="submit" size="icon" disabled={!commentText.trim() || createComment.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
        </motion.div>
      </div>

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar membro ao projeto</DialogTitle>
            <DialogDescription>
              Inclua um ou mais usuários das organizações parceiras na equipe deste projeto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <AssignmentChecklist
              label="Membros"
              description="Selecione um ou mais usuários para adicionar ao projeto."
              options={eligibleMembers.map((user) => ({
                id: user.id,
                label: user.name,
                description: user.organization?.name,
              }))}
              selectedIds={memberUserIds}
              onChange={setMemberUserIds}
              emptyMessage="Não há usuários disponíveis para adicionar neste projeto."
            />
            {memberError ? <p className="text-sm text-destructive">{memberError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMemberDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={addProjectMember.isPending || memberUserIds.length === 0}
              >
                {addProjectMember.isPending ? "Adicionando..." : "Adicionar membros"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={handleTaskDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTask
                ? "Atualize os dados da tarefa."
                : "Adicione uma tarefa à etapa e defina quem serão os responsáveis."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Ex.: Revisar documentação técnica"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Descrição</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Detalhes da tarefa (opcional)"
                rows={3}
              />
            </div>
            <AssignmentChecklist
              label="Responsáveis"
              description="Selecione um ou mais membros responsáveis por esta tarefa."
              options={taskAssigneeOptions.map((option) => ({
                id: option.id,
                label: option.name,
                description: option.organization,
              }))}
              selectedIds={taskAssigneeIds}
              onChange={setTaskAssigneeIds}
              emptyMessage="Adicione membros à equipe do projeto antes de criar tarefas."
            />
            {editingTask && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="task-status">Status</Label>
                  <Select value={taskStatus} onValueChange={(value) => setTaskStatus(value as typeof taskStatus)}>
                    <SelectTrigger id="task-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_fazer">A fazer</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="em_revisao">Em revisão</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-priority">Prioridade</Label>
                  <Select value={taskPriority} onValueChange={(value) => setTaskPriority(value as typeof taskPriority)}>
                    <SelectTrigger id="task-priority">
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
            )}
            <div className="space-y-2">
              <Label htmlFor="task-due-date">Prazo (opcional)</Label>
              <Input
                id="task-due-date"
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
            {taskError ? <p className="text-sm text-destructive">{taskError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleTaskDialogChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createTask.isPending ||
                  updateTaskWithAssignees.isPending ||
                  taskAssigneeIds.length === 0 ||
                  taskAssigneeOptions.length === 0
                }
              >
                {createTask.isPending || updateTaskWithAssignees.isPending
                  ? "Salvando..."
                  : editingTask
                    ? "Salvar alterações"
                    : "Criar tarefa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stageDialogOpen} onOpenChange={handleStageDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
            <DialogDescription>
              {editingStage
                ? "Atualize os dados da etapa."
                : "Adicione uma etapa ao fluxo de execução do projeto."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateStage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Nome</Label>
              <Input
                id="stage-name"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Ex.: Levantamento de requisitos"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-status">Status</Label>
              <Select value={stageStatus} onValueChange={(value) => setStageStatus(value as typeof stageStatus)}>
                <SelectTrigger id="stage-status">
                  <SelectValue placeholder="Selecione o status" />
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
              <Label htmlFor="stage-due-date">Prazo (opcional)</Label>
              <Input
                id="stage-due-date"
                type="date"
                value={stageDueDate}
                onChange={(e) => setStageDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Membros da etapa</Label>
              <p className="text-xs text-muted-foreground">
                Selecione no mínimo um membro responsável por esta etapa.
              </p>
              {taskAssigneeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Adicione membros ao projeto antes de criar etapas.
                </p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
                  {taskAssigneeOptions.map((option) => {
                    const checked = stageMemberIds.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary/60"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={() => toggleStageMember(option.id)}
                        />
                        <span className="flex-1">{option.name}</span>
                        {option.organization ? (
                          <span className="text-xs text-muted-foreground">
                            {option.organization}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {stageError ? <p className="text-sm text-destructive">{stageError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStageDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createStage.isPending || updateStageMembers.isPending}>
                {createStage.isPending || updateStageMembers.isPending
                  ? "Salvando..."
                  : editingStage
                    ? "Salvar alterações"
                    : "Criar etapa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectEditOpen} onOpenChange={setProjectEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
            <DialogDescription>Atualize as informações gerais do projeto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-title">Título</Label>
              <Input
                id="edit-project-title"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">Descrição</Label>
              <Textarea
                id="edit-project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-project-status">Status</Label>
                <Select value={projectStatus} onValueChange={(value) => setProjectStatus(value as Project["status"])}>
                  <SelectTrigger id="edit-project-status">
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
                <Label htmlFor="edit-project-priority">Prioridade</Label>
                <Select value={projectPriority} onValueChange={(value) => setProjectPriority(value as Project["priority"])}>
                  <SelectTrigger id="edit-project-priority">
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
              <Label htmlFor="edit-project-due-date">Prazo (opcional)</Label>
              <Input
                id="edit-project-due-date"
                type="date"
                value={projectDueDate}
                onChange={(e) => setProjectDueDate(e.target.value)}
              />
            </div>
            {projectError ? <p className="text-sm text-destructive">{projectError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProjectEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateProject.isPending}>
                {updateProject.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.type === "project"
            ? "Excluir projeto"
            : deleteTarget?.type === "stage"
              ? "Excluir etapa"
              : deleteTarget?.type === "task"
                ? "Excluir tarefa"
                : deleteTarget?.type === "member"
                  ? "Remover membro"
                  : "Excluir comentário"
        }
        description={
          deleteTarget?.type === "comment"
            ? "Tem certeza que deseja excluir este comentário?"
            : deleteTarget?.type === "project"
              ? `Tem certeza que deseja excluir "${deleteTarget.name}"? Todas as etapas e tarefas serão removidas.`
              : deleteTarget?.type === "member"
                ? `Remover ${deleteTarget.name} da equipe do projeto?`
                : deleteTarget
                  ? `Tem certeza que deseja excluir "${deleteTarget.name}"?`
                  : ""
        }
        onConfirm={handleConfirmDelete}
        isPending={
          deleteProject.isPending ||
          deleteStage.isPending ||
          deleteTask.isPending ||
          deleteComment.isPending ||
          removeProjectMember.isPending
        }
      />
    </div>
  );
}
