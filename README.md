# 😺NKD Notes

Annotations for ComfyUI workflows. Explain a node or a single widget with a Markdown hint that
draws an arrow to it, turn a set of hints into a guided tour, and hand someone a workflow that
teaches itself.

Every node here is frontend-only: nothing reaches the prompt and nothing changes how the
workflow runs. Works with the classic canvas and with Nodes 2.0.

<img width="1229" height="1060" alt="17-11-2026_13-03-18" src="https://github.com/user-attachments/assets/d01b35dd-d198-4f1c-8ec6-2cec58c3af2b" />

<img width="1220" height="736" alt="17-11-2026_13-06-17" src="https://github.com/user-attachments/assets/db1ceb08-6511-4849-9e3d-4ace7e6e3416" />



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
