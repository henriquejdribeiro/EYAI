import { useEffect, useState } from "react";
import { BacklogView } from "./components/BacklogView";
import { GanttChart } from "./components/GanttChart";
import { KanbanBoard } from "./components/KanbanBoard";
import { ModeToggle, type Mode } from "./components/ModeToggle";
import { ProjectInput } from "./components/ProjectInput";
import { SampleDataPanel } from "./components/SampleDataPanel";
import { TeamAllocatorPanel } from "./components/TeamAllocatorPanel";
import { TeamPanel } from "./components/TeamPanel";
import { generatePlan, getHealth, getTeam } from "./lib/api";
import type { HealthStatus, ProjectPlan, TaskStatus, TeamMember } from "./types";

type BoardView = "backlog" | "kanban" | "gantt";

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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [boardView, setBoardView] = useState<BoardView>("backlog");

  function handleUseSampleBrief(text: string, name: string) {
    setProjectText(text);
    setProjectName(name);
    setPdfFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  function handleTaskStatusChange(taskId: string, status: TaskStatus) {
    setPlan((current) => {
      if (!current) return current;
      return {
        ...current,
        user_stories: current.user_stories.map((story) => ({
          ...story,
          tasks: story.tasks.map((task) =>
            task.id === taskId ? { ...task, status } : task,
          ),
        })),
      };
    });
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img src="/logo.svg" alt="ScrumAImaster" className="brand-logo" />
          <div>
            <h1>ScrumAImaster</h1>
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

      <SampleDataPanel onUseBrief={handleUseSampleBrief} />

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
          pdfFile={pdfFile}
          onPdfFileChange={setPdfFile}
          loading={loading}
        />
        <TeamPanel team={team} onTeamChange={setTeam} />
      </div>

      <TeamAllocatorPanel
        team={team}
        currentProjectText={projectText}
        currentProjectName={projectName}
        onApplyTeam={setTeam}
      />

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <span>Generating sprint plan…</span>
        </div>
      )}

      {plan && !loading && (
        <>
          <div className="summary-box">
            <h2>{plan.project_name}</h2>
            <p>{plan.summary}</p>
          </div>
          {plan.risks.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Risks identified</h3>
              <ul className="risk-list">
                {plan.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          <ModeToggle mode={mode} onChange={setMode} />

          <div className="view-tabs">
            <button
              className={`view-tab ${boardView === "backlog" ? "active" : ""}`}
              onClick={() => setBoardView("backlog")}
            >
              Backlog
            </button>
            <button
              className={`view-tab ${boardView === "kanban" ? "active" : ""}`}
              onClick={() => setBoardView("kanban")}
            >
              Board (kanban)
            </button>
            <button
              className={`view-tab ${boardView === "gantt" ? "active" : ""}`}
              onClick={() => setBoardView("gantt")}
            >
              Timeline (Gantt)
            </button>
          </div>

          {boardView === "backlog" && <BacklogView plan={plan} />}
          {boardView === "kanban" && (
            <KanbanBoard plan={plan} mode={mode} onTaskStatusChange={handleTaskStatusChange} />
          )}
          {boardView === "gantt" && <GanttChart plan={plan} />}
        </>
      )}

      {!plan && !loading && (
        <div className="card">
          <div className="empty">
            Enter a project brief above and click <strong>Generate Scrum plan</strong> to see user stories, tasks, and sprints.
          </div>
        </div>
      )}

      <footer style={{ marginTop: 40, textAlign: "center", color: "#747480", fontSize: "0.8rem" }}>
        ScrumAImaster · Built for EY AI Challenge 2026 · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
