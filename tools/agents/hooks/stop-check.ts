import { exec } from './utils/exec.ts';
import { getChangedFiles } from './utils/git.ts';
import { block } from './utils/output.ts';

const changedFiles = await getChangedFiles();

try {
  if (changedFiles.length > 0) {
    await exec('pnpm', ['check', '--all', ...changedFiles]);
  } else {
    await exec('pnpm', ['check', '--all']);
  }
} catch {
  block(
    'pnpm check --all failed — the issues must be resolved before finishing',
  );
}
