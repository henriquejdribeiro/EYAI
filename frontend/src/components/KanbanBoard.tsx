import { useMemo, useState } from "react";
import type { ProjectPlan, TaskStatus } from "../types";
import { TaskCard } from "./TaskCard";

interface Props {
  plan: ProjectPlan;
  mode: "auto" | "manual";
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
}

interface Column {
  status: TaskStatus;
  label: string;
  accent: string;
  background: string;
}

const COLUMNS: Column[] = [
  { status: "todo",         label: "To do",       accent: "#d93025", background: "#fce8e6" },
  { status: "in_progress",  label: "In progress", accent: "#1a73e8", background: "#e3f0fc" },
  { status: "blocked",      label: "Code review", accent: "#9c27b0", background: "#f3e5f5" },
  { status: "done",         label: "Done",        accent: "#137333", background: "#e6f4ea" },
];

// The data model exposes 4 statuses (todo / in_progress / blocked / done).
// We label "blocked" as "Code review" in the kanban because it maps to the
// EY-style 4-column board the user asked for.

export function KanbanBoard({ plan, mode, onTaskStatusChange }: Props) {
  const [selectedSprintId, setSelectedSprintId] = useState(plan.sprints[0]?.id ?? "");
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [dragging, setDragging] = useState(false);

  const selectedSprint = plan.sprints.find((s) => s.id === selectedSprintId) ?? plan.sprints[0];

  const storyMap = useMemo(
    () => Object.fromEntries(plan.user_stories.map((s) => [s.id, s])),
    [plan.user_stories],
  );

  const sprintStories = selectedSprint
    ? selectedSprint.story_ids.map((id) => storyMap[id]).filter(Boolean)
    : [];

  const tasksByStatus: Record<TaskStatus, Array<{ task: typeof sprintStories[number]["tasks"][number]; storyId: string }>> = {
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
  };

  for (const story of sprintStories) {
    for (const task of story.tasks) {
      tasksByStatus[task.status].push({ task, storyId: story.id });
    }
  }

  const totalPoints = sprintStories.reduce((acc, s) => acc + s.story_points, 0);
  const totalHours = sprintStories.reduce(
    (acc, s) => acc + s.tasks.reduce((a, t) => a + t.estimate_hours, 0),
    0,
  );

  function handleDrop(status: TaskStatus, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOverStatus(null);
    if (mode !== "manual") return;
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) onTaskStatusChange(taskId, status);
  }

  return (
    <div className="kanban-container">
      <div className="kanban-toolbar">
        <div className="kanban-toolbar-left">
          <label htmlFor="sprint-pick" className="kanban-toolbar-label">Sprint</label>
          <select
            id="sprint-pick"
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="kanban-sprint-select"
          >
            {plan.sprints.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedSprint && (
            <span className="kanban-sprint-summary">
              {sprintStories.length} stories · {totalPoints} pts · {totalHours.toFixed(0)}h
            </span>
          )}
        </div>
        {selectedSprint?.goal && (
          <div className="kanban-sprint-goal" title={selectedSprint.goal}>
            <strong>Goal:</strong> {selectedSprint.goal}
          </div>
        )}
      </div>

      <div className="kanban-columns">
        {COLUMNS.map((col) => {
          const items = tasksByStatus[col.status];
          const colPoints = items.reduce((acc, { storyId }) => acc + (storyMap[storyId]?.story_points ?? 0), 0);
          const isDropTarget = mode === "manual" && dragging && dragOverStatus === col.status;
          return (
            <div
              key={col.status}
              className={`kanban-column ${isDropTarget ? "drop-target" : ""}`}
              onDragOver={(e) => {
                if (mode !== "manual") return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStatus(col.status);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => handleDrop(col.status, e)}
            >
              <div
                className="kanban-column-header"
                style={{ background: col.background, color: col.accent }}
              >
                <span className="kanban-column-title">
                  {col.label} <span className="kanban-column-count">({items.length})</span>
                </span>
                <span className="kanban-column-points">{colPoints} pts</span>
              </div>
              <div className="kanban-column-body">
                {items.length === 0 && (
                  <div className="kanban-empty">
                    {mode === "manual" ? "Drag tasks here" : "No tasks"}
                  </div>
                )}
                {items.map(({ task, storyId }) => {
                  const story = storyMap[storyId];
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      story={story}
                      team={plan.team}
                      draggable={mode === "manual"}
                      onDragStart={() => setDragging(true)}
                      onDragEnd={() => { setDragging(false); setDragOverStatus(null); }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
