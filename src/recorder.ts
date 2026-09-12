import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { config } from './config.js';

export async function createRecordedPage() {
  await fs.mkdir(config.videoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: config.headless ? 0 : 250
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: config.videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  return { browser, context, page };
}

export async function finishRecording(
  context: BrowserContext,
  page: Page,
  runName: string
) {
  const video = page.video();
  await context.close();

  if (!video) {
    return null;
  }

  const originalPath = await video.path();
  const finalPath = path.join(config.videoDir, `${runName}.webm`);
  await fs.rename(originalPath, finalPath);
  return finalPath;
}
