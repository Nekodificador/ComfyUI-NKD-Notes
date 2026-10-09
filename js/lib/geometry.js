// Screen geometry for note targets and arrows. All rects are client (viewport)
// pixels {x, y, w, h}, so classic canvas nodes and Vue DOM nodes mix freely.

const LG = () => window.LiteGraph;
const vueMode = () => !!LG()?.vueNodesMode;

export function graphToClient(gc, x, y) {
  const r = gc.canvas.getBoundingClientRect();
  const { offset, scale } = gc.ds;
  return [r.left + (x + offset[0]) * scale, r.top + (y + offset[1]) * scale];
}

export function clientToGraph(gc, x, y) {
  const r = gc.canvas.getBoundingClientRect();
  const { offset, scale } = gc.ds;
  return [(x - r.left) / scale - offset[0], (y - r.top) / scale - offset[1]];
}

export function graphRectToClient(gc, [x, y, w, h]) {
  const [cx, cy] = graphToClient(gc, x, y);
  return { x: cx, y: cy, w: w * gc.ds.scale, h: h * gc.ds.scale };
}

export function clientRectToGraph(gc, r) {
  const [x, y] = clientToGraph(gc, r.x, r.y);
  return [x, y, r.w / gc.ds.scale, r.h / gc.ds.scale];
}

const domRect = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const nodeEl = (node) => document.querySelector(`[data-node-id="${node.id}"]`);

export function nodeRect(gc, node) {
  if (vueMode()) {
    const el = nodeEl(node);
    if (el) return domRect(el);
  }
  return graphRectToClient(gc, Array.from(node.boundingRect));
}

export const widgetLabel = (w) => w.label || w.name;

export function widgetRect(gc, node, widget) {
  if (vueMode()) {
    // Vue rows carry no widget name: match the row's label text.
    const rows = nodeEl(node)?.querySelectorAll('[data-testid="node-widget"]') ?? [];
    for (const row of rows) {
      if (row.innerText.split("\n")[0].trim() === widgetLabel(widget)) return domRect(row);
    }
    return null;
  }
  if (node.flags?.collapsed || widget.hidden || widget.last_y === undefined) return null;
  const margin = widget.margin ?? 15;
  const h = widget.computedHeight ?? LG().NODE_WIDGET_HEIGHT;
  const w = (widget.width || node.size[0]) - margin * 2;
  return graphRectToClient(gc, [node.pos[0] + margin, node.pos[1] + widget.last_y, w, h]);
}

// target: {node, widget?} or {group}. Resolved against the graph the note lives in.
export function resolveTarget(graph, t) {
  if (!graph || !t) return null;
  if (t.group != null) {
    const group = graph._groups?.find((g) => g.id === t.group);
    return group ? { group } : null;
  }
  const node = graph.getNodeById(t.node);
  if (!node) return null;
  const widget = t.widget ? node.widgets?.find((w) => w.name === t.widget) : null;
  return { node, widget };
}

export function targetRect(gc, res) {
  if (res.group) return graphRectToClient(gc, Array.from(res.group.boundingRect));
  if (res.widget) return widgetRect(gc, res.node, res.widget) ?? nodeRect(gc, res.node);
  return nodeRect(gc, res.node);
}

export function targetLabel(graph, t) {
  const res = resolveTarget(graph, t);
  if (!res) return "missing";
  if (res.group) return `Group · ${res.group.title}`;
  return res.widget ? `${res.node.title} › ${widgetLabel(res.widget)}` : res.node.title;
}

export const pad = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 });
const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
export const contains = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Where a curve leaves its source rect: below/above when the target is past it
// vertically, otherwise the side facing the target.
export function exitPoint(r, p) {
  const [cx, cy] = center(r);
  if (p[1] > r.y + r.h) return { pt: [cx, r.y + r.h], n: [0, 1] };
  if (p[1] < r.y) return { pt: [cx, r.y], n: [0, -1] };
  return p[0] > cx ? { pt: [r.x + r.w, cy], n: [1, 0] } : { pt: [r.x, cy], n: [-1, 0] };
}

// Where a curve lands on its target: the side facing the source when the
// source is beside it, otherwise top/bottom. `gap` keeps the tip off the edge.
export function entryPoint(r, p, gap) {
  const [cx, cy] = center(r);
  if (p[0] > r.x + r.w) return { pt: [r.x + r.w + gap, cy], n: [1, 0] };
  if (p[0] < r.x) return { pt: [r.x - gap, cy], n: [-1, 0] };
  return p[1] < cy ? { pt: [cx, r.y - gap], n: [0, -1] } : { pt: [cx, r.y + r.h + gap], n: [0, 1] };
}

const f = (v) => v.toFixed(1);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Open V arrowhead at `tip`, wings swept back along `back` (unit vector).
function head(tip, back, len) {
  const a = 0.85; // ~49°
  const wing = (s) => {
    const x = back[0] * Math.cos(a) - back[1] * Math.sin(s * a);
    const y = back[0] * Math.sin(s * a) + back[1] * Math.cos(a);
    return `M${f(tip[0] + x * len)} ${f(tip[1] + y * len)}L${f(tip[0])} ${f(tip[1])}`;
  };
  return wing(1) + wing(-1);
}

// Curved arrow from rect `from` to rect `to`. Returns SVG path data.
export function arrowBetween(from, to, scale) {
  const end = entryPoint(to, center(from), 6 * scale);
  const start = exitPoint(from, end.pt);
  const k = Math.min(dist(start.pt, end.pt) * 0.5, 220 * scale);
  const c1 = [start.pt[0] + start.n[0] * k, start.pt[1] + start.n[1] * k];
  const c2 = [end.pt[0] + end.n[0] * k, end.pt[1] + end.n[1] * k];
  return `M${f(start.pt[0])} ${f(start.pt[1])}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(end.pt[0])} ${f(end.pt[1])}` +
    head(end.pt, end.n, 8 * scale);
}

// Arrow that bends through handle `h`: from rect `from` (optional) to rect `to`.
export function arrowThrough(from, h, to, scale) {
  const end = entryPoint(to, h, 6 * scale);
  const k2 = dist(h, end.pt) * 0.45;
  const c2 = [end.pt[0] + end.n[0] * k2, end.pt[1] + end.n[1] * k2];
  let d;
  if (from) {
    const start = exitPoint(from, h);
    const span = dist(start.pt, end.pt) || 1;
    const t = [(end.pt[0] - start.pt[0]) / span, (end.pt[1] - start.pt[1]) / span];
    const k1 = dist(start.pt, h) * 0.45;
    d = `M${f(start.pt[0])} ${f(start.pt[1])}` +
      `C${f(start.pt[0] + start.n[0] * k1)} ${f(start.pt[1] + start.n[1] * k1)} ${f(h[0] - t[0] * k1)} ${f(h[1] - t[1] * k1)} ${f(h[0])} ${f(h[1])}` +
      `C${f(h[0] + t[0] * k2)} ${f(h[1] + t[1] * k2)} ${f(c2[0])} ${f(c2[1])} ${f(end.pt[0])} ${f(end.pt[1])}`;
  } else {
    const span = dist(h, end.pt) || 1;
    const t = [(end.pt[0] - h[0]) / span, (end.pt[1] - h[1]) / span];
    d = `M${f(h[0])} ${f(h[1])}C${f(h[0] + t[0] * k2)} ${f(h[1] + t[1] * k2)} ${f(c2[0])} ${f(c2[1])} ${f(end.pt[0])} ${f(end.pt[1])}`;
  }
  return d + head(end.pt, end.n, 8 * scale);
}
