import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BASE_URL = process.env.YIJING_LLM_BASE_URL ?? "https://token-plan-cn.xiaomimimo.com/v1";
const API_KEY = process.env.YIJING_LLM_API_KEY;
const MODEL = process.env.YIJING_LLM_MODEL ?? "mimo-v2.5";
const OUT_DIR = "src/data/hexagrams";
const OUT_FILE = "src/data/yijing.json";

if (!API_KEY) {
  throw new Error("Missing YIJING_LLM_API_KEY. Export it before running this script.");
}

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
const indexMarkdown = readFileSync("yijing64/README.md", "utf8");
const canonMarkdown = readFileSync("yijing64/00-总纲-易经六十四卦原文.md", "utf8");
const hexIndex = parseIndex(indexMarkdown);
const canonSections = splitCanon(canonMarkdown);

mkdirSync(OUT_DIR, { recursive: true });

const limit = Number(process.env.YIJING_LLM_LIMIT ?? hexIndex.length);
const start = Number(process.env.YIJING_LLM_START ?? 1);
const selected = hexIndex.filter((hex) => hex.id >= start).slice(0, limit);
const hexagrams = [];

for (const hex of selected) {
  const outPath = `${OUT_DIR}/${String(hex.id).padStart(2, "0")}.json`;
  if (process.env.YIJING_LLM_RESUME === "1") {
    try {
      const existing = JSON.parse(readFileSync(outPath, "utf8"));
      validateHex(existing, hex);
      hexagrams.push(existing);
      console.log(`Reused ${outPath}`);
      continue;
    } catch {
      // Fall through and regenerate.
    }
  }

  const detailMarkdown = readFileSync(hex.path.slice(1), "utf8");
  const canonSection = canonSections.get(hex.id) ?? "";
  const structured = await convertHex(hex, canonSection, detailMarkdown);
  validateHex(structured, hex);
  writeFileSync(outPath, `${JSON.stringify(structured, null, 2)}\n`);
  hexagrams.push(structured);
  console.log(`Wrote ${outPath}`);
}

if (selected.length === hexIndex.length) {
  const allHexagrams = hexIndex.map((hex) => JSON.parse(readFileSync(`${OUT_DIR}/${String(hex.id).padStart(2, "0")}.json`, "utf8")));
  const output = {
    schemaVersion: 1,
    generatedBy: {
      kind: "llm",
      model: MODEL,
      baseUrl: BASE_URL,
    },
    source: {
      index: "yijing64/README.md",
      canon: "yijing64/00-总纲-易经六十四卦原文.md",
      detailDirectory: "yijing64/gua",
    },
    trigrams: TRIGRAMS,
    hexagrams: allHexagrams,
  };
  validateDataset(output);
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUT_FILE} with ${allHexagrams.length} hexagrams.`);
}

async function convertHex(hex, canonSection, detailMarkdown) {
  const system = [
    "你是严谨的古籍内容结构化编辑。",
    "任务是把用户提供的《周易》Markdown 转为严格 JSON 数据。",
    "不要摘要、不要改写经文、不要补造来源中没有的信息。",
    "只输出 JSON 对象，不要 Markdown 代码围栏。",
  ].join("\n");

  const user = JSON.stringify({
    instruction: "将 detailMarkdown 和 canonMarkdownForThisHex 结构化为指定 JSON。保留原文信息，拆分为适合 HTML 模板渲染的字段。",
    requiredShape: {
      id: "number",
      name: "string",
      image: "string",
      summary: "string",
      path: "string",
      upper: "string",
      lower: "string",
      bits: "number[6], bottom-to-top, 1 yang and 0 yin",
      title: "string",
      sourceUrl: "string",
      canon: {
        title: "string",
        guaci: "string[]",
        tuan: "string[]",
        xiang: "string[]",
        lines: [{ index: "number 0-5", name: "string", text: "string", imageText: "string" }],
      },
      diagrams: [{ label: "string", alt: "string", src: "string" }],
      overview: {
        original: { text: "string[]", imageText: "string[]" },
        translation: { text: "string[]", imageText: "string[]" },
        duanyi: "string[]",
        shaoyong: "string[]",
        fuPeirong: { text: "string[]", items: [{ label: "string", text: "string" }] },
        traditional: { text: "string[]", items: [{ label: "string", text: "string" }] },
        philosophy: "string[]",
      },
      lines: [
        {
          index: "number 0-5, bottom-to-top",
          name: "string, e.g. 初九",
          heading: "string",
          original: { text: "string[]", imageText: "string[]" },
          translation: { text: "string[]", imageText: "string[]" },
          shaoyong: "string[]",
          fuPeirong: { text: "string[]", items: [{ label: "string", text: "string" }] },
          change: {
            images: [{ alt: "string", src: "string" }],
            description: "string",
            targetId: "number|null",
            targetName: "string",
            targetImage: "string",
          },
          philosophy: "string[]",
        },
      ],
    },
    hardRules: [
      "canon.lines 必须有 6 项。",
      "lines 必须有 6 项，顺序为初爻到上爻。",
      "保留所有图片 URL 到 diagrams 或 change.images。",
      "傅佩荣、传统解卦中形如 时运：、财运：、事业： 的内容放入 items。",
      "如果字段来源缺失，用空数组、空字符串或 null，不要虚构。",
    ],
    knownIndex: hex,
    canonMarkdownForThisHex: canonSection,
    detailMarkdown,
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
  const text = await chat(system, user);
  try {
      return withCanonicalIndex(JSON.parse(stripCodeFence(text)), hex);
    } catch (error) {
      if (attempt === 3) throw new Error(`LLM returned invalid JSON for ${hex.id}: ${error.message}\n${text.slice(0, 1000)}`);
    }
  }
}

function withCanonicalIndex(structured, hex) {
  return {
    ...structured,
    id: hex.id,
    name: hex.name,
    image: hex.image,
    summary: hex.summary,
    path: hex.path,
    upper: hex.upper,
    lower: hex.lower,
    bits: hex.bits,
  };
}

async function chat(system, user) {
  const response = await fetch(`${BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed ${response.status}: ${body}`);
  }
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`LLM response missing message content: ${JSON.stringify(json).slice(0, 1000)}`);
  return content;
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

function splitCanon(markdown) {
  const heads = [...markdown.matchAll(/^##\s+(\d{2})\s+(.+)$/gm)];
  return new Map(
    heads.map((head, index) => [
      Number(head[1]),
      markdown.slice(head.index, heads[index + 1]?.index ?? markdown.length).trim(),
    ]),
  );
}

function validateDataset(data) {
  if (data.hexagrams.length !== 64) throw new Error(`Expected 64 hexagrams, got ${data.hexagrams.length}`);
  for (const hex of data.hexagrams) validateHex(hex, hex);
}

function validateHex(hex, expected) {
  if (hex.id !== expected.id) throw new Error(`Expected id ${expected.id}, got ${hex.id}`);
  for (const key of ["name", "image", "summary", "path", "upper", "lower"]) {
    if (hex[key] !== expected[key]) throw new Error(`Hex ${expected.id} field ${key} mismatch: ${hex[key]} !== ${expected[key]}`);
  }
  if (!Array.isArray(hex.bits) || hex.bits.length !== 6) throw new Error(`Hex ${expected.id} bits must have 6 values`);
  if (!hex.canon || !Array.isArray(hex.canon.lines) || hex.canon.lines.length !== 6) throw new Error(`Hex ${expected.id} canon.lines must have 6 values`);
  if (!Array.isArray(hex.lines) || hex.lines.length !== 6) throw new Error(`Hex ${expected.id} lines must have 6 values`);
  if (!hex.overview || !hex.overview.original || !hex.overview.translation) throw new Error(`Hex ${expected.id} overview blocks missing`);
}

function stripCodeFence(text) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}
