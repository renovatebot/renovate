import { exec } from './utils/exec.ts';
import { getChangedFiles } from './utils/git.ts';
import { block } from './utils/output.ts';

const changedFiles = await getChangedFiles();

if (changedFiles.length > 0) {
  try {
    await exec('pnpm', ['check', '--all', ...changedFiles]);
  } catch {
    block(
      'pnpm check --all failed — the issues must be resolved before finishing',
    );
  }
}
