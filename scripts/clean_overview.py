#!/usr/bin/env python3
from __future__ import annotations

import html
import re
from html.parser import HTMLParser
from pathlib import Path


SOURCE = Path("易经 64 卦卦象、卦辞、爻辞、彖辞、象辞原文完整版.md")
TARGET = Path("yijing64/00-总纲-易经六十四卦原文.md")
README = Path("yijing64/README.md")


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self.row: list[str] = []
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self.row = []
        elif tag == "td":
            self.cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self.cell is not None:
            self.row.append(clean_inline("".join(self.cell)))
            self.cell = None
        elif tag == "tr" and self.row:
            self.rows.append(self.row)

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell.append(data)


def clean_inline(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace("《象》日", "《象》曰")
    return text.strip()


def table_to_md(raw: str) -> str:
    parser = TableParser()
    parser.feed(raw)
    rows = ["| 爻辞 | 小象 |", "| --- | --- |"]
    for row in parser.rows:
        if len(row) >= 2:
            rows.append(f"| {row[0]} | {row[1]} |")
    return "\n".join(rows)


def clean() -> str:
    text = SOURCE.read_text(encoding="utf-8")
    tables: list[str] = []

    def save_table(match: re.Match[str]) -> str:
        tables.append(table_to_md(match.group(0)))
        return f"\n@@TABLE{len(tables) - 1}@@\n"

    text = re.sub(r"<table\b.*?</table>", save_table, text, flags=re.S)
    lines = text.splitlines()
    out = [
        "# 易经六十四卦原文总纲",
        "",
        "> 整理自原始转码文件；已去除转码说明、外链、图片与 HTML 表格噪音。",
        "",
    ]

    for line in lines:
        line = line.strip()
        if not line:
            if out and out[-1]:
                out.append("")
            continue
        if line.startswith("> 本文由") or line.startswith("![]("):
            continue
        if "点赞、收藏" in line or "友友们" in line:
            continue
        if re.fullmatch(r"-{3,}", line):
            continue
        line = clean_inline(line)
        line = line.replace("55 丰卦 雷火 丰震上离下", "55 丰卦 雷火丰 震上离下")
        line = re.sub(r"^\*\s+", "- ", line)
        heading = re.match(r"^(?:\*\*)?(\d{1,2})\s*(?:卦\s*)?(.+?卦)\s+(.+?)\s+(.+上.+下)(?:\*\*)?$", line)
        if heading:
            no, name, image, stack = heading.groups()
            out += ["", f"## {int(no):02d} {name} {image}（{stack}）", ""]
            continue
        table = re.fullmatch(r"@@TABLE(\d+)@@", line)
        if table:
            out += ["### 爻辞与小象", "", tables[int(table.group(1))], ""]
            continue
        line = re.sub(r"^《彖》曰：", "### 彖辞\n\n", line)
        line = re.sub(r"^《象》曰：", "### 象辞\n\n", line)
        out.append(line)

    cleaned: list[str] = []
    for line in out:
        if not line and cleaned and not cleaned[-1]:
            continue
        cleaned.append(line)
    while cleaned and not cleaned[-1]:
        cleaned.pop()
    return "\n".join(cleaned) + "\n"


def update_readme() -> None:
    text = README.read_text(encoding="utf-8")
    block = "## 总纲\n\n- [易经六十四卦原文总纲](00-总纲-易经六十四卦原文.md)\n\n## 六十四卦详情\n\n"
    if "## 总纲" in text:
        return
    text = text.replace("来源索引：https://www.zhouyi.cc/zhouyi/yijing64/\n\n", "来源索引：https://www.zhouyi.cc/zhouyi/yijing64/\n\n" + block)
    README.write_text(text, encoding="utf-8")


def main() -> None:
    TARGET.write_text(clean(), encoding="utf-8")
    update_readme()
    s = TARGET.read_text(encoding="utf-8")
    assert s.count("\n## ") == 64
    assert s.count("### 爻辞与小象") == 64
    assert "<table" not in s and "zhihu.com" not in s and "SimpRead" not in s
    print(TARGET)


if __name__ == "__main__":
    main()
