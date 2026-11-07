import type { RawExecOptions } from './types.ts';

export interface ExecErrorData {
  cmd: string;
  stderr: string;
  stdout: string;
  options: RawExecOptions;
  exitCode?: number;
  signal?: NodeJS.Signals;
  timedOut?: boolean;
}

export class ExecError extends Error {
  cmd: string;
  stderr: string;
  stdout: string;
  options: RawExecOptions;
  exitCode?: number;
  signal?: NodeJS.Signals;
  timedOut?: boolean;
  err?: Error;

  constructor(message: string, data: ExecErrorData, err?: Error) {
    const { cmd, exitCode, stderr, stdout, options, signal, timedOut } = data;

    super(message);

    this.name = this.constructor.name;
    this.cmd = cmd;
    this.stderr = stderr;
    this.stdout = stdout;
    this.options = options;

    if (exitCode) {
      this.exitCode = exitCode;
    }

    if (signal) {
      this.signal = signal;
    }

    if (timedOut) {
      this.timedOut = true;
    }

    if (err) {
      this.err = err;
    }
  }
}
