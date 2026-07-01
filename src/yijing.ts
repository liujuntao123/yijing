export type Bit = 0 | 1;
export type Bits3 = readonly [Bit, Bit, Bit];
export type Bits6 = readonly [Bit, Bit, Bit, Bit, Bit, Bit];

export type Trigram = {
  key: string;
  name: string;
  nature: string;
  symbol: string;
  bits: Bits3;
  text: string;
};

export type Hexagram = {
  id: number;
  name: string;
  image: string;
  summary: string;
  path: string;
  upper: string;
  lower: string;
  bits: Bits6;
};

export type HexText = {
  overview: string;
  lines: string[];
};

export type HexBrief = {
  title: string;
  text: string;
};

export const TRIGRAMS: readonly Trigram[] = [
  { key: "qian", name: "乾", nature: "天", symbol: "☰", bits: [1, 1, 1], text: "刚健、主动、向上。" },
  { key: "xun", name: "巽", nature: "风", symbol: "☴", bits: [0, 1, 1], text: "入、顺、渐进。" },
  { key: "kan", name: "坎", nature: "水", symbol: "☵", bits: [0, 1, 0], text: "险陷、流动、磨炼。" },
  { key: "gen", name: "艮", nature: "山", symbol: "☶", bits: [0, 0, 1], text: "止、静、边界。" },
  { key: "kun", name: "坤", nature: "地", symbol: "☷", bits: [0, 0, 0], text: "柔顺、承载、厚德。" },
  { key: "zhen", name: "震", nature: "雷", symbol: "☳", bits: [1, 0, 0], text: "发动、震动、初起。" },
  { key: "li", name: "离", nature: "火", symbol: "☲", bits: [1, 0, 1], text: "光明、依附、辨明。" },
  { key: "dui", name: "兑", nature: "泽", symbol: "☱", bits: [1, 1, 0], text: "悦泽、交流、开放。" },
];

const CN_NUM = "一二三四五六七八九十";
const natureToBits = new Map(TRIGRAMS.map((gua) => [gua.nature, gua.bits]));

export function lineWord(bit: Bit, index: number): string {
  if (index === 0) return bit ? "初九" : "初六";
  if (index === 5) return bit ? "上九" : "上六";
  return bit ? `九${CN_NUM[index]}` : `六${CN_NUM[index]}`;
}

export function bitsKey(bits: readonly Bit[]): string {
  return bits.join("");
}

export function parseIndex(markdown: string): Hexagram[] {
  return markdown
    .split("\n")
    .map((line) => line.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*\[查看\]\(([^)]+)\)/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
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
        bits: [...lowerBits, ...upperBits] as unknown as Bits6,
      };
    });
}

export function findHexByBits(hexagrams: readonly Hexagram[], bits: readonly Bit[]): Hexagram | undefined {
  const key = bitsKey(bits);
  return hexagrams.find((hex) => bitsKey(hex.bits) === key);
}

export function changedBits(bits: Bits6, lineIndex: number): Bits6 {
  return bits.map((bit, index) => (index === lineIndex ? bit === 1 ? 0 : 1 : bit)) as unknown as Bits6;
}

export function splitHexText(markdown: string): HexText {
  const lineHeads = [...markdown.matchAll(/^##\s+周易.+?[初九六二三四五上].*?爻详解.*$/gm)].map((match) => match.index);
  const firstLine = lineHeads[0] ?? markdown.length;
  const overview = markdown.slice(0, firstLine).trim();
  const lines = lineHeads.map((index, i) => markdown.slice(index, lineHeads[i + 1] ?? markdown.length).trim());
  return { overview, lines };
}

export function parseBriefs(markdown: string): Map<number, HexBrief> {
  const heads = [...markdown.matchAll(/^##\s+(\d{2})\s+(.+)$/gm)];
  return new Map(
    heads.map((head, index) => {
      const text = markdown
        .slice(head.index! + head[0].length, heads[index + 1]?.index ?? markdown.length)
        .trim();
      return [Number(head[1]), { title: head[2].trim(), text }];
    }),
  );
}
