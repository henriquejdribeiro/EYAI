import { useState } from "react";
import { extractPdf } from "../lib/api";

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  sprintCount: number;
  onSprintCountChange: (n: number) => void;
  sprintLength: number;
  onSprintLengthChange: (n: number) => void;
  onGenerate: () => void;
  onPdfFileChange: (file: File | null) => void;
  loading: boolean;
}

export function ProjectInput(props: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    props.onPdfFileChange(file);
    try {
      const res = await extractPdf(file);
      props.onTextChange(res.text);
      if (!props.projectName) {
        props.onProjectNameChange(file.name.replace(/\.pdf$/i, ""));
      }
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card">
      <h2>1. Project brief</h2>
      <p>Paste a project description or upload one of the EY challenge PDFs.</p>

      <div className="file-row">
        <input type="file" accept=".pdf" onChange={handleFile} disabled={uploading} />
        {uploading && <span style={{ fontSize: "0.85rem", color: "#747480" }}>Extracting…</span>}
      </div>
      {uploadError && <div className="error">{uploadError}</div>}

      <label htmlFor="project-name">Project name</label>
      <input
        id="project-name"
        type="text"
        value={props.projectName}
        onChange={(e) => props.onProjectNameChange(e.target.value)}
        placeholder="e.g. Customer Portal Modernisation"
        style={{ marginBottom: 12 }}
      />

      <label htmlFor="project-text">Project brief</label>
      <textarea
        id="project-text"
        value={props.text}
        onChange={(e) => props.onTextChange(e.target.value)}
        placeholder="Describe the project goals, scope, constraints, stakeholders, success criteria…"
      />

      <div className="row" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="sprint-count">Number of sprints</label>
          <input
            id="sprint-count"
            type="number"
            min={1}
            max={8}
            value={props.sprintCount}
            onChange={(e) => props.onSprintCountChange(parseInt(e.target.value) || 1)}
          />
        </div>
        <div>
          <label htmlFor="sprint-length">Sprint length (days)</label>
          <input
            id="sprint-length"
            type="number"
            min={5}
            max={28}
            value={props.sprintLength}
            onChange={(e) => props.onSprintLengthChange(parseInt(e.target.value) || 14)}
          />
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ marginTop: 16, width: "100%" }}
        onClick={props.onGenerate}
        disabled={props.loading || !props.text.trim()}
      >
        {props.loading ? "Generating plan…" : "Generate Scrum plan"}
      </button>
    </div>
  );
}
