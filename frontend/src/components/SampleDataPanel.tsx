import { useEffect, useState } from "react";
import {
  fetchSampleText,
  fetchTeamRaw,
  listSamples,
  type SampleProject,
} from "../lib/api";

interface Props {
  onUseBrief: (projectText: string, projectName: string) => void;
}

export function SampleDataPanel({ onUseBrief }: Props) {
  const [open, setOpen] = useState(true);
  const [samples, setSamples] = useState<SampleProject[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [teamRaw, setTeamRaw] = useState<string>("");
  const [teamFilename, setTeamFilename] = useState<string>("");
  const [loadingBrief, setLoadingBrief] = useState<string | null>(null);
  const [view, setView] = useState<"projects" | "team">("projects");

  useEffect(() => {
    listSamples()
      .then((items) => {
        setSamples(items);
        if (items.length > 0) setActiveKey(items[0].key);
      })
      .catch(() => setSamples([]));
    fetchTeamRaw()
      .then((d) => {
        setTeamRaw(d.text);
        setTeamFilename(d.filename);
      })
      .catch(() => setTeamRaw(""));
  }, []);

  const active = samples.find((s) => s.key === activeKey) ?? null;
  // Append a per-session cache-buster so stale browser-cached responses
  // (e.g. an earlier `Content-Disposition: attachment` that triggered a
  // download) are bypassed without requiring a manual hard refresh.
  const cacheBust = useState(() => Date.now())[0];
  const activePdfUrl = active ? `${active.pdf_url}?v=${cacheBust}` : "";

  async function handleUseBrief(sample: SampleProject) {
    setLoadingBrief(sample.key);
    try {
      const res = await fetchSampleText(sample.key);
      onUseBrief(res.text, sample.key);
    } finally {
      setLoadingBrief(null);
    }
  }

  return (
    <div className="card sample-panel">
      <div className="sample-panel-header">
        <div>
          <h2 style={{ margin: 0 }}>EY challenge sample data</h2>
          <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#747480" }}>
            3 project briefs · 15-person team roster · loaded from{" "}
            <code>data/</code>, served untouched.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse" : "Expand"}
        </button>
      </div>

      {open && (
        <>
          <div className="sample-tabs">
            <button
              className={`sample-tab ${view === "projects" ? "active" : ""}`}
              onClick={() => setView("projects")}
            >
              Project briefs ({samples.length})
            </button>
            <button
              className={`sample-tab ${view === "team" ? "active" : ""}`}
              onClick={() => setView("team")}
            >
              Team roster ({teamFilename || "team_members.txt"})
            </button>
          </div>

          {view === "projects" && (
            <>
              <div className="sample-picker">
                {samples.map((s) => (
                  <button
                    key={s.key}
                    className={`sample-pill ${activeKey === s.key ? "active" : ""}`}
                    onClick={() => setActiveKey(s.key)}
                  >
                    {s.filename} <span className="sample-pill-size">{(s.size_bytes / 1024).toFixed(0)} KB</span>
                  </button>
                ))}
                {samples.length === 0 && <div className="empty">No sample PDFs found.</div>}
              </div>

              {active && (
                <div className="sample-preview">
                  <div className="sample-preview-toolbar">
                    <strong style={{ fontSize: "0.85rem" }}>{active.filename}</strong>
                    <div className="pdf-preview-actions">
                      <a className="btn-link" href={activePdfUrl} target="_blank" rel="noreferrer">
                        Open in tab
                      </a>
                      <a className="btn-link" href={activePdfUrl} download={active.filename}>
                        Download
                      </a>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleUseBrief(active)}
                        disabled={loadingBrief === active.key}
                      >
                        {loadingBrief === active.key ? "Loading…" : "Use this brief"}
                      </button>
                    </div>
                  </div>
                  <iframe
                    key={active.key}
                    title={`Sample: ${active.filename}`}
                    src={activePdfUrl}
                    className="pdf-frame"
                  />
                </div>
              )}
            </>
          )}

          {view === "team" && (
            <div className="sample-preview">
              <div className="sample-preview-toolbar">
                <strong style={{ fontSize: "0.85rem" }}>
                  {teamFilename} · {teamRaw.length.toLocaleString()} characters
                </strong>
                <div className="pdf-preview-actions">
                  <a
                    className="btn-link"
                    href={`data:text/plain;charset=utf-8,${encodeURIComponent(teamRaw)}`}
                    download={teamFilename || "team_members.txt"}
                  >
                    Download
                  </a>
                </div>
              </div>
              <pre className="team-raw">{teamRaw || "Loading…"}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
