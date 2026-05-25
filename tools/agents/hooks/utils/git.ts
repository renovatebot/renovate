import { exec } from './exec.ts';

/**
 * Resolves the base ref to diff against.
 * Tries merge-base with origin/main first, then falls back to the upstream
 * tracking branch, and finally to HEAD.
 */
async function getBaseRef(): Promise<string> {
  try {
    const { stdout } = await exec(
      'git',
      ['merge-base', 'origin/main', 'HEAD'],
      { stdout: 'pipe' },
    );
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch {
    // origin/main not available
  }

  try {
    const { stdout } = await exec(
      'git',
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
      { stdout: 'pipe' },
    );
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch {
    // No upstream configured
  }

  return 'HEAD';
}

/**
 * Returns the list of files changed relative to the branch the current one
 * originated from, falling back to HEAD (uncommitted changes) if a parent cannot be found.
 */
export async function getChangedFiles(): Promise<string[]> {
  const baseRef = await getBaseRef();

  const { stdout: diffOut } = await exec(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', baseRef],
    { stdout: 'pipe' },
  );
  return diffOut
    .trim()
    .split('\n')
    .filter((f) => f.length > 0);
}
