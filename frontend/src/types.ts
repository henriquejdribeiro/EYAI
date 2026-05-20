export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  capacity_hours_per_sprint: number;
  seniority?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  estimate_hours: number;
  assignee_id?: string | null;
  status: TaskStatus;
}

export interface UserStory {
  id: string;
  title: string;
  as_a: string;
  i_want: string;
  so_that: string;
  acceptance_criteria: string[];
  story_points: number;
  priority: Priority;
  tasks: Task[];
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  start_date?: string | null;
  end_date?: string | null;
  story_ids: string[];
}

export interface ProjectPlan {
  project_name: string;
  summary: string;
  risks: string[];
  user_stories: UserStory[];
  sprints: Sprint[];
  team: TeamMember[];
  used_mock: boolean;
}

export interface HealthStatus {
  status: string;
  llm_mode: "claude" | "mock";
  model: string;
}
