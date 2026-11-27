import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { MonorepoData } from './utils/monorepo-urls.ts';
import { findRemovedUrls } from './utils/monorepo-urls.ts';

const execFileAsync = promisify(execFile);
const file = 'lib/data/monorepo.json';
const baseRef = process.argv[2];

if (!baseRef) {
  console.error('Usage: check-monorepo-urls.ts <base-ref>');
  process.exit(2);
}

const { stdout } = await execFileAsync('git', ['show', `${baseRef}:${file}`]);
const base = JSON.parse(stdout) as MonorepoData;
const head = JSON.parse(await readFile(file, 'utf8')) as MonorepoData;

const removed = findRemovedUrls(base, head);
if (removed.length) {
  console.error(
    `❌ Source URLs were removed from ${file}. Keep the old URL and extend the value to an array, as older releases may still use it:`,
  );
  for (const entry of removed) {
    console.error(`  - ${entry}`);
  }
  process.exit(1);
}
console.log('✅ No monorepo source URLs were removed.');
