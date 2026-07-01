import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HexLine } from "./HexLine";
import { Markdown } from "./markdown";
import {
  type HexBrief,
  type Hexagram,
  type Trigram,
  TRIGRAMS,
  bitsKey,
  changedBits,
  findHexByBits,
  lineWord,
  parseBriefs,
  parseIndex,
  splitHexText,
} from "./yijing";

type HexTextState = {
  hexId: number;
  markdown: string;
};

export function App() {
  const [hexagrams, setHexagrams] = useState<Hexagram[]>([]);
  const [activeHexId, setActiveHexId] = useState(1);
  const [activeLine, setActiveLine] = useState(0);
  const [hexText, setHexText] = useState<HexTextState | null>(null);
  const [briefs, setBriefs] = useState<Map<number, HexBrief>>(new Map());
  const [indexOpen, setIndexOpen] = useState(false);
  const activeHex = hexagrams.find((hex) => hex.id === activeHexId);

  useEffect(() => {
    fetchText("/yijing64/README.md").then((text) => setHexagrams(parseIndex(text)));
    fetchText("/yijing64/00-总纲-易经六十四卦原文.md").then((text) => setBriefs(parseBriefs(text)));
  }, []);

  useEffect(() => {
    if (!activeHex) return;
    fetchText(activeHex.path).then((markdown) => setHexText({ hexId: activeHex.id, markdown }));
  }, [activeHex]);

  const selectHex = (id: number, line = 0) => {
    setActiveHexId(id);
    setActiveLine(line);
  };

  return (
    <div className={`app ${indexOpen ? "index-open" : "index-collapsed"}`}>
      <HexIndexNav
        hexagrams={hexagrams}
        activeHex={activeHex}
        open={indexOpen}
        onToggle={() => setIndexOpen((open) => !open)}
        onSelectHex={selectHex}
      />
      <header className="site-header">
        <div className="title-block">
          <div className="brand-mark">周易</div>
          <div>
            <h1>易经八卦与六十四卦查询</h1>
            <p>观象、取义、察变，一处读懂八卦与六十四卦原文。</p>
          </div>
        </div>
      </header>

      <main>
        <section className="workbench">
          <BaguaView
            activeHex={activeHex}
            hexagrams={hexagrams}
            activeLine={activeLine}
            onSelectHex={selectHex}
            onSelectLine={setActiveLine}
          />
          <HexSummary activeHex={activeHex} brief={activeHex ? briefs.get(activeHex.id) : undefined} />
          <HexView
            hexagrams={hexagrams}
            activeHex={activeHex}
            activeLine={activeLine}
            hexMarkdown={hexText && hexText.hexId === activeHex?.id ? hexText.markdown : ""}
            onSelectHex={selectHex}
            onSelectLine={setActiveLine}
          />
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
  onSelectHex,
}: {
  hexagrams: Hexagram[];
  activeHex?: Hexagram;
  open: boolean;
  onToggle: () => void;
  onSelectHex: (id: number) => void;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const filtered = hexagrams.filter((hex) => `${hex.id}${hex.name}${hex.image}${hex.summary}`.includes(query.trim()));

  return (
    <aside className={`floating-index ${open ? "expanded" : "collapsed"}`} aria-label="卦辞检索">
      <button
        className="nav-toggle"
        type="button"
        aria-label={open ? "收起卦辞检索" : "展开卦辞检索"}
        aria-expanded={open}
        aria-controls="hex-index-panel"
        onClick={onToggle}
      >
        <span className="hamburger-lines" aria-hidden="true" />
      </button>
      {open ? (
        <div id="hex-index-panel" className="index-panel-content">
          <div className="hex-tools">
            <label>
              <span>检索</span>
              <input type="search" placeholder="搜索卦名、卦象、简义" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span>选卦</span>
              <select aria-label="选择六十四卦" value={activeHex?.id ?? ""} onChange={(event) => onSelectHex(Number(event.target.value))}>
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
                className={hex.id === activeHex?.id ? "active" : ""}
                type="button"
                onClick={() => onSelectHex(hex.id)}
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: Math.min(hex.id, 12) * 0.015 }}
              >
                <div className="hex-entry">
                  <div className="line-stack">
                    {[...hex.bits].map((bit, index) => (
                      <HexLine key={index} bit={bit} />
                    )).reverse()}
                  </div>
                  <div>
                    <strong>
                      {hex.id}. {hex.name}
                    </strong>
                    <small>
                      {hex.image} · {hex.summary}
                    </small>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      ) : null}
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
  activeHex?: Hexagram;
  hexagrams: Hexagram[];
  activeLine: number;
  onSelectHex: (id: number, line?: number) => void;
  onSelectLine: (line: number) => void;
}) {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<Trigram>(TRIGRAMS[0]);
  const lowerKey = activeHex ? bitsKey(activeHex.bits.slice(0, 3)) : "";
  const upperKey = activeHex ? bitsKey(activeHex.bits.slice(3, 6)) : "";
  const currentBits = activeHex?.bits ?? [...selected.bits, ...selected.bits];
  const changed = activeHex ? findHexByBits(hexagrams, changedBits(activeHex.bits, activeLine)) : undefined;
  const activeLineLabel = activeHex ? lineWord(activeHex.bits[activeLine], activeLine) : "";
  const lineCode = currentBits.map((bit) => (bit ? 9 : 6)).join(" / ");

  const pickTrigram = (gua: Trigram) => {
    setSelected(gua);
    const hex = findHexByBits(hexagrams, [...gua.bits, ...gua.bits]);
    if (hex) onSelectHex(hex.id);
  };

  const toggleLine = (index: number) => {
    if (!activeHex) return;
    const hex = findHexByBits(hexagrams, changedBits(activeHex.bits, index));
    if (hex) onSelectHex(hex.id);
  };

  return (
    <motion.section
      className="view bagua-view"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="circle-wrap">
        <div className="bagua-circle" aria-label="八卦入口">
          {TRIGRAMS.map((gua, index) => (
            <button
              key={gua.key}
              className={`trigram-btn ${gua.key === selected.key ? "active" : ""} ${
                [lowerKey, upperKey].includes(bitsKey(gua.bits)) ? "in-active-hex" : ""
              }`}
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
        <div className="bagua-control-head">
          <div className="bagua-status">
            <span className="bagua-eyebrow">{activeHex ? "当前卦象" : "当前选象"}</span>
            <strong>{activeHex ? `${activeHex.id}. ${activeHex.name}` : `${selected.name}为${selected.nature}`}</strong>
            <span>{activeHex ? `${activeHex.image} · 上${activeHex.upper}下${activeHex.lower}` : selected.text}</span>
          </div>
          <button className="pill reset-pill" type="button" onClick={() => pickTrigram(selected)}>
            复位
          </button>
        </div>
        <section className="bagua-section line-editor-section">
          <div className="bagua-section-title">
            <span>六爻</span>
            <span className="bagua-line-code">当前六爻：{lineCode}</span>
          </div>
          <div className="interactive-lines">
            <div className="trigram-editors">
              <div className="trigram-editor">
                <span>上卦</span>
                <div className="line-stack">
                  {[5, 4, 3].map((index) => (
                    <HexLine key={index} bit={currentBits[index]} label={`${lineWord(currentBits[index], index)}，点击切换`} onClick={() => toggleLine(index)} />
                  ))}
                </div>
              </div>
              <div className="trigram-editor">
                <span>下卦</span>
                <div className="line-stack">
                  {[2, 1, 0].map((index) => (
                    <HexLine key={index} bit={currentBits[index]} label={`${lineWord(currentBits[index], index)}，点击切换`} onClick={() => toggleLine(index)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        {activeHex ? (
          <section className="bagua-section change-box">
            <div className="bagua-section-title">
              <span>{activeLineLabel}变卦</span>
              {changed ? <span className="bagua-line-code">{changed.id}. {changed.name}</span> : null}
            </div>
            <p>
              {changed
                ? `此爻由 ${activeHex.bits[activeLine] ? 9 : 6} 变为 ${activeHex.bits[activeLine] ? 6 : 9}，变为 ${changed.id}. ${changed.name}（${changed.image}）。`
                : "没有找到对应变卦。"}
            </p>
            <div className="change-actions">
              <button className="pill" type="button" onClick={() => onSelectLine(activeLine)}>
                查看{activeLineLabel}
              </button>
              {changed ? (
                <button className="pill" type="button" onClick={() => onSelectHex(changed.id, activeLine)}>
                  跳转到 {changed.name}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </aside>
    </motion.section>
  );
}

function HexSummary({ activeHex, brief }: { activeHex?: Hexagram; brief?: HexBrief }) {
  if (!activeHex) return <article className="panel panel-pad summary-panel">正在读取资料...</article>;

  const title = brief?.title || `${activeHex.name} ${activeHex.image}`;
  const text = brief?.text || activeHex.summary;

  return (
    <article className="panel panel-pad summary-panel">
      <div className="detail-head compact-head">
        <div>
          <h2>
            {activeHex.id}. {title}
          </h2>
          <div className="muted">
            本卦：{activeHex.image} · 上{activeHex.upper}下{activeHex.lower}
          </div>
        </div>
        <a className="pill anchor-pill" href="#hex-detail">
          查看详细介绍
        </a>
      </div>
      <section className="markdown summary-markdown">
        <Markdown text={text} />
      </section>
    </article>
  );
}

function HexView({
  hexagrams,
  activeHex,
  activeLine,
  hexMarkdown,
  onSelectHex,
  onSelectLine,
}: {
  hexagrams: Hexagram[];
  activeHex?: Hexagram;
  activeLine: number;
  hexMarkdown: string;
  onSelectHex: (id: number, line?: number) => void;
  onSelectLine: (line: number) => void;
}) {
  const reduce = useReducedMotion();
  const [showOverview, setShowOverview] = useState(false);
  const parts = useMemo(() => splitHexText(hexMarkdown), [hexMarkdown]);

  useEffect(() => setShowOverview(false), [activeHex?.id, activeLine]);

  if (!activeHex) {
    return (
      <motion.section className="view hex-view" initial={false} animate={{ opacity: 1 }}>
        <article className="panel panel-pad loading-panel">正在读取资料...</article>
      </motion.section>
    );
  }

  const content = showOverview ? parts.overview : parts.lines[activeLine] || parts.overview;

  return (
    <motion.section
      className="view hex-view"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <article id="hex-detail" className="panel panel-pad reading-panel">
        <div className="detail-head hex-detail-head">
          <div>
            <h2>
              {activeHex.id}. {activeHex.name}
            </h2>
            <div className="muted">
              {activeHex.image} · {activeHex.summary} · 上{activeHex.upper}下{activeHex.lower}
            </div>
          </div>
          <div className="detail-actions">
            <button className="pill" type="button" onClick={() => setShowOverview(true)}>
              卦辞总览
            </button>
            <div className="hex-lines" aria-label="选择爻">
              {[...activeHex.bits].map((bit, index) => (
                <div key={index} className={`line-label ${activeLine === index ? "active" : ""}`}>
                  <HexLine bit={bit} selected={activeLine === index} label={`${lineWord(bit, index)}，点击查看爻辞`} onClick={() => onSelectLine(index)} />
                  <span>{lineWord(bit, index)}</span>
                </div>
              )).reverse()}
            </div>
          </div>
        </div>
        <div className="hexagram-area">
          <div className="content-block">
            <section className="markdown">
              <Markdown text={content} />
            </section>
          </div>
        </div>
      </article>
    </motion.section>
  );
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(encodeURI(path));
  if (!response.ok) throw new Error(`读取失败：${path}`);
  return response.text();
}
