import type { ProjectPlan } from "../types";
import { StoryCard } from "./StoryCard";

interface Props {
  plan: ProjectPlan;
}

export function SprintBoard({ plan }: Props) {
  const storyMap = Object.fromEntries(plan.user_stories.map((s) => [s.id, s]));

  return (
    <div>
      <div className="summary-box">
        <h2>{plan.project_name}</h2>
        <p>{plan.summary}</p>
      </div>

      {plan.risks.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Risks identified</h3>
          <ul className="risk-list">
            {plan.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={`grid grid-${Math.min(plan.sprints.length, 3)}`}>
        {plan.sprints.map((sprint) => {
          const stories = sprint.story_ids.map((id) => storyMap[id]).filter(Boolean);
          const totalPoints = stories.reduce((sum, s) => sum + s.story_points, 0);
          const totalHours = stories.reduce(
            (sum, s) => sum + s.tasks.reduce((t, task) => t + task.estimate_hours, 0),
            0,
          );
          return (
            <div key={sprint.id} className="sprint-column">
              <h3>{sprint.name}</h3>
              <div className="sprint-goal">
                <strong>Goal:</strong> {sprint.goal || "—"}
              </div>
              <div className="story-meta" style={{ marginBottom: 12 }}>
                <span>{stories.length} stories</span>
                <span>·</span>
                <span>{totalPoints} pts</span>
                <span>·</span>
                <span>{totalHours.toFixed(0)}h</span>
              </div>
              {stories.map((s) => (
                <StoryCard key={s.id} story={s} team={plan.team} />
              ))}
              {stories.length === 0 && <div className="empty">No stories scheduled.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
