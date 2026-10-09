# 😺NKD Hint

A small badge you drop next to whatever needs explaining. Hover it and its panel opens beside
it, with a curved arrow to every target and an outline around each one. Hints carry the text of
a tutorial inside the workflow itself, right where the reader needs it.

## Editing

- Double-click the badge, or right-click it and choose *Edit hint…*.
- The editor shows the Markdown on the left, a live preview in the middle and the settings on the right.
- Changes apply as you type, so closing the editor any way keeps them.

## Targets

- **Pick target** hides the editor. Click a node title, a widget or a group on the graph, or press Esc to cancel.
- A hint can point at several targets. Each one gets its own arrow and outline.
- A target that no longer exists shows as *Missing target* in the editor and draws nothing.

## Markdown

- Headings, **bold**, _italic_, `code`, lists, quotes, code blocks, rules and `https` links.
- `[Fast](set:8)` becomes a button that sets the hint's first widget target to 8.
- `[HD](set:width=1280)` sets the target widget named `width` instead.

## Settings

- **Style**: Info (?), Tip (✦), Warning (!) or Don't touch (lock), each with its own colour.
- **Tour step**: above 0, the badge becomes a numbered marker and the hint joins the [tour](guide.md).
- **Recommended range**: a min and max for the first widget target. Its outline turns green inside the range, amber just outside it and red far outside, and the badge shows a dot while the value is off.
- **Width**: panel width.
- **Always visible**: keeps the panel open instead of waiting for the hover. Handy for screenshots and videos.

## Copying

Copy a hint together with the node it points at and the copy points at the new node. A hint
lives in one graph: inside a subgraph it points at nodes of that subgraph.

---

[← All 😺NKD Notes nodes](../README.md)
