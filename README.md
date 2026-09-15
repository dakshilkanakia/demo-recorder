# Demo Recorder

MCP server exposing Playwright browser tools for the MERN ecommerce storefront.
A coding agent (Claude Code / Codex) reads the target app's codebase, decides
the UI flow to demonstrate, drives the browser one step at a time through
these tools, and ends up with a recorded `.webm` video — no hand-written step
scripts required.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
```

The default target is:

```text
SITE_URL=http://localhost:8080
```

Run the ecommerce backend on `http://localhost:3000` and the frontend on
`http://localhost:8080` before recording.

## Register With Claude Code

```bash
claude mcp add demo-recorder -- npx tsx /Users/dakshilkanakia/Desktop/demo-recorder/src/mcp-server.ts
```

Then, in a Claude Code session, give it a goal, e.g.:

> Using the demo-recorder MCP tools, explore the mern-ecommerce codebase and
> record a demo of adding a product to cart on http://localhost:8080.

Claude Code will read the app's routes/components, call `start_session`,
loop through `snapshot` → `click`/`fill`/`goto` → `assert_visible` to confirm
each step worked, self-correct on failures using the returned snapshots, and
finish with `finish_session` to save the video.

## Tools

| Tool | Purpose |
|---|---|
| `start_session` | Launch a recorded browser session at a URL |
| `snapshot` | List visible interactive elements on the current page (links, buttons, inputs, checkboxes, radios, sliders) |
| `click` | Click an element by role + accessible name; pass `nth` to pick among duplicates |
| `fill` | Fill a text field by name; pass `nth` to pick among duplicates |
| `focus` | Focus an element without clicking (safe for slider handles) |
| `press_key` | Press a keyboard key (Enter, Tab, ArrowLeft/Right, Escape…), e.g. to submit a form or move a slider after `focus` |
| `goto` | Navigate to a path or URL |
| `assert_visible` | Verify text is visible (step verification); pass `nth` if it appears more than once |
| `finish_session` | Save the video + run log, close the browser |

`snapshot` numbers duplicate role+name matches with `nth` (0-based) so you can
tell `click`/`fill`/`focus`/`assert_visible` exactly which one to use when a
page has more than one matching element (e.g. two "Contact Us" links).

For custom slider widgets (e.g. `rc-slider`) that don't support drag: use
`focus` on the slider handle, then `press_key` with `ArrowRight`/`ArrowLeft`
(repeat with `times`) to move it, then `snapshot` to read back its value.

## Visual Overlay

Every session gets an injected fake cursor, a highlight box, and a click
ripple, so the recording is watchable. `click`, `fill`, and `focus` follow
this sequence: highlight the target first (cursor stays put, 1s pause) so
the viewer sees what's about to happen, then move the cursor there (0.5s
pause), then act (`click`/`fill` also show a ripple afterward). This happens
automatically —
no tool arguments needed — and survives page navigations.

## Manual Local Test

```bash
npm run check   # typecheck
npm run mcp     # run the server directly over stdio for manual inspection
```

Recorded videos land in `output/videos`, run logs in `output/logs`.

## Next Phases

- Standalone CLI mode with its own LLM call, for use without a coding agent.
- Saved login session support for authenticated flows like reviews/orders.
- Multi-session / parallel recording support.
