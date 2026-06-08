import { type SimpleGit, type SimpleGitOptions, simpleGit } from 'simple-git';

const config: Partial<SimpleGitOptions> = {
  completion: { onClose: true, onExit: false },
  config: ['core.quotePath=false'],
  unsafe: {
    allowUnsafePager: true,
    allowUnsafeEditor: true,
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

async function getBaseRef(): Promise<string> {
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

export async function getChangedFiles(): Promise<string[]> {
  const baseRef = await getBaseRef();
  const out = await git.diff(['--name-only', '--diff-filter=ACMR', baseRef]);
  return out
    .trim()
    .split('\n')
    .filter((f) => f.length > 0);
}
