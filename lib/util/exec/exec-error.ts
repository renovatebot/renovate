import type { RawExecOptions } from './types';

export interface ExecErrorData {
  cmd: string;
  stderr: string;
  stdout: string;
  options: RawExecOptions;
  exitCode?: number;
  signal?: NodeJS.Signals;
}

export class ExecError extends Error {
  cmd: string;
  stderr: string;
  stdout: string;
  options: RawExecOptions;
  exitCode?: number;
  signal?: NodeJS.Signals;

  constructor(message: string, data: ExecErrorData, err?: Error) {
    const { cmd, exitCode, stderr, stdout, options, signal } = data;

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
    if (err) {
      super(message, { cause: err });
    } else {
      super(message);
    }

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
  }
}
