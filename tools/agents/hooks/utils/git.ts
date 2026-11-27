import { type SimpleGitOptions, simpleGit } from 'simple-git';

const config: Partial<SimpleGitOptions> = {
  completion: { onClose: true, onExit: false },
  config: ['core.quotePath=false'],
  // simple-git v4 rejects guarded variables (`PAGER`, `GIT_*`, ...) passed via `.env()` unless allowed
  allowEnvironment: Object.keys(process.env),
  unsafe: {
    allowUnsafePager: true,
    allowUnsafeEditor: true,
    allowUnsafeAskPass: true, // set by vscode
  },
};

export async function getRepoRoot(dir: string): Promise<string | null> {
  const git = simpleGit({ ...config, baseDir: dir });
  try {
    const out = await git.revparse(['--show-toplevel']);
    return out.trim() || null;
  } catch {
    return null;
  }
}
