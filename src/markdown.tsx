import type { ReactNode } from "react";

type Kind =
  | "intro"
  | "title"
  | "hex-overview"
  | "diagram"
  | "source"
  | "translation"
  | "classic"
  | "commentary"
  | "traditional"
  | "philosophy"
  | "line-detail"
  | "change"
  | "judgement"
  | "image-text"
  | "metadata"
  | "line-table"
  | "quote"
  | "note";

type Block =
  | { type: "heading"; level: number; text: string; kind: Kind }
  | { type: "paragraph"; text: string; kind: Kind }
  | { type: "list"; items: string[]; kind: Kind }
  | { type: "meta"; items: Array<[string, string]>; kind: Kind }
  | { type: "image"; alt: string; src: string; kind: Kind }
  | { type: "quote"; text: string; kind: Kind }
  | { type: "table"; head: string[]; body: string[][]; kind: Kind };

export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  const groups = groupBlocks(blocks);

  return (
    <div className="structured-markdown">
      {groups.map((group, index) => (
        <section className="md-section" data-kind={group.kind} key={`${group.kind}-${index}`}>
          {group.heading ? renderBlock(group.heading, `heading-${index}`) : null}
          {group.blocks.map((block, blockIndex) => renderBlock(block, `${index}-${blockIndex}`))}
        </section>
      ))}
    </div>
  );
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let list: string[] = [];
  let currentKind: Kind = "intro";
  const lines = text.split("\n");

  const flushList = () => {
    if (!list.length) return;
    const meta = list.map((item) => item.match(/^([^：:]+)[：:]\s*(.+)$/));
    if (meta.every(Boolean)) {
      blocks.push({ type: "meta", items: meta.map((match) => [match![1], match![2]]), kind: "metadata" });
    } else {
      blocks.push({ type: "list", items: list, kind: currentKind });
    }
    list = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const image = line.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
    if (image) {
      flushList();
      blocks.push({ type: "image", src: image[2], alt: image[1] || "图", kind: currentKind });
      continue;
    }
    if (line.startsWith("|") && /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1]?.trim() ?? "")) {
      flushList();
      const rows: string[][] = [];
      while (lines[index]?.trim().startsWith("|")) {
        rows.push(splitRow(lines[index].trim()));
        index += 1;
      }
      const [head, , ...body] = rows;
      blocks.push({ type: "table", head, body, kind: currentKind === "image-text" ? "line-table" : currentKind });
      index -= 1;
      continue;
    }
    if (line.startsWith("> ")) {
      flushList();
      blocks.push({ type: "quote", text: line.slice(2), kind: "quote" });
      continue;
    }
    if (line.startsWith("#")) {
      flushList();
      const level = line.match(/^#+/)![0].length;
      const heading = line.replace(/^#+\s*/, "");
      currentKind = classifyHeading(heading, level);
      blocks.push({ type: "heading", level, text: heading, kind: currentKind });
      continue;
    }
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flushList();
    blocks.push({ type: "paragraph", text: line, kind: classifyParagraph(line, currentKind) });
  }
  flushList();

  return blocks;
}

function groupBlocks(blocks: Block[]) {
  const groups: Array<{ heading?: Block; blocks: Block[]; kind: Kind }> = [];
  let current: { heading?: Block; blocks: Block[]; kind: Kind } | undefined;

  for (const block of blocks) {
    if (block.type === "heading" && block.level <= 2) {
      if (current) groups.push(current);
      current = { heading: block, blocks: [], kind: block.kind };
      continue;
    }
    current ??= { blocks: [], kind: "intro" };
    current.blocks.push(block);
  }
  if (current) groups.push(current);
  return groups;
}

function renderBlock(block: Block, key: string): ReactNode {
  if (block.type === "heading") {
    const Tag = `h${Math.min(block.level, 3)}` as "h1" | "h2" | "h3";
    return (
      <Tag className="md-heading" data-kind={block.kind} key={key}>
        {inline(block.text)}
      </Tag>
    );
  }
  if (block.type === "paragraph") {
    return (
      <p className="md-paragraph" data-kind={block.kind} key={key}>
        {inline(block.text)}
      </p>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="md-list" data-kind={block.kind} key={key}>
        {block.items.map((item, index) => (
          <li key={`${item}-${index}`}>{inline(item)}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "meta") {
    return (
      <dl className="md-meta" data-kind={block.kind} key={key}>
        {block.items.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{inline(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (block.type === "image") {
    return (
      <figure className="md-figure" data-kind={block.kind} key={key}>
        <img src={block.src} alt={block.alt} loading="lazy" />
      </figure>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote className="md-quote" data-kind={block.kind} key={key}>
        <p>{inline(block.text)}</p>
      </blockquote>
    );
  }
  return (
    <div className="table-wrap" data-kind={block.kind} key={key}>
      <table>
        <thead>
          <tr>{block.head.map((cell, index) => <th key={`${cell}-${index}`}>{inline(cell)}</th>)}</tr>
        </thead>
        <tbody>
          {block.body.map((row, rowIndex) => (
            <tr key={`${row.join("|")}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inline(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function classifyHeading(text: string, level: number): Kind {
  const clean = text.replace(/\s+/g, "");
  if (level === 1) return "title";
  if (/^\d{2}/.test(clean)) return "hex-overview";
  if (/卦图/.test(clean)) return "diagram";
  if (/爻辞与小象|象辞/.test(clean)) return "image-text";
  if (/彖辞/.test(clean)) return "judgement";
  if (/原文|爻辞/.test(clean)) return "source";
  if (/白话/.test(clean)) return "translation";
  if (/断易|邵雍/.test(clean)) return "classic";
  if (/傅佩荣/.test(clean)) return "commentary";
  if (/传统解卦/.test(clean)) return "traditional";
  if (/哲学含义/.test(clean)) return "philosophy";
  if (/变卦/.test(clean)) return "change";
  if (/详解/.test(clean)) return "line-detail";
  return "note";
}

function classifyParagraph(text: string, fallback: Kind): Kind {
  if (/爻动变得|变得周易第/.test(text)) return "change";
  if (/^(象曰|《象》曰)/.test(text)) return "image-text";
  if (/^(时运|财运|家宅|身体|事业|经商|求名|婚恋|决策)[：:]/.test(text)) return "commentary";
  return fallback;
}

function splitRow(line: string) {
  return line
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)]\(([^)]+)\)|(https?:\/\/\S+))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      match[2] ? (
        <strong key={match.index}>{match[2]}</strong>
      ) : match[5] ? (
        <a key={match.index} href={match[5]}>
          {match[5]}
        </a>
      ) : (
        <a key={match.index} href={match[4]}>
          {match[3]}
        </a>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
