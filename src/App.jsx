import { useState, useRef, useCallback, useMemo, useEffect } from "react";

/* ───────────────────────────────────────────────────────────
   FONTS
─────────────────────────────────────────────────────────── */
function useFonts() {
  useEffect(() => {
    const id = "rp-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(l);
  }, []);
}

/* ───────────────────────────────────────────────────────────
   CONSTANTS
─────────────────────────────────────────────────────────── */
const SIDE_W   = 3.2;   // shelf side wall cm
const BOARD_H  = 2.8;   // board thickness cm
const FOOT_H   = 5.0;   // footer / plinth cm
const GAP      = 0.5;   // gap between products cm
const START_X  = SIDE_W + 1.0; // left margin cm
const DRAG_TH  = 1.0;   // cm threshold before drag is "real"

const PTYPES = [
  { id:"T6",  label:"6×0,33L Träger",  short:"T6",  wCm:40, hCm:15.5, kind:"traeger", cols:3 },
  { id:"T4",  label:"4×0,33L Träger",  short:"T4",  wCm:27, hCm:15.5, kind:"traeger", cols:2 },
  { id:"K20", label:"20×0,5L Kiste",   short:"K20", wCm:40, hCm:30,   kind:"kiste" },
  { id:"K24", label:"24×0,33L Kiste",  short:"K24", wCm:40, hCm:28,   kind:"kiste" },
];

const PMAP = {};
PTYPES.forEach(t => (PMAP[t.id] = t));

const PALETTE = [
  "#C0392B","#1A6FC4","#D4A017","#1E8449","#C0550A",
  "#6C3483","#117A65","#2471A3","#884EA0","#1A5276",
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

/* ───────────────────────────────────────────────────────────
   UTILITIES
─────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);
const pW  = (p) => (PMAP[p.type] || PTYPES[0]).wCm;

const calcSp = (ek, vk) => {
  const e = parseFloat(ek), v = parseFloat(vk);
  if (!e || !v || v === 0) return null;
  return +((v - e) / v * 100).toFixed(2);
};
const spColor = (p) => {
  if (p === null) return "#444";
  if (p >= 35) return "#00c853"; if (p >= 25) return "#69d100";
  if (p >= 15) return "#f5b800"; if (p >= 5)  return "#ff8c00";
  return "#ef5350";
};
const vkColor = (v, lo, hi) => {
  if (hi <= lo) return "#444";
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

/* ───────────────────────────────────────────────────────────
   BARCODE
─────────────────────────────────────────────────────────── */
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

/* ───────────────────────────────────────────────────────────
   BOTTLE — front elevation (single bottle silhouette)
─────────────────────────────────────────────────────────── */
function Bottle({ bx, by, bw, bh, color }) {
  const capH  = bh * 0.062;
  const neckH = bh * 0.110;
  const shH   = bh * 0.138;
  const bodyH = bh - capH - neckH - shH;
  const bodyW = bw * 0.78;
  const neckW = bw * 0.30;
  const cx    = bx + bw / 2;
  const neckX = cx - neckW / 2;
  const bodyX = cx - bodyW / 2;
  const neckY = by + capH;
  const shY   = neckY + neckH;
  const bodyY = shY + shH;

  return (
    <g>
      {/* Body */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} fill={color} rx={0.5} />
      {/* Shoulder */}
      <polygon
        points={`${neckX},${shY} ${neckX + neckW},${shY} ${bodyX + bodyW},${bodyY} ${bodyX},${bodyY}`}
        fill={color} />
      {/* Neck */}
      <rect x={neckX} y={neckY} width={neckW} height={neckH} fill={color} />
      {/* Crown cap */}
      <rect x={cx - neckW * 0.68} y={by} width={neckW * 1.36} height={capH}
        fill="#3a3a3a" rx={0.3} />
      {/* Label area */}
      <rect x={bodyX + bodyW * 0.08} y={bodyY + bodyH * 0.18}
        width={bodyW * 0.84} height={bodyH * 0.5}
        fill="rgba(255,255,255,0.24)" rx={0.3} />
      {/* Specular */}
      <rect x={bodyX + bodyW * 0.06} y={bodyY + bodyH * 0.04}
        width={bodyW * 0.10} height={bodyH * 0.80}
        fill="rgba(255,255,255,0.12)" rx={0.2} />
    </g>
  );
}

/* ───────────────────────────────────────────────────────────
   TRAEGER PRODUCT — front view, cols = visible front bottles
─────────────────────────────────────────────────────────── */
function TraegerViz({ x, y, w, h, cols, color }) {
  const g   = w * 0.024;
  const bw  = (w - g * (cols + 1)) / cols;

  return (
    <g>
      {/* Carrier tray */}
      <rect x={x} y={y} width={w} height={h} fill={color} rx={0.8}
        stroke="rgba(0,0,0,0.30)" strokeWidth={0.3} />
      {/* Top-surface sheen */}
      <rect x={x + 0.5} y={y + 0.5} width={w * 0.52} height={h * 0.26}
        fill="rgba(255,255,255,0.13)" rx={0.5} />
      {/* Back-row bottle crowns visible at top */}
      {Array.from({ length: cols }).map((_, i) => {
        const cx2 = x + g + i * (bw + g) + bw / 2;
        return (
          <g key={`bc${i}`}>
            <ellipse cx={cx2} cy={y + h * 0.075} rx={bw * 0.28} ry={h * 0.068}
              fill="rgba(0,0,0,0.50)" />
            <ellipse cx={cx2} cy={y + h * 0.075} rx={bw * 0.17} ry={h * 0.040}
              fill="#2e2e2e" />
          </g>
        );
      })}
      {/* Front-row bottles */}
      {Array.from({ length: cols }).map((_, i) => {
        const bx2 = x + g + i * (bw + g);
        return (
          <Bottle key={`fb${i}`}
            bx={bx2} by={y + h * 0.13}
            bw={bw} bh={h * 0.87}
            color={color + "dd"} />
        );
      })}
      {/* Bottom shadow rail */}
      <rect x={x} y={y + h * 0.91} width={w} height={h * 0.09}
        fill="rgba(0,0,0,0.22)" rx="0 0 0.8 0.8" />
    </g>
  );
}

/* ───────────────────────────────────────────────────────────
   KISTE PRODUCT — wooden crate front view
─────────────────────────────────────────────────────────── */
function KisteViz({ x, y, w, h, color }) {
  return (
    <g>
      {/* Crate body */}
      <rect x={x} y={y} width={w} height={h} fill="#6b4f2a" rx={0.7}
        stroke="rgba(0,0,0,0.38)" strokeWidth={0.4} />
      {/* Horizontal slats */}
      {[0.26, 0.52, 0.76].map((p, i) => (
        <rect key={i} x={x} y={y + h * p - 0.5} width={w} height={1.0}
          fill="rgba(0,0,0,0.28)" />
      ))}
      {/* Vertical stiles */}
      {[0.25, 0.5, 0.75].map((p, i) => (
        <rect key={i} x={x + w * p - 0.45} y={y} width={0.9} height={h}
          fill="rgba(0,0,0,0.20)" />
      ))}
      {/* Brand colour band */}
      <rect x={x} y={y + h * 0.32} width={w} height={h * 0.36} fill={`${color}72`} />
      {/* Highlight */}
      <rect x={x + w * 0.055} y={y + 1} width={w * 0.09} height={h - 2}
        fill="rgba(255,255,255,0.09)" rx={0.3} />
    </g>
  );
}

/* ───────────────────────────────────────────────────────────
   SHELF SVG  (interactive or static for PDF)
─────────────────────────────────────────────────────────── */
function ShelfSVG({
  config, products, mode,
  onLevel, onProd, onReorder,
  svgId = "shelf-main", interactive = true,
}) {
  const wCm = config.widthM  * 100;
  const hCm = config.heightM * 100;
  const TW  = wCm + 2 * SIDE_W;
  const TH  = hCm + FOOT_H;
  const sy  = (fc) => TH - FOOT_H - fc;

  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  // drag = { prodId, levelId, currentX, itemW, ptrStartX, itemStartX, moved }

  const sorted = useMemo(
    () => [...config.levels].sort((a, b) => a.hCm - b.hCm),
    [config.levels]
  );
  const vks = useMemo(
    () => products.map(p => parseFloat(p.vk)).filter(v => isFinite(v) && v > 0),
    [products]
  );
  const minVk = vks.length ? Math.min(...vks) : 0;
  const maxVk = vks.length ? Math.max(...vks) : 1;

  /* Convert client → SVG x */
  const toSvgX = useCallback((e) => {
    const svg = svgRef.current; if (!svg) return 0;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse()).x;
  }, []);

  /* Compute visual positions for one level */
  const levelPositions = useCallback((levelId) => {
    const prods = products.filter(p => p.levelId === levelId);

    if (!drag || drag.levelId !== levelId) {
      let cx = START_X;
      return prods.map(p => {
        const w = pW(p);
        const pos = { id: p.id, x: cx, w, isDrag: false, prod: p };
        cx += w + GAP;
        return pos;
      });
    }

    const dW = drag.itemW;
    const dCx = drag.currentX + dW / 2;
    const others = prods.filter(p => p.id !== drag.prodId);

    let cx = START_X;
    const rest = others.map(p => {
      const w = pW(p);
      const r = { id: p.id, w, center: cx + w / 2, prod: p };
      cx += w + GAP;
      return r;
    });

    let ins = rest.findIndex(r => dCx < r.center);
    if (ins === -1) ins = rest.length;

    cx = START_X;
    const result = [];
    for (let i = 0; i <= rest.length; i++) {
      if (i === ins) cx += dW + GAP;
      if (i < rest.length) {
        result.push({ id: rest[i].id, x: cx, w: rest[i].w, isDrag: false, prod: rest[i].prod });
        cx += rest[i].w + GAP;
      }
    }
    const dp = prods.find(p => p.id === drag.prodId);
    result.push({ id: drag.prodId, x: drag.currentX, w: dW, isDrag: true, prod: dp });
    return result;
  }, [drag, products]);

  /* Mouse handlers */
  const onProdDown = useCallback((e, prod, posX) => {
    if (!interactive) return;
    e.preventDefault();
    const pt = PMAP[prod.type] || PTYPES[0];
    setDrag({
      prodId: prod.id, levelId: prod.levelId,
      currentX: posX, itemW: pt.wCm,
      ptrStartX: toSvgX(e), itemStartX: posX,
      moved: false,
    });
  }, [interactive, toSvgX]);

  const onMove = useCallback((e) => {
    if (!drag) return;
    const dx = toSvgX(e) - drag.ptrStartX;
    const newX = drag.itemStartX + dx;
    const maxX = SIDE_W + wCm - drag.itemW - 1.0;
    setDrag(d => d ? {
      ...d,
      currentX: Math.max(START_X, Math.min(maxX, newX)),
      moved: d.moved || Math.abs(dx) > DRAG_TH,
    } : null);
  }, [drag, toSvgX, wCm]);

  const onUp = useCallback(() => {
    if (!drag) return;
    if (!drag.moved) {
      onProd(drag.prodId);
      setDrag(null);
      return;
    }
    // Commit new order
    const prods = products.filter(p => p.levelId === drag.levelId);
    const dW = drag.itemW;
    const dCx = drag.currentX + dW / 2;
    const others = prods.filter(p => p.id !== drag.prodId);
    let cx = START_X;
    const rest = others.map(p => {
      const w = pW(p);
      const r = { id: p.id, center: cx + w / 2 };
      cx += w + GAP;
      return r;
    });
    let ins = rest.findIndex(r => dCx < r.center);
    if (ins === -1) ins = rest.length;
    const newOrder = others.map(p => p.id);
    newOrder.splice(ins, 0, drag.prodId);
    onReorder(drag.levelId, newOrder);
    setDrag(null);
  }, [drag, products, onProd, onReorder]);

  return (
    <svg
      ref={svgRef}
      id={svgId}
      viewBox={`0 0 ${TW} ${TH}`}
      style={{ width: "100%", height: "auto", display: "block", cursor: drag ? "grabbing" : "default", userSelect: "none" }}
      xmlns="http://www.w3.org/2000/svg"
      onMouseMove={interactive ? onMove : undefined}
      onMouseUp={interactive ? onUp : undefined}
      onMouseLeave={interactive ? onUp : undefined}
    >
      <defs>
        <linearGradient id={`sg_${svgId}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2c1a08" />
          <stop offset="40%" stopColor="#5e3e1a" />
          <stop offset="100%" stopColor="#2c1a08" />
        </linearGradient>
        <linearGradient id={`bg_${svgId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eee6d6" />
          <stop offset="100%" stopColor="#dfd6c4" />
        </linearGradient>
        <filter id={`ds_${svgId}`} x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="0.6" dy="1.0" stdDeviation="0.8" floodOpacity="0.40" />
        </filter>
        <filter id={`dsd_${svgId}`} x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="1.2" dy="2.0" stdDeviation="1.4" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* ── Shell ── */}
      <rect x={0} y={0} width={TW} height={TH} fill="#1e1008" rx={1} />
      <rect x={SIDE_W} y={0} width={wCm} height={TH - FOOT_H} fill={`url(#bg_${svgId})`} />
      <rect x={0} y={0} width={SIDE_W} height={TH} fill={`url(#sg_${svgId})`} />
      <rect x={TW - SIDE_W} y={0} width={SIDE_W} height={TH} fill={`url(#sg_${svgId})`} />
      {/* Wall inner-edge shadow */}
      <rect x={SIDE_W} y={0} width={0.9} height={TH - FOOT_H} fill="rgba(0,0,0,0.13)" />
      <rect x={TW - SIDE_W - 0.9} y={0} width={0.9} height={TH - FOOT_H} fill="rgba(0,0,0,0.13)" />

      {/* ── Boards ── */}
      {sorted.filter(l => l.hCm > 0).map(lv => (
        <g key={`bd${lv.id}`}>
          <rect x={SIDE_W} y={sy(lv.hCm)} width={wCm} height={BOARD_H} fill="#5a3b18" />
          <rect x={SIDE_W} y={sy(lv.hCm)} width={wCm} height={0.7} fill="rgba(255,220,140,0.22)" />
          <rect x={SIDE_W} y={sy(lv.hCm) + BOARD_H - 0.6} width={wCm} height={0.6} fill="rgba(0,0,0,0.18)" />
        </g>
      ))}
      {/* Floor board */}
      <rect x={SIDE_W} y={sy(0)} width={wCm} height={BOARD_H} fill="#4e3310" />
      <rect x={SIDE_W} y={sy(0)} width={wCm} height={0.7} fill="rgba(255,220,140,0.18)" />

      {/* ── Click areas (empty shelf zones) ── */}
      {interactive && sorted.map((lv, i) => {
        const above = sorted[i + 1];
        const surfY = sy(lv.hCm);
        const ceilY = above ? sy(above.hCm) + BOARD_H : 2;
        const aH = surfY - ceilY;
        if (aH < 4) return null;
        return (
          <rect key={`ca${lv.id}`}
            x={SIDE_W} y={ceilY} width={wCm} height={aH}
            fill="rgba(0,0,0,0)"
            style={{ cursor: "crosshair" }}
            onClick={() => { if (!drag) onLevel(lv.id); }}
          />
        );
      })}

      {/* ── Products ── */}
      {sorted.map(lv => {
        const positions = levelPositions(lv.id);
        // Render non-dragged first, then dragged (stays on top)
        return [...positions.filter(p => !p.isDrag), ...positions.filter(p => p.isDrag)].map(pos => {
          const prod = pos.prod; if (!prod) return null;
          const pt   = PMAP[prod.type] || PTYPES[0];
          const px   = pos.x;
          const py   = sy(lv.hCm) - pt.hCm;

          let col = prod.color || "#1A6FC4";
          if (mode === "margin") col = spColor(calcSp(prod.ek, prod.vk));
          else if (mode === "vk") col = vkColor(parseFloat(prod.vk), minVk, maxVk);

          const sp = calcSp(prod.ek, prod.vk);
          const isDragging = pos.isDrag;
          const fs = Math.min(4.5, pt.wCm / 9);
          const name = (prod.title || pt.short).slice(0, Math.floor(pt.wCm / 2.6));

          return (
            <g
              key={prod.id}
              filter={isDragging ? `url(#dsd_${svgId})` : `url(#ds_${svgId})`}
              opacity={isDragging ? 0.93 : 1}
              style={{ cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default" }}
              onMouseDown={interactive ? (e) => onProdDown(e, prod, pos.x) : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Product visual */}
              {pt.kind === "traeger" ? (
                <TraegerViz x={px} y={py} w={pt.wCm} h={pt.hCm} cols={pt.cols} color={col} />
              ) : (
                <KisteViz x={px} y={py} w={pt.wCm} h={pt.hCm} color={col} />
              )}

              {/* Text overlays */}
              {mode === "normal" && prod.title && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm * 0.62}
                  textAnchor="middle" fontSize={fs}
                  fill="rgba(255,255,255,0.92)" fontWeight="600"
                  fontFamily="Outfit,sans-serif" style={{ pointerEvents: "none" }}>
                  {name}
                </text>
              )}
              {mode === "normal" && prod.vk && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm - 1.8}
                  textAnchor="middle" fontSize={3.0}
                  fill="rgba(255,255,255,0.80)"
                  fontFamily="IBM Plex Mono,monospace" style={{ pointerEvents: "none" }}>
                  {parseFloat(prod.vk).toFixed(2)} €
                </text>
              )}
              {mode === "margin" && sp !== null && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm / 2 + 2.2}
                  textAnchor="middle" fontSize={4.2}
                  fill="rgba(0,0,0,0.78)" fontWeight="700"
                  fontFamily="Outfit,sans-serif" style={{ pointerEvents: "none" }}>
                  {sp}%
                </text>
              )}
              {mode === "vk" && prod.vk && (
                <text x={px + pt.wCm / 2} y={py + pt.hCm - 1.8}
                  textAnchor="middle" fontSize={3.0}
                  fill="rgba(255,255,255,0.82)"
                  fontFamily="IBM Plex Mono,monospace" style={{ pointerEvents: "none" }}>
                  {parseFloat(prod.vk).toFixed(2)} €
                </text>
              )}

              {/* Drag handle dots */}
              {interactive && !isDragging && (
                <g style={{ pointerEvents: "none" }} opacity={0.35}>
                  {[0, 1].map(row => [0, 1, 2].map(col2 => (
                    <circle key={`${row}-${col2}`}
                      cx={px + pt.wCm / 2 - 1.8 + col2 * 1.8}
                      cy={py + 2.0 + row * 1.8} r={0.42} fill="white" />
                  )))}
                </g>
              )}

              {/* Drag border */}
              {isDragging && (
                <rect x={px} y={py} width={pt.wCm} height={pt.hCm}
                  fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={0.7}
                  strokeDasharray="2.5 1.2" rx={0.9} />
              )}
            </g>
          );
        });
      })}

      {/* ── Level labels ── */}
      {sorted.filter(l => l.hCm > 0).map(lv => (
        <text key={`lb${lv.id}`}
          x={SIDE_W + 1.2} y={sy(lv.hCm) - 0.9}
          fontSize={2.7} fill="rgba(90,60,20,0.75)"
          fontFamily="Outfit,sans-serif" fontWeight="500">
          {lv.label}
        </text>
      ))}

      {/* ── Dimension ruler ── */}
      <line x1={SIDE_W} y1={TH - 0.9} x2={TW - SIDE_W} y2={TH - 0.9}
        stroke="rgba(90,60,20,0.5)" strokeWidth={0.35} />
      <line x1={SIDE_W}      y1={TH - 2.2} x2={SIDE_W}      y2={TH - 0.2} stroke="rgba(90,60,20,0.5)" strokeWidth={0.35} />
      <line x1={TW - SIDE_W} y1={TH - 2.2} x2={TW - SIDE_W} y2={TH - 0.2} stroke="rgba(90,60,20,0.5)" strokeWidth={0.35} />
      <text x={TW / 2} y={TH - 0.1} textAnchor="middle" fontSize={2.3}
        fill="rgba(90,60,20,0.55)" fontFamily="IBM Plex Mono,monospace">
        {config.widthM.toFixed(2)} m
      </text>
    </svg>
  );
}

/* ───────────────────────────────────────────────────────────
   PRODUCT MODAL
─────────────────────────────────────────────────────────── */
function ProductModal({ initial, levelId, config, onSave, onDelete, onClose }) {
  const lv = config.levels.find(l => l.id === (levelId ?? initial?.levelId));
  const [d, setD] = useState({
    type: "T6", title: "", articleNr: "", color: "#1A6FC4", ek: "", vk: "",
    ...(initial || {}),
  });
  const set = (k, v) => setD(p => ({ ...p, [k]: v }));
  const sp = calcSp(d.ek, d.vk);

  const INP = {
    width: "100%", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
    padding: "10px 13px", color: "#e0e8f0", fontSize: 13,
    outline: "none", boxSizing: "border-box",
    fontFamily: "'Outfit', sans-serif",
  };
  const LABEL = {
    color: "#4a7aaa", fontSize: 10, fontWeight: 600,
    letterSpacing: 2, marginBottom: 6, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(4,12,24,0.88)", backdropFilter: "blur(8px)",
      fontFamily: "'Outfit', sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        background: "#0d1a2d",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column", maxHeight: "95vh",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,#071a38,#0a2550)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "18px 20px", flexShrink: 0,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{ color: "#e0e8f0", fontWeight: 700, fontSize: 16, letterSpacing: 0.5 }}>
              {initial ? "Produkt bearbeiten" : "Produkt hinzufügen"}
            </div>
            {lv && <div style={{ color: "#4a7aaa", fontSize: 11, marginTop: 3 }}>{lv.label}</div>}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.35)",
            fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 2px",
          }}
            onMouseOver={e => e.target.style.color = "#fff"}
            onMouseOut={e => e.target.style.color = "rgba(255,255,255,0.35)"}>
            ×
          </button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Type */}
          <div>
            <span style={LABEL}>GEBINDETYP</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PTYPES.map(t => (
                <button key={t.id} onClick={() => set("type", t.id)} style={{
                  padding: "10px 12px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                  background: d.type === t.id ? "rgba(26,111,196,0.25)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${d.type === t.id ? "#1A6FC4" : "rgba(255,255,255,0.08)"}`,
                  transition: "all 0.15s",
                }}>
                  <div style={{ color: d.type === t.id ? "#6aabf7" : "#ccd6e0", fontWeight: 700, fontSize: 15 }}>{t.short}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>{t.label}</div>
                  <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontFamily: "IBM Plex Mono,monospace", marginTop: 2 }}>{t.wCm} × {t.hCm} cm</div>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <span style={LABEL}>PRODUKTNAME</span>
            <input value={d.title} onChange={e => set("title", e.target.value)}
              placeholder="z.B. Warsteiner Pils 6×0,33L"
              style={INP} />
          </div>

          {/* Article Nr */}
          <div>
            <span style={LABEL}>ARTIKEL-NUMMER</span>
            <input value={d.articleNr}
              onChange={e => set("articleNr", e.target.value.toUpperCase())}
              placeholder="z.B. 4012345678901"
              style={{ ...INP, fontFamily: "IBM Plex Mono,monospace" }} />
            {d.articleNr && (
              <div style={{ marginTop: 8, background: "#fff", borderRadius: 7, padding: "7px 6px", display: "inline-block" }}>
                <BarcodeImg text={d.articleNr} nw={1.0} h={26} />
              </div>
            )}
          </div>

          {/* Color */}
          <div>
            <span style={LABEL}>FARBE</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {PALETTE.map(c => (
                <button key={c} onClick={() => set("color", c)} style={{
                  width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer",
                  border: `3px solid ${d.color === c ? "#fff" : "transparent"}`,
                  outline: d.color === c ? `2px solid ${c}` : "none", outlineOffset: 2,
                  transition: "all 0.15s", flexShrink: 0,
                }} />
              ))}
              <input type="color" value={d.color} onChange={e => set("color", e.target.value)}
                style={{ width: 28, height: 28, borderRadius: "50%", cursor: "pointer", border: "2px solid rgba(255,255,255,0.2)", padding: 0, background: "none" }} />
            </div>
          </div>

          {/* Prices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["ek", "EK-PREIS (€)"], ["vk", "VK-PREIS (€)"]].map(([k, lbl]) => (
              <div key={k}>
                <span style={LABEL}>{lbl}</span>
                <input type="number" step="0.01" min="0" value={d[k]}
                  onChange={e => set(k, e.target.value)} placeholder="0.00"
                  style={{ ...INP, fontFamily: "IBM Plex Mono,monospace" }} />
              </div>
            ))}
          </div>

          {/* Spanne */}
          {sp !== null && (
            <div style={{
              background: `${spColor(sp)}14`,
              border: `1px solid ${spColor(sp)}38`,
              borderRadius: 10, padding: "12px 16px", textAlign: "center",
            }}>
              <span style={{
                color: spColor(sp), fontSize: 20, fontWeight: 800,
                letterSpacing: 0.5, fontFamily: "'Outfit', sans-serif",
              }}>
                Handelsspanne: {sp} %
              </span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {initial && (
              <button onClick={() => onDelete(initial.id)} style={{
                padding: "10px 16px", borderRadius: 9, cursor: "pointer",
                background: "rgba(239,83,80,0.12)", color: "#ef5350",
                border: "1px solid rgba(239,83,80,0.30)", fontWeight: 600, fontSize: 13,
              }}>
                Löschen
              </button>
            )}
            <button onClick={onClose} style={{
              flex: 1, padding: "11px", borderRadius: 9, cursor: "pointer",
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.08)", fontWeight: 500, fontSize: 13,
            }}>
              Abbrechen
            </button>
            <button onClick={() => onSave(d)} style={{
              flex: 1, padding: "11px", borderRadius: 9, cursor: "pointer",
              background: "linear-gradient(135deg,#1255a0,#1a6fc4)",
              color: "#fff", border: "none", fontWeight: 700, fontSize: 13, letterSpacing: 0.3,
            }}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   SETTINGS
─────────────────────────────────────────────────────────── */
function SettingsPanel({ config, setConfig }) {
  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }));
  const sorted = useMemo(() => [...config.levels].sort((a, b) => a.hCm - b.hCm), [config.levels]);

  const addLevel = () => {
    const last = Math.max(...config.levels.map(l => l.hCm));
    setConfig(c => ({
      ...c,
      levels: [...c.levels, {
        id: uid(),
        hCm: Math.min(last + 40, Math.round(c.heightM * 100) - 10),
        label: `Ebene ${c.levels.length}`,
      }],
    }));
  };
  const rm = (id) => setConfig(c => ({ ...c, levels: c.levels.filter(l => l.id !== id) }));
  const updL = (id, k, v) =>
    setConfig(c => ({ ...c, levels: c.levels.map(l => l.id === id ? { ...l, [k]: v } : l) }));

  const CARD  = { background: "#0d1a2d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 24, marginBottom: 16 };
  const HEAD  = { color: "#4a7aaa", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 };
  const INP   = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "10px 12px", color: "#e0e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "IBM Plex Mono,monospace" };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", fontFamily: "'Outfit',sans-serif" }}>

      {/* Dimensions */}
      <div style={CARD}>
        <div style={HEAD}>REGAL-ABMESSUNGEN</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[["widthM", "BREITE (m)"], ["heightM", "HÖHE (m)"]].map(([k, lbl]) => (
            <div key={k}>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 600, letterSpacing: 2, marginBottom: 6 }}>{lbl}</div>
              <input type="number" step="0.01" min={0.5} max={k === "widthM" ? 6 : 3}
                value={config[k]}
                onChange={e => upd(k, parseFloat(e.target.value) || config[k])}
                style={INP} />
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(26,111,196,0.14)", border: "1px solid rgba(26,111,196,0.28)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#4a7aaa", display: "flex", gap: 10 }}>
          <div style={{ fontWeight: 600, color: "#6aabf7", flexShrink: 0 }}>INFO</div>
          <span>Standard EDEKA Mehrweg-Modul: <strong>1,33 m × 2,00 m</strong> — Mehrfachmodule: 2,66 m · 3,99 m</span>
        </div>
      </div>

      {/* Levels */}
      <div style={CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={HEAD}>EINLEGEBÖDEN</div>
          <button onClick={addLevel} style={{
            background: "linear-gradient(135deg,#1255a0,#1a6fc4)", color: "#fff",
            border: "none", borderRadius: 7, padding: "7px 16px",
            fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
            fontFamily: "'Outfit',sans-serif",
          }}>
            + BODEN
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {sorted.map((lv, i) => (
            <div key={lv.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 9, padding: "8px 12px",
            }}>
              <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 11, width: 16, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: "#7a5428", flexShrink: 0 }} />
              <input value={lv.label} disabled={lv.hCm === 0}
                onChange={e => updL(lv.id, "label", e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", color: lv.hCm === 0 ? "rgba(255,255,255,0.25)" : "#e0e8f0", fontSize: 13, outline: "none", fontFamily: "'Outfit',sans-serif" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <input type="number" min={0} step={5} value={lv.hCm} disabled={lv.hCm === 0}
                  onChange={e => updL(lv.id, "hCm", Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ ...INP, width: 62, padding: "5px 8px", textAlign: "center", opacity: lv.hCm === 0 ? 0.3 : 1 }} />
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>cm</span>
              </div>
              {lv.hCm !== 0 && (
                <button onClick={() => rm(lv.id)} style={{
                  background: "none", border: "none", color: "rgba(239,83,80,0.45)",
                  cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 3px",
                  fontFamily: "inherit",
                }}
                  onMouseOver={e => e.target.style.color = "#ef5350"}
                  onMouseOut={e => e.target.style.color = "rgba(239,83,80,0.45)"}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Product norm table */}
      <div style={CARD}>
        <div style={HEAD}>GEBINDE-NORMEN (DIN/EURO)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PTYPES.map(t => (
            <div key={t.id} style={{
              background: t.kind === "traeger" ? "rgba(26,111,196,0.12)" : "rgba(106,79,42,0.18)",
              border: `1px solid ${t.kind === "traeger" ? "rgba(26,111,196,0.25)" : "rgba(106,79,42,0.30)"}`,
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ color: t.kind === "traeger" ? "#4a7aaa" : "#a0743a", fontSize: 9, fontWeight: 700, letterSpacing: 2, marginBottom: 5 }}>
                {t.kind === "traeger" ? "TRÄGER" : "KISTE"}
              </div>
              <div style={{ color: "#e0e8f0", fontSize: 14, fontWeight: 600 }}>{t.label}</div>
              <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontFamily: "IBM Plex Mono,monospace", marginTop: 4 }}>
                {t.wCm} × {t.hCm} cm
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   PDF EXPORT
─────────────────────────────────────────────────────────── */
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
  const PW = 210, PH = 297, ML = 12;

  // Header
  doc.setFillColor(6, 24, 52); doc.rect(0, 0, PW, 24, "F");
  doc.setFillColor(212, 160, 23); doc.rect(ML, 5.5, 13, 13, "F");
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(6, 24, 52);
  doc.text("E", ML + 3.2, 14);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15); doc.text("Mehrweg Regalplanung", ML + 18, 13);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`${config.widthM.toFixed(2)} m × ${config.heightM.toFixed(2)} m · ${products.length} Produkte`, ML + 18, 18.5);
  doc.text(new Date().toLocaleString("de-DE"), PW - ML, 13, { align: "right" });

  let y = 30;

  // Shelf image
  const svgEl = document.getElementById("shelf-pdf-hidden");
  if (svgEl) {
    try {
      const vb = svgEl.viewBox.baseVal;
      const sc = 4;
      const cv = document.createElement("canvas");
      cv.width = vb.width * sc; cv.height = vb.height * sc;
      const ctx = cv.getContext("2d");
      ctx.scale(sc, sc); ctx.fillStyle = "#1e1008"; ctx.fillRect(0, 0, vb.width, vb.height);
      const str = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      await new Promise(res => {
        const img = new Image();
        img.onload = () => { ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url); res(); };
        img.onerror = () => { URL.revokeObjectURL(url); res(); };
        img.src = url;
      });
      const iW = 70, iH = iW * (vb.height / vb.width);
      doc.addImage(cv.toDataURL("image/png"), "PNG", PW - ML - iW, y, iW, iH);
      // Config info
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(6, 24, 52);
      doc.text("Konfiguration", ML, y + 7);
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
      const sLvl = [...config.levels].sort((a, b) => a.hCm - b.hCm);
      sLvl.forEach((lv, i) => doc.text(`${lv.label}: ${lv.hCm} cm`, ML + 2, y + 15 + i * 6));
      y = Math.max(y + 15 + sLvl.length * 6, y + iH) + 10;
    } catch (e) { console.error(e); y += 5; }
  }

  // Table header
  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(6, 24, 52);
  doc.text("Produktliste", ML, y); y += 7;
  doc.setFillColor(10, 37, 80); doc.rect(ML, y, PW - 2 * ML, 7.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
  doc.text("Barcode / Artikel-Nr.", ML + 2, y + 5);
  doc.text("Produkt", ML + 62, y + 5);
  doc.text("Ebene", ML + 118, y + 5);
  doc.text("EK", ML + 143, y + 5, { align: "right" });
  doc.text("VK", ML + 160, y + 5, { align: "right" });
  doc.text("Spanne", ML + 180, y + 5, { align: "right" });
  y += 9;

  const sorted = [...products].sort((a, b) => {
    const la = config.levels.find(l => l.id === a.levelId);
    const lb = config.levels.find(l => l.id === b.levelId);
    return (la?.hCm || 0) - (lb?.hCm || 0);
  });

  doc.setFont("helvetica", "normal");
  sorted.forEach((p, i) => {
    const RH = 16;
    if (y + RH > PH - 16) { doc.addPage(); y = 16; }
    if (i % 2 === 0) { doc.setFillColor(244, 248, 255); doc.rect(ML, y - 0.5, PW - 2 * ML, RH, "F"); }
    // Color stripe
    if (p.color && p.color.startsWith("#")) {
      try {
        const h2 = p.color.slice(1);
        doc.setFillColor(parseInt(h2.slice(0, 2), 16), parseInt(h2.slice(2, 4), 16), parseInt(h2.slice(4, 6), 16));
        doc.rect(ML, y - 0.5, 2.5, RH, "F");
      } catch (_) { }
    }
    // Barcode
    if (p.articleNr) {
      const nw = 0.19, bh = 9;
      const { rects, tw } = bc39(p.articleNr, ML + 3, y, nw, bh);
      rects.forEach(r => { doc.setFillColor(0, 0, 0); doc.rect(r.x, r.y, r.w, r.h, "F"); });
      doc.setFontSize(5.5); doc.setTextColor(40, 40, 40); doc.setFont("courier", "normal");
      doc.text(p.articleNr, ML + 3 + tw / 2, y + bh + 3.5, { align: "center" });
      doc.setFont("helvetica", "normal");
    }
    const tY = y + 6.5;
    doc.setFontSize(8); doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold"); doc.text((p.title || "—").slice(0, 30), ML + 62, tY);
    doc.setFont("helvetica", "normal"); doc.setTextColor(70, 70, 70);
    const lv2 = config.levels.find(l => l.id === p.levelId);
    doc.text(lv2?.label || "—", ML + 118, tY);
    if (p.ek) { doc.setTextColor(100, 100, 100); doc.text(fmt(p.ek), ML + 143, tY, { align: "right" }); }
    if (p.vk) {
      doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
      doc.text(fmt(p.vk), ML + 160, tY, { align: "right" });
      doc.setFont("helvetica", "normal");
    }
    const sp2 = calcSp(p.ek, p.vk);
    if (sp2 !== null) {
      const sc2 = spColor(sp2);
      if (sc2.startsWith("#")) {
        const h3 = sc2.slice(1);
        let r2 = parseInt(h3.slice(0, 2), 16), g2 = parseInt(h3.slice(2, 4), 16), b2 = parseInt(h3.slice(4, 6), 16);
        if (r2 > 180 && g2 > 180) { r2 = 160; g2 = 140; b2 = 0; }
        doc.setTextColor(r2, g2, b2);
      }
      doc.setFont("helvetica", "bold"); doc.text(`${sp2} %`, ML + 180, tY, { align: "right" });
      doc.setFont("helvetica", "normal");
    }
    doc.setTextColor(0, 0, 0);
    y += RH;
  });

  // Summary
  if (products.length > 0) {
    if (y + 26 > PH - 12) { doc.addPage(); y = 15; }
    y += 6;
    doc.setFillColor(234, 242, 255); doc.rect(ML, y, PW - 2 * ML, 22, "F");
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(6, 24, 52);
    doc.text("Zusammenfassung", ML + 3, y + 6);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
    doc.text(`Produkte gesamt: ${products.length}`, ML + 3, y + 13);
    const wS = products.filter(p => calcSp(p.ek, p.vk) !== null);
    if (wS.length) {
      const avg = (wS.reduce((s, p) => s + calcSp(p.ek, p.vk), 0) / wS.length).toFixed(1);
      doc.text(`Ø Handelsspanne: ${avg} %`, ML + 62, y + 13);
    }
    const top = [...products].filter(p => p.vk).sort((a, b) => parseFloat(b.vk) - parseFloat(a.vk))[0];
    if (top) doc.text(`Höchster VK: ${fmt(top.vk)} — ${top.title || "—"}`, ML + 3, y + 19);
  }

  // Footer
  const np = doc.getNumberOfPages();
  for (let pg = 1; pg <= np; pg++) {
    doc.setPage(pg);
    doc.setFillColor(228, 235, 244); doc.rect(0, PH - 10, PW, 10, "F");
    doc.setFontSize(7); doc.setTextColor(130, 130, 130); doc.setFont("helvetica", "normal");
    doc.text("EDEKA Mehrweg Regalplaner", ML, PH - 4);
    doc.text(`Seite ${pg} / ${np}`, PW - ML, PH - 4, { align: "right" });
  }
  doc.save("regal-planung-mehrweg.pdf");
}

/* ───────────────────────────────────────────────────────────
   APP
─────────────────────────────────────────────────────────── */
export default function App() {
  useFonts();
  const [tab, setTab]       = useState("settings");
  const [config, setConfig] = useState(DEFAULT_CFG);
  const [products, setProds] = useState([]);
  const [mode, setMode]     = useState("normal");
  const [modal, setModal]   = useState(null);
  const [busy, setBusy]     = useState(false);

  const editP = modal?.mode === "edit" ? products.find(p => p.id === modal.pid) : null;

  const handleSave = (data) => {
    if (modal.mode === "add") setProds(ps => [...ps, { ...data, id: uid(), levelId: modal.lvId }]);
    else setProds(ps => ps.map(p => p.id === editP.id ? { ...p, ...data } : p));
    setModal(null);
  };
  const handleDel = (id) => { setProds(ps => ps.filter(p => p.id !== id)); setModal(null); };

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
      avg: ws.length ? +(ws.reduce((s, p) => s + calcSp(p.ek, p.vk), 0) / ws.length).toFixed(1) : null,
    };
  }, [products]);

  const F = "'Outfit', sans-serif";
  const TAB_BASE = { padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 12, letterSpacing: 1.2, transition: "all 0.15s", border: "none" };
  const TAB_A    = { ...TAB_BASE, background: "rgba(26,111,196,0.28)", color: "#6aabf7", boxShadow: "inset 0 0 0 1px rgba(26,111,196,0.5)" };
  const TAB_I    = { ...TAB_BASE, background: "transparent", color: "rgba(255,255,255,0.35)" };

  return (
    <div style={{ minHeight: "100vh", background: "#090f1a", color: "#e0e8f0", fontFamily: F }}>

      {/* Hidden SVG always in DOM for PDF capture */}
      <div style={{ position: "fixed", opacity: 0, pointerEvents: "none", width: 600, left: -9999, top: -9999 }} aria-hidden>
        <ShelfSVG config={config} products={products} mode="normal"
          onLevel={() => { }} onProd={() => { }} onReorder={() => { }}
          svgId="shelf-pdf-hidden" interactive={false} />
      </div>

      {/* ── HEADER ── */}
      <header style={{
        background: "#060d1a",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{
          maxWidth: 1320, margin: "0 auto", padding: "0 20px",
          height: 62, display: "flex", alignItems: "center", gap: 24,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{
              width: 40, height: 40, background: "#d4a017",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 14px rgba(212,160,23,0.35)",
            }}>
              <span style={{ color: "#06142a", fontFamily: F, fontWeight: 900, fontSize: 22 }}>E</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.8, lineHeight: 1.1 }}>
                MEHRWEG REGALPLANER
              </div>
              <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 9, letterSpacing: 2.5, marginTop: 1 }}>
                LEH · EDEKA
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

          {/* Tabs */}
          <nav style={{ display: "flex", gap: 4 }}>
            {[["settings", "EINSTELLUNGEN"], ["design", "REGAL DESIGN"], ["export", "EXPORT"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)}
                style={tab === id ? TAB_A : TAB_I}
                onMouseOver={e => { if (tab !== id) e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
                onMouseOut={e => { if (tab !== id) e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}>
                {lbl}
              </button>
            ))}
          </nav>

          {/* Stats */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {stats.n > 0 && (
              <div style={{
                background: "rgba(26,111,196,0.18)", border: "1px solid rgba(26,111,196,0.30)",
                borderRadius: 7, padding: "4px 12px", fontSize: 12, color: "#4a7aaa",
              }}>
                <strong style={{ color: "#e0e8f0", fontFamily: "'IBM Plex Mono',monospace" }}>{stats.n}</strong> Artikel
              </div>
            )}
            {stats.avg !== null && (
              <div style={{
                background: "rgba(0,200,83,0.12)", border: "1px solid rgba(0,200,83,0.25)",
                borderRadius: 7, padding: "4px 12px", fontSize: 12, color: "#00c853",
              }}>
                Ø <strong style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{stats.avg}%</strong>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 20px" }}>

        {tab === "settings" && <SettingsPanel config={config} setConfig={setConfig} />}

        {tab === "design" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Controls bar */}
            <div style={{
              background: "#0d1a2d", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "13px 18px",
              display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[["normal", "NORMAL"], ["margin", "SPANNE-HEATMAP"], ["vk", "VK-HEATMAP"]].map(([m, lbl]) => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontFamily: F,
                    fontWeight: 700, fontSize: 11, letterSpacing: 1.2, transition: "all 0.15s",
                    background: mode === m ? "linear-gradient(135deg,#1255a0,#1a6fc4)" : "rgba(255,255,255,0.05)",
                    color: mode === m ? "#fff" : "rgba(255,255,255,0.45)",
                    border: mode === m ? "none" : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: mode === m ? "0 4px 18px rgba(26,111,196,0.38)" : "none",
                  }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 11 }}>
                Klick auf freie Fläche — Produkt platzieren &nbsp;·&nbsp; Klick auf Produkt — bearbeiten &nbsp;·&nbsp; Ziehen — umsortieren
              </span>
            </div>

            {/* Heatmap legend */}
            {mode === "margin" && (
              <div style={{ background: "#0d1a2d", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>SPANNE</span>
                {[["≥ 35%", "#00c853"], ["≥ 25%", "#69d100"], ["≥ 15%", "#f5b800"], ["≥ 5%", "#ff8c00"], ["< 5%", "#ef5350"]].map(([l, c]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 13, height: 13, borderRadius: 3, background: c }} />
                    <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>{l}</span>
                  </div>
                ))}
              </div>
            )}
            {mode === "vk" && (
              <div style={{ background: "#0d1a2d", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 16px", display: "flex", gap: 14, alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>VK-PREIS</span>
                <div style={{ width: 120, height: 12, borderRadius: 4, background: "linear-gradient(to right,rgb(30,120,250),rgb(225,30,50))" }} />
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>günstig — teuer</span>
              </div>
            )}

            {/* Shelf */}
            <div style={{
              background: "#0a1220", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: 18, overflowX: "auto",
            }}>
              <ShelfSVG
                config={config} products={products} mode={mode}
                onLevel={lvId => setModal({ mode: "add", lvId })}
                onProd={pid => setModal({ mode: "edit", pid })}
                onReorder={handleReorder}
                svgId="shelf-main" interactive />
            </div>

            {/* Product cards */}
            {products.length > 0 && (
              <div style={{ background: "#0d1a2d", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 18 }}>
                <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: 2.5, marginBottom: 14 }}>
                  PLATZIERTE PRODUKTE — {products.length}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 8 }}>
                  {sorted.map(p => {
                    const sp2 = calcSp(p.ek, p.vk);
                    const lv2 = config.levels.find(l => l.id === p.levelId);
                    return (
                      <div key={p.id}
                        onClick={() => setModal({ mode: "edit", pid: p.id })}
                        style={{
                          cursor: "pointer", padding: "10px 12px", borderRadius: 10,
                          background: "rgba(255,255,255,0.035)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderLeft: `3px solid ${p.color || "#1A6FC4"}`,
                          transition: "background 0.12s",
                        }}
                        onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                        onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.035)"}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.title || "—"}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontFamily: "'IBM Plex Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                          {p.articleNr || "—"}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7 }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{lv2?.label || "—"}</span>
                          {sp2 !== null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: spColor(sp2), background: `${spColor(sp2)}16`, padding: "1px 5px", borderRadius: 4 }}>
                              {sp2}%
                            </span>
                          )}
                        </div>
                        {p.vk && <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginTop: 3, fontFamily: "'IBM Plex Mono',monospace" }}>{parseFloat(p.vk).toFixed(2)} €</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "export" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#0d1a2d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28 }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5, marginBottom: 6 }}>PDF EXPORT</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                    Enthält: Regalansicht · Produktliste · Code39-Barcodes zur Direktbestellung
                  </div>
                </div>
                <button onClick={doExport} disabled={busy} style={{
                  padding: "12px 28px", borderRadius: 10, cursor: busy ? "not-allowed" : "pointer",
                  background: busy ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#0e7a3a,#00c853)",
                  color: "#fff", border: "none", fontFamily: F, fontWeight: 700, fontSize: 13, letterSpacing: 1,
                  boxShadow: busy ? "none" : "0 4px 22px rgba(0,200,83,0.32)",
                  transition: "all 0.2s",
                }}>
                  {busy ? "ERSTELLE PDF …" : "PDF EXPORTIEREN"}
                </button>
              </div>

              {/* Shelf preview */}
              <div style={{ background: "#070f1b", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, marginBottom: 28 }}>
                <div style={{ maxWidth: 700, margin: "0 auto" }}>
                  <ShelfSVG config={config} products={products} mode="normal"
                    onLevel={() => setTab("design")} onProd={() => setTab("design")}
                    onReorder={() => { }} svgId="shelf-preview" interactive={false} />
                </div>
              </div>

              {/* Product table */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, letterSpacing: 2.5 }}>
                  PRODUKTLISTE — {products.length} ARTIKEL
                </div>
                {stats.avg !== null && (
                  <span style={{ fontSize: 12, color: "#00c853", fontWeight: 600 }}>Ø Spanne: {stats.avg}%</span>
                )}
              </div>

              {products.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.18)" }}>
                  <div style={{ fontSize: 38, marginBottom: 12, color: "rgba(255,255,255,0.10)" }}>[ ]</div>
                  <div style={{ fontSize: 13 }}>Keine Produkte platziert.</div>
                  <button onClick={() => setTab("design")} style={{ marginTop: 12, background: "none", border: "none", color: "#4a7aaa", cursor: "pointer", fontSize: 12, textDecoration: "underline", fontFamily: F }}>
                    Zum Regal Design
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: "rgba(10,37,80,0.7)" }}>
                        {["Barcode", "Artikel-Nr.", "Produkt", "Typ", "Ebene", "EK", "VK", "Spanne"].map((h, i) => (
                          <th key={i} style={{ padding: "10px 12px", textAlign: i >= 5 ? "right" : "left", color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, whiteSpace: "nowrap" }}>
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
                        return (
                          <tr key={p.id}
                            style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent", cursor: "pointer", transition: "background 0.1s" }}
                            onClick={() => { setTab("design"); setTimeout(() => setModal({ mode: "edit", pid: p.id }), 80); }}
                            onMouseOver={e => e.currentTarget.style.background = "rgba(26,111,196,0.14)"}
                            onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent"}>
                            <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              {p.articleNr
                                ? <div style={{ background: "#fff", borderRadius: 4, display: "inline-block", padding: "3px 2px" }}><BarcodeImg text={p.articleNr} nw={0.7} h={20} showLabel={false} /></div>
                                : <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 11 }}>—</span>}
                            </td>
                            <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.04)", whiteSpace: "nowrap" }}>
                              {p.articleNr || "—"}
                            </td>
                            <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || "#ccc", flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.title || "—"}</span>
                              </div>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,0.28)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{pt2.short}</td>
                            <td style={{ padding: "8px 12px", fontSize: 12, color: "rgba(255,255,255,0.45)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{lv2?.label || "—"}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(p.ek)}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#e0e8f0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(p.vk)}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              {sp2 !== null ? (
                                <span style={{ fontSize: 12, fontWeight: 700, color: spColor(sp2), background: `${spColor(sp2)}16`, padding: "2px 7px", borderRadius: 5 }}>
                                  {sp2} %
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {products.length > 1 && stats.avg !== null && (
                      <tfoot>
                        <tr style={{ background: "rgba(26,111,196,0.10)" }}>
                          <td colSpan={5} style={{ padding: "8px 12px", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                            {products.length} Produkte gesamt
                          </td>
                          <td colSpan={2} style={{ padding: "8px 12px", textAlign: "right", color: "rgba(255,255,255,0.3)", fontSize: 11 }} />
                          <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: spColor(stats.avg) }}>
                            Ø {stats.avg} %
                          </td>
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
          initial={editP}
          levelId={modal.lvId}
          config={config}
          onSave={handleSave}
          onDelete={handleDel}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
