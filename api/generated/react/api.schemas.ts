
export interface HealthStatus {
  status: string;
}

export type OrganizationType = typeof OrganizationType[keyof typeof OrganizationType];


export const OrganizationType = {
  empresa: 'empresa',
  ente_publico: 'ente_publico',
} as const;

export interface Organization {
  id: number;
  name: string;
  type: OrganizationType;
  createdAt: string;
}

export interface OrganizationInput {
  /** @minLength 1 */
  name: string;
  type: OrganizationType;
}

export interface OrganizationUpdate {
  /** @minLength 1 */
  name?: string;
  type?: OrganizationType;
}

export type UserRole = typeof UserRole[keyof typeof UserRole];


export const UserRole = {
  admin: 'admin',
  gestor: 'gestor',
  membro: 'membro',
} as const;

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** @nullable */
  organizationId: number | null;
  organization?: Organization | null;
  /** @nullable */
  avatarUrl?: string | null;
  createdAt: string;
}

export interface UserProfileUpdate {
  /** @minLength 1 */
  name?: string;
  /** @nullable */
  organizationId?: number | null;
  /** @nullable */
  avatarUrl?: string | null;
}

export interface UserRoleUpdate {
  role: UserRole;
}

export interface AuthLoginInput {
  email: string;
  /** @minLength 8 */
  password: string;
}

export interface AuthRegisterInput {
  /** @minLength 1 */
  name: string;
  email: string;
  /** @minLength 8 */
  password: string;
}

export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];


export const ProjectStatus = {
  planejamento: 'planejamento',
  em_andamento: 'em_andamento',
  pausado: 'pausado',
  concluido: 'concluido',
  cancelado: 'cancelado',
} as const;

export type ProjectPriority = typeof ProjectPriority[keyof typeof ProjectPriority];


export const ProjectPriority = {
  baixa: 'baixa',
  media: 'media',
  alta: 'alta',
  urgente: 'urgente',
} as const;

export interface Project {
  id: number;
  title: string;
  /** @nullable */
  description?: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  empresaOrgId: number;
  entePublicoOrgId: number;
  createdByUserId: number;
  /** @nullable */
  dueDate?: string | null;
  createdAt: string;
}

export interface ProjectInput {
  /** @minLength 1 */
  title: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  empresaOrgId: number;
  entePublicoOrgId: number;
  dueDate?: string;
}

export interface ProjectUpdate {
  /** @minLength 1 */
  title?: string;
  /** @nullable */
  description?: string | null;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  /** @nullable */
  dueDate?: string | null;
}

export interface Stage {
  id: number;
  projectId: number;
  name: string;
  order: number;
  status: ProjectStatus;
  /** @nullable */
  dueDate?: string | null;
  createdAt: string;
}

export interface StageInput {
  /** @minLength 1 */
  name: string;
  order?: number;
  status?: ProjectStatus;
  dueDate?: string;
}

export interface StageUpdate {
  /** @minLength 1 */
  name?: string;
  status?: ProjectStatus;
  /** @nullable */
  dueDate?: string | null;
}

export interface StageReorder {
  order: number;
}

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];


export const TaskStatus = {
  a_fazer: 'a_fazer',
  em_andamento: 'em_andamento',
  em_revisao: 'em_revisao',
  concluida: 'concluida',
} as const;

export interface Task {
  id: number;
  stageId: number;
  projectId: number;
  title: string;
  /** @nullable */
  description?: string | null;
  status: TaskStatus;
  priority: ProjectPriority;
  /** @nullable */
  assigneeUserId?: number | null;
  /** @nullable */
  dueDate?: string | null;
  createdAt: string;
}

export interface TaskInput {
  /** @minLength 1 */
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: ProjectPriority;
  /** @nullable */
  assigneeUserId?: number | null;
  dueDate?: string;
}

export interface TaskUpdate {
  /** @minLength 1 */
  title?: string;
  /** @nullable */
  description?: string | null;
  status?: TaskStatus;
  priority?: ProjectPriority;
  /** @nullable */
  assigneeUserId?: number | null;
  /** @nullable */
  dueDate?: string | null;
}

export interface TaskMove {
  stageId: number;
}

export interface Comment {
  id: number;
  /** @nullable */
  projectId?: number | null;
  /** @nullable */
  taskId?: number | null;
  authorUserId: number;
  content: string;
  createdAt: string;
}

export interface CommentInput {
  projectId?: number;
  taskId?: number;
  /** @minLength 1 */
  content: string;
}

export type ProjectSummaryTasksByStatus = {[key: string]: number};

export interface ProjectSummary {
  projectId: number;
  totalStages: number;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  tasksByStatus: ProjectSummaryTasksByStatus;
}

export interface ProjectDetail {
  project: Project;
  stages: Stage[];
  tasks: Task[];
}

export type DashboardSummaryProjectsByStatus = {[key: string]: number};

export interface DashboardSummary {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  projectsByStatus: DashboardSummaryProjectsByStatus;
}

export type ActivityType = typeof ActivityType[keyof typeof ActivityType];


export const ActivityType = {
  project_created: 'project_created',
  project_updated: 'project_updated',
  stage_created: 'stage_created',
  stage_updated: 'stage_updated',
  task_created: 'task_created',
  task_updated: 'task_updated',
  task_completed: 'task_completed',
  comment_created: 'comment_created',
} as const;

export interface ActivityItem {
  id: string;
  type: ActivityType;
  projectId: number;
  projectTitle: string;
  /** @nullable */
  taskId?: number | null;
  /** @nullable */
  taskTitle?: string | null;
  actorUserId: number;
  summary?: string;
  createdAt: string;
}

export type ListProjectsParams = {
status?: ProjectStatus;
};

export type ListCommentsParams = {
projectId?: number;
taskId?: number;
};

export type GetDashboardActivityParams = {
limit?: number;
};

