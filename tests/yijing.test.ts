import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/markdown";
import { TRIGRAMS, changedBits, findHexByBits, parseBriefs, parseIndex, splitHexText } from "../src/yijing";

describe("yijing parser", () => {
  const hexagrams = parseIndex(readFileSync("yijing64/README.md", "utf8"));

  it("parses all 64 hexagrams", () => {
    expect(hexagrams).toHaveLength(64);
  });

  it("maps trigram images to bottom-to-top line bits", () => {
    expect(hexagrams.find((hex) => hex.name === "乾卦")?.bits).toEqual([1, 1, 1, 1, 1, 1]);
    expect(hexagrams.find((hex) => hex.name === "坤卦")?.bits).toEqual([0, 0, 0, 0, 0, 0]);
    expect(findHexByBits(hexagrams, [1, 0, 0, 0, 1, 0])?.name).toBe("屯卦");
  });

  it("orders trigrams clockwise like the Fu Xi diagram", () => {
    expect(TRIGRAMS.map((gua) => gua.key)).toEqual(["qian", "xun", "kan", "gen", "kun", "zhen", "li", "dui"]);
  });

  it("finds changed hexagrams by line", () => {
    const qian = hexagrams.find((hex) => hex.name === "乾卦");
    expect(qian).toBeDefined();
    expect(findHexByBits(hexagrams, changedBits(qian!.bits, 0))?.name).toBe("姤卦");
  });

  it("splits overview and six line explanations", () => {
    const parts = splitHexText(readFileSync("yijing64/gua/01-乾卦-乾为天.md", "utf8"));
    expect(parts.overview).toContain("乾卦原文");
    expect(parts.overview).toContain("卦图");
    expect(parts.overview).toContain("来源：https://www.zhouyi.cc/zhouyi/yijing64/4103.html");
    expect(parts.lines).toHaveLength(6);
    expect(parts.lines[0]).toContain("初九");
    expect(parts.lines[0]).toContain("![图]");
  });

  it("keeps the 64 detail files aligned with the index", () => {
    for (const hex of hexagrams) {
      const markdown = readFileSync(hex.path.slice(1), "utf8");
      expect(markdown).toContain(`- 卦名：${hex.name}`);
      expect(markdown).toContain(`- 卦象：${hex.image}`);
      expect(markdown).toContain(`- 简义：${hex.summary}`);
      const parts = splitHexText(markdown);
      expect(parts.overview).toContain(`${hex.name.replace(/卦$/, "")}卦原文`);
      expect(parts.lines).toHaveLength(6);
    }
  });

  it("classifies every detail markdown into styled content kinds", () => {
    for (const hex of hexagrams) {
      const kinds = [...new Set(parseMarkdown(readFileSync(hex.path.slice(1), "utf8")).map((block) => block.kind))];
      expect(kinds).toEqual(expect.arrayContaining(["metadata", "diagram", "source", "translation", "change", "philosophy"]));
    }
  });

  it("keeps the cleaned source overview complete", () => {
    const overview = readFileSync("yijing64/00-总纲-易经六十四卦原文.md", "utf8");
    expect(overview.match(/^##\s+/gm)).toHaveLength(64);
    expect(overview.match(/^### 爻辞与小象$/gm)).toHaveLength(64);
    const kinds = [...new Set(parseMarkdown(overview).map((block) => block.kind))];
    expect(kinds).toEqual(expect.arrayContaining(["hex-overview", "judgement", "image-text", "line-table"]));
  });

  it("extracts per-hexagram briefs from the cleaned overview", () => {
    const briefs = parseBriefs(readFileSync("yijing64/00-总纲-易经六十四卦原文.md", "utf8"));
    expect(briefs).toHaveLength(64);
    expect(briefs.get(1)?.title).toBe("乾卦 乾为天（乾上乾下）");
    expect(briefs.get(1)?.text).toContain("乾：元，亨，利，贞。");
    expect(briefs.get(1)?.text).not.toContain("## 02 坤卦");
  });
});
