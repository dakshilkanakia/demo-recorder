import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { config } from './config.js';
import { RunLog } from './log.js';
import { installOverlay } from './overlay.js';

export interface Session {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  log: RunLog;
}

const sessions = new Map<string, Session>();

export async function createSession(url: string): Promise<Session> {
  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.headless ? 0 : 150
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: config.videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  const log = new RunLog();
  const id = randomUUID();

  log.add(`Session ${id} started`);
  log.add(`Opening ${url}`);

  try {
    // Registers the overlay to auto-run on this navigation and every future
    // one on this page (Playwright's addInitScript persists across goto).
    await installOverlay(page);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }

  const session: Session = { id, browser, context, page, log };
  sessions.set(id, session);
  return session;
}

export function getSession(sessionId: string): Session {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(
      `No active session with id "${sessionId}". Call start_session first.`
    );
  }
  return session;
}

export function dropSession(sessionId: string) {
  sessions.delete(sessionId);
}
