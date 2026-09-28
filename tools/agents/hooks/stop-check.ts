import { coerceString } from '../../../lib/util/string.ts';
import { exec } from './utils/exec.ts';
import { getChangedFiles } from './utils/git.ts';
import { block } from './utils/output.ts';
import { StopHookInput } from './utils/schemas.ts';
import { readStdin } from './utils/stdin.ts';

const maxOutputLength = 10_000;

/**
 * Returns the output, or only its start and its end with a truncation hint when it is longer than `maxOutputLength`.
 */
function truncate(output: string): string {
  if (output.length <= maxOutputLength) {
    return output;
  }
  // the start holds the check summary and the lint errors, the end the test summary
  const half = maxOutputLength / 2;
  const omitted = output.length - maxOutputLength;
  return `${output.slice(0, half)}\n[… ${omitted} characters truncated, run \`pnpm check --all <files>\` on the affected files for the full output …]\n${output.slice(-half)}`;
}

const raw = await readStdin();
// oxlint-disable-next-line renovate/prefer-json-pipe -- hook scripts must stay dependency-light and fast to start; `Json` lives in lib/util/schema-utils, which drags in the full lib import graph (logger, yaml, toml)
const input = StopHookInput.safeParse(JSON.parse(raw));

// stop_hook_active is true when Claude is already continuing because this hook blocked a
// previous stop; the failure was reported then, so let it stop this time without re-checking
if (!input.success || !input.data.stop_hook_active) {
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
}
