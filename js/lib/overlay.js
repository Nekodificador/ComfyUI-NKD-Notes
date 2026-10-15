// The layer above the graph: hint panels, arrows, outlines, the tour bar and the
// contents panel. Everything is rebuilt from node properties on each canvas frame,
// so nothing here needs saving.

import { app } from "../../../scripts/app.js";
import { renderMarkdown, plainTitle } from "./markdown.js";
import {
  arrowBetween, arrowThrough, clientRectToGraph, contains, graphRectToClient,
  pad, resolveTarget, targetRect,
} from "./geometry.js";

export const HINT = "NKDHint";
export const ARROW = "NKDArrow";
export const ZONE = "NKDZone";
export const GUIDE = "NKDGuide";

export const STYLES = {
  info: { label: "Info", color: "#ffffff", glyph: "?" },
  tip: { label: "Tip", color: "#4ab4ff", glyph: "✦" },
  warn: { label: "Warning", color: "#ffb347", glyph: "!" },
  lock: { label: "Don't touch", color: "#ff6b6b", glyph: null },
};
const RANGE_COLORS = { ok: "#5ad17a", near: "#ffb347", bad: "#ff6b6b" };
const PICK_COLOR = "#4ab4ff";

export const state = { hover: null, tour: null, flash: null, pick: null, toc: false };

let layer, svg, tocEl, offerEl;
let vueFollowUp = 0;
const panels = new Map();

const CSS = `
.nkd-notes-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 900; }
.nkd-notes-layer svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.nkd-notes-layer path { fill: none; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 1px 2px rgba(0,0,0,.65)); }
.nkd-notes-layer svg > rect { fill: none; filter: drop-shadow(0 0 3px rgba(0,0,0,.6)); }
.nkd-notes-layer text { font: 600 12px Inter, system-ui, sans-serif; paint-order: stroke; stroke: rgba(0,0,0,.75); stroke-width: 3px; }
.nkd-notes-layer .body text { stroke: none; text-anchor: middle; dominant-baseline: central; font-weight: 700; }
/* Vue nodes: the card stays to be dragged, the overlay draws what it looks like. */
.nkd-note-vue { opacity: 0 !important; --min-node-width: 0px !important; }
.nkd-note-panel {
  position: absolute; pointer-events: auto; transform-origin: 0 0; box-sizing: border-box;
  background: #111216; color: #e6e9ef; border: 1px solid #2a2d35; border-radius: 8px;
  padding: 9px 11px; font: 12px/1.45 Inter, system-ui, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.55);
  max-height: 70vh; overflow: auto;
}
.nkd-note-panel > div > :first-child { margin-top: 0; }
.nkd-note-panel > div > :last-child { margin-bottom: 0; }
.nkd-note-panel h1, .nkd-note-panel h2, .nkd-note-panel h3, .nkd-note-panel h4 { margin: .7em 0 .35em; line-height: 1.2; color: #fff; }
.nkd-note-panel h1 { font-size: 14px; } .nkd-note-panel h2 { font-size: 13px; }
.nkd-note-panel h3 { font-size: 12px; } .nkd-note-panel h4 { font-size: 12px; color: #c8d0e0; }
.nkd-note-panel p, .nkd-note-panel ul, .nkd-note-panel ol, .nkd-note-panel pre, .nkd-note-panel blockquote { margin: .45em 0; }
.nkd-note-panel ul, .nkd-note-panel ol { padding-left: 1.3em; }
.nkd-note-panel code { background: #252830; border-radius: 3px; padding: 0 4px; font: 11px ui-monospace, monospace; }
.nkd-note-panel pre { background: #1a1c22; border-radius: 5px; padding: 8px 10px; overflow: auto; }
.nkd-note-panel pre code { background: none; padding: 0; }
.nkd-note-panel blockquote { border-left: 3px solid #3a3d46; padding-left: 10px; color: #b4bccb; }
.nkd-note-panel hr { border: none; border-top: 1px solid #2a2d35; margin: .8em 0; }
.nkd-note-panel a { color: #4ab4ff; }
.nkd-note-panel .nkd-note-empty { color: rgba(255,255,255,.4); font-style: italic; }
.nkd-note-set {
  background: #252830; border: 1px solid #3a3d46; border-radius: 4px; color: #4ab4ff;
  font: 11px Inter, system-ui, sans-serif; padding: 0 7px; cursor: pointer; margin: 1px 0;
}
.nkd-note-set:hover { border-color: #4ab4ff; background: rgba(74,180,255,.12); }
.nkd-note-langs { display: flex; gap: 4px; justify-content: flex-end; margin: -2px -4px 4px 0; }
.nkd-note-langs:empty { display: none; }
.nkd-note-langs button {
  background: none; border: 1px solid transparent; border-radius: 4px; color: rgba(255,255,255,.45);
  font: 600 10px Inter, system-ui, sans-serif; text-transform: uppercase; padding: 0 5px; cursor: pointer;
}
.nkd-note-langs button:hover { color: #fff; }
.nkd-note-langs button.on { color: #4ab4ff; border-color: #4ab4ff66; }
.nkd-note-tour { display: none; align-items: center; gap: 8px; margin-top: 9px; padding-top: 8px; border-top: 1px solid #2a2d35; }
.nkd-note-tour.on { display: flex; }
.nkd-note-tour button, .nkd-note-toc button, .nkd-note-offer button {
  background: #252830; border: 1px solid #3a3d46; border-radius: 4px; color: #c8d0e0;
  font: 11px Inter, system-ui, sans-serif; padding: 2px 8px; cursor: pointer;
}
.nkd-note-tour button:hover, .nkd-note-toc button:hover, .nkd-note-offer button:hover { border-color: #4ab4ff; }
.nkd-note-tour button:disabled { opacity: .3; cursor: default; border-color: #3a3d46; }
.nkd-note-tour .count { flex: 1; text-align: center; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; }
.nkd-note-toc {
  position: absolute; top: 12px; right: 12px; width: 280px; max-height: calc(100% - 24px); overflow: auto;
  pointer-events: auto; background: #111216; color: #c8d0e0; border: 1px solid #2a2d35; border-radius: 8px;
  font: 12px system-ui, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.55);
}
.nkd-note-toc header { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #1a1c22; font-weight: 600; position: sticky; top: 0; }
.nkd-note-toc header span { flex: 1; }
.nkd-note-toc h5 { margin: 8px 10px 2px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.4); }
.nkd-note-toc .item { display: flex; gap: 8px; align-items: baseline; padding: 4px 10px; cursor: pointer; }
.nkd-note-toc .item:hover { background: #1a1c22; color: #fff; }
.nkd-note-toc .item i { font-style: normal; min-width: 18px; text-align: center; font-weight: 600; }
.nkd-note-toc .item span { flex: 1; }
.nkd-note-toc .item[draggable="true"] { cursor: grab; }
.nkd-note-toc .item.drop { box-shadow: inset 0 2px 0 #4ab4ff; }
.nkd-note-toc .grip { color: rgba(255,255,255,.3); font-weight: normal; cursor: grab; }
.nkd-note-toc button.tg {
  flex: none; position: relative; width: 26px; height: 14px; padding: 0; border-radius: 7px;
  background: #252830; border: 1px solid #3a3d46; cursor: pointer; align-self: center;
}
.nkd-note-toc button.tg::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 8px; height: 8px; border-radius: 50%;
  background: rgba(255,255,255,.4); transition: left .12s;
}
.nkd-note-toc button.tg.on { background: rgba(74,180,255,.25); border-color: #4ab4ff; }
.nkd-note-toc button.tg.on::after { left: 14px; background: #4ab4ff; }
.nkd-note-toc .none { padding: 6px 10px 10px; color: rgba(255,255,255,.35); }
.nkd-note-offer {
  position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); pointer-events: auto;
  display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #111216; color: #e6e9ef;
  border: 1px solid #4ab4ff; border-radius: 8px; font: 13px system-ui, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.55);
}
.nkd-note-offer button.go { border-color: #4ab4ff; color: #4ab4ff; }
.nkd-note-pickbar {
  position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 100001;
  background: #111216; color: #e6e9ef; border: 1px solid #4ab4ff; border-radius: 8px;
  padding: 8px 14px; font: 13px system-ui, sans-serif; pointer-events: none;
}
`;

// ── node queries ─────────────────────────────────────────────────────────────

export const nodesOf = (graph, type) => (graph?._nodes ?? []).filter((n) => n.type === type);

const byPosition = (a, b) => a.pos[1] - b.pos[1] || a.pos[0] - b.pos[0];

export function tourSteps(graph) {
  return nodesOf(graph, HINT)
    .filter((n) => Number(n.properties.step) > 0)
    .sort((a, b) => a.properties.step - b.properties.step || byPosition(a, b));
}

const num = (v) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// The recommended range belongs to the hint's first widget target: ok / near
// (within 10 % of the span) / bad. Null without a range or a numeric target.
export function rangeWidget(node) {
  for (const t of node.properties.targets ?? []) {
    const w = resolveTarget(node.graph, t)?.widget;
    if (w) return w;
  }
  return null;
}

export function rangeStatus(node) {
  const lo = num(node.properties.min);
  const hi = num(node.properties.max);
  const v = Number(rangeWidget(node)?.value);
  if ((lo == null && hi == null) || !Number.isFinite(v)) return null;
  const out = lo != null && v < lo ? lo - v : hi != null && v > hi ? v - hi : 0;
  if (!out) return "ok";
  const span = lo != null && hi != null ? hi - lo : Math.abs(lo ?? hi) || 1;
  return out <= span * 0.1 ? "near" : "bad";
}

// ── rendering ────────────────────────────────────────────────────────────────

export function requestRender() {
  render();
  app.canvas?.setDirty(true, true);
}

function isOpen(n) {
  if (n.properties.pinned || state.hover === n) return true;
  if (state.tour && state.tour.steps[state.tour.i] === n) return true;
  return state.flash?.node === n && Date.now() < state.flash.until;
}

const strokeW = (s) => Math.min(3.5, Math.max(1.4, 2.2 * s)).toFixed(2);

function outline(r, color, s, dashed) {
  const p = pad(r, 5 * s);
  return `<rect x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" width="${p.w.toFixed(1)}" height="${p.h.toFixed(1)}" rx="${(8 * s).toFixed(1)}" stroke="${color}" stroke-width="${strokeW(s)}"${dashed ? ` stroke-dasharray="${6 * s} ${4 * s}"` : ""}/>`;
}

// The note's own body in client px. Notes have no title bar, and in Vue mode
// their DOM card is invisible, so the graph rect is the truth in both renderers.
const bodyRect = (gc, n) => graphRectToClient(gc, [n.pos[0], n.pos[1], n.size[0], n.size[1]]);

function render() {
  const gc = app.canvas;
  if (!layer || !gc?.graph) return;
  const graph = gc.graph;
  const s = gc.ds.scale;
  const o = layer.getBoundingClientRect();
  const local = (r) => ({ x: r.x - o.left, y: r.y - o.top, w: r.w, h: r.h });
  const out = [];
  const open = new Set();
  if (window.LiteGraph.vueNodesMode) drawVueBodies(gc, graph, local, out);

  for (const n of graph._nodes ?? []) {
    if (n.type === HINT && isOpen(n)) {
      open.add(n);
      drawHint(gc, n, local, out, o);
    } else if (n.type === ARROW) {
      drawArrow(gc, n, local, out);
    }
  }
  if (state.pick) {
    const res = resolveTarget(graph, state.pick);
    if (res) out.push(outline(local(targetRect(gc, res)), PICK_COLOR, s, true));
  }
  svg.innerHTML = out.join("");

  for (const [n, el] of panels) {
    if (!open.has(n)) {
      el.remove();
      panels.delete(n);
    }
  }
  if (state.toc) renderToc(graph);
}

function drawHint(gc, n, local, out, o) {
  const s = gc.ds.scale;
  const p = n.properties;
  const color = (STYLES[p.style] ?? STYLES.info).color;
  const badge = local(bodyRect(gc, n));
  const hits = [];
  for (const t of p.targets ?? []) {
    const res = resolveTarget(n.graph, t);
    if (res) hits.push({ res, rect: local(targetRect(gc, res)) });
  }

  // Panel on the side away from the targets, so arrows don't cross it.
  const el = panelFor(n);
  const lang = viewLang();
  const text = hintText(n, lang);
  const langs = hintLangs(p);
  const sig = text + "" + langs.join() + "" + lang;
  if (el._sig !== sig) {
    el._sig = sig;
    const shown = langs.includes(lang) ? lang : langs[0];
    el.children[0].innerHTML = langs.length > 1
      ? langs.map((l) => `<button data-lang="${escHtml(l)}"${l === shown ? ' class="on"' : ""}>${escHtml(l)}</button>`).join("")
      : "";
    el.children[1].innerHTML = text?.trim()
      ? renderMarkdown(text)
      : `<p class="nkd-note-empty">Empty hint. Double-click the badge to write it.</p>`;
  }
  const width = Number(p.width) || 300;
  el.style.width = width + "px";
  el.style.transform = `scale(${s})`;
  el.style.borderColor = color === "#ffffff" ? "" : color + "66";
  const meanX = hits.length ? hits.reduce((a, h) => a + h.rect.x + h.rect.w / 2, 0) / hits.length : -Infinity;
  let left = meanX > badge.x + badge.w ? badge.x - 12 * s - width * s : badge.x + badge.w + 12 * s;
  if (left + width * s > o.width - 6) left = badge.x - 12 * s - width * s;
  if (left < 6) left = Math.min(badge.x + badge.w + 12 * s, o.width - 6 - width * s);
  el.style.left = left + "px";
  el.style.top = badge.y + "px";
  updateTourBar(n, el);

  const ranged = rangeWidget(n);
  const st = ranged && rangeStatus(n);
  for (const { res, rect } of hits) {
    const c = st && res.widget === ranged ? RANGE_COLORS[st] : color;
    out.push(outline(rect, c, s));
    out.push(`<path d="${arrowBetween(badge, rect, s)}" stroke="${c}" stroke-width="${strokeW(s)}"/>`);
  }
}

function drawArrow(gc, n, local, out) {
  const s = gc.ds.scale;
  const p = n.properties;
  const to = resolveTarget(n.graph, p.to);
  const handle = local(bodyRect(gc, n));
  const h = [handle.x + handle.w / 2, handle.y + handle.h / 2];
  const color = p.color || "#ffffff";
  if (to) {
    const from = resolveTarget(n.graph, p.from);
    const d = arrowThrough(from && local(targetRect(gc, from)), h, local(targetRect(gc, to)), s);
    out.push(`<path d="${d}" stroke="${color}" stroke-width="${strokeW(s)}"/>`);
  }
  if (p.label) {
    const fs = 12 * s;
    const esc = String(p.label).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    out.push(`<text x="${(h[0] + 12 * s).toFixed(1)}" y="${(h[1] - 10 * s).toFixed(1)}" fill="${color}" style="font-size:${fs.toFixed(1)}px">${esc}</text>`);
  }
}

// Vue mode draws no canvas foreground for nodes: paint the note bodies here,
// zones first so they sit under everything else.
function drawVueBodies(gc, graph, local, out) {
  const s = gc.ds.scale;
  const notes = (graph._nodes ?? []).filter((n) => n.type === HINT || n.type === ARROW || n.type === ZONE);
  notes.sort((a, b) => (b.type === ZONE) - (a.type === ZONE));
  for (const n of notes) {
    document.querySelector(`[data-node-id="${n.id}"]`)?.classList.add("nkd-note-vue");
    const r = local(bodyRect(gc, n));
    const p = n.properties;
    if (n.type === ZONE) {
      const color = p.color || "#4ab4ff";
      out.push(`<g class="body"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${10 * s}" fill="${color}12" stroke="${color}cc" stroke-width="${2 * s}" stroke-dasharray="${8 * s} ${5 * s}"/>` +
        (p.label ? `<text x="${r.x + 14 * s}" y="${r.y + 17 * s}" fill="${color}" style="font-size:${14 * s}px;text-anchor:start">${escHtml(p.label)}</text>` : "") + "</g>");
    } else if (n.type === ARROW) {
      out.push(`<g class="body"><circle cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" r="${5 * s}" fill="${p.color || "#ffffff"}" stroke="rgba(0,0,0,.6)" stroke-width="${2 * s}"/></g>`);
    } else {
      const st = STYLES[p.style] ?? STYLES.info;
      const step = Number(p.step) > 0;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const shape = step
        ? `<circle cx="${cx}" cy="${cy}" r="${r.w / 2 - s}"`
        : `<rect x="${r.x + s}" y="${r.y + s}" width="${r.w - 2 * s}" height="${r.h - 2 * s}" rx="${7 * s}"`;
      const mark = step || st.glyph
        ? `<text x="${cx}" y="${cy + s}" fill="${st.color}" style="font-size:${(step && p.step > 9 ? 12 : 15) * s}px">${step ? p.step : st.glyph}</text>`
        : `<g transform="translate(${cx} ${cy}) scale(${s})"><path d="M-3.5 0V-3a3.5 3.5 0 0 1 7 0V0" stroke="${st.color}" stroke-width="1.8" fill="none" style="filter:none"/><rect x="-5.5" y="-1" width="11" height="8" rx="1.5" fill="${st.color}"/></g>`;
      const range = rangeStatus(n);
      const dot = range && range !== "ok" ? `<circle cx="${r.x + r.w - 3 * s}" cy="${r.y + 3 * s}" r="${4 * s}" fill="${RANGE_COLORS[range]}"/>` : "";
      out.push(`<g class="body">${shape} fill="#15171c" stroke="${st.color}" stroke-width="${1.6 * s}"/>${mark}${dot}</g>`);
    }
  }
}

function panelFor(n) {
  let el = panels.get(n);
  if (el) return el;
  el = document.createElement("div");
  el.className = "nkd-note-panel";
  el.innerHTML = `<div class="nkd-note-langs"></div><div></div><div class="nkd-note-tour"><button data-act="prev">‹ Prev</button><span class="count"></span><button data-act="next">Next ›</button><button data-act="end" title="End tour (Esc)">✕</button></div>`;
  el._node = n;
  el.addEventListener("click", (e) => {
    const set = e.target.closest(".nkd-note-set");
    if (set) applyPreset(n, set.dataset.set);
    const lang = e.target.closest("[data-lang]")?.dataset.lang;
    if (lang) setViewLang(lang);
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "prev") stepTour(-1);
    if (act === "next") stepTour(1);
    if (act === "end") endTour();
  });
  // Wheel over a panel still zooms the graph.
  el.addEventListener("wheel", (e) => {
    if (el.scrollHeight > el.clientHeight) return;
    e.preventDefault();
    app.canvas.canvas.dispatchEvent(new WheelEvent("wheel", e));
  }, { passive: false });
  layer.append(el);
  panels.set(n, el);
  return el;
}

function updateTourBar(n, el) {
  const bar = el.lastChild;
  const t = state.tour;
  const on = !!t && t.steps[t.i] === n;
  bar.classList.toggle("on", on);
  if (!on) return;
  bar.querySelector(".count").textContent = `${t.i + 1} / ${t.steps.length}`;
  bar.querySelector('[data-act="prev"]').disabled = t.i === 0;
  bar.querySelector('[data-act="next"]').textContent = t.i === t.steps.length - 1 ? "Finish" : "Next ›";
}

// `[label](set:value)` applies to the hint's first widget target;
// `[label](set:name=value)` to the target widget with that name.
export function applyPreset(n, spec) {
  const eq = spec.indexOf("=");
  const widgets = (n.properties.targets ?? [])
    .map((t) => resolveTarget(n.graph, t))
    .filter((r) => r?.widget);
  let hit = widgets[0];
  let raw = spec;
  if (eq > 0) {
    const named = widgets.find((r) => r.widget.name === spec.slice(0, eq));
    if (named) {
      hit = named;
      raw = spec.slice(eq + 1);
    }
  }
  if (!hit) {
    toast("This hint does not point at a widget to set.");
    return;
  }
  const { node, widget } = hit;
  const old = widget.value;
  let v = raw;
  if (typeof old === "number" && Number.isFinite(Number(raw))) v = Number(raw);
  else if (typeof old === "boolean") v = raw === "true";
  widget.value = v;
  widget.callback?.(v, app.canvas, node);
  node.onWidgetChanged?.(widget.name, v, old, widget);
  node.setDirtyCanvas(true, true);
  markChanged();
  requestRender();
}

// ── languages ────────────────────────────────────────────────────────────────

// A hint's main text is in `lang`; `texts` holds translations by language code.
// The reader's choice is remembered per browser, starting from ComfyUI's locale.
const LANG_KEY = "nkd-notes-lang";

export function viewLang() {
  try {
    const l = localStorage.getItem(LANG_KEY);
    if (l) return l;
  } catch { /* private window */ }
  return String(app.extensionManager?.setting?.get("Comfy.Locale") || navigator.language || "en").slice(0, 2).toLowerCase();
}

function setViewLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* private window */ }
  requestRender();
}

export const hintLangs = (p) => [p.lang || "en", ...Object.keys(p.texts ?? {}).filter((l) => p.texts[l]?.trim())];

export function hintText(n, lang = viewLang()) {
  const p = n.properties;
  return lang !== (p.lang || "en") && p.texts?.[lang]?.trim() ? p.texts[lang] : p.text;
}

export function markChanged() {
  app.graph?.setDirtyCanvas(true, true);
  app.extensionManager?.workflow?.activeWorkflow?.changeTracker?.checkState?.();
}

export function toast(detail, severity = "info") {
  app.extensionManager?.toast?.add?.({ severity, summary: "NKD Notes", detail, life: 4000 });
}

// ── camera ───────────────────────────────────────────────────────────────────

// Graph-space bounds of a hint, its panel and its targets, grown to a minimum
// size so the camera never dives into a single widget.
function hintBounds(gc, n) {
  const rects = [Array.from(n.boundingRect)];
  const w = Number(n.properties.width) || 300;
  rects.push([n.pos[0] - w - 20, n.pos[1], w * 2 + 60, 240]);
  for (const t of n.properties.targets ?? []) {
    const res = resolveTarget(n.graph, t);
    if (res) rects.push(clientRectToGraph(gc, targetRect(gc, res)));
  }
  return unionBounds(rects);
}

function unionBounds(rects, minW = 900, minH = 560) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, w, h] of rects) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w = Math.max(x1 - x0 + 120, minW), h = Math.max(y1 - y0 + 120, minH);
  return [cx - w / 2, cy - h / 2, w, h];
}

export function flyTo(bounds) {
  const gc = app.canvas;
  if (typeof gc.animateToBounds === "function") gc.animateToBounds(bounds);
  else gc.ds.fitToBounds(bounds);
  gc.setDirty(true, true);
}

export function showHint(n, ms = 5000) {
  flyTo(hintBounds(app.canvas, n));
  state.flash = { node: n, until: Date.now() + ms };
  setTimeout(requestRender, ms + 50);
  requestRender();
}

// ── tour ─────────────────────────────────────────────────────────────────────

export function startTour(graph = app.canvas.graph) {
  const steps = tourSteps(graph);
  if (!steps.length) {
    toast("No tour steps yet: give some hints a step number.", "warn");
    return;
  }
  state.tour = { steps, i: 0 };
  stepTour(0);
}

export function stepTour(d) {
  const t = state.tour;
  if (!t) return;
  if (t.i + d >= t.steps.length) return endTour();
  t.i = Math.max(0, t.i + d);
  flyTo(hintBounds(app.canvas, t.steps[t.i]));
  requestRender();
}

export function endTour() {
  state.tour = null;
  requestRender();
}

function onKey(e) {
  if (!state.tour || e.target?.closest?.("input, textarea, [contenteditable]")) return;
  const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
  if (d) stepTour(d);
  else if (e.key === "Escape") endTour();
  else return;
  e.preventDefault();
  e.stopPropagation();
}

// ── contents panel ───────────────────────────────────────────────────────────

const glyph = (n) => {
  const st = STYLES[n.properties.style] ?? STYLES.info;
  return `<i style="color:${st.color}">${st.glyph ?? "■"}</i>`;
};
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hintTitle = (n) => plainTitle(hintText(n)) || "Untitled hint";

export function contents(graph) {
  const steps = tourSteps(graph);
  return {
    steps,
    notes: nodesOf(graph, HINT).filter((n) => !steps.includes(n)).sort(byPosition),
    zones: nodesOf(graph, ZONE).sort(byPosition),
    groups: [...(graph._groups ?? [])].sort((a, b) => a.pos[1] - b.pos[1] || a.pos[0] - b.pos[0]),
  };
}

export function toggleToc(on = !state.toc) {
  state.toc = on;
  if (!on) {
    tocEl?.remove();
    tocEl = null;
  }
  requestRender();
}

function renderToc(graph) {
  const c = contents(graph);
  const items = [];
  const sig = JSON.stringify([
    c.steps.map((n) => [n.id, n.properties.step, hintText(n)]),
    c.notes.map((n) => [n.id, hintText(n), n.properties.style]),
    c.zones.map((n) => [n.id, n.properties.label]),
    c.groups.map((g) => [g.id, g.title]),
  ]);
  placeToc();
  if (tocEl?._sig === sig) return;
  const section = (title, list, row) => {
    if (!list.length) return "";
    const drag = list === c.steps ? ' draggable="true"' : "";
    return `<h5>${title}</h5>` + list.map((x, i) => {
      items.push(x);
      return `<div class="item" data-i="${items.length - 1}"${drag}>${row(x, i)}</div>`;
    }).join("");
  };
  const html =
    section("Tour", c.steps, (n, i) => `<b class="grip" title="Drag to reorder">⠿</b><i>${i + 1}</i><span>${escHtml(hintTitle(n))}</span><button class="tg on" data-act="toggle" title="Remove from the tour"></button>`) +
    section("Notes", c.notes, (n) => `${glyph(n)}<span>${escHtml(hintTitle(n))}</span><button class="tg" data-act="toggle" title="Add to the tour"></button>`) +
    section("Zones", c.zones, (n) => `<i style="color:${n.properties.color}">▢</i><span>${escHtml(n.properties.label || "Zone")}</span>`) +
    section("Groups", c.groups, (g) => `<i>▦</i><span>${escHtml(g.title)}</span>`);

  if (!tocEl) {
    tocEl = document.createElement("div");
    tocEl.className = "nkd-note-toc";
    const itemOf = (el) => tocEl._items[el?.closest(".item")?.dataset.i];
    tocEl.addEventListener("click", (e) => {
      if (e.target.closest('[data-act="close"]')) return toggleToc(false);
      if (e.target.closest('[data-act="tour"]')) return startTour(app.canvas.graph);
      const x = itemOf(e.target);
      if (!x) return;
      if (e.target.closest('[data-act="toggle"]')) setInTour(x, !(Number(x.properties.step) > 0));
      else if (x.type === HINT) showHint(x);
      else flyTo(unionBounds([Array.from(x.boundingRect)], 400, 300));
    });
    // Drag a tour step onto another to put it in that place.
    let dragged = null;
    tocEl.addEventListener("dragstart", (e) => {
      dragged = itemOf(e.target);
      e.dataTransfer.effectAllowed = "move";
    });
    tocEl.addEventListener("dragover", (e) => {
      const el = e.target.closest?.('.item[draggable="true"]');
      if (!dragged || !el) return;
      e.preventDefault();
      tocEl.querySelectorAll(".drop").forEach((d) => d.classList.remove("drop"));
      el.classList.add("drop");
    });
    tocEl.addEventListener("dragend", () => {
      dragged = null;
      tocEl.querySelectorAll(".drop").forEach((d) => d.classList.remove("drop"));
    });
    tocEl.addEventListener("drop", (e) => {
      const target = itemOf(e.target.closest?.('.item[draggable="true"]'));
      e.preventDefault();
      if (dragged && target && dragged !== target) moveStep(dragged, target);
    });
    layer.append(tocEl);
  }
  tocEl._sig = sig;
  placeToc();
  tocEl._items = items;
  tocEl.innerHTML = `<header><span>Contents</span>${c.steps.length ? '<button data-act="tour">▶ Tour</button>' : ""}<button data-act="close" title="Close">✕</button></header>` +
    (html || `<div class="none">Nothing to list yet. Add hints, zones or groups.</div>`);
}

// Below ComfyUI's floating action bar (Run button), which overlaps the canvas.
function placeToc() {
  if (!tocEl) return;
  const bar = document.querySelector(".actionbar")?.getBoundingClientRect();
  const top = Math.max(12, (bar?.bottom ?? 0) - layer.getBoundingClientRect().top + 8);
  tocEl.style.top = top + "px";
  tocEl.style.maxHeight = `calc(100% - ${top + 12}px)`;
}

// Tour order lives in each hint's step number: renumber 1..n after any change.
function renumber(steps) {
  steps.forEach((n, i) => { n.properties.step = i + 1; });
  markChanged();
  requestRender();
}

function setInTour(n, on) {
  const steps = tourSteps(n.graph).filter((s) => s !== n);
  if (on) steps.push(n);
  else n.properties.step = 0;
  renumber(steps);
}

function moveStep(n, before) {
  const steps = tourSteps(n.graph).filter((s) => s !== n);
  steps.splice(steps.indexOf(before) + (n.properties.step < before.properties.step ? 1 : 0), 0, n);
  renumber(steps);
}

// ── tour offer on load ───────────────────────────────────────────────────────

export function offerTour(text, onStart, onDismiss) {
  offerEl?.remove();
  offerEl = document.createElement("div");
  offerEl.className = "nkd-note-offer";
  offerEl.innerHTML = `<span></span><button class="go">▶ Start tour</button><button>Not now</button>`;
  offerEl.firstChild.textContent = text;
  const [go, no] = offerEl.querySelectorAll("button");
  const close = () => { offerEl?.remove(); offerEl = null; };
  go.onclick = () => { close(); onStart(); };
  no.onclick = () => { close(); onDismiss(); };
  layer?.append(offerEl);
}

// ── hover ────────────────────────────────────────────────────────────────────

let leaveTimer = null;

function onPointerMove(e) {
  const gc = app.canvas;
  if (!gc?.graph || state.pick) return;
  const panel = e.target?.closest?.(".nkd-note-panel");
  let hit = panel?._node ?? null;
  if (!hit && layer.parentElement.contains(e.target)) {
    hit = nodesOf(gc.graph, HINT).findLast((n) => contains(pad(bodyRect(gc, n), 4), e.clientX, e.clientY)) ?? null;
  }
  if (hit) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
    if (state.hover !== hit) {
      state.hover = hit;
      requestRender();
    }
  } else if (state.hover && !leaveTimer) {
    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      state.hover = null;
      requestRender();
    }, 250);
  }
}

// ── install ──────────────────────────────────────────────────────────────────

export function installOverlay() {
  const gc = app.canvas;
  const host = gc.canvas.parentElement;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  layer = document.createElement("div");
  layer.className = "nkd-notes-layer";
  svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  layer.append(svg);
  host.append(layer);

  const prev = gc.onDrawForeground;
  gc.onDrawForeground = function () {
    const r = prev?.apply(this, arguments);
    render();
    // Vue moves its DOM nodes a frame after the canvas draws: measure again then,
    // or arrows keep the old position once panning stops.
    if (window.LiteGraph.vueNodesMode && !vueFollowUp) {
      vueFollowUp = requestAnimationFrame(() => {
        vueFollowUp = 0;
        render();
      });
    }
    return r;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("keydown", onKey, true);
  window.__nkdNotes = { state, render, startTour, stepTour, endTour, toggleToc, applyPreset, layer: () => layer };
}

