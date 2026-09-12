import path from 'node:path';
import { config } from './config.js';
import { createRecordedPage, finishRecording } from './recorder.js';
import { readSteps } from './steps.js';
import { RunLog } from './log.js';
import { runBasicAddToCart } from './basic-add-to-cart.js';

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function createRunName(stepsFile: string) {
  const base = path.basename(stepsFile).replace(/\.[^.]+$/, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${base}-${timestamp}`;
}

async function main() {
  const stepsFile = getArgValue('--steps') ?? config.defaultStepsFile;
  const steps = await readSteps(stepsFile);
  const runName = createRunName(stepsFile);
  const log = new RunLog();

  log.add(`Loaded ${steps.length} steps from ${stepsFile}`);
  for (const [index, step] of steps.entries()) {
    log.add(`Step ${index + 1}: ${step}`);
  }

  const { browser, context, page } = await createRecordedPage();

  try {
    await runBasicAddToCart(page, log);
    const videoPath = await finishRecording(context, page, runName);
    await browser.close();
    const logPath = await log.save(runName);

    console.log('Recording complete');
    console.log(`Video: ${videoPath}`);
    console.log(`Log: ${logPath}`);
  } catch (error) {
    log.add(`Run failed: ${error instanceof Error ? error.message : error}`);
    await finishRecording(context, page, `${runName}-failed`).catch(() => null);
    await browser.close().catch(() => undefined);
    const logPath = await log.save(`${runName}-failed`);
    console.error('Recording failed');
    console.error(error);
    console.error(`Log: ${logPath}`);
    process.exitCode = 1;
  }
}

main();
