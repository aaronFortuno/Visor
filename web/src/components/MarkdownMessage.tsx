import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";

interface Props {
  content: string;
}

const components: Components = {
  // Code blocks with syntax highlighting
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !match && !className;

    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 bg-black/30 rounded text-visor-accent text-[0.85em] font-mono" {...props}>
          {children}
        </code>
      );
    }

    return (
      <SyntaxHighlighter
        style={oneDark}
        language={match?.[1] || "text"}
        PreTag="div"
        customStyle={{
          margin: "0.5rem 0",
          borderRadius: "0.5rem",
          fontSize: "0.8rem",
          border: "1px solid #1e1e2e",
        }}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    );
  },

  // Tables
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-xs border-collapse">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="px-3 py-1.5 text-left font-semibold text-gray-300 border-b border-visor-border bg-visor-bg">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="px-3 py-1.5 text-gray-400 border-b border-visor-border/50">
        {children}
      </td>
    );
  },

  // Links
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-visor-accent underline hover:text-indigo-400">
        {children}
      </a>
    );
  },

  // Paragraphs - tighter spacing
  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },

  // Lists
  ul({ children }) {
    return <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal ml-4 mb-2 space-y-0.5">{children}</ol>;
  },

  // Blockquotes
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-visor-accent/50 pl-3 my-2 text-gray-400 italic">
        {children}
      </blockquote>
    );
  },

  // Headings
  h1({ children }) { return <h1 className="text-lg font-bold text-white mb-2 mt-3">{children}</h1>; },
  h2({ children }) { return <h2 className="text-base font-bold text-white mb-1.5 mt-2">{children}</h2>; },
  h3({ children }) { return <h3 className="text-sm font-bold text-white mb-1 mt-2">{children}</h3>; },

  // Horizontal rule
  hr() { return <hr className="my-3 border-visor-border" />; },

  // Strong/em
  strong({ children }) { return <strong className="font-semibold text-white">{children}</strong>; },
  em({ children }) { return <em className="italic text-gray-300">{children}</em>; },
};

export function MarkdownMessage({ content }: Props) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-gray-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
