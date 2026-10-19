"use client";
import { useEffect, useState } from "react";
import { Download, Eye, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { DocumentRecord } from "@/lib/types";
import { Badge, Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function EvidenceViewer({ document, onClose }: { document: DocumentRecord; onClose: () => void }) {
  const { demo } = useWorkspace();
  const [source, setSource] = useState("");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showHighlights, setShowHighlights] = useState(false);
  const extension = document.originalName.split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png"].includes(extension || "");
  const isPdf = extension === "pdf";
  useEffect(() => {
    if (demo && !document.file) {
      setSource("");
      return;
    }
    if (!document.file) {
      setSource(`/api/backend/documents/${document.id}/download`);
      return;
    }
    const url = URL.createObjectURL(document.file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [demo, document]);
  function download() {
    if (!source) return;
    const link = window.document.createElement("a");
    link.href = source;
    link.download = document.originalName;
    link.click();
  }
  return (
    <Modal title="Evidence viewer" description="Review a document or image attached to this case." onClose={onClose}>
      <div className="evidence-heading">
        <div><strong>{document.originalName}</strong><small>{Math.ceil(document.fileSize / 1024)} KB · Added {document.createdAt}</small></div>
        <Badge tone="neutral">{document.documentType || "Exhibit"}</Badge>
      </div>
      <div className="evidence-toolbar" role="toolbar" aria-label="Evidence viewer controls">
        <button className="icon-button" aria-label="Zoom out" title="Zoom out" disabled={!isImage || zoom <= 50} onClick={() => setZoom((value) => Math.max(50, value - 25))}><ZoomOut size={17} /></button>
        <span className="zoom-label">{zoom}%</span>
        <button className="icon-button" aria-label="Zoom in" title="Zoom in" disabled={!isImage || zoom >= 200} onClick={() => setZoom((value) => Math.min(200, value + 25))}><ZoomIn size={17} /></button>
        <button className="icon-button" aria-label="Rotate left" title="Rotate left" disabled={!isImage} onClick={() => setRotation((value) => value - 90)}><RotateCcw size={17} /></button>
        <button className="icon-button" aria-label="Rotate right" title="Rotate right" disabled={!isImage} onClick={() => setRotation((value) => value + 90)}><RotateCw size={17} /></button>
        <button className={`button compact ${showHighlights ? "primary" : "secondary"}`} aria-pressed={showHighlights} onClick={() => setShowHighlights((value) => !value)}><Eye size={15} />{showHighlights ? "Hide review highlights" : "Show review highlights"}</button>
        <button className="icon-button evidence-download" aria-label={`Download ${document.originalName}`} title="Download original" onClick={download}><Download size={17} /></button>
      </div>
      {showHighlights && <p className="callout evidence-disclaimer">Sample visual review highlights only. They do not alter or permanently redact the original file.</p>}
      <div className="evidence-stage">
        {isImage && source ? <div className="image-viewport">
          <img src={source} alt={`Evidence exhibit: ${document.originalName}`} style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }} />
          {showHighlights && <div className="review-highlight" aria-label="Sample privacy review highlight" />}
        </div> : isPdf && source ? <div className="pdf-viewport">
          <iframe src={source} title={`PDF exhibit: ${document.originalName}`} />
          {showHighlights && <div className="review-highlight pdf-highlight" aria-label="Sample privacy review highlight" />}
        </div> : <div className="evidence-unavailable">
          <Eye size={25} />
          <strong>{source && !isPdf ? "Preview is not available for this file type" : "No file is attached to this record"}</strong>
          <p>{document.file ? "This document format can be downloaded but not previewed here." : "This is metadata only. The original file is not available in this session."}</p>
        </div>}
      </div>
      <p className="evidence-caption">Exhibit tag: {document.documentType || "Other"}. Preview controls affect only this view.</p>
    </Modal>
  );
}