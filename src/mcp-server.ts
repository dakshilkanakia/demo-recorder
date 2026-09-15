import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createSession, getSession, dropSession } from './session-manager.js';
import { snapshotPage } from './snapshot.js';
import { finishRecording } from './recorder.js';
import { config } from './config.js';

const server = new McpServer({
  name: 'demo-recorder',
  version: '0.2.0'
});

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string, extra?: unknown) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify({ error: message, ...(extra ? { extra } : {}) }, null, 2) }
    ],
    isError: true
  };
}

server.registerTool(
  'start_session',
  {
    title: 'Start a recorded browser session',
    description:
      'Launches a browser, starts video recording, and navigates to the given URL. Returns a sessionId to use with every other tool.',
    inputSchema: { url: z.string().url().default(config.siteUrl) }
  },
  async ({ url }) => {
    try {
      const session = await createSession(url);
      const elements = await snapshotPage(session.page);
      return ok({ sessionId: session.id, url, visibleElements: elements });
    } catch (error) {
      return fail(`Failed to start session: ${errMsg(error)}`);
    }
  }
);

server.registerTool(
  'snapshot',
  {
    title: 'Snapshot visible interactive elements',
    description:
      'Returns the visible links/buttons/inputs on the current page (role, name, tag) so you can decide the next action.',
    inputSchema: { sessionId: z.string() }
  },
  async ({ sessionId }) => {
    try {
      const session = getSession(sessionId);
      const elements = await snapshotPage(session.page);
      return ok({ url: session.page.url(), visibleElements: elements });
    } catch (error) {
      return fail(errMsg(error));
    }
  }
);

server.registerTool(
  'click',
  {
    title: 'Click an element by role and accessible name',
    description:
      'Clicks the first visible element matching the given role (button/link/etc) and name (substring, case-insensitive). Returns a fresh snapshot on failure.',
    inputSchema: {
      sessionId: z.string(),
      role: z.string().describe('e.g. "button", "link"'),
      name: z.string().describe('accessible name or visible text, substring match')
    }
  },
  async ({ sessionId, role, name }) => {
    const session = getSession(sessionId);
    session.log.add(`Click role="${role}" name~="${name}"`);
    try {
      const locator = session.page
        .getByRole(role as never, { name: new RegExp(escapeRegExp(name), 'i') })
        .first();
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.click();
      await session.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
      const elements = await snapshotPage(session.page);
      return ok({ clicked: { role, name }, url: session.page.url(), visibleElements: elements });
    } catch (error) {
      session.log.add(`Click failed: ${errMsg(error)}`);
      const elements = await snapshotPage(session.page).catch(() => []);
      return fail(`Could not click role="${role}" name~="${name}": ${errMsg(error)}`, {
        visibleElements: elements
      });
    }
  }
);

server.registerTool(
  'fill',
  {
    title: 'Fill a text field by role and accessible name',
    description: 'Fills the first visible textbox matching the given name with a value.',
    inputSchema: {
      sessionId: z.string(),
      name: z.string().describe('accessible name, placeholder, or label text'),
      value: z.string()
    }
  },
  async ({ sessionId, name, value }) => {
    const session = getSession(sessionId);
    session.log.add(`Fill name~="${name}" with "${value}"`);
    try {
      const locator = session.page
        .getByRole('textbox', { name: new RegExp(escapeRegExp(name), 'i') })
        .first();
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.fill(value);
      await session.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
      const elements = await snapshotPage(session.page);
      return ok({ filled: { name, value }, url: session.page.url(), visibleElements: elements });
    } catch (error) {
      session.log.add(`Fill failed: ${errMsg(error)}`);
      const elements = await snapshotPage(session.page).catch(() => []);
      return fail(`Could not fill field name~="${name}": ${errMsg(error)}`, {
        visibleElements: elements
      });
    }
  }
);

server.registerTool(
  'goto',
  {
    title: 'Navigate to a path or URL',
    description: 'Navigates the session page to a relative path (e.g. "/shop") or absolute URL.',
    inputSchema: { sessionId: z.string(), path: z.string() }
  },
  async ({ sessionId, path }) => {
    const session = getSession(sessionId);
    const target = path.startsWith('http') ? path : new URL(path, config.siteUrl).toString();
    session.log.add(`Goto ${target}`);
    try {
      await session.page.goto(target, { waitUntil: 'domcontentloaded' });
      const elements = await snapshotPage(session.page);
      return ok({ url: session.page.url(), visibleElements: elements });
    } catch (error) {
      return fail(`Failed to navigate to ${target}: ${errMsg(error)}`);
    }
  }
);

server.registerTool(
  'assert_visible',
  {
    title: 'Assert text is visible on the page',
    description: 'Checks whether the given text is currently visible. Use this to verify a step worked.',
    inputSchema: { sessionId: z.string(), text: z.string() }
  },
  async ({ sessionId, text }) => {
    const session = getSession(sessionId);
    try {
      const locator = session.page.getByText(new RegExp(escapeRegExp(text), 'i')).first();
      const visible = await locator.isVisible({ timeout: 8000 }).catch(() => false);
      session.log.add(`Assert visible "${text}": ${visible ? 'pass' : 'fail'}`);
      if (!visible) {
        const elements = await snapshotPage(session.page).catch(() => []);
        return fail(`Text "${text}" is not visible`, { visibleElements: elements });
      }
      return ok({ visible: true, text });
    } catch (error) {
      return fail(errMsg(error));
    }
  }
);

server.registerTool(
  'finish_session',
  {
    title: 'Finish the session and save the recorded video',
    description: 'Closes the browser, saves the .webm video and a run log, and returns their paths.',
    inputSchema: { sessionId: z.string(), runName: z.string() }
  },
  async ({ sessionId, runName }) => {
    const session = getSession(sessionId);
    try {
      const videoPath = await finishRecording(session.context, session.page, runName);
      await session.browser.close().catch(() => undefined);
      const logPath = await session.log.save(runName);
      dropSession(sessionId);
      return ok({ videoPath, logPath });
    } catch (error) {
      return fail(`Failed to finish session: ${errMsg(error)}`);
    }
  }
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function errMsg(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(error => {
  console.error('demo-recorder MCP server failed to start:', error);
  process.exit(1);
});
