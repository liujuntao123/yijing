import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HexLine } from "./HexLine";
import data from "./data/yijing.json";
import {
  type Bit,
  type Hexagram,
  type Trigram,
  TRIGRAMS,
  bitsKey,
  changedBits,
  findHexByBits,
  lineWord,
} from "./yijing";

type StructuredDataset = typeof data;
type StructuredHexagram = StructuredDataset["hexagrams"][number];
type AspectBlock = StructuredHexagram["overview"]["fuPeirong"];
type ClassicBlock = StructuredHexagram["overview"]["original"];
type DetailLine = StructuredHexagram["lines"][number];
type CanonLine = StructuredHexagram["canon"]["lines"][number];

const hexagrams = data.hexagrams as unknown as StructuredHexagram[];
const navHexagrams = hexagrams as unknown as Hexagram[];
const ANIMATION_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function scrollToAnchoredElement(id: string) {
  requestAnimationFrame(() => {
    const target = document.getElementById(id);
    if (!target) return;

    const scroller = target.closest<HTMLElement>(".hex-view");
    if (scroller && getComputedStyle(scroller).overflowY !== "visible") {
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      scroller.scrollTo({
        top: scroller.scrollTop + targetRect.top - scrollerRect.top - 18,
        behavior: "smooth",
      });
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function App() {
  const [activeHexId, setActiveHexId] = useState(1);
  const [activeLine, setActiveLine] = useState(0);
  const [indexOpen, setIndexOpen] = useState(false);
  const activeHex = hexagrams.find((hex) => hex.id === activeHexId) ?? hexagrams[0];
  const toggleIndex = useCallback(() => setIndexOpen((open) => !open), []);
  const closeIndex = useCallback(() => setIndexOpen(false), []);

  const selectHex = (id: number, line = 0) => {
    setActiveHexId(id);
    setActiveLine(line);
  };

  return (
    <div className={`app ${indexOpen ? "index-open" : "index-collapsed"}`}>
      <div className="book-gutter" aria-hidden="true">
        <span className="writing-vertical">周易 · 第{activeHex.id}卦</span>
        <span className="gutter-rule" />
        <span className="gutter-mark" />
        <span className="gutter-rule" />
        <span className="writing-vertical">{activeHex.name}</span>
      </div>
      <div className="page-watermark" aria-hidden="true">
        {Array.from(activeHex.name.replace(/卦$/, "")).map((char, index) => (
          <span key={`${char}-${index}`}>{char}</span>
        ))}
      </div>
      <HexIndexNav
        hexagrams={hexagrams}
        activeHex={activeHex}
        open={indexOpen}
        onToggle={toggleIndex}
        onClose={closeIndex}
        onSelectHex={selectHex}
      />
      <header className="site-header">
        <div className="title-block">
          <div className="brand-mark">易</div>
          <div>
            <h1>周易64卦</h1>
            <p>周易/象传/彖传</p>
          </div>
          <a
            className="header-icon-link"
            href="https://github.com/liujuntao123/yijing"
            target="_blank"
            rel="noreferrer"
            aria-label="打开 GitHub 仓库"
            title="GitHub"
          >
            <svg className="github-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 0.3C5.4 0.3 0 5.7 0 12.4c0 5.3 3.4 9.8 8.2 11.4 0.6 0.1 0.8-0.3 0.8-0.6v-2.1c-3.3 0.7-4-1.6-4-1.6-0.5-1.4-1.3-1.8-1.3-1.8-1.1-0.7 0.1-0.7 0.1-0.7 1.2 0.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 0.1-0.8 0.4-1.3 0.8-1.6-2.7-0.3-5.5-1.3-5.5-5.9 0-1.3 0.5-2.4 1.2-3.2-0.1-0.3-0.5-1.5 0.1-3.2 0 0 1-0.3 3.3 1.2 1-0.3 2-0.4 3-0.4s2.1 0.1 3 0.4c2.3-1.5 3.3-1.2 3.3-1.2 0.6 1.7 0.2 2.9 0.1 3.2 0.8 0.9 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9 0.4 0.4 0.8 1.1 0.8 2.2v3.3c0 0.3 0.2 0.7 0.8 0.6C20.6 22.2 24 17.7 24 12.4 24 5.7 18.6 0.3 12 0.3Z" />
            </svg>
          </a>
        </div>
      </header>

      <main>
        <section className="workbench">
          <BaguaView
            activeHex={activeHex}
            hexagrams={navHexagrams}
            activeLine={activeLine}
            onSelectHex={selectHex}
            onSelectLine={setActiveLine}
          />
          <AnimatePresence initial={false} mode="wait">
            <HexView key={`hex-${activeHex.id}`} activeHex={activeHex} activeLine={activeLine} onSelectHex={selectHex} onSelectLine={setActiveLine} />
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

function HexIndexNav({
  hexagrams,
  activeHex,
  open,
  onToggle,
  onClose,
  onSelectHex,
}: {
  hexagrams: StructuredHexagram[];
  activeHex: StructuredHexagram;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectHex: (id: number) => void;
}) {
  const reduce = useReducedMotion();
  const indexRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const filtered = hexagrams.filter((hex) => `${hex.id}${hex.name}${hex.image}${hex.summary}`.includes(query.trim()));

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!indexRef.current?.contains(event.target)) onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose, open]);

  return (
    <aside ref={indexRef} className={`floating-index ${open ? "expanded" : "collapsed"}`} aria-label="卦辞检索">
      <button
        className="nav-toggle"
        type="button"
        aria-label={open ? "收起卦辞检索" : "展开卦辞检索"}
        aria-expanded={open}
        aria-controls="hex-index-panel"
        onClick={onToggle}
      >
        {open ? <X className="nav-toggle-icon" aria-hidden="true" /> : <Search className="nav-toggle-icon" aria-hidden="true" />}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="hex-index-panel"
            className="index-panel-content"
            initial={reduce ? false : { opacity: 0, x: -8, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.98 }}
            transition={{ duration: reduce ? 0.01 : 0.3, ease: ANIMATION_EASE }}
          >
            <div className="hex-tools">
              <label>
                <span>检索</span>
                <input type="search" placeholder="搜索卦名、卦象、简义" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <label>
                <span>选卦</span>
                <select aria-label="选择六十四卦" value={activeHex.id} onChange={(event) => onSelectHex(Number(event.target.value))}>
                  {hexagrams.map((hex) => (
                    <option key={hex.id} value={hex.id}>
                      {hex.id}. {hex.name}（{hex.image}）
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="hex-list">
              {filtered.map((hex) => (
                <motion.button
                  key={hex.id}
                  className={hex.id === activeHex.id ? "active" : ""}
                  type="button"
                  onClick={() => onSelectHex(hex.id)}
                  initial={reduce ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(hex.id, 12) * 0.015 }}
                >
                  <div className="hex-entry">
                    <div className="line-stack">
                      {[...hex.bits].map((bit, index) => (
                        <HexLine key={index} bit={bit as Bit} />
                      )).reverse()}
                    </div>
                    <div>
                      <strong>
                        {hex.id}. {hex.name}
                      </strong>
                      <small>
                        {hex.image} / {hex.summary}
                      </small>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </aside>
  );
}

function BaguaView({
  activeHex,
  hexagrams,
  activeLine,
  onSelectHex,
  onSelectLine,
}: {
  activeHex: StructuredHexagram;
  hexagrams: Hexagram[];
  activeLine: number;
  onSelectHex: (id: number, line?: number) => void;
  onSelectLine: (line: number) => void;
}) {
  const currentBits = activeHex.bits as unknown as Hexagram["bits"];
  const lowerKey = bitsKey(currentBits.slice(0, 3));
  const upperKey = bitsKey(currentBits.slice(3, 6));
  const lowerTrigram = TRIGRAMS.find((gua) => bitsKey(gua.bits) === lowerKey);
  const upperTrigram = TRIGRAMS.find((gua) => bitsKey(gua.bits) === upperKey);
  const activeTrigramKeys = [lowerKey, upperKey];
  const changed = findHexByBits(hexagrams, changedBits(currentBits, activeLine));
  const activeLineLabel = lineWord(currentBits[activeLine], activeLine);

  const pickTrigram = (gua: Trigram) => {
    const hex = findHexByBits(hexagrams, [...gua.bits, ...gua.bits]);
    if (hex) onSelectHex(hex.id);
  };

  const toggleLine = (index: number) => {
    const hex = findHexByBits(hexagrams, changedBits(currentBits, index));
    if (hex) onSelectHex(hex.id, index);
  };

  return (
    <section className="view bagua-view">
      <div className="circle-wrap">
        <div className="bagua-circle" aria-label="八卦入口">
          {TRIGRAMS.map((gua, index) => (
            <button
              key={gua.key}
              className={`trigram-btn ${activeTrigramKeys.includes(bitsKey(gua.bits)) ? "active" : ""}`}
              type="button"
              style={{ "--angle": `${index * 45}deg` } as React.CSSProperties}
              onClick={() => pickTrigram(gua)}
            >
              <span className="trigram-name">{gua.name}</span>
              <span className="trigram-lines" aria-hidden="true">
                {[...gua.bits].reverse().map((bit, lineIndex) => (
                  <HexLine key={lineIndex} bit={bit} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside className="panel panel-pad reading-panel bagua-control">
        <section className="bagua-section change-box compact-change-box" aria-label={`${activeLineLabel}变卦`}>
          <div className="compact-change-text">
            <span>{activeLineLabel}变卦</span>
            {changed ? (
              <strong>
                {changed.id}. {changed.name}
              </strong>
            ) : null}
          </div>
          <div className="change-actions">
            {changed ? (
              <button className="pill" type="button" onClick={() => onSelectHex(changed.id, activeLine)}>
                变卦为 {changed.name}
              </button>
            ) : null}
          </div>
        </section>
        <section className="bagua-section line-editor-section">
          <div className="line-editor-body">
            <div className="hex-orb compact-hex-orb">
              <div className="hex-orb-labels" aria-hidden="true">
                <span>
                  <small>上卦</small>
                  <strong>{upperTrigram?.name ?? activeHex.upper}</strong>
                </span>
                <span>
                  <small>下卦</small>
                  <strong>{lowerTrigram?.name ?? activeHex.lower}</strong>
                </span>
              </div>
              <div className="large-line-stack side-lines" aria-label={`${activeHex.name}卦象，点击切换爻`}>
                {[...currentBits].map((bit, index) => (
                  <HexLine
                    key={index}
                    bit={bit}
                    selected={activeLine === index}
                    label={`${lineWord(bit, index)}，点击切换`}
                    onClick={() => {
                      onSelectLine(index);
                      toggleLine(index);
                    }}
                  />
                )).reverse()}
              </div>
            </div>
            <LineTable lines={activeHex.canon.lines} activeLine={activeLine} onSelectLine={onSelectLine} compact />
          </div>
        </section>
      </aside>
    </section>
  );
}

function HexView({
  activeHex,
  activeLine,
  onSelectHex,
  onSelectLine,
}: {
  activeHex: StructuredHexagram;
  activeLine: number;
  onSelectHex: (id: number, line?: number) => void;
  onSelectLine: (line: number) => void;
}) {
  const reduce = useReducedMotion();
  const line = activeHex.lines[activeLine] ?? activeHex.lines[0];
  const overview = useMemo(() => activeHex.overview, [activeHex]);

  return (
    <motion.section
      className="view hex-view"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -12 }}
      transition={{ duration: reduce ? 0.01 : 0.46, ease: ANIMATION_EASE }}
    >
      <article id="hex-detail" className="panel panel-pad reading-panel summary-panel">
        <div className="detail-head compact-head">
          <div>
            <div className="section-kicker">
              第{activeHex.id}卦 / {activeHex.upper}上{activeHex.lower}下
            </div>
            <h2>{activeHex.image}</h2>
            <div className="muted">
              本卦：{activeHex.image} / {activeHex.summary}
            </div>
          </div>
          <a
            className="pill anchor-pill"
            href="#line-detail"
            onClick={(event) => {
              event.preventDefault();
              scrollToAnchoredElement("line-detail");
            }}
          >
            查看爻辞
          </a>
        </div>

        <div className="structured-html">
          <TypewriterQuote paragraphs={activeHex.canon.guaci} runKey={activeHex.id} />

          <div className="canon-grid">
            <ClassicPanel title="彖辞" paragraphs={activeHex.canon.tuan} />
            <ClassicPanel title="象辞" paragraphs={activeHex.canon.xiang} muted />
          </div>

          <section className="source-block">
            <div className="block-label">卦辞原文</div>
            <ClassicBlockView block={overview.original} />
            <ClassicBlockView block={overview.translation} quiet title="白话文解释" />
          </section>

          <section id="line-detail" className="line-focus">
            <div className="line-focus-head">
              <div>
                <div className="block-label">当前爻辞</div>
                <h3>{line.name || lineWord(activeHex.bits[activeLine] as Bit, activeLine)}</h3>
              </div>
              <span>{line.heading}</span>
            </div>
            <ClassicBlockView block={line.original} />
            <ClassicBlockView block={line.translation} quiet title="白话浅释" />
          </section>

          <ChangeBlock line={line} onSelectHex={onSelectHex} activeLine={activeLine} />

          <div className="scholar-grid">
            <ScholarPanel title="邵雍解" paragraphs={line.shaoyong.length ? line.shaoyong : overview.shaoyong} />
            <AspectPanel title="傅佩荣解" block={line.fuPeirong.items.length || line.fuPeirong.text.length ? line.fuPeirong : overview.fuPeirong} />
          </div>

          <AspectPanel title="传统解卦" block={overview.traditional} wide />
          <ParagraphPanel title={`${line.name}爻的哲学含义`} paragraphs={line.philosophy} />
          <ParagraphPanel title="本卦哲学含义" paragraphs={overview.philosophy} />
        </div>
      </article>
    </motion.section>
  );
}

function TypewriterQuote({ paragraphs, runKey }: { paragraphs: string[]; runKey: number }) {
  const reduce = useReducedMotion();
  const shouldReduce = Boolean(reduce);
  const fullLength = useMemo(() => paragraphs.reduce((total, text) => total + Array.from(text).length, 0), [paragraphs]);
  const [visibleCount, setVisibleCount] = useState(() => (shouldReduce ? fullLength : 0));

  useEffect(() => {
    if (shouldReduce) {
      setVisibleCount(fullLength);
      return;
    }

    let timeout: number | undefined;
    setVisibleCount(0);

    const tick = () => {
      setVisibleCount((count) => {
        const next = Math.min(count + 1, fullLength);
        if (next < fullLength) timeout = window.setTimeout(tick, 55);
        return next;
      });
    };

    timeout = window.setTimeout(tick, 180);
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [fullLength, runKey, shouldReduce]);

  let remaining = visibleCount;
  let cursorIndex = paragraphs.length - 1;
  const visibleParagraphs = paragraphs.map((text, index) => {
    const chars = Array.from(text);
    const visibleText = chars.slice(0, Math.max(0, remaining)).join("");
    if (remaining >= 0 && remaining < chars.length) cursorIndex = index;
    remaining -= chars.length;
    return visibleText;
  });

  return (
    <section className="classic-quote" aria-label={paragraphs.join(" ")}>
      <div className="classic-quote-measure" aria-hidden="true">
        {paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
      <div className="classic-quote-typed" aria-hidden="true">
        {visibleParagraphs.map((text, index) => (
          <p key={`${paragraphs[index]}-${index}`}>
            {text}
            {visibleCount < fullLength && index === cursorIndex && !shouldReduce ? <span className="type-cursor" /> : null}
          </p>
        ))}
      </div>
    </section>
  );
}

function LineTable({
  lines,
  activeLine,
  onSelectLine,
  compact = false,
}: {
  lines: CanonLine[];
  activeLine: number;
  onSelectLine: (line: number) => void;
  compact?: boolean;
}) {
  const displayLines = [...lines].reverse();
  const scrollToLineDetail = () => {
    scrollToAnchoredElement("line-detail");
  };

  return (
    <section className={`line-table ${compact ? "compact-line-table" : ""}`}>
      <div className="line-table-list">
        {displayLines.map((canonLine) => (
          <button
            key={canonLine.index}
            className={`line-row ${activeLine === canonLine.index ? "active" : ""}`}
            type="button"
            aria-label={`${canonLine.name}，点击查看爻辞`}
            onClick={() => {
              onSelectLine(canonLine.index);
              scrollToLineDetail();
            }}
          >
            <span className="line-row-name">{canonLine.name}</span>
            <span className="line-row-text">{canonLine.text}</span>
            <span className="line-row-image">{canonLine.imageText}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ClassicPanel({ title, paragraphs, muted = false }: { title: string; paragraphs: string[]; muted?: boolean }) {
  return (
    <section className={`classic-panel ${muted ? "muted-panel" : ""}`}>
      <span>{title}</span>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}

function ClassicBlockView({ block, quiet = false, title }: { block: ClassicBlock; quiet?: boolean; title?: string }) {
  return (
    <div className={`classic-block ${quiet ? "quiet" : ""}`}>
      {title ? <h4>{title}</h4> : null}
      {block.text.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {block.imageText.map((paragraph) => (
        <p className="image-text" key={paragraph}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function ChangeBlock({ line, activeLine, onSelectHex }: { line: DetailLine; activeLine: number; onSelectHex: (id: number, line?: number) => void }) {
  const targetId = line.change.targetId;
  return (
    <section className="change-template change-box">
      <div>
        <div className="block-label">爻变与卦变</div>
        <h3>{targetId ? `变为 ${targetId}. ${line.change.targetName}` : "变卦"}</h3>
        <p>{line.change.description || "此爻暂无结构化变卦说明。"}</p>
        {targetId ? (
          <button className="pill" type="button" onClick={() => onSelectHex(targetId, activeLine)}>
            变卦为 {line.change.targetName}
          </button>
        ) : null}
      </div>
      <div className="change-figure">
        {line.change.images[0] ? <img src={line.change.images[0].src} alt={line.change.images[0].alt} loading="lazy" /> : <span>变</span>}
      </div>
    </section>
  );
}

function ScholarPanel({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <section className="scholar-panel">
      <h3>{title}</h3>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}

function AspectPanel({ title, block, wide = false }: { title: string; block: AspectBlock; wide?: boolean }) {
  return (
    <section className={`scholar-panel aspect-panel ${wide ? "wide" : ""}`}>
      <h3>{title}</h3>
      {block.text.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <div className="aspect-list">
        {block.items.map((item) => (
          <div key={`${item.label}-${item.text}`}>
            <span>{item.label}</span>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ParagraphPanel({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  if (!paragraphs.length) return null;
  return (
    <section className="prose-panel">
      <h3>{title}</h3>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}
