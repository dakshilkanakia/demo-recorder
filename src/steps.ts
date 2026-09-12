import fs from 'node:fs/promises';
import path from 'node:path';

export async function readSteps(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const contents = await fs.readFile(absolutePath, 'utf8');

  return contents
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^\d+[\.)]\s*/, ''))
    .filter(Boolean);
}
