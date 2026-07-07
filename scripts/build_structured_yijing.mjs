import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT_DIR = "src/data/hexagrams";
const OUT_FILE = "src/data/yijing.json";
const CHECK_ONLY = process.argv.includes("--check");

const TRIGRAMS = [
  { key: "qian", name: "乾", nature: "天", symbol: "☰", bits: [1, 1, 1], text: "刚健、主动、向上。" },
  { key: "xun", name: "巽", nature: "风", symbol: "☴", bits: [0, 1, 1], text: "入、顺、渐进。" },
  { key: "kan", name: "坎", nature: "水", symbol: "☵", bits: [0, 1, 0], text: "险陷、流动、磨炼。" },
  { key: "gen", name: "艮", nature: "山", symbol: "☶", bits: [0, 0, 1], text: "止、静、边界。" },
  { key: "kun", name: "坤", nature: "地", symbol: "☷", bits: [0, 0, 0], text: "柔顺、承载、厚德。" },
  { key: "zhen", name: "震", nature: "雷", symbol: "☳", bits: [1, 0, 0], text: "发动、震动、初起。" },
  { key: "li", name: "离", nature: "火", symbol: "☲", bits: [1, 0, 1], text: "光明、依附、辨明。" },
  { key: "dui", name: "兑", nature: "泽", symbol: "☱", bits: [1, 1, 0], text: "悦泽、交流、开放。" },
];

const natureToBits = new Map(TRIGRAMS.map((gua) => [gua.nature, gua.bits]));
const ASPECT_LABEL_RE = /^([^：:\n]{1,8})[：:]\s*(.+)$/s;
const LINE_NAME_RE = /^(初[九六]|[九六][二三四五]|上[九六])/;

function main() {
  const indexMarkdown = readFileSync("yijing64/README.md", "utf8");
  const canonMarkdown = readFileSync("yijing64/00-总纲-易经六十四卦原文.md", "utf8");
  const hexIndex = parseIndex(indexMarkdown);
  const canonSections = parseCanon(canonMarkdown);
  const hexByBits = new Map(hexIndex.map((hex) => [hex.bits.join(""), hex]));

  const hexagrams = hexIndex.map((hex) => {
    const detailMarkdown = readFileSync(hex.path.slice(1), "utf8");
    const canon = canonSections.get(hex.id);
    if (!canon) throw new Error(`Missing canon section for ${hex.id}. ${hex.name}`);
    return parseDetailHex(hex, canon, detailMarkdown, hexByBits);
  });

  const output = {
    schemaVersion: 1,
    generatedBy: {
      kind: "markdown",
      script: "scripts/build_structured_yijing.mjs",
    },
    source: {
      index: "yijing64/README.md",
      canon: "yijing64/00-总纲-易经六十四卦原文.md",
      detailDirectory: "yijing64/gua",
    },
    trigrams: TRIGRAMS,
    hexagrams,
  };

  validateDataset(output);
  const auditProblems = auditMarkdownCoverage(output, canonMarkdown);
  if (auditProblems.length) {
    throw new Error(`Markdown coverage audit failed:\n${auditProblems.slice(0, 80).join("\n")}`);
  }

  if (CHECK_ONLY) {
    checkGeneratedFiles(output);
    console.log("Structured data is in sync with Markdown sources.");
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const hex of hexagrams) {
    writeJson(`${OUT_DIR}/${String(hex.id).padStart(2, "0")}.json`, hex);
  }
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeJson(OUT_FILE, output);
  console.log(`Wrote ${OUT_FILE} and ${hexagrams.length} hexagram files from Markdown.`);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function checkGeneratedFiles(output) {
  const checks = [
    [OUT_FILE, output],
    ...output.hexagrams.map((hex) => [`${OUT_DIR}/${String(hex.id).padStart(2, "0")}.json`, hex]),
  ];
  const mismatches = checks
    .filter(([path, value]) => readFileSync(path, "utf8") !== `${JSON.stringify(value, null, 2)}\n`)
    .map(([path]) => path);
  if (mismatches.length) {
    throw new Error(`Generated data is out of sync:\n${mismatches.join("\n")}\nRun npm run build:data.`);
  }
}

function parseIndex(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*\[查看\]\(([^)]+)\)/))
    .filter(Boolean)
    .map((match) => {
      const image = match[3].trim();
      const repeated = image.includes("为") ? image.split("为")[1]?.[0] : "";
      const upper = repeated || image[0];
      const lower = repeated || image[1];
      const upperBits = natureToBits.get(upper);
      const lowerBits = natureToBits.get(lower);
      if (!upperBits || !lowerBits) throw new Error(`无法解析卦象：${image}`);
      return {
        id: Number(match[1]),
        name: match[2].trim(),
        image,
        summary: match[4].trim(),
        path: `/${`yijing64/${match[5].trim()}`}`,
        upper,
        lower,
        bits: [...lowerBits, ...upperBits],
      };
    });
}

function parseCanon(markdown) {
  const sections = splitH2Sections(markdown);
  return new Map(
    sections
      .filter((section) => /^\d{2}/.test(section.title))
      .map((section) => {
        const id = Number(section.title.slice(0, 2));
        const blocks = splitBlocks(section.content);
        const intro = blocks.find((block) => block.heading === "__intro")?.text ?? "";
        const tuan = blocks.find((block) => block.heading === "彖辞")?.text ?? "";
        const xiang = blocks.find((block) => block.heading === "象辞")?.text ?? "";
        const lineBlock = blocks.find((block) => block.heading === "爻辞与小象")?.text ?? "";
        return [
          id,
          {
            title: section.title,
            guaci: paragraphs(intro),
            tuan: paragraphs(tuan),
            xiang: paragraphs(xiang),
            lines: parseCanonLines(lineBlock),
          },
        ];
      }),
  );
}

function parseCanonLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|\s*-+/.test(line) && !/^\|\s*爻辞\s*\|/.test(line))
    .map((line, index) => {
      const cells = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
      const text = cells[0] ?? "";
      return {
        index,
        name: lineNameFromText(text),
        text,
        imageText: cells[1] ?? "",
      };
    });
}

function parseDetailHex(hex, canon, markdown, hexByBits) {
  const h2Sections = splitH2Sections(markdown);
  const diagramSection = h2Sections.find((section) => section.title === "卦图");
  const overviewSection = h2Sections.find((section) => /详解/.test(section.title) && !/爻详解/.test(section.title));
  const lineSections = h2Sections.filter((section) => /爻详解/.test(section.title));
  if (!overviewSection) throw new Error(`Missing overview section for ${hex.id}. ${hex.name}`);

  return {
    ...hex,
    title: markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? `${hex.id}. ${hex.name}`,
    sourceUrl: markdown.match(/^- 来源：(.+)$/m)?.[1]?.trim() ?? "",
    canon,
    diagrams: parseDiagrams(diagramSection?.content ?? ""),
    overview: {
      heading: overviewSection.title,
      ...parseOverview(overviewSection.content),
    },
    lines: lineSections.map((section, index) => parseLine(section, index, canon.lines[index], hex, hexByBits)),
  };
}

function parseDiagrams(text) {
  const images = parseImages(text);
  const labels = [...text.matchAll(/^###\s+(.+)$/gm)].map((match) => cleanHeadingText(match[1]));
  const diagramTexts = paragraphs(
    text
      .replace(/^!\[[^\]]*]\([^)]+\)\s*$/gm, "")
      .replace(/^###\s+.+$/gm, ""),
  );
  return images.map((image, index) => ({
    label: labels[index] || "卦图",
    text: diagramTexts[index] ?? "",
    alt: image.alt,
    src: image.src,
  }));
}

function parseOverview(text) {
  const overview = {
    original: emptyClassicBlock(),
    translation: emptyClassicBlock(),
    duanyi: [],
    shaoyong: [],
    fuPeirong: emptyAspectBlock(),
    traditional: emptyAspectBlock(),
    philosophy: [],
  };

  for (const block of splitBlocks(text)) {
    if (!block.text.trim()) continue;
    if (/卦原文$/.test(block.heading)) {
      overview.original = mergeClassic(overview.original, classicBlock(block.text));
    } else if (block.heading === "白话文解释") {
      overview.translation = mergeClassic(overview.translation, classicBlock(block.text));
    } else if (block.heading === "《断易天机》解") {
      overview.duanyi.push(...paragraphs(block.text));
    } else if (block.heading === "北宋易学家邵雍解") {
      overview.shaoyong.push(...paragraphs(block.text));
    } else if (block.heading.startsWith("台湾国学大儒傅佩荣解")) {
      overview.fuPeirong = mergeAspect(overview.fuPeirong, aspectBlock(block.text));
    } else if (block.heading === "传统解卦") {
      overview.traditional = mergeAspect(overview.traditional, aspectBlock(block.text));
    } else {
      overview.philosophy.push(...paragraphs(block.text));
    }
  }

  return overview;
}

function parseLine(section, index, canonLine, hex, hexByBits) {
  const line = {
    index,
    name: canonLine?.name || lineNameFromText(section.title),
    heading: section.title,
    original: emptyClassicBlock(),
    translation: emptyClassicBlock(),
    shaoyong: [],
    fuPeirong: emptyAspectBlock(),
    change: emptyChangeBlock(),
    philosophy: [],
  };

  for (const block of splitBlocks(section.content)) {
    if (!block.text.trim()) continue;
    if (/爻辞$/.test(block.heading)) {
      line.original = mergeClassic(line.original, classicBlock(block.text));
    } else if (block.heading === "白话文解释") {
      line.translation = mergeClassic(line.translation, classicBlock(block.text));
    } else if (block.heading === "北宋易学家邵雍解") {
      line.shaoyong.push(...paragraphs(block.text));
    } else if (block.heading.startsWith("台湾国学大儒傅佩荣解")) {
      line.fuPeirong = mergeAspect(line.fuPeirong, aspectBlock(block.text));
    } else if (/变卦$/.test(block.heading)) {
      const { change, extra } = parseChange(block.text, hex, index, hexByBits);
      line.change = mergeChange(line.change, change);
      line.philosophy.push(...extra);
    } else {
      line.philosophy.push(...paragraphs(block.text));
    }
  }

  if (!line.change.targetId) {
    const target = changedHex(hex, index, hexByBits);
    if (target) {
      line.change.targetId = target.id;
      line.change.targetName = target.image;
      line.change.targetImage = target.image;
    }
  }

  return line;
}

function parseChange(text, hex, index, hexByBits) {
  const images = parseImages(text);
  const ps = paragraphs(stripImages(text));
  const changeIndex = ps.findIndex((paragraph) => /爻动变得周易第\d+卦/.test(paragraph));
  const description = changeIndex >= 0 ? ps[changeIndex] : ps[0] ?? "";
  const extra = changeIndex >= 0 ? [...ps.slice(0, changeIndex), ...ps.slice(changeIndex + 1)] : ps.slice(1);
  const targetMatch = description.match(/周易第(\d+)卦[：:]\s*([^。]+)/);
  const fallbackTarget = changedHex(hex, index, hexByBits);
  const targetId = targetMatch ? Number(targetMatch[1]) : fallbackTarget?.id ?? null;
  const targetName = targetMatch?.[2]?.trim() || fallbackTarget?.image || "";
  const targetImage = fallbackTarget?.image || targetName;

  return {
    change: {
      images,
      description,
      targetId,
      targetName,
      targetImage,
    },
    extra,
  };
}

function changedHex(hex, lineIndex, hexByBits) {
  const changed = hex.bits.map((bit, index) => (index === lineIndex ? (bit === 1 ? 0 : 1) : bit));
  return hexByBits.get(changed.join(""));
}

function splitH2Sections(markdown) {
  const heads = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return heads.map((head, index) => ({
    title: cleanHeadingText(head[1]),
    content: markdown.slice(head.index + head[0].length, heads[index + 1]?.index ?? markdown.length).trim(),
  }));
}

function splitBlocks(text) {
  const blocks = [];
  let current = { heading: "__intro", lines: [] };

  for (const line of text.split("\n")) {
    const heading = detectBlockHeading(line);
    if (heading) {
      blocks.push({ heading: current.heading, text: current.lines.join("\n").trim() });
      current = { heading, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  blocks.push({ heading: current.heading, text: current.lines.join("\n").trim() });
  return blocks.filter((block) => block.text || block.heading !== "__intro");
}

function detectBlockHeading(line) {
  const raw = line.trim();
  const heading = cleanHeadingText(raw);
  if (!heading) return "";
  if (/^#{3,}\s+/.test(raw)) return heading;
  if (isKnownHeading(heading)) return heading;
  return "";
}

function isKnownHeading(heading) {
  return (
    heading === "彖辞" ||
    heading === "象辞" ||
    heading === "爻辞与小象" ||
    heading === "白话文解释" ||
    heading === "《断易天机》解" ||
    heading === "北宋易学家邵雍解" ||
    heading.startsWith("台湾国学大儒傅佩荣解") ||
    heading === "传统解卦" ||
    /卦原文$/.test(heading) ||
    /爻辞$/.test(heading) ||
    /变卦$/.test(heading) ||
    /哲学含义/.test(heading)
  );
}

function cleanHeadingText(text) {
  return text
    .replace(/^\s*#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\u00a0/g, "")
    .replace(/\s+/g, " ")
    .replace(/[：:]\s*$/, "")
    .trim();
}

function paragraphs(text) {
  return cleanText(text)
    .split(/\n\s*\n/)
    .map((chunk) =>
      chunk
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);
}

function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function parseImages(text) {
  return [...text.matchAll(/!\[([^\]]*)]\(([^)]+)\)/g)].map((match) => ({
    alt: match[1] || "图",
    src: match[2],
  }));
}

function stripImages(text) {
  return text.replace(/^!\[[^\]]*]\([^)]+\)\s*$/gm, "").trim();
}

function lineNameFromText(text) {
  return cleanText(text).match(LINE_NAME_RE)?.[1] ?? "";
}

function emptyClassicBlock() {
  return { text: [], imageText: [] };
}

function classicBlock(text) {
  const block = emptyClassicBlock();
  for (const paragraph of paragraphs(text)) {
    if (/^(象曰|《象》曰|《象辞》说|《象辞》曰)/.test(paragraph)) {
      block.imageText.push(paragraph);
    } else {
      block.text.push(paragraph);
    }
  }
  return block;
}

function mergeClassic(left, right) {
  return {
    text: [...left.text, ...right.text],
    imageText: [...left.imageText, ...right.imageText],
  };
}

function emptyAspectBlock() {
  return { text: [], items: [] };
}

function aspectBlock(text) {
  const block = emptyAspectBlock();
  for (const paragraph of paragraphs(text)) {
    const match = paragraph.match(ASPECT_LABEL_RE);
    if (match) {
      block.items.push({ label: match[1].trim(), text: match[2].trim() });
    } else {
      block.text.push(paragraph);
    }
  }
  return block;
}

function mergeAspect(left, right) {
  return {
    text: [...left.text, ...right.text],
    items: [...left.items, ...right.items],
  };
}

function emptyChangeBlock() {
  return {
    images: [],
    description: "",
    targetId: null,
    targetName: "",
    targetImage: "",
  };
}

function mergeChange(left, right) {
  return {
    images: [...left.images, ...right.images],
    description: [left.description, right.description].filter(Boolean).join("\n\n"),
    targetId: right.targetId ?? left.targetId,
    targetName: right.targetName || left.targetName,
    targetImage: right.targetImage || left.targetImage,
  };
}

function validateDataset(data) {
  if (data.hexagrams.length !== 64) throw new Error(`Expected 64 hexagrams, got ${data.hexagrams.length}`);
  for (const hex of data.hexagrams) {
    if (!Array.isArray(hex.bits) || hex.bits.length !== 6) throw new Error(`Hex ${hex.id} bits must have 6 values`);
    if (!hex.canon || !Array.isArray(hex.canon.lines) || hex.canon.lines.length !== 6) throw new Error(`Hex ${hex.id} canon.lines must have 6 values`);
    if (!Array.isArray(hex.lines) || hex.lines.length !== 6) throw new Error(`Hex ${hex.id} lines must have 6 values`);
    if (!hex.overview?.original || !hex.overview?.translation) throw new Error(`Hex ${hex.id} overview blocks missing`);
  }
}

function auditMarkdownCoverage(data, canonMarkdown) {
  const problems = [];
  const hexById = new Map(data.hexagrams.map((hex) => [hex.id, hex]));
  for (const section of splitH2Sections(canonMarkdown).filter((item) => /^\d{2}/.test(item.title))) {
    const id = Number(section.title.slice(0, 2));
    const hex = hexById.get(id);
    for (const sourceText of extractCanonSourceTexts(section.content)) {
      if (!containsText(hex, sourceText)) problems.push(`${String(id).padStart(2, "0")} canon missing: ${sourceText.slice(0, 80)}`);
    }
  }

  for (const hex of data.hexagrams) {
    const markdown = readFileSync(hex.path.slice(1), "utf8");
    const diagramSection = splitH2Sections(markdown).find((section) => section.title === "卦图");
    for (const sourceText of extractDetailSourceTexts(diagramSection?.content ?? "")) {
      if (!containsText(hex, sourceText)) problems.push(`${String(hex.id).padStart(2, "0")} diagram missing: ${sourceText.slice(0, 80)}`);
    }
    const sections = splitH2Sections(markdown).filter((section) => /详解/.test(section.title));
    for (const sourceText of sections.flatMap((section) => extractDetailSourceTexts(section.content))) {
      if (!containsText(hex, sourceText)) problems.push(`${String(hex.id).padStart(2, "0")} detail missing: ${sourceText.slice(0, 80)}`);
    }
    for (const image of parseImages(markdown)) {
      if (!containsText(hex, image.src)) problems.push(`${String(hex.id).padStart(2, "0")} image missing: ${image.src}`);
    }
  }
  return problems;
}

function extractCanonSourceTexts(text) {
  const values = [];
  const paragraphLines = [];
  let currentHeading = "__intro";
  const flush = () => {
    const value = paragraphLines.join("\n").trim();
    if (value) values.push(value);
    paragraphLines.length = 0;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = detectBlockHeading(line);
    if (heading) {
      flush();
      currentHeading = heading;
      continue;
    }
    if (/^\|\s*-+/.test(line) || /^\|\s*爻辞\s*\|/.test(line)) continue;
    if (line.startsWith("|")) {
      flush();
      const cells = line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);
      values.push(...cells);
      continue;
    }
    if (currentHeading === "爻辞与小象") continue;
    paragraphLines.push(line);
  }
  flush();
  return values;
}

function extractDetailSourceTexts(text) {
  const values = [];
  const paragraphLines = [];
  const flush = () => {
    const value = paragraphLines.join("\n").trim();
    if (value) values.push(value);
    paragraphLines.length = 0;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (detectBlockHeading(line) || /^!\[[^\]]*]\([^)]+\)$/.test(line)) {
      flush();
      continue;
    }
    paragraphLines.push(line);
  }
  flush();
  return values;
}

function containsText(hex, sourceText) {
  return normalizeForAudit(collectStrings(hex).join("\n")).includes(normalizeForAudit(sourceText));
}

function collectStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!value || typeof value !== "object") return [];
  const strings = [];
  if (typeof value.label === "string" && typeof value.text === "string") {
    strings.push(`${value.label}：${value.text}`);
  }
  for (const item of Object.values(value)) strings.push(...collectStrings(item));
  return strings;
}

function normalizeForAudit(text) {
  return text.replace(/\*\*/g, "").replace(/\s+/g, "");
}

main();
