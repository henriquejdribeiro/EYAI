import { useEffect, useState } from "react";
import { ProjectInput } from "./components/ProjectInput";
import { SprintBoard } from "./components/SprintBoard";
import { TeamPanel } from "./components/TeamPanel";
import { generatePlan, getHealth, getTeam } from "./lib/api";
import type { HealthStatus, ProjectPlan, TeamMember } from "./types";

const SAMPLE_TEXT = `Modernize the customer self-service portal for a mid-sized retail bank.\n\nObjectives:\n- Reduce contact-center call volume by 25% within 6 months.\n- Allow customers to manage cards, limits, beneficiaries, and statements online.\n- Comply with PSD2 strong-customer-authentication.\n\nConstraints:\n- Legacy core banking via SOAP only; no direct DB access.\n- Mobile-first; WCAG AA accessibility mandatory.\n- 12-week delivery window.`;

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [projectText, setProjectText] = useState(SAMPLE_TEXT);
  const [projectName, setProjectName] = useState("Customer Portal Modernisation");
  const [sprintCount, setSprintCount] = useState(3);
  const [sprintLength, setSprintLength] = useState(14);
  const [plan, setPlan] = useState<ProjectPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    getTeam().then(setTeam).catch(() => setTeam([]));
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generatePlan({
        project_text: projectText,
        project_name: projectName,
        sprint_count: sprintCount,
        sprint_length_days: sprintLength,
        team,
      });
      setPlan(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">SA</div>
          <div>
            <h1>Scrum Agent</h1>
            <small>EY AI Challenge 2026 · Sprint planning, automated</small>
          </div>
        </div>
        <div className="row" style={{ flex: "0 0 auto" }}>
          {health && (
            <span className={`badge ${health.llm_mode === "claude" ? "live" : "mock"}`}>
              {health.llm_mode === "claude" ? `Live · ${health.model}` : "Mock mode"}
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        <ProjectInput
          text={projectText}
          onTextChange={setProjectText}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          sprintCount={sprintCount}
          onSprintCountChange={setSprintCount}
          sprintLength={sprintLength}
          onSprintLengthChange={setSprintLength}
          onGenerate={handleGenerate}
          loading={loading}
        />
        <TeamPanel team={team} onTeamChange={setTeam} />
      </div>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <span>Generating sprint plan…</span>
        </div>
      )}

      {plan && !loading && <SprintBoard plan={plan} />}

      {!plan && !loading && (
        <div className="card">
          <div className="empty">
            Enter a project brief above and click <strong>Generate Scrum plan</strong> to see user stories, tasks, and sprints.
          </div>
        </div>
      )}

      <footer style={{ marginTop: 40, textAlign: "center", color: "#747480", fontSize: "0.8rem" }}>
        Scrum Agent · Built for EY AI Challenge 2026 · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
