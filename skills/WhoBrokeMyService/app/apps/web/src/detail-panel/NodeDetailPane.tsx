import { useState } from "react";
import type { EntityDetail, InvestigationDocument, SourceRange } from "../contracts/api";
import { MarkdownContent } from "./MarkdownContent";

interface NodeDetailPaneProps {
  detail?: EntityDetail;
  loading: boolean;
  error?: string;
  onSelectEntity: (entityId: string) => void;
  onOpenInEditor: (entityId: string) => Promise<void>;
  canGoBack: boolean;
  onBack: () => void;
  rootDocuments?: { entityId: string; label: string }[];
}

async function copyPath(path: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(path);
    return;
  }
  const input = document.createElement("textarea");
  input.value = path;
  input.setAttribute("readonly", "");
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) {
    throw new Error("The browser could not copy the source path.");
  }
}

function isDocument(entity: EntityDetail["entity"]): entity is InvestigationDocument {
  return "items" in entity && "outline" in entity;
}

function getSource(detail: EntityDetail): SourceRange | undefined {
  return detail.source ?? (isDocument(detail.entity) ? detail.entity.source : "source" in detail.entity ? detail.entity.source : undefined);
}

export function NodeDetailPane({
  detail,
  loading,
  error,
  onSelectEntity,
  onOpenInEditor,
  canGoBack,
  onBack,
  rootDocuments,
}: NodeDetailPaneProps) {
  const [actionMessage, setActionMessage] = useState<string>();

  if (loading) {
    return <section className="detail-pane detail-pane--state" aria-live="polite">Loading selected source…</section>;
  }
  if (error) {
    return <section className="detail-pane detail-pane--state detail-pane--error" role="alert">{error}</section>;
  }
  if (!detail) {
    return <section className="detail-pane detail-pane--state">Select an investigation node to inspect its source.</section>;
  }

  const source = getSource(detail);
  const document = isDocument(detail.entity) ? detail.entity : undefined;
  const isRoot = detail.entity.kind === "investigation";
  const markdown = detail.markdown ?? (!document && "markdown" in detail.entity ? detail.entity.markdown : undefined);
  const sourceLabel = source && `${source.relativePath}:${source.startLine}-${source.endLine}`;

  return (
    <section className="detail-pane" aria-label="Selected source detail">
      <header className="detail-pane__header">
        <div className="detail-pane__identity">
          <button
            type="button"
            className="button button--secondary detail-pane__back"
            onClick={onBack}
            disabled={!canGoBack}
          >
            ← Back
          </button>
          <div>
            <p className="eyebrow">{detail.entity.kind}</p>
            <h2>{detail.entity.title}</h2>
            {sourceLabel && <p className="source-range">{sourceLabel}</p>}
          </div>
        </div>
        {source && (
          <div className="detail-pane__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void onOpenInEditor(detail.entity.id).then(async () => {
                setActionMessage("Opening editor.");
              }).catch(async () => {
                try {
                  await copyPath(source.relativePath);
                  setActionMessage("Editor unavailable; copied source path.");
                } catch {
                  setActionMessage("Editor navigation and source-path copy are unavailable.");
                }
              })}
            >
              Open in editor
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void copyPath(source.relativePath).then(
                () => setActionMessage("Copied source path."),
                () => setActionMessage("Source-path copy is unavailable."),
              )}
            >
              Copy path
            </button>
          </div>
        )}
      </header>
      {actionMessage && <p className="action-message" role="status">{actionMessage}</p>}
      {isRoot && (
        <nav className="file-outline" aria-label=".ai folder documents">
          <h3>Documents in .ai folder</h3>
          {rootDocuments && rootDocuments.length > 0 ? (
            <ul>
              {rootDocuments.map((documentRef) => (
                <li key={documentRef.entityId}>
                  <button
                    type="button"
                    className="outline-link"
                    onClick={() => onSelectEntity(documentRef.entityId)}
                  >
                    <span>{documentRef.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>No documents were found in this .ai folder.</p>}
        </nav>
      )}
      {document && (
        <nav className="file-outline" aria-label={`${document.title} outline`}>
          <h3>Parsed items</h3>
          {document.items.length ? (
            <ul>
              {document.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="outline-link"
                    onClick={() => onSelectEntity(item.id)}
                  >
                    <span>{item.title}</span>
                    <small>{item.source.startLine}-{item.source.endLine}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p>No semantic items were parsed from this document.</p>}
          {document.outline.length > 0 && (
            <>
              <h3>Document outline</h3>
              <ul>
                {document.outline.map((item) => (
                  <li key={item.id}>
                    <span className="outline-link outline-link--static">
                      <span>{item.title}</span>
                      <small>{item.source.startLine}-{item.source.endLine}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
      )}
      {markdown && !document && (
        <article className="markdown-content">
          <MarkdownContent markdown={markdown} />
        </article>
      )}
    </section>
  );
}
