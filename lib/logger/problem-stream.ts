import type { LogRecord } from './types.ts';

export const excludeProps = ['pid', 'time', 'v', 'hostname'];

export class ProblemStream {
  private _problems: LogRecord[] = [];

  write(data: string): void {
    const problem: LogRecord = JSON.parse(data);
    for (const prop of excludeProps) {
      delete problem[prop];
    }
    this._problems.push(problem);
  }

  getProblems(): LogRecord[] {
    return this._problems;
  }

  clearProblems(): void {
    this._problems = [];
  }
}
