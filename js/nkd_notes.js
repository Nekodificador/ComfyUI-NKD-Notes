// 😺NKD Notes: hints with arrows, numbered tours, free arrows, zones and a guide
// node. Every node is frontend-only (isVirtualNode): nothing reaches the prompt.

import { app } from "../../scripts/app.js";
import {
  ARROW, GUIDE, HINT, STYLES, ZONE, contents, hintText, installOverlay, nodesOf, offerTour,
  rangeStatus, requestRender, startTour, toggleToc, tourSteps,
} from "./lib/overlay.js";
import { openEditor } from "./lib/editor.js";
import { plainTitle } from "./lib/markdown.js";
import { targetLabel } from "./lib/geometry.js";

const CATEGORY = "😺NKD Notes";

function editMenu(label) {
  return function (canvas, options) {
    options.unshift({ content: label, callback: () => openEditor(this) }, null);
  };
}

function drawLock(ctx, cx, cy, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - 3.5, cy);
  ctx.lineTo(cx - 3.5, cy - 3);
  ctx.arc(cx, cy - 3, 3.5, Math.PI, 0);
  ctx.lineTo(cx + 3.5, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(cx - 5.5, cy - 1, 11, 8, 1.5);
  ctx.fill();
}

function setupNoteNode(node, defaults, size) {
  node.properties = { ...defaults, ...node.properties };
  node.size = size;
  node.isVirtualNode = true;
  node.serialize_widgets = false;
}

// ── Hint ─────────────────────────────────────────────────────────────────────

class HintNode extends window.LiteGraph.LGraphNode {
  constructor(title) {
    super(title);
    setupNoteNode(this, { text: "", targets: [], style: "info", step: 0, pinned: false, width: 300, min: "", max: "" }, [28, 28]);
    this.resizable = false;
  }

  computeSize() {
    return [28, 28];
  }

  onDrawForeground(ctx) {
    const p = this.properties;
    const st = STYLES[p.style] ?? STYLES.info;
    const step = Number(p.step) > 0;
    const [w, h] = this.size;
    ctx.save();
    ctx.beginPath();
    if (step) ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    else ctx.roundRect(1, 1, w - 2, h - 2, 7);
    ctx.fillStyle = "#15171c";
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = st.color;
    ctx.stroke();
    ctx.fillStyle = st.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${step && p.step > 9 ? 12 : 15}px system-ui, sans-serif`;
    if (step) ctx.fillText(String(p.step), w / 2, h / 2 + 1);
    else if (st.glyph) ctx.fillText(st.glyph, w / 2, h / 2 + 1);
    else drawLock(ctx, w / 2, h / 2, st.color);
    const range = rangeStatus(this);
    if (range && range !== "ok") {
      ctx.beginPath();
      ctx.arc(w - 3, 3, 4, 0, Math.PI * 2);
      ctx.fillStyle = range === "bad" ? "#ff6b6b" : "#ffb347";
      ctx.fill();
    }
    ctx.restore();
  }

  onDblClick() {
    openEditor(this);
  }
}
HintNode.prototype.getExtraMenuOptions = editMenu("Edit hint…");

// ── Arrow ────────────────────────────────────────────────────────────────────

class ArrowNode extends window.LiteGraph.LGraphNode {
  constructor(title) {
    super(title);
    setupNoteNode(this, { from: null, to: null, label: "", color: "#ffffff" }, [16, 16]);
    this.resizable = false;
  }

  computeSize() {
    return [16, 16];
  }

  onDrawForeground(ctx) {
    const color = this.properties.color || "#ffffff";
    ctx.save();
    ctx.beginPath();
    ctx.arc(8, 8, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,.6)";
    ctx.stroke();
    ctx.restore();
  }

  onDblClick() {
    openEditor(this);
  }
}
ArrowNode.prototype.getExtraMenuOptions = editMenu("Edit arrow…");

// ── Zone ─────────────────────────────────────────────────────────────────────

const ZONE_GRAB = 12;
const ZONE_LABEL_H = 30;

class ZoneNode extends window.LiteGraph.LGraphNode {
  constructor(title) {
    super(title);
    setupNoteNode(this, { label: "Zone", color: "#4ab4ff" }, [420, 280]);
    this.resizable = true;
  }

  // Only the label strip and the border grab the zone, so nodes and empty
  // canvas inside it stay clickable.
  isPointInside(x, y) {
    const [px, py] = this.pos;
    const [w, h] = this.size;
    const lx = x - px, ly = y - py;
    if (lx < -2 || ly < -2 || lx > w + 2 || ly > h + 2) return false;
    return ly < ZONE_LABEL_H || lx < ZONE_GRAB || ly > h - ZONE_GRAB || lx > w - ZONE_GRAB;
  }

  onAdded() {
    queueMicrotask(() => app.canvas?.sendToBack?.(this));
  }

  onSelected() {
    queueMicrotask(() => app.canvas?.sendToBack?.(this));
  }

  onDrawForeground(ctx) {
    const { label, color = "#4ab4ff" } = this.properties;
    const [w, h] = this.size;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 10);
    ctx.fillStyle = color + "12";
    ctx.fill();
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color + "cc";
    ctx.stroke();
    ctx.setLineDash([]);
    if (label) {
      ctx.fillStyle = color;
      ctx.font = "600 14px Inter, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 14, ZONE_LABEL_H / 2 + 2);
    }
    ctx.restore();
  }

  onDblClick() {
    openEditor(this);
  }
}
ZoneNode.prototype.getExtraMenuOptions = editMenu("Edit zone…");

// ── Guide ────────────────────────────────────────────────────────────────────

// A hint's own leading heading becomes its section title; the rest of its
// headings move under it, and preset links turn into plain `label: value`.
function exportSection(n, prefix) {
  let text = hintText(n)?.trim() || "_Empty hint_";
  const head = /^#{1,4}\s+(.*)(\n|$)/.exec(text);
  if (head) text = text.slice(head[0].length).trim();
  text = text
    .replace(/^(#{1,4})(\s)/gm, "##$1$2")
    .replace(/\[([^\]]+)\]\(set:([^)\s]+)\)/g, "`$1: $2`");
  const where = (n.properties.targets ?? []).map((t) => targetLabel(n.graph, t)).filter((l) => l !== "missing");
  const title = [prefix, head && plainTitle(head[1], 80)].filter(Boolean).join(": ");
  return [title && `### ${title}`, text, where.length && `> Points to: ${where.join(", ")}`].filter(Boolean).join("\n\n");
}

function exportMarkdown(graph, title) {
  const c = contents(graph);
  const out = [`# ${title}`];
  if (c.steps.length) out.push("## Tour", ...c.steps.map((n, i) => exportSection(n, `Step ${i + 1}`)));
  if (c.notes.length) out.push("## Notes", ...c.notes.map((n) => exportSection(n)));
  if (c.zones.length || c.groups.length) {
    out.push("## Layout", [...c.zones.map((z) => `- Zone: ${z.properties.label || "Zone"}`), ...c.groups.map((g) => `- Group: ${g.title}`)].join("\n"));
  }
  const name = (app.extensionManager?.workflow?.activeWorkflow?.filename || title).replace(/[^\w\- ]+/g, "").trim() || "workflow";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out.join("\n\n") + "\n"], { type: "text/markdown" }));
  a.download = `${name} - notes.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

class GuideNode extends window.LiteGraph.LGraphNode {
  constructor(title) {
    super(title);
    this.properties = { autoStart: true, ...this.properties };
    this.isVirtualNode = true;
    this.serialize_widgets = false;
    this.addWidget("button", "▶  Start tour", null, () => startTour(this.graph));
    this.addWidget("button", "☰  Contents", null, () => toggleToc());
    this.addWidget("button", "⇩  Export Markdown", null, () => exportMarkdown(this.graph, this.title));
    this.toggle = this.addWidget("toggle", "Offer tour on open", this.properties.autoStart, (v) => {
      this.properties.autoStart = v;
    });
    this.size = [240, this.computeSize()[1]];
  }

  onConfigure() {
    this.toggle.value = !!this.properties.autoStart;
  }
}

// ── tour offer on load ───────────────────────────────────────────────────────

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function offerOnLoad() {
  const graph = app.graph;
  const guide = nodesOf(graph, GUIDE).find((n) => n.properties.autoStart);
  const steps = tourSteps(graph);
  if (!guide || !steps.length) return;
  const key = "nkd-notes-tour-seen:" + hash(guide.title + steps.map((n) => n.properties.text).join("\u0001"));
  try {
    if (localStorage.getItem(key)) return;
  } catch {
    return;
  }
  const seen = () => {
    try { localStorage.setItem(key, "1"); } catch { /* private window */ }
  };
  offerTour(`${guide.title}: a ${steps.length}-step tour comes with this workflow.`, () => { seen(); startTour(graph); }, seen);
}

// ── paste ────────────────────────────────────────────────────────────────────

// A note pasted together with the node it points at follows the copy.
function remapPastedTargets() {
  const proto = window.LiteGraph.LGraphCanvas.prototype;
  const orig = proto._deserializeItems;
  if (!orig || proto.__nkdNotesPaste) return;
  proto.__nkdNotesPaste = true;
  proto._deserializeItems = function () {
    const res = orig.apply(this, arguments);
    if (!res?.nodes) return res;
    const ids = new Map([...res.nodes].map(([old, n]) => [String(old), n.id]));
    const fix = (t) => (t?.node != null && ids.has(String(t.node)) ? { ...t, node: ids.get(String(t.node)) } : t);
    for (const n of res.created ?? []) {
      if (n.type === HINT) n.properties.targets = (n.properties.targets ?? []).map(fix);
      else if (n.type === ARROW) {
        n.properties.from = fix(n.properties.from);
        n.properties.to = fix(n.properties.to);
      }
    }
    return res;
  };
}

// ── registration ─────────────────────────────────────────────────────────────

const DESCRIPTIONS = {
  [HINT]: "A badge that opens a Markdown note on hover and points arrows at nodes, widgets or groups.",
  [GUIDE]: "Plays the numbered hints as a guided tour, lists every note and exports them as Markdown.",
  [ARROW]: "A free curved arrow between two things on the graph. Drag its dot to bend it.",
  [ZONE]: "A dashed, labelled frame that highlights an area of the graph.",
};

app.registerExtension({
  name: "NKD.Notes",
  registerCustomNodes() {
    const { LiteGraph } = window;
    const reg = (type, cls, title, mode) => {
      LiteGraph.registerNodeType(type, Object.assign(cls, { title, title_mode: mode, collapsable: false }));
      cls.category = CATEGORY;
    };
    reg(HINT, HintNode, "😺NKD Hint", LiteGraph.NO_TITLE);
    reg(ARROW, ArrowNode, "😺NKD Arrow", LiteGraph.NO_TITLE);
    reg(ZONE, ZoneNode, "😺NKD Zone", LiteGraph.NO_TITLE);
    reg(GUIDE, GuideNode, "😺NKD Guide", LiteGraph.NORMAL_TITLE);
    // Frontend-only defs get a "frontend_only" source badge; notes are not a source.
    for (const cls of [HintNode, ArrowNode, ZoneNode, GuideNode]) cls.prototype.drawBadges = () => {};
    // The canvas paints only what onDrawForeground draws, whatever colour the
    // node was given (palettes and colour extensions set bgcolor on add).
    for (const cls of [HintNode, ArrowNode, ZoneNode]) {
      Object.defineProperty(cls.prototype, "renderingColor", { get: () => "transparent" });
      Object.defineProperty(cls.prototype, "renderingBgColor", { get: () => "transparent" });
    }
  },
  // Frontend-only defs are listed under their type id ("NKDHint") as "frontend_only";
  // list them like any other node of the pack.
  beforeRegisterVueAppNodeDefs(defs) {
    const { registered_node_types: types } = window.LiteGraph;
    for (const def of defs) {
      if (!DESCRIPTIONS[def.name]) continue;
      def.display_name = types[def.name].title;
      def.description = DESCRIPTIONS[def.name];
      def.python_module = "custom_nodes.ComfyUI-NKD-Notes";
    }
  },
  setup() {
    installOverlay();
    remapPastedTargets();
    // Vue nodes never call onDblClick: open the editor from the (invisible) card.
    document.addEventListener("dblclick", (e) => {
      if (!window.LiteGraph.vueNodesMode) return;
      const id = e.target.closest?.("[data-node-id]")?.dataset.nodeId;
      const node = id && app.canvas.graph?.getNodeById(id);
      if (![HINT, ARROW, ZONE].includes(node?.type)) return;
      e.stopPropagation();
      openEditor(node);
    }, true);
    console.log("[NKD Notes] rev 1");
  },
  afterConfigureGraph() {
    requestRender();
    setTimeout(offerOnLoad, 300);
  },
});

