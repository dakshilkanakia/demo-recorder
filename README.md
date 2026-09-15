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
| `snapshot` | List visible interactive elements on the current page |
| `click` | Click an element by role + accessible name |
| `fill` | Fill a text field by name |
| `goto` | Navigate to a path or URL |
| `assert_visible` | Verify text is visible (step verification) |
| `finish_session` | Save the video + run log, close the browser |

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
