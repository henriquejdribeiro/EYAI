import type { TeamMember, UserStory } from "../types";

interface Props {
  story: UserStory;
  team: TeamMember[];
}

function assigneeName(id: string | null | undefined, team: TeamMember[]): string {
  if (!id) return "Unassigned";
  return team.find((m) => m.id === id)?.name ?? "Unknown";
}

export function StoryCard({ story, team }: Props) {
  return (
    <div className={`story-card priority-${story.priority}`}>
      <div className="story-meta">
        <span className={`priority ${story.priority}`}>{story.priority}</span>
        <span>{story.story_points} pts</span>
        <span>·</span>
        <span>{story.tasks.length} task{story.tasks.length === 1 ? "" : "s"}</span>
      </div>
      <h4>{story.title}</h4>
      <p className="story-narrative">
        As a <strong>{story.as_a}</strong>, I want <strong>{story.i_want}</strong>, so that {story.so_that}.
      </p>
      {story.acceptance_criteria.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "#404049" }}>
            {story.acceptance_criteria.length} acceptance criteria
          </summary>
          <ul className="ac-list">
            {story.acceptance_criteria.map((ac, i) => (
              <li key={i}>{ac}</li>
            ))}
          </ul>
        </details>
      )}
      {story.tasks.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "#404049", marginTop: 4 }}>
            Tasks
          </summary>
          <ul className="task-list">
            {story.tasks.map((t) => (
              <li key={t.id}>
                <span className="assignee-dot" />
                <strong>{t.title}</strong> — {t.estimate_hours}h · {assigneeName(t.assignee_id, team)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
