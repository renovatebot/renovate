import type { ExecaChildProcess } from 'execa';

export interface CliArgs {
  fix: boolean;
  noTest: boolean;
  base: string;
  targets: string[];
}

export interface ParallelCheck {
  name: string;
  cmd: string;
  args: string[];
  env?: Record<string, string>;
}

export interface CheckResult {
  name: string;
  success: boolean;
  duration: number;
  output: string;
}

export interface CoverageInfo {
  file: string;
  percentage: number;
  uncoveredLines: string[];
}

export interface CheckResultWithCoverage {
  result: CheckResult;
  coverage?: CoverageInfo[];
}

export interface ProcessManager {
  subprocesses: Set<ExecaChildProcess>;
  abortController: AbortController;
  renderInterval: ReturnType<typeof setInterval> | null;
}

export interface ExecutionProgress {
  startTime: number;
  checks: readonly ParallelCheck[];
  results: (CheckResultWithCoverage | null)[];
  startedIndices: Set<number>;
  spinnerFrame: number;
  displayLines: number;
}
