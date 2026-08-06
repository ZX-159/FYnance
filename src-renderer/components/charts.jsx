// components/charts.jsx — dependency-free canvas charts.
// Colors are read from CSS variables so charts follow the active theme.

import { useEffect, useRef } from 'react';

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function palette() {
  return [
    cssVar('--accent', '#0e7ff1'),
    cssVar('--accent-2', '#6d5df6'),
    cssVar('--ok', '#12a56b'),
    cssVar('--warn', '#f59e0b'),
    cssVar('--err', '#e5484d'),
    cssVar('--cyan', '#06b6d4'),
    cssVar('--pink', '#d946ef'),
    cssVar('--text-3', '#8b93a5'),
  ];
}

function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0.5) return;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------------------ Sparkline
 * Tiny inline trend (wallet card). rows: [{balance_value}]  (oldest → newest)
 */
export function Sparkline({ rows, themeKey }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(120, wrap.clientWidth);
    const H = 42;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const vals = rows.map((r) => Number(r.balance_value)).filter((v) => !Number.isNaN(v));
    if (vals.length < 2) return;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const pad = 3;
    const x = (i) => pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);

    const accent = cssVar('--accent', '#ffffff');
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, hexA(accent, 0.45));
    grad.addColorStop(1, hexA(accent, 0.02));

    ctx.beginPath();
    ctx.moveTo(x(0), y(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(x(i), y(vals[i]));
    ctx.lineTo(x(vals.length - 1), H - pad);
    ctx.lineTo(x(0), H - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x(0), y(vals[0]));
    for (let i = 1; i < vals.length; i++) ctx.lineTo(x(i), y(vals[i]));
    ctx.strokeStyle = hexA(accent, 0.95);
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }, [rows, themeKey]);

  return (
    <div ref={wrapRef} className="spark-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}

function hexA(hex, a) {
  const h = (hex || '#0e7ff1').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return `rgba(14,127,241,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------------ BarChart
 * Stacked bars: known (accent) + unknown (warn) per label. Values in RM.
 */
export function BarChart({ rows, height = 220, unit = 'RM', themeKey }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !rows.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(320, wrap.clientWidth);
    const H = height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padL = 46, padR = 10, padT = 14, padB = 28;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const maxV = Math.max(1, ...rows.map((r) => (r.known || 0) + (r.unknown || 0))) * 1.1;
    const n = rows.length;
    const slot = innerW / n;
    const barW = Math.min(34, slot * 0.55);

    const accent = cssVar('--accent', '#0e7ff1');
    const warn = cssVar('--warn', '#f59e0b');
    const gridCol = cssVar('--border-strong', 'rgba(0,0,0,0.12)');
    const txtCol = cssVar('--text-3', '#8b93a5');

    // grid + y labels
    ctx.font = '10.5px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let s = 0; s <= 4; s++) {
      const v = (maxV / 4) * s;
      const y = padT + innerH - (v / maxV) * innerH;
      ctx.strokeStyle = gridCol;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillStyle = txtCol;
      ctx.fillText(`${unit}${v.toFixed(v >= 100 ? 0 : 1)}`, padL - 6, y);
    }

    const grow = { p: 0, raf: 0 };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let s = 0; s <= 4; s++) {
        const v = (maxV / 4) * s;
        const y = padT + innerH - (v / maxV) * innerH;
        ctx.strokeStyle = gridCol;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = txtCol;
        ctx.fillText(`${unit}${v.toFixed(v >= 100 ? 0 : 1)}`, padL - 6, y);
      }
      rows.forEach((r, i) => {
        const x = padL + slot * i + (slot - barW) / 2;
        const hKnown = ((r.known || 0) / maxV) * innerH * grow.p;
        const hUnk = ((r.unknown || 0) / maxV) * innerH * grow.p;
        const bottom = padT + innerH;
        if (hKnown > 0.5) {
          const grad = ctx.createLinearGradient(0, bottom - hKnown, 0, bottom);
          grad.addColorStop(0, hexA(accent, 0.95));
          grad.addColorStop(1, hexA(accent, 0.65));
          ctx.fillStyle = grad;
          roundRect(ctx, x, bottom - hKnown, barW, hKnown, 6);
          ctx.fill();
        }
        if (hUnk > 0.5) {
          ctx.fillStyle = hexA(warn, 0.9);
          roundRect(ctx, x, bottom - hKnown - hUnk, barW, hUnk + 2, 6);
          ctx.fill();
        }
        ctx.fillStyle = txtCol;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(r.label, x + barW / 2, padT + innerH + 8);
      });
      if (grow.p < 1) {
        grow.p = Math.min(1, grow.p + 0.07);
        grow.raf = requestAnimationFrame(draw);
      }
    };
    draw();
    return () => cancelAnimationFrame(grow.raf);
  }, [rows, height, unit, themeKey]);

  return (
    <div ref={wrapRef} className="chart-wrap chart-lg">
      <canvas ref={ref} />
      {!rows.length && <div className="chart-empty">No monthly data yet</div>}
    </div>
  );
}

/* --------------------------------------------------------------- DonutChart */
export function DonutChart({ rows, height = 210, themeKey }) {
  const ref = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(280, wrap.clientWidth);
    const H = height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const total = rows.reduce((a, r) => a + (r.value || 0), 0);
    if (!total) return;

    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) / 2 - 16;
    const colors = palette();
    const textCol = cssVar('--text', '#0f172a');
    const subCol = cssVar('--text-3', '#8b93a5');

    let a0 = -Math.PI / 2;
    rows.forEach((r, i) => {
      const frac = (r.value || 0) / total;
      const a1 = a0 + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 4, a0 + 0.02, a1 - 0.02);
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 17;
      ctx.stroke();
      a0 = a1;
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = textCol;
    ctx.font = '700 20px system-ui';
    ctx.fillText(`RM ${total.toFixed(2)}`, cx, cy - 4);
    ctx.fillStyle = subCol;
    ctx.font = '11px system-ui';
    ctx.fillText('spent · known', cx, cy + 16);
  }, [rows, height, themeKey]);

  return (
    <div className="donut-wrap">
      <div ref={wrapRef} className="chart-wrap chart-donut">
        <canvas ref={ref} />
        {!rows.length && <div className="chart-empty">No spending data yet</div>}
      </div>
      <div className="donut-legend">
        {rows.map((r, i) => (
          <div className="legend-row" key={r.label}>
            <span className="legend-dot" style={{ background: palette()[i % palette().length] }} />
            <span className="legend-label">{r.label}</span>
            <span className="legend-val">RM {(r.value || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
