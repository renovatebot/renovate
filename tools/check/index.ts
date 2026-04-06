/**
 * Fast local CI check script
 *
 * Usage: pnpm check [options] [targets...]
 *
 * Arguments:
 *   targets           Files or directories to scope checks to
 *
 * Options:
 *   --fix             Run fixers only (oxlint-fix, biome-fix, prettier-fix)
 *   --no-test         Skip tests
 *   --base <branch>   Compare against different base branch (default: main)
 */

import { readdirSync } from 'node:fs';
import { extname } from 'node:path';
import { parseArgs } from 'node:util';
import {
  getCoverageForDir,
  getCoverageForFiles,
  loadCoverage,
} from './coverage.ts';
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
  CoverageInfo,
  ExecutionProgress,
  ParallelCheck,
  ProcessManager,
} from './types.ts';

// Module-level state for signal handler
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

process.on('SIGINT', handleSigint);

function pnpmScript(name: string): ParallelCheck {
  return { name, cmd: 'pnpm', args: [name] };
}

const PRETTIER_ENV = { PRETTIER_EXPERIMENTAL_CLI: '1' };

const FIX_CHECKS = ['oxlint-fix', 'biome-fix', 'prettier-fix'].map(pnpmScript);
const FIXABLE_CHECKS = ['oxlint', 'biome', 'prettier'].map(pnpmScript);
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

function buildTargetedChecks(targets: string[], fix: boolean): ParallelCheck[] {
  const suffix = fix ? '-fix' : '';
  return [
    {
      name: `oxlint${suffix}`,
      cmd: 'pnpm',
      args: [
        'exec',
        'oxlint',
        ...(fix ? ['--fix'] : []),
        '-c',
        '.oxlintrc.json',
        ...targets,
      ],
    },
    {
      name: `biome${suffix}`,
      cmd: 'pnpm',
      args: ['exec', 'biome', 'check', ...(fix ? ['--write'] : []), ...targets],
    },
    {
      name: `prettier${suffix}`,
      cmd: 'pnpm',
      args: [
        'exec',
        'prettier',
        fix ? '--write' : '--check',
        '--cache',
        ...targets,
      ],
      env: PRETTIER_ENV,
    },
  ];
}

function toSpecPath(file: string): string {
  if (file.endsWith('.spec.ts')) {
    return file;
  }
  return file.replace(/\.ts$/, '.spec.ts');
}

function countSpecFiles(dir: string): number {
  try {
    return readdirSync(dir, { recursive: true, encoding: 'utf-8' }).filter(
      (f) => f.endsWith('.spec.ts'),
    ).length;
  } catch {
    return 0;
  }
}

function toSourcePath(target: string): string | null {
  if (target.endsWith('.spec.ts')) {
    return target.replace('.spec.ts', '.ts');
  }
  if (target.endsWith('.ts')) {
    return target;
  }
  return null;
}

async function collectCoverage(args: CliArgs): Promise<CoverageInfo[]> {
  const coverageData = loadCoverage('./coverage');
  if (!coverageData) {
    return [];
  }

  if (args.targets.length === 0) {
    const changedFiles = await getChangedFiles(args.base);
    return getCoverageForFiles(coverageData, changedFiles);
  }

  const coverage: CoverageInfo[] = [];
  const sourceFiles: string[] = [];

  for (const t of args.targets) {
    const source = toSourcePath(t);
    if (source) {
      sourceFiles.push(source);
    } else {
      coverage.push(...getCoverageForDir(coverageData, t));
    }
  }

  coverage.push(...getCoverageForFiles(coverageData, sourceFiles));
  return coverage;
}

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      fix: { type: 'boolean', default: false },
      'no-test': { type: 'boolean', default: false },
      base: { type: 'string', default: 'main' },
    },
    allowPositionals: true,
  });

  return {
    fix: values.fix ?? false,
    noTest: values['no-test'] ?? false,
    base: values.base ?? 'main',
    targets: positionals,
  };
}

function buildTestChecks(args: CliArgs): ParallelCheck[] {
  if (args.noTest || args.fix) {
    return [];
  }

  if (args.targets.length === 0) {
    return [{ name: 'test', cmd: 'pnpm', args: ['vitest'] }];
  }

  const patterns = [
    ...new Set(
      args.targets
        .filter((t) => extname(t) === '' || t.endsWith('.ts'))
        .map((t) => (t.endsWith('.ts') ? toSpecPath(t) : t)),
    ),
  ];
  if (patterns.length === 0) {
    return [];
  }
  let fileCount = 0;
  for (const p of patterns) {
    fileCount += extname(p) === '' ? countSpecFiles(p) : 1;
  }
  if (fileCount === 0) {
    return [];
  }
  const name = `test (${fileCount} ${fileCount === 1 ? 'file' : 'files'})`;
  return [{ name, cmd: 'pnpm', args: ['vitest', ...patterns] }];
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const args = parseCliArgs();
  const testChecks = buildTestChecks(args);

  let fixChecks: ParallelCheck[];
  let lintChecks: ParallelCheck[];

  if (args.fix) {
    fixChecks =
      args.targets.length > 0
        ? buildTargetedChecks(args.targets, true)
        : [...FIX_CHECKS];
    lintChecks = [];
  } else if (args.targets.length > 0) {
    fixChecks = [];
    lintChecks = buildTargetedChecks(args.targets, false);
  } else {
    fixChecks = [];
    lintChecks = [...FIXABLE_CHECKS, ...OTHER_CHECKS];
  }

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

  for (let i = 0; i < fixChecks.length; i++) {
    const check = fixChecks[i];
    progress.startedIndices.add(i);

    const checkStart = Date.now();
    const { success, output } = await runCommand(
      check.cmd,
      check.args,
      processManager,
      check.env,
    );
    const duration = (Date.now() - checkStart) / 1000;
    const result: CheckResult = { name: check.name, success, duration, output };
    progress.results[i] = { result };

    if (!isTTY) {
      console.log(formatCompletedLine(check.name, success, duration));
    }
  }

  const parallelChecks = [...lintChecks, ...testChecks];
  await runChecksParallel(
    parallelChecks,
    fixChecks.length,
    progress,
    processManager,
  );

  stopRenderLoop(processManager);
  renderProgress(progress);

  const allResults = progress.results.filter(
    (r): r is CheckResultWithCoverage => r !== null,
  );
  const hasFailure = allResults.some((r) => !r.result.success);

  const coverage = testChecks.length > 0 ? await collectCoverage(args) : [];

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
