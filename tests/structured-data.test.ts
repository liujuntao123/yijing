import data from "../src/data/yijing.json";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("LLM structured yijing data", () => {
  it("keeps generated JSON synchronized with the Markdown corpus", () => {
    expect(() => execFileSync("node", ["scripts/build_structured_yijing.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("contains complete structured data for all 64 hexagrams", () => {
    expect(data.generatedBy.kind).toBe("markdown");
    expect(data.hexagrams).toHaveLength(64);

    for (const hex of data.hexagrams) {
      expect(hex.canon.lines, `${hex.id} canon lines`).toHaveLength(6);
      expect(hex.lines, `${hex.id} detail lines`).toHaveLength(6);
      expect(hex.overview.original).toBeDefined();
      expect(hex.overview.translation).toBeDefined();
      expect(hex.diagrams.length, `${hex.id} diagrams`).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps important known structured fields addressable", () => {
    const qian = data.hexagrams[0];
    expect(qian.canon.guaci.join("")).toContain("乾：元，亨，利，贞。");
    expect(qian.lines[0].name).toBe("初九");
    expect(qian.lines[0].change.targetId).toBe(44);
    expect(qian.lines[0].fuPeirong.items.map((item) => item.label)).toContain("时运");

    const tai = data.hexagrams[10];
    expect(tai.overview.original.text.join("")).toContain("泰。小往大来，吉亨。");
    expect(tai.overview.original.text.join("")).not.toContain("豫卦原文");
    expect(tai.lines[0].translation.text.join("")).toContain("初九：连根拨掉茅草");
    expect(tai.lines[0].fuPeirong.items.map((item) => item.label)).toEqual(["时运", "财运", "家宅", "身体"]);
  });
});
