#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import time
from dataclasses import dataclass
from hashlib import sha1
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests


BASE = "https://www.zhouyi.cc"
INDEX_URL = f"{BASE}/zhouyi/yijing64/"
OUT = Path("yijing64")
GUA_DIR = OUT / "gua"
ASSET_DIR = OUT / "assets"
UA = "Mozilla/5.0"
LOCAL_IMAGES = False


@dataclass
class GuaLink:
    url: str
    name: str
    image_name: str = ""
    summary: str = ""


def fetch(url: str) -> str:
    last_error: Exception | None = None
    for _ in range(3):
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
            r.raise_for_status()
            r.encoding = "utf-8"
            return r.text
        except requests.RequestException as e:
            last_error = e
            time.sleep(1)
    raise last_error


def clean_text(text: str) -> str:
    text = re.sub(r"\r", "", text)
    text = re.sub(r"[ \t\u3000]+", " ", text)
    lines = [line.strip() for line in text.split("\n")]
    out: list[str] = []
    for line in lines:
        if (
            line.startswith("当前位置：")
            or line.startswith("分享到：")
            or re.match(r"^\d{4}-\d{2}-\d{2}\s*\|", line)
        ):
            continue
        if not line:
            if out and out[-1]:
                out.append("")
            continue
        out.append(line)
    while out and not out[-1]:
        out.pop()
    return "\n".join(out)


def slug(text: str) -> str:
    return re.sub(r'[\\/:*?"<>|\s]+', "-", text).strip("-")


def download_image(url: str, page_id: str, index: int) -> str:
    url = urljoin(BASE, url)
    if not url.startswith(("http://", "https://")):
        return ""
    if not LOCAL_IMAGES:
        return url
    parsed = urlparse(url)
    ext = Path(parsed.path).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        ext = ".png"
    name = f"{page_id}-{sha1(url.encode()).hexdigest()[:10]}{ext}"
    target = ASSET_DIR / name
    if not target.exists():
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=15)
            r.raise_for_status()
            target.write_bytes(r.content)
            time.sleep(0.05)
        except requests.RequestException:
            return url
    return f"../assets/{name}"


class MarkdownHTML(HTMLParser):
    def __init__(self, page_id: str):
        super().__init__(convert_charrefs=True)
        self.page_id = page_id
        self.parts: list[str] = []
        self.skip = 0
        self.image_index = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag in {"script", "style"}:
            self.skip += 1
            return
        if self.skip:
            return
        if tag == "br":
            self.parts.append("\n")
        elif tag in {"p", "div", "tr", "table", "tbody"}:
            self.parts.append("\n")
        elif tag == "li":
            self.parts.append("\n- ")
        elif tag in {"td", "th"}:
            self.parts.append("\n")
        elif tag in {"strong", "b"}:
            self.parts.append("**")
        elif tag == "img":
            src = attrs_dict.get("src")
            if not src:
                return
            self.image_index += 1
            alt = (attrs_dict.get("alt") or "图").strip()
            if alt.startswith(("http://", "https://")):
                alt = "图"
            path = download_image(src, self.page_id, self.image_index)
            if path:
                self.parts.append(f"\n![{alt}]({path})\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if tag in {"p", "div", "tr", "table"}:
            self.parts.append("\n")
        elif tag in {"strong", "b"}:
            self.parts.append("**")

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)

    def markdown(self) -> str:
        text = clean_text("".join(self.parts))
        return re.sub(r"^\*\*(.+?)\*\*$", r"### \1", text, flags=re.M)


def html_to_md(html: str, page_id: str) -> str:
    parser = MarkdownHTML(page_id)
    parser.feed(html)
    return parser.markdown()


def div_text(html: str, class_name: str) -> str:
    m = re.search(rf'<div[^>]*class="[^"]*\b{class_name}\b[^"]*"[^>]*>', html)
    if not m:
        return ""
    end = html.find("</div>", m.end())
    return clean_text(re.sub(r"<[^>]+>", "", html[m.end() : end]))


def extract_index(html: str) -> list[GuaLink]:
    seen: dict[str, GuaLink] = {}
    for m in re.finditer(r'<a[^>]+href="(/zhouyi/yijing64/\d+\.html)"[^>]*>([^<]+)</a>', html):
        url = urljoin(BASE, m.group(1))
        seen.setdefault(url, GuaLink(url=url, name=clean_text(m.group(2))))

    links = list(seen.values())
    for link in links:
        path = re.escape(urlparse(link.url).path)
        li = re.search(rf"<li[^>]*>(?:(?!</li>).)*{path}(?:(?!</li>).)*</li>", html, flags=re.S)
        if li:
            texts = re.findall(r"<p>(.*?)</p>", li.group(0), flags=re.S)
            texts = [clean_text(re.sub(r"<[^>]+>", "", text)) for text in texts]
            if len(texts) >= 3:
                link.image_name = texts[1]
                link.summary = texts[2]
    assert len(links) == 64, f"expected 64 detail links, got {len(links)}"
    return links


def extract_page(link: GuaLink) -> tuple[int, str, str]:
    html = fetch(link.url)
    page_no = int(re.search(r"/(\d+)\.html$", link.url).group(1))
    page_id = str(page_no)

    start = re.search(r'<div[^>]*class="[^"]*\bgua_wp\b[^"]*"[^>]*>', html)
    end = re.search(r'<div[^>]*class="[^"]*\bmain_right\b[^"]*"[^>]*>', html)
    assert start and end, f"content markers missing: {link.url}"
    content = html[start.start() : end.start()]

    title = div_text(content, "gua_toptt")
    order = int(re.search(r"周易第(\d+)卦", title).group(1))
    filename = f"{order:02d}-{slug(link.name)}-{slug(link.image_name)}.md"

    first_section = re.search(r'<div[^>]*class="[^"]*\bguatt\b[^"]*"[^>]*>', content)
    title_match = re.search(r'<div[^>]*class="[^"]*\bgua_toptt\b[^"]*"[^>]*>', content)
    title_close = content.find("</div>", title_match.end()) + len("</div>") if title_match else 0
    intro = content[title_close : first_section.start()] if first_section else content[title_close:]
    sections: list[tuple[str, str]] = []
    starts = list(re.finditer(r'<div[^>]*class="[^"]*\bguatt\b[^"]*"[^>]*>', content))
    for i, m in enumerate(starts):
        title_end = content.find("</div>", m.end())
        section_title = clean_text(re.sub(r"<[^>]+>", "", content[m.end() : title_end]))
        body_start = re.search(r'<div[^>]*class="[^"]*\bgualist\b[^"]*"[^>]*>', content[title_end:])
        if not body_start:
            continue
        body_start_pos = title_end + body_start.end()
        body_end = starts[i + 1].start() if i + 1 < len(starts) else len(content)
        sections.append((section_title, content[body_start_pos:body_end]))

    md = [
        f"# {title}",
        "",
        f"- 卦名：{link.name}",
        f"- 卦象：{link.image_name}",
        f"- 简义：{link.summary}",
        f"- 来源：{link.url}",
    ]
    intro_md = html_to_md(intro, page_id)
    if intro_md:
        md += ["", "## 卦图", "", intro_md]
    for section_title, section_html in sections:
        md += ["", f"## {section_title}", "", html_to_md(section_html, page_id)]

    assert len(sections) >= 7, f"too few sections in {link.url}: {len(sections)}"
    return order, filename, clean_text("\n".join(md)) + "\n"


def main() -> None:
    shutil.rmtree(OUT, ignore_errors=True)
    GUA_DIR.mkdir(parents=True)
    if LOCAL_IMAGES:
        ASSET_DIR.mkdir(parents=True)

    links = extract_index(fetch(INDEX_URL))
    rows: list[tuple[int, str, GuaLink]] = []
    for i, link in enumerate(links, 1):
        order, filename, md = extract_page(link)
        (GUA_DIR / filename).write_text(md, encoding="utf-8")
        rows.append((order, filename, link))
        print(f"{i:02d}/64 {filename}")
        time.sleep(0.1)

    rows.sort()
    readme = [
        "# 易经六十四卦",
        "",
        f"来源索引：{INDEX_URL}",
        "",
        "| 序号 | 卦名 | 卦象 | 简义 | 文件 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for order, filename, link in rows:
        readme.append(f"| {order} | {link.name} | {link.image_name} | {link.summary} | [查看](gua/{filename}) |")
    (OUT / "README.md").write_text("\n".join(readme) + "\n", encoding="utf-8")

    assert len(list(GUA_DIR.glob("*.md"))) == 64
    print(f"done: {OUT}/README.md")


if __name__ == "__main__":
    main()
