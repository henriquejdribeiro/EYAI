export type Mode = "auto" | "manual";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Planning mode">
      <button
        type="button"
        role="radio"
        aria-checked={mode === "auto"}
        className={`mode-option ${mode === "auto" ? "active" : ""}`}
        onClick={() => onChange("auto")}
      >
        <span className="mode-label">Modo 1 · Auto</span>
        <span className="mode-hint">AI locks the plan. Read-only board.</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "manual"}
        className={`mode-option ${mode === "manual" ? "active" : ""}`}
        onClick={() => onChange("manual")}
      >
        <span className="mode-label">Modo 2 · Manual</span>
        <span className="mode-hint">Drag tasks between columns. You decide.</span>
      </button>
    </div>
  );
}
