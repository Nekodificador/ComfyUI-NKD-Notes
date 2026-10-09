// Editors for hints, arrows and zones. Changes are written to the node as you
// type, so closing the modal any way keeps them.

import { openNkdModal, nkdButton, nkdSelect, nkdToggle } from "./nkd_modal.js";
import { renderMarkdown } from "./markdown.js";
import { targetLabel } from "./geometry.js";
import { pickTarget } from "./picker.js";
import { ARROW, HINT, STYLES, ZONE, markChanged, requestRender } from "./overlay.js";

const CSS = `
.nkd-ed { display: grid; grid-template-columns: 1fr 1fr 270px; width: 100%; min-height: 0; }
.nkd-ed.side-only { grid-template-columns: 1fr; }
.nkd-ed textarea {
  resize: none; background: #0b0d12; color: #e6e9ef; border: none; border-right: 1px solid #2a2d35;
  padding: 14px; font: 13px/1.5 ui-monospace, monospace; outline: none;
}
.nkd-ed .nkd-note-panel.nkd-ed-preview {
  position: static; transform: none; box-shadow: none; border: none; border-right: 1px solid #2a2d35;
  border-radius: 0; max-height: none; overflow: auto; padding: 14px 18px;
}
.nkd-ed-side { padding: 12px 14px; overflow: auto; display: flex; flex-direction: column; gap: 16px; background: #111318; font: 12px system-ui, sans-serif; }
.nkd-ed-side h6 { margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: rgba(255,255,255,.45); }
.nkd-ed-target { display: flex; align-items: center; gap: 6px; padding: 4px 6px; background: #1a1c22; border-radius: 4px; margin-bottom: 4px; }
.nkd-ed-target span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nkd-ed-target.missing span { color: #ff6b6b; }
.nkd-ed-target button { background: none; border: none; color: rgba(255,255,255,.45); cursor: pointer; padding: 0 2px; }
.nkd-ed-target button:hover { color: #ff6b6b; }
.nkd-ed-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.nkd-ed input[type=number], .nkd-ed input[type=text] {
  background: #252830; border: 1px solid #3a3d46; border-radius: 4px; color: #c8d0e0;
  padding: 3px 6px; width: 72px; font: 12px system-ui, sans-serif;
}
.nkd-ed input[type=text] { width: 100%; box-sizing: border-box; }
.nkd-ed input[type=color] { width: 36px; height: 24px; padding: 0; border: 1px solid #3a3d46; border-radius: 4px; background: #252830; cursor: pointer; }
.nkd-ed-help { color: rgba(255,255,255,.38); font-size: 11px; line-height: 1.45; }
.nkd-ed-help code { background: #252830; border-radius: 3px; padding: 0 3px; }
`;

function ensureStyles() {
  if (document.getElementById("nkd-notes-editor")) return;
  const el = document.createElement("style");
  el.id = "nkd-notes-editor";
  el.textContent = CSS;
  document.head.append(el);
}

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};

function section(title, ...children) {
  const s = h("div");
  s.append(h("h6", null, title), ...children);
  return s;
}

function input(type, value, onInput, attrs = {}) {
  const el = h("input");
  el.type = type;
  el.value = value ?? "";
  Object.assign(el, attrs);
  el.addEventListener("input", () => onInput(el.value));
  return el;
}

function changed(node) {
  node.setDirtyCanvas(true, true);
  requestRender();
}

function open(node, title, hint, wide) {
  ensureStyles();
  return openNkdModal({
    title,
    hint,
    width: wide ? "min(1200px, 92vw)" : "420px",
    height: wide ? "min(720px, 88vh)" : "auto",
    onClose: () => {
      markChanged();
      requestRender();
    },
  });
}

// Hide the modal while the user clicks the target on the graph.
async function pick(modal, node) {
  modal.overlay.style.display = "none";
  try {
    return await pickTarget(node);
  } finally {
    modal.overlay.style.display = "";
  }
}

// ── hint ─────────────────────────────────────────────────────────────────────

function hintEditor(node) {
  const p = node.properties;
  const modal = open(node, "😺 NKD Hint", "Markdown · [label](set:value) adds a button that sets the target widget", true);
  const root = h("div", "nkd-ed");

  const text = h("textarea");
  text.value = p.text ?? "";
  text.placeholder = "## What this does\n\nExplain the node or widget here. **Bold**, _italic_, `code`, lists…\n\nPresets: [SDXL](set:1024) [Flux](set:1360)";
  const preview = h("div", "nkd-note-panel nkd-ed-preview");
  preview.append(h("div"));
  const refreshPreview = () => {
    preview.firstChild.innerHTML = renderMarkdown(text.value) || `<p class="nkd-note-empty">Preview</p>`;
  };
  text.addEventListener("input", () => {
    p.text = text.value;
    refreshPreview();
    changed(node);
  });
  refreshPreview();

  const side = h("div", "nkd-ed-side");
  const list = h("div");
  const renderTargets = () => {
    list.replaceChildren();
    if (!p.targets.length) list.append(h("div", "nkd-ed-help", "No target yet. The hint still shows its text."));
    p.targets.forEach((t, i) => {
      const label = targetLabel(node.graph, t);
      const row = h("div", "nkd-ed-target" + (label === "missing" ? " missing" : ""));
      const x = h("button", null, "✕");
      x.title = "Remove target";
      x.onclick = () => {
        p.targets.splice(i, 1);
        renderTargets();
        changed(node);
      };
      row.append(h("span", null, label === "missing" ? "Missing target" : label), x);
      list.append(row);
    });
  };
  p.targets ??= [];
  renderTargets();
  const add = nkdButton("+ Pick target", async () => {
    const t = await pick(modal, node);
    if (t && !p.targets.some((o) => JSON.stringify(o) === JSON.stringify(t))) {
      p.targets.push(t);
      renderTargets();
      changed(node);
    }
  }, "Click a node title, a widget or a group on the graph");

  const style = nkdSelect(
    Object.entries(STYLES).map(([value, s]) => ({ value, label: s.label })),
    p.style ?? "info",
    (v) => { p.style = v; changed(node); },
  );
  const step = input("number", p.step || 0, (v) => { p.step = Math.max(0, Math.round(Number(v) || 0)); changed(node); }, { min: 0, step: 1 });
  const min = input("number", p.min, (v) => { p.min = v; changed(node); }, { placeholder: "min" });
  const max = input("number", p.max, (v) => { p.max = v; changed(node); }, { placeholder: "max" });
  const width = input("number", p.width || 300, (v) => { p.width = Math.max(160, Number(v) || 300); changed(node); }, { min: 160, step: 10 });
  const pinned = nkdToggle("Always visible", !!p.pinned, (on) => { p.pinned = on; changed(node); }, "Keep the panel open instead of showing it on hover");

  const row = (...els) => {
    const r = h("div", "nkd-ed-row");
    r.append(...els);
    return r;
  };
  side.append(
    section("Points at", list, add),
    section("Style", style),
    section("Tour step", row(step), h("div", "nkd-ed-help", "0 = not in the tour. Numbered hints show their number and play in order from the Guide node.")),
    section("Recommended range", row(min, h("span", null, "to"), max), h("div", "nkd-ed-help", "For the first widget target: its outline turns green inside the range, amber just outside it, red far outside.")),
    section("Panel", row(h("span", null, "Width"), width), pinned),
  );
  root.append(text, preview, side);
  modal.body.append(root);
  modal.addPrimary("Done");
  text.focus();
}

// ── arrow ────────────────────────────────────────────────────────────────────

function arrowEditor(node) {
  const p = node.properties;
  const modal = open(node, "😺 NKD Arrow", "Drag the dot on the graph to bend the arrow");
  const root = h("div", "nkd-ed side-only");
  const side = h("div", "nkd-ed-side");

  const slot = (key, title, help) => {
    const label = h("span");
    const row = h("div", "nkd-ed-target");
    const x = h("button", null, "✕");
    x.title = "Clear";
    const refresh = () => {
      const l = p[key] ? targetLabel(node.graph, p[key]) : null;
      label.textContent = l == null ? help : l === "missing" ? "Missing target" : l;
      row.classList.toggle("missing", l === "missing");
      x.style.visibility = p[key] ? "" : "hidden";
    };
    x.onclick = () => { p[key] = null; refresh(); changed(node); };
    row.append(label, x);
    refresh();
    const btn = nkdButton("Pick", async () => {
      const t = await pick(modal, node);
      if (t) { p[key] = t; refresh(); changed(node); }
    });
    return section(title, row, btn);
  };

  side.append(
    slot("from", "From", "The dot itself"),
    slot("to", "To", "Nothing yet"),
    section("Label", input("text", p.label, (v) => { p.label = v; changed(node); }, { placeholder: "Optional" })),
    section("Color", input("color", p.color || "#ffffff", (v) => { p.color = v; changed(node); })),
  );
  root.append(side);
  modal.body.append(root);
  modal.addPrimary("Done");
}

// ── zone ─────────────────────────────────────────────────────────────────────

function zoneEditor(node) {
  const p = node.properties;
  const modal = open(node, "😺 NKD Zone", "Resize from the corner on the graph");
  const root = h("div", "nkd-ed side-only");
  const side = h("div", "nkd-ed-side");
  const label = input("text", p.label, (v) => { p.label = v; changed(node); }, { placeholder: "Zone" });
  side.append(
    section("Label", label),
    section("Color", input("color", p.color || "#4ab4ff", (v) => { p.color = v; changed(node); })),
  );
  root.append(side);
  modal.body.append(root);
  modal.addPrimary("Done");
  label.focus();
}

export function openEditor(node) {
  if (node.type === HINT) hintEditor(node);
  else if (node.type === ARROW) arrowEditor(node);
  else if (node.type === ZONE) zoneEditor(node);
}
