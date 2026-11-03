import { Fragment, type ReactNode } from "react";

/**
 * Safe renderer for the tiny Markdown subset used in explainer text:
 * paragraphs, "- " bullets, **bold**, *italic*, `code`, [link](url).
 * Never injects raw HTML.
 */
export function Markdown({
  text,
  inline = false,
}: {
  text: string;
  inline?: boolean;
}) {
  if (inline) return <>{renderInline(text, "i")}</>;
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={bi} className="ex-md-list">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-•]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

const TOKEN =
  /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/|#)[^)\s]*\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      out.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      const external = /^https?:/.test(href);
      out.push(
        <a
          key={key}
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {label}
        </a>,
      );
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
