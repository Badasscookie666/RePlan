import { useState, useRef, useCallback, useMemo, useEffect } from "react";

/* ── FONTS ── */
function useFonts() {
  useEffect(() => {
    const id = "rp-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(l);
  }, []);
}

/* ── DESIGN TOKENS ── */
const C = {
  bg0: "#0a0c10",
  bg1: "#111318",
  bg2: "#16191f",
  bg3: "#1c2029",
  b1:  "rgba(255,255,255,0.07)",
  b2:  "rgba(255,255,255,0.12)",
  b3:  "rgba(255,255,255,0.20)",
  t1:  "#e8eaed",
  t2:  "#8b9099",
  t3:  "#4e5562",
  blue:    "#3b82f6",
  blueBg:  "rgba(59,130,246,0.08)",
  blueBd:  "rgba(59,130,246,0.18)",
  green:   "#22c55e",
  greenBg: "rgba(34,197,94,0.08)",
  greenBd: "rgba(34,197,94,0.20)",
  red:     "#ef4444",
  redBg:   "rgba(239,68,68,0.08)",
  amber:   "#f59e0b",
  radius: { sm: 3, md: 4, lg: 6, xl: 8 },
  font: "'Inter','Segoe UI',system-ui,-apple-system,sans-serif",
  mono: "'IBM Plex Mono',ui-monospace,monospace",
};

/* ── CONSTANTS ── */
const SIDE_W  = 3.2;
const BOARD_H = 2.8;
const FOOT_H  = 5.0;
const GAP     = 0.5;
const START_X = SIDE_W + 1.0;
const DRAG_TH = 1.0;

const PTYPES = [
  { id:"T6",  label:"6×0,33L Träger",  short:"T6",  wCm:40, hCm:15.5, kind:"traeger", cols:3 },
  { id:"T4",  label:"4×0,33L Träger",  short:"T4",  wCm:27, hCm:15.5, kind:"traeger", cols:2 },
  { id:"K20", label:"20×0,5L Kiste",   short:"K20", wCm:40, hCm:30,   kind:"kiste" },
  { id:"K24", label:"24×0,33L Kiste",  short:"K24", wCm:40, hCm:28,   kind:"kiste" },
];
const PMAP = {};
PTYPES.forEach(t => (PMAP[t.id] = t));

const PALETTE = [
  "#2563eb","#16a34a","#dc2626","#ca8a04","#7c3aed",
  "#0891b2","#c2410c","#be185d","#065f46","#1e40af",
];

const C39 = {
  "0":"000110100","1":"100100001","2":"001100001","3":"101100000","4":"000110001",
  "5":"100110000","6":"001110000","7":"000100101","8":"100100100","9":"001100100",
  "A":"100001001","B":"001001001","C":"101001000","D":"000011001","E":"100011000",
  "F":"001011000","G":"000001101","H":"100001100","I":"001001100","J":"000011100",
  "K":"100000011","L":"001000011","M":"101000010","N":"000010011","O":"100010010",
  "P":"001010010","Q":"000000111","R":"100000110","S":"001000110","T":"000010110",
  "U":"110000001","V":"011000001","W":"111000000","X":"010010001","Y":"110010000",
  "Z":"011010000","-":"010000101",".":"110000100","*":"010010100",
  " ":"011000100","$":"010101000","/":"010100010","+":"010001010","%":"000101010",
};

const DEFAULT_CFG = {
  widthM: 1.33, heightM: 2.00,
  levels: [
    { id:"floor", hCm:0,   label:"Boden" },
    { id:"e1",    hCm:40,  label:"Ebene 1" },
    { id:"e2",    hCm:80,  label:"Ebene 2" },
    { id:"e3",    hCm:120, label:"Ebene 3" },
    { id:"e4",    hCm:160, label:"Ebene 4" },
  ],
};

/* ── UTILITIES ── */
const uid    = () => Math.random().toString(36).slice(2, 9);
const pW     = (p) => (PMAP[p.type] || PTYPES[0]).wCm;
const calcSp = (ek, vk) => {
  const e = parseFloat(ek), v = parseFloat(vk);
  if (!e || !v || v === 0) return null;
  return +((v - e) / v * 100).toFixed(2);
};
const spColor = (p) => {
  if (p === null) return "#4e5562";
  if (p >= 35) return "#22c55e"; if (p >= 25) return "#84cc16";
  if (p >= 15) return "#f59e0b"; if (p >= 5)  return "#f97316";
  return "#ef4444";
};
const vkColor = (v, lo, hi) => {
  if (hi <= lo) return "#4e5562";
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return `rgb(${Math.round(30 + t * 195)},${Math.round(120 - t * 95)},${Math.round(250 - t * 205)})`;
};
const fmt = (v) => v ? `${parseFloat(v).toFixed(2)} €` : "—";

function bc39(text, ox, oy, nw, bh) {
  const s = `*${text.toUpperCase().replace(/[^0-9A-Z\-\.\$\/\+\% ]/g, "")}*`;
  const rects = []; let cx = ox;
  for (let i = 0; i < s.length; i++) {
    const p = C39[s[i]]; if (!p) continue;
    for (let j = 0; j < 9; j++) {
      const w = p[j] === "1" ? nw * 3 : nw;
      if (j % 2 === 0) rects.push({ x: cx, y: oy, w, h: bh });
      cx += w;
    }
    if (i < s.length - 1) cx += nw;
  }
  return { rects, tw: cx - ox };
}

/* ── BARCODE ── */
function BarcodeImg({ text, nw = 1.4, h = 36, showLabel = true }) {
  if (!text) return null;
  const { rects, tw } = bc39(text, 3, 3, nw, h);
  const W = tw + 6, H = h + (showLabel ? 16 : 4);
  return (
    <svg width={W} height={H}>
      <rect width={W} height={H} fill="white" />
      {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#000" />)}
      {showLabel && (
        <text x={W / 2} y={h + 13} textAnchor="middle" fontSize={8}
          fontFamily="IBM Plex Mono,monospace" fill="#222">{text}</text>
      )}
    </svg>
  );
}

/* ── BOTTLE ── */
function Bottle({ bx, by, bw, bh, color }) {
  const capH = bh * 0.062, neckH = bh * 0.110, shH = bh * 0.138;
  const bodyH = bh - capH - neckH - shH;
  const bodyW = bw * 0.78, neckW = bw * 0.30;
  const cx = bx + bw / 2;
  const neckX = cx - neckW / 2, bodyX = cx - bodyW / 2;
  const neckY = by + capH, shY = neckY + neckH, bodyY = shY + shH;
  return (
    <g>
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} fill={color} rx={0.5} />
      <polygon points={`${neckX},${shY} ${neckX + neckW},${shY} ${bodyX + bodyW},${bodyY} ${bodyX},${bodyY}`} fill={color} />
      <rect x={neckX} y={neckY} width={neckW} height={neckH} fill={color} />
      <rect x={cx - neckW * 0.68} y={by} width={neckW * 1.36} height={capH} fill="#2a2a2a" rx={0.3} />
      <rect x={bodyX + bodyW * 0.08} y={bodyY + bodyH * 0.18} width={bodyW * 0.84} height={bodyH * 0.5} fill="rgba(255,255,255,0.18)" rx={0.3} />
      <rect x={bodyX + bodyW * 0.06} y={bodyY + bodyH * 0.04} width={bodyW * 0.10} height={bodyH * 0.80} fill="rgba(255,255,255,0.09)" rx={0.2} />
    </g>
  );
}

/* ── TRAEGER ── */
function TraegerViz({ x, y, w, h, cols, color }) {
  const g = w * 0.024, bw = (w - g * (cols + 1)) / cols;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={color} rx={0.8} stroke="rgba(0,0,0,0.25)" strokeWidth={0.3} />
      <rect x={x + 0.5} y={y + 0.5} width={w * 0.52} height={h * 0.26} fill="rgba(255,255,255,0.10)" rx={0.5} />
      {Array.from({ length: cols }).map((_, i) => {
        const cx2 = x + g + i * (bw + g) + bw / 2;
        return (
          <g key={`bc${i}`}>
            <ellipse cx={cx2} cy={y + h * 0.075} rx={bw * 0.28} ry={h * 0.068} fill="rgba(0,0,0,0.45)" />
            <ellipse cx={cx2} cy={y + h * 0.075} rx={bw * 0.17} ry={h * 0.040} fill="#222" />
          </g>
        );
      })}
      {Array.from({ length: cols }).map((_, i) => (
        <Bottle key={`fb${i}`} bx={x + g + i * (bw + g)} by={y + h * 0.13} bw={bw} bh={h * 0.87} color={color + "dd"} />
      ))}
      <rect x={x} y={y + h * 0.91} width={w} height={h * 0.09} fill="rgba(0,0,0,0.20)" rx="0 0 0.8 0.8" />
    </g>
  );
}

/* ── KISTE ── */
function KisteViz({ x, y, w, h, color }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#5a4530" rx={0.7} stroke="rgba(0,0,0,0.32)" strokeWidth={0.4} />
      {[0.26, 0.52, 0.76].map((p, i) => (
        <rect key={i} x={x} y={y + h * p - 0.5} width={w} height={1.0} fill="rgba(0,0,0,0.22)" />
      ))}
      {[0.25, 0.5, 0.75].map((p, i) => (
        <rect key={i} x={x + w * p - 0.45} y={y} width={0.9} height={h} fill="rgba(0,0,0,0.18)" />
      ))}
      <rect x={x} y={y + h * 0.32} width={w} height={h * 0.36} fill={`${color}60`} />
      <rect x={x + w * 0.055} y={y + 1} width={w * 0.09} height={h - 2} fill="rgba(255,255,255,0.07)" rx={0.3} />
    </g>
  );
}

/* ── SHELF SVG ── */
function ShelfSVG({ config, products, mode, onLevel, onProd, onReorder, svgId = "shelf-main", interactive = true }) {
  const wCm = config.widthM  * 100;
  const hCm = config.heightM * 100;
  const TW  = wCm + 2 * SIDE_W;
  const TH  = hCm + FOOT_H;
  const sy  = (fc) => TH - FOOT_H - fc;

  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const sorted = useMemo(() => [...config.levels].sort((a, b) => a.hCm - b.hCm), [config.levels]);
  const vks    = useMemo(() => products.map(p => parseFloat(p.vk)).filter(v => isFinite(v) && v > 0), [products]);
  const minVk  = vks.length ? Math.min(...vks) : 0;
  const maxVk  = vks.length ? Math.max(...vks) : 1;

  const toSvgX = useCallback((e) => {
    const svg = svgRef.current; if (!svg) return 0;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  }, []);

  const levelPositions = useCallback((levelId) => {
    const prods = products.filter(p => p.levelId === levelId);
    if (!drag || drag.levelId !== levelId) {
      let cx = START_X;
      return prods.map(p => { const w = pW(p); const pos = { id: p.id, x: cx, w, isDrag: false, prod: p }; cx += w + GAP; return pos; });
    }
    const dW = drag.itemW, dCx = drag.currentX + dW / 2;
    const others = prods.filter(p => p.id !== drag.prodId);
    let cx = START_X;
    const rest = others.map(p => { const w = pW(p); const r = { id: p.id, w, center: cx + w / 2, prod: p }; cx += w + GAP; return r; });
    let ins = rest.findIndex(r => dCx < r.center); if (ins === -1) ins = rest.length;
    cx = START_X;
    const result = [];
    for (let i = 0; i <= rest.length; i++) {
      if (i === ins) cx += dW + GAP;
      if (i < rest.length) { result.push({ id: rest[i].id, x: cx, w: rest[i].w, isDrag: false, prod: rest[i].prod }); cx += rest[i].w + GAP; }
    }
    const dp = prods.find(p => p.id === drag.prodId);
    result.push({ id: drag.prodId, x: drag.currentX, w: dW, isDrag: true, prod: dp });
    return result;
  }, [drag, products]);

  const onProdDown = useCallback((e, prod, posX) => {
    if (!interactive) return;
    e.preventDefault();
    const pt = PMAP[prod.type] || PTYPES[0];
    setDrag({ prodId: prod.id, levelId: prod.levelId, currentX: posX, itemW: pt.wCm, ptrStartX: toSvgX(e), itemStartX: posX, moved: false });
  }, [interactive, toSvgX]);

  const onMove = useCallback((e) => {
    if (!drag) return;
    const dx = toSvgX(e) - drag.ptrStartX;
    const newX = drag.itemStartX + dx;
    const maxX = SIDE_W + wCm - drag.itemW - 1.0;
    setDrag(d => d ? { ...d, currentX: Math.max(START_X, Math.min(maxX, newX)), moved: d.moved || Math.abs(dx) > DRAG_TH } : null);
  }, [drag, toSvgX, wCm]);

  const onUp = useCallback(() => {
    if (!drag) return;
    if (!drag.moved) { onProd(drag.prodId); setDrag(null); return; }
    const prods = products.filter(p => p.levelId === drag.levelId);
    const dCx = drag.currentX + drag.itemW / 2;
    const others = prods.filter(p => p.id !== drag.prodId);
    let cx = START_X;
    const rest = others.map(p => { const w = pW(p); const r = { id: p.id, center: cx + w / 2 }; cx += w + GAP; return r; });
    let ins = rest.findIndex(r => dCx < r.center); if (ins === -1) ins = rest.length;
    const newOrder = others.map(p => p.id);
    newOrder.splice(ins, 0, drag.prodId);
    onReorder(drag.levelId, newOrder);
    setDrag(null);
  }, [drag, products, onProd, onReorder]);

  return (
    <svg ref={svgRef} id={svgId} viewBox={`0 0 ${TW} ${TH}`}
      style={{ width: "100%", height: "auto", display: "block", cursor: drag ? "grabbing" : "default", userSelect: "none" }}
      xmlns="http://www.w3.org/2000/svg"
      onMouseMove={interactive ? onMove : undefined}
      onMouseUp={interactive ? onUp : undefined}
      onMouseLeave={interactive ? onUp : undefined}>
      <defs>
        <linearGradient id={`sg_${svgId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#18191c" />
          <stop offset="40%"  stopColor="#252729" />
          <stop offset="100%" stopColor="#18191c" />
        </linearGradient>
        <linearGradient id={`bg_${svgId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f0ece4" />
          <stop offset="100%" stopColor="#e6e1d8" />
        </linearGradient>
        <filter id={`ds_${svgId}`} x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="0.4" dy="0.8" stdDeviation="0.7" floodOpacity="0.35" />
        </filter>
        <filter id={`dsd_${svgId}`} x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="0.8" dy="1.6" stdDeviation="1.2" floodOpacity="0.50" />
        </filter>
      </defs>

      {/* Shell */}
      <rect x={0} y={0} width={TW} height={TH} fill="#141618" rx={1} />
      <rect x={SIDE_W} y={0} width={wCm} height={TH - FOOT_H} fill={`url(#bg_${svgId})`} />
      <rect x={0} y={0} width={SIDE_W} height={TH} fill={`url(#sg_${svgId})`} />
      <rect x={TW - SIDE_W} y={0} width={SIDE_W} height={TH} fill={`url(#sg_${svgId})`} />
      <rect x={SIDE_W} y={0} width={0.8} height={TH - FOOT_H} fill="rgba(0,0,0,0.10)" />
      <rect x={TW - SIDE_W - 0.8} y={0} width={0.8} height={TH - FOOT_H} fill="rgba(0,0,0,0.10)" />

      {/* Boards */}
      {sorted.filter(l => l.hCm > 0).map(lv => (
        <g key={`bd${lv.id}`}>
          <rect x={SIDE_W} y={sy(lv.hCm)} width={wCm} height={BOARD_H} fill="#4a3522" />
          <rect x={SIDE_W} y={sy(lv.hCm)} width={wCm} height={0.6} fill="rgba(255,215,100,0.18)" />
          <rect x={SIDE_W} y={sy(lv.hCm) + BOARD_H - 0.5} width={wCm} height={0.5} fill="rgba(0,0,0,0.16)" />
        </g>
      ))}
      <rect x={SIDE_W} y={sy(0)} width={wCm} height={BOARD_H} fill="#3e2b18" />
      <rect x={SIDE_W} y={sy(0)} width={wCm} height={0.6} fill="rgba(255,215,100,0.14)" />

      {/* Click areas */}
      {interactive && sorted.map((lv, i) => {
        const above = sorted[i + 1];
        const surfY = sy(lv.hCm);
        const ceilY = above ? sy(above.hCm) + BOARD_H : 2;
        const aH = surfY - ceilY;
        if (aH < 4) return null;
        return (
          <rect key={`ca${lv.id}`} x={SIDE_W} y={ceilY} width={wCm} height={aH}
            fill="rgba(0,0,0,0)" style={{ cursor: "crosshair" }}
            onClick={() => { if (!drag) onLevel(lv.id); }} />
        );
      })}

      {/* Products */}
      {sorted.map(lv => {
        const positions = levelPositions(lv.id);
        return [...positions.filter(p => !p.isDrag), ...positions.filter(p => p.isDrag)].map(pos => {
          const prod = pos.prod; if (!prod) return null;
          const pt = PMAP[prod.type] || PTYPES[0];
          const px = pos.x, py = sy(lv.hCm) - pt.hCm;
          let col = prod.color || "#2563eb";
          if (mode === "margin") col = spColor(calcSp(prod.ek, prod.vk));
          else if (mode === "vk") col = vkColor(parseFloat(prod.vk), minVk, maxVk);
          const sp = calcSp(prod.ek, prod.vk);
          const isDragging = pos.isDrag;
          const fs = Math.min(4.5, pt.wCm / 9);
          const name = (prod.title || pt.short).slice(0, Math.floor(pt.wCm / 2.6));
          return (
            <g key={prod.id}
              filter={isDragging ? `url(#dsd_${svgId})` : `url(#ds_${svgId})`}
              opacity={isDragging ? 0.92 : 1}
              style={{ cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default" }}
              onMouseDown={interactive ? (e) => onProdDown(e, prod, pos.x) : undefined}
              onClick={(e) => e.stopPropagation()}>
              {pt.kind === "traeger"
                ? <TraegerViz x={px} y={py} w={pt.wCm} h={pt.hCm} cols={pt.cols} color={col} />
                : <KisteViz   x={px} y={py} w={pt.wCm} h={pt.hCm} color={col} />}
              {mode === "normal" && prod.title && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm * 0.62} textAnchor="middle" fontSize={fs}
                  fill="rgba(255,255,255,0.90)" fontWeight="600" fontFamily="Inter,sans-serif" style={{ pointerEvents: "none" }}>
                  {name}
                </text>
              )}
              {mode === "normal" && prod.vk && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm - 1.8} textAnchor="middle" fontSize={3.0}
                  fill="rgba(255,255,255,0.75)" fontFamily="IBM Plex Mono,monospace" style={{ pointerEvents: "none" }}>
                  {parseFloat(prod.vk).toFixed(2)} €
                </text>
              )}
              {mode === "margin" && sp !== null && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm / 2 + 2.2} textAnchor="middle" fontSize={4.2}
                  fill="rgba(0,0,0,0.80)" fontWeight="700" fontFamily="Inter,sans-serif" style={{ pointerEvents: "none" }}>
                  {sp}%
                </text>
              )}
              {mode === "vk" && prod.vk && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm - 1.8} textAnchor="middle" fontSize={3.0}
                  fill="rgba(255,255,255,0.78)" fontFamily="IBM Plex Mono,monospace" style={{ pointerEvents: "none" }}>
                  {parseFloat(prod.vk).toFixed(2)} €
                </text>
              )}
              {interactive && !isDragging && (
                <g style={{ pointerEvents: "none" }} opacity={0.30}>
                  {[0, 1].map(row => [0, 1, 2].map(col2 => (
                    <circle key={`${row}-${col2}`} cx={px + pt.wCm / 2 - 1.8 + col2 * 1.8} cy={py + 2.0 + row * 1.8} r={0.40} fill="white" />
                  )))}
                </g>
              )}
              {isDragging && (
                <rect x={px} y={py} width={pt.wCm} height={pt.hCm}
                  fill="none" stroke="rgba(255,255,255,0.50)" strokeWidth={0.6} strokeDasharray="2.5 1.2" rx={0.9} />
              )}
            </g>
          );
        });
      })}

      {/* Level labels */}
      {sorted.filter(l => l.hCm > 0).map(lv => (
        <text key={`lb${lv.id}`} x={SIDE_W + 1.2} y={sy(lv.hCm) - 0.9}
          fontSize={2.5} fill="rgba(80,60,35,0.65)" fontFamily="Inter,sans-serif" fontWeight="500">
          {lv.label}
        </text>
      ))}

      {/* Ruler */}
      <line x1={SIDE_W} y1={TH - 0.9} x2={TW - SIDE_W} y2={TH - 0.9} stroke="rgba(80,60,35,0.40)" strokeWidth={0.30} />
      <line x1={SIDE_W}      y1={TH - 2.0} x2={SIDE_W}      y2={TH - 0.2} stroke="rgba(80,60,35,0.40)" strokeWidth={0.30} />
      <line x1={TW - SIDE_W} y1={TH - 2.0} x2={TW - SIDE_W} y2={TH - 0.2} stroke="rgba(80,60,35,0.40)" strokeWidth={0.30} />
      <text x={TW / 2} y={TH - 0.1} textAnchor="middle" fontSize={2.2} fill="rgba(80,60,35,0.50)" fontFamily="IBM Plex Mono,monospace">
        {config.widthM.toFixed(2)} m
      </text>
    </svg>
  );
}

/* ── PRODUCT MODAL ── */
function ProductModal({ initial, levelId, config, onSave, onDelete, onClose }) {
  const lv = config.levels.find(l => l.id === (levelId ?? initial?.levelId));
  const [d, setD] = useState({ type: "T6", title: "", articleNr: "", color: "#2563eb", ek: "", vk: "", ...(initial || {}) });
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const sp = calcSp(d.ek, d.vk);
  const F = C.font;

  const INP = {
    width: "100%", background: C.bg3, border: `1px solid ${C.b2}`,
    borderRadius: C.radius.md, padding: "9px 12px", color: C.t1,
    fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: F,
  };
  const LBL = { color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, marginBottom: 5, display: "block", textTransform: "uppercase" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", fontFamily: F }}>
      <div style={{ width: "100%", maxWidth: 440, background: C.bg1, border: `1px solid ${C.b2}`, borderRadius: C.radius.xl, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", maxHeight: "95vh" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.b1}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: C.t1, fontWeight: 700, fontSize: 15 }}>{initial ? "Produkt bearbeiten" : "Produkt hinzufügen"}</div>
            {lv && <div style={{ color: C.t3, fontSize: 11, marginTop: 2 }}>{lv.label}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.t3, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "2px 4px", borderRadius: C.radius.md }}
            onMouseOver={e => e.target.style.color = C.t1} onMouseOut={e => e.target.style.color = C.t3}>×</button>
        </div>

        <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Type */}
          <div>
            <span style={LBL}>Gebindetyp</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {PTYPES.map(t => (
                <button key={t.id} onClick={() => set("type", t.id)} style={{
                  padding: "9px 12px", borderRadius: C.radius.lg, textAlign: "left", cursor: "pointer",
                  background: d.type === t.id ? C.blueBg : C.bg3,
                  border: `1px solid ${d.type === t.id ? C.blueBd : C.b1}`,
                  transition: "all 0.12s",
                }}>
                  <div style={{ color: d.type === t.id ? C.blue : C.t1, fontWeight: 700, fontSize: 14 }}>{t.short}</div>
                  <div style={{ color: C.t3, fontSize: 11, marginTop: 2 }}>{t.label}</div>
                  <div style={{ color: C.t3, fontSize: 10, fontFamily: C.mono, marginTop: 1 }}>{t.wCm} × {t.hCm} cm</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <span style={LBL}>Produktname</span>
            <input value={d.title} onChange={e => set("title", e.target.value)} placeholder="z.B. Warsteiner Pils 6×0,33L" style={INP} />
          </div>

          {/* Article Nr */}
          <div>
            <span style={LBL}>Artikel-Nummer</span>
            <input value={d.articleNr} onChange={e => set("articleNr", e.target.value.toUpperCase())} placeholder="z.B. 4012345678901" style={{ ...INP, fontFamily: C.mono }} />
            {d.articleNr && (
              <div style={{ marginTop: 8, background: "#fff", borderRadius: C.radius.md, padding: "6px 5px", display: "inline-block" }}>
                <BarcodeImg text={d.articleNr} nw={1.0} h={26} />
              </div>
            )}
          </div>

          {/* Color */}
          <div>
            <span style={LBL}>Farbe</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
              {PALETTE.map(c => (
                <button key={c} onClick={() => set("color", c)} style={{
                  width: 26, height: 26, borderRadius: C.radius.sm, background: c, cursor: "pointer",
                  border: `2px solid ${d.color === c ? C.t1 : "transparent"}`,
                  transition: "all 0.12s", flexShrink: 0,
                }} />
              ))}
              <input type="color" value={d.color} onChange={e => set("color", e.target.value)} style={{ width: 26, height: 26, borderRadius: C.radius.sm, cursor: "pointer", border: `1px solid ${C.b2}`, padding: 0, background: "none" }} />
            </div>
          </div>

          {/* Prices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["ek", "EK-Preis (€)"], ["vk", "VK-Preis (€)"]].map(([k, lbl]) => (
              <div key={k}>
                <span style={LBL}>{lbl}</span>
                <input type="number" step="0.01" min="0" value={d[k]} onChange={e => set(k, e.target.value)} placeholder="0.00" style={{ ...INP, fontFamily: C.mono }} />
              </div>
            ))}
          </div>

          {/* Spanne */}
          {sp !== null && (
            <div style={{ background: `${spColor(sp)}12`, border: `1px solid ${spColor(sp)}30`, borderRadius: C.radius.lg, padding: "10px 16px", textAlign: "center" }}>
              <span style={{ color: spColor(sp), fontSize: 17, fontWeight: 700 }}>Handelsspanne: {sp} %</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 7 }}>
            {initial && (
              <button onClick={() => onDelete(initial.id)} style={{ padding: "9px 14px", borderRadius: C.radius.lg, cursor: "pointer", background: C.redBg, color: C.red, border: `1px solid rgba(239,68,68,0.25)`, fontWeight: 600, fontSize: 12 }}>
                Löschen
              </button>
            )}
            <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: C.radius.lg, cursor: "pointer", background: C.bg3, color: C.t2, border: `1px solid ${C.b1}`, fontWeight: 500, fontSize: 13, fontFamily: F }}>
              Abbrechen
            </button>
            <button onClick={() => onSave(d)} style={{ flex: 1, padding: "10px", borderRadius: C.radius.lg, cursor: "pointer", background: C.blue, color: "#fff", border: "none", fontWeight: 600, fontSize: 13, fontFamily: F }}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SETTINGS PANEL ── */
function SettingsPanel({ config, setConfig }) {
  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }));
  const sorted = useMemo(() => [...config.levels].sort((a, b) => a.hCm - b.hCm), [config.levels]);
  const F = C.font;

  const addLevel = () => {
    const last = Math.max(...config.levels.map(l => l.hCm));
    setConfig(c => ({ ...c, levels: [...c.levels, { id: uid(), hCm: Math.min(last + 40, Math.round(c.heightM * 100) - 10), label: `Ebene ${c.levels.length}` }] }));
  };
  const rm   = (id) => setConfig(c => ({ ...c, levels: c.levels.filter(l => l.id !== id) }));
  const updL = (id, k, v) => setConfig(c => ({ ...c, levels: c.levels.map(l => l.id === id ? { ...l, [k]: v } : l) }));

  const CARD = { background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: C.radius.xl, padding: 20, marginBottom: 12 };
  const HEAD = { color: C.t3, fontSize: 10, fontWeight: 700, letterSpacing: 2, marginBottom: 14, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase" };
  const INP  = { width: "100%", background: C.bg3, border: `1px solid ${C.b2}`, borderRadius: C.radius.md, padding: "9px 11px", color: C.t1, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: C.mono };

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", fontFamily: F }}>

      {/* Dimensions */}
      <div style={CARD}>
        <div style={HEAD}>Regal-Abmessungen</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[["widthM", "Breite (m)"], ["heightM", "Höhe (m)"]].map(([k, lbl]) => (
            <div key={k}>
              <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" }}>{lbl}</div>
              <input type="number" step="0.01" min={0.5} max={k === "widthM" ? 6 : 3} value={config[k]}
                onChange={e => upd(k, parseFloat(e.target.value) || config[k])} style={INP} />
            </div>
          ))}
        </div>
        <div style={{ background: C.blueBg, border: `1px solid ${C.blueBd}`, borderRadius: C.radius.lg, padding: "9px 13px", fontSize: 12, color: C.t2, display: "flex", gap: 8 }}>
          <div style={{ fontWeight: 600, color: C.blue, flexShrink: 0 }}>INFO</div>
          <span>Standard EDEKA Mehrweg-Modul: <strong style={{ color: C.t1 }}>1,33 m × 2,00 m</strong> — Mehrfachmodule: 2,66 m · 3,99 m</span>
        </div>
      </div>

      {/* Levels */}
      <div style={CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={HEAD}>Einlegeböden</div>
          <button onClick={addLevel} style={{ background: C.blue, color: "#fff", border: "none", borderRadius: C.radius.md, padding: "6px 14px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, cursor: "pointer", fontFamily: F }}>
            + Boden
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sorted.map((lv, i) => (
            <div key={lv.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg3, border: `1px solid ${C.b1}`, borderRadius: C.radius.lg, padding: "7px 11px" }}>
              <span style={{ color: C.t3, fontSize: 11, width: 16, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: "#4a3522", flexShrink: 0 }} />
              <input value={lv.label} disabled={lv.hCm === 0} onChange={e => updL(lv.id, "label", e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", color: lv.hCm === 0 ? C.t3 : C.t1, fontSize: 13, outline: "none", fontFamily: F }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" min={0} step={5} value={lv.hCm} disabled={lv.hCm === 0}
                  onChange={e => updL(lv.id, "hCm", Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ ...INP, width: 60, padding: "4px 8px", textAlign: "center", opacity: lv.hCm === 0 ? 0.3 : 1 }} />
                <span style={{ color: C.t3, fontSize: 11 }}>cm</span>
              </div>
              {lv.hCm !== 0 && (
                <button onClick={() => rm(lv.id)} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 3px" }}
                  onMouseOver={e => e.target.style.color = C.red} onMouseOut={e => e.target.style.color = C.t3}>×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Product norms */}
      <div style={CARD}>
        <div style={HEAD}>Gebinde-Normen (DIN/Euro)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {PTYPES.map(t => (
            <div key={t.id} style={{
              background: C.bg3, border: `1px solid ${C.b1}`, borderRadius: C.radius.lg, padding: "11px 13px",
              borderLeft: `3px solid ${t.kind === "traeger" ? C.blue : C.amber}`,
            }}>
              <div style={{ color: t.kind === "traeger" ? C.blue : C.amber, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" }}>
                {t.kind === "traeger" ? "Träger" : "Kiste"}
              </div>
              <div style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>{t.label}</div>
              <div style={{ color: C.t3, fontSize: 10, fontFamily: C.mono, marginTop: 3 }}>{t.wCm} × {t.hCm} cm</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── PDF EXPORT ── */
async function doPDF(config, products) {
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");
  const PW = 210, PH = 297, ML = 14;

  /* Load EDEKA logo */
  let logoDataUrl = null;
  try {
    await new Promise(res => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = img.naturalWidth || 120; cv.height = img.naturalHeight || 60;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        logoDataUrl = cv.toDataURL("image/png");
        res();
      };
      img.onerror = res;
      img.src = "/edeka-logo.svg";
    });
  } catch (_) {}

  /* Helper: render SVG element to canvas dataURL */
  const svgToDataUrl = async (svgEl, bgColor = "#141618") => {
    const vb = svgEl.viewBox.baseVal;
    const sc = 4;
    const cv = document.createElement("canvas");
    cv.width = vb.width * sc; cv.height = vb.height * sc;
    const ctx = cv.getContext("2d");
    ctx.scale(sc, sc);
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, vb.width, vb.height);
    const str = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    await new Promise(res => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); res(); };
      img.onerror = () => { URL.revokeObjectURL(url); res(); };
      img.src = url;
    });
    return { dataUrl: cv.toDataURL("image/png"), aspect: vb.height / vb.width };
  };

  /* ── Page header ── */
  const drawHeader = (pg) => {
    doc.setPage(pg);
    doc.setFillColor(10, 14, 22); doc.rect(0, 0, PW, 22, "F");
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", ML, 4.5, 24, 13);
    } else {
      doc.setFillColor(212, 160, 23); doc.rect(ML, 5.5, 11, 11, "F");
      doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(6,24,52);
      doc.text("E", ML + 3, 13);
    }
    doc.setTextColor(232, 234, 237);
    doc.setFontSize(13); doc.setFont("helvetica","bold");
    doc.text("Mehrweg Regalplanung", ML + 28, 11.5);
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(139,144,153);
    doc.text(`${config.widthM.toFixed(2)} m × ${config.heightM.toFixed(2)} m · ${products.length} Produkte`, ML + 28, 17);
    doc.text(new Date().toLocaleString("de-DE"), PW - ML, 17, { align: "right" });
  };

  drawHeader(1);
  let y = 28;

  /* ── Config + shelf normal view ── */
  const svgNormal = document.getElementById("shelf-pdf-normal");
  if (svgNormal) {
    try {
      const { dataUrl, aspect } = await svgToDataUrl(svgNormal);
      const iW = 68, iH = iW * aspect;
      doc.addImage(dataUrl, "PNG", PW - ML - iW, y, iW, iH);
      doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(10,20,50);
      doc.text("Konfiguration", ML, y + 6);
      doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(70,70,70);
      const sLvl = [...config.levels].sort((a,b) => a.hCm - b.hCm);
      sLvl.forEach((lv, i) => doc.text(`${lv.label}: ${lv.hCm} cm`, ML + 2, y + 13 + i * 5.5));
      y = Math.max(y + 13 + sLvl.length * 5.5, y + iH) + 8;
    } catch (e) { console.error(e); y += 5; }
  }

  /* ── Product table ── */
  doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(10,20,50);
  doc.text("Produktliste", ML, y); y += 6;
  doc.setFillColor(10, 20, 50); doc.rect(ML, y, PW - 2 * ML, 7, "F");
  doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont("helvetica","bold");
  doc.text("Barcode / Artikel-Nr.", ML + 2, y + 4.8);
  doc.text("Produkt",    ML + 62, y + 4.8);
  doc.text("Ebene",      ML + 118, y + 4.8);
  doc.text("EK",         ML + 143, y + 4.8, { align: "right" });
  doc.text("VK",         ML + 160, y + 4.8, { align: "right" });
  doc.text("Spanne",     ML + 180, y + 4.8, { align: "right" });
  y += 8;

  const sortedP = [...products].sort((a, b) => {
    const la = config.levels.find(l => l.id === a.levelId);
    const lb = config.levels.find(l => l.id === b.levelId);
    return (la?.hCm || 0) - (lb?.hCm || 0);
  });

  doc.setFont("helvetica","normal");
  sortedP.forEach((p, i) => {
    const RH = 15;
    if (y + RH > PH - 14) { doc.addPage(); drawHeader(doc.getNumberOfPages()); y = 28; }
    if (i % 2 === 0) { doc.setFillColor(245,248,255); doc.rect(ML, y - 0.5, PW - 2 * ML, RH, "F"); }
    if (p.color?.startsWith("#")) {
      try {
        const h2 = p.color.slice(1);
        doc.setFillColor(parseInt(h2.slice(0,2),16), parseInt(h2.slice(2,4),16), parseInt(h2.slice(4,6),16));
        doc.rect(ML, y - 0.5, 2.5, RH, "F");
      } catch (_) {}
    }
    if (p.articleNr) {
      const nw = 0.19, bh = 8;
      const { rects, tw } = bc39(p.articleNr, ML + 3, y + 1, nw, bh);
      rects.forEach(r => { doc.setFillColor(0,0,0); doc.rect(r.x, r.y, r.w, r.h, "F"); });
      doc.setFontSize(5); doc.setTextColor(40,40,40); doc.setFont("courier","normal");
      doc.text(p.articleNr, ML + 3 + tw / 2, y + bh + 4, { align: "center" });
      doc.setFont("helvetica","normal");
    }
    const tY = y + 6;
    doc.setFontSize(8); doc.setTextColor(0,0,0);
    doc.setFont("helvetica","bold"); doc.text((p.title || "—").slice(0, 30), ML + 62, tY);
    doc.setFont("helvetica","normal"); doc.setTextColor(70,70,70);
    const lv2 = config.levels.find(l => l.id === p.levelId);
    doc.text(lv2?.label || "—", ML + 118, tY);
    if (p.ek) { doc.setTextColor(110,110,110); doc.text(fmt(p.ek), ML + 143, tY, { align: "right" }); }
    if (p.vk) { doc.setTextColor(0,0,0); doc.setFont("helvetica","bold"); doc.text(fmt(p.vk), ML + 160, tY, { align: "right" }); doc.setFont("helvetica","normal"); }
    const sp2 = calcSp(p.ek, p.vk);
    if (sp2 !== null) {
      const sc2 = spColor(sp2);
      if (sc2.startsWith("#")) {
        const h3 = sc2.slice(1);
        let r2 = parseInt(h3.slice(0,2),16), g2 = parseInt(h3.slice(2,4),16), b2 = parseInt(h3.slice(4,6),16);
        if (r2 > 180 && g2 > 180) { r2 = 150; g2 = 120; b2 = 0; }
        doc.setTextColor(r2, g2, b2);
      }
      doc.setFont("helvetica","bold"); doc.text(`${sp2} %`, ML + 180, tY, { align: "right" });
      doc.setFont("helvetica","normal");
    }
    doc.setTextColor(0,0,0);
    y += RH;
  });

  /* ── Summary ── */
  if (products.length > 0) {
    if (y + 24 > PH - 14) { doc.addPage(); drawHeader(doc.getNumberOfPages()); y = 28; }
    y += 5;
    doc.setFillColor(235,242,255); doc.rect(ML, y, PW - 2 * ML, 20, "F");
    doc.setFontSize(8.5); doc.setFont("helvetica","bold"); doc.setTextColor(10,20,50);
    doc.text("Zusammenfassung", ML + 3, y + 6);
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(60,60,60);
    doc.text(`Produkte gesamt: ${products.length}`, ML + 3, y + 12.5);
    const wS = products.filter(p => calcSp(p.ek, p.vk) !== null);
    if (wS.length) {
      const avg = (wS.reduce((s,p) => s + calcSp(p.ek,p.vk), 0) / wS.length).toFixed(1);
      doc.text(`Ø Handelsspanne: ${avg} %`, ML + 65, y + 12.5);
    }
    const top = [...products].filter(p => p.vk).sort((a,b) => parseFloat(b.vk) - parseFloat(a.vk))[0];
    if (top) doc.text(`Höchster VK: ${fmt(top.vk)} — ${top.title || "—"}`, ML + 3, y + 17.5);
    y += 26;
  }

  /* ── Regalansichten — one per page ── */
  const views = [
    { id: "shelf-pdf-normal", label: "Normalansicht" },
    { id: "shelf-pdf-margin", label: "Spanne-Heatmap" },
    { id: "shelf-pdf-vk",    label: "VK-Preisheatmap" },
  ];

  for (const { id, label } of views) {
    doc.addPage();
    drawHeader(doc.getNumberOfPages());
    let vy = 28;
    doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(10,20,50);
    doc.text(label, ML, vy); vy += 8;
    const svgEl = document.getElementById(id);
    if (!svgEl) continue;
    try {
      const { dataUrl, aspect } = await svgToDataUrl(svgEl);
      const maxW = PW - 2 * ML;
      const maxH = PH - vy - 14;
      const byW  = maxW * aspect;
      let iW, iH;
      if (byW <= maxH) { iW = maxW; iH = byW; }
      else             { iH = maxH; iW = maxH / aspect; }
      const ix = ML + (maxW - iW) / 2;
      doc.addImage(dataUrl, "PNG", ix, vy, iW, iH);
    } catch (_) {}
  }

  /* ── Page footers ── */
  const np = doc.getNumberOfPages();
  for (let pg = 1; pg <= np; pg++) {
    doc.setPage(pg);
    doc.setFillColor(230, 235, 242); doc.rect(0, PH - 9, PW, 9, "F");
    doc.setFontSize(6.5); doc.setTextColor(120,120,120); doc.setFont("helvetica","normal");
    doc.text("RePlan - EDEKA Rohling", ML, PH - 3.5);
    doc.text(`Seite ${pg} / ${np}`, PW - ML, PH - 3.5, { align: "right" });
  }

  doc.save("regal-planung-mehrweg.pdf");
}

/* ── APP ── */
export default function App() {
  useFonts();
  const [tab,     setTab]     = useState("settings");
  const [config,  setConfig]  = useState(DEFAULT_CFG);
  const [products, setProds]  = useState([]);
  const [mode,    setMode]    = useState("normal");
  const [modal,   setModal]   = useState(null);
  const [busy,    setBusy]    = useState(false);

  const editP = modal?.mode === "edit" ? products.find(p => p.id === modal.pid) : null;

  const handleSave = (data) => {
    if (modal.mode === "add") setProds(ps => [...ps, { ...data, id: uid(), levelId: modal.lvId }]);
    else setProds(ps => ps.map(p => p.id === editP.id ? { ...p, ...data } : p));
    setModal(null);
  };
  const handleDel     = (id)          => { setProds(ps => ps.filter(p => p.id !== id)); setModal(null); };
  const handleReorder = useCallback((levelId, newOrder) => {
    setProds(ps => {
      const others = ps.filter(p => p.levelId !== levelId);
      const level  = newOrder.map(id => ps.find(p => p.id === id)).filter(Boolean);
      return [...others, ...level];
    });
  }, []);

  const doExport = async () => {
    setBusy(true);
    try { await doPDF(config, products); }
    catch (e) { console.error(e); alert("Export fehlgeschlagen."); }
    finally { setBusy(false); }
  };

  const sorted = useMemo(() => [...products].sort((a, b) => {
    const la = config.levels.find(l => l.id === a.levelId);
    const lb = config.levels.find(l => l.id === b.levelId);
    return (la?.hCm || 0) - (lb?.hCm || 0);
  }), [products, config.levels]);

  const stats = useMemo(() => {
    const ws = products.filter(p => calcSp(p.ek, p.vk) !== null);
    return {
      n:   products.length,
      avg: ws.length ? +(ws.reduce((s,p) => s + calcSp(p.ek,p.vk), 0) / ws.length).toFixed(1) : null,
    };
  }, [products]);

  const F = C.font;

  /* shared tab style */
  const tabSt = (id) => ({
    padding: "7px 16px", borderRadius: C.radius.md, cursor: "pointer", fontFamily: F,
    fontWeight: 600, fontSize: 12, letterSpacing: 0.3, transition: "all 0.12s", border: "none",
    background: tab === id ? C.bg3 : "transparent",
    color:      tab === id ? C.t1  : C.t3,
    boxShadow:  tab === id ? `inset 0 0 0 1px ${C.b2}` : "none",
  });

  /* shared mode button style */
  const modeSt = (m) => ({
    padding: "7px 14px", borderRadius: C.radius.md, cursor: "pointer", fontFamily: F,
    fontWeight: 600, fontSize: 11, letterSpacing: 0.3, transition: "all 0.12s",
    background: mode === m ? C.blueBg : "transparent",
    color:      mode === m ? C.blue   : C.t3,
    border:     `1px solid ${mode === m ? C.blueBd : "transparent"}`,
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg0, color: C.t1, fontFamily: F }}>

      {/* Hidden SVGs for PDF */}
      <div style={{ position: "fixed", opacity: 0, pointerEvents: "none", width: 600, left: -9999, top: -9999 }} aria-hidden>
        <ShelfSVG config={config} products={products} mode="normal"  onLevel={()=>{}} onProd={()=>{}} onReorder={()=>{}} svgId="shelf-pdf-normal" interactive={false} />
        <ShelfSVG config={config} products={products} mode="margin"  onLevel={()=>{}} onProd={()=>{}} onReorder={()=>{}} svgId="shelf-pdf-margin" interactive={false} />
        <ShelfSVG config={config} products={products} mode="vk"     onLevel={()=>{}} onProd={()=>{}} onReorder={()=>{}} svgId="shelf-pdf-vk"     interactive={false} />
      </div>

      {/* ── HEADER ── */}
      <header style={{ background: C.bg1, borderBottom: `1px solid ${C.b1}`, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 20 }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <img src="/edeka-logo.svg" alt="EDEKA" style={{ height: 28, width: "auto" }}
              onError={e => { e.target.style.display="none"; }} />
            <div style={{ width: 1, height: 20, background: C.b2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5, color: C.t1, lineHeight: 1.1 }}>RePlan</div>
              <div style={{ color: C.t3, fontSize: 9, letterSpacing: 2, marginTop: 1 }}>REGALPLANER · EDEKA</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: C.b1, flexShrink: 0 }} />

          {/* Tabs */}
          <nav style={{ display: "flex", gap: 2 }}>
            {[["settings","Einstellungen"], ["design","Regal Design"], ["export","Export"]].map(([id,lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={tabSt(id)}
                onMouseOver={e => { if (tab !== id) e.currentTarget.style.color = C.t2; }}
                onMouseOut={e  => { if (tab !== id) e.currentTarget.style.color = C.t3; }}>
                {lbl}
              </button>
            ))}
          </nav>

          {/* Stats */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
            {stats.n > 0 && (
              <div style={{ background: C.bg3, border: `1px solid ${C.b1}`, borderRadius: C.radius.md, padding: "4px 11px", fontSize: 12, color: C.t2 }}>
                <strong style={{ color: C.t1, fontFamily: C.mono }}>{stats.n}</strong> Artikel
              </div>
            )}
            {stats.avg !== null && (
              <div style={{ background: C.greenBg, border: `1px solid ${C.greenBd}`, borderRadius: C.radius.md, padding: "4px 11px", fontSize: 12, color: C.green }}>
                Ø <strong style={{ fontFamily: C.mono }}>{stats.avg}%</strong>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 20px" }}>

        {tab === "settings" && <SettingsPanel config={config} setConfig={setConfig} />}

        {tab === "design" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Controls */}
            <div style={{ background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: C.radius.lg, padding: "11px 16px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 3, background: C.bg3, borderRadius: C.radius.md, border: `1px solid ${C.b1}`, padding: 3 }}>
                {[["normal","Normal"], ["margin","Spanne"], ["vk","VK-Preis"]].map(([m,lbl]) => (
                  <button key={m} onClick={() => setMode(m)} style={modeSt(m)}>{lbl}</button>
                ))}
              </div>
              {mode === "margin" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  {[["≥ 35%","#22c55e"],["≥ 25%","#84cc16"],["≥ 15%","#f59e0b"],["≥ 5%","#f97316"],["< 5%","#ef4444"]].map(([l,c]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                      <span style={{ color: C.t2, fontSize: 11 }}>{l}</span>
                    </div>
                  ))}
                </div>
              )}
              {mode === "vk" && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 100, height: 8, borderRadius: 4, background: "linear-gradient(to right,rgb(30,120,250),rgb(225,30,50))" }} />
                  <span style={{ color: C.t3, fontSize: 11 }}>günstig → teuer</span>
                </div>
              )}
              <span style={{ color: C.t3, fontSize: 11 }}>Klick auf Fläche — hinzufügen · Klick auf Produkt — bearbeiten · Ziehen — sortieren</span>
            </div>

            {/* Shelf */}
            <div style={{ background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: C.radius.lg, padding: 16, overflowX: "auto" }}>
              <ShelfSVG config={config} products={products} mode={mode}
                onLevel={lvId => setModal({ mode: "add", lvId })}
                onProd={pid => setModal({ mode: "edit", pid })}
                onReorder={handleReorder}
                svgId="shelf-main" interactive />
            </div>

            {/* Product cards */}
            {products.length > 0 && (
              <div style={{ background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: C.radius.lg, padding: 16 }}>
                <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>
                  Platzierte Produkte — {products.length}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 7 }}>
                  {sorted.map(p => {
                    const sp2 = calcSp(p.ek, p.vk);
                    const lv2 = config.levels.find(l => l.id === p.levelId);
                    return (
                      <div key={p.id} onClick={() => setModal({ mode: "edit", pid: p.id })}
                        style={{ cursor: "pointer", padding: "9px 11px", borderRadius: C.radius.lg, background: C.bg2, border: `1px solid ${C.b1}`, borderLeft: `3px solid ${p.color || C.blue}`, transition: "background 0.10s" }}
                        onMouseOver={e => e.currentTarget.style.background = C.bg3}
                        onMouseOut={e  => e.currentTarget.style.background = C.bg2}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title || "—"}</div>
                        <div style={{ fontSize: 10, color: C.t3, fontFamily: C.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{p.articleNr || "—"}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                          <span style={{ fontSize: 10, color: C.t3 }}>{lv2?.label || "—"}</span>
                          {sp2 !== null && <span style={{ fontSize: 11, fontWeight: 600, color: spColor(sp2), background: `${spColor(sp2)}14`, padding: "1px 5px", borderRadius: C.radius.sm }}>{sp2}%</span>}
                        </div>
                        {p.vk && <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginTop: 2, fontFamily: C.mono }}>{parseFloat(p.vk).toFixed(2)} €</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "export" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: C.bg1, border: `1px solid ${C.b1}`, borderRadius: C.radius.xl, padding: 24 }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.3, marginBottom: 5, color: C.t1 }}>PDF Export</div>
                  <div style={{ color: C.t3, fontSize: 13 }}>Regalansichten · Produktliste · Code 39 Barcodes · Handelsspannen</div>
                </div>
                <button onClick={doExport} disabled={busy} style={{
                  padding: "10px 24px", borderRadius: C.radius.lg, cursor: busy ? "not-allowed" : "pointer",
                  background: busy ? C.bg3 : C.green, color: "#fff", border: "none",
                  fontFamily: F, fontWeight: 600, fontSize: 13,
                  boxShadow: busy ? "none" : `0 2px 12px ${C.greenBd}`,
                  transition: "all 0.15s", opacity: busy ? 0.6 : 1,
                }}>
                  {busy ? "Erstelle PDF …" : "PDF Exportieren"}
                </button>
              </div>

              {/* 3 shelf views — full width stacked */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>Regalansichten</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[["normal","Normalansicht"], ["margin","Spanne-Heatmap"], ["vk","VK-Preisheatmap"]].map(([m,lbl]) => (
                    <div key={m} style={{ background: C.bg2, border: `1px solid ${C.b1}`, borderRadius: C.radius.lg, overflow: "hidden" }}>
                      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.b1}`, color: C.t2, fontSize: 11, fontWeight: 600 }}>{lbl}</div>
                      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "center" }}>
                        <div style={{ maxWidth: 680, width: "100%" }}>
                          <ShelfSVG config={config} products={products} mode={m}
                            onLevel={() => setTab("design")} onProd={() => setTab("design")}
                            onReorder={() => {}} svgId={`shelf-export-${m}`} interactive={false} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product table */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
                  Produktliste — {products.length} Artikel
                </div>
                {stats.avg !== null && <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Ø Spanne: {stats.avg}%</span>}
              </div>

              {products.length === 0 ? (
                <div style={{ textAlign: "center", padding: "52px 20px", color: C.t3, border: `1px solid ${C.b1}`, borderRadius: C.radius.lg }}>
                  <div style={{ fontSize: 11, letterSpacing: 1 }}>Keine Produkte platziert.</div>
                  <button onClick={() => setTab("design")} style={{ marginTop: 10, background: "none", border: "none", color: C.blue, cursor: "pointer", fontSize: 12, fontFamily: F }}>
                    Zum Regal Design →
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: "auto", borderRadius: C.radius.lg, border: `1px solid ${C.b1}` }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                    <thead>
                      <tr style={{ background: C.bg2 }}>
                        {["Barcode","Artikel-Nr.","Produkt","Typ","Ebene","EK","VK","Spanne"].map((h, i) => (
                          <th key={i} style={{ padding: "9px 11px", textAlign: i >= 5 ? "right" : "left", color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, whiteSpace: "nowrap", borderBottom: `1px solid ${C.b1}` }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((p, i) => {
                        const lv2 = config.levels.find(l => l.id === p.levelId);
                        const sp2 = calcSp(p.ek, p.vk);
                        const pt2 = PMAP[p.type] || PTYPES[0];
                        const bg  = i % 2 === 0 ? C.bg2 : "transparent";
                        return (
                          <tr key={p.id} style={{ background: bg, cursor: "pointer", transition: "background 0.08s" }}
                            onClick={() => { setTab("design"); setTimeout(() => setModal({ mode: "edit", pid: p.id }), 80); }}
                            onMouseOver={e => e.currentTarget.style.background = C.bg3}
                            onMouseOut={e  => e.currentTarget.style.background = bg}>
                            <td style={{ padding: "7px 11px", borderBottom: `1px solid ${C.b1}` }}>
                              {p.articleNr
                                ? <div style={{ background: "#fff", borderRadius: C.radius.sm, display: "inline-block", padding: "2px 2px" }}><BarcodeImg text={p.articleNr} nw={0.7} h={18} showLabel={false} /></div>
                                : <span style={{ color: C.t3, fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ padding: "7px 11px", fontFamily: C.mono, fontSize: 10, color: C.t3, borderBottom: `1px solid ${C.b1}`, whiteSpace: "nowrap" }}>{p.articleNr || "—"}</td>
                            <td style={{ padding: "7px 11px", borderBottom: `1px solid ${C.b1}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ width: 7, height: 7, borderRadius: 1, background: p.color || "#ccc", flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{p.title || "—"}</span>
                              </div>
                            </td>
                            <td style={{ padding: "7px 11px", fontSize: 11, color: C.t3, borderBottom: `1px solid ${C.b1}` }}>{pt2.short}</td>
                            <td style={{ padding: "7px 11px", fontSize: 12, color: C.t2, borderBottom: `1px solid ${C.b1}` }}>{lv2?.label || "—"}</td>
                            <td style={{ padding: "7px 11px", textAlign: "right", fontSize: 11, color: C.t3, borderBottom: `1px solid ${C.b1}`, fontFamily: C.mono }}>{fmt(p.ek)}</td>
                            <td style={{ padding: "7px 11px", textAlign: "right", fontSize: 13, fontWeight: 600, color: C.t1, borderBottom: `1px solid ${C.b1}`, fontFamily: C.mono }}>{fmt(p.vk)}</td>
                            <td style={{ padding: "7px 11px", textAlign: "right", borderBottom: `1px solid ${C.b1}` }}>
                              {sp2 !== null
                                ? <span style={{ fontSize: 12, fontWeight: 600, color: spColor(sp2), background: `${spColor(sp2)}14`, padding: "2px 7px", borderRadius: C.radius.sm }}>{sp2} %</span>
                                : <span style={{ color: C.t3 }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {products.length > 1 && stats.avg !== null && (
                      <tfoot>
                        <tr style={{ background: C.bg2 }}>
                          <td colSpan={5} style={{ padding: "7px 11px", color: C.t3, fontSize: 11 }}>{products.length} Produkte gesamt</td>
                          <td colSpan={2} style={{ padding: "7px 11px" }} />
                          <td style={{ padding: "7px 11px", textAlign: "right", fontSize: 11, fontWeight: 700, color: spColor(stats.avg) }}>Ø {stats.avg} %</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      {modal && (
        <ProductModal
          initial={editP} levelId={modal.lvId} config={config}
          onSave={handleSave} onDelete={handleDel} onClose={() => setModal(null)}
        />
      )}

      <style>{`
        *{box-sizing:border-box;}
        body{margin:0;}
        input,select,button{font-family:${C.font};}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${C.b2};border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:${C.b3};}
      `}</style>
    </div>
  );
}
