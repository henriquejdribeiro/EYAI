import type { Priority, ProjectPlan, TeamMember, UserStory } from "../types";

interface Props {
  story: UserStory;
  plan: ProjectPlan;
  onClose: () => void;
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

function findMember(id: string | null | undefined, team: TeamMember[]): TeamMember | null {
  return id ? team.find((m) => m.id === id) ?? null : null;
}

export function StoryDetailPanel({ story, plan, onClose }: Props) {
  const parentSprint = plan.sprints.find((s) => s.story_ids.includes(story.id));
  const assignees = [...new Set(story.tasks.map((t) => t.assignee_id).filter(Boolean) as string[])]
    .map((id) => findMember(id, plan.team))
    .filter(Boolean) as TeamMember[];
  const totalHours = story.tasks.reduce((acc, t) => acc + t.estimate_hours, 0);

  return (
    <aside className="story-detail-panel">
      <div className="detail-toolbar">
        <div className="detail-breadcrumb">
          <span className="detail-id">{story.id.slice(0, 6).toUpperCase()}</span>
          <span className="detail-crumb-sep">/</span>
          <span>{parentSprint?.name ?? "Backlog"}</span>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close detail panel">×</button>
      </div>

      <h2 className="detail-title">{story.title}</h2>

      <section className="detail-section">
        <h4>Description</h4>
        <p className="detail-narrative">
          As a <strong>{story.as_a}</strong>, I want <strong>{story.i_want}</strong>, so that {story.so_that}.
        </p>
      </section>

      {story.acceptance_criteria.length > 0 && (
        <section className="detail-section">
          <h4>Acceptance criteria</h4>
          <ul className="detail-list">
            {story.acceptance_criteria.map((ac, i) => <li key={i}>{ac}</li>)}
          </ul>
        </section>
      )}

      {story.tasks.length > 0 && (
        <section className="detail-section">
          <h4>Tasks ({story.tasks.length})</h4>
          <div className="detail-task-list">
            {story.tasks.map((task) => {
              const assignee = findMember(task.assignee_id, plan.team);
              return (
                <div key={task.id} className="detail-task-row">
                  <div className="detail-task-main">
                    <div className="detail-task-title">{task.title}</div>
                    {task.description && (
                      <div className="detail-task-desc">{task.description}</div>
                    )}
                  </div>
                  <div className="detail-task-meta">
                    <span className={`status-pill status-${task.status}`}>{STATUS_LABEL[task.status] ?? task.status}</span>
                    <span className="detail-task-hours">{task.estimate_hours.toFixed(0)}h</span>
                    {assignee ? (
                      <span className="avatar avatar-sm" style={{ background: avatarColor(assignee.name) }} title={assignee.name}>
                        {initials(assignee.name)}
                      </span>
                    ) : (
                      <span className="avatar avatar-sm avatar-unassigned" title="Unassigned">?</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="detail-section detail-meta-grid">
        <h4>Details</h4>
        <dl>
          <dt>Assignees</dt>
          <dd>
            {assignees.length === 0 && <span style={{ color: "#747480" }}>Unassigned</span>}
            <div className="detail-assignees">
              {assignees.map((m) => (
                <span key={m.id} className="detail-assignee">
                  <span className="avatar avatar-sm" style={{ background: avatarColor(m.name) }}>{initials(m.name)}</span>
                  <span>{m.name}<span className="detail-assignee-role"> · {m.role}</span></span>
                </span>
              ))}
            </div>
          </dd>

          <dt>Priority</dt>
          <dd>
            <span className="status-pill" style={{ background: priorityColor[story.priority], color: "white" }}>
              {story.priority}
            </span>
          </dd>

          <dt>Story points</dt>
          <dd>{story.story_points}</dd>

          <dt>Estimated effort</dt>
          <dd>{totalHours.toFixed(0)}h</dd>

          <dt>Sprint</dt>
          <dd>{parentSprint?.name ?? "Unassigned"}</dd>

          {parentSprint?.start_date && parentSprint?.end_date && (
            <>
              <dt>Sprint dates</dt>
              <dd>{parentSprint.start_date} → {parentSprint.end_date}</dd>
            </>
          )}
        </dl>
      </section>
    </aside>
  );
}
