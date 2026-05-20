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
    <div className="pdf-preview">
      <div className="pdf-preview-header">
        <div>
          <strong style={{ fontSize: "0.85rem" }}>PDF preview</strong>
          <div style={{ fontSize: "0.75rem", color: "#747480" }}>
            {file.name} · {sizeKb} KB
          </div>
        </div>
        <div className="pdf-preview-actions">
          <a
            className="btn-link"
            href={blobUrl}
            download={file.name}
          >
            Download
          </a>
          <a
            className="btn-link"
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in tab
          </a>
          <button className="btn-link" onClick={onClose}>
            Close
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
