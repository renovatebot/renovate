import { execa } from 'execa';

async function getGitFiles(args: string[]): Promise<string[]> {
  try {
    const result = await execa('git', args);
    return result.stdout
      .trim()
      .split('\n')
      .filter((f) => f);
  } catch {
    return [];
  }
}

async function getMergeBase(base: string): Promise<string> {
  try {
    const result = await execa('git', ['merge-base', base, 'HEAD']);
    return result.stdout.trim();
  } catch {
    return base;
  }
}

export async function getChangedFiles(base: string): Promise<string[]> {
  const files = new Set<string>();

  // Find where we branched from (merge-base), not current base HEAD
  const mergeBase = await getMergeBase(base);

  // Committed changes since branching from base
  for (const f of await getGitFiles(['diff', '--name-only', mergeBase])) {
    files.add(f);
  }

  // Uncommitted changes (staged + unstaged)
  for (const f of await getGitFiles(['diff', '--name-only', 'HEAD'])) {
    files.add(f);
  }

  // Untracked files (new files not yet added to git)
  for (const f of await getGitFiles([
    'ls-files',
    '--others',
    '--exclude-standard',
  ])) {
    files.add(f);
  }

  return Array.from(files);
}
