import type { RawExecOptions } from './types';

export interface ExecErrorData {
  cmd: string;
  stdout: string;
  stderr: string;
  options: RawExecOptions;
  exitCode?: number;
  signal?: NodeJS.Signals;
}

export class ExecError extends Error {
  cmd: string;
  exitCode?: number;
  stderr: string;
  stdout: string;
  options: any;
  signal?: NodeJS.Signals;

  constructor(message: string, data: ExecErrorData, err?: Error) {
    const { cmd, exitCode, stderr, stdout, options, signal } = data;

    if (err) {
      super(message, { cause: err });
    } else {
      super(message);
    }

    Object.setPrototypeOf(this, ExecError.prototype);
    this.cmd = cmd;
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.stdout = stdout;
    this.options = options;
    this.signal = signal;
  }
}
