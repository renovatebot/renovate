import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

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

async function diffAgainstBase(base: string): Promise<string[]> {
  // The real index treats a staged removal recreated on disk as untracked.
  const temp = await mkdtemp(join(tmpdir(), 'renovate-check-'));
  try {
    const env = { GIT_INDEX_FILE: join(temp, 'index') };
    await execa('git', ['read-tree', base], { env });
    return await gitPaths(
      ['diff', '--no-ext-diff', '--name-only', '--no-renames', '-z', '--'],
      env,
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function readCheckout(): Promise<{
  changes: string[];
  files: Set<string>;
}> {
  const { stdout: sparseCheckout } = await execa('git', [
    'config',
    '--type=bool',
    '--default=false',
    '--get',
    'core.sparseCheckout',
  ]);
  if (sparseCheckout === 'true') {
    throw new Error('Automatic test selection requires a non-sparse checkout.');
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

  const basePaths = await gitPaths([
    'ls-tree',
    '-rz',
    '--name-only',
    base.stdout,
  ]);
  const currentPaths = await gitPaths([
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
  ]);
  const missing = await gitPaths(['ls-files', '-z', '--deleted']);
  const edited = await diffAgainstBase(base.stdout);
  const files = new Set(
    currentPaths.filter((file) => !file.endsWith('/')),
  ).difference(new Set(missing));
  const changedNames = new Set(basePaths).symmetricDifference(files);
  const changes = [...changedNames.union(new Set(edited))];
  return { changes, files };
}
