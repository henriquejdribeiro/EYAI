import type { Priority, Task, TeamMember, UserStory } from "../types";

interface Props {
  task: Task;
  story: UserStory;
  team: TeamMember[];
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const priorityColor: Record<Priority, string> = {
  low: "#34a853",
  medium: "#1a73e8",
  high: "#f9ab00",
  critical: "#d93025",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  const palette = ["#1a73e8", "#34a853", "#f9ab00", "#d93025", "#9c27b0", "#0097a7", "#5c6bc0", "#ef6c00"];
  return palette[Math.abs(hash) % palette.length];
}

export function TaskCard({ task, story, team, draggable, onDragStart, onDragEnd }: Props) {
  const assignee = team.find((m) => m.id === task.assignee_id) ?? null;
  const skillTag = assignee?.skills?.[0] ?? null;

  return (
    <div
      className={`kanban-card ${draggable ? "draggable" : ""}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      style={{ borderLeftColor: priorityColor[story.priority] }}
    >
      <div className="kanban-card-parent">
        {story.title}
      </div>
      <div className="kanban-card-title">{task.title}</div>
      <div className="kanban-card-tags">
        <span className="tag-pill" style={{ background: priorityColor[story.priority], color: "white" }}>
          {story.priority}
        </span>
        {skillTag && <span className="tag-pill subtle">{skillTag}</span>}
        <span className="tag-pill subtle">{story.story_points} pts</span>
      </div>
      <div className="kanban-card-footer">
        <span className="kanban-hours">{task.estimate_hours.toFixed(0)}h</span>
        {assignee ? (
          <span
            className="avatar"
            style={{ background: avatarColor(assignee.name) }}
            title={assignee.name}
          >
            {initials(assignee.name)}
          </span>
        ) : (
          <span className="avatar avatar-unassigned" title="Unassigned">?</span>
        )}
      </div>
    </div>
  );
}
