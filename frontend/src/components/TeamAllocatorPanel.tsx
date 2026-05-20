import { useEffect, useMemo, useState } from "react";
import {
  allocateTeam,
  downloadAllocatePdf,
  downloadRecommendPdf,
  fetchSampleText,
  listSamples,
  recommendTeam,
  type AllocateProjectInput,
  type AllocateResponse,
  type RecommendResponse,
  type SampleProject,
} from "../lib/api";
import type { TeamMember } from "../types";

interface Props {
  team: TeamMember[];
  currentProjectText: string;
  currentProjectName: string;
  onApplyTeam: (members: TeamMember[]) => void;
}

type Mode = "single" | "multi";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const palette = ["#1a73e8", "#34a853", "#f9ab00", "#d93025", "#9c27b0", "#0097a7", "#5c6bc0", "#ef6c00"];
  return palette[Math.abs(h) % palette.length];
}

export function TeamAllocatorPanel({ team, currentProjectText, currentProjectName, onApplyTeam }: Props) {
  const [mode, setMode] = useState<Mode>("single");
  const [samples, setSamples] = useState<SampleProject[]>([]);

  // Single-project mode state
  const [singleSource, setSingleSource] = useState<string>("__current__");
  const [singleResult, setSingleResult] = useState<RecommendResponse | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleInput, setSingleInput] = useState<{ text: string; name: string } | null>(null);
  const [singlePdfLoading, setSinglePdfLoading] = useState(false);

  // Multi-project mode state
  const [multiResult, setMultiResult] = useState<AllocateResponse | null>(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [minPerProject, setMinPerProject] = useState(4);
  const [multiInput, setMultiInput] = useState<AllocateProjectInput[] | null>(null);
  const [multiPdfLoading, setMultiPdfLoading] = useState(false);

  useEffect(() => {
    listSamples().then(setSamples).catch(() => setSamples([]));
  }, []);

  async function runSingle() {
    setSingleLoading(true);
    setSingleError(null);
    setSingleResult(null);
    try {
      let text = currentProjectText;
      let name = currentProjectName;
      if (singleSource !== "__current__") {
        const res = await fetchSampleText(singleSource);
        text = res.text;
        name = singleSource;
      }
      if (!text.trim()) {
        throw new Error("No project text available.");
      }
      const result = await recommendTeam({
        project_text: text,
        project_name: name,
        team,
        top_n: 6,
      });
      setSingleResult(result);
      setSingleInput({ text, name });
    } catch (err) {
      setSingleError(String(err));
    } finally {
      setSingleLoading(false);
    }
  }

  async function downloadSinglePdf() {
    if (!singleInput) return;
    setSinglePdfLoading(true);
    setSingleError(null);
    try {
      await downloadRecommendPdf({
        project_text: singleInput.text,
        project_name: singleInput.name,
        team,
        top_n: 6,
      });
    } catch (err) {
      setSingleError(String(err));
    } finally {
      setSinglePdfLoading(false);
    }
  }

  async function runMulti() {
    setMultiLoading(true);
    setMultiError(null);
    setMultiResult(null);
    try {
      if (samples.length < 2) {
        throw new Error("Need at least 2 sample projects to allocate.");
      }
      const projects = await Promise.all(
        samples.map(async (s) => {
          const res = await fetchSampleText(s.key);
          return { key: s.key, name: s.filename.replace(/\.pdf$/i, ""), text: res.text };
        }),
      );
      const result = await allocateTeam({ projects, team, min_per_project: minPerProject });
      setMultiResult(result);
      setMultiInput(projects);
    } catch (err) {
      setMultiError(String(err));
    } finally {
      setMultiLoading(false);
    }
  }

  async function downloadMultiPdf() {
    if (!multiInput) return;
    setMultiPdfLoading(true);
    setMultiError(null);
    try {
      await downloadAllocatePdf({ projects: multiInput, team, min_per_project: minPerProject });
    } catch (err) {
      setMultiError(String(err));
    } finally {
      setMultiPdfLoading(false);
    }
  }

  const sourceOptions = useMemo(() => {
    const base = [{ value: "__current__", label: `Current brief: ${currentProjectName || "(none)"}` }];
    return [...base, ...samples.map((s) => ({ value: s.key, label: s.filename }))];
  }, [samples, currentProjectName]);

  return (
    <div className="card allocator-panel">
      <div className="allocator-header">
        <div>
          <h2 style={{ margin: 0 }}>Team allocator</h2>
          <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#747480" }}>
            Who should work on what — Modo 1 picks the best team for one project, Modo 2 distributes the full roster across all three EY projects.
          </p>
        </div>
      </div>

      <div className="allocator-tabs">
        <button
          className={`allocator-tab ${mode === "single" ? "active" : ""}`}
          onClick={() => setMode("single")}
        >
          Modo 1 · Single project (best team)
        </button>
        <button
          className={`allocator-tab ${mode === "multi" ? "active" : ""}`}
          onClick={() => setMode("multi")}
        >
          Modo 2 · Three projects (best distribution)
        </button>
      </div>

      {mode === "single" && (
        <div className="allocator-body">
          <div className="row" style={{ alignItems: "flex-end", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="single-source">Project</label>
              <select
                id="single-source"
                value={singleSource}
                onChange={(e) => setSingleSource(e.target.value)}
              >
                {sourceOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={runSingle}
              disabled={singleLoading || team.length === 0}
              style={{ flex: "0 0 auto" }}
            >
              {singleLoading ? "Scoring…" : "Recommend team"}
            </button>
          </div>

          {singleError && <div className="error" style={{ marginTop: 12 }}>{singleError}</div>}

          {singleResult && (
            <div style={{ marginTop: 16 }}>
              <div className="alloc-summary">
                <span><strong>{singleResult.recommended.length}</strong> recommended members</span>
                <span><strong>{singleResult.recommended_team_capacity}h</strong> total capacity per sprint</span>
                <span className="alloc-keywords">
                  Matched against: {singleResult.project_keywords.slice(0, 8).join(", ")}…
                </span>
              </div>

              <div className="alloc-ranked">
                {singleResult.ranked.map((item, idx) => {
                  const isRecommended = idx < singleResult.recommended.length;
                  const pct = Math.round((item.normalized ?? 0) * 100);
                  return (
                    <div key={item.member.id} className={`alloc-row ${isRecommended ? "is-recommended" : ""}`}>
                      <span
                        className="avatar avatar-sm"
                        style={{ background: avatarColor(item.member.name) }}
                      >
                        {initials(item.member.name)}
                      </span>
                      <div className="alloc-row-main">
                        <div className="alloc-row-name">
                          {item.member.name} <span className="alloc-row-role">· {item.member.role}</span>
                        </div>
                        <div className="alloc-row-matched">
                          {item.matched_terms.length > 0
                            ? item.matched_terms.map((t) => <span key={t} className="chip">{t}</span>)
                            : <span style={{ color: "#9aa0a6", fontSize: "0.75rem" }}>no skill overlap</span>}
                        </div>
                      </div>
                      <div className="alloc-bar-wrap">
                        <div className="alloc-bar"><div className="alloc-bar-fill" style={{ width: `${pct}%` }} /></div>
                        <span className="alloc-score">{item.score.toFixed(0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="row" style={{ marginTop: 16, gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => onApplyTeam(singleResult.recommended.map((r) => r.member))}
                  style={{ flex: "0 0 auto" }}
                >
                  Apply recommended team to roster
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={downloadSinglePdf}
                  disabled={singlePdfLoading}
                  style={{ flex: "0 0 auto" }}
                >
                  {singlePdfLoading ? "Building PDF…" : "Download PDF report"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "multi" && (
        <div className="allocator-body">
          <div className="row" style={{ alignItems: "flex-end", gap: 12 }}>
            <div>
              <label htmlFor="min-per-project">Min members per project</label>
              <input
                id="min-per-project"
                type="number"
                min={1}
                max={10}
                value={minPerProject}
                onChange={(e) => setMinPerProject(parseInt(e.target.value) || 1)}
                style={{ width: 100 }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={runMulti}
              disabled={multiLoading || samples.length < 2}
              style={{ flex: "0 0 auto" }}
            >
              {multiLoading ? "Allocating…" : `Distribute ${team.length} members across ${samples.length} projects`}
            </button>
          </div>

          {multiError && <div className="error" style={{ marginTop: 12 }}>{multiError}</div>}

          {multiResult && (
            <div style={{ marginTop: 16 }}>
              <div className="alloc-summary">
                <span><strong>{multiResult.total_members}</strong> members allocated</span>
                <span><strong>{Object.keys(multiResult.assignments).length}</strong> projects</span>
                <span className="alloc-keywords">Algorithm: {multiResult.algorithm}</span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <button
                  className="btn btn-ghost"
                  onClick={downloadMultiPdf}
                  disabled={multiPdfLoading}
                >
                  {multiPdfLoading ? "Building PDF…" : "Download PDF report"}
                </button>
              </div>

              <div className="alloc-multi-grid">
                {Object.entries(multiResult.assignments).map(([key, info]) => (
                  <div key={key} className="alloc-project-column">
                    <div className="alloc-project-header">
                      <strong>{info.name}</strong>
                      <span className="alloc-project-meta">
                        {info.members.length} members · {info.total_capacity_hours}h · avg score {info.avg_score.toFixed(1)}
                      </span>
                    </div>
                    {info.members.map((m) => (
                      <div key={m.member.id} className="alloc-mini-row">
                        <span
                          className="avatar avatar-sm"
                          style={{ background: avatarColor(m.member.name) }}
                        >
                          {initials(m.member.name)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="alloc-mini-name">{m.member.name}</div>
                          <div className="alloc-mini-role">{m.member.role}</div>
                          {m.matched_terms.length > 0 && (
                            <div className="alloc-mini-matched">
                              {m.matched_terms.slice(0, 4).map((t) => <span key={t} className="chip">{t}</span>)}
                            </div>
                          )}
                        </div>
                        <span className="alloc-score-pill">{m.score.toFixed(0)}</span>
                      </div>
                    ))}
                    {info.members.length === 0 && <div className="empty">No members assigned.</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
