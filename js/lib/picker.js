// Click-to-pick a note target: a node title/body, one of its widgets, or a group.

import { app } from "../../../scripts/app.js";
import { clientToGraph, widgetLabel } from "./geometry.js";
import { requestRender, state } from "./overlay.js";

function hitTest(x, y, exclude) {
  const gc = app.canvas;
  const graph = gc.graph;
  if (window.LiteGraph.vueNodesMode) {
    const el = document.elementFromPoint(x, y);
    const nodeEl = el?.closest("[data-node-id]");
    const node = nodeEl && graph.getNodeById(nodeEl.dataset.nodeId);
    if (node && node !== exclude) {
      const row = el.closest('[data-testid="node-widget"]');
      const label = row?.innerText.split("\n")[0].trim();
      const widget = label && node.widgets?.find((w) => widgetLabel(w) === label);
      return { node: node.id, widget: widget?.name ?? null };
    }
  }
  const [gx, gy] = clientToGraph(gc, x, y);
  const node = graph.getNodeOnPos(gx, gy);
  if (node && node !== exclude) {
    const widget = node.getWidgetOnPos?.(gx, gy, true);
    return { node: node.id, widget: widget?.name ?? null };
  }
  const group = graph.getGroupOnPos(gx, gy);
  return group ? { group: group.id } : null;
}

export function pickTarget(exclude) {
  return new Promise((resolve) => {
    const bar = document.createElement("div");
    bar.className = "nkd-note-pickbar";
    bar.textContent = "Click a node, a widget or a group · Esc to cancel";
    document.body.append(bar);
    const prevCursor = app.canvas.canvas.style.cursor;
    app.canvas.canvas.style.cursor = "crosshair";

    const move = (e) => {
      state.pick = hitTest(e.clientX, e.clientY, exclude);
      requestRender();
    };
    const down = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      done(hitTest(e.clientX, e.clientY, exclude));
    };
    const key = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      done(null);
    };
    function done(t) {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      bar.remove();
      app.canvas.canvas.style.cursor = prevCursor;
      state.pick = null;
      requestRender();
      resolve(t);
    }
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
  });
}
