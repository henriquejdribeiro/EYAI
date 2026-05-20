import { useMemo } from "react";
import type { ProjectPlan, TeamMember, UserStory } from "../types";

interface Props {
  plan: ProjectPlan;
}

interface SprintRow {
  sprintId: string;
  sprintName: string;
  goal: string;
  startWeek: number;   // 1-based, inclusive
  endWeek: number;     // inclusive
  stories: UserStory[];
}

const SPRINT_COLORS = [
  "#2e4a76", // EY-style navy
  "#1a73e8",
  "#137333",
  "#b06000",
  "#9c27b0",
];

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

function uniqueAssignees(story: UserStory, team: TeamMember[]): TeamMember[] {
  const ids = new Set(story.tasks.map((t) => t.assignee_id).filter(Boolean) as string[]);
  return [...ids].map((id) => team.find((m) => m.id === id)).filter(Boolean) as TeamMember[];
}

export function GanttChart({ plan }: Props) {
  const sprintLengthDays = useMemo(() => {
    if (plan.sprints.length < 1) return 14;
    const s = plan.sprints[0];
    if (!s.start_date || !s.end_date) return 14;
    const start = new Date(s.start_date).getTime();
    const end = new Date(s.end_date).getTime();
    return Math.max(7, Math.round((end - start) / 86_400_000) + 1);
  }, [plan.sprints]);

  const sprintWeeks = Math.max(1, Math.ceil(sprintLengthDays / 7));

  const storyMap = useMemo(
    () => Object.fromEntries(plan.user_stories.map((s) => [s.id, s])),
    [plan.user_stories],
  );

  const rows: SprintRow[] = plan.sprints.map((sprint, i) => ({
    sprintId: sprint.id,
    sprintName: sprint.name,
    goal: sprint.goal,
    startWeek: i * sprintWeeks + 1,
    endWeek: (i + 1) * sprintWeeks,
    stories: sprint.story_ids.map((sid) => storyMap[sid]).filter(Boolean),
  }));

  const totalWeeks = Math.max(1, rows[rows.length - 1]?.endWeek ?? 1);
  const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  // Final-delivery milestone in the last week
  return (
    <div className="gantt-container">
      <div className="gantt-header">
        <div className="gantt-row-label">Phase / Story</div>
        <div className="gantt-grid" style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(60px, 1fr))` }}>
          {weekNumbers.map((w) => (
            <div key={w} className="gantt-week-cell">Week {w}</div>
          ))}
        </div>
      </div>

      <div className="gantt-body">
        {rows.map((row, sprintIdx) => {
          const color = SPRINT_COLORS[sprintIdx % SPRINT_COLORS.length];
          const span = row.endWeek - row.startWeek + 1;
          return (
            <div key={row.sprintId} className="gantt-sprint-group">
              {/* Sprint summary row */}
              <div className="gantt-row gantt-row-sprint">
                <div className="gantt-row-label">
                  <strong>{row.sprintName}</strong>
                  {row.goal && <div className="gantt-row-sublabel">{row.goal}</div>}
                </div>
                <div className="gantt-grid" style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(60px, 1fr))` }}>
                  <div
                    className="gantt-bar gantt-bar-summary"
                    style={{
                      gridColumn: `${row.startWeek} / span ${span}`,
                      background: color,
                    }}
                  >
                    <span className="gantt-bar-text">
                      {row.sprintName} · weeks {row.startWeek}–{row.endWeek}
                    </span>
                  </div>
                </div>
              </div>

              {/* One story per row inside the sprint */}
              {row.stories.map((story) => {
                const assignees = uniqueAssignees(story, plan.team);
                const lead = primaryAssignee(story, plan.team);
                return (
                  <div key={story.id} className="gantt-row">
                    <div className="gantt-row-label">
                      <div className="gantt-story-title" title={story.title}>{story.title}</div>
                      <div className="gantt-row-sublabel">
                        {lead ? lead.role : "Unassigned"} · {story.story_points} pts
                      </div>
                    </div>
                    <div className="gantt-grid" style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(60px, 1fr))` }}>
                      <div
                        className="gantt-bar"
                        style={{
                          gridColumn: `${row.startWeek} / span ${span}`,
                          background: color,
                          opacity: 0.78,
                        }}
                      >
                        <div className="gantt-assignees">
                          {assignees.slice(0, 3).map((m) => (
                            <span
                              key={m.id}
                              className="avatar avatar-sm"
                              style={{ background: avatarColor(m.name) }}
                              title={`${m.name} — ${m.role}`}
                            >
                              {initials(m.name)}
                            </span>
                          ))}
                          {assignees.length > 3 && (
                            <span className="avatar avatar-sm avatar-more" title={`+${assignees.length - 3} more`}>
                              +{assignees.length - 3}
                            </span>
                          )}
                        </div>
                        <span className="gantt-bar-text gantt-bar-text-truncate">{story.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Final delivery milestone */}
        <div className="gantt-row gantt-row-milestone">
          <div className="gantt-row-label"><strong>Final delivery</strong></div>
          <div className="gantt-grid" style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(60px, 1fr))` }}>
            <div className="gantt-bar gantt-bar-milestone" style={{ gridColumn: `${totalWeeks} / span 1` }}>
              ★ Delivery
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
