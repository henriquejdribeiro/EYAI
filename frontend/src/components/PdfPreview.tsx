import { useEffect, useMemo } from "react";

interface Props {
  file: File;
  onClose: () => void;
}

export function PdfPreview({ file, onClose }: Props) {
  const blobUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const sizeKb = (file.size / 1024).toFixed(0);

  return (
    <div className="card pdf-preview-card">
      <div className="pdf-preview-header">
        <div>
          <h2 style={{ margin: 0 }}>PDF preview</h2>
          <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "#747480" }}>
            {file.name} · {sizeKb} KB
          </p>
        </div>
        <div className="row" style={{ flex: "0 0 auto", gap: 8 }}>
          <a
            className="btn btn-ghost"
            href={blobUrl}
            download={file.name}
            style={{ textDecoration: "none" }}
          >
            Download
          </a>
          <a
            className="btn btn-ghost"
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none" }}
          >
            Open in tab
          </a>
          <button className="btn btn-ghost" onClick={onClose}>
            Close preview
          </button>
        </div>
      </div>
      <iframe
        title={`PDF preview: ${file.name}`}
        src={blobUrl}
        className="pdf-frame"
      />
    </div>
  );
}
