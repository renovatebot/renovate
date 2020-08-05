import { EventEmitter } from 'events';

export class OutputStreamMock extends EventEmitter {
  constructor(private result?: string) {
    super();
  }

  setEncoding(_enc: string): this {
    return this;
  }

  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (this.result && event === 'data') {
      listener(this.result);
    }
    return this;
  }
}
