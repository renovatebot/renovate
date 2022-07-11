interface ValueResult<T> {
  type: 'success';
  value: T;
}

interface ErrorResult {
  type: 'error';
  err: Error;
}

export class Lazy<T> {
  private _result?: ValueResult<T> | ErrorResult;

  constructor(private readonly executor: () => T) {}

  hasValue(): boolean {
    return !!this._result;
  }

  getValue(): T {
    const result = this._result;
    if (result) {
      if (result.type === 'success') {
        return result.value;
      }

      throw result.err;
    }

    return this.realizeValue();
  }

  private realizeValue(): T {
    try {
      const value = this.executor();
      this._result = { type: 'success', value };
      return value;
    } catch (err) {
      this._result = { type: 'error', err };
      throw err;
    }
  }
}
