import { kutmApi } from "../../lib/kutm";

export type TeamQueueMode = "role_default" | "customers" | "accounting" | "hybrid";

export type ActionCenterSavedView = {
  id: string;
  name: string;
  query: string;
  modules: string[];
  teams: string[];
  updatedAt: string;
};

export type ActionCenterPrefs = {
  savedViews: ActionCenterSavedView[];
  defaultViewId: string | null;
  teamQueueMode: TeamQueueMode;
  roleQueueOverrides: Record<string, TeamQueueMode>;
  updatedAt: string | null;
};

export type ActionCenterQueueItem = {
  id: string;
  module: string;
  queue: string;
  title: string;
  detail: string;
  status: string;
  priority: string;
  dueAt: string;
  owner: string;
  url: string;
};

export type ActionCenterQueue = {
  role: string;
  teamMode: string;
  summary: {
    customerTasks: number;
    accountingApprovals: number;
    accountingExceptions: number;
    accountingReviews: number;
  };
  items: ActionCenterQueueItem[];
};

type PrefsResponse = {
  saved_views: Array<{
    id: string;
    name: string;
    query: string;
    modules: string[];
    teams: string[];
    updated_at: string;
  }>;
  default_view_id?: string | null;
  team_queue_mode?: TeamQueueMode;
  role_queue_overrides?: Record<string, TeamQueueMode>;
  updated_at?: string | null;
};

type QueueResponse = {
  role: string;
  team_mode: string;
  summary: {
    customer_tasks: number;
    accounting_approvals: number;
    accounting_exceptions: number;
    accounting_reviews: number;
  };
  items: Array<{
    id: string;
    module: string;
    queue: string;
    title: string;
    detail: string;
    status: string;
    priority: string;
    due_at: string;
    owner: string;
    url: string;
  }>;
};

function mapPrefs(response: PrefsResponse): ActionCenterPrefs {
  return {
    savedViews: (response.saved_views ?? []).map((view) => ({
      id: view.id,
      name: view.name,
      query: view.query,
      modules: view.modules ?? ["customers", "accounting"],
      teams: view.teams ?? [],
      updatedAt: view.updated_at ?? "",
    })),
    defaultViewId: response.default_view_id ?? null,
    teamQueueMode: response.team_queue_mode ?? "role_default",
    roleQueueOverrides: response.role_queue_overrides ?? {},
    updatedAt: response.updated_at ?? null,
  };
}

export async function getActionCenterPrefs(): Promise<ActionCenterPrefs> {
  const response = await kutmApi.get<PrefsResponse>("/portal/prefs/action-center", undefined, true);
  return mapPrefs(response);
}

export async function saveActionCenterPrefs(input: Omit<ActionCenterPrefs, "updatedAt">): Promise<ActionCenterPrefs> {
  const response = await kutmApi.put<PrefsResponse>(
    "/portal/prefs/action-center",
    {
      saved_views: input.savedViews.map((view) => ({
        id: view.id,
        name: view.name,
        query: view.query,
        modules: view.modules,
        teams: view.teams,
        updated_at: view.updatedAt,
      })),
      default_view_id: input.defaultViewId,
      team_queue_mode: input.teamQueueMode,
      role_queue_overrides: input.roleQueueOverrides,
    },
    true,
  );
  return mapPrefs(response);
}

export async function getActionCenterQueue(mode?: TeamQueueMode): Promise<ActionCenterQueue> {
  const response = await kutmApi.get<QueueResponse>(
    "/portal/action-center/queue",
    {
      mode: mode && mode !== "role_default" ? mode : undefined,
      limit: 80,
    },
    true,
  );

  return {
    role: response.role,
    teamMode: response.team_mode,
    summary: {
      customerTasks: response.summary.customer_tasks,
      accountingApprovals: response.summary.accounting_approvals,
      accountingExceptions: response.summary.accounting_exceptions,
      accountingReviews: response.summary.accounting_reviews,
    },
    items: (response.items ?? []).map((item) => ({
      id: item.id,
      module: item.module,
      queue: item.queue,
      title: item.title,
      detail: item.detail,
      status: item.status,
      priority: item.priority,
      dueAt: item.due_at,
      owner: item.owner,
      url: item.url,
    })),
  };
}
