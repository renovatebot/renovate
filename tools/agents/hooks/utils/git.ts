import { type SimpleGit, type SimpleGitOptions, simpleGit } from 'simple-git';

const config: Partial<SimpleGitOptions> = {
  completion: { onClose: true, onExit: false },
  config: ['core.quotePath=false'],
  unsafe: {
    allowUnsafePager: true,
    allowUnsafeEditor: true,
    allowUnsafeAskPass: true, // set by vscode
  },
};

const git: SimpleGit = simpleGit(config).env({
  ...process.env,
  LANG: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
});

export async function getRepoRoot(dir?: string): Promise<string | null> {
  const instance = dir ? simpleGit({ ...config, baseDir: dir }) : git;
  try {
    const out = await instance.revparse(['--show-toplevel']);
    return out.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Returns the merge base with `origin/main`, else the upstream branch, else `HEAD`.
 */
export async function getBaseRef(): Promise<string> {
  try {
    const out = await git.raw(['merge-base', 'origin/main', 'HEAD']);
    if (out.trim()) {
      return out.trim();
    }
  } catch {
    // origin/main not available
  }

  try {
    const out = await git.revparse([
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}',
    ]);
    if (out.trim()) {
      return out.trim();
    }
  } catch {
    // No upstream configured
  }

  return 'HEAD';
}

/**
 * Returns the files added, copied, modified or renamed since `baseRef`, and the untracked files that are not ignored.
 */
export async function getChangedFiles(baseRef: string): Promise<string[]> {
  const diff = await git.diff(['--name-only', '--diff-filter=ACMR', baseRef]);
  const untracked = await git.raw([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--full-name',
  ]);
  const files = `${diff}\n${untracked}`.split('\n').filter((f) => f.length > 0);
  return [...new Set(files)];
}

/**
 * Returns the files deleted since `baseRef`.
 */
export async function getDeletedFiles(baseRef: string): Promise<string[]> {
  const out = await git.diff(['--name-only', '--diff-filter=D', baseRef]);
  return out
    .trim()
    .split('\n')
    .filter((f) => f.length > 0);
}
