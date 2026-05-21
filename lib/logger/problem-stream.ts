// Do not static import `bunyan` here!
import { Stream } from 'node:stream';
import type { BunyanRecord } from './types.ts';

export const excludeProps = ['pid', 'time', 'v', 'hostname'];

export class ProblemStream extends Stream {
  private _problems: BunyanRecord[] = [];

  readable: boolean;

  writable: boolean;

  constructor() {
    super();
    this.readable = false;
    this.writable = true;
  }

  write(data: BunyanRecord): boolean {
    const problem = { ...data };
    for (const prop of excludeProps) {
      delete problem[prop];
    }
    this._problems.push(problem);
    return true;
  }

  getProblems(): BunyanRecord[] {
    return this._problems;
  }

  clearProblems(): void {
    this._problems = [];
  }
}
