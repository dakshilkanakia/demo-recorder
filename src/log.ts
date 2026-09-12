import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export class RunLog {
  private lines: string[] = [];

  add(message: string) {
    const timestamp = new Date().toISOString();
    this.lines.push(`[${timestamp}] ${message}`);
  }

  async save(runName: string) {
    await fs.mkdir(config.logDir, { recursive: true });
    const filePath = path.join(config.logDir, `${runName}.log`);
    await fs.writeFile(filePath, `${this.lines.join('\n')}\n`, 'utf8');
    return filePath;
  }
}
