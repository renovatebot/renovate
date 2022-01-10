export class Lazy<T> {
  private _didRun = false;
  private _value?: T;
  private _error: Error | undefined;

  constructor(private readonly executor: () => T) {}

  hasValue(): boolean {
    return this._didRun;
  }

  getValue(): T {
    if (!this._didRun) {
      try {
        this._value = this.executor();
      } catch (err) {
        this._error = err;
      } finally {
        this._didRun = true;
      }
    }
    if (this._error) {
      throw this._error;
    }
    return this._value;
  }
}
