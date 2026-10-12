import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { coerceString } from '../../../lib/util/string.ts';
import { exec } from './utils/exec.ts';
import { getBaseRef, getChangedFiles, getDeletedFiles } from './utils/git.ts';
import { block } from './utils/output.ts';
import { StopHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

const maxOutputLength = 10_000;

const cacheDir = '.cache/stop-hook';
const coverageDir = `${cacheDir}/coverage`;
const fingerprintFile = `${cacheDir}/fingerprint`;

/**
 * Returns the output, or only its start and its end with a truncation hint when it is longer than `maxOutputLength`.
 */
function truncate(output: string): string {
  if (output.length <= maxOutputLength) {
    return output;
  }
  // the start holds the check summary and the lint errors, the end the test summary
  const half = maxOutputLength / 2;
  const omitted = output.length - maxOutputLength;
  return `${output.slice(0, half)}\n[… ${omitted} characters truncated, run \`pnpm check --all <files>\` on the affected files for the full output …]\n${output.slice(-half)}`;
}

/**
 * Returns a SHA-256 hash of the base ref, the paths and contents of the files and the deleted paths, or `null` when a file cannot be read.
 */
async function getFingerprint(
  baseRef: string,
  files: string[],
  deletedFiles: string[],
): Promise<string | null> {
  const hash = createHash('sha256');
  hash.update(`${baseRef}\0`);
  try {
    for (const file of files) {
      const content = await readFile(file);
      hash.update(`${file}\0${content.length}\0`);
      hash.update(content);
    }
  } catch {
    return null;
  }
  for (const file of deletedFiles) {
    hash.update(`deleted\0${file}\0`);
  }
  return hash.digest('hex');
}

/**
 * Returns the fingerprint stored by the last successful check, or `null` when there is none.
 */
async function readFingerprint(): Promise<string | null> {
  try {
    return await readFile(fingerprintFile, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Returns whether the base ref, the files and the deleted paths are unchanged since the last successful check.
 */
async function isChecked(
  baseRef: string,
  files: string[],
  deletedFiles: string[],
): Promise<boolean> {
  const fingerprint = await getFingerprint(baseRef, files, deletedFiles);
  if (!fingerprint) {
    return false;
  }
  return fingerprint === (await readFingerprint());
}

/**
 * Stores the fingerprint of the base ref, the files and the deleted paths, when the files can be read.
 */
async function storeFingerprint(
  baseRef: string,
  files: string[],
  deletedFiles: string[],
): Promise<void> {
  const fingerprint = await getFingerprint(baseRef, files, deletedFiles);
  if (!fingerprint) {
    return;
  }
  await mkdir(cacheDir, { recursive: true });
  await writeFile(fingerprintFile, fingerprint);
}

/**
 * Runs `pnpm check --all` on the files and blocks the stop when it fails, or stores their fingerprint when it passes.
 */
async function check(
  baseRef: string,
  files: string[],
  deletedFiles: string[],
): Promise<void> {
  const result = await exec(
    'pnpm',
    ['check', '--all', `--coverage-dir=${coverageDir}`, ...files],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      all: true,
      reject: false,
    },
  );
  const output = coerceString(result.all);
  process.stderr.write(output);
  if (result.failed) {
    block(
      `pnpm check --all failed — the issues must be resolved before finishing\n\n${truncate(output)}`,
    );
    return;
  }
  // the fixers of the check may have changed the files, so fingerprint the checked state
  await storeFingerprint(baseRef, files, deletedFiles);
}

const raw = await readStdin();
// oxlint-disable-next-line renovate/prefer-json-pipe -- hook scripts must stay dependency-light and fast to start; `Json` lives in lib/util/schema-utils, which drags in the full lib import graph (logger, yaml, toml)
const input = StopHookInput.safeParse(JSON.parse(raw));

// stop_hook_active is true when Claude is already continuing because this hook blocked a
// previous stop; the failure was reported then, so let it stop this time without re-checking
if (!input.success || !input.data.stop_hook_active) {
  const baseRef = await getBaseRef();
  const changedFiles = await getChangedFiles(baseRef);

  if (changedFiles.length > 0) {
    const deletedFiles = await getDeletedFiles(baseRef);
    const checked = await isChecked(baseRef, changedFiles, deletedFiles);
    if (!checked) {
      await check(baseRef, changedFiles, deletedFiles);
    }
  }
}
