import { styleText } from 'node:util';
import { filterTestOutput } from './test-filter.ts';
import type {
  CheckResultWithCoverage,
  CoverageInfo,
  ExecutionProgress,
  ProcessManager,
} from './types.ts';

export const TUI = {
  NAME_WIDTH: 36,
  LINE_WIDTH: 50,
  SPINNER_MS: 80,
} as const;

export const ANSI = {
  moveUp: (n: number): string => `\x1b[${n}A`,
  HIDE_CURSOR: '\x1b[?25l',
  SHOW_CURSOR: '\x1b[?25h',
} as const;

const ICONS = {
  WAITING: '⏳',
  SPINNER: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const,
} as const;

export const isTTY = process.stdout.isTTY ?? false;

export function formatCompletedLine(
  name: string,
  success: boolean,
  duration: number,
): string {
  const nameCol = `${name} `.padEnd(TUI.NAME_WIDTH, '.');
  const status = success ? styleText('green', '✓') : styleText('red', '✗');
  const secs = String(Math.round(duration)).padStart(3);
  // Visible: "  " + name(36) + " " + icon + " " + secs(3) + "s" = 45
  return `  ${nameCol} ${status} ${secs}s` + ' '.repeat(TUI.LINE_WIDTH - 45);
}

export function formatWaitingLine(name: string): string {
  const nameCol = `${name} `.padEnd(TUI.NAME_WIDTH, '.');
  // Visible: "  " + name(36) + " " + icon = 40
  return `  ${nameCol} ${ICONS.WAITING}` + ' '.repeat(TUI.LINE_WIDTH - 40);
}

function formatRunningLine(name: string, spinner: string): string {
  const nameCol = `${name} `.padEnd(TUI.NAME_WIDTH, '.');
  // Visible: "  " + name(36) + " " + spinner = 40
  return `  ${nameCol} ${spinner}` + ' '.repeat(TUI.LINE_WIDTH - 40);
}

function formatInterruptedLine(name: string): string {
  const nameCol = `${name} `.padEnd(TUI.NAME_WIDTH, '.');
  // Visible: "  " + name(36) + " " + "-" = 40
  return `  ${nameCol} -` + ' '.repeat(TUI.LINE_WIDTH - 40);
}

export function formatDuration(seconds: number): string {
  return `${Math.round(seconds)}s`;
}

export function renderProgress(progress: ExecutionProgress): void {
  if (!isTTY) {
    return;
  }

  const spinner = ICONS.SPINNER[progress.spinnerFrame];
  const elapsed = Math.round((Date.now() - progress.startTime) / 1000);

  const lines: string[] = [];
  for (let i = 0; i < progress.checks.length; i++) {
    const entry = progress.results[i];
    if (entry) {
      lines.push(
        formatCompletedLine(
          entry.result.name,
          entry.result.success,
          entry.result.duration,
        ),
      );
    } else if (progress.startedIndices.has(i)) {
      lines.push(formatRunningLine(progress.checks[i].name, spinner));
    } else {
      lines.push(formatWaitingLine(progress.checks[i].name));
    }
  }
  lines.push(' '.repeat(TUI.LINE_WIDTH));
  lines.push(`Total: ${elapsed}s`.padEnd(TUI.LINE_WIDTH));

  const frame =
    ANSI.moveUp(progress.displayLines) + '\r' + lines.join('\n') + '\n';
  process.stdout.write(frame);
}

export function renderFinalState(
  progress: ExecutionProgress,
  interrupted: boolean,
): void {
  if (!isTTY) {
    return;
  }

  const lines: string[] = [];
  for (let i = 0; i < progress.checks.length; i++) {
    const entry = progress.results[i];
    if (entry) {
      lines.push(
        formatCompletedLine(
          entry.result.name,
          entry.result.success,
          entry.result.duration,
        ),
      );
    } else {
      lines.push(formatInterruptedLine(progress.checks[i].name));
    }
  }

  while (lines.length < progress.displayLines) {
    lines.push(' '.repeat(TUI.LINE_WIDTH));
  }

  const frame =
    ANSI.moveUp(progress.displayLines) + '\r' + lines.join('\n') + '\n';
  process.stdout.write(frame);

  if (interrupted) {
    printFailedOutputs(progress.results);
    const totalDuration = (Date.now() - progress.startTime) / 1000;
    console.log('');
    console.log(`Total: ${formatDuration(totalDuration)} (interrupted)`);
  }
}

export function startRenderLoop(
  progress: ExecutionProgress,
  processManager: ProcessManager,
): void {
  if (!isTTY) {
    return;
  }
  processManager.renderInterval = setInterval(() => {
    progress.spinnerFrame = (progress.spinnerFrame + 1) % ICONS.SPINNER.length;
    renderProgress(progress);
  }, TUI.SPINNER_MS);
}

export function stopRenderLoop(processManager: ProcessManager): void {
  if (processManager.renderInterval) {
    clearInterval(processManager.renderInterval);
    processManager.renderInterval = null;
  }
}

export function printFailedOutputs(
  results: (CheckResultWithCoverage | null)[],
): void {
  for (const entry of results) {
    if (!entry || entry.result.success || !entry.result.output.trim()) {
      continue;
    }
    let filteredOutput = entry.result.output;
    if (entry.result.name.startsWith('test')) {
      const filtered = filterTestOutput(entry.result.output);
      if (filtered) {
        filteredOutput = filtered;
      }
    }
    console.log('');
    console.log(`--- ${entry.result.name} output ---`);
    console.log(filteredOutput);
    console.log(`--- end ${entry.result.name} ---`);
  }
}

export function printCoverageReport(coverage: CoverageInfo[]): void {
  if (coverage.length === 0) {
    return;
  }

  console.log('Coverage:');

  const minDots = 3;
  const longestPath = Math.max(...coverage.map((c) => c.file.length));
  const coverageWidth = Math.max(TUI.NAME_WIDTH, longestPath + 1 + minDots);

  for (const info of coverage) {
    const pct = Math.round(info.percentage);
    const hasGaps = info.uncoveredLines.length > 0;
    const status = hasGaps ? '✗' : '✓';
    const nameCol = `${info.file} `.padEnd(coverageWidth, '.');
    console.log(`  ${nameCol} ${status}  ${pct}%`);

    if (hasGaps) {
      const lineRefs = info.uncoveredLines.map((l) => `L${l}`).join(', ');
      console.log(`    ${lineRefs}`);
    }
  }
}
