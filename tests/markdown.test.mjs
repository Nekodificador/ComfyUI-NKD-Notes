// node tests/markdown.test.mjs
import assert from "node:assert/strict";
import { renderMarkdown, plainTitle } from "../js/lib/markdown.js";

const md = (s) => renderMarkdown(s);

assert.equal(md("# Title"), "<h1>Title</h1>");
assert.equal(md("**b** _i_ *e* `c`"), "<p><strong>b</strong> <em>i</em> <em>e</em> <code>c</code></p>");
assert.equal(md("- a\n- b\n\n1. one"), "<ul><li>a</li><li>b</li></ul><ol><li>one</li></ol>");
assert.equal(md("> quote"), "<blockquote><p>quote</p></blockquote>");
assert.equal(md("```\n<b>x</b>\n```"), "<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>");
assert.equal(md("---"), "<hr>");

// No HTML gets through, not even inside links.
assert.equal(md("<img src=x onerror=alert(1)>"), "<p>&lt;img src=x onerror=alert(1)&gt;</p>");
assert.equal(md("[x](javascript:alert)"), "<p>x</p>");
assert.equal(md('[x](https://a.com/"onmouseover=1)'), '<p><a href="https://a.com/&quot;onmouseover=1" target="_blank" rel="noopener noreferrer">x</a></p>');

// Bare URLs link up, and emphasis never touches a URL.
const A = (u, l = u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${l}</a>`;
assert.equal(md("LoRA: https://civitai.com/models/123?v=4&x=1."), `<p>LoRA: ${A("https://civitai.com/models/123?v=4&amp;x=1")}.</p>`);
assert.equal(md("(see https://hf.co/a/_b_/c_d*e*)"), `<p>(see ${A("https://hf.co/a/_b_/c_d*e*")})</p>`);
assert.equal(md("[**my_lora_v2**](https://hf.co/x/my_lora_v2)"), `<p>${A("https://hf.co/x/my_lora_v2", "<strong>my_lora_v2</strong>")}</p>`);
assert.equal(md('https://a.com/"onmouseover=1'), `<p>${A("https://a.com/")}&quot;onmouseover=1</p>`);
assert.equal(md("`https://x.com`"), "<p><code>https://x.com</code></p>");

// Preset chips.
assert.equal(md("[Fast](set:8) [Wide](set:width=1024)"),
  '<p><button class="nkd-note-set" data-set="8">Fast</button> <button class="nkd-note-set" data-set="width=1024">Wide</button></p>');

assert.equal(plainTitle("## **Steps** and [more](https://x)\nbody"), "Steps and more");
assert.equal(plainTitle("\n\n- first item"), "first item");
assert.equal(plainTitle("x".repeat(60), 10), "xxxxxxxxx…");

console.log("markdown ok");
