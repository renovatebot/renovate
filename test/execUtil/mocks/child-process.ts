import { EventEmitter } from 'events';
import { ExecResult } from '../common';
import { OutputStreamMock } from './output-stream';

export class ChildProcessMock extends EventEmitter {
  public stdout: OutputStreamMock;

  public stderr: OutputStreamMock;

  constructor(private execResult: ExecResult) {
    super();
    if (execResult instanceof Error) {
      this.stdout = new OutputStreamMock();
      this.stderr = new OutputStreamMock();
    } else {
      this.stdout = new OutputStreamMock(execResult.stdout);
      this.stderr = new OutputStreamMock(execResult.stderr);
    }
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (event === 'error' && this.execResult instanceof Error) {
      listener(this.execResult);
    }

    if (event === 'close' && !(this.execResult instanceof Error)) {
      const code = this.execResult.code;
      listener(typeof code === 'number' ? code : 0);
    }

    return this;
  }
}
