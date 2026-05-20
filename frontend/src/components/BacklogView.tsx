import { useState } from "react";
import type { Priority, ProjectPlan, Sprint, TeamMember, UserStory } from "../types";
import { StoryDetailPanel } from "./StoryDetailPanel";

interface Props {
  plan: ProjectPlan;
}

const priorityColor: Record<Priority, string> = {
  low: "#34a853",
  medium: "#1a73e8",
  high: "#f9ab00",
  critical: "#d93025",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Code review",
  done: "Done",
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const palette = ["#1a73e8", "#34a853", "#f9ab00", "#d93025", "#9c27b0", "#0097a7", "#5c6bc0", "#ef6c00"];
  return palette[Math.abs(h) % palette.length];
}

function primaryStatus(story: UserStory): string {
  // Aggregate task statuses to a single "dominant" status for the row pill.
  const counts: Record<string, number> = {};
  for (const t of story.tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  if (story.tasks.length === 0) return "todo";
  if ((counts.done ?? 0) === story.tasks.length) return "done";
  if ((counts.in_progress ?? 0) + (counts.blocked ?? 0) > 0) return "in_progress";
  return "todo";
}

function primaryAssignee(story: UserStory, team: TeamMember[]): TeamMember | null {
  const counts = new Map<string, number>();
  for (const t of story.tasks) {
    if (t.assignee_id) counts.set(t.assignee_id, (counts.get(t.assignee_id) ?? 0) + 1);
  }
  let bestId: string | null = null;
  let best = 0;
  for (const [id, c] of counts) {
    if (c > best) { best = c; bestId = id; }
  }
  return bestId ? team.find((m) => m.id === bestId) ?? null : null;
}

interface SprintGroupProps {
  sprint: Sprint;
  stories: UserStory[];
  team: TeamMember[];
  selectedStoryId: string | null;
  onSelectStory: (id: string) => void;
}

function SprintGroup({ sprint, stories, team, selectedStoryId, onSelectStory }: SprintGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const points = stories.reduce((acc, s) => acc + s.story_points, 0);
  const counts = stories.reduce(
    (acc, s) => {
      const st = primaryStatus(s);
      if (st === "done") acc.done++;
      else if (st === "in_progress") acc.inProgress++;
      else acc.todo++;
      return acc;
    },
    { todo: 0, inProgress: 0, done: 0 },
  );

  return (
    <div className="backlog-sprint">
      <button className="backlog-sprint-header" onClick={() => setExpanded((v) => !v)}>
        <span className={`disclosure ${expanded ? "open" : ""}`}>▸</span>
        <span className="backlog-sprint-name">{sprint.name}</span>
        <span className="backlog-sprint-dates">
          {sprint.start_date} – {sprint.end_date}
        </span>
        <span className="backlog-sprint-count">({stories.length} stories)</span>
        <span className="backlog-sprint-pills">
          <span className="count-pill count-todo" title="To do">{counts.todo}</span>
          <span className="count-pill count-progress" title="In progress">{counts.inProgress}</span>
          <span className="count-pill count-done" title="Done">{counts.done}</span>
        </span>
        <span className="backlog-sprint-points">{points} pts</span>
      </button>
      {sprint.goal && expanded && (
        <div className="backlog-sprint-goal">
          <strong>Goal:</strong> {sprint.goal}
        </div>
      )}
      {expanded && (
        <div className="backlog-rows">
          {stories.length === 0 && <div className="empty">No stories in this sprint.</div>}
          {stories.map((story) => {
            const assignee = primaryAssignee(story, team);
            const status = primaryStatus(story);
            return (
              <button
                key={story.id}
                className={`backlog-row ${selectedStoryId === story.id ? "selected" : ""}`}
                onClick={() => onSelectStory(story.id)}
              >
                <span
                  className="backlog-type-icon"
                  style={{ background: priorityColor[story.priority] }}
                  title={`Priority: ${story.priority}`}
                />
                <span className="backlog-row-id">{story.id.slice(0, 6).toUpperCase()}</span>
                <span className="backlog-row-title">{story.title}</span>
                <span className={`status-pill status-${status}`}>{STATUS_LABEL[status]}</span>
                <span className="backlog-row-points">{story.story_points}</span>
                {assignee ? (
                  <span className="avatar avatar-sm" style={{ background: avatarColor(assignee.name) }} title={assignee.name}>
                    {initials(assignee.name)}
                  </span>
                ) : (
                  <span className="avatar avatar-sm avatar-unassigned" title="Unassigned">?</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BacklogView({ plan }: Props) {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const storyMap = Object.fromEntries(plan.user_stories.map((s) => [s.id, s]));
  const selectedStory = selectedStoryId ? storyMap[selectedStoryId] : null;

  return (
    <div className={`backlog-layout ${selectedStory ? "with-detail" : ""}`}>
      <div className="backlog-main">
        {plan.sprints.map((sprint) => {
          const stories = sprint.story_ids.map((id) => storyMap[id]).filter(Boolean);
          return (
            <SprintGroup
              key={sprint.id}
              sprint={sprint}
              stories={stories}
              team={plan.team}
              selectedStoryId={selectedStoryId}
              onSelectStory={setSelectedStoryId}
            />
          );
        })}
      </div>
      {selectedStory && (
        <StoryDetailPanel
          story={selectedStory}
          plan={plan}
          onClose={() => setSelectedStoryId(null)}
        />
      )}
    </div>
  );
}
