import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="code-block">
      <button type="button" className="code-block__copy" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy code"}
      </button>
      <pre><code>{value}</code></pre>
    </div>
  );
}

function readText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(readText).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return readText(children.props.children as ReactNode);
  }
  return "";
}

export function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>
        ),
        code: ({ children }) => <code>{children}</code>,
        pre: ({ children }) => <CopyableCode value={readText(children).replace(/\n$/, "")} />,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
