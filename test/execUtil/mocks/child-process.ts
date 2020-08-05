import { EventEmitter } from 'events';
import { ExecResult } from '../common';
import { OutputStreamMock } from './output-stream';

export class ChildProcessMock extends EventEmitter {
  public stdout: OutputStreamMock;

  public stderr: OutputStreamMock;

  public connected = true;

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

    if (event === 'exit' && !(this.execResult instanceof Error)) {
      const code = this.execResult.code;
      listener(typeof code === 'number' ? code : 0);
    }

    return this;
  }

  kill(...args: any[]): boolean {
    const result = this.connected;
    this.connected = false;
    return result;
  }
}
