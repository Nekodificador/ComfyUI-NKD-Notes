# 😺NKD Notes

Annotations for ComfyUI workflows. Explain a node or a single widget with a Markdown hint that
draws an arrow to it, turn a set of hints into a guided tour, and hand someone a workflow that
teaches itself.

Every node here is frontend-only: nothing reaches the prompt and nothing changes how the
workflow runs. Works with the classic canvas and with Nodes 2.0.

## Installation

1. Clone this folder into `ComfyUI/custom_nodes/`.
2. Restart ComfyUI.
3. Add the nodes from **😺NKD Notes** in the node library.

## Notes

Hints, tours and markings that sit on the graph and point at what they explain.

<!-- hero video goes here -->

| Node | What it does |
|---|---|
| [😺NKD Hint](docs/hint.md) | A badge that opens a Markdown panel on hover and draws arrows to nodes, widgets or groups |
| [😺NKD Guide](docs/guide.md) | Plays the numbered hints as a guided tour, lists everything and exports it as Markdown |
| [😺NKD Arrow](docs/arrow.md) | A free curved arrow between two things on the graph, bent by dragging its dot |
| [😺NKD Zone](docs/zone.md) | A dashed, labelled frame that highlights an area without capturing nodes |

## License

GPL-3.0. See [LICENSE](LICENSE).
