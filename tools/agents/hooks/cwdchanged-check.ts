import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { getRepoRoot } from './utils/git.ts';
import { provision } from './utils/provision.ts';
import { CwdChangedHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

let parsed: unknown;
try {
  parsed = JSON.parse(await readStdin());
} catch (e) {
  console.error(
    `Failed to parse Hook input as JSON. Error: ${JSON.stringify(e)}`,
  );
  process.exit(1);
}

const result = CwdChangedHookInput.safeParse(parsed);
if (!result.success) {
  console.error(
    `Failed to validate Hook input against schema. Error: ${JSON.stringify(result.error)}`,
  );
  process.exit(1);
}

const root = await getRepoRoot(result.data.cwd);

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Only provision a checkout that isn't installed yet (e.g. a fresh worktree).
// No-op in the already-installed main checkout and on ordinary cd.
if (!root || (await pathExists(join(root, 'node_modules')))) {
  process.exit(0);
}

await provision(root);
