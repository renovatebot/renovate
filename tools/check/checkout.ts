import { lstat, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

export async function regularFiles(files: string[]): Promise<string[]> {
  const stats = await Promise.all(files.map((file) => lstat(file)));
  return files.filter((_, index) => stats[index].isFile());
}

async function gitPaths(
  args: string[],
  env?: NodeJS.ProcessEnv,
): Promise<string[]> {
  const { stdout } = await execa('git', args, {
    env,
    stripFinalNewline: false,
  });
  return stdout.split('\0').slice(0, -1);
}

async function diffAgainstBase(env: NodeJS.ProcessEnv): Promise<{
  edited: Set<string>;
  typeChanges: Set<string>;
}> {
  const entries = await gitPaths(
    ['diff', '--no-ext-diff', '--name-status', '--no-renames', '-z', '--'],
    env,
  );
  const edited = new Set<string>();
  const typeChanges = new Set<string>();
  for (let i = 0; i < entries.length; i += 2) {
    const [status, file] = [entries[i], entries[i + 1]];
    edited.add(file);
    if (status === 'T') {
      typeChanges.add(file);
    }
  }

  return { edited, typeChanges };
}

export interface Checkout {
  changes: string[];
  files: Set<string>;
  changedNames: Set<string>;
  typeChanges: Set<string>;
  tracked: Set<string>;
}

export async function withCheckout<T>(
  run: (readCheckout: () => Promise<Checkout>) => Promise<T>,
): Promise<T> {
  const { stdout: sparseCheckout } = await execa('git', [
    'config',
    '--type=bool',
    '--default=false',
    '--get',
    'core.sparseCheckout',
  ]);
  if (sparseCheckout === 'true') {
    throw new Error('pnpm check requires a non-sparse checkout.');
  }

  const base = await execa(
    'git',
    ['merge-base', 'HEAD', 'refs/remotes/origin/HEAD'],
    { reject: false },
  );
  if (base.failed) {
    const reason = base.stderr || base.shortMessage;
    throw new Error(
      `Cannot find a common commit with origin/HEAD. Check the local default-branch ref and fetch more history if the clone is shallow.\n${reason}`,
    );
  }

  const basePaths = new Set(
    await gitPaths(['ls-tree', '-rz', '--name-only', base.stdout]),
  );
  // Git omits paths with staged deletions from the worktree diff, even if they still exist on disk.
  const temp = await mkdtemp(join(tmpdir(), 'renovate-check-'));
  try {
    const env = { GIT_INDEX_FILE: join(temp, 'index') };
    await execa('git', ['read-tree', base.stdout], { env });
    return await run(() => readCheckout(basePaths, env));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

async function readCheckout(
  basePaths: Set<string>,
  env: NodeJS.ProcessEnv,
): Promise<Checkout> {
  const cached = new Set(await gitPaths(['ls-files', '-z', '--cached']));
  const untracked = await gitPaths([
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
  ]);
  const missing = await gitPaths(['ls-files', '-z', '--deleted']);
  const { edited, typeChanges } = await diffAgainstBase(env);
  const files = cached
    .union(new Set(untracked.filter((file) => !file.endsWith('/'))))
    .difference(new Set(missing));
  const changedNames = basePaths.symmetricDifference(files);
  const changes = [...changedNames.union(edited)];
  return {
    changes,
    files,
    changedNames,
    typeChanges,
    tracked: cached,
  };
}
