/**
 * Fast local CI check script
 *
 * Usage: pnpm check [options]
 *
 * Options:
 *   --no-fix          Skip auto-fix (eslint-fix, prettier-fix)
 *   --no-test         Skip tests
 *   --full            Run full vitest instead of only affected shards
 *   --base <branch>   Compare against different base branch (default: main)
 */

import { parseArgs } from 'node:util';
import {
  TOTAL_SHARDS,
  getMatchingShards,
  getTestPatternsForShards,
} from '../test-shards.ts';
import { parseCoverageJson } from './coverage.ts';
import { runChecksParallel, runCommand } from './execution.ts';
import { getChangedFiles } from './git.ts';
import {
  ANSI,
  formatCompletedLine,
  formatDuration,
  formatWaitingLine,
  isTTY,
  printCoverageReport,
  printFailedOutputs,
  renderFinalState,
  renderProgress,
  startRenderLoop,
  stopRenderLoop,
} from './tui.ts';
import type {
  CheckResult,
  CheckResultWithCoverage,
  CliArgs,
  ExecutionProgress,
  ParallelCheck,
  ProcessManager,
} from './types.ts';

// Module-level state for signal handler (set by main, checked by handler)
let currentProgress: ExecutionProgress | null = null;
let currentProcessManager: ProcessManager | null = null;

function handleSigint(): void {
  if (currentProcessManager) {
    currentProcessManager.abortController.abort();

    for (const proc of currentProcessManager.subprocesses) {
      proc.kill('SIGTERM');
    }
    currentProcessManager.subprocesses.clear();

    stopRenderLoop(currentProcessManager);
  }

  if (currentProgress) {
    renderFinalState(currentProgress, true);
  }

  if (isTTY) {
    process.stdout.write(ANSI.SHOW_CURSOR);
  }
  process.exit(130);
}

// Register signal handler at module load (like original)
process.on('SIGINT', handleSigint);

function pnpmScript(name: string): ParallelCheck {
  return { name, cmd: 'pnpm', args: [name] };
}

const FIX_CHECKS = [
  'oxlint-fix',
  'biome-fix',
  'eslint-fix',
  'prettier-fix',
].map(pnpmScript);
const FIXABLE_CHECKS = ['oxlint', 'biome', 'eslint', 'prettier'].map(
  pnpmScript,
);
const OTHER_CHECKS = [
  'ls-lint',
  'git-check',
  'markdown-lint',
  'doc-fence-check',
  'lint-documentation',
  'lint-other',
  'test-schema',
  'type-check',
].map(pnpmScript);

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      'no-fix': { type: 'boolean', default: false },
      'no-test': { type: 'boolean', default: false },
      full: { type: 'boolean', default: false },
      base: { type: 'string', default: 'main' },
    },
  });

  return {
    noFix: values['no-fix'] ?? false,
    noTest: values['no-test'] ?? false,
    full: values.full ?? false,
    base: values.base ?? 'main',
  };
}

function buildTestChecks(
  args: CliArgs,
  changedFiles: string[],
): ParallelCheck[] {
  if (args.noTest) {
    return [];
  }

  if (args.full) {
    return [{ name: 'test (all)', cmd: 'pnpm', args: ['vitest'] }];
  }

  const shardsToRun = getMatchingShards(changedFiles);
  if (shardsToRun.length === 0) {
    return [];
  }

  const patterns = getTestPatternsForShards(shardsToRun);
  const n = shardsToRun.length;

  if (n === TOTAL_SHARDS) {
    return [{ name: 'test (all)', cmd: 'pnpm', args: ['vitest'] }];
  }

  const name = `test (${n} ${n === 1 ? 'shard' : 'shards'})`;
  return [{ name, cmd: 'pnpm', args: ['vitest', ...patterns] }];
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const args = parseCliArgs();
  const changedFiles = await getChangedFiles(args.base);

  const testChecks = buildTestChecks(args, changedFiles);

  // Fix checks run sequentially first (eslint-fix, prettier-fix)
  // When skipped, we run the non-fix variants (eslint, prettier) in parallel
  const fixChecks: ParallelCheck[] = args.noFix ? [] : [...FIX_CHECKS];
  const lintChecks: ParallelCheck[] = [
    ...(args.noFix ? FIXABLE_CHECKS : []),
    ...OTHER_CHECKS,
  ];

  const allChecks = [...fixChecks, ...lintChecks, ...testChecks];

  const processManager: ProcessManager = {
    subprocesses: new Set(),
    abortController: new AbortController(),
    renderInterval: null,
  };

  const progress: ExecutionProgress = {
    startTime,
    checks: allChecks,
    results: allChecks.map(() => null),
    startedIndices: new Set(),
    spinnerFrame: 0,
    displayLines: allChecks.length + 2,
  };

  // Set module-level state for signal handler
  currentProgress = progress;
  currentProcessManager = processManager;

  console.log('Checks:');

  if (isTTY) {
    process.stdout.write(ANSI.HIDE_CURSOR);
    for (const check of allChecks) {
      console.log(formatWaitingLine(check.name));
    }
    console.log('');
    console.log('Total: 0s');
  }

  startRenderLoop(progress, processManager);

  // Fix checks run sequentially
  for (let i = 0; i < fixChecks.length; i++) {
    const check = fixChecks[i];
    progress.startedIndices.add(i);

    const checkStart = Date.now();
    const { success, output } = await runCommand(
      check.cmd,
      check.args,
      processManager,
    );
    const duration = (Date.now() - checkStart) / 1000;
    const result: CheckResult = { name: check.name, success, duration, output };
    progress.results[i] = { result };

    if (!isTTY) {
      console.log(formatCompletedLine(check.name, success, duration));
    }
  }

  // Run all lint checks in parallel
  await runChecksParallel(
    lintChecks,
    fixChecks.length,
    progress,
    processManager,
  );

  // Run tests (single vitest process)
  if (testChecks.length > 0) {
    await runChecksParallel(
      testChecks,
      fixChecks.length + lintChecks.length,
      progress,
      processManager,
    );
  }

  stopRenderLoop(processManager);
  renderProgress(progress);

  const allResults = progress.results.filter(
    (r): r is CheckResultWithCoverage => r !== null,
  );
  const hasFailure = allResults.some((r) => !r.result.success);

  // Parse coverage for changed files with gaps
  const coverage =
    testChecks.length > 0 ? parseCoverageJson('./coverage', changedFiles) : [];

  printCoverageReport(coverage);
  printFailedOutputs(progress.results);

  if (isTTY) {
    process.stdout.write(ANSI.SHOW_CURSOR);
  } else {
    const totalDuration = (Date.now() - startTime) / 1000;
    console.log('');
    console.log(`Total: ${formatDuration(totalDuration)}`);
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main().catch((err) => {
  if (isTTY) {
    process.stdout.write(ANSI.SHOW_CURSOR);
  }
  console.error(err);
  process.exit(1);
});
