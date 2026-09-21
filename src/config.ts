import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  rootDir,
  siteUrl: process.env.SITE_URL ?? 'http://localhost:8080',
  headless: process.env.HEADLESS === 'true',
  outputDir: path.join(rootDir, 'output'),
  videoDir: path.join(rootDir, 'output', 'videos'),
  logDir: path.join(rootDir, 'output', 'logs')
};
