import { coerceString } from '../../../lib/util/string.ts';
import { exec } from './utils/exec.ts';
import { getChangedFiles } from './utils/git.ts';
import { block } from './utils/output.ts';

const maxOutputLength = 10_000;

/**
 * Returns the output, or only its start and its end when it is longer than `maxOutputLength`.
 */
function truncate(output: string): string {
  if (output.length <= maxOutputLength) {
    return output;
  }
  // the start holds the check summary and the lint errors, the end the test summary
  const half = maxOutputLength / 2;
  return `${output.slice(0, half)}\n[…]\n${output.slice(-half)}`;
}

const changedFiles = await getChangedFiles();

if (changedFiles.length > 0) {
  const result = await exec('pnpm', ['check', '--all', ...changedFiles], {
    stdout: 'pipe',
    stderr: 'pipe',
    all: true,
    reject: false,
  });
  const output = coerceString(result.all);
  process.stderr.write(output);
  if (result.failed) {
    block(
      `pnpm check --all failed — the issues must be resolved before finishing\n\n${truncate(output)}`,
    );
  }
}
