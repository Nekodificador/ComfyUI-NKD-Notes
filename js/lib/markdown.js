// The Markdown subset note panels need: headings, emphasis, code, lists, quotes,
// rules and links. Everything is escaped first, so a shared workflow cannot
// inject HTML. `[label](set:value)` becomes a preset chip the panel wires up.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

function inline(s) {
  const codes = [];
  s = esc(s).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    if (href.startsWith("set:")) return `<button class="nkd-note-set" data-set="${href.slice(4)}">${label}</button>`;
    if (/^https?:\/\//i.test(href)) return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    return label;
  });
  s = s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>")
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flush = () => { flushPara(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (/^```/.test(line)) {
      flush();
      const code = [];
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
    } else if (!line.trim()) {
      flush();
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flush();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push("<hr>");
    } else if (/^>/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^>/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      i--;
      out.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
    } else if ((m = /^\s*(?:([-*+])|\d+[.)])\s+(.*)$/.exec(line))) {
      flushPara();
      const tag = m[1] ? "ul" : "ol";
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push(m[2]);
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += " " + line.trim();
    } else {
      flushList();
      para.push(line);
    }
  }
  flush();
  return out.join("");
}

// One-line title for lists and exports: the first heading or line, markup stripped.
export function plainTitle(src, max = 48) {
  const line = String(src ?? "").split("\n").map((l) => l.trim()).find((l) => l && !/^```/.test(l)) ?? "";
  const t = line
    .replace(/^(#+|>|[-*+]|\d+[.)])\s*/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
