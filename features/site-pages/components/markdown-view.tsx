import { Fragment, type ReactNode } from "react";

/**
 * The little Markdown the admin's text pages use: ## / ### headings,
 * "- " lists, "1. " lists, **bold**, [links](https://…) and paragraphs
 * separated by a blank line. Built as React elements, never as HTML, so
 * nothing in a page can run as script; a link only becomes a link when it
 * points at this site (/…) or at http(s).
 */
export function MarkdownView({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <div className="space-y-4 text-sm leading-7 text-foreground">
      {blocks.map((block, index) => (
        <Block key={index} block={block.trim()} />
      ))}
    </div>
  );
}

function Block({ block }: { block: string }) {
  if (!block) return null;
  const lines = block.split("\n");

  const heading = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
  if (heading && lines.length === 1) {
    const level = heading[1].length;
    const content = inline(heading[2]);
    if (level === 1) return <h2 className="pt-2 text-xl font-bold">{content}</h2>;
    if (level === 2) return <h3 className="pt-2 text-lg font-bold">{content}</h3>;
    return <h4 className="pt-1 text-base font-semibold">{content}</h4>;
  }

  if (lines.every((line) => /^[-*]\s+/.test(line))) {
    return (
      <ul className="list-disc space-y-1 pr-5">
        {lines.map((line, i) => (
          <li key={i}>{inline(line.replace(/^[-*]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  if (lines.every((line) => /^[0-9۰-۹]+[.)]\s+/.test(line))) {
    return (
      <ol className="list-decimal space-y-1 pr-5">
        {lines.map((line, i) => (
          <li key={i}>{inline(line.replace(/^[0-9۰-۹]+[.)]\s+/, ""))}</li>
        ))}
      </ol>
    );
  }

  return (
    <p>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {inline(line)}
        </Fragment>
      ))}
    </p>
  );
}

/** **bold** and [text](url) inside a line. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[1] !== undefined) {
      out.push(<strong key={match.index}>{match[1]}</strong>);
    } else {
      const href = match[3];
      const safe = /^(https?:\/\/|\/(?!\/))/i.test(href);
      out.push(
        safe ? (
          <a
            key={match.index}
            href={href}
            className="text-primary underline underline-offset-4"
            {...(href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          >
            {match[2]}
          </a>
        ) : (
          match[2]
        )
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
