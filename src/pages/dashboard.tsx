import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGetDashboardSummary, useGetMe } from "@api/client";
import {
  useGetDashboardActivity,
  useGetActivityFilterOptions,
  useGetMyTasks,
  useGetMyTasksFilterOptions,
  type GetDashboardActivityParams,
  type GetMyTasksParams,
} from "@api/dashboard";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/StatCard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Clock, Activity, Briefcase, Filter, X } from "lucide-react";
import { Link } from "wouter";

const ALL_VALUE = "__all__";

export default function Dashboard() {
  const { data: user } = useGetMe();
  const { data: summary, isLoading: loadingSummary, isError: summaryError } =
    useGetDashboardSummary();
  const { data: filterOptions } = useGetActivityFilterOptions();
  const { data: myTasksFilterOptions } = useGetMyTasksFilterOptions();

  const [taskStatus, setTaskStatus] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskStageId, setTaskStageId] = useState("");
  const [taskDueFrom, setTaskDueFrom] = useState("");
  const [taskDueTo, setTaskDueTo] = useState("");

  const myTasksParams = useMemo<GetMyTasksParams>(() => {
    const params: GetMyTasksParams = {};
    if (taskStatus) params.status = taskStatus as GetMyTasksParams["status"];
    if (taskProjectId) params.projectId = Number(taskProjectId);
    if (taskStageId) params.stageId = Number(taskStageId);
    if (taskDueFrom) params.dueFrom = taskDueFrom;
    if (taskDueTo) params.dueTo = taskDueTo;
    return params;
  }, [taskStatus, taskProjectId, taskStageId, taskDueFrom, taskDueTo]);

  const {
    data: myTasks,
    isLoading: loadingTasks,
    isError: tasksError,
  } = useGetMyTasks(myTasksParams);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [stageId, setStageId] = useState("");

  const activityParams = useMemo<GetDashboardActivityParams>(() => {
    const params: GetDashboardActivityParams = { limit: 20 };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (projectId) params.projectId = Number(projectId);
    if (assigneeUserId) params.assigneeUserId = Number(assigneeUserId);
    if (taskId) params.taskId = Number(taskId);
    if (stageId) params.stageId = Number(stageId);
    return params;
  }, [fromDate, toDate, projectId, assigneeUserId, taskId, stageId]);

  const {
    data: activity,
    isLoading: loadingActivity,
    isError: activityError,
  } = useGetDashboardActivity(activityParams);

  const filteredStages = useMemo(() => {
    if (!filterOptions?.stages) return [];
    if (!projectId) return filterOptions.stages;
    return filterOptions.stages.filter(
      (stage) => stage.projectId === Number(projectId),
    );
  }, [filterOptions?.stages, projectId]);

  const filteredTasks = useMemo(() => {
    if (!filterOptions?.tasks) return [];
    let tasks = filterOptions.tasks;
    if (projectId) {
      tasks = tasks.filter((task) => task.projectId === Number(projectId));
    }
    if (stageId) {
      tasks = tasks.filter((task) => task.stageId === Number(stageId));
    }
    if (assigneeUserId) {
      tasks = tasks.filter(
        (task) => task.assigneeUserId === Number(assigneeUserId),
      );
    }
    return tasks;
  }, [filterOptions?.tasks, projectId, stageId, assigneeUserId]);

  const hasActiveTaskFilters =
    taskStatus || taskProjectId || taskStageId || taskDueFrom || taskDueTo;

  const myTaskStages = useMemo(() => {
    if (!myTasksFilterOptions?.stages) return [];
    if (!taskProjectId) return myTasksFilterOptions.stages;
    return myTasksFilterOptions.stages.filter(
      (stage) => stage.projectId === Number(taskProjectId),
    );
  }, [myTasksFilterOptions?.stages, taskProjectId]);

  function clearTaskFilters() {
    setTaskStatus("");
    setTaskProjectId("");
    setTaskStageId("");
    setTaskDueFrom("");
    setTaskDueTo("");
  }

  const hasActiveFilters =
    fromDate || toDate || projectId || assigneeUserId || taskId || stageId;

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setProjectId("");
    setAssigneeUserId("");
    setTaskId("");
    setStageId("");
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluida":
        return "bg-green-500/10 text-green-700 hover:bg-green-500/20";
      case "em_andamento":
        return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20";
      case "em_revisao":
        return "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 hover:bg-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => status.replace(/_/g, " ");

  if (loadingSummary || loadingActivity || loadingTasks) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg border bg-muted/40" />
          <div className="h-80 animate-pulse rounded-lg border bg-muted/40" />
        </div>
      </div>
    );
  }

  if (summaryError || activityError || tasksError) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        Não foi possível carregar o painel agora. Tente novamente em instantes.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo de volta, {user?.name}. Seu histórico de ações é
          individual e mostra apenas o que é relevante para você.
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Projetos Ativos"
          value={summary?.activeProjects || 0}
          subtitle={`de ${summary?.totalProjects || 0} totais`}
          icon={Briefcase}
          accent="primary"
          index={0}
        />
        <StatCard
          title="Tarefas Concluídas"
          value={summary?.completedTasks || 0}
          subtitle={`de ${summary?.totalTasks || 0} totais`}
          icon={CheckCircle2}
          accent="green"
          index={1}
        />
        <StatCard
          title="Tarefas Atrasadas"
          value={summary?.overdueTasks || 0}
          subtitle="precisam de atenção"
          icon={Clock}
          accent="red"
          index={2}
        />
        <StatCard
          title="Projetos Concluídos"
          value={summary?.completedProjects || 0}
          subtitle="no total"
          icon={Activity}
          accent="blue"
          index={3}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.45, ease: "easeOut" }}
          className="col-span-1"
        >
        <Card className="h-full">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Minhas Tarefas</CardTitle>
              {hasActiveTaskFilters && (
                <Button variant="ghost" size="sm" onClick={clearTaskFilters}>
                  <X className="mr-1 h-3 w-3" />
                  Limpar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Todas as suas tarefas, concluídas ou não, nos projetos em que você
              participa.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={taskStatus || ALL_VALUE}
                  onValueChange={(value) =>
                    setTaskStatus(value === ALL_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todos os status</SelectItem>
                    <SelectItem value="a_fazer">A fazer</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="em_revisao">Em revisão</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Projeto</Label>
                <Select
                  value={taskProjectId || ALL_VALUE}
                  onValueChange={(value) => {
                    setTaskProjectId(value === ALL_VALUE ? "" : value);
                    setTaskStageId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todos os projetos</SelectItem>
                    {myTasksFilterOptions?.projects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Etapa</Label>
                <Select
                  value={taskStageId || ALL_VALUE}
                  onValueChange={(value) =>
                    setTaskStageId(value === ALL_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as etapas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todas as etapas</SelectItem>
                    {myTaskStages.map((stage) => (
                      <SelectItem key={stage.id} value={String(stage.id)}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="task-due-from">Prazo de</Label>
                <Input
                  id="task-due-from"
                  type="date"
                  value={taskDueFrom}
                  onChange={(e) => setTaskDueFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="task-due-to">Prazo até</Label>
                <Input
                  id="task-due-to"
                  type="date"
                  value={taskDueTo}
                  onChange={(e) => setTaskDueTo(e.target.value)}
                />
              </div>
            </div>

            {myTasks && myTasks.length > 0 ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {myTasks.map((task) => (
                  <Link key={task.id} href={`/projects/${task.projectId}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-medium text-sm truncate">{task.title}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {task.projectTitle} · {task.stageTitle}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Prazo:{" "}
                          {task.dueDate
                            ? format(new Date(task.dueDate), "dd/MM/yyyy", {
                                locale: ptBR,
                              })
                            : "Sem prazo"}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`capitalize shrink-0 ml-2 ${getStatusColor(task.status)}`}
                      >
                        {getStatusLabel(task.status)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                {hasActiveTaskFilters
                  ? "Nenhuma tarefa encontrada com os filtros selecionados."
                  : "Você não tem tarefas nos seus projetos no momento."}
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.45, ease: "easeOut" }}
          className="col-span-1"
        >
        <Card className="h-full">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Histórico de ações</CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-3 w-3" />
                  Limpar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-3 w-3" />
              Filtre por período, projeto, responsável, tarefa ou etapa
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="activity-from">De</Label>
                <Input
                  id="activity-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="activity-to">Até</Label>
                <Input
                  id="activity-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Projeto</Label>
                <Select
                  value={projectId || ALL_VALUE}
                  onValueChange={(value) => {
                    setProjectId(value === ALL_VALUE ? "" : value);
                    setStageId("");
                    setTaskId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todos os projetos</SelectItem>
                    {filterOptions?.projects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Responsável</Label>
                <Select
                  value={assigneeUserId || ALL_VALUE}
                  onValueChange={(value) =>
                    setAssigneeUserId(value === ALL_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todos</SelectItem>
                    {filterOptions?.assignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={String(assignee.id)}>
                        {assignee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Etapa</Label>
                <Select
                  value={stageId || ALL_VALUE}
                  onValueChange={(value) => {
                    setStageId(value === ALL_VALUE ? "" : value);
                    setTaskId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as etapas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todas as etapas</SelectItem>
                    {filteredStages.map((stage) => (
                      <SelectItem key={stage.id} value={String(stage.id)}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tarefa</Label>
                <Select
                  value={taskId || ALL_VALUE}
                  onValueChange={(value) =>
                    setTaskId(value === ALL_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as tarefas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Todas as tarefas</SelectItem>
                    {filteredTasks.map((task) => (
                      <SelectItem key={task.id} value={String(task.id)}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activity && activity.length > 0 ? (
              <div className="max-h-[28rem] overflow-y-auto pr-1">
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {activity.map((item) => (
                  <div
                    key={item.id}
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-card shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm relative z-10 transition-colors duration-200 group-hover:border-primary/50">
                      <div className="w-2 h-2 bg-primary rounded-full ring-4 ring-primary/10" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-lg border border-border bg-card shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), "dd MMM, HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                        <span className="font-medium text-sm">{item.summary}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.stageTitle && (
                            <Badge variant="outline" className="text-[10px]">
                              {item.stageTitle}
                            </Badge>
                          )}
                          {item.taskTitle && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.taskTitle}
                            </Badge>
                          )}
                        </div>
                        <Link
                          href={`/projects/${item.projectId}`}
                          className="text-xs text-primary hover:underline mt-1 block"
                        >
                          Ver projeto {item.projectTitle}
                        </Link>
                      </div>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                {hasActiveFilters
                  ? "Nenhuma ação encontrada com os filtros selecionados."
                  : "Nenhuma ação recente no seu histórico."}
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  );
}
