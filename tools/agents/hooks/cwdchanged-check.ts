import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getRepoRoot } from './utils/git.ts';
import { provision } from './utils/provision.ts';
import { CwdChangedHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

let parsed: unknown;
try {
  parsed = JSON.parse(await readStdin());
} catch {
  process.exit(0);
}

const result = CwdChangedHookInput.safeParse(parsed);
if (!result.success) {
  process.exit(0);
}

const root = await getRepoRoot(result.data.cwd);

// Only provision a checkout that isn't installed yet (e.g. a fresh worktree).
// No-op in the already-installed main checkout and on ordinary cd.
if (!root || existsSync(join(root, 'node_modules'))) {
  process.exit(0);
}

await provision(root);
