import { execa } from 'execa';
import { formatCompletedLine, isTTY } from './tui.ts';
import type {
  CheckResult,
  ExecutionProgress,
  ParallelCheck,
  ProcessManager,
} from './types.ts';

export async function runCommand(
  cmd: string,
  args: string[],
  processManager: ProcessManager,
  env?: Record<string, string>,
): Promise<{ success: boolean; output: string }> {
  const subprocess = execa(cmd, args, {
    env,
    signal: processManager.abortController.signal,
    all: true,
    reject: false,
  });
  processManager.subprocesses.add(subprocess);

  const result = await subprocess;
  processManager.subprocesses.delete(subprocess);
  return { success: result.exitCode === 0, output: result.all ?? '' };
}

export async function runChecksParallel(
  checks: ParallelCheck[],
  resultOffset: number,
  progress: ExecutionProgress,
  processManager: ProcessManager,
): Promise<void> {
  await Promise.all(
    checks.map(async (check, idx) => {
      progress.startedIndices.add(resultOffset + idx);
      const start = Date.now();
      const { success, output } = await runCommand(
        check.cmd,
        check.args,
        processManager,
      );
      const duration = (Date.now() - start) / 1000;

      const result: CheckResult = {
        name: check.name,
        success,
        duration,
        output,
      };
      progress.results[resultOffset + idx] = { result };

      if (!isTTY) {
        console.log(
          formatCompletedLine(result.name, result.success, result.duration),
        );
      }
    }),
  );
}
